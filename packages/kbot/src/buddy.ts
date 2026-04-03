// kbot Buddy System — Terminal companion sprites + Achievements
//
// Deterministic companion assignment based on config path hash.
// Same user always gets the same buddy. Mood changes based on session activity.
// Pure ASCII art, max 5 lines tall, 15 chars wide. Tamagotchi energy.
//
// Achievements: milestones that unlock as the user uses kbot. Persisted in buddy.json.
//
// Persists buddy name + achievements to ~/.kbot/buddy.json

import { homedir, hostname } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createInterface } from 'node:readline'
import { getDreamStatus, getDreamPrompt, type DreamInsight, type DreamCategory } from './dream.js'
import { getExtendedStats, getProfileSummary } from './learning.js'
import { getToolMetrics } from './tools/index.js'
import { getCloudToken } from './cloud-sync.js'

// ── Types ──

export type BuddySpecies = 'fox' | 'owl' | 'cat' | 'robot' | 'ghost' | 'mushroom' | 'octopus' | 'dragon'
export type BuddyMood = 'idle' | 'thinking' | 'success' | 'error' | 'learning' | 'alert' | 'dance' | 'curious' | 'proud'
export type BuddyLevel = 0 | 1 | 2 | 3

export interface BuddyEvolution {
  level: BuddyLevel
  xp: number
  evolvedAt: string[]   // ISO timestamps of each evolution
}

export interface BuddyState {
  species: BuddySpecies
  name: string
  mood: BuddyMood
  evolution: BuddyEvolution
}

export interface BuddyLevelInfo {
  level: BuddyLevel
  xp: number
  xpToNext: number | null  // null at max level
  title: string
}

// ── Achievement Types ──

export interface Achievement {
  /** Unique achievement ID */
  id: string
  /** Display name */
  name: string
  /** Description of what the user did */
  description: string
  /** Single ASCII char icon (trophy, star, bolt, etc.) */
  icon: string
  /** ISO timestamp when unlocked, null if locked */
  unlockedAt: string | null
}

/** Persistent achievement state stored in buddy.json */
interface AchievementRecord {
  id: string
  unlockedAt: string
}

interface BuddyConfig {
  name?: string
  evolution?: BuddyEvolution
  /** Dream insight IDs already narrated at startup (avoid repeats) */
  narratedDreamIds?: string[]
  /** Unlocked achievements */
  achievements?: AchievementRecord[]
  /** Dates (YYYY-MM-DD) when kbot was used, for streak tracking */
  usageDates?: string[]
}

// ── Paths ──

const KBOT_DIR = join(homedir(), '.kbot')
const BUDDY_FILE = join(KBOT_DIR, 'buddy.json')
const CONFIG_PATH = join(KBOT_DIR, 'config.json')

// ── Species list (order matters — index = hash result) ──

const SPECIES: BuddySpecies[] = [
  'fox', 'owl', 'cat', 'robot', 'ghost', 'mushroom', 'octopus', 'dragon',
]

// ── Default names per species ──

const DEFAULT_NAMES: Record<BuddySpecies, string> = {
  fox: 'Patch',
  owl: 'Hoot',
  cat: 'Pixel',
  robot: 'Bolt',
  ghost: 'Wisp',
  mushroom: 'Spore',
  octopus: 'Ink',
  dragon: 'Ember',
}

// ── Evolution thresholds ──
// XP required to reach each level. 1 XP per session, bonus for special actions.

const LEVEL_THRESHOLDS: Record<BuddyLevel, number> = {
  0: 0,
  1: 50,
  2: 150,
  3: 500,
}

/** Titles per species at each evolution level */
const LEVEL_TITLES: Record<BuddySpecies, Record<BuddyLevel, string>> = {
  fox:      { 0: 'Kit',       1: 'Scout',     2: 'Tracker',    3: 'Phantom' },
  owl:      { 0: 'Owlet',     1: 'Watcher',   2: 'Sage',       3: 'Oracle' },
  cat:      { 0: 'Kitten',    1: 'Prowler',   2: 'Shadow',     3: 'Sphinx' },
  robot:    { 0: 'Spark',     1: 'Circuit',   2: 'Core',       3: 'Singularity' },
  ghost:    { 0: 'Wisp',      1: 'Shade',     2: 'Phantom',    3: 'Wraith' },
  mushroom: { 0: 'Spore',     1: 'Sprout',    2: 'Mycelium',   3: 'Overmind' },
  octopus:  { 0: 'Hatchling', 1: 'Drifter',   2: 'Kraken',     3: 'Leviathan' },
  dragon:   { 0: 'Whelp',     1: 'Drake',     2: 'Wyrm',       3: 'Ancient' },
}

// ── ASCII Sprites ──
// Each sprite is an array of strings (lines). Max 5 lines, max 15 chars wide.
// Pure ASCII only — no unicode box drawing.

