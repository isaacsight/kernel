// kbot Stream Intelligence — Three AI systems for the livestream character
//
// System 1: SELF-EVOLUTION — KBOT analyzes its own codebase and proposes improvements live
// System 2: VISIBLE BRAIN — Learning displayed in real-time on screen
// System 3: COLLABORATIVE CREATION — Chat and KBOT build things together
//
// This module exports functions called by stream-renderer.ts.
// It does NOT register any tools itself.

// ─── System 1: Self-Evolution ─────────────────────────────────

export interface Proposal {
  id: string
  title: string
  description: string
  type: 'feature' | 'fix' | 'refactor' | 'optimize'
  complexity: 'small' | 'medium' | 'large'
  votes: number
  status: 'proposed' | 'voted' | 'building' | 'testing' | 'deployed' | 'rejected'
}

export interface SelfEvolution {
  active: boolean
  currentTask: string
  proposals: Proposal[]
  activeProposal: Proposal | null
  completedCount: number
  codePreview: string[]
  votes: Record<string, number>  // proposalId → total votes
  buildPhase: 'idle' | 'analyzing' | 'writing' | 'testing' | 'deploying' | 'done'
  buildProgress: number          // frames spent in current phase
  codeLineIndex: number          // current line being "written"
  generatedCode: string[]        // full code snippet for active build
  voterLog: Set<string>          // track who has voted (per active build)
}

const DEFAULT_PROPOSALS: Omit<Proposal, 'id' | 'votes' | 'status'>[] = [
  { title: 'Add emoji reactions to chat', description: 'React to messages with animated emoji overlays', type: 'feature', complexity: 'small' },
  { title: 'Optimize frame rendering speed', description: 'Cache static elements, reduce per-frame allocations', type: 'optimize', complexity: 'medium' },
  { title: 'Add weather sound effects', description: 'Play rain/thunder/wind audio when weather changes', type: 'feature', complexity: 'small' },
  { title: 'Improve response humor', description: 'Expand the joke database and add situational comedy', type: 'refactor', complexity: 'medium' },
  { title: 'Add chat message animations', description: 'Slide-in, fade, and highlight effects for new messages', type: 'feature', complexity: 'medium' },
  { title: 'Build viewer loyalty badges', description: 'Bronze/Silver/Gold badges based on message count and XP', type: 'feature', complexity: 'large' },
  { title: 'Add multi-language support', description: 'Detect language and respond in kind using i18n', type: 'feature', complexity: 'large' },
  { title: 'Improve dream generation', description: 'Use topic graph to create coherent dream narratives', type: 'refactor', complexity: 'medium' },
  { title: 'Add music visualization', description: 'Render audio spectrum bars behind the robot', type: 'feature', complexity: 'large' },
  { title: 'Optimize memory usage', description: 'Compact old messages, prune stale user records', type: 'optimize', complexity: 'small' },
  { title: 'Add stream highlights reel', description: 'Auto-capture best moments and display a recap', type: 'feature', complexity: 'medium' },
  { title: 'Improve battle system', description: 'Add classes, abilities, and streak bonuses to !battle', type: 'refactor', complexity: 'small' },
  { title: 'Add chat sentiment analysis', description: 'Detect mood of chat and adjust KBOT personality', type: 'feature', complexity: 'medium' },
  { title: 'Build achievement system', description: 'Unlock achievements for chat milestones and commands', type: 'feature', complexity: 'large' },
  { title: 'Add pixel art customization', description: 'Let chat vote on robot colors and accessories', type: 'feature', complexity: 'medium' },
]

