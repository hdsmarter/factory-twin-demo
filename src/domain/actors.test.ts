import { describe, expect, it } from 'vitest'
import { actorPose } from './actors'
import type { Actor } from './layout'

const route = [
  { x: 0, z: 0, dwell: 2 },
  { x: 6, z: 0 },
  { x: 6, z: 4, dwell: 3 },
  { x: 0, z: 4 },
]
const worker: Actor = { id: 'W1', name: 'w', type: 'worker', cycleSeconds: 30, route }
const agv: Actor = { ...worker, id: 'A1', type: 'agv' }
const N = 600
const times = Array.from({ length: N }, (_, i) => (i / N) * worker.cycleSeconds)

/** 點到封閉折線的最短距離 */
function distToRoute(x: number, z: number): number {
  let best = Infinity
  for (let i = 0; i < route.length; i++) {
    const a = route[i]!
    const b = route[(i + 1) % route.length]!
    const dx = b.x - a.x
    const dz = b.z - a.z
    const u = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)))
    best = Math.min(best, Math.hypot(a.x + u * dx - x, a.z + u * dz - z))
  }
  return best
}

describe('actorPose', () => {
  it('@S1 工作人員始終位於路線上', () => {
    for (const t of times) {
      const p = actorPose(worker, t)
      expect(distToRoute(p.x, p.z), `t=${t}`).toBeLessThan(1e-9)
    }
  })

  it('@S1 在有停留時間的站點處於工作狀態、速度為零，且停留時間正確', () => {
    const working = times.filter((t) => actorPose(worker, t).action === 'work')
    expect(working.length / N).toBeCloseTo((2 + 3) / 30, 2)
    for (const t of working) {
      const p = actorPose(worker, t)
      expect(p.speed).toBe(0)
      const w = route[p.waypoint]!
      expect([p.x, p.z]).toEqual([w.x, w.z])
      expect(w.dwell).toBeGreaterThan(0)
    }
    for (const t of times.filter((t) => actorPose(worker, t).action === 'walk')) expect(actorPose(worker, t).speed).toBeGreaterThan(0)
  })

  it('@S1 週期結束回到起點（t 與 t+週期 姿態相同）', () => {
    for (const t of [0, 1.7, 12.3, 29.9]) {
      const a = actorPose(worker, t)
      const b = actorPose(worker, t + worker.cycleSeconds)
      expect([b.action, b.waypoint]).toEqual([a.action, a.waypoint])
      for (const k of ['x', 'z', 'heading', 'speed'] as const) expect(Math.abs(b[k] - a[k]), k).toBeLessThan(1e-9) // 浮點容差
    }
    const start = actorPose(worker, 0)
    expect([start.x, start.z]).toEqual([0, 0])
  })

  it('@S2 AGV 行進方向與路線一致（three.js Y 軸偏擺慣例）', () => {
    for (const t of times) {
      const p = actorPose(agv, t)
      if (p.action !== 'move') continue
      const ahead = actorPose(agv, t + 1e-3)
      if (ahead.waypoint !== p.waypoint) continue
      const dx = ahead.x - p.x
      const dz = ahead.z - p.z
      expect(Math.cos(p.heading) * dx - Math.sin(p.heading) * dz).toBeGreaterThan(0) // 前進方向 = (cos h, -sin h)
      expect(Math.abs(Math.sin(p.heading) * dx + Math.cos(p.heading) * dz)).toBeLessThan(1e-9) // 無側向分量
    }
  })

  it('@S2 AGV 在站點停靠時速度為零、行進時等速', () => {
    const speeds = new Set<number>()
    for (const t of times) {
      const p = actorPose(agv, t)
      expect(['move', 'dock']).toContain(p.action)
      if (p.action === 'dock') expect(p.speed).toBe(0)
      else speeds.add(Math.round(p.speed * 1e9))
    }
    expect(speeds.size).toBe(1)
    expect([...speeds][0]! / 1e9).toBeCloseTo(20 / (30 - 5), 9) // 路線長 20 m，可行進時間 25 s
  })

  it('停留中的朝向沿用下一段有長度的路段（不因零長度段突然轉向）', () => {
    const a: Actor = { id: 'Z', name: 'z', type: 'agv', cycleSeconds: 10, route: [{ x: 0, z: 0, dwell: 2 }, { x: 0, z: 5 }, { x: 0, z: 5 }] }
    const p = actorPose(a, 0.5)
    expect(p.action).toBe('dock')
    expect(Number.isFinite(p.x) && Number.isFinite(p.z)).toBe(true)
    for (let i = 0; i < 100; i++) {
      const q = actorPose(a, (i / 100) * 10)
      expect(Number.isFinite(q.x) && Number.isFinite(q.z) && Number.isFinite(q.heading), `t=${i / 10}`).toBe(true)
    }
  })
  it('@S13 distance：本週期已走距離，行進中遞增、停留時不變、轉角連續', () => {
    expect(actorPose(worker, 1).distance).toBe(0) // 起點停留中
    expect(actorPose(worker, 2 + 7.5 + 5 + 1).distance).toBeCloseTo(10, 9) // 停在 P2
    let prev = 0
    for (const t of times) {
      const d = actorPose(worker, t).distance
      expect(d, `t=${t}`).toBeGreaterThanOrEqual(prev - 1e-9)
      expect(d - prev, `t=${t}`).toBeLessThan(0.8 * (30 / N) + 1e-9) // 每格最多走 speed·Δt
      prev = d
    }
  })

  it('@S14 elapsed／duration：同一動作連續的區段合併計時（轉角不中斷）', () => {
    // 2 s 停留 → 行進 7.5 s 到 P1（無停留）→ 行進 5 s 到 P2：行走連續 12.5 s
    const p = actorPose(worker, 2 + 7.5 + 0.1)
    expect(p.action).toBe('walk')
    expect(p.elapsed).toBeCloseTo(7.6, 9)
    expect(p.duration).toBeCloseTo(12.5, 9)
    const w = actorPose(worker, 2 + 12.5 + 1)
    expect([w.action, w.duration]).toEqual(['work', 3])
    expect(w.elapsed).toBeCloseTo(1, 9)
    for (const t of times) {
      const q = actorPose(worker, t)
      expect(q.elapsed >= 0 && q.elapsed <= q.duration + 1e-9, `t=${t}`).toBe(true)
    }
  })

  it('@S14 elapsed／duration：週期首尾同為行進時跨週期合併', () => {
    // 起點無停留：最後一段行進接回第一段行進
    const a: Actor = { id: 'L', name: 'l', type: 'worker', cycleSeconds: 12, route: [{ x: 0, z: 0 }, { x: 5, z: 0, dwell: 2 }] }
    // 行進共 10 s（各 5 s），停留 2 s：時間軸 [0,5) 行進、[5,7) 停留、[7,12) 行進
    const p = actorPose(a, 1)
    expect(p.action).toBe('walk')
    expect(p.duration).toBeCloseTo(10, 9)
    expect(p.elapsed).toBeCloseTo(6, 9)
    const q = actorPose(a, 8)
    expect(q.elapsed).toBeCloseTo(1, 9)
  })
  it('@S13 lap = 路線一圈總長；distance 每週期由 0 走到 lap', () => {
    const p = actorPose(worker, 1)
    expect(p.lap).toBeCloseTo(20, 9)
    expect(actorPose(worker, 30 - 1e-6).distance).toBeCloseTo(20, 4)
  })

  it('@S14 全程行走（無任何停留）：動作不在週期邊界重新計時', () => {
    const a: Actor = { id: 'R', name: 'r', type: 'worker', cycleSeconds: 10, route: [{ x: 0, z: 0 }, { x: 5, z: 0 }] }
    const p = actorPose(a, 30 - 1e-3)
    const q = actorPose(a, 30 + 1e-3)
    expect(p.duration).toBe(Infinity)
    expect(q.elapsed).toBeGreaterThan(1) // 不是剛起步
    expect(p.duration - p.elapsed).toBeGreaterThan(1) // 也不是快停下
  })
})
