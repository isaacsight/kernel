// @kernel.chat/skill-router — Bayesian Skill-Rating Router for AI Agents
//
// Routes tasks to the best specialist agent using TrueSkill-style ratings.
// Ratings improve with every interaction. Zero LLM calls — pure math.
//
// Usage:
//   import { SkillRouter } from '@kernel.chat/skill-router'
//
//   const router = new SkillRouter({
//     agents: ['coder', 'researcher', 'writer'],
//     categories: ['coding', 'research', 'writing', 'general'],
//   })
//
//   const best = router.route('fix the login bug')
//   // → { agent: 'coder', category: 'coding', confidence: 0.73 }
//
//   router.recordOutcome('coder', 'coding', 'win')
//   router.save('/path/to/ratings.json')
// ── Constants ──────────────────────────────────────────────────────────
const DEFAULT_MU = 25.0;
const DEFAULT_SIGMA = DEFAULT_MU / 3;
const DEFAULT_MIN_SIGMA = 0.5;
/** Built-in category keywords — works out of the box */
const DEFAULT_KEYWORDS = {
    coding: [
        'code', 'function', 'implement', 'build', 'create', 'component', 'module',
        'class', 'interface', 'type', 'typescript', 'javascript', 'python', 'rust',
        'react', 'node', 'api', 'endpoint', 'route', 'hook', 'scaffold',
        'import', 'export', 'async', 'package', 'npm',
    ],
    debugging: [
        'fix', 'bug', 'error', 'crash', 'debug', 'broken', 'fail', 'issue',
        'exception', 'stack', 'trace', 'undefined', 'null', 'hang', 'freeze',
        'memory', 'leak', 'regression',
    ],
    refactoring: [
        'refactor', 'clean', 'reorganize', 'restructure', 'simplify', 'extract',
        'rename', 'move', 'split', 'merge', 'consolidate', 'deduplicate',
        'optimize', 'improve', 'modernize',
    ],
    research: [
        'research', 'find', 'compare', 'benchmark', 'search', 'alternative',
        'documentation', 'docs', 'article', 'paper', 'study', 'investigate',
        'explore', 'discover', 'learn', 'understand', 'explain',
    ],
    analysis: [
        'analyze', 'strategy', 'plan', 'architecture', 'review', 'audit',
        'evaluate', 'assess', 'performance', 'cost', 'metric',
        'dashboard', 'report', 'insight', 'decision', 'priority',
    ],
    writing: [
        'write', 'draft', 'blog', 'email', 'document', 'readme', 'changelog',
        'announcement', 'copy', 'content', 'marketing', 'social',
        'newsletter', 'story', 'essay', 'summary', 'summarize',
    ],
    devops: [
        'deploy', 'ship', 'release', 'publish', 'ci', 'cd', 'pipeline',
        'docker', 'kubernetes', 'container', 'server', 'host', 'cloud',
        'aws', 'gcp', 'azure', 'infrastructure', 'terraform',
    ],
    security: [
        'security', 'vulnerability', 'exploit', 'attack', 'auth', 'permission',
        'encrypt', 'token', 'secret', 'credential', 'ssl', 'tls',
        'audit', 'scan', 'xss', 'csrf', 'injection',
    ],
    design: [
        'design', 'ui', 'ux', 'layout', 'color', 'font', 'typography',
        'responsive', 'mobile', 'animation', 'css', 'style', 'theme',
        'accessibility', 'a11y',
    ],
    data: [
        'data', 'database', 'sql', 'query', 'table', 'schema', 'migration',
        'csv', 'json', 'parse', 'transform', 'aggregate', 'statistics',
        'chart', 'visualization', 'analytics',
    ],
    general: [
        'help', 'hello', 'hey', 'hi', 'thanks', 'what', 'how', 'why',
        'general', 'chat', 'talk', 'opinion', 'think', 'advice',
    ],
};
// ── Core Router ────────────────────────────────────────────────────────
export class SkillRouter {
    agents;
    categories;
    keywords;
    ratings;
    mu0;
    sigma0;
    minSigma;
    dirty = false;
    constructor(config) {
        this.agents = config.agents;
        this.mu0 = config.initialMu ?? DEFAULT_MU;
        this.sigma0 = config.initialSigma ?? (this.mu0 / 3);
        this.minSigma = config.minSigma ?? DEFAULT_MIN_SIGMA;
        // Merge custom keywords with defaults
        this.keywords = { ...DEFAULT_KEYWORDS, ...config.keywords };
        this.categories = config.categories ?? Object.keys(this.keywords);
        // Initialize ratings
        this.ratings = {};
        for (const agent of this.agents) {
            this.ratings[agent] = {};
            for (const cat of this.categories) {
                this.ratings[agent][cat] = { mu: this.mu0, sigma: this.sigma0 };
            }
            this.ratings[agent]['_overall'] = { mu: this.mu0, sigma: this.sigma0 };
        }
    }
    // ── Category Classification ──
    /**
     * Classify a message into a task category using keyword matching.
     * Fast — no LLM call needed. O(keywords * words).
     */
    categorize(message) {
        const lower = message.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
        const words = new Set(lower.split(/\s+/).filter(w => w.length > 1));
        let best = 'general';
        let bestScore = 0;
        for (const [category, kws] of Object.entries(this.keywords)) {
            let score = 0;
            for (const kw of kws) {
                if (kw.includes(' ')) {
                    if (lower.includes(kw))
                        score += 2;
                }
                else {
                    if (words.has(kw))
                        score += 1;
                }
            }
            if (score > bestScore) {
                bestScore = score;
                best = category;
            }
        }
        return best;
    }
    // ── Routing ──
    /**
     * Route a message to the best agent.
     * Returns the agent, category, confidence, and full rankings.
     */
    route(message, category) {
        const cat = category ?? this.categorize(message);
        const rankings = this.agents.map(agent => {
            const rating = this.ratings[agent]?.[cat] ?? { mu: this.mu0, sigma: this.sigma0 };
            const score = rating.mu - 2 * rating.sigma;
            const confidence = Math.max(0, 1 - (rating.sigma / this.sigma0));
            return { agent, score, confidence };
        }).sort((a, b) => b.score - a.score);
        const best = rankings[0];
        return {
            agent: best.agent,
            category: cat,
            confidence: best.confidence,
            score: best.score,
            rankings,
        };
    }
    /**
     * Route with a minimum confidence threshold.
     * Returns null if no agent meets the threshold — useful for fallback logic.
     */
    routeWithThreshold(message, minConfidence) {
        const result = this.route(message);
        return result.confidence >= minConfidence ? result : null;
    }
    // ── Rating Updates (Bradley-Terry) ──
    /**
     * Record the outcome of a routing decision.
     * Updates the agent's rating for the given category.
     *
     * Uses a simplified Bradley-Terry model:
     *   beta = sigma / 2
     *   c = sqrt(2 * beta^2 + sigma^2)
     *   K = sigma^2 / c
     *   mu' = mu + K * (S - E)     where S = outcome score, E = expected
     *   sigma' = sigma * sqrt(1 - K/c)
     */
    recordOutcome(agent, category, outcome) {
        if (!this.ratings[agent]) {
            this.ratings[agent] = { _overall: { mu: this.mu0, sigma: this.sigma0 } };
        }
        if (!this.ratings[agent][category]) {
            this.ratings[agent][category] = { mu: this.mu0, sigma: this.sigma0 };
        }
        const update = (rating) => {
            const beta = rating.sigma / 2;
            const c = Math.sqrt(2 * beta * beta + rating.sigma * rating.sigma);
            const K = (rating.sigma * rating.sigma) / c;
            const S = outcome === 'win' ? 1 : outcome === 'loss' ? 0 : 0.5;
            const E = 0.5; // Expected score against average
            const newMu = rating.mu + K * (S - E);
            const newSigma = Math.max(this.minSigma, rating.sigma * Math.sqrt(Math.max(0.01, 1 - K / c)));
            return { mu: newMu, sigma: newSigma };
        };
        this.ratings[agent][category] = update(this.ratings[agent][category]);
        this.ratings[agent]['_overall'] = update(this.ratings[agent]['_overall']);
        this.dirty = true;
    }
    // ── Queries ──
    /** Get rating for a specific agent and category */
    getRating(agent, category) {
        return this.ratings[agent]?.[category] ?? null;
    }
    /** Get all ratings for an agent */
    getAgentRatings(agent) {
        return this.ratings[agent] ?? null;
    }
    /** Get top agents for a category */
    getTopAgents(category, limit = 3) {
        return this.route('', category).rankings.slice(0, limit);
    }
    /** Get the confidence that enough data exists for reliable routing */
    getSystemConfidence() {
        let totalConfidence = 0;
        let count = 0;
        for (const agent of this.agents) {
            for (const cat of this.categories) {
                const rating = this.ratings[agent]?.[cat];
                if (rating) {
                    totalConfidence += Math.max(0, 1 - (rating.sigma / this.sigma0));
                    count++;
                }
            }
        }
        return count > 0 ? totalConfidence / count : 0;
    }
    // ── Persistence ──
    /** Export ratings as JSON string */
    toJSON() {
        return JSON.stringify(this.ratings, null, 2);
    }
    /** Import ratings from JSON string */
    fromJSON(json) {
        const data = JSON.parse(json);
        // Merge with existing — don't lose agents/categories added after export
        for (const [agent, cats] of Object.entries(data)) {
            if (!this.ratings[agent])
                this.ratings[agent] = {};
            for (const [cat, rating] of Object.entries(cats)) {
                this.ratings[agent][cat] = rating;
            }
        }
    }
    /** Save ratings to a file */
    save(path) {
        const { writeFileSync, mkdirSync } = require('fs');
        const { dirname } = require('path');
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, this.toJSON());
        this.dirty = false;
    }
    /** Load ratings from a file */
    load(path) {
        const { readFileSync, existsSync } = require('fs');
        if (existsSync(path)) {
            this.fromJSON(readFileSync(path, 'utf-8'));
        }
    }
    /** Whether there are unsaved changes */
    isDirty() {
        return this.dirty;
    }
    // ── Utility ──
    /** Get a human-readable summary of the routing state */
    summary() {
        const lines = ['Skill Router Summary', '═'.repeat(40)];
        for (const cat of this.categories) {
            if (cat === 'general')
                continue;
            const top = this.getTopAgents(cat, 3);
            const topStr = top.map(t => `${t.agent} (${t.score.toFixed(1)}, ${(t.confidence * 100).toFixed(0)}%)`).join(', ');
            lines.push(`  ${cat}: ${topStr}`);
        }
        lines.push('');
        lines.push(`System confidence: ${(this.getSystemConfidence() * 100).toFixed(1)}%`);
        lines.push(`Agents: ${this.agents.length}`);
        lines.push(`Categories: ${this.categories.length}`);
        return lines.join('\n');
    }
}
// ── Convenience ────────────────────────────────────────────────────────
/**
 * Create a pre-configured router with common agent roles.
 * Ready to use out of the box — just start routing and recording outcomes.
 */
export function createDefaultRouter() {
    return new SkillRouter({
        agents: [
            'coder', 'researcher', 'writer', 'analyst', 'designer',
            'guardian', 'devops', 'data', 'general',
        ],
        // Uses all default categories and keywords
    });
}
//# sourceMappingURL=index.js.map