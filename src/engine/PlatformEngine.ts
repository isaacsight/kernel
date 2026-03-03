// ─── Platform Engine — Unified Content Orchestrator ───────────────
//
// Chains Knowledge → Content → Algorithm → Social engines into a
// seamless end-to-end workflow. Supports pause/resume at approval
// gates and nested ContentEngine stage approvals.
//
// Flow: Brief → Create → Score → Adapt → Distribute → Monitor

import { getProvider } from './providers/registry'
import { ContentEngine } from './ContentEngine'
import { AlgorithmEngine } from './AlgorithmEngine'
import * as KnowledgeEngine from './KnowledgeEngine'
import { getAccessToken } from './SupabaseClient'
import { getSpecialist } from '../agents/specialists'
import type {
  PlatformPhase,
  PlatformPhaseState,
  PlatformPhaseStatus,
  PlatformWorkflowConfig,
  PlatformEngineCallbacks,
  PlatformEngineState,
  PlatformWorkflow,
  BriefPhaseOutput,
  CreatePhaseOutput,
  ScorePhaseOutput,
  AdaptPhaseOutput,
  DistributePhaseOutput,
  MonitorPhaseOutput,
  PlatformAdaptation,
  DistributeResult,
  MonitorSnapshot,
  PHASE_CONFIGS,
  PhaseConfig,
} from './platform/types'
import { PHASE_CONFIGS as CONFIGS } from './platform/types'
import type { ContentStage, ContentStageState, ContentItem, AlgorithmScore, PublishTarget } from './content/types'

// ─── Platform Engine Class ────────────────────────────────────

export class PlatformEngine {
  private state: PlatformEngineState = 'idle'
  private cancelled = false
  private phases: PlatformPhaseState[] = []
  private workflowId: string
  private phaseConfigs: PhaseConfig[]
  private contentEngine: ContentEngine | null = null
  private contentItem: ContentItem | null = null

  constructor(
    private config: PlatformWorkflowConfig,
    private userId: string,
    private callbacks: PlatformEngineCallbacks,
  ) {
    this.workflowId = crypto.randomUUID()
    this.phaseConfigs = CONFIGS[config.type]
    this.phases = this.phaseConfigs.map(c => ({
      phase: c.phase,
      status: 'pending' as PlatformPhaseStatus,
    }))
  }

  get id(): string { return this.workflowId }
  getPhases(): PlatformPhaseState[] { return [...this.phases] }
  getState(): PlatformEngineState { return this.state }
  getContentEngine(): ContentEngine | null { return this.contentEngine }

  cancel(): void {
    this.cancelled = true
    this.state = 'cancelled'
    this.contentEngine?.cancel()
    this.emitProgress(this.currentPhase() || 'brief', 'failed', 'Workflow cancelled')
  }

  // ─── Public API ──────────────────────────────────────────────

  async start(): Promise<PlatformWorkflow> {
    this.state = 'running'
    return this.runFrom(0)
  }

  async resumeFrom(phase: PlatformPhase, feedback?: string): Promise<PlatformWorkflow> {
    const phaseState = this.phases.find(p => p.phase === phase)
    if (phaseState?.status === 'awaiting_approval') {
      phaseState.status = 'approved'
      phaseState.completedAt = Date.now()
    }
    this.updatePhases()

    // If brief feedback was provided, update the enriched brief
    if (phase === 'brief' && feedback && phaseState?.output) {
      const briefOutput = phaseState.output as BriefPhaseOutput
      briefOutput.selectedAngle = feedback
      briefOutput.enrichedBrief = `${this.config.brief}\n\nSelected angle: ${feedback}`
    }

    // Find next phase index
    const currentIdx = this.phaseConfigs.findIndex(c => c.phase === phase)
    const nextIdx = currentIdx + 1

    if (nextIdx >= this.phaseConfigs.length) {
      return this.buildWorkflow()
    }

    this.state = 'running'
    return this.runFrom(nextIdx)
  }

  // Approve nested content stage
  async approveContentStage(): Promise<void> {
    if (!this.contentEngine) return
    const stages = this.contentEngine.getStages()
    const awaiting = stages.find(s => s.status === 'awaiting_approval')
    if (awaiting) {
      await this.contentEngine.resumeFrom(awaiting.stage)
      this.checkContentEngineComplete()
    }
  }

