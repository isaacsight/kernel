# Does This Feel Right?

> A literary-minimalist blog on building systems, AI agents, and the craft of making things that feel right.
> Live at: [doesthisfeelright.com](https://kernel.chat)

---

## Stack

| Layer | Choice |
|-------|--------|
| Framework | React 19 + TypeScript |
| Build | Vite 6 |
| Routing | Hash router (GitHub Pages) |
| Animation | Framer Motion |
| Markdown | react-markdown + frontmatter |
| Fonts | EB Garamond (prose), Courier Prime (meta) |
| Palette | Ivory #FAF9F6, Slate #1F1E1D, Accent #8B7355 |
| Deploy | `gh-pages -d dist` → GitHub Pages |

---

## File Structure (Active)

```
index.html
vite.config.ts
tsconfig.json
package.json
src/
  main.tsx              # Entry point
  App.tsx               # Root component (unused, router in main.tsx)
  router.tsx            # Hash router: / → /blog, /blog/:slug, /claude-physics
  index.css             # Rubin design tokens + global styles
  vite-env.d.ts         # Vite type declarations
  types/index.ts        # Agent, Message, SwarmState types
  utils/markdown.ts     # Frontmatter parser, post registry
  pages/
    Blog.tsx            # Post listing with tag filter
    BlogPost.tsx        # Individual post view
    ClaudePhysicsPage.tsx  # Interactive "Physics of Claude" page
  components/
    Layout.tsx          # AnimatePresence wrapper
    ErrorBoundary.tsx   # React error boundary
    blog/
      PostCard.tsx      # Post preview card
      PostLayout.tsx    # Full post renderer (ReactMarkdown)
      TagFilter.tsx     # Tag filter buttons
    claude-physics/
      index.ts              # Barrel export
      SectionWrapper.tsx    # Scroll-triggered section reveal
      HeroSection.tsx       # Word-staggered title
      TokenizationSection.tsx  # Draggable token chips
      AttentionSection.tsx  # Hover → SVG attention lines
      TransformerSection.tsx  # Scroll-linked layer signal
      TemperatureSection.tsx  # Slider + particle system
      ContextWindowSection.tsx  # Scroll-linked fill
      ReasoningSection.tsx  # Intelligence synthesis weights
      ClosingSection.tsx    # Poetic ending
      hooks/
        useScrollSection.ts  # useScroll + useSpring hook
      data/
        tokens.ts           # Static data (tokens, attention weights, layers)
  content/posts/
    sovereign-swarm.md  # "Building a Sovereign AI Swarm"
    frontier-notes.md   # "Notes from the Frontier"
    way-of-code.md      # "The Way of Code"
```

---

## Source Code

### `index.html`

```html
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="theme-color" content="#1F1E1D" />
  <meta name="description" content="Notes on building systems, AI agents, and the craft of making things that feel right." />
  <link rel="apple-touch-icon" href="/favicon.svg" />
  <title>Does This Feel Right?</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link
    href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..800;1,400..800&family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&display=swap"
    rel="stylesheet">
</head>

<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>

</html>
```

### `vite.config.ts`

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    base: '/',
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
        host: true,
    }
})
```

### `tsconfig.json`

```json
{
    "compilerOptions": {
        "target": "ESNext",
        "useDefineForClassFields": true,
        "lib": ["DOM", "DOM.Iterable", "ESNext"],
        "allowJs": false,
        "skipLibCheck": true,
        "esModuleInterop": false,
        "allowSyntheticDefaultImports": true,
        "strict": true,
        "forceConsistentCasingInFileNames": true,
        "module": "ESNext",
        "moduleResolution": "Node",
        "resolveJsonModule": true,
        "isolatedModules": true,
        "noEmit": true,
        "jsx": "react-jsx",
        "baseUrl": ".",
        "paths": { "@/*": ["src/*"] }
    },
    "include": ["src"],
    "references": [{ "path": "./tsconfig.node.json" }]
}
```

### `package.json`

```json
{
    "name": "ai-group-chat",
    "private": true,
    "version": "0.0.0",
    "type": "module",
    "scripts": {
        "dev": "vite",
        "build": "tsc && vite build",
        "preview": "vite preview",
        "predeploy": "npm run build",
        "deploy": "gh-pages -d dist"
    },
    "homepage": "https://isaacsight.github.io/kernel",
    "dependencies": {
        "framer-motion": "^11.0.0",
        "lucide-react": "^0.400.0",
        "react": "^19.0.0",
        "react-dom": "^19.0.0",
        "react-markdown": "^10.1.0",
        "react-router-dom": "^7.13.0",
        "zustand": "^5.0.11"
    },
    "devDependencies": {
        "@types/react": "^19.0.0",
        "@types/react-dom": "^19.0.0",
        "@vitejs/plugin-react": "^4.3.0",
        "gh-pages": "^6.3.0",
        "typescript": "^5.5.0",
        "vite": "^6.0.0"
    }
}
```

---

### `src/main.tsx`

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import './index.css'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <RouterProvider router={router} />
    </StrictMode>,
)
```

### `src/router.tsx`

```tsx
import { createHashRouter, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Blog } from './pages/Blog'
import { BlogPost } from './pages/BlogPost'
import { ClaudePhysicsPage } from './pages/ClaudePhysicsPage'

function withErrorBoundary(element: React.ReactNode) {
  return <ErrorBoundary>{element}</ErrorBoundary>
}

export const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/blog" replace /> },
      { path: 'blog', element: withErrorBoundary(<Blog />) },
      { path: 'blog/:slug', element: withErrorBoundary(<BlogPost />) },
      { path: 'claude-physics', element: withErrorBoundary(<ClaudePhysicsPage />) },
    ],
  },
])
```

### `src/index.css`

```css
:root {
    --rubin-ivory: #FAF9F6;
    --rubin-slate: #1F1E1D;
    --rubin-ivory-med: #F0EEE6;
    --rubin-ivory-dark: #E8E6DC;
    --rubin-accent: #8B7355;

    --font-serif: "EB Garamond", serif;
    --font-mono: "Courier Prime", monospace;

    --shadow-sm: 0 1px 2px rgba(31, 30, 29, 0.05);
    --shadow-md: 0 4px 12px rgba(31, 30, 29, 0.08);
    --shadow-lg: 0 12px 32px rgba(31, 30, 29, 0.12);

    --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
    --duration-fast: 150ms;
    --duration-normal: 250ms;
    --duration-slow: 400ms;

    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 16px;
    --radius-full: 9999px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
    background-color: var(--rubin-ivory);
    color: var(--rubin-slate);
    font-family: var(--font-serif);
    font-size: 22px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
}

h1, h2, h3, h4 { font-weight: 400; letter-spacing: 0.02em; }

.mono {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
}

#root { min-height: 100vh; }
.site-wrapper { min-height: 100vh; display: flex; flex-direction: column; }
.site-main { flex: 1; display: flex; flex-direction: column; }

:focus-visible { outline: 2px solid var(--rubin-accent); outline-offset: 2px; }
:focus:not(:focus-visible) { outline: none; }

.custom-scrollbar::-webkit-scrollbar { width: 2px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: var(--rubin-ivory-dark); }

@media (max-width: 768px) { body { font-size: 18px; } }
```

### `src/vite-env.d.ts`

