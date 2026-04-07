#!/usr/bin/env npx tsx
// Kernel Extended MCP Server — testing, security, docs, creative, AI ops tools
// Third MCP server for Claude Code
//
// SECURITY: Shell commands are executed via safeExec with 30s timeout.
// File operations are scoped to PROJECT_ROOT. API keys are never logged.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { config } from 'dotenv'
import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, basename, resolve, dirname, normalize } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: resolve(__dirname, '..', '.env') })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const PROXY_URL = `${SUPABASE_URL}/functions/v1/claude-proxy`
const PROJECT_ROOT = process.cwd()

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

function exec(cmd: string, cwd?: string): string {
    try {
        return execSync(cmd, { cwd: cwd ?? PROJECT_ROOT, encoding: 'utf-8', timeout: 30000 }).trim()
    } catch (err) {
        return err instanceof Error ? err.message : String(err)
    }
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

/** Validate a file path is within the project root to prevent path traversal */
function assertProjectPath(filePath: string): string {
    const absPath = normalize(join(PROJECT_ROOT, filePath))
    if (!absPath.startsWith(normalize(PROJECT_ROOT))) {
        throw new Error('Path traversal detected: file must be within the project directory')
    }
    return absPath
}

// ── MCP Server ───────────────────────────────────────────────
const server = new McpServer({ name: 'kernel-extended', version: '1.0.0' })

// ═══════════════════════════════════════════════════════════
//  TESTING & QUALITY
// ═══════════════════════════════════════════════════════════

server.tool(
    'kernel_test_gen',
    'Generate a Vitest test file for a TypeScript/React source file by reading the source and sending it to Claude Sonnet for test generation. Returns test code with mocked dependencies, happy path, edge cases, and error scenarios. Does NOT write the file — only returns the generated code for review. Costs one Sonnet API call. Use for scaffolding tests when coverage is needed.',
    {
        file_path: z.string().min(1).max(500).describe('Relative path to the source file from project root (e.g., "src/components/Chat.tsx")'),
        focus: z
            .enum(['unit', 'integration', 'snapshot'])
            .optional()
            .describe('Test strategy: "unit" (default, isolated functions), "integration" (component interactions), "snapshot" (rendered output)'),
    },
    async ({ file_path, focus }) => {
        try {
            const absPath = assertProjectPath(file_path)
            if (!existsSync(absPath)) return fail(`File not found: ${file_path}`)
            const source = readFileSync(absPath, 'utf-8')
            const truncated = source.length > 6000 ? source.slice(0, 6000) + '\n// [truncated]' : source

            const testCode = await callProxy(
                `Generate comprehensive ${focus ?? 'unit'} tests for this TypeScript/React file using Vitest.\n\nFile: ${file_path}\n\`\`\`typescript\n${truncated}\n\`\`\`\n\nRequirements:\n- Use vitest (import { describe, it, expect, vi } from 'vitest')\n- Mock external dependencies with vi.mock()\n- For React components, use @testing-library/react\n- Cover happy path, edge cases, and error states\n- Return ONLY the test file code, no explanation`,
                { system: 'You write production-quality Vitest tests. Output only code.', model: 'sonnet', max_tokens: 3000 }
            )

            // Suggest where to save
            const testPath = file_path.replace(/\.(tsx?)$/, '.test.$1')
            return ok(`Generated tests for ${file_path}:\n\nSuggested path: ${testPath}\n\n${testCode}`)
        } catch (err) {
            return fail(`Test gen error: ${sanitizeError(err)}`)
        }
    }
)

server.tool(
    'kernel_snapshot',
    'Fetch a web page and capture metrics (status code, load time, content length, script/style/image counts) to compare against a saved baseline. On first run, saves the baseline to .snapshots/<name>.json. On subsequent runs, detects regressions: content size changes, script count changes, load time doubling, or title changes. Side effects: writes/updates baseline JSON file. Does NOT take a visual screenshot — uses HTTP fetch metrics only.',
    {
        url: z.string().url().max(2048).optional().describe('URL to fetch and analyze. Default: "https://kernel.chat"'),
        name: z.string().max(50).regex(/^[a-zA-Z0-9_-]+$/).optional().describe('Baseline name for storage/comparison (alphanumeric, dashes, underscores). Default: "homepage"'),
    },
    async ({ url, name }) => {
        try {
            const targetUrl = url ?? 'https://kernel.chat'
            const snapName = name ?? 'homepage'
            const snapDir = join(PROJECT_ROOT, '.snapshots')
            if (!existsSync(snapDir)) mkdirSync(snapDir, { recursive: true })

            // Fetch the page and get basic metrics
            const start = Date.now()
            const res = await fetch(targetUrl)
            const loadTime = Date.now() - start
            const html = await res.text()

            const currentData = {
                url: targetUrl,
                status: res.status,
                load_time_ms: loadTime,
                content_length: html.length,
                title: html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1] ?? '',
                script_count: (html.match(/<script/gi) || []).length,
                style_count: (html.match(/<style/gi) || []).length + (html.match(/<link[^>]*stylesheet/gi) || []).length,
                image_count: (html.match(/<img/gi) || []).length,
                timestamp: new Date().toISOString(),
            }

            const baselinePath = join(snapDir, `${snapName}.json`)
            if (existsSync(baselinePath)) {
                const baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'))
                const diffs: string[] = []

                if (Math.abs(currentData.content_length - baseline.content_length) > 500)
                    diffs.push(`Content size changed: ${baseline.content_length} → ${currentData.content_length}`)
                if (currentData.script_count !== baseline.script_count)
                    diffs.push(`Script count changed: ${baseline.script_count} → ${currentData.script_count}`)
                if (currentData.load_time_ms > baseline.load_time_ms * 2)
                    diffs.push(`⚠️ Load time doubled: ${baseline.load_time_ms}ms → ${currentData.load_time_ms}ms`)
                if (currentData.title !== baseline.title)
                    diffs.push(`Title changed: "${baseline.title}" → "${currentData.title}"`)

                if (diffs.length === 0) {
                    return ok(`✅ No regressions detected for "${snapName}"\nLoad: ${currentData.load_time_ms}ms | Size: ${currentData.content_length}`)
                }

                // Update baseline
                writeFileSync(baselinePath, JSON.stringify(currentData, null, 2))
                return ok(`⚠️ ${diffs.length} change(s) detected for "${snapName}":\n\n${diffs.map(d => `• ${d}`).join('\n')}\n\nBaseline updated.`)
            }

            // Save new baseline
            writeFileSync(baselinePath, JSON.stringify(currentData, null, 2))
            return ok(`📸 Baseline saved for "${snapName}"\n${JSON.stringify(currentData, null, 2)}`)
        } catch (err) {
            return fail(`Snapshot error: ${sanitizeError(err)}`)
        }
    }
)

