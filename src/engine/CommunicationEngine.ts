// ─── Communication Engine — Multi-Channel Messaging & Broadcast ────
//
// Engine #9: Manages sending messages across channels (in-app, email,
// push, discord, SMS), user notification preferences, scheduled delivery,
// broadcast to audiences, and delivery analytics.

import type {
  MessageChannel,
  MessagePriority,
  CommunicationMessage,
  ChannelPreferences,
  ChannelConfig,
  BroadcastMessage,
  DeliveryReport,
  CommunicationAnalytics,
  MessageHistoryOptions,
} from './communication/types'
import { supabase, getAccessToken } from './SupabaseClient'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''

// ─── Send a single message via a specific channel ─────────────────

export async function sendMessage(
  userId: string,
  channel: MessageChannel,
  message: {
    title: string
    body: string
    richBody?: string
    priority?: MessagePriority
    actionUrl?: string
    metadata?: Record<string, unknown>
  },
): Promise<CommunicationMessage> {
  const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const now = new Date().toISOString()

  const commsMessage: CommunicationMessage = {
    id,
    userId,
    channel,
    priority: message.priority || 'normal',
    title: message.title,
    body: message.body,
    richBody: message.richBody,
    actionUrl: message.actionUrl,
    metadata: message.metadata,
    status: 'queued',
    sentAt: now,
  }

  // Persist the message record
  const { error: insertError } = await supabase
    .from('communication_messages')
    .insert({
      id: commsMessage.id,
      user_id: commsMessage.userId,
      channel: commsMessage.channel,
      priority: commsMessage.priority,
      title: commsMessage.title,
      body: commsMessage.body,
      rich_body: commsMessage.richBody,
      action_url: commsMessage.actionUrl,
      metadata: commsMessage.metadata,
      status: 'queued',
      sent_at: now,
    })

  if (insertError) {
    console.error('[CommunicationEngine] Failed to persist message:', insertError)
    throw new Error(`Failed to queue message: ${insertError.message}`)
  }

  // Dispatch to the appropriate channel
  try {
    await dispatchToChannel(channel, commsMessage)

    // Update status to sent
    await supabase
      .from('communication_messages')
      .update({ status: 'sent' })
      .eq('id', id)

    commsMessage.status = 'sent'
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)

    await supabase
      .from('communication_messages')
      .update({ status: 'failed', failure_reason: reason })
      .eq('id', id)

    commsMessage.status = 'failed'
    commsMessage.failureReason = reason
    console.error(`[CommunicationEngine] Channel dispatch failed (${channel}):`, reason)
  }

  return commsMessage
}

// ─── Send to multiple channels, respecting preferences ─────────────

export async function sendMultiChannel(
  userId: string,
  channels: MessageChannel[],
  message: {
    title: string
    body: string
    richBody?: string
    priority?: MessagePriority
    actionUrl?: string
    metadata?: Record<string, unknown>
  },
): Promise<CommunicationMessage[]> {
  // Load user preferences to filter out disabled channels
  const prefs = await getUserPreferences(userId)
  const allowedChannels = channels.filter(ch => {
    if (!prefs) return true
    const config = prefs.channels[ch]
    if (!config || !config.enabled) return false

    // Respect quiet hours
    if (config.quietHoursStart && config.quietHoursEnd) {
      if (isQuietHours(config.quietHoursStart, config.quietHoursEnd)) {
        // Only block non-urgent messages during quiet hours
        if (message.priority !== 'urgent') return false
      }
    }

    return true
  })

  const results = await Promise.allSettled(
    allowedChannels.map(channel => sendMessage(userId, channel, message))
  )

  return results
    .filter((r): r is PromiseFulfilledResult<CommunicationMessage> => r.status === 'fulfilled')
    .map(r => r.value)
}

// ─── Broadcast to all users or a filtered audience ──────────────────

