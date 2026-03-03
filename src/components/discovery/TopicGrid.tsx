// ─── Topic Grid ────────────────────────────────────────────────
//
// Grid of popular topic tags. Clicking a tag filters the feed.

interface TopicGridProps {
  topics: string[]
  activeTopic: string | null
  onSelect: (topic: string) => void
}

export function TopicGrid({ topics, activeTopic, onSelect }: TopicGridProps) {
  if (topics.length === 0) return null

  return (
    <div className="ka-topic-grid" role="list" aria-label="Popular topics">
      {topics.map(topic => (
        <button
          key={topic}
          className={`ka-topic-tag ${activeTopic === topic ? 'ka-topic-tag--active' : ''}`}
          onClick={() => onSelect(topic)}
          role="listitem"
        >
          {topic}
        </button>
      ))}
    </div>
  )
}
