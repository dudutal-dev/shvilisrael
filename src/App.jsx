import { useEffect, lazy, Suspense } from 'react'
import { useRouter } from './hooks/useRouter.js'
import { useLocalStorage } from './hooks/useLocalStorage.js'
import { Header, BottomNav, TAB_IDS } from './components/Shell.jsx'
import { ToastProvider } from './hooks/useToast.jsx'
import { AppProvider } from './context.jsx'
import Home from './pages/Home.jsx'
import Segments from './pages/Segments.jsx'
import SegmentDetail from './pages/SegmentDetail.jsx'
import Planner from './pages/Planner.jsx'
import Navigate from './pages/Navigate.jsx'
import Journal from './pages/Journal.jsx'
import Settings from './pages/Settings.jsx'
const MapPage = lazy(() => import('./pages/MapPage.jsx'))
const Guide = lazy(() => import('./pages/Guide.jsx'))
const Angels = lazy(() => import('./pages/Angels.jsx'))
const Certificate = lazy(() => import('./pages/Certificate.jsx'))
const Weather = lazy(() => import('./pages/Weather.jsx'))
const Story = lazy(() => import('./pages/Story.jsx'))

const TITLES = { home: 'שביל ישראל', segments: 'מקטעי השביל', map: 'מפה', plan: 'תכנון המסע', nav: 'ניווט', guide: 'המדריך', journal: 'יומן המסע', settings: 'הגדרות', certificate: 'תעודה', weather: 'מזג אוויר חי' }

export default function App() {
  const { route, navigate, back } = useRouter()
  const [theme, setTheme] = useLocalStorage('theme', 'auto')
  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
  }, [theme])
  const [tab, sub] = route.path
  const isSub = !TAB_IDS.includes(tab) || (tab === 'segments' && sub)
  let page
  switch (tab) {
    case 'segments': page = sub ? (route.path[2] === 'story' ? <Story id={sub} navigate={navigate} /> : <SegmentDetail id={sub} navigate={navigate} />) : <Segments navigate={navigate} />; break
    case 'map': page = <MapPage query={route.query} navigate={navigate} />; break
    case 'plan': page = <Planner navigate={navigate} />; break
    case 'nav': page = <Navigate navigate={navigate} />; break
    case 'guide': page = sub === 'angels' ? <Angels navigate={navigate} /> : <Guide section={sub} navigate={navigate} query={route.query} />; break
    case 'journal': page = <Journal navigate={navigate} />; break
    case 'certificate': page = <Certificate />; break
    case 'weather': page = <Weather navigate={navigate} query={route.query} />; break
    case 'settings': page = <Settings theme={theme} setTheme={setTheme} />; break
    default: page = <Home navigate={navigate} />
  }
  const effectiveTheme = theme === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme
  return (
    <AppProvider>
      <ToastProvider>
        <div className="app">
          <Header title={TITLES[tab] || 'שביל ישראל'} onBack={isSub ? back : null} theme={effectiveTheme} setTheme={setTheme} navigate={navigate} />
          <main className="content" id="content"><Suspense fallback={<div className="page center muted">טוען…</div>}>{page}</Suspense></main>
          <BottomNav active={TAB_IDS.includes(tab) ? tab : ''} navigate={navigate} />
        </div>
      </ToastProvider>
    </AppProvider>
  )
}
