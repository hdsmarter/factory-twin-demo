import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Document, NodeIO } from '@gltf-transform/core'
import { describe, expect, it } from 'vitest'

const TOOL = fileURLToPath(new URL('./validate.mjs', import.meta.url))
const TEXTURE_MAPS = JSON.parse(
  readFileSync(fileURLToPath(new URL('./texture-maps.json', import.meta.url)), 'utf8'),
) as string[]
const run = (path: string) => spawnSync('node', [TOOL, path], { encoding: 'utf8' })
const tmp = () => mkdtempSync(join(tmpdir(), 'validate-'))

async function writeTriangleGlb(file: string) {
  const doc = new Document()
  const buffer = doc.createBuffer()
  const position = doc
    .createAccessor()
    .setType('VEC3')
    .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
    .setBuffer(buffer)
  const prim = doc.createPrimitive().setAttribute('POSITION', position)
  const mesh = doc.createMesh('tri').addPrimitive(prim)
  const node = doc.createNode('tri').setMesh(mesh)
  doc.createScene('scene').addChild(node)
  await new NodeIO().write(file, doc)
}

describe('validate', () => {
  it('合法的最小 glb → exit 0，stdout 印出路徑', async () => {
    const file = join(tmp(), 'tri.glb')
    await writeTriangleGlb(file)
    const r = run(file)
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
    expect(r.stdout.trim()).toBe(file)
  })

  it('隨機位元組的 .glb → exit≠0，stdout 空', () => {
    const file = join(tmp(), 'bad.glb')
    writeFileSync(file, Buffer.from(Array.from({ length: 256 }, (_, i) => (i * 37 + 11) % 256)))
    const r = run(file)
    expect(r.status).not.toBe(0)
    expect(r.stdout).toBe('')
  })

  it('空目錄 → exit≠0', () => {
    const dir = join(tmp(), 'empty')
    mkdirSync(dir)
    const r = run(dir)
    expect(r.status).not.toBe(0)
    expect(r.stdout).toBe('')
  })

  it('texture 目錄三張必備貼圖齊全 → exit 0', () => {
    const dir = join(tmp(), 'tex')
    mkdirSync(dir)
    for (const m of TEXTURE_MAPS) writeFileSync(join(dir, `${m}.jpg`), 'jpg')
    const r = run(dir)
    expect(r.status).toBe(0)
    expect(r.stdout.trim()).toBe(dir)
  })

  it('texture 目錄缺 arm.jpg → exit≠0、stderr 指出 arm.jpg', () => {
    const dir = join(tmp(), 'tex')
    mkdirSync(dir)
    writeFileSync(join(dir, 'diff.jpg'), 'jpg')
    writeFileSync(join(dir, 'nor_gl.jpg'), 'jpg')
    writeFileSync(join(dir, 'rough.jpg'), 'jpg')
    const r = run(dir)
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('arm.jpg')
    expect(r.stdout).toBe('')
  })

  it('texture 目錄有 0 byte 的必備貼圖 → exit≠0', () => {
    const dir = join(tmp(), 'tex')
    mkdirSync(dir)
    for (const m of TEXTURE_MAPS) writeFileSync(join(dir, `${m}.jpg`), m === 'nor_gl' ? '' : 'jpg')
    const r = run(dir)
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('nor_gl.jpg')
  })

  it('非空的一般檔案 → exit 0', () => {
    const file = join(tmp(), 'sky.hdr')
    writeFileSync(file, '#?RADIANCE\n')
    const r = run(file)
    expect(r.status).toBe(0)
    expect(r.stdout.trim()).toBe(file)
  })

  it('不存在的路徑 → exit≠0', () => {
    const r = run(join(tmp(), 'nope.hdr'))
    expect(r.status).not.toBe(0)
  })
})
