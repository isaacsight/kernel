// kbot Sprite Engine — Pixel art robot character renderer
//
// Draws a 32x48 pixel robot character programmatically using fillRect().
// Designed for the livestream renderer but usable anywhere with a Canvas2D context.

import type { CanvasRenderingContext2D } from 'canvas'

// ─── Color Palette ─────────────────────────────────────────────

const PAL = {
  bodyMain:    '#00cc33',   // terminal green
  bodyDark:    '#009926',   // dark terminal green
  bodyLight:   '#00ff41',   // bright terminal green
  bodyAccent:  '#6B5B95',   // amethyst — chest panel frame
  amber:       '#ffb000',   // secondary accent
  black:       '#1a1a2e',
  white:       '#e6edf3',
  jetOrange:   '#e8820c',
  jetYellow:   '#f0c040',
} as const

const MOOD_COLORS: Record<string, string> = {
  idle:      '#3fb950',
  talking:   '#58a6ff',
  thinking:  '#bc8cff',
  excited:   '#f0c040',
  dancing:   '#ff6ec7',   // starting color, cycles through rainbow
  wave:      '#58a6ff',
  error:     '#f85149',
  dreaming:  '#4a6670',   // muted teal — sleepy
}

const RAINBOW = ['#f85149', '#f0c040', '#3fb950', '#58a6ff', '#bc8cff', '#ff6ec7']

// ─── Helpers ───────────────────────────────────────────────────

function px(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string,
  scale: number, offsetX: number, offsetY: number,
): void {
  ctx.fillStyle = color
  ctx.fillRect(offsetX + x * scale, offsetY + y * scale, w * scale, h * scale)
}

function getMoodColor(mood: string, frame: number, moodColor?: [number, number, number]): string {
  if (moodColor) {
    return `rgb(${moodColor[0]},${moodColor[1]},${moodColor[2]})`
  }
  if (mood === 'dancing') {
    return RAINBOW[frame % RAINBOW.length]
  }
  return MOOD_COLORS[mood] ?? MOOD_COLORS.idle
}

/** Dim a hex color by a factor (0-1, where 1 = full brightness) */
function dimColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const dr = Math.round(r * factor)
  const dg = Math.round(g * factor)
  const db = Math.round(b * factor)
  return `rgb(${dr},${dg},${db})`
}

// ─── Sub-drawers ───────────────────────────────────────────────

function drawAntenna(
  ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number,
  glowColor: string, frame: number,
): void {
  // Antenna sway: pole shifts 1px left/right on sin(frame * 0.5)
  const sway = Math.round(Math.sin(frame * 0.5))

  // Antenna pole: 3px wide, 6px tall, centered on head (head starts at x=10)
  // Head center is at x=16, so antenna at x=14..16 (3px wide)
  px(ctx, 14 + sway, 0, 3, 6, PAL.bodyDark, s, ox, oy)

  // Glowing ball on top — 5x3, uses mood color, pulses between bright and dim
  const pulse = (Math.sin(frame * 1.2) + 1) / 2  // 0..1
  const ballHex = glowColor.startsWith('rgb') ? '#3fb950' : glowColor
  const ballColor = dimColor(ballHex, 0.5 + pulse * 0.5)
  px(ctx, 13 + sway, 0, 5, 3, ballColor, s, ox, oy - 3 * s)
  px(ctx, 15 + sway, 0, 2, 1, PAL.white, s, ox, oy - 3 * s) // highlight dot
}

