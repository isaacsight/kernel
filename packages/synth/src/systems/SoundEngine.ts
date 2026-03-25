// SYNTH — Procedural Sound Engine v2
// Every action has distinct audio. Every room sounds alive.
// All sounds synthesized via Web Audio API — zero audio files.
// Pitch randomization (±10%) on every sound prevents listener fatigue.
// Spatial panning based on entity position relative to player.
// Adaptive combat music layers crossfade with Director tension.

import type { EnemyType, RoomType } from '../types'

// ── Helpers ─────────────────────────────────────────────────────────────

/** Random pitch deviation: returns a multiplier between 1-range and 1+range */
function pitchJitter(range = 0.1): number {
  return 1 + (Math.random() * 2 - 1) * range
}

/** Create a white noise AudioBuffer */
function createNoiseBuffer(ctx: AudioContext, duration = 0.5): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const length = Math.floor(sampleRate * duration)
  const buffer = ctx.createBuffer(1, length, sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

/** Schedule a gain envelope: attack at startTime, decay to 0 over duration */
function envelope(
  ctx: AudioContext,
  gain: GainNode,
  peakLevel: number,
  startTime: number,
  attackMs: number,
  decayMs: number,
): void {
  const attack = attackMs / 1000
  const decay = decayMs / 1000
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(peakLevel, startTime + attack)
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + attack + decay)
}

/** Clamp a value between min and max */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

// ── Sound Engine ────────────────────────────────────────────────────────

export class SoundEngine {
  private ctx: AudioContext
  private masterGain: GainNode
  private muted = false
  private savedVolume = 0.7

  // Ambient state
  private ambientDrone: OscillatorNode | null = null
  private ambientNoiseSource: AudioBufferSourceNode | null = null
  private ambientGain: GainNode | null = null
  private battleGain: GainNode | null = null
  private battleOsc: OscillatorNode | null = null
  private battleIntensity = 0

  // Room ambient state
  private roomAmbientNodes: Array<OscillatorNode | AudioBufferSourceNode> = []
  private roomAmbientGains: GainNode[] = []
  private roomAmbientTimers: ReturnType<typeof setTimeout>[] = []
  private currentRoomType: RoomType | null = null

  // Adaptive music layers
  private musicGain: GainNode | null = null
  private musicDroneOsc: OscillatorNode | null = null
  private musicDroneGain: GainNode | null = null
  private musicKickTimer: ReturnType<typeof setInterval> | null = null
  private musicKickGain: GainNode | null = null
  private musicBassOsc: OscillatorNode | null = null
  private musicBassGain: GainNode | null = null
  private musicBassLFO: OscillatorNode | null = null
  private musicHihatTimer: ReturnType<typeof setInterval> | null = null
  private musicHihatGain: GainNode | null = null
  private musicLeadOsc: OscillatorNode | null = null
  private musicLeadGain: GainNode | null = null
  private musicRunning = false
  private currentTension = 0

  // Volume ducking
  private duckingActive = false
  private duckGainNode: GainNode | null = null

  // Spatial: player position for panning
  private playerX = 0
  private playerY = 0
  private viewWidth = 800

  // Shared noise buffer (reused for efficiency)
  private sharedNoiseBuffer: AudioBuffer | null = null

  constructor() {
    this.ctx = new AudioContext()
    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = 0.7

    // Duck gain sits between master and destination
    this.duckGainNode = this.ctx.createGain()
    this.duckGainNode.gain.value = 1.0
    this.masterGain.connect(this.duckGainNode)
    this.duckGainNode.connect(this.ctx.destination)
  }

  /** Ensure AudioContext is running (browsers require user gesture) */
  private ensureRunning(): void {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
  }

  /** Get or create a shared noise buffer for reuse */
  private getNoiseBuffer(duration = 0.5): AudioBuffer {
    if (!this.sharedNoiseBuffer || this.sharedNoiseBuffer.duration < duration) {
      this.sharedNoiseBuffer = createNoiseBuffer(this.ctx, Math.max(duration, 2.0))
    }
    return this.sharedNoiseBuffer
  }

  /** Create a stereo panner based on world position relative to player */
  private createPanner(worldX?: number): StereoPannerNode {
    const panner = this.ctx.createStereoPanner()
    if (worldX !== undefined) {
      // Map world X offset to -1..1 pan range
      const offset = worldX - this.playerX
      const halfView = this.viewWidth / 2
      panner.pan.value = clamp(offset / halfView, -1, 1)
    } else {
      panner.pan.value = 0
    }
    return panner
  }

  /** Update player position for spatial audio */
  setPlayerPosition(x: number, y: number, viewWidth?: number): void {
    this.playerX = x
    this.playerY = y
    if (viewWidth !== undefined) this.viewWidth = viewWidth
  }

  // ═══════════════════════════════════════════════════════════════════════
  // WEAPON SOUNDS — per weapon type
  // ═══════════════════════════════════════════════════════════════════════

  /** Weapon-specific attack sound. Falls back to generic if no type provided. */
  playerAttack(weaponType?: string): void {
    this.ensureRunning()

    switch (weaponType) {
      case 'pulse':
        this.attackPulse()
        break
      case 'nova':
        this.attackNova()
        break
      case 'blade':
        this.attackBlade()
        break
      case 'arc':
        this.attackArc()
        break
      default:
        this.attackGeneric()
        break
    }
  }

  /** Pulse: sharp "pew" — short sine burst, high frequency, 50ms decay */
  private attackPulse(): void {
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.1)

