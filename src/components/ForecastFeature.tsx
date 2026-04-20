import type { CSSProperties } from 'react'
import type { IssueRecord, ForecastSpread } from '../content/issues'
import { resolveAccentHex } from '../content/issues/accents'
import { PopShape } from './ornaments'
import './ForecastFeature.css'
import './IssueAccent.css'

interface ForecastFeatureProps {
  spread: ForecastSpread
  issue: IssueRecord
}

/**
 * ForecastFeature — numbered manifesto / forecast.
 *
 * Editorial tool #3 in the IssueFeature family. Used when the
 * issue's thesis is a list of declarations — forecasts, manifestos,
 * predictions, principles. Different rhythm from essay (which is
 * narrative) and interview (which is dialogic). Each proposition
 * is a numbered ring (PopShape from the Illustrator layer) + bold
 * title + prose body.
 */
export function ForecastFeature({ spread, issue }: ForecastFeatureProps) {
  const stockClass = `pop-stock-${spread.stock ?? 'ink'}`
  const accentHex = resolveAccentHex(issue.accent, spread.type)
  const accentStyle = { '--issue-accent-base': accentHex } as CSSProperties

  return (
    <section className={`pop-forecast ${stockClass}`} style={accentStyle} aria-labelledby="pop-forecast-title">
      <div className="pop-forecast-inner">

        {/* ── Header ─────────────────────────────────────── */}
        <header className="pop-forecast-header">
          <span className="pop-kicker pop-kicker--tomato">{spread.kicker}</span>
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          <h2 id="pop-forecast-title" className="pop-display pop-forecast-title">
            {spread.title}
          </h2>
          <p className="pop-feature-jp pop-forecast-title-jp">{spread.titleJp}</p>
          <p className="pop-swash pop-forecast-deck">{spread.deck}</p>
          <p className="pop-folio pop-forecast-byline">{spread.byline}</p>
        </header>

        {/* ── Optional intro block ───────────────────────── */}
        {spread.intro && (
          <>
            <hr className="pop-rule pop-forecast-rule" />
            <p className="pop-forecast-intro">{spread.intro}</p>
          </>
        )}

        <hr className="pop-rule pop-rule--tomato pop-forecast-divider" />

        {/* ── Numbered propositions ──────────────────────── */}
        <ol className="pop-forecast-list">
          {spread.propositions.map((p) => (
            <li key={p.n} className="pop-forecast-item">
              <div className="pop-forecast-item-head">
                <PopShape
                  name="ring"
                  size="lg"
                  color="tomato"
                  label={p.n}
                  className="pop-forecast-badge"
                  aria-label={`proposition ${p.n}`}
                />
                <div className="pop-forecast-item-title-group">
                  <h3 className="pop-forecast-item-title">{p.title}</h3>
                  {p.titleJp && (
                    <p className="pop-forecast-item-title-jp">{p.titleJp}</p>
                  )}
                </div>
              </div>
              <div className="pop-forecast-item-body">
                {p.body.map((para, i) => (
                  <p key={i} className="pop-forecast-item-para">{para}</p>
                ))}
              </div>
            </li>
          ))}
        </ol>

        {/* ── Optional outro ─────────────────────────────── */}
        {spread.outro && (
          <>
            <hr className="pop-rule pop-forecast-rule" />
            <p className="pop-forecast-outro">{spread.outro}</p>
          </>
        )}

        {/* ── Sign-off ──────────────────────────────────── */}
        <footer className="pop-forecast-signoff">
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          <p className="pop-swash pop-forecast-signoff-text">{spread.signoff}</p>
          <div className="pop-monument pop-forecast-monument">
            <span>ISSUE</span>
            <strong>{issue.number}</strong>
            <span>{issue.month} {issue.year}</span>
          </div>
        </footer>

      </div>
    </section>
  )
}
