import { useMemo, useState } from 'react';
import { useApp } from '../context.jsx';
import { Acc, Alert, Modal, Section, Empty } from '../components/UI.jsx';
import { Photo } from '../components/Photo.jsx';
import { Icon } from '../components/Icons.jsx';
import { fmtDate, addDays, toISODate } from '../lib/dates.js';
import lodging from '../data/lodging.json';
import spni from '../data/spni/angels.json';
import { t, tf } from '../i18n/index.js'
const STATUS = {
  todo: ['לתאם', 'chip'],
  sent: ['נשלחה הודעה', 'chip chip--blue'],
  ok: ['מאושר ✓', 'chip chip--green'],
  no: ['לא זמין', 'chip chip--red']
};
export default function Angels({
  navigate
}) {
  const {
    angels,
    setAngels,
    segments,
    itinerary
  } = useApp();
  const ta = lodging.trail_angels || {};
  const [tab, setTab] = useState('learn');
  const [edit, setEdit] = useState(null);
  const [q, setQ] = useState('');

  // which upcoming itinerary days suggest trail angels → reminders
  const upcoming = useMemo(() => {
    if (!itinerary) return [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return itinerary.days.filter(d => !d.rest && d.date >= now && /מלאכ/.test(d.overnight || '')).slice(0, 6).map(d => ({
      ...d,
      contactBy: addDays(d.date, -2),
      hasContact: angels.some(a => d.segments.includes(Number(a.segId)))
    }));
  }, [itinerary, angels]);
  const save = () => {
    setAngels(l => l.some(x => x.id === edit.id) ? l.map(x => x.id === edit.id ? edit : x) : [...l, edit]);
    setEdit(null);
  };
  const [regionIdx, setRegionIdx] = useState(0);
  const official = (spni.angels || []).filter(a => (!regionIdx || a.region_index === regionIdx) && (!q || (a.settlement + a.offer + a.region).includes(q)));
  const locations = (ta.notable_locations || []).filter(l => !q || (l.settlement_he + l.note + l.region).includes(q));
  return <div className="page stack">
      <div className="hero hero--sm">
        <Photo photoKey="trail_angels" credit={false} style={{
        position: 'absolute',
        inset: 0,
        aspectRatio: 'auto',
        borderRadius: 0
      }} />
        <div className="hero__overlay" />
        <div className="hero__content"><h1 style={{
          fontSize: 24
        }}>{t("😇 מלאכי השביל")}</h1><p className="small">{t("האנשים שהופכים את שביל ישראל למסע של חסד")}</p></div>
      </div>
      <div className="segmented" style={{
      alignSelf: 'center'
    }}>{[['learn', t("מי הם?")], ['where', t("הרשימה הרשמית ({0})", spni.angels.length)], ['mine', t("המלאכים שלי ({0})", angels.length)]].map(([k, v]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{v}</button>)}</div>

      {tab === 'learn' && <div className="stack">
          <div className="card card--glow"><p style={{
          fontSize: 16,
          lineHeight: 1.7
        }}>{ta.description_he}</p></div>
          <Section title={t("איך זה עובד")} icon="info">
            <div className="steps">
              {[['1', t("מאתרים"), t("ברשימת החברה להגנת הטבע, בקבוצות הפייסבוק/וואטסאפ או מפה לאוזן בשביל.")], ['2', t("מתאמים מראש"), t("הודעת וואטסאפ 24–48 שעות לפני: מי אתם, כמה אתם, מתי מגיעים ומה אתם צריכים (רצפה/מקלחת/כביסה).")], ['3', t("מגיעים בזמן"), t("מעדכנים על עיכובים; לא מגיעים אחרי חשכה בלי לתאם.")], ['4', t("אורחים טובים"), t("עוזרים, לא מבזבזים מים וחשמל, משאירים נקי, מודים – ומשלמים קדימה כשתוכלו.")]].map(([n, t, d]) => <div key={n} className="step"><div className="step__n">{n}</div><div><div className="bold">{t}</div><div className="small muted">{d}</div></div></div>)}
            </div>
          </Section>
          <Acc title={t("כללי התנהגות מלאים")} open><ul className="stack" style={{
          gap: 6
        }}>{(ta.etiquette_he || []).map((x, i) => <li key={i}>{x}</li>)}</ul></Acc>
          <Acc title={t("רשימות רשמיות וקהילות (קישורים)")}><div className="stack" style={{
          gap: 6
        }}>{(ta.how_to_find || []).map((h, i) => <a key={i} href={h.url} target="_blank" rel="noreferrer" className="small">🔗 {h.name}</a>)}</div></Acc>
          <Alert kind="info">{t("מספרי הטלפון של המלאכים אינם מפורסמים באפליקציה (פרטיות). שמרו אותם בכרטיסייה \"המלאכים שלי\" לאחר שתקבלו מהרשימות הרשמיות.")}</Alert>
        </div>}

      {tab === 'where' && <div className="stack">
          <Alert kind="info">{t("הרשימה הרשמית של החברה להגנת הטבע (")}{spni.angels.length} {t("מארחים,")} {spni.fetched}). {spni.contact_note_he}</Alert>
          <input className="input" placeholder={t("חיפוש יישוב / מה מציעים…")} value={q} onChange={e => setQ(e.target.value)} />
          <div className="row" style={{
        gap: 6,
        overflowX: 'auto',
        flexWrap: 'nowrap',
        paddingBottom: 4
      }}>
            <button className={`chip chip--btn ${!regionIdx ? 'active' : ''}`} onClick={() => setRegionIdx(0)}>{t("הכל")}</button>
            {spni.regions.map(r => <button key={r.index} className={`chip chip--btn ${regionIdx === r.index ? 'active' : ''}`} style={{
          whiteSpace: 'nowrap'
        }} onClick={() => setRegionIdx(r.index)}>{r.name}</button>)}
          </div>
          {regionIdx > 0 && <a className="btn btn--sm btn--primary" href={spni.regions.find(r => r.index === regionIdx)?.url} target="_blank" rel="noreferrer">{t("📞 פרטי הקשר של אזור זה באתר החברה להגנת הטבע")}</a>}
          <div className="stack" style={{
        gap: 6
      }}>
            {official.map((a, i) => <div key={i} className="card angel-card" style={{
          padding: 12
        }}>
                <div className="row between"><b>😇 {a.settlement}</b><span className="tag">{a.region}</span></div>
                <p className="small muted mt" style={{
            whiteSpace: 'pre-line'
          }}>{a.offer}</p>
                <div className="row mt" style={{
            gap: 6
          }}>
                  <a className="btn btn--sm btn--ghost" href={a.url} target="_blank" rel="noreferrer">{t("פרטי קשר באתר")}</a>
                  <button className="btn btn--sm" onClick={() => {
              setEdit({
                id: Date.now(),
                name: '',
                settlement: a.settlement,
                phone: '',
                segId: '',
                notes: a.offer.slice(0, 160),
                status: 'todo'
              });
              setTab('mine');
            }}>{t("+ שמירה אצלי")}</button>
                </div>
              </div>)}
          </div>
          {official.length === 0 && <Empty icon="😇" text={t("לא נמצאו מארחים לחיפוש הזה")} />}
          {locations.length > 0 && regionIdx === 0 && !q && <details className="acc"><summary>{t("יישובים נוספים עם מסורת אירוח (ממקורות קהילתיים)")}</summary><div className="acc__body stack" style={{
          gap: 6
        }}>{locations.map((l, i) => <div key={i} className="small"><b>{l.settlement_he}</b> ({l.region}) – {l.note}{l.lat && <button className="linkbtn tiny" style={{
              marginInlineStart: 6
            }} onClick={() => navigate(`map?lat=${l.lat}&lon=${l.lon}`)}>{t("📍 במפה")}</button>}</div>)}</div></details>}
        </div>}

      {tab === 'mine' && <div className="stack">
          {upcoming.length > 0 && <div className="card" style={{
        borderColor: 'var(--orange)'
      }}>
              <div className="card__title"><Icon name="warn" />{t("תזכורות תיאום")}</div>
              {upcoming.map(d => <div key={d.day} className="row between small mb"><span>{t("יום")} {d.day} · {fmtDate(d.date)} – {d.overnight}</span><span className={d.hasContact ? 'chip chip--green' : 'chip chip--orange'}>{d.hasContact ? t("יש איש קשר") : t("לתאם עד {0}", fmtDate(d.contactBy))}</span></div>)}
            </div>}
          <button className="btn btn--primary" onClick={() => setEdit({
        id: Date.now(),
        name: '',
        settlement: '',
        phone: '',
        segId: '',
        notes: '',
        status: 'todo'
      })}>{t("+ הוספת מלאך")}</button>
          {angels.length === 0 && <Empty icon="😇" text={t("עוד אין אנשי קשר. הוסיפו מלאכים שמצאתם ברשימות ותאמו איתם מראש.")} />}
          {angels.map(a => <div key={a.id} className="card angel-card" onClick={() => setEdit(a)} style={{
        cursor: 'pointer'
      }}>
              <div className="row between"><b>{a.name || a.settlement}</b><span className={STATUS[a.status]?.[1] || 'chip'}>{t(STATUS[a.status]?.[0])}</span></div>
              <div className="small muted">{a.settlement}{a.segId ? t("· מקטע {0}", a.segId) : ''}</div>
              {a.notes && <p className="small mt">{a.notes}</p>}
              {a.phone && <div className="row mt" style={{
          gap: 6
        }} onClick={e => e.stopPropagation()}>
                <a className="btn btn--sm" href={`tel:${a.phone}`}>{t("📞 חיוג")}</a>
                <a className="btn btn--sm btn--blue" href={`https://wa.me/${a.phone.replace(/\D/g, '').replace(/^0/, '972')}?text=${encodeURIComponent(t("שלום {0}! אני הולך/ת בשביל ישראל ומתכנן/ת להגיע ל{1} ב-{2}. האם ניתן ללון אצלכם? תודה רבה 🙏", a.name || '', a.settlement, a.date || t("תאריך")))}`} target="_blank" rel="noreferrer">{t("💬 וואטסאפ")}</a>
              </div>}
            </div>)}
        </div>}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={t("מלאך שביל")}>
        {edit && <div className="stack">
            <div className="grid-2">
              <div className="field"><label>{t("שם")}</label><input className="input" value={edit.name} onChange={e => setEdit({
              ...edit,
              name: e.target.value
            })} /></div>
              <div className="field"><label>{t("יישוב")}</label><input className="input" value={edit.settlement} onChange={e => setEdit({
              ...edit,
              settlement: e.target.value
            })} /></div>
            </div>
            <div className="grid-2">
              <div className="field"><label>{t("טלפון")}</label><input className="input ltr" type="tel" value={edit.phone} onChange={e => setEdit({
              ...edit,
              phone: e.target.value
            })} /></div>
              <div className="field"><label>{t("תאריך הגעה")}</label><input className="input" type="date" value={edit.date || ''} onChange={e => setEdit({
              ...edit,
              date: e.target.value
            })} /></div>
            </div>
            <div className="field"><label>{t("מקטע")}</label><select className="select" value={edit.segId} onChange={e => setEdit({
            ...edit,
            segId: e.target.value
          })}><option value="">—</option>{segments.map(s => <option key={s.id} value={s.id}>{s.id}. {tf(s, 'name')}</option>)}</select></div>
            <div className="field"><label>{t("סטטוס")}</label><div className="segmented" style={{
            flexWrap: 'wrap'
          }}>{Object.entries(STATUS).map(([k, [v]]) => <button key={k} className={edit.status === k ? 'active' : ''} onClick={() => setEdit({
              ...edit,
              status: k
            })}>{v}</button>)}</div></div>
            <div className="field"><label>{t("הערות")}</label><textarea className="textarea" value={edit.notes} onChange={e => setEdit({
            ...edit,
            notes: e.target.value
          })} placeholder={t("מה מציעים, מתי זמינים, איך הגעתם אליהם…")} /></div>
            <div className="row between"><button className="btn btn--ghost btn--sm" style={{
            color: 'var(--red)'
          }} onClick={() => {
            setAngels(l => l.filter(x => x.id !== edit.id));
            setEdit(null);
          }}>{t("מחיקה")}</button><button className="btn btn--primary" onClick={save}>{t("שמירה")}</button></div>
          </div>}
      </Modal>
    </div>;
}