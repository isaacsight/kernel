import { useEffect } from 'react'
import { MagazineFrame } from '../components/MagazineFrame'
import { ALL_ISSUES } from '../content/issues'
import './IssuesPage.css'

/**
 * Back catalog — the archive index. Every issue ever published,
 * listed magazine-style: monument number + month/year + feature,
 * with hairline rules between rows. Newest at the top.
 */
export function IssuesPage() {
  useEffect(() => {
    document.body.classList.add('ka-scrollable-page')
    return () => { document.body.classList.remove('ka-scrollable-page') }
  }, [])

  const issuesNewestFirst = [...ALL_ISSUES].reverse()

  return (
    <MagazineFrame
      kicker="BACK CATALOG"
      title="The back catalog."
      titleJp="過去の号 — 全部、ここに。"
      page={6}
      deck="Every issue ever published. Browse the magazine like a back catalog — each cover preserved at its publication state."
      stock="cream"
    >
      <div className="pop-issues">

        <ol className="pop-issues-list">
          {issuesNewestFirst.map((issue) => (
            <li key={issue.number} className="pop-issues-row">
              <a href={`#/issues/${issue.number}`} className="pop-issues-link">
                <div className="pop-monument pop-issues-monument">
                  <span>ISSUE</span>
                  <strong>{issue.number}</strong>
                  <span>{issue.month} {issue.year}</span>
                </div>
                <div className="pop-issues-feature">
                  <span className="pop-kicker pop-kicker--tomato">FEATURE · {issue.number}</span>
                  <h2 className="pop-display pop-issues-feature-title">
                    {issue.headline.prefix}{' '}
                    <em>{issue.headline.emphasis}</em>{' '}
                    {issue.headline.suffix}
                  </h2>
                  <p className="pop-feature-jp pop-issues-feature-jp">{issue.featureJp}</p>
                </div>
                <div className="pop-issues-arrow">
                  <span className="pop-folio">READ →</span>
                </div>
              </a>
            </li>
          ))}
        </ol>

        <p className="pop-issues-note">
          <span className="pop-kicker">PUBLISHING NOTE · 編集後記</span>
          <br />
          New issues ship monthly from the terminal. Each cover is a snapshot:
          once an issue is published, its data file is frozen. The site itself
          is the archive.
        </p>

      </div>
    </MagazineFrame>
  )
}
