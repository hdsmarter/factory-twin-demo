import { describe, expect, it } from 'vitest'
import { AREA_MARGIN, areaBounds, footprintExtent, footprintRect } from './geometry'
import type { Equipment, PlacedEquipment } from './layout'

const pe = (id: string, area: string, x: number, z: number, width: number, depth: number, rotation: 0 | 90 | 180 | 270 = 0): PlacedEquipment => ({
  equipment: { id, name: id, model: 'M', footprint: { x, z, width, depth, rotation } } as Equipment,
  kind: 'conveyor',
  path: { site: 'S', area, line: 'L', cell: 'C' },
})

describe('geometry', () => {
  it('旋轉 90/270 度時寬深互換，0/180 不變', () => {
    expect(footprintExtent({ x: 0, z: 0, width: 4, depth: 1, rotation: 90 })).toEqual({ width: 1, depth: 4 })
    expect(footprintExtent({ x: 0, z: 0, width: 4, depth: 1, rotation: 270 })).toEqual({ width: 1, depth: 4 })
    expect(footprintExtent({ x: 0, z: 0, width: 4, depth: 1, rotation: 180 })).toEqual({ width: 4, depth: 1 })
  })

  it('footprintRect 回傳旋轉後的平面外框', () => {
    expect(footprintRect({ x: 2, z: -1, width: 4, depth: 1, rotation: 90 })).toEqual({ minX: 1.5, maxX: 2.5, minZ: -3, maxZ: 1 })
  })

  it('areaBounds：每個區域一個外框 = 區域內設備外框聯集 + 邊距（3D 與 2D 共用）', () => {
    const r = areaBounds([pe('a', 'A1', 0, 0, 2, 2), pe('b', 'A1', 5, 1, 2, 2, 90), pe('c', 'A2', -10, -5, 1, 1)])
    expect(r).toEqual([
      { area: 'A1', minX: -1 - AREA_MARGIN, maxX: 6 + AREA_MARGIN, minZ: -1 - AREA_MARGIN, maxZ: 2 + AREA_MARGIN },
      { area: 'A2', minX: -10.5 - AREA_MARGIN, maxX: -9.5 + AREA_MARGIN, minZ: -5.5 - AREA_MARGIN, maxZ: -4.5 + AREA_MARGIN },
    ])
  })
})
