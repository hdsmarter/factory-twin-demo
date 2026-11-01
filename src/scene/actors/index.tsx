import type { ComponentType } from 'react'
import type { Actor, ActorType } from '../../domain/layout'
import { Agv } from './Agv'
import { Worker } from './Worker'

export interface ActorViewProps {
  actor: Actor
  /** 同類型中的序號（例如輪替工作服顏色） */
  index: number
}

/** 移動體渲染器註冊表（OCP）：型別保證每種 ActorType 都有畫法。各元件自行依本幀姿態移動。 */
export const actorViews: { [K in ActorType]: ComponentType<ActorViewProps> } = {
  worker: Worker,
  agv: Agv,
}

/** 所有人員與 AGV；必須放在 <Factory> 的 children 內（需要 useFrameRef）。 */
export function Actors({ actors }: { actors: Actor[] }) {
  return (
    <>
      {actors.map((a) => {
        const View = actorViews[a.type]
        const index = actors.filter((x) => x.type === a.type).indexOf(a)
        return (
          <group key={a.id} userData={{ actorId: a.id }}>
            <View actor={a} index={index} />
          </group>
        )
      })}
    </>
  )
}
