import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { catalog } from './catalog'
import { parseLayout } from './parseLayout'
import { CONVEYOR_BELT_TOP, PALLET_TOP, WORKPIECE_HEIGHT } from './specs'

const raw: unknown = JSON.parse(readFileSync(new URL('../../data/factory-layout.json', import.meta.url), 'utf8'))

describe('data/factory-layout.json（通用組裝產線）', () => {
  const r = parseLayout(raw, catalog)

  it('@S1 通過驗證並涵蓋展示所需的設備種類', () => {
    expect(r.ok ? [] : r.errors).toEqual([])
    if (!r.ok) return
    const kinds = r.placed.map((p) => p.kind)
    expect(kinds.filter((k) => k === 'conveyor').length).toBeGreaterThanOrEqual(2)
    expect(kinds.filter((k) => k === 'robot-arm').length).toBeGreaterThanOrEqual(2)
    expect(kinds).toContain('machine')
    expect(kinds).toContain('storage')
  })

  it('機械手臂都設定了取料點與放料點', () => {
    if (!r.ok) throw new Error('layout invalid')
    for (const arm of r.placed.filter((p) => p.kind === 'robot-arm')) {
      for (const k of ['pickDx', 'pickDz', 'pickY', 'placeDx', 'placeDz', 'placeY']) {
        expect(arm.equipment.params?.[k], `${arm.equipment.id}.${k}`).toBeTypeOf('number')
      }
    }
  })

  it('取放高度與設備規格一致：從輸送帶取料 = 皮帶頂面 + 料件高；放到棧板 = 棧板頂面 + 若干層料件', () => {
    if (!r.ok) throw new Error('layout invalid')
    const onBelt = CONVEYOR_BELT_TOP + WORKPIECE_HEIGHT
    const arms = r.placed.filter((p) => p.kind === 'robot-arm')
    expect(arms.length).toBeGreaterThan(0)
    for (const arm of arms) expect(Math.abs(arm.equipment.params!.pickY! - onBelt), `${arm.equipment.id}.pickY`).toBeLessThan(0.02)
    const ARM01 = arms.find((a) => a.equipment.id === 'ARM-01')!
    expect(Math.abs(ARM01.equipment.params!.placeY! - onBelt)).toBeLessThan(0.02)
    const ARM02 = arms.find((a) => a.equipment.id === 'ARM-02')!
    const layers = (ARM02.equipment.params!.placeY! - PALLET_TOP) / WORKPIECE_HEIGHT
    expect(layers).toBeGreaterThanOrEqual(1)
    expect(layers).toBeLessThanOrEqual(3)
  })

  it('@S10 配置含島嶼環境、至少 2 位人員與 1 台 AGV', () => {
    if (!r.ok) throw new Error('layout invalid')
    expect(r.site.environment, 'environment').toBeDefined()
    expect(r.site.environment?.island.radius).toBeGreaterThan(100)
    expect(r.actors.filter((a) => a.type === 'worker').length).toBeGreaterThanOrEqual(2)
    expect(r.actors.filter((a) => a.type === 'agv').length).toBeGreaterThanOrEqual(1)
  })
})