function drawHead(
  ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number,
  eyeColor: string, mood: string, frame: number, headShiftX: number,
): void {
  const hx = 10 + headShiftX
  const hy = 6

  // Head outline (12x10 with rounded corners)
  px(ctx, hx, hy, 12, 10, PAL.bodyDark, s, ox, oy)
  // Cut corners for rounded look (overwrite with transparent — draw bg-colored)
  px(ctx, hx, hy, 1, 1, 'transparent', s, ox, oy)
  px(ctx, hx + 11, hy, 1, 1, 'transparent', s, ox, oy)
  px(ctx, hx, hy + 9, 1, 1, 'transparent', s, ox, oy)
  px(ctx, hx + 11, hy + 9, 1, 1, 'transparent', s, ox, oy)

  // Head fill (inner area)
  px(ctx, hx + 1, hy + 1, 10, 8, PAL.bodyMain, s, ox, oy)

  // Highlight strip across top
  px(ctx, hx + 2, hy + 1, 8, 1, PAL.bodyLight, s, ox, oy)

  // (#3) Highlight outlines — 1px bright on top-left edges of head
  px(ctx, hx + 1, hy, 10, 1, PAL.bodyLight, s, ox, oy)  // top edge
  px(ctx, hx, hy + 1, 1, 8, PAL.bodyLight, s, ox, oy)   // left edge

  // ── Eyes ──
  const eyeY = hy + 3
  // (#5) Blink every 24 frames (4-second cycle at 6fps) instead of every 4 frames
  const blinkCycle = frame % 24
  const fullBlink = mood === 'idle' && blinkCycle === 23
  const halfBlink = mood === 'idle' && blinkCycle === 22
  // (#9) Dreaming: eyes closed (flat line)
  const eyesClosed = mood === 'dreaming'
  const eyeH = fullBlink || eyesClosed ? 1 : halfBlink ? 2 : 3

  // Eye glow background — dimmed if dreaming
  const eyeC = mood === 'dreaming' ? dimColor(eyeColor.startsWith('rgb') ? '#4a6670' : eyeColor, 0.5) : eyeColor
  px(ctx, hx + 2, eyeY, 3, eyeH, eyeC, s, ox, oy)
  px(ctx, hx + 7, eyeY, 3, eyeH, eyeC, s, ox, oy)

  if (!fullBlink && !eyesClosed) {
    // Pupils — shift based on mood
    // (#8) Eye pupil tracking: shift toward chat panel side (right)
    let pupilOffX = 2  // default: look right toward chat panel
    let pupilOffY = 1
    if (mood === 'idle') { pupilOffX = 2; pupilOffY = 1 }  // look toward chat
    if (mood === 'thinking') { pupilOffX = frame % 2 === 0 ? 0 : 2; pupilOffY = 0 }
    if (mood === 'wave') { pupilOffX = 2; pupilOffY = 0 }
    if (mood === 'dancing') { pupilOffX = frame % 3; pupilOffY = frame % 2 }
    if (mood === 'talking') { pupilOffX = 2; pupilOffY = 1 }  // look at chat

    px(ctx, hx + 2 + pupilOffX, eyeY + pupilOffY, 1, 1, PAL.black, s, ox, oy)
    px(ctx, hx + 7 + pupilOffX, eyeY + pupilOffY, 1, 1, PAL.black, s, ox, oy)
  }

  // ── Mouth ──
  const mouthY = hy + 7
  const mouthX = hx + 3
  drawMouth(ctx, s, ox, oy, mouthX, mouthY, mood, frame)
}

function drawMouth(
  ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number,
  mx: number, my: number, mood: string, frame: number,
): void {
  if (mood === 'talking') {
    // Mouth animation: open/half/wide/closed
    switch (frame % 4) {
      case 0: // open rectangle
        px(ctx, mx, my, 6, 2, PAL.black, s, ox, oy)
        break
      case 1: // half open
        px(ctx, mx + 1, my, 4, 1, PAL.black, s, ox, oy)
        break
      case 2: // wide open
        px(ctx, mx - 1, my, 8, 2, PAL.black, s, ox, oy)
        px(ctx, mx, my, 6, 2, '#f85149', s, ox, oy) // inner red
        break
      case 3: // closed line
        px(ctx, mx, my, 6, 1, PAL.black, s, ox, oy)
        break
    }
  } else if (mood === 'excited') {
    // Big smile / open mouth
    if (frame % 4 === 2) {
      // Wide open
      px(ctx, mx, my, 6, 2, PAL.black, s, ox, oy)
      px(ctx, mx + 1, my, 4, 1, '#f85149', s, ox, oy)
    } else if (frame % 2 === 1) {
      // Neutral
      px(ctx, mx, my, 6, 1, PAL.black, s, ox, oy)
    } else {
      // Smile — line curving up at ends
      px(ctx, mx, my, 6, 1, PAL.black, s, ox, oy)
      px(ctx, mx - 1, my - 1, 1, 1, PAL.black, s, ox, oy) // left upturn
      px(ctx, mx + 6, my - 1, 1, 1, PAL.black, s, ox, oy) // right upturn
    }
  } else if (mood === 'error') {
    // Frown — line curving down at ends
    px(ctx, mx, my, 6, 1, '#f85149', s, ox, oy)
    px(ctx, mx - 1, my + 1, 1, 1, '#f85149', s, ox, oy)
    px(ctx, mx + 6, my + 1, 1, 1, '#f85149', s, ox, oy)
  } else if (mood === 'thinking') {
    // Small O
    px(ctx, mx + 1, my, 3, 2, PAL.black, s, ox, oy)
    px(ctx, mx + 2, my, 1, 1, PAL.bodyMain, s, ox, oy) // hollow center top
  } else if (mood === 'dancing') {
    // Wide smile
    px(ctx, mx, my, 6, 1, PAL.black, s, ox, oy)
    px(ctx, mx - 1, my - 1, 1, 1, PAL.black, s, ox, oy)
    px(ctx, mx + 6, my - 1, 1, 1, PAL.black, s, ox, oy)
  } else if (mood === 'dreaming') {
    // Slight frown / relaxed mouth — sleeping
    px(ctx, mx + 1, my, 4, 1, dimColor('#4a6670', 0.6), s, ox, oy)
  } else {
    // Default: neutral line
    px(ctx, mx, my, 6, 1, PAL.black, s, ox, oy)
  }
}