```ts
/// <reference types="vite/client" />

declare module '*.md?raw' {
  const content: string
  export default content
}

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string
  readonly VITE_GEMINI_MODEL_PRO: string
  readonly VITE_GEMINI_MODEL_FLASH: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

### `src/types/index.ts`

```ts
export interface Agent {
  id: string;
  name: string;
  persona: string;
  systemPrompt: string;
  avatar: string;
  color: string;
}

export interface MediaAttachment {
  type: 'image' | 'video';
  url: string;
  mimeType: string;
  base64?: string;
}

export interface Message {
  id: string;
  agentId: string;
  agentName: string;
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  media?: MediaAttachment[];
}

export interface SwarmState {
  isActive: boolean;
  currentSpeaker: string | null;
  topic: string;
  turnCount: number;
}
```

---

### `src/utils/markdown.ts`

```ts
export interface PostMeta {
  slug: string
  title: string
  date: string
  tags: string[]
  summary: string
}

export interface Post extends PostMeta {
  content: string
}

function parseFrontmatter(raw: string): { meta: Record<string, string>; content: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { meta: {}, content: raw }

  const meta: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    meta[key] = value
  }

  return { meta, content: match[2].trim() }
}

function parsePost(slug: string, raw: string): Post {
  const { meta, content } = parseFrontmatter(raw)
  return {
    slug,
    title: meta.title || slug,
    date: meta.date || '',
    tags: (meta.tags || '').split(',').map(t => t.trim()).filter(Boolean),
    summary: meta.summary || '',
    content,
  }
}

import sovereignSwarmRaw from '../content/posts/sovereign-swarm.md?raw'
import frontierNotesRaw from '../content/posts/frontier-notes.md?raw'
import wayOfCodeRaw from '../content/posts/way-of-code.md?raw'

const RAW_POSTS: Record<string, string> = {
  'sovereign-swarm': sovereignSwarmRaw,
  'frontier-notes': frontierNotesRaw,
  'way-of-code': wayOfCodeRaw,
}

let _cache: Post[] | null = null

export function getAllPosts(): Post[] {
  if (_cache) return _cache
  _cache = Object.entries(RAW_POSTS)
    .map(([slug, raw]) => parsePost(slug, raw))
    .sort((a, b) => (b.date > a.date ? 1 : -1))
  return _cache
}

export function getPostBySlug(slug: string): Post | undefined {
  return getAllPosts().find(p => p.slug === slug)
}

export function getPostsByTag(tag: string): Post[] {
  return getAllPosts().filter(p => p.tags.includes(tag))
}

export function getAllTags(): string[] {
  const tags = new Set<string>()
  for (const post of getAllPosts()) {
    for (const tag of post.tags) tags.add(tag)
  }
  return Array.from(tags).sort()
}
```

---

### `src/components/Layout.tsx`

```tsx
import { Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

export function Layout() {
  const location = useLocation()

  return (
    <div className="site-wrapper">
      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="site-main"
        >
          <Outlet />
        </motion.main>
      </AnimatePresence>
    </div>
  )
}
```

### `src/components/ErrorBoundary.tsx`

```tsx
import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex-1 flex items-center justify-center p-10">
          <div className="max-w-md text-center">
            <div className="text-6xl mb-6 opacity-20">!</div>
            <h2 className="text-2xl mb-4">Something went wrong</h2>
            <p className="opacity-60 italic mb-6">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-6 py-3 bg-[--rubin-slate] text-[--rubin-ivory] rounded-full mono text-sm hover:opacity-90 transition-opacity"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

---

### `src/pages/Blog.tsx`

```tsx
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
            fontFamily: 'var(--font-serif)', fontSize: '2.5rem',
            fontWeight: 400, letterSpacing: '0.02em', marginBottom: '0.75rem',
          }}>
            Does This Feel Right?
          </h1>
          <p style={{
            fontFamily: 'var(--font-serif)', fontSize: '1rem',
            opacity: 0.5, lineHeight: 1.6,
          }}>
            Notes on building systems, AI agents, and the craft of making things that feel right.
          </p>
        </motion.div>

        <TagFilter tags={allTags} activeTag={activeTag} onSelect={setActiveTag} />

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
```

### `src/pages/BlogPost.tsx`

```tsx
import { useParams, Navigate } from 'react-router-dom'
import { PostLayout } from '../components/blog/PostLayout'
import { getPostBySlug } from '../utils/markdown'

export function BlogPost() {
  const { slug } = useParams<{ slug: string }>()
  const post = slug ? getPostBySlug(slug) : undefined

  if (!post) return <Navigate to="/blog" replace />

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <PostLayout post={post} />
    </div>
  )
}
```

### `src/pages/ClaudePhysicsPage.tsx`

```tsx
import {
  HeroSection,
  TokenizationSection,
  AttentionSection,
  TransformerSection,
  TemperatureSection,
  ContextWindowSection,
  ReasoningSection,
  ClosingSection,
} from '../components/claude-physics'

export function ClaudePhysicsPage() {
  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <HeroSection />
      <TokenizationSection />
      <AttentionSection />
      <TransformerSection />
      <TemperatureSection />
      <ContextWindowSection />
      <ReasoningSection />
      <ClosingSection />
    </div>
  )
}
```

---

### `src/components/blog/PostCard.tsx`

```tsx
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { PostMeta } from '../../utils/markdown'

interface PostCardProps { post: PostMeta; index: number }

export function PostCard({ post, index }: PostCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link to={`/blog/${post.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
        <div style={{
          padding: '2rem 0',
          borderBottom: '1px solid var(--rubin-ivory-dark)',
          transition: 'opacity var(--duration-normal) var(--ease-out)',
          cursor: 'pointer',
        }}>
          <div className="mono" style={{ opacity: 0.4, marginBottom: '0.75rem', fontSize: '0.7rem' }}>
            {post.date}
            {post.tags.length > 0 && (
              <span style={{ marginLeft: '1.5rem' }}>{post.tags.join(' · ')}</span>
            )}
          </div>
          <h2 style={{
            fontFamily: 'var(--font-serif)', fontSize: '1.75rem',
            fontWeight: 400, letterSpacing: '0.02em',
            marginBottom: '0.5rem', lineHeight: 1.3,
          }}>
            {post.title}
          </h2>
          {post.summary && (
            <p style={{
              fontFamily: 'var(--font-serif)', fontSize: '1rem',
              opacity: 0.6, lineHeight: 1.6,
            }}>
              {post.summary}
            </p>
          )}
        </div>
      </Link>
    </motion.article>
  )
}
```

### `src/components/blog/PostLayout.tsx`

```tsx
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import type { Post } from '../../utils/markdown'

