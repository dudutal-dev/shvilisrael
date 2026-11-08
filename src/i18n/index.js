// Minimal i18n: Hebrew source strings are the keys; en.json maps them to English.
// t(key, ...args) replaces {0},{1}… placeholders. Language is a module-level setting + React hook.
import { useEffect, useState } from 'react'
import en from './en.json'

const LS = 'shvil:lang'
let lang = (() => { try { return JSON.parse(localStorage.getItem(LS)) || 'he' } catch { return 'he' } })()
const listeners = new Set()

export function getLang() { return lang }
export function setLang(l) {
  lang = l === 'en' ? 'en' : 'he'
  try { localStorage.setItem(LS, JSON.stringify(lang)) } catch { /* ignore */ }
  applyDir()
  listeners.forEach((fn) => fn(lang))
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
    const v = en[k]
    if (v) return fill(v, args)
    const trimmed = k.trim()
    if (en[trimmed]) return fill(en[trimmed], args)
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
  let out = s
  for (const [h, e] of SEASON_WORDS) out = out.replace(new RegExp(h.length > 1 ? h : '\\b' + h, 'g'), e)
  return /[\u0590-\u05FF]/.test(out) ? s : out
}