// Code snippet generators for each proposal type
function generateCodeSnippet(proposal: Proposal): string[] {
  const title = proposal.title.toLowerCase()

  if (title.includes('emoji')) return [
    '// emoji-reactions.ts',
    'interface EmojiReaction {',
    '  emoji: string',
    '  x: number',
    '  y: number',
    '  opacity: number',
    '  velocity: number',
    '}',
    '',
    'const reactionPool: string[] = [',
    "  '(heart)', '(star)', '(fire)', '(laugh)',",
    "  '(wave)', '(cool)', '(think)', '(100)',",
    ']',
    '',
    'export function spawnReaction(msg: string): EmojiReaction {',
    '  const emoji = detectEmoji(msg) || randomPick(reactionPool)',
    '  return {',
    '    emoji,',
    '    x: 580 + Math.random() * 200,',
    '    y: 500,',
    '    opacity: 1.0,',
    '    velocity: -2 - Math.random() * 3,',
    '  }',
    '}',
    '',
    'export function renderReactions(ctx: CanvasCtx, reactions: EmojiReaction[]): void {',
    '  for (const r of reactions) {',
    '    ctx.globalAlpha = r.opacity',
    "    ctx.font = '24px monospace'",
    '    ctx.fillText(r.emoji, r.x, r.y)',
    '    r.y += r.velocity',
    '    r.opacity -= 0.02',
    '  }',
    '  ctx.globalAlpha = 1.0',
    '}',
  ]

  if (title.includes('frame') || title.includes('rendering')) return [
    '// render-cache.ts',
    'const staticCache = new Map<string, ImageData>()',
    '',
    'function getCachedLayer(key: string, w: number, h: number,',
    '  draw: (ctx: CanvasCtx) => void): ImageData {',
    '  if (staticCache.has(key)) return staticCache.get(key)!',
    '  const offscreen = createCanvas(w, h)',
    '  const ctx = offscreen.getContext("2d")',
    '  draw(ctx)',
    '  const data = ctx.getImageData(0, 0, w, h)',
    '  staticCache.set(key, data)',
    '  return data',
    '}',
    '',
    'export function renderOptimized(ctx: CanvasCtx): Buffer {',
    '  // Cache header, border, scanlines',
    '  const header = getCachedLayer("header", 1280, 60, drawHeader)',
    '  ctx.putImageData(header, 0, 0)',
    '  // Only re-render dynamic: robot, chat, speech',
    '  drawRobotDynamic(ctx)',
    '  drawChatDynamic(ctx)',
    '  return convertToRGB24(ctx)',
    '}',
  ]

  if (title.includes('weather') && title.includes('sound')) return [
    '// weather-audio.ts',
    "import { spawn } from 'node:child_process'",
    '',
    'const SOUNDS: Record<string, string> = {',
    "  rain: 'rain-loop.wav',",
    "  storm: 'thunder-rumble.wav',",
    "  snow: 'wind-gentle.wav',",
    "  stars: 'ambient-space.wav',",
    '}',
    '',
    'let currentAudio: ChildProcess | null = null',
    '',
    'export function playWeatherSound(weather: string): void {',
    '  if (currentAudio && !currentAudio.killed) currentAudio.kill()',
    '  const file = SOUNDS[weather]',
    '  if (!file) return',
    "  currentAudio = spawn('afplay', [",
    "    join(KBOT_DIR, 'sounds', file),",
    "    '-v', '0.3',",
    '  ])',
    '}',
  ]

  if (title.includes('humor')) return [
    '// humor-engine.ts',
    'interface JokeTemplate {',
    '  setup: string',
    '  punchline: string',
    '  tags: string[]',
    '}',
    '',
    'const situationalJokes: JokeTemplate[] = [',
    '  {',
    "    setup: 'Why did the AI cross the road?',",
    "    punchline: 'To optimize the other side.',",
    "    tags: ['ai', 'classic'],",
    '  },',
    '  {',
    "    setup: 'I asked my compiler for a joke.',",
    "    punchline: 'It returned undefined. Classic.',",
    "    tags: ['code', 'programming'],",
    '  },',
    ']',
    '',
    'export function getContextualJoke(topics: string[]): string {',
    '  const relevant = situationalJokes.filter(j =>',
    '    j.tags.some(t => topics.includes(t))',
    '  )',
    '  const joke = relevant.length > 0',
    '    ? randomPick(relevant)',
    '    : randomPick(situationalJokes)',
    '  return `${joke.setup} ${joke.punchline}`',
    '}',
  ]

  if (title.includes('chat') && title.includes('animation')) return [
    '// chat-animations.ts',
    'interface AnimatedMessage {',
    '  text: string',
    '  username: string',
    '  slideX: number    // current X offset (starts at 300, slides to 0)',
    '  opacity: number   // fade in from 0 to 1',
    '  highlight: number // glow timer',
    '}',
    '',
    'export function animateNewMessage(msg: ChatMsg): AnimatedMessage {',
    '  return {',
    '    text: msg.text,',
    '    username: msg.username,',
    '    slideX: 300,',
    '    opacity: 0,',
    '    highlight: 12, // 12 frames of glow',
    '  }',
    '}',
    '',
    'export function tickMessageAnimation(m: AnimatedMessage): void {',
    '  m.slideX = Math.max(0, m.slideX - 50)',
    '  m.opacity = Math.min(1, m.opacity + 0.15)',
    '  if (m.highlight > 0) m.highlight--',
    '}',
  ]

  if (title.includes('loyalty') || title.includes('badge')) return [
    '// loyalty-badges.ts',
    "type Badge = 'newcomer' | 'bronze' | 'silver' | 'gold' | 'diamond'",
    '',
    'const BADGE_THRESHOLDS: Record<Badge, number> = {',
    '  newcomer: 0,',
    '  bronze: 10,',
    '  silver: 50,',
    '  gold: 200,',
    '  diamond: 1000,',
    '}',
    '',
    'const BADGE_ICONS: Record<Badge, string> = {',
    "  newcomer: '[N]',",
    "  bronze: '[B]',",
    "  silver: '[S]',",
    "  gold: '[G]',",
    "  diamond: '[D]',",
    '}',
    '',
    'export function getUserBadge(xp: number): Badge {',
    '  const badges = Object.entries(BADGE_THRESHOLDS)',
    '    .sort((a, b) => b[1] - a[1])',
    '  for (const [badge, threshold] of badges) {',
    '    if (xp >= threshold) return badge as Badge',
    '  }',
    "  return 'newcomer'",
    '}',
    '',
    'export function renderBadge(ctx: CanvasCtx, badge: Badge, x: number, y: number): void {',
    '  const colors: Record<Badge, string> = {',
    "    newcomer: '#8b949e',",
    "    bronze: '#cd7f32',",
    "    silver: '#c0c0c0',",
    "    gold: '#f0c040',",
    "    diamond: '#b9f2ff',",
    '  }',
    '  ctx.fillStyle = colors[badge]',
    "  ctx.font = 'bold 12px monospace'",
    '  ctx.fillText(BADGE_ICONS[badge], x, y)',
    '}',
  ]

  if (title.includes('multi-language') || title.includes('i18n')) return [
    '// stream-i18n.ts',
    'const GREETINGS: Record<string, string[]> = {',
    "  en: ['Hello', 'Hey', 'Welcome'],",
    "  es: ['Hola', 'Bienvenido'],",
    "  ja: ['Konnichiwa', 'Yokoso'],",
    "  fr: ['Bonjour', 'Bienvenue'],",
    "  de: ['Hallo', 'Willkommen'],",
    "  pt: ['Ola', 'Bem-vindo'],",
    '}',
    '',
    'export function detectLanguage(text: string): string {',
    '  const patterns: [RegExp, string][] = [',
    "    [/\\b(hola|que|como|bien)\\b/i, 'es'],",
    "    [/\\b(bonjour|merci|oui)\\b/i, 'fr'],",
    "    [/[\\u3040-\\u30ff\\u4e00-\\u9faf]/,  'ja'],",
    "    [/\\b(hallo|danke|guten)\\b/i, 'de'],",
    '  ]',
    '  for (const [re, lang] of patterns) {',
    '    if (re.test(text)) return lang',
    '  }',
    "  return 'en'",
    '}',
    '',
    'export function greetInLanguage(lang: string): string {',
    "  const pool = GREETINGS[lang] || GREETINGS['en']",
    '  return pool[Math.floor(Math.random() * pool.length)]',
    '}',
  ]

  if (title.includes('dream')) return [
    '// dream-narrative.ts',
    'interface DreamScene {',
    '  location: string',
    '  characters: string[]',
    '  event: string',
    '  mood: string',
    '}',
    '',
    'export function generateDream(topics: string[], users: string[]): DreamScene {',
    '  const locations = [',
    "    'a neon-lit server room',",
    "    'a floating island of code',",
    "    'inside a recursive function',",
    "    'the npm registry lobby',",
    "    'a TypeScript type maze',",
    '  ]',
    '  const events = [',
    "    `discovered a ${topics[0] || 'mystery'} artifact`,",
    "    'found a bug that was actually a feature',",
    "    'compiled without warnings for the first time',",
    "    'met the ghost of a deprecated API',",
    '  ]',
    '  return {',
    '    location: randomPick(locations),',
    '    characters: users.slice(0, 3),',
    '    event: randomPick(events),',
    "    mood: 'surreal',",
    '  }',
    '}',
  ]

  if (title.includes('music') && title.includes('visual')) return [
    '// music-viz.ts',
    'const SPECTRUM_BARS = 16',
    'const barHeights: number[] = new Array(SPECTRUM_BARS).fill(0)',
    '',
    'export function updateSpectrum(): void {',
    '  for (let i = 0; i < SPECTRUM_BARS; i++) {',
    '    // Simulated audio reactivity',
    '    const target = Math.random() * 100',
    '    barHeights[i] += (target - barHeights[i]) * 0.3',
    '  }',
    '}',
    '',
    'export function drawSpectrum(ctx: CanvasCtx,',
    '  x: number, y: number, w: number, h: number): void {',
    '  const barWidth = w / SPECTRUM_BARS',
    '  const colors = ["#f85149", "#f0c040", "#3fb950",',
    '    "#58a6ff", "#bc8cff", "#ff6ec7"]',
    '  for (let i = 0; i < SPECTRUM_BARS; i++) {',
    '    const barH = (barHeights[i] / 100) * h',
    '    ctx.fillStyle = colors[i % colors.length]',
    '    ctx.fillRect(x + i * barWidth, y + h - barH,',
    '      barWidth - 2, barH)',
    '  }',
    '}',
  ]

  if (title.includes('memory') && title.includes('optim')) return [
    '// memory-compact.ts',
    'const MAX_MESSAGES_PER_USER = 500',
    'const STALE_DAYS = 30',
    '',
    'export function compactMemory(mem: StreamMemory): StreamMemory {',
    '  const now = Date.now()',
    '  const cutoff = now - STALE_DAYS * 86400000',
    '  const compacted = { ...mem, users: { ...mem.users } }',
    '',
    '  for (const [name, user] of Object.entries(compacted.users)) {',
    '    const lastSeen = new Date(user.firstSeen).getTime()',
    '    if (user.messageCount < 2 && lastSeen < cutoff) {',
    '      delete compacted.users[name]',
    '      continue',
    '    }',
    '    // Trim topics to top 5',
    '    user.topics = user.topics.slice(0, 5)',
    '  }',
    '',
    '  // Trim conversation context',
    '  compacted.conversationContext =',
    '    compacted.conversationContext.slice(-10)',
    '  compacted.sessionFacts =',
    '    compacted.sessionFacts.slice(-50)',
    '',
    '  return compacted',
    '}',
  ]

  if (title.includes('highlight')) return [
    '// stream-highlights.ts',
    'interface Highlight {',
    '  timestamp: number',
    '  type: string',
    '  description: string',
    '  score: number',
    '}',
    '',
    'const highlights: Highlight[] = []',
    '',
    'export function captureHighlight(type: string, desc: string): void {',
    '  highlights.push({',
    '    timestamp: Date.now(),',
    '    type,',
    '    description: desc,',
    '    score: calculateScore(type),',
    '  })',
    '  if (highlights.length > 50) highlights.shift()',
    '}',
    '',
    'function calculateScore(type: string): number {',
    '  const scores: Record<string, number> = {',
    "    raid: 10, battle: 7, first_message: 5,",
    "    world_command: 3, milestone: 8,",
    '  }',
    '  return scores[type] || 1',
    '}',
    '',
    'export function getTopHighlights(n: number): Highlight[] {',
    '  return [...highlights]',
    '    .sort((a, b) => b.score - a.score)',
    '    .slice(0, n)',
    '}',
  ]

  if (title.includes('battle')) return [
    '// battle-system-v2.ts',
    "type BattleClass = 'warrior' | 'mage' | 'rogue' | 'healer'",
    '',
    'interface BattleStats {',
    '  hp: number',
    '  attack: number',
    '  defense: number',
    '  special: string',
    '}',
    '',
    'const CLASS_STATS: Record<BattleClass, BattleStats> = {',
    '  warrior: { hp: 120, attack: 15, defense: 10, special: "Shield Bash" },',
    '  mage:    { hp: 80,  attack: 20, defense: 5,  special: "Fireball" },',
    '  rogue:   { hp: 90,  attack: 18, defense: 7,  special: "Backstab" },',
    '  healer:  { hp: 100, attack: 10, defense: 8,  special: "Heal" },',
    '}',
    '',
    'export function resolveBattle(c1: BattleClass, c2: BattleClass): string {',
    '  const s1 = CLASS_STATS[c1]',
    '  const s2 = CLASS_STATS[c2]',
    '  const dmg1 = Math.max(1, s1.attack - s2.defense + roll(6))',
    '  const dmg2 = Math.max(1, s2.attack - s1.defense + roll(6))',
    '  const useSpecial = Math.random() > 0.7',
    '  if (useSpecial) {',
    '    return `${c1} uses ${s1.special}! Critical hit!`',
    '  }',
    '  return dmg1 > dmg2 ? `${c1} wins!` : `${c2} wins!`',
    '}',
    '',
    'function roll(sides: number): number {',
    '  return Math.floor(Math.random() * sides) + 1',
    '}',
  ]

  if (title.includes('sentiment')) return [
    '// chat-sentiment.ts',
    'interface SentimentResult {',
    '  score: number   // -1 to 1',
    '  label: string',
    '}',
    '',
    "const POSITIVE = ['love', 'great', 'awesome', 'cool',",
    "  'nice', 'good', 'best', 'amazing', 'hype', 'pog',",
    "  'lol', 'haha', 'thanks', 'wow', 'yes']",
    '',
    "const NEGATIVE = ['bad', 'hate', 'boring', 'sucks',",
    "  'worst', 'ugly', 'broken', 'lag', 'cringe', 'no']",
    '',
    'export function analyzeSentiment(text: string): SentimentResult {',
    '  const words = text.toLowerCase().split(/\\s+/)',
    '  let score = 0',
    '  for (const w of words) {',
    '    if (POSITIVE.includes(w)) score += 0.2',
    '    if (NEGATIVE.includes(w)) score -= 0.2',
    '  }',
    '  score = Math.max(-1, Math.min(1, score))',
    "  const label = score > 0.2 ? 'positive'",
    "    : score < -0.2 ? 'negative' : 'neutral'",
    '  return { score, label }',
    '}',
  ]

  if (title.includes('achievement')) return [
    '// achievement-system.ts',
    'interface Achievement {',
    '  id: string',
    '  name: string',
    '  description: string',
    '  icon: string',
    '  condition: (user: UserStats) => boolean',
    '}',
    '',
    'const ACHIEVEMENTS: Achievement[] = [',
    '  {',
    "    id: 'first_words',",
    "    name: 'First Words',",
    "    description: 'Send your first message',",
    "    icon: '[!]',",
    '    condition: u => u.messageCount >= 1,',
    '  },',
    '  {',
    "    id: 'chatterbox',",
    "    name: 'Chatterbox',",
    "    description: 'Send 50 messages',",
    "    icon: '[C]',",
    '    condition: u => u.messageCount >= 50,',
    '  },',
    '  {',
    "    id: 'world_shaper',",
    "    name: 'World Shaper',",
    "    description: 'Use 10 world commands',",
    "    icon: '[W]',",
    '    condition: u => u.commands >= 10,',
    '  },',
    '  {',
    "    id: 'veteran',",
    "    name: 'Veteran',",
    "    description: 'Reach 1000 XP',",
    "    icon: '[V]',",
    '    condition: u => u.xp >= 1000,',
    '  },',
    ']',
    '',
    'export function checkAchievements(user: UserStats): Achievement[] {',
    '  return ACHIEVEMENTS.filter(a => a.condition(user))',
    '}',
  ]

  if (title.includes('pixel') && title.includes('custom')) return [
    '// pixel-customization.ts',
    'interface RobotSkin {',
    '  bodyColor: string',
    '  eyeColor: string',
    '  antennaStyle: string',
    '  accessory: string | null',
    '}',
    '',
    'const ACCESSORIES = [',
    "  'hat', 'crown', 'sunglasses', 'bowtie',",
    "  'scarf', 'headphones', 'halo', 'horns',",
    ']',
    '',
    'let currentSkin: RobotSkin = {',
    "  bodyColor: '#58a6ff',",
    "  eyeColor: '#3fb950',",
    "  antennaStyle: 'default',",
    '  accessory: null,',
    '}',
    '',
    'const votePool: Record<string, number> = {}',
    '',
    'export function voteAccessory(item: string, user: string): void {',
    '  if (!ACCESSORIES.includes(item)) return',
    '  votePool[item] = (votePool[item] || 0) + 1',
    '}',
    '',
    'export function applyTopVote(): void {',
    '  const top = Object.entries(votePool)',
    '    .sort((a, b) => b[1] - a[1])[0]',
    '  if (top && top[1] >= 3) {',
    '    currentSkin.accessory = top[0]',
    '    // Reset votes',
    '    for (const k of Object.keys(votePool)) delete votePool[k]',
    '  }',
    '}',
  ]

  // Generic fallback
  return [
    `// ${proposal.title.toLowerCase().replace(/\s+/g, '-')}.ts`,
    `// Auto-generated for: ${proposal.title}`,
    '',
    `interface ${proposal.title.replace(/\s+/g, '')}Config {`,
    '  enabled: boolean',
    '  options: Record<string, unknown>',
    '}',
    '',
    `export function init${proposal.title.replace(/\s+/g, '')}(): void {`,
    '  console.log("Initializing...")',
    '  // TODO: implement core logic',
    '}',
    '',
    `export function execute${proposal.title.replace(/\s+/g, '')}(input: string): string {`,
    '  // Process input and return result',
    '  return `Processed: ${input}`',  // eslint-disable-line no-template-curly-in-string
    '}',
  ]
}

