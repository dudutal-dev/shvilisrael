// Converts src/data/segments.raw.json (research output) → src/data/segments.json (app schema)
import { readFileSync, writeFileSync } from 'node:fs'
const raw = JSON.parse(readFileSync('src/data/segments.raw.json', 'utf8'))
const DIFF = { 'קל': 1, 'קל-בינוני': 2, 'בינוני': 2, 'בינוני-קשה': 3, 'קשה': 3, 'קשה מאוד': 4 }
const AVAIL = { taps: 'ברזים זמינים לאורך המקטע', springs: 'מעיינות (לטהר לפני שתייה)', none: 'אין מים בתוואי', limited: 'מים מוגבלים', mixed: 'מים חלקיים' }
let photoKeys = {}
try { photoKeys = JSON.parse(readFileSync('scripts/segment-photos.json', 'utf8')) } catch { /* optional */ }

const segments = raw.segments.filter((s) => s.variant !== 'old_route' && Number.isInteger(s.id)).map((s) => {
  const hazards = s.hazards_notes || []
  const fz = hazards.find((h) => /שטח אש|שטחי אש/.test(h)) || null
  const w = s.water || {}
  const waterSummary = [AVAIL[w.availability] || w.availability, w.points?.length ? `נקודות: ${w.points.join(', ')}` : null, w.notes].filter(Boolean).join('. ')
  const o = s.overnight || {}
  return {
    id: s.id,
    name_he: s.name_he, name_en: s.name_en,
    region: s.region, region_en: s.region_en,
    distance_km: s.distance_km, hours: s.estimated_hours,
    difficulty: DIFF[s.difficulty] || 2, difficulty_he: s.difficulty,
    ascent_m: s.total_ascent_m ?? null, descent_m: s.total_descent_m ?? null,
    start: s.start, end: s.end,
    water: { summary_he: waterSummary, sources: w.points || [], availability: w.availability },
    water_caching_needed: !!w.caching_needed,
    overnight: {
      night_camp: o.night_camp || null,
      trail_angels: o.trail_angels || null,
      paid: Array.isArray(o.paid_lodging) ? o.paid_lodging.join(', ') : o.paid_lodging || null,
      field_school: o.field_school || null,
      summary_he: o.summary_he || null,
    },
    highlights: s.highlights || [],
    hazards, firing_zone: fz,
    transport: { start_he: s.public_transport?.start || '', end_he: s.public_transport?.end || '' },
    description_he: s.notes || '',
    photo: photoKeys[s.id] || null,
    sources: s.sources || [],
  }
})
const m = raw.meta || {}
const meta = {
  total_length_km: m.total_length_km?.official_current_approx || 1100,
  length_notes_he: m.total_length_km?.notes,
  inaugurated: m.inaugurated?.year, inaugurated_notes_he: m.inaugurated?.notes,
  maintained_by_he: m.maintained_by?.he,
  marking_he: m.marking?.popular_interpretation, marking_official_he: m.marking?.official_position,
  description_he: `שביל ישראל הוא שביל הליכה לאומי באורך כ-${m.total_length_km?.official_current_approx || 1100} ק"מ מהחרמון ועד אילת, שנחנך ב-${m.inaugurated?.year || 1995} ומתוחזק על ידי ${m.maintained_by?.he || 'החברה להגנת הטבע'}.`,
  recent_changes: m.recent_changes_2019_2026 || [],
  general_hazards: m.general_hazards || [],
  guides_and_maps: m.guides_and_maps || [],
  night_camps_negev: m.night_camps_negev || null,
  coordinate_accuracy_he: m.coordinate_accuracy,
  sources: (m.primary_sources || m.sources || []).map((s) => (typeof s === 'string' ? { name: s, url: s } : s)),
  updated: m.generated,
  segments_count: segments.length,
}
writeFileSync('src/data/segments.json', JSON.stringify({ meta, segments }, null, 1))
console.log('segments:', segments.length, 'km:', segments.reduce((a, s) => a + s.distance_km, 0))
console.log('regions:', [...new Set(segments.map((s) => s.region))].join(' | '))
