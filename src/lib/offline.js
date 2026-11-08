// Device persistence helpers: persistent storage, usage estimate, offline tile download.
import { BASE_LAYERS } from './layers.js'
import { idbGet, TRAIL_KEY } from './overpass.js'

export const TILE_CACHE = 'map-tiles'

/** Ask the browser to keep our storage (IndexedDB, Cache, localStorage) from being evicted. */
export async function persistStorage() {
  try {
    if (!navigator.storage?.persist) return null
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch { return null }
}
export async function storageInfo() {
  const out = { persisted: null, usageMB: null, quotaMB: null, tiles: 0, photos: 0, trail: false }
  try { out.persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null } catch { /* ignore */ }
  try { const e = await navigator.storage?.estimate?.(); if (e) { out.usageMB = +(e.usage / 1048576).toFixed(1); out.quotaMB = Math.round(e.quota / 1048576) } } catch { /* ignore */ }
  try { const c = await caches.open(TILE_CACHE); out.tiles = (await c.keys()).length } catch { /* ignore */ }
  try { out.trail = !!(await idbGet(TRAIL_KEY))?.lines?.length } catch { /* ignore */ }
  return out
}

// ---- tiles
const lon2x = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z)
const lat2y = (lat, z) => Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z)
export function tileUrls(bounds, zooms, base = 'ihm') {
  const cfg = BASE_LAYERS[base] || BASE_LAYERS.osm
  const [[s, w], [n, e]] = bounds
  const urls = []
  for (const z of zooms) {
    if (z > cfg.maxZoom) continue
    const x0 = lon2x(w, z), x1 = lon2x(e, z), y0 = lat2y(n, z), y1 = lat2y(s, z)
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) urls.push(cfg.url.replace('{z}', z).replace('{x}', x).replace('{y}', y).replace('{s}', 'a'))
  }
  return urls
}
/** Download tiles into the same cache the service worker serves from. Returns {done, failed, skipped}. */
export async function downloadTiles(urls, onProgress, { concurrency = 4, signal } = {}) {
  const cache = await caches.open(TILE_CACHE)
  let i = 0, done = 0, failed = 0, skipped = 0
  const worker = async () => {
    while (i < urls.length) {
      if (signal?.aborted) return
      const url = urls[i++]
      try {
        if (await cache.match(url)) { skipped++ } else {
          const res = await fetch(url, { mode: 'no-cors', cache: 'force-cache' })
          if (res && (res.ok || res.type === 'opaque')) { await cache.put(url, res); done++ } else failed++
        }
      } catch { failed++ }
      onProgress?.({ done, failed, skipped, total: urls.length })
      await new Promise((r) => setTimeout(r, 60)) // be gentle with tile servers
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  return { done, failed, skipped, total: urls.length }
}
/** Bounds around a segment with ~1.5 km padding. */
export function segmentBounds(seg, padKm = 1.5) {
  const dLat = padKm / 111, dLon = padKm / (111 * Math.cos((seg.start.lat * Math.PI) / 180))
  return [[Math.min(seg.start.lat, seg.end.lat) - dLat, Math.min(seg.start.lon, seg.end.lon) - dLon], [Math.max(seg.start.lat, seg.end.lat) + dLat, Math.max(seg.start.lon, seg.end.lon) + dLon]]
}
export async function clearTiles() { try { await caches.delete(TILE_CACHE) } catch { /* ignore */ } }
