// kbot Synthesis Engine — Closed-Loop Intelligence Compounding
//
// The bridge between SELF-DISCOVERY (learning, reflections, skill ratings)
// and UNIVERSE-DISCOVERY (tools, agents, papers, opportunities, engagement).
//
// Eight synthesis operations:
//   1. consumeDiscoveredTools    — evaluate discovered tools against failure patterns
//   2. instantiateProposedAgents — trial proposed agents against skill gaps
//   3. extractPaperInsights      — pull implementable patterns from academic papers
//   4. buildActiveCorrections    — corrections + reflections → prompt injection
//   5. closeReflectionLoop       — reflections → skill rating adjustments
//   6. crossPollinatePatterns    — transfer patterns across projects
//   7. buildSkillMap             — Bayesian ratings → human-readable map
//   8. feedEngagementBack        — engagement outcomes → topic weights
//
// All operations are heuristic — no LLM calls. Fast and free.
// Storage: ~/.kbot/memory/synthesis-engine.json
//          ~/.kbot/memory/active-corrections.json
//          ~/.kbot/memory/skill-map.json
//          .kbot-discovery/topic-weights.json (if discovery exists)
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
// ══════════════════════════════════════════════════════════════════════
// Paths
// ══════════════════════════════════════════════════════════════════════
const MEMORY_DIR = join(homedir(), '.kbot', 'memory');
const STATE_FILE = join(MEMORY_DIR, 'synthesis-engine.json');
const CORRECTIONS_FILE = join(MEMORY_DIR, 'active-corrections.json');
const SKILL_MAP_FILE = join(MEMORY_DIR, 'skill-map.json');
// Learning stores
const PATTERNS_FILE = join(MEMORY_DIR, 'patterns.json');
const REFLECTIONS_FILE = join(MEMORY_DIR, 'reflections.json');
const SKILL_RATINGS_FILE = join(MEMORY_DIR, 'skill-ratings.json');
const CORRECTIONS_LEARNING_FILE = join(MEMORY_DIR, 'corrections.json');
const PROJECTS_FILE = join(MEMORY_DIR, 'projects.json');
const ROUTING_HISTORY_FILE = join(MEMORY_DIR, 'routing-history.json');
// ══════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════
function ensureDir(dir) {
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
}
function loadJSON(path, fallback) {
    if (!existsSync(path))
        return fallback;
    try {
        return JSON.parse(readFileSync(path, 'utf-8'));
    }
    catch {
        return fallback;
    }
}
function saveJSON(path, data) {
    ensureDir(join(path, '..'));
    writeFileSync(path, JSON.stringify(data, null, 2));
}
function loadState() {
    return loadJSON(STATE_FILE, {
        toolAdoptions: [],
        agentTrials: [],
        paperInsights: [],
        skillMap: [],
        topicWeights: [],
        crossPollinatedCount: 0,
        lastCycleAt: '',
        totalCycles: 0,
        stats: {
            toolsEvaluated: 0, toolsAdopted: 0, toolsRejected: 0,
            agentsTrialed: 0, agentsKept: 0, agentsDissolved: 0,
            papersAnalyzed: 0, patternsImplemented: 0,
            correctionsActive: 0, reflectionsClosed: 0,
            patternsTransferred: 0, engagementsFedBack: 0,
        },
    });
}
function saveState(state) {
    ensureDir(MEMORY_DIR);
    saveJSON(STATE_FILE, state);
}
/**
 * Evaluate discovered tools against failure patterns in reflections.
 * If a discovered tool solves a problem that caused repeated failures,
 * mark it for adoption. Otherwise, mark as evaluated and move on.
 */
