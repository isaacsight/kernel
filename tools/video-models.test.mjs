import { describe, it, expect } from 'vitest'
import { MODELS, getModel, estimateUsd, buildInput, pickEndpoint, extractVideoUrl } from './video-models.mjs'

describe('video model registry', () => {
  it('every model has the required fields', () => {
    expect(MODELS.length).toBeGreaterThanOrEqual(3)
    for (const m of MODELS) {
      expect(typeof m.id).toBe('string')
      expect(typeof m.label).toBe('string')
      expect(typeof m.textEndpoint).toBe('string')
      expect(m.textEndpoint.startsWith('fal-ai/')).toBe(true)
      expect(typeof m.usdPerSecond).toBe('number')
      expect(m.maxDurationSeconds).toBeGreaterThanOrEqual(m.defaultDurationSeconds)
    }
  })
  it('getModel returns null for unknown ids', () => {
    expect(getModel('nope')).toBeNull()
  })
})

describe('estimateUsd', () => {
  it('multiplies per-second price by duration, rounded to cents', () => {
    const m = MODELS[0]
    expect(estimateUsd(m.id, 5)).toBeCloseTo(Math.round(m.usdPerSecond * 5 * 100) / 100, 2)
  })
  it('returns null for unknown model (never fabricates a price)', () => {
    expect(estimateUsd('nope', 5)).toBeNull()
  })
  it('clamps duration to the model max', () => {
    const m = MODELS[0]
    expect(estimateUsd(m.id, 9999)).toBeCloseTo(Math.round(m.usdPerSecond * m.maxDurationSeconds * 100) / 100, 2)
  })
})

describe('buildInput / pickEndpoint', () => {
  it('text-to-video input carries prompt and duration', () => {
    const m = MODELS[0]
    const input = buildInput(m.id, 'a city after midnight', 5)
    expect(input.prompt).toBe('a city after midnight')
    expect(input).not.toHaveProperty('image_url')
  })
  it('image input adds image_url and switches endpoint when supported', () => {
    const m = MODELS.find(x => x.imageEndpoint)
    const input = buildInput(m.id, 'p', 5, 'data:image/png;base64,AAAA')
    expect(input.image_url).toBe('data:image/png;base64,AAAA')
    expect(pickEndpoint(m.id, true)).toBe(m.imageEndpoint)
    expect(pickEndpoint(m.id, false)).toBe(m.textEndpoint)
  })
})

describe('extractVideoUrl', () => {
  it('finds the url in the common fal result shapes', () => {
    expect(extractVideoUrl({ video: { url: 'https://x/v.mp4' } })).toBe('https://x/v.mp4')
    expect(extractVideoUrl({ data: { video: { url: 'https://y/v.mp4' } } })).toBe('https://y/v.mp4')
    expect(extractVideoUrl({ videos: [{ url: 'https://z/v.mp4' }] })).toBe('https://z/v.mp4')
    expect(extractVideoUrl({})).toBeNull()
  })
})
