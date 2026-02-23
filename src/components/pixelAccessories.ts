// ─── Pixel Accessories — Milestone-unlocked wearables ─────────
//
// Accessories are pixel overlays rendered on top of the creature.
// Each accessory has an unlock condition and a slot to prevent
// overlapping. Equipped accessories are computed from milestones.

export interface AccessoryPixel {
  x: number
  y: number
  variant: string   // CSS class suffix (e.g., 'acc-crown')
}

export interface AccessoryDef {
  id: string
  name: string
  pixels: AccessoryPixel[]
  unlockCondition: {
    type: 'tier' | 'conversations' | 'taps' | 'goals' | 'streak'
    threshold: number
  }
  slot: 'head' | 'face' | 'body' | 'ground'
}

// ─── Accessory Definitions ────────────────────────────────────

export const ACCESSORIES: AccessoryDef[] = [
  {
    id: 'tiny-crown',
    name: 'Tiny Crown',
    slot: 'head',
    unlockCondition: { type: 'tier', threshold: 3 },
    pixels: [
      { x: 50, y: 18, variant: 'acc-crown' },
      { x: 56, y: 16, variant: 'acc-crown' },
      { x: 62, y: 14, variant: 'acc-crown' },
      { x: 68, y: 16, variant: 'acc-crown' },
      { x: 74, y: 18, variant: 'acc-crown' },
    ],
  },
  {
    id: 'glasses',
    name: 'Reading Glasses',
    slot: 'face',
    unlockCondition: { type: 'conversations', threshold: 50 },
    pixels: [
      { x: 44, y: 34, variant: 'acc-glasses' },
      { x: 44, y: 40, variant: 'acc-glasses' },
      { x: 52, y: 34, variant: 'acc-glasses' },
      { x: 52, y: 40, variant: 'acc-glasses' },
      { x: 56, y: 36, variant: 'acc-glasses' },
      { x: 64, y: 36, variant: 'acc-glasses' },
      { x: 68, y: 34, variant: 'acc-glasses' },
      { x: 68, y: 40, variant: 'acc-glasses' },
      { x: 76, y: 34, variant: 'acc-glasses' },
      { x: 76, y: 40, variant: 'acc-glasses' },
    ],
  },
  {
    id: 'scarf',
    name: 'Cozy Scarf',
    slot: 'body',
    unlockCondition: { type: 'taps', threshold: 100 },
    pixels: [
      { x: 30, y: 50, variant: 'acc-scarf' },
      { x: 36, y: 48, variant: 'acc-scarf' },
      { x: 84, y: 48, variant: 'acc-scarf' },
      { x: 90, y: 50, variant: 'acc-scarf' },
      { x: 96, y: 54, variant: 'acc-scarf' },
    ],
  },
  {
    id: 'party-hat',
    name: 'Party Hat',
    slot: 'head',
    unlockCondition: { type: 'goals', threshold: 5 },
    pixels: [
      { x: 56, y: 10, variant: 'acc-party-hat' },
      { x: 52, y: 16, variant: 'acc-party-hat' },
      { x: 60, y: 16, variant: 'acc-party-hat' },
      { x: 68, y: 16, variant: 'acc-party-hat' },
      { x: 48, y: 20, variant: 'acc-party-hat' },
      { x: 72, y: 20, variant: 'acc-party-hat' },
    ],
  },
  {
    id: 'star-badge',
    name: 'Star Badge',
    slot: 'body',
    unlockCondition: { type: 'tier', threshold: 4 },
    pixels: [
      { x: 40, y: 54, variant: 'acc-star' },
    ],
  },
  {
    id: 'garden-mushroom',
    name: 'Garden Mushroom',
    slot: 'ground',
    unlockCondition: { type: 'streak', threshold: 7 },
    pixels: [
      { x: 100, y: 78, variant: 'acc-mushroom' },
      { x: 106, y: 76, variant: 'acc-mushroom' },
      { x: 112, y: 78, variant: 'acc-mushroom' },
      { x: 106, y: 82, variant: 'acc-mushroom' },
    ],
  },
]

// ─── Unlock Check ──────────────────────────────────────────────

interface UnlockContext {
  tapCount: number
  tier: number
  streak: number
  conversationCount?: number
  completedGoals?: number
}

export function getUnlockedAccessories(ctx: UnlockContext): AccessoryDef[] {
  return ACCESSORIES.filter(acc => {
    const { type, threshold } = acc.unlockCondition
    switch (type) {
      case 'tier': return ctx.tier >= threshold
      case 'taps': return ctx.tapCount >= threshold
      case 'streak': return ctx.streak >= threshold
      case 'conversations': return (ctx.conversationCount ?? 0) >= threshold
      case 'goals': return (ctx.completedGoals ?? 0) >= threshold
      default: return false
    }
  })
}

// ─── Auto-Equip Logic ──────────────────────────────────────────
// Equips the highest-unlocked accessory per slot (max 1 per slot).
// Returns flat pixel array ready for rendering.

export function getEquippedAccessoryPixels(
  tapCount: number,
  tier: number,
  streak: number,
): AccessoryPixel[] {
  const unlocked = getUnlockedAccessories({ tapCount, tier, streak })

  // Pick one per slot — last unlocked wins (highest requirement)
  const bySlot: Record<string, AccessoryDef> = {}
  for (const acc of unlocked) {
    bySlot[acc.slot] = acc
  }

  const pixels: AccessoryPixel[] = []
  for (const acc of Object.values(bySlot)) {
    pixels.push(...acc.pixels)
  }
  return pixels
}
