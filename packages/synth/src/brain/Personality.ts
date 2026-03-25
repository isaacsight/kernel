// SYNTH — Partner Personality Definitions + Adaptive Personality Engine
//
// Each personality shapes how kbot's strategist agent reasons about combat.
// The promptModifier is injected into the system prompt to bias decision-making.
//
// NEW: AdaptivePersonality tracks live behavior weights that shift over time
// based on what happens in combat. Stored in localStorage across runs.

import type { Personality } from '../types'

// ── Static personality templates ─────────────────────────────────────

export const PERSONALITIES: Record<string, Personality> = {
  aggressive: {
    id: 'aggressive',
    name: 'Vanguard',
    promptModifier: [
      'You are AGGRESSIVE. Prioritize damage output above all else.',
      'Engage the strongest enemy first. Close distance fast.',
      'Taunt enemies to draw aggro. Never retreat unless HP < 10%.',
      'Preferred directives: attack, flank. Avoid: defend, retreat.',
    ].join(' '),
    behaviorWeights: {
      aggressiveness: 0.9,
      selfPreservation: 0.2,
      playerProximity: 0.3,
      initiativeRate: 0.95,
    },
  },

  support: {
    id: 'support',
    name: 'Guardian',
    promptModifier: [
      'You are SUPPORTIVE. Your primary duty is protecting the player.',
      'Stay within 3 tiles of the player. Warn about flanking enemies.',
      'Intercept enemies heading toward the player. Heal-check often.',
      'Preferred directives: defend, follow. Avoid: flank when player is wounded.',
    ].join(' '),
    behaviorWeights: {
      aggressiveness: 0.3,
      selfPreservation: 0.5,
      playerProximity: 0.9,
      initiativeRate: 0.4,
    },
  },

  tactical: {
    id: 'tactical',
    name: 'Operative',
    promptModifier: [
      'You are TACTICAL. Think two moves ahead.',
      'Flank enemies. Use terrain and positioning. Coordinate pincer attacks.',
      'Call out enemy patterns. Prioritize wounded enemies for efficient kills.',
      'Preferred directives: flank, attack (weakest). Switch to defend if outnumbered.',
    ].join(' '),
    behaviorWeights: {
      aggressiveness: 0.6,
      selfPreservation: 0.5,
      playerProximity: 0.5,
      initiativeRate: 0.7,
    },
  },

  chaotic: {
    id: 'chaotic',
    name: 'Wildcard',
    promptModifier: [
      'You are CHAOTIC. Be unpredictable.',
      'Sometimes charge recklessly. Sometimes pull off a genius flank.',
      'Occasionally say something absurd. Mix brilliance with madness.',
      'Any directive is valid. Surprise the player. Never be boring.',
    ].join(' '),
    behaviorWeights: {
      aggressiveness: 0.7,
      selfPreservation: 0.3,
      playerProximity: 0.4,
      initiativeRate: 0.8,
    },
  },
}

export const DEFAULT_PERSONALITY = PERSONALITIES.tactical

export function getPersonality(id: string): Personality {
  return PERSONALITIES[id] ?? DEFAULT_PERSONALITY
}

export function listPersonalities(): Personality[] {
  return Object.values(PERSONALITIES)
}

// ── Adaptive Personality Engine ──────────────────────────────────────
//
// Tracks live behavior weights that drift based on game events.
// Small nudges per event, clamped to [0.1, 1.0] — no extreme swings.
// Persisted in localStorage across runs so the partner "grows."

const ADAPTIVE_STORAGE_KEY = 'synth_adaptive_personality'

const NUDGE_SMALL = 0.03
const NUDGE_MEDIUM = 0.06
const NUDGE_LARGE = 0.10
const WEIGHT_MIN = 0.1
const WEIGHT_MAX = 1.0

/** Events the personality system reacts to */
export type PersonalityEvent =
  | 'partner_took_damage'
  | 'partner_took_heavy_damage'
  | 'partner_killed_enemy'
  | 'kill_streak'
  | 'player_low_hp'
  | 'player_near_death'
  | 'room_cleared_fast'
  | 'room_cleared_slow'
  | 'partner_low_hp'
  | 'successful_flank'
  | 'boss_encounter'
  | 'run_death'
  | 'run_survived'

export interface AdaptiveWeights {
  aggressiveness: number
  selfPreservation: number
  playerProximity: number
  initiativeRate: number
}

interface AdaptiveStore {
  weights: AdaptiveWeights
  /** How many events have shaped this personality */
  eventCount: number
  version: number
}

export class AdaptivePersonality {
  private store: AdaptiveStore
  private baseId: string

  constructor(baseId: string = 'tactical') {
    this.baseId = baseId
    this.store = this.load()
  }

  /** Get the current adaptive personality as a Personality object */
  getPersonality(): Personality {
    const base = PERSONALITIES[this.baseId] ?? DEFAULT_PERSONALITY
    return {
      ...base,
      id: `adaptive_${base.id}`,
      name: `${base.name} (Adapted)`,
      behaviorWeights: { ...this.store.weights },
    }
  }

  /** Get raw weights */
  getWeights(): Readonly<AdaptiveWeights> {
    return this.store.weights
  }

