import type { Actor } from './layout'
import { cyclePhase } from './motion/time'

export type ActorAction = 'walk' | 'work' | 'move' | 'dock'

export interface ActorPose {
  x: number
  z: number
  /** Y 軸偏擺（弧度，three.js 慣例：前進方向 = (cos h, -sin h)） */
  heading: number
  /** 公尺／秒；停留時為 0 */
  speed: number
  action: ActorAction
  /** 目前所在（停留）或剛離開（行進）的站點索引 */
  waypoint: number
  /** 本週期已走距離（公尺）：行進中遞增、停留時不變；步態相位用 */
  distance: number
  /** 路線一圈總長（公尺）：讓步態一圈走整數步，週期邊界相位連續 */
  lap: number
  /** 目前動作已持續秒數：同一動作連續的區段合併計時（含跨週期首尾；全程同一動作時自 t = 0 起算） */
  elapsed: number
  /** 目前動作連續區段的總秒數（全程同一動作時為 Infinity） */
  duration: number
}

const MOVING: Record<Actor['type'], ActorAction> = { worker: 'walk', agv: 'move' }
const STOPPED: Record<Actor['type'], ActorAction> = { worker: 'work', agv: 'dock' }

const headingOf = (dx: number, dz: number) => Math.atan2(-dz, dx)

interface Segment {
  action: ActorAction
  t0: number
  t1: number
  /** 區段起點已走距離 */
  d0: number
  leg: number
  x: number
  z: number
  dx: number
  dz: number
  length: number
}

/** 路線的時間區段（停留與行進交錯，略過零長度停留） */
function segmentsOf(a: Actor): { segments: Segment[]; speed: number; totalLength: number } {
  const n = a.route.length
  const legs = a.route.map((p, i) => {
    const q = a.route[(i + 1) % n]!
    return { from: p, dx: q.x - p.x, dz: q.z - p.z, length: Math.hypot(q.x - p.x, q.z - p.z), dwell: p.dwell ?? 0 }
  })
  const totalLength = legs.reduce((s, l) => s + l.length, 0)
  const totalDwell = legs.reduce((s, l) => s + l.dwell, 0)
  const speed = totalLength / (a.cycleSeconds - totalDwell)
  const segments: Segment[] = []
  let t = 0
  let d = 0
  legs.forEach((l, i) => {
    const base = { leg: i, x: l.from.x, z: l.from.z, dx: l.dx, dz: l.dz, length: l.length }
    if (l.dwell > 0) {
      segments.push({ ...base, action: STOPPED[a.type], t0: t, t1: t + l.dwell, d0: d })
      t += l.dwell
    }
    const travel = l.length / speed
    if (travel > 0 || i === n - 1) {
      segments.push({ ...base, action: MOVING[a.type], t0: t, t1: t + travel, d0: d })
      t += travel
      d += l.length
    }
  })
  return { segments, speed, totalLength }
}

/** 包含第 k 段、同一動作連續的區段範圍 [t0, t1)（必要時跨週期首尾，t0 可為負） */
function runOf(segments: Segment[], k: number, cycle: number): { t0: number; t1: number } {
  const same = (i: number) => segments[i]!.action === segments[k]!.action
  let i = k
  while (i > 0 && same(i - 1)) i--
  let j = k
  while (j < segments.length - 1 && same(j + 1)) j++
  let t0 = segments[i]!.t0
  let t1 = segments[j]!.t1
  const whole = i === 0 && j === segments.length - 1
  if (whole) return { t0: -Infinity, t1: Infinity }
  if (i === 0 && same(segments.length - 1)) {
    let m = segments.length - 1
    while (m > 0 && same(m - 1)) m--
    t0 -= cycle - segments[m]!.t0
  }
  if (j === segments.length - 1 && same(0)) {
    let m = 0
    while (m < segments.length - 1 && same(m + 1)) m++
    t1 += segments[m]!.t1
  }
  return { t0, t1 }
}

/**
 * 時間 t 時移動體的姿態（純函數）。路線為封閉折線：
 * 在每個站點先停留 dwell 秒，再以等速走到下一站；一個週期走完一圈。
 */
export function actorPose(a: Actor, t: number): ActorPose {
  const { segments, speed, totalLength } = segmentsOf(a)
  const local = cyclePhase(t, a.cycleSeconds) * a.cycleSeconds
  let k = segments.findIndex((s) => local < s.t1)
  if (k < 0) k = segments.length - 1
  const seg = segments[k]!
  const run = runOf(segments, k, a.cycleSeconds)
  const moving = seg.action === MOVING[a.type]
  const u = moving && seg.t1 > seg.t0 ? Math.min(1, (local - seg.t0) / (seg.t1 - seg.t0)) : 0
  return {
    x: seg.x + seg.dx * u,
    z: seg.z + seg.dz * u,
    heading: headingOf(seg.dx, seg.dz),
    speed: moving ? speed : 0,
    action: seg.action,
    waypoint: seg.leg,
    distance: seg.d0 + seg.length * u,
    lap: totalLength,
    elapsed: run.t0 === -Infinity ? Math.max(0, t) : local - run.t0,
    duration: run.t1 - run.t0,
  }
}
