import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DefaultLoadingManager } from 'three'
import { dataUrlToBlobUrl } from './platform/dataUrl'
import { App } from './App'

// 所有 three.js 載入器（GLTFLoader 的 buffer 與貼圖）共用：data: → blob:（Artifact CSP 只允許後者）
DefaultLoadingManager.setURLModifier(dataUrlToBlobUrl)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
