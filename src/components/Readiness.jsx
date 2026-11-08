import { useState } from 'react';
import { Acc } from './UI.jsx';
import { Icon } from './Icons.jsx';
import { PREP_STEPS } from '../lib/readiness.js';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { t } from '../i18n/index.js'
const LIGHT = {
  ok: ['🟢', 'תקין'],
  warn: ['🟡', 'שימו לב'],
  bad: ['🔴', 'לא מומלץ'],
  info: ['🔵', 'מידע']
};
export function Readiness({
  result,
  navigate
}) {
  const [prep, setPrep] = useLocalStorage('planPrep', {});
  const [open, setOpen] = useState(null);
  if (!result) return null;
  const {
    checks,
    overall
  } = result;
  const done = PREP_STEPS.filter(s => prep[s.key]).length;
  return <div className="card readiness">
      <div className={`readiness__head readiness--${overall}`}>
        <span className="readiness__light">{LIGHT[overall][0]}</span>
        <div>
          <div className="bold" style={{
          fontSize: 17
        }}>{overall === 'ok' ? t("התוכנית נראית טוב – אפשר לצאת") : overall === 'warn' ? t("התוכנית אפשרית, עם דגשים לטיפול") : t("יש בעיות מהותיות בתוכנית")}</div>
          <div className="tiny" style={{
          opacity: 0.9
        }}>{checks.filter(c => c.level === 'bad').length} {t("אדומים ·")} {checks.filter(c => c.level === 'warn').length} {t("צהובים ·")} {checks.filter(c => c.level === 'ok').length} {t("ירוקים")}</div>
        </div>
      </div>
      <div className="readiness__list">
        {checks.map((c, i) => <div key={c.key} className={`rc rc--${c.level} ${open === c.key ? 'is-open' : ''}`} onClick={() => setOpen(open === c.key ? null : c.key)}>
            <div className="rc__num">{i + 1}</div>
            <div className="rc__light">{LIGHT[c.level][0]}</div>
            <div className="rc__body">
              <div className="rc__title">{c.title} <span className="tiny muted">· {t(LIGHT[c.level][1])}</span></div>
              <div className="small">{c.summary}</div>
              {open === c.key && <div className="rc__details">
                  {c.details?.length > 0 && <ul>{c.details.map((d, j) => <li key={j}>{d}</li>)}</ul>}
                  {c.link && <button className="btn btn--sm mt" onClick={e => {
              e.stopPropagation();
              navigate(c.link);
            }}>{t("לפרטים ולטיפול ←")}</button>}
                </div>}
            </div>
            <div className="rc__chev">{open === c.key ? '⌃' : '⌄'}</div>
          </div>)}
      </div>
      <Acc title={<span>{t("📋 צ'ק-ליסט הכנות (")}{done}/{PREP_STEPS.length})</span>}>
        {PREP_STEPS.map(s => <label key={s.key} className={`check ${prep[s.key] ? 'on' : ''}`}>
            <input type="checkbox" checked={!!prep[s.key]} onChange={() => setPrep({
          ...prep,
          [s.key]: !prep[s.key]
        })} />
            <span style={{
          flex: 1
        }}>{t(s.title)}</span>
            <button className="linkbtn tiny" onClick={e => {
          e.preventDefault();
          navigate(s.link);
        }}>←</button>
          </label>)}
      </Acc>
      <p className="tiny muted mt">{t("הרמזור משקלל עונה, תחזית חיה (עד 16 יום), שיטפונות, חום, מים, שטחי אש, לינה, שבת/חגים ושעות אור. הוא עוזר להחליט – לא מחליף שיקול דעת ואזהרות רשמיות.")}</p>
    </div>;
}