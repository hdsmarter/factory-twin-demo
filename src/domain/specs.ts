/**
 * 設備規格常數（公尺）：模擬、配置驗證、3D 與 2D 視圖共用的唯一來源。
 * 手臂的取放高度必須與這些表面高度一致（見 factoryLayout.test）。
 */
export const CONVEYOR_BELT_TOP = 0.85
export const WORKPIECE_HEIGHT = 0.14
export const PALLET_TOP = 0.15
export const DEFAULT_CONVEYOR_ITEMS = 4

/** AGV 外形（公尺）：3D 模型與 2D 插畫共用 */
export const AGV_DIMENSIONS = { length: 1.2, width: 0.8, height: 0.39 } as const

/** 工作人員身高（公尺）：3D 模型縮放與 2D 人物共用 */
export const WORKER_HEIGHT = 1.75

/** 島嶼森林的樹木數量（3D 森林與 2D 插畫共用） */
export const FOREST_COUNT = 90
