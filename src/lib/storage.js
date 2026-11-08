const PREFIX = 'shvil:'
export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch { return fallback }
}
export function save(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)) } catch { /* quota / private mode */ }
}
export function exportAll() {
  const out = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(PREFIX)) out[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k))
  }
  return out
}
export function importAll(obj) {
  for (const [k, v] of Object.entries(obj || {})) save(k, v)
}
export function clearAll() {
  const keys = []
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREFIX)) keys.push(k) }
  keys.forEach((k) => localStorage.removeItem(k))
}
