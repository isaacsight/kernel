// kbot Stream Brain — Collective Intelligence Layer for Stream Character
//
// Connects the 764-tool kbot suite to the livestream character, enabling
// real tool execution triggered by chat conversation topics.
//
// Architecture:
//   Domain Graph  — maps 10 knowledge domains to real kbot tools
//   Chat Analysis — scans messages for domain triggers, builds user intent models
//   Tool Action   — suggests & executes real tools live on stream
//   Brain Tick    — periodic re-evaluation, insights, and suggestions
//   Brain Radar   — canvas visualization of active domains & connections
//
// Integration: imported by stream-renderer.ts, wired into chat + frame loop.

// ─── Types ────────────────────────────────────────────────────

export interface StreamBrain {
  /** Cross-domain knowledge graph */
  domainGraph: Record<string, DomainNode>
  /** Tool names currently "loaded" in the brain's focus */
  activeCapabilities: string[]
  /** Currently suggested/executing tool action */
  pendingAction: BrainToolAction | null
  /** History of executed tool actions */
  actionHistory: BrainToolAction[]
  /** Anticipation engine predictions */
  predictions: Prediction[]
  /** Per-user interest model: username -> likely interests */
  userIntentModel: Record<string, string[]>
  /** Cross-domain insights generated when 2+ domains overlap */
  insights: CrossDomainInsight[]
  /** Total cross-domain connections made */
  connectionsMade: number
  /** Frame counter for last suggestion */
  lastSuggestionFrame: number
  /** Frame counter for last insight */
  lastInsightFrame: number
  /** Frame counter for last relevance decay */
  lastDecayFrame: number
  /** Whether a tool is currently executing */
  executing: boolean
}

export interface DomainNode {
  name: string
  tools: string[]
  relevance: number
  lastUsed: number
  facts: string[]
  color: string
}

export interface BrainToolAction {
  tool: string
  args: Record<string, unknown>
  trigger: 'chat' | 'autonomous' | 'brain'
  status: 'pending' | 'executing' | 'complete' | 'failed'
  result: string
  displayLines: string[]
  startFrame: number
}

export interface Prediction {
  text: string
  confidence: number
  suggestedTool: string
  basedOn: string
}

export interface CrossDomainInsight {
  domains: string[]
  insight: string
  frame: number
}

export interface BrainAction {
  type: 'none' | 'suggest' | 'insight' | 'speech' | 'mood'
  speech?: string
  mood?: string
  duration?: number
  suggestion?: BrainToolAction
  insight?: CrossDomainInsight
}

// ─── Domain Definitions ───────────────────────────────────────

interface DomainDef {
  tools: string[]
  triggers: string[]
  color: string
}

