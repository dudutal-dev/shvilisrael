import { useState } from 'react';
import { Modal } from './UI.jsx';
import { formatKm, haversine, navLinks } from '../lib/geo.js';
import { t } from '../i18n/index.js'
export function PoiModal({
  poi,
  onClose,
  pos
}) {
  if (!poi) return null;
  const dist = pos && poi.lat != null ? haversine(pos, poi) : null;
  return <Modal open onClose={onClose} title={poi.title}>
      <div className="stack">
        {(poi.original || poi.image) && <div className="poi-hero"><img src={poi.original || poi.image} alt={poi.title} referrerPolicy="no-referrer" onError={e => {
          e.currentTarget.parentElement.style.display = 'none';
        }} /></div>}
        <p className="poi-text">{poi.extract}</p>
        <div className="row" style={{
        gap: 6
      }}>
          {poi.url && <a className="btn btn--sm btn--primary" href={poi.url} target="_blank" rel="noreferrer">{t("📖 הערך המלא בוויקיפדיה")}</a>}
          {poi.lat != null && <a className="btn btn--sm" href={navLinks(poi.lat, poi.lon).ihm} target="_blank" rel="noreferrer">{t("📍 במפה")}</a>}
          {dist != null && <span className="chip">{formatKm(dist)} {t("ממני")}</span>}
        </div>
        <p className="tiny muted">{t("מקור: ויקיפדיה העברית (CC BY-SA). התמונה והטקסט עשויים להתייחס לאתר הכללי ולא לנקודה המדויקת על השביל.")}</p>
      </div>
    </Modal>;
}

/** Horizontal strip / grid of POI cards. */
export function PoiCards({
  pois,
  pos,
  layout = 'strip',
  onOpen
}) {
  const [open, setOpen] = useState(null);
  if (!pois?.length) return null;
  const show = p => onOpen ? onOpen(p) : setOpen(p);
  return <>
      <div className={layout === 'grid' ? 'poi-grid' : 'poi-strip'}>
        {pois.map(p => {
        const d = pos && p.lat != null ? haversine(pos, p) : null;
        return <button key={p.title} className="poi-card" onClick={() => show(p)}>
              <div className="poi-card__img">{p.image ? <img src={p.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={e => {
              e.currentTarget.replaceWith(Object.assign(document.createElement('span'), {
                textContent: '🏛️'
              }));
            }} /> : <span>🏛️</span>}</div>
              <div className="poi-card__body"><div className="poi-card__title">{p.title}</div>{d != null && <div className="tiny muted">{formatKm(d)}</div>}</div>
            </button>;
      })}
      </div>
      {!onOpen && <PoiModal poi={open} onClose={() => setOpen(null)} pos={pos} />}
    </>;
}