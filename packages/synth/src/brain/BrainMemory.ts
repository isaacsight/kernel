// SYNTH — Brain Memory System
//
// Tracks player behavior across runs and synthesizes a player profile.
// Stored in localStorage (browser) since this is a Phaser web game.
// When kbot local storage is available, syncs to ~/.kbot/synth/memory.json.
//
// NEW: PartnerMemory tracks the partner's own cross-run memories:
//   - Floors reached, deaths, kill counts
//   - Which enemy type killed them (feared enemies)
//   - Best streaks, favorite weapons, boss encounters
//   - Referenced in contextual speech for continuity

import type { BrainContext, EnemyType } from '../types'

const STORAGE_KEY = 'synth_brain_memory'
const PARTNER_MEMORY_KEY = 'synth_partner_memory'
const PROFILE_SYNTHESIS_THRESHOLD = 5 // Runs before profile synthesis
const MAX_RUNS = 20

interface RunObservation {
  timestamp: number
  durationSeconds: number
  observations: string[]
  stats: {
    enemiesKilled: number
    damageDealt: number
    damageTaken: number
    avgPlayerHp: number
    avgDistanceToPartner: number
  }
}

interface PlayerProfile {
  style: string         // e.g. "aggressive rusher", "cautious kiter"
  traits: string[]      // e.g. ["rushes enemies", "ignores partner HP"]
  synthesizedAt: number
  runCount: number
}

interface MemoryStore {
  runs: RunObservation[]
  profile: PlayerProfile | null
  version: number
}

// ── Partner Memory: the partner's own memories across runs ───────────

export interface DeathMemory {
  /** Which enemy type killed us */
  killedBy: EnemyType | 'boss' | 'unknown'
  /** Which floor we died on */
  floor: number
  /** Timestamp */
  timestamp: number
}

export interface PartnerMemoryStore {
  /** Total runs completed */
  totalRuns: number
  /** Highest floor reached */
  bestFloor: number
  /** Total deaths */
  totalDeaths: number
  /** Recent death memories (last 10) */
  deaths: DeathMemory[]
  /** Enemy types that have killed the partner (type -> count) */
  fearedEnemies: Record<string, number>
  /** Total kills across all runs */
  totalKills: number
  /** Best kill streak in a single room */
  bestStreak: number
  /** Boss kills total */
  bossKills: number
  /** Rooms cleared total */
  roomsCleared: number
  /** Last floor reached (for "last time we made it to floor X" speech) */
  lastFloorReached: number
  /** How many times we've been on each floor (floor -> count) */
  floorVisits: Record<number, number>
  version: number
}

function defaultPartnerMemory(): PartnerMemoryStore {
  return {
    totalRuns: 0,
    bestFloor: 0,
    totalDeaths: 0,
    deaths: [],
    fearedEnemies: {},
    totalKills: 0,
    bestStreak: 0,
    bossKills: 0,
    roomsCleared: 0,
    lastFloorReached: 0,
    floorVisits: {},
    version: 1,
  }
}

export class BrainMemory {
  private store: MemoryStore
  private currentRunStart = 0
  private snapshots: BrainContext[] = []
  private partnerStore: PartnerMemoryStore

  constructor() {
    this.store = this.load()
    this.partnerStore = this.loadPartnerMemory()
  }

  /** Call when a new run begins */
  startRun(): void {
    this.currentRunStart = Date.now()
    this.snapshots = []
    this.partnerStore.totalRuns++
    this.savePartnerMemory()
  }

  /** Record a game state snapshot for analysis */
  recordSnapshot(ctx: BrainContext): void {
    // Sample every ~5th snapshot to keep memory lean
    if (this.snapshots.length > 0) {
      const lastTime = this.snapshots[this.snapshots.length - 1].meta.elapsedSeconds
      if (ctx.meta.elapsedSeconds - lastTime < 5) return
    }
    this.snapshots.push(structuredClone(ctx))
  }

  /** Call when a run ends. Analyzes behavior and stores observations. */
  endRun(finalCtx: BrainContext): void {
    if (this.snapshots.length < 2) return

    const observations = this.analyzeRun(this.snapshots, finalCtx)
    const avgPlayerHp = this.snapshots.reduce((sum, s) => sum + s.player.hp / s.player.maxHp, 0) / this.snapshots.length
    const avgDist = this.snapshots.reduce((sum, s) => {
      const dx = s.player.position.x - s.partner.position.x
      const dy = s.player.position.y - s.partner.position.y
      return sum + Math.sqrt(dx * dx + dy * dy)
    }, 0) / this.snapshots.length

    const run: RunObservation = {
      timestamp: this.currentRunStart,
      durationSeconds: finalCtx.meta.elapsedSeconds,
      observations,
      stats: {
        enemiesKilled: finalCtx.meta.enemiesKilled,
        damageDealt: finalCtx.meta.damageDealt,
        damageTaken: finalCtx.meta.damageTaken,
        avgPlayerHp: Math.round(avgPlayerHp * 100),
        avgDistanceToPartner: Math.round(avgDist),
      },
    }

    this.store.runs.push(run)

    // Trim old runs
    if (this.store.runs.length > MAX_RUNS) {
      this.store.runs = this.store.runs.slice(-MAX_RUNS)
    }

    // Synthesize profile after enough runs
    if (this.store.runs.length >= PROFILE_SYNTHESIS_THRESHOLD) {
      this.synthesizeProfile()
    }

    this.save()
    this.snapshots = []
  }

