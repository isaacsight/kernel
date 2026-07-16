import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { AuditSpread, IssueRecord } from '../content/issues'
import { resolveAccentHex } from '../content/issues/accents'
import { PopShape } from './ornaments'
import './AuditFeature.css'
import './IssueAccent.css'

/*
 * ISSUE 422 — the SESSION control (`audit`), and the FIRST MERGER
 * ISSUE: the apparatus carries onto the site whole, no reduction
 * (artifact-language §I as amended; interaction-language rule 3,
 * the apparatus register). Full amplitude is confined to this
 * feature; the honesty core travels undiminished — every meter
 * counts the reader's own hands and dwell, session-only,
 * unrecorded, erased on reload.
 */

interface AuditFeatureProps {
  spread: AuditSpread
  issue: IssueRecord
}

const STRATA = [
  { key: 'wealth', label: 'I · THE WEALTH', jp: '富' },
  { key: 'scarcity', label: 'II · THE SCARCITY', jp: '稀少' },
  { key: 'allocation', label: 'III · THE ALLOCATION', jp: '配分' },
  { key: 'zone', label: 'IV · THE ZONE', jp: 'ゾーン' },
  { key: 'floor', label: 'V · THE FLOOR', jp: '決算' },
] as const

type StratumKey = (typeof STRATA)[number]['key']

// Timer-robust step (rule 3 as amended): every frame advances via
// a rAF-vs-setTimeout race — rAF alone stalls in throttled tabs.
function tick(fn: () => void) {
  let fired = false
  const fire = () => {
    if (fired) return
    fired = true
    fn()
  }
  requestAnimationFrame(fire)
  window.setTimeout(fire, 42)
}

const pad = (n: number) => (n < 10 ? '0' : '') + n
const fmtClock = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return pad(Math.floor(s / 60)) + ':' + pad(s % 60)
}

/** Dimmed-but-legible prose with a duplicate ink layer the beam raises. */
function Beam({ registry, children }: { registry: Set<HTMLElement>; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    registry.add(el)
    return () => {
      registry.delete(el)
    }
  }, [registry])
  return (
    <div className="pop-audit-beam" ref={ref}>
      {children}
      <div className="pop-audit-ink" aria-hidden="true">
        {children}
      </div>
    </div>
  )
}

