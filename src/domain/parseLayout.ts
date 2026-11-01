import { footprintRect } from './geometry'
import type { Catalog, Equipment, LayoutError, ParseResult, PlacedEquipment, Site } from './layout'

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
          placed.push({
            equipment,
            kind: model.kind,
            ...(model.variant ? { variant: model.variant } : {}),
            path: { site: raw.id, area: area.id, line: line.id, cell: cell.id },
          })
        }

  return errors.length ? { ok: false, errors } : { ok: true, site: raw, placed }
}
