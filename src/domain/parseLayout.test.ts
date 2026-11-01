import { describe, expect, it } from 'vitest'
import { parseLayout } from './parseLayout'
import type { Actor, Catalog, EnvironmentSpec, Equipment, Site } from './layout'

const testCatalog: Catalog = {
  CONV: { kind: 'conveyor', label: 'conveyor', params: ['itemCount'] },
  ARM: { kind: 'robot-arm', label: 'arm', params: ['pickDx', 'pickDz', 'pickY', 'placeDx', 'placeDz', 'placeY'] },
  CNC: { kind: 'machine', label: 'cnc', variant: 'cnc', params: [] },
}

const eq = (id: string, model: string, x = 0, z = 0, width = 2, depth = 1, rotation: 0 | 90 | 180 | 270 = 0): Equipment => ({
  id,
  name: id,
  model,
  footprint: { x, z, width, depth, rotation },
})

/** 20m × 10m 廠區：x ∈ [-10, 10]、z ∈ [-5, 5] */
const siteWith = (...equipment: Equipment[]): Site => ({
  id: 'SITE-1',
  name: '一廠',
  bounds: { width: 20, depth: 10, height: 8 },
  cycleSeconds: 6,
  areas: [
    {
      id: 'AREA-A',
      name: '組裝區',
      lines: [{ id: 'LINE-1', name: '一號線', cells: [{ id: 'CELL-1', name: '上料', equipment }] }],
    },
  ],
})

const codes = (raw: unknown) => {
  const r = parseLayout(raw, testCatalog)
  return r.ok ? [] : r.errors.map((e) => ({ code: e.code, equipmentId: e.equipmentId }))
}