  // Edit nested content stage
  async editContentStage(feedback: string): Promise<void> {
    if (!this.contentEngine) return
    const stages = this.contentEngine.getStages()
    const awaiting = stages.find(s => s.status === 'awaiting_approval')
    if (awaiting) {
      await this.contentEngine.resumeFrom(awaiting.stage, feedback)
      this.checkContentEngineComplete()
    }
  }

  // Update an adaptation before distribution
  updateAdaptation(platform: string, body: string): void {
    const adaptPhase = this.phases.find(p => p.phase === 'adapt')
    if (!adaptPhase?.output) return
    const adaptOutput = adaptPhase.output as AdaptPhaseOutput
    const adaptation = adaptOutput.adaptations.find(a => a.platform === platform)
    if (adaptation) {
      adaptation.adapted.body = body
    }
  }

  // ─── Phase Runners ──────────────────────────────────────────

  private async runFrom(startIdx: number): Promise<PlatformWorkflow> {
    for (let i = startIdx; i < this.phaseConfigs.length; i++) {
      if (this.cancelled) break

      const { phase, autoApprove, required } = this.phaseConfigs[i]
      const isAutoApproved = autoApprove || this.config.autoApprovePhases.includes(phase)
      const phaseState = this.phases.find(p => p.phase === phase)!

      phaseState.status = 'active'
      phaseState.startedAt = Date.now()
      this.updatePhases()
      this.emitProgress(phase, 'active', `Running ${phase}...`)

      try {
        const output = await this.runPhase(phase)
        phaseState.output = output

        if (!isAutoApproved) {
          phaseState.status = 'awaiting_approval'
          this.state = 'awaiting_phase_approval'
          this.updatePhases()
          this.emitProgress(phase, 'awaiting_approval', `${phase} complete — review needed`)
          this.callbacks.onApprovalNeeded?.(phase, output)
          return this.buildWorkflow()
        }

        phaseState.status = 'approved'
        phaseState.completedAt = Date.now()
        this.updatePhases()
        this.emitProgress(phase, 'approved', `${phase} auto-approved`)

      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error'
        phaseState.status = 'failed'
        phaseState.error = error
        if (required) {
          this.state = 'failed'
          this.updatePhases()
          this.emitProgress(phase, 'failed', error)
          return this.buildWorkflow()
        }
        // Non-required phase: skip and continue
        phaseState.status = 'skipped'
        this.updatePhases()
      }
    }

    if (!this.cancelled) {
      this.state = 'completed'
    }
    return this.buildWorkflow()
  }

  private async runPhase(phase: PlatformPhase): Promise<BriefPhaseOutput | CreatePhaseOutput | ScorePhaseOutput | AdaptPhaseOutput | DistributePhaseOutput | MonitorPhaseOutput> {
    switch (phase) {
      case 'brief': return this.runBrief()
      case 'create': return this.runCreate()
      case 'score': return this.runScore()
      case 'adapt': return this.runAdapt()
      case 'distribute': return this.runDistribute()
      case 'monitor': return this.runMonitor()
    }
  }

  // ─── Brief Phase ────────────────────────────────────────────
  // Knowledge retrieval → stream angle suggestions via writer agent

  private async runBrief(): Promise<BriefPhaseOutput> {
    // Retrieve knowledge context
    let knowledgeContext: string[] = []
    try {
      const items = await KnowledgeEngine.retrieveForContext(this.userId, this.config.brief, 5)
      knowledgeContext = items.map(i => i.content)
    } catch {
      // Knowledge retrieval is optional
    }

    const knowledgeBlock = knowledgeContext.length > 0
      ? `\n\nRelevant knowledge from the user's knowledge base:\n${knowledgeContext.map((c, i) => `${i + 1}. ${c.slice(0, 300)}`).join('\n')}`
      : ''

    const specialist = getSpecialist('writer')
    const prompt = `You are generating content angle suggestions for a ${this.config.format.replace(/_/g, ' ')}.

Brief: ${this.config.brief}
${knowledgeBlock}

Generate 3-5 creative angles. For each angle:
1. A compelling title/hook
2. The core thesis (1-2 sentences)
3. Why this angle would resonate
4. Key differentiator

Format as numbered list. Be bold and specific.`

    let text = ''
    await getProvider().stream(
      prompt,
      (fullText: string) => {
        text = fullText
        this.callbacks.onChunk?.(fullText)
      },
      {
        system: specialist.systemPrompt,
        tier: 'fast',
        max_tokens: 1500,
      },
    )

    // Parse angles from output
    const angles = text.split(/\d+\.\s+/).filter(a => a.trim().length > 10)

    return {
      type: 'brief',
      angles: angles.length > 0 ? angles : [text],
      selectedAngle: angles[0] || text,
      enrichedBrief: `${this.config.brief}\n\nSelected angle: ${angles[0] || text}`,
      knowledgeContext,
    }
  }

