import type { LiveShareParticipant } from '../hooks/useLiveShare'

interface LiveShareBadgeProps {
  participants: LiveShareParticipant[]
  onClick?: () => void
}

export function LiveShareBadge({ participants, onClick }: LiveShareBadgeProps) {
  const online = participants.filter(p => p.online)
  const count = online.length

  if (count <= 1) return null

  return (
    <button className="ka-live-badge" onClick={onClick} aria-label={`${count} participants in live share`}>
      <span className="ka-live-dot" />
      <span className="ka-live-count">{count}</span>
      <div className="ka-live-avatars">
        {online.slice(0, 3).map((p, i) => (
          <div
            key={p.user_id}
            className="ka-live-avatar"
            style={{ zIndex: 3 - i }}
          />
        ))}
        {count > 3 && <span className="ka-live-more">+{count - 3}</span>}
      </div>
    </button>
  )
}
