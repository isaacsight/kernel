import type { CSSProperties } from 'react'
import type { IssueRecord, ColloquySpread } from '../content/issues'
import { resolveAccentHex } from '../content/issues/accents'
import { PopShape } from './ornaments'
import './ColloquyFeature.css'
import './IssueAccent.css'

interface ColloquyFeatureProps {
  spread: ColloquySpread
  issue: IssueRecord
}

/**
 * ColloquyFeature — two-voice dialogue.
 *
 * Editorial tool #6 in the IssueFeature family. Used when the issue
 * is carried by two co-equal positions rather than a single author.
 * Different rhythm from InterviewFeature: there is no host. A voices
 * legend up top declares the two stances; the body runs as movements
 * of alternating turns, each attributed by a short mono mark tinted
 * by which voice speaks. Introduced ISSUE 398 (NO MORE QUESTIONS) —
 * the two voices are positions, not people (see the dossier).
 */
export function ColloquyFeature({ spread, issue }: ColloquyFeatureProps) {
  const stockClass = `pop-stock-${spread.stock ?? 'ink'}`
  const accentHex = resolveAccentHex(issue.accent, spread.type)
  const accentStyle = { '--issue-accent-base': accentHex } as CSSProperties

  // Map voice id → 0 | 1 so the renderer can tint each turn by which
  // side speaks without threading colour through the data.
  const voiceIndex = new Map(spread.voices.map((v, i) => [v.id, i]))

  return (
    <section className={`pop-colloquy ${stockClass}`} style={accentStyle} aria-labelledby="pop-colloquy-title">
      <div className="pop-colloquy-inner">

        {/* ── Head ───────────────────────────────────────── */}
        <header className="pop-colloquy-header">
          <span className="pop-kicker pop-kicker--tomato">{spread.kicker}</span>
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          <h2 id="pop-colloquy-title" className="pop-display pop-colloquy-title">
            {spread.title}
          </h2>
          <p className="pop-feature-jp pop-colloquy-title-jp">{spread.titleJp}</p>
          <p className="pop-swash pop-colloquy-deck">{spread.deck}</p>
          <p className="pop-folio pop-colloquy-byline">{spread.byline}</p>
        </header>

        {/* ── The terms — provenance dossier (optional) ───── */}
        {spread.dossier && (
          <aside className="pop-colloquy-terms" aria-label={spread.dossier.kicker}>
            <div className="pop-colloquy-terms-frame">
              <PopShape
                name="lozenge"
                size="md"
                color="tomato"
                className="pop-colloquy-terms-badge"
                aria-label="terms badge"
              />
              <span className="pop-folio pop-colloquy-terms-kicker">{spread.dossier.kicker}</span>
              {spread.dossier.note && (
                <p className="pop-colloquy-terms-note">{spread.dossier.note}</p>
              )}
              <dl className="pop-colloquy-terms-list">
                {spread.dossier.items.map((item, i) => (
                  <div key={i} className="pop-colloquy-terms-row">
                    <dt className="pop-folio pop-colloquy-terms-label">{item.label}</dt>
                    <dd className="pop-colloquy-terms-value">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        )}

        {/* ── Voices legend — the two stances ─────────────── */}
        <aside className="pop-colloquy-voices" aria-label="The voices">
          {spread.voices.map((voice, i) => (
            <div
              key={voice.id}
              className={`pop-colloquy-voice pop-colloquy-voice--${i === 0 ? 'a' : 'b'}`}
            >
              <span className="pop-colloquy-voice-swatch" aria-hidden="true" />
              <span className="pop-folio pop-colloquy-voice-label">{voice.label}</span>
              <span className="pop-colloquy-voice-jp">{voice.labelJp}</span>
              <span className="pop-colloquy-voice-stance">{voice.stance}</span>
            </div>
          ))}
        </aside>

        <hr className="pop-rule pop-colloquy-rule" />

        {/* ── Movements — the exchange ────────────────────── */}
        <article className="pop-colloquy-body">
          {spread.movements.map((movement, mi) => (
            <div key={mi} className="pop-colloquy-movement">
              <div className="pop-colloquy-movement-head">
                <span className="pop-folio pop-colloquy-movement-n" aria-hidden="true">
                  {String(mi + 1).padStart(2, '0')}
                </span>
                <h3 className="pop-colloquy-movement-heading">
                  {movement.heading}
                  {movement.headingJp && (
                    <span className="pop-colloquy-movement-heading-jp">{movement.headingJp}</span>
                  )}
                </h3>
              </div>
              {movement.turns.map((turn, ti) => {
                const side = voiceIndex.get(turn.voice) === 0 ? 'a' : 'b'
                const voice = spread.voices[voiceIndex.get(turn.voice) ?? 0]
                return (
                  <p key={ti} className={`pop-colloquy-turn pop-colloquy-turn--${side}`}>
                    <span className="pop-colloquy-turn-mark" aria-hidden="true">{voice.label}</span>
                    <span className="pop-colloquy-turn-text">
                      <span className="pop-sr-only">{voice.label}: </span>
                      {turn.text}
                    </span>
                  </p>
                )
              })}
            </div>
          ))}
        </article>

        {/* ── Pull quote (optional) ───────────────────────── */}
        {spread.pullQuote && (
          <blockquote className="pop-colloquy-pullquote">
            <p className="pop-colloquy-pullquote-text">{spread.pullQuote.text}</p>
            <cite className="pop-folio pop-colloquy-pullquote-cite">{spread.pullQuote.attribution}</cite>
          </blockquote>
        )}

        {/* ── Sign-off ────────────────────────────────────── */}
        <footer className="pop-colloquy-signoff">
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          <p className="pop-swash pop-colloquy-signoff-text">{spread.signoff}</p>
          <div className="pop-monument pop-colloquy-monument">
            <span>ISSUE</span>
            <strong>{issue.number}</strong>
            <span>{issue.month} {issue.year}</span>
          </div>
        </footer>

      </div>
    </section>
  )
}
