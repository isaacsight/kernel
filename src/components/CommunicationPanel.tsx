// ─── CommunicationPanel ──────────────────────────────────────────
//
// Bottom-sheet panel for communication management.
// Three tabs: Messages (history + status), Preferences (channel toggles),
// Analytics (delivery stats, admin only).

import { useState, useEffect, useCallback } from 'react'
import { motion, useDragControls } from 'framer-motion'
import { SPRING } from '../constants/motion'
import { useCommunicationEngine } from '../hooks/useCommunicationEngine'
import {
  IconClose,
  IconMail,
  IconBell,
  IconCheck,
  IconAlertCircle,
  IconClock,
  IconSettings,
  IconChart,
  IconChevronRight,
} from './KernelIcons'
import type {
  MessageChannel,
  CommunicationMessage,
  ChannelConfig,
  CommunicationAnalytics,
} from '../engine/communication/types'

type Tab = 'messages' | 'preferences' | 'analytics'

interface CommunicationPanelProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  isAdmin?: boolean
}

const CHANNEL_LABELS: Record<MessageChannel, string> = {
  in_app: 'In-App',
  email: 'Email',
  push: 'Push Notifications',
  discord: 'Discord',
  sms: 'SMS',
}

const STATUS_ICONS: Record<string, { icon: typeof IconCheck; className: string }> = {
  sent: { icon: IconCheck, className: 'ka-comms-status--sent' },
  delivered: { icon: IconCheck, className: 'ka-comms-status--delivered' },
  read: { icon: IconCheck, className: 'ka-comms-status--read' },
  failed: { icon: IconAlertCircle, className: 'ka-comms-status--failed' },
  bounced: { icon: IconAlertCircle, className: 'ka-comms-status--bounced' },
  queued: { icon: IconClock, className: 'ka-comms-status--queued' },
}

