import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { ready as i18nReady } from './i18n/index.js'
import { registerSW } from 'virtual:pwa-register'
import { persistStorage } from './lib/offline.js'

persistStorage() // keep maps, journal and photos from being evicted

// App-version auto update: check on launch, whenever the app returns to the foreground (home-screen
// installs), and hourly. A new version is applied immediately and the page reloads once.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() { updateSW(true) },
  onRegisteredSW(_url, reg) {
    if (!reg) return
    const check = () => { if (navigator.onLine) reg.update().catch(() => {}) }
    check() // register() alone does not look for a new version – ask explicitly on every launch
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
    window.addEventListener('online', check)
    setInterval(check, 60 * 60 * 1000)
  },
})
window.addEventListener('vite:preloadError', () => location.reload()) // stale chunk after an update

const mount = () => createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
i18nReady().then(mount, mount) // English needs the data dictionary first; never block on failure
