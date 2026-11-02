import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { panBy, PAN_ZOOM_DEFAULT, zoomAt, type PanZoom } from './panZoom'

/** 滾輪每單位 deltaY 的縮放指數；鍵盤每次縮放倍率與平移比例 */
const WHEEL_RATE = 0.0015
const KEY_ZOOM = 1.25
const KEY_PAN = 0.1
/** 指標移動超過此像素即視為拖曳：拖曳後的 dblclick 不重設（避免連續兩次短拖曳被當成雙擊） */
const DRAG_SLOP_PX = 4

type Pt = { x: number; y: number }

/**
 * 2D 插畫的拖曳平移、滾輪／雙指縮放、雙擊與鍵盤重設。
 * 只處理事件與換算，數學都在 panZoom.ts（純函數）。容器需設 touch-action: none。
 */
export function usePanZoom<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [view, setView] = useState<PanZoom>(PAN_ZOOM_DEFAULT)
  const pointers = useRef(new Map<number, Pt>())
  const [dragging, setDragging] = useState(false)
  /** 本次按下後累計移動距離；最近一次按壓是否算拖曳 */
  const travel = useRef(0)
  const lastWasDrag = useRef(false)

  const frac = (el: HTMLElement, p: Pt) => {
    const r = el.getBoundingClientRect()
    return { fx: (p.x - r.left) / r.width, fy: (p.y - r.top) / r.height, w: r.width, h: r.height }
  }

  // wheel 需 passive: false 才能 preventDefault（React 的 onWheel 是 passive）
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { fx, fy } = frac(el, { x: e.clientX, y: e.clientY })
      setView((v) => zoomAt(v, Math.exp(-e.deltaY * WHEEL_RATE), fx, fy))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const onPointerDown = useCallback((e: PointerEvent<T>) => {
    // 只接受主按鍵（滑鼠左鍵；觸控與筆皆為 0）
    if (e.button !== 0) return
    if (pointers.current.size === 0) travel.current = 0
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    setDragging(true)
  }, [])

  const onPointerMove = useCallback((e: PointerEvent<T>) => {
    const map = pointers.current
    const prev = map.get(e.pointerId)
    if (!prev) return
    // 放開事件遺失（例如叫出右鍵選單）時，不再跟著游標平移
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      map.delete(e.pointerId)
      if (map.size === 0) setDragging(false)
      return
    }
    const el = e.currentTarget
    const next = { x: e.clientX, y: e.clientY }
    travel.current += Math.hypot(next.x - prev.x, next.y - prev.y)
    if (map.size >= 2) {
      // 雙指：以兩指中點為中心縮放（距離比），再依中點位移平移
      const other = [...map.entries()].find(([id]) => id !== e.pointerId)![1]
      const mid0 = { x: (prev.x + other.x) / 2, y: (prev.y + other.y) / 2 }
      const mid1 = { x: (next.x + other.x) / 2, y: (next.y + other.y) / 2 }
      const d0 = Math.hypot(prev.x - other.x, prev.y - other.y)
      const d1 = Math.hypot(next.x - other.x, next.y - other.y)
      const { fx, fy, w, h } = frac(el, mid0)
      setView((v) => panBy(zoomAt(v, d0 > 0 ? d1 / d0 : 1, fx, fy), mid1.x - mid0.x, mid1.y - mid0.y, w, h))
    } else {
      const { w, h } = frac(el, next)
      setView((v) => panBy(v, next.x - prev.x, next.y - prev.y, w, h))
    }
    map.set(e.pointerId, next)
  }, [])

  const onPointerUp = useCallback((e: PointerEvent<T>) => {
    if (!pointers.current.delete(e.pointerId)) return
    if (pointers.current.size === 0) {
      setDragging(false)
      lastWasDrag.current = travel.current > DRAG_SLOP_PX
    }
  }, [])

  const reset = useCallback(() => setView(PAN_ZOOM_DEFAULT), [])
  const onDoubleClick = useCallback(() => {
    if (!lastWasDrag.current) setView(PAN_ZOOM_DEFAULT)
  }, [])

  const onKeyDown = useCallback((e: KeyboardEvent<T>) => {
    // 保留瀏覽器與系統快捷鍵（Ctrl/Cmd + = 頁面縮放等）
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const { width: w, height: h } = e.currentTarget.getBoundingClientRect()
    const step: Record<string, (v: PanZoom) => PanZoom> = {
      '+': (v) => zoomAt(v, KEY_ZOOM, 0.5, 0.5),
      '=': (v) => zoomAt(v, KEY_ZOOM, 0.5, 0.5),
      '-': (v) => zoomAt(v, 1 / KEY_ZOOM, 0.5, 0.5),
      '0': () => PAN_ZOOM_DEFAULT,
      ArrowLeft: (v) => panBy(v, w * KEY_PAN, 0, w, h),
      ArrowRight: (v) => panBy(v, -w * KEY_PAN, 0, w, h),
      ArrowUp: (v) => panBy(v, 0, h * KEY_PAN, w, h),
      ArrowDown: (v) => panBy(v, 0, -h * KEY_PAN, w, h),
    }
    const f = step[e.key]
    if (!f) return
    e.preventDefault()
    setView(f)
  }, [])

  return {
    ref,
    view,
    dragging,
    reset,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onLostPointerCapture: onPointerUp, onDoubleClick, onKeyDown },
  }
}