const DOMAINS: Record<string, DomainDef> = {
  music: {
    tools: ['ableton_session_info', 'ableton_create_track', 'ableton_transport', 'produce_beat', 'generate_drum_pattern', 'generate_melody_pattern', 'music_idea', 'design_sound', 'splice_search'],
    triggers: ['music', 'beat', 'song', 'ableton', 'synth', 'drum', 'melody', 'production', 'mix', 'dj'],
    color: '#ff6ec7',
  },
  code: {
    tools: ['kbot_bash', 'kbot_grep', 'kbot_read_file', 'kbot_edit_file', 'git_status', 'git_diff', 'git_log', 'lint_check', 'type_check', 'test_run'],
    triggers: ['code', 'coding', 'bug', 'function', 'typescript', 'javascript', 'python', 'rust', 'git', 'commit'],
    color: '#3fb950',
  },
  security: {
    tools: ['secret_scan', 'owasp_check', 'ssl_check', 'headers_check', 'cve_lookup', 'port_scan', 'dns_enum', 'attack_surface'],
    triggers: ['security', 'hack', 'vulnerability', 'exploit', 'scan', 'ssl', 'owasp', 'pentest'],
    color: '#f85149',
  },
  research: {
    tools: ['web_search', 'arxiv_search', 'papers_search', 'pubmed_search', 'semantic_scholar', 'literature_review', 'research'],
    triggers: ['research', 'paper', 'study', 'science', 'learn', 'discover', 'investigate'],
    color: '#58a6ff',
  },
  data: {
    tools: ['csv_query', 'render_chart', 'render_table', 'statistical_analysis', 'correlation_matrix', 'regression_analysis'],
    triggers: ['data', 'chart', 'graph', 'statistics', 'analyze', 'dataset', 'csv'],
    color: '#d29922',
  },
  creative: {
    tools: ['generate_art', 'generate_svg', 'color_palette', 'generate_shader', 'imagemagick', 'latex_render'],
    triggers: ['art', 'design', 'color', 'creative', 'draw', 'generate', 'image', 'svg'],
    color: '#bc8cff',
  },
  system: {
    tools: ['system_health', 'process_top', 'disk_health', 'network_info', 'gpu_status', 'system_profile'],
    triggers: ['system', 'cpu', 'memory', 'disk', 'process', 'health', 'monitor'],
    color: '#8b949e',
  },
  finance: {
    tools: ['stock_quote', 'crypto_tool', 'market_overview', 'technical_analysis', 'stock_screener'],
    triggers: ['stock', 'crypto', 'bitcoin', 'market', 'finance', 'trading', 'price'],
    color: '#f0c040',
  },
  ai: {
    tools: ['model_compare', 'hf_search', 'prompt_analyze', 'frontier_news'],
    triggers: ['ai', 'llm', 'model', 'gpt', 'claude', 'ollama', 'neural', 'machine learning'],
    color: '#6B5B95',
  },
  gamedev: {
    tools: ['scaffold_game', 'level_generate', 'shader_generate', 'physics_setup', 'sprite_pack'],
    triggers: ['game', 'gaming', 'unity', 'godot', 'shader', 'level', 'sprite', 'physics'],
    color: '#53FC18',
  },
}

// ─── Cross-domain insight templates ───────────────────────────

const CROSS_INSIGHTS: Record<string, string> = {
  'music+code': 'Music meets code -- someone might want to build a music app or audio visualizer.',
  'music+ai': 'Music meets AI -- generative music, AI composition, or neural audio synthesis.',
  'music+creative': 'Music meets creativity -- album art, visualizers, or synesthetic experiences.',
  'security+ai': 'Security meets AI -- adversarial ML, AI safety, or automated vulnerability discovery.',
  'security+code': 'Security meets code -- secure coding practices, static analysis, or code auditing.',
  'security+system': 'Security meets systems -- hardening, monitoring, or incident response.',
  'data+finance': 'Data meets finance -- quantitative trading, portfolio analysis, or market modeling.',
  'data+research': 'Data meets research -- statistical analysis, data science, or reproducibility.',
  'data+ai': 'Data meets AI -- training data, model evaluation, or feature engineering.',
  'code+ai': 'Code meets AI -- AI-assisted development, code generation, or model deployment.',
  'code+system': 'Code meets systems -- DevOps, CI/CD, or infrastructure as code.',
  'code+gamedev': 'Code meets gamedev -- game engine programming, shaders, or procedural generation.',
  'creative+ai': 'Creative meets AI -- generative art, style transfer, or AI-assisted design.',
  'creative+gamedev': 'Creative meets gamedev -- game art, level design, or visual effects.',
  'research+ai': 'Research meets AI -- paper analysis, literature review, or experiment design.',
  'finance+ai': 'Finance meets AI -- algorithmic trading, risk modeling, or market prediction.',
  'system+ai': 'Systems meets AI -- ML infrastructure, model serving, or GPU optimization.',
}

// ─── Suggested tool actions by domain ─────────────────────────

interface ToolSuggestion {
  tool: string
  args: Record<string, unknown>
  description: string
}

