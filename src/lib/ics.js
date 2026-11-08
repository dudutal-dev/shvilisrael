import { toISODate } from './dates.js'
const esc = (s = '') => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\;')
export function itineraryToICS(days, title = 'שביל ישראל') {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Shvil Israel Planner//HE', 'CALSCALE:GREGORIAN']
  for (const d of days) {
    const date = toISODate(d.date).replace(/-/g, '')
    const next = new Date(d.date); next.setDate(next.getDate() + 1)
    const summary = d.rest ? `${title}: יום מנוחה` : `${title} יום ${d.day}: ${d.title}`
    const desc = d.rest ? d.note || '' : `${d.km} ק"מ · ${d.overnight || ''}\n${d.notes?.join('\n') || ''}`
    lines.push('BEGIN:VEVENT', `UID:shvil-${d.day}-${date}@shvil`, `DTSTAMP:${date}T000000Z`, `DTSTART;VALUE=DATE:${date}`, `DTEND;VALUE=DATE:${toISODate(next).replace(/-/g, '')}`, `SUMMARY:${esc(summary)}`, `DESCRIPTION:${esc(desc)}`, 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}
