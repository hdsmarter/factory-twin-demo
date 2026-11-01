# 設計：荒島工廠：人物/AGV、3D 場景效果、等角 2D 插畫與切換

## Bounded Context 與通用語言（DDD）
- 仍是 Factory Twin 單一 context；新增子模組：
  - `domain/actors.ts`：**Actor 移動體**（worker 工作人員 / agv 搬運車），**Route 路線**＝封閉折線，**Waypoint 站點**可設 dwell（停留秒數）；`actorPose(actor, t)`
  - `domain/environment.ts`：**Island 島嶼**（radius、plateauRadius 平台、beachWidth、seed）、`islandHeight(x,z)`、`isLand`、`forestPlacement`（種子化）、`sunAt(t)`、`wavePhase(t)`；**DayCycle 日週期**
  - `domain/projection.ts`：**等角投影** `isoProject(x,y,z)`；3D 等角相機與 2D 插畫共用 `ISO_AZIMUTH`、`ISO_ELEVATION`
- 錯誤碼新增：`UNREACHABLE`（手臂取放點不可達）、`UNKNOWN_PARAM`（型號不允許的參數名）、`OFF_ISLAND`（廠區不在陸地）；Actor 路線出界沿用 `OUT_OF_BOUNDS`（`equipmentId` 欄位放 actor id）

## 方案（KISS）
1. `Site` 擴充選填 `environment`、`actors`（舊配置與舊測試不受影響）。
2. 型號目錄加 `params` 允許清單；parseLayout 依清單擋未知參數；手臂以 `armReachProblem()`（robotArm.ts，與 IK 共用尺寸）檢查取放點與上方點可達。
3. `simulate()` 回傳再加 `actors`、`environment`；渲染層照舊只讀狀態。
4. 3D：Sky（太陽方向來自 sunAt）＋ Water（time uniform 來自 wavePhase）＋ 程式化島嶼地形（islandHeight）＋ Poly Haven 樹木岩石（forestPlacement）＋ 廠房外殼（屋頂、前牆、捲門開口；`viewMode` 決定剖面）＋ 人物（AnimationMixer.setTime(t) 決定性）＋ AGV（程式建模）＋ 光束（加法混合半透明體）＋ 粉塵（Points，位置為 t 的函數）。
5. 2D：`src/view2d/IsoScene.tsx`（SVG），所有座標經 `isoProject`；設備畫成等角扁平方塊、人員用 react-peeps、島嶼海岸線由 islandHeight 等高線取樣；海浪以 wavePhase 動畫。
6. UI：右上切換列「島嶼全景／廠內／2D 插畫」；2D↔3D 以淡入淡出轉場。

## 考慮過但不採用的方案（一句話理由）
- 俯視平面圖：使用者選等角插畫。
- 寫實人物（Mixamo）：需手動登入下載；使用者選低多邊形。
- GodRays 後處理：需要可見的光源網格且對室內天窗效果差；改用加法混合光束體。
- 物理引擎：破壞「t 的純函數」。

## 介面 / 契約（T1 先凍結）
```ts
// layout.ts（新增）
export interface Waypoint { x: number; z: number; dwell?: number }
export type ActorType = 'worker' | 'agv'
export interface Actor { id: string; name: string; type: ActorType; cycleSeconds: number; route: Waypoint[] }
export interface IslandSpec { radius: number; plateauRadius: number; beachWidth: number; seed: number }
export interface EnvironmentSpec { island: IslandSpec; dayCycleSeconds: number; waveSeconds: number }
// Site 加：environment?: EnvironmentSpec; actors?: Actor[]
// ParseResult ok 分支加：actors: Actor[]
// actors.ts
export type ActorAction = 'walk' | 'work' | 'move' | 'dock'
export interface ActorPose { x: number; z: number; heading: number; speed: number; action: ActorAction; waypoint: number }
export function actorPose(a: Actor, t: number): ActorPose
// environment.ts
export interface SunState { azimuth: number; elevation: number; direction: { x: number; y: number; z: number } }
export function sunAt(env: EnvironmentSpec, t: number): SunState
export function wavePhase(env: EnvironmentSpec, t: number): number
export function islandHeight(i: IslandSpec, x: number, z: number): number
export function isLand(i: IslandSpec, x: number, z: number): boolean
export interface TreeInstance { x: number; z: number; y: number; scale: number; rotation: number; variant: number }
export function forestPlacement(i: IslandSpec, avoid: Rect, count: number): TreeInstance[]
// projection.ts
export const ISO_AZIMUTH: number; export const ISO_ELEVATION: number
export function isoProject(x: number, y: number, z: number): { u: number; v: number }
// simulate.ts FrameState 加：actors: Record<string, ActorPose>; environment?: { sun: SunState; wave: number }
```

## 依賴方向（SOLID-DIP）
- domain 不 import react/three/I-O（沿用上一輪檢查）。`view2d/` 與 `scene/` 都只依賴 domain，互不 import。

## 風險與回滾
- 樹木模型面數過高 → 管線 simplify；地形／海面在 SwiftShader 很慢 → E2E 只驗探針與無錯誤，畫質以 GPU 截圖人工確認。
- FBX2glTF 僅 x86_64（macOS 走 Rosetta）→ 轉檔產物 commit 進 repo，CI 不必轉檔。
- 功能分支 `feat/island-2d3d`，回滾 = 不合併。

## 驗收方式
- S1、S2：`npx vitest run src/domain/actors.test.ts`
- S3–S6：`npx vitest run src/domain/parseLayout.test.ts src/domain/factoryLayout.test.ts`
- S7：`npx vitest run src/domain/environment.test.ts`
- S8：`npx vitest run src/domain/projection.test.ts src/view2d`
- S9、S10、S12：`npx playwright test e2e/island.spec.ts`
- S11：`npx vitest run scripts/assets`
