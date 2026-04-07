#!/usr/bin/env npx tsx
// Kernel Tools MCP Server — dev workflow utilities for Claude Code
// Provides: notify, stripe, deploy_status, design_lint, diff_review, seo, debate, journal, agent_create, codemod
//
// SECURITY: Shell commands run via safeExec with 30s timeout. File operations
// scoped to PROJECT_ROOT. No user input is interpolated into shell commands.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { config } from 'dotenv'
import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs'
import { join, resolve, dirname, normalize } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: resolve(__dirname, '..', '.env') })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const PROXY_URL = `${SUPABASE_URL}/functions/v1/claude-proxy`
const PROJECT_ROOT = process.cwd()

// ── Helper: Call claude-proxy ────────────────────────────────
async function callProxy(
    prompt: string,
    opts: {
        system?: string
        model?: 'sonnet' | 'haiku'
        max_tokens?: number
    } = {}
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

    if (!res.ok) {
        const err = await res.text()
        throw new Error(`Claude proxy error (${res.status}): ${err}`)
    }

    const { text } = await res.json()
    return text
}

// ── Helper: safe exec ────────────────────────────────────────
function safeExec(cmd: string, cwd?: string): string {
    try {
        return execSync(cmd, {
            cwd: cwd ?? PROJECT_ROOT,
            encoding: 'utf-8',
            timeout: 30000,
        }).trim()
    } catch (err) {
        return err instanceof Error ? err.message : String(err)
    }
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
const server = new McpServer({
    name: 'kernel-tools',
    version: '1.0.0',
})

// ─── Tool: kernel_notify ─────────────────────────────────────
server.tool(
    'kernel_notify',
    'Send a notification via Discord webhook or email. Side effects: delivers a message to the configured channel. Use this for alerting when long-running tasks complete, deploys finish, or errors are detected. Discord requires DISCORD_WEBHOOK_URL in .env. Email uses the send-inquiry-email edge function. Do not use for user-facing notifications — use kernel-comms send_notification instead.',
    {
        channel: z.enum(['discord', 'email']).describe('"discord" sends to the configured webhook. "email" sends via the Supabase edge function.'),
        message: z.string().min(1).max(4000).describe('The notification message content'),
        subject: z.string().max(200).optional().describe('Email subject line. Only used when channel is "email". Default: "Claude Code Notification"'),
    },
    async ({ channel, message, subject }) => {
        try {
            if (channel === 'discord') {
                const webhookUrl = process.env.DISCORD_WEBHOOK_URL
                if (!webhookUrl) {
                    return {
                        content: [{ type: 'text' as const, text: 'DISCORD_WEBHOOK_URL not set in .env' }],
                        isError: true,
                    }
                }

                const res = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: 'Kernel — Claude Code',
                        content: `🤖 **Claude Code Notification**\n\n${message}`,
                    }),
                })

                if (!res.ok) throw new Error(`Webhook error: ${res.status}`)
                return { content: [{ type: 'text' as const, text: '✅ Discord notification sent' }] }
            }

            if (channel === 'email') {
                const res = await fetch(`${SUPABASE_URL}/functions/v1/send-inquiry-email`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${SERVICE_KEY}`,
                        apikey: SUPABASE_KEY,
                    },
                    body: JSON.stringify({
                        subject: subject ?? 'Claude Code Notification',
                        message,
                        from: 'claude-code@kernel.ai',
                    }),
                })

                if (!res.ok) throw new Error(`Email error: ${res.status}`)
                return { content: [{ type: 'text' as const, text: '✅ Email notification sent' }] }
            }

            return { content: [{ type: 'text' as const, text: 'Unknown channel' }], isError: true }
        } catch (err) {
            return {
                content: [{ type: 'text' as const, text: `Notify error: ${sanitizeError(err)}` }],
                isError: true,
            }
        }
    }
)

// ─── Tool: kernel_stripe ─────────────────────────────────────
server.tool(
    'kernel_stripe',
    'Query Stripe payment data or create coupons via Supabase edge functions. Read actions (revenue_summary, active_subscriptions, recent_charges) have no side effects. The create_coupon action creates a Stripe coupon — use carefully. All requests are authenticated via SUPABASE_SERVICE_KEY.',
    {
        action: z
            .enum(['revenue_summary', 'active_subscriptions', 'recent_charges', 'create_coupon'])
            .describe('"revenue_summary", "active_subscriptions", "recent_charges" are read-only. "create_coupon" creates a Stripe coupon (side effect).'),
        coupon_percent: z.number().min(1).max(100).optional().describe('Discount percentage for create_coupon action (1-100). Default: 20'),
        coupon_name: z.string().max(200).optional().describe('Human-readable coupon name for create_coupon action. Default: "Claude Code Coupon"'),
    },
    async ({ action, coupon_percent, coupon_name }) => {
        try {
            if (action === 'create_coupon') {
                const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${SERVICE_KEY}`,
                        apikey: SUPABASE_KEY,
                    },
                    body: JSON.stringify({
                        action: 'create_coupon',
                        percent_off: coupon_percent ?? 20,
                        name: coupon_name ?? 'Claude Code Coupon',
                    }),
                })
                const data = await res.json()
                return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
            }

            // For revenue queries, use the portal function
            const res = await fetch(`${SUPABASE_URL}/functions/v1/create-portal`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${SERVICE_KEY}`,
                    apikey: SUPABASE_KEY,
                },
                body: JSON.stringify({ action }),
            })

            const data = await res.json()
            return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
        } catch (err) {
            return {
                content: [{ type: 'text' as const, text: `Stripe error: ${sanitizeError(err)}` }],
                isError: true,
            }
        }
    }
)

// ─── Tool: kernel_deploy_status ──────────────────────────────
server.tool(
    'kernel_deploy_status',
    'Check the health of the live kernel.chat site deployed on GitHub Pages. Fetches the URL and reports HTTP status, response time, page title, meta description, content length, and last git deploy commit. Read-only operation with no side effects. Use after deployments to verify the site is up and rendering correctly.',
    {},
    async () => {
        try {
            const siteUrl = 'https://kernel.chat'
            const start = Date.now()
            const res = await fetch(siteUrl, { redirect: 'follow' })
            const responseTime = Date.now() - start
            const html = await res.text()

            const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
            const metaDesc = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i)

            // Check last git deploy
            const lastDeploy = safeExec('git log gh-pages -1 --format="%H %ai %s" 2>/dev/null || echo "unknown"')

            const status = {
                url: siteUrl,
                http_status: res.status,
                response_time_ms: responseTime,
                title: titleMatch?.[1] ?? 'Unknown',
                meta_description: metaDesc?.[1] ?? 'None',
                content_length: html.length,
                last_deploy: lastDeploy,
                healthy: res.status === 200 && responseTime < 5000,
            }

            return { content: [{ type: 'text' as const, text: JSON.stringify(status, null, 2) }] }
        } catch (err) {
            return {
                content: [{ type: 'text' as const, text: `Deploy status error: ${sanitizeError(err)}` }],
                isError: true,
            }
        }
    }
)

// ─── Tool: kernel_design_lint ────────────────────────────────
server.tool(
    'kernel_design_lint',
    'Lint source files against the Kernel Rubin design system rules. Checks for: non-Rubin fonts (should use EB Garamond), pure white/black colors (should use ivory/warm dark), aggressive border-radius, uppercase text, and cold box-shadows. Either lint a specific file or all recently changed files (git diff). Read-only operation with no side effects.',
    {
        file_path: z.string().max(500).optional().describe('Specific file to lint (relative path from project root). If omitted, lints all .ts/.tsx/.css/.html files in the current git diff.'),
    },
    async ({ file_path }) => {
        try {
            let filesToCheck: string[]

            if (file_path) {
                filesToCheck = [join(PROJECT_ROOT, file_path)]
            } else {
                const changed = safeExec('git diff --name-only HEAD 2>/dev/null || git diff --name-only --cached')
                filesToCheck = changed
                    .split('\n')
                    .filter((f) => f.match(/\.(tsx?|css|html)$/))
                    .map((f) => join(PROJECT_ROOT, f))
            }

            if (filesToCheck.length === 0) {
                return { content: [{ type: 'text' as const, text: 'No relevant files to lint.' }] }
            }

            const violations: string[] = []
            const DESIGN_RULES = [
                { pattern: /font-family:(?!.*EB Garamond)(?!.*inherit)(?!.*monospace)/g, msg: 'Non-Rubin font detected. Use "EB Garamond" or inherit.' },
                { pattern: /#(fff|FFF|ffffff|FFFFFF)\b/g, msg: 'Pure white (#fff) detected. Use ivory (#FFFEF7) instead.' },
                { pattern: /#(000|000000)\b/g, msg: 'Pure black (#000) detected. Use warm dark (#1A1A2E) instead.' },
                { pattern: /border-radius:\s*(\d+)px/g, msg: 'Check border-radius. Rubin aesthetic prefers subtle rounding (2-4px) or none.' },
                { pattern: /text-transform:\s*uppercase/g, msg: 'Uppercase text detected. Rubin aesthetic avoids shouty text.' },
                { pattern: /box-shadow:.*rgba\(0,\s*0,\s*0/g, msg: 'Black box-shadow detected. Use warm shadow tones.' },
            ]

            for (const filePath of filesToCheck) {
                if (!existsSync(filePath)) continue
                const content = readFileSync(filePath, 'utf-8')
                const lines = content.split('\n')

                for (const rule of DESIGN_RULES) {
                    lines.forEach((line, i) => {
                        if (rule.pattern.test(line)) {
                            violations.push(`${filePath.replace(PROJECT_ROOT + '/', '')}:${i + 1} — ${rule.msg}`)
                        }
                        rule.pattern.lastIndex = 0
                    })
                }
            }

            if (violations.length === 0) {
                return { content: [{ type: 'text' as const, text: '✅ All files pass Rubin design lint. No violations.' }] }
            }

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `⚠️ ${violations.length} design violation(s):\n\n${violations.map((v) => `• ${v}`).join('\n')}`,
                    },
                ],
            }
        } catch (err) {
            return {
                content: [{ type: 'text' as const, text: `Design lint error: ${sanitizeError(err)}` }],
                isError: true,
            }
        }
    }
)

// ─── Tool: kernel_diff_review ────────────────────────────────
server.tool(
    'kernel_diff_review',
    'Get an AI-powered code review of the current git diff using Claude Sonnet. Checks for type safety, error handling, security (XSS, exposed keys, injection), performance (re-renders, missing memo), design system compliance, and dead code. Returns a quality rating (Ship/Minor Fixes/Needs Rework) with specific issues and suggestions. Costs one Sonnet API call. Large diffs are truncated to 8KB.',
    {
        staged_only: z.boolean().optional().describe('If true, reviews only staged (git add) changes. Default: false (reviews all unstaged + staged changes)'),
    },
    async ({ staged_only }) => {
        try {
            const diffCmd = staged_only ? 'git diff --cached' : 'git diff'
            const diff = safeExec(diffCmd)

            if (!diff || diff.includes('fatal:')) {
                return { content: [{ type: 'text' as const, text: 'No changes to review.' }] }
            }

            // Truncate if huge
            const truncatedDiff = diff.length > 8000 ? diff.slice(0, 8000) + '\n\n[... truncated]' : diff

            const review = await callProxy(
                `Review this git diff for a TypeScript/React project (Kernel AI platform). Check for:\n1. Type safety issues\n2. Missing error handling\n3. Security problems (exposed keys, XSS, injection)\n4. Performance concerns (unnecessary re-renders, missing memo)\n5. Design system violations (should use EB Garamond, ivory palette)\n6. Dead code or unused imports\n\nRate overall: 🟢 Ship it / 🟡 Minor fixes / 🔴 Needs rework\n\nDiff:\n\`\`\`diff\n${truncatedDiff}\n\`\`\``,
                {
                    system: 'You are a senior code reviewer specializing in TypeScript, React, and Supabase. Be specific with line references. Be concise but thorough.',
                    model: 'sonnet',
                    max_tokens: 2048,
                }
            )

            return { content: [{ type: 'text' as const, text: review }] }
        } catch (err) {
            return {
                content: [{ type: 'text' as const, text: `Review error: ${sanitizeError(err)}` }],
                isError: true,
            }
        }
    }
)

