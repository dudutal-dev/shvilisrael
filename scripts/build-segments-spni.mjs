// Builds src/data/segments.json from SPNI's official 56 segments (src/data/spni/segments.json),
// endpoint coordinates (scripts/spni-endpoints.json), photo map, and attributes merged from the
// earlier research dataset (src/data/segments.raw.json, tiuli-based 49 segments).
import { readFileSync, writeFileSync } from 'node:fs'
const J = (f) => JSON.parse(readFileSync(f, 'utf8'))
const spni = J('src/data/spni/segments.json')
const pts = J('scripts/spni-endpoints.json')
const photos = J('scripts/segment-photos-spni.json')
const raw = J('src/data/segments.raw.json')
const namesEn = J('scripts/segment-names-en.json')
const research = raw.segments.filter((s) => s.variant !== 'old_route' && Number.isInteger(s.id))
const hav = (a, b) => { const R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r, h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)) }
const mid = (a, b) => ({ lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 })
const DIFF = { 'קל': 1, 'קל-בינוני': 2, 'בינוני': 2, 'בינוני-קשה': 3, 'קשה': 3, 'קשה מאוד': 4 }
const GUIDE_URL = { 'גליל': 'guide-north', 'כרמל ומישור החוף': 'guide-central', 'שפלה וירושלים': 'guide-jerusalem', 'מדבר יהודה וים המלח': 'guide-judaean-desert', 'נגב': 'guide-negev-desert' }
const ANGEL_RANGES = [[1, 1, 9], [2, 10, 13], [3, 13, 15], [4, 15, 18], [5, 18, 21], [6, 21, 23], [7, 23, 25], [8, 25, 30], [9, 29, 38], [10, 39, 56]]

