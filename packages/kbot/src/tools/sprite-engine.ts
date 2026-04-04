// kbot Sprite Engine — Pixel art robot character renderer
//
// Draws a 34x50 pixel robot character programmatically using fillRect().
// Designed for the livestream renderer but usable anywhere with a Canvas2D context.
// AAA indie pixel art quality: hue-shifted shading, sub-pixel AA, dithering, rim lighting.

import type { CanvasRenderingContext2D } from 'canvas'

// ─── Color Palette (Hue-Shifted) ──────────────────────────────
// Professional pixel art: shadows shift cool (blue-green), highlights shift warm (yellow-green)

const PAL = {
  bodyMain:       '#00cc33',   // mid terminal green
  bodyDark:       '#0a7035',   // shadow — shifted toward blue-green
  bodyDeepShadow: '#064d2a',   // darkest shadow — almost blue-green
  bodyMidLight:   '#2de85c',   // between main and light
  bodyLight:      '#4dff7a',   // highlight — shifted toward yellow-green
  bodySpecular:   '#b0ffc8',   // brightest specular — nearly white-green
  bodyWarmGlow:   '#7aff9a',   // warm light bounce (bottom edges)
  rimLight:       '#40e8a0',   // blue-tinted green rim light (right side)
  outline:        '#043820',   // character outline — almost black-green
  bodyAccent:     '#6B5B95',   // amethyst — chest panel frame
  accentDark:     '#4a3d6e',   // dark amethyst for dithering
  amber:          '#ffb000',   // secondary accent
  black:          '#1a1a2e',
  white:          '#e6edf3',
  jetOrange:      '#e8820c',
  jetYellow:      '#f0c040',
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

/** Checkerboard dithering between two colors over a pixel region */
function dither(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color1: string, color2: string,
  scale: number, ox: number, oy: number,
): void {
  for (let py = 0; py < h; py++) {
    for (let dpx = 0; dpx < w; dpx++) {
      const c = (dpx + py) % 2 === 0 ? color1 : color2
      ctx.fillStyle = c
      ctx.fillRect(ox + (x + dpx) * scale, oy + (y + py) * scale, scale, scale)
    }
  }
}

/** Draw a 1px outline silhouette for a rectangular region */
function outlineRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string, scale: number, ox: number, oy: number,
): void {
  // Outline is 1px larger on all sides
  px(ctx, x - 1, y - 1, w + 2, h + 2, color, scale, ox, oy)
}

// ─── Sub-drawers ───────────────────────────────────────────────

function drawAntenna(
  ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number,
  glowColor: string, frame: number, breathPhase: number = 0,
): void {
  // Antenna sway: pole shifts 1px left/right on sin(frame * 0.5)
  // Breathing adds subtle forward/back sway
  const baseSway = Math.round(Math.sin(frame * 0.5))
  const breathSway = breathPhase === 1 || breathPhase === 2 ? 1 : breathPhase === 4 || breathPhase === 5 ? -1 : 0
  const sway = baseSway + breathSway

  // Outline for antenna pole
  outlineRect(ctx, 14 + sway, 0, 3, 6, PAL.outline, s, ox, oy)

  // Antenna pole: 3px wide, 6px tall, centered on head
  px(ctx, 14 + sway, 0, 3, 6, PAL.bodyDark, s, ox, oy)
  // Hue-shifted highlight on left edge of pole (facing light)
  px(ctx, 14 + sway, 0, 1, 6, PAL.bodyMain, s, ox, oy)

  // Outline for glowing ball
  outlineRect(ctx, 13 + sway, 0, 5, 3, PAL.outline, s, ox, oy - 3 * s)

  // Glowing ball on top — 5x3, uses mood color, pulses between bright and dim
  const pulse = (Math.sin(frame * 1.2) + 1) / 2  // 0..1
  const ballHex = glowColor.startsWith('rgb') ? '#3fb950' : glowColor
  const ballColor = dimColor(ballHex, 0.5 + pulse * 0.5)
  px(ctx, 13 + sway, 0, 5, 3, ballColor, s, ox, oy - 3 * s)

  // Dithered glow edge around antenna ball
  dither(ctx, 12 + sway, 0, 1, 3, ballColor, 'transparent', s, ox, oy - 3 * s)
  dither(ctx, 18 + sway, 0, 1, 3, ballColor, 'transparent', s, ox, oy - 3 * s)

  // Specular highlight dot on antenna ball (technique 8)
  px(ctx, 14 + sway, 0, 1, 1, PAL.bodySpecular, s, ox, oy - 3 * s)
}

