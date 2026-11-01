import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { agv } from '../../theme/actorTokens'
import { useFrameRef } from '../Factory'
import type { ActorViewProps } from './index'

const CLEARANCE = agv.wheelRadius / 2
const WHEEL_INSET = agv.wheelRadius * 2

/** 潛伏式 AGV（程式建模，+x 為前方）：機身、輪子、前方雷射掃描頭、側邊狀態燈條。 */
export function Agv({ actor }: ActorViewProps) {
  const frame = useFrameRef()
  const root = useRef<THREE.Group>(null)
  const { length, width, height } = agv
  const top = CLEARANCE + height

  const mats = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({ color: agv.color.body, roughness: 0.45, metalness: 0.15 }),
      bumper: new THREE.MeshStandardMaterial({ color: agv.color.bumper, roughness: 0.7 }),
      wheel: new THREE.MeshStandardMaterial({ color: agv.color.wheel, roughness: 0.9 }),
      scanner: new THREE.MeshStandardMaterial({ color: agv.color.scanner, roughness: 0.4, metalness: 0.3 }),
      light: new THREE.MeshStandardMaterial({ color: agv.color.lightMove, emissive: agv.color.lightMove, emissiveIntensity: agv.lightIntensity, toneMapped: false }),
      pallet: new THREE.MeshStandardMaterial({ color: agv.color.pallet, roughness: 0.85 }),
      cargo: new THREE.MeshStandardMaterial({ color: agv.color.cargo, roughness: 0.6 }),
    }),
    [],
  )
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])

  const lightColors = useMemo(() => ({ move: new THREE.Color(agv.color.lightMove), dock: new THREE.Color(agv.color.lightDock) }), [])

  useFrame(() => {
    const g = root.current
    const pose = frame.current.state.actors[actor.id]
    if (!g || !pose) return
    g.position.set(pose.x, 0, pose.z)
    g.rotation.y = pose.heading
    const c = pose.action === 'dock' ? lightColors.dock : lightColors.move
    mats.light.color.copy(c)
    mats.light.emissive.copy(c)
  })

  const wheels: [number, number][] = [-1, 1].flatMap((sx) => [-1, 1].map((sz): [number, number] => [sx * (length / 2 - WHEEL_INSET), sz * (width / 2 - agv.wheelWidth)]))
  const carrying = agv.carrierIds.includes(actor.id)

  return (
    <group ref={root}>
      <mesh position-y={CLEARANCE + height / 2} material={mats.body} castShadow receiveShadow>
        <boxGeometry args={[length, height, width]} />
      </mesh>
      {/* 前後防撞條 */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (length / 2), CLEARANCE + height * 0.3, 0]} material={mats.bumper} castShadow>
          <boxGeometry args={[agv.wheelWidth, height * 0.4, width * 0.96]} />
        </mesh>
      ))}
      {wheels.map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, agv.wheelRadius, z]} rotation-x={Math.PI / 2} material={mats.wheel} castShadow>
          <cylinderGeometry args={[agv.wheelRadius, agv.wheelRadius, agv.wheelWidth, 16]} />
        </mesh>
      ))}
      {/* 前方雷射掃描頭 */}
      <mesh position={[length / 2 - agv.scannerRadius * 1.5, top + agv.scannerHeight / 2, 0]} material={mats.scanner} castShadow>
        <cylinderGeometry args={[agv.scannerRadius, agv.scannerRadius, agv.scannerHeight, 20]} />
      </mesh>
      {/* 側邊狀態燈條：move 綠、dock 藍 */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, top - agv.lightStripHeight * 1.5, s * (width / 2 + 0.002)]} material={mats.light}>
          <boxGeometry args={[length * 0.7, agv.lightStripHeight, 0.004]} />
        </mesh>
      ))}
      {carrying && (
        <group position-y={top}>
          <mesh position={[-agv.scannerRadius * 2, agv.palletHeight / 2, 0]} material={mats.pallet} castShadow receiveShadow>
            <boxGeometry args={[length * 0.75, agv.palletHeight, width * 0.95]} />
          </mesh>
          <mesh position={[-agv.scannerRadius * 2, agv.palletHeight + agv.cargoSize / 2, 0]} material={mats.cargo} castShadow receiveShadow>
            <boxGeometry args={[agv.cargoSize, agv.cargoSize, agv.cargoSize]} />
          </mesh>
        </group>
      )}
    </group>
  )
}
