/**
 * DTFR Compiler Flow Component
 * 
 * Step-by-step process visualization.
 * Implements the v2.1 "Reasoning Transparency" principle.
 * 
 * @module modules/dtfr-flow
 */

class DTFRFlow extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._steps = [
      { id: 'rewrite', index: '01', title: 'Rewrite', desc: 'Query expansion and intent distillation.', sub: 'Cognition' },
      { id: 'search', index: '02', title: 'Search', desc: 'Parallel retrieval via Perplexity & Web.', sub: 'Retrieval' },
      { id: 'synthesis', index: '03', title: 'Synthesis', desc: 'Evidence aggregation and cross-check.', sub: 'Analysis' },
      { id: 'finalization', index: '04', title: 'Finalization', desc: 'Final compile and provenance seal.', sub: 'Outcome' }
    ];
    this._activeStep = null;
  }

  connectedCallback() {
    this.render();
    this._setupBusListeners();

    DTFR.bus.emit('module:mounted', {
      tagName: 'dtfr-flow',
      duration: 0,
      element: this
    });
  }

  disconnectedCallback() {
    if (this._unsubscribe) this._unsubscribe();
  }

  _setupBusListeners() {
    this._unsubscribe = DTFR.bus.on('system:process-stage', (data) => {
      if (data && data.stage) {
        this._activeStep = data.stage;
        this.render();
      }
    });

    // Listen for intent submission to reset
    DTFR.bus.on('console:intent-submitted', () => {
      this._activeStep = 'rewrite';
      this.render();
    });
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
        }

        .compiler-flow {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          overflow: hidden;
          background: var(--color-canvas);
        }

        .flow-node {
          padding: var(--space-lg);
          border-right: 1px solid var(--color-border);
          position: relative;
          transition: all var(--duration-base) var(--ease-gentle);
          opacity: 0.5;
          filter: grayscale(1);
        }

        .flow-node.active {
          opacity: 1;
          filter: grayscale(0);
          background: var(--color-ai-ambient);
        }

        .flow-node:last-child {
          border-right: none;
        }

        .flow-index {
          font-family: var(--font-code);
          font-size: 9px;
          color: var(--color-mist);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: var(--space-sm);
        }

        .active .flow-index {
          color: var(--color-ai-active);
        }

        .flow-title {
          font-family: var(--font-display);
          font-size: var(--text-lg);
          color: var(--color-void);
          margin: 0 0 var(--space-xs) 0;
          font-weight: 400;
        }

        .flow-description {
          font-family: var(--font-interface);
          font-size: 12px;
          color: var(--color-slate);
          margin: 0;
          line-height: 1.5;
        }

        .flow-node.active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          height: 2px;
          width: 100%;
          background: linear-gradient(90deg, 
            transparent 0%, 
            var(--color-ai-active) 50%, 
            transparent 100%);
          opacity: 1;
          animation: scan 2s linear infinite;
        }

        @keyframes scan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .flow-node:hover {
          opacity: 1;
        }

        @media (max-width: 1024px) {
          .compiler-flow {
            grid-template-columns: 1fr 1fr;
          }
          .flow-node:nth-child(2) { border-right: none; }
          .flow-node:nth-child(1), .flow-node:nth-child(2) { border-bottom: 1px solid var(--color-border); }
        }

        @media (max-width: 600px) {
          .compiler-flow {
            grid-template-columns: 1fr;
          }
          .flow-node { border-right: none; border-bottom: 1px solid var(--color-border); }
          .flow-node:last-child { border-bottom: none; }
        }
      </style>
      
      <div class="compiler-flow">
        ${this._steps.map(step => `
          <div class="flow-node ${this._activeStep === step.id ? 'active' : ''}">
            <div class="flow-index">${step.index} / ${step.sub}</div>
            <h3 class="flow-title">${step.title}</h3>
            <p class="flow-description">${step.desc}</p>
          </div>
        `).join('')}
      </div>
    `;
  }
}

if (typeof DTFR !== 'undefined') {
  DTFR.registry.register('dtfr-flow', DTFRFlow, {
    priority: 'instructive',
    version: '2.2.0-beta',
    description: 'v2.2 Intelligence-aligned process flow'
  });
} else {
  customElements.define('dtfr-flow', DTFRFlow);
}

export { DTFRFlow };
