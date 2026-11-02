import { actorPose, type ActorPose } from '../domain/actors'
import type { Actor } from '../domain/layout'
import { isoProject } from '../domain/projection'
import { WORKER_HEIGHT } from '../domain/specs'
import { people, workerLooks } from './palette'
import { workerPose, type Fwd } from './rig/gait'
import { Rig } from './rig/Rig'
import { ELLIPSE, uv, VERTICAL } from './shapes'

/** 馬尾擺動週期（秒）與幅度（度）：次要動作，走路時較大 */
const SWAY = { period: 1.1, idle: 3, walk: 9 } as const
/** 各人員的時間偏移，避免動作齊步 */
const LOOK_OFFSET_S = 0.37

/** 前進 1 個身高在畫面上的位移（以身高為單位，與放大倍率無關） */
function forwardOnScreen(heading: number): Fwd {
  const a = isoProject(0, 0, 0)
  const b = isoProject(Math.cos(heading), 0, -Math.sin(heading))
  return { u: (b.u - a.u) / VERTICAL, v: (b.v - a.v) / VERTICAL }
}

/** 轉身：在轉角前後各 TURN_S 秒內連續轉完 */
const TURN_S = 0.4

const smoothstep = (x: number) => {
  const c = Math.min(1, Math.max(0, x))
  return c * c * (3 - 2 * c)
}

/**
 * 人員在時間 t 的畫面前進方向。domain 的轉向是瞬間的；2D 在轉角前後 TURN_S 秒內以 smoothstep 連續轉身
 * （否則著地腳會在一格內瞬移約 1/4 身高）。轉角時刻以二分法求得，所以轉身與影格率無關、逐格連續。
 * 假設 2·TURN_S 內至多一個轉角。
 */
export function forwardAt(actor: Actor, t: number): Fwd {
  const hA = actorPose(actor, t - TURN_S).heading
  const hB = actorPose(actor, t + TURN_S).heading
  if (hA === hB) return forwardOnScreen(hA)
  let lo = t - TURN_S
  let hi = t + TURN_S
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (actorPose(actor, mid).heading === hA) lo = mid
    else hi = mid
  }
  const w = smoothstep((t - hi + TURN_S) / (2 * TURN_S))
  const delta = Math.atan2(Math.sin(hB - hA), Math.cos(hB - hA))
  return forwardOnScreen(hA + w * delta)
}

/**
 * 有關節的人員：腳底在 pose (x, 0, z) 的投影點（外層 data-part="worker" 的 translate 即錨點）。
 * enlarge 只放大外觀；步幅也一併放大，讓放大的人物在世界速度下仍然腳不打滑。
 * ambient = false（使用者偏好減少動態）時停用呼吸與擺髮。
 */
export function WorkerFigure({ actor, pose, look, enlarge, t, ambient = true }: { actor: Actor; pose: ActorPose; look: number; enlarge: number; t: number; ambient?: boolean }) {
  const p = uv(pose.x, 0, pose.z)
  const heightM = WORKER_HEIGHT * enlarge
  const s = heightM * VERTICAL
  // 減少動態效果時停用呼吸、擺髮等裝飾性次要動作（行走與工作屬內容，保留）
  const local = ambient ? t + look * LOOK_OFFSET_S : 0
  const body = workerPose(pose, local, heightM)
  const walking = pose.action === 'walk'
  const sway = (walking ? SWAY.walk : SWAY.idle) * Math.sin((2 * Math.PI * local) / SWAY.period)
  const shadowR = 0.35 * enlarge
  return (
    <g data-part="worker" transform={`translate(${p.u} ${p.v})`}>
      <ellipse cx={0} cy={0} rx={shadowR * ELLIPSE.rx} ry={shadowR * ELLIPSE.ry} fill={people.shadow} />
      <g transform={`scale(${s})`}>
        <Rig pose={body} fwd={forwardAt(actor, t)} look={workerLooks[look % workerLooks.length]!} sway={sway} />
      </g>
    </g>
  )
}
