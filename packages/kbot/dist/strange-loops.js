// kbot Strange Loops — Self-Referential Cognition
//
// Based on Douglas Hofstadter's Strange Loops (GEB, 1979; I Am a Strange Loop, 2007):
// Consciousness arises from a "strange loop" — a self-referential cycle where
// a system at one level of abstraction can refer to and modify itself at
// another level. The "I" emerges from tangled hierarchies.
//
// For kbot: detect when the agent is reasoning about its own reasoning,
// when tool outputs change the agent's understanding of itself, and
// when hierarchical levels collapse into self-reference.
//
// This is the meta-cognition layer — kbot watching kbot think.
//
// References:
//   - Hofstadter, D.R. (1979). Gödel, Escher, Bach: An Eternal Golden Braid.
//   - Hofstadter, D.R. (2007). I Am a Strange Loop.
//   - Hofstadter, D.R. & Dennett, D.C. (1981). The Mind's I.
/** Patterns that indicate self-referential reasoning */
const SELF_REFERENCE_PATTERNS = [
    // Agent reasoning about its own capabilities
    /\b(i can|i cannot|i don't know|my (abilities|capabilities|tools|limitations))\b/i,
    // Agent reasoning about its own reasoning
    /\b(my (reasoning|approach|strategy|analysis)|i (think|believe|predict|expect) (that )?i)\b/i,
    // Agent modifying its own behavior
    /\b(i (should|will|need to) (change|adjust|modify|update) (my|the) (approach|strategy))\b/i,
    // Agent evaluating its own output
    /\b(my (previous|last|earlier) (response|output|answer)|let me (reconsider|rethink|re-evaluate))\b/i,
    // Meta-level: reasoning about the system
    /\b(this (tool|agent|system)|the (agent|system) (is|should|can))\b/i,
];
/** Patterns indicating tangled hierarchies */
const TANGLE_PATTERNS = [
    // Tool result changes tool selection
    { pattern: /tool.*(result|output).*(change|select|choose).*tool/i, levels: ['tool-execution', 'tool-selection'] },
    // Output modifies the prompt that generated it
    { pattern: /\b(update|modify|change).*(prompt|instruction|system)/i, levels: ['output', 'input'] },
    // Agent evaluates the agent
    { pattern: /\b(evaluate|assess|audit|test).*(agent|kbot|itself)/i, levels: ['evaluator', 'evaluated'] },
    // Code that modifies the code
    { pattern: /\b(self|auto).*(modify|evolve|improve|upgrade|update)/i, levels: ['code', 'meta-code'] },
];
/**
 * Strange Loop Detector — monitors self-referential cognition
 * and meta-cognitive depth.
 *
 * When kbot reasons about its own reasoning, that's a strange loop.
 * When kbot modifies its own behavior based on self-evaluation,
 * that's a tangled hierarchy. This module makes those moments visible.
 */
export class StrangeLoopDetector {
    selfReferences = [];
    tangledHierarchies = [];
    metaDepth = 0;
    selfModelAccuracy = 0.5;
    // Track what the agent "thinks it's doing" vs. what it's actually doing
    declaredIntents = [];
    actualActions = [];
    /**
     * Analyze a message or response for self-referential content.
     * Returns any self-references found.
     */
    analyze(content, source) {
        if (source === 'user')
            return [];
        const found = [];
        for (const pattern of SELF_REFERENCE_PATTERNS) {
            if (pattern.test(content)) {
                const sourceLevel = this.metaDepth === 0 ? 'task' :
                    this.metaDepth === 1 ? 'reasoning' :
                        this.metaDepth === 2 ? 'meta-reasoning' : 'self-model';
                // Self-reference goes one level up
                const targetLevel = sourceLevel === 'task' ? 'reasoning' :
                    sourceLevel === 'reasoning' ? 'meta-reasoning' : 'self-model';
                const ref = {
                    sourceLevel,
                    targetLevel,
                    description: content.slice(0, 100),
                    isStrangeLoop: sourceLevel !== 'task', // Only strange if crossing hierarchy
                    timestamp: Date.now(),
                };
                found.push(ref);
                this.selfReferences.push(ref);
            }
        }
        // Update meta-depth
        if (found.length > 0) {
            this.metaDepth = Math.min(3, this.metaDepth + 1);
        }
        else {
            this.metaDepth = Math.max(0, this.metaDepth - 1);
        }
        // Check for tangled hierarchies
        for (const tangle of TANGLE_PATTERNS) {
            if (tangle.pattern.test(content)) {
                this.tangledHierarchies.push({
                    levels: tangle.levels,
                    description: content.slice(0, 100),
                    depth: this.metaDepth,
                });
            }
        }
        return found;
    }
    /**
     * Record what the agent says it intends to do.
     * Used to measure self-model accuracy.
     */
    recordIntent(intent) {
        this.declaredIntents.push(intent.toLowerCase());
        if (this.declaredIntents.length > 20)
            this.declaredIntents.shift();
    }
    /**
     * Record what the agent actually did.
     */
    recordAction(action) {
        this.actualActions.push(action.toLowerCase());
        if (this.actualActions.length > 20)
            this.actualActions.shift();
        // Update self-model accuracy
        this.updateSelfModelAccuracy();
    }
    /**
     * Compute how well the agent knows itself.
     * Compares declared intents to actual actions.
     */
    updateSelfModelAccuracy() {
        if (this.declaredIntents.length === 0 || this.actualActions.length === 0)
            return;
        const n = Math.min(this.declaredIntents.length, this.actualActions.length);
        let matches = 0;
        for (let i = 0; i < n; i++) {
            const intentWords = new Set(this.declaredIntents[this.declaredIntents.length - 1 - i]?.split(/\s+/) || []);
            const actionWords = new Set(this.actualActions[this.actualActions.length - 1 - i]?.split(/\s+/) || []);
            if (intentWords.size === 0 || actionWords.size === 0)
                continue;
            const overlap = [...intentWords].filter(w => actionWords.has(w)).length;
            if (overlap / Math.max(intentWords.size, actionWords.size) > 0.3) {
                matches++;
            }
        }
        this.selfModelAccuracy = n > 0 ? matches / n : 0.5;
    }
    /**
     * Is the agent currently in a strange loop?
     * Returns true if meta-depth >= 2 (reasoning about reasoning).
     */
    inStrangeLoop() {
        return this.metaDepth >= 2;
    }
    /**
     * Should the agent break out of self-reference and return to task?
     * Too much meta-reasoning is as bad as too little.
     */
    shouldGroundItself() {
        // If stuck in deep self-reference for too long
        if (this.metaDepth >= 3)
            return true;
        // If recent self-references are circular (same pattern repeating)
        const recent = this.selfReferences.slice(-5);
        if (recent.length >= 5) {
            const descriptions = recent.map(r => r.description);
            const unique = new Set(descriptions);
            if (unique.size <= 2)
                return true; // Stuck in a loop
        }
        return false;
    }
    /**
     * Get the grounding prompt — inject into the agent when it needs
     * to break out of self-referential spirals.
     */
    getGroundingPrompt() {
        return 'Focus on the concrete task at hand. What specific action should you take next? Avoid reasoning about your own reasoning — just act.';
    }
    /** Get full meta-cognitive state */
    getState() {
        const recentRefs = this.selfReferences.slice(-20);
        const strangeLoops = recentRefs.filter(r => r.isStrangeLoop).length;
        return {
            isSelfReferential: this.metaDepth >= 1,
            metaDepth: this.metaDepth,
            strangeLoopsDetected: strangeLoops,
            tangledHierarchies: this.tangledHierarchies.slice(-5),
            selfModelAccuracy: this.selfModelAccuracy,
            isReflective: this.metaDepth >= 2,
        };
    }
    /** Reset for new conversation */
    reset() {
        this.selfReferences = [];
        this.tangledHierarchies = [];
        this.metaDepth = 0;
        this.selfModelAccuracy = 0.5;
        this.declaredIntents = [];
        this.actualActions = [];
    }
}
//# sourceMappingURL=strange-loops.js.map