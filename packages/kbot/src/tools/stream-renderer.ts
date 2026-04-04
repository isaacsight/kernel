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
import { drawRobot, drawMoodParticles } from './sprite-engine.js'
import { initIntelligence, tickIntelligence, handleIntelligenceCommand, drawBrainPanel, type StreamIntelligence } from './stream-intelligence.js'

const KBOT_DIR = join(homedir(), '.kbot')
const CHAT_BRIDGE_FILE = join(KBOT_DIR, 'stream-chat-live.json')
const MEMORY_FILE = join(KBOT_DIR, 'stream-memory.json')

const WIDTH = 1280
const HEIGHT = 720
const FPS = 6

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
  items: Array<{ name: string; x: number; y: number; emoji: string }>
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
  if (t.includes('make it rain') || t === '!rain') { world.weather = 'rain'; world.particles = []; return 'Rain started!' }
  if (t.includes('make it snow') || t === '!snow') { world.weather = 'snow'; world.particles = []; return 'Snow falling!' }
  if (t.includes('storm') || t === '!storm') { world.weather = 'storm'; world.particles = []; return 'Storm incoming!' }
  if (t.includes('clear sky') || t.includes('stop rain') || t === '!clear') { world.weather = 'clear'; world.particles = []; return 'Skies cleared!' }
  if (t.includes('stars') || t === '!stars') { world.weather = 'stars'; world.particles = []; return 'Stars appeared!' }
  if (t.includes('sunrise') || t === '!sunrise') { world.weather = 'sunrise'; world.timeOfDay = 'dawn'; world.particles = []; return 'The sun is rising!' }

  // Time of day
  if (t === '!night' || t.includes('make it night')) { world.timeOfDay = 'night'; return 'Nighttime!' }
  if (t === '!day' || t.includes('make it day')) { world.timeOfDay = 'day'; return 'Daytime!' }
  if (t === '!sunset') { world.timeOfDay = 'sunset'; return 'Beautiful sunset!' }

  // Ground/biome
  if (t === '!grass' || t.includes('grass world')) { world.ground = 'grass'; return 'Grassy plains!' }
  if (t === '!space' || t.includes('outer space')) { world.ground = 'space'; world.timeOfDay = 'night'; world.weather = 'stars'; world.particles = []; return 'We are in SPACE!' }
  if (t === '!ocean' || t.includes('ocean world')) { world.ground = 'ocean'; return 'Ocean world!' }
  if (t === '!city' || t.includes('city world')) { world.ground = 'city'; return 'City vibes!' }
  if (t === '!lava' || t.includes('lava world')) { world.ground = 'lava'; return 'LAVA WORLD! Hot hot hot!' }

  // Dancing
  if (t === '!dance' || t.includes('dance')) {
    charState.mood = 'dancing'
    setTimeout(() => { charState.mood = 'idle' }, 15000)
    return 'You got it! *busts out the robot dance*'
  }

  // (#18) !pet — happy animation + 1 XP
  if (t === '!pet') {
    charState.mood = 'excited'
    setTimeout(() => { charState.mood = 'idle' }, 5000)
    return '*beep boop* That tickles! My antenna is vibrating with happiness!'
  }

  // (#18) !battle @username — random dice roll
  if (t.startsWith('!battle ')) {
    const opponent = t.replace('!battle ', '').replace('@', '').trim()
    if (!opponent) return 'Usage: !battle @username'
    const roll1 = Math.floor(Math.random() * 20) + 1
    const roll2 = Math.floor(Math.random() * 20) + 1
    const winner = roll1 >= roll2 ? 'challenger' : opponent
    charState.mood = 'excited'
    setTimeout(() => { charState.mood = 'idle' }, 8000)
    if (roll1 === roll2) return `DRAW! Both rolled ${roll1}! The universe refuses to pick a side.`
    if (roll1 > roll2) return `Challenger rolls ${roll1} vs ${opponent}'s ${roll2}. Victory! The crowd goes wild!`
    return `Challenger rolls ${roll1} vs ${opponent}'s ${roll2}. ${opponent} wins! Better luck next time.`
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

  // Items
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
        y: 420 + Math.random() * 60,
        emoji: icon,
      })
      if (world.items.length > 15) world.items.shift()
      return `Spawned a ${itemName}!`
    }
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

  // Advance agenda
  advanceAgenda()

  // Tick intelligence systems
  tickIntelligence(intelligence, animFrame)

  // Update world
  updateParticles()

  // Background (world-aware)
  ctx.fillStyle = world.events.includes('lightning') ? '#ffffff' : getWorldBg()
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Ground
  ctx.fillStyle = getGroundColor()
  ctx.fillRect(0, 490, 570, HEIGHT - 490)

  // (#17) Weather particles as rectangles
  for (const p of world.particles) {
    if (world.weather === 'rain') {
      ctx.fillStyle = '#6699cc'
      ctx.fillRect(p.x, p.y, 2, 8)
    } else if (world.weather === 'snow') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(p.x, p.y, 4, 4)
    } else if (world.weather === 'storm') {
      ctx.fillStyle = '#aaccff'
      ctx.fillRect(p.x, p.y, 2, 12)
    } else if (world.weather === 'stars') {
      ctx.fillStyle = '#ffffaa'
      ctx.fillRect(p.x, p.y, 2, 2)
    } else {
      ctx.fillStyle = '#6699cc'
      ctx.fillRect(p.x, p.y, 2, 6)
    }
  }

  // World items
  ctx.fillStyle = COLORS.text
  ctx.font = '18px "Courier New", monospace'
  for (const item of world.items) {
    ctx.fillText(item.emoji, item.x, item.y)
  }

  // ── Header bar ──
  ctx.fillStyle = COLORS.bgPanel
  ctx.fillRect(0, 0, WIDTH, 60)
  // Header border
  ctx.strokeStyle = COLORS.accent
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(0, 60); ctx.lineTo(WIDTH, 60); ctx.stroke()

  // Title
  ctx.fillStyle = COLORS.accent
  ctx.font = 'bold 28px "Courier New", "Courier", monospace'
  ctx.fillText('K : B O T   L I V E', 40, 40)

  // Current segment badge
  const segLabel = SEGMENT_LABELS[agenda.currentSegment]
  const segElapsed = Math.floor((Date.now() - agenda.segmentStartTime) / 1000)
  const segRemaining = Math.max(0, Math.floor((SEGMENT_DURATION_MS - (Date.now() - agenda.segmentStartTime)) / 1000))
  const segTimeStr = `${Math.floor(segRemaining / 60)}:${String(segRemaining % 60).padStart(2, '0')}`
  ctx.fillStyle = COLORS.accent
  ctx.font = 'bold 14px "Courier New", monospace'
  const segText = `[ ${segLabel} ${segTimeStr} ]`
  ctx.fillText(segText, 330, 40)

  // Viewers counter (proxy from chat message count)
  const viewerEstimate = Math.max(1, Math.floor(memory.totalMessages / 3) + Object.keys(memory.users).length)
  ctx.fillStyle = COLORS.red
  ctx.font = 'bold 14px "Courier New", monospace'
  ctx.fillText(`VIEWERS: ~${viewerEstimate}`, WIDTH - 280, 22)

  // Timer
  const elapsed = Math.floor((Date.now() - charState.startTime) / 1000)
  const timeStr = `${String(Math.floor(elapsed / 3600)).padStart(2, '0')}:${String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`
  ctx.fillStyle = COLORS.textDim
  ctx.font = '20px "Courier New", monospace'
  ctx.fillText(timeStr, WIDTH - 140, 38)

  // Platform indicators
  ctx.font = 'bold 14px "Courier New", monospace'
  const platforms = [
    { name: 'TWITCH', color: COLORS.twitchPurple, x: 460 },
    { name: 'RUMBLE', color: COLORS.rumbleGreen, x: 580 },
    { name: 'KICK', color: COLORS.kickGreen, x: 700 },
  ]
  for (const p of platforms) {
    // Dot
    ctx.fillStyle = p.color
    ctx.beginPath(); ctx.arc(p.x, 33, 5, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = COLORS.text
    ctx.fillText(p.name, p.x + 12, 38)
  }

  // ── Main layout: Robot (left) | Chat (right) ──
  const dividerX = 580

  // Divider line
  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(dividerX, 70); ctx.lineTo(dividerX, HEIGHT - 120); ctx.stroke()

  // ── Robot area (left side) — Pixel Art Sprite ──
  const robotScale = 10
  const robotX = 80
  const robotY = 90
  animFrame++

  // (#20) Robot glow — soft radial gradient behind robot torso
  const glowCenterX = robotX + 16 * robotScale
  const glowCenterY = robotY + 26 * robotScale
  const glowRadius = 10 * robotScale
  const moodColorHex = MOOD_COLORS[charState.mood] ?? COLORS.green
  const grad = ctx.createRadialGradient(glowCenterX, glowCenterY, 0, glowCenterX, glowCenterY, glowRadius)
  grad.addColorStop(0, hexToRgba(moodColorHex, 0.2))
  grad.addColorStop(1, hexToRgba(moodColorHex, 0))
  ctx.fillStyle = grad
  ctx.fillRect(glowCenterX - glowRadius, glowCenterY - glowRadius, glowRadius * 2, glowRadius * 2)

  // Draw the pixel art robot
  drawRobot(ctx, robotX, robotY, robotScale, charState.mood, animFrame)
  drawMoodParticles(ctx, robotX, robotY, robotScale, charState.mood, animFrame)

  // (#10) Stats overlay on right side of robot area
  ctx.fillStyle = COLORS.textDim
  ctx.font = '14px "Courier New", monospace'
  const statsX = dividerX - 160
  const statsY = robotY + 20
  ctx.fillText(`Messages: ${memory.totalMessages}`, statsX, statsY)
  ctx.fillText(`Users: ${Object.keys(memory.users).length}`, statsX, statsY + 18)
  const topTopic = Object.entries(memory.topics).sort((a, b) => b[1] - a[1])[0]
  if (topTopic) ctx.fillText(`Hot topic: ${topTopic[0]}`, statsX, statsY + 36)

  // (#15) XP Leaderboard — top 3 chatters by XP
  const topXP = Object.entries(memory.users)
    .filter(([, u]) => (u as any).xp > 0)
    .sort((a, b) => ((b[1] as any).xp || 0) - ((a[1] as any).xp || 0))
    .slice(0, 3)
  if (topXP.length > 0) {
    ctx.fillStyle = COLORS.orange
    ctx.font = 'bold 13px "Courier New", monospace'
    ctx.fillText('LEADERBOARD', statsX, statsY + 62)
    for (let i = 0; i < topXP.length; i++) {
      const [name, u] = topXP[i]
      const trophy = i === 0 ? '1.' : i === 1 ? '2.' : '3.'
      ctx.fillStyle = i === 0 ? '#f0c040' : i === 1 ? '#c0c0c0' : '#cd7f32'
      ctx.fillText(`${trophy} ${name.slice(0, 12)}: ${(u as any).xp || 0} XP`, statsX, statsY + 80 + i * 16)
    }
  }

  // ── Brain Panel (below leaderboard, bottom-left) ──
  const brainPanelX = statsX - 10
  const brainPanelY = statsY + 140
  const brainPanelW = 170
  const brainPanelH = 110
  drawBrainPanel(ctx as any, intelligence.brain, brainPanelX, brainPanelY, brainPanelW, brainPanelH)

  // ── Evolution Code Overlay (when actively building) ──
  if (intelligence.evolution.active && intelligence.evolution.activeProposal && intelligence.evolution.buildPhase !== 'idle') {
    const evoX = 20
    const evoY = 360
    const evoW = dividerX - 40
    const evoH = 120
    ctx.fillStyle = 'rgba(13, 17, 23, 0.9)'
    ctx.fillRect(evoX, evoY, evoW, evoH)
    ctx.strokeStyle = '#f0c040'
    ctx.lineWidth = 1
    ctx.strokeRect(evoX, evoY, evoW, evoH)

    // Title
    ctx.fillStyle = '#f0c040'
    ctx.font = 'bold 11px "Courier New", monospace'
    ctx.fillText(`BUILDING: ${intelligence.evolution.activeProposal.title.slice(0, 40)}`, evoX + 6, evoY + 14)

    // Phase + progress bar
    const phase = intelligence.evolution.buildPhase
    const phaseDurations: Record<string, number> = { analyzing: 30, writing: 90, testing: 30, deploying: 18, done: 1 }
    const totalF = phaseDurations[phase] || 30
    const pct = Math.min(100, Math.floor((intelligence.evolution.buildProgress / totalF) * 100))
    const filled = Math.floor(pct / 5)
    const bar = '#'.repeat(filled) + '-'.repeat(20 - filled)
    ctx.fillStyle = '#8b949e'
    ctx.font = '10px "Courier New", monospace'
    ctx.fillText(`${phase} [${bar}] ${pct}%`, evoX + 6, evoY + 28)

    // Code preview lines
    ctx.fillStyle = '#3fb950'
    ctx.font = '10px "Courier New", monospace'
    const codeLines = intelligence.evolution.codePreview.slice(-6)
    for (let i = 0; i < codeLines.length; i++) {
      ctx.fillText(codeLines[i].slice(0, 70), evoX + 6, evoY + 42 + i * 13)
    }
  }

  // ── Collab Overlay (when active, below evolution or in same area) ──
  if (intelligence.collab.active) {
    const collabY = (intelligence.evolution.active ? 490 : 360)
    if (collabY < 490) {
      const collabX = 20
      const collabW = dividerX - 40
      const collabH = 80
      ctx.fillStyle = 'rgba(13, 17, 23, 0.85)'
      ctx.fillRect(collabX, collabY, collabW, collabH)
      ctx.strokeStyle = '#58a6ff'
      ctx.lineWidth = 1
      ctx.strokeRect(collabX, collabY, collabW, collabH)

      ctx.fillStyle = '#58a6ff'
      ctx.font = 'bold 11px "Courier New", monospace'
      const collabTitle = intelligence.collab.title || 'Untitled'
      ctx.fillText(`COLLAB [${intelligence.collab.type}]: ${collabTitle.slice(0, 35)}`, collabX + 6, collabY + 14)
      ctx.fillStyle = '#8b949e'
      ctx.font = '10px "Courier New", monospace'
      ctx.fillText(`${intelligence.collab.contributors.size} people | ${intelligence.collab.phase}`, collabX + 6, collabY + 28)
      ctx.fillStyle = '#e6edf3'
      const recentContent = intelligence.collab.content.slice(-3)
      for (let i = 0; i < recentContent.length; i++) {
        ctx.fillText(recentContent[i].slice(0, 65), collabX + 6, collabY + 42 + i * 13)
      }
    }
  }

  // ── Chat area (right side) ──
  ctx.fillStyle = COLORS.text
  ctx.font = 'bold 18px "Courier New", monospace'
  ctx.fillText('Chat', dividerX + 20, 90)

  // Chat border
  ctx.strokeStyle = COLORS.border
  ctx.strokeRect(dividerX + 10, 100, WIDTH - dividerX - 30, HEIGHT - 230)
  ctx.fillStyle = COLORS.bgChat
  ctx.fillRect(dividerX + 11, 101, WIDTH - dividerX - 32, HEIGHT - 232)

  // Chat messages
  ctx.font = '16px "Courier New", monospace'
  const chatY = 125
  const maxChatLines = 18
  const recent = charState.chatMessages.slice(-maxChatLines)

  for (let i = 0; i < recent.length; i++) {
    const msg = recent[i]
    const y = chatY + i * 24

    // Platform badge
    const badge = msg.platform === 'twitch' ? 'TW' : msg.platform === 'kick' ? 'KK' : 'RM'
    const badgeColor = msg.platform === 'twitch' ? COLORS.twitchPurple :
                       msg.platform === 'kick' ? COLORS.kickGreen : COLORS.rumbleGreen
    ctx.fillStyle = badgeColor
    ctx.fillRect(dividerX + 20, y - 12, 28, 18)
    ctx.fillStyle = '#000'
    ctx.font = 'bold 12px "Courier New", monospace'
    ctx.fillText(badge, dividerX + 22, y + 2)

    // Username
    ctx.fillStyle = COLORS.blue
    ctx.font = 'bold 15px "Courier New", monospace'
    ctx.fillText(msg.username, dividerX + 55, y + 2)

    // Message
    ctx.fillStyle = COLORS.text
    ctx.font = '15px "Courier New", monospace'
    const nameWidth = ctx.measureText(msg.username).width
    const msgText = msg.text.slice(0, 40)
    ctx.fillText(msgText, dividerX + 60 + nameWidth, y + 2)
  }

  if (recent.length === 0) {
    ctx.fillStyle = COLORS.textDim
    ctx.font = 'italic 16px "Courier New", monospace'
    ctx.fillText('Waiting for chat...', dividerX + 30, chatY + 10)
  }

  // ── Speech bubble (bottom) — (#13) larger: 150px height, 24px font ──
  const speechBubbleHeight = 150
  const speechY = HEIGHT - speechBubbleHeight - 20  // leave 20px for ticker
  ctx.fillStyle = COLORS.bgPanel
  ctx.fillRect(0, speechY, WIDTH, speechBubbleHeight)

  // (#13) 6px colored left border in accent color
  ctx.fillStyle = COLORS.accent
  ctx.fillRect(0, speechY, 6, speechBubbleHeight)

  // Top border
  ctx.strokeStyle = COLORS.accent
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(0, speechY); ctx.lineTo(WIDTH, speechY); ctx.stroke()

  // Speech icon
  ctx.fillStyle = COLORS.accent
  ctx.font = 'bold 24px "Courier New", monospace'
  ctx.fillText('>', 20, speechY + 40)

  // Speech text — (#13) 24px font
  if (charState.speech) {
    ctx.fillStyle = COLORS.text
    ctx.font = '24px "Courier New", monospace'
    // Word wrap
    const words = charState.speech.split(' ')
    let line = ''
    let lineY = speechY + 40
    for (const word of words) {
      const test = line + word + ' '
      if (ctx.measureText(test).width > WIDTH - 80) {
        ctx.fillText(line.trim(), 50, lineY)
        line = word + ' '
        lineY += 32
        if (lineY > speechY + speechBubbleHeight - 20) break
      } else {
        line = test
      }
    }
    ctx.fillText(line.trim(), 50, lineY)
  } else {
    ctx.fillStyle = COLORS.textDim
    ctx.font = 'italic 20px "Courier New", monospace'
    ctx.fillText('...', 50, speechY + 40)
  }

  // ── (#14) Inner Monologue Ticker — 20px strip at very bottom ──
  const tickerY = HEIGHT - 20
  ctx.fillStyle = '#0d1117'
  ctx.fillRect(0, tickerY, WIDTH, 20)
  // Update ticker thought every ~30 seconds
  if (Date.now() > charState.tickerChangeTime) {
    charState.tickerIndex = (charState.tickerIndex + 1) % INNER_THOUGHTS.length
    charState.tickerChangeTime = Date.now() + 30000
    charState.tickerOffset = WIDTH  // reset scroll to off-screen right
  }
  const thought = INNER_THOUGHTS[charState.tickerIndex]
  ctx.fillStyle = '#ffb000'  // amber
  ctx.font = '14px "Courier New", monospace'
  charState.tickerOffset -= 2  // scroll left
  const textW = ctx.measureText(thought).width
  if (charState.tickerOffset < -textW) charState.tickerOffset = WIDTH
  ctx.fillText(thought, charState.tickerOffset, tickerY + 15)

  // ── Learning indicator (above ticker) ──
  if (memory.totalMessages > 0) {
    ctx.fillStyle = COLORS.purple
    ctx.font = '12px "Courier New", monospace'
    ctx.fillText(`brain: ${memory.sessionFacts.length} facts learned`, 20, tickerY - 4)
  }

  // ── Website URL ──
  ctx.fillStyle = COLORS.accent
  ctx.font = 'bold 14px "Courier New", monospace'
  ctx.fillText('kernel.chat', WIDTH - 140, tickerY - 4)

  // ── Scanline CRT effect ──
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)'
  for (let y = 0; y < HEIGHT; y += 3) {
    ctx.fillRect(0, y, WIDTH, 1)
  }

  // ── (#16) Segment transition overlay ──
  if (charState.segmentTransition > 0) {
    const fadeOut = charState.segmentTransition <= 10
    const alpha = fadeOut ? charState.segmentTransition / 10 * 0.5 : 0.5
    ctx.fillStyle = hexToRgba(COLORS.accent, alpha)
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    // Large centered text
    ctx.fillStyle = `rgba(255,255,255,${fadeOut ? charState.segmentTransition / 10 : 1})`
    ctx.font = 'bold 40px "Courier New", monospace'
    const segText = charState.segmentTransitionName
    const segW = ctx.measureText(segText).width
    ctx.fillText(segText, (WIDTH - segW) / 2, HEIGHT / 2 - 10)
    // Progress indicator
    ctx.font = '24px "Courier New", monospace'
    const progText = charState.segmentTransitionIndex
    const progW = ctx.measureText(progText).width
    ctx.fillText(progText, (WIDTH - progW) / 2, HEIGHT / 2 + 30)
    charState.segmentTransition--
  }

  // ── (#11) Mood-color border — 4px around entire frame ──
  const borderColor = charState.mood === 'dancing'
    ? ['#f85149', '#f0c040', '#3fb950', '#58a6ff', '#bc8cff', '#ff6ec7'][animFrame % 6]
    : MOOD_COLORS[charState.mood] ?? COLORS.green
  ctx.strokeStyle = borderColor
  ctx.lineWidth = 4
  ctx.strokeRect(2, 2, WIDTH - 4, HEIGHT - 4)

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

          // (#19) Wake from dreaming immediately when a new message arrives
          if (charState.mood === 'dreaming') {
            charState.mood = 'idle'
            charState.speech = ''
          }

          // Learn from message
          learnFromMessage(memory, msg.username, msg.text, msg.platform)

          // Check intelligence commands (evolution, brain, collab)
          const intelResult = handleIntelligenceCommand(msg.text, msg.username, intelligence)

          // Check for world commands
          const worldResult = !intelResult ? parseWorldCommand(msg.text) : null

          // React
          charState.mood = 'talking'
          const responsePromise = intelResult
            ? Promise.resolve(intelResult)
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

    // (#19) Dream mode — 5+ minutes of no chat
    if (silenceSeconds >= 300 && charState.mood !== 'dreaming') {
      charState.mood = 'dreaming'
      // Generate dream content from conversation topics
      const topicKeys = Object.keys(memory.topics)
      const biomes = ['forest', 'ocean', 'space station', 'city', 'mountain', 'desert', 'cave']
      const items = ['floating keyboard', 'glowing antenna', 'dancing cursor', 'spinning gear', 'binary tree', 'recursive loop']
      const topic = topicKeys.length > 0 ? topicKeys[Math.floor(Math.random() * topicKeys.length)] : 'code'
      const biome = biomes[Math.floor(Math.random() * biomes.length)]
      const item = items[Math.floor(Math.random() * items.length)]
      charState.speech = `Dreaming about ${topic} in a ${biome} while a ${item} watches...`
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
        model: 'kernel:latest',
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
    return jokes[Math.floor(Math.random() * jokes.length)]
  }

  // ── Stream commands / help ──
  if (t.includes('command') || t.includes('help') || t.includes('what can i do') || t === '!help') {
    return `Try these: !rain !snow !storm !stars !space !lava !city !ocean !dance !add <item> !clear items. You control the world!`
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

function speakTTS(text: string): void {
  if (_ttsProc && !_ttsProc.killed) _ttsProc.kill()
  const clean = text.replace(/["`$\\]/g, '').replace(/\n/g, ' ').slice(0, 300)
  if (osPlatform() === 'darwin') {
    _ttsProc = spawn('say', ['-v', 'Zarvox', '-r', '180', clean], { stdio: 'ignore' })
  }
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
      }
      animFrame = 0
      lastChatCount = 0
      lastChatTime = Date.now()
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