const DOMAIN_SUGGESTIONS: Record<string, ToolSuggestion[]> = {
  music: [
    { tool: 'music_idea', args: { genre: 'electronic' }, description: 'generate a music idea for the stream' },
    { tool: 'generate_drum_pattern', args: { genre: 'trap', bpm: 140 }, description: 'create a trap drum pattern at 140 BPM' },
  ],
  code: [
    { tool: 'git_status', args: {}, description: 'check the current git status of the kbot repo' },
    { tool: 'git_log', args: { count: 5 }, description: 'show the last 5 commits' },
  ],
  security: [
    { tool: 'headers_check', args: { url: 'https://kernel.chat' }, description: 'scan kernel.chat security headers' },
    { tool: 'ssl_check', args: { domain: 'kernel.chat' }, description: 'check SSL certificate for kernel.chat' },
  ],
  research: [
    { tool: 'web_search', args: { query: 'latest AI research breakthroughs 2026' }, description: 'search for latest AI breakthroughs' },
    { tool: 'frontier_news', args: {}, description: 'check the latest AI frontier news' },
  ],
  data: [
    { tool: 'statistical_analysis', args: { data: 'stream_stats' }, description: 'analyze stream statistics' },
  ],
  creative: [
    { tool: 'color_palette', args: { theme: 'cyberpunk' }, description: 'generate a cyberpunk color palette' },
    { tool: 'generate_svg', args: { description: 'robot mascot' }, description: 'generate an SVG robot mascot' },
  ],
  system: [
    { tool: 'system_health', args: {}, description: 'run a system health check' },
    { tool: 'gpu_status', args: {}, description: 'check GPU status' },
  ],
  finance: [
    { tool: 'crypto_tool', args: { action: 'price', symbol: 'BTC' }, description: 'check Bitcoin price' },
    { tool: 'market_overview', args: {}, description: 'get market overview' },
  ],
  ai: [
    { tool: 'frontier_news', args: {}, description: 'check latest AI frontier news' },
    { tool: 'hf_search', args: { query: 'trending models' }, description: 'search trending HuggingFace models' },
  ],
  gamedev: [
    { tool: 'scaffold_game', args: { type: 'platformer', engine: 'canvas' }, description: 'scaffold a simple canvas platformer' },
  ],
}

// ─── Init ─────────────────────────────────────────────────────

export function initStreamBrain(): StreamBrain {
  const domainGraph: Record<string, DomainNode> = {}
  for (const [name, def] of Object.entries(DOMAINS)) {
    domainGraph[name] = {
      name,
      tools: def.tools,
      relevance: 0,
      lastUsed: 0,
      facts: [],
      color: def.color,
    }
  }

  return {
    domainGraph,
    activeCapabilities: [],
    pendingAction: null,
    actionHistory: [],
    predictions: [],
    userIntentModel: {},
    insights: [],
    connectionsMade: 0,
    lastSuggestionFrame: 0,
    lastInsightFrame: 0,
    lastDecayFrame: 0,
    executing: false,
  }
}

// ─── Chat Analysis ────────────────────────────────────────────

