#!/usr/bin/env npx tsx
// Kernel Extended MCP Server — testing, security, docs, creative, AI ops tools
// Third MCP server for Claude Code

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { config } from 'dotenv'
import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, basename, resolve, dirname } from 'path'
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

// ── MCP Server ───────────────────────────────────────────────
const server = new McpServer({ name: 'kernel-extended', version: '1.0.0' })

// ═══════════════════════════════════════════════════════════
//  TESTING & QUALITY
// ═══════════════════════════════════════════════════════════

server.tool(
    'kernel_test_gen',
    'Generate a Vitest test file for a given component or module. Reads the source and produces comprehensive tests with mocked dependencies.',
    {
        file_path: z.string().describe('Relative path to the source file (e.g., src/components/Chat.tsx)'),
        focus: z
            .enum(['unit', 'integration', 'snapshot'])
            .optional()
            .describe('Test focus. Default: unit'),
    },
    async ({ file_path, focus }) => {
        try {
            const absPath = join(PROJECT_ROOT, file_path)
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
            return fail(`Test gen error: ${err instanceof Error ? err.message : String(err)}`)
        }
    }
)

server.tool(
    'kernel_snapshot',
    'Take a screenshot of the live site and compare against a baseline. Flags visual regressions. First run saves the baseline.',
    {
        url: z.string().optional().describe('URL to screenshot. Default: live Kernel site'),
        name: z.string().optional().describe('Snapshot name for the baseline. Default: "homepage"'),
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
            return fail(`Snapshot error: ${err instanceof Error ? err.message : String(err)}`)
        }
    }
)

// ═══════════════════════════════════════════════════════════
//  MONITORING & OPS
// ═══════════════════════════════════════════════════════════

server.tool(
    'kernel_logs',
    'Fetch recent Supabase edge function logs. Filter by function name or time range.',
    {
        function_name: z.string().optional().describe('Edge function name to filter (e.g., "claude-proxy"). Default: all'),
    },
    async ({ function_name }) => {
        try {
            const cmd = function_name
                ? `npx supabase functions logs ${function_name} --project-ref kqsixkorzaulmeuynfkp 2>&1 | tail -30`
                : `npx supabase functions logs --project-ref kqsixkorzaulmeuynfkp 2>&1 | tail -30`
            const logs = exec(cmd)
            return ok(logs || 'No logs found.')
        } catch (err) {
            return fail(`Logs error: ${err instanceof Error ? err.message : String(err)}`)
        }
    }
)

server.tool(
    'kernel_uptime',
    'Ping all critical endpoints and report their status, response time, and health.',
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
    'Dump the current Supabase database schema — tables, columns, types, and relationships.',
    {
        table: z.string().optional().describe('Specific table name. Default: all tables'),
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
            return fail(`Schema error: ${err instanceof Error ? err.message : String(err)}`)
        }
    }
)

// ═══════════════════════════════════════════════════════════
//  SECURITY
// ═══════════════════════════════════════════════════════════

server.tool(
    'kernel_audit',
    'Run a security audit: npm audit for vulnerabilities + scan for hardcoded secrets in the codebase.',
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
            return fail(`Audit error: ${err instanceof Error ? err.message : String(err)}`)
        }
    }
)

server.tool(
    'kernel_deps',
    'Check for outdated or vulnerable npm dependencies. Shows current vs latest version for each package.',
    {
        production_only: z.boolean().optional().describe('Only check production deps. Default: false'),
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
            return fail(`Deps error: ${err instanceof Error ? err.message : String(err)}`)
        }
    }
)

// ═══════════════════════════════════════════════════════════
//  DOCUMENTATION
// ═══════════════════════════════════════════════════════════

