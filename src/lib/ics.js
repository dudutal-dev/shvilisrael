import { toISODate } from './dates.js';
import { t } from '../i18n/index.js'
const esc = (s = '') => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\;');
export function itineraryToICS(days, title = t("שביל ישראל")) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Shvil Israel Planner//HE', 'CALSCALE:GREGORIAN'];
  for (const d of days) {
    const date = toISODate(d.date).replace(/-/g, '');
    const next = new Date(d.date);
    next.setDate(next.getDate() + 1);
    const summary = d.rest ? t("{0}: יום מנוחה", title) : t("{0} יום {1}: {2}", title, d.day, d.title);
    const desc = d.rest ? d.note || '' : t("{0} ק\"מ · {1} {2}", d.km, d.overnight || '', d.notes?.join('\n') || '');
    lines.push('BEGIN:VEVENT', `UID:shvil-${d.day}-${date}@shvil`, `DTSTAMP:${date}T000000Z`, `DTSTART;VALUE=DATE:${date}`, `DTEND;VALUE=DATE:${toISODate(next).replace(/-/g, '')}`, `SUMMARY:${esc(summary)}`, `DESCRIPTION:${esc(desc)}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}