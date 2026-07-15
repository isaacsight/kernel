import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import type { BoreSpread, IssueRecord } from '../content/issues'
import { resolveAccentHex } from '../content/issues/accents'
import { PopShape } from './ornaments'
import './BoreFeature.css'
import './IssueAccent.css'

interface BoreFeatureProps {
  spread: BoreSpread
  issue: IssueRecord
}

/**
 * BoreFeature — the DEPTH control. The eleventh interaction shape
 * (ISSUE 420), born from its reservation when the editor promoted
 * CORE SAMPLE No.1 to the issue of record.
 *
 * ARIA patterns (rule 5): the winch is a plain BUTTON; the sorts
 * are aria-pressed toggle buttons (the keyboard door to carrying —
 * clicking a word on a canvas plate is a pointer shortcut to the
 * SAME act, never the only door); the temperature is a radiogroup.
 *
 * Rule 3: inherits the 419 working-model exception — script moves
 * the probe and paints the plates INSIDE the bore frame only;
 * every animation step advances via tick() (rAF raced against a
 * timer, so throttled tabs never stall the descent);
 * reduced-motion collapses everything to instant state.
 *
 * Rule 4 + depth doctrine: emphasis, never existence. All six
 * strata and all three answers are legible at rest; the probe
 * raises content into the accent. Plates are deterministic from a
 * fixed seed printed on their faces; the resting state is
 * identical on every copy. Print stacks the strata with the
 * ledger snapshot.
 *
 * Rule 6 (doubled): the ledger counts only the reader — depth,
 * drops, carries, temperature — session-only, unrecorded; the
 * strata are disclosed as drawn (`boreNote`, `candidatesNote`).
 */

const SEED = 41906

