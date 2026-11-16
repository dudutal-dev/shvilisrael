import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildSlides, slidesPdf } from '../lib/slideshow.js';
import { getPhotos } from '../lib/photos.js';
import { toISODate } from '../lib/dates.js';
import { useToast } from '../hooks/useToast.jsx';
import { t, tf } from '../i18n/index.js'
const SCOPES = [['mine', "אישי"], ['shared', "משותף"], ['all', "הכול"]];
const KIND = {
  mine: "יומן המסע שלי",
  shared: "היומן המשותף",
  all: "כל המסע"
};
/** Full-screen journal slideshow. scope: mine | shared | all */
export default function Slideshow({
  initialScope = 'mine',
  journal,
  group,
  segments,
  onClose
}) {
  const toast = useToast();
  const [scope, setScope] = useState(initialScope);
  const [landscape, setLandscape] = useState(false);
  const [slides, setSlides] = useState([]);
  const [status, setStatus] = useState('');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [front, setFront] = useState(0);
  const [pdf, setPdf] = useState(null);
  const run = useRef(0);
  const imgA = useRef(),
    imgB = useRef();
  const urls = useRef([]);

  // build (and rebuild when the source or orientation changes)
  useEffect(() => {
    const my = ++run.current;
    let alive = true;
    (async () => {
      setPlaying(false);
      setPdf(null);
      setStatus(t("מכין את המצגת…"));
      const segName = id => {
        const s = segments.find(x => x.id === Number(id));
        return s ? `${t("מקטע")} ${s.id}: ${tf(s, 'name')}` : '';
      };
      const own = journal.filter(e => scope === 'mine' || scope === 'all' || e.shared).map(e => ({
        ...e,
        by: scope === 'mine' ? '' : group.name
      }));
      const others = scope === 'mine' || !group.joined ? [] : group.shared;
      const raw = [...own, ...others].filter(e => e.date && (e.text || e.photos?.length));
      if (!raw.length) {
        urls.current.forEach(URL.revokeObjectURL);
        urls.current = [];
        setSlides([]);
        setStatus(scope === 'shared' ? t("היומן המשותף עוד ריק") : t("אין עדיין רשומות ביומן"));
        return;
      }
      const entries = [];
      for (const e of raw) entries.push({
        date: e.date,
        ts: e.ts || e.id,
        text: e.text,
        km: e.km,
        mood: e.mood,
        weather: e.weather,
        sleep: e.sleep,
        seg: segName(e.segId),
        by: e.by,
        photos: (await getPhotos(e.photos || [])).map(p => p.data)
      });
      const names = scope === 'mine' ? [] : [...new Set([group.name, ...Object.values(group.members).map(m => m.n)].filter(Boolean))];
      const out = await buildSlides({
        entries,
        landscape,
        kind: t(KIND[scope]),
        names,
        cancelled: () => !alive || my !== run.current,
        onProgress: p => alive && my === run.current && setStatus(t("מכין את המצגת… {0}%", Math.round(p * 100)))
      }).catch(() => null);
      if (!out || !alive || my !== run.current) return;
      urls.current.forEach(URL.revokeObjectURL);
      urls.current = out.map(s => URL.createObjectURL(s.blob));
      setSlides(out);
      setIdx(0);
      setStatus('');
      setPlaying(true);
      // the share sheet only opens right after a tap, so the file is prepared ahead of time
      slidesPdf(out).then(blob => alive && my === run.current && setPdf(new File([blob], `shvil-israel-${scope}-${toISODate(new Date())}.pdf`, {
        type: 'application/pdf'
      })));
    })();
    return () => {
      alive = false;
    };
  }, [scope, landscape, journal, segments, group.joined, group.shared, group.name, group.members]);
  useEffect(() => () => urls.current.forEach(URL.revokeObjectURL), []);

  // show the current slide: cross-fade between two stacked images
  useEffect(() => {
    if (!slides.length) return;
    const next = front === 0 ? imgB.current : imgA.current;
    if (!next) return;
    let alive = true;
    next.src = urls.current[idx];
    (next.decode ? next.decode().catch(() => {}) : Promise.resolve()).then(() => alive && setFront(f => 1 - f));
    return () => {
      alive = false;
    };
  }, [idx, slides]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!playing || !slides.length) return;
    const id = setTimeout(() => idx < slides.length - 1 ? setIdx(idx + 1) : setPlaying(false), 5200);
    return () => clearTimeout(id);
  }, [playing, idx, slides.length]);
  const go = useCallback(d => setIdx(i => Math.max(0, Math.min(slides.length - 1, i + d))), [slides.length]);
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') go(document.documentElement.dir === 'rtl' ? 1 : -1);
      if (e.key === 'ArrowRight') go(document.documentElement.dir === 'rtl' ? -1 : 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);
  const share = async files => {
    setPlaying(false);
    if (navigator.canShare?.({
      files
    })) {
      try {
        await navigator.share({
          files,
          title: t("יומן שביל ישראל")
        });
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return;
        if (e?.name === 'NotAllowedError') return toast(t("הקובץ מוכן. לחצו שוב על השיתוף"));
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(files[0]);
    a.download = files[0].name;
    document.body.append(a);
    a.click();
    a.remove();
    toast(files.length > 1 ? t("הדפדפן הזה לא משתף כמה קבצים. נסו את ה-PDF") : t("הקובץ ירד למכשיר"));
  };
  const sx = useRef(null);
  const rtl = document.documentElement.dir === 'rtl';
  return createPortal(<div className={`show ${playing ? 'playing' : ''}`}>
      <div className="show__bars">{slides.map((_, i) => <i key={i} className={i <= idx ? 'on' : ''} />)}</div>
      <div className="show__stage" onPointerDown={e => {
      sx.current = e.clientX;
    }} onPointerUp={e => {
      if (sx.current == null || !slides.length || e.target.closest('button')) return;
      const dx = e.clientX - sx.current;
      sx.current = null;
      const fwd = Math.abs(dx) > 40 ? dx > 0 === rtl : e.clientX < e.currentTarget.clientWidth / 2 === rtl; // swipe / tap follow the reading direction
      go(fwd ? 1 : -1);
    }}>
        <img ref={imgA} alt="" className={front === 0 && slides.length ? 'on' : ''} />
        <img ref={imgB} alt="" className={front === 1 && slides.length ? 'on' : ''} />
        {slides.length > 1 && <><button className="show__arrow show__arrow--prev" onClick={() => go(-1)} aria-label={t("הקודם")}>{rtl ? '›' : '‹'}</button><button className="show__arrow show__arrow--next" onClick={() => go(1)} aria-label={t("הבא")}>{rtl ? '‹' : '›'}</button></>}
        {status && <p className="show__status">{status}</p>}
      </div>
      <button className="show__x" onClick={onClose} aria-label={t("סגור")}>✕</button>
      <div className="show__ctl">
        <button className="show__round" onClick={() => {
        if (!playing && idx === slides.length - 1) setIdx(0);
        setPlaying(!playing);
      }} aria-label={playing ? t("השהיה") : t("הפעלה")}>{playing ? '❚❚' : '▶'}</button>
        <div className="show__seg">{SCOPES.filter(([k]) => k === 'mine' || group.joined).map(([k, v]) => <button key={k} className={scope === k ? 'on' : ''} onClick={() => setScope(k)}>{t(v)}</button>)}</div>
        <span className="show__n">{slides.length ? `${idx + 1} / ${slides.length}` : ''}</span>
      </div>
      <div className="show__ctl">
        <button className={`show__pri ${pdf ? '' : 'wait'}`} onClick={() => pdf ? share([pdf]) : toast(t("ה-PDF עוד בהכנה, עוד רגע"))}>{t("שיתוף PDF")}</button>
        <button onClick={() => slides.length && share(slides.slice(0, 30).map((s, i) => new File([s.blob], `shvil-${String(i + 1).padStart(2, '0')}.jpg`, {
        type: 'image/jpeg'
      })))}>{t("שיתוף תמונות")}</button>
        <button onClick={() => setLandscape(!landscape)}>{landscape ? t("לאורך") : t("לרוחב")}</button>
      </div>
    </div>, document.body);
}
