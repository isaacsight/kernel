// SYNTH — Adaptive Difficulty System
//
// Tracks player skill across sessions and adjusts in real-time.
// Changes are INVISIBLE — the player should never notice, just feel "in flow."
// Stored in localStorage across sessions.
// All client-side, zero API calls.

const STORAGE_KEY = 'synth_adaptive_difficulty'
const ADJUSTMENT_SPEED = 0.02       // how fast multipliers move per run
const SESSION_WEIGHT = 0.3          // new session data vs historical (EMA)

// ── Multiplier bounds ────────────────────────────────────────────────

const HP_MULT_MIN = 0.7
const HP_MULT_MAX = 1.3
const DAMAGE_MULT_MIN = 0.7
const DAMAGE_MULT_MAX = 1.3
const SPEED_MULT_MIN = 0.8
const SPEED_MULT_MAX = 1.2
const SPAWN_ADJ_MIN = -2
const SPAWN_ADJ_MAX = 2

// ── Performance targets (what "flow" looks like) ─────────────────────

const TARGET_DAMAGE_RATIO = 2.5     // deal 2.5x more than you take = flow
const TARGET_DODGE_RATE = 0.35      // dodge ~35% of incoming = flow
const TARGET_KILL_SPEED = 0.10      // ~1 kill per 10 seconds = flow
const TARGET_DEATHS_PER_RUN = 0.4   // die roughly every 2-3 runs = flow

// ── Types ────────────────────────────────────────────────────────────

export interface DifficultyMultipliers {
  /** Enemy HP multiplier (0.7-1.3) */
  enemyHpMult: number
  /** Enemy damage multiplier (0.7-1.3) */
  enemyDamageMult: number
  /** Enemy speed multiplier (0.8-1.2) */
  enemySpeedMult: number
  /** Spawn count adjustment (-2 to +2) */
  spawnCountAdj: number
}

interface SkillProfile {
  /** Damage dealt / damage taken ratio (EMA) */
  damageRatio: number
  /** Successful dodge rate 0-1 (EMA) */
  dodgeRate: number
  /** Kills per second (EMA) */
  killSpeed: number
  /** Deaths per run (EMA across runs) */
  deathsPerRun: number
  /** Total completed runs */
  totalRuns: number
}

interface DifficultyStore {
  version: number
  skill: SkillProfile
  multipliers: DifficultyMultipliers
}

// ── Session tracker (within a single run) ────────────────────────────

interface SessionStats {
  damageDealt: number
  damageTaken: number
  dodgeAttempts: number
  dodgeSuccesses: number
  kills: number
  elapsedSeconds: number
  died: boolean
}

// ── Main class ───────────────────────────────────────────────────────

class AdaptiveDifficultySystem {
  private store: DifficultyStore
  private session: SessionStats

  constructor() {
    this.store = this.load()
    this.session = this.freshSession()
  }

  /** Call at start of each run */
  startRun(): void {
    this.session = this.freshSession()
  }

  /** Record damage dealt (call when player/partner hits enemy) */
  recordDamageDealt(amount: number): void {
    this.session.damageDealt += amount
  }

  /** Record damage taken (call when player takes damage) */
  recordDamageTaken(amount: number): void {
    this.session.damageTaken += amount
  }

  /** Record a dodge attempt */
  recordDodgeAttempt(success: boolean): void {
    this.session.dodgeAttempts++
    if (success) this.session.dodgeSuccesses++
  }

  /** Record a kill */
  recordKill(): void {
    this.session.kills++
  }

  /** Call at end of each run. Analyzes performance and adjusts. */
  endRun(elapsedSeconds: number, died: boolean): void {
    this.session.elapsedSeconds = elapsedSeconds
    this.session.died = died

    this.updateSkillProfile()
    this.adjustMultipliers()
    this.save()
  }

  /** Get current difficulty multipliers */
  getMultipliers(): Readonly<DifficultyMultipliers> {
    return this.store.multipliers
  }

  /** Get the skill profile for debugging */
  getSkillProfile(): Readonly<SkillProfile> {
    return this.store.skill
  }

  /** Reset all adaptive data */
  reset(): void {
    this.store = this.defaultStore()
    this.session = this.freshSession()
    this.save()
  }

  // ── Private ──

