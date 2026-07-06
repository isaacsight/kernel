import { useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import type { IssueRecord, MarginSpread } from '../content/issues'
import { resolveAccentHex } from '../content/issues/accents'
import { PopShape } from './ornaments'
import './MarginFeature.css'
import './IssueAccent.css'

interface MarginFeatureProps {
  spread: MarginSpread
  issue: IssueRecord
}

/**
 * MarginFeature — a text with a writable margin.
 *
 * Editorial tool #12, and the fifth interaction primitive (ISSUE
 * 412): the first control where the reader CONTRIBUTES content
 * rather than choosing among author-provided states. Every prior
 * shape offered selection — stops, lenses, stages, strikes. The
 * margin offers a blank space and a cursor.
 *
 * Control: one native <textarea> per passage, labelled — the most
 * established input pattern on the web (rule 5 satisfied by
 * definition: nothing is more standard than a text field). The
 * passage text is set in the house serif; the reader's notes render
 * in the house mono — the machine-set voice and the reader's voice
 * distinguished typographically, within the two-face rule.
 *
 * Honesty boundary (rule 6, extended by this shape): the tally
 * counts the reader's notes and words — real counts of real
 * writing — and claims nothing else. Notes are client-session
 * React state: nothing recorded, nothing sent, no localStorage.
 * The NEW duty: because an input field implies keeping, the page
 * must say plainly that it keeps nothing — notes vanish on reload;
 * copy out what you want to keep (the commonplace-book move). An
 * honest margin must not let the reader mistake it for a saving one.
 *
 * Print keeps whatever the reader wrote — you print your own
 * annotated copy — and empty margins print as ruled space a pencil
 * can use, so the paper form of the spread is ALSO a writable margin.
 */
export function MarginFeature({ spread, issue }: MarginFeatureProps) {
  const stockClass = `pop-stock-${spread.stock ?? 'cream'}`
  const accentHex = resolveAccentHex(issue.accent, spread.type)
  const accentStyle = { '--issue-accent-base': accentHex } as CSSProperties

  const [notes, setNotes] = useState<Record<string, string>>({})

  const noteCount = spread.passages.filter((p) => (notes[p.id] ?? '').trim().length > 0).length
  const wordCount = spread.passages.reduce((sum, p) => {
    const t = (notes[p.id] ?? '').trim()
    return t ? sum + t.split(/\s+/).length : sum
  }, 0)

  // Auto-grow: state change adjusting layout, not choreography —
  // no animation library, no rAF (rule 3 untouched).
  const autoGrow = (e: FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  const renderSections = (sections?: typeof spread.intro) =>
    sections?.map((section, i) => (
      <section key={i} className="pop-margin-section">
        <h3 className="pop-margin-section-heading">
          {section.heading}
          {section.headingJp && (
            <span className="pop-margin-section-heading-jp">{section.headingJp}</span>
          )}
        </h3>
        {section.paragraphs.map((p, pi) => (
          <p key={pi} className="pop-margin-paragraph">{p}</p>
        ))}
      </section>
    ))

  return (
    <section className={`pop-margin ${stockClass}`} style={accentStyle} aria-labelledby="pop-margin-title">
      <div className="pop-margin-inner">

        {/* ── Head ───────────────────────────────────────── */}
        <header className="pop-margin-header">
          <span className="pop-kicker pop-kicker--tomato">{spread.kicker}</span>
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          <h2 id="pop-margin-title" className="pop-display pop-margin-title">
            {spread.title}
          </h2>
          <p className="pop-feature-jp pop-margin-title-jp">{spread.titleJp}</p>
          <p className="pop-swash pop-margin-deck">{spread.deck}</p>
          <p className="pop-folio pop-margin-byline">{spread.byline}</p>
        </header>

        {/* ── The spec — dossier (optional, reused module) ── */}
        {spread.dossier && (
          <aside className="pop-margin-spec" aria-label={spread.dossier.kicker}>
            <div className="pop-margin-spec-frame">
              <PopShape
                name="lozenge"
                size="md"
                color="tomato"
                className="pop-margin-spec-badge"
                aria-label="spec badge"
              />
              <span className="pop-folio pop-margin-spec-kicker">{spread.dossier.kicker}</span>
              {spread.dossier.note && (
                <p className="pop-margin-spec-note">{spread.dossier.note}</p>
              )}
              <dl className="pop-margin-spec-list">
                {spread.dossier.items.map((item, i) => (
                  <div key={i} className="pop-margin-spec-row">
                    <dt className="pop-folio pop-margin-spec-label">{item.label}</dt>
                    <dd className="pop-margin-spec-value">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        )}

        {/* ── Intro prose ─────────────────────────────────── */}
        {spread.intro && (
          <article className="pop-margin-prose">{renderSections(spread.intro)}</article>
        )}

        <hr className="pop-rule pop-margin-rule" />

        {/* ── THE ANNOTATED TEXT ───────────────────────────── */}
        <div className="pop-margin-apparatus">
          {spread.marginKicker && (
            <p className="pop-folio pop-margin-apparatus-kicker">{spread.marginKicker}</p>
          )}

          <div className="pop-margin-passages">
            {spread.passages.map((passage, i) => (
              <div key={passage.id} className="pop-margin-row">
                <p className="pop-margin-passage-text">{passage.text}</p>
                <div className="pop-margin-field-wrap">
                  <textarea
                    className="pop-margin-field"
                    aria-label={`Your margin note for passage ${i + 1}`}
                    rows={3}
                    value={notes[passage.id] ?? ''}
                    onInput={autoGrow}
                    onChange={(e) =>
                      setNotes((prev) => ({ ...prev, [passage.id]: e.target.value }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          {/* The tally — a real count of the reader's writing,
              and nothing else. */}
          <p className="pop-margin-tally" aria-live="polite">
            <span>YOUR HAND · {noteCount} {noteCount === 1 ? 'NOTE' : 'NOTES'}</span>
            <span aria-hidden="true">·</span>
            <span>{wordCount} {wordCount === 1 ? 'WORD' : 'WORDS'}</span>
          </p>
          <p className="pop-margin-tally-note">{spread.marginNote}</p>
        </div>

        <hr className="pop-rule pop-margin-rule" />

        {/* ── Outro prose ─────────────────────────────────── */}
        {spread.outro && (
          <article className="pop-margin-prose">{renderSections(spread.outro)}</article>
        )}

        {/* ── Pull quote (optional) ───────────────────────── */}
        {spread.pullQuote && (
          <blockquote className="pop-margin-pullquote">
            <p className="pop-margin-pullquote-text">{spread.pullQuote.text}</p>
            <cite className="pop-folio pop-margin-pullquote-cite">{spread.pullQuote.attribution}</cite>
          </blockquote>
        )}

        {/* ── Sign-off ────────────────────────────────────── */}
        <footer className="pop-margin-signoff">
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          <p className="pop-swash pop-margin-signoff-text">{spread.signoff}</p>
          <div className="pop-monument pop-margin-monument">
            <span>ISSUE</span>
            <strong>{issue.number}</strong>
            <span>{issue.month} {issue.year}</span>
          </div>
        </footer>

      </div>
    </section>
  )
}
