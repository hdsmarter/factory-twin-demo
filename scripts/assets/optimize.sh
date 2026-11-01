#!/usr/bin/env bash
# optimize <rawPath> <id> <kind> [simplifyRatio]
# model → glb（meshopt + webp 1024；有 simplifyRatio 則依比例減面）；
# character → convert-fbx 轉 glb 後同樣 meshopt（保留骨架與動畫，不減面）；
# hdri／texture／texture-file → 複製到 public/assets。
# stdout 只印輸出路徑；訊息走 stderr；失敗非 0。bash 3.2 相容。
# 路徑相對 repo 根目錄（由 pipeline.sh cd 過去）。
set -e

if [ $# -lt 3 ] || [ $# -gt 4 ]; then
  echo "用法：optimize.sh <rawPath> <id> <kind> [simplifyRatio]" >&2
  exit 2
fi
raw="${1}"
id="${2}"
kind="${3}"
ratio="${4:-}"
here="$(cd "$(dirname "$0")" && pwd)"

if [ ! -e "${raw}" ]; then
  echo "optimize：${id}：找不到 ${raw}" >&2
  exit 1
fi

case "${kind}" in
  model)
    out="public/assets/models/${id}.glb"
    mkdir -p "public/assets/models"
    if [ -n "${ratio}" ]; then
      # 預設 --simplify-error 0.0001 會先擋住減面（實測 ratio 0.025 只減到 74%），放寬到 1% 讓 ratio 生效
      npx --no-install gltf-transform optimize "${raw}" "${out}" \
        --compress meshopt --texture-compress webp --texture-size 1024 \
        --simplify true --simplify-ratio "${ratio}" --simplify-error 0.01 >&2
    else
      npx --no-install gltf-transform optimize "${raw}" "${out}" \
        --compress meshopt --texture-compress webp --texture-size 1024 >&2
    fi
    ;;
  character)
    out="public/assets/models/${id}.glb"
    glb="$(dirname "${raw}")/${id}.converted.glb"
    bash "${here}/convert-fbx.sh" "${raw}" "${glb}" >/dev/null
    mkdir -p "public/assets/models"
    # --resample 只做無損關鍵影格去重；--simplify false 避免蒙皮網格變形。動畫不會被移除
    npx --no-install gltf-transform optimize "${glb}" "${out}" \
      --compress meshopt --texture-compress webp --texture-size 1024 --simplify false >&2
    ;;
  hdri)
    out="public/assets/hdri/${id}.hdr"
    mkdir -p "public/assets/hdri"
    cp "${raw}" "${out}"
    ;;
  texture)
    out="public/assets/textures/${id}"
    mkdir -p "${out}"
    # 只出貨 scene 必載的貼圖（raw 裡可能殘留舊版下載的其他貼圖）
    for m in $(node -e 'console.log(require("./scripts/assets/texture-maps.json").join(" "))'); do
      cp "${raw}/${m}.jpg" "${out}/"
    done
    ;;
  texture-file)
    ext="${raw##*.}"
    out="public/assets/textures/${id}.${ext}"
    mkdir -p "public/assets/textures"
    cp "${raw}" "${out}"
    ;;
  *)
    echo "optimize：${id}：未知 kind ${kind}" >&2
    exit 1
    ;;
esac

echo "${out}"
