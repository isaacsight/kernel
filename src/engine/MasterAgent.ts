// ─── Master Agent — The Brain of Kernel ──────────────────────
//
// The Master Agent is the intelligent orchestration layer that
// understands ALL engines and chains them to handle complex requests.
// It replaces the rigid routing chain with dynamic planning.
//
// Flow: Understand → Plan → Execute → Synthesize
//
// Uses Claude's tool-use API internally — engines are exposed as
// tools with typed schemas. Claude naturally decides which engines
// to call and in what order.

import type {
  EnginePlan,
  EnginePlanStep,
  MasterAgentState,
  MasterAgentCallbacks,
  EngineExecutorCallbacks,
} from './master/types'
import {
  getRegistry,
  getCapabilitiesAsTools,
  getCapabilitiesPrompt,
  parseToolName,
} from './master/registry'
import { claudeStreamChat, type ContentBlock } from './ClaudeClient'
import { getSpecialist } from '../agents/specialists'
import { classifyIntent, buildRecentContext, resolveModelFromClassification } from './AgentRouter'
import { formatMemoryForPrompt, type UserMemoryProfile } from './MemoryAgent'

/** Configuration for the Master Agent */
interface MasterAgentConfig {
  userId: string
  isPro: boolean
  callbacks: MasterAgentCallbacks
  /** User memory profile for context */
  memory?: UserMemoryProfile
  /** Additional system prompt blocks (mirror, loom, etc.) */
  systemBlocks?: string
}

/** Result from Master Agent processing */
export interface MasterAgentResult {
  /** The final response text */
  text: string
  /** The plan that was executed (if any) */
  plan: EnginePlan | null
  /** Which specialist agent persona was used */
  agentId: string
  agentName: string
  /** Any thinking text from extended thinking */
  thinking?: string
  /** Generated images (if image engine was invoked) */
  generatedImages?: unknown[]
}

/**
 * Determines whether a message needs multi-engine orchestration
 * or can be handled with a simple direct response.
 */
export function needsOrchestration(
  message: string,
  classification: Awaited<ReturnType<typeof classifyIntent>>,
): boolean {
  // These flags indicate an engine should be invoked
  if (classification.needsPlatformEngine) return true
  if (classification.needsContentEngine) return true
  if (classification.needsAlgorithm) return true
  if (classification.needsImageGen) return true
  if (classification.needsKnowledgeQuery) return true
  if (classification.needsResearch) return true
  if (classification.isMultiStep) return true
  if (classification.needsSwarm) return true

  // High complexity messages may benefit from orchestration
  if (classification.complexity > 0.8) return true

  // Check for explicit multi-engine keywords
  const multiEnginePatterns = /\b(then|after that|also|and also|next step|followed by|combine|integrate)\b.*\b(create|write|research|analyze|design|build|generate|publish|score)\b/i
  if (multiEnginePatterns.test(message)) return true

  return false
}

