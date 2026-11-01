#!/usr/bin/env bash
# convert-fbx <in.fbx> <out.glb>
# FBX → 單一 glb（devDependency fbx2gltf 內附的 FBX2glTF，--binary），轉完以 validate.mjs 驗證。
# stdout 只印輸出路徑；訊息走 stderr；失敗非 0。bash 3.2 相容。
# macOS 只有 x86_64 binary，Apple Silicon 經 Rosetta 執行。
set -eo pipefail

if [ $# -ne 2 ]; then
  echo "用法：convert-fbx.sh <in.fbx> <out.glb>" >&2
  exit 2
fi
in="${1}"
out="${2}"
here="$(cd "$(dirname "$0")" && pwd)"

case "${out}" in
  *.glb) ;;
  *)
    echo "convert-fbx：輸出必須是 .glb，收到 ${out}" >&2
    exit 1
    ;;
esac
if [ ! -f "${in}" ]; then
  echo "convert-fbx：找不到輸入 ${in}" >&2
  exit 1
fi

bin="${here}/../../node_modules/fbx2gltf/bin/$(uname -s)/FBX2glTF"
if [ ! -x "${bin}" ]; then
  echo "convert-fbx：找不到 ${bin}（先 npm install）" >&2
  exit 1
fi

mkdir -p "$(dirname "${out}")"
# FBX2glTF 的 -o 不含副檔名，--binary 會自己補 .glb；它的進度訊息寫 stdout，導到 stderr
"${bin}" --binary --input "${in}" --output "${out%.glb}" >&2
node "${here}/validate.mjs" "${out}"
