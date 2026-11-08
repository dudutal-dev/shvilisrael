import { t } from '../i18n/index.js';
// Open-Meteo: free, no key. https://open-meteo.com/
const WMO = {
  0: ['בהיר', '☀️'],
  1: ['בהיר ברובו', '🌤️'],
  2: ['מעונן חלקית', '⛅'],
  3: ['מעונן', '☁️'],
  45: ['ערפל', '🌫️'],
  48: ['ערפל קפוא', '🌫️'],
  51: ['טפטוף', '🌦️'],
  53: ['טפטוף', '🌦️'],
  55: ['טפטוף', '🌧️'],
  61: ['גשם קל', '🌧️'],
  63: ['גשם', '🌧️'],
  65: ['גשם חזק', '🌧️'],
  66: ['גשם קפוא', '🌧️'],
  67: ['גשם קפוא', '🌧️'],
  71: ['שלג קל', '🌨️'],
  73: ['שלג', '🌨️'],
  75: ['שלג כבד', '❄️'],
  77: ['פתיתי שלג', '🌨️'],
  80: ['ממטרים', '🌦️'],
  81: ['ממטרים', '🌧️'],
  82: ['ממטרים עזים', '⛈️'],
  95: ['סופת רעמים', '⛈️'],
  96: ['סופת ברד', '⛈️'],
  99: ['סופת ברד', '⛈️']
};
export function wmoText(code) {
  const w = WMO[code] || ['–', '🌡️'];
  return [t(w[0]), w[1]];
}
const CACHE_MIN = 20;
const key = (lat, lon, days, hourly) => `shvil:wx:${lat.toFixed(2)},${lon.toFixed(2)},${days},${hourly ? 1 : 0}`;

/** Forecast with a 20-minute localStorage cache (and stale fallback when offline). */
export async function fetchForecast(lat, lon, days = 7, {
  hourly = false
} = {}) {
  const k = key(lat, lon, days, hourly);
  let cached = null;
  try {
    cached = JSON.parse(localStorage.getItem(k));
  } catch {/* ignore */}
  if (cached && Date.now() - cached.t < CACHE_MIN * 60000) return {
    ...cached.d,
    _cachedAt: cached.t
  };
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  const params = {
    latitude: lat,
    longitude: lon,
    timezone: 'Asia/Jerusalem',
    forecast_days: String(days),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,weather_code,uv_index,precipitation,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset'
  };
  if (hourly) params.hourly = 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,uv_index,weather_code,is_day';
  url.search = new URLSearchParams(params).toString();
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('weather ' + res.status);
    const d = await res.json();
    try {
      localStorage.setItem(k, JSON.stringify({
        t: Date.now(),
        d
      }));
    } catch {/* quota */}
    return {
      ...d,
      _cachedAt: Date.now()
    };
  } catch (e) {
    if (cached) return {
      ...cached.d,
      _cachedAt: cached.t,
      _stale: true
    };
    throw e;
  }
}

/** Fetch several points at once (Open-Meteo accepts comma-separated coordinates). Returns array aligned with points. */
export async function fetchForecastMany(points, days = 7) {
  if (!points.length) return [];
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: points.map(p => p.lat.toFixed(3)).join(','),
    longitude: points.map(p => p.lon.toFixed(3)).join(','),
    timezone: 'Asia/Jerusalem',
    forecast_days: String(days),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max'
  }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error('weather ' + res.status);
  const d = await res.json();
  return Array.isArray(d) ? d : [d];
}

/** Simple heat-stress estimate for hikers (°C apparent + uv) */
export function heatRisk(apparentC, uv = 0) {
  if (apparentC == null) return null;
  if (apparentC >= 36 || uv >= 10) return {
    level: 'danger',
    label: t("סכנת מכת חום – לא לטייל בשעות היום"),
    cls: 'alert--danger'
  };
  if (apparentC >= 31 || uv >= 8) return {
    level: 'high',
    label: t("חום גבוה – לצאת מוקדם, לשתות הרבה, להפסיק בצהריים"),
    cls: 'alert--warn'
  };
  if (apparentC >= 26) return {
    level: 'moderate',
    label: t("חם – כובע, מים והצללה"),
    cls: 'alert--info'
  };
  return {
    level: 'ok',
    label: t("תנאים נוחים להליכה"),
    cls: 'alert--ok'
  };
}

