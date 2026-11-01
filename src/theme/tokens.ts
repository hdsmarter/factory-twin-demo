/** 設計 token：場景色彩、材質與光照參數的唯一來源（元件內不硬編碼數值色碼）。 */
export const color = {
  robotBody: '#e2702a',
  robotJoint: '#2b2f33',
  machineShell: '#e6e9ec',
  machineAccent: '#1f4e79',
  machineDark: '#22272c',
  steel: '#8a9097',
  steelDark: '#4a5056',
  safetyYellow: '#f2c200',
  walkwayGreen: '#3f7d58',
  statusGreen: '#38d86b',
  inspectionLight: '#5fd4ff',
  workpiece: '#c4cad0',
  palletWood: '#b08350',
  roofBeam: '#5d646b',
  skylight: '#fdf6e3',
  glass: '#9fb7c9',
  hudText: '#f5f7fa',
  hudBg: 'rgba(16, 20, 24, 0.72)',
  background: '#101418',
  floorTint: '#6c737a',
  apron: '#2b2e31',
  beltTint: '#4a4d52',
  wallPanel: '#b9c0c6',
  wallSeam: 'rgba(40, 46, 52, 0.45)',
  wallKick: '#5d6670',
} as const

export const light = {
  environmentIntensity: 0.55,
  sunIntensity: 2.6,
  sunPosition: [14, 22, 10] as [number, number, number],
  hemiSky: '#dfe8f0',
  hemiGround: '#4a443c',
  hemiIntensity: 0.35,
  skylightIntensity: 3.2,
  shadowMapSize: 4096,
} as const

export const camera = {
  fov: 42,
  position: [-10.5, 6.2, 10.5] as [number, number, number],
  target: [-2.2, 0.7, -2.4] as [number, number, number],
} as const

export const postfx = {
  aoRadius: 1.2,
  aoIntensity: 2.2,
  bloomThreshold: 0.9,
  bloomIntensity: 0.6,
  vignetteDarkness: 0.45,
} as const
