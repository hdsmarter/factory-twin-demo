import type { Catalog } from './layout'

/** 設備型號目錄：配置中的 equipment.model 必須是這裡的鍵。新增型號只改這裡（OCP）。 */
export const catalog: Catalog = {
  'CONV-BELT': { kind: 'conveyor', label: '皮帶輸送機' },
  'ARM-6AX': { kind: 'robot-arm', label: '六軸機械手臂' },
  'CNC-MILL': { kind: 'machine', label: 'CNC 加工機', variant: 'cnc' },
  'INSP-VISION': { kind: 'machine', label: '視覺檢測站', variant: 'inspection' },
  'RACK-STEEL': { kind: 'storage', label: '物料料架', variant: 'rack' },
  'PALLET-STATION': { kind: 'storage', label: '成品棧板站', variant: 'pallet' },
}
