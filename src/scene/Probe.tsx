import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import type * as THREE from 'three'

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
}

/** 掃描整個場景，依 userData 標記統計（契約見 e2e/island.spec.ts） */
function snapshot(scene: THREE.Scene): ProbeSnapshot {
  const s: ProbeSnapshot = { equipmentMeshes: {}, actorMeshes: {}, envParts: {}, buildingMeshes: 0, roofVisible: false, frontWallVisible: false }
  scene.traverse((o) => {
    const u = o.userData
    if (typeof u.equipmentId === 'string') s.equipmentMeshes[u.equipmentId] = visibleDrawables(o)
    if (typeof u.actorId === 'string') s.actorMeshes[u.actorId] = visibleDrawables(o)
    if (typeof u.envPart === 'string') s.envParts[u.envPart] = (s.envParts[u.envPart] ?? 0) + visibleDrawables(o)
    if (u.building === true) s.buildingMeshes += visibleDrawables(o)
  })
  scene.traverseVisible((o) => {
    if (o.userData.shellPart === 'roof') s.roofVisible = true
    if (o.userData.shellPart === 'front') s.frontWallVisible = true
  })
  return s
}

/**
 * 可觀測探針（只在網址帶 ?probe=1 時掛載）：資產載入並實際渲染兩幀後，
 * 在 window.__factory 提供 ready 旗標、首幀統計，以及隨時可呼叫的 snapshot()。
 */
export function Probe() {
  const scene = useThree((s) => s.scene)
  const frames = useRef(0)
  useFrame(() => {
    frames.current += 1
    if (frames.current !== 2) return
    ;(window as unknown as { __factory: unknown }).__factory = { ready: true, ...snapshot(scene), snapshot: () => snapshot(scene) }
  })
  return null
}

export const probeEnabled = () => new URLSearchParams(window.location.search).get('probe') === '1'
