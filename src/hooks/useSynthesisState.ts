import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../engine/SupabaseClient'

export interface SkillMapEntry {
  agent: string
  overall: { mu: number; sigma: number; confidence: string }
  categories: Record<string, { mu: number; sigma: number }>
  status: 'proven' | 'developing' | 'untested'
}

export interface ActiveCorrection {
  rule: string
  source: 'explicit' | 'reflection' | 'pattern_failure'
  severity: 'high' | 'medium' | 'low'
  occurrences: number
}

export interface ToolAdoption {
  name: string
  url: string
  stars: number
  reason: string
  status: 'evaluated' | 'adopted' | 'rejected'
}

export interface PaperInsight {
  title: string
  technique: string
  applicableTo: string
  status: 'proposed' | 'implemented' | 'rejected'
}

export interface SynthesisData {
  totalCycles: number
  lastCycleAt: string
  stats: Record<string, number>
  skillMap: SkillMapEntry[]
  activeCorrections: ActiveCorrection[]
  toolAdoptions: ToolAdoption[]
  paperInsights: PaperInsight[]
  discoveryState: {
    stats?: Record<string, number>
    knownStars?: number
    knownDownloads?: number
    hnScore?: number
  }
  pulseData: Record<string, unknown>
  learningSummary: {
    patterns_count?: number
    solutions_count?: number
    reflections_count?: number
    routing_entries?: number
    total_messages?: number
    sessions?: number
    observer_total?: number
    task_patterns?: Record<string, number>
    preferred_agents?: Record<string, number>
  }
  crossPollinatedCount: number
  updatedAt: string
}

export function useSynthesisState(pollMs = 30_000) {
  const [data, setData] = useState<SynthesisData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const { data: row } = await supabase
        .from('kbot_synthesis_state')
        .select('*')
        .eq('instance_id', 'primary')
        .single()

      if (!row) return

      setData({
        totalCycles: row.total_cycles ?? 0,
        lastCycleAt: row.last_cycle_at ?? '',
        stats: row.stats ?? {},
        skillMap: row.skill_map ?? [],
        activeCorrections: row.active_corrections ?? [],
        toolAdoptions: row.tool_adoptions ?? [],
        paperInsights: row.paper_insights ?? [],
        discoveryState: row.discovery_state ?? {},
        pulseData: row.pulse_data ?? {},
        learningSummary: row.learning_summary ?? {},
        crossPollinatedCount: row.cross_pollinated_count ?? 0,
        updatedAt: row.updated_at ?? '',
      })
      setLoading(false)
    } catch { /* silent — dashboard is non-critical */ }
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, pollMs)
    return () => clearInterval(id)
  }, [fetchData, pollMs])

  return { data, loading }
}
