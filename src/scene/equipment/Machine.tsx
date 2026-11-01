import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { color } from '../../theme/tokens'
import { useEquipmentState } from '../Factory'
import { usePbr } from '../materials'
import type { MachineVariant } from '../../domain/layout'
import { CONVEYOR_BELT_TOP as BELT_TOP } from '../../domain/specs'
import type { EquipmentViewProps } from './registry'

const CNC_HEIGHT = 2.1

function useMachineMaterials() {
  return useMemo(
    () => ({
      shell: new THREE.MeshStandardMaterial({ color: color.machineShell, metalness: 0.2, roughness: 0.35 }),
      dark: new THREE.MeshStandardMaterial({ color: color.machineDark, metalness: 0.5, roughness: 0.45 }),
      accent: new THREE.MeshStandardMaterial({ color: color.machineAccent, metalness: 0.35, roughness: 0.4 }),
      glass: new THREE.MeshStandardMaterial({ color: color.glass, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.28 }),
      steel: new THREE.MeshStandardMaterial({ color: color.steel, metalness: 0.9, roughness: 0.25 }),
    }),
    [],
  )
}

/** 狀態燈塔（綠燈亮度隨 activity 脈動） */
function StatusTower({ getActivity, ...props }: { getActivity: () => number | undefined } & { position: [number, number, number] }) {
  const green = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(() => {
    const a = getActivity()
    if (green.current && a !== undefined) green.current.emissiveIntensity = 1.5 + 3 * a
  })
  return (
    <group {...props}>
      <mesh position-y={0.15}>
        <cylinderGeometry args={[0.025, 0.025, 0.3, 12]} />
        <meshStandardMaterial color={color.steelDark} />
      </mesh>
      <mesh position-y={0.36}>
        <cylinderGeometry args={[0.055, 0.055, 0.12, 20]} />
        <meshStandardMaterial ref={green} color={color.statusGreen} emissive={color.statusGreen} emissiveIntensity={2} toneMapped={false} />
      </mesh>
      <mesh position-y={0.48}>
        <cylinderGeometry args={[0.055, 0.055, 0.12, 20]} />
        <meshStandardMaterial color={color.safetyYellow} emissive={color.safetyYellow} emissiveIntensity={0.08} />
      </mesh>
    </group>
  )
}

function Cnc({ placed }: EquipmentViewProps) {
  const { width, depth } = placed.equipment.footprint
  const getState = useEquipmentState(placed.equipment.id, 'machine')
  const m = useMachineMaterials()
  const panel = usePbr('blue_metal_plate', [1, 1])
  const spindle = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const s = getState()
    if (s && spindle.current) spindle.current.rotation.y = s.spindle
  })
  return (
    <group>
      {/* 底座 */}
      <mesh position-y={0.25} material={m.dark} castShadow receiveShadow>
        <boxGeometry args={[width, 0.5, depth]} />
      </mesh>
      {/* 機殼（後半實體 + 前方視窗） */}
      <mesh position={[0, 0.5 + (CNC_HEIGHT - 0.5) / 2, -depth * 0.15]} material={m.shell} castShadow receiveShadow>
        <boxGeometry args={[width, CNC_HEIGHT - 0.5, depth * 0.7]} />
      </mesh>
      <mesh position={[0, 0.5 + (CNC_HEIGHT - 0.5) / 2, depth * 0.35]} material={m.glass}>
        <boxGeometry args={[width * 0.62, (CNC_HEIGHT - 0.5) * 0.7, 0.02]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * width * 0.405, 0.5 + (CNC_HEIGHT - 0.5) / 2, depth * 0.27]} material={m.shell} castShadow>
          <boxGeometry args={[width * 0.19, CNC_HEIGHT - 0.5, depth * 0.16]} />
        </mesh>
      ))}
      <mesh position={[0, CNC_HEIGHT - 0.12, depth * 0.27 + 0.005]} material={m.accent} castShadow>
        {/* +5 mm：避免與側柱前面共面造成 z-fighting */}
        <boxGeometry args={[width + 0.01, 0.24, depth * 0.16]} />
      </mesh>
      {/* 主軸（透過視窗可見） */}
      <mesh ref={spindle} position={[0, 1.25, depth * 0.12]} material={m.steel} castShadow>
        <cylinderGeometry args={[0.09, 0.05, 0.5, 6]} />
      </mesh>
      {/* 操作面板 */}
      <mesh position={[width / 2 + 0.12, 1.3, depth * 0.2]} castShadow>
        <boxGeometry args={[0.2, 0.7, 0.5]} />
        <meshStandardMaterial {...panel} />
      </mesh>
      <mesh position={[width / 2 + 0.225, 1.38, depth * 0.2]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[0.38, 0.26]} />
        <meshStandardMaterial color={color.inspectionLight} emissive={color.inspectionLight} emissiveIntensity={0.9} toneMapped={false} />
      </mesh>
      <StatusTower position={[width / 2 - 0.2, CNC_HEIGHT, -depth / 2 + 0.2]} getActivity={() => getState()?.activity} />
    </group>
  )
}

function Inspection({ placed }: EquipmentViewProps) {
  const { width, depth } = placed.equipment.footprint
  const getState = useEquipmentState(placed.equipment.id, 'machine')
  const m = useMachineMaterials()
  const beam = useRef<THREE.MeshStandardMaterial>(null)
  const scanner = useRef<THREE.Group>(null)
  const top = 2.0
  useFrame(() => {
    const s = getState()
    if (!s) return
    if (beam.current) beam.current.emissiveIntensity = 1 + 4 * s.activity
    if (scanner.current) scanner.current.position.x = (s.activity - 0.5) * width * 0.5
  })
  return (
    <group>
      {/* 門型框架跨過輸送帶 */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, top / 2, s * (depth / 2 - 0.08)]} material={m.shell} castShadow receiveShadow>
          <boxGeometry args={[0.22, top, 0.16]} />
        </mesh>
      ))}
      <mesh position={[0, top, 0]} material={m.accent} castShadow>
        <boxGeometry args={[0.5, 0.28, depth]} />
      </mesh>
      {/* 側邊遮光罩 */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.3, top - 0.45, 0]} material={m.dark} castShadow>
          <boxGeometry args={[0.03, 0.6, depth - 0.3]} />
        </mesh>
      ))}
      {/* 掃描頭 + 光條 */}
      <group ref={scanner}>
        <mesh position={[0, top - 0.25, 0]} material={m.dark} castShadow>
          <boxGeometry args={[0.18, 0.2, 0.3]} />
        </mesh>
        <mesh position={[0, top - 0.36, 0]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.05, 0.05, 0.04, 20]} />
          <meshStandardMaterial color={color.machineDark} metalness={0.2} roughness={0.05} />
        </mesh>
      </group>
      <mesh position={[0, BELT_TOP + 0.45, 0]}>
        <boxGeometry args={[0.04, 0.02, depth - 0.4]} />
        <meshStandardMaterial ref={beam} color={color.inspectionLight} emissive={color.inspectionLight} emissiveIntensity={2} toneMapped={false} />
      </mesh>
      <StatusTower position={[0, top + 0.14, -depth / 2 + 0.15]} getActivity={() => getState()?.activity} />
    </group>
  )
}

const variants: { [V in MachineVariant]: (p: EquipmentViewProps) => React.JSX.Element } = { cnc: Cnc, inspection: Inspection }

export function Machine(props: EquipmentViewProps) {
  const View = variants[props.placed.variant as MachineVariant]
  return <View {...props} />
}
