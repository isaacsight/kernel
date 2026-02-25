import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDarkMode } from './useDarkMode'

describe('useDarkMode', () => {
  const originalMatchMedia = window.matchMedia

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    // Default: light mode system preference
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  it('defaults to light mode when no saved preference and system is light', () => {
    const { result } = renderHook(() => useDarkMode())
    expect(result.current.darkMode).toBe(false)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('defaults to dark mode when system prefers dark', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    const { result } = renderHook(() => useDarkMode())
    expect(result.current.darkMode).toBe(true)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('restores saved preference from localStorage', () => {
    localStorage.setItem('kernel-dark-mode', 'true')

    const { result } = renderHook(() => useDarkMode())
    expect(result.current.darkMode).toBe(true)
  })

  it('toggles dark mode and persists to localStorage', () => {
    const { result } = renderHook(() => useDarkMode())

    act(() => result.current.setDarkMode(true))

    expect(result.current.darkMode).toBe(true)
    expect(localStorage.getItem('kernel-dark-mode')).toBe('true')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    act(() => result.current.setDarkMode(false))

    expect(result.current.darkMode).toBe(false)
    expect(localStorage.getItem('kernel-dark-mode')).toBe('false')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('updates theme-color meta tag', () => {
    // Create meta tag
    const meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    meta.setAttribute('content', '#FAF9F6')
    document.head.appendChild(meta)

    const { result } = renderHook(() => useDarkMode())

    act(() => result.current.setDarkMode(true))
    expect(meta.getAttribute('content')).toBe('#1C1A18')

    act(() => result.current.setDarkMode(false))
    expect(meta.getAttribute('content')).toBe('#FAF9F6')

    document.head.removeChild(meta)
  })
})
