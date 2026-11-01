# 交付報告：factory-3d2d-demo

> 產生時間 2026-11-01T23:44:42+08:00 · 程式碼指紋 `nohead+e3b0c44298fc`
> 本頁數字全部由 `factory.py report` 從收據計算，不是模型自述。

## 閘門狀態

| 關卡 | 結果 |
|---|---|
| spec | ✅ 11 個 Scenario |
| plan | ✅ 可平行批次：[T1] → [T2,T7] → [T3,T4,T6,T8] → [T5] → [T9] → [T10,T12] → [T11] |
| dev | ✅ T1 豁免 TDD：純設定檔；以 npm run typecheck 與後續任務的測試能執行作為驗證 |
| review | ✅ 發現數 P0=0 P1=1 P2=17 P3=15 |
| accept | ✅  |

## 驗收標準追溯（Scenario → 任務 → 驗收）

| Scenario | 標題 | 任務 | 驗收 |
|---|---|---|---|
| S1 | 合法的產線配置建立 ISA-95 階層 | T2,T6,T10 | ✅ `npx vitest run src/domain/parseLayout.test.ts src/domain/factoryLayout.test.ts src/domain/geometry.test.ts -t @S1|INVALID|geometry|旋轉|areaBounds|取放高度|通過驗證` |
| S2 | 配置中有重複的設備編號 | T2,T10 | ✅ `npx vitest run src/domain/parseLayout.test.ts src/domain/factoryLayout.test.ts src/domain/geometry.test.ts -t @S2|INVALID|geometry|旋轉|areaBounds|取放高度|通過驗證` |
| S3 | 配置中的設備引用不存在的設備型號 | T2,T10 | ✅ `npx vitest run src/domain/parseLayout.test.ts src/domain/factoryLayout.test.ts src/domain/geometry.test.ts -t @S3|INVALID|geometry|旋轉|areaBounds|取放高度|通過驗證` |
| S4 | 設備剛好貼齊廠區邊界 | T2,T10 | ✅ `npx vitest run src/domain/parseLayout.test.ts src/domain/factoryLayout.test.ts src/domain/geometry.test.ts -t @S4|INVALID|geometry|旋轉|areaBounds|取放高度|通過驗證` |
| S5 | 設備超出廠區邊界 | T2,T10 | ✅ `npx vitest run src/domain/parseLayout.test.ts src/domain/factoryLayout.test.ts src/domain/geometry.test.ts -t @S5|INVALID|geometry|旋轉|areaBounds|取放高度|通過驗證` |
| S6 | 同一時間點的產線狀態永遠相同且依週期循環 | T5,T10 | ✅ `npx vitest run src/domain/simulate.test.ts src/domain/motion/time.test.ts` |
| S7 | 料件沿輸送帶前進 | T3,T10 | ✅ `npx vitest run src/domain/motion/conveyor.test.ts` |
| S8 | 機械手臂完成一次取放 | T4,T10 | ✅ `npx vitest run src/domain/motion/robotArm.test.ts src/domain/simulate.test.ts` |
| S9 | 資產清冊中的模型經管線後可供網頁使用 | T7,T8,T12 | ✅ `bash -c npm run -s assets >/dev/null 2>&1 && npx vitest run scripts/assets/assets-ready.test.ts scripts/assets/validate.test.ts` |
| S10 | 資產缺少授權資訊 | T7,T12 | ✅ `npx vitest run scripts/assets/manifest-ls.test.ts scripts/assets/pipeline.test.ts` |
| S11 | 開啟展示頁看到寫實 3D 產線 | T1,T6,T9,T11 | ✅ `npx playwright test e2e/s11-scene.spec.ts --reporter=line` |

## 審查發現

