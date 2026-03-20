// kbot LATS (Language Agent Tree Search) Planner
//
// Instead of linear plans, explores branching plans, evaluates partway
// through, and commits to the best path. Uses UCB1 for exploration vs
// exploitation balance.
//
// Core loop:
//   1. Generate 2-3 candidate actions per step (heuristic, no LLM)
//   2. Evaluate candidates using skill library + collective patterns + strategy history
//   3. Select best path via UCB1 (Upper Confidence Bound)
//   4. Execute the selected action
//   5. Backpropagate results — success raises ancestor values, failure lowers them
//
// Activation:
//   $ kbot --tree "refactor the auth system"

import { classifyTask, findPattern, type CachedPattern } from './learning.js'
import { retrieveSkills, type Skill } from './skill-library.js'
import { getCollectiveToolSequence } from './collective.js'
import { getHistoricalBestStrategy, selectStrategy } from './reasoning.js'
import { getSkillRatingSystem } from './skill-rating.js'
import { runAgent, type AgentOptions, type AgentResponse } from './agent.js'
import { executeTool, type ToolCall } from './tools/index.js'
import { gatherContext, formatContextForPrompt } from './context.js'
import { createSpinner, printInfo, printSuccess, printError, printWarn } from './ui.js'
import chalk from 'chalk'

const AMETHYST = chalk.hex('#6B5B95')

// ── Constants ──

const MAX_DEPTH = 5
const MAX_WIDTH = 3
const DEFAULT_EXPLORATION_CONSTANT = 1.41 // sqrt(2), standard UCB1
const MIN_VALUE = 0.01
const MAX_VALUE = 0.99

// ── Types ──

export interface PlanNode {
  id: string
  parentId: string | null
  depth: number
  action: string           // description of what this step does
  toolHint: string         // which tool to use
  value: number            // estimated success (0-1)
  visits: number           // how many times explored
  children: string[]       // child node IDs
  status: 'pending' | 'executing' | 'success' | 'failure'
}

export interface PlanTree {
  root: string             // root node ID
  nodes: Record<string, PlanNode>
  bestPath: string[]       // IDs of the current best path
  explorationConstant: number // UCB1 constant (default 1.41)
}

// ── Internal helpers ──

let nodeCounter = 0

