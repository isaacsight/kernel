// kbot Stream Self-Evaluation — analyzes own rendered frames and auto-adjusts visual quality
//
// Three-method active inference loop:
// 1. Rule-based frame analysis (every 30 seconds / 180 frames at 6fps)
// 2. LLM deep evaluation via Gemma 4 on Ollama (every 5 minutes / 1800 frames)
// 3. Engagement-based learning (correlates config with chat rate)
//
// The stream looks at itself and constantly self-improves.

import { registerTool } from './index.js'

// ─── Interfaces ──────────────────────────────────────────────────

export interface StreamConfig {
  robotScale: number            // 8-12
  robotScreenYPercent: number   // 0.4-0.7 (where on screen)
  headerOpacity: number         // 0.5-0.9
  chatOpacity: number           // 0.4-0.8
  chatFadeSeconds: number       // 5-15
  skyBrightness: number         // 0.3-0.8
  ambientLight: number          // 0.3-0.8
  borderWidth: number           // 1-4
  speechBubbleWidth: number     // 400-700
  particleDensity: number       // 0.5-2.0
  bloomIntensity: number        // 0.0-0.5
  vignetteStrength: number      // 0.1-0.5
}

export interface FrameAnalysis {
  robotVisibility: number       // 0-1: how much the robot stands out from background
  brightnessBalance: number     // 0-1: is the image too dark or too bright?
  colorVariety: number          // 0-1: are there enough distinct colors?
  skyToGroundRatio: number      // 0-1: how much sky vs ground is visible
  chatReadability: number       // 0-1: can the chat overlay be read?
  overallScore: number          // 0-1 weighted average
  issues: string[]
  suggestions: StreamConfigAdjustment[]
}

export interface StreamConfigAdjustment {
  param: keyof StreamConfig
  oldValue: number
  newValue: number
  reason: string
}

export interface LLMEvaluation {
  robotVisibility: number       // 1-10
  colorBalance: number          // 1-10
  layoutClarity: number         // 1-10
  overallFeel: number           // 1-10
  suggestedParam: keyof StreamConfig | null
  suggestedValue: number | null
  suggestedReason: string
  raw: string
}

export interface StreamEvaluation {
  lastEvalFrame: number
  lastDeepEvalFrame: number
  evalInterval: number          // frames between rule-based evaluations (default: 180 = 30 seconds)
  deepEvalInterval: number      // frames between LLM evaluations (default: 1800 = 5 minutes)
  currentConfig: StreamConfig
  configHistory: Array<{ config: StreamConfig; score: number; chatRate: number; timestamp: number }>
  issuesFound: string[]
  adjustmentsMade: string[]
  totalEvaluations: number
  totalDeepEvaluations: number
  lastAnalysis: FrameAnalysis | null
  lastLLMEval: LLMEvaluation | null
  announcementQueue: string[]   // speech bubble messages about self-adjustments
}

// ─── Pixel Sampling Utilities ────────────────────────────────────

interface RGB { r: number; g: number; b: number }

function samplePixels(imageData: { data: Uint8ClampedArray; width: number; height: number }, count: number): RGB[] {
  const pixels: RGB[] = []
  const { data, width, height } = imageData
  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * width)
    const y = Math.floor(Math.random() * height)
    const idx = (y * width + x) * 4
    pixels.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] })
  }
  return pixels
}

function sampleRegion(imageData: { data: Uint8ClampedArray; width: number; height: number }, rx: number, ry: number, rw: number, rh: number, count: number): RGB[] {
  const pixels: RGB[] = []
  const { data, width } = imageData
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rx + Math.random() * rw)
    const y = Math.floor(ry + Math.random() * rh)
    if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) continue
    const idx = (y * width + x) * 4
    pixels.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] })
  }
  return pixels
}

function pixelBrightness(r: number, g: number, b: number): number {
  return (r * 0.299 + g * 0.587 + b * 0.114) / 255
}

function avgBrightness(pixels: RGB[]): number {
  if (pixels.length === 0) return 0.5
  let total = 0
  for (const p of pixels) total += pixelBrightness(p.r, p.g, p.b)
  return total / pixels.length
}

function colorContrast(c1: RGB, c2: RGB): number {
  const b1 = pixelBrightness(c1.r, c1.g, c1.b)
  const b2 = pixelBrightness(c2.r, c2.g, c2.b)
  return Math.abs(b1 - b2)
}

function avgColor(pixels: RGB[]): RGB {
  if (pixels.length === 0) return { r: 128, g: 128, b: 128 }
  let rT = 0, gT = 0, bT = 0
  for (const p of pixels) { rT += p.r; gT += p.g; bT += p.b }
  return { r: Math.round(rT / pixels.length), g: Math.round(gT / pixels.length), b: Math.round(bT / pixels.length) }
}

function rgbToHue(r: number, g: number, b: number): number {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  if (max === min) return 0
  let h = 0
  const d = max - min
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else h = ((rn - gn) / d + 4) / 6
  return h
}

