import { Component } from 'react'

// Shows the error instead of a white screen (React 19 unmounts the whole tree on an uncaught render error).
export default class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { try { window.__shvilErrors?.push(`${error?.message}\n${(info?.componentStack || '').split('\n').slice(0, 4).join('\n')}`) } catch { /* ignore */ } }
  reset = (wipe) => {
    try { if (wipe) localStorage.clear() } catch { /* ignore */ }
    location.reload()
  }
  render() {
    if (!this.state.error) return this.props.children
    const e = this.state.error
    return (
      <div style={{ padding: 20, fontFamily: 'Heebo, system-ui, sans-serif', direction: 'rtl', color: '#111', background: '#fff', minHeight: '100vh' }}>
        <h2 style={{ marginTop: 0 }}>משהו השתבש · Something went wrong</h2>
        <p>האפליקציה נתקלה בשגיאה. אפשר לנסות שוב, או לאפס את נתוני האפליקציה (היומן והתמונות נשמרים).</p>
        <pre dir="ltr" style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#f3f4f6', padding: 10, borderRadius: 8, maxHeight: '40vh', overflow: 'auto' }}>{String(e?.message || e)}{'\n'}{String(e?.stack || '').split('\n').slice(0, 6).join('\n')}</pre>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => this.reset(false)} style={{ padding: '10px 18px', borderRadius: 999, border: 0, background: '#f2994a', fontWeight: 700 }}>נסו שוב · Try again</button>
          <button onClick={() => this.reset(true)} style={{ padding: '10px 18px', borderRadius: 999, border: '1px solid #999', background: '#fff' }}>איפוס נתונים · Reset data</button>
        </div>
      </div>
    )
  }
}