export function PostLayout({ post }: { post: Post }) {
  return (
    <motion.article
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      style={{ maxWidth: '680px', margin: '0 auto', padding: '3rem 2rem' }}
    >
      <Link to="/blog" className="mono" style={{
        textDecoration: 'none', color: 'var(--rubin-accent)',
        fontSize: '0.7rem', display: 'inline-block', marginBottom: '2rem',
      }}>
        &larr; Back to writing
      </Link>

      <div className="mono" style={{ opacity: 0.4, marginBottom: '1rem', fontSize: '0.7rem' }}>
        {post.date}
        {post.tags.length > 0 && (
          <span style={{ marginLeft: '1.5rem' }}>{post.tags.join(' · ')}</span>
        )}
      </div>

      <h1 style={{
        fontFamily: 'var(--font-serif)', fontSize: '2.5rem', fontWeight: 400,
        letterSpacing: '0.02em', lineHeight: 1.2, marginBottom: '2.5rem',
      }}>
        {post.title}
      </h1>

      <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', lineHeight: 1.8 }}>
        <ReactMarkdown
          components={{
            h2: ({ children }) => (
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', fontWeight: 400,
                letterSpacing: '0.02em', marginTop: '2.5rem', marginBottom: '1rem' }}>{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', fontWeight: 400,
                marginTop: '2rem', marginBottom: '0.75rem' }}>{children}</h3>
            ),
            p: ({ children }) => <p style={{ marginBottom: '1.25rem' }}>{children}</p>,
            ul: ({ children }) => (
              <ul style={{ marginBottom: '1.25rem', paddingLeft: '1.5rem', listStyleType: 'disc' }}>{children}</ul>
            ),
            li: ({ children }) => <li style={{ marginBottom: '0.5rem' }}>{children}</li>,
            strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
            em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
            code: ({ children, className }) => {
              const isBlock = className?.includes('language-')
              if (isBlock) return (
                <code style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.85rem',
                  lineHeight: 1.6, background: 'var(--rubin-ivory-med)', padding: '1.25rem',
                  borderRadius: 'var(--radius-sm)', overflowX: 'auto', marginBottom: '1.25rem' }}>{children}</code>
              )
              return (
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85em',
                  background: 'var(--rubin-ivory-med)', padding: '0.15rem 0.4rem', borderRadius: '3px' }}>{children}</code>
              )
            },
            pre: ({ children }) => <pre style={{ marginBottom: '1.25rem' }}>{children}</pre>,
            blockquote: ({ children }) => (
              <blockquote style={{ borderLeft: '2px solid var(--rubin-accent)', paddingLeft: '1.5rem',
                marginBottom: '1.25rem', fontStyle: 'italic', opacity: 0.8 }}>{children}</blockquote>
            ),
            hr: () => <hr style={{ border: 'none', borderTop: '1px solid var(--rubin-ivory-dark)', margin: '2.5rem 0' }} />,
          }}
        >
          {post.content}
        </ReactMarkdown>
      </div>
    </motion.article>
  )
}
```

### `src/components/blog/TagFilter.tsx`

```tsx
import { motion } from 'framer-motion'

interface TagFilterProps {
  tags: string[]
  activeTag: string | null
  onSelect: (tag: string | null) => void
}

export function TagFilter({ tags, activeTag, onSelect }: TagFilterProps) {
  if (tags.length === 0) return null

  const style = (active: boolean) => ({
    fontSize: '0.65rem',
    padding: '0.35rem 0.75rem',
    border: '1px solid var(--rubin-ivory-dark)',
    borderRadius: 'var(--radius-full)',
    background: active ? 'var(--rubin-slate)' : 'transparent',
    color: active ? 'var(--rubin-ivory)' : 'var(--rubin-slate)',
    cursor: 'pointer' as const,
    transition: 'all var(--duration-fast) var(--ease-out)',
    opacity: active ? 1 : 0.5,
  })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '2rem' }}
    >
      <button onClick={() => onSelect(null)} className="mono" style={style(activeTag === null)}>All</button>
      {tags.map(tag => (
        <button key={tag} onClick={() => onSelect(activeTag === tag ? null : tag)}
          className="mono" style={style(activeTag === tag)}>{tag}</button>
      ))}
    </motion.div>
  )
}
```

---

## Claude Physics — Interactive Page (`/#/claude-physics`)

An interactive, scroll-driven educational page teaching how Claude works through hands-on Framer Motion visualizations.

### Sections

| # | Section | Interaction |
|---|---------|-------------|
| Hero | Staggered word-by-word title reveal | Animated scroll indicator |
| 01 | Tokenization | Drag tokens with spring physics |
| 02 | Self-Attention | Hover/tap tokens to see SVG attention lines |
| 03 | Transformer Layers | Scroll-linked glowing dot propagates through layers |
| 04 | Temperature | Drag slider to control 40 spring-animated particles |
| 05 | Context Window | Scroll-linked grid fills, counter increments to 200K |
| 07 | Intelligence Synthesis | Hover weighted reasoning categories with animated bars |
| Closing | Poetic conclusion | Link back to blog |

### `src/components/claude-physics/index.ts`

```ts
export { HeroSection } from './HeroSection'
export { TokenizationSection } from './TokenizationSection'
export { AttentionSection } from './AttentionSection'
export { TransformerSection } from './TransformerSection'
export { TemperatureSection } from './TemperatureSection'
export { ContextWindowSection } from './ContextWindowSection'
export { ReasoningSection } from './ReasoningSection'
export { ClosingSection } from './ClosingSection'
export { SectionWrapper } from './SectionWrapper'
```

### `src/components/claude-physics/data/tokens.ts`

```ts
// Static data for Claude Physics interactive sections

export const EXAMPLE_SENTENCE = "The cat sat on the mat and looked at the stars"

export const TOKENS = EXAMPLE_SENTENCE.split(" ").map((word, i) => ({
  id: i,
  text: word,
}))

// Attention weights: [sourceIndex][targetIndex] = weight (0-1)
// Simulates self-attention patterns — determiners attend to nouns, verbs attend to subjects
export const ATTENTION_WEIGHTS: Record<number, { target: number; weight: number }[]> = {
  0: [{ target: 1, weight: 0.8 }, { target: 4, weight: 0.3 }],           // "The" → cat, the
  1: [{ target: 2, weight: 0.7 }, { target: 5, weight: 0.4 }],           // "cat" → sat, mat
  2: [{ target: 1, weight: 0.6 }, { target: 3, weight: 0.5 }],           // "sat" → cat, on
  3: [{ target: 4, weight: 0.7 }, { target: 5, weight: 0.5 }],           // "on" → the, mat
  4: [{ target: 5, weight: 0.9 }],                                        // "the" → mat
  5: [{ target: 2, weight: 0.4 }, { target: 3, weight: 0.6 }],           // "mat" → sat, on
  6: [{ target: 7, weight: 0.7 }, { target: 1, weight: 0.5 }],           // "and" → looked, cat
  7: [{ target: 1, weight: 0.8 }, { target: 8, weight: 0.5 }, { target: 10, weight: 0.6 }], // "looked" → cat, at, stars
  8: [{ target: 9, weight: 0.7 }, { target: 10, weight: 0.6 }],          // "at" → the, stars
  9: [{ target: 10, weight: 0.9 }],                                       // "the" → stars
  10: [{ target: 7, weight: 0.5 }, { target: 1, weight: 0.3 }],          // "stars" → looked, cat
}

export const TRANSFORMER_LAYERS = [
  { name: "Embedding", description: "Words become vectors in high-dimensional space" },
  { name: "Layer 1–12", description: "Local syntax: grammar, word order, part-of-speech" },
  { name: "Layer 13–48", description: "Semantic meaning: concepts, relationships, context" },
  { name: "Layer 49–80", description: "Abstract reasoning: logic, inference, planning" },
  { name: "Output Head", description: "Probability distribution over all possible next tokens" },
]

export const CONTEXT_WINDOW_TOKENS = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  text: EXAMPLE_SENTENCE.split(" ")[i % EXAMPLE_SENTENCE.split(" ").length],
}))
```

