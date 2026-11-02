/**
 * 2D 等角插畫的配色（扁平色塊＋粗黑描邊＋留白）。
 * view2d 元件內不寫色碼，一律取自這裡。三色方塊：top（受光）、left（-x 面向相機）、right（+z 面向相機）。
 */
export const ink = '#1d1d1f'

export const paper = '#fbf7ef'

export const sea = {
  deep: '#7cc4d8',
  shallow: '#a9dde6',
  wave: '#e9f7f9',
} as const

export const land = {
  sand: '#f1d9a6',
  sandShade: '#d9b97c',
  grass: '#9fcf8a',
  plateau: '#b7dc9c',
} as const

export const tree = {
  trunk: '#8a5a3c',
  crowns: ['#5fae6b', '#7cc276', '#4e9a69'],
} as const

export const building = {
  floor: '#dcdcd6',
  apron: '#c9c6bd',
  wallBack: '#eef0f2',
  wallSide: '#cfd5db',
  wallTrim: '#5c6670',
  areaMark: '#f2c200',
} as const

export type Tone = { top: string; left: string; right: string }

export const equipment = {
  conveyorFrame: { top: '#3c6e9e', left: '#2b5279', right: '#1f4e79' },
  belt: { top: '#55595f', left: '#44474c', right: '#3a3d42' },
  cnc: { top: '#f4f6f8', left: '#d9dee3', right: '#c4cbd2' },
  cncBase: { top: '#4a5056', left: '#363b40', right: '#2b2f33' },
  machineAccent: { top: '#3c6e9e', left: '#2b5279', right: '#1f4e79' },
  rack: { top: '#7f8890', left: '#6a737b', right: '#59616a' },
  crate: { top: '#d6a96b', left: '#c0925a', right: '#a87d4b' },
  pallet: { top: '#c99a63', left: '#b08350', right: '#946c40' },
  workpiece: { top: '#e3e7eb', left: '#c4cad0', right: '#a9b0b7' },
  armBase: { top: '#3a3f44', left: '#2b2f33', right: '#22262a' },
  armLink: '#e2702a',
  armJoint: '#2b2f33',
  glass: '#bcd3e3',
  statusGreen: '#38d86b',
  inspectionLight: '#5fd4ff',
} as const satisfies Record<string, Tone | string>

export const people = {
  shadow: 'rgba(29, 29, 31, 0.18)',
  shoe: '#2b2f33',
} as const

/** 骨架人物外觀：遠側肢體（far）較暗以製造前後景深；依人員序號輪替 */
export interface WorkerLook {
  skin: string
  skinFar: string
  shirt: string
  shirtFar: string
  pants: string
  pantsFar: string
  hair: string
  /** 頭飾：安全帽／馬尾／包頭 */
  headwear: 'helmet' | 'ponytail' | 'bun'
  helmet: string
}

export const workerLooks: readonly WorkerLook[] = [
  { skin: '#f1c7a5', skinFar: '#d9ae8c', shirt: '#f08a24', shirtFar: '#cf7419', pants: '#2f3e56', pantsFar: '#243146', hair: '#2b211b', headwear: 'helmet', helmet: '#f2c200' },
  { skin: '#c98e66', skinFar: '#b07754', shirt: '#3c6e9e', shirtFar: '#2f5a83', pants: '#2b5279', pantsFar: '#204062', hair: '#2b1d16', headwear: 'ponytail', helmet: '#f2c200' },
  { skin: '#e8b58e', skinFar: '#cf9c76', shirt: '#4e9a69', shirtFar: '#3f8157', pants: '#55595f', pantsFar: '#44474c', hair: '#6b4a2e', headwear: 'bun', helmet: '#f2c200' },
]

export const agv = {
  body: { top: '#f6c945', left: '#e0b032', right: '#c99a22' },
  deck: '#3a3d42',
  lightMove: '#38d86b',
  lightDock: '#5fd4ff',
} as const
