// List Hebrew string literals anywhere in src (incl. top-level data consts) that have no en.json entry.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
const traverse = _traverse.default || _traverse
const en = JSON.parse(readFileSync('src/i18n/en.json', 'utf8'))
const HEB = /[֐-׿]/
const files = []
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (!/\/(data|i18n)$/.test(p)) walk(p) } else if (/\.(jsx|js)$/.test(p)) files.push(p) } }
walk('src')
const missing = new Map()
for (const f of files) {
  const src = readFileSync(f, 'utf8'); if (!HEB.test(src)) continue
  const ast = parse(src, { sourceType: 'module', plugins: ['jsx'] })
  traverse(ast, { StringLiteral(p) { const v = p.node.value.replace(/\s+/g, ' ').trim(); if (HEB.test(v) && !en[v] && !(p.parent.type === 'ObjectProperty' && p.parent.key === p.node)) { if (!missing.has(v)) missing.set(v, f) } }, JSXText(p) { const v = p.node.value.replace(/\s+/g, ' ').trim(); if (HEB.test(v) && !en[v]) missing.set(v, f) } })
}
for (const [k, f] of missing) console.log(JSON.stringify(k), '←', f.replace('src/', ''))
console.error('missing:', missing.size)
