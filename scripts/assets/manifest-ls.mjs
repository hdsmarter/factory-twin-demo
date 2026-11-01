#!/usr/bin/env node
// manifest-ls <manifest.json>
// 驗證資產清冊；通過 → stdout 每筆一行 TSV：id\tkind\tpolyhavenId\tresolution
// 任一資產不合格 → 全部錯誤印到 stderr，exit 1，stdout 不輸出。
import { readFileSync } from 'node:fs'

const REQUIRED = ['id', 'kind', 'source', 'polyhavenId', 'resolution', 'author', 'license', 'url']
const KINDS = ['model', 'hdri', 'texture']
const LICENSE = 'CC0-1.0'
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
  const missing = REQUIRED.filter((k) => a?.[k] === undefined || a?.[k] === null || a?.[k] === '')
  if (missing.length) errors.push(`${name}：缺少欄位 ${missing.join(', ')}`)
  if (a?.kind && !KINDS.includes(a.kind)) errors.push(`${name}：kind 必須是 ${KINDS.join('|')}，收到 ${a.kind}`)
  if (a?.license && a.license !== LICENSE) errors.push(`${name}：license 必須是 ${LICENSE}，收到 ${a.license}`)
})

if (errors.length) {
  for (const e of errors) console.error(`manifest-ls：${e}`)
  process.exit(1)
}

process.stdout.write(assets.map((a) => [a.id, a.kind, a.polyhavenId, a.resolution].join('\t') + '\n').join(''))
