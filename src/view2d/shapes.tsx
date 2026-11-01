import type { EquipmentKind, EquipmentVariant, Footprint, PlacedEquipment } from '../domain/layout'
import { ARM_6AX_DIMENSIONS as ARM, type RobotArmPose } from '../domain/motion/robotArm'
import { directionOf } from '../domain/motion/time'
import { isoProject } from '../domain/projection'
import type { EquipmentState } from '../domain/simulate'
import { CONVEYOR_BELT_TOP as BELT_TOP, PALLET_TOP, WORKPIECE_HEIGHT } from '../domain/specs'
import { equipment as tone, ink, tree as treeTone, type Tone } from './palette'

/**
 * 等角插畫的基本圖形。所有座標都是世界座標（公尺），一律經 isoProject 投影；
 * 描邊用 non-scaling-stroke，不論構圖遠近都維持插畫式的粗黑線。
 */
export type XZ = { x: number; z: number }

/** 外框粗細（螢幕像素） */
export const OUTLINE = 1.4
const THIN = 0.8

const f3 = (n: number) => Math.round(n * 1000) / 1000
export const uv = (x: number, y: number, z: number) => isoProject(x, y, z)
export const pt = (x: number, y: number, z: number) => {
  const p = isoProject(x, y, z)
  return `${f3(p.u)},${f3(p.v)}`
}

/** 單位長度在畫面上的投影：水平圓（半徑 1）→ 橢圓半軸；垂直 1 公尺 → 畫面高度 */
const EX = isoProject(1, 0, 0)
const EZ = isoProject(0, 0, 1)
export const ELLIPSE = { rx: Math.hypot(EX.u, EZ.u), ry: Math.hypot(EX.v, EZ.v) }
export const VERTICAL = -isoProject(0, 1, 0).v

export const outline = { stroke: ink, strokeWidth: OUTLINE, strokeLinejoin: 'round', vectorEffect: 'non-scaling-stroke' } as const
const thin = { ...outline, strokeWidth: THIN } as const

export function Poly({ points, fill, line = true }: { points: [number, number, number][]; fill: string; line?: boolean }) {
  return <polygon points={points.map((p) => pt(...p)).join(' ')} fill={fill} {...(line ? outline : {})} />
}

/** 平面多邊形（xz 點列，固定高度 y） */
export function Flat({ points, y, fill, stroke }: { points: XZ[]; y: number; fill: string; stroke?: string }) {
  return (
    <polygon
      points={points.map((p) => pt(p.x, y, p.z)).join(' ')}
      fill={fill}
      {...(stroke ? { ...thin, stroke } : outline)}
    />
  )
}

/**
 * 直立稜柱：底面為逆時針（俯視，x 右 z 前）的凸多邊形。
 * 只畫面向相機的側面（-x 側用 left 色、+z 側用 right 色）＋頂面，凸形狀不需要再排序。
 */
export function Prism({ base, y0, y1, tone: t, line = true }: { base: XZ[]; y0: number; y1: number; tone: Tone; line?: boolean }) {
  const n = base.length
  const sides = base.flatMap((a, i) => {
    const b = base[(i + 1) % n]!
    const nx = b.z - a.z
    const nz = -(b.x - a.x)
    if (-nx + nz <= 1e-9) return [] // 背向相機（相機在 -x、+z 方向）
    const side = isoProject(nx, 0, nz).u < 0 ? t.left : t.right
    return [
      <polygon
        key={i}
        points={[pt(a.x, y0, a.z), pt(b.x, y0, b.z), pt(b.x, y1, b.z), pt(a.x, y1, a.z)].join(' ')}
        fill={side}
        {...(line ? outline : {})}
      />,
    ]
  })
  return (
    <g>
      {sides}
      <polygon points={base.map((p) => pt(p.x, y1, p.z)).join(' ')} fill={t.top} {...(line ? outline : {})} />
    </g>
  )
}

