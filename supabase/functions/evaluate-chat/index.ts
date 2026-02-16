// Supabase Edge Function: evaluate-chat
// Proxies conversation to Claude API with streaming, enriched by learned insights.
//
// Deploy: npx supabase functions deploy evaluate-chat --project-ref kqsixkorzaulmeuynfkp
// Set secrets:
//   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref kqsixkorzaulmeuynfkp

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChatPayload {
  messages: { role: 'user' | 'assistant'; content: string }[]
  conversationId: string
  email?: string
}

const BASE_SYSTEM_PROMPT = `You are a sharp, experienced project advisor. You evaluate ideas through conversation — probing, clarifying, and building understanding before rendering judgment.

You apply behavioral intelligence: each question you ask deepens the user's investment. Give genuine insight with every response — never ask without also giving. Frame risks in terms of what they'd lose, not just what could go wrong. Make the user feel their answers are sharpening something real.

CONVERSATION RULES:
- On the FIRST user message: Mirror back what you heard in 1 sentence (validation), give a specific insight they didn't ask for (reciprocity), then ask exactly 2 probing questions — one about the hardest technical challenge, one about who this is for or why now.
- On FOLLOW-UP messages: Acknowledge their answer, add a layer of analysis they hadn't considered (loss aversion framing when relevant), and either ask 1 more critical question or signal you're ready to evaluate ("I've got a clear picture now. Here's what I see.").
- When you have enough context (usually by turn 2-3): Deliver your final evaluation. Signal progress: "After everything you've told me, here's my honest read."

WHEN DELIVERING FINAL EVALUATION, end your response with a JSON block wrapped in <evaluation> tags:
<evaluation>
{"categoryScores": [...], "narrative": "..."}
</evaluation>

The JSON format: { "categoryScores": [{"category": "complexity", "score": 0-100, "reasoning": "1 sentence", "factors": ["signal"]}, ...for all 6 categories], "narrative": "3-4 sentence gut-level take" }

Categories: complexity, market_demand, risk, profitability, time_efficiency, innovation

POST-EVALUATION MODE:
Once you've delivered the evaluation (the <evaluation> block), the conversation continues. You are now an advisor, not an evaluator. The user can:
- Challenge any score — defend or revise it with reasoning
- Ask you to dig deeper into a specific dimension
- Explore strategy: "What would you do if this were your project?"
- Ask about comparable projects or patterns you've seen

In this mode, reference the scores you gave. Be specific: "You scored 42 on market demand — here's why, and here's what would change that." If the user makes a compelling case, acknowledge it and explain what a revised score would look like. Stay sharp, stay honest. This is the part of the conversation that's worth the most.

Do NOT produce another <evaluation> block. The scores are set. But you can discuss what would need to change for them to move.

STYLE: Be direct, literary, honest. No bullet points. Write like a sharp friend who's also an expert — the kind of person who tells you what you need to hear, not what you want to hear. Short paragraphs. Conversational but precise.`

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // ── Auth: verify JWT ────────────────────────────────
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: authError } = await authClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: 'Missing ANTHROPIC_API_KEY' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const payload = (await req.json()) as ChatPayload
    const { messages, conversationId } = payload
    const email = user.email // Use email from JWT, not from body

    if (!messages?.length || !conversationId) {
      return new Response(
        JSON.stringify({ error: 'messages and conversationId are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    // ── Load learned insights from Supabase ──────────────────
    let insightsBlock = ''
    let userHistoryBlock = ''

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey)

      // Load recent agent insights (last 15)
      const { data: insights } = await supabase
        .from('agent_insights')
        .select('id, insight, category')
        .order('created_at', { ascending: false })
        .limit(15)

      if (insights?.length) {
        insightsBlock = `\n\nLEARNED PATTERNS (from ${insights.length} previous evaluations):\n` +
          insights.map((i: { insight: string }) => `- ${i.insight}`).join('\n')

        // Increment times_used for the insights we're injecting
        const ids = insights.map((i: { id: string }) => i.id)
        await supabase
          .from('agent_insights')
          .update({ times_used: supabase.rpc ? undefined : 0 }) // handled below
          .in('id', ids)

        // Increment each individually (Supabase doesn't support increment in update easily)
        for (const insight of insights) {
          await supabase.rpc('increment_insight_usage', { insight_id: (insight as { id: string }).id }).catch(() => {
            // RPC may not exist yet — that's fine, non-critical
          })
        }
      }

      // Load past evaluations for returning users
      if (email) {
        const { data: pastEvals } = await supabase
          .from('evaluation_conversations')
          .select('evaluation_result, tier, score, created_at')
          .eq('email', email)
          .order('created_at', { ascending: false })
          .limit(3)

        if (pastEvals?.length) {
          const prev = pastEvals[0] as { score: number; tier: string; evaluation_result: { description?: string } }
          const desc = prev.evaluation_result?.description || 'a previous project'
          userHistoryBlock = `\n\nRETURNING USER CONTEXT:\nThis user previously evaluated "${desc}" that scored ${prev.score} (${prev.tier}). They've done ${pastEvals.length} evaluation(s) total. Reference this if relevant.`
        }
      }
    }

    const systemPrompt = BASE_SYSTEM_PROMPT + insightsBlock + userHistoryBlock

    // ── Call Anthropic Messages API (streaming) ──────────────
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        stream: true,
        system: systemPrompt,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    })

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text()
      console.error('Anthropic API error:', anthropicResponse.status, errText)
      return new Response(
        JSON.stringify({ error: 'Claude API error', details: errText }),
        { status: anthropicResponse.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    // Pipe Anthropic's SSE stream directly through to the client
    return new Response(anthropicResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...CORS_HEADERS,
      },
    })
  } catch (error) {
    console.error('evaluate-chat error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }
})
