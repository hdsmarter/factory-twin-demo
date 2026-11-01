import { OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, lazy, useEffect, useMemo, useState, type CSSProperties } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import layoutJson from '../data/factory-layout.json'
import { catalog } from './domain/catalog'
import type { Actor, PlacedEquipment, Site } from './domain/layout'
import { parseLayout } from './domain/parseLayout'
import { simulate } from './domain/simulate'
import { t as msg } from './i18n/zh-TW'
import { Building } from './scene/Building'
import { BuildingShell } from './scene/BuildingShell'
import { Effects } from './scene/Effects'
import { Environment } from './scene/Environment'
import { Factory } from './scene/Factory'
import { Probe, probeEnabled } from './scene/Probe'
import { Props } from './scene/Props'
import { Actors } from './scene/actors'
import { SimClockProvider, clockFromUrl, type SimClock } from './scene/clock'
import { Dust } from './scene/effects/Dust'
import { LightBeams } from './scene/effects/LightBeams'
import { Island } from './scene/island'
import { ViewModeProvider, type ViewMode } from './scene/viewMode'
import { camera, color, ui } from './theme/tokens'

/** 2D 插畫在切換時才載入（含 Open Peeps 人物素材） */
const IsoScene = lazy(() => import('./view2d/IsoScene').then((m) => ({ default: m.IsoScene })))

const font = '"Noto Sans TC", "PingFang TC", system-ui, sans-serif'

const hud: CSSProperties = {
  position: 'absolute',
  left: 24,
  top: 20,
  padding: '12px 16px',
  borderRadius: 8,
  background: color.hudBg,
  color: color.hudText,
  fontFamily: font,
  pointerEvents: 'none',
}

/**
 * 2D 圖層：顯示時淡入；離開時立即隱藏（3D 一直在底層，不會閃）。
 * 不用 visibility 延遲轉場——主執行緒忙於 3D 渲染時轉場可能遲遲不結束（E2E 實測）。
 */
const overlay = (shown: boolean): CSSProperties => ({
  position: 'absolute',
  inset: 0,
  visibility: shown ? 'visible' : 'hidden',
  animation: shown ? `fade-in ${ui.fadeMs}ms ease` : 'none',
})

/** 相機預設位置：切換島嶼全景／廠內時移動相機與控制器目標 */
function CameraRig({ mode }: { mode: ViewMode }) {
  const cam = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  useEffect(() => {
    if (mode === 'iso2d') return
    const preset = mode === 'island' ? camera.island : camera.interior
    cam.position.set(...preset.position)
    controls?.target.set(...preset.target)
    controls?.update()
  }, [mode, cam, controls])
  return null
}

/** 2D 插畫：以同一個時鐘與 simulate() 逐幀更新（只在 2D 視角時運轉） */
function Iso2D({ site, placed, actors, clock, active }: { site: Site; placed: PlacedEquipment[]; actors: Actor[]; clock: SimClock; active: boolean }) {
  const [t, setT] = useState(() => clock.now(0))
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  useEffect(() => {
    if (!active) return
    const start = performance.now()
    let raf = 0
    const tick = () => {
      setT(clock.now((performance.now() - start) / 1000))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [active, clock])
  const state = useMemo(() => simulate(site, placed, t), [site, placed, t])
  return (
    <div role="img" aria-label={msg.iso2dLabel} style={{ width: '100%', height: '100%' }}>
      <Suspense fallback={null}>
        <IsoScene site={site} placed={placed} actors={actors} state={state} t={t} width={size.width} height={size.height} framing="factory" />
      </Suspense>
    </div>
  )
}

const MODES: { mode: ViewMode; label: string }[] = [
  { mode: 'island', label: msg.viewIsland },
  { mode: 'interior', label: msg.viewInterior },
  { mode: 'iso2d', label: msg.view2d },
]

function Switcher({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div role="group" aria-label={msg.viewSwitcher} style={{ position: 'absolute', right: 24, top: 20, display: 'flex', gap: 4, padding: 4, borderRadius: 10, background: color.hudBg }}>
      {MODES.map((m) => {
        const on = m.mode === mode
        return (
          <button
            key={m.mode}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(m.mode)}
            style={{
              font: `600 14px ${font}`,
              padding: '8px 14px',
              minHeight: 36,
              border: 0,
              borderRadius: 7,
              cursor: 'pointer',
              color: on ? color.buttonActiveText : color.hudText,
              background: on ? color.buttonActiveBg : 'transparent',
            }}
          >
            {m.label}
          </button>
        )
      })}
    </div>
  )
}

const SUBTITLE: Record<ViewMode, string> = { island: msg.subtitleIsland, interior: msg.subtitle, iso2d: msg.subtitle2d }

export function App() {
  const parsed = useMemo(() => parseLayout(layoutJson, catalog), [])
  const clock = useMemo(() => clockFromUrl(window.location.search), [])
  const [mode, setMode] = useState<ViewMode>('interior')
  const [visited2d, setVisited2d] = useState(false)
  useEffect(() => {
    if (mode === 'iso2d') setVisited2d(true)
  }, [mode])

  if (!parsed.ok) {
    return (
      <div role="alert" style={{ ...hud, pointerEvents: 'auto' }}>
        <strong>{msg.layoutInvalid}</strong>
        <ul>
          {parsed.errors.map((e, i) => (
            <li key={i}>{e.message}</li>
          ))}
        </ul>
      </div>
    )
  }
  const { site, placed, actors } = parsed
  const is2d = mode === 'iso2d'
  return (
    <div style={{ position: 'fixed', inset: 0, background: color.background }}>
      <style>{'@keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }'}</style>
      <div style={{ position: 'absolute', inset: 0 }}>
        <Canvas
          frameloop={is2d ? 'never' : 'always'}
          shadows
          dpr={[1, 2]}
          camera={{ fov: camera.fov, position: camera.interior.position, near: 0.1, far: camera.far }}
          gl={{ antialias: false, toneMapping: THREE.NoToneMapping, preserveDrawingBuffer: true }}
        >
          <SimClockProvider clock={clock}>
            <ViewModeProvider mode={mode}>
              <Suspense fallback={null}>
                <Environment site={site} />
                <Factory site={site} placed={placed}>
                  <Island site={site} />
                  <Actors actors={actors} />
                  <LightBeams site={site} />
                  <Dust site={site} />
                </Factory>
                <Building site={site} placed={placed} />
                <BuildingShell site={site} />
                <Props />
                <Effects />
                {probeEnabled() && <Probe />}
              </Suspense>
            </ViewModeProvider>
          </SimClockProvider>
          <OrbitControls makeDefault target={camera.interior.target} maxPolarAngle={Math.PI / 2 - 0.05} maxDistance={camera.maxDistance} />
          <CameraRig mode={mode} />
        </Canvas>
      </div>
      {visited2d && (
        <div style={{ ...overlay(is2d), background: color.iso2dBackground }}>
          <Iso2D site={site} placed={placed} actors={actors} clock={clock} active={is2d} />
        </div>
      )}
      <div style={hud}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{msg.title}</div>
        <div style={{ fontSize: 14, opacity: 0.85, marginTop: 4 }}>{SUBTITLE[mode]}</div>
        {!is2d && <div style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>{msg.hint}</div>}
      </div>
      <Switcher mode={mode} onChange={setMode} />
    </div>
  )
}
