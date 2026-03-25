// SYNTH — Debug API
// Exposes game state to the browser console and external tools (e.g. AI Playtester).
// Mounted on `window.__SYNTH__` for programmatic access.

export interface SynthGameState {
  scene: 'boot' | 'dungeon' | 'gameover'
  elapsed: number          // seconds in current run
  player: { x: number; y: number; hp: number; maxHp: number; alive: boolean }
  partner: { x: number; y: number; hp: number; maxHp: number; alive: boolean; directive: string }
  enemies: Array<{ id: string; x: number; y: number; hp: number; maxHp: number; state: string; alive: boolean }>
  boss: { hp: number; maxHp: number; alive: boolean; phase: number } | null
  stats: { kills: number; damageDealt: number; damageTaken: number }
  gameOver: boolean
  won: boolean | null
}

// Minimal initial state — BootScene sets this before any gameplay
function createDefaultState(): SynthGameState {
  return {
    scene: 'boot',
    elapsed: 0,
    player: { x: 0, y: 0, hp: 0, maxHp: 0, alive: false },
    partner: { x: 0, y: 0, hp: 0, maxHp: 0, alive: false, directive: 'follow' },
    enemies: [],
    boss: null,
    stats: { kills: 0, damageDealt: 0, damageTaken: 0 },
    gameOver: false,
    won: null,
  }
}

export interface SynthDebugHandle {
  getState: () => SynthGameState
  pressKey: (key: string) => void
  releaseKey: (key: string) => void
  moveMouse: (x: number, y: number) => void
  click: () => void
  releaseClick: () => void
}

export class DebugAPI {
  private state: SynthGameState = createDefaultState()
  private game: Phaser.Game | null = null

  /** Merge partial state updates (called every frame from DungeonScene, once from GameOverScene) */
  update(data: Partial<SynthGameState>): void {
    Object.assign(this.state, data)
  }

  /** Bind to the Phaser Game instance (called once from BootScene) */
  bind(game: Phaser.Game): void {
    this.game = game
  }

  /** Mount the debug API on `window.__SYNTH__` */
  expose(): void {
    const handle: SynthDebugHandle = {
      getState: () => ({ ...this.state }),

      pressKey: (key: string) => {
        if (!this.game) return
        const activeScene = this.game.scene.getScenes(true)[0]
        if (!activeScene?.input?.keyboard) return
        // Dispatch a native keyboard event so Phaser's keyboard plugin picks it up
        const canvas = this.game.canvas
        canvas.dispatchEvent(new KeyboardEvent('keydown', {
          key,
          code: keyToCode(key),
          keyCode: keyToKeyCode(key),
          bubbles: true,
        }))
      },

      releaseKey: (key: string) => {
        if (!this.game) return
        const canvas = this.game.canvas
        canvas.dispatchEvent(new KeyboardEvent('keyup', {
          key,
          code: keyToCode(key),
          keyCode: keyToKeyCode(key),
          bubbles: true,
        }))
      },

      moveMouse: (x: number, y: number) => {
        if (!this.game) return
        const canvas = this.game.canvas
        const rect = canvas.getBoundingClientRect()
        canvas.dispatchEvent(new MouseEvent('mousemove', {
          clientX: rect.left + x,
          clientY: rect.top + y,
          bubbles: true,
        }))
      },

      click: () => {
        if (!this.game) return
        const canvas = this.game.canvas
        canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }))
        canvas.dispatchEvent(new MouseEvent('pointerdown', { button: 0, bubbles: true }))
      },

      releaseClick: () => {
        if (!this.game) return
        const canvas = this.game.canvas
        canvas.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }))
        canvas.dispatchEvent(new MouseEvent('pointerup', { button: 0, bubbles: true }))
      },
    }

    ;(window as any).__SYNTH__ = handle
  }
}

// ── Singleton ──

export const debugAPI = new DebugAPI()

// ── Helpers: key string → native event codes ──

function keyToCode(key: string): string {
  const map: Record<string, string> = {
    w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD',
    W: 'KeyW', A: 'KeyA', S: 'KeyS', D: 'KeyD',
    ' ': 'Space', Space: 'Space',
    ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown',
    ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
  }
  return map[key] ?? `Key${key.toUpperCase()}`
}

function keyToKeyCode(key: string): number {
  const map: Record<string, number> = {
    w: 87, a: 65, s: 83, d: 68,
    W: 87, A: 65, S: 83, D: 68,
    ' ': 32, Space: 32,
    ArrowUp: 38, ArrowDown: 40,
    ArrowLeft: 37, ArrowRight: 39,
  }
  return map[key] ?? key.toUpperCase().charCodeAt(0)
}

// ── Window type augmentation ──

declare global {
  interface Window {
    __SYNTH__: SynthDebugHandle | undefined
  }
}