// ═══════════════════════════════════════════════════════════
//  MONITORING & OPS
// ═══════════════════════════════════════════════════════════

server.tool(
    'kernel_logs',
    'Fetch the 30 most recent Supabase edge function log lines via the Supabase CLI. Optionally filter by function name. Read-only operation. Requires the Supabase CLI to be installed and authenticated. Returns raw log output.',
    {
        function_name: z.string().max(100).regex(/^[a-zA-Z0-9_-]*$/).optional().describe('Edge function name to filter (e.g., "claude-proxy"). Only alphanumeric, dashes, underscores. Default: all functions'),
    },
    async ({ function_name }) => {
        try {
            // Validate function_name to prevent shell injection
            if (function_name && !/^[a-zA-Z0-9_-]+$/.test(function_name)) {
                return fail('Invalid function name: only alphanumeric characters, dashes, and underscores are allowed')
            }
            const cmd = function_name
                ? `npx supabase functions logs ${function_name} --project-ref kqsixkorzaulmeuynfkp 2>&1 | tail -30`
                : `npx supabase functions logs --project-ref kqsixkorzaulmeuynfkp 2>&1 | tail -30`
            const logs = exec(cmd)
            return ok(logs || 'No logs found.')
        } catch (err) {
            return fail(`Logs error: ${sanitizeError(err)}`)
        }
    }
)

