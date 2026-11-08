import { addDays, isShabbat, isFriday } from './dates.js'
import { seasonWarning, regionGroup } from './season.js'

export const DEFAULT_PLAN = {
  direction: 'sobo', // sobo = Dan→Eilat (צפון→דרום), nobo = Eilat→Dan
  startDate: null,
  dailyKm: 20,
  maxDailyKm: 28,
  restEvery: 6, // walking days between rest days (0 = none)
  restOnShabbat: false,
  lodging: 'mixed', // tent | angels | paid | mixed
  fromId: null,
  toId: null,
  skipIds: [],
}

const LODGING_COST = { tent: 70, angels: 90, paid: 320, mixed: 160 } // ₪ per day incl. food

/** Build a day-by-day itinerary from ordered segments. */
export function buildItinerary(allSegments, plan) {
  const p = { ...DEFAULT_PLAN, ...plan }
  let segs = [...allSegments].sort((a, b) => a.id - b.id)
  if (p.fromId != null || p.toId != null) {
    const lo = Math.min(p.fromId ?? segs[0].id, p.toId ?? segs[segs.length - 1].id)
    const hi = Math.max(p.fromId ?? segs[0].id, p.toId ?? segs[segs.length - 1].id)
    segs = segs.filter((s) => s.id >= lo && s.id <= hi)
  }
  if (p.skipIds?.length) segs = segs.filter((s) => !p.skipIds.includes(s.id))
  if (p.direction === 'nobo') segs = segs.reverse()

  // expand long segments into chunks
  const chunks = []
  for (const s of segs) {
    const n = Math.max(1, Math.ceil(s.distance_km / p.maxDailyKm))
    for (let i = 0; i < n; i++) {
      chunks.push({ seg: s, part: n > 1 ? i + 1 : 0, parts: n, km: s.distance_km / n, hours: (s.hours || s.distance_km / 3.5) / n })
    }
  }

  const days = []
  const start = p.startDate ? new Date(p.startDate) : new Date()
  let date = new Date(start)
  let walkingDaysSinceRest = 0
  let i = 0
  let dayNo = 1
  while (i < chunks.length) {
    const shabbat = isShabbat(date)
    const needRest = (p.restEvery > 0 && walkingDaysSinceRest >= p.restEvery) || (p.restOnShabbat && shabbat)
    if (needRest && days.length) {
      days.push({ day: dayNo++, date: new Date(date), rest: true, shabbat, km: 0, title: 'יום מנוחה', note: shabbat ? 'שבת – חנויות ותחבורה ציבורית סגורות; מנוחה, כביסה והצטיידות מראש.' : 'מנוחה, כביסה, הצטיידות ותכנון ההמשך.' })
      date = addDays(date, 1); walkingDaysSinceRest = 0
      continue
    }
    // pack chunks into the day
    const todays = [chunks[i++]]
    let km = todays[0].km
    while (i < chunks.length) {
      const next = chunks[i]
      if (next.part > 1) break // continuation chunk must start a fresh day
      if (km + next.km > p.dailyKm * 1.12) break
      if (todays[todays.length - 1].part && todays[todays.length - 1].part < todays[todays.length - 1].parts) break
      todays.push(next); km += next.km; i++
    }
    const last = todays[todays.length - 1]
    const first = todays[0]
    const startName = p.direction === 'nobo' ? (first.seg.end.short_he || first.seg.end.name_he) : (first.seg.start.short_he || first.seg.start.name_he)
    const endName = p.direction === 'nobo' ? (last.seg.start.short_he || last.seg.start.name_he) : (last.seg.end.short_he || last.seg.end.name_he)
    const partial = last.part && last.part < last.parts
    const notes = []
    const regions = [...new Set(todays.map((c) => c.seg.region))]
    const warn = seasonWarning(last.seg.region, date)
    if (warn) notes.push(warn)
    if (shabbat) notes.push('שבת: אין תחבורה ציבורית, חנויות סגורות.')
    else if (isFriday(date)) notes.push('יום שישי: חנויות נסגרות מוקדם, תחבורה ציבורית עד הצהריים.')
    const wet = [10, 11, 0, 1, 2, 3].includes(date.getMonth())
    for (const c of todays) {
      if (c.seg.water_caching_needed) notes.push(`הטמנת מים נדרשת (${c.seg.name_he}).`)
      if (wet && regionGroup(c.seg.region) === 'negev' && /נחל|מכתש|קניון|שיטפ/.test([c.seg.name_he, ...(c.seg.hazards || [])].join(' '))) notes.push('סכנת שיטפון בעונת הגשמים – לבדוק תחזית ואזהרות רט"ג בבוקר לפני הכניסה לנחל.')
      if (c.seg.firing_zone) notes.push(`שטח אש: ${c.seg.firing_zone}`)
      if (c.seg.hazards?.length) notes.push(...c.seg.hazards.slice(0, 2))
    }
    const uniqNotes = [...new Set(notes)]
    const overnight = partial
      ? 'לינת שטח בתוואי (חלוקת מקטע ארוך) – לוודא מים'
      : pickOvernight(last.seg, p.lodging, p.direction)
    days.push({
      day: dayNo++, date: new Date(date), rest: false, shabbat, km: round1(km),
      hours: round1(todays.reduce((a, c) => a + c.hours, 0)),
      segments: todays.map((c) => c.seg.id),
      title: `${startName} ← ${endName}${partial ? ` (חלק ${last.part}/${last.parts})` : ''}`,
      overnight, notes: uniqNotes, region: regions.join(', '),
      difficulty: Math.max(...todays.map((c) => c.seg.difficulty || 2)),
      group: regionGroup(last.seg.region),
    })
    date = addDays(date, 1); walkingDaysSinceRest++
  }
  const totalKm = round1(days.reduce((a, d) => a + d.km, 0))
  const walking = days.filter((d) => !d.rest).length
  const cacheDays = days.filter((d) => d.notes?.some((n) => n.includes('הטמנת מים'))).length
  const caches = days.filter((d) => !d.rest && d.segments.some((id) => allSegments.find((s) => s.id === id)?.water_caching_needed)).map((d) => ({ day: d.day, date: d.date, overnight: d.overnight, title: d.title, km: d.km }))
  const summary = {
    totalKm, days: days.length, walkingDays: walking, restDays: days.length - walking,
    startDate: days[0]?.date, endDate: days[days.length - 1]?.date,
    avgKm: walking ? round1(totalKm / walking) : 0,
    cacheDays,
    budget: Math.round(days.length * (LODGING_COST[p.lodging] || 160) + cacheDays * 120),
    seasonIssues: days.filter((d) => d.notes?.some((n) => n.startsWith('סכנת חיים') || n.startsWith('חם מאוד') || n.startsWith('חום כבד'))).length,
  }
  return { days, summary, caches, plan: p }
}

function pickOvernight(seg, pref) {
  const o = seg.overnight || {}
  const camp = o.night_camp, angels = o.trail_angels, paid = o.paid, fs = o.field_school
  const list = []
  if (pref === 'tent') list.push(camp, fs, angels, paid)
  else if (pref === 'angels') list.push(angels, camp, paid, fs)
  else if (pref === 'paid') list.push(paid, fs, angels, camp)
  else list.push(angels, camp, paid, fs)
  const first = list.find(Boolean)
  return first || o.summary_he || 'לבדוק לינה ביישוב הקרוב'
}
const round1 = (n) => Math.round(n * 10) / 10
