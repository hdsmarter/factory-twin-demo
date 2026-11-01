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
})
