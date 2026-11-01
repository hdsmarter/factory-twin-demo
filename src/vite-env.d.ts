/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 模型副檔名（預設 glb；Artifact 部署用 json） */
  readonly VITE_MODEL_EXT?: string
  /** 'room' = 以 RoomEnvironment 取代 HDRI（Artifact 部署用） */
  readonly VITE_ENV_MAP?: string
}