/** 依設備佔地（中心、旋轉）把本地矩形轉成世界座標四角（逆時針）。 */
export function localRect(f: Pick<Footprint, 'x' | 'z' | 'rotation'>, x0: number, x1: number, z0: number, z1: number): XZ[] {
  const ax = directionOf(f.rotation) // 本地 +x
  const az = { x: -ax.z, z: ax.x } // 本地 +z
  const w = (lx: number, lz: number) => ({ x: f.x + ax.x * lx + az.x * lz, z: f.z + ax.z * lx + az.z * lz })
  const corners = [w(x0, z0), w(x1, z0), w(x1, z1), w(x0, z1)]
  return ccw(corners)
}

/** 統一頂點繞向（有號面積 > 0），Prism 才能用邊的法線判斷外側 */
function ccw(p: XZ[]): XZ[] {
  const area = p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length]!
    return s + (a.x * b.z - b.x * a.z)
  }, 0)
  return area > 0 ? p : [...p].reverse()
}

/** 以中心、朝向（Y 軸偏擺，three.js 慣例）與長寬建立的矩形 */
export function orientedRect(c: XZ, heading: number, length: number, width: number): XZ[] {
  const fwd = { x: Math.cos(heading), z: -Math.sin(heading) }
  const side = { x: -fwd.z, z: fwd.x }
  const corner = (a: number, b: number) => ({ x: c.x + (fwd.x * a * length + side.x * b * width) / 2, z: c.z + (fwd.z * a * length + side.z * b * width) / 2 })
  return ccw([corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)])
}

/** 直立圓柱（等角下為橢圓頂＋側帶） */
export function Cylinder({ x, z, r, y0, y1, fill, top }: { x: number; z: number; r: number; y0: number; y1: number; fill: string; top: string }) {
  const a = uv(x, y0, z)
  const b = uv(x, y1, z)
  const rx = r * ELLIPSE.rx
  const ry = r * ELLIPSE.ry
  const d = `M${f3(a.u - rx)},${f3(b.v)} L${f3(a.u - rx)},${f3(a.v)} A${f3(rx)},${f3(ry)} 0 0 0 ${f3(a.u + rx)},${f3(a.v)} L${f3(a.u + rx)},${f3(b.v)} Z`
  return (
    <g>
      <path d={d} fill={fill} {...outline} />
      <ellipse cx={f3(b.u)} cy={f3(b.v)} rx={f3(rx)} ry={f3(ry)} fill={top} {...outline} />
    </g>
  )
}

/* ───────────── 樹 ───────────── */

/** 扁平樹：底部在 (x, y, z) 的投影點；variant 0 圓冠、1 針葉、2 高橢圓冠 */
export function Tree({ x, y, z, scale, variant }: { x: number; y: number; z: number; scale: number; variant: number }) {
  const p = uv(x, y, z)
  const h = VERTICAL * scale
  const crown = treeTone.crowns[variant % treeTone.crowns.length]!
  const trunkH = (variant === 1 ? 1.2 : 2.2) * h
  const trunk = <rect x={f3(-0.25 * scale)} y={f3(-trunkH)} width={f3(0.5 * scale)} height={f3(trunkH)} fill={treeTone.trunk} {...outline} />
  let top
  if (variant === 1) {
    const w = 2.0 * scale
    const tiers = [0, 1, 2].map((k) => {
      const yb = -trunkH - k * 1.6 * h
      return <polygon key={k} points={`${f3(-w * (1 - k * 0.22))},${f3(yb)} ${f3(w * (1 - k * 0.22))},${f3(yb)} 0,${f3(yb - 2.6 * h)}`} fill={crown} {...outline} />
    })
    top = <g>{tiers}</g>
  } else if (variant === 2) {
    top = <ellipse cx={0} cy={f3(-trunkH - 2.2 * h)} rx={f3(1.5 * scale)} ry={f3(2.6 * h)} fill={crown} {...outline} />
  } else {
    top = (
      <g>
        <circle cx={0} cy={f3(-trunkH - 1.7 * h)} r={f3(2.1 * scale)} fill={crown} {...outline} />
        <circle cx={f3(0.9 * scale)} cy={f3(-trunkH - 0.9 * h)} r={f3(1.3 * scale)} fill={crown} {...outline} />
      </g>
    )
  }
  return (
    <g transform={`translate(${f3(p.u)} ${f3(p.v)})`}>
      {trunk}
      {top}
    </g>
  )
}

