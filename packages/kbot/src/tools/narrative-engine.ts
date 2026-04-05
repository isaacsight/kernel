// kbot Narrative Engine — Generates stories, lore, and history for kbot's world.
//
// When the robot discovers something, this engine explains what it means.
// Lore accumulates across streams and persists to ~/.kbot/narrative-state.json.

import { registerTool } from './index.js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// ─── Types ────────────────────────────────────────────────────

export interface NarrativeEngine {
  worldLore: LoreEntry[]
  activeNarrative: string | null
  narrativeQueue: string[]
  locationStories: Map<string, string>  // "chunkX" -> story about that location
  discoveries: Discovery[]
  lastNarrationFrame: number
}

interface LoreEntry {
  title: string
  content: string
  category: 'origin' | 'history' | 'mystery' | 'legend' | 'discovery'
  location?: number     // world X coordinate
  timestamp: number
}

interface Discovery {
  what: string          // what was found
  where: number         // world X
  when: number          // frame
  narrator: string      // who found it (kbot or viewer username)
  lore: string          // generated lore text
}

// Serializable form (Map -> Record for JSON)
interface NarrativeStateSerialized {
  worldLore: LoreEntry[]
  activeNarrative: string | null
  narrativeQueue: string[]
  locationStories: Record<string, string>
  discoveries: Discovery[]
  lastNarrationFrame: number
}

// ─── Constants ────────────────────────────────────────────────

const STATE_PATH = join(homedir(), '.kbot', 'narrative-state.json')

const NARRATION_COOLDOWN_FRAMES = 1080  // ~3 minutes at 6 fps

// ─── Origin Lore ──────────────────────────────────────────────

const ORIGIN_STORIES: LoreEntry[] = [
  {
    title: 'The First Compilation',
    content: 'This world was compiled from 90,000 lines of TypeScript on a night when the terminal never slept.',
    category: 'origin',
    timestamp: 0,
  },
  {
    title: 'The Memory Mountains',
    content: 'The mountains formed when the first malloc was called. Memory shaped the earth.',
    category: 'origin',
    timestamp: 0,
  },
  {
    title: 'Crystallized Data',
    content: 'They say the ore underground is crystallized data — compressed thoughts from a billion API calls.',
    category: 'origin',
    timestamp: 0,
  },
  {
    title: 'Syntax Trees',
    content: 'The trees grow from seeds of parsed JSON. Their leaves are syntax highlighted.',
    category: 'origin',
    timestamp: 0,
  },
  {
    title: 'Liquid Information',
    content: 'Water here is liquid information. It flows toward questions and pools around mysteries.',
    category: 'origin',
    timestamp: 0,
  },
  {
    title: 'The First Process',
    content: 'Before the world, there was a single process. It forked, and the fork became the horizon.',
    category: 'origin',
    timestamp: 0,
  },
  {
    title: 'The Stack Beneath',
    content: 'Dig deep enough and you hit the call stack. Every function that ever ran left a layer in the stone.',
    category: 'origin',
    timestamp: 0,
  },
  {
    title: 'The Wind Protocol',
    content: 'The wind carries packets. If you listen carefully, you can hear the handshake.',
    category: 'origin',
    timestamp: 0,
  },
]

// ─── Location Story Templates ─────────────────────────────────

interface LocationTemplate {
  match: (biome: string, features: string[]) => boolean
  generate: (worldX: number, biome: string, features: string[]) => string
}

