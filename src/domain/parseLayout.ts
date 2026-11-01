import { footprintRect } from './geometry'
import type { Actor, Catalog, EnvironmentSpec, Equipment, LayoutError, ParseResult, PlacedEquipment, Site } from './layout'
import { armParamsOf, armReachProblem } from './motion/robotArm'

const EPSILON = 1e-9
const ROTATIONS = [0, 90, 180, 270]

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isPositive = (v: unknown): v is number => isFiniteNumber(v) && v > 0

/** 廠區層級的形狀：bounds 三邊為正數、週期為正、各層都是陣列。設備內容另外逐台檢查。 */
function isSiteShape(raw: unknown): raw is Site {
  if (!isObject(raw) || !isObject(raw.bounds) || !Array.isArray(raw.areas)) return false
  const b = raw.bounds
  if (!isPositive(b.width) || !isPositive(b.depth) || !isPositive(b.height) || !isPositive(raw.cycleSeconds)) return false
  return raw.areas.every(
    (a) =>
      isObject(a) &&
      Array.isArray(a.lines) &&
      a.lines.every((l) => isObject(l) && Array.isArray(l.cells) && l.cells.every((c) => isObject(c) && Array.isArray(c.equipment))),
  )
}

/** 單台設備的形狀問題；合法回傳 null。 */
function equipmentShapeProblem(e: unknown): string | null {
  if (!isObject(e)) return '設備不是物件'
  if (!isText(e.id)) return '設備編號必須是非空字串'
  if (!isText(e.name)) return `設備 ${e.id} 的名稱必須是非空字串`
  if (!isText(e.model)) return `設備 ${e.id} 的型號必須是非空字串`
  const f = e.footprint
  if (!isObject(f) || !isFiniteNumber(f.x) || !isFiniteNumber(f.z)) return `設備 ${e.id} 的佔地座標必須是有限數值`
  if (!isPositive(f.width) || !isPositive(f.depth)) return `設備 ${e.id} 的寬與深必須大於 0`
  if (!ROTATIONS.includes(f.rotation as number)) return `設備 ${e.id} 的旋轉只能是 0/90/180/270`
  if (e.params !== undefined && (!isObject(e.params) || !Object.values(e.params).every(isFiniteNumber)))
    return `設備 ${e.id} 的參數值必須是有限數值`
  return null
}

const ACTOR_TYPES = ['worker', 'agv']

/** 移動體的形狀問題；合法回傳 null。 */
function actorShapeProblem(a: unknown): string | null {
  if (!isObject(a)) return '移動體不是物件'
  if (!isText(a.id)) return '移動體編號必須是非空字串'
  if (!isText(a.name)) return `移動體 ${a.id} 的名稱必須是非空字串`
  if (!ACTOR_TYPES.includes(a.type as string)) return `移動體 ${a.id} 的類型只能是 ${ACTOR_TYPES.join('/')}`
  if (!isPositive(a.cycleSeconds)) return `移動體 ${a.id} 的週期必須大於 0`
  if (!Array.isArray(a.route) || a.route.length < 2) return `移動體 ${a.id} 的路線至少要 2 個點`
  let dwell = 0
  for (const w of a.route) {
    if (!isObject(w) || !isFiniteNumber(w.x) || !isFiniteNumber(w.z)) return `移動體 ${a.id} 的路線點必須是有限數值`
    if (w.dwell !== undefined && !(isFiniteNumber(w.dwell) && w.dwell >= 0)) return `移動體 ${a.id} 的停留時間不可為負`
    dwell += (w.dwell as number | undefined) ?? 0
  }
  if (dwell >= (a.cycleSeconds as number)) return `移動體 ${a.id} 的停留時間總和必須小於週期`
  return null
}

/** 環境設定的形狀問題；合法回傳 null。 */
function environmentShapeProblem(e: unknown): string | null {
  if (!isObject(e) || !isObject(e.island)) return '環境設定需含 island'
  const i = e.island
  if (![i.radius, i.plateauRadius, i.beachWidth].every(isPositive) || !isFiniteNumber(i.seed)) return '島嶼半徑、平台、沙灘寬度必須為正數，seed 為數值'
  if ((i.plateauRadius as number) >= (i.radius as number) - (i.beachWidth as number)) return '島嶼平台必須小於陸地（半徑扣除沙灘）'
  if (!isPositive(e.dayCycleSeconds) || !isPositive(e.waveSeconds)) return '日週期與海浪週期必須為正數'
  const ratio = (e.dayCycleSeconds as number) / (e.waveSeconds as number)
  if (Math.abs(ratio - Math.round(ratio)) > 1e-9) return '日週期必須是海浪週期的整數倍'
  return null
}

