import { useEffect, useRef } from 'react'

/**
 * Tracks the on-screen keyboard height using the Visual Viewport API
 * and sets `--keyboard-offset` CSS custom property on `.ka-page`.
 *
 * When the keyboard is open, the visual viewport shrinks — the difference
 * between window.innerHeight and visualViewport.height is the keyboard.
 */
export function useKeyboardHeight() {
  const rafRef = useRef(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        const keyboardHeight = Math.max(0, window.innerHeight - vv.height)
        const page = document.querySelector('.ka-page') as HTMLElement | null
        if (page) {
          page.style.setProperty('--keyboard-offset', `${keyboardHeight}px`)
        }
      })
    }

    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)

    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])
}
