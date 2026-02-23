// ─── Pixel Grid Data — Entity Evolution Tiers ───────────────
//
// Pure data: typed pixel position arrays for all 5 evolution tiers.
// Each pixel has (x, y) coordinates on a 12px stride grid,
// a CSS variant class, and the minimum tier required to render it.
// Tiers are additive — Tier 2 renders all Tier 0/1 pixels plus its own.

export interface PixelDef {
  x: number
  y: number
  variant: string        // CSS class suffix: '', 'halo', 'eye', 'wing-l', 'wing-r', 'core', 'crown', 'notif'
  tier: number           // minimum tier to show this pixel (0-4)
}

// ─── Entity Body Pixels ─────────────────────────────────────
// Grid: 11 columns, 12px stride, 10px pixels
// Tier 0 (Seed): minimal — 1 halo dot, tiny diamond core, single eye
// Tier 1 (Sprout): current design — full angel silhouette
// Tier 2 (Awake): second eye, extended halo, heart pixel
// Tier 3 (Ascendant): crown, feather detail, extra wing rows
// Tier 4 (Sovereign): seraphic — 3-tier halo, layered wings, mandala

export const ENTITY_PIXELS: PixelDef[] = [
  // ── Tier 0: Seed ──────────────────────────────
  // Minimal: 1 halo dot, core diamond, single eye
  { x: 60, y: 0,  variant: 'halo', tier: 0 },   // single halo dot
  { x: 60, y: 36, variant: '',     tier: 0 },     // core body pixel
  { x: 60, y: 48, variant: 'eye',  tier: 0 },     // diamond eye
  { x: 48, y: 48, variant: '',     tier: 0 },     // left face
  { x: 72, y: 48, variant: '',     tier: 0 },     // right face
  { x: 60, y: 60, variant: '',     tier: 0 },     // body center

  // ── Tier 1: Sprout — current angel design ─────
  // Row 0: Halo crown (floating above head)
  { x: 36, y: 0,  variant: 'halo', tier: 1 },
  { x: 48, y: 0,  variant: 'halo', tier: 1 },
  // x:60 y:0 already in tier 0
  { x: 72, y: 0,  variant: 'halo', tier: 1 },
  { x: 84, y: 0,  variant: 'halo', tier: 1 },
  // Row 2: Dome
  { x: 48, y: 24, variant: '',     tier: 1 },
  { x: 60, y: 24, variant: '',     tier: 1 },
  { x: 72, y: 24, variant: '',     tier: 1 },
  // Row 3: Head
  { x: 36, y: 36, variant: '',     tier: 1 },
  { x: 48, y: 36, variant: '',     tier: 1 },
  // x:60 y:36 already in tier 0
  { x: 72, y: 36, variant: '',     tier: 1 },
  { x: 84, y: 36, variant: '',     tier: 1 },
  // Row 4: Face
  { x: 24, y: 48, variant: '',     tier: 1 },
  { x: 36, y: 48, variant: '',     tier: 1 },
  // x:48 y:48, x:60 y:48 (eye), x:72 y:48 already in tier 0
  { x: 84, y: 48, variant: '',     tier: 1 },
  { x: 96, y: 48, variant: '',     tier: 1 },
  // Row 5: Chest
  { x: 24, y: 60, variant: '',     tier: 1 },
  { x: 36, y: 60, variant: '',     tier: 1 },
  { x: 48, y: 60, variant: '',     tier: 1 },
  // x:60 y:60 already in tier 0
  { x: 72, y: 60, variant: '',     tier: 1 },
  { x: 84, y: 60, variant: '',     tier: 1 },
  { x: 96, y: 60, variant: '',     tier: 1 },
  // Row 6: Wing tips + body
  { x: 12, y: 72, variant: 'wing-l', tier: 1 },
  { x: 24, y: 72, variant: '',       tier: 1 },
  { x: 36, y: 72, variant: '',       tier: 1 },
  { x: 48, y: 72, variant: '',       tier: 1 },
  { x: 60, y: 72, variant: '',       tier: 1 },
  { x: 72, y: 72, variant: '',       tier: 1 },
  { x: 84, y: 72, variant: '',       tier: 1 },
  { x: 96, y: 72, variant: '',       tier: 1 },
  { x: 108, y: 72, variant: 'wing-r', tier: 1 },
  // Row 7: Wings spread + torso
  { x: 0,   y: 84, variant: 'wing-l', tier: 1 },
  { x: 12,  y: 84, variant: 'wing-l', tier: 1 },
  { x: 36,  y: 84, variant: '',       tier: 1 },
  { x: 48,  y: 84, variant: '',       tier: 1 },
  { x: 60,  y: 84, variant: '',       tier: 1 },
  { x: 72,  y: 84, variant: '',       tier: 1 },
  { x: 84,  y: 84, variant: '',       tier: 1 },
  { x: 108, y: 84, variant: 'wing-r', tier: 1 },
  { x: 120, y: 84, variant: 'wing-r', tier: 1 },
  // Row 8: Lower body
  { x: 36, y: 96, variant: '',  tier: 1 },
  { x: 48, y: 96, variant: '',  tier: 1 },
  { x: 60, y: 96, variant: '',  tier: 1 },
  { x: 72, y: 96, variant: '',  tier: 1 },
  { x: 84, y: 96, variant: '',  tier: 1 },
  // Row 9: Narrow
  { x: 48, y: 108, variant: '', tier: 1 },
  { x: 60, y: 108, variant: '', tier: 1 },
  { x: 72, y: 108, variant: '', tier: 1 },
  // Row 10: Base point
  { x: 60, y: 120, variant: '', tier: 1 },

  // ── Tier 2: Awake — second eye, extended halo, heart ──
  { x: 48, y: 48, variant: 'eye',  tier: 2 },    // second eye (left) — replaces body pixel at same pos
  { x: 24, y: 0,  variant: 'halo', tier: 2 },    // halo extends left
  { x: 96, y: 0,  variant: 'halo', tier: 2 },    // halo extends right
  { x: 60, y: 72, variant: 'core', tier: 2 },    // heart/core pixel (topic-colored) — overlays body pixel

  // ── Tier 3: Ascendant — crown, feather detail, wider wings ──
  { x: 60, y: -12, variant: 'crown', tier: 3 },  // crown pixel above halo
  // Extra wing feather pixels
  { x: -12, y: 84,  variant: 'wing-l', tier: 3 },
  { x: 132, y: 84,  variant: 'wing-r', tier: 3 },
  // Wing mid-row detail
  { x: 0,   y: 72, variant: 'wing-l', tier: 3 },
  { x: 120, y: 72, variant: 'wing-r', tier: 3 },
  // Lower wing accent
  { x: 12,  y: 96, variant: 'wing-l', tier: 3 },
  { x: 108, y: 96, variant: 'wing-r', tier: 3 },

  // ── Tier 4: Sovereign — seraphic 3-tier halo, layered wings, wide body ──
  // Top halo row (above existing)
  { x: 36, y: -12, variant: 'halo', tier: 4 },
  { x: 48, y: -12, variant: 'halo', tier: 4 },
  { x: 72, y: -12, variant: 'halo', tier: 4 },
  { x: 84, y: -12, variant: 'halo', tier: 4 },
  // Outer halo ring
  { x: 12, y: 0,  variant: 'halo', tier: 4 },
  { x: 108, y: 0, variant: 'halo', tier: 4 },
  // Extended wing layers
  { x: -12, y: 72, variant: 'wing-l', tier: 4 },
  { x: 132, y: 72, variant: 'wing-r', tier: 4 },
  { x: -24, y: 84, variant: 'wing-l', tier: 4 },
  { x: 144, y: 84, variant: 'wing-r', tier: 4 },
  // Lower wing sweep
  { x: 0,   y: 96, variant: 'wing-l', tier: 4 },
  { x: 120, y: 96, variant: 'wing-r', tier: 4 },
  { x: 24,  y: 96, variant: 'wing-l', tier: 4 },
  { x: 96,  y: 96, variant: 'wing-r', tier: 4 },
]