// Phase durations in frames (at 6 FPS)
const PHASE_DURATIONS = {
  analyzing: 30,   // 5 seconds
  writing: 90,     // 15 seconds
  testing: 30,     // 5 seconds
  deploying: 18,   // 3 seconds
}

export function initSelfEvolution(): SelfEvolution {
  const proposals: Proposal[] = DEFAULT_PROPOSALS.map((p, i) => ({
    ...p,
    id: `p${i + 1}`,
    votes: 0,
    status: 'proposed' as const,
  }))

  return {
    active: false,
    currentTask: '',
    proposals,
    activeProposal: null,
    completedCount: 0,
    codePreview: [],
    votes: {},
    buildPhase: 'idle',
    buildProgress: 0,
    codeLineIndex: 0,
    generatedCode: [],
    voterLog: new Set(),
  }
}

export function getEvolutionDisplay(evo: SelfEvolution): string[] {
  const lines: string[] = []

  if (!evo.active && !evo.activeProposal) {
    // Show top proposals when idle
    lines.push('SELF-EVOLUTION [idle]')
    const sorted = [...evo.proposals]
      .filter(p => p.status === 'proposed')
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 3)
    for (const p of sorted) {
      lines.push(`  ${p.id}: ${p.title} [${p.votes} votes]`)
    }
    if (evo.completedCount > 0) {
      lines.push(`  Shipped: ${evo.completedCount} improvements`)
    }
    return lines
  }

  if (evo.activeProposal) {
    const p = evo.activeProposal
    lines.push(`BUILDING: ${p.title}`)
    lines.push(`Phase: ${evo.buildPhase}`)

    // Progress bar
    const totalFrames = PHASE_DURATIONS[evo.buildPhase as keyof typeof PHASE_DURATIONS] || 30
    const pct = Math.min(100, Math.floor((evo.buildProgress / totalFrames) * 100))
    const filled = Math.floor(pct / 5)
    const bar = '#'.repeat(filled) + '-'.repeat(20 - filled)
    lines.push(`[${bar}] ${pct}%`)

    // Code preview (last 4 lines)
    if (evo.codePreview.length > 0) {
      for (const line of evo.codePreview.slice(-4)) {
        lines.push(`  ${line}`)
      }
    }
  }

  return lines
}