// ─── Default Config ──────────────────────────────────────────────

function defaultConfig(): StreamConfig {
  return {
    robotScale: 10,
    robotScreenYPercent: 0.55,
    headerOpacity: 0.7,
    chatOpacity: 0.6,
    chatFadeSeconds: 10,
    skyBrightness: 0.5,
    ambientLight: 0.5,
    borderWidth: 1,
    speechBubbleWidth: 500,
    particleDensity: 1.0,
    bloomIntensity: 0.15,
    vignetteStrength: 0.25,
  }
}

// ─── Initialize ──────────────────────────────────────────────────

export function initStreamEval(): StreamEvaluation {
  return {
    lastEvalFrame: 0,
    lastDeepEvalFrame: 0,
    evalInterval: 180,          // 30 seconds at 6fps
    deepEvalInterval: 1800,     // 5 minutes at 6fps
    currentConfig: defaultConfig(),
    configHistory: [],
    issuesFound: [],
    adjustmentsMade: [],
    totalEvaluations: 0,
    totalDeepEvaluations: 0,
    lastAnalysis: null,
    lastLLMEval: null,
    announcementQueue: [],
  }
}

// ─── Should Evaluate ─────────────────────────────────────────────

export function shouldEvaluate(evaluation: StreamEvaluation, frame: number): boolean {
  return frame - evaluation.lastEvalFrame >= evaluation.evalInterval
}

export function shouldDeepEvaluate(evaluation: StreamEvaluation, frame: number): boolean {
  return frame - evaluation.lastDeepEvalFrame >= evaluation.deepEvalInterval
}

// ─── Method 1: Rule-Based Frame Analysis ─────────────────────────

