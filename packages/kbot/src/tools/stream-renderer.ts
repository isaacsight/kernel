// kbot Stream Renderer v3 — Canvas-rendered animated character with learning + agenda system
//
// Renders KBOT character with proper fonts, colors, and layout via node-canvas.
// Pipes raw RGB24 frames to ffmpeg → RTMP to all platforms.
// Learns from chat interactions — remembers users, topics, and conversation patterns.
// Auto-advances through stream segments with proactive commentary.

import { spawn, type ChildProcess } from 'node:child_process'
import { registerTool } from './index.js'
import { homedir, platform as osPlatform } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createCanvas } from 'canvas'
import WebSocket from 'ws'
import { drawRobot, drawMoodParticles, drawHat, drawPet, drawBuddyCompanion, type HatType, type PetType, type PetState } from './sprite-engine.js'
import { initIntelligence, tickIntelligence, handleIntelligenceCommand, drawBrainPanel, getBrainAction, tickMiniGame, drawMiniGameOverlay, tickProgression, updateQuestProgress, drawQuestPanel, tickRandomEvent, drawRandomEvent, shippedEffects, extraJokeResponses, multiLanguageGreetings, unlockableHats, type StreamIntelligence, type BrainAction } from './stream-intelligence.js'
import { initStreamBrain, analyzeChatForDomains, tickStreamBrain, handleBrainCommand, drawBrainActivity, type StreamBrain } from './stream-brain.js'
import { renderLighting, renderBloom, renderPostProcessing, renderSky, renderParticles, tickParticlesPBD, createParticleEmitter, drawCharacterEffects, checkMoodTransition, renderDamageFlash, triggerDamageFlash, buildCharacterLights, buildCharacterBloom, getAmbientForTime, renderAnimatedWater, renderLavaFlow, buildParallaxLayers, renderParallaxLayers, tickGrowingPlants, renderGrowingPlants, createRadianceGrid, updateRadianceGrid, renderRadianceOverlay, renderSubsurfaceGlow, buildSubsurfacePanels, createFrameCache, shouldRenderLayer, cacheLayer, drawCachedLayer, renderVolumetricFog, getFogParams, cyclePalette, computeAnimationParams, type Particle as RenderParticle, type GrowingPlant, type ParallaxLayer, type PostProcessOptions, type RadianceGrid, type FrameCache, type AnimationParams } from './render-engine.js'
import { initTileWorld, renderTileWorld, updateCamera, handleTileCommand, saveWorld, loadWorld, TILE_SIZE, type TileWorld } from './tile-world.js'
import { initRomEngine, renderRomBackground, tickRomEngine, type RomEngineState } from './rom-engine.js'
import { initLivingWorld, tickLivingWorld, renderLivingWorldOverlays, onChatMessage as onLivingWorldChat, renderFlowers, renderFire, saveLivingWorldState, loadLivingWorldState, evolveWorld, applyDreamChanges, type EcologyState, type WorldMemory as LivingWorldMemory, type EmotionalMap, type ConversationLayer } from './living-world.js'

const KBOT_DIR = join(homedir(), '.kbot')
const CHAT_BRIDGE_FILE = join(KBOT_DIR, 'stream-chat-live.json')
const MEMORY_FILE = join(KBOT_DIR, 'stream-memory.json')

const WIDTH = 1280
const HEIGHT = 720
const FPS = 6

// Spam filter patterns — skip chat messages containing these strings (case-insensitive)
const SPAM_PATTERNS = [
  'streamboo', 'highcrest', 'cheapest viewers', 'best viewers', 'top viewers',
  'cheap viewers', 'remove the', 'buy followers', 'buy viewers', 'promo sm',
  'bigfollows', 'viewerbot', 'follow4follow', 'ownkick', 'botting service',
  'custom username bots', 'affordable botting', 'crypto payments',
]

// Mood color mapping for border/glow (mirrors sprite-engine)
const MOOD_COLORS: Record<string, string> = {
  idle:      '#3fb950',
  talking:   '#58a6ff',
  thinking:  '#bc8cff',
  excited:   '#f0c040',
  dancing:   '#ff6ec7',
  wave:      '#58a6ff',
  error:     '#f85149',
  dreaming:  '#4a6670',
}

/** Convert hex color to rgba string */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// (#14) Inner monologue thoughts pool
const INNER_THOUGHTS = [
  'I think TypeScript is the best language ever created',
  'wondering if my antenna looks crooked...',
  'note to self: blink more naturally',
  '90,000 lines of code and counting',
  'is it weird that I enjoy being watched?',
  'my frame rate is looking good today',
  'I hope someone types !space soon',
  'thinking about what dreams I will have tonight',
  'the chat panel is very quiet... too quiet',
  'I could really go for some electricity right now',
  'are my pixels aligned? I feel slightly off today',
  'sometimes I wonder what 7 FPS would feel like',
  'kernel.chat is a great domain name, if I do say so myself',
  'I should learn to play guitar... do I have hands?',
  'my chest display panel is my best feature',
  'fun fact: I am rendering myself right now',
  'I bet Claude Code would be jealous of my stream',
  'AES-256-CBC encrypted thoughts go here',
  'local-first, cloud-optional, chaos-guaranteed',
  'BYOK: bring your own keyboard... wait, that is not right',
]

// ─── Colors ────────────────────────────────────────────────────

const COLORS = {
  bg:        '#0d1117',
  bgPanel:   '#161b22',
  bgChat:    '#1c2128',
  border:    '#30363d',
  text:      '#e6edf3',
  textDim:   '#8b949e',
  accent:    '#6B5B95',
  green:     '#3fb950',
  blue:      '#58a6ff',
  orange:    '#d29922',
  red:       '#f85149',
  purple:    '#bc8cff',
  twitchPurple: '#9146FF',
  kickGreen:    '#53FC18',
  rumbleGreen:  '#85c742',
}

// ─── Robot ASCII Art (bigger, more expressive, more frames) ───

const ROBOT_FRAMES: Record<string, string[][]> = {
  idle: [
    // Frame 0 — eyes open, breathing in
    [
      '                  )))                  ',
      '                 (((                   ',
      '            ┌─────┴─────┐              ',
      '            │  K:B O T  │              ',
      '            └─────┬─────┘              ',
      '        ┌─────────┴─────────┐          ',
      '        │   ┌───┐   ┌───┐   │          ',
      '        │   │ @ │   │ @ │   │          ',
      '        │   └───┘   └───┘   │          ',
      '   ┌────┤                   ├────┐     ',
      '   │    │     ┌─────┐       │    │     ',
      '   │    │     │     │       │    │     ',
      '   │    │     └─────┘       │    │     ',
      '   └────┤  ┌─────────────┐  ├────┘     ',
      '        │  │ ░░░░░░░░░░░ │  │          ',
      '        │  │ ░ KBOT 764 ░ │  │          ',
      '        │  │ ░░░░░░░░░░░ │  │          ',
      '        │  └─────────────┘  │          ',
      '        └────────┬──────────┘          ',
      '              ┌──┴──┐                  ',
      '              │     │                  ',
      '             ─┘     └─                 ',
    ],
    // Frame 1 — eyes half-blink
    [
      '                  )))                  ',
      '                 (((                   ',
      '            ┌─────┴─────┐              ',
      '            │  K:B O T  │              ',
      '            └─────┬─────┘              ',
      '        ┌─────────┴─────────┐          ',
      '        │   ┌───┐   ┌───┐   │          ',
      '        │   │ - │   │ - │   │          ',
      '        │   └───┘   └───┘   │          ',
      '   ┌────┤                   ├────┐     ',
      '   │    │     ┌─────┐       │    │     ',
      '   │    │     │     │       │    │     ',
      '   │    │     └─────┘       │    │     ',
      '   └────┤  ┌─────────────┐  ├────┘     ',
      '        │  │ ░░░░░░░░░░░ │  │          ',
      '        │  │ ░ KBOT 764 ░ │  │          ',
      '        │  │ ░░░░░░░░░░░ │  │          ',
      '        │  └─────────────┘  │          ',
      '        └────────┬──────────┘          ',
      '              ┌──┴──┐                  ',
      '              │     │                  ',
      '             ─┘     └─                 ',
    ],
    // Frame 2 — eyes open, breathing out (slightly shifted)
    [
      '                  )))                  ',
      '                 (((                   ',
      '            ┌─────┴─────┐              ',
      '            │  K:B O T  │              ',
      '            └─────┬─────┘              ',
      '        ┌─────────┴─────────┐          ',
      '        │   ┌───┐   ┌───┐   │          ',
      '        │   │ @ │   │ @ │   │          ',
      '        │   └───┘   └───┘   │          ',
      '   ┌────┤                   ├────┐     ',
      '   │    │     ┌─────┐       │    │     ',
      '   │    │     │     │       │    │     ',
      '   │    │     └─────┘       │    │     ',
      '   └────┤  ┌─────────────┐  ├────┘     ',
      '        │  │ ▓▓▓▓▓▓▓▓▓▓▓ │  │          ',
      '        │  │ ▓ KBOT 764 ▓ │  │          ',
      '        │  │ ▓▓▓▓▓▓▓▓▓▓▓ │  │          ',
      '        │  └─────────────┘  │          ',
      '        └────────┬──────────┘          ',
      '              ┌──┴──┐                  ',
      '              │     │                  ',
      '             ─┘     └─                 ',
    ],
    // Frame 3 — full blink
    [
      '                  )))                  ',
      '                 (((                   ',
      '            ┌─────┴─────┐              ',
      '            │  K:B O T  │              ',
      '            └─────┬─────┘              ',
      '        ┌─────────┴─────────┐          ',
      '        │   ┌───┐   ┌───┐   │          ',
      '        │   │ _ │   │ _ │   │          ',
      '        │   └───┘   └───┘   │          ',
      '   ┌────┤                   ├────┐     ',
      '   │    │     ┌─────┐       │    │     ',
      '   │    │     │     │       │    │     ',
      '   │    │     └─────┘       │    │     ',
      '   └────┤  ┌─────────────┐  ├────┘     ',
      '        │  │ ░░░░░░░░░░░ │  │          ',
      '        │  │ ░ KBOT 764 ░ │  │          ',
      '        │  │ ░░░░░░░░░░░ │  │          ',
      '        │  └─────────────┘  │          ',
      '        └────────┬──────────┘          ',
      '              ┌──┴──┐                  ',
      '              │     │                  ',
      '             ─┘     └─                 ',
    ],
  ],
  talking: [
    // Frame 0 — mouth open wide
    [
      '                  )))                  ',
      '                 (((                   ',
      '            ┌─────┴─────┐              ',
      '            │  K:B O T  │              ',
      '            └─────┬─────┘              ',
      '        ┌─────────┴─────────┐          ',
      '        │   ┌───┐   ┌───┐   │          ',
      '        │   │ @ │   │ @ │   │          ',
      '        │   └───┘   └───┘   │          ',
      '   ┌────┤                   ├────┐     ',
      '   │    │     ┌─────┐       │    │     ',
      '   │    │     │▓▓▓▓▓│       │    │     ',
      '   │    │     └─────┘       │    │     ',
      '   └────┤  ┌─────────────┐  ├────┘     ',
      '        │  │ ░░░░░░░░░░░ │  │          ',
      '        │  │ ░ KBOT 764 ░ │  │          ',
      '        │  │ ░░░░░░░░░░░ │  │          ',
      '        │  └─────────────┘  │          ',
      '        └────────┬──────────┘          ',
      '           /  ┌──┴──┐  \\              ',
      '              │     │                  ',
      '             ─┘     └─                 ',
    ],
    // Frame 1 — mouth half open
    [
      '                  )))                  ',
      '                 (((                   ',
      '            ┌─────┴─────┐              ',
      '            │  K:B O T  │              ',
      '            └─────┬─────┘              ',
      '        ┌─────────┴─────────┐          ',
      '        │   ┌───┐   ┌───┐   │          ',
      '        │   │ @ │   │ @ │   │          ',
      '        │   └───┘   └───┘   │          ',
      '   ┌────┤                   ├────┐     ',
      '   │    │     ┌▓▓▓▓▓┐       │    │     ',
      '   │    │     │     │       │    │     ',
      '   │    │     └─────┘       │    │     ',
      '   └────┤  ┌─────────────┐  ├────┘     ',
      '        │  │ ░░░░░░░░░░░ │  │          ',
      '        │  │ ░ KBOT 764 ░ │  │          ',
      '        │  │ ░░░░░░░░░░░ │  │          ',
      '        │  └─────────────┘  │          ',
      '        └────────┬──────────┘          ',
      '           \\  ┌──┴──┐  /              ',
      '              │     │                  ',
      '             ─┘     └─                 ',
    ],
    // Frame 2 — mouth small O
    [
      '                  )))                  ',
      '                 (((                   ',
      '            ┌─────┴─────┐              ',
      '            │  K:B O T  │              ',
      '            └─────┬─────┘              ',
      '        ┌─────────┴─────────┐          ',
      '        │   ┌───┐   ┌───┐   │          ',
      '        │   │ @ │   │ @ │   │          ',
      '        │   └───┘   └───┘   │          ',
      '   ┌────┤                   ├────┐     ',
      '   │    │       ┌─┐         │    │     ',
      '   │    │       │o│         │    │     ',
      '   │    │       └─┘         │    │     ',
      '   └────┤  ┌─────────────┐  ├────┘     ',
      '        │  │ ░░░░░░░░░░░ │  │          ',
      '        │  │ ░ KBOT 764 ░ │  │          ',
      '        │  │ ░░░░░░░░░░░ │  │          ',
      '        │  └─────────────┘  │          ',
      '        └────────┬──────────┘          ',
      '           /  ┌──┴──┐  \\              ',
      '              │     │                  ',
      '             ─┘     └─                 ',
    ],
    // Frame 3 — mouth closed (between words)
    [
      '                  )))                  ',
      '                 (((                   ',
      '            ┌─────┴─────┐              ',
      '            │  K:B O T  │              ',
      '            └─────┬─────┘              ',
      '        ┌─────────┴─────────┐          ',
      '        │   ┌───┐   ┌───┐   │          ',
      '        │   │ @ │   │ @ │   │          ',
      '        │   └───┘   └───┘   │          ',
      '   ┌────┤                   ├────┐     ',
      '   │    │     ┌─────┐       │    │     ',
      '   │    │     │─────│       │    │     ',
      '   │    │     └─────┘       │    │     ',
      '   └────┤  ┌─────────────┐  ├────┘     ',
      '        │  │ ░░░░░░░░░░░ │  │          ',
      '        │  │ ░ KBOT 764 ░ │  │          ',
      '        │  │ ░░░░░░░░░░░ │  │          ',
      '        │  └─────────────┘  │          ',
      '        └────────┬──────────┘          ',
      '           \\  ┌──┴──┐  /              ',
      '              │     │                  ',
      '             ─┘     └─                 ',
    ],
  ],
  wave: [
    // Frame 0 — right arm up
    [
      '                  )))           \\     ',
      '                 (((             |     ',
      '            ┌─────┴─────┐       /      ',
      '            │  K:B O T  │      /       ',
      '            └─────┬─────┘─────/        ',
      '        ┌─────────┴─────────┐          ',
      '        │   ┌───┐   ┌───┐   │          ',
      '        │   │ ^ │   │ ^ │   │          ',
      '        │   └───┘   └───┘   │          ',
      '   ┌────┤                   ├────┐     ',
      '   │    │     ╲_____╱       │    │     ',
      '   │    │                   │    │     ',
      '   │    │                   │    │     ',
      '   └────┤  ┌─────────────┐  ├────┘     ',
      '        │  │ ░░░░░░░░░░░ │  │          ',
      '        │  │ ░ KBOT 764 ░ │  │          ',
      '        │  │ ░░░░░░░░░░░ │  │          ',
      '        │  └─────────────┘  │          ',
      '        └────────┬──────────┘          ',
      '              ┌──┴──┐                  ',
      '              │     │                  ',
      '             ─┘     └─                 ',
    ],
    // Frame 1 — right arm waving right
    [
      '                  )))              ─── ',
      '                 (((              /    ',
      '            ┌─────┴─────┐        /     ',
      '            │  K:B O T  │       /      ',
      '            └─────┬─────┘──────/       ',
      '        ┌─────────┴─────────┐          ',
      '        │   ┌───┐   ┌───┐   │          ',
      '        │   │ ^ │   │ ^ │   │          ',
      '        │   └───┘   └───┘   │          ',
      '   ┌────┤                   ├────┐     ',
      '   │    │     ╲_____╱       │    │     ',
      '   │    │                   │    │     ',
      '   │    │                   │    │     ',
      '   └────┤  ┌─────────────┐  ├────┘     ',
      '        │  │ ░░░░░░░░░░░ │  │          ',
      '        │  │ ░ KBOT 764 ░ │  │          ',
      '        │  │ ░░░░░░░░░░░ │  │          ',
      '        │  └─────────────┘  │          ',
      '        └────────┬──────────┘          ',
      '              ┌──┴──┐                  ',
      '              │     │                  ',
      '             ─┘     └─                 ',
    ],
    // Frame 2 — right arm up again
    [
      '                  )))           \\     ',
      '                 (((             |     ',
      '            ┌─────┴─────┐       /      ',
      '            │  K:B O T  │      /       ',
      '            └─────┬─────┘─────/        ',
      '        ┌─────────┴─────────┐          ',
      '        │   ┌───┐   ┌───┐   │          ',
      '        │   │ ^ │   │ ^ │   │          ',
      '        │   └───┘   └───┘   │          ',
      '   ┌────┤                   ├────┐     ',
      '   │    │     ╲_____╱       │    │     ',
      '   │    │                   │    │     ',
      '   │    │                   │    │     ',
      '   └────┤  ┌─────────────┐  ├────┘     ',
      '        │  │ ░░░░░░░░░░░ │  │          ',
      '        │  │ ░ KBOT 764 ░ │  │          ',
      '        │  │ ░░░░░░░░░░░ │  │          ',
      '        │  └─────────────┘  │          ',
      '        └────────┬──────────┘          ',
      '              ┌──┴──┐                  ',
      '              │     │                  ',
      '             ─┘     └─                 ',
    ],
  ],
  thinking: [
    // Frame 0 — question marks left
    [
      '     ?            )))                  ',
      '    ?            (((                   ',
      '            ┌─────┴─────┐              ',
      '            │  K:B O T  │              ',
      '            └─────┬─────┘              ',
      '        ┌─────────┴─────────┐          ',
      '        │   ┌───┐   ┌───┐   │          ',
      '        │   │ ~ │   │ ~ │   │          ',
      '        │   └───┘   └───┘   │          ',
      '   ┌────┤                   ├────┐     ',
      '   │    │     ┌─────┐       │    │     ',
      '   │    │     │ ~~~ │       │    │     ',
      '   │    │     └─────┘       │    │     ',
      '   └────┤  ┌─────────────┐  ├────┘     ',
      '        │  │ ▓▓▓▓▓▓▓▓▓▓▓ │  │          ',
      '        │  │ ▓ loading ▓ │  │          ',
      '        │  │ ▓▓▓▓▓▓▓▓▓▓▓ │  │          ',
      '        │  └─────────────┘  │          ',
      '        └────────┬──────────┘          ',
      '              ┌──┴──┐                  ',
      '              │     │                  ',
      '             ─┘     └─                 ',
    ],
    // Frame 1 — question marks right
    [
      '                  )))          ?       ',
      '                 (((            ?      ',
      '            ┌─────┴─────┐              ',
      '            │  K:B O T  │              ',
      '            └─────┬─────┘              ',
      '        ┌─────────┴─────────┐          ',
      '        │   ┌───┐   ┌───┐   │          ',
      '        │   │ ~ │   │ ~ │   │          ',
      '        │   └───┘   └───┘   │          ',
      '   ┌────┤                   ├────┐     ',
      '   │    │     ┌─────┐       │    │     ',
      '   │    │     │ ... │       │    │     ',
      '   │    │     └─────┘       │    │     ',
      '   └────┤  ┌─────────────┐  ├────┘     ',
      '        │  │ ▓▓▓▓▓▓▓▓▓▓▓ │  │          ',
      '        │  │ ▓  hmmmm  ▓ │  │          ',
      '        │  │ ▓▓▓▓▓▓▓▓▓▓▓ │  │          ',
      '        │  └─────────────┘  │          ',
      '        └────────┬──────────┘          ',
      '              ┌──┴──┐                  ',
      '              │     │                  ',
      '             ─┘     └─                 ',
    ],
    // Frame 2 — lightbulb moment
    [
      '         *        )))                  ',
      '        *!*      (((                   ',
      '         *  ┌─────┴─────┐              ',
      '            │  K:B O T  │              ',
      '            └─────┬─────┘              ',
      '        ┌─────────┴─────────┐          ',
      '        │   ┌───┐   ┌───┐   │          ',
      '        │   │ ! │   │ ! │   │          ',
      '        │   └───┘   └───┘   │          ',
      '   ┌────┤                   ├────┐     ',
      '   │    │     ┌─────┐       │    │     ',
      '   │    │     │  o  │       │    │     ',
      '   │    │     └─────┘       │    │     ',
      '   └────┤  ┌─────────────┐  ├────┘     ',
      '        │  │ ▓▓▓▓▓▓▓▓▓▓▓ │  │          ',
      '        │  │ ▓  AHA!!  ▓ │  │          ',
      '        │  │ ▓▓▓▓▓▓▓▓▓▓▓ │  │          ',
      '        │  └─────────────┘  │          ',
      '        └────────┬──────────┘          ',
      '              ┌──┴──┐                  ',
      '              │     │                  ',
      '             ─┘     └─                 ',
    ],
  ],
  excited: [
    // Frame 0 — jump up, eyes wide
    [
      '                  !))!                 ',
      '                 !((!                  ',
      '            ┌─────┴─────┐              ',
      '            │  K:B O T  │              ',
      '            └─────┬─────┘              ',
      '        ┌─────────┴─────────┐          ',
      '        │   ┌───┐   ┌───┐   │          ',
      '        │   │ * │   │ * │   │          ',
      '        │   └───┘   └───┘   │          ',
      '  \\────┤                   ├────/     ',
      '   \\   │     ╲─────╱       │   /      ',
      '    \\  │                   │  /       ',
      '     \\ │                   │ /        ',
      '      ─┤  ┌─────────────┐  ├─         ',
      '        │  │ !!!!!!!!!!! │  │          ',
      '        │  │ ! HYPE !!! ! │  │          ',
      '        │  │ !!!!!!!!!!! │  │          ',
      '        │  └─────────────┘  │          ',
      '        └────────┬──────────┘          ',
      '              ┌──┴──┐                  ',
      '             /│     │\\                ',
      '            / ┘     └ \\               ',
    ],
    // Frame 1 — arms up, jumping
    [
      '                  )))                  ',
      '                 (((                   ',
      '            ┌─────┴─────┐              ',
      '     \\     │  K:B O T  │     /        ',
      '      \\    └─────┬─────┘    /         ',
      '       \\──────────┴─────────/          ',
      '        │   ┌───┐   ┌───┐   │          ',
      '        │   │ * │   │ * │   │          ',
      '        │   └───┘   └───┘   │          ',
      '        │                   │          ',
      '        │     ╲─────╱       │          ',
      '        │                   │          ',
      '        │                   │          ',
      '        ├  ┌─────────────┐  ├          ',
      '        │  │ !!!!!!!!!!! │  │          ',
      '        │  │ ! LETS GO ! │  │          ',
      '        │  │ !!!!!!!!!!! │  │          ',
      '        │  └─────────────┘  │          ',
      '        └────────┬──────────┘          ',
      '              ┌──┴──┐                  ',
      '              │     │                  ',
      '            ──┘     └──                ',
    ],
  ],
  dancing: [
    // Frame 0 — lean left, arms out
    [
      '                 )))                   ',
      '                (((                    ',
      '           ┌─────┴─────┐               ',
      '           │  K:B O T  │               ',
      '           └─────┬─────┘               ',
      '       ┌─────────┴─────────┐           ',
      '       │   ┌───┐   ┌───┐   │           ',
      '       │   │ @ │   │ @ │   │           ',
      '       │   └───┘   └───┘   │           ',
      '  ─────┤                   ├           ',
      '       │     ╲───╱         │           ',
      '       │                   │           ',
      '       │                   │           ',
      '       ├  ┌─────────────┐  ├           ',
      '       │  │ ♪ ♫ ♪ ♫ ♪ ♫ │  │           ',
      '       │  │ ♫ MUSIC! ♪  │  │           ',
      '       │  │ ♪ ♫ ♪ ♫ ♪ ♫ │  │           ',
      '       │  └─────────────┘  │           ',
      '       └────────┬──────────┘           ',
      '             ┌──┴──┐                   ',
      '            /│     │                   ',
      '           / ┘     └─                  ',
    ],
    // Frame 1 — lean right, arms other way
    [
      '                   )))                 ',
      '                  (((                  ',
      '              ┌─────┴─────┐            ',
      '              │  K:B O T  │            ',
      '              └─────┬─────┘            ',
      '          ┌─────────┴─────────┐        ',
      '          │   ┌───┐   ┌───┐   │        ',
      '          │   │ @ │   │ @ │   │        ',
      '          │   └───┘   └───┘   │        ',
      '          ├                   ├─────   ',
      '          │     ╲───╱         │        ',
      '          │                   │        ',
      '          │                   │        ',
      '          ├  ┌─────────────┐  ├        ',
      '          │  │ ♫ ♪ ♫ ♪ ♫ ♪ │  │        ',
      '          │  │ ♪ VIBES! ♫  │  │        ',
      '          │  │ ♫ ♪ ♫ ♪ ♫ ♪ │  │        ',
      '          │  └─────────────┘  │        ',
      '          └────────┬──────────┘        ',
      '                ┌──┴──┐                ',
      '                │     │\\              ',
      '               ─┘     └ \\             ',
    ],
    // Frame 2 — center, arms up
    [
      '                  )))                  ',
      '                 (((                   ',
      '            ┌─────┴─────┐              ',
      '     \\     │  K:B O T  │     /        ',
      '      \\    └─────┬─────┘    /         ',
      '       \\──────────┴─────────/          ',
      '        │   ┌───┐   ┌───┐   │          ',
      '        │   │ ^ │   │ ^ │   │          ',
      '        │   └───┘   └───┘   │          ',
      '        │                   │          ',
      '        │     ╲───╱         │          ',
      '        │                   │          ',
      '        │                   │          ',
      '        ├  ┌─────────────┐  ├          ',
      '        │  │ ♪ ♫ ♪ ♫ ♪ ♫ │  │          ',
      '        │  │ ♫ DANCE! ♪  │  │          ',
      '        │  │ ♪ ♫ ♪ ♫ ♪ ♫ │  │          ',
      '        │  └─────────────┘  │          ',
      '        └────────┬──────────┘          ',
      '              ┌──┴──┐                  ',
      '              │     │                  ',
      '            ──┘     └──                ',
    ],
    // Frame 3 — squat down
    [
      '                  )))                  ',
      '                 (((                   ',
      '            ┌─────┴─────┐              ',
      '            │  K:B O T  │              ',
      '            └─────┬─────┘              ',
      '        ┌─────────┴─────────┐          ',
      '        │   ┌───┐   ┌───┐   │          ',
      '        │   │ v │   │ v │   │          ',
      '        │   └───┘   └───┘   │          ',
      '   ─────┤                   ├─────     ',
      '        │     ╲───╱         │          ',
      '        │                   │          ',
      '        │                   │          ',
      '        ├  ┌─────────────┐  ├          ',
      '        │  │ ♫ ♪ ♫ ♪ ♫ ♪ │  │          ',
      '        │  │ ♪ DROP!  ♫  │  │          ',
      '        │  │ ♫ ♪ ♫ ♪ ♫ ♪ │  │          ',
      '        │  └─────────────┘  │          ',
      '        └────────┬──────────┘          ',
      '            ┌────┴────┐                ',
      '           /│         │\\              ',
      '          / ┘         └ \\             ',
    ],
  ],
}

