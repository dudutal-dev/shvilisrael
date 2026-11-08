import { useMemo, useState } from 'react'
import { useApp } from '../context.jsx'
import { Photo } from '../components/Photo.jsx'
import { Difficulty, Stat, Alert, Section, Acc } from '../components/UI.jsx'
import { MapView } from '../components/MapView.jsx'
import { Icon } from '../components/Icons.jsx'
import { navLinks, formatCoord } from '../lib/geo.js'
import { waypointsToGPX, download } from '../lib/gpx.js'
import { useToast } from '../hooks/useToast.jsx'
import lodging from '../data/lodging.json'
import spniAngels from '../data/spni/angels.json'
import { gearFor } from '../lib/gear.js'
import { poisForSegment } from '../lib/pois.js'
import { PoiCards } from '../components/PoiCards.jsx'
import { WeatherNow, WeatherDaily, WeatherFlags } from '../components/Weather.jsx'
import { useWeather } from '../hooks/useWeather.js'
import { regionGroup } from '../lib/season.js'
import { HE_MONTHS } from '../lib/dates.js'

export default function SegmentDetail({ id, navigate }) {
  const { segments, done, toggleDone, notes, setNotes, prefs } = useApp()
  const toast = useToast()
  const seg = segments.find((s) => s.id === Number(id))
  const [tab, setTab] = useState('info')
  const [month, setMonth] = useState(new Date().getMonth())
  const [temp, setTemp] = useState(24)
  const [weight, setWeight] = useState(70)
  const gear = useMemo(() => gearFor(seg, month), [seg, month])
  const wx = useWeather(seg?.start?.lat, seg?.start?.lon, { days: 7 })
  const [wxDay, setWxDay] = useState(0)
  const idx = segments.findIndex((s) => s.id === Number(id))
  const prev = segments[idx - 1], next = segments[idx + 1]
  const fit = useMemo(() => seg?.start?.lat && seg?.end?.lat ? { bounds: [[seg.start.lat, seg.start.lon], [seg.end.lat, seg.end.lon]] } : null, [seg])
  const nearbyCamps = useMemo(() => {
    if (!seg?.end?.lat || !lodging.night_camps) return []
    return lodging.night_camps.filter((c) => c.lat && Math.abs(c.lat - seg.end.lat) < 0.15 && Math.abs(c.lon - seg.end.lon) < 0.15)
  }, [seg])
  if (!seg) return <div className="page"><Alert kind="warn">המקטע לא נמצא</Alert></div>
  const isDone = done.includes(seg.id)
  const links = seg.start?.lat ? navLinks(seg.start.lat, seg.start.lon, seg.start.name_he) : null
  const exportGpx = () => {
    download(`INT-${seg.id}-${seg.name_en || 'segment'}.gpx`, waypointsToGPX([
      { ...seg.start, name: `התחלה: ${seg.start.name_he}`, sym: 'Flag, Green' },
      { ...seg.end, name: `סיום: ${seg.end.name_he}`, sym: 'Flag, Red' },
    ], `שביל ישראל – מקטע ${seg.id}`))
    toast('קובץ GPX הורד')
  }
  const share = async () => {
    const text = `שביל ישראל – מקטע ${seg.id}: ${seg.name_he}\n${seg.distance_km} ק"מ · ${seg.region}\n${location.href}`
    if (navigator.share) { try { await navigator.share({ title: seg.name_he, text }) } catch { /* cancelled */ } }
    else { await navigator.clipboard?.writeText(text); toast('הועתק ללוח') }
  }

  return (
    <div className="page stack">
      <div className="hero hero--sm">
        <Photo photoKey={seg.photo} credit style={{ position: 'absolute', inset: 0, aspectRatio: 'auto', borderRadius: 0 }} />
        <div className="hero__overlay" />
        <div className="hero__content">
          <div className="row" style={{ gap: 6 }}><span className="chip" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>מקטע {seg.id}</span><Difficulty level={seg.difficulty} />{isDone && <span className="chip" style={{ background: 'var(--green)', color: '#fff' }}>הושלם ✓</span>}</div>
          <h1 style={{ fontSize: 22, marginTop: 6 }}>{seg.name_he}</h1>
          <p className="small">{seg.start?.short_he || seg.start?.name_he} ← {seg.end?.short_he || seg.end?.name_he} · {seg.region_spni || seg.region}</p>
        </div>
      </div>

      <div className="grid-3">
        <Stat value={`${seg.distance_km}`} label='ק"מ' />
        <Stat value={seg.hours ? `${seg.hours}` : '–'} label="שעות הליכה" />
        <Stat value={seg.ascent_m != null ? `↑${seg.ascent_m}` : '–'} label={seg.descent_m != null ? `↓${seg.descent_m} מ' טיפוס/ירידה` : "מ' טיפוס"} />
      </div>

      {seg.water_caching_needed && <Alert kind="warn" icon="water"><b>נדרשת הטמנת מים.</b> {seg.water?.summary_he}</Alert>}
      {seg.firing_zone && <Alert kind="danger" icon="warn"><b>שטח אש:</b> {seg.firing_zone}</Alert>}

      {seg.steps_he?.length > 0 && (
        <button className="story-cta" onClick={() => navigate(`segments/${seg.id}/story`)}>
          <span className="story-cta__ico">🧭</span>
          <span><b>סיפור דרך – ניווט שלב אחר שלב</b><br /><span className="tiny" style={{ opacity: 0.9 }}>{seg.steps_he.length} שלבים מתיאור המסלול הרשמי · הקראה קולית · מעקב GPS</span></span>
          <span style={{ fontSize: 22 }}>←</span>
        </button>
      )}
      <div className="segmented" style={{ alignSelf: 'center' }}>
        {[['info', 'מידע'], ['weather', 'מזג אוויר'], ['lodging', 'לינה ומים'], ['gear', 'ציוד'], ['map', 'מפה'], ['notes', 'הערות שלי']].map(([k, v]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{v}</button>)}
      </div>

      {tab === 'info' && (
        <div className="stack">
          {seg.description_he && <div className="card card--glow"><p style={{ lineHeight: 1.7, whiteSpace: 'pre-line' }}>{seg.description_he}</p></div>}
          {seg.spni && (
            <div className="card">
              <div className="card__title"><span className="blaze" style={{ width: 12, height: 18 }}><span className="w" /><span className="b" /><span className="o" /></span>המדריך הרשמי – החברה להגנת הטבע</div>
              <div className="stack small" style={{ gap: 8 }}>
                {seg.spni.season_he && <div><b>עונה מומלצת:</b> {seg.spni.season_he}</div>}
                {seg.spni.character_he && <div><b>אופי המסלול:</b> {seg.spni.character_he}</div>}
                {seg.spni.shortcuts_he && <div><b>אפשרויות קיצור:</b> {seg.spni.shortcuts_he}</div>}
                {seg.spni.parking_he && <div><b>חניה:</b> {seg.spni.parking_he}</div>}
              </div>
              {seg.spni.important_he?.length > 0 && <div className="alert alert--warn mt"><div><b>❗ חשוב לדעת</b><ul className="mt" style={{ paddingInlineStart: 18 }}>{seg.spni.important_he.map((x, i) => <li key={i}>{x}</li>)}</ul></div></div>}
              <div className="row mt" style={{ gap: 6 }}>
                {seg.spni.map_pdf && <a className="btn btn--sm btn--primary" href={seg.spni.map_pdf} target="_blank" rel="noreferrer">🗺️ מפת המקטע (PDF חינם)</a>}
                <a className="btn btn--sm" href={seg.spni.url} target="_blank" rel="noreferrer">לעמוד המקטע באתר</a>
                {seg.spni.guide_url && <a className="btn btn--sm btn--ghost" href={seg.spni.guide_url} target="_blank" rel="noreferrer">מדריך {seg.region_spni}</a>}
              </div>
              {seg.spni.description_he && <details className="acc mt"><summary>תיאור המסלול המלא (מצפון לדרום)</summary><div className="acc__body" style={{ whiteSpace: 'pre-line', lineHeight: 1.7 }}>{seg.spni.description_he}{seg.spni.author_he && <p className="tiny muted mt">כתב: {seg.spni.author_he}</p>}</div></details>}
              {seg.spni.nearby_he?.length > 0 && <details className="acc mt"><summary>המלצות בסביבה</summary><div className="acc__body"><ul>{seg.spni.nearby_he.map((x, i) => <li key={i}>{x}</li>)}</ul></div></details>}
            </div>
          )}
          <div className="card">
            <div className="card__title"><Icon name="star" />נקודות עניין</div>
            {poisForSegment(seg.id).length > 0 && <><p className="tiny muted mb">לחצו על נקודה לקריאת ההיסטוריה והמהות שלה (ויקיפדיה), עם תמונות.</p><PoiCards pois={poisForSegment(seg.id)} layout="grid" /></>}
            <ul className="mt">{(seg.highlights || []).map((h, i) => <li key={i}>{h}</li>)}</ul>
          </div>
          {(seg.hazards?.length > 0) && (
            <div className="card">
              <div className="card__title"><Icon name="warn" />אזהרות ודגשים</div>
              <ul>{seg.hazards.map((h, i) => <li key={i}>{h}</li>)}</ul>
            </div>
          )}
          <div className="card">
            <div className="card__title"><Icon name="bus" />הגעה ותחבורה</div>
            <p className="small">{seg.transport?.spni_he || seg.transport?.start_he || 'ראו מדריך'}</p>
            {seg.transport?.end_he && <p className="small mt"><b>סיום:</b> {seg.transport.end_he}</p>}
            {links && <div className="row mt" style={{ gap: 6 }}>
              <a className="btn btn--sm" href={links.google} target="_blank" rel="noreferrer">Google Maps לנק' ההתחלה</a>
              <a className="btn btn--sm" href={links.waze} target="_blank" rel="noreferrer">Waze</a>
              <a className="btn btn--sm" href={links.ihm} target="_blank" rel="noreferrer">Israel Hiking Map</a>
            </div>}
          </div>
          <div className="card small">
            <div className="row between"><span className="bold">נקודת התחלה</span><span className="mono ltr">{formatCoord(seg.start?.lat, seg.start?.lon)}</span></div>
            <div className="row between mt"><span className="bold">נקודת סיום</span><span className="mono ltr">{formatCoord(seg.end?.lat, seg.end?.lon)}</span></div>
            {seg.start?.approx && <p className="tiny muted mt">* הקואורדינטות משוערות (±1 ק"מ) – לניווט מדויק להשתמש בתוואי מ-OSM במפה.</p>}
          </div>
        </div>
      )}

      {tab === 'lodging' && (
        <div className="stack">
          <div className="card">
            <div className="card__title"><Icon name="water" />מים במקטע</div>
            <p>{seg.water?.summary_he || 'אין מידע'}</p>
            {seg.water?.sources?.length > 0 && <ul className="mt">{seg.water.sources.map((w, i) => <li key={i}>{w}</li>)}</ul>}
          </div>
          <div className="card card--glow">
            <div className="card__title"><Icon name="water" />מחשבון מים למקטע</div>
            <div className="field"><label>טמפרטורה מרבית צפויה: <b>{temp}°C</b></label><input className="range" type="range" min={5} max={45} value={temp} onChange={(e) => setTemp(Number(e.target.value))} /></div>
            <div className="field"><label>משקל גוף: <b>{weight} ק"ג</b></label><input className="range" type="range" min={40} max={120} value={weight} onChange={(e) => setWeight(Number(e.target.value))} /></div>
            {(() => {
              const hours = seg.hours || seg.distance_km / 3.5
              const perHour = (0.45 + Math.max(0, temp - 18) * 0.035) * (weight / 70) * (seg.difficulty >= 3 ? 1.15 : 1)
              const walk = hours * perHour
              const camp = seg.water?.availability === 'none' || seg.water_caching_needed ? 2.5 : 1
              const total = walk + camp
              return (
                <div className="stack mt">
                  <div className="grid-3"><Stat value={walk.toFixed(1)} label="ל' בהליכה" /><Stat value={camp.toFixed(1)} label="ל' לערב/בישול" /><Stat value={Math.ceil(total * 2) / 2} label="ל' לשאת" /></div>
                  {total > 6.5 && <Alert kind="warn" icon="water">יותר מ-6.5 ליטר – שקלו הטמנה באמצע המקטע, יציאה לפני הזריחה, או פיצול המקטע.</Alert>}
                  {temp >= 32 && <Alert kind="danger" icon="warn">מעל 32°C: סכנת מכת חום. לא לצאת למקטע מדברי ארוך.</Alert>}
                  <p className="tiny muted">הערכה: ~0.45 ל'/שעה ב-18°C, +0.1 ל'/שעה לכל 3°C נוספים, מותאם למשקל ולקושי. לא תחליף לשיקול דעת.</p>
                </div>
              )
            })()}
          </div>
          <div className="card">
            <div className="card__title"><Icon name="bed" />לינה בסיום המקטע</div>
            {seg.overnight?.summary_he && <p className="mb">{seg.overnight.summary_he}</p>}
            <div className="stack" style={{ gap: 8 }}>
              {seg.overnight?.night_camp && <Row ico="⛺" t="חניון לילה / לינת שטח" v={seg.overnight.night_camp} />}
              {seg.overnight?.trail_angels && <Row ico="😇" t="מלאכי שביל" v={<>{seg.overnight.trail_angels} <button className="linkbtn" onClick={() => navigate('guide/angels')}>← למדריך ולאנשי הקשר שלי</button></>} />}
              {seg.overnight?.field_school && <Row ico="🏫" t="בית ספר שדה / אכסניה" v={seg.overnight.field_school} />}
              {seg.overnight?.paid && <Row ico="🏨" t="לינה בתשלום" v={seg.overnight.paid} />}
            </div>
            <button className="btn btn--ghost btn--sm mt" onClick={() => navigate('guide/lodging')}>למדריך הלינה המלא ←</button>
          </div>
          {seg.angels_region && (() => {
            const list = (spniAngels.angels || []).filter((a) => a.region_index === seg.angels_region)
            const reg = spniAngels.regions.find((r) => r.index === seg.angels_region)
            return list.length ? (
              <div className="card">
                <div className="card__title">😇 מלאכי שביל באזור: {reg?.name}</div>
                <p className="tiny muted mb">{list.length} מארחים ברשימה הרשמית של החברה להגנת הטבע. פרטי קשר – בעמוד האזורי באתר.</p>
                <div className="stack" style={{ gap: 6 }}>{list.slice(0, 12).map((a, i) => <div key={i} className="small"><b>{a.settlement}</b> – <span className="muted">{a.offer.split('\n')[0].slice(0, 90)}</span></div>)}</div>
                {list.length > 12 && <p className="tiny muted mt">ועוד {list.length - 12}…</p>}
                <div className="row mt" style={{ gap: 6 }}><a className="btn btn--sm btn--primary" href={reg?.url} target="_blank" rel="noreferrer">הרשימה המלאה עם טלפונים</a><button className="btn btn--sm" onClick={() => navigate('guide/angels')}>המלאכים שלי</button></div>
              </div>
            ) : null
          })()}
          {nearbyCamps.length > 0 && (
            <div className="card">
              <div className="card__title"><Icon name="tent" />חניוני לילה בסביבה</div>
              {nearbyCamps.map((c, i) => <div key={i} className="small mt"><b>{c.name_he}</b> – {c.facilities_he || c.notes_he || ''}</div>)}
            </div>
          )}
        </div>
      )}

      {tab === 'weather' && (
        <div className="stack">
          {!wx.data && <div className="card small muted">{wx.error ? 'אין חיבור לשרת מזג האוויר' : 'טוען תחזית חיה לנקודת ההתחלה…'}</div>}
          {wx.data && (
            <>
              <div className="card card--glow"><WeatherNow data={wx.data} place={seg.start.name_he} /></div>
              <div className="card">
                <div className="card__title"><Icon name="sun" />7 ימים – מתי כדאי לצעוד כאן</div>
                <WeatherDaily data={wx.data} group={regionGroup(seg.region)} onPick={setWxDay} />
                <div className="mt"><WeatherFlags data={wx.data} group={regionGroup(seg.region)} dayIndex={wxDay} /></div>
                {seg.hazards?.some((h) => /שיטפ|נחל|קניון|מכתש/.test(h)) && <p className="tiny mt" style={{ color: 'var(--orange)' }}>⚠ במקטע זה יש נחלים/קניונים – בגשם באזור כולו (גם רחוק) קיימת סכנת שיטפון.</p>}
              </div>
              <button className="btn btn--ghost btn--sm" onClick={() => navigate(`weather?seg=${seg.id}`)}>תחזית שעתית מלאה ←</button>
            </>
          )}
        </div>
      )}

      {tab === 'gear' && gear && (
        <div className="stack">
          <div className="field"><label>ציוד מומלץ למקטע זה לפי חודש</label>
            <select className="select" value={month} onChange={(e) => setMonth(Number(e.target.value))}>{HE_MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
          </div>
          {gear.warnings.map((w, i) => <Alert key={i} kind="danger" icon="warn">{w}</Alert>)}
          <div className="grid-3">
            <Stat value={`${gear.waterLiters} ל'`} label="מים לשאת" />
            <Stat value={gear.sleepingBag.split(' ')[2] || ''} label="דירוג שק שינה" />
            <Stat value={seg.hours || '–'} label="שעות הליכה" />
          </div>
          <div className="card"><div className="card__title"><Icon name="star" />תוספות ייחודיות למקטע ולעונה</div>
            {gear.extras.length === 0 && <p className="small muted">אין תוספות מיוחדות – הציוד הבסיסי מספיק.</p>}
            {gear.extras.map((x, i) => <div key={i} className={`gear-item gear-${x.level}`}><div className="bold">{x.level === 'must' ? '🔴' : x.level === 'rec' ? '🟠' : '🟢'} {x.item}</div><div className="tiny muted">{x.why}</div></div>)}
          </div>
          <div className="card small"><div><b>שק שינה:</b> {gear.sleepingBag}</div><div className="mt"><b>אוכל:</b> {gear.foodDays}</div></div>
          <button className="btn btn--ghost btn--sm" onClick={() => navigate(`guide/gear?seg=${seg.id}&m=${month}`)}>לרשימת הציוד המלאה ←</button>
        </div>
      )}

      {tab === 'map' && (
        <div className="stack">
          <div className="mini-map" style={{ height: 320 }}>
            <MapView segments={[seg]} base={prefs.base} fitTo={fit} selectedId={seg.id} />
          </div>
          <p className="tiny muted">הקו המקווקו סכמטי בין נקודות הקצה. במסך המפה ניתן להוריד את התוואי המלא מ-OpenStreetMap לשימוש לא מקוון.</p>
          <button className="btn" onClick={() => navigate(`map?seg=${seg.id}`)}><Icon name="map" size={18} /> פתיחה במפה המלאה</button>
        </div>
      )}

      {tab === 'notes' && (
        <div className="card">
          <div className="card__title"><Icon name="journal" />ההערות שלי למקטע</div>
          <textarea className="textarea" placeholder="מספרי טלפון של מלאכי שביל, נקודות מים שמצאתם, טיפים…" value={notes[seg.id] || ''} onChange={(e) => setNotes({ ...notes, [seg.id]: e.target.value })} />
          <p className="tiny muted mt">נשמר אוטומטית במכשיר.</p>
        </div>
      )}

      <div className="row" style={{ gap: 8 }}>
        <button className={`btn ${isDone ? '' : 'btn--primary'}`} style={{ flex: 1 }} onClick={() => { toggleDone(seg.id); toast(isDone ? 'הסימון הוסר' : 'כל הכבוד! המקטע סומן כהושלם 🎉') }}><Icon name="check" size={18} />{isDone ? 'בטל סימון' : 'סמן כהושלם'}</button>
        <button className="btn" onClick={exportGpx} title="GPX"><Icon name="download" size={18} /></button>
        <button className="btn" onClick={share}><Icon name="share" size={18} /></button>
      </div>
      <div className="row between">
        {prev ? <button className="btn btn--ghost btn--sm" onClick={() => navigate(`segments/${prev.id}`)}>→ מקטע {prev.id}: {prev.name_he}</button> : <span />}
        {next ? <button className="btn btn--ghost btn--sm" onClick={() => navigate(`segments/${next.id}`)}>מקטע {next.id}: {next.name_he} ←</button> : <span />}
      </div>
    </div>
  )
}
function Row({ ico, t, v }) { return <div className="row" style={{ alignItems: 'flex-start' }}><span style={{ fontSize: 20 }}>{ico}</span><div><div className="tiny muted">{t}</div><div className="small">{v}</div></div></div> }
