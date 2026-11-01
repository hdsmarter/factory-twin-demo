import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// gltf-validator 沒有型別宣告；只用到 validateBytes 的 numErrors
const validator = createRequire(import.meta.url)('gltf-validator') as {
  validateBytes(data: Uint8Array): Promise<{ issues: { numErrors: number } }>
}

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const manifest = JSON.parse(readFileSync(`${ROOT}assets/manifest.json`, 'utf8')) as {
  assets: { id: string; kind: 'model' | 'hdri' | 'texture' }[]
}

const TEXTURE_MAPS = JSON.parse(readFileSync(`${ROOT}scripts/assets/texture-maps.json`, 'utf8')) as string[]

describe('資產就緒（S9）', () => {
  it('清冊至少列出一個 model、hdri、texture', () => {
    const kinds = new Set(manifest.assets.map((a) => a.kind))
    expect([...kinds].sort()).toEqual(['hdri', 'model', 'texture'])
  })

  for (const a of manifest.assets) {
    if (a.kind === 'model') {
      it(`model ${a.id}：glb 存在且 gltf-validator 0 errors`, async () => {
        const file = `${ROOT}public/assets/models/${a.id}.glb`
        expect(existsSync(file), file).toBe(true)
        const report = await validator.validateBytes(new Uint8Array(readFileSync(file)))
        expect(report.issues.numErrors).toBe(0)
      })
    } else if (a.kind === 'hdri') {
      it(`hdri ${a.id}：.hdr 存在且非空`, () => {
        const file = `${ROOT}public/assets/hdri/${a.id}.hdr`
        expect(existsSync(file), file).toBe(true)
        expect(statSync(file).size).toBeGreaterThan(0)
      })
    } else {
      for (const m of TEXTURE_MAPS) {
        it(`texture ${a.id}：${m}.jpg 存在且非空`, () => {
          const file = `${ROOT}public/assets/textures/${a.id}/${m}.jpg`
          expect(existsSync(file), file).toBe(true)
          expect(statSync(file).size).toBeGreaterThan(0)
        })
      }
      it(`texture ${a.id}：目錄只有必備貼圖（scene 不用的不出貨）`, () => {
        const files = readdirSync(`${ROOT}public/assets/textures/${a.id}`).sort()
        expect(files).toEqual(TEXTURE_MAPS.map((m) => `${m}.jpg`).sort())
      })
    }
  }

  it('public/assets/textures 的目錄與清冊的 texture 一一對應', () => {
    const dirs = readdirSync(`${ROOT}public/assets/textures`).sort()
    const ids = manifest.assets.filter((a) => a.kind === 'texture').map((a) => a.id).sort()
    expect(dirs).toEqual(ids)
  })
})
