import { useState, useEffect, useCallback } from 'react'

export type ThemeMode = 'light' | 'dark' | 'eink'

const STORAGE_KEY = 'kernel-theme'
const LEGACY_KEY = 'kernel-dark-mode'

function getInitialTheme(): ThemeMode {
  // Check new storage key first
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark' || saved === 'eink') return saved

  // Migrate from legacy boolean key
  const legacy = localStorage.getItem(LEGACY_KEY)
  if (legacy === 'true') return 'dark'
  if (legacy === 'false') return 'light'

  // Fall back to system preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const THEME_COLORS: Record<ThemeMode, string> = {
  light: '#FAF9F6',
  dark: '#1C1A18',
  eink: '#FFFCF0',
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme)

  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(STORAGE_KEY, theme)
    // Keep legacy key in sync for any code that reads it
    localStorage.setItem(LEGACY_KEY, String(theme === 'dark'))

    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute('content', THEME_COLORS[theme])
    }
  }, [theme])

  // Convenience boolean for backward compatibility
  const darkMode = theme === 'dark'

  return { theme, setTheme, darkMode }
}
