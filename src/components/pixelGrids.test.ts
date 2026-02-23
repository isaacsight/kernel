// ─── pixelGrids Tests ────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import {
  ENTITY_PIXELS, ENTITY_PIXELS_BY_TOPIC,
  STANDARD_EYE_X, STANDARD_EYE_Y,
  TIER_THRESHOLDS,
} from './pixelGrids'
import type { TopicDomain } from '../hooks/useEntityEvolution'

const ALL_TOPICS: TopicDomain[] = ['personal', 'tech', 'creative', 'science', 'business', 'learning']

describe('pixelGrids — topic variants', () => {
  it('has pixel arrays for all 6 topic domains', () => {
    for (const topic of ALL_TOPICS) {
      expect(ENTITY_PIXELS_BY_TOPIC[topic]).toBeDefined()
      expect(ENTITY_PIXELS_BY_TOPIC[topic].length).toBeGreaterThan(0)
    }
  })

  it('personal topic uses the default ENTITY_PIXELS', () => {
    expect(ENTITY_PIXELS_BY_TOPIC.personal).toBe(ENTITY_PIXELS)
  })

  it('all topic variants have eyes at standard positions (x:48,y:36 and x:72,y:36)', () => {
    for (const topic of ALL_TOPICS) {
      const pixels = ENTITY_PIXELS_BY_TOPIC[topic]
      const eyes = pixels.filter(p => p.variant === 'eye')
      expect(eyes.length).toBeGreaterThanOrEqual(2)

      const eyeXs = eyes.map(e => e.x).sort((a, b) => a - b)
      expect(eyeXs).toContain(STANDARD_EYE_X[0])
      expect(eyeXs).toContain(STANDARD_EYE_X[1])

      for (const eye of eyes) {
        expect(eye.y).toBe(STANDARD_EYE_Y)
      }
    }
  })

  it('all topic variants have eye sparkles', () => {
    for (const topic of ALL_TOPICS) {
      const pixels = ENTITY_PIXELS_BY_TOPIC[topic]
      const sparkles = pixels.filter(p => p.variant === 'eye-light')
      expect(sparkles.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('all tiers have minimum pixel count', () => {
    const minByTier = [25, 5, 5, 5, 5] // tier 0 has outline+body (29); higher tiers add fewer
    for (const topic of ALL_TOPICS) {
      const pixels = ENTITY_PIXELS_BY_TOPIC[topic]
      for (let tier = 0; tier < TIER_THRESHOLDS.length; tier++) {
        const count = pixels.filter(p => p.tier === tier).length
        expect(count, `${topic} tier ${tier} has ${count} pixels, need >= ${minByTier[tier]}`).toBeGreaterThanOrEqual(minByTier[tier])
      }
    }
  })

  it('no overlapping pixels within same tier for any topic', () => {
    for (const topic of ALL_TOPICS) {
      const pixels = ENTITY_PIXELS_BY_TOPIC[topic]
      for (let tier = 0; tier < TIER_THRESHOLDS.length; tier++) {
        const tierPixels = pixels.filter(p => p.tier === tier)
        const positions = new Set<string>()
        for (const p of tierPixels) {
          const key = `${p.x},${p.y}`
          // Core/crown can overlap body pixels (intentional replacement)
          if (p.variant === 'core' || p.variant === 'crown') continue
          if (p.variant === 'eye-light') continue // sparkles overlay eyes
          if (p.variant === 'outline') continue // outline ring surrounds body
          expect(positions.has(key), `${topic} tier ${tier} duplicate at ${key}`).toBe(false)
          positions.add(key)
        }
      }
    }
  })
})
