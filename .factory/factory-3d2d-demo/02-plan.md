# 設計：工廠 3D/2D 技術可行性展示（階段 1–3）

## Bounded Context 與通用語言（DDD）
- Context：**Factory Twin（工廠分身展示）**，單一 context，分三層：
  - `src/domain/`：純 TS，無框架、無 I/O。配置（Layout）、型號目錄（Catalog）、動作（Motion）、模擬（Simulate）。
  - `src/scene/`：R3F 呈現層，只讀 domain 的輸出。
  - `scripts/assets/`：資產管線（Unix 小工具）。
- 通用語言（glossary）：
  - **Site 廠區**（有 bounds）→ **Area 區域** → **Line 產線** → **Cell 工作站** → **Equipment 設備**（ISA-95）
  - **EquipmentModel 設備型號**：型號目錄中的條目，兩層分類：kind（conveyor／robot-arm／machine／storage）＋ variant（machine：cnc／inspection；storage：rack／pallet），variant 為型別化聯集
  - **Specs 設備規格**：`src/domain/specs.ts`（皮帶頂面、料件高、棧板頂面、預設料件數）；**Geometry**：`src/domain/geometry.ts`（佔地外框、區域外框 areaBounds）——3D 與 2D 共用
  - **carrying 夾持中**：RobotArmPose 欄位，由領域層判定
  - **Footprint 佔地**：設備在廠區平面上的中心點、寬、深、旋轉（0/90/180/270）
  - **Cycle 生產週期**：所有動作的共同週期（秒）；狀態對 t 以週期循環
  - **FrameState 產線狀態**：某時間點 t 所有設備與料件的狀態；`simulate(layout, t)` 的輸出
  - **Asset 資產**：清冊（manifest）中的一筆外部素材，必須有來源、作者、授權

## 方案（KISS）
1. 配置 `data/factory-layout.json` → `parseLayout(raw, catalog)` 回傳 `{ok:true, site, placed}` 或 `{ok:false, errors[]}`（不丟例外，錯誤是值）。
2. 動作皆為純函數：`conveyorItems(params, t)`、`robotArmPose(params, t)`；`simulate(layout, t)` 依 kind 查**動作註冊表**（新增設備種類 = 新增一筆註冊，不改 simulate → OCP）。
3. 時間來源注入：`<SimClockProvider clock={...}>`，預設即時時鐘；階段 5 換成逐格時鐘，場景程式不變（DIP）。
4. 場景：`<Factory>` 讀 layout，依 kind 查**渲染器註冊表**畫出設備；主要機台參數化建模＋Poly Haven PBR 材質；道具用 Poly Haven glTF；HDRI＋陰影＋SSAO／Bloom／ToneMapping。
5. 資產管線（Unix Pipe + GNU Parallel）：
   ```sh
   node scripts/assets/manifest-ls.mjs assets/manifest.json \
     | parallel --colsep '\t' -j4 --halt now,fail=1 \
         'node scripts/assets/fetch.mjs {1} {2} {3} {4} | xargs -I@ sh scripts/assets/optimize.sh @ {1} {2} | xargs -I@ node scripts/assets/validate.mjs @'
   ```
   每支工具：一件事、stdin/argv 進、stdout 出路徑、stderr 放訊息、非 0 退出碼表示失敗。
6. UI 文字集中 `src/i18n/zh-TW.ts`；色彩、材質參數集中 `src/theme/tokens.ts`（不硬編碼）。
7. 可觀測探針：網址帶 `?probe=1` 時，`window.__factory = {ready, equipmentIds}` 供 E2E 驗證。

## 考慮過但不採用的方案（一句話理由）
- Kenney Conveyor Kit：官網對自動下載回 403，且低多邊形風格與「寫實」目標不符。
- 機台全部用現成 glTF：免費寫實的機械手臂／輸送帶幾乎沒有，且難以精準驅動關節。
- Remotion：本輪不錄影；授權待使用者決定。
- 物理引擎（Rapier）：料件運動是確定性軌跡，物理模擬反而破壞「t 的純函數」。
- KTX2 貼圖：需要另裝 `toktx`；本輪先 WebP，標記為後續最佳化。

## 介面 / 契約（先凍結 — T2）
```ts
// src/domain/layout.ts
export type Rotation = 0 | 90 | 180 | 270
export interface Footprint { x: number; z: number; width: number; depth: number; rotation: Rotation }
export interface Equipment { id: string; name: string; model: string; footprint: Footprint; params?: Record<string, number> }
export interface Cell { id: string; name: string; equipment: Equipment[] }
export interface Line { id: string; name: string; cells: Cell[] }
export interface Area { id: string; name: string; lines: Line[] }
export interface Site { id: string; name: string; bounds: { width: number; depth: number; height: number }; cycleSeconds: number; areas: Area[] }
export interface PlacedEquipment { equipment: Equipment; kind: EquipmentKind; path: { site: string; area: string; line: string; cell: string } }
export type LayoutError = { code: 'DUPLICATE_ID' | 'UNKNOWN_MODEL' | 'OUT_OF_BOUNDS' | 'INVALID_SHAPE'; equipmentId?: string; message: string }
export type ParseResult = { ok: true; site: Site; placed: PlacedEquipment[] } | { ok: false; errors: LayoutError[] }
// src/domain/parseLayout.ts
export function parseLayout(raw: unknown, catalog: Catalog): ParseResult
// src/domain/motion/conveyor.ts
export function conveyorItems(p: ConveyorParams, t: number): ConveyorItem[]   // {index, s, x, z}
// src/domain/motion/robotArm.ts
export function robotArmPose(p: RobotArmParams, t: number): RobotArmPose     // {base, shoulder, elbow, wrist, grip, tool:{x,y,z}}
// src/domain/simulate.ts
export function simulate(site: Site, placed: PlacedEquipment[], t: number): FrameState
```

## 契約變更紀錄（審查後）
- T10：`PlacedEquipment.variant?: EquipmentVariant`（型別化）；`RobotArmPose.carrying`；`FrameState` 不含原始 t；`footprintExtent` 由 parseLayout 移至 geometry。
- 已知未解（排入階段 4–5）：手臂尺寸綁 kind 而非型號（D2）、新增 kind 仍需改 simulate.ts（D5）、道具絕對座標（D9）、SimClock 介面與鏡頭腳本時間（D11）、取放偏移為世界座標（D12）、params 無 schema（D14）、domain 錯誤訊息未走 i18n（D15）、開場相機在 token（D18）。

## 依賴方向（SOLID-DIP）
- `src/domain/**` 不 import：react、three、fs、fetch。
- `src/scene/**` → domain（單向）。`scripts/assets/**` 與 src 互不 import。

## 風險與回滾
- Poly Haven 下載失敗 → 管線以 `--halt now,fail=1` 立即停止並列出資產；場景對缺漏道具不 crash（道具層 Suspense 包住）。
- headless 截圖用 SwiftShader 軟體渲染，畫質/效能不代表實機 → 另以本機 Chrome 截圖確認質感。
- 新專案，回滾 = 刪目錄。

## 驗收方式
- S1–S5：`npx vitest run src/domain/parseLayout.test.ts`
- S6：`npx vitest run src/domain/simulate.test.ts`
- S7：`npx vitest run src/domain/motion/conveyor.test.ts`
- S8：`npx vitest run src/domain/motion/robotArm.test.ts`
- S9：`npm run assets && npx vitest run scripts/assets/assets-ready.test.ts`
- S10：`npx vitest run scripts/assets/manifest-ls.test.ts`
- S11：`npx playwright test e2e/s11-scene.spec.ts`
