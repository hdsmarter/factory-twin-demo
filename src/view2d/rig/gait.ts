/**
 * 2D 骨架人物的姿勢（純函數）：時間／行走距離 → 關節角度。
 *
 * 單位：人物全高 = 1。姿勢在人物的「矢狀面」中計算：f = 沿前進方向、h = 離地高度；原點 = 骨盆正下方的地面。
 * 繪製時把每個關節以 project(點, fwd) 投影到畫面（fwd = 前進 1 個身高在畫面上的位移），
 * 所以等角視角下斜著走、朝鏡頭走都有正確的透視縮短，朝左走也不需要鏡像。
 *
 * 步態先定義腳在地面上的軌跡（著地期腳在世界中不動、擺動期抬腳前移），
 * 再以兩段 IK 解出大腿／膝角度 → 腳不打滑由構造保證（任何行進方向皆然）。
 *
 * 角度慣例（度）：thigh／arm 由「垂直向下」起算、往前為正；knee 為膝彎（小腿相對大腿往後，≥ 0）；
 * elbow 為肘彎（前臂相對上臂往前，≥ 0）；lean、head 往前傾為正。
 */
import type { ActorAction } from '../../domain/actors'

export const BODY = {
  /** 腳踝離地高 */
  ankle: 0.04,
  thigh: 0.245,
  shin: 0.235,
  torso: 0.3,
  neck: 0.035,
  head: 0.145,
  upperArm: 0.17,
  foreArm: 0.16,
  foot: 0.085,
} as const

export const LIMITS = { knee: [0, 140], elbow: [0, 145] } as const

export const GAIT = {
  /** 著地期腳相對骨盆的前後範圍 ±reach */
  reach: 0.18,
  /** 一個週期中單腳著地所佔比例（> 0.5 → 有雙腳著地期） */
  stance: 0.55,
  lift: 0.07,
  /** 走路時骨盆高度與起伏 */
  hip: 0.475,
  bob: 0.012,
  lean: 5,
  armSwing: 20,
} as const

/** 一個步態週期（兩步）前進的距離（身高） */
export const STRIDE = (2 * GAIT.reach) / GAIT.stance

/** 起步／停下的緩動混合時間（秒） */
const BLEND_S = 0.4
/** 跟隨：前臂、頭比上臂晚的秒數 */
const LAG_S = 0.08
const WORK_CYCLE_S = 2.4
const BREATH_S = 3.6
const STAND_HIP = BODY.ankle + (BODY.thigh + BODY.shin) * 0.985

export type Fwd = { u: number; v: number }

/** 地面上的腳：f = 沿前進方向相對骨盆的距離；lift = 抬離地面高度 */
export interface FootTarget {
  f: number
  lift: number
}

/** 姿勢目標（在地面／身體座標中定義，可線性混合） */
export interface Targets {
  hip: number
  footN: FootTarget
  footF: FootTarget
  lean: number
  armN: number
  elbowN: number
  armF: number
  elbowF: number
  head: number
  /** 腳尖下壓角（擺動期） */
  toeN: number
  toeF: number
}

export interface Pose {
  /** 骨盆離地高度 */
  hip: number
  lean: number
  thighN: number
  kneeN: number
  thighF: number
  kneeF: number
  /** 腳掌絕對角度（0 = 平貼地面；負值 = 腳尖朝下） */
  footN: number
  footF: number
  armN: number
  elbowN: number
  armF: number
  elbowF: number
  head: number
  /** 呼吸：軀幹縱向縮放 */
  breathe: number
}

const TAU = Math.PI * 2
const DEG = 180 / Math.PI
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const frac = (x: number) => x - Math.floor(x)
export const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2)
const easeCos = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x)

const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const mixFoot = (a: FootTarget, b: FootTarget, k: number): FootTarget => ({ f: lerp(a.f, b.f, k), lift: lerp(a.lift, b.lift, k) })
function mixTargets(a: Targets, b: Targets, k: number): Targets {
  return {
    hip: lerp(a.hip, b.hip, k),
    footN: mixFoot(a.footN, b.footN, k),
    footF: mixFoot(a.footF, b.footF, k),
    lean: lerp(a.lean, b.lean, k),
    armN: lerp(a.armN, b.armN, k),
    elbowN: lerp(a.elbowN, b.elbowN, k),
    armF: lerp(a.armF, b.armF, k),
    elbowF: lerp(a.elbowF, b.elbowF, k),
    head: lerp(a.head, b.head, k),
    toeN: lerp(a.toeN, b.toeN, k),
    toeF: lerp(a.toeF, b.toeF, k),
  }
}

export const STAND: Targets = {
  hip: STAND_HIP,
  footN: { f: 0.035, lift: 0 },
  footF: { f: -0.035, lift: 0 },
  lean: 1,
  armN: 2,
  elbowN: 10,
  armF: -2,
  elbowF: 10,
  head: 0,
  toeN: 0,
  toeF: 0,
}

