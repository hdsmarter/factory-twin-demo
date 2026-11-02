import { ink, people, type WorkerLook } from '../palette'
import { BODY, fk, project, type FH, type Fwd, type Pose } from './gait'

/** 線寬（身高單位）：描邊 = 底層較粗的墨線，上層色線較細 → 圓頭膠囊狀肢段、關節自然圓滑 */
const W = { leg: 0.075, arm: 0.058, torso: 0.15, outline: 0.022, shoe: 0.05 } as const

type UV = { u: number; v: number }

function Limb({ pts, color, width }: { pts: UV[]; color: string; width: number }) {
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.u} ${p.v}`).join(' ')
  return (
    <>
      <path d={d} fill="none" stroke={ink} strokeWidth={width + W.outline * 2} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
    </>
  )
}

function Head({ at, tilt, back, look, sway }: { at: UV; tilt: number; back: number; look: WorkerLook; sway: number }) {
  const r = BODY.head / 2
  const line = { stroke: ink, strokeWidth: W.outline }
  // 在頭的本地座標畫（+x = 前方），整體依朝向翻轉、依點頭角度旋轉
  return (
    <g transform={`translate(${at.u} ${at.v}) scale(${-back} 1) rotate(${tilt})`}>
      {look.headwear === 'ponytail' && (
        <g transform={`translate(${-r * 0.9} ${-r * 0.15}) rotate(${40 + sway})`}>
          <ellipse cx={0} cy={r * 0.75} rx={r * 0.3} ry={r * 0.8} fill={look.hair} {...line} />
        </g>
      )}
      <circle cx={0} cy={0} r={r} fill={look.skin} {...line} />
      {/* 頭髮蓋住後腦與頭頂；臉朝前方 */}
      <path d={`M ${r * 0.35} ${-r * 0.94} A ${r} ${r} 0 0 0 ${-r * 0.5} ${r * 0.87} L ${-r * 0.4} ${r * 0.1} Q ${-r * 0.2} ${-r * 0.6} ${r * 0.35} ${-r * 0.94} Z`} fill={look.hair} {...line} />
      {look.headwear === 'bun' && <circle cx={-r * 0.55} cy={-r * 0.85} r={r * 0.38} fill={look.hair} {...line} />}
      {look.headwear === 'helmet' && (
        <>
          <path d={`M ${-r * 1.05} ${-r * 0.1} A ${r * 1.05} ${r * 1.05} 0 0 1 ${r * 1.05} ${-r * 0.1} Z`} fill={look.helmet} {...line} />
          <path d={`M ${-r * 0.9} ${-r * 0.1} L ${r * 1.45} ${-r * 0.1}`} stroke={ink} strokeWidth={W.outline * 1.6} strokeLinecap="round" />
        </>
      )}
      <circle cx={r * 0.5} cy={r * 0.05} r={r * 0.09} fill={ink} />
    </g>
  )
}

/**
 * 骨架人物：吃關節角度（pose）與畫面前進方向（fwd），以正向運動學算出矢狀面關節，再投影到畫面。
 * 繪製順序即遮擋：遠側手 → 遠側腿 → 軀幹 → 頭 → 近側腿 → 近側手。
 * 單位：身高 = 1，原點 = 腳下地面；外層負責平移與縮放。
 */
export function Rig({ pose, fwd, look, sway = 0 }: { pose: Pose; fwd: Fwd; look: WorkerLook; sway?: number }) {
  const j = fk(pose)
  const P = (p: FH) => project(p, fwd)
  // 往畫面左方走時，人物背面在右側
  const back = fwd.u >= 0 ? -1 : 1
  const hipTop: FH = { f: j.hip.f, h: j.hip.h + 0.04 }
  const leg = (knee: FH, ankle: FH, toe: FH, color: string) => (
    <>
      <Limb pts={[P(j.hip), P(knee), P(ankle)]} color={color} width={W.leg} />
      <Limb pts={[P(ankle), P(toe)]} color={people.shoe} width={W.shoe} />
    </>
  )
  const arm = (elbow: FH, hand: FH, sleeve: string, skin: string) => (
    <>
      <Limb pts={[P(j.shoulder), P(elbow)]} color={sleeve} width={W.arm} />
      <Limb pts={[P(elbow), P(hand)]} color={skin} width={W.arm * 0.9} />
    </>
  )
  return (
    <g data-part="rig">
      {arm(j.elbowF, j.handF, look.shirtFar, look.skinFar)}
      {leg(j.kneeF, j.ankleF, j.toeF, look.pantsFar)}
      <Limb pts={[P(hipTop), P(j.neck)]} color={look.shirt} width={W.torso} />
      <Head at={P(j.head)} tilt={j.headTilt * Math.sign(fwd.u || 1)} back={back} look={look} sway={sway} />
      {leg(j.kneeN, j.ankleN, j.toeN, look.pants)}
      {arm(j.elbowN, j.handN, look.shirt, look.skin)}
    </g>
  )
}
