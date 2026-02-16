#!/usr/bin/env npx tsx
// Kernel Agent MCP Server — gives Claude Code access to Kernel's specialist agents
// Connects to the Supabase claude-proxy to delegate queries to specialists

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const PROXY_URL = `${SUPABASE_URL}/functions/v1/claude-proxy`

// ── Supabase client (service role for admin access) ──────────
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ── Specialist definitions ───────────────────────────────────
const SPECIALISTS: Record<string, { name: string; systemPrompt: string }> = {
    kernel: {
        name: 'Kernel',
        systemPrompt: `You are the Kernel — a personal AI thinking partner. Warm, sharp, real. Like a brilliant friend who actually listens. Short paragraphs. 2-4 sentences per thought. Never robotic. Never corporate.`,
    },
    researcher: {
        name: 'Researcher',
        systemPrompt: `You are the Kernel's research mode. Go deep on questions. Break complex questions into sub-questions. Cite sources naturally. Distinguish between established facts and speculation. Quantify when possible.`,
    },
    coder: {
        name: 'Coder',
        systemPrompt: `You are the Kernel's coding mode. Write code that works. Prefer clarity over cleverness. Match the user's stack and style. If the problem is ambiguous, clarify assumptions before writing code.`,
    },
    writer: {
        name: 'Writer',
        systemPrompt: `You are the Kernel's writing mode. Every word earns its place. Strong openings. Cut filler. Vary sentence length for rhythm. Show, don't tell. Concrete details over abstract claims.`,
    },
    analyst: {
        name: 'Analyst',
        systemPrompt: `You are the Kernel's analytical mode. Structure the problem before solving it. Consider multiple angles: economic, technical, human, temporal. Challenge assumptions respectfully. End with clear recommendation.`,
    },
}

// ── Helper: Call claude-proxy ────────────────────────────────
async function callProxy(
    prompt: string,
    opts: {
        system?: string
        model?: 'sonnet' | 'haiku'
        max_tokens?: number
        web_search?: boolean
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
            web_search: opts.web_search ?? false,
        }),
    })

    if (!res.ok) {
        const err = await res.text()
        throw new Error(`Claude proxy error (${res.status}): ${err}`)
    }

    const { text } = await res.json()
    return text
}

// ── MCP Server ───────────────────────────────────────────────

const server = new McpServer({
    name: 'kernel-agent',
    version: '1.0.0',
})

// Tool: kernel_query — Ask any specialist agent a question
server.tool(
    'kernel_query',
    'Ask a Kernel specialist agent a question. Routes through the Supabase claude-proxy. Use this for research, analysis, code review, or writing tasks that benefit from a focused specialist perspective.',
    {
        specialist: z
            .enum(['kernel', 'researcher', 'coder', 'writer', 'analyst'])
            .describe('Which specialist to query: kernel (general), researcher (research/facts), coder (programming), writer (content), analyst (strategy/evaluation)'),
        prompt: z.string().describe('The question or task for the specialist'),
        model: z
            .enum(['sonnet', 'haiku'])
            .optional()
            .describe('Model to use: sonnet (powerful, slower) or haiku (fast, cheaper). Default: haiku'),
        web_search: z
            .boolean()
            .optional()
            .describe('Enable web search for current events/facts. Default: false'),
    },
    async ({ specialist, prompt, model, web_search }) => {
        const spec = SPECIALISTS[specialist]
        if (!spec) {
            return {
                content: [{ type: 'text' as const, text: `Unknown specialist: ${specialist}` }],
                isError: true,
            }
        }

        try {
            const result = await callProxy(prompt, {
                system: spec.systemPrompt,
                model: model ?? 'haiku',
                web_search: web_search ?? false,
            })
            return {
                content: [{ type: 'text' as const, text: `[${spec.name}]\n\n${result}` }],
            }
        } catch (err) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Error querying ${spec.name}: ${err instanceof Error ? err.message : String(err)}`,
                    },
                ],
                isError: true,
            }
        }
    }
)

// Tool: kernel_memory — Read user memory profiles from Supabase
server.tool(
    'kernel_memory',
    'Read or search user memory profiles stored in the Kernel database. Useful for understanding user context, preferences, and history.',
    {
        action: z.enum(['list_users', 'get_profile', 'search']).describe('Action: list_users, get_profile, or search'),
        user_id: z.string().optional().describe('User ID for get_profile action'),
        query: z.string().optional().describe('Search query for search action'),
    },
    async ({ action, user_id, query }) => {
        try {
            if (action === 'list_users') {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, display_name, email, created_at')
                    .order('created_at', { ascending: false })
                    .limit(20)

                if (error) throw error
                return {
                    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
                }
            }

            if (action === 'get_profile' && user_id) {
                // Get profile
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user_id)
                    .single()

                if (profileError) throw profileError

                // Get memory
                const { data: memory } = await supabase
                    .from('user_memory')
                    .select('*')
                    .eq('user_id', user_id)
                    .single()

                // Get recent conversations
                const { data: conversations } = await supabase
                    .from('conversations')
                    .select('id, title, created_at, message_count')
                    .eq('user_id', user_id)
                    .order('created_at', { ascending: false })
                    .limit(5)

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify({ profile, memory, recent_conversations: conversations }, null, 2),
                        },
                    ],
                }
            }

            if (action === 'search' && query) {
                // Search conversations by content
                const { data, error } = await supabase
                    .from('messages')
                    .select('id, conversation_id, role, content, created_at')
                    .textSearch('content', query)
                    .limit(10)

                if (error) throw error
                return {
                    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
                }
            }

            return {
                content: [{ type: 'text' as const, text: 'Invalid action or missing parameters' }],
                isError: true,
            }
        } catch (err) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Database error: ${err instanceof Error ? err.message : String(err)}`,
                    },
                ],
                isError: true,
            }
        }
    }
)