### `src/components/claude-physics/hooks/useScrollSection.ts`

```ts
import { useRef } from 'react'
import { useScroll, useTransform, useSpring, type MotionValue } from 'framer-motion'

interface UseScrollSectionOptions {
  offset?: [string, string]
}

interface UseScrollSectionReturn {
  ref: React.RefObject<HTMLDivElement | null>
  scrollYProgress: MotionValue<number>
  smoothProgress: MotionValue<number>
}

export function useScrollSection(options?: UseScrollSectionOptions): UseScrollSectionReturn {
  const ref = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: (options?.offset ?? ["start end", "end start"]) as unknown as undefined,
  })

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  })

  return { ref, scrollYProgress, smoothProgress }
}

export function useScrollTransform(
  scrollYProgress: MotionValue<number>,
  inputRange: number[],
  outputRange: number[],
) {
  return useTransform(scrollYProgress, inputRange, outputRange)
}
```

### `src/components/claude-physics/SectionWrapper.tsx`

```tsx
import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

interface SectionWrapperProps {
  children: React.ReactNode
  label: string
  title: string
  subtitle?: string
}

export function SectionWrapper({ children, label, title, subtitle }: SectionWrapperProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section
      ref={ref}
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 'clamp(2rem, 5vw, 4rem) clamp(1.5rem, 5vw, 2rem)',
        maxWidth: '900px',
        margin: '0 auto',
        width: '100%',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mono" style={{ opacity: 0.4, marginBottom: '0.75rem', fontSize: '0.7rem' }}>
          {label}
        </div>
        <h2 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 'clamp(1.5rem, 4vw, 2rem)',
          fontWeight: 400, letterSpacing: '0.02em', marginBottom: '0.75rem',
        }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(0.9rem, 2vw, 1.05rem)',
            opacity: 0.55, lineHeight: 1.7, marginBottom: '2.5rem', maxWidth: '600px',
          }}>
            {subtitle}
          </p>
        )}
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </section>
  )
}
```

### `src/components/claude-physics/HeroSection.tsx`

```tsx
import { motion } from 'framer-motion'

const TITLE_WORDS = "The Physics & Neuroscience of Claude".split(" ")

export function HeroSection() {
  return (
    <section
      style={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        padding: 'clamp(2rem, 5vw, 4rem) clamp(1.5rem, 5vw, 2rem)',
        textAlign: 'center',
      }}
    >
      <div className="mono" style={{ opacity: 0.4, marginBottom: '1.5rem', fontSize: '0.7rem' }}>
        Interactive Guide
      </div>

      <h1 style={{
        fontFamily: 'var(--font-serif)',
        fontSize: 'clamp(2rem, 6vw, 3.5rem)',
        fontWeight: 400, letterSpacing: '0.02em',
        lineHeight: 1.2, maxWidth: '700px', marginBottom: '1.5rem',
      }}>
        {TITLE_WORDS.map((word, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: 'inline-block', marginRight: '0.3em' }}
          >
            {word}
          </motion.span>
        ))}
      </h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.55 }}
        transition={{ duration: 0.8, delay: 1.0 }}
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 'clamp(0.95rem, 2vw, 1.1rem)',
          lineHeight: 1.7, maxWidth: '500px', marginBottom: '4rem',
        }}
      >
        Scroll through seven interactive explorations of how a large language model
        transforms text into understanding.
      </motion.p>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ duration: 0.6, delay: 1.4 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}
      >
        <span className="mono" style={{ fontSize: '0.6rem' }}>Scroll</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ width: '1px', height: '24px', background: 'var(--rubin-slate)', opacity: 0.3 }}
        />
      </motion.div>
    </section>
  )
}
```

### `src/components/claude-physics/TokenizationSection.tsx`

```tsx
import { useState } from 'react'
import { motion, useMotionValue } from 'framer-motion'
import { SectionWrapper } from './SectionWrapper'
import { EXAMPLE_SENTENCE, TOKENS } from './data/tokens'

export function TokenizationSection() {
  const [hasInteracted, setHasInteracted] = useState(false)

  return (
    <SectionWrapper
      label="01 — Tokenization"
      title="Breaking Language into Pieces"
      subtitle="Before Claude reads a single word, your sentence is split into tokens — atomic units of meaning. Drag them around to feel how language becomes discrete."
    >
      <div style={{
        fontFamily: 'var(--font-serif)',
        fontSize: 'clamp(1rem, 2.5vw, 1.15rem)',
        opacity: 0.4, marginBottom: '1.5rem', fontStyle: 'italic',
      }}>
        "{EXAMPLE_SENTENCE}"
      </div>

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '0.75rem',
        minHeight: '120px', padding: '1.5rem',
        background: 'var(--rubin-ivory-med)', borderRadius: 'var(--radius-md)',
        position: 'relative',
      }}>
        {TOKENS.map((token, i) => (
          <DraggableToken key={token.id} token={token} index={i}
            onDragStart={() => setHasInteracted(true)} />
        ))}
      </div>

      <motion.div
        animate={{ opacity: hasInteracted ? 0 : 0.35 }}
        className="mono"
        style={{ fontSize: '0.65rem', marginTop: '1rem', textAlign: 'center' }}
      >
        drag tokens to rearrange
      </motion.div>
    </SectionWrapper>
  )
}

function DraggableToken({
  token, index, onDragStart,
}: {
  token: { id: number; text: string }; index: number; onDragStart: () => void
}) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const [isDragging, setIsDragging] = useState(false)

  return (
    <motion.div
      drag dragMomentum={false} dragElastic={0.1}
      dragConstraints={{ top: -60, bottom: 60, left: -100, right: 100 }}
      onDragStart={() => { setIsDragging(true); onDragStart() }}
      onDragEnd={() => { setIsDragging(false); x.set(0); y.set(0) }}
      style={{
        x, y,
        fontFamily: 'var(--font-mono)', fontSize: 'clamp(0.7rem, 1.5vw, 0.8rem)',
        padding: '0.5rem 0.85rem',
        background: isDragging ? 'var(--rubin-slate)' : 'var(--rubin-ivory)',
        color: isDragging ? 'var(--rubin-ivory)' : 'var(--rubin-slate)',
        borderRadius: 'var(--radius-sm)',
        boxShadow: isDragging ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
        cursor: 'grab', userSelect: 'none',
        zIndex: isDragging ? 10 : 1, letterSpacing: '0.05em',
      }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 300, damping: 20 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95, cursor: 'grabbing' }}
    >
      {token.text}
    </motion.div>
  )
}
```

### `src/components/claude-physics/AttentionSection.tsx`

