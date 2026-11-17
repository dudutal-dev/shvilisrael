import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icons.jsx';
import { Empty } from '../components/UI.jsx';
import { useGroup } from '../hooks/useGroup.js';
import { useToast } from '../hooks/useToast.jsx';
import { say, sayFile, markRead, setChatOpen, tickState, getChatFile, requestFile } from '../lib/group.js';
import { Avatar, memberColor } from './Group.jsx';
import { locale, t } from '../i18n/index.js'
const QUICK = ["איפה אתם?", "אני בדרך", "עצרתי למנוחה", "הגעתי לחניון"];
const EMOJI = ['😀', '😂', '🤣', '🥰', '😍', '😎', '🤩', '🥳', '😅', '😉', '🙈', '😴', '🥵', '🥶', '😭', '🤯', '👍', '👏', '🙏', '💪', '🙌', '👌', '❤️', '🔥', '✨', '🎉', '🥾', '⛺', '🏕️', '🌄', '🌅', '🏜️', '⛰️', '🌵', '💧', '🚰', '☀️', '🌧️', '💨', '🌙', '⭐', '🍉', '☕', '🥙', '🩹', '📸', '📍', '🧭'];
const TICK = {
  pending: '🕓',
  sent: '✓',
  delivered: '✓✓',
  read: '✓✓'
};
const kb = n => n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB';
async function shareFile(f) {
  const v = await getChatFile(f.id);
  if (!v) return;
  const file = new File([v.blob], f.name, {
    type: v.blob.type
  });
  if (navigator.canShare?.({
    files: [file]
  })) {
    try {
      await navigator.share({
        files: [file]
      });
      return;
    } catch (e) {
      if (e?.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(v.blob);
  a.download = f.name;
  document.body.append(a);
  a.click();
  a.remove();
}
function ChatFile({
  f,
  state,
  onOpen,
  toast
}) {
  const [url, setUrl] = useState(null);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    let alive = true,
      u = null;
    getChatFile(f.id).then(v => {
      if (!alive) return;
      if (v) {
        u = URL.createObjectURL(v.blob);
        setUrl(u);
        setGone(false);
      } else setGone(true);
    });
    return () => {
      alive = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [f.id, state]);
  const ico = f.img ? '🖼️' : f.vid ? '🎬' : '📄';
  if (url && f.vid) return <><video className="chat__vid" src={url} controls playsInline preload="metadata" /><button type="button" className="chat__flink" onClick={() => shareFile(f)}>{t("שמירה או שיתוף")} · {kb(f.size)}</button></>;
  if (url) return f.img ? <img className="chat__img" src={url} alt="" onClick={() => onOpen({
    url,
    f
  })} /> : <button type="button" className="chat__doc" onClick={() => shareFile(f)}>{ico} <span>{f.name}</span><small>{kb(f.size)}</small></button>;
  if (state === 'loading' || !gone && state !== 'missing') return <span className="chat__doc chat__doc--wait">{ico} {t("טוען…")}</span>;
  return <button type="button" className="chat__doc" onClick={async () => {
    if (!(await requestFile(f.id))) toast(t("אף אחד מחברי הקבוצה שמחזיק את הקובץ לא מחובר כרגע"));
  }}>{ico} <span>{f.name}</span><small>{t("כבר לא בשרת · לחצו לבקש שוב")}</small></button>;
}
export default function Chat({
  navigate
}) {
  const g = useGroup();
  const toast = useToast();
  const [text, setText] = useState('');
  const [emoji, setEmoji] = useState(false);
  const [view, setView] = useState(null);
  const box = useRef();
  const file = useRef();
  useEffect(() => {
    setChatOpen(true);
    return () => setChatOpen(false);
  }, []);
  useEffect(() => {
    markRead();
    setChatOpen(true); // acknowledges anything that arrived while this screen is open
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
    setEmoji(false);
    if (!(await say(x))) {
      setText(x);
      toast(t("אין קליטה – ההודעה לא נשלחה"));
    }
  };
  const attach = async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const x = text.trim();
    setText('');
    if (f.size > 3e6) toast(t("מעלה… זה יכול לקחת כמה שניות"), 8000);
    const r = await sayFile(f, x);
    if (r !== 'ok') {
      setText(x);
      toast(r === 'big' ? t("הקובץ גדול מדי. אפשר לשלוח עד 14 מ\"ב") : r === 'bigvideo' ? t("הסרטון גדול מדי. אפשר לשלוח עד 14 מ\"ב, בערך 10–20 שניות") : r === 'unreadable' ? t("לא הצלחנו לקרוא את התמונה") : t("אין קליטה – הקובץ לא נשלח"));
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
        {g.msgs.map(m => {
        if (m.x === null) return <p key={m.id} className="chat__sys">{t("{0} הצטרף/ה לקבוצה", m.n)}</p>;
        const mine = m.d === g.id,
          tick = mine ? tickState(m, g) : null;
        return <div key={m.id} className={`chat__row ${mine ? 'mine' : ''}`}>
            {!mine && <Avatar id={m.d} name={m.n} av={g.members[m.d]?.av} size={30} />}
            <div className={`chat__msg ${m.pending ? 'pending' : ''}`}>
              {!mine && <b style={{
              color: memberColor(m.d)
            }}>{m.n}</b>}
              {m.f && <ChatFile f={m.f} state={g.fst[m.f.id]} onOpen={setView} toast={toast} />}
              {m.x && <span>{m.x}</span>}
              {m.lat && <button className="linkbtn" onClick={() => navigate(`map?lat=${m.lat}&lon=${m.lon}`)}>🗺️ {t("הצגה במפה")}</button>}
              <small>{hm(m.ts)}{tick && <i className={`chat__tick chat__tick--${tick}`}>{TICK[tick]}</i>}</small>
            </div>
          </div>;
      })}
      </div>
      <div className="chat__quick">{QUICK.map(q => <button key={q} className="chip chip--btn" onClick={async () => {
        if (!(await say(t(q)))) toast(t("אין קליטה – ההודעה לא נשלחה"));
      }}>{t(q)}</button>)}<button className="chip chip--btn" onClick={here}>📍 {t("אני כאן")}</button></div>
      {emoji && <div className="chat__emoji">{EMOJI.map(x => <button key={x} type="button" onClick={() => setText(v => v + x)}>{x}</button>)}</div>}
      <form className="chat__form" onSubmit={submit}>
        <button type="button" className="chat__ibtn" onClick={() => setEmoji(!emoji)} aria-label={t("סמיילים")}>😊</button>
        <button type="button" className="chat__ibtn" onClick={() => file.current.click()} aria-label={t("צירוף תמונה, סרטון או מסמך")}>📎</button>
        <input className="input" value={text} onChange={e => setText(e.target.value)} maxLength={500} placeholder={t("הודעה לקבוצה…")} enterKeyHint="send" autoComplete="off" />
        <button className="btn btn--primary" aria-label={t("שליחה")}><Icon name="send" size={18} /></button>
      </form>
      <input ref={file} type="file" hidden onChange={attach} />
      {view && <div className="lightbox" onClick={() => setView(null)}><img src={view.url} alt="" /><button className="btn chat__save" onClick={e => {
        e.stopPropagation();
        shareFile(view.f);
      }}>{t("שמירה או שיתוף")}</button></div>}
    </div>;
}
