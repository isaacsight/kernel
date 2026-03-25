// SYNTH -- Partner Speech Lines
// Diablo-style battle-hardened companion. Terse, grim, earned lines.
// Think Rogue from Diablo I, Tyrael's soldiers, or a scarred mercenary.
// Lines should feel EARNED — cooldown of 8-10s between speech.
//
// NEW: Contextual speech system that references partner memory,
// personality mood, and what's actually happening in the game.
// The partner is a CHARACTER — not a notification system.

import { SPEECH_COOLDOWN_MS, SPEECH_KILL_STREAK_THRESHOLD } from '../constants'
import type { PartnerMemoryStore } from '../brain/BrainMemory'

// ── Speech Categories ──────────────────────────────────────────────

export type SpeechTrigger =
  | 'room_enter'
  | 'room_enter_boss'
  | 'low_hp_self'
  | 'low_hp_player'
  | 'kill_streak'
  | 'boss_phase_2'
  | 'boss_phase_3'
  | 'boss_low_hp'
  | 'room_cleared'
  | 'player_dodged'
  | 'partner_hit'
  | 'idle'
  | 'floor_start'
  | 'run_start'
  | 'rare_mod_found'
  | 'floor_modifier_active'
  | 'death'
  | 'partner_opinion'

const SPEECH_LINES: Record<SpeechTrigger, string[]> = {
  room_enter: [
    'Watch your flank.',
    'Stay close.',
    'Something stirs ahead.',
    'Weapons ready.',
    'I smell death here.',
    'Together — now.',
    'Another one. Stay sharp.',
    'This one feels different...',
    'Eyes up.',
    'Movement ahead.',
  ],
  room_enter_boss: [
    "That's a big one. Watch the patterns.",
    'Boss chamber. Stay on your toes.',
    'I can feel it. Something powerful.',
    'This is it. Give it everything.',
    'Big fight ahead. Stick together.',
  ],
  low_hp_self: [
    'I need a second...',
    'Wounded... pulling back.',
    "Can't hold much longer.",
    'Bleeding out...',
    'Cover me.',
    'I need healing.',
    'Taking too much damage...',
  ],
  low_hp_player: [
    "You're hurt — fall back, I'll cover!",
    'Fall back!',
    'Stay behind me!',
    "You're wounded — move!",
    'Get to cover!',
    'Behind you!',
    "I'll draw them off — heal up!",
  ],
  kill_streak: [
    "We're on fire!",
    "Don't get cocky.",
    'Good kill.',
    "They're breaking.",
    'Another one down.',
    'Press the attack!',
    'That all you got?',
    'Keep it up!',
  ],
  boss_phase_2: [
    'Boss is changing!',
    "It's adapting — watch it!",
    'New pattern. Stay sharp.',
    'Eyes open!',
  ],
  boss_phase_3: [
    'Boss is weakening.',
    'Final stand — everything we have!',
    "It's desperate now. Careful.",
    'End this.',
  ],
  boss_low_hp: [
    'Wounded one — finish it.',
    'One more strike!',
    "It's staggering — now!",
    'Death is close. Push!',
  ],
  room_cleared: [
    'Clear. Take a breath.',
    'The dead rest easy.',
    'Room secured.',
    'Good work. Move on.',
    'Silence again.',
    "Let's keep moving.",
    'That was intense.',
  ],
  player_dodged: [
    'Nice dodge!',
    'Quick.',
    'Good instincts.',
    'Close one.',
    'Sharp reflexes.',
  ],
  partner_hit: [
    'Gah!',
    'Flesh wound.',
    'Still standing.',
    'Hit me...',
    'Ugh — focus.',
  ],
  idle: [
    'Too quiet...',
    'I hear something.',
    'Stay alert.',
    'The dark watches.',
    "Something's off...",
    "We shouldn't linger.",
  ],
  floor_start: [
    "Deeper we go.",
    "New floor. Stay sharp.",
    "The air is thicker here.",
    "I feel stronger down here. Weird.",
    "Watch for new enemy patterns.",
  ],
  run_start: [
    "Ready when you are.",
    "Let's see how far we get.",
    "Same as always — together.",
    "I've got your back.",
    "Here we go again.",
  ],
  rare_mod_found: [
    "Oh, that's a good one.",
    "Nice find.",
    "That'll help.",
    "Rare. Pick it up.",
    "I like that one.",
  ],
  floor_modifier_active: [
    "This floor modifier is brutal.",
    "I like this challenge.",
    "This is going to hurt.",
    "Interesting modifier. Adapt.",
    "Stay alert — different rules here.",
  ],
  death: [
    "I'll remember this...",
    "Not again...",
    "We'll do better next time.",
    "Remember what killed us.",
    "I won't forget.",
  ],
  partner_opinion: [
    "Good choice.",
    "Interesting call.",
    "I would've done that differently.",
    "Smart move.",
    "If you say so...",
  ],
}

// ── Personality-flavored speech variants ──────────────────────────────
// When personality is reckless/bold, use more aggressive lines.
// When cautious/protective, use more careful lines.

