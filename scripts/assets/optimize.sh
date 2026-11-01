#!/usr/bin/env bash
# optimize <rawPath> <id> <kind>
# model → glb（meshopt + webp 1024）；hdri／texture → 複製到 public/assets。
# stdout 只印輸出路徑；訊息走 stderr；失敗非 0。bash 3.2 相容。
# 路徑相對 repo 根目錄（由 pipeline.sh cd 過去）。
set -e

if [ $# -ne 3 ]; then
  echo "用法：optimize.sh <rawPath> <id> <kind>" >&2
  exit 2
fi
raw="${1}"
id="${2}"
kind="${3}"

if [ ! -e "${raw}" ]; then
  echo "optimize：${id}：找不到 ${raw}" >&2
  exit 1
fi

case "${kind}" in
  model)
    out="public/assets/models/${id}.glb"
    mkdir -p "public/assets/models"
    npx --no-install gltf-transform optimize "${raw}" "${out}" \
      --compress meshopt --texture-compress webp --texture-size 1024 >&2
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
  *)
    echo "optimize：${id}：未知 kind ${kind}" >&2
    exit 1
    ;;
esac

echo "${out}"
