// SYNTH — Floor Modifier Selection Screen
// Shown between floors. Player picks which modifiers to accept (risk/reward).
// Similar to LevelUpScreen but with toggle-style accept/reject cards.

import Phaser from 'phaser'
import type { FloorModifierDef } from '../systems/FloorModifiers'

type DoneCallback = (accepted: FloorModifierDef[]) => void

export class FloorModifierScreen {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private onDone: DoneCallback
  private active = false
  private choices: FloorModifierDef[] = []
  /** Track which modifiers the player has toggled ON */
  private accepted: Set<number> = new Set()
  /** Card background rects for toggling visual state */
  private cardBgs: Phaser.GameObjects.Rectangle[] = []
  /** Confirm key listener */
  private confirmKey: Phaser.Input.Keyboard.Key | null = null

  constructor(scene: Phaser.Scene, onDone: DoneCallback) {
    this.scene = scene
    this.onDone = onDone
    this.container = scene.add.container(0, 0).setDepth(200).setScrollFactor(0).setVisible(false)
  }

  /**
   * Show the floor modifier selection screen.
   * Pauses physics. Player toggles modifiers on/off, then confirms.
   */
  show(floorNumber: number, choices: FloorModifierDef[]): void {
    if (this.active) return
    this.active = true
    this.choices = choices
    this.accepted.clear()
    this.cardBgs = []

    // Pause physics
    this.scene.physics.world.pause()

    const w = this.scene.cameras.main.width
    const h = this.scene.cameras.main.height

    // ── Dim overlay ──
    const dimBg = this.scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.8)
    this.container.add(dimBg)

    // ── Title ──
    const titleY = h * 0.12

    // Glow behind title
    const glow = this.scene.add.circle(w / 2, titleY, 50, 0xff4444, 0.08)
    this.container.add(glow)
    this.scene.tweens.add({
      targets: glow,
      scale: 1.4,
      alpha: 0.03,
      duration: 1200,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    })

