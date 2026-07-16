import { useEffect } from 'react'
import { MagazineFrame } from '../components/MagazineFrame'
import { ALL_ISSUES } from '../content/issues'
import './IssuesPage.css'

const MONTH_LABELS: Record<string, string> = {
  JAN: 'January', FEB: 'February', MAR: 'March', APR: 'April',
  MAY: 'May', JUN: 'June', JUL: 'July', AUG: 'August',
  SEP: 'September', OCT: 'October', NOV: 'November', DEC: 'December',
}

function monthKey(month: string) {
  return month.trim().slice(0, 3).toUpperCase()
}

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
  const [latestIssue, ...archiveIssues] = issuesNewestFirst
  const volumes = archiveIssues.reduce((groups, issue) => {
    const month = monthKey(issue.month)
    const key = `${issue.year}-${month}`
    const existing = groups.get(key)
    if (existing) existing.issues.push(issue)
    else groups.set(key, {
      key,
      label: `${MONTH_LABELS[month] ?? issue.month} ${issue.year}`,
      issues: [issue],
    })
    return groups
  }, new Map<string, { key: string; label: string; issues: typeof archiveIssues }>())

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

        {latestIssue && (
          <article className="pop-issues-current">
            <a
              href={`#/issues/${latestIssue.number}`}
              className="pop-issues-current-link"
              aria-label={`Read issue ${latestIssue.number}: ${latestIssue.feature}`}
            >
              <div className="pop-issues-current-meta">
                <span className="pop-kicker pop-kicker--tomato">ON STANDS NOW · 最新号</span>
                <span className="pop-folio">{latestIssue.month} {latestIssue.year}</span>
              </div>
              <div className="pop-issues-current-lockup">
                <span className="pop-issues-current-number" aria-hidden="true">{latestIssue.number}</span>
                <div>
                  <h2 className="pop-display pop-issues-current-title">
                    {latestIssue.headline.prefix}{' '}
                    <em>{latestIssue.headline.emphasis}</em>{' '}
                    {latestIssue.headline.suffix}
                  </h2>
                  <p className="pop-issues-current-jp" lang="ja">{latestIssue.featureJp}</p>
                  <p className="pop-swash pop-issues-current-deck">
                    {latestIssue.coverDeck ?? latestIssue.headline.swash}
                  </p>
                </div>
              </div>
              <span className="pop-folio pop-issues-current-cta">READ THE CURRENT ISSUE <span aria-hidden="true">→</span></span>
            </a>
          </article>
        )}

        <div className="pop-issues-volumes">
          {[...volumes.values()].map((volume) => (
            <section key={volume.key} className="pop-issues-volume">
              <header className="pop-issues-volume-head">
                <h2>{volume.label}</h2>
                <span className="pop-folio">{volume.issues.length} {volume.issues.length === 1 ? 'ISSUE' : 'ISSUES'}</span>
              </header>
              <ol className="pop-issues-list">
                {volume.issues.map((issue) => (
                  <li key={issue.number} className="pop-issues-row">
                    <a
                      href={`#/issues/${issue.number}`}
                      className="pop-issues-link"
                      aria-label={`Read issue ${issue.number}: ${issue.feature}`}
                    >
                      <span className="pop-issues-number">{issue.number}</span>
                      <div className="pop-issues-feature">
                        <h3 className="pop-display pop-issues-feature-title">
                          {issue.headline.prefix}{' '}
                          <em>{issue.headline.emphasis}</em>{' '}
                          {issue.headline.suffix}
                        </h3>
                        <p className="pop-issues-feature-jp" lang="ja">{issue.featureJp}</p>
                      </div>
                      <span className="pop-issues-arrow" aria-hidden="true">→</span>
                    </a>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>

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
