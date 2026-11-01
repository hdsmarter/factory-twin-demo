/** UI 文字字典（zh-TW）。元件只引用 key，不寫死文字。 */
export const zhTW = {
  title: '工廠分身展示',
  subtitle: '通用組裝產線 · 即時 3D 寫實渲染',
  hint: '拖曳旋轉 · 滾輪縮放 · 右鍵平移',
  layoutInvalid: '產線配置無法載入',
} as const

export type Messages = typeof zhTW
export const t = zhTW
