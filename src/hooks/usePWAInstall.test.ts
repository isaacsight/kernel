import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePWAInstall } from './usePWAInstall'

describe('usePWAInstall', () => {
  beforeEach(() => {
    localStorage.clear()
    // Mock matchMedia for standalone check
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
  })

  it('starts with canInstall false', () => {
    const { result } = renderHook(() => usePWAInstall())
    expect(result.current.canInstall).toBe(false)
  })

  it('sets canInstall true when beforeinstallprompt fires', () => {
    const { result } = renderHook(() => usePWAInstall())
    act(() => {
      const event = new Event('beforeinstallprompt')
      Object.assign(event, {
        prompt: vi.fn().mockResolvedValue(undefined),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      })
      window.dispatchEvent(event)
    })
    expect(result.current.canInstall).toBe(true)
  })

  it('does not show if already dismissed', () => {
    localStorage.setItem('kernel-pwa-install-dismissed', '1')
    const { result } = renderHook(() => usePWAInstall())
    act(() => {
      const event = new Event('beforeinstallprompt')
      window.dispatchEvent(event)
    })
    expect(result.current.canInstall).toBe(false)
  })

  it('dismiss sets localStorage flag and hides', () => {
    const { result } = renderHook(() => usePWAInstall())
    act(() => {
      const event = new Event('beforeinstallprompt')
      Object.assign(event, {
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'dismissed' }),
      })
      window.dispatchEvent(event)
    })
    expect(result.current.canInstall).toBe(true)
    act(() => {
      result.current.dismiss()
    })
    expect(result.current.canInstall).toBe(false)
    expect(localStorage.getItem('kernel-pwa-install-dismissed')).toBe('1')
  })

  it('does not show if already in standalone mode', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
    const { result } = renderHook(() => usePWAInstall())
    act(() => {
      const event = new Event('beforeinstallprompt')
      window.dispatchEvent(event)
    })
    expect(result.current.canInstall).toBe(false)
  })
})
