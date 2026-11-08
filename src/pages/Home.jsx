import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context.jsx'
import { Photo, getPhoto } from '../components/Photo.jsx'
import { Section } from '../components/UI.jsx'
import { Icon } from '../components/Icons.jsx'
import { fmtDate, HE_MONTHS } from '../lib/dates.js'
import { MONTHS, LEVEL_CLS, LEVEL_HE } from '../lib/season.js'
import { fetchForecast, wmoText, heatRisk } from '../lib/weather.js'
import { useGeolocation } from '../hooks/useGeolocation.js'
import { nearest } from '../lib/geo.js'
import { sunTimes, fmtTime } from '../lib/sun.js'

const QUICK = [
  ['map', '🗺️', 'מפה חיה'], ['nav', '🧭', 'מצפן'], ['guide/angels', '😇', 'מלאכי שביל'],
  ['guide/lodging', '⛺', 'לינה'], ['guide/water', '💧', 'מים'], ['guide/gear', '🎒', 'ציוד'],
  ['guide/safety', '🆘', 'בטיחות'], ['journal', '📓', 'יומן'], ['guide/faq', '❓', 'שאלות'],
]

export default function Home({ navigate }) {
  const { segments, meta, itinerary, done, totalKm, doneKm, plan, angels } = useApp()
  const today = new Date()
  const todayDay = itinerary?.days.find((d) => d.date.toDateString() === today.toDateString())
  const nextDay = itinerary?.days.find((d) => d.date >= today && !d.rest)
  const tomorrow = itinerary?.days.find((d) => d.date.toDateString() === new Date(today.getTime() + 86400000).toDateString())
  const pct = totalKm ? Math.round((doneKm / totalKm) * 100) : 0
  const month = today.getMonth()
  const daysToStart = plan.startDate ? Math.ceil((new Date(plan.startDate) - today) / 86400000) : null
  const sorted = useMemo(() => [...segments].sort((a, b) => a.id - b.id), [segments])
  const changes = (meta.recent_changes || []).slice(-3).reverse()
  const needsAngel = tomorrow && !tomorrow.rest && /מלאכ/.test(tomorrow.overnight || '') && !angels.some((a) => tomorrow.segments.includes(Number(a.segId)))

  return (
    <div className="page stack">
      <div className="hero">
        <Photo photoKey="hero" credit={false} style={{ position: 'absolute', inset: 0, aspectRatio: 'auto', borderRadius: 0 }} />
        <div className="hero__overlay" />
        <div className="hero__content">
          <span className="hero__kicker"><span className="blaze" style={{ width: 10, height: 16 }}><span className="w" /><span className="b" /><span className="o" /></span> מהחרמון ועד אילת</span>
          <h1>שביל ישראל</h1>
          <p>מסע של {Math.round(totalKm).toLocaleString()} ק"מ ב-{segments.length} מקטעים · מתכנן, מפה חיה ומלווה בשטח</p>
          <div className="hero__stats">
            <div><b>{Math.round(totalKm).toLocaleString()}</b><span>ק"מ</span></div>
            <div><b>{segments.length}</b><span>מקטעים</span></div>
            <div><b>{pct}%</b><span>הושלם</span></div>
            {daysToStart != null && daysToStart > 0 && <div><b>{daysToStart}</b><span>ימים ליציאה</span></div>}
          </div>
        </div>
      </div>

      {/* trail strip: one bar per segment */}
      <div className="card" style={{ padding: 12 }}>
        <div className="row between mb"><span className="bold small">ההתקדמות שלי לאורך השביל</span><span className="tiny muted">{plan.direction === 'nobo' ? 'אילת ← חרמון' : 'חרמון ← אילת'}</span></div>
        <div className="trail-strip" style={{ direction: 'ltr' }}>
          {(plan.direction === 'nobo' ? [...sorted].reverse() : sorted).map((s) => <div key={s.id} className={`${done.includes(s.id) ? 'done' : ''} ${todayDay?.segments?.includes(s.id) ? 'today' : ''}`} title={`${s.id}. ${s.name_he}`} style={{ height: `${8 + Math.min(20, s.distance_km * 0.7)}px` }} onClick={() => navigate(`segments/${s.id}`)} />)}
        </div>
      </div>

      {itinerary ? (
        <div className="card today-card">
          <div className="row between">
            <div className="card__title" style={{ marginBottom: 4 }}><Icon name="plan" />המסע שלי</div>
            <span className="tiny" style={{ opacity: 0.85 }}>{fmtDate(itinerary.summary.startDate)} → {fmtDate(itinerary.summary.endDate)}</span>
          </div>
          {todayDay ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{todayDay.rest ? 'יום מנוחה 😌' : todayDay.title}</div>
              {!todayDay.rest && <div className="small" style={{ opacity: 0.9 }}>יום {todayDay.day} · {todayDay.km} ק"מ · כ-{todayDay.hours} שעות · 🛏 {todayDay.overnight}</div>}
              {todayDay.notes?.slice(0, 2).map((n, i) => <div key={i} className="small" style={{ color: '#ffd4b8', marginTop: 4 }}>⚠ {n}</div>)}
            </>
          ) : nextDay ? (
            <div className="mt">היום הבא במסלול: <b>{nextDay.title}</b><div className="small" style={{ opacity: 0.85 }}>{fmtDate(nextDay.date)} · {nextDay.km} ק"מ</div></div>
          ) : <div className="mt">המסע הסתיים 🏆</div>}
          {needsAngel && <div className="alert alert--warn mt small" style={{ background: 'rgba(255,255,255,0.12)', borderColor: '#ffb07a', color: '#fff' }}>😇 מחר לינה אצל מלאכי שביל ({tomorrow.overnight}) – עדיין אין איש קשר. תאמו היום!</div>}
          <div className="row mt" style={{ gap: 8 }}>
            <button className="btn btn--primary btn--sm" onClick={() => navigate('plan')}>לתוכנית המלאה</button>
            {todayDay && !todayDay.rest && <button className="btn btn--sm" onClick={() => navigate(`segments/${todayDay.segments[0]}`)}>פרטי המקטע</button>}
            <button className="btn btn--sm" onClick={() => navigate('map')}>מפה חיה</button>
          </div>
        </div>
      ) : (
        <div className="card today-card">
          <div className="card__title">עוד לא תכננתם מסע?</div>
          <p className="small" style={{ opacity: 0.92 }}>בחרו כיוון, תאריך וקצב – ותקבלו לו"ז יומי עם לינה, מים, מלאכי שביל ואזהרות עונתיות. הכול נשמר במכשיר.</p>
          <button className="btn btn--primary mt" onClick={() => navigate('plan')}>בואו נתכנן 🥾</button>
        </div>
      )}

      <div className="quick">
        {QUICK.map(([to, ico, t]) => <button key={to} className="quick__btn" onClick={() => navigate(to)}><span className="quick__ico">{ico}</span>{t}</button>)}
      </div>

      <WeatherCard segments={segments} />

      <Section title="העונה עכשיו" icon="sun" action={<button className="linkbtn small" onClick={() => navigate('guide/seasons')}>לטבלה המלאה ←</button>}>
        <div className="grid-3">
          {[['north', 'צפון'], ['center', 'מרכז'], ['negev', 'נגב']].map(([g, name]) => (
            <div key={g} className="stat" style={{ padding: 8 }}>
              <div className={`month-cell ${LEVEL_CLS[MONTHS[g][month]]}`} style={{ aspectRatio: 'auto', padding: '6px 0', marginBottom: 6, fontSize: 13 }}>{LEVEL_HE[MONTHS[g][month]]}</div>
              <div className="stat__label">{name} · {HE_MONTHS[month]}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="נופים מהשביל" icon="camera">
        <div className="ticker">
          {['mount_meron', 'arbel', 'nahal_mearot', 'ein_kerem', 'ein_avdat', 'makhtesh_ramon', 'karbolet', 'timna', 'red_canyon'].map((k) => {
            const p = getPhoto(k)
            return <div key={k} className="photo-card" onClick={() => { const s = segments.find((x) => x.photo === k); if (s) navigate(`segments/${s.id}`) }}><Photo photoKey={k} credit={false} /><div className="photo-card__label">{p?.place_he}</div></div>
          })}
        </div>
      </Section>

      {changes.length > 0 && (
        <Section title="עדכוני תוואי אחרונים" icon="flag">
          {changes.map((c, i) => <div key={i} className="news"><b>{c.when}</b> – {c.what}</div>)}
          <p className="tiny muted mt">לפני היציאה בדקו הודעות עדכניות באתר החברה להגנת הטבע ורשות הטבע והגנים.</p>
        </Section>
      )}
      <p className="tiny muted">המידע באפליקציה נאסף ממקורות ציבוריים ואינו תחליף למפות ולהנחיות הרשמיות. בטיחות קודמת לכול.</p>
    </div>
  )
}

function WeatherCard({ segments }) {
  const { pos } = useGeolocation(true, { enableHighAccuracy: false, maximumAge: 600000 })
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [place, setPlace] = useState(null)
  useEffect(() => {
    const target = pos || { lat: 31.78, lon: 35.2 }
    const n = nearest(target, segments.filter((s) => s.start?.lat).map((s) => ({ ...s.start, seg: s })))
    setPlace(pos ? (n ? `ליד ${n.point.name_he}` : 'מיקומך') : 'ירושלים (ברירת מחדל)')
    fetchForecast(target.lat, target.lon, 4).then(setData).catch(() => setErr('אין חיבור לשרת מזג האוויר'))
  }, [pos?.lat != null, segments]) // eslint-disable-line react-hooks/exhaustive-deps
  const sun = sunTimes(new Date(), pos?.lat ?? 31.78, pos?.lon ?? 35.2)
  if (err) return null
  if (!data) return <div className="card small muted">טוען תחזית…</div>
  const c = data.current, d = data.daily
  const risk = heatRisk(c.apparent_temperature, c.uv_index)
  return (
    <div className="card">
      <div className="row between">
        <div className="card__title" style={{ marginBottom: 0 }}>{wmoText(c.weather_code)[1]} מזג אוויר <span className="small muted">· {place}</span></div>
        <span className="tiny muted">🌅 {fmtTime(sun.sunrise)} · 🌇 {fmtTime(sun.sunset)}</span>
      </div>
      <div className="row mt"><span className="gauge">{Math.round(c.temperature_2m)}°</span><span className="small muted">מורגש {Math.round(c.apparent_temperature)}° · רוח {Math.round(c.wind_speed_10m)} קמ"ש · UV {c.uv_index} · לחות {c.relative_humidity_2m}%</span></div>
      {risk && <div className={`alert ${risk.cls} mt small`}>{risk.label}</div>}
      <div className="row mt" style={{ gap: 6 }}>
        {d.time.map((t, i) => (
          <div key={t} className="stat" style={{ flex: 1, padding: '6px 4px' }}>
            <div className="tiny muted">{i === 0 ? 'היום' : new Date(t).toLocaleDateString('he-IL', { weekday: 'short' })}</div>
            <div>{wmoText(d.weather_code[i])[1]}</div>
            <div className="small"><b>{Math.round(d.temperature_2m_max[i])}°</b> / {Math.round(d.temperature_2m_min[i])}°</div>
            {d.precipitation_probability_max[i] > 20 && <div className="tiny" style={{ color: 'var(--primary)' }}>☔ {d.precipitation_probability_max[i]}%</div>}
          </div>
        ))}
      </div>
      <p className="tiny muted mt">Open-Meteo · בחורף בדקו גם אזהרות שיטפונות של השירות המטאורולוגי.</p>
    </div>
  )
}
