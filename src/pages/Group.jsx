import { useEffect, useState } from 'react';
import { Icon } from '../components/Icons.jsx';
import { Alert } from '../components/UI.jsx';
import { useGroup } from '../hooks/useGroup.js';
import { useToast } from '../hooks/useToast.jsx';
import { join, leave, newCode, cryptoOk, inviteText, pushSupported, pushActive, pushEnable, pushTest } from '../lib/group.js';
import { t } from '../i18n/index.js'
const COLORS = ['#f26b1d', '#1d4ed8', '#2f855a', '#d69e2e', '#7c3aed', '#0891b2', '#c53030', '#be185d'];
export const memberColor = id => COLORS[[...String(id)].reduce((s, c) => s + c.charCodeAt(0), 0) % COLORS.length];
export function Avatar({
  id,
  name,
  size = 38
}) {
  return <span className="avatar" style={{
    background: memberColor(id),
    width: size,
    height: size,
    fontSize: size * 0.38
  }}>{String(name || '?').slice(0, 2)}</span>;
}
export function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  return m < 1 ? t("עכשיו") : m < 60 ? t("לפני {0} דק'", m) : m < 1440 ? t("לפני {0} שע'", Math.round(m / 60)) : t("לפני {0} ימים", Math.round(m / 1440));
}
export default function Group({
  navigate,
  query
}) {
  const g = useGroup();
  const toast = useToast();
  const [name, setName] = useState(g.name || '');
  const [code, setCode] = useState(query?.code || '');
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const [push, setPush] = useState(false);
  useEffect(() => {
    pushActive().then(setPush);
  }, [g.push, g.joined]);
  const doJoin = async (c, created) => {
    if (!cryptoOk()) return toast(t("הדפדפן הזה לא תומך בהצפנה הדרושה"));
    if (!name.trim()) return toast(t("איך קוראים לכם?"));
    if (c.replace(/[^A-Za-z0-9]/g, '').length < 6) return toast(t("הקוד קצר מדי"));
    setBusy(true);
    await join(c, name);
    setBusy(false);
    toast(created ? t("הקבוצה נוצרה. שלחו את הקוד לשותפים למסע") : t("הצטרפתם לקבוצה ✓"));
  };
  const invite = async () => {
    const text = inviteText(t("הצטרפו לקבוצת המסע שלנו באפליקציית שביל ישראל 🥾\n{url}\nקוד הקבוצה: {code}"));
    if (navigator.share) {
      try {
        await navigator.share({
          text
        });
        return;
      } catch {/* cancelled */}
    }
    await navigator.clipboard?.writeText(text);
    toast(t("ההזמנה הועתקה"));
  };
  const enablePush = async () => {
    const r = await pushEnable();
    setPush(r === 'ok');
    toast(r === 'ok' ? t("ההתראות פעילות ✓") : r === 'unsupported' ? t("כדי לקבל התראות יש לפתוח את האפליקציה מהאייקון שבמסך הבית") : r === 'denied' ? t("ההתראות חסומות בהגדרות המכשיר") : t("הפעלת ההתראות נכשלה. נסו שוב"));
  };
  if (!g.joined) return <div className="page stack">
      <h2 className="section-title"><Icon name="users" />{t("קבוצת מסע")}</h2>
      <div className="card card--glow">
        <p>{t("הולכים יחד? פתחו קבוצה ושתפו קוד. מי שמצטרף מקבל צ'אט קבוצתי ויומן מסע משותף, כולל תמונות.")}</p>
        <p className="small muted mt">{t("ההודעות והתמונות מוצפנות במכשיר עם קוד הקבוצה. רק מי שיש לו את הקוד יכול לקרוא.")}</p>
      </div>
      <div className="card stack">
        <div className="field"><label>{t("השם שלכם בקבוצה")}</label><input className="input" value={name} maxLength={16} onChange={e => setName(e.target.value)} placeholder={t("למשל: דנה")} /></div>
        <div className="field"><label>{t("קוד קבוצה")}</label><input className="input mono ltr" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX" autoCapitalize="characters" autoComplete="off" /></div>
        <button className="btn btn--primary btn--block" disabled={busy} onClick={() => doJoin(code, false)}>{t("הצטרפות עם הקוד")}</button>
        <p className="small muted center">{t("הראשון פותח קבוצה ושולח את הקוד לכולם:")}</p>
        <button className="btn btn--block" disabled={busy} onClick={() => doJoin(newCode(), true)}>{t("פתיחת קבוצה חדשה")}</button>
      </div>
    </div>;
  const ids = [g.id, ...Object.keys(g.members).filter(i => i !== g.id)];
  return <div className="page stack">
      <div className="card card--glow">
        <div className="row between">
          <div><div className="tiny muted">{t("קוד קבוצה")}</div><div className="group-code mono ltr">{g.code}</div></div>
          <button className="btn btn--primary btn--sm" onClick={invite}><Icon name="share" size={16} />{t("הזמנת שותפים")}</button>
        </div>
        <div className="row mt" style={{
        gap: 8
      }}>
          <button className="btn btn--blue" style={{
          flex: 1
        }} onClick={() => navigate('chat')}><Icon name="chat" size={18} />{t("צ'אט")}{g.unread > 0 && <span className="badge-n">{g.unread}</span>}</button>
          <button className="btn" style={{
          flex: 1
        }} onClick={() => navigate('journal?tab=shared')}><Icon name="journal" size={18} />{t("יומן משותף")}</button>
        </div>
      </div>
      <div className="card">
        <div className="card__title row between"><span>{t("חברי הקבוצה ({0})", ids.length)}</span><span className={`chip ${g.online ? 'chip--green' : ''}`}>{g.online ? t("מחוברים") : t("מתחבר…")}</span></div>
        <div className="stack" style={{
        gap: 10
      }}>{ids.map(id => {
          const me = id === g.id,
            m = g.members[id] || {};
          return <div key={id} className="row" style={{
            flexWrap: 'nowrap'
          }}><Avatar id={id} name={me ? g.name : m.n} /><div><div className="bold">{me ? g.name : m.n} {me && <span className="muted small">{t("(אני)")}</span>}</div>{!me && m.seen && <div className="tiny muted">{t("נראו")} {ago(m.seen)}</div>}</div></div>;
        })}</div>
      </div>
      <div className="card">
        <div className="card__title row between"><span>🔔 {t("התראות")}</span><span className={`chip ${push ? 'chip--green' : ''}`}>{push ? t("פעילות") : t("כבויות")}</span></div>
        <p className="small muted">{pushSupported() ? t("התראה על כל הודעה בצ'אט, גם כשהאפליקציה סגורה. לחיצה עליה פותחת את הצ'אט.") : t("כדי לקבל התראות באייפון יש להוסיף את האפליקציה למסך הבית ולפתוח אותה משם (iOS 16.4 ומעלה).")}</p>
        <div className="row mt">{!push ? <button className="btn btn--primary btn--sm" onClick={enablePush}>{t("הפעלת התראות")}</button> : <button className="btn btn--sm" onClick={async () => toast((await pushTest(t("התראת ניסיון 🥾"))) ? t("נשלחה. היא אמורה לקפוץ תוך שניות") : t("השליחה נכשלה"))}>{t("התראת ניסיון")}</button>}</div>
      </div>
      <Alert kind="info">{t("הצ'אט והיומן המשותף פועלים כשיש קליטה. הודעות שנשלחו כשהייתם בלי קליטה מחכות עד 12 שעות; רשומות יומן ותמונות מושלמות אוטומטית כשחבר קבוצה שמחזיק אותן מחובר.")}</Alert>
      <button className="btn btn--ghost btn--sm" style={{
      color: 'var(--red)',
      alignSelf: 'center'
    }} onClick={async () => {
      if (!sure) return setSure(true);
      await leave();
      setSure(false);
    }}>{sure ? t("בטוחים? לחצו שוב ליציאה") : t("יציאה מהקבוצה")}</button>
    </div>;
}