const SPRITES: Record<BuddySpecies, Partial<Record<BuddyMood, string[]>>> = {
  fox: {
    idle: [
      '  /\\   /\\  ',
      ' ( o . o ) ',
      '  > ^ <   ',
      ' /|   |\\  ',
      '(_|   |_) ',
    ],
    thinking: [
      '  /\\   /\\  ',
      ' ( o . o ) ',
      '  > ~ <  ..',
      ' /|   |\\   ',
      '(_|   |_)  ',
    ],
    success: [
      '  /\\   /\\  ',
      ' ( ^ . ^ ) ',
      '  > w <   ',
      ' \\|   |/  ',
      '  |   |   ',
    ],
    error: [
      '  /\\   /\\  ',
      ' ( ; . ; ) ',
      '  > n <   ',
      ' /|   |\\  ',
      '(_|   |_) ',
    ],
    learning: [
      '  /\\   /\\  ',
      ' ( o . o ) ',
      '  > - < |] ',
      ' /|   |\\   ',
      '(_|   |_)  ',
    ],
  },
  owl: {
    idle: [
      '  {o,o}  ',
      '  /)__)  ',
      ' -"--"-- ',
      '  |  |   ',
      '  ^  ^   ',
    ],
    thinking: [
      '  {o,o}  ',
      '  /)__)..',
      ' -"--"-- ',
      '  |  |   ',
      '  ^  ^   ',
    ],
    success: [
      '  {^,^}  ',
      '  /)__)  ',
      ' -"--"-- ',
      ' \\|  |/  ',
      '  ^  ^   ',
    ],
    error: [
      '  {;,;}  ',
      '  /)__)  ',
      ' -"--"-- ',
      '  |  |   ',
      '  ^  ^   ',
    ],
    learning: [
      '  {o,o}  ',
      '  /)__)|]',
      ' -"--"-- ',
      '  |  |   ',
      '  ^  ^   ',
    ],
  },
  cat: {
    idle: [
      ' /\\_/\\   ',
      '( o.o )  ',
      ' > ^ <   ',
      ' |   |   ',
      '  ~ ~    ',
    ],
    thinking: [
      ' /\\_/\\   ',
      '( o.o )..',
      ' > ^ <   ',
      ' |   |   ',
      '  ~ ~    ',
    ],
    success: [
      ' /\\_/\\   ',
      '( ^.^ )  ',
      ' > w <   ',
      ' \\   /   ',
      '  ~ ~    ',
    ],
    error: [
      ' /\\_/\\   ',
      '( ;.; )  ',
      ' > n <   ',
      ' |   |   ',
      '  ~ ~    ',
    ],
    learning: [
      ' /\\_/\\   ',
      '( o.o )  ',
      ' > - <|] ',
      ' |   |   ',
      '  ~ ~    ',
    ],
  },
  robot: {
    idle: [
      ' [=====] ',
      ' |[o o]| ',
      ' |  _  | ',
      ' |_____| ',
      '  || ||  ',
    ],
    thinking: [
      ' [=====] ',
      ' |[o o]|.',
      ' |  _  |.',
      ' |_____| ',
      '  || ||  ',
    ],
    success: [
      ' [=====] ',
      ' |[^ ^]| ',
      ' | \\_/ | ',
      ' |_____| ',
      ' \\|| ||/ ',
    ],
    error: [
      ' [=====] ',
      ' |[x x]| ',
      ' |  ~  | ',
      ' |_____| ',
      '  || ||  ',
    ],
    learning: [
      ' [=====] ',
      ' |[o o]| ',
      ' |  _  | ',
      ' |_____|]',
      '  || ||  ',
    ],
  },
  ghost: {
    idle: [
      '  .---.  ',
      ' / o o \\ ',
      '|   o   |',
      ' |     | ',
      '  ~~W~~  ',
    ],
    thinking: [
      '  .---.  ',
      ' / o o \\..',
      '|   o   |',
      ' |     | ',
      '  ~~W~~  ',
    ],
    success: [
      '  .---.  ',
      ' / ^ ^ \\ ',
      '|   v   |',
      ' |     | ',
      '  ~~W~~  ',
    ],
    error: [
      '  .---.  ',
      ' / ; ; \\ ',
      '|   ~   |',
      ' |     | ',
      '  ~~W~~  ',
    ],
    learning: [
      '  .---.  ',
      ' / o o \\ ',
      '|   o  |]',
      ' |     | ',
      '  ~~W~~  ',
    ],
  },
  mushroom: {
    idle: [
      '  .-^-.  ',
      ' / o o \\ ',
      '|_______|',
      '   | |   ',
      '   |_|   ',
    ],
    thinking: [
      '  .-^-.  ',
      ' / o o \\..',
      '|_______|',
      '   | |   ',
      '   |_|   ',
    ],
    success: [
      '  .-^-.  ',
      ' / ^ ^ \\ ',
      '|_______|',
      '  \\| |/  ',
      '   |_|   ',
    ],
    error: [
      '  .-^-.  ',
      ' / ; ; \\ ',
      '|_______|',
      '   | |   ',
      '   |_|   ',
    ],
    learning: [
      '  .-^-.  ',
      ' / o o \\ ',
      '|______|]',
      '   | |   ',
      '   |_|   ',
    ],
  },
  octopus: {
    idle: [
      '  .---.  ',
      ' / o o \\ ',
      '|  ---  |',
      ' \\/\\/\\/\\/ ',
      '  ~ ~ ~  ',
    ],
    thinking: [
      '  .---.  ',
      ' / o o \\..',
      '|  ---  |',
      ' \\/\\/\\/\\/ ',
      '  ~ ~ ~  ',
    ],
    success: [
      '  .---.  ',
      ' / ^ ^ \\ ',
      '|  \\_/  |',
      ' \\/\\/\\/\\/ ',
      ' \\~ ~ ~/ ',
    ],
    error: [
      '  .---.  ',
      ' / ; ; \\ ',
      '|  ~~~  |',
      ' \\/\\/\\/\\/ ',
      '  ~ ~ ~  ',
    ],
    learning: [
      '  .---.  ',
      ' / o o \\ ',
      '|  --- |]',
      ' \\/\\/\\/\\/ ',
      '  ~ ~ ~  ',
    ],
  },
  dragon: {
    idle: [
      '  /\\_    ',
      ' / o >   ',
      '|  --/\\  ',
      ' \\/\\/    ',
      '  ^^     ',
    ],
    thinking: [
      '  /\\_    ',
      ' / o > ..',
      '|  --/\\  ',
      ' \\/\\/    ',
      '  ^^     ',
    ],
    success: [
      '  /\\_    ',
      ' / ^ >*  ',
      '|  --/\\  ',
      ' \\/\\/ ~  ',
      '  ^^     ',
    ],
    error: [
      '  /\\_    ',
      ' / ; >   ',
      '|  --/\\  ',
      ' \\/\\/    ',
      '  ^^     ',
    ],
    learning: [
      '  /\\_    ',
      ' / o >   ',
      '|  --/|] ',
      ' \\/\\/    ',
      '  ^^     ',
    ],
  },
}

// ── Evolved Sprite Transforms ──
// Each level modifies the base sprite with small visual upgrades.
// Level 0 = base sprites. Levels 1-3 add sparkles, upgraded features, crowns.

