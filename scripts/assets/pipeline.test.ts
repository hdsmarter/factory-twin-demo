import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = fileURLToPath(new URL('./', import.meta.url))
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const tmp = () => mkdtempSync(join(tmpdir(), 'pipeline-'))

describe('pipeline.sh（S10）', () => {
  it('清冊有資產缺 license → exit≠0、stderr 含該資產 id（在 repo 外的 cwd 執行，不連網）', () => {
    const dir = tmp()
    const file = join(dir, 'manifest.json')
    writeFileSync(
      file,
      JSON.stringify({
        assets: [
          {
            id: 'no_license_box',
            kind: 'model',
            source: 'polyhaven',
            polyhavenId: 'cardboard_box_01',
            resolution: '1k',
            author: 'Someone',
            url: 'https://polyhaven.com/a/cardboard_box_01',
          },
        ],
      }),
    )
    const r = spawnSync('bash', [join(HERE, 'pipeline.sh'), file], { cwd: dir, encoding: 'utf8' })
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('no_license_box')
    expect(r.stdout).toBe('')
  })

  it('pipeline.sh、optimize.sh 以 #!/usr/bin/env bash 開頭', () => {
    for (const f of ['pipeline.sh', 'optimize.sh']) {
      expect(readFileSync(join(HERE, f), 'utf8').split('\n')[0], f).toBe('#!/usr/bin/env bash')
    }
  })

  it('npm run assets 用 bash 執行 pipeline', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
    expect(pkg.scripts.assets).toBe('bash scripts/assets/pipeline.sh assets/manifest.json')
  })
})

// 以 --import 預載替身取代 global fetch：API 回應取自 FAKE_FILES，下載回傳固定位元組，請求的 URL 記到 FETCH_LOG。
const STUB = `
import { appendFileSync } from 'node:fs'
globalThis.fetch = async (url) => {
  appendFileSync(process.env.FETCH_LOG, url + '\\n')
  if (url.startsWith('https://api.polyhaven.com/')) {
    return { ok: true, status: 200, json: async () => JSON.parse(process.env.FAKE_FILES) }
  }
  return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode('jpg').buffer }
}
`

function fetchTexture(files: Record<string, unknown>) {
  const dir = tmp()
  const stub = join(dir, 'stub.mjs')
  const log = join(dir, 'fetch.log')
  writeFileSync(stub, STUB)
  writeFileSync(log, '')
  const r = spawnSync('node', ['--import', stub, join(HERE, 'fetch.mjs'), 'tex', 'texture', 'tex_ph', '1k'], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, FAKE_FILES: JSON.stringify(files), FETCH_LOG: log },
  })
  return { ...r, dir, raw: join(dir, 'assets', 'raw', 'tex'), urls: readFileSync(log, 'utf8') }
}

const jpg = (name: string) => ({ '1k': { jpg: { url: `https://dl.polyhaven.org/${name}.jpg` } } })

describe('fetch.mjs texture（C7/D7/D16）', () => {
  it('三張必備貼圖齊全 → 只下載 diff/nor_gl/arm，不下載 rough', () => {
    const r = fetchTexture({ Diffuse: jpg('diff'), nor_gl: jpg('nor_gl'), Rough: jpg('rough'), arm: jpg('arm') })
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
    expect(readdirSync(r.raw).sort()).toEqual(['arm.jpg', 'diff.jpg', 'nor_gl.jpg'])
    expect(r.urls).not.toContain('rough')
  })

  it('Poly Haven 缺 arm → exit 1、stderr 指出 arm', () => {
    const r = fetchTexture({ Diffuse: jpg('diff'), nor_gl: jpg('nor_gl'), Rough: jpg('rough') })
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('arm')
    expect(r.stdout).toBe('')
    expect(existsSync(join(r.raw, 'arm.jpg'))).toBe(false)
  })
})