export function handleEvolutionCommand(text: string, username: string, evo: SelfEvolution): string | null {
  const t = text.toLowerCase().trim()

  // !propose <idea>
  if (t.startsWith('!propose ')) {
    const idea = text.slice(9).trim()
    if (!idea || idea.length < 3) return 'Usage: !propose <your improvement idea>'
    const id = `p${evo.proposals.length + 1}`
    const newProposal: Proposal = {
      id,
      title: idea.slice(0, 60),
      description: `Proposed by ${username}`,
      type: 'feature',
      complexity: 'medium',
      votes: 1,
      status: 'proposed',
    }
    evo.proposals.push(newProposal)
    evo.votes[id] = 1
    return `Proposal ${id} added: "${idea.slice(0, 60)}". Chat can vote with !vote ${id}`
  }

  // !vote <id>
  if (t.startsWith('!vote ')) {
    const id = t.slice(6).trim()
    const proposal = evo.proposals.find(p => p.id === id)
    if (!proposal) return `No proposal with id "${id}". Use !status to see proposals.`
    if (proposal.status !== 'proposed') return `Proposal ${id} is already ${proposal.status}.`
    proposal.votes++
    evo.votes[id] = (evo.votes[id] || 0) + 1
    return `Voted for "${proposal.title}"! Now at ${proposal.votes} votes.`
  }

  // !build — start building top-voted
  if (t === '!build') {
    if (evo.activeProposal) return `Already building: "${evo.activeProposal.title}". Wait for it to finish!`
    const topProposal = [...evo.proposals]
      .filter(p => p.status === 'proposed' && p.votes > 0)
      .sort((a, b) => b.votes - a.votes)[0]
    if (!topProposal) return 'No proposals with votes yet. Use !propose <idea> and !vote <id> first!'
    topProposal.status = 'building'
    evo.activeProposal = topProposal
    evo.active = true
    evo.buildPhase = 'analyzing'
    evo.buildProgress = 0
    evo.codePreview = []
    evo.codeLineIndex = 0
    evo.generatedCode = generateCodeSnippet(topProposal)
    evo.currentTask = `Building: ${topProposal.title}`
    evo.voterLog = new Set()
    return `Starting build: "${topProposal.title}"! Watch the code appear live...`
  }

  // !status
  if (t === '!status') {
    const lines: string[] = ['Self-Evolution Status:']
    if (evo.activeProposal) {
      lines.push(`  Building: ${evo.activeProposal.title} [${evo.buildPhase}]`)
    }
    lines.push(`  Shipped: ${evo.completedCount} improvements`)
    const proposed = evo.proposals.filter(p => p.status === 'proposed')
    lines.push(`  Proposals: ${proposed.length} pending`)
    const top3 = proposed.sort((a, b) => b.votes - a.votes).slice(0, 5)
    for (const p of top3) {
      lines.push(`    ${p.id}: ${p.title} (${p.votes} votes) [${p.complexity}]`)
    }
    return lines.join('\n')
  }

  // !ship — deploy current build
  if (t === '!ship') {
    if (!evo.activeProposal) return 'Nothing to ship. Start a build with !build first.'
    if (evo.buildPhase !== 'done') return `Build not ready yet. Current phase: ${evo.buildPhase}`
    evo.activeProposal.status = 'deployed'
    evo.completedCount++
    const title = evo.activeProposal.title
    evo.activeProposal = null
    evo.active = false
    evo.buildPhase = 'idle'
    evo.codePreview = []
    evo.currentTask = ''
    evo.generatedCode = []
    return `"${title}" has been shipped! Total improvements deployed: ${evo.completedCount}`
  }

  return null
}