server.tool(
    'kernel_uptime',
    'Ping critical Kernel platform endpoints (GitHub Pages site, Supabase REST API, Claude Proxy edge function) and report HTTP status, response time in milliseconds, and health status. Read-only operation with no side effects. Each endpoint has a 10-second timeout. Use this for quick health checks before deploys or when diagnosing issues.',
    {},
    async () => {
        const endpoints = [
            { name: 'GitHub Pages', url: 'https://kernel.chat' },
            { name: 'Supabase API', url: `${SUPABASE_URL}/rest/v1/` },
            { name: 'Claude Proxy', url: `${SUPABASE_URL}/functions/v1/claude-proxy` },
        ]

        const results = await Promise.all(
            endpoints.map(async (ep) => {
                const start = Date.now()
                try {
                    const res = await fetch(ep.url, { method: 'HEAD', signal: AbortSignal.timeout(10000) })
                    return { ...ep, status: res.status, ms: Date.now() - start, healthy: res.status < 400 }
                } catch {
                    return { ...ep, status: 0, ms: Date.now() - start, healthy: false }
                }
            })
        )

        const allHealthy = results.every((r) => r.healthy)
        const summary = results.map((r) => `${r.healthy ? '🟢' : '🔴'} ${r.name}: ${r.status} (${r.ms}ms)`).join('\n')
        return ok(`${allHealthy ? '✅ All systems operational' : '⚠️ Issues detected'}\n\n${summary}`)
    }
)