function mulberry32(a: number) {
  let s = a | 0
  return function () {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

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

export function BoreFeature({ spread, issue }: BoreFeatureProps) {
  const stockClass = `pop-stock-${spread.stock ?? 'ink'}`
  const accentHex = resolveAccentHex(issue.accent, spread.type)
  const accentStyle = { '--issue-accent-base': accentHex } as CSSProperties

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const [depth, setDepth] = useState(0)
  const [drops, setDrops] = useState(0)
  const [carries, setCarries] = useState(0)
  const [carried, setCarried] = useState(spread.defaultCarried)
  const [temp, setTemp] = useState(spread.defaultTemp)
  const [dropping, setDropping] = useState(false)
  const [risen, setRisen] = useState('')

  const gaugeRef = useRef<HTMLDivElement | null>(null)
  const probeRef = useRef<HTMLSpanElement | null>(null)
  const stratumRefs = useRef<Array<HTMLElement | null>>([])
  const stopRefs = useRef<Array<HTMLSpanElement | null>>([])
  const cvSpace = useRef<HTMLCanvasElement | null>(null)
  const cvLoom = useRef<HTMLCanvasElement | null>(null)
  const typewriter = useRef(0)

  const tempStop = spread.tempStops.find((t) => t.id === temp) ?? spread.tempStops[0]

  const tokens = useCallback(() => {
    const host = gaugeRef.current?.closest('.pop-bore') as HTMLElement | null
    const cs = host ? getComputedStyle(host) : null
    return {
      ink: cs?.getPropertyValue('--pop-ink').trim() || '#1f1e1d',
      meta: cs?.getPropertyValue('--pop-coffee').trim() || '#6e675f',
      faint: cs?.getPropertyValue('--pop-hairline-soft').trim() || '#d8d2c6',
      accent: accentHex,
    }
  }, [accentHex])

  /* ── gauge geometry ── */
  const placeStops = useCallback(() => {
    const gauge = gaugeRef.current
    if (!gauge) return
    const gr = gauge.getBoundingClientRect()
    stratumRefs.current.forEach((sec, i) => {
      const stop = stopRefs.current[i]
      if (!sec || !stop) return
      const r = sec.getBoundingClientRect()
      const y = r.top + r.height / 2 - gr.top
      stop.style.top = `${y}px`
      stop.dataset.y = String(y)
    })
    const probe = probeRef.current
    const stop = stopRefs.current[depth]
    if (probe && stop) probe.style.top = `${stop.dataset.y ?? 0}px`
  }, [depth])

  useLayoutEffect(() => {
    placeStops()
    const t = window.setTimeout(placeStops, 300)
    window.addEventListener('resize', placeStops)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('resize', placeStops)
    }
  }, [placeStops])

  const moveProbe = useCallback(
    (toDepth: number) => {
      const probe = probeRef.current
      const stop = stopRefs.current[toDepth]
      if (!probe || !stop) return
      const y = parseFloat(stop.dataset.y ?? '0')
      if (reducedMotion) {
        probe.style.top = `${y}px`
        return
      }
      const from = parseFloat(probe.style.top || '0')
      const t0 = performance.now()
      const DUR = 700
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / DUR)
        const e = 1 - Math.pow(1 - k, 3)
        probe.style.top = `${from + (y - from) * e}px`
        if (k < 1) tick(step)
      }
      tick(step)
    },
    [reducedMotion],
  )

  /* ── plates ── */
  const spacePos = useCallback(() => {
    const rnd = mulberry32(SEED)
    const pos: Record<string, { x: number; y: number }> = {}
    spread.sorts.forEach((w, i) => {
      pos[w] = {
        x: 0.12 + (i % 4) * 0.22 + rnd() * 0.09,
        y: 0.2 + (i < 4 ? 0 : 0.42) + rnd() * 0.18,
      }
    })
    return pos
  }, [spread.sorts])

  const paintSpace = useCallback(
    (t?: number) => {
      const cv = cvSpace.current
      const ctx = cv?.getContext('2d')
      if (!cv || !ctx) return
      const w = cv.width
      const h = cv.height
      const c = tokens()
      const pos = spacePos()
      ctx.clearRect(0, 0, w, h)

      ctx.strokeStyle = c.faint
      ctx.lineWidth = 0.5
      for (let gx = 40.5; gx < w; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke() }
      for (let gy = 40.5; gy < h; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke() }

      spread.sorts.forEach((word, i) => {
        const p = pos[word]
        const x = p.x * w
        const isCarried = word === carried
        const drift = t && isCarried ? Math.sin(t / 1100 + i) * 2.5 : 0
        const y = p.y * h + drift

        if (isCarried) {
          ctx.strokeStyle = c.accent
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(x, y, 26, 0, Math.PI * 2)
          ctx.stroke()
          const rnd2 = mulberry32(SEED + i * 977)
          ;(spread.neighbors[word] ?? []).forEach((nb, k) => {
            const ang = (Math.PI * 2 * k) / 3 + rnd2() * 0.9
            const d = 58 + rnd2() * 26
            const nx = x + Math.cos(ang) * d
            const ny = y + Math.sin(ang) * d * 0.6
            ctx.strokeStyle = c.meta
            ctx.setLineDash([2, 4])
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny); ctx.stroke()
            ctx.setLineDash([])
            ctx.fillStyle = c.meta
            ctx.font = 'italic 13px Georgia, serif'
            ctx.fillText(nb, nx + 5, ny + 4)
            ctx.beginPath(); ctx.arc(nx, ny, 2, 0, Math.PI * 2); ctx.fill()
          })
        }

        ctx.fillStyle = isCarried ? c.accent : c.ink
        ctx.beginPath()
        ctx.arc(x, y, isCarried ? 4.5 : 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.font = '12px Courier, monospace'
        ctx.fillText(word.toUpperCase(), x + 9, y + 4)
      })

      ctx.fillStyle = c.meta
      ctx.font = '9px Courier, monospace'
      ctx.fillText(`No.${String(SEED % 1000).padStart(3, '0')}`, w - 46, h - 8)
    },
    [carried, spacePos, spread.neighbors, spread.sorts, tokens],
  )

  const loomXs = useCallback(() => {
    const cv = cvLoom.current
    if (!cv) return []
    return spread.sorts.map((_, i) => cv.width * (0.08 + (i / (spread.sorts.length - 1)) * 0.84))
  }, [spread.sorts])

  const paintLoom = useCallback(
    (t?: number) => {
      const cv = cvLoom.current
      const ctx = cv?.getContext('2d')
      if (!cv || !ctx) return
      const w = cv.width
      const h = cv.height
      const c = tokens()
      ctx.clearRect(0, 0, w, h)
      const rnd = mulberry32(SEED + 5)
      const xs = loomXs()
      const topY = 34
      const botY = h - 34

      for (let i = 0; i < spread.sorts.length; i++) {
        for (let j = 0; j < spread.sorts.length; j++) {
          const weight = rnd()
          const involved = spread.sorts[i] === carried || spread.sorts[j] === carried
          if (weight < 0.55 && !involved) continue
          ctx.strokeStyle = involved ? c.accent : c.faint
          ctx.lineWidth = involved ? 0.4 + weight * 1.8 : 0.4 + weight * 0.7
          ctx.globalAlpha = involved ? 0.85 : 0.5
          ctx.beginPath()
          ctx.moveTo(xs[i], topY + 8)
          ctx.bezierCurveTo(xs[i], h * 0.45, xs[j], h * 0.55, xs[j], botY - 8)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1

      if (t && !reducedMotion) {
        const k = (t % 2600) / 2600
        const ci = spread.sorts.indexOf(carried)
        const target = (ci + 3) % spread.sorts.length
        const yy = topY + 8 + (botY - topY - 16) * k
        const xx = xs[ci] + (xs[target] - xs[ci]) * (k * k * (3 - 2 * k))
        ctx.fillStyle = c.accent
        ctx.beginPath(); ctx.arc(xx, yy, 3.5, 0, Math.PI * 2); ctx.fill()
      }

      spread.sorts.forEach((word, i) => {
        const isCarried = word === carried
        ctx.fillStyle = isCarried ? c.accent : c.ink
        ctx.font = '11px Courier, monospace'
        ctx.save()
        ctx.textAlign = 'center'
        ctx.fillText(word.toUpperCase(), xs[i], topY - 8)
        ctx.fillText(word.toUpperCase(), xs[i], botY + 18)
        ctx.restore()
        ctx.beginPath(); ctx.arc(xs[i], topY + 4, 2.5, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(xs[i], botY - 4, 2.5, 0, Math.PI * 2); ctx.fill()
      })

      ctx.fillStyle = c.meta
      ctx.font = '9px Courier, monospace'
      ctx.fillText(`No.${String((SEED + 5) % 1000).padStart(3, '0')}`, w - 46, h - 8)
    },
    [carried, loomXs, reducedMotion, spread.sorts, tokens],
  )

  useEffect(() => {
    paintSpace()
    paintLoom()
  }, [paintSpace, paintLoom])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => { paintSpace(); paintLoom() }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [paintSpace, paintLoom])

  /* ambient plates — active stratum only, timer-driven */
  useEffect(() => {
    if (reducedMotion) return
    const id = window.setInterval(() => {
      if (depth === 2) paintSpace(performance.now())
      if (depth === 3) paintLoom(performance.now())
    }, 90)
    return () => window.clearInterval(id)
  }, [depth, paintSpace, paintLoom, reducedMotion])

  /* ── carrying ── */
  const carrySort = (word: string) => {
    if (word === carried || !spread.sorts.includes(word)) return
    setCarried(word)
    setCarries((n) => n + 1)
  }

  const canvasClick = (cv: HTMLCanvasElement | null, ev: ReactMouseEvent, mode: 'space' | 'loom') => {
    if (!cv) return
    const r = cv.getBoundingClientRect()
    const px = ((ev.clientX - r.left) / r.width) * cv.width
    const py = ((ev.clientY - r.top) / r.height) * cv.height
    let best: string | null = null
    let bestD = mode === 'space' ? 4200 : 3600
    if (mode === 'space') {
      const pos = spacePos()
      spread.sorts.forEach((word) => {
        const q = pos[word]
        const dx = q.x * cv.width - px
        const dy = q.y * cv.height - py
        const d = dx * dx + dy * dy
        if (d < bestD) { bestD = d; best = word }
      })
    } else {
      const xs = loomXs()
      spread.sorts.forEach((word, i) => {
        const d = (xs[i] - px) * (xs[i] - px)
        if (d < bestD) { bestD = d; best = word }
      })
    }
    if (best) carrySort(best)
  }

  /* ── the winch ── */
  const answerText = tempStop.answer

  const riseReturn = useCallback(() => {
    if (reducedMotion) return
    const gauge = gaugeRef.current
    if (!gauge) return
    const old = gauge.querySelector('.pop-bore-return-dot')
    if (old) gauge.removeChild(old)
    const dot = document.createElement('span')
    dot.className = 'pop-bore-return-dot'
    gauge.appendChild(dot)
    const y5 = parseFloat(stopRefs.current[5]?.dataset.y ?? '0')
    const y0 = parseFloat(stopRefs.current[0]?.dataset.y ?? '0')
    dot.style.top = `${y5}px`
    const t0 = performance.now()
    const DUR = 1400
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / DUR)
      const e = 1 - Math.pow(1 - k, 2)
      dot.style.top = `${y5 + (y0 - y5) * e}px`
      if (k < 1) tick(step)
      else {
        dot.style.transition = 'opacity 0.8s ease'
        dot.style.opacity = '0'
        window.setTimeout(() => { if (dot.parentNode) dot.parentNode.removeChild(dot) }, 900)
      }
    }
    tick(step)
  }, [reducedMotion])

  const assemble = useCallback(() => {
    const runId = ++typewriter.current
    if (reducedMotion) {
      setRisen(answerText)
      return
    }
    let i = 0
    const step = () => {
      if (runId !== typewriter.current) return
      setRisen(answerText.slice(0, i))
      i += 2
      if (i <= answerText.length + 1) window.setTimeout(step, 18)
      else riseReturn()
    }
    step()
  }, [answerText, reducedMotion, riseReturn])

  useEffect(() => {
    if (depth === 5) assemble()
    else setRisen('')
  }, [depth, temp, assemble])

  const pull = () => {
    if (dropping) return
    if (depth >= 5) {
      setDepth(0)
      setDrops((n) => n + 1)
      moveProbe(0)
      return
    }
    setDropping(true)
    const next = depth + 1
    moveProbe(next)
    window.setTimeout(() => {
      setDepth(next)
      if (next === 1) setDrops((n) => n + 1)
      setDropping(false)
    }, reducedMotion ? 40 : 760)
  }

  const statusFor = (i: number) => {
    if (i === 0) return depth === 0 ? 'PROBE HERE · 探針在位' : 'PASSED · 通過'
    if (i < depth) return 'PASSED · 通過'
    if (i === depth) return i === 5 ? 'FLOOR — SURFACED IN REVERSE · 帰還' : 'REACHED · 到達'
    return 'UNREACHED · 未達'
  }

  const renderSections = (sections?: typeof spread.intro) =>
    sections?.map((section, i) => (
      <section key={i} className="pop-bore-section">
        <h3 className="pop-bore-section-heading">
          {section.heading}
          {section.headingJp && <span className="pop-bore-section-heading-jp">{section.headingJp}</span>}
        </h3>
        {section.paragraphs.map((p, pi) => (
          <p key={pi} className="pop-bore-paragraph">{p}</p>
        ))}
      </section>
    ))

  const boreStyle = { '--live-depth': depth / 5 } as CSSProperties

  return (
    <section className={`pop-bore ${stockClass}`} style={{ ...accentStyle, ...boreStyle }} aria-labelledby="pop-bore-title">
      <div className="pop-bore-inner">

        <header className="pop-bore-header">
          <span className="pop-kicker pop-kicker--tomato">{spread.kicker}</span>
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          {spread.titleLines ? (
            <h2 id="pop-bore-title" className="pop-bore-title pop-bore-title--monument">
              {spread.titleLines.map((line, i) => (
                <span key={i} className={`pop-bore-title-line ${i === spread.titleLines!.length - 1 ? 'pop-bore-title-line--accent' : ''}`}>
                  {line}
                </span>
              ))}
            </h2>
          ) : (
            <h2 id="pop-bore-title" className="pop-display pop-bore-title">{spread.title}</h2>
          )}
          <p className="pop-feature-jp pop-bore-title-jp">{spread.titleJp}</p>
          <p className="pop-swash pop-bore-deck">{spread.deck}</p>
          <p className="pop-folio pop-bore-byline">{spread.byline}</p>
        </header>

        {spread.dossier && (
          <aside className="pop-bore-spec" aria-label={spread.dossier.kicker}>
            <div className="pop-bore-spec-frame">
              <PopShape name="lozenge" size="md" color="tomato" className="pop-bore-spec-badge" aria-label="spec badge" />
              <span className="pop-folio pop-bore-spec-kicker">{spread.dossier.kicker}</span>
              {spread.dossier.note && <p className="pop-bore-spec-note">{spread.dossier.note}</p>}
              <dl className="pop-bore-spec-list">
                {spread.dossier.items.map((item, i) => (
                  <div key={i} className="pop-bore-spec-row">
                    <dt className="pop-folio pop-bore-spec-label">{item.label}</dt>
                    <dd className="pop-bore-spec-value">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        )}

        {spread.intro && <article className="pop-bore-prose">{renderSections(spread.intro)}</article>}

        {spread.boreKicker && <p className="pop-folio pop-bore-kicker-line">{spread.boreKicker}</p>}
        {spread.boreHint && <p className="pop-folio pop-bore-hint">{spread.boreHint}</p>}

        <div className="pop-bore-rig">
          <div ref={gaugeRef} className="pop-bore-gauge" aria-hidden="true">
            <span className="pop-bore-gauge-line" />
            <span ref={probeRef} className="pop-bore-probe" />
            {spread.strata.map((s, i) => (
              <span
                key={i}
                ref={(el) => { stopRefs.current[i] = el }}
                className={`pop-bore-stop ${i <= depth ? 'pop-bore-stop--lit' : ''}`}
              >
                {s.gauge}
                {s.gaugeJp && <><br />{s.gaugeJp}</>}
              </span>
            ))}
          </div>

          <div className="pop-bore-strata">

            {spread.strata.map((meta, i) => (
              <section
                key={i}
                ref={(el) => { stratumRefs.current[i] = el }}
                className={`pop-bore-stratum ${i === depth ? 'pop-bore-stratum--active' : ''} ${i <= depth ? 'pop-bore-stratum--reached' : ''}`}
                style={{ '--depth': i / 5 } as CSSProperties}
                aria-label={meta.label}
              >
                <div className="pop-bore-stratum-head">
                  <span>{meta.label}</span>
                  {meta.labelJp && <span className="pop-bore-stratum-jp">{meta.labelJp}</span>}
                  <span className="pop-bore-stratum-status">{statusFor(i)}</span>
                </div>

                <div className="pop-bore-stratum-body">
                  {i === 0 && (
                    <>
                      <p className="pop-bore-prompt">{spread.prompt}<span className="pop-bore-caret" aria-hidden="true" /></p>
                      <button type="button" className="pop-bore-run" onClick={pull} disabled={dropping}>
                        {depth >= 5 ? spread.winchLabel : spread.runLabel}
                      </button>
                    </>
                  )}

                  {i === 1 && (
                    <>
                      <div
                        className={`pop-bore-sorts ${depth >= 1 ? 'pop-bore-sorts--landed' : ''}`}
                        role="group"
                        aria-label="The prompt broken into sorts — pick one to carry down"
                      >
                        {spread.sorts.map((word) => (
                          <button
                            key={word}
                            type="button"
                            className="pop-bore-sort"
                            aria-pressed={word === carried}
                            onClick={() => carrySort(word)}
                          >
                            {word}
                          </button>
                        ))}
                      </div>
                      <p className="pop-folio pop-bore-sort-note">
                        PICK ONE UP; THE LOWER STRATA WILL SHOW YOU ITS JOURNEY. CARRYING: <b>{carried.toUpperCase()}</b>
                      </p>
                    </>
                  )}

                  {i === 2 && (
                    <canvas
                      ref={cvSpace}
                      width={880}
                      height={330}
                      onClick={(ev) => canvasClick(cvSpace.current, ev, 'space')}
                    />
                  )}

                  {i === 3 && (
                    <canvas
                      ref={cvLoom}
                      width={880}
                      height={330}
                      onClick={(ev) => canvasClick(cvLoom.current, ev, 'loom')}
                    />
                  )}

                  {i === 4 && (
                    <>
                      <div className="pop-bore-temp-row" role="radiogroup" aria-label="Temperature — how loosely the next word is drawn">
                        <span className="pop-folio pop-bore-temp-label">TEMPERATURE</span>
                        {spread.tempStops.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            className="pop-bore-temp"
                            role="radio"
                            aria-checked={t.id === temp}
                            onClick={() => setTemp(t.id)}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                      <div className="pop-bore-candidates">
                        {tempStop.candidates.map((cand) => (
                          <div key={cand.word} className={`pop-bore-cand ${cand.drawn ? 'pop-bore-cand--drawn' : ''}`}>
                            <span className="pop-bore-cand-word">midnight… {cand.word}</span>
                            <span className="pop-bore-cand-track">
                              <span className="pop-bore-cand-bar" style={{ width: `${cand.share}%` }} />
                            </span>
                            <span className="pop-bore-cand-pct">{cand.share}%</span>
                          </div>
                        ))}
                      </div>
                      <p className="pop-folio pop-bore-cand-note">{spread.candidatesNote}</p>
                    </>
                  )}

                  {i === 5 && (
                    <p className="pop-bore-answer" aria-live="polite">
                      {depth === 5 ? (
                        <span className="pop-bore-answer-risen">{risen}</span>
                      ) : (
                        <>
                          <span className="pop-bore-answer-waiting">{answerText}</span>
                          <span className="pop-bore-answer-note">
                            — WAITING BELOW THE LINE AT {temp.toUpperCase()} · LOWER THE PROBE TO RAISE IT —
                          </span>
                        </>
                      )}
                    </p>
                  )}
                </div>

                <p className="pop-bore-stratum-caption">{meta.caption}</p>
              </section>
            ))}

            <div className="pop-bore-ledger-block">
              <p className="pop-folio pop-bore-ledger-kicker">THE WINCH LEDGER · 台帳</p>
              <p className="pop-bore-ledger" aria-live="polite">
                DEPTH {depth === 0 ? '0m' : `−${depth}`} · DROPS {String(drops).padStart(2, '0')} · SORTS CARRIED {String(carries).padStart(2, '0')} · TEMPERATURE {temp.toUpperCase()}
              </p>
              <p className="pop-bore-print-snapshot" aria-hidden="true">
                PRINTED MID-SESSION — DEPTH {depth === 0 ? '0m' : `−${depth}`} · {drops} {drops === 1 ? 'DROP' : 'DROPS'} · {carries} CARRIED · {temp.toUpperCase()} · PLATES No.{String(SEED % 1000).padStart(3, '0')} / No.{String((SEED + 5) % 1000).padStart(3, '0')}
              </p>
              <p className="pop-bore-note">{spread.boreNote}</p>
            </div>

          </div>
        </div>

        <hr className="pop-rule pop-bore-rule" />

        {spread.outro && <article className="pop-bore-prose pop-bore-prose--note">{renderSections(spread.outro)}</article>}

        {spread.pullQuote && (
          <blockquote className="pop-bore-pullquote">
            <p className="pop-bore-pullquote-text">{spread.pullQuote.text}</p>
            <cite className="pop-folio pop-bore-pullquote-cite">{spread.pullQuote.attribution}</cite>
          </blockquote>
        )}

        {spread.references && (
          <aside className="pop-bore-references" aria-label={spread.references.kicker}>
            <span className="pop-folio pop-bore-references-kicker">{spread.references.kicker}</span>
            {spread.references.note && <p className="pop-bore-references-note">{spread.references.note}</p>}
            <ul className="pop-bore-references-list">
              {spread.references.items.map((ref, i) => (
                <li key={i} className="pop-bore-reference">
                  {ref.authors} ({ref.year}). <em>{ref.title}</em>{ref.journal ? `. ${ref.journal}.` : '.'}
                </li>
              ))}
            </ul>
          </aside>
        )}

        <footer className="pop-bore-signoff">
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          <p className="pop-swash pop-bore-signoff-text">{spread.signoff}</p>
          <div className="pop-monument pop-bore-monument">
            <span>ISSUE</span>
            <strong>{issue.number}</strong>
            <span>{issue.month} {issue.year}</span>
          </div>
        </footer>

      </div>
    </section>
  )
}
