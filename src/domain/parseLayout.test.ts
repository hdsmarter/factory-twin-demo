import { describe, expect, it } from 'vitest'
import { parseLayout } from './parseLayout'
import type { Catalog, Equipment, Site } from './layout'

const testCatalog: Catalog = {
  CONV: { kind: 'conveyor', label: 'conveyor' },
  ARM: { kind: 'robot-arm', label: 'arm' },
  CNC: { kind: 'machine', label: 'cnc', variant: 'cnc' },
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