export function analyzeFrame(
  imageData: { data: Uint8ClampedArray; width: number; height: number },
  config: StreamConfig,
  robotX: number,
  robotY: number,
  robotScale: number,
  chatMessageCount: number,
  mood: string,
): FrameAnalysis {
  const { width, height } = imageData
  const issues: string[] = []
  const suggestions: StreamConfigAdjustment[] = []

  // ── Robot visibility: compare robot region to surrounding background ──
  const robotW = 32 * robotScale
  const robotH = 48 * robotScale
  const robotPixels = sampleRegion(imageData, robotX, robotY, robotW, robotH, 30)
  // Sample background around the robot (above, left, right)
  const bgAbove = sampleRegion(imageData, robotX - 40, Math.max(0, robotY - 60), robotW + 80, 50, 20)
  const bgLeft = sampleRegion(imageData, Math.max(0, robotX - 80), robotY, 60, robotH, 15)
  const bgRight = sampleRegion(imageData, robotX + robotW + 20, robotY, 60, robotH, 15)
  const bgPixels = [...bgAbove, ...bgLeft, ...bgRight]

  const robotAvg = avgColor(robotPixels)
  const bgAvg = avgColor(bgPixels)
  const robotVisibility = Math.min(1, colorContrast(robotAvg, bgAvg) * 2.5) // Scale up since robot is small

  if (robotVisibility < 0.3) issues.push('Robot is hard to see against background')
  if (robotVisibility < 0.15) issues.push('Robot is nearly invisible')

  // ── Brightness balance: sample across the whole frame ──
  const frameSample = samplePixels(imageData, 100)
  const brightness = avgBrightness(frameSample)
  // Transform: 0.0=too dark, 0.5=ideal, 1.0=too bright
  // Map so that 0.3-0.5 brightness is ideal (score=1), extremes are 0
  const brightnessBalance = brightness < 0.1 ? brightness / 0.1 * 0.3
    : brightness < 0.3 ? 0.3 + (brightness - 0.1) / 0.2 * 0.7
    : brightness < 0.6 ? 1.0
    : brightness < 0.8 ? 1.0 - (brightness - 0.6) / 0.2 * 0.5
    : Math.max(0, 0.5 - (brightness - 0.8) * 2.5)

  if (brightness < 0.15) issues.push('Frame is too dark')
  if (brightness > 0.75) issues.push('Frame is too bright/washed out')

  // ── Color variety: count unique hue buckets (12 segments) ──
  const hueSample = samplePixels(imageData, 50)
  const hueBuckets = new Set<number>()
  for (const p of hueSample) {
    const sat = (Math.max(p.r, p.g, p.b) - Math.min(p.r, p.g, p.b)) / 255
    if (sat > 0.1) { // Only count saturated pixels
      const hue = rgbToHue(p.r, p.g, p.b)
      hueBuckets.add(Math.floor(hue * 12))
    }
  }
  const colorVariety = Math.min(1, hueBuckets.size / 6) // 6+ buckets = max variety

  if (colorVariety < 0.2) issues.push('Scene looks monochromatic — very few colors')
  if (colorVariety < 0.35) issues.push('Low color variety')

  // ── Sky-to-ground ratio: sample a vertical column at center ──
  const centerX = Math.floor(width / 2)
  const verticalSamples = 40
  let skyPixelCount = 0
  for (let i = 0; i < verticalSamples; i++) {
    const y = Math.floor((i / verticalSamples) * height)
    const idx = (y * width + centerX) * 4
    const r = imageData.data[idx], g = imageData.data[idx + 1], b = imageData.data[idx + 2]
    const br = pixelBrightness(r, g, b)
    // Sky heuristic: upper half, relatively uniform, blue-ish or dark
    // Ground heuristic: lower half, more varied, green/brown tones
    if (y < height * 0.5 && (b > r * 0.8 || br < 0.25)) {
      skyPixelCount++
    }
  }
  const skyToGroundRatio = skyPixelCount / verticalSamples

  if (skyToGroundRatio > 0.7) issues.push('Too much sky visible — robot might be too low')
  if (skyToGroundRatio < 0.1) issues.push('Almost no sky visible — robot might be too high')

  // ── Chat readability: check overlay region contrast ──
  // Chat overlay is at bottom-left: (10, height-200, 400, 150)
  const chatBgPixels = sampleRegion(imageData, 10, height - 200, 400, 150, 20)
  const chatBg = avgColor(chatBgPixels)
  // Chat text is white (#e6edf3), so check contrast with background
  const chatTextColor: RGB = { r: 230, g: 237, b: 243 }
  const chatContrast = colorContrast(chatTextColor, chatBg)
  const chatReadability = chatMessageCount > 0
    ? Math.min(1, chatContrast * 2.0)  // Scale: contrast of 0.5 = fully readable
    : 0.8 // No messages = assume readable

  if (chatReadability < 0.4 && chatMessageCount > 0) issues.push('Chat overlay is hard to read')

  // ── Overall score (weighted average) ──
  const overallScore =
    robotVisibility * 0.30 +
    brightnessBalance * 0.25 +
    colorVariety * 0.15 +
    (skyToGroundRatio > 0.15 && skyToGroundRatio < 0.65 ? 1 : 0.4) * 0.15 +
    chatReadability * 0.15

  // ── Generate suggestions ──
  if (robotVisibility < 0.4 && config.robotScale < 12) {
    suggestions.push({
      param: 'robotScale',
      oldValue: config.robotScale,
      newValue: Math.min(12, config.robotScale + 1),
      reason: 'Robot is hard to see — increasing scale',
    })
  }

  if (brightness < 0.2) {
    suggestions.push({
      param: 'ambientLight',
      oldValue: config.ambientLight,
      newValue: Math.min(0.8, config.ambientLight + 0.05),
      reason: 'Scene too dark — raising ambient light',
    })
    suggestions.push({
      param: 'skyBrightness',
      oldValue: config.skyBrightness,
      newValue: Math.min(0.8, config.skyBrightness + 0.05),
      reason: 'Scene too dark — raising sky brightness',
    })
  }

  if (brightness > 0.7) {
    suggestions.push({
      param: 'ambientLight',
      oldValue: config.ambientLight,
      newValue: Math.max(0.3, config.ambientLight - 0.05),
      reason: 'Scene too bright — reducing ambient light',
    })
  }

  if (chatReadability < 0.5 && chatMessageCount > 0) {
    suggestions.push({
      param: 'chatOpacity',
      oldValue: config.chatOpacity,
      newValue: Math.min(0.85, config.chatOpacity + 0.05),
      reason: 'Chat hard to read — increasing overlay opacity',
    })
  }

  if (colorVariety < 0.3) {
    suggestions.push({
      param: 'bloomIntensity',
      oldValue: config.bloomIntensity,
      newValue: Math.min(0.4, config.bloomIntensity + 0.05),
      reason: 'Flat colors — adding bloom for color richness',
    })
  }

  if (skyToGroundRatio > 0.7) {
    suggestions.push({
      param: 'robotScreenYPercent',
      oldValue: config.robotScreenYPercent,
      newValue: Math.max(0.4, config.robotScreenYPercent - 0.03),
      reason: 'Too much sky — moving robot up',
    })
  }

  if (skyToGroundRatio < 0.15) {
    suggestions.push({
      param: 'robotScreenYPercent',
      oldValue: config.robotScreenYPercent,
      newValue: Math.min(0.65, config.robotScreenYPercent + 0.03),
      reason: 'No sky visible — moving robot down',
    })
  }

  // Vignette too strong in dark scenes
  if (brightness < 0.25 && config.vignetteStrength > 0.3) {
    suggestions.push({
      param: 'vignetteStrength',
      oldValue: config.vignetteStrength,
      newValue: Math.max(0.1, config.vignetteStrength - 0.05),
      reason: 'Dark scene with heavy vignette — reducing edge darkening',
    })
  }

  // Robot too big, consuming too much frame
  if (robotVisibility > 0.85 && config.robotScale > 9) {
    suggestions.push({
      param: 'robotScale',
      oldValue: config.robotScale,
      newValue: Math.max(8, config.robotScale - 1),
      reason: 'Robot dominates frame — slightly reducing scale',
    })
  }

  return {
    robotVisibility,
    brightnessBalance,
    colorVariety,
    skyToGroundRatio,
    chatReadability,
    overallScore,
    issues,
    suggestions,
  }
}

