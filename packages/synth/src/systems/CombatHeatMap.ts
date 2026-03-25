// SYNTH — Combat Heat Map (Spatial Intelligence)
//
// A 2D grid that accumulates where combat happens. The room develops MEMORY.
// This is the Houdini "solver" pattern: state from previous frames feeds forward.
//
// Hot zones = dangerous areas where combat has been intense.
// Cold zones = safe retreats where nothing has happened.
//
// Consumers:
// - Partner AI reads coldest point for retreat, gradient for flanking
// - Enemy coordination avoids stacking in hot zones
// - Atmosphere tints floor warmer where combat happened
// - Director reads total heat to gauge combat intensity
//
// All client-side, zero API calls, zero cost.

export class CombatHeatMap {
  private grid: Float32Array
  private width: number        // grid width in cells
  private height: number       // grid height in cells
  private cellSize: number     // pixels per cell
  private totalHeat: number = 0
  private decayRate: number = 0.97  // multiplicative decay per update

  // Separate layers for richer queries
  private hitLayer: Float32Array
  private killLayer: Float32Array
  private playerDamageLayer: Float32Array

  constructor(widthTiles: number, heightTiles: number, cellSize: number = 32) {
    this.cellSize = cellSize
    this.width = Math.ceil((widthTiles * 32) / cellSize)
    this.height = Math.ceil((heightTiles * 32) / cellSize)

    const size = this.width * this.height
    this.grid = new Float32Array(size)
    this.hitLayer = new Float32Array(size)
    this.killLayer = new Float32Array(size)
    this.playerDamageLayer = new Float32Array(size)
  }

  // ── Coordinate conversion ──────────────────────────────────────────

  private worldToGrid(worldX: number, worldY: number): { gx: number; gy: number } {
    return {
      gx: Math.floor(worldX / this.cellSize),
      gy: Math.floor(worldY / this.cellSize),
    }
  }

  private gridToWorld(gx: number, gy: number): { x: number; y: number } {
    return {
      x: (gx + 0.5) * this.cellSize,
      y: (gy + 0.5) * this.cellSize,
    }
  }

  private inBounds(gx: number, gy: number): boolean {
    return gx >= 0 && gx < this.width && gy >= 0 && gy < this.height
  }

  private idx(gx: number, gy: number): number {
    return gy * this.width + gx
  }

  // ── Record events ─────────────────────────────────────────────────

  /**
   * Record a hit at a world position. Damage determines intensity.
   * Splashes to adjacent cells for a softer falloff.
   */
  recordHit(worldX: number, worldY: number, damage: number): void {
    const { gx, gy } = this.worldToGrid(worldX, worldY)
    const intensity = damage / 30  // normalize: 30 damage = 1.0 heat

    // Center cell gets full intensity
    this.addHeat(gx, gy, intensity, this.hitLayer)

    // Adjacent cells get half (Gaussian-like splash)
    const splash = intensity * 0.35
    this.addHeat(gx - 1, gy, splash, this.hitLayer)
    this.addHeat(gx + 1, gy, splash, this.hitLayer)
    this.addHeat(gx, gy - 1, splash, this.hitLayer)
    this.addHeat(gx, gy + 1, splash, this.hitLayer)
  }