  private updateSkillProfile(): void {
    const s = this.session
    const profile = this.store.skill

    // Calculate session metrics
    const sessionDamageRatio = s.damageTaken > 0 ? s.damageDealt / s.damageTaken : 5
    const sessionDodgeRate = s.dodgeAttempts > 0 ? s.dodgeSuccesses / s.dodgeAttempts : 0.5
    const sessionKillSpeed = s.elapsedSeconds > 0 ? s.kills / s.elapsedSeconds : 0
    const sessionDeaths = s.died ? 1 : 0

    // Exponential moving average: blend new data with historical
    const w = SESSION_WEIGHT
    profile.damageRatio = profile.damageRatio * (1 - w) + sessionDamageRatio * w
    profile.dodgeRate = profile.dodgeRate * (1 - w) + sessionDodgeRate * w
    profile.killSpeed = profile.killSpeed * (1 - w) + sessionKillSpeed * w
    profile.deathsPerRun = profile.deathsPerRun * (1 - w) + sessionDeaths * w
    profile.totalRuns++
  }

  private adjustMultipliers(): void {
    const skill = this.store.skill
    const m = this.store.multipliers

    // Compare each metric to its target.
    // Above target = player is too good = increase difficulty.
    // Below target = player is struggling = decrease difficulty.

    // Damage ratio: high ratio = player is efficient = harder enemies
    const damageSignal = (skill.damageRatio - TARGET_DAMAGE_RATIO) / TARGET_DAMAGE_RATIO
    m.enemyHpMult = clamp(m.enemyHpMult + damageSignal * ADJUSTMENT_SPEED, HP_MULT_MIN, HP_MULT_MAX)

    // Dodge rate: high dodge = player is skilled = enemies can hit harder
    const dodgeSignal = (skill.dodgeRate - TARGET_DODGE_RATE) / TARGET_DODGE_RATE
    m.enemyDamageMult = clamp(m.enemyDamageMult + dodgeSignal * ADJUSTMENT_SPEED, DAMAGE_MULT_MIN, DAMAGE_MULT_MAX)

    // Kill speed: fast kills = player is strong = enemies can be faster
    const killSignal = (skill.killSpeed - TARGET_KILL_SPEED) / TARGET_KILL_SPEED
    m.enemySpeedMult = clamp(m.enemySpeedMult + killSignal * ADJUSTMENT_SPEED * 0.5, SPEED_MULT_MIN, SPEED_MULT_MAX)

    // Deaths per run: too many deaths = reduce spawn count; too few = more spawns
    const deathSignal = (skill.deathsPerRun - TARGET_DEATHS_PER_RUN) / TARGET_DEATHS_PER_RUN
    // Inverted: more deaths = FEWER spawns (easier)
    const spawnAdj = -deathSignal * 1.5
    m.spawnCountAdj = clamp(Math.round(m.spawnCountAdj + spawnAdj * ADJUSTMENT_SPEED * 10) , SPAWN_ADJ_MIN, SPAWN_ADJ_MAX)
  }

  private freshSession(): SessionStats {
    return {
      damageDealt: 0,
      damageTaken: 0,
      dodgeAttempts: 0,
      dodgeSuccesses: 0,
      kills: 0,
      elapsedSeconds: 0,
      died: false,
    }
  }

  private defaultStore(): DifficultyStore {
    return {
      version: 1,
      skill: {
        damageRatio: TARGET_DAMAGE_RATIO,
        dodgeRate: TARGET_DODGE_RATE,
        killSpeed: TARGET_KILL_SPEED,
        deathsPerRun: TARGET_DEATHS_PER_RUN,
        totalRuns: 0,
      },
      multipliers: {
        enemyHpMult: 1.0,
        enemyDamageMult: 1.0,
        enemySpeedMult: 1.0,
        spawnCountAdj: 0,
      },
    }
  }

  private load(): DifficultyStore {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as DifficultyStore
        if (parsed.version === 1) return parsed
      }
    } catch {
      // Corrupt or unavailable
    }
    return this.defaultStore()
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.store))
    } catch {
      // Silent fail
    }
  }
}

// ── Utility ──────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

// ── Singleton ────────────────────────────────────────────────────────

export const difficulty = new AdaptiveDifficultySystem()
