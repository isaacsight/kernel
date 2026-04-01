// kbot Buddy System — Terminal companion sprites
//
// Deterministic companion assignment based on config path hash.
// Same user always gets the same buddy. Mood changes based on session activity.
// Pure ASCII art, max 5 lines tall, 15 chars wide. Tamagotchi energy.
//
// Persists buddy name to ~/.kbot/buddy.json

import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'

// ── Types ──

export type BuddySpecies = 'fox' | 'owl' | 'cat' | 'robot' | 'ghost' | 'mushroom' | 'octopus' | 'dragon'
export type BuddyMood = 'idle' | 'thinking' | 'success' | 'error' | 'learning'

export interface BuddyState {
  species: BuddySpecies
  name: string
  mood: BuddyMood
}

interface BuddyConfig {
  name?: string
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

// ── ASCII Sprites ──
// Each sprite is an array of strings (lines). Max 5 lines, max 15 chars wide.
// Pure ASCII only — no unicode box drawing.

const SPRITES: Record<BuddySpecies, Record<BuddyMood, string[]>> = {
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

const MOOD_MESSAGES: Record<BuddyMood, string[]> = {
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

// ── Public API ──

/** Get the buddy's current state (species, name, mood) */
export function getBuddy(): BuddyState {
  return {
    species: resolveSpecies(),
    name: resolveName(),
    mood: currentMood,
  }
}

/** Set the buddy's mood */
export function setBuddyMood(mood: BuddyMood): void {
  currentMood = mood
}

/** Get the ASCII sprite for the buddy in the given mood (defaults to current) */
export function getBuddySprite(mood?: BuddyMood): string[] {
  const m = mood ?? currentMood
  const species = resolveSpecies()
  return SPRITES[species][m]
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

/** Pick a random message for the current mood */
function moodMessage(): string {
  const msgs = MOOD_MESSAGES[currentMood]
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

  // Name tag
  lines.push(`  ~ ${name} the ${species} ~`)

  return lines.join('\n')
}
