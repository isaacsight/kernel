/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkOnly, NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare let self: ServiceWorkerGlobalScope

// Precache manifest injected by VitePWA (static assets only, not JS/CSS)
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// ─── Runtime caching ───

// Navigation requests (HTML) — always network first so users get fresh index.html.
// This prevents stale HTML from referencing JS/CSS hashes that no longer exist.
// 5s timeout: balances freshness vs slow mobile networks (3s was too aggressive).
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'html-shell',
      networkTimeoutSeconds: 5,
    })
  )
)

// Supabase edge functions — never cache
registerRoute(
  /^https:\/\/.*\.supabase\.co\/functions\/.*/i,
  new NetworkOnly()
)

// JS/CSS — serve cached immediately, update in background.
// Content-hashed filenames guarantee stale cache = old version (not corrupt).
// The HTML shell (NetworkFirst above) always references current hashes,
// so any new chunks are fetched fresh on next navigation.
registerRoute(
  /\.(?:js|css)$/i,
  new StaleWhileRevalidate({
    cacheName: 'app-code',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 })],
  })
)

// Google Fonts CSS
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-css',
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  })
)

// Google Fonts WOFF2
registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-woff2',
    plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  })
)

// Supabase REST API — stale while revalidate
registerRoute(
  /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
  new StaleWhileRevalidate({
    cacheName: 'supabase-api',
    plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 300 })],
  })
)

// ─── Push notifications ───

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload: { title: string; body?: string; url?: string; icon?: string }
  try {
    payload = event.data.json()
  } catch {
    payload = { title: event.data.text() }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body || '',
      icon: payload.icon || '/logo-mark-192.png',
      badge: '/favicon.svg',
      data: { url: payload.url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing window if one exists
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          if (url !== '/') client.navigate(url)
          return
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(url)
    })
  )
})

// Allow the client to trigger activation via SKIP_WAITING message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.clients.claim()
