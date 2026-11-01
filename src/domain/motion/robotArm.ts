import { cyclePhase, directionOf } from './time'

export type V3 = { x: number; y: number; z: number }

export interface RobotArmParams {
  /** 底座中心（世界座標，y=0 為地面） */
  origin: { x: number; z: number }
  /** 肩關節離地高度 */
  shoulderHeight: number
  upperArm: number
  forearm: number
  /** 腕關節到夾爪尖端（夾爪恆朝下） */
  tool: number
  pick: V3
  place: V3
  cycleSeconds: number
}

/** 關節角（弧度）。base 為 Y 軸偏擺（three.js 慣例）；shoulder 為上臂仰角；elbow、wrist 為相對前一節的角度。 */
export interface Joints {
  base: number
  shoulder: number
  elbow: number
  wrist: number
}

export interface RobotArmPose extends Joints {
  /** 夾爪閉合程度：0 = 張開、1 = 夾緊 */
  grip: number
  /** 是否夾著料件（取料夾緊過半 → 放料張開過半） */
  carrying: boolean
  /** 夾爪尖端世界座標（由關節角正向運動學算出） */
  tool: V3
}

export const JOINT_LIMITS = {
  base: [-Math.PI, Math.PI],
  shoulder: [0, 2.8],
  elbow: [-2.8, 0],
  wrist: [-Math.PI, Math.PI],
} as const satisfies Record<keyof Joints, readonly [number, number]>

const LIFT = 0.35
const HOME_RAISE = 0.6
/** 待機點收回到平均半徑的比例，確保待機點在手臂可達範圍內 */
const HOME_REACH = 0.8

/** ARM-6AX 的連桿尺寸（公尺）；模擬與 3D 渲染共用這一份。 */
export const ARM_6AX_DIMENSIONS = { shoulderHeight: 0.9, upperArm: 1.0, forearm: 0.9, tool: 0.35 } as const

type Waypoint = 'home' | 'abovePick' | 'pick' | 'abovePlace' | 'place'

/** 取放動作腳本：[週期相位, 路徑點]。相位之間以平滑插值移動。 */
const SCRIPT: ReadonlyArray<readonly [number, Waypoint]> = [
  [0.0, 'home'],
  [0.14, 'abovePick'],
  [0.24, 'pick'],
  [0.34, 'pick'],
  [0.44, 'abovePick'],
  [0.62, 'abovePlace'],
  [0.72, 'place'],
  [0.82, 'place'],
  [0.9, 'abovePlace'],
  [1.0, 'home'],
]
const GRIP_CLOSE: readonly [number, number] = [0.24, 0.34]
const GRIP_OPEN: readonly [number, number] = [0.72, 0.82]

type Cyl = { yaw: number; r: number; y: number }

const smoothstep = (u: number) => u * u * (3 - 2 * u)
const clamp01 = (u: number) => Math.min(1, Math.max(0, u))
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

function toCyl(p: RobotArmParams, v: V3): Cyl {
  const dx = v.x - p.origin.x
  const dz = v.z - p.origin.z
  return { yaw: Math.atan2(-dz, dx), r: Math.hypot(dx, dz), y: v.y }
}

function waypoints(p: RobotArmParams): Record<Waypoint, Cyl> {
  const pick = toCyl(p, p.pick)
  const place = toCyl(p, p.place)
  const home: Cyl = {
    yaw: wrapAngle(pick.yaw + wrapAngle(place.yaw - pick.yaw) / 2),
    r: ((pick.r + place.r) / 2) * HOME_REACH,
    y: Math.max(pick.y, place.y) + HOME_RAISE,
  }
  return {
    home,
    pick,
    place,
    abovePick: { ...pick, y: pick.y + LIFT },
    abovePlace: { ...place, y: place.y + LIFT },
  }
}

function interpolate(a: Cyl, b: Cyl, u: number): Cyl {
  const k = smoothstep(u)
  return { yaw: wrapAngle(a.yaw + wrapAngle(b.yaw - a.yaw) * k), r: a.r + (b.r - a.r) * k, y: a.y + (b.y - a.y) * k }
}

function targetAt(p: RobotArmParams, phase: number): Cyl {
  const w = waypoints(p)
  for (let i = 1; i < SCRIPT.length; i++) {
    const [p0, a] = SCRIPT[i - 1]!
    const [p1, b] = SCRIPT[i]!
    if (phase <= p1) return interpolate(w[a], w[b], (phase - p0) / (p1 - p0))
  }
  return w.home
}

function gripAt(phase: number): number {
  const ramp = ([a, b]: readonly [number, number]) => clamp01(((phase - a) / (b - a) - 0.2) / 0.6)
  if (phase < GRIP_CLOSE[0]) return 0
  if (phase <= GRIP_CLOSE[1]) return ramp(GRIP_CLOSE)
  if (phase < GRIP_OPEN[0]) return 1
  if (phase <= GRIP_OPEN[1]) return 1 - ramp(GRIP_OPEN)
  return 0
}

