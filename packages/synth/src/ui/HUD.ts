import Phaser from 'phaser'

// PoE/Dota-style HUD:
// - Health/mana bars at bottom-left corners, not top-left text
// - Player health bar with icon, partner below
// - Enemy count + floor number centered top with dark panel
// - "FLOOR N" displayed like a Diablo act header
// - XP bar at bottom (thin, full-width, gold fill)

const HUD_TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '12px',
  color: '#ffffff',
  shadow: {
    offsetX: 1,
    offsetY: 1,
    color: '#000000',
    blur: 3,
    fill: true,
    stroke: true,
  },
}

const HP_BAR_WIDTH = 120
const HP_BAR_HEIGHT = 10
const MANA_BAR_HEIGHT = 6
const XP_BAR_HEIGHT = 3

export class HUD {
  private scene: Phaser.Scene

  // Bottom-left health bars
  private playerBarBg: Phaser.GameObjects.Rectangle
  private playerBarFill: Phaser.GameObjects.Rectangle
  private playerBarGhost: Phaser.GameObjects.Rectangle
  private playerBarHighlight: Phaser.GameObjects.Rectangle
  private playerLabel: Phaser.GameObjects.Text
  private playerHpText: Phaser.GameObjects.Text

  private partnerBarBg: Phaser.GameObjects.Rectangle
  private partnerBarFill: Phaser.GameObjects.Rectangle
  private partnerBarGhost: Phaser.GameObjects.Rectangle
  private partnerBarHighlight: Phaser.GameObjects.Rectangle
  private partnerLabel: Phaser.GameObjects.Text
  private partnerHpText: Phaser.GameObjects.Text

  // Top center panel
  private topPanel: Phaser.GameObjects.Rectangle
  private floorText: Phaser.GameObjects.Text
  private floorUnderline: Phaser.GameObjects.Rectangle
  private enemyText: Phaser.GameObjects.Text

  // XP bar at bottom
  private xpBarBg: Phaser.GameObjects.Rectangle
  private xpBarFill: Phaser.GameObjects.Rectangle

  // Weapon indicator (bottom-right)
  private weaponPanel: Phaser.GameObjects.Rectangle
  private weaponNameText: Phaser.GameObjects.Text
  private weaponIcon: Phaser.GameObjects.Arc
  private weaponHintText: Phaser.GameObjects.Text

  // Damage ghost tracking
  private playerGhostRatio = 1
  private playerGhostTimer = 0
  private partnerGhostRatio = 1
  private partnerGhostTimer = 0
  private prevPlayerRatio = 1
  private prevPartnerRatio = 1

