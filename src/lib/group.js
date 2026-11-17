// Trail group: people hiking together share a code and get a group chat + a shared journal.
// There is no app server. Messages are relayed through ntfy.sh and are end-to-end encrypted on the
// device (AES-GCM, key derived from the group code), so the relay only ever sees ciphertext.
// Photos travel as encrypted attachments; the relay keeps those for a few hours only, so any member
// who still holds a photo re-uploads it when somebody asks for it.
import { load, save } from './storage.js'
import { idbGet, idbSet, idbDel } from './overpass.js'
import { compressImage } from './photos.js'

const BASE = 'https://ntfy.sh/'
// Web-push relay (Cloudflare Worker): stores each group's push subscriptions and fans a notification out.
export const PUSH_URL = 'https://athens-push.dudu-tal.workers.dev'
const te = new TextEncoder(), td = new TextDecoder()
const rid = () => Math.random().toString(36).slice(2, 10)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const blank = () => ({ code: '', name: '', id: rid(), msgs: [], members: {}, last: '', sent: {}, push: false, lastOnline: 0, share: false, av: '' })

let G = { ...blank(), ...(load('group', null) || {}) }
let SJ = load('sharedJournal', []) // entries written by other members
let key = null, topic = '', ntopic = ''
let ws = null, es = null, retry = null, wsFails = 0
let online = false, unread = 0, rev = 0, snap = null
const subs = new Set(), events = new Set()
const served = {}, asked = {}
const fst = {} // chat attachments: fid -> 'loading' | 'ok' | 'missing'

function emit() { save('group', G); save('sharedJournal', SJ); snap = null; subs.forEach((f) => f()) }
export const subscribe = (f) => { subs.add(f); return () => subs.delete(f) }
export const getSnapshot = () => snap || (snap = { ...G, joined: !!G.code, online, unread, rev, shared: SJ, fst: { ...fst } })
/** Subscribe to incoming things worth a toast: { type: 'chat' | 'journal', name, text } */
export const onEvent = (f) => { events.add(f); return () => events.delete(f) }
const fire = (ev) => events.forEach((f) => f(ev))

// ---------- crypto ----------
const norm = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s) }
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('')
async function derive(code) {
  const c = norm(code)
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode('shvil-topic:' + c)))
  const h2 = new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode('shvil-notify:' + c)))
  topic = 'shv' + hex(h.slice(0, 12)); ntopic = 'shvn' + hex(h2.slice(0, 10))
  const km = await crypto.subtle.importKey('raw', te.encode(c), 'PBKDF2', false, ['deriveKey'])
  key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: te.encode('shvil-group-v1'), iterations: 100000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
async function encBytes(buf) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, buf))
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return out
}
const decBytes = (buf) => { const raw = new Uint8Array(buf); return crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, key, raw.slice(12)) }
const enc = async (obj) => b64(await encBytes(te.encode(JSON.stringify(obj))))
const dec = async (s) => JSON.parse(td.decode(await decBytes(unb64(s))))

// ---------- transport ----------
const stamp = (obj) => ({ ...obj, n: G.name, d: G.id, ts: Date.now() })
async function send(obj) {
  if (!key) return false
  try { return (await fetch(BASE + topic, { method: 'POST', body: await enc(stamp(obj)) })).ok } catch { return false }
}
async function sendFile(obj, bytes) {
  if (!key) return false
  try { return (await fetch(BASE + topic + '?filename=p.bin&message=' + encodeURIComponent(await enc(stamp(obj))), { method: 'POST', body: await encBytes(bytes) })).ok } catch { return false }
}
function onRaw(data) {
  let m; try { m = JSON.parse(data) } catch { return }
  if (m.event !== 'message' || !m.message) return
  G.last = m.id
  dec(m.message).then((p) => handle(p, m.id, m.attachment && m.attachment.url)).catch(() => {}) // not ours / undecryptable
}
const live = () => (ws && ws.readyState === 1) || (es && es.readyState === 1)
function setOnline(v) {
  if (v && !online) { // back after a long gap: the relay only keeps ~12 hours, so ask authors for what we missed
    if (G.lastOnline && Date.now() - G.lastOnline > 10 * 3600e3) setTimeout(() => send({ t: 'jwant', since: G.lastOnline - 3600e3 }), 1500)
  }
  online = v; if (v) G.lastOnline = Date.now(); emit()
}
function connect() {
  clearTimeout(retry)
  if (es) { es.close(); es = null }
  if (ws) { ws.onclose = null; try { ws.close() } catch { /* ignore */ } ws = null }
  if (!key) return
  const since = encodeURIComponent(G.last || '12h')
  if (wsFails < 2 && typeof WebSocket !== 'undefined') { // WebSocket is instant; fall back to SSE if it never opens
    let opened = false
    try { ws = new WebSocket('wss://ntfy.sh/' + topic + '/ws?since=' + since) } catch { wsFails = 2; connect(); return }
    ws.onopen = () => { opened = true; wsFails = 0; setOnline(true) }
    ws.onmessage = (ev) => onRaw(ev.data)
    ws.onclose = () => { setOnline(false); if (!opened) wsFails++; retry = setTimeout(connect, opened ? 1500 : 400) }
    return
  }
  es = new EventSource(BASE + topic + '/sse?since=' + since)
  es.onopen = () => setOnline(true)
  es.onmessage = (ev) => onRaw(ev.data)
  es.onerror = () => { setOnline(false); es.close(); retry = setTimeout(connect, 4000) }
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (!document.hidden && key && !live()) connect() })
  window.addEventListener('online', () => { if (key) connect() })
  setInterval(() => { if (online) { G.lastOnline = Date.now(); save('group', G) } }, 60000)
}

