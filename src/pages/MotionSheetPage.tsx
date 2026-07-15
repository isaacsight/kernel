import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import './MotionSheetPage.css'

type ArtifactProps = {
  number: string
  title: string
  cue: string
  className?: string
  children: ReactNode
}

function Artifact({ number, title, cue, className = '', children }: ArtifactProps) {
  return (
    <article id={`specimen-${number}`} data-specimen={number} className={`motion-artifact ${className}`}>
      <header className="artifact-head">
        <span>{number}</span>
        <h2>{title}</h2>
        <p><i aria-hidden="true" />{cue}</p>
      </header>
      <div className="artifact-stage">{children}</div>
    </article>
  )
}

function MagneticDispatch() {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [sent, setSent] = useState(false)

  const move = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left - rect.width / 2) * 0.18
    const y = (event.clientY - rect.top - rect.height / 2) * 0.18
    event.currentTarget.style.transform = `translate3d(${x}px, ${y}px, 0)`
  }

  const reset = () => {
    if (buttonRef.current) buttonRef.current.style.transform = ''
  }

  return (
    <button
      ref={buttonRef}
      className={`magnetic-dispatch ${sent ? 'is-sent' : ''}`}
      onPointerMove={move}
      onPointerLeave={reset}
      onClick={() => { setSent(true); window.setTimeout(() => setSent(false), 1300) }}
    >
      <span className="dispatch-copy">{sent ? 'DISPATCHED' : 'SEND A SIGNAL'}</span>
      <span className="dispatch-arrow" aria-hidden="true">↗</span>
      <span className="dispatch-ripple" aria-hidden="true" />
    </button>
  )
}

