import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../context.jsx'
import { MapView, BASE_LAYERS } from '../components/MapView.jsx'
import { Icon } from '../components/Icons.jsx'
import { Modal } from '../components/UI.jsx'
import { useGeolocation } from '../hooks/useGeolocation.js'
import { loadTrailGeometry, idbGet, idbDel, TRAIL_KEY } from '../lib/overpass.js'
import { nearest, formatKm, bearing, compassLabelLong, lineLength, haversine } from '../lib/geo.js'
import { buildIndex, locate, slice } from '../lib/progress.js'
import { appendPoint, loadTracks } from '../lib/track.js'
import { linesToGPX, download } from '../lib/gpx.js'
import { sunTimes, fmtTime } from '../lib/sun.js'
import { toISODate } from '../lib/dates.js'
import { useToast } from '../hooks/useToast.jsx'
import lodging from '../data/lodging.json'
import logistics from '../data/logistics.json'

export default function MapPage({ query, navigate }) {
  const { segments, prefs, setPrefs, plan, done, totalKm } = useApp()
  const toast = useToast()
  const [gps, setGps] = useState(false)
  const [follow, setFollow] = useState(false)
  const [rec, setRec] = useState(false)
  const { pos, error } = useGeolocation(gps)
  const [lines, setLines] = useState(null)
  const [status, setStatus] = useState('')
  const [layersOpen, setLayersOpen] = useState(false)
  const [panel, setPanel] = useState(true)
  const [show, setShow] = useState({ camps: true, lodging: false, water: false, angels: false })
  const [track, setTrack] = useState(null)
  const offTrail = useRef(false)
  const relationId = logistics?.navigation?.osm_relation_id
  const today = toISODate(new Date())

  useEffect(() => { idbGet(TRAIL_KEY).then((d) => d?.lines && setLines(d.lines)) }, [])
  useEffect(() => { loadTracks().then((t) => setTrack(t[today] || null)) }, [today])
  useEffect(() => { if (error) toast(error) }, [error]) // eslint-disable-line react-hooks/exhaustive-deps
  const index = useMemo(() => (lines ? buildIndex(lines) : null), [lines])

  // record breadcrumbs
  useEffect(() => {
    if (!rec || !pos) return
    appendPoint(today, pos).then(setTrack)
  }, [pos, rec, today])

  const fitTo = useMemo(() => {
    const s = query.seg && segments.find((x) => x.id === Number(query.seg))
    if (s?.start?.lat && s?.end?.lat) return { bounds: [[s.start.lat, s.start.lon], [s.end.lat, s.end.lon]] }
    if (query.lat) return { center: [Number(query.lat), Number(query.lon)], zoom: 14 }
    return null
  }, [query.seg, query.lat, query.lon, segments])

  const pois = useMemo(() => {
    const out = []
    if (show.camps) for (const c of lodging.night_camps || []) out.push({ lat: c.lat, lon: c.lon, icon: '⛺', title: c.name_he, html: `<b>⛺ ${c.name_he}</b><br/>${c.facilities_he || ''}<br/><span style="color:#666">${c.notes_he || ''}</span>` })
    if (show.lodging) for (const c of lodging.paid_lodging || []) if (c.lat) out.push({ lat: c.lat, lon: c.lon, icon: c.type === 'field_school' ? '🏫' : '🏨', title: c.name_he, html: `<b>${c.name_he}</b><br/>${c.type_he || ''} · ${c.price_he || ''}<br/>${c.url ? `<a href="${c.url}" target="_blank">אתר/הזמנה</a>` : ''}` })
    if (show.angels) for (const a of lodging.trail_angels?.notable_locations || []) if (a.lat) out.push({ lat: a.lat, lon: a.lon, icon: '😇', title: a.settlement_he, html: `<b>😇 ${a.settlement_he}</b><br/>${a.note || ''}<br/><a href="#/guide/angels">למדריך מלאכי השביל</a>` })
    if (show.water) for (const w of logistics?.water?.points || []) if (w.lat) out.push({ lat: w.lat, lon: w.lon, icon: '💧', title: w.name_he, html: `<b>💧 ${w.name_he}</b><br/>${w.notes_he || ''}` })
    return out
  }, [show])

  // live info
  const live = useMemo(() => {
    if (!pos) return null
    const loc = index ? locate(index, pos) : null
    const pts = segments.flatMap((s) => [{ ...s.start, label: `תחילת ${s.id} (${s.start?.name_he})`, segId: s.id, kind: 'start' }, { ...s.end, label: `סוף ${s.id} (${s.end?.name_he})`, segId: s.id, kind: 'end' }]).filter((p) => p.lat)
    const n = nearest(pos, pts)
    // current segment = the one whose start/end pair brackets us best
    let cur = null, best = Infinity
    for (const s of segments) {
      if (!s.start?.lat || !s.end?.lat) continue
      const d = haversine(pos, s.start) + haversine(pos, s.end) - haversine(s.start, s.end)
      if (d < best) { best = d; cur = s }
    }
    const camps = (lodging.night_camps || []).filter((c) => c.lat)
    const nc = camps.length ? nearest(pos, camps) : null
    const sobo = plan.direction !== 'nobo'
    const kmDone = loc ? (sobo ? loc.km : index.total - loc.km) : null
    const pct = kmDone != null ? Math.max(0, Math.min(100, (kmDone / index.total) * 100)) : null
    const sun = sunTimes(new Date(), pos.lat, pos.lon)
    const hoursLeft = sun.sunset ? Math.max(0, (sun.sunset - Date.now()) / 3600000) : null
    const speed = pos.speed && pos.speed > 0.4 ? pos.speed * 3.6 : 3.5
    return { loc, n, cur, nc, kmDone, pct, sun, hoursLeft, speed, sobo }
  }, [pos, index, segments, plan.direction])

  // off-trail alert
  useEffect(() => {
    if (!live?.loc) return
    const off = live.loc.dist > 0.35
    if (off && !offTrail.current) { navigator.vibrate?.([200, 100, 200]); toast(`⚠ סטיתם מהשביל (${formatKm(live.loc.dist)})`) }
    offTrail.current = off
  }, [live?.loc?.dist]) // eslint-disable-line react-hooks/exhaustive-deps

  const overlays = useMemo(() => {
    const out = []
    if (index && live?.loc) out.push({ points: slice(index, live.sobo ? 0 : index.total, live.loc.km), color: '#16a34a', weight: 6, opacity: 0.85 })
    if (track?.points?.length > 1) out.push({ points: track.points.map((p) => [p[0], p[1]]), color: '#7c3aed', weight: 3, opacity: 0.9 })
    return out
  }, [index, live?.loc?.km, live?.sobo, track])

  const downloadTrail = async () => {
    try {
      setStatus('מוריד תוואי…')
      const d = await loadTrailGeometry({ relationId, force: true, onStatus: setStatus })
      setLines(d.lines); setStatus('')
      toast(`התוואי הורד ונשמר (${Math.round(d.lines.reduce((a, l) => a + lineLength(l), 0))} ק"מ)`)
    } catch { setStatus(''); toast('ההורדה נכשלה – בדקו חיבור לאינטרנט ונסו שוב') }
  }
  const removeTrail = async () => { await idbDel(TRAIL_KEY); setLines(null); toast('התוואי נמחק מהמכשיר') }
  const doneKmSegs = segments.filter((s) => done.includes(s.id)).reduce((a, s) => a + s.distance_km, 0)

  return (
    <div className="page page--full">
      <div className="map-wrap">
        <MapView segments={segments} lines={lines} pois={pois} user={pos} follow={follow} base={prefs.base} fitTo={fitTo} selectedId={query.seg ? Number(query.seg) : null} overlays={overlays} />
        <div className="map-ctl map-ctl--tr">
          <button className={`mapbtn ${gps ? 'active' : ''}`} onClick={() => { setGps(!gps); setFollow(!gps) }} title="GPS"><Icon name="locate" /></button>
          {gps && <button className={`mapbtn ${follow ? 'active' : ''}`} onClick={() => setFollow(!follow)} title="עקוב אחרי">🎯</button>}
          {gps && <button className={`mapbtn ${rec ? 'active rec' : ''}`} onClick={() => { setRec(!rec); toast(rec ? 'ההקלטה נעצרה' : 'מקליט את המסלול שלך') }} title="הקלטת מסלול">{rec ? '⏺' : '⏺'}</button>}
          <button className="mapbtn" onClick={() => setLayersOpen(true)} title="שכבות"><Icon name="layers" /></button>
        </div>

        {/* progress bar along the top */}
        <div className="map-progress">
          <div className="map-progress__bar"><div style={{ width: `${live?.pct ?? (totalKm ? (doneKmSegs / totalKm) * 100 : 0)}%` }} /></div>
          <div className="map-progress__text">
            {live?.pct != null ? <>📍 ק"מ {live.kmDone.toFixed(1)} מתוך {index.total.toFixed(0)} · <b>{live.pct.toFixed(1)}%</b> מהשביל</> : <>{done.length} מקטעים הושלמו · {Math.round(doneKmSegs)} ק"מ ({totalKm ? Math.round((doneKmSegs / totalKm) * 100) : 0}%)</>}
          </div>
        </div>

        <div className={`map-panel ${panel ? '' : 'map-panel--min'}`}>
          <button className="map-panel__handle" onClick={() => setPanel(!panel)}>{panel ? '⌄' : '⌃'}</button>
          {status ? <div className="small">{status}</div> : pos && live ? (
            <div className="stack" style={{ gap: 6 }}>
              <div className="row between">
                <div className="bold">{live.cur ? <button className="linkbtn" onClick={() => navigate(`segments/${live.cur.id}`)}>מקטע {live.cur.id}: {live.cur.name_he}</button> : 'מחוץ למקטעים'}</div>
                <span className="tiny muted">±{Math.round(pos.accuracy)} מ'</span>
              </div>
              {panel && (
                <>
                  <div className="live-grid">
                    {live.loc && <div className={`live ${live.loc.dist > 0.35 ? 'live--warn' : ''}`}><b>{formatKm(live.loc.dist)}</b><span>מהשביל</span></div>}
                    {live.nc && <div className="live"><b>{formatKm(live.nc.dist)}</b><span>⛺ {live.nc.point.name_he.replace('חניון לילה ', '')}</span></div>}
                    {live.n && <div className="live"><b>{formatKm(live.n.dist)}</b><span>{live.n.point.label} {compassLabelLong(bearing(pos, live.n.point))}</span></div>}
                    <div className="live"><b>{track ? track.km.toFixed(1) : '0.0'}</b><span>ק"מ היום {rec ? '⏺' : ''}</span></div>
                    <div className="live"><b>{pos.speed ? (pos.speed * 3.6).toFixed(1) : '0'}</b><span>קמ"ש · {pos.altitude != null ? `${Math.round(pos.altitude)} מ'` : ''}</span></div>
                    <div className={`live ${live.hoursLeft < 2 ? 'live--warn' : ''}`}><b>{fmtTime(live.sun.sunset)}</b><span>שקיעה · {live.hoursLeft?.toFixed(1)} ש׳ אור</span></div>
                  </div>
                  {live.nc && live.hoursLeft != null && (
                    <div className={`tiny ${live.nc.dist / live.speed > live.hoursLeft ? 'txt-warn' : 'muted'}`}>
                      זמן משוער לחניון הקרוב בקצב {live.speed.toFixed(1)} קמ"ש: <b>{(live.nc.dist / live.speed * 60).toFixed(0)} דק׳</b>{live.nc.dist / live.speed > live.hoursLeft ? ' – לא תספיקו לפני החשכה!' : ''}
                    </div>
                  )}
                  <div className="tiny muted mono ltr">{pos.lat.toFixed(5)}, {pos.lon.toFixed(5)}</div>
                </>
              )}
            </div>
          ) : (
            <div className="small">{gps ? 'מחפש לוויינים…' : lines ? 'הפעילו GPS לראות מיקום, התקדמות ומרחקים בזמן אמת' : 'מוצג תוואי סכמטי. הורידו את התוואי המלא (שכבות ←) לדיוק מלא ולחישוב התקדמות'}</div>
          )}
        </div>
      </div>

      <Modal open={layersOpen} onClose={() => setLayersOpen(false)} title="שכבות ומפות">
        <div className="stack">
          <div>
            <div className="bold mb">מפת רקע</div>
            <div className="stack" style={{ gap: 6 }}>
              {Object.entries(BASE_LAYERS).map(([k, v]) => <label key={k} className="row"><input type="radio" name="base" checked={prefs.base === k} onChange={() => setPrefs({ ...prefs, base: k })} />{v.name}</label>)}
            </div>
            <p className="tiny muted mt">מפת הטיולים של ישראל מציגה סימוני שבילים ואת שביל ישראל. אריחים שנצפו נשמרים לשימוש לא מקוון – גללו מראש על המקטעים שלכם.</p>
          </div>
          <div>
            <div className="bold mb">נקודות עניין</div>
            {[['camps', '⛺ חניוני לילה'], ['angels', '😇 מלאכי שביל (יישובים)'], ['lodging', '🏨 לינה בתשלום / בתי ספר שדה'], ['water', '💧 נקודות מים']].map(([k, v]) => <div key={k}><label className="switch mt"><input type="checkbox" checked={show[k]} onChange={(e) => setShow({ ...show, [k]: e.target.checked })} /> {v}</label></div>)}
          </div>
          <div>
            <div className="bold mb">תוואי השביל המלא (OpenStreetMap)</div>
            <p className="small muted">הורדה חד-פעמית של תוואי שביל ישראל מ-OSM. נשמר במכשיר ומאפשר: חישוב אחוז התקדמות, מרחק מהשביל והתרעת סטייה – גם בלי אינטרנט.</p>
            <div className="row mt">
              <button className="btn btn--primary btn--sm" onClick={downloadTrail} disabled={!!status}>{lines ? 'רענון התוואי' : 'הורדת התוואי'}</button>
              {lines && <button className="btn btn--sm" onClick={() => { download('israel-national-trail.gpx', linesToGPX(lines)); toast('GPX הורד') }}>ייצוא GPX</button>}
              {lines && <button className="btn btn--ghost btn--sm" onClick={removeTrail}>מחיקה</button>}
            </div>
          </div>
          <div className="alert alert--info small">לניווט שטח אמיתי מומלץ להחזיק גם אפליקציה ייעודית (Israel Hiking Map / עמוד ענן) ומפת סימון שבילים מודפסת. ה-GPS תלוי בסוללה ובקליטה.</div>
        </div>
      </Modal>
    </div>
  )
}
