// kbot Agent Create — Interactive agent builder
//
// Creates persistent custom agent definitions saved as SOUL.md-compatible
// markdown files in ~/.kbot/agents/. Agents can be invoked with --agent flag.
//
// Usage:
//   kbot agent create                              # Interactive mode
//   kbot agent create --name mybot --specialty "code review" --tone professional --model auto

import { createInterface } from 'node:readline'
import { join } from 'node:path'
import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync } from 'node:fs'
import chalk from 'chalk'
import { KBOT_DIR } from './auth.js'

// ── Constants ──

const AGENTS_DIR = join(KBOT_DIR, 'agents')

const VALID_TONES = ['professional', 'casual', 'technical', 'friendly'] as const
type Tone = typeof VALID_TONES[number]

const VALID_MODELS = ['auto', 'local', 'claude', 'gpt'] as const
type Model = typeof VALID_MODELS[number]

// ── Types ──

export interface AgentCreateArgs {
  name?: string
  specialty?: string
  tone?: string
  model?: string
}

interface AgentDefinition {
  name: string
  id: string
  specialty: string
  tone: Tone
  model: Model
  createdAt: string
}

// ── Helpers ──

/** Slugify a name to a filesystem-safe ID */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Ask a question via readline and return the answer */
function ask(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, resolve))
}

/** Validate tone, returning normalized value or null */
function validateTone(input: string): Tone | null {
  const normalized = input.toLowerCase().trim()
  if (VALID_TONES.includes(normalized as Tone)) return normalized as Tone
  return null
}

/** Validate model, returning normalized value or null */
function validateModel(input: string): Model | null {
  const normalized = input.toLowerCase().trim()
  if (VALID_MODELS.includes(normalized as Model)) return normalized as Model
  return null
}

/** Generate a tone instruction for the system prompt */
function toneInstruction(tone: Tone): string {
  switch (tone) {
    case 'professional':
      return 'Communicate in a clear, professional manner. Be precise and thorough. Avoid slang or overly casual language.'
    case 'casual':
      return 'Be conversational and approachable. Use natural language, contractions, and a relaxed tone. Still be helpful and accurate.'
    case 'technical':
      return 'Be highly technical and detailed. Use precise terminology, include relevant technical context, and assume the user has domain expertise.'
    case 'friendly':
      return 'Be warm, encouraging, and supportive. Explain things clearly, celebrate progress, and make the interaction feel collaborative.'
  }
}

/** Generate a model instruction for the agent definition */
function modelInstruction(model: Model): string {
  switch (model) {
    case 'auto':
      return 'Use the best available model based on task complexity.'
    case 'local':
      return 'Prefer local models (Ollama, LM Studio, embedded) for $0 cost.'
    case 'claude':
      return 'Use Anthropic Claude models (Sonnet for speed, Opus for quality).'
    case 'gpt':
      return 'Use OpenAI GPT models (GPT-4o for quality, GPT-4o-mini for speed).'
  }
}

// ── SOUL.md Generation ──

function generateAgentMd(def: AgentDefinition): string {
  return `# SOUL.md — ${def.name}

## Identity

- **Name**: ${def.name}
- **ID**: ${def.id}
- **Type**: Custom kbot agent
- **Created**: ${def.createdAt}

## Specialty

${def.specialty}

## System Prompt

You are ${def.name}, a kbot specialist agent focused on: ${def.specialty}.

${toneInstruction(def.tone)}

When working:
- Stay focused on your specialty area
- Use available tools to take action, not just advise
- If a task falls outside your specialty, say so clearly
- Build on previous context within the session
- Be concise — respect the user's time

## Model Preference

${modelInstruction(def.model)}

## Configuration

\`\`\`json
{
  "name": "${def.name}",
  "id": "${def.id}",
  "specialty": "${def.specialty}",
  "tone": "${def.tone}",
  "model": "${def.model}",
  "createdAt": "${def.createdAt}"
}
\`\`\`
`
}

// ── Interactive Mode ──

