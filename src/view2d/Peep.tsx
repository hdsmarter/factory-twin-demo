import { Smile } from 'react-peeps/lib/peeps/face/Smile.js'
import { Bun } from 'react-peeps/lib/peeps/hair/Bun.js'
import { Long } from 'react-peeps/lib/peeps/hair/Long.js'
import { ShortVolumed } from 'react-peeps/lib/peeps/hair/ShortVolumed.js'
import { CrossedArmsBW } from 'react-peeps/lib/peeps/pose/standing/CrossedArmsBW.js'
import { PointingFingerBW } from 'react-peeps/lib/peeps/pose/standing/PointingFingerBW.js'
import { RestingBW } from 'react-peeps/lib/peeps/pose/standing/RestingBW.js'
import { WalkingBW } from 'react-peeps/lib/peeps/pose/standing/WalkingBW.js'
import { WalkingFilled } from 'react-peeps/lib/peeps/pose/standing/WalkingFilled.js'
import { WalkingWB } from 'react-peeps/lib/peeps/pose/standing/WalkingWB.js'
import type { ActorPose } from '../domain/actors'
import { WORKER_HEIGHT } from '../domain/specs'
import { ink, people } from './palette'
import { ELLIPSE, uv, VERTICAL } from './shapes'

/**
 * Open Peeps（Pablo Stanley，CC0；react-peeps，MIT）站立人物。
 * 直接組合姿勢、髮型、表情片段（不用套件的 <Peep> 外框：它會用 Math.random 產生 id、且自帶 <svg>）。
 * 逐檔匯入用到的片段：套件主入口是 CJS、無法 tree-shake（全部約 2 MB）；且只用具名匯出（CJS default 在 Node ESM／SSR 下會拿到整個 module 物件）。
 * 素材座標：腳底中心約在 (440, 2910)，人物全高約 2850 單位；頭部位移同套件 Head 元件。
 */
const HEAD = { x: 225, y: 0 }
const FACE = { x: 159, y: 186 }
const FOOT = { x: 440, y: 2910 }
const ART_HEIGHT = 2850

/** 依人員序號決定外觀（決定性）；走路與工作各一組姿勢 */
const LOOKS = [
  { walk: WalkingBW, work: PointingFingerBW, hair: ShortVolumed },
  { walk: WalkingWB, work: CrossedArmsBW, hair: Long },
  { walk: WalkingFilled, work: RestingBW, hair: Bun },
]

/**
 * 腳底在 pose (x, 0, z) 的投影點（外層 data-part="worker" 的 translate 即錨點）；enlarge 只放大人物外觀（遠景看得見），不移動錨點。
 * 行進方向在畫面上朝左時水平鏡像。
 */
export function PeepFigure({ pose, look, enlarge }: { pose: ActorPose; look: number; enlarge: number }) {
  const p = uv(pose.x, 0, pose.z)
  const style = LOOKS[look % LOOKS.length]!
  const s = (WORKER_HEIGHT * VERTICAL * enlarge) / ART_HEIGHT
  const facingLeft = uv(Math.cos(pose.heading), 0, -Math.sin(pose.heading)).u < uv(0, 0, 0).u
  const Body = pose.action === 'work' ? style.work : style.walk
  const HairPiece = style.hair
  const shadowR = 0.35 * enlarge
  return (
    <g data-part="worker" transform={`translate(${p.u} ${p.v})`}>
      <ellipse cx={0} cy={0} rx={shadowR * ELLIPSE.rx} ry={shadowR * ELLIPSE.ry} fill={people.shadow} />
      <g transform={`scale(${facingLeft ? -s : s} ${s}) translate(${-FOOT.x} ${-FOOT.y})`}>
        <Body strokeColor={ink} backgroundColor={people.skin} />
        <g transform={`translate(${HEAD.x} ${HEAD.y})`}>
          <HairPiece strokeColor={ink} backgroundColor={people.skin} />
          <g transform={`translate(${FACE.x} ${FACE.y})`}>
            <Smile strokeColor={ink} backgroundColor={people.skin} />
          </g>
        </g>
      </g>
    </g>
  )
}
