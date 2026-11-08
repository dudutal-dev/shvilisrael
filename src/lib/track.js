// GPS breadcrumb recording (per day) stored in IndexedDB.
import { idbGet, idbSet, idbDel } from './overpass.js'
import { haversine } from './geo.js'
const KEY = 'tracks-v1' // { [isoDate]: { points: [[lat,lon,ts]], km } }

export async function loadTracks() { return (await idbGet(KEY)) || {} }
export async function appendPoint(date, pos) {
  const all = await loadTracks()
  const day = all[date] || { points: [], km: 0 }
  const last = day.points[day.points.length - 1]
  if (last) {
    const d = haversine({ lat: last[0], lon: last[1] }, pos)
    if (d < 0.008 || (pos.accuracy && pos.accuracy > 80)) return day // jitter / bad fix
    day.km += d
  }
  day.points.push([+pos.lat.toFixed(6), +pos.lon.toFixed(6), Date.now()])
  all[date] = day
  await idbSet(KEY, all)
  return day
}
export async function clearTracks() { await idbDel(KEY) }
