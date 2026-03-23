// kbot MAP-Elites Quality-Diversity Engine
//
// Implements the MAP-Elites algorithm adapted for an AI agent's learning engine.
// Maintains an archive of high-quality solutions indexed by behavioral descriptors,
// enabling exploration of diverse solution strategies.
//
// Grid dimensions:
//   X: taskComplexity  (0-4: trivial / simple / moderate / complex / expert)
//   Y: responseStyle   (0-3: concise / standard / detailed / comprehensive)
//   Total cells: 5 x 4 = 20
//
// Each cell holds the single highest-fitness solution found for that behavioral region.
// Solutions are placed or replaced only when a higher-fitness candidate arrives.
//
// Persists to ~/.kbot/memory/map-elites.json using debounced writes.
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFile, mkdirSync } from 'node:fs';
const LEARN_DIR = join(homedir(), '.kbot', 'memory');
const ARCHIVE_FILE = join(LEARN_DIR, 'map-elites.json');
// ═══ GRID CONSTANTS ══════════════════════════════════════════════
const COMPLEXITY_BINS = 5; // 0..4
const STYLE_BINS = 4; // 0..3
const TOTAL_CELLS = COMPLEXITY_BINS * STYLE_BINS;
// ═══ PERSISTENCE ═════════════════════════════════════════════════
function ensureDir() {
    if (!existsSync(LEARN_DIR))
        mkdirSync(LEARN_DIR, { recursive: true });
}
function loadJSON(path, fallback) {
    ensureDir();
    if (!existsSync(path))
        return fallback;
    try {
        return JSON.parse(readFileSync(path, 'utf-8'));
    }
    catch {
        return fallback;
    }
}
/** Debounced async file writer — batches rapid writes into one I/O */
let pendingTimer = null;
const WRITE_DEBOUNCE_MS = 500;
function saveArchive() {
    ensureDir();
    if (pendingTimer)
        clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => {
        pendingTimer = null;
        writeFile(ARCHIVE_FILE, JSON.stringify(archive, null, 2), () => {
            // non-critical — archive data can be regenerated from future interactions
        });
    }, WRITE_DEBOUNCE_MS);
}
function emptyGrid() {
    const grid = [];
    for (let c = 0; c < COMPLEXITY_BINS; c++) {
        grid[c] = [];
        for (let s = 0; s < STYLE_BINS; s++) {
            grid[c][s] = null;
        }
    }
    return grid;
}
let archive = emptyGrid();
// ═══ PUBLIC API ══════════════════════════════════════════════════
/**
 * Load the archive from disk. Creates an empty grid if the file is missing or corrupt.
 * Call once at startup.
 */
export function initArchive() {
    const raw = loadJSON(ARCHIVE_FILE, null);
    if (raw &&
        Array.isArray(raw) &&
        raw.length === COMPLEXITY_BINS &&
        raw.every(row => Array.isArray(row) && row.length === STYLE_BINS)) {
        archive = raw;
    }
    else {
        archive = emptyGrid();
    }
}
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
export function computeDescriptors(_intent, toolSequence, tokensCost) {
    // Task complexity from tool count
    const toolCount = toolSequence.length;
    let complexity;
    if (toolCount === 0)
        complexity = 0;
    else if (toolCount === 1)
        complexity = 1;
    else if (toolCount <= 3)
        complexity = 2;
    else if (toolCount <= 6)
        complexity = 3;
    else
        complexity = 4;
    // Response style from token cost
    let style;
    if (tokensCost < 200)
        style = 0;
    else if (tokensCost < 500)
        style = 1;
    else if (tokensCost < 1500)
        style = 2;
    else
        style = 3;
    return [complexity, style];
}
/**
 * Compute composite fitness for a solution.
 *
 * Weighted formula:
 *   0.4 * quality (evalResult.overall)
 * + 0.3 * reliability (successRate)
 * + 0.3 * efficiency (penalize expensive solutions)
 */
export function computeFitness(evalResult, successRate, tokensCost) {
    const quality = Math.max(0, Math.min(1, evalResult.overall));
    const reliability = Math.max(0, Math.min(1, successRate));
    const efficiency = 1 - Math.min(tokensCost / 2000, 1);
    return 0.4 * quality + 0.3 * reliability + 0.3 * efficiency;
}
/**
 * Attempt to place a solution in the archive.
 * Only replaces an existing cell if the new solution has higher fitness.
 * Returns true if the solution was placed (new cell or fitness improvement).
 */
export function addToArchive(solution) {
    const [c, s] = solution.descriptors;
    // Bounds check
    if (c < 0 || c >= COMPLEXITY_BINS || s < 0 || s >= STYLE_BINS)
        return false;
    const current = archive[c][s];
    if (!current || solution.fitness > current.fitness) {
        archive[c][s] = solution;
        saveArchive();
        return true;
    }
    return false;
}
/**
 * Get the elite solution for a specific grid cell.
 * Returns null if the cell is empty.
 */
