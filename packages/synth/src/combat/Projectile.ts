import Phaser from 'phaser'
import { PROJECTILE_SPEED, PROJECTILE_LIFETIME, TRAIL_INTERVAL_MS, TRAIL_FADE_MS, TEX, PROJECTILE_COLOR } from '../constants'
import type { ProjectileOwner } from '../types'
import { projectileTrail } from '../systems/VFX'

export class Projectile {
  sprite: Phaser.Physics.Arcade.Sprite
  owner: ProjectileOwner
  damage: number
  private timer: Phaser.Time.TimerEvent
  private trailTimer: Phaser.Time.TimerEvent

  constructor(scene: Phaser.Scene, x: number, y: number, angle: number, damage: number, owner: ProjectileOwner) {
    this.owner = owner
    this.damage = damage

    this.sprite = scene.physics.add.sprite(x, y, TEX.PROJECTILE)
    this.sprite.setData('projectile', this)

    const vx = Math.cos(angle) * PROJECTILE_SPEED
    const vy = Math.sin(angle) * PROJECTILE_SPEED
    this.sprite.setVelocity(vx, vy)

    this.timer = scene.time.delayedCall(PROJECTILE_LIFETIME, () => this.destroy())

    // Spawn afterimage trail every TRAIL_INTERVAL_MS
    this.trailTimer = scene.time.addEvent({
      delay: TRAIL_INTERVAL_MS,
      loop: true,
      callback: () => {
        if (this.sprite?.active) {
          projectileTrail(scene, this.sprite.x, this.sprite.y, PROJECTILE_COLOR, TRAIL_FADE_MS)
        }
      },
    })
  }

  destroy(): void {
    if (this.trailTimer) this.trailTimer.destroy()
    if (this.timer) this.timer.destroy()
    if (this.sprite?.active) this.sprite.destroy()
  }
}
