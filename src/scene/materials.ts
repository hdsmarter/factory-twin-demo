import { useTexture } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { color } from '../theme/tokens'

/** Poly Haven 貼圖組 id（與 assets/manifest.json 中 kind=texture 的 id 一致） */
export type PbrSetId = 'smooth_concrete_floor' | 'blue_metal_plate' | 'rubberized_track' | 'corrugated_iron_02'

export const assetUrl = {
  model: (id: string) => `/assets/models/${id}.glb`,
  hdri: (id: string) => `/assets/hdri/${id}.hdr`,
  texture: (id: PbrSetId, map: 'diff' | 'nor_gl' | 'arm') => `/assets/textures/${id}/${map}.jpg`,
}

export interface PbrMaps {
  map: THREE.Texture
  normalMap: THREE.Texture
  /** arm = R:AO / G:roughness / B:metalness 打包貼圖 */
  aoMap: THREE.Texture
  roughnessMap: THREE.Texture
  metalnessMap: THREE.Texture
}

/**
 * 載入一組 PBR 貼圖並設定重複次數。每次呼叫回傳 clone，讓不同物件可各自設定 repeat/offset，
 * 底層影像仍共用快取（不重複下載）。
 */
export function usePbr(id: PbrSetId, repeat: [number, number] = [1, 1]): PbrMaps {
  const [diff, nor, arm] = useTexture([assetUrl.texture(id, 'diff'), assetUrl.texture(id, 'nor_gl'), assetUrl.texture(id, 'arm')])
  return useMemo(() => {
    const prep = (src: THREE.Texture, srgb: boolean) => {
      const tex = src.clone()
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      tex.repeat.set(repeat[0], repeat[1])
      tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
      tex.anisotropy = 16
      tex.needsUpdate = true
      return tex
    }
    const armTex = prep(arm!, false)
    return { map: prep(diff!, true), normalMap: prep(nor!, false), aoMap: armTex, roughnessMap: armTex, metalnessMap: armTex }
  }, [diff, nor, arm, repeat[0], repeat[1]])
}

/** 夾心板每片寬度（公尺） */
export const PANEL_WIDTH = 1

/**
 * 金屬夾心板牆的程式紋理：每片 1 m 一道柔和接縫、下緣一條防撞腰帶。
 * 只有低頻細節 → 鏡頭移動時不會像浪板貼圖那樣產生摩爾紋（實測閃爍主因）。
 * 回傳的貼圖覆蓋 4 片寬 × 指定高度，呼叫端以 repeat 鋪滿牆面。
 */
export function usePanelWall(lengthMeters: number, heightMeters: number): THREE.CanvasTexture {
  return useMemo(() => {
    const panels = 4
    const pxPerMeter = 128
    const canvas = document.createElement('canvas')
    canvas.width = panels * PANEL_WIDTH * pxPerMeter
    canvas.height = Math.round(heightMeters * pxPerMeter)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = color.wallPanel
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    // 板面微漸層（上亮下暗），增加體積感
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height)
    g.addColorStop(0, 'rgba(255,255,255,0.06)')
    g.addColorStop(1, 'rgba(0,0,0,0.10)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    // 接縫：柔和的 3px 暗線 + 1px 亮邊
    for (let i = 0; i <= panels; i++) {
      const x = i * PANEL_WIDTH * pxPerMeter
      ctx.fillStyle = color.wallSeam
      ctx.fillRect(x - 1.5, 0, 3, canvas.height)
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.fillRect(x + 1.5, 0, 1, canvas.height)
    }
    // 下緣防撞腰帶（離地 1.2 m 以下較深色）
    const kick = Math.round(1.2 * pxPerMeter)
    ctx.fillStyle = color.wallKick
    ctx.fillRect(0, canvas.height - kick, canvas.width, kick)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = THREE.RepeatWrapping
    tex.repeat.set(lengthMeters / (panels * PANEL_WIDTH), 1)
    tex.anisotropy = 16
    tex.needsUpdate = true
    return tex
  }, [lengthMeters, heightMeters])
}
