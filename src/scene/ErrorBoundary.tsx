import { Component, type ReactNode } from 'react'

/** 攔截子樹的載入／渲染錯誤，改顯示 fallback（裝飾道具壞掉不應拖垮整個場景）。 */
export class ErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.warn('[scene] 子場景載入失敗，已略過：', error instanceof Error ? error.message : error)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