// ---------- shared journal ----------
const wire = (id) => `${G.id}-${id}`
const PART = 600 // characters of entry text per message (the relay caps a message at 4 KB)
const joinText = (e) => Array.from({ length: e.parts || 1 }, (_, i) => (e.tp && e.tp[i]) || '').join('')
const ownJournal = () => load('journal', [])
function dataUrlBytes(d) { return unb64(String(d).split(',')[1] || '') }
async function sendPhoto(eid, pid) {
  const p = await idbGet('photo:' + pid); if (!p || !p.data) return false
  const ok = await sendFile({ t: 'jp', eid, pid }, dataUrlBytes(p.data))
  if (ok) { G.sent[pid] = Date.now(); served[pid] = Date.now(); save('group', G) }
  return ok
}
async function sendEntry(e, withPhotos) {
  const text = String(e.text || ''), parts = Math.max(1, Math.ceil(text.length / PART)), id = wire(e.id)
  const meta = { id, date: e.date, segId: e.segId, km: e.km, mood: e.mood, weather: e.weather, sleep: e.sleep, photos: e.photos || [], parts, text: text.slice(0, PART), u: e.sharedAt || 0 }
  if (!(await send({ t: 'j', e: meta }))) return false
  for (let i = 1; i < parts; i++) await send({ t: 'jx', id, i, u: meta.u, x: text.slice(i * PART, (i + 1) * PART) })
  if (withPhotos) for (const pid of meta.photos) if (!G.sent[pid]) await sendPhoto(id, pid)
  return true
}
/** Publish (or re-publish after an edit) one of my journal entries to the group. */
export const shareEntry = (e) => (key ? sendEntry(e, true) : Promise.resolve(false))
/** Withdraw one of my entries from the shared journal (also on delete). */
export function unshareEntry(e) { (e.photos || []).forEach((pid) => delete G.sent[pid]); save('group', G); return send({ t: 'jdel', id: wire(e.id) }) }
function wantPhoto(pid, wait = 25000) { // give an in-flight upload a moment, then ask whoever has it
  setTimeout(async () => {
    if (!key || (await idbGet('photo:' + pid)) || Date.now() - (asked[pid] || 0) < 10 * 60e3) return
    asked[pid] = Date.now(); send({ t: 'jreq', pid })
  }, wait)
}
async function dropPhotos(ids) { for (const pid of ids || []) await idbDel('photo:' + pid) }

