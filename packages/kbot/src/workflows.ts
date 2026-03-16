// K:BOT Workflow Graph System — Composable multi-step agent pipelines
//
// Builds on top of the existing planner and agent loop to provide:
//   1. Declarative DAG-based workflows (nodes + edges)
//   2. Parallel, conditional, and human-in-the-loop execution
//   3. Persistent workflow storage (~/.kbot/workflows/)
//   4. Plan-to-workflow bridge for converting planner output
//   5. Mermaid diagram export for visualization
//   6. Tool integration for agent-driven workflow management

import { runAgent, type AgentOptions, type AgentResponse } from './agent.js'
import { registerTool } from './tools/index.js'
import { createSpinner, printInfo, printSuccess, printError, printWarn } from './ui.js'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { randomUUID } from 'node:crypto'

// ── Data Model ──

export interface WorkflowNode {
  id: string
  type: 'agent' | 'tool' | 'condition' | 'parallel' | 'human'
  agent?: string        // specialist agent ID
  tool?: string         // tool name
  prompt?: string       // instruction for this step
  condition?: string    // JS expression for condition nodes
  children?: string[]   // IDs of next nodes (multiple for parallel)
  retryOnFail?: boolean
  maxRetries?: number
}

export interface WorkflowEdge {
  from: string
  to: string
  label?: string
}

export interface Workflow {
  id: string
  name: string
  description: string
  version: string
  author: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  variables: Record<string, string>  // template variables
  createdAt: string
  updatedAt: string
}

export interface WorkflowRun {
  workflowId: string
  status: 'running' | 'completed' | 'failed' | 'paused'
  currentNode: string
  results: Record<string, string>  // nodeId → output
  startedAt: string
  completedAt?: string
}

// ── Storage ──

const KBOT_DIR = join(homedir(), '.kbot')
const WORKFLOWS_DIR = join(KBOT_DIR, 'workflows')

async function ensureWorkflowsDir(): Promise<void> {
  if (!existsSync(WORKFLOWS_DIR)) {
    await mkdir(WORKFLOWS_DIR, { recursive: true })
  }
}

// ── Core Functions ──

/**
 * Create an empty workflow with the given name and description.
 */
