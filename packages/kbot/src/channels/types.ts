// Shared types for the unified messaging-channel adapter family.
//
// Inspired by OpenClaw (steipete/openclaw on npm). Every channel adapter
// (Slack, WhatsApp, Telegram, Signal, Matrix, Teams, ...) implements
// the same `ChannelAdapter` interface so kbot tools and agents can
// send/receive messages without caring which platform they target.

export interface ChannelMessage {
  /** Channel-native message id (string-form). */
  id: string
  /** Author handle / user id reported by the channel. */
  from: string
  /** Plain-text body of the message. */
  text: string
  /** Unix epoch ms. Channels that report seconds should multiply by 1000. */
  ts: number
  /** Raw, channel-specific payload — adapter consumers may inspect. */
  raw?: unknown
}

export interface ChannelEnvelope {
  /** Target channel id (Slack channel id, chat id, room id, ...). */
  channel: string
  /** Plain-text body. Required even when blocks are supplied. */
  text: string
  /** Optional rich content. Slack blocks, Telegram entities, etc. */
  blocks?: unknown
  /** Adapter-specific options forwarded verbatim. */
  options?: Record<string, unknown>
}

export interface ChannelReceiveOptions {
  channel: string
  /** Unix epoch ms; only return messages newer than this. */
  oldest?: number
  /** Maximum number of messages to return (adapter may cap). */
  limit?: number
}

export interface ChannelInfo {
  id: string
  name: string
  topic?: string
}

export interface ChannelAdapter {
  /** Stable adapter name — must match registry key. */
  readonly name: string
  /** True when required env vars / credentials are present. */
  isConfigured(): boolean
  send(envelope: ChannelEnvelope): Promise<{ id: string; ts: number }>
  receive(opts: ChannelReceiveOptions): Promise<ChannelMessage[]>
  listChannels(): Promise<ChannelInfo[]>
}

export class ChannelNotImplementedError extends Error {
  constructor(adapter: string) {
    super(`${adapter} adapter not implemented yet — see TODO in channels/${adapter}.ts`)
    this.name = 'ChannelNotImplementedError'
  }
}
