// Keeps hashed assets from recent deploys alongside the new build, so an app shell that a device
// cached before the deploy can still load its chunks instead of showing a white screen.
// Usage: node scripts/keep-old-assets.mjs <previous-gh-pages-checkout> <dist>
import { readdirSync, existsSync, copyFileSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
const [prev, dist] = process.argv.slice(2)
const KEEP_DAYS = 45
const manifestName = 'assets-generations.json'
const now = Date.now()
const current = { ts: now, files: readdirSync(join(dist, 'assets')) }
let gens = []
try { gens = JSON.parse(readFileSync(join(prev, manifestName), 'utf8')) } catch {}
// Legacy: a previous deploy without a manifest – treat all its assets as one generation from now.
if (!gens.length && existsSync(join(prev, 'assets'))) gens = [{ ts: now - 1, files: readdirSync(join(prev, 'assets')) }]
gens = gens.filter((g) => now - g.ts < KEEP_DAYS * 86400e3)
const keep = new Set(gens.flatMap((g) => g.files))
let copied = 0
mkdirSync(join(dist, 'assets'), { recursive: true })
for (const f of keep) {
  const src = join(prev, 'assets', f), dst = join(dist, 'assets', f)
  if (!existsSync(dst) && existsSync(src)) { copyFileSync(src, dst); copied++ }
}
gens.push(current)
writeFileSync(join(dist, manifestName), JSON.stringify(gens))
console.log(`kept ${copied} assets from ${gens.length - 1} previous deploy(s)`)