export function createWorkflow(name: string, description: string): Workflow {
  const now = new Date().toISOString()
  return {
    id: randomUUID(),
    name,
    description,
    version: '1.0.0',
    author: 'kbot',
    nodes: [],
    edges: [],
    variables: {},
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Add a node to a workflow. Returns the mutated workflow.
 */
export function addNode(workflow: Workflow, node: WorkflowNode): Workflow {
  // Prevent duplicate IDs
  if (workflow.nodes.some(n => n.id === node.id)) {
    throw new Error(`Node "${node.id}" already exists in workflow "${workflow.name}"`)
  }
  workflow.nodes.push(node)
  workflow.updatedAt = new Date().toISOString()
  return workflow
}

/**
 * Connect two nodes with a directed edge. Returns the mutated workflow.
 */
export function addEdge(workflow: Workflow, from: string, to: string, label?: string): Workflow {
  // Validate that both nodes exist
  if (!workflow.nodes.some(n => n.id === from)) {
    throw new Error(`Source node "${from}" not found in workflow`)
  }
  if (!workflow.nodes.some(n => n.id === to)) {
    throw new Error(`Target node "${to}" not found in workflow`)
  }
  // Prevent duplicate edges
  if (workflow.edges.some(e => e.from === from && e.to === to)) {
    throw new Error(`Edge from "${from}" to "${to}" already exists`)
  }
  workflow.edges.push({ from, to, label })
  workflow.updatedAt = new Date().toISOString()
  return workflow
}

/**
 * Save a workflow to ~/.kbot/workflows/<id>.json
 */
export async function saveWorkflow(workflow: Workflow): Promise<string> {
  await ensureWorkflowsDir()
  const filePath = join(WORKFLOWS_DIR, `${workflow.id}.json`)
  await writeFile(filePath, JSON.stringify(workflow, null, 2), 'utf-8')
  return filePath
}

/**
 * Load a workflow from disk by ID.
 */
export async function loadWorkflow(id: string): Promise<Workflow> {
  const filePath = join(WORKFLOWS_DIR, `${id}.json`)
  if (!existsSync(filePath)) {
    throw new Error(`Workflow "${id}" not found at ${filePath}`)
  }
  const raw = await readFile(filePath, 'utf-8')
  return JSON.parse(raw) as Workflow
}

/**
 * List all saved workflows.
 */
export async function listWorkflows(): Promise<Array<{ id: string; name: string; description: string; updatedAt: string }>> {
  await ensureWorkflowsDir()
  const files = await readdir(WORKFLOWS_DIR)
  const workflows: Array<{ id: string; name: string; description: string; updatedAt: string }> = []

  for (const file of files) {
    if (!file.endsWith('.json')) continue
    try {
      const raw = await readFile(join(WORKFLOWS_DIR, file), 'utf-8')
      const wf = JSON.parse(raw) as Workflow
      workflows.push({
        id: wf.id,
        name: wf.name,
        description: wf.description,
        updatedAt: wf.updatedAt,
      })
    } catch {
      // Skip malformed files
    }
  }

  return workflows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/**
 * Export a workflow as shareable JSON string.
 */
export function exportWorkflow(workflow: Workflow): string {
  return JSON.stringify(workflow, null, 2)
}

// ── Topological Sort ──

/**
 * Topological sort of workflow nodes based on edges.
 * Returns node IDs in execution order. Throws on cycles.
 */
function topologicalSort(workflow: Workflow): string[] {
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  // Initialize
  for (const node of workflow.nodes) {
    inDegree.set(node.id, 0)
    adjacency.set(node.id, [])
  }

  // Build adjacency and in-degree from edges
  for (const edge of workflow.edges) {
    adjacency.get(edge.from)?.push(edge.to)
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1)
  }

  // Kahn's algorithm
  const queue: string[] = []
  for (const entry of Array.from(inDegree.entries())) {
    if (entry[1] === 0) queue.push(entry[0])
  }

  const sorted: string[] = []
  while (queue.length > 0) {
    const current = queue.shift()!
    sorted.push(current)

    for (const neighbor of adjacency.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) queue.push(neighbor)
    }
  }

  if (sorted.length !== workflow.nodes.length) {
    throw new Error('Workflow contains a cycle — cannot determine execution order')
  }

  return sorted
}

// ── Workflow Execution Engine ──

/**
 * Prompt the user for input in the terminal. Used by `human` nodes.
 */
function promptUser(message: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise<string>((resolve) => {
    rl.question(`  [human input] ${message}: `, (answer) => {
      resolve(answer.trim())
      rl.close()
    })
  })
}

/**
 * Interpolate template variables into a string.
 * Replaces {{varName}} with the value from the variables map.
 */
function interpolate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return variables[key] ?? `{{${key}}}`
  })
}

/**
 * Build context string from previous node results for injection into agent prompts.
 */
function buildNodeContext(results: Record<string, string>, workflow: Workflow, nodeId: string): string {
  // Find all predecessor nodes (nodes with edges pointing to this node)
  const predecessors = workflow.edges
    .filter(e => e.to === nodeId)
    .map(e => e.from)

  if (predecessors.length === 0) return ''

  const contextParts: string[] = ['Previous step results:']
  for (const predId of predecessors) {
    const predNode = workflow.nodes.find(n => n.id === predId)
    const result = results[predId]
    if (predNode && result) {
      const label = predNode.prompt?.slice(0, 60) ?? predNode.id
      contextParts.push(`- [${predId}] ${label}: ${result.slice(0, 500)}`)
    }
  }

  return contextParts.join('\n')
}

/**
 * Evaluate a condition expression against the current run state.
 * Supports simple comparisons on results and variables.
 */
