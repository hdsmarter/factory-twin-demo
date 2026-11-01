#!/usr/bin/env node
// fetch <id> <kind> <polyhavenId> <resolution>
// 從 Poly Haven 下載原始資產到 assets/raw/<id>/（已存在就跳過，冪等）。
// stdout 只印 raw 路徑：model → .gltf 檔；hdri → .hdr 檔；texture → 目錄（只含 texture-maps.json 的貼圖）。
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, isAbsolute } from 'node:path'

const API = 'https://api.polyhaven.com/files/'
const HEADERS = { 'User-Agent': 'factory-twin-demo-asset-pipeline/0.1' }
// scene 必載的貼圖（texture-maps.json）；Poly Haven 檔案清單的 key 與檔名不同者在此對照
const TEXTURE_MAPS = JSON.parse(readFileSync(new URL('./texture-maps.json', import.meta.url), 'utf8'))
const POLYHAVEN_KEY = { diff: 'Diffuse' }

const [id, kind, polyhavenId, res] = process.argv.slice(2)
if (!id || !kind || !polyhavenId || !res) {
  console.error('用法：fetch.mjs <id> <kind> <polyhavenId> <resolution>')
  process.exit(2)
}

function fail(msg) {
  console.error(`fetch：${id}：${msg}`)
  process.exit(1)
}

const dir = join('assets', 'raw', id)

// 只允許寫進 dir 底下（include 的相對路徑來自外部 API）
function target(rel) {
  const abs = resolve(dir, rel)
  const back = relative(resolve(dir), abs)
  if (!back || back.startsWith('..') || isAbsolute(back)) fail(`拒絕可疑路徑 ${rel}`)
  return join(dir, back)
}

async function download(url, dest) {
  if (existsSync(dest) && statSync(dest).size > 0) return
  const r = await fetch(url, { headers: HEADERS })
  if (!r.ok) fail(`下載失敗 ${r.status} ${url}`)
  mkdirSync(dirname(dest), { recursive: true })
  const tmp = `${dest}.part`
  writeFileSync(tmp, Buffer.from(await r.arrayBuffer()))
  renameSync(tmp, dest)
}

const r = await fetch(API + encodeURIComponent(polyhavenId), { headers: HEADERS })
if (!r.ok) fail(`API ${r.status}（polyhavenId=${polyhavenId}）`)
const files = await r.json()

if (kind === 'model') {
  const entry = files.gltf?.[res]?.gltf
  if (!entry) fail(`沒有 gltf ${res}`)
  const main = target(`${polyhavenId}_${res}.gltf`)
  await download(entry.url, main)
  for (const [rel, inc] of Object.entries(entry.include ?? {})) await download(inc.url, target(rel))
  console.log(main)
} else if (kind === 'hdri') {
  const entry = files.hdri?.[res]?.hdr
  if (!entry) fail(`沒有 hdri ${res}`)
  const dest = target(`${polyhavenId}_${res}.hdr`)
  await download(entry.url, dest)
  console.log(dest)
} else if (kind === 'texture') {
  const entries = TEXTURE_MAPS.map((m) => [m, files[POLYHAVEN_KEY[m] ?? m]?.[res]?.jpg])
  const missing = entries.filter(([, e]) => !e).map(([m]) => m)
  if (missing.length) fail(`缺少必備貼圖 ${missing.join(', ')}（${res} jpg）`)
  for (const [m, e] of entries) await download(e.url, target(`${m}.jpg`))
  console.log(dir)
} else {
  fail(`未知 kind ${kind}`)
}