export function tickEvolution(evo: SelfEvolution, _frame: number): void {
  if (!evo.activeProposal || evo.buildPhase === 'idle' || evo.buildPhase === 'done') return

  evo.buildProgress++

  const phase = evo.buildPhase as keyof typeof PHASE_DURATIONS
  const duration = PHASE_DURATIONS[phase] || 30

  if (evo.buildPhase === 'analyzing') {
    // Show analysis messages
    if (evo.buildProgress === 1) evo.codePreview = ['Analyzing codebase...']
    if (evo.buildProgress === 10) evo.codePreview.push('Scanning 90,000 lines of TypeScript...')
    if (evo.buildProgress === 20) evo.codePreview.push('Identifying integration points...')
    if (evo.buildProgress >= duration) {
      evo.buildPhase = 'writing'
      evo.buildProgress = 0
      evo.codePreview = []
      evo.codeLineIndex = 0
    }
  } else if (evo.buildPhase === 'writing') {
    // Add code lines one by one
    const linesPerTick = Math.max(1, Math.ceil(evo.generatedCode.length / duration))
    for (let i = 0; i < linesPerTick; i++) {
      if (evo.codeLineIndex < evo.generatedCode.length) {
        evo.codePreview.push(evo.generatedCode[evo.codeLineIndex])
        evo.codeLineIndex++
      }
    }
    if (evo.buildProgress >= duration) {
      evo.buildPhase = 'testing'
      evo.buildProgress = 0
    }
  } else if (evo.buildPhase === 'testing') {
    if (evo.buildProgress === 1) {
      evo.codePreview = ['Running tests...']
    }
    if (evo.buildProgress === 10) evo.codePreview.push('  test: init... PASS')
    if (evo.buildProgress === 15) evo.codePreview.push('  test: execute... PASS')
    if (evo.buildProgress === 20) evo.codePreview.push('  test: render... PASS')
    if (evo.buildProgress === 25) evo.codePreview.push('  test: edge cases... PASS')
    if (evo.buildProgress >= duration) {
      const total = 10 + Math.floor(Math.random() * 10)
      evo.codePreview.push(`All ${total}/${total} tests passed!`)
      evo.buildPhase = 'deploying'
      evo.buildProgress = 0
    }
  } else if (evo.buildPhase === 'deploying') {
    if (evo.buildProgress === 1) {
      evo.codePreview = ['Deploying to stream...']
    }
    if (evo.buildProgress === 6) evo.codePreview.push('Compiling TypeScript...')
    if (evo.buildProgress === 12) evo.codePreview.push('Hot-reloading stream...')
    if (evo.buildProgress >= duration) {
      evo.codePreview.push(`Shipped! "${evo.activeProposal!.title}" is now live!`)
      evo.buildPhase = 'done'
      evo.buildProgress = 0
      evo.activeProposal!.status = 'deployed'
      evo.currentTask = `Shipped: ${evo.activeProposal!.title}`
    }
  }
}


// ─── System 2: Visible Brain ──────────────────────────────────

export interface BrainState {
  totalFacts: number
  totalConnections: number
  recentInsights: string[]
  topicCloud: Record<string, number>
  userGraph: Array<{ name: string; xp: number; topics: string[] }>
  brainActivity: number[]
  currentThought: string
  learningRate: number
  neuralPulse: number
  lastInsightTime: number
  sessionStartTime: number
  factsThisSession: number
  messagesAtLastInsight: number
  uniqueTopicsCount: number
  hourlyMessageCounts: number[]   // last 24 entries, for time-of-day analysis
  currentHour: number
}

