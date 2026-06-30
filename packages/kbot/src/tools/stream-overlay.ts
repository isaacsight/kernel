// kbot Stream Overlay — Animated overlays for alerts, goals, notifications
//
// Renders on the stream canvas: alert popups (follow/raid/sub/donation/achievement),
// goal progress bars, scrolling ticker, chat highlights, and a persistent info bar.
// Imported by stream-renderer.ts — uses Canvas 2D API at 6fps.
//
// Tools: overlay_alert, overlay_goal, overlay_ticker, overlay_highlight

import { registerTool } from './index.js'

// ─── Constants ─────────────────────────────────────────────────

const FPS = 6
const SEC = FPS
const ALERT_HOLD = 3 * SEC
const ALERT_ENTER = SEC
const ALERT_EXIT = SEC
const ALERT_TOTAL = ALERT_ENTER + ALERT_HOLD + ALERT_EXIT

// ─── Palette ───────────────────────────────────────────────────
// kernel.chat magazine grammar — POPEYE-anchored editorial.
// Single spot color (tomato). Warm paper ground. Ink + coffee for type.
// Differentiation between alert types lives in the bilingual kicker copy,
// NOT in colour — the press only mixes one spot.

const C = {
  cream: '#F3E9D2',       // --pop-cream — ground
  ivory: '#FAF9F6',       // --pop-ivory — soft inner panel
  ink: '#1F1E1D',         // --pop-ink — primary text
  coffee: '#6B4E3D',      // --pop-coffee — secondary text / dim
  tomato: '#E24E1B',      // --pop-tomato — the spot
  hairlineSoft: 'rgba(31,30,29,0.16)',  // --pop-hairline-soft

  // legacy aliases kept so any caller passing a custom hex still composites;
  // the system itself never reaches for these.
  white: '#FAF9F6',
}

// fonts — JP fallback chain so bilingual kickers render in canvas
const FONT_SERIF = '"EB Garamond", "Hiragino Mincho ProN", "Yu Mincho", serif'
const FONT_MONO  = '"Courier Prime", "Hiragino Mincho ProN", "Yu Mincho", monospace'

// system glyph — leads every folio surface. Tomato spot.
const STAR = '★'

// Live broadcast tagline — the bottom-right anchor on the folio strip.
// Live transmissions don't carry issue numbers (that bookkeeping is the
// magazine surface's, not the broadcast's), so the right edge is the
// publication tagline rather than a dateline monument.
const LIVE_TAGLINE = 'LIVE TRANSMISSION · 生放送'

// ─── Types ─────────────────────────────────────────────────────

export type AlertType = 'follow' | 'raid' | 'sub' | 'donation' | 'achievement'

export interface StreamAlert {
  type: AlertType
  username: string
  viewers?: number
  amount?: number
  title?: string
  message?: string
}

export interface GoalConfig {
  id: string
  label: string
  current: number
  target: number
  color?: string
  position?: 'top' | 'bottom'
}

export interface InfoBarData {
  viewers: number
  uptime: string
  biome: string
  chatRate: number
}

interface ActiveAlert {
  alert: StreamAlert
  frame: number
  particles: Particle[]
}

interface Particle {
  x: number; y: number; vx: number; vy: number
  life: number; maxLife: number; color: string; size: number
}

interface TickerItem { text: string; x: number }

interface HighlightState {
  username: string; message: string; color: string
  frame: number; totalFrames: number
}

// ─── Helpers ───────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t))
}

function easeOut(t: number): number { return 1 - Math.pow(1 - t, 3) }
function easeIn(t: number): number { return t * t * t }
function rng(min: number, max: number): number { return min + Math.random() * (max - min) }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 3) + '...' : s
}

/** Spawn N particles with given config */
function spawnN(n: number, cfg: (i: number) => Omit<Particle, 'life' | 'maxLife'> & { minLife: number; maxLife: number }): Particle[] {
  const out: Particle[] = []
  for (let i = 0; i < n; i++) {
    const c = cfg(i)
    const maxLife = Math.floor(rng(c.minLife, c.maxLife))
    out.push({ x: c.x, y: c.y, vx: c.vx, vy: c.vy, life: maxLife, maxLife, color: c.color, size: c.size })
  }
  return out
}

