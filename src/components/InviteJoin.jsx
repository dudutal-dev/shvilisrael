import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useGroup } from '../hooks/useGroup.js';
import { useToast } from '../hooks/useToast.jsx';
import { join, cryptoOk } from '../lib/group.js';
import { t } from '../i18n/index.js'

const USED = 'shvil:jused';
const norm = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const used = () => { try { return (localStorage.getItem(USED) || '').split(',').filter(Boolean); } catch { return []; } };
const markUsed = c => { try { const u = used(); if (!u.includes(c)) localStorage.setItem(USED, [...u, c].slice(-20).join(',')); } catch { /* private mode */ } };
/** The group code carried by an invite link (?j=CODE). An invite joins once: after leaving, the same link does not re-join. */
export function inviteCode() {
  let c = '';
  try { c = new URLSearchParams(location.search).get('j') || ''; } catch { /* ignore */ }
  c = norm(c);
  return c.length >= 6 && c.length <= 20 && !used().includes(c) ? c : '';
}
const ShareIc = () => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>;
const PlusIc = () => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 8v8M8 12h8" /></svg>;

/**
 * Opens when the app is launched from an invite link. The app has to be on the home screen:
 *  - Android: one button joins the group and opens the phone's install prompt.
 *  - iPhone: a site cannot install itself, so the three manual steps are shown; the home-screen copy keeps
 *    the invite code (index.html drops the manifest for this visit) and joins on its first launch.
 */
export function InviteJoin() {
  const g = useGroup();
  const toast = useToast();
  const [code] = useState(inviteCode);
  const [name, setName] = useState(g.name || '');
  const [steps, setSteps] = useState(false);
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState(false);
  const ua = navigator.userAgent, ios = /iPhone|iPad|iPod/.test(ua);
  const alone = matchMedia('(display-mode: standalone)').matches || !!navigator.standalone;
  if (closed || !code || (g.joined && !steps)) return null;
  const doJoin = async () => {
    if (!cryptoOk()) return toast(t("הדפדפן הזה לא תומך בהצפנה הדרושה"));
    if (!name.trim()) return toast(t("איך קוראים לכם?"));
    setBusy(true);
    const ev = window.__shvilInstall;
    if (!alone && ev) { // Android: the install prompt has to open inside the tap
      window.__shvilInstall = null;
      try { ev.prompt(); const c = await ev.userChoice; if (c && c.outcome !== 'accepted') { window.__shvilInstall = ev; setBusy(false); return toast(t("כדי להצטרף צריך להתקין את האפליקציה במסך הבית"), 5000); } } catch { /* fall through to the manual steps */ }
    } else if (!alone) setSteps(true);
    markUsed(code);
    await join(code, name);
    setBusy(false);
    toast(t("הצטרפתם לקבוצה ✓"));
    if (alone || ev) setClosed(true);
  };
  const manual = steps || (ios && !alone);
  return createPortal(<div className="modal-bg">
      <div className="modal invite">
        <h3>{t("הוזמנתם לקבוצת מסע 🥾")}</h3>
        {manual ? <>
            <p className="small muted">{ios ? t("כדי להצטרף צריך את האפליקציה במסך הבית. האייפון לא מרשה לאתר להתקין את עצמו, אז עושים את זה פעם אחת, בשלושה צעדים:") : t("נשאר להתקין את האפליקציה במסך הבית, בשלושה צעדים:")}</p>
            {ios ? <ol className="invite__steps">
                <li>{t("לוחצים על כפתור השיתוף")} <span className="invite__ic"><ShareIc /></span> {/CriOS/.test(ua) ? t("בשורת הכתובת למעלה") : t("בתחתית המסך")}.</li>
                <li>{t("גוללים ובוחרים")} <b>{t("\"הוספה למסך הבית\"")}</b> <span className="invite__ic"><PlusIc /></span>.</li>
                <li>{t("לוחצים")} <b>{t("\"הוסף\"")}</b> {t("בפינה למעלה")}.</li>
              </ol> : <ol className="invite__steps">
                <li>{t("פותחים את תפריט הדפדפן")} <span className="invite__ic">⋮</span>.</li>
                <li>{t("בוחרים")} <b>{t("\"התקנת האפליקציה\"")}</b> {t("או")} <b>{t("\"הוספה למסך הבית\"")}</b>.</li>
                <li>{t("מאשרים")} <b>{t("\"התקנה\"")}</b>.</li>
              </ol>}
            <p className="small muted">{ios ? t("אחר כך פותחים את האפליקציה מהאייקון שבמסך הבית, כותבים שם, והחיבור לקבוצה נעשה לבד.") : t("מעכשיו פותחים את האפליקציה מהאייקון שבמסך הבית.")}</p>
            {!ios && <button className="btn btn--primary btn--block mt" onClick={() => setClosed(true)}>{t("הבנתי")}</button>}
          </> : <>
            <div className="field"><label>{t("השם שלכם בקבוצה")}</label><input className="input" value={name} maxLength={16} onChange={e => setName(e.target.value)} placeholder={t("למשל: דנה")} /></div>
            {!alone && <p className="mt"><b>{t("האפליקציה תותקן במסך הבית")}</b><br /><span className="small muted">{t("אייקון משלה, מסך מלא, והתראות על הודעות בצ'אט.")}</span></p>}
            <button className="btn btn--primary btn--block mt" disabled={busy} onClick={doJoin}>{alone ? t("הצטרפות לקבוצה") : t("להצטרף ולהתקין")}</button>
          </>}
      </div>
    </div>, document.body);
}
