import { useGLTF } from '@react-three/drei'
import type { ThreeElements } from '@react-three/fiber'
import { Suspense, useMemo } from 'react'
import * as THREE from 'three'
import { ErrorBoundary } from './ErrorBoundary'
import { assetUrl } from './materials'

type FittedModelProps = { model: string; fitWidth?: number } & Omit<ThreeElements['group'], 'id'>

/**
 * 載入 Poly Haven glTF，可選擇等比縮放到指定寬度（x）；底面貼地、水平置中。
 * 每個實例 clone 一份，避免共用同一個 Object3D。
 */
function LoadedModel({ model, fitWidth, ...group }: FittedModelProps) {
  const { scene } = useGLTF(assetUrl.model(model))
  const object = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
    const box = new THREE.Box3().setFromObject(clone)
    const size = box.getSize(new THREE.Vector3())
    const scale = fitWidth ? fitWidth / Math.max(size.x, 1e-6) : 1
    const center = box.getCenter(new THREE.Vector3())
    const wrapper = new THREE.Group()
    clone.position.set(-center.x, -box.min.y, -center.z)
    wrapper.add(clone)
    wrapper.scale.setScalar(scale)
    return wrapper
  }, [scene, fitWidth])
  return (
    <group {...group}>
      <primitive object={object} />
    </group>
  )
}

/** 模型載入失敗（例如 404）時只少這一個物件，不影響場景其他部分。 */
export function FittedModel(props: FittedModelProps) {
  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <LoadedModel {...props} />
      </Suspense>
    </ErrorBoundary>
  )
}
