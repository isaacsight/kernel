// TaskPlanner — Multi-step task decomposition and execution
// Planning (haiku) → Sequential execution → Final synthesis (sonnet, streamed)

import { getProvider } from './providers/registry'
import { getSpecialist } from '../agents/specialists'

export interface TaskStep {
  id: number
  description: string
  agentId: string
  status: 'pending' | 'running' | 'done' | 'error'
  result?: string
}

export interface TaskPlan {
  goal: string
  steps: TaskStep[]
}

export interface TaskProgress {
  plan: TaskPlan
  currentStep: number
}

const PLAN_SYSTEM = `You are a task planner. Break down the user's request into 2-5 sequential steps. Each step should be a distinct operation that builds on previous steps.

Available agents for each step:
- kernel: General conversation, synthesis, personal advice
- researcher: Web research, fact-finding, current events
- coder: Code generation, debugging, technical implementation
- writer: Content creation, editing, copywriting
- analyst: Data analysis, strategy, evaluation, comparisons

Rules:
- Keep steps focused — one clear objective per step
- Order matters — later steps can reference earlier results
- The FINAL step should always produce the user-facing output
- 2-5 steps total. Don't over-decompose simple tasks.

Respond with ONLY valid JSON:
{"goal": "brief description", "steps": [{"id": 1, "description": "what to do", "agentId": "researcher"}]}`

export async function planTask(request: string): Promise<TaskPlan> {
  try {
    const raw = await getProvider().json<{ goal: string; steps: { id: number; description: string; agentId: string }[] }>(
      `Break this request into steps:\n\n${request}`,
      { system: PLAN_SYSTEM, tier: 'fast', max_tokens: 500, feature: 'task_planning' }
    )

    const validAgents = ['kernel', 'researcher', 'coder', 'writer', 'analyst']
    const steps: TaskStep[] = (raw.steps || []).slice(0, 5).map((s, i) => ({
      id: i + 1,
      description: s.description,
      agentId: validAgents.includes(s.agentId) ? s.agentId : 'kernel',
      status: 'pending' as const,
    }))

    if (steps.length === 0) {
      steps.push({ id: 1, description: request, agentId: 'kernel', status: 'pending' })
    }

    return { goal: raw.goal || request, steps }
  } catch {
    return {
      goal: request,
      steps: [{ id: 1, description: request, agentId: 'kernel', status: 'pending' }],
    }
  }
}

export async function executeTask(
  plan: TaskPlan,
  userMemoryContext: string,
  onProgress: (progress: TaskProgress) => void,
  onStream: (text: string) => void
): Promise<string> {
  const steps = plan.steps
  let accumulatedContext = ''

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    step.status = 'running'
    onProgress({ plan, currentStep: i })

    const specialist = getSpecialist(step.agentId)
    const isLast = i === steps.length - 1

    const stepPrompt = accumulatedContext
      ? `Previous step results:\n${accumulatedContext}\n\nCurrent task: ${step.description}\n\nOverall goal: ${plan.goal}`
      : `Task: ${step.description}\n\nOverall goal: ${plan.goal}`

    const systemPrompt = userMemoryContext
      ? `${specialist.systemPrompt}\n\n---\n\n## User Context\n${userMemoryContext}`
      : specialist.systemPrompt

    try {
      if (isLast) {
        // Final step: stream to UI
        const result = await getProvider().streamChat(
          [{ role: 'user', content: stepPrompt }],
          onStream,
          { system: systemPrompt, tier: 'strong', max_tokens: 2048, web_search: step.agentId === 'researcher', feature: 'task_planning' }
        )
        step.result = result
      } else {
        // Intermediate steps: non-streaming
        const result = await getProvider().text(stepPrompt, {
          system: systemPrompt,
          tier: 'fast',
          max_tokens: 1024,
          web_search: step.agentId === 'researcher',
          feature: 'task_planning',
        })
        step.result = result
        accumulatedContext += `\n\n## Step ${step.id}: ${step.description}\n${result}`
      }

      step.status = 'done'
    } catch (err) {
      step.status = 'error'
      step.result = err instanceof Error ? err.message : 'Step failed'
    }

    onProgress({ plan, currentStep: i })
  }

  // Return the final step's result
  const lastStep = steps[steps.length - 1]
  return lastStep?.result || 'Task completed but no output was generated.'
}
