import { Icon } from './Icons.jsx'
import { CIcon } from './ColorIcons.jsx'
import { useOnline } from '../hooks/useOnline.js'

const TABS = [
  { id: 'home', label: 'בית', icon: 'home' },
  { id: 'segments', label: 'מקטעים', icon: 'segments' },
  { id: 'map', label: 'מפה', icon: 'map' },
  { id: 'plan', label: 'תכנון', icon: 'plan' },
  { id: 'nav', label: 'ניווט', icon: 'compass' },
  { id: 'guide', label: 'מדריך', icon: 'guide' },
]

export function Header({ title, onBack, theme, setTheme, navigate }) {
  const online = useOnline()
  return (
    <header className="header">
      <div className="header__title">
        {onBack ? (
          <button className="iconbtn" onClick={onBack} aria-label="חזרה"><Icon name="back" /></button>
        ) : (
          <span className="blaze"><span className="w" /><span className="b" /><span className="o" /></span>
        )}
        <span>{title}</span>
        {!online && <span className="chip" style={{ background: '#f26b1d', color: '#fff' }}>לא מקוון</span>}
      </div>
      <div className="header__actions">
        <button className="iconbtn" onClick={() => navigate('journal')} aria-label="יומן מסע"><Icon name="journal" /></button>
        <button className="iconbtn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="מצב תצוגה"><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button>
        <button className="iconbtn" onClick={() => navigate('settings')} aria-label="הגדרות"><Icon name="settings" /></button>
      </div>
    </header>
  )
}

export function BottomNav({ active, navigate }) {
  return (
    <nav className="nav">
      {TABS.map((t) => (
        <button key={t.id} className={`nav__btn ${active === t.id ? 'active' : ''}`} onClick={() => navigate(t.id)}>
          <span className="nav__ico"><CIcon name={t.icon} size={26} /></span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
export const TAB_IDS = TABS.map((t) => t.id)
