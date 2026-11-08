// Journal photos stored locally in IndexedDB (compressed JPEG dataURLs ≈ 150–300 KB each).
import { idbGet, idbSet, idbDel } from './overpass.js'
const KEY = (id) => `photo:${id}`

export async function compressImage(file, max = 1400, quality = 0.82) {
  const bmp = await createImageBitmap(file).catch(() => null)
  if (!bmp) return await fileToDataURL(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', quality)
}
const fileToDataURL = (f) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f) })

export async function savePhoto(file, meta = {}) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const data = await compressImage(file)
  await idbSet(KEY(id), { id, data, ...meta, createdAt: Date.now() })
  return id
}
export const getPhoto = (id) => idbGet(KEY(id))
export const deletePhoto = (id) => idbDel(KEY(id))
export async function getPhotos(ids = []) { return (await Promise.all(ids.map(getPhoto))).filter(Boolean) }
