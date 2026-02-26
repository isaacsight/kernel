// ─── Agentic Workflow ──────────────────────────────────────
//
// Autonomous multi-step task execution for Kernel Pro.
// Accepts a goal, decomposes it into steps via Claude (Haiku),
// executes each step using tools (web search, URL fetch, analyze, draft),
// evaluates results, retries on failure, and synthesizes a final response.
//
// Flow: Plan → Execute (per-step) → Observe → Synthesize

import { getProvider } from './providers/registry'
import { getAccessToken } from './SupabaseClient'
import type { WorkflowEvent } from './types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''

export type WorkflowState = 'planning' | 'executing' | 'observing' | 'completed' | 'failed' | 'cancelled';

export interface WorkflowStep {
    name: string
    status: 'pending' | 'active' | 'complete' | 'failed' | 'skipped'
    result?: string
    error?: string
}

export interface WorkflowCallbacks {
    onProgress: (event: WorkflowEvent) => void;
    onChunk?: (text: string) => void;
    onStepsUpdate?: (steps: WorkflowStep[]) => void;
}

// ─── Edge Function Helpers ─────────────────────────────────

async function callEdgeFunction(
    fnName: string,
    body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
    const token = await getAccessToken()
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: SUPABASE_KEY,
        },
        body: JSON.stringify(body),
    })
    if (!res.ok) {
        const errText = await res.text()
        throw new Error(`${fnName} failed (${res.status}): ${errText}`)
    }
    return res.json()
}

// ─── Built-in Workflow Tools ───────────────────────────────

type ToolName = 'web_search' | 'url_fetch' | 'analyze' | 'draft'

interface ToolDef {
    name: ToolName
    description: string
}

const WORKFLOW_TOOLS: ToolDef[] = [
    { name: 'web_search', description: 'Search the web for current information on a topic' },
    { name: 'url_fetch', description: 'Fetch and extract text content from a specific URL' },
    { name: 'analyze', description: 'Analyze and reason about gathered information using AI' },
    { name: 'draft', description: 'Write or create content based on research and analysis' },
]

