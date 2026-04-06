import { useEffect, useState } from 'react'
import './SoundEngineerPage.css'

const TRACKS = [
  {
    title: 'The Sidewalk',
    file: 'The Sidewalk.mp3',
    duration: '4:52',
    date: 'Apr 2026',
    tags: ['original', 'production'],
  },
  {
    title: 'Velvet Glasswork',
    file: 'Velvet_Glasswork_DJ_Edit.mp3',
    duration: '5:10',
    date: 'Apr 2026',
    tags: ['dj edit', 'electronic'],
  },
  {
    title: 'My Room',
    file: 'My Room.mp3',
    duration: '3:24',
    date: 'Mar 2026',
    tags: ['original', 'ambient'],
  },
  {
    title: 'Runnin (Remastered)',
    artist: 'Jay2x',
    file: 'Runnin - Jay2x - Mix v1  (Remastered) x Runnin - Jay2x - Mix v1 (Mashup).mp3',
    duration: '2:41',
    date: 'Mar 2026',
    tags: ['mix', 'remaster'],
  },
  {
    title: 'Fabulous',
    file: 'fabulous.mp3',
    duration: '4:48',
    date: 'Mar 2026',
    tags: ['original', 'production'],
  },
]

const SERVICES = [
  {
    icon: '\u266B',
    title: 'Mixing',
    desc: 'Balanced, punchy mixes with clarity across every frequency. Analog warmth meets modern precision.',
  },
  {
    icon: '\u2261',
    title: 'Mastering',
    desc: 'Loud, clean masters that translate across speakers, headphones, and streaming platforms.',
  },
  {
    icon: '\u2318',
    title: 'Production',
    desc: 'Full beat production and arrangement. Trap, electronic, ambient, experimental. From scratch or from stems.',
  },
  {
    icon: '\u2699',
    title: 'Sound Design',
    desc: 'Custom synth patches, textures, and FX. Serum 2, Ableton instruments, field recordings.',
  },
  {
    icon: '\u2691',
    title: 'AI-Assisted Workflow',
    desc: 'kbot-powered production tools. Automated stem analysis, chord detection, mix referencing, and more.',
  },
  {
    icon: '\u2606',
    title: 'DJ Edits',
    desc: 'Custom edits, mashups, and transitions for live sets. Extended intros, clean drops, seamless blends.',
  },
]

const TOOL_CATEGORIES = [
  {
    label: 'DAW & Production',
    icon: '\u2318',
    tools: [
      'Ableton Live 12 Suite',
      'Serum 2',
      'Max for Live (custom devices)',
      'Splice Sounds & Samples',
    ],
  },
  {
    label: 'Plugins & Processing',
    icon: '\u2699',
    tools: [
      'Universal Audio (170+ plugins)',
      'Roland Cloud (ZENOLOGY, TR, Juno)',
      'Native Instruments (Kontakt, Massive)',
      'Spitfire LABS & BBCSO',
      'Neural DSP (amp modeling)',
      'FabFilter (Pro-Q, Pro-L, Pro-C)',
      'Soundtoys (effects)',
    ],
  },
  {
    label: 'AI-Powered Audio',
    icon: '\u2605',
    tools: [
      'iZotope Ozone / Neutron (AI mastering & mixing)',
      'Sonible smart:EQ 4 / smart:comp 2 (AI-adaptive EQ & compression)',
      'LANDR (AI mastering & distribution)',
      'Suno (AI music generation & ideation)',
      'Udio (AI composition & arrangement)',
      'Stable Audio (text-to-audio generation)',
      'AIVA (AI composition assistant)',
    ],
  },
  {
    label: 'AI Stem & Voice',
    icon: '\u266C',
    tools: [
      'LALAL.AI (AI stem separation)',
      'Demucs / Meta (neural source separation)',
      'ElevenLabs (voice synthesis & cloning)',
      'Adobe Podcast (AI speech enhancement)',
      'RX 11 (AI-powered audio repair)',
      'RAVE (real-time neural audio synthesis)',
      'Descript (AI audio editing)',
    ],
  },
  {
    label: 'kbot Sound Engine',
    icon: '\u25C8',
    tools: [
      'Ableton OSC bridge (14 tools — control Live from terminal)',
      'Programmatic Serum 2 preset generation',
      'AI chord detection & harmonic analysis',
      'Automated stem analysis & mix referencing',
      'DJ set builder (transition planning, BPM matching)',
      'PCM audio engine (oscillators, ADSR, chiptune)',
      'Magenta integration (melody, drum, harmony generation)',
      'Real-time audio visualization',
    ],
  },
  {
    label: 'Spatial & Immersive',
    icon: '\u29BF',
    tools: [
      'Dolby Atmos (immersive mixing)',
      'Apple Spatial Audio',
      'ambiX (ambisonics)',
      'DearVR (3D audio)',
      'Envelop for Live (spatial panning)',
    ],
  },
]

