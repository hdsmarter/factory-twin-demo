/**
 * 等角投影：3D 等角相機與 2D 插畫共用的唯一數學定義。
 * 相機位於 ISO_DIRECTION 方向（左前上方，與廠內預設視角同側）看向原點；
 * 前牆（+z）與左牆（-x）面向相機，剖面視角時隱藏。
 */
const S3 = Math.sqrt(3)
const S2 = Math.SQRT2
const S6 = Math.sqrt(6)

/** 從場景指向相機的單位向量 */
export const ISO_DIRECTION = { x: -1 / S3, y: 1 / S3, z: 1 / S3 } as const

/**
 * 世界座標 → 等角畫面座標（公尺為單位，u 向右、v 向下，與 SVG 一致）。
 * 推導：right = (1,0,1)/√2；up = (1,2,-1)/√6；v = -up·p。
 */
export function isoProject(x: number, y: number, z: number): { u: number; v: number } {
  return { u: (x + z) / S2, v: (z - x - 2 * y) / S6 }
}
