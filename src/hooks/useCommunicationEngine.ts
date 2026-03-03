// ─── useCommunicationEngine — React bridge for Communication Engine ────

import { useCallback } from 'react'
import {
  sendMessage,
  sendMultiChannel,
  broadcast,
  scheduleMessage,
  getDeliveryReport,
  getUserPreferences,
  updatePreferences,
  getHistory,
  getAnalytics,
} from '../engine/CommunicationEngine'
import type {
  MessageChannel,
  MessagePriority,
  ChannelConfig,
  MessageHistoryOptions,
} from '../engine/communication/types'
import { useCommunicationStore } from '../stores/communicationStore'

interface UseCommunicationEngineParams {
  userId: string
  isAdmin?: boolean
}

export function useCommunicationEngine({ userId, isAdmin }: UseCommunicationEngineParams) {
  const store = useCommunicationStore()

  // ─── Send a message on a specific channel ─────────────────

  const send = useCallback(async (
    channel: MessageChannel,
    message: {
      title: string
      body: string
      richBody?: string
      priority?: MessagePriority
      actionUrl?: string
      metadata?: Record<string, unknown>
    },
  ) => {
    store.setLoading(true)
    try {
      const result = await sendMessage(userId, channel, message)
      store.addMessage(result)
      return result
    } finally {
      store.setLoading(false)
    }
  }, [userId, store])

  // ─── Send to multiple channels ────────────────────────────

  const sendMulti = useCallback(async (
    channels: MessageChannel[],
    message: {
      title: string
      body: string
      richBody?: string
      priority?: MessagePriority
      actionUrl?: string
      metadata?: Record<string, unknown>
    },
  ) => {
    store.setLoading(true)
    try {
      const results = await sendMultiChannel(userId, channels, message)
      for (const msg of results) {
        store.addMessage(msg)
      }
      return results
    } finally {
      store.setLoading(false)
    }
  }, [userId, store])

  // ─── Broadcast (admin only) ───────────────────────────────

  const sendBroadcast = useCallback(async (
    message: {
      title: string
      body: string
      richBody?: string
      channels: MessageChannel[]
      targetAudience?: string
    },
  ) => {
    if (!isAdmin) throw new Error('Broadcast requires admin privileges')
    store.setLoading(true)
    try {
      const result = await broadcast(message)
      store.addBroadcast(result)
      return result
    } finally {
      store.setLoading(false)
    }
  }, [isAdmin, store])

  // ─── Schedule a message ───────────────────────────────────

  const schedule = useCallback(async (
    channel: MessageChannel,
    message: {
      title: string
      body: string
      richBody?: string
      priority?: MessagePriority
      actionUrl?: string
    },
    scheduledAt: string,
  ) => {
    store.setLoading(true)
    try {
      const result = await scheduleMessage(userId, channel, message, scheduledAt)
      store.addMessage(result)
      return result
    } finally {
      store.setLoading(false)
    }
  }, [userId, store])

  // ─── Check delivery status ────────────────────────────────

  const checkDelivery = useCallback(async (messageId: string) => {
    const report = await getDeliveryReport(messageId)
    if (report) {
      store.updateMessage(messageId, { status: report.status })
    }
    return report
  }, [store])

  // ─── Load messages ────────────────────────────────────────

  const loadMessages = useCallback(async (opts?: MessageHistoryOptions) => {
    store.setLoading(true)
    try {
      const messages = await getHistory(userId, opts)
      store.setMessages(messages)
      return messages
    } finally {
      store.setLoading(false)
    }
  }, [userId, store])

  // ─── Preferences ──────────────────────────────────────────

  const loadPreferences = useCallback(async () => {
    const prefs = await getUserPreferences(userId)
    if (prefs) store.setPreferences(prefs)
    return prefs
  }, [userId, store])

  const updatePreference = useCallback(async (
    channel: MessageChannel,
    config: Partial<ChannelConfig>,
  ) => {
    store.setLoading(true)
    try {
      const updated = await updatePreferences(userId, { [channel]: config })
      store.setPreferences(updated)
      return updated
    } finally {
      store.setLoading(false)
    }
  }, [userId, store])

  // ─── Analytics ────────────────────────────────────────────

  const loadAnalytics = useCallback(async () => {
    store.setLoading(true)
    try {
      const analytics = await getAnalytics()
      store.setAnalytics(analytics)
      return analytics
    } finally {
      store.setLoading(false)
    }
  }, [store])

  return {
    // State
    messages: store.messages,
    broadcasts: store.broadcasts,
    preferences: store.preferences,
    analytics: store.analytics,
    isLoading: store.isLoading,

    // Actions
    sendMessage: send,
    sendMultiChannel: sendMulti,
    broadcast: sendBroadcast,
    scheduleMessage: schedule,
    checkDelivery,
    loadMessages,
    loadPreferences,
    updatePreference,
    loadAnalytics,
  }
}
