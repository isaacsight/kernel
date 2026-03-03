// Supabase Edge Function: social-publish
// Adapt content for platforms, publish, schedule, cancel, retry.
//
// Deploy: npx supabase functions deploy social-publish --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
import { requireContentType } from '../_shared/validate.ts'
import { resolvePlanId, ACTIVE_STATUSES } from '../_shared/plan-limits.ts'
import { getAdapter } from '../_shared/social/registry.ts'

type Action = 'adapt_content' | 'publish' | 'schedule' | 'cancel' | 'retry' | 'list_posts'

interface Payload {
  action: Action
  data?: Record<string, unknown>
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handlePreflight(req)
  const CORS = { ...corsHeaders(req), ...SECURITY_HEADERS }

  try {
    const ctErr = requireContentType(req)
    if (ctErr) return ctErr(CORS)

    // Auth
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    )
    const { data: { user }, error: authError } = await authClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    // Pro check
    const { data: sub } = await svc.from('subscriptions')
      .select('status, plan').eq('user_id', user.id).maybeSingle()
    if (!sub || !ACTIVE_STATUSES.includes(sub.status)) {
      return new Response(JSON.stringify({ error: 'pro_required' }), {
        status: 403, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // Rate limit
    const planId = resolvePlanId(sub)
    const tier = planId === 'free' ? 'free' : planId.startsWith('max') ? 'max' : 'pro'
    const rl = await checkRateLimit(svc, user.id, 'social-publish', tier as 'free' | 'paid' | 'pro' | 'max')
    if (!rl.allowed) return rateLimitResponse(rl, CORS)

    const payload = await req.json() as Payload
    let result: Record<string, unknown> = {}

    switch (payload.action) {
      case 'adapt_content': {
        const d = payload.data || {}
        const content = d.content as string
        const platform = d.platform as string
        const accountId = d.account_id as string
        if (!content || !platform || !accountId) throw new Error('content, platform, account_id required')

        const adapter = getAdapter(platform)

        // Use Claude via Supabase claude-proxy for adaptation
        const adaptPrompt = `Adapt the following content for ${platform}.
Character limit: ${adapter.charLimit} characters.
${adapter.supportsThreads ? 'This platform supports threads. If the content is too long for one post, split it into a thread.' : 'This platform does NOT support threads. Condense to fit.'}

Content:
${content.slice(0, 6000)}

Rules:
- Stay faithful to the original message
- Optimize for ${platform} engagement patterns
- Include relevant hashtags (3-5)
- Use the platform's native style/conventions
${adapter.supportsThreads ? '- If splitting into a thread, each part should be self-contained but connected' : ''}
- NEVER exceed the character limit

Return ONLY valid JSON:
{
  "body": "the adapted post text",
  "hashtags": ["tag1", "tag2"],
  ${adapter.supportsThreads ? '"threadParts": ["part1", "part2"] // only if content requires threading' : ''}
}`

        // Call claude-proxy internally
        const claudeRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/claude-proxy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': Deno.env.get('SUPABASE_ANON_KEY')!,
          },
          body: JSON.stringify({
            mode: 'json',
            messages: [{ role: 'user', content: adaptPrompt }],
            model: 'haiku',
            max_tokens: 2000,
          }),
        })

        if (!claudeRes.ok) throw new Error('Content adaptation failed')
        const adapted = await claudeRes.json()
        const parsed = typeof adapted.content === 'string' ? JSON.parse(adapted.content) : adapted.content

        result = {
          adapted: {
            body: parsed.body || content.slice(0, adapter.charLimit),
            hashtags: parsed.hashtags || [],
            threadParts: parsed.threadParts || null,
          },
        }
        break
      }

      case 'publish': {
        const d = payload.data || {}
        const postId = d.post_id as string
        const accountId = d.account_id as string
        const body = d.body as string
        const threadParts = d.thread_parts as string[] | undefined

        if (!accountId || !body) throw new Error('account_id and body required')

        // Fetch account and decrypt token
        const { data: account } = await svc.from('social_accounts')
          .select('*').eq('id', accountId).eq('user_id', user.id).single()
        if (!account) throw new Error('Account not found')

        const { data: accessToken } = await svc.rpc('decrypt_social_token', { encrypted: account.access_token_enc })
        const adapter = getAdapter(account.platform)

        // Check if token needs refresh
        if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
          if (account.refresh_token_enc) {
            const { data: refreshToken } = await svc.rpc('decrypt_social_token', { encrypted: account.refresh_token_enc })
            const tokens = await adapter.refreshToken(refreshToken)
            const { data: newEnc } = await svc.rpc('encrypt_social_token', { token: tokens.access_token })
            await svc.from('social_accounts').update({
              access_token_enc: newEnc,
              token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
            }).eq('id', account.id)
            // Use new token
            const publishResult = threadParts && threadParts.length > 1 && adapter.publishThread
              ? await adapter.publishThread(tokens.access_token, threadParts)
              : await adapter.publishPost(tokens.access_token, body)

            // Create/update social_posts record
            const postData = {
              user_id: user.id,
              content_id: d.content_id || null,
              account_id: accountId,
              platform: account.platform,
              body,
              thread_parts: threadParts ? JSON.stringify(threadParts) : null,
              hashtags: d.hashtags || [],
              status: 'published',
              published_at: new Date().toISOString(),
              platform_post_id: publishResult.platformPostId,
              platform_url: publishResult.platformUrl,
            }

            if (postId) {
              await svc.from('social_posts').update(postData).eq('id', postId)
            } else {
              await svc.from('social_posts').insert(postData)
            }

            // Update last_used_at
            await svc.from('social_accounts').update({ last_used_at: new Date().toISOString() }).eq('id', account.id)

            result = { published: true, ...publishResult }
            break
          }
          throw new Error('Token expired and no refresh token available')
        }

        // Publish
        const publishResult = threadParts && threadParts.length > 1 && adapter.publishThread
          ? await adapter.publishThread(accessToken, threadParts)
          : await adapter.publishPost(accessToken, body)

        const postData = {
          user_id: user.id,
          content_id: d.content_id || null,
          account_id: accountId,
          platform: account.platform,
          body,
          thread_parts: threadParts ? JSON.stringify(threadParts) : null,
          hashtags: d.hashtags || [],
          status: 'published',
          published_at: new Date().toISOString(),
          platform_post_id: publishResult.platformPostId,
          platform_url: publishResult.platformUrl,
        }

        if (postId) {
          await svc.from('social_posts').update(postData).eq('id', postId)
        } else {
          await svc.from('social_posts').insert(postData)
        }

        await svc.from('social_accounts').update({ last_used_at: new Date().toISOString() }).eq('id', account.id)

        logAudit(svc, {
          actorId: user.id, eventType: 'social.published', action: 'social-publish.publish',
          source: 'social-publish', status: 'success', statusCode: 200,
          metadata: { platform: account.platform, postId: publishResult.platformPostId },
          ip: getClientIP(req), userAgent: getUA(req),
        })

        result = { published: true, ...publishResult }
        break
      }

