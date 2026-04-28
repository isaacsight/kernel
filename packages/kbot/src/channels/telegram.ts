// Telegram channel adapter — STUB.
//
// TODO: Implement against the Telegram Bot API.
//   - Auth: TELEGRAM_BOT_TOKEN (from @BotFather).
//   - send → POST https://api.telegram.org/bot{token}/sendMessage
//     body: { chat_id, text, parse_mode?, reply_markup? }
//   - receive → either long-poll via getUpdates (simple) or webhook
//     (production). Translate `update.message` into ChannelMessage.
//   - listChannels → Telegram has no enumeration API; surface chats from
//     a local persisted cache built from received updates.

import { ChannelNotImplementedError, type ChannelAdapter } from './types.js'

export const telegramAdapter: ChannelAdapter = {
  name: 'telegram',

  isConfigured(): boolean {
    return Boolean(process.env.TELEGRAM_BOT_TOKEN)
  },

  async send() {
    throw new ChannelNotImplementedError('telegram')
  },

  async receive() {
    throw new ChannelNotImplementedError('telegram')
  },

  async listChannels() {
    throw new ChannelNotImplementedError('telegram')
  },
}

export default telegramAdapter