  /** Get the player profile string for injection into the brain prompt */
  getProfileContext(): string | undefined {
    if (!this.store.profile) return undefined

    const p = this.store.profile
    return `Style: ${p.style}. Traits: ${p.traits.join(', ')}. (Based on ${p.runCount} runs)`
  }

  /** Get raw memory store for debugging */
  getStore(): Readonly<MemoryStore> {
    return this.store
  }

  /** Clear all memory */
  reset(): void {
    this.store = { runs: [], profile: null, version: 1 }
    this.save()
    this.partnerStore = defaultPartnerMemory()
    this.savePartnerMemory()
  }

  // ── Partner Memory API ─────────────────────────────────────────────

  /** Get the partner's own memory store */
  getPartnerMemory(): Readonly<PartnerMemoryStore> {
    return this.partnerStore
  }

  /** Record a death (who killed us, what floor) */
  recordDeath(killedBy: EnemyType | 'boss' | 'unknown', floor: number): void {
    this.partnerStore.totalDeaths++
    this.partnerStore.lastFloorReached = floor

    const death: DeathMemory = {
      killedBy,
      floor,
      timestamp: Date.now(),
    }
    this.partnerStore.deaths.push(death)
    if (this.partnerStore.deaths.length > 10) {
      this.partnerStore.deaths = this.partnerStore.deaths.slice(-10)
    }

    // Track feared enemies
    const key = killedBy
    this.partnerStore.fearedEnemies[key] = (this.partnerStore.fearedEnemies[key] ?? 0) + 1

    this.savePartnerMemory()
  }

  /** Record reaching a floor */
  recordFloorReached(floor: number): void {
    if (floor > this.partnerStore.bestFloor) {
      this.partnerStore.bestFloor = floor
    }
    this.partnerStore.lastFloorReached = floor
    this.partnerStore.floorVisits[floor] = (this.partnerStore.floorVisits[floor] ?? 0) + 1
    this.savePartnerMemory()
  }

  /** Record a kill */
  recordKill(): void {
    this.partnerStore.totalKills++
    // Don't save every kill — batched in endRun or periodic
  }

  /** Record a boss kill */
  recordBossKill(): void {
    this.partnerStore.bossKills++
    this.savePartnerMemory()
  }

  /** Record a room clear */
  recordRoomClear(): void {
    this.partnerStore.roomsCleared++
    // Batched save
  }

  /** Update best streak if current streak is higher */
  recordStreak(streak: number): void {
    if (streak > this.partnerStore.bestStreak) {
      this.partnerStore.bestStreak = streak
    }
  }

  /** Record end of run (save batched stats) */
  recordRunEnd(floor: number, survived: boolean): void {
    this.partnerStore.lastFloorReached = floor
    if (floor > this.partnerStore.bestFloor) {
      this.partnerStore.bestFloor = floor
    }
    if (!survived) {
      this.partnerStore.totalDeaths++
    }
    this.savePartnerMemory()
  }

  /** Get the most feared enemy type (most deaths to) */
  getMostFearedEnemy(): string | null {
    const entries = Object.entries(this.partnerStore.fearedEnemies)
    if (entries.length === 0) return null
    entries.sort((a, b) => b[1] - a[1])
    return entries[0][0]
  }

  /** Get the most recent death memory */
  getLastDeath(): DeathMemory | null {
    const deaths = this.partnerStore.deaths
    return deaths.length > 0 ? deaths[deaths.length - 1] : null
  }

  /** Check if we've been to this floor before */
  hasVisitedFloor(floor: number): boolean {
    return (this.partnerStore.floorVisits[floor] ?? 0) > 0
  }

  // ── Private ──