export function consumeDiscoveredTools(discoveryDir) {
    const state = loadState();
    const outreachFile = join(discoveryDir, 'outreach', 'latest.json');
    if (!existsSync(outreachFile))
        return state.toolAdoptions;
    const outreach = loadJSON(outreachFile, { projects: [] });
    const projects = outreach.projects || [];
    if (projects.length === 0)
        return state.toolAdoptions;
    // Load reflections to find failure patterns
    const reflections = loadJSON(REFLECTIONS_FILE, []);
    // Extract failure keywords from reflections
    const failureKeywords = new Set();
    for (const r of reflections) {
        const words = (r.lesson + ' ' + r.taskMessage).toLowerCase()
            .replace(/[^a-z0-9\s-]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 3);
        for (const w of words)
            failureKeywords.add(w);
    }
    // Already evaluated tools (by URL)
    const evaluatedUrls = new Set(state.toolAdoptions.map(t => t.url));
    const newAdoptions = [];
    for (const project of projects) {
        if (evaluatedUrls.has(project.url))
            continue;
        // Score: how many failure keywords appear in the project description?
        const desc = project.description.toLowerCase();
        const descWords = desc.replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/);
        const matchCount = descWords.filter(w => failureKeywords.has(w)).length;
        const matchedWords = descWords.filter(w => failureKeywords.has(w));
        // Also check: does it solve a capability gap? (agent, tool, search, fetch, etc.)
        const capabilityTerms = ['agent', 'tool', 'cli', 'search', 'fetch', 'automation', 'mcp', 'plugin'];
        const capScore = capabilityTerms.filter(t => desc.includes(t)).length;
        const totalScore = matchCount + capScore;
        const adoption = {
            name: project.name,
            url: project.url,
            stars: project.stars,
            reason: totalScore >= 3
                ? `Matches ${matchCount} failure keywords [${matchedWords.slice(0, 3).join(', ')}] + ${capScore} capability terms`
                : totalScore >= 1
                    ? `Low relevance: ${matchCount} failure keywords, ${capScore} capability terms`
                    : 'No match to current failure patterns',
            status: totalScore >= 3 && project.stars >= 50 ? 'adopted' : 'rejected',
            matchedReflection: matchCount > 0 ? matchedWords.slice(0, 3).join(', ') : undefined,
            evaluatedAt: new Date().toISOString(),
        };
        newAdoptions.push(adoption);
    }
    // Merge and cap at 100
    state.toolAdoptions = [...state.toolAdoptions, ...newAdoptions].slice(-100);
    state.stats.toolsEvaluated += newAdoptions.length;
    state.stats.toolsAdopted += newAdoptions.filter(t => t.status === 'adopted').length;
    state.stats.toolsRejected += newAdoptions.filter(t => t.status === 'rejected').length;
    saveState(state);
    return newAdoptions;
}
/**
 * Evaluate proposed agents against Bayesian skill rating gaps.
 * If an agent targets a category with high sigma (uncertainty),
 * start a trial. After enough tasks, keep or dissolve.
 */
export function instantiateProposedAgents(discoveryDir) {
    const state = loadState();
    const agentsFile = join(discoveryDir, 'proposed-agents.json');
    // Also check outreach for proposed agents
    let proposed = [];
    if (existsSync(agentsFile)) {
        proposed = loadJSON(agentsFile, []);
    }
    if (proposed.length === 0)
        return state.agentTrials;
    // Load skill ratings to find gaps
    const ratings = loadJSON(SKILL_RATINGS_FILE, {});
    // Find categories with high sigma (uncertainty) across all agents
    const categories = ['coding', 'debugging', 'refactoring', 'research', 'analysis',
        'writing', 'devops', 'security', 'design', 'general', 'data', 'communication'];
    const categoryGaps = {}; // category → avg sigma
    for (const cat of categories) {
        let totalSigma = 0;
        let count = 0;
        for (const agentRatings of Object.values(ratings)) {
            if (agentRatings[cat]) {
                totalSigma += agentRatings[cat].sigma;
                count++;
            }
        }
        // If no agent has been tested in this category, sigma is max (8.33)
        categoryGaps[cat] = count > 0 ? totalSigma / count : 8.33;
    }
    // Already trialing agents (by name)
    const trialingNames = new Set(state.agentTrials.map(t => t.name));
    const newTrials = [];
    for (const agent of proposed) {
        if (trialingNames.has(agent.name))
            continue;
        // Find the best matching category for this agent
        const nameWords = agent.name.toLowerCase().split(/[\s-_]+/);
        const promptWords = (agent.systemPrompt || agent.reasoning || '').toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
        const allWords = [...nameWords, ...promptWords];
        let bestCategory = 'general';
        let bestScore = 0;
        for (const cat of categories) {
            const catWords = cat.split(/[\s-_]+/);
            const matches = catWords.filter(w => allWords.includes(w)).length;
            if (matches > bestScore) {
                bestScore = matches;
                bestCategory = cat;
            }
        }
        // Only trial if the target category has high uncertainty
        const gap = categoryGaps[bestCategory] || 8.33;
        if (gap < 4)
            continue; // Category already well-covered
        const trial = {
            name: agent.name,
            systemPrompt: (agent.systemPrompt || '').slice(0, 500),
            targetCategory: bestCategory,
            status: 'trialing',
            taskCount: 0,
            mu: 25,
            sigma: 8.33,
            createdAt: new Date().toISOString(),
        };
        newTrials.push(trial);
    }
    state.agentTrials = [...state.agentTrials, ...newTrials].slice(-50);
    state.stats.agentsTrialed += newTrials.length;
    saveState(state);
    return newTrials;
}
/**
 * Match academic paper techniques against existing tool patterns.
 * If a paper describes an optimization that maps to a known pattern,
 * propose it as an improvement.
 */
