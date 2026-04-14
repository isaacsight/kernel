// ─── Exhibit ──────────────────────────────────────────────────
//
// A single thought displayed as a museum piece. One exhibit fills
// the frame; visitors move through the gallery with ← / → arrows.
// Every exhibit carries a placard: eyebrow label, attribution,
// prose body, then a metadata block in small-caps mono, and a
// "ask the docent" link that jumps visitors to the agent with
// this piece pre-loaded into their question.

import type { ReactNode } from 'react'

export interface PlacardField {
  label: string
  value: ReactNode
}

export interface ExhibitProps {
  hall: string          // "Influences" · "Chronicle" · etc.
  index: number         // zero-based
  total: number
  accession: string     // e.g. "No. 047 · 2026.04"
  eyebrow?: string      // kind label (PERSON, MILESTONE, TRACK…)
  title: string
  attribution?: string  // "— Brian Eno" style
  body?: string | null
  placard?: PlacardField[]
  sourceUrl?: string | null
  sourceLabel?: string
  onPrev?: () => void
  onNext?: () => void
  onAskDocent?: () => void
}

export function Exhibit({
  hall, index, total, accession,
  eyebrow, title, attribution, body,
  placard, sourceUrl, sourceLabel,
  onPrev, onNext, onAskDocent,
}: ExhibitProps) {
  const hasPrev = index > 0 && !!onPrev
  const hasNext = index < total - 1 && !!onNext

  return (
    <article className="ka-me-exhibit">
      <header className="ka-me-exhibit-room">
        <span className="ka-me-exhibit-hall">{hall}</span>
        <span className="ka-me-exhibit-position">
          {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </span>
      </header>

      <div className="ka-me-exhibit-wall">
        {eyebrow && <div className="ka-me-exhibit-eyebrow">{eyebrow}</div>}
        <h2 className="ka-me-exhibit-title">{title}</h2>
        {attribution && <div className="ka-me-exhibit-attribution">{attribution}</div>}
        {body && <p className="ka-me-exhibit-body">{body}</p>}
      </div>

      <div className="ka-me-placard">
        <div className="ka-me-placard-accession">{accession}</div>
        {placard && placard.length > 0 && (
          <dl className="ka-me-placard-fields">
            {placard.map((f, i) => (
              <div key={i} className="ka-me-placard-field">
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="ka-me-placard-actions">
          {sourceUrl && (
            <a
              className="ka-me-link"
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {sourceLabel ?? 'source'} ↗
            </a>
          )}
          {onAskDocent && (
            <button
              type="button"
              className="ka-me-placard-ask"
              onClick={onAskDocent}
            >
              ask the docent
            </button>
          )}
        </div>
      </div>

      <nav className="ka-me-exhibit-nav" aria-label="Gallery navigation">
        <button
          type="button"
          className="ka-me-exhibit-arrow"
          onClick={onPrev}
          disabled={!hasPrev}
          aria-label="Previous exhibit"
        >
          ← previous
        </button>
        <button
          type="button"
          className="ka-me-exhibit-arrow"
          onClick={onNext}
          disabled={!hasNext}
          aria-label="Next exhibit"
        >
          next →
        </button>
      </nav>
    </article>
  )
}

export function EmptyRoom({ hall }: { hall: string }) {
  return (
    <div className="ka-me-empty-room">
      <div className="ka-me-exhibit-hall">{hall}</div>
      <p>This room is being prepared. Check back soon.</p>
    </div>
  )
}
