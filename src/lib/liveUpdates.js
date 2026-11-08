// Live route updates: the deployed site serves /data/updates.json (refreshed daily by GitHub Actions).
// The app fetches it on every launch / return to foreground, so installed (home-screen) copies stay current
// even before the service worker picks up a new app version.
import { load, save } from './storage.js'
import bundled from '../data/spni/updates.json'

const KEY = 'liveUpdates'
const itemKey = (u) => `${u.place}|${u.date || ''}|${u.text.slice(0, 40)}`

export function getUpdates() {
  const live = load(KEY, null)
  const useLive = live?.items?.length && live.fetched >= (bundled.fetched || '')
  return useLive ? live : bundled
}

export async function refreshUpdates() {
  const url = `${import.meta.env.BASE_URL}data/updates.json?t=${Date.now()}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const data = await res.json()
  if (!data?.items?.length) throw new Error('empty')
  save(KEY, data)
  return data
}

/** Items the user has not yet seen (by key). */
export function unseen(items) {
  const stored = load('seenUpdates', null)
  if (stored == null) { markSeen(items); return [] } // first launch: nothing is "new" yet
  const seen = new Set(stored)
  return items.filter((u) => !seen.has(itemKey(u)))
}
export function markSeen(items) {
  const seen = new Set(load('seenUpdates', []))
  items.forEach((u) => seen.add(itemKey(u)))
  save('seenUpdates', [...seen].slice(-300))
}
