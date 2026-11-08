import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context.jsx';
import { Icon } from '../components/Icons.jsx';
import { exportAll, importAll, clearAll } from '../lib/storage.js';
import { download } from '../lib/gpx.js';
import { useToast } from '../hooks/useToast.jsx';
import { BASE_LAYERS } from '../components/MapView.jsx';
import { storageInfo, persistStorage, clearTiles } from '../lib/offline.js';
import { idbGet, idbSet } from '../lib/overpass.js';
import { getPhotos } from '../lib/photos.js';
import { t } from '../i18n/index.js'
import { trailNarrationSize, segmentClips, prefetch, cacheInfo, clearCache, narrationVoice } from '../lib/tts.js'
export default function Settings({
  theme,
  setTheme
}) {
  const {
    segments,
    prefs,
    setPrefs,
    meta,
    journal
  } = useApp();
  const [info, setInfo] = useState(null);
  const photoIds = journal.flatMap(e => e.photos || []);
  const refresh = () => storageInfo().then(setInfo);
  useEffect(() => {
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const toast = useToast();
  const file = useRef();
  const onImport = e => {
    const f = e.target.files?.[0];
    if (!f) return;
    f.text().then(async txt => {
      const j = JSON.parse(txt);
      const data = j._shvilBackup ? j.data : j;
      importAll(data);
      for (const p of j._photos || []) await idbSet(`photo:${p.id}`, p);
      toast(t("הנתונים יובאו – טוען מחדש"));
      setTimeout(() => location.reload(), 800);
    }).catch(() => toast(t("קובץ לא תקין")));
  };
  const exportFull = async () => {
    const photos = await getPhotos(photoIds);
    download(`shvil-backup-full-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({
      _shvilBackup: 2,
      data: exportAll(),
      _photos: photos
    }), 'application/json');
    toast(t("גיבוי מלא הורד ({0} תמונות)", photos.length));
  };
  return <div className="page stack">
      <h2 className="section-title"><Icon name="settings" />{t("הגדרות")}</h2>
      <div className="card stack">
        <div className="field"><label>{t("מראה")}</label>
          <div className="segmented">{[['light', t("בהיר")], ['dark', t("כהה")], ['auto', t("אוטומטי")]].map(([k, v]) => <button key={k} className={theme === k ? 'active' : ''} onClick={() => setTheme(k)}>{v}</button>)}</div>
        </div>
        <div className="field"><label>{t("מפת רקע")}</label>
          <select className="select" value={prefs.base} onChange={e => setPrefs({
          ...prefs,
          base: e.target.value
        })}>{Object.entries(BASE_LAYERS).map(([k, v]) => <option key={k} value={k}>{t(v.name)}</option>)}</select>
        </div>
      </div>
      <NarrationCard toast={toast} segments={segments} />
      <div className="card stack">
        <div className="card__title">{t("💾 נתונים שמורים במכשיר")}</div>
        <p className="small muted">{t("הכול נשמר במכשיר עצמו ונשאר בין פתיחות: התוכנית, היומן והתמונות, ההתקדמות, תוואי השביל ואריחי המפה שהורדתם. אין צורך להעלות או לשמור מחדש.")}</p>
        {info && <div className="grid-3">
            <div className="stat"><div className="stat__value">{journal.length}</div><div className="stat__label">{t("רשומות יומן")}</div></div>
            <div className="stat"><div className="stat__value">{photoIds.length}</div><div className="stat__label">{t("תמונות")}</div></div>
            <div className="stat"><div className="stat__value">{info.tiles.toLocaleString()}</div><div className="stat__label">{t("אריחי מפה")}</div></div>
            <div className="stat"><div className="stat__value">{info.trail ? '✓' : '–'}</div><div className="stat__label">{t("תוואי השביל")}</div></div>
            <div className="stat"><div className="stat__value">{info.usageMB != null ? `${info.usageMB}` : '–'}</div><div className="stat__label">{t("MB בשימוש")}</div></div>
            <div className="stat"><div className="stat__value">{info.persisted === true ? '🔒' : info.persisted === false ? '⚠' : '–'}</div><div className="stat__label">{info.persisted === true ? t("אחסון קבוע") : info.persisted === false ? t("לא קבוע") : t("אחסון")}</div></div>
          </div>}
        {info?.persisted === false && <div className="alert alert--warn small"><div>{t("הדפדפן טרם אישר אחסון קבוע – במצב של מחסור במקום הוא עלול למחוק מטמונים.")} <button className="linkbtn" onClick={() => persistStorage().then(refresh)}>{t("בקשו אחסון קבוע")}</button>{t(". ב-iPhone: התקנה על מסך הבית מבטיחה שהנתונים לא יימחקו אוטומטית.")}</div></div>}
        <p className="tiny muted">{t("מפות לשימוש לא מקוון: בדף כל מקטע, בלשונית \"מפה\", יש כפתור להורדת אריחי המפה של המקטע. אריחים שנצפו במסך המפה נשמרים גם הם.")}</p>
        <div className="row"><button className="btn btn--sm btn--ghost" onClick={refresh}>{t("רענון")}</button><button className="btn btn--sm btn--ghost" style={{
          color: 'var(--red)'
        }} onClick={async () => {
          if (confirm(t("למחוק את כל אריחי המפה שהורדו?"))) {
            await clearTiles();
            refresh();
          }
        }}>{t("מחיקת אריחי מפה")}</button></div>
      </div>
      <div className="card stack">
        <div className="card__title">{t("גיבוי ושחזור")}</div>
        <p className="small muted">{t("לפני החלפת טלפון או מחיקת האפליקציה – גבו לקובץ. \"גיבוי מלא\" כולל גם את התמונות (קובץ גדול יותר).")}</p>
        <div className="row">
          <button className="btn btn--primary" onClick={exportFull}><Icon name="download" size={18} />{t("גיבוי מלא (כולל תמונות)")}</button>
          <button className="btn" onClick={() => {
          download(`shvil-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(exportAll(), null, 2), 'application/json');
          toast(t("גיבוי הורד"));
        }}><Icon name="download" size={18} />{t("גיבוי ללא תמונות")}</button>
          <button className="btn" onClick={() => file.current.click()}>{t("ייבוא גיבוי")}</button>
          <input ref={file} type="file" accept="application/json" hidden onChange={onImport} />
          <button className="btn btn--ghost" style={{
          color: 'var(--red)'
        }} onClick={() => {
          if (confirm(t("למחוק את כל הנתונים השמורים במכשיר?"))) {
            clearAll();
            location.reload();
          }
        }}>{t("איפוס מלא")}</button>
        </div>
      </div>
      <div className="card stack small">
        <div className="card__title">{t("על האפליקציה")}</div>
        <p>{t("אפליקציית תכנון וביצוע מסע בשביל ישראל. עובדת גם ללא אינטרנט לאחר הטעינה הראשונה (PWA) – הוסיפו למסך הבית.")}</p>
        <div className="dev-credit"><span className="blaze" style={{
          width: 12,
          height: 18
        }}><span className="w" /><span className="b" /><span className="o" /></span><span><b>{t("פיתוח: דודו טל")}</b><br /><span className="tiny muted">{t("שביל ישראל – מתכנן המסע")}</span></span></div>
        <div><b>{t("מקורות נתונים:")}</b>
          <ul className="src-list">{(meta.sources || []).map((src, i) => {
            const url = src.url || (typeof src === 'string' ? src : '');
            const m = url.match(/^https?:\/\/([^/\s]+)/);
            const host = m ? m[1].replace(/^www\./, '') : '';
            const note = (src.name || '').startsWith('http') ? (src.name.match(/\(([^)]+)\)/) || [])[1] : src.name;
            const label = note && !note.startsWith('http') ? note : host || src.name;
            const href = m ? url.split(' ')[0] : null;
            return <li key={i}>{href ? <a href={href} target="_blank" rel="noreferrer">{label}</a> : label}{href && label !== host && host ? <span className="muted"> · {host}</span> : null}</li>;
          })}</ul>
        </div>
        <p className="muted">{t("מפות: OpenStreetMap, Israel Hiking Map, OpenTopoMap. תמונות: Wikimedia Commons (רישיונות חופשיים, קרדיט מופיע על כל תמונה). מזג אוויר: Open-Meteo.")}</p>
        <p className="muted">{t("⚠ המידע נאסף ממקורות ציבוריים ועשוי להשתנות (שינויי תוואי, סגירות ביטחוניות, שטחי אש, מחירים). לפני היציאה יש לאמת מול החברה להגנת הטבע, רשות הטבע והגנים והמפות העדכניות. האחריות על הבטיחות היא של המטייל.")}</p>
        <p className="tiny muted">{t("עודכן:")} {meta.updated || '2026'}</p>
      </div>
    </div>;
}
function NarrationCard({ toast, segments }) {
  const [info, setInfo] = useState(null);
  const [dl, setDl] = useState(null);
  const total = trailNarrationSize(segments);
  const refresh = () => cacheInfo().then(setInfo);
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const downloadAll = async () => {
    const urls = segments.flatMap(s => segmentClips(s.id, s.steps_he || []).filter(Boolean).map(c => c.url));
    const ctl = new AbortController(); setDl({ done: 0, total: urls.length, ctl });
    try { await prefetch(urls, (done, t2) => setDl({ done, total: t2, ctl }), ctl.signal); toast(t("הקריינות של כל השביל שמורה במכשיר")); }
    catch (e) { toast(t("הורדת הקריינות נכשלה: {0}", e.message)); }
    setDl(null); refresh();
  };
  return <div className="card stack">
      <div className="card__title">{t("🎙️ קריינות סיפור הדרך")}</div>
      <p className="small">{t("עברית: קריינות ElevenLabs מוכנה מראש (קול {0}) לכל {1} השלבים – מתנגנת בלי מפתח ובלי חשבון. אנגלית: הקול המובנה של המכשיר.", narrationVoice(), total.clips)}</p>
      <p className="tiny muted">{t("קטע שהושמע פעם אחת נשמר אוטומטית. לפני היציאה אפשר להוריד את הקריינות של מקטע (בסיפור הדרך) או של כל השביל כאן, כדי שתעבוד גם בלי קליטה.")}</p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn--sm btn--primary" onClick={downloadAll} disabled={!!dl || !total.clips}>{dl ? t("מוריד {0}/{1}", dl.done, dl.total) : t("⬇️ הורדת קריינות לכל השביל ({0} MB)", (total.bytes / 1048576).toFixed(0))}</button>
        {dl && <button className="btn btn--sm" onClick={() => dl.ctl.abort()}>{t("עצירה")}</button>}
      </div>
      {info && <p className="tiny muted">{t("שמור במכשיר: {0} מתוך {1} קטעים · {2} MB", info.clips, total.clips, (info.bytes / 1048576).toFixed(1))} {info.clips > 0 && <button className="linkbtn tiny" onClick={async () => { await clearCache(); refresh(); }}>{t("מחיקה")}</button>}</p>}
    </div>;
}
