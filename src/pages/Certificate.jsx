import { useApp } from '../context.jsx';
import { fmtDateLong } from '../lib/dates.js';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { t } from '../i18n/index.js'
export default function Certificate() {
  const {
    done,
    doneKm,
    totalKm,
    segments,
    journal,
    plan
  } = useApp();
  const [name, setName] = useLocalStorage('hikerName', '');
  const pct = totalKm ? Math.round(doneKm / totalKm * 100) : 0;
  const first = [...journal].sort((a, b) => a.date.localeCompare(b.date))[0];
  const last = [...journal].sort((a, b) => b.date.localeCompare(a.date))[0];
  return <div className="page stack">
      <div className="field no-print"><label>{t("שם המטייל/ת")}</label><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder={t("השם שיופיע בתעודה")} /></div>
      <div className="cert">
        <div className="cert__blaze"><span className="w" /><span className="b" /><span className="o" /></div>
        <div className="cert__kicker">{t("שביל ישראל · Israel National Trail")}</div>
        <h1>{t("תעודת הוקרה")}</h1>
        <p className="cert__text">{t("מוענקת ל")}</p>
        <div className="cert__name">{name || t("שם המטייל/ת")}</div>
        <p className="cert__text">{t("על השלמת")} {pct >= 100 ? t("מסע שלם") : t("{0}% מהמסע", pct)} {t("בשביל ישראל")}<br />{done.length} {t("מקטעים ·")} {Math.round(doneKm).toLocaleString()} {t("ק\"מ ·")} {plan.direction === 'nobo' ? t("מאילת ועד החרמון") : t("מהחרמון ועד אילת")}</p>
        {first && last && <p className="cert__dates">{fmtDateLong(first.date)} – {fmtDateLong(last.date)}</p>}
        <div className="cert__foot">
          <div>{segments.length} {t("מקטעים בשביל ·")} {Math.round(totalKm).toLocaleString()} {t("ק\"מ")}</div>
          <div>{t("נוצר באפליקציית \"שביל ישראל – מתכנן המסע\"")}</div>
        </div>
      </div>
      <div className="row no-print"><button className="btn btn--primary" onClick={() => window.print()}>{t("🖨️ הדפסה / שמירה כ-PDF")}</button></div>
      <p className="tiny muted no-print">{t("תעודה אישית מהאפליקציה. תעודת סיום רשמית – יש לברר מול החברה להגנת הטבע.")}</p>
    </div>;
}