  // ─── Create Phase ──────────────────────────────────────────
  // Delegates to ContentEngine's 6-stage pipeline

  private async runCreate(): Promise<CreatePhaseOutput> {
    const briefPhase = this.phases.find(p => p.phase === 'brief')
    const enrichedBrief = briefPhase?.output
      ? (briefPhase.output as BriefPhaseOutput).enrichedBrief
      : this.config.brief

    this.contentEngine = new ContentEngine(enrichedBrief, this.config.format, {
      onProgress: () => {},
      onChunk: (chunk: string) => {
        this.callbacks.onChunk?.(chunk)
      },
      onStageUpdate: (stages: ContentStageState[]) => {
        this.callbacks.onContentStageUpdate?.(stages)
      },
      onApprovalNeeded: (stage: string, output: string) => {
        this.state = 'awaiting_content_approval'
        this.callbacks.onContentApprovalNeeded?.(stage, output)
      },
    })

    const result = await this.contentEngine.start()
    this.contentItem = result

    return {
      type: 'create',
      contentId: this.contentEngine.id,
      title: result.title || enrichedBrief.slice(0, 60),
      finalContent: result.finalContent || '',
      stages: result.stages,
    }
  }

  // ─── Score Phase ──────────────────────────────────────────
  // Algorithm scoring + distribution recommendations