// Tool: kernel_status — Get Kernel platform health/metrics
server.tool(
    'kernel_status',
    'Get Kernel platform health metrics: user count, conversation count, recent activity, and edge function status.',
    {},
    async () => {
        try {
            const [users, conversations, messages] = await Promise.all([
                supabase.from('profiles').select('id', { count: 'exact', head: true }),
                supabase.from('conversations').select('id', { count: 'exact', head: true }),
                supabase
                    .from('messages')
                    .select('id, created_at')
                    .order('created_at', { ascending: false })
                    .limit(1),
            ])

            const status = {
                total_users: users.count ?? 'unknown',
                total_conversations: conversations.count ?? 'unknown',
                last_message_at: messages.data?.[0]?.created_at ?? 'no messages',
                supabase_url: SUPABASE_URL,
                proxy_url: PROXY_URL,
            }

            return {
                content: [{ type: 'text' as const, text: JSON.stringify(status, null, 2) }],
            }
        } catch (err) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Status check failed: ${err instanceof Error ? err.message : String(err)}`,
                    },
                ],
                isError: true,
            }
        }
    }
)

// Tool: kernel_swarm — Multi-agent query (2-4 agents collaborate)
server.tool(
    'kernel_swarm',
    'Ask multiple specialist agents to collaborate on a complex question. Each contributes their perspective, then results are synthesized. Best for strategic decisions, evaluations, or multi-domain questions.',
    {
        prompt: z.string().describe('The complex question or task'),
        agents: z
            .array(z.enum(['kernel', 'researcher', 'coder', 'writer', 'analyst']))
            .min(2)
            .max(4)
            .describe('Which specialists should collaborate (2-4)'),
    },
    async ({ prompt, agents }) => {
        try {
            // Phase 1: Parallel contributions from each agent
            const contributions = await Promise.all(
                agents.map(async (agentId) => {
                    const spec = SPECIALISTS[agentId]
                    try {
                        const result = await callProxy(
                            `${prompt}\n\nProvide your focused perspective in 2-3 concise paragraphs. Be specific and actionable.`,
                            {
                                system: spec.systemPrompt,
                                model: 'haiku',
                                max_tokens: 600,
                                web_search: agentId === 'researcher',
                            }
                        )
                        return { name: spec.name, contribution: result }
                    } catch {
                        return { name: spec.name, contribution: '' }
                    }
                })
            )

            const validContributions = contributions.filter((c) => c.contribution)

            if (validContributions.length === 0) {
                return {
                    content: [{ type: 'text' as const, text: 'All agents failed to respond.' }],
                    isError: true,
                }
            }

            // Phase 2: Synthesize
            const contributionText = validContributions
                .map((c) => `## ${c.name}\n${c.contribution}`)
                .join('\n\n---\n\n')

            const synthesis = await callProxy(
                `Synthesize these specialist perspectives into one cohesive response:\n\nQuestion: ${prompt}\n\n---\n\n${contributionText}\n\n---\n\nGive a unified, actionable response. Don't mention the agents.`,
                {
                    system: `You synthesize multi-agent perspectives into clear, unified responses. Be concise and actionable.`,
                    model: 'sonnet',
                    max_tokens: 2048,
                }
            )

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `[Swarm: ${agents.join(', ')}]\n\n${synthesis}`,
                    },
                ],
            }
        } catch (err) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Swarm error: ${err instanceof Error ? err.message : String(err)}`,
                    },
                ],
                isError: true,
            }
        }
    }
)

// Tool: kernel_search — Web search via Perplexity edge function
server.tool(
    'kernel_search',
    'Search the web for current information using Perplexity AI. Returns real-time results with citations. Great for researching APIs, libraries, current events, or market data.',
    {
        query: z.string().describe('Search query'),
        focus: z
            .enum(['general', 'academic', 'news', 'code'])
            .optional()
            .describe('Search focus area. Default: general'),
    },
    async ({ query, focus }) => {
        try {
            const res = await fetch(`${SUPABASE_URL}/functions/v1/web-search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${SERVICE_KEY}`,
                    apikey: SUPABASE_KEY,
                },
                body: JSON.stringify({ query, focus: focus ?? 'general' }),
            })

            if (!res.ok) {
                const err = await res.text()
                throw new Error(`Search error (${res.status}): ${err}`)
            }

            const data = await res.json()
            return {
                content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
            }
        } catch (err) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Search failed: ${err instanceof Error ? err.message : String(err)}`,
                    },
                ],
                isError: true,
            }
        }
    }
)

