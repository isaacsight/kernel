import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { CloseSpread, IssueRecord } from '../content/issues'
import { resolveAccentHex } from '../content/issues/accents'
import { PopShape } from './ornaments'
import './CloseFeature.css'
import './IssueAccent.css'

interface CloseFeatureProps {
  spread: CloseSpread
  issue: IssueRecord
}

type StopReason = 'voluntary' | 'capped'

/**
 * CloseFeature — a feed with no natural end, until the reader gives
 * it one.
 *
 * The seventh interaction primitive (ISSUE 415): every prior control
 * offered the reader a shape to operate. This one exposes the shape
 * every real feed withholds — a stop, restored, at equal weight to
 * "more," from the very first item.
 *
 * The law: "Show me one more" and "I'll stop here" render as
 * siblings with the SAME class at every item count. Neither button
 * is ever de-emphasized, hidden, or delayed relative to the other.
 * That's enforced below (one shared class, no count-keyed styling),
 * not just asserted in copy — see CloseFeature.test.tsx.
 *
 * Print always renders the outcome (a receipt, or an honest
 * in-progress snapshot), never the live controls — same
 * print-shows-the-outcome pattern as press/margin/galley.
 */
export function CloseFeature({ spread, issue }: CloseFeatureProps) {
  const stockClass = `pop-stock-${spread.stock ?? 'ink'}`
  const accentHex = resolveAccentHex(issue.accent, spread.type)
  const accentStyle = { '--issue-accent-base': accentHex } as CSSProperties

  const cap = Math.max(2, spread.cap ?? 40)
  const [itemsShown, setItemsShown] = useState(1)
  const [reason, setReason] = useState<StopReason | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const startRef = useRef<number>(Date.now())

  const stopped = reason !== null

  // The clock runs from mount — the reader is already "in" the feed
  // before they decide to press anything, same as a real one.
  useEffect(() => {
    if (stopped) return
    const id = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [stopped])

  useEffect(() => {
    if (!stopped && itemsShown >= cap) {
      setReason('capped')
    }
  }, [itemsShown, cap, stopped])

  const showOneMore = () => {
    if (stopped) return
    setItemsShown((n) => n + 1)
  }

  const stopHere = () => {
    if (stopped) return
    setReason('voluntary')
  }

  const minutes = Math.floor(elapsedSeconds / 60)
  const seconds = elapsedSeconds % 60
  const clock = `${minutes}:${seconds.toString().padStart(2, '0')}`

  const visibleItems = Array.from(
    { length: itemsShown },
    (_, i) => (spread.filler.length > 0 ? spread.filler[i % spread.filler.length] : '')
  )

  const renderSections = (sections?: typeof spread.intro) =>
    sections?.map((section, i) => (
      <section key={i} className="pop-close-section">
        <h3 className="pop-close-section-heading">
          {section.heading}
          {section.headingJp && (
            <span className="pop-close-section-heading-jp">{section.headingJp}</span>
          )}
        </h3>
        {section.paragraphs.map((p, pi) => (
          <p key={pi} className="pop-close-paragraph">{p}</p>
        ))}
      </section>
    ))

  return (
    <section className={`pop-close ${stockClass}`} style={accentStyle} aria-labelledby="pop-close-title">
      <div className="pop-close-inner">

        <header className="pop-close-header">
          <span className="pop-kicker pop-kicker--tomato">{spread.kicker}</span>
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          <h2 id="pop-close-title" className="pop-display pop-close-title">
            {spread.title}
          </h2>
          <p className="pop-feature-jp pop-close-title-jp">{spread.titleJp}</p>
          <p className="pop-swash pop-close-deck">{spread.deck}</p>
          <p className="pop-folio pop-close-byline">{spread.byline}</p>
        </header>

        {spread.dossier && (
          <aside className="pop-close-spec" aria-label={spread.dossier.kicker}>
            <div className="pop-close-spec-frame">
              <PopShape
                name="lozenge"
                size="md"
                color="tomato"
                className="pop-close-spec-badge"
                aria-label="spec badge"
              />
              <span className="pop-folio pop-close-spec-kicker">{spread.dossier.kicker}</span>
              {spread.dossier.note && (
                <p className="pop-close-spec-note">{spread.dossier.note}</p>
              )}
              <dl className="pop-close-spec-list">
                {spread.dossier.items.map((item, i) => (
                  <div key={i} className="pop-close-spec-row">
                    <dt className="pop-folio pop-close-spec-label">{item.label}</dt>
                    <dd className="pop-close-spec-value">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        )}

        {spread.intro && (
          <article className="pop-close-prose">{renderSections(spread.intro)}</article>
        )}

        <hr className="pop-rule pop-close-rule" />

        <div className="pop-close-apparatus">
          {spread.closeKicker && (
            <p className="pop-folio pop-close-apparatus-kicker">{spread.closeKicker}</p>
          )}

          {!stopped && (
            <ul className="pop-close-feed" aria-label="Simulated feed">
              {visibleItems.map((line, i) => (
                <li key={i} className="pop-close-feed-item">{line}</li>
              ))}
            </ul>
          )}

          {!stopped && (
            <p className="pop-close-readout">
              <span>{itemsShown} {itemsShown === 1 ? 'ITEM' : 'ITEMS'}</span>
              <span aria-hidden="true">·</span>
              <span>{clock}</span>
            </p>
          )}

          {!stopped && (
            <div className="pop-close-controls">
              <button type="button" className="pop-close-control" onClick={showOneMore}>
                Show me one more
              </button>
              <button type="button" className="pop-close-control" onClick={stopHere}>
                I'll stop here
              </button>
            </div>
          )}

          {stopped && (
            <div className="pop-close-receipt" aria-live="polite">
              <p className="pop-close-receipt-line">
                {itemsShown} {itemsShown === 1 ? 'ITEM' : 'ITEMS'} · {clock}
              </p>
              <p className="pop-close-receipt-reason">
                {reason === 'voluntary'
                  ? 'You chose to stop here.'
                  : `We capped this demo at ${cap} for your browser's sake — a real feed wouldn't extend you that courtesy.`}
              </p>
            </div>
          )}

          {/* Print-only snapshot — always present regardless of
              whether the reader ever stopped. */}
          <p className="pop-close-print-snapshot" aria-hidden="true">
            {itemsShown} {itemsShown === 1 ? 'ITEM' : 'ITEMS'} · {clock} ·{' '}
            {stopped
              ? reason === 'voluntary'
                ? 'stopped by the reader'
                : 'reached the cap'
              : 'in progress at print time'}
          </p>

          <p className="pop-close-tally-note">{spread.closeNote}</p>
        </div>

        <hr className="pop-rule pop-close-rule" />

        {spread.outro && (
          <article className="pop-close-prose">{renderSections(spread.outro)}</article>
        )}

        {spread.pullQuote && (
          <blockquote className="pop-close-pullquote">
            <p className="pop-close-pullquote-text">{spread.pullQuote.text}</p>
            <cite className="pop-folio pop-close-pullquote-cite">{spread.pullQuote.attribution}</cite>
          </blockquote>
        )}

        <footer className="pop-close-signoff">
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          <p className="pop-swash pop-close-signoff-text">{spread.signoff}</p>
          <div className="pop-monument pop-close-monument">
            <span>ISSUE</span>
            <strong>{issue.number}</strong>
            <span>{issue.month} {issue.year}</span>
          </div>
        </footer>

      </div>
    </section>
  )
}
