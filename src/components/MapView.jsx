import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BASE_LAYERS } from '../lib/layers.js';
import { t } from '../i18n/index.js'
export { BASE_LAYERS };
const ISRAEL_BOUNDS = [[29.45, 34.2], [33.35, 35.95]];

/**
 * Imperative Leaflet wrapper.
 * props: segments, lines ([[lat,lon]...][]), pois [{lat,lon,icon,title,html}], user {lat,lon,accuracy,heading}, follow, base, onSegmentClick, fit, selectedId, height
 */
export function MapView({
  segments = [],
  lines = null,
  pois = [],
  user = null,
  follow = false,
  base = 'ihm',
  onSegmentClick,
  selectedId,
  className = 'map',
  fitTo,
  interactive = true,
  direction = 'sobo',
  overlays = []
}) {
  const el = useRef(null);
  const map = useRef(null);
  const layers = useRef({});
  useEffect(() => {
    if (map.current) return;
    const m = L.map(el.current, {
      zoomControl: false,
      attributionControl: true,
      dragging: interactive,
      scrollWheelZoom: interactive,
      touchZoom: interactive,
      doubleClickZoom: interactive
    });
    m.fitBounds(ISRAEL_BOUNDS, {
      padding: [10, 10]
    });
    L.control.scale({
      imperial: false,
      position: 'bottomright'
    }).addTo(m);
    if (interactive) L.control.zoom({
      position: 'topleft'
    }).addTo(m);
    layers.current = {
      base: null,
      trail: L.layerGroup().addTo(m),
      schematic: L.layerGroup().addTo(m),
      overlays: L.layerGroup().addTo(m),
      markers: L.layerGroup().addTo(m),
      pois: L.layerGroup().addTo(m),
      user: L.layerGroup().addTo(m)
    };
    const onZoom = () => el.current?.classList.toggle('zoomed-out', m.getZoom() < 10);
    m.on('zoomend', onZoom);
    onZoom();
    map.current = m;
    setTimeout(() => m.invalidateSize(), 50);
    // keep Leaflet in sync with layout changes (full-screen toggle, panel, rotation)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => m.invalidateSize()) : null;
    ro?.observe(el.current);
    return () => {
      m.remove();
      map.current = null;
    };
  }, [interactive]);

  // base layer
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const cfg = BASE_LAYERS[base] || BASE_LAYERS.osm;
    if (layers.current.base) m.removeLayer(layers.current.base);
    layers.current.base = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
      maxNativeZoom: cfg.maxZoom,
      keepBuffer: 4
    }).addTo(m);
    layers.current.base.bringToBack();
    // never zoom past the tiles' native resolution (blurry, pixelated tiles)
    m.setMaxZoom(cfg.maxZoom);
    if (m.getZoom() > cfg.maxZoom) m.setZoom(cfg.maxZoom);
  }, [base]);

  // schematic polyline through segment endpoints + numbered markers
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const g = layers.current.schematic,
      mk = layers.current.markers;
    g.clearLayers();
    mk.clearLayers();
    const sorted = [...segments].sort((a, b) => a.id - b.id);
    const pts = [];
    sorted.forEach(s => {
      if (s.start?.lat) pts.push([s.start.lat, s.start.lon]);
      if (s.end?.lat) pts.push([s.end.lat, s.end.lon]);
    });
    if (!lines && pts.length > 1) {
      L.polyline(pts, {
        color: '#f26b1d',
        weight: 4,
        opacity: 0.85,
        dashArray: '6 8'
      }).addTo(g);
    }
    sorted.forEach((s, i) => {
      if (!s.start?.lat) return;
      const cls = i === 0 ? 'start' : '';
      const icon = L.divIcon({
        className: '',
        html: `<div class="seg-marker ${cls} ${selectedId === s.id ? 'sel' : ''}" style="${selectedId === s.id ? 'background:#f26b1d;transform:scale(1.25)' : ''}">${s.id}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });
      const mkr = L.marker([s.start.lat, s.start.lon], {
        icon,
        title: s.name_he
      }).addTo(mk);
      mkr.bindPopup(t("<div><b>מקטע {0}: {1}</b><br/>{2} ק\"מ · {3}<br/><a href=\"#/segments/{4}\">פרטי המקטע ←</a></div>", s.id, s.name_he, s.distance_km, s.region, s.id));
      if (onSegmentClick) mkr.on('click', () => onSegmentClick(s));
    });
    const last = sorted[sorted.length - 1];
    if (last?.end?.lat) {
      const icon = L.divIcon({
        className: '',
        html: `<div class="seg-marker end">🏁</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });
      L.marker([last.end.lat, last.end.lon], {
        icon,
        title: last.end.name_he
      }).addTo(mk).bindPopup(t("<b>{0}</b><br/>סיום השביל", last.end.name_he));
    }
  }, [segments, lines, selectedId, onSegmentClick, direction]);

  // full trail geometry (from OSM)
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const g = layers.current.trail;
    g.clearLayers();
    if (!lines?.length) return;
    for (const l of lines) {
      L.polyline(l, {
        color: '#fff',
        weight: 7,
        opacity: 0.6
      }).addTo(g);
      L.polyline(l, {
        color: '#1d4ed8',
        weight: 3.5,
        opacity: 0.95
      }).addTo(g);
      L.polyline(l, {
        color: '#f26b1d',
        weight: 3.5,
        opacity: 0.95,
        dashArray: '10 14'
      }).addTo(g);
    }
  }, [lines]);

  // overlays: [{points:[[lat,lon]], color, weight, dash, opacity}]
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const g = layers.current.overlays;
    g.clearLayers();
    for (const o of overlays) if (o?.points?.length > 1) L.polyline(o.points, {
      color: o.color || '#16a34a',
      weight: o.weight || 5,
      opacity: o.opacity ?? 0.9,
      dashArray: o.dash,
      lineCap: 'round'
    }).addTo(g);
  }, [overlays]);

  // POIs
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const g = layers.current.pois;
    g.clearLayers();
    for (const p of pois) {
      if (p.lat == null) continue;
      const icon = L.divIcon({
        className: '',
        html: `<div class="poi-marker" title="${p.title || ''}">${p.icon || '📍'}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      L.marker([p.lat, p.lon], {
        icon
      }).addTo(g).bindPopup(p.html || `<b>${p.title}</b>`);
    }
  }, [pois]);

  // user location
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const g = layers.current.user;
    g.clearLayers();
    if (!user) return;
    L.circle([user.lat, user.lon], {
      radius: user.accuracy || 0,
      color: '#1d4ed8',
      weight: 1,
      fillOpacity: 0.08
    }).addTo(g);
    const rot = user.heading != null ? `<div class="user-heading" style="transform:rotate(${user.heading}deg)"></div>` : '';
    const icon = L.divIcon({
      className: '',
      html: `<div class="user-wrap">${rot}<div class="user-dot"></div></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
    L.marker([user.lat, user.lon], {
      icon,
      zIndexOffset: 1000
    }).addTo(g);
    if (follow) m.setView([user.lat, user.lon], Math.min(Math.max(m.getZoom(), 15), m.getMaxZoom()), {
      animate: true
    });
  }, [user, follow]);

  // fit request
  useEffect(() => {
    const m = map.current;
    if (!m || !fitTo) return;
    if (fitTo.bounds) m.fitBounds(fitTo.bounds, {
      padding: [30, 30],
      maxZoom: 14
    });else if (fitTo.center) m.setView(fitTo.center, fitTo.zoom || 13);
    setTimeout(() => m.invalidateSize(), 60);
  }, [fitTo]);
  return <div ref={el} className={className} />;
}