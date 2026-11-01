#!/usr/bin/env node
// manifest-ls <manifest.json>
// 驗證資產清冊；通過 → stdout 每筆一行 TSV（欄位即 fetch.mjs 的參數；optimize 參數接在後面）：
//   source=polyhaven：id\tkind\tpolyhavenId\tresolution[\tsimplifyRatio]
//   source=url      ：id\tkind\turl\tarchivePath（texture-file 為空字串）
// 任一資產不合格 → 全部錯誤印到 stderr，exit 1，stdout 不輸出。
import { readFileSync } from 'node:fs'

const REQUIRED = ['id', 'kind', 'source', 'author', 'license', 'url']
// 各來源額外必填欄位與可用的 kind；url 來源的 url 是下載網址（不受信任的外部檔案）
const SOURCES = {
  polyhaven: { kinds: ['model', 'hdri', 'texture'], required: ['polyhavenId', 'resolution'] },
  url: { kinds: ['character', 'texture-file'], required: [] },
}
const KINDS = Object.values(SOURCES).flatMap((s) => s.kinds)
// MIT 要求保留著作權聲明，author 為必填（REQUIRED 已涵蓋）
const LICENSES = ['CC0-1.0', 'MIT']
// id 會成為輸出路徑的一段（public/assets/<kind>/<id>），只收安全字元
const ID_PATTERN = /^[a-z0-9_]+$/

const file = process.argv[2]
if (!file) {
  console.error('用法：manifest-ls.mjs <manifest.json>')
  process.exit(2)
}

let assets
try {
  assets = JSON.parse(readFileSync(file, 'utf8')).assets
} catch (err) {
  console.error(`manifest-ls：無法讀取 ${file}：${err.message}`)
  process.exit(1)
}
if (!Array.isArray(assets) || assets.length === 0) {
  console.error(`manifest-ls：${file} 沒有 assets 陣列`)
  process.exit(1)
}

const errors = []
const seen = new Set()
assets.forEach((a, i) => {
  const name = a?.id || `#${i}`
  if (a?.id) {
    if (typeof a.id !== 'string' || !ID_PATTERN.test(a.id)) errors.push(`${name}：id 必須符合 ${ID_PATTERN.source}`)
    if (seen.has(a.id)) errors.push(`${name}：id 重複`)
    seen.add(a.id)
  }
  const src = SOURCES[a?.source]
  const required = [...REQUIRED, ...(src?.required ?? []), ...(a?.kind === 'character' ? ['archivePath'] : [])]
  const missing = required.filter((k) => a?.[k] === undefined || a?.[k] === null || a?.[k] === '')
  if (missing.length) errors.push(`${name}：缺少欄位 ${missing.join(', ')}`)
  if (a?.source && !src) errors.push(`${name}：source 必須是 ${Object.keys(SOURCES).join('|')}，收到 ${a.source}`)
  if (a?.kind && !KINDS.includes(a.kind)) errors.push(`${name}：kind 必須是 ${KINDS.join('|')}，收到 ${a.kind}`)
  else if (a?.kind && src && !src.kinds.includes(a.kind)) {
    errors.push(`${name}：source=${a.source} 的 kind 必須是 ${src.kinds.join('|')}，收到 ${a.kind}`)
  }
  if (a?.license && !LICENSES.includes(a.license)) {
    errors.push(`${name}：license 必須是 ${LICENSES.join('|')}，收到 ${a.license}`)
  }
  if (a?.source === 'url' && a?.url && !String(a.url).startsWith('https://')) errors.push(`${name}：url 必須是 https://`)
  // TSV 輸出：欄位內不得有控制字元（tab／換行會錯欄）
  for (const k of ['url', 'archivePath', 'polyhavenId', 'resolution']) {
    if (typeof a?.[k] === 'string' && /[\x00-\x1f]/.test(a[k])) errors.push(`${name}：${k} 含控制字元`)
  }
  if (a?.archivePath !== undefined) {
    const p = String(a.archivePath)
    if (p.startsWith('/') || p.includes('\\') || p.split('/').includes('..')) {
      errors.push(`${name}：archivePath 不得是絕對路徑或含 ..，收到 ${p}`)
    }
  }
  if (a?.simplifyRatio !== undefined) {
    const r = a.simplifyRatio
    if (a.kind !== 'model' || typeof r !== 'number' || !(r > 0 && r <= 1)) {
      errors.push(`${name}：simplifyRatio 只用於 model，且必須在 (0,1]，收到 ${r}`)
    }
  }
})

if (errors.length) {
  for (const e of errors) console.error(`manifest-ls：${e}`)
  process.exit(1)
}

const row = (a) =>
  a.source === 'url'
    ? [a.id, a.kind, a.url, a.archivePath ?? '']
    : [a.id, a.kind, a.polyhavenId, a.resolution, ...(a.simplifyRatio === undefined ? [] : [a.simplifyRatio])]
process.stdout.write(assets.map((a) => row(a).join('\t') + '\n').join(''))
