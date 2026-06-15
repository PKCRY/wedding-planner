// v2 — bump to force PWA refresh
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

async function setBadge(count) {
  try {
    if (count > 0) {
      if ('setAppBadge' in navigator) await navigator.setAppBadge(count)
      else if ('setAppBadge' in self) await self.setAppBadge(count)
    } else {
      if ('clearAppBadge' in navigator) await navigator.clearAppBadge()
      else if ('clearAppBadge' in self) await self.clearAppBadge()
    }
  } catch (_) {}
}

self.addEventListener('push', (event) => {
  let data = { title: 'Wedding Planner', body: '', url: '/', badge_count: undefined }
  try {
    data = { ...data, ...event.data.json() }
  } catch {
    data.body = event.data?.text() || ''
  }

  const notifyPromise = self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
  })

  const badgePromise = data.badge_count !== undefined
    ? setBadge(data.badge_count)
    : Promise.resolve()

  event.waitUntil(Promise.all([notifyPromise, badgePromise]))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'

  event.waitUntil(
    Promise.all([
      setBadge(0),
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url)
            return client.focus()
          }
        }
        if (clients.openWindow) return clients.openWindow(url)
      }),
    ])
  )
})
