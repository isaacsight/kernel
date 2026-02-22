import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNotificationPrefs } from './useNotificationPrefs'

describe('useNotificationPrefs', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns defaults when no stored prefs', () => {
    const { result } = renderHook(() => useNotificationPrefs())
    expect(result.current.prefs).toEqual({
      inApp: true,
      briefings: true,
      goals: true,
      reminders: true,
    })
  })

  it('loads stored prefs from localStorage', () => {
    localStorage.setItem('kernel-notification-prefs', JSON.stringify({
      inApp: true,
      briefings: false,
      goals: true,
      reminders: false,
    }))
    const { result } = renderHook(() => useNotificationPrefs())
    expect(result.current.prefs.briefings).toBe(false)
    expect(result.current.prefs.reminders).toBe(false)
  })

  it('updates prefs and persists to localStorage', () => {
    const { result } = renderHook(() => useNotificationPrefs())
    act(() => {
      result.current.update({ briefings: false })
    })
    expect(result.current.prefs.briefings).toBe(false)
    expect(result.current.prefs.inApp).toBe(true) // unchanged
    const stored = JSON.parse(localStorage.getItem('kernel-notification-prefs')!)
    expect(stored.briefings).toBe(false)
  })

  it('shouldShow filters by type when inApp is true', () => {
    const { result } = renderHook(() => useNotificationPrefs())
    act(() => {
      result.current.update({ briefings: false, goals: false })
    })
    expect(result.current.shouldShow('briefing')).toBe(false)
    expect(result.current.shouldShow('goal')).toBe(false)
    expect(result.current.shouldShow('info')).toBe(true)
    expect(result.current.shouldShow('reminder')).toBe(true)
  })

  it('shouldShow returns false for all when inApp is false', () => {
    const { result } = renderHook(() => useNotificationPrefs())
    act(() => {
      result.current.update({ inApp: false })
    })
    expect(result.current.shouldShow('info')).toBe(false)
    expect(result.current.shouldShow('briefing')).toBe(false)
    expect(result.current.shouldShow('goal')).toBe(false)
  })

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('kernel-notification-prefs', 'not-json')
    const { result } = renderHook(() => useNotificationPrefs())
    expect(result.current.prefs.inApp).toBe(true) // falls back to defaults
  })
})
