import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { estimateUsd, getModel } from './video-models.mjs'
import { lintCinematicStoryboard, parseCinematicStoryboard } from './cinematic-storyboard.mjs'

const DEFAULT_NEGATIVE = [
  'unmotivated camera shake',
  'rubber geometry',
  'identity drift',
  'extra limbs or objects',
  'morphing typography',
  'illegible text',
  'generic AI glow',
  'unrequested scene cuts',
].join(', ')

const CAMERA_COMPLEXITY = /\b(arc(?:s|ing)?|crane(?:s|d|ing)?|div(?:e|es|ed|ing)|doll(?:y|ies|ied|ying)|orbit(?:s|ed|ing)?|pull(?:s|ed|ing)?|push(?:es|ed|ing)?|rack(?:s|ed|ing)? focus|track(?:s|ed|ing)?|truck(?:s|ed|ing)?|whip(?:s|ped|ping)?)\b/gi
const DIALOGUE = /\b(say|says|speak|speaks|dialogue|voice|lip[- ]?sync)\b/i
const HIGH_ACTION = /\b(chase|collide|crash|explode|fall|flood|fracture|race|rip|shatter|tear)\b/i

export const REVIEW_RUBRIC = Object.freeze([
  { id: 'identity', weight: 20, question: 'Are subject identity, wardrobe, geometry, and material stable?' },
  { id: 'action', weight: 20, question: 'Is the physical event legible and completed?' },
  { id: 'camera', weight: 15, question: 'Does the camera path feel intentional and spatially coherent?' },
  { id: 'transformation', weight: 15, question: 'Does the ending image materially differ from the opening image?' },
  { id: 'composition', weight: 10, question: 'Is there one clear focal hierarchy at every sampled moment?' },
  { id: 'continuity', weight: 10, question: 'Does the shot cut cleanly from its neighbors?' },
  { id: 'integrity', weight: 10, question: 'Is the image free of warping, duplicate objects, and text corruption?' },
])

export const HARD_REJECTS = Object.freeze([
  'subject identity changes',
  'the action never completes',
  'the camera contradicts the requested direction',
  'new unrequested subjects or objects appear',
  'load-bearing text is malformed',
  'the final frame cannot connect to the next shot',
])

