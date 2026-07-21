/* THE STACKS — the back catalog as a walkable room.
   The ledger (real headings + links below) is the resting
   structure: complete, keyboard-first, screen-reader-first. The
   drifting bodies mount on top only when WebGL2 exists. */
import { lazy, Suspense, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ALL_ISSUES } from '../content/issues'
import { groupIntoVolumes } from '../stacks/volumes'
import { webglAvailable } from '../stacks/webgl'
import './ArchivePage.css'

const StacksScene = lazy(() =>
  import('../stacks/Scene').then((m) => ({ default: m.StacksScene })),
)

export function ArchivePage() {
  const volumes = useMemo(() => groupIntoVolumes(ALL_ISSUES), [])
  const walkable = useMemo(() => webglAvailable(), [])

  return (
    <div className="stacks-room pop-stock-ink">
      {walkable && (
        <Suspense fallback={null}>
          <StacksScene volumes={volumes} />
        </Suspense>
      )}

      <header className="stacks-masthead">
        <p className="pop-folio">
          THE STACKS · 書庫 — every issue, shelved in the dark.{' '}
          <Link to="/issues">Prefer the flat catalog →</Link>
        </p>
      </header>

      <nav className="stacks-ledger" aria-label="The ledger — every volume and issue">
        {volumes.map((volume) => (
          <section key={volume.label} className="stacks-volume">
            <h2 className="stacks-volume-lockup">
              <span>{volume.label}</span>
              <span lang="ja">{volume.labelJp}</span>
            </h2>
            <ul>
              {volume.issues.map((issue) => (
                <li key={issue.number}>
                  <Link to={`/issues/${issue.number}`} data-stacks-issue={issue.number}>
                    <span className="pop-folio">N°{issue.number}</span>{' '}
                    {issue.feature}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
    </div>
  )
}
