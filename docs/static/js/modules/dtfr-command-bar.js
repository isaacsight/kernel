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
    }

    connectedCallback() {
        this.render();
        this._setupEventListeners();
    }

    _setupEventListeners() {
        const input = this.shadowRoot.querySelector('.command-input');
        const container = this.shadowRoot.querySelector('.command-bar');

        input.addEventListener('focus', () => {
            container.classList.add('focused');
            this._status = 'Listening...';
            this._updateStatus();
        });

        input.addEventListener('blur', () => {
            container.classList.remove('focused');
            this._status = 'Ready';
            this._updateStatus();
        });

        input.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                const query = input.value.trim();
                if (query) {
                    await this._processQuery(query);
                    input.value = '';
                }
            }
        });
    }

    async _processQuery(query) {
        this._status = 'Processing...';
        this._updateStatus();
        this.shadowRoot.querySelector('.command-bar').classList.add('active');

        // Emit for system processing
        DTFR.bus.emit('command:submit', { query, timestamp: Date.now() });

        // Simulate processing
        await new Promise(r => setTimeout(r, 1200));

        this._status = 'Ready';
        this._updateStatus();
        this.shadowRoot.querySelector('.command-bar').classList.remove('active');
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
          animation: slide 2s infinite linear;
        }

        @keyframes slide {
          from { background-position: -200% 0; }
          to { background-position: 200% 0; }
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
          min-width: 80px;
          text-align: right;
        }
      </style>
      
      <div class="command-bar">
        <div class="command-prompt">$</div>
        <input type="text" class="command-input" 
               placeholder="Ask anything about the system...">
        <div class="command-status">${this._status}</div>
      </div>
    `;
    }
}

if (typeof DTFR !== 'undefined') {
    DTFR.registry.register('dtfr-command-bar', DTFRCommandBar, {
        priority: 'instructive',
        version: '2.1.0-alpha',
        description: 'v2.1 Natural Language Command Interface'
    });
} else {
    customElements.define('dtfr-command-bar', DTFRCommandBar);
}

export { DTFRCommandBar };
