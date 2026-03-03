// Knowledge Engine — React hook for UI interactions
import { useCallback } from 'react'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import {
  getTopics,
  getStats,
  deleteItem as deleteKnowledgeItem,
  updateItem as updateKnowledgeItem,
  resolveContradiction as resolveKnowledgeContradiction,
  retrieveForContext,
  queryKnowledge,
} from '../engine/KnowledgeEngine'
import type { KnowledgeItem, RetrievalResult } from '../engine/knowledge/types'

export function useKnowledgeEngine(userId: string | undefined) {
  const store = useKnowledgeStore()

  const refreshTopics = useCallback(async () => {
    if (!userId) return
    const topics = await getTopics(userId)
    store.setTopics(topics)
  }, [userId, store])

  const refreshStats = useCallback(async () => {
    if (!userId) return
    const stats = await getStats(userId)
    store.setStats(stats)
    store.markSynced()
  }, [userId, store])

  const searchKnowledge = useCallback(async (query: string, topN = 5): Promise<RetrievalResult[]> => {
    if (!userId) return []
    return retrieveForContext(userId, query, topN)
  }, [userId])

  const askKnowledge = useCallback(async (query: string): Promise<string> => {
    if (!userId) return ''
    return queryKnowledge(userId, query)
  }, [userId])

  const deleteItem = useCallback(async (itemId: string): Promise<boolean> => {
    const success = await deleteKnowledgeItem(itemId)
    if (success) refreshStats()
    return success
  }, [refreshStats])

  const updateItem = useCallback(async (
    itemId: string,
    updates: Partial<Pick<KnowledgeItem, 'content' | 'summary' | 'topic' | 'domain' | 'confidence'>>,
  ): Promise<boolean> => {
    return updateKnowledgeItem(itemId, updates)
  }, [])

  const resolveContradiction = useCallback(async (
    contradictionId: string,
    resolution: 'user_confirmed_existing' | 'user_confirmed_new',
  ): Promise<boolean> => {
    const success = await resolveKnowledgeContradiction(contradictionId, resolution)
    if (success) refreshStats()
    return success
  }, [refreshStats])

  return {
    topics: store.topics,
    stats: store.stats,
    lastSync: store.lastSync,
    refreshTopics,
    refreshStats,
    searchKnowledge,
    askKnowledge,
    deleteItem,
    updateItem,
    resolveContradiction,
  }
}
