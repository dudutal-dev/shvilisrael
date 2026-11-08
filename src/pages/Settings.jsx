import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context.jsx'
import { Icon } from '../components/Icons.jsx'
import { exportAll, importAll, clearAll } from '../lib/storage.js'
import { download } from '../lib/gpx.js'
import { useToast } from '../hooks/useToast.jsx'
import { BASE_LAYERS } from '../components/MapView.jsx'
import { storageInfo, persistStorage, clearTiles } from '../lib/offline.js'
import { idbGet, idbSet } from '../lib/overpass.js'
import { getPhotos } from '../lib/photos.js'

export default function Settings({ theme, setTheme }) {
  const { prefs, setPrefs, meta, journal } = useApp()
  const [info, setInfo] = useState(null)
  const photoIds = journal.flatMap((e) => e.photos || [])
  const refresh = () => storageInfo().then(setInfo)
  useEffect(() => { refresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const toast = useToast()
  const file = useRef()
  const onImport = (e) => {
    const f = e.target.files?.[0]; if (!f) return
    f.text().then(async (t) => {
      const j = JSON.parse(t)
      const data = j._shvilBackup ? j.data : j
      importAll(data)
      for (const p of j._photos || []) await idbSet(`photo:${p.id}`, p)
      toast('הנתונים יובאו – טוען מחדש'); setTimeout(() => location.reload(), 800)
    }).catch(() => toast('קובץ לא תקין'))
  }
  const exportFull = async () => {
    const photos = await getPhotos(photoIds)
    download(`shvil-backup-full-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ _shvilBackup: 2, data: exportAll(), _photos: photos }), 'application/json')
    toast(`גיבוי מלא הורד (${photos.length} תמונות)`)
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
        <div className="card__title">💾 נתונים שמורים במכשיר</div>
        <p className="small muted">הכול נשמר במכשיר עצמו ונשאר בין פתיחות: התוכנית, היומן והתמונות, ההתקדמות, תוואי השביל ואריחי המפה שהורדתם. אין צורך להעלות או לשמור מחדש.</p>
        {info && (
          <div className="grid-3">
            <div className="stat"><div className="stat__value">{journal.length}</div><div className="stat__label">רשומות יומן</div></div>
            <div className="stat"><div className="stat__value">{photoIds.length}</div><div className="stat__label">תמונות</div></div>
            <div className="stat"><div className="stat__value">{info.tiles.toLocaleString()}</div><div className="stat__label">אריחי מפה</div></div>
            <div className="stat"><div className="stat__value">{info.trail ? '✓' : '–'}</div><div className="stat__label">תוואי השביל</div></div>
            <div className="stat"><div className="stat__value">{info.usageMB != null ? `${info.usageMB}` : '–'}</div><div className="stat__label">MB בשימוש</div></div>
            <div className="stat"><div className="stat__value">{info.persisted === true ? '🔒' : info.persisted === false ? '⚠' : '–'}</div><div className="stat__label">{info.persisted === true ? 'אחסון קבוע' : info.persisted === false ? 'לא קבוע' : 'אחסון'}</div></div>
          </div>
        )}
        {info?.persisted === false && <div className="alert alert--warn small"><div>הדפדפן טרם אישר אחסון קבוע – במצב של מחסור במקום הוא עלול למחוק מטמונים. <button className="linkbtn" onClick={() => persistStorage().then(refresh)}>בקשו אחסון קבוע</button>. ב-iPhone: התקנה על מסך הבית מבטיחה שהנתונים לא יימחקו אוטומטית.</div></div>}
        <p className="tiny muted">מפות לשימוש לא מקוון: בדף כל מקטע, בלשונית "מפה", יש כפתור להורדת אריחי המפה של המקטע. אריחים שנצפו במסך המפה נשמרים גם הם.</p>
        <div className="row"><button className="btn btn--sm btn--ghost" onClick={refresh}>רענון</button><button className="btn btn--sm btn--ghost" style={{ color: 'var(--red)' }} onClick={async () => { if (confirm('למחוק את כל אריחי המפה שהורדו?')) { await clearTiles(); refresh() } }}>מחיקת אריחי מפה</button></div>
      </div>
      <div className="card stack">
        <div className="card__title">גיבוי ושחזור</div>
        <p className="small muted">לפני החלפת טלפון או מחיקת האפליקציה – גבו לקובץ. "גיבוי מלא" כולל גם את התמונות (קובץ גדול יותר).</p>
        <div className="row">
          <button className="btn btn--primary" onClick={exportFull}><Icon name="download" size={18} />גיבוי מלא (כולל תמונות)</button>
          <button className="btn" onClick={() => { download(`shvil-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(exportAll(), null, 2), 'application/json'); toast('גיבוי הורד') }}><Icon name="download" size={18} />גיבוי ללא תמונות</button>
          <button className="btn" onClick={() => file.current.click()}>ייבוא גיבוי</button>
          <input ref={file} type="file" accept="application/json" hidden onChange={onImport} />
          <button className="btn btn--ghost" style={{ color: 'var(--red)' }} onClick={() => { if (confirm('למחוק את כל הנתונים השמורים במכשיר?')) { clearAll(); location.reload() } }}>איפוס מלא</button>
        </div>
      </div>
      <div className="card stack small">
        <div className="card__title">על האפליקציה</div>
        <p>אפליקציית תכנון וביצוע מסע בשביל ישראל. עובדת גם ללא אינטרנט לאחר הטעינה הראשונה (PWA) – הוסיפו למסך הבית.</p>
        <div className="dev-credit"><span className="blaze" style={{ width: 12, height: 18 }}><span className="w" /><span className="b" /><span className="o" /></span><span><b>פיתוח: דודו טל</b><br /><span className="tiny muted">שביל ישראל – מתכנן המסע</span></span></div>
        <div><b>מקורות נתונים:</b>
          <ul className="src-list">{(meta.sources || []).map((src, i) => {
            const url = src.url || (typeof src === 'string' ? src : '')
            const m = url.match(/^https?:\/\/([^/\s]+)/)
            const host = m ? m[1].replace(/^www\./, '') : ''
            const note = (src.name || '').startsWith('http') ? (src.name.match(/\(([^)]+)\)/) || [])[1] : src.name
            const label = note && !note.startsWith('http') ? note : host || src.name
            const href = m ? url.split(' ')[0] : null
            return <li key={i}>{href ? <a href={href} target="_blank" rel="noreferrer">{label}</a> : label}{href && label !== host && host ? <span className="muted"> · {host}</span> : null}</li>
          })}</ul>
        </div>
        <p className="muted">מפות: OpenStreetMap, Israel Hiking Map, OpenTopoMap. תמונות: Wikimedia Commons (רישיונות חופשיים, קרדיט מופיע על כל תמונה). מזג אוויר: Open-Meteo.</p>
        <p className="muted">⚠ המידע נאסף ממקורות ציבוריים ועשוי להשתנות (שינויי תוואי, סגירות ביטחוניות, שטחי אש, מחירים). לפני היציאה יש לאמת מול החברה להגנת הטבע, רשות הטבע והגנים והמפות העדכניות. האחריות על הבטיחות היא של המטייל.</p>
        <p className="tiny muted">עודכן: {meta.updated || '2026'}</p>
      </div>
    </div>
  )
}