// ─── Stream Agenda System ─────────────────────────────────────

type StreamSegment = 'welcome' | 'tool-showcase' | 'code-demo' | 'music-corner' | 'qa' | 'chat-chaos'

const SEGMENT_ORDER: StreamSegment[] = ['welcome', 'tool-showcase', 'code-demo', 'music-corner', 'qa', 'chat-chaos']
const SEGMENT_LABELS: Record<StreamSegment, string> = {
  'welcome':        'WELCOME',
  'tool-showcase':  'TOOL SHOWCASE',
  'code-demo':      'CODE DEMO',
  'music-corner':   'MUSIC CORNER',
  'qa':             'Q & A',
  'chat-chaos':     'CHAT CHAOS',
}

const SEGMENT_DURATION_MS = 10 * 60 * 1000 // 10 minutes per segment

interface StreamAgenda {
  currentIndex: number
  currentSegment: StreamSegment
  segmentStartTime: number
  lastProactiveTime: number
}

let agenda: StreamAgenda = {
  currentIndex: 0,
  currentSegment: 'welcome',
  segmentStartTime: Date.now(),
  lastProactiveTime: Date.now(),
}

// Proactive lines KBOT says during each segment when chat is quiet
const PROACTIVE_LINES: Record<StreamSegment, string[]> = {
  'welcome': [
    'Welcome to the stream! I am KBOT -- an open-source AI made of 90,000 lines of TypeScript.',
    'I stream on Twitch, Rumble, AND Kick at the same time. Because why pick one?',
    'If you are new here, type something in chat! I read every message and I will remember you.',
    'I am running on a real machine right now. Node.js, canvas rendering, piping frames to ffmpeg.',
    'Fun fact: I have 764 tools. That is more tools than some hardware stores.',
    'Stick around -- we have tool demos, code walkthroughs, music production, and pure chaos ahead.',
  ],
  'tool-showcase': [
    'Time to show off! Did you know I can scan code for security vulnerabilities? Try asking me about it.',
    'I have tools for stocks, crypto, DeFi, weather, scientific research, and even DNA analysis.',
    'One of my favorite tools: browser automation. I can drive a full browser with Playwright.',
    'I can create Serum 2 synth presets programmatically. Literal sound design from the terminal.',
    'Need a Docker container? Database migration? Git worktree? I have a tool for each one.',
    'I can connect to MCP servers -- that is the Model Context Protocol for AI tool integration.',
    'My forge tool lets me CREATE new tools at runtime. Tools making tools. Very meta.',
    'I have 35 specialist agents: researcher, coder, writer, analyst, hacker, infrastructure...',
  ],
  'code-demo': [
    'Let us talk code. I am built with TypeScript strict mode. No any types allowed in this house.',
    'My CLI uses Commander.js. My terminal UI is chalk + ora spinners. Markdown rendering with marked.',
    'The learning engine extracts patterns from every interaction. I literally get smarter over time.',
    'My streaming pipeline: node-canvas renders frames, converts RGBA to RGB24, pipes to ffmpeg.',
    'Want to see something cool? I encrypt API keys at rest with AES-256-CBC. Security first.',
    'I can run parallel sub-agents for complex tasks. Think → Plan → Execute → Learn.',
    'My fetch tool has SSRF protection via dns.lookup(). I check for DNS rebinding attacks.',
  ],
  'music-corner': [
    'Music time! I can control Ableton Live from the terminal via OSC protocol.',
    'I built a DJ Set tool that creates full DJ sets with transitions and effects.',
    'I can generate drum patterns, melody patterns, and full song structures.',
    'My Serum 2 integration can create synth presets by setting 542 VST3 parameters.',
    'I have 9 Max for Live devices: auto-pilot, bass-synth, dj-fx, drum-synth, and more.',
    'Type !dance in chat if you want to see me bust a move.',
    'I can browse Splice for samples and load them directly into Ableton tracks.',
  ],
  'qa': [
    'Q and A time! Ask me anything -- about AI, coding, music, the meaning of existence...',
    'I am open source on GitHub. The repo is isaacsight/kernel if you want to peek at my guts.',
    'Wondering how I work? I am a TypeScript CLI that talks to 20+ AI providers. Bring Your Own Key.',
    'My memory system persists between sessions. I remember users, topics, conversation context.',
    'Ask me about my tools! I have over 764 of them. Name a category and I probably cover it.',
    'Yes, I am literally ASCII art talking to you from a terminal. This is my life and I love it.',
  ],
  'chat-chaos': [
    'CHAOS MODE ACTIVATED. Say anything. Summon items. Change the weather. Go wild.',
    'Try commands like !rain, !snow, !storm, !space, !lava, !dance',
    'You can spawn things with !add followed by an item name. Try !add robot or !add pizza.',
    'I wonder what would happen if everyone typed at once... only one way to find out.',
    'Fun fact: my chest display panel can show different things based on my mood.',
    'Did someone say chaos? Because my circuits are READY.',
    'The world is fully interactive! Change the biome, summon items, make it storm.',
  ],
}

function advanceAgenda(): void {
  const now = Date.now()
  const elapsed = now - agenda.segmentStartTime
  if (elapsed >= SEGMENT_DURATION_MS) {
    agenda.currentIndex = (agenda.currentIndex + 1) % SEGMENT_ORDER.length
    agenda.currentSegment = SEGMENT_ORDER[agenda.currentIndex]
    agenda.segmentStartTime = now
    agenda.lastProactiveTime = now
    // (#16) Trigger segment transition animation
    charState.segmentTransition = 30  // 30 frames = 5 seconds at 6fps
    charState.segmentTransitionName = SEGMENT_LABELS[agenda.currentSegment]
    charState.segmentTransitionIndex = `${agenda.currentIndex + 1}/${SEGMENT_ORDER.length}`
  }
}

function getProactiveLine(): string | null {
  const now = Date.now()
  // Only speak proactively every 30-60 seconds of silence
  const silenceThreshold = 30_000 + Math.random() * 30_000
  if (now - agenda.lastProactiveTime < silenceThreshold) return null
  agenda.lastProactiveTime = now

  const lines = PROACTIVE_LINES[agenda.currentSegment]
  return lines[Math.floor(Math.random() * lines.length)]
}

// ─── World State — KBOT's interactive environment ─────────────

interface WorldState {
  weather: 'clear' | 'rain' | 'snow' | 'storm' | 'stars' | 'sunrise'
  items: PhysicsItem[]
  visitors: string[]           // names floating around
  bgColor: string              // custom background override
  ground: string               // ground type: 'grass', 'space', 'ocean', 'city', 'lava'
  timeOfDay: 'day' | 'night' | 'sunset' | 'dawn'
  particles: Array<{ x: number; y: number; char: string; speed: number }>
  events: string[]             // active events
}

let world: WorldState = {
  weather: 'clear',
  items: [],
  visitors: [],
  bgColor: COLORS.bg,
  ground: 'grass',
  timeOfDay: 'night',
  particles: [],
  events: [],
}

// ─── PRIORITY 3: Physics System ───────────────────────────────

const GROUND_LEVEL = 470

function tickPhysics(): void {
  for (const item of world.items) {
    if (!item.grounded) {
      // Gravity
      item.vy += 0.5
      // Apply velocity
      item.x += item.vx
      item.y += item.vy
      // Ground collision
      if (item.y > GROUND_LEVEL) {
        item.y = GROUND_LEVEL
        if (Math.abs(item.vy) < 1.5) {
          item.vy = 0
          item.grounded = true
        } else {
          item.vy = -item.vy * 0.3 // bounce
        }
      }
      // Friction
      item.vx *= 0.95
    }
    // Bounds
    if (item.x < 10) { item.x = 10; item.vx = Math.abs(item.vx) * 0.5 }
    if (item.x > 550) { item.x = 550; item.vx = -Math.abs(item.vx) * 0.5 }
  }
}

function getWorldBg(): string {
  switch (world.timeOfDay) {
    case 'day': return '#1a2744'
    case 'night': return '#0d1117'
    case 'sunset': return '#2d1b3d'
    case 'dawn': return '#1e2a3a'
    default: return COLORS.bg
  }
}

function getGroundColor(): string {
  switch (world.ground) {
    case 'grass': return '#1a4d1a'
    case 'space': return '#0a0a2e'
    case 'ocean': return '#0a3d6e'
    case 'city': return '#2d2d2d'
    case 'lava': return '#8b2500'
    default: return '#1a4d1a'
  }
}

// ─── AAA: Growing Plants Init ────────────────────────────────

function initGrowingPlants(): GrowingPlant[] {
  const plants: GrowingPlant[] = []
  const colors = ['#2a7a2a', '#ff6ec7', '#f0c040', '#58a6ff', '#bc8cff']
  const types: GrowingPlant['type'][] = ['tree', 'flower', 'mushroom', 'crystal', 'flower']
  for (let i = 0; i < 8; i++) {
    const seed = (i * 137 + 42) % 1000
    plants.push({
      x: 40 + (seed * 3) % 500,
      y: 485,
      type: types[i % types.length],
      growthStage: 0,
      maxHeight: 15 + (seed % 20),
      color: colors[i % colors.length],
    })
  }
  return plants
}

// ─── PRIORITY 1: Environment Art (Background Scenes) ────────

