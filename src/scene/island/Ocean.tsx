import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Water } from 'three/examples/jsm/objects/Water.js'
import { PLATEAU_HEIGHT } from '../../domain/environment'
import { ocean as tokens } from '../../theme/islandTokens'
import { useFrameRef } from '../Factory'
import { assetUrl } from '../materials'

/**
 * 海面（three Water：反射＋法線貼圖波紋）。位於海平面 y = -PLATEAU_HEIGHT。
 * time uniform 以模擬秒數推導（決定性）；不用 wavePhase 的原因：Water 的噪聲不是週期函數，
 * 相位每個海浪週期歸零會造成跳格。
 */
export function Ocean() {
  const frame = useFrameRef()
  const normals = useTexture(assetUrl.file(tokens.normalMap))
  const water = useMemo(() => {
    const tex = normals.clone()
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.needsUpdate = true
    const geometry = new THREE.PlaneGeometry(tokens.size, tokens.size)
    const w = new Water(geometry, {
      textureWidth: tokens.textureSize,
      textureHeight: tokens.textureSize,
      waterNormals: tex,
      sunDirection: new THREE.Vector3(0, 1, 0),
      sunColor: tokens.sunColor,
      waterColor: tokens.waterColor,
      distortionScale: tokens.distortionScale,
      alpha: tokens.alpha,
      fog: true,
    })
    w.rotation.x = -Math.PI / 2
    w.position.y = -PLATEAU_HEIGHT
    return w
  }, [normals])
  useEffect(() => () => {
    water.geometry.dispose()
    water.material.dispose()
  }, [water])

  useFrame(() => {
    const { t, state } = frame.current
    const u = water.material.uniforms
    u.time!.value = t * tokens.timeScale
    const sun = state.environment?.sun
    if (sun) (u.sunDirection!.value as THREE.Vector3).set(sun.direction.x, sun.direction.y, sun.direction.z)
  })

  return (
    <group userData={{ envPart: 'ocean' }}>
      <primitive object={water} />
    </group>
  )
}
