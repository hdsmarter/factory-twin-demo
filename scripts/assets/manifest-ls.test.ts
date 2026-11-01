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
})
