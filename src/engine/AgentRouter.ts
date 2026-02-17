// AgentRouter — Haiku-based intent classifier for specialist routing
import { getProvider } from './providers/registry'

export interface ClassificationResult {
  agentId: 'kernel' | 'researcher' | 'coder' | 'writer' | 'analyst'
  confidence: number
  needsResearch: boolean
  isMultiStep: boolean
  needsSwarm: boolean
}

const CLASSIFICATION_SYSTEM = `You are an intent classifier. Given a user message and recent conversation context, classify the user's intent to route to the best specialist agent.

Agents:
- kernel: Personal conversation, life advice, general chat, emotional support, casual talk, questions about the AI itself
- researcher: Deep questions, current events, fact-finding, "what is", "explain", "tell me about", research requests, anything needing web search for accuracy
- coder: Programming, debugging, code generation, technical implementation, algorithms, APIs, databases
- writer: Content creation, editing, copywriting, emails, blog posts, social media, creative writing, naming
- analyst: Data analysis, strategic thinking, evaluation, comparisons, decision-making, business strategy, pros/cons

Also determine:
- needsResearch: true if the question requires multi-step web research (not just a simple search). Examples: "research AI regulation in the EU", "deep dive into...", "comprehensive analysis of..."
- isMultiStep: true if the request requires 3+ distinct operations that build on each other. Examples: "research X, then analyze Y, then write Z", "build a complete...", "create a plan and execute it"
- needsSwarm: true if the question would benefit from multiple specialist perspectives working together. Examples: "what should I do about...", "evaluate this idea", "help me think through...", complex decisions, multi-domain questions, strategy + analysis + creativity combined. NOT for simple factual questions or single-domain tasks.

Respond with ONLY valid JSON, no other text:
{"agentId": "kernel", "confidence": 0.9, "needsResearch": false, "isMultiStep": false, "needsSwarm": false}`

export async function classifyIntent(
  message: string,
  recentContext: string
): Promise<ClassificationResult> {
  try {
    const prompt = recentContext
      ? `Recent conversation:\n${recentContext}\n\nNew message to classify:\n${message}`
      : `Message to classify:\n${message}`

    const result = await getProvider().json<ClassificationResult>(prompt, {
      system: CLASSIFICATION_SYSTEM,
      tier: 'fast',
      max_tokens: 150,
    })

    // Validate the result
    const validAgents = ['kernel', 'researcher', 'coder', 'writer', 'analyst']
    if (!validAgents.includes(result.agentId)) {
      return { agentId: 'kernel', confidence: 0, needsResearch: false, isMultiStep: false, needsSwarm: false }
    }

    // Fall back to kernel if confidence is too low
    if (typeof result.confidence !== 'number' || result.confidence < 0.3) {
      return { agentId: 'kernel', confidence: result.confidence || 0, needsResearch: false, isMultiStep: false, needsSwarm: false }
    }

    return {
      agentId: result.agentId,
      confidence: Math.min(1, Math.max(0, result.confidence)),
      needsResearch: !!result.needsResearch,
      isMultiStep: !!result.isMultiStep,
      needsSwarm: !!result.needsSwarm,
    }
  } catch {
    // On any failure, fall back to kernel
    return { agentId: 'kernel', confidence: 0, needsResearch: false, isMultiStep: false, needsSwarm: false }
  }
}

/** Build a short context string from recent messages for classification */
export function buildRecentContext(messages: { role: string; content: string }[], count = 3): string {
  return messages
    .slice(-count)
    .map(m => `${m.role === 'user' ? 'User' : 'Kernel'}: ${m.content.slice(0, 150)}`)
    .join('\n')
}
