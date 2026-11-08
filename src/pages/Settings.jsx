import { useRef } from 'react'
import { useApp } from '../context.jsx'
import { Icon } from '../components/Icons.jsx'
import { exportAll, importAll, clearAll } from '../lib/storage.js'
import { download } from '../lib/gpx.js'
import { useToast } from '../hooks/useToast.jsx'
import { BASE_LAYERS } from '../components/MapView.jsx'

export default function Settings({ theme, setTheme }) {
  const { prefs, setPrefs, meta } = useApp()
  const toast = useToast()
  const file = useRef()
  const onImport = (e) => {
    const f = e.target.files?.[0]; if (!f) return
    f.text().then((t) => { importAll(JSON.parse(t)); toast('הנתונים יובאו – טוען מחדש'); setTimeout(() => location.reload(), 800) }).catch(() => toast('קובץ לא תקין'))
  }
  return (
    <div className="page stack">
      <h2 className="section-title"><Icon name="settings" />הגדרות</h2>
      <div className="card stack">
        <div className="field"><label>מראה</label>
          <div className="segmented">{[['light', 'בהיר'], ['dark', 'כהה'], ['auto', 'אוטומטי']].map(([k, v]) => <button key={k} className={theme === k ? 'active' : ''} onClick={() => setTheme(k)}>{v}</button>)}</div>
        </div>
        <div className="field"><label>מפת רקע</label>
          <select className="select" value={prefs.base} onChange={(e) => setPrefs({ ...prefs, base: e.target.value })}>{Object.entries(BASE_LAYERS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select>
        </div>
      </div>
      <div className="card stack">
        <div className="card__title">גיבוי ושחזור</div>
        <p className="small muted">התוכנית, היומן, ההתקדמות והציוד נשמרים במכשיר בלבד. גבו לקובץ לפני החלפת טלפון.</p>
        <div className="row">
          <button className="btn" onClick={() => { download(`shvil-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(exportAll(), null, 2), 'application/json'); toast('גיבוי הורד') }}><Icon name="download" size={18} />ייצוא גיבוי</button>
          <button className="btn" onClick={() => file.current.click()}>ייבוא גיבוי</button>
          <input ref={file} type="file" accept="application/json" hidden onChange={onImport} />
          <button className="btn btn--ghost" style={{ color: 'var(--red)' }} onClick={() => { if (confirm('למחוק את כל הנתונים השמורים במכשיר?')) { clearAll(); location.reload() } }}>איפוס מלא</button>
        </div>
      </div>
      <div className="card stack small">
        <div className="card__title">על האפליקציה</div>
        <p>אפליקציית תכנון וביצוע מסע בשביל ישראל. עובדת גם ללא אינטרנט לאחר הטעינה הראשונה (PWA) – הוסיפו למסך הבית.</p>
        <p><b>מקורות נתונים:</b> {(meta.sources || []).map((s, i) => <span key={i}>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a> : s.name || s}{i < meta.sources.length - 1 ? ' · ' : ''}</span>)}</p>
        <p className="muted">מפות: OpenStreetMap, Israel Hiking Map, OpenTopoMap. תמונות: Wikimedia Commons (רישיונות חופשיים, קרדיט מופיע על כל תמונה). מזג אוויר: Open-Meteo.</p>
        <p className="muted">⚠ המידע נאסף ממקורות ציבוריים ועשוי להשתנות (שינויי תוואי, סגירות ביטחוניות, שטחי אש, מחירים). לפני היציאה יש לאמת מול החברה להגנת הטבע, רשות הטבע והגנים והמפות העדכניות. האחריות על הבטיחות היא של המטייל.</p>
        <p className="tiny muted">עודכן: {meta.updated || '2026'}</p>
      </div>
    </div>
  )
}
