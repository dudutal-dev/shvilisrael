import { wmoText, heatRisk, dayVerdict } from '../lib/weather.js';
import { fmtTime } from '../lib/sun.js';
import { t, locale } from '../i18n/index.js'
export function WeatherNow({
  data,
  place,
  compact = false
}) {
  if (!data?.current) return null;
  const c = data.current;
  const risk = heatRisk(c.apparent_temperature, c.uv_index);
  const age = data._cachedAt ? Math.round((Date.now() - data._cachedAt) / 60000) : 0;
  return <div className={`wx-now ${compact ? 'wx-now--compact' : ''}`}>
      <div className="wx-now__main">
        <span className="wx-now__icon">{wmoText(c.weather_code)[1]}</span>
        <span className="wx-now__temp">{Math.round(c.temperature_2m)}°</span>
        <div className="wx-now__meta">
          <div className="bold">{wmoText(c.weather_code)[0]}{place ? ` · ${place}` : ''}</div>
          <div className="tiny muted">{t("מורגש")} {Math.round(c.apparent_temperature)}{t("° · רוח")} {Math.round(c.wind_speed_10m)}{c.wind_gusts_10m ? t("(משבים {0})", Math.round(c.wind_gusts_10m)) : ''} {t("קמ\"ש · UV")} {c.uv_index} {t("· לחות")} {c.relative_humidity_2m}%</div>
        </div>
      </div>
      {!compact && risk && <div className={`alert ${risk.cls} small mt`}>{risk.label}</div>}
      {!compact && <div className="tiny muted mt">{data._stale ? t("⚠ נתונים שמורים (אין חיבור)") : t("עודכן לפני {0} דק׳", age)} · Open-Meteo</div>}
    </div>;
}

/** Hourly strip for the next N hours: temp line + rain bars (inline SVG) */
export function WeatherHourly({
  data,
  hours = 24
}) {
  const h = data?.hourly;
  if (!h?.time) return null;
  const now = Date.now();
  let start = h.time.findIndex(t => new Date(t).getTime() >= now - 3600000);
  if (start < 0) start = 0;
  const idx = Array.from({
    length: Math.min(hours, h.time.length - start)
  }, (_, i) => start + i);
  const temps = idx.map(i => h.temperature_2m[i]),
    rains = idx.map(i => h.precipitation_probability?.[i] || 0);
  const tMin = Math.min(...temps) - 2,
    tMax = Math.max(...temps) + 2;
  const W = 720,
    H = 120,
    pad = 14,
    stepX = (W - pad * 2) / (idx.length - 1 || 1);
  const y = t => H - pad - (t - tMin) / (tMax - tMin) * (H - pad * 2 - 20);
  const path = temps.map((t, i) => `${i ? 'L' : 'M'}${pad + i * stepX},${y(t)}`).join(' ');
  return <div className="wx-hourly">
      <svg viewBox={`0 0 ${W} ${H + 30}`} preserveAspectRatio="none" style={{
      width: '100%',
      height: 150,
      direction: 'ltr'
    }}>
        {rains.map((r, i) => r > 0 && <rect key={i} x={pad + i * stepX - stepX * 0.3} y={H - pad - r / 100 * 60} width={stepX * 0.6} height={r / 100 * 60} fill="var(--primary)" opacity="0.35" rx="2" />)}
        <path d={path} fill="none" stroke="var(--orange)" strokeWidth="3" strokeLinejoin="round" />
        {temps.map((t, i) => i % 3 === 0 && <g key={i}><circle cx={pad + i * stepX} cy={y(t)} r="3.5" fill="var(--orange)" /><text x={pad + i * stepX} y={y(t) - 9} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text)">{Math.round(t)}°</text></g>)}
        {idx.map((hi, i) => i % 3 === 0 && <g key={hi}><text x={pad + i * stepX} y={H + 12} textAnchor="middle" fontSize="11" fill="var(--muted)">{new Date(h.time[hi]).getHours()}:00</text><text x={pad + i * stepX} y={H + 27} textAnchor="middle" fontSize="13">{wmoText(h.weather_code?.[hi])[1]}</text></g>)}
      </svg>
      <div className="row tiny muted" style={{
      gap: 12
    }}><span>{t("— טמפרטורה")}</span><span style={{
        color: 'var(--primary)'
      }}>{t("▮ סיכוי לגשם")}</span></div>
    </div>;
}
export function WeatherDaily({
  data,
  group = 'center',
  days = 7,
  onPick
}) {
  const d = data?.daily;
  if (!d?.time) return null;
  return <div className="wx-daily">
      {d.time.slice(0, days).map((t, i) => {
      const v = dayVerdict({
        tmax: d.temperature_2m_max[i],
        tapp: d.apparent_temperature_max?.[i],
        rainMm: d.precipitation_sum[i],
        rainProb: d.precipitation_probability_max[i],
        windMax: d.wind_speed_10m_max[i],
        gust: d.wind_gusts_10m_max?.[i],
        code: d.weather_code[i]
      }, group);
      const date = new Date(t);
      return <div key={t} className={`wx-day ${v.cls}`} onClick={() => onPick?.(i)} title={v.flags.map(f => f.t).join(' · ')}>
            <div className="tiny muted">{i === 0 ? t("היום") : date.toLocaleDateString(locale(), {
            weekday: 'short'
          })}</div>
            <div className="tiny muted">{date.getDate()}/{date.getMonth() + 1}</div>
            <div style={{
          fontSize: 22
        }}>{wmoText(d.weather_code[i])[1]}</div>
            <div className="small"><b>{Math.round(d.temperature_2m_max[i])}°</b> <span className="muted">{Math.round(d.temperature_2m_min[i])}°</span></div>
            {d.precipitation_probability_max[i] > 15 && <div className="tiny" style={{
          color: 'var(--primary)'
        }}>☔ {d.precipitation_probability_max[i]}%</div>}
            {d.wind_speed_10m_max[i] >= 35 && <div className="tiny">💨 {Math.round(d.wind_speed_10m_max[i])}</div>}
            <div className="wx-day__verdict">{v.label}</div>
          </div>;
    })}
    </div>;
}
export function WeatherFlags({
  data,
  group = 'center',
  dayIndex = 0
}) {
  const d = data?.daily;
  if (!d?.time) return null;
  const i = dayIndex;
  const v = dayVerdict({
    tmax: d.temperature_2m_max[i],
    tapp: d.apparent_temperature_max?.[i],
    rainMm: d.precipitation_sum[i],
    rainProb: d.precipitation_probability_max[i],
    windMax: d.wind_speed_10m_max[i],
    gust: d.wind_gusts_10m_max?.[i],
    code: d.weather_code[i]
  }, group);
  if (!v.flags.length) return <div className="alert alert--ok small">{t("✅ אין אזהרות מזג אוויר ליום זה. שקיעה")} {fmtTime(new Date(d.sunset[i]))}.</div>;
  return <div className="stack" style={{
    gap: 4
  }}>{v.flags.map((f, j) => <div key={j} className={`alert small ${f.s >= 3 ? 'alert--danger' : f.s === 2 ? 'alert--warn' : 'alert--info'}`}>{f.k === 'heat' ? '🥵' : f.k === 'flood' ? '🌊' : f.k === 'rain' ? '🌧️' : f.k === 'wind' ? '💨' : f.k === 'snow' ? '❄️' : '⛈️'} {f.t}</div>)}</div>;
}