async function handle(p, mid, att) {
  if (!p || !p.d) return
  const mine = p.d === G.id
  const mem = G.members[p.d] || (G.members[p.d] = {})
  mem.n = p.n; mem.seen = Math.max(mem.seen || 0, p.ts || 0)
  const fresh = Date.now() - p.ts < 5 * 60e3
  if (p.t === 'loc' && p.lat && p.lon) { mem.lat = +p.lat; mem.lon = +p.lon; mem.lt = p.ts }
  if (p.t === 'chat' && p.lat && p.lon) { mem.lat = +p.lat; mem.lon = +p.lon; mem.lt = p.ts }
  if (p.t === 'av') { if (okAvatar(p.av)) mem.av = p.av; else delete mem.av }
  if (p.t === 'hi' && !mine && G.av && fresh) setTimeout(() => send({ t: 'av', av: G.av }), 1000 + Math.random() * 3000) // a newcomer gets our picture
  if (p.t === 'chat' || p.t === 'hi') {
    if (G.msgs.some((x) => x.id === mid)) return
    const pend = p.c && G.msgs.find((x) => x.id === 'c' + p.c)
    if (pend) { pend.id = mid; delete pend.pending; emit(); return }
    const f = okFile(p.f), tell = !mine && p.c && p.t === 'chat'
    G.msgs.push({ id: mid, d: p.d, n: p.n, x: p.t === 'hi' ? null : String(p.x || '').slice(0, 1200), ts: p.ts, lat: p.lat, lon: p.lon, ...(f ? { f } : {}), ...(p.c ? { c: p.c } : {}), ...(tell && !chatVisible() ? { ur: 1 } : {}) })
    if (f && !mine) { if (att) fetchFile(f, att); else fst[f.id] = 'missing' }
    if (tell && Date.now() - p.ts < 12 * 3600e3) queueAck(p.c, chatVisible())
    G.msgs.sort((a, b) => a.ts - b.ts); if (G.msgs.length > 300) G.msgs.splice(0, G.msgs.length - 300)
    if (!mine && p.t === 'chat') { unread++; if (fresh) fire({ type: 'chat', name: p.n, text: (f ? (f.img ? '📷 ' : '📎 ' + f.name + ' ') : '') + String(p.x || '') }) }
  }
  if (p.t === 'bye') delete G.members[p.d]
  if (p.t === 'ack' && !mine) { // delivery / read receipts for my messages
    const mark = (list, k) => { for (const c of Array.isArray(list) ? list.slice(0, 80) : []) { const m = G.msgs.find((x) => x.c === c && x.d === G.id); if (m) (m[k] || (m[k] = {}))[p.d] = 1 } }
    mark(p.dl, 'dv'); mark(p.rd, 'dv'); mark(p.rd, 'rd')
  }
  if (p.t === 'freq' && !mine && p.fid) { // someone asks for an attachment the relay dropped: whoever holds it re-uploads (the sender first)
    const v = await idbGet('chatfile:' + p.fid), f = findFile(p.fid)
    if (v && f) {
      const own = G.msgs.some((x) => x.f && x.f.id === p.fid && x.d === G.id), t0 = Date.now()
      await sleep(own ? 300 + Math.random() * 1200 : 2500 + Math.random() * 3000)
      if ((served['f' + p.fid] || 0) < t0) { served['f' + p.fid] = Date.now(); sendFile({ t: 'fdata', fid: p.fid }, new Uint8Array(await v.blob.arrayBuffer())) }
    }
  }
  if (p.t === 'fdata' && p.fid) { served['f' + p.fid] = Date.now(); const f = findFile(p.fid); if (!mine && f && att && fst[p.fid] !== 'ok') fetchFile(f, att) }
  if (p.t === 'j' && !mine && p.e && p.e.id) {
    const old = SJ.find((x) => x.id === p.e.id)
    if (old && old.byId !== p.d) return
    if (!old || (old.u || 0) <= (p.e.u || 0)) {
      const tp = old && old.u === p.e.u ? { ...old.tp } : {}; tp[0] = String(p.e.text || '')
      const e = { id: p.e.id, date: p.e.date, segId: p.e.segId, km: p.e.km, mood: p.e.mood, weather: p.e.weather, sleep: p.e.sleep, photos: Array.isArray(p.e.photos) ? p.e.photos.slice(0, 40) : [], parts: p.e.parts || 1, u: p.e.u || 0, tp, by: p.n, byId: p.d, ts: old ? old.ts : p.ts }
      e.text = joinText(e)
      if (old) await dropPhotos(old.photos.filter((x) => !e.photos.includes(x)))
      SJ = [e, ...SJ.filter((x) => x.id !== e.id)]
      for (const pid of e.photos) if (!(await idbGet('photo:' + pid))) wantPhoto(pid)
      if (!old && fresh) fire({ type: 'journal', name: p.n })
    }
  }
  if (p.t === 'jx' && !mine) {
    const e = SJ.find((x) => x.id === p.id)
    if (e && e.byId === p.d && e.u === p.u) { e.tp = { ...e.tp, [p.i]: String(p.x || '') }; e.text = joinText(e) }
  }
  if (p.t === 'jp' && p.pid) {
    served[p.pid] = Date.now()
    if (!mine && !(await idbGet('photo:' + p.pid))) {
      let ok = false
      if (att) try {
        const bytes = new Uint8Array(await decBytes(await (await fetch(att)).arrayBuffer()))
        await idbSet('photo:' + p.pid, { id: p.pid, data: 'data:image/jpeg;base64,' + b64(bytes), shared: true, createdAt: Date.now() }); ok = true; rev++
      } catch { /* attachment expired on the relay */ }
      if (!ok) wantPhoto(p.pid, 1000)
    }
  }
  if (p.t === 'jreq' && !mine && p.pid) { // somebody is missing a photo: whoever holds it re-uploads (the author first)
    const mineEntry = ownJournal().find((e) => e.shared && (e.photos || []).includes(p.pid))
    const eid = mineEntry ? wire(mineEntry.id) : (SJ.find((e) => e.photos.includes(p.pid)) || {}).id
    if (eid && (await idbGet('photo:' + p.pid))) {
      const t0 = Date.now(); await sleep(mineEntry ? 300 + Math.random() * 1500 : 3000 + Math.random() * 3000)
      if ((served[p.pid] || 0) < t0) { served[p.pid] = Date.now(); sendPhoto(eid, p.pid) }
    }
  }
  if (p.t === 'jwant' && !mine) { // a member was away longer than the relay remembers: re-send my shared entries
    const list = ownJournal().filter((e) => e.shared && (e.sharedAt || 0) > (p.since || 0)).slice(-40)
    if (list.length) setTimeout(async () => { for (const e of list) await sendEntry(e, false) }, 500 + Math.random() * 2000)
  }
  if (p.t === 'jdel' && !mine) {
    const e = SJ.find((x) => x.id === p.id)
    if (e && e.byId === p.d) { await dropPhotos(e.photos); SJ = SJ.filter((x) => x.id !== p.id) }
  }
  emit()
}

