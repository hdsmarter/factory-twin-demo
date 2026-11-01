import { describe, expect, it } from 'vitest'
import { conveyorItems, type ConveyorParams } from './conveyor'

const base: ConveyorParams = { origin: { x: 2, z: -1 }, rotation: 0, length: 6, itemCount: 4, cycleSeconds: 6 }
const SAMPLES = 240

describe.each([0, 90, 180, 270] as const)('conveyorItems（旋轉 %i 度）', (rotation) => {
  const p: ConveyorParams = { ...base, rotation }
  const r = (rotation * Math.PI) / 180
  const dir = { x: Math.cos(r), z: -Math.sin(r) }
  const along = (pt: { x: number; z: number }) => (pt.x - p.origin.x) * dir.x + (pt.z - p.origin.z) * dir.z
  const lateral = (pt: { x: number; z: number }) => (pt.x - p.origin.x) * -dir.z + (pt.z - p.origin.z) * dir.x

  it('@S7 料件數量固定且始終停留在輸送帶上', () => {
    for (let i = 0; i <= SAMPLES; i++) {
      const items = conveyorItems(p, (i / SAMPLES) * p.cycleSeconds)
      expect(items).toHaveLength(p.itemCount)
      for (const it of items) {
        expect(Math.abs(lateral(it))).toBeLessThan(1e-9)
        expect(Math.abs(along(it))).toBeLessThanOrEqual(p.length / 2 + 1e-9)
        expect(it.s).toBeGreaterThanOrEqual(0)
        expect(it.s).toBeLessThan(p.length)
      }
    }
  })

  it('@S7 每個料件只沿輸送帶方向前進（到終點後從起點重新進入）', () => {
    let prev = conveyorItems(p, 0)
    let wraps = 0
    for (let i = 1; i <= SAMPLES; i++) {
      const cur = conveyorItems(p, (i / SAMPLES) * p.cycleSeconds)
      cur.forEach((it, k) => {
        const before = prev[k]!
        expect(it.index).toBe(before.index)
        const ds = along(it) - along(before)
        if (ds < 0) {
          wraps++
          expect(ds).toBeCloseTo(-p.length + p.length / SAMPLES, 6) // 從終點回到起點
        } else {
          expect(ds).toBeCloseTo(p.length / SAMPLES, 9) // 等速前進
        }
      })
      prev = cur
    }
    expect(wraps).toBe(p.itemCount) // 一個週期每個料件剛好走完一趟
  })
})

describe('conveyorItems 邊界', () => {
  it('料件在週期起點等距分布', () => {
    expect(conveyorItems(base, 0).map((i) => i.s)).toEqual([0, 1.5, 3, 4.5])
  })
  it('負時間與正時間一樣有定義（循環）', () => {
    expect(conveyorItems(base, -1.5)).toEqual(conveyorItems(base, 4.5))
  })
})
