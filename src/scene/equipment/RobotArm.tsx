import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ARM_6AX_DIMENSIONS as D } from '../../domain/motion/robotArm'
import { color } from '../../theme/tokens'
import { useEquipmentState } from '../Factory'
import type { EquipmentViewProps } from './registry'
import { WORKPIECE_HEIGHT } from '../../domain/specs'
import { Workpiece } from './Workpiece'

const DEG = Math.PI / 180
const LINK = 0.2
const FINGER_OPEN = 0.1
const FINGER_CLOSED = 0.045

/** 機械手臂：關節階層與領域層 forwardTool 的運動學一致（base=Y 軸，其餘繞本地 Z 軸俯仰，連桿沿本地 +X）。 */
export function RobotArm({ placed }: EquipmentViewProps) {
  const getState = useEquipmentState(placed.equipment.id, 'robot-arm')
  const mountYaw = placed.equipment.footprint.rotation * DEG
  const base = useRef<THREE.Group>(null)
  const shoulder = useRef<THREE.Group>(null)
  const elbow = useRef<THREE.Group>(null)
  const wrist = useRef<THREE.Group>(null)
  const fingers = useRef<(THREE.Mesh | null)[]>([])
  const carried = useRef<THREE.Group>(null)

  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: color.robotBody, metalness: 0.25, roughness: 0.38 }), [])
  const joint = useMemo(() => new THREE.MeshStandardMaterial({ color: color.robotJoint, metalness: 0.6, roughness: 0.4 }), [])
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: color.steel, metalness: 0.9, roughness: 0.3 }), [])

  useFrame(() => {
    const s = getState()
    if (!s || !base.current || !shoulder.current || !elbow.current || !wrist.current) return
    const p = s.pose
    base.current.rotation.y = p.base - mountYaw
    shoulder.current.rotation.z = p.shoulder
    elbow.current.rotation.z = p.elbow
    wrist.current.rotation.z = p.wrist
    const gap = FINGER_OPEN + (FINGER_CLOSED - FINGER_OPEN) * p.grip
    fingers.current.forEach((f, i) => f && (f.position.z = (i === 0 ? -1 : 1) * gap))
    if (carried.current) carried.current.visible = p.carrying
  })

  return (
    <group>
      {/* 底座 */}
      <mesh position-y={0.1} material={joint} castShadow receiveShadow>
        <cylinderGeometry args={[0.36, 0.4, 0.2, 40]} />
      </mesh>
      <group ref={base}>
        <mesh position-y={0.42} material={body} castShadow>
          <cylinderGeometry args={[0.26, 0.3, 0.44, 40]} />
        </mesh>
        <group ref={shoulder} position-y={D.shoulderHeight}>
          <mesh rotation-x={Math.PI / 2} material={joint} castShadow>
            <cylinderGeometry args={[0.17, 0.17, 0.36, 32]} />
          </mesh>
          {/* 上臂 */}
          <mesh position-x={D.upperArm / 2} material={body} castShadow>
            <boxGeometry args={[D.upperArm, LINK, LINK * 0.9]} />
          </mesh>
          <group ref={elbow} position-x={D.upperArm}>
            <mesh rotation-x={Math.PI / 2} material={joint} castShadow>
              <cylinderGeometry args={[0.13, 0.13, 0.3, 32]} />
            </mesh>
            {/* 前臂 */}
            <mesh position-x={D.forearm / 2} material={body} castShadow>
              <boxGeometry args={[D.forearm, LINK * 0.75, LINK * 0.7]} />
            </mesh>
            <group ref={wrist} position-x={D.forearm}>
              <mesh rotation-x={Math.PI / 2} material={joint} castShadow>
                <cylinderGeometry args={[0.08, 0.08, 0.2, 24]} />
              </mesh>
              {/* 法蘭 + 夾爪本體（沿本地 +X 指向工具尖端） */}
              <mesh position-x={0.1} rotation-z={Math.PI / 2} material={steel} castShadow>
                <cylinderGeometry args={[0.06, 0.06, 0.12, 24]} />
              </mesh>
              <mesh position-x={0.2} material={joint} castShadow>
                <boxGeometry args={[0.1, 0.12, 0.26]} />
              </mesh>
              {[0, 1].map((i) => (
                <mesh key={i} ref={(m: THREE.Mesh | null) => void (fingers.current[i] = m)} position={[D.tool - 0.06, 0, 0]} material={steel} castShadow>
                  <boxGeometry args={[0.12, 0.08, 0.02]} />
                </mesh>
              ))}
              {/* 夾持中的料件：工具尖端在本地 x = D.tool；料件底面朝下 → 繞 Z 旋轉讓料件「直立」 */}
              <group ref={carried} position-x={D.tool + WORKPIECE_HEIGHT / 2 - 0.03} rotation-z={Math.PI / 2} visible={false}>
                <Workpiece position-y={-WORKPIECE_HEIGHT / 2} />
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}
