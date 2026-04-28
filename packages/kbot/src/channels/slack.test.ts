// Tests for the Slack channel adapter.
//
// `fetch` is global on Node 20+; we replace it per-test with a mock
// that records the call and returns a stub response.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { slackAdapter } from './slack.js'

type FetchMock = ReturnType<typeof vi.fn>

const realFetch = globalThis.fetch
const realToken = process.env.SLACK_BOT_TOKEN

function mockFetch(payload: unknown, status = 200): FetchMock {
  const fn = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: async () => payload,
  })) as unknown as FetchMock
  globalThis.fetch = fn as unknown as typeof fetch
  return fn
}

beforeEach(() => {
  process.env.SLACK_BOT_TOKEN = 'xoxb-test-token'
})

afterEach(() => {
  if (realToken === undefined) {
    delete process.env.SLACK_BOT_TOKEN
  } else {
    process.env.SLACK_BOT_TOKEN = realToken
  }
  globalThis.fetch = realFetch
  vi.restoreAllMocks()
})

describe('slackAdapter.isConfigured', () => {
  it('returns true when SLACK_BOT_TOKEN is set', () => {
    expect(slackAdapter.isConfigured()).toBe(true)
  })

  it('returns false when SLACK_BOT_TOKEN is missing', () => {
    delete process.env.SLACK_BOT_TOKEN
    expect(slackAdapter.isConfigured()).toBe(false)
  })
})

describe('slackAdapter.send', () => {
  it('posts to chat.postMessage with bearer token and parses response', async () => {
    const fetchFn = mockFetch({
      ok: true,
      ts: '1700000000.000100',
      channel: 'C123',
      message: { ts: '1700000000.000100', text: 'hi' },
    })

    const result = await slackAdapter.send({ channel: 'C123', text: 'hi' })

    expect(result.id).toBe('1700000000.000100')
    expect(result.ts).toBe(1_700_000_000_000)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://slack.com/api/chat.postMessage')
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer xoxb-test-token',
    )
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json; charset=utf-8',
    )
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({ channel: 'C123', text: 'hi' })
  })

  it('throws when Slack returns ok:false, surfacing the `error` string', async () => {
    mockFetch({ ok: false, error: 'channel_not_found' })

    await expect(
      slackAdapter.send({ channel: 'C-bogus', text: 'hi' }),
    ).rejects.toThrow(/channel_not_found/)
  })

  it('throws when SLACK_BOT_TOKEN is missing', async () => {
    delete process.env.SLACK_BOT_TOKEN
    mockFetch({ ok: true, ts: '1.0' })

    await expect(
      slackAdapter.send({ channel: 'C123', text: 'hi' }),
    ).rejects.toThrow(/SLACK_BOT_TOKEN/)
  })
})

describe('slackAdapter.listChannels', () => {
  it('returns a parsed array of {id, name, topic}', async () => {
    mockFetch({
      ok: true,
      channels: [
        { id: 'C1', name: 'general', topic: { value: 'water cooler' } },
        { id: 'C2', name: 'random' },
      ],
    })

    const channels = await slackAdapter.listChannels()
    expect(channels).toEqual([
      { id: 'C1', name: 'general', topic: 'water cooler' },
      { id: 'C2', name: 'random', topic: undefined },
    ])
  })
})

describe('slackAdapter.receive', () => {
  it('translates Slack history messages into ChannelMessage records', async () => {
    mockFetch({
      ok: true,
      messages: [
        { ts: '1700000000.000100', user: 'U1', text: 'first' },
        { ts: '1700000001.000200', bot_id: 'B1', text: 'second' },
      ],
    })

    const msgs = await slackAdapter.receive({ channel: 'C1' })
    expect(msgs).toHaveLength(2)
    expect(msgs[0]).toMatchObject({
      id: '1700000000.000100',
      from: 'U1',
      text: 'first',
      ts: 1_700_000_000_000,
    })
    expect(msgs[1].from).toBe('B1')
  })
})