function drawNeck(
  ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number,
): void {
  // Neck: 4x2 connector at center, below head (head bottom at y=16)
  px(ctx, 14, 16, 4, 2, PAL.bodyDark, s, ox, oy)
  px(ctx, 14, 16, 4, 1, PAL.bodyMain, s, ox, oy)
}

function drawTorso(
  ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number,
  accentColor: string, mood: string, frame: number, bodyShiftY: number,
  torsoWidthBonus: number = 0, torsoHeightPenalty: number = 0,
): void {
  const tx = 8 - Math.floor(torsoWidthBonus / 2)
  const ty = 18 + bodyShiftY
  const tw = 16 + torsoWidthBonus
  const th = 14 - torsoHeightPenalty

  // Torso outline
  px(ctx, tx, ty, tw, th, PAL.bodyDark, s, ox, oy)

  // Torso fill
  px(ctx, tx + 1, ty + 1, tw - 2, th - 2, PAL.bodyMain, s, ox, oy)

  // Highlight strip on top
  px(ctx, tx + 2, ty + 1, tw - 4, 1, PAL.bodyLight, s, ox, oy)

  // (#3) Highlight outlines — 1px bright on top-left edges of shoulders
  px(ctx, tx, ty, tw, 1, PAL.bodyLight, s, ox, oy)  // top edge
  px(ctx, tx, ty, 1, th, PAL.bodyLight, s, ox, oy)  // left edge

  // (#3) Dark gap between torso and legs (hip joint line)
  px(ctx, tx + 1, ty + th - 1, tw - 2, 1, PAL.black, s, ox, oy)

  // Chest display panel frame (amethyst accent)
  px(ctx, 13, ty + 3, 6, 6, PAL.bodyAccent, s, ox, oy)

  // Chest display inner (dark)
  px(ctx, 14, ty + 4, 4, 4, PAL.black, s, ox, oy)

  // Animated display content
  drawChestDisplay(ctx, s, ox, oy, 14, ty + 4, accentColor, mood, frame)

  // (#4) Core glow — 2x2 pixel in center of chest panel, pulses on sine wave
  const corePulse = (Math.sin(frame * 0.8) + 1) / 2  // 0..1
  const coreHex = accentColor.startsWith('rgb') ? '#3fb950' : accentColor
  const coreColor = dimColor(coreHex, 0.6 + corePulse * 0.4)
  px(ctx, 15, ty + 5, 2, 2, coreColor, s, ox, oy)
}

