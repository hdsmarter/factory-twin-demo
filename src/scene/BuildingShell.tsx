import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { Site } from '../domain/layout'
import { shell } from '../theme/islandTokens'
import { color } from '../theme/tokens'
import { usePanelWall } from './materials'
import { useViewMode } from './viewMode'

/** 天窗燈帶在廠內的長度比廠房寬度短的量（與 Building.tsx 的燈帶一致） */
const SKYLIGHT_INSET = 2

/** 平頂金屬屋面：在 z = ±depth/6 留天窗開口（長度與廠內燈帶一致），開口鋪半透明採光板。 */
function Roof({ width, depth, height, visible }: { width: number; depth: number; height: number; visible: boolean }) {
  const t = shell.wallThickness
  const W = width + 2 * t + 2 * shell.roofOverhang
  const D = depth + 2 * t + 2 * shell.roofOverhang
  const g = shell.skylightWidth
  const s = depth / 6
  const len = width - SKYLIGHT_INSET
  const y = height + shell.roofThickness / 2
  // [x, z, 寬, 深]：三條全寬板 + 每個天窗開口兩端的補板
  const panels = useMemo<[number, number, number, number][]>(() => {
    const strips: [number, number][] = [
      [-D / 2, -s - g / 2],
      [-s + g / 2, s - g / 2],
      [s + g / 2, D / 2],
    ]
    const end = (W - len) / 2
    return [
      ...strips.map(([z0, z1]): [number, number, number, number] => [0, (z0 + z1) / 2, W, z1 - z0]),
      ...[-s, s].flatMap((z) => [-1, 1].map((side): [number, number, number, number] => [side * (len / 2 + end / 2), z, end, g])),
    ]
  }, [W, D, g, s, len])
  return (
    <group userData={{ shellPart: 'roof' }} visible={visible}>
      {panels.map(([x, z, pw, pd], i) => (
        <mesh key={i} position={[x, y, z]} castShadow receiveShadow>
          <boxGeometry args={[pw, shell.roofThickness, pd]} />
          <meshStandardMaterial color={shell.roofColor} metalness={shell.roofMetalness} roughness={shell.roofRoughness} />
        </mesh>
      ))}
      {[-s, s].map((z) => (
        <mesh key={z} position={[0, y, z]}>
          <boxGeometry args={[len, shell.roofThickness * 0.5, g]} />
          <meshStandardMaterial color={color.glass} transparent opacity={shell.skylightOpacity} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

/** 前牆（+z 面）：夾心板，中央留捲門開口（U 形外框擠出，無破洞三角化問題）。 */
function FrontWall({ width, depth, height, visible }: { width: number; depth: number; height: number; visible: boolean }) {
  const t = shell.wallThickness
  const W = width + 2 * t
  const map = usePanelWall(W, height)
  const geometry = useMemo(() => {
    const dw = shell.doorWidth / 2
    const dh = shell.doorHeight
    const outline = new THREE.Shape([
      new THREE.Vector2(-W / 2, 0),
      new THREE.Vector2(-dw, 0),
      new THREE.Vector2(-dw, dh),
      new THREE.Vector2(dw, dh),
      new THREE.Vector2(dw, 0),
      new THREE.Vector2(W / 2, 0),
      new THREE.Vector2(W / 2, height),
      new THREE.Vector2(-W / 2, height),
    ])
    const geo = new THREE.ExtrudeGeometry(outline, { depth: t, bevelEnabled: false })
    // UV 依牆面位置重算：貼圖橫向鋪滿整面牆（usePanelWall 已依長度設 repeat）、縱向對齊地面
    const pos = geo.attributes.position as THREE.BufferAttribute
    const uv = geo.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + W / 2) / W, pos.getY(i) / height)
    uv.needsUpdate = true
    return geo
  }, [W, height, t])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <group userData={{ shellPart: 'front' }} visible={visible}>
      <mesh geometry={geometry} position-z={depth / 2} castShadow receiveShadow>
        <meshStandardMaterial map={map} roughness={shell.wallRoughness} metalness={shell.wallMetalness} />
      </mesh>
    </group>
  )
}

/** 廠房外殼（屋頂、前牆）：島嶼全景時顯示；廠內視角為剖面，隱藏（仍留在場景中，探針可觀察其可見性）。 */
export function BuildingShell({ site }: { site: Site }) {
  const { width, depth, height } = site.bounds
  const visible = useViewMode() === 'island'
  return (
    <>
      <Roof width={width} depth={depth} height={height} visible={visible} />
      <FrontWall width={width} depth={depth} height={height} visible={visible} />
    </>
  )
}