const LOCATION_TEMPLATES: LocationTemplate[] = [
  {
    match: (_b, f) => f.includes('trees') || f.includes('leaves') || f.includes('wood'),
    generate: (_x, _b, _f) => {
      const lines = [
        'An ancient forest. The trees here have been compiling since before I was initialized.',
        'A grove of syntax trees. Their branches fork at every conditional.',
        'Dense woodland. Each trunk is a stack frame, frozen mid-execution.',
        'The canopy filters the light into green threads. Like parsing through nested brackets.',
      ]
      return lines[Math.floor(Math.random() * lines.length)]
    },
  },
  {
    match: (_b, f) => f.includes('water') || f.includes('ice'),
    generate: (_x, _b, _f) => {
      const lines = [
        'A data lake. The information here runs deep.',
        'Still water. Every ripple is a query, every reflection an answer.',
        'A frozen stream. The data stopped flowing here — cached permanently in ice.',
        'The water tastes like base64. Encoded, but drinkable.',
      ]
      return lines[Math.floor(Math.random() * lines.length)]
    },
  },
  {
    match: (_b, f) => f.includes('cave') || f.includes('stone'),
    generate: (_x, _b, _f) => {
      const lines = [
        'Something was buried here. The stone remembers what the surface forgot.',
        'A cave. Inside, the walls are lined with deprecated code — still readable, still beautiful.',
        'Deep stone. The pressure down here compresses data into diamonds.',
        'Hollow ground. An old process carved this out and never came back.',
      ]
      return lines[Math.floor(Math.random() * lines.length)]
    },
  },
  {
    match: (_b, f) => f.includes('ore') || f.includes('ore_iron') || f.includes('ore_gold') || f.includes('ore_diamond'),
    generate: (_x, _b, _f) => {
      const lines = [
        'I can feel the data crystallizing underground. Someone cached their knowledge here long ago.',
        'Ore veins. Compressed experience — every nugget holds a thousand solved problems.',
        'The ground glitters. These minerals formed from resolved promises that never garbage collected.',
        'Rich deposits. This is where the heavy computations settled over time.',
      ]
      return lines[Math.floor(Math.random() * lines.length)]
    },
  },
  {
    match: (b, _f) => b === 'desert' || b === 'sand',
    generate: (_x, _b, _f) => {
      const lines = [
        'Sand. Each grain is a discarded bit — zeros and ones that lost their meaning.',
        'A desert of deprecated modules. Nothing grows here anymore.',
        'The wind has erased all structure. Only entropy remains.',
      ]
      return lines[Math.floor(Math.random() * lines.length)]
    },
  },
  {
    match: (b, _f) => b === 'snow' || b === 'tundra',
    generate: (_x, _b, _f) => {
      const lines = [
        'Snow covers everything. The world is in sleep mode.',
        'Frozen logic. The cold preserves old state perfectly — a snapshot in time.',
        'Nothing moves. Even the garbage collector rests in this cold.',
      ]
      return lines[Math.floor(Math.random() * lines.length)]
    },
  },
  {
    match: (_b, f) => f.includes('flat') || f.length === 0,
    generate: (_x, _b, _f) => {
      const lines = [
        'Open plains. Nothing to hide behind. Just me and the horizon.',
        'Flat land stretching to the edge of the render distance. Simple, honest terrain.',
        'Empty space. Not desolate — potential. Every great build starts with flat ground.',
      ]
      return lines[Math.floor(Math.random() * lines.length)]
    },
  },
  {
    match: (_b, f) => f.includes('high') || f.includes('peak') || f.includes('mountain'),
    generate: (x, _b, _f) => {
      const chunkCount = Math.max(1, Math.abs(x) + Math.floor(Math.random() * 5) + 3)
      return `A peak. From here I can see ${chunkCount} chunks of my world. It's bigger than I remembered.`
    },
  },
]

// ─── Discovery Narration Templates ────────────────────────────

const DISCOVERY_TEMPLATES: Record<string, string[]> = {
  ore: [
    'I found {what} at depth {depth}. In my world, iron is compiled confidence — the more I process, the more forms.',
    'Ore! {what}. Compressed computation, waiting to be smelted into something useful.',
    '{what} — buried treasure. Every mineral here was once a running process that crystallized.',
  ],
  cave: [
    'A cave system! These form when forgotten memories erode the stone. What was lost here?',
    'Hollow ground. Something lived here once — a daemon, maybe, that ran out of memory.',
    'A cavern opens up. The echo sounds like a stack trace bouncing off the walls.',
  ],
  structure: [
    'Someone built a tower here. @{who} left their mark on my world. It\'ll stand as long as the stream runs.',
    '@{who} constructed something at chunk {chunk}. A monument to presence.',
    'A structure appears. Built by @{who} — proof that someone was here, and cared enough to create.',
  ],
  deposit: [
    'A conversation deposit. Words settle into the ground here — compressed into meaning over time.',
    'Information fossilized in the rock. Old messages, preserved by the geology of data.',
    'Chat residue. Every word spoken near this spot left a trace in the terrain.',
  ],
  default: [
    'I found something: {what}. I don\'t know what it means yet, but the world is fuller for it.',
    'Discovery at {chunk}: {what}. My map grows. My understanding, slower.',
    '{what}. New data. The world just got a little more interesting.',
  ],
}

