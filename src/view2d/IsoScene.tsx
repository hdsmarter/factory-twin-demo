import { useMemo, type ReactNode } from 'react'
import type { ActorPose } from '../domain/actors'
import { forestPlacement, islandHeight, PLATEAU_HEIGHT } from '../domain/environment'
import { areaBounds, footprintRect, type Rect } from '../domain/geometry'
import type { Actor, ActorType, IslandSpec, PlacedEquipment, Site } from '../domain/layout'
import { ISO_DIRECTION, isoProject } from '../domain/projection'
import type { FrameState } from '../domain/simulate'
import { AGV_DIMENSIONS, FOREST_COUNT, WORKER_HEIGHT } from '../domain/specs'
import { applyView, PAN_ZOOM_DEFAULT, type PanZoom } from './panZoom'
import { agv as agvTone, building as bt, land, sea } from './palette'
import { WorkerFigure } from './Worker'
import { At, EquipmentShape, equipmentLayer, equipmentTop, Flat, orientedRect, outline, Prism, pt, Tree, type XZ } from './shapes'

export interface IsoSceneProps {
  site: Site
  placed: PlacedEquipment[]
  actors: Actor[]
  /** simulate(site, placed, t) 的結果 */
  state: FrameState
  /** 模擬時間（秒）：人物的呼吸、擺動等次要動作 */
  t: number
  width: number
  height: number
  /** island：整座島；factory：只框廠房周圍 ±25 m */
  framing?: 'island' | 'factory'
  /** 使用者的平移縮放（相對預設構圖） */
  view?: PanZoom
  /** 裝飾性次要動作（呼吸、擺髮）；使用者偏好減少動態時傳 false */
  ambient?: boolean
}

const COAST_SAMPLES = 180
const SHALLOW_RING = 14
const FOAM_RING = 1.6
/** factory 構圖：廠房外框再外擴的邊距（公尺） */
const FACTORY_MARGIN = 3
const FRAME_PADDING = 0.04
const WALL = 0.25
const COLUMN_SPACING = 6
const APRON_MARGIN = 3
/** 遠景時人物／AGV 外觀放大倍率（錨點不變） */
const ENLARGE = { island: 3, factory: 1.25 } as const
/** AGV 插畫：底盤色帶佔總高的比例、狀態燈半徑（公尺）與自中心往前的位置（佔車長比例） */
const AGV_DECK_RATIO = 0.2
const AGV_LAMP = { r: 0.09, forward: 0.3 }
/** 人員佔地半徑（公尺，排序用） */
const WORKER_RADIUS = 0.3

type V3 = [number, number, number]
type Box = { u0: number; u1: number; v0: number; v1: number }

const boxOf = (ps: V3[]): Box => {
  const q = ps.map((p) => isoProject(...p))
  return { u0: Math.min(...q.map((p) => p.u)), u1: Math.max(...q.map((p) => p.u)), v0: Math.min(...q.map((p) => p.v)), v1: Math.max(...q.map((p) => p.v)) }
}
const overlaps = (a: Box, b: Box) => a.u0 < b.u1 && b.u0 < a.u1 && a.v0 < b.v1 && b.v0 < a.v1

/* ───────────── 島嶼幾何（純函數） ───────────── */

/** 沿方向 θ 二分搜尋 islandHeight = 0 的海岸半徑 */
function coastRadius(island: IslandSpec, theta: number): number {
  let lo = island.plateauRadius
  let hi = island.radius * 1.5
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2
    if (islandHeight(island, mid * Math.cos(theta), mid * Math.sin(theta)) > 0) lo = mid
    else hi = mid
  }
  return lo
}

function islandOutline(island: IslandSpec) {
  const rays = Array.from({ length: COAST_SAMPLES }, (_, i) => {
    const theta = (i / COAST_SAMPLES) * 2 * Math.PI
    return { c: Math.cos(theta), s: Math.sin(theta), r: coastRadius(island, theta) }
  })
  const ring = (dr: number) => rays.map((a) => ({ x: (a.r + dr) * a.c, z: (a.r + dr) * a.s }))
  const grass = ring(-island.beachWidth)
  return {
    shallow: ring(SHALLOW_RING),
    foam: ring(FOAM_RING),
    coast: ring(0),
    grass: grass.map((p) => ({ ...p, y: islandHeight(island, p.x, p.z) - PLATEAU_HEIGHT })),
    plateau: rays.map((a) => ({ x: island.plateauRadius * a.c, z: island.plateauRadius * a.s })),
  }
}

/* ───────────── 構圖 ───────────── */

