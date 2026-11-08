// AST codemod: wraps Hebrew UI strings in t(...) and emits scripts/strings.json (keys to translate).
// Usage: node scripts/i18n-codemod.mjs [--write]
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
import * as t from '@babel/types'
const traverse = _traverse.default || _traverse
const generate = _generate.default || _generate
const WRITE = process.argv.includes('--write')
const HEB = /[֐-׿]/
const files = []
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (!/\/(data|i18n)$/.test(p)) walk(p) } else if (/\.(jsx|js)$/.test(p) && !p.endsWith('main.jsx')) files.push(p) } }
walk('src')
const keys = new Map()
const addKey = (k, f) => { if (!keys.has(k)) keys.set(k, new Set()); keys.get(k).add(relative('src', f)) }
const norm = (s) => s.replace(/\s+/g, ' ').trim()

for (const f of files) {
  const src = readFileSync(f, 'utf8')
  if (!HEB.test(src)) continue
  const ast = parse(src, { sourceType: 'module', plugins: ['jsx'] })
  let changed = false, needImport = false
  const inTopLevelConst = (path) => {
    // true when the string sits inside a module-level const/let initializer (data) – leave as-is (translated at render)
    let p = path
    while (p) { if (p.isVariableDeclarator() && p.parentPath.parentPath?.isProgram()) return true; if (p.isFunction()) return false; p = p.parentPath }
    return false
  }
  traverse(ast, {
    JSXText(path) {
      const v = path.node.value
      if (!HEB.test(v)) return
      const lead = v.match(/^\s*/)[0].includes('\n') ? '' : v.match(/^\s*/)[0]
      const trail = v.match(/\s*$/)[0].includes('\n') ? '' : v.match(/\s*$/)[0]
      const key = norm(v)
      addKey(key, f)
      const nodes = []
      if (lead) nodes.push(t.jsxText(lead))
      nodes.push(t.jsxExpressionContainer(t.callExpression(t.identifier('t'), [t.stringLiteral(key)])))
      if (trail) nodes.push(t.jsxText(trail))
      path.replaceWithMultiple(nodes); changed = true; needImport = true
    },
    StringLiteral(path) {
      const v = path.node.value
      if (!HEB.test(v)) return
      const parent = path.parent
      if (t.isImportDeclaration(parent) || t.isExportDeclaration(parent)) return
      if (t.isObjectProperty(parent) && parent.key === path.node && !parent.computed) return // object keys
      if (path.parentPath.isCallExpression() && path.parentPath.node.callee.name === 't') return
      if (inTopLevelConst(path)) return
      const key = norm(v)
      addKey(key, f)
      const call = t.callExpression(t.identifier('t'), [t.stringLiteral(key)])
      if (t.isJSXAttribute(parent)) path.replaceWith(t.jsxExpressionContainer(call))
      else path.replaceWith(call)
      changed = true; needImport = true
    },
    TemplateLiteral(path) {
      const q = path.node.quasis.map((x) => x.value.cooked)
      if (!q.some((s) => HEB.test(s))) return
      if (path.parentPath.isTaggedTemplateExpression()) return
      if (inTopLevelConst(path)) return
      // skip multi-line templates (messages) only if they contain no Hebrew… they do – handle anyway
      const key = norm(q.map((s, i) => (i < q.length - 1 ? s + `{${i}}` : s)).join(''))
      addKey(key, f)
      path.replaceWith(t.callExpression(t.identifier('t'), [t.stringLiteral(key), ...path.node.expressions]))
      changed = true; needImport = true
    },
  })
  if (WRITE && changed) {
    let out = generate(ast, { retainLines: false, jsescOption: { minimal: true } }).code
    if (needImport && !/from '(\.\.\/)+i18n\/index\.js'|from '\.\/i18n\/index\.js'/.test(out)) {
      const depth = f.split('/').length - 2 // src/pages/x.jsx → 1
      const rel = depth === 0 ? './i18n/index.js' : '../'.repeat(depth) + 'i18n/index.js'
      out = out.replace(/^(import[^\n]*\n)(?![\s\S]*^import)/m, (m) => m) // noop
      const lines = out.split('\n'); let last = -1
      for (let i = 0; i < lines.length; i++) if (/^import /.test(lines[i])) last = i
      lines.splice(last + 1, 0, `import { t } from '${rel}'`)
      out = lines.join('\n')
    }
    writeFileSync(f, out)
  }
}
const prev = existsSync('src/i18n/en.json') ? JSON.parse(readFileSync('src/i18n/en.json', 'utf8')) : {}
const out = {}
for (const k of [...keys.keys()].sort()) out[k] = prev[k] || ''
writeFileSync('scripts/strings.json', JSON.stringify({ keys: out, files: Object.fromEntries([...keys].map(([k, v]) => [k, [...v]])) }, null, 1))
console.log('files:', files.length, 'keys:', keys.size, 'chars:', [...keys.keys()].reduce((a, k) => a + k.length, 0), WRITE ? '(written)' : '(dry run)')