function drawChestDisplay(
  ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number,
  dx: number, dy: number, color: string, mood: string, frame: number,
): void {
  if (mood === 'idle') {
    // Scrolling dots
    const dotPos = frame % 4
    for (let i = 0; i < 4; i++) {
      if (i === dotPos) {
        px(ctx, dx + i, dy + 1, 1, 2, color, s, ox, oy)
      } else {
        px(ctx, dx + i, dy + 2, 1, 1, dimColor(color.startsWith('rgb') ? '#3fb950' : color, 0.3), s, ox, oy)
      }
    }
  } else if (mood === 'talking') {
    // Sound wave bars
    const heights = [1, 3, 2, 4]
    for (let i = 0; i < 4; i++) {
      const h = heights[(i + frame) % 4]
      px(ctx, dx + i, dy + (4 - h), 1, h, color, s, ox, oy)
    }
  } else if (mood === 'dancing') {
    // Music note — shifts each frame
    const nx = dx + (frame % 3)
    px(ctx, nx, dy, 1, 3, color, s, ox, oy)       // stem
    px(ctx, nx, dy, 2, 1, color, s, ox, oy)        // flag
    px(ctx, nx - 1, dy + 2, 2, 2, color, s, ox, oy) // note head
  } else if (mood === 'thinking') {
    // Spinning gear — simplified 4 frame rotation
    const cx = dx + 1
    const cy = dy + 1
    px(ctx, cx, cy, 2, 2, color, s, ox, oy)  // center
    if (frame % 3 === 0) {
      px(ctx, cx - 1, cy, 1, 2, color, s, ox, oy)
      px(ctx, cx + 2, cy, 1, 2, color, s, ox, oy)
    } else if (frame % 3 === 1) {
      px(ctx, cx, cy - 1, 2, 1, color, s, ox, oy)
      px(ctx, cx, cy + 2, 2, 1, color, s, ox, oy)
    } else {
      px(ctx, cx - 1, cy - 1, 1, 1, color, s, ox, oy)
      px(ctx, cx + 2, cy + 2, 1, 1, color, s, ox, oy)
      px(ctx, cx + 2, cy - 1, 1, 1, color, s, ox, oy)
      px(ctx, cx - 1, cy + 2, 1, 1, color, s, ox, oy)
    }
  } else if (mood === 'excited') {
    // Exclamation mark
    px(ctx, dx + 1, dy, 2, 2, color, s, ox, oy)     // top
    px(ctx, dx + 1, dy + 1, 2, 1, color, s, ox, oy)  // mid
    px(ctx, dx + 1, dy + 3, 2, 1, color, s, ox, oy)  // dot
  } else if (mood === 'error') {
    // X mark
    px(ctx, dx, dy, 1, 1, '#f85149', s, ox, oy)
    px(ctx, dx + 3, dy, 1, 1, '#f85149', s, ox, oy)
    px(ctx, dx + 1, dy + 1, 1, 1, '#f85149', s, ox, oy)
    px(ctx, dx + 2, dy + 1, 1, 1, '#f85149', s, ox, oy)
    px(ctx, dx + 1, dy + 2, 1, 1, '#f85149', s, ox, oy)
    px(ctx, dx + 2, dy + 2, 1, 1, '#f85149', s, ox, oy)
    px(ctx, dx, dy + 3, 1, 1, '#f85149', s, ox, oy)
    px(ctx, dx + 3, dy + 3, 1, 1, '#f85149', s, ox, oy)
  } else {
    // Default: single dot
    px(ctx, dx + 1, dy + 1, 2, 2, color, s, ox, oy)
  }
}

interface ArmPose {
  leftAngle: 'down' | 'out' | 'up' | 'up-high'
  rightAngle: 'down' | 'out' | 'up' | 'up-high'
}

function getArmPose(mood: string, frame: number): ArmPose {
  if (mood === 'dancing') {
    const poses: ArmPose[] = [
      { leftAngle: 'up', rightAngle: 'down' },
      { leftAngle: 'down', rightAngle: 'up' },
      { leftAngle: 'out', rightAngle: 'out' },
      { leftAngle: 'up', rightAngle: 'down' },
      { leftAngle: 'down', rightAngle: 'down' },
      { leftAngle: 'out', rightAngle: 'out' },
    ]
    return poses[frame % poses.length]
  }
  if (mood === 'wave') {
    // (#7) Anticipation: frame 0 drops arm slightly (down) before raising
    const rightAngles: Array<'down' | 'up' | 'up-high'> = ['down', 'up', 'up-high', 'up']
    return { leftAngle: 'down', rightAngle: rightAngles[frame % 4] }
  }
  if (mood === 'excited') {
    if (frame % 4 === 0 || frame % 4 === 2) {
      return { leftAngle: 'up', rightAngle: 'up' }
    }
    if (frame % 4 === 2) {
      return { leftAngle: 'out', rightAngle: 'out' }
    }
    return { leftAngle: 'down', rightAngle: 'down' }
  }
  // Default: arms down
  return { leftAngle: 'down', rightAngle: 'down' }
}

function drawArms(
  ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number,
  pose: ArmPose, bodyShiftY: number,
): void {
  const shoulderY = 19 + bodyShiftY

  // Left arm
  drawSingleArm(ctx, s, ox, oy, 'left', 8, shoulderY, pose.leftAngle)

  // Right arm
  drawSingleArm(ctx, s, ox, oy, 'right', 24, shoulderY, pose.rightAngle)
}