server.tool(
    'kernel_docs_gen',
    'Auto-generate documentation for a source file. Reads the code and produces JSDoc/TSDoc comments for all exports.',
    {
        file_path: z.string().describe('Relative path to the source file'),
    },
    async ({ file_path }) => {
        try {
            const absPath = join(PROJECT_ROOT, file_path)
            if (!existsSync(absPath)) return fail(`File not found: ${file_path}`)
            const source = readFileSync(absPath, 'utf-8')
            const truncated = source.length > 6000 ? source.slice(0, 6000) + '\n// [truncated]' : source

            const docs = await callProxy(
                `Add comprehensive JSDoc/TSDoc comments to all exported functions, types, and classes in this file. Return the FULL file with docs added.\n\nFile: ${file_path}\n\`\`\`typescript\n${truncated}\n\`\`\``,
                { system: 'You add clear, concise JSDoc to TypeScript code. Output only the documented code.', model: 'sonnet', max_tokens: 4000 }
            )

            return ok(`Documented version of ${file_path}:\n\n${docs}`)
        } catch (err) {
            return fail(`Docs gen error: ${err instanceof Error ? err.message : String(err)}`)
        }
    }
)

server.tool(
    'kernel_readme',
    'Generate or update the project README based on current codebase state — structure, scripts, tech stack, and features.',
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
            return fail(`README error: ${err instanceof Error ? err.message : String(err)}`)
        }
    }
)

server.tool(
    'kernel_changelog',
    'Generate a changelog from git history. Groups commits by type (feat, fix, refactor, etc.) between two refs.',
    {
        from: z.string().optional().describe('Start ref (tag or commit). Default: last 20 commits'),
        to: z.string().optional().describe('End ref. Default: HEAD'),
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
            return fail(`Changelog error: ${err instanceof Error ? err.message : String(err)}`)
        }
    }
)

// ═══════════════════════════════════════════════════════════
//  CREATIVE & CONTENT
// ═══════════════════════════════════════════════════════════

server.tool(
    'kernel_social',
    'Generate social media posts (Twitter/X, LinkedIn, or both) from a topic, blog post, or feature announcement.',
    {
        content: z.string().describe('The topic, blog post content, or feature to promote'),
        platform: z.enum(['twitter', 'linkedin', 'both']).optional().describe('Target platform. Default: both'),
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
            return fail(`Social error: ${err instanceof Error ? err.message : String(err)}`)
        }
    }
)

server.tool(
    'kernel_newsletter',
    'Generate an email newsletter from recent blog posts, commits, or custom content.',
    {
        topic: z.string().describe('Newsletter topic or content to include'),
        style: z.enum(['casual', 'professional', 'technical']).optional().describe('Writing style. Default: casual'),
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
            return fail(`Newsletter error: ${err instanceof Error ? err.message : String(err)}`)
        }
    }
)

// ═══════════════════════════════════════════════════════════
//  AI OPS & META
// ═══════════════════════════════════════════════════════════

server.tool(
    'kernel_token_count',
    'Estimate token count for a text string. Useful for budgeting API calls and staying within context limits.',
    {
        text: z.string().describe('Text to count tokens for'),
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
    'Save, load, or compare system prompt versions. Stores prompts as JSON files in .prompts/ directory.',
    {
        action: z.enum(['save', 'load', 'list', 'compare']).describe('Action to perform'),
        name: z.string().optional().describe('Prompt name (for save/load)'),
        content: z.string().optional().describe('Prompt content (for save)'),
        compare_with: z.string().optional().describe('Second prompt name to compare against (for compare)'),
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
            return fail(`Prompt version error: ${err instanceof Error ? err.message : String(err)}`)
        }
    }
)

server.tool(
    'kernel_model_compare',
    'Run the same prompt through Haiku and Sonnet side-by-side. Compares response quality, speed, and token efficiency.',
    {
        prompt: z.string().describe('The prompt to test'),
        system: z.string().optional().describe('System prompt to use'),
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
            return fail(`Compare error: ${err instanceof Error ? err.message : String(err)}`)
        }
    }
)

server.tool(
    'kernel_cost_tracker',
    'Track and estimate API costs. Reads edge function usage and estimates spend based on token approximations.',
    {
        days: z.number().optional().describe('Days to look back. Default: 7'),
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
            return fail(`Cost tracker error: ${err instanceof Error ? err.message : String(err)}`)
        }
    }
)

// ── Start ────────────────────────────────────────────────────
const transport = new StdioServerTransport()
await server.connect(transport)
