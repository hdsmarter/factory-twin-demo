import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { catalog } from './catalog'
import { parseLayout } from './parseLayout'
import { JOINT_LIMITS } from './motion/robotArm'
import { simulate } from './simulate'
import { DEFAULT_CONVEYOR_ITEMS } from './specs'

const parsed = parseLayout(JSON.parse(readFileSync(new URL('../../data/factory-layout.json', import.meta.url), 'utf8')), catalog)
if (!parsed.ok) throw new Error('fixture layout invalid')
const { site, placed } = parsed

/** 深度比較：結構相同、數值差 < 1e-9 */
function expectSameState(a: unknown, b: unknown, path = 'state'): void {
  if (typeof a === 'number' && typeof b === 'number') {
    expect(Math.abs(a - b), path).toBeLessThan(1e-9)
  } else if (a && b && typeof a === 'object' && typeof b === 'object') {
    expect(Object.keys(b).sort(), path).toEqual(Object.keys(a).sort())
    for (const k of Object.keys(a)) expectSameState((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`)
  } else {
    expect(b, path).toEqual(a)
  }
}

describe('simulate', () => {
  it('@S6 同一時間點、相隔一個生產週期 → 三次計算狀態相同', () => {
    for (const t of [0, 0.37, 2.5, 5.999]) {
      const first = simulate(site, placed, t)
      expectSameState(first, simulate(site, placed, t))
      expectSameState(first, simulate(site, placed, t + site.cycleSeconds))
      expectSameState(first, simulate(site, placed, t - 3 * site.cycleSeconds))
    }
  })

  it('每台設備都有狀態，且種類與配置一致', () => {
    const s = simulate(site, placed, 1.2)
    expect(Object.keys(s.equipment).sort()).toEqual(placed.map((p) => p.equipment.id).sort())
    for (const p of placed) expect(s.equipment[p.equipment.id]!.kind).toBe(p.kind)
  })

  it('不同時間點的狀態確實不同（對照組：證明不是常數）', () => {
    expect(JSON.stringify(simulate(site, placed, 1))).not.toEqual(JSON.stringify(simulate(site, placed, 2)))
  })

  it('配置中每台機械手臂都能確實到達自己的取料點與放料點', () => {
    const N = 600
    for (const p of placed.filter((x) => x.kind === 'robot-arm')) {
      const f = p.equipment.footprint
      const q = p.equipment.params!
      const pick = { x: f.x + q.pickDx!, y: q.pickY!, z: f.z + q.pickDz! }
      const place = { x: f.x + q.placeDx!, y: q.placeY!, z: f.z + q.placeDz! }
      const tools = Array.from({ length: N }, (_, i) => {
        const st = simulate(site, placed, (i / N) * site.cycleSeconds).equipment[p.equipment.id]!
        if (st.kind !== 'robot-arm') throw new Error('kind')
        return st.pose.tool
      })
      const reaches = (target: typeof pick) => tools.some((v) => Math.hypot(v.x - target.x, v.y - target.y, v.z - target.z) < 1e-3)
      expect(reaches(pick), `${p.equipment.id} pick`).toBe(true)
      expect(reaches(place), `${p.equipment.id} place`).toBe(true)
    }
  })

  it('@S8 配置中每台機械手臂在整個週期關節角都在限制範圍內', () => {
    const N = 600
    for (const p of placed.filter((x) => x.kind === 'robot-arm')) {
      for (let i = 0; i <= N; i++) {
        const st = simulate(site, placed, (i / N) * site.cycleSeconds).equipment[p.equipment.id]!
        if (st.kind !== 'robot-arm') throw new Error('kind')
        for (const j of ['base', 'shoulder', 'elbow', 'wrist'] as const) {
          const [min, max] = JOINT_LIMITS[j]
          expect(st.pose[j], `${p.equipment.id}.${j} @${i}`).toBeGreaterThanOrEqual(min)
          expect(st.pose[j], `${p.equipment.id}.${j} @${i}`).toBeLessThanOrEqual(max)
        }
      }
    }
  })

  it('輸送帶未設定料件數時使用領域預設值', () => {
    const conv = placed.find((x) => x.kind === 'conveyor')!
    const bare = { ...conv, equipment: { ...conv.equipment, params: {} } }
    const st = simulate(site, [bare], 0).equipment[conv.equipment.id]!
    expect(st.kind === 'conveyor' && st.items.length).toBe(DEFAULT_CONVEYOR_ITEMS)
  })
})
