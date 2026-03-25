import Phaser from 'phaser'

const BUBBLE_DURATION = 3000
const BUBBLE_OFFSET_Y = -30

export class SpeechBubble {
  private text: Phaser.GameObjects.Text
  private timer: Phaser.Time.TimerEvent

  constructor(scene: Phaser.Scene, x: number, y: number, message: string) {
    this.text = scene.add.text(x, y + BUBBLE_OFFSET_Y, message, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(20)

    this.timer = scene.time.delayedCall(BUBBLE_DURATION, () => this.destroy())
  }

  updatePosition(x: number, y: number): void {
    if (this.text?.active) {
      this.text.setPosition(x, y + BUBBLE_OFFSET_Y)
    }
  }

  destroy(): void {
    if (this.timer) this.timer.destroy()
    if (this.text?.active) this.text.destroy()
  }
}
