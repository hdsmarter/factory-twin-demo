import { useTexture } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { islandHeight, PLATEAU_HEIGHT } from '../../domain/environment'
import type { IslandSpec } from '../../domain/layout'
import { terrain as tokens } from '../../theme/islandTokens'
import { assetUrl } from '../materials'

type TerrainSet = 'coast_sand_01' | 'aerial_grass_rock'
const textureUrl = (id: TerrainSet, map: 'diff' | 'nor_gl') => assetUrl.file(`textures/${id}/${map}.jpg`)

const smooth = (e0: number, e1: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return u * u * (3 - 2 * u)
}

/** 程式化地形網格：頂點高度 = islandHeight − PLATEAU_HEIGHT（平台頂對齊廠房地面 y = 0）；blend 屬性 = 草的比例。 */
function buildGeometry(island: IslandSpec): THREE.PlaneGeometry {
  const size = island.radius * tokens.extentFactor * 2
  const g = new THREE.PlaneGeometry(size, size, tokens.segments, tokens.segments)
  g.rotateX(-Math.PI / 2)
  const pos = g.attributes.position as THREE.BufferAttribute
  const blend = new Float32Array(pos.count)
  for (let i = 0; i < pos.count; i++) {
    const h = islandHeight(island, pos.getX(i), pos.getZ(i))
    pos.setY(i, h - PLATEAU_HEIGHT - tokens.sink)
    blend[i] = smooth(tokens.sandTop, tokens.grassFull, h)
  }
  g.setAttribute('blend', new THREE.BufferAttribute(blend, 1))
  g.computeVertexNormals()
  return g
}

/** 沙（map）與草（grassMap）依頂點 blend 混色；法線用草地貼圖（陸地大部分是草）。 */
function buildMaterial(sand: THREE.Texture, grass: THREE.Texture, grassNormal: THREE.Texture, size: number): THREE.MeshStandardMaterial {
  const prep = (src: THREE.Texture, tile: number, srgb: boolean) => {
    const tex = src.clone()
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(size / tile, size / tile)
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    tex.anisotropy = 16
    tex.needsUpdate = true
    return tex
  }
  const grassMap = prep(grass, tokens.grassTileMeters, true)
  const mat = new THREE.MeshStandardMaterial({
    map: prep(sand, tokens.sandTileMeters, true),
    normalMap: prep(grassNormal, tokens.grassTileMeters, false),
    roughness: tokens.roughness,
    metalness: 0,
  })
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.grassMap = { value: grassMap }
    shader.uniforms.grassScale = { value: tokens.sandTileMeters / tokens.grassTileMeters }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float blend;\nvarying float vBlend;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBlend = blend;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D grassMap;\nuniform float grassScale;\nvarying float vBlend;')
      .replace(
        '#include <map_fragment>',
        'diffuseColor *= mix( texture2D( map, vMapUv ), texture2D( grassMap, vMapUv * grassScale ), vBlend );',
      )
  }
  mat.customProgramCacheKey = () => 'island-terrain'
  return mat
}

export function Terrain({ island }: { island: IslandSpec }) {
  const [sand, grass, grassNormal] = useTexture([textureUrl('coast_sand_01', 'diff'), textureUrl('aerial_grass_rock', 'diff'), textureUrl('aerial_grass_rock', 'nor_gl')])
  const geometry = useMemo(() => buildGeometry(island), [island])
  const material = useMemo(() => buildMaterial(sand!, grass!, grassNormal!, island.radius * tokens.extentFactor * 2), [sand, grass, grassNormal, island])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  return (
    <group userData={{ envPart: 'terrain' }}>
      <mesh geometry={geometry} material={material} receiveShadow />
    </group>
  )
}
