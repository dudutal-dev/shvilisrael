import { tdata } from '../i18n/index.js'
// Points of interest: bundled Wikipedia summaries (src/data/pois.json) + runtime fallback fetch (CORS-enabled REST API).
import dataRaw from '../data/pois.json'
const data = tdata(dataRaw)
import { load, save } from './storage.js'
import { haversine } from './geo.js'

export function poisForSegment(id) {
  const keys = data.segments?.[String(id)] || []
  return keys.map((k) => data.pois[k]).filter(Boolean)
}
export const allPois = () => Object.values(data.pois || {})

/** Fetch a Hebrew-Wikipedia summary at runtime (online only); cached in localStorage. */
export async function fetchSummary(title) {
  const key = `poi:${title}`
  const cached = load(key, null)
  if (cached) return cached
  const res = await fetch(`https://he.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const j = await res.json()
  const out = { title: j.title, extract: j.extract, image: j.thumbnail?.source, original: j.originalimage?.source, lat: j.coordinates?.lat, lon: j.coordinates?.lon, url: j.content_urls?.desktop?.page }
  save(key, out)
  return out
}

/** Nearest POI with coordinates to a position, within maxKm. */
export function nearestPoi(pos, pois, maxKm = 0.3) {
  let best = null
  for (const p of pois) {
    if (p.lat == null) continue
    const d = haversine(pos, p)
    if (d <= maxKm && (!best || d < best.d)) best = { poi: p, d }
  }
  return best
}
