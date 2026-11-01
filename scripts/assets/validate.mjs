#!/usr/bin/env node
// validate <path>
// .glb → gltf-validator，numErrors>0 即失敗；texture 目錄 → texture-maps.json 每張都存在且非空；
// 其他檔案 → 必須存在且非空。
// 成功 → stdout 印出路徑；失敗 → stderr 說明、exit 1。
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import validator from 'gltf-validator'

const TEXTURE_MAPS = JSON.parse(readFileSync(new URL('./texture-maps.json', import.meta.url), 'utf8'))

const path = process.argv[2]
if (!path) {
  console.error('用法：validate.mjs <path>')
  process.exit(2)
}

function fail(msg) {
  console.error(`validate：${path}：${msg}`)
  process.exit(1)
}

let st
try {
  st = statSync(path)
} catch {
  fail('不存在')
}

if (st.isDirectory()) {
  // 目錄 = texture：scene 會載入清單上的每一張，逐張檢查
  if (readdirSync(path).length === 0) fail('目錄是空的')
  for (const m of TEXTURE_MAPS) {
    const file = join(path, `${m}.jpg`)
    if (!existsSync(file)) fail(`缺少必備貼圖 ${m}.jpg`)
    if (statSync(file).size === 0) fail(`必備貼圖 ${m}.jpg 是空的`)
  }
} else if (st.size === 0) {
  fail('檔案是空的')
} else if (path.toLowerCase().endsWith('.glb')) {
  let report
  try {
    report = await validator.validateBytes(new Uint8Array(readFileSync(path)), { maxIssues: 50 })
  } catch (err) {
    fail(`無法解析：${err?.message ?? err}`)
  }
  const { numErrors, messages } = report.issues
  if (numErrors > 0) {
    for (const m of messages.filter((m) => m.severity === 0)) {
      console.error(`validate：${path}：${m.code} ${m.pointer ?? ''} ${m.message}`)
    }
    fail(`${numErrors} 個 glTF 錯誤`)
  }
}

console.log(path)
