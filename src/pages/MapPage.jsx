import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context.jsx';
import { MapView, BASE_LAYERS } from '../components/MapView.jsx';
import { Icon } from '../components/Icons.jsx';
import { Modal } from '../components/UI.jsx';
import { useGeolocation } from '../hooks/useGeolocation.js';
import { loadTrailGeometry, idbGet, idbDel, TRAIL_KEY } from '../lib/overpass.js';
import { nearest, formatKm, bearing, compassLabelLong, lineLength, haversine } from '../lib/geo.js';
import { buildIndex, locate, slice } from '../lib/progress.js';
import { appendPoint, loadTracks } from '../lib/track.js';
import { linesToGPX, download } from '../lib/gpx.js';
import { sunTimes, fmtTime } from '../lib/sun.js';
import { toISODate } from '../lib/dates.js';
import { useToast } from '../hooks/useToast.jsx';
import lodgingRaw from '../data/lodging.json';
const lodging = tdata(lodgingRaw);
import logisticsRaw from '../data/logistics.json';
const logistics = tdata(logisticsRaw);
import { useWeather } from '../hooks/useWeather.js';
import { allPois } from '../lib/pois.js';
import { wmoText, heatRisk } from '../lib/weather.js';
import { t, tf, tdata } from '../i18n/index.js'
export default function MapPage({
  query,
  navigate
}) {
  const {
    segments,
    prefs,
    setPrefs,
    plan,
    done,
    totalKm
  } = useApp();
  const toast = useToast();
  const [gps, setGps] = useState(false);
  const [follow, setFollow] = useState(false);
  const [rec, setRec] = useState(false);
  const {
    pos,
    error
  } = useGeolocation(gps);
  const [lines, setLines] = useState(null);
  const [status, setStatus] = useState('');
  const [layersOpen, setLayersOpen] = useState(false);
  const [panel, setPanel] = useState(true);
  const [show, setShow] = useState({
    camps: true,
    lodging: false,
    water: false,
    angels: false,
    pois: true
  });
  const [track, setTrack] = useState(null);
  const offTrail = useRef(false);
  const relationId = logistics?.navigation?.osm_relation_id;
  const today = toISODate(new Date());
  const wx = useWeather(pos?.lat, pos?.lon, {
    days: 1,
    hourly: true,
    refreshMin: 20
  });
  useEffect(() => {
    idbGet(TRAIL_KEY).then(d => d?.lines && setLines(d.lines));
  }, []);
  useEffect(() => {
    loadTracks().then(all => setTrack(all[today] || null));
  }, [today]);
  useEffect(() => {
    if (error) toast(error);
  }, [error]); // eslint-disable-line react-hooks/exhaustive-deps
  const index = useMemo(() => lines ? buildIndex(lines) : null, [lines]);

  // record breadcrumbs
  useEffect(() => {
    if (!rec || !pos) return;
    appendPoint(today, pos).then(setTrack);
  }, [pos, rec, today]);
  const fitTo = useMemo(() => {
    const s = query.seg && segments.find(x => x.id === Number(query.seg));
    if (s?.start?.lat && s?.end?.lat) return {
      bounds: [[s.start.lat, s.start.lon], [s.end.lat, s.end.lon]]
    };
    if (query.lat) return {
      center: [Number(query.lat), Number(query.lon)],
      zoom: 14
    };
    return null;
  }, [query.seg, query.lat, query.lon, segments]);
  const pois = useMemo(() => {
    const out = [];
    if (show.camps) for (const c of lodging.night_camps || []) out.push({
      lat: c.lat,
      lon: c.lon,
      icon: '⛺',
      title: c.name_he,
      html: `<b>⛺ ${c.name_he}</b><br/>${c.facilities_he || ''}<br/><span style="color:#666">${c.notes_he || ''}</span>`
    });
    if (show.lodging) for (const c of lodging.paid_lodging || []) if (c.lat) out.push({
      lat: c.lat,
      lon: c.lon,
      icon: c.type === 'field_school' ? '🏫' : '🏨',
      title: c.name_he,
      html: `<b>${c.name_he}</b><br/>${c.type_he || ''} · ${c.price_he || ''}<br/>${c.url ? t("<a href=\"{0}\" target=\"_blank\">אתר/הזמנה</a>", c.url) : ''}`
    });
    if (show.angels) for (const a of lodging.trail_angels?.notable_locations || []) if (a.lat) out.push({
      lat: a.lat,
      lon: a.lon,
      icon: '😇',
      title: a.settlement_he,
      html: t("<b>😇 {0}</b><br/>{1}<br/><a href=\"#/guide/angels\">למדריך מלאכי השביל</a>", a.settlement_he, a.note || '')
    });
    if (show.pois) for (const p of allPois()) if (p.lat != null) out.push({
      lat: p.lat,
      lon: p.lon,
      icon: '🏛️',
      title: p.title,
      html: t("<div style=\"max-width:220px\">{0}<b>{1}</b><br/><span style=\"font-size:12px\">{2}…</span><br/><a href=\"{3}\" target=\"_blank\">לקריאה בוויקיפדיה</a></div>", p.image ? `<img src="${p.image}" style="width:100%;border-radius:8px;margin-bottom:6px" referrerpolicy="no-referrer"/>` : '', p.title, (p.extract || '').slice(0, 160), p.url)
    });
    if (show.water) for (const w of logistics?.water?.points || []) if (w.lat) out.push({
      lat: w.lat,
      lon: w.lon,
      icon: '💧',
      title: w.name_he,
      html: `<b>💧 ${w.name_he}</b><br/>${w.notes_he || ''}`
    });
    return out;
  }, [show]);

  // live info
  const live = useMemo(() => {
    if (!pos) return null;
    const loc = index ? locate(index, pos) : null;
    const pts = segments.flatMap(s => [{
      ...s.start,
      label: t("תחילת {0} ({1})", s.id, tf(s.start, 'short')),
      segId: s.id,
      kind: 'start'
    }, {
      ...s.end,
      label: t("סוף {0} ({1})", s.id, s.end?.name_he),
      segId: s.id,
      kind: 'end'
    }]).filter(p => p.lat);
    const n = nearest(pos, pts);
    // current segment = the one whose start/end pair brackets us best
    let cur = null,
      best = Infinity;
    for (const s of segments) {
      if (!s.start?.lat || !s.end?.lat) continue;
      const d = haversine(pos, s.start) + haversine(pos, s.end) - haversine(s.start, s.end);
      if (d < best) {
        best = d;
        cur = s;
      }
    }
    const camps = (lodging.night_camps || []).filter(c => c.lat);
    const nc = camps.length ? nearest(pos, camps) : null;
    const sobo = plan.direction !== 'nobo';
    const kmDone = loc ? sobo ? loc.km : index.total - loc.km : null;
    const pct = kmDone != null ? Math.max(0, Math.min(100, kmDone / index.total * 100)) : null;
    const sun = sunTimes(new Date(), pos.lat, pos.lon);
    const hoursLeft = sun.sunset ? Math.max(0, (sun.sunset - Date.now()) / 3600000) : null;
    const speed = pos.speed && pos.speed > 0.4 ? pos.speed * 3.6 : 3.5;
    return {
      loc,
      n,
      cur,
      nc,
      kmDone,
      pct,
      sun,
      hoursLeft,
      speed,
      sobo
    };
  }, [pos, index, segments, plan.direction]);

  // off-trail alert
  useEffect(() => {
    if (!live?.loc) return;
    const off = live.loc.dist > 0.35;
    if (off && !offTrail.current) {
      navigator.vibrate?.([200, 100, 200]);
      toast(t("⚠ סטיתם מהשביל ({0})", formatKm(live.loc.dist)));
    }
    offTrail.current = off;
  }, [live?.loc?.dist]); // eslint-disable-line react-hooks/exhaustive-deps

  const overlays = useMemo(() => {
    const out = [];
    if (index && live?.loc) out.push({
      points: slice(index, live.sobo ? 0 : index.total, live.loc.km),
      color: '#16a34a',
      weight: 6,
      opacity: 0.85
    });
    if (track?.points?.length > 1) out.push({
      points: track.points.map(p => [p[0], p[1]]),
      color: '#7c3aed',
      weight: 3,
      opacity: 0.9
    });
    return out;
  }, [index, live?.loc?.km, live?.sobo, track]);
  const downloadTrail = async () => {
    try {
      setStatus(t("מוריד תוואי…"));
      const d = await loadTrailGeometry({
        relationId,
        force: true,
        onStatus: setStatus
      });
      setLines(d.lines);
      setStatus('');
      toast(t("התוואי הורד ונשמר ({0} ק\"מ)", Math.round(d.lines.reduce((a, l) => a + lineLength(l), 0))));
    } catch {
      setStatus('');
      toast(t("ההורדה נכשלה – בדקו חיבור לאינטרנט ונסו שוב"));
    }
  };
  const removeTrail = async () => {
    await idbDel(TRAIL_KEY);
    setLines(null);
    toast(t("התוואי נמחק מהמכשיר"));
  };
  const doneKmSegs = segments.filter(s => done.includes(s.id)).reduce((a, s) => a + s.distance_km, 0);
  return <div className="page page--full">
      <div className="map-wrap">
        <MapView segments={segments} lines={lines} pois={pois} user={pos} follow={follow} base={prefs.base} fitTo={fitTo} selectedId={query.seg ? Number(query.seg) : null} overlays={overlays} />
        <div className="map-ctl map-ctl--tr">
          <button className={`mapbtn ${gps ? 'active' : ''}`} onClick={() => {
          setGps(!gps);
          setFollow(!gps);
        }} title="GPS"><Icon name="locate" /></button>
          {gps && <button className={`mapbtn ${follow ? 'active' : ''}`} onClick={() => setFollow(!follow)} title={t("עקוב אחרי")}>🎯</button>}
          {gps && <button className={`mapbtn ${rec ? 'active rec' : ''}`} onClick={() => {
          setRec(!rec);
          toast(rec ? t("ההקלטה נעצרה") : t("מקליט את המסלול שלך"));
        }} title={t("הקלטת מסלול")}>{rec ? '⏺' : '⏺'}</button>}
          <button className="mapbtn" onClick={() => setLayersOpen(true)} title={t("שכבות")}><Icon name="layers" /></button>
        </div>

        {/* progress bar along the top */}
        <div className="map-progress">
          <div className="map-progress__bar"><div style={{
            width: `${live?.pct ?? (totalKm ? doneKmSegs / totalKm * 100 : 0)}%`
          }} /></div>
          <div className="map-progress__text">
            {live?.pct != null ? <>{t("📍 ק\"מ")} {live.kmDone.toFixed(1)} {t("מתוך")} {index.total.toFixed(0)} · <b>{live.pct.toFixed(1)}%</b> {t("מהשביל")}</> : <>{done.length} {t("מקטעים הושלמו ·")} {Math.round(doneKmSegs)} {t("ק\"מ (")}{totalKm ? Math.round(doneKmSegs / totalKm * 100) : 0}%)</>}
          </div>
        </div>

        <div className={`map-panel ${panel ? '' : 'map-panel--min'}`}>
          <button className="map-panel__handle" onClick={() => setPanel(!panel)}>{panel ? '⌄' : '⌃'}</button>
          {status ? <div className="small">{status}</div> : pos && live ? <div className="stack" style={{
          gap: 6
        }}>
              <div className="row between">
                <div className="bold row" style={{
              gap: 6
            }}>{live.cur ? <><button className="linkbtn" onClick={() => navigate(`segments/${live.cur.id}`)}>{t("מקטע")} {live.cur.id}: {tf(live.cur, 'name')}</button><button className="btn btn--sm btn--primary" onClick={() => navigate(`segments/${live.cur.id}/story`)}>{t("🧭 סיפור דרך")}</button></> : t("מחוץ למקטעים")}</div>
                <span className="tiny muted">±{Math.round(pos.accuracy)} {t("מ'")}</span>
              </div>
              {panel && <>
                  <div className="live-grid">
                    {live.loc && <div className={`live ${live.loc.dist > 0.35 ? 'live--warn' : ''}`}><b>{formatKm(live.loc.dist)}</b><span>{t("מהשביל")}</span></div>}
                    {live.nc && <div className="live"><b>{formatKm(live.nc.dist)}</b><span>⛺ {live.nc.point.name_he.replace(t("חניון לילה"), '')}</span></div>}
                    {live.n && <div className="live"><b>{formatKm(live.n.dist)}</b><span>{live.n.point.label} {compassLabelLong(bearing(pos, live.n.point))}</span></div>}
                    <div className="live"><b>{track ? track.km.toFixed(1) : '0.0'}</b><span>{t("ק\"מ היום")} {rec ? '⏺' : ''}</span></div>
                    <div className="live"><b>{pos.speed ? (pos.speed * 3.6).toFixed(1) : '0'}</b><span>{t("קמ\"ש ·")} {pos.altitude != null ? t("{0} מ'", Math.round(pos.altitude)) : ''}</span></div>
                    <div className={`live ${live.hoursLeft < 2 ? 'live--warn' : ''}`}><b>{fmtTime(live.sun.sunset)}</b><span>{t("שקיעה ·")} {live.hoursLeft?.toFixed(1)} {t("ש׳ אור")}</span></div>
                  </div>
                  {live.nc && live.hoursLeft != null && <div className={`tiny ${live.nc.dist / live.speed > live.hoursLeft ? 'txt-warn' : 'muted'}`}>{t("זמן משוער לחניון הקרוב בקצב")} {live.speed.toFixed(1)} {t("קמ\"ש:")} <b>{(live.nc.dist / live.speed * 60).toFixed(0)} {t("דק׳")}</b>{live.nc.dist / live.speed > live.hoursLeft ? t("– לא תספיקו לפני החשכה!") : ''}
                    </div>}
                  {wx.data?.current && <WxLine data={wx.data} onClick={() => navigate('weather')} />}
                  <div className="tiny muted mono ltr">{pos.lat.toFixed(5)}, {pos.lon.toFixed(5)}</div>
                </>}
            </div> : <div className="small">{gps ? (error ? <div className="alert alert--warn small"><b>{t("המיקום לא התקבל:")}</b> {error}<div className="tiny mt">{t("אייפון: הגדרות → פרטיות ואבטחה → שירותי מיקום → הדפדפן/האפליקציה → \"בזמן השימוש\". בחוץ ה-GPS מדויק יותר מאשר בתוך מבנה.")}</div><button className="btn btn--sm mt" onClick={() => { setGps(false); setTimeout(() => setGps(true), 50); }}>{t("נסו שוב")}</button></div> : <span>{t("מחפש לוויינים…")} <span className="muted">{t("(בפעם הראשונה אשרו גישה למיקום)")}</span></span>) : <div className="stack" style={{ gap: 8 }}><button className="btn btn--primary" onClick={() => { setGps(true); setFollow(true); }}>{t("📍 הפעל GPS – הצג את מיקומי על המפה")}</button><span className="tiny muted">{lines ? t("עובד גם בלי תוכנית: תראו את הנקודה הכחולה, המרחק מהשביל והמקטע הקרוב.") : t("מוצג תוואי סכמטי. הורידו את התוואי המלא (שכבות ←) לדיוק מלא ולחישוב התקדמות")}</span></div>}</div>}
        </div>
      </div>

      <Modal open={layersOpen} onClose={() => setLayersOpen(false)} title={t("שכבות ומפות")}>
        <div className="stack">
          <div>
            <div className="bold mb">{t("מפת רקע")}</div>
            <div className="stack" style={{
            gap: 6
          }}>
              {Object.entries(BASE_LAYERS).map(([k, v]) => <label key={k} className="row"><input type="radio" name="base" checked={prefs.base === k} onChange={() => setPrefs({
                ...prefs,
                base: k
              })} />{v.name}</label>)}
            </div>
            <p className="tiny muted mt">{t("מפת הטיולים של ישראל מציגה סימוני שבילים ואת שביל ישראל. אריחים שנצפו נשמרים לשימוש לא מקוון – גללו מראש על המקטעים שלכם.")}</p>
          </div>
          <div>
            <div className="bold mb">{t("נקודות עניין")}</div>
            {[['camps', t("⛺ חניוני לילה")], ['pois', t("🏛️ נקודות עניין (ויקיפדיה)")], ['angels', t("😇 מלאכי שביל (יישובים)")], ['lodging', t("🏨 לינה בתשלום / בתי ספר שדה")], ['water', t("💧 נקודות מים")]].map(([k, v]) => <div key={k}><label className="switch mt"><input type="checkbox" checked={show[k]} onChange={e => setShow({
                ...show,
                [k]: e.target.checked
              })} /> {v}</label></div>)}
          </div>
          <div>
            <div className="bold mb">{t("תוואי השביל המלא (OpenStreetMap)")}</div>
            <p className="small muted">{t("הורדה חד-פעמית של תוואי שביל ישראל מ-OSM. נשמר במכשיר ומאפשר: חישוב אחוז התקדמות, מרחק מהשביל והתרעת סטייה – גם בלי אינטרנט.")}</p>
            <div className="row mt">
              <button className="btn btn--primary btn--sm" onClick={downloadTrail} disabled={!!status}>{lines ? t("רענון התוואי") : t("הורדת התוואי")}</button>
              {lines && <button className="btn btn--sm" onClick={() => {
              download('israel-national-trail.gpx', linesToGPX(lines));
              toast(t("GPX הורד"));
            }}>{t("ייצוא GPX")}</button>}
              {lines && <button className="btn btn--ghost btn--sm" onClick={removeTrail}>{t("מחיקה")}</button>}
            </div>
          </div>
          <div className="alert alert--info small">{t("לניווט שטח אמיתי מומלץ להחזיק גם אפליקציה ייעודית (Israel Hiking Map / עמוד ענן) ומפת סימון שבילים מודפסת. ה-GPS תלוי בסוללה ובקליטה.")}</div>
        </div>
      </Modal>
    </div>;
}
function WxLine({
  data,
  onClick
}) {
  const c = data.current,
    h = data.hourly;
  const risk = heatRisk(c.apparent_temperature, c.uv_index);
  const now = Date.now();
  const i0 = h?.time ? Math.max(0, h.time.findIndex(ts => new Date(ts).getTime() >= now)) : -1;
  const next = i0 >= 0 ? [i0 + 2, i0 + 4, i0 + 6].filter(i => i < h.time.length) : [];
  const rainSoon = next.some(i => (h.precipitation_probability?.[i] || 0) >= 40);
  return <div className={`tiny row ${risk?.level === 'danger' || rainSoon ? 'txt-warn' : 'muted'}`} style={{
    gap: 8,
    cursor: 'pointer'
  }} onClick={onClick}>
      <span>{wmoText(c.weather_code)[1]} {Math.round(c.temperature_2m)}{t("° (מורגש")} {Math.round(c.apparent_temperature)}°)</span>
      <span>💨 {Math.round(c.wind_speed_10m)}</span><span>UV {c.uv_index}</span>
      {next.map(i => <span key={i} className="wx-pill">{new Date(h.time[i]).getHours()}:00 {wmoText(h.weather_code[i])[1]} {Math.round(h.temperature_2m[i])}°{(h.precipitation_probability?.[i] || 0) >= 20 ? ` ☔${h.precipitation_probability[i]}%` : ''}</span>)}
      {rainSoon && <span>{t("⚠ גשם בקרוב")}</span>}
    </div>;
}