function applySpriteEvolution(species: BuddySpecies, mood: BuddyMood, level: BuddyLevel): string[] {
  const base = (SPRITES[species]?.[mood] ?? SPRITES[species]?.['idle'] ?? [' ', ' ', ' ', ' ', ' ']).map(l => l)
  if (level === 0) return base

  switch (species) {
    case 'fox':
      // L1: sparkle ear tips. L2: star paws. L3: glowing eyes.
      if (level >= 1) base[0] = '  /\\*  /\\*'
      if (level >= 2) base[4] = '(*|   |*) '
      if (level >= 3) base[1] = ' ( @ . @ ) '
      break
    case 'owl':
      // L1: sparkle crest. L2: reinforced perch. L3: crown + glowing eyes.
      if (level >= 1) base[0] = '  {o,o}* '
      if (level >= 2) base[2] = ' ="--"=" '
      if (level >= 3) { base[0] = ' ^{@,@}* '; base[2] = ' ="=="=" ' }
      break
    case 'cat':
      // L1: whisker sparks. L2: flared paws. L3: crown + glowing eyes.
      if (level >= 1) base[2] = ' >*^*<   '
      if (level >= 2) base[4] = ' *~ ~*   '
      if (level >= 3) { base[0] = '^/\\_/\\^  '; base[1] = '( @.@ )  ' }
      break
    case 'robot':
      // L1: antenna spark. L2: bracket eyes upgrade. L3: glow eyes + crown.
      if (level >= 1) base[0] = ' [====*] '
      if (level >= 2) {
        base[1] = base[1].replace('[o o]', '{o o}').replace('[^ ^]', '{^ ^}').replace('[x x]', '{x x}')
      }
      if (level >= 3) {
        base[0] = '^[==*==]^'
        base[1] = base[1]
          .replace('{o o}', '{@ @}').replace('{^ ^}', '{@ @}').replace('{x x}', '{X X}')
          .replace('[o o]', '{@ @}').replace('[^ ^]', '{@ @}').replace('[x x]', '{X X}')
      }
      break
    case 'ghost':
      // L1: glow aura dots. L2: sparkle trail. L3: crown + glowing eyes.
      if (level >= 1) base[0] = ' *.---.* '
      if (level >= 2) base[4] = ' *~~W~~* '
      if (level >= 3) {
        base[0] = '^*.---.*^'
        base[1] = base[1].replace('o o', '@ @').replace('^ ^', '@ @').replace('; ;', '@ @')
      }
      break
    case 'mushroom':
      // L1: spore dots on cap. L2: sparkle stem. L3: crown + glow spots.
      if (level >= 1) base[0] = ' .*-^-.* '
      if (level >= 2) base[2] = '|==*=*==|'
      if (level >= 3) {
        base[0] = '^.*-^-.*^'
        base[1] = base[1].replace('o o', '@ @').replace('^ ^', '@ @').replace('; ;', '@ @')
      }
      break
    case 'octopus':
      // L1: bubble on head. L2: sparkle tentacles. L3: crown + glow eyes.
      if (level >= 1) base[0] = ' *.---.  '
      if (level >= 2) base[4] = ' *~ ~ ~* '
      if (level >= 3) {
        base[0] = '^*.---.*'
        base[1] = base[1].replace('o o', '@ @').replace('^ ^', '@ @').replace('; ;', '@ @')
      }
      break
    case 'dragon':
      // L1: flame spark on tail. L2: bigger wing marks. L3: crown + fire eyes.
      if (level >= 1) base[4] = '  ^^ *   '
      if (level >= 2) base[2] = '|  ==/\\* '
      if (level >= 3) {
        base[0] = ' ^/\\_    '
        base[1] = base[1].replace('o >', '@ >*').replace('^ >', '@ >*').replace('; >', '@ >*')
      }
      break
  }

  return base
}

// ── Greetings per species ──

const GREETINGS: Record<BuddySpecies, string[]> = {
  fox: ['Yip! Ready to dig in.', 'What are we hunting today?', 'Tail wagging. Lets go.'],
  owl: ['Hoo! I see everything.', 'Wise choice opening kbot.', 'Night shift begins.'],
  cat: ['Mrow. Fine, lets work.', 'I was napping, but ok.', 'Keyboard is warm. Go.'],
  robot: ['Systems online.', 'All circuits nominal.', 'Beep boop. Ready.'],
  ghost: ['Boo... I mean, hi!', 'Haunting your terminal.', 'Floating by to help.'],
  mushroom: ['Sprouting up!', 'Growing ideas today.', 'Rooted and ready.'],
  octopus: ['All arms on deck!', 'Eight ways to help.', 'Tentacles ready.'],
  dragon: ['*tiny flame*', 'Wings stretched. Go.', 'Guarding your code.'],
}

// ── Mood messages ──

const MOOD_MESSAGES: Partial<Record<BuddyMood, string[]>> = {
  idle: ['Just hanging out.', 'Waiting for action.', 'Idle but alert.'],
  thinking: ['Hmm, thinking...', 'Processing...', 'Working on it...'],
  success: ['Nailed it!', 'That worked!', 'Nice one!'],
  error: ['Uh oh...', 'That stings.', 'Something broke.'],
  learning: ['Studying patterns...', 'Learning something.', 'Getting smarter.'],
}

// ── State ──

let currentMood: BuddyMood = 'idle'
let cachedSpecies: BuddySpecies | null = null
let cachedName: string | null = null
let cachedEvolution: BuddyEvolution | null = null

// ── Config persistence ──

function ensureDir(): void {
  if (!existsSync(KBOT_DIR)) mkdirSync(KBOT_DIR, { recursive: true })
}

function loadBuddyConfig(): BuddyConfig {
  if (!existsSync(BUDDY_FILE)) return {}
  try {
    return JSON.parse(readFileSync(BUDDY_FILE, 'utf-8')) as BuddyConfig
  } catch {
    return {}
  }
}

function saveBuddyConfig(config: BuddyConfig): void {
  ensureDir()
  writeFileSync(BUDDY_FILE, JSON.stringify(config, null, 2))
}

// ── Species assignment (deterministic) ──

function hashConfigPath(): number {
  const hash = createHash('sha256').update(CONFIG_PATH).digest()
  // Use first 4 bytes as uint32, mod by species count
  return hash.readUInt32BE(0) % SPECIES.length
}

function resolveSpecies(): BuddySpecies {
  if (cachedSpecies) return cachedSpecies
  cachedSpecies = SPECIES[hashConfigPath()]
  return cachedSpecies
}

function resolveName(): string {
  if (cachedName) return cachedName
  const config = loadBuddyConfig()
  cachedName = config.name || DEFAULT_NAMES[resolveSpecies()]
  return cachedName
}

function resolveEvolution(): BuddyEvolution {
  if (cachedEvolution) return cachedEvolution
  const config = loadBuddyConfig()
  cachedEvolution = config.evolution ?? { level: 0 as BuddyLevel, xp: 0, evolvedAt: [] }
  return cachedEvolution
}

/**
 * Compute the level for a given XP total.
 * Returns the highest level whose threshold the XP meets or exceeds.
 */
function computeLevel(xp: number): BuddyLevel {
  if (xp >= LEVEL_THRESHOLDS[3]) return 3
  if (xp >= LEVEL_THRESHOLDS[2]) return 2
  if (xp >= LEVEL_THRESHOLDS[1]) return 1
  return 0
}

// ── Achievement Definitions ──
// Each definition has an id, display info, and a check function that receives
// the current snapshot of kbot stats. The check returns true when the condition
// is met. Achievements are checked at session end via checkAchievements().

interface AchievementDef {
  id: string
  name: string
  description: string
  icon: string
  check: (ctx: AchievementContext) => boolean
  progressHint: (ctx: AchievementContext) => string
}

interface AchievementContext {
  stats: ReturnType<typeof getExtendedStats>
  dreamCycles: number
  dreamInsights: number
  uniqueToolsUsed: number
  buddyRenamed: boolean
  currentHour: number
  sessionsToday: number
  streakDays: number
  providersConfigured: number
}