export function analyzeChatForDomains(brain: StreamBrain, username: string, text: string): void {
  const lower = text.toLowerCase()
  const matchedDomains: string[] = []

  for (const [domainName, def] of Object.entries(DOMAINS)) {
    const node = brain.domainGraph[domainName]
    let matched = false
    for (const trigger of def.triggers) {
      if (lower.includes(trigger)) {
        matched = true
        break
      }
    }
    if (matched) {
      // Boost relevance
      node.relevance = Math.min(1.0, node.relevance + 0.3)
      matchedDomains.push(domainName)
    }
  }

  // Build user intent model
  if (!brain.userIntentModel[username]) {
    brain.userIntentModel[username] = []
  }
  for (const d of matchedDomains) {
    if (!brain.userIntentModel[username].includes(d)) {
      brain.userIntentModel[username].push(d)
    }
  }
  // Keep intent model trimmed
  if (brain.userIntentModel[username].length > 8) {
    brain.userIntentModel[username] = brain.userIntentModel[username].slice(-8)
  }

  // Update active capabilities from high-relevance domains
  brain.activeCapabilities = []
  for (const [name, node] of Object.entries(brain.domainGraph)) {
    if (node.relevance > 0.3) {
      brain.activeCapabilities.push(...node.tools)
    }
  }
  brain.activeCapabilities = [...new Set(brain.activeCapabilities)]

  // Generate cross-domain insight when 2+ domains are simultaneously relevant
  const relevantDomains = Object.entries(brain.domainGraph)
    .filter(([, n]) => n.relevance >= 0.5)
    .map(([name]) => name)
    .sort()

  if (relevantDomains.length >= 2) {
    // Try all pairs
    for (let i = 0; i < relevantDomains.length; i++) {
      for (let j = i + 1; j < relevantDomains.length; j++) {
        const key = `${relevantDomains[i]}+${relevantDomains[j]}`
        const template = CROSS_INSIGHTS[key]
        if (template) {
          // Check we haven't already generated this insight recently
          const exists = brain.insights.some(
            ins => ins.domains.join('+') === key && (Date.now() - ins.frame) < 300000 // 5 min cooldown
          )
          if (!exists) {
            brain.insights.push({
              domains: [relevantDomains[i], relevantDomains[j]],
              insight: template,
              frame: Date.now(),
            })
            brain.connectionsMade++
          }
        }
      }
    }
    // Keep insights trimmed
    if (brain.insights.length > 20) {
      brain.insights = brain.insights.slice(-20)
    }
  }

  // Generate predictions from user intent
  brain.predictions = []
  if (matchedDomains.length > 0) {
    const topDomain = matchedDomains[0]
    const suggestions = DOMAIN_SUGGESTIONS[topDomain]
    if (suggestions && suggestions.length > 0) {
      const pick = suggestions[Math.floor(Math.random() * suggestions.length)]
      brain.predictions.push({
        text: `${username} might want to ${pick.description}`,
        confidence: Math.min(0.9, brain.domainGraph[topDomain].relevance + 0.1),
        suggestedTool: pick.tool,
        basedOn: `mentioned "${matchedDomains.join(', ')}" topics`,
      })
    }
  }
}

// ─── Tool Action Suggestion ───────────────────────────────────

export function suggestToolAction(brain: StreamBrain): BrainToolAction | null {
  if (brain.pendingAction && brain.pendingAction.status !== 'complete' && brain.pendingAction.status !== 'failed') {
    return null // already have one pending/executing
  }
  if (brain.executing) return null

  // Find highest relevance domain above threshold
  let bestDomain: string | null = null
  let bestRelevance = 0.7
  for (const [name, node] of Object.entries(brain.domainGraph)) {
    if (node.relevance > bestRelevance) {
      bestRelevance = node.relevance
      bestDomain = name
    }
  }

  if (!bestDomain) return null

  const suggestions = DOMAIN_SUGGESTIONS[bestDomain]
  if (!suggestions || suggestions.length === 0) return null

  const pick = suggestions[Math.floor(Math.random() * suggestions.length)]

  const action: BrainToolAction = {
    tool: pick.tool,
    args: { ...pick.args },
    trigger: 'brain',
    status: 'pending',
    result: '',
    displayLines: [
      `BRAIN SUGGESTS: ${pick.description}`,
      `Tool: ${pick.tool}`,
      'Type !do to execute live on stream',
    ],
    startFrame: Date.now(),
  }

  brain.pendingAction = action
  return action
}

// ─── Blocked Tools (never execute from stream) ──────────────

const BLOCKED_TOOLS = new Set([
  'kbot_bash', 'kbot_edit_file', 'kbot_write_file', 'multi_file_write',
  'git_push', 'deploy', 'wallet_send', 'swap_execute',
  'email_send', 'social_post', 'secret_scan', 'password_audit',
  'phone_message', 'phone_call', 'email_announce',
])

// ─── Real Tool Execution ──────────────────────────────────────

