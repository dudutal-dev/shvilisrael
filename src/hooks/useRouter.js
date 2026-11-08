import { useCallback, useEffect, useState } from 'react'
/** Tiny hash router: #/segments/12?x=y → { path: ['segments','12'], query: {x:'y'} } */
function parse() {
  const raw = location.hash.replace(/^#\/?/, '')
  const [p, q = ''] = raw.split('?')
  const path = p.split('/').filter(Boolean)
  const query = Object.fromEntries(new URLSearchParams(q))
  return { path: path.length ? path : ['home'], query, raw }
}
export function useRouter() {
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const onHash = () => { setRoute(parse()); window.scrollTo({ top: 0 }) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const navigate = useCallback((to) => { location.hash = to.startsWith('#') ? to : '#/' + to.replace(/^\//, '') }, [])
  const back = useCallback(() => { if (history.length > 1) history.back(); else navigate('home') }, [navigate])
  return { route, navigate, back }
}
