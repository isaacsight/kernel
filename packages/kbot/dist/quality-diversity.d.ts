export interface EliteSolution {
    pattern: {
        intent: string;
        toolSequence: string[];
        keywords: string[];
    };
    /** Composite fitness score (0-1) */
    fitness: number;
    /** [taskComplexity, responseStyle] grid coordinates */
    descriptors: [number, number];
    metadata: {
        tokensCost: number;
        toolCallCount: number;
        retryCount: number;
        created: string;
        uses: number;
    };
}
export interface ArchiveStats {
    totalElites: number;
    avgFitness: number;
    /** Fraction of cells occupied (0-1) */
    coverage: number;
    /** Top elites sorted by fitness descending */
    topElites: EliteSolution[];
}
/**
 * Load the archive from disk. Creates an empty grid if the file is missing or corrupt.
 * Call once at startup.
 */
export declare function initArchive(): void;
/**
 * Classify a solution into grid coordinates [taskComplexity, responseStyle].
 *
 * taskComplexity: based on tool count
 *   0 = no tools (trivial)
 *   1 = 1 tool (simple)
 *   2 = 2-3 tools (moderate)
 *   3 = 4-6 tools (complex)
 *   4 = 7+ tools (expert)
 *
 * responseStyle: based on token cost
 *   0 = < 200 tokens (concise)
 *   1 = < 500 tokens (standard)
 *   2 = < 1500 tokens (detailed)
 *   3 = 1500+ tokens (comprehensive)
 */
export declare function computeDescriptors(_intent: string, toolSequence: string[], tokensCost: number): [number, number];
/**
 * Compute composite fitness for a solution.
 *
 * Weighted formula:
 *   0.4 * quality (evalResult.overall)
 * + 0.3 * reliability (successRate)
 * + 0.3 * efficiency (penalize expensive solutions)
 */
export declare function computeFitness(evalResult: {
    overall: number;
}, successRate: number, tokensCost: number): number;
/**
 * Attempt to place a solution in the archive.
 * Only replaces an existing cell if the new solution has higher fitness.
 * Returns true if the solution was placed (new cell or fitness improvement).
 */
export declare function addToArchive(solution: EliteSolution): boolean;
/**
 * Get the elite solution for a specific grid cell.
 * Returns null if the cell is empty.
 */
export declare function getElite(taskComplexity: number, responseStyle: number): EliteSolution | null;
/**
 * Suggest the best strategy for a new task.
 * Computes descriptors from the task parameters and returns the elite in that cell.
 */
export declare function suggestStrategy(intent: string, toolSequence: string[]): EliteSolution | null;
/**
 * Get archive statistics: how many cells are filled, average fitness, coverage, and top elites.
 */
export declare function getArchiveStats(): ArchiveStats;
/**
 * ASCII visualization of the archive grid.
 * Filled cells show a fitness indicator, empty cells show a dot.
 *
 * Example output:
 *   MAP-Elites Archive (5x4)
 *               concise  standard  detailed  comprehensive
 *   trivial     .        ██(0.82)  .         .
 *   simple      ██(0.71) .         ██(0.90)  .
 *   moderate    .        ██(0.65)  .         ██(0.78)
 *   complex     .        .         .         .
 *   expert      .        .         .         ██(0.95)
 */
export declare function getArchiveCoverage(): string;
/**
 * Remove elites older than maxAge milliseconds that have 0 uses.
 * Frees up cells for new exploration.
 */
export declare function pruneArchive(maxAge: number): number;
/**
 * Called after each agent interaction to potentially update the archive.
 * Computes descriptors and fitness, then attempts to place the solution.
 */
export declare function learnFromOutcome(intent: string, toolSequence: string[], evalResult: {
    overall: number;
}, successRate: number, tokensCost: number, retryCount: number): void;
//# sourceMappingURL=quality-diversity.d.ts.map