    // Primary tone: sharp sine burst at 800-1200Hz
    const freq = (800 + Math.random() * 400) * jitter
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now)
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.05)
    envelope(this.ctx, gain, 0.3, now, 3, 47)

    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.06)

    // Brightness click layer
    const click = this.ctx.createOscillator()
    const clickGain = this.ctx.createGain()
    click.type = 'square'
    click.frequency.setValueAtTime(1800 * jitter, now)
    click.frequency.exponentialRampToValueAtTime(600, now + 0.02)
    envelope(this.ctx, clickGain, 0.08, now, 1, 18)
    click.connect(clickGain)
    clickGain.connect(this.masterGain)
    click.start(now)
    click.stop(now + 0.03)
  }

  /** Nova: deep "boom" — low frequency with white noise burst, 200ms decay, reverb */
  private attackNova(): void {
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.1)

    // Low sub-bass thud: 60-120Hz
    const freq = (60 + Math.random() * 60) * jitter
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now)
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.2)
    envelope(this.ctx, gain, 0.45, now, 5, 195)
    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.25)

    // White noise burst for explosion texture
    const noiseBuffer = this.getNoiseBuffer(0.2)
    const noise = this.ctx.createBufferSource()
    const noiseGain = this.ctx.createGain()
    const noiseFilter = this.ctx.createBiquadFilter()
    noise.buffer = noiseBuffer
    noiseFilter.type = 'lowpass'
    noiseFilter.frequency.setValueAtTime(800, now)
    noiseFilter.frequency.exponentialRampToValueAtTime(100, now + 0.2)
    envelope(this.ctx, noiseGain, 0.2, now, 5, 195)
    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(this.masterGain)
    noise.start(now)
    noise.stop(now + 0.25)

    // Reverb tail: delayed quiet echo
    const echoOsc = this.ctx.createOscillator()
    const echoGain = this.ctx.createGain()
    echoOsc.type = 'sine'
    echoOsc.frequency.setValueAtTime(freq * 0.7, now + 0.1)
    echoOsc.frequency.exponentialRampToValueAtTime(20, now + 0.35)
    envelope(this.ctx, echoGain, 0.08, now + 0.1, 5, 200)
    echoOsc.connect(echoGain)
    echoGain.connect(this.masterGain)
    echoOsc.start(now + 0.1)
    echoOsc.stop(now + 0.4)
  }

  /** Blade: "swish-thunk" — noise sweep high-to-low 80ms + impact thud on hit */
  private attackBlade(): void {
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.1)

    // Swish: bandpass noise sweeping from high to low
    const noiseBuffer = this.getNoiseBuffer(0.1)
    const noise = this.ctx.createBufferSource()
    const noiseGain = this.ctx.createGain()
    const swishFilter = this.ctx.createBiquadFilter()
    noise.buffer = noiseBuffer
    swishFilter.type = 'bandpass'
    swishFilter.frequency.setValueAtTime(4000 * jitter, now)
    swishFilter.frequency.exponentialRampToValueAtTime(400 * jitter, now + 0.08)
    swishFilter.Q.value = 3
    envelope(this.ctx, noiseGain, 0.25, now, 3, 77)
    noise.connect(swishFilter)
    swishFilter.connect(noiseGain)
    noiseGain.connect(this.masterGain)
    noise.start(now)
    noise.stop(now + 0.1)

    // Impact thud at the end of the swish
    const thud = this.ctx.createOscillator()
    const thudGain = this.ctx.createGain()
    thud.type = 'sine'
    thud.frequency.setValueAtTime(200 * jitter, now + 0.06)
    thud.frequency.exponentialRampToValueAtTime(60, now + 0.12)
    envelope(this.ctx, thudGain, 0.2, now + 0.06, 3, 57)
    thud.connect(thudGain)
    thudGain.connect(this.masterGain)
    thud.start(now + 0.06)
    thud.stop(now + 0.15)
  }

  /** Arc: "crackle-zap" — random frequency noise bursts (2-4 rapid pops) */
  private attackArc(): void {
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.1)
    const popCount = 2 + Math.floor(Math.random() * 3) // 2-4 pops

    for (let i = 0; i < popCount; i++) {
      const offset = i * 0.025 // 25ms between pops
      const popFreq = (800 + Math.random() * 2000) * jitter

      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(popFreq, now + offset)
      osc.frequency.exponentialRampToValueAtTime(popFreq * 0.3, now + offset + 0.02)
      envelope(this.ctx, gain, 0.15, now + offset, 1, 18)
      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start(now + offset)
      osc.stop(now + offset + 0.03)
    }

    // Background crackle noise
    const noiseBuffer = this.getNoiseBuffer(0.12)
    const noise = this.ctx.createBufferSource()
    const noiseGain = this.ctx.createGain()
    const noiseFilter = this.ctx.createBiquadFilter()
    noise.buffer = noiseBuffer
    noiseFilter.type = 'highpass'
    noiseFilter.frequency.value = 3000
    envelope(this.ctx, noiseGain, 0.1, now, 3, 97)
    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(this.masterGain)
    noise.start(now)
    noise.stop(now + 0.12)
  }

  /** Generic attack fallback */
  private attackGeneric(): void {
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.1)
    const freq = 800 * jitter

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(freq, now)
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.08)
    envelope(this.ctx, gain, 0.3, now, 5, 95)
    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.1)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ENEMY HIT SOUNDS — per enemy type
  // ═══════════════════════════════════════════════════════════════════════

  /** BASS-HEAVY thud — now dispatches per enemy type for distinct sounds */
  enemyHit(enemyType?: EnemyType, worldX?: number): void {
    this.ensureRunning()
    const panner = this.createPanner(worldX)

    switch (enemyType) {
      case 'melee':
        this.hitMelee(panner)
        break
      case 'ranged':
        this.hitRanged(panner)
        break
      case 'tank':
        this.hitTank(panner)
        break
      case 'shielded':
        this.hitShielded(panner, false)
        break
      case 'exploder':
        this.hitExploder(panner)
        break
      case 'fast':
        this.hitFast(panner)
        break
      case 'healer':
        this.hitHealer(panner)
        break
      case 'summoner':
        this.hitSummoner(panner)
        break
      default:
        this.hitGeneric(panner)
        break
    }
  }

  /** Shielded enemy: distinct sound when shield is active vs broken */
  shieldHit(worldX?: number): void {
    this.ensureRunning()
    const panner = this.createPanner(worldX)
    this.hitShielded(panner, true)
  }

  /** Melee enemy: fleshy "thud" — low sine (150Hz) + noise */
  private hitMelee(panner: StereoPannerNode): void {
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.1)

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(150 * jitter, now)
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.12)
    envelope(this.ctx, gain, 0.45, now, 3, 120)
    osc.connect(gain)
    gain.connect(panner)
    panner.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.15)

    // Noise for flesh texture
    const noiseBuffer = this.getNoiseBuffer(0.1)
    const noise = this.ctx.createBufferSource()
    const noiseGain = this.ctx.createGain()
    const noiseFilter = this.ctx.createBiquadFilter()
    noise.buffer = noiseBuffer
    noiseFilter.type = 'lowpass'
    noiseFilter.frequency.value = 500
    envelope(this.ctx, noiseGain, 0.15, now, 3, 80)
    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(panner)
    noise.start(now)
    noise.stop(now + 0.12)
  }

  /** Ranged enemy: metallic "ping" — higher pitch */
  private hitRanged(panner: StereoPannerNode): void {
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.1)

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(1200 * jitter, now)
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.08)
    envelope(this.ctx, gain, 0.25, now, 3, 77)
    osc.connect(gain)
    gain.connect(panner)
    panner.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.1)

    // Metallic ring overtone
    const ring = this.ctx.createOscillator()
    const ringGain = this.ctx.createGain()
    ring.type = 'sine'
    ring.frequency.setValueAtTime(2400 * jitter, now)
    ring.frequency.exponentialRampToValueAtTime(1800, now + 0.06)
    envelope(this.ctx, ringGain, 0.08, now, 2, 55)
    ring.connect(ringGain)
    ringGain.connect(panner)
    ring.start(now)
    ring.stop(now + 0.08)
  }

  /** Tank enemy: heavy "clang" — low freq + resonance */
  private hitTank(panner: StereoPannerNode): void {
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.1)

    // Heavy bass clang
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(80 * jitter, now)
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.2)
    envelope(this.ctx, gain, 0.5, now, 3, 197)
    osc.connect(gain)
    gain.connect(panner)
    panner.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.25)

    // Resonant metallic ring (like hitting armor)
    const ring = this.ctx.createOscillator()
    const ringGain = this.ctx.createGain()
    ring.type = 'triangle'
    ring.frequency.setValueAtTime(400 * jitter, now)
    ring.frequency.exponentialRampToValueAtTime(200, now + 0.15)
    envelope(this.ctx, ringGain, 0.2, now, 3, 180)
    ring.connect(ringGain)
    ringGain.connect(panner)
    ring.start(now)
    ring.stop(now + 0.2)

    // Impact noise
    const noiseBuffer = this.getNoiseBuffer(0.1)
    const noise = this.ctx.createBufferSource()
    const noiseGain = this.ctx.createGain()
    const noiseFilter = this.ctx.createBiquadFilter()
    noise.buffer = noiseBuffer
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.value = 300
    noiseFilter.Q.value = 4
    envelope(this.ctx, noiseGain, 0.18, now, 3, 80)
    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(panner)
    noise.start(now)
    noise.stop(now + 0.12)
  }

  /** Shielded enemy: metallic ring when shield active, "crack" when broken */
  private hitShielded(panner: StereoPannerNode, shieldActive: boolean): void {
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.1)

    if (shieldActive) {
      // High-pitched metallic deflection ring
      const ring = this.ctx.createOscillator()
      const ringGain = this.ctx.createGain()
      ring.type = 'triangle'
      ring.frequency.setValueAtTime(2800 * jitter, now)
      ring.frequency.exponentialRampToValueAtTime(1800, now + 0.12)
      envelope(this.ctx, ringGain, 0.2, now, 2, 118)
      ring.connect(ringGain)
      ringGain.connect(panner)
      panner.connect(this.masterGain)
      ring.start(now)
      ring.stop(now + 0.15)

      // Shimmer overtone
      const shimmer = this.ctx.createOscillator()
      const shimmerGain = this.ctx.createGain()
      shimmer.type = 'sine'
      shimmer.frequency.setValueAtTime(4200 * jitter, now)
      envelope(this.ctx, shimmerGain, 0.06, now, 2, 100)
      shimmer.connect(shimmerGain)
      shimmerGain.connect(panner)
      shimmer.start(now)
      shimmer.stop(now + 0.12)
    } else {
      // Shield broken: crack sound — descending noise + sharp impact
      const noiseBuffer = this.getNoiseBuffer(0.15)
      const noise = this.ctx.createBufferSource()
      const noiseGain = this.ctx.createGain()
      const noiseFilter = this.ctx.createBiquadFilter()
      noise.buffer = noiseBuffer
      noiseFilter.type = 'bandpass'
      noiseFilter.frequency.setValueAtTime(2000 * jitter, now)
      noiseFilter.frequency.exponentialRampToValueAtTime(400, now + 0.1)
      noiseFilter.Q.value = 5
      envelope(this.ctx, noiseGain, 0.3, now, 2, 98)
      noise.connect(noiseFilter)
      noiseFilter.connect(noiseGain)
      noiseGain.connect(panner)
      panner.connect(this.masterGain)
      noise.start(now)
      noise.stop(now + 0.12)

      // Low impact tone
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(200 * jitter, now)
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.1)
      envelope(this.ctx, gain, 0.35, now, 3, 97)
      osc.connect(gain)
      gain.connect(panner)
      osc.start(now)
      osc.stop(now + 0.12)
    }
  }

  /** Exploder enemy: "sizzle" — building high frequency */
  private hitExploder(panner: StereoPannerNode): void {
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.1)

    // Rising sizzle tone
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(600 * jitter, now)
    osc.frequency.exponentialRampToValueAtTime(2400 * jitter, now + 0.1)
    envelope(this.ctx, gain, 0.2, now, 3, 97)
    osc.connect(gain)
    gain.connect(panner)
    panner.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.12)

    // Crackle noise
    const noiseBuffer = this.getNoiseBuffer(0.08)
    const noise = this.ctx.createBufferSource()
    const noiseGain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()
    noise.buffer = noiseBuffer
    filter.type = 'highpass'
    filter.frequency.value = 4000
    envelope(this.ctx, noiseGain, 0.1, now, 2, 60)
    noise.connect(filter)
    filter.connect(noiseGain)
    noiseGain.connect(panner)
    noise.start(now)
    noise.stop(now + 0.08)
  }

  /** Fast enemy: "zip" — quick, light impact */
  private hitFast(panner: StereoPannerNode): void {
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.1)

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(900 * jitter, now)
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.04)
    envelope(this.ctx, gain, 0.2, now, 2, 38)
    osc.connect(gain)
    gain.connect(panner)
    panner.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.05)
  }

  /** Healer enemy: "shimmer" — soft ascending tone */
  private hitHealer(panner: StereoPannerNode): void {
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.1)

    // Ascending shimmer
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(500 * jitter, now)
    osc.frequency.exponentialRampToValueAtTime(1200 * jitter, now + 0.1)
    envelope(this.ctx, gain, 0.18, now, 5, 95)
    osc.connect(gain)
    gain.connect(panner)
    panner.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.12)

    // Harmonic overtone
    const harm = this.ctx.createOscillator()
    const harmGain = this.ctx.createGain()
    harm.type = 'sine'
    harm.frequency.setValueAtTime(1000 * jitter, now)
    harm.frequency.exponentialRampToValueAtTime(2400 * jitter, now + 0.1)
    envelope(this.ctx, harmGain, 0.06, now, 5, 80)
    harm.connect(harmGain)
    harmGain.connect(panner)
    harm.start(now)
    harm.stop(now + 0.1)
  }

  /** Summoner enemy: "dark pulse" — low rumble */
  private hitSummoner(panner: StereoPannerNode): void {
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.1)

    // Deep rumble
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(55 * jitter, now)
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.2)
    envelope(this.ctx, gain, 0.4, now, 5, 195)
    osc.connect(gain)
    gain.connect(panner)
    panner.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.25)

    // Dissonant overtone for dark feel
    const osc2 = this.ctx.createOscillator()
    const gain2 = this.ctx.createGain()
    osc2.type = 'sawtooth'
    osc2.frequency.setValueAtTime(78 * jitter, now) // tritone-ish
    osc2.frequency.exponentialRampToValueAtTime(35, now + 0.18)
    envelope(this.ctx, gain2, 0.12, now, 5, 170)
    osc2.connect(gain2)
    gain2.connect(panner)
    osc2.start(now)
    osc2.stop(now + 0.2)
  }

  /** Generic enemy hit (fallback) — original bass-heavy thud */
  private hitGeneric(panner: StereoPannerNode): void {
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.1)

    // Sub-bass punch
    const sub = this.ctx.createOscillator()
    const subGain = this.ctx.createGain()
    sub.type = 'sine'
    sub.frequency.setValueAtTime(60 * jitter, now)
    sub.frequency.exponentialRampToValueAtTime(30, now + 0.12)
    envelope(this.ctx, subGain, 0.5, now, 3, 120)
    sub.connect(subGain)
    subGain.connect(panner)
    panner.connect(this.masterGain)
    sub.start(now)
    sub.stop(now + 0.15)

    // Mid-low thud
    const osc = this.ctx.createOscillator()
    const oscGain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(180 * jitter, now)
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.15)
    envelope(this.ctx, oscGain, 0.4, now, 5, 145)
    osc.connect(oscGain)
    oscGain.connect(panner)
    osc.start(now)
    osc.stop(now + 0.2)

    // Noise burst for impact texture
    const noiseBuffer = this.getNoiseBuffer(0.15)
    const noise = this.ctx.createBufferSource()
    const noiseGain = this.ctx.createGain()
    const noiseFilter = this.ctx.createBiquadFilter()
    noise.buffer = noiseBuffer
    noiseFilter.type = 'lowpass'
    noiseFilter.frequency.value = 600
    envelope(this.ctx, noiseGain, 0.2, now, 5, 100)
    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(panner)
    noise.start(now)
    noise.stop(now + 0.15)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PLAYER COMBAT SOUNDS
  // ═══════════════════════════════════════════════════════════════════════

  /** Low bass impact — the player felt THAT */
  playerHurt(): void {
    this.ensureRunning()
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.08)

    // Heavy bass hit
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(120 * jitter, now)
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.25)
    envelope(this.ctx, gain, 0.5, now, 5, 245)
    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.3)

    // Distorted crunch layer
    const osc2 = this.ctx.createOscillator()
    const gain2 = this.ctx.createGain()
    osc2.type = 'sawtooth'
    osc2.frequency.setValueAtTime(80 * jitter, now)
    osc2.frequency.exponentialRampToValueAtTime(30, now + 0.2)
    envelope(this.ctx, gain2, 0.2, now, 5, 195)
    osc2.connect(gain2)
    gain2.connect(this.masterGain)
    osc2.start(now)
    osc2.stop(now + 0.25)
  }

  /** Diablo-style death crunch — satisfying shatter */
  enemyDeath(enemyType?: EnemyType, worldX?: number): void {
    this.ensureRunning()
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.1)
    const panner = this.createPanner(worldX)

    // Descending impact tone
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(500 * jitter, now)
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.3)
    envelope(this.ctx, gain, 0.3, now, 5, 295)
    osc.connect(gain)
    gain.connect(panner)
    panner.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.35)

    // Sub-bass boom
    const sub = this.ctx.createOscillator()
    const subGain = this.ctx.createGain()
    sub.type = 'sine'
    sub.frequency.setValueAtTime(50 * jitter, now)
    sub.frequency.exponentialRampToValueAtTime(20, now + 0.2)
    envelope(this.ctx, subGain, 0.35, now, 3, 200)
    sub.connect(subGain)
    subGain.connect(panner)
    sub.start(now)
    sub.stop(now + 0.25)

    // Crunch noise burst
    const noiseBuffer = this.getNoiseBuffer(0.25)
    const noise = this.ctx.createBufferSource()
    const noiseGain = this.ctx.createGain()
    const noiseFilter = this.ctx.createBiquadFilter()
    noise.buffer = noiseBuffer
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.value = 1200 * jitter
    noiseFilter.Q.value = 3
    envelope(this.ctx, noiseGain, 0.25, now, 3, 180)
    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(panner)
    noise.start(now)
    noise.stop(now + 0.25)

    // Second crunch layer — higher freq for shatter
    const noise2 = this.ctx.createBufferSource()
    const noise2Gain = this.ctx.createGain()
    const noise2Filter = this.ctx.createBiquadFilter()
    noise2.buffer = noiseBuffer
    noise2Filter.type = 'highpass'
    noise2Filter.frequency.value = 2000
    envelope(this.ctx, noise2Gain, 0.12, now + 0.02, 3, 120)
    noise2.connect(noise2Filter)
    noise2Filter.connect(noise2Gain)
    noise2Gain.connect(panner)
    noise2.start(now + 0.02)
    noise2.stop(now + 0.18)

    // Exploder-specific: extra big boom on death
    if (enemyType === 'exploder') {
      const boom = this.ctx.createOscillator()
      const boomGain = this.ctx.createGain()
      boom.type = 'sine'
      boom.frequency.setValueAtTime(40 * jitter, now + 0.05)
      boom.frequency.exponentialRampToValueAtTime(15, now + 0.4)
      envelope(this.ctx, boomGain, 0.4, now + 0.05, 5, 350)
      boom.connect(boomGain)
      boomGain.connect(panner)
      boom.start(now + 0.05)
      boom.stop(now + 0.45)
    }
  }

  /** Critical hit sound — amplified bass hit with metallic ring */
  criticalHit(worldX?: number): void {
    this.ensureRunning()
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.08)
    const panner = this.createPanner(worldX)

    // Deep bass slam
    const sub = this.ctx.createOscillator()
    const subGain = this.ctx.createGain()
    sub.type = 'sine'
    sub.frequency.setValueAtTime(45 * jitter, now)
    sub.frequency.exponentialRampToValueAtTime(20, now + 0.18)
    envelope(this.ctx, subGain, 0.6, now, 3, 180)
    sub.connect(subGain)
    subGain.connect(panner)
    panner.connect(this.masterGain)
    sub.start(now)
    sub.stop(now + 0.22)

    // Metallic ring
    const ring = this.ctx.createOscillator()
    const ringGain = this.ctx.createGain()
    ring.type = 'triangle'
    ring.frequency.setValueAtTime(1400 * jitter, now)
    ring.frequency.exponentialRampToValueAtTime(800, now + 0.15)
    envelope(this.ctx, ringGain, 0.2, now, 3, 150)
    ring.connect(ringGain)
    ringGain.connect(panner)
    ring.start(now)
    ring.stop(now + 0.2)

    // Impact noise
    const noiseBuffer = this.getNoiseBuffer(0.1)
    const noise = this.ctx.createBufferSource()
    const noiseGain = this.ctx.createGain()
    noise.buffer = noiseBuffer
    envelope(this.ctx, noiseGain, 0.25, now, 2, 80)
    noise.connect(noiseGain)
    noiseGain.connect(panner)
    noise.start(now)
    noise.stop(now + 0.1)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BOSS SOUNDS
  // ═══════════════════════════════════════════════════════════════════════

  /** Boss phase transition — low dramatic boom/rumble */
  bossPhaseTransition(): void {
    this.ensureRunning()
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.05)

    // Deep rumble
    const rumble = this.ctx.createOscillator()
    const rumbleGain = this.ctx.createGain()
    rumble.type = 'sine'
    rumble.frequency.setValueAtTime(35 * jitter, now)
    rumble.frequency.linearRampToValueAtTime(55 * jitter, now + 0.3)
    rumble.frequency.exponentialRampToValueAtTime(20, now + 1.0)
    envelope(this.ctx, rumbleGain, 0.45, now, 50, 950)
    rumble.connect(rumbleGain)
    rumbleGain.connect(this.masterGain)
    rumble.start(now)
    rumble.stop(now + 1.2)

    // Dissonant tension chord
    const tensions = [130.81, 138.59, 155.56]
    for (const freq of tensions) {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(freq * jitter, now)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7 * jitter, now + 0.8)
      envelope(this.ctx, gain, 0.12, now, 30, 770)
      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start(now)
      osc.stop(now + 1.0)
    }

    // Rolling noise
    const noiseBuffer = this.getNoiseBuffer(1.0)
    const noise = this.ctx.createBufferSource()
    const noiseGain = this.ctx.createGain()
    const noiseFilter = this.ctx.createBiquadFilter()
    noise.buffer = noiseBuffer
    noiseFilter.type = 'lowpass'
    noiseFilter.frequency.setValueAtTime(400, now)
    noiseFilter.frequency.exponentialRampToValueAtTime(100, now + 0.8)
    envelope(this.ctx, noiseGain, 0.2, now, 30, 770)
    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(this.masterGain)
    noise.start(now)
    noise.stop(now + 1.0)
  }

  /** Dramatic chord + explosion — boss death */
  bossDeath(): void {
    this.ensureRunning()
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.05)

    // Dramatic minor chord (C-Eb-G at octave 4)
    const freqs = [261.63, 311.13, 392.00]
    for (const freq of freqs) {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(freq * jitter, now)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5 * jitter, now + 1.0)
      envelope(this.ctx, gain, 0.2, now, 10, 900)
      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start(now)
      osc.stop(now + 1.2)
    }

    // Sub bass rumble
    const bass = this.ctx.createOscillator()
    const bassGain = this.ctx.createGain()
    bass.type = 'sine'
    bass.frequency.setValueAtTime(60 * jitter, now)
    bass.frequency.exponentialRampToValueAtTime(25, now + 0.8)
    envelope(this.ctx, bassGain, 0.4, now, 10, 790)
    bass.connect(bassGain)
    bassGain.connect(this.masterGain)
    bass.start(now)
    bass.stop(now + 1.0)

    // Explosion noise
    const noiseBuffer = this.getNoiseBuffer(0.8)
    const noise = this.ctx.createBufferSource()
    const noiseGain = this.ctx.createGain()
    const noiseFilter = this.ctx.createBiquadFilter()
    noise.buffer = noiseBuffer
    noiseFilter.type = 'lowpass'
    noiseFilter.frequency.setValueAtTime(3000, now)
    noiseFilter.frequency.exponentialRampToValueAtTime(200, now + 0.8)
    envelope(this.ctx, noiseGain, 0.3, now, 10, 700)
    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(this.masterGain)
    noise.start(now)
    noise.stop(now + 0.8)

    // Fade out all music layers
    this.fadeOutMusic(1500)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MOVEMENT SOUNDS
  // ═══════════════════════════════════════════════════════════════════════

  /** Quick whoosh — filtered noise for dodge feedback */
  dodge(): void {
    this.ensureRunning()
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.1)

    const noiseBuffer = this.getNoiseBuffer(0.12)
    const noise = this.ctx.createBufferSource()
    const noiseGain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()

    noise.buffer = noiseBuffer
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(2000 * jitter, now)
    filter.Q.value = 5
    filter.frequency.exponentialRampToValueAtTime(4000 * jitter, now + 0.06)
    filter.frequency.exponentialRampToValueAtTime(1000 * jitter, now + 0.12)

    envelope(this.ctx, noiseGain, 0.2, now, 5, 115)

    noise.connect(filter)
    filter.connect(noiseGain)
    noiseGain.connect(this.masterGain)
    noise.start(now)
    noise.stop(now + 0.15)
  }

  /** Pitch rises with combo level — reward the streak */
  comboHit(comboLevel: number): void {
    this.ensureRunning()
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.07)

    const clampedLevel = Math.min(comboLevel, 10)
    const baseFreq = (400 + clampedLevel * 80) * jitter
    const brightness = Math.min(0.3 + clampedLevel * 0.03, 0.6)

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(baseFreq, now)
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.06)
    envelope(this.ctx, gain, brightness, now, 5, 75)
    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.1)

    if (clampedLevel >= 5) {
      const osc2 = this.ctx.createOscillator()
      const gain2 = this.ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(baseFreq * 2, now)
      envelope(this.ctx, gain2, 0.1, now, 5, 55)
      osc2.connect(gain2)
      gain2.connect(this.masterGain)
      osc2.start(now)
      osc2.stop(now + 0.08)
    }
  }

  /** Dungeon footstep with echo */
  footstep(stepIndex: number): void {
    this.ensureRunning()
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.15)

    const baseFreq = stepIndex % 2 === 0 ? 90 : 115
    const freq = baseFreq * jitter

    // Primary footstep tap
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now)
    osc.frequency.exponentialRampToValueAtTime(freq * 0.4, now + 0.05)

    filter.type = 'lowpass'
    filter.frequency.value = 280

    envelope(this.ctx, gain, 0.1, now, 2, 48)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.06)

    // Stone texture noise
    const noiseBuffer = this.getNoiseBuffer(0.04)
    const noise = this.ctx.createBufferSource()
    const noiseGain = this.ctx.createGain()
    const noiseFilter = this.ctx.createBiquadFilter()

    noise.buffer = noiseBuffer
    noiseFilter.type = 'lowpass'
    noiseFilter.frequency.value = 350
    envelope(this.ctx, noiseGain, 0.05, now, 2, 35)

    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(this.masterGain)
    noise.start(now)
    noise.stop(now + 0.05)

    // Echo: delayed quieter repeat for dungeon reverb feel
    const echoDelay = 0.08
    const echoFreq = freq * 0.85
    const echoOsc = this.ctx.createOscillator()
    const echoGain = this.ctx.createGain()
    const echoFilter = this.ctx.createBiquadFilter()

    echoOsc.type = 'sine'
    echoOsc.frequency.setValueAtTime(echoFreq, now + echoDelay)
    echoOsc.frequency.exponentialRampToValueAtTime(echoFreq * 0.4, now + echoDelay + 0.04)

    echoFilter.type = 'lowpass'
    echoFilter.frequency.value = 200

    envelope(this.ctx, echoGain, 0.03, now + echoDelay, 2, 40)

    echoOsc.connect(echoFilter)
    echoFilter.connect(echoGain)
    echoGain.connect(this.masterGain)
    echoOsc.start(now + echoDelay)
    echoOsc.stop(now + echoDelay + 0.06)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UI SOUNDS
  // ═══════════════════════════════════════════════════════════════════════

  /** Crystalline ascending chime — treasure/pickup */
  pickup(): void {
    this.ensureRunning()
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.05)

    const tones = [600, 800, 1000]
    const interval = 0.05

    for (let i = 0; i < tones.length; i++) {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const startAt = now + i * interval

      osc.type = 'sine'
      osc.frequency.setValueAtTime(tones[i] * jitter, startAt)
      envelope(this.ctx, gain, 0.2, startAt, 5, 80)

      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start(startAt)
      osc.stop(startAt + 0.1)
    }
  }

  /** Triumphant ascending C-E-G chime — level up */
  levelUp(): void {
    this.ensureRunning()
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.05)

    // C5-E5-G5 major chord, 200ms each as specified
    const notes = [
      { freq: 523.25, delay: 0 },
      { freq: 659.25, delay: 0.2 },
      { freq: 783.99, delay: 0.4 },
    ]

    for (const note of notes) {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const startAt = now + note.delay
      osc.type = 'sine'
      osc.frequency.setValueAtTime(note.freq * jitter, startAt)
      envelope(this.ctx, gain, 0.22, startAt, 10, 190)
      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start(startAt)
      osc.stop(startAt + 0.25)
    }

    // Shimmer: bright octave C6 at the end
    const shimmer = this.ctx.createOscillator()
    const shimmerGain = this.ctx.createGain()
    shimmer.type = 'triangle'
    shimmer.frequency.setValueAtTime(1046.5 * jitter, now + 0.5)
    envelope(this.ctx, shimmerGain, 0.12, now + 0.5, 10, 300)
    shimmer.connect(shimmerGain)
    shimmerGain.connect(this.masterGain)
    shimmer.start(now + 0.5)
    shimmer.stop(now + 0.9)
  }

  /** Metallic click + shimmer — mod pickup */
  modPickup(): void {
    this.ensureRunning()
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.08)

    // Metallic click
    const click = this.ctx.createOscillator()
    const clickGain = this.ctx.createGain()
    click.type = 'square'
    click.frequency.setValueAtTime(2000 * jitter, now)
    click.frequency.exponentialRampToValueAtTime(800, now + 0.02)
    envelope(this.ctx, clickGain, 0.2, now, 1, 19)
    click.connect(clickGain)
    clickGain.connect(this.masterGain)
    click.start(now)
    click.stop(now + 0.03)

    // Shimmer ascending
    const shimmer = this.ctx.createOscillator()
    const shimmerGain = this.ctx.createGain()
    shimmer.type = 'sine'
    shimmer.frequency.setValueAtTime(800 * jitter, now + 0.03)
    shimmer.frequency.exponentialRampToValueAtTime(1600 * jitter, now + 0.15)
    envelope(this.ctx, shimmerGain, 0.12, now + 0.03, 5, 115)
    shimmer.connect(shimmerGain)
    shimmerGain.connect(this.masterGain)
    shimmer.start(now + 0.03)
    shimmer.stop(now + 0.18)

    // Harmonic overtone
    const harm = this.ctx.createOscillator()
    const harmGain = this.ctx.createGain()
    harm.type = 'sine'
    harm.frequency.setValueAtTime(1600 * jitter, now + 0.05)
    harm.frequency.exponentialRampToValueAtTime(3200 * jitter, now + 0.15)
    envelope(this.ctx, harmGain, 0.05, now + 0.05, 5, 80)
    harm.connect(harmGain)
    harmGain.connect(this.masterGain)
    harm.start(now + 0.05)
    harm.stop(now + 0.15)
  }

  /** Subtle click — menu select */
  menuSelect(): void {
    this.ensureRunning()
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.05)

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1200 * jitter, now)
    envelope(this.ctx, gain, 0.15, now, 2, 25)
    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.04)
  }

  /** Stone grinding — noise with low-pass filter sweep */
  doorOpen(): void {
    this.ensureRunning()
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.08)

    // Low grinding tone
    const osc = this.ctx.createOscillator()
    const oscGain = this.ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(80 * jitter, now)
    osc.frequency.linearRampToValueAtTime(120 * jitter, now + 0.4)
    envelope(this.ctx, oscGain, 0.15, now, 30, 370)
    osc.connect(oscGain)
    oscGain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.5)

    // Grinding noise with filter sweep
    const noiseBuffer = this.getNoiseBuffer(0.4)
    const noise = this.ctx.createBufferSource()
    const noiseGain = this.ctx.createGain()
    const noiseFilter = this.ctx.createBiquadFilter()
    noise.buffer = noiseBuffer
    noiseFilter.type = 'lowpass'
    noiseFilter.frequency.setValueAtTime(200 * jitter, now)
    noiseFilter.frequency.linearRampToValueAtTime(800 * jitter, now + 0.3)
    noiseFilter.frequency.linearRampToValueAtTime(300 * jitter, now + 0.45)
    noiseFilter.Q.value = 2
    envelope(this.ctx, noiseGain, 0.12, now, 20, 380)
    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(this.masterGain)
    noise.start(now)
    noise.stop(now + 0.45)
  }

  /** Deep reverb boom + fade out all music — player death */
  playerDeath(): void {
    this.ensureRunning()
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.05)

    // Deep reverb boom
    const boom = this.ctx.createOscillator()
    const boomGain = this.ctx.createGain()
    boom.type = 'sine'
    boom.frequency.setValueAtTime(50 * jitter, now)
    boom.frequency.exponentialRampToValueAtTime(15, now + 1.0)
    envelope(this.ctx, boomGain, 0.5, now, 10, 990)
    boom.connect(boomGain)
    boomGain.connect(this.masterGain)
    boom.start(now)
    boom.stop(now + 1.2)

    // Dissonant chord fading
    const darkFreqs = [110, 116.54, 130.81] // A2, Bb2, C3
    for (const freq of darkFreqs) {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(freq * jitter, now)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.3, now + 1.5)
      envelope(this.ctx, gain, 0.1, now, 30, 1470)
      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start(now)
      osc.stop(now + 1.8)
    }

    // Fade out all music
    this.fadeOutMusic(2000)
  }

  /** Victory fanfare (2 notes) — room clear */
  roomClear(): void {
    this.ensureRunning()
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.05)

    // Note 1: G5
    const osc1 = this.ctx.createOscillator()
    const gain1 = this.ctx.createGain()
    osc1.type = 'triangle'
    osc1.frequency.setValueAtTime(783.99 * jitter, now)
    envelope(this.ctx, gain1, 0.2, now, 5, 195)
    osc1.connect(gain1)
    gain1.connect(this.masterGain)
    osc1.start(now)
    osc1.stop(now + 0.25)

    // Note 2: C6 (resolution)
    const osc2 = this.ctx.createOscillator()
    const gain2 = this.ctx.createGain()
    osc2.type = 'triangle'
    osc2.frequency.setValueAtTime(1046.5 * jitter, now + 0.15)
    envelope(this.ctx, gain2, 0.25, now + 0.15, 5, 295)
    osc2.connect(gain2)
    gain2.connect(this.masterGain)
    osc2.start(now + 0.15)
    osc2.stop(now + 0.5)

    // Shimmer chord underneath
    const chordFreqs = [523.25, 659.25, 783.99] // C-E-G
    for (const freq of chordFreqs) {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq * jitter, now + 0.15)
      envelope(this.ctx, gain, 0.06, now + 0.15, 10, 390)
      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start(now + 0.15)
      osc.stop(now + 0.6)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PARTNER SOUNDS
  // ═══════════════════════════════════════════════════════════════════════

  /** Subtle notification pop — partner has something to say */
  partnerSpeak(): void {
    this.ensureRunning()
    const now = this.ctx.currentTime
    const jitter = pitchJitter(0.08)

    // Brief volume ducking during speech bubble (3s auto-restore)
    this.startDucking()
    setTimeout(() => this.stopDucking(), 3000)

    const osc1 = this.ctx.createOscillator()
    const gain1 = this.ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(500 * jitter, now)
    envelope(this.ctx, gain1, 0.12, now, 3, 35)
    osc1.connect(gain1)
    gain1.connect(this.masterGain)
    osc1.start(now)
    osc1.stop(now + 0.05)

    const osc2 = this.ctx.createOscillator()
    const gain2 = this.ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(700 * jitter, now + 0.04)
    envelope(this.ctx, gain2, 0.1, now + 0.04, 3, 45)
    osc2.connect(gain2)
    gain2.connect(this.masterGain)
    osc2.start(now + 0.04)
    osc2.stop(now + 0.1)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // AMBIENT ROOM SOUNDS
  // ═══════════════════════════════════════════════════════════════════════

  /** Start room-specific ambient sounds based on room type */
  startRoomAmbient(roomType: RoomType): void {
    this.ensureRunning()
    // Stop previous room ambient if active
    this.stopRoomAmbient()
    this.currentRoomType = roomType

    switch (roomType) {
      case 'arena':
        this.ambientArena()
        break
      case 'corridor':
        this.ambientCorridor()
        break
      case 'treasure':
        this.ambientTreasure()
        break
      case 'boss':
        this.ambientBoss()
        break
    }
  }

  /** Stop all room-specific ambient sounds */
  stopRoomAmbient(): void {
    const now = this.ctx.currentTime
    // Fade out all room ambient gains
    for (const g of this.roomAmbientGains) {
      try { g.gain.linearRampToValueAtTime(0.001, now + 0.5) } catch { /* ignore */ }
    }
    // Schedule cleanup after fade
    setTimeout(() => {
      for (const node of this.roomAmbientNodes) {
        try { node.stop(); node.disconnect() } catch { /* ignore */ }
      }
      for (const g of this.roomAmbientGains) {
        try { g.disconnect() } catch { /* ignore */ }
      }
      this.roomAmbientNodes = []
      this.roomAmbientGains = []
    }, 600)
    // Clear timers
    for (const t of this.roomAmbientTimers) {
      clearTimeout(t)
      clearInterval(t as unknown as ReturnType<typeof setInterval>)
    }
    this.roomAmbientTimers = []
    this.currentRoomType = null
  }

  /** Arena: distant rumble + heartbeat-like pulse */
  private ambientArena(): void {
    const now = this.ctx.currentTime

    // Low rumble drone
    const rumbleGain = this.ctx.createGain()
    rumbleGain.gain.setValueAtTime(0.04, now)
    rumbleGain.connect(this.masterGain)
    this.roomAmbientGains.push(rumbleGain)

    const rumble = this.ctx.createOscillator()
    rumble.type = 'sine'
    rumble.frequency.setValueAtTime(42, now)
    rumble.connect(rumbleGain)
    rumble.start(now)
    this.roomAmbientNodes.push(rumble)

    // Heartbeat pulse: periodic low thump
    const heartbeat = () => {
      if (this.currentRoomType !== 'arena') return
      const t = this.ctx.currentTime
      const beat = this.ctx.createOscillator()
      const beatGain = this.ctx.createGain()
      beat.type = 'sine'
      beat.frequency.setValueAtTime(50, t)
      beat.frequency.exponentialRampToValueAtTime(25, t + 0.15)
      envelope(this.ctx, beatGain, 0.06, t, 5, 145)
      beat.connect(beatGain)
      beatGain.connect(this.masterGain)
      beat.start(t)
      beat.stop(t + 0.2)

      // Double beat (lub-dub)
      const beat2 = this.ctx.createOscillator()
      const beat2Gain = this.ctx.createGain()
      beat2.type = 'sine'
      beat2.frequency.setValueAtTime(40, t + 0.18)
      beat2.frequency.exponentialRampToValueAtTime(20, t + 0.3)
      envelope(this.ctx, beat2Gain, 0.04, t + 0.18, 5, 95)
      beat2.connect(beat2Gain)
      beat2Gain.connect(this.masterGain)
      beat2.start(t + 0.18)
      beat2.stop(t + 0.35)

      const nextBeat = 1500 + Math.random() * 500
      const timer = setTimeout(heartbeat, nextBeat)
      this.roomAmbientTimers.push(timer)
    }
    const initTimer = setTimeout(heartbeat, 1000)
    this.roomAmbientTimers.push(initTimer)
  }

  /** Corridor: dripping water (random pings) + wind whoosh */
  private ambientCorridor(): void {
    const now = this.ctx.currentTime

    // Wind: filtered noise, very quiet
    const windGain = this.ctx.createGain()
    windGain.gain.setValueAtTime(0.03, now)
    windGain.connect(this.masterGain)
    this.roomAmbientGains.push(windGain)

    const windBuffer = createNoiseBuffer(this.ctx, 4.0)
    const wind = this.ctx.createBufferSource()
    wind.buffer = windBuffer
    wind.loop = true
    const windFilter = this.ctx.createBiquadFilter()
    windFilter.type = 'bandpass'
    windFilter.frequency.value = 300
    windFilter.Q.value = 1
    wind.connect(windFilter)
    windFilter.connect(windGain)
    wind.start(now)
    this.roomAmbientNodes.push(wind)

    // Dripping water: random pings every 2-5s
    const drip = () => {
      if (this.currentRoomType !== 'corridor') return
      const t = this.ctx.currentTime
      const jitter = pitchJitter(0.2)
      const freq = (1800 + Math.random() * 1200) * jitter

      const osc = this.ctx.createOscillator()
      const dripGain = this.ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, t)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.06)
      envelope(this.ctx, dripGain, 0.05 + Math.random() * 0.03, t, 2, 58)

      // Random pan for spatial drip location
      const dripPanner = this.ctx.createStereoPanner()
      dripPanner.pan.value = Math.random() * 2 - 1

      osc.connect(dripGain)
      dripGain.connect(dripPanner)
      dripPanner.connect(this.masterGain)
      osc.start(t)
      osc.stop(t + 0.08)

      const nextDrip = 2000 + Math.random() * 3000
      const timer = setTimeout(drip, nextDrip)
      this.roomAmbientTimers.push(timer)
    }
    const initTimer = setTimeout(drip, 500 + Math.random() * 2000)
    this.roomAmbientTimers.push(initTimer)
  }

  /** Treasure: soft chime + warm hum */
  private ambientTreasure(): void {
    const now = this.ctx.currentTime

    // Warm hum: two sine oscillators a 5th apart
    const humGain = this.ctx.createGain()
    humGain.gain.setValueAtTime(0.03, now)
    humGain.connect(this.masterGain)
    this.roomAmbientGains.push(humGain)

    const hum1 = this.ctx.createOscillator()
    hum1.type = 'sine'
    hum1.frequency.setValueAtTime(220, now) // A3
    hum1.connect(humGain)
    hum1.start(now)
    this.roomAmbientNodes.push(hum1)

    const hum2 = this.ctx.createOscillator()
    hum2.type = 'sine'
    hum2.frequency.setValueAtTime(330, now) // E4 — perfect 5th
    const hum2Gain = this.ctx.createGain()
    hum2Gain.gain.setValueAtTime(0.015, now)
    hum2Gain.connect(this.masterGain)
    this.roomAmbientGains.push(hum2Gain)
    hum2.connect(hum2Gain)
    hum2.start(now)
    this.roomAmbientNodes.push(hum2)

    // Periodic soft chime
    const chime = () => {
      if (this.currentRoomType !== 'treasure') return
      const t = this.ctx.currentTime
      const jitter = pitchJitter(0.1)
      // Random pentatonic note for pleasant feel
      const pentatonic = [523.25, 587.33, 659.25, 783.99, 880.00] // C5, D5, E5, G5, A5
      const freq = pentatonic[Math.floor(Math.random() * pentatonic.length)] * jitter

      const osc = this.ctx.createOscillator()
      const chimeGain = this.ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, t)
      envelope(this.ctx, chimeGain, 0.04, t, 5, 295)

      const chimePanner = this.ctx.createStereoPanner()
      chimePanner.pan.value = Math.random() * 1.4 - 0.7

      osc.connect(chimeGain)
      chimeGain.connect(chimePanner)
      chimePanner.connect(this.masterGain)
      osc.start(t)
      osc.stop(t + 0.35)

      const nextChime = 3000 + Math.random() * 4000
      const timer = setTimeout(chime, nextChime)
      this.roomAmbientTimers.push(timer)
    }
    const initTimer = setTimeout(chime, 1000 + Math.random() * 2000)
    this.roomAmbientTimers.push(initTimer)
  }

  /** Boss room: ominous low frequency + warning pulse */
  private ambientBoss(): void {
    const now = this.ctx.currentTime

    // Ominous drone: very low sine
    const droneGain = this.ctx.createGain()
    droneGain.gain.setValueAtTime(0.06, now)
    droneGain.connect(this.masterGain)
    this.roomAmbientGains.push(droneGain)

    const drone = this.ctx.createOscillator()
    drone.type = 'sine'
    drone.frequency.setValueAtTime(30, now)
    drone.connect(droneGain)
    drone.start(now)
    this.roomAmbientNodes.push(drone)

    // Dissonant tritone layer
    const tritoneGain = this.ctx.createGain()
    tritoneGain.gain.setValueAtTime(0.02, now)
    tritoneGain.connect(this.masterGain)
    this.roomAmbientGains.push(tritoneGain)

    const tritone = this.ctx.createOscillator()
    tritone.type = 'sine'
    tritone.frequency.setValueAtTime(42.5, now) // tritone interval
    tritone.connect(tritoneGain)
    tritone.start(now)
    this.roomAmbientNodes.push(tritone)

    // Warning pulse: periodic low thud
    const pulse = () => {
      if (this.currentRoomType !== 'boss') return
      const t = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const pulseGain = this.ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(35, t)
      osc.frequency.exponentialRampToValueAtTime(18, t + 0.3)
      envelope(this.ctx, pulseGain, 0.08, t, 10, 290)
      osc.connect(pulseGain)
      pulseGain.connect(this.masterGain)
      osc.start(t)
      osc.stop(t + 0.35)

      const nextPulse = 2000 + Math.random() * 1000
      const timer = setTimeout(pulse, nextPulse)
      this.roomAmbientTimers.push(timer)
    }
    const initTimer = setTimeout(pulse, 500)
    this.roomAmbientTimers.push(initTimer)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ADAPTIVE COMBAT MUSIC (tension-driven layers)
  // ═══════════════════════════════════════════════════════════════════════

  /** Start the adaptive music system. Call once when entering a dungeon. */
  startAdaptiveMusic(): void {
    if (this.musicRunning) return
    this.ensureRunning()
    this.musicRunning = true
    const now = this.ctx.currentTime

    // Master music bus
    this.musicGain = this.ctx.createGain()
    this.musicGain.gain.setValueAtTime(0.06, now) // quiet — it's ambient support
    this.musicGain.connect(this.masterGain)

    // Layer 1: Ambient drone (always on, tension 0+)
    this.musicDroneGain = this.ctx.createGain()
    this.musicDroneGain.gain.setValueAtTime(1.0, now)
    this.musicDroneGain.connect(this.musicGain)

    this.musicDroneOsc = this.ctx.createOscillator()
    this.musicDroneOsc.type = 'sine'
    this.musicDroneOsc.frequency.setValueAtTime(55, now) // A1
    this.musicDroneOsc.connect(this.musicDroneGain)
    this.musicDroneOsc.start(now)

    // Layer 2: Rhythmic kick (tension 0.3+)
    this.musicKickGain = this.ctx.createGain()
    this.musicKickGain.gain.setValueAtTime(0, now)
    this.musicKickGain.connect(this.musicGain)
    this.startKickPattern()

    // Layer 3: Bass arpeggio (tension 0.5+)
    this.musicBassGain = this.ctx.createGain()
    this.musicBassGain.gain.setValueAtTime(0, now)
    this.musicBassGain.connect(this.musicGain)
    this.startBassArpeggio()

    // Layer 4: Combat lead — hi-hat + distorted lead (tension 0.7+)
    this.musicHihatGain = this.ctx.createGain()
    this.musicHihatGain.gain.setValueAtTime(0, now)
    this.musicHihatGain.connect(this.musicGain)
    this.startHihatPattern()

    this.musicLeadGain = this.ctx.createGain()
    this.musicLeadGain.gain.setValueAtTime(0, now)
    this.musicLeadGain.connect(this.musicGain)
    this.startLeadSynth()
  }

  /** Update music layers based on current tension (0-1). Call each frame. */
  updateMusicTension(tension: number): void {
    if (!this.musicRunning) return
    const t = clamp(tension, 0, 1)
    this.currentTension = t
    const now = this.ctx.currentTime
    const fadeTime = 0.5 // 500ms crossfade

    // Layer 2: Kick pattern — fade in at 0.3, full at 0.5
    if (this.musicKickGain) {
      const kickVol = t < 0.3 ? 0 : Math.min((t - 0.3) / 0.2, 1)
      this.musicKickGain.gain.linearRampToValueAtTime(kickVol, now + fadeTime)
    }

    // Layer 3: Bass arpeggio — fade in at 0.5, full at 0.7
    if (this.musicBassGain) {
      const bassVol = t < 0.5 ? 0 : Math.min((t - 0.5) / 0.2, 1)
      this.musicBassGain.gain.linearRampToValueAtTime(bassVol, now + fadeTime)
    }

    // Layer 4: Hi-hat + lead — fade in at 0.7, full at 0.9
    if (this.musicHihatGain) {
      const hihatVol = t < 0.7 ? 0 : Math.min((t - 0.7) / 0.2, 1)
      this.musicHihatGain.gain.linearRampToValueAtTime(hihatVol, now + fadeTime)
    }
    if (this.musicLeadGain) {
      const leadVol = t < 0.7 ? 0 : Math.min((t - 0.7) / 0.2, 1) * 0.7
      this.musicLeadGain.gain.linearRampToValueAtTime(leadVol, now + fadeTime)
    }

    // Drone pitch shifts with tension (darker at high tension)
    if (this.musicDroneOsc) {
      const droneFreq = 55 - t * 15 // A1 down to ~F1 at max tension
      this.musicDroneOsc.frequency.linearRampToValueAtTime(droneFreq, now + fadeTime)
    }
  }

  /** Kick drum pattern: periodic low sine thump */
  private startKickPattern(): void {
    const bpm = 120
    const interval = (60 / bpm) * 1000 // ms per beat

    this.musicKickTimer = setInterval(() => {
      if (!this.musicKickGain || !this.musicRunning) return
      const t = this.ctx.currentTime
      const kick = this.ctx.createOscillator()
      const kickGain = this.ctx.createGain()
      kick.type = 'sine'
      kick.frequency.setValueAtTime(80, t)
      kick.frequency.exponentialRampToValueAtTime(30, t + 0.08)
      envelope(this.ctx, kickGain, 0.8, t, 2, 78)
      kick.connect(kickGain)
      kickGain.connect(this.musicKickGain!)
      kick.start(t)
      kick.stop(t + 0.1)
    }, interval)
  }

  /** Bass arpeggio: cycling low synth notes (A minor pentatonic) */
  private startBassArpeggio(): void {
    const bpm = 120
    const interval = (60 / bpm / 2) * 1000 // eighth notes
    const notes = [55, 65.41, 73.42, 82.41, 98.00] // A1, C2, D2, E2, G2
    let noteIndex = 0

    const playNote = () => {
      if (!this.musicBassGain || !this.musicRunning) return
      const t = this.ctx.currentTime
      const freq = notes[noteIndex % notes.length] * pitchJitter(0.03)
      noteIndex++

      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const filter = this.ctx.createBiquadFilter()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(freq, t)
      filter.type = 'lowpass'
      filter.frequency.value = 300 + this.currentTension * 400
      envelope(this.ctx, gain, 0.6, t, 5, 220)
      osc.connect(filter)
      filter.connect(gain)
      gain.connect(this.musicBassGain!)
      osc.start(t)
      osc.stop(t + 0.28)
    }

    // Use setInterval for the bass pattern
    const timer = setInterval(playNote, interval)
    this.roomAmbientTimers.push(timer as unknown as ReturnType<typeof setTimeout>)
  }

  /** Hi-hat pattern: fast noise clicks */
  private startHihatPattern(): void {
    const bpm = 120
    const interval = (60 / bpm / 4) * 1000 // sixteenth notes

    this.musicHihatTimer = setInterval(() => {
      if (!this.musicHihatGain || !this.musicRunning) return
      const t = this.ctx.currentTime
      const noiseBuffer = this.getNoiseBuffer(0.04)
      const noise = this.ctx.createBufferSource()
      const gain = this.ctx.createGain()
      const filter = this.ctx.createBiquadFilter()
      noise.buffer = noiseBuffer
      filter.type = 'highpass'
      filter.frequency.value = 8000
      // Accent pattern: slightly louder on 1st and 3rd sixteenth
      const volume = Math.random() < 0.5 ? 0.5 : 0.3
      envelope(this.ctx, gain, volume, t, 1, 25)
      noise.connect(filter)
      filter.connect(gain)
      gain.connect(this.musicHihatGain!)
      noise.start(t)
      noise.stop(t + 0.03)
    }, interval)
  }

  /** Lead synth: distorted oscillator playing a repeating pattern */
  private startLeadSynth(): void {
    const bpm = 120
    const interval = (60 / bpm) * 1000 // quarter notes
    const pattern = [440, 523.25, 587.33, 523.25, 659.25, 587.33, 523.25, 440] // A4 melodic pattern
    let patternIndex = 0

    const playLead = () => {
      if (!this.musicLeadGain || !this.musicRunning) return
      const t = this.ctx.currentTime
      const freq = pattern[patternIndex % pattern.length] * pitchJitter(0.05)
      patternIndex++

      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const distFilter = this.ctx.createBiquadFilter()
      osc.type = 'square'
      osc.frequency.setValueAtTime(freq, t)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.9, t + 0.4)
      distFilter.type = 'lowpass'
      distFilter.frequency.value = 1200
      distFilter.Q.value = 8 // resonant for gritty feel
      envelope(this.ctx, gain, 0.4, t, 10, 390)
      osc.connect(distFilter)
      distFilter.connect(gain)
      gain.connect(this.musicLeadGain!)
      osc.start(t)
      osc.stop(t + 0.45)
    }

    const timer = setInterval(playLead, interval)
    this.roomAmbientTimers.push(timer as unknown as ReturnType<typeof setTimeout>)
  }

  /** Fade out all music layers over the given duration (ms) */
  private fadeOutMusic(durationMs: number): void {
    const now = this.ctx.currentTime
    const dur = durationMs / 1000

    if (this.musicGain) {
      this.musicGain.gain.linearRampToValueAtTime(0.001, now + dur)
    }
  }

  /** Stop all adaptive music. Call when leaving the dungeon. */
  stopAdaptiveMusic(): void {
    if (!this.musicRunning) return
    this.musicRunning = false

    if (this.musicKickTimer) { clearInterval(this.musicKickTimer); this.musicKickTimer = null }
    if (this.musicHihatTimer) { clearInterval(this.musicHihatTimer); this.musicHihatTimer = null }

    // Stop and disconnect all music oscillators
    const oscs = [this.musicDroneOsc, this.musicBassOsc, this.musicLeadOsc]
    for (const osc of oscs) {
      if (osc) { try { osc.stop(); osc.disconnect() } catch { /* ignore */ } }
    }
    this.musicDroneOsc = null
    this.musicBassOsc = null
    this.musicLeadOsc = null

    const gains = [this.musicGain, this.musicDroneGain, this.musicKickGain, this.musicBassGain, this.musicHihatGain, this.musicLeadGain]
    for (const g of gains) {
      if (g) { try { g.disconnect() } catch { /* ignore */ } }
    }
    this.musicGain = null
    this.musicDroneGain = null
    this.musicKickGain = null
    this.musicBassGain = null
    this.musicHihatGain = null
    this.musicLeadGain = null
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VOLUME DUCKING
  // ═══════════════════════════════════════════════════════════════════════

  /** Duck master volume (for speech bubbles, cutscenes, etc.) */
  startDucking(): void {
    if (this.duckingActive || !this.duckGainNode) return
    this.duckingActive = true
    const now = this.ctx.currentTime
    this.duckGainNode.gain.linearRampToValueAtTime(0.4, now + 0.15)
  }

  /** Restore volume after ducking */
  stopDucking(): void {
    if (!this.duckingActive || !this.duckGainNode) return
    this.duckingActive = false
    const now = this.ctx.currentTime
    this.duckGainNode.gain.linearRampToValueAtTime(1.0, now + 0.3)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BASE AMBIENCE (existing — catacomb drone)
  // ═══════════════════════════════════════════════════════════════════════

  /** Continuous low ominous drone — Diablo's catacombs */
  startAmbience(): void {
    this.ensureRunning()
    if (this.ambientDrone) return

    const now = this.ctx.currentTime

    this.ambientGain = this.ctx.createGain()
    this.ambientGain.gain.setValueAtTime(0.08, now)
    this.ambientGain.connect(this.masterGain)

    // Sub drone
    this.ambientDrone = this.ctx.createOscillator()
    this.ambientDrone.type = 'sine'
    this.ambientDrone.frequency.setValueAtTime(38, now)
    const droneGain = this.ctx.createGain()
    droneGain.gain.setValueAtTime(1.0, now)
    this.ambientDrone.connect(droneGain)
    droneGain.connect(this.ambientGain)
    this.ambientDrone.start(now)

    // Second drone — tritone
    const drone2 = this.ctx.createOscillator()
    drone2.type = 'sine'
    drone2.frequency.setValueAtTime(54, now)
    const drone2Gain = this.ctx.createGain()
    drone2Gain.gain.setValueAtTime(0.3, now)
    drone2.connect(drone2Gain)
    drone2Gain.connect(this.ambientGain)
    drone2.start(now)

    // Filtered noise layer
    const noiseBuffer = createNoiseBuffer(this.ctx, 2.0)
    this.ambientNoiseSource = this.ctx.createBufferSource()
    this.ambientNoiseSource.buffer = noiseBuffer
    this.ambientNoiseSource.loop = true
    const noiseFilter = this.ctx.createBiquadFilter()
    noiseFilter.type = 'lowpass'
    noiseFilter.frequency.value = 200
    noiseFilter.Q.value = 1
    const noiseGain = this.ctx.createGain()
    noiseGain.gain.setValueAtTime(0.4, now)
    this.ambientNoiseSource.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(this.ambientGain)
    this.ambientNoiseSource.start(now)

    // Battle intensity layer
    this.battleGain = this.ctx.createGain()
    this.battleGain.gain.setValueAtTime(0, now)
    this.battleGain.connect(this.ambientGain)

    this.battleOsc = this.ctx.createOscillator()
    this.battleOsc.type = 'sawtooth'
    this.battleOsc.frequency.setValueAtTime(80, now)
    const battleFilter = this.ctx.createBiquadFilter()
    battleFilter.type = 'lowpass'
    battleFilter.frequency.value = 400
    this.battleOsc.connect(battleFilter)
    battleFilter.connect(this.battleGain)
    this.battleOsc.start(now)

    // Also start adaptive music
    this.startAdaptiveMusic()
  }

  /** Silence the dungeon */
  stopAmbience(): void {
    const now = this.ctx.currentTime
    const fadeOut = 0.3

    if (this.ambientGain) {
      this.ambientGain.gain.linearRampToValueAtTime(0.001, now + fadeOut)
    }

    setTimeout(() => {
      if (this.ambientDrone) {
        try { this.ambientDrone.stop() } catch { /* ignore */ }
        this.ambientDrone.disconnect()
        this.ambientDrone = null
      }
      if (this.ambientNoiseSource) {
        try { this.ambientNoiseSource.stop() } catch { /* ignore */ }
        this.ambientNoiseSource.disconnect()
        this.ambientNoiseSource = null
      }
      if (this.battleOsc) {
        try { this.battleOsc.stop() } catch { /* ignore */ }
        this.battleOsc.disconnect()
        this.battleOsc = null
      }
      if (this.battleGain) {
        this.battleGain.disconnect()
        this.battleGain = null
      }
      if (this.ambientGain) {
        this.ambientGain.disconnect()
        this.ambientGain = null
      }
    }, fadeOut * 1000 + 50)

    // Stop adaptive music and room ambient
    this.stopAdaptiveMusic()
    this.stopRoomAmbient()
  }

  /** Crossfade between calm ambience and battle tension (0=calm, 1=intense) */
  setBattleIntensity(level: number): void {
    if (!this.battleGain || !this.battleOsc) return
    const clamped = clamp(level, 0, 1)
    this.battleIntensity = clamped
    const now = this.ctx.currentTime

    this.battleGain.gain.linearRampToValueAtTime(clamped * 0.6, now + 0.1)
    this.battleOsc.frequency.linearRampToValueAtTime(80 + clamped * 60, now + 0.1)

    // Also drive adaptive music layers with the same intensity
    this.updateMusicTension(clamped)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UTILITY
  // ═══════════════════════════════════════════════════════════════════════

  /** Set master volume (0-1) */
  setVolume(vol: number): void {
    const clamped = clamp(vol, 0, 1)
    this.savedVolume = clamped
    if (!this.muted) {
      this.masterGain.gain.linearRampToValueAtTime(clamped, this.ctx.currentTime + 0.05)
    }
  }

  /** Mute all audio */
  mute(): void {
    this.muted = true
    this.masterGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.05)
  }

  /** Restore volume */
  unmute(): void {
    this.muted = false
    this.masterGain.gain.linearRampToValueAtTime(this.savedVolume, this.ctx.currentTime + 0.05)
  }
}

// ── Singleton ─────────────────────────────────────────────────────────

export const sound = new SoundEngine()