      case 'schedule': {
        const d = payload.data || {}
        if (!d.account_id || !d.body || !d.scheduled_at) throw new Error('account_id, body, scheduled_at required')

        const { data: post, error: insertErr } = await svc.from('social_posts').insert({
          user_id: user.id,
          content_id: d.content_id || null,
          account_id: d.account_id,
          platform: d.platform,
          body: d.body,
          thread_parts: d.thread_parts ? JSON.stringify(d.thread_parts) : null,
          hashtags: d.hashtags || [],
          status: 'scheduled',
          scheduled_at: d.scheduled_at,
        }).select().single()

        if (insertErr) throw insertErr
        result = { post }
        break
      }

      case 'cancel': {
        const d = payload.data || {}
        if (!d.post_id) throw new Error('post_id required')
        await svc.from('social_posts')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', d.post_id).eq('user_id', user.id).eq('status', 'scheduled')
        result = { cancelled: true }
        break
      }

      case 'list_posts': {
        const d = payload.data || {}
        const status = d.status as string | undefined
        let query = svc.from('social_posts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50)
        if (status) query = query.eq('status', status)
        const { data: posts } = await query
        result = { posts: posts || [] }
        break
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${payload.action}` }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
        })
    }

    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })

  } catch (error) {
    console.error('social-publish error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(req), ...SECURITY_HEADERS },
    })
  }
})
