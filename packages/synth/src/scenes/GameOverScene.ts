import Phaser from 'phaser'
import { debugAPI } from '../systems/DebugAPI'
import { awardRunPoints, loadMetaProgression, type RunResult } from '../systems/MetaProgression'
import { MetaTreeScreen } from '../ui/MetaTreeScreen'

export class GameOverScene extends Phaser.Scene {
  private won = false
  private bossDefeated = false
  private floorNumber = 1
  private roomIndex = 0
  private metaTreeScreen: MetaTreeScreen | null = null
  private restartBound = false

  constructor() {
    super({ key: 'GameOverScene' })
  }

  init(data: { won: boolean; bossDefeated?: boolean; floorNumber?: number; roomIndex?: number }): void {
    this.won = data.won
    this.bossDefeated = data.bossDefeated ?? false
    this.floorNumber = data.floorNumber ?? 1
    this.roomIndex = data.roomIndex ?? 0
  }

  create(): void {
    // ── Debug API: mark game over with win/loss result ──
    debugAPI.update({
      scene: 'gameover',
      gameOver: true,
      won: this.won,
    })
    const cx = this.cameras.main.centerX
    const cy = this.cameras.main.centerY

    // ── Award Synthesis Points for this run ──
    const floorsCleared = Math.max(this.floorNumber - 1, 0)
    const runResult: RunResult = {
      floorsCleared,
      bossKilled: this.bossDefeated,
      floorNumber: this.floorNumber,
    }
    const { pointsEarned, state: metaState } = awardRunPoints(runResult)

    this.restartBound = false

    if (this.won && this.bossDefeated) {
      // ── Special Boss Victory Screen ──
      this.cameras.main.setBackgroundColor('#0a0016')

      // Staggered title reveal
      const titleText = 'BOSS DESTROYED'
      const title = this.add.text(cx, cy - 90, titleText, {
        fontFamily: 'monospace',
        fontSize: '36px',
        color: '#cc44ff',
        fontStyle: 'bold',
      }).setOrigin(0.5).setAlpha(0)

      this.tweens.add({
        targets: title,
        alpha: 1,
        y: cy - 100,
        duration: 800,
        ease: 'Expo.easeOut',
      })

      // Subtitle
      const subtitle = this.add.text(cx, cy - 50, 'THE SYNTH CORE IS NEUTRALIZED', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#8844ff',
      }).setOrigin(0.5).setAlpha(0)

      this.tweens.add({
        targets: subtitle,
        alpha: 1,
        duration: 600,
        delay: 600,
        ease: 'Quad.easeOut',
      })

      // Decorative particles
      for (let i = 0; i < 20; i++) {
        const px = cx + (Math.random() - 0.5) * 300
        const py = cy + (Math.random() - 0.5) * 200
        const size = 1 + Math.random() * 2
        const p = this.add.circle(px, py, size, 0xcc44ff, 0.3 + Math.random() * 0.3)
        this.tweens.add({
          targets: p,
          y: py - 40 - Math.random() * 60,
          alpha: 0,
          duration: 2000 + Math.random() * 3000,
          ease: 'Sine.easeInOut',
          repeat: -1,
          yoyo: true,
          delay: Math.random() * 1000,
        })
      }

      // Victory stats
      const statsText = this.add.text(cx, cy, 'VICTORY', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#44ff88',
        fontStyle: 'bold',
      }).setOrigin(0.5).setAlpha(0)

      this.tweens.add({
        targets: statsText,
        alpha: 1,
        duration: 600,
        delay: 1200,
        ease: 'Quad.easeOut',
      })

      // Points earned
      this.showPointsEarned(cx, cy + 35, pointsEarned, metaState.synthesisPoints, 1400)

      // Spend Points button
      this.createSpendPointsButton(cx, cy + 70, 1800)

