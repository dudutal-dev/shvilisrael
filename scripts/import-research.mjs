// Normalises the research JSON (scratchpad/research/*.json) into src/data/*.json used by the app.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
const SRC = process.argv[2] || '../research'
const read = (f) => JSON.parse(readFileSync(`${SRC}/${f}`, 'utf8'))

if (existsSync(`${SRC}/lodging.json`)) {
  const l = read('lodging.json')
  const facStr = (f = {}) => [f.water === true ? 'מים ✓' : f.water === false ? 'אין מים' : f.water, f.toilets === true ? 'שירותים' : null, f.shade === true ? 'צל' : null, f.fire ? `אש: ${f.fire}` : null].filter(Boolean).join(' · ')
  l.night_camps = l.night_camps.map((c) => ({ ...c, facilities_he: typeof c.facilities === 'string' ? c.facilities : facStr(c.facilities), notes_he: c.notes || '', cost_he: c.cost || '' }))
  l.paid_lodging = l.paid_lodging.map((p) => ({ ...p, name_he: p.name, type_he: p.type, price_he: p.price_ils || '', url: p.booking && /^https?:/.test(p.booking) ? p.booking : null, booking_he: p.booking, type: /שדה/.test(p.type) ? 'field_school' : /אנ"א|הוסטל/.test(p.type) ? 'hostel' : /חניון|קמפינג|חוף/.test(p.type) ? 'camp' : 'other' }))
  writeFileSync('src/data/lodging.json', JSON.stringify(l, null, 1))
  console.log('lodging ok', l.night_camps.length, l.paid_lodging.length)
}
if (existsSync(`${SRC}/logistics.json`)) {
  const g = read('logistics.json')
  writeFileSync('src/data/logistics.json', JSON.stringify(g, null, 1))
  console.log('logistics ok')
}
if (existsSync(`${SRC}/photos.json`)) {
  const p = read('photos.json')
  writeFileSync('src/data/photos.json', JSON.stringify(Array.isArray(p) ? p : p.photos || [], null, 1))
  console.log('photos ok')
}
if (existsSync(`${SRC}/segments.json`)) {
  const s = read('segments.json')
  writeFileSync('src/data/segments.raw.json', JSON.stringify(s, null, 1))
  console.log('segments raw copied – run normalise-segments afterwards')
}