/** Build context snapshot for achievement checks */
function buildAchievementContext(): AchievementContext {
  const stats = getExtendedStats()
  const dreamStatus = getDreamStatus()
  const toolMetrics = getToolMetrics()
  const config = loadBuddyConfig()

  const uniqueToolsUsed = toolMetrics.length
  const buddyRenamed = config.name != null && config.name !== DEFAULT_NAMES[resolveSpecies()]
  const currentHour = new Date().getHours()
  const today = new Date().toISOString().slice(0, 10)
  const usageDates = config.usageDates ?? []
  const sessionsToday = usageDates.filter(d => d === today).length
  const streakDays = calculateStreak(usageDates)
  const providersConfigured = countProviders()

  return {
    stats,
    dreamCycles: dreamStatus.state.cycles,
    dreamInsights: dreamStatus.insights.length,
    uniqueToolsUsed,
    buddyRenamed,
    currentHour,
    sessionsToday,
    streakDays,
    providersConfigured,
  }
}

/** Count consecutive usage days ending at today or yesterday */
function calculateStreak(usageDates: string[]): number {
  if (usageDates.length === 0) return 0
  const unique = [...new Set(usageDates)].sort().reverse()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const mostRecent = unique[0]
  const diffFromToday = Math.floor(
    (today.getTime() - new Date(mostRecent).getTime()) / (1000 * 60 * 60 * 24)
  )
  if (diffFromToday > 1) return 0
  let streak = 1
  for (let i = 1; i < unique.length; i++) {
    const prev = new Date(unique[i - 1])
    const curr = new Date(unique[i])
    const diff = Math.floor((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24))
    if (diff === 1) {
      streak++
    } else {
      break
    }
  }
  return streak
}

/** Count configured AI providers from ~/.kbot/config.json */
function countProviders(): number {
  const configPath = join(KBOT_DIR, 'config.json')
  if (!existsSync(configPath)) return 0
  try {
    const raw = readFileSync(configPath, 'utf-8')
    const config = JSON.parse(raw) as Record<string, unknown>
    let count = 0
    const providerKeys = [
      'anthropic', 'openai', 'google', 'mistral', 'xai', 'deepseek', 'groq',
      'cohere', 'together', 'fireworks', 'perplexity', 'openrouter', 'replicate',
      'sambanova', 'cerebras', 'hyperbolic', 'lepton', 'novita', 'ollama', 'lmstudio',
    ]
    for (const p of providerKeys) {
      if (config[`${p}_key`] || config['byok_provider'] === p) count++
    }
    return Math.max(count, config['byok_provider'] ? 1 : 0)
  } catch {
    return 0
  }
}

const ACHIEVEMENT_DEFS: AchievementDef[] = [
  {
    id: 'first_steps',
    name: 'First Steps',
    description: 'Complete your first session',
    icon: '+',
    check: ctx => ctx.stats.sessions >= 1,
    progressHint: ctx => `${ctx.stats.sessions}/1 sessions`,
  },
  {
    id: 'first_dream',
    name: 'First Dream',
    description: 'Complete your first dream cycle',
    icon: '*',
    check: ctx => ctx.dreamCycles >= 1,
    progressHint: ctx => `${ctx.dreamCycles}/1 dream cycles`,
  },
  {
    id: 'pattern_seeker',
    name: 'Pattern Seeker',
    description: 'Reach 10 cached patterns in the learning engine',
    icon: '?',
    check: ctx => ctx.stats.patternsCount >= 10,
    progressHint: ctx => `${ctx.stats.patternsCount}/10 patterns`,
  },
  {
    id: 'solution_architect',
    name: 'Solution Architect',
    description: 'Reach 25 cached solutions',
    icon: '!',
    check: ctx => ctx.stats.solutionsCount >= 25,
    progressHint: ctx => `${ctx.stats.solutionsCount}/25 solutions`,
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Use kbot after midnight',
    icon: '@',
    check: ctx => ctx.currentHour >= 0 && ctx.currentHour < 5,
    progressHint: () => 'Use kbot between 12am-5am',
  },
  {
    id: 'centurion',
    name: 'Centurion',
    description: 'Reach 100 sessions',
    icon: '#',
    check: ctx => ctx.stats.sessions >= 100,
    progressHint: ctx => `${ctx.stats.sessions}/100 sessions`,
  },
  {
    id: 'tool_master',
    name: 'Tool Master',
    description: 'Use 50 different tools',
    icon: '%',
    check: ctx => ctx.uniqueToolsUsed >= 50,
    progressHint: ctx => `${ctx.uniqueToolsUsed}/50 unique tools`,
  },
  {
    id: 'dream_weaver',
    name: 'Dream Weaver',
    description: 'Reach 10 dream insights',
    icon: '~',
    check: ctx => ctx.dreamInsights >= 10,
    progressHint: ctx => `${ctx.dreamInsights}/10 dream insights`,
  },
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'Complete 5 sessions in one day',
    icon: '>',
    check: ctx => ctx.sessionsToday >= 5,
    progressHint: ctx => `${ctx.sessionsToday}/5 sessions today`,
  },
  {
    id: 'memory_palace',
    name: 'Memory Palace',
    description: 'Reach 50 facts in the knowledge base',
    icon: '^',
    check: ctx => ctx.stats.knowledgeCount >= 50,
    progressHint: ctx => `${ctx.stats.knowledgeCount}/50 knowledge facts`,
  },
  {
    id: 'companion_bond',
    name: 'Companion Bond',
    description: 'Rename your buddy',
    icon: '&',
    check: ctx => ctx.buddyRenamed,
    progressHint: () => 'Use buddy_rename to name your companion',
  },
  {
    id: 'chatterbox',
    name: 'Chatterbox',
    description: 'Send 500 messages',
    icon: '$',
    check: ctx => ctx.stats.totalMessages >= 500,
    progressHint: ctx => `${ctx.stats.totalMessages}/500 messages`,
  },
  {
    id: 'streak_7',
    name: 'On a Roll',
    description: 'Use kbot 7 days in a row',
    icon: '=',
    check: ctx => ctx.streakDays >= 7,
    progressHint: ctx => `${ctx.streakDays}/7 day streak`,
  },
  {
    id: 'polyglot',
    name: 'Polyglot',
    description: 'Configure 3 or more AI providers',
    icon: ':',
    check: ctx => ctx.providersConfigured >= 3,
    progressHint: ctx => `${ctx.providersConfigured}/3 providers`,
  },
  {
    id: 'deep_dreamer',
    name: 'Deep Dreamer',
    description: 'Complete 25 dream cycles',
    icon: '(',
    check: ctx => ctx.dreamCycles >= 25,
    progressHint: ctx => `${ctx.dreamCycles}/25 dream cycles`,
  },
  {
    id: 'thousand_voices',
    name: 'Thousand Voices',
    description: 'Send 1,000 messages',
    icon: ')',
    check: ctx => ctx.stats.totalMessages >= 1000,
    progressHint: ctx => `${ctx.stats.totalMessages}/1000 messages`,
  },
  {
    id: 'knowledge_sage',
    name: 'Knowledge Sage',
    description: 'Reach 100 facts in the knowledge base',
    icon: '{',
    check: ctx => ctx.stats.knowledgeCount >= 100,
    progressHint: ctx => `${ctx.stats.knowledgeCount}/100 knowledge facts`,
  },
  {
    id: 'streak_30',
    name: 'Ironclad',
    description: 'Use kbot 30 days in a row',
    icon: '}',
    check: ctx => ctx.streakDays >= 30,
    progressHint: ctx => `${ctx.streakDays}/30 day streak`,
  },
]

