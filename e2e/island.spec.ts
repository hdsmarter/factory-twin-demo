import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

/**
 * 探針契約（scene/Probe.tsx）：window.__factory.snapshot() 回傳目前場景的可見網格統計。
 * - envParts：userData.envPart（ocean/sky/terrain/forest/beams/dust）→ 可見網格數（Points 也算）
 * - actorMeshes：userData.actorId → 可見網格數
 * - roofVisible / frontWallVisible：userData.shellPart === 'roof' | 'front' 是否可見
 * 2D 契約（view2d/IsoScene.tsx）：<svg data-view="iso2d">，每個實體一個 [data-entity-id] 元素。
 */
type Snapshot = {
  equipmentMeshes: Record<string, number>
  actorMeshes: Record<string, number>
  envParts: Record<string, number>
  roofVisible: boolean
  frontWallVisible: boolean
  /** 目前模擬時間（秒） */
  t: number
  /** 探針掛載後經過的渲染幀數 */
  frame: number
}
type ProbeWindow = { __factory?: { ready: boolean; snapshot?: () => Snapshot } }

const layout = JSON.parse(readFileSync(new URL('../data/factory-layout.json', import.meta.url), 'utf8')) as {
  areas: { lines: { cells: { equipment: { id: string }[] }[] }[] }[]
  actors: { id: string }[]
}
const equipmentIds = layout.areas.flatMap((a) => a.lines.flatMap((l) => l.cells.flatMap((c) => c.equipment.map((e) => e.id)))).sort()
const actorIds = layout.actors.map((a) => a.id).sort()

async function snapshot(page: Page): Promise<Snapshot> {
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as ProbeWindow).__factory?.snapshot === 'function'), { timeout: 120_000 }).toBe(true)
  await page.waitForTimeout(500)
  return page.evaluate(() => (window as unknown as ProbeWindow).__factory!.snapshot!())
}

test('@S10 3D 呈現荒島環境與場景效果', async ({ page }) => {
  const problems: string[] = []
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text()))
  page.on('pageerror', (e) => problems.push(e.message))
  await page.goto('/?probe=1')
  const s = await snapshot(page)
  for (const part of ['ocean', 'sky', 'terrain', 'forest', 'beams', 'dust']) expect(s.envParts?.[part] ?? 0, part).toBeGreaterThan(0)
  expect(Object.keys(s.actorMeshes ?? {}).sort()).toEqual(actorIds)
  // 人物模型各自非同步載入：等到每位人員與 AGV 都畫出網格
  await expect.poll(async () => Object.values((await snapshot(page)).actorMeshes).every((n) => n > 0), { timeout: 60_000 }).toBe(true)
  expect(problems).toEqual([])
})

test('@S12 島嶼全景與廠內視角切換', async ({ page }) => {
  await page.goto('/?probe=1')
  await snapshot(page)
  await page.getByRole('button', { name: '島嶼全景' }).click()
  await expect.poll(async () => (await snapshot(page)).roofVisible).toBe(true)
  expect((await snapshot(page)).frontWallVisible).toBe(true)
  await page.getByRole('button', { name: '廠內' }).click()
  await expect.poll(async () => (await snapshot(page)).roofVisible).toBe(false)
  expect((await snapshot(page)).frontWallVisible).toBe(false)
})

test('@S9 在 3D 與 2D 之間切換，兩者呈現相同的設備、人員與 AGV', async ({ page }) => {
  await page.goto('/?probe=1')
  await expect.poll(async () => Object.values((await snapshot(page)).actorMeshes).every((n) => n > 0), { timeout: 60_000 }).toBe(true)
  const s = await snapshot(page)
  const drawn = (m: Record<string, number>) => Object.entries(m).filter(([, n]) => n > 0).map(([id]) => id)
  const ids3d = [...drawn(s.equipmentMeshes), ...drawn(s.actorMeshes)].sort()
  expect(ids3d).toEqual([...equipmentIds, ...actorIds].sort())

  await page.getByRole('button', { name: '2D 插畫' }).click()
  const svg = page.locator('svg[data-view="iso2d"]')
  await expect(svg).toBeVisible()
  const ids2d = (await svg.locator('[data-entity-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-entity-id')!))).sort()
  expect(ids2d).toEqual(ids3d)

  await page.getByRole('button', { name: '廠內' }).click()
  await expect(page.locator('canvas')).toBeVisible()
  await expect(svg).toBeHidden()
  // 切回 3D 後仍在渲染（不是凍結畫面），且呈現相同集合
  const back = await snapshot(page)
  await expect.poll(async () => (await snapshot(page)).frame, { timeout: 30_000 }).toBeGreaterThan(back.frame)
  expect([...drawn(back.equipmentMeshes), ...drawn(back.actorMeshes)].sort()).toEqual(ids3d)
})

test('@S9 3D 與 2D 共用同一條時間軸：切換時時間連續', async ({ page }) => {
  await page.goto('/?probe=1')
  await snapshot(page)
  await page.waitForTimeout(3000)
  const t3d = (await snapshot(page)).t
  expect(t3d).toBeGreaterThan(1)
  await page.getByRole('button', { name: '2D 插畫' }).click()
  const wrapper = page.locator('[data-sim-t]')
  await expect(wrapper).toBeVisible()
  const t2d = Number(await wrapper.getAttribute('data-sim-t'))
  expect(t2d).toBeGreaterThanOrEqual(t3d)
  expect(t2d - t3d).toBeLessThan(10)
})

