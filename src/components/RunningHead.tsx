import { Link } from 'react-router-dom'
import './RunningHead.css'

/**
 * RunningHead — the publication's running head: the hairline folio
 * line a magazine prints at the top of a page, the title repeated
 * with a few standing links. Deliberately NOT a web nav bar — no
 * fill, no sticky float, no hamburger, CSS-only (editorial surface).
 *
 * It exists to answer the one thing a cover can't: a reader landing
 * cold on the current issue now has an immediate handhold to the
 * rest of the publication (Issues / About / The Refusals) without
 * scrolling to the footer. Rendered on the landing, above the cover;
 * inner pages already carry this affordance in their MagazineFrame
 * masthead. Hidden on paper.
 */
export function RunningHead() {
  return (
    <div className="pop-running-head">
      <div className="pop-running-head-inner">
        <Link to="/" className="pop-running-head-brand" aria-label="kernel.chat — cover">
          kernel<span className="pop-wordmark-dot">.</span>chat
        </Link>
        <nav className="pop-running-head-links" aria-label="Publication">
          <Link to="/issues">Issues</Link>
          <Link to="/about">About</Link>
          <Link to="/canvas">Canvas</Link>
          <Link to="/figma">Figma Spec</Link>
          <Link to="/refusals">The Refusals</Link>
        </nav>
      </div>
    </div>
  )
}