// ─── Tool: kernel_seo ────────────────────────────────────────
server.tool(
    'kernel_seo',
    'Audit the SEO of any public web page by fetching it and analyzing the HTML for meta tags, Open Graph tags, Twitter Card, headings structure, viewport, canonical URL, structured data (JSON-LD), and HTML lang attribute. Returns a structured report with a 0-10 SEO score and specific issues. Read-only operation with no side effects.',
    {
        url: z.string().url().max(2048).optional().describe('URL to audit. Default: "https://kernel.chat"'),
    },
    async ({ url }) => {
        try {
            const targetUrl = url ?? 'https://kernel.chat'
            const res = await fetch(targetUrl)
            const html = await res.text()

            const getTag = (pattern: RegExp) => html.match(pattern)?.[1] ?? null
            const getAllTags = (pattern: RegExp) => {
                const matches: string[] = []
                let m
                while ((m = pattern.exec(html)) !== null) matches.push(m[1])
                return matches
            }

            const audit = {
                url: targetUrl,
                http_status: res.status,
                title: getTag(/<title[^>]*>(.*?)<\/title>/i),
                meta_description: getTag(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i),
                og_title: getTag(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/i),
                og_description: getTag(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i),
                og_image: getTag(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i),
                og_type: getTag(/<meta[^>]*property="og:type"[^>]*content="([^"]*)"[^>]*>/i),
                twitter_card: getTag(/<meta[^>]*name="twitter:card"[^>]*content="([^"]*)"[^>]*>/i),
                canonical: getTag(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"[^>]*>/i),
                viewport: getTag(/<meta[^>]*name="viewport"[^>]*content="([^"]*)"[^>]*>/i),
                h1_tags: getAllTags(/<h1[^>]*>(.*?)<\/h1>/gi),
                h2_count: (html.match(/<h2/gi) || []).length,
                has_structured_data: html.includes('application/ld+json'),
                html_lang: getTag(/<html[^>]*lang="([^"]*)"[^>]*>/i),
                issues: [] as string[],
            }

            // Check for issues
            if (!audit.title) audit.issues.push('❌ Missing <title> tag')
            if (!audit.meta_description) audit.issues.push('❌ Missing meta description')
            if (!audit.og_title) audit.issues.push('⚠️ Missing Open Graph title')
            if (!audit.og_image) audit.issues.push('⚠️ Missing Open Graph image')
            if (!audit.viewport) audit.issues.push('❌ Missing viewport meta tag')
            if (audit.h1_tags.length === 0) audit.issues.push('⚠️ No <h1> found')
            if (audit.h1_tags.length > 1) audit.issues.push(`⚠️ Multiple <h1> tags (${audit.h1_tags.length})`)
            if (!audit.canonical) audit.issues.push('⚠️ Missing canonical URL')
            if (!audit.has_structured_data) audit.issues.push('💡 No structured data (JSON-LD)')
            if (!audit.html_lang) audit.issues.push('⚠️ Missing html lang attribute')

            const score = 10 - audit.issues.filter((i) => i.startsWith('❌')).length * 2 - audit.issues.filter((i) => i.startsWith('⚠️')).length
                ; (audit as Record<string, unknown>).seo_score = `${Math.max(0, score)}/10`

            return { content: [{ type: 'text' as const, text: JSON.stringify(audit, null, 2) }] }
        } catch (err) {
            return {
                content: [{ type: 'text' as const, text: `SEO audit error: ${sanitizeError(err)}` }],
                isError: true,
            }
        }
    }
)

