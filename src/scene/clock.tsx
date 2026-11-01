import { createContext, useContext, type ReactNode } from 'react'

/**
 * 模擬時間來源（DIP）：場景只依賴這個介面。
 * 即時預覽用 realtimeClock；逐格錄影（階段 5）注入另一個實作，場景程式不需修改。
 */
export interface SimClock {
  /** 由渲染器的經過秒數換算成模擬時間 t（秒） */
  now(elapsedSeconds: number): number
}

export const realtimeClock: SimClock = { now: (elapsed) => elapsed }

/** 固定在某個時間點的時鐘（凍結畫面：品質檢查、截圖、逐格輸出的基礎） */
export const frozenClock = (t: number): SimClock => ({ now: () => t })

/** 網址帶 ?freeze=<秒> 時凍結模擬時間，否則即時 */
export function clockFromUrl(search: string): SimClock {
  const v = new URLSearchParams(search).get('freeze')
  const t = v === null ? Number.NaN : Number(v)
  return Number.isFinite(t) ? frozenClock(t) : realtimeClock
}

const ClockContext = createContext<SimClock>(realtimeClock)

export function SimClockProvider({ clock, children }: { clock: SimClock; children: ReactNode }) {
  return <ClockContext.Provider value={clock}>{children}</ClockContext.Provider>
}

export const useSimClock = () => useContext(ClockContext)

/**
 * 模擬時間軸：整個 App 共用一條（3D、2D、探針都從這裡讀 t），切換視角時時間連續。
 * 即時模式以 App 掛載時刻為起點；凍結／逐格時鐘時結果與牆鐘無關（決定性）。
 */
export interface SimTimeline {
  /** 目前模擬時間（秒） */
  now(): number
}

export function createTimeline(clock: SimClock, epochMs: number = performance.now()): SimTimeline {
  return { now: () => clock.now((performance.now() - epochMs) / 1000) }
}

const TimelineContext = createContext<SimTimeline | null>(null)

export function SimTimelineProvider({ timeline, children }: { timeline: SimTimeline; children: ReactNode }) {
  return <TimelineContext.Provider value={timeline}>{children}</TimelineContext.Provider>
}

export function useSimTimeline(): SimTimeline {
  const tl = useContext(TimelineContext)
  if (!tl) throw new Error('useSimTimeline 必須在 <SimTimelineProvider> 之內使用')
  return tl
}
