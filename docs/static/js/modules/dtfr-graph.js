/**
 * DTFR Reasoning Graph Component
 * 
 * Visual representation of the system workflow.
 * Implements the v2.1 "Graph-Based Thinking" principle.
 * 
 * @module modules/dtfr-graph
 */

class DTFRGraph extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._nodes = ['Specs', 'Runs', 'Patterns', 'Logs'];
    }

    connectedCallback() {
        this.render();
        this._setupEventListeners();
    }

    _setupEventListeners() {
        const nodes = this.shadowRoot.querySelectorAll('.graph-node');
        nodes.forEach(node => {
            node.addEventListener('click', () => {
                const type = node.getAttribute('data-type');
                if (type) {
                    DTFR.bus.emit('graph:node-click', { type });
                    // Optional: Update shell mode
                    if (window.DTFR?.context) {
                        DTFR.context.set({ mode: type.toLowerCase().replace(/s$/, '') });
                    }
                }
            });
        });
    }

    render() {
        this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: var(--space-md) 0;
        }

        .reasoning-graph {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: var(--space-lg);
          background: var(--color-canvas);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
        }

        .graph-nodes {
          display: flex;
          align-items: center;
          gap: var(--space-md);
        }

        .graph-node {
          font-family: var(--font-code);
          font-size: 11px;
          color: var(--color-slate);
          padding: var(--space-xs) var(--space-sm);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all var(--duration-base) var(--ease-gentle);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          background: var(--color-canvas);
        }

        .graph-node:hover {
          color: var(--color-ai-active);
          border-color: var(--color-ai-active);
          background: var(--color-ai-ambient);
          box-shadow: var(--shadow-glow);
          transform: translateY(-2px);
        }

        .graph-arrow {
          color: var(--color-mist);
          font-family: var(--font-mono);
          user-select: none;
        }

        .graph-cycle {
          color: var(--color-ai-active);
          font-family: var(--font-mono);
          font-size: 18px;
          margin-left: var(--space-sm);
          animation: rotate 10s linear infinite;
          cursor: help;
        }

        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 600px) {
          .graph-nodes {
            flex-wrap: wrap;
            justify-content: center;
          }
          .graph-arrow { transform: rotate(90deg); }
        }
      </style>
      
      <div class="reasoning-graph">
        <div class="graph-nodes">
          <div class="graph-node" data-type="Specs">Specs</div>
          <div class="graph-arrow">→</div>
          <div class="graph-node" data-type="Runs">Runs</div>
          <div class="graph-arrow">→</div>
          <div class="graph-node" data-type="Patterns">Patterns</div>
          <div class="graph-arrow">→</div>
          <div class="graph-node" data-type="Logs">Logs</div>
          <div class="graph-cycle" title="Cyclical Compilation">⟲</div>
        </div>
      </div>
    `;
    }
}

if (typeof DTFR !== 'undefined') {
    DTFR.registry.register('dtfr-graph', DTFRGraph, {
        priority: 'adaptive',
        version: '2.1.0-alpha',
        description: 'v2.1 Visual Workflow Graph'
    });
} else {
    customElements.define('dtfr-graph', DTFRGraph);
}

export { DTFRGraph };
