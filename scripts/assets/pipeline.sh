#!/usr/bin/env bash
# pipeline <manifest.json>
# manifest-ls → (fetch | optimize | validate) × 資產，GNU parallel 並行 4 支，任一失敗立即停止。
# TSV 欄位 1–4 給 fetch；第 5 欄（simplifyRatio，可省略）給 optimize，缺欄時 parallel 會把 {5} 展開成空。
# stdout：每個通過驗證的輸出路徑。bash 3.2 相容。
set -eo pipefail

if [ $# -ne 1 ]; then
  echo "用法：pipeline.sh <manifest.json>" >&2
  exit 2
fi

# 清冊路徑先轉絕對，再 cd 到 repo 根：fetch/optimize 的輸出路徑都相對 repo 根，與呼叫者 cwd 無關
manifest="$(cd "$(dirname "${1}")" && pwd)/$(basename "${1}")"
cd "$(dirname "$0")/../.."

dir="scripts/assets"

node "${dir}/manifest-ls.mjs" "${manifest}" \
  | parallel --colsep '\t' -j4 --halt now,fail=1 \
      "set -o pipefail; node ${dir}/fetch.mjs {1} {2} {3} {4} | xargs -I@ bash ${dir}/optimize.sh @ {1} {2} {5} | xargs -I@ node ${dir}/validate.mjs @"
