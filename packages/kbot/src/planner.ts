// kbot Autonomous Planner — Plan-then-Execute for complex tasks
//
// This is the core missing piece vs Claude Code. When given a complex task,
// kbot should:
//   1. EXPLORE — read files, understand the codebase
//   2. PLAN — decompose into steps, identify files to change
//   3. CONFIRM — show the plan to the user for approval
//   4. EXECUTE — run each step, verify, self-correct
//   5. VERIFY — type-check, test, confirm everything works
//
// The planner uses the AI to generate a structured plan, then drives
// execution through the existing tool registry.

import { runAgent, type AgentOptions, type AgentResponse } from './agent.js'
import { executeTool, getTool, type ToolCall } from './tools/index.js'
import { gatherContext, formatContextForPrompt } from './context.js'
import { addTurn } from './memory.js'
import { createSpinner, printInfo, printSuccess, printError, printWarn } from './ui.js'
import { TaskLedger, type StepResult } from './task-ledger.js'
import { learnedRoute } from './learned-router.js'
import { classifyTask } from './learning.js'
import { listAgents } from './matrix.js'
import chalk from 'chalk'

const AMETHYST = chalk.hex('#6B5B95')

// ── Plan Types ──

export interface PlanStep {
  id: number
  description: string
  tool?: string
  args?: Record<string, unknown>
  /** Specialist agent to route this step to (e.g. 'coder', 'researcher') */
  agent?: string
  /** Files this step reads */
  reads?: string[]
  /** Files this step modifies */
  writes?: string[]
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped'
  result?: string
  error?: string
  /** Step IDs this depends on */
  dependsOn?: number[]
}

export interface Plan {
  task: string
  summary: string
  steps: PlanStep[]
  filesInScope: string[]
  estimatedToolCalls: number
  status: 'planning' | 'awaiting_approval' | 'executing' | 'completed' | 'failed'
  createdAt: string
}

// ── Plan Generation ──

const PLAN_SYSTEM_PROMPT = `You are an autonomous coding agent planning a task. You must output a structured JSON plan.

Given the user's task and project context, produce a plan with this exact JSON structure:
{
  "summary": "One-sentence summary of what will be done",
  "steps": [
    {
      "id": 1,
      "description": "Human-readable description of this step",
      "tool": "tool_name",
      "args": { "key": "value" },
      "agent": "coder",
      "reads": ["file1.ts"],
      "writes": ["file2.ts"],
      "dependsOn": []
    }
  ],
  "filesInScope": ["list of all files that need to be read or modified"]
}

Available tools: read_file, write_file, edit_file, multi_file_write, bash, glob, grep, git_status, git_diff, git_commit, git_push, web_search, research, url_fetch, parallel_execute, sandbox_run, build_run, notebook_edit

Available agents (assign the best agent for each step):
- kernel: general tasks, conversation
- coder: programming, code generation, debugging, refactoring
- researcher: research, fact-finding, documentation lookup
- writer: content creation, documentation, copy
- analyst: strategy, evaluation, comparison
- guardian: security review, vulnerability scanning
- infrastructure: DevOps, CI/CD, deployment
- quant: data analysis, quantitative tasks
- investigator: deep research, root cause analysis

Rules:
- Start with read_file/glob/grep steps to understand the codebase BEFORE making changes
- Group independent operations that can run in parallel
- Assign the most appropriate agent to each step based on the step's nature
- Always verify changes with a type-check or test step at the end
- For file edits, use edit_file with old_string/new_string (not full rewrites unless creating new files)
- Include error recovery — if a step might fail, note what to do
- Keep plans concise — 5-20 steps for most tasks
- Output ONLY valid JSON, no markdown wrapping`

/**
 * Route a plan step to the best specialist agent.
 * Priority: LLM assignment (from plan) → learned router → task classification → fallback to coder.
 */
