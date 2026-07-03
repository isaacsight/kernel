import { useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import type { IssueRecord, InstrumentSpread } from '../content/issues'
import { resolveAccentHex } from '../content/issues/accents'
import { PopShape } from './ornaments'
import './InstrumentFeature.css'
import './IssueAccent.css'

interface InstrumentFeatureProps {
  spread: InstrumentSpread
  issue: IssueRecord
}

/**
 * InstrumentFeature — a calibrated control handed to the reader.
 *
 * Editorial tool #7 in the IssueFeature family, and the magazine's
 * first interactive spread. One fixed prompt; N stops on a dial;
 * selecting a stop reveals the same prompt answered at that depth,
 * with a meter line under it. Boundary decisions (ratified ISSUE
 * 399): interaction via React state is permitted on the editorial
 * surface, motion stays CSS-only within ambient amplitudes, and all
 * stop panels remain in the DOM — screen hides the inactive ones,
 * print shows them all stacked so the instrument degrades to a
 * table of depths on paper.
 */
export function InstrumentFeature({ spread, issue }: InstrumentFeatureProps) {
  const stockClass = `pop-stock-${spread.stock ?? 'ivory'}`
  const accentHex = resolveAccentHex(issue.accent, spread.type)
  const accentStyle = { '--issue-accent-base': accentHex } as CSSProperties

  const [activeId, setActiveId] = useState(
    spread.defaultStop ?? spread.stops[0]?.id,
  )
  const dialRefs = useRef<(HTMLButtonElement | null)[]>([])
  const activeIndex = Math.max(0, spread.stops.findIndex((s) => s.id === activeId))
  const activeStop = spread.stops[activeIndex]

  // Roving radiogroup: arrows move both selection and focus.
  const onDialKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      next = Math.min(spread.stops.length - 1, activeIndex + 1)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      next = Math.max(0, activeIndex - 1)
    } else if (e.key === 'Home') {
      next = 0
    } else if (e.key === 'End') {
      next = spread.stops.length - 1
    }
    if (next >= 0 && next !== activeIndex) {
      e.preventDefault()
      setActiveId(spread.stops[next].id)
      dialRefs.current[next]?.focus()
    }
  }

  const renderSections = (sections?: typeof spread.intro) =>
    sections?.map((section, i) => (
      <section key={i} className="pop-instrument-section">
        <h3 className="pop-instrument-section-heading">
          {section.heading}
          {section.headingJp && (
            <span className="pop-instrument-section-heading-jp">{section.headingJp}</span>
          )}
        </h3>
        {section.paragraphs.map((p, pi) => (
          <p key={pi} className="pop-instrument-paragraph">{p}</p>
        ))}
      </section>
    ))

  return (
    <section className={`pop-instrument ${stockClass}`} style={accentStyle} aria-labelledby="pop-instrument-title">
      <div className="pop-instrument-inner">

        {/* ── Head ───────────────────────────────────────── */}
        <header className="pop-instrument-header">
          <span className="pop-kicker pop-kicker--tomato">{spread.kicker}</span>
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          <h2 id="pop-instrument-title" className="pop-display pop-instrument-title">
            {spread.title}
          </h2>
          <p className="pop-feature-jp pop-instrument-title-jp">{spread.titleJp}</p>
          <p className="pop-swash pop-instrument-deck">{spread.deck}</p>
          <p className="pop-folio pop-instrument-byline">{spread.byline}</p>
        </header>

        {/* ── The spec — dossier (optional) ───────────────── */}
        {spread.dossier && (
          <aside className="pop-instrument-spec" aria-label={spread.dossier.kicker}>
            <div className="pop-instrument-spec-frame">
              <PopShape
                name="lozenge"
                size="md"
                color="tomato"
                className="pop-instrument-spec-badge"
                aria-label="spec badge"
              />
              <span className="pop-folio pop-instrument-spec-kicker">{spread.dossier.kicker}</span>
              {spread.dossier.note && (
                <p className="pop-instrument-spec-note">{spread.dossier.note}</p>
              )}
              <dl className="pop-instrument-spec-list">
                {spread.dossier.items.map((item, i) => (
                  <div key={i} className="pop-instrument-spec-row">
                    <dt className="pop-folio pop-instrument-spec-label">{item.label}</dt>
                    <dd className="pop-instrument-spec-value">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        )}

        {/* ── Intro prose ─────────────────────────────────── */}
        {spread.intro && (
          <article className="pop-instrument-prose">{renderSections(spread.intro)}</article>
        )}

        <hr className="pop-rule pop-instrument-rule" />

        {/* ── THE INSTRUMENT ──────────────────────────────── */}
        <div className="pop-instrument-apparatus">
          <p className="pop-instrument-prompt">
            <span className="pop-folio pop-instrument-prompt-kicker" aria-hidden="true">
              THE PROMPT · 設問
            </span>
            <span className="pop-instrument-prompt-text">{spread.prompt}</span>
            {spread.promptJp && (
              <span className="pop-instrument-prompt-jp">{spread.promptJp}</span>
            )}
          </p>

          {/* The dial — a roving radiogroup on a hairline track. */}
          <div
            className="pop-instrument-dial"
            role="radiogroup"
            aria-label="Effort — how hard the machine thinks"
            onKeyDown={onDialKeyDown}
          >
            <span className="pop-instrument-dial-track" aria-hidden="true" />
            {spread.stops.map((stop, i) => (
              <button
                key={stop.id}
                ref={(el) => { dialRefs.current[i] = el }}
                type="button"
                role="radio"
                aria-checked={stop.id === activeId}
                tabIndex={stop.id === activeId ? 0 : -1}
                className={`pop-instrument-stop${stop.id === activeId ? ' pop-instrument-stop--active' : ''}`}
                onClick={() => setActiveId(stop.id)}
              >
                <span className="pop-instrument-stop-mark" aria-hidden="true" />
                <span className="pop-folio pop-instrument-stop-label">{stop.label}</span>
                {stop.labelJp && (
                  <span className="pop-instrument-stop-jp" aria-hidden="true">{stop.labelJp}</span>
                )}
              </button>
            ))}
          </div>

          {activeStop?.note && (
            <p className="pop-instrument-dial-note" aria-live="polite">{activeStop.note}</p>
          )}

          {/* All panels stay in the DOM; screen hides inactive,
              print shows every depth stacked. */}
          <div className="pop-instrument-panels">
            {spread.stops.map((stop) => (
              <section
                key={stop.id}
                className={`pop-instrument-panel${stop.id === activeId ? ' pop-instrument-panel--active' : ''}`}
                aria-hidden={stop.id !== activeId}
              >
                <h4 className="pop-folio pop-instrument-panel-head">
                  ANSWERED AT {stop.label}
                  {stop.labelJp ? ` · ${stop.labelJp}` : ''}
                </h4>
                {stop.answer.map((p, pi) => (
                  <p key={pi} className="pop-instrument-paragraph">{p}</p>
                ))}
                <p className="pop-instrument-meter">
                  <span>TOKENS {stop.reading.tokens}</span>
                  <span aria-hidden="true">·</span>
                  <span>TIME {stop.reading.time}</span>
                  <span aria-hidden="true">·</span>
                  <span>PRICE {stop.reading.price}</span>
                </p>
              </section>
            ))}
          </div>

          {spread.meterNote && (
            <p className="pop-instrument-meter-note">{spread.meterNote}</p>
          )}
        </div>

        <hr className="pop-rule pop-instrument-rule" />

        {/* ── Outro prose ─────────────────────────────────── */}
        {spread.outro && (
          <article className="pop-instrument-prose">{renderSections(spread.outro)}</article>
        )}

        {/* ── Pull quote (optional) ───────────────────────── */}
        {spread.pullQuote && (
          <blockquote className="pop-instrument-pullquote">
            <p className="pop-instrument-pullquote-text">{spread.pullQuote.text}</p>
            <cite className="pop-folio pop-instrument-pullquote-cite">{spread.pullQuote.attribution}</cite>
          </blockquote>
        )}

        {/* ── Sign-off ────────────────────────────────────── */}
        <footer className="pop-instrument-signoff">
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          <p className="pop-swash pop-instrument-signoff-text">{spread.signoff}</p>
          <div className="pop-monument pop-instrument-monument">
            <span>ISSUE</span>
            <strong>{issue.number}</strong>
            <span>{issue.month} {issue.year}</span>
          </div>
        </footer>

      </div>
    </section>
  )
}
