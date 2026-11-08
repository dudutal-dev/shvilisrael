// Minimal i18n: Hebrew source strings are the keys; en.json maps them to English.
// t(key, ...args) replaces {0},{1}… placeholders. Language is a module-level setting + React hook.
import { useEffect, useState } from 'react'
import enUi from './en.json'

// Dictionary: UI strings (bundled) + data strings (src/i18n/en-data.json, loaded only when English).
const en = { ...enUi }
const norm = (k) => k.replace(/[\u05F4\u201C\u201D]/g, '"').replace(/[\u05F3\u2018\u2019]/g, "'").replace(/\s+/g, ' ').trim()
let enNorm = null
const lookup = (k) => {
  if (en[k] !== undefined) return en[k]
  if (!enNorm) { enNorm = {}; for (const key of Object.keys(en)) enNorm[norm(key)] = en[key] }
  return enNorm[norm(k)]
}
let dataLoaded = false
/** Loads the data-string dictionary (needed for English). Resolves immediately when not English or already loaded. */
export async function ready() {
  if (lang !== 'en' || dataLoaded) return
  const mod = await import('./en-data.json')
  Object.assign(en, mod.default || mod)
  enNorm = null
  dataLoaded = true
}

const LS = 'shvil:lang'
let lang = (() => { try { return JSON.parse(localStorage.getItem(LS)) || 'he' } catch { return 'he' } })()
const listeners = new Set()

export function getLang() { return lang }
export function setLang(l) {
  lang = l === 'en' ? 'en' : 'he'
  try { localStorage.setItem(LS, JSON.stringify(lang)) } catch { /* ignore */ }
  applyDir()
  ready().then(() => listeners.forEach((fn) => fn(lang)))
}
export function applyDir() {
  const html = document.documentElement
  html.setAttribute('lang', lang)
  html.setAttribute('dir', lang === 'en' ? 'ltr' : 'rtl')
}
export function useLang() {
  const [l, setL] = useState(lang)
  useEffect(() => { listeners.add(setL); return () => listeners.delete(setL) }, [])
  return [l, setLang]
}
export const locale = () => (lang === 'en' ? 'en-GB' : 'he-IL')
export const isEn = () => lang === 'en'

const fill = (s, args) => (args.length ? s.replace(/\{(\d+)\}/g, (_, i) => (args[i] == null ? '' : String(args[i]))) : s)
export function t(key, ...args) {
  if (key == null) return key
  const k = String(key)
  if (lang === 'en') {
    const v = lookup(k)
    if (v) return fill(v, args)
  }
  return fill(k, args)
}
/** Pick a localized field from a data object: obj.name_en when English and present, else obj.name_he. */
export function tf(obj, base) {
  if (!obj) return ''
  if (lang === 'en' && obj[`${base}_en`]) return obj[`${base}_en`]
  return obj[`${base}_he`] ?? obj[base] ?? ''
}
applyDir()

/** Translate short Hebrew season/character phrases word-by-word (data strings). */
const SEASON_WORDS = [['כל השנה', 'all year'], ['סתיו', 'autumn'], ['חורף', 'winter'], ['אביב', 'spring'], ['קיץ', 'summer'], ['סוף', 'late'], ['תחילת', 'early'], ['ובעיקר', 'and especially'], ['בעיקר', 'mainly'], ['בשיא הפריחה', 'at peak bloom'], ['פריחה', 'bloom'], ['בחורף', 'in winter'], ['באביב', 'in spring'], ['בקיץ', 'in summer'], ['בסתיו', 'in autumn'], ['לא בשעות החמות', 'not in the hot hours'], ['לא אחרי גשם', 'not after rain'], ['כאשר השביל בוצי', 'when the trail is muddy'], ['מומלץ', 'recommended'], ['אפשרי', 'possible'], ['ינואר', 'January'], ['פברואר', 'February'], ['מרץ', 'March'], ['אפריל', 'April'], ['מאי', 'May'], ['יוני', 'June'], ['יולי', 'July'], ['אוגוסט', 'August'], ['ספטמבר', 'September'], ['אוקטובר', 'October'], ['נובמבר', 'November'], ['דצמבר', 'December'], ['עד', 'to'], ['מ', 'from ']]
export function tSeason(s) {
  if (!s || lang !== 'en') return s
  const direct = lookup(s)
  if (direct) return direct
  let out = s
  for (const [h, e] of SEASON_WORDS) out = out.replace(new RegExp(h.length > 1 ? h : '\\b' + h, 'g'), e)
  return /[\u0590-\u05FF]/.test(out) ? s : out
}

// List variant of tf(): picks `${base}_en` array when English and present, else `${base}_he`.
export function tl(obj, base) {
  if (lang === 'en' && Array.isArray(obj?.[`${base}_en`]) && obj[`${base}_en`].length) return obj[`${base}_en`]
  return obj?.[`${base}_he`] ?? obj?.[base] ?? []
}
// dir attribute for a content block: 'rtl' when the UI is English but only Hebrew text exists.
export function heDir(obj, base) {
  if (lang !== 'en') return undefined
  const en = obj?.[`${base}_en`]
  return (Array.isArray(en) ? en.length : !!en) ? undefined : 'rtl'
}

/**
 * Deep, lazy translation of a data object (JSON import or fetched): returns a Proxy whose string
 * values are looked up in the dictionary when the UI is English. Keys used as identifiers are left alone.
 * Identity is stable per (object, language) so React memoisation keeps working.
 */
const ID_KEYS = new Set(['id', 'key', 'k', 'kind', 'type', 'status', 'availability', 'cat', 'direction', 'variant', 'region', 'region_spni', 'difficulty_he', 'difficulty', 'url', 'image', 'image_url', 'thumb_url_direct', 'original_url', 'map_pdf', 'map_pdfs', 'href', 'link', 'ts', 'icon', 'ico', 'color', 'layer', 'base'])
const HEB_RE = /[\u0590-\u05FF]/
const proxyCache = new WeakMap()
export function tdata(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  const hit = proxyCache.get(obj)
  if (hit) return hit
  const p = new Proxy(obj, {
    get(target, prop, receiver) {
      if (lang === 'en' && typeof prop === 'string' && prop.endsWith('_he')) {
        const alt = target[prop.slice(0, -3) + '_en']
        if (alt) return alt
      }
      const v = Reflect.get(target, prop, receiver)
      if (v && typeof v === 'object') return tdata(v)
      if (lang === 'en' && typeof v === 'string' && typeof prop === 'string' && !ID_KEYS.has(prop) && HEB_RE.test(v)) return lookup(v) || v
      return v
    },
  })
  proxyCache.set(obj, p)
  return p
}

/** 'rtl' when the UI is English but this text is still Hebrew (e.g. a live update not yet translated). */
export const heOnly = (txt) => (lang === 'en' && HEB_RE.test(String(txt || '')) ? 'rtl' : undefined)