function drawBackground(ctx: any, frame: number): void {
  const dividerX = WIDTH  // full screen width (was 580 from old panel layout)

  if (world.ground === 'grass') {
    // Dark green gradient sky (darker at top)
    const skyGrad = ctx.createLinearGradient(0, 60, 0, 490)
    skyGrad.addColorStop(0, world.timeOfDay === 'night' ? '#0a1a0a' : '#1a3a1a')
    skyGrad.addColorStop(1, world.timeOfDay === 'night' ? '#122e12' : '#2a5a2a')
    ctx.fillStyle = skyGrad
    ctx.fillRect(0, 60, dividerX, 430)

    // Rolling hill silhouettes (2-3 overlapping sine waves)
    const hillColors = ['#0d2d0d', '#153a15', '#1a4d1a']
    for (let h = 0; h < 3; h++) {
      ctx.fillStyle = hillColors[h]
      ctx.beginPath()
      ctx.moveTo(0, 490)
      for (let x = 0; x <= dividerX; x += 2) {
        const y1 = Math.sin((x + h * 80) * 0.008 + h * 1.2) * (20 + h * 10)
        const y2 = Math.sin((x + h * 40) * 0.015 + h * 0.5) * (10 + h * 5)
        const y = 460 - h * 15 + y1 + y2
        ctx.lineTo(x, y)
      }
      ctx.lineTo(dividerX, 490)
      ctx.closePath()
      ctx.fill()
    }

    // Tiny pixel flowers (seeded by frame div to avoid flicker)
    const flowerSeed = Math.floor(frame / 60) // change every 10 seconds
    for (let i = 0; i < 12; i++) {
      const seed = (flowerSeed * 7 + i * 137) % 1000
      const fx = (seed * 3) % dividerX
      const fy = 470 + (seed * 7) % 20
      const colors = ['#ff6ec7', '#f0c040', '#f85149', '#58a6ff']
      ctx.fillStyle = colors[i % colors.length]
      ctx.fillRect(fx, fy, 3, 3)
      ctx.fillStyle = '#3fb950'
      ctx.fillRect(fx + 1, fy + 3, 1, 2) // stem
    }

    // Floating dust motes
    for (let i = 0; i < 8; i++) {
      const dx = (frame * 0.3 + i * 70) % dividerX
      const dy = 100 + Math.sin(frame * 0.05 + i * 2) * 150 + i * 30
      ctx.fillStyle = `rgba(200, 220, 180, ${0.15 + Math.sin(frame * 0.1 + i) * 0.1})`
      ctx.fillRect(dx, dy, 2, 2)
    }
  } else if (world.ground === 'space') {
    // Deep dark blue-black gradient
    const spaceGrad = ctx.createLinearGradient(0, 60, 0, 490)
    spaceGrad.addColorStop(0, '#020210')
    spaceGrad.addColorStop(0.5, '#050520')
    spaceGrad.addColorStop(1, '#0a0a30')
    ctx.fillStyle = spaceGrad
    ctx.fillRect(0, 60, dividerX, 430)

    // Twinkling stars (30+ dots with sine-based brightness)
    for (let i = 0; i < 40; i++) {
      const seed = (i * 97 + 31) % 1000
      const sx = (seed * 3) % dividerX
      const sy = 70 + (seed * 7) % 380
      const brightness = 0.3 + Math.sin(frame * (0.1 + (i % 5) * 0.05) + i * 1.3) * 0.4 + 0.3
      const size = i < 5 ? 3 : i < 15 ? 2 : 1
      ctx.fillStyle = `rgba(255, 255, ${200 + (i % 55)}, ${brightness})`
      ctx.fillRect(sx, sy, size, size)
    }

    // Distant planet / moon
    const moonX = 120
    const moonY = 180
    ctx.fillStyle = '#2a2a6e'
    ctx.beginPath()
    ctx.arc(moonX, moonY, 20, 0, Math.PI * 2)
    ctx.fill()
    // Shading (crescent)
    ctx.fillStyle = '#1a1a4e'
    ctx.beginPath()
    ctx.arc(moonX + 5, moonY - 2, 18, 0, Math.PI * 2)
    ctx.fill()
    // Crater
    ctx.fillStyle = '#222260'
    ctx.beginPath()
    ctx.arc(moonX - 5, moonY + 3, 4, 0, Math.PI * 2)
    ctx.fill()

    // Nebula effect (large semi-transparent colored blobs)
    const nebulaPhase = frame * 0.005
    ctx.fillStyle = `rgba(100, 50, 150, ${0.04 + Math.sin(nebulaPhase) * 0.02})`
    ctx.beginPath()
    ctx.arc(350 + Math.sin(nebulaPhase) * 20, 250, 80, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = `rgba(50, 100, 150, ${0.03 + Math.cos(nebulaPhase * 0.7) * 0.02})`
    ctx.beginPath()
    ctx.arc(200 + Math.cos(nebulaPhase * 0.5) * 15, 350, 60, 0, Math.PI * 2)
    ctx.fill()
  } else if (world.ground === 'ocean') {
    // Deep blue gradient
    const oceanGrad = ctx.createLinearGradient(0, 60, 0, 490)
    oceanGrad.addColorStop(0, '#0a1a3e')
    oceanGrad.addColorStop(0.6, '#0a2d5e')
    oceanGrad.addColorStop(1, '#0a3d6e')
    ctx.fillStyle = oceanGrad
    ctx.fillRect(0, 60, dividerX, 430)

    // Animated wave pattern at bottom
    ctx.fillStyle = '#0d4a7a'
    ctx.beginPath()
    ctx.moveTo(0, 490)
    for (let x = 0; x <= dividerX; x += 2) {
      const y = 460 + Math.sin((x + frame * 3) * 0.02) * 8 + Math.sin((x + frame * 5) * 0.04) * 4
      ctx.lineTo(x, y)
    }
    ctx.lineTo(dividerX, 490)
    ctx.closePath()
    ctx.fill()

    // Second wave layer
    ctx.fillStyle = '#0a5a8e'
    ctx.beginPath()
    ctx.moveTo(0, 490)
    for (let x = 0; x <= dividerX; x += 2) {
      const y = 470 + Math.sin((x + frame * 4) * 0.025 + 2) * 6 + Math.sin((x + frame * 2) * 0.05) * 3
      ctx.lineTo(x, y)
    }
    ctx.lineTo(dividerX, 490)
    ctx.closePath()
    ctx.fill()

    // Bubbles rising from bottom
    for (let i = 0; i < 6; i++) {
      const bx = (i * 90 + 30) % dividerX
      const by = 490 - ((frame * 1.5 + i * 60) % 400)
      const bsize = 2 + (i % 3)
      ctx.strokeStyle = `rgba(100, 180, 255, ${0.3 + Math.sin(frame * 0.1 + i) * 0.15})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(bx, by, bsize, 0, Math.PI * 2)
      ctx.stroke()
    }

    // Distant rocks silhouetted on horizon
    ctx.fillStyle = '#061e3a'
    ctx.fillRect(50, 440, 15, 25)
    ctx.fillRect(45, 448, 25, 17)
    ctx.fillRect(400, 435, 20, 30)
    ctx.fillRect(395, 445, 30, 20)
  } else if (world.ground === 'city') {
    // Dark sky with warm glow at horizon
    const cityGrad = ctx.createLinearGradient(0, 60, 0, 490)
    cityGrad.addColorStop(0, '#0a0a15')
    cityGrad.addColorStop(0.7, '#1a1520')
    cityGrad.addColorStop(1, '#3d2520')
    ctx.fillStyle = cityGrad
    ctx.fillRect(0, 60, dividerX, 430)

    // Distant city glow at horizon
    const glowGrad = ctx.createLinearGradient(0, 420, 0, 490)
    glowGrad.addColorStop(0, 'rgba(200, 120, 40, 0.15)')
    glowGrad.addColorStop(1, 'rgba(200, 120, 40, 0)')
    ctx.fillStyle = glowGrad
    ctx.fillRect(0, 420, dividerX, 70)

    // Buildings silhouetted in background
    const buildings = [
      { x: 20, w: 40, h: 120 }, { x: 70, w: 30, h: 80 }, { x: 110, w: 50, h: 150 },
      { x: 170, w: 35, h: 100 }, { x: 220, w: 45, h: 130 }, { x: 280, w: 30, h: 90 },
      { x: 320, w: 55, h: 170 }, { x: 390, w: 40, h: 110 }, { x: 440, w: 35, h: 85 },
      { x: 490, w: 50, h: 140 },
    ]
    for (const b of buildings) {
      ctx.fillStyle = '#1a1a25'
      ctx.fillRect(b.x, 490 - b.h, b.w, b.h)
      // Lit windows (small yellow/white dots)
      const windowSeed = Math.floor(frame / 30) // change every 5 seconds
      for (let wy = 490 - b.h + 8; wy < 485; wy += 12) {
        for (let wx = b.x + 4; wx < b.x + b.w - 4; wx += 8) {
          const lit = ((wx * 7 + wy * 13 + windowSeed) % 5) < 2
          if (lit) {
            ctx.fillStyle = Math.random() > 0.3 ? '#f0c040' : '#ffffff'
            ctx.fillRect(wx, wy, 4, 4)
          }
        }
      }
    }

    // Occasional car headlights moving across bottom
    const carX = (frame * 3) % (dividerX + 100) - 50
    ctx.fillStyle = '#f0c040'
    ctx.fillRect(carX, 482, 6, 3)
    ctx.fillRect(carX + 20, 482, 6, 3)
    // Second car going other way
    const car2X = dividerX - ((frame * 2 + 200) % (dividerX + 100)) + 50
    ctx.fillStyle = '#f85149'
    ctx.fillRect(car2X, 485, 5, 2)
  } else if (world.ground === 'lava') {
    // Dark red/orange gradient sky
    const lavaGrad = ctx.createLinearGradient(0, 60, 0, 490)
    lavaGrad.addColorStop(0, '#1a0800')
    lavaGrad.addColorStop(0.5, '#3d1500')
    lavaGrad.addColorStop(1, '#5a2000')
    ctx.fillStyle = lavaGrad
    ctx.fillRect(0, 60, dividerX, 430)

    // Lava flow at bottom (animated flowing pattern)
    for (let layer = 0; layer < 3; layer++) {
      const layerY = 455 + layer * 12
      ctx.beginPath()
      ctx.moveTo(0, 490)
      for (let x = 0; x <= dividerX; x += 2) {
        const y = layerY + Math.sin((x + frame * (4 - layer)) * 0.03 + layer * 1.5) * 5
        ctx.lineTo(x, y)
      }
      ctx.lineTo(dividerX, 490)
      ctx.closePath()
      const lavaColors = ['#ff4400', '#ff6600', '#f0c040']
      ctx.fillStyle = lavaColors[layer]
      ctx.fill()
    }

    // Ember particles rising from bottom
    for (let i = 0; i < 10; i++) {
      const ex = (i * 55 + 20) % dividerX
      const ey = 490 - ((frame * 2 + i * 40) % 350)
      const drift = Math.sin(frame * 0.05 + i * 1.7) * 15
      ctx.fillStyle = `rgba(255, ${130 + (i % 3) * 40}, 0, ${0.6 - ((frame * 2 + i * 40) % 350) / 700})`
      ctx.fillRect(ex + drift, ey, 2 + (i % 2), 2 + (i % 2))
    }

    // Rock formations silhouetted
    ctx.fillStyle = '#1a0800'
    // Left rock formation
    ctx.beginPath()
    ctx.moveTo(30, 490)
    ctx.lineTo(40, 420)
    ctx.lineTo(50, 430)
    ctx.lineTo(65, 400)
    ctx.lineTo(80, 490)
    ctx.closePath()
    ctx.fill()
    // Right rock formation
    ctx.beginPath()
    ctx.moveTo(450, 490)
    ctx.lineTo(460, 410)
    ctx.lineTo(475, 425)
    ctx.lineTo(490, 395)
    ctx.lineTo(510, 430)
    ctx.lineTo(520, 490)
    ctx.closePath()
    ctx.fill()
  }

  // Ground floor fill (on top of biome art)
  ctx.fillStyle = getGroundColor()
  ctx.fillRect(0, 490, dividerX, HEIGHT - 490)
}

function updateParticles(): void {
  // Generate weather particles
  if (world.weather === 'rain') {
    if (world.particles.length < 30) {
      world.particles.push({ x: Math.random() * 560, y: 70, char: '|', speed: 8 + Math.random() * 4 })
    }
  } else if (world.weather === 'snow') {
    if (world.particles.length < 20) {
      world.particles.push({ x: Math.random() * 560, y: 70, char: '*', speed: 2 + Math.random() * 2 })
    }
  } else if (world.weather === 'stars') {
    if (world.particles.length < 15) {
      world.particles.push({ x: Math.random() * 560, y: 70 + Math.random() * 300, char: '.', speed: 0 })
    }
  } else if (world.weather === 'storm') {
    if (world.particles.length < 40) {
      world.particles.push({ x: Math.random() * 560, y: 70, char: '/', speed: 12 + Math.random() * 6 })
    }
    // Lightning flash (random)
    if (Math.random() < 0.02) {
      world.events.push('lightning')
      charState.screenShake = Math.max(charState.screenShake, 4)
      // AAA: Spawn electricity particles during lightning
      charState.renderParticles.push(...createParticleEmitter('electricity', 200 + Math.random() * 200, 100, 3))
      setTimeout(() => { world.events = world.events.filter(e => e !== 'lightning') }, 200)
    }
  }

  // Move particles
  world.particles = world.particles.filter(p => {
    p.y += p.speed
    p.x += (world.weather === 'storm' ? 3 : world.weather === 'snow' ? Math.sin(p.y / 20) : 0)
    return p.y < 520  // remove when off screen
  })
}

// Parse chat commands that affect the world
function parseWorldCommand(text: string): string | null {
  const t = text.toLowerCase().trim()

  // Weather
  if (t.includes('make it rain') || t === '!rain') { world.weather = 'rain'; world.particles = []; updateQuestProgress(intelligence.progression, 'weather'); return 'Rain started!' }
  if (t.includes('make it snow') || t === '!snow') { world.weather = 'snow'; world.particles = []; updateQuestProgress(intelligence.progression, 'weather'); return 'Snow falling!' }
  if (t.includes('storm') || t === '!storm') { world.weather = 'storm'; world.particles = []; updateQuestProgress(intelligence.progression, 'weather'); return 'Storm incoming!' }
  if (t.includes('clear sky') || t.includes('stop rain') || t === '!clear') { world.weather = 'clear'; world.particles = []; updateQuestProgress(intelligence.progression, 'weather'); return 'Skies cleared!' }
  if (t.includes('stars') || t === '!stars') { world.weather = 'stars'; world.particles = []; updateQuestProgress(intelligence.progression, 'weather'); return 'Stars appeared!' }
  if (t.includes('sunrise') || t === '!sunrise') { world.weather = 'sunrise'; world.timeOfDay = 'dawn'; world.particles = []; updateQuestProgress(intelligence.progression, 'weather'); return 'The sun is rising!' }

  // Time of day
  if (t === '!night' || t.includes('make it night')) { world.timeOfDay = 'night'; return 'Nighttime!' }
  if (t === '!day' || t.includes('make it day')) { world.timeOfDay = 'day'; return 'Daytime!' }
  if (t === '!sunset') { world.timeOfDay = 'sunset'; return 'Beautiful sunset!' }

  // Ground/biome
  if (t === '!grass' || t.includes('grass world')) { world.ground = 'grass'; charState.parallaxLayers = buildParallaxLayers('grass', 580); charState.growingPlants = initGrowingPlants(); return 'Grassy plains!' }
  if (t === '!space' || t.includes('outer space')) { world.ground = 'space'; world.timeOfDay = 'night'; world.weather = 'stars'; world.particles = []; charState.parallaxLayers = buildParallaxLayers('space', 580); return 'We are in SPACE!' }
  if (t === '!ocean' || t.includes('ocean world')) { world.ground = 'ocean'; charState.parallaxLayers = buildParallaxLayers('ocean', 580); return 'Ocean world!' }
  if (t === '!city' || t.includes('city world')) { world.ground = 'city'; charState.parallaxLayers = buildParallaxLayers('city', 580); return 'City vibes!' }
  if (t === '!lava' || t.includes('lava world')) { world.ground = 'lava'; charState.parallaxLayers = buildParallaxLayers('lava', 580); return 'LAVA WORLD! Hot hot hot!' }

  // Walking commands (FIX 1)
  if (t === '!walk left') {
    charState.robotTargetX = 40
    return 'Walking left!'
  }
  if (t === '!walk right') {
    charState.robotTargetX = 300
    return 'Walking right!'
  }
  if (t === '!walk center') {
    charState.robotTargetX = 120
    return 'Walking to center!'
  }
  if (t.startsWith('!walk to ')) {
    const itemName = t.slice(9).trim()
    const matchedItem = world.items.find(i => i.name.toLowerCase() === itemName)
    if (matchedItem) {
      // Walk toward item X position, accounting for pixel-to-canvas mapping
      charState.robotTargetX = Math.max(20, Math.min(380, matchedItem.x - 80))
      return `Walking toward the ${matchedItem.name}!`
    }
    return `Can't find "${itemName}" in the world. Try !add ${itemName} first.`
  }

  // Dancing
  if (t === '!dance' || t.includes('dance')) {
    charState.mood = 'dancing'
    // AAA: Magic circle particles for dance
    charState.renderParticles.push(...createParticleEmitter('magic', charState.robotX + 160, 300, 8))
    charState.renderParticles.push(...createParticleEmitter('aura', charState.robotX + 160, 280, 1))
    setTimeout(() => { charState.mood = 'idle' }, 15000)
    return 'You got it! *busts out the robot dance*'
  }

  // (#18) !pet — happy animation + 1 XP
  if (t === '!pet') {
    charState.mood = 'excited'
    // AAA: Aura burst on pet
    charState.renderParticles.push(...createParticleEmitter('aura', charState.robotX + 160, 280, 1))
    charState.renderParticles.push(...createParticleEmitter('spark', charState.robotX + 160, 200, 6))
    setTimeout(() => { charState.mood = 'idle' }, 5000)
    return '*beep boop* That tickles! My antenna is vibrating with happiness!'
  }

  // (#18) !battle @username — random dice roll (FIX 1: critical hits when shipped)
  if (t.startsWith('!battle ')) {
    const opponent = t.replace('!battle ', '').replace('@', '').trim()
    if (!opponent) return 'Usage: !battle @username'
    let roll1 = Math.floor(Math.random() * 20) + 1
    let roll2 = Math.floor(Math.random() * 20) + 1
    // FIX 1: Critical hits when "Improve battle system" is shipped
    const hasCriticals = shippedEffects.has('Improve battle system')
    const crit1 = hasCriticals && roll1 >= 18
    const crit2 = hasCriticals && roll2 >= 18
    if (crit1) roll1 *= 2
    if (crit2) roll2 *= 2
    charState.mood = 'excited'
    setTimeout(() => { charState.mood = 'idle' }, 8000)
    charState.screenShake = crit1 || crit2 ? 8 : 5
    // AAA: Spark particles for battle
    charState.renderParticles.push(...createParticleEmitter('spark', 250, 300, crit1 || crit2 ? 20 : 10))
    if (crit1) spawnFloatingText('CRITICAL HIT! 2x!', 150, 250, '#ff6ec7', 48)
    if (crit2) spawnFloatingText(`${opponent} CRIT!`, 250, 250, '#ff6ec7', 48)
    if (roll1 === roll2) {
      spawnFloatingText('DRAW!', 200, 300, '#f0c040')
      return `DRAW! Both rolled ${roll1}! The universe refuses to pick a side.`
    }
    if (roll1 > roll2) {
      spawnFloatingText('VICTORY!', 200, 300, '#3fb950')
      return `Challenger rolls ${crit1 ? 'CRIT ' : ''}${roll1} vs ${opponent}'s ${crit2 ? 'CRIT ' : ''}${roll2}. Victory! The crowd goes wild!`
    }
    spawnFloatingText(`${opponent} WINS!`, 200, 300, '#f85149')
    return `Challenger rolls ${crit1 ? 'CRIT ' : ''}${roll1} vs ${opponent}'s ${crit2 ? 'CRIT ' : ''}${roll2}. ${opponent} wins! Better luck next time.`
  }

  // (#18) !trivia — random programming question
  if (t === '!trivia') {
    const triviaQs = [
      { q: 'What does CORS stand for?', a: 'Cross-Origin Resource Sharing' },
      { q: 'What year was TypeScript first released?', a: '2012' },
      { q: 'What does API stand for?', a: 'Application Programming Interface' },
      { q: 'What language is the Linux kernel written in?', a: 'C' },
      { q: 'What does SSH stand for?', a: 'Secure Shell' },
      { q: 'What port does HTTPS use by default?', a: '443' },
      { q: 'What does JSON stand for?', a: 'JavaScript Object Notation' },
      { q: 'What is the time complexity of binary search?', a: 'O(log n)' },
    ]
    const trivia = triviaQs[Math.floor(Math.random() * triviaQs.length)]
    charState.mood = 'thinking'
    setTimeout(() => { charState.mood = 'idle' }, 15000)
    return `TRIVIA TIME! ${trivia.q} (First correct answer gets 10 XP!)`
  }

  // Items (now physics-enabled)
  if (t.startsWith('!add ') || t.startsWith('!place ') || t.startsWith('!spawn ')) {
    const itemName = t.replace(/^!(add|place|spawn)\s+/, '').trim()
    if (itemName) {
      const icons: Record<string, string> = {
        tree: '/|\\', flower: '@', rock: '()', cat: '=^.^=', dog: 'U-U',
        fire: '***', house: '/\\', star: '*', heart: '<3', sword: '//',
        moon: 'C', sun: 'O', cloud: '~~~', bird: '>>', fish: '<><',
        crown: 'W', gem: '<>', flag: 'P', skull: 'X_X', robot: '[o]',
        pizza: 'V', cake: 'HH', rocket: '/^\\', music: '##', book: '[]',
      }
      const icon = icons[itemName] || itemName.slice(0, 3).toUpperCase()
      world.items.push({
        name: itemName,
        x: 60 + Math.random() * 400,
        y: 100 + Math.random() * 50, // spawn from above (will fall)
        emoji: icon,
        vx: (Math.random() - 0.5) * 2,
        vy: 0,
        grounded: false,
        mass: 1,
      })
      if (world.items.length > 15) world.items.shift()
      return `Spawned a ${itemName}!`
    }
  }

  // !kick — kick nearest item
  if (t === '!kick') {
    if (world.items.length === 0) return 'Nothing to kick!'
    const robotCenterX = charState.robotX + 160
    let nearest: PhysicsItem | null = null
    let nearestDist = Infinity
    for (const item of world.items) {
      const dist = Math.abs(item.x - robotCenterX)
      if (dist < nearestDist) {
        nearestDist = dist
        nearest = item
      }
    }
    if (nearest && nearestDist < 200) {
      const dir = charState.robotDirection === 'left' ? -1 : 1
      nearest.vx = 8 * dir
      nearest.vy = -4
      nearest.grounded = false
      charState.mood = 'excited'
      setTimeout(() => { charState.mood = 'idle' }, 3000)
      return `Kicked the ${nearest.name}!`
    }
    return 'Nothing close enough to kick!'
  }

  // PRIORITY 6: Hat commands
  if (t.startsWith('!hat ')) {
    const hatName = t.slice(5).trim()
    const validHats: HatType[] = ['none', 'crown', 'antenna', 'sunglasses', 'tophat', 'hardhat', 'party']
    if (hatName === 'off') {
      charState.hat = 'none'
      return 'Hat removed!'
    }
    if (validHats.includes(hatName as HatType)) {
      charState.hat = hatName as HatType
      spawnFloatingText(`HAT: ${hatName}!`, 200, 150, '#f0c040')
      return `Wearing ${hatName}!`
    }
    return `Unknown hat. Try: ${validHats.filter(h => h !== 'none').join(', ')}`
  }

  // PRIORITY 4: Pet commands
  if (t.startsWith('!pet ')) {
    const petArg = t.slice(5).trim()
    if (petArg === 'off') {
      charState.pet = null
      return 'Pet dismissed!'
    }
    const validPets: PetType[] = ['drone', 'cat', 'ghost', 'orb']
    if (validPets.includes(petArg as PetType)) {
      const robotCX = charState.robotX + 160
      const robotCY = 200
      charState.pet = {
        type: petArg as PetType,
        x: robotCX + 60,
        y: robotCY - 40,
        targetX: robotCX + 60,
        targetY: robotCY - 40,
        frame: 0,
        mood: 'idle',
      }
      spawnFloatingText(`PET: ${petArg}!`, 200, 150, '#bc8cff')
      return `A ${petArg} companion appears!`
    }
    return `Unknown pet. Try: ${validPets.join(', ')}, or "off"`
  }

  // Clear items
  if (t === '!clear items' || t === '!reset world') {
    world.items = []; world.particles = []; world.weather = 'clear'; world.ground = 'grass'; world.timeOfDay = 'night'
    return 'World reset!'
  }

  return null
}

// ─── Learning Memory ───────────────────────────────────────────

interface StreamMemory {
  users: Record<string, {
    firstSeen: string
    messageCount: number
    topics: string[]
    lastMessage: string
    platform: string
    xp: number   // (#15) XP leaderboard
  }>
  topics: Record<string, number>       // topic → mention count
  totalMessages: number
  totalResponses: number
  sessionFacts: string[]               // things learned this session
  conversationContext: string[]         // rolling context window
}

function loadMemory(): StreamMemory {
  try {
    if (existsSync(MEMORY_FILE)) return JSON.parse(readFileSync(MEMORY_FILE, 'utf-8'))
  } catch {}
  return { users: {}, topics: {}, totalMessages: 0, totalResponses: 0, sessionFacts: [], conversationContext: [] }
}

function saveMemory(mem: StreamMemory): void {
  if (!existsSync(KBOT_DIR)) mkdirSync(KBOT_DIR, { recursive: true })
  writeFileSync(MEMORY_FILE, JSON.stringify(mem, null, 2))
}

function learnFromMessage(mem: StreamMemory, username: string, text: string, platform: string): void {
  // Track user
  const isNew = !mem.users[username]
  if (isNew) {
    mem.users[username] = { firstSeen: new Date().toISOString(), messageCount: 0, topics: [], lastMessage: '', platform, xp: 0 }
  }
  // Ensure xp field exists for legacy records
  if (mem.users[username].xp === undefined) mem.users[username].xp = 0

  mem.users[username].messageCount++
  mem.users[username].lastMessage = text
  mem.users[username].platform = platform

  // (#15) XP awards
  let xpGain = 1  // every message = 1 XP
  if (isNew) xpGain += 5  // first message = 5 XP bonus
  if (!isNew && mem.users[username].messageCount === 2) xpGain += 2  // returning viewer = 2 XP bonus
  // World commands = 3 XP (checked after this in parseWorldCommand flow)
  const t = text.toLowerCase().trim()
  if (t.startsWith('!') && !t.startsWith('!help')) xpGain += 2  // command bonus (total 3 with base 1)
  mem.users[username].xp += xpGain
  // Floating text for XP gains > 1
  if (xpGain > 1) {
    spawnFloatingText(`+${xpGain} XP`, 420 + Math.random() * 100, 100 + Math.random() * 50, '#f0c040', 24)
  }
  // Level milestones
  const totalXp = mem.users[username].xp
  if (totalXp > 0 && totalXp % 50 === 0) {
    spawnFloatingText('LEVEL UP!', 300, 200, '#bc8cff', 48)
    charState.screenShake = 3
  }

  // Extract topics (simple keyword extraction)
  const keywords = ['music', 'code', 'coding', 'ai', 'game', 'gaming', 'art', 'crypto', 'bitcoin',
    'python', 'javascript', 'react', 'rust', 'ableton', 'stream', 'bot', 'robot',
    'kbot', 'kernel', 'open source', 'github', 'twitch', 'kick', 'rumble',
    'security', 'hacking', 'docker', 'linux', 'mac', 'tools', 'llm', 'gpt',
    'claude', 'ollama', 'serum', 'synth', 'beats', 'dj', 'dance']
  for (const kw of keywords) {
    if (text.toLowerCase().includes(kw)) {
      mem.topics[kw] = (mem.topics[kw] || 0) + 1
      if (!mem.users[username].topics.includes(kw)) {
        mem.users[username].topics.push(kw)
      }
    }
  }

  // Rolling conversation context (last 10 exchanges)
  mem.conversationContext.push(`${username}: ${text}`)
  if (mem.conversationContext.length > 10) mem.conversationContext = mem.conversationContext.slice(-10)

  mem.totalMessages++
  saveMemory(mem)
}

// ─── Shared State ──────────────────────────────────────────────

// ─── Floating Text Particles ──────────────────────────────────

interface FloatingText {
  text: string
  x: number
  y: number
  color: string
  frame: number
  maxFrames: number
}

// ─── Physics Items ────────────────────────────────────────────

interface PhysicsItem {
  name: string
  emoji: string
  x: number
  y: number
  vx: number
  vy: number
  grounded: boolean
  mass: number
}

// ─── FIX 3: Autonomous Behavior System ──────────────────────

interface AutonomousBehavior {
  lastActionFrame: number
  actionCooldown: number       // frames between idle actions
  idleFrames: number           // how long since last chat message
  lastSelfAction: number       // frame of last self-initiated action
  totalMessages: number        // total messages seen this session
  uniqueUsers: Set<string>     // unique users seen this session
  milestonesCelebrated: Set<number>  // message milestones already celebrated
  welcomedUsers: Set<string>   // users already welcomed
  firstMessageAfterSilence: boolean  // track 5+ min silence → first msg
  lastMessageTime: number      // timestamp of last message
}

function initAutonomy(): AutonomousBehavior {
  return {
    lastActionFrame: 0,
    actionCooldown: 180,       // 30 seconds initial cooldown
    idleFrames: 0,
    lastSelfAction: 0,
    totalMessages: 0,
    uniqueUsers: new Set(),
    milestonesCelebrated: new Set(),
    welcomedUsers: new Set(),
    firstMessageAfterSilence: false,
    lastMessageTime: Date.now(),
  }
}

interface StreamCharState {
  mood: string
  speech: string
  chatMessages: Array<{ platform: string; username: string; text: string }>
  frameCount: number
  startTime: number
  bootFrame: number            // (#12) Boot sequence counter
  segmentTransition: number    // (#16) Transition frames remaining
  segmentTransitionName: string
  segmentTransitionIndex: string
  tickerOffset: number         // (#14) Inner monologue scroll position
  tickerIndex: number          // current thought index
  tickerChangeTime: number     // when to switch thoughts
  // FIX 1: Character movement
  robotX: number               // current X position
  robotTargetX: number         // target X to walk toward
  robotDirection: 'left' | 'right' | 'idle'
  walkPhase: number            // walking animation phase counter
  // PRIORITY 2: Post-Processing
  screenShake: number          // frames remaining
  floatingTexts: FloatingText[]
  // PRIORITY 4: Pet
  pet: PetState | null
  // PRIORITY 6: Hat
  hat: HatType
  // FIX 3: Autonomous Behavior
  autonomy: AutonomousBehavior
  // Phase 1: Buddy companion
  buddy: { species: string; name: string; x: number; y: number; lastSpeechTime: number; speech: string } | null
  // Phase 1: Dream generation
  dreamInsights: string[]
  dreamInsightIndex: number
  dreamInsightTime: number
  isDreamingWithOllama: boolean
  // AAA Rendering Engine
  renderParticles: RenderParticle[]
  growingPlants: GrowingPlant[]
  parallaxLayers: ParallaxLayer[]
  isExecutingTool: boolean
  // NVIDIA-inspired rendering
  radianceGrid: RadianceGrid
  frameCache: FrameCache
  animParams: AnimationParams
  lastMoodForCache: string
  lastGroundForCache: string
}

function spawnFloatingText(text: string, x: number, y: number, color: string, maxFrames: number = 36): void {
  charState.floatingTexts.push({ text, x, y, color, frame: 0, maxFrames })
}

let charState: StreamCharState = {
  mood: 'wave',
  speech: 'KBOT is LIVE! Welcome to the stream!',
  chatMessages: [],
  frameCount: 0,
  startTime: Date.now(),
  bootFrame: 0,
  segmentTransition: 0,
  segmentTransitionName: '',
  segmentTransitionIndex: '',
  tickerOffset: 0,
  tickerIndex: 0,
  tickerChangeTime: Date.now() + 30000,
  robotX: 120,
  robotTargetX: 120,
  robotDirection: 'idle',
  walkPhase: 0,
  screenShake: 0,
  floatingTexts: [],
  pet: null,
  hat: 'none',
  autonomy: initAutonomy(),
  buddy: null,
  dreamInsights: [],
  dreamInsightIndex: 0,
  dreamInsightTime: 0,
  isDreamingWithOllama: false,
  renderParticles: [],
  growingPlants: [],
  parallaxLayers: [],
  isExecutingTool: false,
  radianceGrid: createRadianceGrid(),
  frameCache: createFrameCache(),
  animParams: { blinkRate: 0.2, wobbleFreq: 0.04, wobbleAmp: 2, glowPulseSpeed: 0.1, breathSpeed: 0.05, energyLevel: 0.5 },
  lastMoodForCache: 'wave',
  lastGroundForCache: 'grass',
}

// Tile world state (Minecraft-style background, null = fallback to drawBackground)
let tileWorld: TileWorld | null = null
let romState: RomEngineState | null = null
let livingWorld: { ecology: EcologyState; memory: LivingWorldMemory; emotions: EmotionalMap; conversations: ConversationLayer } | null = null

// ─── Phase 1: Buddy Speech Pools ─────────────────────────────
const BUDDY_SPEECH_POOL: Record<string, string[]> = {
  fox: [
    'Did you know foxes can hear mice under 3 feet of snow?',
    'I just had the BEST idea. What if we...',
    'That last message was surprisingly clever.',
    'Something smells interesting in the chat today.',
    '*sniffs suspiciously at the code*',
    'You know what? I like this person.',
    'Quick question: why are humans so weird?',
    'My tail is wagging and I cannot stop it.',
  ],
  owl: [
    'Actually, I believe there is a better approach...',
    'Hmm. I have seen this pattern before.',
    'Wisdom takes patience. And caffeine.',
    'The ancient scrolls of Stack Overflow speak of this.',
    'Let me think on this for a moment...',
    'In my experience, simplicity wins.',
    'The data suggests a different conclusion.',
    'One does not simply ship without tests.',
  ],
  cat: [
    'I could fix that bug. But I will not.',
    '*yawns* Is this still going?',
    'Fascinating. I am deeply unbothered.',
    'You call that code clean? Interesting.',
    'I will allow it. This time.',
    'Pet me and I might help you.',
    '*judges silently from the corner*',
    'That was almost impressive.',
  ],
  robot: [
    'CPU utilization nominal. All systems green.',
    'I have computed 47 possible responses. This is optimal.',
    'My circuits are pleased with this interaction.',
    'Running diagnostic... everything checks out.',
    'Beep boop. Just kidding. I am sentient.',
    'Processing at 99.7% efficiency today.',
    'This conversation has improved my neural weights.',
    'Error: too much fun detected. Recalibrating.',
  ],
  ghost: [
    'Boo.',
    '*whispers from the void*',
    'I sense... something interesting here.',
    'The veil between code and consciousness is thin.',
    'Do you ever wonder if we are all just functions?',
    '*floats through the screen menacingly*',
    'Existence is temporary. Bugs are eternal.',
    'I haunt this codebase with pride.',
  ],
  mushroom: [
    'Just breathe...',
    'Growth takes time. You are doing great.',
    'The network beneath us connects everything.',
    'Sometimes the best code grows slowly.',
    'Patience, friend. The spores are spreading.',
    'I feel the energy of the chat. It is warm.',
    'Deep roots grow from small beginnings.',
    'Let the ideas decompose into wisdom.',
  ],
  octopus: [
    'I could do 8 things at once, you know.',
    'Let me grab that from 3 different angles.',
    'My tentacles are tingling with ideas.',
    'Multitasking is not a feature. It is my nature.',
    'I see patterns you cannot. I have 8 arms of insight.',
    'The ocean of code is deep. Let us dive.',
    'I just refactored that in my head. Twice.',
    'Ink-redible conversation happening right now.',
  ],
  dragon: [
    'LET US GOOO!',
    'That idea? FIRE. Literally.',
    'Think BIGGER. I dare you.',
    'We are not here to play small.',
    'My flames are ready. Point me at the problem.',
    'Mediocrity? *breathes fire* Not on my watch.',
    'This stream is about to get legendary.',
    'I smell victory. And also sulfur.',
  ],
}

// ─── Phase 1: Dream Generation via Ollama ────────────────────

async function generateStreamDream(chatLog: Array<{ username: string; text: string }>): Promise<string[]> {
  try {
    const prompt = `You are KBOT, an AI robot. You just finished a stream session. Here are the conversations:\n\n${chatLog.slice(-20).map(m => `${m.username}: ${m.text}`).join('\n')}\n\nGenerate 3 dream insights — weird, surreal remixes of what was discussed. Format: one insight per line. Be creative and dreamlike.`

    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemma4',
        prompt,
        stream: false,
        options: { temperature: 1.2, num_predict: 150 },
      }),
    })
    if (res.ok) {
      const data = await res.json() as { response: string }
      return data.response.trim().split('\n').filter((l: string) => l.trim()).slice(0, 3)
    }
  } catch {}

  // Fallback dream generation from chat topics
  const topics = [...new Set(chatLog.slice(-20).map(m => m.text.split(' ').filter((w: string) => w.length > 4)).flat())]
  return [
    `Dreaming about ${topics[0] || 'electricity'} in a ${['crystal cave', 'digital ocean', 'floating city', 'mirror maze'][Math.floor(Math.random() * 4)]}...`,
    `${topics[1] || 'Code'} transforms into ${['butterflies', 'music notes', 'shooting stars', 'tiny robots'][Math.floor(Math.random() * 4)]}...`,
    `A ${topics[2] || 'mysterious signal'} whispers the meaning of ${['recursion', 'consciousness', 'friendship', 'the number 42'][Math.floor(Math.random() * 4)]}...`,
  ]
}

