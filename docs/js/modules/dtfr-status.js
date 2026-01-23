/**
 * DTFR Status Component
 * 
 * Ambient system status indicator.
 * Implements the v2.1 "Ambient Intelligence" principle.
 * 
 * @module modules/dtfr-status
 */

class DTFRStatus extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._state = 'idle'; // idle, active, thinking, complete, error
    this._stats = {
      executions: 247,
      uptime: 99.7,
      latency: 42
    };
  }

  _setupBusListeners() {
    DTFR.bus.on('command:submit', () => this.setState('thinking'));
    DTFR.bus.on('console:intent-submitted', () => this.setState('thinking'));
    DTFR.bus.on('console:stack-generated', () => this.setState('active'));
    DTFR.bus.on('stack:execute', () => this.setState('thinking'));
    DTFR.bus.on('stack:complete', () => this.setState('complete'));
  }

  setState(state) {
    this._state = state;
    this.render();

    // Auto-revert to idle if in a transient state
    if (['complete', 'active', 'error'].includes(state)) {
      setTimeout(() => {
        this._state = 'idle';
        this.render();
      }, 5000);
    }
  }

  connectedCallback() {
    this.render();
    this._setupBusListeners();
  }

  render() {
    const stateColors = {
      idle: 'var(--color-mist)',
      active: 'var(--color-ai-active)',
      thinking: 'var(--color-ai-thinking)',
      complete: 'var(--color-ai-complete)',
      error: '#ef4444'
    };

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 1000;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          background: ${stateColors[this._state]};
          border-radius: 50%;
          animation: pulse-ambient 3s ease-in-out infinite;
          box-shadow: 0 0 12px ${stateColors[this._state]}44;
          transition: background 0.5s ease;
        }

        @keyframes pulse-ambient {
          0%, 100% { 
            opacity: 0.6; 
            transform: scale(1); 
          }
          50% { 
            opacity: 1; 
            transform: scale(1.2); 
          }
        }
      </style>
      
      <div class="status-dot" title="System Status: ${this._state.toUpperCase()}"></div>
    `;
  }
}

if (typeof DTFR !== 'undefined') {
  DTFR.registry.register('dtfr-status', DTFRStatus, {
    priority: 'ambient',
    version: '2.1.0',
    description: 'v2.1 Ambient Intelligence Indicator'
  });
} else {
  customElements.define('dtfr-status', DTFRStatus);
}

export { DTFRStatus };
