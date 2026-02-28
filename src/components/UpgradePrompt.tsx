// ─── UpgradePrompt ──────────────────────────────────────
//
// Reusable contextual upgrade CTA for free users.
// Shows feature-specific copy with monthly + annual options.

import { IconCrown } from './KernelIcons'
import type { PlanId } from '../config/planLimits'

interface UpgradePromptProps {
  feature: 'memory' | 'goals' | 'briefings' | 'monthly_limit' | 'daily_limit' | 'files' | 'pro_monthly_limit'
  onUpgrade: (plan: PlanId) => void
  loading?: boolean
}

const COPY: Record<string, { title: string; description: string }> = {
  memory: {
    title: 'Kernel Pro remembers you',
    description: 'So you never start from scratch. Your interests, preferences, and context — all carried forward.',
  },
  goals: {
    title: 'Goals are a Pro feature',
    description: 'Upgrade to let Kernel hold you accountable with goals, milestones, and streaks.',
  },
  briefings: {
    title: 'Discussing your briefing is a Pro feature',
    description: 'Upgrade to think through your day with Kernel — go deeper on any topic.',
  },
  monthly_limit: {
    title: 'You\'ve used your free messages',
    description: 'Pro gives you unlimited messaging, memory that learns you, and full briefings.',
  },
  daily_limit: {
    title: 'You\'ve used your 5 free messages today',
    description: 'Upgrade for 100 messages per day plus memory, goals, and extended thinking.',
  },
  files: {
    title: 'File analysis is a Pro feature',
    description: 'Upgrade to analyze images, PDFs, and documents with Kernel.',
  },
  pro_monthly_limit: {
    title: 'You\'ve hit your Pro message limit',
    description: 'Go Max for generous messaging with no visible cap, plus 100 extended thinking and 50 file analyses per month.',
  },
}

export function UpgradePrompt({ feature, onUpgrade, loading }: UpgradePromptProps) {
  const copy = COPY[feature] || COPY.monthly_limit
  const isMaxUpsell = feature === 'pro_monthly_limit'

  return (
    <div className="ka-upgrade-prompt">
      <div className="ka-upgrade-prompt-icon">
        <IconCrown size={20} />
      </div>
      <h3 className="ka-upgrade-prompt-title">{copy.title}</h3>
      <p className="ka-upgrade-prompt-desc">{copy.description}</p>
      <div className="ka-upgrade-prompt-actions">
        {isMaxUpsell ? (
          <>
            <button
              className="ka-upgrade-prompt-btn ka-upgrade-prompt-btn--max"
              onClick={() => onUpgrade('max_monthly')}
              disabled={loading}
            >
              Go Max — $49/mo
            </button>
            <button
              className="ka-upgrade-prompt-btn ka-upgrade-prompt-btn--secondary"
              onClick={() => onUpgrade('max_annual')}
              disabled={loading}
            >
              $490/yr — save $98
            </button>
          </>
        ) : (
          <>
            <button
              className="ka-upgrade-prompt-btn ka-upgrade-prompt-btn--primary"
              onClick={() => onUpgrade('pro_monthly')}
              disabled={loading}
            >
              Go Pro — $29/mo
            </button>
            <button
              className="ka-upgrade-prompt-btn ka-upgrade-prompt-btn--secondary"
              onClick={() => onUpgrade('pro_annual')}
              disabled={loading}
            >
              $290/yr — save $58
            </button>
          </>
        )}
      </div>
    </div>
  )
}
