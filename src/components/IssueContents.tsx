import type { IssueRecord } from '../content/issues'

interface IssueContentsProps {
  issue: IssueRecord
}

/**
 * IssueContents — the numbered "In this issue" section.
 *
 * Shared by the live landing and every archive detail page so that
 * any issue's contents render the same way at any URL.
 */
export function IssueContents({ issue }: IssueContentsProps) {
  return (
    <section className="pop-contents pop-stock-ivory">
      <div className="pop-section-inner">

        <header className="pop-section-header">
          <span className="pop-kicker">CONTENTS · 目次</span>
          <hr className="pop-rule pop-rule--short pop-rule--tomato" />
          <h2 className="pop-display pop-section-title">
            In this issue
          </h2>
        </header>

        <ol className="pop-toc">
          {issue.contents.map((item) => (
            <li key={item.n} className="pop-row">
              <span className="pop-catalog-num">{item.n}.</span>
              <span className="pop-row-label">
                {item.en}
                <span className="pop-row-sub">{item.jp}</span>
              </span>
              <span className="pop-banner pop-banner--kraft">{item.tag}</span>
            </li>
          ))}
        </ol>

      </div>
    </section>
  )
}
