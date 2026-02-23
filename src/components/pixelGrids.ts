// ─── Pixel Grid Data — 16-bit Garden Creature ───────────────
//
// A round, friendly creature that grows like a garden.
// Tier 0: tiny seed with two eyes and eye sparkles.
// Tier 4: full bloom with lush foliage.
// Grid: 12px stride, 10px pixels. Two eyes at ALL tiers.
// 16-bit: gradient shading, eye highlights, smoother shapes.
// "Halo" pixels → sprout/flower. "Wing" pixels → leaves.

export interface PixelDef {
  x: number
  y: number
  variant: string        // CSS class suffix: '', 'halo', 'eye', 'eye-light', 'wing-l', 'wing-r', 'core', 'crown', 'notif'
  tier: number           // minimum tier to show this pixel (0-4)
}

// ─── Entity Body Pixels ─────────────────────────────────────
//
// The creature is round and squat — big head, tiny body, cute feet.
// "Halo" class is restyled as sprout/flower (warm green-gold).
// "Wing" class is restyled as leaves (sage green).
//
// Tier 0 (Seed): round blob with two eyes — 11 pixels
// Tier 1 (Sprout): wider body, sprout on head, leaf arms, feet
// Tier 2 (Awake): sprout gets leaves, heart pixel, rounder body
// Tier 3 (Bloom): flower crown, bigger leaves, wider stance
// Tier 4 (Garden): full flower ring, lush leaf canopy, maximum roundness

export const ENTITY_PIXELS: PixelDef[] = [
  // ── Tier 0: Seed — round blob, two eyes ───────
  // Head top
  { x: 48, y: 24, variant: '',    tier: 0 },
  { x: 60, y: 24, variant: '',    tier: 0 },
  { x: 72, y: 24, variant: '',    tier: 0 },
  // Face — two eyes!
  { x: 36, y: 36, variant: '',    tier: 0 },
  { x: 48, y: 36, variant: 'eye', tier: 0 },  // left eye
  { x: 60, y: 36, variant: '',    tier: 0 },
  { x: 72, y: 36, variant: 'eye', tier: 0 },  // right eye
  { x: 84, y: 36, variant: '',    tier: 0 },
  // Eye sparkles — 16-bit detail
  { x: 50, y: 38, variant: 'eye-light', tier: 0 },  // left eye sparkle
  { x: 74, y: 38, variant: 'eye-light', tier: 0 },  // right eye sparkle
  // Body
  { x: 48, y: 48, variant: '',    tier: 0 },
  { x: 60, y: 48, variant: '',    tier: 0 },
  { x: 72, y: 48, variant: '',    tier: 0 },

  // ── Tier 1: Sprout — body, sprout, leaf arms, feet ──
  // Sprout on head
  { x: 60, y: 0,  variant: 'halo', tier: 1 },   // sprout tip
  { x: 60, y: 12, variant: 'halo', tier: 1 },   // sprout stem
  // Wider head
  { x: 36, y: 24, variant: '',     tier: 1 },
  { x: 84, y: 24, variant: '',     tier: 1 },
  // Wider face
  { x: 24, y: 36, variant: '',     tier: 1 },
  { x: 96, y: 36, variant: '',     tier: 1 },
  // Wider body
  { x: 36, y: 48, variant: '',     tier: 1 },
  { x: 84, y: 48, variant: '',     tier: 1 },
  // Belly
  { x: 36, y: 60, variant: '',     tier: 1 },
  { x: 48, y: 60, variant: '',     tier: 1 },
  { x: 60, y: 60, variant: '',     tier: 1 },
  { x: 72, y: 60, variant: '',     tier: 1 },
  { x: 84, y: 60, variant: '',     tier: 1 },
  // Leaf arms (stubby)
  { x: 24, y: 52, variant: 'wing-l', tier: 1 },
  { x: 96, y: 52, variant: 'wing-r', tier: 1 },
  // Lower body
  { x: 48, y: 72, variant: '',     tier: 1 },
  { x: 60, y: 72, variant: '',     tier: 1 },
  { x: 72, y: 72, variant: '',     tier: 1 },
  // Feet
  { x: 48, y: 84, variant: '',     tier: 1 },
  { x: 72, y: 84, variant: '',     tier: 1 },

  // ── Tier 2: Awake — sprout leaves, heart, rounder ──
  // Sprout gets side leaves
  { x: 48, y: 4,  variant: 'halo', tier: 2 },   // left leaf
  { x: 72, y: 4,  variant: 'halo', tier: 2 },   // right leaf
  // Heart pixel (topic-colored)
  { x: 60, y: 60, variant: 'core', tier: 2 },
  // Rounder body fill
  { x: 24, y: 48, variant: '',     tier: 2 },
  { x: 96, y: 48, variant: '',     tier: 2 },
  // Wider lower body
  { x: 36, y: 72, variant: '',     tier: 2 },
  { x: 84, y: 72, variant: '',     tier: 2 },
  // Bigger leaf arms
  { x: 12, y: 52, variant: 'wing-l', tier: 2 },
  { x: 108, y: 52, variant: 'wing-r', tier: 2 },

  // ── Tier 3: Bloom — flower crown, bigger leaves ───
  // Flower bud at sprout top
  { x: 60, y: -8,  variant: 'crown', tier: 3 },
  // Flower petals beside sprout
  { x: 36, y: 0,  variant: 'halo', tier: 3 },
  { x: 84, y: 0,  variant: 'halo', tier: 3 },
  // Leafy arms grow longer
  { x: 12, y: 60,  variant: 'wing-l', tier: 3 },
  { x: 108, y: 60, variant: 'wing-r', tier: 3 },
  // Wider feet / roots
  { x: 36, y: 84, variant: '',     tier: 3 },
  { x: 84, y: 84, variant: '',     tier: 3 },
  // Roots / base
  { x: 60, y: 96, variant: '',     tier: 3 },

  // ── Tier 4: Garden — full flower crown, lush leaves ─
  // Full flower ring
  { x: 36, y: -8,  variant: 'halo', tier: 4 },
  { x: 48, y: -8,  variant: 'halo', tier: 4 },
  { x: 72, y: -8,  variant: 'halo', tier: 4 },
  { x: 84, y: -8,  variant: 'halo', tier: 4 },
  // Outer petals
  { x: 24, y: 0,  variant: 'halo', tier: 4 },
  { x: 96, y: 0,  variant: 'halo', tier: 4 },
  // Lush leaf canopy
  { x: 0,   y: 52, variant: 'wing-l', tier: 4 },
  { x: 120, y: 52, variant: 'wing-r', tier: 4 },
  { x: 0,   y: 60, variant: 'wing-l', tier: 4 },
  { x: 120, y: 60, variant: 'wing-r', tier: 4 },
  // Extra body roundness
  { x: 24, y: 60, variant: '',     tier: 4 },
  { x: 96, y: 60, variant: '',     tier: 4 },
  // Wider roots
  { x: 48, y: 96, variant: '',     tier: 4 },
  { x: 72, y: 96, variant: '',     tier: 4 },
]

