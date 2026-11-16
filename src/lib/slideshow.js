// Journal slideshow: turns journal entries (personal, shared, or both) into designed slides in the
// order they were written, drawn on canvas so they look the same in the player, as images and in the PDF.
import { t, isEn, locale } from '../i18n/index.js'

const FONT = "Heebo, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif"
const NAVY = '#0b1d33', BLUE = '#1d4ed8', ORANGE = '#f26b1d', SOFT = '#ffb07a'

const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src })
function cover(c, img, x, y, w, h) { const k = Math.max(w / img.width, h / img.height), sw = w / k, sh = h / k; c.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h) }
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath() }
function wrap(c, text, maxW, maxLines) {
  const out = []
  for (const para of String(text).split('\n')) {
    let line = ''
    for (const w of para.split(/\s+/)) { const s = line ? line + ' ' + w : w; if (c.measureText(s).width > maxW && line) { out.push(line); line = w } else line = s }
    if (line) out.push(line)
  }
  if (out.length > maxLines) { out.length = maxLines; out[maxLines - 1] = out[maxLines - 1].replace(/\s*\S*$/, '') + '…' }
  return out
}
const lines = (c, arr, x, y, lh) => { arr.forEach((l, i) => c.fillText(l, x, y + i * lh)); return y + arr.length * lh }
const font = (c, w, px) => { c.font = `${w} ${Math.round(px)}px ${FONT}` }
const shadow = (c, on, u) => { c.shadowColor = on ? 'rgba(0,0,0,.55)' : 'transparent'; c.shadowBlur = on ? 14 * u : 0; c.shadowOffsetY = on ? 2 * u : 0 }
function trailBg(c, W, H) { const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, NAVY); g.addColorStop(0.45, '#16305e'); g.addColorStop(0.8, BLUE); g.addColorStop(1, '#3b63d8'); c.fillStyle = g; c.fillRect(0, 0, W, H); const s = c.createRadialGradient(W, H, 0, W, H, Math.max(W, H) * 0.7); s.addColorStop(0, 'rgba(242,107,29,.55)'); s.addColorStop(1, 'rgba(242,107,29,0)'); c.fillStyle = s; c.fillRect(0, 0, W, H) }
/** The trail blaze: white / blue / orange stripes. */
function blaze(c, cx, cy, w, h) { const x = cx - w / 2, y = cy - h / 2; c.save(); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = w * 0.25; rr(c, x, y, w, h, w * 0.14); c.fillStyle = '#fff'; c.fill(); c.shadowColor = 'transparent'; rr(c, x, y, w, h, w * 0.14); c.clip(); c.fillStyle = '#fff'; c.fillRect(x, y, w, h / 3); c.fillStyle = '#2563eb'; c.fillRect(x, y + h / 3, w, h / 3); c.fillStyle = ORANGE; c.fillRect(x, y + (2 * h) / 3, w, h / 3 + 1); c.restore() }
/** Thin tricolour rule, used as a divider. */
function rule(c, cx, y, w, th) { const x = cx - w / 2; c.save(); rr(c, x, y, w, th, th / 2); c.clip(); c.fillStyle = '#fff'; c.fillRect(x, y, w / 3, th); c.fillStyle = '#2563eb'; c.fillRect(x + w / 3, y, w / 3, th); c.fillStyle = ORANGE; c.fillRect(x + (2 * w) / 3, y, w / 3 + 1, th); c.restore() }
function blurBg(c, img, W, H, dark = 0.55) { // no canvas filter (unsupported in Safari): shrink hard, scale back up
  const s = document.createElement('canvas'); s.width = 36; s.height = Math.max(8, Math.round((36 * H) / W)); cover(s.getContext('2d'), img, 0, 0, s.width, s.height)
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(s, 0, 0, W, H)
  c.fillStyle = `rgba(11, 29, 51, ${dark})`; c.fillRect(0, 0, W, H)
}
function scrim(c, W, y0, y1, a) { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, 'rgba(11,29,51,0)'); g.addColorStop(1, `rgba(11,29,51,${a})`); c.fillStyle = g; c.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0)) }
function polaroid(c, img, cx, cy, w, rot, maxH) {
  const pad = w * 0.045, ar = Math.min(Math.max(img.width / img.height, 0.7), 1.6); let iw = w - 2 * pad, ih = iw / ar
  if (maxH && ih + pad * 3.4 > maxH) { ih = maxH - pad * 3.4; iw = ih * ar; w = iw + 2 * pad }
  const h = ih + pad * 3.4
  c.save(); c.translate(cx, cy); c.rotate((rot * Math.PI) / 180)
  c.shadowColor = 'rgba(0,0,0,.42)'; c.shadowBlur = w * 0.07; c.shadowOffsetY = w * 0.025; c.fillStyle = '#fff'; rr(c, -w / 2, -h / 2, w, h, w * 0.012); c.fill()
  c.shadowColor = 'transparent'; cover(c, img, -w / 2 + pad, -h / 2 + pad, iw, ih); c.restore()
  return { w, h }
}
function fan(c, imgs, cx, cy, w) {
  const set = imgs.slice(0, 3), n = set.length; if (!n) return
  const pos = n === 1 ? [[0, 0, -3]] : n === 2 ? [[0.3, 0, 5], [-0.3, 0.04, -5]] : [[0.56, 0.06, 9], [-0.56, 0.06, -8], [0, -0.04, 1.5]]
  set.forEach((im, i) => polaroid(c, im, cx + pos[i][0] * w, cy + pos[i][1] * w, w * (n === 1 ? 1.15 : 0.92), pos[i][2]))
}
/** Rounded labels, centred on cx, wrapping to more rows when needed. Returns the y after the last row. */
function chips(c, items, cx, y, u, maxW, accent) {
  c.save(); font(c, 600, 30 * u); const padX = 20 * u, h = 52 * u, gap = 12 * u, rows = [[]]; let rw = 0
  for (const s of items.filter(Boolean)) { const w = c.measureText(s).width + padX * 2; if (rw + w > maxW && rows[rows.length - 1].length) { rows.push([]); rw = 0 } rows[rows.length - 1].push([s, w]); rw += w + gap }
  rows.forEach((row, ri) => { const total = row.reduce((s, r) => s + r[1], 0) + gap * (row.length - 1); let px = cx - total / 2; const order = isEn() ? row : [...row].reverse()
    for (const [s, w] of order) { c.fillStyle = accent && s === accent ? ORANGE : 'rgba(255,255,255,.18)'; rr(c, px, y + ri * (h + gap), w, h, h / 2); c.fill(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(s, px + w / 2, y + ri * (h + gap) + h * 0.68); px += w + gap } })
  c.restore(); return y + rows.length * (h + gap)
}
const mk = (W, H) => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'); c.direction = isEn() ? 'ltr' : 'rtl'; c.textBaseline = 'alphabetic'; c.textAlign = 'center'; return [cv, c] }
const dims = (W, H) => { const P = H > W; return [P, P ? W / 1080 : H / 900] }
function brand(c, W, H, u) { c.save(); font(c, 600, 24 * u); c.fillStyle = 'rgba(255,255,255,.65)'; c.textAlign = 'center'; c.fillText(t("שביל ישראל") + ' · ' + t("יומן המסע"), W / 2, H - 30 * u); c.restore() }
function tag(c, W, u, label) { c.save(); font(c, 700, 28 * u); const w = c.measureText(label).width + 44 * u; c.fillStyle = 'rgba(11,29,51,.55)'; rr(c, W / 2 - w / 2, 40 * u, w, 54 * u, 27 * u); c.fill(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(label, W / 2, 78 * u); c.restore() }
const dLong = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })
const dShort = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short' })

