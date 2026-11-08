export const DAY = 86400000
export function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d }
export function toISODate(d) {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
export function fromISODate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export function fmtDate(d, opts = {}) {
  return new Date(d).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short', ...opts })
}
export function fmtDateLong(d) {
  return new Date(d).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
export const HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
export const HE_MONTHS_SHORT = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ']
export function isShabbat(d) { return new Date(d).getDay() === 6 }
export function isFriday(d) { return new Date(d).getDay() === 5 }