export function extractPaperInsights(discoveryDir) {
    const state = loadState();
    const outreachFile = join(discoveryDir, 'outreach', 'latest.json');
    if (!existsSync(outreachFile))
        return state.paperInsights;
    const outreach = loadJSON(outreachFile, {});
    const papers = [];
    if (outreach.latestPaper)
        papers.push(outreach.latestPaper);
    if (outreach.papers)
        papers.push(...outreach.papers);
    if (papers.length === 0)
        return state.paperInsights;
    const patterns = loadJSON(PATTERNS_FILE, []);
    // Extract technique keywords from papers
    const analyzedTitles = new Set(state.paperInsights.map(p => p.title));
    const newInsights = [];
    // Technique detection patterns
    const techniquePatterns = [
        { regex: /seek|search.*guided|tool.*guided/i, technique: 'Guided seeking instead of exhaustive parsing', applicableTo: 'read_file + grep patterns' },
        { regex: /retrieval.*augment|rag/i, technique: 'Retrieval-augmented generation', applicableTo: 'research and fact-checking patterns' },
        { regex: /plan.*then.*act|planning.*execution/i, technique: 'Plan-then-act decomposition', applicableTo: 'multi-step task patterns' },
        { regex: /self.*correct|self.*refin/i, technique: 'Self-correction loop', applicableTo: 'error-correction patterns' },
        { regex: /tool.*use|tool.*call|function.*call/i, technique: 'Improved tool selection', applicableTo: 'tool routing patterns' },
        { regex: /multi.*agent|agent.*collab/i, technique: 'Multi-agent collaboration', applicableTo: 'swarm and routing patterns' },
        { regex: /memory|context.*window|long.*context/i, technique: 'Memory optimization', applicableTo: 'context management patterns' },
        { regex: /benchmark|eval/i, technique: 'Evaluation methodology', applicableTo: 'self-eval and skill rating patterns' },
        { regex: /efficient|lightweight|compress/i, technique: 'Efficiency optimization', applicableTo: 'token reduction patterns' },
        { regex: /autonomous|self.*improv/i, technique: 'Autonomous improvement', applicableTo: 'evolution and autopoiesis patterns' },
    ];
    for (const paper of papers) {
        if (analyzedTitles.has(paper.title))
            continue;
        const text = `${paper.title} ${paper.summary || ''}`;
        for (const tp of techniquePatterns) {
            if (tp.regex.test(text)) {
                // Check if we have patterns in the applicable area
                const applicablePatterns = patterns.filter(p => tp.applicableTo.split(/\s+/).some(w => p.toolSequence.some(t => t.includes(w)) || p.intent.includes(w)));
                newInsights.push({
                    title: paper.title,
                    url: paper.url || '',
                    technique: tp.technique,
                    applicableTo: tp.applicableTo + (applicablePatterns.length > 0
                        ? ` (${applicablePatterns.length} matching patterns found)`
                        : ' (no matching patterns yet)'),
                    status: applicablePatterns.length > 0 ? 'proposed' : 'rejected',
                    extractedAt: new Date().toISOString(),
                });
                break; // One insight per paper
            }
        }
    }
    state.paperInsights = [...state.paperInsights, ...newInsights].slice(-100);
    state.stats.papersAnalyzed += newInsights.length;
    saveState(state);
    return newInsights;
}
// ══════════════════════════════════════════════════════════════════════
// 4. BUILD ACTIVE CORRECTIONS
// ══════════════════════════════════════════════════════════════════════
/**
 * Extract actionable corrections from:
 * - Explicit corrections in corrections.json
 * - Implicit corrections from reflection failure patterns
 * - Pattern failures (low success rate patterns)
 *
 * Produces active-corrections.json for prompt injection.
 */