function drawHead(
  ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number,
  eyeColor: string, mood: string, frame: number, headShiftX: number,
): void {
  // Chibi proportions: 14x11 head (was 12x10)
  const hx = 9 + headShiftX
  const hy = 5

  // 1px outline silhouette (technique 4)
  outlineRect(ctx, hx, hy, 14, 11, PAL.outline, s, ox, oy)

  // Sub-pixel AA on rounded corners: deep shadow pixels for smoother curves (technique 2)
  px(ctx, hx - 1, hy, 1, 1, PAL.bodyDeepShadow, s, ox, oy)
  px(ctx, hx + 14, hy, 1, 1, PAL.bodyDeepShadow, s, ox, oy)
  px(ctx, hx - 1, hy + 10, 1, 1, PAL.bodyDeepShadow, s, ox, oy)
  px(ctx, hx + 14, hy + 10, 1, 1, PAL.bodyDeepShadow, s, ox, oy)

  // Head base (shadow layer)
  px(ctx, hx, hy, 14, 11, PAL.bodyDark, s, ox, oy)
  // Cut corners for rounded look
  px(ctx, hx, hy, 1, 1, 'transparent', s, ox, oy)
  px(ctx, hx + 13, hy, 1, 1, 'transparent', s, ox, oy)
  px(ctx, hx, hy + 10, 1, 1, 'transparent', s, ox, oy)
  px(ctx, hx + 13, hy + 10, 1, 1, 'transparent', s, ox, oy)

  // Head fill (inner area) — bodyMain
  px(ctx, hx + 1, hy + 1, 12, 9, PAL.bodyMain, s, ox, oy)

  // Top surface: bodyMidLight (facing light source)
  px(ctx, hx + 2, hy + 1, 10, 2, PAL.bodyMidLight, s, ox, oy)

  // Highlight strip across very top
  px(ctx, hx + 2, hy + 1, 10, 1, PAL.bodyLight, s, ox, oy)

  // (#3) Highlight outlines — top-left edges (light source: top-left)
  px(ctx, hx + 1, hy, 12, 1, PAL.bodyLight, s, ox, oy)  // top edge
  px(ctx, hx, hy + 1, 1, 9, PAL.bodyMidLight, s, ox, oy)   // left edge

  // Deep shadow on underside of head
  px(ctx, hx + 1, hy + 9, 12, 1, PAL.bodyDeepShadow, s, ox, oy)

  // Rim light on right edge (technique 6)
  px(ctx, hx + 13, hy + 1, 1, 9, PAL.rimLight, s, ox, oy)

  // Specular highlight dot — top-left brightest point (technique 8)
  px(ctx, hx + 2, hy + 1, 1, 1, PAL.bodySpecular, s, ox, oy)

  // ── Eyes ──
  const eyeY = hy + 4
  // (#5) Blink every 24 frames (4-second cycle at 6fps) instead of every 4 frames
  const blinkCycle = frame % 24
  const fullBlink = mood === 'idle' && blinkCycle === 23
  const halfBlink = mood === 'idle' && blinkCycle === 22
  // (#9) Dreaming: eyes closed (flat line)
  const eyesClosed = mood === 'dreaming'
  const eyeH = fullBlink || eyesClosed ? 1 : halfBlink ? 2 : 3

  // Eye glow background — dimmed if dreaming
  const eyeC = mood === 'dreaming' ? dimColor(eyeColor.startsWith('rgb') ? '#4a6670' : eyeColor, 0.5) : eyeColor
  px(ctx, hx + 2, eyeY, 4, eyeH, eyeC, s, ox, oy)
  px(ctx, hx + 8, eyeY, 4, eyeH, eyeC, s, ox, oy)

  // Specular highlights on eyes — makes them look glassy/alive (technique 8)
  if (!fullBlink && !eyesClosed) {
    px(ctx, hx + 2, eyeY, 1, 1, PAL.bodySpecular, s, ox, oy)
    px(ctx, hx + 8, eyeY, 1, 1, PAL.bodySpecular, s, ox, oy)
  }

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
    px(ctx, hx + 8 + pupilOffX, eyeY + pupilOffY, 1, 1, PAL.black, s, ox, oy)
  }

  // ── Mouth ──
  const mouthY = hy + 8
  const mouthX = hx + 4
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
      case 2: // wide open — animation smear: 1px wider than closed (technique 9)
        px(ctx, mx - 2, my, 10, 2, PAL.black, s, ox, oy)
        px(ctx, mx - 1, my, 8, 2, '#f85149', s, ox, oy) // inner red
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
  outlineRect(ctx, 14, 16, 4, 2, PAL.outline, s, ox, oy)
  px(ctx, 14, 16, 4, 2, PAL.bodyDark, s, ox, oy)
  px(ctx, 14, 16, 4, 1, PAL.bodyMain, s, ox, oy)
  // Rim light on right edge of neck
  px(ctx, 17, 16, 1, 2, PAL.rimLight, s, ox, oy)
}

