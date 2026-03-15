// Error-Correcting Code patterns — inspired by James Gates' discovery of
// error-correcting codes in string theory. Classifies errors by type and
// applies targeted corrections instead of blind retry.

import { loadConfig } from './auth.js'

export enum ErrorType {
  hallucination = 'hallucination',
  wrong_tool = 'wrong_tool',
  stale_context = 'stale_context',
  incomplete = 'incomplete',
  off_topic = 'off_topic',
  syntax_error = 'syntax_error',
  logic_error = 'logic_error',
}

export interface CorrectionStrategy {
  errorType: ErrorType
  description: string
  correctionPrompt: string
  severity: number // 1-5
}

export interface ClassificationResult {
  errorType: ErrorType
  confidence: number
  evidence: string
}

export interface CorrectionRecord {
  errorType: ErrorType
  confidence: number
  evidence: string
  correctionApplied: string
  attempt: number
}

export interface ErrorCorrectionResult {
  response: string
  corrections: CorrectionRecord[]
  retries: number
}

export const CORRECTION_STRATEGIES: Record<ErrorType, CorrectionStrategy> = {
  [ErrorType.hallucination]: {
    errorType: ErrorType.hallucination,
    description: 'Response contains unsupported claims',
    correctionPrompt: 'Your previous response contained claims not supported by the provided context. Stick strictly to what\'s in the conversation and tool results. Do not invent facts, file paths, function names, or behaviors.',
    severity: 4,
  },
  [ErrorType.wrong_tool]: {
    errorType: ErrorType.wrong_tool,
    description: 'Incorrect tool selection',
    correctionPrompt: 'You used an incorrect tool for this task. Reconsider which tool best fits the user\'s request. Re-read the available tools and their descriptions before choosing.',
    severity: 3,
  },
  [ErrorType.stale_context]: {
    errorType: ErrorType.stale_context,
    description: 'Referenced outdated information',
    correctionPrompt: 'Your response referenced outdated information. Focus on the most recent context and tool results. Earlier conversation turns may contain stale state — prioritize the latest data.',
    severity: 3,
  },
  [ErrorType.incomplete]: {
    errorType: ErrorType.incomplete,
    description: 'Response did not address all parts',
    correctionPrompt: 'Your response was incomplete. Address all parts of the user\'s request. Re-read the original message and ensure every question or requirement is covered.',
    severity: 2,
  },
  [ErrorType.off_topic]: {
    errorType: ErrorType.off_topic,
    description: 'Response diverged from the question',
    correctionPrompt: 'Your response diverged from the user\'s question. Re-read the original request and answer directly. Do not add tangential information.',
    severity: 2,
  },
  [ErrorType.syntax_error]: {
    errorType: ErrorType.syntax_error,
    description: 'Code output has syntax errors',
    correctionPrompt: 'Your code output contained syntax errors. Fix the syntax and verify it compiles. Check for missing brackets, semicolons, type annotations, and import statements.',
    severity: 5,
  },
  [ErrorType.logic_error]: {
    errorType: ErrorType.logic_error,
    description: 'Code has logical flaws',
    correctionPrompt: 'Your code has a logical error. Trace through the logic step by step. Check edge cases, off-by-one errors, null handling, and conditional branches.',
    severity: 4,
  },
}

const CLASSIFY_PROMPT = `You are an error classifier for an AI agent's output. Analyze the response and classify any errors found.

USER QUERY:
{query}

AGENT RESPONSE:
{response}

{context_section}

Classify the primary error (if any). Respond in JSON:
{"errorType": "hallucination|wrong_tool|stale_context|incomplete|off_topic|syntax_error|logic_error|none", "confidence": 0.0-1.0, "evidence": "brief explanation"}

If no error found, use errorType "none" with confidence 1.0.
Respond ONLY with the JSON object.`

export async function classifyError(
  query: string,
  response: string,
  context?: string,
): Promise<ClassificationResult | null> {
  const config = loadConfig()
  if (!config) return null

  const contextSection = context
    ? `CONTEXT PROVIDED:\n${context.slice(0, 2000)}`
    : ''

  const prompt = CLASSIFY_PROMPT
    .replace('{query}', query)
    .replace('{response}', response.slice(0, 3000))
    .replace('{context_section}', contextSection)

  try {
    const text = await callFastModel(config, prompt)
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null

    const parsed = JSON.parse(match[0])
    if (parsed.errorType === 'none') return null

    const errorType = parsed.errorType as ErrorType
    if (!Object.values(ErrorType).includes(errorType)) return null

    return {
      errorType,
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0)),
      evidence: parsed.evidence || '',
    }
  } catch {
    return null
  }
}

export function applyCorrection(
  query: string,
  response: string,
  errorType: ErrorType,
  evidence: string,
): string {
  const strategy = CORRECTION_STRATEGIES[errorType]
  return [
    `[ERROR CORRECTION — ${strategy.description}]`,
    strategy.correctionPrompt,
    `Evidence of error: ${evidence}`,
    `Original query: ${query}`,
    'Please provide a corrected response.',
  ].join('\n')
}

export async function withErrorCorrection(
  generateFn: (injectedPrompt?: string) => Promise<string>,
  query: string,
  context?: string,
  maxRetries = 2,
): Promise<ErrorCorrectionResult> {
  const corrections: CorrectionRecord[] = []
  let response = await generateFn()
  let retries = 0

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const classification = await classifyError(query, response, context)
    if (!classification || classification.confidence < 0.7) break

    const correctionPrompt = applyCorrection(
      query, response, classification.errorType, classification.evidence,
    )

    corrections.push({
      errorType: classification.errorType,
      confidence: classification.confidence,
      evidence: classification.evidence,
      correctionApplied: CORRECTION_STRATEGIES[classification.errorType].description,
      attempt: attempt + 1,
    })

    response = await generateFn(correctionPrompt)
    retries++
  }

  return { response, corrections, retries }
}

// ── Multi-provider fast model call ──────────────────────────────────
async function callFastModel(config: any, prompt: string): Promise<string> {
  const provider = config.provider || 'anthropic'
  const key = config.apiKey || config.key

  if (provider === 'anthropic' || provider === 'claude') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json() as any
    return data?.content?.[0]?.text || ''
  }

  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json() as any
    return data?.choices?.[0]?.message?.content || ''
  }

  // Fallback: skip classification for unsupported providers
  return ''
}