// ---------- slides ----------
function sCover(W, H, st) {
  const [cv, c] = mk(W, H), [P, u] = dims(W, H), tx = P ? W / 2 : W * 0.7
  trailBg(c, W, H); blaze(c, tx, P ? H * 0.12 : H * 0.17, 70 * u, 100 * u)
  c.fillStyle = '#fff'; shadow(c, true, u); font(c, 800, (P ? 150 : 120) * u); c.fillText(t("שביל ישראל"), tx, P ? H * 0.27 : H * 0.42)
  font(c, 700, (P ? 64 : 52) * u); c.fillStyle = SOFT; c.fillText(st.kind, tx, P ? H * 0.325 : H * 0.53); shadow(c, false, u)
  rule(c, tx, P ? H * 0.35 : H * 0.575, 300 * u, 8 * u)
  font(c, 600, 36 * u); c.fillStyle = 'rgba(255,255,255,.92)'; c.fillText(st.from === st.to ? dLong(st.from) : `${dShort(st.from)} – ${dShort(st.to)} ${st.to.slice(0, 4)}`, tx, P ? H * 0.4 : H * 0.66)
  let y = chips(c, [(st.days === 1 ? t("יום אחד") : t("{0} ימים", st.days)), st.km ? t("{0} ק\"מ", st.km) : '', st.photos ? t("{0} תמונות", st.photos) : ''], tx, P ? H * 0.425 : H * 0.7, u, P ? W * 0.9 : W * 0.5)
  if (st.names.length) { font(c, 500, 28 * u); c.fillStyle = 'rgba(255,255,255,.8)'; lines(c, wrap(c, st.names.join(' · '), P ? W * 0.8 : W * 0.5, 2), tx, y + 34 * u, 38 * u) }
  if (P) fan(c, st.pick, W / 2, H * 0.76, W * 0.4); else fan(c, st.pick, W * 0.27, H * 0.52, W * 0.2)
  return cv
}
function sDay(W, H, e, n, withFan) {
  const [cv, c] = mk(W, H), [P, u] = dims(W, H), tx = P || !withFan ? W / 2 : W * 0.68, tw = P ? W * 0.84 : withFan ? W * 0.52 : W * 0.8
  if (e.imgs[0]) { cover(c, e.imgs[0], 0, 0, W, H); c.fillStyle = 'rgba(11,29,51,.86)'; c.fillRect(0, 0, W, H) } else trailBg(c, W, H)
  let y = P ? H * 0.11 : H * 0.15
  font(c, 700, 36 * u); c.fillStyle = SOFT; c.fillText(dLong(e.date), tx, y)
  font(c, 800, (P ? 150 : 110) * u); c.fillStyle = '#fff'; y += (P ? 150 : 115) * u; c.fillText(t("יום {0}", n), tx, y)
  if (e.seg) { font(c, 700, (P ? 54 : 44) * u); y = lines(c, wrap(c, e.seg, tw, 2), tx, y + (P ? 80 : 62) * u, (P ? 64 : 52) * u) - (P ? 30 : 24) * u }
  rule(c, tx, y + 26 * u, 260 * u, 8 * u)
  y = chips(c, [[e.mood, e.weather].filter(Boolean).join(' '), e.km ? t("{0} ק\"מ", e.km) : '', e.sleep ? '🛏 ' + e.sleep : '', e.by ? '✍️ ' + e.by : ''], tx, y + 62 * u, u, tw, e.km ? t("{0} ק\"מ", e.km) : '')
  if (e.text) {
    font(c, 400, (P ? 44 : 36) * u); c.fillStyle = 'rgba(255,255,255,.95)'
    const room = (withFan && P ? H * 0.6 : H - 110 * u) - y, lh = (P ? 62 : 50) * u
    lines(c, wrap(c, e.text, tw, Math.max(2, Math.floor(room / lh) - 1)), tx, y + lh, lh)
  }
  if (withFan) { if (P) fan(c, e.imgs, W / 2, H * 0.79, W * 0.36); else fan(c, e.imgs, W * 0.26, H * 0.52, W * 0.2) }
  brand(c, W, H, u)
  return cv
}
function sPhoto(W, H, e, img, label, k) {
  const [cv, c] = mk(W, H), [P, u] = dims(W, H), sAR = W / H, iAR = img.width / img.height, fit = Math.min(sAR / iAR, iAR / sAR)
  const meta = [e.seg, dShort(e.date), e.by ? '✍️ ' + e.by : '']
  if (fit > 0.68) { cover(c, img, 0, 0, W, H); scrim(c, W, 220 * u, 0, 0.55); scrim(c, W, H - 420 * u, H, 0.88); chips(c, meta, W / 2, H - 190 * u, u, W * 0.9) }
  else if (P) { blurBg(c, img, W, H); const card = polaroid(c, img, W / 2, H * 0.45, W * 0.88, k % 2 ? 1.4 : -1.4, H * 0.56); chips(c, meta, W / 2, H * 0.45 + card.h / 2 + 60 * u, u, W * 0.9) }
  else { blurBg(c, img, W, H); polaroid(c, img, W * 0.32, H * 0.52, W * 0.38, k % 2 ? 2 : -2, H * 0.76); chips(c, meta, W * 0.73, H * 0.44, u, W * 0.42) }
  tag(c, W, u, label); brand(c, W, H, u)
  return cv
}
function sCollage(W, H, e, imgs, label) {
  const [cv, c] = mk(W, H), [P, u] = dims(W, H), n = imgs.length, g = 16 * u
  blurBg(c, imgs[0], W, H, 0.62)
  const bx = P ? W * 0.06 : W * 0.05, by = 130 * u, bw = W - 2 * bx, bh = H - by - (P ? 300 : 200) * u
  const R = n === 2 ? (P ? [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]] : [[0.5, 0, 0.5, 1], [0, 0, 0.5, 1]])
    : n === 3 ? (P ? [[0, 0, 1, 0.56], [0.5, 0.56, 0.5, 0.44], [0, 0.56, 0.5, 0.44]] : [[0.42, 0, 0.58, 1], [0, 0, 0.42, 0.5], [0, 0.5, 0.42, 0.5]])
      : [[0.5, 0, 0.5, 0.5], [0, 0, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5], [0, 0.5, 0.5, 0.5]]
  imgs.slice(0, R.length).forEach((im, i) => { const [rx, ry, rw, rh] = R[i], x = bx + rx * bw + g / 2, y = by + ry * bh + g / 2, w = rw * bw - g, h = rh * bh - g
    c.save(); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 30 * u; c.shadowOffsetY = 10 * u; c.fillStyle = '#fff'; rr(c, x - 7 * u, y - 7 * u, w + 14 * u, h + 14 * u, 16 * u); c.fill(); c.restore()
    c.save(); rr(c, x, y, w, h, 10 * u); c.clip(); cover(c, im, x, y, w, h); c.restore() })
  chips(c, [e.seg, dShort(e.date), e.by ? '✍️ ' + e.by : ''], W / 2, by + bh + 40 * u, u, W * 0.9)
  tag(c, W, u, label); brand(c, W, H, u)
  return cv
}
function sEnd(W, H, st) {
  const [cv, c] = mk(W, H), [P, u] = dims(W, H), tx = P ? W / 2 : W * 0.7
  trailBg(c, W, H); blaze(c, tx, P ? H * 0.12 : H * 0.2, 70 * u, 100 * u)
  c.fillStyle = '#fff'; shadow(c, true, u); font(c, 800, (P ? 110 : 90) * u); c.fillText(t("המסע ממשיך"), tx, P ? H * 0.26 : H * 0.45); shadow(c, false, u)
  rule(c, tx, P ? H * 0.285 : H * 0.5, 300 * u, 8 * u)
  chips(c, [(st.days === 1 ? t("יום אחד") : t("{0} ימים", st.days)), st.km ? t("{0} ק\"מ", st.km) : '', st.photos ? t("{0} תמונות", st.photos) : ''], tx, P ? H * 0.32 : H * 0.57, u, P ? W * 0.9 : W * 0.5)
  font(c, 700, 46 * u); c.fillStyle = SOFT; c.fillText(t("שביל ישראל"), tx, P ? H * 0.43 : H * 0.8)
  if (P) fan(c, st.pick.slice().reverse(), W / 2, H * 0.72, W * 0.4); else fan(c, st.pick.slice().reverse(), W * 0.27, H * 0.52, W * 0.2)
  return cv
}

