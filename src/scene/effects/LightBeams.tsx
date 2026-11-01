import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Site } from '../../domain/layout'
import { beams } from '../../theme/actorTokens'
import { useFrameRef } from '../Factory'

/** 天窗燈帶在屋頂下的高度差（與 Building.tsx 燈帶位置一致：height - 1） */
const SKYLIGHT_DROP = 1
/** 太陽太低時限制傾斜，避免光束躺平 */
const MIN_SUN_Y = 0.2
const RADIAL_SEGMENTS = 24

/** 光束頂點位置（天窗燈帶下方，沿 x 等距排列）；粉塵也依此分布。 */
export function beamAnchors(site: Site): { x: number; z: number }[] {
  const { width, depth } = site.bounds
  const usable = width - 2
  const n = Math.max(1, Math.floor(usable / beams.spacing))
  const start = -((n - 1) * beams.spacing) / 2
  return [-depth / 6, depth / 6].flatMap((z) => Array.from({ length: n }, (_, i) => ({ x: start + i * beams.spacing, z })))
}

const vertexShader = /* glsl */ `
  varying float vH;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vH = uv.y;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uSoft;
  varying float vH;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    // 掠射角（輪廓邊緣）淡出 → 柔邊；由上而下漸淡、頂端也稍微收邊避免硬切
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    float edge = smoothstep(0.0, uSoft, facing);
    float fade = vH * vH * smoothstep(1.0, 0.94, vH);
    gl_FragColor = vec4(uColor, uIntensity * edge * fade);
  }
`

/** 天窗光束：加法混合的柔邊光錐（上窄下寬），依太陽方向微傾斜。必須放在 <Factory> 內。 */
export function LightBeams({ site }: { site: Site }) {
  const frame = useFrameRef()
  const length = site.bounds.height - SKYLIGHT_DROP
  const anchors = useMemo(() => beamAnchors(site), [site])
  const pivots = useRef<(THREE.Group | null)[]>([])

  const geometry = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.5, 0.5 * beams.spread, length, RADIAL_SEGMENTS, 1, true)
    g.scale(beams.topWidth, 1, beams.topDepth)
    g.translate(0, -length / 2, 0)
    return g
  }, [length])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uColor: { value: new THREE.Color(beams.color) },
          uIntensity: { value: beams.intensity },
          uSoft: { value: beams.edgeSoftness },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  )
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame(() => {
    const sun = frame.current.state.environment?.sun.direction
    // 光線行進方向 = -sun；底端相對頂端的水平位移比例
    const k = sun ? beams.sunTilt / Math.max(sun.y, MIN_SUN_Y) : 0
    const rz = Math.atan(-(sun?.x ?? 0) * k)
    const rx = Math.atan((sun?.z ?? 0) * k)
    for (const p of pivots.current) p?.rotation.set(rx, 0, rz)
  })

  return (
    <group userData={{ envPart: 'beams' }}>
      {anchors.map((a, i) => (
        <group
          key={`${a.x},${a.z}`}
          position={[a.x, length, a.z]}
          ref={(g) => {
            pivots.current[i] = g
          }}
        >
          <mesh geometry={geometry} material={material} renderOrder={1} />
        </group>
      ))}
    </group>
  )
}
