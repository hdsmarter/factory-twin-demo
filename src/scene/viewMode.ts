import { createContext, createElement, useContext, type ReactNode } from 'react'

/** 視角：島嶼全景（外殼完整）／廠內（剖面：屋頂與前牆隱藏）／等角 2D 插畫 */
export type ViewMode = 'island' | 'interior' | 'iso2d'

export const ViewModeContext = createContext<ViewMode>('interior')

export function ViewModeProvider({ mode, children }: { mode: ViewMode; children: ReactNode }) {
  return createElement(ViewModeContext.Provider, { value: mode }, children)
}

export const useViewMode = () => useContext(ViewModeContext)
