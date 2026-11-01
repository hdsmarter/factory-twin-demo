#!/usr/bin/env node
// fetch <id> <kind> <ref> <extra>
// 下載原始資產到 assets/raw/<id>/（已存在就跳過，冪等）。參數即 manifest-ls 的 TSV 欄位：
//   model|hdri|texture（Poly Haven）：ref=polyhavenId，extra=resolution
//   character（zip）               ：ref=下載網址，extra=zip 內 FBX 的相對路徑
//   texture-file（單一圖片）        ：ref=下載網址，extra 為空字串
// stdout 只印 raw 路徑：model → .gltf 檔；hdri → .hdr 檔；texture → 目錄（只含 texture-maps.json 的貼圖）；
// character → 解出的 .fbx 檔；texture-file → 圖片檔。
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve, isAbsolute } from 'node:path'

const API = 'https://api.polyhaven.com/files/'
const HEADERS = { 'User-Agent': 'factory-twin-demo-asset-pipeline/0.1' }
// scene 必載的貼圖（texture-maps.json）；Poly Haven 檔案清單的 key 與檔名不同者在此對照
const TEXTURE_MAPS = JSON.parse(readFileSync(new URL('./texture-maps.json', import.meta.url), 'utf8'))
const POLYHAVEN_KEY = { diff: 'Diffuse' }

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp']

const [id, kind, ref, extra] = process.argv.slice(2)
const URL_KINDS = ['character', 'texture-file']
if (!id || !kind || !ref || extra === undefined || (!URL_KINDS.includes(kind) && !extra)) {
  console.error('用法：fetch.mjs <id> <kind> <polyhavenId|url> <resolution|archivePath>')
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

// zip 是不受信任的下載物：先檢查每個項目名稱，任何一個可疑就整包拒絕；
// 只取出 archivePath 那一個檔、由我們決定寫入位置（不讓 unzip 依項目名稱建檔，也就不受 symlink 項目影響）
function suspiciousEntry(name) {
  return (
    /[\x00-\x1f]/.test(name) ||
    name.startsWith('/') ||
    name.includes('\\') ||
    /^[A-Za-z]:/.test(name) ||
    name.split('/').includes('..')
  )
}

function extractOne(zip, entry, dest) {
  let names
  try {
    names = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      .split('\n')
      .filter(Boolean)
  } catch (err) {
    fail(`無法讀取 zip：${err.stderr?.toString().trim() || err.message}`)
  }
  const bad = names.filter(suspiciousEntry)
  if (bad.length) fail(`拒絕可疑的 zip 項目 ${bad.join(', ')}`)
  if (!names.includes(entry)) fail(`zip 內沒有 ${entry}`)
  // unzip 的檔名參數是萬用字元樣式，把 [ * ? 轉成字元類別以字面比對
  const pattern = entry.replace(/[[*?]/g, (c) => `[${c}]`)
  const bytes = execFileSync('unzip', ['-p', zip, pattern], { maxBuffer: 1024 ** 3, stdio: ['ignore', 'pipe', 'pipe'] })
  if (bytes.length === 0) fail(`zip 內的 ${entry} 是空的`)
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(`${dest}.part`, bytes)
  renameSync(`${dest}.part`, dest)
}

if (kind === 'character') {
  const zip = target('source.zip')
  const fbx = target(join('unzipped', extra))
  await download(ref, zip)
  extractOne(zip, extra, fbx)
  console.log(fbx)
  process.exit(0)
}

if (kind === 'texture-file') {
  let ext
  try {
    ext = extname(new URL(ref).pathname).toLowerCase()
  } catch {
    fail(`網址無效 ${ref}`)
  }
  if (!IMAGE_EXTS.includes(ext)) fail(`texture-file 只接受 ${IMAGE_EXTS.join('|')}，收到 ${ext || '(無副檔名)'}`)
  const dest = target(`${id}${ext}`)
  await download(ref, dest)
  console.log(dest)
  process.exit(0)
}

const polyhavenId = ref
const res = extra
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
