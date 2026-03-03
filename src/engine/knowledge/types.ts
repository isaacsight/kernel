// Knowledge Engine — Type definitions

export type KnowledgeDomain = 'tech' | 'personal' | 'work' | 'creative' | 'finance' | 'health' | 'general'
export type KnowledgeItemType = 'fact' | 'concept' | 'opinion' | 'procedure' | 'event' | 'preference' | 'reference'
export type KnowledgeSourceType = 'conversation' | 'upload' | 'web_search' | 'import' | 'url' | 'manual'
export type ContradictionResolution = 'pending' | 'auto_updated' | 'user_confirmed_existing' | 'user_confirmed_new'

export interface KnowledgeItem {
  id: string
  user_id: string
  content: string
  summary: string | null
  topic: string | null
  subtopic: string | null
  domain: KnowledgeDomain
  item_type: KnowledgeItemType
  source_type: KnowledgeSourceType
  source_id: string | null
  source_title: string | null
  confidence: number
  version: number
  superseded_by: string | null
  knowledge_date: string | null
  created_at: string
  updated_at: string
  expires_at: string | null
  keywords: string[]
  entity_ids: string[]
  mention_count: number
  last_accessed: string
}

export interface KnowledgeTopic {
  id: string
  user_id: string
  name: string
  domain: KnowledgeDomain
  parent_id: string | null
  item_count: number
  last_updated: string
}

export interface KnowledgeContradiction {
  id: string
  user_id: string
  existing_item_id: string
  new_content: string
  new_source_type: KnowledgeSourceType
  resolution: ContradictionResolution
  resolved_at: string | null
  created_at: string
}

export interface RetrievalResult {
  id: string
  content: string
  summary: string | null
  topic: string | null
  subtopic: string | null
  domain: KnowledgeDomain
  item_type: KnowledgeItemType
  source_type: KnowledgeSourceType
  source_title: string | null
  confidence: number
  keywords: string[]
  mention_count: number
  created_at: string
  similarity: number
}

export interface TopicNode {
  id: string
  name: string
  domain: KnowledgeDomain
  item_count: number
  children: TopicNode[]
}

export interface KnowledgeSource {
  type: KnowledgeSourceType
  id?: string
  title?: string
}

export interface ExtractedItem {
  content: string
  summary: string
  topic: string
  subtopic?: string
  domain: KnowledgeDomain
  item_type: KnowledgeItemType
  confidence: number
  keywords: string[]
  knowledge_date?: string
  expires_at?: string
}

export interface KnowledgeStats {
  totalItems: number
  topicCount: number
  domainBreakdown: Record<KnowledgeDomain, number>
  pendingContradictions: number
  lastSync: string | null
}