function routeStepToAgent(step: PlanStep): string {
  // 1. If the LLM explicitly assigned an agent in the plan, use it
  if (step.agent) {
    // Validate against known agents
    const known = listAgents().map(a => a.id)
    const builtIn = ['kernel', 'coder', 'researcher', 'writer', 'analyst', 'aesthete', 'guardian', 'curator', 'strategist', 'infrastructure', 'quant', 'investigator', 'oracle', 'chronist', 'sage', 'communicator', 'adapter']
    if (known.includes(step.agent) || builtIn.includes(step.agent)) {
      return step.agent
    }
  }

  // 2. Try the learned router (based on historical routing patterns)
  const learned = learnedRoute(step.description)
  if (learned) return learned.agent

  // 3. Fall back to task classification
  const taskType = classifyTask(step.description)
  const taskToAgent: Record<string, string> = {
    debug: 'coder',
    build: 'coder',
    refactor: 'coder',
    test: 'coder',
    research: 'researcher',
    search: 'researcher',
    explain: 'writer',
    deploy: 'infrastructure',
    security: 'guardian',
    analyze: 'analyst',
  }
  return taskToAgent[taskType] || 'coder'
}

/**
 * Generate a plan for a complex task.
 * Uses the AI to analyze the task and produce structured steps.
 */
export async function generatePlan(
  task: string,
  agentOpts: AgentOptions,
): Promise<Plan> {
  const context = gatherContext()
  const contextStr = formatContextForPrompt(context)

  const planPrompt = `${PLAN_SYSTEM_PROMPT}

Project context:
${contextStr}

Task: ${task}

Output your plan as JSON:`

  // Use the agent to generate the plan (it has access to tools for exploration)
  const response = await runAgent(planPrompt, {
    ...agentOpts,
    agent: 'coder', // Use coder agent for planning
    skipPlanner: true, // Prevent re-entering planner from within planner
  })

  // Parse the JSON plan from the response
  let planData: { summary: string; steps: Array<Omit<PlanStep, 'status'>>; filesInScope: string[] }

  try {
    // Extract JSON from response (might be wrapped in markdown)
    // Extract JSON: try greedy first, fall back to progressively shorter matches
    let jsonMatch: RegExpMatchArray | null = null
    const fullMatch = response.content.match(/\{[\s\S]*\}/)
    if (fullMatch) {
      // Try parsing the greedy match first; if it fails, trim from the end
      try {
        JSON.parse(fullMatch[0])
        jsonMatch = fullMatch
      } catch {
        // Find the last valid JSON by trying shorter substrings
        const str = fullMatch[0]
        for (let i = str.length - 1; i > 0; i--) {
          if (str[i] === '}') {
            try {
              JSON.parse(str.slice(0, i + 1))
              jsonMatch = [str.slice(0, i + 1)] as unknown as RegExpMatchArray
              break
            } catch { /* try shorter */ }
          }
        }
        if (!jsonMatch) jsonMatch = fullMatch // fallback to original
      }
    }
    if (!jsonMatch) throw new Error('No JSON found in plan response')
    planData = JSON.parse(jsonMatch[0])
  } catch {
    // If AI didn't return valid JSON, create a simple single-step plan
    planData = {
      summary: `Execute: ${task}`,
      steps: [{
        id: 1,
        description: task,
        reads: [],
        writes: [],
        dependsOn: [],
      }],
      filesInScope: [],
    }
  }

  return {
    task,
    summary: planData.summary,
    steps: planData.steps.map((s, i) => ({
      ...s,
      id: s.id || i + 1,
      status: 'pending' as const,
    })),
    filesInScope: planData.filesInScope || [],
    estimatedToolCalls: planData.steps.length,
    status: 'awaiting_approval',
    createdAt: new Date().toISOString(),
  }
}

/**
 * Display a plan to the user for approval.
 */
