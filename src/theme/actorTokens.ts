/** 移動體（人員、AGV）與場景效果（光束、粉塵）的設計 token：元件內不硬編碼色碼與數值參數。 */

export const worker = {
  model: 'worker_human',
  /** 等比縮放後的身高（公尺） */
  height: 1.75,
  /** 模型預設面向 +z；rotation.y = heading + yawOffset 讓前進方向 = (cos h, 0, -sin h) */
  yawOffset: Math.PI / 2,
  clips: { walk: 'Human Armature|Walk', work: 'Human Armature|Working', idle: 'Human Armature|Idle' },
  /** 走路動畫一個循環對應的移動距離（公尺，兩步） */
  strideLength: 1.4,
  /** 模型沒有 UV，改依主要骨骼為頂點上色；工作服顏色依人員順序輪替 */
  outfits: ['#e2702a', '#2f6fb3', '#3f8f5a'] as readonly string[],
  skin: '#e0b48f',
  pants: '#2c3440',
  boots: '#1c1f24',
  hardHat: '#f2c200',
  /** 安全帽半徑與相對頭頂的下移量（公尺） */
  hatRadius: 0.14,
  hatDrop: 0.06,
} as const

export const agv = {
  length: 1.2,
  width: 0.8,
  height: 0.35,
  wheelRadius: 0.08,
  wheelWidth: 0.05,
  scannerRadius: 0.06,
  scannerHeight: 0.08,
  lightStripHeight: 0.04,
  lightIntensity: 2.4,
  /** 搬運展示：在這些 AGV 上方放棧板＋料件 */
  carrierIds: ['AGV-01'] as readonly string[],
  palletHeight: 0.12,
  cargoSize: 0.45,
  color: {
    body: '#f0f2f4',
    bumper: '#2b2f33',
    wheel: '#15181b',
    scanner: '#d9a400',
    lightMove: '#38d86b',
    lightDock: '#3d8bff',
    pallet: '#b08350',
    cargo: '#4a6fa5',
  },
} as const

export const beams = {
  color: '#fff3d6',
  /** 峰值不透明度（加法混合，宜淡） */
  intensity: 0.07,
  spacing: 5,
  /** 頂部寬度（沿 x）與燈帶深度（沿 z） */
  topWidth: 1.6,
  topDepth: 0.6,
  /** 底部擴散倍率（> 1 = 下寬，呈光錐） */
  spread: 1.8,
  /** 依太陽方向傾斜的程度（0 = 垂直） */
  sunTilt: 0.35,
  /** 邊緣柔化範圍（0–0.5） */
  edgeSoftness: 0.45,
} as const

export const dust = {
  count: 2200,
  seed: 20261102,
  /** 落在光束附近的比例 */
  nearBeamRatio: 0.6,
  nearBeamSpread: 1.6,
  size: 0.05,
  amplitude: 0.35,
  frequency: 0.12,
  color: '#fff6e0',
  opacity: 0.55,
} as const
