/** 生產週期內的相位，值域 [0, 1)。對任何實數 t（含負數）皆成立，t 與 t+cycle 得到相同相位。 */
export function cyclePhase(t: number, cycleSeconds: number): number {
  const p = (t / cycleSeconds) % 1
  const wrapped = p < 0 ? p + 1 : p
  // >= 1：浮點捨入；=== 0：把 -0 正規化成 +0
  return wrapped >= 1 || wrapped === 0 ? 0 : wrapped
}

/** 角度（度，three.js Y 軸旋轉慣例）→ 本地 +x 軸在世界平面上的單位向量。 */
export function directionOf(rotationDeg: number): { x: number; z: number } {
  const r = (rotationDeg * Math.PI) / 180
  return { x: Math.round(Math.cos(r) * 1e12) / 1e12, z: Math.round(-Math.sin(r) * 1e12) / 1e12 }
}
