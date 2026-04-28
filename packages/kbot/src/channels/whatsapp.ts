// WhatsApp channel adapter — STUB.
//
// TODO: Implement against WhatsApp Business Cloud API.
//   - Auth: Bearer token from Meta for Developers (`WHATSAPP_BUSINESS_TOKEN`).
//   - Phone number id: WHATSAPP_PHONE_NUMBER_ID
//   - send → POST https://graph.facebook.com/v20.0/{phone-id}/messages
//   - receive → webhook subscription; this adapter would surface messages
//     queued by the webhook receiver, not poll.
//   - listChannels → WhatsApp does not have channels; return contacts/groups
//     resolved via the Cloud API or a local cache.

import { ChannelNotImplementedError, type ChannelAdapter } from './types.js'

export const whatsappAdapter: ChannelAdapter = {
  name: 'whatsapp',

  isConfigured(): boolean {
    return Boolean(process.env.WHATSAPP_BUSINESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
  },

  async send() {
    throw new ChannelNotImplementedError('whatsapp')
  },

  async receive() {
    throw new ChannelNotImplementedError('whatsapp')
  },

  async listChannels() {
    throw new ChannelNotImplementedError('whatsapp')
  },
}

export default whatsappAdapter
