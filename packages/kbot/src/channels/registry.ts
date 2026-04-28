// Registry for messaging channel adapters.
//
// Consumers should call `getChannel(name)` rather than importing adapters
// directly; this lets the registry be replaced or extended (e.g. a plugin
// registering an Instagram adapter at runtime).

import type { ChannelAdapter } from './types.js'
import { slackAdapter } from './slack.js'
import { whatsappAdapter } from './whatsapp.js'
import { telegramAdapter } from './telegram.js'
import { signalAdapter } from './signal.js'
import { matrixAdapter } from './matrix.js'
import { teamsAdapter } from './teams.js'

const adapters: Record<string, ChannelAdapter> = {
  slack: slackAdapter,
  whatsapp: whatsappAdapter,
  telegram: telegramAdapter,
  signal: signalAdapter,
  matrix: matrixAdapter,
  teams: teamsAdapter,
}

export function getChannel(name: string): ChannelAdapter {
  const adapter = adapters[name.toLowerCase()]
  if (!adapter) {
    throw new Error(
      `Unknown channel "${name}". Available: ${Object.keys(adapters).join(', ')}`,
    )
  }
  return adapter
}

export function listChannels(): Array<{ name: string; configured: boolean }> {
  return Object.values(adapters).map((a) => ({
    name: a.name,
    configured: a.isConfigured(),
  }))
}

export function registerChannel(adapter: ChannelAdapter): void {
  adapters[adapter.name.toLowerCase()] = adapter
}
