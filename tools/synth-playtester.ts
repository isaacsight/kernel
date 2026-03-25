#!/usr/bin/env npx tsx
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SYNTH AI Playtester
// Launches headless browser sessions, plays SYNTH using keyboard/mouse
// simulation, records metrics, and generates a balance/feel critique report.
//
// Usage:
//   npx tsx tools/synth-playtester.ts
//   npx tsx tools/synth-playtester.ts --sessions 20 --headed --url http://localhost:5173
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { chromium, type Page, type Browser } from 'playwright'

// ── CLI Args ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2)

function getArg(name: string, fallback: string): string {
  const idx = args.indexOf(`--${name}`)
  if (idx === -1 || idx + 1 >= args.length) return fallback
  return args[idx + 1]
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`)
}

const NUM_SESSIONS = parseInt(getArg('sessions', '10'), 10)
const GAME_URL = getArg('url', 'http://localhost:5173')
const HEADED = hasFlag('headed')
const RECORD = hasFlag('record')
const MAX_SESSION_MS = parseInt(getArg('timeout', '120000'), 10)  // 2 min max per session

// ── Types ─────────────────────────────────────────────────────────────────

interface SynthGameState {
  scene: 'boot' | 'dungeon' | 'gameover'
  elapsed: number
  player: { x: number; y: number; hp: number; maxHp: number; alive: boolean }
  partner: { x: number; y: number; hp: number; maxHp: number; alive: boolean; directive: string }
  enemies: Array<{ id: string; x: number; y: number; hp: number; maxHp: number; state: string; alive: boolean }>
  boss: { hp: number; maxHp: number; alive: boolean; phase: number } | null
  stats: { kills: number; damageDealt: number; damageTaken: number }
  gameOver: boolean
  won: boolean | null
}

// Window type augmentation (mirrors DebugAPI's SynthDebugHandle)
declare global {
  interface Window {
    __SYNTH__?: {
      getState: () => SynthGameState
      pressKey: (key: string) => void
      releaseKey: (key: string) => void
      moveMouse: (x: number, y: number) => void
      click: () => void
      releaseClick: () => void
    }
  }
}

interface SessionResult {
  duration: number
  kills: number
  damageDealt: number
  damageTaken: number
  won: boolean
  bossPhaseReached: number
  partnerAliveAtEnd: boolean
  partnerHpAtEnd: number
  causeOfDeath: string
  events: string[]
  killTimestamps: number[]
  earlyDeath: boolean  // died within 10s
}

// ── Strategy helpers ──────────────────────────────────────────────────────

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2)
}

function findNearestEnemy(state: SynthGameState): { x: number; y: number; dist: number; id: string; hp: number; state: string } | null {
  const alive = state.enemies.filter(e => e.alive && e.hp > 0)
  // Include boss if alive
  const targets: Array<{ x: number; y: number; dist: number; id: string; hp: number; state: string }> = alive.map(e => ({
    x: e.x,
    y: e.y,
    dist: distance(state.player.x, state.player.y, e.x, e.y),
    id: e.id,
    hp: e.hp,
    state: e.state,
  }))
  if (state.boss?.alive) {
    // Boss sprite position isn't in the state enemies list — approximate from center of arena
    // The debug state includes boss separately; we don't have x/y for boss from the interface
    // So we treat boss as a high-priority target at a rough center
    // Actually: enemies array should contain boss info from DungeonScene debug update...
    // Boss is NOT in the enemies array in the debug API — it's a separate field.
    // We'll aim toward center-right of the room (where boss spawns) as approximation.
    targets.push({
      x: 528, // 16.5 * 32 — boss spawn area
      y: 240, // 7.5 * 32
      dist: distance(state.player.x, state.player.y, 528, 240),
      id: 'boss',
      hp: state.boss.hp,
      state: 'chase',
    })
  }
  if (targets.length === 0) return null
  targets.sort((a, b) => a.dist - b.dist)
  return targets[0]
}

function countNearbyEnemies(state: SynthGameState, range: number): number {
  return state.enemies.filter(e => e.alive && e.hp > 0 &&
    distance(state.player.x, state.player.y, e.x, e.y) < range
  ).length
}

// ── Input simulation via DebugAPI ─────────────────────────────────────────

async function pressKey(page: Page, key: string): Promise<void> {
  await page.evaluate((k) => window.__SYNTH__?.pressKey(k), key)
}

async function releaseKey(page: Page, key: string): Promise<void> {
  await page.evaluate((k) => window.__SYNTH__?.releaseKey(k), key)
}

async function moveMouse(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(([mx, my]) => window.__SYNTH__?.moveMouse(mx, my), [x, y])
}

async function click(page: Page): Promise<void> {
  await page.evaluate(() => window.__SYNTH__?.click())
}

async function releaseClick(page: Page): Promise<void> {
  await page.evaluate(() => window.__SYNTH__?.releaseClick())
}

async function getState(page: Page): Promise<SynthGameState | null> {
  try {
    return await page.evaluate(() => window.__SYNTH__?.getState() ?? null)
  } catch {
    return null
  }
}

// ── Movement helpers ──────────────────────────────────────────────────────

// Keys currently held down (tracked by the playtester)
const heldKeys = new Set<string>()

async function releaseAllKeys(page: Page): Promise<void> {
  for (const key of heldKeys) {
    await releaseKey(page, key)
  }
  heldKeys.clear()
  await releaseClick(page)
}

async function setMovement(page: Page, dx: number, dy: number): Promise<void> {
  // Map desired direction to WASD presses
  const wantW = dy < 0
  const wantS = dy > 0
  const wantA = dx < 0
  const wantD = dx > 0

  const mapping: Array<[boolean, string]> = [
    [wantW, 'w'], [wantS, 's'], [wantA, 'a'], [wantD, 'd'],
  ]

  for (const [want, key] of mapping) {
    if (want && !heldKeys.has(key)) {
      await pressKey(page, key)
      heldKeys.add(key)
    } else if (!want && heldKeys.has(key)) {
      await releaseKey(page, key)
      heldKeys.delete(key)
    }
  }
}

// Convert world position to approximate screen position (800x640 canvas, camera follow player)
function worldToScreen(playerX: number, playerY: number, targetX: number, targetY: number): { x: number; y: number } {
  // Camera follows player, so player is roughly at canvas center
  const canvasW = 800
  const canvasH = 640
  const screenX = canvasW / 2 + (targetX - playerX)
  const screenY = canvasH / 2 + (targetY - playerY)
  return {
    x: Math.max(0, Math.min(canvasW, screenX)),
    y: Math.max(0, Math.min(canvasH, screenY)),
  }
}

// ── AI Strategy ───────────────────────────────────────────────────────────

interface Strategy {
  name: string
  execute: (page: Page, state: SynthGameState) => Promise<void>
}

// Simple aggressive strategy: move toward nearest enemy, aim, shoot
const aggressiveStrategy: Strategy = {
  name: 'aggressive',
  async execute(page, state) {
    const nearest = findNearestEnemy(state)
    if (!nearest) {
      // No enemies — stop moving
      await setMovement(page, 0, 0)
      await releaseClick(page)
      return
    }

    const dx = nearest.x - state.player.x
    const dy = nearest.y - state.player.y
    const dist = nearest.dist

    // Aim mouse at nearest enemy
    const screen = worldToScreen(state.player.x, state.player.y, nearest.x, nearest.y)
    await moveMouse(page, screen.x, screen.y)

    if (dist > 40) {
      // Move toward enemy
      const nx = dx / dist
      const ny = dy / dist
      await setMovement(page, nx, ny)
    } else {
      // We're close — stop and fight
      await setMovement(page, 0, 0)
    }

    // Shoot when in range
    if (dist < 300) {
      await click(page)
    } else {
      await releaseClick(page)
    }
  },
}

// Kiting strategy: move away while shooting
const kitingStrategy: Strategy = {
  name: 'kiting',
  async execute(page, state) {
    const nearest = findNearestEnemy(state)
    if (!nearest) {
      await setMovement(page, 0, 0)
      await releaseClick(page)
      return
    }

    const dx = nearest.x - state.player.x
    const dy = nearest.y - state.player.y
    const dist = nearest.dist

    // Aim at enemy
    const screen = worldToScreen(state.player.x, state.player.y, nearest.x, nearest.y)
    await moveMouse(page, screen.x, screen.y)

    // Move AWAY from enemy (kite)
    if (dist < 150) {
      const nx = -dx / dist
      const ny = -dy / dist
      await setMovement(page, nx, ny)
    } else {
      // If far enough, approach slightly
      const nx = dx / dist
      const ny = dy / dist
      await setMovement(page, nx * 0.5, ny * 0.5)
    }

    // Always shoot when we can see them
    if (dist < 350) {
      await click(page)
    } else {
      await releaseClick(page)
    }
  },
}

// Dodge-focused strategy: dodge when enemies are close and attacking
const dodgeStrategy: Strategy = {
  name: 'dodge',
  async execute(page, state) {
    const nearest = findNearestEnemy(state)
    const nearbyCount = countNearbyEnemies(state, 80)

    // Should we dodge?
    const shouldDodge = (nearest && nearest.dist < 60 && nearest.state === 'attack') ||
                        nearbyCount >= 3

    if (shouldDodge && nearest) {
      // Dodge away from nearest enemy
      const dx = -(nearest.x - state.player.x)
      const dy = -(nearest.y - state.player.y)
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      await setMovement(page, dx / dist, dy / dist)
      await pressKey(page, ' ')
      heldKeys.add(' ')
      // Brief delay then release space
      await new Promise(r => setTimeout(r, 50))
      await releaseKey(page, ' ')
      heldKeys.delete(' ')
    }

    // Also shoot at nearest
    if (nearest && nearest.dist < 300) {
      const screen = worldToScreen(state.player.x, state.player.y, nearest.x, nearest.y)
      await moveMouse(page, screen.x, screen.y)
      await click(page)
    }
  },
}

// Pick strategy based on game state
function pickStrategy(state: SynthGameState): Strategy {
  const hpRatio = state.player.hp / state.player.maxHp
  const nearbyCount = countNearbyEnemies(state, 100)
  const rand = Math.random()

  // Low HP → kite
  if (hpRatio < 0.3) return kitingStrategy

  // Surrounded → dodge
  if (nearbyCount >= 3) return dodgeStrategy

  // Random variety
  if (rand < 0.15) return kitingStrategy
  if (rand < 0.25) return dodgeStrategy

  // Default: aggressive
  return aggressiveStrategy
}

// ── Session runner ────────────────────────────────────────────────────────

async function playSession(browser: Browser, sessionIndex: number): Promise<SessionResult> {
  const context = await browser.newContext({
    viewport: { width: 800, height: 640 },
  })
  const page = await context.newPage()

  const events: string[] = []
  const killTimestamps: number[] = []
  let lastKills = 0
  let maxBossPhase = 1
  let lastState: SynthGameState | null = null
  let partnerAliveAtEnd = true
  let partnerHpAtEnd = 0
  let causeOfDeath = 'survived'

  try {
    // Navigate and wait for game to load
    await page.goto(GAME_URL, { timeout: 30000, waitUntil: 'domcontentloaded' })

    // Wait for __SYNTH__ to appear (BootScene exposes it)
    await page.waitForFunction(() => typeof window.__SYNTH__ !== 'undefined', { timeout: 15000 })

    // Wait for dungeon scene to start
    await page.waitForFunction(() => {
      const s = window.__SYNTH__?.getState()
      return s && s.scene === 'dungeon'
    }, { timeout: 15000 })

    events.push(`[${sessionIndex}] Game loaded, dungeon scene active`)

    // Brief pause — let spawn grace period pass partially
    await new Promise(r => setTimeout(r, 500))

    // ── Main game loop ──
    const startTime = Date.now()
    let frameCount = 0
    let lastStrategyChange = 0
    let currentStrategy = aggressiveStrategy
    let shooting = false

    while (Date.now() - startTime < MAX_SESSION_MS) {
      const state = await getState(page)
      if (!state) {
        await new Promise(r => setTimeout(r, 100))
        continue
      }

      lastState = state

      // Game over?
      if (state.gameOver || state.scene === 'gameover') {
        break
      }

      // Track kills
      if (state.stats.kills > lastKills) {
        const newKills = state.stats.kills - lastKills
        for (let i = 0; i < newKills; i++) {
          killTimestamps.push(state.elapsed)
        }
        lastKills = state.stats.kills
      }

      // Track boss phase
      if (state.boss?.alive && state.boss.phase > maxBossPhase) {
        maxBossPhase = state.boss.phase
        events.push(`[${state.elapsed.toFixed(1)}s] Boss reached phase ${maxBossPhase}`)
      }

      // Track partner death
      if (state.partner && !state.partner.alive && partnerAliveAtEnd) {
        partnerAliveAtEnd = false
        events.push(`[${state.elapsed.toFixed(1)}s] Partner died (player HP: ${state.player.hp})`)
      }

      // Track low HP moments
      if (state.player.hp > 0 && state.player.hp < state.player.maxHp * 0.2) {
        if (frameCount % 30 === 0) {
          events.push(`[${state.elapsed.toFixed(1)}s] Player critical HP: ${state.player.hp}/${state.player.maxHp}`)
        }
      }

      // Switch strategy every ~2 seconds or when situation changes dramatically
      if (Date.now() - lastStrategyChange > 2000) {
        currentStrategy = pickStrategy(state)
        lastStrategyChange = Date.now()
      }

      // Execute current strategy
      await currentStrategy.execute(page, state)

      // Occasional random dodge for variety (10% per tick when enemies nearby)
      if (Math.random() < 0.02 && countNearbyEnemies(state, 120) > 0) {
        await dodgeStrategy.execute(page, state)
      }

      frameCount++

      // Tick rate: ~15 decisions per second (every ~66ms)
      await new Promise(r => setTimeout(r, 66))
    }

    // Release all inputs
    await releaseAllKeys(page)

    // Grab final state
    const finalState = lastState ?? await getState(page)
    if (finalState) {
      partnerAliveAtEnd = finalState.partner?.alive ?? false
      partnerHpAtEnd = finalState.partner?.hp ?? 0

      if (finalState.player.hp <= 0) {
        // Determine cause of death
        const nearestAtDeath = findNearestEnemy(finalState)
        if (nearestAtDeath) {
          causeOfDeath = nearestAtDeath.id === 'boss'
            ? `killed by boss (phase ${maxBossPhase})`
            : `killed by ${nearestAtDeath.id} (${nearestAtDeath.state})`
        } else {
          causeOfDeath = 'unknown'
        }
      } else if (finalState.won) {
        causeOfDeath = 'survived (victory)'
      } else {
        causeOfDeath = 'timeout'
      }

      // Take screenshot on interesting moments
      if (RECORD) {
        const screenshotPath = `synth-playtester-session-${sessionIndex}.png`
        await page.screenshot({ path: screenshotPath })
        events.push(`Screenshot saved: ${screenshotPath}`)
      }

      return {
        duration: finalState.elapsed,
        kills: finalState.stats.kills,
        damageDealt: finalState.stats.damageDealt,
        damageTaken: finalState.stats.damageTaken,
        won: finalState.won ?? false,
        bossPhaseReached: maxBossPhase,
        partnerAliveAtEnd,
        partnerHpAtEnd,
        causeOfDeath,
        events,
        killTimestamps,
        earlyDeath: finalState.elapsed < 10 && finalState.player.hp <= 0,
      }
    }
  } catch (err) {
    events.push(`[ERROR] ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    await context.close()
  }

  // Fallback result
  return {
    duration: 0,
    kills: 0,
    damageDealt: 0,
    damageTaken: 0,
    won: false,
    bossPhaseReached: 1,
    partnerAliveAtEnd: false,
    partnerHpAtEnd: 0,
    causeOfDeath: 'error',
    events,
    killTimestamps: [],
    earlyDeath: false,
  }
}

