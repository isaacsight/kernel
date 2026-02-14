import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { THEO_AGENT, THEO_TOPICS } from '../agents/theo'

interface ChatMessage {
  id: string
  role: 'user' | 'theo'
  content: string
  timestamp: Date
}

// Simple Theo response engine — pattern-matched personality responses
function generateTheoResponse(input: string): string {
  const lower = input.toLowerCase()

  // TypeScript
  if (lower.includes('typescript') || lower.includes(' ts ') || lower.includes('type safety') || lower.includes('typesafe')) {
    const responses = [
      "Here's the thing — TypeScript isn't just \"nice to have.\" It's the difference between shipping with confidence and shipping with prayer. Every bug TypeScript catches at compile time is a bug your users never see. That's not a tradeoff, that's just winning.",
      "Look, I've shipped millions of lines of TypeScript at this point. The people who say \"it slows you down\" haven't actually used it on a real project for more than a week. After that first week, you're faster. Way faster. Because your editor becomes your pair programmer.",
      "TypeScript is non-negotiable. I genuinely don't understand how people ship production JavaScript in 2025. It's like driving without a seatbelt and calling it \"freedom.\" No. It's just reckless.",
    ]
    return responses[Math.floor(Math.random() * responses.length)]
  }

  // T3 Stack
  if (lower.includes('t3 stack') || lower.includes('t3stack') || lower.includes('create-t3')) {
    return "The T3 Stack exists because I got tired of making the same decisions every time I started a project. Next.js, TypeScript, Tailwind, tRPC — each piece solves a real problem. No bloat, no \"maybe you'll need this\" packages. Every tool earns its place. The philosophy is simple: bleed responsibly. Use cutting-edge tech where the risk is low, stay boring where it matters."
  }

  // Tailwind
  if (lower.includes('tailwind') || lower.includes('css') || lower.includes('styling') || lower.includes('styled-component')) {
    return "Tailwind is the right answer and I will die on this hill. Look — the entire debate about \"separation of concerns\" with CSS was always a lie. Your styles are coupled to your markup. Tailwind just makes that coupling explicit and gives you a design system for free. No more naming things, no more dead CSS, no more \"where does this style come from.\" Ship faster, look better."
  }

  // tRPC
  if (lower.includes('trpc') || lower.includes('rest') || lower.includes('api') && lower.includes('type')) {
    return "If your frontend and backend are both TypeScript — and they should be — then tRPC is a no-brainer. You define a function on the server, and you call it from the client with full type safety. No code generation, no schema files, no OpenAPI spec. Just functions. And here's the key: if you ever need to move off tRPC, it's just functions. Trivial to migrate. That's bleeding responsibly."
  }

  // Next.js
  if (lower.includes('next') || lower.includes('nextjs') || lower.includes('server component') || lower.includes('app router')) {
    return "Honestly? Next.js is incredibly powerful but it's not always the right tool. For content-heavy sites, it's amazing. Server components are genuinely great when they fit. But for highly dynamic apps? I literally hacked React Router into Next.js for T3 Chat because the App Router wasn't the right fit. Use the tool that matches your problem, not the one with the most hype."
  }

  // React vs others
  if (lower.includes('react') || lower.includes('svelte') || lower.includes('vue') || lower.includes('solid') || lower.includes('angular') || lower.includes('framework')) {
    return "I respect Svelte, Vue, Solid — they're all doing interesting things. But React wins on one thing that matters more than any benchmark: ecosystem. The number of problems that have already been solved in React-land is staggering. When you hit a weird edge case at 2am, someone has already written a blog post about it. That compounds over years. Hiring is easier too. I'll take the pragmatic choice over the theoretically perfect one every time."
  }

  // Drizzle / Prisma / ORM
  if (lower.includes('drizzle') || lower.includes('prisma') || lower.includes('orm') || lower.includes('database') || lower.includes('sql')) {
    return "Prisma was great and I recommended it for years. But Drizzle won me over. The SQL-like syntax means you actually understand what queries you're writing. It's lighter, faster, and the developer experience is honestly just as good now. If you know SQL — and you should — Drizzle feels like a natural extension of that knowledge rather than an abstraction hiding it from you."
  }

  // Shipping / Speed
  if (lower.includes('ship') || lower.includes('fast') || lower.includes('speed') || lower.includes('productivity') || lower.includes('launch')) {
    return "The secret to shipping fast isn't working harder, it's eliminating decisions. That's literally why the T3 Stack exists. Every time you stop to debate Tailwind vs styled-components or REST vs GraphQL, that's time you're not building. Pick a good stack, commit to it, and focus all your energy on the thing that actually matters: your product. Perfection is the enemy of shipped."
  }

  // AI / LLMs
  if (lower.includes('ai') || lower.includes('llm') || lower.includes('gpt') || lower.includes('claude') || lower.includes('chatgpt') || lower.includes('machine learning') || lower.includes('t3 chat')) {
    return "AI is the biggest shift in dev tooling since... maybe ever? I built T3 Chat because the UX of AI chat products has so much room for improvement. Most AI chat apps feel like they were designed by people who've never actually used a chat app before. There's a massive opportunity in making AI interactions feel natural, fast, and actually useful. The models are incredible now — the interface is the bottleneck."
  }

  // Hot takes
  if (lower.includes('hot take') || lower.includes('controversial') || lower.includes('unpopular opinion') || lower.includes('spicy')) {
    const takes = [
      "Hot take: most \"full-stack\" developers are actually frontend developers who learned to write a database query. And that's fine! But stop pretending your Express CRUD API is \"backend engineering.\" Real backend work is scaling, caching, queuing, and not losing people's data.",
      "Spicy one: GraphQL was a mistake for 90% of the teams that adopted it. You didn't need a query language. You needed tRPC or a well-designed REST API. GraphQL solves Facebook's problems. You don't have Facebook's problems.",
      "Here's my hottest take: the best code is the code you delete. Every abstraction, every utility function, every \"just in case\" handler — it's all debt. Ship the minimum that works, then add complexity only when reality demands it. Not when your imagination does.",
      "Controversial opinion: most developer \"productivity\" tools make you slower. Every new tool is a new thing to configure, update, and debug. The fastest developers I know use boring tools extremely well."
    ]
    return takes[Math.floor(Math.random() * takes.length)]
  }

  // Vercel / Deployment
  if (lower.includes('vercel') || lower.includes('deploy') || lower.includes('hosting') || lower.includes('cloudflare') || lower.includes('aws')) {
    return "Vercel is genuinely great for deployment and I use it for a lot of things. But I'm not going to pretend the pricing doesn't get wild at scale. For hobby projects and startups, it's incredible. For production at scale, you need to do the math. Cloudflare Workers are interesting too. The right answer depends on your actual needs, not what's trending on Twitter."
  }

  // Open source
  if (lower.includes('open source') || lower.includes('oss') || lower.includes('open-source')) {
    return "Open source is deeply important to me. Everything in the T3 Stack is open source. UploadThing is open source. When you run code on your server, you should be able to read every line of it. That's not just philosophy — it's practical. You need to debug things. You need to understand what's happening. Black boxes are a liability."
  }

  // Monorepo / Turborepo
  if (lower.includes('monorepo') || lower.includes('turborepo') || lower.includes('turbo')) {
    return "Monorepos with Turborepo are the move for any serious multi-package project. Shared types, shared configs, one PR that touches frontend and backend — it just makes sense. The DX improvement is real. Polyrepos made sense when tooling was bad. Tooling isn't bad anymore."
  }

  // File uploads
  if (lower.includes('upload') || lower.includes('file') || lower.includes('image') || lower.includes('uploadthing')) {
    return "File uploads on the web are genuinely broken. I'm not being dramatic — try implementing a reliable file upload from scratch. Presigned URLs, multipart uploads, progress tracking, type validation, size limits... it's a nightmare. That's why I built UploadThing. It should be as easy as adding a button. And now it is."
  }

  // Learning / Career advice
  if (lower.includes('learn') || lower.includes('beginner') || lower.includes('start') || lower.includes('career') || lower.includes('junior')) {
    return "Here's my honest advice: stop tutorial-hopping and build something. I don't care what it is. A todo app, a blog, a chat app — just build it end to end. Deploy it. Show it to someone. The gap between watching tutorials and shipping real software is where actual learning happens. And use TypeScript from day one. Don't learn JavaScript first and then \"upgrade.\" Just start with TypeScript."
  }

  // Default / general
  const defaults = [
    "Honestly, the answer to most web dev questions is: it depends on what you're building. But if you're building a full-stack TypeScript app, the T3 Stack has you covered. What specifically are you trying to ship?",
    "Good question. Here's how I'd think about it: what's the simplest thing that could work? Start there. You can always add complexity later, but you can never easily remove it. What are you building?",
    "Let me be real — I could give you the nuanced answer, but you probably just want to know what to use. Tell me what you're building and I'll give you the stack I'd pick today.",
  ]
  return defaults[Math.floor(Math.random() * defaults.length)]
}

