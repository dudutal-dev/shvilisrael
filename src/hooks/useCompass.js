import { useCallback, useEffect, useRef, useState } from 'react'
/**
 * Device compass heading (0–360, true-north where available).
 * iOS needs a user gesture to request permission → call `request()` from a click handler.
 */
export function useCompass() {
  const [heading, setHeading] = useState(null)
  const [status, setStatus] = useState('idle') // idle | granted | denied | unsupported
  const smooth = useRef(null)

  const onEvent = useCallback((e) => {
    let h = null
    if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading // iOS: already true north
    else if (typeof e.alpha === 'number') {
      h = 360 - e.alpha // Android: alpha is counter-clockwise from north
      // compensate screen orientation
      const so = (screen.orientation && screen.orientation.angle) || window.orientation || 0
      h = (h + so + 360) % 360
    }
    if (h == null || Number.isNaN(h)) return
    // low-pass filter on the circle to avoid jitter
    if (smooth.current == null) smooth.current = h
    else {
      let diff = h - smooth.current
      if (diff > 180) diff -= 360; if (diff < -180) diff += 360
      smooth.current = (smooth.current + diff * 0.25 + 360) % 360
    }
    setHeading(smooth.current)
  }, [])

  const request = useCallback(async () => {
    if (typeof DeviceOrientationEvent === 'undefined') { setStatus('unsupported'); return }
    try {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const r = await DeviceOrientationEvent.requestPermission()
        if (r !== 'granted') { setStatus('denied'); return }
      }
      setStatus('granted')
    } catch { setStatus('denied') }
  }, [])

  useEffect(() => {
    if (status !== 'granted') return
    const evName = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation'
    window.addEventListener(evName, onEvent, true)
    return () => window.removeEventListener(evName, onEvent, true)
  }, [status, onEvent])

  // auto-start where no permission prompt is required (Android / desktop)
  useEffect(() => {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function') setStatus('granted')
  }, [])

  return { heading, status, request }
}