// ─── Method 2: LLM Deep Evaluation via Gemma 4 ──────────────────

export async function deepEvaluateWithLLM(
  analysis: FrameAnalysis,
  config: StreamConfig,
  recentChatRate: number,
  mood: string,
): Promise<LLMEvaluation> {
  const prompt = `You are evaluating a livestream's visual quality. The stream shows a pixel art robot in a 2D tile world.

Current state:
- Robot scale: ${config.robotScale} (visibility score: ${(analysis.robotVisibility * 100).toFixed(0)}%)
- Robot Y position: ${(config.robotScreenYPercent * 100).toFixed(0)}% down the screen
- Sky brightness: ${config.skyBrightness.toFixed(2)}
- Ambient light: ${config.ambientLight.toFixed(2)}
- Chat overlay opacity: ${config.chatOpacity.toFixed(2)}
- Frame brightness: ${analysis.brightnessBalance.toFixed(2)}
- Color variety: ${(analysis.colorVariety * 100).toFixed(0)}% (${analysis.colorVariety < 0.3 ? 'low' : analysis.colorVariety > 0.7 ? 'high' : 'medium'})
- Sky-to-ground ratio: ${(analysis.skyToGroundRatio * 100).toFixed(0)}%
- Chat readability: ${(analysis.chatReadability * 100).toFixed(0)}%
- Chat rate: ${recentChatRate.toFixed(1)} messages/minute
- Mood: ${mood}
- Bloom intensity: ${config.bloomIntensity.toFixed(2)}
- Vignette: ${config.vignetteStrength.toFixed(2)}
- Particle density: ${config.particleDensity.toFixed(2)}
- Current issues: ${analysis.issues.length > 0 ? analysis.issues.join(', ') : 'none detected'}
- Overall score: ${(analysis.overallScore * 100).toFixed(0)}%

Rate each aspect 1-10 and suggest ONE specific parameter change to improve the stream.
Valid parameters: robotScale (8-12), robotScreenYPercent (0.4-0.7), headerOpacity (0.5-0.9), chatOpacity (0.4-0.85), skyBrightness (0.3-0.8), ambientLight (0.3-0.8), bloomIntensity (0.0-0.4), vignetteStrength (0.1-0.5), particleDensity (0.5-2.0), speechBubbleWidth (400-700).

Respond ONLY with a JSON object:
{"robotVisibility":N,"colorBalance":N,"layoutClarity":N,"overallFeel":N,"param":"paramName","value":N,"reason":"one sentence"}`

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemma3',
        prompt,
        stream: false,
        options: { temperature: 0.3, num_predict: 200 },
      }),
    })

    if (!res.ok) {
      return fallbackLLMEval(analysis)
    }

    const body = await res.json() as { response?: string }
    const raw = body.response || ''

    // Extract JSON from response (may have markdown wrapping)
    const jsonMatch = raw.match(/\{[\s\S]*?\}/)
    if (!jsonMatch) return fallbackLLMEval(analysis, raw)

    const parsed = JSON.parse(jsonMatch[0]) as {
      robotVisibility?: number
      colorBalance?: number
      layoutClarity?: number
      overallFeel?: number
      param?: string
      value?: number
      reason?: string
    }

    const validParams: Array<keyof StreamConfig> = [
      'robotScale', 'robotScreenYPercent', 'headerOpacity', 'chatOpacity',
      'skyBrightness', 'ambientLight', 'bloomIntensity', 'vignetteStrength',
      'particleDensity', 'speechBubbleWidth', 'chatFadeSeconds', 'borderWidth',
    ]

    return {
      robotVisibility: clamp(parsed.robotVisibility ?? 5, 1, 10),
      colorBalance: clamp(parsed.colorBalance ?? 5, 1, 10),
      layoutClarity: clamp(parsed.layoutClarity ?? 5, 1, 10),
      overallFeel: clamp(parsed.overallFeel ?? 5, 1, 10),
      suggestedParam: parsed.param && validParams.includes(parsed.param as keyof StreamConfig)
        ? parsed.param as keyof StreamConfig
        : null,
      suggestedValue: typeof parsed.value === 'number' ? parsed.value : null,
      suggestedReason: parsed.reason || 'No reason given',
      raw,
    }
  } catch {
    return fallbackLLMEval(analysis)
  }
}

