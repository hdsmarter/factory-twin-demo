/**
 * Claude Artifact 的 CSP：connect-src 允許 'self' 與 blob:，但不允許 data:。
 * 部署版模型是內嵌 data URI 的 glTF JSON，載入器以 fetch 讀取 data URI 會被擋（實測）。
 * 這裡把 data URI 轉成等價的 blob: URL；其他網址原樣傳回，本機開發不受影響。
 */
const cache = new Map<string, string>()

export function dataUrlToBlobUrl(url: string): string {
  if (!url.startsWith('data:')) return url
  const hit = cache.get(url)
  if (hit) return hit
  const comma = url.indexOf(',')
  const meta = url.slice(5, comma) // 例如 image/webp;base64
  const isBase64 = meta.endsWith(';base64')
  const type = isBase64 ? meta.slice(0, -';base64'.length) : meta
  const payload = url.slice(comma + 1)
  let bytes: Uint8Array<ArrayBuffer>
  if (isBase64) {
    const bin = atob(payload)
    bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  } else {
    bytes = new Uint8Array(new TextEncoder().encode(decodeURIComponent(payload)))
  }
  const blobUrl = URL.createObjectURL(new Blob([bytes], { type }))
  cache.set(url, blobUrl)
  return blobUrl
}
