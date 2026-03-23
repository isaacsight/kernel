// Computational decidability detection — inspired by Gödel's incompleteness
// theorem and the UBC Okanagan research proving some problems can't be solved
// algorithmically. Detects when the agent is stuck and should hand off.
export var LoopPattern;
(function (LoopPattern) {
    LoopPattern["tool_repetition"] = "tool_repetition";
    LoopPattern["output_oscillation"] = "output_oscillation";
    LoopPattern["cost_spiral"] = "cost_spiral";
    LoopPattern["context_exhaustion"] = "context_exhaustion";
    LoopPattern["semantic_stagnation"] = "semantic_stagnation";
    LoopPattern["circular_reasoning"] = "circular_reasoning";
})(LoopPattern || (LoopPattern = {}));
const RECOMMENDATIONS = {
    [LoopPattern.tool_repetition]: 'simplify',
    [LoopPattern.output_oscillation]: 'handoff',
    [LoopPattern.cost_spiral]: 'handoff',
    [LoopPattern.context_exhaustion]: 'decompose',
    [LoopPattern.semantic_stagnation]: 'simplify',
    [LoopPattern.circular_reasoning]: 'handoff',
};
const EVIDENCE_MESSAGES = {
    [LoopPattern.tool_repetition]: 'Same tool called repeatedly with similar arguments — try a different approach.',
    [LoopPattern.output_oscillation]: 'Output alternating between two states — going back and forth without progress.',
    [LoopPattern.cost_spiral]: 'Cost is accelerating without convergence — getting expensive without results.',
    [LoopPattern.context_exhaustion]: 'Context window nearly full — too much information for one pass.',
    [LoopPattern.semantic_stagnation]: 'Last several outputs are nearly identical — not making progress.',
    [LoopPattern.circular_reasoning]: 'Tool results being fed back as inputs — reasoning in circles.',
};
export function jaccardSimilarity(a, b) {
    const setA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const setB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    if (setA.size === 0 && setB.size === 0)
        return 1;
    if (setA.size === 0 || setB.size === 0)
        return 0;
    let intersection = 0;
    for (const w of setA) {
        if (setB.has(w))
            intersection++;
    }
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
}
export function detectOscillation(outputs) {
    if (outputs.length < 4)
        return false;
    const recent = outputs.slice(-6);
    if (recent.length < 4)
        return false;
    // Check A-B-A-B pattern: compare [0] with [2] and [1] with [3]
    for (let i = 0; i <= recent.length - 4; i++) {
        const simAC = jaccardSimilarity(recent[i], recent[i + 2]);
        const simBD = jaccardSimilarity(recent[i + 1], recent[i + 3]);
        const simAB = jaccardSimilarity(recent[i], recent[i + 1]);
        // A≈C and B≈D but A≠B → oscillation
        if (simAC > 0.8 && simBD > 0.8 && simAB < 0.5)
            return true;
    }
    return false;
}
export class LoopDetector {
    toolHistory = [];
    outputs = [];
    totalCost = 0;
    costHistory = [];
    totalTokens = 0;
    opts;
    constructor(options) {
        this.opts = {
            maxToolRepeats: options?.maxToolRepeats ?? 5,
            maxCostUsd: options?.maxCostUsd ?? 1.0,
            maxTokens: options?.maxTokens ?? 50000,
            similarityThreshold: options?.similarityThreshold ?? 0.85,
        };
    }
    recordToolCall(toolName, args, result) {
        this.toolHistory.push({ name: toolName, args, result, timestamp: Date.now() });
    }
    recordOutput(output) {
        this.outputs.push(output);
    }
    recordCost(costUsd) {
        this.totalCost += costUsd;
        this.costHistory.push(this.totalCost);
    }
    recordTokens(tokens) {
        this.totalTokens += tokens;
    }
    check() {
        const base = {
            tokensBurned: this.totalTokens,
            costBurned: this.totalCost,
        };
        // 1. Tool repetition
        const repetition = this.checkToolRepetition();
        if (repetition)
            return { ...base, ...repetition };
        // 2. Output oscillation
        if (detectOscillation(this.outputs)) {
            return {
                ...base,
                decidable: false,
                confidence: 0.85,
                pattern: LoopPattern.output_oscillation,
                evidence: EVIDENCE_MESSAGES[LoopPattern.output_oscillation],
                recommendation: RECOMMENDATIONS[LoopPattern.output_oscillation],
            };
        }
        // 3. Cost spiral
        if (this.checkCostSpiral()) {
            return {
                ...base,
                decidable: false,
                confidence: 0.9,
                pattern: LoopPattern.cost_spiral,
                evidence: `${EVIDENCE_MESSAGES[LoopPattern.cost_spiral]} ($${this.totalCost.toFixed(2)} spent)`,
                recommendation: RECOMMENDATIONS[LoopPattern.cost_spiral],
            };
        }
        // 4. Context exhaustion
        if (this.totalTokens > this.opts.maxTokens) {
            return {
                ...base,
                decidable: false,
                confidence: 0.95,
                pattern: LoopPattern.context_exhaustion,
                evidence: `${EVIDENCE_MESSAGES[LoopPattern.context_exhaustion]} (${this.totalTokens} tokens used)`,
                recommendation: RECOMMENDATIONS[LoopPattern.context_exhaustion],
            };
        }
        // 5. Semantic stagnation
        if (this.checkSemanticStagnation()) {
            return {
                ...base,
                decidable: false,
                confidence: 0.8,
                pattern: LoopPattern.semantic_stagnation,
                evidence: EVIDENCE_MESSAGES[LoopPattern.semantic_stagnation],
                recommendation: RECOMMENDATIONS[LoopPattern.semantic_stagnation],
            };
        }
        // 6. Circular reasoning
        if (this.checkCircularReasoning()) {
            return {
                ...base,
                decidable: false,
                confidence: 0.75,
                pattern: LoopPattern.circular_reasoning,
                evidence: EVIDENCE_MESSAGES[LoopPattern.circular_reasoning],
                recommendation: RECOMMENDATIONS[LoopPattern.circular_reasoning],
            };
        }
        // All clear
        return {
            ...base,
            decidable: true,
            confidence: 1.0,
            evidence: 'No loop patterns detected.',
            recommendation: 'continue',
        };
    }
    reset() {
        this.toolHistory = [];
        this.outputs = [];
        this.totalCost = 0;
        this.costHistory = [];
        this.totalTokens = 0;
    }
    checkToolRepetition() {
        if (this.toolHistory.length < this.opts.maxToolRepeats)
            return null;
        // Group recent calls by tool name
        const recent = this.toolHistory.slice(-10);
        const groups = new Map();
        for (const record of recent) {
            if (!groups.has(record.name))
                groups.set(record.name, []);
            groups.get(record.name).push(record);
        }
        for (const [name, calls] of groups) {
            if (calls.length < this.opts.maxToolRepeats)
                continue;
            // Check if args are similar
            let similarCount = 0;
            for (let i = 1; i < calls.length; i++) {
                if (jaccardSimilarity(calls[i].args, calls[0].args) > this.opts.similarityThreshold) {
                    similarCount++;
                }
            }
            if (similarCount >= this.opts.maxToolRepeats - 1) {
                return {
                    decidable: false,
                    confidence: 0.9,
                    pattern: LoopPattern.tool_repetition,
                    evidence: `${EVIDENCE_MESSAGES[LoopPattern.tool_repetition]} (${name} called ${calls.length}x)`,
                    recommendation: RECOMMENDATIONS[LoopPattern.tool_repetition],
                };
            }
        }
        return null;
    }
    checkCostSpiral() {
        if (this.totalCost < this.opts.maxCostUsd)
            return false;
        if (this.costHistory.length < 4)
            return true; // Over budget with few steps = spiral
        // Check if cost rate is accelerating
        const recent = this.costHistory.slice(-4);
        const deltas = [];
        for (let i = 1; i < recent.length; i++) {
            deltas.push(recent[i] - recent[i - 1]);
        }
        // Accelerating if each delta is larger than the previous
        return deltas.length >= 2 && deltas[deltas.length - 1] > deltas[0];
    }
    checkSemanticStagnation() {
        if (this.outputs.length < 3)
            return false;
        const recent = this.outputs.slice(-3);
        for (let i = 1; i < recent.length; i++) {
            if (jaccardSimilarity(recent[i], recent[0]) < 0.9)
                return false;
        }
        return true;
    }
    checkCircularReasoning() {
        if (this.toolHistory.length < 3)
            return false;
        const recent = this.toolHistory.slice(-5);
        for (let i = 1; i < recent.length; i++) {
            const prevResult = recent[i - 1].result;
            const currArgs = recent[i].args;
            // If >40% of words in current args appeared in previous result
            if (prevResult.length > 20 && currArgs.length > 20) {
                const resultWords = new Set(prevResult.toLowerCase().split(/\s+/).filter(w => w.length > 3));
                const argWords = currArgs.toLowerCase().split(/\s+/).filter(w => w.length > 3);
                if (argWords.length === 0)
                    continue;
                let overlap = 0;
                for (const w of argWords) {
                    if (resultWords.has(w))
                        overlap++;
                }
                if (overlap / argWords.length > 0.4)
                    return true;
            }
        }
        return false;
    }
}
//# sourceMappingURL=godel-limits.js.map