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

const TOOLS = [
  'Ableton Live 12 Suite',
  'Serum 2',
  'Universal Audio (170+ plugins)',
  'Roland Cloud (ZENOLOGY, TR, Juno)',
  'Native Instruments (Kontakt, Massive)',
  'Spitfire LABS',
  'Splice Sounds',
  'kbot Sound Engine',
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
    navigator.clipboard.writeText('isaac@kernel.chat')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="ka-sound">
      {/* Hero */}
      <section className="ka-sound-hero">
        <div className="ka-sound-wave" aria-hidden="true" />
        <div className="ka-sound-badge">Sound Engineer</div>
        <h1 className="ka-sound-title">Isaac Hernandez</h1>
        <p className="ka-sound-subtitle">
          Mixing. Mastering. Production. Sound Design.
        </p>
        <p className="ka-sound-tagline">
          Austin, TX — Engineering sound with precision tools and AI-assisted workflows.
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
                <div className="ka-sound-track-progress">
                  <div className="ka-sound-track-progress-fill" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="ka-sound-divider" />

      {/* Tools */}
      <section className="ka-sound-section">
        <h2 className="ka-sound-h2">Tools</h2>
        <div className="ka-sound-tools">
          {TOOLS.map(t => (
            <span key={t} className="ka-sound-tool">{t}</span>
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
          <button className="ka-sound-cta" onClick={copyEmail}>
            {copied ? 'Copied!' : 'isaac@kernel.chat'}
          </button>
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