export function getElite(taskComplexity, responseStyle) {
    if (taskComplexity < 0 || taskComplexity >= COMPLEXITY_BINS ||
        responseStyle < 0 || responseStyle >= STYLE_BINS) {
        return null;
    }
    return archive[taskComplexity][responseStyle] ?? null;
}
/**
 * Suggest the best strategy for a new task.
 * Computes descriptors from the task parameters and returns the elite in that cell.
 */
export function suggestStrategy(intent, toolSequence) {
    // Estimate token cost from tool sequence length (heuristic: ~200 tokens per tool call)
    const estimatedTokens = Math.max(100, toolSequence.length * 200);
    const [c, s] = computeDescriptors(intent, toolSequence, estimatedTokens);
    return getElite(c, s);
}
/**
 * Get archive statistics: how many cells are filled, average fitness, coverage, and top elites.
 */
export function getArchiveStats() {
    const elites = [];
    for (let c = 0; c < COMPLEXITY_BINS; c++) {
        for (let s = 0; s < STYLE_BINS; s++) {
            const cell = archive[c][s];
            if (cell)
                elites.push(cell);
        }
    }
    const totalElites = elites.length;
    const avgFitness = totalElites > 0
        ? elites.reduce((sum, e) => sum + e.fitness, 0) / totalElites
        : 0;
    const coverage = totalElites / TOTAL_CELLS;
    const topElites = [...elites]
        .sort((a, b) => b.fitness - a.fitness)
        .slice(0, 5);
    return { totalElites, avgFitness, coverage, topElites };
}
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
export function getArchiveCoverage() {
    const complexityLabels = ['trivial  ', 'simple   ', 'moderate ', 'complex  ', 'expert   '];
    const styleLabels = ['concise', 'standard', 'detailed', 'comprehensive'];
    const lines = [];
    lines.push('MAP-Elites Archive (5x4)');
    lines.push(`             ${styleLabels.map(l => l.padEnd(14)).join('')}`);
    for (let c = 0; c < COMPLEXITY_BINS; c++) {
        const cells = [];
        for (let s = 0; s < STYLE_BINS; s++) {
            const cell = archive[c][s];
            if (cell) {
                cells.push(`██(${cell.fitness.toFixed(2)})`.padEnd(14));
            }
            else {
                cells.push('.'.padEnd(14));
            }
        }
        lines.push(`  ${complexityLabels[c]}  ${cells.join('')}`);
    }
    const stats = getArchiveStats();
    lines.push('');
    lines.push(`Coverage: ${stats.totalElites}/${TOTAL_CELLS} cells (${(stats.coverage * 100).toFixed(0)}%)`);
    if (stats.totalElites > 0) {
        lines.push(`Avg fitness: ${stats.avgFitness.toFixed(3)}`);
    }
    return lines.join('\n');
}
/**
 * Remove elites older than maxAge milliseconds that have 0 uses.
 * Frees up cells for new exploration.
 */
export function pruneArchive(maxAge) {
    const cutoff = Date.now() - maxAge;
    let pruned = 0;
    for (let c = 0; c < COMPLEXITY_BINS; c++) {
        for (let s = 0; s < STYLE_BINS; s++) {
            const cell = archive[c][s];
            if (cell && cell.metadata.uses === 0) {
                const created = new Date(cell.metadata.created).getTime();
                if (created < cutoff) {
                    archive[c][s] = null;
                    pruned++;
                }
            }
        }
    }
    if (pruned > 0)
        saveArchive();
    return pruned;
}
// ═══ INTEGRATION HOOK ════════════════════════════════════════════
/**
 * Called after each agent interaction to potentially update the archive.
 * Computes descriptors and fitness, then attempts to place the solution.
 */
export function learnFromOutcome(intent, toolSequence, evalResult, successRate, tokensCost, retryCount) {
    const descriptors = computeDescriptors(intent, toolSequence, tokensCost);
    const fitness = computeFitness(evalResult, successRate, tokensCost);
    // Extract keywords from intent (simple extraction — mirrors learning.ts approach)
    const keywords = intent
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2)
        .slice(0, 10);
    const solution = {
        pattern: {
            intent,
            toolSequence,
            keywords,
        },
        fitness,
        descriptors,
        metadata: {
            tokensCost,
            toolCallCount: toolSequence.length,
            retryCount,
            created: new Date().toISOString(),
            uses: 0,
        },
    };
    addToArchive(solution);
}
//# sourceMappingURL=quality-diversity.js.map