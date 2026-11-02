import { describe, expect, it } from 'vitest'
import layout from '../../data/factory-layout.json'
import { actorPose } from '../domain/actors'
import type { Actor } from '../domain/layout'
import { isoProject } from '../domain/projection'
import { WORKER_HEIGHT } from '../domain/specs'
import { fk, project, workerPose } from './rig/gait'
import { forwardAt } from './Worker'
import { VERTICAL } from './shapes'

const workers = (layout as { actors: Actor[] }).actors.filter((a) => a.type === 'worker')
const ENLARGE = 1.25

/** 畫面上（場景單位）近側腳踝位置與是否著地 */
function ankleOnScreen(a: Actor, t: number) {
  const pose = actorPose(a, t)
  const heightM = WORKER_HEIGHT * ENLARGE
  const s = heightM * VERTICAL
  const body = workerPose(pose, t, heightM)
  const j = fk(body)
  const p = project(j.ankleN, forwardAt(a, t))
  const anchor = isoProject(pose.x, 0, pose.z)
  return { u: anchor.u + s * p.u, v: anchor.v + s * p.v, planted: j.ankleN.h < 0.0401 && pose.action === 'walk', s }
}

describe('WorkerFigure 沿真實路線', () => {
  it('@S13 著地腳：直線段幾乎不動、轉角平順轉身不瞬移', () => {
    for (const a of workers) {
      const same = (t: number) => {
        const f0 = forwardAt(a, t - 0.6)
        const f1 = forwardAt(a, t + 0.6)
        const p = actorPose(a, t)
        return f0.u === f1.u && f0.v === f1.v && p.elapsed > 0.6 && p.duration - p.elapsed > 0.6
      }
      let prev = ankleOnScreen(a, 0)
      let straight = 0
      let turning = 0
      let checked = 0
      for (let k = 1; k < a.cycleSeconds * 60; k++) {
        const t = k / 60
        const cur = ankleOnScreen(a, t)
        if (cur.planted && prev.planted) {
          const d = Math.hypot(cur.u - prev.u, cur.v - prev.v) / cur.s
          if (same(t)) straight = Math.max(straight, d)
          else turning = Math.max(turning, d)
          checked++
        }
        prev = cur
      }
      expect(checked, a.id).toBeGreaterThan(100)
      // 直線段：著地腳完全不動（數值誤差內）
      expect(straight, a.id).toBeLessThan(1e-6)
      // 轉角與起停：腳不在骨盆正下方時轉身必有少量滑動；上限 2% 身高／格（未平滑前為 17%）
      expect(turning, a.id).toBeLessThan(0.02)
    }
  })
})
