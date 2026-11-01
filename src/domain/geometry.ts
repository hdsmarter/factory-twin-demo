import type { Footprint, PlacedEquipment } from './layout'

/** 區域外框相對設備外框的外擴距離（公尺）——3D 地面標線與 2D 平面圖共用的業務規則 */
export const AREA_MARGIN = 1.2

export interface Rect {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** 旋轉後在廠區平面上的實際寬（x）與深（z）。 */
export function footprintExtent(f: Footprint): { width: number; depth: number } {
  return f.rotation === 90 || f.rotation === 270 ? { width: f.depth, depth: f.width } : { width: f.width, depth: f.depth }
}

export function footprintRect(f: Footprint): Rect {
  const { width, depth } = footprintExtent(f)
  return { minX: f.x - width / 2, maxX: f.x + width / 2, minZ: f.z - depth / 2, maxZ: f.z + depth / 2 }
}

/** 每個區域的外框：區域內設備外框的聯集再外擴 margin。依區域首次出現的順序回傳。 */
export function areaBounds(placed: PlacedEquipment[], margin = AREA_MARGIN): (Rect & { area: string })[] {
  const byArea = new Map<string, Rect>()
  for (const p of placed) {
    const r = footprintRect(p.equipment.footprint)
    const b = byArea.get(p.path.area)
    byArea.set(
      p.path.area,
      b ? { minX: Math.min(b.minX, r.minX), maxX: Math.max(b.maxX, r.maxX), minZ: Math.min(b.minZ, r.minZ), maxZ: Math.max(b.maxZ, r.maxZ) } : r,
    )
  }
  return [...byArea.entries()].map(([area, b]) => ({
    area,
    minX: b.minX - margin,
    maxX: b.maxX + margin,
    minZ: b.minZ - margin,
    maxZ: b.maxZ + margin,
  }))
}
