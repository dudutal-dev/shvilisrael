import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

// App-version auto update: check on launch, whenever the app returns to the foreground (home-screen
// installs), and hourly. A new version is applied immediately and the page reloads once.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() { updateSW(true) },
  onRegisteredSW(_url, reg) {
    if (!reg) return
    const check = () => { if (navigator.onLine) reg.update().catch(() => {}) }
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
    window.addEventListener('online', check)
    setInterval(check, 60 * 60 * 1000)
  },
})
window.addEventListener('vite:preloadError', () => location.reload()) // stale chunk after an update

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