  constructor(scene: Phaser.Scene, floorNumber = 1) {
    this.scene = scene
    const cam = scene.cameras.main
    const w = cam.width
    const h = cam.height

    // ── Bottom-left: Player health bar ──
    const barX = 16
    const barY = h - 48

    // Player bar outline
    scene.add.rectangle(barX + HP_BAR_WIDTH / 2 - 1, barY + HP_BAR_HEIGHT / 2 - 1,
      HP_BAR_WIDTH + 2, HP_BAR_HEIGHT + 2, 0x000000, 0.8)
      .setDepth(50).setScrollFactor(0)

    this.playerBarBg = scene.add.rectangle(barX + HP_BAR_WIDTH / 2, barY + HP_BAR_HEIGHT / 2,
      HP_BAR_WIDTH, HP_BAR_HEIGHT, 0x111111, 0.85)
      .setDepth(50).setScrollFactor(0)

    this.playerBarGhost = scene.add.rectangle(barX, barY + HP_BAR_HEIGHT / 2,
      HP_BAR_WIDTH, HP_BAR_HEIGHT, 0x662222, 0.6)
      .setDepth(50).setScrollFactor(0).setOrigin(0, 0.5)

    this.playerBarFill = scene.add.rectangle(barX, barY + HP_BAR_HEIGHT / 2,
      HP_BAR_WIDTH, HP_BAR_HEIGHT, 0x4488ff, 1)
      .setDepth(51).setScrollFactor(0).setOrigin(0, 0.5)

    this.playerBarHighlight = scene.add.rectangle(barX, barY,
      HP_BAR_WIDTH, 2, 0xffffff, 0.2)
      .setDepth(52).setScrollFactor(0).setOrigin(0, 0)

    this.playerLabel = scene.add.text(barX, barY - 14, 'YOU', {
      ...HUD_TEXT_STYLE, fontSize: '10px', color: '#88bbff',
    }).setDepth(50).setScrollFactor(0)

    this.playerHpText = scene.add.text(barX + HP_BAR_WIDTH + 6, barY + HP_BAR_HEIGHT / 2 - 1, '', {
      ...HUD_TEXT_STYLE, fontSize: '9px',
    }).setDepth(50).setScrollFactor(0).setOrigin(0, 0.5)

    // ── Partner health bar (below player) ──
    const partnerY = barY + HP_BAR_HEIGHT + 8

    scene.add.rectangle(barX + HP_BAR_WIDTH / 2 - 1, partnerY + MANA_BAR_HEIGHT / 2 - 1,
      HP_BAR_WIDTH + 2, MANA_BAR_HEIGHT + 2, 0x000000, 0.8)
      .setDepth(50).setScrollFactor(0)

    this.partnerBarBg = scene.add.rectangle(barX + HP_BAR_WIDTH / 2, partnerY + MANA_BAR_HEIGHT / 2,
      HP_BAR_WIDTH, MANA_BAR_HEIGHT, 0x111111, 0.85)
      .setDepth(50).setScrollFactor(0)

    this.partnerBarGhost = scene.add.rectangle(barX, partnerY + MANA_BAR_HEIGHT / 2,
      HP_BAR_WIDTH, MANA_BAR_HEIGHT, 0x224422, 0.6)
      .setDepth(50).setScrollFactor(0).setOrigin(0, 0.5)

    this.partnerBarFill = scene.add.rectangle(barX, partnerY + MANA_BAR_HEIGHT / 2,
      HP_BAR_WIDTH, MANA_BAR_HEIGHT, 0x44ff88, 1)
      .setDepth(51).setScrollFactor(0).setOrigin(0, 0.5)

    this.partnerBarHighlight = scene.add.rectangle(barX, partnerY,
      HP_BAR_WIDTH, 1, 0xffffff, 0.15)
      .setDepth(52).setScrollFactor(0).setOrigin(0, 0)

    this.partnerLabel = scene.add.text(barX, partnerY - 12, 'SYNTH', {
      ...HUD_TEXT_STYLE, fontSize: '9px', color: '#88ffbb',
    }).setDepth(50).setScrollFactor(0)

    this.partnerHpText = scene.add.text(barX + HP_BAR_WIDTH + 6, partnerY + MANA_BAR_HEIGHT / 2 - 1, '', {
      ...HUD_TEXT_STYLE, fontSize: '8px',
    }).setDepth(50).setScrollFactor(0).setOrigin(0, 0.5)

    // ── Top center: Floor header + enemy count ──
    this.topPanel = scene.add.rectangle(w / 2, 16, 200, 36, 0x000000, 0.5)
      .setDepth(49).setScrollFactor(0)

    this.floorText = scene.add.text(
      w / 2, 8,
      `FLOOR ${floorNumber}`,
      {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#cccccc',
        fontStyle: 'bold',
        shadow: {
          offsetX: 0,
          offsetY: 0,
          color: '#000000',
          blur: 6,
          fill: true,
          stroke: true,
        },
      },
    ).setOrigin(0.5, 0).setDepth(50).setScrollFactor(0)

    // Underline for Diablo act-header style
    this.floorUnderline = scene.add.rectangle(
      w / 2, 27, 80, 1, 0x888888, 0.4,
    ).setDepth(50).setScrollFactor(0)

    this.enemyText = scene.add.text(w / 2, 30, '', {
      ...HUD_TEXT_STYLE,
      fontSize: '11px',
      color: '#ff6644',
    }).setOrigin(0.5, 0).setDepth(50).setScrollFactor(0)

    // ── Bottom-right: Weapon indicator ──
    const wepX = w - 16
    const wepY = h - 48

    this.weaponPanel = scene.add.rectangle(wepX - 50, wepY + 4, 110, 30, 0x000000, 0.5)
      .setDepth(49).setScrollFactor(0)

    this.weaponIcon = scene.add.circle(wepX - 96, wepY + 4, 5, 0x44aaff, 1)
      .setDepth(51).setScrollFactor(0)

    this.weaponNameText = scene.add.text(wepX - 86, wepY + 4, 'PULSE', {
      ...HUD_TEXT_STYLE,
      fontSize: '12px',
      color: '#44aaff',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(51).setScrollFactor(0)

    this.weaponHintText = scene.add.text(wepX - 96, wepY + 18, '[Q] switch  [E] special', {
      ...HUD_TEXT_STYLE,
      fontSize: '7px',
      color: '#666666',
    }).setOrigin(0, 0.5).setDepth(50).setScrollFactor(0)

    // ── XP bar at very bottom ──
    this.xpBarBg = scene.add.rectangle(w / 2, h - 2, w, XP_BAR_HEIGHT, 0x111111, 0.6)
      .setDepth(50).setScrollFactor(0)

    this.xpBarFill = scene.add.rectangle(0, h - 2, 0, XP_BAR_HEIGHT, 0xddaa44, 0.8)
      .setDepth(51).setScrollFactor(0).setOrigin(0, 0.5)
  }

  update(playerHp: number, playerMax: number, partnerHp: number, partnerMax: number, enemyCount: number, xpRatio = 0): void {
    const playerRatio = Math.max(0, playerHp / playerMax)
    const partnerRatio = Math.max(0, partnerHp / partnerMax)

    // Damage ghost for player
    if (playerRatio < this.prevPlayerRatio) {
      this.playerGhostRatio = this.prevPlayerRatio
      this.playerGhostTimer = 600
    }
    if (this.playerGhostTimer > 0) {
      this.playerGhostTimer -= 16 // approx per frame
      this.playerGhostRatio = this.playerGhostRatio + (playerRatio - this.playerGhostRatio) * 0.05
    } else {
      this.playerGhostRatio = playerRatio
    }
    this.prevPlayerRatio = playerRatio

    // Damage ghost for partner
    if (partnerRatio < this.prevPartnerRatio) {
      this.partnerGhostRatio = this.prevPartnerRatio
      this.partnerGhostTimer = 600
    }
    if (this.partnerGhostTimer > 0) {
      this.partnerGhostTimer -= 16
      this.partnerGhostRatio = this.partnerGhostRatio + (partnerRatio - this.partnerGhostRatio) * 0.05
    } else {
      this.partnerGhostRatio = partnerRatio
    }
    this.prevPartnerRatio = partnerRatio

    // Player bar
    this.playerBarFill.setDisplaySize(HP_BAR_WIDTH * playerRatio, HP_BAR_HEIGHT)
    this.playerBarGhost.setDisplaySize(HP_BAR_WIDTH * this.playerGhostRatio, HP_BAR_HEIGHT)
    this.playerBarHighlight.setDisplaySize(HP_BAR_WIDTH * playerRatio, 2)

    // Player bar color based on HP
    if (playerRatio > 0.5) {
      this.playerBarFill.setFillStyle(0x4488ff, 1)
    } else if (playerRatio > 0.2) {
      this.playerBarFill.setFillStyle(0xffaa22, 1)
    } else {
      this.playerBarFill.setFillStyle(0xff2222, 1)
    }

    this.playerHpText.setText(`${Math.max(0, Math.ceil(playerHp))}`)

    // Partner bar
    this.partnerBarFill.setDisplaySize(HP_BAR_WIDTH * partnerRatio, MANA_BAR_HEIGHT)
    this.partnerBarGhost.setDisplaySize(HP_BAR_WIDTH * this.partnerGhostRatio, MANA_BAR_HEIGHT)
    this.partnerBarHighlight.setDisplaySize(HP_BAR_WIDTH * partnerRatio, 1)
    this.partnerHpText.setText(`${Math.max(0, Math.ceil(partnerHp))}`)

    // Enemy count
    if (enemyCount > 0) {
      this.enemyText.setText(`${enemyCount} REMAINING`)
      this.enemyText.setVisible(true)
    } else {
      this.enemyText.setText('CLEAR')
      this.enemyText.setColor('#44ff88')
    }

    // XP bar
    const camW = this.scene.cameras.main.width
    this.xpBarFill.setDisplaySize(camW * Math.min(1, xpRatio), XP_BAR_HEIGHT)
  }

  setFloor(floorNumber: number): void {
    this.floorText.setText(`FLOOR ${floorNumber}`)

    // Dramatic entrance like Diablo act transition
    this.floorText.setScale(1.8)
    this.floorText.setAlpha(1)
    this.scene.tweens.add({
      targets: this.floorText,
      scaleX: 1,
      scaleY: 1,
      duration: 600,
      ease: 'Back.easeOut',
    })
  }

  setXP(ratio: number): void {
    const camW = this.scene.cameras.main.width
    this.xpBarFill.setDisplaySize(camW * Math.min(1, ratio), XP_BAR_HEIGHT)
  }

  /** Update the weapon indicator display */
  setWeapon(name: string, color: number): void {
    const colorStr = `#${color.toString(16).padStart(6, '0')}`
    this.weaponNameText.setText(name.toUpperCase())
    this.weaponNameText.setColor(colorStr)
    this.weaponIcon.setFillStyle(color, 1)

    // Pop animation on weapon switch
    this.weaponNameText.setScale(1.3)
    this.scene.tweens.add({
      targets: this.weaponNameText,
      scaleX: 1,
      scaleY: 1,
      duration: 200,
      ease: 'Back.easeOut',
    })
    this.weaponIcon.setScale(1.5)
    this.scene.tweens.add({
      targets: this.weaponIcon,
      scaleX: 1,
      scaleY: 1,
      duration: 200,
      ease: 'Back.easeOut',
    })
  }
}
