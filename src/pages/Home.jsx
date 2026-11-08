import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context.jsx'
import { Photo, getPhoto } from '../components/Photo.jsx'
import { Section } from '../components/UI.jsx'
import { Icon } from '../components/Icons.jsx'
import { CIcon } from '../components/ColorIcons.jsx'
import { fmtDate, HE_MONTHS } from '../lib/dates.js'
import { MONTHS, LEVEL_CLS, LEVEL_HE } from '../lib/season.js'
import { WeatherNow, WeatherDaily } from '../components/Weather.jsx'
import { useWeather } from '../hooks/useWeather.js'
import { regionGroup } from '../lib/season.js'
import { useGeolocation } from '../hooks/useGeolocation.js'
import { nearest } from '../lib/geo.js'
import { sunTimes, fmtTime } from '../lib/sun.js'
import { evaluatePlan } from '../lib/readiness.js'
import { useLiveUpdates } from '../hooks/useLiveUpdates.js'
import { markSeen } from '../lib/liveUpdates.js'

const QUICK = [
  ['map', 'map', 'מפה חיה'], ['weather', 'weather', 'מזג אוויר'], ['nav', 'compass', 'מצפן'], ['guide/angels', 'angels', 'מלאכי שביל'],
  ['guide/lodging', 'lodging', 'לינה'], ['guide/water', 'water', 'מים'], ['guide/gear', 'gear', 'ציוד'],
  ['guide/safety', 'safety', 'בטיחות'], ['journal', 'journal', 'יומן'],
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
  const live = useLiveUpdates()
  const readiness = useMemo(() => (itinerary ? evaluatePlan({ days: itinerary.days, segments, angels, caches: itinerary.caches || [] }) : null), [itinerary, segments, angels])
  const changes = live.items.slice(0, 3)
  const newKeys = new Set(live.newItems.map((u) => u.place + u.date))
  const needsAngel = tomorrow && !tomorrow.rest && /מלאכ/.test(tomorrow.overnight || '') && !angels.some((a) => tomorrow.segments.includes(Number(a.segId)))

  return (
    <div className="page stack">
      <div className="hero">
        <Photo photoKey="hero" credit={false} style={{ position: 'absolute', inset: 0, aspectRatio: 'auto', borderRadius: 0 }} />
        <div className="hero__overlay" />
        <div className="hero__content">
          <span className="hero__kicker"><span className="blaze" style={{ width: 10, height: 16 }}><span className="w" /><span className="b" /><span className="o" /></span> מהחרמון ועד אילת</span>
          <h1>שביל ישראל</h1>
          <p>מסע של {Math.round(totalKm).toLocaleString()} ק"מ ב-{segments.length} מקטעים רשמיים · מתכנן, מפה חיה ומלווה בשטח</p>
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
            <span className="tiny" style={{ opacity: 0.85 }}>{fmtDate(itinerary.summary.startDate)} ← {fmtDate(itinerary.summary.endDate)}</span>
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
          {readiness && <button className="btn btn--sm mt" style={{ background: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }} onClick={() => navigate('plan')}>{readiness.overall === 'ok' ? '🟢 רמזור התוכנית: תקין' : readiness.overall === 'warn' ? `🟡 רמזור התוכנית: ${readiness.checks.filter((c) => c.level === 'warn').length} דגשים` : `🔴 רמזור התוכנית: ${readiness.checks.filter((c) => c.level === 'bad').length} אזהרות`}</button>}
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
        {QUICK.map(([to, ico, t]) => <button key={to} className="quick__btn" onClick={() => navigate(to)}><span className="quick__ico"><CIcon name={ico} size={34} /></span>{t}</button>)}
      </div>

      <WeatherCard segments={segments} navigate={navigate} />

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
        <Section title={<>עדכוני תוואי {live.newItems.length > 0 && <span className="chip chip--orange">{live.newItems.length} חדשים</span>}</>} icon="flag" action={<button className="linkbtn small" onClick={() => { markSeen(live.items); navigate('guide/spni') }}>כל העדכונים ←</button>}>
          {changes.map((c, i) => <div key={i} className={`news ${newKeys.has(c.place + c.date) ? 'news--new' : ''}`}>{newKeys.has(c.place + c.date) && <span className="chip chip--orange" style={{ marginInlineEnd: 6 }}>חדש</span>}<b>{c.place}</b> <span className="tiny muted">({c.date})</span> – {c.text}</div>)}
          <p className="tiny muted mt">מקור: החברה להגנת הטבע · נשלף {live.fetched} · {live.state === 'loading' ? 'בודק עדכונים…' : live.state === 'error' ? 'לא ניתן לרענן כרגע' : 'מתרענן אוטומטית בכל פתיחה'} <button className="linkbtn tiny" onClick={live.refresh}>רענון</button></p>
        </Section>
      )}
      <p className="tiny muted">המידע באפליקציה נאסף ממקורות ציבוריים ואינו תחליף למפות ולהנחיות הרשמיות. בטיחות קודמת לכול.</p>
    </div>
  )
}

function WeatherCard({ segments, navigate }) {
  const { pos } = useGeolocation(true, { enableHighAccuracy: false, maximumAge: 600000 })
  const target = pos || { lat: 31.78, lon: 35.2 }
  const n = useMemo(() => nearest(target, segments.filter((s) => s.start?.lat).map((s) => ({ ...s.start, region: s.region }))), [target.lat, target.lon, segments]) // eslint-disable-line react-hooks/exhaustive-deps
  const place = pos ? (n ? `ליד ${n.point.name_he}` : 'מיקומך') : 'ירושלים (ללא GPS)'
  const { data, error } = useWeather(target.lat, target.lon, { days: 5 })
  if (error && !data) return null
  if (!data) return <div className="card small muted">טוען תחזית חיה…</div>
  return (
    <div className="card" onClick={() => navigate('weather')} style={{ cursor: 'pointer' }}>
      <WeatherNow data={data} place={place} />
      <div className="mt"><WeatherDaily data={data} group={regionGroup(n?.point?.region || '')} days={5} /></div>
      <div className="row between mt"><span className="tiny muted">מתעדכן אוטומטית · לחצו לתחזית שעתית ולתחנות לאורך השביל</span><span className="linkbtn small">←</span></div>
    </div>
  )
}
