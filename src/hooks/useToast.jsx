import { createContext, useCallback, useContext, useRef, useState } from 'react'
const Ctx = createContext(() => {})
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null)
  const t = useRef()
  const toast = useCallback((m, ms = 2400) => { setMsg(m); clearTimeout(t.current); t.current = setTimeout(() => setMsg(null), ms) }, [])
  return (
    <Ctx.Provider value={toast}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
    </Ctx.Provider>
  )
}
export const useToast = () => useContext(Ctx)