function clean(value = '') {
  return value.trim().replace(/^['"]|['"]$/g, '')
}

export function parseStoryboardGlobals(markdown) {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!match) return {}
  const globals = {}
  for (const line of match[1].split('\n')) {
    const field = line.match(/^([a-z][a-z0-9_-]*):\s*(.*?)\s*$/i)
    if (field) globals[field[1].toLowerCase()] = clean(field[2])
  }
  return globals
}

function durationSeconds(value) {
  const match = String(value || '').match(/\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : 5
}

function cameraComplexity(camera = '') {
  return new Set([...camera.matchAll(CAMERA_COMPLEXITY)].map((match) => match[0].toLowerCase())).size
}

export function routeShot(frame) {
  const mode = frame.fields.visual_mode?.toLowerCase()
  const combined = `${frame.fields.action || ''} ${frame.fields.camera || ''} ${frame.fields.scene || ''}`

  if (mode === 'graphic' || mode === 'quiet') {
    return { renderer: 'hyperframes', modelId: null, reason: `${mode} shots need exact, deterministic editorial control.` }
  }
  if (DIALOGUE.test(combined)) {
    return { renderer: 'generated-video', modelId: 'veo-3-fast', reason: 'Dialogue or voice action benefits from a model with native audiovisual generation.' }
  }
  if (HIGH_ACTION.test(combined) || cameraComplexity(frame.fields.camera) >= 2) {
    return { renderer: 'generated-video', modelId: 'kling-pro', reason: 'Complex physical action or compound camera choreography needs the motion-control route.' }
  }
  return { renderer: 'generated-video', modelId: 'seedance-lite', reason: 'Controlled image-to-video is the economical continuity-first default.' }
}

function continuityLocks(globals, frame) {
  return {
    subject: frame.fields.subject_lock || globals.continuity_subject || 'Preserve the approved keyframe subject exactly.',
    location: frame.fields.location_lock || globals.continuity_location || 'Preserve the established world and spatial logic.',
    palette: frame.fields.palette_lock || globals.palette || 'Preserve the approved production palette.',
    material: frame.fields.material_lock || globals.material || 'Preserve material texture and surface behavior.',
    optics: frame.fields.lens || globals.lens_family || 'Use one coherent lens family across adjacent shots.',
  }
}

function keyframePrompt(frame, globals, locks) {
  const world = globals.visual_world ? `${globals.visual_world}. ` : ''
  return [
    world,
    `Opening composition: ${frame.fields.start_state || frame.fields.scene}.`,
    `Depth staging: ${frame.fields.depth}.`,
    `Continuity: ${locks.subject} ${locks.location} ${locks.palette} ${locks.material}`,
    'Create a production keyframe, not a poster. No captions or interface chrome.',
  ].join(' ').replace(/\s+/g, ' ').trim()
}

function motionPrompt(frame, locks) {
  return [
    `Subject action: ${frame.fields.action}.`,
    `Camera: ${frame.fields.camera}.`,
    `Transformation: ${frame.fields.transformation}.`,
    `Visible turn: ${frame.fields.surprise}.`,
    `Final composition: ${frame.fields.end_state || frame.fields.transformation}.`,
    `Keep fixed: ${locks.subject} ${locks.location} ${locks.material}`,
    'One continuous event. Preserve crisp geometry. Finish in a stable, editable final pose.',
  ].join(' ').replace(/\s+/g, ' ').trim()
}

function candidateVariants(frame, basePrompt, count) {
  const variants = [
    { id: 'faithful', direction: 'Prioritize exact action completion and continuity. Use restrained motion.' },
    { id: 'spatial', direction: `Prioritize foreground occlusion, parallax, and the requested camera path: ${frame.fields.camera}.` },
    { id: 'transform', direction: `Prioritize the irreversible visual transformation and hold the final state: ${frame.fields.transformation}.` },
    { id: 'wildcard', direction: `Preserve every continuity lock, but make this visible surprise unusually bold: ${frame.fields.surprise}.` },
  ]
  return variants.slice(0, count).map((variant, index) => ({
    ...variant,
    index,
    prompt: `${basePrompt} Candidate direction: ${variant.direction}`,
  }))
}

export function compileStoryboard(markdown, options = {}) {
  const lint = lintCinematicStoryboard(markdown)
  if (!lint.ok && !options.allowInvalid) {
    const error = new Error('Storyboard failed the cinematic gate.')
    error.findings = lint.findings
    throw error
  }

  const globals = parseStoryboardGlobals(markdown)
  const frames = parseCinematicStoryboard(markdown)
  const candidateCount = Math.max(1, Math.min(Number(options.candidates || globals.candidates || 4), 4))
  const shots = frames.map((frame) => {
    const route = routeShot(frame)
    const locks = continuityLocks(globals, frame)
    const seconds = durationSeconds(frame.fields.duration)
    const prompt = route.renderer === 'generated-video' ? motionPrompt(frame, locks) : null
    const model = route.modelId ? getModel(route.modelId) : null
    const candidates = route.renderer === 'generated-video' ? candidateVariants(frame, prompt, candidateCount) : []
    const costPerCandidate = model ? estimateUsd(model.id, seconds) : 0

    return {
      shotId: `shot-${String(frame.index + 1).padStart(2, '0')}`,
      title: frame.heading,
      mode: frame.fields.visual_mode,
      durationSeconds: seconds,
      route: { ...route, modelLabel: model?.label || 'HyperFrames' },
      continuityLocks: locks,
      inputs: {
        startFrameRequired: route.renderer === 'generated-video',
        endFrameRecommended: route.renderer === 'generated-video' && Boolean(frame.fields.end_state),
        keyframePrompt: route.renderer === 'generated-video' ? keyframePrompt(frame, globals, locks) : null,
        negativePrompt: route.renderer === 'generated-video' ? DEFAULT_NEGATIVE : null,
      },
      candidates,
      review: { rubric: REVIEW_RUBRIC, hardRejects: HARD_REJECTS, passingScore: 82 },
      estimatedUsd: {
        perCandidate: costPerCandidate,
        batch: Math.round(costPerCandidate * candidates.length * 100) / 100,
      },
      handoff: route.renderer === 'hyperframes'
        ? 'Author as a deterministic HyperFrames composition.'
        : 'Approve the keyframe, generate candidates, reject hard failures, then hand the winner to HyperFrames for type and finishing.',
    }
  })

  const generatedShots = shots.filter((shot) => shot.route.renderer === 'generated-video')
  return {
    version: 1,
    source: globals.message || 'Untitled cinematic storyboard',
    globals: {
      format: globals.format || '1920x1080',
      visualWorld: globals.visual_world || null,
      rhythm: globals.rhythm || null,
      continuity: {
        subject: globals.continuity_subject || null,
        location: globals.continuity_location || null,
        palette: globals.palette || null,
        material: globals.material || null,
        lensFamily: globals.lens_family || null,
      },
    },
    policy: {
      candidateCount,
      paidGenerationRequiresApproval: true,
      keyframeApprovalRequired: true,
      selectionMethod: 'hard rejects first, then weighted rubric; highest score above 82 wins',
    },
    shots,
    totals: {
      shots: shots.length,
      generatedShots: generatedShots.length,
      hyperframesShots: shots.length - generatedShots.length,
      candidates: generatedShots.reduce((total, shot) => total + shot.candidates.length, 0),
      estimatedUsd: Math.round(generatedShots.reduce((total, shot) => total + shot.estimatedUsd.batch, 0) * 100) / 100,
    },
  }
}

function runCli() {
  const args = process.argv.slice(2)
  const input = args.find((arg) => !arg.startsWith('--'))
  const outputArg = args.find((arg) => arg.startsWith('--output='))
  const candidatesArg = args.find((arg) => arg.startsWith('--candidates='))
  if (!input) {
    console.error('Usage: node tools/shot-compiler.mjs <STORYBOARD.md> [--output=shot-plan.json] [--candidates=1..4]')
    process.exitCode = 2
    return
  }

  try {
    const plan = compileStoryboard(fs.readFileSync(input, 'utf8'), {
      candidates: candidatesArg?.split('=')[1],
    })
    const json = `${JSON.stringify(plan, null, 2)}\n`
    if (outputArg) {
      const output = path.resolve(outputArg.slice('--output='.length))
      fs.writeFileSync(output, json)
      console.log(`Compiled ${plan.totals.shots} shots and ${plan.totals.candidates} candidates to ${output}`)
      console.log(`Estimated generation batch: $${plan.totals.estimatedUsd.toFixed(2)} · approval still required`)
    } else {
      process.stdout.write(json)
    }
  } catch (error) {
    console.error(error.message)
    for (const finding of error.findings || []) console.error(`${finding.level.toUpperCase()} ${finding.code}: ${finding.message}`)
    process.exitCode = 1
  }
}

const cliPath = process.argv[1] ? path.resolve(process.argv[1]) : ''
if (cliPath === fileURLToPath(import.meta.url)) runCli()
