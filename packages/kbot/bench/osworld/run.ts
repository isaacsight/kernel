// OSWorld-Verified runner.
//
// Loads the task manifest, spins up the VM, iterates tasks, calls kbot
// per step, executes actions via driver.ts, captures pass/fail + traces.
//
// Status: SKELETON. Needs:
//   - OSWorld Docker image (vendored in docker/)
//   - VM SSH bridge or kbot-in-VM install
//   - Task manifest loader (pulls from xlang-ai/OSWorld examples/)
//   - Grading via OSWorld's evaluator scripts

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { executeAction, type OSWorldAction } from './driver.js'

interface Task {
  id: string
  app: string              // "chrome" | "libreoffice_writer" | ...
  instruction: string
  config: unknown
  evaluator: unknown
}

interface RunResult {
  task_id: string
  passed: boolean
  steps: number
  elapsed_ms: number
  error?: string
}

const RESULTS_DIR = join(import.meta.dirname ?? '.', 'results')
const TRACE_DIR = join(RESULTS_DIR, 'traces')

function loadTasks(_path: string): Task[] {
  // TODO: read OSWorld's examples/ JSON manifests (one per task)
  throw new Error('run.loadTasks: implement after docker/ is vendored')
}

async function runTask(task: Task, maxSteps = 15): Promise<RunResult> {
  const start = Date.now()
  const trace: OSWorldAction[] = []

  for (let step = 0; step < maxSteps; step++) {
    // TODO: call kbot one-shot with current screenshot + instruction,
    //       parse OSWorldAction from response, execute.
    const action: OSWorldAction = await nextAction(task, trace)
    trace.push(action)

    if (action.action_type === 'DONE' || action.action_type === 'FAIL') break

    const result = await executeAction(action)
    if (!result.ok) {
      return {
        task_id: task.id, passed: false, steps: step + 1,
        elapsed_ms: Date.now() - start, error: result.error,
      }
    }
  }

  const passed = await grade(task)  // TODO: invoke OSWorld evaluator
  saveTrace(task.id, trace)
  return { task_id: task.id, passed, steps: trace.length, elapsed_ms: Date.now() - start }
}

async function nextAction(_task: Task, _trace: OSWorldAction[]): Promise<OSWorldAction> {
  throw new Error('run.nextAction: implement kbot one-shot call')
}

async function grade(_task: Task): Promise<boolean> {
  throw new Error('run.grade: implement OSWorld evaluator shell-out')
}

function saveTrace(taskId: string, trace: OSWorldAction[]): void {
  if (!existsSync(TRACE_DIR)) mkdirSync(TRACE_DIR, { recursive: true })
  writeFileSync(join(TRACE_DIR, `${taskId}.json`), JSON.stringify(trace, null, 2))
}

export async function main(): Promise<void> {
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true })
  const resultsFile = join(RESULTS_DIR, `run-${Date.now()}.jsonl`)

  const tasks = loadTasks('./tasks.json')
  console.log(`loaded ${tasks.length} tasks`)

  let passed = 0
  for (const [i, task] of tasks.entries()) {
    console.log(`[${i + 1}/${tasks.length}] ${task.id}`)
    const result = await runTask(task)
    appendFileSync(resultsFile, JSON.stringify(result) + '\n')
    if (result.passed) passed++
    console.log(`  ${result.passed ? 'PASS' : 'FAIL'} (${result.steps} steps, ${result.elapsed_ms}ms)`)
  }

  console.log(`\nFinal: ${passed}/${tasks.length} (${((passed / tasks.length) * 100).toFixed(1)}%)`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => { console.error(e); process.exit(1) })
}