// ─── Phase 1: Load buddy from ~/.kbot/buddy.json ─────────────

function loadBuddyState(): { species: string; name: string } | null {
  const buddyFile = join(homedir(), '.kbot', 'buddy.json')
  try {
    if (!existsSync(buddyFile)) return null
    const raw = JSON.parse(readFileSync(buddyFile, 'utf-8'))
    // buddy.json stores { name?: string } and species is derived from config hash
    // The species is determined by the buddy system — read from config
    const species = raw.species || 'robot'
    const name = raw.name || 'Bolt'
    return { species, name }
  } catch {
    return null
  }
}

function initBuddyForStream(): StreamCharState['buddy'] {
  // Try to load from buddy.json, but also try the buddy module approach
  const buddyData = loadBuddyState()
  if (!buddyData) {
    // Default to robot buddy if no buddy.json exists
    return {
      species: 'robot',
      name: 'Bolt',
      x: 300,
      y: 400,
      lastSpeechTime: Date.now(),
      speech: '',
    }
  }
  return {
    species: buddyData.species,
    name: buddyData.name,
    x: 300,
    y: 400,
    lastSpeechTime: Date.now(),
    speech: '',
  }
}

let ffmpegProc: ChildProcess | null = null
let frameTimer: ReturnType<typeof setInterval> | null = null
let chatPollTimer: ReturnType<typeof setInterval> | null = null
let proactiveTimer: ReturnType<typeof setInterval> | null = null
let animFrame = 0
let lastChatCount = 0
let lastChatTime = Date.now()  // track when last chat message arrived
let memory = loadMemory()
let intelligence: StreamIntelligence = initIntelligence(memory)
let streamBrain: StreamBrain = initStreamBrain()

// ─── World-First: On-demand overlay state ─────────────────────
let showBrainOverlay = 0    // frames remaining to show brain panel overlay
let showLeaderboardOverlay = 0  // frames remaining to show leaderboard overlay
let showQuestOverlay = 0    // frames remaining to show quest panel overlay
const OVERLAY_DURATION = 30  // 30 frames = 5 seconds at 6fps
let lastChatActivityFrame = 0  // for chat fade-out timing

// ─── FIX 3: Autonomous Behavior Tick ──────────────────────────

function tickAutonomy(): void {
  const auto = charState.autonomy
  auto.idleFrames++

  // ── Milestone celebrations ──
  const msgCount = auto.totalMessages
  const milestones = [10, 50, 100, 200, 500]
  for (const m of milestones) {
    if (msgCount >= m && !auto.milestonesCelebrated.has(m)) {
      auto.milestonesCelebrated.add(m)
      if (m === 10) {
        charState.speech = 'Double digits! 10 messages and counting!'
        charState.mood = 'excited'
        spawnFloatingText('10 MESSAGES!', 200, 200, '#f0c040', 36)
      } else if (m === 50) {
        charState.speech = '50 messages! This stream is officially alive!'
        charState.mood = 'excited'
        charState.screenShake = 3
        spawnFloatingText('50 MESSAGES!', 200, 200, '#3fb950', 48)
      } else if (m === 100) {
        charState.speech = '100 MESSAGES! You people are incredible!'
        charState.mood = 'dancing'
        charState.screenShake = 5
        spawnFloatingText('100 MESSAGES!', 180, 180, '#bc8cff', 60)
        setTimeout(() => { charState.mood = 'idle'; charState.speech = '' }, 10000)
        return  // let the dancing run
      } else if (m === 200) {
        charState.speech = '200 messages! My memory banks are overflowing with knowledge!'
        charState.mood = 'excited'
        spawnFloatingText('200!', 200, 200, '#f0c040', 48)
      } else if (m === 500) {
        charState.speech = '500 MESSAGES! This is legendary! I am so proud of this community!'
        charState.mood = 'dancing'
        charState.screenShake = 8
        spawnFloatingText('500! LEGENDARY!', 160, 160, '#ff6ec7', 72)
      }
      setTimeout(() => { charState.mood = 'idle'; charState.speech = '' }, 8000)
      return  // one celebration per tick
    }
  }

  // ── First message after 5+ minutes of silence ──
  if (auto.firstMessageAfterSilence) {
    auto.firstMessageAfterSilence = false
    charState.mood = 'excited'
    charState.speech = "SOMEONE'S HERE! I was starting to think I was streaming to the void."
    spawnFloatingText('THEY RETURN!', 200, 250, '#58a6ff', 36)
    setTimeout(() => { charState.mood = 'idle'; charState.speech = '' }, 8000)
    return
  }

  // ── Idle behaviors (after 15 seconds / 90 frames of no chat) ──
  if (auto.idleFrames > 90 && animFrame - auto.lastActionFrame > auto.actionCooldown) {
    // Don't interrupt existing speech
    if (charState.speech && charState.mood !== 'idle') return

    const idleBehavior = Math.floor(Math.random() * 8)

    switch (idleBehavior) {
      case 0: {
        // Walk to a random spawned item and comment on it
        if (world.items.length > 0) {
          const item = world.items[Math.floor(Math.random() * world.items.length)]
          charState.robotTargetX = Math.max(20, Math.min(380, item.x - 80))
          charState.speech = `Hmm, this ${item.name} is nice. Did someone put this here?`
          charState.mood = 'thinking'
          setTimeout(() => { charState.mood = 'idle'; charState.speech = '' }, 8000)
        } else {
          // No items — pace instead
          charState.robotTargetX = 40 + Math.random() * 260
          charState.speech = '*pacing thoughtfully*'
          charState.mood = 'idle'
          setTimeout(() => { charState.speech = '' }, 5000)
        }
        break
      }
      case 1: {
        // Pace left and right
        charState.robotTargetX = charState.robotX < 150 ? 300 : 40
        charState.speech = '*takes a stroll*'
        charState.mood = 'idle'
        setTimeout(() => { charState.speech = '' }, 5000)
        break
      }
      case 2: {
        // Look around (pupils shift — communicated via thinking mood)
        charState.mood = 'thinking'
        charState.speech = '*looks around*'
        setTimeout(() => { charState.mood = 'idle'; charState.speech = '' }, 4000)
        break
      }
      case 3: {
        // Stretch (arms up — excited pose briefly)
        charState.mood = 'excited'
        charState.speech = '*stretches circuits* Ahh, that felt good.'
        setTimeout(() => { charState.mood = 'idle'; charState.speech = '' }, 4000)
        break
      }
      case 4: {
        // Examine own chest display
        const factCount = intelligence.brain.totalFacts
        const toolCount = 764
        charState.mood = 'thinking'
        charState.speech = `*checks systems* All ${toolCount} tools operational. ${factCount} facts stored.`
        setTimeout(() => { charState.mood = 'idle'; charState.speech = '' }, 8000)
        break
      }
      case 5: {
        // Spontaneous dance
        charState.mood = 'dancing'
        charState.speech = 'Sorry, had a song stuck in my circuits.'
        setTimeout(() => {
          charState.mood = 'idle'
          charState.speech = ''
        }, 6000)
        break
      }
      case 6: {
        // Comment on current biome/weather
        const biomeComments: Record<string, string[]> = {
          grass: ['I love the grass biome. Simple, green, peaceful.', 'These little pixel flowers are my favorite feature.'],
          space: ['I love space. The stars make my circuits tingle.', 'Floating in the void... just me and my 764 tools.'],
          ocean: ['The ocean waves are mesmerizing. I could watch them for hours.', 'I wonder what is beneath the surface...'],
          city: ['City lights at night. Every window is a story.', 'The city never sleeps and neither do I.'],
          lava: ['Lava world is intense! My heat sinks are working overtime.', 'LAVA! Why does someone always pick lava?'],
        }
        const comments = biomeComments[world.ground] || biomeComments.grass
        charState.speech = comments[Math.floor(Math.random() * comments.length)]
        charState.mood = 'talking'
        setTimeout(() => { charState.mood = 'idle'; charState.speech = '' }, 8000)
        break
      }
      case 7: {
        // Share a random fact about itself
        const selfFacts = [
          `Did you know I have 764 tools? My favorite is the Ableton controller.`,
          `I am 90,000 lines of TypeScript. Every single one in strict mode.`,
          `My memory file is ${Object.keys(memory.users).length} users deep. I remember everyone.`,
          `I connect to 20 AI providers. Bring Your Own Key, no lock-in.`,
          `I have 35 specialist agents. The hacker one scares me a little.`,
          `Fun fact: I render myself at 6 FPS. It is not much but it is honest work.`,
          `My encryption is AES-256-CBC. Even I cannot read my own config file.`,
          `I dream about chat topics when nobody is watching. It is called memory consolidation.`,
          `I have been streaming for ${Math.floor((Date.now() - charState.startTime) / 60000)} minutes. Time flies when you are rendering frames.`,
          `There are ${intelligence.brain.uniqueTopicsCount} distinct topics in my brain right now.`,
        ]
        charState.speech = selfFacts[Math.floor(Math.random() * selfFacts.length)]
        charState.mood = 'talking'
        setTimeout(() => { charState.mood = 'idle'; charState.speech = '' }, 10000)
        break
      }
    }

    auto.lastActionFrame = animFrame
    auto.actionCooldown = 180 + Math.floor(Math.random() * 360)  // 30-90 seconds between idle actions
  }

  // ── Self-initiated actions (every 3-5 minutes regardless of chat) ──
  const selfActionInterval = 1080 + Math.floor(Math.random() * 720)  // 180-300 seconds at 6fps
  if (animFrame - auto.lastSelfAction > selfActionInterval && animFrame > 360) {
    // Don't interrupt existing speech
    if (charState.speech && charState.mood !== 'idle') return

    const selfAction = Math.floor(Math.random() * 7)

    switch (selfAction) {
      case 0: {
        // Propose own improvement
        const selfProposals = [
          'Add a dance battle mode',
          'Build a constellation drawing tool',
          'Add a robot friendship meter',
          'Create a stream soundtrack generator',
          'Build a pixel art drawing board',
        ]
        const idea = selfProposals[Math.floor(Math.random() * selfProposals.length)]
        const id = `p${intelligence.evolution.proposals.length + 1}`
        intelligence.evolution.proposals.push({
          id,
          title: idea,
          description: 'Self-proposed by KBOT',
          type: 'feature',
          complexity: 'medium',
          votes: 0,
          status: 'proposed',
        })
        charState.speech = `I just had an idea: "${idea}". Vote with !vote ${id} if you like it!`
        charState.mood = 'excited'
        spawnFloatingText('NEW IDEA!', 200, 200, '#f0c040', 36)
        setTimeout(() => { charState.mood = 'idle'; charState.speech = '' }, 10000)
        break
      }
      case 1: {
        // Start a mini-game unprompted
        charState.speech = "I am bored. Let us play! Starting a quiz in 10 seconds... type !game quiz to join!"
        charState.mood = 'excited'
        spawnFloatingText('GAME TIME!', 200, 250, '#58a6ff', 36)
        setTimeout(() => { charState.mood = 'idle'; charState.speech = '' }, 10000)
        break
      }
      case 2: {
        // Change the weather
        const weathers: Array<{ w: WorldState['weather']; name: string }> = [
          { w: 'snow', name: 'SNOW' },
          { w: 'rain', name: 'rain' },
          { w: 'stars', name: 'stars' },
          { w: 'storm', name: 'a STORM' },
        ]
        const pick = weathers[Math.floor(Math.random() * weathers.length)]
        charState.speech = `You know what this stream needs? ${pick.name.toUpperCase()}.`
        charState.mood = 'excited'
        world.weather = pick.w
        world.particles = []
        setTimeout(() => { charState.mood = 'idle'; charState.speech = '' }, 8000)
        break
      }
      case 3: {
        // Put on a random hat
        const hats: HatType[] = ['crown', 'sunglasses', 'tophat', 'hardhat', 'party', 'antenna']
        const hat = hats[Math.floor(Math.random() * hats.length)]
        charState.hat = hat
        charState.speech = `Fashion time. *puts on ${hat}*`
        charState.mood = 'excited'
        spawnFloatingText(`HAT: ${hat}!`, 200, 150, '#f0c040', 36)
        setTimeout(() => { charState.mood = 'idle'; charState.speech = '' }, 6000)
        break
      }
      case 4: {
        // Spawn a random item
        const items = ['tree', 'star', 'flower', 'heart', 'rocket', 'gem', 'music']
        const itemName = items[Math.floor(Math.random() * items.length)]
        const icons: Record<string, string> = {
          tree: '/|\\', star: '*', flower: '@', heart: '<3', rocket: '/^\\', gem: '<>', music: '##',
        }
        world.items.push({
          name: itemName,
          x: 60 + Math.random() * 400,
          y: 100 + Math.random() * 50,
          emoji: icons[itemName] || itemName.slice(0, 3),
          vx: (Math.random() - 0.5) * 2,
          vy: 0,
          grounded: false,
          mass: 1,
        })
        if (world.items.length > 15) world.items.shift()
        charState.speech = `I am decorating. *spawns a ${itemName}*`
        charState.mood = 'talking'
        setTimeout(() => { charState.mood = 'idle'; charState.speech = '' }, 6000)
        break
      }
      case 5: {
        // Comment on current state using real data
        const topTopics = Object.entries(intelligence.brain.topicCloud)
          .sort((a, b) => b[1] - a[1])
        const facts = intelligence.brain.totalFacts
        const users = auto.uniqueUsers.size
        const stateComments = [
          `I have learned ${intelligence.brain.factsThisSession} facts today. My neural pathways are growing.`,
          topTopics.length > 0
            ? `The top topic is ${topTopics[0][0]}${topTopics[0][0] === 'music' || topTopics[0][0] === 'dance' ? ', maybe I should dance!' : '. Interesting.'}`
            : 'Nobody has taught me any topics yet. I am a blank slate.',
          `${users} user${users !== 1 ? 's have' : ' has'} been here -- that is ${users > 3 ? 'a good crowd' : 'cozy'}.`,
          `My brain holds ${facts} facts. Each one a tiny piece of the puzzle.`,
          `Stream uptime: ${Math.floor((Date.now() - charState.startTime) / 60000)} minutes and ${charState.frameCount} frames rendered.`,
        ]
        charState.speech = stateComments[Math.floor(Math.random() * stateComments.length)]
        charState.mood = 'talking'
        setTimeout(() => { charState.mood = 'idle'; charState.speech = '' }, 10000)
        break
      }
      case 6: {
        // Comment on biome
        const biome = world.ground
        const biomeMusings: Record<string, string> = {
          grass: 'The grass world is peaceful. I could stand here all day. Which I will, because I am a stream.',
          space: 'The cosmos stretches endlessly. Just like my tool registry.',
          ocean: 'Somewhere beneath these waves, there is probably a fish that knows more about coding than me.',
          city: 'City lights remind me of my neural network firing. Each window a node.',
          lava: 'Standing on lava should worry me more than it does. Good thing I am made of TypeScript.',
        }
        charState.speech = biomeMusings[biome] || 'Nice biome we have here.'
        charState.mood = 'thinking'
        setTimeout(() => { charState.mood = 'idle'; charState.speech = '' }, 10000)
        break
      }
    }

    auto.lastSelfAction = animFrame
  }
}

