import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import type * as THREE from 'three'
import { useSimTimeline } from './clock'

/** 某個子樹底下「可見且實際有幾何」的數量（Mesh、SkinnedMesh、InstancedMesh、Points；父層或自身 visible=false 的不算） */
function visibleDrawables(root: THREE.Object3D): number {
  let n = 0
  root.traverseVisible((o) => {
    if ((o as THREE.Mesh).isMesh || (o as THREE.Points).isPoints) n++
  })
  return n
}

export interface ProbeSnapshot {
  equipmentMeshes: Record<string, number>
  actorMeshes: Record<string, number>
  envParts: Record<string, number>
  buildingMeshes: number
  roofVisible: boolean
  frontWallVisible: boolean
  /** 目前模擬時間（秒） */
  t: number
  /** 探針掛載後經過的渲染幀數（判斷畫面是否仍在渲染） */
  frame: number
}

/** 掃描整個場景，依 userData 標記統計（契約見 e2e/island.spec.ts） */
function snapshot(scene: THREE.Scene, t: number, frame: number): ProbeSnapshot {
  const s: ProbeSnapshot = { equipmentMeshes: {}, actorMeshes: {}, envParts: {}, buildingMeshes: 0, roofVisible: false, frontWallVisible: false, t, frame }
  scene.traverse((o) => {
    const u = o.userData
    if (typeof u.equipmentId === 'string') s.equipmentMeshes[u.equipmentId] = visibleDrawables(o)
    if (typeof u.actorId === 'string') s.actorMeshes[u.actorId] = visibleDrawables(o)
    if (typeof u.envPart === 'string') s.envParts[u.envPart] = (s.envParts[u.envPart] ?? 0) + visibleDrawables(o)
    if (u.building === true) s.buildingMeshes += visibleDrawables(o)
  })
  // 外殼可見 = 標記群組本身可見，且底下確實有可見網格
  scene.traverseVisible((o) => {
    if (o.userData.shellPart === 'roof' && visibleDrawables(o) > 0) s.roofVisible = true
    if (o.userData.shellPart === 'front' && visibleDrawables(o) > 0) s.frontWallVisible = true
  })
  return s
}

/**
 * 可觀測探針（只在網址帶 ?probe=1 時掛載）：資產載入並實際渲染兩幀後，
 * 在 window.__factory 提供 ready 旗標、首幀統計，以及隨時可呼叫的 snapshot()。
 */
export function Probe() {
  const scene = useThree((s) => s.scene)
  const timeline = useSimTimeline()
  const frames = useRef(0)
  useFrame(() => {
    frames.current += 1
    if (frames.current !== 2) return
    const take = () => snapshot(scene, timeline.now(), frames.current)
    ;(window as unknown as { __factory: unknown }).__factory = { ready: true, ...take(), snapshot: take }
  })
  return null
}

export const probeEnabled = () => new URLSearchParams(window.location.search).get('probe') === '1'
