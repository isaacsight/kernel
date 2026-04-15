import type { IssueRecord } from '../content/issues'
import './IssueCredits.css'

interface IssueCreditsProps {
  issue: IssueRecord
}

/**
 * IssueCredits — editorial masthead block.
 * POPEYE-canonical: every issue lists who worked on it. Renders as
 * a two-column roster (role · name) on desktop, stacked on mobile,
 * inside a hairline-framed panel with a kicker and JP subtitle.
 */
export function IssueCredits({ issue }: IssueCreditsProps) {
  if (!issue.credits) return null
  const c = issue.credits

  const rows: Array<{ role: string; name: string }> = [
    { role: 'EDITOR-IN-CHIEF', name: c.editorInChief },
    { role: 'CREATIVE DIRECTION', name: c.creativeDirection },
    { role: 'ART DIRECTION', name: c.artDirection },
    { role: 'COPY', name: c.copy },
    ...(c.styling ? [{ role: 'STYLING', name: c.styling }] : []),
    ...(c.photography ? [{ role: 'PHOTOGRAPHY', name: c.photography }] : []),
    { role: 'JAPANESE', name: c.japanese },
    { role: 'PRODUCTION', name: c.production },
  ]

  return (
    <section className="pop-credits pop-stock-ivory" aria-labelledby="pop-credits-title">
      <div className="pop-credits-inner">

        <header className="pop-credits-header">
          <span className="pop-kicker">THE MASTHEAD · 編集部</span>
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          <h2 id="pop-credits-title" className="pop-display pop-credits-title">
            On this issue.
          </h2>
        </header>

        <dl className="pop-credits-list">
          {rows.map(({ role, name }) => (
            <div key={role} className="pop-credits-row">
              <dt className="pop-credits-role">{role}</dt>
              <dd className="pop-credits-name">{name}</dd>
            </div>
          ))}
        </dl>

        <p className="pop-folio pop-credits-note">
          {`ISSUE ${issue.number} \u00b7 ${issue.month} ${issue.year} \u00b7 ${issue.price}`}
        </p>

      </div>
    </section>
  )
}
