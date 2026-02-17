// ─── Procedural Memory ──────────────────────────────────────
//
// Learns and replays multi-step workflows. When a user repeats
// a pattern ("deploy the site", "morning briefing"), Kernel
// detects it, saves it, and offers to replay it next time.

import { getProvider } from './providers/registry'
import type { Message } from '../types'

// ─── Types ──────────────────────────────────────────────────

export interface ProcedureStep {
  description: string
  agentId: string
  toolName?: string
  args?: Record<string, unknown>
}

export interface Procedure {
  id?: string
  user_id: string
  name: string
  trigger_phrase: string
  steps: ProcedureStep[]
  times_executed: number
  last_executed_at?: string
  source: 'learned' | 'defined'
}

interface DetectionResult {
  detected: boolean
  name: string
  trigger_phrase: string
  steps: ProcedureStep[]
}

interface MatchResult {
  match: boolean
  procedure_name: string
  confidence: number
}

// ─── Detection ──────────────────────────────────────────────

const DETECT_SYSTEM = `You are a workflow detection agent. Analyze the conversation history and determine if the user is following a repeating multi-step pattern that could be saved as a workflow.

A workflow must have:
- 2+ distinct steps
- Be something the user might want to repeat
- Not be a one-off creative task

If you detect a pattern, provide:
- A short name for the workflow
- A trigger phrase the user might say to invoke it
- The steps in order

Respond with ONLY valid JSON:
{"detected": false}
or
{"detected": true, "name": "Deploy Site", "trigger_phrase": "deploy", "steps": [{"description": "Run tests", "agentId": "coder"}, {"description": "Build and deploy", "agentId": "coder"}]}`

export async function detectProcedure(
  recentHistory: Message[],
  existingProcedures: Procedure[],
): Promise<Procedure | null> {
  if (recentHistory.length < 6) return null // Need enough history to detect patterns

  try {
    const conversation = recentHistory
      .slice(-20)
      .map(m => `${m.agentId === 'human' ? 'User' : m.agentName}: ${m.content}`)
      .join('\n\n')

    const existingNames = existingProcedures.map(p => p.name).join(', ')
    const existingCtx = existingNames ? `\n\nAlready saved workflows: ${existingNames}` : ''

    const result = await getProvider().json<DetectionResult>(
      `Analyze this conversation for repeating workflow patterns:${existingCtx}\n\n${conversation}`,
      { system: DETECT_SYSTEM, tier: 'fast', max_tokens: 400 }
    )

    if (!result.detected || !result.name || !result.steps?.length) return null

    return {
      user_id: '', // Set by caller
      name: result.name,
      trigger_phrase: result.trigger_phrase,
      steps: result.steps,
      times_executed: 0,
      source: 'learned',
    }
  } catch (err) {
    console.warn('[ProceduralMemory] Detection failed:', err)
    return null
  }
}

// ─── Matching ───────────────────────────────────────────────

const MATCH_SYSTEM = `You are a workflow matching agent. Given user input and a list of saved workflows, determine if the user is trying to invoke one of them.

Respond with ONLY valid JSON:
{"match": false}
or
{"match": true, "procedure_name": "Deploy Site", "confidence": 0.8}`

export async function matchProcedure(
  input: string,
  procedures: Procedure[],
): Promise<Procedure | null> {
  if (procedures.length === 0) return null

  // Fast path: exact trigger phrase match
  const lowerInput = input.toLowerCase().trim()
  const exactMatch = procedures.find(p =>
    lowerInput === p.trigger_phrase.toLowerCase() ||
    lowerInput.includes(p.trigger_phrase.toLowerCase())
  )
  if (exactMatch) return exactMatch

  // Haiku match for fuzzy cases
  try {
    const procedureList = procedures
      .map(p => `- "${p.name}" (trigger: "${p.trigger_phrase}"): ${p.steps.map(s => s.description).join(' → ')}`)
      .join('\n')

    const result = await getProvider().json<MatchResult>(
      `User said: "${input}"\n\nAvailable workflows:\n${procedureList}\n\nDoes the user want to run one of these?`,
      { system: MATCH_SYSTEM, tier: 'fast', max_tokens: 100 }
    )

    if (result.match && result.confidence > 0.6) {
      return procedures.find(p => p.name === result.procedure_name) || null
    }
  } catch {
    // Fall through to null
  }

  return null
}

// ─── Execution ──────────────────────────────────────────────

export async function executeProcedure(
  procedure: Procedure,
  context: string,
  onStep: (step: number, description: string) => void,
  onStream: (text: string) => void,
): Promise<string> {
  const stepDescriptions = procedure.steps.map(s => s.description).join('\n')

  onStep(0, procedure.steps[0]?.description || 'Starting...')

  // Execute as a single guided prompt (steps inform the agent's approach)
  const result = await getProvider().streamChat(
    [
      {
        role: 'user',
        content: `Execute this workflow: "${procedure.name}"\n\nSteps:\n${stepDescriptions}\n\nContext: ${context}\n\nExecute each step and provide the result.`,
      },
    ],
    (text) => {
      onStream(text)
      // Update step indicator based on progress
      for (let i = procedure.steps.length - 1; i >= 0; i--) {
        const keyword = procedure.steps[i].description.toLowerCase().split(' ')[0]
        if (text.toLowerCase().includes(keyword)) {
          onStep(i, procedure.steps[i].description)
          break
        }
      }
    },
    { tier: 'strong', max_tokens: 1024 }
  )

  return result
}
