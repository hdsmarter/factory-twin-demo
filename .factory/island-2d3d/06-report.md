# 交付報告：island-2d3d

> 產生時間 2026-11-02T11:12:52+08:00 · 程式碼指紋 `0226200+52784dc45368`
> 本頁數字全部由 `factory.py report` 從收據計算，不是模型自述。

## 閘門狀態

| 關卡 | 結果 |
|---|---|
| spec | ✅ 15 個 Scenario |
| plan | ✅ 可平行批次：[T1,T6] → [T3,T4] → [T2] → [T5] → [T7,T8,T9] → [T10] → [T11] → [T12,T13] → [T14] → [T15] → [T16,T19] → [T17] → [T18] → [T20] → [T21] |
| dev | ✅ T7 豁免 TDD：純呈現元件；行為由 T10 的 E2E（S10、S12）驗收，T10 先寫 red；T8 豁免 TDD：純呈現元件；行為由 T10 的 E2E（S10）驗收 |
| review | ✅ 發現數 P0=0 P1=6 P2=22 P3=13 |
| accept | ✅  |

## 驗收標準追溯（Scenario → 任務 → 驗收）

| Scenario | 標題 | 任務 | 驗收 |
|---|---|---|---|
| S1 | 工作人員沿巡檢路線移動並在站點工作 | T1,T3,T5,T11 | ✅ `npx vitest run src/domain/actors.test.ts` |
| S2 | AGV 沿物流路線移動並在站點停靠 | T1,T3,T5,T11 | ✅ `npx vitest run src/domain/actors.test.ts` |
| S3 | 機械手臂的取放點超出可達範圍 | T1,T2,T11 | ✅ `npx vitest run src/domain/parseLayout.test.ts src/domain/factoryLayout.test.ts` |
| S4 | 設備參數名稱不在該型號允許的清單中 | T1,T2 | ✅ `npx vitest run src/domain/parseLayout.test.ts src/domain/factoryLayout.test.ts` |
| S5 | 人員或 AGV 的路線超出廠區 | T1,T2,T11 | ✅ `npx vitest run src/domain/parseLayout.test.ts src/domain/factoryLayout.test.ts` |
| S6 | 廠區不在島嶼陸地上 | T1,T2,T11 | ✅ `npx vitest run src/domain/parseLayout.test.ts src/domain/factoryLayout.test.ts` |
| S7 | 太陽與海浪隨時間變化且依日週期循環 | T1,T4,T5 | ✅ `npx vitest run src/domain/environment.test.ts` |
| S8 | 等角 2D 插畫的位置與 3D 一致 | T1,T4,T9,T12,T18 | ✅ `npx vitest run src/domain/projection.test.ts src/view2d` |
| S9 | 在 3D 與 2D 之間切換 | T9,T10,T12,T13,T14 | ✅ `npx playwright test e2e/island.spec.ts -g @S9` |
| S10 | 3D 呈現荒島環境與場景效果 | T5,T6,T7,T8,T10,T13,T14,T15 | ✅ `npx playwright test e2e/island.spec.ts -g @S10` |
| S11 | 角色模型經管線轉檔後可供網頁使用 | T6,T15 | ✅ `npx vitest run scripts/assets` |
| S12 | 島嶼全景與廠內視角切換 | T7,T10,T13 | ✅ `npx playwright test e2e/island.spec.ts -g @S12` |
| S13 | 2D 人員以關節步態行走且腳不打滑 | T16,T17,T21 | ✅ `npx vitest run src/view2d/rig src/view2d/Worker.test.ts src/domain/actors.test.ts` |
| S14 | 2D 人員的關節動作在合理範圍內並平順轉換 | T16,T17,T18,T21 | ✅ `npx vitest run src/view2d/rig src/view2d/IsoScene.test.ts src/domain/actors.test.ts` |
| S15 | 在 2D 插畫上拖曳平移與縮放 | T19,T20,T21 | ✅ `bash -c npx vitest run src/view2d/panZoom.test.ts && npx playwright test e2e/island.spec.ts -g @S15` |

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
| R1 | P1 | B1、T3 | src/view2d/Worker.tsx:15 | 無停留轉角處 heading 瞬變，著地腳一格瞬移約 1/4 身高；測試只驗固定方向 | fixed |
| R2 | P1 | B1 | src/domain/actors.ts:115 | 起點無停留時週期邊界 distance 歸零、相位跳動 | fixed |
| R3 | P2 | B1 | src/domain/actors.ts:81 | 全程行走時每週期縮回站姿 | fixed |
| R4 | P2 | B1、T3 | src/view2d/rig/gait.ts:293 | 起停 0.3–0.4 s 混合期間身體全速前進、腳被拉回站姿而滑行 | open |
| R5 | P1 | T1 | 03-evidence/T17-red, T19-red:8 | T17、T19 red 收據為 import 錯誤而非斷言失敗 | fixed |
| R6 | P2 | T3 | src/view2d/rig/gait.test.ts:78 | 相鄰兩格門檻 12° 太鬆 | fixed |
| R7 | P1 | WCAG 2.4.7 | src/App.tsx:106 | 2D 容器可聚焦但 outline:none，鍵盤焦點不可見 | fixed |
| R8 | P2 | WCAG 1.4.4 | src/view2d/usePanZoom.ts:74 | 攔截 Ctrl/Cmd + = 等瀏覽器縮放快捷鍵 | fixed |
| R9 | P2 | 指標狀態 | src/view2d/usePanZoom.ts:39 | 右鍵／中鍵也會拖曳；放開事件遺失時持續平移 | fixed |
| R10 | P2 | 可發現性 | src/App.tsx:102 | 操作說明只在 aria-description；手機隱藏提示 | fixed |
| R11 | P2 | reduced-motion | src/view2d/Worker.tsx:32 | 減少動態時呼吸、擺髮仍持續 | fixed |
| R12 | P3 | i18n | src/App.tsx:102 | 全形分號寫在元件裡串接 | fixed |
| R13 | P3 | 語意角色 | src/App.tsx:100 | role=application 後失去 img 語意、SVG 圖元可能外露 | fixed |
| R14 | P3 | 手勢衝突 | src/view2d/usePanZoom.ts:97 | 快速兩次短拖曳被當成雙擊重設 | fixed |

## 尚未完成 / 已知風險

<!-- 由代理補充：誠實列出沒做的、跳過的、只驗了一半的 -->
