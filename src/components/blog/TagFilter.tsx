import { motion } from 'framer-motion'

interface TagFilterProps {
  tags: string[]
  activeTag: string | null
  onSelect: (tag: string | null) => void
}

export function TagFilter({ tags, activeTag, onSelect }: TagFilterProps) {
  if (tags.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      style={{
        display: 'flex',
        gap: '0.75rem',
        flexWrap: 'wrap',
        marginBottom: '2rem',
      }}
    >
      <button
        onClick={() => onSelect(null)}
        className="mono"
        style={{
          fontSize: '0.65rem',
          padding: '0.35rem 0.75rem',
          border: '1px solid var(--rubin-ivory-dark)',
          borderRadius: 'var(--radius-full)',
          background: activeTag === null ? 'var(--rubin-slate)' : 'transparent',
          color: activeTag === null ? 'var(--rubin-ivory)' : 'var(--rubin-slate)',
          cursor: 'pointer',
          transition: 'all var(--duration-fast) var(--ease-out)',
          opacity: activeTag === null ? 1 : 0.5,
        }}
      >
        All
      </button>
      {tags.map(tag => (
        <button
          key={tag}
          onClick={() => onSelect(activeTag === tag ? null : tag)}
          className="mono"
          style={{
            fontSize: '0.65rem',
            padding: '0.35rem 0.75rem',
            border: '1px solid var(--rubin-ivory-dark)',
            borderRadius: 'var(--radius-full)',
            background: activeTag === tag ? 'var(--rubin-slate)' : 'transparent',
            color: activeTag === tag ? 'var(--rubin-ivory)' : 'var(--rubin-slate)',
            cursor: 'pointer',
            transition: 'all var(--duration-fast) var(--ease-out)',
            opacity: activeTag === tag ? 1 : 0.5,
          }}
        >
          {tag}
        </button>
      ))}
    </motion.div>
  )
}
