import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../context.jsx'
import { Alert } from '../components/UI.jsx'
import { Icon } from '../components/Icons.jsx'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useGeolocation } from '../hooks/useGeolocation.js'
import { haversine, bearing, compassLabelLong, formatKm } from '../lib/geo.js'
import { idbGet, TRAIL_KEY } from '../lib/overpass.js'
import { buildIndex, locate } from '../lib/progress.js'
import { sunTimes, fmtTime } from '../lib/sun.js'
import { useToast } from '../hooks/useToast.jsx'

const KEYWORDS = /(פונים|נפנה|ממשיכים|נמשיך|חוצים|נחצה|עולים|נעלה|יורדים|נרד|מטפסים|נטפס|הולכים|נלך|מגיעים|נגיע|יוצאים|נצא|שמאלה|ימינה|צומת|מפגש|שלט|סימון|מעבר|גשר|כביש|דרך עפר|ערוץ|מעלה|אוכף|פסגה|מעיין|חניון)/g

export default function Story({ id, navigate }) {
  const { segments, plan } = useApp()
  const toast = useToast()
  const seg = segments.find((s) => s.id === Number(id))
  const nobo = plan.direction === 'nobo'
  const steps = useMemo(() => (seg?.steps_he?.length ? (nobo ? [...seg.steps_he].reverse() : seg.steps_he) : []), [seg, nobo])
  const [progress, setProgress] = useLocalStorage('storyProgress', {})
  const cur = Math.min(progress[seg?.id] || 0, Math.max(0, steps.length - 1))
  const setCur = (i) => setProgress({ ...progress, [seg.id]: Math.max(0, Math.min(steps.length - 1, i)) })
  const [gpsOn, setGpsOn] = useState(false)
  const { pos, error } = useGeolocation(gpsOn)
  const [index, setIndex] = useState(null)
  const [speaking, setSpeaking] = useState(false)
  const [autoRead, setAutoRead] = useLocalStorage('storyAutoRead', false)
  const [big, setBig] = useLocalStorage('storyBigText', false)
  const wake = useRef(null)
  const stepRef = useRef(null)
  useEffect(() => { idbGet(TRAIL_KEY).then((d) => d?.lines && setIndex(buildIndex(d.lines))) }, [])
  useEffect(() => { if (error) toast(error) }, [error]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { stepRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, [cur])
  useEffect(() => () => { window.speechSynthesis?.cancel(); wake.current?.release?.() }, [])

  // GPS → fraction along the segment → suggested step
  const gps = useMemo(() => {
    if (!pos || !seg?.start?.lat) return null
    const dStart = haversine(pos, seg.start), dEnd = haversine(pos, seg.end)
    let frac = null
    if (index) {
      const a = locate(index, seg.start), b = locate(index, seg.end), me = locate(index, pos)
      if (a && b && me && Math.abs(b.km - a.km) > 0.5) {
        frac = (me.km - a.km) / (b.km - a.km)
        if (nobo) frac = 1 - frac
        frac = Math.max(0, Math.min(1, frac))
        return { frac, dist: me.dist, dStart, dEnd, kmDone: Math.abs(me.km - (nobo ? b.km : a.km)), kmLeft: Math.abs((nobo ? a.km : b.km) - me.km), onTrail: me.dist < 0.4 }
      }
    }
    frac = Math.max(0, Math.min(1, dStart / (dStart + dEnd)))
    if (nobo) frac = 1 - frac
    return { frac, dist: null, dStart, dEnd, kmDone: null, kmLeft: null, onTrail: null }
  }, [pos, index, seg, nobo])
  const suggested = gps ? Math.min(steps.length - 1, Math.floor(gps.frac * steps.length)) : null
  const target = seg ? (nobo ? seg.start : seg.end) : null
  const sun = useMemo(() => sunTimes(new Date(), seg?.start?.lat ?? 31.5, seg?.start?.lon ?? 34.9), [seg])

  const speak = (text, then) => {
    const synth = window.speechSynthesis
    if (!synth) { toast('הדפדפן לא תומך בהקראה'); return }
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'he-IL'; u.rate = 0.95
    const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith('he'))
    if (voice) u.voice = voice
    u.onend = () => { setSpeaking(false); then?.() }
    u.onerror = () => setSpeaking(false)
    setSpeaking(true); synth.speak(u)
  }
  const readStep = (i = cur) => speak(`שלב ${i + 1} מתוך ${steps.length}. ${steps[i]}`, autoRead && i < steps.length - 1 ? () => { setCur(i + 1); setTimeout(() => readStep(i + 1), 400) } : null)
  const toggleWake = async () => {
    try { if (wake.current) { await wake.current.release(); wake.current = null; toast('המסך יכול לכבות') } else { wake.current = await navigator.wakeLock.request('screen'); toast('המסך יישאר דולק') } } catch { toast('אין תמיכה בנעילת מסך') }
  }
  const highlight = (t) => t.split(KEYWORDS).map((part, i) => (i % 2 ? <mark key={i} className="kw">{part}</mark> : part))

  if (!seg) return <div className="page"><Alert kind="warn">המקטע לא נמצא</Alert></div>
  if (!steps.length) return <div className="page stack"><Alert kind="info">למקטע זה אין עדיין תיאור מסלול מפורט.</Alert><button className="btn" onClick={() => navigate(`segments/${seg.id}`)}>חזרה למקטע</button></div>

  return (
    <div className={`page stack story ${big ? 'story--big' : ''}`}>
      <div className="story__head">
        <div className="row between">
          <div><div className="tiny muted">סיפור דרך · מקטע {seg.id}{nobo ? ' · דרום→צפון' : ''}</div><h2 style={{ fontSize: 18 }}>{seg.name_he}</h2></div>
          <button className="iconbtn iconbtn--surface" onClick={() => navigate(`segments/${seg.id}`)} aria-label="חזרה"><Icon name="back" /></button>
        </div>
        <div className="progress mt"><div style={{ width: `${((cur + 1) / steps.length) * 100}%` }} /></div>
        <div className="row between tiny muted mt" style={{ gap: 6 }}>
          <span>שלב {cur + 1} מתוך {steps.length}</span>
          <span>{seg.distance_km} ק"מ · 🌇 שקיעה {fmtTime(sun.sunset)}</span>
        </div>
      </div>

      {nobo && <Alert kind="info">התיאור הרשמי נכתב מצפון לדרום. אתם הולכים דרומה→צפונה, ולכן השלבים מוצגים בסדר הפוך – "ימינה/שמאלה" ו"עולים/יורדים" בטקסט מתייחסים לכיוון ההפוך.</Alert>}
      {seg.spni?.important_he?.length > 0 && cur === 0 && <div className="alert alert--warn small"><div><b>❗ לפני שיוצאים:</b><ul style={{ paddingInlineStart: 18, marginTop: 4 }}>{seg.spni.important_he.map((x, i) => <li key={i}>{x}</li>)}</ul></div></div>}

      <div className="card card--glow story__gps">
        <div className="row between">
          <span className="bold row" style={{ gap: 6 }}><Icon name="locate" size={18} />מיקום חי</span>
          <label className="switch"><input type="checkbox" checked={gpsOn} onChange={(e) => setGpsOn(e.target.checked)} /></label>
        </div>
        {gpsOn && !pos && <div className="small muted mt">מחפש לוויינים…</div>}
        {gps && (
          <div className="stack mt" style={{ gap: 6 }}>
            <div className="live-grid">
              <div className="live"><b>{Math.round(gps.frac * 100)}%</b><span>מהמקטע</span></div>
              <div className="live"><b>{formatKm(gps.kmLeft ?? gps.dEnd)}</b><span>{gps.kmLeft != null ? 'נותרו בשביל' : 'אווירי לסיום'}</span></div>
              <div className={`live ${gps.onTrail === false ? 'live--warn' : ''}`}><b>{gps.dist != null ? formatKm(gps.dist) : '–'}</b><span>מהשביל</span></div>
            </div>
            {suggested != null && suggested !== cur && <button className="btn btn--sm btn--blue" onClick={() => setCur(suggested)}>לפי ה-GPS אתם בערך בשלב {suggested + 1} – קפיצה לשם</button>}
            {target && <div className="tiny muted">לסיום המקטע ({target.short_he || target.name_he}): {compassLabelLong(bearing(pos, target))} · {formatKm(nobo ? gps.dStart : gps.dEnd)} אווירי</div>}
            {!index && <div className="tiny muted">💡 הורידו את תוואי השביל במסך המפה לחישוב מדויק לאורך השביל (לא אווירי).</div>}
          </div>
        )}
      </div>

      <div className="story__steps">
        {steps.map((t, i) => (
          <div key={i} ref={i === cur ? stepRef : null} className={`story__step ${i === cur ? 'is-current' : i < cur ? 'is-done' : ''}`} onClick={() => setCur(i)}>
            <div className="story__num">{i < cur ? '✓' : i + 1}</div>
            <div className="story__text">{i === cur ? highlight(t) : t}</div>
          </div>
        ))}
      </div>

      <div className="story__bar">
        <button className="btn" onClick={() => setCur(cur - 1)} disabled={cur === 0}>→ הקודם</button>
        <button className={`btn ${speaking ? 'btn--danger' : ''}`} onClick={() => (speaking ? (window.speechSynthesis?.cancel(), setSpeaking(false)) : readStep())} title="הקראה">{speaking ? '⏹' : '🔊'}</button>
        {cur < steps.length - 1 ? <button className="btn btn--primary" onClick={() => { setCur(cur + 1); if (autoRead) setTimeout(() => readStep(cur + 1), 200) }}>הבא ←</button> : <button className="btn btn--primary" onClick={() => { navigate(`segments/${seg.id}`); toast('הגעתם לסוף המקטע! סמנו אותו כהושלם 🎉') }}>סיימנו 🏁</button>}
      </div>
      <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
        <label className="switch tiny"><input type="checkbox" checked={autoRead} onChange={(e) => setAutoRead(e.target.checked)} /> הקראה רציפה</label>
        <label className="switch tiny"><input type="checkbox" checked={big} onChange={(e) => setBig(e.target.checked)} /> טקסט גדול</label>
        <button className="btn btn--sm btn--ghost" onClick={toggleWake}>🔆 מסך דולק</button>
        <button className="btn btn--sm btn--ghost" onClick={() => { if (confirm('לאפס את ההתקדמות במקטע?')) setCur(0) }}>איפוס</button>
      </div>
      <p className="tiny muted center">התיאור: המדריך הרשמי של החברה להגנת הטבע{seg.spni?.author_he ? ` (${seg.spni.author_he})` : ''}. סיפור הדרך משלים את סימון השביל והמפה – לא מחליף אותם.</p>
    </div>
  )
}
