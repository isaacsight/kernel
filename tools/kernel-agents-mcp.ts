#!/usr/bin/env npx tsx
// Kernel Agents MCP Server — team coordination, memory, handoffs, tool creation
// The "nervous system" for the autonomous agent team
//
// SECURITY: Writes are scoped to .claude/agents/memory/ and tools/generated/ only.
// All file paths are validated to prevent path traversal attacks.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { config } from 'dotenv'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join, normalize } from 'path'

config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const PROXY_URL = `${SUPABASE_URL}/functions/v1/claude-proxy`
const PROJECT_ROOT = process.cwd()

const MEMORY_DIR = join(PROJECT_ROOT, '.claude', 'agents', 'memory')
const GENERATED_DIR = join(PROJECT_ROOT, 'tools', 'generated')

const VALID_AGENTS = ['qa', 'designer', 'performance', 'security', 'devops', 'product', 'admin'] as const
type AgentName = (typeof VALID_AGENTS)[number]

// ── Helpers ──────────────────────────────────────────────────

async function callProxy(
    prompt: string,
    opts: { system?: string; model?: 'sonnet' | 'haiku'; max_tokens?: number } = {}
): Promise<string> {
    const res = await fetch(PROXY_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SERVICE_KEY}`,
            apikey: SUPABASE_KEY,
        },
        body: JSON.stringify({
            mode: 'text',
            model: opts.model ?? 'haiku',
            system: opts.system,
            max_tokens: opts.max_tokens ?? 2048,
            messages: [{ role: 'user', content: prompt }],
        }),
    })
    if (!res.ok) throw new Error(`Proxy error (${res.status}): ${await res.text()}`)
    const { text } = await res.json()
    return text
}

function ok(text: string) {
    return { content: [{ type: 'text' as const, text }] }
}
function fail(text: string) {
    return { content: [{ type: 'text' as const, text }], isError: true as const }
}

function sanitizeError(err: unknown): string {
    if (err instanceof Error) {
        return err.message
            .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
            .replace(/apikey\s+\S+/gi, 'apikey [REDACTED]')
            .replace(/https?:\/\/[^\s]+/g, '[URL]')
    }
    return 'An unexpected error occurred'
}

/** Validate that a resolved path stays within allowed directories */
function assertSafePath(resolvedPath: string, allowedBase: string): void {
    const normalized = normalize(resolvedPath)
    const normalizedBase = normalize(allowedBase)
    if (!normalized.startsWith(normalizedBase)) {
        throw new Error('Path traversal detected: path must stay within allowed directory')
    }
}

function timestamp(): string {
    return new Date().toISOString().split('T')[0]
}

function getMemoryPath(agent: string): string {
    return join(MEMORY_DIR, `${agent}.md`)
}

function ensureDirs() {
    if (!existsSync(MEMORY_DIR)) mkdirSync(MEMORY_DIR, { recursive: true })
    if (!existsSync(GENERATED_DIR)) mkdirSync(GENERATED_DIR, { recursive: true })
}

// ── MCP Server ───────────────────────────────────────────────
const server = new McpServer({ name: 'kernel-agents', version: '1.0.0' })

// ═══════════════════════════════════════════════════════════
//  MEMORY OPERATIONS
// ═══════════════════════════════════════════════════════════

server.tool(
    'agent_memory_read',
    "Read the persistent memory file for a specific agent from .claude/agents/memory/<agent>.md. Call this at the start of any agent session to load previous findings, patterns, and context. Returns the full markdown content of the memory file. Read-only operation with no side effects. Returns an error if the memory file does not exist.",
    {
        agent: z.enum(VALID_AGENTS).describe('Agent whose memory to read (qa, designer, performance, security, devops, product, admin)'),
    },
    async ({ agent }) => {
        ensureDirs()
        const path = getMemoryPath(agent)
        if (!existsSync(path)) return fail(`No memory file found for agent: ${agent}`)
        const content = readFileSync(path, 'utf-8')
        return ok(content)
    }
)

server.tool(
    'agent_memory_write',
    "Append a timestamped entry to an agent's persistent memory file under a specific section. Side effects: modifies the agent's markdown memory file on disk. The entry is auto-prefixed with today's date in [YYYY-MM-DD] format. If the section exists, the entry is appended within it. If not, a new section is created at the end of the file. Call this after completing agent work to persist findings for future sessions.",
    {
        agent: z.enum([...VALID_AGENTS, 'shared-knowledge', 'tool-effectiveness'] as const).describe(
            'Agent whose memory to update. Use "shared-knowledge" for cross-agent insights or "tool-effectiveness" for tool usage logs.'
        ),
        section: z.string().min(1).max(200).describe('Markdown section header to append under (e.g., "Regressions Found", "Bundle Size History"). Created if it does not exist.'),
        entry: z.string().min(1).max(5000).describe('The entry content to append. Will be auto-prefixed with today\'s date.'),
    },
    async ({ agent, section, entry }) => {
        ensureDirs()
        const path = getMemoryPath(agent)
        if (!existsSync(path)) return fail(`No memory file found for: ${agent}`)

        let content = readFileSync(path, 'utf-8')
        const timestampedEntry = `- [${timestamp()}] ${entry}`

        // Find the section and append after its comment block
        const sectionPattern = new RegExp(`(## ${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?)(\\n## |$)`)
        const match = content.match(sectionPattern)

        if (match) {
            // Append before the next section
            const sectionContent = match[1]
            const insertPoint = content.indexOf(sectionContent) + sectionContent.length
            const beforeNextSection = content.lastIndexOf('\n', insertPoint - 1)

            // Find end of comment block in section
            const commentEnd = sectionContent.lastIndexOf('-->')
            if (commentEnd !== -1) {
                const absoluteCommentEnd = content.indexOf(sectionContent) + commentEnd + 3
                content = content.slice(0, absoluteCommentEnd) + '\n' + timestampedEntry + content.slice(absoluteCommentEnd)
            } else {
                // No comment block, append at end of section
                content = content.slice(0, insertPoint) + '\n' + timestampedEntry + content.slice(insertPoint)
            }
        } else {
            // Section not found — append at end of file
            content += `\n\n## ${section}\n\n${timestampedEntry}\n`
        }

        writeFileSync(path, content)
        return ok(`Memory updated for ${agent} in "${section}":\n${timestampedEntry}`)
    }
)

