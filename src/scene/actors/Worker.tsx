import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { WORKER_HEIGHT } from '../../domain/specs'
import { worker } from '../../theme/actorTokens'
import { ErrorBoundary } from '../ErrorBoundary'
import { useFrameRef } from '../Factory'
import { assetUrl } from '../materials'
import type { ActorViewProps } from './index'

const mod = (v: number, m: number) => ((v % m) + m) % m

type Part = 'skin' | 'outfit' | 'pants' | 'boots'

/** 依骨骼名稱判斷身體部位（Quaternius 骨架：Head、Neck、*UpLeg、*Leg、*Foot、*Toe…） */
function partOf(bone: string): Part {
  if (/Head|Neck/.test(bone)) return 'skin'
  if (/Hand/.test(bone)) return 'skin'
  if (/Foot|Toe/.test(bone)) return 'boots'
  if (/UpLeg|Leg/.test(bone)) return 'pants'
  return 'outfit'
}

/**
 * 模型沒有 UV（無法套原始調色盤貼圖）→ 依每個頂點權重最大的骨骼決定部位並寫入頂點色。
 * 每位人員各自一份幾何（工作服顏色不同）。
 */
function paintByBones(mesh: THREE.SkinnedMesh, outfit: string) {
  const geo = mesh.geometry.clone()
  const joints = geo.getAttribute('skinIndex')
  const weights = geo.getAttribute('skinWeight')
  const palette: Record<Part, THREE.Color> = {
    skin: new THREE.Color(worker.skin),
    outfit: new THREE.Color(outfit),
    pants: new THREE.Color(worker.pants),
    boots: new THREE.Color(worker.boots),
  }
  const colors = new Float32Array(geo.getAttribute('position').count * 3)
  for (let i = 0; i < colors.length / 3; i++) {
    let best = 0
    for (let k = 1; k < 4; k++) if (weights.getComponent(i, k) > weights.getComponent(i, best)) best = k
    const bone = mesh.skeleton.bones[joints.getComponent(i, best)]
    palette[partOf(bone?.name ?? '')].toArray(colors, i * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  mesh.geometry = geo
  const mat = (mesh.material as THREE.MeshStandardMaterial).clone()
  mat.vertexColors = true
  mat.color.set('#ffffff')
  mat.roughness = 0.75
  mesh.material = mat
}

/** 安全帽：掛在頭頂骨骼上，隨頭部動作移動 */
function attachHardHat(body: THREE.Object3D) {
  const top = body.getObjectByName('HeadTop_End')
  if (!top) return
  body.updateMatrixWorld(true)
  const hat = new THREE.Mesh(
    new THREE.SphereGeometry(worker.hatRadius, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: worker.hardHat, roughness: 0.35 }),
  )
  hat.castShadow = true
  const p = top.getWorldPosition(new THREE.Vector3())
  hat.position.set(p.x, p.y - worker.hatDrop, p.z)
  hat.scale.set(1, 0.8, 1.1)
  body.add(hat)
  hat.updateMatrixWorld(true)
  top.attach(hat) // 保留世界變換，改由骨骼帶動
}

/** 每位人員一份骨架與 AnimationMixer；身高等比縮放、腳底貼地。 */
function useWorkerRig(outfit: string) {
  const gltf = useGLTF(assetUrl.model(worker.model))
  return useMemo(() => {
    const body = cloneSkinned(gltf.scene)
    body.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) paintByBones(o as THREE.SkinnedMesh, outfit)
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true
        o.receiveShadow = true
        // 蒙皮網格的包圍球以綁定姿勢計算，動畫時可能被誤裁切
        o.frustumCulled = false
      }
    })
    body.updateMatrixWorld(true)
    // 蒙皮網格的包圍盒依骨骼矩陣計算；渲染前骨骼矩陣尚未更新，先手動更新一次
    body.traverse((o) => (o as THREE.SkinnedMesh).isSkinnedMesh && (o as THREE.SkinnedMesh).skeleton.update())
    const box = new THREE.Box3().setFromObject(body)
    body.position.y = -box.min.y
    const rig = new THREE.Group()
    rig.add(body)
    rig.scale.setScalar(WORKER_HEIGHT / Math.max(box.max.y - box.min.y, 1e-6))
    rig.updateMatrixWorld(true)
    attachHardHat(body)

    const mixer = new THREE.AnimationMixer(body)
    const actionOf = (name: string) => {
      const clip = THREE.AnimationClip.findByName(gltf.animations, name)
      return clip ? mixer.clipAction(clip) : undefined
    }
    const walk = actionOf(worker.clips.walk)
    const work = actionOf(worker.clips.work) ?? actionOf(worker.clips.idle)
    for (const a of [walk, work]) a?.play()
    return { rig, body, mixer, walk, work }
  }, [gltf, outfit])
}

function WorkerModel({ actor, index }: ActorViewProps) {
  const frame = useFrameRef()
  const { rig, body, mixer, walk, work } = useWorkerRig(worker.outfits[index % worker.outfits.length]!)
  const root = useRef<THREE.Group>(null)

  useEffect(
    () => () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(body)
    },
    [mixer, body],
  )

  useFrame(() => {
    const g = root.current
    const { t, state } = frame.current
    const pose = state.actors[actor.id]
    if (!g || !pose) return
    g.position.set(pose.x, 0, pose.z)
    g.rotation.y = pose.heading + worker.yawOffset

    // 動畫時間只由 t 推導（決定性）：走路依移動距離／步幅對齊腳步，工作依 t 循環
    const walking = pose.action === 'walk'
    const current = walking ? walk : work
    for (const a of [walk, work]) if (a) a.enabled = a === current
    if (!current) return
    const duration = current.getClip().duration
    const cycles = walking ? (t * pose.speed) / worker.strideLength : t / duration
    current.time = mod(cycles * duration, duration)
    mixer.update(0)
  })

  return (
    <group ref={root}>
      <primitive object={rig} />
    </group>
  )
}

/** 工作人員（Quaternius 低多邊形人物）；模型載入失敗時只少這個人，不影響場景。 */
export function Worker(props: ActorViewProps) {
  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <WorkerModel {...props} />
      </Suspense>
    </ErrorBoundary>
  )
}
