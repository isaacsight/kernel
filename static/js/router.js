/**
 * DTFR Router
 * 
 * URL hash-based mode routing with history management.
 * Syncs URL state with DTFR context and shell components.
 * 
 * Pattern Sources:
 * - Nike React: User-driven parameter binding
 * - SPA routing patterns
 * 
 * @module router
 */

// ============================================================================
// Route Configuration
// ============================================================================

const ROUTES = {
    '': 'spec',           // Default route
    'spec': 'spec',
    'run': 'run',
    'pattern': 'pattern',
    'log': 'log',
    'build': 'spec',      // Legacy alias
    'learn': 'run',       // Legacy alias
    'create': 'spec'      // Legacy alias
};

// ============================================================================
// DTFR Router
// ============================================================================

class DTFRRouter {
    constructor() {
        this._currentRoute = null;
        this._listeners = new Set();
        this._initialized = false;
    }

    /**
     * Initialize router
     */
    init() {
        if (this._initialized) return;
        this._initialized = true;

        // Handle initial route
        this._handleRouteChange();

        // Listen for hash changes
        window.addEventListener('hashchange', () => this._handleRouteChange());

        // Listen for popstate (back/forward buttons)
        window.addEventListener('popstate', () => this._handleRouteChange());

        DTFR.bus.emit('router:initialized', { route: this._currentRoute });
    }

    /**
     * Handle route change
     */
    _handleRouteChange() {
        const hash = window.location.hash.slice(1).toLowerCase();
        const route = ROUTES[hash] || ROUTES[''];

        if (route !== this._currentRoute) {
            const prev = this._currentRoute;
            this._currentRoute = route;

            // Update DTFR context
            DTFR.context.set({ mode: route });

            // Notify listeners
            this._listeners.forEach(fn => fn(route, prev));

            DTFR.bus.emit('router:changed', { route, prev, hash });
        }
    }

    /**
     * Navigate to a route
     * @param {string} route - Route name (learn/build/collaborate)
     * @param {Object} options - Navigation options
     */
    navigate(route, options = {}) {
        const { replace = false } = options;

        // Validate route
        if (!Object.values(ROUTES).includes(route)) {
            console.warn(`[Router] Unknown route: ${route}`);
            return;
        }

        // Update hash
        const newUrl = `${window.location.pathname}#${route}`;

        if (replace) {
            history.replaceState(null, '', newUrl);
        } else {
            history.pushState(null, '', newUrl);
        }

        // Trigger route change
        this._handleRouteChange();
    }

    /**
     * Subscribe to route changes
     * @param {Function} callback - Called with (newRoute, prevRoute)
     * @returns {Function} Unsubscribe function
     */
    onChange(callback) {
        this._listeners.add(callback);
        return () => this._listeners.delete(callback);
    }

    /**
     * Get current route
     */
    get current() {
        return this._currentRoute;
    }

    /**
     * Get all available routes
     */
    get routes() {
        return Object.values(ROUTES).filter((v, i, a) => a.indexOf(v) === i);
    }

    /**
     * Check if route is active
     */
    isActive(route) {
        return this._currentRoute === route;
    }

    /**
     * Generate URL for a route
     */
    urlFor(route) {
        return `${window.location.pathname}#${route}`;
    }
}

// ============================================================================
// Route Link Component
// ============================================================================

/**
 * Declarative route links
 * Usage: <dtfr-link route="build">Start Building</dtfr-link>
 */
class DTFRLink extends HTMLElement {
    static get observedAttributes() {
        return ['route'];
    }

    constructor() {
        super();
        this._handleClick = this._handleClick.bind(this);
    }

    connectedCallback() {
        this.addEventListener('click', this._handleClick);
        this._updateActive();

        // Listen for route changes
        this._unsubscribe = DTFR.router?.onChange(() => this._updateActive());
    }

    disconnectedCallback() {
        this.removeEventListener('click', this._handleClick);
        this._unsubscribe?.();
    }

    attributeChangedCallback() {
        this._updateActive();
    }

    _handleClick(e) {
        e.preventDefault();
        const route = this.getAttribute('route');
        if (route) {
            DTFR.router?.navigate(route);
        }
    }

    _updateActive() {
        const route = this.getAttribute('route');
        this.classList.toggle('active', DTFR.router?.isActive(route));
    }
}

// ============================================================================
// Register with DTFR
// ============================================================================

const router = new DTFRRouter();

if (typeof DTFR !== 'undefined') {
    DTFR.router = router;

    // Register link component
    if (!customElements.get('dtfr-link')) {
        customElements.define('dtfr-link', DTFRLink);
    }
}

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => router.init());
} else {
    router.init();
}

export { DTFRRouter, DTFRLink };
