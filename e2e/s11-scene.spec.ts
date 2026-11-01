import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

type Probe = { ready: boolean; equipmentMeshes: Record<string, number>; buildingMeshes: number }
declare global {
  interface Window {
    __factory?: Probe
  }
}

/** 從產線配置取出所有設備編號（與畫面上渲染出來的比對） */
function layoutEquipmentIds(): string[] {
  const site = JSON.parse(readFileSync(new URL('../data/factory-layout.json', import.meta.url), 'utf8')) as {
    areas: { lines: { cells: { equipment: { id: string }[] }[] }[] }[]
  }
  return site.areas.flatMap((a) => a.lines.flatMap((l) => l.cells.flatMap((c) => c.equipment.map((e) => e.id)))).sort()
}

async function waitForProbe(page: Page): Promise<Probe> {
  await expect.poll(() => page.evaluate(() => window.__factory?.ready ?? false), { timeout: 90_000 }).toBe(true)
  return page.evaluate(() => window.__factory!)
}

/** 畫面不是單一色：把 WebGL 畫布縮小取樣，計算亮度標準差 */
function canvasLuminanceStdDev(page: Page): Promise<number> {
  return page.evaluate(() => {
    const src = document.querySelector('canvas')!
    const c = document.createElement('canvas')
    c.width = 160
    c.height = 90
    const ctx = c.getContext('2d')!
    ctx.drawImage(src, 0, 0, c.width, c.height)
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    const lum: number[] = []
    for (let i = 0; i < d.length; i += 4) lum.push(0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!)
    const mean = lum.reduce((a, b) => a + b, 0) / lum.length
    return Math.sqrt(lum.reduce((a, b) => a + (b - mean) ** 2, 0) / lum.length)
  })
}

test('@S11 開啟展示頁看到寫實 3D 產線', async ({ page }) => {
  const problems: string[] = []
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text()))
  page.on('pageerror', (e) => problems.push(e.message))
  page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()}`))

  await page.goto('/?probe=1')
  const probe = await waitForProbe(page)

  // 每台設備都實際畫出了可見網格（不是只有空的容器）
  expect(probe.equipmentMeshes, '探針需回報每台設備的網格數').toBeDefined()
  expect(Object.keys(probe.equipmentMeshes).sort()).toEqual(layoutEquipmentIds())
  for (const [id, meshes] of Object.entries(probe.equipmentMeshes)) expect(meshes, id).toBeGreaterThan(0)
  // 廠房也畫出來了
  expect(probe.buildingMeshes).toBeGreaterThan(0)

  await expect(page.locator('canvas')).toBeVisible()
  await page.waitForTimeout(1500) // 讓後處理與陰影穩定
  expect(await canvasLuminanceStdDev(page)).toBeGreaterThan(10) // 非黑畫面／非單色
  await page.screenshot({ path: 'artifacts/screenshots/s11-scene.png' })

  expect(problems).toEqual([])
})

test('@S11 某個裝飾道具載入失敗時，產線設備仍完整呈現', async ({ page }) => {
  await page.route('**/assets/models/metal_toolbox.glb', (route) => route.fulfill({ status: 404, body: 'not found' }))
  await page.goto('/?probe=1')
  const probe = await waitForProbe(page)
  expect(probe.equipmentMeshes, '探針需回報每台設備的網格數').toBeDefined()
  expect(Object.keys(probe.equipmentMeshes).sort()).toEqual(layoutEquipmentIds())
  for (const [id, meshes] of Object.entries(probe.equipmentMeshes)) expect(meshes, id).toBeGreaterThan(0)
  expect(probe.buildingMeshes).toBeGreaterThan(0)
})