server.tool(
    'kernel_db_schema',
    'Inspect the Supabase database schema by querying known tables for their row counts and availability. Optionally inspect a specific table. Read-only operation with no side effects. Useful for verifying database health, checking migration status, or understanding data distribution.',
    {
        table: z.string().max(100).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/).optional().describe('Specific table name to inspect (alphanumeric + underscores only). Default: checks all known tables.'),
    },
    async ({ table }) => {
        try {
            // Use Supabase API to introspect
            const headers = {
                Authorization: `Bearer ${SERVICE_KEY}`,
                apikey: SUPABASE_KEY,
            }

            if (table) {
                const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?limit=0`, {
                    method: 'GET',
                    headers: { ...headers, Prefer: 'count=exact' },
                })
                const count = res.headers.get('content-range')
                return ok(`Table: ${table}\nCount: ${count}\nStatus: ${res.status}`)
            }

            // List all tables via RPC or known tables
            const knownTables = [
                'profiles', 'conversations', 'messages', 'user_memory',
                'subscriptions', 'feedback', 'evaluations', 'leads',
            ]

            const results = await Promise.all(
                knownTables.map(async (t) => {
                    try {
                        const res = await fetch(`${SUPABASE_URL}/rest/v1/${t}?limit=0`, {
                            headers: { ...headers, Prefer: 'count=exact' },
                        })
                        const range = res.headers.get('content-range')
                        const count = range?.split('/')?.[1] ?? '?'
                        return { table: t, rows: count, status: res.status === 200 ? '✅' : '❌' }
                    } catch {
                        return { table: t, rows: '?', status: '❌' }
                    }
                })
            )

            const output = results.map((r) => `${r.status} ${r.table}: ${r.rows} rows`).join('\n')
            return ok(`Database Schema:\n\n${output}`)
        } catch (err) {
            return fail(`Schema error: ${sanitizeError(err)}`)
        }
    }
)

// ═══════════════════════════════════════════════════════════
//  SECURITY
// ═══════════════════════════════════════════════════════════

server.tool(
    'kernel_audit',
    'Run a security audit combining npm vulnerability scan and hardcoded secrets detection. Checks for: npm package vulnerabilities (via npm audit), hardcoded API keys/tokens in source files (Stripe, AWS, GitHub, Slack, PEM keys), and direct process.env usage in client-side code. Read-only operation with no side effects. Returns a structured report with findings by category.',
    {},
    async () => {
        try {
            const npmAudit = exec('npm audit --json 2>/dev/null | head -50')
            const secretScan = exec(
                `grep -rn --include="*.ts" --include="*.tsx" --include="*.js" -E "(sk_live|sk_test|AKIA|ghp_|xox[bsa]-|-----BEGIN)" src/ tools/ 2>/dev/null | head -20`
            )
            const envCheck = exec(
                `grep -rn --include="*.ts" --include="*.tsx" -E "process\\.env\\." src/ 2>/dev/null | head -20`
            )

            let report = '# Security Audit\n\n'
            report += '## npm Vulnerabilities\n'

            try {
                const auditData = JSON.parse(npmAudit)
                const vulns = auditData.metadata?.vulnerabilities ?? {}
                report += `Critical: ${vulns.critical ?? 0} | High: ${vulns.high ?? 0} | Moderate: ${vulns.moderate ?? 0} | Low: ${vulns.low ?? 0}\n\n`
            } catch {
                report += `${npmAudit.slice(0, 500)}\n\n`
            }

            report += '## Hardcoded Secrets Scan\n'
            report += secretScan ? `⚠️ Potential secrets found:\n${secretScan}\n\n` : '✅ No hardcoded secrets detected\n\n'

            report += '## Environment Variable Usage (src/)\n'
            report += envCheck ? `${envCheck}\n` : 'No direct process.env usage in src/\n'

            return ok(report)
        } catch (err) {
            return fail(`Audit error: ${sanitizeError(err)}`)
        }
    }
)

server.tool(
    'kernel_deps',
    'Check for outdated npm dependencies by running npm outdated. Shows current version, wanted version, and latest version for each package. Major version bumps are flagged in red, minor in yellow. Read-only operation with no side effects. Use this before upgrades to identify what needs updating.',
    {
        production_only: z.boolean().optional().describe('If true, only check production dependencies (--prod). Default: false (all deps including devDependencies)'),
    },
    async ({ production_only }) => {
        try {
            const cmd = production_only ? 'npm outdated --json --prod 2>/dev/null' : 'npm outdated --json 2>/dev/null'
            const raw = exec(cmd)

            if (!raw || raw === '{}') return ok('✅ All dependencies are up to date!')

            try {
                const outdated = JSON.parse(raw)
                const lines = Object.entries(outdated).map(([pkg, info]: [string, unknown]) => {
                    const i = info as Record<string, string>
                    const major = i.current?.split('.')[0] !== i.latest?.split('.')[0]
                    return `${major ? '🔴' : '🟡'} ${pkg}: ${i.current} → ${i.latest} (wanted: ${i.wanted})`
                })
                return ok(`${lines.length} outdated packages:\n\n${lines.join('\n')}`)
            } catch {
                return ok(raw.slice(0, 2000))
            }
        } catch (err) {
            return fail(`Deps error: ${sanitizeError(err)}`)
        }
    }
)

// ═══════════════════════════════════════════════════════════
//  DOCUMENTATION
// ═══════════════════════════════════════════════════════════

server.tool(
    'kernel_docs_gen',
    'Generate JSDoc/TSDoc documentation for all exported functions, types, and classes in a TypeScript source file. Reads the file, sends it to Claude Sonnet, and returns the full file content with documentation comments added. Does NOT write the file — returns the documented version for review. Costs one Sonnet API call.',
    {
        file_path: z.string().min(1).max(500).describe('Relative path from project root to the source file (e.g., "src/engine/AIEngine.ts")'),
    },
    async ({ file_path }) => {
        try {
            const absPath = assertProjectPath(file_path)
            if (!existsSync(absPath)) return fail(`File not found: ${file_path}`)
            const source = readFileSync(absPath, 'utf-8')
            const truncated = source.length > 6000 ? source.slice(0, 6000) + '\n// [truncated]' : source

            const docs = await callProxy(
                `Add comprehensive JSDoc/TSDoc comments to all exported functions, types, and classes in this file. Return the FULL file with docs added.\n\nFile: ${file_path}\n\`\`\`typescript\n${truncated}\n\`\`\``,
                { system: 'You add clear, concise JSDoc to TypeScript code. Output only the documented code.', model: 'sonnet', max_tokens: 4000 }
            )

            return ok(`Documented version of ${file_path}:\n\n${docs}`)
        } catch (err) {
            return fail(`Docs gen error: ${sanitizeError(err)}`)
        }
    }
)

