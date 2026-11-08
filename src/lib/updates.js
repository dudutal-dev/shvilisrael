// Sort SPNI route-update items by their Hebrew month/year string, newest first.
export function sortUpdates(items) {
  const M = { 'ינואר': 1, 'פברואר': 2, 'מרץ': 3, 'מארס': 3, 'אפריל': 4, 'מאי': 5, 'יוני': 6, 'יולי': 7, 'אוגוסט': 8, 'ספטמבר': 9, 'אוקטובר': 10, 'נובמבר': 11, 'דצמבר': 12 }
  const key = (d) => { d = d || ''; const y = (d.match(/\d{4}/) || [0])[0]; const m = Object.entries(M).find(([k]) => d.includes(k))?.[1] || 0; return Number(y) * 100 + m }
  return [...items].sort((a, b) => key(b.date) - key(a.date))
}