function viewBoxOf(site: Site, framing: 'island' | 'factory', width: number, height: number, coast: XZ[]): Box {
  const sea = -PLATEAU_HEIGHT
  const raw =
    framing === 'island' && site.environment
      ? boxOf(coast.map((p) => [p.x, sea, p.z]))
      : boxOf([-1, 1].flatMap((sx) => [-1, 1].flatMap((sz) => [0, site.bounds.height].map((y): V3 => [sx * (site.bounds.width / 2 + FACTORY_MARGIN), y, sz * (site.bounds.depth / 2 + FACTORY_MARGIN)]))))
  const pad = (raw.u1 - raw.u0) * FRAME_PADDING
  let w = raw.u1 - raw.u0 + 2 * pad
  let h = raw.v1 - raw.v0 + 2 * pad
  const aspect = width / height
  if (w / h < aspect) w = h * aspect
  else h = w / aspect
  const cu = (raw.u0 + raw.u1) / 2
  const cv = (raw.v0 + raw.v1) / 2
  return { u0: cu - w / 2, u1: cu + w / 2, v0: cv - h / 2, v1: cv + h / 2 }
}

/* ───────────── 畫家演算法 ───────────── */

interface Drawable {
  key: string
  rect: Rect
  y0: number
  y1: number
  /** 佔地重疊時的先後（小的先畫） */
  layer: number
  node: ReactNode
}

const depthOf = (d: Drawable) =>
  ((d.rect.minX + d.rect.maxX) / 2) * ISO_DIRECTION.x + ((d.y0 + d.y1) / 2) * ISO_DIRECTION.y + ((d.rect.minZ + d.rect.maxZ) / 2) * ISO_DIRECTION.z

/** a 是否必須比 b 先畫：佔地在 +x 或 -z 方向完全分離的那個較遠；重疊看 layer；無法判定時依深度。 */
function drawsBefore(a: Drawable, b: Drawable, da: number, db: number): boolean {
  const aFar = a.rect.minX >= b.rect.maxX || a.rect.maxZ <= b.rect.minZ
  const bFar = b.rect.minX >= a.rect.maxX || b.rect.maxZ <= a.rect.minZ
  if (aFar !== bFar) return aFar
  if (!aFar && a.layer !== b.layer) return a.layer < b.layer
  return da !== db ? da < db : a.key < b.key
}

/** 只在畫面範圍重疊的配對間建立先後關係，再做拓撲排序（同時可畫者依 dot(p, ISO_DIRECTION) 由遠到近）。 */
function paintOrder(items: Drawable[]): Drawable[] {
  const n = items.length
  const depth = items.map(depthOf)
  const boxes = items.map((d) => boxOf([d.y0, d.y1].flatMap((y) => [[d.rect.minX, y, d.rect.minZ], [d.rect.maxX, y, d.rect.minZ], [d.rect.maxX, y, d.rect.maxZ], [d.rect.minX, y, d.rect.maxZ]] as V3[])))
  const after: number[][] = items.map(() => [])
  const indeg = new Array<number>(n).fill(0)
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (!overlaps(boxes[i]!, boxes[j]!)) continue
      const [a, b] = drawsBefore(items[i]!, items[j]!, depth[i]!, depth[j]!) ? [i, j] : [j, i]
      after[a]!.push(b)
      indeg[b]!++
    }
  const done = new Array<boolean>(n).fill(false)
  const out: Drawable[] = []
  for (let step = 0; step < n; step++) {
    let pick = -1
    for (const free of [true, false]) {
      for (let i = 0; i < n; i++) if (!done[i] && (!free || indeg[i] === 0) && (pick < 0 || depth[i]! < depth[pick]!)) pick = i
      if (pick >= 0) break // 有循環時退回「剩下最遠的先畫」
    }
    done[pick] = true
    out.push(items[pick]!)
    for (const k of after[pick]!) indeg[k]!--
  }
  return out
}

/* ───────────── 場景元素 ───────────── */

function Sea({ box, wave }: { box: Box; wave: number }) {
  const w = box.u1 - box.u0
  const h = box.v1 - box.v0
  const spacing = w / 11
  const rows = 12
  const len = spacing * 0.28
  const amp = len * 0.12
  const marks: string[] = []
  for (let r = 0; r < rows; r++) {
    const v = box.v0 + ((r + 0.5) / rows) * h
    const shift = (r % 2) * spacing * 0.5 + wave * spacing
    for (let c = -1; c <= 11; c++) {
      const u = box.u0 + c * spacing + shift
      marks.push(`M${u.toFixed(2)},${v.toFixed(2)} q${(len / 4).toFixed(2)},${(-amp).toFixed(2)} ${(len / 2).toFixed(2)},0 t${(len / 2).toFixed(2)},0`)
    }
  }
  return (
    <g>
      <rect x={box.u0} y={box.v0} width={w} height={h} fill={sea.deep} />
      <path d={marks.join(' ')} fill="none" stroke={sea.wave} strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </g>
  )
}

