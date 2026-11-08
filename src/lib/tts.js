// Narration with ElevenLabs (user's own API key, stored only on this device) with the browser's
// speech synthesis as fallback. Generated clips are cached in the Cache API so a segment's narration
// can be downloaded before the hike and replayed offline.
import { load, save } from './storage.js'
import { t } from '../i18n/index.js'

const KEY = 'tts'
const CACHE = 'tts-audio'
const API = 'https://api.elevenlabs.io/v1'
export const MODELS = [
  { id: 'eleven_v4_turbo', name: 'Eleven v4 Turbo (מהיר, עברית ואנגלית)' },
  { id: 'eleven_v4', name: 'Eleven v4 (איכות מרבית)' },
  { id: 'eleven_v3', name: 'Eleven v3' },
]
export const DEFAULT_EN_VOICE = 'JBFqnCBsd6RMkjVDRZzb' // George – warm storyteller

export const getTts = () => load(KEY, { key: '', model: 'eleven_v4_turbo', voiceHe: '', voiceEn: DEFAULT_EN_VOICE, enabled: true, format: 'mp3_22050_32' })
export const setTts = (patch) => { const v = { ...getTts(), ...patch }; save(KEY, v); return v }
export const ttsConfigured = () => { const s = getTts(); return !!(s.key && s.enabled && (s.voiceHe || s.voiceEn)) }

const headers = (key) => ({ 'xi-api-key': key, 'Content-Type': 'application/json' })

export async function fetchVoices(key) {
  const r = await fetch(`${API}/voices`, { headers: headers(key) })
  if (!r.ok) throw new Error(`voices ${r.status}`)
  const d = await r.json()
  return (d.voices || []).map((v) => ({ id: v.voice_id, name: v.name, lang: v.labels?.language || '', category: v.category, langs: (v.verified_languages || []).map((x) => x.language) }))
}
export async function fetchQuota(key) {
  const r = await fetch(`${API}/user/subscription`, { headers: headers(key) })
  if (!r.ok) throw new Error(`subscription ${r.status}`)
  const d = await r.json()
  return { used: d.character_count, limit: d.character_limit, tier: d.tier, resetAt: d.next_character_count_reset_unix ? d.next_character_count_reset_unix * 1000 : null }
}

// stable id for a clip: model + voice + text hash
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return (h >>> 0).toString(36) }
export const clipUrl = (text, lang, s = getTts()) => `https://tts.local/${s.model}/${lang === 'en' ? s.voiceEn : s.voiceHe}/${hash(text)}.mp3`

async function cacheOpen() { return 'caches' in window ? caches.open(CACHE) : null }

/** Returns the cached clip or null. */
export async function cachedClip(text, lang) {
  const c = await cacheOpen(); if (!c) return null
  const r = await c.match(clipUrl(text, lang)); return r ? r.blob() : null
}

/** Fetches (or reuses) the clip for `text`. */
export async function getClip(text, lang) {
  const s = getTts()
  const voice = lang === 'en' ? s.voiceEn : s.voiceHe
  if (!s.key || !voice) throw new Error('tts not configured')
  const url = clipUrl(text, lang, s)
  const c = await cacheOpen()
  const hit = c && (await c.match(url))
  if (hit) return hit.blob()
  const r = await fetch(`${API}/text-to-speech/${voice}?output_format=${s.format || 'mp3_22050_32'}`, {
    method: 'POST', headers: headers(s.key),
    body: JSON.stringify({ text, model_id: s.model || 'eleven_v4_turbo', language_code: lang === 'en' ? 'en' : 'he' }),
  })
  if (!r.ok) { let msg = `${r.status}`; try { const j = await r.json(); msg = j?.detail?.message || j?.detail?.status || JSON.stringify(j.detail || j).slice(0, 120) } catch { /* ignore */ } throw new Error(msg) }
  const blob = await r.blob()
  if (c) await c.put(url, new Response(blob, { headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(blob.size) } })).catch(() => {})
  return blob
}

// ---- player ----------------------------------------------------------------------------------
let audio = null, currentUrl = null, onEndCb = null
function player() {
  if (audio) return audio
  audio = new Audio(); audio.preload = 'auto'
  audio.addEventListener('ended', () => { const cb = onEndCb; onEndCb = null; cb?.() })
  audio.addEventListener('error', () => { const cb = onEndCb; onEndCb = null; cb?.(new Error('audio')) })
  return audio
}
/** Plays `text` with ElevenLabs; resolves when playback ends. */
export async function speakEleven(text, lang) {
  const blob = await getClip(text, lang)
  const a = player()
  stopEleven()
  currentUrl = URL.createObjectURL(blob)
  a.src = currentUrl
  await new Promise((res, rej) => { onEndCb = (e) => (e ? rej(e) : res()); a.play().catch(rej) })
}
export function stopEleven() {
  if (!audio) return
  onEndCb = null
  try { audio.pause(); audio.currentTime = 0 } catch { /* ignore */ }
  if (currentUrl) { URL.revokeObjectURL(currentUrl); currentUrl = null }
}
export const isElevenPlaying = () => !!audio && !audio.paused && !audio.ended

/** Pre-generates clips for all steps (for offline use). onProgress(done, total, cachedBefore). */
export async function prefetchClips(texts, lang, onProgress, signal) {
  let done = 0, had = 0
  for (const txt of texts) {
    if (signal?.aborted) break
    const hit = await cachedClip(txt, lang)
    if (hit) had++; else await getClip(txt, lang)
    done++; onProgress?.(done, texts.length, had)
  }
  return { done, had }
}
export async function countCached(texts, lang) {
  const c = await cacheOpen(); if (!c) return 0
  let n = 0
  for (const txt of texts) if (await c.match(clipUrl(txt, lang))) n++
  return n
}
export async function narrationCacheInfo() {
  const c = await cacheOpen(); if (!c) return { clips: 0, bytes: 0 }
  const keys = await c.keys(); let bytes = 0
  for (const k of keys) { const r = await c.match(k); bytes += Number(r?.headers.get('Content-Length')) || 0 }
  return { clips: keys.length, bytes }
}
export async function clearNarrationCache() { if ('caches' in window) await caches.delete(CACHE) }

/** Human label for the active narration engine. */
export const engineLabel = () => (ttsConfigured() ? 'ElevenLabs' : t('קול המכשיר'))
