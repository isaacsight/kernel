#!/usr/bin/env npx tsx
// Kernel Agent MCP Server — gives Claude Code access to Kernel's specialist agents
// Connects to the Supabase claude-proxy to delegate queries to specialists
//
// SECURITY: Requires SUPABASE_SERVICE_KEY for database access. All AI queries
// route through the claude-proxy edge function (never direct API calls).

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

// ── Input validation helpers ───────────────────────────────
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function sanitizeError(err: unknown): string {
  if (err instanceof Error) {
    return err.message
      .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
      .replace(/apikey\s+\S+/gi, 'apikey [REDACTED]')
      .replace(/https?:\/\/[^\s]+/g, '[URL]')
  }
  return 'An unexpected error occurred'
}

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
    'Send a query to one of five Kernel specialist agents, each with a focused system prompt. Routes through the Supabase claude-proxy edge function. Use this when you need a specialized perspective: "researcher" for fact-finding and citations, "coder" for programming help, "writer" for content, "analyst" for strategy, or "kernel" for general conversation. Each call costs API tokens based on the selected model. Does not retain conversation history between calls — each request is stateless.',
    {
        specialist: z
            .enum(['kernel', 'researcher', 'coder', 'writer', 'analyst'])
            .describe('Which specialist to query: kernel (general/personal), researcher (research/facts/citations), coder (programming/debugging), writer (content/copy), analyst (strategy/evaluation)'),
        prompt: z.string().min(1).max(50000).describe('The question or task for the specialist. Must be non-empty. Long prompts are supported but cost more tokens.'),
        model: z
            .enum(['sonnet', 'haiku'])
            .optional()
            .describe('AI model to use. "sonnet" is more capable but slower and costs ~12x more. "haiku" is fast and cheap. Default: haiku'),
        web_search: z
            .boolean()
            .optional()
            .describe('Enable web search for current events, real-time data, or fact verification. Adds latency. Default: false'),
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
                        text: `Error querying ${spec.name}: ${sanitizeError(err)}`,
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
    'Read or search user memory profiles stored in the Kernel Supabase database. Supports three actions: "list_users" returns recent user profiles (max 20), "get_profile" retrieves a specific user\'s full profile including memory and recent conversations, "search" performs full-text search across message content. Read-only operation with no side effects. Requires valid user_id for get_profile, valid query for search.',
    {
        action: z.enum(['list_users', 'get_profile', 'search']).describe('"list_users" returns up to 20 recent profiles. "get_profile" requires user_id. "search" requires query string.'),
        user_id: z.string().uuid().optional().describe('User UUID — required when action is "get_profile"'),
        query: z.string().min(1).max(500).optional().describe('Full-text search query — required when action is "search"'),
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
                        text: `Database error: ${sanitizeError(err)}`,
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
    'Retrieve Kernel platform health metrics including total user count, total conversation count, timestamp of the most recent message, and configured Supabase/proxy URLs. Use this as a quick health check to verify the platform is operational. Read-only operation with no side effects.',
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
                supabase_configured: !!SUPABASE_URL,
                proxy_configured: !!PROXY_URL,
            }

            return {
                content: [{ type: 'text' as const, text: JSON.stringify(status, null, 2) }],
            }
        } catch (err) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Status check failed: ${sanitizeError(err)}`,
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
    'Run a multi-agent collaboration where 2-4 specialist agents each contribute their focused perspective on a complex question, then a synthesis step combines them into a unified response. Each agent runs in parallel (Phase 1), then Sonnet synthesizes (Phase 2). Costs 3-5 API calls total. Use this for strategic decisions, multi-domain evaluations, or questions that benefit from diverse perspectives. Do not use for simple queries — kernel_query is cheaper and faster for straightforward tasks.',
    {
        prompt: z.string().min(1).max(50000).describe('The complex question or task for collaborative analysis'),
        agents: z
            .array(z.enum(['kernel', 'researcher', 'coder', 'writer', 'analyst']))
            .min(2)
            .max(4)
            .describe('Which 2-4 specialists should collaborate. Each adds one API call.'),
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
                        text: `Swarm error: ${sanitizeError(err)}`,
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
    'Search the web for current, real-time information using the Perplexity AI web-search edge function. Returns results with citations. Use this for current events, API documentation, library updates, market data, or any question requiring up-to-date information. Each call uses the Perplexity API (costs tokens). Do not use for questions answerable from training data alone — use kernel_query instead.',
    {
        query: z.string().min(1).max(2000).describe('Web search query — be specific for better results'),
        focus: z
            .enum(['general', 'academic', 'news', 'code'])
            .optional()
            .describe('Search focus: "general" (default), "academic" (papers/research), "news" (current events), "code" (programming)'),
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
                        text: `Search failed: ${sanitizeError(err)}`,
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
    'Fetch a URL and extract its readable text content via the url-fetch edge function. HTML is stripped and clean text is returned. Use this for reading documentation pages, blog posts, release notes, changelogs, or any public web page. The edge function handles rendering and extraction. Do not use for authenticated pages or APIs — use kernel_search for general web queries instead. The response is truncated to max_length characters.',
    {
        url: z.string().url().max(2048).describe('Public URL to fetch — must be a valid HTTP/HTTPS URL'),
        max_length: z
            .number()
            .int()
            .min(100)
            .max(100000)
            .optional()
            .describe('Maximum characters to return from the extracted content. Default: 5000'),
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
                        text: `Fetch failed: ${sanitizeError(err)}`,
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
    'Evaluate the quality of text content by scoring it on depth, engagement, clarity, and actionability via the evaluate-chat edge function. Returns structured scores. Use this for grading AI-generated outputs, content drafts, or conversation quality. Each call costs API tokens. Provide custom criteria to focus the evaluation on specific aspects.',
    {
        content: z.string().min(1).max(100000).describe('The text content, conversation transcript, or draft to evaluate'),
        criteria: z
            .string()
            .max(500)
            .optional()
            .describe('Custom evaluation criteria (e.g., "technical accuracy, code quality"). Default: depth, engagement, clarity, actionability'),
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
                        text: `Evaluation failed: ${sanitizeError(err)}`,
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
    'Extract structured insights from a conversation transcript or text block via the extract-insights edge function. Returns categorized output: key takeaways, action items, decisions made, and open questions. Use this for summarizing long conversations, meeting notes, or research documents. Each call costs API tokens. The "focus" parameter narrows extraction to a specific category for more targeted results.',
    {
        content: z.string().min(1).max(100000).describe('The conversation transcript, meeting notes, or text to extract insights from'),
        focus: z
            .enum(['takeaways', 'actions', 'decisions', 'questions', 'all'])
            .optional()
            .describe('Narrow extraction focus. "all" (default) extracts everything. Specific values focus on one category for better precision.'),
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
                        text: `Insight extraction failed: ${sanitizeError(err)}`,
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
    'Query Kernel platform analytics for business intelligence and health monitoring. Supports six metric types: user_growth (new signups), conversation_trends (volume and averages), agent_usage (which agents are used), engagement (active users and messages), top_users (most active), and revenue (subscription data). Read-only operation with no side effects. Results are scoped to the specified lookback period.',
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
            .describe('Which metric to query. Each returns a different data shape.'),
        days: z
            .number()
            .int()
            .min(1)
            .max(365)
            .optional()
            .describe('Number of days to look back from today. Default: 30. Max: 365'),
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
                        text: `Analytics error: ${sanitizeError(err)}`,
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
