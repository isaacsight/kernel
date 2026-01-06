/**
 * DTFR Feed Component
 * 
 * Living execution history and document stream.
 * Implements the v2.1 "AI-Native" design philosophy.
 * 
 * Pattern Sources:
 * - Perplexity: Source authority, living updates
 * - GitHub: Activity stream logic
 * - Instrument Serif: High-contrast typography
 * 
 * @module modules/dtfr-feed
 */

const FEED_TYPES = {
  runs: {
    title: 'Recent Executions',
    icon: '⚡',
    emptyMessage: 'No active executions',
    maxItems: 5
  },
  patterns: {
    title: 'Pattern Intelligence',
    icon: '🌿',
    emptyMessage: 'Compiling new patterns...',
    maxItems: 5
  },
  log: {
    title: 'Reasoning Trace',
    icon: '📋',
    emptyMessage: 'No traces found',
    maxItems: 3
  },
  github: {
    title: 'System Source',
    icon: '🔗',
    emptyMessage: 'Syncing with repository...',
    maxItems: 5
  }
};

const MOCK_DATA = {}; // Deprecated: Data now fetched from /posts.json

class DTFRFeed extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._type = 'runs';
    this._items = [];
    this._limit = 5;
  }

  static get observedAttributes() {
    return ['data-type', 'data-limit'];
  }

  connectedCallback() {
    this._type = this.getAttribute('data-type') || 'runs';
    this._limit = parseInt(this.getAttribute('data-limit')) || FEED_TYPES[this._type]?.maxItems || 5;

    this._loadData();
    this.render();
    this._startUpdateLoop();

    DTFR.bus.emit('module:mounted', {
      tagName: 'dtfr-feed',
      duration: 0,
      element: this
    });
  }

  _startUpdateLoop() {
    this._lastUpdated = new Date();
    this._timer = setInterval(() => {
      const timestampEl = this.shadowRoot.querySelector('.doc-timestamp');
      if (timestampEl) {
        timestampEl.textContent = `Last updated: ${DTFR.utils.relativeTime(this._lastUpdated)}`;
      }
    }, 60000);
  }

  disconnectedCallback() {
    if (this._timer) clearInterval(this._timer);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      if (name === 'data-type') this._type = newValue;
      if (name === 'data-limit') this._limit = parseInt(newValue);
      this._loadData();
      this.render();
    }
  }

  async _loadData() {
    try {
      const response = await fetch('/posts.json');
      const posts = await response.json();

      this._processPosts(posts);
      this.render();
    } catch (e) {
      console.error('[DTFR] Feed load error:', e);
      // Fallback to empty
      this._items = [];
      this.render();
    }
  }

  _processPosts(posts) {
    // Filter and map based on type
    let filtered = [];

    switch (this._type) {
      case 'runs':
        // Experiment modes or announcements
        filtered = posts.filter(p =>
          (p.mode && ['experiment', 'announcement', 'execution'].includes(p.mode.toLowerCase())) ||
          (p.status && ['verified', 'compiling', 'active'].includes(p.status.toLowerCase()))
        ).map(p => ({
          id: p.slug.substring(0, 8).toUpperCase(),
          title: p.title,
          status: p.mode || 'active',
          date: p.date,
          link: p.output_rel_path
        }));
        break;

      case 'patterns':
        // Research category or pillar items
        filtered = posts.filter(p =>
          (p.category === 'Research' || p.pillar === 'true' || p.pillar === true) &&
          !p.mode?.includes('experiment')
        ).map(p => ({
          id: 'PAT-' + p.slug.substring(0, 4).toUpperCase(),
          title: p.title,
          category: p.category || 'PATTERN',
          date: p.date,
          link: p.output_rel_path
        }));
        break;

      case 'log':
        filtered = posts.slice(0, this._limit).map(p => ({
          id: 'LOG-' + p.slug.substring(0, 4).toUpperCase(),
          decision: p.title || 'Untitled Decision',
          reasoning: p.tldr || p.excerpt || p.subtitle || 'System reasoning trace unavailable.',
          date: p.date,
          link: p.output_rel_path
        }));
        break;

      default:
        // Recent items for other feeds
        filtered = posts.slice(0, this._limit).map(p => ({
          id: p.slug.substring(0, 8),
          title: p.title,
          status: 'indexed',
          date: p.date,
          link: p.output_rel_path
        }));
    }

    this._items = filtered.slice(0, this._limit);
  }

  _formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'T-0d';
    if (days === 1) return 'T-1d';
    return `T-${days}d`;
  }

  _renderItem(item) {
    const date = this._formatDate(item.date);
    switch (this._type) {
      case 'runs':
        return `
          <div class="feed-item" data-status="${item.status}">
            <div class="item-header">
              <span class="item-title">${item.title}</span>
              <span class="status-badge ${item.status}">${item.status}</span>
            </div>
            <div class="item-meta">
              <span class="item-id">${item.id}</span>
              <span class="item-date">${date}</span>
            </div>
          </div>
        `;

      case 'patterns':
        return `
          <div class="feed-item">
            <div class="item-header">
              <span class="item-title">${item.title}</span>
              <span class="category-tag">${item.category}</span>
            </div>
            <div class="item-meta">
              <span class="item-id">${item.id}</span>
              <span class="item-date">${date}</span>
            </div>
          </div>
        `;

      case 'log':
        return `
          <div class="feed-item">
            <div class="item-header">
              <span class="item-title">${item.decision}</span>
              <span class="item-id">${item.id}</span>
            </div>
            <p class="decision-reasoning">${item.reasoning}</p>
            <span class="item-date">${date}</span>
          </div>
        `;

      case 'github':
        return `
          <div class="feed-item">
            <div class="item-header">
              <span class="github-type">${item.type}</span>
              <span class="item-title">${item.message}</span>
            </div>
            <div class="item-meta">
              <span class="item-id">${item.id}</span>
              <span class="item-date">${date}</span>
            </div>
          </div>
        `;

      default:
        return `<div class="feed-item">${JSON.stringify(item)}</div>`;
    }
  }

  render() {
    const feedConfig = FEED_TYPES[this._type] || FEED_TYPES.runs;
    const lastUpdated = DTFR.utils.relativeTime(this._lastUpdated || new Date());

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: var(--font-interface);
        }
        
        .doc-stream {
          background: var(--color-canvas);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: var(--space-lg);
          position: relative;
        }

        .doc-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: var(--space-xl);
          padding-bottom: var(--space-md);
          border-bottom: 2px solid var(--color-void);
        }
        
        .doc-title {
          font-family: var(--font-display);
          font-size: var(--text-xl);
          color: var(--color-void);
          margin: 0;
        }

        .doc-timestamp {
          font-family: var(--font-code);
          font-size: 10px;
          color: var(--color-mist);
          text-transform: uppercase;
        }
        
        .doc-items {
          display: flex;
          flex-direction: column;
          gap: var(--space-lg);
        }
        
        .doc-entry {
          display: grid;
          grid-template-columns: 100px 1fr;
          gap: var(--space-lg);
          padding-bottom: var(--space-lg);
          border-bottom: 1px solid var(--color-border);
          transition: background 0.2s;
        }
        
        .doc-entry:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .doc-meta {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .doc-date {
          font-family: var(--font-code);
          font-size: 10px;
          color: var(--color-slate);
          font-weight: 600;
        }

        .doc-type {
          font-family: var(--font-code);
          font-size: 9px;
          color: var(--color-mist);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        
        .doc-content h3 {
          font-family: var(--font-display);
          font-size: var(--text-lg);
          color: var(--color-void);
          margin: 0 0 var(--space-xs) 0;
          font-weight: 400;
        }

        .doc-excerpt {
          font-size: 14px;
          color: var(--color-slate);
          margin: 0;
          line-height: 1.6;
          max-width: 600px;
        }

        .empty-state {
          text-align: center;
          padding: var(--space-xl);
          color: var(--color-mist);
          font-style: italic;
        }
        
        .doc-footer {
          margin-top: var(--space-xl);
          text-align: right;
        }
        
        .doc-link {
          font-family: var(--font-code);
          font-size: 10px;
          color: var(--color-mist);
          text-decoration: none;
          text-transform: uppercase;
          transition: color 0.2s;
        }
        
        .doc-link:hover {
          color: var(--color-ai-active);
        }
        
        @media (max-width: 768px) {
          .doc-entry {
            grid-template-columns: 1fr;
            gap: var(--space-sm);
          }
        }
      </style>
      
      <div class="doc-stream">
        <header class="doc-header">
          <h3 class="doc-title">${feedConfig.title}</h3>
          <div class="doc-timestamp">Last updated: ${lastUpdated}</div>
        </header>
        
        <div class="doc-items">
          ${this._items.length > 0
        ? this._items.map(item => `
              <a href="${item.link || '#'}" class="doc-entry" style="text-decoration: none; color: inherit; display: grid;">
                <div class="doc-meta">
                  <div class="doc-date">${item.date}</div>
                  <div class="doc-type">${this._type === 'runs' ? item.status : this._type}</div>
                </div>
                <div class="doc-content">
                  <h3>${this._type === 'log' ? item.decision : item.title || item.message}</h3>
                  <p class="doc-excerpt">${item.reasoning || item.subtitle || 'System execution results and provenance trace summary...'}</p>
                </div>
              </a>
            `).join('')
        : `<div class="empty-state">${feedConfig.emptyMessage}</div>`
      }
        </div>
        
        <footer class="doc-footer">
          <a href="#" class="doc-link">Access Archives →</a>
        </footer>
      </div>
    `;
  }
}

if (typeof DTFR !== 'undefined') {
  DTFR.registry.register('dtfr-feed', DTFRFeed, {
    priority: 'adaptive',
    version: '2.1.0',
    description: 'v2.1 Document Stream component'
  });
} else {
  customElements.define('dtfr-feed', DTFRFeed);
}

export { DTFRFeed, FEED_TYPES };