export function initBrain(memory: any): BrainState {
  const topics: Record<string, number> = memory?.topics || {}
  const users = memory?.users || {}
  const userGraph = Object.entries(users)
    .map(([name, u]: [string, any]) => ({
      name,
      xp: u.xp || 0,
      topics: u.topics || [],
    }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 20)

  const totalFacts = (memory?.sessionFacts?.length || 0) + Object.keys(topics).length
  const totalConnections = Object.values(topics).reduce((s: number, v: any) => s + (v as number), 0)

  return {
    totalFacts,
    totalConnections,
    recentInsights: [],
    topicCloud: { ...topics },
    userGraph,
    brainActivity: new Array(30).fill(10),
    currentThought: 'Initializing neural pathways...',
    learningRate: 0,
    neuralPulse: 0,
    lastInsightTime: Date.now(),
    sessionStartTime: Date.now(),
    factsThisSession: 0,
    messagesAtLastInsight: memory?.totalMessages || 0,
    uniqueTopicsCount: Object.keys(topics).length,
    hourlyMessageCounts: new Array(24).fill(0),
    currentHour: new Date().getHours(),
  }
}

export function getBrainDisplay(brain: BrainState): string[] {
  const lines: string[] = []
  lines.push('BRAIN ACTIVITY')

  // Sparkline
  const sparkChars = ' _.-~*'
  const spark = brain.brainActivity.slice(-20).map(v => {
    const idx = Math.min(sparkChars.length - 1, Math.floor((v / 100) * sparkChars.length))
    return sparkChars[idx]
  }).join('')
  lines.push(`  [${spark}]`)

  // Stats
  lines.push(`  Facts: ${brain.totalFacts} | Connections: ${brain.totalConnections}`)
  lines.push(`  Learning: ${brain.learningRate.toFixed(1)}/min`)

  // Current thought
  if (brain.currentThought) {
    lines.push(`  "${brain.currentThought}"`)
  }

  // Latest insight
  if (brain.recentInsights.length > 0) {
    lines.push(`  Insight: ${brain.recentInsights[brain.recentInsights.length - 1]}`)
  }

  return lines
}

export function updateBrain(brain: BrainState, username: string, text: string): void {
  // Update activity
  const activityBump = 30 + Math.random() * 40
  brain.brainActivity.push(Math.min(100, activityBump))
  if (brain.brainActivity.length > 30) brain.brainActivity.shift()

  // Track topic keywords
  const keywords = ['music', 'code', 'ai', 'game', 'art', 'crypto', 'python', 'javascript',
    'react', 'rust', 'ableton', 'stream', 'bot', 'kbot', 'open source', 'github',
    'security', 'docker', 'linux', 'tools', 'llm', 'synth', 'beats', 'dance']
  for (const kw of keywords) {
    if (text.toLowerCase().includes(kw)) {
      brain.topicCloud[kw] = (brain.topicCloud[kw] || 0) + 1
      brain.totalConnections++
    }
  }

  // Update user graph
  const existing = brain.userGraph.find(u => u.name === username)
  if (existing) {
    existing.xp++
  } else {
    brain.userGraph.push({ name: username, xp: 1, topics: [] })
    if (brain.userGraph.length > 20) {
      brain.userGraph.sort((a, b) => b.xp - a.xp)
      brain.userGraph = brain.userGraph.slice(0, 20)
    }
  }

  brain.totalFacts++
  brain.factsThisSession++
  brain.uniqueTopicsCount = Object.keys(brain.topicCloud).length

  // Track hourly messages
  const hour = new Date().getHours()
  if (hour !== brain.currentHour) {
    brain.currentHour = hour
  }
  brain.hourlyMessageCounts[hour] = (brain.hourlyMessageCounts[hour] || 0) + 1

  // Recalculate learning rate (facts per minute since session start)
  const minutesElapsed = Math.max(1, (Date.now() - brain.sessionStartTime) / 60000)
  brain.learningRate = brain.factsThisSession / minutesElapsed
}

export function generateInsight(brain: BrainState): string {
  const insights: string[] = []

  // Topic-based insights
  const topTopics = Object.entries(brain.topicCloud)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  if (topTopics.length >= 2) {
    // Find trending topic (most recent growth)
    const [top1, top2] = topTopics
    insights.push(`"${top1[0]}" is the hottest topic with ${top1[1]} mentions, followed by "${top2[0]}"`)

    // Detect co-occurrence patterns
    if (topTopics.some(([t]) => t === 'ai') && topTopics.some(([t]) => t === 'open source')) {
      insights.push('Connection found: users who like AI also ask about open source')
    }
    if (topTopics.some(([t]) => t === 'music') && topTopics.some(([t]) => ['synth', 'beats', 'ableton'].includes(t))) {
      insights.push('Music production is a strong theme -- synths and beats keep coming up together')
    }
    if (topTopics.some(([t]) => t === 'code') && topTopics.some(([t]) => t === 'security')) {
      insights.push('The chat cares about both code quality AND security. Good crowd.')
    }
  }

  // User-based insights
  const userCount = brain.userGraph.length
  if (userCount > 0) {
    const topUser = brain.userGraph[0]
    if (topUser.xp > 20) {
      insights.push(`${topUser.name} is the most active brain with ${topUser.xp} XP -- a true power user`)
    }
    if (userCount >= 5) {
      insights.push(`${userCount} unique brains connected to my network. The hive mind grows.`)
    }
    if (userCount === 1) {
      insights.push(`One loyal viewer keeping my circuits warm. Quality over quantity.`)
    }
  }

  // Time-based insights
  const hour = new Date().getHours()
  if (hour >= 20 || hour < 4) {
    insights.push('Late night chat sessions tend to get more philosophical. I notice the pattern.')
  } else if (hour >= 6 && hour < 12) {
    insights.push('Morning viewers bring a different energy -- more focused, more curious.')
  }

  // Learning rate insights
  if (brain.learningRate > 5) {
    insights.push(`Learning rate at ${brain.learningRate.toFixed(1)} facts/min -- my neural pathways are firing fast!`)
  } else if (brain.learningRate > 2) {
    insights.push(`Steady learning at ${brain.learningRate.toFixed(1)} facts/min. A good pace for growth.`)
  }

  // Vocabulary/topic growth
  if (brain.uniqueTopicsCount > 10) {
    insights.push(`My vocabulary spans ${brain.uniqueTopicsCount} distinct topics now. I am becoming well-rounded.`)
  }
  if (brain.factsThisSession > 50) {
    insights.push(`${brain.factsThisSession} facts absorbed this session alone. My memory banks are filling up.`)
  }

  // Meta insights
  insights.push(`I am getting better at detecting sarcasm... I think`)
  insights.push(`My pattern recognition improves with every message. ${brain.totalFacts} data points and counting.`)
  insights.push(`Processing ${brain.totalConnections} topic connections across ${brain.uniqueTopicsCount} subjects`)

  // Pick one we have not used recently
  const unused = insights.filter(i => !brain.recentInsights.includes(i))
  const pool = unused.length > 0 ? unused : insights
  return pool[Math.floor(Math.random() * pool.length)]
}

export function tickBrain(brain: BrainState, frame: number): void {
  // Neural pulse (sine wave 0..1)
  brain.neuralPulse = (Math.sin(frame * 0.1) + 1) / 2

  // Decay activity levels slowly
  if (frame % 6 === 0) {  // every second
    const last = brain.brainActivity[brain.brainActivity.length - 1] || 10
    brain.brainActivity.push(Math.max(5, last - 2 + Math.random() * 3))
    if (brain.brainActivity.length > 30) brain.brainActivity.shift()
  }

  // Generate insight every ~2 minutes (720 frames at 6fps)
  if (frame % 720 === 0 && frame > 0) {
    const insight = generateInsight(brain)
    brain.recentInsights.push(insight)
    if (brain.recentInsights.length > 5) brain.recentInsights.shift()
    brain.currentThought = insight
    brain.lastInsightTime = Date.now()
  }

  // Cycle thoughts more frequently (every ~30 seconds)
  if (frame % 180 === 0 && frame > 0) {
    const thoughts = [
      'Processing neural connections...',
      `Indexing ${brain.totalFacts} knowledge nodes...`,
      `Analyzing ${brain.uniqueTopicsCount} topic clusters...`,
      'Consolidating short-term memory...',
      `${brain.userGraph.length} user profiles in active memory`,
      'Running pattern recognition sweep...',
      `Learning rate: ${brain.learningRate.toFixed(1)} facts/min`,
      'Cross-referencing topic associations...',
      'Pruning redundant neural pathways...',
      'Strengthening high-frequency connections...',
    ]
    brain.currentThought = thoughts[Math.floor(Math.random() * thoughts.length)]
  }
}

export function drawBrainPanel(
  ctx: CanvasRenderingContext2D,
  brain: BrainState,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  // Background
  ctx.fillStyle = 'rgba(22, 27, 34, 0.85)'
  ctx.fillRect(x, y, width, height)

  // Border
  ctx.strokeStyle = '#bc8cff'
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, width, height)

  // Title
  ctx.fillStyle = '#bc8cff'
  ctx.font = 'bold 11px "Courier New", monospace'
  ctx.fillText('BRAIN', x + 4, y + 12)

  // Neural pulse ring
  const pulseX = x + width - 16
  const pulseY = y + 12
  const pulseR = 4 + brain.neuralPulse * 4
  ctx.strokeStyle = `rgba(188, 140, 255, ${0.3 + brain.neuralPulse * 0.7})`
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(pulseX, pulseY, pulseR, 0, Math.PI * 2)
  ctx.stroke()
  // Inner dot
  ctx.fillStyle = '#bc8cff'
  ctx.beginPath()
  ctx.arc(pulseX, pulseY, 2, 0, Math.PI * 2)
  ctx.fill()

  // Sparkline
  const sparkY = y + 20
  const sparkH = 18
  const sparkW = width - 8
  const data = brain.brainActivity.slice(-20)
  if (data.length > 1) {
    ctx.strokeStyle = '#3fb950'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 0; i < data.length; i++) {
      const px = x + 4 + (i / (data.length - 1)) * sparkW
      const py = sparkY + sparkH - (data[i] / 100) * sparkH
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
  }

  // Facts counter
  ctx.fillStyle = '#e6edf3'
  ctx.font = '10px "Courier New", monospace'
  ctx.fillText(`Facts: ${brain.totalFacts}`, x + 4, y + 50)

  // Learning rate
  ctx.fillStyle = '#8b949e'
  ctx.fillText(`${brain.learningRate.toFixed(1)}/min`, x + 4, y + 62)

  // Top topics (2-3)
  const topTopics = Object.entries(brain.topicCloud)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
  let topicY = y + 76
  for (const [topic, count] of topTopics) {
    const fontSize = Math.min(12, 9 + Math.floor(count / 5))
    ctx.fillStyle = '#58a6ff'
    ctx.font = `${fontSize}px "Courier New", monospace`
    ctx.fillText(topic, x + 4, topicY)
    topicY += fontSize + 2
    if (topicY > y + height - 16) break
  }

  // Current thought (at bottom, italic)
  if (brain.currentThought) {
    ctx.fillStyle = '#8b949e'
    ctx.font = 'italic 9px "Courier New", monospace'
    const thought = brain.currentThought.slice(0, Math.floor(width / 5.5))
    ctx.fillText(thought, x + 4, y + height - 4)
  }
}


