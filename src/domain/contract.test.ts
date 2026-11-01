import { describe, expect, it } from 'vitest'
import { catalog } from './catalog'
import type { Actor, EnvironmentSpec, LayoutErrorCode } from './layout'

describe('契約：型號參數允許清單', () => {
  it('每個型號都宣告允許的參數名稱（未宣告 = 不接受任何參數）', () => {
    for (const [key, model] of Object.entries(catalog)) expect(Array.isArray(model.params), key).toBe(true)
  })
  it('手臂允許取放點參數、輸送帶允許料件數', () => {
    expect(catalog['ARM-6AX']!.params).toEqual(['pickDx', 'pickDz', 'pickY', 'placeDx', 'placeDz', 'placeY'])
    expect(catalog['CONV-BELT']!.params).toEqual(['itemCount'])
  })
})

describe('契約：新型別可被建立（編譯期檢查 + 執行期形狀）', () => {
  it('Actor / EnvironmentSpec / 新錯誤碼', () => {
    const a: Actor = { id: 'W1', name: 'w', type: 'worker', cycleSeconds: 10, route: [{ x: 0, z: 0, dwell: 1 }, { x: 1, z: 0 }] }
    const env: EnvironmentSpec = { island: { radius: 100, plateauRadius: 40, beachWidth: 10, seed: 1 }, dayCycleSeconds: 120, waveSeconds: 6 }
    const codes: LayoutErrorCode[] = ['UNREACHABLE', 'UNKNOWN_PARAM', 'OFF_ISLAND']
    expect([a.route.length, env.island.radius, codes.length]).toEqual([2, 100, 3])
  })
})
