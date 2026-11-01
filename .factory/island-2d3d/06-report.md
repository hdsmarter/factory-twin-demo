# 交付報告：island-2d3d

> 產生時間 2026-11-02T01:27:59+08:00 · 程式碼指紋 `5adeaa7+0ac98287198f`
> 本頁數字全部由 `factory.py report` 從收據計算，不是模型自述。

## 閘門狀態

| 關卡 | 結果 |
|---|---|
| spec | ✅ 12 個 Scenario |
| plan | ✅ 可平行批次：[T1,T6] → [T3,T4] → [T2] → [T5] → [T7,T8,T9] → [T10] → [T11] → [T12,T13] |
| dev | ✅ T7 豁免 TDD：純呈現元件；行為由 T10 的 E2E（S10、S12）驗收，T10 先寫 red；T8 豁免 TDD：純呈現元件；行為由 T10 的 E2E（S10）驗收 |
| review | ✅ 發現數 P0=0 P1=2 P2=15 P3=10 |
| accept | ✅  |

## 驗收標準追溯（Scenario → 任務 → 驗收）

| Scenario | 標題 | 任務 | 驗收 |
|---|---|---|---|
| S1 | 工作人員沿巡檢路線移動並在站點工作 | T1,T3,T5,T11 | ✅ `npx vitest run src/domain/actors.test.ts` |
| S2 | AGV 沿物流路線移動並在站點停靠 | T1,T3,T5,T11 | ✅ `npx vitest run src/domain/actors.test.ts` |
| S3 | 機械手臂的取放點超出可達範圍 | T1,T2,T11 | ✅ `npx vitest run src/domain/parseLayout.test.ts src/domain/factoryLayout.test.ts src/domain/motion/robotArm.test.ts` |
| S4 | 設備參數名稱不在該型號允許的清單中 | T1,T2 | ✅ `npx vitest run src/domain/parseLayout.test.ts src/domain/factoryLayout.test.ts src/domain/motion/robotArm.test.ts` |
| S5 | 人員或 AGV 的路線超出廠區 | T1,T2,T11 | ✅ `npx vitest run src/domain/parseLayout.test.ts src/domain/factoryLayout.test.ts src/domain/motion/robotArm.test.ts` |
| S6 | 廠區不在島嶼陸地上 | T1,T2,T11 | ✅ `npx vitest run src/domain/parseLayout.test.ts src/domain/factoryLayout.test.ts src/domain/motion/robotArm.test.ts` |
| S7 | 太陽與海浪隨時間變化且依日週期循環 | T1,T4,T5 | ✅ `npx vitest run src/domain/environment.test.ts` |
| S8 | 等角 2D 插畫的位置與 3D 一致 | T1,T4,T9,T12 | ✅ `npx vitest run src/domain/projection.test.ts src/view2d` |
| S9 | 在 3D 與 2D 之間切換 | T9,T10,T12,T13 | ✅ `npx playwright test e2e/island.spec.ts -g @S9 --reporter=line` |
| S10 | 3D 呈現荒島環境與場景效果 | T5,T6,T7,T8,T10,T13 | ✅ `npx playwright test e2e/island.spec.ts -g @S10 --reporter=line` |
| S11 | 角色模型經管線轉檔後可供網頁使用 | T6 | ✅ `npx vitest run scripts/assets` |
| S12 | 島嶼全景與廠內視角切換 | T7,T10,T13 | ✅ `npx playwright test e2e/island.spec.ts -g @S12 --reporter=line` |

## 審查發現