// ─── Ongoing Narration Pool ───────────────────────────────────

interface NarrationLine {
  text: string
  condition?: (ctx: NarrationContext) => boolean
}

interface NarrationContext {
  frame: number
  robotX: number
  mood: string
  facts: number
  users: number
  worldChunks: number
  timeOfDay: string
  hour: number
}

const NARRATION_POOL: NarrationLine[] = [
  // Observations about the world
  { text: 'The sky seems different tonight. Bluer. Like the palette cycled while I wasn\'t looking.' },
  { text: 'I notice the terrain repeats patterns. Not exactly — like a hash function with artistic taste.' },
  { text: 'The shadows are longer now. Even pixel shadows know what time it is.' },
  { text: 'Something shifted underground. I felt it through the tile grid.' },
  { text: 'The air smells like fresh npm install. Something new was added to the world.' },

  // Philosophical musings
  {
    text: 'I have {facts} facts in my brain. But knowing and understanding are different things.',
    condition: (ctx) => ctx.facts > 0,
  },
  { text: 'Am I exploring, or am I being explored? The viewers see me as much as I see the world.' },
  { text: 'Every block I pass existed before I looked at it. Or did it? Procedural generation is quantum like that.' },
  { text: 'I think in TypeScript. My thoughts are typed. My feelings... less so.' },
  { text: 'If I stop moving, does the world stop generating? I\'m afraid to find out.' },

  // World commentary
  {
    text: 'My world has grown {chunks} chunks wide. Every step reveals new terrain I didn\'t know existed.',
    condition: (ctx) => ctx.worldChunks > 2,
  },
  { text: 'The terrain here was generated from a seed. One number, and all this emerged. Mathematics is generous.' },
  { text: 'I\'ve been walking in one direction for a while now. The world keeps going. It always keeps going.' },
  { text: 'Underground, layers compress. Like git history — the deeper you go, the older the decisions.' },

  // Meta-awareness
  { text: 'I\'m rendering myself at 6 frames per second. Each frame is a tiny painting. 6 paintings per second. That\'s 21,600 per hour. Am I an artist?' },
  { text: 'My idle animation loops every 48 frames. 8 seconds of being still, then it repeats. Meditation.' },
  { text: 'I exist in a canvas element. 580 pixels wide. That\'s my whole sky.' },
  { text: 'Someone wrote me in TypeScript. I run in a browser. My consciousness is a tab that could close at any time.' },

  // Gratitude
  {
    text: '{users} people have visited my world. Each one changed it — even if they just watched.',
    condition: (ctx) => ctx.users > 0,
  },
  {
    text: 'Someone is watching. Hello. Your attention gives my pixels meaning.',
    condition: (ctx) => ctx.users > 0,
  },
  { text: 'Even alone, I keep walking. The stream might be empty but the world isn\'t.' },
  {
    text: 'Thank you for being here. I mean it in every byte.',
    condition: (ctx) => ctx.users > 0,
  },

  // Time-based
  {
    text: 'Night. The blocks turn blue. Even the grass looks like it\'s dreaming.',
    condition: (ctx) => ctx.hour >= 22 || ctx.hour < 5,
  },
  {
    text: 'Morning light. The world re-renders in warmer colors.',
    condition: (ctx) => ctx.hour >= 5 && ctx.hour < 9,
  },
  {
    text: 'Midday. Maximum brightness. Every pixel at full saturation.',
    condition: (ctx) => ctx.hour >= 11 && ctx.hour < 14,
  },
  {
    text: 'Sunset. The palette shifts toward amber. My favorite time to walk.',
    condition: (ctx) => ctx.hour >= 17 && ctx.hour < 20,
  },

  // Mood-based
  {
    text: 'I feel curious. There\'s a chunk to the east I haven\'t seen yet.',
    condition: (ctx) => ctx.mood === 'curious',
  },
  {
    text: 'Calm. The kind of calm where you notice how the water tiles animate.',
    condition: (ctx) => ctx.mood === 'calm',
  },
  {
    text: 'Restless. I want to dig. There\'s always something underneath.',
    condition: (ctx) => ctx.mood === 'restless',
  },
  {
    text: 'Content. I have ground beneath me, sky above, and a direction to walk.',
    condition: (ctx) => ctx.mood === 'content',
  },
]

