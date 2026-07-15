import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { PlateBlock, PlateSpread, IssueRecord } from '../content/issues'
import { resolveAccentHex } from '../content/issues/accents'
import { PopShape } from './ornaments'
import './PlateFeature.css'
import './IssueAccent.css'

interface PlateFeatureProps {
  spread: PlateSpread
  issue: IssueRecord
}

/**
 * PlateFeature — the WORKING MODEL. The tenth interaction shape
 * (ISSUE 419): an operable miniature of an external system, framed
 * as a plate. Blocks carry models, wires carry intent; the reader
 * pulls the proof and the model's signal walks the wires.
 *
 * ARIA patterns (rule 5): the run control and every proof frame
 * are plain BUTTONS — the most established pattern there is. Block
 * arrangement is NOT a control (no reading depends on where a
 * block sits — it is the canvas's material); it is still reachable
 * by every door: each block is focusable, carries an
 * aria-roledescription, and moves by arrow key as well as pointer.
 *
 * Rule 3, as amended by 419 (the working-model exception): script
 * moves the model's own signal INSIDE the plate frame only. Every
 * animation step advances via tick() — a frame callback raced
 * against a timer — so throttled or background tabs can never
 * stall the model (rAF alone provably stalls in embedded panes).
 * Reduced-motion collapses the pulse to instant state. Everything
 * outside the frame is CSS-only at weather amplitude; the video
 * frame's script-driven sway stays ≤4px, inside the weather budget.
 *
 * Rule 4, as amended by 419 (the seed is the state's address):
 * every proof is drawn deterministically from the seed printed on
 * its corner. At rest the plate holds a completed pull seeded from
 * the issue number — untouched, the page is complete and identical
 * on every copy. Print renders the current proofs with their seeds.
 *
 * Rule 6 (doubled): `plateNote` is mandatory — the plate is a
 * simulation drawn in-house, nothing generated; the ledger counts
 * only the reader's pulls and redraws, session-only, unrecorded.
 */

type Phase = 'rest' | 'pulling'

interface ProofState {
  seed: number
  model?: string
  /** True while this frame is waiting on an inbound pulse. */
  rendering: boolean
}

/* Deterministic PRNG — the reproducibility contract of rule 4 as
 * amended: same seed, same proof, on every copy of the issue. */
