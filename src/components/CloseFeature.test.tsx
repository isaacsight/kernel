import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CloseFeature } from './CloseFeature'
import type { CloseSpread, IssueRecord } from '../content/issues'

const spread: CloseSpread = {
  type: 'close',
  kicker: 'STOP PRESS',
  title: 'Stop Press.',
  titleJp: '終わりの合図',
  deck: 'A feed with no natural end, until you give it one.',
  byline: 'BY THE EDITORS · KERNEL.CHAT',
  signoff: 'Either way, the page tells you what happened.',
  filler: ['Filler one.', 'Filler two.', 'Filler three.'],
  cap: 5,
  closeNote: 'Nothing above is measured, stored, or sent anywhere.',
}

const issue: IssueRecord = {
  number: '415',
  month: 'JUL',
  year: '2026',
  feature: 'STOP PRESS',
  featureJp: '終わりの合図',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE OF AGENTIC ENGINEERING',
  headline: { prefix: 'Stop', emphasis: 'Press', suffix: '.', swash: '' },
  contents: [],
  spread,
}

describe('CloseFeature', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads with one item already present and both controls visible', () => {
    render(<CloseFeature spread={spread} issue={issue} />)
    expect(screen.getByText('1 ITEM')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show me one more' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "I'll stop here" })).toBeInTheDocument()
  })

  it('increments the item count and cycles filler on each press', () => {
    render(<CloseFeature spread={spread} issue={issue} />)
    const more = screen.getByRole('button', { name: 'Show me one more' })
    fireEvent.click(more)
    expect(screen.getByText('2 ITEMS')).toBeInTheDocument()
    expect(screen.getByText('Filler two.')).toBeInTheDocument()
  })

  it('transitions to a voluntary receipt when the reader stops', () => {
    render(<CloseFeature spread={spread} issue={issue} />)
    fireEvent.click(screen.getByRole('button', { name: "I'll stop here" }))
    expect(screen.getByText('You chose to stop here.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show me one more' })).not.toBeInTheDocument()
  })

  it('auto-stops with a capped receipt when the cap is reached', () => {
    render(<CloseFeature spread={spread} issue={issue} />)
    const more = () => screen.getByRole('button', { name: 'Show me one more' })
    // cap is 5; starts at 1 item, needs 4 presses to reach 5
    fireEvent.click(more())
    fireEvent.click(more())
    fireEvent.click(more())
    fireEvent.click(more())
    expect(screen.getByText(/We capped this demo at 5/)).toBeInTheDocument()
  })

  it('the law: both controls share identical class at every item count up to the cap', () => {
    render(<CloseFeature spread={spread} issue={issue} />)
    const more = () => screen.getByRole('button', { name: 'Show me one more' })
    const stop = () => screen.getByRole('button', { name: "I'll stop here" })
    expect(more().className).toBe(stop().className)
    fireEvent.click(more())
    expect(more().className).toBe(stop().className)
    fireEvent.click(more())
    expect(more().className).toBe(stop().className)
  })
})
