/**
 * DTFR Context Panel Component
 * 
 * Real-time system statistics and ambient awareness.
 * Implements the v2.1 "Living Documentation" principle.
 * 
 * @module modules/dtfr-context-panel
 */

class DTFRContextPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._stats = {
      executions: 247,
      uptime: 99.7,
      latency: 42,
      agents: 12
    };
  }

  connectedCallback() {
    this.render();
    this._setupListeners();
  }

  _setupListeners() {
    this._unsubscribe = DTFR.bus.on('system:telemetry', (data) => {
      this._stats = data;
      this._updateUI();
    });
  }

  disconnectedCallback() {
    this._unsubscribe?.();
  }

  _updateUI() {
    if (!this.shadowRoot) return;
    const slots = {
      executions: this.shadowRoot.getElementById('stat-executions'),
      uptime: this.shadowRoot.getElementById('stat-uptime'),
      latency: this.shadowRoot.getElementById('stat-latency')
    };

    if (slots.executions) slots.executions.textContent = this._stats.executions;
    if (slots.uptime) slots.uptime.textContent = this._stats.uptime;
    if (slots.latency) slots.latency.textContent = this._stats.latency;
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: var(--font-interface);
        }

        .context-panel {
          background: var(--color-ai-ambient);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-md);
          position: relative;
          overflow: hidden;
        }

        .context-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-md);
          padding-bottom: var(--space-sm);
          border-bottom: 1px solid var(--color-border);
        }

        .context-title {
          font-family: var(--font-code);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--color-slate);
        }

        .live-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-code);
          font-size: 8px;
          color: var(--color-ai-active);
        }

        .live-dot {
          width: 4px;
          height: 4px;
          background: var(--color-ai-active);
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .context-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-md);
        }

        .stat {
          display: flex;
          flex-direction: column;
        }

        .stat-value {
          font-family: var(--font-display);
          font-size: var(--text-2xl);
          color: var(--color-void);
          line-height: 1.2;
        }

        .stat-label {
          font-family: var(--font-code);
          font-size: 8px;
          color: var(--color-mist);
          text-transform: uppercase;
          margin-top: 2px;
        }

        .context-panel::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--color-ai-active), transparent);
          opacity: 0.2;
        }
      </style>
      
      <div class="context-panel">
        <div class="context-header">
          <div class="context-title">Live Context</div>
          <div class="live-indicator">
            <div class="live-dot"></div>
            LIVE
          </div>
        </div>
        
        <div class="context-stats">
          <div class="stat">
            <div id="stat-executions" class="stat-value">${this._stats.executions}</div>
            <div class="stat-label">Executions</div>
          </div>
          <div class="stat">
            <div id="stat-uptime" class="stat-value">${this._stats.uptime}%</div>
            <div class="stat-label">Uptime</div>
          </div>
          <div class="stat">
            <div id="stat-latency" class="stat-value">${this._stats.latency}ms</div>
            <div class="stat-label">Latency</div>
          </div>
          <div class="stat">
            <div class="stat-value">${this._stats.agents}</div>
            <div class="stat-label">Active Agents</div>
          </div>
        </div>
      </div>
    `;
  }
}

if (typeof DTFR !== 'undefined') {
  DTFR.registry.register('dtfr-context-panel', DTFRContextPanel, {
    priority: 'ambient',
    version: '2.1.0-alpha',
    description: 'v2.1 Real-time System Statistics'
  });
} else {
  customElements.define('dtfr-context-panel', DTFRContextPanel);
}

export { DTFRContextPanel };