function mulberry32(a: number) {
  let t0 = a | 0
  return function () {
    t0 = (t0 + 0x6d2b79f5) | 0
    let t = Math.imul(t0 ^ (t0 >>> 15), 1 | t0)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Initial seed for block #idx — derived from the issue number so
 *  the standing proof is identical on every copy. */
function standingSeed(issueNumber: string, idx: number): number {
  return ((parseInt(issueNumber, 10) * 7919 + idx * 104729) % 99989) + 1
}

function modelFor(block: PlateBlock, seed: number): string | undefined {
  if (!block.models || block.models.length === 0) return undefined
  return block.models[seed % block.models.length]
}

/** One animation step that cannot stall: a frame callback raced
 *  against a timer, whichever fires first wins (rule-3 amendment —
 *  timer-robustness is a constraint of the working-model exception). */
function tick(fn: (now: number) => void) {
  let fired = false
  const fire = () => {
    if (fired) return
    fired = true
    fn(performance.now())
  }
  requestAnimationFrame(fire)
  window.setTimeout(fire, 42)
}

/** The engraving: a seeded botanical plate, drawn in-house.
 *  Deterministic from (seed, colors); `sway` adds the video
 *  frame's ≤4px script-driven weather. */
function drawProof(
  canvas: HTMLCanvasElement,
  seed: number,
  ink: string,
  accent: string,
  faint: string,
  sway?: number,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  const rnd = mulberry32(seed)
  ctx.clearRect(0, 0, w, h)

  ctx.strokeStyle = faint
  ctx.lineWidth = 0.5
  for (let gx = 32.5; gx < w; gx += 32) {
    ctx.beginPath()
    ctx.moveTo(gx, 0)
    ctx.lineTo(gx, h)
    ctx.stroke()
  }

  const stems = 3 + Math.floor(rnd() * 3)
  for (let i = 0; i < stems; i++) {
    const baseX = w * (0.14 + ((i + rnd() * 0.8) / stems) * 0.72)
    const lean = (rnd() - 0.5) * w * 0.3
    const drift = sway ? Math.sin(sway / 900 + i * 1.7) * 3.5 : 0
    const topX = baseX + lean + drift
    const topY = h * (0.08 + rnd() * 0.18)
    const midX = baseX + lean * 0.3 + drift * 0.4
    const midY = h * 0.55

    ctx.strokeStyle = ink
    ctx.lineWidth = 1.1
    ctx.beginPath()
    ctx.moveTo(baseX, h - 6)
    ctx.quadraticCurveTo(midX, midY, topX, topY)
    ctx.stroke()

    const leaves = 2 + Math.floor(rnd() * 3)
    for (let l = 0; l < leaves; l++) {
      const lt = 0.3 + rnd() * 0.5
      const lx = baseX + (topX - baseX) * lt
      const ly = h - 6 + (topY - (h - 6)) * lt
      const dir = rnd() > 0.5 ? 1 : -1
      const len = 12 + rnd() * 18
      ctx.beginPath()
      ctx.moveTo(lx, ly)
      ctx.quadraticCurveTo(lx + dir * len, ly - len * 0.35, lx + dir * len * 1.25, ly + 3)
      ctx.quadraticCurveTo(lx + dir * len * 0.5, ly + len * 0.3, lx, ly)
      ctx.stroke()
    }

    /* The first stem always blossoms in the issue accent — the
     * one-spot-colour discipline decides WHETHER, the seed only
     * decides WHERE. */
    if (i === 0 || rnd() > 0.62) {
      const petals = 5 + Math.floor(rnd() * 3)
      const r = 6 + rnd() * 7
      ctx.fillStyle = accent
      for (let p = 0; p < petals; p++) {
        const ang = (Math.PI * 2 * p) / petals
        ctx.beginPath()
        ctx.ellipse(
          topX + Math.cos(ang) * r,
          topY + Math.sin(ang) * r,
          r * 0.62,
          r * 0.36,
          ang,
          0,
          Math.PI * 2,
        )
        ctx.fill()
      }
      ctx.fillStyle = ink
      ctx.beginPath()
      ctx.arc(topX, topY, 2.4, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.fillStyle = ink
      ctx.beginPath()
      ctx.arc(topX, topY, 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.fillStyle = ink
  ctx.globalAlpha = 0.55
  ctx.font = '9px "Courier Prime", Courier, monospace'
  ctx.fillText(`No.${String(seed % 1000).padStart(3, '0')}`, w - 44, h - 8)
  ctx.globalAlpha = 1
}

export function PlateFeature({ spread, issue }: PlateFeatureProps) {
  const stockClass = `pop-stock-${spread.stock ?? 'ivory'}`
  const accentHex = resolveAccentHex(issue.accent, spread.type)
  const accentStyle = { '--issue-accent-base': accentHex } as CSSProperties

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const outputBlocks = spread.blocks.filter((b) => b.kind !== 'text')

  /* Positions as percent of the stage; arrangement is material,
   * not a control — nothing reads from it. */
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() =>
    Object.fromEntries(spread.blocks.map((b) => [b.id, { x: b.x, y: b.y }])),
  )

  /* The standing proof: seeds from the issue number (rule 1 +
   * amended rule 4 — untouched, every copy shows the same pull). */
  const [proofs, setProofs] = useState<Record<string, ProofState>>(() =>
    Object.fromEntries(
      spread.blocks.map((b, idx) => {
        const seed = standingSeed(issue.number, idx)
        return [b.id, { seed, model: modelFor(b, seed), rendering: false }]
      }),
    ),
  )

  const [phase, setPhase] = useState<Phase>('rest')
  const [pulls, setPulls] = useState(0)
  const [redraws, setRedraws] = useState(0)
  const [modelsDrawn, setModelsDrawn] = useState<Set<string>>(() => {
    const s = new Set<string>()
    spread.blocks.forEach((b, idx) => {
      const m = modelFor(b, standingSeed(issue.number, idx))
      if (m) s.add(m)
    })
    return s
  })

  const stageRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({})
  const wireRefs = useRef<Record<number, SVGPathElement | null>>({})
  const [wirePaths, setWirePaths] = useState<string[]>(() => spread.wires.map(() => ''))
  const [litWires, setLitWires] = useState<Set<number>>(new Set())

  const tokens = useCallback(() => {
    const stage = stageRef.current
    const cs = stage ? getComputedStyle(stage) : null
    return {
      ink: cs?.getPropertyValue('--pop-ink').trim() || '#1f1e1d',
      faint: cs?.getPropertyValue('--pop-hairline-soft').trim() || '#d8d2c6',
      accent: accentHex,
    }
  }, [accentHex])

  /* ── wires follow the blocks ── */
  const layoutWires = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const next = spread.wires.map((wire) => {
      const from = blockRefs.current[wire.from]
      const to = blockRefs.current[wire.to]
      if (!from || !to) return ''
      const ax = from.offsetLeft + from.offsetWidth
      const ay = from.offsetTop + from.offsetHeight / 2
      const bx = to.offsetLeft
      const by = to.offsetTop + to.offsetHeight / 2
      const dx = Math.max(36, (bx - ax) * 0.5)
      return `M${ax},${ay} C${ax + dx},${ay} ${bx - dx},${by} ${bx},${by}`
    })
    setWirePaths(next)
  }, [spread.wires])

  useLayoutEffect(() => {
    layoutWires()
  }, [layoutWires, positions])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => layoutWires())
    ro.observe(stage)
    return () => ro.disconnect()
  }, [layoutWires])

  /* ── draw every proof whenever its seed (or the color scheme)
   *    changes ── */
  const paintAll = useCallback(() => {
    const c = tokens()
    outputBlocks.forEach((b) => {
      const canvas = canvasRefs.current[b.id]
      const proof = proofs[b.id]
      if (canvas && proof) drawProof(canvas, proof.seed, c.ink, c.accent, c.faint)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proofs, tokens])

  useEffect(() => {
    paintAll()
  }, [paintAll])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => paintAll()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [paintAll])

  /* ── the video frame's sway: script-driven weather, ≤4px,
   *    timer-based, off under reduced motion ── */
  useEffect(() => {
    if (reducedMotion) return
    const id = window.setInterval(() => {
      const c = tokens()
      outputBlocks.forEach((b) => {
        if (b.kind !== 'video') return
        const canvas = canvasRefs.current[b.id]
        const proof = proofs[b.id]
        if (canvas && proof && !proof.rendering) {
          drawProof(canvas, proof.seed, c.ink, c.accent, c.faint, performance.now())
        }
      })
    }, 90)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proofs, reducedMotion, tokens])

  /* ── block movement: pointer drag + arrow keys ── */
  const dragState = useRef<{ id: string; px: number; py: number; x: number; y: number } | null>(null)

  const onBlockPointerDown = (id: string) => (ev: ReactPointerEvent<HTMLDivElement>) => {
    if ((ev.target as HTMLElement).closest('button')) return
    const el = blockRefs.current[id]
    if (!el) return
    dragState.current = { id, px: ev.clientX, py: ev.clientY, x: el.offsetLeft, y: el.offsetTop }
    el.setPointerCapture(ev.pointerId)
  }

  const onBlockPointerMove = (id: string) => (ev: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragState.current
    const stage = stageRef.current
    const el = blockRefs.current[id]
    if (!drag || drag.id !== id || !stage || !el) return
    const nx = Math.max(0, Math.min(stage.clientWidth - el.offsetWidth, drag.x + (ev.clientX - drag.px)))
    const ny = Math.max(0, Math.min(stage.clientHeight - el.offsetHeight, drag.y + (ev.clientY - drag.py)))
    setPositions((prev) => ({
      ...prev,
      [id]: { x: (nx / stage.clientWidth) * 100, y: (ny / stage.clientHeight) * 100 },
    }))
  }

  const onBlockPointerUp = () => {
    dragState.current = null
  }

  const onBlockKeyDown = (id: string) => (ev: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = 2
    let dx = 0
    let dy = 0
    if (ev.key === 'ArrowLeft') dx = -step
    else if (ev.key === 'ArrowRight') dx = step
    else if (ev.key === 'ArrowUp') dy = -step
    else if (ev.key === 'ArrowDown') dy = step
    else return
    ev.preventDefault()
    setPositions((prev) => {
      const p = prev[id]
      return {
        ...prev,
        [id]: {
          x: Math.max(0, Math.min(92, p.x + dx)),
          y: Math.max(0, Math.min(88, p.y + dy)),
        },
      }
    })
  }

  /* ── the pulse: the model's signal, timer-robust ── */
  const pulse = useCallback(
    (wireIndex: number, done: () => void) => {
      if (reducedMotion) {
        done()
        return
      }
      const path = wireRefs.current[wireIndex]
      const svg = svgRef.current
      if (!path || !svg) {
        done()
        return
      }
      const len = path.getTotalLength()
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      dot.setAttribute('class', 'pop-plate-pulse')
      dot.setAttribute('r', '4')
      svg.appendChild(dot)
      setLitWires((prev) => new Set(prev).add(wireIndex))
      const t0 = performance.now()
      const DUR = 620
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / DUR)
        const pt = path.getPointAtLength(len * k)
        dot.setAttribute('cx', String(pt.x))
        dot.setAttribute('cy', String(pt.y))
        if (k < 1) {
          tick(step)
        } else {
          svg.removeChild(dot)
          window.setTimeout(() => {
            setLitWires((prev) => {
              const next = new Set(prev)
              next.delete(wireIndex)
              return next
            })
          }, 320)
          done()
        }
      }
      tick(step)
    },
    [reducedMotion],
  )

  const reseed = useCallback(
    (blockId: string, after?: () => void) => {
      const block = spread.blocks.find((b) => b.id === blockId)
      if (!block) return
      const seed = 1 + Math.floor(Math.random() * 99999)
      const model = modelFor(block, seed)
      setProofs((prev) => ({ ...prev, [blockId]: { seed, model, rendering: true } }))
      window.setTimeout(
        () => {
          setProofs((prev) => ({ ...prev, [blockId]: { ...prev[blockId], rendering: false } }))
          if (model) setModelsDrawn((prev) => new Set(prev).add(model))
          after?.()
        },
        reducedMotion ? 40 : 480,
      )
    },
    [reducedMotion, spread.blocks],
  )

  const pull = () => {
    if (phase !== 'rest') return
    setPhase('pulling')
    /* Stage 1: text → images; stage 2: images → video. Wire order
     * in the spread data is stage 1 first (from the text block). */
    const textId = spread.blocks.find((b) => b.kind === 'text')?.id
    const stageOne = spread.wires
      .map((w, i) => ({ w, i }))
      .filter(({ w }) => w.from === textId)
    const stageTwo = spread.wires
      .map((w, i) => ({ w, i }))
      .filter(({ w }) => w.from !== textId)

    let stageOnePending = stageOne.length
    const advance = () => {
      stageOnePending -= 1
      if (stageOnePending > 0) return
      let stageTwoPending = stageTwo.length
      const targets = new Set(stageTwo.map(({ w }) => w.to))
      stageTwo.forEach(({ i }) =>
        pulse(i, () => {
          stageTwoPending -= 1
          if (stageTwoPending > 0) return
          let renders = targets.size
          targets.forEach((id) =>
            reseed(id, () => {
              renders -= 1
              if (renders > 0) return
              setPulls((n) => n + 1)
              setPhase('rest')
            }),
          )
        }),
      )
    }
    stageOne.forEach(({ w, i }) => pulse(i, () => reseed(w.to, advance)))
  }

  const redrawOne = (blockId: string) => {
    if (phase !== 'rest') return
    setRedraws((n) => n + 1)
    reseed(blockId)
  }

  const renderSections = (sections?: typeof spread.intro) =>
    sections?.map((section, i) => (
      <section key={i} className="pop-plate-section">
        <h3 className="pop-plate-section-heading">
          {section.heading}
          {section.headingJp && (
            <span className="pop-plate-section-heading-jp">{section.headingJp}</span>
          )}
        </h3>
        {section.paragraphs.map((p, pi) => (
          <p key={pi} className="pop-plate-paragraph">{p}</p>
        ))}
      </section>
    ))

  const proofSeeds = outputBlocks
    .map((b) => `No.${String((proofs[b.id]?.seed ?? 0) % 1000).padStart(3, '0')}`)
    .join(' · ')

  return (
    <section className={`pop-plate ${stockClass}`} style={accentStyle} aria-labelledby="pop-plate-title">
      <div className="pop-plate-inner">

        <header className={`pop-plate-header ${spread.titleLines ? 'pop-plate-header--galley' : ''}`}>
          <span className="pop-kicker pop-kicker--tomato">{spread.kicker}</span>
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          {spread.titleLines ? (
            <h2 id="pop-plate-title" className="pop-plate-title pop-plate-title--monument">
              {spread.titleLines.map((line, i) => (
                <span
                  key={i}
                  className={`pop-plate-title-line ${i === spread.titleLines!.length - 1 ? 'pop-plate-title-line--accent' : ''}`}
                >
                  {line}
                </span>
              ))}
            </h2>
          ) : (
            <h2 id="pop-plate-title" className="pop-display pop-plate-title">
              {spread.title}
            </h2>
          )}
          <p className="pop-feature-jp pop-plate-title-jp">{spread.titleJp}</p>
          <p className="pop-swash pop-plate-deck">{spread.deck}</p>
          <p className="pop-folio pop-plate-byline">{spread.byline}</p>
        </header>

        {spread.dossier && (
          <aside className="pop-plate-spec" aria-label={spread.dossier.kicker}>
            <div className="pop-plate-spec-frame">
              <PopShape
                name="lozenge"
                size="md"
                color="tomato"
                className="pop-plate-spec-badge"
                aria-label="spec badge"
              />
              <span className="pop-folio pop-plate-spec-kicker">{spread.dossier.kicker}</span>
              {spread.dossier.note && (
                <p className="pop-plate-spec-note">{spread.dossier.note}</p>
              )}
              <dl className="pop-plate-spec-list">
                {spread.dossier.items.map((item, i) => (
                  <div key={i} className="pop-plate-spec-row">
                    <dt className="pop-folio pop-plate-spec-label">{item.label}</dt>
                    <dd className="pop-plate-spec-value">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        )}

        {spread.intro && (
          <article className="pop-plate-prose">{renderSections(spread.intro)}</article>
        )}

        <hr className="pop-rule pop-plate-rule" />

        {spread.plateKicker && (
          <p className="pop-folio pop-plate-kicker-line">{spread.plateKicker}</p>
        )}
        {spread.plateHint && (
          <p className="pop-folio pop-plate-hint">{spread.plateHint}</p>
        )}

        <div className="pop-plate-scroll">
          <div className="pop-plate-frame">
            <span className="pop-plate-tick pop-plate-tick--tl" aria-hidden="true" />
            <span className="pop-plate-tick pop-plate-tick--tr" aria-hidden="true" />
            <span className="pop-plate-tick pop-plate-tick--bl" aria-hidden="true" />
            <span className="pop-plate-tick pop-plate-tick--br" aria-hidden="true" />

            <div ref={stageRef} className="pop-plate-stage">
              <svg ref={svgRef} className="pop-plate-wires" aria-hidden="true">
                {spread.wires.map((_, i) => (
                  <path
                    key={i}
                    ref={(el) => { wireRefs.current[i] = el }}
                    className={`pop-plate-wire ${litWires.has(i) ? 'pop-plate-wire--lit' : ''}`}
                    d={wirePaths[i] ?? ''}
                  />
                ))}
              </svg>

              {spread.blocks.map((block) => {
                const pos = positions[block.id]
                const proof = proofs[block.id]
                return (
                  <div
                    key={block.id}
                    ref={(el) => { blockRefs.current[block.id] = el }}
                    className="pop-plate-block"
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    tabIndex={0}
                    role="group"
                    aria-roledescription="movable block — arrow keys or drag to move"
                    aria-label={`${block.label}${block.labelJp ? ` · ${block.labelJp}` : ''}`}
                    onPointerDown={onBlockPointerDown(block.id)}
                    onPointerMove={onBlockPointerMove(block.id)}
                    onPointerUp={onBlockPointerUp}
                    onPointerCancel={onBlockPointerUp}
                    onKeyDown={onBlockKeyDown(block.id)}
                  >
                    <div className="pop-plate-block-head">
                      <span>{block.label}</span>
                      {block.labelJp && <span className="pop-plate-block-jp">{block.labelJp}</span>}
                    </div>
                    <div className="pop-plate-block-body">
                      {block.kind === 'text' ? (
                        <p className="pop-plate-prompt">{block.prompt}</p>
                      ) : (
                        <button
                          type="button"
                          className="pop-plate-proof-button"
                          onClick={() => redrawOne(block.id)}
                          disabled={phase !== 'rest'}
                          aria-label={`Redraw the proof in ${block.label} (current proof No.${String((proof?.seed ?? 0) % 1000).padStart(3, '0')})`}
                        >
                          <canvas
                            ref={(el) => { canvasRefs.current[block.id] = el }}
                            width={352}
                            height={220}
                          />
                        </button>
                      )}
                    </div>
                    <div className={`pop-plate-block-status ${proof?.rendering ? '' : 'pop-plate-block-status--done'}`}>
                      {block.kind === 'text'
                        ? phase === 'pulling'
                          ? 'SENT ★ INTENT ON THE WIRE'
                          : 'STANDING · 常設'
                        : proof?.rendering
                          ? `RENDER · ${proof.model ?? ''}`
                          : `PROOF ★ ${proof?.model ?? ''}`}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="pop-plate-controls">
              <button
                type="button"
                className="pop-plate-run"
                onClick={pull}
                disabled={phase !== 'rest'}
              >
                {pulls === 0 ? spread.runLabel : (spread.runAgainLabel ?? spread.runLabel)}
              </button>
              <p className="pop-folio pop-plate-ledger" aria-live="polite">
                PULLS {String(pulls).padStart(2, '0')} · REDRAWS {String(redraws).padStart(2, '0')} · MODELS DRAWN {String(modelsDrawn.size).padStart(2, '0')} · PROOFS {proofSeeds}
              </p>
            </div>
          </div>
        </div>

        {spread.plateCaption && (
          <p className="pop-folio pop-plate-caption">{spread.plateCaption}</p>
        )}

        <div className="pop-plate-note-block">
          {/* Print-only snapshot — the proofs' addresses (amended rule 4). */}
          <p className="pop-plate-print-snapshot" aria-hidden="true">
            PRINTED MID-SESSION — PROOFS {proofSeeds} · {pulls} {pulls === 1 ? 'PULL' : 'PULLS'} · {redraws} {redraws === 1 ? 'REDRAW' : 'REDRAWS'}
          </p>
          <p className="pop-plate-note">{spread.plateNote}</p>
        </div>

        {spread.ticker && (
          <div className="pop-plate-ticker-wrap" aria-label={spread.tickerLabel ?? 'The stockroom'}>
            <div className="pop-plate-ticker">
              {[...spread.ticker, ...spread.ticker].map((model, i) => (
                <span key={i} className="pop-plate-ticker-item" aria-hidden={i >= spread.ticker!.length}>
                  {model}
                  <span className="pop-plate-ticker-star" aria-hidden="true"> ★ </span>
                </span>
              ))}
            </div>
          </div>
        )}
        {spread.tickerLabel && (
          <p className="pop-folio pop-plate-ticker-label">{spread.tickerLabel}</p>
        )}

        {spread.catalog && (
          <section className="pop-plate-catalog">
            {spread.catalogKicker && (
              <p className="pop-folio pop-plate-catalog-kicker">{spread.catalogKicker}</p>
            )}
            {spread.catalog.map((row) => (
              <div key={row.n} className="pop-plate-catalog-row">
                <span className="pop-plate-catalog-no">{row.n}</span>
                <div className="pop-plate-catalog-head">
                  <h3 className="pop-plate-catalog-title">{row.en}</h3>
                  {row.jp && <span className="pop-plate-catalog-jp">{row.jp}</span>}
                </div>
                <p className="pop-plate-catalog-body">{row.body}</p>
              </div>
            ))}
          </section>
        )}

        <hr className="pop-rule pop-plate-rule" />

        {spread.outro && (
          <article className="pop-plate-prose pop-plate-prose--note">{renderSections(spread.outro)}</article>
        )}

        {spread.pullQuote && (
          <blockquote className="pop-plate-pullquote">
            <p className="pop-plate-pullquote-text">{spread.pullQuote.text}</p>
            <cite className="pop-folio pop-plate-pullquote-cite">{spread.pullQuote.attribution}</cite>
          </blockquote>
        )}

        {spread.references && (
          <aside className="pop-plate-references" aria-label={spread.references.kicker}>
            <span className="pop-folio pop-plate-references-kicker">{spread.references.kicker}</span>
            {spread.references.note && (
              <p className="pop-plate-references-note">{spread.references.note}</p>
            )}
            <ul className="pop-plate-references-list">
              {spread.references.items.map((ref, i) => (
                <li key={i} className="pop-plate-reference">
                  {ref.authors} ({ref.year}). <em>{ref.title}</em>{ref.journal ? `. ${ref.journal}.` : '.'}
                </li>
              ))}
            </ul>
          </aside>
        )}

        <footer className="pop-plate-signoff">
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          <p className="pop-swash pop-plate-signoff-text">{spread.signoff}</p>
          <div className="pop-monument pop-plate-monument">
            <span>ISSUE</span>
            <strong>{issue.number}</strong>
            <span>{issue.month} {issue.year}</span>
          </div>
        </footer>

      </div>
    </section>
  )
}