function drawSingleArm(
  ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number,
  _side: 'left' | 'right', startX: number, startY: number,
  angle: 'down' | 'out' | 'up' | 'up-high',
): void {
  const isLeft = _side === 'left'

  if (angle === 'down') {
    // Arm hanging straight down: 3px wide, 12px tall
    const ax = isLeft ? startX - 3 : startX
    px(ctx, ax, startY, 3, 12, PAL.bodyDark, s, ox, oy)
    px(ctx, ax, startY, 3, 1, PAL.bodyMain, s, ox, oy) // shoulder highlight
    px(ctx, ax + (isLeft ? 0 : 0), startY + 5, 3, 1, PAL.bodyLight, s, ox, oy) // elbow joint
    // Hand: 4x3
    const hx = isLeft ? ax - 1 : ax
    px(ctx, hx, startY + 12, 4, 3, PAL.bodyDark, s, ox, oy)
    px(ctx, hx + 1, startY + 12, 2, 2, PAL.bodyMain, s, ox, oy)
  } else if (angle === 'out') {
    // Arm stretched horizontally outward
    const dir = isLeft ? -1 : 1
    const ax = isLeft ? startX - 3 : startX
    // Upper arm (3px tall, 6px wide going outward)
    px(ctx, ax + (isLeft ? -6 : 3), startY + 1, 9, 3, PAL.bodyDark, s, ox, oy)
    px(ctx, ax + (isLeft ? -5 : 3), startY + 1, 7, 2, PAL.bodyMain, s, ox, oy)
    // Hand at the end
    const handX = isLeft ? ax - 8 : ax + 12
    px(ctx, handX, startY, 4, 3, PAL.bodyDark, s, ox, oy)
    px(ctx, handX + 1, startY, 2, 2, PAL.bodyMain, s, ox, oy)
    void dir
  } else if (angle === 'up') {
    // Arm raised at ~45 degrees (goes up and out)
    const ax = isLeft ? startX - 3 : startX
    // Segment 1: shoulder to elbow (diagonal — approximate with staircase)
    const dir = isLeft ? -1 : 1
    for (let i = 0; i < 4; i++) {
      px(ctx, ax + dir * i * 2, startY - i * 2, 3, 3, PAL.bodyDark, s, ox, oy)
    }
    // Elbow joint
    const elbowX = ax + dir * 6
    const elbowY = startY - 6
    px(ctx, elbowX, elbowY, 3, 3, PAL.bodyLight, s, ox, oy)
    // Hand at end
    const handX = elbowX + dir * 2
    px(ctx, handX, elbowY - 2, 4, 3, PAL.bodyDark, s, ox, oy)
    px(ctx, handX + 1, elbowY - 2, 2, 2, PAL.bodyMain, s, ox, oy)
  } else if (angle === 'up-high') {
    // Arm straight up
    const ax = isLeft ? startX - 3 : startX
    const dir = isLeft ? -1 : 1
    // Upper segment going up-outward
    for (let i = 0; i < 6; i++) {
      px(ctx, ax + dir * i, startY - i * 2, 3, 2, PAL.bodyDark, s, ox, oy)
    }
    // Hand at top
    const handX = ax + dir * 5
    const handY = startY - 12
    px(ctx, handX, handY, 4, 3, PAL.bodyDark, s, ox, oy)
    px(ctx, handX + 1, handY, 2, 2, PAL.bodyMain, s, ox, oy)
  }
}

function drawLegs(
  ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number,
  bodyShiftY: number, mood: string, frame: number,
  landingSpread: number = 0,
): void {
  const ly = 32 + bodyShiftY
  const legSpread = (mood === 'dancing' && (frame === 2 || frame === 5) ? 1 : 0) + landingSpread

  // (#8) Foot tapping during thinking mood
  const footTap = mood === 'thinking' && frame % 4 < 2 ? -1 : 0

  // Left leg
  px(ctx, 11 - legSpread, ly, 4, 8, PAL.bodyDark, s, ox, oy)
  px(ctx, 12 - legSpread, ly, 2, 7, PAL.bodyMain, s, ox, oy)

  // Right leg
  px(ctx, 17 + legSpread, ly, 4, 8, PAL.bodyDark, s, ox, oy)
  px(ctx, 18 + legSpread, ly, 2, 7, PAL.bodyMain, s, ox, oy)

  // Feet: 5x3 each
  const footY = ly + 8

  // Left foot
  px(ctx, 10 - legSpread, footY, 6, 3, PAL.bodyDark, s, ox, oy)
  px(ctx, 10 - legSpread, footY, 6, 2, PAL.bodyMain, s, ox, oy)
  // (#3) Highlight on top-left edge of left foot
  px(ctx, 10 - legSpread, footY, 6, 1, PAL.bodyLight, s, ox, oy)
  // Jet boot thruster
  px(ctx, 11 - legSpread, footY + 2, 4, 1, PAL.jetOrange, s, ox, oy)
  px(ctx, 12 - legSpread, footY + 2, 2, 1, PAL.jetYellow, s, ox, oy)

  // Right foot (with optional tap)
  px(ctx, 16 + legSpread, footY + footTap, 6, 3, PAL.bodyDark, s, ox, oy)
  px(ctx, 16 + legSpread, footY + footTap, 6, 2, PAL.bodyMain, s, ox, oy)
  // (#3) Highlight on top-left edge of right foot
  px(ctx, 16 + legSpread, footY + footTap, 6, 1, PAL.bodyLight, s, ox, oy)
  // Jet boot thruster
  px(ctx, 17 + legSpread, footY + footTap + 2, 4, 1, PAL.jetOrange, s, ox, oy)
  px(ctx, 18 + legSpread, footY + footTap + 2, 2, 1, PAL.jetYellow, s, ox, oy)
}