export function buildActiveCorrections() {
    const state = loadState();
    const corrections = loadJSON(CORRECTIONS_LEARNING_FILE, []);
    const active = [];
    for (const c of corrections) {
        if (c.rule && c.occurrences >= 1) {
            active.push({
                rule: c.rule,
                source: 'explicit',
                severity: c.occurrences >= 3 ? 'high' : c.occurrences >= 2 ? 'medium' : 'low',
                occurrences: c.occurrences,
                extractedAt: new Date().toISOString(),
            });
        }
    }
    const reflections = loadJSON(REFLECTIONS_FILE, []);
    // Group reflection lessons by theme
    const lessonThemes = {};
    for (const r of reflections) {
        if (!r.lesson)
            continue;
        // Normalize: extract the core rule from the lesson
        const normalized = r.lesson.toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 100);
        lessonThemes[normalized] = (lessonThemes[normalized] || 0) + 1;
    }
    // Top recurring themes become corrections
    const sortedThemes = Object.entries(lessonThemes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    for (const [theme, count] of sortedThemes) {
        if (count >= 2) {
            active.push({
                rule: theme,
                source: 'reflection',
                severity: count >= 5 ? 'high' : count >= 3 ? 'medium' : 'low',
                occurrences: count,
                extractedAt: new Date().toISOString(),
            });
        }
    }
    const patterns = loadJSON(PATTERNS_FILE, []);
    const failingPatterns = patterns.filter(p => p.hits >= 3 && p.successRate < 0.5);
    for (const p of failingPatterns) {
        active.push({
            rule: `Tool sequence [${p.toolSequence.join(' → ')}] for "${p.intent}" fails ${Math.round((1 - p.successRate) * 100)}% of the time — consider alternative approach`,
            source: 'pattern_failure',
            severity: p.successRate < 0.3 ? 'high' : 'medium',
            occurrences: p.hits,
            extractedAt: new Date().toISOString(),
        });
    }
    // Sort by severity then occurrences, cap at 10
    const severityOrder = { high: 3, medium: 2, low: 1 };
    active.sort((a, b) => (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0)
        || b.occurrences - a.occurrences);
    const finalCorrections = active.slice(0, 10);
    // Save for prompt injection
    ensureDir(MEMORY_DIR);
    saveJSON(CORRECTIONS_FILE, finalCorrections);
    state.stats.correctionsActive = finalCorrections.length;
    saveState(state);
    return finalCorrections;
}
/**
 * Format active corrections for system prompt injection.
 * Called by agent.ts to append corrections to the system prompt.
 */
export function getActiveCorrectionsPrompt() {
    const corrections = loadJSON(CORRECTIONS_FILE, []);
    if (corrections.length === 0)
        return '';
    const lines = ['[Active Corrections — avoid repeating these mistakes]'];
    for (const c of corrections) {
        const icon = c.severity === 'high' ? '!!' : c.severity === 'medium' ? '!' : '-';
        lines.push(`${icon} ${c.rule} (${c.occurrences}x, from ${c.source})`);
    }
    return lines.join('\n');
}
// ══════════════════════════════════════════════════════════════════════
// 5. CLOSE REFLECTION → ROUTING LOOP
// ══════════════════════════════════════════════════════════════════════
/**
 * Analyze reflections to adjust skill ratings.
 * If an agent consistently fails at a task category,
 * downgrade its mu in that category.
 */
