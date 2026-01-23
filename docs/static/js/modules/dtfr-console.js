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
    this._addLine('user', intent);
    this.render();

    try {
      const response = await fetch('/api/mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: intent, mode: 'research' })
      });

      if (!response.ok) throw new Error('Mission failed to initialize');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.trim().startsWith('data: ')) {
            try {
              const eventInfo = line.trim().substring(6);
              const event = JSON.parse(eventInfo);
              this._handleMissionEvent(event);
            } catch (e) {
              console.error('[Console] Failed to parse event:', e);
            }
          }
        }
      }
    } catch (err) {
      this._addLine('system', `[CRITICAL ERROR] ${err.message}`);
    } finally {
      this._isProcessing = false;
      this.render();
    }
  }

  _handleMissionEvent(event) {
    switch (event.type) {
      case 'reframe':
        this._addLine('system', `Problem Reframed: ${event.reframed}`, 'reframe');
        break;
      case 'thought':
        this._addLine('system', event.content, 'active');
        break;
      case 'plan':
        this._addLine('system', `Mission Objective: ${event.content.mission_id}`, 'plan');
        event.content.tasks?.forEach(t => {
          this._addLine('system', `> Sub-Agent ${t.agent}: ${t.objective}`, 'task');
        });
        break;
      case 'done':
        this._addLine('system', 'Mission sequence complete. Signal integrity optimized.', 'done');
        break;
    }
    this.render();
  }

  _addLine(role, text, type = '') {
    this._history.push({
      role,
      text,
      type,
      timestamp: new Date().toISOString().split('T')[1].split('.')[0] + 'Z'
    });
    if (this._history.length > 50) this._history.shift();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: var(--font-mono);
        }

        .console-container {
          background: var(--material-glass-bg-dark);
          backdrop-filter: var(--glass-blur-medium);
          -webkit-backdrop-filter: var(--glass-blur-medium);
          border: 1px solid var(--material-glass-border-dark);
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          height: 480px; /* 60 * 8 */
          overflow: hidden;
          box-shadow: var(--shadow-lg);
          position: relative;
        }

        .console-header {
          padding: var(--space-2) var(--space-3);
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--material-glass-border-dark);
          z-index: 5;
        }

        .console-title {
          font-size: var(--text-xs);
          color: var(--color-mist);
          text-transform: uppercase;
          letter-spacing: var(--tracking-wider);
          font-weight: var(--font-bold);
        }

        .console-status {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          font-size: var(--text-xs);
          color: ${this._isProcessing ? 'var(--color-ai)' : 'var(--color-mist)'};
        }

        .status-dot {
          width: 8px; /* Strict 8pt unit division */
          height: 8px;
          border-radius: var(--radius-full);
          background: currentColor;
          box-shadow: ${this._isProcessing ? '0 0 12px var(--color-ai-glow)' : 'none'};
          transition: all var(--duration-base) var(--ease-gentle);
        }

        .console-output {
          flex: 1;
          padding: var(--space-4) var(--space-3);
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 4px; /* Half unit for high-density log */
          scrollbar-width: thin;
          scrollbar-color: var(--material-glass-border-dark) transparent;
          z-index: 5;
        }

        .line {
          display: flex;
          gap: var(--space-3);
          font-size: 13px;
          line-height: var(--leading-tight);
          opacity: 0;
          animation: line-fade-in var(--duration-fast) var(--ease-out) forwards;
        }

        @keyframes line-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .line-role {
          flex-shrink: 0;
          color: var(--color-slate);
          width: 80px;
          font-size: 10px;
          font-weight: var(--font-medium);
        }

        .line-text {
          color: var(--color-canvas);
          word-break: break-word;
          max-width: var(--measure-tight); /* High density measure */
        }

        .line.user .line-text { color: var(--color-canvas); font-weight: var(--font-medium); }
        .line.system .line-text { color: var(--color-ai); }
        .line.system.active .line-text { animation: pulse var(--duration-slow) infinite; }

        /* Mission Specific Styling */
        .line.reframe .line-text { 
           color: var(--color-accent-blue, #60A5FA); 
           font-style: italic; 
           border-left: 2px solid currentColor;
           padding-left: var(--space-2);
        }
        .line.plan .line-text { 
           color: var(--color-accent-yellow, #FBBF24); 
           font-weight: var(--font-bold);
           text-transform: uppercase;
           letter-spacing: 0.05em;
        }
        .line.task .line-text { 
           color: var(--color-slate); 
           font-size: 11px;
           opacity: 0.8;
        }
        .line.done .line-text { 
           color: var(--color-ai);
           text-shadow: 0 0 10px var(--color-ai-glow);
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        .console-input-area {
          padding: var(--space-2) var(--space-3);
          background: rgba(0,0,0,0.2);
          border-top: 1px solid var(--material-glass-border-dark);
          z-index: 5;
        }

        .console-form {
          display: flex;
          gap: var(--space-2);
          align-items: center;
        }

        .prompt {
          color: var(--color-ai);
          font-weight: var(--font-bold);
        }

        .console-input {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--color-canvas);
          font-family: var(--font-mono);
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