// Particles read as ink-spatter / newsprint specks, not confetti.
// Tomato spot only. Counts halved — the magazine voice is restraint.
// `follow` stays silent; type alone is the celebration.
function spawnAlertParticles(type: AlertType, cx: number, cy: number): Particle[] {
  if (type === 'raid') {
    return spawnN(14, () => {
      const a = Math.random() * Math.PI * 2, sp = rng(2, 7)
      return { x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, minLife: SEC, maxLife: 2 * SEC, color: C.tomato, size: rng(2, 4) }
    })
  }
  if (type === 'sub' || type === 'donation') {
    return spawnN(12, () => ({
      x: rng(cx - 160, cx + 160), y: cy - 40, vx: rng(-0.6, 0.6), vy: rng(1, 3),
      minLife: 2 * SEC, maxLife: 3 * SEC, color: C.tomato, size: rng(2, 4),
    }))
  }
  if (type === 'achievement') {
    return spawnN(10, (i) => {
      const a = (i / 10) * Math.PI * 2
      return { x: cx + Math.cos(a) * 60, y: cy + Math.sin(a) * 25, vx: Math.cos(a) * 0.4, vy: Math.sin(a) * 0.4 - 0.3, minLife: 2 * SEC, maxLife: 3 * SEC, color: C.tomato, size: rng(2, 3) }
    })
  }
  return []
}

function tickParticles(particles: Particle[]): Particle[] {
  return particles.filter(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.15; return --p.life > 0 })
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const p of particles) {
    ctx.fillStyle = hexToRgba(p.color, Math.min(1, p.life / (p.maxLife * 0.3)))
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size)
  }
}

// ─── Alert Label Maps ──────────────────────────────────────────

// Bracketed bilingual kicker — same grammar as `.pop-kicker` on the site.
// `[CATEGORY · 日本語]`  Latin small-caps + Japanese mono.
const ALERT_KICKERS: Record<AlertType, string> = {
  follow:      '[FOLLOWER · 新規読者]',
  raid:        '[RAID · 来訪]',
  sub:         '[SUBSCRIBER · 定期購読]',
  donation:    '[DONATION · 寄付]',
  achievement: '[ACHIEVEMENT · 達成]',
}

function alertBody(a: StreamAlert): string {
  switch (a.type) {
    case 'follow':      return `${a.username} just followed!`
    case 'raid':        return `${a.username} raided with ${a.viewers ?? 0} viewers!`
    case 'sub':         return `${a.username} subscribed!`
    case 'donation':    return `${a.username} donated $${(a.amount ?? 0).toFixed(2)}!`
    case 'achievement': return a.title ?? 'Unknown Achievement'
    default:            return a.message ?? ''
  }
}

/** Draw L-shaped corner accent */
function drawCorner(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, len: number): void {
  ctx.beginPath()
  ctx.moveTo(x, y + dy * len)
  ctx.lineTo(x, y)
  ctx.lineTo(x + dx * len, y)
  ctx.stroke()
}

// ─── StreamOverlay Class ───────────────────────────────────────

export class StreamOverlay {
  private alertQueue: StreamAlert[] = []
  private activeAlert: ActiveAlert | null = null
  private goals = new Map<string, GoalConfig>()
  private goalAnimations = new Map<string, number>()
  private tickerItems: TickerItem[] = []
  private tickerSpeed = 2
  private highlight: HighlightState | null = null
  private infoBar: InfoBarData = { viewers: 0, uptime: '0:00', biome: 'default', chatRate: 0 }

  queueAlert(alert: StreamAlert): void { this.alertQueue.push(alert) }

  setGoal(goal: GoalConfig): void {
    this.goals.set(goal.id, { ...goal })
    if (!this.goalAnimations.has(goal.id)) this.goalAnimations.set(goal.id, 0)
  }

  updateGoal(id: string, current: number): void {
    const g = this.goals.get(id)
    if (g) g.current = current
  }

  addTicker(text: string): void { this.tickerItems.push({ text, x: -1 }) }

  highlightMessage(username: string, message: string, color?: string): void {
    this.highlight = { username, message, color: color ?? C.tomato, frame: 0, totalFrames: 3 * SEC }
  }

