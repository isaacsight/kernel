// kbot Bayesian Skill Rating — OpenSkill-style Agent Routing
//
// Each agent maintains a {mu, sigma} rating per task category.
// mu = estimated skill level, sigma = uncertainty.
// Ratings update after each routing outcome using a simplified
// Bradley-Terry model. Over time, agents with proven track records
// in specific categories get routed to preferentially.
//
// This sits between exact-intent match and keyword voting in the
// routing cascade (Level 1.5), providing probabilistic confidence
// that improves with every interaction.
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
// ── Constants ──
/** Default mu (mean skill estimate) — standard OpenSkill default */
const INITIAL_MU = 25.0;
/** Default sigma (uncertainty) — standard OpenSkill default: mu/3 */
const INITIAL_SIGMA = INITIAL_MU / 3; // ~8.333
/** Minimum sigma floor to prevent ratings from becoming completely rigid */
const MIN_SIGMA = 0.5;
/** Persistence path */
const RATINGS_DIR = join(homedir(), '.kbot', 'memory');
const RATINGS_FILE = join(RATINGS_DIR, 'skill-ratings.json');
// ── Category keyword maps for fast classification ──
const CATEGORY_KEYWORDS = {
    coding: [
        'code', 'function', 'implement', 'build', 'create', 'component', 'module',
        'class', 'interface', 'type', 'typescript', 'javascript', 'python', 'rust',
        'react', 'node', 'api', 'endpoint', 'route', 'hook', 'scaffold', 'generate',
        'import', 'export', 'async', 'package', 'npm', 'install',
    ],
    debugging: [
        'fix', 'bug', 'error', 'crash', 'debug', 'broken', 'fail', 'issue',
        'exception', 'stack', 'trace', 'undefined', 'null', 'hang', 'freeze',
        'memory', 'leak', 'infinite', 'loop', 'regression', 'broken',
    ],
    refactoring: [
        'refactor', 'clean', 'reorganize', 'restructure', 'simplify', 'extract',
        'rename', 'move', 'split', 'merge', 'consolidate', 'deduplicate',
        'optimize', 'improve', 'modernize',
    ],
    research: [
        'research', 'find', 'compare', 'benchmark', 'search', 'alternative',
        'documentation', 'docs', 'article', 'paper', 'study', 'investigate',
        'explore', 'discover', 'learn', 'understand', 'explain', 'difference',
        'versus', 'pros', 'cons', 'tradeoff', 'best practice',
    ],
    analysis: [
        'analyze', 'strategy', 'plan', 'architecture', 'review', 'audit',
        'evaluate', 'assess', 'performance', 'cost', 'pricing', 'metric',
        'dashboard', 'report', 'insight', 'decision', 'priority', 'roadmap',
    ],
    writing: [
        'write', 'draft', 'blog', 'email', 'document', 'readme', 'changelog',
        'announcement', 'copy', 'content', 'marketing', 'social', 'tweet',
        'newsletter', 'story', 'essay', 'summary', 'summarize', 'proofread',
        'edit', 'article', 'post',
    ],
    devops: [
        'deploy', 'ship', 'release', 'publish', 'ci', 'cd', 'pipeline',
        'docker', 'kubernetes', 'container', 'server', 'host', 'cloud',
        'aws', 'gcp', 'azure', 'infrastructure', 'terraform', 'nginx',
        'monitor', 'log', 'uptime',
    ],
    security: [
        'security', 'vulnerability', 'exploit', 'attack', 'auth', 'permission',
        'encrypt', 'decrypt', 'token', 'secret', 'credential', 'ssl', 'tls',
        'certificate', 'firewall', 'audit', 'scan', 'penetration', 'xss',
        'csrf', 'injection', 'sanitize',
    ],
    design: [
        'design', 'ui', 'ux', 'layout', 'color', 'font', 'typography',
        'responsive', 'mobile', 'animation', 'css', 'style', 'theme',
        'palette', 'icon', 'illustration', 'wireframe', 'mockup', 'figma',
        'accessibility', 'a11y',
    ],
    data: [
        'data', 'database', 'sql', 'query', 'table', 'schema', 'migration',
        'csv', 'json', 'parse', 'transform', 'aggregate', 'statistics',
        'chart', 'graph', 'visualization', 'analytics', 'etl', 'pipeline',
    ],
    communication: [
        'email', 'message', 'notify', 'announce', 'broadcast', 'communicate',
        'present', 'pitch', 'propose', 'negotiate', 'feedback', 'slack',
        'discord', 'webhook',
    ],
    general: [
        'help', 'hello', 'hey', 'hi', 'thanks', 'what', 'how', 'why',
        'general', 'chat', 'talk', 'opinion', 'think', 'advice',
    ],
};
// ── All known agent IDs ──
const ALL_AGENTS = [
    'kernel', 'researcher', 'coder', 'writer', 'analyst',
    'aesthete', 'guardian', 'curator', 'strategist',
    'infrastructure', 'quant', 'investigator', 'oracle',
    'chronist', 'sage', 'communicator', 'adapter',
    'creative', 'developer',
];
// ── Core ──
function ensureDir() {
    if (!existsSync(RATINGS_DIR))
        mkdirSync(RATINGS_DIR, { recursive: true });
}
function defaultRating() {
    return { mu: INITIAL_MU, sigma: INITIAL_SIGMA };
}
function initializeRatings() {
    const ratings = {};
    for (const agent of ALL_AGENTS) {
        ratings[agent] = { _overall: defaultRating() };
    }
    return ratings;
}
export class SkillRatingSystem {
    ratings;
    dirty = false;
    constructor() {
        this.ratings = this.loadSync();
    }
    // ── Persistence ──
    loadSync() {
        ensureDir();
        try {
            if (existsSync(RATINGS_FILE)) {
                const data = JSON.parse(readFileSync(RATINGS_FILE, 'utf-8'));
                // Ensure all known agents exist (in case new agents were added)
                for (const agent of ALL_AGENTS) {
                    if (!data[agent]) {
                        data[agent] = { _overall: defaultRating() };
                    }
                }
                return data;
            }
        }
        catch { /* corrupted file — reinitialize */ }
        return initializeRatings();
    }
    async save() {
        if (!this.dirty)
            return;
        ensureDir();
        try {
            writeFileSync(RATINGS_FILE, JSON.stringify(this.ratings, null, 2));
            this.dirty = false;
        }
        catch { /* non-critical */ }
    }
    async load() {
        this.ratings = this.loadSync();
    }
    // ── Category Classification ──
    /**
     * Classify a message into a task category using keyword matching.
     * Fast, no LLM call needed.
     */
    categorizeMessage(message) {
        const lower = message.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
        const words = lower.split(/\s+/).filter(w => w.length > 1);
        const wordSet = new Set(words);
        let bestCategory = 'general';
        let bestScore = 0;
        for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
            let score = 0;
            for (const kw of keywords) {
                if (kw.includes(' ')) {
                    // Multi-word keyword — check substring
                    if (lower.includes(kw))
                        score += 2;
                }
                else {
                    if (wordSet.has(kw))
                        score += 1;
                }
            }
            if (score > bestScore) {
                bestScore = score;
                bestCategory = category;
            }
        }
        return bestCategory;
    }
    // ── Rating Queries ──
    /**
     * Get a rating for a specific agent and category.
     * Returns the category-specific rating if it exists, otherwise the overall rating.
     */
    getRating(agent, category) {
        const agentRatings = this.ratings[agent];
        if (!agentRatings)
            return defaultRating();
        return agentRatings[category] || agentRatings._overall || defaultRating();
    }
    /**
     * Conservative rating estimate: mu - 2*sigma
     * This is the lower bound of the ~95% confidence interval.
     * Agents need to both be good AND have enough data to rank highly.
     */
    conservativeEstimate(rating) {
        return rating.mu - 2 * rating.sigma;
    }
    /**
     * Get agents ranked by conservative estimate for a given category.
     */
    getRankedAgents(category) {
        const ranked = [];
        for (const agent of ALL_AGENTS) {
            const rating = this.getRating(agent, category);
            // Confidence: how much uncertainty has been reduced from the initial state
            // 0 = no data (sigma === INITIAL_SIGMA), 1 = fully certain (sigma === MIN_SIGMA)
            const confidence = 1 - (rating.sigma / INITIAL_SIGMA);
            ranked.push({ agent, rating, confidence: Math.max(0, confidence) });
        }
        // Sort by conservative estimate (mu - 2*sigma), descending
        ranked.sort((a, b) => this.conservativeEstimate(b.rating) - this.conservativeEstimate(a.rating));
        return ranked;
    }
    // ── Rating Updates (Bradley-Terry) ──
    /**
     * Update an agent's rating based on an outcome.
     *
     * Uses a simplified Bradley-Terry model:
     *   beta = sigma / 2  (dynamics factor)
     *   c = sqrt(2 * beta^2 + sigma^2)  (normalization factor)
     *   K = sigma^2 / c  (update magnitude — bigger when uncertain)
     *   mu_new = mu + K * outcome_factor
     *   sigma_new = sigma * sqrt(max(1 - sigma^2/c^2, epsilon))
     *
     * outcome_factor: win = +1, loss = -1, draw = 0
     */
    recordOutcome(agent, category, outcome) {
        // Ensure agent entry exists
        if (!this.ratings[agent]) {
            this.ratings[agent] = { _overall: defaultRating() };
        }
        // Ensure category entry exists
        if (!this.ratings[agent][category]) {
            this.ratings[agent][category] = defaultRating();
        }
        // Update category-specific rating
        this.updateRating(this.ratings[agent][category], outcome);
        // Also update overall rating (with dampened effect)
        if (!this.ratings[agent]._overall) {
            this.ratings[agent]._overall = defaultRating();
        }
        this.updateRating(this.ratings[agent]._overall, outcome, 0.5);
        this.dirty = true;
    }
    /**
     * Core Bradley-Terry update step.
     * @param rating The rating to mutate in place
     * @param outcome The match outcome
     * @param dampen Dampen the update (0-1), 1 = full update
     */
    updateRating(rating, outcome, dampen = 1.0) {
        const outcomeFactor = outcome === 'win' ? 1 : outcome === 'loss' ? -1 : 0;
        if (outcomeFactor === 0) {
            // Draw: only reduce sigma slightly (we still learned something)
            rating.sigma = Math.max(MIN_SIGMA, rating.sigma * 0.995);
            return;
        }
        const beta = rating.sigma / 2;
        const cSquared = 2 * beta * beta + rating.sigma * rating.sigma;
        const c = Math.sqrt(cSquared);
        // K factor — update magnitude, proportional to uncertainty
        const K = (rating.sigma * rating.sigma) / c;
        // Update mu
        rating.mu += K * outcomeFactor * dampen;
        // Reduce sigma — we're more certain after observing an outcome
        // sigma_new = sigma * sqrt(1 - sigma^2/c^2)
        const sigmaFactor = 1 - (rating.sigma * rating.sigma) / cSquared;
        rating.sigma = Math.max(MIN_SIGMA, rating.sigma * Math.sqrt(Math.max(sigmaFactor, 0.01)));
    }
    // ── High-Level Routing ──
    /**
     * Get the best agent for a task based on Bayesian skill ratings.
     *
     * Returns null if all agents still have high uncertainty (not enough data).
     * The confidence threshold ensures we only route when we have meaningful signal.
     */
    getAgentForTask(message) {
        const category = this.categorizeMessage(message);
        const ranked = this.getRankedAgents(category);
        if (ranked.length === 0)
            return null;
        const top = ranked[0];
        // Only route if confidence > 0.3 (sigma has decreased meaningfully)
        if (top.confidence <= 0.3)
            return null;
        // Also check that the top agent is meaningfully better than the second
        // (avoid routing when all agents are effectively tied)
        if (ranked.length > 1) {
            const topEst = this.conservativeEstimate(top.rating);
            const secondEst = this.conservativeEstimate(ranked[1].rating);
            // Require at least 1.0 point gap for meaningful differentiation
            if (topEst - secondEst < 1.0)
                return null;
        }
        return {
            agent: top.agent,
            confidence: top.confidence,
            category,
        };
    }
    // ── Stats ──
    /**
     * Get summary stats for each agent: their top category and confidence level.
     */
    getStats() {
        const stats = {};
        for (const agent of ALL_AGENTS) {
            const agentRatings = this.ratings[agent];
            if (!agentRatings)
                continue;
            let bestCategory = 'general';
            let bestMu = INITIAL_MU;
            let bestSigma = INITIAL_SIGMA;
            for (const [cat, rating] of Object.entries(agentRatings)) {
                if (cat === '_overall')
                    continue;
                const r = rating;
                if (r.mu > bestMu || (r.mu === bestMu && r.sigma < bestSigma)) {
                    bestMu = r.mu;
                    bestSigma = r.sigma;
                    bestCategory = cat;
                }
            }
            const confidence = 1 - (bestSigma / INITIAL_SIGMA);
            stats[agent] = {
                topCategory: bestCategory,
                confidence: Math.max(0, confidence),
            };
        }
        return stats;
    }
    /**
     * Get raw ratings for an agent (for debugging/display).
     */
    getAgentRatings(agent) {
        return this.ratings[agent] || null;
    }
}
// ── Singleton ──
let _instance = null;
export function getSkillRatingSystem() {
    if (!_instance) {
        _instance = new SkillRatingSystem();
    }
    return _instance;
}
//# sourceMappingURL=skill-rating.js.map