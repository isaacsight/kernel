#!/usr/bin/env npx tsx
// Kernel Extended Tools MCP Server — additional utilities for Claude Code
// Provides: notify, stripe, deploy_status, design_lint, diff_review, seo, debate, journal, agent_create, codemod

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { config } from 'dotenv'
import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs'
import { join } from 'path'

config()

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

// ── MCP Server ───────────────────────────────────────────────
const server = new McpServer({
    name: 'kernel-tools',
    version: '1.0.0',
})

// ─── Tool: kernel_notify ─────────────────────────────────────
server.tool(
    'kernel_notify',
    'Send a notification to yourself via Discord webhook or email. Use this to alert when long tasks complete, deploys finish, or errors occur.',
    {
        channel: z.enum(['discord', 'email']).describe('Notification channel'),
        message: z.string().describe('The notification message'),
        subject: z.string().optional().describe('Email subject (email channel only)'),
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

                const res = await fetch(`${SUPABASE_URL}/functions/v1/notify-webhook`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${SERVICE_KEY}`,
                        apikey: SUPABASE_KEY,
                    },
                    body: JSON.stringify({
                        webhook_url: webhookUrl,
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
                content: [{ type: 'text' as const, text: `Notify error: ${err instanceof Error ? err.message : String(err)}` }],
                isError: true,
            }
        }
    }
)

// ─── Tool: kernel_stripe ─────────────────────────────────────
server.tool(
    'kernel_stripe',
    'Query Stripe payment data: active subscriptions, recent charges, revenue summary, or customer list. Uses the Supabase edge functions for Stripe operations.',
    {
        action: z
            .enum(['revenue_summary', 'active_subscriptions', 'recent_charges', 'create_coupon'])
            .describe('What to query or do'),
        coupon_percent: z.number().optional().describe('Discount percentage for create_coupon action'),
        coupon_name: z.string().optional().describe('Coupon name for create_coupon action'),
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
                content: [{ type: 'text' as const, text: `Stripe error: ${err instanceof Error ? err.message : String(err)}` }],
                isError: true,
            }
        }
    }
)

// ─── Tool: kernel_deploy_status ──────────────────────────────
server.tool(
    'kernel_deploy_status',
    'Check the health and status of the deployed GitHub Pages site. Returns HTTP status, response time, page title, and last deploy info.',
    {},
    async () => {
        try {
            const siteUrl = 'https://isaacsight.github.io/does-this-feel-right-/'
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
                content: [{ type: 'text' as const, text: `Deploy status error: ${err instanceof Error ? err.message : String(err)}` }],
                isError: true,
            }
        }
    }
)

// ─── Tool: kernel_design_lint ────────────────────────────────
server.tool(
    'kernel_design_lint',
    'Check if code follows the Kernel Rubin design system. Scans for: EB Garamond usage, ivory/warm palette, correct design tokens, semantic HTML, and accessibility. Returns violations.',
    {
        file_path: z.string().optional().describe('Specific file to lint (relative path). If omitted, lints recent git changes.'),
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
                content: [{ type: 'text' as const, text: `Design lint error: ${err instanceof Error ? err.message : String(err)}` }],
                isError: true,
            }
        }
    }
)

// ─── Tool: kernel_diff_review ────────────────────────────────
server.tool(
    'kernel_diff_review',
    'AI-powered code review of the current git diff. Feeds your changes to the Coder specialist for analysis. Returns quality rating, issues, and suggestions.',
    {
        staged_only: z.boolean().optional().describe('Review only staged changes. Default: false (all changes)'),
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
                content: [{ type: 'text' as const, text: `Review error: ${err instanceof Error ? err.message : String(err)}` }],
                isError: true,
            }
        }
    }
)

// ─── Tool: kernel_seo ────────────────────────────────────────
server.tool(
    'kernel_seo',
    'Audit the SEO of the live Kernel site or any URL. Checks meta tags, Open Graph, headings, structured data, mobile viewport, and canonical URLs.',
    {
        url: z.string().optional().describe('URL to audit. Default: the live Kernel site'),
    },
    async ({ url }) => {
        try {
            const targetUrl = url ?? 'https://isaacsight.github.io/does-this-feel-right-/'
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
                content: [{ type: 'text' as const, text: `SEO audit error: ${err instanceof Error ? err.message : String(err)}` }],
                isError: true,
            }
        }
    }
)

// ─── Tool: kernel_debate ─────────────────────────────────────
server.tool(
    'kernel_debate',
    'Pit two specialist agents against each other on a topic. One argues FOR, one argues AGAINST. Produces a structured debate with conclusion. Great for evaluating tradeoffs and design decisions.',
    {
        topic: z.string().describe('The topic or question to debate'),
        agent_for: z
            .enum(['kernel', 'researcher', 'coder', 'writer', 'analyst'])
            .describe('Agent arguing FOR'),
        agent_against: z
            .enum(['kernel', 'researcher', 'coder', 'writer', 'analyst'])
            .describe('Agent arguing AGAINST'),
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
                content: [{ type: 'text' as const, text: `Debate error: ${err instanceof Error ? err.message : String(err)}` }],
                isError: true,
            }
        }
    }
)

// ─── Tool: kernel_journal ────────────────────────────────────
server.tool(
    'kernel_journal',
    'Log a development journal entry. Auto-appends to a daily markdown file with timestamps. Tracks commits, deploys, decisions, and notes. Creates a running dev log.',
    {
        entry: z.string().describe('The journal entry to log'),
        category: z
            .enum(['commit', 'deploy', 'decision', 'bug', 'idea', 'note'])
            .optional()
            .describe('Entry category. Default: note'),
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
                content: [{ type: 'text' as const, text: `Journal error: ${err instanceof Error ? err.message : String(err)}` }],
                isError: true,
            }
        }
    }
)

// ─── Tool: kernel_agent_create ───────────────────────────────
server.tool(
    'kernel_agent_create',
    'Create a new specialist agent on-the-fly with a custom system prompt. The agent is temporary and exists only for this session. Useful for task-specific expertise.',
    {
        name: z.string().describe('Agent name (e.g., "Security Auditor", "UX Critic")'),
        system_prompt: z.string().describe('The system prompt defining this agent\'s personality and expertise'),
        question: z.string().describe('The first question to ask this agent'),
        model: z.enum(['sonnet', 'haiku']).optional().describe('Model to use. Default: haiku'),
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
                content: [{ type: 'text' as const, text: `Agent error: ${err instanceof Error ? err.message : String(err)}` }],
                isError: true,
            }
        }
    }
)

// ─── Tool: kernel_codemod ────────────────────────────────────
server.tool(
    'kernel_codemod',
    'Run automated code transformations across the project. Supports find-and-replace with regex, rename patterns, or AI-powered refactoring. Preview mode shows changes without applying.',
    {
        action: z.enum(['find_replace', 'rename_symbol', 'ai_refactor']).describe('Type of transformation'),
        pattern: z.string().describe('Search pattern (regex for find_replace, symbol name for rename, description for ai_refactor)'),
        replacement: z.string().optional().describe('Replacement string (for find_replace and rename_symbol)'),
        file_glob: z.string().optional().describe('File glob filter (e.g., "src/**/*.tsx"). Default: "src/**/*.{ts,tsx}"'),
        preview: z.boolean().optional().describe('Preview changes without applying. Default: true'),
    },
    async ({ action, pattern, replacement, file_glob, preview }) => {
        const glob = file_glob ?? 'src/**/*.{ts,tsx}'
        const dryRun = preview !== false

        try {
            if (action === 'find_replace') {
                if (!replacement) {
                    return { content: [{ type: 'text' as const, text: 'Replacement string required for find_replace' }], isError: true }
                }

                // Find matches first
                const matches = safeExec(`grep -rn "${pattern}" --include="*.ts" --include="*.tsx" src/ | head -30`)

                if (!matches) {
                    return { content: [{ type: 'text' as const, text: `No matches found for pattern: ${pattern}` }] }
                }

                if (dryRun) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: `🔍 Preview (dry run):\n\nPattern: ${pattern}\nReplacement: ${replacement}\nMatches:\n${matches}\n\nRe-run with preview=false to apply.`,
                            },
                        ],
                    }
                }

                // Apply
                const result = safeExec(`find src/ -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/${pattern}/${replacement}/g'`)
                return { content: [{ type: 'text' as const, text: `✅ Applied find/replace.\n\nBefore:\n${matches}\n\n${result}` }] }
            }

            if (action === 'rename_symbol') {
                if (!replacement) {
                    return { content: [{ type: 'text' as const, text: 'Replacement name required for rename_symbol' }], isError: true }
                }

                const matches = safeExec(`grep -rn "\\b${pattern}\\b" --include="*.ts" --include="*.tsx" src/ | head -30`)

                if (dryRun) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: `🔍 Preview (dry run):\n\nRename: ${pattern} → ${replacement}\nMatches:\n${matches}\n\nRe-run with preview=false to apply.`,
                            },
                        ],
                    }
                }

                const result = safeExec(`find src/ -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/\\b${pattern}\\b/${replacement}/g'`)
                return { content: [{ type: 'text' as const, text: `✅ Renamed ${pattern} → ${replacement}\n${result}` }] }
            }

            if (action === 'ai_refactor') {
                // Use Claude to suggest refactoring
                const files = safeExec(`find src/ -name "*.ts" -o -name "*.tsx" | head -20`)
                const relevantCode = safeExec(`grep -rn "${pattern}" --include="*.ts" --include="*.tsx" src/ | head -20`)

                const suggestion = await callProxy(
                    `I need to refactor this TypeScript/React codebase. The task: "${pattern}"\n\nRelevant matches:\n${relevantCode}\n\nFiles in project:\n${files}\n\nProvide specific, actionable refactoring steps with code examples.`,
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
                content: [{ type: 'text' as const, text: `Codemod error: ${err instanceof Error ? err.message : String(err)}` }],
                isError: true,
            }
        }
    }
)

// ── Start ────────────────────────────────────────────────────
const transport = new StdioServerTransport()
await server.connect(transport)
