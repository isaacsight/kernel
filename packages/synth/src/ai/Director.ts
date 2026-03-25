// SYNTH — AI Director (Left 4 Dead-style pacing)
//
// Manages tension and pacing. The game should have RHYTHM:
// build up -> peak -> release -> breathe -> repeat.
// All client-side, zero API calls.

import type { Vec2 } from '../types'

// ── Tension Wave ─────────────────────────────────────────────────────
// The Director creates tension WAVES on top of the reactive tension.
// Wave cycle: ~30s build, ~10s peak, ~20s release = ~60s full cycle.

const WAVE_CYCLE_MS = 60_000
const WAVE_BUILD_RATIO = 0.5        // 50% of cycle is build
const WAVE_PEAK_RATIO = 0.17        // 17% is peak
// remaining 33% is release/breathe

// ── Tension factors ──────────────────────────────────────────────────

const TENSION_LERP_SPEED = 0.003    // how fast tension moves toward target per ms
const TENSION_DECAY_RATE = 0.02     // tension decays this much per second when idle

// Factor weights (sum to ~1.0)
const W_ENEMY_COUNT = 0.25
const W_PLAYER_HP = 0.25
const W_PARTNER_HP = 0.15
const W_TIME_SINCE_KILL = 0.15
const W_TIME_SINCE_DAMAGE = 0.10
const W_WAVE = 0.10

// ── Spawn control thresholds ─────────────────────────────────────────

const HIGH_TENSION = 0.7
const LOW_TENSION = 0.3
const SPAWN_COOLDOWN_MS = 3000      // min time between Director spawns
const HEALTH_DROP_COOLDOWN_MS = 8000

export interface DirectorState {
  /** Current tension 0-1 */
  tension: number
  /** Raw reactive tension before wave overlay */
  reactiveTension: number
  /** Wave contribution 0-1 */
  waveValue: number
  /** Current phase of the tension wave */
  phase: 'build' | 'peak' | 'release' | 'breathe'
  /** Whether the Director wants to spawn enemies */
  shouldSpawnEnemies: boolean
  /** How many enemies the Director recommends spawning (0 = none) */
  spawnCount: number
  /** Whether the Director wants to drop a health pickup */
  shouldDropHealth: boolean
  /** Position hint for health drop (near player) */
  healthDropPosition: Vec2 | null
  /** Recommended partner posture: conservative or aggressive */
  partnerPosture: 'conservative' | 'aggressive' | 'normal'
  /** Enemy aggression multiplier (0.5-1.5) */
  enemyAggressionMod: number
}

export interface DirectorInput {
  enemyCount: number
  maxExpectedEnemies: number    // room capacity
  playerHp: number
  playerMaxHp: number
  partnerHp: number
  partnerMaxHp: number
  timeSinceLastKillMs: number
  timeSinceLastDamageTakenMs: number
  playerPosition: Vec2
  elapsedMs: number
}

class AIDirector {
  private tension = 0.5
  private targetTension = 0.5
  private waveOffset = 0           // randomized start offset per run
  private lastSpawnTime = 0
  private lastHealthDropTime = 0
  private totalElapsed = 0

  /** Call once at the start of each run to randomize wave phase */
  reset(): void {
    this.tension = 0.3
    this.targetTension = 0.3
    this.waveOffset = Math.random() * WAVE_CYCLE_MS
    this.lastSpawnTime = 0
    this.lastHealthDropTime = 0
    this.totalElapsed = 0
  }