export function closeReflectionLoop() {
    const state = loadState();
    const reflections = loadJSON(REFLECTIONS_FILE, []);
    if (reflections.length === 0)
        return 0;
    const routingHistory = loadJSON(ROUTING_HISTORY_FILE, []);
    // Load current skill ratings
    const ratings = loadJSON(SKILL_RATINGS_FILE, {});
    let adjustments = 0;
    // For each reflection, find the responsible agent and category
    for (const r of reflections) {
        const taskWords = r.taskMessage.toLowerCase().split(/\s+/);
        // Find matching routing entry
        const matchingRoute = routingHistory.find(h => {
            const intentWords = h.intent.toLowerCase().split(/\s+/);
            const overlap = taskWords.filter(w => intentWords.includes(w)).length;
            return overlap >= Math.min(3, taskWords.length * 0.5);
        });
        if (!matchingRoute)
            continue;
        const agent = matchingRoute.agent;
        if (!agent || agent === 'auto')
            continue;
        // Detect category from task message
        const categoryKeywords = {
            coding: ['code', 'function', 'implement', 'build', 'component'],
            debugging: ['fix', 'bug', 'error', 'crash', 'debug'],
            security: ['security', 'vulnerability', 'exploit', 'auth', 'encrypt'],
            research: ['research', 'find', 'search', 'compare', 'investigate'],
            writing: ['write', 'document', 'explain', 'describe', 'draft'],
        };
        let detectedCategory = 'general';
        let bestCatScore = 0;
        for (const [cat, keywords] of Object.entries(categoryKeywords)) {
            const score = keywords.filter(k => taskWords.includes(k)).length;
            if (score > bestCatScore) {
                bestCatScore = score;
                detectedCategory = cat;
            }
        }
        // Adjust rating: penalize the agent in this category
        if (!ratings[agent])
            ratings[agent] = { _overall: { mu: 25, sigma: 8.33 } };
        if (!ratings[agent][detectedCategory]) {
            ratings[agent][detectedCategory] = { mu: 25, sigma: 8.33 };
        }
        const current = ratings[agent][detectedCategory];
        // Apply a small penalty (Bradley-Terry loss equivalent)
        const K = current.sigma * current.sigma / Math.sqrt(2 * (current.sigma / 2) ** 2 + current.sigma ** 2);
        current.mu = Math.max(15, current.mu - K * 0.5); // Half-strength penalty
        current.sigma = Math.max(0.5, current.sigma * 0.95); // Reduce uncertainty slightly
        adjustments++;
    }
    if (adjustments > 0) {
        saveJSON(SKILL_RATINGS_FILE, ratings);
        state.stats.reflectionsClosed += adjustments;
        saveState(state);
    }
    return adjustments;
}
/**
 * Transfer successful patterns from one project to another.
 * Patterns with high success rates in one project get added
 * to the global pool with reduced confidence.
 */