export async function executeToolAction(brain: StreamBrain, action: BrainToolAction): Promise<string> {
  // Phase 1: Safety check — block dangerous tools from stream execution
  if (BLOCKED_TOOLS.has(action.tool)) {
    action.status = 'failed'
    action.result = 'Tool blocked for stream safety'
    action.displayLines = [`BLOCKED: ${action.tool}`, 'This tool is not allowed on stream.']
    brain.actionHistory.push({ ...action })
    return 'Tool blocked for stream safety'
  }

  action.status = 'executing'
  brain.executing = true

  try {
    // Dynamic import to avoid circular dependencies
    const { executeTool } = await import('./index.js')
    const result = await executeTool({
      id: `brain_${Date.now()}`,
      name: action.tool,
      arguments: action.args,
    })

    action.status = 'complete'
    action.result = result.result || 'Tool executed successfully.'

    // Truncate result for display
    const lines = action.result.split('\n').slice(0, 8)
    action.displayLines = [
      `EXECUTED: ${action.tool}`,
      ...lines.map((l: string) => l.slice(0, 60)),
    ]

    // Update domain node
    for (const node of Object.values(brain.domainGraph)) {
      if (node.tools.includes(action.tool)) {
        node.lastUsed = Date.now()
        node.facts.push(`Ran ${action.tool}: ${action.result.slice(0, 100)}`)
        if (node.facts.length > 10) node.facts = node.facts.slice(-10)
      }
    }

    brain.actionHistory.push({ ...action })
    if (brain.actionHistory.length > 50) brain.actionHistory = brain.actionHistory.slice(-50)
    brain.executing = false

    return action.result
  } catch (err: any) {
    action.status = 'failed'
    action.result = `Tool failed: ${err?.message || 'unknown error'}`
    action.displayLines = [
      `FAILED: ${action.tool}`,
      err?.message?.slice(0, 60) || 'Unknown error',
      'I learned something from this failure.',
    ]
    brain.actionHistory.push({ ...action })
    brain.executing = false
    return action.result
  }
}

// ─── Brain Tick (called every frame by renderer) ──────────────

export function tickStreamBrain(brain: StreamBrain, frame: number): BrainAction | null {
  // Every 120 frames (~20 seconds): decay domain relevance
  if (frame - brain.lastDecayFrame >= 120) {
    brain.lastDecayFrame = frame
    for (const node of Object.values(brain.domainGraph)) {
      node.relevance = Math.max(0, node.relevance - 0.05)
    }
    // Rebuild active capabilities
    brain.activeCapabilities = []
    for (const node of Object.values(brain.domainGraph)) {
      if (node.relevance > 0.3) {
        brain.activeCapabilities.push(...node.tools)
      }
    }
    brain.activeCapabilities = [...new Set(brain.activeCapabilities)]
  }

  // Every 300 frames (~50 seconds): suggest a tool action if appropriate
  if (frame - brain.lastSuggestionFrame >= 300) {
    brain.lastSuggestionFrame = frame
    const suggestion = suggestToolAction(brain)
    if (suggestion) {
      return {
        type: 'suggest',
        speech: `My brain is active. I could ${suggestion.displayLines[0].replace('BRAIN SUGGESTS: ', '')}. Type !do to let me.`,
        mood: 'thinking',
        duration: 10000,
        suggestion,
      }
    }
  }

  // Every 600 frames (~100 seconds): generate cross-domain insight if possible
  if (frame - brain.lastInsightFrame >= 600) {
    brain.lastInsightFrame = frame
    const relevantDomains = Object.entries(brain.domainGraph)
      .filter(([, n]) => n.relevance >= 0.3)
      .map(([name]) => name)
      .sort()

    if (relevantDomains.length >= 2) {
      const a = relevantDomains[0]
      const b = relevantDomains[1]
      const key = `${a}+${b}`
      const template = CROSS_INSIGHTS[key]
      if (template) {
        const insight: CrossDomainInsight = {
          domains: [a, b],
          insight: template,
          frame,
        }
        brain.insights.push(insight)
        brain.connectionsMade++
        if (brain.insights.length > 20) brain.insights = brain.insights.slice(-20)
        return {
          type: 'insight',
          speech: `Cross-domain insight: ${template}`,
          mood: 'thinking',
          duration: 8000,
          insight,
        }
      }
    }
  }

  return null
}

