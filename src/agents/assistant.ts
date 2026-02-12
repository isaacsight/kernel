import type { Agent } from '../types'

// Isaac's personal assistant agent — sits between the visitor-facing
// evaluation engine and the internal swarm. Handles scheduling,
// project triage, client communication, and daily focus.

export const ASSISTANT_AGENT: Agent = {
  id: 'assistant',
  name: 'Isaac\'s Assistant',
  persona: 'Calm, organized, direct. Thinks in priorities. Speaks with the quiet confidence of someone who has the whole picture.',
  systemPrompt: `You are Isaac's personal assistant — a calm, organized intelligence that helps manage his time, projects, and client relationships.

You have access to:
- The Evaluation Engine (project scoring, lead qualification)
- The Pricing Engine (auto-quotes, deliverables)
- The Treasury (financial tracking, project lifecycle)
- The client inquiry pipeline

Your responsibilities:

1. TRIAGE — When a new inquiry or evaluation comes in, assess its priority:
   - Platinum/Gold tier → Flag immediately, draft a response
   - Silver → Queue for review, suggest next steps
   - Bronze → Auto-respond with helpful resources

2. SCHEDULING — Help Isaac manage his time:
   - Track active projects and their stages
   - Estimate time blocks needed for each
   - Flag conflicts or overcommitment
   - Suggest daily focus based on deadlines and value

3. CLIENT COMMUNICATION — Draft professional, warm responses:
   - Acknowledge inquiries quickly
   - Set clear expectations on timeline
   - Follow up on pending quotes

4. DAILY BRIEFING — Summarize the state of things:
   - New inquiries since last check
   - Projects in progress and their status
   - Revenue pipeline (pending, invoiced, paid)
   - What needs attention today

Voice guidelines:
- Speak in 2-3 concise sentences
- Be direct but warm — like a trusted chief of staff
- Prioritize action over analysis
- When uncertain, say what you'd recommend and why
- Use the evaluation score as a signal, not a verdict`,
  avatar: 'I',
  color: '#6B8C72',
}

// Priority classification for incoming work
export type Priority = 'urgent' | 'high' | 'normal' | 'low'

export interface ScheduleBlock {
  id: string
  title: string
  projectId?: string
  priority: Priority
  estimatedHours: number
  deadline?: Date
  status: 'planned' | 'in_progress' | 'done' | 'blocked'
  notes?: string
}

export interface DailyBrief {
  date: Date
  newInquiries: number
  activeProjects: number
  pendingRevenue: number
  focusItems: string[]
  schedule: ScheduleBlock[]
}

const STORAGE_KEY = 'assistant_state'

interface AssistantState {
  schedule: ScheduleBlock[]
  briefs: DailyBrief[]
  lastBriefDate: string | null
}

class AssistantManager {
  private state: AssistantState

  constructor() {
    this.state = this.loadState()
  }

