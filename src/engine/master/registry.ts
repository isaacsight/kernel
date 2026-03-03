// ─── Engine Registry ─────────────────────────────────────────
//
// Central registry of all engines and their capabilities.
// The Master Agent reads this to know what it can do.

import type {
  EngineCapability,
  EngineRegistry,
  RegisteredEngine,
  EngineExecutor,
  MasterTool,
} from './types'

/** Singleton engine registry */
const registry: EngineRegistry = new Map()

/** Register an engine with its capability and executor */
export function registerEngine(
  id: string,
  capability: EngineCapability,
  execute: EngineExecutor,
): void {
  registry.set(id, { capability, execute })
}

/** Get a registered engine by ID */
export function getEngine(id: string): RegisteredEngine | undefined {
  return registry.get(id)
}

/** List all registered engines */
export function listEngines(): EngineCapability[] {
  return Array.from(registry.values()).map(e => e.capability)
}

/** Get the full registry map */
export function getRegistry(): EngineRegistry {
  return registry
}

/** Format all engine capabilities as a prompt block for Claude */
export function getCapabilitiesPrompt(): string {
  const engines = listEngines()
  if (engines.length === 0) return ''

  const lines = engines.map(e => {
    const actions = e.actions.map(a => `    - ${a.name}: ${a.description}`).join('\n')
    return `  **${e.name}** (${e.id})${e.requiresPro ? ' [Pro]' : ''}\n  ${e.description}\n  Actions:\n${actions}`
  })

  return `## Available Engines\n\n${lines.join('\n\n')}`
}

/** Convert engine capabilities to Claude tool-use format */
export function getCapabilitiesAsTools(): MasterTool[] {
  const tools: MasterTool[] = []

  for (const [, engine] of registry) {
    for (const action of engine.capability.actions) {
      tools.push({
        name: `${engine.capability.id}__${action.name}`,
        description: `[${engine.capability.name}] ${action.description}`,
        input_schema: {
          type: 'object',
          properties: action.inputSchema,
          required: Object.keys(action.inputSchema),
        },
      })
    }
  }

  return tools
}

/** Parse a tool name back into engineId + action */
export function parseToolName(toolName: string): { engineId: string; action: string } | null {
  const idx = toolName.indexOf('__')
  if (idx === -1) return null
  return {
    engineId: toolName.slice(0, idx),
    action: toolName.slice(idx + 2),
  }
}

// ─── Pre-register existing engines ──────────────────────────