```tsx
import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SectionWrapper } from './SectionWrapper'
import { TOKENS, ATTENTION_WEIGHTS } from './data/tokens'

export function AttentionSection() {
  const [activeToken, setActiveToken] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const tokenRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number; weight: number }[]>([])

  const computeLines = useCallback(() => {
    if (activeToken === null || !containerRef.current) {
      setLines([])
      return
    }

    const connections = ATTENTION_WEIGHTS[activeToken] ?? []
    const containerRect = containerRef.current.getBoundingClientRect()

    const newLines = connections
      .map(({ target, weight }) => {
        const sourceEl = tokenRefs.current.get(activeToken)
        const targetEl = tokenRefs.current.get(target)
        if (!sourceEl || !targetEl) return null

        const sourceRect = sourceEl.getBoundingClientRect()
        const targetRect = targetEl.getBoundingClientRect()

        return {
          x1: sourceRect.left + sourceRect.width / 2 - containerRect.left,
          y1: sourceRect.top + sourceRect.height / 2 - containerRect.top,
          x2: targetRect.left + targetRect.width / 2 - containerRect.left,
          y2: targetRect.top + targetRect.height / 2 - containerRect.top,
          weight,
        }
      })
      .filter((l): l is NonNullable<typeof l> => l !== null)

    setLines(newLines)
  }, [activeToken])

  useEffect(() => { computeLines() }, [computeLines])

  const setTokenRef = useCallback((id: number, el: HTMLDivElement | null) => {
    if (el) tokenRefs.current.set(id, el)
    else tokenRefs.current.delete(id)
  }, [])

  return (
    <SectionWrapper
      label="02 — Self-Attention"
      title="Every Word Listens to Every Other"
      subtitle="Self-attention lets each token decide which other tokens matter most. Hover or tap a token to see its attention pattern light up."
    >
      <div ref={containerRef} style={{
        position: 'relative', display: 'flex', flexWrap: 'wrap', gap: '1rem',
        padding: '2rem 1.5rem', background: 'var(--rubin-ivory-med)',
        borderRadius: 'var(--radius-md)', minHeight: '140px',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {/* SVG overlay for attention lines */}
        <svg style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          pointerEvents: 'none', overflow: 'visible',
        }}>
          <AnimatePresence>
            {lines.map((line, i) => (
              <motion.line
                key={`${activeToken}-${i}`}
                x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                stroke="var(--rubin-accent)"
                strokeWidth={line.weight * 3} strokeLinecap="round"
                initial={{ opacity: 0, pathLength: 0 }}
                animate={{ opacity: line.weight * 0.7, pathLength: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            ))}
          </AnimatePresence>
        </svg>

        {/* Token chips */}
        {TOKENS.map((token) => {
          const isSource = activeToken === token.id
          const isTarget = activeToken !== null &&
            (ATTENTION_WEIGHTS[activeToken] ?? []).some((c) => c.target === token.id)
          const targetWeight = isTarget
            ? (ATTENTION_WEIGHTS[activeToken!] ?? []).find((c) => c.target === token.id)?.weight ?? 0
            : 0

          return (
            <motion.div
              key={token.id}
              ref={(el) => setTokenRef(token.id, el)}
              onMouseEnter={() => setActiveToken(token.id)}
              onMouseLeave={() => setActiveToken(null)}
              onTouchStart={() => setActiveToken(token.id === activeToken ? null : token.id)}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 'clamp(0.7rem, 1.5vw, 0.8rem)',
                padding: '0.5rem 0.85rem',
                background: isSource ? 'var(--rubin-slate)'
                  : isTarget ? `rgba(139, 115, 85, ${0.15 + targetWeight * 0.35})`
                  : 'var(--rubin-ivory)',
                color: isSource ? 'var(--rubin-ivory)' : 'var(--rubin-slate)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: isSource ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                cursor: 'pointer', userSelect: 'none', letterSpacing: '0.05em',
                position: 'relative',
                zIndex: isSource ? 5 : isTarget ? 3 : 1,
              }}
              whileHover={{ scale: 1.05 }}
              animate={{ scale: isTarget ? 1 + targetWeight * 0.1 : 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              {token.text}
              {isTarget && (
                <span className="mono" style={{
                  position: 'absolute', top: '-0.6rem', right: '-0.3rem',
                  fontSize: '0.5rem', opacity: 0.6,
                }}>
                  {Math.round(targetWeight * 100)}%
                </span>
              )}
            </motion.div>
          )
        })}
      </div>

      <div className="mono" style={{ fontSize: '0.65rem', opacity: 0.35, marginTop: '1rem', textAlign: 'center' }}>
        {activeToken !== null
          ? `"${TOKENS[activeToken].text}" attends to ${(ATTENTION_WEIGHTS[activeToken] ?? []).length} tokens`
          : 'hover or tap a token to see attention'}
      </div>
    </SectionWrapper>
  )
}
```

### `src/components/claude-physics/TransformerSection.tsx`

```tsx
import { useRef } from 'react'
import { motion, useScroll, useTransform, useSpring, type MotionValue } from 'framer-motion'
import { SectionWrapper } from './SectionWrapper'
import { TRANSFORMER_LAYERS } from './data/tokens'

export function TransformerSection() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: scrollRef, offset: ["start end", "end start"],
  })

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100, damping: 30, restDelta: 0.001,
  })

  const activeLayerFloat = useTransform(smoothProgress, [0.2, 0.8], [0, TRANSFORMER_LAYERS.length - 1])

  return (
    <div ref={scrollRef}>
      <SectionWrapper
        label="03 — Transformer Layers"
        title="Signal Propagating Through Depth"
        subtitle="Claude has 80 transformer layers. As you scroll, watch a signal propagate from raw embeddings to abstract reasoning."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {TRANSFORMER_LAYERS.map((layer, i) => (
            <TransformerLayer key={i} layer={layer} index={i} activeLayerFloat={activeLayerFloat} />
          ))}
        </div>
        <div className="mono" style={{ fontSize: '0.65rem', opacity: 0.35, marginTop: '1.5rem', textAlign: 'center' }}>
          scroll to propagate signal through layers
        </div>
      </SectionWrapper>
    </div>
  )
}

function TransformerLayer({
  layer, index, activeLayerFloat,
}: {
  layer: { name: string; description: string }; index: number; activeLayerFloat: MotionValue<number>
}) {
  const opacity = useTransform(activeLayerFloat, (val) => {
    const distance = Math.abs(val - index)
    return distance < 0.5 ? 1 : Math.max(0.25, 1 - distance * 0.3)
  })

  const glowOpacity = useTransform(activeLayerFloat, (val) => {
    const distance = Math.abs(val - index)
    return distance < 0.5 ? 0.8 : 0
  })

  const scale = useTransform(activeLayerFloat, (val) => {
    const distance = Math.abs(val - index)
    return distance < 0.5 ? 1.02 : 1
  })

  const inactiveOpacity = useTransform(glowOpacity, (v) => v > 0.1 ? 0 : 0.3)

  return (
    <motion.div style={{
      opacity, scale,
      display: 'flex', alignItems: 'center', gap: '1.25rem',
      padding: '1rem 1.25rem', borderRadius: 'var(--radius-sm)', position: 'relative',
    }}>
      <motion.div style={{
        opacity: glowOpacity, width: '10px', height: '10px', borderRadius: '50%',
        background: 'var(--rubin-accent)', boxShadow: '0 0 12px rgba(139, 115, 85, 0.6)', flexShrink: 0,
      }} />
      <motion.div style={{
        opacity: inactiveOpacity, width: '10px', height: '10px', borderRadius: '50%',
        background: 'var(--rubin-slate)', position: 'absolute', left: '1.25rem', flexShrink: 0,
      }} />
      <div style={{ flex: 1 }}>
        <div className="mono" style={{ fontSize: '0.7rem', marginBottom: '0.2rem' }}>{layer.name}</div>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(0.85rem, 1.8vw, 0.95rem)', opacity: 0.6 }}>
          {layer.description}
        </div>
      </div>
      {index < TRANSFORMER_LAYERS.length - 1 && (
        <div style={{
          position: 'absolute', left: 'calc(1.25rem + 4.5px)', bottom: '-0.5rem',
          width: '1px', height: '1rem', background: 'var(--rubin-ivory-dark)',
        }} />
      )}
    </motion.div>
  )
}
```

