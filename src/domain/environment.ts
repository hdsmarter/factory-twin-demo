import type { Rect } from './geometry'
import type { EnvironmentSpec, IslandSpec } from './layout'
import { cyclePhase } from './motion/time'

/** 平台（廠房地基）高度，公尺 */
export const PLATEAU_HEIGHT = 2
/** 沙灘內緣高度 */
const BEACH_TOP = 0.7
/** 丘陵起伏幅度 */
const HILL_AMPLITUDE = 7
/** 海岸線不規則程度（相對半徑）；配置驗證據此計算最小陸地 */
export const COAST_WOBBLE = 0.08
const SEABED_SLOPE = 0.15
const SEABED_MIN = -8

const DEG = Math.PI / 180
const SUN_AZIMUTH_START = 100 * DEG
const SUN_AZIMUTH_SPAN = 160 * DEG
const SUN_ELEVATION_MIN = 8 * DEG
const SUN_ELEVATION_MAX = 52 * DEG

export interface SunState {
  /** 方位角（弧度，從 +z 往 +x 量） */
  azimuth: number
  /** 仰角（弧度），恆 > 0 */
  elevation: number
  /** 從地面指向太陽的單位向量 */
  direction: { x: number; y: number; z: number }
}

/**
 * 太陽位置（純函數）：在一個日週期內從早晨走到傍晚再平滑回到早晨，
 * 永遠在地平線之上（展示用，不做夜晚）。
 */
export function sunAt(env: EnvironmentSpec, t: number): SunState {
  const s = 0.5 - 0.5 * Math.cos(2 * Math.PI * cyclePhase(t, env.dayCycleSeconds)) // 0 → 1 → 0
  const azimuth = SUN_AZIMUTH_START + SUN_AZIMUTH_SPAN * s
  const elevation = SUN_ELEVATION_MIN + (SUN_ELEVATION_MAX - SUN_ELEVATION_MIN) * Math.sin(Math.PI * s)
  const c = Math.cos(elevation)
  return { azimuth, elevation, direction: { x: c * Math.sin(azimuth), y: Math.sin(elevation), z: c * Math.cos(azimuth) } }
}

/** 海浪相位 [0, 1)。日週期必須是海浪週期的整數倍（由配置驗證保證），兩者才會同步循環。 */
export function wavePhase(env: EnvironmentSpec, t: number): number {
  return cyclePhase(t, env.waveSeconds)
}

/** 種子化的確定性亂數（mulberry32） */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let r = Math.imul(a ^ (a >>> 15), 1 | a)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** 由種子決定的平滑週期函數（數個正弦疊加），值域約 [-1, 1] */
function wobble(seed: number, octaves: number) {
  const r = rng(seed)
  const terms = Array.from({ length: octaves }, (_, k) => ({ f: k + 2, p: r() * 2 * Math.PI, a: 1 / (k + 1) }))
  const norm = terms.reduce((s, x) => s + x.a, 0)
  return (theta: number) => terms.reduce((s, x) => s + x.a * Math.sin(x.f * theta + x.p), 0) / norm
}

const smooth = (e0: number, e1: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return u * u * (3 - 2 * u)
}

/** 海岸半徑（依方向起伏） */
function coastRadius(i: IslandSpec, theta: number): number {
  return i.radius * (1 + COAST_WOBBLE * wobble(i.seed, 4)(theta))
}

/**
 * 島嶼地形高度（純函數）：中央平台平坦 → 外圈丘陵 → 沙灘斜降 → 海底。
 * 3D 地形網格、樹木落點與 2D 海岸線共用這一個函數。
 */
export function islandHeight(i: IslandSpec, x: number, z: number): number {
  const r = Math.hypot(x, z)
  if (r <= i.plateauRadius) return PLATEAU_HEIGHT
  const theta = Math.atan2(z, x)
  const R = coastRadius(i, theta)
  const landEdge = R - i.beachWidth
  if (r >= R) return Math.max(SEABED_MIN, -(r - R) * SEABED_SLOPE)
  if (r >= landEdge) return BEACH_TOP * (1 - (r - landEdge) / i.beachWidth)
  // 丘陵：平台外緣平滑升起、近沙灘時降到沙灘高度
  const hills = 0.5 + 0.5 * wobble(i.seed + 1, 3)(theta * 1.5 + r * 0.05)
  const rise = smooth(i.plateauRadius, i.plateauRadius + 12, r)
  const fall = 1 - smooth(landEdge - 25, landEdge, r)
  const base = PLATEAU_HEIGHT + (BEACH_TOP - PLATEAU_HEIGHT) * smooth(i.plateauRadius, landEdge, r)
  return base + HILL_AMPLITUDE * hills * rise * fall
}

export function isLand(i: IslandSpec, x: number, z: number): boolean {
  return islandHeight(i, x, z) > 0
}

export interface TreeInstance {
  x: number
  z: number
  y: number
  scale: number
  rotation: number
  /** 樹種索引 0..2 */
  variant: number
}

const TREE_SPACING = 3
const AVOID_MARGIN = 3

/** 森林配置（種子化、可重現）：在平台外、沙灘內的環帶隨機落點，避開指定矩形並保持間距。 */
export function forestPlacement(i: IslandSpec, avoid: Rect, count: number): TreeInstance[] {
  const r = rng(i.seed * 7919 + 13)
  const out: TreeInstance[] = []
  const inner = i.plateauRadius + 2
  for (let attempts = 0; out.length < count && attempts < count * 200; attempts++) {
    const theta = r() * 2 * Math.PI
    const outer = coastRadius(i, theta) - i.beachWidth - 2
    const radius = Math.sqrt(inner * inner + r() * (outer * outer - inner * inner))
    const x = radius * Math.cos(theta)
    const z = radius * Math.sin(theta)
    const scale = 0.8 + r() * 0.5
    const rotation = r() * 2 * Math.PI
    const variant = Math.floor(r() * 3)
    const inAvoid = x > avoid.minX - AVOID_MARGIN && x < avoid.maxX + AVOID_MARGIN && z > avoid.minZ - AVOID_MARGIN && z < avoid.maxZ + AVOID_MARGIN
    if (inAvoid || !isLand(i, x, z) || out.some((t) => Math.hypot(t.x - x, t.z - z) < TREE_SPACING)) continue
    out.push({ x, z, y: islandHeight(i, x, z), scale, rotation, variant })
  }
  return out
}
