// ─── Communication Engine Types ─────────────────────────────────
//
// Type definitions for multi-channel messaging, broadcast,
// delivery tracking, and user notification preferences.

export type MessageChannel = 'in_app' | 'email' | 'push' | 'discord' | 'sms'

export type MessagePriority = 'low' | 'normal' | 'high' | 'urgent'

export type MessageStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'bounced'

export interface CommunicationMessage {
  id: string
  userId: string
  channel: MessageChannel
  priority: MessagePriority
  title: string
  body: string
  richBody?: string
  actionUrl?: string
  metadata?: Record<string, unknown>
  status: MessageStatus
  sentAt: string
  deliveredAt?: string | null
  readAt?: string | null
  failureReason?: string | null
}

export interface ChannelConfig {
  enabled: boolean
  quietHoursStart?: string | null  // "HH:MM" format
  quietHoursEnd?: string | null    // "HH:MM" format
  frequency?: 'realtime' | 'hourly' | 'daily' | 'weekly'
}

export interface ChannelPreferences {
  userId: string
  channels: Record<MessageChannel, ChannelConfig>
}

export interface BroadcastMessage {
  id: string
  channels: MessageChannel[]
  title: string
  body: string
  richBody?: string
  targetAudience?: string | null
  sentCount: number
  failedCount: number
  createdAt: string
}

export interface DeliveryReport {
  messageId: string
  channel: MessageChannel
  status: MessageStatus
  timestamp: string
  metadata?: Record<string, unknown>
}

export interface CommunicationEngineCallbacks {
  onMessageSent?: (message: CommunicationMessage) => void
  onDeliveryUpdate?: (report: DeliveryReport) => void
  onBroadcastComplete?: (broadcast: BroadcastMessage) => void
  onError?: (error: Error, context?: string) => void
}

export interface CommunicationAnalytics {
  sent: number
  delivered: number
  failed: number
  openRate: number
  channelBreakdown: Record<MessageChannel, {
    sent: number
    delivered: number
    failed: number
  }>
}

export interface MessageHistoryOptions {
  channel?: MessageChannel
  status?: MessageStatus
  limit?: number
  offset?: number
  since?: string
}
