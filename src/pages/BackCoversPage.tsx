import { Link } from 'react-router-dom'
import { ALL_ISSUES } from '../content/issues'
import { IssueBackCover } from '../components/IssueBackCover'
import { MagazineFrame } from '../components/MagazineFrame'

/**
 * /back-covers — the wall.
 *
 * Every issue with a declared backCover, rendered as a grid of small
 * verso tiles. Subjects rotate; the wall accretes. By ISSUE 391 the
 * wall is ten back covers; by 411 it's thirty and the wall reads as
 * the magazine's second face.
 *
 * Issues without a backCover are silently omitted — the absence of a
 * verso is editorial, not a hole.
 */
export function BackCoversPage() {
  const withBacks = ALL_ISSUES.filter((issue) => issue.backCover)
  // Show newest first so recent issues anchor the top of the wall.
  const ordered = [...withBacks].reverse()

  return (
    <MagazineFrame kicker="★ THE WALL · 裏面の壁">
      <div className="pop-section-inner pop-back-covers-page">
        <header className="pop-back-covers-header">
          <p className="pop-kicker">★ VERSO ARCHIVE · 裏面書庫</p>
          <h1 className="pop-back-covers-title">The Wall.</h1>
          <p className="pop-back-covers-deck">
            One still-life subject per issue, photographed under one light setup,
            laid out on one paper stock. The setup never changes; the subject
            rotates. By the tenth back the wall reads as a series; by the
            thirtieth it reads as the magazine's second face.
          </p>
          <p className="pop-back-covers-count">
            {ordered.length} {ordered.length === 1 ? 'verso' : 'versos'} filed
            {ordered.length > 0 && (
              <>
                {' · '}newest at top
              </>
            )}
          </p>
        </header>

        {ordered.length === 0 ? (
          <div className="pop-back-covers-empty">
            <p className="pop-folio">
              No back covers declared yet. The wall begins with the first
              issue whose verso is filed.
            </p>
          </div>
        ) : (
          <div className="pop-back-covers-grid">
            {ordered.map((issue) => {
              if (!issue.backCover) return null
              const dateline = `${monthRoman(issue.month)}·${issue.year.slice(-2)}`
              const inheritedStock = issue.coverStock ?? 'cream'
              return (
                <Link
                  key={issue.number}
                  to={`/issues/${issue.number}/back`}
                  className="pop-back-covers-tile"
                  aria-label={`Back cover of ISSUE ${issue.number} — ${issue.backCover.subject}`}
                >
                  <div className="pop-back-covers-tile-inner">
                    <IssueBackCover
                      backCover={issue.backCover}
                      dateline={dateline}
                      inheritedStock={inheritedStock}
                    />
                  </div>
                  <div className="pop-back-covers-tile-foot">
                    <span className="pop-back-covers-tile-num">
                      ISSUE {issue.number}
                    </span>
                    <span className="pop-back-covers-tile-feature">
                      {issue.feature}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        <div className="pop-back-covers-foot">
          <Link to="/issues" className="pop-folio">
            ← front-cover catalog
          </Link>
          <Link to="/refusals" className="pop-folio">
            the refusals →
          </Link>
        </div>
      </div>
    </MagazineFrame>
  )
}

function monthRoman(month: string): string {
  const map: Record<string, string> = {
    JAN: 'I', FEB: 'II', MAR: 'III', APR: 'IV', MAY: 'V', JUN: 'VI',
    JUL: 'VII', AUG: 'VIII', SEP: 'IX', OCT: 'X', NOV: 'XI', DEC: 'XII',
  }
  return map[month.slice(0, 3).toUpperCase()] ?? month.slice(0, 3)
}
