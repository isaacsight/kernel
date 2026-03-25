// SYNTH — Brain Bridge
//
// Connects partner AI to game state. Pure local — zero API calls, zero cost.
// The partner uses heuristic PartnerBehavior (FSM) for all decisions.
// BrainMemory still tracks player behavior across runs (localStorage only).
//
// NEW: Wires AdaptivePersonality to the partner AI system.
// The bridge now manages:
//   - Adaptive personality (shifts based on events, persists across runs)
//   - Partner memory (floors, deaths, feared enemies — cross-run)
//   - Personality events feed into speech system

import type { BrainContext, BrainDirective, Personality, EnemyType } from '../types'
import { BRAIN_TICK_INTERVAL } from '../constants'
import { BrainMemory } from './BrainMemory'
import { AdaptivePersonality } from './Personality'

export class BrainBridge {
  private memory: BrainMemory
  private adaptivePersonality: AdaptivePersonality
  private timer: ReturnType<typeof setInterval> | null = null
  private lastDirective: BrainDirective | null = null
  private lastSpeech: string | null = null
  private contextProvider: (() => BrainContext | null) | null = null

  /** Tracks current room's kill count for streak detection */
  private roomKillCount = 0
  /** Tracks current room's start time for clear speed */
  private roomStartTime = 0

  constructor() {
    this.memory = new BrainMemory()
    this.adaptivePersonality = new AdaptivePersonality('tactical')
  }

  /** Set the function that provides current game state each tick */
  setContextProvider(provider: () => BrainContext | null): void {
    this.contextProvider = provider
  }

  /** Start the brain loop — records snapshots for memory, no network calls */
  start(): void {
    if (this.timer) return
    this.memory.startRun()
    this.roomKillCount = 0
    this.roomStartTime = Date.now()
    this.timer = setInterval(() => this.tick(), BRAIN_TICK_INTERVAL)
  }

  /** Stop the brain loop */
  stop(finalCtx?: BrainContext): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (finalCtx) {
      this.memory.endRun(finalCtx)
    }
    this.lastDirective = null
    this.lastSpeech = null
  }

  /** Get the most recent directive (always null in local mode — partner uses its own FSM) */
  getLastDirective(): BrainDirective | null {
    return this.lastDirective
  }

  /** Get the most recent speech line */
  getLastSpeech(): string | null {
    const speech = this.lastSpeech
    this.lastSpeech = null
    return speech
  }

  /** Get the memory system */
  getMemory(): BrainMemory {
    return this.memory
  }

  /** Get the adaptive personality (live, shifting weights) */
  getAdaptivePersonality(): AdaptivePersonality {
    return this.adaptivePersonality
  }

  /** Get the current personality as a Personality object (for UtilityAI) */
  getCurrentPersonality(): Personality {
    return this.adaptivePersonality.getPersonality()
  }

  // ── Personality Event API ────────────────────────────────────────
  // DungeonScene calls these when game events happen.
  // The personality shifts in response, and the memory records them.

  /** Partner took damage */
  onPartnerDamaged(amount: number, maxHp: number): void {
    const ratio = amount / maxHp
    if (ratio > 0.2) {
      this.adaptivePersonality.processEvent('partner_took_heavy_damage')
    } else {
      this.adaptivePersonality.processEvent('partner_took_damage')
    }
  }

  /** Partner killed an enemy */
  onPartnerKill(): void {
    this.adaptivePersonality.processEvent('partner_killed_enemy')
    this.memory.recordKill()
    this.roomKillCount++
  }

  /** Kill streak achieved */
  onKillStreak(): void {
    this.adaptivePersonality.processEvent('kill_streak')
    this.memory.recordStreak(this.roomKillCount)
  }

  /** Player's HP dropped low */
  onPlayerLowHp(hpRatio: number): void {
    if (hpRatio < 0.15) {
      this.adaptivePersonality.processEvent('player_near_death')
    } else {
      this.adaptivePersonality.processEvent('player_low_hp')
    }
  }

  /** Partner's HP dropped low */
  onPartnerLowHp(): void {
    this.adaptivePersonality.processEvent('partner_low_hp')
  }

  /** Room was cleared */
  onRoomCleared(): void {
    const clearTimeMs = Date.now() - this.roomStartTime
    if (clearTimeMs < 15000) {
      this.adaptivePersonality.processEvent('room_cleared_fast')
    } else if (clearTimeMs > 45000) {
      this.adaptivePersonality.processEvent('room_cleared_slow')
    }
    this.memory.recordRoomClear()
    this.roomKillCount = 0
    this.roomStartTime = Date.now()
  }

  /** New room entered */
  onRoomEnter(): void {
    this.roomKillCount = 0
    this.roomStartTime = Date.now()
  }

  /** Partner successfully flanked (flank directive led to a kill) */
  onSuccessfulFlank(): void {
    this.adaptivePersonality.processEvent('successful_flank')
  }

  /** Boss encounter started */
  onBossEncounter(): void {
    this.adaptivePersonality.processEvent('boss_encounter')
  }

  /** Boss killed */
  onBossKill(): void {
    this.memory.recordBossKill()
  }

  /** Floor reached */
  onFloorReached(floor: number): void {
    this.memory.recordFloorReached(floor)
  }

  /** Run ended in death */
  onRunDeath(killedBy: EnemyType | 'boss' | 'unknown', floor: number): void {
    this.adaptivePersonality.processEvent('run_death')
    this.memory.recordDeath(killedBy, floor)
    this.memory.recordRunEnd(floor, false)
  }

  /** Run ended in survival (boss beaten, etc.) */
  onRunSurvived(floor: number): void {
    this.adaptivePersonality.processEvent('run_survived')
    this.memory.recordRunEnd(floor, true)
  }

  private tick(): void {
    if (!this.contextProvider) return
    const ctx = this.contextProvider()
    if (!ctx) return
    // Record snapshot for player behavior analysis (localStorage only)
    this.memory.recordSnapshot(ctx)
  }
}
