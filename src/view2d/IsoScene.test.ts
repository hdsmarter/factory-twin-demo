import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { catalog } from '../domain/catalog'
import { parseLayout } from '../domain/parseLayout'
import { isoProject } from '../domain/projection'
import { simulate } from '../domain/simulate'
import { IsoScene } from './IsoScene'

const parsed = parseLayout(JSON.parse(readFileSync(new URL('../../data/factory-layout.json', import.meta.url), 'utf8')), catalog)
if (!parsed.ok) throw new Error('fixture layout invalid')
const { site, placed, actors } = parsed

function render(t: number): string {
  return renderToStaticMarkup(createElement(IsoScene, { site, placed, actors, state: simulate(site, placed, t), t, width: 1600, height: 900 }))
}

/** 每個帶 data-entity-id 的開標籤 → { id, u, v } */
function entities(svg: string): { id: string; u: number; v: number }[] {
  const tags = svg.match(/<[a-z]+\b[^>]*\bdata-entity-id="[^"]*"[^>]*>/g) ?? []
  return tags.map((tag) => {
    const attr = (name: string) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? ''
    return { id: attr('data-entity-id'), u: Number(attr('data-u')), v: Number(attr('data-v')) }
  })
}

const T = 3.7
const equipmentIds = placed.map((p) => p.equipment.id)
const actorIds = actors.map((a) => a.id)

describe('IsoScene', () => {
  it('@S9 根 svg 帶 data-view="iso2d"，實體集合 = 設備 ∪ 人員/AGV', () => {
    const svg = render(T)
    expect(svg).toMatch(/^<svg\b[^>]*\bdata-view="iso2d"/)
    expect(entities(svg).map((e) => e.id).sort()).toEqual([...equipmentIds, ...actorIds].sort())
  })

  it('@S8 每個實體恰好一個錨點，且等於 3D 位置的等角投影', () => {
    const state = simulate(site, placed, T)
    const found = entities(render(T))
    const expected = [
      ...placed.map((p) => ({ id: p.equipment.id, ...isoProject(p.equipment.footprint.x, 0, p.equipment.footprint.z) })),
      ...actorIds.map((id) => ({ id, ...isoProject(state.actors[id]!.x, 0, state.actors[id]!.z) })),
    ]
    for (const e of expected) {
      const hits = found.filter((f) => f.id === e.id)
      expect(hits, e.id).toHaveLength(1)
      expect(Math.abs(hits[0]!.u - e.u), `${e.id} u`).toBeLessThan(1e-6)
      expect(Math.abs(hits[0]!.v - e.v), `${e.id} v`).toBeLessThan(1e-6)
    }
  })

  it('對照組：換時間點，AGV 錨點會移動（不是常數）', () => {
    const at = (t: number) => entities(render(t)).find((e) => e.id === 'AGV-02') ?? { u: NaN, v: NaN }
    const a = at(T)
    const b = at(T + 10)
    expect(Math.hypot(a.u - b.u, a.v - b.v)).toBeGreaterThan(0.1)
  })

  it('決定性：同一個 t 輸出相同字串', () => {
    expect(render(T)).toBe(render(T))
  })
})