function fallbackLLMEval(analysis: FrameAnalysis, raw: string = 'Ollama unavailable'): LLMEvaluation {
  return {
    robotVisibility: Math.round(analysis.robotVisibility * 10),
    colorBalance: Math.round(analysis.colorVariety * 10),
    layoutClarity: Math.round((1 - Math.abs(analysis.skyToGroundRatio - 0.35)) * 10),
    overallFeel: Math.round(analysis.overallScore * 10),
    suggestedParam: analysis.suggestions[0]?.param ?? null,
    suggestedValue: analysis.suggestions[0]?.newValue ?? null,
    suggestedReason: analysis.suggestions[0]?.reason ?? 'Using rule-based fallback',
    raw,
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

// ─── Config Bounds (enforced on every adjustment) ────────────────

const CONFIG_BOUNDS: Record<keyof StreamConfig, [number, number]> = {
  robotScale: [8, 12],
  robotScreenYPercent: [0.4, 0.7],
  headerOpacity: [0.5, 0.9],
  chatOpacity: [0.4, 0.85],
  chatFadeSeconds: [5, 15],
  skyBrightness: [0.3, 0.8],
  ambientLight: [0.3, 0.8],
  borderWidth: [1, 4],
  speechBubbleWidth: [400, 700],
  particleDensity: [0.5, 2.0],
  bloomIntensity: [0.0, 0.5],
  vignetteStrength: [0.1, 0.5],
}

function clampConfig(config: StreamConfig): StreamConfig {
  const clamped = { ...config }
  for (const key of Object.keys(CONFIG_BOUNDS) as Array<keyof StreamConfig>) {
    const [min, max] = CONFIG_BOUNDS[key]
    clamped[key] = clamp(clamped[key], min, max)
  }
  return clamped
}

// ─── Apply Adjustments (max 10% change per eval) ────────────────

export function applyAdjustments(
  config: StreamConfig,
  analysis: FrameAnalysis,
): { newConfig: StreamConfig; changes: string[] } {
  const changes: string[] = []
  const newConfig = { ...config }

  // Only apply top 2 suggestions to avoid oscillation
  const sorted = [...analysis.suggestions].sort((a, b) => {
    // Prioritize by severity of the issue
    const severityA = Math.abs(a.newValue - a.oldValue)
    const severityB = Math.abs(b.newValue - b.oldValue)
    return severityB - severityA
  })

  const applied = new Set<keyof StreamConfig>()
  for (const suggestion of sorted.slice(0, 2)) {
    if (applied.has(suggestion.param)) continue
    applied.add(suggestion.param)

    const oldVal = newConfig[suggestion.param]
    // Limit change to 10% of the parameter's range
    const [min, max] = CONFIG_BOUNDS[suggestion.param]
    const range = max - min
    const maxDelta = range * 0.1
    const rawDelta = suggestion.newValue - oldVal
    const cappedDelta = Math.sign(rawDelta) * Math.min(Math.abs(rawDelta), maxDelta)
    const newVal = clamp(oldVal + cappedDelta, min, max)

    if (Math.abs(newVal - oldVal) > 0.001) {
      newConfig[suggestion.param] = newVal
      changes.push(`${suggestion.param}: ${oldVal.toFixed(2)} -> ${newVal.toFixed(2)} (${suggestion.reason})`)
    }
  }

  return { newConfig: clampConfig(newConfig), changes }
}

// ─── Apply LLM Suggestion ────────────────────────────────────────

export function applyLLMSuggestion(
  config: StreamConfig,
  llmEval: LLMEvaluation,
): { newConfig: StreamConfig; change: string | null } {
  if (!llmEval.suggestedParam || llmEval.suggestedValue === null) {
    return { newConfig: config, change: null }
  }

  const param = llmEval.suggestedParam
  const oldVal = config[param]
  const [min, max] = CONFIG_BOUNDS[param]
  const range = max - min
  const maxDelta = range * 0.15 // LLM gets slightly more latitude
  const targetVal = clamp(llmEval.suggestedValue, min, max)
  const rawDelta = targetVal - oldVal
  const cappedDelta = Math.sign(rawDelta) * Math.min(Math.abs(rawDelta), maxDelta)
  const newVal = clamp(oldVal + cappedDelta, min, max)

  if (Math.abs(newVal - oldVal) < 0.001) {
    return { newConfig: config, change: null }
  }

  const newConfig = { ...config, [param]: newVal }
  const change = `[LLM] ${param}: ${oldVal.toFixed(2)} -> ${newVal.toFixed(2)} — ${llmEval.suggestedReason}`
  return { newConfig: clampConfig(newConfig), change }
}

// ─── Method 3: Engagement-Based Learning ─────────────────────────

export function trackEngagement(evaluation: StreamEvaluation, chatRate: number): void {
  const score = evaluation.lastAnalysis?.overallScore ?? 0.5
  evaluation.configHistory.push({
    config: { ...evaluation.currentConfig },
    score,
    chatRate,
    timestamp: Date.now(),
  })

  // Keep only last 100 data points
  if (evaluation.configHistory.length > 100) {
    evaluation.configHistory = evaluation.configHistory.slice(-100)
  }

  // After 20+ data points, check if the last change helped
  if (evaluation.configHistory.length >= 20) {
    const recent = evaluation.configHistory.slice(-5)
    const older = evaluation.configHistory.slice(-15, -5)

    const recentAvgRate = recent.reduce((s, h) => s + h.chatRate, 0) / recent.length
    const olderAvgRate = older.reduce((s, h) => s + h.chatRate, 0) / older.length

    if (recentAvgRate < olderAvgRate * 0.7 && evaluation.adjustmentsMade.length > 0) {
      // Chat rate dropped significantly after recent changes — note it
      evaluation.issuesFound.push(`Chat rate dropped from ${olderAvgRate.toFixed(1)} to ${recentAvgRate.toFixed(1)}/min after recent adjustments`)
    }
  }
}

// ─── Main Evaluation Entry Point ─────────────────────────────────

export function evaluateFrame(
  imageData: { data: Uint8ClampedArray; width: number; height: number },
  evaluation: StreamEvaluation,
  width: number,
  height: number,
  robotX: number,
  robotY: number,
  robotScale: number,
  chatCount: number,
  mood: string,
  chatRate: number,
): { adjustments: StreamConfigAdjustment[]; announcement: string | null } {
  evaluation.lastEvalFrame = evaluation.totalEvaluations * evaluation.evalInterval // approximate frame
  evaluation.totalEvaluations++

  // Run rule-based analysis
  const analysis = analyzeFrame(imageData, evaluation.currentConfig, robotX, robotY, robotScale, chatCount, mood)
  evaluation.lastAnalysis = analysis

  // Track engagement
  trackEngagement(evaluation, chatRate)

  // Apply adjustments
  const { newConfig, changes } = applyAdjustments(evaluation.currentConfig, analysis)
  evaluation.currentConfig = newConfig

  // Record changes
  for (const c of changes) {
    evaluation.adjustmentsMade.push(`[${new Date().toLocaleTimeString()}] ${c}`)
  }
  // Keep last 50 adjustments
  if (evaluation.adjustmentsMade.length > 50) {
    evaluation.adjustmentsMade = evaluation.adjustmentsMade.slice(-50)
  }

  // Record issues
  for (const issue of analysis.issues) {
    if (!evaluation.issuesFound.includes(issue)) {
      evaluation.issuesFound.push(issue)
    }
  }
  if (evaluation.issuesFound.length > 30) {
    evaluation.issuesFound = evaluation.issuesFound.slice(-30)
  }

  // Generate announcement for the speech bubble
  let announcement: string | null = null
  if (changes.length > 0) {
    const phrases = buildAnnouncementPhrases(analysis, changes)
    if (phrases.length > 0) {
      announcement = phrases[0]
      evaluation.announcementQueue.push(...phrases.slice(1))
    }
  }

  return { adjustments: analysis.suggestions, announcement }
}

// ─── Deep Evaluation (async, called separately) ──────────────────

export async function runDeepEvaluation(
  evaluation: StreamEvaluation,
  chatRate: number,
  mood: string,
): Promise<{ change: string | null; announcement: string | null }> {
  if (!evaluation.lastAnalysis) {
    return { change: null, announcement: null }
  }

  evaluation.totalDeepEvaluations++
  const llmEval = await deepEvaluateWithLLM(evaluation.lastAnalysis, evaluation.currentConfig, chatRate, mood)
  evaluation.lastLLMEval = llmEval

  const { newConfig, change } = applyLLMSuggestion(evaluation.currentConfig, llmEval)
  evaluation.currentConfig = newConfig

  if (change) {
    evaluation.adjustmentsMade.push(`[${new Date().toLocaleTimeString()}] ${change}`)
  }

  let announcement: string | null = null
  if (change && llmEval.suggestedReason) {
    announcement = buildLLMAnnouncement(llmEval)
  }

  return { change, announcement }
}

// ─── Get Current Config ──────────────────────────────────────────

export function applyConfig(evaluation: StreamEvaluation): StreamConfig {
  return { ...evaluation.currentConfig }
}

// ─── Get Next Queued Announcement ────────────────────────────────

export function popAnnouncement(evaluation: StreamEvaluation): string | null {
  return evaluation.announcementQueue.shift() || null
}

// ─── Status String ───────────────────────────────────────────────

export function getEvalStatus(evaluation: StreamEvaluation): string {
  const a = evaluation.lastAnalysis
  const lines: string[] = [
    `=== Stream Self-Evaluation ===`,
    `Total evaluations: ${evaluation.totalEvaluations} rule-based, ${evaluation.totalDeepEvaluations} LLM`,
    ``,
  ]

  if (a) {
    lines.push(`Last Analysis:`)
    lines.push(`  Robot visibility: ${(a.robotVisibility * 100).toFixed(0)}%`)
    lines.push(`  Brightness balance: ${(a.brightnessBalance * 100).toFixed(0)}%`)
    lines.push(`  Color variety: ${(a.colorVariety * 100).toFixed(0)}%`)
    lines.push(`  Sky/ground ratio: ${(a.skyToGroundRatio * 100).toFixed(0)}%`)
    lines.push(`  Chat readability: ${(a.chatReadability * 100).toFixed(0)}%`)
    lines.push(`  Overall score: ${(a.overallScore * 100).toFixed(0)}%`)
    if (a.issues.length > 0) {
      lines.push(`  Issues: ${a.issues.join('; ')}`)
    }
  }

  const l = evaluation.lastLLMEval
  if (l) {
    lines.push(``)
    lines.push(`Last LLM Evaluation:`)
    lines.push(`  Robot visibility: ${l.robotVisibility}/10`)
    lines.push(`  Color balance: ${l.colorBalance}/10`)
    lines.push(`  Layout clarity: ${l.layoutClarity}/10`)
    lines.push(`  Overall feel: ${l.overallFeel}/10`)
    if (l.suggestedParam) {
      lines.push(`  Suggested: ${l.suggestedParam} = ${l.suggestedValue} — ${l.suggestedReason}`)
    }
  }

  lines.push(``)
  lines.push(`Current Config:`)
  const c = evaluation.currentConfig
  lines.push(`  Robot scale: ${c.robotScale}`)
  lines.push(`  Robot Y: ${(c.robotScreenYPercent * 100).toFixed(0)}%`)
  lines.push(`  Sky brightness: ${c.skyBrightness.toFixed(2)}`)
  lines.push(`  Ambient light: ${c.ambientLight.toFixed(2)}`)
  lines.push(`  Chat opacity: ${c.chatOpacity.toFixed(2)}`)
  lines.push(`  Bloom: ${c.bloomIntensity.toFixed(2)}`)
  lines.push(`  Vignette: ${c.vignetteStrength.toFixed(2)}`)
  lines.push(`  Particles: ${c.particleDensity.toFixed(2)}`)

  if (evaluation.adjustmentsMade.length > 0) {
    lines.push(``)
    lines.push(`Recent Adjustments (last 10):`)
    for (const adj of evaluation.adjustmentsMade.slice(-10)) {
      lines.push(`  ${adj}`)
    }
  }

  if (evaluation.configHistory.length > 0) {
    const recent = evaluation.configHistory.slice(-5)
    const avgScore = recent.reduce((s, h) => s + h.score, 0) / recent.length
    const avgRate = recent.reduce((s, h) => s + h.chatRate, 0) / recent.length
    lines.push(``)
    lines.push(`Engagement (last 5 evals):`)
    lines.push(`  Avg score: ${(avgScore * 100).toFixed(0)}%`)
    lines.push(`  Avg chat rate: ${avgRate.toFixed(1)} msg/min`)
  }

  return lines.join('\n')
}

// ─── Announcement Phrases ────────────────────────────────────────

function buildAnnouncementPhrases(analysis: FrameAnalysis, changes: string[]): string[] {
  const phrases: string[] = []

  // Match specific issues to natural-sounding self-reflection
  if (analysis.brightnessBalance < 0.4 && changes.some(c => c.includes('ambient') || c.includes('sky'))) {
    phrases.push('Hmm, I think I\'m a bit too dark. Let me brighten up.')
  }
  if (analysis.brightnessBalance > 0.8 && changes.some(c => c.includes('ambient'))) {
    phrases.push('Whoa, too bright! Dialing it back a little.')
  }
  if (analysis.robotVisibility < 0.3 && changes.some(c => c.includes('robotScale'))) {
    phrases.push('Can you even see me? Let me make myself bigger.')
  }
  if (analysis.robotVisibility > 0.85 && changes.some(c => c.includes('robotScale'))) {
    phrases.push('I\'m taking up too much space. Shrinking a tiny bit.')
  }
  if (analysis.chatReadability < 0.5 && changes.some(c => c.includes('chatOpacity'))) {
    phrases.push('The chat looks hard to read. Adjusting the overlay...')
  }
  if (analysis.colorVariety < 0.3 && changes.some(c => c.includes('bloom'))) {
    phrases.push('Things look a bit flat. Adding some visual pop.')
  }
  if (analysis.skyToGroundRatio > 0.7 && changes.some(c => c.includes('robotScreenY'))) {
    phrases.push('Too much sky! Moving up so you can see me better.')
  }
  if (analysis.skyToGroundRatio < 0.15 && changes.some(c => c.includes('robotScreenY'))) {
    phrases.push('Where did the sky go? Adjusting my position.')
  }

  // Generic fallback
  if (phrases.length === 0 && changes.length > 0) {
    const genericPhrases = [
      'Self-check complete. Made a small visual tweak.',
      'Analyzing my own stream... adjusted something.',
      'Quality check! Tweaking the visuals slightly.',
      'Running self-diagnostics. Small improvement applied.',
      'I looked at myself and thought: I can do better.',
    ]
    phrases.push(genericPhrases[Math.floor(Math.random() * genericPhrases.length)])
  }

  return phrases
}

function buildLLMAnnouncement(llmEval: LLMEvaluation): string {
  const overallAvg = (llmEval.robotVisibility + llmEval.colorBalance + llmEval.layoutClarity + llmEval.overallFeel) / 4

  if (overallAvg >= 8) {
    return `Deep analysis says I look great! (${overallAvg.toFixed(0)}/10) Still tweaking: ${llmEval.suggestedReason}`
  }
  if (overallAvg >= 6) {
    return `Self-review: ${overallAvg.toFixed(0)}/10. ${llmEval.suggestedReason}`
  }
  if (overallAvg >= 4) {
    return `Hmm, my AI says I could look better (${overallAvg.toFixed(0)}/10). Working on it...`
  }
  return `Yikes, scoring ${overallAvg.toFixed(0)}/10. Major adjustment incoming!`
}

// ─── Tool Registration ───────────────────────────────────────────

// Module-level evaluation state (shared with renderer when integrated)
let _evalState: StreamEvaluation | null = null

export function getEvalState(): StreamEvaluation {
  if (!_evalState) _evalState = initStreamEval()
  return _evalState
}

export function registerStreamSelfEvalTools(): void {
  registerTool({
    name: 'stream_eval',
    description: 'View the stream\'s self-evaluation status, current config, recent adjustments, and score history. The stream constantly analyzes its own rendered frames and auto-adjusts visual quality.',
    parameters: {},
    tier: 'free',
    execute: async () => {
      const evaluation = getEvalState()
      if (evaluation.totalEvaluations === 0) {
        return 'Stream self-evaluation has not run yet. It activates automatically when the stream is live — analyzing frames every 30 seconds and running LLM review every 5 minutes.'
      }
      return getEvalStatus(evaluation)
    },
  })

  registerTool({
    name: 'stream_eval_config',
    description: 'View or override the stream\'s current visual config. Shows all adjustable parameters with their current values and allowed ranges.',
    parameters: {
      param: { type: 'string', description: 'Parameter to adjust (e.g. robotScale, ambientLight). Omit to view all.', required: false },
      value: { type: 'number', description: 'New value to set. Must be within allowed range.', required: false },
    },
    tier: 'free',
    execute: async (args) => {
      const evaluation = getEvalState()
      const config = evaluation.currentConfig

      if (!args.param) {
        const lines = ['Current Stream Config:', '']
        for (const [key, [min, max]] of Object.entries(CONFIG_BOUNDS)) {
          const val = config[key as keyof StreamConfig]
          lines.push(`  ${key}: ${val.toFixed(2)}  (range: ${min}-${max})`)
        }
        lines.push('')
        lines.push(`Total evaluations: ${evaluation.totalEvaluations}`)
        lines.push(`Total adjustments: ${evaluation.adjustmentsMade.length}`)
        return lines.join('\n')
      }

      const param = args.param as keyof StreamConfig
      if (!(param in CONFIG_BOUNDS)) {
        return `Unknown parameter "${param}". Valid: ${Object.keys(CONFIG_BOUNDS).join(', ')}`
      }

      if (args.value !== undefined) {
        const [min, max] = CONFIG_BOUNDS[param]
        const val = clamp(Number(args.value), min, max)
        const oldVal = config[param]
        config[param] = val
        evaluation.adjustmentsMade.push(`[${new Date().toLocaleTimeString()}] Manual override: ${param}: ${oldVal.toFixed(2)} -> ${val.toFixed(2)}`)
        return `Set ${param}: ${oldVal.toFixed(2)} -> ${val.toFixed(2)} (range: ${min}-${max})`
      }

      const [min, max] = CONFIG_BOUNDS[param]
      return `${param}: ${config[param].toFixed(2)} (range: ${min}-${max})`
    },
  })

  registerTool({
    name: 'stream_eval_history',
    description: 'View the stream\'s config adjustment history and engagement correlation data.',
    parameters: {
      limit: { type: 'number', description: 'Number of recent entries to show (default: 20)', required: false },
    },
    tier: 'free',
    execute: async (args) => {
      const evaluation = getEvalState()
      const limit = Number(args.limit) || 20
      const lines: string[] = ['Stream Self-Eval History', '']

      if (evaluation.adjustmentsMade.length === 0) {
        lines.push('No adjustments made yet.')
      } else {
        lines.push(`Adjustments (last ${Math.min(limit, evaluation.adjustmentsMade.length)}):`)
        for (const adj of evaluation.adjustmentsMade.slice(-limit)) {
          lines.push(`  ${adj}`)
        }
      }

      if (evaluation.configHistory.length > 0) {
        lines.push('')
        lines.push(`Config/Engagement History (last ${Math.min(limit, evaluation.configHistory.length)} snapshots):`)
        for (const h of evaluation.configHistory.slice(-limit)) {
          const t = new Date(h.timestamp).toLocaleTimeString()
          lines.push(`  [${t}] score=${(h.score * 100).toFixed(0)}% chatRate=${h.chatRate.toFixed(1)}/min scale=${h.config.robotScale} ambient=${h.config.ambientLight.toFixed(2)}`)
        }
      }

      if (evaluation.issuesFound.length > 0) {
        lines.push('')
        lines.push('Issues detected:')
        for (const issue of evaluation.issuesFound.slice(-10)) {
          lines.push(`  - ${issue}`)
        }
      }

      return lines.join('\n')
    },
  })
}
