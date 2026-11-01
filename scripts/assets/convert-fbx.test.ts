import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// 不連網、沒有可用的 FBX fixture：只測參數防呆；真實轉檔由 assets-ready.test.ts 涵蓋
const TOOL = fileURLToPath(new URL('./convert-fbx.sh', import.meta.url))
const tmp = () => mkdtempSync(join(tmpdir(), 'convert-fbx-'))
const run = (...args: string[]) => spawnSync('bash', [TOOL, ...args], { encoding: 'utf8' })

describe('convert-fbx.sh（S11）', () => {
  it('輸入 FBX 不存在 → exit≠0、stderr 有訊息、stdout 空、不產生輸出', () => {
    const dir = tmp()
    const out = join(dir, 'out.glb')
    const r = run(join(dir, 'nope.fbx'), out)
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('nope.fbx')
    expect(r.stdout).toBe('')
    expect(existsSync(out)).toBe(false)
  })

  it('輸出副檔名不是 .glb → exit≠0、stderr 指出 .glb', () => {
    const dir = tmp()
    const fbx = join(dir, 'in.fbx')
    writeFileSync(fbx, 'not really fbx')
    const r = run(fbx, join(dir, 'out.gltf'))
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('.glb')
    expect(r.stdout).toBe('')
  })

  it('參數數量不對 → exit≠0', () => {
    const r = run()
    expect(r.status).not.toBe(0)
    expect(r.stderr).not.toBe('')
  })
})