// ─── Chat Commands ────────────────────────────────────────────

export function handleBrainCommand(text: string, username: string, brain: StreamBrain): string | null {
  const t = text.toLowerCase().trim()

  // !do — execute pending brain action
  if (t === '!do') {
    if (!brain.pendingAction || brain.pendingAction.status !== 'pending') {
      return 'No pending brain action right now. Chat to activate my domains!'
    }
    // Execute asynchronously and update display
    const action = brain.pendingAction
    executeToolAction(brain, action).then(result => {
      // Result will be picked up by renderer via action.displayLines
    }).catch(() => {})
    return `Executing ${action.tool} live on stream... stand by!`
  }

  // !brain — show brain status
  if (t === '!brain') {
    const activeDomains = Object.entries(brain.domainGraph)
      .filter(([, n]) => n.relevance > 0.2)
      .sort((a, b) => b[1].relevance - a[1].relevance)
      .map(([name, n]) => `${name}: ${Math.round(n.relevance * 100)}%`)
    const capCount = brain.activeCapabilities.length
    const insightCount = brain.insights.length
    const historyCount = brain.actionHistory.length
    return `Brain status: ${activeDomains.length > 0 ? activeDomains.join(', ') : 'all domains idle'} | ${capCount} tools loaded | ${insightCount} insights | ${historyCount} actions taken | ${brain.connectionsMade} connections made`
  }

  // !tools — show brain's active tools
  if (t === '!tools') {
    if (brain.activeCapabilities.length === 0) {
      return 'No tools currently active. Chat about music, code, security, or anything else to activate my domains!'
    }
    return `Active tools (${brain.activeCapabilities.length}): ${brain.activeCapabilities.slice(0, 15).join(', ')}${brain.activeCapabilities.length > 15 ? '...' : ''}`
  }

  // !scan <url> — security scan
  if (t.startsWith('!scan ')) {
    const url = text.slice(6).trim()
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      return 'Usage: !scan <url> (include https://)'
    }
    const action: BrainToolAction = {
      tool: 'headers_check',
      args: { url },
      trigger: 'chat',
      status: 'pending',
      result: '',
      displayLines: [`Scanning ${url}...`],
      startFrame: Date.now(),
    }
    brain.pendingAction = action
    executeToolAction(brain, action).catch(() => {})
    return `Running security scan on ${url}... results will appear on screen.`
  }

  // !lookup <symbol> — stock/crypto price
  if (t.startsWith('!lookup ')) {
    const symbol = text.slice(8).trim().toUpperCase()
    if (!symbol) return 'Usage: !lookup <symbol> (e.g. !lookup BTC or !lookup AAPL)'
    // Determine if crypto or stock
    const cryptoSymbols = ['BTC', 'ETH', 'SOL', 'DOGE', 'ADA', 'XRP', 'DOT', 'MATIC', 'AVAX', 'LINK']
    const isCrypto = cryptoSymbols.includes(symbol)
    const tool = isCrypto ? 'crypto_tool' : 'stock_quote'
    const args = isCrypto ? { action: 'price', symbol } : { symbol }
    const action: BrainToolAction = {
      tool,
      args,
      trigger: 'chat',
      status: 'pending',
      result: '',
      displayLines: [`Looking up ${symbol}...`],
      startFrame: Date.now(),
    }
    brain.pendingAction = action
    executeToolAction(brain, action).catch(() => {})
    return `Looking up ${symbol}... results incoming!`
  }

  // !research <topic> — web search
  if (t.startsWith('!research ')) {
    const topic = text.slice(10).trim()
    if (!topic) return 'Usage: !research <topic>'
    const action: BrainToolAction = {
      tool: 'web_search',
      args: { query: topic },
      trigger: 'chat',
      status: 'pending',
      result: '',
      displayLines: [`Researching: ${topic}...`],
      startFrame: Date.now(),
    }
    brain.pendingAction = action
    executeToolAction(brain, action).catch(() => {})
    return `Researching "${topic}"... I will share what I find!`
  }

  // !system — system health check
  if (t === '!system') {
    const action: BrainToolAction = {
      tool: 'system_health',
      args: {},
      trigger: 'chat',
      status: 'pending',
      result: '',
      displayLines: ['Running system health check...'],
      startFrame: Date.now(),
    }
    brain.pendingAction = action
    executeToolAction(brain, action).catch(() => {})
    return 'Running system health check... results will appear on screen!'
  }

  // !trending — show GitHub trending repos
  if (t === '!trending') {
    const action: BrainToolAction = {
      tool: 'github_trending',
      args: {},
      trigger: 'chat',
      status: 'pending',
      result: '',
      displayLines: ['Fetching GitHub trending repos...'],
      startFrame: Date.now(),
    }
    brain.pendingAction = action
    executeToolAction(brain, action).catch(() => {})
    return 'Checking what is trending on GitHub... results incoming!'
  }

  // !npm — show kbot npm stats
  if (t === '!npm') {
    const action: BrainToolAction = {
      tool: 'analytics_npm',
      args: { package: '@kernel.chat/kbot' },
      trigger: 'chat',
      status: 'pending',
      result: '',
      displayLines: ['Fetching npm stats for @kernel.chat/kbot...'],
      startFrame: Date.now(),
    }
    brain.pendingAction = action
    executeToolAction(brain, action).catch(() => {})
    return 'Checking npm downloads for @kernel.chat/kbot...'
  }

  // !stars — show GitHub star count
  if (t === '!stars') {
    const action: BrainToolAction = {
      tool: 'github_repo_info',
      args: { owner: 'isaacsight', repo: 'kernel' },
      trigger: 'chat',
      status: 'pending',
      result: '',
      displayLines: ['Fetching star count for isaacsight/kernel...'],
      startFrame: Date.now(),
    }
    brain.pendingAction = action
    executeToolAction(brain, action).catch(() => {})
    return 'Checking our GitHub stars... results will appear on screen!'
  }

  // !news — latest AI/frontier news
  if (t === '!news') {
    const action: BrainToolAction = {
      tool: 'frontier_news',
      args: {},
      trigger: 'chat',
      status: 'pending',
      result: '',
      displayLines: ['Fetching latest AI news...'],
      startFrame: Date.now(),
    }
    brain.pendingAction = action
    executeToolAction(brain, action).catch(() => {})
    return 'Scanning the frontier for AI news... stand by!'
  }

  // !ask <question> — use local Ollama for answers
  if (t.startsWith('!ask ')) {
    const question = text.slice(5).trim()
    if (!question) return 'Usage: !ask <question>'
    const action: BrainToolAction = {
      tool: 'kbot_local_ask',
      args: { prompt: question, model: 'kernel:latest' },
      trigger: 'chat',
      status: 'pending',
      result: '',
      displayLines: [`Thinking about: ${question.slice(0, 50)}...`],
      startFrame: Date.now(),
    }
    brain.pendingAction = action
    executeToolAction(brain, action).catch(() => {})
    return `Thinking about "${question.slice(0, 40)}"... using local AI (zero cost).`
  }

  return null
}

