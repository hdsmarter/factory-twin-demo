import { useFrame } from '@react-three/fiber'
import { createContext, useContext, useRef, type MutableRefObject } from 'react'
import type { PlacedEquipment, Site } from '../domain/layout'
import { simulate, type EquipmentState, type FrameState } from '../domain/simulate'
import { useSimClock } from './clock'
import { equipmentViews } from './equipment/registry'

const DEG = Math.PI / 180
/** 模擬要在所有設備的 useFrame 之前跑（R3F：數字越小越先執行；負數不接管渲染） */
const SIMULATION_PRIORITY = -1

const FrameStateContext = createContext<MutableRefObject<FrameState | null> | null>(null)

/** 設備元件在自己的 useFrame 裡呼叫，取得本幀狀態（不觸發 React 重繪）。 */
export function useEquipmentState<K extends EquipmentState['kind']>(id: string, kind: K): () => Extract<EquipmentState, { kind: K }> | undefined {
  const ref = useContext(FrameStateContext)
  return () => {
    const s = ref?.current?.equipment[id]
    return s && s.kind === kind ? (s as Extract<EquipmentState, { kind: K }>) : undefined
  }
}

export function Factory({ site, placed }: { site: Site; placed: PlacedEquipment[] }) {
  const clock = useSimClock()
  const frame = useRef<FrameState | null>(simulate(site, placed, clock.now(0)))
  useFrame((state) => {
    frame.current = simulate(site, placed, clock.now(state.clock.elapsedTime))
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
    </FrameStateContext.Provider>
  )
}