// ─── Ground Glow Pixels ─────────────────────────────────────
// Wide holographic disc below entity

export const GROUND_GLOW: PixelDef[] = [
  // Tier 0-1: narrow center glow
  { x: 90,  y: 180, variant: 'glow', tier: 0 },
  { x: 104, y: 180, variant: 'glow', tier: 0 },
  { x: 118, y: 180, variant: 'glow', tier: 0 },
  { x: 132, y: 180, variant: 'glow', tier: 0 },
  // Tier 1: standard disc
  { x: 62,  y: 180, variant: 'glow', tier: 1 },
  { x: 76,  y: 180, variant: 'glow', tier: 1 },
  { x: 146, y: 180, variant: 'glow', tier: 1 },
  { x: 160, y: 180, variant: 'glow', tier: 1 },
  // Tier 3: wider disc
  { x: 48,  y: 180, variant: 'glow', tier: 3 },
  { x: 174, y: 180, variant: 'glow', tier: 3 },
  // Tier 4: mandala disc — extra rows
  { x: 34,  y: 180, variant: 'glow', tier: 4 },
  { x: 188, y: 180, variant: 'glow', tier: 4 },
  { x: 76,  y: 186, variant: 'glow', tier: 4 },
  { x: 104, y: 186, variant: 'glow', tier: 4 },
  { x: 132, y: 186, variant: 'glow', tier: 4 },
  { x: 146, y: 186, variant: 'glow', tier: 4 },
]

// ─── Ambient Particles ──────────────────────────────────────

export const PARTICLES: PixelDef[] = [
  // Tier 0-1: 4 core particles
  { x: 16,  y: 50,  variant: 'sim', tier: 0 },
  { x: 210, y: 60,  variant: 'sim', tier: 0 },
  { x: 8,   y: 140, variant: 'sim', tier: 0 },
  { x: 220, y: 130, variant: 'sim', tier: 0 },
  // Tier 1: 8 particles
  { x: 30,  y: 95,  variant: 'sim', tier: 1 },
  { x: 200, y: 100, variant: 'sim', tier: 1 },
  { x: 50,  y: 170, variant: 'sim', tier: 1 },
  { x: 185, y: 165, variant: 'sim', tier: 1 },
  // Tier 3: 12 particles
  { x: 4,   y: 20,  variant: 'sim', tier: 3 },
  { x: 225, y: 25,  variant: 'sim', tier: 3 },
  { x: 40,  y: 200, variant: 'sim', tier: 3 },
  { x: 195, y: 190, variant: 'sim', tier: 3 },
  // Tier 4: 16 particles
  { x: 0,   y: 80,  variant: 'sim', tier: 4 },
  { x: 235, y: 85,  variant: 'sim', tier: 4 },
  { x: 20,  y: 210, variant: 'sim', tier: 4 },
  { x: 215, y: 205, variant: 'sim', tier: 4 },
]

// ─── Tier Metadata ──────────────────────────────────────────

export const TIER_NAMES = ['Seed', 'Sprout', 'Awake', 'Ascendant', 'Sovereign'] as const
export type TierName = typeof TIER_NAMES[number]

export const TIER_THRESHOLDS = [0, 15, 35, 60, 85] as const