async function executeWorkflowTool(
    tool: ToolName,
    input: string,
    systemContext?: string,
): Promise<string> {
    switch (tool) {
        case 'web_search': {
            const result = await callEdgeFunction('web-search', { query: input, max_tokens: 1200 })
            const text = (result.text as string) || ''
            const citations = (result.citations as string[]) || []
            return citations.length > 0
                ? `${text}\n\nSources:\n${citations.map(c => `- ${c}`).join('\n')}`
                : text
        }
        case 'url_fetch': {
            // Extract a URL from the input — the planner may provide a description + working memory
            const urlMatch = input.match(/https?:\/\/[^\s"'<>)\]]+/i)
            if (!urlMatch) {
                return `No valid URL found in input. Available context: ${input.slice(0, 200)}`
            }
            const result = await callEdgeFunction('url-fetch', { url: urlMatch[0] })
            return (result.text as string) || `Failed to fetch content from ${urlMatch[0]}`
        }
        case 'analyze': {
            const response = await getProvider().text(input, {
                system: systemContext || 'You are an analytical thinker. Analyze the provided information thoroughly. Identify key themes, patterns, and actionable insights. Be concise but comprehensive.',
                tier: 'strong',
                max_tokens: 2048,
            })
            return response
        }
        case 'draft': {
            const response = await getProvider().text(input, {
                system: systemContext || 'You are an expert writer. Draft the requested content based on the provided research and context. Write clearly, concisely, and professionally.',
                tier: 'strong',
                max_tokens: 4096,
            })
            return response
        }
    }
}

// ─── The Workflow Class ────────────────────────────────────

const MAX_RETRIES_PER_STEP = 2
const MIN_STEPS = 3
const MAX_STEPS = 7

export class AgenticWorkflow {
    private state: WorkflowState = 'planning'
    private cancelled = false
    private steps: WorkflowStep[] = []

    constructor(
        private _agentSystemPrompt: string,
        private callbacks: WorkflowCallbacks,
    ) { }

    cancel(): void {
        this.cancelled = true
        this.state = 'cancelled'
    }

    getSteps(): WorkflowStep[] {
        return [...this.steps]
    }

    private emit(step: string, details?: string) {
        this.callbacks.onProgress({
            type: 'workflow_progress',
            state: this.state,
            step,
            details,
            timestamp: Date.now(),
        })
    }

    private updateSteps() {
        this.callbacks.onStepsUpdate?.([...this.steps])
    }

    // ─── Plan Phase ────────────────────────────────────────

    private async plan(goal: string, context: string): Promise<string[]> {
        this.state = 'planning'
        this.emit('Planning', 'Decomposing goal into concrete steps...')

        const toolList = WORKFLOW_TOOLS.map(t => `- ${t.name}: ${t.description}`).join('\n')

        const planPrompt = `You are a task planner. Break down this goal into ${MIN_STEPS}-${MAX_STEPS} concrete, actionable steps.

Goal: ${goal}

Context from conversation:
${context}

Available tools for each step:
${toolList}

For each step, specify:
1. A clear, concise step name (e.g., "Search for AI safety papers from 2024")
2. Which tool to use (web_search, url_fetch, analyze, or draft)
3. The input/query for that tool

Return ONLY valid JSON with this structure:
{
  "steps": [
    { "name": "Step description", "tool": "tool_name", "input": "query or instruction for the tool" }
  ]
}

Rules:
- Use web_search for finding current information
- Use url_fetch to get content from specific URLs found during search
- Use analyze to reason about gathered data
- Use draft to write final content
- Steps should build on each other logically
- Be specific in step names and inputs`

        try {
            const result = await getProvider().json<{
                steps: { name: string; tool: ToolName; input: string }[]
            }>(planPrompt, {
                system: 'You are a task planning expert. Output ONLY valid JSON.',
                tier: 'fast',
                max_tokens: 1024,
            })

            if (!result.steps || !Array.isArray(result.steps) || result.steps.length === 0) {
                throw new Error('No steps returned')
            }

            // Enforce step count bounds
            const bounded = result.steps.slice(0, MAX_STEPS)
            this.steps = bounded.map(s => ({
                name: s.name,
                status: 'pending' as const,
            }))
            this.updateSteps()

            // Return serialized plan for execution
            return bounded.map(s => JSON.stringify(s))
        } catch {
            // Fallback: single-step plan
            const fallbackStep = { name: goal, tool: 'analyze' as ToolName, input: goal }
            this.steps = [{ name: goal, status: 'pending' }]
            this.updateSteps()
            return [JSON.stringify(fallbackStep)]
        }
    }

    // ─── Execute Phase ─────────────────────────────────────

    private async executeStep(
        stepJson: string,
        stepIndex: number,
        workingMemory: string,
    ): Promise<string> {
        let parsed: { name: string; tool: ToolName; input: string }
        try {
            parsed = JSON.parse(stepJson)
        } catch {
            return `Failed to parse step: ${stepJson}`
        }

        // Mark active
        this.steps[stepIndex].status = 'active'
        this.updateSteps()

        this.state = 'executing'
        this.emit(`Step ${stepIndex + 1}/${this.steps.length}`, parsed.name)

        // Enrich tool inputs with working memory for context
        const enrichedInput = parsed.tool === 'web_search'
            ? parsed.input
            : `${parsed.input}\n\nContext from previous steps:\n${workingMemory}`

        let lastError = ''
        for (let attempt = 0; attempt <= MAX_RETRIES_PER_STEP; attempt++) {
            if (this.cancelled) {
                this.steps[stepIndex].status = 'skipped'
                this.steps[stepIndex].error = 'Cancelled'
                this.updateSteps()
                return ''
            }

            try {
                const result = await executeWorkflowTool(
                    parsed.tool,
                    attempt > 0 ? `${enrichedInput}\n\n(Retry ${attempt}: previous attempt failed with: ${lastError})` : enrichedInput,
                    this._agentSystemPrompt,
                )

                // Observe — evaluate the result
                this.state = 'observing'
                this.emit('Evaluating', `Checking result of: ${parsed.name}`)

                const isAdequate = await this.evaluateStepResult(parsed.name, result)

                if (isAdequate || attempt === MAX_RETRIES_PER_STEP) {
                    this.steps[stepIndex].status = 'complete'
                    this.steps[stepIndex].result = result.slice(0, 500)
                    this.updateSteps()
                    return result
                }

                lastError = 'Result did not adequately satisfy the step requirements'
            } catch (err) {
                lastError = err instanceof Error ? err.message : 'Unknown error'
                if (attempt === MAX_RETRIES_PER_STEP) {
                    this.steps[stepIndex].status = 'failed'
                    this.steps[stepIndex].error = lastError
                    this.updateSteps()
                    return `[Step failed: ${lastError}]`
                }
            }
        }

        return ''
    }

    // ─── Observation / Evaluation ──────────────────────────

    private async evaluateStepResult(
        stepName: string,
        result: string,
    ): Promise<boolean> {
        // Quick heuristic: if we got substantial content, it's probably adequate
        if (result.length > 100 && !result.startsWith('[Step failed')) {
            return true
        }

        // For very short or error results, use Claude to evaluate
        try {
            const evaluation = await getProvider().json<{ adequate: boolean; reason: string }>(
                `Step: "${stepName}"\n\nResult:\n${result.slice(0, 1000)}\n\nDid this step produce an adequate result? Return { "adequate": true/false, "reason": "brief explanation" }`,
                {
                    system: 'You are a quality evaluator. Judge whether the step result is adequate. Output ONLY valid JSON.',
                    tier: 'fast',
                    max_tokens: 256,
                },
            )
            return evaluation.adequate ?? true
        } catch {
            // If evaluation fails, accept the result
            return true
        }
    }

    // ─── Synthesis Phase ───────────────────────────────────

    private async synthesize(
        goal: string,
        stepResults: { name: string; result: string }[],
    ): Promise<string> {
        const stepsContext = stepResults
            .map((s, i) => `## Step ${i + 1}: ${s.name}\n${s.result}`)
            .join('\n\n---\n\n')

        const synthesisPrompt = `You completed a multi-step workflow for the user. Here is what was accomplished:

**Original Goal:** ${goal}

**Step Results:**
${stepsContext}

**Instructions:**
- Synthesize all step results into a cohesive, well-structured final response
- Address the original goal directly
- If any steps failed, note what couldn't be completed and why
- Include relevant sources, URLs, or citations from the research steps
- Write naturally as if presenting findings to the user
- Do NOT mention "steps" or "workflow" — just present the final result`

        let fullText = ''
        await getProvider().stream(
            synthesisPrompt,
            (chunk) => {
                fullText = chunk
                this.callbacks.onChunk?.(chunk)
            },
            {
                system: this._agentSystemPrompt,
                tier: 'strong',
                max_tokens: 8192,
            },
        )

        return fullText
    }

    // ─── Main Execution Entry Point ────────────────────────

    async execute(goal: string, context: string): Promise<string> {
        this.cancelled = false

        // 1. Plan
        const stepPlans = await this.plan(goal, context)

        if (this.cancelled) {
            this.state = 'cancelled'
            this.emit('Cancelled', 'Workflow was cancelled during planning')
            return '*Workflow cancelled.*'
        }

        this.state = 'executing'
        this.emit('Plan ready', `${this.steps.length} steps to execute`)

        // 2. Execute each step sequentially
        let workingMemory = context
        const stepResults: { name: string; result: string }[] = []

        for (let i = 0; i < stepPlans.length; i++) {
            if (this.cancelled) {
                // Mark remaining steps as skipped
                for (let j = i; j < this.steps.length; j++) {
                    this.steps[j].status = 'skipped'
                }
                this.updateSteps()
                break
            }

            const result = await this.executeStep(stepPlans[i], i, workingMemory)

            let parsed: { name: string }
            try {
                parsed = JSON.parse(stepPlans[i])
            } catch {
                parsed = { name: `Step ${i + 1}` }
            }

            if (result && !this.cancelled) {
                workingMemory += `\n\n--- Step ${i + 1} (${parsed.name}) ---\n${result}`
                stepResults.push({ name: parsed.name, result })
            }
        }

        if (this.cancelled) {
            this.state = 'cancelled'
            this.emit('Cancelled', 'Workflow was cancelled')
            // Still synthesize whatever we got
            if (stepResults.length > 0) {
                return this.synthesize(goal, stepResults)
            }
            return '*Workflow cancelled before producing results.*'
        }

        // 3. Synthesize
        this.state = 'executing'
        this.emit('Synthesizing', 'Combining results into final response...')

        const finalResponse = await this.synthesize(goal, stepResults)

        this.state = 'completed'
        this.emit('Complete', 'Workflow finished successfully')
        this.steps.forEach(s => {
            if (s.status === 'active') s.status = 'complete'
        })
        this.updateSteps()

        return finalResponse
    }
}