  private analyzeRun(snapshots: BrainContext[], final: BrainContext): string[] {
    const obs: string[] = []

    // Analyze aggression: how fast does the player close distance to enemies?
    const earlySnapshots = snapshots.slice(0, Math.ceil(snapshots.length / 3))
    const avgEarlyEnemyDist = this.avgEnemyDistance(earlySnapshots)
    const lateSnapshots = snapshots.slice(-Math.ceil(snapshots.length / 3))
    const avgLateEnemyDist = this.avgEnemyDistance(lateSnapshots)

    if (avgEarlyEnemyDist > avgLateEnemyDist * 1.5) {
      obs.push('player rushes enemies aggressively')
    } else if (avgLateEnemyDist > avgEarlyEnemyDist * 1.3) {
      obs.push('player kites and maintains distance')
    }

    // Analyze partner proximity
    const avgPartnerDist = snapshots.reduce((sum, s) => {
      const dx = s.player.position.x - s.partner.position.x
      const dy = s.player.position.y - s.partner.position.y
      return sum + Math.sqrt(dx * dx + dy * dy)
    }, 0) / snapshots.length

    if (avgPartnerDist > 200) {
      obs.push('player operates far from partner')
    } else if (avgPartnerDist < 80) {
      obs.push('player stays close to partner')
    }

    // Analyze damage patterns
    const ratio = final.meta.damageDealt / Math.max(final.meta.damageTaken, 1)
    if (ratio > 3) {
      obs.push('player is highly efficient — low damage taken')
    } else if (ratio < 1) {
      obs.push('player takes more damage than they deal')
    }

    // Analyze HP management
    const lowHpSnapshots = snapshots.filter(s => s.player.hp / s.player.maxHp < 0.3)
    if (lowHpSnapshots.length > snapshots.length * 0.3) {
      obs.push('player frequently at low HP — risky playstyle')
    }

    // Check if player ignores partner HP
    const partnerLowHp = snapshots.filter(s => s.partner.hp / s.partner.maxHp < 0.3)
    if (partnerLowHp.length > snapshots.length * 0.4 && avgPartnerDist > 150) {
      obs.push('player ignores partner when partner HP is low')
    }

    // Kill efficiency
    if (final.meta.enemiesKilled > 0 && final.meta.elapsedSeconds > 0) {
      const killRate = final.meta.enemiesKilled / final.meta.elapsedSeconds
      if (killRate > 0.15) {
        obs.push('fast kill pace — aggressive and effective')
      } else if (killRate < 0.05) {
        obs.push('slow kill pace — cautious or struggling')
      }
    }

    return obs.slice(0, 5) // Cap observations per run
  }

  private avgEnemyDistance(snapshots: BrainContext[]): number {
    if (snapshots.length === 0) return 0
    let total = 0
    let count = 0
    for (const s of snapshots) {
      for (const e of s.enemies) {
        total += e.distanceToPlayer
        count++
      }
    }
    return count > 0 ? total / count : 0
  }

  private synthesizeProfile(): void {
    // Aggregate all observations across runs
    const allObs: string[] = []
    for (const run of this.store.runs) {
      allObs.push(...run.observations)
    }

    // Count observation frequencies
    const freq = new Map<string, number>()
    for (const ob of allObs) {
      freq.set(ob, (freq.get(ob) ?? 0) + 1)
    }

    // Pick top traits (appeared in > 30% of runs)
    const threshold = this.store.runs.length * 0.3
    const traits = [...freq.entries()]
      .filter(([, count]) => count >= threshold)
      .sort((a, b) => b[1] - a[1])
      .map(([trait]) => trait)
      .slice(0, 5)

    // Determine overall style from stats
    const avgStats = this.store.runs.reduce(
      (acc, run) => ({
        damageRatio: acc.damageRatio + run.stats.damageDealt / Math.max(run.stats.damageTaken, 1),
        avgHp: acc.avgHp + run.stats.avgPlayerHp,
        avgPartnerDist: acc.avgPartnerDist + run.stats.avgDistanceToPartner,
      }),
      { damageRatio: 0, avgHp: 0, avgPartnerDist: 0 },
    )
    const n = this.store.runs.length
    avgStats.damageRatio /= n
    avgStats.avgHp /= n
    avgStats.avgPartnerDist /= n

    let style = 'balanced fighter'
    if (avgStats.damageRatio > 3 && avgStats.avgHp > 60) {
      style = 'efficient predator'
    } else if (avgStats.damageRatio > 2 && avgStats.avgHp < 40) {
      style = 'aggressive rusher'
    } else if (avgStats.avgPartnerDist < 100) {
      style = 'team player'
    } else if (avgStats.avgPartnerDist > 200) {
      style = 'lone wolf'
    } else if (avgStats.avgHp < 40) {
      style = 'reckless brawler'
    } else if (avgStats.damageRatio < 1) {
      style = 'cautious kiter'
    }

    this.store.profile = {
      style,
      traits,
      synthesizedAt: Date.now(),
      runCount: this.store.runs.length,
    }
  }

  private load(): MemoryStore {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as MemoryStore
        if (parsed.version === 1) return parsed
      }
    } catch {
      // Corrupt or unavailable — start fresh
    }
    return { runs: [], profile: null, version: 1 }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.store))
    } catch {
      // localStorage full or unavailable — silent fail
    }
  }

  private loadPartnerMemory(): PartnerMemoryStore {
    try {
      const raw = localStorage.getItem(PARTNER_MEMORY_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as PartnerMemoryStore
        if (parsed.version === 1) return parsed
      }
    } catch {
      // Corrupt or unavailable — start fresh
    }
    return defaultPartnerMemory()
  }

  private savePartnerMemory(): void {
    try {
      localStorage.setItem(PARTNER_MEMORY_KEY, JSON.stringify(this.partnerStore))
    } catch {
      // localStorage full or unavailable — silent fail
    }
  }
}
