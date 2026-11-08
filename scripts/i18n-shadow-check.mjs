// Fails if a file imports t() from i18n and also declares a local binding named `t` (which shadows it).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
const files = []
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.(jsx?|mjs)$/.test(f) && files.push(p) } }
walk('src')
let bad = 0
for (const f of files) {
  const s = readFileSync(f, 'utf8')
  if (!/import \{[^}]*\bt\b[^}]*\} from ['"][^'"]*i18n\/index\.js['"]/.test(s)) continue
  const re = /(\b(?:const|let|var)\s+t\b)|(\(\s*t\s*(?:,\s*\w+\s*)?\)\s*=>)|(\bt\s*=>)|(\.then\(\s*(?:async\s+)?t\s*=>)|(catch\s*\(\s*t\s*\))|(function\s*\w*\s*\((?:[^()=]*,\s*)?t\s*[,)])|(function\s+\w+\(\{[^}]*\bt\s*[,}])/g
  let m; while ((m = re.exec(s))) { const line = s.slice(0, m.index).split('\n').length; console.log(`${f}:${line}: local 't' shadows the i18n t(): ${m[0]}`); bad++ }
}
if (bad) { console.error(`${bad} shadowing binding(s)`); process.exit(1) } else console.log('no t() shadowing')