server.tool(
    'kernel_readme',
    'Generate a professional README.md by analyzing the current package.json, project structure, npm scripts, and edge functions. Returns the generated markdown text — does NOT write the file. Costs one Sonnet API call. Use this when the README needs updating after significant changes.',
    {},
    async () => {
        try {
            const pkg = exec('cat package.json')
            const structure = exec('find src/ -type f | head -40')
            const scripts = exec('cat package.json | grep -A 20 \'"scripts"\'')
            const edgeFns = exec('ls supabase/functions/ 2>/dev/null')

            const readme = await callProxy(
                `Generate a professional README.md for this project based on:\n\npackage.json:\n${pkg.slice(0, 1500)}\n\nProject structure:\n${structure}\n\nScripts:\n${scripts}\n\nEdge functions:\n${edgeFns}\n\nThis is "Kernel" — an AI thinking partner platform built with React, TypeScript, Vite, Supabase, and Stripe. It features multi-agent AI conversations with specialist agents (Kernel, Researcher, Coder, Writer, Analyst).`,
                { system: 'You write polished, informative README files. Use shields.io badges, clear sections, and professional formatting.', model: 'sonnet', max_tokens: 3000 }
            )

            return ok(readme)
        } catch (err) {
            return fail(`README error: ${sanitizeError(err)}`)
        }
    }
)

server.tool(
    'kernel_changelog',
    'Generate a structured changelog from git commit history, grouped by type (Features, Fixes, Refactors, Other). Optionally specify a commit range. Uses Claude Haiku to parse and format the commits. Read-only operation (reads git log, does not write files). Costs one Haiku API call.',
    {
        from: z.string().max(100).regex(/^[a-zA-Z0-9._/^~-]*$/).optional().describe('Start git ref (tag, branch, or commit SHA). Default: shows last 20 commits'),
        to: z.string().max(100).regex(/^[a-zA-Z0-9._/^~-]*$/).optional().describe('End git ref. Default: HEAD'),
    },
    async ({ from, to }) => {
        try {
            const range = from ? `${from}..${to ?? 'HEAD'}` : ''
            const logCmd = range
                ? `git log ${range} --oneline --no-merges`
                : `git log -20 --oneline --no-merges`
            const log = exec(logCmd)

            if (!log) return ok('No commits found in range.')

            const changelog = await callProxy(
                `Generate a clean changelog from these git commits. Group by: Features, Fixes, Refactors, Other. Use bullet points.\n\nCommits:\n${log}`,
                { system: 'You generate clean, readable changelogs. Group by type. Be concise.', model: 'haiku', max_tokens: 1500 }
            )

            return ok(changelog)
        } catch (err) {
            return fail(`Changelog error: ${sanitizeError(err)}`)
        }
    }
)

// ═══════════════════════════════════════════════════════════
//  CREATIVE & CONTENT
// ═══════════════════════════════════════════════════════════