function Island({ shape }: { shape: ReturnType<typeof islandOutline> }) {
  const y = -PLATEAU_HEIGHT
  return (
    <g>
      <polygon points={shape.shallow.map((p) => pt(p.x, y, p.z)).join(' ')} fill={sea.shallow} />
      <polygon points={shape.foam.map((p) => pt(p.x, y, p.z)).join(' ')} fill={sea.wave} />
      <Flat points={shape.coast} y={y} fill={land.sand} />
      <polygon points={shape.grass.map((p) => pt(p.x, p.y, p.z)).join(' ')} fill={land.grass} {...outline} />
      <polygon points={shape.plateau.map((p) => pt(p.x, 0, p.z)).join(' ')} fill={land.plateau} stroke={land.grass} strokeWidth={1} vectorEffect="non-scaling-stroke" />
    </g>
  )
}

/** 廠房：地板、區域標線、後牆（-z）與右牆（+x）；前牆與左牆面向相機，與 3D 剖面一致不畫。 */
function Shell({ site, placed }: { site: Site; placed: PlacedEquipment[] }) {
  const { width: W, depth: D, height: H } = site.bounds
  const [x0, x1, z0, z1] = [-W / 2, W / 2, -D / 2, D / 2]
  const rect = (a: number, b: number, c: number, d: number): XZ[] => [
    { x: a, z: c },
    { x: b, z: c },
    { x: b, z: d },
    { x: a, z: d },
  ]
  const wallTone = { top: bt.wallTrim, left: bt.wallSide, right: bt.wallBack }
  const columns = Array.from({ length: Math.floor(W / COLUMN_SPACING) + 1 }, (_, i) => x0 + i * COLUMN_SPACING)
  const sideColumns = Array.from({ length: Math.floor(D / COLUMN_SPACING) + 1 }, (_, i) => z0 + i * COLUMN_SPACING)
  return (
    <g>
      <Flat points={rect(x0 - APRON_MARGIN, x1 + APRON_MARGIN, z0 - APRON_MARGIN, z1 + APRON_MARGIN)} y={0} fill={bt.apron} />
      <Flat points={rect(x0, x1, z0, z1)} y={0} fill={bt.floor} />
      {areaBounds(placed).map((a) => (
        <Flat key={a.area} points={rect(a.minX, a.maxX, a.minZ, a.maxZ)} y={0} fill="none" stroke={bt.areaMark} />
      ))}
      <Prism base={rect(x0 - WALL, x1 + WALL, z0 - WALL, z0)} y0={0} y1={H} tone={wallTone} />
      {columns.map((x) => (
        <polyline key={x} points={`${pt(x, 0, z0)} ${pt(x, H, z0)}`} fill="none" {...outline} strokeWidth={0.6} stroke={bt.wallTrim} />
      ))}
      <Prism base={rect(x1, x1 + WALL, z0 - WALL, z1)} y0={0} y1={H} tone={wallTone} />
      {sideColumns.map((z) => (
        <polyline key={z} points={`${pt(x1, 0, z)} ${pt(x1, H, z)}`} fill="none" {...outline} strokeWidth={0.6} stroke={bt.wallTrim} />
      ))}
    </g>
  )
}

/** AGV：以底面中心為原點繪製，再平移到 pose (x, 0, z) 的投影（data-part="agv" 的 translate 即錨點）。 */
function Agv({ pose, enlarge }: { pose: ActorPose; enlarge: number }) {
  const L = AGV_DIMENSIONS.length * enlarge
  const Wd = AGV_DIMENSIONS.width * enlarge
  const top = AGV_DIMENSIONS.height * enlarge
  const deck = top * AGV_DECK_RATIO
  const base = orientedRect({ x: 0, z: 0 }, pose.heading, L, Wd)
  const lampAt = isoProject(Math.cos(pose.heading) * L * AGV_LAMP.forward, top, -Math.sin(pose.heading) * L * AGV_LAMP.forward)
  const deckTone = { top: agvTone.deck, left: agvTone.deck, right: agvTone.deck }
  return (
    <At part="agv" x={pose.x} y={0} z={pose.z}>
      <Prism base={base} y0={0} y1={deck} tone={deckTone} />
      <Prism base={base} y0={deck} y1={top} tone={agvTone.body} />
      <circle cx={lampAt.u} cy={lampAt.v} r={AGV_LAMP.r * enlarge} fill={pose.action === 'move' ? agvTone.lightMove : agvTone.lightDock} {...outline} />
    </At>
  )
}

/** 2D 移動體註冊表：mapped type 保證每種 ActorType 都有外觀，不會靜默退回 AGV。 */
interface DrawContext {
  actor: Actor
  pose: ActorPose
  look: number
  enlarge: number
  t: number
  ambient: boolean
}

