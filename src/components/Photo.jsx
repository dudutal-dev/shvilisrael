import { useState } from 'react'
import photos from '../data/photos.json'

const ALIASES = { hero: 'makhtesh_ramon', meron: 'mount_meron', ramon: 'makhtesh_ramon', negev_hiker: 'hiker_negev', }
export function getPhoto(key) { if (!key) return null; return photos.find((p) => p.key === key) || photos.find((p) => p.key === ALIASES[key]) || null }

export function Photo({ photoKey, src, alt, className = '', credit = true, style }) {
  const p = photoKey ? getPhoto(photoKey) : null
  const candidates = src ? [src] : [p?.image_url, p?.thumb_url_direct, p?.original_url].filter(Boolean)
  const [idx, setIdx] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const url = candidates[idx]
  if (!url) return <div className={`photo photo--placeholder ${className}`} style={style}>🥾</div>
  return (
    <div className={`photo ${className}`} style={style}>
      <img src={url} alt={alt || p?.place_he || ''} loading="lazy" onError={() => setIdx((i) => i + 1)} onLoad={() => setLoaded(true)} style={{ opacity: loaded ? 1 : 0 }} referrerPolicy="no-referrer" />
      {credit && p && loaded && <div className="photo__credit">{p.author ? `© ${p.author}` : ''} {p.license ? `· ${p.license}` : ''} · Wikimedia Commons</div>}
    </div>
  )
}