server.tool(
    'kernel_social',
    'Generate social media post copy for Twitter/X and/or LinkedIn from provided content. Returns draft text only — does NOT post anything. Twitter posts are formatted for 280 chars with hashtags. LinkedIn posts use professional tone with 2-3 paragraphs. Costs one Sonnet API call. Review and edit the output before posting manually or via the social posting tools.',
    {
        content: z.string().min(1).max(50000).describe('The topic, blog post content, feature description, or announcement to generate posts from'),
        platform: z.enum(['twitter', 'linkedin', 'both']).optional().describe('Target platform(s). "both" (default) generates for both Twitter/X and LinkedIn.'),
    },
    async ({ content, platform }) => {
        try {
            const truncated = content.length > 3000 ? content.slice(0, 3000) + '\n[truncated]' : content
            const target = platform ?? 'both'

            const posts = await callProxy(
                `Generate social media posts for ${target === 'both' ? 'Twitter/X AND LinkedIn' : target}.\n\nContent to promote:\n${truncated}\n\nRequirements:\n- Twitter: Max 280 chars, punchy, include 2-3 relevant hashtags\n- LinkedIn: Professional tone, 2-3 paragraphs, engaging hook, call to action\n- Both should feel authentic, not corporate`,
                { system: 'You write viral social media content. Authentic voice, no fluff, strong hooks.', model: 'sonnet', max_tokens: 1500 }
            )

            return ok(posts)
        } catch (err) {
            return fail(`Social error: ${sanitizeError(err)}`)
        }
    }
)

server.tool(
    'kernel_newsletter',
    'Generate an email newsletter draft including subject line, preview text, body sections, and CTA. Incorporates recent git activity for development context. Returns text only — does NOT send the email. Use send_announcement from kernel-comms to actually send. Costs one Sonnet API call.',
    {
        topic: z.string().min(1).max(5000).describe('Newsletter topic, theme, or specific content to feature'),
        style: z.enum(['casual', 'professional', 'technical']).optional().describe('Writing voice: "casual" (friendly, conversational), "professional" (polished), "technical" (developer-focused). Default: casual'),
    },
    async ({ topic, style }) => {
        try {
            // Get recent activity for context
            const recentCommits = exec('git log -5 --oneline --no-merges 2>/dev/null')

            const newsletter = await callProxy(
                `Write an email newsletter about: ${topic}\n\nRecent development activity:\n${recentCommits}\n\nStyle: ${style ?? 'casual'}\n\nFormat:\n- Subject line (compelling, curiosity-driven)\n- Preview text (1 sentence)\n- Body (3-4 sections, scannable, with headers)\n- CTA at the end`,
                { system: 'You write engaging email newsletters. Strong subject lines. Scannable format. Human voice.', model: 'sonnet', max_tokens: 2000 }
            )

            return ok(newsletter)
        } catch (err) {
            return fail(`Newsletter error: ${sanitizeError(err)}`)
        }
    }
)

// ═══════════════════════════════════════════════════════════
//  AI OPS & META
// ═══════════════════════════════════════════════════════════

server.tool(
    'kernel_token_count',
    'Estimate the token count and API cost for a text string using the ~4 chars/token heuristic. Returns character count, word count, estimated tokens, and estimated cost at Haiku and Sonnet pricing. No API calls made — computation is local and instant. Use this to budget API calls or check if content fits within context limits.',
    {
        text: z.string().min(1).describe('Text to estimate token count for'),
    },
    async ({ text }) => {
        // Rough estimation: ~4 chars per token for English
        const charCount = text.length
        const wordCount = text.split(/\s+/).length
        const estimatedTokens = Math.ceil(charCount / 4)
        const estimatedCostHaiku = (estimatedTokens / 1_000_000) * 0.25
        const estimatedCostSonnet = (estimatedTokens / 1_000_000) * 3.0

        return ok(
            `Token Estimate:\n` +
            `Characters: ${charCount.toLocaleString()}\n` +
            `Words: ${wordCount.toLocaleString()}\n` +
            `Estimated tokens: ~${estimatedTokens.toLocaleString()}\n` +
            `Est. cost (Haiku input): $${estimatedCostHaiku.toFixed(6)}\n` +
            `Est. cost (Sonnet input): $${estimatedCostSonnet.toFixed(6)}`
        )
    }
)

