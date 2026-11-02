/**
 * 2D 插畫的平移與縮放（純函數）。
 * 視角 = { zoom, x, y }：x、y 為視窗中心相對預設構圖中心的偏移，以「預設構圖的寬／高」為單位。
 * 預設構圖與視窗同長寬比（viewBoxOf 已補齊），所以螢幕上的比例座標可直接換算。
 */
export interface PanZoom {
  zoom: number
  x: number
  y: number
}

export interface ViewBox {
  u0: number
  u1: number
  v0: number
  v1: number
}

export const PAN_ZOOM_DEFAULT: PanZoom = { zoom: 1, x: 0, y: 0 }
export const ZOOM_LIMITS = { min: 1, max: 8 } as const

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** 視窗邊緣不離開預設構圖：|偏移| ≤ (1 − 1/zoom) / 2 */
function clampView(v: PanZoom): PanZoom {
  const zoom = clamp(v.zoom, ZOOM_LIMITS.min, ZOOM_LIMITS.max)
  const room = (1 - 1 / zoom) / 2
  return { zoom, x: clamp(v.x, -room, room) || 0, y: clamp(v.y, -room, room) || 0 }
}

export function applyView(box: ViewBox, v: PanZoom): ViewBox {
  const W = box.u1 - box.u0
  const H = box.v1 - box.v0
  const cu = (box.u0 + box.u1) / 2 + v.x * W
  const cv = (box.v0 + box.v1) / 2 + v.y * H
  const w = W / v.zoom
  const h = H / v.zoom
  return { u0: cu - w / 2, u1: cu + w / 2, v0: cv - h / 2, v1: cv + h / 2 }
}

/** 螢幕比例座標 (fx, fy ∈ [0, 1]) 下的場景點 */
export function sceneAt(box: ViewBox, v: PanZoom, fx: number, fy: number): { u: number; v: number } {
  const vb = applyView(box, v)
  return { u: vb.u0 + fx * (vb.u1 - vb.u0), v: vb.v0 + fy * (vb.v1 - vb.v0) }
}

/** 以螢幕比例座標 (fx, fy) 為中心縮放 factor 倍：該點下的場景位置不變（受上下限與邊界約束） */
export function zoomAt(v: PanZoom, factor: number, fx: number, fy: number): PanZoom {
  const zoom = clamp(v.zoom * factor, ZOOM_LIMITS.min, ZOOM_LIMITS.max)
  const px = v.x + (fx - 0.5) / v.zoom
  const py = v.y + (fy - 0.5) / v.zoom
  return clampView({ zoom, x: px - (fx - 0.5) / zoom, y: py - (fy - 0.5) / zoom })
}

/** 拖曳 (dx, dy) 像素：內容跟著指標移動 */
export function panBy(v: PanZoom, dx: number, dy: number, width: number, height: number): PanZoom {
  return clampView({ zoom: v.zoom, x: v.x - dx / (width * v.zoom), y: v.y - dy / (height * v.zoom) })
}
