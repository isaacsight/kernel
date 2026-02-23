// ─── Pixel Accessories — Cosmetic overlays for entity tiers ───
//
// Stub: returns empty until accessories are implemented.
// Each pixel has { x, y, variant } for positioning in the entity grid.

export interface AccessoryPixel {
  x: number
  y: number
  variant: string
}

export function getEquippedAccessoryPixels(
  _tapCount: number,
  _tier: number,
  _streak: number,
): AccessoryPixel[] {
  return []
}
