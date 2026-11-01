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
  for (const [id, n] of Object.entries(s.actorMeshes)) expect(n, id).toBeGreaterThan(0)
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
  const s = await snapshot(page)
  const ids3d = [...Object.keys(s.equipmentMeshes), ...Object.keys(s.actorMeshes)].sort()
  expect(ids3d).toEqual([...equipmentIds, ...actorIds].sort())

  await page.getByRole('button', { name: '2D 插畫' }).click()
  const svg = page.locator('svg[data-view="iso2d"]')
  await expect(svg).toBeVisible()
  const ids2d = (await svg.locator('[data-entity-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-entity-id')!))).sort()
  expect(ids2d).toEqual(ids3d)

  await page.getByRole('button', { name: '廠內' }).click()
  await expect(page.locator('canvas')).toBeVisible()
  await expect(svg).toBeHidden()
})
