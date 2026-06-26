import type { IssueRecord, IssueAudit } from '../content/issues'
import './ColophonMonument.css'

/**
 * ColophonMonument — "THE AUDIT".
 *
 * The provenance receipt, staged as the issue's showpiece. The thing
 * every other magazine buries in masthead type — who drafted it, what
 * was verified, the design-grammar adherence, what was read vs cut,
 * when it pressed — kernel.chat elevates to a designed artifact, because
 * the audit IS the thesis ("file the audit in public").
 *
 * Honest by construction: renders only the rows the issue actually
 * declares in `issue.audit`. Returns null when none — strictly opt-in
 * per issue, never fabricated.
 */
const ROWS: Array<{ key: keyof IssueAudit; label: string; labelJp: string }> = [
  { key: 'drafted', label: 'DRAFTED', labelJp: '起草' },
  { key: 'verified', label: 'VERIFIED', labelJp: '検証' },
  { key: 'adherence', label: 'ADHERENCE', labelJp: '遵守' },
  { key: 'readCut', label: 'READ / CUT', labelJp: '採用と削除' },
  { key: 'pressed', label: 'PRESSED', labelJp: '刷了' },
]

export function ColophonMonument({ issue }: { issue: IssueRecord }) {
  const audit = issue.audit
  if (!audit) return null
  const rows = ROWS.filter((r) => audit[r.key])
  if (rows.length === 0) return null

  return (
    <section className="pop-audit" aria-label="The audit">
      <div className="pop-audit-inner">
        <p className="pop-audit-kicker">
          THE AUDIT · <span lang="ja">監査</span>
        </p>
        <hr className="pop-audit-rule" />
        <dl className="pop-audit-ledger">
          {rows.map((r) => (
            <div className="pop-audit-row" key={r.key}>
              <dt className="pop-audit-label">
                {r.label}{' '}
                <span className="pop-audit-label-jp" lang="ja">{r.labelJp}</span>
              </dt>
              <dd className="pop-audit-value">{audit[r.key]}</dd>
            </div>
          ))}
        </dl>
        <hr className="pop-audit-rule" />
        <p className="pop-audit-sign">
          <span className="pop-audit-star" aria-hidden="true">✱</span>
          file the audit in public
        </p>
      </div>
    </section>
  )
}
