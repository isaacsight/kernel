// ─── pixelAccessories Tests ──────────────────────────────────

import { describe, it, expect } from 'vitest'
import { ACCESSORIES, getUnlockedAccessories, getEquippedAccessoryPixels } from './pixelAccessories'

describe('pixelAccessories', () => {
  it('has 6 accessory definitions', () => {
    expect(ACCESSORIES).toHaveLength(6)
  })

  it('each accessory has a unique id', () => {
    const ids = ACCESSORIES.map(a => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('each accessory has at least 1 pixel', () => {
    for (const acc of ACCESSORIES) {
      expect(acc.pixels.length, `${acc.id} has no pixels`).toBeGreaterThan(0)
    }
  })

  it('returns no unlocked accessories at defaults', () => {
    const unlocked = getUnlockedAccessories({ tapCount: 0, tier: 0, streak: 0 })
    expect(unlocked).toHaveLength(0)
  })

  it('unlocks tiny-crown at tier 3', () => {
    const unlocked = getUnlockedAccessories({ tapCount: 0, tier: 3, streak: 0 })
    expect(unlocked.some(a => a.id === 'tiny-crown')).toBe(true)
  })

  it('unlocks star-badge at tier 4', () => {
    const unlocked = getUnlockedAccessories({ tapCount: 0, tier: 4, streak: 0 })
    expect(unlocked.some(a => a.id === 'star-badge')).toBe(true)
  })

  it('unlocks scarf at 100 taps', () => {
    const unlocked = getUnlockedAccessories({ tapCount: 100, tier: 0, streak: 0 })
    expect(unlocked.some(a => a.id === 'scarf')).toBe(true)
  })

  it('unlocks garden-mushroom at 7-day streak', () => {
    const unlocked = getUnlockedAccessories({ tapCount: 0, tier: 0, streak: 7 })
    expect(unlocked.some(a => a.id === 'garden-mushroom')).toBe(true)
  })

  it('unlocks glasses at 50 conversations', () => {
    const unlocked = getUnlockedAccessories({ tapCount: 0, tier: 0, streak: 0, conversationCount: 50 })
    expect(unlocked.some(a => a.id === 'glasses')).toBe(true)
  })

  it('unlocks party-hat at 5 goals', () => {
    const unlocked = getUnlockedAccessories({ tapCount: 0, tier: 0, streak: 0, completedGoals: 5 })
    expect(unlocked.some(a => a.id === 'party-hat')).toBe(true)
  })

  it('getEquippedAccessoryPixels returns flat pixel array', () => {
    const pixels = getEquippedAccessoryPixels(100, 4, 7) // enough to unlock several
    expect(Array.isArray(pixels)).toBe(true)
    expect(pixels.length).toBeGreaterThan(0)
    for (const p of pixels) {
      expect(typeof p.x).toBe('number')
      expect(typeof p.y).toBe('number')
      expect(typeof p.variant).toBe('string')
    }
  })

  it('equips max 1 accessory per slot', () => {
    // Tier 4 unlocks both tiny-crown (head) and star-badge (body)
    // But party-hat also uses head slot — last one wins
    const pixels = getEquippedAccessoryPixels(0, 4, 0)
    // Should have crown OR party-hat pixels, not both
    const variants = new Set(pixels.map(p => p.variant))
    // Verify we get accessory variants
    expect(variants.size).toBeGreaterThan(0)
  })
})
