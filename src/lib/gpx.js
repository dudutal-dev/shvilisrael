import { t } from '../i18n/index.js'
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function waypointsToGPX(points, name = t("שביל ישראל")) {
  const wpts = points.filter(p => p.lat != null && p.lon != null).map(p => `  <wpt lat="${p.lat}" lon="${p.lon}"><name>${esc(p.name)}</name>${p.desc ? `<desc>${esc(p.desc)}</desc>` : ''}${p.sym ? `<sym>${esc(p.sym)}</sym>` : ''}</wpt>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Shvil Israel Planner" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata><name>${esc(name)}</name></metadata>\n${wpts}\n</gpx>`;
}
export function linesToGPX(lines, name = 'Israel National Trail') {
  const segs = lines.map(l => `    <trkseg>\n${l.map(([lat, lon]) => `      <trkpt lat="${lat}" lon="${lon}"/>`).join('\n')}\n    </trkseg>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Shvil Israel Planner" xmlns="http://www.topografix.com/GPX/1/1">\n  <trk><name>${esc(name)}</name>\n${segs}\n  </trk>\n</gpx>`;
}
export function download(filename, content, type = 'application/gpx+xml') {
  const blob = new Blob([content], {
    type
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 500);
}

/** Parse GPX text → array of [lat,lon] (track points) and waypoints */
export function parseGPX(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const trk = [...doc.getElementsByTagName('trkpt')].map(p => [parseFloat(p.getAttribute('lat')), parseFloat(p.getAttribute('lon'))]);
  const wpts = [...doc.getElementsByTagName('wpt')].map(p => ({
    lat: parseFloat(p.getAttribute('lat')),
    lon: parseFloat(p.getAttribute('lon')),
    name: p.getElementsByTagName('name')[0]?.textContent || ''
  }));
  return {
    track: trk,
    waypoints: wpts
  };
}