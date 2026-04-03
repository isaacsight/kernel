// kbot Buddy Tools — Interact with your terminal companion
//
// Five tools:
//   buddy_status       — Show buddy name, species, mood, and sprite
//   buddy_rename       — Give your buddy a custom name (persisted to ~/.kbot/buddy.json)
//   buddy_achievements — Show all achievements with unlock status and progress
//   buddy_personality  — Show species personality traits, style, and strength
//   buddy_leaderboard  — Global anonymous leaderboard across all kbot installs

import { registerTool } from './index.js'
import {
  getBuddy,
  getBuddySprite,
  getBuddyGreeting,
  getBuddyLevel,
  formatBuddyStatus,
  renameBuddy,
  getAchievements,
  getAchievementProgress,
  getSpeciesPersonality,
  fetchBuddyLeaderboard,
  type BuddyMood,
  type BuddySpecies,
} from '../buddy.js'

const VALID_MOODS: BuddyMood[] = ['idle', 'thinking', 'success', 'error', 'learning', 'alert', 'dance', 'curious', 'proud']

export function registerBuddyTools(): void {
  registerTool({
    name: 'buddy_status',
    description: 'Show your terminal buddy — its name, species, current mood, and ASCII sprite. Optionally preview a specific mood.',
    parameters: {
      mood: {
        type: 'string',
        description: 'Preview a specific mood: idle, thinking, success, error, learning, alert, dance, curious, proud. Defaults to current mood.',
      },
    },
    tier: 'free',
    async execute(args) {
      const buddy = getBuddy()
      const lvl = getBuddyLevel()
      const mood = args.mood ? String(args.mood) as BuddyMood : undefined
      if (mood && !VALID_MOODS.includes(mood)) {
        return `Unknown mood "${mood}". Valid moods: ${VALID_MOODS.join(', ')}`
      }
      const sprite = getBuddySprite(mood).join('\n')
      const greeting = getBuddyGreeting()
      const xpProgress = lvl.xpToNext !== null
        ? `${lvl.xp}/${lvl.xp + lvl.xpToNext} XP (${lvl.xpToNext} to next)`
        : `${lvl.xp} XP (MAX)`
      return [
        `Name: ${buddy.name}`,
        `Species: ${buddy.species}`,
        `Mood: ${mood || buddy.mood}`,
        `Level: ${lvl.level} — ${lvl.title}`,
        `XP: ${xpProgress}`,
        '',
        sprite,
        '',
        `"${greeting}"`,
      ].join('\n')
    },
  })

  registerTool({
    name: 'buddy_rename',
    description: 'Give your terminal buddy a custom name. The name is persisted to ~/.kbot/buddy.json.',
    parameters: {
      name: {
        type: 'string',
        description: 'The new name for your buddy',
        required: true,
      },
    },
    tier: 'free',
    async execute(args) {
      const newName = String(args.name).trim()
      if (!newName) return 'Error: name cannot be empty.'
      if (newName.length > 32) return 'Error: name must be 32 characters or fewer.'

      const oldBuddy = getBuddy()
      const oldName = oldBuddy.name
      renameBuddy(newName)

      return formatBuddyStatus(`${oldName} is now ${newName}!`)
    },
  })

  registerTool({
    name: 'buddy_achievements',
    description: 'Show all buddy achievements — unlocked ones with date, locked ones with progress hints. Milestones that unlock as you use kbot.',
    parameters: {},
    tier: 'free',
    async execute() {
      const achievements = getAchievements()
      const buddy = getBuddy()

      const unlocked = achievements.filter(a => a.unlockedAt !== null)
      const locked = achievements.filter(a => a.unlockedAt === null)

      const lines: string[] = []
      lines.push(`=== ${buddy.name}'s Achievements ===`)
      lines.push(`${unlocked.length}/${achievements.length} unlocked`)
      lines.push('')

      if (unlocked.length > 0) {
        lines.push('-- Unlocked --')
        for (const a of unlocked) {
          const date = new Date(a.unlockedAt!).toLocaleDateString()
          lines.push(`  [${a.icon}] ${a.name} — ${a.description}`)
          lines.push(`      Unlocked ${date}`)
        }
        lines.push('')
      }

      if (locked.length > 0) {
        lines.push('-- Locked --')
        for (const a of locked) {
          const progress = getAchievementProgress(a.id)
          lines.push(`  [ ] ${a.name} — ${a.description}`)
          if (progress) {
            lines.push(`      Progress: ${progress}`)
          }
        }
      }

      return lines.join('\n')
    },
  })

  registerTool({
    name: 'buddy_personality',
    description: 'Show your buddy\'s species personality — trait, communication style, and unique strength. Each species has a distinct personality that influences how your buddy responds.',
    parameters: {},
    tier: 'free',
    async execute() {
      const buddy = getBuddy()
      const personality = getSpeciesPersonality()
      const sprite = getBuddySprite().join('\n')

      return [
        `=== ${buddy.name}'s Personality ===`,
        '',
        sprite,
        '',
        `Species: ${personality.species}`,
        `Trait: ${personality.trait}`,
        `Style: ${personality.style}`,
        `Strength: ${personality.strength}`,
      ].join('\n')
    },
  })

  registerTool({
    name: 'buddy_leaderboard',
    description: 'Show the global buddy leaderboard — anonymous rankings of all kbot buddies across installs, sorted by XP. Requires cloud sync (kernel.chat token).',
    parameters: {
      limit: {
        type: 'number',
        description: 'Number of entries to show (default 20, max 200)',
      },
      species: {
        type: 'string',
        description: 'Filter by species: fox, owl, cat, robot, ghost, mushroom, octopus, dragon',
      },
    },
    tier: 'free',
    async execute(args) {
      const SPECIES_ICONS: Record<string, string> = {
        fox: '[fox]', owl: '[owl]', cat: '[cat]', robot: '[bot]',
        ghost: '[gho]', mushroom: '[msh]', octopus: '[oct]', dragon: '[drg]',
      }

      const LEVEL_TITLES_SHORT: Record<number, string> = {
        0: 'Novice', 1: 'Adept', 2: 'Master', 3: 'Legend',
      }

      const limit = Math.min(Math.max(Math.floor(Number(args.limit) || 20), 1), 200)
      const species = args.species ? String(args.species).toLowerCase() : undefined

      const validSpecies: BuddySpecies[] = ['fox', 'owl', 'cat', 'robot', 'ghost', 'mushroom', 'octopus', 'dragon']
      if (species && !validSpecies.includes(species as BuddySpecies)) {
        return `Unknown species "${species}". Valid: ${validSpecies.join(', ')}`
      }

      const entries = await fetchBuddyLeaderboard({ limit, species })

      if (entries.length === 0) {
        return 'No entries on the leaderboard yet. Use kbot to earn XP and sync to the cloud!'
      }

      const lines: string[] = []
      const header = species
        ? `=== Buddy Leaderboard — ${species} ===`
        : '=== Global Buddy Leaderboard ==='
      lines.push(header)
      lines.push('')

      // Table header
      lines.push(
        `  ${'#'.padStart(3)}  ${'Species'.padEnd(7)} ${'Level'.padEnd(12)} ${'XP'.padStart(6)}  ${'Achv'.padStart(4)}  ${'Sessions'.padStart(8)}`
      )
      lines.push(`  ${'─'.repeat(3)}  ${'─'.repeat(7)} ${'─'.repeat(12)} ${'─'.repeat(6)}  ${'─'.repeat(4)}  ${'─'.repeat(8)}`)

      for (const entry of entries) {
        const icon = SPECIES_ICONS[entry.species] || entry.species.slice(0, 5)
        const title = LEVEL_TITLES_SHORT[entry.level] ?? `L${entry.level}`
        const levelStr = `${entry.level} ${title}`
        lines.push(
          `  ${String(entry.rank).padStart(3)}  ${icon.padEnd(7)} ${levelStr.padEnd(12)} ${String(entry.xp).padStart(6)}  ${String(entry.achievement_count).padStart(4)}  ${String(entry.sessions).padStart(8)}`
        )
      }

      lines.push('')
      lines.push(`${entries.length} entries shown`)

      return lines.join('\n')
    },
  })
}