// ─── Tool: kernel_debate ─────────────────────────────────────
server.tool(
    'kernel_debate',
    'Run a structured debate between two specialist agents on a topic. One argues FOR, one argues AGAINST, then Sonnet delivers a verdict. Costs 3 API calls (2 Haiku for arguments + 1 Sonnet for verdict). Use for evaluating tradeoffs, architectural decisions, or contentious design choices where seeing both sides is valuable. Returns a formatted debate transcript with conclusion.',
    {
        topic: z.string().min(1).max(2000).describe('The topic, question, or proposal to debate (e.g., "Should we migrate from REST to GraphQL?")'),
        agent_for: z
            .enum(['kernel', 'researcher', 'coder', 'writer', 'analyst'])
            .describe('Agent perspective arguing IN FAVOR of the topic'),
        agent_against: z
            .enum(['kernel', 'researcher', 'coder', 'writer', 'analyst'])
            .describe('Agent perspective arguing AGAINST the topic'),
    },
    async ({ topic, agent_for, agent_against }) => {
        try {
            const SPECIALISTS: Record<string, string> = {
                kernel: 'You are the Kernel — a personal AI thinking partner. Warm, sharp, real.',
                researcher: 'You are a deep research analyst. Cite facts and data.',
                coder: 'You are a senior software engineer. Focus on implementation reality.',
                writer: 'You are a compelling writer. Focus on narrative and persuasion.',
                analyst: 'You are a strategic analyst. Focus on tradeoffs and long-term impact.',
            }

            // Parallel: get both arguments
            const [forArg, againstArg] = await Promise.all([
                callProxy(
                    `Argue strongly IN FAVOR of: "${topic}"\n\nPresent 3 compelling arguments with evidence. Be persuasive. 2-3 paragraphs.`,
                    { system: SPECIALISTS[agent_for], model: 'haiku', max_tokens: 800 }
                ),
                callProxy(
                    `Argue strongly AGAINST: "${topic}"\n\nPresent 3 compelling counterarguments with evidence. Be persuasive. 2-3 paragraphs.`,
                    { system: SPECIALISTS[agent_against], model: 'haiku', max_tokens: 800 }
                ),
            ])

            // Synthesize a verdict
            const verdict = await callProxy(
                `Two experts debated: "${topic}"\n\n**FOR (${agent_for}):**\n${forArg}\n\n**AGAINST (${agent_against}):**\n${againstArg}\n\nProvide a balanced verdict in 2-3 sentences. Who made the stronger case? What's the recommended path forward?`,
                { system: 'You are a neutral judge evaluating debate quality. Be decisive.', model: 'sonnet', max_tokens: 400 }
            )

            const output = `# Debate: ${topic}\n\n## 🟢 FOR (${agent_for})\n${forArg}\n\n---\n\n## 🔴 AGAINST (${agent_against})\n${againstArg}\n\n---\n\n## ⚖️ Verdict\n${verdict}`

            return { content: [{ type: 'text' as const, text: output }] }
        } catch (err) {
            return {
                content: [{ type: 'text' as const, text: `Debate error: ${sanitizeError(err)}` }],
                isError: true,
            }
        }
    }
)

