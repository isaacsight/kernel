// kbot Buddy Tools — Interact with your terminal companion
//
// Four tools:
//   buddy_status       — Show buddy name, species, mood, and sprite
//   buddy_rename       — Give your buddy a custom name (persisted to ~/.kbot/buddy.json)
//   buddy_achievements — Show all achievements with unlock status and progress
//   buddy_personality  — Show species personality traits, style, and strength

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
  type BuddyMood,
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
}
