/**
 * 工廠分身的領域契約（ISA-95：Site → Area → Line → Cell → Equipment）。
 * 純型別，不依賴任何框架或 I/O。座標系：廠區中心為原點，x 向右、z 向前，單位公尺。
 */

export type Rotation = 0 | 90 | 180 | 270

/** 設備在廠區平面上的佔地：中心點 + 未旋轉前的寬（x）與深（z）。 */
export interface Footprint {
  x: number
  z: number
  width: number
  depth: number
  rotation: Rotation
}

export interface Equipment {
  id: string
  name: string
  /** 型號目錄中的鍵 */
  model: string
  footprint: Footprint
  /** 型號專屬參數（例如輸送帶料件數），只放數值 */
  params?: Record<string, number>
}

export interface Cell {
  id: string
  name: string
  equipment: Equipment[]
}

export interface Line {
  id: string
  name: string
  cells: Cell[]
}

export interface Area {
  id: string
  name: string
  lines: Line[]
}

/** 路線站點；dwell > 0 表示在此停留（秒） */
export interface Waypoint {
  x: number
  z: number
  dwell?: number
}

export type ActorType = 'worker' | 'agv'

/** 移動體：工作人員或 AGV，沿封閉路線循環 */
export interface Actor {
  id: string
  name: string
  type: ActorType
  cycleSeconds: number
  route: Waypoint[]
}

/** 島嶼：圓形陸地，中心平台放廠房，外圈為沙灘 */
export interface IslandSpec {
  radius: number
  plateauRadius: number
  beachWidth: number
  seed: number
}

export interface EnvironmentSpec {
  island: IslandSpec
  /** 日週期（秒）：太陽在早晨與傍晚之間往返 */
  dayCycleSeconds: number
  /** 海浪週期（秒）；必須整除日週期 */
  waveSeconds: number
}

export interface Site {
  id: string
  name: string
  bounds: { width: number; depth: number; height: number }
  /** 生產週期（秒）：所有動作以此週期循環 */
  cycleSeconds: number
  areas: Area[]
  environment?: EnvironmentSpec
  actors?: Actor[]
}

export type EquipmentKind = 'conveyor' | 'robot-arm' | 'machine' | 'storage'

export type MachineVariant = 'cnc' | 'inspection'
export type StorageVariant = 'rack' | 'pallet'
export type EquipmentVariant = MachineVariant | StorageVariant

/** 型號：machine / storage 必須指定變體（型別保證，不靠執行期退回預設） */
export type EquipmentModel =
  | { kind: 'conveyor' | 'robot-arm'; label: string; variant?: undefined; params: readonly string[] }
  | { kind: 'machine'; label: string; variant: MachineVariant; params: readonly string[] }
  | { kind: 'storage'; label: string; variant: StorageVariant; params: readonly string[] }

export type Catalog = Readonly<Record<string, EquipmentModel>>

export interface HierarchyPath {
  site: string
  area: string
  line: string
  cell: string
}

/** 攤平後的設備：附上型號種類與所屬階層。 */
export interface PlacedEquipment {
  equipment: Equipment
  kind: EquipmentKind
  variant?: EquipmentVariant
  path: HierarchyPath
}

export type LayoutErrorCode = 'DUPLICATE_ID' | 'UNKNOWN_MODEL' | 'OUT_OF_BOUNDS' | 'INVALID_SHAPE' | 'UNREACHABLE' | 'UNKNOWN_PARAM' | 'OFF_ISLAND'

export interface LayoutError {
  code: LayoutErrorCode
  equipmentId?: string
  message: string
}

export type ParseResult =
  | { ok: true; site: Site; placed: PlacedEquipment[]; actors: Actor[] }
  | { ok: false; errors: LayoutError[] }
