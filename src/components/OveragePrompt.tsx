// ─── OveragePrompt ──────────────────────────────────────
//
// Shown when a Pro user hits their 200 monthly messages.
// Asks them to accept overage billing ($0.10/msg) before continuing.

interface OveragePromptProps {
  limit: number
  overageRate: number // cents (e.g. 10 = $0.10)
  onAccept: () => void
  onDecline: () => void
}

export function OveragePrompt({ limit, overageRate, onAccept, onDecline }: OveragePromptProps) {
  const rateFormatted = `$${(overageRate / 100).toFixed(2)}`

  return (
    <div className="ka-overage-prompt">
      <h3 className="ka-overage-prompt-title">You've used all {limit.toLocaleString()} included messages</h3>
      <p className="ka-overage-prompt-desc">
        Additional messages will be billed at <strong>{rateFormatted}</strong> each.
        This will appear on your next invoice.
      </p>
      <div className="ka-overage-prompt-actions">
        <button
          className="ka-overage-prompt-btn ka-overage-prompt-btn--primary"
          onClick={onAccept}
        >
          Continue
        </button>
        <button
          className="ka-overage-prompt-btn ka-overage-prompt-btn--secondary"
          onClick={onDecline}
        >
          Stop for now
        </button>
      </div>
    </div>
  )
}
