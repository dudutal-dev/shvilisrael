import { useMemo, useState } from 'react';
import { useApp } from '../context.jsx';
import { Photo } from '../components/Photo.jsx';
import { Difficulty, Stat, Alert, Section, Acc } from '../components/UI.jsx';
import { MapView, BASE_LAYERS } from '../components/MapView.jsx';
const BASE_LAYERS_NAME = k => BASE_LAYERS[k]?.name || '';
import { Icon } from '../components/Icons.jsx';
import { navLinks, formatCoord } from '../lib/geo.js';
import { waypointsToGPX, download } from '../lib/gpx.js';
import { useToast } from '../hooks/useToast.jsx';
import lodging from '../data/lodging.json';
import spniAngels from '../data/spni/angels.json';
import { gearFor } from '../lib/gear.js';
import { poisForSegment } from '../lib/pois.js';
import { PoiCards } from '../components/PoiCards.jsx';
import { tileUrls, downloadTiles, segmentBounds } from '../lib/offline.js';
import { WeatherNow, WeatherDaily, WeatherFlags } from '../components/Weather.jsx';
import { useWeather } from '../hooks/useWeather.js';
import { regionGroup } from '../lib/season.js';
import { HE_MONTHS } from '../lib/dates.js';
import { t, tf, tSeason, isEn, tl, heDir } from '../i18n/index.js'
export default function SegmentDetail({
  id,
  navigate
}) {
  const {
    segments,
    done,
    toggleDone,
    notes,
    setNotes,
    prefs
  } = useApp();
  const toast = useToast();
  const seg = segments.find(s => s.id === Number(id));
  const [tab, setTab] = useState('info');
  const [month, setMonth] = useState(new Date().getMonth());
  const [temp, setTemp] = useState(24);
  const [dl, setDl] = useState(null);
  const downloadMap = async () => {
    const urls = tileUrls(segmentBounds(seg), [11, 12, 13, 14, 15], prefs.base);
    setDl({
      done: 0,
      failed: 0,
      skipped: 0,
      total: urls.length
    });
    const r = await downloadTiles(urls, setDl);
    setDl({
      ...r,
      finished: true
    });
    toast(r.failed ? t("הורדו {0} מתוך {1} אריחים ({2} נכשלו)", r.done + r.skipped, r.total, r.failed) : t("מפת המקטע שמורה במכשיר ({0} אריחים) ✓", r.total));
  };
  const [weight, setWeight] = useState(70);
  const gear = useMemo(() => gearFor(seg, month), [seg, month]);
  const wx = useWeather(seg?.start?.lat, seg?.start?.lon, {
    days: 7
  });
  const [wxDay, setWxDay] = useState(0);
  const idx = segments.findIndex(s => s.id === Number(id));
  const prev = segments[idx - 1],
    next = segments[idx + 1];
  const fit = useMemo(() => seg?.start?.lat && seg?.end?.lat ? {
    bounds: [[seg.start.lat, seg.start.lon], [seg.end.lat, seg.end.lon]]
  } : null, [seg]);
  const nearbyCamps = useMemo(() => {
    if (!seg?.end?.lat || !lodging.night_camps) return [];
    return lodging.night_camps.filter(c => c.lat && Math.abs(c.lat - seg.end.lat) < 0.15 && Math.abs(c.lon - seg.end.lon) < 0.15);
  }, [seg]);
  if (!seg) return <div className="page"><Alert kind="warn">{t("המקטע לא נמצא")}</Alert></div>;
  const isDone = done.includes(seg.id);
  const links = seg.start?.lat ? navLinks(seg.start.lat, seg.start.lon, tf(seg.start, 'short')) : null;
  const exportGpx = () => {
    download(`INT-${seg.id}-${seg.name_en || 'segment'}.gpx`, waypointsToGPX([{
      ...seg.start,
      name: t("התחלה: {0}", tf(seg.start, 'short')),
      sym: 'Flag, Green'
    }, {
      ...seg.end,
      name: t("סיום: {0}", tf(seg.end, 'short')),
      sym: 'Flag, Red'
    }], t("שביל ישראל – מקטע {0}", seg.id)));
    toast(t("קובץ GPX הורד"));
  };
  const share = async () => {
    const text = t("שביל ישראל – מקטע {0}: {1} {2} ק\"מ · {3} {4}", seg.id, tf(seg, 'name'), seg.distance_km, t(seg.region_spni || seg.region), location.href);
    if (navigator.share) {
      try {
        await navigator.share({
          title: tf(seg, 'name'),
          text
        });
      } catch {/* cancelled */}
    } else {
      await navigator.clipboard?.writeText(text);
      toast(t("הועתק ללוח"));
    }
  };
  return <div className="page stack">
      <div className="hero hero--sm">
        <Photo photoKey={seg.photo} credit style={{
        position: 'absolute',
        inset: 0,
        aspectRatio: 'auto',
        borderRadius: 0
      }} />
        <div className="hero__overlay" />
        <div className="hero__content">
          <div className="row" style={{
          gap: 6
        }}><span className="chip" style={{
            background: 'rgba(255,255,255,0.2)',
            color: '#fff'
          }}>{t("מקטע")} {seg.id}</span><Difficulty level={seg.difficulty} />{isDone && <span className="chip" style={{
            background: 'var(--green)',
            color: '#fff'
          }}>{t("הושלם ✓")}</span>}</div>
          <h1 style={{
          fontSize: 22,
          marginTop: 6
        }}>{tf(seg, 'name')}</h1>
          <p className="small">{tf(seg.start, 'short') || tf(seg.start, 'name')} {isEn() ? '→' : '←'} {tf(seg.end, 'short') || tf(seg.end, 'name')} · {t(seg.region_spni || seg.region)}</p>
        </div>
      </div>

      <div className="grid-3">
        <Stat value={`${seg.distance_km}`} label={t("ק\"מ")} />
        <Stat value={seg.hours ? `${seg.hours}` : '–'} label={t("שעות הליכה")} />
        <Stat value={seg.ascent_m != null ? `↑${seg.ascent_m}` : '–'} label={seg.descent_m != null ? t("↓{0} מ' טיפוס/ירידה", seg.descent_m) : t("מ' טיפוס")} />
      </div>

      {seg.water_caching_needed && <Alert kind="warn" icon="water"><b>{t("נדרשת הטמנת מים.")}</b> {tf(seg.water || {}, 'summary')}</Alert>}
      {seg.firing_zone && <Alert kind="danger" icon="warn"><b>{t("שטח אש:")}</b> {seg.firing_zone}</Alert>}

      {seg.steps_he?.length > 0 && <button className="story-cta" onClick={() => navigate(`segments/${seg.id}/story`)}>
          <span className="story-cta__ico">🧭</span>
          <span><b>{t("סיפור דרך – ניווט שלב אחר שלב")}</b><br /><span className="tiny" style={{
          opacity: 0.9
        }}>{seg.steps_he.length} {t("שלבים מתיאור המסלול הרשמי · הקראה קולית · מעקב GPS")}</span></span>
          <span style={{
        fontSize: 22
      }}>←</span>
        </button>}
      <div className="segmented" style={{
      alignSelf: 'center'
    }}>
        {[['info', t("מידע")], ['weather', t("מזג אוויר")], ['lodging', t("לינה ומים")], ['gear', t("ציוד")], ['map', t("מפה")], ['notes', t("הערות שלי")]].map(([k, v]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{v}</button>)}
      </div>

      {tab === 'info' && <div className="stack">
          {tf(seg, 'description') && <div className="card card--glow"><p style={{
          lineHeight: 1.7,
          whiteSpace: 'pre-line'
        }}>{tf(seg, 'description')}</p></div>}
          {seg.spni && <div className="card">
              <div className="card__title"><span className="blaze" style={{
            width: 12,
            height: 18
          }}><span className="w" /><span className="b" /><span className="o" /></span>{t("המדריך הרשמי – החברה להגנת הטבע")}</div>
              <div className="stack small" style={{
          gap: 8
        }}>
                {seg.spni.season_he && <div><b>{t("עונה מומלצת:")}</b> {tSeason(seg.spni.season_he)}</div>}
                {seg.spni.character_he && <div><b>{t("אופי המסלול:")}</b> <span dir={heDir(seg.spni, 'character')}>{tf(seg.spni, 'character')}</span></div>}
                {seg.spni.shortcuts_he && <div><b>{t("אפשרויות קיצור:")}</b> <span dir={heDir(seg.spni, 'shortcuts')}>{tf(seg.spni, 'shortcuts')}</span></div>}
                {seg.spni.parking_he && <div><b>{t("חניה:")}</b> <span dir={heDir(seg.spni, 'parking')}>{tf(seg.spni, 'parking')}</span></div>}
              </div>
              {seg.spni.important_he?.length > 0 && <div className="alert alert--warn mt"><div><b>{t("❗ חשוב לדעת")}</b><ul className="mt" style={{
              paddingInlineStart: 18
            }}>{tl(seg.spni, 'important').map((x, i) => <li key={i} dir={heDir(seg.spni, 'important')}>{x}</li>)}</ul></div></div>}
              <div className="row mt" style={{
          gap: 6
        }}>
                {seg.spni.map_pdf && <a className="btn btn--sm btn--primary" href={seg.spni.map_pdf} target="_blank" rel="noreferrer">{t("🗺️ מפת המקטע (PDF חינם)")}</a>}
                <a className="btn btn--sm" href={seg.spni.url} target="_blank" rel="noreferrer">{t("לעמוד המקטע באתר")}</a>
                {seg.spni.guide_url && <a className="btn btn--sm btn--ghost" href={seg.spni.guide_url} target="_blank" rel="noreferrer">{t("מדריך")} {seg.region_spni}</a>}
              </div>
              {seg.spni.description_he && <details className="acc mt"><summary>{t("תיאור המסלול המלא (מצפון לדרום)")}</summary><div className="acc__body" dir={heDir(seg.spni, 'description')} style={{
            whiteSpace: 'pre-line',
            lineHeight: 1.7
          }}>{tf(seg.spni, 'description')}{tf(seg.spni, 'author') && <p className="tiny muted mt">{t("כתב:")} {tf(seg.spni, 'author')}</p>}</div></details>}
              {seg.spni.nearby_he?.length > 0 && <details className="acc mt"><summary>{t("המלצות בסביבה")}</summary><div className="acc__body" dir={heDir(seg.spni, 'nearby')}><ul>{tl(seg.spni, 'nearby').map((x, i) => <li key={i}>{x}</li>)}</ul></div></details>}
            </div>}
          <div className="card">
            <div className="card__title"><Icon name="star" />{t("נקודות עניין")}</div>
            {poisForSegment(seg.id).length > 0 && <><p className="tiny muted mb">{t("לחצו על נקודה לקריאת ההיסטוריה והמהות שלה (ויקיפדיה), עם תמונות.")}</p><PoiCards pois={poisForSegment(seg.id)} layout="grid" /></>}
            <ul className="mt" dir={heDir(seg, 'highlights')}>{(isEn() && seg.highlights_en?.length ? seg.highlights_en : seg.highlights || []).map((h, i) => <li key={i}>{h}</li>)}</ul>
          </div>
          {seg.hazards?.length > 0 && <div className="card">
              <div className="card__title"><Icon name="warn" />{t("אזהרות ודגשים")}</div>
              <ul>{seg.hazards.map((h, i) => <li key={i}>{h}</li>)}</ul>
            </div>}
          <div className="card">
            <div className="card__title"><Icon name="bus" />{t("הגעה ותחבורה")}</div>
            <p className="small">{seg.transport?.spni_he || seg.transport?.start_he || t("ראו מדריך")}</p>
            {seg.transport?.end_he && <p className="small mt"><b>{t("סיום:")}</b> {seg.transport.end_he}</p>}
            {links && <div className="row mt" style={{
          gap: 6
        }}>
              <a className="btn btn--sm" href={links.google} target="_blank" rel="noreferrer">{t("Google Maps לנק' ההתחלה")}</a>
              <a className="btn btn--sm" href={links.waze} target="_blank" rel="noreferrer">Waze</a>
              <a className="btn btn--sm" href={links.ihm} target="_blank" rel="noreferrer">Israel Hiking Map</a>
            </div>}
          </div>
          <div className="card small">
            <div className="row between"><span className="bold">{t("נקודת התחלה")}</span><span className="mono ltr">{formatCoord(seg.start?.lat, seg.start?.lon)}</span></div>
            <div className="row between mt"><span className="bold">{t("נקודת סיום")}</span><span className="mono ltr">{formatCoord(seg.end?.lat, seg.end?.lon)}</span></div>
            {seg.start?.approx && <p className="tiny muted mt">{t("* הקואורדינטות משוערות (±1 ק\"מ) – לניווט מדויק להשתמש בתוואי מ-OSM במפה.")}</p>}
          </div>
        </div>}

      {tab === 'lodging' && <div className="stack">
          <div className="card">
            <div className="card__title"><Icon name="water" />{t("מים במקטע")}</div>
            <p dir={heDir(seg.water || {}, 'summary')}>{tf(seg.water || {}, 'summary') || t("אין מידע")}</p>
            {seg.water?.sources?.length > 0 && <ul className="mt">{seg.water.sources.map((w, i) => <li key={i}>{w}</li>)}</ul>}
          </div>
          <div className="card card--glow">
            <div className="card__title"><Icon name="water" />{t("מחשבון מים למקטע")}</div>
            <div className="field"><label>{t("טמפרטורה מרבית צפויה:")} <b>{temp}°C</b></label><input className="range" type="range" min={5} max={45} value={temp} onChange={e => setTemp(Number(e.target.value))} /></div>
            <div className="field"><label>{t("משקל גוף:")} <b>{weight} {t("ק\"ג")}</b></label><input className="range" type="range" min={40} max={120} value={weight} onChange={e => setWeight(Number(e.target.value))} /></div>
            {(() => {
          const hours = seg.hours || seg.distance_km / 3.5;
          const perHour = (0.45 + Math.max(0, temp - 18) * 0.035) * (weight / 70) * (seg.difficulty >= 3 ? 1.15 : 1);
          const walk = hours * perHour;
          const camp = seg.water?.availability === 'none' || seg.water_caching_needed ? 2.5 : 1;
          const total = walk + camp;
          return <div className="stack mt">
                  <div className="grid-3"><Stat value={walk.toFixed(1)} label={t("ל' בהליכה")} /><Stat value={camp.toFixed(1)} label={t("ל' לערב/בישול")} /><Stat value={Math.ceil(total * 2) / 2} label={t("ל' לשאת")} /></div>
                  {total > 6.5 && <Alert kind="warn" icon="water">{t("יותר מ-6.5 ליטר – שקלו הטמנה באמצע המקטע, יציאה לפני הזריחה, או פיצול המקטע.")}</Alert>}
                  {temp >= 32 && <Alert kind="danger" icon="warn">{t("מעל 32°C: סכנת מכת חום. לא לצאת למקטע מדברי ארוך.")}</Alert>}
                  <p className="tiny muted">{t("הערכה: ~0.45 ל'/שעה ב-18°C, +0.1 ל'/שעה לכל 3°C נוספים, מותאם למשקל ולקושי. לא תחליף לשיקול דעת.")}</p>
                </div>;
        })()}
          </div>
          <div className="card">
            <div className="card__title"><Icon name="bed" />{t("לינה בסיום המקטע")}</div>
            {tf(seg.overnight || {}, 'summary') && <p className="mb" dir={heDir(seg.overnight || {}, 'summary')}>{tf(seg.overnight || {}, 'summary')}</p>}
            <div className="stack" style={{
          gap: 8
        }}>
              {seg.overnight?.night_camp && <Row ico="⛺" t={t("חניון לילה / לינת שטח")} v={seg.overnight.night_camp} />}
              {seg.overnight?.trail_angels && <Row ico="😇" t={t("מלאכי שביל")} v={<>{seg.overnight.trail_angels} <button className="linkbtn" onClick={() => navigate('guide/angels')}>{t("← למדריך ולאנשי הקשר שלי")}</button></>} />}
              {seg.overnight?.field_school && <Row ico="🏫" t={t("בית ספר שדה / אכסניה")} v={seg.overnight.field_school} />}
              {seg.overnight?.paid && <Row ico="🏨" t={t("לינה בתשלום")} v={seg.overnight.paid} />}
            </div>
            <button className="btn btn--ghost btn--sm mt" onClick={() => navigate('guide/lodging')}>{t("למדריך הלינה המלא ←")}</button>
          </div>
          {seg.angels_region && (() => {
        const list = (spniAngels.angels || []).filter(a => a.region_index === seg.angels_region);
        const reg = spniAngels.regions.find(r => r.index === seg.angels_region);
        return list.length ? <div className="card">
                <div className="card__title">{t("😇 מלאכי שביל באזור:")} {reg?.name}</div>
                <p className="tiny muted mb">{list.length} {t("מארחים ברשימה הרשמית של החברה להגנת הטבע. פרטי קשר – בעמוד האזורי באתר.")}</p>
                <div className="stack" style={{
            gap: 6
          }}>{list.slice(0, 12).map((a, i) => <div key={i} className="small"><b>{a.settlement}</b> – <span className="muted">{a.offer.split('\n')[0].slice(0, 90)}</span></div>)}</div>
                {list.length > 12 && <p className="tiny muted mt">{t("ועוד")} {list.length - 12}…</p>}
                <div className="row mt" style={{
            gap: 6
          }}><a className="btn btn--sm btn--primary" href={reg?.url} target="_blank" rel="noreferrer">{t("הרשימה המלאה עם טלפונים")}</a><button className="btn btn--sm" onClick={() => navigate('guide/angels')}>{t("המלאכים שלי")}</button></div>
              </div> : null;
      })()}
          {nearbyCamps.length > 0 && <div className="card">
              <div className="card__title"><Icon name="tent" />{t("חניוני לילה בסביבה")}</div>
              {nearbyCamps.map((c, i) => <div key={i} className="small mt"><b>{c.name_he}</b> – {c.facilities_he || c.notes_he || ''}</div>)}
            </div>}
        </div>}

      {tab === 'weather' && <div className="stack">
          {!wx.data && <div className="card small muted">{wx.error ? t("אין חיבור לשרת מזג האוויר") : t("טוען תחזית חיה לנקודת ההתחלה…")}</div>}
          {wx.data && <>
              <div className="card card--glow"><WeatherNow data={wx.data} place={tf(seg.start, 'short')} /></div>
              <div className="card">
                <div className="card__title"><Icon name="sun" />{t("7 ימים – מתי כדאי לצעוד כאן")}</div>
                <WeatherDaily data={wx.data} group={regionGroup(seg.region)} onPick={setWxDay} />
                <div className="mt"><WeatherFlags data={wx.data} group={regionGroup(seg.region)} dayIndex={wxDay} /></div>
                {seg.hazards?.some(h => /שיטפ|נחל|קניון|מכתש/.test(h)) && <p className="tiny mt" style={{
            color: 'var(--orange)'
          }}>{t("⚠ במקטע זה יש נחלים/קניונים – בגשם באזור כולו (גם רחוק) קיימת סכנת שיטפון.")}</p>}
              </div>
              <button className="btn btn--ghost btn--sm" onClick={() => navigate(`weather?seg=${seg.id}`)}>{t("תחזית שעתית מלאה ←")}</button>
            </>}
        </div>}

      {tab === 'gear' && gear && <div className="stack">
          <div className="field"><label>{t("ציוד מומלץ למקטע זה לפי חודש")}</label>
            <select className="select" value={month} onChange={e => setMonth(Number(e.target.value))}>{HE_MONTHS.map((m, i) => <option key={i} value={i}>{t(m)}</option>)}</select>
          </div>
          {gear.warnings.map((w, i) => <Alert key={i} kind="danger" icon="warn">{w}</Alert>)}
          <div className="grid-3">
            <Stat value={t("{0} ל'", gear.waterLiters)} label={t("מים לשאת")} />
            <Stat value={gear.sleepingBag.split(' ')[2] || ''} label={t("דירוג שק שינה")} />
            <Stat value={seg.hours || '–'} label={t("שעות הליכה")} />
          </div>
          <div className="card"><div className="card__title"><Icon name="star" />{t("תוספות ייחודיות למקטע ולעונה")}</div>
            {gear.extras.length === 0 && <p className="small muted">{t("אין תוספות מיוחדות – הציוד הבסיסי מספיק.")}</p>}
            {gear.extras.map((x, i) => <div key={i} className={`gear-item gear-${x.level}`}><div className="bold">{x.level === 'must' ? '🔴' : x.level === 'rec' ? '🟠' : '🟢'} {x.item}</div><div className="tiny muted">{x.why}</div></div>)}
          </div>
          <div className="card small"><div><b>{t("שק שינה:")}</b> {gear.sleepingBag}</div><div className="mt"><b>{t("אוכל:")}</b> {gear.foodDays}</div></div>
          <button className="btn btn--ghost btn--sm" onClick={() => navigate(`guide/gear?seg=${seg.id}&m=${month}`)}>{t("לרשימת הציוד המלאה ←")}</button>
        </div>}

      {tab === 'map' && <div className="stack">
          <div className="mini-map" style={{
        height: 320
      }}>
            <MapView segments={[seg]} base={prefs.base} fitTo={fit} selectedId={seg.id} />
          </div>
          <p className="tiny muted">{t("הקו המקווקו סכמטי בין נקודות הקצה. במסך המפה ניתן להוריד את התוואי המלא מ-OpenStreetMap לשימוש לא מקוון.")}</p>
          <div className="card card--glow">
            <div className="card__title">{t("📥 מפת המקטע לשימוש לא מקוון")}</div>
            <p className="small muted">{t("מוריד את אריחי המפה של אזור המקטע (זום 11–15,")} {BASE_LAYERS_NAME(prefs.base)}{t(") ושומר אותם במכשיר. אחרי ההורדה המפה תעבוד גם ללא קליטה.")}</p>
            {dl && <div className="mt"><div className="progress"><div style={{
              width: `${(dl.done + dl.skipped + dl.failed) / dl.total * 100}%`
            }} /></div><div className="tiny muted mt">{dl.done + dl.skipped} / {dl.total} {t("אריחים")}{dl.failed ? t("· {0} נכשלו", dl.failed) : ''}{dl.finished ? t("· הושלם ✓") : ''}</div></div>}
            <button className="btn btn--primary btn--sm mt" onClick={downloadMap} disabled={dl && !dl.finished}>{dl && !dl.finished ? t("מוריד…") : t("הורדת מפת המקטע")}</button>
          </div>
          <button className="btn" onClick={() => navigate(`map?seg=${seg.id}`)}><Icon name="map" size={18} /> {t("פתיחה במפה המלאה")}</button>
        </div>}

      {tab === 'notes' && <div className="card">
          <div className="card__title"><Icon name="journal" />{t("ההערות שלי למקטע")}</div>
          <textarea className="textarea" placeholder={t("מספרי טלפון של מלאכי שביל, נקודות מים שמצאתם, טיפים…")} value={notes[seg.id] || ''} onChange={e => setNotes({
        ...notes,
        [seg.id]: e.target.value
      })} />
          <p className="tiny muted mt">{t("נשמר אוטומטית במכשיר.")}</p>
        </div>}

      <div className="row" style={{
      gap: 8
    }}>
        <button className={`btn ${isDone ? '' : 'btn--primary'}`} style={{
        flex: 1
      }} onClick={() => {
        toggleDone(seg.id);
        toast(isDone ? t("הסימון הוסר") : t("כל הכבוד! המקטע סומן כהושלם 🎉"));
      }}><Icon name="check" size={18} />{isDone ? t("בטל סימון") : t("סמן כהושלם")}</button>
        <button className="btn" onClick={exportGpx} title="GPX"><Icon name="download" size={18} /></button>
        <button className="btn" onClick={share}><Icon name="share" size={18} /></button>
      </div>
      <div className="row between">
        {prev ? <button className="btn btn--ghost btn--sm" onClick={() => navigate(`segments/${prev.id}`)}>{t("→ מקטע")} {prev.id}: {tf(prev, 'name')}</button> : <span />}
        {next ? <button className="btn btn--ghost btn--sm" onClick={() => navigate(`segments/${next.id}`)}>{t("מקטע")} {next.id}: {tf(next, 'name')} ←</button> : <span />}
      </div>
    </div>;
}
function Row({
  ico,
  t,
  v
}) {
  return <div className="row" style={{
    alignItems: 'flex-start'
  }}><span style={{
      fontSize: 20
    }}>{ico}</span><div><div className="tiny muted">{t}</div><div className="small">{v}</div></div></div>;
}