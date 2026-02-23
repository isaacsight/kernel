import { useEffect, useRef, useCallback } from 'react'

/**
 * Pushes a sentinel state when an overlay opens so the Android back button
 * (or browser back gesture) closes the overlay instead of navigating away.
 *
 * Uses `history.state.overlay` marker to avoid conflict with hash router.
 */
export function useOverlayHistory(
  isOpen: boolean,
  onClose: () => void,
) {
  const pushed = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const pushState = useCallback(() => {
    if (!pushed.current) {
      history.pushState({ overlay: true }, '')
      pushed.current = true
    }
  }, [])

  const popState = useCallback(() => {
    if (pushed.current) {
      pushed.current = false
      // Only go back if the sentinel is still there
      if (history.state?.overlay) {
        history.back()
      }
    }
  }, [])

  // Push sentinel when overlay opens, pop when it closes
  useEffect(() => {
    if (isOpen) {
      pushState()
    } else {
      popState()
    }
  }, [isOpen, pushState, popState])

  // Listen for popstate (back button) to close
  useEffect(() => {
    if (!isOpen) return

    const handler = () => {
      if (pushed.current) {
        pushed.current = false
        onCloseRef.current()
      }
    }

    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [isOpen])

  // Cleanup on unmount — pop sentinel if still there
  useEffect(() => {
    return () => {
      if (pushed.current) {
        pushed.current = false
        if (history.state?.overlay) {
          history.back()
        }
      }
    }
  }, [])
}
