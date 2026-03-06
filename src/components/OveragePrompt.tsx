// ─── OveragePrompt ──────────────────────────────────────
//
// Shown when a paid user hits their monthly message limit.
// Asks them to accept overage billing before continuing.

interface OveragePromptProps {
  limit: number
  overageRate: number // millicents (e.g. 30 = $0.03)
  onAccept: () => void
  onDecline: () => void
}

export function OveragePrompt({ limit, overageRate, onAccept, onDecline }: OveragePromptProps) {
  const rateFormatted = `$${(overageRate / 10).toFixed(overageRate % 10 === 0 ? 1 : 2)}`

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