  private async runScore(): Promise<ScorePhaseOutput> {
    const createPhase = this.phases.find(p => p.phase === 'create')
    const createOutput = createPhase?.output as CreatePhaseOutput | undefined

    if (!createOutput && !this.config.existingContentId) {
      throw new Error('No content to score')
    }

    const contentText = createOutput?.finalContent || ''
    const contentItem: ContentItem = this.contentItem || {
      id: createOutput?.contentId || this.config.existingContentId || crypto.randomUUID(),
      userId: this.userId,
      brief: this.config.brief,
      format: this.config.format,
      tags: [],
      currentStage: 'publish',
      stages: [],
      finalContent: contentText,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    const algorithm = new AlgorithmEngine({
      userId: this.userId,
      weights: undefined as never, // Uses defaults
      updatedAt: Date.now(),
      learningRate: 0.1,
    })

    const signals = await algorithm.collectSignals(contentItem, this.config.brief)
    const score = await algorithm.score(contentItem, signals, this.config.brief)

    let recommendations: PublishTarget[] = []
    try {
      recommendations = await algorithm.recommendDistribution(contentItem, score)
    } catch {
      // Recommendations are optional
    }

    return {
      type: 'score',
      score,
      recommendations,
    }
  }

  // ─── Adapt Phase ──────────────────────────────────────────
  // Parallel social content adaptation per platform

  private async runAdapt(): Promise<AdaptPhaseOutput> {
    const createPhase = this.phases.find(p => p.phase === 'create')
    const createOutput = createPhase?.output as CreatePhaseOutput | undefined
    const contentText = createOutput?.finalContent || this.contentItem?.finalContent || ''

    if (!contentText) {
      throw new Error('No content to adapt')
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
    const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || ''
    const token = await getAccessToken()
    if (!token) throw new Error('Not authenticated')

    const adaptations: PlatformAdaptation[] = []

    // Adapt content for each target platform in parallel
    const adaptPromises = this.config.targetPlatforms.map(async (platform) => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/social-publish`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': supabaseKey,
          },
          body: JSON.stringify({
            action: 'adapt_content',
            data: { content: contentText.slice(0, 5000), platform },
          }),
        })

        if (!res.ok) {
          console.warn(`[platform-engine] Adapt failed for ${platform}:`, res.status)
          return null
        }

        const { adapted } = await res.json()
        return {
          platform,
          accountId: '',
          adapted: adapted || { body: contentText.slice(0, 280), hashtags: [] },
          approved: false,
        } as PlatformAdaptation
      } catch (err) {
        console.warn(`[platform-engine] Adapt error for ${platform}:`, err)
        return null
      }
    })

    const results = await Promise.all(adaptPromises)
    for (const r of results) {
      if (r) adaptations.push(r)
    }

    return { type: 'adapt', adaptations }
  }

  // ─── Distribute Phase ──────────────────────────────────────
  // Publish to blog + social platforms

  private async runDistribute(): Promise<DistributePhaseOutput> {
    const createPhase = this.phases.find(p => p.phase === 'create')
    const adaptPhase = this.phases.find(p => p.phase === 'adapt')
    const createOutput = createPhase?.output as CreatePhaseOutput | undefined
    const adaptOutput = adaptPhase?.output as AdaptPhaseOutput | undefined

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
    const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || ''
    const token = await getAccessToken()
    if (!token) throw new Error('Not authenticated')

    const results: DistributeResult[] = []

    // 1. Publish to kernel.chat blog
    if (createOutput?.contentId) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/content-engine`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': supabaseKey,
          },
          body: JSON.stringify({
            action: 'publish_item',
            data: { id: createOutput.contentId },
          }),
        })

        if (res.ok) {
          const { slug } = await res.json()
          results.push({ platform: 'blog', status: 'published', platformUrl: `https://kernel.chat/p/${slug}` })
        } else {
          results.push({ platform: 'blog', status: 'failed', error: 'Publish failed' })
        }
      } catch (err) {
        results.push({ platform: 'blog', status: 'failed', error: String(err) })
      }
    }

    // 2. Publish to social platforms
    if (adaptOutput?.adaptations) {
      const publishPromises = adaptOutput.adaptations
        .filter(a => a.approved)
        .map(async (adaptation) => {
          try {
            const res = await fetch(`${supabaseUrl}/functions/v1/social-publish`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': supabaseKey,
              },
              body: JSON.stringify({
                action: 'publish',
                data: {
                  account_id: adaptation.accountId,
                  body: adaptation.adapted.body,
                  hashtags: adaptation.adapted.hashtags,
                  thread_parts: adaptation.adapted.threadParts,
                  content_id: createOutput?.contentId,
                },
              }),
            })

            if (res.ok) {
              const { post_id, platform_url } = await res.json()
              return { platform: adaptation.platform, postId: post_id, platformUrl: platform_url, status: 'published' as const }
            }
            return { platform: adaptation.platform, status: 'failed' as const, error: 'Publish failed' }
          } catch (err) {
            return { platform: adaptation.platform, status: 'failed' as const, error: String(err) }
          }
        })

      const socialResults = await Promise.all(publishPromises)
      results.push(...socialResults)
    }

    return {
      type: 'distribute',
      published: results,
      blogSlug: results.find(r => r.platform === 'blog' && r.status === 'published')?.platformUrl?.split('/').pop(),
    }
  }

  // ─── Monitor Phase ──────────────────────────────────────────
  // Collect initial analytics + feed back to algorithm

  private async runMonitor(): Promise<MonitorPhaseOutput> {
    const distributePhase = this.phases.find(p => p.phase === 'distribute')
    const distributeOutput = distributePhase?.output as DistributePhaseOutput | undefined

    if (!distributeOutput?.published?.length) {
      return { type: 'monitor', snapshots: [] }
    }

    // For now, return empty snapshots — analytics require time to accumulate.
    // A background task can poll these later.
    const snapshots: MonitorSnapshot[] = distributeOutput.published
      .filter(r => r.status === 'published')
      .map(r => ({
        platform: r.platform,
        impressions: 0,
        likes: 0,
        reposts: 0,
        replies: 0,
        engagementRate: 0,
      }))

    return { type: 'monitor', snapshots }
  }

  // ─── Helpers ──────────────────────────────────────────────

  private currentPhase(): PlatformPhase | undefined {
    return this.phases.find(p => p.status === 'active')?.phase
  }

  private checkContentEngineComplete(): void {
    if (!this.contentEngine) return
    const engineState = this.contentEngine.getState()
    if (engineState === 'completed' || engineState === 'failed') {
      this.state = 'running'
    }
  }

  private emitProgress(phase: PlatformPhase, status: PlatformPhaseStatus, details?: string): void {
    this.callbacks.onProgress(phase, status, details)
  }

  private updatePhases(): void {
    this.callbacks.onPhaseUpdate?.([...this.phases])
  }

  buildWorkflow(): PlatformWorkflow {
    return {
      id: this.workflowId,
      userId: this.userId,
      config: this.config,
      phases: [...this.phases],
      state: this.state,
      contentId: this.contentItem?.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  }
}
