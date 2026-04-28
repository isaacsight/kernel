// Matrix channel adapter — STUB.
//
// TODO: Implement against the Matrix Client-Server API.
//   - MATRIX_HOMESERVER (e.g. https://matrix.org)
//   - MATRIX_TOKEN (access token from /login or a registered application service)
//   - MATRIX_USER_ID (optional — only required for some endpoints)
//   - send → PUT {homeserver}/_matrix/client/v3/rooms/{roomId}/send/m.room.message/{txnId}
//   - receive → /sync endpoint with `since` token (kbot persists the token
//     between calls) → translate timeline events into ChannelMessage.
//   - listChannels → /joined_rooms then resolve names via /state.

import { ChannelNotImplementedError, type ChannelAdapter } from './types.js'

export const matrixAdapter: ChannelAdapter = {
  name: 'matrix',

  isConfigured(): boolean {
    return Boolean(process.env.MATRIX_HOMESERVER && process.env.MATRIX_TOKEN)
  },

  async send() {
    throw new ChannelNotImplementedError('matrix')
  },

  async receive() {
    throw new ChannelNotImplementedError('matrix')
  },

  async listChannels() {
    throw new ChannelNotImplementedError('matrix')
  },
}

export default matrixAdapter
