import { lazy, type ComponentType } from 'react'

/**
 * Wraps React.lazy() with retry logic for stale chunk handling.
 * After deployment, the service worker may cache old HTML that references
 * chunk filenames that no longer exist. This wrapper detects the 404 and
 * reloads the page once to pick up the new service worker + assets.
 */
export function lazyRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): ReturnType<typeof lazy<T>> {
  return lazy<T>(() =>
    factory().catch(() => {
      const key = 'kernel-chunk-reload'
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1')
        window.location.reload()
        // Return a promise that never resolves — page is reloading
        return new Promise(() => {})
      }
      // Already reloaded once — clear flag and try one more time
      sessionStorage.removeItem(key)
      return factory()
    })
  )
}