/**
 * Build the slides. entries: [{ date:'YYYY-MM-DD', ts, text, km, mood, weather, sleep, seg, by, photos:[dataURL] }]
 * Returns [{ blob, W, H }]. onProgress(0..1). cancelled() lets the caller abort a stale build.
 */
export async function buildSlides({ entries, landscape, kind, names, onProgress, cancelled }) {
  const [W, H] = landscape ? [1600, 900] : [1080, 1920]
  if (document.fonts?.load) await Promise.all([`800 80px ${FONT}`, `600 30px ${FONT}`, `400 40px ${FONT}`].map((f) => document.fonts.load(f, String.fromCharCode(0x5d0, 0x5d1) + ' Ab').catch(() => {})))
  const list = [...entries].sort((a, b) => a.date.localeCompare(b.date) || (a.ts || 0) - (b.ts || 0))
  for (const e of list) { e.imgs = []; for (const src of e.photos || []) try { e.imgs.push(await loadImg(src)) } catch { /* unreadable photo */ } }
  const all = list.flatMap((e) => e.imgs), days = [...new Set(list.map((e) => e.date))]
  const st = { kind, names: names || [], from: list[0].date, to: list[list.length - 1].date, days: days.length, km: Math.round(list.reduce((s, e) => s + (parseFloat(e.km) || 0), 0)), photos: all.length,
    pick: all.length ? [all[0], all[Math.floor(all.length / 2)], all[all.length - 1]].filter((x, i, a) => a.indexOf(x) === i) : [] }
  const out = [], push = async (cv) => { out.push({ blob: await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.9)), W, H }); cv.width = cv.height = 0 }
  await push(sCover(W, H, st))
  let k = 0, done = 0
  const seen = new Set()
  for (const e of list) {
    if (cancelled?.()) return null
    const n = days.indexOf(e.date) + 1, label = t("יום {0}", n)
    // a day slide opens each date and every entry that has text; a short text leaves room for a few photos
    if (e.text || !seen.has(e.date)) await push(sDay(W, H, e, n, e.imgs.length > 0 && String(e.text || '').length < 220))
    seen.add(e.date)
    const rest = e.imgs.slice()
    while (rest.length) { const take = rest.length === 5 ? 3 : Math.min(4, rest.length), part = rest.splice(0, take)
      await push(part.length === 1 ? sPhoto(W, H, e, part[0], label, k++) : sCollage(W, H, e, part, label)) }
    onProgress?.(++done / list.length); await new Promise((r) => setTimeout(r))
  }
  await push(sEnd(W, H, st))
  for (const e of list) delete e.imgs
  return cancelled?.() ? null : out
}