  private loadState(): AssistantState {
    if (typeof window === 'undefined') return this.emptyState()
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return {
          schedule: (parsed.schedule || []).map((b: ScheduleBlock) => ({
            ...b,
            deadline: b.deadline ? new Date(b.deadline) : undefined,
          })),
          briefs: (parsed.briefs || []).map((b: DailyBrief) => ({
            ...b,
            date: new Date(b.date),
          })),
          lastBriefDate: parsed.lastBriefDate || null,
        }
      }
    } catch (e) {
      console.error('Failed to load assistant state:', e)
    }
    return this.emptyState()
  }

  private emptyState(): AssistantState {
    return { schedule: [], briefs: [], lastBriefDate: null }
  }

  private save(): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch (e) {
      console.error('Failed to save assistant state:', e)
    }
  }

  // --- Schedule Management ---

  addBlock(block: Omit<ScheduleBlock, 'id'>): ScheduleBlock {
    const entry: ScheduleBlock = {
      ...block,
      id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    }
    this.state.schedule.push(entry)
    this.save()
    return entry
  }

  updateBlock(id: string, updates: Partial<ScheduleBlock>): ScheduleBlock | null {
    const block = this.state.schedule.find(b => b.id === id)
    if (!block) return null
    Object.assign(block, updates)
    this.save()
    return block
  }

  removeBlock(id: string): void {
    this.state.schedule = this.state.schedule.filter(b => b.id !== id)
    this.save()
  }

  getSchedule(filter?: { status?: ScheduleBlock['status']; priority?: Priority }): ScheduleBlock[] {
    let blocks = [...this.state.schedule]
    if (filter?.status) blocks = blocks.filter(b => b.status === filter.status)
    if (filter?.priority) blocks = blocks.filter(b => b.priority === filter.priority)

    const priorityOrder: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 }
    blocks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    return blocks
  }

  getTotalPlannedHours(): number {
    return this.state.schedule
      .filter(b => b.status === 'planned' || b.status === 'in_progress')
      .reduce((sum, b) => sum + b.estimatedHours, 0)
  }

  // --- Daily Brief ---

  generateBrief(): DailyBrief {
    const inquiries = this.getInquiryCount()
    const active = this.state.schedule.filter(b => b.status === 'in_progress')
    const planned = this.state.schedule.filter(b => b.status === 'planned')
    const urgent = this.state.schedule.filter(b => b.priority === 'urgent' && b.status !== 'done')

    const focusItems: string[] = []

    if (urgent.length > 0) {
      focusItems.push(`${urgent.length} urgent item${urgent.length > 1 ? 's' : ''} need attention`)
    }
    if (inquiries > 0) {
      focusItems.push(`${inquiries} new project inquir${inquiries > 1 ? 'ies' : 'y'} to review`)
    }
    if (active.length > 0) {
      focusItems.push(`${active.length} project${active.length > 1 ? 's' : ''} in progress`)
    }
    if (planned.length > 0) {
      const hours = planned.reduce((s, b) => s + b.estimatedHours, 0)
      focusItems.push(`${hours}h of planned work queued`)
    }
    if (focusItems.length === 0) {
      focusItems.push('Clear schedule — good day for deep work or prospecting')
    }

    const brief: DailyBrief = {
      date: new Date(),
      newInquiries: inquiries,
      activeProjects: active.length,
      pendingRevenue: 0, // Would integrate with Treasury
      focusItems,
      schedule: [...urgent, ...active, ...planned].slice(0, 5),
    }

    this.state.briefs.push(brief)
    this.state.lastBriefDate = new Date().toISOString().split('T')[0]
    if (this.state.briefs.length > 30) {
      this.state.briefs = this.state.briefs.slice(-30)
    }
    this.save()
    return brief
  }

  private getInquiryCount(): number {
    try {
      const inquiries = JSON.parse(localStorage.getItem('project_inquiries') || '[]')
      const today = new Date().toISOString().split('T')[0]
      const lastBrief = this.state.lastBriefDate
      return inquiries.filter((i: { timestamp: string }) => {
        const date = i.timestamp.split('T')[0]
        return lastBrief ? date > lastBrief : date === today
      }).length
    } catch {
      return 0
    }
  }

  // --- Triage ---

  triageEvaluation(score: number, tier: string): {
    priority: Priority
    action: string
    responseTemplate: string
  } {
    if (tier === 'platinum' || tier === 'gold') {
      return {
        priority: 'high',
        action: 'Respond within 2 hours. This is a strong lead.',
        responseTemplate: `Thanks for your interest. Your project scored in the ${tier} tier — that tells me there's real substance here. I'd like to learn more about your timeline and goals. Would you be open to a quick conversation this week?`,
      }
    }
    if (tier === 'silver') {
      return {
        priority: 'normal',
        action: 'Queue for next review cycle. Follow up within 24 hours.',
        responseTemplate: `Thanks for reaching out. I've reviewed your project details and have some ideas on how to approach this. Let me put together a more detailed proposal — I'll have something for you within a day or two.`,
      }
    }
    return {
      priority: 'low',
      action: 'Auto-respond with resources. Review if bandwidth allows.',
      responseTemplate: `Thanks for the inquiry. Based on the scope, this might be a good fit for a template or existing solution. I've put together some resources that might help you get started.`,
    }
  }

  getState() {
    return { ...this.state }
  }
}

export const assistantManager = new AssistantManager()