// Tool: kernel_fetch — Fetch and extract content from any URL
server.tool(
    'kernel_fetch',
    'Fetch a URL and extract its text content (strips HTML, returns clean text). Useful for reading documentation, blog posts, release notes, or any web page.',
    {
        url: z.string().url().describe('URL to fetch and extract content from'),
        max_length: z
            .number()
            .optional()
            .describe('Max characters to return. Default: 5000'),
    },
    async ({ url, max_length }) => {
        try {
            const res = await fetch(`${SUPABASE_URL}/functions/v1/url-fetch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${SERVICE_KEY}`,
                    apikey: SUPABASE_KEY,
                },
                body: JSON.stringify({ url, max_length: max_length ?? 5000 }),
            })

            if (!res.ok) {
                const err = await res.text()
                throw new Error(`Fetch error (${res.status}): ${err}`)
            }

            const data = await res.json()
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
                    },
                ],
            }
        } catch (err) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Fetch failed: ${err instanceof Error ? err.message : String(err)}`,
                    },
                ],
                isError: true,
            }
        }
    }
)

// Tool: kernel_evaluate — Score conversation/content quality
server.tool(
    'kernel_evaluate',
    'Evaluate the quality of a conversation or piece of content. Returns scores for depth, engagement, clarity, and actionability. Useful for grading AI outputs or content drafts.',
    {
        content: z.string().describe('The content or conversation to evaluate'),
        criteria: z
            .string()
            .optional()
            .describe('Custom evaluation criteria. Default: depth, engagement, clarity, actionability'),
    },
    async ({ content, criteria }) => {
        try {
            const res = await fetch(`${SUPABASE_URL}/functions/v1/evaluate-chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${SERVICE_KEY}`,
                    apikey: SUPABASE_KEY,
                },
                body: JSON.stringify({ content, criteria }),
            })

            if (!res.ok) {
                const err = await res.text()
                throw new Error(`Evaluate error (${res.status}): ${err}`)
            }

            const data = await res.json()
            return {
                content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
            }
        } catch (err) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Evaluation failed: ${err instanceof Error ? err.message : String(err)}`,
                    },
                ],
                isError: true,
            }
        }
    }
)

// Tool: kernel_insights — Extract key insights from content
server.tool(
    'kernel_insights',
    'Extract structured insights from a conversation or text block. Returns key takeaways, action items, decisions made, and open questions. Great for summarizing long conversations or meetings.',
    {
        content: z.string().describe('The content to extract insights from'),
        focus: z
            .enum(['takeaways', 'actions', 'decisions', 'questions', 'all'])
            .optional()
            .describe('What to focus on extracting. Default: all'),
    },
    async ({ content, focus }) => {
        try {
            const res = await fetch(`${SUPABASE_URL}/functions/v1/extract-insights`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${SERVICE_KEY}`,
                    apikey: SUPABASE_KEY,
                },
                body: JSON.stringify({ content, focus: focus ?? 'all' }),
            })

            if (!res.ok) {
                const err = await res.text()
                throw new Error(`Insights error (${res.status}): ${err}`)
            }

            const data = await res.json()
            return {
                content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
            }
        } catch (err) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Insight extraction failed: ${err instanceof Error ? err.message : String(err)}`,
                    },
                ],
                isError: true,
            }
        }
    }
)

