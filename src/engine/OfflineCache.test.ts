import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import {
  cacheConversations,
  getCachedConversations,
  cacheMessages,
  getCachedMessages,
} from './OfflineCache'

const mockConv = (id: string, daysAgo: number) => ({
  id,
  user_id: 'user-1',
  title: `Conv ${id}`,
  created_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
  updated_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
})

const mockMsg = (id: string, channelId: string) => ({
  id,
  channel_id: channelId,
  agent_id: 'kernel',
  content: `Message ${id}`,
  created_at: new Date().toISOString(),
})

describe('OfflineCache', () => {
  beforeEach(async () => {
    // Clear IndexedDB between tests
    const dbs = await indexedDB.databases()
    for (const db of dbs) {
      if (db.name) indexedDB.deleteDatabase(db.name)
    }
  })

  it('caches and retrieves conversations', async () => {
    const convs = [mockConv('a', 0), mockConv('b', 1), mockConv('c', 2)]
    await cacheConversations(convs)
    const cached = await getCachedConversations()
    expect(cached).toHaveLength(3)
    expect(cached[0].id).toBe('a') // most recent first
  })

  it('limits to 5 most recent conversations', async () => {
    const convs = Array.from({ length: 8 }, (_, i) => mockConv(`conv-${i}`, i))
    await cacheConversations(convs)
    const cached = await getCachedConversations()
    expect(cached).toHaveLength(5)
    expect(cached[0].id).toBe('conv-0') // most recent
    expect(cached[4].id).toBe('conv-4')
  })

  it('caches and retrieves messages by channel', async () => {
    const msgs = [mockMsg('m1', 'ch-1'), mockMsg('m2', 'ch-1'), mockMsg('m3', 'ch-2')]
    await cacheMessages('ch-1', [msgs[0], msgs[1]])
    await cacheMessages('ch-2', [msgs[2]])
    const ch1 = await getCachedMessages('ch-1')
    const ch2 = await getCachedMessages('ch-2')
    expect(ch1).toHaveLength(2)
    expect(ch2).toHaveLength(1)
  })

  it('returns empty arrays for uncached data', async () => {
    const convs = await getCachedConversations()
    const msgs = await getCachedMessages('nonexistent')
    expect(convs).toEqual([])
    expect(msgs).toEqual([])
  })

  it('replaces messages when caching same channel', async () => {
    await cacheMessages('ch-1', [mockMsg('m1', 'ch-1'), mockMsg('m2', 'ch-1')])
    await cacheMessages('ch-1', [mockMsg('m3', 'ch-1')])
    const msgs = await getCachedMessages('ch-1')
    expect(msgs).toHaveLength(1)
    expect(msgs[0].id).toBe('m3')
  })
})