function evaluateCondition(
  expression: string,
  results: Record<string, string>,
  variables: Record<string, string>,
): boolean {
  // Provide a safe evaluation context with results and variables
  // We use a simple pattern matcher rather than eval() for security
  //
  // Supported patterns:
  //   results.nodeId contains "text"
  //   results.nodeId === "text"
  //   variables.key === "value"
  //   results.nodeId.length > N

  const containsMatch = expression.match(/^results\.(\w+)\s+contains\s+"([^"]*)"$/)
  if (containsMatch) {
    const [, nodeId, text] = containsMatch
    return (results[nodeId] ?? '').includes(text)
  }

  const equalsResultMatch = expression.match(/^results\.(\w+)\s*===\s*"([^"]*)"$/)
  if (equalsResultMatch) {
    const [, nodeId, text] = equalsResultMatch
    return (results[nodeId] ?? '') === text
  }

  const equalsVarMatch = expression.match(/^variables\.(\w+)\s*===\s*"([^"]*)"$/)
  if (equalsVarMatch) {
    const [, key, value] = equalsVarMatch
    return (variables[key] ?? '') === value
  }

  const lengthMatch = expression.match(/^results\.(\w+)\.length\s*(>|<|>=|<=|===)\s*(\d+)$/)
  if (lengthMatch) {
    const [, nodeId, op, numStr] = lengthMatch
    const len = (results[nodeId] ?? '').length
    const num = parseInt(numStr, 10)
    switch (op) {
      case '>':   return len > num
      case '<':   return len < num
      case '>=':  return len >= num
      case '<=':  return len <= num
      case '===': return len === num
      default:    return false
    }
  }

  // Default: non-empty result from a node is truthy
  const simpleNodeMatch = expression.match(/^results\.(\w+)$/)
  if (simpleNodeMatch) {
    const [, nodeId] = simpleNodeMatch
    return (results[nodeId] ?? '').length > 0
  }

  printWarn(`Unknown condition expression: "${expression}" — defaulting to true`)
  return true
}

/**
 * Execute a single workflow node. Returns the result string.
 */
async function executeNode(
  node: WorkflowNode,
  workflow: Workflow,
  run: WorkflowRun,
  agentOpts: AgentOptions,
): Promise<string> {
  const allVars = { ...workflow.variables, ...run.results }
  const context = buildNodeContext(run.results, workflow, node.id)

  switch (node.type) {
    case 'agent': {
      const prompt = node.prompt ? interpolate(node.prompt, allVars) : `Execute node: ${node.id}`
      const fullPrompt = context
        ? `${context}\n\nYour task: ${prompt}`
        : prompt

      const response: AgentResponse = await runAgent(fullPrompt, {
        ...agentOpts,
        agent: node.agent ?? agentOpts.agent,
        skipPlanner: true,
      })
      return response.content
    }

    case 'tool': {
      if (!node.tool) throw new Error(`Tool node "${node.id}" has no tool specified`)
      const prompt = node.prompt ? interpolate(node.prompt, allVars) : `Use the ${node.tool} tool for: ${node.id}`
      const fullPrompt = context
        ? `${context}\n\nYour task: ${prompt}\n\nYou MUST use the "${node.tool}" tool to accomplish this.`
        : `${prompt}\n\nYou MUST use the "${node.tool}" tool to accomplish this.`

      const response: AgentResponse = await runAgent(fullPrompt, {
        ...agentOpts,
        skipPlanner: true,
      })
      return response.content
    }

    case 'condition': {
      if (!node.condition) throw new Error(`Condition node "${node.id}" has no condition specified`)
      const interpolatedCondition = interpolate(node.condition, allVars)
      const result = evaluateCondition(interpolatedCondition, run.results, workflow.variables)
      return result ? 'true' : 'false'
    }

    case 'parallel': {
      if (!node.children || node.children.length === 0) {
        throw new Error(`Parallel node "${node.id}" has no children`)
      }

      const childNodes = node.children
        .map(childId => workflow.nodes.find(n => n.id === childId))
        .filter((n): n is WorkflowNode => n !== undefined)

      if (childNodes.length === 0) {
        throw new Error(`Parallel node "${node.id}": none of the child IDs matched existing nodes`)
      }

      printInfo(`Running ${childNodes.length} nodes in parallel...`)
      const childResults = await Promise.all(
        childNodes.map(async (child) => {
          const childResult = await executeNode(child, workflow, run, agentOpts)
          run.results[child.id] = childResult
          return { id: child.id, result: childResult }
        }),
      )

      return childResults.map(r => `[${r.id}]: ${r.result.slice(0, 200)}`).join('\n')
    }

    case 'human': {
      const message = node.prompt
        ? interpolate(node.prompt, allVars)
        : `Input needed for step "${node.id}"`
      return await promptUser(message)
    }

    default:
      throw new Error(`Unknown node type: ${(node as WorkflowNode).type}`)
  }
}

