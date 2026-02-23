// ─── Entity Evolution Hook ──────────────────────────────────
//
// Pure computation: scores user data, classifies dominant topic,
// derives transient states (time-of-day, urgency, activity).
// Returns pre-computed CSS vars and data attributes for PixelEntity.

import { useMemo, useState, useEffect, useRef } from 'react'
import type { KGEntity } from '../engine/KnowledgeGraph'
import type { UserGoal } from '../engine/GoalTracker'
import type { UserMemoryProfile } from '../engine/MemoryAgent'
import { TIER_THRESHOLDS, type TierName, TIER_NAMES } from '../components/pixelGrids'
import { useCompanionMood, type MoodState, type CompanionMoodResult } from './useCompanionMood'

// ─── Types ──────────────────────────────────────────────────

export type TimePhase = 'dawn' | 'day' | 'dusk' | 'night'

export type TopicDomain = 'tech' | 'creative' | 'science' | 'business' | 'personal' | 'learning'

export interface EntityEvolutionState {
  score: number
  tier: number
  tierName: TierName
  topic: TopicDomain
  topicColor: string
  timePhase: TimePhase
  isEvolving: boolean          // true for 2s after tier increase
  hasUnreadBriefing: boolean
  hasUrgentGoals: boolean
  isRecentlyActive: boolean
  isPro: boolean
  moodState: MoodState
  companion: CompanionMoodResult
  cssVars: Record<string, string>
  dataAttrs: Record<string, string>
}

// ─── Topic Classification ───────────────────────────────────

const TOPIC_KEYWORDS: Record<TopicDomain, string[]> = {
  tech: ['react', 'python', 'code', 'api', 'docker', 'javascript', 'typescript', 'programming', 'software', 'database', 'server', 'deploy', 'git', 'css', 'html', 'node', 'rust', 'go', 'swift', 'kotlin', 'web', 'app', 'frontend', 'backend', 'devops', 'cloud', 'aws', 'linux', 'algorithm'],
  creative: ['writing', 'design', 'art', 'music', 'story', 'creative', 'novel', 'poem', 'illustration', 'animation', 'video', 'film', 'photography', 'sketch', 'canvas', 'composition', 'color', 'typography'],
  science: ['research', 'physics', 'data', 'biology', 'chemistry', 'math', 'statistics', 'experiment', 'hypothesis', 'analysis', 'neuroscience', 'astronomy', 'quantum', 'genetics', 'climate', 'ai', 'machine learning'],
  business: ['strategy', 'growth', 'market', 'startup', 'revenue', 'product', 'customer', 'sales', 'marketing', 'finance', 'investment', 'pitch', 'fundraising', 'pricing', 'metrics', 'kpi', 'management'],
  personal: ['health', 'family', 'travel', 'meditation', 'fitness', 'workout', 'sleep', 'journal', 'gratitude', 'relationship', 'hobby', 'cooking', 'garden', 'pet', 'mindfulness', 'therapy', 'wellness'],
  learning: ['book', 'course', 'study', 'language', 'tutorial', 'lesson', 'education', 'learn', 'practice', 'curriculum', 'degree', 'certificate', 'skill', 'training', 'lecture', 'university'],
}

const TOPIC_COLORS: Record<TopicDomain, string> = {
  tech: '#6B8E6B',       // sage green (coder)
  creative: '#B8875C',   // warm brown (writer)
  science: '#5B8BA0',    // slate blue (researcher)
  business: '#A0768C',   // mauve (analyst)
  personal: '#6B5B95',   // amethyst (kernel default)
  learning: '#D4A574',   // gold
}

// ─── Helpers ────────────────────────────────────────────────

function getTimePhase(): TimePhase {
  const h = new Date().getHours()
  if (h >= 5 && h < 9) return 'dawn'
  if (h >= 9 && h < 17) return 'day'
  if (h >= 17 && h < 21) return 'dusk'
  return 'night'
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 107, g: 91, b: 149 } // fallback amethyst
}

// ─── Score Computation ──────────────────────────────────────

export function computeEvolutionScore(
  conversationCount: number,
  kgEntityCount: number,
  kgRelationCount: number,
  completedGoals: number,
  completedMilestones: number,
): number {
  const convScore = clamp(Math.log2(conversationCount + 1) * 15, 0, 100)
  const kgScore = clamp(Math.log2(kgEntityCount + kgRelationCount + 1) * 12, 0, 100)
  const goalScore = clamp(completedGoals * 20 + completedMilestones * 5, 0, 100)
  return clamp(Math.round(convScore * 0.4 + kgScore * 0.35 + goalScore * 0.25), 0, 100)
}

export function scoreToTier(score: number): number {
  for (let i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    if (score >= TIER_THRESHOLDS[i]) return i
  }
  return 0
}

// ─── Topic Classification ───────────────────────────────────

