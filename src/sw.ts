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
// 10s timeout: Android 3G/4G networks often need 5-8s. Previous 5s was too aggressive
// and caused stale cache fallbacks that referenced missing JS/CSS hashes.
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'html-shell',
      networkTimeoutSeconds: 10,
    })
  )
)

// Supabase edge functions — never cache
registerRoute(
  /^https:\/\/.*\.supabase\.co\/functions\/.*/i,
  new NetworkOnly()
)

// JS/CSS — network first with short timeout.
// Content-hashed filenames mean each deploy produces unique URLs.
// NetworkFirst ensures users always get fresh code; 3s timeout falls back to cache
// only on very slow connections. Max 1 day cache prevents stale chunk buildup.
registerRoute(
  /\.(?:js|css)$/i,
  new NetworkFirst({
    cacheName: 'app-code',
    networkTimeoutSeconds: 3,
    plugins: [new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 })],
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

// Immediately activate new service worker — don't wait for tabs to close.
// This ensures users always get the latest code on next navigation.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