function drawTorso(
  ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number,
  accentColor: string, mood: string, frame: number, bodyShiftY: number,
  torsoWidthBonus: number = 0, torsoHeightPenalty: number = 0,
): void {
  // Wider torso (18px base) to accommodate larger chest display
  const tx = 7 - Math.floor(torsoWidthBonus / 2)
  const ty = 18 + bodyShiftY
  const tw = 18 + torsoWidthBonus
  const th = 14 - torsoHeightPenalty

  // 1px outline silhouette (technique 4)
  outlineRect(ctx, tx, ty, tw, th, PAL.outline, s, ox, oy)

  // Torso base — deep shadow
  px(ctx, tx, ty, tw, th, PAL.bodyDark, s, ox, oy)

  // Torso fill — main color
  px(ctx, tx + 1, ty + 1, tw - 2, th - 2, PAL.bodyMain, s, ox, oy)

  // Top surface: midLight (facing light)
  px(ctx, tx + 2, ty + 1, tw - 4, 2, PAL.bodyMidLight, s, ox, oy)

  // Highlight strip on very top
  px(ctx, tx + 2, ty + 1, tw - 4, 1, PAL.bodyLight, s, ox, oy)

  // Selective highlights — top and left edge only (light source: top-left)
  px(ctx, tx, ty, tw, 1, PAL.bodyLight, s, ox, oy)  // top edge
  px(ctx, tx, ty, 1, th, PAL.bodyMidLight, s, ox, oy)  // left edge (facing light)

  // Dithered transition on left edge: bodyMain → bodyDark (technique 3)
  dither(ctx, tx + 1, ty + 3, 2, th - 6, PAL.bodyMain, PAL.bodyMidLight, s, ox, oy)

  // Right side in shadow — deep shadow band
  px(ctx, tx + tw - 2, ty + 1, 1, th - 2, PAL.bodyDeepShadow, s, ox, oy)

  // Rim light on right edge (technique 6)
  px(ctx, tx + tw - 1, ty + 1, 1, th - 2, PAL.rimLight, s, ox, oy)

  // Bottom underside shadow
  px(ctx, tx + 1, ty + th - 3, tw - 2, 1, PAL.bodyDeepShadow, s, ox, oy)

  // Warm light bounce on bottom edge (technique 1 — ground bounce)
  px(ctx, tx + 2, ty + th - 2, tw - 4, 1, PAL.bodyWarmGlow, s, ox, oy)

  // Belt line at bottom of torso (1px accent color line)
  px(ctx, tx + 1, ty + th - 2, tw - 2, 1, PAL.bodyAccent, s, ox, oy)

  // Dark gap between torso and legs (hip joint line)
  px(ctx, tx + 1, ty + th - 1, tw - 2, 1, PAL.black, s, ox, oy)

  // Shoulder rivets (1px dots at arm attachment points)
  px(ctx, tx + 1, ty + 1, 1, 1, PAL.amber, s, ox, oy)        // left shoulder rivet
  px(ctx, tx + tw - 2, ty + 1, 1, 1, PAL.amber, s, ox, oy)   // right shoulder rivet

  // Serial number dots on lower torso (3 tiny dots in a row)
  px(ctx, tx + 2, ty + th - 4, 1, 1, PAL.bodyMidLight, s, ox, oy)
  px(ctx, tx + 4, ty + th - 4, 1, 1, PAL.bodyMidLight, s, ox, oy)
  px(ctx, tx + 6, ty + th - 4, 1, 1, PAL.bodyMidLight, s, ox, oy)

  // Bigger chest display panel frame (10x8 amethyst accent)
  px(ctx, 11, ty + 2, 10, 8, PAL.bodyAccent, s, ox, oy)
  // Dithered edge on chest panel frame (technique 3)
  dither(ctx, 10, ty + 2, 1, 8, PAL.bodyAccent, PAL.bodyMain, s, ox, oy)
  dither(ctx, 21, ty + 2, 1, 8, PAL.accentDark, PAL.bodyMain, s, ox, oy)

  // Specular highlight on chest panel frame (technique 8)
  px(ctx, 11, ty + 2, 1, 1, PAL.bodySpecular, s, ox, oy)

  // Chest display inner (8x6 dark)
  px(ctx, 12, ty + 3, 8, 6, PAL.black, s, ox, oy)

  // Animated display content (now using 8x6 inner area)
  drawChestDisplay(ctx, s, ox, oy, 12, ty + 3, accentColor, mood, frame)
}

