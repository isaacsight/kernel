/**
 * DTFR Hero Component
 * 
 * High-contrast, typography-centric header for the System Compiler.
 * Implements the v2.1 "AI-Native" design philosophy.
 * 
 * Pattern Sources:
 * - Perplexity: Directness, authoritative typography
 * - Instrument Serif: High-contrast, italic wisdom
 * - JetBrains Mono: Execution metadata
 * 
 * @module modules/dtfr-hero
 */

const HERO_VARIANTS = {
  default: {
    title: 'The System Compiler',
    subtitle: 'Phase 1: Open Source. Translating human intent into verifiable audit trails.',
    tagline: 'OSS NATIVE RUNTIME ACTIVE'
  },
  spec: {
    title: 'Inquiry Specification',
    subtitle: 'Define the architectural boundaries of your next job.',
    tagline: 'SPECIFICATION MODE ACTIVE'
  },
  run: {
    title: 'Execution Stream',
    subtitle: 'Real-time trace of system operations and mission outcomes.',
    tagline: 'MONITORING ACTIVE RUNS'
  },
  pattern: {
    title: 'Intelligence patterns',
    subtitle: 'Synthesized learning from past executions and reasoning.',
    tagline: 'PATTERN RECOGNITION ONLINE'
  },
  log: {
    title: 'Reasoning Trace',
    subtitle: 'The transparent history of every system decision.',
    tagline: 'TRACING SYSTEM LOGIC'
  }
};

class DTFRHero extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._variant = 'default';
  }

  static get observedAttributes() {
    return ['data-variant', 'data-mode'];
  }

  connectedCallback() {
    this._variant = this.getAttribute('data-variant') ||
      this.getAttribute('data-mode') ||
      'default';
    this.render();
    this._startUpdateLoop();

    DTFR.bus.emit('module:mounted', {
      tagName: 'dtfr-hero',
      duration: 0,
      element: this
    });
  }

  _startUpdateLoop() {
    this._timer = setInterval(() => {
      const meta = this.shadowRoot.querySelector('.header-meta');
      if (meta) {
        const timestamp = new Date().toISOString().split('.')[0] + 'Z';
        meta.innerHTML = `<div class="live-pulse"></div> System Compiler v2.1 — ${timestamp}`;
      }
    }, 60000);
  }

  disconnectedCallback() {
    if (this._timer) clearInterval(this._timer);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      if (name === 'data-variant' || name === 'data-mode') {
        this._variant = newValue || 'default';
        this.render();
      }
    }
  }

  render() {
    const variant = HERO_VARIANTS[this._variant] || HERO_VARIANTS.default;
    const timestamp = new Date().toISOString().split('.')[0] + 'Z';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: var(--space-xl) 0;
          position: relative;
          overflow: hidden;
        }
        
        .ambient-bg {
          position: absolute;
          inset: 0;
          background: 
            radial-gradient(circle at 20% 30%, 
              var(--color-ai-ambient) 0%, 
              transparent 50%),
            radial-gradient(circle at 80% 70%, 
              var(--color-ai-ambient) 0%, 
              transparent 50%);
          z-index: 1;
          pointer-events: none;
        }

        .hero-grid {
          position: relative;
          z-index: 2;
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: var(--space-xl);
          align-items: center;
        }

        .header-meta {
          font-family: var(--font-code);
          font-size: var(--text-xs);
          color: var(--color-ai-active);
          text-transform: uppercase;
          letter-spacing: var(--tracking-wider);
          margin-bottom: var(--space-md);
          display: flex;
          align-items: center;
          gap: var(--space-sm);
        }

        .live-pulse {
          width: 6px;
          height: 6px;
          background: var(--color-ai-active);
          border-radius: 50%;
          animation: pulse-ambient 3s infinite;
        }

        @keyframes pulse-ambient {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        
        .title {
          font-family: var(--font-display);
          font-size: var(--text-4xl);
          font-weight: 400;
          color: var(--color-void);
          margin: 0 0 var(--space-md) 0;
          line-height: 1.1;
        }

        .subtitle {
          font-family: var(--font-interface);
          font-size: var(--text-base);
          color: var(--color-slate);
          margin: 0 0 var(--space-lg) 0;
          line-height: 1.6;
          max-width: 600px;
        }
        
        .tagline {
          font-family: var(--font-code);
          font-size: 10px;
          color: var(--color-mist);
          margin: 0;
          display: flex;
          align-items: center;
          gap: var(--space-md);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .tagline::before {
          content: "";
          width: 16px;
          height: 1px;
          background: var(--color-border);
        }

        @media (max-width: 1024px) {
          .hero-grid {
            grid-template-columns: 1fr;
            gap: var(--space-lg);
          }
          
          .title { font-size: var(--text-3xl); }
        }
      </style>
      
      <div class="ambient-bg"></div>
      
      <div class="hero-grid">
        <div class="hero-content">
          <div class="header-meta">
            <div class="live-pulse"></div>
            System Compiler v2.1 — ${timestamp}
          </div>
          
          <h1 class="title">${variant.title}</h1>
          <p class="subtitle">${variant.subtitle}</p>
          <p class="tagline">${variant.tagline}</p>
        </div>
        
        <div class="hero-monitor">
          <dtfr-context-panel></dtfr-context-panel>
        </div>
      </div>
    `;
  }
}

if (typeof DTFR !== 'undefined') {
  DTFR.registry.register('dtfr-hero', DTFRHero, {
    priority: 'instructive',
    version: '2.1.0',
    description: 'v2.1 Minimalist AI-Native Hero'
  });
} else {
  customElements.define('dtfr-hero', DTFRHero);
}

export { DTFRHero };