/** Day-level hiking verdict from a daily forecast row. group = north|center|negev */
export function dayVerdict({
  tmax,
  tapp,
  rainMm,
  rainProb,
  windMax,
  gust,
  code
}, group = 'center') {
  const flags = [];
  const t = tapp ?? tmax;
  if (t >= 36) flags.push({
    k: 'heat',
    s: 3,
    t: t("חום קיצוני – לא לצעוד")
  });else if (t >= 31) flags.push({
    k: 'heat',
    s: 2,
    t: t("חום כבד – יציאה עם שחר")
  });else if (t >= 27) flags.push({
    k: 'heat',
    s: 1,
    t: t("חם")
  });
  if (group === 'negev' && (rainMm >= 3 || rainProb >= 50)) flags.push({
    k: 'flood',
    s: 3,
    t: t("סכנת שיטפונות בנחלי המדבר")
  });else if (rainMm >= 10 || rainProb >= 70) flags.push({
    k: 'rain',
    s: 2,
    t: t("גשם משמעותי – בוץ ונחלים זורמים")
  });else if (rainMm >= 1 || rainProb >= 40) flags.push({
    k: 'rain',
    s: 1,
    t: t("סיכוי לגשם")
  });
  if ((gust || windMax) >= 60) flags.push({
    k: 'wind',
    s: 2,
    t: t("רוחות חזקות – זהירות על רכסים")
  });else if (windMax >= 40) flags.push({
    k: 'wind',
    s: 1,
    t: t("רוח ערה")
  });
  if ([95, 96, 99].includes(code)) flags.push({
    k: 'storm',
    s: 3,
    t: t("סופות רעמים")
  });
  if ([71, 73, 75, 77].includes(code)) flags.push({
    k: 'snow',
    s: 2,
    t: t("שלג")
  });
  const s = Math.max(0, ...flags.map(f => f.s));
  return {
    score: s,
    flags,
    label: s >= 3 ? t("לא לצאת") : s === 2 ? t("בזהירות") : s === 1 ? t("סביר") : t("מצוין"),
    cls: s >= 3 ? 'wx-bad' : s === 2 ? 'wx-warn' : s === 1 ? 'wx-ok' : 'wx-good'
  };
}
export const STATIONS = [{
  key: 'kiryat_shmona',
  name: "קריית שמונה",
  lat: 33.207,
  lon: 35.57,
  group: 'north'
}, {
  key: 'tiberias',
  name: "טבריה",
  lat: 32.79,
  lon: 35.53,
  group: 'north'
}, {
  key: 'haifa',
  name: "חיפה (כרמל)",
  lat: 32.76,
  lon: 35.02,
  group: 'north'
}, {
  key: 'tel_aviv',
  name: "תל אביב",
  lat: 32.08,
  lon: 34.78,
  group: 'center'
}, {
  key: 'jerusalem',
  name: "ירושלים",
  lat: 31.78,
  lon: 35.2,
  group: 'center'
}, {
  key: 'arad',
  name: "ערד",
  lat: 31.26,
  lon: 35.21,
  group: 'negev'
}, {
  key: 'sde_boker',
  name: "שדה בוקר",
  lat: 30.87,
  lon: 34.79,
  group: 'negev'
}, {
  key: 'mitzpe_ramon',
  name: "מצפה רמון",
  lat: 30.61,
  lon: 34.8,
  group: 'negev'
}, {
  key: 'eilat',
  name: "אילת",
  lat: 29.55,
  lon: 34.95,
  group: 'negev'
}];