server.tool(
    'agent_memory_search',
    'Search across all agent memory markdown files in .claude/agents/memory/ for a case-insensitive substring match. Returns matching lines with file name and line number context. Use this to find related issues, patterns, or decisions across agents. Read-only operation with no side effects.',
    {
        query: z.string().min(1).max(200).describe('Case-insensitive search term to look for across all agent memory files'),
    },
    async ({ query }) => {
        ensureDirs()
        const results: string[] = []
        const files = readdirSync(MEMORY_DIR).filter((f) => f.endsWith('.md'))

        for (const file of files) {
            const content = readFileSync(join(MEMORY_DIR, file), 'utf-8')
            const lines = content.split('\n')
            const matches = lines
                .map((line, i) => ({ line, num: i + 1 }))
                .filter(({ line }) => line.toLowerCase().includes(query.toLowerCase()))

            if (matches.length > 0) {
                results.push(`\n### ${file}`)
                for (const m of matches) {
                    results.push(`  L${m.num}: ${m.line.trim()}`)
                }
            }
        }

        if (results.length === 0) return ok(`No matches found for "${query}" across agent memories.`)
        return ok(`Search results for "${query}":${results.join('\n')}`)
    }
)

// ═══════════════════════════════════════════════════════════
//  TEAM COORDINATION
// ═══════════════════════════════════════════════════════════