/** 單腳在相位 p 的地面軌跡：著地期等速後移（抵銷身體前進），擺動期抬腳以緩動前移 */
function footAt(p: number, reach: number): FootTarget & { toe: number } {
  const q = frac(p)
  if (q < GAIT.stance) return { f: reach - 2 * reach * (q / GAIT.stance), lift: 0, toe: 0 }
  const s = (q - GAIT.stance) / (1 - GAIT.stance)
  return { f: -reach + 2 * reach * easeCos(s), lift: GAIT.lift * Math.sin(Math.PI * s), toe: -18 * Math.sin(Math.PI * s) }
}

/** 走路目標：近側腿相位 p、遠側腿 p + 0.5；手臂與同側腿反相，前臂帶跟隨延遲。reach 預設對應 STRIDE */
export function walkTargets(phase: number, reach: number = GAIT.reach): Targets {
  const n = footAt(phase, reach)
  const f = footAt(phase + 0.5, reach)
  const c = Math.cos(TAU * phase)
  const lagged = Math.cos(TAU * (phase - 0.08))
  return {
    // 雙腳著地（相位 0、0.5）最低、單腳支撐中段最高
    hip: GAIT.hip - GAIT.bob * Math.cos(2 * TAU * phase),
    footN: { f: n.f, lift: n.lift },
    footF: { f: f.f, lift: f.lift },
    lean: GAIT.lean,
    armN: -GAIT.armSwing * c,
    elbowN: 18 + 14 * Math.max(0, lagged),
    armF: GAIT.armSwing * c,
    elbowF: 18 + 14 * Math.max(0, -lagged),
    head: 2 + 1.5 * Math.sin(2 * TAU * phase),
    toeN: n.toe,
    toeF: f.toe,
  }
}

/** 工作動作關鍵格（站點操作：預備 → 前伸取件 → 停留 → 拉回檢視 → 回到預備） */
const WORK_KEYS: { at: number; k: Partial<Targets> }[] = [
  { at: 0, k: { hip: 0.5, lean: 6, armN: 20, elbowN: 50, armF: 10, elbowF: 40, head: 4 } },
  { at: 0.15, k: { hip: 0.506, lean: 1, armN: 8, elbowN: 62, armF: 4, elbowF: 48, head: -3 } },
  { at: 0.4, k: { hip: 0.462, lean: 24, armN: 76, elbowN: 14, armF: 56, elbowF: 20, head: 4 } },
  { at: 0.55, k: { hip: 0.462, lean: 22, armN: 70, elbowN: 24, armF: 50, elbowF: 26, head: 6 } },
  { at: 0.82, k: { hip: 0.5, lean: 8, armN: 36, elbowN: 78, armF: 26, elbowF: 66, head: 6 } },
  { at: 1, k: { hip: 0.5, lean: 6, armN: 20, elbowN: 50, armF: 10, elbowF: 40, head: 4 } },
]

function workKey(u: number): Partial<Targets> {
  const q = frac(u)
  let i = 0
  while (i < WORK_KEYS.length - 2 && q >= WORK_KEYS[i + 1]!.at) i++
  const a = WORK_KEYS[i]!
  const b = WORK_KEYS[i + 1]!
  // sine 緩動：慢進慢出，峰值速度只有平均的 π/2 倍（cubic 為 3 倍，快動作會抖）
  const k = easeCos((q - a.at) / (b.at - a.at))
  const out: Partial<Targets> = {}
  for (const key of Object.keys(a.k) as (keyof Targets)[]) {
    ;(out as Record<string, number>)[key] = lerp(a.k[key] as number, b.k[key] as number, k)
  }
  return out
}

/**
 * 工作目標：雙腳不動、骨盆升降（IK 自動彎膝）；前臂與頭依延遲時間取樣（跟隨）。
 * 循環時長依停留時間微調成整數次（只延長、不縮短），離開站點時剛好回到預備姿勢，不會在前伸途中被拉走。
 */
export function workTargets(elapsed: number, duration = Infinity): Targets {
  const cycle = Number.isFinite(duration) ? duration / Math.max(1, Math.floor(duration / WORK_CYCLE_S)) : WORK_CYCLE_S
  const u = elapsed / cycle
  const now = workKey(u)
  const late = workKey(u - LAG_S / cycle)
  return { ...STAND, ...now, elbowN: late.elbowN!, elbowF: late.elbowF!, head: late.head! }
}

/** 兩段 IK（矢狀面）：骨盆在高度 hip，腳踝目標 (f, h)；膝蓋朝前 */
function legIK(hip: number, tf: number, th: number): { thigh: number; knee: number } {
  const L1 = BODY.thigh
  const L2 = BODY.shin
  const du = tf
  const dv = hip - th
  const dist = clamp(Math.hypot(du, dv), Math.abs(L1 - L2) + 1e-6, (L1 + L2) * (1 - 1e-9))
  const toward = Math.atan2(du, dv)
  const atHip = Math.acos(clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1))
  const atKnee = Math.acos(clamp((L1 * L1 + L2 * L2 - dist * dist) / (2 * L1 * L2), -1, 1))
  return { thigh: (toward + atHip) * DEG, knee: (Math.PI - atKnee) * DEG }
}

