// Designed journal export: builds A4 pages as HTML (cover, entries with photos, summary), rasterises each
// page with html2canvas and assembles a PDF with jsPDF – fully client-side, works offline, Hebrew/RTL safe.
import { t, tf, isEn, locale } from '../i18n/index.js'
import { getPhotos } from './photos.js'
import { fmtDateLong } from './dates.js'

const W = 794, H = 1123, PAD = 46 // A4 at 96 dpi
const NAVY = '#0b1d33', BLUE = '#2f80ed', ORANGE = '#f26b1d'

const el = (tag, style = '', html = '') => { const e = document.createElement(tag); if (style) e.setAttribute('style', style); if (html) e.innerHTML = html; return e }
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const nl = (s) => esc(s).replace(/\n/g, '<br>')

function pageEl(root, dark = false) {
  const p = el('div', `width:${W}px;height:${H}px;box-sizing:border-box;padding:${PAD}px;position:relative;overflow:hidden;background:${dark ? NAVY : '#fff'};color:${dark ? '#fff' : '#111'};font-family:Heebo,system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.55;`)
  root.appendChild(p)
  return p
}
const blaze = (h = 18) => `<span style="display:inline-flex;gap:3px;vertical-align:middle"><span style="width:7px;height:${h}px;background:#fff;border:1px solid #ccd;border-radius:2px"></span><span style="width:7px;height:${h}px;background:${BLUE};border-radius:2px"></span><span style="width:7px;height:${h}px;background:${ORANGE};border-radius:2px"></span></span>`
const footer = (page, total) => `<div style="position:absolute;left:${PAD}px;right:${PAD}px;bottom:22px;display:flex;justify-content:space-between;font-size:11px;color:#8892a6">${blaze(12)}<span>${esc(t('יומן המסע שלי בשביל ישראל'))} · ${page}/${total}</span></div>`

async function loadImgs(container) {
  const imgs = [...container.querySelectorAll('img')]
  await Promise.all(imgs.map((im) => (im.complete ? Promise.resolve() : new Promise((r) => { im.onload = r; im.onerror = r }))))
}

/**
 * @param {object} o
 * @param {Array} o.journal entries {date, segId, text, km, mood, weather, photos[], sleep, water, pos}
 * @param {Array} o.segments
 * @param {number[]} o.done completed segment ids
 * @param {object} o.stats {doneKm, totalKm, trackKm, trackDays}
 * @param {(i:number,n:number)=>void} [o.onProgress]
 * @returns {Promise<Blob>} the PDF
 */