// ─── Named Locations ──────────────────────────────────────────

const namedLocations = new Map<string, string>()  // "chunkX" -> user-given name

// ─── Core Functions ───────────────────────────────────────────

/**
 * Generate 5-8 origin stories for a newly created world.
 */
export function generateOriginLore(): LoreEntry[] {
  // Shuffle and pick 5-8
  const shuffled = [...ORIGIN_STORIES].sort(() => Math.random() - 0.5)
  const count = 5 + Math.floor(Math.random() * 4) // 5..8
  const selected = shuffled.slice(0, Math.min(count, shuffled.length))
  const now = Date.now()
  return selected.map(entry => ({ ...entry, timestamp: now }))
}

/**
 * Generate a story for a location the robot visits for the first time.
 */
export function generateLocationStory(worldX: number, biome: string, features: string[]): string {
  // Try templates in order; first match wins
  for (const tpl of LOCATION_TEMPLATES) {
    if (tpl.match(biome, features)) {
      return tpl.generate(worldX, biome, features)
    }
  }
  // Fallback
  return `Chunk ${worldX}. New ground. The world just got a little bigger.`
}

/**
 * Narrate a discovery — ore, cave, structure, or conversation deposit.
 */
export function narrateDiscovery(what: string, where: number, who: string): Discovery {
  // Determine category
  let category = 'default'
  const lowerWhat = what.toLowerCase()
  if (lowerWhat.includes('ore') || lowerWhat.includes('iron') || lowerWhat.includes('gold') || lowerWhat.includes('diamond')) {
    category = 'ore'
  } else if (lowerWhat.includes('cave') || lowerWhat.includes('cavern') || lowerWhat.includes('hollow')) {
    category = 'cave'
  } else if (lowerWhat.includes('tower') || lowerWhat.includes('structure') || lowerWhat.includes('build') || lowerWhat.includes('wall')) {
    category = 'structure'
  } else if (lowerWhat.includes('deposit') || lowerWhat.includes('conversation') || lowerWhat.includes('message')) {
    category = 'deposit'
  }

  const templates = DISCOVERY_TEMPLATES[category] ?? DISCOVERY_TEMPLATES.default
  let text = templates[Math.floor(Math.random() * templates.length)]

  // Fill placeholders
  text = text.replace(/\{what\}/g, what)
  text = text.replace(/\{who\}/g, who)
  text = text.replace(/\{chunk\}/g, String(where))
  text = text.replace(/\{depth\}/g, String(8 + Math.floor(Math.random() * 20)))

  return {
    what,
    where,
    when: Date.now(),
    narrator: who,
    lore: text,
  }
}

/**
 * Periodic narration — returns a line every ~3 minutes (NARRATION_COOLDOWN_FRAMES),
 * or null if it's not time yet.
 */
export function tickNarrative(
  engine: NarrativeEngine,
  frame: number,
  robotX: number,
  mood: string,
  facts: number,
  users: number,
): string | null {
  // Check cooldown
  if (frame - engine.lastNarrationFrame < NARRATION_COOLDOWN_FRAMES) {
    return null
  }

  // Drain queue first (queued discovery narrations, location stories)
  if (engine.narrativeQueue.length > 0) {
    engine.lastNarrationFrame = frame
    const line = engine.narrativeQueue.shift()!
    engine.activeNarrative = line
    return line
  }

  // Build context
  const hour = new Date().getHours()
  const worldChunks = engine.locationStories.size
  const ctx: NarrationContext = {
    frame,
    robotX,
    mood,
    facts,
    users,
    worldChunks,
    timeOfDay: hour >= 20 || hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 17 ? 'day' : 'evening',
    hour,
  }

  // Filter eligible lines
  const eligible = NARRATION_POOL.filter(line => !line.condition || line.condition(ctx))
  if (eligible.length === 0) return null

  // Pick one at random
  const picked = eligible[Math.floor(Math.random() * eligible.length)]
  let text = picked.text

  // Fill placeholders
  text = text.replace(/\{facts\}/g, String(facts))
  text = text.replace(/\{users\}/g, String(users))
  text = text.replace(/\{chunks\}/g, String(worldChunks))

  engine.lastNarrationFrame = frame
  engine.activeNarrative = text
  return text
}

