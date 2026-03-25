import Phaser from 'phaser'
import { preloadTextures, generateTextures, setDissolutionLevel } from '../ui/TextureFactory'
import { debugAPI } from '../systems/DebugAPI'

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload(): void {
    preloadTextures(this)
  }

  create(): void {
    setDissolutionLevel(1)  // Floor 1: mostly coherent
    generateTextures(this)  // Latent dissolution procedural sprites

    // ── Debug API: bind to Phaser game + expose on window ──
    debugAPI.bind(this.game)
    debugAPI.update({ scene: 'boot' })
    debugAPI.expose()

    this.scene.start('DungeonScene')
  }
}
