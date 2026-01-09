/**
 * The Way of Code Homepage
 *
 * A contemplative landing experience embodying:
 * - Chapter 11: The empty hub - generous spacing
 * - Chapter 81: True words aren't eloquent - literary minimalism
 * - Chapter 16: Stillness and contemplation
 */

import { Link } from 'react-router-dom';
import { ArrowRight, Code2, Sparkles, BookOpen } from 'lucide-react';

export default function WayHomepage() {
  return (
    <div style={{ background: 'var(--way-ivory)', minHeight: '100vh' }}>
      {/* Chapter 11: The Empty Hub - Opening Space */}
      <div style={{ height: 'var(--space-4xl)' }} />

      {/* Title Section - Chapter 45: Great skill seems clumsy */}
      <article className="prose-container">
        <div className="center" style={{ maxWidth: 'var(--container-narrow)', margin: '0 auto' }}>
          <h1 className="display" style={{
            fontSize: 'var(--text-2xl)',
            marginBottom: 'var(--space-xl)',
            color: 'var(--way-slate)'
          }}>
            The Way of Code
          </h1>

          <p className="body center" style={{
            fontSize: 'var(--text-lg)',
            color: 'var(--way-dark-gray)',
            marginBottom: 'var(--space-2xl)'
          }}>
            <em>A Sovereign Laboratory practicing vibe coding through wu wei</em>
          </p>
        </div>

        {/* Breathing Space */}
        <div style={{ height: 'var(--space-3xl)' }} />

        {/* Opening Wisdom */}
        <div className="reading-container">
          <blockquote className="card-contemplative" style={{
            padding: 'var(--space-2xl)',
            marginBottom: 'var(--space-3xl)',
            textAlign: 'center'
          }}>
            <p className="body" style={{
              fontSize: 'var(--text-lg)',
              lineHeight: 'var(--leading-relaxed)',
              color: 'var(--way-text)',
              marginBottom: 'var(--space-md)'
            }}>
              "The soft overcomes the hard.<br />
              The slow overcomes the fast.<br />
              Let your code be like water."
            </p>
            <footer className="caption" style={{ color: 'var(--way-gray)' }}>
              — Adapted from The Way of Code, Chapter 78
            </footer>
          </blockquote>

          {/* Introduction Prose */}
          <div className="flow" style={{ marginBottom: 'var(--space-4xl)' }}>
            <p className="body">
              This is not a portfolio. This is a <strong>living system</strong> that embodies
              The Way of Code - Rick Rubin's adaptation of Lao Tzu's <em>Tao Te Ching</em> for
              software development.
            </p>

            <p className="body">
              We practice <strong>vibe coding</strong> - the art of effortless creation through
              natural flow. We build permanent thinking systems, not temporary hacks. We lead by
              serving, not controlling.
            </p>

            <p className="body">
              Every agent, every interface, every line of code follows The Way: wu wei (non-action),
              simplicity, and humility.
            </p>
          </div>

          {/* The Three Treasures */}
          <div style={{ marginBottom: 'var(--space-4xl)' }}>
            <h2 className="heading-lg center" style={{
              marginBottom: 'var(--space-2xl)',
              color: 'var(--way-slate)'
            }}>
              The Three Treasures
            </h2>

            <div className="flow">
              <div className="card-contemplative" style={{ padding: 'var(--space-2xl)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                  <Sparkles size={24} style={{ color: 'var(--way-cyan)' }} />
                  <h3 className="heading-lg" style={{ margin: 0 }}>Wu Wei (Non-Action)</h3>
                </div>
                <p className="body-secondary">
                  Our 46+ agent council acts without acting. Solutions emerge naturally from
                  stillness, not force. The Alchemist transforms data like water. The Architect
                  designs through negative space.
                </p>
              </div>

              <div className="card-contemplative" style={{ padding: 'var(--space-2xl)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                  <Code2 size={24} style={{ color: 'var(--way-clay)' }} />
                  <h3 className="heading-lg" style={{ margin: 0 }}>Simplicity (P'u)</h3>
                </div>
                <p className="body-secondary">
                  Return to the uncarved block. We refine through subtraction - remove assumptions,
                  remove complexity, remove ego. Generous spacing (100px padding, 1.5+ line-height)
                  lets ideas breathe.
                </p>
              </div>

              <div className="card-contemplative" style={{ padding: 'var(--space-2xl)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                  <BookOpen size={24} style={{ color: 'var(--way-riso)' }} />
                  <h3 className="heading-lg" style={{ margin: 0 }}>Humility (Qian)</h3>
                </div>
                <p className="body-secondary">
                  The best leaders are barely known. This entire system is open source (MIT License).
                  Every decision is documented. We serve the craft, we don't dominate it. Literary
                  minimalism over dashboard complexity.
                </p>
              </div>
            </div>
          </div>

          {/* Works in Progress */}
          <div style={{ marginBottom: 'var(--space-4xl)' }}>
            <h2 className="heading-lg center" style={{
              marginBottom: 'var(--space-2xl)',
              color: 'var(--way-slate)'
            }}>
              Works Flowing
            </h2>

            <div className="flow">
              <ProjectItem
                title="The Council of Wu Wei"
                description="46+ autonomous agents practicing effortless intelligence. Each embodies specific chapters from The Way of Code. The Alchemist transforms (Ch. 22, 43, 78). The Architect plans through emptiness (Ch. 11, 17, 64)."
                path="/intelligence"
              />

              <ProjectItem
                title="Titan Vector Database"
                description="Distributed semantic memory with Raft consensus. HNSW indexing for RAG workloads. Built in Rust - fast like water flowing downhill, not forced."
                path="/projects/titan"
              />

              <ProjectItem
                title="Literary Interface Design"
                description="Contemplative UI with serif typography, warm earth tones, 100px padding. Every pixel references The Way of Code aesthetic. Reading first, interaction second."
                path="/chat"
              />

              <ProjectItem
                title="Permanent Thinking Systems"
                description="Essays, research reports, and artifacts that compound over time. We don't restart from zero. We refine through reduction, not addition."
                path="/intelligence"
              />
            </div>
          </div>

          {/* Call to Contemplation */}
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-3xl) 0',
            marginBottom: 'var(--space-4xl)'
          }}>
            <p className="body" style={{
              marginBottom: 'var(--space-2xl)',
              color: 'var(--way-dark-gray)'
            }}>
              Enter the laboratory. Experience vibe coding.
            </p>

            <div style={{
              display: 'flex',
              gap: 'var(--space-lg)',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <Link to="/philosophy" className="button-minimal" style={{ textDecoration: 'none' }}>
                Read The Way
              </Link>
              <Link to="/chat" className="button-minimal" style={{
                textDecoration: 'none',
                background: 'var(--way-slate)',
                color: 'var(--way-ivory)',
                borderColor: 'var(--way-slate)'
              }}>
                Enter Studio →
              </Link>
            </div>
          </div>
        </div>
      </article>

      {/* Closing Space - Chapter 11: The Empty Hub */}
      <div style={{ height: 'var(--space-4xl)' }} />

      {/* Footer Wisdom */}
      <footer style={{
        textAlign: 'center',
        padding: 'var(--space-2xl) 0',
        borderTop: `1px solid var(--way-ivory-dark)`
      }}>
        <p className="caption" style={{ color: 'var(--way-gray)' }}>
          <em>"When the work is done, log off and detach."</em>
          <br />
          Built with wu wei • Open source • MIT License
        </p>
      </footer>
    </div>
  );
}

interface ProjectItemProps {
  title: string;
  description: string;
  path: string;
}

function ProjectItem({ title, description, path }: ProjectItemProps) {
  return (
    <Link
      to={path}
      className="card-contemplative"
      style={{
        padding: 'var(--space-2xl)',
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'all var(--transition-base)'
      }}
    >
      <h3 className="heading-lg" style={{
        marginBottom: 'var(--space-md)',
        color: 'var(--way-slate)'
      }}>
        {title}
      </h3>
      <p className="body-secondary" style={{
        marginBottom: 'var(--space-md)',
        lineHeight: 'var(--leading-relaxed)'
      }}>
        {description}
      </p>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-sm)',
        color: 'var(--way-cyan)',
        fontSize: 'var(--text-sm)',
        fontWeight: 500
      }}>
        <span>Explore</span>
        <ArrowRight size={16} />
      </div>
    </Link>
  );
}