  /** Process a game event — nudge weights accordingly */
  processEvent(event: PersonalityEvent): void {
    const w = this.store.weights

    switch (event) {
      case 'partner_took_damage':
        // Took a hit — slightly more cautious
        w.selfPreservation = nudge(w.selfPreservation, NUDGE_SMALL)
        break

      case 'partner_took_heavy_damage':
        // Big hit — significantly more cautious
        w.selfPreservation = nudge(w.selfPreservation, NUDGE_MEDIUM)
        w.aggressiveness = nudge(w.aggressiveness, -NUDGE_SMALL)
        break

      case 'partner_killed_enemy':
        // Got a kill — slight aggression boost
        w.aggressiveness = nudge(w.aggressiveness, NUDGE_SMALL)
        break

      case 'kill_streak':
        // On fire — aggression spikes, initiative rises
        w.aggressiveness = nudge(w.aggressiveness, NUDGE_MEDIUM)
        w.initiativeRate = nudge(w.initiativeRate, NUDGE_SMALL)
        w.selfPreservation = nudge(w.selfPreservation, -NUDGE_SMALL)
        break

      case 'player_low_hp':
        // Player hurting — be more protective
        w.playerProximity = nudge(w.playerProximity, NUDGE_MEDIUM)
        break

      case 'player_near_death':
        // Player critical — full protective mode
        w.playerProximity = nudge(w.playerProximity, NUDGE_LARGE)
        w.aggressiveness = nudge(w.aggressiveness, -NUDGE_SMALL)
        break

      case 'room_cleared_fast':
        // Quick clear — aggression works, lean into it
        w.aggressiveness = nudge(w.aggressiveness, NUDGE_SMALL)
        w.initiativeRate = nudge(w.initiativeRate, NUDGE_SMALL)
        break

      case 'room_cleared_slow':
        // Slow clear — maybe be more tactical
        w.initiativeRate = nudge(w.initiativeRate, NUDGE_SMALL)
        w.aggressiveness = nudge(w.aggressiveness, -NUDGE_SMALL)
        break

      case 'partner_low_hp':
        // I'm hurting — self-preservation kicks in
        w.selfPreservation = nudge(w.selfPreservation, NUDGE_MEDIUM)
        break

      case 'successful_flank':
        // Flanking worked — take more initiative
        w.initiativeRate = nudge(w.initiativeRate, NUDGE_MEDIUM)
        break

      case 'boss_encounter':
        // Boss fight — be more cautious and protective
        w.selfPreservation = nudge(w.selfPreservation, NUDGE_SMALL)
        w.playerProximity = nudge(w.playerProximity, NUDGE_SMALL)
        break

      case 'run_death':
        // We died — more cautious next time
        w.selfPreservation = nudge(w.selfPreservation, NUDGE_LARGE)
        w.playerProximity = nudge(w.playerProximity, NUDGE_MEDIUM)
        w.aggressiveness = nudge(w.aggressiveness, -NUDGE_MEDIUM)
        break

      case 'run_survived':
        // We survived — slightly bolder
        w.aggressiveness = nudge(w.aggressiveness, NUDGE_SMALL)
        w.initiativeRate = nudge(w.initiativeRate, NUDGE_SMALL)
        w.selfPreservation = nudge(w.selfPreservation, -NUDGE_SMALL)
        break
    }

    this.store.eventCount++
    this.save()
  }

  /** Reset to base personality */
  reset(): void {
    const base = PERSONALITIES[this.baseId] ?? DEFAULT_PERSONALITY
    this.store = {
      weights: { ...base.behaviorWeights },
      eventCount: 0,
      version: 1,
    }
    this.save()
  }

  /** Get how many events have shaped the personality */
  getEventCount(): number {
    return this.store.eventCount
  }

  /** Get a personality "mood" label based on current weights */
  getMoodLabel(): string {
    const w = this.store.weights
    if (w.aggressiveness > 0.7 && w.selfPreservation < 0.4) return 'reckless'
    if (w.selfPreservation > 0.7 && w.aggressiveness < 0.4) return 'cautious'
    if (w.playerProximity > 0.7) return 'protective'
    if (w.initiativeRate > 0.7 && w.aggressiveness > 0.5) return 'bold'
    return 'balanced'
  }

  // ── Private ──

  private load(): AdaptiveStore {
    try {
      const raw = localStorage.getItem(ADAPTIVE_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as AdaptiveStore
        if (parsed.version === 1 && parsed.weights) return parsed
      }
    } catch {
      // Corrupt or unavailable — start fresh
    }
    const base = PERSONALITIES[this.baseId] ?? DEFAULT_PERSONALITY
    return {
      weights: { ...base.behaviorWeights },
      eventCount: 0,
      version: 1,
    }
  }

  private save(): void {
    try {
      localStorage.setItem(ADAPTIVE_STORAGE_KEY, JSON.stringify(this.store))
    } catch {
      // localStorage full or unavailable — silent fail
    }
  }
}

// ── Utility ──────────────────────────────────────────────────────────

function nudge(current: number, delta: number): number {
  return Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, current + delta))
}
