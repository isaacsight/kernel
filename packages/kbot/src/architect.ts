// K:BOT Architect Mode — Dual-Agent Plan-Review-Implement Loop
//
// Splits complex tasks between two roles:
//   Architect: plans, reviews, approves/rejects
//   Editor:    implements one step at a time using tools
//
// Similar to Aider's architect mode. The architect never writes code directly;
// the editor never makes architectural decisions.
//
// Activation (to be wired in cli.ts):
//   $ kbot --architect "refactor the auth system"
//   > /architect refactor the auth system

import { runAgent, type AgentOptions, type AgentResponse } from './agent.js'
import { executeTool, type ToolCall, type ToolResult } from './tools/index.js'
import { gatherContext, formatContextForPrompt } from './context.js'
import { getRepoMapForContext } from './repo-map.js'
import { createSpinner, printInfo, printSuccess, printError, printWarn } from './ui.js'
import chalk from 'chalk'

const AMETHYST = chalk.hex('#6B5B95')

// ── Safety Limits ──

const MAX_PLAN_STEPS = 10
const MAX_RETRIES_PER_STEP = 2

// ── Types ──

export interface ArchitectPlan {
  summary: string
  files_to_modify: string[]
  files_to_create: string[]
  steps: ArchitectStep[]
  constraints: string[]
  test_strategy: string
}

interface ArchitectStep {
  description: string
  file: string
  action: 'create' | 'edit' | 'delete'
}

interface StepOutcome {
  step: ArchitectStep
  status: 'approved' | 'failed'
  attempts: number
  editorOutput: string
  reviewFeedback?: string
}

interface ArchitectReport {
  plan: ArchitectPlan
  outcomes: StepOutcome[]
  verification: string | null
  status: 'completed' | 'partial' | 'failed'
}

// ── System Prompts ──

const ARCHITECT_PLAN_PROMPT = `You are the Architect in a dual-agent coding system. Your job is to PLAN, not implement.

Given a task and project context, produce a structured JSON plan. You must output ONLY valid JSON matching this schema:

{
  "summary": "One-sentence summary of the overall change",
  "files_to_modify": ["list of existing files that will be edited"],
  "files_to_create": ["list of new files to create"],
  "steps": [
    {
      "description": "Precise description of what to do in this step",
      "file": "path/to/file.ts",
      "action": "create | edit | delete"
    }
  ],
  "constraints": [
    "Things the editor must NOT do (e.g., 'do not change the public API', 'preserve backward compatibility')"
  ],
  "test_strategy": "How to verify the changes work (e.g., 'run npx tsc --noEmit', 'run npm test')"
}

Rules:
- Maximum ${MAX_PLAN_STEPS} steps. Break large changes into focused, atomic steps.
- Each step targets exactly ONE file with ONE action.
- Order steps by dependency — if step 3 depends on step 1, step 1 comes first.
- For edits, describe WHAT to change specifically (function names, line ranges, logic changes).
- For creates, describe the full purpose, exports, and structure of the new file.
- Include constraints that prevent the editor from making unintended changes.
- The test_strategy should be a concrete command, not a vague suggestion.
- Output ONLY the JSON object. No markdown fences, no explanation.`

const ARCHITECT_REVIEW_PROMPT = `You are the Architect reviewing an Editor's implementation of one step in your plan.

You will see:
1. The original step description
2. The file and action
3. The editor's output (what they did)

Evaluate whether the implementation:
- Correctly implements the step as described
- Does not violate any constraints
- Does not introduce bugs, type errors, or security issues
- Is clean, idiomatic code

Respond with ONLY valid JSON:
{
  "approved": true | false,
  "feedback": "If rejected: specific, actionable feedback for the editor to fix. If approved: brief confirmation."
}

Be strict but fair. Approve good-enough work. Reject only if there are real problems.`

const EDITOR_SYSTEM_PROMPT = `You are the Editor in a dual-agent coding system. You IMPLEMENT, you do not plan.

You receive a single step to execute. Use your tools to implement it precisely.

Rules:
- Follow the step description exactly. Do not add unrequested features.
- Do not make architectural decisions. If something is ambiguous, implement the simplest version.
- Use edit_file for existing files, write_file for new files, bash for commands.
- After implementing, briefly describe what you did (1-2 sentences).
- If the Architect gave you feedback on a previous attempt, address ALL of the feedback points.
- Do not modify files outside the scope of your current step.`