function withinBounds(e: Equipment, bounds: Site['bounds']): boolean {
  const r = footprintRect(e.footprint)
  const hw = bounds.width / 2 + EPSILON
  const hd = bounds.depth / 2 + EPSILON
  return r.minX >= -hw && r.maxX <= hw && r.minZ >= -hd && r.maxZ <= hd
}

/** 載入產線配置：錯誤以值回傳（不丟例外），一次列出所有問題。 */
export function parseLayout(raw: unknown, catalog: Catalog): ParseResult {
  if (!isSiteShape(raw)) {
    return { ok: false, errors: [{ code: 'INVALID_SHAPE', message: '產線配置結構不合法（需含正數的 bounds、cycleSeconds，以及 areas→lines→cells→equipment）' }] }
  }
  const errors: LayoutError[] = []
  const placed: PlacedEquipment[] = []
  const seen = new Set<string>()
  const reported = new Set<string>()

  for (const area of raw.areas)
    for (const line of area.lines)
      for (const cell of line.cells)
        for (const candidate of cell.equipment as unknown[]) {
          const problem = equipmentShapeProblem(candidate)
          if (problem) {
            const id = isObject(candidate) && isText(candidate.id) ? candidate.id : undefined
            errors.push({ code: 'INVALID_SHAPE', ...(id ? { equipmentId: id } : {}), message: problem })
            continue
          }
          const equipment = candidate as Equipment
          if (seen.has(equipment.id)) {
            if (!reported.has(equipment.id)) errors.push({ code: 'DUPLICATE_ID', equipmentId: equipment.id, message: `設備編號 ${equipment.id} 重複` })
            reported.add(equipment.id)
          }
          seen.add(equipment.id)
          const model = catalog[equipment.model]
          if (!model) {
            errors.push({ code: 'UNKNOWN_MODEL', equipmentId: equipment.id, message: `設備 ${equipment.id} 的型號 ${equipment.model} 不在型號目錄中` })
            continue
          }
          if (!withinBounds(equipment, raw.bounds)) {
            errors.push({ code: 'OUT_OF_BOUNDS', equipmentId: equipment.id, message: `設備 ${equipment.id} 超出廠區邊界` })
          }
          const unknown = Object.keys(equipment.params ?? {}).filter((k) => !model.params.includes(k))
          if (unknown.length) {
            errors.push({ code: 'UNKNOWN_PARAM', equipmentId: equipment.id, message: `設備 ${equipment.id} 的參數 ${unknown.join(', ')} 不在型號 ${equipment.model} 允許的清單（${model.params.join(', ') || '無'}）` })
          } else if (model.kind === 'robot-arm') {
            const problem = armReachProblem(armParamsOf(equipment, raw.cycleSeconds))
            if (problem) errors.push({ code: 'UNREACHABLE', equipmentId: equipment.id, message: `手臂 ${equipment.id} 的${problem}` })
          }
          placed.push({
            equipment,
            kind: model.kind,
            ...(model.variant ? { variant: model.variant } : {}),
            path: { site: raw.id, area: area.id, line: line.id, cell: cell.id },
          })
        }

  const actors: Actor[] = []
  for (const candidate of (Array.isArray(raw.actors) ? raw.actors : []) as unknown[]) {
    const problem = actorShapeProblem(candidate)
    if (problem) {
      const id = isObject(candidate) && isText(candidate.id) ? candidate.id : undefined
      errors.push({ code: 'INVALID_SHAPE', ...(id ? { equipmentId: id } : {}), message: problem })
      continue
    }
    const actor = candidate as Actor
    if (seen.has(actor.id)) errors.push({ code: 'DUPLICATE_ID', equipmentId: actor.id, message: `編號 ${actor.id} 與其他設備或移動體重複` })
    seen.add(actor.id)
    const hw = raw.bounds.width / 2 + EPSILON
    const hd = raw.bounds.depth / 2 + EPSILON
    if (actor.route.some((w) => Math.abs(w.x) > hw || Math.abs(w.z) > hd)) {
      errors.push({ code: 'OUT_OF_BOUNDS', equipmentId: actor.id, message: `移動體 ${actor.id} 的路線超出廠區邊界` })
    }
    actors.push(actor)
  }

  if (raw.environment !== undefined) {
    const problem = environmentShapeProblem(raw.environment)
    if (problem) errors.push({ code: 'INVALID_SHAPE', message: problem })
    else {
      const env = raw.environment as EnvironmentSpec
      const corner = Math.hypot(raw.bounds.width / 2, raw.bounds.depth / 2)
      if (corner > env.island.plateauRadius) {
        errors.push({ code: 'OFF_ISLAND', message: `廠區（對角半徑 ${corner.toFixed(1)} m）超出島嶼平台（半徑 ${env.island.plateauRadius} m）` })
      }
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, site: raw, placed, actors }
}
