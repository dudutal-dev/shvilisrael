import { t } from '../i18n/index.js'
// Geographic helpers (WGS84). All distances in km, bearings in degrees.
const R = 6371.0088;
const toRad = d => d * Math.PI / 180;
const toDeg = r => r * 180 / Math.PI;
export function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const la1 = toRad(a.lat),
    la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function bearing(a, b) {
  const la1 = toRad(a.lat),
    la2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
export function compassLabel(deg) {
  const names = [t("צ"), t("צ-מז"), t("מז"), t("ד-מז"), t("ד"), t("ד-מע"), t("מע"), t("צ-מע")];
  return names[Math.round((deg % 360 + 360) % 360 / 45) % 8];
}
export function compassLabelLong(deg) {
  const names = [t("צפון"), t("צפון-מזרח"), t("מזרח"), t("דרום-מזרח"), t("דרום"), t("דרום-מערב"), t("מערב"), t("צפון-מערב")];
  return names[Math.round((deg % 360 + 360) % 360 / 45) % 8];
}
export function formatKm(km, digits = 1) {
  if (km == null || Number.isNaN(km)) return '–';
  if (km < 1) return t("{0} מ'", Math.round(km * 1000));
  return t("{0} ק\"מ", km.toFixed(digits));
}
export function formatCoord(lat, lon) {
  if (lat == null) return '–';
  const f = (v, pos, neg) => `${Math.abs(v).toFixed(5)}° ${v >= 0 ? pos : neg}`;
  return `${f(lat, 'N', 'S')}, ${f(lon, 'E', 'W')}`;
}

/** Decimal degrees → degrees/minutes string (as printed on SPNI maps / used by rescue) */
export function toDM(lat, lon) {
  const dm = v => {
    const a = Math.abs(v);
    const d = Math.floor(a);
    const m = (a - d) * 60;
    return `${d}° ${m.toFixed(3)}'`;
  };
  return `${dm(lat)} ${lat >= 0 ? 'N' : 'S'}  ${dm(lon)} ${lon >= 0 ? 'E' : 'W'}`;
}

/** Nearest point among a list of {lat, lon} objects. */
export function nearest(pos, points) {
  let best = null;
  for (const p of points) {
    if (p.lat == null) continue;
    const d = haversine(pos, p);
    if (!best || d < best.dist) best = {
      point: p,
      dist: d
    };
  }
  return best;
}

/** Project pos onto a polyline ([lat, lon] pairs); returns {dist, index, point}. */
export function nearestOnLine(pos, line) {
  let best = {
    dist: Infinity,
    index: -1,
    point: null
  };
  for (let i = 0; i < line.length; i++) {
    const p = {
      lat: line[i][0],
      lon: line[i][1]
    };
    const d = haversine(pos, p);
    if (d < best.dist) best = {
      dist: d,
      index: i,
      point: p
    };
  }
  return best;
}
export function lineLength(line) {
  let s = 0;
  for (let i = 1; i < line.length; i++) {
    s += haversine({
      lat: line[i - 1][0],
      lon: line[i - 1][1]
    }, {
      lat: line[i][0],
      lon: line[i][1]
    });
  }
  return s;
}

/** Douglas–Peucker simplification on [lat, lon] arrays; tolerance in degrees (~0.0002 ≈ 20 m). */
export function simplify(points, tolerance = 0.0002) {
  if (points.length <= 2) return points;
  const sqTol = tolerance * tolerance;
  const sqSegDist = (p, a, b) => {
    let x = a[0],
      y = a[1],
      dx = b[0] - x,
      dy = b[1] - y;
    if (dx !== 0 || dy !== 0) {
      const u = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (u > 1) {
        x = b[0];
        y = b[1];
      } else if (u > 0) {
        x += dx * u;
        y += dy * u;
      }
    }
    dx = p[0] - x;
    dy = p[1] - y;
    return dx * dx + dy * dy;
  };
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxD = 0,
      idx = -1;
    for (let i = first + 1; i < last; i++) {
      const d = sqSegDist(points[i], points[first], points[last]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > sqTol) {
      keep[idx] = 1;
      stack.push([first, idx], [idx, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Google-maps / Waze deep links */
export function navLinks(lat, lon, label = '') {
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`,
    waze: `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`,
    ihm: `https://israelhiking.osm.org.il/map/15/${lat.toFixed(4)}/${lon.toFixed(4)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(t("{0}המיקום שלי: https://maps.google.com/?q={1},{2}", label ? label + ' – ' : '', lat, lon))}`
  };
}