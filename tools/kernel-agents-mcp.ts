#!/usr/bin/env npx tsx
// Kernel Agents MCP Server — team coordination, memory, handoffs, tool creation
// The "nervous system" for the autonomous agent team

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { config } from 'dotenv'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join } from 'path'

config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const PROXY_URL = `${SUPABASE_URL}/functions/v1/claude-proxy`
const PROJECT_ROOT = process.cwd()

const MEMORY_DIR = join(PROJECT_ROOT, '.claude', 'agents', 'memory')
const GENERATED_DIR = join(PROJECT_ROOT, 'tools', 'generated')

const VALID_AGENTS = ['qa', 'designer', 'performance', 'security', 'devops', 'product'] as const
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
    "Read an agent's persistent memory file. Call this before starting any agent work.",
    {
        agent: z.enum(VALID_AGENTS).describe('Agent whose memory to read'),
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
    "Append a timestamped, categorized entry to an agent's memory file. Call this after completing agent work.",
    {
        agent: z.enum([...VALID_AGENTS, 'shared-knowledge', 'tool-effectiveness'] as const).describe(
            'Agent whose memory to update'
        ),
        section: z.string().describe('Section header to append under (e.g., "Regressions Found", "Bundle Size History")'),
        entry: z.string().describe('The entry content to append (will be auto-timestamped)'),
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
    'Search across all agent memory files for a pattern. Useful for finding related issues across agents.',
    {
        query: z.string().describe('Search term or pattern to look for'),
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
    'Summary of all agent memory states — last update timestamp, entry count, recent activity.',
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
    'Structured handoff from one agent to another. Creates a coordination entry in both memories.',
    {
        from_agent: z.enum(VALID_AGENTS).describe('Agent creating the handoff'),
        to_agent: z.enum(VALID_AGENTS).describe('Agent receiving the handoff'),
        issue: z.string().describe('Description of the cross-cutting issue'),
        context: z.string().describe('Relevant context, file paths, or reproduction steps'),
        priority: z.enum(['P0', 'P1', 'P2']).describe('Priority of the handoff'),
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
    'Synthesize findings across all agents into a unified report via claude-proxy.',
    {
        focus: z
            .string()
            .optional()
            .describe('Optional focus area (e.g., "ship readiness", "security posture", "UX quality")'),
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
            return fail(`Team report error: ${err instanceof Error ? err.message : String(err)}`)
        }
    }
)

// ═══════════════════════════════════════════════════════════
//  TOOL CREATION PIPELINE
// ═══════════════════════════════════════════════════════════

server.tool(
    'create_tool',
    'Stage a new tool in tools/generated/ for human review. Agents propose tools when they identify capability gaps.',
    {
        name: z
            .string()
            .regex(/^[a-z_]+$/)
            .describe('Tool name in snake_case (e.g., "lighthouse_audit")'),
        description: z.string().describe('What the tool does'),
        implementation: z.string().describe('TypeScript implementation (the tool handler function body)'),
        agent: z.enum(VALID_AGENTS).describe('Agent proposing this tool'),
        rationale: z.string().describe('Why this tool is needed — what gap does it fill?'),
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
    'Log tool usage outcomes. Tracks which tools work well and which need improvement.',
    {
        tool_name: z.string().describe('Name of the tool used'),
        agent: z.enum(VALID_AGENTS).describe('Agent that used the tool'),
        outcome: z.enum(['success', 'partial', 'fail']).describe('Outcome of the tool usage'),
        notes: z.string().optional().describe('Additional context about what happened'),
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