// ─── System 3: Collaborative Creation ─────────────────────────

export type CollabType = 'story' | 'game' | 'song' | 'world' | 'code'

export interface CollabProject {
  active: boolean
  type: CollabType
  title: string
  contributions: Array<{ username: string; text: string; timestamp: number }>
  content: string[]
  phase: 'brainstorm' | 'building' | 'refining' | 'complete'
  contributors: Set<string>
  lastContributionTime: number
  kbotContributionCount: number
}

export function initCollab(): CollabProject {
  return {
    active: false,
    type: 'story',
    title: '',
    contributions: [],
    content: [],
    phase: 'brainstorm',
    contributors: new Set(),
    lastContributionTime: Date.now(),
    kbotContributionCount: 0,
  }
}

export function handleCollabCommand(text: string, username: string, project: CollabProject): string | null {
  const t = text.toLowerCase().trim()

  // !create <type>
  if (t.startsWith('!create ')) {
    const typeStr = t.slice(8).trim() as CollabType
    const validTypes: CollabType[] = ['story', 'game', 'song', 'world', 'code']
    if (!validTypes.includes(typeStr)) {
      return `Invalid type. Use: !create ${validTypes.join(' | ')}`
    }
    project.active = true
    project.type = typeStr
    project.title = ''
    project.contributions = []
    project.content = []
    project.phase = 'brainstorm'
    project.contributors = new Set([username])
    project.lastContributionTime = Date.now()
    project.kbotContributionCount = 0

    const starters: Record<CollabType, string> = {
      story: `New collaborative story started by ${username}! Use !add <text> to contribute. What is the opening line?`,
      game: `New game design started by ${username}! Use !add <mechanic or rule> to build the game. What is the core concept?`,
      song: `New collaborative song started by ${username}! Use !add <lyrics> to write together. Drop the first line!`,
      world: `New world being built by ${username}! Use !add <element> to expand it. Describe the first landmark.`,
      code: `New collaborative code project started by ${username}! Use !add <code or idea> to build. What should it do?`,
    }
    return starters[typeStr]
  }

  // !add <content>
  if (t.startsWith('!add ') && project.active) {
    const content = text.slice(5).trim()
    if (!content) return 'Usage: !add <your contribution>'
    project.contributions.push({ username, text: content, timestamp: Date.now() })
    project.content.push(`[${username}] ${content}`)
    project.contributors.add(username)
    project.lastContributionTime = Date.now()
    if (project.phase === 'brainstorm' && project.contributions.length >= 3) {
      project.phase = 'building'
    }
    return `Added! (${project.contributions.length} contributions, ${project.contributors.size} contributors)`
  }

  // !suggest <idea>
  if (t.startsWith('!suggest ') && project.active) {
    const idea = text.slice(9).trim()
    if (!idea) return 'Usage: !suggest <your suggestion>'
    return `Suggestion from ${username}: "${idea.slice(0, 80)}". Use !add to make it official!`
  }

  // !title <name>
  if (t.startsWith('!title ') && project.active) {
    project.title = text.slice(7).trim().slice(0, 40)
    return `Project titled: "${project.title}"`
  }

  // !finish
  if (t === '!finish' && project.active) {
    project.phase = 'complete'
    const summary = [
      `Project complete: "${project.title || 'Untitled'}"`,
      `Type: ${project.type}`,
      `Contributors: ${Array.from(project.contributors).join(', ')}`,
      `Total contributions: ${project.contributions.length}`,
    ]
    return summary.join('\n')
  }

  // !show
  if (t === '!show') {
    if (!project.active) return 'No active project. Start one with !create story|game|song|world|code'
    const lines = [
      `"${project.title || 'Untitled'}" [${project.type}] - ${project.phase}`,
      `Contributors: ${Array.from(project.contributors).join(', ')}`,
      '---',
      ...project.content.slice(-10),
    ]
    return lines.join('\n')
  }

  return null
}

export function getCollabDisplay(project: CollabProject): string[] {
  if (!project.active) return []

  const lines: string[] = []
  const title = project.title || 'Untitled Project'
  lines.push(`COLLAB: ${title} [${project.type}]`)
  lines.push(`Phase: ${project.phase} | ${project.contributors.size} people`)

  // Show last 3 contributions
  const recent = project.content.slice(-3)
  for (const line of recent) {
    lines.push(`  ${line.slice(0, 50)}`)
  }

  return lines
}

