// Supabase Edge Function: proactive-briefings
// Generates proactive insights based on user's recent conversations and working memory.
// Runs on a cron schedule or via manual trigger.
//
// Deploy: npx supabase functions deploy proactive-briefings --project-ref eoxxpyixdieprsxlpwcs

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight } from '../_shared/cors.ts'

const CORS_HEADERS = {
    ...corsHeaders,
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return handlePreflight(req)
    }

    // Verify caller is authorized via service role key
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const authHeader = req.headers.get('Authorization')

    // Also allow manual API triggers using the anon key if we implement a "generate now" button for Pro users.
    // For cron, it will use the service role key.
    let isServiceCall = false;
    if (authHeader === `Bearer ${serviceKey}`) {
        isServiceCall = true;
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            { auth: { persistSession: false, autoRefreshToken: false } }
        )

        let targetUserId = null;

        // If not a service call, authenticate the user
        if (!isServiceCall) {
            if (!authHeader) {
                return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
            }
            const token = authHeader.replace('Bearer ', '')
            const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
            if (authErr || !user) {
                return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
            }

            // Check if user is Pro
            const { data: sub } = await supabase.from('subscriptions').select('status').eq('user_id', user.id).eq('status', 'active').maybeSingle()
            if (!sub) {
                return new Response(JSON.stringify({ error: 'Proactive Briefings is a Pro feature.' }), { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
            }

            targetUserId = user.id;
        }

        // Parse request to see if there's a specific user ID being targeted
        let payload = { user_id: undefined }
        try {
            const text = await req.text()
            if (text) payload = JSON.parse(text)
        } catch { }

        if (isServiceCall && payload.user_id) {
            targetUserId = payload.user_id;
        }

        // Fetch users to process
        let usersToProcess = []
        if (targetUserId) {
            usersToProcess.push({ id: targetUserId })
        } else {
            // Cron mode: fetch all Pro users who haven't had a briefing in 24 hours
            const { data: proUsers } = await supabase
                .from('subscriptions')
                .select('user_id')
                .eq('status', 'active')

            if (proUsers) {
                usersToProcess = proUsers.map((u: any) => ({ id: u.user_id }))
            }
        }

        let processedCount = 0;

        for (const u of usersToProcess) {
            // 1. Fetch user's lasting memory
            const { data: memoryState } = await supabase.from('user_engine_state').select('lasting_memory, world_model').eq('user_id', u.id).maybeSingle()
            if (!memoryState || !memoryState.lasting_memory) continue;

            const lastingMemory = memoryState.lasting_memory as any;
            const worldModel = memoryState.world_model as any;

            // 2. Fetch recent conversations (last 24 hours)
            const { data: recentConv } = await supabase
                .from('messages')
                .select('content, agent_id')
                .eq('user_id', u.id)
                .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                .order('created_at', { ascending: true })
                .limit(50);

            if (!recentConv || recentConv.length < 5) continue; // Not enough activity for a briefing

            const convoText = recentConv.map((m: any) => `${m.agent_id === 'human' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');

            const prompt = `You are Kernel, analyzing the user's recent activity and world model to generate a Proactive Briefing.
World Model Overview: ${JSON.stringify(worldModel?.userModel || {})}
Recent topics: ${lastingMemory.topicHistory?.slice(-5).join(', ')}

Recent Conversation (Last 24h):
${convoText}

Write a short, insightful proactive briefing addressing the user directly. Synthesize what they've been working on, connect the dots between ideas they've mentioned, and suggest next steps or blind spots they might have missed. 
Format it as a single compelling paragraph followed by 2-3 bullet points of actionable advice or "things to think about".
Tone: Sharp, warm, direct.`;

            // 3. Call Claude Proxy to generate the briefing
            const proxyUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/claude-proxy`
            const claudeReq = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${serviceKey}`
                },
                body: JSON.stringify({
                    mode: 'text',
                    tier: 'strong',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 800
                })
            });

            if (!claudeReq.ok) {
                console.error(`Failed to generate briefing for user ${u.id}: ${await claudeReq.text()}`);
                continue;
            }

            const { text: generatedBriefing } = await claudeReq.json();

            // 4. Save briefing and notify user
            await supabase.from('briefings').insert({
                user_id: u.id,
                content: generatedBriefing,
                status: 'unread'
            })

            await supabase.from('notifications').insert({
                user_id: u.id,
                title: 'New Proactive Briefing',
                body: 'I synthezised some thoughts on your recent work.',
                type: 'briefing'
            })

            processedCount++;
        }

        return new Response(JSON.stringify({ processed: processedCount }), {
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
    } catch (err) {
        console.error('proactive-briefings error:', err)
        return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
    }
})