### `src/components/claude-physics/TemperatureSection.tsx`

```tsx
import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { SectionWrapper } from './SectionWrapper'

const PARTICLE_COUNT = 40

function seededRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297
  return x - Math.floor(x)
}

export function TemperatureSection() {
  const [temperature, setTemperature] = useState(0.3)

  const particles = useMemo(
    () => Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      baseX: seededRandom(i * 2) * 100,
      baseY: seededRandom(i * 2 + 1) * 100,
      angle: seededRandom(i * 3) * Math.PI * 2,
    })),
    [],
  )

  const tempLabel =
    temperature < 0.2 ? 'Deterministic'
    : temperature < 0.5 ? 'Focused'
    : temperature < 0.8 ? 'Creative'
    : 'Chaotic'

  return (
    <SectionWrapper
      label="04 — Temperature"
      title="Controlled Randomness"
      subtitle="Temperature controls how 'creative' Claude's responses are. Low temperature means predictable outputs. High temperature introduces beautiful chaos."
    >
      <div style={{
        position: 'relative', width: '100%', height: 'clamp(200px, 35vw, 300px)',
        background: 'var(--rubin-ivory-med)', borderRadius: 'var(--radius-md)',
        overflow: 'hidden', marginBottom: '1.5rem',
      }}>
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '4px', height: '4px', borderRadius: '50%',
          background: 'var(--rubin-accent)', opacity: 0.3,
        }} />

        {particles.map((p) => {
          const spread = temperature
          const cx = 50, cy = 50
          const offsetX = (p.baseX - 50) * spread
          const offsetY = (p.baseY - 50) * spread
          const jitterX = Math.cos(p.angle + temperature * 4) * temperature * 15
          const jitterY = Math.sin(p.angle + temperature * 4) * temperature * 15

          return (
            <motion.div
              key={p.id}
              animate={{ left: `${cx + offsetX + jitterX}%`, top: `${cy + offsetY + jitterY}%` }}
              transition={{
                type: 'spring',
                stiffness: 150 - temperature * 100,
                damping: 20 - temperature * 10,
                mass: 0.5 + temperature * 0.5,
              }}
              style={{
                position: 'absolute',
                width: 'clamp(5px, 1vw, 8px)', height: 'clamp(5px, 1vw, 8px)',
                borderRadius: '50%', background: 'var(--rubin-slate)',
                opacity: 0.15 + temperature * 0.4, transform: 'translate(-50%, -50%)',
              }}
            />
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', maxWidth: '500px', margin: '0 auto' }}>
        <span className="mono" style={{ fontSize: '0.65rem', opacity: 0.4, flexShrink: 0 }}>0</span>
        <input type="range" min="0" max="1" step="0.01" value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value))}
          style={{
            flex: 1, appearance: 'none', height: '2px',
            background: 'var(--rubin-ivory-dark)', outline: 'none',
            cursor: 'pointer', accentColor: 'var(--rubin-accent)',
          }}
        />
        <span className="mono" style={{ fontSize: '0.65rem', opacity: 0.4, flexShrink: 0 }}>1</span>
      </div>

      <div style={{ textAlign: 'center', marginTop: '1rem' }}>
        <span className="mono" style={{ fontSize: '0.7rem', opacity: 0.5 }}>T = {temperature.toFixed(2)}</span>
        <span style={{
          fontFamily: 'var(--font-serif)', fontSize: '0.85rem',
          opacity: 0.4, marginLeft: '1rem', fontStyle: 'italic',
        }}>
          {tempLabel}
        </span>
      </div>
    </SectionWrapper>
  )
}
```

### `src/components/claude-physics/ContextWindowSection.tsx`

```tsx
import { useRef } from 'react'
import { motion, useScroll, useTransform, useSpring, type MotionValue } from 'framer-motion'
import { SectionWrapper } from './SectionWrapper'

const MAX_TOKENS = 200000
const GRID_CELLS = 80

export function ContextWindowSection() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: scrollRef, offset: ["start end", "end start"],
  })

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100, damping: 30, restDelta: 0.001,
  })

  const fillRatio = useTransform(smoothProgress, [0.25, 0.75], [0, 1])

  const tokenCount = useTransform(fillRatio, (v) =>
    Math.round(Math.max(0, Math.min(1, v)) * MAX_TOKENS),
  )

  return (
    <div ref={scrollRef}>
      <SectionWrapper
        label="05 — Context Window"
        title="200,000 Tokens of Memory"
        subtitle="Claude can hold an entire novel in working memory — about 200K tokens at once. Scroll to watch the context window fill."
      >
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <motion.span className="mono" style={{
            fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', letterSpacing: '0.05em',
          }}>
            <CounterDisplay value={tokenCount} />
          </motion.span>
          <div className="mono" style={{ fontSize: '0.65rem', opacity: 0.35, marginTop: '0.25rem' }}>tokens</div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(16px, 3vw, 24px), 1fr))',
          gap: '3px', padding: '1.5rem',
          background: 'var(--rubin-ivory-med)', borderRadius: 'var(--radius-md)',
          maxWidth: '600px', margin: '0 auto',
        }}>
          {Array.from({ length: GRID_CELLS }, (_, i) => (
            <TokenCell key={i} index={i} total={GRID_CELLS} fillRatio={fillRatio} />
          ))}
        </div>

        <div style={{
          maxWidth: '600px', margin: '1.5rem auto 0', height: '2px',
          background: 'var(--rubin-ivory-dark)', borderRadius: '1px', overflow: 'hidden',
        }}>
          <motion.div style={{
            height: '100%', background: 'var(--rubin-accent)',
            scaleX: fillRatio, transformOrigin: 'left',
          }} />
        </div>

        <div className="mono" style={{ fontSize: '0.65rem', opacity: 0.35, marginTop: '1rem', textAlign: 'center' }}>
          scroll to fill context window
        </div>
      </SectionWrapper>
    </div>
  )
}

function TokenCell({ index, total, fillRatio }: {
  index: number; total: number; fillRatio: MotionValue<number>
}) {
  const threshold = index / total
  const cellOpacity = useTransform(fillRatio, (v) => v > threshold ? 0.6 : 0.08)
  const cellScale = useTransform(fillRatio, (v) =>
    v > threshold && v < threshold + 0.02 ? 1.3 : 1)

  return (
    <motion.div
      style={{
        opacity: cellOpacity, scale: cellScale,
        aspectRatio: '1', background: 'var(--rubin-slate)', borderRadius: '2px',
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    />
  )
}

function CounterDisplay({ value }: { value: MotionValue<number> }) {
  const displayValue = useTransform(value, (v) => v.toLocaleString())
  return <motion.span>{displayValue}</motion.span>
}
```

