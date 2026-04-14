// ─── Me Agent Hook ──────────────────────────────────────────────
//
// Conversational layer over the personal platform page. Builds a
// system prompt from the user's published record (influences,
// timeline, music, posts) and streams responses via claude-proxy.

import { useCallback, useRef, useState } from 'react'
import { claudeStreamChat } from '../engine/ClaudeClient'
import { buildMeAgentSystemPrompt, type MeAgentContext } from '../agents/me-agent'

export interface MeTurn {
  id: string
  role: 'visitor' | 'me'
  text: string
  at: number
}

export interface UseMeAgentResult {
  turns: MeTurn[]
  send: (message: string) => Promise<void>
  isStreaming: boolean
  error: string | null
  reset: () => void
}

export function useMeAgent(ctx: MeAgentContext): UseMeAgentResult {
  const [turns, setTurns] = useState<MeTurn[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const send = useCallback(async (message: string) => {
    const clean = message.trim()
    if (!clean || isStreaming) return
    setError(null)

    const visitorTurn: MeTurn = {
      id: `v-${Date.now()}`,
      role: 'visitor',
      text: clean,
      at: Date.now(),
    }
    const meTurnId = `m-${Date.now()}`
    const meTurn: MeTurn = {
      id: meTurnId,
      role: 'me',
      text: '',
      at: Date.now(),
    }

    setTurns(prev => [...prev, visitorTurn, meTurn])
    setIsStreaming(true)

    // Build conversation history for Claude
    const system = buildMeAgentSystemPrompt(ctx)
    const history = [
      ...turns.map(t => ({
        role: t.role === 'visitor' ? 'user' : 'assistant',
        content: t.text,
      })),
      { role: 'user', content: clean },
    ]

    const controller = new AbortController()
    abortRef.current = controller

    try {
      await claudeStreamChat(
        history,
        (chunk: string) => {
          setTurns(prev =>
            prev.map(t =>
              t.id === meTurnId ? { ...t, text: t.text + chunk } : t
            )
          )
        },
        {
          system,
          model: 'sonnet',
          max_tokens: 1024,
          signal: controller.signal,
        }
      )
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        // silent
      } else {
        const msg = err instanceof Error ? err.message : 'Something went wrong.'
        setError(msg)
        setTurns(prev =>
          prev.map(t =>
            t.id === meTurnId && !t.text
              ? { ...t, text: '(unable to respond just now)' }
              : t
          )
        )
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [ctx, isStreaming, turns])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setTurns([])
    setError(null)
    setIsStreaming(false)
  }, [])

  return { turns, send, isStreaming, error, reset }
}
