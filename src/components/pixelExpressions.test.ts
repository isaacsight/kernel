// ─── pixelExpressions Tests ──────────────────────────────────

import { describe, it, expect } from 'vitest'
import { getExpression, ALL_MOODS } from './pixelExpressions'
import type { MoodState } from '../hooks/useCompanionMood'

describe('pixelExpressions', () => {
  it('has expression definitions for all 7 moods', () => {
    expect(ALL_MOODS).toHaveLength(7)
    for (const mood of ALL_MOODS) {
      const expr = getExpression(mood)
      expect(expr).toBeDefined()
      expect(expr.mood).toBe(mood)
    }
  })

  it('happy and excited have mouth pixels', () => {
    expect(getExpression('happy').mouthPixels.length).toBeGreaterThan(0)
    expect(getExpression('excited').mouthPixels.length).toBeGreaterThan(0)
  })

  it('sad has mouth pixels (frown)', () => {
    expect(getExpression('sad').mouthPixels.length).toBeGreaterThan(0)
  })

  it('sleepy has no mouth pixels', () => {
    expect(getExpression('sleepy').mouthPixels).toHaveLength(0)
  })

  it('bored has no thought bubbles', () => {
    expect(getExpression('bored').thoughtBubble).toHaveLength(0)
  })

  it('all non-bored moods have thought bubbles', () => {
    const moodsWithThoughts: MoodState[] = ['happy', 'excited', 'sad', 'sleepy', 'lonely', 'content']
    for (const mood of moodsWithThoughts) {
      expect(getExpression(mood).thoughtBubble.length).toBeGreaterThan(0)
    }
  })

  it('thought bubble pixels have valid variants', () => {
    const validVariants = ['thought', 'thought-dot', 'thought-content']
    for (const mood of ALL_MOODS) {
      const expr = getExpression(mood)
      for (const pixel of expr.thoughtBubble) {
        expect(validVariants).toContain(pixel.variant)
      }
    }
  })

  it('mouth pixels use "mouth" variant', () => {
    for (const mood of ALL_MOODS) {
      const expr = getExpression(mood)
      for (const pixel of expr.mouthPixels) {
        expect(pixel.variant).toBe('mouth')
      }
    }
  })

  it('happy and excited have blush pixels', () => {
    expect(getExpression('happy').blushPixels.length).toBeGreaterThanOrEqual(2)
    expect(getExpression('excited').blushPixels.length).toBeGreaterThanOrEqual(2)
  })

  it('excited has more blush than happy (wider spread)', () => {
    expect(getExpression('excited').blushPixels.length).toBeGreaterThan(
      getExpression('happy').blushPixels.length,
    )
  })

  it('content has subtle blush', () => {
    expect(getExpression('content').blushPixels.length).toBeGreaterThanOrEqual(2)
  })

  it('sad/sleepy/lonely/bored have no blush', () => {
    const noBlush: MoodState[] = ['sad', 'sleepy', 'lonely', 'bored']
    for (const mood of noBlush) {
      expect(getExpression(mood).blushPixels).toHaveLength(0)
    }
  })

  it('blush pixels use "blush" variant', () => {
    for (const mood of ALL_MOODS) {
      const expr = getExpression(mood)
      for (const pixel of expr.blushPixels) {
        expect(pixel.variant).toBe('blush')
      }
    }
  })
})
