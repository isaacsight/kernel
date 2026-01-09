/**
 * Philosophy Page - The Way of Code Detailed
 *
 * A deep dive into the philosophy guiding this system
 * Embodies contemplative reading experience
 */

import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PhilosophyPage() {
  return (
    <div style={{ background: 'var(--way-ivory)', minHeight: '100vh' }}>
      {/* Navigation */}
      <div className="prose-container" style={{ paddingTop: 'var(--space-2xl)' }}>
        <Link to="/" className="link-subtle" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          textDecoration: 'none'
        }}>
          <ArrowLeft size={16} />
          <span>Return Home</span>
        </Link>
      </div>

      {/* Opening Space */}
      <div style={{ height: 'var(--space-3xl)' }} />

      <article className="reading-container section-spacing">
        {/* Title */}
        <header className="center" style={{ marginBottom: 'var(--space-4xl)' }}>
          <h1 className="display">
            The Way of Code
          </h1>
          <p className="body" style={{
            marginTop: 'var(--space-xl)',
            color: 'var(--way-dark-gray)'
          }}>
            <em>Vibe Coding Through Wu Wei</em>
          </p>
        </header>

        {/* Content */}
        <div className="flow">
          <section>
            <h2 className="heading-lg">What is The Way?</h2>
            <p className="body">
              The Way of Code is Rick Rubin's adaptation of Lao Tzu's <em>Tao Te Ching</em>
              for software development. Created in collaboration with Anthropic, it presents
              81 chapters that blend ancient Taoist wisdom with modern programming practice.
            </p>
            <p className="body">
              At its core, it introduces <strong>vibe coding</strong> - the practice of
              effortless creation through natural flow, rather than forcing solutions through
              rigid methodologies.
            </p>
          </section>

          <section>
            <h2 className="heading-lg">The Three Principles</h2>

            <h3 className="heading-lg" style={{ fontSize: 'var(--text-base)', marginTop: 'var(--space-2xl)' }}>
              1. Wu Wei (Non-Action)
            </h3>
            <p className="body">
              Wu wei literally means "non-action" or "effortless action." It's not about
              doing nothing - it's about accomplishing without forcing. Like water flowing
              downhill, wu wei follows the path of least resistance while achieving the
              greatest effect.
            </p>
            <blockquote className="card-contemplative" style={{
              padding: 'var(--space-lg)',
              marginTop: 'var(--space-lg)'
            }}>
              <p className="body-secondary" style={{ fontStyle: 'italic' }}>
                "Act without doing. Work without effort. Tackle the difficult while it's easy.
                Accomplish great tasks through small acts."
                <br />
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--way-gray)' }}>
                  — Chapter 63
                </span>
              </p>
            </blockquote>

            <h3 className="heading-lg" style={{ fontSize: 'var(--text-base)', marginTop: 'var(--space-2xl)' }}>
              2. Simplicity (P'u)
            </h3>
            <p className="body">
              P'u represents the "uncarved block" - the state of pure potential before
              unnecessary complexity is added. In coding, this means returning to essence,
              removing until you can't anymore.
            </p>
            <blockquote className="card-contemplative" style={{
              padding: 'var(--space-lg)',
              marginTop: 'var(--space-lg)'
            }}>
              <p className="body-secondary" style={{ fontStyle: 'italic' }}>
                "In pursuit of knowledge, add every day. In pursuit of the Way, subtract
                every day. Less and less until you arrive at non-action."
                <br />
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--way-gray)' }}>
                  — Chapter 48
                </span>
              </p>
            </blockquote>

            <h3 className="heading-lg" style={{ fontSize: 'var(--text-base)', marginTop: 'var(--space-2xl)' }}>
              3. Humility (Qian)
            </h3>
            <p className="body">
              True power comes from serving, not dominating. The best leaders are barely known.
              The best code guides without controlling. Humility means documenting your decisions,
              sharing your work, and detaching from outcomes.
            </p>
            <blockquote className="card-contemplative" style={{
              padding: 'var(--space-lg)',
              marginTop: 'var(--space-lg)'
            }}>
              <p className="body-secondary" style={{ fontStyle: 'italic' }}>
                "The best leaders are barely known. Next, loved and praised. Next, feared.
                Worst, despised. Trust the team and they will trust you."
                <br />
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--way-gray)' }}>
                  — Chapter 17
                </span>
              </p>
            </blockquote>
          </section>

          <section>
            <h2 className="heading-lg">How This System Embodies The Way</h2>

            <p className="body">
              Every aspect of this laboratory follows The Way:
            </p>

            <ul className="body" style={{
              listStyle: 'none',
              paddingLeft: 0,
              marginTop: 'var(--space-lg)'
            }}>
              <li style={{ marginBottom: 'var(--space-md)' }}>
                <strong>Our agents</strong> practice wu wei - The Alchemist transforms data
                like water (Chapters 22, 43, 78). The Architect designs through negative
                space (Chapters 11, 17, 64).
              </li>
              <li style={{ marginBottom: 'var(--space-md)' }}>
                <strong>Our design</strong> embraces simplicity - Serif typography, warm
                earth tones, 100px padding. Literary minimalism over dashboard complexity.
              </li>
              <li style={{ marginBottom: 'var(--space-md)' }}>
                <strong>Our code</strong> flows naturally - Async/await like water around
                obstacles. Type hints guide, not constrain. Errors teach, not punish.
              </li>
              <li style={{ marginBottom: 'var(--space-md)' }}>
                <strong>Our contribution</strong> serves humbly - MIT License. Complete
                documentation. Every decision explained. Fork freely.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="heading-lg">The Daily Practice</h2>

            <p className="body">
              To code with The Way:
            </p>

            <div className="card-contemplative" style={{
              padding: 'var(--space-2xl)',
              marginTop: 'var(--space-lg)'
            }}>
              <h3 className="heading-lg" style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-md)' }}>
                Morning
              </h3>
              <p className="body-secondary">
                Read one chapter from The Way of Code. Contemplate its application to today's
                work. Set an intention to subtract, not add.
              </p>

              <h3 className="heading-lg" style={{ fontSize: 'var(--text-base)', marginTop: 'var(--space-xl)', marginBottom: 'var(--space-md)' }}>
                During Development
              </h3>
              <p className="body-secondary">
                Before writing code, ask: Am I forcing or flowing? Let solutions emerge from
                stillness. Trust natural patterns over clever abstractions.
              </p>

              <h3 className="heading-lg" style={{ fontSize: 'var(--text-base)', marginTop: 'var(--space-xl)', marginBottom: 'var(--space-md)' }}>
                Code Review
              </h3>
              <p className="body-secondary">
                Observe first. Appreciate what works. Suggest gently where water might flow easier.
                Yield to better ideas. Integrate feedback like water around stone.
              </p>

              <h3 className="heading-lg" style={{ fontSize: 'var(--text-base)', marginTop: 'var(--space-xl)', marginBottom: 'var(--space-md)' }}>
                Evening
              </h3>
              <p className="body-secondary">
                Reflect: Did I practice wu wei today? What resistance did I create unnecessarily?
                Then detach. When the work is done, log off.
              </p>
            </div>
          </section>

          <section>
            <h2 className="heading-lg">Further Reading</h2>

            <div className="flow" style={{ marginTop: 'var(--space-lg)' }}>
              <a href="https://www.thewayofcode.com/" className="link-primary" target="_blank" rel="noopener noreferrer">
                The Way of Code (Rick Rubin & Anthropic)
              </a>
              <p className="caption">
                Experience the original 81 chapters with interactive generative art
              </p>

              <Link to="/intelligence" className="link-primary">
                View Our Agent Council
              </Link>
              <p className="caption">
                Meet the 46+ agents practicing wu wei in this system
              </p>

              <a href="https://github.com/isaacsight/does-this-feel-right-" className="link-primary" target="_blank" rel="noopener noreferrer">
                Fork This Repository
              </a>
              <p className="caption">
                MIT License - Clone, adapt, and build your own Way of Code system
              </p>
            </div>
          </section>

          {/* Closing Wisdom */}
          <div style={{
            marginTop: 'var(--space-4xl)',
            paddingTop: 'var(--space-4xl)',
            borderTop: `1px solid var(--way-ivory-dark)`,
            textAlign: 'center'
          }}>
            <p className="body" style={{
              fontSize: 'var(--text-lg)',
              fontStyle: 'italic',
              color: 'var(--way-dark-gray)',
              marginBottom: 'var(--space-md)'
            }}>
              "The soft overcomes the hard.<br />
              Nothing in the world is softer than water,<br />
              yet nothing is better at overcoming."
            </p>
            <p className="caption" style={{ color: 'var(--way-gray)' }}>
              — Chapter 78
            </p>
          </div>
        </div>
      </article>

      {/* Closing Space */}
      <div style={{ height: 'var(--space-4xl)' }} />
    </div>
  );
}