// ─── Main Draw Function ───────────────────────────────────────

/**
 * Draw the K:BOT pixel art robot character.
 *
 * @param ctx   - Canvas 2D rendering context
 * @param x     - Top-left X position in canvas pixels
 * @param y     - Top-left Y position in canvas pixels
 * @param scale - Pixel scale multiplier (6-8 recommended for ~200-380px)
 * @param mood  - Current mood: idle, talking, thinking, excited, dancing, wave, error
 * @param frame - Animation frame counter (incrementing integer)
 * @param moodColor - Optional RGB override for mood accent color
 */
// (#7) Settle animation state — tracks bounce after mood change
let _prevMood: string = ''
let _settleFramesRemaining: number = 0

export function drawRobot(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  scale: number,
  mood: string,
  frame: number,
  moodColor?: [number, number, number],
): void {
  const color = getMoodColor(mood, frame, moodColor)
  const s = scale

  // (#7) Settle animation: 3 frames of bounce after mood change
  if (mood !== _prevMood) {
    _settleFramesRemaining = 3
    _prevMood = mood
  }
  let settleShift = 0
  if (_settleFramesRemaining > 0) {
    settleShift = _settleFramesRemaining === 3 ? -1 : _settleFramesRemaining === 2 ? 1 : 0
    _settleFramesRemaining--
  }

  // ── Compute animation offsets ──

  let bodyShiftY = settleShift
  let headShiftX = 0
  let torsoWidthBonus = 0
  let torsoHeightPenalty = 0
  let landingSpread = 0

  if (mood === 'idle') {
    // Breathing: frames 1,3 shift down 1px
    bodyShiftY += (frame % 4 === 1 || frame % 4 === 3) ? 1 : 0
  } else if (mood === 'excited') {
    // (#6 + #7) Squash & stretch: crouch before launch, landing with leg spread
    const jumpPhase = frame % 6
    if (jumpPhase === 0) {
      // Crouch frame (anticipation): body down, wider
      bodyShiftY += 1
      torsoWidthBonus = 2
      torsoHeightPenalty = 1
    } else if (jumpPhase === 1 || jumpPhase === 2) {
      // Launch / jump up
      bodyShiftY += -3
    } else if (jumpPhase === 3) {
      // Peak
      bodyShiftY += -2
    } else if (jumpPhase === 4) {
      // Landing frame — slight leg spread
      bodyShiftY += 0
      landingSpread = 1
    } else {
      bodyShiftY += 0
    }
  } else if (mood === 'dancing') {
    // (#6) Dancing squat: torso widens 2px and shortens 1px on certain frames
    const f = frame % 6
    if (f === 1) headShiftX = 1
    else if (f === 3) { headShiftX = -1 }
    else if (f === 4) {
      bodyShiftY += -2
    }
    // Squat on frames 0 and 5
    if (f === 0 || f === 5) {
      torsoWidthBonus = 2
      torsoHeightPenalty = 1
      bodyShiftY += 1
    }
  } else if (mood === 'thinking') {
    // Head tilt on frame 1
    if (frame % 3 === 1) headShiftX = 1
  } else if (mood === 'dreaming') {
    // (#9) Body slightly slumped
    bodyShiftY += 1
  } else if (mood === 'wave') {
    // (#7) Anticipation: drop arm slightly before raising (frame 0 = anticipation)
    // Handled in getArmPose
  }

  const armPose = getArmPose(mood, frame)

  // ── Clear the bounding area ──
  ctx.clearRect(x - 12 * s, y - 4 * s, 56 * s, 56 * s)

  // ── Draw order: back to front ──

  // 1. Arms (behind body for down pose)
  if (armPose.leftAngle === 'down' && armPose.rightAngle === 'down') {
    drawArms(ctx, s, x, y, armPose, bodyShiftY)
  }

  // 2. Legs and feet
  drawLegs(ctx, s, x, y, bodyShiftY, mood, frame, landingSpread)

  // 3. Torso (body)
  drawTorso(ctx, s, x, y, color, mood, frame, bodyShiftY, torsoWidthBonus, torsoHeightPenalty)

  // 4. Neck
  drawNeck(ctx, s, x, y)

  // 5. Arms (in front for non-down poses)
  if (armPose.leftAngle !== 'down' || armPose.rightAngle !== 'down') {
    drawArms(ctx, s, x, y, armPose, bodyShiftY)
  }

  // 6. Head
  drawHead(ctx, s, x, y, color, mood, frame, headShiftX)

  // 7. Antenna
  drawAntenna(ctx, s, x, y, color, frame)
}

