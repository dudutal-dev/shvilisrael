import { useEffect, useState } from 'react'
import { fetchForecast } from '../lib/weather.js'
/** Live forecast for a point; refreshes every `refreshMin` minutes while mounted. */
export function useWeather(lat, lon, { days = 7, hourly = false, refreshMin = 15 } = {}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (lat == null || lon == null) return
    let alive = true
    const load = () => {
      setLoading(true)
      fetchForecast(lat, lon, days, { hourly }).then((d) => { if (alive) { setData(d); setError(null) } }).catch((e) => alive && setError(e.message)).finally(() => alive && setLoading(false))
    }
    load()
    const id = setInterval(load, refreshMin * 60000)
    const onVis = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVis)
    return () => { alive = false; clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [lat?.toFixed(2), lon?.toFixed(2), days, hourly, refreshMin]) // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error, loading }
}
