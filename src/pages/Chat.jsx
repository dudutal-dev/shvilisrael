import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icons.jsx';
import { Empty } from '../components/UI.jsx';
import { useGroup } from '../hooks/useGroup.js';
import { useToast } from '../hooks/useToast.jsx';
import { say, markRead } from '../lib/group.js';
import { Avatar, memberColor } from './Group.jsx';
import { locale, t } from '../i18n/index.js'
const QUICK = ["איפה אתם?", "אני בדרך", "עצרתי למנוחה", "הגעתי לחניון"];
export default function Chat({
  navigate
}) {
  const g = useGroup();
  const toast = useToast();
  const [text, setText] = useState('');
  const box = useRef();
  useEffect(() => {
    markRead();
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [g.msgs.length, g.joined]);
  if (!g.joined) return <div className="page stack">
      <Empty icon="💬" text={t("עוד אין קבוצה. פתחו קבוצת מסע או הצטרפו עם קוד, והצ'אט ייפתח כאן.")} />
      <button className="btn btn--primary" style={{
      alignSelf: 'center'
    }} onClick={() => navigate('group')}>{t("לקבוצת המסע")}</button>
    </div>;
  const submit = async e => {
    e.preventDefault();
    const x = text.trim();
    if (!x) return;
    setText('');
    if (!(await say(x))) {
      setText(x);
      toast(t("אין קליטה – ההודעה לא נשלחה"));
    }
  };
  const here = () => {
    if (!navigator.geolocation) return toast(t("המכשיר לא תומך באיתור מיקום"));
    toast(t("מאתר מיקום…"));
    navigator.geolocation.getCurrentPosition(async p => {
      if (!(await say(t("אני כאן 📍"), {
        lat: +p.coords.latitude.toFixed(5),
        lon: +p.coords.longitude.toFixed(5)
      }))) toast(t("אין קליטה – ההודעה לא נשלחה"));
    }, () => toast(t("לא הצלחנו לאתר מיקום")), {
      enableHighAccuracy: true,
      timeout: 15000
    });
  };
  const hm = ts => new Date(ts).toLocaleTimeString(locale(), {
    hour: '2-digit',
    minute: '2-digit'
  });
  return <div className="page page--full chat">
      <div className="chat__head"><span className="small muted">{t("{0} בקבוצה", Object.keys({
          [g.id]: 1,
          ...g.members
        }).length)} · {g.online ? t("מחוברים") : t("מתחבר…")} · 🔒 {t("מוצפן")}</span><button className="linkbtn small" onClick={() => navigate('group')}>{t("הקבוצה")}</button></div>
      <div className="chat__list" ref={box}>
        {g.msgs.length === 0 && <p className="chat__sys">{t("עוד אין הודעות. כתבו משהו לקבוצה.")}</p>}
        {g.msgs.map(m => m.x === null ? <p key={m.id} className="chat__sys">{t("{0} הצטרף/ה לקבוצה", m.n)}</p> : <div key={m.id} className={`chat__row ${m.d === g.id ? 'mine' : ''}`}>
            {m.d !== g.id && <Avatar id={m.d} name={m.n} size={30} />}
            <div className={`chat__msg ${m.pending ? 'pending' : ''}`}>
              {m.d !== g.id && <b style={{
            color: memberColor(m.d)
          }}>{m.n}</b>}
              <span>{m.x}</span>
              {m.lat && <button className="linkbtn" onClick={() => navigate(`map?lat=${m.lat}&lon=${m.lon}`)}>🗺️ {t("הצגה במפה")}</button>}
              <small>{hm(m.ts)}{m.pending ? ' · ' + t("נשלח…") : ''}</small>
            </div>
          </div>)}
      </div>
      <div className="chat__quick">{QUICK.map(q => <button key={q} className="chip chip--btn" onClick={async () => {
        if (!(await say(t(q)))) toast(t("אין קליטה – ההודעה לא נשלחה"));
      }}>{t(q)}</button>)}<button className="chip chip--btn" onClick={here}>📍 {t("אני כאן")}</button></div>
      <form className="chat__form" onSubmit={submit}>
        <input className="input" value={text} onChange={e => setText(e.target.value)} maxLength={500} placeholder={t("הודעה לקבוצה…")} enterKeyHint="send" autoComplete="off" />
        <button className="btn btn--primary" aria-label={t("שליחה")}><Icon name="send" size={18} /></button>
      </form>
    </div>;
}
