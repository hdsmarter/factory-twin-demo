import { useMemo } from 'react'
import type { Site } from '../../domain/layout'
import { fog } from '../../theme/islandTokens'
import { Forest } from './Forest'
import { Ocean } from './Ocean'
import { Sky, SunLight } from './Sky'
import { Terrain } from './Terrain'

/**
 * 荒島環境：天空＋太陽主光＋海面＋地形＋森林＋遠方海霧。
 * 需放在 <Factory> 之內（動態讀 useFrameRef）；配置沒有 environment 時不渲染。
 */
export function Island({ site }: { site: Site }) {
  const env = site.environment
  const { width, depth } = site.bounds
  const avoid = useMemo(() => ({ minX: -width / 2, maxX: width / 2, minZ: -depth / 2, maxZ: depth / 2 }), [width, depth])
  if (!env) return null
  return (
    <>
      <fog attach="fog" args={[fog.color, fog.near, fog.far]} />
      <Sky />
      <SunLight />
      <Ocean />
      <Terrain island={env.island} />
      <Forest island={env.island} avoid={avoid} />
    </>
  )
}
