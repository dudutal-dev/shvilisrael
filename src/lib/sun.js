import { locale } from '../i18n/index.js'
// Sunrise / sunset (NOAA algorithm, accuracy ~1–2 min). Returns Date objects in local time.
const rad = Math.PI / 180
function toJulian(date) { return date.valueOf() / 86400000 - 0.5 + 2440588 }
function fromJulian(j) { return new Date((j + 0.5 - 2440588) * 86400000) }
const J2000 = 2451545
function solarMeanAnomaly(d) { return rad * (357.5291 + 0.98560028 * d) }
function eclipticLongitude(M) {
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M))
  const P = rad * 102.9372
  return M + C + P + Math.PI
}
function declination(l) { return Math.asin(Math.sin(l) * Math.sin(rad * 23.4397)) }
function julianCycle(d, lw) { return Math.round(d - 0.0009 - lw / (2 * Math.PI)) }
function approxTransit(Ht, lw, n) { return 0.0009 + (Ht + lw) / (2 * Math.PI) + n }
function solarTransitJ(ds, M, L) { return J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L) }
function hourAngle(h, phi, d) { return Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(d)) / (Math.cos(phi) * Math.cos(d))) }

export function sunTimes(date, lat, lon) {
  const lw = rad * -lon, phi = rad * lat
  const d = toJulian(date) - J2000
  const n = julianCycle(d, lw)
  const ds = approxTransit(0, lw, n)
  const M = solarMeanAnomaly(ds)
  const L = eclipticLongitude(M)
  const dec = declination(L)
  const Jnoon = solarTransitJ(ds, M, L)
  const h0 = rad * -0.833
  const w = hourAngle(h0, phi, dec)
  if (Number.isNaN(w)) return { sunrise: null, sunset: null, dayLength: 0 }
  const Jset = solarTransitJ(approxTransit(w, lw, n), M, L)
  const Jrise = Jnoon - (Jset - Jnoon)
  const sunrise = fromJulian(Jrise), sunset = fromJulian(Jset)
  return { sunrise, sunset, dayLength: (sunset - sunrise) / 3600000 }
}

export function fmtTime(d) {
  if (!d) return '–'
  return d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
}
