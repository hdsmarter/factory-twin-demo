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
}

const MOVING: Record<Actor['type'], ActorAction> = { worker: 'walk', agv: 'move' }
const STOPPED: Record<Actor['type'], ActorAction> = { worker: 'work', agv: 'dock' }

const headingOf = (dx: number, dz: number) => Math.atan2(-dz, dx)

/**
 * 時間 t 時移動體的姿態（純函數）。路線為封閉折線：
 * 在每個站點先停留 dwell 秒，再以等速走到下一站；一個週期走完一圈。
 */
export function actorPose(a: Actor, t: number): ActorPose {
  const n = a.route.length
  const legs = a.route.map((p, i) => {
    const q = a.route[(i + 1) % n]!
    return { from: p, dx: q.x - p.x, dz: q.z - p.z, length: Math.hypot(q.x - p.x, q.z - p.z), dwell: p.dwell ?? 0 }
  })
  const totalLength = legs.reduce((s, l) => s + l.length, 0)
  const totalDwell = legs.reduce((s, l) => s + l.dwell, 0)
  const speed = totalLength / (a.cycleSeconds - totalDwell)

  let remaining = cyclePhase(t, a.cycleSeconds) * a.cycleSeconds
  for (let i = 0; i < n; i++) {
    const leg = legs[i]!
    const heading = headingOf(leg.dx, leg.dz)
    if (remaining < leg.dwell) {
      return { x: leg.from.x, z: leg.from.z, heading, speed: 0, action: STOPPED[a.type], waypoint: i }
    }
    remaining -= leg.dwell
    const travel = leg.length / speed
    if (remaining < travel || i === n - 1) {
      const u = Math.min(1, remaining / travel)
      return { x: leg.from.x + leg.dx * u, z: leg.from.z + leg.dz * u, heading, speed, action: MOVING[a.type], waypoint: i }
    }
    remaining -= travel
  }
  /* c8 ignore next — 迴圈必定在最後一段返回 */
  throw new Error('unreachable')
}