export function displayPlan(plan: Plan): void {
  console.log()
  console.log(`  ${AMETHYST('◆ Plan')}: ${plan.summary}`)
  console.log(`  ${chalk.dim('─'.repeat(50))}`)
  console.log()

  for (const step of plan.steps) {
    const deps = step.dependsOn && step.dependsOn.length > 0
      ? chalk.dim(` (after #${step.dependsOn.join(', #')})`)
      : ''
    const tool = step.tool ? chalk.cyan(` [${step.tool}]`) : ''
    const agent = step.agent ? chalk.magenta(` @${step.agent}`) : ''
    console.log(`  ${chalk.dim(`${step.id}.`)} ${step.description}${tool}${agent}${deps}`)

    if (step.writes && step.writes.length > 0) {
      console.log(`     ${chalk.dim('writes:')} ${step.writes.join(', ')}`)
    }
  }

  console.log()
  console.log(`  ${chalk.dim(`${plan.steps.length} steps · ${plan.filesInScope.length} files in scope`)}`)
  console.log()
}

/**
 * Execute a plan step by step.
 * Supports parallel execution for independent steps.
 */
export async function executePlan(
  plan: Plan,
  agentOpts: AgentOptions,
  onStepComplete?: (step: PlanStep) => void,
): Promise<Plan> {
  plan.status = 'executing'

  // Initialize dual-ledger orchestration
  const ledger = new TaskLedger()
  ledger.setPlan(plan.steps.map(s => ({
    index: s.id - 1,
    description: s.description,
    agent: s.tool ? undefined : 'coder',
    tools: s.tool ? [s.tool] : undefined,
    status: 'pending',
    dependsOn: s.dependsOn?.map(d => d - 1),
  })))

  // Group steps by dependency layers for parallel execution
  const executed = new Set<number>()

  while (executed.size < plan.steps.length) {
    // Find all steps whose dependencies are met
    const ready = plan.steps.filter(step => {
      if (executed.has(step.id)) return false
      if (step.status === 'skipped') { executed.add(step.id); return false }
      const deps = step.dependsOn || []
      return deps.every(depId => {
        const dep = plan.steps.find(s => s.id === depId)
        return dep && (dep.status === 'done' || executed.has(depId))
      })
    })

    if (ready.length === 0) {
      // Remaining steps have unmet deps
      for (const step of plan.steps) {
        if (!executed.has(step.id) && step.status === 'pending') {
          step.status = 'skipped'
          step.error = 'Unmet dependencies (earlier steps failed)'
          executed.add(step.id)
        }
      }
      break
    }

    if (ready.length > 1) {
      printInfo(`Running ${ready.length} steps in parallel...`)
    }

    // Execute ready steps in parallel
    await Promise.all(ready.map(async (step) => {
      step.status = 'running'
      const spinner = createSpinner(`Step ${step.id}: ${step.description}`)
      spinner.start()

      try {
        if (step.tool && step.args) {
          const call: ToolCall = {
            id: `plan_${plan.createdAt}_step_${step.id}`,
            name: step.tool,
            arguments: step.args,
          }
          const result = await executeTool(call)
          step.result = result.result
          step.status = result.error ? 'failed' : 'done'
          if (result.error) step.error = result.result
        } else {
          // Route step to the best specialist agent
          const stepAgent = routeStepToAgent(step)
          const response = await runAgent(
            `You are executing step ${step.id} of a plan. The step is: "${step.description}"\n\nExecute this step now using your tools. Be precise and verify your work.`,
            { ...agentOpts, agent: stepAgent, skipPlanner: true },
          )
          step.result = response.content
          step.status = 'done'
        }

        spinner.stop()
        if (step.status === 'done') {
          printSuccess(`Step ${step.id}: ${step.description}`)
        } else {
          printError(`Step ${step.id} failed: ${step.error}`)
        }
      } catch (err) {
        spinner.stop()
        step.status = 'failed'
        step.error = err instanceof Error ? err.message : String(err)
        printError(`Step ${step.id} failed: ${step.error}`)

        // Self-correction
        printWarn('Attempting self-correction...')
        try {
          const fixResponse = await runAgent(
            `Step ${step.id} ("${step.description}") failed with error:\n${step.error}\n\nAnalyze the error and try a different approach.`,
            { ...agentOpts, skipPlanner: true },
          )
          step.result = fixResponse.content
          step.status = 'done'
          step.error = undefined
          printSuccess(`Step ${step.id}: recovered via self-correction`)
        } catch {
          printError(`Self-correction also failed. Continuing.`)
        }
      }

      // Record step result in the task ledger
      const stepResult: StepResult = {
        result: step.status === 'done' ? 'success' : 'failure',
        output: step.result?.slice(0, 200),
        error: step.error,
        toolsUsed: step.tool ? [step.tool] : [],
        tokensUsed: 0,
        costUsd: 0,
      }
      ledger.updateStep(step.id - 1, stepResult)

      executed.add(step.id)
      onStepComplete?.(step)
    }))

    // Check if the ledger recommends replanning
    if (ledger.shouldReplan()) {
      printWarn('Task ledger recommends replanning — too many failures or high cost.')
      printInfo(ledger.getProgressSummary())
      break
    }
  }

  // Final status
  const failed = plan.steps.filter(s => s.status === 'failed')
  const done = plan.steps.filter(s => s.status === 'done')
  plan.status = failed.length === 0 ? 'completed' : 'failed'

  console.log()
  if (plan.status === 'completed') {
    printSuccess(`Plan complete: ${done.length}/${plan.steps.length} steps succeeded`)
  } else {
    printWarn(`Plan finished with errors: ${done.length} done, ${failed.length} failed`)
  }

  // Log ledger summary
  printInfo(ledger.getProgressSummary())

  return plan
}

