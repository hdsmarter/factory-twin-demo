import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { forestPlacement, islandHeight, PLATEAU_HEIGHT, type TreeInstance } from '../../domain/environment'
import type { Rect } from '../../domain/geometry'
import type { IslandSpec } from '../../domain/layout'
import { FOREST_COUNT } from '../../domain/specs'
import { forest as tokens } from '../../theme/islandTokens'
import { assetUrl } from '../materials'

const TREE_MODELS = ['island_tree_01', 'island_tree_02', 'island_tree_03'] as const
const ROCK_MODELS = ['coast_rocks_01', 'coast_rocks_02'] as const
const FERN_MODEL = 'fern_02'

/** 模型等比縮放依據：樹以高度、岩石與蕨類以寬度（x/z 較大者） */
type Fit = { axis: 'height' | 'width'; meters: number }

/**
 * 把一個 glTF 的每個子網格轉成 InstancedMesh（一個子網格一個 draw call，與實例數無關）。
 * 實例矩陣 = 落點平移 · 繞 y 旋轉 · 縮放 · 底面貼地偏移 · 子網格在模型內的矩陣。
 */
function useInstanced(model: string, items: TreeInstance[], fit: Fit, castShadow: boolean): THREE.InstancedMesh[] {
  const { scene } = useGLTF(assetUrl.model(model))
  const meshes = useMemo(() => {
    if (items.length === 0) return []
    scene.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    const base = fit.meters / Math.max(fit.axis === 'height' ? size.y : Math.max(size.x, size.z), 1e-6)
    const ground = new THREE.Matrix4().makeTranslation(0, -box.min.y, 0)
    const placement = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const yAxis = new THREE.Vector3(0, 1, 0)
    const parts: { mesh: THREE.Mesh; local: THREE.Matrix4 }[] = []
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) parts.push({ mesh: m, local: ground.clone().multiply(m.matrixWorld) })
    })
    return parts.map(({ mesh, local }) => {
      const material = adaptMaterial(mesh.material)
      const inst = new THREE.InstancedMesh(mesh.geometry, material, items.length)
      items.forEach((it, i) => {
        const s = base * it.scale
        placement.compose(new THREE.Vector3(it.x, it.y - PLATEAU_HEIGHT - tokens.sink, it.z), q.setFromAxisAngle(yAxis, it.rotation), new THREE.Vector3(s, s, s))
        inst.setMatrixAt(i, placement.clone().multiply(local))
      })
      inst.instanceMatrix.needsUpdate = true
      inst.castShadow = castShadow
      inst.receiveShadow = true
      return inst
    })
  }, [scene, items, fit.axis, fit.meters, castShadow])
  useEffect(() => () => meshes.forEach((m) => m.dispose()), [meshes])
  return meshes
}

/** 半透明樹葉改為 alphaTest：實例化繪製無法逐實例排序，混合模式會出現前後錯亂。 */
function adaptMaterial(material: THREE.Material | THREE.Material[]): THREE.Material | THREE.Material[] {
  const adapt = (m: THREE.Material) => {
    if (!m.transparent) return m
    const c = m.clone()
    c.transparent = false
    c.alphaTest = tokens.leafAlphaTest
    c.depthWrite = true
    return c
  }
  return Array.isArray(material) ? material.map(adapt) : adapt(material)
}

function byVariant(items: TreeInstance[], variants: number): TreeInstance[][] {
  return Array.from({ length: variants }, (_, v) => items.filter((it) => it.variant % variants === v))
}

/** 落點全部來自 domain 的種子化 forestPlacement（可重現）。岩石用「平台半徑放大」的島嶼複本把落點推到丘陵外緣，高度再以真實島嶼重算。 */
function usePlacements(island: IslandSpec, avoid: Rect) {
  return useMemo(() => {
    const trees = forestPlacement(island, avoid, FOREST_COUNT)
    const ferns = forestPlacement({ ...island, seed: island.seed + tokens.fernSeedOffset }, avoid, tokens.fernCount)
    const rockRing = { ...island, seed: island.seed + tokens.rockSeedOffset, plateauRadius: island.radius - island.beachWidth - tokens.rockBand }
    const rocks = forestPlacement(rockRing, avoid, tokens.rockCount).map((r) => ({ ...r, y: islandHeight(island, r.x, r.z) }))
    return { trees: byVariant(trees, TREE_MODELS.length), rocks: byVariant(rocks, ROCK_MODELS.length), ferns }
  }, [island, avoid])
}

const TREE_FIT: Fit = { axis: 'height', meters: tokens.treeHeight }
const ROCK_FIT: Fit = { axis: 'width', meters: tokens.rockWidth }
const FERN_FIT: Fit = { axis: 'width', meters: tokens.fernWidth }

export function Forest({ island, avoid }: { island: IslandSpec; avoid: Rect }) {
  const p = usePlacements(island, avoid)
  const meshes = [
    ...useInstanced(TREE_MODELS[0], p.trees[0] ?? [], TREE_FIT, true),
    ...useInstanced(TREE_MODELS[1], p.trees[1] ?? [], TREE_FIT, true),
    ...useInstanced(TREE_MODELS[2], p.trees[2] ?? [], TREE_FIT, true),
    ...useInstanced(ROCK_MODELS[0], p.rocks[0] ?? [], ROCK_FIT, false),
    ...useInstanced(ROCK_MODELS[1], p.rocks[1] ?? [], ROCK_FIT, false),
    ...useInstanced(FERN_MODEL, p.ferns, FERN_FIT, false),
  ]
  return (
    <group userData={{ envPart: 'forest' }}>
      {meshes.map((m) => (
        <primitive key={m.uuid} object={m} />
      ))}
    </group>
  )
}