// ---------- live location ----------
// Sent only while the member has sharing switched on, and sparingly: after moving ~60 m (at most every
// 90 s) or every 6 minutes. Works whenever the app is open; the live map feeds exact GPS fixes.
let lastLoc = null
const distM = (a, b) => { const R = 6371000, r = (x) => x * Math.PI / 180, dl = r(b.lat - a.lat), dn = r(b.lon - a.lon), h = Math.sin(dl / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)) }
export function reportPos(pos) {
  if (!key || !G.share || !pos || pos.lat == null) return
  const age = lastLoc ? Date.now() - lastLoc.t : Infinity, moved = lastLoc ? distM(lastLoc, pos) : Infinity
  if ((moved > 60 && age > 90e3) || age > 6 * 60e3) { lastLoc = { lat: pos.lat, lon: pos.lon, t: Date.now() }; send({ t: 'loc', lat: +pos.lat.toFixed(5), lon: +pos.lon.toFixed(5) }) }
}
function pollPos() { // low-power fix for members who share but do not have the live map open
  if (!key || !G.share || document.hidden || !navigator.geolocation) return
  navigator.geolocation.getCurrentPosition((p) => reportPos({ lat: p.coords.latitude, lon: p.coords.longitude }), () => {}, { enableHighAccuracy: false, maximumAge: 120000, timeout: 20000 })
}
if (typeof document !== 'undefined') { setInterval(pollPos, 5 * 60e3); document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(pollPos, 3000) }) }
export function setShare(v) { G.share = !!v; lastLoc = null; emit(); if (G.share) pollPos() }

// ---------- profile picture ----------
// 72 px JPEG so it fits in one encrypted message.
const okAvatar = (s) => typeof s === 'string' && s.length < 4000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(s)
export async function setAvatar(file) {
  let av = ''
  if (file) {
    const bmp = await createImageBitmap(file)
    const s = Math.min(bmp.width, bmp.height), c = document.createElement('canvas'); c.width = c.height = 72
    c.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, 72, 72)
    for (const q of [0.72, 0.6, 0.5, 0.4, 0.3, 0.2]) { av = c.toDataURL('image/jpeg', q); if (av.length <= 2700) break }
  }
  G.av = av; emit()
  return send({ t: 'av', av })
}