export async function buildJournalPdf({ journal, segments, done, stats, onProgress }) {
  const [{ jsPDF }, html2canvas] = await Promise.all([import('jspdf'), import('html2canvas').then((m) => m.default || m)])
  const dir = isEn() ? 'ltr' : 'rtl'
  const root = el('div', `position:fixed;left:0;top:0;width:${W}px;z-index:-1;opacity:0;pointer-events:none;direction:${dir};text-align:${dir === 'rtl' ? 'right' : 'left'}`)
  root.setAttribute('dir', dir)
  document.body.appendChild(root)
  try {
    const entries = [...journal].sort((a, b) => a.date.localeCompare(b.date))
    const segName = (id) => { const s = segments.find((x) => x.id === Number(id)); return s ? `${t('מקטע')} ${s.id}: ${tf(s, 'name')}` : '' }
    const photoIds = entries.flatMap((e) => e.photos || [])
    const first = entries[0]?.date, last = entries[entries.length - 1]?.date
    const pct = stats.totalKm ? Math.round((stats.doneKm / stats.totalKm) * 100) : 0
    const num = (n) => Number(n || 0).toLocaleString(locale())

    // ---- cover -------------------------------------------------------------------------------
    const cover = pageEl(root, true)
    const coverPhoto = photoIds.length ? (await getPhotos([photoIds[0]]))[0] : null
    cover.innerHTML = `
      <div style="position:absolute;inset:0;background:linear-gradient(160deg,#0b1d33 0%,#143a6b 60%,#2f80ed 140%)"></div>
      ${coverPhoto ? `<img src="${coverPhoto.data}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.55"><div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,29,51,.55) 0%,rgba(11,29,51,.15) 45%,rgba(11,29,51,.92) 100%)"></div>` : ''}
      <div style="position:absolute;inset:0;background:radial-gradient(circle at 80% 15%,rgba(242,107,29,.35),transparent 45%)"></div>
      <div style="position:relative;height:100%;display:flex;flex-direction:column;justify-content:space-between">
        <div>${blaze(34)}<div style="margin-top:28px;font-size:16px;letter-spacing:.5px;opacity:.85">${esc(t('מהחרמון ועד אילת'))}</div>
          <h1 style="font-size:54px;line-height:1.1;margin:10px 0 0;font-weight:800">${esc(t('יומן המסע שלי'))}<br>${esc(t('בשביל ישראל'))}</h1>
          ${first ? `<div style="margin-top:18px;font-size:18px;opacity:.9">${esc(fmtDateLong(first))}${last && last !== first ? ` – ${esc(fmtDateLong(last))}` : ''}</div>` : ''}
        </div>
        <div>
          <div style="display:flex;gap:14px;flex-wrap:wrap">
            ${[[num(stats.doneKm), t('ק"מ הושלמו')], [done.length, t('מקטעים')], [entries.length, t('רשומות')], [photoIds.length, t('תמונות')]].map(([v, l]) => `<div style="background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);border-radius:16px;padding:14px 18px;min-width:120px"><div style="font-size:30px;font-weight:800;line-height:1">${v}</div><div style="font-size:12px;opacity:.85;margin-top:6px">${esc(l)}</div></div>`).join('')}
          </div>
          <div style="margin-top:26px;font-size:12px;opacity:.8">${esc(t('ההתקדמות שלי לאורך השביל'))} · ${pct}%</div>
          <div style="display:flex;gap:2px;margin-top:8px;height:34px;align-items:flex-end">${segments.map((s) => `<div style="flex:1;height:${40 + ((s.distance_km || 15) % 25) * 2}%;border-radius:2px;background:${done.includes(s.id) ? ORANGE : 'rgba(255,255,255,.22)'}"></div>`).join('')}</div>
          <div style="display:flex;justify-content:space-between;font-size:11px;opacity:.7;margin-top:6px"><span>${esc(t('חרמון'))}</span><span>${esc(t('אילת'))}</span></div>
        </div>
      </div>`

    // ---- entries ------------------------------------------------------------------------------
    const pages = [cover]
    const limit = H - PAD * 2 - 30 // keep room for the footer
    let page = null, body = null
    const newPage = () => { page = pageEl(root); body = el('div', 'display:flex;flex-direction:column;gap:14px'); page.appendChild(body); pages.push(page) }
    newPage()
    const place = async (node, keepWith = null) => {
      body.appendChild(node)
      await loadImgs(node)
      if (body.scrollHeight > limit && body.children.length > 1) {
        body.removeChild(node)
        // keep an entry card together with its first photo row when the card is the last thing on the page
        const carry = keepWith && body.lastElementChild === keepWith ? keepWith : null
        if (carry) body.removeChild(carry)
        newPage()
        if (carry) body.appendChild(carry)
        body.appendChild(node)
      }
      if (body.scrollHeight > limit) { node.style.maxHeight = `${limit - 10}px`; node.style.overflow = 'hidden' }
    }
    for (const e of entries) {
      const meta = [e.km ? `🥾 ${e.km} ${t('ק"מ')}` : '', e.sleep ? `🛏 ${esc(e.sleep)}` : '', e.water ? `💧 ${e.water} ${t("ל'")}` : '', e.pos ? `📍 ${e.pos.lat.toFixed(4)}, ${e.pos.lon.toFixed(4)}` : ''].filter(Boolean).join(' · ')
      const card = el('div', `border:1px solid #e3e7f0;border-radius:16px;padding:16px 18px;background:#fbfcfe;page-break-inside:avoid`)
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <div style="font-size:19px;font-weight:800">${esc(e.mood || '')} ${esc(e.weather || '')} ${esc(fmtDateLong(e.date))}</div>
          ${e.km ? `<span style="background:#ffe9db;color:#b4440c;border-radius:999px;padding:3px 12px;font-size:12px;font-weight:700;white-space:nowrap">${e.km} ${esc(t('ק"מ'))}</span>` : ''}
        </div>
        ${e.segId ? `<div style="color:${BLUE};font-weight:700;font-size:13px;margin-top:4px">${esc(segName(e.segId))}</div>` : ''}
        ${e.text ? `<div style="margin-top:10px;font-size:14.5px;white-space:pre-wrap">${nl(e.text)}</div>` : ''}
        ${meta ? `<div style="margin-top:10px;font-size:12px;color:#6b7280">${meta}</div>` : ''}`
      await place(card)
      const photos = e.photos?.length ? await getPhotos(e.photos) : []
      for (let i = 0; i < photos.length; i += 4) {
        const chunk = photos.slice(i, i + 4)
        const grid = el('div', `display:grid;grid-template-columns:repeat(${chunk.length === 1 ? 1 : 2},1fr);gap:8px`)
        grid.innerHTML = chunk.map((p) => `<img src="${p.data}" style="width:100%;height:${chunk.length === 1 ? 340 : 240}px;object-fit:cover;border-radius:12px;display:block">`).join('')
        await place(grid, i === 0 ? card : null)
      }
    }

    // ---- summary ------------------------------------------------------------------------------
    const sum = pageEl(root)
    const doneSegs = segments.filter((s) => done.includes(s.id))
    sum.innerHTML = `
      <h2 style="font-size:30px;margin:0 0 6px;font-weight:800">${esc(t('סיכום המסע'))}</h2>
      <div style="color:#6b7280;margin-bottom:18px">${esc(t('שביל ישראל'))} · ${esc(fmtDateLong(new Date()))}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
        ${[[num(stats.doneKm), t('ק"מ הושלמו'), `${pct}%`], [done.length, t('מקטעים'), `/ ${segments.length}`], [entries.length, t('רשומות'), `${photoIds.length} ${t('תמונות')}`], [stats.trackKm ? stats.trackKm.toFixed(1) : '–', t('ק"מ נמדדו ב-GPS'), stats.trackDays ? `${stats.trackDays} ${t('ימי הקלטה')}` : ''], [entries.reduce((a, e) => a + (Number(e.km) || 0), 0).toFixed(0), t('ק"מ ביומן'), ''], [num(stats.totalKm), t('ק"מ בשביל כולו'), '']].map(([v, l, s]) => `<div style="background:#f3f6fb;border-radius:14px;padding:14px"><div style="font-size:26px;font-weight:800;color:${NAVY}">${v}</div><div style="font-size:12px;color:#6b7280">${esc(l)}</div>${s ? `<div style="font-size:11px;color:#9aa3b5;margin-top:2px">${esc(s)}</div>` : ''}</div>`).join('')}
      </div>
      <div style="height:10px;background:#e9edf5;border-radius:999px;margin:22px 0 6px;overflow:hidden"><div style="width:${pct}%;height:100%;background:linear-gradient(90deg,${ORANGE},#ffb07a)"></div></div>
      <div style="font-size:12px;color:#6b7280">${esc(t('ההתקדמות שלי לאורך השביל'))} · ${pct}%</div>
      ${doneSegs.length ? `<h3 style="margin:24px 0 8px;font-size:17px">${esc(t('מקטעים שהושלמו'))} (${doneSegs.length})</h3>
      <div style="columns:2;column-gap:24px;font-size:12.5px;line-height:1.7">${doneSegs.map((s) => `<div style="break-inside:avoid">✓ ${s.id}. ${esc(tf(s, 'name'))} <span style="color:#9aa3b5">· ${s.distance_km} ${esc(t('ק"מ'))}</span></div>`).join('')}</div>` : ''}
      ${pct >= 100 ? `<div style="margin-top:26px;padding:18px;border-radius:16px;background:linear-gradient(135deg,#fff3e8,#ffe3cc);font-size:18px;font-weight:800;text-align:center">${esc(t('🏆 סיימתם את שביל ישראל! כל הכבוד.'))}</div>` : ''}`
    pages.push(sum)

    // ---- rasterise ----------------------------------------------------------------------------
    const pdf = new jsPDF({ unit: 'px', format: [W, H], orientation: 'portrait', hotfixes: ['px_scaling'], compress: true })
    root.style.opacity = '1' // html2canvas needs painted layout; the root is behind the app (z-index -1)
    for (let i = 0; i < pages.length; i++) {
      onProgress?.(i + 1, pages.length)
      if (i > 0) pages[i].insertAdjacentHTML('beforeend', footer(i + 1, pages.length))
      const canvas = await html2canvas(pages[i], { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false, width: W, height: H, windowWidth: W })
      if (i > 0) pdf.addPage([W, H], 'portrait')
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.86), 'JPEG', 0, 0, W, H)
    }
    return pdf.output('blob')
  } finally {
    root.remove()
  }
}

/** Shares the PDF (iOS/Android share sheet) or downloads it. */
export async function deliverPdf(blob, filename) {
  const file = new File([blob], filename, { type: 'application/pdf' })
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return 'shared' } catch (e) { if (e?.name === 'AbortError') return 'cancelled' }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.rel = 'noopener'; a.target = '_blank'
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
  return 'downloaded'
}