// ─── Mood Particles ────────────────────────────────────────────

/**
 * Draw animated mood particles around the robot.
 *
 * @param ctx   - Canvas 2D rendering context
 * @param x     - Robot top-left X (same as drawRobot)
 * @param y     - Robot top-left Y (same as drawRobot)
 * @param scale - Pixel scale (same as drawRobot)
 * @param mood  - Current mood
 * @param frame - Animation frame counter
 */
export function drawMoodParticles(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  scale: number,
  mood: string,
  frame: number,
): void {
  const s = scale
  const color = getMoodColor(mood, frame)

  if (mood === 'dancing') {
    drawMusicNotes(ctx, s, x, y, frame, color)
  } else if (mood === 'excited') {
    drawSparkles(ctx, s, x, y, frame, color)
  } else if (mood === 'thinking') {
    drawThoughtBubbles(ctx, s, x, y, frame, color)
  } else if (mood === 'talking') {
    drawSoundWaves(ctx, s, x, y, frame, color)
  } else if (mood === 'wave') {
    drawWaveArcs(ctx, s, x, y, frame, color)
  } else if (mood === 'error') {
    drawErrorSparks(ctx, s, x, y, frame)
  } else if (mood === 'dreaming') {
    drawDreamParticles(ctx, s, x, y, frame, color)
  }
}

function drawMusicNotes(
  ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number,
  frame: number, color: string,
): void {
  // Two music notes floating upward at different positions
  const notes = [
    { baseX: 1, baseY: 4, phase: 0 },
    { baseX: 28, baseY: 2, phase: 2 },
    { baseX: 14, baseY: 0, phase: 4 },
  ]

  for (const note of notes) {
    const floatY = ((frame + note.phase) % 8) * -2
    const nx = note.baseX
    const ny = note.baseY + floatY
    if (ny > -8) {
      const c = RAINBOW[(frame + note.phase) % RAINBOW.length]
      // Note head (2x2)
      px(ctx, nx, ny + 3, 2, 2, c, s, ox, oy)
      // Stem (1x3)
      px(ctx, nx + 1, ny, 1, 3, c, s, ox, oy)
      // Flag (2x1)
      px(ctx, nx + 1, ny, 2, 1, c, s, ox, oy)
    }
  }
}

function drawSparkles(
  ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number,
  frame: number, color: string,
): void {
  // Small + shapes that appear at varying positions
  const positions = [
    { x: 0, y: 2 },
    { x: 28, y: 0 },
    { x: 4, y: -4 },
    { x: 26, y: -2 },
  ]

  for (let i = 0; i < positions.length; i++) {
    // Each sparkle appears for 2 frames then disappears for 2
    const visible = ((frame + i * 2) % 4) < 2
    if (!visible) continue

    const p = positions[i]
    // + shape (cross)
    px(ctx, p.x + 1, p.y, 1, 3, color, s, ox, oy)     // vertical
    px(ctx, p.x, p.y + 1, 3, 1, color, s, ox, oy)      // horizontal
  }
}

function drawThoughtBubbles(
  ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number,
  frame: number, color: string,
): void {
  const f = frame % 3

  if (f === 0) {
    // Question mark above head
    // Top curve of ?
    px(ctx, 18, -4, 3, 1, color, s, ox, oy)
    px(ctx, 20, -3, 1, 1, color, s, ox, oy)
    px(ctx, 19, -2, 1, 1, color, s, ox, oy)
    // Dot
    px(ctx, 19, 0, 1, 1, color, s, ox, oy)
  } else if (f === 1) {
    // Three dots (ellipsis) rising up
    px(ctx, 17, -2, 1, 1, color, s, ox, oy)
    px(ctx, 19, -3, 1, 1, color, s, ox, oy)
    px(ctx, 21, -2, 1, 1, color, s, ox, oy)
  } else {
    // Question mark shifted position
    px(ctx, 14, -4, 3, 1, color, s, ox, oy)
    px(ctx, 16, -3, 1, 1, color, s, ox, oy)
    px(ctx, 15, -2, 1, 1, color, s, ox, oy)
    px(ctx, 15, 0, 1, 1, color, s, ox, oy)
  }
}

