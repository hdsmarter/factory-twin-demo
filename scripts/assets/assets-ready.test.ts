import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// gltf-validator 沒有型別宣告；只用到 validateBytes 的 numErrors
const validator = createRequire(import.meta.url)('gltf-validator') as {
  validateBytes(data: Uint8Array): Promise<{ issues: { numErrors: number } }>
}

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const manifest = JSON.parse(readFileSync(`${ROOT}assets/manifest.json`, 'utf8')) as {
  assets: { id: string; kind: 'model' | 'hdri' | 'texture' | 'texture-file' | 'character'; url: string }[]
}

const TEXTURE_MAPS = JSON.parse(readFileSync(`${ROOT}scripts/assets/texture-maps.json`, 'utf8')) as string[]

// 角色動畫：網頁端以名稱結尾比對（FBX 轉出的名稱帶 armature 前綴，如 `Human Armature|Walk`）
const REQUIRED_CLIPS = ['Walk', 'Idle', 'Working']
const extOf = (url: string) => url.slice(url.lastIndexOf('.')).toLowerCase()

async function readMeshoptGlb(file: string) {
  await MeshoptDecoder.ready
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
  })
  return io.read(file)
}

describe('資產就緒（S9／S10／S11）', () => {
  it('清冊列出 model、hdri、texture、texture-file、character 各至少一個', () => {
    const kinds = new Set(manifest.assets.map((a) => a.kind))
    expect([...kinds].sort()).toEqual(['character', 'hdri', 'model', 'texture', 'texture-file'])
  })

  for (const a of manifest.assets) {
    if (a.kind === 'model') {
      it(`model ${a.id}：glb 存在且 gltf-validator 0 errors`, async () => {
        const file = `${ROOT}public/assets/models/${a.id}.glb`
        expect(existsSync(file), file).toBe(true)
        const report = await validator.validateBytes(new Uint8Array(readFileSync(file)))
        expect(report.issues.numErrors).toBe(0)
      })
    } else if (a.kind === 'character') {
      it(`character ${a.id}：glb 存在且 gltf-validator 0 errors`, async () => {
        const file = `${ROOT}public/assets/models/${a.id}.glb`
        expect(existsSync(file), file).toBe(true)
        const report = await validator.validateBytes(new Uint8Array(readFileSync(file)))
        expect(report.issues.numErrors).toBe(0)
      })
      it(`character ${a.id}：保留 ${REQUIRED_CLIPS.join('、')} 動畫`, async () => {
        const doc = await readMeshoptGlb(`${ROOT}public/assets/models/${a.id}.glb`)
        const names = doc.getRoot().listAnimations().map((x) => x.getName())
        for (const clip of REQUIRED_CLIPS) {
          expect(names.some((n) => n === clip || n.endsWith(`|${clip}`)), `${clip} ∉ ${names.join(', ')}`).toBe(true)
        }
        for (const anim of doc.getRoot().listAnimations().filter((x) => REQUIRED_CLIPS.some((c) => x.getName().endsWith(c)))) {
          expect(anim.listChannels().length, anim.getName()).toBeGreaterThan(0)
        }
      })
    } else if (a.kind === 'texture-file') {
      it(`texture-file ${a.id}：檔案存在且非空`, () => {
        const file = `${ROOT}public/assets/textures/${a.id}${extOf(a.url)}`
        expect(existsSync(file), file).toBe(true)
        expect(statSync(file).size).toBeGreaterThan(0)
      })
    } else if (a.kind === 'hdri') {
      it(`hdri ${a.id}：.hdr 存在且非空`, () => {
        const file = `${ROOT}public/assets/hdri/${a.id}.hdr`
        expect(existsSync(file), file).toBe(true)
        expect(statSync(file).size).toBeGreaterThan(0)
      })
    } else if (a.kind === 'texture') {
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
    } else {
      it(`${a.id}：未知 kind ${a.kind as string}`, () => {
        expect.fail(`清冊出現測試未涵蓋的 kind ${a.kind as string}`)
      })
    }
  }

  it('public/assets/textures 的目錄與清冊的 texture 一一對應', () => {
    const entries = readdirSync(`${ROOT}public/assets/textures`, { withFileTypes: true })
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort()
    const ids = manifest.assets.filter((a) => a.kind === 'texture').map((a) => a.id).sort()
    expect(dirs).toEqual(ids)
  })

  it('public/assets/textures 的單檔與清冊的 texture-file 一一對應（沒有其他雜檔）', () => {
    const entries = readdirSync(`${ROOT}public/assets/textures`, { withFileTypes: true })
    const files = entries.filter((e) => !e.isDirectory()).map((e) => e.name).sort()
    const expected = manifest.assets
      .filter((a) => a.kind === 'texture-file')
      .map((a) => `${a.id}${extOf(a.url)}`)
      .sort()
    expect(files).toEqual(expected)
  })
})
