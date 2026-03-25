import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { DungeonScene } from './scenes/DungeonScene'
import { GameOverScene } from './scenes/GameOverScene'

/** Create and return a Phaser game instance. If parent is provided, mount into that element. */
export function createSynthGame(parent?: string | HTMLElement): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 640,
    backgroundColor: '#050510',  // Deep dark blue-black — the void of latent space
    pixelArt: true,
    parent: parent ?? document.body,
    physics: {
      default: 'arcade',
      arcade: { debug: false },
    },
    scene: [BootScene, DungeonScene, GameOverScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  }

  return new Phaser.Game(config)
}

// Standalone mode: auto-mount when loaded directly (not imported as module)
if (!window.__SYNTH_EMBEDDED__) {
  createSynthGame()
}

// Type augmentation for the embedded flag
declare global {
  interface Window {
    __SYNTH_EMBEDDED__: boolean | undefined
  }
}