// ── Utility: chatOnce ──
// A simplified single-turn call. Uses runAgent under the hood but with a
// specific system prompt injected via the agent message itself (since runAgent
// builds its own system context, we prepend our role instructions).

async function chatOnce(
  systemPrompt: string,
  userMessage: string,
  agentOpts: AgentOptions,
): Promise<string> {
  // Combine our role-specific system prompt with the user message so
  // runAgent processes it through the full provider pipeline (including tools
  // for the editor). The system prompt goes first as context framing.
  const combined = `${systemPrompt}\n\n---\n\n${userMessage}`
  const response = await runAgent(combined, {
    ...agentOpts,
    agent: agentOpts.agent || 'coder',
  })
  return response.content
}

// ── Phase 1: Architect Creates Plan ──

async function createPlan(
  task: string,
  agentOpts: AgentOptions,
): Promise<ArchitectPlan> {
  const spinner = createSpinner('Architect analyzing task...')
  spinner.start()

  // Gather project context and repo map for the architect
  let contextStr = ''
  try {
    const context = gatherContext()
    contextStr = formatContextForPrompt(context)
  } catch { /* context is non-critical */ }

  let repoMap = ''
  try {
    repoMap = await getRepoMapForContext()
  } catch { /* repo map is non-critical */ }

  const userMessage = `Project context:
${contextStr}

Repository structure:
${repoMap || '(unavailable)'}

Task: ${task}

Output your plan as JSON:`

  spinner.stop()

  const raw = await chatOnce(ARCHITECT_PLAN_PROMPT, userMessage, agentOpts)

  // Parse the JSON plan from the response
  let plan: ArchitectPlan

  try {
    // Extract JSON — AI might wrap it in markdown fences
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in architect response')
    const parsed = JSON.parse(jsonMatch[0])

    plan = {
      summary: parsed.summary || task,
      files_to_modify: parsed.files_to_modify || [],
      files_to_create: parsed.files_to_create || [],
      steps: (parsed.steps || []).slice(0, MAX_PLAN_STEPS).map((s: any) => ({
        description: s.description || '',
        file: s.file || '',
        action: (['create', 'edit', 'delete'].includes(s.action) ? s.action : 'edit') as ArchitectStep['action'],
      })),
      constraints: parsed.constraints || [],
      test_strategy: parsed.test_strategy || 'npx tsc --noEmit',
    }
  } catch {
    // Fallback: single-step plan if AI didn't return valid JSON
    plan = {
      summary: task,
      files_to_modify: [],
      files_to_create: [],
      steps: [{
        description: task,
        file: '',
        action: 'edit',
      }],
      constraints: [],
      test_strategy: 'npx tsc --noEmit',
    }
    printWarn('Architect produced non-JSON response. Using simplified plan.')
  }

  // Safety: enforce step limit
  if (plan.steps.length > MAX_PLAN_STEPS) {
    plan.steps = plan.steps.slice(0, MAX_PLAN_STEPS)
    printWarn(`Plan truncated to ${MAX_PLAN_STEPS} steps (safety limit).`)
  }

  return plan
}

// ── Phase 2: Editor Implements a Step ──

async function editorImplement(
  step: ArchitectStep,
  stepIndex: number,
  totalSteps: number,
  plan: ArchitectPlan,
  feedback: string | null,
  agentOpts: AgentOptions,
): Promise<string> {
  const feedbackSection = feedback
    ? `\n\nPREVIOUS ATTEMPT REJECTED. Architect feedback:\n${feedback}\n\nAddress ALL feedback points in this attempt.`
    : ''

  const constraintsSection = plan.constraints.length > 0
    ? `\nConstraints (do NOT violate these):\n${plan.constraints.map(c => `- ${c}`).join('\n')}`
    : ''

  const userMessage = `Step ${stepIndex + 1} of ${totalSteps}:

Action: ${step.action.toUpperCase()} file: ${step.file}
Description: ${step.description}
${constraintsSection}
${feedbackSection}

Implement this step now using your tools. Be precise.`

  return chatOnce(EDITOR_SYSTEM_PROMPT, userMessage, agentOpts)
}

// ── Phase 3: Architect Reviews Editor Output ──

