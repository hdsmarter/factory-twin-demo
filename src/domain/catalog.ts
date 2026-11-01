import type { Catalog } from './layout'

const ARM_PARAMS = ['pickDx', 'pickDz', 'pickY', 'placeDx', 'placeDz', 'placeY'] as const

/**
 * 設備型號目錄：配置中的 equipment.model 必須是這裡的鍵。新增型號只改這裡（OCP）。
 * params：該型號允許的參數名稱；配置出現清單外的名稱會被拒絕（UNKNOWN_PARAM）。
 */
export const catalog: Catalog = {
  'CONV-BELT': { kind: 'conveyor', label: '皮帶輸送機', params: ['itemCount'] },
  'ARM-6AX': { kind: 'robot-arm', label: '六軸機械手臂', params: ARM_PARAMS },
  'CNC-MILL': { kind: 'machine', label: 'CNC 加工機', variant: 'cnc', params: [] },
  'INSP-VISION': { kind: 'machine', label: '視覺檢測站', variant: 'inspection', params: [] },
  'RACK-STEEL': { kind: 'storage', label: '物料料架', variant: 'rack', params: [] },
  'PALLET-STATION': { kind: 'storage', label: '成品棧板站', variant: 'pallet', params: [] },
}