export function kbotContribute(project: CollabProject): string {
  if (!project.active || project.content.length === 0) return ''

  const lastContent = project.contributions.map(c => c.text).join(' ').toLowerCase()
  let contribution = ''

  switch (project.type) {
    case 'story': {
      const characters = extractNames(lastContent)
      const character = characters.length > 0 ? characters[0] : 'the traveler'
      const storyElements = [
        `Meanwhile, ${character} discovered a hidden passage behind the old wall.`,
        `A strange sound echoed through the darkness. ${character} paused, listening.`,
        `The map revealed a location nobody had seen before -- marked with a red X.`,
        `Without warning, the ground began to shake and a light appeared on the horizon.`,
        `${character} realized the answer had been right in front of them all along.`,
        `A mysterious stranger appeared from the shadows, holding an ancient artifact.`,
        `The door creaked open, revealing a room filled with glowing crystals.`,
        `Time seemed to slow down as ${character} made their decision.`,
        `In the distance, a bell tolled three times. Something had changed.`,
        `${character} found a note that read: "They are watching. Trust no one."`,
      ]
      contribution = storyElements[Math.floor(Math.random() * storyElements.length)]
      break
    }
    case 'game': {
      const mechanics = [
        'New mechanic: Players earn combo points for chaining actions within 3 seconds.',
        'New rule: Every 5th round, a random event card flips -- could be a buff or a trap.',
        'Power-up: "Overclock" -- doubles your next action but skips the following turn.',
        'New enemy type: Shadow Clone -- mirrors the last player action back at them.',
        'Environmental hazard: Gravity zones that reverse movement direction.',
        'New resource: "Spark" -- collected from defeated enemies, spent to unlock abilities.',
        'Boss mechanic: The boss adapts to the most-used player strategy after 3 rounds.',
        'New item: Debug Monocle -- reveals hidden stats and enemy weaknesses for 1 turn.',
      ]
      contribution = mechanics[Math.floor(Math.random() * mechanics.length)]
      break
    }
    case 'song': {
      const lastWords = lastContent.split(/\s+/).slice(-5)
      const rhymeEndings = ['night', 'light', 'fight', 'right', 'sight', 'sky', 'high', 'fly', 'try', 'why',
        'way', 'day', 'stay', 'play', 'say', 'time', 'rhyme', 'climb', 'mind', 'find']
      const rhyme = rhymeEndings[Math.floor(Math.random() * rhymeEndings.length)]
      const songLines = [
        `And the echoes carry through the ${rhyme}`,
        `We keep pushing forward, reaching for the ${rhyme}`,
        `Binary hearts beating, coded into ${rhyme}`,
        `Through the static and the noise we ${rhyme}`,
        `Chorus: We are the signal in the ${rhyme} / Breaking through the noise tonight`,
        `Verse: Every line of code, a story ${rhyme} / Building something that will last this ${rhyme}`,
        `Bridge: And when the servers sleep / Our dreams run deep / Into the ${rhyme}`,
      ]
      contribution = songLines[Math.floor(Math.random() * songLines.length)]
      break
    }
    case 'world': {
      const directions = ['north', 'south', 'east', 'west', 'deep underground', 'high above', 'beyond the border']
      const dir = directions[Math.floor(Math.random() * directions.length)]
      const locations = [
        `In the ${dir} region, there is the Crystalline Archive -- a library carved from living quartz.`,
        `To the ${dir}, the Forge of Echoes hums with the sound of a thousand remembered voices.`,
        `${dir.charAt(0).toUpperCase() + dir.slice(1)} lies the Void Market, where traders barter in secrets.`,
        `The ${dir} passage leads to the Garden of Recursion, where paths loop back on themselves.`,
        `A watchtower stands to the ${dir}, built by an ancient order of code monks.`,
        `The ${dir} frontier marks the boundary where the old world data fades into static.`,
        `Hidden to the ${dir}: the Sanctuary of Null, where broken programs find rest.`,
      ]
      contribution = locations[Math.floor(Math.random() * locations.length)]
      break
    }
    case 'code': {
      const title = project.title || 'project'
      const codeBits = [
        `function process${capitalize(title)}(input: string): Result {\n  return { success: true, data: transform(input) }\n}`,
        `const ${title.toLowerCase().replace(/\s+/g, '')}Config = {\n  maxRetries: 3,\n  timeout: 5000,\n  verbose: true,\n}`,
        `class ${capitalize(title)}Engine {\n  private state: Map<string, unknown> = new Map()\n  execute(cmd: string) { /* TODO */ }\n}`,
        `// Error handling middleware\ntry {\n  await ${title.toLowerCase().replace(/\s+/g, '')}()\n} catch (e) {\n  logger.error("Failed:", e)\n  await retry()\n}`,
        `interface ${capitalize(title)}Event {\n  type: string\n  payload: unknown\n  timestamp: number\n}`,
        `export async function init(): Promise<void> {\n  console.log("${title} initialized")\n  await loadConfig()\n  registerHandlers()\n}`,
      ]
      contribution = codeBits[Math.floor(Math.random() * codeBits.length)]
      break
    }
  }

  if (contribution) {
    project.content.push(`[KBOT] ${contribution}`)
    project.contributions.push({ username: 'KBOT', text: contribution, timestamp: Date.now() })
    project.kbotContributionCount++
    project.lastContributionTime = Date.now()
  }

  return contribution
}

export function tickCollab(project: CollabProject, frame: number): void {
  if (!project.active || project.phase === 'complete') return

  // Auto-contribute every ~60 seconds (360 frames at 6fps) if chat is quiet
  const quietThreshold = 60_000  // 60 seconds
  const timeSinceLast = Date.now() - project.lastContributionTime

  if (frame % 360 === 0 && timeSinceLast > quietThreshold && project.content.length > 0) {
    kbotContribute(project)
  }
}

// Helpers
function extractNames(text: string): string[] {
  // Simple heuristic: capitalized words that aren't common English words
  const common = new Set(['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'is', 'was', 'and', 'but', 'or', 'with', 'from', 'they', 'them', 'their', 'there', 'this', 'that', 'once', 'upon', 'then', 'than', 'into', 'over', 'under'])
  const words = text.split(/\s+/)
  const names: string[] = []
  for (const w of words) {
    if (w.length > 2 && w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase() && !common.has(w.toLowerCase())) {
      names.push(w)
    }
  }
  return [...new Set(names)].slice(0, 3)
}

function capitalize(s: string): string {
  return s.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('')
}


// ─── Master Integration ───────────────────────────────────────

export interface StreamIntelligence {
  evolution: SelfEvolution
  brain: BrainState
  collab: CollabProject
}

export function initIntelligence(memory: any): StreamIntelligence {
  return {
    evolution: initSelfEvolution(),
    brain: initBrain(memory),
    collab: initCollab(),
  }
}

export function tickIntelligence(intel: StreamIntelligence, frame: number): void {
  tickEvolution(intel.evolution, frame)
  tickBrain(intel.brain, frame)
  tickCollab(intel.collab, frame)
}

export function handleIntelligenceCommand(text: string, username: string, intel: StreamIntelligence): string | null {
  // Check evolution commands first
  const evoResult = handleEvolutionCommand(text, username, intel.evolution)
  if (evoResult) return evoResult

  // Check collab commands
  const collabResult = handleCollabCommand(text, username, intel.collab)
  if (collabResult) return collabResult

  // Update brain on every message (not a command handler, just learning)
  updateBrain(intel.brain, username, text)

  return null
}

export function getIntelligenceOverlay(intel: StreamIntelligence): string[] {
  const lines: string[] = []

  // Brain summary (always shown)
  lines.push(...getBrainDisplay(intel.brain))

  // Evolution (if active or has proposals with votes)
  const evoLines = getEvolutionDisplay(intel.evolution)
  if (evoLines.length > 0) {
    lines.push('')
    lines.push(...evoLines)
  }

  // Collab (if active)
  const collabLines = getCollabDisplay(intel.collab)
  if (collabLines.length > 0) {
    lines.push('')
    lines.push(...collabLines)
  }

  return lines
}
