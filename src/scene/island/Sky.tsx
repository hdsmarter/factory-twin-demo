import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Sky as SkyMesh } from 'three/examples/jsm/objects/Sky.js'
import { light } from '../../theme/tokens'
import { sky as tokens, sunLight } from '../../theme/islandTokens'
import { useFrameRef } from '../Factory'

const smooth = (e0: number, e1: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return u * u * (3 - 2 * u)
}

/** Preetham 天空：太陽位置每幀取自模擬狀態（sunAt），雲層以模擬秒數推進。 */
export function Sky() {
  const frame = useFrameRef()
  const mesh = useMemo(() => {
    const s = new SkyMesh()
    s.scale.setScalar(tokens.scale)
    s.frustumCulled = false
    const u = s.material.uniforms
    u.turbidity!.value = tokens.turbidity
    u.rayleigh!.value = tokens.rayleigh
    u.mieCoefficient!.value = tokens.mieCoefficient
    u.mieDirectionalG!.value = tokens.mieDirectionalG
    // 天空輸出為 HDR 輻射亮度，直接進後處理會觸發整片泛光、色調映射後偏白（實測）→ 乘上曝光係數
    s.material.uniforms.skyExposure = { value: tokens.exposure }
    s.material.fragmentShader = s.material.fragmentShader
      .replace('uniform float time;', 'uniform float time;\nuniform float skyExposure;')
      .replace('gl_FragColor = vec4( texColor, 1.0 );', 'gl_FragColor = vec4( texColor * skyExposure, 1.0 );')
    return s
  }, [])
  useEffect(() => () => {
    mesh.geometry.dispose()
    mesh.material.dispose()
  }, [mesh])

  useFrame(() => {
    const { t, state } = frame.current
    const u = mesh.material.uniforms
    u.time!.value = t * tokens.cloudTimeScale
    const sun = state.environment?.sun
    if (sun) (u.sunPosition!.value as THREE.Vector3).set(sun.direction.x, sun.direction.y, sun.direction.z)
  })

  return (
    <group userData={{ envPart: 'sky' }}>
      <primitive object={mesh} />
    </group>
  )
}

/** 太陽主光：跟著太陽方向、投射廠房範圍的陰影；仰角低時偏暖、偏弱。 */
export function SunLight() {
  const frame = useFrameRef()
  const ref = useRef<THREE.DirectionalLight>(null)
  const colors = useMemo(() => ({ low: new THREE.Color(sunLight.colorLow), high: new THREE.Color(sunLight.colorHigh) }), [])
  useFrame(() => {
    const l = ref.current
    const sun = frame.current.state.environment?.sun
    if (!l || !sun) return
    const d = sunLight.distance
    l.position.set(sun.direction.x * d, sun.direction.y * d, sun.direction.z * d)
    const k = smooth(sunLight.lowElevation, sunLight.highElevation, sun.elevation)
    l.intensity = sunLight.intensityLow + (sunLight.intensityHigh - sunLight.intensityLow) * k
    l.color.lerpColors(colors.low, colors.high, k)
  })
  const e = sunLight.shadowExtent
  return (
    <directionalLight
      ref={ref}
      position={[0, sunLight.distance, 0]}
      intensity={sunLight.intensityHigh}
      castShadow
      shadow-mapSize={[light.shadowMapSize, light.shadowMapSize]}
      shadow-bias={sunLight.shadowBias}
      shadow-normalBias={sunLight.shadowNormalBias}
      shadow-camera-left={-e}
      shadow-camera-right={e}
      shadow-camera-top={e}
      shadow-camera-bottom={-e}
      shadow-camera-near={sunLight.shadowNear}
      shadow-camera-far={sunLight.shadowFar}
    />
  )
}