// Split the official route description into navigation steps (paragraphs; long ones by sentence).
function toSteps(desc = '') {
  const paras = desc.split(/\n+/).map((x) => x.trim()).filter((x) => x.length > 15)
  const steps = []
  for (const p of paras) {
    if (p.length <= 380) { steps.push(p); continue }
    const sentences = p.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [p]
    let cur = ''
    for (const sen of sentences) {
      if ((cur + sen).length > 300 && cur) { steps.push(cur.trim()); cur = '' }
      cur += sen
    }
    if (cur.trim()) steps.push(cur.trim())
  }
  return steps
}
const fixSpaces = (t = '') => t.replace(/([.!?:])(?=[\u0590-\u05FF])/g, '$1 ').replace(/[ \t]{2,}/g, ' ')
const segments = spni.map((s) => {

  const n = s.number
  const start = { name_he: s.start || pts[n].name, lat: pts[n].lat, lon: pts[n].lon, approx: true, short_he: pts[n].name, short_en: namesEn.points[n], name_en: namesEn.points[n] }
  const end = { name_he: s.end || pts[n + 1].name, lat: pts[n + 1].lat, lon: pts[n + 1].lon, approx: true, short_he: pts[n + 1].name, short_en: namesEn.points[n + 1], name_en: namesEn.points[n + 1] }
  const m = mid(start, end)
  // research matches: segments overlapping this one (midpoint within 9 km, or endpoint pairs close)
  const scored = research.map((r) => ({ r, d: Math.min(hav(m, mid(r.start, r.end)), hav(start, r.start) + hav(end, r.end) / 2, hav(end, r.end) + hav(start, r.start) / 2) })).sort((a, b) => a.d - b.d)
  const best = scored[0].r
  const near = scored.filter((x) => x.d < 9).map((x) => x.r)
  const pool = near.length ? near : [best]
  const uniq = (arr) => [...new Set(arr.filter(Boolean))]
  const hazards = uniq(pool.flatMap((r) => r.hazards_notes || []))
  const fz = hazards.find((h) => /שטח אש|שטחי אש/.test(h)) || null
  const ch = (s.character || '') + ' ' + (s.important || []).join(' ')
  let difficulty = DIFF[best.difficulty] || 2
  if (/קשה מאוד|מאתגר במיוחד/.test(ch)) difficulty = 4
  else if (/תלול|מאתגר|מאומץ|סולמות|ידיות/.test(ch)) difficulty = Math.max(difficulty, 3)
  if (/מישורי|מתון|קל/.test(ch) && !/תלול|מאתגר/.test(ch)) difficulty = Math.min(difficulty, 2)
  if (n === 39) difficulty = 4
  const km = s.length_km
  const hours = Math.round((km / (difficulty >= 3 ? 3 : 3.8) + (difficulty >= 3 ? 1 : 0.5)) * 2) / 2
  const w = best.water || {}
  const waterSummary = [{ taps: 'ברזים זמינים לאורך המקטע', springs: 'מעיינות (לטהר לפני שתייה)', none: 'אין מים בתוואי', limited: 'מים מוגבלים', mixed: 'מים חלקיים' }[w.availability] || w.availability, w.points?.length ? `נקודות: ${w.points.join(', ')}` : null].filter(Boolean).join('. ')
  const spniWater = (s.important || []).filter((x) => /מים|הטמנ/.test(x))
  const caching = !!w.caching_needed || /הטמנת מים|להטמין מים|לדאוג מראש להטמנת/.test((s.important || []).join(' '))
  const o = best.overnight || {}
  const angelsRegion = ANGEL_RANGES.find(([, a, b]) => n >= a && n <= b)?.[0] || null
  return {
    id: n,
    name_he: s.title, name_en: namesEn.segments[n] || null,
    region: best.region, region_en: best.region_en, region_spni: s.region_guide,
    distance_km: km, distance_approx: !!s.length_approx, hours,
    difficulty, difficulty_he: ['', 'קל', 'בינוני', 'קשה', 'קשה מאוד'][difficulty],
    ascent_m: null, descent_m: null,
    start, end,
    water: { summary_he: [waterSummary, ...spniWater].filter(Boolean).join(' · '), sources: w.points || [], availability: w.availability },
    water_caching_needed: caching,
    overnight: { night_camp: o.night_camp || null, trail_angels: o.trail_angels || null, paid: Array.isArray(o.paid_lodging) ? o.paid_lodging.join(', ') : o.paid_lodging || null, field_school: s.lodging?.[0] || o.field_school || null, summary_he: s.lodging?.length ? `המלצת החברה להגנת הטבע: ${s.lodging.join(', ')}` : null },
    highlights: uniq([...(s.pois ? s.pois.split(/,|·/).map((x) => x.trim().replace(/\.$/, '')) : []), ...pool.flatMap((r) => r.highlights || [])]).slice(0, 10),
    hazards, firing_zone: fz,
    transport: { start_he: s.transport || best.public_transport?.start || '', end_he: '' , spni_he: s.transport || '' },
    description_he: fixSpaces((s.intro || '')).split('\n').filter((l) => !/\(\d+\)\s*$/.test(l.trim()) && !/^למקטע/.test(l.trim())).join('\n').trim(),
    photo: photos[n] || null,
    angels_region: angelsRegion,
    spni: {
      url: s.url, map_pdf: s.map_pdf, map_pdfs: s.map_pdfs, guide_url: s.region_guide ? `https://www.teva.org.il/israel-national-trail/${GUIDE_URL[s.region_guide] || ''}` : null,
      season_he: s.season, character_he: fixSpaces(s.character || ''), shortcuts_he: s.shortcuts, parking_he: s.parking, transport_he: s.transport,
      pois_raw: s.pois || '', important_he: s.important || [], nearby_he: s.nearby || [], lodging_he: s.lodging || [], description_he: fixSpaces(s.description || ''), author_he: s.author, image: s.image, photo_credit_he: s.photo_credit,
    },
    steps_he: toSteps(fixSpaces(s.description || '')),
    research_match: pool.map((r) => r.id),
  }
})
const m = raw.meta || {}
const meta = {
  total_length_km: Math.round(segments.reduce((a, s) => a + s.distance_km, 0)),
  official_segments: 56,
  source_he: 'החלוקה ל-56 מקטעים, האורכים, תיאורי המסלול, העונות, נקודות ההתחלה והסיום, התחבורה וההמלצות – מהמדריך הרשמי של החברה להגנת הטבע (teva.org.il, נובמבר 2026). קואורדינטות, אזהרות, מים ולינה – מחקר משלים.',
  spni_url: 'https://www.teva.org.il/israel-national-trail',
  inaugurated: m.inaugurated?.year, inaugurated_notes_he: m.inaugurated?.notes,
  maintained_by_he: m.maintained_by?.he,
  marking_he: m.marking?.popular_interpretation, marking_official_he: m.marking?.official_position,
  description_he: `שביל ישראל הוא שביל הליכה לאומי באורך כ-1,100 ק"מ מהחרמון ועד אילת, ב-56 מקטעים רשמיים. תוכנן על ידי החברה להגנת הטבע, נחנך ב-1995, ומסומן בלבן-כחול-כתום.`,
  recent_changes: m.recent_changes_2019_2026 || [],
  general_hazards: m.general_hazards || [],
  guides_and_maps: m.guides_and_maps || [],
  night_camps_negev: m.night_camps_negev || null,
  coordinate_accuracy_he: 'קואורדינטות נקודות ההתחלה והסיום משוערות (±1 ק"מ). לניווט מדויק – תוואי OSM במפה ומפות המקטעים של החברה להגנת הטבע.',
  sources: [{ name: 'החברה להגנת הטבע – המדריך המלא לשביל ישראל', url: 'https://www.teva.org.il/israel-national-trail' }, { name: 'החברה להגנת הטבע – עדכונים ושינויים', url: 'https://www.teva.org.il/national-trail-updates' }, { name: 'מפות המקטעים (חינם) – החברה להגנת הטבע', url: 'https://www.teva.org.il/israel-national-trail/maps' }, ...(m.primary_sources || []).map((s) => (typeof s === 'string' ? { name: s, url: s } : s))],
  maps: { interactive: 'https://experience.arcgis.com/experience/cb82523a09db431f9ed47f5645581be5/', all_pdf_zip: 'https://mapateva.org.il/Apps/StoryTelling/PlayList_IsraelTrail/resources/images/Mikta_Maps/All_Maps_Israel_Trail2023.zip', buy_set: 'https://www.teva.org.il/product/national-trail-set', shop: 'https://www.teva.org.il/shop', page: 'https://www.teva.org.il/israel-national-trail/maps', report_marking: 'https://survey123.arcgis.com/share/bdbca3a09f4243a19740f8a2b734c48e?portalUrl=https://deshe.maps.arcgis.com' },
  updated: '2026-11-08',
  segments_count: segments.length,
}
writeFileSync('src/data/segments.json', JSON.stringify({ meta, segments }, null, 1))
console.log('segments', segments.length, 'km', meta.total_length_km)
console.log(segments.map((s) => `${s.id}:${s.research_match.join('/')}:d${s.difficulty}:${s.water_caching_needed ? 'W' : ''}:${s.photo}`).join(' '))
