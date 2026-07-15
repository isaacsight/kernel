import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import type { FourierSpread, IssueRecord } from '../content/issues'
import { resolveAccentHex } from '../content/issues/accents'
import { PopShape } from './ornaments'
import './FourierFeature.css'
import './IssueAccent.css'

interface FourierFeatureProps {
  spread: FourierSpread
  issue: IssueRecord
}

const MAX_HARMONICS = 24
const BASE_FREQ = 130.81 // C3

// Timer-robust step (interaction-language rule 3 as amended): rAF
// provably stalls in throttled/background tabs and embedded panes,
// so every frame advances via a rAF-vs-setTimeout race.
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

export function FourierFeature({ spread, issue }: FourierFeatureProps) {
  const [waveform, setWaveform] = useState(spread.defaultWaveform)
  const [harmonicsCount, setHarmonicsCount] = useState(spread.defaultHarmonicsCount)
  const [inharmonicity, setInharmonicity] = useState(spread.defaultInharmonicity)
  const [phases, setPhases] = useState<number[]>(() => Array(MAX_HARMONICS).fill(0))
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.02) // Safe default (max 0.05)
  const [tally, setTally] = useState({ clicks: 0, scrubs: 0, plays: 0 })

  const constellationCanvasRef = useRef<HTMLCanvasElement>(null)
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const oscillatorsRef = useRef<{ osc: OscillatorNode; gain: GainNode }[]>([])
  const masterGainRef = useRef<GainNode | null>(null)
  const timeRef = useRef(0)
  const dragTargetRef = useRef<number | null>(null) // index of harmonic being dragged

  const accentHex = resolveAccentHex(issue.accent || spread.stock || 'tomato')
  const accentStyle = { '--issue-accent-base': accentHex } as CSSProperties
  const stockClass = spread.stock ? `pop-stock-${spread.stock}` : 'pop-stock-cream'

  // ─── Mathematical Weights ────────────────────────────────────────────────
  const getHarmonicWeight = (n: number, type: typeof waveform): number => {
    switch (type) {
      case 'sine':
        return n === 1 ? 1 : 0
      case 'sawtooth':
        return 1 / n
      case 'square':
        return n % 2 !== 0 ? 1 / n : 0
      case 'triangle':
        return n % 2 !== 0 ? (Math.pow(-1, (n - 1) / 2) / (n * n)) : 0
      default:
        return 0
    }
  }

  // Get stretched frequency for partial n
  const getFrequency = (n: number, B: number): number => {
    return n * BASE_FREQ * Math.sqrt(1 + B * n * n)
  }

  // ─── Audio Synthesis ──────────────────────────────────────────────────────
  const initAudio = () => {
    if (audioContextRef.current) return
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    const ctx = new AudioContextClass()
    audioContextRef.current = ctx

    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0, ctx.currentTime)
    masterGain.connect(ctx.destination)
    masterGainRef.current = masterGain

    // Create oscillator bank
    const bank = []
    for (let i = 1; i <= MAX_HARMONICS; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(getFrequency(i, inharmonicity), ctx.currentTime)
      gain.gain.setValueAtTime(0, ctx.currentTime)

      osc.connect(gain)
      gain.connect(masterGain)
      osc.start()

      bank.push({ osc, gain })
    }
    oscillatorsRef.current = bank
  }

  const updateAudioNode = () => {
    if (!audioContextRef.current || !masterGainRef.current) return
    const ctx = audioContextRef.current

    // Update master gain
    masterGainRef.current.gain.setTargetAtTime(isPlaying ? volume : 0, ctx.currentTime, 0.05)

    // Update each partial oscillator
    oscillatorsRef.current.forEach((node, idx) => {
      const n = idx + 1
      const isHarmonicActive = n <= harmonicsCount
      const rawWeight = getHarmonicWeight(n, waveform)
      const targetGain = isHarmonicActive ? rawWeight * 0.5 : 0 // Scale down to prevent clipping

      node.osc.frequency.setTargetAtTime(getFrequency(n, inharmonicity), ctx.currentTime, 0.05)
      node.gain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.05)
    });
  }

  useEffect(() => {
    updateAudioNode()
  }, [waveform, harmonicsCount, inharmonicity, isPlaying, volume])

  useEffect(() => {
    return () => {
      // Clean up audio context
      if (oscillatorsRef.current.length > 0) {
        oscillatorsRef.current.forEach(node => {
          try { node.osc.stop() } catch (e) {}
          node.osc.disconnect()
          node.gain.disconnect()
        })
        oscillatorsRef.current = []
      }
      if (masterGainRef.current) {
        masterGainRef.current.disconnect()
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  const togglePlayback = () => {
    initAudio()
    setIsPlaying(playing => !playing)
    setTally(t => ({ ...t, plays: t.plays + 1 }))
    // Resume audio context if suspended (browser security)
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume()
    }
  }

  // ─── Drawing Loop ─────────────────────────────────────────────────────────
  const draw = () => {
    const constCanvas = constellationCanvasRef.current
    const waveCanvas = waveformCanvasRef.current
    if (!constCanvas || !waveCanvas) return

    const cc = constCanvas.getContext('2d')
    const wc = waveCanvas.getContext('2d')
    if (!cc || !wc) return

    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!isReduced) {
      timeRef.current += 0.015 // Increment time for active motion
    }

    const dpr = window.devicePixelRatio || 1
    const cw = constCanvas.clientWidth * dpr
    const ch = constCanvas.clientHeight * dpr
    const ww = waveCanvas.clientWidth * dpr
    const wh = waveCanvas.clientHeight * dpr

    if (constCanvas.width !== cw || constCanvas.height !== ch) {
      constCanvas.width = cw
      constCanvas.height = ch
    }
    if (waveCanvas.width !== ww || waveCanvas.height !== wh) {
      waveCanvas.width = ww
      waveCanvas.height = wh
    }

    // setTransform is absolute — the context transform persists across
    // frames, so a per-frame scale() would compound geometrically.
    cc.setTransform(dpr, 0, 0, dpr, 0, 0)
    wc.setTransform(dpr, 0, 0, dpr, 0, 0)

    const cW = constCanvas.clientWidth
    const cH = constCanvas.clientHeight
    const wW = waveCanvas.clientWidth
    const wH = waveCanvas.clientHeight

    // Resolve colors from computed styles for correct theme support
    const style = getComputedStyle(constCanvas)
    const strokeColor = style.getPropertyValue('--issue-accent-base').trim() || '#E24E1B'
    const inkColor = style.getPropertyValue('--rubin-slate').trim() || '#3F3D3A'
    const muteColor = style.getPropertyValue('--rubin-border').trim() || '#d8d4cf'

    cc.clearRect(0, 0, cW, cH)
    wc.clearRect(0, 0, wW, wH)

    // Center constellation at (cW / 2, cH / 2)
    const cx = cW / 2
    const cy = cH / 2
    const baseScale = Math.min(cW, cH) * 0.35

    // ─── Draw Constellation (Phasors) ───────────────────────────────────────
    let px = cx
    let py = cy
    cc.lineWidth = 1
    cc.strokeStyle = muteColor

    // Accumulate sum points to draw the final tracing orbit path
    const orbitPoints: [number, number][] = []
    const orbitSteps = 200
    for (let step = 0; step <= orbitSteps; step++) {
      const evalTime = timeRef.current + (step / orbitSteps) * Math.PI * 2
      let tx = cx
      let ty = cy
      for (let i = 1; i <= harmonicsCount; i++) {
        const w = getHarmonicWeight(i, waveform)
        if (w === 0) continue
        const stretch = Math.sqrt(1 + inharmonicity * i * i)
        const angle = i * stretch * evalTime + phases[i - 1]
        tx += w * Math.sin(angle) * baseScale * 0.6
        ty += w * Math.cos(angle) * baseScale * 0.6
      }
      orbitPoints.push([tx, ty])
    }

    // Draw orbiting trail
    cc.beginPath()
    cc.strokeStyle = strokeColor
    cc.lineWidth = 1.5
    orbitPoints.forEach(([x, y], idx) => {
      if (idx === 0) cc.moveTo(x, y)
      else cc.lineTo(x, y)
    })
    cc.stroke()

    // Draw vector circles and arms
    px = cx
    py = cy
    cc.lineWidth = 1
    for (let i = 1; i <= harmonicsCount; i++) {
      const w = getHarmonicWeight(i, waveform)
      if (w === 0) continue
      const stretch = Math.sqrt(1 + inharmonicity * i * i)
      const angle = i * stretch * timeRef.current + phases[i - 1]
      // Signed amplitude moves the vector (a negative Fourier weight is a
      // phase inversion); the orbit circle's radius must be its magnitude —
      // arc() throws IndexSizeError on negative radii (triangle partials).
      const amp = w * baseScale * 0.6
      const r = Math.abs(amp)

      // Orbit circle
      cc.beginPath()
      cc.strokeStyle = muteColor
      cc.arc(px, py, r, 0, Math.PI * 2)
      cc.stroke()

      // Vector hand
      const nextX = px + amp * Math.sin(angle)
      const nextY = py + amp * Math.cos(angle)
      cc.beginPath()
      cc.strokeStyle = inkColor
      cc.moveTo(px, py)
      cc.lineTo(nextX, nextY)
      cc.stroke()

      // Vector joint
      cc.fillStyle = strokeColor
      cc.beginPath()
      cc.arc(nextX, nextY, 2, 0, Math.PI * 2)
      cc.fill()

      px = nextX
      py = nextY
    }

    // ─── Draw Waveform Plot ─────────────────────────────────────────────────
    wc.strokeStyle = muteColor
    wc.lineWidth = 0.5
    wc.beginPath()
    wc.moveTo(0, wH / 2)
    wc.lineTo(wW, wH / 2)
    wc.stroke()

    // Plot waveform path
    wc.beginPath()
    wc.strokeStyle = strokeColor
    wc.lineWidth = 2
    for (let x = 0; x < wW; x++) {
      const t = timeRef.current + (x / wW) * Math.PI * 4 // Show 2 full cycles
      let ySum = 0
      let maxScale = 0
      for (let i = 1; i <= harmonicsCount; i++) {
        const w = getHarmonicWeight(i, waveform)
        if (w === 0) continue
        const stretch = Math.sqrt(1 + inharmonicity * i * i)
        const angle = i * stretch * t + phases[i - 1]
        ySum += w * Math.sin(angle)
        maxScale += w
      }
      // Normalize height mapping
      const val = maxScale > 0 ? (ySum / maxScale) * (wH * 0.35) : 0
      const plotY = wH / 2 - val
      if (x === 0) wc.moveTo(x, plotY)
      else wc.lineTo(x, plotY)
    }
    wc.stroke()
  }

  useEffect(() => {
    let alive = true
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const loop = () => {
      if (!alive) return
      draw()
      // Reduced motion: render the current state once, then rest.
      // Control changes re-run this effect and redraw.
      if (!isReduced) tick(loop)
    }
    loop()
    return () => {
      alive = false
    }
  }, [waveform, harmonicsCount, inharmonicity, phases])

  // ─── Interactive Phase Dragging ───────────────────────────────────────────
  const getPointerPolar = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = constellationCanvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left - rect.width / 2
    const y = event.clientY - rect.top - rect.height / 2
    const angle = Math.atan2(x, y) // Orient correctly to standard phasor loop
    const radius = Math.sqrt(x * x + y * y)
    return { angle, radius, width: rect.width }
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const polar = getPointerPolar(event)
    if (!polar) return
    event.currentTarget.setPointerCapture(event.pointerId)

    // Identify which harmonic radius the click matches closest
    const baseScale = polar.width * 0.35
    let bestIdx = 0
    let bestDiff = Infinity

    let currentRadius = 0
    for (let i = 1; i <= harmonicsCount; i++) {
      const w = getHarmonicWeight(i, waveform)
      if (w === 0) continue
      currentRadius += Math.abs(w) * baseScale * 0.6
      const diff = Math.abs(polar.radius - currentRadius)
      if (diff < bestDiff && diff < 30) { // Click within 30px target range
        bestDiff = diff
        bestIdx = i
      }
    }

    if (bestIdx > 0) {
      dragTargetRef.current = bestIdx
      setTally(t => ({ ...t, scrubs: t.scrubs + 1 }))
    }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (dragTargetRef.current === null) return
    const polar = getPointerPolar(event)
    if (!polar) return

    const idx = dragTargetRef.current
    const stretch = Math.sqrt(1 + inharmonicity * idx * idx)
    // Compute current angle relative to the animation cycle
    const targetPhase = polar.angle - idx * stretch * timeRef.current

    setPhases(current => {
      const next = [...current]
      next[idx - 1] = targetPhase
      return next
    })
  }

  const handlePointerUp = () => {
    dragTargetRef.current = null
  }

  const resetPhases = () => {
    setPhases(Array(MAX_HARMONICS).fill(0))
    setTally(t => ({ ...t, clicks: t.clicks + 1 }))
  }

  return (
    <section className={`pop-fourier ${stockClass}`} style={accentStyle} aria-labelledby="pop-fourier-title">
      <div className="pop-fourier-inner">
        <header className="pop-fourier-header">
          <div className="pop-fourier-masthead">
            <span className="pop-folio">{spread.kicker}</span>
            <h2 id="pop-fourier-title" className="pop-display pop-fourier-title">{spread.title}</h2>
            <p className="pop-feature-jp pop-fourier-title-jp">{spread.titleJp}</p>
            <p className="pop-swash pop-fourier-deck">{spread.deck}</p>
            <p className="pop-folio pop-fourier-byline">{spread.byline}</p>
          </div>

          <aside className="pop-fourier-dossier" aria-label={spread.dossier.kicker}>
            <div className="pop-fourier-dossier-frame">
              <PopShape name="lozenge" size="md" color="tomato" className="pop-fourier-dossier-badge" />
              <span className="pop-folio pop-fourier-dossier-kicker">{spread.dossier.kicker}</span>
              {spread.dossier.note && <p className="pop-fourier-dossier-note">{spread.dossier.note}</p>}
              <dl className="pop-fourier-dossier-list">
                {spread.dossier.items.map((item, idx) => (
                  <div key={idx} className="pop-fourier-dossier-row">
                    <dt className="pop-folio pop-fourier-dossier-label">{item.label}</dt>
                    <dd className="pop-fourier-dossier-value">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        </header>

        {spread.intro && (
          <article className="pop-fourier-prose">
            {spread.intro.map((sect, idx) => (
              <section key={idx} className="pop-fourier-section">
                <h3 className="pop-fourier-section-heading">
                  {sect.heading}
                  {sect.headingJp && <span className="pop-fourier-section-heading-jp">{sect.headingJp}</span>}
                </h3>
                {sect.paragraphs.map((p, pIdx) => (
                  <p key={pIdx} className="pop-fourier-paragraph">{p}</p>
                ))}
              </section>
            ))}
          </article>
        )}

        <div className="pop-fourier-rig">
          <header className="pop-fourier-rig-kicker-line">
            <span className="pop-folio">{spread.fourierKicker || 'THE HARMONIC SUMMATION · 倍音合成'}</span>
            <span className="pop-folio pop-fourier-rig-hint">{spread.fourierHint || 'DRAG CONSTELLATION CIRCLES TO SHIFT PHASES'}</span>
          </header>

          <div className="pop-fourier-stage">
            <div className="pop-fourier-canvas-wrap">
              <div className="pop-fourier-canvas-container">
                <span className="pop-folio pop-fourier-canvas-label">PHASOR CONSTELLATION · ベクトル軌道</span>
                <canvas
                  ref={constellationCanvasRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  aria-label="Interactive phasor orbital constellation canvas. Drag circles to adjust harmonic phase shifts."
                />
              </div>
              <div className="pop-fourier-canvas-container">
                <span className="pop-folio pop-fourier-canvas-label">SYNTHESIZED WAVEFORM · 合成波形</span>
                <canvas
                  ref={waveformCanvasRef}
                  aria-label="Time domain rendering of the synthesized fourier waveform sum."
                />
              </div>
            </div>

            <div className="pop-fourier-controls">
              <div className="pop-fourier-control-group">
                <span className="pop-folio pop-fourier-control-label">BASE WAVEFORM · 基本波</span>
                <div className="pop-fourier-buttons" role="radiogroup" aria-label="Select base oscillator shape">
                  {(['sine', 'sawtooth', 'square', 'triangle'] as const).map(type => (
                    <button
                      key={type}
                      className={waveform === type ? 'active' : ''}
                      role="radio"
                      aria-checked={waveform === type}
                      onClick={() => { setWaveform(type); setTally(t => ({ ...t, clicks: t.clicks + 1 })) }}
                    >
                      {type.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pop-fourier-control-group">
                <label className="pop-folio pop-fourier-control-label" htmlFor="harmonics-slider">
                  PARTIALS (N) · 倍音数: <strong>{harmonicsCount}</strong>
                </label>
                <input
                  id="harmonics-slider"
                  type="range"
                  min="1"
                  max={MAX_HARMONICS}
                  value={harmonicsCount}
                  onChange={e => { setHarmonicsCount(Number(e.target.value)); setTally(t => ({ ...t, scrubs: t.scrubs + 1 })) }}
                  aria-valuemin={1}
                  aria-valuemax={MAX_HARMONICS}
                  aria-valuenow={harmonicsCount}
                />
              </div>

              <div className="pop-fourier-control-group">
                <label className="pop-folio pop-fourier-control-label" htmlFor="inharmonicity-slider">
                  INHARMONICITY (B) · 非調和: <strong>{inharmonicity.toFixed(3)}</strong>
                </label>
                <input
                  id="inharmonicity-slider"
                  type="range"
                  min="0"
                  max="0.2"
                  step="0.005"
                  value={inharmonicity}
                  onChange={e => { setInharmonicity(Number(e.target.value)); setTally(t => ({ ...t, scrubs: t.scrubs + 1 })) }}
                  aria-valuemin={0}
                  aria-valuemax={0.2}
                  aria-valuenow={inharmonicity}
                />
              </div>

              <div className="pop-fourier-audio-controls">
                <button className={`pop-fourier-audio-btn ${isPlaying ? 'is-playing' : ''}`} onClick={togglePlayback}>
                  <span>{isPlaying ? 'MUTE · 消音' : 'HEAR THE SUM · 音声を聴く'}</span>
                  <i aria-hidden="true">{isPlaying ? '■' : '▶'}</i>
                </button>

                {isPlaying && (
                  <div className="pop-fourier-volume-control">
                    <label className="pop-folio" htmlFor="volume-slider">VOLUME</label>
                    <input
                      id="volume-slider"
                      type="range"
                      min="0.005"
                      max="0.05"
                      step="0.005"
                      value={volume}
                      onChange={e => setVolume(Number(e.target.value))}
                    />
                  </div>
                )}

                <button className="pop-fourier-reset-btn" onClick={resetPhases}>
                  RESET PHASES · 位相リセット
                </button>
              </div>
            </div>
          </div>

          <footer className="pop-fourier-ledger">
            <span className="pop-folio">SESSION RECORD · 記録簿 (CLIENT STATE ONLY)</span>
            <div className="pop-fourier-ledger-stats">
              <span>WAVE ADJUSTMENTS: <strong>{String(tally.clicks).padStart(2, '0')}</strong></span>
              <span>SLIDER TANGENTS: <strong>{String(tally.scrubs).padStart(2, '0')}</strong></span>
              <span>SYNTH PROFILES PULLED: <strong>{String(tally.plays).padStart(2, '0')}</strong></span>
            </div>
            <p className="pop-fourier-ledger-note">{spread.fourierNote}</p>
          </footer>
        </div>

        {spread.outro && (
          <article className="pop-fourier-prose pop-fourier-outro">
            {spread.outro.map((sect, idx) => (
              <section key={idx} className="pop-fourier-section">
                <h3 className="pop-fourier-section-heading">
                  {sect.heading}
                  {sect.headingJp && <span className="pop-fourier-section-heading-jp">{sect.headingJp}</span>}
                </h3>
                {sect.paragraphs.map((p, pIdx) => (
                  <p key={pIdx} className="pop-fourier-paragraph">{p}</p>
                ))}
              </section>
            ))}
          </article>
        )}

        {spread.pullQuote && (
          <blockquote className="pop-fourier-pullquote">
            <p className="pop-fourier-pullquote-text">“{spread.pullQuote.text}”</p>
            <cite className="pop-folio pop-fourier-pullquote-cite">— {spread.pullQuote.attribution}</cite>
          </blockquote>
        )}

        {spread.references && (
          <footer className="pop-fourier-references">
            <span className="pop-folio">{spread.references.kicker || 'WORKS CITED · 参考文献'}</span>
            <ol className="pop-fourier-references-list">
              {spread.references.items.map((ref, idx) => (
                <li key={idx} className="pop-fourier-reference-item">
                  <strong>{ref.authors}</strong> ({ref.year}). <em>{ref.title}</em>. {ref.journal && `${ref.journal}.`}
                </li>
              ))}
            </ol>
          </footer>
        )}
      </div>
    </section>
  )
}
