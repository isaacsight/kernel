import type { ReactNode } from 'react'
import type { IssueRecord, DispatchSpread } from '../content/issues'
import './DispatchFeature.css'

interface DispatchFeatureProps {
  spread: DispatchSpread
  issue: IssueRecord
}

/**
 * DispatchFeature — wire-style news dispatch.
 *
 * Editorial tool #4 in the IssueFeature family. Where forecast is
 * general outlook and essay is narrative observation, dispatch is
 * reactive — the night a specific event happened, written before
 * the takes industrialised. The grammar is borrowed from the
 * newswire: repeating slug band, newspaper dateline, dossier card
 * with FILED / STATUS / partner roll, checkbox-numbered stakes, a
 * mid-spread bulletin pull-quote, an optional bridge sentence to
 * the preceding issue so the magazine reads as a running serial.
 *
 * Visual grammar — all dispatch-identity, none of it leaks to
 * other spread types:
 *   · Courier wire-slug marquee at the top, Esperanto-speed drift
 *   · dateline as pop-folio micro line under the deck
 *   · gummed-paper dossier card inset into the spread margin
 *   · hollow-square + hand-stroked check for each proposition
 *   · BULLETIN callout sat mid-column between items
 *   · bridge line ("FROM ISSUE 366 →") above the title
 */