    const title = this.scene.add.text(w / 2, titleY, `FLOOR ${floorNumber}`, {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#ff6644',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    this.container.add(title)

    const subtitle = this.scene.add.text(w / 2, titleY + 24, 'Choose your risk', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#888888',
    }).setOrigin(0.5)
    this.container.add(subtitle)

    // ── Modifier cards ──
    const cardW = 110
    const cardH = 120
    const gap = 10
    const totalW = cardW * choices.length + gap * (choices.length - 1)
    const startX = (w - totalW) / 2
    const cardY = h * 0.48

    for (let i = 0; i < choices.length; i++) {
      const mod = choices[i]
      const cx = startX + i * (cardW + gap) + cardW / 2
      this.createModCard(cx, cardY, cardW, cardH, mod, i)
    }

    // ── "Proceed" button ──
    const btnY = h * 0.82
    const btnW = 140
    const btnH = 30

    const btnBg = this.scene.add.rectangle(w / 2, btnY, btnW, btnH, 0x224422, 0.9)
      .setStrokeStyle(1, 0x44ff88, 0.6)
    this.container.add(btnBg)

    const btnText = this.scene.add.text(w / 2, btnY, 'PROCEED  [Enter]', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#44ff88',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    this.container.add(btnText)

    btnBg.setInteractive({ useHandCursor: true })
    btnBg.on('pointerover', () => {
      btnBg.setFillStyle(0x336633, 1)
      btnBg.setStrokeStyle(2, 0x44ff88, 1)
    })
    btnBg.on('pointerout', () => {
      btnBg.setFillStyle(0x224422, 0.9)
      btnBg.setStrokeStyle(1, 0x44ff88, 0.6)
    })
    btnBg.on('pointerdown', () => {
      this.confirm()
    })

    // ── Hint text ──
    const hint = this.scene.add.text(w / 2, h * 0.92, 'Click cards to toggle  ·  more risk = more reward', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#555555',
    }).setOrigin(0.5)
    this.container.add(hint)

    // ── Keyboard: Enter to confirm ──
    const kb = this.scene.input.keyboard!
    this.confirmKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
    this.confirmKey.once('down', () => this.confirm())

    // ── Number keys to toggle (1-5) ──
    const numKeys = [
      Phaser.Input.Keyboard.KeyCodes.ONE,
      Phaser.Input.Keyboard.KeyCodes.TWO,
      Phaser.Input.Keyboard.KeyCodes.THREE,
      Phaser.Input.Keyboard.KeyCodes.FOUR,
      Phaser.Input.Keyboard.KeyCodes.FIVE,
    ]
    for (let i = 0; i < Math.min(choices.length, numKeys.length); i++) {
      const key = kb.addKey(numKeys[i])
      const idx = i
      key.on('down', () => {
        if (this.active) this.toggleModifier(idx)
      })
    }

    // ── Entrance animation ──
    this.container.setVisible(true)
    this.container.setAlpha(0)
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 300,
      ease: 'Cubic.easeOut',
    })
  }

  private createModCard(
    cx: number, cy: number,
    cardW: number, cardH: number,
    mod: FloorModifierDef, index: number,
  ): void {
    const colorStr = `#${mod.color.toString(16).padStart(6, '0')}`

    // Card background — starts dim (not selected)
    const bg = this.scene.add.rectangle(cx, cy, cardW, cardH, 0x111122, 0.7)
      .setStrokeStyle(1, mod.color, 0.3)
    this.container.add(bg)
    this.cardBgs.push(bg)

    // Key number
    const keyLabel = this.scene.add.text(cx - cardW / 2 + 8, cy - cardH / 2 + 6, `${index + 1}`, {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#444444',
    }).setOrigin(0)
    this.container.add(keyLabel)

    // Icon
    const icon = this.scene.add.text(cx, cy - 30, mod.icon, {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: colorStr,
      fontStyle: 'bold',
    }).setOrigin(0.5)
    this.container.add(icon)

    // Name
    const name = this.scene.add.text(cx, cy - 8, mod.name, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: colorStr,
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: cardW - 8 },
    }).setOrigin(0.5)
    this.container.add(name)

    // Description — split on newlines for clean layout
    const descText = mod.description.replace(/\n/g, ' ')
    const desc = this.scene.add.text(cx, cy + 16, descText, {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#888888',
      align: 'center',
      wordWrap: { width: cardW - 12 },
    }).setOrigin(0.5)
    this.container.add(desc)

    // ── Click to toggle ──
    bg.setInteractive({ useHandCursor: true })

    bg.on('pointerover', () => {
      if (!this.active) return
      const isOn = this.accepted.has(index)
      bg.setStrokeStyle(2, mod.color, isOn ? 1 : 0.7)
      this.scene.tweens.add({ targets: bg, scaleX: 1.04, scaleY: 1.04, duration: 60, ease: 'Cubic.easeOut' })
    })

    bg.on('pointerout', () => {
      if (!this.active) return
      const isOn = this.accepted.has(index)
      bg.setStrokeStyle(isOn ? 2 : 1, mod.color, isOn ? 0.9 : 0.3)
      this.scene.tweens.add({ targets: bg, scaleX: 1, scaleY: 1, duration: 60, ease: 'Cubic.easeOut' })
    })

    bg.on('pointerdown', () => {
      if (!this.active) return
      this.toggleModifier(index)
    })
  }

  private toggleModifier(index: number): void {
    if (index < 0 || index >= this.choices.length) return

    if (this.accepted.has(index)) {
      this.accepted.delete(index)
    } else {
      this.accepted.add(index)
    }

    // Update card visual
    const bg = this.cardBgs[index]
    const mod = this.choices[index]
    if (!bg || !mod) return

    const isOn = this.accepted.has(index)
    if (isOn) {
      bg.setFillStyle(0x221133, 0.95)
      bg.setStrokeStyle(2, mod.color, 0.9)
    } else {
      bg.setFillStyle(0x111122, 0.7)
      bg.setStrokeStyle(1, mod.color, 0.3)
    }
  }

  private confirm(): void {
    if (!this.active) return
    this.active = false

    // Gather accepted modifiers
    const acceptedMods: FloorModifierDef[] = []
    for (const idx of this.accepted) {
      if (this.choices[idx]) {
        acceptedMods.push(this.choices[idx])
      }
    }

    // Exit animation then clean up
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 200,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.cleanup()
        this.onDone(acceptedMods)
      },
    })
  }

  private cleanup(): void {
    // Remove key listeners
    if (this.confirmKey) {
      this.confirmKey.removeAllListeners()
      this.scene.input.keyboard!.removeKey(this.confirmKey.keyCode)
      this.confirmKey = null
    }

    // Remove number key listeners (1-5)
    const numKeys = [
      Phaser.Input.Keyboard.KeyCodes.ONE,
      Phaser.Input.Keyboard.KeyCodes.TWO,
      Phaser.Input.Keyboard.KeyCodes.THREE,
      Phaser.Input.Keyboard.KeyCodes.FOUR,
      Phaser.Input.Keyboard.KeyCodes.FIVE,
    ]
    for (const kc of numKeys) {
      this.scene.input.keyboard!.removeKey(kc)
    }

    // Destroy all children
    this.container.removeAll(true)
    this.container.setVisible(false)
    this.cardBgs = []

    // Resume physics
    this.scene.physics.world.resume()
  }

  isActive(): boolean {
    return this.active
  }

  destroy(): void {
    this.cleanup()
    this.container.destroy()
  }
}
