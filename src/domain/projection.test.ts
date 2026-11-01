import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { ISO_DIRECTION, isoProject } from './projection'

describe('isoProject', () => {
  it('@S8 與 three.js 正交相機（沿 ISO_DIRECTION 看向原點）的投影一致（只差等比縮放）', () => {
    const cam = new THREE.OrthographicCamera(-50, 50, 50, -50, 0.1, 1000)
    cam.position.set(ISO_DIRECTION.x * 300, ISO_DIRECTION.y * 300, ISO_DIRECTION.z * 300)
    cam.lookAt(0, 0, 0)
    cam.updateMatrixWorld()
    const pts = [[3, 0, -7], [-12, 4, 5], [20, 1.5, 9], [0, 8, 0], [-30, 0, -10]]
    for (const [x, y, z] of pts) {
      const ndc = new THREE.Vector3(x, y, z).project(cam)
      const { u, v } = isoProject(x!, y!, z!)
      // NDC 半寬 = 50 world units；SVG 的 v 向下為正
      expect(ndc.x * 50).toBeCloseTo(u, 6)
      expect(-ndc.y * 50).toBeCloseTo(v, 6)
    }
  })
  it('沿著視線方向的點投影到同一位置；往上（+y）在畫面上往上', () => {
    const a = isoProject(0, 0, 0)
    const b = isoProject(ISO_DIRECTION.x * 9, ISO_DIRECTION.y * 9, ISO_DIRECTION.z * 9)
    expect(b.u).toBeCloseTo(a.u, 9)
    expect(b.v).toBeCloseTo(a.v, 9)
    expect(isoProject(0, 1, 0).v).toBeLessThan(0)
  })
})