export function solvePose(tg: Targets, breathe = 1): Pose {
  const n = legIK(tg.hip, tg.footN.f, BODY.ankle + tg.footN.lift)
  const f = legIK(tg.hip, tg.footF.f, BODY.ankle + tg.footF.lift)
  return {
    hip: tg.hip,
    lean: tg.lean,
    thighN: n.thigh,
    kneeN: clamp(n.knee, LIMITS.knee[0], LIMITS.knee[1]),
    thighF: f.thigh,
    kneeF: clamp(f.knee, LIMITS.knee[0], LIMITS.knee[1]),
    footN: tg.toeN,
    footF: tg.toeF,
    armN: tg.armN,
    elbowN: clamp(tg.elbowN, LIMITS.elbow[0], LIMITS.elbow[1]),
    armF: tg.armF,
    elbowF: clamp(tg.elbowF, LIMITS.elbow[0], LIMITS.elbow[1]),
    head: tg.head,
    breathe,
  }
}

/** 矢狀面上的點 */
export type FH = { f: number; h: number }

const R = Math.PI / 180
/** 由 at 沿「垂直向下、往前轉 deg 度」的方向延伸 len */
const down = (at: FH, deg: number, len: number): FH => ({ f: at.f + Math.sin(deg * R) * len, h: at.h - Math.cos(deg * R) * len })
const up = (at: FH, deg: number, len: number): FH => ({ f: at.f + Math.sin(deg * R) * len, h: at.h + Math.cos(deg * R) * len })
const along = (at: FH, deg: number, len: number): FH => ({ f: at.f + Math.cos(deg * R) * len, h: at.h + Math.sin(deg * R) * len })

/** 正向運動學：所有關節在矢狀面上的位置 */
export function fk(p: Pose) {
  const hip: FH = { f: 0, h: p.hip }
  const leg = (thigh: number, knee: number, foot: number) => {
    const kneeAt = down(hip, thigh, BODY.thigh)
    const ankle = down(kneeAt, thigh - knee, BODY.shin)
    return { knee: kneeAt, ankle, toe: along(ankle, foot, BODY.foot) }
  }
  const N = leg(p.thighN, p.kneeN, p.footN)
  const F = leg(p.thighF, p.kneeF, p.footF)
  const neck = up(hip, p.lean, BODY.torso * p.breathe)
  const shoulder = up(hip, p.lean, (BODY.torso - 0.03) * p.breathe)
  const arm = (a: number, e: number) => {
    const elbow = down(shoulder, a, BODY.upperArm)
    return { elbow, hand: down(elbow, a + e, BODY.foreArm) }
  }
  const AN = arm(p.armN, p.elbowN)
  const AF = arm(p.armF, p.elbowF)
  const head = up(neck, p.lean + p.head, BODY.neck + BODY.head / 2)
  return {
    hip,
    kneeN: N.knee, ankleN: N.ankle, toeN: N.toe,
    kneeF: F.knee, ankleF: F.ankle, toeF: F.toe,
    neck, shoulder,
    elbowN: AN.elbow, handN: AN.hand,
    elbowF: AF.elbow, handF: AF.hand,
    head,
    /** 頭部朝向（度，往前為正） */
    headTilt: p.lean + p.head,
  }
}

export type Joints = ReturnType<typeof fk>

/** 矢狀面 → 畫面（單位仍為身高；+v 向下） */
export const project = (p: FH, fwd: Fwd) => ({ u: fwd.u * p.f, v: fwd.v * p.f - p.h })

export interface WorkerMotion {
  action: ActorAction
  /** 本週期已走距離（公尺） */
  distance: number
  /** 路線一圈總長（公尺） */
  lap: number
  elapsed: number
  duration: number
}

/**
 * 人員在時間 t 的關節姿勢。heightM = 人物在世界中的身高（公尺，含放大倍率），用於把行走距離換成步態相位。
 * 起步、停下各以 BLEND_S 秒緩動混合站姿；呼吸以 t 驅動。
 */
export function workerPose(m: WorkerMotion, t: number, heightM: number): Pose {
  const edge = Math.min(m.elapsed, m.duration - m.elapsed)
  const w = easeCos(clamp(edge / BLEND_S, 0, 1))
  // 步幅微調成一圈走整數個步態週期：週期邊界 distance 歸零時相位仍連續；
  // reach 依微調後的步幅回推，著地腳的後移速度仍與身體前進完全抵銷
  const cycles = Math.max(1, Math.round(m.lap / (STRIDE * heightM)))
  const reach = (m.lap / cycles / heightM) * (GAIT.stance / 2)
  const active = m.action === 'walk' ? walkTargets((m.distance * cycles) / m.lap, reach) : workTargets(m.elapsed, m.duration)
  const breathe = 1 + 0.012 * Math.sin((TAU * t) / BREATH_S)
  return solvePose(mixTargets(STAND, active, w), breathe)
}
