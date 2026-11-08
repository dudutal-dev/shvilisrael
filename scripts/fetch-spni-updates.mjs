// Fetches SPNI's "updates & changes" page and writes public/data/updates.json (+ src/data/spni/updates.json).
// Runs daily from .github/workflows/refresh-updates.yml. No dependencies.
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
const URL = 'https://www.teva.org.il/national-trail-updates'
const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#8217;|&rsquo;/g, '’').replace(/&#8211;|&ndash;/g, '–').replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(n)).replace(/&[a-z]+;/g, ' ')
function clean(html) {
  let t = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, '')
  t = t.replace(/<br\s*\/?>|<\/p>|<\/h\d>|<\/li>|<\/div>/g, '\n')
  t = decode(t.replace(/<[^>]+>/g, ''))
  t = t.replace(/[ \t ]+/g, ' ').replace(/[\u{1F300}-\u{1FAFF}☀-➿️]+\s*/gu, '')
  return t.split('\n').map((l) => l.trim()).filter(Boolean).join('\n')
}
// SPNI_HTML_FILE=path lets you test the parser offline against a saved copy of the page.
let html
if (process.env.SPNI_HTML_FILE) html = readFileSync(process.env.SPNI_HTML_FILE, 'utf8')
else {
  const res = await fetch(URL, { headers: { 'user-agent': 'ShvilIsraelApp/1.0 (+https://github.com/dudutal-dev/shvilisrael)' } })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  html = await res.text()
}
const main = (html.match(/<main[\s\S]*?<\/main>/) || [html])[0]
let txt = clean(main)
const marker = 'לרכישת מפות סימון שבילים'
const at = txt.indexOf(marker)
if (at >= 0) txt = txt.slice(at + marker.length)
txt = txt.split('\nשיתוף')[0]
const items = []
let region = null
for (const ln of txt.split('\n')) {
  if (!ln || ln.includes('צילום:')) continue
  if (ln.length <= 22 && !ln.includes(':') && !/\d/.test(ln)) { region = ln; continue }
  const m = ln.match(/^([^:]{2,60}):\s*(.+)$/)
  if (m && region) {
    const d = ln.match(/\(([^()]*\d{4})\)\s*\.?$/)
    items.push({ region, place: m[1].trim(), text: m[2].trim(), date: d ? d[1] : null })
  } else if (items.length && region) items[items.length - 1].text += ' ' + ln
}
if (items.length < 5) throw new Error('parsed too few items: ' + items.length)
const out = { fetched: new Date().toISOString().slice(0, 10), url: URL, items }
mkdirSync('public/data', { recursive: true })
let prev = null
try { prev = JSON.parse(readFileSync('public/data/updates.json', 'utf8')) } catch { /* first run */ }
const changed = !prev || JSON.stringify(prev.items) !== JSON.stringify(items)
if (changed) {
  writeFileSync('public/data/updates.json', JSON.stringify(out, null, 1))
  writeFileSync('src/data/spni/updates.json', JSON.stringify(out, null, 1))
}
console.log(`updates: ${items.length} items, changed=${changed}`)
process.exitCode = 0