// ─── Ground Glow — garden soil warmth ───────────────────────

export const GROUND_GLOW: PixelDef[] = [
  // Tier 0: tiny warm spot
  { x: 104, y: 165, variant: 'glow', tier: 0 },
  { x: 118, y: 165, variant: 'glow', tier: 0 },
  { x: 132, y: 165, variant: 'glow', tier: 0 },
  // Tier 1: wider patch
  { x: 90,  y: 165, variant: 'glow', tier: 1 },
  { x: 146, y: 165, variant: 'glow', tier: 1 },
  // Tier 2: garden bed forming
  { x: 76,  y: 165, variant: 'glow', tier: 2 },
  { x: 160, y: 165, variant: 'glow', tier: 2 },
  { x: 104, y: 172, variant: 'glow', tier: 2 },
  { x: 132, y: 172, variant: 'glow', tier: 2 },
  // Tier 3: lush ground
  { x: 62,  y: 165, variant: 'glow', tier: 3 },
  { x: 174, y: 165, variant: 'glow', tier: 3 },
  { x: 76,  y: 172, variant: 'glow', tier: 3 },
  { x: 160, y: 172, variant: 'glow', tier: 3 },
  // Tier 4: full garden floor
  { x: 48,  y: 165, variant: 'glow', tier: 4 },
  { x: 188, y: 165, variant: 'glow', tier: 4 },
  { x: 62,  y: 172, variant: 'glow', tier: 4 },
  { x: 90,  y: 172, variant: 'glow', tier: 4 },
  { x: 146, y: 172, variant: 'glow', tier: 4 },
  { x: 174, y: 172, variant: 'glow', tier: 4 },
]

// ─── Ambient Particles — seeds, pollen, fireflies ───────────

export const PARTICLES: PixelDef[] = [
  // Tier 0: 2 floating seeds
  { x: 30,  y: 60,  variant: 'sim', tier: 0 },
  { x: 200, y: 70,  variant: 'sim', tier: 0 },
  // Tier 1: 6 particles
  { x: 16,  y: 120, variant: 'sim', tier: 1 },
  { x: 215, y: 110, variant: 'sim', tier: 1 },
  { x: 40,  y: 150, variant: 'sim', tier: 1 },
  { x: 190, y: 145, variant: 'sim', tier: 1 },
  // Tier 2: 10 particles
  { x: 10,  y: 30,  variant: 'sim', tier: 2 },
  { x: 225, y: 35,  variant: 'sim', tier: 2 },
  { x: 50,  y: 180, variant: 'sim', tier: 2 },
  { x: 185, y: 175, variant: 'sim', tier: 2 },
  // Tier 3: 14 particles
  { x: 5,   y: 80,  variant: 'sim', tier: 3 },
  { x: 230, y: 85,  variant: 'sim', tier: 3 },
  { x: 25,  y: 195, variant: 'sim', tier: 3 },
  { x: 210, y: 190, variant: 'sim', tier: 3 },
  // Tier 4: 18 particles — full garden alive
  { x: 0,   y: 50,  variant: 'sim', tier: 4 },
  { x: 235, y: 55,  variant: 'sim', tier: 4 },
  { x: 15,  y: 210, variant: 'sim', tier: 4 },
  { x: 220, y: 205, variant: 'sim', tier: 4 },
]

// ─── Tier Metadata ──────────────────────────────────────────

export const TIER_NAMES = ['Seed', 'Sprout', 'Awake', 'Bloom', 'Garden'] as const
export type TierName = typeof TIER_NAMES[number]

export const TIER_THRESHOLDS = [0, 15, 35, 60, 85] as const
