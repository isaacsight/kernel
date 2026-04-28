// kbot tool definitions for the unified channel adapter family.
//
// These tools are NOT auto-registered. Whoever wires them in (cli.ts,
// a plugin, or an agent prompt) should call `registerTool(channelSendTool)`
// and `registerTool(channelReceiveTool)`. Keeping registration external
// preserves the CURATION_PLAN.md target of 52 core tools.

import { getChannel } from '../channels/registry.js'
import type { ToolDefinition } from './index.js'

export const channelSendTool: ToolDefinition = {
  name: 'channel_send',
  description:
    'Send a message through a unified channel adapter (slack, whatsapp, telegram, signal, matrix, teams). Slack is fully implemented; others are stubs and will throw until implemented.',
  tier: 'pro',
  parameters: {
    channel_type: {
      type: 'string',
      description: 'Adapter name: slack | whatsapp | telegram | signal | matrix | teams',
      required: true,
    },
    channel: {
      type: 'string',
      description: 'Target channel/chat/room id understood by the adapter',
      required: true,
    },
    text: {
      type: 'string',
      description: 'Plain-text message body',
      required: true,
    },
    blocks: {
      type: 'array',
      description: 'Optional rich content (Slack blocks, etc.)',
      required: false,
    },
  },
  async execute(args) {
    const adapter = getChannel(String(args.channel_type))
    const result = await adapter.send({
      channel: String(args.channel),
      text: String(args.text),
      blocks: args.blocks,
    })
    return JSON.stringify({ ok: true, adapter: adapter.name, ...result })
  },
}

export const channelReceiveTool: ToolDefinition = {
  name: 'channel_receive',
  description:
    'Fetch recent messages from a unified channel adapter. Returns a JSON array of {id, from, text, ts}.',
  tier: 'pro',
  parameters: {
    channel_type: {
      type: 'string',
      description: 'Adapter name: slack | whatsapp | telegram | signal | matrix | teams',
      required: true,
    },
    channel: {
      type: 'string',
      description: 'Source channel/chat/room id',
      required: true,
    },
    oldest: {
      type: 'number',
      description: 'Unix epoch ms; only return messages newer than this',
      required: false,
    },
    limit: {
      type: 'number',
      description: 'Maximum messages to return',
      required: false,
    },
  },
  async execute(args) {
    const adapter = getChannel(String(args.channel_type))
    const messages = await adapter.receive({
      channel: String(args.channel),
      oldest: args.oldest === undefined ? undefined : Number(args.oldest),
      limit: args.limit === undefined ? undefined : Number(args.limit),
    })
    return JSON.stringify({ ok: true, adapter: adapter.name, messages })
  },
}