/** The Master Agent system prompt prefix */
function buildMasterSystemPrompt(
  capabilitiesPrompt: string,
  memory?: UserMemoryProfile,
  systemBlocks?: string,
): string {
  const memoryBlock = memory
    ? formatMemoryForPrompt(memory)
    : ''

  return `You are Kernel's Master Agent — the intelligent orchestrator of a sovereign AI platform.

Your role is to understand the user's request, determine which engines (if any) to invoke, and synthesize a coherent response. You have access to multiple specialized engines via tool calls.

When the user's request can be handled with a simple conversational response, respond directly without using tools. Only invoke engines when the request genuinely requires their capabilities.

${capabilitiesPrompt}

## Guidelines
- For simple questions, chat normally. Don't over-engineer simple requests.
- When invoking engines, briefly explain what you're doing and why.
- If a request spans multiple engines, chain them logically.
- Pro-only engines: if the user is on the free tier, explain what's available with Pro.
- Always synthesize engine outputs into a natural response — don't just dump raw results.
${memoryBlock ? `\n## User Memory\n${memoryBlock}` : ''}
${systemBlocks || ''}`
}

/**
 * Process a message through the Master Agent.
 *
 * The Master Agent uses Claude's tool-use API to dynamically invoke engines.
 * For simple messages, it responds directly. For complex requests, it creates
 * and executes multi-engine plans.
 */
export async function processMasterAgent(
  message: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string | ContentBlock[] }[],
  config: MasterAgentConfig,
): Promise<MasterAgentResult> {
  const { userId, isPro, callbacks, memory, systemBlocks } = config

  // Get available engine tools
  const tools = getCapabilitiesAsTools()
  const capabilitiesPrompt = getCapabilitiesPrompt()

  // Classify intent for specialist persona selection
  const recentCtx = buildRecentContext(
    conversationHistory.map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : '[content blocks]',
    })),
  )
  const classification = await classifyIntent(message, recentCtx)
  const specialist = getSpecialist(classification.agentId)

  // Build system prompt with all context
  const systemPrompt = buildMasterSystemPrompt(capabilitiesPrompt, memory, systemBlocks)

  // If no orchestration needed, do a simple direct response (no tools)
  if (!needsOrchestration(message, classification)) {
    callbacks.onEngineSwitch(null, 'direct')
    const routingCtx = {
      messageWordCount: message.split(/\s+/).length,
      turnCount: conversationHistory.filter(m => m.role === 'user').length,
    }
    const autoModel = resolveModelFromClassification(classification, routingCtx)

    let responseText = ''
    const streamResult = await claudeStreamChat(
      [...conversationHistory, { role: 'user', content: message }],
      (text: string) => {
        responseText = text
        callbacks.onChunk(text)
      },
      {
        system: systemPrompt,
        model: autoModel,
        max_tokens: specialist.id === 'writer' || specialist.id === 'coder' ? 16384 : 8192,
        web_search: specialist.id === 'researcher' || specialist.id === 'kernel',
      },
    )

    return {
      text: streamResult.text || responseText,
      plan: null,
      agentId: specialist.id,
      agentName: specialist.name,
      thinking: streamResult.thinking,
    }
  }

  // ── Orchestrated response: use tool-use to invoke engines ──

  // Create a plan to track execution
  const plan: EnginePlan = {
    id: `plan_${Date.now()}`,
    userMessage: message,
    steps: [],
    reasoning: '',
    createdAt: Date.now(),
    state: 'planning',
  }

  callbacks.onPlan(plan)

  // Filter tools by tier
  const availableTools = isPro
    ? tools
    : tools.filter(t => {
        const parsed = parseToolName(t.name)
        if (!parsed) return false
        const engine = getRegistry().get(parsed.engineId)
        return engine && !engine.capability.requiresPro
      })

  // Run Claude with tool-use enabled
  let responseText = ''
  let toolCallsProcessed = 0
  const maxToolCalls = 5 // Safety limit

  // Agentic tool-use loop
  const messages: { role: string; content: string | ContentBlock[] | unknown[] }[] = [
    ...conversationHistory,
    { role: 'user', content: message },
  ]

  plan.state = 'executing'
  callbacks.onPlan(plan)

  while (toolCallsProcessed < maxToolCalls) {
    const streamResult = await claudeStreamChat(
      messages as { role: 'user' | 'assistant'; content: string | ContentBlock[] }[],
      (text: string) => {
        responseText = text
        callbacks.onChunk(text)
      },
      {
        system: systemPrompt,
        model: 'sonnet',
        max_tokens: 16384,
        tools: availableTools.length > 0 ? availableTools : undefined,
      },
    )

    // Check if Claude returned any tool calls in the streaming response
    const toolCalls = streamResult.tool_uses
    if (!toolCalls || toolCalls.length === 0) {
      // No tool calls — Claude gave a direct response
      break
    }

    // Process each tool call
    for (const toolCall of toolCalls) {
      const parsed = parseToolName(toolCall.name)
      if (!parsed) continue

      const engine = getRegistry().get(parsed.engineId)
      if (!engine) continue

      // Create plan step
      const step: EnginePlanStep = {
        id: `step_${Date.now()}_${toolCallsProcessed}`,
        engineId: parsed.engineId,
        action: parsed.action,
        input: toolCall.input,
        dependsOn: [],
        status: 'running',
        startedAt: Date.now(),
      }
      plan.steps.push(step)
      callbacks.onStepStart(step.id, parsed.engineId, parsed.action)
      callbacks.onEngineSwitch(null, parsed.engineId)

      // Execute the engine action
      const execCallbacks: EngineExecutorCallbacks = {
        onChunk: callbacks.onChunk,
        onProgress: (detail) => callbacks.onStepStart(step.id, parsed.engineId, detail),
      }

      try {
        const output = await engine.execute(parsed.action, { ...toolCall.input, userId }, execCallbacks)
        step.output = output
        step.status = 'completed'
        step.completedAt = Date.now()
        callbacks.onStepComplete(step.id, output)

        // Add tool result to messages for next iteration
        messages.push({
          role: 'assistant',
          content: `[Tool: ${toolCall.name}] Executed successfully.`,
        })
        messages.push({
          role: 'user',
          content: `[Tool result for ${toolCall.name}]: ${typeof output === 'string' ? output : JSON.stringify(output).slice(0, 2000)}`,
        })
      } catch (err) {
        step.status = 'failed'
        step.error = err instanceof Error ? err.message : 'Unknown error'
        step.completedAt = Date.now()
        callbacks.onStepFailed(step.id, step.error)

        messages.push({
          role: 'assistant',
          content: `[Tool: ${toolCall.name}] Failed.`,
        })
        messages.push({
          role: 'user',
          content: `[Tool error for ${toolCall.name}]: ${step.error}`,
        })
      }

      toolCallsProcessed++
    }
  }

  // Finalize plan
  plan.state = plan.steps.some(s => s.status === 'failed') ? 'failed' : 'completed'
  plan.completedAt = Date.now()
  callbacks.onPlan(plan)

  return {
    text: responseText,
    plan: plan.steps.length > 0 ? plan : null,
    agentId: specialist.id,
    agentName: specialist.name,
  }
}