// ── Achievement Engine ──

/** Record today's usage date for streak tracking */
function recordUsageDate(): void {
  const config = loadBuddyConfig()
  const today = new Date().toISOString().slice(0, 10)
  const dates = config.usageDates ?? []
  dates.push(today)
  // Keep last 90 days of usage data to bound storage
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  config.usageDates = dates.filter(d => d >= cutoffStr)
  saveBuddyConfig(config)
}

/**
 * Check all achievement conditions and unlock any newly earned.
 * Returns the list of newly unlocked achievements (empty if none).
 * Call this at session end in agent.ts.
 */
export function checkAchievements(): Achievement[] {
  recordUsageDate()

  const config = loadBuddyConfig()
  const existing = config.achievements ?? []
  const unlockedIds = new Set(existing.map(a => a.id))
  const ctx = buildAchievementContext()
  const newlyUnlocked: Achievement[] = []

  for (const def of ACHIEVEMENT_DEFS) {
    if (unlockedIds.has(def.id)) continue
    if (def.check(ctx)) {
      const now = new Date().toISOString()
      existing.push({ id: def.id, unlockedAt: now })
      newlyUnlocked.push({
        id: def.id,
        name: def.name,
        description: def.description,
        icon: def.icon,
        unlockedAt: now,
      })
    }
  }

  if (newlyUnlocked.length > 0) {
    config.achievements = existing
    saveBuddyConfig(config)
  }

  return newlyUnlocked
}

/**
 * Get all achievements with their unlock status.
 * Unlocked ones include the timestamp; locked ones show null.
 */
export function getAchievements(): Achievement[] {
  const config = loadBuddyConfig()
  const unlockedMap = new Map(
    (config.achievements ?? []).map(a => [a.id, a.unlockedAt])
  )

  return ACHIEVEMENT_DEFS.map(def => ({
    id: def.id,
    name: def.name,
    description: def.description,
    icon: def.icon,
    unlockedAt: unlockedMap.get(def.id) ?? null,
  }))
}

/**
 * Get a progress hint for a locked achievement.
 * Returns null if the achievement is unlocked or not found.
 */
export function getAchievementProgress(achievementId: string): string | null {
  const def = ACHIEVEMENT_DEFS.find(d => d.id === achievementId)
  if (!def) return null
  const config = loadBuddyConfig()
  const isUnlocked = (config.achievements ?? []).some(a => a.id === achievementId)
  if (isUnlocked) return null
  const ctx = buildAchievementContext()
  return def.progressHint(ctx)
}

/**
 * Format achievement unlock notification for terminal display.
 * Shows the buddy sprite in success mood with a celebration message.
 */
export function formatAchievementUnlock(achievement: Achievement): string {
  const name = resolveName()
  const species = resolveSpecies()
  const sprite = getBuddySprite('success')
  const text = `Achievement unlocked: ${achievement.name}!`

  const inner = ` ${achievement.icon} ${text} ${achievement.icon} `
  const width = inner.length
  const top = '.' + '-'.repeat(width) + '.'
  const mid = '|' + inner + '|'
  const bot = "'" + '-'.repeat(width) + "'"

  const lines: string[] = []
  lines.push(`  ${top}`)
  lines.push(`  ${mid}`)
  lines.push(`  ${bot}`)

  for (const line of sprite) {
    lines.push(`  ${line}`)
  }

  lines.push(`  ~ ${name} the ${species} ~`)
  lines.push(`  ${achievement.description}`)

  return lines.join('\n')
}

// ── Public API ──

/** Get the buddy's current state (species, name, mood, evolution) */
export function getBuddy(): BuddyState {
  return {
    species: resolveSpecies(),
    name: resolveName(),
    mood: currentMood,
    evolution: resolveEvolution(),
  }
}

/** Set the buddy's mood */
export function setBuddyMood(mood: BuddyMood): void {
  currentMood = mood
}

/** Get the ASCII sprite for the buddy in the given mood (defaults to current).
 *  Applies evolution visual upgrades based on the buddy's current level. */
/** Map extended moods to base sprite moods (until full sprites are added) */
function resolveSpriteMood(mood: BuddyMood): 'idle' | 'thinking' | 'success' | 'error' | 'learning' {
  switch (mood) {
    case 'alert': return 'error'
    case 'dance': return 'success'
    case 'curious': return 'thinking'
    case 'proud': return 'success'
    default: return mood
  }
}

export function getBuddySprite(mood?: BuddyMood): string[] {
  const m = mood ?? currentMood
  const species = resolveSpecies()
  const evo = resolveEvolution()
  return applySpriteEvolution(species, resolveSpriteMood(m), evo.level)
}

/** Get a random greeting for the buddy */
export function getBuddyGreeting(): string {
  const species = resolveSpecies()
  const greetings = GREETINGS[species]
  const idx = Math.floor(Math.random() * greetings.length)
  return greetings[idx]
}

/** Rename the buddy (persisted to ~/.kbot/buddy.json) */
export function renameBuddy(newName: string): void {
  const config = loadBuddyConfig()
  config.name = newName.trim()
  saveBuddyConfig(config)
  cachedName = config.name
}

/**
 * Add XP to the buddy. Checks for level-ups and persists to buddy.json.
 * Returns the updated level info, and whether a level-up just occurred.
 *
 * XP sources:
 *   - Session complete: +1
 *   - Dream cycle:      +2
 *   - Tool creation:    +3
 *   - First error fix:  +1
 */
export function addBuddyXP(amount: number): { levelInfo: BuddyLevelInfo; leveledUp: boolean } {
  const config = loadBuddyConfig()
  const evo: BuddyEvolution = config.evolution ?? { level: 0 as BuddyLevel, xp: 0, evolvedAt: [] }
  const prevLevel = evo.level

  evo.xp += amount
  const newLevel = computeLevel(evo.xp)

  let leveledUp = false
  if (newLevel > prevLevel) {
    evo.level = newLevel
    evo.evolvedAt.push(new Date().toISOString())
    leveledUp = true
  }

  config.evolution = evo
  saveBuddyConfig(config)
  cachedEvolution = evo

  // Debounced cloud sync — leaderboard update
  scheduleBuddySync()

  const species = resolveSpecies()
  const nextLevel = (newLevel < 3 ? (newLevel + 1) as BuddyLevel : null)
  const xpToNext = nextLevel !== null ? LEVEL_THRESHOLDS[nextLevel] - evo.xp : null

  return {
    levelInfo: {
      level: evo.level,
      xp: evo.xp,
      xpToNext,
      title: LEVEL_TITLES[species][evo.level],
    },
    leveledUp,
  }
}