// ─── Tool: kernel_journal ────────────────────────────────────
server.tool(
    'kernel_journal',
    'Append a timestamped development journal entry to .journal/<YYYY-MM-DD>.md. Side effects: creates the journal directory if missing and appends to the daily file. Each entry includes the current time (HH:MM), category icon, and the latest git commit for context. Use this to maintain a running dev log of commits, deploys, decisions, bugs found, ideas, and general notes.',
    {
        entry: z.string().min(1).max(5000).describe('The journal entry text to log'),
        category: z
            .enum(['commit', 'deploy', 'decision', 'bug', 'idea', 'note'])
            .optional()
            .describe('Entry category with icon. Default: "note"'),
    },
    async ({ entry, category }) => {
        try {
            const now = new Date()
            const dateStr = now.toISOString().slice(0, 10) // YYYY-MM-DD
            const timeStr = now.toISOString().slice(11, 16) // HH:MM
            const journalDir = join(PROJECT_ROOT, '.journal')
            const journalFile = join(journalDir, `${dateStr}.md`)

            // Create journal dir if needed
            if (!existsSync(journalDir)) {
                safeExec(`mkdir -p "${journalDir}"`)
            }

            const icons: Record<string, string> = {
                commit: '📝',
                deploy: '🚀',
                decision: '⚖️',
                bug: '🐛',
                idea: '💡',
                note: '📌',
            }

            const icon = icons[category ?? 'note']
            const logEntry = `\n### ${icon} ${timeStr} — ${category ?? 'note'}\n${entry}\n`

            if (!existsSync(journalFile)) {
                writeFileSync(journalFile, `# Dev Journal — ${dateStr}\n${logEntry}`)
            } else {
                appendFileSync(journalFile, logEntry)
            }

            // Also log current git status
            const gitStatus = safeExec('git log -1 --oneline 2>/dev/null')

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `✅ Logged to ${dateStr}.md\nLatest commit: ${gitStatus}`,
                    },
                ],
            }
        } catch (err) {
            return {
                content: [{ type: 'text' as const, text: `Journal error: ${sanitizeError(err)}` }],
                isError: true,
            }
        }
    }
)

