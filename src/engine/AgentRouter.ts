// AgentRouter — Haiku-based intent classifier for specialist routing
import { getProvider } from './providers/registry'

export interface ClassificationResult {
  agentId: 'kernel' | 'researcher' | 'coder' | 'writer' | 'analyst' | 'aesthete' | 'guardian' | 'curator' | 'strategist' | 'infrastructure' | 'quant' | 'investigator'
  confidence: number
  complexity: number
  needsResearch: boolean
  isMultiStep: boolean
  needsSwarm: boolean
  needsImageGen: boolean
}

export interface ModelRoutingContext {
  messageWordCount?: number
  turnCount?: number
  extendedThinking?: boolean
}

/** Auto-select model based on task complexity, message length, and conversation depth */
export function resolveModelFromClassification(
  c: ClassificationResult,
  ctx?: ModelRoutingContext,
): 'sonnet' | 'haiku' {
  // Extended thinking — always Sonnet
  if (ctx?.extendedThinking) return 'sonnet'
  // Deep conversation (3+ user messages) — Sonnet
  if (ctx?.turnCount && ctx.turnCount >= 3) return 'sonnet'
  // High complexity task — Sonnet
  if (c.complexity >= 0.6) return 'sonnet'
  // Long/detailed message (30+ words) — Sonnet
  if (ctx?.messageWordCount && ctx.messageWordCount >= 30) return 'sonnet'
  // Everything else — Haiku (the default!)
  return 'haiku'
}

const CLASSIFICATION_SYSTEM = `You are an intent classifier. Given a user message and recent conversation context, classify the user's intent to route to the best specialist agent.

Agents:
- kernel: Personal conversation, life advice, general chat, emotional support, casual talk, questions about the AI itself
- researcher: Deep questions, current events, fact-finding, "what is", "explain", "tell me about", research requests, anything needing web search for accuracy
- coder: Programming, debugging, code generation, technical implementation, algorithms, APIs, databases
- writer: Content creation, editing, copywriting, emails, blog posts, social media, creative writing, naming
- analyst: Data analysis, strategic thinking, evaluation, comparisons, decision-making, business strategy, pros/cons
- aesthete: UI/UX design, CSS, animations, visual style, typography, "make it look better", "does this look good"
- guardian: Security, reliability, testing, "is this safe", "check for bugs", "integrity", performance audits
- curator: User history, identity, memories, "remember when", "how have I changed", "what are my goals"
- strategist: High-level market strategy, ROI, economic risk, "is this a good business move", competition analysis
- infrastructure: Data center architecture, hardware, bare metal, cooling, network latency, reverse-engineering physical systems
- quant: Algorithmic trading, financial engineering, arbitrage, backtesting, smart contracts, "how to trade X"
- investigator: OSINT, deep research, tracing metadata, forensics, connecting disparate data points

Also determine:
- complexity: 0.0-1.0 score for how intellectually demanding the task is. 0.0-0.35 = simple (greetings, simple factual, casual chat, straightforward questions). 0.35-0.8 = moderate (most tasks). 0.85-1.0 = very hard (complex multi-step reasoning, intricate code architecture, nuanced philosophical analysis, tasks requiring exceptional depth)
- needsResearch: true if the question requires multi-step web research (not just a simple search). Examples: "research AI regulation in the EU", "deep dive into...", "comprehensive analysis of..."
- isMultiStep: true if the request requires 3+ distinct operations that build on each other. Examples: "research X, then analyze Y, then write Z", "build a complete...", "create a plan and execute it"
- needsSwarm: true if the question would benefit from multiple specialist perspectives working together. Examples: "what should I do about...", "evaluate this idea", "help me think through...", complex decisions, multi-domain questions, strategy + analysis + creativity combined. NOT for simple factual questions or single-domain tasks.
- needsImageGen: true if the user is explicitly asking to CREATE/GENERATE/DRAW/MAKE an image, picture, illustration, photo, artwork, or visual. Examples: "generate an image of a sunset", "draw me a cat", "create a picture of...", "make me a logo". NOT for analyzing existing images, not for describing images, not for editing photos, not for image-related questions.
Respond with ONLY valid JSON, no other text:
{"agentId": "kernel", "confidence": 0.9, "complexity": 0.5, "needsResearch": false, "isMultiStep": false, "needsSwarm": false, "needsImageGen": false}`

export async function classifyIntent(
  message: string,
  recentContext: string,
  hasAttachments?: boolean,
  loomContext?: string,
): Promise<ClassificationResult> {
  try {
    const attachmentNote = hasAttachments ? '\n\n[User has attached files for analysis]' : ''
    const prompt = recentContext
      ? `Recent conversation:\n${recentContext}\n\nNew message to classify:\n${message}${attachmentNote}`
      : `Message to classify:\n${message}${attachmentNote}`

    // Inject Loom routing history if available
    const system = loomContext
      ? `${CLASSIFICATION_SYSTEM}\n\n---\n\n${loomContext}`
      : CLASSIFICATION_SYSTEM

    const result = await getProvider().json<ClassificationResult>(prompt, {
      system,
      tier: 'fast',
      max_tokens: 150,
    })

    // Validate the result
    const validAgents = ['kernel', 'researcher', 'coder', 'writer', 'analyst', 'aesthete', 'guardian', 'curator', 'strategist', 'infrastructure', 'quant', 'investigator']
    if (!validAgents.includes(result.agentId)) {
      return { agentId: 'kernel', confidence: 0, complexity: 0.5, needsResearch: false, isMultiStep: false, needsSwarm: false, needsImageGen: false }
    }

    // Fall back to kernel if confidence is too low
    if (typeof result.confidence !== 'number' || result.confidence < 0.3) {
      return { agentId: 'kernel', confidence: result.confidence || 0, complexity: 0.5, needsResearch: false, isMultiStep: false, needsSwarm: false, needsImageGen: false }
    }

    return {
      agentId: result.agentId,
      confidence: Math.min(1, Math.max(0, result.confidence)),
      complexity: Math.min(1, Math.max(0, typeof result.complexity === 'number' ? result.complexity : 0.5)),
      needsResearch: !!result.needsResearch,
      isMultiStep: !!result.isMultiStep,
      needsSwarm: !!result.needsSwarm,
      needsImageGen: !!result.needsImageGen,
    }
  } catch {
    // On any failure, fall back to kernel
    return { agentId: 'kernel', confidence: 0, complexity: 0.5, needsResearch: false, isMultiStep: false, needsSwarm: false, needsImageGen: false }
  }
}

/** Build a short context string from recent messages for classification */
export function buildRecentContext(messages: { role: string; content: string }[], count = 3): string {
  return messages
    .slice(-count)
    .map(m => `${m.role === 'user' ? 'User' : 'Kernel'}: ${m.content.slice(0, 150)}`)
    .join('\n')
}