| ID | 嚴重度 | 原則 | 位置 | 摘要 | 狀態 |
|---|---|---|---|---|---|
| C1 | P1 | T3 | e2e/s11-scene.spec.ts:29 | S11 只比對外層 group 的 equipmentId，View 畫空也會通過；截圖無斷言 | fixed |
| C2 | P2 | B1 | src/domain/parseLayout.ts:27 | 負寬度可繞過邊界檢查 | fixed |
| C3 | P2 | B1 | src/domain/parseLayout.ts:9 | params 非數值、bounds 缺欄、id/name 空字串未擋 | fixed |
| C4 | P2 | T3 | src/domain/motion/robotArm.ts:126 | IK 不可達或超出關節限制時不回報 | open |
| C5 | P2 | T3 | src/domain/parseLayout.test.ts:39 | S1 只測單一分支階層 | fixed |
| C6 | P2 | U1 | scripts/assets/pipeline.sh:14 | S10 缺 pipeline 層級測試 | fixed |
| C7 | P2 | T3 | scripts/assets/fetch.mjs:62 | 貼圖只要有任一張就算成功 | fixed |
| C8 | P2 | P3 | src/App.tsx:54 | 道具 404 會讓整個 Canvas 崩潰 | fixed |
| C9 | P2 | D1 | src/scene/equipment/Conveyor.tsx:17 | itemCount 預設值兩處 | fixed |
| C10 | P3 | T3 | src/domain/parseLayout.test.ts:64 | S4 未真正貼齊、EPSILON 無保護 | fixed |
| C11 | P3 | B1 | src/domain/motion/time.ts:3 | -0 與週期邊界 | fixed |
| C12 | P3 | B1 | src/scene/equipment/Conveyor.tsx:33 | 非整數長度皮帶貼圖週期接縫 | fixed |
| C13 | P3 | B1 | scripts/assets/manifest-ls.mjs:30 | id 未驗重複與字元 | fixed |
| C14 | P3 | T1 | src/domain/parseLayout.test.ts:88 | INVALID_SHAPE 測試以 TypeError 失敗、覆蓋不足 | fixed |
| C15 | P3 | T3 | e2e/s11-scene.spec.ts:13 | e2e 讀檔路徑相對 cwd | fixed |
| D1 | P2 | D1, DD4, S1 | src/scene/Building.tsx:14 | 區域外框計算在 3D 層，階段 4 SVG 需重寫 | fixed |
| D2 | P2 | S3 (OCP), DD1 | src/domain/simulate.ts:34 | 手臂尺寸綁 kind 而非型號 | open |
| D3 | P2 | D1 | src/scene/equipment/Conveyor.tsx:10 | 皮帶高度與取放高度隱性耦合 | fixed |
| D4 | P2 | D1 | src/domain/simulate.ts:27 | itemCount 預設值兩處 | fixed |
| D5 | P2 | S3 (OCP) | src/domain/simulate.ts:6 | 新增 kind 仍需改 simulate.ts，與 plan 宣稱不符 | open |
| D6 | P2 | S3 (OCP), DD1 | src/scene/equipment/Machine.tsx:148 | variant 為 string 且靜默退回 | fixed |
| D7 | P2 | D1, U1 | src/scene/materials.ts:11 | scene 與管線的資產契約未核對 | open |
| D8 | P2 | DIP | src/App.tsx:54 | 道具 Suspense/ErrorBoundary 未落實 | fixed |
| D9 | P2 | 不硬編碼, D1 | src/scene/Props.tsx:4 | 道具以絕對座標寫死 | open |
| D10 | P3 | D1 | src/scene/equipment/RobotArm.tsx:40 | 夾持判定只在 3D 層 | fixed |
| D11 | P3 | DIP | src/scene/clock.tsx:9 | SimClock 介面不利逐格錄影與鏡頭腳本 | open |
| D12 | P3 | DD1 | src/domain/simulate.ts:36 | 取放偏移是世界座標，不隨 rotation | open |
| D13 | P3 | DD1, T2 | src/domain/layout.ts:54 | plan 通用語言與實作不一致 | fixed |
| D14 | P3 | DD1, U3 | src/domain/layout.ts:24 | params 無 schema | open |
| D15 | P3 | 不硬編碼（i18n） | src/domain/parseLayout.ts:54 | domain 錯誤訊息寫死中文 | open |
| D16 | P3 | Y2 | src/scene/materials.ts:6 | 未使用的資產與字典鍵 | fixed |
| D17 | P3 | U1 | scripts/assets/pipeline.sh:5 | sh/pipefail 與相對路徑 | fixed |
| D18 | P3 | 不硬編碼, D3 | src/theme/tokens.ts:38 | 開場相機寫在 token | open |

## 尚未完成 / 已知風險

<!-- 由代理補充：誠實列出沒做的、跳過的、只驗了一半的 -->

**本輪範圍是階段 1–3，以下尚未做**
- 階段 4：SVG 2D 平面圖與 3D/2D 切換。domain 已備好共用的 `geometry.areaBounds` 和 `specs`。
- 階段 5：15 秒鏡頭腳本與逐格 MP4 輸出。要先處理 D11（逐格時鐘）和 D18（開場相機移出 token）。

**已知缺口**
- **料件交接時機沒有同步**：輸送帶上料件到達手臂取料點的時間，和手臂夾取的時間還沒對齊。手臂夾起來的料件是另外顯示的，不是輸送帶上那一顆。這項要在階段 5 補 Scenario 和測試。
- **審查還有 10 項 open（P2/P3）**：C4、D2、D5、D7、D9、D11、D12、D14、D15、D18，原因寫在 04-review.json。其中 C4 和 D14（不可達的取放點、參數 schema）屬於新的錯誤輸入規則，要先和使用者確認後再補 Scenario。
- **S1–S5 的驗收指令共用同一組測試篩選**：每張收據跑的是同一批 parseLayout、factoryLayout 和 geometry 測試，並不是每條 Scenario 各自獨立的指令。
- **截圖有兩種**：S11 的 E2E 用 SwiftShader 軟體渲染，畫質和效能都不代表實機。另外用本機 GPU（Apple M2 Max / Metal）截了一張 `artifacts/screenshots/s11-scene-gpu.png`，這張只是人工對照，不在自動閘門裡。
- **效能（FPS）沒有量測**。
- **主要機台是程式參數化建模**，質感偏乾淨的示意風；寫實型號要等之後升級。
- **`assets/raw/` 還留著舊的中間檔**（concrete_floor_painted、metal_plate、rough.jpg）。它們已被 .gitignore 排除，不影響產出。
- **專案還不是 git repo**，沒有 commit。

