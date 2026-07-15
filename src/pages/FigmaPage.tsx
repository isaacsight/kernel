import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ISSUE } from '../content/issue'
import { MagazineFrame } from '../components/MagazineFrame'
import './FigmaPage.css'

/**
 * /figma — the Figma integration guide and visual spec sheet.
 *
 * Details the strict boundary between the drafting table (Figma)
 * and the press (pure CSS). Documents the variable mirror maps
 * and the hand-finish motion checklist.
 */
export function FigmaPage() {
  useEffect(() => {
    document.body.classList.add('ka-scrollable-page')
    return () => { document.body.classList.remove('ka-scrollable-page') }
  }, [])

  return (
    <MagazineFrame
      kicker="FIGMA SPEC · 設計仕様"
      title="Figma as a drafting table."
      titleJp="設計図としてのフィグマ"
      deck="Mirroring kernel.chat tokens as Figma variables, and the rules of the motion contract."
      stock="ivory"
    >
      <div className="pop-section-inner">
        <div className="pop-figma-page">
          
          <section className="pop-figma-section">
            <h2>The premise.</h2>
            <p>
              Figma is a <em>drafting table</em>, not the press. We mirror our design tokens
              into Figma variables so our comps stay strictly on-grammar—then we transcribe
              finished work back into CSS <strong>by hand</strong>. The CSS in this repository is the
              single source of truth; the Figma file is a sketch of it, never the reverse. No code
              generators, no component exports, and no automatic translation layers.
            </p>
          </section>

          <section className="pop-figma-section">
            <h2>The Variable Mirror.</h2>
            <p>
              Every Figma variable is named after the CSS custom property it represents, replacing
              the leading hyphens with folders: <code>--pop-tomato</code> becomes{' '}
              <code>color/spot/tomato</code>. This mechanical naming ensures that when you read
              a design comp, the variables already tell you the exact CSS variables to write.
            </p>

            <h3>1. Color Primitives (color/*)</h3>
            <div className="pop-figma-table-wrapper">
              <table className="pop-figma-table">
                <thead>
                  <tr>
                    <th>CSS Custom Property</th>
                    <th>Figma Variable Path</th>
                    <th>Value / Role</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>--pop-ivory</code></td>
                    <td><code>color/pop-stock/ivory</code></td>
                    <td><code>#FAF9F6</code> (Serious-sober stock)</td>
                  </tr>
                  <tr>
                    <td><code>--pop-cream</code></td>
                    <td><code>color/pop-stock/cream</code></td>
                    <td><code>#F3E9D2</code> (Anchor paper ground)</td>
                  </tr>
                  <tr>
                    <td><code>--pop-butter</code></td>
                    <td><code>color/pop-stock/butter</code></td>
                    <td><code>#EFD9A0</code> (Summer reading stock)</td>
                  </tr>
                  <tr>
                    <td><code>--pop-kraft</code></td>
                    <td><code>color/pop-stock/kraft</code></td>
                    <td><code>#C8A97E</code> (Outdoor field stock)</td>
                  </tr>
                  <tr>
                    <td><code>--pop-ledger</code></td>
                    <td><code>color/pop-stock/ledger</code></td>
                    <td><code>#F2EFE2</code> (Audit ledger stock)</td>
                  </tr>
                  <tr>
                    <td><code>--pop-ink</code></td>
                    <td><code>color/pop-stock/ink</code></td>
                    <td><code>#1F1E1D</code> (Night ground / primary dark)</td>
                  </tr>
                  <tr>
                    <td><code>--pop-tomato</code></td>
                    <td><code>color/spot/tomato</code></td>
                    <td><code>#E24E1B</code> (The only spot color)</td>
                  </tr>
                  <tr>
                    <td><code>--pop-hairline</code></td>
                    <td><code>color/rule/hairline</code></td>
                    <td><code>rgba(31,30,29,0.85)</code> (Divider rule)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="pop-figma-callout">
              <p>
                <strong>★ Guardrail:</strong> Never use pure <code>#FFFFFF</code> on a canvas.
                Figma defaults all frames to white; the first move on any kernel.chat composition
                is to paint the ground with <code>color/pop-stock/ivory</code> or <code>cream</code>.
              </p>
            </div>

            <h3>2. Spacing & Radii (space/*, radius/*)</h3>
            <div className="pop-figma-table-wrapper">
              <table className="pop-figma-table">
                <thead>
                  <tr>
                    <th>CSS Custom Property</th>
                    <th>Figma Variable Path</th>
                    <th>Value (px)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>--space-xs</code> to <code>--space-4xl</code></td>
                    <td><code>space/xs</code> to <code>space/4xl</code></td>
                    <td>4 · 8 · 12 · 16 · 24 · 32 · 48 · 64</td>
                  </tr>
                  <tr>
                    <td><code>--radius-xs</code> to <code>--radius-lg</code></td>
                    <td><code>radius/xs</code> to <code>radius/lg</code></td>
                    <td>3 · 6 · 10 · 20</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="pop-figma-section">
            <h2>What does not map.</h2>
            <p>
              Two parts of the visual grammar cannot live in Figma variables without creating drift:
            </p>
            <ul>
              <li>
                <strong>The adaptive accent system:</strong> We derive five tones (strong, muted,
                whisper, ink) using OKLCH relative color calculations based on the stock page ground.
                Figma cannot run <code>oklch()</code> math dynamically; these tones remain pure CSS.
              </li>
              <li>
                <strong>Motion definitions:</strong> Easing curves and spring animations do not map
                to static color or float tokens.
              </li>
            </ul>
          </section>

          <section className="pop-figma-section">
            <h2>The Motion Contract.</h2>
            <p>
              Triggered by Config 2026's release of Figma Motion: we distinguish between the{' '}
              <em>design authoring tool</em> (Figma Motion) and the <em>runtime animation library</em>{' '}
              (Framer Motion / <code>motion.dev</code>).
            </p>
            <p>
              The magazine is paper; its character is stillness. Framer Motion is banned.
              Figma Motion timeline specs are welcome, but only their pure CSS translations may ship
              to the repository.
            </p>

            <h3>The Hand-Finish Checklist:</h3>
            <ol>
              <li>
                <strong>Re-clamp amplitude:</strong> Ambient accents must be imperceptible:
                amplitudes <code>≤ 8% opacity</code> or <code>≤ 4px translate</code>.
              </li>
              <li>
                <strong>Respect overrides:</strong> Ensure keyframes collapse under the site-wide{' '}
                <code>prefers-reduced-motion</code> rule.
              </li>
              <li>
                <strong>Animate responsibly:</strong> Use only <code>opacity</code> and{' '}
                <code>transform</code> to avoid layout thrashing.
              </li>
              <li>
                <strong>Strip JS riders:</strong> No import of JS runtime players or Lottie blocks.
              </li>
            </ol>
          </section>

          <div className="pop-figma-monument-row">
            <div className="pop-monument pop-monument--sm">
              <span>DRAFTING TABLE SPEC</span>
              <strong>図面と印刷</strong>
              <span>STILLNESS RULE</span>
            </div>
          </div>

          <section className="pop-figma-section">
            <h2>Local setup.</h2>
            <p>
              To read variables and preview canvas comps directly in your terminal agent, configure
              the local link:
            </p>
            <pre className="pop-figma-code">
{`1. Figma Desktop → Preferences → Enable Dev Mode MCP Server
2. Run command:
   claude mcp add --transport http figma http://127.0.0.1:3845/mcp
3. Query variable definitions and copy CSS values`}
            </pre>
          </section>

          <div className="pop-figma-page-foot">
            <Link to="/" className="pop-folio">
              ← back to ISSUE {ISSUE.number}
            </Link>
            <Link to="/about" className="pop-folio">
              About →
            </Link>
          </div>

        </div>
      </div>
    </MagazineFrame>
  )
}
