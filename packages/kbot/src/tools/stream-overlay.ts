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

const C = {
  bg: '#0d1117', bgPanel: '#161b22', accent: '#6B5B95',
  green: '#3fb950', blue: '#58a6ff', orange: '#d29922',
  red: '#f85149', purple: '#bc8cff', text: '#e6edf3',
  textDim: '#8b949e', gold: '#ffd700', white: '#ffffff',
}

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

function spawnAlertParticles(type: AlertType, cx: number, cy: number): Particle[] {
  if (type === 'raid') {
    return spawnN(30, () => {
      const a = Math.random() * Math.PI * 2, sp = rng(2, 8)
      return { x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, minLife: SEC, maxLife: 3 * SEC, color: pick([C.red, C.orange, C.gold, C.white]), size: rng(2, 5) }
    })
  }
  if (type === 'sub') {
    return spawnN(25, () => ({
      x: rng(cx - 200, cx + 200), y: cy - 40, vx: rng(-1, 1), vy: rng(1, 4),
      minLife: 2 * SEC, maxLife: 4 * SEC, color: pick([C.accent, C.green, C.blue, C.purple, C.gold]), size: rng(3, 6),
    }))
  }
  if (type === 'donation') {
    return spawnN(20, () => ({
      x: rng(cx - 150, cx + 150), y: cy - 60, vx: rng(-0.5, 0.5), vy: rng(1, 3),
      minLife: 2 * SEC, maxLife: 3 * SEC, color: pick([C.gold, C.orange, '#ffed4a']), size: rng(3, 5),
    }))
  }
  if (type === 'achievement') {
    return spawnN(16, (i) => {
      const a = (i / 16) * Math.PI * 2
      return { x: cx + Math.cos(a) * 60, y: cy + Math.sin(a) * 25, vx: Math.cos(a) * 0.5, vy: Math.sin(a) * 0.5 - 0.3, minLife: 2 * SEC, maxLife: 3 * SEC, color: C.gold, size: rng(2, 4) }
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

const ALERT_TITLES: Record<AlertType, string> = {
  follow: 'NEW FOLLOWER', raid: 'RAID INCOMING', sub: 'NEW SUBSCRIBER',
  donation: 'DONATION', achievement: 'ACHIEVEMENT UNLOCKED',
}
const ALERT_COLORS: Record<AlertType, string> = {
  follow: C.green, raid: C.red, sub: C.accent, donation: C.gold, achievement: C.gold,
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
    this.highlight = { username, message, color: color ?? C.accent, frame: 0, totalFrames: 3 * SEC }
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
    const color = ALERT_COLORS[a.alert.type] ?? C.blue

    let alpha = 1, offsetY = 0
    if (frame <= ALERT_ENTER) {
      const t = easeOut(frame / ALERT_ENTER); alpha = t; offsetY = lerp(-50, 0, t)
    } else if (frame > ALERT_ENTER + ALERT_HOLD) {
      const t = easeIn((frame - ALERT_ENTER - ALERT_HOLD) / ALERT_EXIT); alpha = 1 - t; offsetY = lerp(0, -30, t)
    }

    const boxW = 420, boxH = 80
    const boxX = Math.floor((width - boxW) / 2), boxY = 100 + offsetY

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = hexToRgba(C.bgPanel, 0.92)
    ctx.fillRect(boxX, boxY, boxW, boxH)
    ctx.strokeStyle = color; ctx.lineWidth = 2
    ctx.strokeRect(boxX, boxY, boxW, boxH)
    ctx.fillStyle = color
    ctx.fillRect(boxX, boxY, 4, boxH)

    if (a.alert.type === 'achievement' || a.alert.type === 'donation') {
      ctx.fillStyle = hexToRgba(C.gold, 0.15 + 0.1 * Math.sin(frame * 0.5))
      ctx.fillRect(boxX - 3, boxY - 3, boxW + 6, boxH + 6)
    }

    ctx.fillStyle = color
    ctx.font = 'bold 14px "Courier Prime", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(ALERT_TITLES[a.alert.type] ?? 'ALERT', boxX + boxW / 2, boxY + 24)

    ctx.fillStyle = C.text
    ctx.font = '16px "Courier Prime", monospace'
    ctx.fillText(truncate(alertBody(a.alert), 40), boxX + boxW / 2, boxY + 50)

    if (a.alert.message && a.alert.type !== 'achievement') {
      ctx.fillStyle = C.textDim
      ctx.font = '12px "Courier Prime", monospace'
      ctx.fillText(truncate(a.alert.message, 50), boxX + boxW / 2, boxY + 68)
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
    const barH = 22, barMargin = 8, barX = 20, barW = width - 40
    let idx = 0
    for (const [id, goal] of this.goals) {
      const isTop = (goal.position ?? 'top') === 'top'
      const barY = isTop ? 10 + idx * (barH + barMargin) : height - 60 - idx * (barH + barMargin)
      const fill = this.goalAnimations.get(id) ?? 0

      ctx.save()
      ctx.fillStyle = hexToRgba(C.bgPanel, 0.85)
      ctx.fillRect(barX, barY, barW, barH)
      ctx.strokeStyle = hexToRgba(C.accent, 0.5); ctx.lineWidth = 1
      ctx.strokeRect(barX, barY, barW, barH)

      const fillW = Math.floor(barW * fill)
      if (fillW > 0) {
        ctx.fillStyle = hexToRgba(goal.color ?? C.green, 0.8)
        ctx.fillRect(barX, barY, fillW, barH)
        if (fill < 1) { ctx.fillStyle = hexToRgba(C.white, 0.3); ctx.fillRect(barX + fillW - 3, barY, 3, barH) }
      }
      if (fill >= 0.999) {
        ctx.fillStyle = hexToRgba(C.gold, 0.15 + 0.05 * Math.sin(Date.now() * 0.005))
        ctx.fillRect(barX, barY, barW, barH)
      }

      ctx.fillStyle = C.text; ctx.font = '12px "Courier Prime", monospace'; ctx.textAlign = 'left'
      ctx.fillText(`${goal.label}: ${goal.current}/${goal.target}`, barX + 6, barY + 15)
      const pct = Math.min(100, Math.round((goal.current / goal.target) * 100))
      ctx.textAlign = 'right'; ctx.fillStyle = fill >= 0.999 ? C.gold : C.textDim
      ctx.fillText(`${pct}%`, barX + barW - 6, barY + 15)
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
    const tickerH = 24, tickerY = height - 72
    ctx.save()
    ctx.fillStyle = hexToRgba(C.bg, 0.85)
    ctx.fillRect(0, tickerY, width, tickerH)
    ctx.strokeStyle = hexToRgba(C.accent, 0.4); ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, tickerY); ctx.lineTo(width, tickerY)
    ctx.moveTo(0, tickerY + tickerH); ctx.lineTo(width, tickerY + tickerH)
    ctx.stroke()
    ctx.beginPath(); ctx.rect(0, tickerY, width, tickerH); ctx.clip()
    ctx.font = '12px "Courier Prime", monospace'; ctx.textAlign = 'left'
    for (const item of this.tickerItems) {
      ctx.fillStyle = C.accent; ctx.fillRect(Math.round(item.x - 12), tickerY + 10, 4, 4)
      ctx.fillStyle = C.text; ctx.fillText(item.text, Math.round(item.x), tickerY + 16)
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

    const boxW = 500, boxH = 70
    const boxX = Math.floor((width - boxW) / 2), boxY = Math.floor(height / 2 - boxH / 2)

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = hexToRgba(C.bgPanel, 0.95)
    ctx.fillRect(boxX, boxY, boxW, boxH)
    ctx.strokeStyle = hexToRgba(h.color, 0.9); ctx.lineWidth = 2
    ctx.strokeRect(boxX, boxY, boxW, boxH)
    ctx.strokeStyle = hexToRgba(h.color, 0.3); ctx.lineWidth = 1
    ctx.strokeRect(boxX - 3, boxY - 3, boxW + 6, boxH + 6)

    // Corner accents (4 corners via helper)
    ctx.strokeStyle = h.color; ctx.lineWidth = 2
    drawCorner(ctx, boxX, boxY, 1, 1, 12)
    drawCorner(ctx, boxX + boxW, boxY, -1, 1, 12)
    drawCorner(ctx, boxX, boxY + boxH, 1, -1, 12)
    drawCorner(ctx, boxX + boxW, boxY + boxH, -1, -1, 12)

    ctx.fillStyle = h.color
    ctx.font = 'bold 14px "Courier Prime", monospace'; ctx.textAlign = 'center'
    ctx.fillText(h.username, boxX + boxW / 2, boxY + 24)
    ctx.fillStyle = C.text; ctx.font = '16px "Courier Prime", monospace'
    ctx.fillText(truncate(h.message, 50), boxX + boxW / 2, boxY + 48)
    ctx.textAlign = 'left'; ctx.restore()
  }

  // ── Info Bar ───────────────────────────────────────────────

  private renderInfoBar(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const barH = 28, barY = height - barH
    ctx.save()
    ctx.fillStyle = hexToRgba(C.bg, 0.92)
    ctx.fillRect(0, barY, width, barH)
    ctx.strokeStyle = hexToRgba(C.accent, 0.5); ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, barY); ctx.lineTo(width, barY); ctx.stroke()

    const info = this.infoBar
    const items = [
      { label: 'VIEWERS', value: String(info.viewers), color: C.green },
      { label: 'UPTIME', value: info.uptime, color: C.blue },
      { label: 'BIOME', value: info.biome, color: C.accent },
      { label: 'CHAT', value: `${info.chatRate}/min`, color: C.orange },
    ]
    const sectionW = Math.floor(width / items.length)
    ctx.font = '11px "Courier Prime", monospace'; ctx.textAlign = 'left'

    for (let i = 0; i < items.length; i++) {
      const x = i * sectionW + 12, it = items[i]
      ctx.fillStyle = C.textDim; ctx.fillText(it.label, x, barY + 12)
      ctx.fillStyle = it.color; ctx.font = 'bold 12px "Courier Prime", monospace'
      ctx.fillText(it.value, x + it.label.length * 7 + 8, barY + 12)
      ctx.font = '11px "Courier Prime", monospace'
      if (i < items.length - 1) {
        ctx.fillStyle = hexToRgba(C.accent, 0.3)
        ctx.fillRect(i * sectionW + sectionW - 1, barY + 4, 1, barH - 8)
      }
    }

    ctx.textAlign = 'right'; ctx.fillStyle = hexToRgba(C.accent, 0.6)
    ctx.font = '10px "Courier Prime", monospace'
    ctx.fillText('kbot stream', width - 8, barY + 19)
    ctx.textAlign = 'left'; ctx.restore()
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
