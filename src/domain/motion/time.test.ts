import { describe, expect, it } from 'vitest'
import { cyclePhase } from './time'

describe('cyclePhase', () => {
  it('負的週期倍數回傳 +0（不是 -0），與 t=0 完全相同', () => {
    expect(Object.is(cyclePhase(-6, 6), 0)).toBe(true)
    expect(Object.is(cyclePhase(-12, 6), 0)).toBe(true)
  })
  it('值域永遠在 [0, 1)', () => {
    for (const t of [0, 5.999999999999, 6, 6 - 1e-12, -1e-12, 1e9 + 0.3, -1e9 - 0.3]) {
      const p = cyclePhase(t, 6)
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThan(1)
    }
  })
})
