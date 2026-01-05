/**
 * DTFR Core Module Loader
 * 
 * Central infrastructure for Web Component registration, event bus,
 * and shared utilities. All DTFR modules communicate through this core.
 * 
 * Pattern Sources:
 * - Webflow: Modular SaaS sections
 * - Olsen Framework: Env-centric communication
 * 
 * @module core
 */

// ============================================================================
// Event Bus (Env-Centric Communication per Olsen Framework)
// ============================================================================

class DTFREventBus {
    constructor() {
        this.listeners = new Map();
        this.debug = localStorage.getItem('dtfr-debug') === 'true';
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);

        // Return unsubscribe function
        return () => this.off(event, callback);
    }

    /**
     * Unsubscribe from an event
     */
    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }

    /**
     * Emit an event to all subscribers
     * @param {string} event - Event name
     * @param {*} data - Event payload
     */
    emit(event, data) {
        if (this.debug) {
            console.log(`[DTFR Bus] ${event}`, data);
        }

        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`[DTFR Bus] Error in handler for ${event}:`, e);
                }
            });
        }
    }
}

// ============================================================================
// Module Registry
// ============================================================================

class DTFRModuleRegistry {
    constructor() {
        this.modules = new Map();
        this.initialized = new Set();
    }

    /**
     * Register a Web Component module
     * @param {string} tagName - Custom element tag (e.g., 'dtfr-hero')
     * @param {CustomElementConstructor} constructor - Web Component class
     * @param {Object} metadata - Module metadata
     */
    register(tagName, constructor, metadata = {}) {
        if (this.modules.has(tagName)) {
            console.warn(`[DTFR Registry] Module ${tagName} already registered`);
            return;
        }

        this.modules.set(tagName, {
            constructor,
            metadata: {
                priority: 'adaptive', // 'instructive' or 'adaptive'
                version: '1.0.0',
                ...metadata
            }
        });

        // Register custom element if not already defined
        if (!customElements.get(tagName)) {
            customElements.define(tagName, constructor);
        }

        DTFR.bus.emit('module:registered', { tagName, metadata });
    }

    /**
     * Get module metadata
     */
    get(tagName) {
        return this.modules.get(tagName);
    }

    /**
     * Check if module is registered
     */
    has(tagName) {
        return this.modules.has(tagName);
    }

    /**
     * List all registered modules
     */
    list() {
        return Array.from(this.modules.entries()).map(([tagName, data]) => ({
            tagName,
            ...data.metadata
        }));
    }
}

// ============================================================================
// Module Base Class
// ============================================================================

/**
 * Base class for all DTFR Web Components
 * Provides lifecycle hooks, event bus integration, and DTFR monitoring
 */
class DTFRModule extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._mounted = false;
    }

    /**
     * Standard Web Component lifecycle
     */
    connectedCallback() {
        this._mountTime = performance.now();
        this._mounted = true;

        // Render component
        this.render();

        // Emit mount event
        const mountDuration = performance.now() - this._mountTime;
        DTFR.bus.emit('module:mounted', {
            tagName: this.tagName.toLowerCase(),
            duration: mountDuration,
            element: this
        });

        // Call subclass hook
        if (this.onMount) {
            this.onMount();
        }
    }

    disconnectedCallback() {
        this._mounted = false;

        DTFR.bus.emit('module:unmounted', {
            tagName: this.tagName.toLowerCase()
        });

        if (this.onUnmount) {
            this.onUnmount();
        }
    }

    /**
     * Override in subclass to render content
     */
    render() {
        // Default: empty, subclasses should override
    }

    /**
     * Helper to set shadow DOM content with styles
     * @param {string} html - HTML content
     * @param {string} css - CSS styles
     */
    setContent(html, css = '') {
        this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        ${css}
      </style>
      ${html}
    `;
    }

    /**
     * Get configuration from attributes or defaults
     */
    getConfig(defaults = {}) {
        const config = { ...defaults };

        for (const attr of this.attributes) {
            if (attr.name.startsWith('data-')) {
                const key = attr.name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
                try {
                    config[key] = JSON.parse(attr.value);
                } catch {
                    config[key] = attr.value;
                }
            }
        }

        return config;
    }
}

// ============================================================================
// Context Store (Shared Environment State)
// ============================================================================

class DTFRContext {
    constructor() {
        this._state = {
            mode: 'learn', // 'learn' | 'build' | 'collaborate'
            seed: null,
            user: null,
            theme: 'dark'
        };
        this._subscribers = new Set();
    }

    /**
     * Get current context state
     */
    get state() {
        return { ...this._state };
    }

    /**
     * Update context state
     * @param {Object} updates - Partial state updates
     */
    set(updates) {
        const prev = { ...this._state };
        this._state = { ...this._state, ...updates };

        DTFR.bus.emit('context:changed', {
            prev,
            next: this._state,
            changes: Object.keys(updates)
        });
    }

    /**
     * Get specific context value
     */
    get(key) {
        return this._state[key];
    }
}

// ============================================================================
// Utility Functions
// ============================================================================

const DTFRUtils = {
    /**
     * Generate a deterministic hash from a string
     * Used for seed-based generation
     */
    hash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    },

    /**
     * Check if device is mobile
     */
    isMobile() {
        return window.matchMedia('(max-width: 768px)').matches;
    },

    /**
     * Debounce function calls
     */
    debounce(fn, ms) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn(...args), ms);
        };
    },

    /**
     * Throttle function calls
     */
    throttle(fn, ms) {
        let last = 0;
        return (...args) => {
            const now = Date.now();
            if (now - last >= ms) {
                last = now;
                fn(...args);
            }
        };
    },

    /**
     * Format relative time
     */
    relativeTime(date) {
        const now = new Date();
        const diff = now - new Date(date);
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'just now';
    }
};

// ============================================================================
// Global DTFR Namespace
// ============================================================================

const DTFR = {
    bus: new DTFREventBus(),
    registry: new DTFRModuleRegistry(),
    context: new DTFRContext(),
    utils: DTFRUtils,
    Module: DTFRModule,

    // Version and metadata
    version: '2.1.0-alpha',

    /**
     * Initialize DTFR system
     */
    init() {
        // Set initial seed from current date + visitor bucket
        const today = new Date().toISOString().split('T')[0];
        const visitorBucket = this.utils.hash(navigator.userAgent) % 10;

        this.context.set({
            seed: this.utils.hash(`${today}-${visitorBucket}`),
            mode: this._detectMode()
        });

        this.bus.emit('dtfr:init', {
            version: this.version,
            seed: this.context.get('seed'),
            mode: this.context.get('mode')
        });

        console.log(`[DTFR] Initialized v${this.version} | Mode: ${this.context.get('mode')} | Seed: ${this.context.get('seed')}`);
    },

    /**
     * Detect current mode from URL or default
     */
    _detectMode() {
        const hash = window.location.hash.slice(1);
        if (['learn', 'build', 'collaborate'].includes(hash)) {
            return hash;
        }
        return 'learn';
    }
};

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => DTFR.init());
} else {
    DTFR.init();
}

// Export for module systems and global access
if (typeof window !== 'undefined') {
    window.DTFR = DTFR;
}

export { DTFR, DTFRModule, DTFRUtils };
