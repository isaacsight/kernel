/**
 * DTFR Seed-Based Generation Engine
 * 
 * Procedural generation system inspired by Callie.zone.
 * Uses seed composition (date + GitHub + research + visitor bucket)
 * to generate deterministic yet unique experiences.
 * 
 * Pattern Sources:
 * - Callie.zone: Seed-based header generation, mobile fallback
 * - Perlin noise: Natural variation
 * 
 * @module generation/engine
 */

// ============================================================================
// Seed Composition
// ============================================================================

/**
 * Compose a generation seed from multiple inputs
 * @param {Object} inputs - Seed input parameters
 * @returns {number} Deterministic seed value
 */
function composeSeed(inputs = {}) {
    const {
        date = new Date().toISOString().split('T')[0],
        commitSha = 'unknown',
        researchTopic = 'default',
        visitorBucket = 0
    } = inputs;

    const seedString = `${date}-${commitSha}-${researchTopic}-${visitorBucket}`;
    return DTFR.utils.hash(seedString);
}

/**
 * Get current seed inputs from available sources
 */
async function getCurrentSeedInputs() {
    const today = new Date().toISOString().split('T')[0];
    const visitorBucket = DTFR.utils.hash(navigator.userAgent) % 10;

    // Try to get cached GitHub data
    let commitSha = 'unknown';
    try {
        const cached = sessionStorage.getItem('dtfr-github-feed');
        if (cached) {
            const data = JSON.parse(cached);
            commitSha = data.latestCommit || 'unknown';
        }
    } catch (e) {
        console.warn('[Generation] Could not read GitHub cache:', e);
    }

    // Try to get research topic from ledger
    let researchTopic = 'procedural-modular-synthesis';
    try {
        const cached = localStorage.getItem('dtfr-research-topic');
        if (cached) {
            researchTopic = cached;
        }
    } catch (e) {
        console.warn('[Generation] Could not read research topic:', e);
    }

    return {
        date: today,
        commitSha,
        researchTopic,
        visitorBucket
    };
}

class GenerationEngine {
    constructor() {
        this.seed = null;
        this.rng = null;
        this.noise = null;
        this.constraints = {
            maxModulesPerPage: 12,
            minInstructiveModules: 2,
            maxInstructiveModules: 4,
            maxGenerationTimeMs: 20
        };
    }

    /**
     * Initialize engine with seed
     */
    async initialize() {
        const inputs = await getCurrentSeedInputs();
        this.seed = composeSeed(inputs);
        this.rng = new SeededRandom(this.seed);
        this.noise = new SimplexNoise(this.seed);

        DTFR.bus.emit('generation:initialized', {
            seed: this.seed,
            inputs
        });

        return this;
    }

    /**
     * Generate module configuration
     * @param {string} moduleType - Type of module to generate config for
     * @param {Object} baseConfig - Base configuration to extend
     */
    generateConfig(moduleType, baseConfig = {}) {
        const startTime = performance.now();

        const config = {
            ...baseConfig,
            seed: this.seed,
            variant: this.rng.int(0, 99),
            noise: {
                primary: this.noise.noise2D(this.rng.float(0, 100), this.rng.float(0, 100)),
                secondary: this.noise.noise2D(this.rng.float(100, 200), this.rng.float(100, 200))
            },
            generated: true,
            generatedAt: new Date().toISOString()
        };

        const duration = performance.now() - startTime;

        if (duration > this.constraints.maxGenerationTimeMs) {
            console.warn(`[Generation] Config generation for ${moduleType} took ${duration.toFixed(2)}ms (budget: ${this.constraints.maxGenerationTimeMs}ms)`);
        }

        DTFR.bus.emit('generation:config', {
            moduleType,
            duration,
            config
        });

        return config;
    }

    /**
     * Generate page layout based on mode
     * @param {string} mode - Current mode (spec/run/pattern/log)
     */
    generateLayout(mode) {
        const startTime = performance.now();

        const modulePools = {
            spec: {
                instructive: ['dtfr-hero', 'dtfr-console', 'dtfr-stack'],
                adaptive: ['dtfr-feed', 'dtfr-notes']
            },
            run: {
                instructive: ['dtfr-hero', 'dtfr-feed'],
                adaptive: ['dtfr-monitor', 'dtfr-notes']
            },
            pattern: {
                instructive: ['dtfr-hero', 'dtfr-feed'],
                adaptive: ['dtfr-notes']
            },
            log: {
                instructive: ['dtfr-hero', 'dtfr-feed'],
                adaptive: ['dtfr-notes']
            }
        };

        const pool = modulePools[mode] || modulePools.spec;

        const instructive = pool.instructive.map((name, i) => ({
            name,
            priority: 'instructive',
            order: i,
            config: this.generateConfig(name)
        }));

        const adaptive = pool.adaptive.map((name, i) => ({
            name,
            priority: 'adaptive',
            order: instructive.length + i,
            config: this.generateConfig(name)
        }));

        const layout = {
            mode,
            seed: this.seed,
            modules: [...instructive, ...adaptive],
            generatedAt: new Date().toISOString()
        };

        const duration = performance.now() - startTime;

        DTFR.bus.emit('generation:layout', {
            mode,
            duration,
            moduleCount: layout.modules.length,
            layout
        });

        return layout;
    }

    /**
     * Check if generation should proceed or use static fallback
     */
    shouldGenerate() {
        if (DTFR.utils.isMobile()) return false;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
        if (localStorage.getItem('dtfr-static-mode') === 'true') return false;
        return true;
    }
}

// ============================================================================
// Register with DTFR
// ============================================================================

const generationEngine = new GenerationEngine();

// Add to DTFR namespace
if (typeof DTFR !== 'undefined') {
    DTFR.generation = generationEngine;
    DTFR.SeededRandom = SeededRandom;
    DTFR.SimplexNoise = SimplexNoise;
}

// Auto-initialize
generationEngine.initialize().catch(e => {
    console.error('[Generation] Failed to initialize:', e);
});

export {
    GenerationEngine,
    SeededRandom,
    SimplexNoise,
    composeSeed,
    getCurrentSeedInputs
};
