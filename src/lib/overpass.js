// Fetch the full Israel National Trail geometry from OpenStreetMap (Overpass API) and cache in IndexedDB.
import { simplify } from './geo.js'

const DB = 'shvil-db', STORE = 'kv'
function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
export async function idbGet(key) {
  try {
    const db = await idb()
    return await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
      tx.onsuccess = () => res(tx.result); tx.onerror = () => rej(tx.error)
    })
  } catch { return undefined }
}
export async function idbSet(key, value) {
  try {
    const db = await idb()
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key)
      tx.onsuccess = () => res(); tx.onerror = () => rej(tx.error)
    })
  } catch { /* ignore */ }
}
export async function idbDel(key) {
  try {
    const db = await idb()
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(key)
      tx.onsuccess = () => res(); tx.onerror = () => rej(tx.error)
    })
  } catch { /* ignore */ }
}

export const TRAIL_KEY = 'int-geometry-v1'
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

/** Build query: prefer the well-known relation id; fall back to a name match. */
function buildQuery(relationId) {
  if (relationId) return `[out:json][timeout:120];relation(${relationId});out geom;`
  return `[out:json][timeout:120];relation["route"="hiking"]["name:en"="Israel National Trail"];out geom;`
}

/** Stitch member ways into a list of polylines ([lat,lon][]) and simplify. */
function toLines(json) {
  const rel = (json.elements || []).find((e) => e.type === 'relation')
  if (!rel) throw new Error('relation not found')
  const lines = []
  for (const m of rel.members || []) {
    if (m.type !== 'way' || !m.geometry) continue
    const pts = m.geometry.map((g) => [g.lat, g.lon])
    if (pts.length > 1) lines.push(simplify(pts, 0.00012))
  }
  // merge consecutive ways whose endpoints touch
  const merged = []
  for (const l of lines) {
    const last = merged[merged.length - 1]
    if (last && same(last[last.length - 1], l[0])) last.push(...l.slice(1))
    else if (last && same(last[last.length - 1], l[l.length - 1])) last.push(...l.slice(0, -1).reverse())
    else merged.push([...l])
  }
  return { lines: merged, name: rel.tags?.name, fetchedAt: Date.now(), relationId: rel.id }
}
const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6

export async function loadTrailGeometry({ relationId, force = false, onStatus } = {}) {
  if (!force) {
    const cached = await idbGet(TRAIL_KEY)
    if (cached?.lines?.length) return cached
  }
  let lastErr
  for (const ep of ENDPOINTS) {
    try {
      onStatus?.(`מוריד את תוואי השביל מ-OpenStreetMap…`)
      const res = await fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(buildQuery(relationId)) })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const json = await res.json()
      const data = toLines(json)
      await idbSet(TRAIL_KEY, data)
      return data
    } catch (e) { lastErr = e }
  }
  throw lastErr || new Error('failed')
}