/**
 * Execute a complete workflow through kbot's agent system.
 *
 * Walks the topologically-sorted node list. Parallel nodes execute their
 * children concurrently. Condition nodes branch based on expression evaluation.
 * Human nodes pause for user input.
 */
export async function executeWorkflow(
  workflow: Workflow,
  agentOpts: AgentOptions,
  variables?: Record<string, string>,
): Promise<WorkflowRun> {
  // Merge runtime variables into workflow variables
  const mergedWorkflow: Workflow = {
    ...workflow,
    variables: { ...workflow.variables, ...variables },
  }

  const run: WorkflowRun = {
    workflowId: workflow.id,
    status: 'running',
    currentNode: '',
    results: {},
    startedAt: new Date().toISOString(),
  }

  // Topological sort determines execution order
  const sortedIds = topologicalSort(mergedWorkflow)

  // Track which nodes have been executed (parallel children get executed early)
  const executed = new Set<string>()

  // Condition node results determine which branches to skip
  const skippedNodes = new Set<string>()

  printInfo(`Executing workflow: ${mergedWorkflow.name} (${sortedIds.length} nodes)`)

  for (const nodeId of sortedIds) {
    if (executed.has(nodeId) || skippedNodes.has(nodeId)) continue

    const node = mergedWorkflow.nodes.find(n => n.id === nodeId)
    if (!node) continue

    run.currentNode = nodeId
    const spinner = createSpinner(`[${node.type}] ${node.id}: ${node.prompt?.slice(0, 50) ?? '...'}`)
    spinner.start()

    let attempt = 0
    const maxAttempts = node.retryOnFail ? (node.maxRetries ?? 3) : 1
    let lastError: string | undefined

    while (attempt < maxAttempts) {
      attempt++
      try {
        const result = await executeNode(node, mergedWorkflow, run, agentOpts)
        run.results[nodeId] = result
        executed.add(nodeId)
        spinner.stop()
        printSuccess(`[${node.type}] ${nodeId}: done`)

        // Handle condition branching
        if (node.type === 'condition') {
          const conditionResult = result === 'true'
          // Edges from condition nodes use labels "true"/"false" to select branches
          const outEdges = mergedWorkflow.edges.filter(e => e.from === nodeId)
          for (const edge of outEdges) {
            const edgeIsTrue = edge.label === 'true' || edge.label === 'yes'
            const edgeIsFalse = edge.label === 'false' || edge.label === 'no'
            if ((conditionResult && edgeIsFalse) || (!conditionResult && edgeIsTrue)) {
              // Mark the skipped branch — find all downstream nodes reachable only via this edge
              markDownstream(mergedWorkflow, edge.to, nodeId, skippedNodes)
            }
          }
        }

        // If this is a parallel node, its children are already executed
        if (node.type === 'parallel' && node.children) {
          for (const childId of node.children) {
            executed.add(childId)
          }
        }

        lastError = undefined
        break
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
        spinner.stop()
        if (attempt < maxAttempts) {
          printWarn(`Node "${nodeId}" failed (attempt ${attempt}/${maxAttempts}): ${lastError}`)
          printInfo('Retrying...')
        }
      }
    }

    if (lastError) {
      spinner.stop()
      printError(`Node "${nodeId}" failed after ${maxAttempts} attempt(s): ${lastError}`)
      run.results[nodeId] = `ERROR: ${lastError}`
      run.status = 'failed'
      run.completedAt = new Date().toISOString()
      return run
    }
  }

  run.status = 'completed'
  run.currentNode = ''
  run.completedAt = new Date().toISOString()

  const totalNodes = workflow.nodes.length
  const executedCount = executed.size
  const skippedCount = skippedNodes.size
  printSuccess(`Workflow "${workflow.name}" completed: ${executedCount} executed, ${skippedCount} skipped (${totalNodes} total)`)

  return run
}