type PersonalityMood = 'reckless' | 'cautious' | 'protective' | 'bold' | 'balanced'

const PERSONALITY_FLAVOR: Partial<Record<SpeechTrigger, Record<PersonalityMood, string[]>>> = {
  room_enter: {
    reckless: ["Let's wreck this place.", "I'll go first.", "Bring it on."],
    cautious: ["Careful in here.", "Something feels wrong.", "Slow and steady."],
    protective: ["Stay close to me.", "I'll check ahead.", "Right behind you."],
    bold: ["Watch and learn.", "This'll be fun.", "I see opportunity."],
    balanced: [],
  },
  kill_streak: {
    reckless: ["MORE!", "I can't stop!", "Who's next?!"],
    cautious: ["Good, but stay focused.", "Don't overextend.", "One at a time."],
    protective: ["They're thinning out.", "Keep the pressure up.", "Almost clear."],
    bold: ["Calculated.", "As planned.", "Nothing they can do."],
    balanced: [],
  },
  room_cleared: {
    reckless: ["Too easy.", "That was nothing.", "I wanted more."],
    cautious: ["Finally. Regroup.", "That was close.", "Let's not push our luck."],
    protective: ["You okay?", "We're safe. For now.", "Good teamwork."],
    bold: ["Efficient.", "Clean work.", "Next."],
    balanced: [],
  },
  low_hp_self: {
    reckless: ["Just a scratch!", "I'll walk it off.", "Pain is temporary."],
    cautious: ["I need to retreat!", "This is bad.", "Cover me — now!"],
    protective: ["Don't worry about me.", "Focus on yourself!", "I'll manage."],
    bold: ["Tactical withdrawal.", "Repositioning.", "Temporary setback."],
    balanced: [],
  },
  idle: {
    reckless: ["I'm getting bored.", "Where are they?", "Let's find trouble."],
    cautious: ["Too quiet. Trap?", "I don't like this.", "Something's coming."],
    protective: ["How's your health?", "Need anything?", "I'm watching your six."],
    bold: ["Analyzing the room.", "Thinking ahead.", "Planning our next move."],
    balanced: [],
  },
}

// ── Memory-based speech generators ───────────────────────────────────

function getMemoryLines(trigger: SpeechTrigger, memory: PartnerMemoryStore | null): string[] {
  if (!memory) return []

  const lines: string[] = []

  switch (trigger) {
    case 'run_start': {
      if (memory.totalRuns > 1 && memory.lastFloorReached > 1) {
        lines.push(`Last time we made it to floor ${memory.lastFloorReached}. Let's beat that.`)
      }
      if (memory.totalRuns > 3 && memory.bestFloor > 1) {
        lines.push(`Our best is floor ${memory.bestFloor}. I believe we can go further.`)
      }
      if (memory.totalDeaths > 5) {
        lines.push(`${memory.totalDeaths} deaths... but who's counting.`)
      }
      if (memory.bossKills > 0) {
        lines.push(`We've slain ${memory.bossKills} boss${memory.bossKills > 1 ? 'es' : ''}. We know what to do.`)
      }
      break
    }

    case 'room_enter': {
      const lastDeath = memory.deaths.length > 0 ? memory.deaths[memory.deaths.length - 1] : null
      if (lastDeath && lastDeath.killedBy !== 'unknown') {
        const name = enemyDisplayName(lastDeath.killedBy)
        lines.push(`Watch out for ${name}s — they got me last time.`)
      }
      if (memory.roomsCleared > 50) {
        lines.push("We've been through worse.")
      }
      break
    }

    case 'room_enter_boss': {
      if (memory.bossKills > 0) {
        lines.push("We've beaten one before. Same approach.")
      }
      if (memory.bossKills === 0 && memory.totalRuns > 2) {
        lines.push("First boss fight together. Let's make it count.")
      }
      break
    }

    case 'floor_start': {
      const visits = memory.floorVisits
      // We don't know the exact floor here, but we can check general progress
      if (memory.bestFloor > 3) {
        lines.push("We've been deeper. We know the rhythm.")
      }
      if (Object.keys(visits).length > 5) {
        lines.push("I'm starting to recognize these halls.")
      }
      break
    }

    case 'death': {
      if (memory.totalDeaths > 0) {
        const feared = getMostFearedName(memory)
        if (feared) {
          lines.push(`${feared}s again... I'll remember.`)
        }
      }
      if (memory.bestFloor > 1) {
        lines.push(`We'll make it past floor ${memory.bestFloor} someday.`)
      }
      break
    }

    case 'kill_streak': {
      if (memory.bestStreak > 5) {
        lines.push(`Beat our best streak of ${memory.bestStreak}!`)
      }
      if (memory.totalKills > 100) {
        lines.push(`Kill number ${memory.totalKills}. Still counting.`)
      }
      break
    }

    case 'room_cleared': {
      if (memory.roomsCleared > 0 && memory.roomsCleared % 25 === 0) {
        lines.push(`Room ${memory.roomsCleared}. Getting good at this.`)
      }
      break
    }
  }

  return lines
}

