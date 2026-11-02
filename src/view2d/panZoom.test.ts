import { describe, expect, it } from 'vitest'
import { applyView, panBy, PAN_ZOOM_DEFAULT, sceneAt, zoomAt, ZOOM_LIMITS } from './panZoom'

const box = { u0: -40, u1: 60, v0: -10, v1: 40 }

describe('panZoom', () => {
  it('@S15 預設視角等於預設構圖', () => {
    expect(applyView(box, PAN_ZOOM_DEFAULT)).toEqual(box)
  })

  it('@S15 以游標為中心縮放：游標下的場景點不變', () => {
    const v0 = { zoom: 2, x: 0.1, y: -0.05 }
    for (const [fx, fy] of [[0.5, 0.5], [0.3, 0.6], [0.55, 0.45]] as const) {
      const before = sceneAt(box, v0, fx, fy)
      const v1 = zoomAt(v0, 1.4, fx, fy)
      const after = sceneAt(box, v1, fx, fy)
      expect(v1.zoom).toBeCloseTo(2.8, 12)
      expect(after.u).toBeCloseTo(before.u, 9)
      expect(after.v).toBeCloseTo(before.v, 9)
    }
  })

  it('@S15 縮放有上下限', () => {
    expect(zoomAt(PAN_ZOOM_DEFAULT, 0.1, 0.5, 0.5).zoom).toBe(ZOOM_LIMITS.min)
    expect(zoomAt(PAN_ZOOM_DEFAULT, 1000, 0.5, 0.5).zoom).toBe(ZOOM_LIMITS.max)
  })

  it('@S15 拖曳：畫面跟著手指走，且不會拖出內容範圍', () => {
    const v = { zoom: 4, x: 0, y: 0 }
    // 往右拖 100 px（寬 1000 px）：內容往右 → 視角中心往左 0.1/4 個構圖寬
    const p = panBy(v, 100, -50, 1000, 500)
    expect(p.x).toBeCloseTo(-0.025, 12)
    expect(p.y).toBeCloseTo(0.025, 12)
    const far = panBy(v, 1e6, 1e6, 1000, 500)
    const vb = applyView(box, far)
    expect(vb.u0).toBeCloseTo(box.u0, 9) // 視窗左緣貼齊構圖左緣
    expect(vb.v0).toBeCloseTo(box.v0, 9)
    // 未放大時不能平移
    expect(panBy(PAN_ZOOM_DEFAULT, 300, 300, 1000, 500)).toEqual(PAN_ZOOM_DEFAULT)
  })
})