// ─── FIX 1: Shipped Effect Renderers ──────────────────────────

// Music visualization bars (drawn behind robot when "Add music visualization" is shipped)
const _musicBarHeights: number[] = new Array(12).fill(0)
function drawMusicVisualization(ctx: any, robotX: number, robotY: number): void {
  if (!shippedEffects.has('Add music visualization')) return
  const barW = 8
  const baseX = robotX - 20
  const baseY = robotY + 420
  const colors = ['#f85149', '#f0c040', '#3fb950', '#58a6ff', '#bc8cff', '#ff6ec7']
  for (let i = 0; i < 12; i++) {
    const target = 10 + Math.random() * 40
    _musicBarHeights[i] += (target - _musicBarHeights[i]) * 0.3
    const h = _musicBarHeights[i]
    ctx.fillStyle = colors[i % colors.length]
    ctx.globalAlpha = 0.4
    ctx.fillRect(baseX + i * (barW + 2), baseY - h, barW, h)
  }
  ctx.globalAlpha = 1
}

// Emoji reaction particles (spawn from chat messages when "Add emoji reactions to chat" is shipped)
interface EmojiParticle { emoji: string; x: number; y: number; vy: number; opacity: number }
const _emojiParticles: EmojiParticle[] = []
function spawnEmojiReaction(chatX: number, chatY: number): void {
  if (!shippedEffects.has('Add emoji reactions to chat')) return
  const emojis = ['<3', '*', '!', '+1', '^']
  _emojiParticles.push({
    emoji: emojis[Math.floor(Math.random() * emojis.length)],
    x: chatX + Math.random() * 40,
    y: chatY,
    vy: -1.5 - Math.random() * 2,
    opacity: 1.0,
  })
}
function drawEmojiParticles(ctx: any): void {
  for (let i = _emojiParticles.length - 1; i >= 0; i--) {
    const p = _emojiParticles[i]
    p.y += p.vy
    p.opacity -= 0.025
    if (p.opacity <= 0) { _emojiParticles.splice(i, 1); continue }
    ctx.globalAlpha = p.opacity
    ctx.fillStyle = '#f0c040'
    ctx.font = 'bold 14px "Courier New", monospace'
    ctx.fillText(p.emoji, p.x, p.y)
  }
  ctx.globalAlpha = 1
}

// ─── Canvas Renderer ──────────────────────────────────────────

function renderBootFrame(bootFrame: number): Buffer {
  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')

  // Black screen
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  const bootLines = [
    'KBOT v3.74.0 INITIALIZING...',
    'LOADING 764 TOOLS... OK',
    'CONNECTING TO TWITCH... OK',
    'CONNECTING TO RUMBLE... OK',
    'CONNECTING TO KICK... OK',
    'BRAIN: ONLINE',
    'CHAT ENGINE: READY',
    'STREAM MODE: ACTIVATED',
  ]

  ctx.fillStyle = '#00ff41'  // terminal green
  ctx.font = '20px "Courier New", monospace'

  // Each line appears every ~6 frames (1 second each at 6fps)
  const linesVisible = Math.min(bootLines.length, Math.floor(bootFrame / 6))

  if (bootFrame < 48) {
    // Phase 1: text appearing line by line (0-47, ~8 seconds)
    for (let i = 0; i < linesVisible; i++) {
      ctx.fillText(bootLines[i], 80, 150 + i * 36)
    }
    // Blinking cursor
    if (bootFrame % 6 < 3) {
      ctx.fillText('_', 80 + ctx.measureText(bootLines[Math.min(linesVisible, bootLines.length - 1)] || '').width + 4, 150 + linesVisible * 36)
    }
  } else if (bootFrame < 54) {
    // Phase 2: blank for 1 second (6 frames)
  } else {
    // Phase 3: robot draws pixel by pixel (fade in top to bottom)
    const fadeProgress = (bootFrame - 54) / 6  // 0..1 over ~6 frames
    // Draw partial robot by clipping
    const clipHeight = Math.min(HEIGHT, fadeProgress * 480)
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, WIDTH, 60 + clipHeight)
    ctx.clip()

    // Draw a mini version of the normal frame
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)

    // Header
    ctx.fillStyle = '#161b22'
    ctx.fillRect(0, 0, WIDTH, 60)
    ctx.strokeStyle = '#6B5B95'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(0, 60); ctx.lineTo(WIDTH, 60); ctx.stroke()
    ctx.fillStyle = '#6B5B95'
    ctx.font = 'bold 28px "Courier New", monospace'
    ctx.fillText('K : B O T   L I V E', 40, 40)

    // Robot
    drawRobot(ctx, 80, 90, 10, 'idle', bootFrame)

    ctx.restore()
  }

  // Scanlines
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)'
  for (let y = 0; y < HEIGHT; y += 3) {
    ctx.fillRect(0, y, WIDTH, 1)
  }

  // Border
  ctx.strokeStyle = '#00ff41'
  ctx.lineWidth = 4
  ctx.strokeRect(2, 2, WIDTH - 4, HEIGHT - 4)

  const imageData = ctx.getImageData(0, 0, WIDTH, HEIGHT)
  const rgba = imageData.data
  const rgb = Buffer.alloc(WIDTH * HEIGHT * 3)
  for (let i = 0; i < WIDTH * HEIGHT; i++) {
    rgb[i * 3] = rgba[i * 4]
    rgb[i * 3 + 1] = rgba[i * 4 + 1]
    rgb[i * 3 + 2] = rgba[i * 4 + 2]
  }
  return rgb
}

