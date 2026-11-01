import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import type * as THREE from 'three'

/** 某個子樹底下「可見且實際有網格」的數量（父層或自身 visible=false 的不算） */
function visibleMeshes(root: THREE.Object3D): number {
  let n = 0
  root.traverseVisible((o) => {
    if ((o as THREE.Mesh).isMesh) n++
  })
  return n
}

/**
 * 可觀測探針（只在網址帶 ?probe=1 時掛載）：資產載入完成並實際渲染兩幀後，
 * 回報每台設備（userData.equipmentId）與廠房（userData.building）底下的可見網格數，供 E2E 驗收。
 */
export function Probe() {
  const scene = useThree((s) => s.scene)
  const frames = useRef(0)
  useFrame(() => {
    frames.current += 1
    if (frames.current !== 2) return
    const equipmentMeshes: Record<string, number> = {}
    let buildingMeshes = 0
    scene.traverse((o) => {
      const id = o.userData.equipmentId
      if (typeof id === 'string') equipmentMeshes[id] = visibleMeshes(o)
      if (o.userData.building === true) buildingMeshes += visibleMeshes(o)
    })
    ;(window as unknown as { __factory: unknown }).__factory = { ready: true, equipmentMeshes, buildingMeshes }
  })
  return null
}

export const probeEnabled = () => new URLSearchParams(window.location.search).get('probe') === '1'
