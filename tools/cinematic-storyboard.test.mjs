import { describe, expect, it } from 'vitest'
import { lintCinematicStoryboard, parseCinematicStoryboard } from './cinematic-storyboard.mjs'

const dynamicFrame = `
## Frame 1 — The fold

- visual_mode: cinematic
- action: The paper city folds inward and traps the red signal.
- camera: A slow crane dives through the collapsing rooftops.
- depth: Foreground fibers occlude the midground city while the background sky compresses.
- transformation: A wide city becomes a single sealed envelope.
- surprise: The envelope opens from inside.
- start_state: An intact city at night.
- end_state: One sealed envelope in daylight.
`

describe('cinematic storyboard parser', () => {
  it('preserves custom cinematic fields on each frame', () => {
    const [frame] = parseCinematicStoryboard(dynamicFrame)
    expect(frame.heading).toBe('1 — The fold')
    expect(frame.fields.visual_mode).toBe('cinematic')
    expect(frame.fields.camera).toContain('crane')
  })
})

describe('cinematic storyboard lint', () => {
  it('passes a physical, spatial, transforming shot', () => {
    const result = lintCinematicStoryboard(dynamicFrame)
    expect(result.ok).toBe(true)
    expect(result.findings).toEqual([])
  })

  it('rejects poster-only motion in a cinematic frame', () => {
    const result = lintCinematicStoryboard(`
## Frame 1 — Metric
- visual_mode: cinematic
- action: A number counts up and labels fade in.
- camera: Static.
- depth: Background grid and foreground number.
- transformation: The number becomes larger.
- surprise: A rule appears.
`)
    expect(result.ok).toBe(false)
    expect(result.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      'poster-action',
      'weak-camera-verb',
      'shallow-depth-plan',
    ]))
  })

  it('enforces a dynamic majority across the film', () => {
    const graphic = (number) => `
## Frame ${number} — Poster
- visual_mode: graphic
- action: Type stamps onto the sheet.
- camera: Camera pushes toward the type.
- depth: Foreground type, midground rule, background paper.
- transformation: Blank paper becomes a printed claim.
- surprise: The final word is physically misregistered.
`
    const result = lintCinematicStoryboard(`${dynamicFrame}${graphic(2)}${graphic(3)}`)
    expect(result.ok).toBe(false)
    expect(result.findings.some((finding) => finding.code === 'poster-sequence-ratio')).toBe(true)
  })
})