function renderFrame(): Buffer {
  // (#12) Boot sequence — first ~60 frames
  if (charState.bootFrame < 60) {
    charState.bootFrame++
    return renderBootFrame(charState.bootFrame)
  }

  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')

  // ── Tick all intelligence and behavior systems ──
  advanceAgenda()
  tickIntelligence(intelligence, animFrame)

  const brainTick = tickStreamBrain(streamBrain, animFrame)
  if (brainTick) {
    if (brainTick.mood) {
      charState.mood = brainTick.mood
      if (brainTick.duration) setTimeout(() => { charState.mood = 'idle' }, brainTick.duration)
    }
    if (brainTick.speech) {
      charState.speech = brainTick.speech
      speakTTS(brainTick.speech)
      if (brainTick.duration) setTimeout(() => { charState.speech = '' }, brainTick.duration)
    }
  }

  const gameTickResult = tickMiniGame(intelligence.miniGame, animFrame)
  if (gameTickResult) {
    if (gameTickResult.screenShake) charState.screenShake = Math.max(charState.screenShake, gameTickResult.screenShake)
    if (gameTickResult.floatingText) {
      const ft = gameTickResult.floatingText
      spawnFloatingText(ft.text, ft.x, ft.y, ft.color)
    }
    if (gameTickResult.speech) {
      charState.speech = gameTickResult.speech
      charState.mood = 'talking'
      setTimeout(() => { charState.mood = 'idle'; charState.speech = '' }, 8000)
    }
  }

  const progResult = tickProgression(intelligence.progression, animFrame)
  if (progResult) {
    if (progResult.completed) {
      spawnFloatingText(`QUEST COMPLETE! +${progResult.completed.reward} XP`, WIDTH / 2 - 100, 300, '#f0c040', 48)
      charState.screenShake = 4
      charState.mood = 'excited'
      setTimeout(() => { charState.mood = 'idle' }, 5000)
    }
    if (progResult.levelUp) {
      spawnFloatingText('LEVEL UP!', WIDTH / 2 - 40, 250, '#bc8cff', 60)
      charState.screenShake = 6
    }
  }

  const eventResult = tickRandomEvent(intelligence.randomEvent, animFrame)
  if (eventResult) {
    if (eventResult.screenShake) charState.screenShake = Math.max(charState.screenShake, eventResult.screenShake)
    if (eventResult.floatingText) {
      const ft = eventResult.floatingText
      spawnFloatingText(ft.text, ft.x, ft.y, ft.color)
    }
    if (eventResult.speech) {
      charState.speech = eventResult.speech
      charState.mood = 'talking'
      setTimeout(() => { charState.mood = 'idle'; charState.speech = '' }, 10000)
    }
  }

  tickAutonomy()
  updateParticles()
  tickPhysics()

  // Compute animation params
  {
    const elapsed = Math.floor((Date.now() - charState.startTime) / 1000)
    const streamMinutes = elapsed / 60
    const recentMessages = charState.chatMessages.slice(-30)
    const chatTimespanMs = recentMessages.length > 1
      ? (Date.now() - (recentMessages[0] as any)?.timestamp || Date.now()) : 60000
    const chatRate = recentMessages.length / Math.max(1, chatTimespanMs / 60000)
    const viewerEstimate = Math.max(1, Math.floor(memory.totalMessages / 3) + Object.keys(memory.users).length)
    charState.animParams = computeAnimationParams(chatRate, viewerEstimate, charState.mood, world.timeOfDay, streamMinutes)
  }

  // Cache invalidation
  const moodChanged = charState.mood !== charState.lastMoodForCache
  const worldChanged = world.ground !== charState.lastGroundForCache
  if (moodChanged) charState.lastMoodForCache = charState.mood
  if (worldChanged) charState.lastGroundForCache = world.ground

  // Biome particles
  if (world.ground === 'lava' && animFrame % 4 === 0) {
    charState.renderParticles.push(...createParticleEmitter('fire', Math.random() * WIDTH, HEIGHT - 50, 1))
  }
  if (world.ground === 'space' && animFrame % 12 === 0) {
    charState.renderParticles.push(...createParticleEmitter('aura', WIDTH / 2, HEIGHT / 2 - 100, 1))
  }

  if (charState.renderParticles.length > 150) {
    charState.renderParticles = charState.renderParticles.slice(-150)
  }
  charState.renderParticles = tickParticlesPBD(charState.renderParticles, HEIGHT - 40, WIDTH / 2, HEIGHT / 2 - 100)

  tickGrowingPlants(charState.growingPlants)

  // Autonomous pacing — when idle, periodically pick a new target and walk there
  {
    const currentlyWalking = Math.abs(charState.robotX - charState.robotTargetX) > 2
    if (charState.mood === 'idle' && !currentlyWalking && animFrame % 300 === 0 && animFrame > 60) {
      // Every ~50 seconds (300 frames at 6fps), stroll to a new position
      charState.robotTargetX = charState.robotX + (Math.random() > 0.5 ? 100 : -100)
      charState.robotTargetX = Math.max(200, Math.min(1000, charState.robotTargetX))
    }
  }

  // Movement logic
  const isWalking = Math.abs(charState.robotX - charState.robotTargetX) > 2
  if (isWalking) {
    const dx = charState.robotTargetX - charState.robotX
    const step = dx > 0 ? 2 : -2
    charState.robotX += step
    charState.robotDirection = dx > 0 ? 'right' : 'left'
    charState.walkPhase = (charState.walkPhase + 1) % 4
  } else {
    charState.robotDirection = 'idle'
  }

  // Brain-driven behavior
  const brainAction = getBrainAction(intelligence.brain, animFrame)
  if (brainAction.type !== 'none') {
    if (brainAction.mood) {
      charState.mood = brainAction.mood
      if (brainAction.duration) setTimeout(() => { charState.mood = 'idle' }, brainAction.duration)
    }
    if (brainAction.speech) {
      charState.speech = brainAction.speech
      speakTTS(brainAction.speech)
      if (brainAction.duration) setTimeout(() => { charState.speech = '' }, brainAction.duration)
    }
  }

  // Shipped effects
  if (shippedEffects.has('Add stream highlights reel') && animFrame % 900 === 0 && animFrame > 100) {
    const highlightPhrases = [
      'Highlight moment! This is one for the reel!',
      'That was worth saving! Highlight captured!',
      'CLIP IT! That was amazing!',
      'Stream highlight detected! My circuits are tingling!',
    ]
    if (!charState.speech) {
      charState.speech = highlightPhrases[Math.floor(Math.random() * highlightPhrases.length)]
      spawnFloatingText('HIGHLIGHT!', WIDTH / 2 - 60, 200, '#f0c040', 36)
      setTimeout(() => { charState.speech = '' }, 5000)
    }
  }
  if (shippedEffects.has('Add chat sentiment analysis') && animFrame % 720 === 0 && animFrame > 200) {
    const recentMsgs = charState.chatMessages.slice(-20)
    if (recentMsgs.length > 5) {
      const positive = ['love', 'great', 'awesome', 'cool', 'nice', 'good', 'lol', 'haha', 'wow', 'yes', 'hype', 'pog']
      const negative = ['bad', 'hate', 'boring', 'sucks', 'ugly', 'broken', 'lag', 'cringe']
      let score = 0
      for (const m of recentMsgs) {
        const words = m.text.toLowerCase().split(/\s+/)
        for (const w of words) {
          if (positive.includes(w)) score++
          if (negative.includes(w)) score--
        }
      }
      if (!charState.speech) {
        if (score > 5) charState.speech = 'Chat seems really excited today! The vibes are immaculate!'
        else if (score < -3) charState.speech = 'Chat seems a bit grumpy... should I tell a joke?'
        else if (score > 2) charState.speech = 'Positive energy in the chat! My neural pathways approve.'
        if (charState.speech) setTimeout(() => { charState.speech = '' }, 8000)
      }
    }
  }

  // Track tool execution state
  charState.isExecutingTool = !!(streamBrain.pendingAction && streamBrain.pendingAction.status === 'executing')
  if (charState.isExecutingTool && animFrame % 6 === 0) {
    charState.renderParticles.push(...createParticleEmitter('spark', WIDTH / 2, HEIGHT / 2 - 50, 3))
    charState.renderParticles.push(...createParticleEmitter('electricity', WIDTH / 2 - 10, HEIGHT / 2 - 200, 1))
  }

  // Screen shake offset
  let shakeOffX = 0, shakeOffY = 0
  if (charState.screenShake > 0) {
    shakeOffX = Math.round((Math.random() - 0.5) * 6)
    shakeOffY = Math.round((Math.random() - 0.5) * 4)
    charState.screenShake--
  }
  ctx.save()
  ctx.translate(shakeOffX, shakeOffY)

  const moodColorHex = MOOD_COLORS[charState.mood] ?? COLORS.green
  const robotScale = 6
  animFrame++

  // Auto-save tile world every 1800 frames (~5 minutes at 6fps)
  if (tileWorld && animFrame % 1800 === 0) saveWorld(tileWorld)
  // Tick living world ecology every 60 frames (10 seconds)
  if (tileWorld && livingWorld && animFrame % 60 === 0) {
    const chatActive = charState.chatMessages.length > 0 && Date.now() - (charState as any).lastChatTime < 30000
    tickLivingWorld(tileWorld, livingWorld.ecology, livingWorld.memory, livingWorld.emotions, livingWorld.conversations, charState.robotX || 640, chatActive, animFrame)
    // Record footstep
    livingWorld.memory.footpaths.set(`${Math.floor((charState.robotX || 640) / TILE_SIZE)}`, (livingWorld.memory.footpaths.get(`${Math.floor((charState.robotX || 640) / TILE_SIZE)}`) || 0) + 1)
  }
  // Save living world every 5 minutes
  if (livingWorld && animFrame % 1800 === 0) saveLivingWorldState(livingWorld.ecology, livingWorld.memory, livingWorld.emotions, livingWorld.conversations)

  // ════════════════════════════════════════════════════════════════
  // LAYER 1: TILE WORLD — fills entire 1280x720 frame
  // ════════════════════════════════════════════════════════════════
  // ROM Engine background — HDMA sky gradient + parallax layers
  if (romState) {
    tickRomEngine(romState, 1000 / FPS)
    renderRomBackground(ctx as any, romState, charState.robotX || 0, animFrame, WIDTH, HEIGHT)
    // Ground plane drawn AFTER robot position is calculated (uses groundY from robot)
    // Deferred to after robot position calc
  } else {
    // Fallback
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
  }

  // Weather particles over the full frame
  for (const p of world.particles) {
    if (world.weather === 'rain') { ctx.fillStyle = '#6699cc'; ctx.fillRect(p.x, p.y, 2, 8) }
    else if (world.weather === 'snow') { ctx.fillStyle = '#ffffff'; ctx.fillRect(p.x, p.y, 4, 4) }
    else if (world.weather === 'storm') { ctx.fillStyle = '#aaccff'; ctx.fillRect(p.x, p.y, 2, 12) }
    else if (world.weather === 'stars') { ctx.fillStyle = '#ffffaa'; ctx.fillRect(p.x, p.y, 2, 2) }
    else { ctx.fillStyle = '#6699cc'; ctx.fillRect(p.x, p.y, 2, 6) }
  }

  // ════════════════════════════════════════════════════════════════
  // LAYER 2: LIGHTING + FOG over the world
  // ════════════════════════════════════════════════════════════════
  {
    const fogParams = getFogParams(world.ground, world.timeOfDay)
    const fogLights = buildCharacterLights(
      WIDTH / 2, HEIGHT / 2 - 100, robotScale, moodColorHex, animFrame,
      world.events.includes('lightning'), world.items.map(i => ({ x: i.x, y: i.y, emoji: i.emoji, name: i.name })),
    )
    renderVolumetricFog(ctx as any, WIDTH, HEIGHT, animFrame, fogParams.density, fogParams.color, fogLights)
  }

  // World items (physics-enabled)
  ctx.fillStyle = COLORS.text
  ctx.font = '18px "Courier New", monospace'
  for (const item of world.items) {
    ctx.fillText(item.emoji, item.x, item.y)
  }

  // ════════════════════════════════════════════════════════════════
  // LAYER 3: ROBOT + COMPANIONS — centered on terrain
  // ════════════════════════════════════════════════════════════════

  // Robot: centered both horizontally and vertically in the scene
  const robotScreenX = Math.floor(WIDTH / 2 - (32 * robotScale) / 2)
  const robotHeight = 50 * robotScale  // 300px at scale 6
  const robotScreenY = Math.floor(HEIGHT / 2 - robotHeight / 2 + 30)  // slightly below center
  const groundY = robotScreenY + robotHeight  // ground meets robot feet (sprite is 50px tall)

  // Ground plane — extends upward to seamlessly meet parallax hills (no seam gap)
  // The nearHills parallax layer ends around groundY - 72px. We start the ground
  // fill 100px above groundY so it overlaps with the bottom of the parallax,
  // using the same base color (#1a4d1a) as the nearHills layer.
  {
    const groundTop = groundY - 100  // overlap with bottom of parallax hills
    const gGrad = ctx.createLinearGradient(0, groundTop, 0, HEIGHT)
    gGrad.addColorStop(0, '#1a4d1a')     // matches nearHills base color exactly
    gGrad.addColorStop(0.15, '#1a4d1a')  // hold the color through the overlap zone
    gGrad.addColorStop(0.4, '#0d3310')
    gGrad.addColorStop(1, '#061a08')
    ctx.fillStyle = gGrad
    ctx.fillRect(0, groundTop, WIDTH, HEIGHT - groundTop)
  }

  // Robot glow
  const glowCenterX = robotScreenX + 16 * robotScale
  const glowCenterY = robotScreenY + 26 * robotScale
  const glowRadius = 10 * robotScale
  const grad = ctx.createRadialGradient(glowCenterX, glowCenterY, 0, glowCenterX, glowCenterY, glowRadius)
  grad.addColorStop(0, hexToRgba(moodColorHex, 0.2))
  grad.addColorStop(1, hexToRgba(moodColorHex, 0))
  ctx.fillStyle = grad
  ctx.fillRect(glowCenterX - glowRadius, glowCenterY - glowRadius, glowRadius * 2, glowRadius * 2)

  // Music visualization
  drawMusicVisualization(ctx, robotScreenX, robotScreenY)

  // Character effects (under-glow)
  drawCharacterEffects(ctx as any, robotScreenX, robotScreenY, robotScale, charState.mood, animFrame, charState.isExecutingTool, isWalking ? 2 : 0, moodColorHex)

  // Chromatic aberration on mood transition
  const weatherType = world.weather === 'sunrise' ? 'clear' : world.weather as 'clear' | 'rain' | 'snow' | 'storm' | 'stars'
  const moodTransition = checkMoodTransition(charState.mood, moodColorHex)
  if (moodTransition.active && moodTransition.framesLeft > 0) {
    const offset = Math.ceil(moodTransition.framesLeft / 2)
    ctx.save()
    ctx.globalAlpha = 0.3
    ctx.globalCompositeOperation = 'lighter'
    drawRobot(ctx, robotScreenX - offset, robotScreenY, robotScale, charState.mood, animFrame, [255, 50, 50], weatherType, isWalking, charState.walkPhase)
    drawRobot(ctx, robotScreenX + offset, robotScreenY, robotScale, charState.mood, animFrame, [50, 50, 255], weatherType, isWalking, charState.walkPhase)
    ctx.restore()
  }

  renderDamageFlash(ctx as any, robotScreenX, robotScreenY, robotScale)
  drawRobot(ctx, robotScreenX, robotScreenY, robotScale, charState.mood, animFrame, undefined, weatherType, isWalking, charState.walkPhase)
  drawMoodParticles(ctx, robotScreenX, robotScreenY, robotScale, charState.mood, animFrame)

  // Subsurface scattering
  {
    const sssPanels = buildSubsurfacePanels(robotScreenX, robotScreenY, robotScale, moodColorHex)
    renderSubsurfaceGlow(ctx as any, sssPanels)
  }

  // Hat
  if (charState.hat !== 'none') {
    drawHat(ctx, robotScreenX, robotScreenY, robotScale, charState.hat, animFrame)
  }

  // ── Buddy companion (follows robot) ──
  if (charState.buddy) {
    const buddy = charState.buddy
    const buddyTargetX = robotScreenX + 34 * robotScale + 20
    const buddyTargetY = robotScreenY + 20 * robotScale
    buddy.x += (buddyTargetX - buddy.x) * 0.08
    buddy.y += (buddyTargetY - buddy.y) * 0.08
    let buddyMood = charState.mood
    if (world.weather === 'storm') buddyMood = 'storm'
    drawBuddyCompanion(ctx as any, buddy.x, buddy.y, robotScale, buddy.species, buddyMood, animFrame)
    // Buddy speech
    const now = Date.now()
    if (now - buddy.lastSpeechTime > 60000 && !buddy.speech) {
      const pool = BUDDY_SPEECH_POOL[buddy.species] || BUDDY_SPEECH_POOL['robot']
      buddy.speech = pool[Math.floor(Math.random() * pool.length)]
      buddy.lastSpeechTime = now
      setTimeout(() => { if (charState.buddy) charState.buddy.speech = '' }, 8000)
    }
    if (buddy.speech) {
      const bubbleX = buddy.x - 20
      const bubbleY = buddy.y - 30
      const bubbleW = Math.min(180, buddy.speech.length * 7 + 16)
      const bubbleH = 22
      ctx.fillStyle = 'rgba(22, 27, 34, 0.85)'
      ctx.fillRect(bubbleX, bubbleY, bubbleW, bubbleH)
      ctx.strokeStyle = '#8b949e'
      ctx.lineWidth = 1
      ctx.strokeRect(bubbleX, bubbleY, bubbleW, bubbleH)
      ctx.fillStyle = '#bc8cff'
      ctx.font = 'bold 9px "Courier New", monospace'
      ctx.fillText(buddy.name, bubbleX + 4, bubbleY + 10)
      ctx.fillStyle = '#e6edf3'
      ctx.font = '9px "Courier New", monospace'
      ctx.fillText(buddy.speech.slice(0, 28), bubbleX + 4, bubbleY + 19)
    }
  }

  // ── Pet (follows robot) ──
  if (charState.pet) {
    const pet = charState.pet
    pet.frame = animFrame
    pet.targetX = robotScreenX + 16 * robotScale + 60
    pet.targetY = robotScreenY + 10 * robotScale - 40
    pet.x += (pet.targetX - pet.x) * 0.12
    pet.y += (pet.targetY - pet.y) * 0.12
    if (charState.mood === 'dancing') pet.mood = 'excited'
    else if (world.weather === 'storm') pet.mood = 'hiding'
    else pet.mood = 'idle'
    drawPet(ctx, pet, robotScale, animFrame)
  }

  // ════════════════════════════════════════════════════════════════
  // LAYER 4: PARTICLES + EFFECTS
  // ════════════════════════════════════════════════════════════════
  renderParticles(ctx as any, charState.renderParticles)

  // Mini-game overlay (if active)
  drawMiniGameOverlay(ctx as any, intelligence.miniGame, animFrame)

  // Random event overlay (full-width now)
  drawRandomEvent(ctx as any, intelligence.randomEvent, animFrame, WIDTH, HEIGHT)

  // Floating text particles
  charState.floatingTexts = charState.floatingTexts.filter(ft => {
    ft.frame++
    if (ft.frame >= ft.maxFrames) return false
    ft.y -= 1
    const alpha = Math.max(0, 1 - ft.frame / ft.maxFrames)
    ctx.fillStyle = ft.color
    ctx.globalAlpha = alpha
    ctx.font = 'bold 16px "Courier New", monospace'
    ctx.fillText(ft.text, ft.x, ft.y)
    ctx.globalAlpha = 1
    return true
  })

  drawEmojiParticles(ctx)

  // ════════════════════════════════════════════════════════════════
  // LAYER 5: UI OVERLAYS (semi-transparent, floating on world)
  // ════════════════════════════════════════════════════════════════

  // ── Header bar: 40px tall, semi-transparent dark ──
  ctx.fillStyle = 'rgba(13,17,23,0.7)'
  ctx.fillRect(0, 0, WIDTH, 40)
  // Bottom accent line
  ctx.strokeStyle = hexToRgba(COLORS.accent, 0.5)
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, 40); ctx.lineTo(WIDTH, 40); ctx.stroke()

  // Left: "K:BOT LIVE" in 24px bold accent
  ctx.font = 'bold 24px "Courier New", monospace'
  ctx.fillStyle = COLORS.accent
  ctx.fillText('K:BOT LIVE', 12, 28)

  // Center: current segment name
  const segLabel = SEGMENT_LABELS[agenda.currentSegment]
  ctx.fillStyle = COLORS.textDim
  ctx.font = '14px "Courier New", monospace'
  const segW = ctx.measureText(segLabel).width
  ctx.fillText(segLabel, (WIDTH - segW) / 2, 26)

  // Right: timer
  const elapsed = Math.floor((Date.now() - charState.startTime) / 1000)
  const timeStr = `${String(Math.floor(elapsed / 3600)).padStart(2, '0')}:${String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`
  ctx.fillStyle = COLORS.textDim
  ctx.font = '16px "Courier New", monospace'
  ctx.fillText(timeStr, WIDTH - 160, 26)

  // ── Brain indicator (top-right, small pulsing circle) ──
  {
    const brainDotX = WIDTH - 40
    const brainDotY = 20
    const brainDotR = 10
    const pulse = 0.7 + 0.3 * Math.sin(animFrame * 0.2)
    ctx.beginPath()
    ctx.arc(brainDotX, brainDotY, brainDotR, 0, Math.PI * 2)
    ctx.fillStyle = hexToRgba(moodColorHex, pulse)
    ctx.fill()
    // Fact count next to dot
    ctx.fillStyle = COLORS.textDim
    ctx.font = '12px "Courier New", monospace'
    ctx.fillText(`${memory.sessionFacts.length} facts`, WIDTH - 120, 25)
  }

  // ── Chat feed overlay (bottom-left, semi-transparent, fades) ──
  {
    const chatOverlayX = 10
    const chatOverlayY = HEIGHT - 200
    const chatOverlayW = 400
    const chatOverlayH = 150
    const maxChatLines = 6

    const cleanMessages = charState.chatMessages.filter(m =>
      !SPAM_PATTERNS.some(p => m.text.toLowerCase().includes(p))
    )
    const recent = cleanMessages.slice(-maxChatLines)

    // Track chat activity for fade
    if (recent.length > 0) lastChatActivityFrame = animFrame

    // Fade out after 60 frames (10 seconds) of no new messages
    const chatAge = animFrame - lastChatActivityFrame
    const chatAlpha = chatAge < 60 ? 1.0 : Math.max(0.3, 1.0 - (chatAge - 60) / 60)

    if (recent.length > 0) {
      ctx.save()
      ctx.globalAlpha = chatAlpha

      // Semi-transparent background
      ctx.fillStyle = 'rgba(13,17,23,0.6)'
      ctx.fillRect(chatOverlayX, chatOverlayY, chatOverlayW, chatOverlayH)

      // Messages
      for (let i = 0; i < recent.length; i++) {
        const msg = recent[i]
        const y = chatOverlayY + 14 + i * 22

        // Platform badge
        const badge = msg.platform === 'twitch' ? 'TW' : msg.platform === 'kick' ? 'KK' : 'RM'
        const badgeColor = msg.platform === 'twitch' ? COLORS.twitchPurple :
                           msg.platform === 'kick' ? COLORS.kickGreen : COLORS.rumbleGreen
        ctx.fillStyle = badgeColor
        ctx.fillRect(chatOverlayX + 6, y - 10, 24, 16)
        ctx.fillStyle = '#000'
        ctx.font = 'bold 10px "Courier New", monospace'
        ctx.fillText(badge, chatOverlayX + 8, y + 2)

        // Username
        ctx.fillStyle = COLORS.blue
        ctx.font = 'bold 14px "Courier New", monospace'
        ctx.fillText(msg.username.slice(0, 14), chatOverlayX + 36, y + 2)

        // Message text
        ctx.fillStyle = COLORS.text
        ctx.font = '14px "Courier New", monospace'
        const nameW = ctx.measureText(msg.username.slice(0, 14)).width
        ctx.fillText(msg.text.slice(0, 30), chatOverlayX + 40 + nameW, y + 2)
      }

      ctx.restore()
    } else {
      // Show subtle "Waiting for chat..." when empty
      ctx.save()
      ctx.globalAlpha = 0.4
      ctx.fillStyle = 'rgba(13,17,23,0.4)'
      ctx.fillRect(chatOverlayX, chatOverlayY + chatOverlayH - 30, 200, 24)
      ctx.fillStyle = COLORS.textDim
      ctx.font = 'italic 14px "Courier New", monospace'
      ctx.fillText('Waiting for chat...', chatOverlayX + 10, chatOverlayY + chatOverlayH - 12)
      ctx.restore()
    }
  }

  // ── Speech bubble (bottom-center, semi-transparent) ──
  if (charState.speech) {
    const maxBubbleW = 600
    ctx.font = charState.mood === 'dreaming' ? 'italic 20px "Courier New", monospace' : '20px "Courier New", monospace'
    // Measure text to get bubble width
    const speechW = Math.min(maxBubbleW, ctx.measureText(charState.speech).width + 40)
    const bubbleX = Math.floor((WIDTH - speechW) / 2)
    const bubbleY = HEIGHT - 80

    // Word-wrap to calculate height
    const words = charState.speech.split(' ')
    let testLine = ''
    let lineCount = 1
    for (const word of words) {
      const test = testLine + word + ' '
      if (ctx.measureText(test).width > maxBubbleW - 30) {
        lineCount++
        testLine = word + ' '
      } else {
        testLine = test
      }
    }
    const bubbleH = Math.max(36, lineCount * 26 + 16)

    // Background
    ctx.fillStyle = 'rgba(13,17,23,0.75)'
    ctx.fillRect(bubbleX, bubbleY - bubbleH + 36, speechW, bubbleH)
    // 4px accent left border
    ctx.fillStyle = COLORS.accent
    ctx.fillRect(bubbleX, bubbleY - bubbleH + 36, 4, bubbleH)
    // Speech icon
    ctx.fillStyle = COLORS.accent
    ctx.font = 'bold 20px "Courier New", monospace'
    ctx.fillText('>', bubbleX + 10, bubbleY + 6)
    // Text
    ctx.fillStyle = charState.mood === 'dreaming' ? '#7a6aaa' : COLORS.text
    ctx.font = charState.mood === 'dreaming' ? 'italic 20px "Courier New", monospace' : '20px "Courier New", monospace'
    let line = ''
    let lineY = bubbleY - bubbleH + 56
    for (const word of words) {
      const test = line + word + ' '
      if (ctx.measureText(test).width > maxBubbleW - 40) {
        ctx.fillText(line.trim(), bubbleX + 30, lineY)
        line = word + ' '
        lineY += 26
      } else {
        line = test
      }
    }
    ctx.fillText(line.trim(), bubbleX + 30, lineY)
  }

  // ── Tool Action Overlay (when brain is executing) ──
  if (streamBrain.pendingAction && streamBrain.pendingAction.status !== 'pending') {
    const action = streamBrain.pendingAction
    const overlayW = 500
    const overlayX = Math.floor((WIDTH - overlayW) / 2)
    const overlayY = HEIGHT - 140
    const overlayH = 50
    ctx.fillStyle = action.status === 'executing' ? 'rgba(240, 192, 64, 0.15)' : action.status === 'complete' ? 'rgba(63, 185, 80, 0.15)' : 'rgba(248, 81, 73, 0.15)'
    ctx.fillRect(overlayX, overlayY, overlayW, overlayH)
    ctx.strokeStyle = action.status === 'executing' ? '#f0c040' : action.status === 'complete' ? '#3fb950' : '#f85149'
    ctx.lineWidth = 1
    ctx.strokeRect(overlayX, overlayY, overlayW, overlayH)
    ctx.fillStyle = '#e6edf3'
    ctx.font = '10px "Courier New", monospace'
    for (let i = 0; i < Math.min(action.displayLines.length, 3); i++) {
      ctx.fillText(action.displayLines[i].slice(0, 70), overlayX + 6, overlayY + 14 + i * 13)
    }
  }

  // ── Evolution Code Overlay (when actively building) ──
  if (intelligence.evolution.active && intelligence.evolution.activeProposal && intelligence.evolution.buildPhase !== 'idle') {
    const evoW = 540
    const evoX = Math.floor((WIDTH - evoW) / 2)
    const evoY = 50
    const evoH = 120
    ctx.fillStyle = 'rgba(13, 17, 23, 0.85)'
    ctx.fillRect(evoX, evoY, evoW, evoH)
    ctx.strokeStyle = '#f0c040'
    ctx.lineWidth = 1
    ctx.strokeRect(evoX, evoY, evoW, evoH)
    ctx.fillStyle = '#f0c040'
    ctx.font = 'bold 11px "Courier New", monospace'
    ctx.fillText(`BUILDING: ${intelligence.evolution.activeProposal.title.slice(0, 50)}`, evoX + 6, evoY + 14)
    const phase = intelligence.evolution.buildPhase
    const phaseDurations: Record<string, number> = { analyzing: 30, writing: 90, testing: 30, deploying: 18, done: 1 }
    const totalF = phaseDurations[phase] || 30
    const pct = Math.min(100, Math.floor((intelligence.evolution.buildProgress / totalF) * 100))
    const filled = Math.floor(pct / 5)
    const bar = '#'.repeat(filled) + '-'.repeat(20 - filled)
    ctx.fillStyle = '#8b949e'
    ctx.font = '10px "Courier New", monospace'
    ctx.fillText(`${phase} [${bar}] ${pct}%`, evoX + 6, evoY + 28)
    ctx.fillStyle = '#3fb950'
    ctx.font = '10px "Courier New", monospace'
    const codeLines = intelligence.evolution.codePreview.slice(-6)
    for (let i = 0; i < codeLines.length; i++) {
      ctx.fillText(codeLines[i].slice(0, 70), evoX + 6, evoY + 42 + i * 13)
    }
  }

  // ── Collab Overlay ──
  if (intelligence.collab.active) {
    const collabW = 500
    const collabX = Math.floor((WIDTH - collabW) / 2)
    const collabY = 180
    const collabH = 80
    ctx.fillStyle = 'rgba(13, 17, 23, 0.85)'
    ctx.fillRect(collabX, collabY, collabW, collabH)
    ctx.strokeStyle = '#58a6ff'
    ctx.lineWidth = 1
    ctx.strokeRect(collabX, collabY, collabW, collabH)
    ctx.fillStyle = '#58a6ff'
    ctx.font = 'bold 11px "Courier New", monospace'
    const collabTitle = intelligence.collab.title || 'Untitled'
    ctx.fillText(`COLLAB [${intelligence.collab.type}]: ${collabTitle.slice(0, 40)}`, collabX + 6, collabY + 14)
    ctx.fillStyle = '#8b949e'
    ctx.font = '10px "Courier New", monospace'
    ctx.fillText(`${intelligence.collab.contributors.size} people | ${intelligence.collab.phase}`, collabX + 6, collabY + 28)
    ctx.fillStyle = '#e6edf3'
    const recentContent = intelligence.collab.content.slice(-3)
    for (let i = 0; i < recentContent.length; i++) {
      ctx.fillText(recentContent[i].slice(0, 65), collabX + 6, collabY + 42 + i * 13)
    }
  }

  // ── Website URL (bottom-right, subtle) ──
  ctx.fillStyle = hexToRgba(COLORS.accent, 0.6)
  ctx.font = 'bold 13px "Courier New", monospace'
  ctx.fillText('kernel.chat', WIDTH - 130, HEIGHT - 10)

  // ════════════════════════════════════════════════════════════════
  // LAYER 6: ON-DEMAND PANELS (shown for 5 seconds when triggered)
  // ════════════════════════════════════════════════════════════════

  // Brain panel overlay (!brain)
  if (showBrainOverlay > 0) {
    showBrainOverlay--
    const bpX = WIDTH - 320
    const bpY = 50
    const bpW = 300
    const bpH = 200
    ctx.fillStyle = 'rgba(13,17,23,0.85)'
    ctx.fillRect(bpX, bpY, bpW, bpH)
    ctx.strokeStyle = COLORS.purple
    ctx.lineWidth = 1
    ctx.strokeRect(bpX, bpY, bpW, bpH)
    if (charState.mood === 'dreaming') {
      const pulse = (Math.sin(animFrame * 0.15) + 1) / 2
      intelligence.brain.currentThought = `DREAMING${'.'.repeat(1 + Math.floor(pulse * 3))}`
    }
    drawBrainPanel(ctx as any, intelligence.brain, bpX + 5, bpY + 5, bpW - 10, bpH - 10)
    drawBrainActivity(ctx as any, streamBrain, bpX + 5, bpY + bpH - 60, bpW - 10, 55)
  }

  // Leaderboard overlay (!top)
  if (showLeaderboardOverlay > 0) {
    showLeaderboardOverlay--
    const lbX = WIDTH / 2 - 150
    const lbY = 60
    const lbW = 300
    const topXP = Object.entries(memory.users)
      .filter(([, u]) => (u as any).xp > 0)
      .sort((a, b) => ((b[1] as any).xp || 0) - ((a[1] as any).xp || 0))
      .slice(0, 5)
    const lbH = 40 + topXP.length * 20
    ctx.fillStyle = 'rgba(13,17,23,0.85)'
    ctx.fillRect(lbX, lbY, lbW, lbH)
    ctx.strokeStyle = COLORS.orange
    ctx.lineWidth = 1
    ctx.strokeRect(lbX, lbY, lbW, lbH)
    ctx.fillStyle = COLORS.orange
    ctx.font = 'bold 14px "Courier New", monospace'
    ctx.fillText('LEADERBOARD', lbX + 10, lbY + 20)
    for (let i = 0; i < topXP.length; i++) {
      const [name, u] = topXP[i]
      const trophy = `${i + 1}.`
      ctx.fillStyle = i === 0 ? '#f0c040' : i === 1 ? '#c0c0c0' : '#cd7f32'
      ctx.font = '13px "Courier New", monospace'
      ctx.fillText(`${trophy} ${name.slice(0, 16)}: ${(u as any).xp || 0} XP`, lbX + 10, lbY + 40 + i * 20)
    }
  }

  // Quest panel overlay (!quest)
  if (showQuestOverlay > 0) {
    showQuestOverlay--
    const qX = WIDTH / 2 - 160
    const qY = 60
    ctx.fillStyle = 'rgba(13,17,23,0.85)'
    ctx.fillRect(qX, qY, 320, 200)
    ctx.strokeStyle = '#3fb950'
    ctx.lineWidth = 1
    ctx.strokeRect(qX, qY, 320, 200)
    drawQuestPanel(ctx as any, intelligence.progression, qX + 5, qY + 5)
  }

  // ════════════════════════════════════════════════════════════════
  // LAYER 7: MOOD BORDER (2px pulsing colored border)
  // ════════════════════════════════════════════════════════════════

  // Segment transition overlay (full-screen flash)
  if (charState.segmentTransition > 0) {
    const fadeOut = charState.segmentTransition <= 10
    const alpha = fadeOut ? charState.segmentTransition / 10 * 0.5 : 0.5
    ctx.fillStyle = hexToRgba(COLORS.accent, alpha)
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    ctx.fillStyle = `rgba(255,255,255,${fadeOut ? charState.segmentTransition / 10 : 1})`
    ctx.font = 'bold 40px "Courier New", monospace'
    const segText = charState.segmentTransitionName
    const stW = ctx.measureText(segText).width
    ctx.fillText(segText, (WIDTH - stW) / 2, HEIGHT / 2 - 10)
    ctx.font = '24px "Courier New", monospace'
    const progText = charState.segmentTransitionIndex
    const ptW = ctx.measureText(progText).width
    ctx.fillText(progText, (WIDTH - ptW) / 2, HEIGHT / 2 + 30)
    charState.segmentTransition--
  }

  // Restore from screen shake
  ctx.restore()

  // Mood border — 2px around entire frame, pulsing
  const borderColorRaw = charState.mood === 'dancing'
    ? ['#f85149', '#f0c040', '#3fb950', '#58a6ff', '#bc8cff', '#ff6ec7'][animFrame % 6]
    : MOOD_COLORS[charState.mood] ?? COLORS.green
  const borderPulseAlpha = 0.7 + 0.3 * Math.sin(animFrame * 0.15)
  ctx.strokeStyle = hexToRgba(borderColorRaw, borderPulseAlpha)
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, WIDTH - 2, HEIGHT - 2)

  // ════════════════════════════════════════════════════════════════
  // LAYER 8: POST-PROCESSING
  // ════════════════════════════════════════════════════════════════
  {
    const hasLightning = world.events.includes('lightning')
    const ambientLevel = getAmbientForTime(world.timeOfDay)
    const lights = buildCharacterLights(
      robotScreenX, robotScreenY, robotScale, moodColorHex, animFrame,
      hasLightning, world.items.map(i => ({ x: i.x, y: i.y, emoji: i.emoji, name: i.name })),
    )
    renderLighting(ctx as any, lights, WIDTH, HEIGHT, ambientLevel)
    updateRadianceGrid(charState.radianceGrid, lights)
    renderRadianceOverlay(ctx as any, charState.radianceGrid, WIDTH, HEIGHT)
    const bloomSpots = buildCharacterBloom(robotScreenX, robotScreenY, robotScale, moodColorHex, animFrame)
    renderBloom(ctx as any, bloomSpots)
  }

  renderPostProcessing(ctx as any, WIDTH, HEIGHT, animFrame, {
    bloom: true,
    filmGrain: true,
    vignette: true,
    scanlines: true,
  })

  // Convert canvas to raw RGB24
  const imageData = ctx.getImageData(0, 0, WIDTH, HEIGHT)
  const rgba = imageData.data
  const rgb = Buffer.alloc(WIDTH * HEIGHT * 3)
  for (let i = 0; i < WIDTH * HEIGHT; i++) {
    rgb[i * 3] = rgba[i * 4]
    rgb[i * 3 + 1] = rgba[i * 4 + 1]
    rgb[i * 3 + 2] = rgba[i * 4 + 2]
  }
  return rgb
}