describe('parseLayout', () => {
  it('@S1 合法配置 → 依 ISA-95 階層列出每台設備與所屬產線（多區域、多產線、多工作站）', () => {
    const site: Site = {
      ...siteWith(),
      areas: [
        {
          id: 'A1',
          name: 'a1',
          lines: [
            { id: 'L11', name: 'l11', cells: [{ id: 'C111', name: 'c', equipment: [eq('E1', 'CONV', -6, -3)] }, { id: 'C112', name: 'c', equipment: [eq('E2', 'ARM', -2, -3)] }] },
            { id: 'L12', name: 'l12', cells: [{ id: 'C121', name: 'c', equipment: [eq('E3', 'CNC', 2, -3)] }] },
          ],
        },
        { id: 'A2', name: 'a2', lines: [{ id: 'L21', name: 'l21', cells: [{ id: 'C211', name: 'c', equipment: [eq('E4', 'CONV', 0, 3), eq('E5', 'ARM', 5, 3)] }] }] },
      ],
    }
    const r = parseLayout(site, testCatalog)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.placed.map((p) => ({ id: p.equipment.id, kind: p.kind, path: p.path }))).toEqual([
      { id: 'E1', kind: 'conveyor', path: { site: 'SITE-1', area: 'A1', line: 'L11', cell: 'C111' } },
      { id: 'E2', kind: 'robot-arm', path: { site: 'SITE-1', area: 'A1', line: 'L11', cell: 'C112' } },
      { id: 'E3', kind: 'machine', path: { site: 'SITE-1', area: 'A1', line: 'L12', cell: 'C121' } },
      { id: 'E4', kind: 'conveyor', path: { site: 'SITE-1', area: 'A2', line: 'L21', cell: 'C211' } },
      { id: 'E5', kind: 'robot-arm', path: { site: 'SITE-1', area: 'A2', line: 'L21', cell: 'C211' } },
    ])
    expect(r.placed[2]!.variant).toBe('cnc')
  })

  it('@S2 重複設備編號 → 拒絕並指出編號', () => {
    expect(codes(siteWith(eq('DUP', 'CONV'), eq('DUP', 'ARM', 4, 0)))).toContainEqual({ code: 'DUPLICATE_ID', equipmentId: 'DUP' })
  })

  it('@S3 未知型號 → 拒絕並指出設備與型號', () => {
    const r = parseLayout(siteWith(eq('X1', 'NOPE')), testCatalog)
    expect(r.ok).toBe(false)
    if (r.ok) return
    const err = r.errors.find((e) => e.code === 'UNKNOWN_MODEL')
    expect(err?.equipmentId).toBe('X1')
    expect(err?.message).toContain('NOPE')
  })

  it('@S4 佔地正好貼齊廠區邊界 → 接受（含旋轉 90 度後寬深互換）', () => {
    const r = parseLayout(
      siteWith(
        eq('EDGE-X', 'CONV', 9, 0, 2, 1), // x ∈ [8, 10]
        eq('EDGE-Z', 'CONV', 0, 4.5, 1, 4, 90), // 旋轉後 width=4（x）、depth=1（z）→ z ∈ [4, 5] 貼齊
        eq('CORNER', 'ARM', -9.5, -4.5, 1, 1), // 貼齊左下角
      ),
      testCatalog,
    )
    expect(r).toMatchObject({ ok: true })
  })

  it('@S4 小數座標貼齊邊界（浮點誤差 9.8 + 0.3 > 10.1）→ 仍接受', () => {
    const site = { ...siteWith(eq('FLOAT', 'CONV', 9.8, 0, 0.6, 1)), bounds: { width: 20.2, depth: 10, height: 8 } }
    expect(9.8 + 0.6 / 2 > 20.2 / 2).toBe(true) // 前提：未容差時會被誤判超出
    expect(codes(site)).toEqual([])
  })

  it('@S5 佔地超出廠區邊界 → 拒絕並指出設備', () => {
    expect(codes(siteWith(eq('IN', 'CONV'), eq('OUT', 'CONV', 9.01, 0, 2, 1)))).toEqual([{ code: 'OUT_OF_BOUNDS', equipmentId: 'OUT' }])
  })

  it('@S5 旋轉 90 度後才超出 → 拒絕', () => {
    expect(codes(siteWith(eq('ROT', 'CONV', 0, 4, 4, 1, 90)))).toEqual([{ code: 'OUT_OF_BOUNDS', equipmentId: 'ROT' }]) // 旋轉後 z ∈ [2, 6]
  })

  it('@S5 負寬度不能繞過邊界檢查（中心點已在廠區外）→ 拒絕', () => {
    expect(codes(siteWith(eq('NEG', 'CONV', 11, 0, -4, 1)))).toContainEqual({ code: 'INVALID_SHAPE', equipmentId: 'NEG' })
  })

  describe('結構不合法 → INVALID_SHAPE，不丟例外', () => {
    it.each([
      ['null', null],
      ['數字', 42],
      ['缺 areas', { id: 'S' }],
      ['bounds 缺 height', { ...siteWith(), bounds: { width: 20, depth: 10 } }],
      ['bounds 為空物件', { ...siteWith(), bounds: {} }],
    ])('%s', (_label, raw) => {
      expect(codes(raw)).toContainEqual(expect.objectContaining({ code: 'INVALID_SHAPE' }))
    })

    it.each([
      ['寬度為 0', { ...eq('E', 'CONV'), footprint: { x: 0, z: 0, width: 0, depth: 1, rotation: 0 } }],
      ['座標為 NaN', { ...eq('E', 'CONV'), footprint: { x: Number.NaN, z: 0, width: 2, depth: 1, rotation: 0 } }],
      ['params 值為字串', { ...eq('E', 'ARM'), params: { pickDx: '1.2' } }],
      ['name 為空字串', { ...eq('E', 'CONV'), name: '' }],
    ])('設備%s → 指出該設備', (_label, bad) => {
      expect(codes(siteWith(bad as unknown as Equipment))).toContainEqual({ code: 'INVALID_SHAPE', equipmentId: 'E' })
    })

    it('設備編號為空字串 → INVALID_SHAPE', () => {
      expect(codes(siteWith({ ...eq('X', 'CONV'), id: '' }))).toContainEqual(expect.objectContaining({ code: 'INVALID_SHAPE' }))
    })
  })
})

