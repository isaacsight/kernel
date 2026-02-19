import { useState, useEffect } from 'react'

export function useDarkMode() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('kernel-dark-mode') === 'true')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('kernel-dark-mode', String(darkMode))
  }, [darkMode])

  return { darkMode, setDarkMode }
}
