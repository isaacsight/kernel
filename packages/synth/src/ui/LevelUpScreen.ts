// SYNTH — Level Up Overlay
// Pauses the game, dims the screen, presents 3 upgrade cards.
// Player clicks or presses 1/2/3 to choose. Game resumes.

import Phaser from 'phaser'
import type { Upgrade, UpgradeId } from '../systems/Progression'

type SelectionCallback = (upgrade: Upgrade) => void

export class LevelUpScreen {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private onSelect: SelectionCallback
  private keys: Phaser.Input.Keyboard.Key[] = []
  private active = false
  private upgrades: Upgrade[] = []

  constructor(scene: Phaser.Scene, onSelect: SelectionCallback) {
    this.scene = scene
    this.onSelect = onSelect

    // Container holds all overlay elements — hidden by default
    this.container = scene.add.container(0, 0).setDepth(200).setScrollFactor(0).setVisible(false)
  }

  /**
   * Show the level-up screen with the given upgrade choices.
   * Pauses the physics world.
   */
  show(newLevel: number, choices: Upgrade[]): void {
    if (this.active) return
    this.active = true
    this.upgrades = choices

    // Pause physics
    this.scene.physics.world.pause()

    const w = this.scene.cameras.main.width
    const h = this.scene.cameras.main.height

    // ── Dim overlay ──
    const dimBg = this.scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.7)
    this.container.add(dimBg)

    // ── "LEVEL UP" title with glow ──
    const titleY = h * 0.2

    // Glow behind text
    const glow = this.scene.add.circle(w / 2, titleY, 60, 0xffff44, 0.12)
    this.container.add(glow)
    this.scene.tweens.add({
      targets: glow,
      scale: 1.6,
      alpha: 0.05,
      duration: 1000,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    })

    const title = this.scene.add.text(w / 2, titleY, 'LEVEL UP', {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#ffff44',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    this.container.add(title)

    // Level indicator
    const levelText = this.scene.add.text(w / 2, titleY + 28, `Level ${newLevel}`, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#aaaaaa',
    }).setOrigin(0.5)
    this.container.add(levelText)

    // ── Upgrade cards ──
    const cardW = 120
    const cardH = 110
    const gap = 16
    const totalW = cardW * 3 + gap * 2
    const startX = (w - totalW) / 2
    const cardY = h * 0.48

    for (let i = 0; i < choices.length; i++) {
      const upgrade = choices[i]
      const cx = startX + i * (cardW + gap) + cardW / 2
      const cy = cardY

      this.createCard(cx, cy, cardW, cardH, upgrade, i)
    }

    // ── Hint text ──
    const hint = this.scene.add.text(w / 2, h * 0.82, 'Click a card  or  press  1 / 2 / 3', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#666666',
    }).setOrigin(0.5)
    this.container.add(hint)

    // ── Keyboard bindings (1, 2, 3) ──
    const kb = this.scene.input.keyboard!
    this.keys = [
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
    ]

    for (let i = 0; i < this.keys.length; i++) {
      const idx = i
      this.keys[i].once('down', () => this.selectUpgrade(idx))
    }

    // ── Entrance animation ──
    this.container.setVisible(true)
    this.container.setAlpha(0)
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 250,
      ease: 'Cubic.easeOut',
    })
  }

  private createCard(
    cx: number, cy: number,
    cardW: number, cardH: number,
    upgrade: Upgrade, index: number,
  ): void {
    const colorStr = `#${upgrade.color.toString(16).padStart(6, '0')}`

    // Card background
    const bg = this.scene.add.rectangle(cx, cy, cardW, cardH, 0x111122, 0.9)
      .setStrokeStyle(1, upgrade.color, 0.6)
    this.container.add(bg)

    // Key number
    const keyLabel = this.scene.add.text(cx, cy - cardH / 2 + 12, `${index + 1}`, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#555555',
    }).setOrigin(0.5)
    this.container.add(keyLabel)

    // Icon dot
    const dot = this.scene.add.circle(cx, cy - 14, 6, upgrade.color, 0.8)
    this.container.add(dot)

    // Title
    const name = this.scene.add.text(cx, cy + 8, upgrade.name, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: colorStr,
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: cardW - 12 },
    }).setOrigin(0.5)
    this.container.add(name)

    // Description
    const desc = this.scene.add.text(cx, cy + 30, upgrade.description, {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#999999',
      align: 'center',
      wordWrap: { width: cardW - 16 },
    }).setOrigin(0.5)
    this.container.add(desc)

    // ── Interactive hover & click ──
    bg.setInteractive({ useHandCursor: true })

    bg.on('pointerover', () => {
      bg.setFillStyle(0x222244, 1)
      bg.setStrokeStyle(2, upgrade.color, 1)
      this.scene.tweens.add({ targets: bg, scaleX: 1.05, scaleY: 1.05, duration: 80, ease: 'Cubic.easeOut' })
    })

    bg.on('pointerout', () => {
      bg.setFillStyle(0x111122, 0.9)
      bg.setStrokeStyle(1, upgrade.color, 0.6)
      this.scene.tweens.add({ targets: bg, scaleX: 1, scaleY: 1, duration: 80, ease: 'Cubic.easeOut' })
    })

    bg.on('pointerdown', () => {
      this.selectUpgrade(index)
    })
  }

  private selectUpgrade(index: number): void {
    if (!this.active) return
    if (index < 0 || index >= this.upgrades.length) return
    this.active = false

    const chosen = this.upgrades[index]

    // Exit animation then clean up
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 200,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.cleanup()
        this.onSelect(chosen)
      },
    })
  }

  private cleanup(): void {
    // Remove key listeners
    for (const key of this.keys) {
      key.removeAllListeners()
      this.scene.input.keyboard!.removeKey(key.keyCode)
    }
    this.keys = []

    // Destroy all children
    this.container.removeAll(true)
    this.container.setVisible(false)

    // Resume physics
    this.scene.physics.world.resume()
  }

  isActive(): boolean {
    return this.active
  }

  /**
   * Get the currently shown upgrade choices (used externally if needed).
   */
  getUpgrades(): Upgrade[] {
    return this.upgrades
  }

  destroy(): void {
    this.cleanup()
    this.container.destroy()
  }
}