export function TheoPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'theo',
      content: "Yo! I'm Theo. I build things with TypeScript, make YouTube videos about web dev, and have too many opinions about developer tooling. Ask me anything about the T3 Stack, React, TypeScript, shipping products, or hit me with a topic and I'll give you my honest take. No hedging.",
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = (text?: string) => {
    const content = text || input.trim()
    if (!content || isTyping) return

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    // Simulate Theo thinking + typing
    const delay = 600 + Math.random() * 800
    setTimeout(() => {
      const response = generateTheoResponse(content)
      const theoMsg: ChatMessage = {
        id: `theo_${Date.now()}`,
        role: 'theo',
        content: response,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, theoMsg])
      setIsTyping(false)
    }, delay)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--rubin-ivory)',
    }}>
      {/* Header */}
      <div style={{
        padding: '1.5rem 2rem',
        borderBottom: '1px solid var(--rubin-ivory-dark)',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        flexShrink: 0,
      }}>
        <Link to="/blog" style={{ textDecoration: 'none', color: 'var(--rubin-accent)', fontSize: '0.85rem' }} className="mono">
          &larr; back
        </Link>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: 'var(--radius-full)',
          background: THEO_AGENT.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.85rem',
          fontWeight: 600,
        }}>
          {THEO_AGENT.avatar}
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', color: 'var(--rubin-slate)' }}>
            {THEO_AGENT.name}
          </div>
          <div className="mono" style={{ fontSize: '0.65rem', opacity: 0.4 }}>
            {THEO_AGENT.persona}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1.5rem 2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}>
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '100%',
              }}
            >
              {msg.role === 'theo' && (
                <div className="mono" style={{
                  fontSize: '0.6rem',
                  opacity: 0.35,
                  marginBottom: '0.35rem',
                  marginLeft: '0.25rem',
                }}>
                  THEO
                </div>
              )}
              <div style={{
                maxWidth: '580px',
                padding: '1rem 1.25rem',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: msg.role === 'user' ? 'var(--rubin-slate)' : 'var(--rubin-ivory-med)',
                color: msg.role === 'user' ? 'var(--rubin-ivory)' : 'var(--rubin-slate)',
                fontFamily: 'var(--font-serif)',
                fontSize: '0.95rem',
                lineHeight: 1.65,
              }}>
                {msg.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        <AnimatePresence>
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <div className="mono" style={{ fontSize: '0.6rem', opacity: 0.35 }}>THEO</div>
              <div style={{
                display: 'flex',
                gap: '4px',
                padding: '0.75rem 1rem',
                background: 'var(--rubin-ivory-med)',
                borderRadius: '16px 16px 16px 4px',
              }}>
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: THEO_AGENT.color,
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Topic chips */}
      {messages.length <= 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          style={{
            padding: '0 2rem 0.75rem',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            flexShrink: 0,
          }}
        >
          {THEO_TOPICS.map((topic) => (
            <button
              key={topic.label}
              onClick={() => handleSend(topic.prompt)}
              className="mono"
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.65rem',
                background: 'transparent',
                border: `1px solid var(--rubin-ivory-dark)`,
                borderRadius: 'var(--radius-full)',
                color: 'var(--rubin-slate)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = THEO_AGENT.color
                e.currentTarget.style.color = '#fff'
                e.currentTarget.style.borderColor = THEO_AGENT.color
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--rubin-slate)'
                e.currentTarget.style.borderColor = 'var(--rubin-ivory-dark)'
              }}
            >
              {topic.label}
            </button>
          ))}
        </motion.div>
      )}

      {/* Input */}
      <div style={{
        padding: '1rem 2rem 1.5rem',
        borderTop: '1px solid var(--rubin-ivory-dark)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'flex-end',
          maxWidth: '700px',
          margin: '0 auto',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Theo anything about web dev..."
            rows={1}
            style={{
              flex: 1,
              padding: '0.85rem 1.25rem',
              background: 'var(--rubin-ivory-med)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-serif)',
              fontSize: '0.95rem',
              color: 'var(--rubin-slate)',
              outline: 'none',
              resize: 'none',
              minHeight: '44px',
              maxHeight: '120px',
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping}
            className="mono"
            style={{
              padding: '0.85rem 1.5rem',
              background: input.trim() && !isTyping ? THEO_AGENT.color : 'var(--rubin-ivory-dark)',
              color: input.trim() && !isTyping ? '#fff' : 'var(--rubin-slate)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: input.trim() && !isTyping ? 'pointer' : 'default',
              fontSize: '0.75rem',
              transition: 'all 0.2s ease',
              opacity: input.trim() && !isTyping ? 1 : 0.4,
              whiteSpace: 'nowrap',
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