/** Minimal PDF: one JPEG per page. */
export async function slidesPdf(slides) {
  const enc = new TextEncoder(), parts = [], offs = []; let len = 0
  const add = (x) => { const u8 = typeof x === 'string' ? enc.encode(x) : x; parts.push(u8); len += u8.length }
  const obj = (n, body) => { offs[n] = len; add(`${n} 0 obj\n`); body(); add('\nendobj\n') }
  add('%PDF-1.4\n')
  const N = slides.length
  obj(1, () => add('<< /Type /Catalog /Pages 2 0 R >>'))
  obj(2, () => add(`<< /Type /Pages /Count ${N} /Kids [${slides.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] >>`))
  for (let i = 0; i < N; i++) {
    const s = slides[i], jpg = new Uint8Array(await s.blob.arrayBuffer()), pw = s.W / 2, ph = s.H / 2, p = 3 + i * 3, content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`
    obj(p, () => add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 ${p + 2} 0 R >> >> /Contents ${p + 1} 0 R >>`))
    obj(p + 1, () => add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`))
    obj(p + 2, () => { add(`<< /Type /XObject /Subtype /Image /Width ${s.W} /Height ${s.H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`); add(jpg); add('\nendstream') })
  }
  const xref = len, total = 3 + N * 3
  add(`xref\n0 ${total}\n0000000000 65535 f \n` + Array.from({ length: total - 1 }, (_, i) => String(offs[i + 1]).padStart(10, '0') + ' 00000 n \n').join(''))
  add(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return new Blob(parts, { type: 'application/pdf' })
}