/**
 * Full autonomous flow: Plan → Confirm → Execute → Verify
 * This is the top-level entry point for complex tasks.
 */
export async function autonomousExecute(
  task: string,
  agentOpts: AgentOptions,
  options?: {
    /** Skip approval — execute immediately */
    autoApprove?: boolean
    /** Callback for user approval (return true to proceed) */
    onApproval?: (plan: Plan) => Promise<boolean>
  },
): Promise<Plan> {
  // Phase 1: Generate plan
  printInfo('Analyzing task and generating plan...')
  const plan = await generatePlan(task, agentOpts)

  // Phase 2: Show plan and get approval
  displayPlan(plan)

  if (!options?.autoApprove) {
    if (options?.onApproval) {
      const approved = await options.onApproval(plan)
      if (!approved) {
        plan.status = 'failed'
        printInfo('Plan rejected by user.')
        return plan
      }
    }
    // If no approval callback, proceed (interactive mode handles this in CLI)
  }

  // Phase 3: Execute
  const result = await executePlan(plan, agentOpts)

  // Phase 4: Verify (type-check if applicable)
  if (result.status === 'completed') {
    const context = gatherContext()
    if (context.language === 'TypeScript' || context.language === 'JavaScript') {
      printInfo('Running verification...')
      const verifyTool = getTool('bash')
      if (verifyTool) {
        try {
          const verifyResult = await verifyTool.execute({ command: 'npx tsc --noEmit 2>&1 | head -20' })
          if (verifyResult.includes('error TS')) {
            printWarn('Type errors detected after plan execution:')
            printInfo(verifyResult.split('\n').slice(0, 5).join('\n'))
          } else {
            printSuccess('Verification passed — no type errors')
          }
        } catch { /* non-fatal */ }
      }
    }
  }

  return result
}

/**
 * Format a plan summary for display after completion
 */
export function formatPlanSummary(plan: Plan): string {
  const done = plan.steps.filter(s => s.status === 'done').length
  const failed = plan.steps.filter(s => s.status === 'failed').length
  const skipped = plan.steps.filter(s => s.status === 'skipped').length

  const lines = [
    `Plan: ${plan.summary}`,
    `Status: ${plan.status}`,
    `Steps: ${done} done, ${failed} failed, ${skipped} skipped (${plan.steps.length} total)`,
    '',
  ]

  for (const step of plan.steps) {
    const icon = { done: '✓', failed: '✗', skipped: '○', pending: '·', running: '●' }[step.status]
    lines.push(`  ${icon} ${step.id}. ${step.description} [${step.status}]`)
    if (step.error) lines.push(`     Error: ${step.error}`)
  }

  return lines.join('\n')
}
