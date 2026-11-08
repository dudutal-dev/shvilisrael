import { createContext, useContext, useMemo } from 'react'
import { useLocalStorage } from './hooks/useLocalStorage.js'
import segData from './data/segments.json'
import { DEFAULT_PLAN, buildItinerary } from './lib/planner.js'

const Ctx = createContext(null)
export function AppProvider({ children }) {
  const segments = segData.segments
  const [plan, setPlan] = useLocalStorage('plan', DEFAULT_PLAN)
  const [done, setDone] = useLocalStorage('done', []) // segment ids completed
  const [journal, setJournal] = useLocalStorage('journal', []) // {id, date, segId, text, km, mood, pos}
  const [gear, setGear] = useLocalStorage('gear', {})
  const [notes, setNotes] = useLocalStorage('segNotes', {})
  const [prefs, setPrefs] = useLocalStorage('prefs', { base: 'ihm', units: 'metric' })
  const [angels, setAngels] = useLocalStorage('myAngels', []) // {id, name, settlement, phone, segId, notes, status}
  const itinerary = useMemo(() => (plan.startDate ? buildItinerary(segments, plan) : null), [segments, plan])
  const totalKm = useMemo(() => segments.reduce((a, s) => a + (s.distance_km || 0), 0), [segments])
  const doneKm = useMemo(() => segments.filter((s) => done.includes(s.id)).reduce((a, s) => a + s.distance_km, 0), [segments, done])
  const toggleDone = (id) => setDone((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]))
  const value = { segments, meta: segData.meta || {}, plan, setPlan, itinerary, done, toggleDone, journal, setJournal, gear, setGear, notes, setNotes, prefs, setPrefs, angels, setAngels, totalKm, doneKm }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
export const useApp = () => useContext(Ctx)
