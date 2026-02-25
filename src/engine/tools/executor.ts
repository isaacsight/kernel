// ─── Tool Executor ──────────────────────────────────────────
//
// Inner loop: sends messages + tool schemas to LLM, detects tool
// calls in the response, executes them, feeds results back, repeats.
// Stops when the LLM returns a final text response or max turns hit.

import { getProvider } from '../providers/registry'
import type { ChatMessage, LLMOpts } from '../providers/types'
import type { Tool, ToolCall, ToolCallResult, ToolResult } from './types'

const MAX_TOOL_TURNS = 5
const TOOL_CALL_REGEX = /```tool_call\s*\n([\s\S]*?)\n```/g

export interface ToolLoopCallbacks {
  onChunk?: (text: string) => void
  onToolCall?: (toolName: string, args: unknown) => void
  onApprovalNeeded?: (toolName: string, args: Record<string, unknown>, description: string) => Promise<boolean>
}

export interface ToolLoopResult {
  text: string
  toolCalls: ToolCallResult[]
}

function buildToolSystemPrompt(tools: Tool[]): string {
  if (tools.length === 0) return ''

  const schemas = tools.map(t => {
    const params = Object.entries(t.parameters)
      .map(([k, v]) => `  - ${k}: ${JSON.stringify(v)}`)
      .join('\n')
    return `## ${t.name}\n${t.description}\nParameters:\n${params}`
  }).join('\n\n')

  return `\n\nYou have access to the following tools. To use a tool, include a tool_call code block in your response:\n\n\`\`\`tool_call\n{"name": "tool_name", "args": {"param": "value"}}\n\`\`\`\n\nAvailable tools:\n\n${schemas}\n\nAfter a tool returns its result, continue your response incorporating the result. Only call one tool at a time. If you don't need a tool, just respond normally without any tool_call blocks.`
}

function parseToolCalls(text: string): ToolCall[] {
  const calls: ToolCall[] = []
  let match: RegExpExecArray | null
  const regex = new RegExp(TOOL_CALL_REGEX.source, 'g')

  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1])
      if (parsed.name) {
        calls.push({
          id: `tc_${Date.now()}_${calls.length}`,
          name: parsed.name,
          args: parsed.args || {},
        })
      }
    } catch {
      // Malformed tool call — skip
    }
  }

  return calls
}

function stripToolCalls(text: string): string {
  return text.replace(TOOL_CALL_REGEX, '').trim()
}

async function executeTool(
  tool: Tool,
  args: Record<string, unknown>,
  callbacks: ToolLoopCallbacks,
): Promise<ToolResult> {
  // HITL gate: check if approval is needed
  if (tool.requiresApproval && callbacks.onApprovalNeeded) {
    const description = `${tool.name}(${JSON.stringify(args)})`
    const approved = await callbacks.onApprovalNeeded(tool.name, args, description)
    if (!approved) {
      return { success: false, data: null, error: 'User rejected this action' }
    }
  }

  try {
    return await tool.execute(args)
  } catch (err) {
    return {
      success: false,
      data: null,
      error: err instanceof Error ? err.message : 'Tool execution failed',
    }
  }
}

export async function runToolLoop(
  messages: ChatMessage[],
  tools: Tool[],
  callbacks: ToolLoopCallbacks = {},
  opts?: LLMOpts & { maxTurns?: number },
): Promise<ToolLoopResult> {
  const maxTurns = opts?.maxTurns ?? MAX_TOOL_TURNS
  const allToolResults: ToolCallResult[] = []

  // Inject tool schemas into system prompt
  const toolSystemSuffix = buildToolSystemPrompt(tools)
  const augmentedOpts: LLMOpts = {
    ...opts,
    system: (opts?.system || '') + toolSystemSuffix,
  }

  let currentMessages = [...messages]
  let finalText = ''

  for (let turn = 0; turn < maxTurns; turn++) {
    let accumulated = ''
    const response = await getProvider().streamChat(
      currentMessages,
      (chunk) => {
        accumulated = chunk
        callbacks.onChunk?.(chunk)
      },
      augmentedOpts,
    )

    const fullResponse = response || accumulated
    const toolCalls = parseToolCalls(fullResponse)

    // No tool calls — this is the final response
    if (toolCalls.length === 0) {
      finalText = fullResponse
      break
    }

    // Execute the first tool call (one at a time)
    const tc = toolCalls[0]
    const tool = tools.find(t => t.name === tc.name)

    if (!tool) {
      // Unknown tool — tell the LLM and continue
      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: fullResponse },
        { role: 'user', content: `Tool "${tc.name}" not found. Available tools: ${tools.map(t => t.name).join(', ')}. Please try again or respond without tools.` },
      ]
      continue
    }

    callbacks.onToolCall?.(tc.name, tc.args)
    const result = await executeTool(tool, tc.args, callbacks)

    allToolResults.push({ id: tc.id, result })

    // Feed result back to LLM
    const resultContent = result.success
      ? `Tool "${tc.name}" result:\n${JSON.stringify(result.data, null, 2)}`
      : `Tool "${tc.name}" failed: ${result.error}`

    currentMessages = [
      ...currentMessages,
      { role: 'assistant', content: fullResponse },
      { role: 'user', content: resultContent },
    ]

    // Strip tool calls from last response for clean display
    finalText = stripToolCalls(fullResponse)
  }

  return { text: finalText, toolCalls: allToolResults }
}
