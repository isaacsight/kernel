import { useEffect, useState } from 'react'

const MINI_BREAKPOINT = 389

export function useMiniPhone(): boolean {
  const [isMini, setIsMini] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= MINI_BREAKPOINT
  )

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MINI_BREAKPOINT}px)`)
    const handler = (e: MediaQueryListEvent) => setIsMini(e.matches)
    setIsMini(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isMini
}