async function interactiveCreate(): Promise<AgentDefinition | null> {
  const DIM = chalk.dim
  const ACCENT = chalk.hex('#A78BFA')
  const CYAN = chalk.hex('#67E8F9')

  console.log()
  console.log(`  ${ACCENT('◉')} ${chalk.bold('kbot Agent Builder')}`)
  console.log(`  ${DIM('─'.repeat(40))}`)
  console.log()

  const rl = createInterface({ input: process.stdin, output: process.stdout })

  try {
    // Name
    const nameRaw = await ask(rl, `  ${CYAN('Agent name:')} `)
    const name = nameRaw.trim()
    if (!name) {
      console.log(`  ${chalk.hex('#F87171')('✗')} Name is required.`)
      return null
    }

    const id = slugify(name)
    const agentPath = join(AGENTS_DIR, `${id}.md`)
    if (existsSync(agentPath)) {
      console.log(`  ${chalk.hex('#F87171')('✗')} Agent "${id}" already exists at ${DIM(agentPath)}`)
      return null
    }

    // Specialty
    const specialty = (await ask(rl, `  ${CYAN('What should this agent specialize in?')} `)).trim()
    if (!specialty) {
      console.log(`  ${chalk.hex('#F87171')('✗')} Specialty is required.`)
      return null
    }

    // Tone
    let tone: Tone | null = null
    while (!tone) {
      const toneRaw = await ask(rl, `  ${CYAN('What tone?')} ${DIM('(professional, casual, technical, friendly)')} `)
      tone = validateTone(toneRaw || 'professional')
      if (!tone) {
        console.log(`  ${chalk.hex('#FBBF24')('⚠')} Pick one: professional, casual, technical, friendly`)
      }
    }

    // Model
    let model: Model | null = null
    while (!model) {
      const modelRaw = await ask(rl, `  ${CYAN('What model?')} ${DIM('(auto, local, claude, gpt)')} `)
      model = validateModel(modelRaw || 'auto')
      if (!model) {
        console.log(`  ${chalk.hex('#FBBF24')('⚠')} Pick one: auto, local, claude, gpt`)
      }
    }

    return {
      name,
      id,
      specialty,
      tone,
      model,
      createdAt: new Date().toISOString(),
    }
  } finally {
    rl.close()
  }
}

// ── Main ──

export async function runAgentCreate(args: AgentCreateArgs = {}): Promise<void> {
  const DIM = chalk.dim
  const GREEN = chalk.hex('#4ADE80')
  const RED = chalk.hex('#F87171')

  let def: AgentDefinition | null

  // If all required args provided, skip interactive mode
  if (args.name && args.specialty) {
    const id = slugify(args.name)
    const agentPath = join(AGENTS_DIR, `${id}.md`)

    if (existsSync(agentPath)) {
      console.log(`  ${RED('✗')} Agent "${id}" already exists at ${DIM(agentPath)}`)
      return
    }

    const tone = validateTone(args.tone || 'professional')
    if (!tone) {
      console.log(`  ${RED('✗')} Invalid tone "${args.tone}". Choose: ${VALID_TONES.join(', ')}`)
      return
    }

    const model = validateModel(args.model || 'auto')
    if (!model) {
      console.log(`  ${RED('✗')} Invalid model "${args.model}". Choose: ${VALID_MODELS.join(', ')}`)
      return
    }

    def = {
      name: args.name,
      id,
      specialty: args.specialty,
      tone,
      model,
      createdAt: new Date().toISOString(),
    }
  } else {
    // Interactive mode
    def = await interactiveCreate()
  }

  if (!def) return

  // Ensure agents directory exists
  if (!existsSync(AGENTS_DIR)) {
    mkdirSync(AGENTS_DIR, { recursive: true })
  }

  // Write agent definition
  const agentPath = join(AGENTS_DIR, `${def.id}.md`)
  const content = generateAgentMd(def)
  writeFileSync(agentPath, content, 'utf-8')

  // Print success
  console.log()
  console.log(`  ${GREEN('✓')} Agent '${def.name}' created.`)
  console.log(`  ${DIM('Saved to:')} ${DIM(agentPath)}`)
  console.log()
  console.log(`  ${DIM('Use with:')} ${chalk.white(`kbot --agent ${def.id}`)}`)
  console.log()
}

/** List all custom agents in ~/.kbot/agents/ */
export function listCustomAgents(): { id: string; name: string; specialty: string }[] {
  if (!existsSync(AGENTS_DIR)) return []

  const agents: { id: string; name: string; specialty: string }[] = []

  try {
    const files = readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md'))
    for (const file of files) {
      const id = file.replace(/\.md$/, '')
      const content = readFileSync(join(AGENTS_DIR, file), 'utf-8')

      // Extract name from "# SOUL.md — Name" header
      const nameMatch = content.match(/^# SOUL\.md — (.+)$/m)
      const name = nameMatch ? nameMatch[1] : id

      // Extract specialty from the ## Specialty section
      const specialtyMatch = content.match(/## Specialty\n\n(.+)/m)
      const specialty = specialtyMatch ? specialtyMatch[1] : 'custom agent'

      agents.push({ id, name, specialty })
    }
  } catch {
    // Directory read failed — return empty
  }

  return agents
}
