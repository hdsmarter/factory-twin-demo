import type { ThreeElements } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { WORKPIECE_HEIGHT } from '../../domain/specs'
import { color } from '../../theme/tokens'

/** 共用料件外觀：機加工鋁件（底座 + 凸台）。原點在料件底面中心，總高 = WORKPIECE_HEIGHT（領域規格）。 */

const BASE_H = WORKPIECE_HEIGHT * 0.57
const BOSS_H = WORKPIECE_HEIGHT - BASE_H
const base = new THREE.BoxGeometry(0.32, BASE_H, 0.24)
const boss = new THREE.CylinderGeometry(0.07, 0.07, BOSS_H, 24)

export function Workpiece(props: ThreeElements['group']) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: color.workpiece, metalness: 0.9, roughness: 0.28 }), [])
  return (
    <group {...props}>
      <mesh geometry={base} material={mat} position-y={BASE_H / 2} castShadow receiveShadow />
      <mesh geometry={boss} material={mat} position-y={BASE_H + BOSS_H / 2} castShadow />
    </group>
  )
}