export function crossPollinatePatterns() {
    const state = loadState();
    const projects = loadJSON(PROJECTS_FILE, []);
    if (projects.length < 2)
        return 0;
    const patterns = loadJSON(PATTERNS_FILE, []);
    // Find patterns that are project-specific (high success, mention project files)
    const globalIntents = new Set(patterns.map(p => p.intent));
    let transferred = 0;
    // Look for patterns that use tools common across projects
    const universalTools = ['read_file', 'write_file', 'bash', 'grep', 'glob', 'edit_file'];
    const universalPatterns = patterns.filter(p => p.hits >= 3 &&
        p.successRate >= 0.7 &&
        p.toolSequence.every(t => universalTools.includes(t)) &&
        !p.origin);
    // For each universal pattern, check if a variant exists
    for (const p of universalPatterns) {
        // Create a generic version with reduced confidence
        const genericIntent = p.intent
            .replace(/\b(src|lib|app|packages|components)\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (genericIntent.length < 5)
            continue;
        if (globalIntents.has(genericIntent))
            continue;
        // Add as cross-pollinated pattern with lower confidence
        patterns.push({
            intent: genericIntent,
            keywords: p.keywords,
            toolSequence: p.toolSequence,
            hits: 1,
            successRate: p.successRate * 0.7, // 30% confidence reduction
            avgTokensSaved: p.avgTokensSaved,
            origin: 'cross-project',
        });
        globalIntents.add(genericIntent);
        transferred++;
        if (transferred >= 10)
            break; // Max 10 per cycle
    }
    if (transferred > 0) {
        saveJSON(PATTERNS_FILE, patterns);
        state.crossPollinatedCount += transferred;
        state.stats.patternsTransferred += transferred;
        saveState(state);
    }
    return transferred;
}
// ══════════════════════════════════════════════════════════════════════
// 7. BUILD SKILL MAP
// ══════════════════════════════════════════════════════════════════════
const INITIAL_MU = 25.0;
const INITIAL_SIGMA = INITIAL_MU / 3;
/**
 * Build a human-readable skill map from Bayesian ratings.
 * Classifies agents as proven (low σ), developing (medium σ), or untested (high σ).
 */
export function buildSkillMap() {
    const state = loadState();
    const ratings = loadJSON(SKILL_RATINGS_FILE, {});
    const map = [];
    for (const [agent, agentRatings] of Object.entries(ratings)) {
        const overall = agentRatings._overall || { mu: INITIAL_MU, sigma: INITIAL_SIGMA };
        // Classify status
        let status;
        if (overall.sigma <= 2)
            status = 'proven';
        else if (overall.sigma <= 5)
            status = 'developing';
        else
            status = 'untested';
        // Build category map (exclude _overall)
        const categories = {};
        for (const [cat, rating] of Object.entries(agentRatings)) {
            if (cat === '_overall')
                continue;
            categories[cat] = {
                mu: Math.round(rating.mu * 10) / 10,
                sigma: Math.round(rating.sigma * 10) / 10,
            };
        }
        // Confidence label
        const confidence = overall.sigma <= 1 ? 'very high'
            : overall.sigma <= 3 ? 'high'
                : overall.sigma <= 5 ? 'medium'
                    : overall.sigma <= 7 ? 'low'
                        : 'untested';
        map.push({
            agent,
            overall: {
                mu: Math.round(overall.mu * 10) / 10,
                sigma: Math.round(overall.sigma * 10) / 10,
                confidence,
            },
            categories,
            status,
        });
    }
    // Sort by overall mu descending
    map.sort((a, b) => b.overall.mu - a.overall.mu);
    state.skillMap = map;
    saveJSON(SKILL_MAP_FILE, map);
    saveState(state);
    return map;
}
/**
 * Format skill map for terminal display.
 */
export function formatSkillMap(map) {
    if (map.length === 0)
        return 'No skill data yet.';
    const lines = [
        '┌────────────────────────────────────────────────────────────┐',
        '│ AGENT SKILL MAP (Bayesian μ ± 2σ)                         │',
        '├──────────────────┬────────┬──────┬────────────┬───────────┤',
        '│ Agent            │   μ    │  σ   │ Confidence │  Status   │',
        '├──────────────────┼────────┼──────┼────────────┼───────────┤',
    ];
    let proven = 0;
    let developing = 0;
    let untested = 0;
    for (const entry of map) {
        const agentPad = entry.agent.padEnd(16).slice(0, 16);
        const muPad = entry.overall.mu.toFixed(1).padStart(6);
        const sigmaPad = entry.overall.sigma.toFixed(1).padStart(4);
        const confPad = entry.overall.confidence.padEnd(10).slice(0, 10);
        const statusIcon = entry.status === 'proven' ? '★' : entry.status === 'developing' ? '◆' : '○';
        const statusPad = `${statusIcon} ${entry.status}`.padEnd(9);
        lines.push(`│ ${agentPad} │ ${muPad} │ ${sigmaPad} │ ${confPad} │ ${statusPad} │`);
        if (entry.status === 'proven')
            proven++;
        else if (entry.status === 'developing')
            developing++;
        else
            untested++;
        // Show top category specializations
        const cats = Object.entries(entry.categories)
            .sort((a, b) => b[1].mu - a[1].mu)
            .slice(0, 2);
        if (cats.length > 0) {
            const catStr = cats.map(([c, r]) => `${c}:${r.mu.toFixed(1)}`).join(', ');
            lines.push(`│   └─ ${catStr.padEnd(50).slice(0, 50)} │`);
        }
    }
    lines.push('├──────────────────────────────────────────────────────────┤');
    lines.push(`│ ★ Proven: ${proven}  ◆ Developing: ${developing}  ○ Untested: ${untested}`.padEnd(59) + '│');
    lines.push('└────────────────────────────────────────────────────────────┘');
    return lines.join('\n');
}
/**
 * Analyze engagement outcomes from discovery actions
 * and produce topic weights for the next opportunity cycle.
 */
export function feedEngagementBack(discoveryDir) {
    const state = loadState();
    const postedFile = join(discoveryDir, 'actions', 'posted.json');
    if (!existsSync(postedFile))
        return state.topicWeights;
    const posted = loadJSON(postedFile, []);
    if (posted.length === 0)
        return state.topicWeights;
    // Count engagement by topic
    const topicEngagement = {};
    for (const entry of posted) {
        const topic = entry.topic || 'general';
        if (!topicEngagement[topic])
            topicEngagement[topic] = { engaged: 0, ignored: 0 };
        if (entry.engagement === 'engaged' || (entry.currentScore || 0) > (entry.scoreAtPost || 0)) {
            topicEngagement[topic].engaged++;
        }
        else {
            topicEngagement[topic].ignored++;
        }
    }
    // Calculate weights
    const weights = [];
    for (const [topic, stats] of Object.entries(topicEngagement)) {
        const total = stats.engaged + stats.ignored;
        const weight = total > 0 ? stats.engaged / total : 0.5;
        weights.push({
            topic,
            weight: Math.round(weight * 100) / 100,
            engaged: stats.engaged,
            ignored: stats.ignored,
            updatedAt: new Date().toISOString(),
        });
    }
    // Sort by weight descending
    weights.sort((a, b) => b.weight - a.weight);
    // Save for discovery daemon to consume
    const topicWeightsFile = join(discoveryDir, 'topic-weights.json');
    if (existsSync(discoveryDir)) {
        saveJSON(topicWeightsFile, weights);
    }
    state.topicWeights = weights;
    state.stats.engagementsFedBack += weights.length;
    saveState(state);
    return weights;
}
/**
 * Run the full synthesis cycle:
 * 1. Consume discovered tools
 * 2. Instantiate proposed agents
 * 3. Extract paper insights
 * 4. Build active corrections
 * 5. Close reflection loop
 * 6. Cross-pollinate patterns
 * 7. Build skill map
 * 8. Feed engagement back
 *
 * All operations are heuristic — no LLM calls.
 * Safe to call frequently — each operation is idempotent.
 */
export function synthesize(discoveryDir) {
    const state = loadState();
    state.totalCycles++;
    state.lastCycleAt = new Date().toISOString();
    saveState(state);
    // Auto-detect discovery dir
    const discDir = discoveryDir || join(process.cwd(), '.kbot-discovery');
    // Run all 8 operations
    const toolAdoptions = existsSync(discDir) ? consumeDiscoveredTools(discDir) : [];
    const agentTrials = existsSync(discDir) ? instantiateProposedAgents(discDir) : [];
    const paperInsights = existsSync(discDir) ? extractPaperInsights(discDir) : [];
    const activeCorrections = buildActiveCorrections();
    const reflectionsClosed = closeReflectionLoop();
    const patternsTransferred = crossPollinatePatterns();
    const skillMap = buildSkillMap();
    const topicWeights = existsSync(discDir) ? feedEngagementBack(discDir) : [];
    return {
        toolAdoptions,
        agentTrials,
        paperInsights,
        activeCorrections,
        reflectionsClosed,
        patternsTransferred,
        skillMap,
        topicWeights,
        cycleNumber: state.totalCycles,
    };
}
// ══════════════════════════════════════════════════════════════════════
// Stats & Display
// ══════════════════════════════════════════════════════════════════════
/**
 * Get synthesis engine stats for kbot status display.
 */
export function getSynthesisEngineStats() {
    const state = loadState();
    return {
        ...state.stats,
        totalCycles: state.totalCycles,
        lastCycleAt: state.lastCycleAt,
    };
}
/**
 * Format synthesis results for terminal display.
 */
export function formatSynthesisResult(result) {
    const lines = [
        '═══════════════════════════════════════════════════════════════',
        ` SYNTHESIS CYCLE #${result.cycleNumber}`,
        '═══════════════════════════════════════════════════════════════',
        '',
    ];
    // Tools
    if (result.toolAdoptions.length > 0) {
        lines.push(`## Discovered Tools (${result.toolAdoptions.length} evaluated)`);
        const adopted = result.toolAdoptions.filter(t => t.status === 'adopted');
        const rejected = result.toolAdoptions.filter(t => t.status === 'rejected');
        if (adopted.length > 0) {
            for (const t of adopted) {
                lines.push(`  + ADOPT: ${t.name} (${t.stars}★) — ${t.reason}`);
            }
        }
        if (rejected.length > 0) {
            lines.push(`  - Rejected: ${rejected.length} tools (no match to failure patterns)`);
        }
        lines.push('');
    }
    // Agents
    if (result.agentTrials.length > 0) {
        lines.push(`## Agent Trials (${result.agentTrials.length} started)`);
        for (const a of result.agentTrials) {
            lines.push(`  ◆ TRIAL: ${a.name} → ${a.targetCategory} (σ gap detected)`);
        }
        lines.push('');
    }
    // Papers
    if (result.paperInsights.length > 0) {
        lines.push(`## Paper Insights (${result.paperInsights.length} extracted)`);
        for (const p of result.paperInsights) {
            const icon = p.status === 'proposed' ? '→' : '×';
            lines.push(`  ${icon} "${p.technique}" from "${p.title.slice(0, 50)}..."`);
            lines.push(`    Applies to: ${p.applicableTo}`);
        }
        lines.push('');
    }
    // Corrections
    if (result.activeCorrections.length > 0) {
        lines.push(`## Active Corrections (${result.activeCorrections.length} injected into prompts)`);
        for (const c of result.activeCorrections.slice(0, 5)) {
            const icon = c.severity === 'high' ? '!!' : c.severity === 'medium' ? ' !' : ' -';
            lines.push(`  ${icon} ${c.rule.slice(0, 70)}...`);
        }
        lines.push('');
    }
    // Reflections
    if (result.reflectionsClosed > 0) {
        lines.push(`## Reflection → Routing: ${result.reflectionsClosed} skill ratings adjusted`);
        lines.push('');
    }
    // Cross-pollination
    if (result.patternsTransferred > 0) {
        lines.push(`## Cross-Pollination: ${result.patternsTransferred} patterns transferred across projects`);
        lines.push('');
    }
    // Skill Map
    lines.push('## Skill Map');
    lines.push(formatSkillMap(result.skillMap));
    lines.push('');
    // Topic Weights
    if (result.topicWeights.length > 0) {
        lines.push(`## Topic Weights (${result.topicWeights.length} topics scored)`);
        for (const tw of result.topicWeights.slice(0, 5)) {
            const bar = '█'.repeat(Math.round(tw.weight * 10)) + '░'.repeat(10 - Math.round(tw.weight * 10));
            lines.push(`  ${bar} ${tw.topic} (${tw.engaged} engaged / ${tw.ignored} ignored)`);
        }
        lines.push('');
    }
    lines.push('═══════════════════════════════════════════════════════════════');
    return lines.join('\n');
}
//# sourceMappingURL=synthesis-engine.js.map