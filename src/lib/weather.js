// Open-Meteo: free, no key. https://open-meteo.com/
const WMO = {
  0: ['בהיר', '☀️'], 1: ['בהיר ברובו', '🌤️'], 2: ['מעונן חלקית', '⛅'], 3: ['מעונן', '☁️'],
  45: ['ערפל', '🌫️'], 48: ['ערפל קפוא', '🌫️'], 51: ['טפטוף', '🌦️'], 53: ['טפטוף', '🌦️'], 55: ['טפטוף', '🌧️'],
  61: ['גשם קל', '🌧️'], 63: ['גשם', '🌧️'], 65: ['גשם חזק', '🌧️'], 66: ['גשם קפוא', '🌧️'], 67: ['גשם קפוא', '🌧️'],
  71: ['שלג קל', '🌨️'], 73: ['שלג', '🌨️'], 75: ['שלג כבד', '❄️'], 77: ['פתיתי שלג', '🌨️'],
  80: ['ממטרים', '🌦️'], 81: ['ממטרים', '🌧️'], 82: ['ממטרים עזים', '⛈️'], 95: ['סופת רעמים', '⛈️'], 96: ['סופת ברד', '⛈️'], 99: ['סופת ברד', '⛈️'],
}
export function wmoText(code) { return WMO[code] || ['–', '🌡️'] }

export async function fetchForecast(lat, lon, days = 7) {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.search = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: 'Asia/Jerusalem', forecast_days: String(days),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,uv_index',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max,sunrise,sunset',
  }).toString()
  const res = await fetch(url)
  if (!res.ok) throw new Error('weather ' + res.status)
  return res.json()
}

/** Simple heat-stress estimate for hikers (°C apparent + humidity/uv) */
export function heatRisk(apparentC, uv = 0) {
  if (apparentC == null) return null
  if (apparentC >= 36 || uv >= 10) return { level: 'danger', label: 'סכנת מכת חום – לא לטייל בשעות היום', cls: 'alert--danger' }
  if (apparentC >= 31 || uv >= 8) return { level: 'high', label: 'חום גבוה – לצאת מוקדם, לשתות הרבה, להפסיק בצהריים', cls: 'alert--warn' }
  if (apparentC >= 26) return { level: 'moderate', label: 'חם – כובע, מים ו-הצללה', cls: 'alert--info' }
  return { level: 'ok', label: 'תנאים נוחים להליכה', cls: 'alert--ok' }
}
