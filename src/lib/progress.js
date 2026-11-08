// Progress along the full trail geometry (array of polylines [lat,lon][]) – distance from the northern start.
import { haversine } from './geo.js'

/** Pre-compute cumulative km for every vertex; returns {pts:[{lat,lon,km}], total} */
export function buildIndex(lines) {
  const pts = []
  let km = 0
  for (const l of lines) {
    for (let i = 0; i < l.length; i++) {
      if (i > 0) km += haversine({ lat: l[i - 1][0], lon: l[i - 1][1] }, { lat: l[i][0], lon: l[i][1] })
      pts.push({ lat: l[i][0], lon: l[i][1], km })
    }
  }
  return { pts, total: km }
}

/** Nearest index vertex to pos → {km, dist (off-trail km), point} */
export function locate(index, pos) {
  let best = null
  // coarse scan every 4th point then refine around
  const n = index.pts.length
  for (let i = 0; i < n; i += 4) {
    const d = haversine(pos, index.pts[i])
    if (!best || d < best.dist) best = { dist: d, i }
  }
  if (!best) return null
  for (let i = Math.max(0, best.i - 4); i < Math.min(n, best.i + 5); i++) {
    const d = haversine(pos, index.pts[i])
    if (d < best.dist) best = { dist: d, i }
  }
  const p = index.pts[best.i]
  return { km: p.km, dist: best.dist, point: p, index: best.i }
}

/** Slice of the trail between two km marks → [lat,lon][] (for drawing the walked part) */
export function slice(index, fromKm, toKm) {
  const lo = Math.min(fromKm, toKm), hi = Math.max(fromKm, toKm)
  return index.pts.filter((p) => p.km >= lo && p.km <= hi).map((p) => [p.lat, p.lon])
}
