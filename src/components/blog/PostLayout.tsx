import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import type { Post } from '../../utils/markdown'

interface PostLayoutProps {
  post: Post
}

export function PostLayout({ post }: PostLayoutProps) {
  return (
    <motion.article
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      style={{ maxWidth: '680px', margin: '0 auto', padding: '3rem 2rem' }}
    >
      {/* Back link */}
      <Link
        to="/blog"
        className="mono"
        style={{
          textDecoration: 'none',
          color: 'var(--rubin-accent)',
          fontSize: '0.7rem',
          display: 'inline-block',
          marginBottom: '2rem',
        }}
      >
        ← Back to writing
      </Link>

      {/* Meta */}
      <div className="mono" style={{ opacity: 0.4, marginBottom: '1rem', fontSize: '0.7rem' }}>
        {post.date}
        {post.tags.length > 0 && (
          <span style={{ marginLeft: '1.5rem' }}>
            {post.tags.join(' · ')}
          </span>
        )}
      </div>

      {/* Title */}
      <h1 style={{
        fontFamily: 'var(--font-serif)',
        fontSize: '2.5rem',
        fontWeight: 400,
        letterSpacing: '0.02em',
        lineHeight: 1.2,
        marginBottom: '2.5rem',
        textTransform: 'none',
      }}>
        {post.title}
      </h1>

      {/* Body */}
      <div style={{
        fontFamily: 'var(--font-serif)',
        fontSize: '1.1rem',
        lineHeight: 1.8,
      }}>
        <ReactMarkdown
          components={{
            h2: ({ children }) => (
              <h2 style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.5rem',
                fontWeight: 400,
                letterSpacing: '0.02em',
                marginTop: '2.5rem',
                marginBottom: '1rem',
              }}>
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.25rem',
                fontWeight: 400,
                marginTop: '2rem',
                marginBottom: '0.75rem',
              }}>
                {children}
              </h3>
            ),
            p: ({ children }) => (
              <p style={{ marginBottom: '1.25rem' }}>{children}</p>
            ),
            ul: ({ children }) => (
              <ul style={{
                marginBottom: '1.25rem',
                paddingLeft: '1.5rem',
                listStyleType: 'disc',
              }}>
                {children}
              </ul>
            ),
            li: ({ children }) => (
              <li style={{ marginBottom: '0.5rem' }}>{children}</li>
            ),
            strong: ({ children }) => (
              <strong style={{ fontWeight: 600 }}>{children}</strong>
            ),
            em: ({ children }) => (
              <em style={{ fontStyle: 'italic' }}>{children}</em>
            ),
            code: ({ children, className }) => {
              const isBlock = className?.includes('language-')
              if (isBlock) {
                return (
                  <code style={{
                    display: 'block',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem',
                    lineHeight: 1.6,
                    background: 'var(--rubin-ivory-med)',
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-sm)',
                    overflowX: 'auto',
                    marginBottom: '1.25rem',
                  }}>
                    {children}
                  </code>
                )
              }
              return (
                <code style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85em',
                  background: 'var(--rubin-ivory-med)',
                  padding: '0.15rem 0.4rem',
                  borderRadius: '3px',
                }}>
                  {children}
                </code>
              )
            },
            pre: ({ children }) => (
              <pre style={{ marginBottom: '1.25rem' }}>{children}</pre>
            ),
            blockquote: ({ children }) => (
              <blockquote style={{
                borderLeft: '2px solid var(--rubin-accent)',
                paddingLeft: '1.5rem',
                marginBottom: '1.25rem',
                fontStyle: 'italic',
                opacity: 0.8,
              }}>
                {children}
              </blockquote>
            ),
            hr: () => (
              <hr style={{
                border: 'none',
                borderTop: '1px solid var(--rubin-ivory-dark)',
                margin: '2.5rem 0',
              }} />
            ),
          }}
        >
          {post.content}
        </ReactMarkdown>
      </div>
    </motion.article>
  )
}