export function CommunicationPanel({ isOpen, onClose, userId, isAdmin }: CommunicationPanelProps) {
  const [tab, setTab] = useState<Tab>('messages')
  const dragControls = useDragControls()
  const comms = useCommunicationEngine({ userId, isAdmin })

  useEffect(() => {
    if (isOpen) {
      comms.loadMessages()
      comms.loadPreferences()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      <motion.div
        className="ka-more-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="ka-comms-panel"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={SPRING.DEFAULT}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, info) => {
          if (info.offset.y > 80 || info.velocity.y > 300) onClose()
        }}
      >
        <div className="ka-more-drag-handle" onPointerDown={(e) => dragControls.start(e)} />

        <div className="ka-comms-panel-header">
          <h2 className="ka-comms-panel-title">
            <IconBell size={18} aria-hidden="true" />
            Communications
          </h2>
          <button className="ka-panel-close" onClick={onClose} aria-label="Close">
            <IconClose size={18} />
          </button>
        </div>

        <div className="ka-comms-panel-tabs">
          {([
            { key: 'messages' as Tab, label: 'Messages', icon: IconMail },
            { key: 'preferences' as Tab, label: 'Preferences', icon: IconSettings },
            ...(isAdmin ? [{ key: 'analytics' as Tab, label: 'Analytics', icon: IconChart }] : []),
          ]).map(t => (
            <button
              key={t.key}
              className={`ka-comms-panel-tab${tab === t.key ? ' ka-comms-panel-tab--active' : ''}`}
              onClick={() => {
                setTab(t.key)
                if (t.key === 'analytics') comms.loadAnalytics()
              }}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="ka-comms-panel-content">
          {tab === 'messages' && (
            <MessagesTab
              messages={comms.messages}
              isLoading={comms.isLoading}
            />
          )}
          {tab === 'preferences' && (
            <PreferencesTab
              preferences={comms.preferences}
              isLoading={comms.isLoading}
              onUpdate={comms.updatePreference}
            />
          )}
          {tab === 'analytics' && isAdmin && (
            <AnalyticsTab
              analytics={comms.analytics}
              isLoading={comms.isLoading}
            />
          )}
        </div>
      </motion.div>
    </>
  )
}

// ─── Messages Tab ─────────────────────────────────────────────────

function MessagesTab({
  messages,
  isLoading,
}: {
  messages: CommunicationMessage[]
  isLoading: boolean
}) {
  if (isLoading && messages.length === 0) {
    return <div className="ka-comms-loading">Loading messages...</div>
  }

  if (messages.length === 0) {
    return (
      <div className="ka-comms-empty">
        <IconMail size={32} />
        <p className="ka-comms-empty-title">No messages yet</p>
        <p className="ka-comms-empty-desc">Your notification history will appear here.</p>
      </div>
    )
  }

  return (
    <div className="ka-comms-messages-list">
      {messages.map(msg => {
        const statusInfo = STATUS_ICONS[msg.status] || STATUS_ICONS.queued
        const StatusIcon = statusInfo.icon

        return (
          <div key={msg.id} className="ka-comms-message-item">
            <div className="ka-comms-message-header">
              <span className="ka-comms-message-channel">
                {CHANNEL_LABELS[msg.channel] || msg.channel}
              </span>
              <span className={`ka-comms-message-status ${statusInfo.className}`}>
                <StatusIcon size={12} />
                {msg.status}
              </span>
            </div>
            <div className="ka-comms-message-title">{msg.title}</div>
            <div className="ka-comms-message-body">
              {msg.body.length > 120 ? msg.body.slice(0, 120) + '...' : msg.body}
            </div>
            <div className="ka-comms-message-footer">
              <span className="ka-comms-message-time">
                {new Date(msg.sentAt).toLocaleString()}
              </span>
              {msg.priority !== 'normal' && (
                <span className={`ka-comms-message-priority ka-comms-priority--${msg.priority}`}>
                  {msg.priority}
                </span>
              )}
            </div>
            {msg.failureReason && (
              <div className="ka-comms-message-error">
                <IconAlertCircle size={12} />
                {msg.failureReason}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Preferences Tab ──────────────────────────────────────────────

function PreferencesTab({
  preferences,
  isLoading,
  onUpdate,
}: {
  preferences: ReturnType<typeof useCommunicationEngine>['preferences']
  isLoading: boolean
  onUpdate: (channel: MessageChannel, config: Partial<ChannelConfig>) => void
}) {
  const channels: MessageChannel[] = ['in_app', 'email', 'push', 'discord', 'sms']

  if (!preferences) {
    return <div className="ka-comms-loading">Loading preferences...</div>
  }

  return (
    <div className="ka-comms-preferences">
      <p className="ka-comms-preferences-desc">
        Choose how you receive notifications. Urgent messages bypass quiet hours.
      </p>

      {channels.map(channel => {
        const config = preferences.channels[channel] || { enabled: false }

        return (
          <div key={channel} className="ka-comms-pref-item">
            <div className="ka-comms-pref-header">
              <div className="ka-comms-pref-info">
                <span className="ka-comms-pref-label">{CHANNEL_LABELS[channel]}</span>
                {config.frequency && (
                  <span className="ka-comms-pref-frequency">{config.frequency}</span>
                )}
              </div>
              <label className="ka-comms-toggle">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={() => onUpdate(channel, { enabled: !config.enabled })}
                  disabled={isLoading}
                />
                <span className="ka-comms-toggle-slider" />
              </label>
            </div>

            {config.enabled && (
              <div className="ka-comms-pref-details">
                <QuietHoursControl
                  start={config.quietHoursStart || null}
                  end={config.quietHoursEnd || null}
                  onChange={(start, end) => onUpdate(channel, {
                    quietHoursStart: start,
                    quietHoursEnd: end,
                  })}
                />
                <FrequencyControl
                  frequency={config.frequency || 'realtime'}
                  onChange={(freq) => onUpdate(channel, { frequency: freq })}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Quiet Hours Control ──────────────────────────────────────────

function QuietHoursControl({
  start,
  end,
  onChange,
}: {
  start: string | null
  end: string | null
  onChange: (start: string | null, end: string | null) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="ka-comms-quiet-hours">
      <button
        className="ka-comms-quiet-hours-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <IconClock size={12} />
        Quiet Hours
        {start && end ? ` (${start} - ${end})` : ' (Off)'}
        <IconChevronRight size={12} style={{ transform: expanded ? 'rotate(90deg)' : 'none' }} />
      </button>
      {expanded && (
        <div className="ka-comms-quiet-hours-inputs">
          <label>
            From
            <input
              type="time"
              value={start || ''}
              onChange={e => onChange(e.target.value || null, end)}
              className="ka-comms-time-input"
            />
          </label>
          <label>
            To
            <input
              type="time"
              value={end || ''}
              onChange={e => onChange(start, e.target.value || null)}
              className="ka-comms-time-input"
            />
          </label>
          {(start || end) && (
            <button
              className="ka-comms-quiet-hours-clear"
              onClick={() => onChange(null, null)}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Frequency Control ────────────────────────────────────────────

function FrequencyControl({
  frequency,
  onChange,
}: {
  frequency: string
  onChange: (freq: 'realtime' | 'hourly' | 'daily' | 'weekly') => void
}) {
  const options: { value: 'realtime' | 'hourly' | 'daily' | 'weekly'; label: string }[] = [
    { value: 'realtime', label: 'Real-time' },
    { value: 'hourly', label: 'Hourly digest' },
    { value: 'daily', label: 'Daily digest' },
    { value: 'weekly', label: 'Weekly digest' },
  ]

  return (
    <div className="ka-comms-frequency">
      <span className="ka-comms-frequency-label">Delivery frequency</span>
      <div className="ka-comms-frequency-options">
        {options.map(opt => (
          <button
            key={opt.value}
            className={`ka-comms-frequency-btn${frequency === opt.value ? ' ka-comms-frequency-btn--active' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Analytics Tab (Admin Only) ───────────────────────────────────

function AnalyticsTab({
  analytics,
  isLoading,
}: {
  analytics: CommunicationAnalytics | null
  isLoading: boolean
}) {
  if (isLoading && !analytics) {
    return <div className="ka-comms-loading">Loading analytics...</div>
  }

  if (!analytics) {
    return (
      <div className="ka-comms-empty">
        <IconChart size={32} />
        <p className="ka-comms-empty-title">No analytics data</p>
        <p className="ka-comms-empty-desc">Send some messages to see delivery stats.</p>
      </div>
    )
  }

  const channels: MessageChannel[] = ['in_app', 'email', 'push', 'discord', 'sms']
  const activeChannels = channels.filter(ch => {
    const b = analytics.channelBreakdown[ch]
    return b.sent > 0 || b.delivered > 0 || b.failed > 0
  })

  return (
    <div className="ka-comms-analytics">
      <div className="ka-comms-analytics-overview">
        <div className="ka-comms-analytics-stat">
          <span className="ka-comms-analytics-value">{analytics.sent.toLocaleString()}</span>
          <span className="ka-comms-analytics-label">Sent</span>
        </div>
        <div className="ka-comms-analytics-stat">
          <span className="ka-comms-analytics-value">{analytics.delivered.toLocaleString()}</span>
          <span className="ka-comms-analytics-label">Delivered</span>
        </div>
        <div className="ka-comms-analytics-stat">
          <span className="ka-comms-analytics-value">{analytics.failed.toLocaleString()}</span>
          <span className="ka-comms-analytics-label">Failed</span>
        </div>
        <div className="ka-comms-analytics-stat">
          <span className="ka-comms-analytics-value">{(analytics.openRate * 100).toFixed(1)}%</span>
          <span className="ka-comms-analytics-label">Open Rate</span>
        </div>
      </div>

      {activeChannels.length > 0 && (
        <div className="ka-comms-analytics-channels">
          <h3 className="ka-comms-section-title">Channel Performance</h3>
          {activeChannels.map(channel => {
            const b = analytics.channelBreakdown[channel]
            const total = b.sent + b.failed
            const successRate = total > 0 ? (b.delivered / total) * 100 : 0

            return (
              <div key={channel} className="ka-comms-analytics-channel">
                <div className="ka-comms-analytics-channel-header">
                  <span className="ka-comms-analytics-channel-name">
                    {CHANNEL_LABELS[channel]}
                  </span>
                  <span className="ka-comms-analytics-channel-rate">
                    {successRate.toFixed(0)}% delivered
                  </span>
                </div>
                <div className="ka-comms-analytics-bar">
                  <div
                    className="ka-comms-analytics-bar-fill"
                    style={{ width: `${successRate}%` }}
                  />
                </div>
                <div className="ka-comms-analytics-channel-stats">
                  <span>{b.sent} sent</span>
                  <span>{b.delivered} delivered</span>
                  {b.failed > 0 && <span className="ka-comms-analytics-channel-failed">{b.failed} failed</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