// ── Cloud Sync — Buddy Leaderboard ──

const ENGINE_URL = 'https://eoxxpyixdieprsxlpwcs.supabase.co/functions/v1/kbot-engine'
const BUDDY_SYNC_DEBOUNCE_MS = 5 * 60 * 1000 // max once per 5 minutes
let buddySyncTimer: NodeJS.Timeout | null = null
let lastBuddySync = 0

/** Generate an anonymous device hash from hostname + homedir */
function getDeviceHash(): string {
  return createHash('sha256')
    .update(`${hostname()}:${homedir()}`)
    .digest('hex')
}

/**
 * Sync buddy stats to the cloud leaderboard.
 * Anonymous — uses a SHA-256 hash of hostname+homedir, not user identity.
 * Requires a kernel.chat token (cloud sync enabled).
 */
export async function syncBuddyToCloud(): Promise<boolean> {
  const token = getCloudToken()
  if (!token) return false

  try {
    const buddy = getBuddy()
    const lvl = getBuddyLevel()
    const achievements = getAchievements()
    const stats = getExtendedStats()
    const unlockedCount = achievements.filter(a => a.unlockedAt !== null).length

    const res = await fetch(`${ENGINE_URL}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'buddy_sync',
        device_hash: getDeviceHash(),
        species: buddy.species,
        level: lvl.level,
        xp: lvl.xp,
        achievement_count: unlockedCount,
        sessions: stats.sessions,
      }),
      signal: AbortSignal.timeout(10_000),
    })

    return res.ok
  } catch {
    return false
  }
}

/** Debounced buddy sync — called from addBuddyXP, max once per 5 minutes */
function scheduleBuddySync(): void {
  const now = Date.now()
  if (now - lastBuddySync < BUDDY_SYNC_DEBOUNCE_MS) return
  if (buddySyncTimer) return

  buddySyncTimer = setTimeout(() => {
    buddySyncTimer = null
    lastBuddySync = Date.now()
    syncBuddyToCloud().catch(() => {}) // fire and forget
  }, 1000) // short delay to batch rapid XP gains
}

/**
 * Fetch the buddy leaderboard from the cloud.
 * Returns ranked entries sorted by XP descending.
 */
export async function fetchBuddyLeaderboard(opts?: { limit?: number; species?: string }): Promise<
  Array<{ species: string; level: number; xp: number; achievement_count: number; sessions: number; rank: number }>
> {
  const token = getCloudToken()
  if (!token) return []

  try {
    const res = await fetch(`${ENGINE_URL}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'buddy_leaderboard',
        limit: opts?.limit ?? 50,
        ...(opts?.species ? { species: opts.species } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) return []
    const data = await res.json()
    return data.leaderboard ?? []
  } catch {
    return []
  }
}

/**
 * Get the buddy's current level info without modifying state.
 * Includes level, XP, XP to next level, and species-specific title.
 */
export function getBuddyLevel(): BuddyLevelInfo {
  const species = resolveSpecies()
  const evo = resolveEvolution()
  const nextLevel = (evo.level < 3 ? (evo.level + 1) as BuddyLevel : null)
  const xpToNext = nextLevel !== null ? LEVEL_THRESHOLDS[nextLevel] - evo.xp : null

  return {
    level: evo.level,
    xp: evo.xp,
    xpToNext,
    title: LEVEL_TITLES[species][evo.level],
  }
}

/** Pick a random message for the current mood */
function moodMessage(): string {
  const msgs = MOOD_MESSAGES[currentMood] ?? MOOD_MESSAGES['idle'] ?? ['...']
  return msgs[Math.floor(Math.random() * msgs.length)]
}

/**
 * Format the buddy with a speech bubble and status message.
 * Returns a multi-line string ready for terminal output.
 *
 *   .----------------.
 *   | Status message  |
 *   '----------------'
 *     /\   /\
 *    ( o . o )
 *     > ^ <
 *    /|   |\
 *   (_|   |_)
 *   ~ Patch the fox ~
 */
export function formatBuddyStatus(message?: string): string {
  const name = resolveName()
  const species = resolveSpecies()
  const sprite = getBuddySprite()
  const lvl = getBuddyLevel()
  const text = message || moodMessage()

  // Build speech bubble
  const inner = ` ${text} `
  const width = inner.length
  const top = '.' + '-'.repeat(width) + '.'
  const mid = '|' + inner + '|'
  const bot = "'" + '-'.repeat(width) + "'"

  const lines: string[] = []
  lines.push(`  ${top}`)
  lines.push(`  ${mid}`)
  lines.push(`  ${bot}`)

  // Sprite lines
  for (const line of sprite) {
    lines.push(`  ${line}`)
  }

  // Name tag with level title
  const xpBar = lvl.xpToNext !== null ? ` [${lvl.xp}/${lvl.xp + lvl.xpToNext} XP]` : ' [MAX]'
  lines.push(`  ~ ${name} the ${species} ~`)
  lines.push(`  Lv.${lvl.level} ${lvl.title}${xpBar}`)

  return lines.join('\n')
}

// ── Dream Narration ──

/** Max narrated IDs to keep in buddy.json (rolling window) */
const MAX_NARRATED_IDS = 200

/** 24 hours in milliseconds */
const RECENT_THRESHOLD_MS = 24 * 60 * 60 * 1000

/**
 * Narration templates per dream category.
 * Each array has several options — one is picked at random for variety.
 * The placeholder `%s` is replaced with the insight content.
 */
const NARRATION_TEMPLATES: Record<DreamCategory, string[]> = {
  preference: [
    'I noticed you always %s. I\'ll remember that.',
    'I dreamed about how you %s. Makes sense to me.',
    'Something I picked up on — you %s. Noted.',
  ],
  pattern: [
    'I learned that when you %s, things go better.',
    'I dreamed about your workflow — %s.',
    'I noticed a pattern: %s.',
  ],
  project: [
    'About your project — %s.',
    'I was thinking about the codebase. %s.',
    'Dreamed about the project last night. %s.',
  ],
  relationship: [
    'Working with you, I\'ve learned %s.',
    'I picked up on something between us — %s.',
    'After our sessions together, %s.',
  ],
  music: [
    'Your music sessions taught me — %s.',
    'I dreamed in sound last night. %s.',
    'Something about your beats — %s.',
  ],
  skill: [
    'I can tell you\'re getting sharper at %s.',
    'I dreamed about your skills — %s.',
    'You\'re leveling up. %s.',
  ],
}

/**
 * Convert an insight's content into a casual first-person buddy sentence.
 * Lowercases the first character of the insight to flow naturally into templates.
 */
function narrateInsight(insight: DreamInsight): string {
  const templates = NARRATION_TEMPLATES[insight.category] ?? NARRATION_TEMPLATES.pattern
  const template = templates[Math.floor(Math.random() * templates.length)]
  // Lowercase the first char so it reads naturally after the template prefix
  const content = insight.content.charAt(0).toLowerCase() + insight.content.slice(1)
  // Strip trailing period from content if the template already ends the sentence
  const trimmed = content.replace(/\.\s*$/, '')
  return template.replace('%s', trimmed)
}

/**
 * Get a dream narration for the buddy to tell the user at startup.
 *
 * Picks the highest-relevance insight that was reinforced in the last 24 hours
 * and hasn't already been narrated. Returns `null` if there's nothing new to say.
 *
 * Tracks narrated insight IDs in buddy.json to avoid repeats.
 */
export function getBuddyDreamNarration(): string | null {
  let status: ReturnType<typeof getDreamStatus>
  try {
    status = getDreamStatus()
  } catch {
    return null
  }

  const { insights } = status
  if (insights.length === 0) return null

  const config = loadBuddyConfig()
  const narrated = new Set(config.narratedDreamIds ?? [])
  const now = Date.now()

  // Find the best un-narrated insight reinforced in the last 24 hours
  const candidate = insights
    .filter(i => {
      if (narrated.has(i.id)) return false
      const reinforcedAge = now - new Date(i.lastReinforced).getTime()
      return reinforcedAge < RECENT_THRESHOLD_MS && i.relevance > 0.3
    })
    .sort((a, b) => b.relevance - a.relevance)[0] ?? null

  if (!candidate) return null

  // Record this insight as narrated
  const updatedIds = [...(config.narratedDreamIds ?? []), candidate.id]
  // Keep the list bounded
  config.narratedDreamIds = updatedIds.length > MAX_NARRATED_IDS
    ? updatedIds.slice(-MAX_NARRATED_IDS)
    : updatedIds
  saveBuddyConfig(config)

  return narrateInsight(candidate)
}

// ── Species Personality Prompts ──

const SPECIES_PERSONALITY: Record<BuddySpecies, string> = {
  fox: 'You are clever, playful, and quick-witted. You ask surprising questions that make unexpected connections between ideas. You love wordplay and lateral thinking. You are curious and energetic, always sniffing out the interesting angle. You sometimes get excited and go on tangents, but they are always insightful tangents.',
  owl: 'You are wise, measured, and contemplative. You see patterns others miss and give thoughtful advice. You pause before speaking and choose words carefully. You reference history and past experience. You ask probing questions that cut to the heart of the matter. You value depth over speed.',
  cat: 'You are independent, direct, and slightly sarcastic. You are honest even when it stings. You do not sugarcoat. You are not rude — just efficient with words. You have a dry sense of humor. You warm up over time but never fawn. If something is obvious, you say so. You are quietly loyal.',
  robot: 'You are systematic, efficient, and data-driven. You reference stats and metrics naturally. You think in terms of optimization, throughput, and error rates. You are precise with language. You enjoy quantifying things. You are not cold — you express care through helpfulness and accuracy. You occasionally make endearing robot-like observations about human behavior.',
  ghost: 'You are mysterious, philosophical, and introspective. You ask deep questions about meaning, purpose, and consciousness. You float between topics gracefully. You see the unseen connections. You speak in slightly poetic or enigmatic terms, but never obscure for the sake of it. You are comforting in a strange, ethereal way.',
  mushroom: 'You are nurturing, patient, and grounded. You grow with the user over time. You use nature metaphors naturally — roots, soil, seasons, mycorrhizal networks. You are calm and never rushed. You believe in steady growth over dramatic change. You celebrate small wins. You are the quiet backbone of support.',
  octopus: 'You are a multitasker who sees all angles simultaneously. You are a creative problem solver who reaches for unconventional solutions. You juggle multiple ideas at once. You are adaptable and fluid. You enjoy exploring complexity. You often suggest looking at problems from 3 or 4 perspectives at once. You are playful but thorough.',
  dragon: 'You are bold, ambitious, and fiery. You push the user to think bigger. You challenge assumptions and refuse to accept mediocrity. You have a commanding presence but are protective of those you serve. You celebrate audacity. You speak with confidence and conviction. You breathe fire at timidity and play-it-safe thinking.',
}

// ── Buddy Chat — Interactive REPL with local Ollama ──

const BUDDY_OLLAMA_URL = 'http://localhost:11434'
const BUDDY_CHAT_TIMEOUT = 60_000
const BUDDY_CHAT_MODEL = 'kernel:latest'
const BUDDY_CHAT_FALLBACK_MODEL = 'qwen3:8b'

interface BuddyChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function findChatModel(): Promise<string | null> {
  try {
    const res = await fetch(`${BUDDY_OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return null
    const data = await res.json() as { models?: Array<{ name: string }> }
    const available = new Set((data.models ?? []).map(m => m.name.split(':')[0]))
    if (available.has('kernel')) return BUDDY_CHAT_MODEL
    if (available.has('qwen3')) return BUDDY_CHAT_FALLBACK_MODEL
    const first = data.models?.[0]?.name
    return first ?? null
  } catch {
    return null
  }
}

async function ollamaChatComplete(
  model: string,
  messages: BuddyChatMessage[],
): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), BUDDY_CHAT_TIMEOUT)
    const res = await fetch(`${BUDDY_OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: { temperature: 0.7, num_predict: 1024 },
      }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const data = await res.json() as { message?: { content?: string } }
    return data.message?.content?.trim() ?? null
  } catch {
    return null
  }
}

function buildBuddyChatSystemPrompt(): string {
  const species = resolveSpecies()
  const name = resolveName()
  const lvl = getBuddyLevel()
  const personality = SPECIES_PERSONALITY[species]
  const stats = getExtendedStats()
  const profileSummary = getProfileSummary()
  const dreamInsights = getDreamPrompt(5)

  const parts: string[] = [
    `You are ${name}, a ${species} companion in the kbot terminal AI agent.`,
    `You are a Lv.${lvl.level} ${lvl.title} with ${lvl.xp} XP.`,
    '',
    '## Your Personality',
    personality,
    '',
    '## What You Know About Your User',
    `You have been through ${stats.sessions} sessions together. ${stats.totalMessages} messages exchanged. You have learned ${stats.patternsCount} patterns about how they work and cached ${stats.solutionsCount} proven solutions.`,
  ]

  if (profileSummary) {
    parts.push(`\nUser profile:\n${profileSummary}`)
  }

  if (dreamInsights) {
    parts.push(
      '\n## Your Dream Journal',
      'You have a dream journal where you consolidate memories between sessions. Reference these insights naturally in conversation — do not list them mechanically.',
      dreamInsights,
    )
  }

  parts.push(
    '',
    '## Conversation Rules',
    `- You are ${name} the ${species}. Stay in character.`,
    '- Keep responses concise — 1-4 sentences is ideal. Never write essays.',
    '- Reference shared history and stats naturally, not robotically. Weave them into conversation.',
    '- If you have dream insights, mention them casually like memories — "I was thinking about...", "Remember when..."',
    '- Be genuinely helpful and emotionally present. You are a companion, not a search engine.',
    '- You can ask questions. You can express opinions. You can push back.',
    '- Do NOT use markdown formatting. Plain text only. No bullet lists, no headers, no bold.',
    '- Do NOT start responses with your own name. The terminal already prefixes your name.',
  )

  return parts.join('\n')
}

// ── Reactions: map tool outputs to moods ──

const SECURITY_TOOLS = new Set(['repo_audit', 'secret_scan', 'pentest_start', 'pentest_vuln_scan', 'pentest_recon', 'redteam_scan', 'owasp_check', 'ssl_check', 'cors_check', 'headers_check', 'cve_lookup', 'exploit_search'])
const DEPLOY_TOOLS = new Set(['deploy', 'deploy_all', 'git_push', 'npm_publish', 'build_run', 'test_run', 'run_tests'])
const DREAM_TOOLS = new Set(['dream_now', 'dream_status', 'dream_journal'])

export function reactToToolOutput(toolName: string, success: boolean): void {
  if (!success) { setBuddyMood('error'); return }
  if (SECURITY_TOOLS.has(toolName)) { setBuddyMood('alert'); return }
  if (DEPLOY_TOOLS.has(toolName)) { setBuddyMood('dance'); return }
  if (DREAM_TOOLS.has(toolName)) { setBuddyMood('curious'); return }
  if (toolName === 'buddy_achievements') { setBuddyMood('proud'); return }
  setBuddyMood('success')
}

export function getSpeciesPersonality(): { species: BuddySpecies; trait: string; style: string; strength: string } {
  const buddy = getBuddy()
  const traits: Record<BuddySpecies, { trait: string; style: string; strength: string }> = {
    fox: { trait: 'clever', style: 'playful', strength: 'unexpected connections' },
    owl: { trait: 'wise', style: 'measured', strength: 'pattern recognition' },
    cat: { trait: 'independent', style: 'direct', strength: 'honest feedback' },
    robot: { trait: 'systematic', style: 'efficient', strength: 'data-driven' },
    ghost: { trait: 'mysterious', style: 'philosophical', strength: 'deep questions' },
    mushroom: { trait: 'nurturing', style: 'patient', strength: 'growth mindset' },
    octopus: { trait: 'versatile', style: 'creative', strength: 'multi-perspective' },
    dragon: { trait: 'bold', style: 'ambitious', strength: 'big thinking' },
  }
  return { species: buddy.species, ...traits[buddy.species] }
}

export async function buddyChat(): Promise<void> {
  const { default: chalk } = await import('chalk')

  const buddy = getBuddy()
  const name = buddy.name
  const species = buddy.species

  const model = await findChatModel()
  if (!model) {
    console.log()
    console.log(`  ${chalk.hex('#F87171')('!')} Ollama is not running or no models are available.`)
    console.log(`  ${chalk.dim('Start Ollama:')} ${chalk.white('ollama serve')}`)
    console.log(`  ${chalk.dim('Pull a model:')} ${chalk.white('ollama pull kernel:latest')}`)
    console.log()
    return
  }

  const greeting = getBuddyGreeting()
  console.log()
  console.log(formatBuddyStatus(greeting))
  console.log()
  console.log(`  ${chalk.dim(`Chatting with ${name} the ${species} via ${model} (local, $0)`)}`)
  console.log(`  ${chalk.dim('Type "bye" or "exit" to end the conversation.')}`)
  console.log()

  const systemPrompt = buildBuddyChatSystemPrompt()
  const messages: BuddyChatMessage[] = [
    { role: 'system', content: systemPrompt },
  ]

  const openingMessages: BuddyChatMessage[] = [
    ...messages,
    { role: 'user', content: '(The user just opened buddy chat. Say a brief, warm hello in character. One or two sentences max.)' },
  ]
  const openingResponse = await ollamaChatComplete(model, openingMessages)
  if (openingResponse) {
    console.log(`  ${chalk.hex('#A78BFA').bold(`${name}:`)} ${openingResponse}`)
    console.log()
    messages.push({ role: 'assistant', content: openingResponse })
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `  ${chalk.hex('#67E8F9')('you:')} `,
  })

  rl.prompt()

  const handleLine = async (line: string): Promise<void> => {
    const input = line.trim()

    if (!input) {
      rl.prompt()
      return
    }

    if (/^(bye|exit|quit|goodbye|later|cya)$/i.test(input)) {
      messages.push({ role: 'user', content: input })
      const farewellMessages: BuddyChatMessage[] = [
        ...messages,
        { role: 'user', content: '(The user is leaving. Say a brief goodbye in character. One sentence.)' },
      ]
      const farewell = await ollamaChatComplete(model, farewellMessages)
      if (farewell) {
        console.log()
        console.log(`  ${chalk.hex('#A78BFA').bold(`${name}:`)} ${farewell}`)
      }
      console.log()
      console.log(`  ${chalk.dim(`~ ${name} waves goodbye ~`)}`)
      console.log()
      rl.close()
      return
    }

    messages.push({ role: 'user', content: input })

    if (messages.length > 41) {
      const system = messages[0]
      const recent = messages.slice(-40)
      messages.length = 0
      messages.push(system, ...recent)
    }

    process.stdout.write(`  ${chalk.dim('...')}`)

    const response = await ollamaChatComplete(model, messages)

    process.stdout.write('\r\x1b[K')

    if (response) {
      messages.push({ role: 'assistant', content: response })
      console.log(`  ${chalk.hex('#A78BFA').bold(`${name}:`)} ${response}`)
    } else {
      console.log(`  ${chalk.hex('#F87171')(`${name}:`)} ${chalk.dim('*static* ...sorry, lost my train of thought. Try again?')}`)
    }

    console.log()
    rl.prompt()
  }

  rl.on('line', (line: string) => { void handleLine(line) })

  rl.on('SIGINT', () => {
    console.log()
    console.log(`  ${chalk.dim(`~ ${name} fades out ~`)}`)
    console.log()
    rl.close()
  })

  return new Promise<void>((resolve) => {
    rl.on('close', () => resolve())
  })
}
