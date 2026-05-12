import { REFUSALS } from '../content/refusals'

interface MagazineRefusalsProps {
  /** Display variant. `colophon` = compact list inline with masthead;
   *  `feature` = full-width spread the magazine can dedicate a route to. */
  variant?: 'colophon' | 'feature'
}

/**
 * MagazineRefusals — the brand by negation.
 *
 * Renders the canonical list of editorial refusals from
 * src/content/refusals.ts. Used in the colophon footer (compact) and on
 * a dedicated /refusals route (full). The list is the part of the
 * brand that prints in the colophon and travels with every issue.
 *
 * Visual register: small caps, ledger-soft, no chrome. The refusals
 * read as discipline, not posture.
 */
export function MagazineRefusals({ variant = 'colophon' }: MagazineRefusalsProps) {
  if (variant === 'colophon') {
    return (
      <section className="pop-refusals pop-refusals--colophon" aria-label="Editorial refusals">
        <p className="pop-refusals-label">★ THE REFUSALS · 拒否</p>
        <ul className="pop-refusals-list">
          {REFUSALS.map((refusal) => (
            <li key={refusal.text} className="pop-refusals-item">
              <span className="pop-refusals-text">{refusal.text}</span>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <section className="pop-refusals pop-refusals--feature" aria-label="Editorial refusals">
      <header className="pop-refusals-header">
        <p className="pop-kicker">★ THE REFUSALS · 拒否</p>
        <h2 className="pop-refusals-title">What kernel.chat doesn’t do.</h2>
        <p className="pop-refusals-deck">
          Brands are defined more by what they refuse than by what they do.
          This is the magazine’s standing list — the negative space that
          gives the editorial shape every other decision lands inside.
        </p>
      </header>
      <ol className="pop-refusals-list pop-refusals-list--feature">
        {REFUSALS.map((refusal, i) => (
          <li key={refusal.text} className="pop-refusals-item">
            <span className="pop-refusals-num">{String(i + 1).padStart(2, '0')}</span>
            <div className="pop-refusals-body">
              <p className="pop-refusals-text">{refusal.text}</p>
              {refusal.note && <p className="pop-refusals-note">{refusal.note}</p>}
            </div>
          </li>
        ))}
      </ol>
      <footer className="pop-refusals-footer">
        <p className="pop-folio">
          The list is editable, deliberately. Adding a refusal is an
          editorial commitment that constrains every future issue.
        </p>
      </footer>
    </section>
  )
}
