import { useState } from 'react'
import { motion } from 'framer-motion'
import { PostCard } from '../components/blog/PostCard'
import { TagFilter } from '../components/blog/TagFilter'
import { getAllPosts, getAllTags, getPostsByTag } from '../utils/markdown'

export function Blog() {
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const allTags = getAllTags()
  const posts = activeTag ? getPostsByTag(activeTag) : getAllPosts()

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '3rem 2rem' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginBottom: '2.5rem' }}
        >
          <div className="mono" style={{ opacity: 0.4, marginBottom: '0.75rem', fontSize: '0.7rem' }}>
            Writing
          </div>
          <h1 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '2.5rem',
            fontWeight: 400,
            letterSpacing: '0.02em',
            textTransform: 'none',
            marginBottom: '0.75rem',
          }}>
            Does This Feel Right?
          </h1>
          <p style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1rem',
            opacity: 0.5,
            lineHeight: 1.6,
          }}>
            Notes on building systems, AI agents, and the craft of making things that feel right.
          </p>
        </motion.div>

        {/* Tags */}
        <TagFilter tags={allTags} activeTag={activeTag} onSelect={setActiveTag} />

        {/* Posts */}
        <div>
          {posts.map((post, i) => (
            <PostCard key={post.slug} post={post} index={i} />
          ))}
          {posts.length === 0 && (
            <p style={{ opacity: 0.4, fontStyle: 'italic' }}>No posts found.</p>
          )}
        </div>
      </div>
    </div>
  )
}