function drawChestDisplay(
  ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number,
  dx: number, dy: number, color: string, mood: string, frame: number,
): void {
  // Inner display area: 8x6 pixels
  const dimC = dimColor(color.startsWith('rgb') ? '#3fb950' : color, 0.3)

  if (mood === 'idle') {
    // Scrolling sine wave pattern across 8px width
    for (let i = 0; i < 8; i++) {
      const waveY = Math.round(Math.sin((i + frame) * 0.8) * 2) + 2
      px(ctx, dx + i, dy + waveY, 1, 1, color, s, ox, oy)
      // Dimmer trail below
      if (waveY + 1 < 6) px(ctx, dx + i, dy + waveY + 1, 1, 1, dimC, s, ox, oy)
    }
  } else if (mood === 'talking') {
    // Proper audio equalizer bars (8 bars, varying heights)
    const barHeights = [2, 4, 3, 5, 4, 3, 5, 2]
    for (let i = 0; i < 8; i++) {
      const h = Math.min(6, barHeights[(i + frame) % 8])
      px(ctx, dx + i, dy + (6 - h), 1, h, color, s, ox, oy)
    }
  } else if (mood === 'dancing') {
    // Animated music note that bounces
    const bounceY = Math.round(Math.sin(frame * 1.2) * 2)
    const nx = dx + 2 + (frame % 4)
    const noteY = dy + 1 + bounceY
    if (noteY >= dy && noteY + 3 <= dy + 6) {
      px(ctx, nx, noteY, 1, 3, color, s, ox, oy)         // stem
      px(ctx, nx, noteY, 2, 1, color, s, ox, oy)          // flag
      px(ctx, nx - 1, noteY + 2, 2, 1, color, s, ox, oy)  // note head
    }
    // Background pulse dots
    px(ctx, dx, dy + 5, 1, 1, dimC, s, ox, oy)
    px(ctx, dx + 7, dy + 5, 1, 1, dimC, s, ox, oy)
  } else if (mood === 'thinking') {
    // Rotating dots in a circle pattern
    const cx = dx + 3
    const cy = dy + 2
    const positions = [
      [0, -2], [2, -1], [2, 1], [0, 2], [-2, 1], [-2, -1],
    ]
    for (let i = 0; i < positions.length; i++) {
      const active = (frame + i) % positions.length
      const [offX, offY] = positions[i]
      const c = active < 3 ? color : dimC
      px(ctx, cx + offX, cy + offY, 1, 1, c, s, ox, oy)
    }
    // Center dot
    px(ctx, cx, cy, 2, 2, color, s, ox, oy)
  } else if (mood === 'excited') {
    // Pulsing exclamation with radiating lines
    const pulse = frame % 4
    // Center exclamation mark
    px(ctx, dx + 3, dy, 2, 3, color, s, ox, oy)  // bar
    px(ctx, dx + 3, dy + 4, 2, 1, color, s, ox, oy)  // dot
    // Radiating lines
    if (pulse < 2) {
      px(ctx, dx + 1, dy + 1, 1, 1, color, s, ox, oy)  // left
      px(ctx, dx + 6, dy + 1, 1, 1, color, s, ox, oy)  // right
      px(ctx, dx + 3, dy - 1 < dy ? dy : dy, 2, 1, dimC, s, ox, oy)  // top
    }
    if (pulse >= 2) {
      px(ctx, dx, dy + 2, 1, 1, dimC, s, ox, oy)
      px(ctx, dx + 7, dy + 2, 1, 1, dimC, s, ox, oy)
    }
  } else if (mood === 'error') {
    // Animated X that flashes
    const flash = frame % 4 < 2
    const errC = flash ? '#f85149' : '#a82020'
    // X across 8x6
    px(ctx, dx, dy, 1, 1, errC, s, ox, oy)
    px(ctx, dx + 1, dy + 1, 1, 1, errC, s, ox, oy)
    px(ctx, dx + 2, dy + 2, 1, 1, errC, s, ox, oy)
    px(ctx, dx + 3, dy + 3, 1, 1, errC, s, ox, oy)
    px(ctx, dx + 4, dy + 2, 1, 1, errC, s, ox, oy)
    px(ctx, dx + 5, dy + 1, 1, 1, errC, s, ox, oy)
    px(ctx, dx + 6, dy, 1, 1, errC, s, ox, oy)
    // Second diagonal
    px(ctx, dx + 6, dy + 5, 1, 1, errC, s, ox, oy)
    px(ctx, dx + 5, dy + 4, 1, 1, errC, s, ox, oy)
    px(ctx, dx + 4, dy + 3, 1, 1, errC, s, ox, oy)
    px(ctx, dx + 2, dy + 3, 1, 1, errC, s, ox, oy)
    px(ctx, dx + 1, dy + 4, 1, 1, errC, s, ox, oy)
    px(ctx, dx, dy + 5, 1, 1, errC, s, ox, oy)
  } else if (mood === 'dreaming') {
    // Gentle floating Z's
    const floatOff = frame % 8
    const zColor = dimColor(color.startsWith('rgb') ? '#4a6670' : color, 0.6)
    // Small Z
    const zy = dy + 4 - Math.floor(floatOff / 2)
    if (zy >= dy && zy + 2 <= dy + 6) {
      px(ctx, dx + 1, zy, 2, 1, zColor, s, ox, oy)
      px(ctx, dx + 2, zy + 1, 1, 1, zColor, s, ox, oy)
      px(ctx, dx + 1, zy + 2, 2, 1, zColor, s, ox, oy)
    }
    // Larger Z offset
    const zy2 = dy + 2 - Math.floor((floatOff + 4) % 8 / 2)
    if (zy2 >= dy && zy2 + 2 <= dy + 6) {
      px(ctx, dx + 5, zy2, 2, 1, zColor, s, ox, oy)
      px(ctx, dx + 6, zy2 + 1, 1, 1, zColor, s, ox, oy)
      px(ctx, dx + 5, zy2 + 2, 2, 1, zColor, s, ox, oy)
    }
  } else {
    // Default: pulsing center dot
    const pulse = (Math.sin(frame * 0.8) + 1) / 2
    const coreHex = color.startsWith('rgb') ? '#3fb950' : color
    const coreColor = dimColor(coreHex, 0.6 + pulse * 0.4)
    px(ctx, dx + 3, dy + 2, 2, 2, coreColor, s, ox, oy)
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
  pose: ArmPose, bodyShiftY: number, mood: string = 'idle', frame: number = 0,
): void {
  const shoulderY = 19 + bodyShiftY

  // Breathing arm shift: arms shift 1px outward on inhale, inward on exhale (technique 7)
  const breathArmShift = mood === 'idle' ? getBreathArmShift(frame) : 0

  // Left arm
  drawSingleArm(ctx, s, ox, oy, 'left', 8 - breathArmShift, shoulderY, pose.leftAngle, mood, frame)

  // Right arm
  drawSingleArm(ctx, s, ox, oy, 'right', 24 + breathArmShift, shoulderY, pose.rightAngle, mood, frame)
}

/** Get breathing arm shift for the 12-frame breathing cycle */
function getBreathArmShift(frame: number): number {
  const breathFrame = frame % 12
  if (breathFrame >= 1 && breathFrame <= 3) return 1   // inhale: arms outward
  if (breathFrame >= 4 && breathFrame <= 5) return 0   // exhale: back to normal
  return 0
}

function drawSingleArm(
  ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number,
  _side: 'left' | 'right', startX: number, startY: number,
  angle: 'down' | 'out' | 'up' | 'up-high',
  mood: string = 'idle', frame: number = 0,
): void {
  const isLeft = _side === 'left'

  if (angle === 'down') {
    // Arm hanging straight down: 3px wide, 12px tall
    const ax = isLeft ? startX - 3 : startX
    // Outline
    outlineRect(ctx, ax, startY, 3, 12, PAL.outline, s, ox, oy)
    px(ctx, ax, startY, 3, 12, PAL.bodyDark, s, ox, oy)
    px(ctx, ax, startY, 3, 1, PAL.bodyMidLight, s, ox, oy) // shoulder highlight
    px(ctx, ax + (isLeft ? 0 : 2), startY + 1, 1, 10, isLeft ? PAL.bodyMidLight : PAL.rimLight, s, ox, oy) // edge highlight/rim
    px(ctx, ax, startY + 5, 3, 1, PAL.bodyLight, s, ox, oy) // elbow joint
    // Hand: 4x3
    const hx = isLeft ? ax - 1 : ax
    outlineRect(ctx, hx, startY + 12, 4, 3, PAL.outline, s, ox, oy)
    px(ctx, hx, startY + 12, 4, 3, PAL.bodyDark, s, ox, oy)
    px(ctx, hx + 1, startY + 12, 2, 2, PAL.bodyMain, s, ox, oy)
  } else if (angle === 'out') {
    // Arm stretched horizontally outward
    const dir = isLeft ? -1 : 1
    const ax = isLeft ? startX - 3 : startX
    // Outline
    outlineRect(ctx, ax + (isLeft ? -6 : 3), startY + 1, 9, 3, PAL.outline, s, ox, oy)
    // Upper arm (3px tall, 6px wide going outward)
    px(ctx, ax + (isLeft ? -6 : 3), startY + 1, 9, 3, PAL.bodyDark, s, ox, oy)
    px(ctx, ax + (isLeft ? -5 : 3), startY + 1, 7, 2, PAL.bodyMain, s, ox, oy)
    // Top highlight
    px(ctx, ax + (isLeft ? -5 : 3), startY + 1, 7, 1, PAL.bodyMidLight, s, ox, oy)
    // Animation smear trail for dancing fast movement (technique 9)
    if (mood === 'dancing') {
      const smearX = isLeft ? ax + (isLeft ? -8 : 12) + dir * 2 : ax + (isLeft ? -8 : 12) + dir * 2
      px(ctx, smearX, startY + 1, 2, 2, dimColor(PAL.bodyDark, 0.4), s, ox, oy)
    }
    // Hand at the end
    const handX = isLeft ? ax - 8 : ax + 12
    outlineRect(ctx, handX, startY, 4, 3, PAL.outline, s, ox, oy)
    px(ctx, handX, startY, 4, 3, PAL.bodyDark, s, ox, oy)
    px(ctx, handX + 1, startY, 2, 2, PAL.bodyMain, s, ox, oy)
    void dir
  } else if (angle === 'up') {
    // Arm raised at ~45 degrees — smooth 2px-wide pixel-art diagonal
    const ax = isLeft ? startX - 3 : startX
    const dir = isLeft ? -1 : 1
    // Draw smooth diagonal with 2px wide segments
    for (let i = 0; i < 6; i++) {
      // Outline for diagonal segment
      px(ctx, ax + dir * i - 1, startY - i - 1, 4, 3, PAL.outline, s, ox, oy)
    }
    for (let i = 0; i < 6; i++) {
      px(ctx, ax + dir * i, startY - i, 2, 1, PAL.bodyDark, s, ox, oy)
      px(ctx, ax + dir * i, startY - i - 1, 1, 1, PAL.bodyMidLight, s, ox, oy) // highlight edge
      // Sub-pixel AA adjacent to diagonal (technique 2)
      px(ctx, ax + dir * i + (dir > 0 ? 2 : -1), startY - i, 1, 1, dimColor(PAL.bodyMain, 0.4), s, ox, oy)
    }
    // Elbow joint
    const elbowX = ax + dir * 5
    const elbowY = startY - 5
    px(ctx, elbowX, elbowY - 1, 2, 2, PAL.bodyLight, s, ox, oy)
    // Hand at end
    const handX = elbowX + dir * 2
    outlineRect(ctx, handX, elbowY - 3, 4, 3, PAL.outline, s, ox, oy)
    px(ctx, handX, elbowY - 3, 4, 3, PAL.bodyDark, s, ox, oy)
    px(ctx, handX + 1, elbowY - 3, 2, 2, PAL.bodyMain, s, ox, oy)
  } else if (angle === 'up-high') {
    // Arm raised high — smooth 2px-wide pixel-art diagonal going steeper
    const ax = isLeft ? startX - 3 : startX
    const dir = isLeft ? -1 : 1
    // Steep diagonal with 2px wide segments
    for (let i = 0; i < 7; i++) {
      const diagX = ax + dir * Math.floor(i * 0.7)
      const diagY = startY - i * 2
      // Outline
      px(ctx, diagX - 1, diagY - 1, 4, 4, PAL.outline, s, ox, oy)
    }
    for (let i = 0; i < 7; i++) {
      const diagX = ax + dir * Math.floor(i * 0.7)
      const diagY = startY - i * 2
      px(ctx, diagX, diagY, 2, 2, PAL.bodyDark, s, ox, oy)
      if (i % 2 === 0) px(ctx, diagX, diagY, 1, 1, PAL.bodyMidLight, s, ox, oy) // highlight
      // Sub-pixel AA (technique 2)
      px(ctx, diagX + (dir > 0 ? 2 : -1), diagY + 1, 1, 1, dimColor(PAL.bodyMain, 0.3), s, ox, oy)
    }
    // Hand at top
    const handX = ax + dir * 4
    const handY = startY - 14
    outlineRect(ctx, handX, handY, 4, 3, PAL.outline, s, ox, oy)
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
  const legH = 7  // Shortened from 8 for chibi proportions (technique 5)

  // (#8) Foot tapping during thinking mood
  const footTap = mood === 'thinking' && frame % 4 < 2 ? -1 : 0

  // Left leg (facing light — gets highlight)
  outlineRect(ctx, 11 - legSpread, ly, 4, legH, PAL.outline, s, ox, oy)
  px(ctx, 11 - legSpread, ly, 4, legH, PAL.bodyDark, s, ox, oy)
  px(ctx, 12 - legSpread, ly, 2, legH - 1, PAL.bodyMain, s, ox, oy)
  px(ctx, 11 - legSpread, ly, 4, 1, PAL.bodyLight, s, ox, oy)  // top highlight
  px(ctx, 11 - legSpread, ly, 1, legH, PAL.bodyMidLight, s, ox, oy) // left edge highlight

  // Right leg (in shadow — rim light instead)
  outlineRect(ctx, 17 + legSpread, ly, 4, legH, PAL.outline, s, ox, oy)
  px(ctx, 17 + legSpread, ly, 4, legH, PAL.bodyDark, s, ox, oy)
  px(ctx, 18 + legSpread, ly, 2, legH - 1, PAL.bodyMain, s, ox, oy)
  // Rim light on right edge of right leg (technique 6)
  px(ctx, 20 + legSpread, ly + 1, 1, legH - 2, PAL.rimLight, s, ox, oy)

  // Feet: 6x3 each
  const footY = ly + legH

  // Left foot (facing light — gets highlight)
  outlineRect(ctx, 10 - legSpread, footY, 6, 3, PAL.outline, s, ox, oy)
  px(ctx, 10 - legSpread, footY, 6, 3, PAL.bodyDark, s, ox, oy)
  px(ctx, 10 - legSpread, footY, 6, 2, PAL.bodyMain, s, ox, oy)
  px(ctx, 10 - legSpread, footY, 6, 1, PAL.bodyLight, s, ox, oy)  // top highlight
  // Warm glow on bottom edge (light bounce from ground)
  px(ctx, 10 - legSpread, footY + 1, 1, 1, PAL.bodyWarmGlow, s, ox, oy)
  // Jet boot thruster
  px(ctx, 11 - legSpread, footY + 2, 4, 1, PAL.jetOrange, s, ox, oy)
  px(ctx, 12 - legSpread, footY + 2, 2, 1, PAL.jetYellow, s, ox, oy)

  // Right foot (in shadow — rim light, with optional tap)
  outlineRect(ctx, 16 + legSpread, footY + footTap, 6, 3, PAL.outline, s, ox, oy)
  px(ctx, 16 + legSpread, footY + footTap, 6, 3, PAL.bodyDark, s, ox, oy)
  px(ctx, 16 + legSpread, footY + footTap, 6, 2, PAL.bodyMain, s, ox, oy)
  // Rim light on right edge of right foot
  px(ctx, 21 + legSpread, footY + footTap, 1, 2, PAL.rimLight, s, ox, oy)
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
 * @param weather - Optional current weather for weather-character interaction
 * @param isWalking - Optional flag indicating the robot is walking
 * @param walkPhase - Optional walk animation phase (0-3)
 */
// (#7) Settle animation state — tracks bounce after mood change
let _prevMood: string = ''
let _settleFramesRemaining: number = 0
// Snow accumulation counter (increases over time in snow weather)
let _snowAccumulation: number = 0

export function drawRobot(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  scale: number,
  mood: string,
  frame: number,
  moodColor?: [number, number, number],
  weather?: 'clear' | 'rain' | 'snow' | 'storm' | 'stars',
  isWalking?: boolean,
  walkPhase?: number,
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

  // 12-frame breathing cycle (technique 7): 2 seconds at 6fps
  // Frame 0: neutral
  // Frame 1-2: chest rises 1px (slow inhale, torso height +1)
  // Frame 3: hold at top
  // Frame 4-5: chest drops back (exhale)
  // Frame 6-11: rest at neutral
  const breathFrame = frame % 12
  let breathTorsoBonus = 0

  // Walking body bob (1px up/down per step)
  if (isWalking && walkPhase !== undefined) {
    bodyShiftY += (walkPhase % 2 === 0) ? -1 : 0
  }

  if (mood === 'idle') {
    // 12-frame breathing cycle (technique 7)
    if (breathFrame >= 1 && breathFrame <= 3) {
      // Inhale: torso grows 1px taller
      breathTorsoBonus = 1
    } else if (breathFrame >= 4 && breathFrame <= 5) {
      // Exhale: returns to normal
      bodyShiftY += 1
    }
    // Resting frames 6-11: neutral (no shift)
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

  // Weather: snow shiver (1px horizontal shake every few frames)
  let weatherShakeX = 0
  if (weather === 'snow' && frame % 8 < 2) {
    weatherShakeX = frame % 2 === 0 ? 1 : -1
  }
  // Weather: storm flinch on lightning frames
  let stormFlinch = 0
  if (weather === 'storm' && frame % 30 < 2) {
    stormFlinch = 1
    bodyShiftY += 1
  }
  // Weather: rain — slight head tilt
  if (weather === 'rain' && !isWalking) {
    headShiftX += (frame % 6 < 3) ? 1 : 0
  }

  const armPose = isWalking ? getWalkingArmPose(walkPhase || 0) : getArmPose(mood, frame)

  // ── Clear the bounding area ──
  ctx.clearRect(x - 12 * s + weatherShakeX * s, y - 4 * s, 56 * s, 56 * s)
  // Also clear without shake to avoid artifacts
  ctx.clearRect(x - 12 * s, y - 4 * s, 56 * s, 56 * s)

  // Apply weather shake offset
  const drawX = x + weatherShakeX * s

  // ── Drop Shadow (technique 10: dark blue-green, not pure black) ──
  const shadowWidth = 20
  const shadowHeight = 4
  // Shadow smaller when jumping (bodyShiftY < 0), larger on ground
  const jumpFactor = Math.max(0.4, 1 + bodyShiftY * 0.1)
  const shadowW = shadowWidth * jumpFactor
  const shadowH = shadowHeight * jumpFactor
  const shadowCenterX = drawX + 16 * s
  const shadowBottomY = y + 44 * s  // feet bottom area
  ctx.save()
  // Dark blue-green shadow matches terminal green palette (technique 10)
  ctx.fillStyle = 'rgba(6, 40, 30, 0.35)'
  ctx.beginPath()
  ctx.ellipse(shadowCenterX, shadowBottomY, shadowW * s / 2, shadowH * s / 2, 0, 0, Math.PI * 2)
  ctx.fill()
  // Dithered shadow edge for natural falloff (technique 3)
  ctx.fillStyle = 'rgba(6, 40, 30, 0.15)'
  ctx.beginPath()
  ctx.ellipse(shadowCenterX, shadowBottomY, (shadowW + 2) * s / 2, (shadowH + 1) * s / 2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // ── Draw order: back to front ──

  // 1. Arms (behind body for down pose)
  if (armPose.leftAngle === 'down' && armPose.rightAngle === 'down') {
    drawArms(ctx, s, drawX, y, armPose, bodyShiftY, mood, frame)
  }

  // 2. Legs and feet (with walking animation)
  if (isWalking) {
    drawWalkingLegs(ctx, s, drawX, y, bodyShiftY, walkPhase || 0)
  } else {
    drawLegs(ctx, s, drawX, y, bodyShiftY, mood, frame, landingSpread)
  }

  // 3. Torso (body) — pass breathing torso bonus
  drawTorso(ctx, s, drawX, y, color, mood, frame, bodyShiftY, torsoWidthBonus + breathTorsoBonus, torsoHeightPenalty)

  // 4. Neck
  drawNeck(ctx, s, drawX, y)

  // 5. Arms (in front for non-down poses)
  if (armPose.leftAngle !== 'down' || armPose.rightAngle !== 'down') {
    drawArms(ctx, s, drawX, y, armPose, bodyShiftY, mood, frame)
  }

  // 6. Head — animation smear: jump apex stretches body 1px taller (technique 9)
  const jumpSmear = mood === 'excited' && (frame % 6 === 2) ? -1 : 0
  drawHead(ctx, s, drawX, y + jumpSmear * s, color, mood, frame, headShiftX + (stormFlinch ? 1 : 0))

  // 7. Antenna — pass breathFrame for subtle sway during breathing
  drawAntenna(ctx, s, drawX, y + jumpSmear * s, color, frame, breathFrame)

  // ── Weather effects on robot ──
  if (weather === 'rain') {
    // Small blue droplets on head/shoulders
    const dropColor = '#6699cc'
    px(ctx, 12 + headShiftX, 6, 1, 2, dropColor, s, drawX, y)
    px(ctx, 18 + headShiftX, 7, 1, 2, dropColor, s, drawX, y)
    if (frame % 3 === 0) px(ctx, 9, 19, 1, 2, dropColor, s, drawX, y)
  }
  if (weather === 'snow') {
    // White pixels accumulating on head and shoulders
    _snowAccumulation = Math.min(6, _snowAccumulation + 0.05)
    const accum = Math.floor(_snowAccumulation)
    for (let i = 0; i < accum; i++) {
      px(ctx, 11 + headShiftX + i * 2, 6, 2, 1, '#ffffff', s, drawX, y)
    }
    // Shoulder snow
    if (accum > 2) {
      px(ctx, 8, 18 + bodyShiftY, 3, 1, '#ffffff', s, drawX, y)
      px(ctx, 21, 18 + bodyShiftY, 3, 1, '#ffffff', s, drawX, y)
    }
  } else {
    // Reset snow accumulation when not snowing
    _snowAccumulation = Math.max(0, _snowAccumulation - 0.2)
  }
  if (weather === 'storm' && frame % 30 < 2) {
    // Lightning flash — eyes go wide (already handled with stormFlinch for head position)
    // Override eyes to full open white during flash
    const hx = 10 + headShiftX + (stormFlinch ? 1 : 0)
    px(ctx, hx + 2, 9, 3, 3, '#ffffff', s, drawX, y)
    px(ctx, hx + 7, 9, 3, 3, '#ffffff', s, drawX, y)
  }
  if (weather === 'stars') {
    // Twinkle highlights on antenna ball
    const sway = Math.round(Math.sin(frame * 0.5))
    if (frame % 4 < 2) {
      px(ctx, 14 + sway, -1, 1, 1, '#ffffaa', s, drawX, y - 3 * s)
    }
    if (frame % 6 < 2) {
      px(ctx, 17 + sway, 0, 1, 1, '#ffffcc', s, drawX, y - 3 * s)
    }
  }
}

// ─── Walking Animation ────────────────────────────────────────

function getWalkingArmPose(walkPhase: number): ArmPose {
  // Arms swing opposite to legs
  const phase = walkPhase % 4
  if (phase === 0) return { leftAngle: 'down', rightAngle: 'out' }
  if (phase === 1) return { leftAngle: 'down', rightAngle: 'down' }
  if (phase === 2) return { leftAngle: 'out', rightAngle: 'down' }
  return { leftAngle: 'down', rightAngle: 'down' }
}

function drawWalkingLegs(
  ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number,
  bodyShiftY: number, walkPhase: number,
): void {
  const ly = 32 + bodyShiftY
  const phase = walkPhase % 4
  const legH = 7  // Shortened for chibi proportions (technique 5)

  // Alternate leg positions: left leg forward/right back, then swap
  const leftLegOffset = phase === 0 || phase === 1 ? -2 : 2
  const rightLegOffset = phase === 0 || phase === 1 ? 2 : -2

  // Left leg
  outlineRect(ctx, 11 + leftLegOffset, ly, 4, legH, PAL.outline, s, ox, oy)
  px(ctx, 11 + leftLegOffset, ly, 4, legH, PAL.bodyDark, s, ox, oy)
  px(ctx, 12 + leftLegOffset, ly, 2, legH - 1, PAL.bodyMain, s, ox, oy)
  // Left leg highlight (facing light)
  px(ctx, 11 + leftLegOffset, ly, 4, 1, PAL.bodyLight, s, ox, oy)
  px(ctx, 11 + leftLegOffset, ly, 1, legH, PAL.bodyMidLight, s, ox, oy)

  // Right leg
  outlineRect(ctx, 17 + rightLegOffset, ly, 4, legH, PAL.outline, s, ox, oy)
  px(ctx, 17 + rightLegOffset, ly, 4, legH, PAL.bodyDark, s, ox, oy)
  px(ctx, 18 + rightLegOffset, ly, 2, legH - 1, PAL.bodyMain, s, ox, oy)
  // Rim light on right edge (technique 6)
  px(ctx, 20 + rightLegOffset, ly + 1, 1, legH - 2, PAL.rimLight, s, ox, oy)

  // Feet
  const footY = ly + legH
  // Left foot
  outlineRect(ctx, 10 + leftLegOffset, footY, 6, 3, PAL.outline, s, ox, oy)
  px(ctx, 10 + leftLegOffset, footY, 6, 3, PAL.bodyDark, s, ox, oy)
  px(ctx, 10 + leftLegOffset, footY, 6, 2, PAL.bodyMain, s, ox, oy)
  px(ctx, 10 + leftLegOffset, footY, 6, 1, PAL.bodyLight, s, ox, oy)
  px(ctx, 11 + leftLegOffset, footY + 2, 4, 1, PAL.jetOrange, s, ox, oy)

  // Right foot
  outlineRect(ctx, 16 + rightLegOffset, footY, 6, 3, PAL.outline, s, ox, oy)
  px(ctx, 16 + rightLegOffset, footY, 6, 3, PAL.bodyDark, s, ox, oy)
  px(ctx, 16 + rightLegOffset, footY, 6, 2, PAL.bodyMain, s, ox, oy)
  // Rim light on right edge of right foot
  px(ctx, 21 + rightLegOffset, footY, 1, 2, PAL.rimLight, s, ox, oy)
  px(ctx, 17 + rightLegOffset, footY + 2, 4, 1, PAL.jetOrange, s, ox, oy)
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
