// ─── Architecture Engine ────────────────────────────────────
//
// AI-powered system design and analysis engine.
// Capabilities:
//   - Analyze codebase descriptions → SystemDesign
//   - Design systems from requirements → SystemDesign
//   - Generate code from specifications → CodeGenResult
//   - Plan infrastructure → InfrastructurePlan
//   - Analyze component dependencies → Dependency[]
//
// All analysis is powered by Claude via ClaudeClient.

import { claudeJSON, claudeText } from './ClaudeClient'
import type {
  SystemDesign,
  ArchComponent,
  Dependency,
  DiagramSpec,
  InfrastructurePlan,
  CodeGenResult,
} from './architecture/types'

// ─── System Prompt ──────────────────────────────────────────

const ARCHITECT_SYSTEM = `You are a senior software architect. You analyze systems, design architectures, generate code, and plan infrastructure.

Your responses must be precise, production-ready, and follow modern best practices.

When generating Mermaid diagrams, use valid Mermaid.js syntax.
When generating code, use clean, typed, well-documented patterns.
When planning infrastructure, provide realistic cost estimates and clear deployment steps.

Always respond with valid JSON matching the requested schema.`

// ─── Helpers ────────────────────────────────────────────────

function generateId(): string {
  return `arch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// ─── Core Methods ───────────────────────────────────────────

/**
 * Analyze a codebase description and produce a SystemDesign
 * with components, dependencies, and diagrams.
 */
export async function analyzeCodebase(description: string): Promise<SystemDesign> {
  const prompt = `Analyze the following codebase/system description and produce a complete system design.

DESCRIPTION:
${description}

Respond with a JSON object matching this exact schema:
{
  "name": "string — system name",
  "description": "string — one-paragraph summary",
  "components": [
    {
      "id": "string — unique component id (e.g. 'svc_auth')",
      "name": "string — human-readable name",
      "type": "service | database | api | frontend | worker | queue | cache | storage",
      "description": "string — what this component does",
      "technologies": ["string — tech used (e.g. 'React', 'PostgreSQL')"],
      "interfaces": ["string — exposed interfaces (e.g. 'REST /api/users', 'WebSocket')"]
    }
  ],
  "dependencies": [
    {
      "from": "string — source component id",
      "to": "string — target component id",
      "type": "sync | async | data | event",
      "description": "string — what flows between them"
    }
  ],
  "diagrams": [
    {
      "type": "system | sequence | data_flow | deployment",
      "mermaid": "string — valid Mermaid.js diagram code"
    }
  ]
}

Include at least one system diagram and one data_flow diagram.`

  const result = await claudeJSON<Omit<SystemDesign, 'id' | 'created_at'>>(prompt, {
    system: ARCHITECT_SYSTEM,
    model: 'sonnet',
    max_tokens: 8192,
  })

  return {
    id: generateId(),
    created_at: new Date().toISOString(),
    ...result,
  }
}

/**
 * Design a complete system from requirements.
 * More opinionated than analyzeCodebase — generates recommended
 * architecture from scratch.
 */
export async function designSystem(requirements: string): Promise<SystemDesign> {
  const prompt = `Design a complete software system architecture from the following requirements.

REQUIREMENTS:
${requirements}

You must design the full architecture including:
1. All necessary components (services, databases, APIs, frontends, workers, caches, etc.)
2. Dependencies and data flows between components
3. Technology recommendations for each component
4. Mermaid diagrams showing the system architecture

Respond with a JSON object matching this exact schema:
{
  "name": "string — system name",
  "description": "string — one-paragraph summary of the architecture",
  "components": [
    {
      "id": "string — unique component id",
      "name": "string — human-readable name",
      "type": "service | database | api | frontend | worker | queue | cache | storage",
      "description": "string — component purpose and responsibilities",
      "technologies": ["string — recommended technologies"],
      "interfaces": ["string — exposed interfaces"]
    }
  ],
  "dependencies": [
    {
      "from": "string — source component id",
      "to": "string — target component id",
      "type": "sync | async | data | event",
      "description": "string — what data/control flows between them"
    }
  ],
  "diagrams": [
    {
      "type": "system | sequence | data_flow | deployment",
      "mermaid": "string — valid Mermaid.js diagram code"
    }
  ]
}

Include at least: one system overview diagram, one data_flow diagram, and one deployment diagram.`

  const result = await claudeJSON<Omit<SystemDesign, 'id' | 'created_at'>>(prompt, {
    system: ARCHITECT_SYSTEM,
    model: 'sonnet',
    max_tokens: 8192,
  })

  return {
    id: generateId(),
    created_at: new Date().toISOString(),
    ...result,
  }
}

/**
 * Generate code files from a specification.
 * Returns file paths, contents, and a summary of what was generated.
 */
export async function generateCode(spec: string, language: string): Promise<CodeGenResult> {
  const prompt = `Generate production-ready code from the following specification.

SPECIFICATION:
${spec}

TARGET LANGUAGE: ${language}

Generate clean, well-documented, typed code. Split into logical files.

Respond with a JSON object matching this schema:
{
  "files": [
    {
      "path": "string — relative file path (e.g. 'src/services/auth.ts')",
      "content": "string — full file content",
      "language": "string — file language (e.g. 'typescript', 'python')"
    }
  ],
  "summary": "string — brief summary of what was generated and how the files relate"
}`

  return await claudeJSON<CodeGenResult>(prompt, {
    system: ARCHITECT_SYSTEM,
    model: 'sonnet',
    max_tokens: 8192,
  })
}

/**
 * Plan infrastructure for a system design.
 * Recommends provider, services, costs, and deployment steps.
 */
export async function planInfrastructure(design: SystemDesign): Promise<InfrastructurePlan> {
  const componentsDescription = design.components
    .map(c => `- ${c.name} (${c.type}): ${c.description} [${c.technologies.join(', ')}]`)
    .join('\n')

  const prompt = `Plan the infrastructure for the following system design.

SYSTEM: ${design.name}
DESCRIPTION: ${design.description}

COMPONENTS:
${componentsDescription}

Recommend the best cloud provider and services to deploy this system.
Include realistic cost estimates (monthly) and concrete deployment steps.

Respond with a JSON object matching this schema:
{
  "provider": "supabase | vercel | aws | gcp | cloudflare",
  "services": [
    {
      "name": "string — service name (e.g. 'Supabase PostgreSQL', 'Vercel Edge Functions')",
      "purpose": "string — what this service handles in the architecture",
      "estimated_cost": "string — monthly cost estimate (e.g. '$25/mo', 'Free tier')"
    }
  ],
  "deployment_steps": [
    "string — ordered deployment step (e.g. '1. Provision PostgreSQL database')"
  ]
}`

  return await claudeJSON<InfrastructurePlan>(prompt, {
    system: ARCHITECT_SYSTEM,
    model: 'sonnet',
    max_tokens: 4096,
  })
}

/**
 * Analyze dependencies between named components.
 * Given a list of component names/descriptions, determines how they connect.
 */
export async function analyzeDependencies(components: string[]): Promise<Dependency[]> {
  const prompt = `Analyze the dependencies between these software components.

COMPONENTS:
${components.map((c, i) => `${i + 1}. ${c}`).join('\n')}

For each pair of components that have a relationship, describe:
- The direction (from → to)
- The type (sync call, async message, data flow, event)
- What flows between them

Respond with a JSON array matching this schema:
[
  {
    "from": "string — source component name",
    "to": "string — target component name",
    "type": "sync | async | data | event",
    "description": "string — what flows between them"
  }
]

Only include actual dependencies — do not invent connections that don't logically exist.`

  return await claudeJSON<Dependency[]>(prompt, {
    system: ARCHITECT_SYSTEM,
    model: 'sonnet',
    max_tokens: 4096,
  })
}

// ─── Architecture Engine Class ──────────────────────────────
// Convenience wrapper for use in the registry executor.

export class ArchitectureEngine {
  analyzeCodebase = analyzeCodebase
  designSystem = designSystem
  generateCode = generateCode
  planInfrastructure = planInfrastructure
  analyzeDependencies = analyzeDependencies
}