  /** Call every frame with current game state. Returns the Director's recommendations. */
  update(input: DirectorInput, deltaMs: number): DirectorState {
    this.totalElapsed += deltaMs

    // ── Calculate reactive tension from game state ──
    const enemyFactor = Math.min(input.enemyCount / Math.max(input.maxExpectedEnemies, 1), 1)
    const playerHpFactor = 1 - (input.playerHp / input.playerMaxHp)
    const partnerHpFactor = 1 - (input.partnerHp / input.partnerMaxHp)

    // Time since kill: tension RISES when player hasn't killed in a while (>5s = max)
    const killDrought = Math.min(input.timeSinceLastKillMs / 5000, 1)

    // Time since damage taken: tension DROPS when player is safe for a while
    const safeDuration = Math.min(input.timeSinceLastDamageTakenMs / 8000, 1)
    const damageTensionFactor = 1 - safeDuration * 0.5 // safe = lower tension

    const reactiveTension = clamp(
      enemyFactor * W_ENEMY_COUNT +
      playerHpFactor * W_PLAYER_HP +
      partnerHpFactor * W_PARTNER_HP +
      killDrought * W_TIME_SINCE_KILL +
      damageTensionFactor * W_TIME_SINCE_DAMAGE,
      0, 1,
    )

    // ── Calculate wave overlay ──
    const waveTime = (this.totalElapsed + this.waveOffset) % WAVE_CYCLE_MS
    const waveProgress = waveTime / WAVE_CYCLE_MS
    let waveValue: number
    let phase: DirectorState['phase']

    if (waveProgress < WAVE_BUILD_RATIO) {
      // Build: linear ramp from 0 to 1
      waveValue = waveProgress / WAVE_BUILD_RATIO
      phase = 'build'
    } else if (waveProgress < WAVE_BUILD_RATIO + WAVE_PEAK_RATIO) {
      // Peak: hold at 1 with slight oscillation
      const peakProgress = (waveProgress - WAVE_BUILD_RATIO) / WAVE_PEAK_RATIO
      waveValue = 0.9 + Math.sin(peakProgress * Math.PI) * 0.1
      phase = 'peak'
    } else {
      // Release/breathe: ease down from 1 to 0
      const releaseProgress = (waveProgress - WAVE_BUILD_RATIO - WAVE_PEAK_RATIO) / (1 - WAVE_BUILD_RATIO - WAVE_PEAK_RATIO)
      waveValue = 1 - easeOutCubic(releaseProgress)
      phase = releaseProgress < 0.6 ? 'release' : 'breathe'
    }

    // ── Blend reactive tension with wave ──
    this.targetTension = clamp(
      reactiveTension * (1 - W_WAVE) + waveValue * W_WAVE,
      0, 1,
    )

    // Smooth lerp toward target (never instant jumps)
    const lerpT = Math.min(1, deltaMs * TENSION_LERP_SPEED)
    this.tension = this.tension + (this.targetTension - this.tension) * lerpT

    // Natural decay when nothing is happening
    if (input.enemyCount === 0 && input.timeSinceLastKillMs > 3000) {
      this.tension -= TENSION_DECAY_RATE * (deltaMs / 1000)
      this.tension = Math.max(0, this.tension)
    }

    // ── Director decisions ──

    const now = this.totalElapsed

    // Spawn control
    let shouldSpawnEnemies = false
    let spawnCount = 0
    if (this.tension < LOW_TENSION && now - this.lastSpawnTime > SPAWN_COOLDOWN_MS && phase !== 'breathe') {
      // Low tension: push the pace
      shouldSpawnEnemies = true
      spawnCount = 1 + Math.floor((LOW_TENSION - this.tension) * 3) // 1-2 enemies
      this.lastSpawnTime = now
    } else if (this.tension > HIGH_TENSION) {
      // High tension: stop spawning, let the player breathe
      shouldSpawnEnemies = false
      spawnCount = 0
    }

    // Health drop
    let shouldDropHealth = false
    let healthDropPosition: Vec2 | null = null
    if (this.tension > HIGH_TENSION && input.playerHp / input.playerMaxHp < 0.4 && now - this.lastHealthDropTime > HEALTH_DROP_COOLDOWN_MS) {
      shouldDropHealth = true
      // Drop near the player but not on top
      const angle = Math.random() * Math.PI * 2
      const dist = 40 + Math.random() * 30
      healthDropPosition = {
        x: input.playerPosition.x + Math.cos(angle) * dist,
        y: input.playerPosition.y + Math.sin(angle) * dist,
      }
      this.lastHealthDropTime = now
    }

    // Partner posture
    let partnerPosture: DirectorState['partnerPosture'] = 'normal'
    if (this.tension > HIGH_TENSION) {
      partnerPosture = 'conservative'
    } else if (this.tension < LOW_TENSION) {
      partnerPosture = 'aggressive'
    }

    // Enemy aggression modifier
    let enemyAggressionMod = 1.0
    if (this.tension < LOW_TENSION) {
      // Low tension: enemies get more aggressive to push pace
      enemyAggressionMod = 1.2 + (LOW_TENSION - this.tension) * 0.5
    } else if (this.tension > HIGH_TENSION) {
      // High tension: enemies back off slightly
      enemyAggressionMod = 0.7 + (1 - this.tension) * 0.5
    }

    return {
      tension: this.tension,
      reactiveTension,
      waveValue,
      phase,
      shouldSpawnEnemies,
      spawnCount,
      shouldDropHealth,
      healthDropPosition,
      partnerPosture,
      enemyAggressionMod: clamp(enemyAggressionMod, 0.5, 1.5),
    }
  }

  /** Get current tension value for external queries */
  getTension(): number {
    return this.tension
  }
}

// ── Utilities ────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

// ── Singleton ────────────────────────────────────────────────────────

export const director = new AIDirector()