function DragProof() {
  const cardRef = useRef<HTMLDivElement>(null)
  const drag = useRef({ active: false, startX: 0, startY: 0, x: 0, y: 0 })

  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { ...drag.current, active: true, startX: event.clientX - drag.current.x, startY: event.clientY - drag.current.y }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.classList.add('is-dragging')
  }
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current.active || !cardRef.current) return
    const bounds = event.currentTarget.parentElement!.getBoundingClientRect()
    const x = Math.max(-bounds.width * .28, Math.min(bounds.width * .28, event.clientX - drag.current.startX))
    const y = Math.max(-bounds.height * .22, Math.min(bounds.height * .22, event.clientY - drag.current.startY))
    drag.current.x = x
    drag.current.y = y
    cardRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${x * .035}deg)`
  }
  const up = (event: ReactPointerEvent<HTMLDivElement>) => {
    drag.current.active = false
    drag.current.x = 0
    drag.current.y = 0
    event.currentTarget.classList.remove('is-dragging')
    event.currentTarget.style.transform = ''
  }

  return (
    <div className="proof-desk">
      <div className="proof-shadow proof-shadow-one" />
      <div className="proof-shadow proof-shadow-two" />
      <div ref={cardRef} className="proof-card" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <span className="proof-kicker">FIELD NOTE / 023</span>
        <strong>THE CITY<br/>IS A PROMPT.</strong>
        <small>Drag the proof away from the stack.</small>
      </div>
    </div>
  )
}

function WordScrub() {
  const [value, setValue] = useState(46)
  const words = ['NOTICE', 'QUESTION', 'REFUSE', 'REWRITE', 'SHIP']
  const index = Math.min(words.length - 1, Math.floor(value / (100 / words.length)))
  return (
    <div className="word-scrub">
      <span className="scrub-ghost" aria-hidden="true">{words[(index + words.length - 1) % words.length]}</span>
      <div className="scrub-word" key={words[index]}>{words[index]}</div>
      <span className="scrub-next" aria-hidden="true">{words[(index + 1) % words.length]}</span>
      <label>
        <span>EARLY</span>
        <input aria-label="Scrub through verbs" type="range" min="0" max="99" value={value} onChange={event => setValue(Number(event.target.value))} />
        <span>LATE</span>
      </label>
    </div>
  )
}

function SpotlightNote() {
  const noteRef = useRef<HTMLDivElement>(null)
  const spotRef = useRef<HTMLSpanElement>(null)
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    spotRef.current?.style.setProperty('transform', `translate3d(${event.clientX - rect.left}px, ${event.clientY - rect.top}px, 0)`)
  }
  return (
    <div ref={noteRef} className="spotlight-note" onPointerMove={move}>
      <span ref={spotRef} className="darkroom-spot" aria-hidden="true" />
      <p>Most systems ask what you want to make.</p>
      <strong>Better systems notice<br/>what you keep refusing.</strong>
      <span>MOVE TO DEVELOP</span>
    </div>
  )
}

function StampSwitch() {
  const [active, setActive] = useState<'field' | 'after'>('field')
  return (
    <div className="stamp-switch">
      <div className={`stamp-copy ${active === 'after' ? 'is-after' : ''}`}>
        <span>{active === 'field' ? 'OBSERVED 07:42' : 'REVISED 23:18'}</span>
        <strong>{active === 'field' ? 'THE MORNING VERSION' : 'THE VERSION THAT STAYED'}</strong>
      </div>
      <div className="stamp-tabs" role="group" aria-label="Select note state">
        <button className={active === 'field' ? 'active' : ''} onClick={() => setActive('field')}>FIELD</button>
        <button className={active === 'after' ? 'active' : ''} onClick={() => setActive('after')}>AFTER</button>
        <i aria-hidden="true" className={active === 'after' ? 'right' : ''}>VII·26</i>
      </div>
    </div>
  )
}

function IssueShuffle() {
  const [front, setFront] = useState(0)
  const cards = [
    ['418', 'ONE DAY.', 'JUL 2026'],
    ['417', 'PROOF OF HANDS', 'JUN 2026'],
    ['416', 'SOFT MACHINES', 'MAY 2026'],
  ]
  return (
    <button className="issue-stack" onClick={() => setFront((front + 1) % cards.length)} aria-label="Shuffle back issues">
      {cards.map((card, index) => {
        const place = (index - front + cards.length) % cards.length
        return (
          <span
            key={card[0]}
            className={`issue-card ${place === 0 ? 'is-front' : ''}`}
            style={{
              transform: `translate(${place * 17}px, ${place * -13}px) rotate(${(place - 1) * 3}deg)`,
              zIndex: 5 - place,
            } as CSSProperties}
          >
            <small>ISSUE {card[0]}</small><strong>{card[1]}</strong><em>{card[2]}</em>
          </span>
        )
      })}
      <span className="shuffle-cue">CLICK TO SHUFFLE ↻</span>
    </button>
  )
}

function ReadingRail() {
  const railRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(22)
  const onScroll = () => {
    const element = railRef.current
    if (!element) return
    const max = element.scrollHeight - element.clientHeight
    setProgress(max ? (element.scrollTop / max) * 100 : 0)
  }
  return (
    <div className="reading-rail-wrap">
      <div className="reading-progress"><i style={{ height: `${progress}%` }} /></div>
      <div ref={railRef} className="reading-rail" onScroll={onScroll} tabIndex={0}>
        <p>01 — A city is a collection of shortcuts someone forgot to document.</p>
        <p>02 — Every interface has an opinion about your attention.</p>
        <p>03 — The quietest tools leave the deepest fingerprints.</p>
        <p>04 — A refusal is still a form of authorship.</p>
        <p>05 — Tomorrow arrives as a software update.</p>
      </div>
      <span className="rail-count">{String(Math.round(progress)).padStart(2, '0')}%</span>
    </div>
  )
}

function TypeSignal() {
  const [text, setText] = useState('')
  return (
    <div className="type-signal">
      <label htmlFor="signal-input">TRANSMISSION</label>
      <input id="signal-input" value={text} maxLength={36} placeholder="TYPE SOMETHING TRUE" onChange={event => setText(event.target.value.toUpperCase())} />
      <div className="signal-echo" aria-hidden="true">
        <span>{text || 'YOUR WORDS WILL ECHO'}</span>
        <span>{text || 'YOUR WORDS WILL ECHO'}</span>
        <span>{text || 'YOUR WORDS WILL ECHO'}</span>
      </div>
      <small>{String(text.length).padStart(2, '0')} / 36</small>
    </div>
  )
}

function FourierConstellationSpecimen() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [type, setType] = useState<'sine' | 'sawtooth' | 'square' | 'triangle'>('sawtooth')
  const timeRef = useRef(0)
  const animRef = useRef<number | null>(null)

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!isReduced) {
        timeRef.current += 0.02
      }

      const dpr = window.devicePixelRatio || 1
      const size = canvas.clientWidth * dpr
      if (canvas.width !== size || canvas.height !== size) {
        canvas.width = size
        canvas.height = size
      }
      ctx.scale(dpr, dpr)

      const w = canvas.clientWidth
      const h = canvas.clientHeight
      ctx.clearRect(0, 0, w, h)

      const style = getComputedStyle(canvas)
      const accent = style.getPropertyValue('--issue-accent-base').trim() || '#E24E1B'
      const ink = style.getPropertyValue('--rubin-slate').trim() || '#3F3D3A'
      const mute = style.getPropertyValue('--rubin-border').trim() || '#d8d4cf'

      const cx = w / 2
      const cy = h / 2
      const baseScale = Math.min(w, h) * 0.35

      const getWeight = (n: number) => {
        if (type === 'sine') return n === 1 ? 1 : 0
        if (type === 'sawtooth') return 1 / n
        if (type === 'square') return n % 2 !== 0 ? 1 / n : 0
        if (type === 'triangle') return n % 2 !== 0 ? (Math.pow(-1, (n - 1) / 2) / (n * n)) : 0
        return 0
      }

      // Draw trail
      const orbitPoints: [number, number][] = []
      const steps = 120
      for (let s = 0; s <= steps; s++) {
        const t = timeRef.current + (s / steps) * Math.PI * 2
        let tx = cx
        let ty = cy
        for (let i = 1; i <= 8; i++) {
          const wt = getWeight(i)
          if (wt === 0) continue
          const angle = i * t
          tx += wt * Math.sin(angle) * baseScale * 0.8
          ty += wt * Math.cos(angle) * baseScale * 0.8
        }
        orbitPoints.push([tx, ty])
      }

      ctx.beginPath()
      ctx.strokeStyle = accent
      ctx.lineWidth = 1.5
      orbitPoints.forEach(([x, y], idx) => {
        if (idx === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()

      // Draw vectors
      let px = cx
      let py = cy
      ctx.lineWidth = 0.75
      for (let i = 1; i <= 8; i++) {
        const wt = getWeight(i)
        if (wt === 0) continue
        const angle = i * timeRef.current
        const r = wt * baseScale * 0.8

        ctx.beginPath()
        ctx.strokeStyle = mute
        ctx.arc(px, py, r, 0, Math.PI * 2)
        ctx.stroke()

        const nx = px + r * Math.sin(angle)
        const ny = py + r * Math.cos(angle)

        ctx.beginPath()
        ctx.strokeStyle = ink
        ctx.moveTo(px, py)
        ctx.lineTo(nx, ny)
        ctx.stroke()

        px = nx
        py = ny
      }

      ctx.fillStyle = accent
      ctx.beginPath()
      ctx.arc(px, py, 2.5, 0, Math.PI * 2)
      ctx.fill()

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [type])

  return (
    <div className="fourier-specimen">
      <canvas ref={canvasRef} aria-label="Animated fourier orbital vector orbits" />
      <div className="fourier-specimen-controls">
        {(['sine', 'sawtooth', 'square', 'triangle'] as const).map(w => (
          <button key={w} className={type === w ? 'active' : ''} onClick={() => setType(w)}>
            {w.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  )
}

export function MotionSheetPage() {
  const [activeArtifact, setActiveArtifact] = useState('01')
  const [motionEnabled, setMotionEnabled] = useState(true)
  const progressRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    document.body.classList.add('motion-sheet-body')
    return () => document.body.classList.remove('motion-sheet-body')
  }, [])

  useEffect(() => {
    document.body.classList.toggle('motion-paused', !motionEnabled)
    return () => document.body.classList.remove('motion-paused')
  }, [motionEnabled])

  useEffect(() => {
    const artifacts = Array.from(document.querySelectorAll<HTMLElement>('[data-specimen]'))
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)
      const number = visible[0]?.target.getAttribute('data-specimen')
      if (number) setActiveArtifact(number)
    }, { rootMargin: '-28% 0px -48%', threshold: [0, .2, .5] })
    artifacts.forEach(artifact => observer.observe(artifact))

    const updateProgress = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      const progress = max > 0 ? window.scrollY / max : 0
      if (progressRef.current) {
        progressRef.current.style.transform = window.innerWidth <= 760
          ? `scale3d(${progress}, 1, 1)`
          : `scale3d(1, ${progress}, 1)`
      }
    }
    window.addEventListener('scroll', updateProgress, { passive: true })
    window.addEventListener('resize', updateProgress)
    updateProgress()
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', updateProgress)
      window.removeEventListener('resize', updateProgress)
    }
  }, [])

  const jumpTo = (number: string) => document.getElementById(`specimen-${number}`)?.scrollIntoView()

  return (
    <main className="motion-sheet">
      <aside className="motion-rail" aria-label="Specimen index">
        <button className="motion-mark" onClick={() => window.scrollTo(0, 0)} aria-label="Back to top">K</button>
        <nav>
          {['01','02','03','04','05','06','07','08','09'].map(number => (
            <button key={number} className={activeArtifact === number ? 'active' : ''} aria-current={activeArtifact === number ? 'true' : undefined} onClick={() => jumpTo(number)}>{number}</button>
          ))}
        </nav>
        <button className={`motion-toggle ${motionEnabled ? '' : 'paused'}`} onClick={() => setMotionEnabled(enabled => !enabled)} aria-pressed={!motionEnabled} aria-label={motionEnabled ? 'Pause ambient motion' : 'Play ambient motion'}>
          <span aria-hidden="true">{motionEnabled ? 'Ⅱ' : '▶'}</span>
        </button>
        <i className="page-progress" aria-hidden="true"><span ref={progressRef} /></i>
      </aside>
      <header className="motion-masthead">
        <div className="motion-topline">
          <a href="#/">kernel.chat</a>
          <span>INTERACTION STUDIES · VOL. I</span>
          <span>JUL 2026 · BYOK</span>
        </div>
        <div className="motion-title-row">
          <div>
            <p>[ A FIELD GUIDE TO MOTION ]</p>
            <h1>THINGS<br/><em>THAT MOVE.</em></h1>
            <div className="hero-folio" aria-hidden="true"><span>INTERACTION</span><b>01—08</b><span>SPECIMENS</span></div>
          </div>
          <div className="motion-intro">
            <span className="motion-stamp">LIVE<br/>SPECIMENS<br/>08</span>
            <div>
              <b>THE MOTION PAPER</b>
              <p>Eight small behaviors for a magazine that lives in a browser. Poke, drag, type, scrub—nothing here is a screenshot.</p>
              <small>SCROLL TO ENTER THE LAB ↓</small>
            </div>
          </div>
        </div>
        <div className="ticker" aria-hidden="true"><div>HOVER IS A WHISPER · CLICK IS A DECISION · DRAG IS A NEGOTIATION · SCROLL IS TIME · </div></div>
      </header>

      <section className="artifact-grid" aria-label="Interactive motion artifacts">
        <Artifact number="01" title="MAGNETIC DISPATCH" cue="HOVER + PRESS" className="wide"><MagneticDispatch /></Artifact>
        <Artifact number="02" title="MOVABLE PROOF" cue="DRAG THE CARD"><DragProof /></Artifact>
        <Artifact number="03" title="VERB SCRUB" cue="MOVE THE TIMELINE"><WordScrub /></Artifact>
        <Artifact number="04" title="DARKROOM NOTE" cue="MOVE TO DEVELOP" className="wide"><SpotlightNote /></Artifact>
        <Artifact number="05" title="STAMPED STATE" cue="SWITCH THE EDIT"><StampSwitch /></Artifact>
        <Artifact number="06" title="BACK-ISSUE DECK" cue="CLICK TO SHUFFLE"><IssueShuffle /></Artifact>
        <Artifact number="07" title="READING RAIL" cue="SCROLL THE EXCERPT"><ReadingRail /></Artifact>
        <Artifact number="08" title="TYPE SIGNAL" cue="ENTER A TRANSMISSION" className="wide"><TypeSignal /></Artifact>
        <Artifact number="09" title="FOURIER SUM" cue="CHOOSE WAVEFORM" className="wide"><FourierConstellationSpecimen /></Artifact>
      </section>

      <footer className="motion-footer">
        <strong>kernel.chat</strong>
        <p>Motion should reveal structure, reward curiosity, and know when to sit still.</p>
        <div><span>END OF STUDIES · VOL. I</span><a href="#/">RETURN TO THE MAGAZINE ↗</a></div>
      </footer>
    </main>
  )
}