// ─── Tool: kernel_agent_create ───────────────────────────────
server.tool(
    'kernel_agent_create',
    'Create a temporary specialist agent with a custom system prompt and immediately ask it a question. The agent exists only for this single call — no state is persisted. Costs one API call. Use this for task-specific expertise that does not fit existing agents (e.g., "UX Critic", "Security Auditor", "API Design Reviewer"). For persistent agents, use the agent definition files in .claude/agents/ instead.',
    {
        name: z.string().min(1).max(100).describe('Human-readable agent name displayed in the response header (e.g., "Security Auditor")'),
        system_prompt: z.string().min(10).max(10000).describe('System prompt defining this agent\'s personality, expertise, and response style'),
        question: z.string().min(1).max(50000).describe('The question or task to ask this agent'),
        model: z.enum(['sonnet', 'haiku']).optional().describe('AI model: "sonnet" (more capable, 12x cost) or "haiku" (fast, cheap). Default: haiku'),
    },
    async ({ name, system_prompt, question, model }) => {
        try {
            const result = await callProxy(question, {
                system: system_prompt,
                model: model ?? 'haiku',
                max_tokens: 2048,
            })

            return {
                content: [{ type: 'text' as const, text: `[${name}]\n\n${result}` }],
            }
        } catch (err) {
            return {
                content: [{ type: 'text' as const, text: `Agent error: ${sanitizeError(err)}` }],
                isError: true,
            }
        }
    }
)

