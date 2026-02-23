import { useState, useEffect, useCallback } from 'react'

/**
 * Detects when a new service worker is waiting to activate and
 * exposes a `updateNow()` action that posts SKIP_WAITING + reloads.
 *
 * iOS Safari unregisters the SW entirely (see main.tsx), so this
 * hook will never fire on iOS — which is the intended behavior.
 */
export function useServiceWorkerUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [waitingSW, setWaitingSW] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let cancelled = false

    const checkWaiting = (reg: ServiceWorkerRegistration) => {
      if (cancelled) return
      if (reg.waiting) {
        setWaitingSW(reg.waiting)
        setUpdateAvailable(true)
      }
    }

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg || cancelled) return

      // Already waiting
      checkWaiting(reg)

      // New SW installed while page is open
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing
        if (!newSW) return
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            if (!cancelled) {
              setWaitingSW(newSW)
              setUpdateAvailable(true)
            }
          }
        })
      })
    })

    // If another SW takes control (e.g. user clicked refresh in another tab),
    // reload this page so it picks up the new version.
    const onControllerChange = () => {
      if (!cancelled) window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    return () => {
      cancelled = true
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  const updateNow = useCallback(() => {
    if (waitingSW) {
      waitingSW.postMessage({ type: 'SKIP_WAITING' })
      // controllerchange listener above will handle the reload,
      // but fall back to a direct reload if it doesn't fire
      setTimeout(() => window.location.reload(), 1000)
    } else {
      // No waiting SW reference — just reload
      window.location.reload()
    }
  }, [waitingSW])

  return { updateAvailable, updateNow }
}