/**
 * Mark all nodes downstream of a given node as skipped, unless they are also
 * reachable from another non-skipped branch.
 */
function markDownstream(
  workflow: Workflow,
  startId: string,
  conditionNodeId: string,
  skippedNodes: Set<string>,
): void {
  // Simple BFS — mark reachable nodes as skipped.
  // A node is safe to skip only if ALL its incoming edges come from skipped nodes
  // or from the condition branch being pruned.
  const queue = [startId]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    // Check if this node has any incoming edges from non-skipped, non-condition sources
    const incomingEdges = workflow.edges.filter(e => e.to === current)
    const allIncomingFromSkipped = incomingEdges.every(e =>
      e.from === conditionNodeId || skippedNodes.has(e.from) || visited.has(e.from),
    )

    if (!allIncomingFromSkipped) continue  // Node is reachable from another live branch

    skippedNodes.add(current)

    // Continue downstream
    const outEdges = workflow.edges.filter(e => e.from === current)
    for (const edge of outEdges) {
      queue.push(edge.to)
    }
  }
}

// ── Plan-to-Workflow Conversion ──

/**
 * Convert kbot planner output (array of step descriptions) into a workflow graph.
 * Creates a linear chain of agent nodes with edges between sequential steps.
 */
export function planToWorkflow(planSteps: string[], name?: string): Workflow {
  const workflow = createWorkflow(
    name ?? 'Plan Workflow',
    `Auto-generated from ${planSteps.length} plan steps`,
  )

  let previousId: string | undefined

  for (let i = 0; i < planSteps.length; i++) {
    const nodeId = `step_${i + 1}`
    const step = planSteps[i]

    addNode(workflow, {
      id: nodeId,
      type: 'agent',
      agent: 'coder',
      prompt: step,
    })

    if (previousId) {
      addEdge(workflow, previousId, nodeId)
    }
    previousId = nodeId
  }

  return workflow
}

// ── Mermaid Export ──

/**
 * Export a workflow as a Mermaid diagram syntax for visualization.
 */
