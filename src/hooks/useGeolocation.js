import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n/index.js'
/** Continuous GPS watch. pos = {lat, lon, accuracy, altitude, speed, heading, time} */
export function useGeolocation(active = true, opts = {}) {
  const [pos, setPos] = useState(null);
  const [error, setError] = useState(null);
  const watchId = useRef(null);
  useEffect(() => {
    if (!active) return;
    if (!('geolocation' in navigator)) {
      setError(t("הדפדפן לא תומך ב-GPS"));
      return;
    }
    setError(null);
    watchId.current = navigator.geolocation.watchPosition(p => setPos({
      lat: p.coords.latitude,
      lon: p.coords.longitude,
      accuracy: p.coords.accuracy,
      altitude: p.coords.altitude,
      speed: p.coords.speed,
      heading: p.coords.heading,
      time: p.timestamp
    }), e => setError(e.code === 1 ? t("אין הרשאה למיקום – יש לאשר גישה למיקום בדפדפן") : e.code === 2 ? t("אין קליטת GPS כרגע") : t("פסק זמן בקבלת מיקום")), {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 20000,
      ...opts
    });
    return () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  return {
    pos,
    error
  };
}