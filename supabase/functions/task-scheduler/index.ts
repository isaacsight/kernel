// Supabase Edge Function: task-scheduler
// Called every 5 min by external cron. Queries due tasks, executes them,
// updates next_run_at.
//
// Deploy: npx supabase functions deploy task-scheduler --project-ref eoxxpyixdieprsxlpwcs

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logAudit } from '../_shared/audit.ts'
import { getAdapter } from '../_shared/social/registry.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple next-run calculator (mirrors client-side logic)
function calculateNextRun(schedule: any): string | null {
  const time = schedule.time || '09:00'
  const [hours, minutes] = time.split(':').map(Number)
  const now = new Date()

  switch (schedule.type) {
    case 'once':
      return null // Don't reschedule one-time tasks

    case 'daily': {
      const next = new Date(now)
      next.setDate(next.getDate() + 1)
      next.setHours(hours, minutes, 0, 0)
      return next.toISOString()
    }

    case 'weekdays': {
      const next = new Date(now)
      next.setDate(next.getDate() + 1)
      next.setHours(hours, minutes, 0, 0)
      while (next.getDay() === 0 || next.getDay() === 6) {
        next.setDate(next.getDate() + 1)
      }
      return next.toISOString()
    }

    case 'weekly': {
      const next = new Date(now)
      next.setDate(next.getDate() + 7)
      next.setHours(hours, minutes, 0, 0)
      return next.toISOString()
    }

    default:
      return null
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  // Verify caller is authorized via service role key (auto-injected by Supabase)
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceKey) {
    console.error('[task-scheduler] SUPABASE_SERVICE_ROLE_KEY not available — rejecting request')
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Find tasks that are due
    const now = new Date().toISOString()
    const { data: dueTasks, error } = await supabase
      .from('scheduled_tasks')
      .select('*')
      .eq('is_active', true)
      .lte('next_run_at', now)
      .limit(50)

    if (error) throw error
    if (!dueTasks || dueTasks.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    let processed = 0

    for (const task of dueTasks) {
      try {
        // Create execution record
        const { data: exec } = await supabase
          .from('task_executions')
          .insert({
            task_id: task.id,
            user_id: task.user_id,
            status: 'running',
          })
          .select()
          .single()

        // Create notification
        await supabase.from('notifications').insert({
          user_id: task.user_id,
          title: task.title,
          body: `Scheduled ${task.task_type.replace('_', ' ')} task completed.`,
          type: task.task_type === 'reminder' ? 'reminder'
            : task.task_type === 'briefing' ? 'briefing'
            : task.task_type === 'goal_checkin' ? 'goal'
            : 'task_complete',
        })

        // Mark execution complete
        if (exec) {
          await supabase
            .from('task_executions')
            .update({ status: 'completed', duration_ms: Date.now() - new Date(exec.created_at).getTime() })
            .eq('id', exec.id)
        }

        // Calculate next run
        const nextRun = calculateNextRun(task.schedule)
        if (nextRun) {
          await supabase
            .from('scheduled_tasks')
            .update({ next_run_at: nextRun, updated_at: now })
            .eq('id', task.id)
        } else {
          // One-time task — deactivate
          await supabase
            .from('scheduled_tasks')
            .update({ is_active: false, updated_at: now })
            .eq('id', task.id)
        }

        processed++
      } catch (taskErr) {
        console.error(`Failed to process task ${task.id}:`, taskErr)
      }
    }

    // ── Proactive briefings: generate "Kernel noticed..." insights ──
    try {
      const proactiveUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/proactive-briefings`
      const proactiveRes = await fetch(proactiveUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({}),
      })
      if (proactiveRes.ok) {
        const result = await proactiveRes.json()
        console.log(`[proactive] Processed: ${result.processed}, skipped: ${result.skipped}`)
      } else {
        console.warn(`[proactive] Failed (${proactiveRes.status}):`, await proactiveRes.text().catch(() => 'unknown'))
      }
    } catch (proactiveErr) {
      console.warn('Proactive briefings failed (non-blocking):', proactiveErr)
    }

    // ── Expire subscriptions past current_period_end ──
    try {
      const { data: expired } = await supabase
        .from('subscriptions')
        .select('user_id')
        .in('status', ['active', 'trialing'])
        .not('current_period_end', 'is', null)
        .lt('current_period_end', new Date().toISOString())

      if (expired && expired.length > 0) {
        const userIds = expired.map((s: { user_id: string }) => s.user_id)
        await supabase
          .from('subscriptions')
          .update({ status: 'inactive', updated_at: new Date().toISOString() })
          .in('user_id', userIds)

        // Notify each expired user
        const notifications = userIds.map((uid: string) => ({
          user_id: uid,
          title: 'Your Pro subscription has ended',
          body: 'Your complimentary Pro access has expired. Upgrade anytime to restore unlimited messages and Pro features.',
          type: 'info',
        }))
        await supabase.from('notifications').insert(notifications)

        console.log(`[subscriptions] Expired ${userIds.length} subscription(s)`)
      }
    } catch (subErr) {
      console.warn('Subscription expiration failed (non-blocking):', subErr)
    }

    // ── API Overage: report usage to Stripe + spending alerts ──
    let overageReported = 0
    let alertsSent = 0
    try {
      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')

      // 1. Report overage usage to Stripe for keys near window expiry
      if (stripeKey) {
        const windowCutoff = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // within 24h of expiry
        const { data: overageKeys } = await supabase
          .from('api_keys')
          .select('id, user_id, overage_count, overage_rate_millicents, stripe_item_id, monthly_window_start, last_overage_reported_at')
          .eq('status', 'active')
          .eq('overage_enabled', true)
          .gt('overage_count', 0)
          .not('stripe_item_id', 'is', null)

        if (overageKeys && overageKeys.length > 0) {
          for (const key of overageKeys) {
            // Skip if already reported recently (within last 4 hours)
            if (key.last_overage_reported_at) {
              const lastReported = new Date(key.last_overage_reported_at).getTime()
              if (Date.now() - lastReported < 4 * 60 * 60 * 1000) continue
            }

            try {
              // Report metered usage to Stripe
              const usageRes = await fetch('https://api.stripe.com/v1/subscription_items/' + key.stripe_item_id + '/usage_records', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${stripeKey}`,
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `quantity=${key.overage_count}&action=set&timestamp=${Math.floor(Date.now() / 1000)}`,
              })

              if (usageRes.ok) {
                await supabase.from('api_keys')
                  .update({ last_overage_reported_at: new Date().toISOString() })
                  .eq('id', key.id)
                overageReported++
              } else {
                console.warn(`[overage] Stripe usage report failed for key ${key.id}:`, await usageRes.text())
              }
            } catch (stripeErr) {
              console.warn(`[overage] Failed to report usage for key ${key.id}:`, stripeErr)
            }
          }
        }
      }

      // 2. Spending alerts at 80% and 100% of base quota
      const { data: alertKeys } = await supabase
        .from('api_keys')
        .select('id, user_id, monthly_message_count, monthly_message_limit, alert_80_sent, alert_100_sent')
        .eq('status', 'active')
        .in('tier', ['pro', 'growth'])

      if (alertKeys && alertKeys.length > 0) {
        for (const key of alertKeys) {
          const pct = key.monthly_message_count / key.monthly_message_limit
          const notifications: Array<{ user_id: string; title: string; body: string; type: string }> = []

          if (pct >= 0.8 && !key.alert_80_sent) {
            notifications.push({
              user_id: key.user_id,
              title: 'API usage at 80%',
              body: `You've used ${key.monthly_message_count} of ${key.monthly_message_limit} included messages. Overage billing will apply after the limit.`,
              type: 'warning',
            })
            await supabase.from('api_keys').update({ alert_80_sent: true }).eq('id', key.id)
            alertsSent++
          }

          if (pct >= 1.0 && !key.alert_100_sent) {
            notifications.push({
              user_id: key.user_id,
              title: 'API base quota reached',
              body: `You've used all ${key.monthly_message_limit} included messages. Additional messages will be billed at the overage rate.`,
              type: 'warning',
            })
            await supabase.from('api_keys').update({ alert_100_sent: true }).eq('id', key.id)
            alertsSent++
          }

          if (notifications.length > 0) {
            await supabase.from('notifications').insert(notifications)
          }
        }
      }

      if (overageReported > 0) console.log(`[overage] Reported ${overageReported} usage records to Stripe`)
      if (alertsSent > 0) console.log(`[overage] Sent ${alertsSent} spending alert(s)`)
    } catch (overageErr) {
      console.warn('Overage reporting/alerts failed (non-blocking):', overageErr)
    }

    // ── Cleanup: purge expired rate limits, old audit events, old errors ──
    try {
      await supabase.rpc('cleanup_rate_limits')
      await supabase.rpc('cleanup_audit_events', { p_retention_days: 90 })
      await supabase.rpc('cleanup_platform_errors', { p_retention_days: 30 })
      await supabase.rpc('cleanup_message_states', { p_retention_days: 30 })
    } catch (cleanupErr) {
      console.warn('Cleanup RPCs failed (non-blocking):', cleanupErr)
    }

    // ── Max tier: reset usage flags on 1st of each month (safety net) ──
    try {
      const now = new Date()
      if (now.getUTCDate() === 1 && now.getUTCHours() === 0 && now.getUTCMinutes() < 10) {
        // Clear usage_flag for all users (runs only in first 10 min of month)
        const { error: flagErr } = await supabase
          .from('user_memory')
          .update({ usage_flag: null })
          .not('usage_flag', 'is', null)
        if (flagErr) console.warn('[max-tier] Flag reset error:', flagErr.message)
        else console.log('[max-tier] Monthly usage flags cleared')
      }
    } catch (flagResetErr) {
      console.warn('Max tier flag reset failed (non-blocking):', flagResetErr)
    }

    // ── Provider reliability: recompute health scores ──
    try {
      await supabase.rpc('compute_provider_health')
      console.log('[health] Provider scores recomputed')
    } catch (scoreErr) {
      console.warn('Provider health computation failed (non-blocking):', scoreErr)
    }

    // ── Health monitoring: check error rates and alert on spikes ──
    try {
      const { data: health } = await supabase.rpc('get_error_health', { p_window_minutes: 15 })
      if (health) {
        const platformRate = health.platform_error_rate_pct ?? 0
        const platformErrors = health.platform_errors ?? 0

        // Alert if error rate exceeds 10% OR more than 20 platform errors in 15 min
        if (platformRate > 10 || platformErrors > 20) {
          const notifyUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/notify-webhook`
          await fetch(notifyUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              event_type: 'error_spike',
              error_rate: platformRate,
              platform_errors: platformErrors,
              total_errors: health.total_errors,
              refunded_count: health.refunded_count,
              breakdown: JSON.stringify(health.by_provider, null, 2),
            }),
          })
          console.warn(`[health] Error spike alert: ${platformRate}% error rate, ${platformErrors} errors in 15min`)
        }
      }
    } catch (healthErr) {
      console.warn('Health check failed (non-blocking):', healthErr)
    }

    // ── Social: publish scheduled posts ──
    let socialPublished = 0
    try {
      const { data: duePosts } = await supabase
        .from('social_posts')
        .select('*, social_accounts!inner(platform, access_token_enc, refresh_token_enc, token_expires_at)')
        .eq('status', 'scheduled')
        .lte('scheduled_at', new Date().toISOString())
        .limit(20)

      if (duePosts && duePosts.length > 0) {
        const encKey = Deno.env.get('SOCIAL_ENCRYPTION_KEY') || ''

        for (const post of duePosts) {
          try {
            // Mark as publishing
            await supabase.from('social_posts').update({ status: 'publishing' }).eq('id', post.id)

            const account = post.social_accounts
            const adapter = getAdapter(account.platform)

            // Decrypt access token
            const { data: decrypted } = await supabase.rpc('decrypt_social_token', {
              encrypted: account.access_token_enc,
            })
            let accessToken = decrypted as string

            // Refresh if expired
            if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
              const { data: decRefresh } = await supabase.rpc('decrypt_social_token', {
                encrypted: account.refresh_token_enc,
              })
              if (decRefresh) {
                const refreshed = await adapter.refreshToken(decRefresh as string)
                accessToken = refreshed.access_token
                // Re-encrypt and store new tokens
                const { data: newEnc } = await supabase.rpc('encrypt_social_token', { token: refreshed.access_token })
                const updateData: Record<string, unknown> = {
                  access_token_enc: newEnc,
                  token_expires_at: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString() : null,
                }
                if (refreshed.refresh_token) {
                  const { data: refEnc } = await supabase.rpc('encrypt_social_token', { token: refreshed.refresh_token })
                  updateData.refresh_token_enc = refEnc
                }
                await supabase.from('social_accounts').update(updateData).eq('id', post.account_id)
              }
            }

            // Publish
            const threadParts = post.thread_parts as string[] | null
            let result
            if (threadParts && threadParts.length > 1 && adapter.publishThread) {
              result = await adapter.publishThread(accessToken, threadParts)
            } else {
              result = await adapter.publishPost(accessToken, post.body, post.media_urls || undefined)
            }

            // Update post as published
            await supabase.from('social_posts').update({
              status: 'published',
              published_at: new Date().toISOString(),
              platform_post_id: result.platformPostId,
              platform_url: result.platformUrl,
            }).eq('id', post.id)

            // Notify user
            await supabase.from('notifications').insert({
              user_id: post.user_id,
              title: 'Scheduled post published',
              body: `Your ${account.platform} post has been published.`,
              type: 'info',
              action_url: result.platformUrl || undefined,
            })

            socialPublished++
          } catch (postErr) {
            const retryCount = (post.retry_count || 0) + 1
            const newStatus = retryCount >= 3 ? 'failed' : 'scheduled'
            await supabase.from('social_posts').update({
              status: newStatus,
              retry_count: retryCount,
              publish_error: postErr instanceof Error ? postErr.message : 'Unknown error',
            }).eq('id', post.id)

            if (newStatus === 'failed') {
              await supabase.from('notifications').insert({
                user_id: post.user_id,
                title: 'Scheduled post failed',
                body: `Your ${post.platform} post failed after 3 attempts.`,
                type: 'error',
              })
            }
            console.warn(`[social] Failed to publish post ${post.id}:`, postErr)
          }
        }
        console.log(`[social] Published ${socialPublished}/${duePosts.length} scheduled posts`)
      }
    } catch (socialErr) {
      console.warn('Social scheduled posts failed (non-blocking):', socialErr)
    }

    // ── Social: cleanup expired OAuth states (10 min TTL) ──
    try {
      const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString()
      const { count } = await supabase
        .from('social_oauth_states')
        .delete()
        .lt('created_at', cutoff)
        .select('*', { count: 'exact', head: true })
      if (count && count > 0) {
        console.log(`[social] Cleaned up ${count} expired OAuth state(s)`)
      }
    } catch (oauthCleanErr) {
      console.warn('OAuth state cleanup failed (non-blocking):', oauthCleanErr)
    }

    // ── Social: collect analytics for recent posts ──
    try {
      // Posts published in last 7 days — collect every scheduler run
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: recentPosts } = await supabase
        .from('social_posts')
        .select('*, social_accounts!inner(platform, access_token_enc, token_expires_at)')
        .eq('status', 'published')
        .not('platform_post_id', 'is', null)
        .gte('published_at', weekAgo)
        .limit(50)

      if (recentPosts && recentPosts.length > 0) {
        let collected = 0
        for (const post of recentPosts) {
          try {
            const account = post.social_accounts
            const adapter = getAdapter(account.platform)
            if (!adapter) continue

            const { data: decrypted } = await supabase.rpc('decrypt_social_token', {
              encrypted: account.access_token_enc,
            })
            if (!decrypted) continue

            const analytics = await adapter.getPostAnalytics(decrypted as string, post.platform_post_id)
            if (analytics) {
              await supabase.from('social_analytics').upsert({
                post_id: post.id,
                user_id: post.user_id,
                platform: post.platform,
                impressions: analytics.impressions || 0,
                likes: analytics.likes || 0,
                reposts: analytics.reposts || 0,
                replies: analytics.replies || 0,
                clicks: analytics.clicks || 0,
                engagement_rate: analytics.engagementRate || 0,
                collected_at: new Date().toISOString(),
              }, { onConflict: 'post_id,collected_at' })
              collected++
            }
          } catch (analyticsErr) {
            console.warn(`[social-analytics] Failed for post ${post.id}:`, analyticsErr)
          }
        }
        if (collected > 0) console.log(`[social-analytics] Collected metrics for ${collected} posts`)
      }
    } catch (analyticsErr) {
      console.warn('Social analytics collection failed (non-blocking):', analyticsErr)
    }

    // ── Collective Intelligence: aggregate routing signals every 6 hours ──
    let collectiveLearnRan = false
    try {
      const hour = new Date().getUTCHours()
      // Run at 0, 6, 12, 18 UTC (within the 5-min window)
      if (hour % 6 === 0) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const learnRes = await fetch(`${supabaseUrl}/functions/v1/collective-learn`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
        })
        if (learnRes.ok) {
          const result = await learnRes.json()
          console.log('[collective-learn] Patterns updated:', result)
          collectiveLearnRan = true
        } else {
          console.warn('[collective-learn] Failed:', await learnRes.text())
        }
      }
    } catch (learnErr) {
      console.warn('Collective learning failed (non-blocking):', learnErr)
    }

    // ── Cleanup: purge old routing signals ──
    try {
      await supabase.rpc('purge_old_routing_signals')
    } catch { /* non-blocking */ }

    // Audit log
    logAudit(supabase, {
      actorType: 'system', eventType: 'system.cron', action: 'task-scheduler',
      source: 'task-scheduler', status: 'success', statusCode: 200,
      metadata: { processed, socialPublished, collectiveLearnRan, overageReported, alertsSent },
    })

    return new Response(JSON.stringify({ processed }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Scheduler error:', err)
    return new Response(JSON.stringify({ error: 'Scheduler failed' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
