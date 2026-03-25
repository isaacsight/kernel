// SYNTH — Tile Animator
// Design Bible: "Nothing is static."
// Tiles are alive with ambient effects:
//   1. Floor tiles: occasional cyan particle emission (circuit spark)
//   2. Wall tiles: faint glow pulse on random positions
//   3. Random shimmer: tiles occasionally brighten slightly
//   4. Subtle parallax: floor tiles shift opposite to camera movement

import Phaser from 'phaser'

export class TileAnimator {
  private scene: Phaser.Scene
  private walls: Phaser.Physics.Arcade.StaticGroup

  // Collected tile references for random selection
  private floorTiles: Phaser.GameObjects.Image[] = []
  private wallSprites: Phaser.Physics.Arcade.Sprite[] = []

  // Timers (accumulate dt, fire on threshold)
  private floorSparkTimer = 0
  private wallPulseTimer = 0
  private nextFloorSparkAt: number
  private nextWallPulseAt: number

  // Parallax tracking
  private lastCamX = 0
  private lastCamY = 0

  // Created game objects to clean up
  private particles: Phaser.GameObjects.Arc[] = []
  private destroyed = false

  constructor(scene: Phaser.Scene, walls: Phaser.Physics.Arcade.StaticGroup) {
    this.scene = scene
    this.walls = walls

    // Randomize first fire times
    this.nextFloorSparkAt = this.randomRange(2000, 4000)
    this.nextWallPulseAt = this.randomRange(3000, 5000)
  }

  /**
   * Call once after the room is built. Collects tile references
   * and starts the ambient animation loops.
   */
  animate(): void {
    // Collect wall sprites from the static group
    this.wallSprites = this.walls.getChildren() as Phaser.Physics.Arcade.Sprite[]

    // Collect floor tiles — they are plain Images added to the scene.
    // Phaser stores them in the display list. We filter by texture key.
    const allChildren = this.scene.children.getAll() as Phaser.GameObjects.GameObject[]
    for (const child of allChildren) {
      if (child instanceof Phaser.GameObjects.Image && (child as Phaser.GameObjects.Image).texture.key === 'floor') {
        this.floorTiles.push(child as Phaser.GameObjects.Image)
      }
    }

    // Snapshot initial camera position for parallax delta
    this.lastCamX = this.scene.cameras.main.scrollX
    this.lastCamY = this.scene.cameras.main.scrollY

    // Register the update event so we tick each frame
    this.scene.events.on('update', this.update, this)
  }

  // ── Per-frame Tick ──────────────────────────────────────────────────

  private update(_time: number, dt: number): void {
    if (this.destroyed) return

    this.updateFloorSparks(dt)
    this.updateWallPulse(dt)
    this.updateParallax()
    this.cleanParticles()
  }

  // ── Floor Spark Particles ───────────────────────────────────────────

  private updateFloorSparks(dt: number): void {
    this.floorSparkTimer += dt
    if (this.floorSparkTimer < this.nextFloorSparkAt) return

    this.floorSparkTimer = 0
    this.nextFloorSparkAt = this.randomRange(2000, 4000)

    if (this.floorTiles.length === 0) return

    const tile = this.floorTiles[Math.floor(Math.random() * this.floorTiles.length)]
    if (!tile?.active) return

    const particleCount = 1 + Math.floor(Math.random() * 2) // 1-2 particles
    for (let i = 0; i < particleCount; i++) {
      const px = tile.x + (Math.random() - 0.5) * 16
      const py = tile.y + (Math.random() - 0.5) * 16
      const size = 0.8 + Math.random() * 1.2

      const spark = this.scene.add.circle(px, py, size, 0x44ddff, 0.5 + Math.random() * 0.3)
      spark.setDepth(3)
      spark.setBlendMode(Phaser.BlendModes.ADD)
      this.particles.push(spark)

      // Float upward and fade
      this.scene.tweens.add({
        targets: spark,
        y: py - 12 - Math.random() * 10,
        x: px + (Math.random() - 0.5) * 8,
        alpha: 0,
        scale: 0.3,
        duration: 800 + Math.random() * 600,
        ease: 'Sine.easeOut',
        onComplete: () => {
          spark.destroy()
        },
      })
    }
  }

  // ── Wall Glow Pulse ─────────────────────────────────────────────────

  private updateWallPulse(dt: number): void {
    this.wallPulseTimer += dt
    if (this.wallPulseTimer < this.nextWallPulseAt) return

    this.wallPulseTimer = 0
    this.nextWallPulseAt = this.randomRange(3000, 5000)

    if (this.wallSprites.length === 0) return

    const wall = this.wallSprites[Math.floor(Math.random() * this.wallSprites.length)]
    if (!wall?.active) return

    // Pulse alpha: 1.0 → 0.8 → 1.0 (dim briefly then restore)
    this.scene.tweens.add({
      targets: wall,
      alpha: 0.8,
      duration: 400,
      ease: 'Sine.easeInOut',
      yoyo: true,
    })
  }

  // ── Floor Parallax ──────────────────────────────────────────────────
  // Floor tiles shift slightly opposite to camera movement for depth.

  private updateParallax(): void {
    const cam = this.scene.cameras.main
    const dx = cam.scrollX - this.lastCamX
    const dy = cam.scrollY - this.lastCamY
    this.lastCamX = cam.scrollX
    this.lastCamY = cam.scrollY

    // No camera movement — skip
    if (dx === 0 && dy === 0) return

    // Very subtle: 2% opposite shift (0.02 factor)
    const factor = -0.02
    for (const tile of this.floorTiles) {
      if (!tile?.active) continue
      tile.x += dx * factor
      tile.y += dy * factor
    }
  }

  // ── Cleanup ─────────────────────────────────────────────────────────

  private cleanParticles(): void {
    this.particles = this.particles.filter(p => p?.active)
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.scene.events.off('update', this.update, this)

    for (const p of this.particles) {
      if (p?.active) p.destroy()
    }
    this.particles = []
    this.floorTiles = []
    this.wallSprites = []
  }

  private randomRange(min: number, max: number): number {
    return min + Math.random() * (max - min)
  }
}
