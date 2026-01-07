/**
 * DTFR Design Scout Component
 * 
 * Visualizes design intelligence gathered from Mobbin.
 * 
 * @module modules/dtfr-design-scout
 */

class DTFRDesignScout extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._apps = [];
        this._screens = [];
    }

    connectedCallback() {
        this._loadIntelligence();
        this.render();
    }

    async _loadIntelligence() {
        if (!window.supabaseClient) {
            console.error('[DTFR] Supabase client not initialized');
            return;
        }

        try {
            // Fetch latest apps
            const { data: apps, error: appsError } = await window.supabaseClient
                .from('mobbin_apps')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(6);

            if (appsError) throw appsError;
            this._apps = apps || [];

            // Fetch latest screens
            const { data: screens, error: screensError } = await window.supabaseClient
                .from('mobbin_screens')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(8);

            if (screensError) throw screensError;
            this._screens = screens || [];

            this.render();
        } catch (e) {
            console.error('[DTFR] Design intelligence load error:', e);
        }
    }

    render() {
        this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: var(--font-interface);
        }

        .scout-container {
          background: var(--color-canvas);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: var(--space-xl);
        }

        .scout-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-xl);
          border-bottom: 2px solid var(--color-void);
          padding-bottom: var(--space-md);
        }

        .scout-title {
          font-family: var(--font-display);
          font-size: var(--text-2xl);
          color: var(--color-void);
          margin: 0;
          font-style: italic;
        }

        .scout-badge {
          font-family: var(--font-code);
          font-size: 10px;
          background: var(--color-ai-active);
          color: white;
          padding: 2px 8px;
          border-radius: 99px;
          text-transform: uppercase;
        }

        .app-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: var(--space-lg);
          margin-bottom: var(--space-2xl);
        }

        .app-card {
          display: flex;
          gap: var(--space-md);
          padding: var(--space-md);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          transition: transform 0.2s, border-color 0.2s;
          text-decoration: none;
          color: inherit;
        }

        .app-card:hover {
          transform: translateY(-2px);
          border-color: var(--color-ai-active);
          background: rgba(var(--color-ai-active-rgb), 0.05);
        }

        .app-logo {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-sm);
          background: var(--color-soft);
          object-fit: cover;
        }

        .app-info {
          flex: 1;
          min-width: 0;
        }

        .app-name {
          font-weight: 600;
          font-size: 14px;
          margin: 0 0 4px 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .app-tagline {
          font-size: 11px;
          color: var(--color-mist);
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .screen-reel {
          display: flex;
          gap: var(--space-md);
          overflow-x: auto;
          padding-bottom: var(--space-md);
          scrollbar-width: thin;
        }

        .screen-item {
          flex: 0 0 120px;
          height: 240px;
          border-radius: var(--radius-md);
          background: var(--color-void);
          overflow: hidden;
          border: 1px solid var(--color-border);
        }

        .screen-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .section-label {
          font-family: var(--font-code);
          font-size: 10px;
          color: var(--color-mist);
          text-transform: uppercase;
          margin-bottom: var(--space-md);
          display: block;
          letter-spacing: 0.1em;
        }

        .empty-state {
          padding: var(--space-xl);
          text-align: center;
          color: var(--color-mist);
          font-style: italic;
          border: 1px dashed var(--color-border);
          border-radius: var(--radius-md);
        }
      </style>

      <div class="scout-container">
        <header class="scout-header">
          <h2 class="scout-title">Design Intelligence</h2>
          <span class="scout-badge">Live Scout</span>
        </header>

        <span class="section-label">Latest App Discoveries</span>
        ${this._apps.length > 0 ? `
          <div class="app-grid">
            ${this._apps.map(app => `
              <a href="${app.url}" target="_blank" class="app-card">
                <img src="${app.logo_url || '/static/images/placeholder-logo.png'}" class="app-logo" alt="${app.name}">
                <div class="app-info">
                  <h3 class="app-name">${app.name}</h3>
                  <p class="app-tagline">${app.tagline || 'No tagline available'}</p>
                </div>
              </a>
            `).join('')}
          </div>
        ` : `<div class="empty-state">Waiting for Mobbin Scout reports...</div>`}

        <span class="section-label">Pattern Stream</span>
        ${this._screens.length > 0 ? `
          <div class="screen-reel">
            ${this._screens.map(screen => `
              <div class="screen-item">
                <img src="${screen.image_url}" class="screen-img" alt="${screen.title}">
              </div>
            `).join('')}
          </div>
        ` : `<div class="empty-state">Analyzing screen patterns...</div>`}
      </div>
    `;
    }
}

if (typeof DTFR !== 'undefined') {
    DTFR.registry.register('dtfr-design-scout', DTFRDesignScout, {
        priority: 'adaptive',
        version: '1.0.0',
        description: 'Design Intelligence feed from Mobbin'
    });
} else {
    customElements.define('dtfr-design-scout', DTFRDesignScout);
}

export { DTFRDesignScout };