export function SoundEngineerPage() {
  const [playingIdx, setPlayingIdx] = useState<number | null>(null)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)
  const [progress, setProgress] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    document.body.classList.add('ka-scrollable-page')
    return () => { document.body.classList.remove('ka-scrollable-page') }
  }, [])

  useEffect(() => {
    if (!audio) return
    const update = () => {
      if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100)
    }
    const ended = () => { setPlayingIdx(null); setProgress(0) }
    audio.addEventListener('timeupdate', update)
    audio.addEventListener('ended', ended)
    return () => {
      audio.removeEventListener('timeupdate', update)
      audio.removeEventListener('ended', ended)
    }
  }, [audio])

  const togglePlay = (idx: number) => {
    if (playingIdx === idx) {
      audio?.pause()
      setPlayingIdx(null)
      return
    }
    audio?.pause()
    const a = new Audio(`/sound-engineer/${TRACKS[idx].file}`)
    a.play()
    setAudio(a)
    setPlayingIdx(idx)
    setProgress(0)
  }

  useEffect(() => {
    return () => { audio?.pause() }
  }, [audio])

  const copyEmail = () => {
    navigator.clipboard.writeText('kernel.chat@gmail.com')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="ka-sound">
      {/* Nav */}
      <nav className="ka-sound-nav">
        <a href="#/" className="ka-sound-nav-home">{'\u2190'} kernel.chat</a>
      </nav>
      {/* Hero */}
      <section className="ka-sound-hero">
        <div className="ka-sound-wave" aria-hidden="true" />
        <div className="ka-sound-badge">Sound Engineer</div>
        <h1 className="ka-sound-title">Isaac Hernandez</h1>
        <p className="ka-sound-subtitle">
          Mixing. Mastering. Production. Sound Design.
        </p>
        <p className="ka-sound-tagline">
          Southern California — Engineering sound with precision tools and AI-assisted workflows.
          Every track gets the attention it deserves.
        </p>
      </section>

      {/* Services */}
      <section className="ka-sound-section">
        <h2 className="ka-sound-h2">What I Do</h2>
        <div className="ka-sound-grid">
          {SERVICES.map(s => (
            <div key={s.title} className="ka-sound-card">
              <span className="ka-sound-card-icon" aria-hidden="true">{s.icon}</span>
              <h3 className="ka-sound-card-title">{s.title}</h3>
              <p className="ka-sound-card-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="ka-sound-divider" />

      {/* Player / Portfolio */}
      <section className="ka-sound-section">
        <h2 className="ka-sound-h2">Recent Work</h2>
        <p className="ka-sound-section-desc">
          Original productions, mixes, and remasters.
        </p>
        <div className="ka-sound-tracklist">
          {TRACKS.map((t, i) => (
            <div
              key={t.title}
              className={`ka-sound-track ${playingIdx === i ? 'ka-sound-track--playing' : ''}`}
              onClick={() => togglePlay(i)}
            >
              <div className="ka-sound-track-play">
                {playingIdx === i ? '\u275A\u275A' : '\u25B6'}
              </div>
              <div className="ka-sound-track-info">
                <span className="ka-sound-track-title">{t.title}</span>
                {t.artist && <span className="ka-sound-track-artist">{t.artist}</span>}
                <div className="ka-sound-track-tags">
                  {t.tags.map(tag => (
                    <span key={tag} className="ka-sound-track-tag">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="ka-sound-track-meta">
                <span className="ka-sound-track-duration">{t.duration}</span>
                <span className="ka-sound-track-date">{t.date}</span>
              </div>
              {playingIdx === i && (
                <div
                  className="ka-sound-track-progress"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!audio || !audio.duration) return
                    const rect = e.currentTarget.getBoundingClientRect()
                    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
                    audio.currentTime = pct * audio.duration
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation()
                    if (!audio || !audio.duration) return
                    const seek = (touch: React.Touch) => {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      const pct = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width))
                      audio.currentTime = pct * audio.duration
                    }
                    seek(e.touches[0])
                    const bar = e.currentTarget as HTMLElement
                    const onMove = (ev: TouchEvent) => { ev.preventDefault(); seek(ev.touches[0] as unknown as React.Touch) }
                    const onEnd = () => { bar.removeEventListener('touchmove', onMove); bar.removeEventListener('touchend', onEnd) }
                    bar.addEventListener('touchmove', onMove, { passive: false })
                    bar.addEventListener('touchend', onEnd)
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    if (!audio || !audio.duration) return
                    const bar = e.currentTarget as HTMLElement
                    const seek = (clientX: number) => {
                      const rect = bar.getBoundingClientRect()
                      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
                      audio.currentTime = pct * audio.duration
                    }
                    seek(e.clientX)
                    const onMove = (ev: MouseEvent) => seek(ev.clientX)
                    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
                    window.addEventListener('mousemove', onMove)
                    window.addEventListener('mouseup', onUp)
                  }}
                >
                  <div className="ka-sound-track-progress-fill" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="ka-sound-divider" />

      {/* Tools */}
      <section className="ka-sound-section ka-sound-section--wide">
        <h2 className="ka-sound-h2">Tools & AI Stack</h2>
        <p className="ka-sound-section-desc">
          Traditional production tools augmented with AI at every stage — from composition to mastering to spatial audio.
        </p>
        <div className="ka-sound-tool-grid">
          {TOOL_CATEGORIES.map(cat => (
            <div key={cat.label} className="ka-sound-tool-category">
              <div className="ka-sound-tool-cat-header">
                <span className="ka-sound-tool-cat-icon" aria-hidden="true">{cat.icon}</span>
                <h3 className="ka-sound-tool-cat-title">{cat.label}</h3>
              </div>
              <ul className="ka-sound-tool-list">
                {cat.tools.map(t => (
                  <li key={t} className="ka-sound-tool-item">{t}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <div className="ka-sound-divider" />

      {/* CTA */}
      <section className="ka-sound-cta-section">
        <h2 className="ka-sound-h2">Let's Work</h2>
        <p className="ka-sound-section-desc">
          Send stems, references, and a brief. I'll send back a mix that hits.
        </p>
        <div className="ka-sound-cta-row">
          <a href="mailto:kernel.chat@gmail.com?subject=Sound%20Engineering%20Inquiry" className="ka-sound-cta">
            kernel.chat@gmail.com
          </a>
          <a href="https://discord.gg/kdMauM9abG" className="ka-sound-cta ka-sound-cta--secondary" target="_blank" rel="noopener">
            Discord
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="ka-sound-footer">
        <div className="ka-sound-footer-links">
          <a href="#/">Home</a>
          <a href="#/security">Security</a>
          <a href="https://github.com/isaacsight/kernel" target="_blank" rel="noopener">GitHub</a>
          <a href="https://www.npmjs.com/package/@kernel.chat/kbot" target="_blank" rel="noopener">npm</a>
          <a href="https://discord.gg/kdMauM9abG" target="_blank" rel="noopener">Discord</a>
        </div>
        <p className="ka-sound-copyright">kernel.chat group</p>
      </footer>
    </div>
  )
}