export function DispatchFeature({ spread, issue }: DispatchFeatureProps) {
  const stockClass = `pop-stock-${spread.stock ?? 'ivory'}`

  const splitAt = Math.min(4, spread.propositions.length)
  const firstHalf = spread.propositions.slice(0, splitAt)
  const secondHalf = spread.propositions.slice(splitAt)

  return (
    <section
      className={`pop-dispatch ${stockClass}`}
      aria-labelledby="pop-dispatch-title"
    >
      {/* ── Wire slug band ─────────────────────────────────
          A Courier mono marquee announcing the dispatch —
          wire-ticker energy, drifts at the same speed as the
          cover's JP marquee so the two feel related but
          carry different content. Duplicated content + a
          translate loop keeps the seam invisible. */}
      <div className="pop-dispatch-slug" aria-label={spread.slug}>
        <div className="pop-dispatch-slug-track" aria-hidden="true">
          <SlugRun text={spread.slug} />
          <SlugRun text={spread.slug} />
          <SlugRun text={spread.slug} />
        </div>
      </div>

      <div className="pop-dispatch-inner">

        {/* ── Header ─────────────────────────────────────── */}
        <header className="pop-dispatch-header">
          <span className="pop-kicker pop-kicker--tomato">{spread.kicker}</span>

          {spread.bridge && (
            <p className="pop-dispatch-bridge">
              <span className="pop-dispatch-bridge-ref">
                FROM ISSUE {spread.bridge.issue} →
              </span>{' '}
              <em>{spread.bridge.text}</em>
            </p>
          )}

          <hr className="pop-rule pop-rule--short pop-rule--tomato" />

          <h2 id="pop-dispatch-title" className="pop-display pop-dispatch-title">
            {spread.title}
          </h2>

          <p className="pop-feature-jp pop-dispatch-title-jp">
            {spread.titleJp}
          </p>

          <p className="pop-swash pop-dispatch-deck">{spread.deck}</p>

          <p className="pop-folio pop-dispatch-dateline">{spread.dateline}</p>

          <p className="pop-folio pop-dispatch-byline">{spread.byline}</p>
        </header>

        {/* ── Dossier card ─────────────────────────────────
            Stencil-mono sample tag with STATUS stamp, FILED,
            ISSUE, BYLINE, and the partner roll. Rotates ~3°
            so it reads as a gummed label, not UI chrome. */}
        <aside className="pop-dispatch-dossier" aria-label="Dispatch dossier">
          <div className="pop-dispatch-dossier-stamp">
            <span className="pop-dispatch-dossier-stamp-label">STATUS</span>
            <strong>{spread.status}</strong>
          </div>

          <dl className="pop-dispatch-dossier-fields">
            <div>
              <dt>FILED</dt>
              <dd>{spread.filedAt}</dd>
            </div>
            <div>
              <dt>ISSUE</dt>
              <dd>{issue.number} · {issue.month} {issue.year}</dd>
            </div>
            <div>
              <dt>BYLINE</dt>
              <dd>THE EDITORS</dd>
            </div>
          </dl>

          {spread.partners && spread.partners.length > 0 && (
            <div className="pop-dispatch-partners">
              <span className="pop-dispatch-partners-label">
                PARTNERS · {String(spread.partners.length).padStart(2, '0')}
              </span>
              <ul>
                {spread.partners.map((p) => (
                  <li key={p.name}>
                    <strong>{p.name}</strong>
                    <span>{p.role}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        {/* ── Optional intro block ───────────────────────── */}
        {spread.intro && (
          <>
            <hr className="pop-rule pop-dispatch-rule" />
            <p className="pop-dispatch-intro">{spread.intro}</p>
          </>
        )}

        <hr className="pop-rule pop-rule--tomato pop-dispatch-divider" />

        {/* ── Propositions, first half ───────────────────── */}
        <ol className="pop-dispatch-list">
          {firstHalf.map((p) => (
            <DispatchItem key={p.n} p={p} />
          ))}
        </ol>

        {/* ── Mid-spread bulletin ────────────────────────── */}
        {spread.bulletin && (
          <figure className="pop-dispatch-bulletin" aria-label="Bulletin callout">
            <span className="pop-dispatch-bulletin-label" aria-hidden="true">
              — BULLETIN —
            </span>
            <blockquote className="pop-dispatch-bulletin-text">
              <span className="pop-dispatch-bulletin-dash" aria-hidden="true">—</span>
              {' '}{spread.bulletin.text}{' '}
              <span className="pop-dispatch-bulletin-dash" aria-hidden="true">—</span>
            </blockquote>
            {spread.bulletin.attribution && (
              <figcaption className="pop-dispatch-bulletin-attrib">
                {spread.bulletin.attribution}
              </figcaption>
            )}
          </figure>
        )}

        {/* ── Propositions, second half ──────────────────── */}
        {secondHalf.length > 0 && (
          <ol className="pop-dispatch-list" start={splitAt + 1}>
            {secondHalf.map((p) => (
              <DispatchItem key={p.n} p={p} />
            ))}
          </ol>
        )}

        {/* ── Optional outro ─────────────────────────────── */}
        {spread.outro && (
          <>
            <hr className="pop-rule pop-dispatch-rule" />
            <p className="pop-dispatch-outro">{spread.outro}</p>
          </>
        )}

        {/* ── Sign-off ──────────────────────────────────── */}
        <footer className="pop-dispatch-signoff">
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          <p className="pop-swash pop-dispatch-signoff-text">{spread.signoff}</p>
          <div className="pop-monument pop-dispatch-monument">
            <span>ISSUE</span>
            <strong>{issue.number}</strong>
            <span>{issue.month} {issue.year}</span>
          </div>
        </footer>

      </div>

      {/* ── Wire terminator ─────────────────────────────────
          The `— 30 —` line that closed old AP dispatches. A
          single Courier rule flush across the bottom of the
          section, under the signoff. Full-bleed so it reads
          as the end of the tape, not just a footer. */}
      {spread.terminator && (
        <div className="pop-dispatch-terminator" aria-label="end of dispatch">
          <span className="pop-dispatch-terminator-mark" aria-hidden="true">— 30 —</span>
          <span className="pop-dispatch-terminator-text">{spread.terminator}</span>
        </div>
      )}
    </section>
  )
}

/** One run of the wire-slug marquee — text then a tomato dot
 *  separator. Rendered twice in the track so the loop is seamless. */
function SlugRun({ text }: { text: string }): ReactNode {
  return (
    <>
      <span className="pop-dispatch-slug-text">{text}</span>
      <span className="pop-dispatch-slug-dot" aria-hidden="true">●</span>
    </>
  )
}

/** A single proposition — checkbox numbering + serif title + body.
 *  Optional left-rail timestamp and above-title Courier overline
 *  that pulls the contents tag into the body. */
function DispatchItem({
  p,
}: {
  p: {
    n: string
    title: string
    titleJp?: string
    body: string[]
    overline?: string
    filedAt?: string
  }
}) {
  return (
    <li className="pop-dispatch-item">
      {p.filedAt && (
        <span
          className="pop-dispatch-item-time"
          aria-label={`filed at ${p.filedAt}`}
        >
          <span className="pop-dispatch-item-time-dot" aria-hidden="true">●</span>
          {p.filedAt}
        </span>
      )}
      <div className="pop-dispatch-item-head">
        <DispatchCheck n={p.n} />
        <div className="pop-dispatch-item-title-group">
          {p.overline && (
            <span className="pop-dispatch-item-overline">
              {p.overline}{' \u00b7 '}{p.n}
            </span>
          )}
          <h3 className="pop-dispatch-item-title">{p.title}</h3>
          {p.titleJp && (
            <p className="pop-dispatch-item-title-jp">{p.titleJp}</p>
          )}
        </div>
      </div>
      <div className="pop-dispatch-item-body">
        {p.body.map((para, i) => (
          <p key={i} className="pop-dispatch-item-para">{para}</p>
        ))}
      </div>
    </li>
  )
}

/** Hollow tomato square + hand-stroked check inside, with the
 *  proposition number printed below in Courier. Reads as a
 *  clipboard tick — "verified before filing" — not a forecast
 *  manifesto ring. */
function DispatchCheck({ n }: { n: string }) {
  return (
    <span className="pop-dispatch-check" role="img" aria-label={`item ${n}, verified`}>
      <svg
        viewBox="0 0 48 48"
        className="pop-dispatch-check-svg"
        aria-hidden="true"
        focusable="false"
      >
        <rect
          x="3"
          y="3"
          width="42"
          height="42"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M 11 26 Q 15 29 20 34 Q 26 26 38 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="pop-dispatch-check-num">{n}</span>
    </span>
  )
}
