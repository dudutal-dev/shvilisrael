import { Icon } from './Icons.jsx';
import { CIcon } from './ColorIcons.jsx';
import { useOnline } from '../hooks/useOnline.js';
import { t, useLang } from '../i18n/index.js'
const TABS = [{
  id: 'home',
  label: 'בית',
  icon: 'home'
}, {
  id: 'segments',
  label: 'מקטעים',
  icon: 'segments'
}, {
  id: 'map',
  label: 'מפה',
  icon: 'map'
}, {
  id: 'plan',
  label: 'תכנון',
  icon: 'plan'
}, {
  id: 'nav',
  label: 'ניווט',
  icon: 'compass'
}, {
  id: 'journal',
  label: 'יומן',
  icon: 'journal'
}, {
  id: 'guide',
  label: 'מדריך',
  icon: 'guide'
}];
export function Header({
  title,
  onBack,
  theme,
  setTheme,
  navigate
}) {
  const online = useOnline();
  const [lang, setLang] = useLang();
  return <header className="header">
      <div className="header__title">
        {onBack ? <button className="iconbtn" onClick={onBack} aria-label={t("חזרה")}><Icon name="back" /></button> : <span className="blaze"><span className="w" /><span className="b" /><span className="o" /></span>}
        <span>{title}</span>
        {!online && <span className="chip" style={{
        background: '#f26b1d',
        color: '#fff'
      }}>{t("לא מקוון")}</span>}
      </div>
      <div className="header__actions">
        <button className="iconbtn iconbtn--lang" onClick={() => setLang(lang === 'en' ? 'he' : 'en')} aria-label="Language" title={lang === 'en' ? 'עברית' : 'English'}>{lang === 'en' ? 'עב' : 'EN'}</button>
        <button className="iconbtn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={t("מצב תצוגה")}><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button>
        <button className="iconbtn" onClick={() => navigate('settings')} aria-label={t("הגדרות")}><Icon name="settings" /></button>
      </div>
    </header>;
}
export function BottomNav({
  active,
  navigate
}) {
  return <nav className="nav">
      {TABS.map(tab => <button key={tab.id} className={`nav__btn ${active === tab.id ? 'active' : ''}`} onClick={() => navigate(tab.id)}>
          <span className="nav__ico"><CIcon name={tab.icon} size={24} /></span>
          <span>{t(tab.label)}</span>
        </button>)}
    </nav>;
}
export const TAB_IDS = TABS.map(tab => tab.id);