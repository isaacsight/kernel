import { useState, useEffect, useCallback } from 'react'

export function useToast() {
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const showToast = useCallback((msg: string) => setToast(msg), [])

  return { toast, showToast }
}
