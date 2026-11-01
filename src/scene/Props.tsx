import { FittedModel } from './FittedModel'

/** 裝飾道具（Poly Haven CC0，原始尺寸）。純場景點綴，不屬於產線配置領域。 */
const PROPS: ReadonlyArray<{ id: string; position: [number, number, number]; rotationY?: number }> = [
  { id: 'tool_cart', position: [-13.6, 0, -0.4], rotationY: Math.PI / 2 },
  { id: 'metal_toolbox', position: [-13.6, 0.96, -0.4], rotationY: 0.4 },
  { id: 'industrial_storage_cart', position: [-15.5, 0, 2.8], rotationY: 0.2 },
  { id: 'korean_fire_extinguisher_01', position: [-17.4, 0, -6], rotationY: Math.PI / 2 },
  { id: 'korean_fire_extinguisher_01', position: [17.4, 0, -6], rotationY: -Math.PI / 2 },
  { id: 'korean_fire_extinguisher_01', position: [5.8, 0, -9.4] },
  { id: 'power_box_01', position: [-3, 1.4, -9.8] },
  { id: 'power_box_01', position: [9, 1.4, -9.8] },
  { id: 'wooden_crate_01', position: [15.5, 0, 4.5], rotationY: 0.3 },
  { id: 'wooden_crate_01', position: [15.6, 0.35, 4.4], rotationY: 0.1 },
  { id: 'wooden_crate_01', position: [14.4, 0, 5.6], rotationY: -0.4 },
  { id: 'plastic_crate_01', position: [9.4, 0, -0.6], rotationY: 0.2 },
  { id: 'plastic_crate_01', position: [9.4, 0.26, -0.6], rotationY: 0.25 },
  { id: 'cardboard_box_01', position: [-14.2, 0, 1.6], rotationY: 0.6 },
  { id: 'cardboard_box_01', position: [-14.6, 0, 2.2], rotationY: 0.1 },
]

export function Props() {
  return (
    <group>
      {PROPS.map((p, i) => (
        <FittedModel key={i} model={p.id} position={p.position} rotation-y={p.rotationY ?? 0} />
      ))}
    </group>
  )
}
