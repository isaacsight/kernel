import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { PostMeta } from '../../utils/markdown'

interface PostCardProps {
  post: PostMeta
  index: number
}

export function PostCard({ post, index }: PostCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        to={`/blog/${post.slug}`}
        style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
      >
        <div style={{
          padding: '2rem 0',
          borderBottom: '1px solid var(--rubin-ivory-dark)',
          transition: 'opacity var(--duration-normal) var(--ease-out)',
          cursor: 'pointer',
        }}>
          <div className="mono" style={{ opacity: 0.4, marginBottom: '0.75rem', fontSize: '0.7rem' }}>
            {post.date}
            {post.tags.length > 0 && (
              <span style={{ marginLeft: '1.5rem' }}>
                {post.tags.join(' · ')}
              </span>
            )}
          </div>

          <h2 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.75rem',
            fontWeight: 400,
            letterSpacing: '0.02em',
            marginBottom: '0.5rem',
            lineHeight: 1.3,
          }}>
            {post.title}
          </h2>

          {post.summary && (
            <p style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1rem',
              opacity: 0.6,
              lineHeight: 1.6,
            }}>
              {post.summary}
            </p>
          )}
        </div>
      </Link>
    </motion.article>
  )
}
