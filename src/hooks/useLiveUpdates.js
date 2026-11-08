import { useCallback, useEffect, useState } from 'react'
import { getUpdates, refreshUpdates, unseen } from '../lib/liveUpdates.js'
import { sortUpdates } from '../lib/updates.js'
/** Route updates with auto-refresh on launch and whenever the app returns to the foreground. */
export function useLiveUpdates() {
  const [data, setData] = useState(getUpdates)
  const [state, setState] = useState('idle') // idle | loading | ok | error
  const [lastCheck, setLastCheck] = useState(null)
  const refresh = useCallback(async () => {
    if (!navigator.onLine) return
    setState('loading')
    try { setData(await refreshUpdates()); setState('ok') } catch { setState('error') }
    setLastCheck(Date.now())
  }, [])
  useEffect(() => {
    refresh()
    const onVis = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('online', refresh)
    const id = setInterval(refresh, 6 * 3600 * 1000)
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('online', refresh); clearInterval(id) }
  }, [refresh])
  const items = sortUpdates(data.items || [])
  return { items, fetched: data.fetched, url: data.url, newItems: unseen(items), state, lastCheck, refresh }
}