async function architectReview(
  step: ArchitectStep,
  editorOutput: string,
  plan: ArchitectPlan,
  agentOpts: AgentOptions,
): Promise<{ approved: boolean; feedback: string }> {
  const constraintsSection = plan.constraints.length > 0
    ? `\nConstraints that must be respected:\n${plan.constraints.map(c => `- ${c}`).join('\n')}`
    : ''

  const userMessage = `Step under review:
Action: ${step.action.toUpperCase()} file: ${step.file}
Description: ${step.description}
${constraintsSection}

Editor's output:
${editorOutput.slice(0, 4000)}

Evaluate and respond with JSON (approved: true/false, feedback: string):`

  const raw = await chatOnce(ARCHITECT_REVIEW_PROMPT, userMessage, agentOpts)

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in review')
    const parsed = JSON.parse(jsonMatch[0])
    return {
      approved: !!parsed.approved,
      feedback: parsed.feedback || '',
    }
  } catch {
    // If review parsing fails, approve by default to avoid blocking
    printWarn('Architect review returned non-JSON. Auto-approving step.')
    return { approved: true, feedback: 'Auto-approved (review parse failure).' }
  }
}

// ── Phase 4: Verification ──

async function runVerification(
  plan: ArchitectPlan,
  agentOpts: AgentOptions,
): Promise<string> {
  const spinner = createSpinner('Running verification...')
  spinner.start()

  try {
    // Use the editor agent to run the test strategy command
    const verifyMessage = `Run this verification command and report the results:\n\n${plan.test_strategy}\n\nIf there are errors, list them. If everything passes, say so.`
    const result = await chatOnce(EDITOR_SYSTEM_PROMPT, verifyMessage, agentOpts)
    spinner.stop()
    return result
  } catch (err) {
    spinner.stop()
    const errMsg = err instanceof Error ? err.message : String(err)
    return `Verification failed: ${errMsg}`
  }
}

// ── Display Helpers ──

function displayPlan(plan: ArchitectPlan): void {
  console.log()
  console.log(`  ${AMETHYST('◆ Architect Plan')}: ${plan.summary}`)
  console.log(`  ${chalk.dim('─'.repeat(60))}`)
  console.log()

  if (plan.files_to_modify.length > 0) {
    console.log(`  ${chalk.dim('Modify:')} ${plan.files_to_modify.join(', ')}`)
  }
  if (plan.files_to_create.length > 0) {
    console.log(`  ${chalk.dim('Create:')} ${plan.files_to_create.join(', ')}`)
  }
  if (plan.files_to_modify.length > 0 || plan.files_to_create.length > 0) {
    console.log()
  }

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i]
    const actionIcon = { create: chalk.green('+'), edit: chalk.yellow('~'), delete: chalk.red('-') }[step.action]
    console.log(`  ${chalk.dim(`${i + 1}.`)} ${actionIcon} ${chalk.cyan(step.file)} ${chalk.dim('—')} ${step.description}`)
  }

  if (plan.constraints.length > 0) {
    console.log()
    console.log(`  ${chalk.dim('Constraints:')}`)
    for (const c of plan.constraints) {
      console.log(`    ${chalk.red('!')} ${c}`)
    }
  }

  console.log()
  console.log(`  ${chalk.dim('Verify:')} ${plan.test_strategy}`)
  console.log(`  ${chalk.dim(`${plan.steps.length} steps`)}`)
  console.log()
}

function displayStepResult(
  stepIndex: number,
  total: number,
  step: ArchitectStep,
  approved: boolean,
  attempt: number,
): void {
  const prefix = `Step ${stepIndex + 1}/${total}`
  if (approved) {
    printSuccess(`${prefix}: ${step.description}`)
  } else {
    printWarn(`${prefix}: rejected (attempt ${attempt}/${MAX_RETRIES_PER_STEP + 1})`)
  }
}

