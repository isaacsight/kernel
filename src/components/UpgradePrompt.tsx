// ─── UpgradePrompt ──────────────────────────────────────
//
// Shown when free users hit their daily message limit.

import { IconAlertCircle } from './KernelIcons'

interface UpgradePromptProps {
  feature: 'daily_limit' | string
  onUpgrade?: () => void
  loading?: boolean
}

export function UpgradePrompt({ feature }: UpgradePromptProps) {
  const isLimit = feature === 'daily_limit'

  return (
    <div className="ka-upgrade-prompt">
      <div className="ka-upgrade-prompt-icon">
        <IconAlertCircle size={20} />
      </div>
      <h3 className="ka-upgrade-prompt-title">
        {isLimit ? "You've used your 10 messages today" : 'Limit reached'}
      </h3>
      <p className="ka-upgrade-prompt-desc">
        Come back tomorrow for 10 more free messages.
      </p>
    </div>
  )
}
