/**
 * DTFR Metrics System
 * 
 * Tracks user engagement, module performance, and evolution signals.
 * Used for metrics-driven optimization and pattern extraction.
 * 
 * Pattern Sources:
 * - Adobe: Design system adherence and performance tracking
 * - Product Analytics: Engagement and retention metrics
 * 
 * @module metrics
 */

class DTFRMetrics {
    constructor() {
        this._events = [];
        this._userId = this._getOrCreateUserId();
        this._sessionStartTime = Date.now();
        this._heartbeatInterval = null;
        this._initialized = false;
    }

    init() {
        if (this._initialized) return;
        this._initialized = true;

        // Track initial page load
        this.track('page_view', {
            mode: DTFR.context.get('mode'),
            seed: DTFR.context.get('seed')
        });

        // Listen for shell mode changes
        DTFR.bus.on('shell:mode-changed', (data) => {
            this.track('mode_switch', { from: data.prev, to: data.next });
        });

        // Listen for module mounts
        DTFR.bus.on('module:mounted', (data) => {
            this.track('module_mount', {
                module: data.tagName,
                duration: data.duration,
                generated: data.element?.getAttribute('data-generated') === 'true'
            });
        });

        // Listen for intent submissions
        DTFR.bus.on('console:intent-submitted', (data) => {
            this.track('intent_submission', { intentLength: data.intent.length });
        });

        // Intelligence Integration: Simulated Reasoning Pipeline
        DTFR.bus.on('command:submit', (data) => {
            this._runReasoningCycle(data.query);
        });

        // Listen for validation results
        DTFR.bus.on('monitor:unhealthy', (data) => {
            this.track('system_unhealthy', { issueCount: data.issues.length });
        });

        // Start heartbeat (every 30 seconds)
        this._startHeartbeat();

        // Track session end on page hide
        window.addEventListener('pagehide', () => this._onPageHide());

        // Start live telemetry simulation for v2.1 UI
        this._startLiveTelemetry();

        console.log('[DTFR Metrics] Initialized');
    }

    async _runReasoningCycle(query) {
        // Stage 1: Rewrite
        DTFR.bus.emit('system:process-stage', {
            stage: 'rewrite',
            message: 'Expanding intent for architectural depth...'
        });
        await new Promise(r => setTimeout(r, 1200));

        // Stage 2: Search
        DTFR.bus.emit('system:process-stage', {
            stage: 'search',
            message: 'Executing parallel retrieval (PPX + Web)...'
        });
        await new Promise(r => setTimeout(r, 2000));

        // Stage 3: Synthesis
        DTFR.bus.emit('system:process-stage', {
            stage: 'synthesis',
            message: 'Aggregating evidence set and cross-checking...'
        });
        await new Promise(r => setTimeout(r, 1500));

        // Stage 4: Finalization
        DTFR.bus.emit('system:process-stage', {
            stage: 'finalization',
            message: 'Finalizing specification & provenance seal.'
        });

        this.track('reasoning_complete', { queryLength: query.length });
    }

    _startLiveTelemetry() {
        // Base stats
        let executions = 8900 + Math.floor(Math.random() * 100);
        let uptime = 99.8;

        setInterval(() => {
            // Slight fluctuations
            executions += Math.random() > 0.7 ? 1 : 0;
            const latency = 400 + Math.floor(Math.random() * 200);
            uptime = Math.min(100, uptime + (Math.random() - 0.5) * 0.01);

            DTFR.bus.emit('system:telemetry', {
                executions: executions.toLocaleString(),
                uptime: uptime.toFixed(1) + '%',
                latency: latency + 'ms',
                agents: 3,
                timestamp: new Date().toISOString()
            });
        }, 3000);
    }

    track(eventName, properties = {}) {
        const event = {
            event: eventName,
            properties: {
                ...properties,
                userId: this._userId,
                sessionId: this._sessionStartTime,
                timestamp: Date.now(),
                path: window.location.pathname,
                mode: DTFR.context?.get('mode')
            }
        };

        if (localStorage.getItem('dtfr-debug') === 'true') {
            console.log(`[DTFR Metrics] ${eventName}`, properties);
        }

        this._events.push(event);

        // Persist to localStorage for local development
        this._persistEvents();

        // In production, sync to backend here
        this._syncWithBackend();
    }

    _getOrCreateUserId() {
        let id = localStorage.getItem('dtfr-user-id');
        if (!id) {
            id = 'user-' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('dtfr-user-id', id);
        }
        return id;
    }

    _startHeartbeat() {
        this._heartbeatInterval = setInterval(() => {
            const timeSpent = Math.floor((Date.now() - this._sessionStartTime) / 1000);
            this.track('heartbeat', { timeSpentSeconds: timeSpent });
        }, 30000);
    }

    _onPageHide() {
        if (this._heartbeatInterval) clearInterval(this._heartbeatInterval);
        const timeSpent = Math.floor((Date.now() - this._sessionStartTime) / 1000);
        this.track('session_end', { totalTimeSeconds: timeSpent });
        // Attempt one final sync
        this._syncWithBackend(true);
    }

    _persistEvents() {
        // Keep max 100 events in local storage
        const stored = this._events.slice(-100);
        localStorage.setItem('dtfr-metrics-log', JSON.stringify(stored));
    }

    async _syncWithBackend(isEnding = false) {
        if (this._events.length === 0) return;

        // In a real implementation, this would be an API call
        // For now, we just clear the in-memory buffer after "sync"
        if (!isEnding) {
            // this._events = []; 
        }
    }

    /**
     * Get basic stats for the current session
     */
    getSessionStats() {
        return {
            userId: this._userId,
            duration: Math.floor((Date.now() - this._sessionStartTime) / 1000),
            eventCount: this._events.length,
            currentMode: DTFR.context?.get('mode')
        };
    }
}

// ============================================================================
// Register with DTFR
// ============================================================================

const metrics = new DTFRMetrics();

if (typeof DTFR !== 'undefined') {
    DTFR.metrics = metrics;
}

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => metrics.init());
} else {
    metrics.init();
}

export { metrics as DTFRMetrics };
