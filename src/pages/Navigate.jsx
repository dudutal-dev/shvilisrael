import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../context.jsx'
import { Alert, Stat } from '../components/UI.jsx'
import { Icon } from '../components/Icons.jsx'
import { useCompass } from '../hooks/useCompass.js'
import { useGeolocation } from '../hooks/useGeolocation.js'
import { bearing, haversine, compassLabelLong, formatKm, toDM, navLinks, formatCoord } from '../lib/geo.js'
import { sunTimes, fmtTime } from '../lib/sun.js'
import { useToast } from '../hooks/useToast.jsx'
import logistics from '../data/logistics.json'
import lodging from '../data/lodging.json'

export default function Navigate() {
  const { segments, plan, itinerary } = useApp()
  const toast = useToast()
  const { heading, status, request } = useCompass()
  const [gpsOn, setGpsOn] = useState(true)
  const { pos, error } = useGeolocation(gpsOn)
  const [targetKey, setTargetKey] = useState('')
  const [track, setTrack] = useState(() => ({ on: false, km: 0, start: null, last: null }))
  const wake = useRef(null)

  const targets = useMemo(() => {
    const out = []
    const sorted = [...segments].sort((a, b) => a.id - b.id)
    sorted.forEach((s) => { if (s.start?.lat) out.push({ key: `s${s.id}`, name: `תחילת מקטע ${s.id}: ${s.start.name_he}`, lat: s.start.lat, lon: s.start.lon }) })
    const last = sorted[sorted.length - 1]
    if (last?.end?.lat) out.push({ key: 'end', name: `סיום השביל: ${last.end.name_he}`, lat: last.end.lat, lon: last.end.lon })
    for (const c of lodging.night_camps || []) if (c.lat) out.push({ key: `c${c.name_he}`, name: `⛺ ${c.name_he}`, lat: c.lat, lon: c.lon })
    return out
  }, [segments])

  // auto-pick next waypoint in walking direction
  useEffect(() => {
    if (targetKey || !pos || !segments.length) return
    const sorted = [...segments].sort((a, b) => a.id - b.id)
    const pts = sorted.map((s) => ({ key: `s${s.id}`, lat: s.start.lat, lon: s.start.lon, id: s.id }))
    let bestI = 0, bestD = Infinity
    pts.forEach((p, i) => { const d = haversine(pos, p); if (d < bestD) { bestD = d; bestI = i } })
    const nextI = plan.direction === 'nobo' ? Math.max(0, bestI - 1) : Math.min(pts.length - 1, bestI + 1)
    setTargetKey(pts[nextI]?.key || '')
  }, [pos, segments, plan.direction, targetKey])

  const target = targets.find((t) => t.key === targetKey)
  const brg = pos && target ? bearing(pos, target) : null
  const dist = pos && target ? haversine(pos, target) : null
  const rel = brg != null && heading != null ? (brg - heading + 360) % 360 : null
  const sun = useMemo(() => sunTimes(new Date(), pos?.lat ?? 31.5, pos?.lon ?? 34.9), [pos?.lat, pos?.lon])
  const hoursLeft = sun.sunset ? Math.max(0, (sun.sunset - Date.now()) / 3600000) : null

  // simple odometer from GPS fixes
  useEffect(() => {
    if (!track.on || !pos) return
    setTrack((t) => {
      if (!t.last) return { ...t, last: pos, start: t.start || Date.now() }
      const d = haversine(t.last, pos)
      if (d < 0.004 || pos.accuracy > 60) return t // ignore jitter
      return { ...t, km: t.km + d, last: pos }
    })
  }, [pos]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleWake = async () => {
    try {
      if (wake.current) { await wake.current.release(); wake.current = null; toast('המסך יכול לכבות') }
      else { wake.current = await navigator.wakeLock.request('screen'); toast('המסך יישאר דולק') }
    } catch { toast('המכשיר לא תומך בנעילת מסך') }
  }
  const elapsed = track.start ? (Date.now() - track.start) / 3600000 : 0
  const isPhone = (n) => /^[\d\-*#\s/]+$/.test(n)
  const em = (logistics.emergency_contacts || []).filter((c) => isPhone(c.number))

  return (
    <div className="page stack">
      <h2 className="section-title"><Icon name="compass" />מצפן וניווט</h2>

      {status === 'idle' && <button className="btn btn--primary btn--block" onClick={request}>הפעלת המצפן (נדרש אישור חיישנים)</button>}
      {status === 'denied' && <Alert kind="warn">אין הרשאה לחיישני התנועה. ב-iPhone: הגדרות ← Safari ← Motion & Orientation.</Alert>}
      {status === 'unsupported' && <Alert kind="warn">המכשיר לא תומך במצפן. כיוון ההליכה יחושב מ-GPS בתנועה.</Alert>}

      <div className="card">
        <Compass heading={heading ?? (pos?.heading ?? 0)} targetRel={rel} />
        <div className="center mt">
          <div className="small muted">{heading != null ? 'כיוון המכשיר' : pos?.heading != null ? 'כיוון תנועה (GPS)' : 'ממתין לחיישנים…'}</div>
          {brg != null && <div className="small">אזימוט ליעד: <b className="mono">{Math.round(brg)}°</b> {compassLabelLong(brg)} · מרחק אווירי <b>{formatKm(dist)}</b></div>}
        </div>
        <div className="field mt">
          <label>יעד לניווט</label>
          <select className="select" value={targetKey} onChange={(e) => setTargetKey(e.target.value)}>
            <option value="">בחרו יעד…</option>
            {targets.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card__title row between"><span className="row"><Icon name="pin" />GPS</span><label className="switch"><input type="checkbox" checked={gpsOn} onChange={(e) => setGpsOn(e.target.checked)} /></label></div>
        {error && <Alert kind="warn">{error}</Alert>}
        {pos ? (
          <div className="stack small">
            <div className="row between"><span className="muted">מעלות עשרוניות</span><span className="mono ltr">{formatCoord(pos.lat, pos.lon)}</span></div>
            <div className="row between"><span className="muted">מעלות ודקות (לחילוץ)</span><span className="mono ltr">{toDM(pos.lat, pos.lon)}</span></div>
            <div className="grid-3">
              <Stat value={`±${Math.round(pos.accuracy)}`} label="דיוק (מ')" />
              <Stat value={pos.altitude != null ? Math.round(pos.altitude) : '–'} label="גובה (מ')" />
              <Stat value={pos.speed ? (pos.speed * 3.6).toFixed(1) : '0'} label='קמ"ש' />
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn--sm" onClick={() => { navigator.clipboard?.writeText(`${pos.lat.toFixed(6)}, ${pos.lon.toFixed(6)}`); toast('הקואורדינטות הועתקו') }}>העתקה</button>
              <a className="btn btn--sm btn--blue" href={navLinks(pos.lat, pos.lon, 'שביל ישראל').whatsapp} target="_blank" rel="noreferrer">שיתוף מיקום ב-WhatsApp</a>
              <a className="btn btn--sm" href={navLinks(pos.lat, pos.lon).ihm} target="_blank" rel="noreferrer">IHM</a>
              <a className="btn btn--sm btn--primary" href={`https://wa.me/?text=${encodeURIComponent(checkinText(pos, itinerary, segments))}`} target="_blank" rel="noreferrer">✅ צ'ק-אין יומי למשפחה</a>
            </div>
          </div>
        ) : <p className="small muted">{gpsOn ? 'מחפש לוויינים… (בחוץ, עם שמיים פתוחים, זה לוקח עד דקה)' : 'ה-GPS כבוי'}</p>}
      </div>

      <div className="card">
        <div className="card__title"><Icon name="sun" />אור יום</div>
        <div className="grid-3">
          <Stat value={fmtTime(sun.sunrise)} label="זריחה" />
          <Stat value={fmtTime(sun.sunset)} label="שקיעה" />
          <Stat value={hoursLeft != null ? `${hoursLeft.toFixed(1)}` : '–'} label="שעות אור שנותרו" />
        </div>
        {hoursLeft != null && hoursLeft < 2 && hoursLeft > 0 && <Alert kind="warn" icon="warn">פחות משעתיים אור – מומלץ להגיע ללינה. בשטח פתוח מתקררים מהר אחרי השקיעה.</Alert>}
        <p className="tiny muted mt">אורך היום: {sun.dayLength.toFixed(1)} שעות. בנגב בחורף: לצאת עם הזריחה כדי לנצל את כל האור.</p>
      </div>

      <div className="card">
        <div className="card__title row between"><span className="row"><Icon name="route" />מד מרחק יומי</span>
          <div className="row" style={{ gap: 6 }}>
            <button className={`btn btn--sm ${track.on ? 'btn--danger' : 'btn--primary'}`} onClick={() => setTrack((t) => ({ ...t, on: !t.on, start: t.start || Date.now() }))}>{track.on ? 'עצור' : 'התחל'}</button>
            <button className="btn btn--sm btn--ghost" onClick={() => setTrack({ on: false, km: 0, start: null, last: null })}>איפוס</button>
          </div>
        </div>
        <div className="grid-3">
          <Stat value={track.km.toFixed(2)} label='ק"מ שנצעדו' />
          <Stat value={elapsed ? `${Math.floor(elapsed)}:${String(Math.round((elapsed % 1) * 60)).padStart(2, '0')}` : '0:00'} label="זמן" />
          <Stat value={elapsed > 0.05 ? (track.km / elapsed).toFixed(1) : '–'} label='קצב קמ"ש' />
        </div>
        <button className="btn btn--sm btn--ghost mt" onClick={toggleWake}>🔆 השאר מסך דולק</button>
      </div>

      <div className="card" style={{ borderColor: 'var(--red)' }}>
        <div className="card__title" style={{ color: 'var(--red)' }}><Icon name="phone" />חירום</div>
        <div className="grid-2">
          {(em.length ? em : [{ name_he: 'משטרה', number: '100' }, { name_he: 'מד"א', number: '101' }, { name_he: 'כבאות', number: '102' }, { name_he: 'רשות הטבע והגנים', number: '*3639' }]).map((c) => (
            <a key={c.number} className="btn" href={`tel:${c.number.replace('*', '%2A')}`}><b className="ltr">{c.number}</b> {c.name_he}</a>
          ))}
        </div>
        <p className="tiny muted mt">בחירום: מסרו מיקום במעלות ודקות (למעלה), תיאור המקטע ומספר ההולכים. חייגו 100 גם כשאין קליטה לרשת שלכם – שיחות חירום עוברות בכל רשת.</p>
      </div>
    </div>
  )
}

function checkinText(pos, itinerary, segments) {
  const today = itinerary?.days.find((d) => d.date.toDateString() === new Date().toDateString())
  const tomorrow = itinerary?.days.find((d) => d.date.toDateString() === new Date(Date.now() + 86400000).toDateString())
  const n = nearestSeg(pos, segments)
  return [`✅ צ'ק-אין משביל ישראל – ${new Date().toLocaleDateString('he-IL')}`, `אני בסדר! מיקומי: https://maps.google.com/?q=${pos.lat.toFixed(5)},${pos.lon.toFixed(5)}`, n ? `באזור ${n}` : '', today ? `היום: ${today.rest ? 'יום מנוחה' : today.title} (${today.km} ק"מ) · לינה: ${today.overnight}` : '', tomorrow ? `מחר: ${tomorrow.rest ? 'יום מנוחה' : tomorrow.title}` : '', 'צ\'ק-אין הבא מחר בערב 🙂'].filter(Boolean).join('\n')
}
function nearestSeg(pos, segments) {
  let best = null
  for (const s of segments) { if (!s.start?.lat) continue; const d = haversine(pos, s.start); if (!best || d < best.d) best = { d, s } }
  return best ? `מקטע ${best.s.id} (${best.s.name_he})` : ''
}

function Compass({ heading = 0, targetRel }) {
  const ticks = Array.from({ length: 72 })
  return (
    <div className="compass">
      <svg className="compass__dial" viewBox="0 0 200 200" style={{ transform: `rotate(${-heading}deg)` }}>
        <circle cx="100" cy="100" r="96" fill="var(--surface-2)" stroke="var(--border)" strokeWidth="2" />
        {ticks.map((_, i) => {
          const a = (i * 5 * Math.PI) / 180, big = i % 18 === 0, mid = i % 6 === 0
          const r1 = big ? 78 : mid ? 84 : 88
          return <line key={i} x1={100 + r1 * Math.sin(a)} y1={100 - r1 * Math.cos(a)} x2={100 + 94 * Math.sin(a)} y2={100 - 94 * Math.cos(a)} stroke={big ? 'var(--text)' : 'var(--muted)'} strokeWidth={big ? 3 : 1.2} />
        })}
        {[['N', 0, '#c53030'], ['E', 90, 'var(--text)'], ['S', 180, 'var(--text)'], ['W', 270, 'var(--text)']].map(([l, a, c]) => (
          <text key={l} x={100 + 64 * Math.sin((a * Math.PI) / 180)} y={100 - 64 * Math.cos((a * Math.PI) / 180) + 7} textAnchor="middle" fontSize="20" fontWeight="800" fill={c}>{l}</text>
        ))}
        {[30, 60, 120, 150, 210, 240, 300, 330].map((a) => (
          <text key={a} x={100 + 64 * Math.sin((a * Math.PI) / 180)} y={100 - 64 * Math.cos((a * Math.PI) / 180) + 4} textAnchor="middle" fontSize="10" fill="var(--muted)">{a}</text>
        ))}
        <polygon points="100,14 94,30 106,30" fill="#c53030" />
      </svg>
      {targetRel != null && (
        <svg className="compass__needle" viewBox="0 0 200 200" style={{ position: 'absolute', inset: 0, transform: `rotate(${targetRel}deg)`, transition: 'transform 0.15s ease-out' }}>
          <polygon points="100,22 90,60 100,52 110,60" fill="#f26b1d" stroke="#fff" strokeWidth="1.5" />
        </svg>
      )}
      <div className="compass__center">
        <div className="compass__heading">{Math.round(heading)}°</div>
        <div className="compass__sub">{compassLabelLong(heading)}</div>
        {targetRel != null && <div className="tiny" style={{ color: 'var(--orange)', fontWeight: 700 }}>▲ היעד</div>}
      </div>
      <div style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '9px solid transparent', borderRight: '9px solid transparent', borderTop: '14px solid var(--orange)' }} />
    </div>
  )
}
