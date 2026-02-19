import { describe, it, expect } from 'vitest'
import { splitSections, extractTakeaways, briefingToGoalDescription } from './briefingHelpers'

describe('splitSections', () => {
  it('splits markdown with multiple ## headings', () => {
    const md = `## Introduction
Some intro text.

## Analysis
Deep analysis here.
More analysis.

## Takeaways
Action items.`
    const result = splitSections(md)
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ heading: 'Introduction', body: 'Some intro text.' })
    expect(result[1]).toEqual({ heading: 'Analysis', body: 'Deep analysis here.\nMore analysis.' })
    expect(result[2]).toEqual({ heading: 'Takeaways', body: 'Action items.' })
  })

  it('returns empty array for plain text with no headings', () => {
    expect(splitSections('Just some plain text without headings.')).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(splitSections('')).toEqual([])
  })
})

describe('extractTakeaways', () => {
  it('returns the last section formatted with bold heading', () => {
    const md = `## Overview
Summary.

## Key Takeaways
Do this. Do that.`
    const result = extractTakeaways(md)
    expect(result).toBe('**Key Takeaways**\n\nDo this. Do that.')
  })

  it('returns sliced content when there are no headings', () => {
    const text = 'No headings here, just text.'
    expect(extractTakeaways(text)).toBe(text)
  })
})

describe('briefingToGoalDescription', () => {
  it('preserves output under 1000 chars', () => {
    const result = briefingToGoalDescription('My Briefing', '## Takeaways\nShort content.')
    expect(result).toContain('My Briefing')
    expect(result).toContain('Short content.')
    expect(result.length).toBeLessThanOrEqual(1000)
  })

  it('truncates output over 1000 chars', () => {
    const longContent = '## Section\n' + 'A'.repeat(2000)
    const result = briefingToGoalDescription('Title', longContent)
    expect(result.length).toBe(1000)
  })
})