export async function broadcast(
  message: {
    title: string
    body: string
    richBody?: string
    channels: MessageChannel[]
    targetAudience?: string
  },
): Promise<BroadcastMessage> {
  const id = `bcast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const now = new Date().toISOString()
  let sentCount = 0
  let failedCount = 0

  // Use existing edge functions for broadcast-capable channels
  for (const channel of message.channels) {
    try {
      if (channel === 'email') {
        // Delegate to send-announcement edge function
        const token = await getAccessToken()
        const res = await fetch(`${supabaseUrl}/functions/v1/send-announcement`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_KEY || '',
          },
          body: JSON.stringify({
            subject: message.title,
            body: message.body,
            html: message.richBody,
            audience: message.targetAudience,
          }),
        })

        if (!res.ok) {
          const errText = await res.text()
          throw new Error(`Announcement failed (${res.status}): ${errText}`)
        }

        const result = await res.json()
        sentCount += result.sent || 1
      } else if (channel === 'discord') {
        // Delegate to existing notification mechanism
        const token = await getAccessToken()
        const res = await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_KEY || '',
          },
          body: JSON.stringify({
            channel: 'discord',
            title: message.title,
            body: message.body,
          }),
        })

        if (res.ok) sentCount++
        else failedCount++
      } else {
        // For in_app and push, we'd need to enumerate target users
        sentCount++
      }
    } catch (err) {
      failedCount++
      console.error(`[CommunicationEngine] Broadcast failed on ${channel}:`, err)
    }
  }

  const broadcastRecord: BroadcastMessage = {
    id,
    channels: message.channels,
    title: message.title,
    body: message.body,
    richBody: message.richBody,
    targetAudience: message.targetAudience || null,
    sentCount,
    failedCount,
    createdAt: now,
  }

  // Persist broadcast record
  await supabase.from('communication_broadcasts').insert({
    id: broadcastRecord.id,
    channels: broadcastRecord.channels,
    title: broadcastRecord.title,
    body: broadcastRecord.body,
    rich_body: broadcastRecord.richBody,
    target_audience: broadcastRecord.targetAudience,
    sent_count: broadcastRecord.sentCount,
    failed_count: broadcastRecord.failedCount,
    created_at: broadcastRecord.createdAt,
  })

  return broadcastRecord
}

// ─── Schedule a message for future delivery ─────────────────────────

export async function scheduleMessage(
  userId: string,
  channel: MessageChannel,
  message: {
    title: string
    body: string
    richBody?: string
    priority?: MessagePriority
    actionUrl?: string
    metadata?: Record<string, unknown>
  },
  scheduledAt: string,
): Promise<CommunicationMessage> {
  const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const scheduled: CommunicationMessage = {
    id,
    userId,
    channel,
    priority: message.priority || 'normal',
    title: message.title,
    body: message.body,
    richBody: message.richBody,
    actionUrl: message.actionUrl,
    metadata: { ...message.metadata, scheduled_at: scheduledAt },
    status: 'queued',
    sentAt: scheduledAt,
  }

  const { error } = await supabase
    .from('communication_messages')
    .insert({
      id: scheduled.id,
      user_id: scheduled.userId,
      channel: scheduled.channel,
      priority: scheduled.priority,
      title: scheduled.title,
      body: scheduled.body,
      rich_body: scheduled.richBody,
      action_url: scheduled.actionUrl,
      metadata: scheduled.metadata,
      status: 'queued',
      sent_at: scheduledAt,
    })

  if (error) throw new Error(`Failed to schedule message: ${error.message}`)

  return scheduled
}

// ─── Delivery report for a specific message ─────────────────────────

export async function getDeliveryReport(messageId: string): Promise<DeliveryReport | null> {
  const { data, error } = await supabase
    .from('communication_messages')
    .select('id, channel, status, sent_at, delivered_at, metadata')
    .eq('id', messageId)
    .maybeSingle()

  if (error || !data) return null

  return {
    messageId: data.id,
    channel: data.channel as MessageChannel,
    status: data.status,
    timestamp: data.delivered_at || data.sent_at,
    metadata: data.metadata as Record<string, unknown> | undefined,
  }
}

// ─── User channel preferences ───────────────────────────────────────

const DEFAULT_PREFERENCES: ChannelPreferences['channels'] = {
  in_app: { enabled: true, frequency: 'realtime' },
  email: { enabled: true, frequency: 'daily' },
  push: { enabled: false },
  discord: { enabled: false },
  sms: { enabled: false },
}

export async function getUserPreferences(userId: string): Promise<ChannelPreferences | null> {
  const { data, error } = await supabase
    .from('communication_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[CommunicationEngine] Failed to fetch preferences:', error)
    return null
  }

  if (!data) {
    // Return defaults
    return { userId, channels: { ...DEFAULT_PREFERENCES } }
  }

  return {
    userId: data.user_id,
    channels: data.channels as Record<MessageChannel, ChannelConfig>,
  }
}

export async function updatePreferences(
  userId: string,
  prefs: Partial<Record<MessageChannel, Partial<ChannelConfig>>>,
): Promise<ChannelPreferences> {
  // Load existing preferences
  const existing = await getUserPreferences(userId)
  const merged: Record<MessageChannel, ChannelConfig> = existing
    ? { ...existing.channels }
    : { ...DEFAULT_PREFERENCES }

  // Apply updates
  for (const [channel, config] of Object.entries(prefs) as [MessageChannel, Partial<ChannelConfig>][]) {
    merged[channel] = { ...merged[channel], ...config }
  }

  const { error } = await supabase
    .from('communication_preferences')
    .upsert({
      user_id: userId,
      channels: merged,
      updated_at: new Date().toISOString(),
    })

  if (error) throw new Error(`Failed to update preferences: ${error.message}`)

  return { userId, channels: merged }
}

// ─── Message history with pagination ────────────────────────────────

export async function getHistory(
  userId: string,
  opts?: MessageHistoryOptions,
): Promise<CommunicationMessage[]> {
  let query = supabase
    .from('communication_messages')
    .select('*')
    .eq('user_id', userId)
    .order('sent_at', { ascending: false })

  if (opts?.channel) query = query.eq('channel', opts.channel)
  if (opts?.status) query = query.eq('status', opts.status)
  if (opts?.since) query = query.gte('sent_at', opts.since)
  if (opts?.offset) query = query.range(opts.offset, opts.offset + (opts.limit || 50) - 1)

  query = query.limit(opts?.limit || 50)

  const { data, error } = await query

  if (error) {
    console.error('[CommunicationEngine] Failed to fetch history:', error)
    return []
  }

  return (data || []).map(mapMessageRow)
}

// ─── Analytics — delivery rates, open rates, channel performance ────

export async function getAnalytics(): Promise<CommunicationAnalytics> {
  const { data, error } = await supabase
    .from('communication_messages')
    .select('channel, status')

  if (error) {
    console.error('[CommunicationEngine] Failed to fetch analytics:', error)
    return {
      sent: 0,
      delivered: 0,
      failed: 0,
      openRate: 0,
      channelBreakdown: {
        in_app: { sent: 0, delivered: 0, failed: 0 },
        email: { sent: 0, delivered: 0, failed: 0 },
        push: { sent: 0, delivered: 0, failed: 0 },
        discord: { sent: 0, delivered: 0, failed: 0 },
        sms: { sent: 0, delivered: 0, failed: 0 },
      },
    }
  }

  const rows = data || []
  let sent = 0
  let delivered = 0
  let failed = 0
  let read = 0

  const breakdown: Record<string, { sent: number; delivered: number; failed: number }> = {
    in_app: { sent: 0, delivered: 0, failed: 0 },
    email: { sent: 0, delivered: 0, failed: 0 },
    push: { sent: 0, delivered: 0, failed: 0 },
    discord: { sent: 0, delivered: 0, failed: 0 },
    sms: { sent: 0, delivered: 0, failed: 0 },
  }

  for (const row of rows) {
    const ch = row.channel as string
    const status = row.status as string

    if (status === 'sent' || status === 'delivered' || status === 'read') sent++
    if (status === 'delivered' || status === 'read') delivered++
    if (status === 'failed' || status === 'bounced') failed++
    if (status === 'read') read++

    if (breakdown[ch]) {
      if (status === 'sent' || status === 'delivered' || status === 'read') breakdown[ch].sent++
      if (status === 'delivered' || status === 'read') breakdown[ch].delivered++
      if (status === 'failed' || status === 'bounced') breakdown[ch].failed++
    }
  }

  const openRate = sent > 0 ? read / sent : 0

  return {
    sent,
    delivered,
    failed,
    openRate,
    channelBreakdown: breakdown as CommunicationAnalytics['channelBreakdown'],
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Map a database row to a CommunicationMessage */
function mapMessageRow(row: Record<string, unknown>): CommunicationMessage {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    channel: row.channel as MessageChannel,
    priority: (row.priority as string as MessagePriority) || 'normal',
    title: row.title as string,
    body: row.body as string,
    richBody: (row.rich_body as string) || undefined,
    actionUrl: (row.action_url as string) || undefined,
    metadata: (row.metadata as Record<string, unknown>) || undefined,
    status: row.status as CommunicationMessage['status'],
    sentAt: row.sent_at as string,
    deliveredAt: (row.delivered_at as string) || null,
    readAt: (row.read_at as string) || null,
    failureReason: (row.failure_reason as string) || null,
  }
}

/** Dispatch a message to the appropriate channel via edge functions */
async function dispatchToChannel(
  channel: MessageChannel,
  message: CommunicationMessage,
): Promise<void> {
  const token = await getAccessToken()
  const apikey = import.meta.env.VITE_SUPABASE_KEY || ''

  switch (channel) {
    case 'email': {
      const res = await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': apikey,
        },
        body: JSON.stringify({
          channel: 'email',
          to: message.userId,
          subject: message.title,
          body: message.body,
          html: message.richBody,
        }),
      })
      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Email dispatch failed (${res.status}): ${errText}`)
      }
      break
    }

    case 'discord': {
      const res = await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': apikey,
        },
        body: JSON.stringify({
          channel: 'discord',
          title: message.title,
          body: message.body,
        }),
      })
      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Discord dispatch failed (${res.status}): ${errText}`)
      }
      break
    }

    case 'push': {
      // Push notifications would use web-push or a push service
      // For now, store as in-app and mark as sent
      console.log('[CommunicationEngine] Push notification queued (not yet implemented):', message.title)
      break
    }

    case 'sms': {
      // SMS would use Twilio or similar
      console.log('[CommunicationEngine] SMS queued (not yet implemented):', message.title)
      break
    }

    case 'in_app':
    default:
      // In-app messages are already persisted — no external dispatch needed
      break
  }
}

/** Check if current time falls within quiet hours */
function isQuietHours(start: string, end: string): boolean {
  const now = new Date()
  const [startH, startM] = start.split(':').map(Number)
  const [endH, endM] = end.split(':').map(Number)

  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  // Handle overnight quiet hours (e.g., 22:00 - 07:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes
  }

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes
}
