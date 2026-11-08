// Extract Hebrew UI strings from src (excluding data) → scripts/strings.json (Hebrew → '' placeholders for translation)
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const HEB = /[֐-׿]/
const files = []
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (!p.includes('/data')) walk(p) } else if (/\.(jsx|js)$/.test(p)) files.push(p) } }
walk('src')
const strings = new Map()
const add = (s, file) => { s = s.trim(); if (s && HEB.test(s)) { if (!strings.has(s)) strings.set(s, new Set()); strings.get(s).add(file) } }
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  // JSX text nodes: >text< (no braces)
  for (const m of src.matchAll(/>([^<>{}]*[֐-׿][^<>{}]*)</g)) add(m[1], f)
  // quoted strings
  for (const m of src.matchAll(/'((?:[^'\\]|\\.)*[֐-׿](?:[^'\\]|\\.)*)'/g)) add(m[1].replace(/\\'/g, "'"), f)
  for (const m of src.matchAll(/"((?:[^"\\]|\\.)*[֐-׿](?:[^"\\]|\\.)*)"/g)) add(m[1].replace(/\\"/g, '"'), f)
  // template literals: Hebrew runs
  for (const m of src.matchAll(/`((?:[^`\\]|\\.)*)`/g)) for (const r of m[1].matchAll(/[֐-׿][^`$<>{}]*[֐-׿]|[֐-׿]/g)) add(r[0].replace(/\s+$/, ''), f)
}
const prev = existsSync('src/i18n/en.json') ? JSON.parse(readFileSync('src/i18n/en.json', 'utf8')) : {}
const out = {}
for (const [s] of [...strings.entries()].sort((a, b) => a[0].localeCompare(b[0]))) out[s] = prev[s] || ''
writeFileSync('scripts/strings.json', JSON.stringify(out, null, 1))
console.log('strings:', strings.size, 'untranslated:', Object.values(out).filter((v) => !v).length)
