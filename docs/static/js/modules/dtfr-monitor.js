/**
 * DTFR Monitor
 * 
 * Performance observability and "something doesn't feel right technically" detection.
 * Monitors generation performance, DOM complexity, errors, and system health.
 * 
 * Pattern Sources:
 * - A2UI: Transparent action chains, recoverable automation
 * - Adobe: Performance monitoring
 * 
 * @module modules/dtfr-monitor
 */

// ============================================================================
// Monitor Configuration
// ============================================================================

const DEFAULT_THRESHOLDS = {
    generationTime: 50,      // ms - max acceptable generation time
    domElements: 1500,       // max DOM element count ("triangles")
    errorRate: 0.05,         // 5% error rate threshold
    memoryUsage: 0.8,        // 80% of available heap
    longTaskDuration: 50,    // ms - Chrome Long Tasks threshold
    layoutShift: 0.1         // CLS threshold
};

// ============================================================================
// Metrics Collector
// ============================================================================

class MetricsCollector {
    constructor() {
        this.metrics = {
            generation: [],
            mount: [],
            errors: [],
            longTasks: []
        };
        this.window = 60000; // 1 minute rolling window
    }

    /**
     * Record a metric
     */
    record(category, value) {
        const now = Date.now();

        if (!this.metrics[category]) {
            this.metrics[category] = [];
        }

        this.metrics[category].push({ timestamp: now, value });

        // Prune old entries
        this.metrics[category] = this.metrics[category].filter(
            m => now - m.timestamp < this.window
        );
    }

    /**
     * Get average for a category
     */
    average(category) {
        const entries = this.metrics[category] || [];
        if (entries.length === 0) return 0;
        return entries.reduce((sum, e) => sum + e.value, 0) / entries.length;
    }

    /**
     * Get max for a category
     */
    max(category) {
        const entries = this.metrics[category] || [];
        if (entries.length === 0) return 0;
        return Math.max(...entries.map(e => e.value));
    }

    /**
     * Get count of entries
     */
    count(category) {
        return (this.metrics[category] || []).length;
    }

    /**
     * Get error rate
     */
    errorRate() {
        const errors = this.count('errors');
        const total = this.count('generation') + this.count('mount');
        return total > 0 ? errors / total : 0;
    }

    /**
     * Export metrics snapshot
     */
    snapshot() {
        return {
            generation: {
                avg: this.average('generation'),
                max: this.max('generation'),
                count: this.count('generation')
            },
            mount: {
                avg: this.average('mount'),
                max: this.max('mount'),
                count: this.count('mount')
            },
            errors: {
                count: this.count('errors'),
                rate: this.errorRate()
            },
            longTasks: {
                count: this.count('longTasks'),
                avg: this.average('longTasks')
            },
            timestamp: new Date().toISOString()
        };
    }
}

// ============================================================================
// DTFR Monitor
// ============================================================================

class DTFRMonitor {
    constructor(thresholds = {}) {
        this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
        this.collector = new MetricsCollector();
        this.issues = [];
        this.observers = {};
        this.running = false;
    }

    /**
     * Start monitoring
     */
    start() {
        if (this.running) return;
        this.running = true;

        // Subscribe to DTFR events
        this._subscribeToEvents();

        // Set up performance observers
        this._setupPerformanceObservers();

        // Start periodic health checks
        this._startHealthChecks();

        DTFR.bus.emit('monitor:started', { thresholds: this.thresholds });
        console.log('[DTFR Monitor] Started');
    }

    /**
     * Stop monitoring
     */
    stop() {
        this.running = false;

        // Disconnect observers
        Object.values(this.observers).forEach(obs => obs.disconnect?.());
        this.observers = {};

        // Clear intervals
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }

