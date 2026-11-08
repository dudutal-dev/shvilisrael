import { useEffect, useState } from 'react'
import { load, save } from '../lib/storage.js'
export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => load(key, initial))
  useEffect(() => { save(key, value) }, [key, value])
  return [value, setValue]
}