  /**
   * Record a kill at a world position. Kills generate significant heat.
   */
  recordKill(worldX: number, worldY: number): void {
    const { gx, gy } = this.worldToGrid(worldX, worldY)
    const intensity = 2.0  // kills are hot events

    this.addHeat(gx, gy, intensity, this.killLayer)

    // Larger splash for kills
    const splash = intensity * 0.4
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue
        this.addHeat(gx + dx, gy + dy, splash, this.killLayer)
      }
    }
  }

  /**
   * Record player taking damage. Makes the area "dangerous" for the player.
   */
  recordPlayerDamage(worldX: number, worldY: number, damage: number): void {
    const { gx, gy } = this.worldToGrid(worldX, worldY)
    const intensity = damage / 20  // player damage is weighted heavier

    this.addHeat(gx, gy, intensity, this.playerDamageLayer)

    // Splash
    const splash = intensity * 0.3
    this.addHeat(gx - 1, gy, splash, this.playerDamageLayer)
    this.addHeat(gx + 1, gy, splash, this.playerDamageLayer)
    this.addHeat(gx, gy - 1, splash, this.playerDamageLayer)
    this.addHeat(gx, gy + 1, splash, this.playerDamageLayer)
  }

  private addHeat(gx: number, gy: number, amount: number, layer: Float32Array): void {
    if (!this.inBounds(gx, gy)) return
    const i = this.idx(gx, gy)
    layer[i] += amount
    this.grid[i] += amount
  }

  // ── Decay (call every frame) ──────────────────────────────────────

  /**
   * Decay all heat. Call once per frame.
   * Heat fades over time — the room forgets old battles.
   */
  update(_dt: number): void {
    this.totalHeat = 0
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i] *= this.decayRate
      this.hitLayer[i] *= this.decayRate
      this.killLayer[i] *= this.decayRate
      this.playerDamageLayer[i] *= this.decayRate

      // Floor very small values to zero (avoid float creep)
      if (this.grid[i] < 0.001) this.grid[i] = 0
      if (this.hitLayer[i] < 0.001) this.hitLayer[i] = 0
      if (this.killLayer[i] < 0.001) this.killLayer[i] = 0
      if (this.playerDamageLayer[i] < 0.001) this.playerDamageLayer[i] = 0

      this.totalHeat += this.grid[i]
    }
  }

  // ── Query ─────────────────────────────────────────────────────────

  /**
   * Get heat at a world position. 0 = cold, 1+ = hot.
   */
  getHeat(worldX: number, worldY: number): number {
    const { gx, gy } = this.worldToGrid(worldX, worldY)
    if (!this.inBounds(gx, gy)) return 0
    return this.grid[this.idx(gx, gy)]
  }

  /**
   * Get heat gradient at a world position.
   * Returns a vector pointing toward INCREASING heat (the dangerous direction).
   * Partner AI can move AGAINST this gradient to retreat safely.
   * Enemy AI can use it to avoid stacking on hot spots.
   */
  getHeatGradient(worldX: number, worldY: number): { x: number; y: number } {
    const { gx, gy } = this.worldToGrid(worldX, worldY)

    // Central differences
    const left = this.inBounds(gx - 1, gy) ? this.grid[this.idx(gx - 1, gy)] : 0
    const right = this.inBounds(gx + 1, gy) ? this.grid[this.idx(gx + 1, gy)] : 0
    const up = this.inBounds(gx, gy - 1) ? this.grid[this.idx(gx, gy - 1)] : 0
    const down = this.inBounds(gx, gy + 1) ? this.grid[this.idx(gx, gy + 1)] : 0

    const dx = right - left
    const dy = down - up

    // Normalize
    const mag = Math.sqrt(dx * dx + dy * dy)
    if (mag < 0.001) return { x: 0, y: 0 }
    return { x: dx / mag, y: dy / mag }
  }

  /**
   * Find the coldest (safest) point in the room.
   * Used by partner AI for retreat positioning.
   */
  getColdestPoint(): { x: number; y: number } {
    let minHeat = Infinity
    let minIdx = 0

    for (let i = 0; i < this.grid.length; i++) {
      if (this.grid[i] < minHeat) {
        minHeat = this.grid[i]
        minIdx = i
      }
    }

    const gx = minIdx % this.width
    const gy = Math.floor(minIdx / this.width)
    return this.gridToWorld(gx, gy)
  }

  /**
   * Find the hottest (most dangerous) point in the room.
   * Used by Director to gauge combat center.
   */
  getHottestPoint(): { x: number; y: number } {
    let maxHeat = -Infinity
    let maxIdx = 0

    for (let i = 0; i < this.grid.length; i++) {
      if (this.grid[i] > maxHeat) {
        maxHeat = this.grid[i]
        maxIdx = i
      }
    }

    const gx = maxIdx % this.width
    const gy = Math.floor(maxIdx / this.width)
    return this.gridToWorld(gx, gy)
  }

  /**
   * Get total heat across the entire room.
   * Used by Director to gauge overall combat intensity.
   */
  getTotalHeat(): number {
    return this.totalHeat
  }

  /**
   * Get normalized total heat (0-1 scale).
   * 0 = no combat, 1 = extreme combat intensity.
   */
  getNormalizedHeat(): number {
    // Normalize: 50 total heat = full intensity
    return Math.min(1, this.totalHeat / 50)
  }

  // ── Visual output ─────────────────────────────────────────────────

  /**
   * Get a heat-based tint color for a world position.
   * Cold (0) = 0x000000 (no tint)
   * Warm = amber-red tint (combat residue on floor)
   *
   * Returns a hex color suitable for floor tile tinting.
   */
  getHeatColor(worldX: number, worldY: number): number {
    const heat = this.getHeat(worldX, worldY)
    if (heat < 0.1) return 0x000000  // no tint

    // Clamp heat to 0-1 for color interpolation
    const t = Math.min(1, heat / 3)

    // Lerp from no-tint through amber to hot red
    // Cold: 0x000000 -> Warm: 0x442200 -> Hot: 0xff4400
    if (t < 0.5) {
      // 0 to 0.5: black to amber
      const s = t * 2
      const r = Math.round(0x44 * s)
      const g = Math.round(0x22 * s)
      return (r << 16) | (g << 8)
    } else {
      // 0.5 to 1: amber to hot red
      const s = (t - 0.5) * 2
      const r = Math.round(0x44 + (0xff - 0x44) * s)
      const g = Math.round(0x22 + (0x44 - 0x22) * s)
      return (r << 16) | (g << 8)
    }
  }

  /**
   * Get the player danger heat at a position (only counts damage taken).
   * Used by partner to avoid areas where the player got hurt.
   */
  getPlayerDangerHeat(worldX: number, worldY: number): number {
    const { gx, gy } = this.worldToGrid(worldX, worldY)
    if (!this.inBounds(gx, gy)) return 0
    return this.playerDamageLayer[this.idx(gx, gy)]
  }

  /** Reset all heat (call between rooms) */
  reset(): void {
    this.grid.fill(0)
    this.hitLayer.fill(0)
    this.killLayer.fill(0)
    this.playerDamageLayer.fill(0)
    this.totalHeat = 0
  }
}
