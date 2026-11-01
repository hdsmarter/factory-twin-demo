import type { ComponentType } from 'react'
import type { EquipmentKind, PlacedEquipment } from '../../domain/layout'
import { Conveyor } from './Conveyor'
import { Machine } from './Machine'
import { RobotArm } from './RobotArm'
import { Storage } from './Storage'

export interface EquipmentViewProps {
  placed: PlacedEquipment
}

/** 渲染器註冊表：每種設備一個元件（OCP）；型別保證每個 kind 都有對應畫法。設備在本地座標繪製，原點 = 佔地中心。 */
export const equipmentViews: { [K in EquipmentKind]: ComponentType<EquipmentViewProps> } = {
  conveyor: Conveyor,
  'robot-arm': RobotArm,
  machine: Machine,
  storage: Storage,
}
