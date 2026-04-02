// kbot Buddy Card Tools — Generate and share trading cards
//
// Two tools:
//   buddy_card  — Generate SVG trading card, save to ~/.kbot/buddy-card.svg
//   buddy_share — Generate card + terminal ASCII, optionally create GitHub Gist

import { registerTool } from './index.js'
import { generateBuddyCard, generateBuddyCardAscii } from '../buddy-card.js'
import { getBuddy, getBuddyLevel } from '../buddy.js'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

const KBOT_DIR = join(homedir(), '.kbot')
const CARD_PATH = join(KBOT_DIR, 'buddy-card.svg')

function ensureDir(): void {
  if (!existsSync(KBOT_DIR)) mkdirSync(KBOT_DIR, { recursive: true })
}

export function registerBuddyCardTools(): void {
  registerTool({
    name: 'buddy_card',
    description: 'Generate a shareable SVG trading card for your buddy. Saves to ~/.kbot/buddy-card.svg and returns the file path. The card shows your buddy sprite, name, level, stats, and achievements.',
    parameters: {},
    tier: 'free',
    async execute() {
      const svg = generateBuddyCard()
      ensureDir()
      writeFileSync(CARD_PATH, svg, 'utf-8')

      const buddy = getBuddy()
      const level = getBuddyLevel()

      return [
        `Trading card generated for ${buddy.name} the ${buddy.species} (LV.${level.level} ${level.title})`,
        '',
        `Saved to: ${CARD_PATH}`,
        '',
        'Open in a browser to view the full card, or use buddy_share for a terminal preview + optional GitHub Gist.',
      ].join('\n')
    },
  })

  registerTool({
    name: 'buddy_share',
    description: 'Generate your buddy trading card in both SVG and terminal ASCII formats. Optionally creates a public GitHub Gist for sharing (requires `gh` CLI authenticated).',
    parameters: {
      gist: {
        type: 'boolean',
        description: 'If true, creates a GitHub Gist with the SVG card and returns the URL. Requires `gh` CLI. Default: false.',
      },
    },
    tier: 'free',
    async execute(args) {
      const svg = generateBuddyCard()
      const ascii = generateBuddyCardAscii()
      ensureDir()
      writeFileSync(CARD_PATH, svg, 'utf-8')

      const buddy = getBuddy()
      const level = getBuddyLevel()

      const output: string[] = []
      output.push(`${buddy.name} the ${buddy.species} — LV.${level.level} ${level.title}`)
      output.push('')
      output.push(ascii)
      output.push('')
      output.push(`SVG saved: ${CARD_PATH}`)

      // Optionally create a GitHub Gist
      const createGist = args.gist === true || args.gist === 'true'
      if (createGist) {
        try {
          const gistDesc = `${buddy.name} the ${buddy.species} — kbot buddy trading card`
          const result = execSync(
            `gh gist create "${CARD_PATH}" --public --desc "${gistDesc.replace(/"/g, '\\"')}"`,
            { encoding: 'utf-8', timeout: 30_000 },
          ).trim()
          output.push('')
          output.push(`Gist created: ${result}`)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          output.push('')
          output.push(`Gist creation failed (is \`gh\` CLI installed and authenticated?): ${msg}`)
        }
      }

      return output.join('\n')
    },
  })
}
