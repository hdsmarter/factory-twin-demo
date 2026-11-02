/** UI 文字字典（zh-TW）。元件只引用 key，不寫死文字。 */
export const zhTW = {
  title: '工廠分身展示',
  subtitle: '通用組裝產線 · 即時 3D 寫實渲染',
  hint: '拖曳旋轉 · 滾輪縮放 · 右鍵平移',
  layoutInvalid: '產線配置無法載入',
  viewIsland: '島嶼全景',
  viewInterior: '廠內',
  view2d: '2D 插畫',
  viewSwitcher: '切換視角',
  iso2dLabel: '工廠等角插畫：與 3D 場景共用同一份產線資料',
  subtitleIsland: '荒島工廠 · 即時 3D 寫實場景',
  subtitle2d: '等角插畫 · 與 3D 共用同一份資料',
  hint2d: '拖曳平移 · 滾輪或雙指縮放 · 雙擊重設',
  iso2dDescription: '拖曳平移，滾輪或雙指縮放，雙擊重設；鍵盤：方向鍵平移，加號減號縮放，0 重設',
} as const

export type Messages = typeof zhTW
export const t = zhTW