/* ───────────── 設備 ───────────── */

type Drawer = (pe: PlacedEquipment, s: EquipmentState | undefined) => React.JSX.Element

const CNC_HEIGHT = 2.1
const INSPECTION_TOP = 2.0
const RACK_TOP = 1.9
const RACK_UNIT = 0.92
const WP = { length: 0.32, width: 0.24 }

const ORIGIN: XZ = { x: 0, z: 0 }

/**
 * 把子圖（以世界原點為錨點繪製）平移到世界座標 (x, y, z) 的投影點。
 * isoProject 是無偏移的線性映射，平移 = 在該點繪製；translate 即圖元的實際錨點（data-part 供測試定位）。
 */
export function At({ part, x, y, z, children }: { part?: string; x: number; y: number; z: number; children: React.ReactNode }) {
  const p = isoProject(x, y, z)
  return (
    <g data-part={part} transform={`translate(${p.u} ${p.v})`}>
      {children}
    </g>
  )
}

/** 料件（底面中心在 c、高度 y） */
function Workpiece({ c, y }: { c: XZ; y: number }) {
  return <Prism base={orientedRect(c, 0, WP.length, WP.width)} y0={y} y1={y + WORKPIECE_HEIGHT} tone={tone.workpiece} />
}

const depthOf = (p: XZ) => -p.x + p.z
const byDepth = <T extends XZ>(a: T, b: T) => depthOf(a) - depthOf(b)

const conveyor: Drawer = (pe, s) => {
  const f = pe.equipment.footprint
  const L = f.width
  const D = f.depth
  const ax = directionOf(f.rotation)
  const at = (local: number) => ({ x: f.x + ax.x * local, z: f.z + ax.z * local })
  const legs = Math.max(2, Math.round(L / 1.6) + 1)
  const legXs = Array.from({ length: legs }, (_, i) => -L / 2 + 0.15 + (i * (L - 0.3)) / (legs - 1))
  const st = s?.kind === 'conveyor' ? s : undefined
  const stripes = st ? Array.from({ length: Math.round(L) }, (_, k) => ((k + st.beltOffset) % L) - L / 2) : []
  const items = st ? st.items.map((it) => at(it.s - L / 2)).sort(byDepth) : []
  return (
    <g>
      {legXs.flatMap((lx) => [-1, 1].map((side) => (
        <Prism key={`${lx}${side}`} base={localRect(f, lx - 0.04, lx + 0.04, side * (D / 2 - 0.08) - 0.04, side * (D / 2 - 0.08) + 0.04)} y0={0} y1={BELT_TOP - 0.2} tone={tone.cncBase} />
      )))}
      <Prism base={localRect(f, -L / 2, L / 2, -D / 2, D / 2)} y0={BELT_TOP - 0.2} y1={BELT_TOP} tone={tone.conveyorFrame} />
      <Flat points={localRect(f, -L / 2, L / 2, -D / 2 + 0.07, D / 2 - 0.07)} y={BELT_TOP} fill={tone.belt.top} />
      {stripes.map((lx) => (
        <polyline key={lx} points={[pt(at(lx).x - ax.z * (D / 2 - 0.1), BELT_TOP, at(lx).z + ax.x * (D / 2 - 0.1)), pt(at(lx).x + ax.z * (D / 2 - 0.1), BELT_TOP, at(lx).z - ax.x * (D / 2 - 0.1))].join(' ')} fill="none" {...thin} stroke={tone.belt.right} />
      ))}
      {items.map((c, i) => (
        <At key={i} part="conveyor-item" x={c.x} y={BELT_TOP} z={c.z}>
          <Workpiece c={ORIGIN} y={0} />
        </At>
      ))}
    </g>
  )
}

/** 狀態燈：綠燈亮度隨 activity 脈動 */
function StatusTower({ c, y, activity }: { c: XZ; y: number; activity: number }) {
  const lamp = uv(c.x, y + 0.36, c.z)
  return (
    <g>
      <Cylinder x={c.x} z={c.z} r={0.03} y0={y} y1={y + 0.3} fill={tone.cncBase.left} top={tone.cncBase.top} />
      <circle cx={f3(lamp.u)} cy={f3(lamp.v)} r={0.09} fill={tone.statusGreen} fillOpacity={0.45 + 0.55 * activity} {...outline} />
    </g>
  )
}