export function classifyTopic(
  kgEntities: KGEntity[],
  userMemory: UserMemoryProfile | null,
): TopicDomain {
  const counts: Record<TopicDomain, number> = {
    tech: 0, creative: 0, science: 0, business: 0, personal: 0, learning: 0,
  }

  // Score KG entity names
  for (const entity of kgEntities) {
    const name = entity.name.toLowerCase()
    for (const [domain, keywords] of Object.entries(TOPIC_KEYWORDS) as [TopicDomain, string[]][]) {
      for (const kw of keywords) {
        if (name.includes(kw)) {
          counts[domain] += entity.mention_count || 1
        }
      }
    }
  }

  // Score user memory interests
  if (userMemory?.interests) {
    for (const interest of userMemory.interests) {
      const lower = interest.toLowerCase()
      for (const [domain, keywords] of Object.entries(TOPIC_KEYWORDS) as [TopicDomain, string[]][]) {
        for (const kw of keywords) {
          if (lower.includes(kw)) {
            counts[domain] += 2 // interests are high-signal
          }
        }
      }
    }
  }

  // Find dominant
  let maxDomain: TopicDomain = 'personal'
  let maxCount = 0
  for (const [domain, count] of Object.entries(counts) as [TopicDomain, number][]) {
    if (count > maxCount) {
      maxCount = count
      maxDomain = domain
    }
  }

  return maxDomain
}

// ─── Hook ───────────────────────────────────────────────────

interface UseEntityEvolutionParams {
  conversationCount: number
  kgEntities: KGEntity[]
  kgRelations: { id?: string }[]
  userGoals: UserGoal[]
  userMemory: UserMemoryProfile | null
  todayBriefing: { id: string; title: string; content: string } | null
  lastConversationUpdatedAt: string | null
  isPro: boolean
}

export function useEntityEvolution(params: UseEntityEvolutionParams): EntityEvolutionState {
  const {
    conversationCount, kgEntities, kgRelations,
    userGoals, userMemory, todayBriefing,
    lastConversationUpdatedAt, isPro,
  } = params

  // Time phase — updates every 60s
  const [timePhase, setTimePhase] = useState<TimePhase>(getTimePhase)
  useEffect(() => {
    const interval = setInterval(() => setTimePhase(getTimePhase()), 60_000)
    return () => clearInterval(interval)
  }, [])

  // Score & tier
  const { score, tier } = useMemo(() => {
    const completedGoals = userGoals.filter(g => g.status === 'completed').length
    const completedMilestones = userGoals.reduce(
      (acc, g) => acc + g.milestones.filter(m => m.completed).length, 0,
    )
    const s = computeEvolutionScore(
      conversationCount,
      kgEntities.length,
      kgRelations.length,
      completedGoals,
      completedMilestones,
    )
    return { score: s, tier: scoreToTier(s) }
  }, [conversationCount, kgEntities.length, kgRelations.length, userGoals])

  // Topic classification
  const topic = useMemo(
    () => classifyTopic(kgEntities, userMemory),
    [kgEntities, userMemory],
  )
  const topicColor = TOPIC_COLORS[topic]

  // Tier transition detection
  const prevTierRef = useRef(tier)
  const [isEvolving, setIsEvolving] = useState(false)
  useEffect(() => {
    if (tier > prevTierRef.current) {
      setIsEvolving(true)
      const timer = setTimeout(() => setIsEvolving(false), 2000)
      prevTierRef.current = tier
      return () => clearTimeout(timer)
    }
    prevTierRef.current = tier
  }, [tier])

  // Transient states
  const hasUnreadBriefing = todayBriefing !== null
  const hasUrgentGoals = useMemo(() => {
    const now = Date.now()
    const threeDays = 3 * 24 * 60 * 60 * 1000
    return userGoals.some(g =>
      g.status === 'active' && g.target_date && (new Date(g.target_date).getTime() - now) <= threeDays
    )
  }, [userGoals])

  const isRecentlyActive = useMemo(() => {
    if (!lastConversationUpdatedAt) return false
    return (Date.now() - new Date(lastConversationUpdatedAt).getTime()) < 3_600_000
  }, [lastConversationUpdatedAt])

  // Companion mood system
  const companion = useCompanionMood(timePhase, isRecentlyActive)
  const { mood: moodState } = companion

  // Pre-compute CSS vars
  const rgb = hexToRgb(topicColor)
  const cssVars: Record<string, string> = {
    '--entity-topic-color': topicColor,
    '--entity-topic-r': String(rgb.r),
    '--entity-topic-g': String(rgb.g),
    '--entity-topic-b': String(rgb.b),
  }

  const dataAttrs: Record<string, string> = {
    'data-tier': String(tier),
    'data-time': timePhase,
    ...(hasUrgentGoals ? { 'data-urgent': 'true' } : {}),
    ...(isRecentlyActive ? { 'data-active': 'true' } : {}),
    ...(hasUnreadBriefing ? { 'data-briefing': 'true' } : {}),
    ...(isPro ? { 'data-pro': 'true' } : {}),
    ...(isEvolving ? { 'data-evolving': 'true' } : {}),
    'data-mood': moodState,
    'data-topic': topic,
  }

  return {
    score, tier,
    tierName: TIER_NAMES[tier],
    topic, topicColor, timePhase,
    isEvolving, hasUnreadBriefing, hasUrgentGoals, isRecentlyActive, isPro,
    moodState, companion,
    cssVars, dataAttrs,
  }
}
