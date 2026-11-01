import { useFrame } from '@react-three/fiber'
import { createContext, useContext, useRef, type MutableRefObject, type ReactNode } from 'react'
import type { PlacedEquipment, Site } from '../domain/layout'
import { simulate, type EquipmentState, type FrameState } from '../domain/simulate'
import { useSimClock } from './clock'
import { equipmentViews } from './equipment/registry'

const DEG = Math.PI / 180
/** 模擬要在所有設備的 useFrame 之前跑（R3F：數字越小越先執行；負數不接管渲染） */
const SIMULATION_PRIORITY = -1

/** 本幀的模擬時間與狀態（由 Factory 在所有其他 useFrame 之前更新） */
export interface FrameRef {
  t: number
  state: FrameState
}

const FrameStateContext = createContext<MutableRefObject<FrameRef> | null>(null)

/** 取得本幀時間與狀態的 ref；在 useFrame 內讀取 .current（不觸發 React 重繪）。 */
export function useFrameRef(): MutableRefObject<FrameRef> {
  const ref = useContext(FrameStateContext)
  if (!ref) throw new Error('useFrameRef 必須在 <Factory> 之內使用')
  return ref
}

/** 設備元件在自己的 useFrame 裡呼叫，取得本幀狀態（不觸發 React 重繪）。 */
export function useEquipmentState<K extends EquipmentState['kind']>(id: string, kind: K): () => Extract<EquipmentState, { kind: K }> | undefined {
  const ref = useContext(FrameStateContext)
  return () => {
    const s = ref?.current.state.equipment[id]
    return s && s.kind === kind ? (s as Extract<EquipmentState, { kind: K }>) : undefined
  }
}

/** 模擬驅動者：每幀算一次 simulate()，並把時間與狀態提供給設備與 children（人員、環境、效果）。 */
export function Factory({ site, placed, children }: { site: Site; placed: PlacedEquipment[]; children?: ReactNode }) {
  const clock = useSimClock()
  const t0 = clock.now(0)
  const frame = useRef<FrameRef>({ t: t0, state: simulate(site, placed, t0) })
  useFrame((state) => {
    const t = clock.now(state.clock.elapsedTime)
    frame.current = { t, state: simulate(site, placed, t) }
  }, SIMULATION_PRIORITY)

  return (
    <FrameStateContext.Provider value={frame}>
      {placed.map((pe) => {
        const View = equipmentViews[pe.kind]
        const f = pe.equipment.footprint
        return (
          <group key={pe.equipment.id} position={[f.x, 0, f.z]} rotation-y={f.rotation * DEG} userData={{ equipmentId: pe.equipment.id }}>
            <View placed={pe} />
          </group>
        )
      })}
      {children}
    </FrameStateContext.Provider>
  )
}
