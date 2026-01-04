/**
 * DTFR Console Component
 * 
 * Transparent interface for intent submission and compiler feedback.
 * Implements the v2.1 "AI-Native" design philosophy.
 * 
 * Pattern Sources:
 * - A2UI/Agentic-UI: Intent-driven rendering
 * - Perplexity: Minimal latency, immediate feedback
 * - Instrument Serif: High-contrast typography
 * 
 * @module modules/dtfr-console
 */

class DTFRConsole extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._history = [];
    this._isProcessing = false;
    this._placeholder = "$ Input Specification Intent...";
  }

  connectedCallback() {
    this.render();
    this._setupEventListeners();

    DTFR.bus.emit('module:mounted', {
      tagName: 'dtfr-console',
      duration: 0,
      element: this
    });
  }

  _setupEventListeners() {
    const input = this.shadowRoot.querySelector('.console-input');
    const form = this.shadowRoot.querySelector('.console-form');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const intent = input.value.trim();
      if (intent && !this._isProcessing) {
        await this._processIntent(intent);
        input.value = '';
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        form.requestSubmit();
      }
    });
  }

  async _processIntent(intent) {
    this._isProcessing = true;
    this._addHistory('user', intent);
    this.render();

    DTFR.bus.emit('console:intent-submitted', { intent });

    // Technical feedback instead of chatty ghost
    this._addHistory('system', 'Parsing intent metadata...');
    this.render();

    await new Promise(resolve => setTimeout(resolve, 800));

    this._addHistory('system', 'Compiling operation stack...', 'active');
    this.render();

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock response
    const mockStack = [
      { type: 'research', status: 'complete', detail: `Extracting ${intent} patterns` },
      { type: 'spec', status: 'running', detail: 'Drafting system specification' },
      { type: 'scaffold', status: 'pending', detail: 'Awaiting gate approval' }
    ];

    DTFR.bus.emit('console:stack-generated', { stack: mockStack });

    this._addHistory('system', 'Stack generation complete. Awaiting execution.');
    this._isProcessing = false;
    this.render();
  }

  _addHistory(role, text, type = '') {
    this._history.push({
      role,
      text,
      type,
      timestamp: new Date().toISOString().split('T')[1].split('.')[0] + 'Z'
    });
    if (this._history.length > 30) this._history.shift();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: var(--font-mono);
        }

        .console-container {
          background: var(--color-ink);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          display: flex;
          flex-direction: column;
          height: 440px;
          overflow: hidden;
          box-shadow: var(--shadow-xl);
          position: relative;
        }

        .console-header {
          background: var(--color-ink);
          padding: var(--space-3) var(--space-4);
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--color-border);
          z-index: 5;
        }

        .console-title {
          font-size: 10px;
          color: var(--color-slate);
          text-transform: uppercase;
          letter-spacing: 0.2em;
          font-weight: 700;
        }

        .console-status {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 10px;
          color: ${this._isProcessing ? 'var(--color-ai)' : 'var(--color-mist)'};
          letter-spacing: 0.1em;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          box-shadow: ${this._isProcessing ? '0 0 10px var(--color-ai-glow)' : 'none'};
        }

        .console-output {
          flex: 1;
          padding: var(--space-6) var(--space-4);
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
          scrollbar-width: thin;
          scrollbar-color: var(--color-border) transparent;
          z-index: 5;
        }

        .line {
          display: flex;
          gap: var(--space-4);
          font-size: 13px;
          line-height: 1.6;
          opacity: 0;
          animation: line-fade-in 0.2s ease-out forwards;
        }

        @keyframes line-fade-in {
          from { opacity: 0; transform: translateY(2px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .line-role {
          flex-shrink: 0;
          color: var(--color-mist);
          width: 60px;
          font-size: 10px;
          opacity: 0.5;
        }

        .line-text {
          color: var(--color-canvas);
          word-break: break-word;
        }

        .line.user .line-text { color: var(--color-canvas); }
        .line.system .line-text { color: var(--color-ai); }
        .line.system.active .line-text { animation: pulse 2s infinite; }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        .console-input-area {
          padding: var(--space-4);
          background: var(--color-ink);
          border-top: 1px solid var(--color-border);
          z-index: 5;
        }

        .console-form {
          display: flex;
          gap: var(--space-3);
          align-items: center;
        }

        .prompt {
          color: var(--color-ai);
          font-weight: bold;
        }

        .console-input {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--color-canvas);
          font-family: inherit;
          font-size: 13px;
          outline: none;
          padding: 0;
          caret-color: var(--color-ai);
        }

        .console-input::placeholder {
          color: var(--color-mist);
          opacity: 0.3;
        }
      </style>
      
      <div class="console-container">
        <header class="console-header">
          <span class="console-title">SYSTEM COMPILER VER 2.1</span>
          <div class="console-status">
            <span class="status-dot"></span>
            <span>${this._isProcessing ? 'COMPILING' : 'READY'}</span>
          </div>
        </header>
        
        <div class="console-output">
          ${this._history.map(line => `
            <div class="line ${line.role} ${line.type}">
              <span class="line-role">${line.timestamp}</span>
              <span class="line-text">${line.text}</span>
            </div>
          `).join('')}
          ${this._history.length === 0 ? '<div class="line system"><span class="line-text">Core environment initialized.</span></div>' : ''}
        </div>
        
        <div class="console-input-area">
          <form class="console-form">
            <span class="prompt">$</span>
            <input type="text" class="console-input" 
                   placeholder="${this._placeholder}" 
                   ${this._isProcessing ? 'disabled' : ''}
                   autofocus>
          </form>
        </div>
      </div>
    `;

    const output = this.shadowRoot.querySelector('.console-output');
    if (output) {
      setTimeout(() => {
        output.scrollTop = output.scrollHeight;
      }, 0);
    }
  }
}

if (typeof DTFR !== 'undefined') {
  DTFR.registry.register('dtfr-console', DTFRConsole, {
    priority: 'instructive',
    version: '2.1.0',
    description: 'v2.1 Transparent Compiler Console'
  });
} else {
  customElements.define('dtfr-console', DTFRConsole);
}

export { DTFRConsole };
