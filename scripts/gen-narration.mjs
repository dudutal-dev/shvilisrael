// Pre-generates the Hebrew route-story narration with ElevenLabs and stores it as static MP3 files:
//   public/audio/he/<segmentId>/<step>.mp3  +  public/audio/he/manifest.json (text hash per step)
// Idempotent: a step is regenerated only when its text changed. Usage:
//   ELEVENLABS_API_KEY=... node scripts/gen-narration.mjs [--concurrency 4] [--seg 1,2,3]
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, renameSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const run = promisify(execFile)

const KEY = process.env.ELEVENLABS_API_KEY || 'proxy-injected'
const VOICE = process.env.ELEVEN_VOICE_HE || 'UftNp7bAl1b6Y7tTy8OA' // "פנים 12 — מדריכה"
const MODEL = process.env.ELEVEN_MODEL || 'eleven_v4_turbo'
const FORMAT = 'mp3_22050_32'
const args = process.argv.slice(2)
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d }
const CONC = Number(opt('--concurrency', 4))
const ONLY = opt('--seg', '') ? opt('--seg', '').split(',').map(Number) : null
const DRY = args.includes('--dry')

const OUT = 'public/audio/he'
const MANIFEST = join(OUT, 'manifest.json')
mkdirSync(OUT, { recursive: true })
const segments = JSON.parse(readFileSync('src/data/segments.json', 'utf8')).segments
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { voice: VOICE, model: MODEL, format: FORMAT, segments: {} }

// must match src/lib/tts.js hash()
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return (h >>> 0).toString(36) }
const stepText = (i, n, txt) => `שלב ${i + 1} מתוך ${n}. ${txt}`

const jobs = []
for (const s of segments) {
  if (ONLY && !ONLY.includes(s.id)) continue
  const steps = s.steps_he || []
  const entry = (manifest.segments[s.id] = manifest.segments[s.id] || [])
  steps.forEach((txt, i) => {
    const text = stepText(i, steps.length, txt)
    const h = hash(text)
    const file = join(OUT, String(s.id), `${i + 1}.mp3`)
    const cur = entry[i]
    if (cur && cur.hash === h && existsSync(file) && statSync(file).size > 1000) return
    jobs.push({ seg: s.id, i, text, h, file })
  })
  entry.length = steps.length
}
const totalChars = jobs.reduce((a, j) => a + j.text.length, 0)
console.log(`${jobs.length} clips to generate · ${totalChars.toLocaleString()} characters · voice ${VOICE} · ${MODEL}`)
if (DRY || !jobs.length) { writeFileSync(MANIFEST, JSON.stringify(manifest)); process.exit(0) }

let done = 0, failed = 0
const saveManifest = () => { manifest.voice_name = manifest.voice_name || process.env.ELEVEN_VOICE_NAME || 'פנים 12 — מדריכה'; const j = JSON.stringify(manifest); writeFileSync(MANIFEST, j); writeFileSync('src/data/narration-he.json', j) }
async function gen(job, attempt = 1) {
  // curl honours HTTPS_PROXY / CA bundle (Node's fetch does not), and streams straight to disk
  mkdirSync(join(OUT, String(job.seg)), { recursive: true })
  const tmp = job.file + '.part'
  const bodyFile = job.file + '.json'
  writeFileSync(bodyFile, JSON.stringify({ text: job.text, model_id: MODEL, language_code: 'he' }))
  const { stdout } = await run('curl', ['-sS', '-m', '120', '-o', tmp, '-w', '%{http_code}', '-X', 'POST', '-H', `xi-api-key: ${KEY}`, '-H', 'Content-Type: application/json', '--data-binary', `@${bodyFile}`,
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=${FORMAT}`], { maxBuffer: 1e6 }).catch((e) => ({ stdout: '000 ' + e.message }))
  try { unlinkSync(bodyFile) } catch { /* ignore */ }
  const code = Number(String(stdout).trim().slice(0, 3))
  if (code !== 200) {
    const detail = existsSync(tmp) ? readFileSync(tmp, 'utf8').slice(0, 160) : String(stdout).slice(0, 160)
    if ((code === 429 || code >= 500 || code === 0) && attempt < 5) { await new Promise((res) => setTimeout(res, 3000 * attempt)); return gen(job, attempt + 1) }
    throw new Error(`${code} ${detail}`)
  }
  const size = statSync(tmp).size
  if (size < 1000) throw new Error('empty audio')
  renameSync(tmp, job.file)
  manifest.segments[job.seg][job.i] = { hash: job.h, bytes: size, chars: job.text.length }
}
const queue = [...jobs]
async function worker() {
  while (queue.length) {
    const job = queue.shift()
    try { await gen(job) } catch (e) { failed++; console.error(`FAIL seg ${job.seg} step ${job.i + 1}: ${e.message}`) }
    done++
    if (done % 20 === 0 || done === jobs.length) { saveManifest(); console.log(`${done}/${jobs.length} (${failed} failed)`) }
  }
}
await Promise.all(Array.from({ length: CONC }, worker))
saveManifest()
const bytes = Object.values(manifest.segments).flat().reduce((a, c) => a + (c?.bytes || 0), 0)
console.log(`done · ${done - failed} ok · ${failed} failed · ${(bytes / 1048576).toFixed(1)} MB total`)
process.exit(failed ? 1 : 0)
