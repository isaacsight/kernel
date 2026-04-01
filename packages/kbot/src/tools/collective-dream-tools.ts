// kbot Collective Dream Tools — Share and receive dream wisdom
//
// Agent-accessible tools for the collective dream sharing system:
//   - collective_dream_status: How many local insights are shareable, opt-in state
//   - collective_dream_optin: Opt in/out of anonymous dream sharing

import { registerTool } from './index.js'
import { loadConfig, saveConfig, type KbotConfig } from '../auth.js'
import { getDreamStatus } from '../dream.js'
import { prepareCollectiveDreams } from '../collective-dreams.js'

// ── Config helpers ──

const OPTIN_KEY = 'collective_dreams_enabled'

function isDreamSharingEnabled(): boolean {
  const config = loadConfig()
  if (!config) return false
  return (config as unknown as Record<string, unknown>)[OPTIN_KEY] === true
}

function setDreamSharingEnabled(enabled: boolean): void {
  const config = loadConfig() || { default_model: 'auto', default_agent: 'auto' } as KbotConfig
  ;(config as unknown as Record<string, unknown>)[OPTIN_KEY] = enabled
  saveConfig(config)
}

// ── Tool Registration ──

export function registerCollectiveDreamTools(): void {

  registerTool({
    name: 'collective_dream_status',
    description: 'Show collective dream sharing status — how many local insights qualify for sharing, opt-in state, and what gets anonymized. Use this to check before opting in.',
    parameters: {},
    tier: 'free',
    async execute() {
      const enabled = isDreamSharingEnabled()
      const { insights } = getDreamStatus()

      // Check how many would qualify for sharing (relevance > 0.7)
      const shareable = prepareCollectiveDreams(insights)
      const highRelevance = insights.filter(i => i.relevance > 0.7).length

      const lines = [
        'Collective Dream Sharing',
        '========================',
        `Status: ${enabled ? 'OPTED IN' : 'not opted in'}`,
        '',
        `Local insights: ${insights.length}`,
        `High-relevance (>0.7): ${highRelevance}`,
        `Shareable after anonymization: ${shareable.length}`,
        '',
        'What gets shared (anonymized):',
        '  - Dream category (pattern, preference, skill, etc.)',
        '  - Keywords (PII stripped)',
        '  - Generalized content (names, paths, keys removed)',
        '',
        'What NEVER gets shared:',
        '  - Raw insight text, file paths, project names',
        '  - API keys, source code, conversation content',
        '  - Your identity or any personal information',
      ]

      if (shareable.length > 0) {
        lines.push('', 'Preview of anonymized insights:')
        for (const s of shareable.slice(0, 3)) {
          lines.push(`  [${s.category}] ${s.generalizedContent.slice(0, 120)}`)
          if (s.keywords.length > 0) {
            lines.push(`    keywords: ${s.keywords.join(', ')}`)
          }
        }
        if (shareable.length > 3) {
          lines.push(`  ... and ${shareable.length - 3} more`)
        }
      }

      if (!enabled) {
        lines.push('', 'To opt in: use the collective_dream_optin tool with enabled=true')
      }

      return lines.join('\n')
    },
  })

  registerTool({
    name: 'collective_dream_optin',
    description: 'Opt in or out of anonymous collective dream sharing. When enabled, high-relevance insights are anonymized and prepared for upload to the collective pool. Other kbot users benefit from aggregated patterns. Persists to ~/.kbot/config.json.',
    parameters: {
      enabled: {
        type: 'boolean',
        description: 'true to opt in, false to opt out',
        required: true,
      },
    },
    tier: 'free',
    async execute(args) {
      const enabled = args.enabled === true || args.enabled === 'true'

      setDreamSharingEnabled(enabled)

      if (enabled) {
        const { insights } = getDreamStatus()
        const shareable = prepareCollectiveDreams(insights)
        return [
          'Collective dream sharing: ENABLED',
          '',
          `${shareable.length} insights ready to share (anonymized).`,
          'Your dreams will be stripped of all personal info before sharing.',
          'You can opt out at any time.',
        ].join('\n')
      } else {
        return [
          'Collective dream sharing: DISABLED',
          '',
          'No insights will be shared. Your dream journal remains fully private.',
          'Existing collective data (if any) is not affected.',
        ].join('\n')
      }
    },
  })

} // end registerCollectiveDreamTools
