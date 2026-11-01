import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
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

  it('pipeline.sh、optimize.sh、convert-fbx.sh 以 #!/usr/bin/env bash 開頭', () => {
    for (const f of ['pipeline.sh', 'optimize.sh', 'convert-fbx.sh']) {
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
import { appendFileSync, readFileSync } from 'node:fs'
globalThis.fetch = async (url) => {
  appendFileSync(process.env.FETCH_LOG, url + '\\n')
  if (url.startsWith('https://api.polyhaven.com/')) {
    return { ok: true, status: 200, json: async () => JSON.parse(process.env.FAKE_FILES) }
  }
  const body = process.env.FAKE_BODY ? new Uint8Array(readFileSync(process.env.FAKE_BODY)) : new TextEncoder().encode('jpg')
  return { ok: true, status: 200, arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) }
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

// 以 python3 zipfile 造 zip（可以寫入 ../ 與絕對路徑等惡意項目）
function makeZip(entries: Record<string, string>) {
  const dir = tmp()
  const zip = join(dir, 'pack.zip')
  const r = spawnSync(
    'python3',
    ['-I', '-c', 'import json,sys,zipfile\nz=zipfile.ZipFile(sys.argv[1],"w")\nfor k,v in json.loads(sys.argv[2]).items(): z.writestr(k,v)\nz.close()', zip, JSON.stringify(entries)],
    { encoding: 'utf8' },
  )
  expect(r.status, r.stderr).toBe(0)
  return zip
}

function fetchUrl(args: string[], body?: string) {
  const dir = tmp()
  const stub = join(dir, 'stub.mjs')
  const log = join(dir, 'fetch.log')
  writeFileSync(stub, STUB)
  writeFileSync(log, '')
  const env: Record<string, string | undefined> = { ...process.env, FAKE_FILES: '{}', FETCH_LOG: log, FAKE_BODY: body }
  const r = spawnSync('node', ['--import', stub, join(HERE, 'fetch.mjs'), ...args], { cwd: dir, encoding: 'utf8', env })
  return { ...r, dir, urls: readFileSync(log, 'utf8') }
}

const ZIP_URL = 'https://example.org/files/Human%20Pack.zip'

describe('fetch.mjs source=url（S11）', () => {
  it('character：下載 zip、解壓，stdout 印 archivePath 指到的 FBX', () => {
    const zip = makeZip({ 'Human Pack/FBX/Human.fbx': 'FBX-BYTES', 'Human Pack/License.txt': 'CC0' })
    const r = fetchUrl(['worker', 'character', ZIP_URL, 'Human Pack/FBX/Human.fbx'], zip)
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
    const out = r.stdout.trim()
    expect(out.startsWith(join('assets', 'raw', 'worker'))).toBe(true)
    expect(out.endsWith(join('Human Pack', 'FBX', 'Human.fbx'))).toBe(true)
    expect(readFileSync(join(r.dir, out), 'utf8')).toBe('FBX-BYTES')
    expect(r.urls.trim()).toBe(ZIP_URL)
  })

  it('zip 內有 ../ 路徑 → exit≠0、stderr 指出該路徑、什麼都不解壓', () => {
    const zip = makeZip({ 'Human Pack/FBX/Human.fbx': 'FBX', '../evil.txt': 'pwn' })
    const r = fetchUrl(['worker', 'character', ZIP_URL, 'Human Pack/FBX/Human.fbx'], zip)
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('../evil.txt')
    expect(r.stdout).toBe('')
    expect(existsSync(join(r.dir, 'assets', 'raw', 'evil.txt'))).toBe(false)
    expect(existsSync(join(r.dir, 'assets', 'evil.txt'))).toBe(false)
    expect(existsSync(join(r.dir, 'assets', 'raw', 'worker', 'unzipped'))).toBe(false)
  })

  it('zip 內有絕對路徑 → exit≠0', () => {
    const zip = makeZip({ 'Human Pack/FBX/Human.fbx': 'FBX', '/tmp/evil_abs.txt': 'pwn' })
    const r = fetchUrl(['worker', 'character', ZIP_URL, 'Human Pack/FBX/Human.fbx'], zip)
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('evil_abs.txt')
    expect(r.stdout).toBe('')
  })

  it('zip 內沒有 archivePath → exit≠0、stderr 指出 archivePath', () => {
    const zip = makeZip({ 'Other/x.fbx': 'FBX' })
    const r = fetchUrl(['worker', 'character', ZIP_URL, 'Human Pack/FBX/Human.fbx'], zip)
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('Human Pack/FBX/Human.fbx')
    expect(r.stdout).toBe('')
  })

  it('texture-file：下載單一圖片，stdout 印 raw 檔（副檔名取自 url）', () => {
    const r = fetchUrl(['waternormals', 'texture-file', 'https://example.org/t/waternormals.jpg', ''])
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
    expect(r.stdout.trim()).toBe(join('assets', 'raw', 'waternormals', 'waternormals.jpg'))
    expect(readFileSync(join(r.dir, r.stdout.trim()), 'utf8')).toBe('jpg')
  })

  it('texture-file 的 url 不是圖片副檔名 → exit≠0', () => {
    const r = fetchUrl(['wn', 'texture-file', 'https://example.org/t/payload.sh', ''])
    expect(r.status).not.toBe(0)
    expect(r.stdout).toBe('')
  })
})

describe('optimize.sh texture-file（S10）', () => {
  it('複製到 public/assets/textures/<id>.<ext>，stdout 印該路徑', () => {
    const dir = tmp()
    mkdirSync(join(dir, 'assets', 'raw', 'wn'), { recursive: true })
    writeFileSync(join(dir, 'assets', 'raw', 'wn', 'wn.jpg'), 'jpg')
    const r = spawnSync('bash', [join(HERE, 'optimize.sh'), 'assets/raw/wn/wn.jpg', 'wn', 'texture-file'], {
      cwd: dir,
      encoding: 'utf8',
    })
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
    expect(r.stdout.trim()).toBe('public/assets/textures/wn.jpg')
    expect(readFileSync(join(dir, 'public/assets/textures/wn.jpg'), 'utf8')).toBe('jpg')
  })
})
