// ─── GoalTracker ─────────────────────────────────────────
//
// Manages goal check-ins and progress extraction.
// Integrates with the chat flow to proactively check on goals
// and auto-detect when a message implies goal progress.

import { getProvider } from './providers/registry'

export interface GoalMilestone {
  id: string
  title: string
  completed: boolean
  completed_at?: string
}

export interface GoalProgressNote {
  content: string
  timestamp: string
  source: 'user' | 'auto'
}

export interface UserGoal {
  id?: string
  user_id: string
  title: string
  description: string
  category: string
  status: 'active' | 'completed' | 'paused' | 'abandoned'
  priority: 'low' | 'medium' | 'high'
  target_date: string | null
  milestones: GoalMilestone[]
  progress_notes: GoalProgressNote[]
  check_in_frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly'
  last_check_in_at: string | null
  created_at?: string
  updated_at?: string
}

// ─── Check-in Logic ──────────────────────────────────────

const FREQUENCY_MS: Record<string, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  biweekly: 14 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
}

export function shouldCheckIn(goal: UserGoal): boolean {
  if (goal.status !== 'active') return false
  if (!goal.last_check_in_at) return true
  const elapsed = Date.now() - new Date(goal.last_check_in_at).getTime()
  return elapsed >= (FREQUENCY_MS[goal.check_in_frequency] || FREQUENCY_MS.weekly)
}

export function getGoalsDueForCheckIn(goals: UserGoal[]): UserGoal[] {
  return goals.filter(shouldCheckIn)
}

/** Build a system prompt addendum for goals that are due for check-in */
export function getGoalCheckInPrompt(goals: UserGoal[]): string {
  const due = getGoalsDueForCheckIn(goals)
  if (due.length === 0) return ''

  const goalLines = due.map(g => {
    const milestoneProgress = g.milestones.length > 0
      ? ` (${g.milestones.filter(m => m.completed).length}/${g.milestones.length} milestones)`
      : ''
    const deadline = g.target_date ? ` — target: ${new Date(g.target_date).toLocaleDateString()}` : ''
    return `- "${g.title}"${milestoneProgress}${deadline}`
  }).join('\n')

  return `\n\n## Active Goals (due for check-in)
The user has these active goals. If the conversation naturally touches on any of them, ask how they're progressing. Don't force it — only bring them up if relevant.

${goalLines}`
}

// ─── Progress Extraction ─────────────────────────────────

interface ProgressExtraction {
  goalTitle: string
  note: string
  milestoneCompleted?: string
}

const EXTRACT_SYSTEM = `You are a goal progress detector. Given a user message and their active goals, determine if the message implies progress on any goal.

If yes, extract:
- goalTitle: the exact title of the goal from the list
- note: a brief summary of the progress made
- milestoneCompleted: (optional) title of any milestone that was completed

If no progress is implied, respond with: {"goalTitle": ""}

Respond with ONLY valid JSON.`

export async function extractGoalProgress(
  message: string,
  goals: UserGoal[],
): Promise<ProgressExtraction | null> {
  if (goals.length === 0) return null

  try {
    const goalList = goals.map(g => {
      const ms = g.milestones.filter(m => !m.completed).map(m => m.title).join(', ')
      return `- "${g.title}": ${g.description}${ms ? ` [remaining milestones: ${ms}]` : ''}`
    }).join('\n')

    const result = await getProvider().json<ProgressExtraction>(
      `User message: "${message}"\n\nActive goals:\n${goalList}`,
      { system: EXTRACT_SYSTEM, tier: 'fast', max_tokens: 200 }
    )

    if (!result.goalTitle) return null
    return result
  } catch {
    return null
  }
}
