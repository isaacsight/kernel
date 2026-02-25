import { lazy, type ComponentType } from 'react'

/**
 * Wraps React.lazy() with retry logic for stale chunk handling.
 * After deployment, the service worker may cache old HTML that references
 * chunk filenames that no longer exist. This wrapper detects the 404,
 * nukes the SW + caches, and reloads up to 2 times before surfacing the error.
 */
export function lazyRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): ReturnType<typeof lazy<T>> {
  return lazy<T>(() =>
    factory().catch(() => {
      const key = 'kernel-chunk-reload'
      const count = parseInt(sessionStorage.getItem(key) || '0', 10)

      if (count < 2) {
        sessionStorage.setItem(key, String(count + 1))
        // Nuke SW + caches so the reload fetches fresh assets
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(regs =>
            regs.forEach(r => r.unregister())
          )
        }
        caches.keys().then(names => names.forEach(n => caches.delete(n)))
        window.location.reload()
        // Return a promise that never resolves — page is reloading
        return new Promise(() => {})
      }

      // Exhausted retries — clear flag and let error propagate to ErrorBoundary
      sessionStorage.removeItem(key)
      return factory()
    })
  )
}
