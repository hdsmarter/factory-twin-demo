/** 荒島環境的設計 token：天空、太陽光、海面、地形、森林、霧與廠房外殼（元件內不硬編碼數值色碼）。 */

const DEG = Math.PI / 180

export const sky = {
  /** Sky 盒子縮放（著色器把深度推到遠平面，只要比相機到原點的距離大即可） */
  scale: 10000,
  turbidity: 2.5,
  rayleigh: 2.4,
  mieCoefficient: 0.003,
  mieDirectionalG: 0.82,
  /** 天空亮度係數（避免 HDR 天空觸發泛光、色調映射後偏白） */
  exposure: 0.35,
  /** 雲層動畫：Sky 的 time uniform = 模擬秒數 × 此係數 */
  cloudTimeScale: 1,
} as const

export const sunLight = {
  /** 光源到原點的距離（公尺） */
  distance: 60,
  /** 陰影相機半寬（涵蓋廠房 ±25 m） */
  shadowExtent: 25,
  shadowNear: 1,
  shadowFar: 140,
  shadowBias: -0.0004,
  shadowNormalBias: 0.03,
  /** 仰角在 low → high 之間時，強度與色溫由暖弱漸變到白亮 */
  lowElevation: 8 * DEG,
  highElevation: 40 * DEG,
  intensityLow: 1.1,
  intensityHigh: 2.8,
  colorLow: '#ffb27a',
  colorHigh: '#fff6e8',
} as const

export const ocean = {
  /** 海面平面邊長（公尺） */
  size: 8000,
  /** 反射貼圖解析度 */
  textureSize: 512,
  /** 相對於 assets/ 的路徑（由 assetUrl.file 組成完整網址） */
  normalMap: 'textures/waternormals.jpg',
  sunColor: '#ffffff',
  waterColor: '#0a7a8a',
  distortionScale: 2.4,
  alpha: 1,
  /** Water 的 time uniform = 模擬秒數 × 此係數 */
  timeScale: 0.6,
} as const

export const terrain = {
  /** 地形網格半寬 = 島嶼半徑 × 此係數（要超過起伏後的海岸線，邊緣沒入海中） */
  extentFactor: 1.27,
  segments: 256,
  /** 整體再下移（公尺），避免平台頂與廠房地板 z-fighting */
  sink: 0.02,
  /** 貼圖每重複一次涵蓋的公尺數 */
  sandTileMeters: 6,
  grassTileMeters: 8,
  /** 地形原始高度（未下移）低於 sandTop 全為沙，高於 grassFull 全為草 */
  sandTop: 0.6,
  grassFull: 1.6,
  roughness: 0.95,
} as const

export const forest = {
  /** 樹高（公尺）：模型等比縮放到此高度後再乘落點的 scale */
  treeHeight: 9,
  /** 岩石群、蕨類寬度（公尺） */
  rockWidth: 4,
  fernWidth: 1.4,
  /** 樹與岩石下沉量（公尺），坡地上不懸空 */
  sink: 0.3,
  /** 半透明樹葉改用 alphaTest（實例化繪製不需排序） */
  leafAlphaTest: 0.5,
  rockCount: 28,
  fernCount: 140,
  /** 岩石散佈在丘陵外緣：海岸線內側此寬度的環帶 */
  rockBand: 14,
  /** 與樹木落點不同的種子偏移 */
  rockSeedOffset: 101,
  fernSeedOffset: 211,
} as const

export const fog = {
  color: '#bcd6e8',
  near: 520,
  far: 2800,
} as const

export const shell = {
  roofColor: '#8d969e',
  roofMetalness: 0.55,
  roofRoughness: 0.5,
  roofThickness: 0.25,
  /** 屋簷外伸（公尺） */
  roofOverhang: 0.6,
  /** 天窗開口寬度（公尺），中心在 z = ±depth/6，與廠內天窗燈帶一致 */
  skylightWidth: 1.4,
  skylightOpacity: 0.45,
  /** 捲門開口 */
  doorWidth: 8,
  doorHeight: 6,
  wallThickness: 0.25,
  wallRoughness: 0.55,
  wallMetalness: 0.2,
} as const
