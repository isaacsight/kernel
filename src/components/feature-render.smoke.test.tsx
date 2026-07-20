import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { IssueFeature } from './IssueFeature'
import { ALL_ISSUES } from '../content/issues'

/**
 * Render smoke for the editorial feature layer: dispatch every real
 * issue through IssueFeature (the spread-type router) and assert it
 * renders without throwing. Exercises 16 of the 20 feature components
 * against real published data — a regression net the per-component
 * tests (Close/Day/Proof) don't provide at catalog scale.
 *
 * The four "working-model" shapes (plate/bore/fourier/audit) drive
 * <canvas>/AudioContext/matchMedia that jsdom does not implement; they
 * are excluded here and warrant their own mocked tests as a follow-up.
 */
const CANVAS_SHAPES = new Set(['plate', 'bore', 'fourier', 'audit'])

const renderable = ALL_ISSUES.filter((i) => i.spread && !CANVAS_SHAPES.has(i.spread.type))

describe('IssueFeature — renders every non-canvas spread from real issue data', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('covers a broad spread of editorial tools (guards against a silent gap)', () => {
    const types = new Set(renderable.map((i) => i.spread!.type))
    // Sanity: the smoke should be exercising many distinct components,
    // not accidentally filtering down to a couple.
    expect(types.size).toBeGreaterThanOrEqual(10)
  })

  it.each(renderable.map((i) => [`${i.number} (${i.spread!.type})`, i] as const))(
    'ISSUE %s renders without throwing',
    (_label, issue) => {
      const { container } = render(<IssueFeature issue={issue} />)
      expect(container.firstChild).not.toBeNull()
    },
  )
})