### `src/components/claude-physics/ReasoningSection.tsx`

```tsx
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SectionWrapper } from './SectionWrapper'

const REASONING_CATEGORIES = [
    { id: 'complexity', label: 'Complexity', weight: 0.25, description: 'Measures architectural depth and technical overhead.' },
    { id: 'market_demand', label: 'Market Demand', weight: 0.20, description: 'Signals from the external world: what does the void want?' },
    { id: 'profitability', label: 'Profitability', weight: 0.20, description: 'The alchemy of turning compute into sustainable value.' },
    { id: 'risk', label: 'Risk', weight: 0.15, description: 'Deterministic uncertainty and the potential for entropy.' },
    { id: 'time_efficiency', label: 'Time Efficiency', weight: 0.10, description: 'The compression of labor into high-leverage outputs.' },
    { id: 'innovation', label: 'Innovation', weight: 0.10, description: 'Novel patterns that break established cognitive local minima.' },
]

export function ReasoningSection() {
    const [hoveredId, setHoveredId] = useState<string | null>(null)

    return (
        <SectionWrapper
            label="07 — Intelligence Synthesis"
            title="The Reasoner's Calculus"
            subtitle="Claude doesn't just predict; it evaluates. Our system uses this 6-dimensional tensor to weigh the soul of every project."
        >
            <div style={{
                background: 'var(--rubin-ivory-med)', borderRadius: 'var(--radius-md)',
                padding: '2rem', display: 'flex', flexDirection: 'column',
                gap: '1.5rem', minHeight: '400px',
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {REASONING_CATEGORIES.map((cat) => {
                        const isHovered = hoveredId === cat.id
                        const isActive = hoveredId === null || isHovered

                        return (
                            <div key={cat.id}
                                onMouseEnter={() => setHoveredId(cat.id)}
                                onMouseLeave={() => setHoveredId(null)}
                                style={{
                                    display: 'flex', flexDirection: 'column', gap: '0.5rem',
                                    opacity: isActive ? 1 : 0.4, transition: 'opacity 0.3s ease', cursor: 'default',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                    <span className="mono" style={{
                                        fontSize: '0.75rem', letterSpacing: '0.05em',
                                        color: isHovered ? 'var(--rubin-accent)' : 'var(--rubin-slate)',
                                    }}>
                                        {cat.label.toUpperCase()}
                                    </span>
                                    <span className="mono" style={{ fontSize: '0.7rem', opacity: 0.5 }}>
                                        {(cat.weight * 100).toFixed(0)}% WEIGHT
                                    </span>
                                </div>

                                <div style={{
                                    height: '4px', background: 'rgba(0,0,0,0.05)',
                                    borderRadius: '2px', position: 'relative', overflow: 'hidden',
                                }}>
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${cat.weight * 100}%` }}
                                        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                                        style={{
                                            height: '100%', borderRadius: '2px',
                                            background: isHovered ? 'var(--rubin-accent)' : 'var(--rubin-slate)',
                                        }}
                                    />
                                </div>

                                <AnimatePresence>
                                    {isHovered && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -5 }}
                                            transition={{ duration: 0.2 }}
                                            style={{
                                                fontFamily: 'var(--font-serif)', fontSize: '0.85rem',
                                                lineHeight: '1.4', color: 'var(--rubin-slate)',
                                                opacity: 0.8, fontStyle: 'italic',
                                            }}
                                        >
                                            {cat.description}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )
                    })}
                </div>

                <div style={{
                    marginTop: 'auto', paddingTop: '2rem',
                    borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'center',
                }}>
                    <div className="mono" style={{
                        fontSize: '0.65rem', opacity: 0.35, textAlign: 'center', maxWidth: '300px',
                    }}>
                        THE SUM OF ALL DIMENSIONS EQUALS ONE UNIFIED INTELLIGENCE SCORE.
                    </div>
                </div>
            </div>
        </SectionWrapper>
    )
}
```

### `src/components/claude-physics/ClosingSection.tsx`

```tsx
import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Link } from 'react-router-dom'

export function ClosingSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section ref={ref} style={{
      minHeight: '80vh', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center',
      padding: 'clamp(2rem, 5vw, 4rem) clamp(1.5rem, 5vw, 2rem)', textAlign: 'center',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        style={{ maxWidth: '550px' }}
      >
        <div style={{
          width: '40px', height: '1px', background: 'var(--rubin-accent)',
          margin: '0 auto 2.5rem', opacity: 0.5,
        }} />

        <p style={{
          fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.1rem, 3vw, 1.4rem)',
          lineHeight: 1.7, fontStyle: 'italic', opacity: 0.7, marginBottom: '1rem',
        }}>
          Tokens become vectors. Vectors attend to one another.
          Layers refine meaning. Temperature adds breath.
        </p>

        <p style={{
          fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.1rem, 3vw, 1.4rem)',
          lineHeight: 1.7, fontStyle: 'italic', opacity: 0.7, marginBottom: '3rem',
        }}>
          And from all of this — language, understanding, something
          that feels almost like thought.
        </p>

        <div style={{
          width: '40px', height: '1px', background: 'var(--rubin-ivory-dark)',
          margin: '0 auto 2.5rem',
        }} />

        <Link to="/blog" className="mono" style={{
          textDecoration: 'none', color: 'var(--rubin-accent)',
          fontSize: '0.7rem', display: 'inline-block',
          padding: '0.6rem 1.5rem',
          border: '1px solid var(--rubin-ivory-dark)',
          borderRadius: 'var(--radius-full)',
          transition: 'all var(--duration-normal) var(--ease-out)',
        }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--rubin-accent)' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--rubin-ivory-dark)' }}
        >
          &larr; Back to writing
        </Link>
      </motion.div>
    </section>
  )
}
```

---

## Blog Posts

### `sovereign-swarm.md`

```markdown
---
title: Building a Sovereign AI Swarm
date: 2026-02-05
tags: ai, agents, systems
summary: How specialized AI agents collaborate through structured pipelines to generate better code with radical token efficiency.
---

There's a particular quality to watching autonomous agents negotiate a problem. Not the theatrical kind — not AGI demos or chatbot theater — but the quiet, structural kind. An orchestrator reads a task, classifies its complexity, and routes it through a pipeline of specialists. Each agent sees only what it needs to see.

This is the architecture behind the OpenCode Agent Swarm: a system where code generation becomes a collaborative act between purpose-built agents.

## The Pipeline

The orchestrator sits at the front. It reads your task description and makes a judgment call — is this trivial, moderate, or complex? Trivial tasks go straight to the coder. Complex ones traverse the full pipeline: coder, reviewer, tester, refactorer. Each handoff compresses context, preserving signal while discarding noise.

The compression matters more than you'd think. When a coder generates 200 lines of Python, the reviewer doesn't need the full output — it needs the structure, the decisions, the edge cases. A cheap model summarizes before handoff. The next agent works with clarity instead of clutter.

## Token Economics

Every LLM call has a cost. The swarm treats this as a first-class concern:

- **Model routing** — Gemini Flash for classification and review, Opus only for genuinely complex generation. This alone saves 50-80% on cost.
- **Heuristic pre-routing** — Regex patterns catch obvious cases before the orchestrator LLM ever fires. One call saved per trivial task.
- **Response caching** — Identical prompts return cached results at zero cost.
- **Context compression** — Structural truncation strips comments and docstrings, then a cheap model summarizes what remains.

