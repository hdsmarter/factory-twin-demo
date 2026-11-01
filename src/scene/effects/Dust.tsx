import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { Site } from '../../domain/layout'
import { scenePeriod } from '../../domain/simulate'
import { dust } from '../../theme/actorTokens'
import { useFrameRef } from '../Factory'
import { beamAnchors } from './LightBeams'

/** 決定性 PRNG（mulberry32）：同一個種子永遠得到同一串數字 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MARGIN = 0.5
const TAU = Math.PI * 2

const vertexShader = /* glsl */ `
  attribute vec4 aPhase;
  uniform float uTime;
  uniform float uOmega;
  uniform float uAmplitude;
  uniform float uSize;
  uniform float uScale;
  void main() {
    // 位置是 t 的函數：基準點 + 緩慢正弦漂浮（aPhase.w = 個別振幅比例）
    vec3 drift = sin(uTime * uOmega + aPhase.xyz) * uAmplitude * aPhase.w;
    vec4 mv = modelViewMatrix * vec4(position + drift, 1.0);
    gl_PointSize = uSize * uScale / max(-mv.z, 0.001);
    gl_Position = projectionMatrix * mv;
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColor, uOpacity * a * a);
  }
`

/** 粉塵：種子化分布在廠房體積內（光束附近較密），隨 t 緩慢漂浮。必須放在 <Factory> 內。 */
export function Dust({ site }: { site: Site }) {
  const frame = useFrameRef()
  const viewHeight = useThree((s) => s.size.height)
  const dpr = useThree((s) => s.viewport.dpr)

  const geometry = useMemo(() => {
    const { width, depth, height } = site.bounds
    const rand = mulberry32(dust.seed)
    const anchors = beamAnchors(site)
    const base = new Float32Array(dust.count * 3)
    const phase = new Float32Array(dust.count * 4)
    for (let i = 0; i < dust.count; i++) {
      const anchor = rand() < dust.nearBeamRatio ? anchors[Math.floor(rand() * anchors.length)] : undefined
      const x = anchor ? anchor.x + (rand() - 0.5) * 2 * dust.nearBeamSpread : (rand() - 0.5) * (width - 2 * MARGIN)
      const z = anchor ? anchor.z + (rand() - 0.5) * 2 * dust.nearBeamSpread : (rand() - 0.5) * (depth - 2 * MARGIN)
      const y = MARGIN / 2 + rand() * (height - 2 * MARGIN)
      base.set([x, y, z], i * 3)
      phase.set([rand() * TAU, rand() * TAU, rand() * TAU, 0.4 + rand() * 0.6], i * 4)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(base, 3))
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 4))
    return g
  }, [site])

  // 漂浮頻率取整個畫面循環週期的整數倍，循環接縫處位置連續
  const omega = useMemo(() => {
    const period = scenePeriod(site)
    return (TAU * Math.max(1, Math.round(dust.frequency * period))) / period
  }, [site])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uOmega: { value: 0 },
          uAmplitude: { value: dust.amplitude },
          uSize: { value: dust.size },
          uScale: { value: 1 },
          uColor: { value: new THREE.Color(dust.color) },
          uOpacity: { value: dust.opacity },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
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
    const u = material.uniforms
    u.uTime!.value = frame.current.t
    u.uOmega!.value = omega
    // 與 PointsMaterial 的 sizeAttenuation 相同換算：世界尺寸 → 像素
    u.uScale!.value = (viewHeight * dpr) / 2
  })

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={2} userData={{ envPart: 'dust' }} />
}