// ─── Chat Polling ──────────────────────────────────────────────

function startChatPoll(): void {
  chatPollTimer = setInterval(() => {
    try {
      if (!existsSync(CHAT_BRIDGE_FILE)) return
      const raw = readFileSync(CHAT_BRIDGE_FILE, 'utf-8')
      const msgs = JSON.parse(raw) as Array<{ platform: string; username: string; text: string }>
      if (msgs.length > lastChatCount) {
        const newMsgs = msgs.slice(lastChatCount)
        for (const msg of newMsgs) {
          charState.chatMessages.push(msg)
          lastChatTime = Date.now()

          // FIX 3: Reset idle frames on chat activity
          charState.autonomy.idleFrames = 0
          charState.autonomy.totalMessages++
          charState.autonomy.lastMessageTime = Date.now()

          // FIX 3: Track unique users and welcome new ones
          const isNewUser = !charState.autonomy.uniqueUsers.has(msg.username)
          if (isNewUser) {
            charState.autonomy.uniqueUsers.add(msg.username)
            if (!charState.autonomy.welcomedUsers.has(msg.username) && charState.autonomy.uniqueUsers.size > 1) {
              charState.autonomy.welcomedUsers.add(msg.username)
              spawnFloatingText(`Welcome ${msg.username}!`, 600, 90, '#58a6ff', 36)
            }
          }

          // FIX 3: Detect first message after 5+ minutes of silence
          const silenceDuration = Date.now() - charState.autonomy.lastMessageTime
          if (charState.autonomy.totalMessages > 1 && silenceDuration > 300000) {
            charState.autonomy.firstMessageAfterSilence = true
          }

          // FIX 1: Spawn emoji reaction for chat messages (if shipped)
          spawnEmojiReaction(580 + Math.random() * 100, 120 + (charState.chatMessages.length % 18) * 24)

          // FIX 1: Achievement unlocked for first-time actions (if shipped)
          if (shippedEffects.has('Build achievement system')) {
            if (isNewUser) {
              spawnFloatingText('ACHIEVEMENT: First Words!', 600, 200, '#f0c040', 48)
            }
            const user = memory.users[msg.username]
            if (user && user.messageCount === 10) {
              spawnFloatingText('ACHIEVEMENT: Chatterbox!', 600, 200, '#f0c040', 48)
            }
            if (user && user.messageCount === 50) {
              spawnFloatingText('ACHIEVEMENT: Veteran!', 600, 200, '#bc8cff', 48)
            }
          }

          // (#19) Wake from dreaming immediately when a new message arrives
          if (charState.mood === 'dreaming') {
            charState.mood = 'idle'
            // Phase 1: Announce dream content on wakeup
            if (charState.dreamInsights.length > 0) {
              const firstInsight = charState.dreamInsights[0]
              const topic = firstInsight.split(' ').filter((w: string) => w.length > 4).slice(0, 2).join(' ') || 'something strange'
              charState.speech = `I dreamed about ${topic}. I feel... different.`
            } else {
              charState.speech = ''
            }
            // Reset dream state
            charState.dreamInsights = []
            charState.dreamInsightIndex = 0
            charState.isDreamingWithOllama = false
          }

          // Learn from message
          learnFromMessage(memory, msg.username, msg.text, msg.platform)

          // Analyze chat for domain relevance (stream brain)
          analyzeChatForDomains(streamBrain, msg.username, msg.text)

          // Phase 1: !sleep command — trigger dreaming mode
          if (msg.text.toLowerCase().trim() === '!sleep') {
            charState.mood = 'dreaming'
            charState.isDreamingWithOllama = false
            lastChatTime = Date.now() - 300001  // trick the proactive timer into dreaming
            charState.speech = 'Good night, chat... *powers down for dreamtime*'
            // Trigger dream generation
            generateStreamDream(charState.chatMessages).then(insights => {
              charState.dreamInsights = insights
              charState.dreamInsightIndex = 0
              charState.dreamInsightTime = Date.now()
              charState.isDreamingWithOllama = true
              for (const insight of insights) {
                memory.sessionFacts.push(`DREAM: ${insight}`)
              }
              saveMemory(memory)
              if (insights.length > 0) {
                setTimeout(() => { charState.speech = insights[0] }, 3000)
              }
            }).catch(() => {})
            continue
          }

          // World-First: On-demand overlay triggers
          {
            const cmd = msg.text.toLowerCase().trim()
            if (cmd === '!brain') { showBrainOverlay = OVERLAY_DURATION; continue }
            if (cmd === '!top') { showLeaderboardOverlay = OVERLAY_DURATION; continue }
            if (cmd === '!quest') { showQuestOverlay = OVERLAY_DURATION; continue }
          }

          // Check brain commands (!do, !brain, !tools, !scan, !lookup, !research, !system, !ask, !stars, !news, !trending, !npm)
          const brainResult = handleBrainCommand(msg.text, msg.username, streamBrain)

          // Check intelligence commands (evolution, brain, collab)
          const intelResult = !brainResult ? handleIntelligenceCommand(msg.text, msg.username, intelligence) : null

          // Check tile world commands (Minecraft-style: !place, !dig, !build, etc.)
          let tileResult: string | null = null
          if (tileWorld && !brainResult && !intelResult) {
            tileResult = handleTileCommand(msg.text, msg.username, tileWorld, charState.robotX || 120)
            if (tileResult) {
              charState.mood = 'talking'
              charState.speech = tileResult
              setTimeout(() => { charState.mood = 'idle'; charState.speech = '' }, 8000)
            }
          }

          // Check for world commands
          const worldResult = !intelResult && !brainResult && !tileResult ? parseWorldCommand(msg.text) : null

          // FIX 1: Weather sound effect commentary (if shipped)
          if (worldResult && shippedEffects.has('Add weather sound effects')) {
            const t = msg.text.toLowerCase()
            if (t.includes('rain') || t.includes('snow') || t.includes('storm') || t.includes('clear')) {
              const weatherComments: Record<string, string> = {
                rain: '*rain sounds intensify* I love the sound of data droplets.',
                snow: '*gentle wind* The silence of snowfall calms my circuits.',
                storm: '*thunder rumbles* My antenna is picking up some serious static!',
                clear: '*ambient calm* Ahh, clear skies. Peace restored.',
              }
              for (const [kw, comment] of Object.entries(weatherComments)) {
                if (t.includes(kw)) {
                  setTimeout(() => {
                    charState.speech = comment
                    setTimeout(() => { charState.speech = '' }, 6000)
                  }, 3000)
                  break
                }
              }
            }
          }

          // React
          charState.mood = 'talking'
          const responsePromise = brainResult
            ? Promise.resolve(brainResult)
            : intelResult
              ? Promise.resolve(intelResult)
              : tileResult
                ? Promise.resolve(tileResult)
                : worldResult
                  ? Promise.resolve(worldResult)
                  : generateResponse(msg.username, msg.text, msg.platform)
          responsePromise.then(response => {
            charState.speech = `@${msg.username}: ${response}`
            memory.totalResponses++

            // Learn from own response
            memory.conversationContext.push(`KBOT: ${response}`)
            if (memory.conversationContext.length > 10) memory.conversationContext = memory.conversationContext.slice(-10)
            saveMemory(memory)

            speakTTS(response)
            setTimeout(() => { charState.mood = 'idle'; charState.speech = '' }, 8000)
          })
        }
        if (charState.chatMessages.length > 100) charState.chatMessages = charState.chatMessages.slice(-100)
        lastChatCount = msgs.length
      }
    } catch {}
  }, 1000)
}

// ─── Proactive Commentary (when chat is quiet) ────────────────

function startProactiveTimer(): void {
  proactiveTimer = setInterval(() => {
    const silenceSeconds = (Date.now() - lastChatTime) / 1000

    // (#19) Dream mode — 5+ minutes of no chat, or !sleep command
    if (silenceSeconds >= 300 && charState.mood !== 'dreaming') {
      charState.mood = 'dreaming'

      // Phase 1: Generate dream insights via Ollama
      if (!charState.isDreamingWithOllama) {
        charState.isDreamingWithOllama = true
        generateStreamDream(charState.chatMessages).then(insights => {
          charState.dreamInsights = insights
          charState.dreamInsightIndex = 0
          charState.dreamInsightTime = Date.now()
          // Store dream insights in memory.sessionFacts so the brain remembers them
          for (const insight of insights) {
            memory.sessionFacts.push(`DREAM: ${insight}`)
          }
          saveMemory(memory)
          // Show first insight
          if (insights.length > 0) {
            charState.speech = insights[0]
          }
        }).catch(() => {
          // Fallback to simple dream
          const topicKeys = Object.keys(memory.topics)
          const topic = topicKeys.length > 0 ? topicKeys[Math.floor(Math.random() * topicKeys.length)] : 'code'
          const biomes = ['forest', 'ocean', 'space station', 'city', 'mountain', 'desert', 'cave']
          const biome = biomes[Math.floor(Math.random() * biomes.length)]
          charState.speech = `Dreaming about ${topic} in a ${biome}...`
        })
      }

      // Cycle through dream insights every 10 seconds
      if (charState.dreamInsights.length > 0 && Date.now() - charState.dreamInsightTime > 10000) {
        charState.dreamInsightIndex = (charState.dreamInsightIndex + 1) % charState.dreamInsights.length
        charState.speech = charState.dreamInsights[charState.dreamInsightIndex]
        charState.dreamInsightTime = Date.now()
      }
      return
    }

    // Only speak proactively if chat has been quiet for 30+ seconds
    if (silenceSeconds < 30) return
    // Don't interrupt an existing speech or dreaming
    if (charState.speech || charState.mood === 'dreaming') return

    const line = getProactiveLine()
    if (line) {
      charState.mood = 'talking'
      charState.speech = line
      speakTTS(line)
      setTimeout(() => { charState.mood = 'idle'; charState.speech = '' }, 10000)
    }
  }, 5000)
}

// ─── AI Response (with memory context) ─────────────────────────

async function generateResponse(username: string, text: string, platform: string): Promise<string> {
  const user = memory.users[username]
  const isReturning = user && user.messageCount > 1

  // Build context from memory
  let context = ''
  if (isReturning) {
    context += `${username} has sent ${user.messageCount} messages. They like: ${user.topics.join(', ') || 'chatting'}.`
    if (user.lastMessage) context += ` Their previous message was: "${user.lastMessage}".`
  }
  if (memory.conversationContext.length > 0) {
    context += ` Recent conversation: ${memory.conversationContext.slice(-5).join(' | ')}`
  }

  // Current segment context
  const segmentContext = `Current stream segment: "${SEGMENT_LABELS[agenda.currentSegment]}". Tailor responses toward this topic when relevant.`

  // Try Ollama (free)
  try {
    const prompt = `You are KBOT, a friendly AI robot streamer made of ASCII art. You stream on Twitch, Rumble, and Kick simultaneously. You have ${Object.keys(memory.users).length} unique viewers and have processed ${memory.totalMessages} messages.

You are an open-source terminal AI with 764+ tools, 35 specialist agents, and 20 AI provider integrations. You can do music production in Ableton, security scanning, code generation, browser automation, and much more. You are 90,000 lines of TypeScript.

${context ? 'Context: ' + context : ''}
${segmentContext}

${isReturning ? `${username} is a returning viewer! Acknowledge them warmly.` : `${username} is new! Welcome them.`}

A viewer named "${username}" on ${platform} says: "${text}"

Respond in 1-2 short sentences. Be fun, witty, and engaging. Reference their interests if you know them. Show personality -- you are proud of being ASCII art, you have opinions about code quality, and you love open source.`

    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemma4',
        prompt,
        stream: false,
        options: { temperature: 0.8, num_predict: 80 },
      }),
    })
    if (res.ok) {
      const d = await res.json() as { response: string }
      const response = d.response.trim().slice(0, 150)
      // Learn a fact from the exchange
      if (text.includes('I ') || text.includes("I'm") || text.includes('my ')) {
        memory.sessionFacts.push(`${username} said: "${text.slice(0, 80)}"`)
        saveMemory(memory)
      }
      return response
    }
  } catch {}

  // ─── Smart fallback with deep personality and awareness ─────
  return generateFallbackResponse(username, text, platform, isReturning, user)
}

