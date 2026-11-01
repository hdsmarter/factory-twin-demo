import type { EquipmentKind, PlacedEquipment, Site } from './layout'
import { conveyorItems, type ConveyorItem } from './motion/conveyor'
import { ARM_6AX_DIMENSIONS, robotArmPose, type RobotArmPose } from './motion/robotArm'
import { cyclePhase } from './motion/time'
import { DEFAULT_CONVEYOR_ITEMS } from './specs'

export type EquipmentState =
  | { kind: 'conveyor'; items: ConveyorItem[]; beltOffset: number }
  | { kind: 'robot-arm'; pose: RobotArmPose }
  | { kind: 'machine'; activity: number; spindle: number }
  | { kind: 'storage' }

/** 時間 t 時整座工廠的狀態。 */
export interface FrameState {
  /** 生產週期相位 [0, 1)；狀態只依相位而定，不含原始時間 */
  phase: number
  equipment: Record<string, EquipmentState>
}

type Motion<K extends EquipmentKind> = (pe: PlacedEquipment, site: Site, t: number) => Extract<EquipmentState, { kind: K }>

const num = (pe: PlacedEquipment, key: string, fallback: number) => pe.equipment.params?.[key] ?? fallback

/** 動作註冊表：每種設備一個純函數。新增設備種類 = 新增一筆（OCP）；型別保證每個 kind 都有實作。 */
export const motions: { [K in EquipmentKind]: Motion<K> } = {
  conveyor: (pe, site, t) => {
    const f = pe.equipment.footprint
    const params = { origin: { x: f.x, z: f.z }, rotation: f.rotation, length: f.width, itemCount: num(pe, 'itemCount', DEFAULT_CONVEYOR_ITEMS), cycleSeconds: site.cycleSeconds }
    return { kind: 'conveyor', items: conveyorItems(params, t), beltOffset: cyclePhase(t, site.cycleSeconds) * f.width }
  },
  'robot-arm': (pe, site, t) => {
    const f = pe.equipment.footprint
    const pose = robotArmPose(
      {
        ...ARM_6AX_DIMENSIONS,
        origin: { x: f.x, z: f.z },
        pick: { x: f.x + num(pe, 'pickDx', 1), y: num(pe, 'pickY', 1), z: f.z + num(pe, 'pickDz', 0) },
        place: { x: f.x + num(pe, 'placeDx', -1), y: num(pe, 'placeY', 1), z: f.z + num(pe, 'placeDz', 0) },
        cycleSeconds: site.cycleSeconds,
      },
      t,
    )
    return { kind: 'robot-arm', pose }
  },
  machine: (_pe, site, t) => {
    const phase = cyclePhase(t, site.cycleSeconds)
    // activity：0..1 的週期性脈動（指示燈、檢測光掃描）；spindle：主軸角度，每週期整數圈 → 週期連續
    return { kind: 'machine', activity: 0.5 - 0.5 * Math.cos(phase * 2 * Math.PI), spindle: phase * 2 * Math.PI * 8 }
  },
  storage: () => ({ kind: 'storage' }),
}

function stateOf<K extends EquipmentKind>(pe: PlacedEquipment & { kind: K }, site: Site, t: number): EquipmentState {
  return (motions[pe.kind] as Motion<K>)(pe, site, t)
}

/** 產線狀態是時間 t 的純函數：同一個 t 永遠得到同一個結果，且以生產週期循環。 */
export function simulate(site: Site, placed: PlacedEquipment[], t: number): FrameState {
  const equipment: Record<string, EquipmentState> = {}
  for (const pe of placed) equipment[pe.equipment.id] = stateOf(pe, site, t)
  return { phase: cyclePhase(t, site.cycleSeconds), equipment }
}
