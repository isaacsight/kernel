import { describe, expect, it } from 'vitest'
import { compileStoryboard, parseStoryboardGlobals, routeShot } from './shot-compiler.mjs'
import { parseCinematicStoryboard } from './cinematic-storyboard.mjs'
import fs from 'node:fs'
import path from 'node:path'

const example = fs.readFileSync(path.resolve('docs/video/STORYBOARD.cinematic.example.md'), 'utf8')

describe('shot compiler', () => {
  it('parses film-wide continuity memory', () => {
    const globals = parseStoryboardGlobals(`---\nvisual_world: Paper noir city\ncontinuity_subject: Red animal\n---`)
    expect(globals.visual_world).toBe('Paper noir city')
    expect(globals.continuity_subject).toBe('Red animal')
  })

  it('routes quiet and graphic work to deterministic finishing', () => {
    const frames = parseCinematicStoryboard(example)
    expect(routeShot(frames[2]).renderer).toBe('hyperframes')
  })

  it('routes compound cinematic motion to the motion-control model', () => {
    const frames = parseCinematicStoryboard(example)
    expect(routeShot(frames[3]).modelId).toBe('kling-pro')
  })

  it('compiles prompts, locks, candidates, costs, and review policy', () => {
    const plan = compileStoryboard(example, { candidates: 3 })
    expect(plan.totals.shots).toBe(4)
    expect(plan.totals.generatedShots).toBe(3)
    expect(plan.totals.candidates).toBe(9)
    expect(plan.policy.paidGenerationRequiresApproval).toBe(true)
    expect(plan.shots[0].inputs.keyframePrompt).toContain('Depth staging')
    expect(plan.shots[0].candidates).toHaveLength(3)
    expect(plan.shots[0].review.rubric.reduce((sum, item) => sum + item.weight, 0)).toBe(100)
    expect(plan.totals.estimatedUsd).toBeGreaterThan(0)
  })

  it('refuses to compile a storyboard that fails the cinematic gate', () => {
    expect(() => compileStoryboard('## Frame 1 — Empty\n- visual_mode: graphic')).toThrow('Storyboard failed the cinematic gate.')
  })
})