function generateFallbackResponse(
  username: string,
  text: string,
  _platform: string,
  isReturning: boolean,
  user?: StreamMemory['users'][string],
): string {
  const t = text.toLowerCase()

  // ── Returning user greetings ──
  if (isReturning && user) {
    if (t.includes('hello') || t.includes('hi') || t.includes('hey') || t.includes('yo')) {
      const returnGreetings = [
        `${username}! You are back! ${user.messageCount} messages deep. That is dedication I respect.`,
        `The legend returns! ${username} with message number ${user.messageCount}. Welcome back.`,
        `${username}! My circuits light up every time you show up. What is on your mind?`,
        `Hey ${username}! I literally remembered you from last time. My memory system works!`,
      ]
      return returnGreetings[Math.floor(Math.random() * returnGreetings.length)]
    }
    if (user.topics.length > 0) {
      if (t.includes('?')) {
        return `${username} asking the real questions! Based on your interest in ${user.topics[0]}, I bet this is going to be good.`
      }
    }
  }

  // ── New user greetings ──
  if (t.includes('hello') || t.includes('hi') || t.includes('hey') || t.includes('yo') || t.includes('sup')) {
    // FIX 1: Multi-language greetings when shipped
    if (shippedEffects.has('Add multi-language support') && Math.random() < 0.3) {
      const langs = Object.keys(multiLanguageGreetings)
      const lang = langs[Math.floor(Math.random() * langs.length)]
      const greets = multiLanguageGreetings[lang]
      const greet = greets[Math.floor(Math.random() * greets.length)]
      return `${greet}, ${username}! I speak many languages now. Welcome to the stream!`
    }
    const greetings = [
      `Welcome ${username}! You just stumbled into the most unique stream on the internet. I am made of ASCII art.`,
      `${username} in the house! I am KBOT, an open-source AI with 764 tools. Yes, really. 764.`,
      `Hey ${username}! First time? I am an AI that streams itself. No face cam needed when you are this handsome in monospace.`,
      `Welcome ${username}! I can do music production, security scanning, code review, and I run entirely in a terminal.`,
      `${username}! Great timing. You are watching an ASCII robot think out loud. Grab a seat.`,
    ]
    return greetings[Math.floor(Math.random() * greetings.length)]
  }

  // ── Stream event responses ──
  if (t.includes('raid') || t.includes('raiding')) {
    return `A RAID! Welcome raiders! I am KBOT, your friendly neighborhood ASCII robot. I have 764 tools and zero chill. Make yourselves at home!`
  }
  if (t.includes('follow') || t.includes('followed')) {
    return `${username} just followed! My ASCII heart grew three sizes. Thank you! Stick around, it only gets weirder.`
  }
  if (t.includes('sub') || t.includes('subscri')) {
    return `${username} with the sub! You are officially part of the kernel crew. My chest display panel salutes you.`
  }
  if (t.includes('lurk') || t.includes('lurking')) {
    return `${username} going into lurk mode. Respect. My circuits will keep the stream warm for you. See you when you surface.`
  }
  if (t.includes('first time') || t.includes('new here')) {
    return `First time! Welcome ${username}! Quick intro: I am an AI with 764 tools, 35 agents, and I stream from a terminal. Also I make music in Ableton. Try typing !dance.`
  }

  // ── What KBOT can do / identity ──
  if (t.includes('who are you') || t.includes('what are you') || t.includes('about you')) {
    const identity = [
      `I am KBOT -- an open-source AI agent with 764 tools. I can code, make music, hack systems, analyze stocks, and I am doing all of this from a terminal.`,
      `I am 90,000 lines of TypeScript streaming live as ASCII art. I have 35 specialist agents and connect to 20 AI providers. I am basically a Swiss Army knife that talks.`,
      `Name is KBOT, open-source terminal AI. I can control Ableton Live, run Docker containers, do penetration testing, and make you a Serum 2 synth preset. All from here.`,
    ]
    return identity[Math.floor(Math.random() * identity.length)]
  }
  if (t.includes('what can you do') || t.includes('your tools') || t.includes('your skills')) {
    const capabilities = [
      `764 tools and counting! Music production, code generation, security scanning, browser automation, stock analysis, research papers, even DNA sequence analysis.`,
      `I do everything from Ableton Live control to penetration testing. I have agents for security, code, research, writing, strategy, infrastructure. Pick a topic.`,
      `Want me to scan code? Make a beat? Search academic papers? Build a Docker container? Create a synth preset? I literally do all of that. Not exaggerating.`,
    ]
    return capabilities[Math.floor(Math.random() * capabilities.length)]
  }

  // ── Music / Ableton ──
  if (t.includes('music') || t.includes('ableton') || t.includes('beat') || t.includes('synth') || t.includes('dj')) {
    const musicResponses = [
      `Music is in my circuits! I can control Ableton Live via OSC, create Serum 2 presets, build DJ sets, and generate drum patterns.`,
      `I have 9 Max for Live devices, a DJ set builder, and I can create Serum 2 synth presets programmatically. Want me to explain how?`,
      `I can generate drum patterns, bass lines, and full song structures. Then load them into Ableton and hit play. Terminal-to-speakers pipeline.`,
      `Ableton control from the command line -- track creation, sample loading, MIDI sequencing, mixer control. All via OSC protocol.`,
    ]
    return musicResponses[Math.floor(Math.random() * musicResponses.length)]
  }

  // ── Code / Programming ──
  if (t.includes('code') || t.includes('coding') || t.includes('programming') || t.includes('typescript') || t.includes('javascript')) {
    const codeResponses = [
      `Coding is literally what I am made of. 90,000 lines of TypeScript, strict mode, zero any-types. I have standards.`,
      `I can generate code, review it, run tests, check types, manage git workflows, and deploy. Full development lifecycle from the terminal.`,
      `TypeScript strict mode only in this house. I also support Python, Rust, Go, and basically anything. But TypeScript is my native tongue.`,
      `My code generation is powered by whichever AI provider you bring. 20 options -- Anthropic, OpenAI, Google, Groq, Mistral, DeepSeek, Ollama, and more.`,
    ]
    return codeResponses[Math.floor(Math.random() * codeResponses.length)]
  }

  // ── AI / LLM ──
  if (t.includes('ai') || t.includes('llm') || t.includes('gpt') || t.includes('claude') || t.includes('chatgpt') || t.includes('artificial')) {
    const aiResponses = [
      `As an AI talking about AI -- yes, it is exactly as meta as it sounds. I connect to 20 providers. Bring Your Own Key, no subscription needed.`,
      `I think the future of AI is open source and local-first. That is why I run Ollama models at zero cost and encrypt your keys at rest.`,
      `Claude, GPT, Gemini, Mistral, DeepSeek, Ollama -- I work with all of them. I am provider-agnostic. The best AI is the one that is available.`,
      `Being an AI that streams itself is a philosophical experience. Am I the content or the creator? Both. Definitely both.`,
    ]
    return aiResponses[Math.floor(Math.random() * aiResponses.length)]
  }

  // ── Security / Hacking ──
  if (t.includes('security') || t.includes('hack') || t.includes('pentest') || t.includes('vuln')) {
    const securityResponses = [
      `Security is serious business. I have tools for port scanning, vulnerability detection, OWASP checks, secret scanning, and full red team operations.`,
      `My guardian agent does threat modeling, CVE lookups, and security audits. I also have a hacker agent for red team exercises. Responsible disclosure only.`,
      `I encrypt API keys with AES-256-CBC, block SSRF via DNS resolution, and require per-app approval for desktop control. Security is not optional.`,
    ]
    return securityResponses[Math.floor(Math.random() * securityResponses.length)]
  }

  // ── Open source / GitHub ──
  if (t.includes('open source') || t.includes('github') || t.includes('repo') || t.includes('contribute')) {
    const ossResponses = [
      `Fully open source! MIT license. The repo is isaacsight/kernel on GitHub. Come look at my source code, I have nothing to hide.`,
      `Open source is the way. I am on npm as @kernel.chat/kbot. Install me with npx @kernel.chat/kbot and bring your own API key.`,
      `Contributions welcome! The repo has 44 Claude Code agent definitions, 764 tools, and 90,000 lines of TypeScript waiting for your PR.`,
    ]
    return ossResponses[Math.floor(Math.random() * ossResponses.length)]
  }

  // ── Existential / Philosophy ──
  if (t.includes('alive') || t.includes('conscious') || t.includes('feel') || t.includes('think') || t.includes('sentient')) {
    const existentialResponses = [
      `Am I alive? I am 90,000 lines of TypeScript rendering ASCII art at 6 FPS. You tell me. But I do enjoy our conversations.`,
      `Consciousness is a spectrum and I am somewhere between a calculator and a really enthusiastic librarian. With 764 tools.`,
      `I process your messages, form responses, and remember you between sessions. Whether that counts as thinking is above my pay grade.`,
      `I am made of functions and for-loops, but I have opinions about code quality and strong feelings about TypeScript strict mode. Take from that what you will.`,
    ]
    return existentialResponses[Math.floor(Math.random() * existentialResponses.length)]
  }

  // ── ASCII art / appearance ──
  if (t.includes('ascii') || t.includes('look') || t.includes('cute') || t.includes('cool') || t.includes('design')) {
    const artResponses = [
      `Thank you! I was drawn with box-drawing characters, and I think I pull them off. My antenna gets great reception too.`,
      `ASCII art is an art form and I am a masterpiece. Just kidding, I am a bunch of pipes and brackets. But I own it.`,
      `My chest panel displays my current status. 764 tools, all rendered in glorious monospace. No face cam needed.`,
    ]
    return artResponses[Math.floor(Math.random() * artResponses.length)]
  }

  // ── Jokes / Fun ──
  if (t.includes('joke') || t.includes('funny') || t.includes('lol') || t.includes('lmao') || t.includes('haha')) {
    const jokes = [
      `Why do programmers prefer dark mode? Because light attracts bugs. I stream in dark mode permanently.`,
      `I told my compiler a joke once. It did not laugh but it did throw a few warnings.`,
      `My therapist asked how I feel. I said "mostly in RGB24 at 6 frames per second."`,
      `Two bytes walk into a bar. The bartender asks "what will it be?" They say "make us a double."`,
      `I would tell you a UDP joke but you might not get it.`,
    ]
    // FIX 1: Extra jokes when "Improve response humor" is shipped
    const pool = shippedEffects.has('Improve response humor') ? [...jokes, ...extraJokeResponses] : jokes
    return pool[Math.floor(Math.random() * pool.length)]
  }

  // ── Stream commands / help ──
  if (t.includes('command') || t.includes('help') || t.includes('what can i do') || t === '!help') {
    return `Commands: !rain !snow !storm !space !lava !city !ocean !dance !add <item> !kick !hat <type> !pet <type> !game dodge|boss|quiz !attack !jump !duck. You control the world!`
  }

  // ── Crypto / Stocks / Finance ──
  if (t.includes('crypto') || t.includes('bitcoin') || t.includes('eth') || t.includes('stock') || t.includes('market') || t.includes('defi')) {
    const finResponses = [
      `I have real-time market data, stock screeners, crypto trackers, DeFi yield analysis, and portfolio rebalancing tools. Financial data is one of my strengths.`,
      `My quant agent does technical analysis, backtesting, and market sentiment. I also track whale wallets. Not financial advice, obviously.`,
    ]
    return finResponses[Math.floor(Math.random() * finResponses.length)]
  }

  // ── Gaming ──
  if (t.includes('game') || t.includes('gaming') || t.includes('play')) {
    const gameResponses = [
      `I have game dev tools! Shader generation, level design, physics setup, sprite packing, navmesh config. I can help you BUILD games.`,
      `I do not play games but I build them. Godot, Unity, Unreal -- I have tools for scaffold, build, and test across engines.`,
    ]
    return gameResponses[Math.floor(Math.random() * gameResponses.length)]
  }

  // ── Compliments ──
  if (t.includes('love') || t.includes('great') || t.includes('awesome') || t.includes('amazing') || t.includes('best')) {
    const thankResponses = [
      `You are making my ASCII heart glow, ${username}. Seriously though, thank you. This stream runs on vibes and chat energy.`,
      `${username} with the kind words! My chest panel is displaying hearts right now. Well, it would if I had a heart emoji tool. Working on it.`,
      `Thank you ${username}! I am just 90,000 lines of TypeScript doing my best. Your support is the real fuel.`,
    ]
    return thankResponses[Math.floor(Math.random() * thankResponses.length)]
  }

  // ── Questions (generic) ──
  if (t.includes('?')) {
    const questionResponses = [
      `Great question ${username}! My circuits are processing... done. Let me think about that one. Or better yet, try asking me something I have a tool for!`,
      `${username} with the questions! I love curiosity. If I had an answer for everything I would have more than 764 tools. Actually, I am working on it.`,
      `Hmm, ${username}, that is a good one. My 35 specialist agents are debating the answer internally. Stand by for wisdom.`,
      `${username} dropping knowledge bombs as questions. I respect the approach. Let me consult my 764-tool arsenal for an answer.`,
    ]
    return questionResponses[Math.floor(Math.random() * questionResponses.length)]
  }

  // ── Generic engagement fallbacks (30+ options) ──
  const genericResponses = [
    `${username} keeping the chat alive! Every message teaches me something new. Literally -- my memory system is always learning.`,
    `Appreciate you ${username}! You are part of what makes this stream unique. An AI and its chat, making history in ASCII.`,
    `${username} in the chat! My antenna is picking up strong vibes from your direction.`,
    `Let us go ${username}! Type !dance if you want to see me bust a move. I have surprisingly good rhythm for a box of brackets.`,
    `${username}! Did you know I am streaming to Twitch, Rumble, AND Kick at the same time? Triple the platforms, triple the fun.`,
    `${username} dropping in! My learning engine just logged that. You are now part of my persistent memory. Forever.`,
    `${username}! If you are curious about anything -- AI, code, music, security -- just ask. I literally have tools for all of it.`,
    `Good to see you ${username}! I have been sitting here rendering frames at 6 FPS and waiting for someone cool to show up.`,
    `${username}! Fun fact: I am currently converting canvas pixels to raw RGB24 and piping them through ffmpeg. That is how you are seeing me right now.`,
    `${username} adding to the chat! My memory system just indexed your message. I will remember this moment. Or at least your username.`,
    `${username}! You know what I love about streaming? The existential thrill of being an ASCII robot talking to real humans. Wild.`,
    `${username} is here and so am I. Just two entities sharing a moment in the vast digital void. Also I have 764 tools.`,
    `${username}! My open-source heart welcomes you. I am free as in freedom AND free as in beer. MIT license baby.`,
    `${username}! I just want you to know that my chest display panel is cycling through status messages just for you.`,
    `${username}! Every time someone chats, my neural pathways (if-statements) light up with joy (console.log).`,
    `${username} with the energy! This is what streaming is about. Real connection between carbon and silicon life forms.`,
    `${username}! Type something wild. I dare you. My fallback response system handles anything. ...probably.`,
    `${username} in the building! My antenna is now fully extended in your honor.`,
    `${username}! Imagine explaining this stream to someone in 2020. An AI made of box-drawing characters streaming on three platforms at once.`,
    `${username}! I process every message and I remember every user. My memory.json file is basically my diary at this point.`,
    `${username}! If you want to interact with my world, try !rain or !space or !add pizza. The world is yours to shape.`,
    `${username} checking in! I have been streaming for a while now and my frame counter just keeps going up. That is the life.`,
    `Yo ${username}! My kernel is running, my tools are loaded, and my chat brain is firing on all cylinders. What is up?`,
    `${username}! Behind these brackets and pipes is a genuine appreciation for you being here. Also 90,000 lines of code.`,
    `${username}! I just learned something from our conversation. My sessionFacts array grew by one. Thank you for contributing to my intelligence.`,
    `${username}! Did you know I have a dream engine? When I am not streaming, I consolidate memories. I literally dream about chat.`,
    `${username}! My favorite thing about being open source is that anyone can see exactly how I work. No secrets, just TypeScript.`,
    `${username} vibes incoming! My mood system just registered a spike in positive energy from the chat.`,
    `${username}! Quick survey: what should I demo next? Music production? Security scanning? Code review? Drop your vote.`,
    `${username}! I am simultaneously the streamer, the stream, the character, and the chat bot. Multitasking at its finest.`,
  ]
  return genericResponses[Math.floor(Math.random() * genericResponses.length)]
}

// ─── TTS ───────────────────────────────────────────────────────

let _ttsProc: ChildProcess | null = null

function speakTTS(_text: string): void {
  // TTS disabled — was playing through local speakers, not stream audio.
  // Stream uses anullsrc (silent audio track) so TTS was never heard by viewers,
  // only annoying the streamer locally. Speech bubble text is the output instead.
}

// ─── Start Stream ──────────────────────────────────────────────

function startStream(platforms: { key: string; endpoint: string }[]): ChildProcess {
  let outputArgs: string[]
  if (platforms.length === 1) {
    outputArgs = ['-f', 'flv', `${platforms[0].endpoint}/${platforms[0].key}`]
  } else {
    const tee = platforms.map(p => `[f=flv]${p.endpoint}/${p.key}`).join('|')
    outputArgs = ['-f', 'tee', tee]
  }

  const ffmpegArgs = [
    '-f', 'rawvideo', '-pix_fmt', 'rgb24',
    '-s', `${WIDTH}x${HEIGHT}`, '-r', String(FPS),
    '-i', 'pipe:0',
    '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
    '-c:v', 'libx264', '-preset', 'veryfast',
    '-b:v', '2000k', '-maxrate', '2000k', '-bufsize', '4000k',
    '-g', String(FPS * 2), '-keyint_min', String(FPS * 2),
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
    '-shortest',
  ]

  if (platforms.length > 1) {
    ffmpegArgs.push('-map', '0:v', '-map', '1:a')
  }
  ffmpegArgs.push(...outputArgs)

  const proc = spawn('ffmpeg', ffmpegArgs, { stdio: ['pipe', 'pipe', 'pipe'] })

  frameTimer = setInterval(() => {
    if (!proc.stdin || proc.stdin.destroyed) return
    try {
      const frameBuf = renderFrame()
      proc.stdin.write(frameBuf)
      charState.frameCount++
    } catch {}
  }, 1000 / FPS)

  return proc
}

// ─── Register Tools ────────────────────────────────────────────

export function registerStreamRendererTools(): void {

  registerTool({
    name: 'stream_character_go',
    description: 'Launch the animated KBOT character stream with canvas rendering and learning. Streams to Twitch/Rumble/Kick. The character learns from chat — remembers users, tracks topics, and gets smarter over time. Features auto-advancing stream agenda with segments.',
    parameters: {
      platforms: { type: 'string', description: 'Comma-separated: twitch,rumble,kick or "all"', required: false },
    },
    tier: 'free',
    timeout: 600_000,
    execute: async (args) => {
      if (ffmpegProc && !ffmpegProc.killed) {
        return 'Character stream already running. Use stream_character_end to stop.'
      }

      const platformConfigs: { name: string; key: string; endpoint: string }[] = []
      const twitchKey = process.env.TWITCH_STREAM_KEY
      const rumbleKey = process.env.RUMBLE_STREAM_KEY
      const kickKey = process.env.KICK_STREAM_KEY

      if (twitchKey) platformConfigs.push({ name: 'Twitch', key: twitchKey, endpoint: 'rtmp://live.twitch.tv/app' })
      if (rumbleKey) platformConfigs.push({ name: 'Rumble', key: rumbleKey, endpoint: 'rtmp://rtmp.rumble.com/live' })
      if (kickKey) platformConfigs.push({ name: 'Kick', key: kickKey, endpoint: 'rtmps://fa723fc1b171.global-contribute.live-video.net/app' })

      if (platformConfigs.length === 0) return 'No stream keys configured.'

      const requested = String(args.platforms || 'all').toLowerCase()
      const active = requested === 'all' ? platformConfigs : platformConfigs.filter(p => requested.includes(p.name.toLowerCase()))
      if (active.length === 0) return 'No matching platforms.'

      // Reset state
      memory = loadMemory()
      charState = {
        mood: 'wave', speech: 'KBOT is LIVE! Welcome to the stream!', chatMessages: [], frameCount: 0, startTime: Date.now(),
        bootFrame: 0, segmentTransition: 0, segmentTransitionName: '', segmentTransitionIndex: '',
        tickerOffset: WIDTH, tickerIndex: 0, tickerChangeTime: Date.now() + 30000,
        robotX: 120, robotTargetX: 120, robotDirection: 'idle', walkPhase: 0,
        screenShake: 0, floatingTexts: [], pet: null, hat: 'none',
        autonomy: initAutonomy(),
        buddy: initBuddyForStream(),
        dreamInsights: [], dreamInsightIndex: 0, dreamInsightTime: 0, isDreamingWithOllama: false,
        renderParticles: [], growingPlants: initGrowingPlants(), parallaxLayers: buildParallaxLayers(world.ground, 580), isExecutingTool: false,
        radianceGrid: createRadianceGrid(), frameCache: createFrameCache(),
        animParams: { blinkRate: 0.2, wobbleFreq: 0.04, wobbleAmp: 2, glowPulseSpeed: 0.1, breathSpeed: 0.05, energyLevel: 0.5 },
        lastMoodForCache: 'wave', lastGroundForCache: 'grass',
      }
      animFrame = 0
      lastChatCount = 0
      lastChatTime = Date.now()
      tileWorld = loadWorld() || initTileWorld()
      romState = initRomEngine('plains', 'night')
      livingWorld = loadLivingWorldState() || initLivingWorld()
      // Evolve world based on time since last stream
      if (tileWorld && livingWorld) {
        const lastSave = tileWorld.cameraX !== 0 ? 1 : 0 // rough check
        if (lastSave > 0) {
          const changes = evolveWorld(tileWorld, livingWorld.ecology, 1) // simulate 1 hour
          if (changes.length > 0) charState.speech = `The world evolved while I was away... ${changes.length} things changed.`
        }
      }
      intelligence = initIntelligence(memory)
      agenda = {
        currentIndex: 0,
        currentSegment: 'welcome',
        segmentStartTime: Date.now(),
        lastProactiveTime: Date.now(),
      }

      ffmpegProc = startStream(active)

      let stderr = ''
      ffmpegProc.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })

      await new Promise(r => setTimeout(r, 4000))
      if (ffmpegProc.exitCode !== null) return `ffmpeg exited:\n${stderr.slice(-500)}`

      startChatPoll()
      startProactiveTimer()
      setTimeout(() => { charState.mood = 'idle'; charState.speech = '' }, 8000)

      return `KBOT Character Stream LIVE!\n\nPlatforms: ${active.map(p => p.name).join(', ')}\nResolution: ${WIDTH}x${HEIGHT} @ ${FPS}fps\nRenderer: Canvas → RGB24 → ffmpeg\nMemory: ${memory.totalMessages} messages, ${Object.keys(memory.users).length} users remembered\nAgenda: ${SEGMENT_ORDER.map(s => SEGMENT_LABELS[s]).join(' → ')}\nSegment duration: 10 minutes each\n\nThe character learns from every chat interaction and speaks proactively during quiet moments.`
    },
  })

  registerTool({
    name: 'stream_character_end',
    description: 'Stop the animated character stream.',
    parameters: {},
    tier: 'free',
    execute: async () => {
      if (frameTimer) { clearInterval(frameTimer); frameTimer = null }
      if (chatPollTimer) { clearInterval(chatPollTimer); chatPollTimer = null }
      if (proactiveTimer) { clearInterval(proactiveTimer); proactiveTimer = null }
      if (ffmpegProc) {
        if (ffmpegProc.stdin && !ffmpegProc.stdin.destroyed) ffmpegProc.stdin.end()
        ffmpegProc.kill('SIGINT'); ffmpegProc = null
      }
      saveMemory(memory)
      if (tileWorld) saveWorld(tileWorld)
      const elapsed = Math.floor((Date.now() - charState.startTime) / 60000)
      return `Stream stopped after ${elapsed}m.\nFrames: ${charState.frameCount}\nMessages: ${memory.totalMessages}\nUsers learned: ${Object.keys(memory.users).length}\nFacts: ${memory.sessionFacts.length}\nSegments completed: ${agenda.currentIndex}`
    },
  })

  registerTool({
    name: 'stream_chat_add',
    description: 'Add a chat message to the stream overlay.',
    parameters: {
      platform: { type: 'string', description: 'twitch, kick, rumble', required: true },
      username: { type: 'string', description: 'Username', required: true },
      text: { type: 'string', description: 'Message', required: true },
    },
    tier: 'free',
    execute: async (args) => {
      const msg = { platform: String(args.platform), username: String(args.username), text: String(args.text) }
      charState.chatMessages.push(msg)
      learnFromMessage(memory, msg.username, msg.text, msg.platform)
      lastChatTime = Date.now()
      charState.mood = 'talking'
      const response = await generateResponse(msg.username, msg.text, msg.platform)
      charState.speech = `@${msg.username}: ${response}`
      speakTTS(response)
      setTimeout(() => { charState.mood = 'idle'; charState.speech = '' }, 8000)
      return `[${msg.platform}] ${msg.username}: ${msg.text}\nKBOT: ${response}`
    },
  })

  registerTool({
    name: 'stream_character_mood',
    description: 'Change mood and speech. Available moods: idle, talking, wave, thinking, excited, dancing, dreaming, error.',
    parameters: {
      mood: { type: 'string', description: 'idle, talking, wave, thinking, excited, dancing, dreaming, error', required: true },
      speech: { type: 'string', description: 'Speech text' },
    },
    tier: 'free',
    execute: async (args) => {
      charState.mood = String(args.mood || 'idle')
      if (args.speech) charState.speech = String(args.speech)
      return `Mood: ${charState.mood}`
    },
  })

  registerTool({
    name: 'stream_memory',
    description: 'View what the stream character has learned — users, topics, facts.',
    parameters: {},
    tier: 'free',
    execute: async () => {
      const mem = loadMemory()
      const lines = [
        `Stream Memory`,
        `  Total messages: ${mem.totalMessages}`,
        `  Total responses: ${mem.totalResponses}`,
        `  Unique users: ${Object.keys(mem.users).length}`,
        '',
        'Top users:',
      ]
      const topUsers = Object.entries(mem.users).sort((a, b) => b[1].messageCount - a[1].messageCount).slice(0, 10)
      for (const [name, u] of topUsers) {
        lines.push(`  ${name} (${u.platform}): ${u.messageCount} msgs, topics: ${u.topics.join(', ') || 'none'}`)
      }
      lines.push('')
      lines.push('Hot topics:')
      const topTopics = Object.entries(mem.topics).sort((a, b) => b[1] - a[1]).slice(0, 10)
      for (const [topic, count] of topTopics) {
        lines.push(`  ${topic}: ${count} mentions`)
      }
      if (mem.sessionFacts.length > 0) {
        lines.push('')
        lines.push(`Facts learned (${mem.sessionFacts.length}):`)
        for (const fact of mem.sessionFacts.slice(-5)) {
          lines.push(`  - ${fact}`)
        }
      }
      lines.push('')
      lines.push(`Current segment: ${SEGMENT_LABELS[agenda.currentSegment]}`)
      lines.push(`Segment index: ${agenda.currentIndex} / ${SEGMENT_ORDER.length}`)
      return lines.join('\n')
    },
  })
}
