// kbot Buddy Tools — Interact with your terminal companion
//
// Two tools:
//   buddy_status — Show buddy name, species, mood, and sprite
//   buddy_rename — Give your buddy a custom name (persisted to ~/.kbot/buddy.json)

import { registerTool } from './index.js'
import {
  getBuddy,
  getBuddySprite,
  getBuddyGreeting,
  formatBuddyStatus,
  renameBuddy,
  type BuddyMood,
} from '../buddy.js'

const VALID_MOODS: BuddyMood[] = ['idle', 'thinking', 'success', 'error', 'learning']

export function registerBuddyTools(): void {
  registerTool({
    name: 'buddy_status',
    description: 'Show your terminal buddy — its name, species, current mood, and ASCII sprite. Optionally preview a specific mood.',
    parameters: {
      mood: {
        type: 'string',
        description: 'Preview a specific mood: idle, thinking, success, error, learning. Defaults to current mood.',
      },
    },
    tier: 'free',
    async execute(args) {
      const buddy = getBuddy()
      const mood = args.mood ? String(args.mood) as BuddyMood : undefined
      if (mood && !VALID_MOODS.includes(mood)) {
        return `Unknown mood "${mood}". Valid moods: ${VALID_MOODS.join(', ')}`
      }
      const sprite = getBuddySprite(mood).join('\n')
      const greeting = getBuddyGreeting()
      return [
        `Name: ${buddy.name}`,
        `Species: ${buddy.species}`,
        `Mood: ${mood || buddy.mood}`,
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
}