const ACTOR_VIEWS: { [K in ActorType]: { radius: number; height: number; draw: (c: DrawContext) => ReactNode } } = {
  worker: { radius: WORKER_RADIUS, height: WORKER_HEIGHT, draw: (c) => <WorkerFigure actor={c.actor} pose={c.pose} look={c.look} enlarge={c.enlarge} t={c.t} ambient={c.ambient} /> },
  agv: { radius: AGV_DIMENSIONS.length / 2, height: AGV_DIMENSIONS.height, draw: (c) => <Agv pose={c.pose} enlarge={c.enlarge} /> },
}

const withPoint = (r: Rect, p: XZ): Rect => ({ minX: Math.min(r.minX, p.x), maxX: Math.max(r.maxX, p.x), minZ: Math.min(r.minZ, p.z), maxZ: Math.max(r.maxZ, p.z) })
const pointRect = (p: XZ, r: number): Rect => ({ minX: p.x - r, maxX: p.x + r, minZ: p.z - r, maxZ: p.z + r })

/** 實體根節點：帶 data-entity-id 與錨點投影座標（data-u / data-v） */
function Entity({ id, at, children }: { id: string; at: XZ; children: ReactNode }) {
  const p = isoProject(at.x, 0, at.z)
  return (
    <g data-entity-id={id} data-u={String(p.u)} data-v={String(p.v)}>
      {children}
    </g>
  )
}

/**
 * 等角 2D 插畫：與 3D 共用 isoProject；由遠到近依畫家演算法繪製。
 * 只依 props 決定輸出（不讀時鐘、不用亂數）。
 */
export function IsoScene({ site, placed, actors, state, t, width, height, framing = 'island', view = PAN_ZOOM_DEFAULT, ambient = true }: IsoSceneProps) {
  const island = site.environment?.island
  const shape = useMemo(() => (island ? islandOutline(island) : undefined), [island])
  const trees = useMemo(() => {
    if (!island) return []
    const { width: W, depth: D } = site.bounds
    return forestPlacement(island, { minX: -W / 2, maxX: W / 2, minZ: -D / 2, maxZ: D / 2 }, FOREST_COUNT)
  }, [island, site.bounds])
  const frame = viewBoxOf(site, framing, width, height, shape?.shallow ?? [])
  const box = applyView(frame, view)
  const enlarge = ENLARGE[framing]
  const wave = state.environment?.wave ?? 0

  const { width: W, depth: D, height: H } = site.bounds
  const items: Drawable[] = [
    {
      key: 'shell',
      rect: { minX: -W / 2 - WALL, maxX: W / 2 + WALL, minZ: -D / 2 - WALL, maxZ: D / 2 },
      y0: 0,
      y1: H,
      layer: 0,
      node: <Shell key="shell" site={site} placed={placed} />,
    },
    ...trees.map((tr, i) => ({
      key: `tree${String(i).padStart(3, '0')}`,
      rect: pointRect(tr, 2 * tr.scale),
      y0: tr.y - PLATEAU_HEIGHT,
      y1: tr.y - PLATEAU_HEIGHT + 7 * tr.scale,
      layer: 0,
      node: <Tree key={`tree${i}`} x={tr.x} y={tr.y - PLATEAU_HEIGHT} z={tr.z} scale={tr.scale} variant={tr.variant} />,
    })),
    ...placed.map((pe) => {
      const f = pe.equipment.footprint
      const s = state.equipment[pe.equipment.id]
      return {
        key: pe.equipment.id,
        // 手臂伸出佔地外取放：範圍含夾爪位置，與輸送帶／棧板重疊時依 layer 後畫
        rect: s?.kind === 'robot-arm' ? withPoint(footprintRect(f), s.pose.tool) : footprintRect(f),
        y0: 0,
        y1: equipmentTop(pe),
        layer: equipmentLayer(pe),
        node: (
          <Entity key={pe.equipment.id} id={pe.equipment.id} at={f}>
            <EquipmentShape pe={pe} state={s} />
          </Entity>
        ),
      }
    }),
    ...actors.flatMap((a, i) => {
      const pose = state.actors[a.id]
      if (!pose) return []
      const view = ACTOR_VIEWS[a.type]
      return [
        {
          key: a.id,
          rect: pointRect(pose, view.radius * enlarge),
          y0: 0,
          y1: view.height * enlarge,
          layer: 3,
          node: (
            <Entity key={a.id} id={a.id} at={pose}>
              {view.draw({ actor: a, pose, look: i, enlarge, t, ambient })}
            </Entity>
          ),
        },
      ]
    }),
  ]

  return (
    <svg
      data-view="iso2d"
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${box.u0} ${box.v0} ${box.u1 - box.u0} ${box.v1 - box.v0}`}
      width={width}
      height={height}
      aria-hidden="true"
    >
      <Sea box={box} wave={wave} />
      {shape && <Island shape={shape} />}
      {paintOrder(items).map((d) => d.node)}
    </svg>
  )
}
