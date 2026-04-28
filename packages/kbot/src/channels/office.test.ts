// Tests for the Microsoft Office channel adapter.
//
// `fetch` is global on Node 20+; we replace it per-test with a mock that
// records the call and returns a stub response. No real Graph calls.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OfficeChannel, officeAdapter } from './office.js'

type FetchMock = ReturnType<typeof vi.fn>

const realFetch = globalThis.fetch
const realToken = process.env.MICROSOFT_GRAPH_TOKEN

interface MockResponseInit {
  status?: number
  json?: unknown
  text?: string
  contentType?: string
}

function mockFetch(init: MockResponseInit): FetchMock {
  const status = init.status ?? 200
  const contentType =
    init.contentType ?? (init.json !== undefined ? 'application/json' : 'text/plain')
  const fn = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'ERR',
    headers: {
      get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null),
    },
    json: async () => init.json,
    text: async () => init.text ?? (init.json !== undefined ? JSON.stringify(init.json) : ''),
  })) as unknown as FetchMock
  globalThis.fetch = fn as unknown as typeof fetch
  return fn
}

beforeEach(() => {
  process.env.MICROSOFT_GRAPH_TOKEN = 'graph-test-token'
})

afterEach(() => {
  if (realToken === undefined) {
    delete process.env.MICROSOFT_GRAPH_TOKEN
  } else {
    process.env.MICROSOFT_GRAPH_TOKEN = realToken
  }
  globalThis.fetch = realFetch
  vi.restoreAllMocks()
})

describe('OfficeChannel.isConfigured', () => {
  it('returns true when MICROSOFT_GRAPH_TOKEN is set', () => {
    expect(officeAdapter.isConfigured()).toBe(true)
  })

  it('returns false when MICROSOFT_GRAPH_TOKEN is missing', () => {
    delete process.env.MICROSOFT_GRAPH_TOKEN
    expect(officeAdapter.isConfigured()).toBe(false)
  })
})

describe('OfficeChannel.listFiles', () => {
  it('hits /me/drive/root/children and returns the parsed value array', async () => {
    const fetchFn = mockFetch({
      json: {
        value: [
          { id: 'F1', name: 'Notes.docx', file: { mimeType: 'application/msword' } },
          { id: 'F2', name: 'Q2', folder: { childCount: 4 } },
        ],
      },
    })

    const channel = new OfficeChannel()
    const items = await channel.listFiles({})

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ id: 'F1', name: 'Notes.docx' })
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://graph.microsoft.com/v1.0/me/drive/root/children')
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer graph-test-token',
    )
  })

  it('uses the driveId/folderId variant when both are supplied', async () => {
    const fetchFn = mockFetch({ json: { value: [] } })

    const channel = new OfficeChannel()
    await channel.listFiles({ driveId: 'D1', folderId: 'FOLDER1' })

    const [url] = fetchFn.mock.calls[0] as [string]
    expect(url).toBe('https://graph.microsoft.com/v1.0/drives/D1/items/FOLDER1/children')
  })
})

describe('OfficeChannel.readDocument', () => {
  it('returns raw content from /content for default format', async () => {
    const fetchFn = mockFetch({ text: 'hello world', contentType: 'text/plain' })

    const channel = new OfficeChannel()
    const content = await channel.readDocument({ fileId: 'FID' })

    expect(content).toBe('hello world')
    const [url] = fetchFn.mock.calls[0] as [string]
    expect(url).toBe('https://graph.microsoft.com/v1.0/me/drive/items/FID/content')
  })

  it('lists worksheets when format=worksheets', async () => {
    const fetchFn = mockFetch({
      json: {
        value: [
          { id: 'S1', name: 'Sheet1' },
          { id: 'S2', name: 'Q2-numbers' },
        ],
      },
    })

    const channel = new OfficeChannel()
    const sheets = await channel.readDocument({ fileId: 'FID', format: 'worksheets' })

    expect(sheets).toEqual([
      { id: 'S1', name: 'Sheet1' },
      { id: 'S2', name: 'Q2-numbers' },
    ])
    const [url] = fetchFn.mock.calls[0] as [string]
    expect(url).toBe(
      'https://graph.microsoft.com/v1.0/me/drive/items/FID/workbook/worksheets',
    )
  })
})

describe('OfficeChannel.appendToWorkbook', () => {
  it('POSTs {values: rows} to the table rows/add endpoint', async () => {
    const fetchFn = mockFetch({ json: { index: 5 } })

    const channel = new OfficeChannel()
    await channel.appendToWorkbook({
      fileId: 'FID',
      sheet: 'Sheet1',
      rows: [
        ['A', 1, true],
        ['B', 2, false],
      ],
    })

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      'https://graph.microsoft.com/v1.0/me/drive/items/FID/workbook/worksheets/Sheet1/tables/Table1/rows/add',
    )
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({
      values: [
        ['A', 1, true],
        ['B', 2, false],
      ],
    })
  })

  it('honours a custom table name', async () => {
    const fetchFn = mockFetch({ json: {} })

    const channel = new OfficeChannel()
    await channel.appendToWorkbook({
      fileId: 'FID',
      sheet: 'Data',
      table: 'SalesTable',
      rows: [['x', 1]],
    })

    const [url] = fetchFn.mock.calls[0] as [string]
    expect(url).toContain('/tables/SalesTable/rows/add')
  })
})

describe('OfficeChannel.send (post comment)', () => {
  it('POSTs {message} to /me/drive/items/{id}/comments', async () => {
    const fetchFn = mockFetch({
      json: {
        id: 'CMT1',
        content: { content: 'looks good' },
        createdDateTime: '2026-04-25T10:00:00Z',
      },
    })

    const result = await officeAdapter.send({ channel: 'FID', text: 'looks good' })

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://graph.microsoft.com/v1.0/me/drive/items/FID/comments')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({ message: 'looks good' })
    expect(result.id).toBe('CMT1')
    expect(result.ts).toBe(Date.parse('2026-04-25T10:00:00Z'))
  })
})

describe('OfficeChannel.addSlide', () => {
  it('throws a helpful error pointing at the TODO', async () => {
    const channel = new OfficeChannel()
    await expect(channel.addSlide({ fileId: 'FID' })).rejects.toThrow(
      /pptx-genjs.*TODO.*office\.ts/,
    )
  })
})

describe('OfficeChannel auth errors', () => {
  it('throws on first call when MICROSOFT_GRAPH_TOKEN is missing', async () => {
    delete process.env.MICROSOFT_GRAPH_TOKEN
    mockFetch({ json: { value: [] } })

    const channel = new OfficeChannel()
    await expect(channel.listFiles({})).rejects.toThrow(/MICROSOFT_GRAPH_TOKEN/)
  })

  it('throws with status + body when Graph returns non-2xx', async () => {
    mockFetch({
      status: 404,
      json: { error: { code: 'itemNotFound', message: 'no such item' } },
      contentType: 'application/json',
    })

    const channel = new OfficeChannel()
    await expect(channel.listFiles({})).rejects.toThrow(/404/)
  })
})