// ── Report generation ─────────────────────────────────────────────────────

function generateReport(results: SessionResult[]): void {
  const total = results.length
  if (total === 0) {
    console.log('No sessions completed.')
    return
  }

  const wins = results.filter(r => r.won)
  const avgDuration = results.reduce((s, r) => s + r.duration, 0) / total
  const avgKills = results.reduce((s, r) => s + r.kills, 0) / total
  const avgDmgDealt = results.reduce((s, r) => s + r.damageDealt, 0) / total
  const avgDmgTaken = results.reduce((s, r) => s + r.damageTaken, 0) / total
  const avgDmgRatio = avgDmgTaken > 0 ? avgDmgDealt / avgDmgTaken : Infinity
  const earlyDeaths = results.filter(r => r.earlyDeath).length
  const partnerDiedFirst = results.filter(r => !r.partnerAliveAtEnd && !r.won).length
  const avgPartnerHp = results.reduce((s, r) => s + r.partnerHpAtEnd, 0) / total
  const bossReached = results.filter(r => r.bossPhaseReached >= 2).length
  const bossPhase3 = results.filter(r => r.bossPhaseReached >= 3).length

  // Kill rhythm analysis
  const allKillGaps: number[] = []
  for (const r of results) {
    const sorted = [...r.killTimestamps].sort((a, b) => a - b)
    for (let i = 1; i < sorted.length; i++) {
      allKillGaps.push(sorted[i] - sorted[i - 1])
    }
  }
  const avgKillGap = allKillGaps.length > 0
    ? allKillGaps.reduce((s, g) => s + g, 0) / allKillGaps.length
    : 0
  const maxKillDrought = allKillGaps.length > 0 ? Math.max(...allKillGaps) : 0

  // Cause of death analysis
  const deathCauses = new Map<string, number>()
  for (const r of results) {
    if (!r.won) {
      const cause = r.causeOfDeath
      deathCauses.set(cause, (deathCauses.get(cause) ?? 0) + 1)
    }
  }

  console.log('')
  console.log('='.repeat(60))
  console.log('  SYNTH AI PLAYTESTER REPORT')
  console.log('='.repeat(60))
  console.log('')
  console.log(`  Sessions:       ${total}`)
  console.log(`  Avg survival:   ${avgDuration.toFixed(1)}s`)
  console.log(`  Win rate:       ${((wins.length / total) * 100).toFixed(0)}% (${wins.length}/${total})`)
  console.log(`  Avg kills:      ${avgKills.toFixed(1)}`)
  console.log(`  Avg dmg ratio:  ${avgDmgRatio.toFixed(1)} (dealt/taken)`)
  console.log(`  Avg dmg dealt:  ${avgDmgDealt.toFixed(0)}`)
  console.log(`  Avg dmg taken:  ${avgDmgTaken.toFixed(0)}`)
  console.log('')

  // ── Issues ──
  console.log('  ISSUES FOUND:')
  console.log('  ' + '-'.repeat(40))

  if (earlyDeaths > 0) {
    console.log(`  - Player dies within 10s in ${earlyDeaths}/${total} sessions (spawn too dangerous?)`)
  }
  if (partnerDiedFirst > total * 0.5) {
    console.log(`  - Partner died before player in ${partnerDiedFirst}/${total} sessions (partner too aggressive?)`)
  }
  if (avgPartnerHp < 20 && total > 1) {
    console.log(`  - Avg partner HP at end: ${avgPartnerHp.toFixed(0)} (partner takes too much damage?)`)
  }
  if (bossReached < total * 0.5) {
    console.log(`  - Boss phase 2 reached ${bossReached}/${total} times (boss too hard or enemies too many?)`)
  }
  if (bossPhase3 < total * 0.2) {
    console.log(`  - Boss phase 3 reached only ${bossPhase3}/${total} times (progression feels blocked?)`)
  }
  if (avgDuration < 15) {
    console.log(`  - Average survival only ${avgDuration.toFixed(1)}s (game might be too punishing?)`)
  }
  if (maxKillDrought > 10) {
    console.log(`  - Longest kill drought: ${maxKillDrought.toFixed(1)}s (might feel boring/stuck)`)
  }
  if (deathCauses.size > 0) {
    console.log('')
    console.log('  Death causes:')
    const sorted = [...deathCauses.entries()].sort((a, b) => b[1] - a[1])
    for (const [cause, count] of sorted) {
      console.log(`    ${count}x — ${cause}`)
    }
  }

  // ── Balance suggestions ──
  console.log('')
  console.log('  BALANCE SUGGESTIONS:')
  console.log('  ' + '-'.repeat(40))

  if (partnerDiedFirst > total * 0.6) {
    console.log('  - Increase partner HP from 80 to 100 (dies too fast)')
  }
  if (avgDmgRatio < 1.5) {
    console.log('  - Reduce enemy melee damage or increase player damage (exchange rate too low)')
  }
  if (earlyDeaths >= total * 0.3) {
    console.log('  - Extend spawn grace period or reduce initial enemy count')
  }
  if (bossReached > 0 && bossPhase3 === 0) {
    console.log('  - Boss phase 2 -> 3 transition needs tuning (too hard to break through)')
  }
  if (avgKills < 5 && avgDuration > 20) {
    console.log('  - Kill rate too low for session length (enemies too tanky?)')
  }
  const losses = results.filter(r => !r.won)
  if (losses.length > 0) {
    const avgLossHp = losses.reduce((s, r) => s + r.damageTaken, 0) / losses.length
    if (avgLossHp > 150) {
      console.log(`  - Avg damage taken before death: ${avgLossHp.toFixed(0)} (too many damage sources?)`)
    }
  }

  // ── Feel observations ──
  console.log('')
  console.log('  FEEL OBSERVATIONS:')
  console.log('  ' + '-'.repeat(40))

  if (avgKillGap > 0) {
    console.log(`  - Average time between kills: ${avgKillGap.toFixed(1)}s ${avgKillGap < 4 ? '(good rhythm)' : '(might feel slow)'}`)
  }
  if (maxKillDrought > 0) {
    console.log(`  - Longest drought without a kill: ${maxKillDrought.toFixed(1)}s ${maxKillDrought > 8 ? '(might feel boring)' : '(acceptable)'}`)
  }
  if (avgDuration > 30 && wins.length > 0) {
    console.log('  - Sessions that won had good length (gameplay loop works)')
  }
  if (avgDuration < 20 && wins.length === 0) {
    console.log('  - No wins and short sessions — difficulty curve too steep early on')
  }

  // ── Per-session log ──
  console.log('')
  console.log('  SESSION DETAILS:')
  console.log('  ' + '-'.repeat(40))

  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const status = r.won ? 'WIN' : 'LOSS'
    console.log(`  #${i + 1}: ${status} | ${r.duration.toFixed(1)}s | ${r.kills} kills | dmg ${r.damageDealt}/${r.damageTaken} | boss ph${r.bossPhaseReached} | partner ${r.partnerAliveAtEnd ? 'alive' : 'dead'} | ${r.causeOfDeath}`)
  }

  // Notable events
  const allEvents = results.flatMap((r, i) => r.events.map(e => `  Session ${i + 1}: ${e}`))
  if (allEvents.length > 0) {
    console.log('')
    console.log('  NOTABLE EVENTS:')
    console.log('  ' + '-'.repeat(40))
    // Limit to 30 most recent events
    for (const e of allEvents.slice(-30)) {
      console.log(e)
    }
  }

  console.log('')
  console.log('='.repeat(60))
  console.log('')
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('')
  console.log('  SYNTH AI Playtester')
  console.log(`  Sessions: ${NUM_SESSIONS} | URL: ${GAME_URL} | Headed: ${HEADED} | Record: ${RECORD}`)
  console.log('')

  const browser = await chromium.launch({
    headless: !HEADED,
  })

  const results: SessionResult[] = []

  for (let i = 0; i < NUM_SESSIONS; i++) {
    console.log(`  Playing session ${i + 1}/${NUM_SESSIONS}...`)
    try {
      const result = await playSession(browser, i + 1)
      results.push(result)
      const status = result.won ? 'WIN' : 'LOSS'
      console.log(`    ${status} — ${result.duration.toFixed(1)}s, ${result.kills} kills, ${result.causeOfDeath}`)
    } catch (err) {
      console.log(`    ERROR — ${err instanceof Error ? err.message : String(err)}`)
      results.push({
        duration: 0,
        kills: 0,
        damageDealt: 0,
        damageTaken: 0,
        won: false,
        bossPhaseReached: 1,
        partnerAliveAtEnd: false,
        partnerHpAtEnd: 0,
        causeOfDeath: 'error',
        events: [`Session error: ${err}`],
        killTimestamps: [],
        earlyDeath: false,
      })
    }
  }

  await browser.close()

  generateReport(results)
}

main().catch(err => {
  console.error('Playtester failed:', err)
  process.exit(1)
})