function generateNodeId(): string {
  return `lats_${Date.now().toString(36)}_${(nodeCounter++).toString(36)}`
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

// ── Task classification → generic approach templates ──

interface ApproachTemplate {
  name: string
  steps: Array<{ action: string; toolHint: string }>
}

const APPROACH_TEMPLATES: Record<string, ApproachTemplate[]> = {
  debug: [
    {
      name: 'read-grep-fix',
      steps: [
        { action: 'Read error logs and stack traces', toolHint: 'bash' },
        { action: 'Grep codebase for error source', toolHint: 'grep' },
        { action: 'Read the offending file', toolHint: 'read_file' },
        { action: 'Apply targeted fix', toolHint: 'edit_file' },
        { action: 'Verify fix compiles', toolHint: 'bash' },
      ],
    },
    {
      name: 'reproduce-isolate-fix',
      steps: [
        { action: 'Reproduce the error in isolation', toolHint: 'bash' },
        { action: 'Add diagnostic logging', toolHint: 'edit_file' },
        { action: 'Run again and analyze output', toolHint: 'bash' },
        { action: 'Apply root-cause fix', toolHint: 'edit_file' },
        { action: 'Run tests to confirm', toolHint: 'bash' },
      ],
    },
    {
      name: 'bisect-and-revert',
      steps: [
        { action: 'Check git log for recent changes', toolHint: 'bash' },
        { action: 'Identify suspect commits', toolHint: 'bash' },
        { action: 'Diff suspect commit', toolHint: 'bash' },
        { action: 'Revert or fix the breaking change', toolHint: 'edit_file' },
        { action: 'Verify with tests', toolHint: 'bash' },
      ],
    },
  ],
  build: [
    {
      name: 'scaffold-write-test',
      steps: [
        { action: 'Analyze project structure and conventions', toolHint: 'glob' },
        { action: 'Create new file(s) with scaffolded code', toolHint: 'write_file' },
        { action: 'Wire up imports and exports', toolHint: 'edit_file' },
        { action: 'Write tests for new code', toolHint: 'write_file' },
        { action: 'Build and verify', toolHint: 'bash' },
      ],
    },
    {
      name: 'prototype-iterate',
      steps: [
        { action: 'Study existing patterns in codebase', toolHint: 'read_file' },
        { action: 'Write minimal prototype', toolHint: 'write_file' },
        { action: 'Test prototype manually', toolHint: 'bash' },
        { action: 'Iterate: refine and complete', toolHint: 'edit_file' },
        { action: 'Add tests and documentation', toolHint: 'write_file' },
      ],
    },
    {
      name: 'plan-implement-integrate',
      steps: [
        { action: 'Read related modules for API surface', toolHint: 'read_file' },
        { action: 'Design the interface and types', toolHint: 'write_file' },
        { action: 'Implement core logic', toolHint: 'write_file' },
        { action: 'Integrate with existing code', toolHint: 'edit_file' },
        { action: 'Run full test suite', toolHint: 'bash' },
      ],
    },
  ],
  refactor: [
    {
      name: 'read-restructure-verify',
      steps: [
        { action: 'Read and map the code to refactor', toolHint: 'read_file' },
        { action: 'Extract common patterns', toolHint: 'edit_file' },
        { action: 'Apply structural changes', toolHint: 'edit_file' },
        { action: 'Update imports and references', toolHint: 'edit_file' },
        { action: 'Run type-check and tests', toolHint: 'bash' },
      ],
    },
    {
      name: 'incremental-refactor',
      steps: [
        { action: 'Identify all code to refactor', toolHint: 'grep' },
        { action: 'Refactor first occurrence as template', toolHint: 'edit_file' },
        { action: 'Apply pattern to remaining occurrences', toolHint: 'edit_file' },
        { action: 'Clean up unused code', toolHint: 'edit_file' },
        { action: 'Verify nothing broke', toolHint: 'bash' },
      ],
    },
  ],
  test: [
    {
      name: 'read-write-run',
      steps: [
        { action: 'Read the code under test', toolHint: 'read_file' },
        { action: 'Write test file with happy path tests', toolHint: 'write_file' },
        { action: 'Add edge case and error tests', toolHint: 'edit_file' },
        { action: 'Run tests', toolHint: 'bash' },
        { action: 'Fix any failures and re-run', toolHint: 'bash' },
      ],
    },
  ],
  search: [
    {
      name: 'grep-read-summarize',
      steps: [
        { action: 'Search codebase with grep', toolHint: 'grep' },
        { action: 'Read matching files for context', toolHint: 'read_file' },
        { action: 'Synthesize findings', toolHint: 'bash' },
      ],
    },
    {
      name: 'glob-tree-read',
      steps: [
        { action: 'Map directory structure', toolHint: 'glob' },
        { action: 'Read key files', toolHint: 'read_file' },
        { action: 'Report findings', toolHint: 'bash' },
      ],
    },
  ],
  deploy: [
    {
      name: 'check-build-deploy',
      steps: [
        { action: 'Check current status (git, tests)', toolHint: 'bash' },
        { action: 'Run full build', toolHint: 'bash' },
        { action: 'Run test suite', toolHint: 'bash' },
        { action: 'Deploy to target environment', toolHint: 'bash' },
        { action: 'Verify deployment', toolHint: 'bash' },
      ],
    },
  ],
  general: [
    {
      name: 'explore-analyze-act',
      steps: [
        { action: 'Explore project context', toolHint: 'glob' },
        { action: 'Read relevant files', toolHint: 'read_file' },
        { action: 'Analyze and plan approach', toolHint: 'bash' },
        { action: 'Execute primary action', toolHint: 'bash' },
        { action: 'Verify results', toolHint: 'bash' },
      ],
    },
    {
      name: 'search-understand-respond',
      steps: [
        { action: 'Search for relevant code', toolHint: 'grep' },
        { action: 'Read key files', toolHint: 'read_file' },
        { action: 'Formulate response or action', toolHint: 'bash' },
      ],
    },
  ],
  explain: [
    {
      name: 'read-trace-explain',
      steps: [
        { action: 'Read the code in question', toolHint: 'read_file' },
        { action: 'Trace call chain and dependencies', toolHint: 'grep' },
        { action: 'Read dependent files', toolHint: 'read_file' },
      ],
    },
  ],
  review: [
    {
      name: 'diff-read-analyze',
      steps: [
        { action: 'Get git diff of changes', toolHint: 'bash' },
        { action: 'Read changed files in full', toolHint: 'read_file' },
        { action: 'Check for common issues', toolHint: 'grep' },
        { action: 'Run type-check', toolHint: 'bash' },
        { action: 'Run tests', toolHint: 'bash' },
      ],
    },
  ],
}

// ── Value estimation heuristics ──

/**
 * Estimate the success likelihood of an approach based on available signals.
 * Returns a value between 0 and 1.
 *
 * Signals used:
 *   - Skill library match (proven tool sequences)
 *   - Collective patterns (community-aggregated sequences)
 *   - Historical strategy outcomes
 *   - Bayesian skill ratings (agent proficiency for the task category)
 */
function estimateValue(
  action: string,
  toolHint: string,
  taskType: string,
  matchedSkills: Skill[],
  collectiveSequence: string[] | null,
  historicalStrategy: string | null,
  approachName: string,
): number {
  let value = 0.5 // baseline
  let signals = 0

  // Signal 1: Skill library — does this tool appear in proven skill steps?
  for (const skill of matchedSkills) {
    const toolMatch = skill.steps.some(s => s.tool === toolHint)
    if (toolMatch) {
      const reliability = skill.successCount / Math.max(1, skill.successCount + skill.failureCount)
      value += reliability * 0.15
      signals++
    }
    // Check if the action description matches the skill description
    const actionWords = new Set(action.toLowerCase().split(/\s+/).filter(w => w.length > 2))
    const descWords = new Set(skill.description.toLowerCase().split(/\s+/).filter(w => w.length > 2))
    const overlap = [...actionWords].filter(w => descWords.has(w)).length
    if (overlap > 2) {
      value += 0.1
      signals++
    }
  }

  // Signal 2: Collective patterns — does this tool appear in community-proven sequences?
  if (collectiveSequence) {
    if (collectiveSequence.includes(toolHint)) {
      value += 0.12
      signals++
    }
  }

  // Signal 3: Historical strategy match — does the approach name match the best strategy?
  if (historicalStrategy) {
    // Fuzzy match: check if the approach name shares words with the historical strategy
    const approachWords = new Set(approachName.toLowerCase().split('-'))
    const stratWords = new Set(historicalStrategy.toLowerCase().split(/[\s-]+/))
    const overlap = [...approachWords].filter(w => stratWords.has(w)).length
    if (overlap > 0) {
      value += 0.1 * overlap
      signals++
    }
  }

  // Signal 4: Bayesian skill ratings — does this tool type align with strong agents?
  try {
    const skillRating = getSkillRatingSystem()
    const category = skillRating.categorizeMessage(`${action} ${toolHint}`)
    const ranked = skillRating.getRankedAgents(category)
    if (ranked.length > 0 && ranked[0].confidence > 0.3) {
      // High-confidence routing available = higher value (we know who to route to)
      value += 0.08
      signals++
    }
  } catch {
    // Non-critical — skill rating might not be available
  }

  // If no signals found, apply a small penalty for unknown territory
  if (signals === 0) {
    value -= 0.1
  }

  return clamp(value, MIN_VALUE, MAX_VALUE)
}

// ── Core LATS functions ──

/**
 * Create a plan tree for a task.
 * Generates the root node + first-level branches (2-3 alternative approaches).
 */
export async function createPlanTree(
  task: string,
  context?: string,
): Promise<PlanTree> {
  const taskType = classifyTask(task)

  // Gather signals for value estimation
  const matchedSkills = await retrieveSkills(task, 5)
  const collectiveSequence = getCollectiveToolSequence(taskType)
  const historicalStrategy = getHistoricalBestStrategy(taskType)

  // Check for cached patterns
  const cachedPattern = findPattern(task)

  // Get approach templates for this task type
  const templates = APPROACH_TEMPLATES[taskType] || APPROACH_TEMPLATES['general']

  // If we have a cached pattern, create a dedicated approach from it
  const approaches: ApproachTemplate[] = []

  if (cachedPattern && cachedPattern.successRate > 0.5) {
    approaches.push({
      name: 'cached-pattern',
      steps: cachedPattern.toolSequence.map((tool, i) => ({
        action: `Step ${i + 1}: Execute ${tool} (proven pattern, ${cachedPattern.hits}x success)`,
        toolHint: tool,
      })),
    })
  }

  // Add template approaches (limit total to MAX_WIDTH)
  for (const tmpl of templates) {
    if (approaches.length >= MAX_WIDTH) break
    approaches.push(tmpl)
  }

  // If we still don't have enough, add from general
  if (approaches.length < 2 && taskType !== 'general') {
    for (const tmpl of APPROACH_TEMPLATES['general']) {
      if (approaches.length >= MAX_WIDTH) break
      if (!approaches.find(a => a.name === tmpl.name)) {
        approaches.push(tmpl)
      }
    }
  }

  // Create root node
  const rootId = generateNodeId()
  const rootNode: PlanNode = {
    id: rootId,
    parentId: null,
    depth: 0,
    action: task,
    toolHint: '',
    value: 0.5,
    visits: 0,
    children: [],
    status: 'pending',
  }

  const tree: PlanTree = {
    root: rootId,
    nodes: { [rootId]: rootNode },
    bestPath: [rootId],
    explorationConstant: DEFAULT_EXPLORATION_CONSTANT,
  }

  // Create first-level branches — one per approach
  for (const approach of approaches) {
    if (approach.steps.length === 0) continue

    const firstStep = approach.steps[0]
    const childId = generateNodeId()
    const childValue = estimateValue(
      firstStep.action,
      firstStep.toolHint,
      taskType,
      matchedSkills,
      collectiveSequence,
      historicalStrategy,
      approach.name,
    )

    const childNode: PlanNode = {
      id: childId,
      parentId: rootId,
      depth: 1,
      action: `[${approach.name}] ${firstStep.action}`,
      toolHint: firstStep.toolHint,
      value: childValue,
      visits: 0,
      children: [],
      status: 'pending',
    }

    tree.nodes[childId] = childNode
    rootNode.children.push(childId)

    // Pre-populate subsequent steps as deeper nodes if within depth limit
    let currentParentId = childId
    for (let i = 1; i < approach.steps.length && i < MAX_DEPTH; i++) {
      const step = approach.steps[i]
      const stepId = generateNodeId()
      const stepValue = estimateValue(
        step.action,
        step.toolHint,
        taskType,
        matchedSkills,
        collectiveSequence,
        historicalStrategy,
        approach.name,
      )

      const stepNode: PlanNode = {
        id: stepId,
        parentId: currentParentId,
        depth: i + 1,
        action: step.action,
        toolHint: step.toolHint,
        value: stepValue,
        visits: 0,
        children: [],
        status: 'pending',
      }

      tree.nodes[stepId] = stepNode
      tree.nodes[currentParentId].children.push(stepId)
      currentParentId = stepId
    }
  }

  // Compute initial best path
  tree.bestPath = selectBestPath(tree)

  return tree
}

/**
 * Expand a node by generating child alternatives for its next step.
 * Uses the same heuristic approach as createPlanTree but adapted for mid-plan branching.
 */
export async function expandNode(
  tree: PlanTree,
  nodeId: string,
): Promise<string[]> {
  const node = tree.nodes[nodeId]
  if (!node) return []
  if (node.depth >= MAX_DEPTH) return []
  if (node.children.length >= MAX_WIDTH) return []

  const taskType = classifyTask(node.action)
  const matchedSkills = await retrieveSkills(node.action, 3)
  const collectiveSequence = getCollectiveToolSequence(taskType)
  const historicalStrategy = getHistoricalBestStrategy(taskType)

  // Generate candidate next actions based on what tools typically follow the current tool
  const nextToolCandidates = getNextToolCandidates(node.toolHint, taskType)

  const newChildren: string[] = []

  for (const candidate of nextToolCandidates) {
    if (node.children.length + newChildren.length >= MAX_WIDTH) break

    const childId = generateNodeId()
    const childValue = estimateValue(
      candidate.action,
      candidate.toolHint,
      taskType,
      matchedSkills,
      collectiveSequence,
      historicalStrategy,
      `expand-${node.toolHint}`,
    )

    const childNode: PlanNode = {
      id: childId,
      parentId: nodeId,
      depth: node.depth + 1,
      action: candidate.action,
      toolHint: candidate.toolHint,
      value: childValue,
      visits: 0,
      children: [],
      status: 'pending',
    }

    tree.nodes[childId] = childNode
    newChildren.push(childId)
  }

  node.children.push(...newChildren)
  return newChildren
}

/**
 * Get candidate next tools based on what typically follows a given tool.
 * This encodes common tool-chain patterns without LLM calls.
 */
function getNextToolCandidates(
  currentTool: string,
  taskType: string,
): Array<{ action: string; toolHint: string }> {
  // Common tool transitions
  const transitions: Record<string, Array<{ action: string; toolHint: string }>> = {
    glob: [
      { action: 'Read files found by search', toolHint: 'read_file' },
      { action: 'Search within matched files', toolHint: 'grep' },
    ],
    grep: [
      { action: 'Read file with match', toolHint: 'read_file' },
      { action: 'Edit the matched code', toolHint: 'edit_file' },
      { action: 'Search for related patterns', toolHint: 'grep' },
    ],
    read_file: [
      { action: 'Edit based on analysis', toolHint: 'edit_file' },
      { action: 'Search for related code', toolHint: 'grep' },
      { action: 'Run command based on findings', toolHint: 'bash' },
    ],
    edit_file: [
      { action: 'Verify changes compile', toolHint: 'bash' },
      { action: 'Read edited file to confirm', toolHint: 'read_file' },
      { action: 'Edit another related file', toolHint: 'edit_file' },
    ],
    write_file: [
      { action: 'Verify new file compiles', toolHint: 'bash' },
      { action: 'Wire up imports in existing code', toolHint: 'edit_file' },
      { action: 'Read new file to confirm', toolHint: 'read_file' },
    ],
    bash: [
      { action: 'Read output files', toolHint: 'read_file' },
      { action: 'Fix issues found by command', toolHint: 'edit_file' },
      { action: 'Run follow-up command', toolHint: 'bash' },
    ],
  }

  const candidates = transitions[currentTool] || transitions['bash'] || []

  // Also add task-type-specific candidates
  if (taskType === 'debug' && currentTool !== 'grep') {
    candidates.push({ action: 'Search for error origin', toolHint: 'grep' })
  }
  if (taskType === 'test' && currentTool !== 'bash') {
    candidates.push({ action: 'Run test suite', toolHint: 'bash' })
  }

  return candidates.slice(0, MAX_WIDTH)
}

// ── UCB1 Selection ──

/**
 * Compute the UCB1 score for a node.
 *
 * UCB1 = value + C * sqrt(ln(parent_visits) / visits)
 *
 * Unvisited nodes get Infinity to ensure they're explored first.
 */
function ucb1Score(node: PlanNode, parentVisits: number, C: number): number {
  if (node.visits === 0) return Infinity
  const exploitation = node.value
  const exploration = C * Math.sqrt(Math.log(parentVisits) / node.visits)
  return exploitation + exploration
}

/**
 * Select the best path from root to leaf using UCB1.
 * At each level, picks the child with the highest UCB1 score.
 */
export function selectBestPath(tree: PlanTree): string[] {
  const path: string[] = [tree.root]
  let currentId = tree.root

  while (true) {
    const node = tree.nodes[currentId]
    if (!node || node.children.length === 0) break

    // Pick child with highest UCB1 score
    let bestChild: string | null = null
    let bestScore = -Infinity

    for (const childId of node.children) {
      const child = tree.nodes[childId]
      if (!child) continue

      const score = ucb1Score(child, Math.max(1, node.visits), tree.explorationConstant)
      if (score > bestScore) {
        bestScore = score
        bestChild = childId
      }
    }

    if (!bestChild) break
    path.push(bestChild)
    currentId = bestChild
  }

  return path
}

// ── Backpropagation ──

/**
 * Backpropagate a reward up the tree from a leaf node.
 * Updates value and visit count for all ancestors.
 *
 * @param reward - 1.0 for success, 0.0 for failure, 0.5 for partial
 */
export function backpropagate(tree: PlanTree, leafId: string, reward: number): void {
  let currentId: string | null = leafId

  while (currentId) {
    const node: PlanNode | undefined = tree.nodes[currentId]
    if (!node) break

    node.visits++

    // Incremental mean update: value = value + (reward - value) / visits
    node.value = node.value + (reward - node.value) / node.visits

    // Clamp to valid range
    node.value = clamp(node.value, MIN_VALUE, MAX_VALUE)

    currentId = node.parentId
  }

  // Recompute best path after backpropagation
  tree.bestPath = selectBestPath(tree)
}

// ── Best plan extraction ──

/**
 * Get the highest-value complete path as a linear plan.
 * Returns the path with the highest average value from root to leaf.
 */
export function getBestPlan(tree: PlanTree): Array<{ action: string; toolHint: string; value: number }> {
  // Find all leaf nodes (nodes with no children)
  const leaves: string[] = []
  for (const [id, node] of Object.entries(tree.nodes)) {
    if (node.children.length === 0 && id !== tree.root) {
      leaves.push(id)
    }
  }

  if (leaves.length === 0) return []

  // For each leaf, trace back to root and compute average value
  let bestLeaf = ''
  let bestAvgValue = -Infinity

  for (const leafId of leaves) {
    let totalValue = 0
    let count = 0
    let currentId: string | null = leafId

    while (currentId && currentId !== tree.root) {
      const node: PlanNode | undefined = tree.nodes[currentId]
      if (!node) break
      totalValue += node.value
      count++
      currentId = node.parentId
    }

    const avgValue = count > 0 ? totalValue / count : 0
    if (avgValue > bestAvgValue) {
      bestAvgValue = avgValue
      bestLeaf = leafId
    }
  }

  if (!bestLeaf) return []

  // Trace from leaf to root to build the path
  const reversePath: Array<{ action: string; toolHint: string; value: number }> = []
  let currentId: string | null = bestLeaf

  while (currentId && currentId !== tree.root) {
    const node: PlanNode | undefined = tree.nodes[currentId]
    if (!node) break
    reversePath.push({
      action: node.action,
      toolHint: node.toolHint,
      value: node.value,
    })
    currentId = node.parentId
  }

  return reversePath.reverse()
}

// ── ASCII tree visualization ──

/**
 * Format the plan tree as an ASCII visualization for terminal display.
 */
export function formatTreeForDisplay(tree: PlanTree): string {
  const lines: string[] = []

  lines.push('')
  lines.push(`  ${AMETHYST('◆ LATS Plan Tree')}`)
  lines.push(`  ${chalk.dim('─'.repeat(60))}`)
  lines.push('')

  function renderNode(nodeId: string, prefix: string, isLast: boolean): void {
    const node = tree.nodes[nodeId]
    if (!node) return

    const connector = node.depth === 0 ? '  ' : (isLast ? '  └─ ' : '  ├─ ')
    const childPrefix = node.depth === 0 ? '  ' : (isLast ? '     ' : '  │  ')

    // Status icon
    const statusIcon = {
      pending: chalk.dim('○'),
      executing: chalk.yellow('●'),
      success: chalk.green('✓'),
      failure: chalk.red('✗'),
    }[node.status]

    // Value bar (visual indicator)
    const barLen = Math.round(node.value * 10)
    const bar = chalk.green('█'.repeat(barLen)) + chalk.dim('░'.repeat(10 - barLen))

    // Highlight if node is on the best path
    const isBest = tree.bestPath.includes(nodeId)
    const actionStr = isBest
      ? AMETHYST(node.action)
      : node.action

    const toolStr = node.toolHint ? chalk.cyan(` [${node.toolHint}]`) : ''
    const valueStr = chalk.dim(` v=${node.value.toFixed(2)} n=${node.visits}`)

    if (node.depth === 0) {
      lines.push(`${prefix}${statusIcon} ${actionStr}`)
      lines.push(`${prefix}  ${bar} ${valueStr}`)
    } else {
      lines.push(`${prefix}${connector}${statusIcon} ${actionStr}${toolStr}`)
      lines.push(`${prefix}${childPrefix}${bar} ${valueStr}`)
    }

    // Render children
    for (let i = 0; i < node.children.length; i++) {
      const childIsLast = i === node.children.length - 1
      renderNode(node.children[i], prefix + childPrefix, childIsLast)
    }
  }

  renderNode(tree.root, '', true)

  // Summary
  lines.push('')
  lines.push(`  ${chalk.dim('─'.repeat(60))}`)

  const totalNodes = Object.keys(tree.nodes).length
  const bestPlanSteps = getBestPlan(tree)
  const avgValue = bestPlanSteps.length > 0
    ? bestPlanSteps.reduce((s, p) => s + p.value, 0) / bestPlanSteps.length
    : 0

  lines.push(`  ${chalk.dim(`${totalNodes} nodes · ${bestPlanSteps.length} steps in best path · avg value: ${avgValue.toFixed(2)}`)}`)

  // Show best path summary
  if (bestPlanSteps.length > 0) {
    lines.push('')
    lines.push(`  ${AMETHYST('Best path:')}`)
    for (let i = 0; i < bestPlanSteps.length; i++) {
      const step = bestPlanSteps[i]
      const valueBar = chalk.green('█'.repeat(Math.round(step.value * 5)))
      lines.push(`  ${chalk.dim(`${i + 1}.`)} ${step.action} ${chalk.cyan(`[${step.toolHint}]`)} ${valueBar} ${chalk.dim(`${(step.value * 100).toFixed(0)}%`)}`)
    }
  }

  lines.push('')
  return lines.join('\n')
}

// ── Execution engine ──

/**
 * Execute the tree plan — selects the best path, runs each step,
 * backpropagates results, and adapts if steps fail.
 */
export async function executeTreePlan(
  task: string,
  agentOpts: AgentOptions,
): Promise<{ tree: PlanTree; success: boolean; summary: string }> {
  // Phase 1: Build the plan tree
  const spinner = createSpinner('Building LATS plan tree...')
  spinner.start()

  const context = gatherContext()
  const contextStr = formatContextForPrompt(context)
  const tree = await createPlanTree(task, contextStr)

  spinner.stop()

  // Display the tree
  console.log(formatTreeForDisplay(tree))

  // Phase 2: Execute along the best path
  printInfo('Executing best path...')
  const bestPlan = getBestPlan(tree)

  if (bestPlan.length === 0) {
    printWarn('No executable plan found in tree. Falling back to direct execution.')
    return {
      tree,
      success: false,
      summary: 'LATS could not generate a viable plan tree.',
    }
  }

  let stepsDone = 0
  let stepsFailed = 0

  // Walk the best path and match to tree node IDs for backpropagation
  const bestPathNodeIds = tree.bestPath.slice(1) // skip root

  for (let i = 0; i < bestPlan.length; i++) {
    const step = bestPlan[i]
    const nodeId = bestPathNodeIds[i]
    const node = nodeId ? tree.nodes[nodeId] : undefined

    if (node) node.status = 'executing'

    const stepSpinner = createSpinner(`Step ${i + 1}/${bestPlan.length}: ${step.action}`)
    stepSpinner.start()

    try {
      // Execute the step by routing to the agent
      const prompt = `You are executing step ${i + 1} of a plan to: "${task}"

This step: "${step.action}"
Suggested tool: ${step.toolHint}

Context: ${contextStr.slice(0, 500)}

Execute this step now using your tools. Be precise and verify your work.`

      const response = await runAgent(prompt, {
        ...agentOpts,
        skipPlanner: true,
      })

      stepSpinner.stop()
      printSuccess(`Step ${i + 1}: ${step.action}`)
      stepsDone++

      if (node) node.status = 'success'

      // Backpropagate success
      if (nodeId) {
        backpropagate(tree, nodeId, 1.0)
      }
    } catch (err) {
      stepSpinner.stop()
      const errorMsg = err instanceof Error ? err.message : String(err)
      printError(`Step ${i + 1} failed: ${errorMsg}`)
      stepsFailed++

      if (node) node.status = 'failure'

      // Backpropagate failure
      if (nodeId) {
        backpropagate(tree, nodeId, 0.0)
      }

      // Try to expand and find an alternative branch
      if (node && node.parentId) {
        printWarn('Searching for alternative approach...')
        const newChildren = await expandNode(tree, node.parentId)

        if (newChildren.length > 0) {
          // Re-select best path after expansion
          tree.bestPath = selectBestPath(tree)
          const newBestPlan = getBestPlan(tree)

          if (newBestPlan.length > i) {
            printInfo(`Found alternative: ${newBestPlan[i].action}`)
            // Continue with the new best plan from this point
            // Re-execute the current step with the alternative
            try {
              const altStep = newBestPlan[i]
              const altNodeId = newChildren[0]
              const altNode = tree.nodes[altNodeId]

              if (altNode) altNode.status = 'executing'

              const altPrompt = `Previous approach failed. Try alternative: "${altStep.action}"
Suggested tool: ${altStep.toolHint}
Task: "${task}"

Execute this step now.`

              await runAgent(altPrompt, {
                ...agentOpts,
                skipPlanner: true,
              })

              printSuccess(`Alternative succeeded: ${altStep.action}`)
              if (altNode) altNode.status = 'success'
              backpropagate(tree, altNodeId, 1.0)
              stepsFailed-- // Recovered
              stepsDone++
            } catch {
              printError('Alternative also failed. Continuing...')
              backpropagate(tree, newChildren[0], 0.0)
            }
          }
        }
      }

      // If too many consecutive failures, abort
      if (stepsFailed >= 3) {
        printError('Too many failures. Aborting tree execution.')
        break
      }
    }
  }

  // Phase 3: Summary
  const success = stepsFailed === 0
  const totalSteps = bestPlan.length

  console.log('')
  console.log(formatTreeForDisplay(tree))

  const summaryLines = [
    `LATS Plan: ${task}`,
    `Result: ${stepsDone}/${totalSteps} steps succeeded, ${stepsFailed} failed`,
    `Status: ${success ? 'COMPLETED' : 'PARTIAL'}`,
    '',
    'Best path:',
    ...bestPlan.map((s, i) => {
      const nodeId = bestPathNodeIds[i]
      const node = nodeId ? tree.nodes[nodeId] : undefined
      const status = node?.status ?? 'pending'
      const icon = { pending: '○', executing: '●', success: '✓', failure: '✗' }[status]
      return `  ${icon} ${i + 1}. ${s.action} [${s.toolHint}] (value: ${s.value.toFixed(2)})`
    }),
  ]

  const summary = summaryLines.join('\n')

  if (success) {
    printSuccess(`LATS plan complete: ${stepsDone}/${totalSteps} steps succeeded`)
  } else {
    printWarn(`LATS plan finished with errors: ${stepsDone} done, ${stepsFailed} failed`)
  }

  return { tree, success, summary }
}