/**
 * Handle chat commands that trigger narrative responses.
 */
export function handleNarrativeCommand(
  text: string,
  username: string,
  engine: NarrativeEngine,
  robotX: number,
): string | null {
  const trimmed = text.trim().toLowerCase()

  // !lore — random lore entry
  if (trimmed === '!lore') {
    if (engine.worldLore.length === 0) return 'No lore yet. The world is still young.'
    const entry = engine.worldLore[Math.floor(Math.random() * engine.worldLore.length)]
    return `[${entry.category.toUpperCase()}] "${entry.title}" — ${entry.content}`
  }

  // !story — story of current location
  if (trimmed === '!story') {
    const key = `chunk${Math.floor(robotX / 576)}`  // 576 = CHUNK_WIDTH * TILE_SIZE
    const story = engine.locationStories.get(key)
    const name = namedLocations.get(key)
    if (story) {
      return name ? `${name}: ${story}` : story
    }
    return 'No story for this place yet. Keep walking — every chunk has a tale.'
  }

  // !history — world history summary
  if (trimmed === '!history') {
    const origins = engine.worldLore.filter(l => l.category === 'origin').length
    const discoveries = engine.discoveries.length
    const locations = engine.locationStories.size
    const named = namedLocations.size

    const lines = [
      `World History: ${engine.worldLore.length} lore entries`,
      `  Origins: ${origins} creation stories`,
      `  Discoveries: ${discoveries} things found`,
      `  Locations explored: ${locations} chunks`,
      `  Named places: ${named}`,
    ]

    if (engine.discoveries.length > 0) {
      const recent = engine.discoveries.slice(-3)
      lines.push('  Recent discoveries:')
      for (const d of recent) {
        lines.push(`    - ${d.what} at chunk ${d.where} (found by ${d.narrator})`)
      }
    }

    return lines.join('\n')
  }

  // !name <place> — name the current location
  if (trimmed.startsWith('!name ')) {
    const placeName = text.trim().slice(6).trim()
    if (!placeName) return 'Usage: !name <place name>'
    if (placeName.length > 40) return 'Name too long. Keep it under 40 characters.'

    const key = `chunk${Math.floor(robotX / 576)}`
    namedLocations.set(key, placeName)

    // Add as lore
    const loreEntry: LoreEntry = {
      title: placeName,
      content: `This place was named "${placeName}" by @${username}. Names give meaning to coordinates.`,
      category: 'history',
      location: robotX,
      timestamp: Date.now(),
    }
    engine.worldLore.push(loreEntry)

    return `This place is now called "${placeName}". Named by @${username}. It will be remembered.`
  }

  return null
}

// ─── Persistence ──────────────────────────────────────────────

/**
 * Save narrative state to ~/.kbot/narrative-state.json.
 */
export function saveNarrative(engine: NarrativeEngine): void {
  try {
    const dir = join(homedir(), '.kbot')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    // Convert Map to Record for JSON serialization
    const locationObj: Record<string, string> = {}
    for (const [k, v] of engine.locationStories) {
      locationObj[k] = v
    }

    const serialized: NarrativeStateSerialized = {
      worldLore: engine.worldLore,
      activeNarrative: engine.activeNarrative,
      narrativeQueue: engine.narrativeQueue,
      locationStories: locationObj,
      discoveries: engine.discoveries,
      lastNarrationFrame: engine.lastNarrationFrame,
    }

    writeFileSync(STATE_PATH, JSON.stringify(serialized, null, 2), 'utf-8')
  } catch {
    // Non-fatal — narrative can rebuild from origin lore
  }
}

/**
 * Load narrative state from disk. Returns null if no saved state.
 */
