import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CONVEYOR_BELT_TOP as BELT_TOP, DEFAULT_CONVEYOR_ITEMS } from '../../domain/specs'
import { color } from '../../theme/tokens'
import { useEquipmentState } from '../Factory'
import { usePbr } from '../materials'
import type { EquipmentViewProps } from './registry'
import { Workpiece } from './Workpiece'

const LEG_SPACING = 1.6
const ROLLER_RADIUS = 0.07
const RAIL_HEIGHT = 0.08

export function Conveyor({ placed }: EquipmentViewProps) {
  const { width: length, depth: width } = placed.equipment.footprint
  const itemCount = placed.equipment.params?.itemCount ?? DEFAULT_CONVEYOR_ITEMS
  // 貼圖沿長度鋪整數片，週期結束時位移恰為整數片 → 無接縫跳動
  // 每 2 m 一片，降低捲動時的高頻摩爾紋
  const tiles = Math.max(1, Math.round(length / 2))
  const getState = useEquipmentState(placed.equipment.id, 'conveyor')
  const belt = usePbr('rubberized_track', [tiles, 1])
  const items = useRef<(THREE.Group | null)[]>([])

  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: color.steel, metalness: 0.85, roughness: 0.35 }), [])
  const steelDark = useMemo(() => new THREE.MeshStandardMaterial({ color: color.steelDark, metalness: 0.6, roughness: 0.5 }), [])
  const accent = useMemo(() => new THREE.MeshStandardMaterial({ color: color.machineAccent, metalness: 0.4, roughness: 0.45 }), [])
  const legXs = useMemo(() => {
    const n = Math.max(2, Math.round(length / LEG_SPACING) + 1)
    return Array.from({ length: n }, (_, i) => -length / 2 + 0.15 + (i * (length - 0.3)) / (n - 1))
  }, [length])

  useFrame(() => {
    const s = getState()
    if (!s) return
    belt.normalMap.offset.x = belt.roughnessMap.offset.x = -((s.beltOffset / length) * tiles % 1)
    s.items.forEach((it) => {
      const g = items.current[it.index]
      if (g) g.position.set(it.s - length / 2, BELT_TOP, 0)
    })
  })

  return (
    <group>
      {/* 皮帶 */}
      <mesh position={[0, BELT_TOP - 0.015, 0]} receiveShadow castShadow>
        <boxGeometry args={[length, 0.03, width - 0.14]} />
        {/* 捲動的皮帶只用法線與粗糙度細節：花紋貼圖在移動時會閃爍（實測） */}
        <meshStandardMaterial normalMap={belt.normalMap} normalScale={[0.6, 0.6]} roughnessMap={belt.roughnessMap} color={color.beltTint} metalness={0} roughness={0.85} />
      </mesh>
      {/* 機架側板 */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[0, BELT_TOP - 0.1, side * (width / 2 - 0.04)]} material={accent} castShadow receiveShadow>
            <boxGeometry args={[length, 0.2, 0.08]} />
          </mesh>
          <mesh position={[0, BELT_TOP + RAIL_HEIGHT / 2 + 0.02, side * (width / 2 - 0.02)]} material={steel} castShadow>
            <boxGeometry args={[length, RAIL_HEIGHT, 0.03]} />
          </mesh>
        </group>
      ))}
      {/* 端部滾筒 */}
      {[-1, 1].map((end) => (
        <mesh key={end} position={[end * (length / 2), BELT_TOP - ROLLER_RADIUS, 0]} rotation-x={Math.PI / 2} material={steel} castShadow>
          <cylinderGeometry args={[ROLLER_RADIUS, ROLLER_RADIUS, width - 0.1, 24]} />
        </mesh>
      ))}
      {/* 腳架 */}
      {legXs.map((x) => (
        <group key={x}>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[x, (BELT_TOP - 0.2) / 2, side * (width / 2 - 0.08)]} material={steelDark} castShadow receiveShadow>
              <boxGeometry args={[0.07, BELT_TOP - 0.2, 0.07]} />
            </mesh>
          ))}
          <mesh position={[x, 0.18, 0]} material={steelDark} castShadow>
            <boxGeometry args={[0.05, 0.05, width - 0.16]} />
          </mesh>
        </group>
      ))}
      {/* 料件 */}
      {Array.from({ length: itemCount }, (_, i) => (
        <Workpiece key={i} ref={(g: THREE.Group | null) => void (items.current[i] = g)} position={[0, BELT_TOP, 0]} />
      ))}
    </group>
  )
}