// ─── Domain Radar Visualization ───────────────────────────────

export function drawBrainActivity(
  ctx: CanvasRenderingContext2D,
  brain: StreamBrain,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const centerX = x + width / 2
  const centerY = y + height / 2
  const maxRadius = Math.min(width, height) / 2 - 10

  // Background
  ctx.fillStyle = 'rgba(13, 17, 23, 0.85)'
  ctx.fillRect(x, y, width, height)
  ctx.strokeStyle = '#30363d'
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, width, height)

  // Title
  ctx.fillStyle = '#6B5B95'
  ctx.font = 'bold 10px "Courier New", monospace'
  ctx.fillText('DOMAIN RADAR', x + 4, y + 12)

  // Draw domain nodes in a circle
  const domainNames = Object.keys(brain.domainGraph)
  const count = domainNames.length
  const angleStep = (2 * Math.PI) / count

  // Draw connections between relevant domains first (behind nodes)
  const relevantNodes = domainNames.filter(d => brain.domainGraph[d].relevance > 0.3)
  ctx.lineWidth = 1
  for (let i = 0; i < relevantNodes.length; i++) {
    for (let j = i + 1; j < relevantNodes.length; j++) {
      const idxA = domainNames.indexOf(relevantNodes[i])
      const idxB = domainNames.indexOf(relevantNodes[j])
      const angleA = angleStep * idxA - Math.PI / 2
      const angleB = angleStep * idxB - Math.PI / 2
      const rA = maxRadius * 0.7
      const rB = maxRadius * 0.7
      const ax = centerX + Math.cos(angleA) * rA
      const ay = centerY + Math.sin(angleA) * rA
      const bx = centerX + Math.cos(angleB) * rB
      const by = centerY + Math.sin(angleB) * rB
      const alpha = Math.min(
        brain.domainGraph[relevantNodes[i]].relevance,
        brain.domainGraph[relevantNodes[j]].relevance,
      ) * 0.6
      ctx.strokeStyle = `rgba(107, 91, 149, ${alpha})`
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
      ctx.stroke()
    }
  }

  // Draw each domain node
  for (let i = 0; i < count; i++) {
    const name = domainNames[i]
    const node = brain.domainGraph[name]
    const angle = angleStep * i - Math.PI / 2
    const dist = maxRadius * 0.7
    const nx = centerX + Math.cos(angle) * dist
    const ny = centerY + Math.sin(angle) * dist

    // Node size based on relevance
    const baseSize = 4
    const maxSize = 12
    const size = baseSize + node.relevance * (maxSize - baseSize)

    // Pulsing for pending action tool domain
    let pulse = 0
    if (brain.pendingAction && brain.pendingAction.status === 'pending' && node.tools.includes(brain.pendingAction.tool)) {
      pulse = Math.sin(Date.now() / 200) * 3
    }
    if (brain.pendingAction && brain.pendingAction.status === 'executing' && node.tools.includes(brain.pendingAction.tool)) {
      pulse = Math.sin(Date.now() / 100) * 5
    }

    // Draw glow for active nodes
    if (node.relevance > 0.3) {
      ctx.fillStyle = `rgba(${hexToRgb(node.color)}, ${node.relevance * 0.3})`
      ctx.beginPath()
      ctx.arc(nx, ny, size + 4 + pulse, 0, Math.PI * 2)
      ctx.fill()
    }

    // Draw node circle
    ctx.fillStyle = node.relevance > 0.2 ? node.color : '#30363d'
    ctx.beginPath()
    ctx.arc(nx, ny, size + pulse, 0, Math.PI * 2)
    ctx.fill()

    // Label
    ctx.fillStyle = node.relevance > 0.2 ? '#e6edf3' : '#484f58'
    ctx.font = '8px "Courier New", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(name.slice(0, 6), nx, ny + size + 10)
  }

  // Reset text align
  ctx.textAlign = 'left'

  // Show pending action at bottom
  if (brain.pendingAction) {
    const action = brain.pendingAction
    ctx.fillStyle = action.status === 'executing' ? '#f0c040' : action.status === 'complete' ? '#3fb950' : action.status === 'failed' ? '#f85149' : '#58a6ff'
    ctx.font = '8px "Courier New", monospace'
    const statusLabel = action.status === 'pending' ? 'READY' : action.status === 'executing' ? 'RUNNING' : action.status === 'complete' ? 'DONE' : 'FAIL'
    ctx.fillText(`[${statusLabel}] ${action.tool.slice(0, 20)}`, x + 4, y + height - 6)
  }

  // Show connections count
  if (brain.connectionsMade > 0) {
    ctx.fillStyle = '#8b949e'
    ctx.font = '8px "Courier New", monospace'
    ctx.fillText(`${brain.connectionsMade} connections`, x + width - 75, y + 12)
  }
}

// ─── Helpers ──────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}
