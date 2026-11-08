import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context.jsx';
import { Stat, Alert, Modal, Acc } from '../components/UI.jsx';
import { Icon } from '../components/Icons.jsx';
import { CIcon } from '../components/ColorIcons.jsx';
import { DEFAULT_PLAN, buildItinerary } from '../lib/planner.js';
import { toISODate, fmtDate, fmtDateLong, HE_MONTHS, HE_MONTHS_SHORT } from '../lib/dates.js';
import { MONTHS, LEVEL_CLS, LEVEL_HE, regionGroup } from '../lib/season.js';
import { itineraryToICS } from '../lib/ics.js';
import { download } from '../lib/gpx.js';
import { useToast } from '../hooks/useToast.jsx';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { fetchForecastMany, wmoText, dayVerdict } from '../lib/weather.js';
import { toISODate as iso } from '../lib/dates.js';
import { evaluatePlan } from '../lib/readiness.js';
import { Readiness } from '../components/Readiness.jsx';
import { gearFor, BASE_GEAR, packWeight } from '../lib/gear.js';
import logistics from '../data/logistics.json';
import lodgingData from '../data/lodging.json';
import { t, tf } from '../i18n/index.js'
const STEPS = [['route', 'מסלול', 'segments'], ['pace', 'קצב וימים', 'plan'], ['lodging', 'לינה', 'lodging'], ['water', 'מים ואוכל', 'water'], ['gear', 'ציוד', 'gear'], ['safety', 'בטיחות וקשר', 'safety'], ['logistics', 'לוגיסטיקה', 'transport'], ['summary', 'סיכום ולו"ז', 'certificate']];
export default function Planner({
  navigate,
  query = {}
}) {
  const {
    segments,
    plan,
    setPlan,
    journal,
    angels,
    gear,
    setGear
  } = useApp();
  const toast = useToast();
  const [draft, setDraft] = useState({
    ...DEFAULT_PLAN,
    ...plan,
    startDate: plan.startDate || toISODate(new Date())
  });
  const [step, setStep] = useLocalStorage('planStep', 'route');
  const [tasks, setTasks] = useLocalStorage('planTasks', {});
  const [contacts, setContacts] = useLocalStorage('planContacts', {
    name: '',
    phone: '',
    checkin: '19:00',
    insurance: false,
    notes: ''
  });
  const [prep, setPrep] = useLocalStorage('planPrep', {});
  const clearPlan = () => {
    if (!confirm(t("לנקות את התוכנית? יימחקו הכיוון, התאריכים, כל הסימונים וההכנות (היומן, התמונות ורשימת הציוד הבסיסית נשמרים)."))) return;
    const fresh = {
      ...DEFAULT_PLAN,
      startDate: toISODate(new Date())
    };
    setDraft(fresh);
    setPlan({
      ...DEFAULT_PLAN
    });
    setTasks({});
    setPrep({});
    setContacts({
      name: '',
      phone: '',
      checkin: '19:00',
      insurance: false,
      notes: ''
    });
    setStep('route');
    setWx({});
    toast(t("התוכנית נוקתה – מתחילים מחדש"));
  };
  const [detail, setDetail] = useState(null);
  const [wx, setWx] = useState({});
  const preview = useMemo(() => segments.length ? buildItinerary(segments, draft) : null, [segments, draft]);
  const readiness = useMemo(() => preview ? evaluatePlan({
    days: preview.days,
    segments,
    wx,
    angels,
    caches: preview.caches || []
  }) : null, [preview, segments, wx, angels]);
  const set = (k, v) => setDraft(d => ({
    ...d,
    [k]: v
  }));
  const task = k => !!tasks[k];
  const toggleTask = k => setTasks({
    ...tasks,
    [k]: !tasks[k]
  });
  const sorted = [...segments].sort((a, b) => a.id - b.id);
  const dirty = JSON.stringify({
    ...DEFAULT_PLAN,
    ...plan,
    startDate: plan.startDate || draft.startDate
  }) !== JSON.stringify(draft);
  const stepIdx = STEPS.findIndex(s => s[0] === step);
  const go = i => {
    setStep(STEPS[Math.max(0, Math.min(STEPS.length - 1, i))][0]);
    document.getElementById('content')?.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // auto-save the draft (debounced) so nothing is lost
  useEffect(() => {
    const t = setTimeout(() => {
      if (dirty) setPlan(draft);
    }, 600);
    return () => clearTimeout(t);
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  // live forecast for upcoming days
  useEffect(() => {
    if (!preview) return;
    const horizon = Date.now() + 15 * 86400000;
    const upcoming = preview.days.filter(d => !d.rest && d.date >= new Date(new Date().toDateString()) && d.date <= horizon);
    if (!upcoming.length) {
      setWx({});
      return;
    }
    const pts = upcoming.map(d => {
      const s = segments.find(x => x.id === d.segments[0]);
      return {
        lat: s.start.lat,
        lon: s.start.lon
      };
    });
    let alive = true;
    fetchForecastMany(pts, 16).then(res => {
      if (!alive) return;
      const out = {};
      upcoming.forEach((d, i) => {
        const dd = res[i]?.daily;
        if (!dd) return;
        const j = dd.time.indexOf(iso(d.date));
        if (j < 0) return;
        const v = dayVerdict({
          tmax: dd.temperature_2m_max[j],
          rainMm: dd.precipitation_sum[j],
          rainProb: dd.precipitation_probability_max[j],
          windMax: dd.wind_speed_10m_max[j],
          code: dd.weather_code[j]
        }, d.group);
        out[d.day] = {
          icon: wmoText(dd.weather_code[j])[1],
          tmax: Math.round(dd.temperature_2m_max[j]),
          tmin: Math.round(dd.temperature_2m_min[j]),
          rain: dd.precipitation_probability_max[j],
          v
        };
      });
      setWx(out);
    }).catch(() => {});
    return () => {
      alive = false;
    };
  }, [preview?.summary.startDate?.getTime(), preview?.days.length, draft.direction]); // eslint-disable-line react-hooks/exhaustive-deps

  const measuredPace = useMemo(() => {
    const k = journal.map(e => parseFloat(e.km)).filter(x => x > 0);
    return k.length ? Math.round(k.reduce((a, b) => a + b, 0) / k.length) : null;
  }, [journal]);
  const walking = preview?.days.filter(d => !d.rest) || [];
  const seg = id => segments.find(s => s.id === id);

  // ---- derived lists for the steps
  const lodgingRows = useMemo(() => walking.map(d => {
    const s = seg(d.segments[d.segments.length - 1]);
    const kind = /מלאכ/.test(d.overnight) ? 'angels' : /חניון|שטח/.test(d.overnight) ? 'camp' : /בית ספר שדה|אכסני|צימר|מלון|הוסטל|בתשלום/.test(d.overnight) ? 'paid' : 'other';
    const hasAngel = angels.some(a => d.segments.includes(Number(a.segId)));
    return {
      d,
      s,
      kind,
      hasAngel,
      key: `lodging:${d.day}`
    };
  }), [walking, angels]); // eslint-disable-line react-hooks/exhaustive-deps
  // resupply points mapped to official segment ranges; show only the ones on the chosen route
  const RESUPPLY_RANGES = [[1, 2], [3, 6], [7, 10], [10, 14], [14, 17], [17, 23], [23, 31], [31, 43], [43, 49], [49, 56]];
  const routeIds = useMemo(() => new Set(walking.flatMap(d => d.segments)), [walking]);
  const resupply = useMemo(() => (logistics.logistics?.resupply?.points || []).map((r, i) => ({
    ...r,
    i,
    range: RESUPPLY_RANGES[i]
  })).filter(r => {
    const [a, b] = r.range || [0, 0];
    for (let id = a; id <= b; id++) if (routeIds.has(id)) return true;
    return false;
  }), [routeIds]); // eslint-disable-line react-hooks/exhaustive-deps
  const gearPlan = useMemo(() => {
    const extras = new Map();
    let liters = 0,
      bag = '';
    for (const d of walking) {
      const s = seg(d.segments[0]);
      if (!s) continue;
      const g = gearFor(s, d.date.getMonth());
      if (!g) continue;
      liters = Math.max(liters, g.waterLiters);
      if (!bag || g.sleepingBag.includes('0°C')) bag = g.sleepingBag;
      for (const x of g.extras) if (!extras.has(x.item)) extras.set(x.item, {
        ...x,
        days: [d.day]
      });else extras.get(x.item).days.push(d.day);
    }
    return {
      extras: [...extras.values()].sort((a, b) => ({
        must: 0,
        rec: 1,
        nice: 2
      })[a.level] - {
        must: 0,
        rec: 1,
        nice: 2
      }[b.level]),
      liters,
      bag
    };
  }, [walking]); // eslint-disable-line react-hooks/exhaustive-deps
  const baseGearTotal = BASE_GEAR.reduce((a, c) => a + c.items.length, 0);
  const baseGearDone = BASE_GEAR.reduce((a, c) => a + c.items.filter(it => gear[`${c.cat}:${it}`]).length, 0);

  // ---- progress per step (tasks)
  const progress = useMemo(() => {
    const p = {};
    const count = keys => ({
      done: keys.filter(task).length,
      total: keys.length
    });
    p.lodging = count(lodgingRows.filter(r => r.kind !== 'camp').map(r => r.key));
    p.water = count([...(preview?.caches || []).map(c => `cache:${c.day}`), ...resupply.map(r => `resupply:${r.i}`)]);
    p.gear = {
      done: baseGearDone + gearPlan.extras.filter(x => task(`gear:${x.item}`)).length,
      total: baseGearTotal + gearPlan.extras.length
    };
    p.safety = count(['safety:contact', 'safety:insurance', 'safety:plan-shared', 'safety:apps', 'safety:floods']);
    p.logistics = count(['log:to-start', 'log:from-end', 'log:money', 'log:holidays', 'log:sim']);
    return p;
  }, [tasks, lodgingRows, preview, gearPlan, baseGearDone]); // eslint-disable-line react-hooks/exhaustive-deps

  const cacheMessage = () => {
    if (!preview?.caches?.length) return;
    const lines = preview.caches.map(c => t("• יום {0} · {1} – {2} ← לינה: {3}", c.day, fmtDate(c.date), c.title, c.overnight));
    const msg = t("שלום, אשמח להזמין הטמנות מים לשביל ישראל ({0}). נקודות ותאריכים: {1} כמות: ___ ליטר לנקודה עבור ___ מטיילים. תודה!", draft.direction === 'sobo' ? t("צפון←דרום") : t("דרום←צפון"), lines.join('\n'));
    navigator.clipboard?.writeText(msg);
    toast(t("הודעת הזמנת הטמנות הועתקה – שלחו לספק"));
  };
  const exportIcs = () => {
    download('shvil-israel.ics', itineraryToICS(preview.days), 'text/calendar');
    toast(t("קובץ יומן הורד"));
  };
  const exportText = async () => {
    const t = preview.days.map(d => t("יום {0} · {1} · {2}", d.day, fmtDate(d.date), d.rest ? t("מנוחה") : t("{0} · {1} ק\"מ · לינה: {2}", d.title, d.km, d.overnight))).join('\n');
    const head = t("שביל ישראל – תוכנית מסע {0} ← {1} · {2} ימים · {3} ק\"מ איש קשר לחירום: {4} {5} · צ'ק-אין יומי ב-{6}", fmtDate(preview.summary.startDate), fmtDate(preview.summary.endDate), preview.summary.days, preview.summary.totalKm, contacts.name || '-', contacts.phone || '', contacts.checkin);
    if (navigator.share) {
      try {
        await navigator.share({
          title: t("תוכנית שביל ישראל"),
          text: head + t
        });
        return;
      } catch {/* cancelled */}
    }
    await navigator.clipboard?.writeText(head + t);
    toast(t("התוכנית הועתקה ללוח"));
  };
  const startMonth = new Date(draft.startDate).getMonth();
  const Check = ({
    k,
    children,
    sub
  }) => <label className={`check ${task(k) ? 'on' : ''}`}><input type="checkbox" checked={task(k)} onChange={() => toggleTask(k)} /><span style={{
      flex: 1
    }}>{children}{sub && <div className="tiny muted" style={{
        textDecoration: 'none'
      }}>{sub}</div>}</span></label>;
  const StepNav = () => <div className="row between mt">
      <button className="btn" onClick={() => go(stepIdx - 1)} disabled={stepIdx === 0}>{t("→ הקודם")}</button>
      <span className="tiny muted">{t("נשמר אוטומטית ✓")}</span>
      {stepIdx < STEPS.length - 1 ? <button className="btn btn--primary" onClick={() => go(stepIdx + 1)}>{t("הבא ←")}</button> : <button className="btn btn--primary" onClick={exportText}><Icon name="share" size={16} /> {t("שיתוף")}</button>}
    </div>;
  return <div className="page stack">
      <div className="row between">
        <h2 className="section-title"><Icon name="plan" />{t("תכנון המסע")}</h2>
        <div className="row" style={{
        gap: 6
      }}>
          {readiness && <span className={`chip ${readiness.overall === 'ok' ? 'chip--green' : readiness.overall === 'warn' ? 'chip--orange' : 'chip--red'}`} onClick={() => go(7)} style={{
          cursor: 'pointer'
        }}>{readiness.overall === 'ok' ? t("🟢 תקין") : readiness.overall === 'warn' ? t("🟡 דגשים") : t("🔴 אזהרות")}</span>}
          <button className="btn btn--sm btn--ghost" onClick={clearPlan} title={t("נקה תוכנית")}>{t("🗑️ נקה")}</button>
        </div>
      </div>

      {/* stepper */}
      <div className="stepper">
        {STEPS.map(([k, label, ico], i) => {
        const pr = progress[k];
        return <button key={k} className={`stepper__item ${step === k ? 'active' : ''} ${i < stepIdx ? 'past' : ''}`} onClick={() => go(i)}>
              <span className="stepper__ico"><CIcon name={ico} size={22} /></span>
              <span className="stepper__label">{i + 1}. {t(label)}</span>
              {pr && pr.total > 0 && <span className={`stepper__pr ${pr.done === pr.total ? 'done' : ''}`}>{pr.done}/{pr.total}</span>}
            </button>;
      })}
      </div>

      {/* ---------- 1. route ---------- */}
      {step === 'route' && <div className="card stack">
          <div className="card__title">{t("1. מסלול, כיוון ותאריך")}</div>
          <div className="field">
            <label>{t("כיוון ההליכה")}</label>
            <div className="segmented">
              <button className={draft.direction === 'sobo' ? 'active' : ''} onClick={() => set('direction', 'sobo')}>{t("חרמון ← אילת")}</button>
              <button className={draft.direction === 'nobo' ? 'active' : ''} onClick={() => set('direction', 'nobo')}>{t("אילת ← חרמון")}</button>
            </div>
            <p className="tiny muted">{draft.direction === 'sobo' ? t("מומלץ לצאת באוקטובר–נובמבר: הצפון עוד יבש, ומגיעים לנגב בחורף הנעים.") : t("מומלץ לצאת בפברואר–מרץ: חוצים את הנגב לפני החום ומגיעים לצפון הפורח באביב.")}</p>
          </div>
          <div className="field"><label>{t("תאריך יציאה")}</label><input className="input" type="date" value={draft.startDate} onChange={e => set('startDate', e.target.value)} /></div>
          <div className="grid-2">
            <div className="field"><label>{t("ממקטע")}</label><select className="select" value={draft.fromId ?? ''} onChange={e => set('fromId', e.target.value === '' ? null : Number(e.target.value))}><option value="">{t("תחילת השביל")}</option>{sorted.map(s => <option key={s.id} value={s.id}>{s.id}. {tf(s, 'name')}</option>)}</select></div>
            <div className="field"><label>{t("עד מקטע")}</label><select className="select" value={draft.toId ?? ''} onChange={e => set('toId', e.target.value === '' ? null : Number(e.target.value))}><option value="">{t("סוף השביל")}</option>{sorted.map(s => <option key={s.id} value={s.id}>{s.id}. {tf(s, 'name')}</option>)}</select></div>
          </div>
          <SeasonStrip month={startMonth} days={preview?.summary.days || 50} />
          {preview && <div className="grid-3"><Stat value={preview.summary.totalKm} label={t("ק\"מ")} /><Stat value={preview.days.length} label={t("ימים (משוער)")} /><Stat value={fmtDate(preview.summary.endDate)} label={t("סיום")} /></div>}
          <Acc title={t("📌 מה לבדוק בשלב הזה")}>
            <ul><li>{t("עדכוני תוואי וסגירות ביטחוניות במקטעי הצפון (מדריך ← המדריך הרשמי).")}</li><li>{t("האם תאריך היציאה נופל על חג או שבת (תחבורה).")}</li><li>{t("מקטעים שתרצו לדלג עליהם (עירוניים) – הגדירו טווח מקטעים.")}</li></ul>
          </Acc>
          <StepNav />
        </div>}

      {/* ---------- 2. pace ---------- */}
      {step === 'pace' && preview && <div className="card stack">
          <div className="card__title">{t("2. קצב, ימי מנוחה ושבת")}</div>
          <div className="field"><label>{t("קצב יומי:")} <b>{draft.dailyKm} {t("ק\"מ")}</b> <span className="muted tiny">{t("(מתחילים 15–18 · מנוסים 20–25 · מהירים 28+)")}</span></label><input className="range" type="range" min={10} max={40} value={draft.dailyKm} onChange={e => set('dailyKm', Number(e.target.value))} /></div>
          <div className="field"><label>{t("מקסימום ליום (פיצול מקטעים ארוכים):")} <b>{draft.maxDailyKm} {t("ק\"מ")}</b></label><input className="range" type="range" min={15} max={45} value={draft.maxDailyKm} onChange={e => set('maxDailyKm', Number(e.target.value))} /></div>
          <div className="grid-2">
            <div className="field"><label>{t("יום מנוחה כל")}</label><select className="select" value={draft.restEvery} onChange={e => set('restEvery', Number(e.target.value))}><option value={0}>{t("ללא")}</option>{[4, 5, 6, 7, 8, 10].map(n => <option key={n} value={n}>{n} {t("ימי הליכה")}</option>)}</select></div>
            <div className="field" style={{
          justifyContent: 'flex-end'
        }}><label className="switch"><input type="checkbox" checked={draft.restOnShabbat} onChange={e => set('restOnShabbat', e.target.checked)} /> {t("לא הולכים בשבת")}</label></div>
          </div>
          {measuredPace && measuredPace !== draft.dailyKm && <Alert kind="info">{t("הקצב הממוצע שלכם לפי היומן:")} <b>{measuredPace} {t("ק\"מ/יום")}</b>. <button className="linkbtn" onClick={() => set('dailyKm', measuredPace)}>{t("עדכנו לפי הקצב האמיתי ←")}</button></Alert>}
          <div className="grid-3">
            <Stat value={preview.summary.days} label={t("ימים סה״כ")} /><Stat value={preview.summary.walkingDays} label={t("ימי הליכה")} /><Stat value={preview.summary.restDays} label={t("ימי מנוחה")} />
            <Stat value={preview.summary.avgKm} label={t("ממוצע ק\"מ/יום")} /><Stat value={Math.max(...walking.map(d => d.km))} label={t("היום הארוך (ק\"מ)")} /><Stat value={walking.filter(d => d.shabbat).length} label={t("ימי הליכה בשבת")} />
          </div>
          <Acc title={t("📌 דגשים")}>
            <ul><li>{t("שבוע ראשון – לתכנן ימים קצרים (12–16 ק\"מ) עד שהגוף מתרגל.")}</li><li>{t("בנגב ימים ארוכים יותר אפשריים (שטח פתוח) אבל יש פחות מים; בצפון עליות וירידות מאטות.")}</li><li>{t("יום מנוחה כל 6–7 ימים ביישוב עם סופר, כביסה ומקלחת.")}</li></ul>
          </Acc>
          <StepNav />
        </div>}

      {/* ---------- 3. lodging ---------- */}
      {step === 'lodging' && preview && <div className="card stack">
          <div className="card__title">{t("3. לינה – לילה אחר לילה")}</div>
          <div className="field"><label>{t("סגנון לינה מועדף")}</label>
            <select className="select" value={draft.lodging} onChange={e => set('lodging', e.target.value)}>
              <option value="mixed">{t("משולב (מלאכים + אוהל + מדי פעם בתשלום)")}</option><option value="tent">{t("אוהל / חניוני לילה")}</option><option value="angels">{t("מלאכי שביל")}</option><option value="paid">{t("לינה בתשלום (אכסניות/צימרים)")}</option>
            </select>
          </div>
          <div className="grid-3">
            <Stat value={lodgingRows.filter(r => r.kind === 'angels').length} label={t("לילות אצל מלאכים")} /><Stat value={lodgingRows.filter(r => r.kind === 'camp').length} label={t("לילות שטח")} /><Stat value={lodgingRows.filter(r => r.kind === 'paid').length} label={t("לילות בתשלום")} />
          </div>
          <p className="small muted">{t("סמנו כל לילה שסודר (תיאום עם מלאך / הזמנה). לילות שטח לא דורשים תיאום.")}</p>
          <div className="stack" style={{
        gap: 4
      }}>
            {lodgingRows.map(({
          d,
          s,
          kind,
          hasAngel,
          key
        }) => <div key={key} className={`lod-row lod-row--${kind}`}>
                {kind !== 'camp' ? <input type="checkbox" checked={task(key)} onChange={() => toggleTask(key)} /> : <span style={{
            width: 20,
            textAlign: 'center'
          }}>⛺</span>}
                <div style={{
            flex: 1,
            minWidth: 0
          }}>
                  <div className="small"><b>{t("יום")} {d.day}</b> · {fmtDate(d.date)} · <span className="muted">{tf(s?.end, 'short') || tf(s, 'name')}</span></div>
                  <div className="small">{kind === 'angels' ? '😇' : kind === 'paid' ? '🏨' : kind === 'camp' ? '⛺' : '🛏'} {d.overnight}</div>
                  {kind === 'angels' && <div className="tiny" style={{
              color: hasAngel ? 'var(--green)' : 'var(--orange)'
            }}>{hasAngel ? t("✓ יש איש קשר שמור") : t("אין עדיין איש קשר – לתאם 48 שעות לפני")}</div>}
                </div>
                {kind === 'angels' && <button className="btn btn--sm btn--ghost" onClick={() => navigate('guide/angels')}>{t("מלאכים")}</button>}
                {kind === 'paid' && <button className="btn btn--sm btn--ghost" onClick={() => navigate('guide/lodging')}>{t("הזמנה")}</button>}
              </div>)}
          </div>
          <Acc title={t("⛺ כללי לינת שטח (רט\"ג)")}><ul>{(lodgingData.camping_rules_he || []).slice(0, 6).map((x, i) => <li key={i}>{x}</li>)}</ul></Acc>
          <StepNav />
        </div>}

      {/* ---------- 4. water & food ---------- */}
      {step === 'water' && preview && <div className="card stack">
          <div className="card__title">{t("4. מים, הטמנות ואוכל")}</div>
          <div className="grid-3"><Stat value={preview.caches.length} label={t("ימים ללא מים")} /><Stat value={t("{0} ל'", gearPlan.liters)} label={t("קיבולת מים לשאת")} /><Stat value={walking.filter(d => d.group === 'negev').length} label={t("ימי מדבר")} /></div>
          {preview.caches.length > 0 ? <>
              <p className="small muted">{t("לכל יום כזה צריך הטמנה (עצמית, מלאך שביל או ספק). סמנו כשסודר:")}</p>
              {preview.caches.map(c => <Check key={c.day} k={`cache:${c.day}`} sub={c.overnight}>{t("יום")} {c.day} · {fmtDate(c.date)} · {c.title}</Check>)}
              <div className="row"><button className="btn btn--sm btn--primary" onClick={cacheMessage}>{t("📋 הודעת הזמנה לספק")}</button><button className="btn btn--sm" onClick={() => navigate('guide/water')}>{t("ספקים והנחיות")}</button></div>
            </> : <Alert kind="ok">{t("אין ימים הדורשים הטמנת מים במסלול שבחרתם.")}</Alert>}
          <Acc title={t("🛒 נקודות הצטיידות במסלול שבחרתם ({0}/{1})", resupply.filter(r => task(`resupply:${r.i}`)).length, resupply.length)} open>
            <p className="tiny muted mb">{t("סמנו נקודות שתכננתם לקנות בהן אוכל (בנגב: 2–4 ימי אוכל בין נקודה לנקודה).")}</p>
            {resupply.map(r => <Check key={r.i} k={`resupply:${r.i}`} sub={r.places_he}>{r.segment_he} <span className="tiny muted">{t("(מקטעים")} {r.range[0]}–{r.range[1]})</span></Check>)}{resupply.length === 0 && <p className="small muted">{t("אין נקודות הצטיידות רשומות לטווח המקטעים שנבחר.")}</p>}
          </Acc>
          <Acc title={t("🍲 טיפים לאוכל במסלול ארוך")}><ul><li>{t("500–800 גרם אוכל ליום; עתיר קלוריות ומשקל נמוך (אגוזים, טחינה, שיבולת שועל, קוסקוס, חטיפים).")}</li><li>{t("תמיד יום אוכל עודף בנגב.")}</li><li>{t("מלחים/אלקטרוליטים בקיץ ובמדבר.")}</li></ul></Acc>
          <StepNav />
        </div>}

      {/* ---------- 5. gear ---------- */}
      {step === 'gear' && preview && <div className="card stack">
          <div className="card__title">{t("5. ציוד מותאם למסע")}</div>
          <div className="grid-3"><Stat value={gearPlan.liters} label={t("ליטר מים")} /><Stat value={packWeight({
          baseKg: 8,
          liters: gearPlan.liters,
          foodDays: walking.some(d => d.group === 'negev') ? 3 : 1.5
        })} label={t("ק\"ג על הגב")} /><Stat value={<span className="ltr">{gearPlan.bag.includes('-5') ? '-5°C' : gearPlan.bag.includes('0°C') ? '0°C' : '+5°C'}</span>} label={t("שק שינה")} /></div>
          <div className="small"><b>{t("שק שינה:")}</b> {gearPlan.bag}</div>
          <Acc title={t("🎯 תוספות למסלול ולעונה ({0}/{1})", gearPlan.extras.filter(x => task(`gear:${x.item}`)).length, gearPlan.extras.length)} open>
            {gearPlan.extras.map(x => <Check key={x.item} k={`gear:${x.item}`} sub={t("{0} · ימים: {1}{2}", x.why, x.days.slice(0, 6).join(', '), x.days.length > 6 ? '…' : '')}>{x.level === 'must' ? '🔴' : x.level === 'rec' ? '🟠' : '🟢'} {t(x.item)}</Check>)}
          </Acc>
          <Acc title={t("🎒 ציוד בסיסי ({0}/{1})", baseGearDone, baseGearTotal)}>
            {BASE_GEAR.map(c => <div key={c.cat} className="mb"><b>{t(c.cat)}</b>{c.items.map(it => {
            const k = `${c.cat}:${it}`;
            return <label key={k} className={`check ${gear[k] ? 'on' : ''}`}><input type="checkbox" checked={!!gear[k]} onChange={() => setGear({
                ...gear,
                [k]: !gear[k]
              })} /><span>{t(it)}</span></label>;
          })}</div>)}
          </Acc>
          <button className="btn btn--ghost btn--sm" onClick={() => navigate('guide/gear')}>{t("מחשבון משקל ורשימה מלאה ←")}</button>
          <StepNav />
        </div>}

      {/* ---------- 6. safety ---------- */}
      {step === 'safety' && preview && <div className="card stack">
          <div className="card__title">{t("6. בטיחות, קשר וחירום")}</div>
          <div className="grid-2">
            <div className="field"><label>{t("איש קשר לחירום")}</label><input className="input" value={contacts.name} onChange={e => setContacts({
            ...contacts,
            name: e.target.value
          })} placeholder={t("שם")} /></div>
            <div className="field"><label>{t("טלפון")}</label><input className="input ltr" type="tel" value={contacts.phone} onChange={e => setContacts({
            ...contacts,
            phone: e.target.value
          })} /></div>
          </div>
          <div className="grid-2">
            <div className="field"><label>{t("שעת צ'ק-אין יומי")}</label><input className="input" type="time" value={contacts.checkin} onChange={e => setContacts({
            ...contacts,
            checkin: e.target.value
          })} /></div>
            <div className="field"><label>{t("הערות רפואיות / תרופות")}</label><input className="input" value={contacts.notes} onChange={e => setContacts({
            ...contacts,
            notes: e.target.value
          })} placeholder={t("אלרגיות, תרופות…")} /></div>
          </div>
          <Check k="safety:contact">{t("איש הקשר יודע את התוכנית ואת שעת הצ'ק-אין")}</Check>
          <Check k="safety:plan-shared">{t("שלחתי לו את הלו\"ז המלא (כפתור שיתוף בסיכום)")}</Check>
          <Check k="safety:insurance">{t("ביטוח (חילוץ/רפואי) מסודר")}</Check>
          <Check k="safety:apps">{t("מספרי חירום שמורים: 100 · 101 · *3639 · *6911")}</Check>
          <Check k="safety:floods">{t("יודע/ת לבדוק אזהרות שיטפונות ועומס חום לפני כל יום מדבר")}</Check>
          {readiness && <>
              <div className="bold mt">{t("אזהרות שנמצאו בתוכנית:")}</div>
              {readiness.checks.filter(c => c.level !== 'ok' && c.level !== 'info').map(c => <div key={c.key} className={`alert small ${c.level === 'bad' ? 'alert--danger' : 'alert--warn'}`}><div><b>{c.title}:</b> {c.summary}</div></div>)}
              {readiness.checks.every(c => c.level === 'ok' || c.level === 'info') && <Alert kind="ok">{t("לא נמצאו אזהרות בטיחות בתוכנית.")}</Alert>}
            </>}
          <button className="btn btn--ghost btn--sm" onClick={() => navigate('guide/safety')}>{t("מדריך הבטיחות המלא ←")}</button>
          <StepNav />
        </div>}

      {/* ---------- 7. logistics ---------- */}
      {step === 'logistics' && preview && <div className="card stack">
          <div className="card__title">{t("7. לוגיסטיקה ותקציב")}</div>
          <div className="grid-3"><Stat value={`₪${preview.summary.budget.toLocaleString()}`} label={t("תקציב משוער")} /><Stat value={walking.filter(d => d.shabbat).length} label={t("שבתות בדרך")} /><Stat value={preview.days.length} label={t("ימים")} /></div>
          <Check k="log:to-start" sub={(logistics.logistics?.transport?.to_north_start_he || [])[1]}>{t("הגעה לנקודת ההתחלה (")}{draft.direction === 'sobo' ? t("חרמון") : t("אילת")}{t(") מתוכננת")}</Check>
          <Check k="log:from-end" sub={(logistics.logistics?.transport?.from_eilat_he || [])[1]}>{t("חזרה מנקודת הסיום (")}{draft.direction === 'sobo' ? t("אילת") : t("חרמון")}{t(") מתוכננת")}</Check>
          <Check k="log:money" sub={t("מזומן לחניונים/מלאכים, כרטיס אשראי, תקציב יומי")}>{t("כסף ותקציב")}</Check>
          <Check k="log:holidays" sub={logistics.logistics?.transport?.shabbat_he}>{t("בדקתי שבתות וחגים מול ימי הצטיידות ותחבורה")}</Check>
          <Check k="log:sim" sub={t("סוללת גיבוי, SIM עם דאטה, הורדת מפות ותוואי לשימוש לא מקוון")}>{t("טלפון, חשמל ומפות לא מקוונות")}</Check>
          <Acc title={t("💰 פירוט התקציב")}><p className="small">{lodgingData.budget?.assumptions_he}</p><button className="btn btn--sm mt" onClick={() => navigate('guide/budget')}>{t("מחשבון תקציב ←")}</button></Acc>
          <Acc title={t("🚌 תחבורה – פרטים")}><ul>{(logistics.logistics?.transport?.to_north_start_he || []).map((x, i) => <li key={i}>{x}</li>)}{(logistics.logistics?.transport?.from_eilat_he || []).map((x, i) => <li key={'e' + i}>{x}</li>)}</ul></Acc>
          <StepNav />
        </div>}

      {/* ---------- 8. summary ---------- */}
      {step === 'summary' && preview && <div className="stack">
          <div className="grid-3">
            <Stat value={preview.summary.days} label={t("ימים סה״כ")} /><Stat value={preview.summary.totalKm} label={t("ק\"מ")} /><Stat value={preview.summary.avgKm} label={t("ממוצע ק\"מ/יום")} />
            <Stat value={preview.summary.walkingDays} label={t("ימי הליכה")} /><Stat value={preview.summary.restDays} label={t("ימי מנוחה")} /><Stat value={`₪${preview.summary.budget.toLocaleString()}`} label={t("תקציב משוער")} />
          </div>
          <p className="small muted center">{fmtDateLong(preview.summary.startDate)} ← {fmtDateLong(preview.summary.endDate)}</p>
          <Readiness result={readiness} navigate={navigate} />
          <div className="card">
            <div className="card__title">{t("📋 מצב ההכנות")}</div>
            {[['lodging', t("לינה")], ['water', t("מים ואוכל")], ['gear', t("ציוד")], ['safety', t("בטיחות וקשר")], ['logistics', t("לוגיסטיקה")]].map(([k, n]) => {
          const p = progress[k];
          const pct = p.total ? Math.round(p.done / p.total * 100) : 100;
          return <div key={k} className="row between mb" onClick={() => setStep(k)} style={{
            cursor: 'pointer'
          }}><span className="small" style={{
              width: 90
            }}>{n}</span><div className="progress" style={{
              flex: 1
            }}><div style={{
                width: pct + '%'
              }} /></div><span className="tiny muted" style={{
              width: 44,
              textAlign: 'end'
            }}>{p.done}/{p.total}</span></div>;
        })}
          </div>
          <div className="row" style={{
        gap: 6
      }}>
            <button className="btn btn--sm" onClick={exportIcs}>{t("📅 ליומן")}</button><button className="btn btn--sm" onClick={exportText}><Icon name="share" size={16} /> {t("שיתוף")}</button><button className="btn btn--sm no-print" onClick={() => window.print()}>{t("🖨️ הדפסה")}</button>
            <button className="btn btn--sm btn--ghost" style={{
          color: 'var(--red)'
        }} onClick={clearPlan}>{t("🗑️ נקה תוכנית")}</button>
          </div>
          <div className="section-title">{t("לוח זמנים יומי")}</div>
          {Object.keys(wx).length > 0 && <p className="tiny muted">{t("🌤️ תחזית חיה מוצגת לימים שבטווח 16 הימים הקרובים.")}</p>}
          <div className="timeline">
            {preview.days.map(d => <div key={d.day} className={`tl-item ${d.rest ? 'rest' : ''}`} onClick={() => !d.rest && setDetail(d)} style={{
          cursor: d.rest ? 'default' : 'pointer'
        }}>
                <div className="row between">
                  <div><span className="tiny muted">{t("יום")} {d.day} · {fmtDate(d.date)}{d.shabbat ? t("· שבת") : ''}</span><div className="bold">{d.rest ? t("😌 יום מנוחה") : d.title}</div></div>
                  {!d.rest && <div className="seg__km">{d.km}<small> {t("ק\"מ")}</small></div>}
                </div>
                {!d.rest && <div className="small muted">🛏 {d.overnight}{task(`lodging:${d.day}`) ? ' ✓' : ''}</div>}
                {wx[d.day] && <div className="row" style={{
            gap: 6,
            marginTop: 2
          }}><span className={`wx-pill ${wx[d.day].v.cls}`}>{wx[d.day].icon} {wx[d.day].tmax}°/{wx[d.day].tmin}°{wx[d.day].rain > 15 ? ` ☔${wx[d.day].rain}%` : ''} · {wx[d.day].v.label}</span></div>}
                {d.notes?.filter(n => n.startsWith(t("סכנת")) || n.startsWith(t("חם")) || n.startsWith(t("חום")) || n.includes(t("הטמנת")) || n.includes(t("שטח אש"))).slice(0, 2).map((n, i) => <div key={i} className="tiny" style={{
            color: n.startsWith(t("סכנת")) ? 'var(--red)' : 'var(--orange)'
          }}>⚠ {n}</div>)}
              </div>)}
          </div>
          <StepNav />
        </div>}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? t("יום {0}: {1}", detail.day, detail.title) : ''}>
        {detail && <div className="stack small">
            <div className="muted">{fmtDateLong(detail.date)} · {detail.km} {t("ק\"מ · כ-")}{detail.hours} {t("שעות ·")} {detail.region}</div>
            <div><b>{t("לינה:")}</b> {detail.overnight}</div>
            {detail.notes?.length > 0 && <div><b>{t("דגשים:")}</b><ul>{detail.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></div>}
            <div className="row">{detail.segments.map(id => <button key={id} className="btn btn--sm" onClick={() => navigate(`segments/${id}`)}>{t("מקטע")} {id} ←</button>)}<button className="btn btn--sm btn--primary" onClick={() => navigate(`segments/${detail.segments[0]}/story`)}>{t("🧭 סיפור דרך")}</button></div>
          </div>}
      </Modal>
    </div>;
}
function SeasonStrip({
  month,
  days
}) {
  const span = Math.min(12, Math.ceil(days / 30) + 1);
  return <div>
      <div className="tiny muted mb">{t("התאמת העונה לאורך המסע (לפי חודש יציאה):")}</div>
      {[['north', t("צפון")], ['center', t("מרכז")], ['negev', t("נגב")]].map(([g, n]) => <div key={g} className="month-row mb">
          <span className="tiny" style={{
        width: 36,
        flex: 'none'
      }}>{n}</span>
          {Array.from({
        length: 12
      }).map((_, i) => {
        const m = (month + i) % 12;
        const lvl = MONTHS[g][m];
        return <div key={i} className={`month-cell ${LEVEL_CLS[lvl]}`} title={`${t(HE_MONTHS[m])}: ${t(LEVEL_HE[lvl])}`} style={{
          opacity: i < span ? 1 : 0.25
        }}>{t(HE_MONTHS_SHORT[m])}</div>;
      })}
        </div>)}
    </div>;
}