// ─── Tool: kernel_codemod ────────────────────────────────────
server.tool(
    'kernel_codemod',
    'Run automated code transformations across TypeScript/React source files. Three modes: "find_replace" applies regex substitution, "rename_symbol" renames a specific identifier using word boundaries, "ai_refactor" sends matching code to Sonnet for refactoring suggestions (no automatic apply). Side effects: "find_replace" and "rename_symbol" modify files on disk when preview=false. ALWAYS use preview=true first to review changes before applying. Scoped to src/ directory only.',
    {
        action: z.enum(['find_replace', 'rename_symbol', 'ai_refactor']).describe('"find_replace" uses regex. "rename_symbol" uses word-boundary matching. "ai_refactor" generates suggestions only (never auto-applies).'),
        pattern: z.string().min(1).max(1000).describe('For find_replace: regex pattern. For rename_symbol: current symbol name. For ai_refactor: natural language description of the refactoring.'),
        replacement: z.string().max(1000).optional().describe('Replacement string. Required for find_replace and rename_symbol. Not used for ai_refactor.'),
        file_glob: z.string().max(200).optional().describe('File glob filter. Currently fixed to src/**/*.{ts,tsx} regardless of value.'),
        preview: z.boolean().optional().describe('If true (default), shows matching lines without applying changes. Set to false to actually modify files. ALWAYS preview first.'),
    },
    async ({ action, pattern, replacement, file_glob, preview }) => {
        const dryRun = preview !== false

        // Safe file discovery — uses fixed command, no user input
        function findSourceFiles(): string[] {
            const raw = safeExec(`find src/ -name "*.ts" -o -name "*.tsx"`)
            return raw.split('\n').filter(f => f.trim() && !f.includes('node_modules'))
        }

        // Safe regex search across files using Node.js (no shell injection)
        function searchFiles(regex: RegExp, files: string[]): { file: string; line: number; text: string }[] {
            const results: { file: string; line: number; text: string }[] = []
            for (const f of files) {
                const absPath = join(PROJECT_ROOT, f)
                if (!existsSync(absPath)) continue
                const lines = readFileSync(absPath, 'utf-8').split('\n')
                lines.forEach((ln, i) => {
                    regex.lastIndex = 0
                    if (regex.test(ln)) {
                        results.push({ file: f, line: i + 1, text: ln.trim() })
                    }
                })
                if (results.length >= 100) break
            }
            return results
        }

        try {
            if (action === 'find_replace') {
                if (!replacement) {
                    return { content: [{ type: 'text' as const, text: 'Replacement string required for find_replace' }], isError: true }
                }

                let regex: RegExp
                try { regex = new RegExp(pattern, 'g') } catch (e) {
                    return { content: [{ type: 'text' as const, text: `Invalid regex: ${pattern}` }], isError: true }
                }

                const files = findSourceFiles()
                const matches = searchFiles(regex, files)

                if (matches.length === 0) {
                    return { content: [{ type: 'text' as const, text: `No matches found for pattern: ${pattern}` }] }
                }

                const matchText = matches.slice(0, 30).map(m => `${m.file}:${m.line}: ${m.text}`).join('\n')

                if (dryRun) {
                    return {
                        content: [{
                            type: 'text' as const,
                            text: `🔍 Preview (dry run):\n\nPattern: ${pattern}\nReplacement: ${replacement}\n${matches.length} match(es):\n${matchText}\n\nRe-run with preview=false to apply.`,
                        }],
                    }
                }

                // Apply using Node.js fs (safe — no shell)
                const modified: string[] = []
                for (const f of files) {
                    const absPath = join(PROJECT_ROOT, f)
                    if (!existsSync(absPath)) continue
                    const content = readFileSync(absPath, 'utf-8')
                    regex.lastIndex = 0
                    const newContent = content.replace(regex, replacement)
                    if (newContent !== content) {
                        writeFileSync(absPath, newContent)
                        modified.push(f)
                    }
                }
                return { content: [{ type: 'text' as const, text: `✅ Applied find/replace to ${modified.length} file(s).\n\nModified:\n${modified.join('\n')}` }] }
            }

            if (action === 'rename_symbol') {
                if (!replacement) {
                    return { content: [{ type: 'text' as const, text: 'Replacement name required for rename_symbol' }], isError: true }
                }

                let regex: RegExp
                try { regex = new RegExp(`\\b${pattern}\\b`, 'g') } catch (e) {
                    return { content: [{ type: 'text' as const, text: `Invalid symbol name: ${pattern}` }], isError: true }
                }

                const files = findSourceFiles()
                const matches = searchFiles(regex, files)
                const matchText = matches.slice(0, 30).map(m => `${m.file}:${m.line}: ${m.text}`).join('\n')

                if (dryRun) {
                    return {
                        content: [{
                            type: 'text' as const,
                            text: `🔍 Preview (dry run):\n\nRename: ${pattern} → ${replacement}\n${matches.length} match(es):\n${matchText}\n\nRe-run with preview=false to apply.`,
                        }],
                    }
                }

                const modified: string[] = []
                for (const f of files) {
                    const absPath = join(PROJECT_ROOT, f)
                    if (!existsSync(absPath)) continue
                    const content = readFileSync(absPath, 'utf-8')
                    regex.lastIndex = 0
                    const newContent = content.replace(regex, replacement)
                    if (newContent !== content) {
                        writeFileSync(absPath, newContent)
                        modified.push(f)
                    }
                }
                return { content: [{ type: 'text' as const, text: `✅ Renamed ${pattern} → ${replacement} in ${modified.length} file(s).\n\nModified:\n${modified.join('\n')}` }] }
            }

            if (action === 'ai_refactor') {
                const files = findSourceFiles()
                let regex: RegExp
                try { regex = new RegExp(pattern, 'g') } catch { regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g') }
                const matches = searchFiles(regex, files)
                const matchText = matches.slice(0, 20).map(m => `${m.file}:${m.line}: ${m.text}`).join('\n')
                const fileList = files.slice(0, 20).join('\n')

                const suggestion = await callProxy(
                    `I need to refactor this TypeScript/React codebase. The task: "${pattern}"\n\nRelevant matches:\n${matchText}\n\nFiles in project:\n${fileList}\n\nProvide specific, actionable refactoring steps with code examples.`,
                    {
                        system: 'You are a senior TypeScript/React refactoring specialist. Be specific with file paths and code changes.',
                        model: 'sonnet',
                        max_tokens: 2048,
                    }
                )

                return { content: [{ type: 'text' as const, text: `🤖 AI Refactoring Suggestions:\n\n${suggestion}` }] }
            }

            return { content: [{ type: 'text' as const, text: 'Unknown action' }], isError: true }
        } catch (err) {
            return {
                content: [{ type: 'text' as const, text: `Codemod error: ${sanitizeError(err)}` }],
                isError: true,
            }
        }
    }
)

// ── Global error handling ────────────────────────────────────
process.on('uncaughtException', (err) => {
    console.error('[kernel-tools] Uncaught exception:', err.message)
    process.exit(1)
})

process.on('unhandledRejection', (reason) => {
    console.error('[kernel-tools] Unhandled rejection:', reason)
    process.exit(1)
})

// ── Start ────────────────────────────────────────────────────
const transport = new StdioServerTransport()
server.connect(transport).catch((err) => {
    console.error('[kernel-tools] Failed to connect:', err.message)
    process.exit(1)
})
