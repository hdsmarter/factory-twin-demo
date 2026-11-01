import { Environment as DreiEnvironment } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Site } from '../domain/layout'
import { color, light } from '../theme/tokens'
import { assetUrl } from './materials'

/** 部署到不提供 .hdr 的主機（Claude Artifact）時，改用程式產生的 RoomEnvironment 當環境反射 */
const USE_ROOM_ENV = import.meta.env.VITE_ENV_MAP === 'room'

function RoomEnvironmentMap({ intensity }: { intensity: number }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    scene.environmentIntensity = intensity
    return () => {
      scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene, intensity])
  return null
}

/**
 * 光照：倉庫 HDRI（Poly Haven）提供環境反射與漫射。
 * 有島嶼環境時，天空背景與主光改由 island/Sky（跟著太陽移動）負責，這裡只留 HDRI 補充反射與半球光。
 */
export function Environment({ site }: { site: Site }) {
  const { width, depth } = site.bounds
  const half = Math.max(width, depth) / 2 + 2
  const outdoor = site.environment !== undefined
  return (
    <>
      {!outdoor && <color attach="background" args={[color.background]} />}
      {USE_ROOM_ENV ? (
        <RoomEnvironmentMap intensity={outdoor ? light.environmentIntensityOutdoor : light.environmentIntensity} />
      ) : (
        <DreiEnvironment files={assetUrl.hdri('empty_warehouse_01')} environmentIntensity={outdoor ? light.environmentIntensityOutdoor : light.environmentIntensity} />
      )}
      <hemisphereLight args={[light.hemiSky, light.hemiGround, light.hemiIntensity]} />
      {!outdoor && <directionalLight
        position={light.sunPosition}
        intensity={light.sunIntensity}
        castShadow
        shadow-mapSize={[light.shadowMapSize, light.shadowMapSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
        shadow-camera-near={1}
        shadow-camera-far={80}
      />}
    </>
  )
}