server.tool(
    'kernel_prompt_version',
    'Version-control system prompts in .prompts/<name>.json. Supports four actions: "save" appends a new version, "load" retrieves the latest version, "list" shows all saved prompts, "compare" uses Haiku to diff two prompts. Side effects: "save" writes to disk. Other actions are read-only. Each prompt file stores all versions as a JSON array with timestamps.',
    {
        action: z.enum(['save', 'load', 'list', 'compare']).describe('"save" requires name + content. "load" requires name. "list" needs no params. "compare" requires name + compare_with.'),
        name: z.string().max(100).regex(/^[a-zA-Z0-9_-]+$/).optional().describe('Prompt name (alphanumeric, dashes, underscores). Required for save/load/compare.'),
        content: z.string().max(100000).optional().describe('Prompt content to save. Required for "save" action.'),
        compare_with: z.string().max(100).regex(/^[a-zA-Z0-9_-]+$/).optional().describe('Second prompt name for comparison. Required for "compare" action.'),
    },
    async ({ action, name, content, compare_with }) => {
        const promptDir = join(PROJECT_ROOT, '.prompts')
        if (!existsSync(promptDir)) mkdirSync(promptDir, { recursive: true })

        try {
            if (action === 'save' && name && content) {
                const versions = existsSync(join(promptDir, `${name}.json`))
                    ? JSON.parse(readFileSync(join(promptDir, `${name}.json`), 'utf-8'))
                    : []
                versions.push({ version: versions.length + 1, content, timestamp: new Date().toISOString() })
                writeFileSync(join(promptDir, `${name}.json`), JSON.stringify(versions, null, 2))
                return ok(`✅ Saved "${name}" v${versions.length}`)
            }

            if (action === 'load' && name) {
                const filePath = join(promptDir, `${name}.json`)
                if (!existsSync(filePath)) return fail(`Prompt "${name}" not found`)
                const versions = JSON.parse(readFileSync(filePath, 'utf-8'))
                const latest = versions[versions.length - 1]
                return ok(`"${name}" v${latest.version} (${latest.timestamp}):\n\n${latest.content}`)
            }

            if (action === 'list') {
                const files = exec(`ls "${promptDir}" 2>/dev/null`)
                if (!files) return ok('No saved prompts yet.')
                return ok(`Saved prompts:\n${files}`)
            }

            if (action === 'compare' && name && compare_with) {
                const a = JSON.parse(readFileSync(join(promptDir, `${name}.json`), 'utf-8'))
                const b = JSON.parse(readFileSync(join(promptDir, `${compare_with}.json`), 'utf-8'))
                const latestA = a[a.length - 1].content
                const latestB = b[b.length - 1].content

                const comparison = await callProxy(
                    `Compare these two system prompts and analyze their differences:\n\nPrompt A ("${name}"):\n${latestA}\n\nPrompt B ("${compare_with}"):\n${latestB}\n\nIdentify: tone differences, capability gaps, potential issues.`,
                    { system: 'You are a prompt engineering expert. Be specific about differences.', model: 'haiku', max_tokens: 1000 }
                )
                return ok(comparison)
            }

            return fail('Invalid action or missing parameters')
        } catch (err) {
            return fail(`Prompt version error: ${sanitizeError(err)}`)
        }
    }
)

