/**
 * DTFR Module Loader
 * 
 * Entry point that loads all DTFR Web Components and initializes the system.
 * Include this single script to activate the full DTFR module system.
 * 
 * Usage:
 * <script type="module" src="/static/js/dtfr.js"></script>
 * 
 * @module dtfr
 */

// ============================================================================
// Dynamic Module Loading
// ============================================================================

// Determine the base path dynamically based on where dtfr.js is loaded from
const currentScript = document.currentScript?.src || import.meta.url;
const basePath = currentScript.includes('/static/js/') ? '/static/js' : '/js';

const MODULES_TO_LOAD = [
    `${basePath}/core.js`,
    `${basePath}/generation/engine.js`,
    `${basePath}/router.js`,
    `${basePath}/modules/dtfr-monitor.js`,
    `${basePath}/modules/dtfr-shell.js`,
    `${basePath}/modules/dtfr-hero.js`,
    `${basePath}/modules/dtfr-command-bar.js`,
    `${basePath}/modules/dtfr-graph.js`,
    `${basePath}/modules/dtfr-flow.js`,
    `${basePath}/modules/dtfr-context-panel.js`,
    `${basePath}/modules/dtfr-feed.js`,
    `${basePath}/modules/dtfr-stack.js`,
    `${basePath}/modules/dtfr-console.js`,
    `${basePath}/modules/dtfr-design-scout.js`,
    `${basePath}/modules/dtfr-status.js`,
    `${basePath}/metrics.js`
];

// ============================================================================
// Season Application
// ============================================================================


// ============================================================================
// Module Loading
// ============================================================================

async function loadModules() {
    const startTime = performance.now();
    const loadErrors = [];

    // Load modules sequentially (core must load first)
    for (const modulePath of MODULES_TO_LOAD) {
        try {
            await import(modulePath);
            console.log(`[DTFR] Loaded: ${modulePath}`);
        } catch (e) {
            console.error(`[DTFR] Failed to load ${modulePath}:`, e);
            loadErrors.push({ path: modulePath, error: e.message });
        }
    }

    const duration = performance.now() - startTime;
    console.log(`[DTFR] All modules loaded in ${duration.toFixed(1)}ms`);

    return { duration, errors: loadErrors };
}

// ============================================================================
// System Initialization
// ============================================================================

async function initializeDTFR() {
    console.log('[DTFR] Initializing Studio OS...');

    // Load all modules
    const loadResult = await loadModules();

    // Initialize router if available
    if (typeof DTFR !== 'undefined' && DTFR.router) {
        DTFR.router.init();
    }

    // Start monitor in debug mode
    if (localStorage.getItem('dtfr-debug') === 'true' && typeof DTFR !== 'undefined' && DTFR.monitor) {
        DTFR.monitor.start();
    }

    // Emit ready event
    if (typeof DTFR !== 'undefined') {
        DTFR.bus.emit('dtfr:ready', {
            version: DTFR.version,
            loadDuration: loadResult.duration,
            errors: loadResult.errors,
            modules: DTFR.registry?.list() || []
        });
    }

    // Dispatch custom event for external listeners
    window.dispatchEvent(new CustomEvent('dtfr:ready', {
        detail: { loadResult }
    }));

    console.log('[DTFR] Studio OS ready');
}

// ============================================================================
// Auto-initialize
// ============================================================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDTFR);
} else {
    initializeDTFR();
}

// ============================================================================
// Debug Helpers (available on window.DTFR)
// ============================================================================

if (typeof window !== 'undefined') {
    window.DTFRDebug = {
        enableDebug() {
            localStorage.setItem('dtfr-debug', 'true');
            location.reload();
        },
        disableDebug() {
            localStorage.removeItem('dtfr-debug');
            location.reload();
        },
        showMonitor() {
            if (DTFR.monitor && !DTFR.monitor.running) {
                DTFR.monitor.start();
            }
            const overlay = document.createElement('dtfr-monitor-overlay');
            document.body.appendChild(overlay);
        },
        diagnose() {
            if (DTFR.monitor) {
                return DTFR.monitor.diagnose();
            }
            return { error: 'Monitor not available' };
        },
        listModules() {
            return DTFR.registry?.list() || [];
        },
        getSeed() {
            return DTFR.context?.get('seed');
        },
        getMode() {
            return DTFR.context?.get('mode');
        }
    };
}

export { initializeDTFR, loadModules };
