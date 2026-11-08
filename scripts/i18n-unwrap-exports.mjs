// Revert t("…") → "…" inside exported top-level const declarations (data must stay raw; translate at render).
import { readFileSync, writeFileSync } from 'node:fs'
import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
import * as t from '@babel/types'
const traverse = _traverse.default || _traverse
const generate = _generate.default || _generate
for (const f of process.argv.slice(2)) {
  const src = readFileSync(f, 'utf8')
  const ast = parse(src, { sourceType: 'module', plugins: ['jsx'] })
  let n = 0
  traverse(ast, {
    ExportNamedDeclaration(p) {
      if (!t.isVariableDeclaration(p.node.declaration)) return
      p.traverse({ CallExpression(c) { if (t.isIdentifier(c.node.callee, { name: 't' }) && c.node.arguments.length === 1 && t.isStringLiteral(c.node.arguments[0]) && !c.findParent((x) => x.isFunction())) { c.replaceWith(c.node.arguments[0]); n++ } } })
    },
  })
  if (n) writeFileSync(f, generate(ast, { jsescOption: { minimal: true } }).code)
  console.log(f, 'unwrapped', n)
}
