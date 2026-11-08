import { Icon } from './Icons.jsx'

export const DIFF_HE = { 1: 'קל', 2: 'בינוני', 3: 'קשה', 4: 'קשה מאוד' }
export function Difficulty({ level = 2 }) { return <span className={`badge diff-${level}`}>{DIFF_HE[level] || 'בינוני'}</span> }

export function Stat({ value, label }) {
  return <div className="stat"><div className="stat__value">{value}</div><div className="stat__label">{label}</div></div>
}

export function Alert({ kind = 'info', icon = 'info', children }) {
  return <div className={`alert alert--${kind}`}><Icon name={icon} size={18} />{' '}<div>{children}</div></div>
}

export function Section({ title, icon, children, action }) {
  return (
    <section>
      <div className="section-title between row">
        <span className="row" style={{ gap: 8 }}>{icon && <Icon name={icon} />}{title}</span>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row between mb"><h3>{title}</h3><button className="iconbtn iconbtn--surface" onClick={onClose} aria-label="סגור">✕</button></div>
        {children}
      </div>
    </div>
  )
}

export function Acc({ title, children, open = false }) {
  return <details className="acc" open={open}><summary>{title}</summary><div className="acc__body">{children}</div></details>
}

export function Empty({ icon = '🥾', text }) { return <div className="empty"><div className="ico">{icon}</div><p>{text}</p></div> }
