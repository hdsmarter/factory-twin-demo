#!/usr/bin/env node
/**
 * artifact-bundle <distDir> <outDir>
 *
 * 把 Vite 建置結果轉成 Claude Artifact 可發布的目錄（Unix 小工具：只做這一件事）：
 * - .glb → 內嵌資料（data URI）的 glTF JSON，副檔名 .json（Artifact 不提供 .glb）
 * - 移除 .hdr（Artifact 不提供；建置時以 VITE_ENV_MAP=room 改用程式產生的環境反射）
 * - index.html 改為內容格式（發布時平台會包上 doctype/head/body），模組腳本內嵌進頁面：
 *   Artifact 在沙盒 iframe（null 來源）中執行，外部 module 腳本需 CORS 而被擋（實測頁面空白）
 * stdout：要發布的支援檔清單（JSON 陣列 [{path}]，不含 index.html）；訊息走 stderr；失敗非 0。
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative } from 'node:path'

const [dist, out] = process.argv.slice(2)
if (!dist || !out) {
  console.error('用法：artifact-bundle <distDir> <outDir>')
  process.exit(2)
}
if (!existsSync(dist) || !statSync(dist).isDirectory()) {
  console.error(`artifact-bundle：dist 目錄不存在：${dist}`)
  process.exit(1)
}

/** Artifact 可提供的副檔名（其餘一律不發布並在 stderr 列出） */
const SERVED = new Set(['.css', '.js', '.mjs', '.wasm', '.json', '.map', '.txt', '.md', '.csv', '.xml', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.mp3', '.wav', '.ogg', '.mp4', '.webm', '.pdf'])
const MIME = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ktx2': 'image/ktx2' }

await MeshoptDecoder.ready
await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })

/** glb → 單檔 glTF JSON（buffers 與 images 以 data URI 內嵌） */
async function glbToEmbeddedJson(src) {
  const doc = await io.read(src)
  const { json, resources } = await io.writeJSON(doc)
  const embed = (uri, mime) => `data:${mime};base64,${Buffer.from(resources[uri]).toString('base64')}`
  for (const b of json.buffers ?? []) if (b.uri && resources[b.uri]) b.uri = embed(b.uri, 'application/octet-stream')
  for (const img of json.images ?? []) if (img.uri && resources[img.uri]) img.uri = embed(img.uri, img.mimeType ?? MIME[extname(img.uri)] ?? 'application/octet-stream')
  return JSON.stringify(json)
}

const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]))

const html = readFileSync(join(dist, 'index.html'), 'utf8')
const scriptTags = html.match(/<script[^>]*type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g) ?? []
const scriptPaths = scriptTags.map((t) => t.match(/src="\.?\/?([^"]+)"/)[1])
if (!scriptPaths.length) {
  console.error('artifact-bundle：index.html 找不到模組腳本')
  process.exit(1)
}

const published = []
for (const src of walk(dist)) {
  const rel = relative(dist, src)
  if (rel === 'index.html' || scriptPaths.includes(rel)) continue
  const ext = extname(rel).toLowerCase()
  let target = rel
  if (ext === '.glb') {
    target = rel.slice(0, -4) + '.json'
    mkdirSync(dirname(join(out, target)), { recursive: true })
    writeFileSync(join(out, target), await glbToEmbeddedJson(src))
  } else if (SERVED.has(ext)) {
    mkdirSync(dirname(join(out, target)), { recursive: true })
    copyFileSync(src, join(out, target))
  } else {
    console.error(`artifact-bundle：略過 Artifact 不提供的檔案類型：${rel}`)
    continue
  }
  published.push({ path: target })
}

// 頁面：取出 title，模組腳本內嵌（跳脫內容中的 </script，避免提早結束標籤）
const title = html.match(/<title>[\s\S]*?<\/title>/)?.[0] ?? ''
const icon = html.match(/<link rel="icon"[^>]*>/)?.[0] ?? ''
const scripts = scriptPaths.map((p) => {
  const code = readFileSync(join(dist, p), 'utf8').replace(/<\/script/gi, '<\\/script')
  return `<script type="module">${code}</script>`
})
const page = [
  title,
  icon,
  '<style>',
  '  /* 全螢幕單一深色外觀的 3D／2D 展示：背景與文字色明確指定，不跟隨宿主主題 */',
  '  :root { --bg: #101418; --fg: #f5f7fa; color-scheme: dark; }',
  '  html, body { height: 100%; }',
  '  body { background: var(--bg); color: var(--fg); overflow: hidden; }',
  '</style>',
  '<div id="root"></div>',
  ...scripts,
  '',
]
  .filter((l) => l !== '')
  .join('\n')
mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'index.html'), page + '\n')

published.sort((a, b) => a.path.localeCompare(b.path))
process.stdout.write(JSON.stringify(published) + '\n')
