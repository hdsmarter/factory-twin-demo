import { useMemo } from 'react'
import * as THREE from 'three'
import { color } from '../../theme/tokens'
import { FittedModel } from '../FittedModel'
import type { StorageVariant } from '../../domain/layout'
import { PALLET_TOP as PALLET_HEIGHT, WORKPIECE_HEIGHT } from '../../domain/specs'
import type { EquipmentViewProps } from './registry'
import { Workpiece } from './Workpiece'

function Pallet({ width, depth }: { width: number; depth: number }) {
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: color.palletWood, roughness: 0.85 }), [])
  const slats = 5
  return (
    <group>
      {[-1, 0, 1].map((i) => (
        <mesh key={`b${i}`} position={[0, 0.05, (i * (depth - 0.1)) / 2]} material={wood} castShadow receiveShadow>
          <boxGeometry args={[width, 0.1, 0.1]} />
        </mesh>
      ))}
      {Array.from({ length: slats }, (_, i) => (
        <mesh key={`s${i}`} position={[-width / 2 + 0.06 + (i * (width - 0.12)) / (slats - 1), 0.125, 0]} material={wood} castShadow receiveShadow>
          <boxGeometry args={[0.12, 0.025, depth]} />
        </mesh>
      ))}
    </group>
  )
}

/** 成品棧板：上面已堆好一批完成品（展示用的靜態庫存）。 */
function PalletStation({ placed }: EquipmentViewProps) {
  const { width, depth } = placed.equipment.footprint
  const stack = useMemo(() => {
    const out: [number, number, number][] = []
    for (let layer = 0; layer < 2; layer++)
      for (const x of [-0.3, 0.3]) for (const z of [-0.22, 0.22]) out.push([x, PALLET_HEIGHT + layer * WORKPIECE_HEIGHT, z])
    return out
  }, [])
  return (
    <group>
      <Pallet width={width} depth={depth} />
      {stack.map((p, i) => (
        <Workpiece key={i} position={p} />
      ))}
    </group>
  )
}

/** Poly Haven worn_metal_rack 的實測尺寸（公尺）：寬 0.92、高 1.90 */
const RACK_UNIT = { width: 0.92, height: 1.9 }
const TOP_STOCK = ['cardboard_box_01', 'plastic_crate_01', 'wooden_crate_01'] as const

/** 依佔地寬度並排原尺寸料架（不放大變形），頂層擺放庫存箱。 */
function Rack({ placed }: EquipmentViewProps) {
  const { width } = placed.equipment.footprint
  const count = Math.max(1, Math.floor(width / RACK_UNIT.width))
  const xs = Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * RACK_UNIT.width)
  return (
    <group>
      {xs.map((x, i) => (
        <group key={x} position-x={x}>
          <FittedModel model="worn_metal_rack" />
          <FittedModel model={TOP_STOCK[i % TOP_STOCK.length]!} position-y={RACK_UNIT.height} rotation-y={(i % 2) * 0.3} />
        </group>
      ))}
    </group>
  )
}

const variants: { [V in StorageVariant]: (p: EquipmentViewProps) => React.JSX.Element } = { rack: Rack, pallet: PalletStation }

export function Storage(props: EquipmentViewProps) {
  const View = variants[props.placed.variant as StorageVariant]
  return <View {...props} />
}
