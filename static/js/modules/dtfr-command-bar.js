/**
 * DTFR Command Bar Component
 * 
 * Natural language interface for the System Compiler.
 * Implements the v2.1 "Minimal Time-to-Answer" principle.
 * 
 * @module modules/dtfr-command-bar
 */

class DTFRCommandBar extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._status = 'Ready';
    this._history = [];
    this._isProcessing = false;
  }

  connectedCallback() {
    this.render();
    this._setupEventListeners();
    this._setupBusListeners();

    DTFR.bus.emit('module:mounted', {
      tagName: 'dtfr-command-bar',
      duration: 0,
      element: this
    });
  }

  disconnectedCallback() {
    if (this._unsubscribe) this._unsubscribe();
  }

  _setupBusListeners() {
    this._unsubscribe = DTFR.bus.on('system:process-stage', (data) => {
      if (data && data.message) {
        this._status = data.message;
        this._updateStatus();
      }
      if (data && data.stage === 'finalization') {
        setTimeout(() => {
          this._isProcessing = false;
          this._status = 'Ready';
          this._updateStatus();
          this.shadowRoot.querySelector('.command-bar').classList.remove('active');
        }, 1000);
      }
    });
  }

  _setupEventListeners() {
    const input = this.shadowRoot.querySelector('.command-input');
    const container = this.shadowRoot.querySelector('.command-bar');

    input.addEventListener('focus', () => {
      container.classList.add('focused');
      if (!this._isProcessing) {
        this._status = 'Listening...';
        this._updateStatus();
      }
    });

    input.addEventListener('blur', () => {
      container.classList.remove('focused');
      if (!this._isProcessing) {
        this._status = 'Ready';
        this._updateStatus();
      }
    });

    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const query = input.value.trim();
        if (query && !this._isProcessing) {
          await this._processQuery(query);
          input.value = '';
        }
      }
    });
  }

  async _processQuery(query) {
    this._isProcessing = true;
    this._status = 'Initializing...';
    this._updateStatus();
    this.shadowRoot.querySelector('.command-bar').classList.add('active');

    // Emit for system processing
    DTFR.bus.emit('command:submit', { query, timestamp: Date.now() });

    // This component now relies on system:process-stage events to update status
  }

  _updateStatus() {
    const statusEl = this.shadowRoot.querySelector('.command-status');
    if (statusEl) statusEl.textContent = this._status;
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          max-width: 800px;
          margin: 0 auto;
          width: 100%;
        }

        .command-bar {
          background: transparent;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: var(--space-sm) var(--space-md);
          transition: all var(--duration-base) var(--ease-gentle);
          display: flex;
          align-items: center;
          gap: var(--space-md);
          position: relative;
        }

        .command-bar.focused {
          background: var(--color-canvas);
          box-shadow: var(--shadow-depth);
          border-color: var(--color-ai-active);
          transform: translateY(-2px);
        }

        .command-bar.active::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--color-ai-active), transparent);
          background-size: 200% 100%;
          animation: slide 2s infinite linear;
        }

        @keyframes slide {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }

        .command-prompt {
          font-family: var(--font-code);
          color: var(--color-ai-active);
          font-weight: bold;
          font-size: var(--text-lg);
        }

        .command-input {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--color-void);
          font-family: var(--font-interface);
          font-size: var(--text-base);
          outline: none;
          padding: var(--space-xs) 0;
        }

        .command-input::placeholder {
          color: var(--color-mist);
          opacity: 0.5;
        }

        .command-status {
          font-family: var(--font-code);
          font-size: 10px;
          color: var(--color-mist);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          min-width: 120px;
          text-align: right;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      </style>
      
      <div class="command-bar">
        <div class="command-prompt">$</div>
        <input type="text" class="command-input" 
               placeholder="Ask anything about the system..."
               autofocus>
        <div class="command-status">${this._status}</div>
      </div>
    `;
  }
}

if (typeof DTFR !== 'undefined') {
  DTFR.registry.register('dtfr-command-bar', DTFRCommandBar, {
    priority: 'instructive',
    version: '2.2.0-beta',
    description: 'v2.2 Trace-ready Command Interface'
  });
} else {
  customElements.define('dtfr-command-bar', DTFRCommandBar);
}

export { DTFRCommandBar };