export function AuditFeature({ spread, issue }: AuditFeatureProps) {
  const accentHex = resolveAccentHex(issue.accent, spread.type)
  const accentStyle = { '--issue-accent-base': accentHex } as CSSProperties
  const stockClass = `pop-stock-${spread.stock ?? 'ivory'}`

  const reduced =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const noHover =
    typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches
  const noBeam = reduced || noHover

  // ── session state (session-only, unrecorded) ──────────────
  const [alloc, setAlloc] = useState<Record<string, number>>(() => {
    const base: Record<string, number> = {}
    spread.channels.forEach((c) => {
      base[c.key] = 20
    })
    return base
  })
  const [sealed, setSealed] = useState(false)
  const [zoneClosed, setZoneClosed] = useState(false)
  const [passed, setPassed] = useState(0)
  const [pulls, setPulls] = useState<string[]>([])
  const [scrubVal, setScrubVal] = useState(0)
  const [maxInked, setMaxInked] = useState(0)
  const [goneCards, setGoneCards] = useState<Set<number>>(() => new Set())
  // meters repainted ~4x/sec from the loop
  const [meter, setMeter] = useState({ clock: '00:00', shares: {} as Record<string, number>, here: '' as string })

  const claimWords = useMemo(() => {
    const lead = spread.claimLead.split(' ').map((w) => ({ w, quote: false }))
    const quote = spread.claimQuote.split(' ').map((w) => ({ w, quote: true }))
    return lead.concat(quote)
  }, [spread.claimLead, spread.claimQuote])

  // ── mutable machinery (imperative, off the render path) ───
  const beamRegistry = useRef(new Set<HTMLElement>()).current
  const rootRef = useRef<HTMLElement>(null)
  const stratumRefs = useRef<Partial<Record<StratumKey, HTMLElement | null>>>({})
  const oneMoreRef = useRef<HTMLButtonElement>(null)
  const dwellRef = useRef<Record<StratumKey, number>>({
    wealth: 0,
    scarcity: 0,
    allocation: 0,
    zone: 0,
    floor: 0,
  })
  const totalRef = useRef(0)
  const beamRef = useRef({ x: -999, y: -999, tx: -999, ty: -999 })
  const magRef = useRef({ x: 0, y: 0, k: sealed ? 0 : 0.2, r: 92 })
  const allocRef = useRef(alloc)
  allocRef.current = alloc
  const sealedRef = useRef(sealed)
  sealedRef.current = sealed
  const zoneClosedRef = useRef(zoneClosed)
  zoneClosedRef.current = zoneClosed

  // card drag state, integrated in the loop (interruptible springs)
  interface CardPhys {
    x: number
    vx: number
    dragging: boolean
    px: number
    pt: number
    exiting: boolean
    target: number
  }
  const cardPhys = useRef<Map<number, CardPhys>>(new Map()).current
  const cardEls = useRef<Map<number, HTMLDivElement>>(new Map()).current

  const poolLeft = 100 - Object.values(alloc).reduce((a, b) => a + b, 0)
  const feedGrant = alloc['feed'] ?? 20
  const magRadius = Math.round(60 + feedGrant * 1.6)

  const dismissCard = (i: number) => {
    const p = cardPhys.get(i)
    if (!p || p.exiting) return
    p.exiting = true
    const el = cardEls.get(i)
    p.target = (p.x >= 0 ? 1 : -1) * ((el?.offsetWidth ?? 400) + 160)
    setPassed((n) => n + 1)
    if (reduced) {
      setGoneCards((s) => new Set(s).add(i))
    }
  }

  const cardPointerDown = (i: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).tagName === 'BUTTON') return
    const p = cardPhys.get(i)
    if (!p || p.exiting) return
    p.dragging = true
    p.px = e.clientX
    p.pt = performance.now()
    p.vx = 0
    cardEls.get(i)?.classList.add('is-dragging')
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const cardPointerMove = (i: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    const p = cardPhys.get(i)
    if (!p || !p.dragging) return
    const now = performance.now()
    const dt = Math.max(1, now - p.pt)
    const dx = e.clientX - p.px
    p.vx = p.vx * 0.6 + (dx / dt) * 0.4
    p.x += dx
    p.px = e.clientX
    p.pt = now
    paintCard(i)
  }
  const cardPointerUp = (i: number) => () => {
    const p = cardPhys.get(i)
    if (!p || !p.dragging) return
    p.dragging = false
    cardEls.get(i)?.classList.remove('is-dragging')
    if (Math.abs(p.x) > 110 || Math.abs(p.vx) > 0.9) dismissCard(i)
    // otherwise the loop springs it home — grab it again mid-flight
  }
  function paintCard(i: number) {
    const el = cardEls.get(i)
    const p = cardPhys.get(i)
    if (!el || !p) return
    el.style.transform = `translateX(${p.x.toFixed(1)}px) rotate(${(p.x * 0.045).toFixed(2)}deg)`
    el.style.opacity = String(Math.max(0, 1 - Math.abs(p.x) / 420))
  }

  const step = (key: string, d: number) => {
    setAlloc((a) => {
      const left = 100 - Object.values(a).reduce((x, y) => x + y, 0)
      if (d > 0 && left < d) return a
      if (d < 0 && (a[key] ?? 0) < -d) return a
      return { ...a, [key]: (a[key] ?? 0) + d }
    })
  }

  const pullOne = () => {
    if (zoneClosedRef.current) return
    setPulls((p) => p.concat(spread.deckItems[(p.length + 4) % spread.deckItems.length]))
  }

  // ── the loop: dwell, beam, springs, magnetism, meters ──────
  useEffect(() => {
    let alive = true
    let last = performance.now()
    let lastPaint = 0

    const onMove = (e: PointerEvent) => {
      beamRef.current.tx = e.clientX
      beamRef.current.ty = e.clientY
    }
    const onFocus = (e: FocusEvent) => {
      const t = e.target as HTMLElement
      if (!t.getBoundingClientRect) return
      const r = t.getBoundingClientRect()
      beamRef.current.tx = r.left + r.width / 2
      beamRef.current.ty = r.top + r.height / 2
    }
    if (!noBeam) {
      document.addEventListener('pointermove', onMove)
      rootRef.current?.addEventListener('focusin', onFocus)
    }

    const loop = () => {
      if (!alive) return
      const now = performance.now()
      const dt = Math.min(250, now - last)
      last = now
      const f = Math.min(3, dt / 16.7)

      // dwell: which stratum holds the middle of the window
      const mid = window.innerHeight / 2
      let here: StratumKey | '' = ''
      for (const s of STRATA) {
        const el = stratumRefs.current[s.key]
        if (!el) continue
        const r = el.getBoundingClientRect()
        if (r.top <= mid && r.bottom > mid) {
          here = s.key
          break
        }
      }
      if (here) {
        dwellRef.current[here] += dt
        totalRef.current += dt
      }

      // beam spring + per-element mask coordinates
      const b = beamRef.current
      if (!noBeam) {
        b.x += (b.tx - b.x) * 0.16 * f
        b.y += (b.ty - b.y) * 0.16 * f
        beamRegistry.forEach((el) => {
          const r = el.getBoundingClientRect()
          if (r.bottom < -60 || r.top > window.innerHeight + 60) return
          const ink = el.lastElementChild as HTMLElement | null
          if (!ink) return
          ink.style.setProperty('--mx', (b.x - r.left).toFixed(1) + 'px')
          ink.style.setProperty('--my', (b.y - r.top).toFixed(1) + 'px')
        })
      }

      // card springs (interruptible)
      cardPhys.forEach((p, i) => {
        if (p.dragging) return
        if (p.exiting) {
          p.x += (p.target - p.x) * 0.18 * f
          paintCard(i)
          if (Math.abs(p.target - p.x) < 4) {
            p.target = p.x
            setGoneCards((s) => (s.has(i) ? s : new Set(s).add(i)))
          }
        } else if (Math.abs(p.x) > 0.4 || Math.abs(p.vx) > 0.05) {
          p.vx = p.vx * Math.pow(0.86, f) - p.x * 0.012 * f
          p.x += p.vx * dt * 0.6
          if (Math.abs(p.x) < 0.5 && Math.abs(p.vx) < 0.02) {
            p.x = 0
            p.vx = 0
          }
          paintCard(i)
        }
      })

      // magnetic dispatch on ONE MORE, geared to the declared feed grant
      const oneMore = oneMoreRef.current
      if (oneMore) {
        const m = magRef.current
        const grant = allocRef.current['feed'] ?? 20
        m.r = 60 + grant * 1.6
        const k = reduced || zoneClosedRef.current ? 0 : grant / 100
        if (k > 0 && b.tx > -900) {
          const r = oneMore.getBoundingClientRect()
          const cx = r.left + r.width / 2
          const cy = r.top + r.height / 2
          const dx = b.tx - cx
          const dy = b.ty - cy
          const d = Math.sqrt(dx * dx + dy * dy)
          const pull = d < m.r && d > 0 ? (1 - d / m.r) * 12 * k : 0
          const txp = d > 0 ? (dx / d) * pull : 0
          const typ = d > 0 ? (dy / d) * pull : 0
          m.x += (txp - m.x) * 0.2 * f
          m.y += (typ - m.y) * 0.2 * f
          oneMore.style.transform = `translate(${m.x.toFixed(1)}px,${m.y.toFixed(1)}px)`
        } else {
          oneMore.style.transform = ''
        }
      }

      // meters ~4x/sec through React state
      if (now - lastPaint > 260) {
        lastPaint = now
        const shares: Record<string, number> = {}
        for (const s of STRATA) {
          shares[s.key] =
            totalRef.current > 0 ? Math.round((100 * dwellRef.current[s.key]) / totalRef.current) : 0
        }
        setMeter({ clock: fmtClock(totalRef.current), shares, here })
      }

      tick(loop)
    }
    loop()

    return () => {
      alive = false
      if (!noBeam) {
        document.removeEventListener('pointermove', onMove)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const revealed =
    totalRef.current > 0
      ? Math.round((100 * (dwellRef.current.wealth + dwellRef.current.zone)) / totalRef.current)
      : 0
  const gap = revealed - feedGrant

  return (
    <section
      ref={rootRef}
      className={`pop-audit ${stockClass} ${noBeam ? 'no-beam' : ''}`}
      style={accentStyle}
      aria-labelledby="pop-audit-title"
    >
      <div className="pop-audit-inner">
        <header className="pop-audit-runhead">
          <span className="pop-folio">KERNEL.CHAT · PRESSROOM ORIGINAL · 校正刷</span>
          <span className="pop-folio">
            <b style={{ color: 'var(--issue-accent-base)' }}>
              {issue.coverSeal?.label ?? 'ATTENTION AUDIT No.1'}
            </b>{' '}
            · {issue.coverSeal?.date ?? 'IX·26'}
          </span>
        </header>
        <nav className="pop-audit-rail" aria-label="Treasury rail — your position and your spend">
          <span className="pop-folio">THE TREASURY · 出納局</span>
          <div className="pop-audit-rail-clock" aria-label="session clock">
            {meter.clock}
          </div>
          <span className="pop-folio" style={{ fontSize: 9 }}>
            SESSION · UNRECORDED
          </span>
          {STRATA.map((s, i) => (
            <div
              key={s.key}
              className={`pop-audit-rail-stop ${meter.here === s.key ? 'is-here' : ''}`}
              style={{ animationDelay: `${0.05 + i * 0.1}s` }}
            >
              <span className="pop-audit-stop-name">{s.label}</span>
              <span className="pop-audit-stop-jp">{s.jp}</span>
              <div className="pop-audit-dwell-bar">
                <i style={{ width: `${meter.shares[s.key] ?? 0}%` }} />
              </div>
              <span className="pop-audit-dwell-pct">{meter.shares[s.key] ?? 0}%</span>
            </div>
          ))}
          <p className="pop-audit-rail-note pop-folio">
            Dwell is measured from which stratum holds the middle of your window. Counted here, kept
            by no one.
          </p>
        </nav>

        <div className="pop-audit-column">
          <header className="pop-audit-stratum">
            <span className="pop-folio pop-audit-kicker">{spread.kicker}</span>
            <h2 id="pop-audit-title" className="pop-display pop-audit-title">
              {spread.titleLines ? (
                <>
                  {spread.titleLines[0]}
                  <br />
                  <span className="pop-audit-title-accent">{spread.titleLines[1]}</span>.
                </>
              ) : (
                spread.title
              )}
            </h2>
            <p className="pop-audit-jp">{spread.titleJp}</p>
            <Beam registry={beamRegistry}>
              <p className="pop-audit-deck">{spread.deck}</p>
            </Beam>
            <p className="pop-folio" style={{ marginTop: 14 }}>
              {spread.byline} — READING TIME: YOURS TO SPEND
            </p>

            <aside className="pop-audit-dossier" aria-label={spread.dossier.kicker}>
              <i className="pop-audit-tick tl" />
              <i className="pop-audit-tick tr" />
              <i className="pop-audit-tick bl" />
              <i className="pop-audit-tick br" />
              <PopShape name="lozenge" size="md" color="tomato" className="pop-audit-dossier-badge" />
              <span className="pop-folio">{spread.dossier.kicker}</span>
              {spread.dossier.note && <p className="pop-audit-dossier-note">{spread.dossier.note}</p>}
              <dl className="pop-audit-dossier-list">
                {spread.dossier.items.map((item, idx) => (
                  <div key={idx} className="pop-audit-dossier-row">
                    <dt className="pop-folio pop-audit-dossier-label">{item.label}</dt>
                    <dd className="pop-audit-dossier-value">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          </header>

          <section
            className="pop-audit-stratum"
            ref={(el) => {
              stratumRefs.current.wealth = el
            }}
          >
            <span className="pop-folio pop-audit-kicker">STRATUM I — THE WEALTH · 富</span>
            <h3 className="pop-audit-h">First, the wealth.</h3>
            <p className="pop-audit-jp">情報の富 — 平坦であることが正直である</p>
            <Beam registry={beamRegistry}>
              <p>
                Below is a feed. Its items are authored and deliberately flat — no escalation, no hook
                sharpening as you go — because this treasury refuses to spend craft on capturing you.
                Wade as long as you like. Set items aside by hand — drag a card away, or press its
                button. The treasury meters the wading either way.
              </p>
            </Beam>
            <div className="pop-audit-feed" aria-label="An authored feed of deliberately flat items">
              {spread.deckItems.map((txt, i) => (
                <div
                  key={i}
                  className={`pop-audit-card ${goneCards.has(i) ? 'is-gone' : ''}`}
                  ref={(el) => {
                    if (el) {
                      cardEls.set(i, el)
                      if (!cardPhys.has(i))
                        cardPhys.set(i, { x: 0, vx: 0, dragging: false, px: 0, pt: 0, exiting: false, target: 0 })
                    } else {
                      cardEls.delete(i)
                    }
                  }}
                  onPointerDown={cardPointerDown(i)}
                  onPointerMove={cardPointerMove(i)}
                  onPointerUp={cardPointerUp(i)}
                  onPointerCancel={cardPointerUp(i)}
                >
                  <span className="pop-audit-card-n">{pad(i + 1)}.</span>
                  <span className="pop-audit-card-txt">{txt}</span>
                  <button className="pop-audit-aside-btn" onClick={() => dismissCard(i)}>
                    Set aside
                  </button>
                </div>
              ))}
            </div>
            <p className="pop-folio">
              SET ASIDE BY YOUR HAND: <b>{pad(passed)}</b> — REMAINING:{' '}
              <b>{pad(spread.deckItems.length - passed)}</b>
            </p>
          </section>

          <section
            className="pop-audit-stratum"
            ref={(el) => {
              stratumRefs.current.scarcity = el
            }}
          >
            <span className="pop-folio pop-audit-kicker">STRATUM II — THE SCARCITY · 稀少</span>
            <h3 className="pop-audit-h">Then, the price.</h3>
            <p className="pop-audit-jp">稀少性 — 情報が消費するもの</p>
            <Beam registry={beamRegistry}>
              <p>
                Simon's argument, set plainly: what information consumes is the attention of its
                recipients. The sentence below is the claim this whole audit stands on. It is not
                handed to you inked — pull it through the press yourself.
              </p>
            </Beam>
            <p className="pop-audit-claim" aria-label="The claim, inked word by word by the scrubber below">
              {claimWords.map((cw, i) => (
                <span
                  key={i}
                  className={`pop-audit-w ${cw.quote ? 'is-quote' : ''} ${i < scrubVal ? 'is-inked' : ''}`}
                >
                  {cw.w}{' '}
                </span>
              ))}
            </p>
            <p className="pop-folio">
              — {spread.claimCite} · {pad(scrubVal)} / {pad(claimWords.length)} WORDS INKED{' '}
              {maxInked >= claimWords.length && <span className="pop-audit-stamp">READ IN FULL · 完読</span>}
            </p>
            <div className="pop-audit-scrub">
              <span className="pop-folio">PRESS</span>
              <input
                type="range"
                min={0}
                max={claimWords.length}
                step={1}
                value={scrubVal}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setScrubVal(v)
                  setMaxInked((m) => Math.max(m, v))
                }}
                aria-label="Ink the claim word by word"
              />
              <span className="pop-folio">FULL</span>
            </div>
          </section>

          <section
            className="pop-audit-stratum"
            ref={(el) => {
              stratumRefs.current.allocation = el
            }}
          >
            <span className="pop-folio pop-audit-kicker">STRATUM III — THE ALLOCATION · 配分</span>
            <h3 className="pop-audit-h">Now allocate it.</h3>
            <p className="pop-audit-jp">百単位の予算 — 意図の申告</p>
            <Beam registry={beamRegistry}>
              <p>
                A scarce resource demands a budget. Here are one hundred units — a declared day of
                attention. Divide them among five channels, then seal the ledger. Your declaration is
                carried down: the machine in the next stratum is geared to exactly what you grant the
                feed. Nothing here is graded; the treasury only writes down what you said.
              </p>
            </Beam>
            <div className={`pop-audit-budget ${sealed ? 'is-sealed' : ''}`}>
              <i className="pop-audit-tick tl" />
              <i className="pop-audit-tick tr" />
              <i className="pop-audit-tick bl" />
              <i className="pop-audit-tick br" />
              {spread.channels.map((c) => (
                <div key={c.key} className="pop-audit-chan">
                  <span className="pop-audit-chan-name">
                    {c.label}
                    <span className="pop-audit-chan-jp">{c.jp}</span>
                  </span>
                  <button
                    className="pop-audit-step"
                    disabled={sealed || (alloc[c.key] ?? 0) < 5}
                    onClick={() => step(c.key, -5)}
                    aria-label={`Take five units from ${c.label.toLowerCase()}`}
                  >
                    −
                  </button>
                  <span className="pop-audit-chan-val">{alloc[c.key]}</span>
                  <button
                    className="pop-audit-step"
                    disabled={sealed || poolLeft < 5}
                    onClick={() => step(c.key, 5)}
                    aria-label={`Grant five units to ${c.label.toLowerCase()}`}
                  >
                    +
                  </button>
                  <div className="pop-audit-chan-bar">
                    <i style={{ width: `${alloc[c.key]}%` }} />
                  </div>
                </div>
              ))}
              <div className="pop-audit-pool-line">
                <span className="pop-folio">
                  POOL REMAINING: <b>{poolLeft}</b> / 100 UNITS
                </span>
                <button className="pop-audit-seal-btn" disabled={poolLeft !== 0} onClick={() => setSealed(true)}>
                  SEAL THE BUDGET · 封印
                </button>
                {sealed && <span className="pop-audit-stamp">SEALED · 封印済</span>}
              </div>
            </div>
            <p className="pop-folio">
              {sealed ? (
                <>
                  SEALED — CARRIED DOWN: THE ZONE MACHINE IS NOW GEARED TO YOUR FEED GRANT (
                  <b>{feedGrant}</b>/100).
                </>
              ) : (
                <>UNSEALED — THE MACHINE BELOW IDLES AT DEFAULT GEARING (20/100).</>
              )}
            </p>
          </section>

          <section
            className="pop-audit-stratum"
            ref={(el) => {
              stratumRefs.current.zone = el
            }}
          >
            <span className="pop-folio pop-audit-kicker">STRATUM IV — THE ZONE · ゾーン</span>
            <h3 className="pop-audit-h">Meet the machine.</h3>
            <p className="pop-audit-jp">機械のギア比はあなたの申告 — 引くか、止まるか</p>
            <Beam registry={beamRegistry}>
              <p>
                The anthropologist Natasha Dow Schüll spent years watching machine gamblers disappear
                into what the industry itself calls the zone — a state engineered by the loop, not
                chosen by the player. Here is a zone machine, declawed and disclosed: its magnetic
                pull on your cursor is geared to the units <em>you</em> granted the feed one stratum
                up. It deals from the same flat deck. And per this publication's own law, its stop is
                a sibling of its lever — same size, same ink, from the first pull.
              </p>
            </Beam>
            <div className={`pop-audit-machine ${zoneClosed ? 'is-closed' : ''}`}>
              <i className="pop-audit-tick tl" />
              <i className="pop-audit-tick tr" />
              <i className="pop-audit-tick bl" />
              <i className="pop-audit-tick br" />
              <span className="pop-folio">
                ZONE MACHINE · GEARING <b>{feedGrant}</b>/100 — MAGNETIC RADIUS <b>{magRadius}</b>PX
              </span>
              <div className="pop-audit-zone-btns">
                <button
                  ref={oneMoreRef}
                  className="pop-audit-zone-btn"
                  aria-disabled={zoneClosed}
                  onClick={pullOne}
                >
                  ONE MORE · もう一つ
                </button>
                <button
                  className="pop-audit-zone-btn"
                  onClick={() => {
                    if (!zoneClosed) setZoneClosed(true)
                  }}
                >
                  I'LL STOP HERE · ここで止める
                </button>
              </div>
              <div className="pop-audit-tray" aria-live="polite">
                {pulls.slice(-5).map((txt, i) => (
                  <div key={pulls.length - 5 + i} className="pop-audit-pull-item">
                    PULL {pad(pulls.length - Math.min(pulls.length, 5) + i + 1)} — {txt}
                  </div>
                ))}
              </div>
              <div className="pop-audit-zone-meta">
                <span className="pop-folio">
                  PULLS: <b>{pad(pulls.length)}</b>
                </span>
                <span className="pop-folio">
                  {zoneClosed ? (
                    <span className="pop-audit-stamp">CLOSED BY THE READER · 読者による閉鎖</span>
                  ) : (
                    'THE MACHINE IS OPEN.'
                  )}
                </span>
              </div>
            </div>
          </section>

          <section
            className="pop-audit-stratum"
            ref={(el) => {
              stratumRefs.current.floor = el
            }}
          >
            <span className="pop-folio pop-audit-kicker">THE FLOOR — THE RECONCILIATION · 決算</span>
            <h3 className="pop-audit-h">Declared, against revealed.</h3>
            <p className="pop-audit-jp">申告と実際 — 差額がこの号の答え</p>
            <Beam registry={beamRegistry}>
              <p>
                Every treasury ends in a reconciliation. Below is what this session measured of your
                hands and your dwell — counted in this window, kept by no one, erased on reload. The
                last line sets your declaration against your behavior. The gap, whatever its size and
                sign, is the issue.
              </p>
            </Beam>
            <div className="pop-audit-receipt">
              <i className="pop-audit-tick tl" />
              <i className="pop-audit-tick tr" />
              <i className="pop-audit-tick bl" />
              <i className="pop-audit-tick br" />
              <table aria-label="The reconciliation receipt">
                <tbody>
                  <tr>
                    <td>SESSION CLOCK</td>
                    <td>{meter.clock}</td>
                  </tr>
                  {STRATA.map((s) => (
                    <tr key={s.key}>
                      <td>DWELL — {s.label}</td>
                      <td>
                        <i className="pop-audit-rbar" style={{ width: (meter.shares[s.key] ?? 0) * 1.4 }} />
                        {meter.shares[s.key] ?? 0}%
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td>CARDS SET ASIDE BY HAND</td>
                    <td>{passed}</td>
                  </tr>
                  <tr>
                    <td>WORDS OF THE CLAIM INKED</td>
                    <td>
                      {maxInked} / {claimWords.length}
                    </td>
                  </tr>
                  <tr>
                    <td>PULLS TAKEN IN THE ZONE</td>
                    <td>{pulls.length}</td>
                  </tr>
                  <tr>
                    <td>THE ZONE WAS</td>
                    <td>{zoneClosed ? 'CLOSED BY YOU' : 'LEFT OPEN'}</td>
                  </tr>
                  <tr>
                    <td>DECLARED TO THE FEED</td>
                    <td>
                      {feedGrant} / 100 UNITS {sealed ? '(SEALED)' : '(UNSEALED)'}
                    </td>
                  </tr>
                  <tr>
                    <td>REVEALED TO THE FEED*</td>
                    <td>{revealed}%</td>
                  </tr>
                </tbody>
              </table>
              <p className="pop-folio" style={{ margin: '12px 0 0' }}>
                *REVEALED = YOUR DWELL IN THE WEALTH + THE ZONE, AS A SHARE OF THIS SESSION. THE ONLY
                LINE THIS AUDIT DARES RECONCILE.
              </p>
            </div>
            <p className="pop-audit-verdict">
              {sealed && totalRef.current > 20000 ? (
                <>
                  You granted the feed <b>{feedGrant} of 100 units</b>. This session, it took{' '}
                  <b>{revealed}%</b> of you. The gap is {gap > 0 ? '+' : ''}
                  {gap} — and the gap, not the feed, is the issue.{' '}
                  <b>The ledger holds no grudge and keeps no copy.</b>
                </>
              ) : (
                <>
                  The reconciliation writes itself as you read. Scroll back up, spend differently, and
                  watch it re-ink — <b>the ledger holds no grudge and keeps no copy.</b>
                </>
              )}
            </p>
            <p className="pop-folio">
              RELOAD ERASES EVERYTHING. PRINT THIS PAGE TO KEEP YOUR RECEIPT — PAPER IS THE ONLY
              PERSISTENCE THIS TREASURY OFFERS.
            </p>
            <p className="pop-audit-note">{spread.auditNote}</p>
          </section>

          {spread.pullQuote && (
            <blockquote className="pop-audit-pullquote">
              <p className="pop-audit-pullquote-text">“{spread.pullQuote.text}”</p>
              <cite className="pop-folio">— {spread.pullQuote.attribution}</cite>
            </blockquote>
          )}

          {spread.references && (
            <footer className="pop-audit-references">
              <span className="pop-folio">{spread.references.kicker || 'WORKS CITED · 参考文献'}</span>
              <ol className="pop-audit-references-list">
                {spread.references.items.map((ref, idx) => (
                  <li key={idx} className="pop-audit-reference-item">
                    <strong>{ref.authors}</strong> ({ref.year}). <em>{ref.title}</em>.{' '}
                    {ref.journal && `${ref.journal}.`}
                  </li>
                ))}
              </ol>
            </footer>
          )}
        </div>
      </div>
    </section>
  )
}
