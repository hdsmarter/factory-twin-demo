import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Document, NodeIO } from '@gltf-transform/core'
import { describe, expect, it } from 'vitest'

const TOOL = 'scripts/deploy/artifact-bundle.mjs'
const SERVED = /\.(html|css|js|mjs|wasm|json|map|txt|md|csv|xml|svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?|ttf|otf|mp3|wav|ogg|mp4|webm|pdf)$/

async function fixtureDist(): Promise<string> {
  const dist = mkdtempSync(join(tmpdir(), 'dist-'))
  mkdirSync(join(dist, 'assets/models'), { recursive: true })
  mkdirSync(join(dist, 'assets/hdri'), { recursive: true })
  writeFileSync(join(dist, 'index.html'), '<!doctype html><html><head><title>荒島工廠分身</title><script type="module" crossorigin src="./assets/index-abc.js"></script></head><body><div id="root"></div></body></html>')
  writeFileSync(join(dist, 'assets/index-abc.js'), 'console.log("</script>");export const x = 1')
  writeFileSync(join(dist, 'assets/hdri/x.hdr'), 'HDR')
  const doc = new Document()
  const buf = doc.createBuffer()
  const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])).setBuffer(buf)
  doc.createScene().addChild(doc.createNode().setMesh(doc.createMesh().addPrimitive(doc.createPrimitive().setAttribute('POSITION', pos))))
  writeFileSync(join(dist, 'assets/models/tri.glb'), await new NodeIO().writeBinary(doc))
  return dist
}

const run = (dist: string, out: string) => spawnSync('node', [TOOL, dist, out], { encoding: 'utf8' })

describe('artifact-bundle', () => {
  it('輸出目錄只含 Artifact 可提供的檔案類型；glb 轉為內嵌資料的 glTF JSON；不含 .hdr', async () => {
    const out = mkdtempSync(join(tmpdir(), 'pub-'))
    const r = run(await fixtureDist(), out)
    expect(r.status, r.stderr).toBe(0)
    const files = (JSON.parse(r.stdout) as { path: string }[]).map((f) => f.path).sort()
    expect(files).toEqual(['assets/models/tri.json']) // 腳本已內嵌進頁面，不另外發布
    for (const f of files) expect(f).toMatch(SERVED)
    const gltf = JSON.parse(readFileSync(join(out, 'assets/models/tri.json'), 'utf8'))
    expect(gltf.asset.version).toBe('2.0')
    expect(gltf.buffers.every((b: { uri: string }) => b.uri.startsWith('data:'))).toBe(true)
    expect(existsSync(join(out, 'assets/hdri'))).toBe(false)
  })

  it('頁面檔改為內容格式，模組腳本內嵌（沙盒 iframe 的 null 來源無法以 CORS 載入外部模組）', async () => {
    const out = mkdtempSync(join(tmpdir(), 'pub-'))
    expect(run(await fixtureDist(), out).status).toBe(0)
    const page = readFileSync(join(out, 'index.html'), 'utf8')
    expect(page).not.toMatch(/<!doctype|<html|<head|<body/i)
    expect(page).toContain('<title>荒島工廠分身</title>')
    expect(page).not.toMatch(/<script[^>]*\ssrc=/)
    expect(page).toContain('<script type="module">')
    expect(page).toContain('export const x = 1')
    // 腳本內容中的 </script> 必須跳脫，否則會提早結束標籤
    expect(page.match(/<\/script>/g)?.length).toBe(1)
    expect(page).toContain('<div id="root"></div>')
  })

  it('來源目錄不存在 → 非 0 且 stderr 說明', () => {
    const r = run('/nonexistent-dist', mkdtempSync(join(tmpdir(), 'pub-')))
    expect(r.status).not.toBe(0)
    expect(r.stderr).toMatch(/dist/)
    expect(readdirSync(tmpdir()).length).toBeGreaterThan(0)
  })
})