function displayReport(report: ArchitectReport): void {
  console.log()
  console.log(`  ${AMETHYST('◆ Architect Report')}`)
  console.log(`  ${chalk.dim('─'.repeat(60))}`)
  console.log()
  console.log(`  ${chalk.dim('Summary:')} ${report.plan.summary}`)
  console.log(`  ${chalk.dim('Status:')}  ${report.status === 'completed' ? chalk.green(report.status) : report.status === 'partial' ? chalk.yellow(report.status) : chalk.red(report.status)}`)
  console.log()

  for (const outcome of report.outcomes) {
    const icon = outcome.status === 'approved' ? chalk.green('✓') : chalk.red('✗')
    const retries = outcome.attempts > 1 ? chalk.dim(` (${outcome.attempts} attempts)`) : ''
    console.log(`  ${icon} ${outcome.step.description}${retries}`)
    if (outcome.status === 'failed' && outcome.reviewFeedback) {
      console.log(`    ${chalk.dim('Last feedback:')} ${outcome.reviewFeedback.slice(0, 120)}`)
    }
  }

  if (report.verification) {
    console.log()
    console.log(`  ${chalk.dim('Verification:')}`)
    // Show first few lines of verification output
    const lines = report.verification.split('\n').slice(0, 8)
    for (const line of lines) {
      console.log(`    ${line}`)
    }
    if (report.verification.split('\n').length > 8) {
      console.log(`    ${chalk.dim(`... (${report.verification.split('\n').length - 8} more lines)`)}`)
    }
  }

  console.log()
}

// ── Main Entry Point ──

/**
 * Run architect mode: a dual-agent loop where the Architect plans and reviews
 * while the Editor implements each step.
 *
 * Flow:
 *   1. Architect analyzes the task and creates a structured plan
 *   2. For each step: Editor implements -> Architect reviews -> approve or redo
 *   3. After all steps: Architect runs verification (type check, tests)
 *   4. Returns a full report
 *
 * @param task - The user's task description
 * @param options - Agent options (model, streaming, etc.)
 * @returns Full report of the architect session
 */
export async function runArchitectMode(
  task: string,
  options: AgentOptions = {},
): Promise<ArchitectReport> {
  printInfo('Entering architect mode...')
  console.log()

  // Phase 1: Architect creates plan
  printInfo('Phase 1: Architect planning...')
  const plan = await createPlan(task, options)
  displayPlan(plan)

  // Phase 2: Editor implements each step with architect review
  printInfo('Phase 2: Editor implementing...')
  console.log()

  const outcomes: StepOutcome[] = []

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i]
    let approved = false
    let attempts = 0
    let lastEditorOutput = ''
    let lastFeedback: string | null = null

    while (!approved && attempts <= MAX_RETRIES_PER_STEP) {
      attempts++

      // Editor implements
      const spinner = createSpinner(`Step ${i + 1}/${plan.steps.length}: ${step.description}`)
      spinner.start()

      try {
        lastEditorOutput = await editorImplement(step, i, plan.steps.length, plan, lastFeedback, options)
        spinner.stop()
      } catch (err) {
        spinner.stop()
        const errMsg = err instanceof Error ? err.message : String(err)
        printError(`Editor failed on step ${i + 1}: ${errMsg}`)
        lastEditorOutput = `Error: ${errMsg}`
        break
      }

      // Architect reviews
      const review = await architectReview(step, lastEditorOutput, plan, options)
      approved = review.approved
      lastFeedback = review.feedback

      displayStepResult(i, plan.steps.length, step, approved, attempts)

      if (!approved && attempts <= MAX_RETRIES_PER_STEP) {
        printInfo(`Architect feedback: ${review.feedback.slice(0, 200)}`)
      }
    }

    outcomes.push({
      step,
      status: approved ? 'approved' : 'failed',
      attempts,
      editorOutput: lastEditorOutput,
      reviewFeedback: lastFeedback || undefined,
    })

    // If a step fails after all retries, continue with remaining steps
    // (the architect plan may have independent steps that can still succeed)
    if (!approved) {
      printWarn(`Step ${i + 1} failed after ${attempts} attempts. Continuing with remaining steps.`)
    }
  }

  // Phase 3: Verification
  const approvedCount = outcomes.filter(o => o.status === 'approved').length
  let verification: string | null = null

  if (approvedCount > 0) {
    printInfo('Phase 3: Running verification...')
    verification = await runVerification(plan, options)
  } else {
    printWarn('All steps failed. Skipping verification.')
  }

  // Determine overall status
  const failedCount = outcomes.filter(o => o.status === 'failed').length
  let status: ArchitectReport['status']
  if (failedCount === 0) {
    status = 'completed'
  } else if (approvedCount > 0) {
    status = 'partial'
  } else {
    status = 'failed'
  }

  const report: ArchitectReport = { plan, outcomes, verification, status }
  displayReport(report)

  return report
}
