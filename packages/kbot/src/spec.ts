// kbot Spec — Spec-Driven Development
//
// Generates formal requirements + acceptance criteria before coding.
// Uses the architect agent to produce a structured specification document.
//
// Usage:
//   $ kbot spec "build a user authentication system"
//   $ kbot spec "add rate limiting" --implement
//   $ kbot spec "refactor the database layer" --agent researcher
//   $ kbot spec "notification service" --output ./specs/notifications.md

import { runAgent, type AgentOptions, type AgentResponse } from './agent.js'
import { gatherContext, formatContextForPrompt } from './context.js'
import { getRepoMapForContext } from './repo-map.js'
import { printInfo, printSuccess, printError, printWarn, createSpinner } from './ui.js'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import chalk from 'chalk'

const AMETHYST = chalk.hex('#6B5B95')

// ── System Prompt ──

const SPEC_SYSTEM_PROMPT = `You are a systems architect producing a formal specification document. Your output will be saved directly as a markdown file and used as the source of truth for implementation.

You MUST output a specification in EXACTLY this markdown format. Do not deviate from the structure. Do not add preamble or commentary outside the spec. Output ONLY the spec document:

\`\`\`
# Specification: [descriptive title derived from the task]

## Requirements
1. [REQ-001] [requirement written in EARS notation (Easy Approach to Requirements Syntax)]
2. [REQ-002] ...
(continue numbering sequentially)

## Acceptance Criteria
- [ ] [AC-001] [specific, testable criterion — must be verifiable by a human or automated test]
- [ ] [AC-002] ...
(continue numbering sequentially)

## Technical Design
- Architecture: [brief architectural approach — patterns, layers, data flow]
- Key files: [list of files to create or modify, with brief purpose]
- Dependencies: [external packages, internal modules, APIs needed]

## Implementation Plan
1. [concrete implementation step — ordered by dependency]
2. [next step]
...

## Risks
- [risk description] — Mitigation: [concrete mitigation strategy]
- ...
\`\`\`

Rules for writing specs:
1. Requirements MUST use EARS notation. Examples:
   - Ubiquitous: "The system shall [action]"
   - Event-driven: "When [trigger], the system shall [response]"
   - State-driven: "While [state], the system shall [behavior]"
   - Unwanted: "If [condition], then the system shall [reaction]"
   - Optional: "Where [feature is supported], the system shall [behavior]"
2. Each acceptance criterion MUST be independently testable — a developer should be able to write a test for it.
3. Requirements should be atomic — one concern per requirement.
4. The implementation plan should be ordered so each step builds on the previous.
5. Identify at least 2 risks and their mitigations.
6. Use the project context and repository structure to inform your technical design — reference real files and patterns in the codebase.
7. Do NOT wrap the spec in code fences. Output raw markdown directly.`

// ── Slug Generation ──

function slugify(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

// ── Spec Generation ──

export interface SpecOptions {
  /** Override the default architect agent */
  agent?: string
  /** Custom output path for the spec file */
  output?: string
  /** After generating the spec, pass it to the coder agent for implementation */
  implement?: boolean
  /** Base agent options (model, stream, etc.) */
  agentOpts?: AgentOptions
}

export interface SpecResult {
  /** The generated spec markdown content */
  spec: string
  /** Path where the spec was saved */
  path: string
  /** The agent that generated the spec */
  agent: string
  /** If --implement was used, the implementation response */
  implementation?: AgentResponse
}

export async function generateSpec(
  description: string,
  options: SpecOptions = {},
): Promise<SpecResult> {
  const agent = options.agent || 'architect'
  const agentOpts = options.agentOpts || {}

  // Gather project context for informed spec generation
  let contextStr = ''
  try {
    const context = gatherContext()
    contextStr = formatContextForPrompt(context)
  } catch { /* context is non-critical */ }

  let repoMap = ''
  try {
    repoMap = await getRepoMapForContext()
  } catch { /* repo map is non-critical */ }

  // Build the prompt — system instructions prepended, then the task
  const userMessage = [
    SPEC_SYSTEM_PROMPT,
    '',
    '---',
    '',
    contextStr ? `Project context:\n${contextStr}\n` : '',
    repoMap ? `Repository structure:\n${repoMap}\n` : '',
    `Task: ${description}`,
    '',
    'Generate the specification now:',
  ].filter(Boolean).join('\n')

  const spinner = createSpinner('Generating specification...')
  spinner.start()

  let response: AgentResponse
  try {
    response = await runAgent(userMessage, {
      ...agentOpts,
      agent,
      stream: false, // Don't stream — we need the full content for file saving
    })
    spinner.stop()
  } catch (err) {
    spinner.stop()
    throw err
  }

  let spec = response.content

  // Clean up: if the AI wrapped output in code fences, strip them
  const fenceMatch = spec.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/m)
  if (fenceMatch) {
    spec = fenceMatch[1]
  }

  // Determine output path
  const slug = slugify(description)
  const outputPath = options.output || join(process.cwd(), '.kbot', 'specs', `${slug}.md`)

  // Ensure directory exists
  const dir = dirname(outputPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  // Save the spec
  writeFileSync(outputPath, spec, 'utf-8')

  const result: SpecResult = {
    spec,
    path: outputPath,
    agent,
  }

  // Print the spec to stdout
  console.log()
  console.log(`  ${AMETHYST('Specification generated')}`)
  console.log(`  ${chalk.dim('─'.repeat(60))}`)
  console.log()
  console.log(spec)
  console.log()
  console.log(`  ${chalk.dim('─'.repeat(60))}`)
  printSuccess(`Saved to ${outputPath}`)
  console.log()

  // If --implement, pass the spec to the coder agent
  if (options.implement) {
    printInfo('Passing spec to coder agent for implementation...')
    console.log()

    const implementMessage = [
      'Implement the following specification. Follow the implementation plan exactly.',
      'Check off each acceptance criterion as you complete it.',
      'After implementation, run verification to confirm everything works.',
      '',
      '---',
      '',
      spec,
    ].join('\n')

    const implResponse = await runAgent(implementMessage, {
      ...agentOpts,
      agent: 'coder',
      stream: agentOpts.stream ?? true,
    })

    result.implementation = implResponse

    // Print implementation result if it wasn't streamed
    if (!implResponse.streamed) {
      console.log()
      console.log(implResponse.content)
    }

    console.log()
    printSuccess(`Implementation complete (${implResponse.toolCalls} tool calls)`)
  }

  return result
}
