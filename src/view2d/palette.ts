/**
 * 2D 等角插畫的配色（Open Peeps 風格：扁平色塊＋粗黑描邊＋留白）。
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
  skin: '#ffffff',
  shadow: 'rgba(29, 29, 31, 0.18)',
} as const

export const agv = {
  body: { top: '#f6c945', left: '#e0b032', right: '#c99a22' },
  deck: '#3a3d42',
  lightMove: '#38d86b',
  lightDock: '#5fd4ff',
} as const
