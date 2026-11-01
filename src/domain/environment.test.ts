import { describe, expect, it } from 'vitest'
import { forestPlacement, isLand, islandHeight, PLATEAU_HEIGHT, sunAt, wavePhase } from './environment'
import type { EnvironmentSpec } from './layout'

const env: EnvironmentSpec = { island: { radius: 140, plateauRadius: 40, beachWidth: 18, seed: 7 }, dayCycleSeconds: 120, waveSeconds: 6 }
const site = { minX: -18, maxX: 18, minZ: -10, maxZ: 10 }

describe('sunAt / wavePhase', () => {
  it('@S7 同一時間點與相隔一個日週期：太陽位置與海浪相位相同', () => {
    for (const t of [0, 3.3, 59.9, 117]) {
      const a = sunAt(env, t)
      const b = sunAt(env, t + env.dayCycleSeconds)
      for (const k of ['azimuth', 'elevation'] as const) expect(Math.abs(a[k] - b[k])).toBeLessThan(1e-9)
      expect(Math.abs(wavePhase(env, t) - wavePhase(env, t + env.dayCycleSeconds))).toBeLessThan(1e-9)
    }
  })
  it('@S7 太陽始終在地平線之上，方向為單位向量', () => {
    for (let i = 0; i <= 240; i++) {
      const s = sunAt(env, (i / 240) * env.dayCycleSeconds)
      expect(s.elevation).toBeGreaterThan(0)
      expect(s.direction.y).toBeGreaterThan(0)
      expect(Math.hypot(s.direction.x, s.direction.y, s.direction.z)).toBeCloseTo(1, 9)
    }
  })
  it('對照組：太陽與海浪確實隨時間改變', () => {
    expect(sunAt(env, 10).azimuth).not.toBeCloseTo(sunAt(env, 40).azimuth, 3)
    expect(wavePhase(env, 1)).not.toBeCloseTo(wavePhase(env, 2), 3)
  })
})

describe('islandHeight / isLand', () => {
  it('平台區域平坦（廠房地基）', () => {
    for (const [x, z] of [[0, 0], [18, 10], [-25, 20], [0, -39]]) expect(islandHeight(env.island, x!, z!)).toBe(PLATEAU_HEIGHT)
  })
  it('陸地在海岸內、海在島外；同一種子結果固定、不同種子海岸線不同', () => {
    expect(isLand(env.island, 0, 0)).toBe(true)
    expect(isLand(env.island, 100, 0)).toBe(true)
    expect(isLand(env.island, 200, 0)).toBe(false)
    expect(islandHeight(env.island, 200, 30)).toBeLessThan(0)
    expect(islandHeight(env.island, 120, 40)).toBe(islandHeight(env.island, 120, 40))
    const other = { ...env.island, seed: 99 }
    const diff = [0, 1, 2, 3, 4, 5].some((k) => Math.abs(islandHeight(env.island, 125 * Math.cos(k), 125 * Math.sin(k)) - islandHeight(other, 125 * Math.cos(k), 125 * Math.sin(k))) > 1e-3)
    expect(diff).toBe(true)
  })
})

describe('forestPlacement', () => {
  const trees = forestPlacement(env.island, site, 80)
  it('產生指定數量、全部在陸地上且避開平台與廠區', () => {
    expect(trees).toHaveLength(80)
    for (const t of trees) {
      expect(isLand(env.island, t.x, t.z)).toBe(true)
      expect(Math.hypot(t.x, t.z)).toBeGreaterThan(env.island.plateauRadius)
      expect(t.x < site.minX - 3 || t.x > site.maxX + 3 || t.z < site.minZ - 3 || t.z > site.maxZ + 3).toBe(true)
      expect(t.y).toBeCloseTo(islandHeight(env.island, t.x, t.z), 9)
      expect([0, 1, 2]).toContain(t.variant)
    }
  })
  it('樹與樹至少相隔 3 m，且結果可重現', () => {
    for (let i = 0; i < trees.length; i++)
      for (let j = i + 1; j < trees.length; j++) expect(Math.hypot(trees[i]!.x - trees[j]!.x, trees[i]!.z - trees[j]!.z)).toBeGreaterThanOrEqual(3)
    expect(forestPlacement(env.island, site, 80)).toEqual(trees)
  })
})
