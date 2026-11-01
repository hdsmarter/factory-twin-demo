import { describe, expect, it } from 'vitest'
import { dataUrlToBlobUrl } from './dataUrl'

describe('dataUrlToBlobUrl（Artifact 的 CSP 不允許 fetch data: 網址，但允許 blob:）', () => {
  it('base64 data URL → blob: URL，內容與型別不變', async () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255])
    const data = `data:image/webp;base64,${Buffer.from(bytes).toString('base64')}`
    const out = dataUrlToBlobUrl(data)
    expect(out.startsWith('blob:')).toBe(true)
    const blob = await (await fetch(out)).blob()
    expect(blob.type).toBe('image/webp')
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes)
  })

  it('非 data: 網址原樣傳回', () => {
    for (const u of ['./assets/models/x.json', 'https://example.com/a.png', 'blob:abc']) expect(dataUrlToBlobUrl(u)).toBe(u)
  })

  it('同一個 data URL 只轉一次（快取，避免重複解碼與記憶體洩漏）', () => {
    const data = 'data:application/octet-stream;base64,AAEC'
    expect(dataUrlToBlobUrl(data)).toBe(dataUrlToBlobUrl(data))
  })
})