// ---------- public API ----------
export const cryptoOk = () => typeof crypto !== 'undefined' && !!crypto.subtle
export function newCode() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', r = crypto.getRandomValues(new Uint8Array(8))
  return [...r].map((b) => abc[b % abc.length]).join('')
}
export async function join(code, name) {
  const c = norm(code)
  G = { ...blank(), id: G.id, av: G.av, name: String(name).trim().slice(0, 16), code: c.replace(/(.{4})(?=.)/g, '$1-') }
  SJ = []; unread = 0
  await derive(c); emit(); connect()
  setTimeout(() => send({ t: 'hi' }).then(() => { if (G.av) send({ t: 'av', av: G.av }); send({ t: 'jwant', since: 0 }) }), 800)
}
export async function leave() {
  await send({ t: 'bye' })
  clearTimeout(retry); if (es) es.close(); if (ws) { ws.onclose = null; try { ws.close() } catch { /* ignore */ } }
  es = ws = null; key = null; online = false
  for (const e of SJ) await dropPhotos(e.photos)
  SJ = []; G = { ...blank(), id: G.id, name: G.name, av: G.av }; unread = 0; lastLoc = null; emit()
}
// ---------- chat attachments ----------
const okFile = (f) => (f && /^[a-z0-9]{6,12}$/.test(f.id || '') ? { id: f.id, name: String(f.name || 'file').slice(0, 80), type: String(f.type || '').slice(0, 60), size: +f.size || 0, img: !!f.img } : null)
const findFile = (id) => { const m = G.msgs.find((x) => x.f && x.f.id === id); return m && m.f }
async function fetchFile(f, url) { // download, decrypt, keep on the device
  fst[f.id] = 'loading'; emit()
  try {
    const blob = new Blob([await decBytes(await (await fetch(url)).arrayBuffer())], { type: f.img ? 'image/jpeg' : f.type || 'application/octet-stream' })
    await idbSet('chatfile:' + f.id, { blob, name: f.name }); fst[f.id] = 'ok'
  } catch { fst[f.id] = 'missing' }
  emit()
}
export const getChatFile = (fid) => idbGet('chatfile:' + fid)
/** Ask the group to re-send an attachment the relay no longer has. Resolves false if nobody answered. */
export function requestFile(fid) {
  fst[fid] = 'loading'; emit(); send({ t: 'freq', fid })
  return new Promise((res) => setTimeout(() => { if (fst[fid] === 'loading') { fst[fid] = 'missing'; emit(); res(false) } else res(true) }, 25000))
}
/** Send a photo or a document, with optional text. Returns 'ok' | 'big' | 'unreadable' | 'offline' */
export async function sayFile(file, x = '') {
  const img = /^image\//.test(file.type) || /\.(heic|heif|jpe?g|png|webp)$/i.test(file.name || '')
  let blob = file, name = file.name || (img ? 'photo.jpg' : 'file'), type = file.type || 'application/octet-stream'
  if (img) try { blob = await (await fetch(await compressImage(file, 1280, 0.82))).blob(); type = 'image/jpeg'; name = name.replace(/\.\w+$/, '') + '.jpg' } catch { return 'unreadable' }
  if (blob.size > 8e6) return 'big'
  const fid = rid(), c = rid(), f = { id: fid, name: name.slice(0, 80), type, size: blob.size, img }
  await idbSet('chatfile:' + fid, { blob, name }); fst[fid] = 'ok'
  const m = { id: 'c' + c, c, d: G.id, n: G.name, x, ts: Date.now(), pending: true, f }
  G.msgs.push(m); emit()
  if (!(await sendFile({ t: 'chat', x, c, f }, new Uint8Array(await blob.arrayBuffer())))) { G.msgs = G.msgs.filter((y) => y !== m); emit(); return 'offline' }
  if (PUSH_URL) fetch(PUSH_URL + '/push', { method: 'POST', body: JSON.stringify({ g: ntopic, d: G.id, title: 'שביל ישראל', body: `${G.name}: ${img ? '📷' : '📎 ' + name} ${x.slice(0, 100)}`, site: location.origin + location.pathname }) }).catch(() => {})
  return 'ok'
}

