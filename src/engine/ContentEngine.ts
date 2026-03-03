// ─── Content Engine ─────────────────────────────────────────────
//
// Multi-stage content creation pipeline.
// Flow: Ideation → Research → Outline → Draft → Edit → Publish
//
// Unlike AgenticWorkflow (which runs to completion), ContentEngine
// pauses at each stage for user approval. Auto-approve only for
// Research (which feeds into downstream stages without user input).
//
// Uses the same provider/streaming/callback patterns as AgenticWorkflow.

import { getProvider } from './providers/registry'
import { getSpecialist } from '../agents/specialists'
import type {
  ContentStage,
  ContentFormat,
  ContentItem,
  ContentStageState,
  ContentPipelineCallbacks,
  ContentPipelineEvent,
  STAGE_CONFIGS,
} from './content/types'
import { STAGE_CONFIGS as CONFIGS } from './content/types'

// ─── Stage Prompts ──────────────────────────────────────────────

function buildStagePrompt(
  stage: ContentStage,
  brief: string,
  format: ContentFormat,
  previousOutputs: Record<string, string>,
  userFeedback?: string,
): string {
  const contextBlock = Object.entries(previousOutputs)
    .map(([s, output]) => `## ${s.charAt(0).toUpperCase() + s.slice(1)} Output\n${output}`)
    .join('\n\n')

  const feedbackBlock = userFeedback
    ? `\n\nUser feedback on previous stage:\n${userFeedback}`
    : ''

  const formatLabel = format.replace(/_/g, ' ')

  switch (stage) {
    case 'ideation':
      return `You are brainstorming content ideas for a ${formatLabel}.

Brief: ${brief}
${feedbackBlock}

Generate 3-5 creative angles for this content. For each angle:
1. A compelling title/hook
2. The core thesis (1-2 sentences)
3. Why this angle would resonate with the target audience
4. Key differentiator from typical content on this topic

Be bold and creative. Avoid generic angles — find the unexpected insight.`

    case 'research':
      return `Research the following topic thoroughly for a ${formatLabel}.

Brief: ${brief}

${contextBlock}
${feedbackBlock}

Gather key facts, statistics, expert perspectives, and supporting evidence. Focus on:
1. Current data and trends (cite sources where possible)
2. Expert opinions and contrarian viewpoints
3. Real examples and case studies
4. Common misconceptions to address

Organize findings by theme. Be thorough but concise.`

    case 'outline':
      return `Create a detailed structural outline for a ${formatLabel}.

Brief: ${brief}

${contextBlock}
${feedbackBlock}

Build a clear outline with:
1. Working title (based on the chosen angle)
2. Hook/opening strategy
3. Section-by-section breakdown with key points for each
4. Transitions between sections
5. Call-to-action or closing strategy
6. Estimated word count per section

The outline should flow logically and build toward a clear conclusion.`

    case 'draft':
      return `Write the full ${formatLabel} based on the outline and research.

Brief: ${brief}

${contextBlock}
${feedbackBlock}

Write the complete content following the outline structure. Guidelines:
- Write in a natural, engaging voice
- Weave in research findings and data naturally
- Use concrete examples and vivid language
- Keep paragraphs short and scannable
- Include a strong opening hook and memorable closing
- Match the tone and style appropriate for the format

Produce the full piece — do not summarize or truncate.`

    case 'edit':
      return `Edit and polish this ${formatLabel} for publication quality.

Brief: ${brief}

${contextBlock}
${feedbackBlock}

Review and improve:
1. **Clarity**: Simplify complex sentences, eliminate jargon
2. **Flow**: Smooth transitions, logical progression
3. **Voice**: Consistent tone, authentic personality
4. **Impact**: Stronger opening, punchier closing, sharper insights
5. **Concision**: Cut filler words, redundant phrases, weak qualifiers
6. **Accuracy**: Verify claims match the research

Output the full edited piece with tracked changes noted in [brackets] for significant edits.`

    case 'publish':
      return `Prepare this ${formatLabel} for distribution.

Brief: ${brief}

${contextBlock}
${feedbackBlock}

Provide:
1. **Final title** (optimized for the platform)
2. **Meta description** (150 chars max)
3. **Tags/keywords** (5-8 relevant terms)
4. **Platform-specific recommendations**: formatting tips, ideal length, hashtags
5. **Distribution strategy**: best platforms, timing suggestions, audience targeting
6. **Social excerpts**: 2-3 ready-to-post promotional snippets

Make recommendations specific and actionable.`
  }
}

