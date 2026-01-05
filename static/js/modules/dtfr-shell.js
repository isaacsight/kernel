/**
 * DTFR Shell Component
 * 
 * v2.1 Native System Compiler Shell.
 * Orchestrates Specs, Runs, Patterns, and Logs.
 * 
 * @module modules/dtfr-shell
 */

const MODE_CONFIGS = {
  spec: {
    title: 'Specifications',
    description: 'Direct inquiry and architectural alignment',
    color: 'var(--color-ai-active)',
    icon: '📝',
    modules: [
      { name: 'dtfr-hero', priority: 'instructive', slot: 'hero', config: { variant: 'spec' } },
      { name: 'dtfr-command-bar', priority: 'instructive', slot: 'main' },
      { name: 'dtfr-stack', priority: 'adaptive', slot: 'sidebar' },
      { name: 'dtfr-flow', priority: 'adaptive', slot: 'footer' }
    ]
  },
  run: {
    title: 'Executions',
    description: 'Active system operations and verification traces',
    color: 'var(--color-void)',
    icon: '⚡',
    modules: [
      { name: 'dtfr-hero', priority: 'instructive', slot: 'hero', config: { variant: 'run' } },
      { name: 'dtfr-feed', priority: 'adaptive', slot: 'main', config: { type: 'runs' } },
      { name: 'dtfr-graph', priority: 'adaptive', slot: 'sidebar' },
      { name: 'dtfr-notes', priority: 'adaptive', slot: 'footer' }
    ]
  },
  pattern: {
    title: 'Intelligence',
    description: 'Synthesized learning and evolved system knowledge',
    color: 'var(--color-slate)',
    icon: '🌿',
    modules: [
      { name: 'dtfr-hero', priority: 'instructive', slot: 'hero', config: { variant: 'pattern' } },
      { name: 'dtfr-feed', priority: 'adaptive', slot: 'main', config: { type: 'patterns' } },
      { name: 'dtfr-feed', priority: 'adaptive', slot: 'sidebar', config: { type: 'github' } },
      { name: 'dtfr-notes', priority: 'adaptive', slot: 'footer' }
    ]
  },
  log: {
    title: 'Reasoning',
    description: 'Transparent trace of system logic and decisions',
    color: 'var(--color-mist)',
    icon: '📋',
    modules: [
      { name: 'dtfr-hero', priority: 'instructive', slot: 'hero', config: { variant: 'log' } },
      { name: 'dtfr-feed', priority: 'adaptive', slot: 'main', config: { type: 'log', limit: 10 } },
      { name: 'dtfr-graph', priority: 'adaptive', slot: 'sidebar' },
      { name: 'dtfr-flow', priority: 'adaptive', slot: 'footer' }
    ]
  }
};

class DTFRShell extends HTMLElement {
  static get observedAttributes() { return ['mode']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._mode = 'spec';
    this._mounted = false;
    this._moduleInstances = new Map();
  }

  connectedCallback() {
    this._mounted = true;
    this._mode = this.getAttribute('mode') || DTFR.context.get('mode') || 'spec';

    this._unsubscribe = DTFR.bus.on('context:changed', (data) => {
      if (data.changes.includes('mode')) this._setMode(data.next.mode, true);
    });

    // Adaptive Mode Transitions
    DTFR.bus.on('command:submit', (data) => {
      this._handleCommandIntent(data.query);
    });

    window.addEventListener('hashchange', this._handleHashChange.bind(this));
    this.render();
    this._composeModules();
    DTFR.bus.emit('shell:mounted', { mode: this._mode });
  }

  _handleCommandIntent(query) {
    const q = query.toLowerCase();
    if (q.includes('research') || q.includes('search') || q.includes('find')) {
      this._setMode('run');
    } else if (q.includes('spec') || q.includes('define') || q.includes('draft')) {
      this._setMode('spec');
    } else if (q.includes('pattern') || q.includes('learn') || q.includes('evolve')) {
      this._setMode('pattern');
    } else if (q.includes('log') || q.includes('reason') || q.includes('trace')) {
      this._setMode('log');
    }
  }

  disconnectedCallback() {
    this._mounted = false;
    this._unsubscribe?.();
    window.removeEventListener('hashchange', this._handleHashChange.bind(this));
    this._moduleInstances.forEach(i => i.remove());
    this._moduleInstances.clear();
  }

  _handleHashChange() {
    const hash = window.location.hash.slice(1);
    if (MODE_CONFIGS[hash]) this._setMode(hash);
  }

