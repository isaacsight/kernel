// SYNTH — Web Brain Adapter
//
// When SYNTH runs on kernel.chat (not localhost), the partner's brain
// calls the Supabase game-brain edge function instead of local kbot.
// This means the partner AI literally thinks through the same Claude
// infrastructure that powers the kernel.chat chat engine.
//
// The AI stack in action:
//   Player action → Game state snapshot → BrainPrompt builds compact prompt
//   → WebBrain sends to game-brain edge function → Claude Haiku thinks
//   → Directive JSON returns → Partner acts
//
// Claude Code wrote this. kbot's personality drives it. Haiku executes it.

import type { BrainContext, BrainDirective, Personality } from '../types'
import { buildBrainPrompt } from './BrainPrompt'
import { BrainMemory } from './BrainMemory'

const SUPABASE_URL = 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const GAME_BRAIN_ENDPOINT = `${SUPABASE_URL}/functions/v1/game-brain`
const TIMEOUT_MS = 4000

export interface WebBrainCallbacks {
  /** Called when the brain starts thinking */
  onThinkStart?: () => void
  /** Called when the brain returns a directive */
  onThinkEnd?: (directive: BrainDirective | null, latencyMs: number) => void
  /** Called when connection status changes */
  onStatusChange?: (status: 'connected' | 'disconnected' | 'thinking') => void
}

export class WebBrain {
  private personality: Personality
  private memory: BrainMemory
  private callbacks: WebBrainCallbacks
  private available = false
  private thinkCount = 0
  private totalLatency = 0

  constructor(personality: Personality, callbacks: WebBrainCallbacks = {}) {
    this.personality = personality
    this.memory = new BrainMemory()
    this.callbacks = callbacks
  }

  /** Check if the game-brain edge function is reachable */
  async checkAvailability(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const id = setTimeout(() => controller.abort(), 4000)
      // Send a minimal prompt to verify the function responds
      const res = await fetch(GAME_BRAIN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Reply: {"type":"follow","speech":"Ready","confidence":1}' }),
        signal: controller.signal,
      })
      clearTimeout(id)
      this.available = res.ok
    } catch {
      this.available = false
    }
    this.callbacks.onStatusChange?.(this.available ? 'connected' : 'disconnected')
    return this.available
  }

  isAvailable(): boolean {
    return this.available
  }

  setPersonality(personality: Personality): void {
    this.personality = personality
  }

  getMemory(): BrainMemory {
    return this.memory
  }

  /** Get average think latency in ms */
  getAvgLatency(): number {
    return this.thinkCount > 0 ? Math.round(this.totalLatency / this.thinkCount) : 0
  }

  getThinkCount(): number {
    return this.thinkCount
  }

  /** Send game state to Claude Haiku via game-brain edge function */
  async think(ctx: BrainContext): Promise<BrainDirective | null> {
    if (!this.available) return null

    this.callbacks.onThinkStart?.()
    this.callbacks.onStatusChange?.('thinking')

    const prompt = buildBrainPrompt(ctx, this.personality, this.memory.getProfileContext())
    const start = performance.now()

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const res = await fetch(GAME_BRAIN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          personality: this.personality.id,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        this.callbacks.onStatusChange?.('connected')
        return null
      }

      const data = await res.json() as { text?: string }
      const latency = Math.round(performance.now() - start)
      this.thinkCount++
      this.totalLatency += latency

      const directive = this.parseDirective(data.text ?? '')
      this.callbacks.onThinkEnd?.(directive, latency)
      this.callbacks.onStatusChange?.('connected')
      return directive
    } catch {
      clearTimeout(timeoutId)
      this.callbacks.onStatusChange?.('connected')
      return null
    }
  }

  private parseDirective(text: string): BrainDirective | null {
    const jsonMatch = text.match(/\{[^}]*"type"\s*:\s*"[^"]+(?:"[^}]*)?\}/)
    if (!jsonMatch) return null

    try {
      const raw = JSON.parse(jsonMatch[0]) as Record<string, unknown>
      const type = raw.type as string
      const validTypes = ['attack', 'defend', 'retreat', 'heal', 'follow', 'flank', 'hold_position']
      if (!validTypes.includes(type)) return null

      return {
        type: type as BrainDirective['type'],
        target: typeof raw.target === 'string' ? raw.target : undefined,
        speech: typeof raw.speech === 'string' ? raw.speech.slice(0, 50) : undefined,
        confidence: typeof raw.confidence === 'number' ? Math.min(1, Math.max(0, raw.confidence)) : 0.5,
        reasoning: typeof raw.reasoning === 'string' ? raw.reasoning : undefined,
      }
    } catch {
      return null
    }
  }
}

/** Detect if we're running on the kernel.chat site (not standalone dev) */
export function isWebMode(): boolean {
  try {
    const host = window.location.hostname
    // Direct: game loaded at kernel.chat/play/
    if (host === 'kernel.chat' || host === 'www.kernel.chat') return true
    // Iframe: check if parent is kernel.chat
    if (window.parent !== window) {
      try {
        const parentHost = window.parent.location.hostname
        if (parentHost === 'kernel.chat' || parentHost === 'www.kernel.chat') return true
      } catch {
        // Cross-origin — can't read parent, but if we're in an iframe
        // served from kernel.chat, the referrer tells us
        if (document.referrer.includes('kernel.chat')) return true
      }
    }
    return false
  } catch {
    return false
  }
}

/**
 * Create default WebBrain callbacks that relay status to the parent window.
 * Used when SYNTH is embedded in an iframe on kernel.chat.
 */
export function createParentMessageCallbacks(): WebBrainCallbacks {
  const send = (data: Record<string, unknown>) => {
    try {
      window.parent.postMessage(data, '*')
    } catch { /* not in iframe */ }
  }

  return {
    onStatusChange: (status) => {
      send({ type: 'synth-brain-status', status })
    },
    onThinkEnd: (_directive, latencyMs) => {
      send({
        type: 'synth-brain-stats',
        thinkCount: 0, // Will be set by caller
        avgLatency: latencyMs,
      })
    },
  }
}