function buildSupportPrompt(
  stage: ContentStage,
  agentId: string,
  primaryOutput: string,
  brief: string,
  format: ContentFormat,
): string {
  const formatLabel = format.replace(/_/g, ' ')
  return `You are reviewing stage output for a ${formatLabel} content pipeline.

Stage: ${stage}
Brief: ${brief}

Primary agent output:
${primaryOutput.slice(0, 3000)}

Provide a brief (2-4 sentences) perspective from your specialization. Flag any gaps, suggest improvements, or highlight strengths. Be specific and actionable.`
}

// ─── Content Engine Class ───────────────────────────────────────

export type ContentEngineState = 'idle' | 'running' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled'

export class ContentEngine {
  private state: ContentEngineState = 'idle'
  private cancelled = false
  private stages: ContentStageState[] = []
  private stageOutputs: Record<string, string> = {}
  private contentId: string

  constructor(
    private brief: string,
    private format: ContentFormat,
    private callbacks: ContentPipelineCallbacks,
  ) {
    this.contentId = crypto.randomUUID()
    this.stages = CONFIGS.map(c => ({
      stage: c.stage,
      status: 'pending',
    }))
  }

  get id(): string {
    return this.contentId
  }

  getStages(): ContentStageState[] {
    return [...this.stages]
  }

  getState(): ContentEngineState {
    return this.state
  }

  cancel(): void {
    this.cancelled = true
    this.state = 'cancelled'
    this.emit('ideation', 'failed', 'Pipeline cancelled by user')
  }

  // ─── Run Pipeline ───────────────────────────────────────────

  async start(): Promise<ContentItem> {
    this.state = 'running'
    return this.runFrom('ideation')
  }

  async resumeFrom(stage: ContentStage, userFeedback?: string): Promise<ContentItem> {
    // Store user feedback on the current awaiting stage
    const stageState = this.stages.find(s => s.stage === stage)
    if (stageState && userFeedback) {
      stageState.userFeedback = userFeedback
    }

    // Mark the current stage as approved
    if (stageState?.status === 'awaiting_approval') {
      stageState.status = 'approved'
      stageState.completedAt = Date.now()
    }
    this.updateStages()

    // Find the next stage
    const stageOrder: ContentStage[] = ['ideation', 'research', 'outline', 'draft', 'edit', 'publish']
    const currentIdx = stageOrder.indexOf(stage)
    const nextStage = stageOrder[currentIdx + 1]

    if (!nextStage) {
      // All stages done
      return this.buildResult()
    }

    this.state = 'running'
    return this.runFrom(nextStage)
  }

  // ─── Internal Execution ─────────────────────────────────────

  private async runFrom(startStage: ContentStage): Promise<ContentItem> {
    const stageOrder: ContentStage[] = ['ideation', 'research', 'outline', 'draft', 'edit', 'publish']
    const startIdx = stageOrder.indexOf(startStage)

    for (let i = startIdx; i < stageOrder.length; i++) {
      if (this.cancelled) break

      const stage = stageOrder[i]
      const config = CONFIGS.find(c => c.stage === stage)!
      const stageState = this.stages.find(s => s.stage === stage)!

      // Mark active
      stageState.status = 'active'
      stageState.startedAt = Date.now()
      this.updateStages()
      this.emit(stage, 'active', `Running ${stage}...`)

      try {
        // 1. Primary agent generates output (streamed)
        const primaryOutput = await this.runPrimaryAgent(stage, config)
        stageState.output = primaryOutput
        this.stageOutputs[stage] = primaryOutput

        // 2. Support agents provide quick perspective (non-streamed, parallel)
        if (config.supportAgents.length > 0) {
          const supportOutputs = await this.runSupportAgents(stage, config, primaryOutput)
          stageState.supportOutputs = supportOutputs
        }

        // 3. Check if we need user approval
        if (!config.autoApprove) {
          stageState.status = 'awaiting_approval'
          this.state = 'awaiting_approval'
          this.updateStages()
          this.emit(stage, 'awaiting_approval', `${stage} complete — awaiting approval`)
          this.callbacks.onApprovalNeeded?.(stage, primaryOutput)
          return this.buildResult() // Return partial — UI will call resumeFrom() when user approves
        }

        // Auto-approved — mark complete and continue
        stageState.status = 'approved'
        stageState.completedAt = Date.now()
        this.updateStages()
        this.emit(stage, 'approved', `${stage} auto-approved`)

      } catch (err) {
        stageState.status = 'failed'
        stageState.error = err instanceof Error ? err.message : 'Unknown error'
        this.state = 'failed'
        this.updateStages()
        this.emit(stage, 'failed', stageState.error)
        return this.buildResult()
      }
    }

    // All stages complete
    this.state = 'completed'
    this.emit('publish', 'approved', 'Pipeline complete')
    return this.buildResult()
  }

