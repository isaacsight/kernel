// Microsoft Teams channel adapter — STUB.
//
// TODO: Implement against either:
//   (a) Incoming Webhook (simple, send-only):
//       MICROSOFT_TEAMS_WEBHOOK = https://outlook.office.com/webhook/...
//       send → POST JSON Adaptive Card or MessageCard to the webhook URL.
//       receive/listChannels → unsupported via webhook; surface a clear
//       error pointing the caller at Graph API.
//   (b) Microsoft Graph API (full duplex):
//       requires app registration in Azure AD, delegated/application
//       permissions, and an OAuth2 token. Out of scope for the stub.

import { ChannelNotImplementedError, type ChannelAdapter } from './types.js'

export const teamsAdapter: ChannelAdapter = {
  name: 'teams',

  isConfigured(): boolean {
    return Boolean(process.env.MICROSOFT_TEAMS_WEBHOOK)
  },

  async send() {
    throw new ChannelNotImplementedError('teams')
  },

  async receive() {
    throw new ChannelNotImplementedError('teams')
  },

  async listChannels() {
    throw new ChannelNotImplementedError('teams')
  },
}

export default teamsAdapter
