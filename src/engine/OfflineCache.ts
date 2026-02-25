import type { DBConversation, DBMessage } from './SupabaseClient'

const DB_NAME = 'kernel-offline'
const DB_VERSION = 1
const CONV_STORE = 'conversations'
const MSG_STORE = 'messages'
const MAX_CACHED = 5

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(CONV_STORE)) {
        db.createObjectStore(CONV_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(MSG_STORE)) {
        const store = db.createObjectStore(MSG_STORE, { keyPath: 'id' })
        store.createIndex('channel_id', 'channel_id', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function cacheConversations(convs: DBConversation[]): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(CONV_STORE, 'readwrite')
    const store = tx.objectStore(CONV_STORE)
    // Clear old data, keep only top N by updated_at
    const sorted = [...convs]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, MAX_CACHED)
    store.clear()
    for (const conv of sorted) {
      store.put(conv)
    }
    db.close()
  } catch { /* silent fail — offline cache is best-effort */ }
}

export async function cacheMessages(channelId: string, messages: DBMessage[]): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(MSG_STORE, 'readwrite')
    const store = tx.objectStore(MSG_STORE)
    const index = store.index('channel_id')
    // Delete existing messages for this channel
    const existing = index.getAllKeys(channelId)
    await new Promise<void>((resolve) => {
      existing.onsuccess = () => {
        for (const key of existing.result) store.delete(key)
        resolve()
      }
      existing.onerror = () => resolve()
    })
    // Insert new messages
    for (const msg of messages) {
      store.put(msg)
    }
    db.close()
  } catch { /* silent */ }
}

export async function getCachedConversations(): Promise<DBConversation[]> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(CONV_STORE, 'readonly')
      const req = tx.objectStore(CONV_STORE).getAll()
      req.onsuccess = () => {
        db.close()
        const convs = (req.result as DBConversation[])
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        resolve(convs)
      }
      req.onerror = () => { db.close(); resolve([]) }
    })
  } catch { return [] }
}

export async function getCachedMessages(channelId: string): Promise<DBMessage[]> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(MSG_STORE, 'readonly')
      const index = tx.objectStore(MSG_STORE).index('channel_id')
      const req = index.getAll(channelId)
      req.onsuccess = () => {
        db.close()
        const msgs = (req.result as DBMessage[])
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        resolve(msgs)
      }
      req.onerror = () => { db.close(); resolve([]) }
    })
  } catch { return [] }
}
