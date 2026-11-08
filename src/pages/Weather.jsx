import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context.jsx';
import { Alert, Section } from '../components/UI.jsx';
import { Icon } from '../components/Icons.jsx';
import { WeatherNow, WeatherHourly, WeatherDaily, WeatherFlags } from '../components/Weather.jsx';
import { useWeather } from '../hooks/useWeather.js';
import { useGeolocation } from '../hooks/useGeolocation.js';
import { STATIONS, fetchForecastMany, wmoText, dayVerdict } from '../lib/weather.js';
import { nearest } from '../lib/geo.js';
import { regionGroup } from '../lib/season.js';
import { fmtDateLong } from '../lib/dates.js';
import { t, tf } from '../i18n/index.js'
export default function Weather({
  navigate,
  query = {}
}) {
  const {
    segments,
    itinerary
  } = useApp();
  const {
    pos
  } = useGeolocation(true, {
    enableHighAccuracy: false,
    maximumAge: 300000
  });
  const [mode, setMode] = useState(query.seg ? 'segment' : 'here');
  const [segId, setSegId] = useState(query.seg ? Number(query.seg) : itinerary?.days.find(d => d.date >= new Date() && !d.rest)?.segments?.[0] || segments[0]?.id);
  const seg = segments.find(s => s.id === Number(segId));
  const target = mode === 'segment' && seg?.start?.lat ? seg.start : pos || {
    lat: 31.78,
    lon: 35.2
  };
  const placeName = mode === 'segment' && seg ? t("מקטע {0} – {1}", seg.id, tf(seg.start, 'short')) : pos ? nearest(pos, segments.filter(s => s.start?.lat).map(s => s.start))?.point?.name_he ? t("ליד {0}", nearest(pos, segments.filter(s => s.start?.lat).map(s => s.start)).point.name_he) : t("המיקום שלי") : t("ירושלים (ללא GPS)");
  const group = mode === 'segment' && seg ? regionGroup(seg.region) : pos ? regionGroup(nearest(pos, segments.filter(s => s.start?.lat).map(s => ({
    ...s.start,
    region: s.region
  })))?.point?.region || '') : 'center';
  const {
    data,
    error,
    loading
  } = useWeather(target.lat, target.lon, {
    days: 7,
    hourly: true,
    refreshMin: 10
  });
  const [dayIdx, setDayIdx] = useState(0);
  const [stations, setStations] = useState(null);
  useEffect(() => {
    fetchForecastMany(STATIONS, 1).then(setStations).catch(() => setStations([]));
  }, []);
  return <div className="page stack">
      <div className="row between">
        <h2 className="section-title"><Icon name="sun" />{t("מזג אוויר חי")}</h2>
        <div className="segmented"><button className={mode === 'here' ? 'active' : ''} onClick={() => setMode('here')}>{t("📍 כאן")}</button><button className={mode === 'segment' ? 'active' : ''} onClick={() => setMode('segment')}>{t("🥾 מקטע")}</button></div>
      </div>
      {mode === 'segment' && <select className="select" value={segId} onChange={e => setSegId(Number(e.target.value))}>{segments.map(s => <option key={s.id} value={s.id}>{s.id}. {tf(s, 'name')}</option>)}</select>}
      {error && !data && <Alert kind="warn">{t("אין חיבור לשרת מזג האוויר. נסו שוב כשיש קליטה.")}</Alert>}
      {!data && !error && <div className="card small muted">{t("טוען תחזית")}{loading ? '…' : ''}</div>}
      {data && <>
          <div className="card card--glow"><WeatherNow data={data} place={placeName} /></div>
          <Section title={t("24 השעות הקרובות")}><div className="card"><WeatherHourly data={data} hours={24} /></div></Section>
          <Section title={t("7 ימים – התאמה להליכה")}>
            <div className="card">
              <WeatherDaily data={data} group={group} onPick={setDayIdx} />
              <div className="mt small bold">{fmtDateLong(data.daily.time[dayIdx])}</div>
              <div className="mt"><WeatherFlags data={data} group={group} dayIndex={dayIdx} /></div>
              <p className="tiny muted mt">{t("הערכת ההתאמה משקללת חום מורגש, גשם (ובנגב – סכנת שיטפון), רוח וסופות. אינה תחליף לאזהרות השירות המטאורולוגי ורשות הטבע והגנים.")}</p>
            </div>
          </Section>
        </>}
      <Section title={t("לאורך השביל עכשיו")} icon="route">
        <div className="card">
          {stations == null && <div className="small muted">{t("טוען תחנות…")}</div>}
          {stations?.length === 0 && <div className="small muted">{t("לא ניתן לטעון כרגע.")}</div>}
          {stations?.map((d, i) => {
          const s = STATIONS[i];
          const dd = d.daily;
          if (!dd) return null;
          const v = dayVerdict({
            tmax: dd.temperature_2m_max[0],
            rainMm: dd.precipitation_sum[0],
            rainProb: dd.precipitation_probability_max[0],
            windMax: dd.wind_speed_10m_max[0],
            code: dd.weather_code[0]
          }, s.group);
          return <div key={s.key} className="wx-station">
                <span>{wmoText(dd.weather_code[0])[1]} {t(s.name)}</span>
                <span className="t">{Math.round(dd.temperature_2m_max[0])}° <span className="muted" style={{
                fontWeight: 400
              }}>/ {Math.round(dd.temperature_2m_min[0])}°</span></span>
                <span className="tiny muted">{dd.precipitation_probability_max[0] > 15 ? `☔ ${dd.precipitation_probability_max[0]}%` : ''}</span>
                <span className={`wx-day__verdict ${v.cls}`} style={{
              background: v.cls === 'wx-bad' ? 'var(--red)' : v.cls === 'wx-warn' ? '#c05621' : v.cls === 'wx-ok' ? 'var(--yellow)' : 'var(--green)'
            }}>{v.label}</span>
              </div>;
        })}
        </div>
      </Section>
      <Section title={t("אזהרות רשמיות")} icon="warn">
        <div className="card stack small">
          <a href="https://ims.gov.il/he/warnings" target="_blank" rel="noreferrer">{t("🌧️ השירות המטאורולוגי – אזהרות (שיטפונות, שרב, סופות)")}</a>
          <a href="https://www.parks.org.il/" target="_blank" rel="noreferrer">{t("🏞️ רשות הטבע והגנים – סגירת מסלולים בימי שרב ושיטפון")}</a>
          <a href="https://www.teva.org.il/israel-national-trail" target="_blank" rel="noreferrer">{t("🥾 החברה להגנת הטבע – הודעות שביל ישראל")}</a>
          <p className="tiny muted">{t("בנגב ובערבה: אזהרת שיטפונות = לא נכנסים לנחלים ולמכתשים, גם אם במקום שלכם בהיר. עומס חום כבד = רט\"ג סוגרת מסלולים.")}</p>
        </div>
      </Section>
    </div>;
}