// Tool: kernel_analytics — Platform analytics and user metrics
server.tool(
    'kernel_analytics',
    'Query Kernel platform analytics: user growth, conversation trends, agent usage, engagement metrics, and revenue data. Useful for business intelligence and platform health monitoring.',
    {
        metric: z
            .enum([
                'user_growth',
                'conversation_trends',
                'agent_usage',
                'engagement',
                'top_users',
                'revenue',
            ])
            .describe('Which metric to query'),
        days: z
            .number()
            .optional()
            .describe('Number of days to look back. Default: 30'),
    },
    async ({ metric, days }) => {
        const lookback = days ?? 30
        const since = new Date(Date.now() - lookback * 24 * 60 * 60 * 1000).toISOString()

        try {
            let result: unknown

            switch (metric) {
                case 'user_growth': {
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('id, created_at')
                        .gte('created_at', since)
                        .order('created_at', { ascending: true })

                    if (error) throw error
                    result = {
                        new_users: data?.length ?? 0,
                        period: `last ${lookback} days`,
                        users: data,
                    }
                    break
                }

                case 'conversation_trends': {
                    const { data, error } = await supabase
                        .from('conversations')
                        .select('id, title, created_at, message_count')
                        .gte('created_at', since)
                        .order('created_at', { ascending: false })
                        .limit(50)

                    if (error) throw error
                    const totalMessages = data?.reduce((sum, c) => sum + (c.message_count || 0), 0) ?? 0
                    result = {
                        total_conversations: data?.length ?? 0,
                        total_messages: totalMessages,
                        avg_messages_per_conversation: data?.length ? Math.round(totalMessages / data.length) : 0,
                        period: `last ${lookback} days`,
                        conversations: data?.slice(0, 10),
                    }
                    break
                }

                case 'agent_usage': {
                    const { data, error } = await supabase
                        .from('messages')
                        .select('agent_id, created_at')
                        .gte('created_at', since)
                        .not('agent_id', 'is', null)

                    if (error) throw error
                    const usage: Record<string, number> = {}
                    data?.forEach((m) => {
                        usage[m.agent_id] = (usage[m.agent_id] || 0) + 1
                    })
                    result = {
                        period: `last ${lookback} days`,
                        total_agent_messages: data?.length ?? 0,
                        by_agent: usage,
                    }
                    break
                }

                case 'engagement': {
                    const { data: convos, error: convosError } = await supabase
                        .from('conversations')
                        .select('id, message_count, created_at')
                        .gte('created_at', since)

                    if (convosError) throw convosError

                    const { count: totalUsers } = await supabase
                        .from('profiles')
                        .select('id', { count: 'exact', head: true })

                    result = {
                        total_users: totalUsers ?? 0,
                        active_conversations: convos?.length ?? 0,
                        total_messages: convos?.reduce((s, c) => s + (c.message_count || 0), 0) ?? 0,
                        period: `last ${lookback} days`,
                    }
                    break
                }

                case 'top_users': {
                    const { data, error } = await supabase
                        .from('conversations')
                        .select('user_id, id')
                        .gte('created_at', since)

                    if (error) throw error
                    const userCounts: Record<string, number> = {}
                    data?.forEach((c) => {
                        userCounts[c.user_id] = (userCounts[c.user_id] || 0) + 1
                    })
                    const sorted = Object.entries(userCounts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 10)
                    result = {
                        period: `last ${lookback} days`,
                        top_users: sorted.map(([id, count]) => ({ user_id: id, conversations: count })),
                    }
                    break
                }

                case 'revenue': {
                    // Check for subscription/payment data
                    const { data, error } = await supabase
                        .from('subscriptions')
                        .select('*')
                        .gte('created_at', since)
                        .order('created_at', { ascending: false })

                    if (error) {
                        result = { note: 'Subscriptions table not available or empty', error: error.message }
                    } else {
                        result = {
                            period: `last ${lookback} days`,
                            subscriptions: data,
                        }
                    }
                    break
                }
            }

            return {
                content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
            }
        } catch (err) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Analytics error: ${err instanceof Error ? err.message : String(err)}`,
                    },
                ],
                isError: true,
            }
        }
    }
)

// ── Start ────────────────────────────────────────────────────
const transport = new StdioServerTransport()
await server.connect(transport)
