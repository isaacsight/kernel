/**
 * The Way of Code Demo Component
 *
 * A contemplative example of The Way applied to React components
 *
 * Philosophy:
 * - Chapter 11: Components as empty hubs - useful because of space
 * - Chapter 45: Great completion seems incomplete
 * - Chapter 81: True words aren't eloquent
 */

import React from 'react';

interface WayOfCodeDemoProps {
  children?: React.ReactNode;
}

/**
 * The Way of Code Demo
 *
 * This component embodies The Way:
 * - Minimal structure (empty hub)
 * - Generous spacing (breathing room)
 * - Literary aesthetic (contemplation over consumption)
 */
export const WayOfCodeDemo: React.FC<WayOfCodeDemoProps> = ({ children }) => {
  return (
    <article className="prose-container section-spacing">
      {/* Chapter 11: The Empty Hub */}
      <div className="empty-space" />

      {/* Display Typography - Chapter 45: Great skill seems clumsy */}
      <h1 className="display center">
        The Way of Code
      </h1>

      {/* Breathing Space */}
      <div style={{ height: 'var(--space-xl)' }} />

      {/* Body Content - Chapter 81: True words aren't eloquent */}
      <div className="reading-container flow">
        <p className="body center">
          <em>
            "The soft overcomes the hard. The slow overcomes the fast.
            <br />
            Let your code be like water."
          </em>
        </p>

        <blockquote className="card-contemplative">
          <p className="body">
            This interface embodies The Way of Code - Rick Rubin's adaptation
            of Lao Tzu's Tao Te Ching for software development.
          </p>
        </blockquote>

        {/* The Three Treasures */}
        <div className="content-spacing">
          <h2 className="heading-lg">The Three Treasures</h2>

          <div className="card-contemplative" style={{ marginTop: 'var(--space-lg)' }}>
            <h3 className="heading-lg">1. Wu Wei (Non-Action)</h3>
            <p className="body-secondary">
              Accomplish without forcing. Let solutions emerge naturally.
              Components that act without acting.
            </p>
          </div>

          <div className="card-contemplative" style={{ marginTop: 'var(--space-lg)' }}>
            <h3 className="heading-lg">2. Simplicity (P'u)</h3>
            <p className="body-secondary">
              Return to the uncarved block. Remove until you can't.
              Generous spacing lets ideas breathe.
            </p>
          </div>

          <div className="card-contemplative" style={{ marginTop: 'var(--space-lg)' }}>
            <h3 className="heading-lg">3. Humility (Qian)</h3>
            <p className="body-secondary">
              Serve without dominating. Lead by quiet example.
              Interfaces that guide without controlling.
            </p>
          </div>
        </div>

        {/* Design Principles */}
        <div className="content-spacing">
          <h2 className="heading-lg">Design Principles</h2>

          <ul className="body flow" style={{ listStyle: 'none', paddingLeft: 0 }}>
            <li>📖 <strong>Literary Minimalism</strong>: Reading first, interaction second</li>
            <li>🌬️ <strong>Generous Spacing</strong>: 100px padding, 1.5+ line-height</li>
            <li>⏳ <strong>Timeless Typography</strong>: Serif fonts for contemplation</li>
            <li>🎨 <strong>Natural Colors</strong>: Warm ivory + slate, not corporate blue</li>
            <li>💧 <strong>Fluid Interactions</strong>: Flow like water, never force</li>
          </ul>
        </div>

        {/* Call to Action - Minimal */}
        <div className="center" style={{ marginTop: 'var(--space-3xl)' }}>
          <a href="https://www.thewayofcode.com/" className="link-primary">
            Experience The Way of Code →
          </a>
        </div>

        {/* Custom children content */}
        {children && (
          <div className="content-spacing">
            {children}
          </div>
        )}
      </div>

      {/* Closing Space - Chapter 11 */}
      <div className="empty-space" />

      {/* Closing Wisdom */}
      <footer className="center">
        <p className="caption">
          <em>"When the work is done, log off and detach."</em>
          <br />
          — The Way of Code, Chapter 77
        </p>
      </footer>
    </article>
  );
};

export default WayOfCodeDemo;
