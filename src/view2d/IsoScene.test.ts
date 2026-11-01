import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { catalog } from '../domain/catalog'
import { parseLayout } from '../domain/parseLayout'
import { directionOf } from '../domain/motion/time'
import { isoProject } from '../domain/projection'
import { simulate } from '../domain/simulate'
import { CONVEYOR_BELT_TOP } from '../domain/specs'
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

/**
 * 實際繪製的圖元錨點：實體 id 範圍內（自其開標籤到下一個實體開標籤）每個帶 data-part 的元素，
 * 讀它的 transform="translate(u v)"——這是圖元真正被畫上去的位置，而非另算的標記。
 */
function parts(svg: string, id: string, part: string): { u: number; v: number }[] {
  const starts = [...svg.matchAll(/<[a-z]+\b[^>]*\bdata-entity-id="([^"]*)"[^>]*>/g)]
  const k = starts.findIndex((m) => m[1] === id)
  if (k < 0) return []
  const scope = svg.slice(starts[k]!.index, starts[k + 1]?.index ?? svg.length)
  const tags = scope.match(new RegExp(`<[a-z]+\\b[^>]*\\bdata-part="${part}"[^>]*>`, 'g')) ?? []
  return tags.map((tag) => {
    const m = tag.match(/\btransform="translate\(([^ )]+) ([^ )]+)\)"/)
    return { u: m ? Number(m[1]) : NaN, v: m ? Number(m[2]) : NaN }
  })
}

const near = (got: { u: number; v: number }, want: { u: number; v: number }, label: string) => {
  expect(Math.abs(got.u - want.u), `${label} u`).toBeLessThan(1e-6)
  expect(Math.abs(got.v - want.v), `${label} v`).toBeLessThan(1e-6)
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

  describe('@S8 實際繪製的圖元落在 domain 位置的投影上', () => {
    const times = [T, T + 10, 17.3]
    const workers = actors.filter((a) => a.type === 'worker')
    const agvs = actors.filter((a) => a.type === 'agv')
    const arms = placed.filter((p) => p.kind === 'robot-arm')
    const conveyors = placed.filter((p) => p.kind === 'conveyor')

    it('fixture 涵蓋人員、AGV、手臂、輸送帶', () => {
      expect([workers.length, agvs.length, arms.length, conveyors.length].every((n) => n > 0)).toBe(true)
    })

    it.each(times)('人員腳底 = isoProject(pose.x, 0, pose.z)（t=%s）', (t) => {
      const state = simulate(site, placed, t)
      const svg = render(t)
      for (const a of workers) {
        const hits = parts(svg, a.id, 'worker')
        expect(hits, a.id).toHaveLength(1)
        const p = state.actors[a.id]!
        near(hits[0]!, isoProject(p.x, 0, p.z), a.id)
      }
    })

    it.each(times)('AGV 底面中心 = isoProject(pose.x, 0, pose.z)（t=%s）', (t) => {
      const state = simulate(site, placed, t)
      const svg = render(t)
      for (const a of agvs) {
        const hits = parts(svg, a.id, 'agv')
        expect(hits, a.id).toHaveLength(1)
        const p = state.actors[a.id]!
        near(hits[0]!, isoProject(p.x, 0, p.z), a.id)
      }
    })

    it.each(times)('手臂夾爪 = isoProject(pose.tool)（t=%s）', (t) => {
      const state = simulate(site, placed, t)
      const svg = render(t)
      for (const pe of arms) {
        const s = state.equipment[pe.equipment.id]
        if (s?.kind !== 'robot-arm') throw new Error(`${pe.equipment.id} 不是手臂狀態`)
        const hits = parts(svg, pe.equipment.id, 'gripper')
        expect(hits, pe.equipment.id).toHaveLength(1)
        near(hits[0]!, isoProject(s.pose.tool.x, s.pose.tool.y, s.pose.tool.z), pe.equipment.id)
      }
    })

    it.each(times)('輸送帶料件 = isoProject(由 s 依旋轉換算的世界座標, BELT_TOP)（t=%s）', (t) => {
      const state = simulate(site, placed, t)
      const svg = render(t)
      const byUV = (a: { u: number; v: number }, b: { u: number; v: number }) => a.u - b.u || a.v - b.v
      for (const pe of conveyors) {
        const s = state.equipment[pe.equipment.id]
        if (s?.kind !== 'conveyor') throw new Error(`${pe.equipment.id} 不是輸送帶狀態`)
        const f = pe.equipment.footprint
        const dir = directionOf(f.rotation)
        const want = s.items
          .map((it) => isoProject(f.x + dir.x * (it.s - f.width / 2), CONVEYOR_BELT_TOP, f.z + dir.z * (it.s - f.width / 2)))
          .sort(byUV)
        const got = parts(svg, pe.equipment.id, 'conveyor-item').sort(byUV)
        expect(got, pe.equipment.id).toHaveLength(want.length)
        want.forEach((w, i) => near(got[i]!, w, `${pe.equipment.id}#${i}`))
      }
    })
  })

  it('a11y：內層 svg aria-hidden（role/aria-label 由外層容器提供）', () => {
    const open = render(T).match(/^<svg\b[^>]*>/)?.[0] ?? ''
    expect(open).toMatch(/\baria-hidden="true"/)
    expect(open).not.toMatch(/\brole=/)
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