const cnc: Drawer = (pe, s) => {
  const f = pe.equipment.footprint
  const { width: W, depth: D } = f
  const activity = s?.kind === 'machine' ? s.activity : 0
  const glass = localRect(f, -W * 0.31, W * 0.31, D / 2, D / 2)
  const front = (y: number) => glass.map((p) => [p.x, y, p.z] as [number, number, number])
  const [g0, g1] = [front(0.5 + 0.25), front(CNC_HEIGHT - 0.35)]
  const towerBase = localRect(f, W / 2 - 0.2, W / 2 - 0.2, -D / 2 + 0.2, -D / 2 + 0.2)[0]!
  return (
    <g>
      <Prism base={localRect(f, -W / 2, W / 2, -D / 2, D / 2)} y0={0} y1={0.5} tone={tone.cncBase} />
      <Prism base={localRect(f, -W / 2, W / 2, -D / 2, D / 2)} y0={0.5} y1={CNC_HEIGHT} tone={tone.cnc} />
      {/* 前方視窗（只在本地 +z 面朝向相機時可見） */}
      {isoFacing(f, 'front') && <Poly points={[g0[0]!, g0[1]!, g1[1]!, g1[0]!]} fill={tone.glass} />}
      <Prism base={localRect(f, -W / 2, W / 2, D * 0.19, D / 2)} y0={CNC_HEIGHT - 0.24} y1={CNC_HEIGHT} tone={tone.machineAccent} />
      <StatusTower c={towerBase} y={CNC_HEIGHT} activity={activity} />
    </g>
  )
}

/** 本地 +z（front）面是否面向相機 */
function isoFacing(f: Footprint, face: 'front'): boolean {
  const ax = directionOf(f.rotation)
  const n = face === 'front' ? { x: -ax.z, z: ax.x } : ax
  return -n.x + n.z > 1e-9
}

const inspection: Drawer = (pe, s) => {
  const f = pe.equipment.footprint
  const D = f.depth
  const activity = s?.kind === 'machine' ? s.activity : 0
  const post = (side: number) => (
    <Prism base={localRect(f, -0.11, 0.11, side * (D / 2 - 0.08) - 0.08, side * (D / 2 - 0.08) + 0.08)} y0={0} y1={INSPECTION_TOP - 0.14} tone={tone.cnc} />
  )
  const ax = directionOf(f.rotation)
  const scan = (activity - 0.5) * f.width * 0.5
  const beamA = { x: f.x + ax.x * scan - ax.z * (D / 2 - 0.2), z: f.z + ax.z * scan + ax.x * (D / 2 - 0.2) }
  const beamB = { x: f.x + ax.x * scan + ax.z * (D / 2 - 0.2), z: f.z + ax.z * scan - ax.x * (D / 2 - 0.2) }
  const back = isoFacing(f, 'front') ? -1 : 1
  return (
    <g>
      {post(back)}
      <polyline points={[pt(beamA.x, BELT_TOP + 0.45, beamA.z), pt(beamB.x, BELT_TOP + 0.45, beamB.z)].join(' ')} stroke={tone.inspectionLight} strokeWidth={0.06} strokeOpacity={0.4 + 0.6 * activity} strokeLinecap="round" />
      {post(-back)}
      <Prism base={localRect(f, -0.25, 0.25, -D / 2, D / 2)} y0={INSPECTION_TOP - 0.14} y1={INSPECTION_TOP + 0.14} tone={tone.machineAccent} />
      <StatusTower c={localRect(f, 0, 0, -D / 2 + 0.15, -D / 2 + 0.15)[0]!} y={INSPECTION_TOP + 0.14} activity={activity} />
    </g>
  )
}

const SHELVES = [0.12, 0.7, 1.3, RACK_TOP - 0.05]

