import Phaser from 'phaser'

// PoE/Diablo-style health bars:
// - Wider and thinner (40px enemies, 50px player/partner)
// - Dark background with 1px border outline
// - "Damage ghost" — old HP shows briefly as darker shade before fading
// - Boss health bar at top of screen (handled separately in Boss.ts)

const ENEMY_BAR_WIDTH = 40
const FRIENDLY_BAR_WIDTH = 50
const BAR_HEIGHT = 4
const BAR_OFFSET_Y = -20
const GHOST_FADE_MS = 600

export class HealthBar {
  private graphics: Phaser.GameObjects.Graphics
  private isEnemy: boolean
  private barWidth: number

  // Damage ghost state
  private ghostRatio = 1
  private targetRatio = 1
  private ghostFadeTimer = 0
  private ghostActive = false

  constructor(scene: Phaser.Scene, isEnemy = true) {
    this.graphics = scene.add.graphics()
    this.graphics.setDepth(10)
    this.isEnemy = isEnemy
    this.barWidth = isEnemy ? ENEMY_BAR_WIDTH : FRIENDLY_BAR_WIDTH
  }

  update(x: number, y: number, hp: number, maxHp: number, delta?: number): void {
    this.graphics.clear()

    const ratio = Math.max(0, hp / maxHp)
    const bx = x - this.barWidth / 2
    const by = y + BAR_OFFSET_Y

    // Track damage ghost: when HP drops, show the old value fading
    if (ratio < this.targetRatio) {
      // HP just dropped — start ghost
      this.ghostRatio = this.targetRatio
      this.ghostFadeTimer = GHOST_FADE_MS
      this.ghostActive = true
    }
    this.targetRatio = ratio

    // Fade ghost toward current HP
    if (this.ghostActive && delta !== undefined) {
      this.ghostFadeTimer -= delta
      if (this.ghostFadeTimer <= 0) {
        this.ghostRatio = ratio
        this.ghostActive = false
      } else {
        // Lerp ghost toward actual
        const t = 1 - (this.ghostFadeTimer / GHOST_FADE_MS)
        this.ghostRatio = this.ghostRatio + (ratio - this.ghostRatio) * t * 0.1
      }
    }

    // 1px dark outline (border)
    this.graphics.fillStyle(0x000000, 0.9)
    this.graphics.fillRect(bx - 1, by - 1, this.barWidth + 2, BAR_HEIGHT + 2)

    // Dark background bar
    this.graphics.fillStyle(0x0a0a0a, 0.85)
    this.graphics.fillRect(bx, by, this.barWidth, BAR_HEIGHT)

    if (ratio <= 0 && !this.ghostActive) return

    // Damage ghost bar (darker shade, visible briefly)
    if (this.ghostActive && this.ghostRatio > ratio) {
      const ghostWidth = this.barWidth * this.ghostRatio
      const ghostColor = this.isEnemy ? 0x661111 : 0x112244
      this.graphics.fillStyle(ghostColor, 0.7)
      this.graphics.fillRect(bx, by, ghostWidth, BAR_HEIGHT)
    }

    if (ratio <= 0) return

    const fillWidth = this.barWidth * ratio

    if (this.isEnemy) {
      // Enemy: red gradient (bright red top -> dark red bottom)
      const topColor = ratio > 0.5 ? 0xff4444 : ratio > 0.2 ? 0xffaa22 : 0xff2222
      const bottomColor = ratio > 0.5 ? 0xaa1111 : ratio > 0.2 ? 0x884400 : 0x880000

      // Top half (brighter)
      this.graphics.fillStyle(topColor, 1)
      this.graphics.fillRect(bx, by, fillWidth, BAR_HEIGHT / 2)

      // Bottom half (darker)
      this.graphics.fillStyle(bottomColor, 1)
      this.graphics.fillRect(bx, by + BAR_HEIGHT / 2, fillWidth, BAR_HEIGHT / 2)
    } else {
      // Player/partner: blue gradient
      const topColor = 0x4488ff
      const bottomColor = 0x2244aa

      this.graphics.fillStyle(topColor, 1)
      this.graphics.fillRect(bx, by, fillWidth, BAR_HEIGHT / 2)

      this.graphics.fillStyle(bottomColor, 1)
      this.graphics.fillRect(bx, by + BAR_HEIGHT / 2, fillWidth, BAR_HEIGHT / 2)
    }

    // Bright highlight line at top for glass effect
    this.graphics.fillStyle(0xffffff, 0.25)
    this.graphics.fillRect(bx, by, fillWidth, 1)
  }

  destroy(): void {
    this.graphics.destroy()
  }
}