function drawSoundWaves(
  ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number,
  frame: number, color: string,
): void {
  // Small emanating lines from the right side of the mouth area
  const baseX = 24
  const baseY = 13

  // 3 wave arcs radiating outward
  for (let i = 0; i < 3; i++) {
    const visible = ((frame + i) % 4) < 3
    if (!visible) continue

    const dist = i * 2 + ((frame % 2) * 1)
    const alpha = 1 - i * 0.3

    const c = dimColor(color.startsWith('rgb') ? '#58a6ff' : color, alpha)
    px(ctx, baseX + dist, baseY - 1, 1, 1, c, s, ox, oy)
    px(ctx, baseX + dist + 1, baseY, 1, 1, c, s, ox, oy)
    px(ctx, baseX + dist, baseY + 1, 1, 1, c, s, ox, oy)
  }
}

function drawWaveArcs(
  ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number,
  frame: number, color: string,
): void {
  // Small arc lines from the waving hand (right side, upper area)
  const baseX = 30
  const baseY = 8

  for (let i = 0; i < 2; i++) {
    const visible = ((frame + i) % 4) < 3
    if (!visible) continue

    const dist = i * 3 + (frame % 2)
    const c = dimColor(color.startsWith('rgb') ? '#58a6ff' : color, 0.8 - i * 0.3)

    // Small curved line (3 pixels in an arc)
    px(ctx, baseX + dist, baseY - 1 - i, 1, 1, c, s, ox, oy)
    px(ctx, baseX + dist + 1, baseY - i, 1, 1, c, s, ox, oy)
    px(ctx, baseX + dist, baseY + 1 - i, 1, 1, c, s, ox, oy)
  }
}

function drawErrorSparks(
  ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number,
  frame: number,
): void {
  const red = '#f85149'
  const darkRed = '#a82020'

  // Sparking pixels around the robot
  const sparks = [
    { x: 6, y: 4 },
    { x: 26, y: 8 },
    { x: 3, y: 20 },
    { x: 29, y: 18 },
    { x: 10, y: -2 },
    { x: 22, y: -1 },
  ]

  for (let i = 0; i < sparks.length; i++) {
    const visible = ((frame + i * 3) % 5) < 2
    if (!visible) continue

    const sp = sparks[i]
    const c = (frame + i) % 2 === 0 ? red : darkRed
    px(ctx, sp.x, sp.y, 1, 1, c, s, ox, oy)
    // Small + pattern for some sparks
    if (i % 2 === 0) {
      px(ctx, sp.x - 1, sp.y, 1, 1, darkRed, s, ox, oy)
      px(ctx, sp.x + 1, sp.y, 1, 1, darkRed, s, ox, oy)
    }
  }
}

// (#9) Dream particles — "z z z" floating upward
function drawDreamParticles(
  ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number,
  frame: number, color: string,
): void {
  const mutedColor = dimColor(color.startsWith('rgb') ? '#4a6670' : color, 0.6)

  // Three "z" letters floating up at different phases
  const zees = [
    { baseX: 22, baseY: -2, phase: 0, size: 3 },
    { baseX: 26, baseY: -6, phase: 3, size: 2 },
    { baseX: 20, baseY: -10, phase: 6, size: 1 },
  ]

  for (const z of zees) {
    const floatY = ((frame + z.phase) % 12) * -1
    const ny = z.baseY + floatY
    if (ny > -16) {
      // Draw a simple "z" shape with pixels
      // Top horizontal
      px(ctx, z.baseX, ny, z.size, 1, mutedColor, s, ox, oy)
      // Diagonal (approximate)
      if (z.size > 1) {
        px(ctx, z.baseX + z.size - 1, ny + 1, 1, 1, mutedColor, s, ox, oy)
        if (z.size > 2) px(ctx, z.baseX + 1, ny + 2, 1, 1, mutedColor, s, ox, oy)
      }
      // Bottom horizontal
      px(ctx, z.baseX, ny + z.size, z.size, 1, mutedColor, s, ox, oy)
    }
  }

  // Thought bubble dots leading from head upward
  const dotPhase = frame % 6
  if (dotPhase < 3) {
    px(ctx, 20, -1, 1, 1, mutedColor, s, ox, oy)
  }
  if (dotPhase < 4) {
    px(ctx, 22, -3, 2, 2, mutedColor, s, ox, oy)
  }
}