  private async runPrimaryAgent(
    stage: ContentStage,
    config: typeof CONFIGS[number],
  ): Promise<string> {
    const specialist = getSpecialist(config.primaryAgent)
    const prompt = buildStagePrompt(
      stage,
      this.brief,
      this.format,
      this.stageOutputs,
      this.stages.find(s => s.stage === stage)?.userFeedback,
    )

    let fullText = ''
    await getProvider().stream(
      prompt,
      (chunk) => {
        fullText = chunk
        this.callbacks.onChunk?.(chunk)
      },
      {
        system: specialist.systemPrompt,
        tier: stage === 'research' ? 'fast' : 'strong',
        max_tokens: config.maxTokens,
        web_search: stage === 'research',
      },
    )

    return fullText
  }

  private async runSupportAgents(
    stage: ContentStage,
    config: typeof CONFIGS[number],
    primaryOutput: string,
  ): Promise<Record<string, string>> {
    const results: Record<string, string> = {}

    // Run support agents in parallel (Haiku — fast, non-streamed)
    await Promise.all(
      config.supportAgents.map(async (agentId) => {
        try {
          const specialist = getSpecialist(agentId)
          const prompt = buildSupportPrompt(stage, agentId, primaryOutput, this.brief, this.format)
          const response = await getProvider().text(prompt, {
            system: specialist.systemPrompt,
            tier: 'fast',
            max_tokens: 300,
          })
          results[agentId] = response
        } catch {
          results[agentId] = '(support agent unavailable)'
        }
      }),
    )

    return results
  }

  // ─── Helpers ────────────────────────────────────────────────

  private emit(stage: ContentStage, status: ContentStageState['status'], details?: string) {
    const event: ContentPipelineEvent = {
      type: 'content_progress',
      stage,
      status,
      details,
      timestamp: Date.now(),
    }
    this.callbacks.onProgress(event)
  }

  private updateStages() {
    this.callbacks.onStageUpdate?.([...this.stages])
  }

  private buildResult(): ContentItem {
    const publishOutput = this.stageOutputs['publish']
    return {
      id: this.contentId,
      userId: '', // Set by caller
      brief: this.brief,
      format: this.format,
      title: this.extractTitle(),
      tags: this.extractTags(),
      currentStage: this.getCurrentStage(),
      stages: [...this.stages],
      finalContent: this.stageOutputs['edit'] || this.stageOutputs['draft'] || '',
      createdAt: this.stages[0]?.startedAt || Date.now(),
      updatedAt: Date.now(),
    }
  }

  private getCurrentStage(): ContentStage {
    const activeStage = this.stages.find(s => s.status === 'active' || s.status === 'awaiting_approval')
    if (activeStage) return activeStage.stage

    const lastCompleted = [...this.stages]
      .reverse()
      .find(s => s.status === 'approved')
    return lastCompleted?.stage || 'ideation'
  }

  private extractTitle(): string | undefined {
    // Try to extract title from outline or draft output
    const outline = this.stageOutputs['outline'] || ''
    const titleMatch = outline.match(/(?:title|working title)[:\s]*["""']?([^\n"'"]+)/i)
    return titleMatch?.[1]?.trim()
  }

  private extractTags(): string[] {
    const publish = this.stageOutputs['publish'] || ''
    const tagMatch = publish.match(/(?:tags|keywords)[:\s]*([^\n]+)/i)
    if (!tagMatch) return []
    return tagMatch[1]
      .split(/[,;]/)
      .map(t => t.replace(/[#"']/g, '').trim())
      .filter(Boolean)
      .slice(0, 8)
  }
}