        DTFR.bus.emit('monitor:stopped', {});
        console.log('[DTFR Monitor] Stopped');
    }

    /**
     * Subscribe to DTFR event bus
     */
    _subscribeToEvents() {
        // Monitor generation events
        DTFR.bus.on('generation:config', (data) => {
            this.collector.record('generation', data.duration);

            if (data.duration > this.thresholds.generationTime) {
                this._recordIssue('SLOW_GENERATION', {
                    module: data.moduleType,
                    duration: data.duration,
                    threshold: this.thresholds.generationTime
                });
            }
        });

        DTFR.bus.on('generation:layout', (data) => {
            this.collector.record('generation', data.duration);
        });

        // Monitor module mounts
        DTFR.bus.on('module:mounted', (data) => {
            this.collector.record('mount', data.duration);
        });
    }

    /**
     * Set up Performance API observers
     */
    _setupPerformanceObservers() {
        // Long Tasks observer
        if ('PerformanceObserver' in window) {
            try {
                const longTaskObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        this.collector.record('longTasks', entry.duration);

                        if (entry.duration > this.thresholds.longTaskDuration) {
                            this._recordIssue('LONG_TASK', {
                                duration: entry.duration,
                                startTime: entry.startTime
                            });
                        }
                    }
                });

                longTaskObserver.observe({ entryTypes: ['longtask'] });
                this.observers.longTask = longTaskObserver;
            } catch (e) {
                console.warn('[DTFR Monitor] Long Task observer not available');
            }

            // Layout Shift observer
            try {
                const clsObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (!entry.hadRecentInput && entry.value > this.thresholds.layoutShift) {
                            this._recordIssue('LAYOUT_SHIFT', {
                                value: entry.value,
                                threshold: this.thresholds.layoutShift
                            });
                        }
                    }
                });

                clsObserver.observe({ entryTypes: ['layout-shift'], buffered: true });
                this.observers.cls = clsObserver;
            } catch (e) {
                console.warn('[DTFR Monitor] CLS observer not available');
            }
        }

        // Global error handler
        window.addEventListener('error', (e) => {
            this.collector.record('errors', 1);
            this._recordIssue('JS_ERROR', {
                message: e.message,
                filename: e.filename,
                lineno: e.lineno
            });
        });

        window.addEventListener('unhandledrejection', (e) => {
            this.collector.record('errors', 1);
            this._recordIssue('PROMISE_REJECTION', {
                reason: String(e.reason)
            });
        });
    }

    /**
     * Start periodic health checks
     */
    _startHealthChecks() {
        this.healthCheckInterval = setInterval(() => {
            this._runHealthCheck();
        }, 10000); // Every 10 seconds

        // Run initial check
        this._runHealthCheck();
    }

    /**
     * Run health check
     */
    _runHealthCheck() {
        const health = this.check();

        if (!health.healthy) {
            DTFR.bus.emit('monitor:unhealthy', health);
        }

        return health;
    }

    /**
     * Check current system health
     */
    check() {
        const issues = [];

        // Check DOM complexity
        const domCount = document.querySelectorAll('*').length;
        if (domCount > this.thresholds.domElements) {
            issues.push({
                type: 'DOM_BLOAT',
                value: domCount,
                threshold: this.thresholds.domElements
            });
        }

        // Check generation performance
        const avgGenTime = this.collector.average('generation');
        if (avgGenTime > this.thresholds.generationTime) {
            issues.push({
                type: 'SLOW_GENERATION_AVG',
                value: avgGenTime,
                threshold: this.thresholds.generationTime
            });
        }

        // Check error rate
        const errorRate = this.collector.errorRate();
        if (errorRate > this.thresholds.errorRate) {
            issues.push({
                type: 'HIGH_ERROR_RATE',
                value: errorRate,
                threshold: this.thresholds.errorRate
            });
        }

        // Check memory if available
        if (performance.memory) {
            const memoryUsage = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
            if (memoryUsage > this.thresholds.memoryUsage) {
                issues.push({
                    type: 'HIGH_MEMORY',
                    value: memoryUsage,
                    threshold: this.thresholds.memoryUsage
                });
            }
        }

        return {
            healthy: issues.length === 0,
            issues,
            metrics: this.collector.snapshot(),
            domCount,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Record an issue
     */
    _recordIssue(type, details) {
        const issue = {
            type,
            details,
            timestamp: new Date().toISOString()
        };

        this.issues.push(issue);

        // Keep last 100 issues
        if (this.issues.length > 100) {
            this.issues = this.issues.slice(-100);
        }

        DTFR.bus.emit('monitor:issue', issue);

        if (localStorage.getItem('dtfr-debug') === 'true') {
            console.warn('[DTFR Monitor] Issue:', type, details);
        }
    }

    /**
     * Get recent issues
     */
    getIssues(limit = 20) {
        return this.issues.slice(-limit);
    }

    /**
     * Get full diagnostic report
     */
    diagnose() {
        const health = this.check();

        return {
            ...health,
            recentIssues: this.getIssues(),
            config: this.thresholds,
            browser: {
                userAgent: navigator.userAgent,
                memory: performance.memory ? {
                    used: performance.memory.usedJSHeapSize,
                    total: performance.memory.totalJSHeapSize,
                    limit: performance.memory.jsHeapSizeLimit
                } : null,
                connection: navigator.connection ? {
                    effectiveType: navigator.connection.effectiveType,
                    downlink: navigator.connection.downlink
                } : null
            }
        };
    }
}

// ============================================================================
// DTFR Monitor Web Component
// ============================================================================

/**
 * Visual monitor overlay (dev mode only)
 * Usage: <dtfr-monitor-overlay></dtfr-monitor-overlay>
 */
class DTFRMonitorOverlay extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
        this.startUpdates();
    }

    disconnectedCallback() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }

    startUpdates() {
        this.updateInterval = setInterval(() => this.update(), 1000);
    }

    update() {
        if (!DTFR.monitor?.running) return;

        const health = DTFR.monitor.check();
        const statusEl = this.shadowRoot.querySelector('.status');
        const metricsEl = this.shadowRoot.querySelector('.metrics');

        if (statusEl) {
            statusEl.className = `status ${health.healthy ? 'healthy' : 'unhealthy'}`;
            statusEl.textContent = health.healthy ? '● HEALTHY' : '○ ISSUES';
        }

        if (metricsEl) {
            metricsEl.innerHTML = `
        <div>DOM: ${health.domCount}</div>
        <div>Gen: ${health.metrics.generation.avg.toFixed(1)}ms</div>
        <div>Err: ${(health.metrics.errors.rate * 100).toFixed(1)}%</div>
      `;
        }
    }

    render() {
        this.shadowRoot.innerHTML = `
      <style>
        :host {
          position: fixed;
          bottom: 16px;
          right: 16px;
          z-index: 9999;
          font-family: ui-monospace, monospace;
          font-size: 11px;
        }
        .container {
          background: rgba(0, 0, 0, 0.85);
          border: 1px solid #333;
          border-radius: 8px;
          padding: 8px 12px;
          color: #888;
          backdrop-filter: blur(8px);
        }
        .header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }
        .status {
          font-weight: bold;
        }
        .status.healthy { color: #22c55e; }
        .status.unhealthy { color: #ef4444; }
        .metrics {
          display: flex;
          gap: 12px;
        }
        .metrics div {
          color: #666;
        }
      </style>
      <div class="container">
        <div class="header">
          <span class="status healthy">● HEALTHY</span>
          <span style="color: #444">DTFR v${DTFR?.version || '?'}</span>
        </div>
        <div class="metrics">
          <div>DOM: -</div>
          <div>Gen: -</div>
          <div>Err: -</div>
        </div>
      </div>
    `;
    }
}

// ============================================================================
// Register with DTFR
// ============================================================================

const monitor = new DTFRMonitor();

if (typeof DTFR !== 'undefined') {
    DTFR.monitor = monitor;
    DTFR.MonitorOverlay = DTFRMonitorOverlay;

    // Register overlay component
    if (!customElements.get('dtfr-monitor-overlay')) {
        customElements.define('dtfr-monitor-overlay', DTFRMonitorOverlay);
    }
}

// Auto-start in development
if (localStorage.getItem('dtfr-debug') === 'true') {
    monitor.start();
}

export { DTFRMonitor, MetricsCollector, DTFRMonitorOverlay };