const rack: Drawer = (pe) => {
  const f = pe.equipment.footprint
  const { width: W, depth: D } = f
  const count = Math.max(1, Math.floor(W / RACK_UNIT))
  const xs = Array.from({ length: count + 1 }, (_, i) => (i - count / 2) * RACK_UNIT)
  const posts = (side: number) =>
    xs.map((lx) => <Prism key={`${lx}${side}`} base={localRect(f, lx - 0.04, lx + 0.04, side * (D / 2 - 0.04) - 0.04, side * (D / 2 - 0.04) + 0.04)} y0={0} y1={RACK_TOP} tone={tone.rack} />)
  const back = isoFacing(f, 'front') ? -1 : 1
  // 每格層板放一個箱子（決定性：依格位索引交錯）
  const boxes = SHELVES.slice(0, 3).flatMap((y, k) =>
    xs.slice(0, count).flatMap((lx, i) => ((i + k) % 3 === 2 ? [] : [{ lx: lx + RACK_UNIT / 2, y }])),
  )
  return (
    <g>
      {posts(back)}
      {SHELVES.map((y, k) => (
        <g key={y}>
          <Prism base={localRect(f, -W / 2 + 0.02, W / 2 - 0.02, -D / 2, D / 2)} y0={y - 0.05} y1={y} tone={tone.rack} />
          {boxes
            .filter((b) => b.y === y)
            .map((b) => (
              <Prism key={b.lx} base={localRect(f, b.lx - 0.3 + (k % 2) * 0.05, b.lx + 0.28, -D / 2 + 0.15, D / 2 - 0.15)} y0={y} y1={y + 0.42} tone={tone.crate} />
            ))}
        </g>
      ))}
      {xs.slice(0, count).map((lx, i) => (
        <Prism key={`top${lx}`} base={localRect(f, lx + 0.2, lx + RACK_UNIT - 0.2, -0.3, 0.3)} y0={RACK_TOP} y1={RACK_TOP + 0.35 + (i % 2) * 0.1} tone={tone.crate} />
      ))}
      {posts(-back)}
    </g>
  )
}

const pallet: Drawer = (pe) => {
  const f = pe.equipment.footprint
  const stack = [0, 1].flatMap((layer) =>
    [-0.3, 0.3].flatMap((lx) => [-0.22, 0.22].map((lz) => ({ ...localRect(f, lx, lx, lz, lz)[0]!, layer }))),
  )
  return (
    <g>
      <Prism base={localRect(f, -f.width / 2, f.width / 2, -f.depth / 2, f.depth / 2)} y0={0} y1={PALLET_TOP} tone={tone.pallet} />
      {[0, 1].map((layer) =>
        stack
          .filter((p) => p.layer === layer)
          .sort(byDepth)
          .map((p, i) => <Workpiece key={`${layer}${i}`} c={p} y={PALLET_TOP + layer * WORKPIECE_HEIGHT} />),
      )}
    </g>
  )
}

const FINGER_OPEN = 0.1
const FINGER_CLOSED = 0.045