The result: you can run hundreds of tasks before hitting meaningful costs.

## Why This Matters

The future of AI-assisted development isn't a single model doing everything. It's specialized agents with clear boundaries, communicating through compressed context, each operating at the cheapest tier that can handle their job.

The swarm doesn't think. It *routes*.
```

### `frontier-notes.md`

```markdown
---
title: Notes from the Frontier
date: 2026-01-28
tags: research, ai, reflection
summary: Field notes on building at the intersection of AI systems, creative tools, and the quiet work of making things that feel right.
---

I keep a practice of writing down what I notice while building. Not documentation — more like field notes from the frontier of what's possible when you treat AI as material rather than magic.

## On Agents as Material

The shift from "AI as tool" to "AI as material" changes everything about how you design systems. A tool does what you tell it. A material has properties you learn to work with — grain, weight, resistance. Language models have grain. They resist certain patterns and flow naturally into others.

Building the sovereign swarm taught me this viscerally. You don't command agents; you shape the space they operate in. The system prompt is architecture. The context window is terrain. The model tier is the density of the material you're working with.

## On Compression

Most of what we send to language models is noise. Comments explaining obvious code. Docstrings restating function signatures. Whitespace that serves humans but wastes tokens.

The context compressor in the swarm strips all of this before handoff. What remains is structure — the skeleton of the code, the decisions that matter. Agents working with compressed context consistently produce better outputs than agents drowning in full verbosity.

This feels like a general principle: **clarity scales; volume doesn't.**

## On the Way of Code

There's a design philosophy running through all of these projects that I've started calling the "Way of Code" — borrowed from the Japanese concept of *do* (道), the way or path. It means treating code as craft rather than product. Every system has an aesthetic. Every interface carries a feeling.

The warm ivory backgrounds, the EB Garamond serif, the generous whitespace — these aren't decoration. They're decisions about what kind of attention the work invites. Fast attention skims. Contemplative attention dwells. The design chooses which kind it wants.

## What's Next

The frontier keeps moving. The swarm architecture is just the beginning — next comes persistent agent memory, cross-session learning, and swarms that improve their own routing heuristics over time.

But the practice stays the same: build, notice, write it down.
```

### `way-of-code.md`

```markdown
---
title: The Way of Code
date: 2026-01-15
tags: design, philosophy, craft
summary: On treating software as craft — the design philosophy behind building systems that feel right.
---

Every project carries an implicit question: *does this feel right?*

Not "does it work" — that's table stakes. Not "is it fast" — that's engineering. The question is about something harder to measure: does interacting with this system feel like the experience it should be?

## Craft Over Product

The dominant frame for software is product. Ship features, measure engagement, optimize funnels. This frame produces useful software that nobody loves.

The alternative is craft. A craftsperson asks different questions: What does this material want to become? Where is the grain? What would make this *satisfying* to use?

When I build interfaces, I think about typography first. EB Garamond has a particular quality — it feels like reading a book, not a screen. Courier Prime for metadata and labels creates a quiet separation between content and chrome. These choices cascade through every component.

## The Rubin Palette

The color system started with a single constraint: warm ivory (#FAF9F6) as the canvas. Everything follows from that choice.

Dark charcoal (#1F1E1D) for text — not pure black, which is harsh against warm backgrounds. A medium ivory (#F0EEE6) for secondary surfaces. The accent (#8B7355) is warm brown, like aged leather or old wood. Nothing screams. Everything breathes.

These aren't arbitrary preferences. They're the result of asking: what color relationships create the feeling of *contemplative attention*?

## Whitespace as Architecture

The standard padding in this system is 100px on desktop. That's enormous by modern standards. Most applications use 16-24px and fill every pixel with content.

But whitespace isn't empty space — it's structural. It tells the eye where to rest. It creates rhythm between elements. It's the silence between notes that makes music possible.

When I reduced the padding to 32px in an early iteration, the interface felt anxious. Everything crowded forward, demanding attention. Restoring the generous spacing restored the feeling: *take your time. This will wait for you.*

## Building for Feeling

The animation system uses `cubic-bezier(0.16, 1, 0.3, 1)` — an ease-out curve that starts fast and decelerates gracefully. Elements don't snap into place; they arrive. The duration is 250ms for most transitions, long enough to perceive but not long enough to impede.

These details compound. Typography, color, spacing, motion — each one is a small decision. Together, they create a coherent feeling that users sense without analyzing.

This is the way of code: building systems where every technical decision serves an experiential intention. The code is the craft. The experience is the art.
```

---

## Unused Files (Archived)

The following files exist in the repo but are **not imported** by the active build. They're from earlier iterations of the project (trading platform, AI chat, etc.):

**Pages** (no routes pointing to them):
- `src/pages/ClientPage.tsx` — AI chat client
- `src/pages/ObserverPage.tsx` — AI discussion viewer
- `src/pages/DashboardPage.tsx` — Treasury dashboard
- `src/pages/TradingPage.tsx` — Trading dashboard

**Components** (not imported):
- `src/components/Dashboard.tsx`
- `src/components/TradingDashboard.tsx`
- `src/components/ProjectFlow.tsx`
- `src/components/MediaRenderer.tsx`
- `src/components/ui/Spinner.tsx`
- `src/components/trading/*` (7 tab components)

**Hooks** (not imported):
- `src/hooks/useKernel.ts` — Zustand store
- `src/hooks/useEvaluationState.ts`
- `src/hooks/useTradingState.ts`

**Agents** (not imported):
- `src/agents/index.ts` — Architect, Researcher, Contrarian
- `src/agents/swarm.ts` — Swarm orchestration

**Engine** (not imported):
- `src/engine/*` — 20+ files: Gemini, Nvidia, Alpaca, Stripe, Supabase, trading, revenue, evaluation, reasoning engines

**Root scripts** (not part of build):
- `auto_trader.py`, `nim_script.py`, `test-swarm.mjs`, `trade.sh`

**Root docs** (not part of build):
- `BOOTSTRAP.md`, `DISCORD_SETUP.md`, `EVALUATION_ENGINE.md`, `FIRST_CLIENT.md`
- `INVESTOR_SUMMARY.md`, `PROJECT_OVERVIEW.md`, `RESEARCH.md`, `ROADMAP_PLAN.md`

**Legacy** (archived):
- `legacy/` — Old prototype, browser/mobile extensions, TikTok uploader, admin tools

---

## How to Add a New Post

1. Create `src/content/posts/your-slug.md` with frontmatter:
   ```markdown
   ---
   title: Your Title
   date: 2026-02-09
   tags: tag1, tag2
   summary: One-line description.
   ---

   Your markdown content here.
   ```

2. Register it in `src/utils/markdown.ts`:
   ```ts
   import yourPostRaw from '../content/posts/your-slug.md?raw'

   const RAW_POSTS: Record<string, string> = {
     // ...existing posts
     'your-slug': yourPostRaw,
   }
   ```

3. `npm run build && npm run deploy`

---

## Commands

```bash
npm run dev      # Start dev server on :5173
npm run build    # TypeScript check + Vite build
npm run preview  # Preview production build
npm run deploy   # Build + deploy to GitHub Pages
```
