/**
 * evolution-engine.ts — Meta-engine for self-improving rendering
 *
 * The Evolution Engine discovers new rendering techniques, tests them against
 * the self-evaluation system, and applies what works. It makes all other
 * engines better by continuously experimenting with visual improvements.
 *
 * Architecture:
 *   1. Technique Library — 20+ pre-loaded techniques from ROM hack research
 *   2. Experiment Runner — test technique -> evaluate -> apply or revert
 *   3. Evolution Tick — periodic experiments + announcements
 *   4. Technique Renderer — Canvas 2D implementations for unimplemented techniques
 *   5. Persistence — state saved to ~/.kbot/evolution-state.json across streams
 *   6. Speech — narration of discoveries and improvements
 *
 * Integration: imported by stream-renderer.ts, wired into the frame loop.
 */
export interface EvolutionEngine {
    techniques: TechniqueLibrary;
    experiments: Experiment[];
    applied: AppliedTechnique[];
    researchQueue: string[];
    lastResearchFrame: number;
    lastExperimentFrame: number;
    generationCount: number;
}
export interface TechniqueLibrary {
    techniques: Technique[];
}
export interface Technique {
    id: string;
    name: string;
    source: string;
    category: 'palette' | 'parallax' | 'particles' | 'lighting' | 'tiles' | 'animation' | 'atmosphere' | 'post';
    description: string;
    parameters: Record<string, number>;
    implemented: boolean;
    tested: boolean;
    testScore: number;
    applied: boolean;
    discoveredAt: number;
}
export interface Experiment {
    techniqueId: string;
    paramOverrides: Record<string, number>;
    beforeScore: number;
    afterScore: number;
    chatRateBefore: number;
    chatRateAfter: number;
    status: 'pending' | 'running' | 'complete' | 'reverted';
    startFrame: number;
}
export interface AppliedTechnique {
    techniqueId: string;
    params: Record<string, number>;
    appliedAt: number;
    score: number;
}
export interface EvolutionAction {
    type: 'start_experiment' | 'evaluate' | 'apply' | 'revert' | 'announce';
    technique?: Technique;
    speech?: string;
    renderParams?: Record<string, number>;
}
export declare function initEvolutionEngine(): EvolutionEngine;
export declare function getEvolutionEngine(): EvolutionEngine;
/**
 * Pick an untested technique and start an experiment.
 * Returns the new Experiment, or null if nothing to test.
 */
export declare function runExperiment(engine: EvolutionEngine, techniqueId: string): Experiment | null;
/**
 * Start the experiment: record baseline and mark as running.
 */
export declare function startExperiment(experiment: Experiment, frame: number, currentScore: number, chatRate: number): void;
/**
 * Evaluate a running experiment: compare before/after scores.
 */
export declare function evaluateExperiment(engine: EvolutionEngine, experiment: Experiment, currentScore: number, chatRate: number): void;
/**
 * Apply an experiment's technique permanently.
 */
export declare function applyExperiment(engine: EvolutionEngine, experiment: Experiment): void;
/**
 * Revert an experiment — mark it reverted, don't apply.
 */
export declare function revertExperiment(engine: EvolutionEngine, experiment: Experiment): void;
/**
 * Called every frame. Returns an action when it's time to do something.
 */
export declare function tickEvolution(engine: EvolutionEngine, frame: number, currentScore: number, chatRate: number): EvolutionAction | null;
/**
 * Render a technique onto a Canvas 2D context.
 * For techniques not yet implemented in rom-engine, this provides
 * standalone Canvas 2D implementations.
 */
export declare function renderTechnique(ctx: CanvasRenderingContext2D, technique: Technique, width: number, height: number, frame: number, params: Record<string, number>): void;
export declare function saveEvolutionState(engine: EvolutionEngine): void;
export declare function loadEvolutionState(): EvolutionEngine | null;
export declare function generateEvolutionSpeech(engine: EvolutionEngine, action: EvolutionAction): string;
export declare function registerEvolutionEngineTools(): void;
//# sourceMappingURL=evolution-engine.d.ts.map