/** 解析式兩連桿 IK（手肘朝上、夾爪恆朝下）。 */
function solve(p: RobotArmParams, c: Cyl): Joints {
  const dx = c.r
  const dy = c.y + p.tool - p.shoulderHeight
  const L1 = p.upperArm
  const L2 = p.forearm
  const d = Math.min(Math.hypot(dx, dy), L1 + L2 - 1e-9)
  const cosE = (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2)
  const e = Math.acos(Math.max(-1, Math.min(1, cosE)))
  const shoulder = Math.atan2(dy, dx) + Math.atan2(L2 * Math.sin(e), L1 + L2 * Math.cos(e))
  return { base: c.yaw, shoulder, elbow: -e, wrist: -Math.PI / 2 - (shoulder - e) }
}

/** 正向運動學：關節角 → 夾爪尖端世界座標。 */
export function forwardTool(p: RobotArmParams, q: Joints): V3 {
  const a1 = q.shoulder
  const a2 = a1 + q.elbow
  const a3 = a2 + q.wrist
  const r = p.upperArm * Math.cos(a1) + p.forearm * Math.cos(a2) + p.tool * Math.cos(a3)
  const y = p.shoulderHeight + p.upperArm * Math.sin(a1) + p.forearm * Math.sin(a2) + p.tool * Math.sin(a3)
  const dir = directionOf((q.base * 180) / Math.PI)
  return { x: p.origin.x + dir.x * r, y, z: p.origin.z + dir.z * r }
}

/** 時間 t 時機械手臂的姿態（純函數）：一個週期完成一次取放並回到原位。 */
export function robotArmPose(p: RobotArmParams, t: number): RobotArmPose {
  const phase = cyclePhase(t, p.cycleSeconds)
  const joints = solve(p, targetAt(p, phase))
  const grip = gripAt(phase)
  return { ...joints, grip, carrying: grip > 0.5, tool: forwardTool(p, joints) }
}

const WAYPOINT_LABEL: Record<Waypoint, string> = { pick: '取料點', abovePick: '取料點上方', place: '放料點', abovePlace: '放料點上方', home: '待機點' }

/**
 * 取放動作的每個路徑點是否可達（含關節限制）。可達回傳 null，否則回傳說明（指出哪個點位）。
 * 與 IK 使用同一份路徑點與尺寸，確保「驗證通過 = 實際動得到」。
 */
export function armReachProblem(p: RobotArmParams): string | null {
  const w = waypoints(p)
  const order: Waypoint[] = ['pick', 'abovePick', 'place', 'abovePlace', 'home']
  for (const name of order) {
    const c = w[name]
    const d = Math.hypot(c.r, c.y + p.tool - p.shoulderHeight)
    const tooFar = d > p.upperArm + p.forearm - 1e-6
    const tooNear = d < Math.abs(p.upperArm - p.forearm) + 1e-6
    if (tooFar || tooNear) return `${WAYPOINT_LABEL[name]}${tooFar ? '超出手臂可達範圍' : '太靠近底座'}`
    const q = solve(p, c)
    for (const j of ['shoulder', 'elbow', 'wrist'] as const) {
      const [min, max] = JOINT_LIMITS[j]
      if (q[j] < min || q[j] > max) return `${WAYPOINT_LABEL[name]}需要的 ${j} 關節角度超出限制`
    }
  }
  // 路徑點之間以柱座標插值移動，途中可能穿過肩部附近的禁區 → 沿每段取樣檢查
  for (let i = 1; i < SCRIPT.length; i++) {
    const a = SCRIPT[i - 1]![1]
    const b = SCRIPT[i]![1]
    for (let k = 1; k < TRANSIT_SAMPLES; k++) {
      const c = interpolate(w[a], w[b], k / TRANSIT_SAMPLES)
      const d = Math.hypot(c.r, c.y + p.tool - p.shoulderHeight)
      const q = solve(p, c)
      const outOfLimit = (['shoulder', 'elbow', 'wrist'] as const).some((j) => q[j] < JOINT_LIMITS[j][0] || q[j] > JOINT_LIMITS[j][1])
      if (d > p.upperArm + p.forearm - 1e-6 || d < Math.abs(p.upperArm - p.forearm) + 1e-6 || outOfLimit) {
        return `${WAYPOINT_LABEL[a]}→${WAYPOINT_LABEL[b]} 移動途中關節角度超出限制`
      }
    }
  }
  return null
}

/** 路徑段取樣數（可達性驗證用） */
const TRANSIT_SAMPLES = 24

/** 由配置中的設備（佔地 + 取放偏移參數）建立手臂參數；驗證與模擬共用。 */
export function armParamsOf(
  e: { footprint: { x: number; z: number }; params?: Record<string, number> },
  cycleSeconds: number,
): RobotArmParams {
  const f = e.footprint
  const q = (k: string, d: number) => e.params?.[k] ?? d
  return {
    ...ARM_6AX_DIMENSIONS,
    origin: { x: f.x, z: f.z },
    pick: { x: f.x + q('pickDx', 1), y: q('pickY', 1), z: f.z + q('pickDz', 0) },
    place: { x: f.x + q('placeDx', -1), y: q('placeY', 1), z: f.z + q('placeDz', 0) },
    cycleSeconds,
  }
}
