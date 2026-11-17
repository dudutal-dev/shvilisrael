// Loaded by the generated service worker (workbox importScripts). Group-chat push notifications:
// show the message, and on tap bring the installed app to the front on the chat screen.
self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data.json() } catch { /* empty payload */ }
  e.waitUntil(self.registration.showNotification(d.title || 'שביל ישראל', { body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'shvil-chat', renotify: true }))
})
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) { c.postMessage({ go: 'chat' }); if ('focus' in c) return c.focus() }
    return self.clients.openWindow('./#/chat')
  })())
})