  updateInfoBar(info: InfoBarData): void { this.infoBar = { ...info } }

  tick(_frame: number): void {
    this.tickAlerts(); this.tickGoals(); this.tickTicker(); this.tickHighlight()
  }

  render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.renderGoals(ctx, width, height)
    this.renderTicker(ctx, width, height)
    this.renderInfoBar(ctx, width, height)
    this.renderHighlight(ctx, width, height)
    this.renderAlert(ctx, width, height)
  }

  // ── Alert ──────────────────────────────────────────────────

  private tickAlerts(): void {
    if (!this.activeAlert && this.alertQueue.length > 0) {
      this.activeAlert = { alert: this.alertQueue.shift()!, frame: 0, particles: [] }
    }
    if (!this.activeAlert) return
    const a = this.activeAlert
    a.frame++
    if (a.frame === ALERT_ENTER + 1 && a.particles.length === 0) {
      a.particles = spawnAlertParticles(a.alert.type, 640, 200)
    }
    a.particles = tickParticles(a.particles)
    if (a.frame >= ALERT_TOTAL && a.particles.length === 0) this.activeAlert = null
  }

  private renderAlert(ctx: CanvasRenderingContext2D, width: number, _height: number): void {
    if (!this.activeAlert) return
    const a = this.activeAlert, frame = a.frame

    let alpha = 1, offsetY = 0
    if (frame <= ALERT_ENTER) {
      const t = easeOut(frame / ALERT_ENTER); alpha = t; offsetY = lerp(-50, 0, t)
    } else if (frame > ALERT_ENTER + ALERT_HOLD) {
      const t = easeIn((frame - ALERT_ENTER - ALERT_HOLD) / ALERT_EXIT); alpha = 1 - t; offsetY = lerp(0, -30, t)
    }

    // Editorial alert card: cream stock, ink hairline frame,
    // tomato kicker rule under the bracket label, EB Garamond headline.
    const boxW = 460, boxH = 96
    const boxX = Math.floor((width - boxW) / 2), boxY = 80 + offsetY

    ctx.save()
    ctx.globalAlpha = alpha

    // Cream paper ground
    ctx.fillStyle = C.cream
    ctx.fillRect(boxX, boxY, boxW, boxH)

    // Ink hairline frame
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1
    ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1)

    // Bracketed bilingual kicker — Courier Prime, ink
    ctx.fillStyle = C.ink
    ctx.font = `11px ${FONT_MONO}`
    ctx.textAlign = 'center'
    ctx.fillText(ALERT_KICKERS[a.alert.type] ?? '[ALERT]', boxX + boxW / 2, boxY + 22)

    // Tomato spot rule under the kicker (the .pop-rule--short equivalent)
    const ruleW = 56
    ctx.fillStyle = C.tomato
    ctx.fillRect(boxX + (boxW - ruleW) / 2, boxY + 28, ruleW, 2)

    // Headline body — EB Garamond, italic, ink with username in tomato
    ctx.fillStyle = C.ink
    ctx.font = `italic 22px ${FONT_SERIF}`
    ctx.fillText(truncate(alertBody(a.alert), 42), boxX + boxW / 2, boxY + 60)

    // Optional sub-message — Courier, coffee
    if (a.alert.message && a.alert.type !== 'achievement') {
      ctx.fillStyle = C.coffee
      ctx.font = `11px ${FONT_MONO}`
      ctx.fillText(truncate(a.alert.message, 56), boxX + boxW / 2, boxY + 82)
    }

    ctx.textAlign = 'left'
    ctx.restore()
    drawParticles(ctx, a.particles)
  }

  // ── Goals ──────────────────────────────────────────────────

  private tickGoals(): void {
    for (const [id, goal] of this.goals) {
      const target = Math.min(1, goal.current / goal.target)
      this.goalAnimations.set(id, lerp(this.goalAnimations.get(id) ?? 0, target, 0.15))
    }
  }

  private renderGoals(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (this.goals.size === 0) return
    const barH = 22, barMargin = 8, barX = 24, barW = width - 48
    let idx = 0
    for (const [id, goal] of this.goals) {
      const isTop = (goal.position ?? 'top') === 'top'
      const barY = isTop ? 14 + idx * (barH + barMargin) : height - 64 - idx * (barH + barMargin)
      const fill = this.goalAnimations.get(id) ?? 0

      ctx.save()
      // Ivory inner panel on cream — quieter than full ground swap
      ctx.fillStyle = C.ivory
      ctx.fillRect(barX, barY, barW, barH)
      // Ink hairline frame
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1
      ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1)

      // Tomato fill — single spot
      const fillW = Math.floor(barW * fill)
      if (fillW > 0) {
        ctx.fillStyle = C.tomato
        ctx.fillRect(barX, barY, fillW, barH)
      }
      // Quiet completion glow — tomato breath, not gold
      if (fill >= 0.999) {
        ctx.fillStyle = hexToRgba(C.tomato, 0.08 + 0.04 * Math.sin(Date.now() * 0.003))
        ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4)
      }

      // Label — Courier Prime, ink (or ivory if it's sitting on tomato fill)
      ctx.font = `11px ${FONT_MONO}`; ctx.textAlign = 'left'
      ctx.fillStyle = fillW > 80 ? C.ivory : C.ink
      ctx.fillText(`${goal.label.toUpperCase()} · ${goal.current}/${goal.target}`, barX + 8, barY + 15)
      // Percentage — right side
      const pct = Math.min(100, Math.round((goal.current / goal.target) * 100))
      ctx.textAlign = 'right'
      ctx.fillStyle = fillW > barW - 40 ? C.ivory : C.tomato
      ctx.fillText(`${pct}%`, barX + barW - 8, barY + 15)
      ctx.textAlign = 'left'; ctx.restore()
      idx++
    }
  }

  // ── Ticker ─────────────────────────────────────────────────

  private tickTicker(): void {
    for (const item of this.tickerItems) {
      if (item.x === -1) {
        let rightEdge = 1280
        for (const o of this.tickerItems) {
          if (o !== item && o.x !== -1) {
            const end = o.x + o.text.length * 8 + 40
            if (end > rightEdge) rightEdge = end
          }
        }
        item.x = rightEdge + 30
      }
    }
    for (const item of this.tickerItems) item.x -= this.tickerSpeed
    this.tickerItems = this.tickerItems.filter(item => item.x + item.text.length * 8 + 40 > -10)
  }

  private renderTicker(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (this.tickerItems.length === 0) return
    const tickerH = 26, tickerY = height - 68
    ctx.save()
    // Cream ground for the ticker strip
    ctx.fillStyle = C.cream
    ctx.fillRect(0, tickerY, width, tickerH)
    // Ink hairline above, tomato hairline below (the .pop-rule pair)
    ctx.fillStyle = C.ink
    ctx.fillRect(0, tickerY, width, 1)
    ctx.fillStyle = C.tomato
    ctx.fillRect(0, tickerY + tickerH - 1, width, 1)

    ctx.beginPath(); ctx.rect(0, tickerY, width, tickerH); ctx.clip()
    ctx.font = `12px ${FONT_MONO}`; ctx.textAlign = 'left'
    for (const item of this.tickerItems) {
      // Tomato spot bullet — magazine catalog dot
      ctx.fillStyle = C.tomato
      ctx.fillRect(Math.round(item.x - 14), tickerY + 11, 4, 4)
      // Item text — ink
      ctx.fillStyle = C.ink
      ctx.fillText(item.text, Math.round(item.x), tickerY + 18)
    }
    ctx.restore()
  }

  // ── Highlight ──────────────────────────────────────────────

  private tickHighlight(): void {
    if (!this.highlight) return
    if (++this.highlight.frame >= this.highlight.totalFrames) this.highlight = null
  }

  private renderHighlight(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (!this.highlight) return
    const h = this.highlight, progress = h.frame / h.totalFrames
    let alpha: number
    if (progress < 0.2) alpha = easeOut(progress / 0.2)
    else if (progress > 0.8) alpha = 1 - easeIn((progress - 0.8) / 0.2)
    else alpha = 1

    // Highlighted message reads as a pull-quote: tomato-rule top + bottom,
    // ivory ground, EB Garamond italic body, Courier name.
    const boxW = 540, boxH = 96
    const boxX = Math.floor((width - boxW) / 2), boxY = Math.floor(height / 2 - boxH / 2)

    ctx.save()
    ctx.globalAlpha = alpha

    // Ivory inner panel
    ctx.fillStyle = C.ivory
    ctx.fillRect(boxX, boxY, boxW, boxH)

    // Tomato hairlines top + bottom (pull-quote rules)
    ctx.fillStyle = C.tomato
    ctx.fillRect(boxX, boxY, boxW, 2)
    ctx.fillRect(boxX, boxY + boxH - 2, boxW, 2)

    // Corner ink ticks — quiet, 8px (replaces the heavy double-frame)
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1
    drawCorner(ctx, boxX + 0.5, boxY + 0.5, 1, 1, 8)
    drawCorner(ctx, boxX + boxW - 0.5, boxY + 0.5, -1, 1, 8)
    drawCorner(ctx, boxX + 0.5, boxY + boxH - 0.5, 1, -1, 8)
    drawCorner(ctx, boxX + boxW - 0.5, boxY + boxH - 0.5, -1, -1, 8)

    // Username — Courier Prime, tomato (the cited speaker)
    ctx.fillStyle = C.tomato
    ctx.font = `11px ${FONT_MONO}`
    ctx.textAlign = 'center'
    ctx.fillText(`— ${h.username.toUpperCase()}`, boxX + boxW / 2, boxY + 24)

    // Message — EB Garamond italic, ink (the quote itself)
    ctx.fillStyle = C.ink
    ctx.font = `italic 22px ${FONT_SERIF}`
    ctx.fillText(truncate(h.message, 56), boxX + boxW / 2, boxY + 64)

    ctx.textAlign = 'left'
    ctx.restore()
  }

  // ── Info Bar ───────────────────────────────────────────────

  /**
   * The folio strip — magazine masthead translated into broadcast chrome.
   * Layout (left → right):
   *   ★  KERNEL.CHAT · LIVE  ·  VIEWERS {n}  ·  UPTIME {t}  ·  CHAT {n}/MIN  ·  BIOME {b}    LIVE TRANSMISSION · 生放送
   *
   * Single hairline above. Cream ground. Ink type. Tomato spot on the
   * leading ★ and the live tagline. Mirrors `.pop-folio` on the site,
   * minus the issue-number monument — broadcasts don't carry issues.
   */
  private renderInfoBar(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const barH = 30, barY = height - barH
    ctx.save()

    // Cream ground
    ctx.fillStyle = C.cream
    ctx.fillRect(0, barY, width, barH)

    // Ink hairline above (the .pop-rule)
    ctx.fillStyle = C.ink
    ctx.fillRect(0, barY, width, 1)

    // Leading ★ glyph — tomato spot, the system folio mark
    ctx.fillStyle = C.tomato
    ctx.font = `13px ${FONT_MONO}`
    ctx.textAlign = 'left'
    ctx.fillText(STAR, 12, barY + 20)

    // Wordmark — Courier Prime, ink, all-caps
    ctx.fillStyle = C.ink
    ctx.font = `11px ${FONT_MONO}`
    ctx.fillText('KERNEL.CHAT · LIVE', 28, barY + 20)

    // Meta items — separated by · in Courier
    const info = this.infoBar
    const meta = [
      `VIEWERS ${info.viewers}`,
      `UPTIME ${info.uptime}`,
      `CHAT ${info.chatRate}/MIN`,
      `BIOME ${info.biome.toUpperCase()}`,
    ].join('  ·  ')
    ctx.fillStyle = C.coffee
    ctx.font = `11px ${FONT_MONO}`
    ctx.fillText(meta, 168, barY + 20)

    // Live tagline — bottom-right, tomato. Replaces the magazine's issue
    // monument; broadcasts are transmissions, not issues.
    ctx.fillStyle = C.tomato
    ctx.font = `bold 11px ${FONT_MONO}`
    ctx.textAlign = 'right'
    ctx.fillText(LIVE_TAGLINE, width - 12, barY + 20)

    ctx.textAlign = 'left'
    ctx.restore()
  }
}


