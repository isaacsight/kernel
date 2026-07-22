import fs from 'node:fs'
import path from 'node:path'

const REQUIRED_FIELDS = ['action', 'camera', 'depth', 'transformation', 'surprise']
const VISUAL_MODES = new Set(['cinematic', 'hybrid', 'graphic', 'quiet'])
const EMPTY_VALUES = new Set(['none', 'n/a', 'na', 'static', 'tbd', 'todo'])
const POSTER_ACTIONS = /\b(appear|assemble|count(?:s)? up|draw(?:s)?|fade(?:s)?|reveal(?:s)?|slide(?:s)? in|type(?:s)? on)\b/i
const PHYSICAL_ACTIONS = /\b(bend|bloom|break|burn|chase|collapse|collide|crack|crash|drip|explode|fall|flood|flow|fold|fracture|grow|melt|open|peel|pour|race|rip|roll|shatter|spill|split|tear|transform|unfurl)\b/i
const CAMERA_ACTIONS = /\b(arc|crane|dive|dolly|drift|fly|orbit|pan|pull|push|rack focus|roll|track|truck|whip|zoom)\b/i
const DEPTH_LAYERS = /\b(bg|background|foreground|fg|midground|mg|near|middle|far|occlud|parallax)\b/gi

function clean(value = '') {
  return value.trim().replace(/^['"]|['"]$/g, '')
}

export function parseCinematicStoryboard(markdown) {
  const frames = []
  const heading = /^#{2,3}\s+(?:Frame|Beat|Scene)\s+([^\n]+)$/gim
  const matches = [...markdown.matchAll(heading)]

  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index].index + matches[index][0].length
    const end = matches[index + 1]?.index ?? markdown.length
    const body = markdown.slice(start, end)
    const fields = {}
    for (const match of body.matchAll(/^\s*-\s+([a-z][a-z0-9_-]*):\s*(.+?)\s*$/gim)) {
      fields[match[1].toLowerCase()] = clean(match[2])
    }
    frames.push({
      index,
      heading: clean(matches[index][1]),
      fields,
    })
  }

  return frames
}

function isEmpty(value) {
  return !value || EMPTY_VALUES.has(value.toLowerCase())
}

function uniqueDepthLayers(value = '') {
  return new Set([...value.matchAll(DEPTH_LAYERS)].map((match) => {
    const token = match[0].toLowerCase()
    if (token === 'bg' || token === 'background' || token === 'far') return 'background'
    if (token === 'mg' || token === 'midground' || token === 'middle') return 'midground'
    return 'foreground'
  }))
}

export function lintCinematicStoryboard(markdown, options = {}) {
  const frames = parseCinematicStoryboard(markdown)
  const findings = []

  if (!frames.length) {
    return {
      ok: false,
      frames,
      findings: [{ level: 'error', code: 'no-frames', message: 'No storyboard frames found.' }],
      summary: { frames: 0, cinematic: 0, hybrid: 0, graphic: 0, quiet: 0 },
    }
  }

  for (const frame of frames) {
    const label = `Frame ${frame.heading}`
    for (const field of REQUIRED_FIELDS) {
      if (isEmpty(frame.fields[field])) {
        findings.push({ level: 'error', code: `missing-${field}`, frame: frame.index + 1, message: `${label} needs a concrete ${field}.` })
      }
    }

    const mode = frame.fields.visual_mode?.toLowerCase()
    if (!VISUAL_MODES.has(mode)) {
      findings.push({ level: 'error', code: 'invalid-visual-mode', frame: frame.index + 1, message: `${label} needs visual_mode: cinematic, hybrid, graphic, or quiet.` })
    }

    if (!isEmpty(frame.fields.camera) && !CAMERA_ACTIONS.test(frame.fields.camera)) {
      findings.push({ level: 'warning', code: 'weak-camera-verb', frame: frame.index + 1, message: `${label} camera direction does not name an observable camera action.` })
    }

    if (!isEmpty(frame.fields.depth) && uniqueDepthLayers(frame.fields.depth).size < 3) {
      findings.push({ level: 'warning', code: 'shallow-depth-plan', frame: frame.index + 1, message: `${label} should name foreground, midground, and background behavior.` })
    }

    if ((mode === 'cinematic' || mode === 'hybrid') && !isEmpty(frame.fields.action)) {
      if (POSTER_ACTIONS.test(frame.fields.action) && !PHYSICAL_ACTIONS.test(frame.fields.action)) {
        findings.push({ level: 'error', code: 'poster-action', frame: frame.index + 1, message: `${label} uses only layout/reveal motion; add a physical event with consequences.` })
      }
    }

    if (frame.fields.end_state && frame.fields.end_state === frame.fields.start_state) {
      findings.push({ level: 'error', code: 'unchanged-state', frame: frame.index + 1, message: `${label} starts and ends in the same state.` })
    }
  }

  const summary = { frames: frames.length, cinematic: 0, hybrid: 0, graphic: 0, quiet: 0 }
  for (const frame of frames) {
    const mode = frame.fields.visual_mode?.toLowerCase()
    if (mode in summary) summary[mode] += 1
  }

  const dynamicCount = summary.cinematic + summary.hybrid
  const minimumDynamicRatio = options.minimumDynamicRatio ?? 0.5
  if (dynamicCount / frames.length < minimumDynamicRatio) {
    findings.push({
      level: 'error',
      code: 'poster-sequence-ratio',
      message: `Only ${dynamicCount}/${frames.length} frames are cinematic or hybrid; require at least ${Math.ceil(frames.length * minimumDynamicRatio)}.`,
    })
  }

  const quietLimit = Math.max(1, Math.floor(frames.length * 0.2))
  if (summary.quiet > quietLimit) {
    findings.push({ level: 'warning', code: 'too-many-quiet-holds', message: `${summary.quiet}/${frames.length} frames are quiet holds; the target ceiling is ${quietLimit}.` })
  }

  return {
    ok: !findings.some((finding) => finding.level === 'error'),
    frames,
    findings,
    summary,
  }
}

export function formatReport(result, file = 'STORYBOARD.md') {
  const lines = [`Cinematic storyboard: ${file}`, `Frames: ${result.summary.frames} · cinematic ${result.summary.cinematic} · hybrid ${result.summary.hybrid} · graphic ${result.summary.graphic} · quiet ${result.summary.quiet}`]
  for (const finding of result.findings) {
    lines.push(`${finding.level.toUpperCase()} ${finding.code}${finding.frame ? ` [frame ${finding.frame}]` : ''}: ${finding.message}`)
  }
  lines.push(result.ok ? 'PASS: the storyboard clears the cinematic gate.' : 'FAIL: the storyboard is still behaving like an animated poster sequence.')
  return lines.join('\n')
}

function runCli() {
  const args = process.argv.slice(2)
  const json = args.includes('--json')
  const files = args.filter((arg) => !arg.startsWith('--'))
  if (!files.length) {
    console.error('Usage: node tools/cinematic-storyboard.mjs <STORYBOARD.md> [more files] [--json]')
    process.exitCode = 2
    return
  }

  const reports = files.map((file) => {
    const markdown = fs.readFileSync(file, 'utf8')
    return { file: path.resolve(file), ...lintCinematicStoryboard(markdown) }
  })
  if (json) console.log(JSON.stringify(reports, null, 2))
  else console.log(reports.map((report) => formatReport(report, report.file)).join('\n\n'))
  if (reports.some((report) => !report.ok)) process.exitCode = 1
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  runCli()
}
