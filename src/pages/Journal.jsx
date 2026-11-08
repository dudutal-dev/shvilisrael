import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context.jsx'
import { Empty, Modal } from '../components/UI.jsx'
import { Icon } from '../components/Icons.jsx'
import { fmtDate, toISODate } from '../lib/dates.js'
import { useGeolocation } from '../hooks/useGeolocation.js'
import { useToast } from '../hooks/useToast.jsx'
import { savePhoto, getPhotos, deletePhoto } from '../lib/photos.js'
import { loadTracks } from '../lib/track.js'

const MOODS = ['🤩', '😊', '😐', '😩', '🤕']
const WEATHER = ['☀️', '⛅', '🌧️', '💨', '🥵', '🥶']

export default function Journal({ navigate }) {
  const { journal, setJournal, segments, done, doneKm, totalKm, itinerary } = useApp()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState(null)
  const [view, setView] = useState('list') // list | gallery | stats
  const [lightbox, setLightbox] = useState(null)
  const [tracks, setTracks] = useState({})
  const { pos } = useGeolocation(open, { enableHighAccuracy: false })
  const today = itinerary?.days.find((d) => d.date.toDateString() === new Date().toDateString())
  useEffect(() => { loadTracks().then(setTracks) }, [open])
  const blank = () => ({ id: Date.now(), date: toISODate(new Date()), segId: today?.segments?.[0] || '', text: '', km: today?.km || '', mood: '😊', weather: '☀️', photos: [], pos: null, sleep: '', water: '' })

  const saveEntry = () => {
    const e = { ...edit, pos: edit.pos || (pos ? { lat: pos.lat, lon: pos.lon } : null) }
    setJournal((j) => { const i = j.findIndex((x) => x.id === e.id); return i >= 0 ? j.map((x) => (x.id === e.id ? e : x)) : [e, ...j] })
    setOpen(false); toast('נשמר ביומן ✓')
  }
  const remove = async (e) => {
    if (!confirm('למחוק את הרשומה והתמונות שלה?')) return
    for (const id of e.photos || []) await deletePhoto(id)
    setJournal((j) => j.filter((x) => x.id !== e.id)); setOpen(false)
  }
  const exportText = async () => {
    const t = `יומן המסע שלי בשביל ישראל\n${done.length} מקטעים · ${Math.round(doneKm)} ק"מ מתוך ${Math.round(totalKm)}\n\n` +
      [...journal].sort((a, b) => a.date.localeCompare(b.date)).map((e) => `${e.date} ${e.mood} ${e.weather || ''} ${segments.find((s) => s.id === Number(e.segId))?.name_he || ''} ${e.km ? `· ${e.km} ק"מ` : ''}\n${e.text}\n`).join('\n')
    if (navigator.share) { try { await navigator.share({ title: 'יומן שביל ישראל', text: t }); return } catch { /* cancelled */ } }
    await navigator.clipboard?.writeText(t); toast('הועתק ללוח')
  }
  const pct = totalKm ? Math.round((doneKm / totalKm) * 100) : 0
  const allPhotoIds = journal.flatMap((e) => e.photos || [])
  const trackKm = Object.values(tracks).reduce((a, t) => a + (t.km || 0), 0)
  const sorted = [...journal].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="page stack">
      <div className="row between">
        <h2 className="section-title"><Icon name="journal" />יומן המסע</h2>
        <div className="row" style={{ gap: 6 }}><button className="btn btn--sm" onClick={exportText}><Icon name="share" size={16} /></button><button className="btn btn--primary btn--sm" onClick={() => { setEdit(blank()); setOpen(true) }}>+ רשומה</button></div>
      </div>
      <div className="card card--glow">
        <div className="row between"><span className="bold">ההתקדמות שלי</span><span className="bold" style={{ color: 'var(--orange)' }}>{pct}%</span></div>
        <div className="progress mt"><div style={{ width: pct + '%' }} /></div>
        <div className="grid-3 mt">
          <div className="stat"><div className="stat__value">{done.length}</div><div className="stat__label">מקטעים</div></div>
          <div className="stat"><div className="stat__value">{Math.round(doneKm)}</div><div className="stat__label">ק"מ הושלמו</div></div>
          <div className="stat"><div className="stat__value">{allPhotoIds.length}</div><div className="stat__label">תמונות</div></div>
        </div>
        {trackKm > 0 && <p className="tiny muted mt">נמדדו ב-GPS: {trackKm.toFixed(1)} ק"מ ב-{Object.keys(tracks).length} ימי הקלטה</p>}
        {pct >= 100 && <div className="alert alert--ok mt">🏆 סיימתם את שביל ישראל! כל הכבוד.</div>}
        {done.length > 0 && <button className="btn btn--sm btn--ghost mt" onClick={() => navigate('certificate')}>🏅 תעודת הוקרה להדפסה</button>}
      </div>
      <div className="segmented" style={{ alignSelf: 'center' }}>{[['list', '📓 רשומות'], ['gallery', '🖼️ גלריה'], ['stats', '📊 סיכום']].map(([k, v]) => <button key={k} className={view === k ? 'active' : ''} onClick={() => setView(k)}>{v}</button>)}</div>

      {view === 'list' && (journal.length === 0 ? <Empty icon="📓" text="עוד אין רשומות. תעדו כל יום – חוויות, אנשים, תמונות, נקודות מים, טיפים לבאים אחריכם." /> :
        sorted.map((e) => <Entry key={e.id} e={e} segments={segments} navigate={navigate} onOpen={() => { setEdit(e); setOpen(true) }} onPhoto={setLightbox} />))}

      {view === 'gallery' && <Gallery ids={allPhotoIds} onOpen={setLightbox} />}

      {view === 'stats' && <Stats journal={journal} segments={segments} tracks={tracks} />}

      <Modal open={open} onClose={() => setOpen(false)} title="רשומה ביומן">
        {edit && <EntryForm edit={edit} setEdit={setEdit} segments={segments} onSave={saveEntry} onDelete={() => remove(edit)} toast={toast} />}
      </Modal>
      {lightbox && <div className="lightbox" onClick={() => setLightbox(null)}><img src={lightbox} alt="" /></div>}
    </div>
  )
}

function Entry({ e, segments, navigate, onOpen, onPhoto }) {
  const seg = segments.find((s) => s.id === Number(e.segId))
  const [photos, setPhotos] = useState([])
  useEffect(() => { if (e.photos?.length) getPhotos(e.photos).then(setPhotos) }, [e.photos])
  return (
    <div className="card entry">
      {photos.length > 0 && <div className="entry__photos">{photos.map((p) => <img key={p.id} src={p.data} alt="" onClick={() => onPhoto(p.data)} />)}</div>}
      <div onClick={onOpen} style={{ cursor: 'pointer' }}>
        <div className="row between"><span className="bold" style={{ fontSize: 17 }}>{e.mood} {e.weather || ''} {fmtDate(e.date, { year: 'numeric' })}</span>{e.km && <span className="chip chip--orange">{e.km} ק"מ</span>}</div>
        {seg && <button className="linkbtn" onClick={(ev) => { ev.stopPropagation(); navigate(`segments/${seg.id}`) }}>מקטע {seg.id}: {seg.name_he}</button>}
        <p className="small mt" style={{ whiteSpace: 'pre-wrap' }}>{e.text}</p>
        <div className="row tiny muted mt" style={{ gap: 10 }}>
          {e.sleep && <span>🛏 {e.sleep}</span>}{e.water && <span>💧 {e.water} ל'</span>}
          {e.pos && <span className="mono ltr">📍 {e.pos.lat.toFixed(4)}, {e.pos.lon.toFixed(4)}</span>}
        </div>
      </div>
    </div>
  )
}

function EntryForm({ edit, setEdit, segments, onSave, onDelete, toast }) {
  const file = useRef()
  const [photos, setPhotos] = useState([])
  const [busy, setBusy] = useState(false)
  useEffect(() => { getPhotos(edit.photos || []).then(setPhotos) }, [edit.photos])
  const addPhotos = async (files) => {
    setBusy(true)
    const ids = []
    for (const f of files) { try { ids.push(await savePhoto(f, { date: edit.date, segId: edit.segId })) } catch { toast('תמונה לא נשמרה') } }
    setEdit({ ...edit, photos: [...(edit.photos || []), ...ids] }); setBusy(false)
  }
  const removePhoto = async (id) => { await deletePhoto(id); setEdit({ ...edit, photos: edit.photos.filter((x) => x !== id) }) }
  return (
    <div className="stack">
      <div className="grid-2">
        <div className="field"><label>תאריך</label><input className="input" type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} /></div>
        <div className="field"><label>ק"מ היום</label><input className="input" type="number" inputMode="decimal" value={edit.km} onChange={(e) => setEdit({ ...edit, km: e.target.value })} /></div>
      </div>
      <div className="field"><label>מקטע</label><select className="select" value={edit.segId} onChange={(e) => setEdit({ ...edit, segId: e.target.value })}><option value="">—</option>{segments.map((s) => <option key={s.id} value={s.id}>{s.id}. {s.name_he}</option>)}</select></div>
      <div className="row between">
        <div className="field"><label>איך היה?</label><div className="row" style={{ gap: 4 }}>{MOODS.map((m) => <button key={m} className={`chip chip--btn ${edit.mood === m ? 'active' : ''}`} style={{ fontSize: 18, padding: '2px 8px' }} onClick={() => setEdit({ ...edit, mood: m })}>{m}</button>)}</div></div>
      </div>
      <div className="field"><label>מזג אוויר</label><div className="row" style={{ gap: 4 }}>{WEATHER.map((m) => <button key={m} className={`chip chip--btn ${edit.weather === m ? 'active' : ''}`} style={{ fontSize: 18, padding: '2px 8px' }} onClick={() => setEdit({ ...edit, weather: m })}>{m}</button>)}</div></div>
      <div className="grid-2">
        <div className="field"><label>איפה ישנתי</label><input className="input" value={edit.sleep || ''} onChange={(e) => setEdit({ ...edit, sleep: e.target.value })} placeholder="חניון לילה / מלאך שביל…" /></div>
        <div className="field"><label>ליטרים ששתיתי</label><input className="input" type="number" inputMode="decimal" value={edit.water || ''} onChange={(e) => setEdit({ ...edit, water: e.target.value })} /></div>
      </div>
      <div className="field"><label>מה קרה היום?</label><textarea className="textarea" value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} placeholder="אנשים שפגשתם, נוף, מים, לינה, מה הייתם עושים אחרת…" /></div>
      <div className="field">
        <label>תמונות ({photos.length})</label>
        <div className="entry__photos">
          {photos.map((p) => <div key={p.id} style={{ position: 'relative' }}><img src={p.data} alt="" /><button className="photo-x" onClick={() => removePhoto(p.id)}>✕</button></div>)}
          <button className="photo-add" onClick={() => file.current.click()} disabled={busy}>{busy ? '…' : <><Icon name="camera" />הוספה</>}</button>
        </div>
        <input ref={file} type="file" accept="image/*" multiple capture="environment" hidden onChange={(e) => addPhotos([...e.target.files])} />
        <p className="tiny muted">התמונות נדחסות ונשמרות במכשיר בלבד (IndexedDB). מומלץ לגבות מדי פעם.</p>
      </div>
      <div className="row between">
        <button className="btn btn--ghost btn--sm" style={{ color: 'var(--red)' }} onClick={onDelete}>מחיקה</button>
        <button className="btn btn--primary" onClick={onSave}>שמירה</button>
      </div>
    </div>
  )
}

function Gallery({ ids, onOpen }) {
  const [photos, setPhotos] = useState([])
  useEffect(() => { getPhotos(ids).then(setPhotos) }, [ids.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!photos.length) return <Empty icon="🖼️" text="עוד אין תמונות. הוסיפו תמונות לרשומות היומן." />
  return <div className="gallery">{photos.map((p) => <img key={p.id} src={p.data} alt="" loading="lazy" onClick={() => onOpen(p.data)} />)}</div>
}

function Stats({ journal, segments, tracks }) {
  const days = journal.length
  const km = journal.reduce((a, e) => a + (parseFloat(e.km) || 0), 0)
  const moods = MOODS.map((m) => [m, journal.filter((e) => e.mood === m).length])
  const best = [...journal].sort((a, b) => (parseFloat(b.km) || 0) - (parseFloat(a.km) || 0))[0]
  const byDate = [...journal].sort((a, b) => a.date.localeCompare(b.date))
  const maxKm = Math.max(1, ...journal.map((e) => parseFloat(e.km) || 0))
  return (
    <div className="stack">
      <div className="grid-3">
        <div className="stat"><div className="stat__value">{days}</div><div className="stat__label">ימים מתועדים</div></div>
        <div className="stat"><div className="stat__value">{km.toFixed(0)}</div><div className="stat__label">ק"מ ביומן</div></div>
        <div className="stat"><div className="stat__value">{days ? (km / days).toFixed(1) : 0}</div><div className="stat__label">ממוצע יומי</div></div>
      </div>
      {byDate.length > 1 && (
        <div className="card"><div className="card__title">ק"מ לפי יום</div>
          <div className="bars">{byDate.map((e) => <div key={e.id} className="bar" title={`${e.date}: ${e.km} ק"מ`}><div style={{ height: `${((parseFloat(e.km) || 0) / maxKm) * 100}%` }} /><span>{e.date.slice(8)}</span></div>)}</div>
        </div>
      )}
      <div className="card"><div className="card__title">מצב רוח</div><div className="row" style={{ gap: 12 }}>{moods.map(([m, n]) => <span key={m} style={{ fontSize: 18 }}>{m} <b>{n}</b></span>)}</div></div>
      {best && <div className="card"><div className="card__title">היום הארוך ביותר</div><p>{fmtDate(best.date)} – {best.km} ק"מ {segments.find((s) => s.id === Number(best.segId))?.name_he || ''}</p></div>}
      {Object.keys(tracks).length > 0 && <div className="card"><div className="card__title">הקלטות GPS</div>{Object.entries(tracks).map(([d, t]) => <div key={d} className="small">{d}: {t.km.toFixed(1)} ק"מ · {t.points.length} נקודות</div>)}</div>}
    </div>
  )
}