export function toMermaid(workflow: Workflow): string {
  const lines: string[] = ['graph TD']

  // Node shape by type
  const nodeShapes: Record<WorkflowNode['type'], [string, string]> = {
    agent:     ['[', ']'],
    tool:      ['[[', ']]'],
    condition: ['{', '}'],
    parallel:  ['{{', '}}'],
    human:     ['(', ')'],
  }

  // Render nodes
  for (const node of workflow.nodes) {
    const [open, close] = nodeShapes[node.type] ?? ['[', ']']
    const label = node.prompt?.slice(0, 40) ?? node.tool ?? node.agent ?? node.id
    const sanitized = label.replace(/"/g, "'").replace(/\n/g, ' ')
    lines.push(`  ${node.id}${open}"${node.type}: ${sanitized}"${close}`)
  }

  // Render edges
  for (const edge of workflow.edges) {
    if (edge.label) {
      lines.push(`  ${edge.from} -->|${edge.label}| ${edge.to}`)
    } else {
      lines.push(`  ${edge.from} --> ${edge.to}`)
    }
  }

  return lines.join('\n')
}

// ── Tool Integration ──

/**
 * Register workflow management tools for agent access.
 */
export function registerWorkflowTools(): void {
  registerTool({
    name: 'workflow_create',
    description: 'Create a new workflow with nodes and edges. Returns the workflow ID.',
    parameters: {
      name: { type: 'string', description: 'Workflow name', required: true },
      description: { type: 'string', description: 'Workflow description', required: true },
      nodes: {
        type: 'array',
        description: 'Array of workflow nodes. Each node: { id, type (agent|tool|condition|parallel|human), agent?, tool?, prompt?, condition?, children?, retryOnFail?, maxRetries? }',
        required: true,
        items: { type: 'object' },
      },
      edges: {
        type: 'array',
        description: 'Array of edges. Each edge: { from, to, label? }',
        items: { type: 'object' },
      },
      variables: {
        type: 'object',
        description: 'Template variables as key-value pairs',
      },
    },
    tier: 'pro',
    async execute(args) {
      const workflow = createWorkflow(String(args.name), String(args.description))

      // Add nodes
      if (Array.isArray(args.nodes)) {
        for (const rawNode of args.nodes) {
          const n = rawNode as Record<string, unknown>
          addNode(workflow, {
            id: String(n.id),
            type: String(n.type) as WorkflowNode['type'],
            agent: n.agent ? String(n.agent) : undefined,
            tool: n.tool ? String(n.tool) : undefined,
            prompt: n.prompt ? String(n.prompt) : undefined,
            condition: n.condition ? String(n.condition) : undefined,
            children: Array.isArray(n.children) ? n.children.map(String) : undefined,
            retryOnFail: n.retryOnFail === true,
            maxRetries: typeof n.maxRetries === 'number' ? n.maxRetries : undefined,
          })
        }
      }

      // Add edges
      if (Array.isArray(args.edges)) {
        for (const rawEdge of args.edges) {
          const e = rawEdge as Record<string, unknown>
          addEdge(workflow, String(e.from), String(e.to), e.label ? String(e.label) : undefined)
        }
      }

      // Merge variables
      if (args.variables && typeof args.variables === 'object') {
        for (const [k, v] of Object.entries(args.variables as Record<string, unknown>)) {
          workflow.variables[k] = String(v)
        }
      }

      const filePath = await saveWorkflow(workflow)
      return `Workflow "${workflow.name}" created (${workflow.nodes.length} nodes, ${workflow.edges.length} edges). ID: ${workflow.id}\nSaved to: ${filePath}`
    },
  })

  registerTool({
    name: 'workflow_run',
    description: 'Execute a saved workflow by ID. Runs all nodes in topological order.',
    parameters: {
      id: { type: 'string', description: 'Workflow ID to execute', required: true },
      variables: {
        type: 'object',
        description: 'Runtime variables to override workflow defaults',
      },
    },
    tier: 'pro',
    async execute(args) {
      const workflow = await loadWorkflow(String(args.id))
      const variables = args.variables
        ? Object.fromEntries(
            Object.entries(args.variables as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
          )
        : undefined

      const run = await executeWorkflow(workflow, { skipPlanner: true }, variables)

      const resultLines = [
        `Workflow: ${workflow.name}`,
        `Status: ${run.status}`,
        `Duration: ${run.completedAt ? `${(new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000}s` : 'unknown'}`,
        '',
        'Node results:',
      ]
      for (const [nodeId, result] of Object.entries(run.results)) {
        resultLines.push(`  [${nodeId}]: ${result.slice(0, 200)}`)
      }

      return resultLines.join('\n')
    },
  })

  registerTool({
    name: 'workflow_list',
    description: 'List all saved workflows with their names, descriptions, and last updated timestamps.',
    parameters: {},
    tier: 'pro',
    async execute() {
      const workflows = await listWorkflows()
      if (workflows.length === 0) return 'No workflows saved.'

      const lines = workflows.map(wf =>
        `- ${wf.name} (${wf.id})\n  ${wf.description}\n  Updated: ${wf.updatedAt}`,
      )
      return `${workflows.length} workflow(s):\n\n${lines.join('\n\n')}`
    },
  })
}