test('@S9 在 3D 時改變視窗大小，再切到 2D 時插畫符合新尺寸', async ({ page }) => {
  await page.goto('/?probe=1')
  await snapshot(page)
  await page.getByRole('button', { name: '2D 插畫' }).click()
  await expect(page.locator('svg[data-view="iso2d"]')).toBeVisible()
  await page.getByRole('button', { name: '廠內' }).click()
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.getByRole('button', { name: '2D 插畫' }).click()
  await expect(page.locator('svg[data-view="iso2d"]')).toHaveAttribute('width', '1280')
})

test('@S15 在 2D 插畫上拖曳平移、以游標為中心縮放、雙擊重設', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/?freeze=8')
  await page.getByRole('button', { name: '2D 插畫' }).click()
  const svg = page.locator('svg[data-view="iso2d"]')
  await expect(svg).toBeVisible()
  const vb = async () => (await svg.getAttribute('viewBox'))!.split(' ').map(Number) as [number, number, number, number]
  const initial = await vb()
  const sceneAt = (b: number[], px: number, py: number) => ({ u: b[0]! + (px / 1280) * b[2]!, v: b[1]! + (py / 720) * b[3]! })

  // 滾輪縮放：以游標為中心（游標下的場景點不變）
  const cursor = { x: 500, y: 420 }
  const before = sceneAt(initial, cursor.x, cursor.y)
  await page.mouse.move(cursor.x, cursor.y)
  await page.mouse.wheel(0, -400)
  await expect.poll(async () => (await vb())[2]).toBeLessThan(initial[2] / 1.5)
  const zoomed = await vb()
  const after = sceneAt(zoomed, cursor.x, cursor.y)
  expect(Math.abs(after.u - before.u)).toBeLessThan(initial[2] * 0.002)
  expect(Math.abs(after.v - before.v)).toBeLessThan(initial[3] * 0.002)

  // 拖曳：內容跟著指標移動
  await page.mouse.move(640, 360)
  await page.mouse.down()
  await page.mouse.move(700, 390, { steps: 5 })
  await page.mouse.up()
  const dragged = await vb()
  expect(dragged[0] - zoomed[0]).toBeCloseTo((-60 / 1280) * zoomed[2], 1)
  expect(dragged[1] - zoomed[1]).toBeCloseTo((-30 / 720) * zoomed[3], 1)

  // 雙擊重設
  await page.mouse.dblclick(640, 360)
  await expect.poll(async () => (await vb()).map((n) => n.toFixed(3)).join(' ')).toBe(initial.map((n) => n.toFixed(3)).join(' '))

  // 縮小有下限：不會比預設構圖更小
  await page.mouse.wheel(0, 2000)
  await page.waitForTimeout(200)
  expect((await vb())[2]).toBeCloseTo(initial[2], 3)

  // 鍵盤：+ 放大、0 重設
  await page.getByRole('application', { name: /工廠等角插畫/ }).focus()
  await page.keyboard.press('+')
  await expect.poll(async () => (await vb())[2]).toBeLessThan(initial[2])
  await page.keyboard.press('0')
  await expect.poll(async () => (await vb())[2].toFixed(3)).toBe(initial[2].toFixed(3))
})

test('@S15 2D 互動細節：右鍵不拖曳、連續兩次短拖曳不誤判雙擊、不攔截瀏覽器縮放快捷鍵、焦點可見', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/?freeze=8')
  await page.getByRole('button', { name: '2D 插畫' }).click()
  const svg = page.locator('svg[data-view="iso2d"]')
  await expect(svg).toBeVisible()
  const vb = async () => (await svg.getAttribute('viewBox'))!
  const initial = await vb()
  await page.mouse.move(640, 360)
  await page.mouse.wheel(0, -600)
  await expect.poll(vb).not.toBe(initial)
  const zoomed = await vb()

  // 右鍵按住移動：不平移
  await page.mouse.move(640, 360)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(700, 400, { steps: 4 })
  await page.mouse.up({ button: 'right' })
  expect(await vb()).toBe(zoomed)

  // 同一點快速兩次短拖曳：保留平移結果，不被當成雙擊重設
  for (let i = 0; i < 2; i++) {
    await page.mouse.move(640, 360)
    await page.mouse.down()
    await page.mouse.move(670, 360, { steps: 3 })
    await page.mouse.up()
  }
  const dragged = await vb()
  expect(dragged).not.toBe(zoomed)
  expect(dragged).not.toBe(initial)

  // 焦點在 2D 容器時，Ctrl/Cmd + = 不被攔截（瀏覽器頁面縮放仍可用）
  const app = page.getByRole('application', { name: /工廠等角插畫/ })
  await app.focus()
  const prevented = await app.evaluate((el) => {
    const e = new KeyboardEvent('keydown', { key: '=', ctrlKey: true, bubbles: true, cancelable: true })
    el.dispatchEvent(e)
    return e.defaultPrevented
  })
  expect(prevented).toBe(false)
  expect(await vb()).toBe(dragged)

  // 鍵盤聚焦時有可見外框；操作說明以 aria-describedby 指向可讀文字
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  await expect(app).toBeFocused()
  const outline = await app.evaluate((el) => getComputedStyle(el).outlineStyle)
  expect(outline).not.toBe('none')
  const describedBy = await app.getAttribute('aria-describedby')
  expect(describedBy).toBeTruthy()
  await expect(page.locator(`#${describedBy}`)).toContainText('拖曳')
})
