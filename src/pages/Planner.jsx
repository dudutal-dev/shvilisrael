import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context.jsx'
import { Stat, Alert, Section, Modal } from '../components/UI.jsx'
import { Icon } from '../components/Icons.jsx'
import { DEFAULT_PLAN, buildItinerary } from '../lib/planner.js'
import { toISODate, fmtDate, fmtDateLong, HE_MONTHS } from '../lib/dates.js'
import { MONTHS, LEVEL_CLS, LEVEL_HE } from '../lib/season.js'
import { itineraryToICS } from '../lib/ics.js'
import { download } from '../lib/gpx.js'
import { useToast } from '../hooks/useToast.jsx'
import { fetchForecastMany, wmoText, dayVerdict } from '../lib/weather.js'
import { toISODate as iso } from '../lib/dates.js'

export default function Planner({ navigate }) {
  const { segments, plan, setPlan, journal } = useApp()
  const toast = useToast()
  const [draft, setDraft] = useState({ ...DEFAULT_PLAN, ...plan, startDate: plan.startDate || toISODate(new Date()) })
  const [showTable, setShowTable] = useState(!!plan.startDate)
  const [detail, setDetail] = useState(null)
  const preview = useMemo(() => (segments.length ? buildItinerary(segments, draft) : null), [segments, draft])
  const [wx, setWx] = useState({}) // day number -> {icon, tmax, tmin, rain, verdict}
  useEffect(() => {
    if (!preview || !showTable) return
    const horizon = Date.now() + 15 * 86400000
    const upcoming = preview.days.filter((d) => !d.rest && d.date >= new Date(new Date().toDateString()) && d.date <= horizon)
    if (!upcoming.length) { setWx({}); return }
    const pts = upcoming.map((d) => { const s = segments.find((x) => x.id === d.segments[0]); return { lat: s.start.lat, lon: s.start.lon } })
    let alive = true
    fetchForecastMany(pts, 16).then((res) => {
      if (!alive) return
      const out = {}
      upcoming.forEach((d, i) => {
        const dd = res[i]?.daily; if (!dd) return
        const j = dd.time.indexOf(iso(d.date)); if (j < 0) return
        const v = dayVerdict({ tmax: dd.temperature_2m_max[j], rainMm: dd.precipitation_sum[j], rainProb: dd.precipitation_probability_max[j], windMax: dd.wind_speed_10m_max[j], code: dd.weather_code[j] }, d.group)
        out[d.day] = { icon: wmoText(dd.weather_code[j])[1], tmax: Math.round(dd.temperature_2m_max[j]), tmin: Math.round(dd.temperature_2m_min[j]), rain: dd.precipitation_probability_max[j], v }
      })
      setWx(out)
    }).catch(() => {})
    return () => { alive = false }
  }, [preview?.summary.startDate?.getTime(), preview?.days.length, showTable, draft.direction]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }))
  const sorted = [...segments].sort((a, b) => a.id - b.id)
  const startMonth = new Date(draft.startDate).getMonth()

  const savePlan = () => { setPlan(draft); setShowTable(true); toast('התוכנית נשמרה במכשיר ✓'); document.getElementById('content')?.scrollTo({ top: 0, behavior: 'smooth' }) }
  const measuredPace = useMemo(() => { const k = journal.map((e) => parseFloat(e.km)).filter((x) => x > 0); return k.length ? Math.round(k.reduce((a, b) => a + b, 0) / k.length) : null }, [journal])
  const cacheMessage = () => {
    if (!preview?.caches?.length) return
    const lines = preview.caches.map((c) => `• יום ${c.day} · ${fmtDate(c.date)} – ${c.title} → לינה: ${c.overnight}`)
    const msg = `שלום, אשמח להזמין הטמנות מים לשביל ישראל (${draft.direction === 'sobo' ? 'צפון→דרום' : 'דרום→צפון'}).\nנקודות ותאריכים:\n${lines.join('\n')}\nכמות: ___ ליטר לנקודה עבור ___ מטיילים.\nתודה!`
    navigator.clipboard?.writeText(msg); toast('הודעת הזמנת הטמנות הועתקה – שלחו לספק')
  }
  const exportIcs = () => { download('shvil-israel.ics', itineraryToICS(preview.days), 'text/calendar'); toast('קובץ יומן הורד') }
  const exportText = async () => {
    const t = preview.days.map((d) => `יום ${d.day} · ${fmtDate(d.date)} · ${d.rest ? 'מנוחה' : `${d.title} · ${d.km} ק"מ · לינה: ${d.overnight}`}`).join('\n')
    const head = `שביל ישראל – תוכנית מסע\n${fmtDate(preview.summary.startDate)} → ${fmtDate(preview.summary.endDate)} · ${preview.summary.days} ימים · ${preview.summary.totalKm} ק"מ\n\n`
    if (navigator.share) { try { await navigator.share({ title: 'תוכנית שביל ישראל', text: head + t }); return } catch { /* cancelled */ } }
    await navigator.clipboard?.writeText(head + t); toast('התוכנית הועתקה ללוח')
  }

  return (
    <div className="page stack">
      <h2 className="section-title"><Icon name="plan" />תכנון המסע</h2>

      <div className="card stack">
        <div className="field">
          <label>כיוון ההליכה</label>
          <div className="segmented">
            <button className={draft.direction === 'sobo' ? 'active' : ''} onClick={() => set('direction', 'sobo')}>צפון → דרום (חרמון → אילת)</button>
            <button className={draft.direction === 'nobo' ? 'active' : ''} onClick={() => set('direction', 'nobo')}>דרום → צפון (אילת → חרמון)</button>
          </div>
          <p className="tiny muted">{draft.direction === 'sobo' ? 'מומלץ לצאת באוקטובר–נובמבר: הצפון עוד יבש, ומגיעים לנגב בחורף הנעים.' : 'מומלץ לצאת בפברואר–מרץ: חוצים את הנגב לפני החום ומגיעים לצפון הפורח באביב.'}</p>
        </div>
        <div className="grid-2">
          <div className="field"><label>תאריך יציאה</label><input className="input" type="date" value={draft.startDate} onChange={(e) => set('startDate', e.target.value)} /></div>
          <div className="field"><label>סגנון לינה מועדף</label>
            <select className="select" value={draft.lodging} onChange={(e) => set('lodging', e.target.value)}>
              <option value="mixed">משולב (מלאכים + אוהל + מדי פעם בתשלום)</option>
              <option value="tent">אוהל / חניוני לילה</option>
              <option value="angels">מלאכי שביל</option>
              <option value="paid">לינה בתשלום (אכסניות/צימרים)</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>קצב יומי: <b>{draft.dailyKm} ק"מ</b> ליום <span className="muted tiny">(מתחילים: 15–18 · מנוסים: 20–25 · מהירים: 28+)</span></label>
          <input className="range" type="range" min={10} max={40} step={1} value={draft.dailyKm} onChange={(e) => set('dailyKm', Number(e.target.value))} />
        </div>
        <div className="field">
          <label>מקסימום ליום (פיצול מקטעים ארוכים): <b>{draft.maxDailyKm} ק"מ</b></label>
          <input className="range" type="range" min={15} max={45} step={1} value={draft.maxDailyKm} onChange={(e) => set('maxDailyKm', Number(e.target.value))} />
        </div>
        <div className="grid-2">
          <div className="field"><label>יום מנוחה כל</label>
            <select className="select" value={draft.restEvery} onChange={(e) => set('restEvery', Number(e.target.value))}>
              <option value={0}>ללא ימי מנוחה</option>{[4, 5, 6, 7, 8, 10].map((n) => <option key={n} value={n}>{n} ימי הליכה</option>)}
            </select>
          </div>
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <label className="switch"><input type="checkbox" checked={draft.restOnShabbat} onChange={(e) => set('restOnShabbat', e.target.checked)} /> לא הולכים בשבת</label>
          </div>
        </div>
        <div className="grid-2">
          <div className="field"><label>ממקטע</label>
            <select className="select" value={draft.fromId ?? ''} onChange={(e) => set('fromId', e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">תחילת השביל</option>{sorted.map((s) => <option key={s.id} value={s.id}>{s.id}. {s.name_he}</option>)}
            </select>
          </div>
          <div className="field"><label>עד מקטע</label>
            <select className="select" value={draft.toId ?? ''} onChange={(e) => set('toId', e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">סוף השביל</option>{sorted.map((s) => <option key={s.id} value={s.id}>{s.id}. {s.name_he}</option>)}
            </select>
          </div>
        </div>
        {measuredPace && measuredPace !== draft.dailyKm && <Alert kind="info">הקצב הממוצע שלכם לפי היומן הוא <b>{measuredPace} ק"מ/יום</b>. <button className="linkbtn" onClick={() => set('dailyKm', measuredPace)}>עדכנו את התוכנית לפי הקצב האמיתי ←</button></Alert>}
        <SeasonStrip month={startMonth} days={preview?.summary.days || 50} />
        <button className="btn btn--primary btn--block" onClick={savePlan}>שמירת התוכנית ובניית לו"ז</button>
      </div>

      {preview && (
        <>
          <div className="grid-3">
            <Stat value={preview.summary.days} label="ימים סה״כ" />
            <Stat value={preview.summary.totalKm} label='ק"מ' />
            <Stat value={preview.summary.avgKm} label='ממוצע ק"מ/יום' />
            <Stat value={preview.summary.walkingDays} label="ימי הליכה" />
            <Stat value={preview.summary.restDays} label="ימי מנוחה" />
            <Stat value={`₪${preview.summary.budget.toLocaleString()}`} label="תקציב משוער" />
          </div>
          <p className="small muted center">סיום משוער: <b>{fmtDateLong(preview.summary.endDate)}</b>{preview.summary.cacheDays ? ` · ${preview.summary.cacheDays} ימים עם הטמנת מים` : ''}</p>
          {preview.caches?.length > 0 && (
            <div className="card card--glow">
              <div className="card__title"><Icon name="water" />תכנון הטמנות מים ({preview.caches.length} ימים)</div>
              <div className="stack" style={{ gap: 4 }}>{preview.caches.map((c) => <div key={c.day} className="small">💧 יום {c.day} · {fmtDate(c.date)} – {c.overnight}</div>)}</div>
              <div className="row mt" style={{ gap: 6 }}><button className="btn btn--sm btn--primary" onClick={cacheMessage}>📋 הודעת הזמנה לספק הטמנות</button><button className="btn btn--sm" onClick={() => navigate('guide/water')}>ספקי הטמנה ←</button></div>
            </div>
          )}
          {preview.summary.seasonIssues > 0 && <Alert kind="danger" icon="warn"><b>{preview.summary.seasonIssues} ימים נופלים בעונה מסוכנת/קשה</b> (חום קיצוני בנגב או שרב). שקלו להזיז את תאריך היציאה או להפוך כיוון. פרטים בטבלה למטה.</Alert>}

          <Section title="לוח זמנים יומי" action={<div className="row" style={{ gap: 6 }}><button className="btn btn--sm" onClick={exportIcs}>📅 ליומן</button><button className="btn btn--sm" onClick={exportText}><Icon name="share" size={16} /></button><button className="btn btn--sm no-print" onClick={() => window.print()}>🖨️</button></div>}>
            {!showTable && <button className="btn btn--block mb" onClick={() => setShowTable(true)}>הצגת תצוגה מקדימה של {preview.days.length} ימים</button>}
            {showTable && Object.keys(wx).length > 0 && <p className="tiny muted mb">🌤️ תחזית חיה (Open-Meteo) מוצגת לימים שבטווח 16 הימים הקרובים, לפי נקודת ההתחלה של כל יום.</p>}
            {showTable && (
              <div className="timeline">
                {preview.days.map((d) => (
                  <div key={d.day} className={`tl-item ${d.rest ? 'rest' : ''}`} onClick={() => !d.rest && setDetail(d)} style={{ cursor: d.rest ? 'default' : 'pointer' }}>
                    <div className="row between">
                      <div><span className="tiny muted">יום {d.day} · {fmtDate(d.date)}{d.shabbat ? ' · שבת' : ''}</span><div className="bold">{d.rest ? '😌 יום מנוחה' : d.title}</div></div>
                      {!d.rest && <div className="seg__km">{d.km}<small> ק"מ</small></div>}
                    </div>
                    {!d.rest && <div className="small muted">🛏 {d.overnight}</div>}
                    {wx[d.day] && <div className="row" style={{ gap: 6, marginTop: 2 }}><span className={`wx-pill ${wx[d.day].v.cls}`}>{wx[d.day].icon} {wx[d.day].tmax}°/{wx[d.day].tmin}°{wx[d.day].rain > 15 ? ` ☔${wx[d.day].rain}%` : ''} · {wx[d.day].v.label}</span>{wx[d.day].v.flags[0] && <span className="tiny muted">{wx[d.day].v.flags[0].t}</span>}</div>}
                    {d.notes?.filter((n) => n.startsWith('סכנת') || n.startsWith('חם') || n.startsWith('חום') || n.includes('הטמנת') || n.includes('שטח אש')).slice(0, 2).map((n, i) => <div key={i} className="tiny" style={{ color: n.startsWith('סכנת') ? 'var(--red)' : 'var(--orange)' }}>⚠ {n}</div>)}
                  </div>
                ))}
              </div>
            )}
          </Section>
        </>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `יום ${detail.day}: ${detail.title}` : ''}>
        {detail && (
          <div className="stack small">
            <div className="muted">{fmtDateLong(detail.date)} · {detail.km} ק"מ · כ-{detail.hours} שעות · {detail.region}</div>
            <div><b>לינה:</b> {detail.overnight}</div>
            {detail.notes?.length > 0 && <div><b>דגשים:</b><ul>{detail.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></div>}
            <div className="row">{detail.segments.map((id) => <button key={id} className="btn btn--sm" onClick={() => navigate(`segments/${id}`)}>מקטע {id} ←</button>)}</div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function SeasonStrip({ month, days }) {
  const span = Math.min(12, Math.ceil(days / 30) + 1)
  return (
    <div>
      <div className="tiny muted mb">התאמת העונה לאורך המסע (לפי חודש יציאה):</div>
      {[['north', 'צפון'], ['center', 'מרכז'], ['negev', 'נגב']].map(([g, n]) => (
        <div key={g} className="row mb" style={{ gap: 4 }}>
          <span className="tiny" style={{ width: 36 }}>{n}</span>
          {Array.from({ length: 12 }).map((_, i) => {
            const m = (month + i) % 12
            const lvl = MONTHS[g][m]
            return <div key={i} className={`month-cell ${LEVEL_CLS[lvl]}`} title={`${HE_MONTHS[m]}: ${LEVEL_HE[lvl]}`} style={{ flex: 1, opacity: i < span ? 1 : 0.25, aspectRatio: 'auto', height: 20, fontSize: 9 }}>{HE_MONTHS[m].slice(0, 3)}</div>
          })}
        </div>
      ))}
    </div>
  )
}