// ─── Singleton ─────────────────────────────────────────────────

let overlayInstance: StreamOverlay | null = null

export function getOverlay(): StreamOverlay {
  if (!overlayInstance) overlayInstance = new StreamOverlay()
  return overlayInstance
}

// ─── Tool Registration ─────────────────────────────────────────

export function registerOverlayTools(): void {

registerTool({
  name: 'overlay_alert',
  description:
    'Queue a stream overlay alert. Types: follow, raid, sub, donation, achievement. ' +
    'Alerts display one at a time with enter/hold/exit animations and particle effects.',
  parameters: {
    type: { type: 'string', description: 'Alert type: follow | raid | sub | donation | achievement', required: true },
    username: { type: 'string', description: 'Username to display', required: true },
    viewers: { type: 'number', description: 'Viewer count (for raid alerts)', required: false },
    amount: { type: 'number', description: 'Dollar amount (for donation alerts)', required: false },
    title: { type: 'string', description: 'Achievement title (for achievement alerts)', required: false },
    message: { type: 'string', description: 'Optional custom message below the alert body', required: false },
  },
  tier: 'free',
  execute: async (args) => {
    const type = args.type as AlertType
    const valid: AlertType[] = ['follow', 'raid', 'sub', 'donation', 'achievement']
    if (!valid.includes(type)) return `Invalid alert type: ${type}. Must be one of: ${valid.join(', ')}`
    const alert: StreamAlert = {
      type, username: (args.username as string) || 'Anonymous',
      viewers: args.viewers as number | undefined, amount: args.amount as number | undefined,
      title: args.title as string | undefined, message: args.message as string | undefined,
    }
    getOverlay().queueAlert(alert)
    return `Queued ${type} alert for ${alert.username}`
  },
})

registerTool({
  name: 'overlay_goal',
  description:
    'Set or update a goal progress bar on the stream overlay. ' +
    'Creates the goal if target is provided, otherwise updates current value.',
  parameters: {
    id: { type: 'string', description: 'Unique goal ID (e.g. "followers", "duration")', required: true },
    label: { type: 'string', description: 'Display label (e.g. "Followers")', required: false },
    current: { type: 'number', description: 'Current progress value', required: true },
    target: { type: 'number', description: 'Target value (needed when creating a new goal)', required: false },
    color: { type: 'string', description: 'Bar fill color as hex (default: #3fb950)', required: false },
    position: { type: 'string', description: 'Position: top | bottom (default: top)', required: false },
  },
  tier: 'free',
  execute: async (args) => {
    const overlay = getOverlay(), id = args.id as string, current = args.current as number
    if (args.target !== undefined) {
      overlay.setGoal({
        id, label: (args.label as string) || id, current, target: args.target as number,
        color: args.color as string | undefined, position: (args.position as 'top' | 'bottom') || 'top',
      })
      return `Goal "${id}" set: ${current}/${args.target}`
    }
    overlay.updateGoal(id, current)
    return `Goal "${id}" updated to ${current}`
  },
})

registerTool({
  name: 'overlay_ticker',
  description: 'Add a message to the scrolling ticker at the bottom of the stream overlay. Messages scroll right-to-left continuously.',
  parameters: {
    text: { type: 'string', description: 'Text to add to the scrolling ticker', required: true },
  },
  tier: 'free',
  execute: async (args) => {
    const text = args.text as string
    if (!text) return 'No text provided'
    getOverlay().addTicker(text)
    return `Added to ticker: "${text}"`
  },
})

registerTool({
  name: 'overlay_highlight',
  description: 'Highlight a chat message in the center of the stream for 3 seconds with fancy border and corner accents.',
  parameters: {
    username: { type: 'string', description: 'Username of the message author', required: true },
    message: { type: 'string', description: 'The message to highlight', required: true },
    color: { type: 'string', description: 'Username/border color as hex (default: #6B5B95)', required: false },
  },
  tier: 'free',
  execute: async (args) => {
    const username = args.username as string, message = args.message as string
    if (!username || !message) return 'Username and message are required'
    getOverlay().highlightMessage(username, message, args.color as string | undefined)
    return `Highlighting message from ${username}`
  },
})

} // end registerOverlayTools