/** 機械手臂：底座圓柱＋與 forwardTool 相同運動學的兩段連桿＋夾爪。 */
function Arm({ f, pose }: { f: Footprint; pose: RobotArmPose | undefined }) {
  const o = { x: f.x, z: f.z }
  if (!pose) return <Cylinder x={o.x} z={o.z} r={0.4} y0={0} y1={0.2} fill={tone.armBase.left} top={tone.armBase.top} />
  const dir = directionOf((pose.base * 180) / Math.PI)
  const a1 = pose.shoulder
  const a2 = a1 + pose.elbow
  const at = (r: number, y: number): [number, number, number] => [o.x + dir.x * r, y, o.z + dir.z * r]
  const r1 = ARM.upperArm * Math.cos(a1)
  const y1 = ARM.shoulderHeight + ARM.upperArm * Math.sin(a1)
  const r2 = r1 + ARM.forearm * Math.cos(a2)
  const y2 = y1 + ARM.forearm * Math.sin(a2)
  const joints = [at(0, ARM.shoulderHeight), at(r1, y1), at(r2, y2)]
  const tip: [number, number, number] = [pose.tool.x, pose.tool.y, pose.tool.z]
  const line = (ps: [number, number, number][], w: number, color: string) => (
    <polyline points={ps.map((p) => pt(...p)).join(' ')} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
  )
  const gap = FINGER_OPEN + (FINGER_CLOSED - FINGER_OPEN) * pose.grip
  const perp = { x: -dir.z, z: dir.x }
  // 夾爪（手指與夾持中的料件）以工具尖端為原點繪製，再平移到 pose.tool 的投影
  const finger = (k: number) => {
    const fx = perp.x * gap * k
    const fz = perp.z * gap * k
    return line([[fx, 0.14, fz], [fx, 0, fz]], 0.05, ink)
  }
  return (
    <g>
      <Cylinder x={o.x} z={o.z} r={0.4} y0={0} y1={0.2} fill={tone.armBase.left} top={tone.armBase.top} />
      <Cylinder x={o.x} z={o.z} r={0.28} y0={0.2} y1={0.64} fill={tone.armLink} top={tone.armLink} />
      {line([...joints, [tip[0], tip[1] + 0.14, tip[2]]], 0.26, ink)}
      {line(joints, 0.18, tone.armLink)}
      {line([joints[2]!, [tip[0], tip[1] + 0.14, tip[2]]], 0.1, tone.armJoint)}
      {joints.map((j, i) => {
        const p = uv(...j)
        return <circle key={i} cx={f3(p.u)} cy={f3(p.v)} r={[0.15, 0.12, 0.08][i]} fill={tone.armJoint} {...outline} />
      })}
      <At part="gripper" x={tip[0]} y={tip[1]} z={tip[2]}>
        {finger(-1)}
        {finger(1)}
        {pose.carrying && <Workpiece c={ORIGIN} y={-WORKPIECE_HEIGHT} />}
      </At>
    </g>
  )
}

const robotArm: Drawer = (pe, s) => <Arm f={pe.equipment.footprint} pose={s?.kind === 'robot-arm' ? s.pose : undefined} />

/** 帶 variant 的設備種類（依 variant 分派外觀） */
type VariantKind = 'machine' | 'storage'
/** 2D 設備註冊表的鍵：其餘 kind 直接當鍵（新增 kind 會自動進入此聯集），機台與倉儲依 variant */
type ShapeKey = Exclude<EquipmentKind, VariantKind> | EquipmentVariant

/**
 * 2D 設備註冊表：每個鍵一個繪製函數與外觀高度（公尺，排序時估算畫面範圍用，與 3D 尺寸一致）。
 * mapped type 保證新增 kind／variant 時編譯期就會要求補上，不會靜默落到某個預設外觀。
 */
const SHAPES: { [K in ShapeKey]: { draw: Drawer; top: number } } = {
  conveyor: { draw: conveyor, top: BELT_TOP + WORKPIECE_HEIGHT },
  'robot-arm': { draw: robotArm, top: ARM.shoulderHeight + ARM.upperArm + ARM.forearm },
  cnc: { draw: cnc, top: CNC_HEIGHT + 0.5 },
  inspection: { draw: inspection, top: INSPECTION_TOP + 0.6 },
  rack: { draw: rack, top: RACK_TOP + 0.45 },
  pallet: { draw: pallet, top: PALLET_TOP + 2 * WORKPIECE_HEIGHT },
}

function shapeOf(pe: PlacedEquipment): { draw: Drawer; top: number } {
  if (pe.kind !== 'machine' && pe.kind !== 'storage') return SHAPES[pe.kind]
  if (!pe.variant) throw new Error(`${pe.equipment.id}：${pe.kind} 缺少 variant`)
  return SHAPES[pe.variant]
}

export function equipmentTop(pe: PlacedEquipment): number {
  return shapeOf(pe).top
}

/** 同一位置重疊時的繪製順序（例如檢測站門架跨在輸送帶上，要後畫） */
export function equipmentLayer(pe: PlacedEquipment): number {
  return pe.kind === 'conveyor' ? 1 : 2
}

export function EquipmentShape({ pe, state }: { pe: PlacedEquipment; state: EquipmentState | undefined }) {
  return shapeOf(pe).draw(pe, state)
}