describe('第二輪規則：可達範圍、參數名稱、移動體路線、島嶼', () => {
  const arm = (id: string, params: Record<string, number>): Equipment => ({ ...eq(id, 'ARM', 0, 0, 1, 1), params })
  const okArm = { pickDx: -1.2, pickDz: 1.15, pickY: 1, placeDx: 1.2, placeDz: 1.15, placeY: 1 }
  const actor = (over: Partial<Actor> = {}): Actor => ({ id: 'W1', name: 'w', type: 'worker', cycleSeconds: 20, route: [{ x: -5, z: -2, dwell: 2 }, { x: 5, z: -2 }, { x: 5, z: 3 }], ...over })
  const env = (over: Partial<EnvironmentSpec['island']> = {}, rest: Partial<EnvironmentSpec> = {}): EnvironmentSpec => ({
    island: { radius: 140, plateauRadius: 40, beachWidth: 18, seed: 7, ...over },
    dayCycleSeconds: 120,
    waveSeconds: 6,
    ...rest,
  })

  it('對照組：合法的手臂、人員與島嶼 → 接受並回傳 actors', () => {
    const r = parseLayout({ ...siteWith(arm('ARM-OK', okArm)), actors: [actor()], environment: env() }, testCatalog)
    expect(r.ok ? [] : r.errors).toEqual([])
    expect(r.ok && r.actors.map((a) => a.id)).toEqual(['W1'])
  })

  it('@S3 取料點離底座太遠 → UNREACHABLE 並指出手臂與點位', () => {
    const r = parseLayout(siteWith(arm('ARM-FAR', { ...okArm, pickDx: -3.5 })), testCatalog)
    expect(r.ok).toBe(false)
    if (r.ok) return
    const e = r.errors.find((x) => x.code === 'UNREACHABLE')
    expect(e?.equipmentId).toBe('ARM-FAR')
    expect(e?.message).toMatch(/取料點超出/)
  })

  it('@S3 取料點貼近底座（關節需超出限制）→ UNREACHABLE', () => {
    expect(codes(siteWith(arm('ARM-NEAR', { ...okArm, pickDx: 0.05, pickDz: 0, pickY: 0.6 })))).toContainEqual({ code: 'UNREACHABLE', equipmentId: 'ARM-NEAR' })
  })

  it('@S4 參數名稱拼錯 → UNKNOWN_PARAM 並指出設備與參數名', () => {
    const { pickDx: _omit, ...rest } = okArm
    const r = parseLayout(siteWith(arm('ARM-TYPO', { ...rest, pickdx: -1.2 })), testCatalog)
    expect(r.ok).toBe(false)
    if (r.ok) return
    const e = r.errors.find((x) => x.code === 'UNKNOWN_PARAM')
    expect(e?.equipmentId).toBe('ARM-TYPO')
    expect(e?.message).toContain('pickdx')
  })

  it('@S5 AGV 路線有點位在廠區外 → OUT_OF_BOUNDS 並指出 AGV', () => {
    const agv = actor({ id: 'AGV-9', type: 'agv', route: [{ x: 0, z: 0 }, { x: 12, z: 0 }] })
    expect(codes({ ...siteWith(), actors: [agv] })).toEqual([{ code: 'OUT_OF_BOUNDS', equipmentId: 'AGV-9' }])
  })

  it('移動體與設備編號重複 → DUPLICATE_ID', () => {
    expect(codes({ ...siteWith(eq('X1', 'CONV')), actors: [actor({ id: 'X1' })] })).toContainEqual({ code: 'DUPLICATE_ID', equipmentId: 'X1' })
  })

  it.each([
    ['停留時間總和不小於週期', actor({ cycleSeconds: 2 })],
    ['路線少於 2 點', actor({ route: [{ x: 0, z: 0 }] })],
    ['類型不明', { ...actor(), type: 'drone' }],
  ])('移動體%s → INVALID_SHAPE', (_l, a) => {
    expect(codes({ ...siteWith(), actors: [a] })).toContainEqual({ code: 'INVALID_SHAPE', equipmentId: 'W1' })
  })

  it('@S6 島嶼平台小於廠區 → OFF_ISLAND', () => {
    expect(codes({ ...siteWith(), environment: env({ plateauRadius: 10 }) })).toContainEqual(expect.objectContaining({ code: 'OFF_ISLAND' }))
  })

  it.each([
    ['日週期不是海浪週期的整數倍', env({}, { waveSeconds: 7 })],
    ['平台大於陸地', env({ plateauRadius: 130 })],
  ])('環境設定%s → INVALID_SHAPE', (_l, e) => {
    expect(codes({ ...siteWith(), environment: e })).toContainEqual(expect.objectContaining({ code: 'INVALID_SHAPE' }))
  })

  it('actors 不是陣列 → INVALID_SHAPE（不得通過驗證後在執行時崩潰）', () => {
    for (const bad of [{}, 'x', 5]) expect(codes({ ...siteWith(), actors: bad })).toContainEqual(expect.objectContaining({ code: 'INVALID_SHAPE' }))
  })

  it('路線總長為 0 → INVALID_SHAPE', () => {
    expect(codes({ ...siteWith(), actors: [actor({ route: [{ x: 1, z: 1 }, { x: 1, z: 1 }] })] })).toContainEqual({ code: 'INVALID_SHAPE', equipmentId: 'W1' })
  })

  it('@S6 平台大於「海岸起伏後的最小陸地」→ INVALID_SHAPE（名目半徑看似足夠）', () => {
    expect(codes({ ...siteWith(), environment: env({ radius: 200, beachWidth: 5, plateauRadius: 180 }) })).toContainEqual(expect.objectContaining({ code: 'INVALID_SHAPE' }))
  })
})
