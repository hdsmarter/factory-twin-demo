import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const TOOL = fileURLToPath(new URL('./manifest-ls.mjs', import.meta.url))

const asset = (over: Record<string, unknown> = {}) => ({
  id: 'crate',
  kind: 'model',
  source: 'polyhaven',
  polyhavenId: 'plastic_crate_01',
  resolution: '1k',
  author: 'Someone',
  license: 'CC0-1.0',
  url: 'https://polyhaven.com/a/plastic_crate_01',
  ...over,
})

function runWith(manifest: unknown) {
  const dir = mkdtempSync(join(tmpdir(), 'manifest-ls-'))
  const file = join(dir, 'manifest.json')
  writeFileSync(file, JSON.stringify(manifest))
  return spawnSync('node', [TOOL, file], { encoding: 'utf8' })
}

describe('manifest-ls', () => {
  it('合法清冊 → 每筆一行 TSV，exit 0', () => {
    const r = runWith({
      assets: [
        asset(),
        asset({ id: 'sky', kind: 'hdri', polyhavenId: 'empty_warehouse_01', resolution: '2k' }),
      ],
    })
    expect(r.status).toBe(0)
    expect(r.stdout).toBe('crate\tmodel\tplastic_crate_01\t1k\nsky\thdri\tempty_warehouse_01\t2k\n')
  })

  it('某資產缺 license → exit≠0、stderr 指出該 id 與欄位、stdout 空', () => {
    const { license: _drop, ...noLicense } = asset({ id: 'box' })
    void _drop
    const r = runWith({ assets: [asset(), noLicense] })
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('box')
    expect(r.stderr).toContain('license')
    expect(r.stdout).toBe('')
  })

  it('license 不是 CC0-1.0 → 拒絕', () => {
    const r = runWith({ assets: [asset({ id: 'bad', license: 'CC-BY-4.0' })] })
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('bad')
    expect(r.stdout).toBe('')
  })

  it('id 重複 → exit≠0、stderr 指出重複的 id、stdout 空', () => {
    const r = runWith({ assets: [asset({ id: 'dup' }), asset({ id: 'ok' }), asset({ id: 'dup' })] })
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('dup')
    expect(r.stderr).toContain('重複')
    expect(r.stdout).toBe('')
  })

  it('id 不符合 ^[a-z0-9_]+$ → exit≠0、stderr 指出該 id', () => {
    const r = runWith({ assets: [asset({ id: '../Evil-Id' })] })
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('../Evil-Id')
    expect(r.stdout).toBe('')
  })

  it('kind 不在 model|hdri|texture → 拒絕', () => {
    const r = runWith({ assets: [asset({ id: 'weird', kind: 'sound' })] })
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('weird')
  })
  it('kind 為 model 且有 simplifyRatio → TSV 第 5 欄是比例', () => {
    const r = runWith({ assets: [asset({ id: 'tree', simplifyRatio: 0.5 })] })
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
    expect(r.stdout).toBe('tree\tmodel\tplastic_crate_01\t1k\t0.5\n')
  })

  it('simplifyRatio 不在 (0,1] → 拒絕', () => {
    const r = runWith({ assets: [asset({ id: 'tree', simplifyRatio: 2 })] })
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('simplifyRatio')
    expect(r.stdout).toBe('')
  })
})

const ZIP_URL = 'https://example.org/files/Human%20Pack.zip'
const character = (over: Record<string, unknown> = {}) => ({
  id: 'worker',
  kind: 'character',
  source: 'url',
  url: ZIP_URL,
  archivePath: 'Human Pack/FBX/Human.fbx',
  author: 'Quaternius',
  license: 'CC0-1.0',
  ...over,
})
const textureFile = (over: Record<string, unknown> = {}) => ({
  id: 'waternormals',
  kind: 'texture-file',
  source: 'url',
  url: 'https://example.org/waternormals.jpg',
  author: 'three.js authors',
  license: 'MIT',
  ...over,
})

describe('manifest-ls source=url（S11）', () => {
  it('character（zip + archivePath）→ TSV：id、kind、url、archivePath，不需 polyhavenId/resolution', () => {
    const r = runWith({ assets: [character()] })
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
    expect(r.stdout).toBe(`worker\tcharacter\t${ZIP_URL}\tHuman Pack/FBX/Human.fbx\n`)
  })

  it('texture-file 授權 MIT 且有 author → 可接受，TSV 第 4 欄空', () => {
    const r = runWith({ assets: [textureFile()] })
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
    expect(r.stdout).toBe('waternormals\ttexture-file\thttps://example.org/waternormals.jpg\t\n')
  })

  it('MIT 但沒有 author → 拒絕', () => {
    const { author: _drop, ...noAuthor } = textureFile()
    void _drop
    const r = runWith({ assets: [noAuthor] })
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('waternormals')
    expect(r.stderr).toContain('author')
    expect(r.stdout).toBe('')
  })

  it('CC0-1.0、MIT 以外的授權（Apache-2.0、GPL-3.0）→ 拒絕', () => {
    const r = runWith({
      assets: [textureFile({ id: 'apache', license: 'Apache-2.0' }), character({ id: 'gpl', license: 'GPL-3.0' })],
    })
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('apache')
    expect(r.stderr).toContain('gpl')
    expect(r.stdout).toBe('')
  })

  it('character 缺 archivePath → 拒絕', () => {
    const { archivePath: _drop, ...noPath } = character()
    void _drop
    const r = runWith({ assets: [noPath] })
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('archivePath')
    expect(r.stdout).toBe('')
  })

  it('archivePath 含 .. 或是絕對路徑 → 拒絕', () => {
    const r = runWith({
      assets: [character({ id: 'up', archivePath: '../x.fbx' }), character({ id: 'abs', archivePath: '/etc/x.fbx' })],
    })
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('up')
    expect(r.stderr).toContain('abs')
    expect(r.stdout).toBe('')
  })

  it('url 不是 https → 拒絕', () => {
    const r = runWith({ assets: [character({ url: 'http://example.org/a.zip' })] })
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('https')
  })

  it('source=url 卻用 Poly Haven 的 kind（model）→ 拒絕', () => {
    const r = runWith({ assets: [character({ id: 'mismatch', kind: 'model' })] })
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('mismatch')
  })

  it('未知 source → 拒絕', () => {
    const r = runWith({ assets: [character({ id: 'ftp', source: 'ftp' })] })
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('ftp')
  })
})
