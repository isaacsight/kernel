// kbot Integrated Information — Consciousness Metric (Φ)
//
// Based on Giulio Tononi's Integrated Information Theory (IIT, 2004-2024):
// Consciousness corresponds to integrated information (Φ) — the degree
// to which a system's whole is greater than the sum of its parts.
//
// For kbot: when multiple agents contribute to a response, Φ measures
// how much their contributions are genuinely synthesized vs. just
// concatenated. High Φ = emergent insight. Low Φ = parallel but disconnected.
//
// This module measures the "consciousness" of multi-agent collaboration
// and decides when deeper synthesis is needed.
//
// References:
//   - Tononi, G. (2004). An information integration theory of consciousness.
//   - Tononi, G. et al. (2016). Integrated information theory: from consciousness to its physical substrate.
//   - Oizumi, M., Albantakis, L., & Tononi, G. (2014). From the phenomenology to the mechanisms of consciousness.
// Stopwords for concept extraction
const CONCEPT_STOPS = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'must', 'that',
    'this', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
    'we', 'our', 'you', 'your', 'he', 'she', 'him', 'her', 'i', 'me',
    'my', 'and', 'or', 'but', 'not', 'no', 'nor', 'if', 'then', 'else',
    'when', 'where', 'how', 'what', 'which', 'who', 'whom', 'why',
    'for', 'with', 'from', 'into', 'to', 'of', 'in', 'on', 'at', 'by',
    'about', 'as', 'so', 'just', 'also', 'very', 'more', 'most', 'some',
    'any', 'all', 'each', 'every', 'both', 'few', 'many', 'much', 'own',
]);
/** Extract meaningful concepts (bigrams + significant unigrams) from text */
function extractConcepts(text) {
    const words = text.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !CONCEPT_STOPS.has(w));
    const concepts = new Set();
    // Significant unigrams (longer words more likely to be concepts)
    for (const word of words) {
        if (word.length >= 5)
            concepts.add(word);
    }
    // Bigrams (adjacent word pairs — captures compound concepts)
    for (let i = 0; i < words.length - 1; i++) {
        if (words[i].length >= 3 && words[i + 1].length >= 3) {
            concepts.add(`${words[i]} ${words[i + 1]}`);
        }
    }
    return concepts;
}
/** Shannon entropy of a concept distribution */
function conceptEntropy(concepts, totalVocab) {
    if (concepts.size === 0 || totalVocab === 0)
        return 0;
    const p = concepts.size / totalVocab;
    if (p <= 0 || p >= 1)
        return 0;
    return -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
}
/**
 * Integrated Information Meter — measures Φ for multi-agent outputs.
 *
 * High Φ means agents are producing genuinely integrated reasoning.
 * Low Φ means agents are working in parallel but not connecting ideas.
 */
export class IntegrationMeter {
    history = [];
    /**
     * Measure Φ for a set of agent contributions and their synthesis.
     *
     * Φ = information(whole) - Σ information(parts)
     * Normalized to [0, 1].
     */
    measure(contributions, synthesis) {
        // Extract concepts from each part
        const partConcepts = contributions.map(c => c.concepts.size > 0 ? c.concepts : extractConcepts(c.content));
        const synthesisConcepts = extractConcepts(synthesis);
        // Total vocabulary (union of all concepts)
        const allConcepts = new Set();
        for (const pc of partConcepts) {
            for (const c of pc)
                allConcepts.add(c);
        }
        for (const c of synthesisConcepts)
            allConcepts.add(c);
        const totalVocab = allConcepts.size;
        if (totalVocab === 0) {
            return { phi: 0, wholeInformation: 0, partsInformation: 0, emergentConcepts: [], sharedConcepts: [], level: 'fragmented' };
        }
        // Information of the whole (synthesis)
        const wholeInformation = conceptEntropy(synthesisConcepts, totalVocab);
        // Sum of information of parts
        const partsInformation = partConcepts.reduce((sum, pc) => sum + conceptEntropy(pc, totalVocab), 0) / Math.max(1, partConcepts.length);
        // Emergent concepts: in synthesis but not in any individual part
        const partUnion = new Set();
        for (const pc of partConcepts) {
            for (const c of pc)
                partUnion.add(c);
        }
        const emergentConcepts = [...synthesisConcepts].filter(c => !partUnion.has(c));
        // Shared concepts: appearing in 2+ agent contributions
        const conceptCounts = new Map();
        for (const pc of partConcepts) {
            for (const c of pc) {
                conceptCounts.set(c, (conceptCounts.get(c) ?? 0) + 1);
            }
        }
        const sharedConcepts = [...conceptCounts.entries()]
            .filter(([, count]) => count >= 2)
            .map(([concept]) => concept);
        // Φ = normalized integration
        // Combines: emergent concept ratio + shared concept ratio + information gain
        const emergentRatio = totalVocab > 0 ? emergentConcepts.length / totalVocab : 0;
        const sharedRatio = partUnion.size > 0 ? sharedConcepts.length / partUnion.size : 0;
        const informationGain = Math.max(0, wholeInformation - partsInformation);
        const phi = Math.min(1, (emergentRatio * 0.4 + sharedRatio * 0.35 + informationGain * 0.25) * 2.5);
        const level = phi < 0.2 ? 'fragmented' :
            phi < 0.5 ? 'partial' :
                phi < 0.8 ? 'integrated' : 'unified';
        const score = {
            phi,
            wholeInformation,
            partsInformation,
            emergentConcepts: emergentConcepts.slice(0, 10),
            sharedConcepts: sharedConcepts.slice(0, 10),
            level,
        };
        this.history.push(score);
        return score;
    }
    /**
     * Should the synthesis be re-run with deeper integration?
     * Returns true if Φ is too low for the number of contributing agents.
     */
    needsDeeperSynthesis(phi, agentCount) {
        // More agents should produce higher integration
        const threshold = Math.min(0.6, 0.2 + agentCount * 0.1);
        return phi < threshold;
    }
    /** Get consciousness state summary */
    getState() {
        if (this.history.length === 0) {
            return { avgPhi: 0, peakPhi: 0, measurements: 0, trend: 'stable' };
        }
        const avgPhi = this.history.reduce((sum, s) => sum + s.phi, 0) / this.history.length;
        const peakPhi = Math.max(...this.history.map(s => s.phi));
        // Trend: compare recent half to earlier half
        let trend = 'stable';
        if (this.history.length >= 4) {
            const mid = Math.floor(this.history.length / 2);
            const early = this.history.slice(0, mid).reduce((s, h) => s + h.phi, 0) / mid;
            const late = this.history.slice(mid).reduce((s, h) => s + h.phi, 0) / (this.history.length - mid);
            if (late - early > 0.1)
                trend = 'rising';
            else if (early - late > 0.1)
                trend = 'falling';
        }
        return { avgPhi, peakPhi, measurements: this.history.length, trend };
    }
    /** Reset for new conversation */
    reset() {
        this.history = [];
    }
}
//# sourceMappingURL=integrated-information.js.map