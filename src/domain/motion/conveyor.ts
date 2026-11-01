import { cyclePhase, directionOf } from './time'

export interface ConveyorParams {
  /** 輸送帶中心點（世界座標） */
  origin: { x: number; z: number }
  /** Y 軸旋轉角度（度）；料件沿本地 +x 前進 */
  rotation: number
  length: number
  itemCount: number
  /** 每個料件走完全長所需秒數 = 生產週期 */
  cycleSeconds: number
}

export interface ConveyorItem {
  index: number
  /** 自輸送帶起點起算的行進距離，值域 [0, length) */
  s: number
  x: number
  z: number
}

/** 時間 t 時輸送帶上每個料件的位置（純函數）。料件等距分布、等速前進，一個週期走完一趟。 */
export function conveyorItems(p: ConveyorParams, t: number): ConveyorItem[] {
  const dir = directionOf(p.rotation)
  const phase = cyclePhase(t, p.cycleSeconds)
  return Array.from({ length: p.itemCount }, (_, index) => {
    const s = ((index / p.itemCount + phase) % 1) * p.length
    const local = s - p.length / 2
    return { index, s, x: p.origin.x + dir.x * local, z: p.origin.z + dir.z * local }
  })
}
