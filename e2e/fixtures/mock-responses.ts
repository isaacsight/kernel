import type { Page } from '@playwright/test'

/** Standard Kernel text response */
export const MOCK_TEXT_RESPONSE = {
  id: 'msg_mock_001',
  type: 'message',
  role: 'assistant',
  content: [{ type: 'text', text: 'This is a mock response from Kernel.' }],
  model: 'claude-sonnet-4-20250514',
  stop_reason: 'end_turn',
  usage: { input_tokens: 100, output_tokens: 50 },
}

/** Response with a code artifact */
export const MOCK_CODE_RESPONSE = {
  id: 'msg_mock_002',
  type: 'message',
  role: 'assistant',
  content: [{
    type: 'text',
    text: 'Here\'s the code:\n\n```javascript:hello.js\nfunction hello() {\n  console.log("Hello, world!")\n}\n\nhello()\n```\n\nThis creates a simple greeting function.',
  }],
  model: 'claude-sonnet-4-20250514',
  stop_reason: 'end_turn',
  usage: { input_tokens: 100, output_tokens: 80 },
}

/**
 * Mock the claude-proxy edge function to return predictable responses.
 * This prevents real API calls during E2E tests.
 */
export async function mockClaudeProxy(page: Page, response = MOCK_TEXT_RESPONSE) {
  await page.route('**/functions/v1/claude-proxy', async (route) => {
    const request = route.request()

    // Handle streaming requests
    if (request.headers()['accept'] === 'text/event-stream') {
      const streamData = `event: message_start\ndata: ${JSON.stringify({ type: 'message_start', message: { id: response.id, type: 'message', role: 'assistant', model: response.model } })}\n\n` +
        `event: content_block_start\ndata: ${JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })}\n\n` +
        `event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: response.content[0].text } })}\n\n` +
        `event: content_block_stop\ndata: ${JSON.stringify({ type: 'content_block_stop', index: 0 })}\n\n` +
        `event: message_delta\ndata: ${JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: response.usage })}\n\n` +
        `event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n\n`

      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: streamData,
      })
    } else {
      // Non-streaming
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      })
    }
  })
}

/** Mock the free-tier usage check RPC */
export async function mockUsageCheck(page: Page, dailyCount = 5) {
  await page.route('**/rest/v1/rpc/check_daily_usage*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ daily_count: dailyCount, resets_at: new Date(Date.now() + 86400000).toISOString() }),
    })
  })
}

/** Mock usage at limit (20 messages) */
export async function mockUsageAtLimit(page: Page) {
  return mockUsageCheck(page, 20)
}