server.tool(
    'team_status',
    'Generate a summary table of all agent memory states showing entry count, last update timestamp, and file size for each agent. Use this to check which agents have recent findings and which may need re-running. Read-only operation with no side effects.',
    {},
    async () => {
        ensureDirs()
        const files = readdirSync(MEMORY_DIR).filter((f) => f.endsWith('.md'))
        const statuses: string[] = []

        for (const file of files) {
            const content = readFileSync(join(MEMORY_DIR, file), 'utf-8')
            const name = file.replace('.md', '')
            const entries = (content.match(/^- \[/gm) || []).length
            const dates = content.match(/\[\d{4}-\d{2}-\d{2}\]/g) || []
            const lastDate = dates.length > 0 ? dates[dates.length - 1] : 'never'
            const lineCount = content.split('\n').length

            statuses.push(`| ${name} | ${entries} entries | ${lastDate} | ${lineCount} lines |`)
        }

        return ok(
            `# Agent Team Status\n\n` +
                `| Agent | Entries | Last Update | Size |\n` +
                `|-------|---------|-------------|------|\n` +
                statuses.join('\n')
        )
    }
)

server.tool(
    'team_handoff',
    'Create a structured handoff entry from one agent to another for cross-cutting issues. Side effects: appends a timestamped, prioritized entry to the shared-knowledge.md memory file. Use this when one agent discovers an issue that falls under another agent\'s domain (e.g., QA finds a security issue, designer finds a performance problem). The receiving agent should read shared-knowledge.md before its next run.',
    {
        from_agent: z.enum(VALID_AGENTS).describe('Agent creating the handoff'),
        to_agent: z.enum(VALID_AGENTS).describe('Agent receiving the handoff — should read shared-knowledge before next run'),
        issue: z.string().min(1).max(1000).describe('Description of the cross-cutting issue being handed off'),
        context: z.string().min(1).max(5000).describe('Relevant context: file paths, reproduction steps, error messages, or other details'),
        priority: z.enum(['P0', 'P1', 'P2']).describe('P0: blocker/ship-stopper, P1: should fix soon, P2: nice-to-have improvement'),
    },
    async ({ from_agent, to_agent, issue, context, priority }) => {
        ensureDirs()
        const handoffEntry = `${priority} HANDOFF from ${from_agent}: ${issue} | Context: ${context}`

        // Write to shared knowledge
        const sharedPath = getMemoryPath('shared-knowledge')
        if (existsSync(sharedPath)) {
            let content = readFileSync(sharedPath, 'utf-8')
            const entry = `- [${timestamp()}] ${handoffEntry}`
            if (content.includes('## Coordination Notes')) {
                content = content.replace(
                    /(## Coordination Notes[\s\S]*?)(<!--[\s\S]*?-->)?/,
                    (match, header, comment) => (comment ? header + comment + '\n' + entry : header + '\n' + entry)
                )
            } else {
                content += `\n\n## Coordination Notes\n\n${entry}\n`
            }
            writeFileSync(sharedPath, content)
        }

        return ok(
            `Handoff created:\n` +
                `  From: ${from_agent}\n` +
                `  To: ${to_agent}\n` +
                `  Priority: ${priority}\n` +
                `  Issue: ${issue}\n` +
                `  Context: ${context}\n\n` +
                `Entry added to shared-knowledge.md. ${to_agent} agent should read this before next run.`
        )
    }
)

server.tool(
    'team_report',
    'Synthesize all agent findings into a unified team report by reading all memory files and sending them to Claude Sonnet for analysis. Returns a structured report with: Blockers, Warnings, Suggestions, Cross-cutting themes, and Recommended next actions. Costs one Sonnet API call. Use this before shipping to get a holistic view of project health. Optionally focus on a specific area like "ship readiness" or "security posture".',
    {
        focus: z
            .string()
            .max(200)
            .optional()
            .describe('Optional focus area to narrow the synthesis (e.g., "ship readiness", "security posture", "UX quality")'),
    },
    async ({ focus }) => {
        ensureDirs()
        const memories: string[] = []

        for (const agent of VALID_AGENTS) {
            const path = getMemoryPath(agent)
            if (existsSync(path)) {
                const content = readFileSync(path, 'utf-8')
                // Only include entries (lines starting with "- [")
                const entries = content
                    .split('\n')
                    .filter((l) => l.startsWith('- ['))
                    .join('\n')
                if (entries) {
                    memories.push(`### ${agent} agent:\n${entries}`)
                }
            }
        }

        const sharedPath = getMemoryPath('shared-knowledge')
        if (existsSync(sharedPath)) {
            const shared = readFileSync(sharedPath, 'utf-8')
            const entries = shared
                .split('\n')
                .filter((l) => l.startsWith('- ['))
                .join('\n')
            if (entries) memories.push(`### shared-knowledge:\n${entries}`)
        }

        if (memories.length === 0) {
            return ok('No agent findings to synthesize. Run individual agents first.')
        }

        const focusPrompt = focus ? `\n\nFocus your synthesis on: ${focus}` : ''

        try {
            const synthesis = await callProxy(
                `You are synthesizing findings from a team of 6 specialist agents (QA, Designer, Performance, Security, DevOps, Product) for the Kernel AI platform.\n\nAgent findings:\n\n${memories.join('\n\n')}\n\nCreate a unified team report with:\n1. **Blockers** — Issues that must be resolved before shipping\n2. **Warnings** — Issues that should be addressed soon\n3. **Suggestions** — Nice-to-have improvements\n4. **Cross-cutting themes** — Patterns that span multiple agent domains\n5. **Recommended next actions** — Prioritized list${focusPrompt}`,
                {
                    system: 'You are a senior engineering manager synthesizing reports from your team. Be concise, actionable, and prioritize by business impact.',
                    model: 'sonnet',
                    max_tokens: 3000,
                }
            )
            return ok(synthesis)
        } catch (err) {
            return fail(`Team report error: ${sanitizeError(err)}`)
        }
    }
)

// ═══════════════════════════════════════════════════════════
//  TOOL CREATION PIPELINE
// ═══════════════════════════════════════════════════════════

server.tool(
    'create_tool',
    'Stage a new tool proposal in tools/generated/<name>.ts for human review. Side effects: writes a TypeScript file and updates tools/generated/manifest.json. The tool is NOT active until a human promotes it to an MCP server. Use this when an agent identifies a capability gap during its work. The implementation should be a valid TypeScript function body. Do not use for trivial one-off scripts — only for reusable tools that fill genuine gaps.',
    {
        name: z
            .string()
            .min(2)
            .max(50)
            .regex(/^[a-z_]+$/)
            .describe('Tool name in snake_case (e.g., "lighthouse_audit"). Only lowercase letters and underscores.'),
        description: z.string().min(10).max(500).describe('Clear description of what the tool does, when to use it, and what it returns'),
        implementation: z.string().min(10).max(50000).describe('TypeScript implementation — the tool handler function body'),
        agent: z.enum(VALID_AGENTS).describe('Which agent is proposing this tool'),
        rationale: z.string().min(10).max(1000).describe('Why this tool is needed — what specific capability gap does it fill?'),
    },
    async ({ name, description, implementation, agent, rationale }) => {
        ensureDirs()

        const toolContent = `// Tool: ${name}
// Proposed by: ${agent} agent
// Date: ${timestamp()}
// Status: PENDING_REVIEW
// Description: ${description}
// Rationale: ${rationale}
//
// To promote: Move this tool's registration into an existing MCP server
// To reject: Delete this file and update manifest.json

${implementation}
`

        const toolPath = join(GENERATED_DIR, `${name}.ts`)
        writeFileSync(toolPath, toolContent)

        // Update manifest
        const manifestPath = join(GENERATED_DIR, 'manifest.json')
        let manifest: Record<string, unknown>[] = []
        if (existsSync(manifestPath)) {
            try {
                manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
            } catch {
                manifest = []
            }
        }

        manifest.push({
            name,
            description,
            agent,
            rationale,
            status: 'PENDING_REVIEW',
            created: timestamp(),
            file: `${name}.ts`,
        })

        writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

        return ok(
            `Tool staged for review:\n` +
                `  Name: ${name}\n` +
                `  File: tools/generated/${name}.ts\n` +
                `  Agent: ${agent}\n` +
                `  Status: PENDING_REVIEW\n\n` +
                `A human must review and promote this tool to an MCP server for it to become available.`
        )
    }
)

server.tool(
    'tool_effectiveness',
    'Log the outcome of a tool usage to the tool-effectiveness.md memory file. Side effects: appends a timestamped entry with tool name, agent, outcome, and optional notes. Use this after every significant tool invocation to track which tools work reliably and which need improvement. Over time, this data helps prioritize tool maintenance and identify patterns in failures.',
    {
        tool_name: z.string().min(1).max(100).describe('Name of the tool that was used'),
        agent: z.enum(VALID_AGENTS).describe('Which agent used the tool'),
        outcome: z.enum(['success', 'partial', 'fail']).describe('"success" = worked as expected, "partial" = partially worked, "fail" = did not work'),
        notes: z.string().max(1000).optional().describe('Additional context: error messages, workarounds used, or suggestions for improvement'),
    },
    async ({ tool_name, agent, outcome, notes }) => {
        ensureDirs()
        const path = getMemoryPath('tool-effectiveness')
        if (!existsSync(path)) return fail('tool-effectiveness.md not found')

        let content = readFileSync(path, 'utf-8')
        const icon = outcome === 'success' ? 'OK' : outcome === 'partial' ? 'PARTIAL' : 'FAIL'
        const entry = `- [${timestamp()}] ${tool_name} | ${agent} | ${icon}${notes ? ` | ${notes}` : ''}`

        // Append to Tool Usage Log section
        const sectionMarker = '## Tool Usage Log'
        if (content.includes(sectionMarker)) {
            const commentEnd = content.indexOf('-->', content.indexOf(sectionMarker))
            if (commentEnd !== -1) {
                content = content.slice(0, commentEnd + 3) + '\n' + entry + content.slice(commentEnd + 3)
            } else {
                content = content.replace(sectionMarker, sectionMarker + '\n\n' + entry)
            }
        } else {
            content += `\n\n${sectionMarker}\n\n${entry}\n`
        }

        writeFileSync(path, content)
        return ok(`Logged: ${tool_name} → ${icon} (by ${agent})${notes ? `: ${notes}` : ''}`)
    }
)

// ── Start ────────────────────────────────────────────────────
const transport = new StdioServerTransport()
await server.connect(transport)