      // Restart prompt (delayed)
      const restart = this.add.text(cx, cy + 110, 'Press SPACE to play again', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#555555',
      }).setOrigin(0.5).setAlpha(0)

      this.tweens.add({
        targets: restart,
        alpha: 1,
        duration: 400,
        delay: 2200,
        ease: 'Quad.easeOut',
      })
    } else {
      // ── Standard Win/Lose Screen ──
      const title = this.won ? 'VICTORY' : 'DEFEAT'
      const color = this.won ? '#44ff88' : '#ff4444'

      this.add.text(cx, cy - 60, title, {
        fontFamily: 'monospace',
        fontSize: '48px',
        color,
      }).setOrigin(0.5)

      // Show floor and room info on defeat
      if (!this.won) {
        this.add.text(cx, cy - 10, `Floor ${this.floorNumber}, Room ${this.roomIndex + 1}`, {
          fontFamily: 'monospace',
          fontSize: '16px',
          color: '#aa6666',
        }).setOrigin(0.5)
      }

      // Points earned
      this.showPointsEarned(cx, cy + 15, pointsEarned, metaState.synthesisPoints, 200)

      // Spend Points button
      this.createSpendPointsButton(cx, cy + 50, 600)

      // Restart prompt
      const restartText = this.add.text(cx, cy + 90, 'Press SPACE to play again', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#666666',
      }).setOrigin(0.5).setAlpha(0)

      this.tweens.add({
        targets: restartText,
        alpha: 1,
        duration: 400,
        delay: 800,
        ease: 'Quad.easeOut',
      })
    }

    // Restart on SPACE (not pointer — pointer used for tree interaction)
    this.bindRestart()
  }

  // ── Points Earned Display ──────────────────────────────────────────

  private showPointsEarned(x: number, y: number, earned: number, total: number, delay: number): void {
    const earnedColor = earned > 0 ? '#ffaa44' : '#666666'
    const earnedStr = earned > 0 ? `+${earned} Synthesis Points` : 'No points earned'

    const earnedText = this.add.text(x, y, earnedStr, {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: earnedColor,
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0)

    this.tweens.add({
      targets: earnedText,
      alpha: 1,
      duration: 400,
      delay,
      ease: 'Quad.easeOut',
    })

    const totalText = this.add.text(x, y + 16, `Total: ${total} SP`, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#888888',
    }).setOrigin(0.5).setAlpha(0)

    this.tweens.add({
      targets: totalText,
      alpha: 1,
      duration: 400,
      delay: delay + 200,
      ease: 'Quad.easeOut',
    })
  }

  // ── Spend Points Button ────────────────────────────────────────────

  private createSpendPointsButton(x: number, y: number, delay: number): void {
    const meta = loadMetaProgression()
    const btnText = meta.synthesisPoints > 0 ? `SYNTHESIS TREE [${meta.synthesisPoints} SP]` : 'SYNTHESIS TREE'

    const bg = this.add.rectangle(x, y, 200, 28, 0x221133, 0.8)
      .setStrokeStyle(1, 0xcc44ff, 0.5)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0)

    const label = this.add.text(x, y, btnText, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#cc44ff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0)

    this.tweens.add({
      targets: [bg, label],
      alpha: 1,
      duration: 400,
      delay,
      ease: 'Quad.easeOut',
    })

    bg.on('pointerover', () => {
      bg.setFillStyle(0x331144, 1)
      bg.setStrokeStyle(2, 0xcc44ff, 0.9)
    })

    bg.on('pointerout', () => {
      bg.setFillStyle(0x221133, 0.8)
      bg.setStrokeStyle(1, 0xcc44ff, 0.5)
    })

    bg.on('pointerdown', () => {
      if (this.metaTreeScreen?.isActive()) return
      this.unbindRestart()
      this.metaTreeScreen = new MetaTreeScreen(this, () => {
        // Tree closed — rebind restart, update button label
        this.metaTreeScreen?.destroy()
        this.metaTreeScreen = null
        const updated = loadMetaProgression()
        const newLabel = updated.synthesisPoints > 0 ? `SYNTHESIS TREE [${updated.synthesisPoints} SP]` : 'SYNTHESIS TREE'
        label.setText(newLabel)
        this.bindRestart()
      })
      this.metaTreeScreen.show()
    })
  }

  // ── Restart Binding ────────────────────────────────────────────────

  private restartHandler = (): void => {
    if (this.metaTreeScreen?.isActive()) return
    this.scene.start('DungeonScene')
  }

  private bindRestart(): void {
    if (this.restartBound) return
    this.restartBound = true
    this.input.keyboard!.on('keydown-SPACE', this.restartHandler)
  }

  private unbindRestart(): void {
    if (!this.restartBound) return
    this.restartBound = false
    this.input.keyboard!.off('keydown-SPACE', this.restartHandler)
  }
}