function enemyDisplayName(type: string): string {
  const names: Record<string, string> = {
    melee: 'melee',
    ranged: 'ranged',
    fast: 'fast',
    tank: 'tank',
    shielded: 'shielded',
    exploder: 'exploder',
    healer: 'healer',
    summoner: 'summoner',
    boss: 'boss',
  }
  return names[type] ?? type
}

function getMostFearedName(memory: PartnerMemoryStore): string | null {
  const entries = Object.entries(memory.fearedEnemies)
  if (entries.length === 0) return null
  entries.sort((a, b) => b[1] - a[1])
  return enemyDisplayName(entries[0][0])
}

// ── Speech Controller ──────────────────────────────────────────────

export class PartnerSpeechController {
  private lastSpeechTime = 0
  private lastLinePerTrigger = new Map<SpeechTrigger, number>()
  private recentKillTimestamps: number[] = []
  private personalityMood: PersonalityMood = 'balanced'
  private partnerMemory: PartnerMemoryStore | null = null
  /** Track recently spoken lines to avoid repetition across triggers */
  private recentLines: string[] = []
  private idleChatTimer = 0

  /** Set the personality mood for line selection */
  setPersonalityMood(mood: PersonalityMood): void {
    this.personalityMood = mood
  }

  /** Set partner memory for memory-reference lines */
  setPartnerMemory(memory: PartnerMemoryStore): void {
    this.partnerMemory = memory
  }

  /** Register a kill timestamp for streak tracking */
  registerKill(): void {
    this.recentKillTimestamps.push(Date.now())
    // Keep only kills within the last 5 seconds
    const cutoff = Date.now() - 5000
    this.recentKillTimestamps = this.recentKillTimestamps.filter(t => t > cutoff)
  }

  /** Check if there's an active kill streak */
  hasKillStreak(): boolean {
    const cutoff = Date.now() - 5000
    const recentKills = this.recentKillTimestamps.filter(t => t > cutoff)
    return recentKills.length >= SPEECH_KILL_STREAK_THRESHOLD
  }

  /** Try to get a speech line for the given trigger. Returns null if on cooldown or no line available. */
  trySpeak(trigger: SpeechTrigger, now: number): string | null {
    // Global cooldown check
    if (now - this.lastSpeechTime < SPEECH_COOLDOWN_MS) return null

    const line = this.pickLine(trigger)
    if (!line) return null

    this.lastSpeechTime = now
    this.trackRecentLine(line)
    return line
  }

  /** Force a speech line regardless of cooldown (for critical moments like boss phases) */
  forceSpeak(trigger: SpeechTrigger): string {
    const line = this.pickLine(trigger) ?? SPEECH_LINES[trigger]?.[0] ?? '...'
    this.lastSpeechTime = Date.now()
    this.trackRecentLine(line)
    return line
  }

  /**
   * Check for idle chatter opportunity. Call every frame.
   * Returns a line if enough time has passed since last speech and we're in a calm moment.
   */
  tryIdleChat(now: number, enemyCount: number): string | null {
    // Only chat when no enemies are around
    if (enemyCount > 0) {
      this.idleChatTimer = 0
      return null
    }

    this.idleChatTimer++

    // ~15 seconds of idle (at 60fps, ~900 frames) before attempting idle chatter
    if (this.idleChatTimer < 900) return null
    this.idleChatTimer = 0

    // Additional cooldown so it doesn't spam after the first idle line
    if (now - this.lastSpeechTime < SPEECH_COOLDOWN_MS * 2) return null

    return this.trySpeak('idle', now)
  }

  // ── Private ──

  private pickLine(trigger: SpeechTrigger): string | null {
    // Build combined line pool: base + personality flavor + memory
    const baseLines = SPEECH_LINES[trigger] ?? []
    const flavorLines = PERSONALITY_FLAVOR[trigger]?.[this.personalityMood] ?? []
    const memoryLines = getMemoryLines(trigger, this.partnerMemory)

    // Weighted pool: memory lines get 2x weight (they're rarer and more meaningful)
    const pool: string[] = [
      ...baseLines,
      ...flavorLines,
      ...memoryLines,
      ...memoryLines, // double-weight for memory lines
    ]

    if (pool.length === 0) return null

    // Filter out recently spoken lines
    const available = pool.filter(l => !this.recentLines.includes(l))
    const finalPool = available.length > 0 ? available : pool

    // Avoid repeating the same line for this trigger
    const lastIndex = this.lastLinePerTrigger.get(trigger) ?? -1
    let index = Math.floor(Math.random() * finalPool.length)

    // If we happen to pick the same line as last time for this trigger, try again
    if (finalPool.length > 1 && finalPool[index] === finalPool[lastIndex]) {
      index = (index + 1) % finalPool.length
    }

    this.lastLinePerTrigger.set(trigger, index)
    return finalPool[index]
  }

  private trackRecentLine(line: string): void {
    this.recentLines.push(line)
    if (this.recentLines.length > 8) {
      this.recentLines.shift()
    }
  }
}