/** Register all built-in engines. Called once at app startup. */
export function registerBuiltinEngines(): void {
  // Content Engine
  registerEngine('content', {
    id: 'content',
    name: 'Content Engine',
    description: 'Multi-stage content creation pipeline with ideation, research, outline, draft, edit, and publish stages.',
    requiresPro: true,
    actions: [
      {
        name: 'create_content',
        description: 'Create content through a multi-stage pipeline (ideation → research → outline → draft → edit → publish). Returns the final content item.',
        inputSchema: {
          brief: { type: 'string', description: 'Content brief describing what to create' },
          format: { type: 'string', description: 'Content format: blog_post, newsletter, essay, twitter_thread, linkedin_post, documentation, email_campaign, landing_page, press_release' },
        },
        outputDescription: 'ContentItem with title, body, format, and metadata',
      },
    ],
  }, async (action, input, callbacks) => {
    if (action !== 'create_content') throw new Error(`Unknown content action: ${action}`)
    const { ContentEngine } = await import('../ContentEngine')
    return new Promise((resolve, reject) => {
      const format = (input.format || 'blog_post') as 'blog_post' | 'newsletter' | 'essay' | 'twitter_thread' | 'linkedin_post' | 'documentation' | 'email_campaign' | 'landing_page' | 'press_release' | 'custom'
    const engine = new ContentEngine(input.brief as string, format, {
        onProgress: () => {},
        onChunk: callbacks.onChunk,
        onStageUpdate: (stages) => {
          const active = stages.find(s => s.status === 'active')
          if (active) callbacks.onProgress(`Stage: ${active.stage}`)
        },
        onApprovalNeeded: () => {},
      })
      engine.start().then(item => resolve(item)).catch(reject)
    })
  })

  // Knowledge Engine
  registerEngine('knowledge', {
    id: 'knowledge',
    name: 'Knowledge Engine',
    description: 'Personal knowledge base — ingest, retrieve, search, and manage knowledge items from conversations, documents, and web research.',
    requiresPro: false,
    actions: [
      {
        name: 'query',
        description: 'Query the knowledge base for relevant information on a topic. Returns formatted knowledge items.',
        inputSchema: {
          query: { type: 'string', description: 'Search query for the knowledge base' },
          userId: { type: 'string', description: 'User ID to search knowledge for' },
        },
        outputDescription: 'Formatted string of relevant knowledge items',
      },
      {
        name: 'retrieve',
        description: 'Retrieve top-N relevant knowledge items for context injection.',
        inputSchema: {
          query: { type: 'string', description: 'Query to find relevant knowledge' },
          userId: { type: 'string', description: 'User ID' },
          topN: { type: 'number', description: 'Number of items to retrieve (default 5)' },
        },
        outputDescription: 'Array of RetrievalResult objects with content and relevance scores',
      },
    ],
  }, async (action, input, callbacks) => {
    const { queryKnowledge, retrieveForContext } = await import('../KnowledgeEngine')
    if (action === 'query') {
      callbacks.onProgress('Searching knowledge base...')
      return await queryKnowledge(input.userId as string, input.query as string)
    }
    if (action === 'retrieve') {
      callbacks.onProgress('Retrieving knowledge...')
      return await retrieveForContext(input.userId as string, input.query as string, (input.topN as number) || 5)
    }
    throw new Error(`Unknown knowledge action: ${action}`)
  })

  // Algorithm Engine
  registerEngine('algorithm', {
    id: 'algorithm',
    name: 'Algorithm Engine',
    description: 'Content intelligence — scores content on 5 dimensions (relevance, quality, user affinity, freshness, trend alignment), ranks items, and recommends distribution strategy.',
    requiresPro: true,
    actions: [
      {
        name: 'score_content',
        description: 'Score a piece of content on 5 quality dimensions. Returns scores with reasoning.',
        inputSchema: {
          content: { type: 'string', description: 'Content text to score' },
          title: { type: 'string', description: 'Content title' },
          userContext: { type: 'string', description: 'Context about the user and audience' },
        },
        outputDescription: 'AlgorithmScore with dimension scores, overall score, and reasoning',
      },
    ],
  }, async (action, input, callbacks) => {
    if (action !== 'score_content') throw new Error(`Unknown algorithm action: ${action}`)
    const { AlgorithmEngine } = await import('../AlgorithmEngine')
    callbacks.onProgress('Scoring content...')
    const engine = new AlgorithmEngine()
    const contentItem = { title: input.title as string, body: input.content as string, format: 'blog_post' as const, createdAt: Date.now() }
    const signals = await engine.collectSignals(contentItem as never, input.userContext as string)
    return await engine.score(contentItem as never, signals, input.userContext as string)
  })

  // Platform Engine
  registerEngine('platform', {
    id: 'platform',
    name: 'Platform Engine',
    description: 'End-to-end content workflow orchestrator — chains content creation, scoring, social adaptation, distribution, and monitoring into a unified pipeline.',
    requiresPro: true,
    actions: [
      {
        name: 'run_pipeline',
        description: 'Run the full content platform pipeline: brief → create → score → adapt → distribute → monitor.',
        inputSchema: {
          brief: { type: 'string', description: 'Content brief' },
          format: { type: 'string', description: 'Content format' },
        },
        outputDescription: 'PlatformWorkflow with phases and their outputs',
      },
    ],
  }, async (action, input, callbacks) => {
    if (action !== 'run_pipeline') throw new Error(`Unknown platform action: ${action}`)
    const { PlatformEngine } = await import('../PlatformEngine')
    return new Promise((resolve, reject) => {
      const fmt = (input.format || 'blog_post') as 'blog_post' | 'newsletter' | 'essay' | 'twitter_thread' | 'linkedin_post' | 'documentation' | 'email_campaign' | 'landing_page' | 'press_release' | 'custom'
      const config: import('../platform/types').PlatformWorkflowConfig = {
        type: 'create_and_publish',
        brief: input.brief as string,
        format: fmt,
        targetPlatforms: [],
        autoApprovePhases: ['score', 'monitor'],
      }
      const engine = new PlatformEngine(config, input.userId as string || '', {
        onProgress: (_phase, _status, details) => {
          if (details) callbacks.onProgress(String(details))
        },
        onChunk: callbacks.onChunk,
        onPhaseUpdate: () => {},
        onApprovalNeeded: () => {},
        onContentStageUpdate: () => {},
        onContentApprovalNeeded: () => {},
      })
      engine.start().then(workflow => resolve(workflow)).catch(reject)
    })
  })

  // Research Engine
  registerEngine('research', {
    id: 'research',
    name: 'Deep Research',
    description: 'Multi-step web research pipeline — plans queries, searches in parallel, grades relevance, reformulates if needed, and synthesizes findings into a comprehensive report.',
    requiresPro: true,
    actions: [
      {
        name: 'research',
        description: 'Conduct deep research on a question. Plans queries, searches the web, and synthesizes findings.',
        inputSchema: {
          question: { type: 'string', description: 'Research question to investigate' },
        },
        outputDescription: 'Comprehensive research report with findings and sources',
      },
    ],
  }, async (action, input, callbacks) => {
    if (action !== 'research') throw new Error(`Unknown research action: ${action}`)
    const { deepResearch } = await import('../DeepResearch')
    return await deepResearch(
      input.question as string,
      '',
      (progress) => callbacks.onProgress(`${progress.phase}: ${progress.completedQueries}/${progress.totalQueries} queries`),
      callbacks.onChunk,
    )
  })

  // Swarm Engine
  registerEngine('swarm', {
    id: 'swarm',
    name: 'Swarm Orchestrator',
    description: 'Multi-agent parallel collaboration — selects 2-4 specialist agents, runs them in parallel, then synthesizes their contributions into a unified response.',
    requiresPro: true,
    actions: [
      {
        name: 'collaborate',
        description: 'Run a multi-agent swarm collaboration on a complex topic.',
        inputSchema: {
          message: { type: 'string', description: 'The message/question to collaborate on' },
          context: { type: 'string', description: 'Recent conversation context' },
        },
        outputDescription: 'Synthesized response from multiple specialist agents',
      },
    ],
  }, async (action, input, callbacks) => {
    if (action !== 'collaborate') throw new Error(`Unknown swarm action: ${action}`)
    const { runSwarm } = await import('../SwarmOrchestrator')
    return await runSwarm(
      input.message as string,
      input.context as string || '',
      [],
      () => {},
      callbacks.onChunk,
    )
  })

  // Memory Engine
  registerEngine('memory', {
    id: 'memory',
    name: 'Memory Agent',
    description: 'User profile and preferences — extracts and maintains a persistent memory of the user across conversations.',
    requiresPro: false,
    actions: [
      {
        name: 'get_profile',
        description: 'Get the current user memory profile (interests, goals, facts, preferences, communication style).',
        inputSchema: {
          userId: { type: 'string', description: 'User ID' },
        },
        outputDescription: 'UserMemoryProfile with interests, goals, facts, preferences',
      },
    ],
  }, async (action, input, callbacks) => {
    if (action !== 'get_profile') throw new Error(`Unknown memory action: ${action}`)
    const { getUserMemory } = await import('../SupabaseClient')
    callbacks.onProgress('Loading user memory...')
    const mem = await getUserMemory(input.userId as string)
    return mem?.profile || null
  })

  // Computer Engine
  registerEngine('computer', {
    id: 'computer',
    name: 'Computer Engine',
    description: 'Sandboxed compute environments — execute code, manage files, browse URLs, run terminal commands. Isolated per-agent.',
    requiresPro: true,
    actions: [
      {
        name: 'execute_code',
        description: 'Execute code in a sandboxed environment. Returns stdout, stderr, and exit code.',
        inputSchema: {
          code: { type: 'string', description: 'Code to execute' },
          language: { type: 'string', description: 'Programming language: javascript, typescript, python, bash' },
        },
        outputDescription: 'SandboxResult with stdout, stderr, exitCode',
      },
      {
        name: 'create_sandbox',
        description: 'Create a new isolated sandbox environment for an agent.',
        inputSchema: {
          agentId: { type: 'string', description: 'Agent ID to create sandbox for' },
        },
        outputDescription: 'Sandbox object with id and status',
      },
    ],
  }, async (action, input, callbacks) => {
    const { createSandbox, executeCode } = await import('../ComputerEngine')
    if (action === 'create_sandbox') {
      callbacks.onProgress('Creating sandbox...')
      return await createSandbox(input.userId as string, input.agentId as string || 'kernel')
    }
    if (action === 'execute_code') {
      callbacks.onProgress('Executing code...')
      // Auto-create sandbox if not specified
      const sandbox = await createSandbox(input.userId as string, 'kernel')
      const result = await executeCode(sandbox.id, input.code as string, input.language as string || 'javascript')
      callbacks.onChunk(result.stdout || result.stderr)
      return result
    }
    throw new Error(`Unknown computer action: ${action}`)
  })

  // Autonomous Engine
  registerEngine('autonomous', {
    id: 'autonomous',
    name: 'Autonomous Engine',
    description: 'Background agents with adaptive routing — create agents that run on schedules, events, or conditions. Tracks outcomes and optimizes routing weights over time.',
    requiresPro: true,
    actions: [
      {
        name: 'create_background_agent',
        description: 'Create a new background agent with a trigger (schedule, event, or condition) and persona configuration.',
        inputSchema: {
          name: { type: 'string', description: 'Agent name' },
          description: { type: 'string', description: 'What the agent does' },
          trigger_type: { type: 'string', description: 'Trigger type: schedule, event, or condition' },
          trigger_value: { type: 'string', description: 'Trigger value (e.g., every_1h, event_name, condition_check)' },
          persona: { type: 'string', description: 'Agent persona / system prompt' },
        },
        outputDescription: 'BackgroundAgent object with id, name, trigger, and config',
      },
      {
        name: 'list_agents',
        description: 'List all background agents for the current user.',
        inputSchema: {
          userId: { type: 'string', description: 'User ID' },
        },
        outputDescription: 'Array of BackgroundAgent objects',
      },
      {
        name: 'get_performance',
        description: 'Get routing weights and performance data for agent optimization.',
        inputSchema: {
          userId: { type: 'string', description: 'User ID' },
        },
        outputDescription: 'Array of RoutingWeights with agent_id, intent_type, weight, sample_count',
      },
      {
        name: 'optimize_routing',
        description: 'Recalculate routing weights from accumulated agent outcomes using exponential moving average.',
        inputSchema: {
          userId: { type: 'string', description: 'User ID' },
        },
        outputDescription: 'void — weights are updated in the database',
      },
    ],
  }, async (action, input, callbacks) => {
    const {
      createBackgroundAgent,
      listBackgroundAgents,
      getRoutingWeights,
      optimizeRouting,
    } = await import('../AutonomousEngine')
    const userId = input.userId as string

    if (action === 'create_background_agent') {
      callbacks.onProgress('Creating background agent...')
      const triggerType = input.trigger_type as string
      const triggerValue = input.trigger_value as string
      const trigger = triggerType === 'schedule'
        ? { type: 'schedule' as const, cron: triggerValue }
        : triggerType === 'event'
          ? { type: 'event' as const, event_name: triggerValue }
          : { type: 'condition' as const, check: triggerValue }
      return await createBackgroundAgent(userId, {
        name: input.name as string,
        description: input.description as string,
        trigger,
        agent_config: {
          persona: (input.persona as string) || `You are ${input.name as string}, a background agent.`,
          tools: [],
        },
      })
    }
    if (action === 'list_agents') {
      callbacks.onProgress('Listing background agents...')
      return await listBackgroundAgents(userId)
    }
    if (action === 'get_performance') {
      callbacks.onProgress('Loading routing weights...')
      return await getRoutingWeights(userId)
    }
    if (action === 'optimize_routing') {
      callbacks.onProgress('Optimizing routing weights...')
      await optimizeRouting(userId)
      return { status: 'optimized' }
    }
    throw new Error(`Unknown autonomous action: ${action}`)
  })

  // Image Generation Engine
  registerEngine('image', {
    id: 'image',
    name: 'Image Generator',
    description: 'AI image generation powered by Gemini 2.5 Flash. Credit-gated. Supports reference images for style guidance.',
    requiresPro: false,
    actions: [
      {
        name: 'generate',
        description: 'Generate an image from a text prompt. Uses Gemini 2.5 Flash.',
        inputSchema: {
          prompt: { type: 'string', description: 'Text description of the image to generate' },
        },
        outputDescription: 'ImageGenResult with base64 image, mimeType, and remaining credits',
      },
    ],
  }, async (action, input, callbacks) => {
    if (action !== 'generate') throw new Error(`Unknown image action: ${action}`)
    const { generateImage } = await import('../imageGen')
    callbacks.onProgress('Generating image...')
    return await generateImage(input.prompt as string)
  })

  // Publishing Engine
  registerEngine('publishing', {
    id: 'publishing',
    name: 'Publishing Engine',
    description: 'Publish content to the public feed, list published items, and retrieve engagement stats.',
    requiresPro: true,
    actions: [
      {
        name: 'publish_content',
        description: 'Publish a content item to the public feed. Generates a slug, runs moderation, and returns the public URL.',
        inputSchema: {
          contentId: { type: 'string', description: 'Content item ID to publish' },
          metaDescription: { type: 'string', description: 'Optional meta description for SEO (max 150 chars)' },
          authorName: { type: 'string', description: 'Author display name' },
        },
        outputDescription: 'Published item with slug, publicUrl, and moderationStatus',
      },
      {
        name: 'list_published',
        description: 'List all content items created by the user, including published and draft items.',
        inputSchema: {
          userId: { type: 'string', description: 'User ID' },
        },
        outputDescription: 'Array of content items with titles, formats, stages, and timestamps',
      },
      {
        name: 'get_stats',
        description: 'Get engagement stats (views, likes, bookmarks) for a published content item.',
        inputSchema: {
          contentId: { type: 'string', description: 'Content item ID' },
        },
        outputDescription: 'Engagement stats object with view_count, like_count, bookmark_count',
      },
    ],
  }, async (action, input, callbacks) => {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
    const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''

    async function getToken(): Promise<string | null> {
      try {
        const { getAccessToken } = await import('../SupabaseClient')
        return await getAccessToken()
      } catch {
        return null
      }
    }

    async function callContentEngine(body: Record<string, unknown>): Promise<Record<string, unknown>> {
      const token = await getToken()
      const res = await fetch(`${SUPABASE_URL}/functions/v1/content-engine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(err.error || `content-engine call failed`)
      }
      return await res.json()
    }

    if (action === 'publish_content') {
      callbacks.onProgress('Publishing content...')
      return await callContentEngine({
        action: 'publish_item',
        data: {
          id: input.contentId,
          meta_description: input.metaDescription || undefined,
          author_name: input.authorName || undefined,
        },
      })
    }

    if (action === 'list_published') {
      callbacks.onProgress('Loading content list...')
      return await callContentEngine({ action: 'list_items' })
    }

    if (action === 'get_stats') {
      callbacks.onProgress('Loading stats...')
      return await callContentEngine({
        action: 'get_item',
        data: { id: input.contentId },
      })
    }

    throw new Error(`Unknown publishing action: ${action}`)
  })

  // Agent Engine
  registerEngine('agents', {
    id: 'agents',
    name: 'Agent Engine',
    description: 'Custom agent builder — create, call, browse, and manage custom AI agents with configurable personas, tools, and workflows.',
    requiresPro: false,
    actions: [
      {
        name: 'create_agent',
        description: 'Create a new custom agent with a persona, enabled engines, and conversation starters.',
        inputSchema: {
          name: { type: 'string', description: 'Agent name' },
          persona: { type: 'string', description: 'System prompt defining the agent personality and expertise' },
          tools: { type: 'array', description: 'Array of engine IDs to enable (e.g. research, content, knowledge)' },
        },
        outputDescription: 'CustomAgent object with id, name, persona, tools, and metadata',
      },
      {
        name: 'call_agent',
        description: 'Send a message to a custom agent and get a response.',
        inputSchema: {
          agentId: { type: 'string', description: 'Custom agent ID' },
          message: { type: 'string', description: 'Message to send to the agent' },
        },
        outputDescription: 'Agent response text',
      },
      {
        name: 'list_agents',
        description: 'List all custom agents owned by the current user.',
        inputSchema: {
          userId: { type: 'string', description: 'User ID' },
        },
        outputDescription: 'Array of CustomAgent objects',
      },
      {
        name: 'browse_library',
        description: 'Browse public agents in the community library.',
        inputSchema: {},
        outputDescription: 'Array of public CustomAgent objects sorted by install count',
      },
    ],
  }, async (action, input, callbacks) => {
    const { createAgent, callAgent, listMyAgents, listPublicAgents } = await import('../AgentEngine')

    if (action === 'create_agent') {
      callbacks.onProgress('Creating agent...')
      const agent = await createAgent(
        input.userId as string || '',
        {
          name: input.name as string,
          persona: input.persona as string,
          tools: (input.tools as string[]) || [],
        },
      )
      return agent
    }

    if (action === 'call_agent') {
      callbacks.onProgress('Calling agent...')
      const { supabase } = await import('../SupabaseClient')
      const { data: agentRow } = await supabase
        .from('custom_agents')
        .select('*')
        .eq('id', input.agentId as string)
        .single()

      if (!agentRow) throw new Error('Agent not found')

      const response = await callAgent(
        agentRow as import('../agent/types').CustomAgent,
        input.message as string,
        [],
        callbacks.onChunk,
      )
      return response
    }

    if (action === 'list_agents') {
      callbacks.onProgress('Loading agents...')
      return await listMyAgents(input.userId as string)
    }

    if (action === 'browse_library') {
      callbacks.onProgress('Browsing library...')
      return await listPublicAgents()
    }

    throw new Error(`Unknown agents action: ${action}`)
  })

  // System Engine
  registerEngine('system', {
    id: 'system',
    name: 'System Engine',
    description: 'OS meta-layer — monitors all engines, runs health checks, reports metrics, and lists processes. Provides observability across the entire Kernel engine system.',
    requiresPro: false,
    actions: [
      {
        name: 'get_status',
        description: 'Get the current status of a specific engine by ID.',
        inputSchema: {
          engineId: { type: 'string', description: 'Engine ID to check status for' },
        },
        outputDescription: 'EngineProcess with status, uptime, request count',
      },
      {
        name: 'health_check',
        description: 'Run health checks against all registered engines. Returns health status for each.',
        inputSchema: {},
        outputDescription: 'Array of HealthCheck objects with status, latency, and details',
      },
      {
        name: 'get_metrics',
        description: 'Collect comprehensive system metrics including engine counts, latency, error rates, and uptime.',
        inputSchema: {},
        outputDescription: 'SystemMetrics with engines, resources, and health data',
      },
      {
        name: 'list_processes',
        description: 'List all running engine processes with their current status and activity.',
        inputSchema: {},
        outputDescription: 'Array of EngineProcess objects',
      },
    ],
  }, async (action, input, callbacks) => {
    const {
      getEngineStatus,
      healthCheck,
      getMetrics,
      listProcesses,
    } = await import('../SystemEngine')

    switch (action) {
      case 'get_status': {
        callbacks.onProgress('Checking engine status...')
        const status = getEngineStatus(input.engineId as string)
        if (!status) throw new Error(`Unknown engine: ${input.engineId}`)
        return status
      }
      case 'health_check': {
        callbacks.onProgress('Running health checks...')
        return await healthCheck()
      }
      case 'get_metrics': {
        callbacks.onProgress('Collecting system metrics...')
        return await getMetrics()
      }
      case 'list_processes': {
        callbacks.onProgress('Listing processes...')
        return listProcesses()
      }
      default:
        throw new Error(`Unknown system action: ${action}`)
    }
  })

  // Design Engine
  registerEngine('design', {
    id: 'design',
    name: 'Design Engine',
    description: 'AI-powered design system tools — generate components, design layouts, audit accessibility (WCAG), enforce Rubin design tokens, and create themes.',
    requiresPro: true,
    actions: [
      {
        name: 'generate_component',
        description: 'Generate a React component with HTML, CSS, props, and variants from a natural language description.',
        inputSchema: {
          description: { type: 'string', description: 'Natural language description of the component to generate' },
        },
        outputDescription: 'ComponentSpec with name, description, html, css, props, and variants',
      },
      {
        name: 'design_layout',
        description: 'Design a responsive layout with breakpoints and regions from requirements.',
        inputSchema: {
          requirements: { type: 'string', description: 'Layout requirements describing the desired structure' },
        },
        outputDescription: 'Layout with type, breakpoints, and regions',
      },
      {
        name: 'audit_accessibility',
        description: 'Audit HTML for WCAG 2.1 AA accessibility compliance. Returns score, issues, and recommendations.',
        inputSchema: {
          html: { type: 'string', description: 'HTML to audit for accessibility' },
        },
        outputDescription: 'AccessibilityReport with score (0-100), issues, and recommendations',
      },
      {
        name: 'enforce_design_system',
        description: 'Check CSS against Rubin design system tokens. Returns violations and suggestions.',
        inputSchema: {
          css: { type: 'string', description: 'CSS to check against Rubin design tokens' },
        },
        outputDescription: 'Object with violations array and suggestions array',
      },
    ],
  }, async (action, input, callbacks) => {
    const {
      generateComponent,
      designLayout,
      auditAccessibility,
      enforceDesignSystem,
      generateTheme,
    } = await import('../DesignEngine')

    switch (action) {
      case 'generate_component': {
        callbacks.onProgress('Generating component...')
        return await generateComponent(input.description as string)
      }
      case 'design_layout': {
        callbacks.onProgress('Designing layout...')
        return await designLayout(input.requirements as string)
      }
      case 'audit_accessibility': {
        callbacks.onProgress('Auditing accessibility...')
        return await auditAccessibility(input.html as string)
      }
      case 'enforce_design_system': {
        callbacks.onProgress('Checking design system compliance...')
        return await enforceDesignSystem(input.css as string)
      }
      default:
        throw new Error(`Unknown design action: ${action}`)
    }
  })

  // Architecture Engine
  registerEngine('architecture', {
    id: 'architecture',
    name: 'Architecture Engine',
    description: 'AI-powered system design — analyzes codebases, designs architectures, generates code from specs, and plans infrastructure with cost estimates.',
    requiresPro: true,
    actions: [
      {
        name: 'analyze_codebase',
        description: 'Analyze a codebase or system description and produce a full system design with components, dependencies, and Mermaid diagrams.',
        inputSchema: {
          description: { type: 'string', description: 'Description of the codebase or system to analyze' },
        },
        outputDescription: 'SystemDesign with components, dependencies, and diagrams',
      },
      {
        name: 'design_system',
        description: 'Design a complete software architecture from requirements. Generates components, dependencies, technology recommendations, and diagrams.',
        inputSchema: {
          requirements: { type: 'string', description: 'System requirements to design an architecture for' },
        },
        outputDescription: 'SystemDesign with components, dependencies, and diagrams',
      },
      {
        name: 'generate_code',
        description: 'Generate production-ready code files from a specification. Supports TypeScript, Python, Go, Rust, Java.',
        inputSchema: {
          spec: { type: 'string', description: 'Code specification describing what to generate' },
          language: { type: 'string', description: 'Target language: typescript, python, go, rust, java' },
        },
        outputDescription: 'CodeGenResult with generated files and summary',
      },
      {
        name: 'plan_infrastructure',
        description: 'Plan cloud infrastructure for a system design. Recommends provider, services, costs, and deployment steps.',
        inputSchema: {
          designId: { type: 'string', description: 'ID of a previously generated SystemDesign (or pass the design description)' },
          description: { type: 'string', description: 'System description (used if no designId)' },
        },
        outputDescription: 'InfrastructurePlan with provider, services, costs, and deployment steps',
      },
    ],
  }, async (action, input, callbacks) => {
    const { analyzeCodebase, designSystem, generateCode, planInfrastructure } = await import('../ArchitectureEngine')
    switch (action) {
      case 'analyze_codebase': {
        callbacks.onProgress('Analyzing codebase...')
        return await analyzeCodebase(input.description as string)
      }
      case 'design_system': {
        callbacks.onProgress('Designing system architecture...')
        return await designSystem(input.requirements as string)
      }
      case 'generate_code': {
        callbacks.onProgress('Generating code...')
        return await generateCode(input.spec as string, input.language as string || 'typescript')
      }
      case 'plan_infrastructure': {
        callbacks.onProgress('Planning infrastructure...')
        // If a description is provided directly, first design the system
        const desc = input.description as string
        if (desc) {
          const design = await designSystem(desc)
          return await planInfrastructure(design)
        }
        throw new Error('Either designId or description is required for infrastructure planning')
      }
      default:
        throw new Error(`Unknown architecture action: ${action}`)
    }
  })

  // ─── Communication Engine ───────────────────────────────────
  registerEngine('communication', {
    id: 'communication',
    name: 'Communication Engine',
    description: 'Unified messaging across channels — in-app notifications, email, push, Discord. Handles sending, broadcasting, scheduling, delivery tracking, and user preferences.',
    requiresPro: false,
    actions: [
      {
        name: 'send_message',
        description: 'Send a notification or message to a user via a specific channel (in_app, email, push, discord).',
        inputSchema: {
          userId: { type: 'string', description: 'Target user ID' },
          channel: { type: 'string', description: 'Channel: in_app, email, push, discord' },
          title: { type: 'string', description: 'Message title' },
          body: { type: 'string', description: 'Message body' },
        },
        outputDescription: 'Sent message with delivery status',
      },
      {
        name: 'broadcast',
        description: 'Broadcast a message to all users or a filtered audience.',
        inputSchema: {
          title: { type: 'string', description: 'Broadcast title' },
          body: { type: 'string', description: 'Broadcast body' },
          channels: { type: 'string', description: 'Comma-separated channels: in_app,email,push,discord' },
        },
        outputDescription: 'Broadcast result with sent/failed counts',
      },
      {
        name: 'get_preferences',
        description: 'Get a user\'s communication channel preferences.',
        inputSchema: {
          userId: { type: 'string', description: 'User ID to get preferences for' },
        },
        outputDescription: 'Channel preferences with enabled status and quiet hours',
      },
      {
        name: 'get_analytics',
        description: 'Get communication analytics — delivery rates, open rates, channel performance.',
        inputSchema: {},
        outputDescription: 'Communication analytics summary',
      },
    ],
  }, async (action, input, callbacks) => {
    const comms = await import('../CommunicationEngine')
    switch (action) {
      case 'send_message': {
        callbacks.onProgress('Sending message...')
        return await comms.sendMessage(
          input.userId as string,
          input.channel as 'in_app' | 'email' | 'push' | 'discord',
          { title: input.title as string, body: input.body as string },
        )
      }
      case 'broadcast': {
        callbacks.onProgress('Broadcasting...')
        const channels = (input.channels as string || 'in_app').split(',').map(c => c.trim()) as Array<'in_app' | 'email' | 'push' | 'discord'>
        return await comms.broadcast({ title: input.title as string, body: input.body as string, channels })
      }
      case 'get_preferences': {
        return await comms.getUserPreferences(input.userId as string)
      }
      case 'get_analytics': {
        return await comms.getAnalytics()
      }
      default:
        throw new Error(`Unknown communication action: ${action}`)
    }
  })

  // ─── Adaptive Engine ────────────────────────────────────────
  registerEngine('adaptive', {
    id: 'adaptive',
    name: 'Adaptive Engine',
    description: 'Self-improving intelligence layer — learns from every interaction, adapts response style, manages A/B experiments, tracks quality metrics, and surfaces behavioral insights.',
    requiresPro: false,
    actions: [
      {
        name: 'record_signal',
        description: 'Record a user quality signal (thumbs_up, thumbs_down, copy, retry, edit, share, etc.) for adaptive learning.',
        inputSchema: {
          type: { type: 'string', description: 'Signal type: thumbs_up, thumbs_down, edit, retry, copy, share, ignore, expand, follow_up' },
          messageId: { type: 'string', description: 'ID of the message this signal relates to' },
          context: { type: 'string', description: 'Optional context about the signal' },
        },
        outputDescription: 'Confirmation that signal was recorded',
      },
      {
        name: 'get_profile',
        description: 'Get the adaptive profile for a user — learned preferences for response length, tone, detail, format.',
        inputSchema: {
          userId: { type: 'string', description: 'User ID' },
        },
        outputDescription: 'AdaptiveProfile with response preferences and topic affinities',
      },
      {
        name: 'get_response_hints',
        description: 'Get response generation hints based on learned user preferences — preferred length, tone, format.',
        inputSchema: {
          userId: { type: 'string', description: 'User ID' },
          intent: { type: 'string', description: 'Optional intent type for context-specific hints' },
        },
        outputDescription: 'Response hints for prompt engineering',
      },
      {
        name: 'get_insights',
        description: 'Discover behavioral insights about a user — patterns, anomalies, trends, recommendations.',
        inputSchema: {
          userId: { type: 'string', description: 'User ID' },
        },
        outputDescription: 'List of adaptive insights with confidence scores',
      },
      {
        name: 'get_quality_metrics',
        description: 'Get quality metrics dashboard — response quality, user satisfaction, agent accuracy, adaptation rate.',
        inputSchema: {
          userId: { type: 'string', description: 'User ID' },
        },
        outputDescription: 'QualityMetrics summary',
      },
    ],
  }, async (action, input, callbacks) => {
    const adaptive = await import('../AdaptiveEngine')
    switch (action) {
      case 'record_signal': {
        return await adaptive.recordSignal({
          userId: input.userId as string || '',
          type: input.type as 'thumbs_up' | 'thumbs_down',
          messageId: input.messageId as string,
          context: input.context ? { note: input.context } as Record<string, unknown> : undefined,
          timestamp: Date.now(),
        })
      }
      case 'get_profile': {
        callbacks.onProgress('Loading adaptive profile...')
        return await adaptive.getAdaptiveProfile(input.userId as string)
      }
      case 'get_response_hints': {
        return await adaptive.getResponseHints(input.userId as string, input.intent as string)
      }
      case 'get_insights': {
        callbacks.onProgress('Discovering insights...')
        return await adaptive.discoverInsights(input.userId as string)
      }
      case 'get_quality_metrics': {
        return await adaptive.getQualityMetrics(input.userId as string)
      }
      default:
        throw new Error(`Unknown adaptive action: ${action}`)
    }
  })

  // ─── Pricing Engine ──────────────────────────────────────
  registerEngine('pricing', {
    id: 'pricing',
    name: 'Pricing Engine',
    description: 'Usage analytics, cost attribution, and tier recommendations',
    requiresPro: false,
    actions: [
      {
        name: 'get_forecast',
        description: 'Get usage forecast and projected monthly usage',
        inputSchema: {},
        outputDescription: 'Usage forecast with daily average, projected monthly, and feature breakdown',
      },
      {
        name: 'get_recommendation',
        description: 'Get tier recommendation based on usage patterns',
        inputSchema: {},
        outputDescription: 'Recommended plan, reason, and usage ratio',
      },
      {
        name: 'get_cost_breakdown',
        description: 'Get cost breakdown by feature for the last 30 days',
        inputSchema: { days: { type: 'number', description: 'Number of days to look back (default 30)' } },
        outputDescription: 'Cost summary with feature breakdown and daily trend',
      },
    ],
  }, async (action: string, input: Record<string, unknown>, callbacks: { onChunk: (text: string) => void; onProgress: (detail: string) => void }) => {
    const { getUserCostSummary, getUsageForecast, getTierRecommendation } = await import('../PricingEngine')
    switch (action) {
      case 'get_forecast': {
        callbacks.onProgress('Analyzing usage patterns...')
        return await getUsageForecast()
      }
      case 'get_recommendation': {
        callbacks.onProgress('Evaluating tier fit...')
        return await getTierRecommendation()
      }
      case 'get_cost_breakdown': {
        callbacks.onProgress('Loading cost breakdown...')
        const days = (input.days as number) || 30
        return await getUserCostSummary(days)
      }
      default:
        throw new Error(`Unknown pricing action: ${action}`)
    }
  })
}
