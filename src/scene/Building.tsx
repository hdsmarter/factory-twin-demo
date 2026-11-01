import { useMemo } from 'react'
import * as THREE from 'three'
import type { PlacedEquipment, Site } from '../domain/layout'
import { areaBounds } from '../domain/geometry'
import { color, light } from '../theme/tokens'
import { usePanelWall, usePbr } from './materials'

const WALL_THICKNESS = 0.25
const COLUMN_SPACING = 6
const MARK_WIDTH = 0.1

function Outline({ minX, maxX, minZ, maxZ, tint, lift }: { minX: number; maxX: number; minZ: number; maxZ: number; tint: string; lift: number }) {
  const w = maxX - minX
  const d = maxZ - minZ
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  const segs: [number, number, number, number][] = [
    [cx, minZ, w, MARK_WIDTH],
    [cx, maxZ, w, MARK_WIDTH],
    [minX, cz, MARK_WIDTH, d],
    [maxX, cz, MARK_WIDTH, d],
  ]
  return (
    <group>
      {segs.map(([x, z, sw, sd], i) => (
        <mesh key={i} position={[x, 0.006 + lift, z]} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[sw, sd]} />
          <meshStandardMaterial color={tint} roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

function Floor({ width, depth }: { width: number; depth: number }) {
  const pbr = usePbr('smooth_concrete_floor', [width / 6, depth / 6])
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[width, depth]} />
        {/* 環氧地坪：以灰色為底色，只取貼圖的法線／粗糙度／AO 細節 */}
        <meshStandardMaterial normalMap={pbr.normalMap} roughnessMap={pbr.roughnessMap} aoMap={pbr.aoMap} color={color.floorTint} metalness={0} />
      </mesh>
      {/* 廠外地坪：避免鏡頭看到建築外的空白 */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01} receiveShadow>
        <planeGeometry args={[width * 6, depth * 8]} />
        <meshStandardMaterial color={color.apron} roughness={0.95} />
      </mesh>
    </group>
  )
}

function Walls({ width, depth, height }: { width: number; depth: number; height: number }) {
  // 夾心板牆（程式紋理）：浪板貼圖在鏡頭移動時造成約 2/3 的閃爍像素（實測 4.8% → 對照純色 1.7%）
  const back = usePanelWall(width, height)
  const side = usePanelWall(depth, height)
  // 剖面視角：保留後牆與兩側牆，前牆與屋頂板省略，讓鏡頭看得見內部
  return (
    <group>
      <mesh position={[0, height / 2, -depth / 2 - WALL_THICKNESS / 2]} receiveShadow castShadow>
        <boxGeometry args={[width + WALL_THICKNESS * 2, height, WALL_THICKNESS]} />
        <meshStandardMaterial map={back} roughness={0.55} metalness={0.2} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (width / 2 + WALL_THICKNESS / 2), height / 2, 0]} receiveShadow castShadow>
          <boxGeometry args={[WALL_THICKNESS, height, depth]} />
          <meshStandardMaterial map={side} roughness={0.55} metalness={0.2} />
        </mesh>
      ))}
    </group>
  )
}

function Structure({ width, depth, height }: { width: number; depth: number; height: number }) {
  const columns = useMemo(() => {
    const xs: number[] = []
    for (let x = -width / 2; x <= width / 2 + 1e-6; x += COLUMN_SPACING) xs.push(x)
    return xs
  }, [width])
  const beamMat = useMemo(() => new THREE.MeshStandardMaterial({ color: color.roofBeam, metalness: 0.7, roughness: 0.45 }), [])
  const yellow = useMemo(() => new THREE.MeshStandardMaterial({ color: color.safetyYellow, roughness: 0.5 }), [])
  return (
    <group>
      {columns.map((x) => (
        <group key={x}>
          {/* 後牆柱 + 防撞護欄底座 */}
          <mesh position={[x, height / 2, -depth / 2 + 0.2]} material={beamMat} castShadow receiveShadow>
            <boxGeometry args={[0.35, height, 0.35]} />
          </mesh>
          <mesh position={[x, 0.5, -depth / 2 + 0.2]} material={yellow} castShadow>
            <boxGeometry args={[0.42, 1, 0.42]} />
          </mesh>
          {/* 屋頂桁架 */}
          <mesh position={[x, height - 0.21, 0]} material={beamMat} castShadow>
            <boxGeometry args={[0.2, 0.42, depth]} />
          </mesh>
          <mesh position={[x, height - 0.8, 0]} material={beamMat} castShadow>
            <boxGeometry args={[0.12, 0.12, depth]} />
          </mesh>
        </group>
      ))}
      {/* 縱向檁條 */}
      {[-depth / 3, 0, depth / 3].map((z) => (
        <mesh key={z} position={[0, height - 0.05, z]} material={beamMat} castShadow>
          <boxGeometry args={[width, 0.18, 0.18]} />
        </mesh>
      ))}
      {/* 天窗燈帶（自發光，搭配 Bloom） */}
      {[-depth / 6, depth / 6].map((z) => (
        <mesh key={z} position={[0, height - 0.95, z]}>
          <boxGeometry args={[width - 2, 0.06, 0.5]} />
          <meshStandardMaterial color={color.skylight} emissive={color.skylight} emissiveIntensity={light.skylightIntensity} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

export function Building({ site, placed }: { site: Site; placed: PlacedEquipment[] }) {
  const { width, depth, height } = site.bounds
  // 區域外框由領域層計算（3D 地面標線與 2D 平面圖共用同一份規則）
  const outlines = useMemo(() => areaBounds(placed), [placed])
  return (
    <group userData={{ building: true }}>
      <Floor width={width} depth={depth} />
      <Walls width={width} depth={depth} height={height} />
      <Structure width={width} depth={depth} height={height} />
      {outlines.map((o, i) => (
        <Outline key={o.area} {...o} lift={i * 0.002} tint={i % 2 === 0 ? color.walkwayGreen : color.safetyYellow} />
      ))}
    </group>
  )
}