server.tool(
    'kernel_model_compare',
    'Run the same prompt through both Haiku and Sonnet models in sequence and compare results side-by-side. Returns response text, latency, character count, and throughput for each model. Costs two API calls (one Haiku + one Sonnet). Use this to evaluate model suitability for a specific task or to justify model selection decisions.',
    {
        prompt: z.string().min(1).max(50000).describe('The prompt to test against both models'),
        system: z.string().max(10000).optional().describe('Optional system prompt applied to both models for consistent comparison'),
    },
    async ({ prompt, system }) => {
        try {
            const startHaiku = Date.now()
            const haikuResult = await callProxy(prompt, { system, model: 'haiku', max_tokens: 1000 })
            const haikuTime = Date.now() - startHaiku

            const startSonnet = Date.now()
            const sonnetResult = await callProxy(prompt, { system, model: 'sonnet', max_tokens: 1000 })
            const sonnetTime = Date.now() - startSonnet

            const output = [
                `# Model Comparison`,
                ``,
                `## ⚡ Haiku (${haikuTime}ms)`,
                haikuResult,
                ``,
                `---`,
                ``,
                `## 🧠 Sonnet (${sonnetTime}ms)`,
                sonnetResult,
                ``,
                `---`,
                ``,
                `## Stats`,
                `| | Haiku | Sonnet |`,
                `|---|---|---|`,
                `| Time | ${haikuTime}ms | ${sonnetTime}ms |`,
                `| Length | ${haikuResult.length} chars | ${sonnetResult.length} chars |`,
                `| Speed | ${Math.round(haikuResult.length / (haikuTime / 1000))} chars/s | ${Math.round(sonnetResult.length / (sonnetTime / 1000))} chars/s |`,
            ].join('\n')

            return ok(output)
        } catch (err) {
            return fail(`Compare error: ${sanitizeError(err)}`)
        }
    }
)

server.tool(
    'kernel_cost_tracker',
    'Estimate API costs by counting assistant messages in the database over a time period and applying token cost approximations. Returns total AI responses, estimated tokens, and cost estimates at Haiku, Sonnet, and mixed (80/20) pricing. Read-only operation. Uses ~800 tokens/call average for estimation. Actual costs may vary based on real token usage.',
    {
        days: z.number().int().min(1).max(365).optional().describe('Number of days to look back. Default: 7. Max: 365'),
    },
    async ({ days }) => {
        try {
            const lookback = days ?? 7
            const since = new Date(Date.now() - lookback * 24 * 60 * 60 * 1000).toISOString()

            // Count messages as proxy for API calls
            const headers = { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SUPABASE_KEY }
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/messages?created_at=gte.${since}&select=id,role,agent_id&role=eq.assistant`,
                { headers: { ...headers, Prefer: 'count=exact' } }
            )

            const count = res.headers.get('content-range')?.split('/')?.[1] ?? '0'
            const apiCalls = parseInt(count)

            // Rough cost estimation
            const avgTokensPerCall = 800
            const haikuCost = (apiCalls * avgTokensPerCall / 1_000_000) * 0.25
            const sonnetCost = (apiCalls * avgTokensPerCall / 1_000_000) * 3.0

            return ok(
                `# API Cost Estimate (last ${lookback} days)\n\n` +
                `Total AI responses: ${apiCalls}\n` +
                `Est. tokens: ~${(apiCalls * avgTokensPerCall).toLocaleString()}\n\n` +
                `| Model | Est. Cost |\n|---|---|\n` +
                `| If all Haiku | $${haikuCost.toFixed(4)} |\n` +
                `| If all Sonnet | $${sonnetCost.toFixed(4)} |\n` +
                `| Mixed (80/20) | $${(haikuCost * 0.8 + sonnetCost * 0.2).toFixed(4)} |`
            )
        } catch (err) {
            return fail(`Cost tracker error: ${sanitizeError(err)}`)
        }
    }
)

// ── Global error handling ────────────────────────────────────
process.on('uncaughtException', (err) => {
    console.error('[kernel-extended] Uncaught exception:', err.message)
    process.exit(1)
})

process.on('unhandledRejection', (reason) => {
    console.error('[kernel-extended] Unhandled rejection:', reason)
    process.exit(1)
})

// ── Start ────────────────────────────────────────────────────
const transport = new StdioServerTransport()
server.connect(transport).catch((err) => {
    console.error('[kernel-extended] Failed to connect:', err.message)
    process.exit(1)
})