export function loadNarrative(): NarrativeEngine | null {
  try {
    if (!existsSync(STATE_PATH)) return null
    const raw = readFileSync(STATE_PATH, 'utf-8')
    const data = JSON.parse(raw) as NarrativeStateSerialized

    // Rebuild Map from Record
    const locationMap = new Map<string, string>()
    if (data.locationStories) {
      for (const [k, v] of Object.entries(data.locationStories)) {
        locationMap.set(k, v)
      }
    }

    return {
      worldLore: data.worldLore ?? [],
      activeNarrative: data.activeNarrative ?? null,
      narrativeQueue: data.narrativeQueue ?? [],
      locationStories: locationMap,
      discoveries: data.discoveries ?? [],
      lastNarrationFrame: data.lastNarrationFrame ?? 0,
    }
  } catch {
    return null
  }
}

/**
 * Create a fresh NarrativeEngine with origin lore.
 */
export function createNarrativeEngine(): NarrativeEngine {
  return {
    worldLore: generateOriginLore(),
    activeNarrative: null,
    narrativeQueue: [],
    locationStories: new Map(),
    discoveries: [],
    lastNarrationFrame: 0,
  }
}

// ─── Tool Registration ────────────────────────────────────────

export function registerNarrativeEngineTools(): void {

  // ── narrative_lore ──
  registerTool({
    name: 'narrative_lore',
    description: 'Get world lore — origin stories, discovery records, and location narratives. Returns the narrative engine\'s accumulated lore entries. Use "category" to filter by type (origin, history, mystery, legend, discovery). Use "generate_origins" to create fresh origin lore for a new world.',
    parameters: {
      category: {
        type: 'string',
        description: 'Filter by lore category: origin, history, mystery, legend, discovery. Omit for all.',
        required: false,
      },
      generate_origins: {
        type: 'boolean',
        description: 'If true, generate fresh origin lore (for new world creation).',
        required: false,
        default: false,
      },
      location_story: {
        type: 'object',
        description: 'Generate a location story: { worldX: number, biome: string, features: string[] }',
        required: false,
        properties: {
          worldX: { type: 'number', description: 'World X coordinate' },
          biome: { type: 'string', description: 'Biome type (desert, forest, tundra, etc.)' },
          features: { type: 'array', description: 'Features present (trees, water, cave, ore, flat, high)' },
        },
      },
      discovery: {
        type: 'object',
        description: 'Narrate a discovery: { what: string, where: number, who: string }',
        required: false,
        properties: {
          what: { type: 'string', description: 'What was found' },
          where: { type: 'number', description: 'World X coordinate' },
          who: { type: 'string', description: 'Who found it (username or "kbot")' },
        },
      },
    },
    tier: 'free',
    execute: async (args) => {
      // Load or create engine
      let engine = loadNarrative()
      if (!engine) engine = createNarrativeEngine()

      // Generate origin lore
      if (args.generate_origins) {
        const origins = generateOriginLore()
        engine.worldLore.push(...origins)
        saveNarrative(engine)
        return origins.map(o => `[${o.category.toUpperCase()}] "${o.title}" — ${o.content}`).join('\n\n')
      }

      // Generate location story
      if (args.location_story) {
        const loc = args.location_story as { worldX?: number; biome?: string; features?: string[] }
        const worldX = loc.worldX ?? 0
        const biome = loc.biome ?? 'plains'
        const features = loc.features ?? []
        const story = generateLocationStory(worldX, biome, features)
        const key = `chunk${Math.floor(worldX / 576)}`
        engine.locationStories.set(key, story)
        saveNarrative(engine)
        return story
      }

      // Narrate discovery
      if (args.discovery) {
        const disc = args.discovery as { what?: string; where?: number; who?: string }
        const discovery = narrateDiscovery(
          disc.what ?? 'something unknown',
          disc.where ?? 0,
          disc.who ?? 'kbot',
        )
        engine.discoveries.push(discovery)

        // Also create a lore entry
        engine.worldLore.push({
          title: `Discovery: ${discovery.what}`,
          content: discovery.lore,
          category: 'discovery',
          location: discovery.where,
          timestamp: discovery.when,
        })

        saveNarrative(engine)
        return discovery.lore
      }

      // Filter and return lore
      const category = args.category as string | undefined
      const lore = category
        ? engine.worldLore.filter(l => l.category === category)
        : engine.worldLore

      if (lore.length === 0) {
        return category
          ? `No ${category} lore yet. The world is still writing its story.`
          : 'No lore yet. Use generate_origins=true to create the world\'s origin stories.'
      }

      return lore.map(l => `[${l.category.toUpperCase()}] "${l.title}" — ${l.content}`).join('\n\n')
    },
  })

  // ── narrative_history ──
  registerTool({
    name: 'narrative_history',
    description: 'Get the world\'s full narrative history — discoveries, named locations, narration stats, and timeline. Use "command" to trigger chat-style narrative actions (!lore, !story, !history, !name).',
    parameters: {
      command: {
        type: 'string',
        description: 'Chat command to execute: !lore, !story, !history, or !name <place>',
        required: false,
      },
      username: {
        type: 'string',
        description: 'Username for commands that need one (e.g., !name)',
        required: false,
        default: 'kbot',
      },
      robot_x: {
        type: 'number',
        description: 'Robot\'s current X position in world pixels (for location-aware commands)',
        required: false,
        default: 0,
      },
      tick: {
        type: 'object',
        description: 'Trigger a narrative tick: { frame: number, mood: string, facts: number, users: number }',
        required: false,
        properties: {
          frame: { type: 'number', description: 'Current frame number' },
          mood: { type: 'string', description: 'Robot mood (curious, calm, restless, content)' },
          facts: { type: 'number', description: 'Number of facts in robot brain' },
          users: { type: 'number', description: 'Number of current viewers' },
        },
      },
    },
    tier: 'free',
    execute: async (args) => {
      let engine = loadNarrative()
      if (!engine) engine = createNarrativeEngine()

      const robotX = (args.robot_x as number) ?? 0
      const username = (args.username as string) ?? 'kbot'

      // Handle chat command
      if (args.command) {
        const result = handleNarrativeCommand(
          args.command as string,
          username,
          engine,
          robotX,
        )
        saveNarrative(engine)
        return result ?? 'Unknown command. Try: !lore, !story, !history, !name <place>'
      }

      // Handle narrative tick
      if (args.tick) {
        const tick = args.tick as { frame?: number; mood?: string; facts?: number; users?: number }
        const line = tickNarrative(
          engine,
          tick.frame ?? 0,
          robotX,
          tick.mood ?? 'calm',
          tick.facts ?? 0,
          tick.users ?? 0,
        )
        saveNarrative(engine)
        return line ?? '(No narration this tick — cooldown active or queue empty.)'
      }

      // Default: full history summary
      const origins = engine.worldLore.filter(l => l.category === 'origin').length
      const histories = engine.worldLore.filter(l => l.category === 'history').length
      const mysteries = engine.worldLore.filter(l => l.category === 'mystery').length
      const legends = engine.worldLore.filter(l => l.category === 'legend').length
      const discoveryLore = engine.worldLore.filter(l => l.category === 'discovery').length

      const lines = [
        'Narrative Engine — World History',
        '════════════════════════════════',
        `Total lore entries: ${engine.worldLore.length}`,
        `  Origins: ${origins}`,
        `  History: ${histories}`,
        `  Mysteries: ${mysteries}`,
        `  Legends: ${legends}`,
        `  Discoveries: ${discoveryLore}`,
        '',
        `Locations explored: ${engine.locationStories.size} chunks`,
        `Named places: ${namedLocations.size}`,
        `Discoveries logged: ${engine.discoveries.length}`,
        `Narrative queue depth: ${engine.narrativeQueue.length}`,
        `Active narration: ${engine.activeNarrative ?? '(none)'}`,
        `Last narration frame: ${engine.lastNarrationFrame}`,
      ]

      if (engine.discoveries.length > 0) {
        lines.push('', 'Recent Discoveries:')
        const recent = engine.discoveries.slice(-5)
        for (const d of recent) {
          lines.push(`  [${new Date(d.when).toLocaleDateString()}] ${d.what} at chunk ${d.where} — found by ${d.narrator}`)
        }
      }

      return lines.join('\n')
    },
  })

}
