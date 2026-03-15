// ─── UpgradePrompt ──────────────────────────────────────
//
// Shown when free users hit their monthly message limit.

import { IconAlertCircle } from './KernelIcons'

interface UpgradePromptProps {
  feature: 'monthly_limit' | 'daily_limit' | string
  onUpgrade?: () => void
  loading?: boolean
}

export function UpgradePrompt({ feature, onUpgrade, loading }: UpgradePromptProps) {
  const isLimit = feature === 'monthly_limit' || feature === 'daily_limit'

  return (
    <div className="ka-upgrade-prompt">
      <div className="ka-upgrade-prompt-icon">
        <IconAlertCircle size={20} />
      </div>
      <h3 className="ka-upgrade-prompt-title">
        {isLimit ? "You've used your 10 free messages this month" : 'Limit reached'}
      </h3>
      <p className="ka-upgrade-prompt-desc">
        Upgrade to Pro for 200 messages a month, convergence, file analysis, and more.
      </p>
      {onUpgrade && (
        <button
          className="ka-upgrade-prompt-btn"
          onClick={onUpgrade}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Upgrade to Pro — $15/month'}
        </button>
      )}
    </div>
  )
}
