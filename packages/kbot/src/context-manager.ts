// K:BOT Context Manager — RLM-style context delegation
//
// Based on Recursive Language Models (Prime Intellect, Dec 2025):
// Instead of stuffing everything into one context window, the agent
// manages its own context by compressing, delegating, and preserving
// only what matters.
//
// Key insight: treat the conversation history as a resource to be
// managed, not an ever-growing log.

/** Max context tokens before compression kicks in */
export const MAX_CONTEXT_TOKENS = 32_000

/** Conversation turn (matches memory.ts) */
export interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
}

/** Extracted key context from a long response */
export interface KeyContext {
  /** File paths mentioned */
  files: string[]
  /** Decisions or conclusions made */
  decisions: string[]
  /** Errors encountered */
  errors: string[]
  /** User corrections or explicit instructions */
  corrections: string[]
  /** Code snippets (first line of each block) */
  codeSnippets: string[]
}

/** Estimate token count using 4-chars-per-token heuristic */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/** Estimate total tokens for an array of turns */
export function estimateTurnTokens(turns: ConversationTurn[]): number {
  return turns.reduce((sum, t) => sum + estimateTokens(t.content) + 4, 0) // +4 for role/formatting overhead
}

/** Extract key context from a long text (response or tool output) */
export function extractKeyContext(text: string): KeyContext {
  const files: string[] = []
  const decisions: string[] = []
  const errors: string[] = []
  const corrections: string[] = []
  const codeSnippets: string[] = []

  const lines = text.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()

    // File paths — Unix and relative paths
    const fileMatches = trimmed.match(/(?:^|\s)((?:\.{0,2}\/|~\/|src\/|packages\/)[^\s:,)]+\.\w+)/g)
    if (fileMatches) {
      for (const m of fileMatches) files.push(m.trim())
    }

    // Decisions — lines starting with action verbs or containing decision language
    if (/^(?:✓|✗|→|•)\s/.test(trimmed) || /\b(?:decided|chose|using|switched to|will use|created|deleted|updated|fixed|added|removed)\b/i.test(trimmed)) {
      decisions.push(trimmed.slice(0, 200))
    }

    // Errors
    if (/\b(?:error|fail|exception|TypeError|SyntaxError|ReferenceError|ENOENT|EACCES|404|500|crash)\b/i.test(trimmed)) {
      errors.push(trimmed.slice(0, 200))
    }

    // User corrections
    if (/^(?:no[,.]?\s|actually[,]?\s|that's wrong|instead[,]?\s|don't|never|always)\b/i.test(trimmed)) {
      corrections.push(trimmed.slice(0, 200))
    }
  }

  // Code snippets — first line of each code block
  const codeBlockPattern = /```\w*\n(.+)/g
  let match
  while ((match = codeBlockPattern.exec(text)) !== null) {
    codeSnippets.push(match[1].trim().slice(0, 100))
  }

  return {
    files: [...new Set(files)].slice(0, 20),
    decisions: decisions.slice(0, 10),
    errors: errors.slice(0, 5),
    corrections: corrections.slice(0, 5),
    codeSnippets: codeSnippets.slice(0, 5),
  }
}

/** Summarize a conversation turn into a compact bullet point */
function summarizeTurn(turn: ConversationTurn): string {
  const ctx = extractKeyContext(turn.content)
  const parts: string[] = []

  if (turn.role === 'user') {
    // Keep user messages short but preserve intent
    parts.push(turn.content.slice(0, 150))
  } else {
    // Summarize assistant responses by key context
    if (ctx.decisions.length > 0) parts.push(ctx.decisions.slice(0, 3).join('; '))
    if (ctx.files.length > 0) parts.push(`Files: ${ctx.files.slice(0, 5).join(', ')}`)
    if (ctx.errors.length > 0) parts.push(`Errors: ${ctx.errors.slice(0, 2).join('; ')}`)
    if (parts.length === 0) parts.push(turn.content.split('\n')[0].slice(0, 150))
  }

  return `[${turn.role}] ${parts.join(' | ')}`
}

/**
 * Fold conversation history to fit within a token budget.
 * Implements RLM-style context management:
 * - Keep the most recent turns verbatim (they're most relevant)
 * - Summarize older turns into compact bullet points
 * - Always preserve user corrections and explicit instructions
 * - Never drop the first user message (establishes the task)
 */
export function foldContext(
  turns: ConversationTurn[],
  maxTokens: number = MAX_CONTEXT_TOKENS,
  keepRecentCount: number = 6,
): ConversationTurn[] {
  if (turns.length === 0) return []

  const currentTokens = estimateTurnTokens(turns)
  if (currentTokens <= maxTokens) return turns // No folding needed

  // Keep the most recent turns verbatim
  const recentTurns = turns.slice(-keepRecentCount)
  const olderTurns = turns.slice(0, -keepRecentCount)

  if (olderTurns.length === 0) return recentTurns

  // Summarize older turns, but preserve corrections
  const summaryLines: string[] = ['[Context Summary — earlier conversation]']
  const preservedTurns: ConversationTurn[] = []

  for (const turn of olderTurns) {
    // Always preserve user corrections verbatim
    if (turn.role === 'user' && /^(?:no[,.]?\s|actually|that's wrong|instead|don't|never|always)\b/i.test(turn.content.trim())) {
      preservedTurns.push(turn)
      continue
    }

    // Summarize everything else
    summaryLines.push(`• ${summarizeTurn(turn)}`)
  }

  const summaryText = summaryLines.join('\n')
  const summaryTokens = estimateTokens(summaryText)
  const recentTokens = estimateTurnTokens(recentTurns)
  const preservedTokens = estimateTurnTokens(preservedTurns)

  // If summary + recent + preserved fits, use it
  if (summaryTokens + recentTokens + preservedTokens <= maxTokens) {
    return [
      { role: 'assistant', content: summaryText },
      ...preservedTurns,
      ...recentTurns,
    ]
  }

  // Still too big — aggressive compression: just keep summary header + recent
  const aggressiveSummary = summaryLines.slice(0, 10).join('\n')
  return [
    { role: 'assistant', content: aggressiveSummary },
    ...recentTurns,
  ]
}

/**
 * Decide whether content should be delegated to a sub-model.
 * In an RLM, heavy tool outputs (file contents, search results) are
 * processed by a cheaper model to extract only the relevant bits.
 */
export function shouldDelegate(
  contentTokens: number,
  currentContextTokens: number,
  maxTokens: number = MAX_CONTEXT_TOKENS,
): boolean {
  // Delegate if this content would push us past 70% of budget
  return (currentContextTokens + contentTokens) > maxTokens * 0.7
}

/**
 * Compress a tool result that's too large for the context window.
 * Extracts key information and discards the rest.
 */
export function compressToolResult(result: string, maxChars: number = 4000): string {
  if (result.length <= maxChars) return result

  const ctx = extractKeyContext(result)
  const parts: string[] = []

  // Always include errors
  if (ctx.errors.length > 0) {
    parts.push('Errors:', ...ctx.errors.map(e => `  • ${e}`))
  }

  // Include file references
  if (ctx.files.length > 0) {
    parts.push(`Files: ${ctx.files.join(', ')}`)
  }

  // Include key decisions/findings
  if (ctx.decisions.length > 0) {
    parts.push('Key findings:', ...ctx.decisions.map(d => `  • ${d}`))
  }

  // Include first and last portion of raw result for context
  const lines = result.split('\n')
  if (lines.length > 20) {
    parts.push('', '--- First 10 lines ---', ...lines.slice(0, 10))
    parts.push(`... (${lines.length - 20} lines omitted) ...`)
    parts.push('--- Last 10 lines ---', ...lines.slice(-10))
  } else {
    parts.push('', result.slice(0, maxChars))
  }

  const compressed = parts.join('\n').slice(0, maxChars)
  return `[Compressed from ${result.length} chars]\n${compressed}`
}

/**
 * Auto-compact: check if context needs folding and do it.
 * Call this before each API request.
 */
export function autoCompact(
  turns: ConversationTurn[],
  systemPromptTokens: number = 2000,
  maxTokens: number = MAX_CONTEXT_TOKENS,
): { turns: ConversationTurn[]; wasCompacted: boolean } {
  const available = maxTokens - systemPromptTokens - 4096 // Reserve 4K for response
  const current = estimateTurnTokens(turns)

  if (current <= available) {
    return { turns, wasCompacted: false }
  }

  return {
    turns: foldContext(turns, available),
    wasCompacted: true,
  }
}
