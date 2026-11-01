import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useMemo, type CSSProperties } from 'react'
import * as THREE from 'three'
import layoutJson from '../data/factory-layout.json'
import { catalog } from './domain/catalog'
import { parseLayout } from './domain/parseLayout'
import { t } from './i18n/zh-TW'
import { Building } from './scene/Building'
import { SimClockProvider, clockFromUrl } from './scene/clock'
import { Effects } from './scene/Effects'
import { Environment } from './scene/Environment'
import { Factory } from './scene/Factory'
import { Probe, probeEnabled } from './scene/Probe'
import { Props } from './scene/Props'
import { camera, color } from './theme/tokens'

const hud: CSSProperties = {
  position: 'absolute',
  left: 24,
  top: 20,
  padding: '12px 16px',
  borderRadius: 8,
  background: color.hudBg,
  color: color.hudText,
  fontFamily: '"Noto Sans TC", "PingFang TC", system-ui, sans-serif',
  pointerEvents: 'none',
}

export function App() {
  const parsed = useMemo(() => parseLayout(layoutJson, catalog), [])
  if (!parsed.ok) {
    return (
      <div role="alert" style={{ ...hud, pointerEvents: 'auto' }}>
        <strong>{t.layoutInvalid}</strong>
        <ul>
          {parsed.errors.map((e, i) => (
            <li key={i}>{e.message}</li>
          ))}
        </ul>
      </div>
    )
  }
  const { site, placed } = parsed
  return (
    <div style={{ position: 'fixed', inset: 0, background: color.background }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: camera.fov, position: camera.position, near: 0.1, far: 200 }}
        gl={{ antialias: false, toneMapping: THREE.NoToneMapping, preserveDrawingBuffer: true }}
      >
        <SimClockProvider clock={clockFromUrl(window.location.search)}>
          <Suspense fallback={null}>
            <Environment site={site} />
            <Building site={site} placed={placed} />
            <Factory site={site} placed={placed} />
            <Props />
            <Effects />
            {probeEnabled() && <Probe />}
          </Suspense>
        </SimClockProvider>
        <OrbitControls makeDefault target={camera.target} maxPolarAngle={Math.PI / 2 - 0.05} />
      </Canvas>
      <div style={hud}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{t.title}</div>
        <div style={{ fontSize: 14, opacity: 0.85, marginTop: 4 }}>{t.subtitle}</div>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>{t.hint}</div>
      </div>
    </div>
  )
}
