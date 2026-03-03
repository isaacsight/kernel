// AgentRouter — Haiku-based intent classifier for specialist routing
import { getBackgroundProvider } from './providers/registry'

export interface ClassificationResult {
  agentId: 'kernel' | 'researcher' | 'coder' | 'writer' | 'analyst' | 'aesthete' | 'guardian' | 'curator' | 'strategist' | 'infrastructure' | 'quant' | 'investigator'
  confidence: number
  complexity: number
  needsResearch: boolean
  isMultiStep: boolean
  needsSwarm: boolean
  needsImageGen: boolean
  needsImageRefinement: boolean
  needsPlatformEngine: boolean
  needsContentEngine: boolean
  needsAlgorithm: boolean
  needsKnowledgeQuery: boolean
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
- needsImageRefinement: true if the conversation has a recently generated image AND the user is asking to MODIFY/REFINE/ADJUST it. Examples: "make it darker", "add prices", "change to landscape", "more vibrant", "less busy", "refine this", "try again but with...", "remove the background". When true, needsImageGen should also be true. NOT for unrelated image generation requests.
Respond with ONLY valid JSON, no other text:
{"agentId": "kernel", "confidence": 0.9, "complexity": 0.5, "needsResearch": false, "isMultiStep": false, "needsSwarm": false, "needsImageGen": false, "needsImageRefinement": false}`

// ─── Local fast-path classifier (keyword/regex, <1ms) ──────────────
// Skips the Groq API call when keyword signals are unambiguous.
// Goal: classify 80%+ of messages locally, only call Groq for genuinely ambiguous intents.

const KEYWORD_MAP: Record<string, string[]> = {
  coder: ['code', 'debug', 'function', 'algorithm', 'api', 'build', 'program', 'implement', 'deploy', 'compile', 'typescript', 'javascript', 'python', 'react', 'css', 'html', 'sql', 'regex', 'git', 'npm', 'bug', 'error', 'stack', 'class', 'variable', 'refactor', 'lint', 'test', 'component', 'hook', 'import', 'export', 'async', 'promise', 'array', 'object', 'string', 'number', 'boolean', 'interface', 'type', 'const', 'let', 'var', 'return', 'console', 'server', 'endpoint', 'database', 'query', 'schema', 'migration', 'docker', 'kubernetes', 'ci/cd', 'pipeline'],
  writer: ['write', 'draft', 'email', 'blog', 'poem', 'story', 'essay', 'copy', 'edit', 'rewrite', 'proofread', 'content', 'script', 'tweet', 'caption', 'headline', 'slogan', 'letter', 'article', 'summary', 'paragraph', 'outline', 'tone', 'voice'],
  researcher: ['research', 'explain', 'what is', 'tell me about', 'how does', 'why does', 'history of', 'compare', 'define', 'source', 'study', 'evidence', 'data', 'fact', 'statistics', 'who invented', 'when was', 'where is', 'difference between'],
  analyst: ['analyze', 'evaluate', 'strategy', 'pros and cons', 'decision', 'business', 'roi', 'market', 'swot', 'risk', 'forecast', 'metric', 'assessment', 'benchmark', 'tradeoff', 'trade-off'],
  kernel: ['hello', 'hi', 'hey', 'thanks', 'thank you', 'good morning', 'good evening', 'good night', 'how are you', "what's up", 'sup', 'yo', 'gm', 'bye', 'goodbye', 'see you', 'appreciate it'],
}

// High-signal single keywords that are nearly unambiguous (no 2-hit requirement)
const HIGH_SIGNAL_KEYWORDS: Record<string, string[]> = {
  coder: ['typescript', 'javascript', 'python', 'react', 'docker', 'kubernetes', 'webpack', 'vite', 'supabase', 'postgresql', 'mongodb', 'graphql', 'restapi', 'nginx'],
  writer: ['poem', 'essay', 'proofread', 'copywriting', 'ghostwrite', 'screenplay'],
  researcher: ['research', 'what is', 'tell me about', 'who invented', 'history of', 'difference between'],
  kernel: ['hello', 'hi', 'hey', 'thanks', 'thank you', 'good morning', 'good evening', 'good night', 'how are you'],
}

const IMAGE_GEN_PATTERNS = /\b(draw|generate\s+(an?\s+)?image|create\s+(an?\s+)?(picture|image|illustration|artwork|logo|icon)|make\s+(me\s+)?(a\s+)?(logo|image|picture|illustration|icon)|illustrate|design\s+me)\b/i
// Image refinement is NOT locally classified — it requires conversation context
// (whether a recent image exists) that only the LLM can evaluate.

// Platform Engine — end-to-end orchestration (superset of content engine)
const PLATFORM_ENGINE_PATTERNS = /\b(create\s+and\s+publish|end\s+to\s+end\s+content|full\s+pipeline|what\s+should\s+i\s+write\s+next|content\s+to\s+all\s+platforms|research\s+write\s+publish|write.*score.*publish|create.*distribute|blog.*post.*publish.*(?:twitter|linkedin|social)|publish\s+(?:to\s+)?(?:everywhere|all\s+(?:my\s+)?platforms)|full\s+content\s+workflow|platform\s+engine)\b/i

// Content Engine — multi-stage pipeline triggers (NOT simple "write me an email")
const CONTENT_ENGINE_PATTERNS = /\b(content\s+pipeline|content\s+calendar|content\s+strategy|blog\s+post\s+series|create\s+a\s+newsletter|draft\s+a\s+thread|help\s+me\s+(?:create|write|build)\s+(?:a\s+)?(?:blog|article|essay|newsletter|thread|post).*(?:research|optimize|distribute|publish)|write\s+me\s+a\s+blog|content\s+engine|start\s+content\s+pipeline)\b/i

// Algorithm Engine — content optimization and scoring triggers
const ALGORITHM_PATTERNS = /\b(optimize\s+(?:my\s+)?content|best\s+time\s+to\s+post|engagement\s+score|content\s+performance|content\s+ranking|score\s+(?:my\s+)?content|rank\s+(?:my\s+)?content|distribution\s+strategy|how\s+(?:will|would|did)\s+(?:my\s+)?(?:content|post|article)\s+perform)\b/i

// Knowledge Engine — explicit knowledge base queries
const KNOWLEDGE_QUERY_PATTERNS = /\b(what\s+do\s+i\s+know|search\s+my\s+(knowledge|notes|docs)|my\s+knowledge\s+base|recall\s+what\s+i|what\s+have\s+i\s+(learned|saved|stored)|browse\s+my\s+knowledge|show\s+my\s+knowledge|knowledge\s+about)\b/i

// Short continuation patterns — user is clearly following up on the current conversation
const CONTINUATION_PATTERNS = /^(yes|no|yeah|nah|sure|ok|okay|go ahead|do it|sounds good|perfect|got it|right|exactly|please|can you|could you|try|again|more|less|also|and|but|what about|how about|instead|change|make it|fix|update|add|remove|show me|tell me more|go on|continue|keep going|elaborate|shorter|longer|simpler|faster|slower)\b/i

function classifyLocal(message: string): ClassificationResult | null {
  const lower = message.toLowerCase()

  // Platform Engine — end-to-end content orchestration (superset, check before knowledge)
  if (PLATFORM_ENGINE_PATTERNS.test(message)) {
    return {
      agentId: 'writer', confidence: 0.92, complexity: 0.8,
      needsResearch: true, isMultiStep: true, needsSwarm: false,
      needsImageGen: false, needsImageRefinement: false,
      needsPlatformEngine: true, needsContentEngine: false, needsAlgorithm: false,
      needsKnowledgeQuery: false,
    }
  }

  // Knowledge Engine — explicit knowledge base queries
  if (KNOWLEDGE_QUERY_PATTERNS.test(message)) {
    return {
      agentId: 'curator', confidence: 0.92, complexity: 0.4,
      needsResearch: false, isMultiStep: false, needsSwarm: false,
      needsImageGen: false, needsImageRefinement: false,
      needsPlatformEngine: false, needsContentEngine: false, needsAlgorithm: false,
      needsKnowledgeQuery: true,
    }
  }

  // Content Engine — multi-stage pipeline (check before generic writer keywords)
  if (CONTENT_ENGINE_PATTERNS.test(message)) {
    return {
      agentId: 'writer', confidence: 0.90, complexity: 0.7,
      needsResearch: true, isMultiStep: true, needsSwarm: false,
      needsImageGen: false, needsImageRefinement: false,
      needsPlatformEngine: false, needsContentEngine: true, needsAlgorithm: false,
      needsKnowledgeQuery: false,
    }
  }

  // Algorithm Engine — content optimization and scoring
  if (ALGORITHM_PATTERNS.test(message)) {
    return {
      agentId: 'analyst', confidence: 0.90, complexity: 0.6,
      needsResearch: false, isMultiStep: false, needsSwarm: false,
      needsImageGen: false, needsImageRefinement: false,
      needsPlatformEngine: false, needsContentEngine: false, needsAlgorithm: true, needsKnowledgeQuery: false,
    }
  }

  // Image gen — high signal, check first
  if (IMAGE_GEN_PATTERNS.test(message)) {
    return {
      agentId: 'kernel', confidence: 0.95, complexity: 0.3,
      needsResearch: false, isMultiStep: false, needsSwarm: false,
      needsImageGen: true, needsImageRefinement: false,
      needsPlatformEngine: false, needsContentEngine: false, needsAlgorithm: false, needsKnowledgeQuery: false,
    }
  }

  // High-signal single keywords — one hit is enough
  for (const [agent, keywords] of Object.entries(HIGH_SIGNAL_KEYWORDS)) {
    for (const kw of keywords) {
      if (kw.includes(' ')) {
        if (lower.includes(kw)) {
          const agentId = agent as ClassificationResult['agentId']
          const complexity = agentId === 'kernel' ? 0.1 : 0.4
          return {
            agentId, confidence: 0.85, complexity,
            needsResearch: agentId === 'researcher', isMultiStep: false, needsSwarm: false,
            needsImageGen: false, needsImageRefinement: false,
            needsPlatformEngine: false, needsContentEngine: false, needsAlgorithm: false, needsKnowledgeQuery: false,
          }
        }
      } else {
        const re = new RegExp(`\\b${kw}\\b`, 'i')
        if (re.test(lower)) {
          const agentId = agent as ClassificationResult['agentId']
          const complexity = agentId === 'kernel' ? 0.1 : 0.4
          return {
            agentId, confidence: 0.85, complexity,
            needsResearch: agentId === 'researcher', isMultiStep: false, needsSwarm: false,
            needsImageGen: false, needsImageRefinement: false,
            needsPlatformEngine: false, needsContentEngine: false, needsAlgorithm: false, needsKnowledgeQuery: false,
          }
        }
      }
    }
  }

  // Count keyword hits per agent
  const scores: Record<string, number> = {}
  for (const [agent, keywords] of Object.entries(KEYWORD_MAP)) {
    let hits = 0
    for (const kw of keywords) {
      // Multi-word keywords: check as substring; single-word: check word boundary
      if (kw.includes(' ')) {
        if (lower.includes(kw)) hits++
      } else {
        const re = new RegExp(`\\b${kw}\\b`, 'i')
        if (re.test(lower)) hits++
      }
    }
    if (hits > 0) scores[agent] = hits
  }

  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return null // ambiguous — fall through to Groq

  const [topAgent, topHits] = entries[0]
  const runnerUpHits = entries.length > 1 ? entries[1][1] : 0

  // Require 2+ keyword hits with clear dominance (1.5x runner-up or no runner-up)
  if (topHits >= 2 && topHits >= runnerUpHits * 1.5) {
    const agentId = topAgent as ClassificationResult['agentId']
    const complexity = agentId === 'kernel' ? 0.1 : agentId === 'analyst' ? 0.5 : 0.4
    return {
      agentId, confidence: 0.85, complexity,
      needsResearch: false, isMultiStep: false, needsSwarm: false,
      needsImageGen: false, needsImageRefinement: false,
      needsPlatformEngine: false, needsContentEngine: false, needsAlgorithm: false, needsKnowledgeQuery: false,
    }
  }

  return null // ambiguous — fall through to Groq
}

// Cache the last classification to reuse for short continuations
let _lastClassification: ClassificationResult | null = null
let _lastClassificationTime = 0

/** Reset classification cache — for testing only */
export function _resetClassificationCache() {
  _lastClassification = null
  _lastClassificationTime = 0
}

export async function classifyIntent(
  message: string,
  recentContext: string,
  hasAttachments?: boolean,
  loomContext?: string,
  userMemoryContext?: string,
): Promise<ClassificationResult> {
  // Fast path 1: Short continuation messages reuse previous classification (<1ms)
  // "yes", "ok", "make it darker", "try again" etc. should keep the same agent
  const now = Date.now()
  if (_lastClassification && (now - _lastClassificationTime) < 120_000) {
    if (CONTINUATION_PATTERNS.test(message) && message.length < 80) {
      console.log(`[router] continuation fast-path → ${_lastClassification.agentId} (reusing previous)`)
      // If previous classification was image gen, continuation = refinement
      const isImageRefinement = !!_lastClassification.needsImageGen
      return { ..._lastClassification, needsImageRefinement: isImageRefinement }
    }
  }

  // Fast path 2: Local keyword classifier (<1ms)
  // Now runs even with conversation context — only skip for genuinely ambiguous cases
  const local = classifyLocal(message)
  if (local) {
    console.log(`[router] local fast-path → ${local.agentId} (${local.needsImageGen ? 'imageGen' : 'keywords'})`)
    _lastClassification = local
    _lastClassificationTime = now
    return local
  }

  // Groq API call — only for genuinely ambiguous messages
  try {
    const attachmentNote = hasAttachments ? '\n\n[User has attached files for analysis]' : ''
    const prompt = recentContext
      ? `Recent conversation:\n${recentContext}\n\nNew message to classify:\n${message}${attachmentNote}`
      : `Message to classify:\n${message}${attachmentNote}`

    // Inject user memory + Loom routing history for better classification
    let system = CLASSIFICATION_SYSTEM
    if (userMemoryContext) system += `\n\n---\n\nUser Profile (use to inform routing):\n${userMemoryContext}`
    if (loomContext) system += `\n\n---\n\n${loomContext}`

    const result = await getBackgroundProvider().json<ClassificationResult>(prompt, {
      system,
      tier: 'fast',
      max_tokens: 150,
      feature: 'routing',
    })

    // Validate the result
    const validAgents = ['kernel', 'researcher', 'coder', 'writer', 'analyst', 'aesthete', 'guardian', 'curator', 'strategist', 'infrastructure', 'quant', 'investigator']
    if (!validAgents.includes(result.agentId)) {
      const fallback: ClassificationResult = { agentId: 'kernel', confidence: 0, complexity: 0.5, needsResearch: false, isMultiStep: false, needsSwarm: false, needsImageGen: false, needsImageRefinement: false, needsPlatformEngine: false, needsContentEngine: false, needsAlgorithm: false, needsKnowledgeQuery: false }
      _lastClassification = fallback
      _lastClassificationTime = now
      return fallback
    }

    // Fall back to kernel if confidence is too low
    if (typeof result.confidence !== 'number' || result.confidence < 0.3) {
      const fallback: ClassificationResult = { agentId: 'kernel', confidence: result.confidence || 0, complexity: 0.5, needsResearch: false, isMultiStep: false, needsSwarm: false, needsImageGen: false, needsImageRefinement: false, needsPlatformEngine: false, needsContentEngine: false, needsAlgorithm: false, needsKnowledgeQuery: false }
      _lastClassification = fallback
      _lastClassificationTime = now
      return fallback
    }

    const classified: ClassificationResult = {
      agentId: result.agentId,
      confidence: Math.min(1, Math.max(0, result.confidence)),
      complexity: Math.min(1, Math.max(0, typeof result.complexity === 'number' ? result.complexity : 0.5)),
      needsResearch: !!result.needsResearch,
      isMultiStep: !!result.isMultiStep,
      needsSwarm: !!result.needsSwarm,
      needsImageGen: !!result.needsImageGen,
      needsImageRefinement: !!result.needsImageRefinement,
      needsPlatformEngine: !!result.needsPlatformEngine,
      needsContentEngine: !!result.needsContentEngine,
      needsAlgorithm: !!result.needsAlgorithm,
      needsKnowledgeQuery: !!result.needsKnowledgeQuery,
    }
    _lastClassification = classified
    _lastClassificationTime = now
    return classified
  } catch {
    // On any failure, fall back to kernel (or reuse last classification if recent)
    if (_lastClassification && (now - _lastClassificationTime) < 60_000) {
      console.log(`[router] Groq failed, reusing recent classification → ${_lastClassification.agentId}`)
      return _lastClassification
    }
    return { agentId: 'kernel', confidence: 0, complexity: 0.5, needsResearch: false, isMultiStep: false, needsSwarm: false, needsImageGen: false, needsImageRefinement: false, needsPlatformEngine: false, needsContentEngine: false, needsAlgorithm: false, needsKnowledgeQuery: false }
  }
}

/** Build a short context string from recent messages for classification */
export function buildRecentContext(messages: { role: string; content: string }[], count = 3): string {
  return messages
    .slice(-count)
    .map(m => `${m.role === 'user' ? 'User' : 'Kernel'}: ${m.content.slice(0, 150)}`)
    .join('\n')
}