| ID | 嚴重度 | 原則 | 位置 | 摘要 | 狀態 |
|---|---|---|---|---|---|
| C1 | P1 | T3 | src/view2d/IsoScene.test.ts:39 | S8 只比 data-u/v（與繪製圖元各自計算），拿實作驗實作 | fixed |
| C2 | P1 | B1 | src/domain/parseLayout.ts:130 | actors 非陣列通過驗證後執行時崩潰 | fixed |
| C3 | P2 | B1 | src/domain/actors.ts:35 | 路線總長 0 → NaN 位置 | fixed |
| C4 | P2 | B1 | src/domain/motion/robotArm.ts:163 | 只檢查 5 個路徑點，途中可能超出關節限制 | fixed |
| C5 | P2 | T3 | src/domain/parseLayout.test.ts:162 | 關節限制分支無測試、點位斷言過寬 | fixed |
| C6 | P2 | B1 | src/domain/parseLayout.ts:66 | 島嶼驗證未考慮海岸起伏 | fixed |
| C7 | P2 | T3 | src/scene/island/Ocean.tsx:47 | 3D 海面 time 非週期，S7 只保護 domain/2D | open |
| C8 | P2 | B1 | src/App.tsx:75 | 2D 每次切入從 t=0 起算，與 3D 不連續 | fixed |
| C9 | P2 | B1 | src/App.tsx:82 | 3D 期間改視窗尺寸後切 2D 尺寸錯 | fixed |
| C10 | P2 | T3 | e2e/island.spec.ts:59 | S9 未驗網格>0、未驗切回 3D 仍在渲染 | fixed |
| C11 | P3 | T3 | src/scene/Probe.tsx:34 | 屋頂可見只看群組不看網格 | fixed |
| C12 | P3 | T3 | src/scene/Probe.tsx:49 | 人物 GLB 非同步載入可能假紅 | fixed |
| C13 | P3 | D1 | src/view2d/IsoScene.tsx:37 | AGV 尺寸 2D/3D 不一致 | fixed |
| C14 | P3 | B1 | src/domain/simulate.ts:60 | scenePeriod 以毫秒取整與極大 LCM | open |
| C15 | P3 | B1 | src/domain/environment.ts:119 | forestPlacement 可能回傳少於 count | open |
| C16 | P3 | B1 | scripts/assets/fetch.mjs:44 | url 變更後仍用舊快取 | open |
| D1 | P2 | D1 | src/view2d/shapes.tsx:159 | 設備外觀尺寸 2D/3D 各寫一份 | open |
| D2 | P2 | D1 | src/view2d/IsoScene.tsx:37 | AGV/人員尺寸不一致 | fixed |
| D3 | P2 | DD1 | src/theme/actorTokens.ts:34 | AGV 載貨是 token 中的業務資料，2D 不畫 | open |
| D4 | P2 | D1 | src/view2d/shapes.tsx:319 | 2D 手臂自寫連桿鏈 | open |
| D5 | P2 | S3 | src/view2d/shapes.tsx:377 | 2D 設備/人員分派無型別保護 | fixed |
| D6 | P2 | D1 | src/App.tsx:75 | 2D 另開時間來源 | fixed |
| D7 | P2 | D1 | src/scene/effects/LightBeams.tsx:9 | 天窗/牆幾何散落 4 處 | open |
| D8 | P3 | D1 | src/view2d/palette.ts:49 | 語意色 2D/3D 各寫一份 | open |
| D9 | P3 | UX-a11y | src/App.tsx:52 | 未處理 prefers-reduced-motion、無暫停 | open |
| D10 | P3 | UX-a11y | src/view2d/IsoScene.tsx:329 | 巢狀 role=img 無名稱 | fixed |
| D11 | P3 | K3 | src/scene/clock.tsx:9 | 逐格錄影就緒度 | open |

## 尚未完成 / 已知風險

<!-- 由代理補充：誠實列出沒做的、跳過的、只驗了一半的 -->

**本輪沒做（排入階段 5）**：15 秒鏡頭腳本、景深、逐格 MP4、播放／暫停與 reduced-motion（D9、D11）、3D 海面週期接縫（C7）。

**還沒解決的審查發現（11 項，P2/P3）**：C7、C14、C15、C16、D1、D3、D4、D7、D8、D9、D11。原因寫在 04-review.json。其中最影響「2D 與 3D 一模一樣」的有三項，下一輪優先處理：
- D1：設備外觀尺寸
- D3：AGV 載貨狀態
- D4：2D 手臂的連桿鏈

**畫質只人工看過**：島嶼與廠內畫面是用本機 GPU（M2 Max）截圖後人工確認的。E2E 跑的是軟體渲染，只能驗證場景元素存在、沒有錯誤，驗不了好不好看。

**已知的視覺問題**：
- 島嶼全景看遠處仍有一層淡淡的大氣霧。
- 人物的安全帽很小，可能看不出來。
- 樹木模型減面到原本的 2.5–5%，近看時樹葉比較稀疏。

**資產與轉檔**：角色模型的 FBX→GLB 用 FBX2glTF。macOS 上它是 x86_64 binary，要靠 Rosetta 執行；轉好的 glb 已經 commit 進 repo。

