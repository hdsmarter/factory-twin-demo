import { describe, expect, it } from 'vitest'
import layout from '../../../data/factory-layout.json'
import { actorPose } from '../../domain/actors'
import type { Actor } from '../../domain/layout'
import { BODY, fk, GAIT, LIMITS, project, solvePose, STRIDE, walkTargets, workerPose, type Fwd } from './gait'

const HEIGHT_M = 1.75
const FWDS: Fwd[] = [{ u: 1, v: 0 }, { u: 0.7, v: 0.35 }, { u: 0.25, v: -0.4 }]
const walking = (distance: number) => ({ action: 'walk' as const, distance, lap: STRIDE * HEIGHT_M * 10, elapsed: 50, duration: 100 })

describe('gait', () => {
  it('IK：解出的關節角度把腳踝放在目標位置（矢狀面）', () => {
    for (let i = 0; i < 50; i++) {
      const tg = walkTargets(i / 50)
      const j = fk(solvePose(tg))
      expect(j.ankleN.f).toBeCloseTo(tg.footN.f, 9)
      expect(j.ankleN.h).toBeCloseTo(BODY.ankle + tg.footN.lift, 9)
      expect(j.ankleF.f).toBeCloseTo(tg.footF.f, 9)
    }
  })

  it('@S13 著地腳在畫面上不打滑（各種行進方向）', () => {
    for (const fwd of FWDS) {
      const strideM = STRIDE * HEIGHT_M
      let anchor: { u: number; v: number } | undefined
      let checked = 0
      for (let i = 0; i <= 400; i++) {
        const d = (i / 400) * strideM // 一個完整週期
        const phase = d / strideM
        const j = fk(workerPose(walking(d), 0, HEIGHT_M))
        const a = project(j.ankleN, fwd)
        const ankle = { u: (d / HEIGHT_M) * fwd.u + a.u, v: (d / HEIGHT_M) * fwd.v + a.v }
        if (phase > 0.01 && phase < GAIT.stance - 0.01) {
          anchor ??= ankle
          expect(Math.hypot(ankle.u - anchor.u, ankle.v - anchor.v), `fwd=${fwd.u},${fwd.v} phase=${phase}`).toBeLessThan(1e-6)
          checked++
        }
      }
      expect(checked).toBeGreaterThan(150)
    }
  })

  it('@S13 腳底不低於地面', () => {
    for (let i = 0; i < 200; i++) {
      const tg = walkTargets(i / 200)
      expect(tg.footN.lift).toBeGreaterThanOrEqual(0)
      expect(tg.footF.lift).toBeGreaterThanOrEqual(0)
    }
  })

  const actors: Actor[] = [
    ...(layout as { actors: Actor[] }).actors.filter((a) => a.type === 'worker'),
    { id: 'T', name: 't', type: 'worker', cycleSeconds: 30, route: [{ x: 0, z: 0, dwell: 2 }, { x: 6, z: 0 }, { x: 6, z: 4, dwell: 3 }, { x: 0, z: 4 }] },
    // 起點無停留（跨週期合併行走）、全程行走
    { id: 'L', name: 'l', type: 'worker', cycleSeconds: 12, route: [{ x: 0, z: 0 }, { x: 7, z: 0, dwell: 2 }] },
    { id: 'R', name: 'r', type: 'worker', cycleSeconds: 10, route: [{ x: 0, z: 0 }, { x: 6, z: 0 }] },
  ]

  it('@S14 膝只往後彎、肘只往前彎（走路、工作、轉換全程）', () => {
    for (const a of actors) {
      for (let k = 0; k < a.cycleSeconds * 60; k++) {
        const t = k / 60
        const p = workerPose(actorPose(a, t), t, HEIGHT_M)
        for (const [name, v] of [['kneeN', p.kneeN], ['kneeF', p.kneeF]] as const) {
          expect(v >= LIMITS.knee[0] && v <= LIMITS.knee[1], `${a.id} t=${t} ${name}=${v}`).toBe(true)
        }
        for (const [name, v] of [['elbowN', p.elbowN], ['elbowF', p.elbowF]] as const) {
          expect(v >= LIMITS.elbow[0] && v <= LIMITS.elbow[1], `${a.id} t=${t} ${name}=${v}`).toBe(true)
        }
      }
    }
  })

  it('@S14 相鄰兩格（1/60 s）角度不跳動', () => {
    const keys = ['lean', 'thighN', 'kneeN', 'thighF', 'kneeF', 'armN', 'elbowN', 'armF', 'elbowF', 'head'] as const
    const LEG_KEYS = new Set<string>(['thighN', 'kneeN', 'thighF', 'kneeF'])
    for (const a of actors) {
      let prev = workerPose(actorPose(a, 0), 0, HEIGHT_M)
      for (let k = 1; k < a.cycleSeconds * 60 * 2.05; k++) {
        const t = k / 60
        const p = workerPose(actorPose(a, t), t, HEIGHT_M)
        // 實測正常步態：擺動期膝每格約 8.6°、手臂約 2–5°；超過即視為抽動
        for (const key of keys) expect(Math.abs(p[key] - prev[key]), `${a.id} t=${t.toFixed(3)} ${key}`).toBeLessThan(LEG_KEYS.has(key) ? 10 : 6)
        expect(Math.abs(p.hip - prev.hip), `${a.id} t=${t} hip`).toBeLessThan(0.02)
        prev = p
      }
    }
  })
})
