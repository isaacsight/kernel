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
            { index: '01', title: 'Capture', desc: 'Natural language specification capture.', sub: 'Inquiry' },
            { index: '02', title: 'Compile', desc: 'Recursive reasoning and stack generation.', sub: 'Reasoning' },
            { index: '03', title: 'Execute', desc: 'Deterministic engineering operations.', sub: 'Operation' },
            { index: '04', title: 'Verify', desc: 'Outcome validation and ledger entry.', sub: 'Verification' }
        ];
    }

    connectedCallback() {
        this.render();
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

        .flow-node:hover {
          background: var(--color-ai-ambient);
        }

        .flow-node:hover::after {
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
          <div class="flow-node">
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
        version: '2.1.0-alpha',
        description: 'v2.1 Multi-stage process visualization'
    });
} else {
    customElements.define('dtfr-flow', DTFRFlow);
}

export { DTFRFlow };
