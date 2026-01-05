/**
 * DTFR Stack Component
 * 
 * Visual operation chain with integrated provenance (signatures & IDs).
 * Implements the v2.1 "AI-Native" design philosophy.
 * 
 * Pattern Sources:
 * - Unreal PCG: Node-based flow
 * - Perplexity: Traceability and source authority
 * - Instrument Serif: High-contrast signatures
 * 
 * @module modules/dtfr-stack
 */

const OPERATION_TYPES = {
  research: { icon: '🔍', label: 'Research', color: '#3b82f6' },
  spec: { icon: '📋', label: 'Specification', color: '#10b981' },
  scaffold: { icon: '🏗️', label: 'Scaffold', color: '#f59e0b' },
  dtfr: { icon: '✓', label: 'Gate', color: '#ef4444' },
  deploy: { icon: '🚀', label: 'Execution', color: '#3b82f6' }
};

const STATUS_TYPES = {
  pending: { label: 'Pending', class: 'pending' },
  running: { label: 'Compiling', class: 'running' },
  complete: { label: 'Verified', class: 'complete' },
  failed: { label: 'Failed', class: 'failed' }
};

class DTFRStack extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._operations = [];
    this._editable = false;
  }

  static get observedAttributes() {
    return ['data-operations', 'data-editable'];
  }

  connectedCallback() {
    const opsAttr = this.getAttribute('data-operations');
    if (opsAttr) {
      try {
        this._operations = JSON.parse(opsAttr);
      } catch (e) {
        this._operations = this._getDefaultOperations();
      }
    } else {
      this._operations = this._getDefaultOperations();
    }

    this._editable = this.getAttribute('data-editable') === 'true';
    this.render();
    this._setupBusListeners();

    DTFR.bus.emit('module:mounted', {
      tagName: 'dtfr-stack',
      duration: 0,
      element: this
    });
  }

  disconnectedCallback() {
    if (this._unsubscribe) this._unsubscribe();
  }

  _setupBusListeners() {
    this._unsubscribe = DTFR.bus.on('console:stack-generated', (data) => {
      if (data && data.stack) {
        this._operations = data.stack.map(op => ({
          ...op,
          sig: op.sig || 'antigravity.0x' + Math.random().toString(16).substr(2, 4),
          id: op.id || 'EX-' + Math.floor(Math.random() * 9000 + 1000)
        }));
        this.render();
      }
    });

    DTFR.bus.on('stack:execute', () => {
      this._operations = this._operations.map(op => {
        if (op.status === 'pending' || op.status === 'running') {
          return { ...op, status: 'complete' };
        }
        return op;
      });
      this.render();

      setTimeout(() => {
        DTFR.bus.emit('stack:complete', { operations: this._operations });
      }, 1500);
    });
  }

  _getDefaultOperations() {
    return [
      {
        type: 'research', status: 'complete', detail: 'Procedural v2.1 Patterns',
        sig: 'antigravity.0x8a2f', id: 'EX-9012'
      },
      {
        type: 'spec', status: 'complete', detail: 'AI-Native System Architecture',
        sig: 'antigravity.0x4d1e', id: 'EX-9013'
      },
      {
        type: 'scaffold', status: 'running', detail: 'Refactoring Component tokens',
        sig: 'antigravity.0x2b3c', id: 'EX-9014'
      },
      {
        type: 'dtfr', status: 'pending', detail: 'Verify functional honesty',
        sig: 'system.gate', id: 'EX-9015'
      }
    ];
  }

  _renderOperation(op, index) {
    const type = OPERATION_TYPES[op.type] || OPERATION_TYPES.research;
    const status = STATUS_TYPES[op.status] || STATUS_TYPES.pending;
    const sig = op.sig || 'system.unverified';
    const id = op.id || `EX-${Math.floor(Math.random() * 9000 + 1000)}`;

    return `
      <div class="operation ${status.class}" title="Click to view trace for ${id}">
        <div class="op-sidebar">
          <div class="op-icon" style="--op-color: ${type.color}">
            ${status.class === 'complete' ? '✓' : ''}
          </div>
          <div class="op-line"></div>
        </div>
        <div class="op-body">
          <div class="op-header">
            <span class="op-label">${type.label}</span>
            <span class="op-id">${id}</span>
          </div>
          <p class="op-detail">${op.detail}</p>
          <div class="op-provenance">
            <span class="op-sig">${sig}</span>
            <span class="op-status-text">${status.label}</span>
          </div>
        </div>
      </div>
    `;
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: var(--font-interface);
        }
        
        .stack-container {
          background: var(--color-canvas);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: var(--space-8);
          box-shadow: var(--shadow-xl);
          position: relative;
        }

        .stack-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-8);
          padding-bottom: var(--space-4);
          border-bottom: 2px solid var(--color-ink);
        }
        
        .stack-title {
          font-family: var(--font-display);
          font-size: var(--text-2xl);
          font-style: italic;
          color: var(--color-void);
          margin: 0;
        }
        
        .stack-meta {
          font-family: var(--font-code);
          font-size: 10px;
          color: var(--color-mist);
        }

        .operations {
          display: flex;
          flex-direction: column;
        }

        .operation {
          display: flex;
          gap: var(--space-4);
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .operation:hover {
            transform: translateX(4px);
        }

        .op-sidebar {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 20px;
        }

        .op-icon {
          width: 12px;
          height: 12px;
          border: 2px solid var(--op-color);
          border-radius: 50%;
          background: var(--color-canvas);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 8px;
          color: var(--op-color);
          z-index: 2;
        }

        .complete .op-icon {
          background: var(--op-color);
          color: var(--color-canvas);
        }

        .running .op-icon {
          animation: pulse 2s infinite;
          background: var(--op-color);
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }

        .op-line {
          width: 2px;
          flex: 1;
          background: var(--color-border);
          margin: 4px 0;
        }

        .operation:last-child .op-line {
          display: none;
        }

        .op-body {
          flex: 1;
          padding-bottom: var(--space-8);
        }

        .op-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: var(--space-1);
        }

        .op-label {
          font-weight: 600;
          font-size: var(--text-sm);
          color: var(--color-ink);
          text-transform: uppercase;
          letter-spacing: var(--tracking-wide);
        }

        .op-id {
          font-family: var(--font-code);
          font-size: 9px;
          color: var(--color-mist);
        }

        .op-detail {
          font-size: var(--text-sm);
          color: var(--color-slate);
          margin: 0 0 var(--space-2) 0;
          line-height: 1.4;
        }

        .op-provenance {
          display: flex;
          justify-content: space-between;
          font-family: var(--font-code);
          font-size: 10px;
        }

        .op-sig {
          color: var(--color-ai);
          opacity: 0.8;
          font-style: italic;
        }

        .op-status-text {
          color: var(--color-mist);
          text-transform: uppercase;
        }

        .complete .op-status-text { color: var(--color-success); }
        .running .op-status-text { color: var(--color-ai); }

        .stack-actions {
          display: flex;
          gap: var(--space-4);
          margin-top: var(--space-4);
        }
        
        .action-btn {
          flex: 1;
          padding: var(--space-3);
          background: var(--color-void);
          color: var(--color-canvas);
          border: none;
          font-family: var(--font-code);
          font-size: var(--text-xs);
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-btn:hover {
          background: var(--color-ai-active);
          color: var(--color-void);
        }

        .action-btn.secondary {
          background: transparent;
          border: 1px solid var(--color-border);
          color: var(--color-ink);
        }
      </style>
      
      <div class="stack-container">
        <header class="stack-header">
          <h3 class="stack-title">Execution Chain</h3>
          <div class="stack-meta">V2.2_INTEL // ${this._operations.length} NODES</div>
        </header>
        
        <div class="operations">
          ${this._operations.map((op, i) => this._renderOperation(op, i)).join('')}
        </div>
        
        ${this._editable ? `
          <div class="stack-actions">
            <button class="action-btn secondary">Refine Specs</button>
            <button class="action-btn primary">Execute Stack</button>
          </div>
        ` : ''}
      </div>
    `;

    if (this._editable) {
      this.shadowRoot.querySelector('.action-btn.primary')?.addEventListener('click', () => {
        DTFR.bus.emit('stack:execute', { operations: this._operations });
      });
    }
  }
}

if (typeof DTFR !== 'undefined') {
  DTFR.registry.register('dtfr-stack', DTFRStack, {
    priority: 'instructive',
    version: '2.2.0-beta',
    description: 'v2.2 Trace-ready Execution Stack'
  });
} else {
  customElements.define('dtfr-stack', DTFRStack);
}

export { DTFRStack };
