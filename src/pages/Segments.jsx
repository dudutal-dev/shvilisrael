import { useMemo, useState } from 'react'
import { useApp } from '../context.jsx'
import { Difficulty, Empty } from '../components/UI.jsx'
import { getPhoto } from '../components/Photo.jsx'
import { Icon } from '../components/Icons.jsx'

const REGIONS = ['הכל', 'גליל', 'כרמל ומישור החוף', 'שפלה וירושלים', 'מדבר יהודה וים המלח', 'נגב']

export default function Segments({ navigate }) {
  const { segments, done, plan } = useApp()
  const [q, setQ] = useState('')
  const [region, setRegion] = useState('הכל')
  const [diff, setDiff] = useState(0)
  const [dir, setDir] = useState(plan.direction || 'sobo')

  const list = useMemo(() => {
    let l = [...segments].sort((a, b) => a.id - b.id)
    if (dir === 'nobo') l.reverse()
    if (region !== 'הכל') l = l.filter((s) => (s.region_spni || s.region || '') === region || (s.region || '').includes(region))
    if (diff) l = l.filter((s) => s.difficulty === diff)
    if (q.trim()) {
      const t = q.trim()
      l = l.filter((s) => [s.name_he, s.name_en, s.start?.name_he, s.end?.name_he, ...(s.highlights || [])].join(' ').includes(t))
    }
    return l
  }, [segments, q, region, diff, dir])

  const totalKm = list.reduce((a, s) => a + s.distance_km, 0)

  return (
    <div className="page stack">
      <div className="row between">
        <h2 className="section-title">מקטעי השביל</h2>
        <div className="segmented">
          <button className={dir === 'sobo' ? 'active' : ''} onClick={() => setDir('sobo')}>חרמון ← אילת</button>
          <button className={dir === 'nobo' ? 'active' : ''} onClick={() => setDir('nobo')}>אילת ← חרמון</button>
        </div>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input className="input" placeholder="חיפוש מקטע, יישוב, אתר…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingInlineStart: 38 }} />
          <span style={{ position: 'absolute', insetInlineStart: 12, top: 10, color: 'var(--muted)' }}><Icon name="search" size={18} /></span>
        </div>
        <select className="select" style={{ width: 'auto' }} value={diff} onChange={(e) => setDiff(Number(e.target.value))}>
          <option value={0}>כל הדרגות</option><option value={1}>קל</option><option value={2}>בינוני</option><option value={3}>קשה</option><option value={4}>קשה מאוד</option>
        </select>
      </div>
      <div className="row" style={{ gap: 6, overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 4 }}>
        {REGIONS.map((r) => <button key={r} className={`chip chip--btn ${region === r ? 'active' : ''}`} onClick={() => setRegion(r)} style={{ whiteSpace: 'nowrap' }}>{r}</button>)}
      </div>
      <p className="small muted">{list.length} מקטעים · {totalKm.toFixed(0)} ק"מ · {list.filter((s) => done.includes(s.id)).length} הושלמו · לפי החלוקה הרשמית של החברה להגנת הטבע</p>
      {list.length === 0 && <Empty text="לא נמצאו מקטעים" />}
      <div className="stack" style={{ gap: 8 }}>
        {list.map((s) => {
          const ph = getPhoto(s.photo)
          return (
            <div key={s.id} className={`seg ${done.includes(s.id) ? 'done' : ''}`} onClick={() => navigate(`segments/${s.id}`)}>
              <div className="seg__num">{ph && <img src={ph.image_url.replace('width=900', 'width=160')} alt="" loading="lazy" referrerPolicy="no-referrer" />}<span>{s.id}</span></div>
              <div>
                <div className="seg__title">{s.name_he} {done.includes(s.id) && '✓'}</div>
                <div className="seg__sub">
                  <span>{s.region_spni || s.region}</span>
                  <Difficulty level={s.difficulty} />
                  {s.water_caching_needed && <span title="הטמנת מים">💧 הטמנה</span>}
                  {s.firing_zone && <span title="שטח אש">🎯 שטח אש</span>}
                </div>
              </div>
              <div className="seg__km">{s.distance_km}<small> ק"מ</small><br /><small>{s.hours ? `${s.hours} שע'` : ''}</small></div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