// ---------- delivery and read receipts ----------
// One tick: the relay has the message. Two: every active member's phone has it. Blue: every active member opened the chat.
// Each receiving phone sends one short, batched acknowledgement.
const ackQ = { dl: new Set(), rd: new Set() }
let ackT = null, chatOpen = false
const chatVisible = () => chatOpen && typeof document !== 'undefined' && !document.hidden
function queueAck(c, read) { if (!c) return; ackQ.dl.add(c); if (read) ackQ.rd.add(c); clearTimeout(ackT); ackT = setTimeout(flushAck, read ? 1500 : 6000) }
function flushAck() { if (!key || !ackQ.dl.size) return; const dl = [...ackQ.dl].slice(-60), rd = [...ackQ.rd].slice(-60); ackQ.dl.clear(); ackQ.rd.clear(); send({ t: 'ack', dl, rd }) }
function ackRead() { for (const m of G.msgs) if (m.ur) { delete m.ur; queueAck(m.c, true) } }
/** The chat screen calls this when it opens and closes. */
export function setChatOpen(v) { chatOpen = !!v; if (chatVisible()) { ackRead(); markRead() } }
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (chatVisible()) ackRead() })
/** 'pending' | 'sent' | 'delivered' | 'read' for one of my own messages. */
export function tickState(m, g) {
  if (m.pending) return 'pending'
  const who = Object.keys(g.members).filter((id) => id !== g.id && Date.now() - (g.members[id].seen || 0) < 48 * 3600e3) // active in the last two days
  const all = (k) => who.length > 0 && who.every((id) => m[k] && m[k][id])
  return all('rd') ? 'read' : all('dv') ? 'delivered' : 'sent'
}

/** Chat message. Shows immediately (pending) and is confirmed when the relay echoes it back. */
export async function say(x, loc) {
  const c = rid(), m = { id: 'c' + c, c, d: G.id, n: G.name, x, ts: Date.now(), pending: true, ...loc }
  G.msgs.push(m); emit()
  const ok = await send({ t: 'chat', x, c, ...loc })
  if (!ok) { G.msgs = G.msgs.filter((y) => y !== m); emit(); return false }
  if (PUSH_URL) fetch(PUSH_URL + '/push', { method: 'POST', body: JSON.stringify({ g: ntopic, d: G.id, title: 'שביל ישראל', body: `${G.name}: ${x.slice(0, 140)}`, site: location.origin + location.pathname }) }).catch(() => {})
  return true
}
export function markRead() { if (unread) { unread = 0; emit() } }
export const inviteText = (tmpl) => tmpl.replace('{url}', location.origin + location.pathname + '#/group?code=' + G.code).replace('{code}', G.code)

// ---------- push notifications ----------
const b64uToU8 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
export const pushSupported = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
export async function pushActive() {
  try { return pushSupported() && Notification.permission === 'granted' && !!(await (await navigator.serviceWorker.ready).pushManager.getSubscription()) } catch { return false }
}
/** Returns 'ok' | 'unsupported' | 'denied' | 'error' */
export async function pushEnable() {
  if (!pushSupported()) return 'unsupported'
  try {
    if ((await Notification.requestPermission()) !== 'granted') return 'denied'
    const reg = await navigator.serviceWorker.ready
    const k = (await (await fetch(PUSH_URL + '/key')).json()).key
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToU8(k) }))
    const r = await fetch(PUSH_URL + '/sub', { method: 'POST', body: JSON.stringify({ g: ntopic, d: G.id, sub: sub.toJSON() }) })
    if (!r.ok) return 'error'
    G.push = true; emit(); return 'ok'
  } catch { return 'error' }
}
export async function pushTest(body) {
  try { return !!(await (await fetch(PUSH_URL + '/push', { method: 'POST', body: JSON.stringify({ g: ntopic, d: G.id, self: true, title: 'שביל ישראל', body, site: location.origin + location.pathname }) })).json()).sent } catch { return false }
}
async function pushRefresh() { // the browser may rotate the subscription: re-register quietly on launch
  if (!G.push || !key || !(await pushActive())) return
  try { const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription(); if (sub) fetch(PUSH_URL + '/sub', { method: 'POST', body: JSON.stringify({ g: ntopic, d: G.id, sub: sub.toJSON() }) }).catch(() => {}) } catch { /* ignore */ }
}

// ---------- boot ----------
if (G.code && cryptoOk()) derive(G.code).then(() => { connect(); pushRefresh(); if (G.share) setTimeout(pollPos, 4000) }).catch(() => {})
