import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { postfx } from '../theme/tokens'

/** 後處理：環境光遮蔽（接觸陰影）→ 自發光泛光 → ACES 色調映射（實測比 AgX 飽和、島嶼不灰） → 暗角 → 抗鋸齒 */
export function Effects() {
  return (
    <EffectComposer multisampling={0}>
      <N8AO aoRadius={postfx.aoRadius} intensity={postfx.aoIntensity} distanceFalloff={1} />
      <Bloom mipmapBlur luminanceThreshold={postfx.bloomThreshold} intensity={postfx.bloomIntensity} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette darkness={postfx.vignetteDarkness} offset={0.3} />
      <SMAA />
    </EffectComposer>
  )
}