  _setMode(mode, fromContext = false) {
    if (!MODE_CONFIGS[mode] || mode === this._mode) return;
    const prevMode = this._mode;
    this._mode = mode;
    this.setAttribute('mode', mode);
    if (!fromContext) DTFR.context.set({ mode });
    if (window.location.hash.slice(1) !== mode) history.pushState(null, '', `#${mode}`);
    this._transitionToMode(prevMode, mode);
  }

  async _transitionToMode(from, to) {
    const container = this.shadowRoot.querySelector('.shell-content');
    if (!container) return;
    container.style.opacity = '0';
    await new Promise(r => setTimeout(r, 150));
    this._composeModules();
    container.style.opacity = '1';
    DTFR.bus.emit('shell:mode-changed', { prev: from, next: to });
  }

  _composeModules() {
    const config = MODE_CONFIGS[this._mode];
    if (!config) return;

    const slots = {
      hero: this.shadowRoot.querySelector('[data-slot="hero"]'),
      main: this.shadowRoot.querySelector('[data-slot="main"]'),
      sidebar: this.shadowRoot.querySelector('[data-slot="sidebar"]'),
      footer: this.shadowRoot.querySelector('[data-slot="footer"]')
    };

    Object.values(slots).forEach(slot => { if (slot) slot.innerHTML = ''; });
    this._moduleInstances.clear();

    config.modules.forEach((moduleConfig, index) => {
      const slot = slots[moduleConfig.slot];
      if (!slot) return;
      const element = document.createElement(moduleConfig.name);
      if (moduleConfig.config) {
        Object.entries(moduleConfig.config).forEach(([k, v]) => element.setAttribute(`data-${k}`, v));
      }
      element.setAttribute('data-priority', moduleConfig.priority);
      element.setAttribute('data-mode', this._mode);
      slot.appendChild(element);
      this._moduleInstances.set(`${moduleConfig.name}-${index}`, element);
    });
  }

  render() {
    const config = MODE_CONFIGS[this._mode];
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          min-height: 100vh;
          font-family: var(--font-interface);
          background: var(--color-canvas);
          color: var(--color-ink);
        }
        
        .shell-container {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }

        .mode-selector {
          display: flex;
          justify-content: center;
          gap: var(--space-2);
          padding: var(--space-4);
          background: var(--color-canvas);
          border-bottom: 2px solid var(--color-void);
          position: sticky;
          top: 0;
          z-index: 100;
        }
        
        .mode-btn {
          padding: var(--space-2) var(--space-4);
          background: transparent;
          border: 1px solid var(--color-border);
          color: var(--color-mist);
          cursor: pointer;
          font-family: var(--font-code);
          font-size: 10px;
          text-transform: uppercase;
          transition: all 0.2s;
        }
        
        .mode-btn:hover {
          color: var(--color-void);
          border-color: var(--color-void);
        }
        
        .mode-btn.active {
          background: var(--color-void);
          color: var(--color-canvas);
          border-color: var(--color-void);
        }
        
        .shell-content {
          flex: 1;
          display: grid;
          grid-template-areas: "hero hero" "main sidebar" "footer footer";
          grid-template-columns: 1fr 300px;
          grid-template-rows: auto auto auto;
          gap: var(--space-xl);
          padding: var(--space-xl);
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
          transition: opacity var(--duration-base) var(--ease-gentle);
        }
        
        [data-slot="hero"] { grid-area: hero; margin-bottom: var(--space-md); }
        [data-slot="main"] { grid-area: main; }
        [data-slot="sidebar"] { grid-area: sidebar; }
        [data-slot="footer"] { grid-area: footer; margin-top: var(--space-lg); }
        
        @media (max-width: 1024px) {
          .shell-content {
            grid-template-columns: 1fr;
            grid-template-areas: "hero" "main" "sidebar" "footer";
          }
        }
      </style>
      
      <div class="shell-container">
        <nav class="mode-selector">
          ${Object.entries(MODE_CONFIGS).map(([m, cfg]) => `
            <button class="mode-btn ${m === this._mode ? 'active' : ''}" data-mode="${m}">
              ${cfg.title}
            </button>
          `).join('')}
        </nav>
        <div class="shell-content">
          <div data-slot="hero"></div>
          <div data-slot="main"></div>
          <div data-slot="sidebar"></div>
          <div data-slot="footer"></div>
        </div>
      </div>
    `;

    this.shadowRoot.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => this._setMode(btn.dataset.mode));
    });
  }
}

if (typeof DTFR !== 'undefined') {
  DTFR.registry.register('dtfr-shell', DTFRShell, { priority: 'instructive', version: '2.1.0' });
} else {
  customElements.define('dtfr-shell', DTFRShell);
}
export { DTFRShell };
