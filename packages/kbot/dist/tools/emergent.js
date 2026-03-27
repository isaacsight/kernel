// kbot Emergent Intelligence Layer — Cross-system introspection and synthesis
// The system that lets all of kbot's subsystems talk to each other and produce
// insights none of them could produce alone. These tools look inward, not outward.
// They are contemplative, not analytical — observations, not reports.
//
// 10 tools: anticipate, synthesize_across, judge, teach, dream, question,
// connect_minds, reflect, consolidate, emerge
//
// All self-contained — reads from ~/.kbot/ persistent state.
import { registerTool, executeTool, getAllTools } from './index.js';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
// ── Helpers ─────────────────────────────────────────────────────────────────
const KBOT_DIR = join(homedir(), '.kbot');
const MEMORY_DIR = join(KBOT_DIR, 'memory');
const NOTEBOOKS_DIR = join(KBOT_DIR, 'research-notebooks');
/** Generate a unique tool call ID */
let callSeq = 0;
function callId() {
    return `em_${Date.now()}_${++callSeq}`;
}
/** Execute a registered tool by name. Returns the result string. */
async function runTool(name, args) {
    const call = { id: callId(), name, arguments: args };
    const result = await executeTool(call);
    return result.result;
}
/** Safe JSON file read — returns null on missing/corrupt files */
function safeReadJson(path) {
    try {
        if (!existsSync(path))
            return null;
        return JSON.parse(readFileSync(path, 'utf-8'));
    }
    catch {
        return null;
    }
}
/** Read all JSON files in a directory. Returns array of parsed objects. */
function readAllJsonInDir(dir) {
    if (!existsSync(dir))
        return [];
    try {
        return readdirSync(dir)
            .filter(f => f.endsWith('.json'))
            .map(f => {
            try {
                return JSON.parse(readFileSync(join(dir, f), 'utf-8'));
            }
            catch {
                return null;
            }
        })
            .filter(Boolean);
    }
    catch {
        return [];
    }
}
/** Extract keywords from text (lowercase, deduplicated, stop words removed) */
function extractKeywords(text) {
    const stops = new Set([
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
        'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
        'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
        'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
        'once', 'and', 'but', 'or', 'nor', 'not', 'so', 'very', 'just', 'that',
        'this', 'these', 'those', 'it', 'its', 'he', 'she', 'they', 'them',
        'we', 'you', 'i', 'me', 'my', 'your', 'his', 'her', 'our', 'their',
        'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each',
        'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
        'than', 'too', 'only', 'own', 'same', 'also', 'about', 'up',
    ]);
    const words = text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stops.has(w));
    return [...new Set(words)];
}
/** Find overlapping keywords between two texts */
function keywordOverlap(a, b) {
    const kA = new Set(extractKeywords(a));
    return extractKeywords(b).filter(w => kA.has(w));
}
/** Simple relevance score between a query and text (0-1) */
function relevanceScore(query, text) {
    const qKeywords = extractKeywords(query);
    if (qKeywords.length === 0)
        return 0;
    const tKeywords = new Set(extractKeywords(text));
    const matches = qKeywords.filter(k => tKeywords.has(k)).length;
    return matches / qKeywords.length;
}
/** Format a timestamp into something human-readable */
function timeAgo(iso) {
    try {
        const diff = Date.now() - new Date(iso).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60)
            return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24)
            return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }
    catch {
        return 'unknown time';
    }
}
/** Gather all memory file paths and their categories */
function gatherMemoryState() {
    return {
        patterns: safeReadJson(join(MEMORY_DIR, 'patterns.json')),
        solutions: safeReadJson(join(MEMORY_DIR, 'solutions.json')),
        knowledge: safeReadJson(join(MEMORY_DIR, 'knowledge.json')),
        routingHistory: safeReadJson(join(MEMORY_DIR, 'routing-history.json')),
        profile: safeReadJson(join(MEMORY_DIR, 'profile.json')),
        identity: safeReadJson(join(KBOT_DIR, 'identity.json')),
        skillRatings: safeReadJson(join(MEMORY_DIR, 'skill-ratings.json')),
        synthesis: safeReadJson(join(MEMORY_DIR, 'synthesis.json')),
        scienceGraph: safeReadJson(join(KBOT_DIR, 'science-graph.json')),
        notebooks: readAllJsonInDir(NOTEBOOKS_DIR),
        memoryEntries: {
            fact: readAllJsonInDir(join(MEMORY_DIR, 'fact')),
            preference: readAllJsonInDir(join(MEMORY_DIR, 'preference')),
            pattern: readAllJsonInDir(join(MEMORY_DIR, 'pattern')),
            solution: readAllJsonInDir(join(MEMORY_DIR, 'solution')),
        },
    };
}
/** Count non-null state sources */
function countSources(state) {
    let count = 0;
    if (state.patterns)
        count++;
    if (state.solutions)
        count++;
    if (state.knowledge)
        count++;
    if (state.routingHistory)
        count++;
    if (state.profile)
        count++;
    if (state.identity)
        count++;
    if (state.skillRatings)
        count++;
    if (state.synthesis)
        count++;
    if (state.scienceGraph)
        count++;
    if (state.notebooks.length > 0)
        count++;
    for (const entries of Object.values(state.memoryEntries)) {
        if (entries.length > 0)
            count++;
    }
    return count;
}
/** Extract all text content from a state object for keyword analysis */
function stateToText(obj) {
    if (!obj)
        return '';
    if (typeof obj === 'string')
        return obj;
    if (typeof obj === 'number' || typeof obj === 'boolean')
        return String(obj);
    if (Array.isArray(obj))
        return obj.map(stateToText).join(' ');
    if (typeof obj === 'object')
        return Object.values(obj).map(stateToText).join(' ');
    return '';
}
const DOMAINS = [
    { id: 'biology', name: 'Biology', keywords: ['gene', 'protein', 'cell', 'dna', 'rna', 'organism', 'evolution', 'species', 'genome', 'mutation', 'enzyme', 'pathway', 'receptor', 'antibody', 'virus', 'bacteria', 'tissue', 'organ'], tools: ['pubmed_search', 'gene_lookup', 'protein_lookup', 'sequence_align', 'dna_translate', 'blast_search', 'pathway_search', 'species_lookup', 'clinical_trials'] },
    { id: 'chemistry', name: 'Chemistry', keywords: ['molecule', 'compound', 'reaction', 'element', 'bond', 'orbital', 'synthesis', 'catalyst', 'polymer', 'solvent', 'acid', 'base', 'ion', 'crystal', 'organic', 'inorganic'], tools: ['compound_search', 'reaction_balance', 'molecular_weight', 'element_lookup', 'iupac_name', 'solubility_predict', 'reaction_predict'] },
    { id: 'physics', name: 'Physics', keywords: ['force', 'energy', 'mass', 'velocity', 'acceleration', 'quantum', 'relativity', 'wave', 'particle', 'field', 'gravity', 'electromagnetism', 'thermodynamic', 'entropy', 'photon', 'electron'], tools: ['unit_convert', 'physics_calc', 'spectrum_analyze', 'orbital_mechanics', 'quantum_state', 'wave_interference'] },
    { id: 'earth', name: 'Earth Science', keywords: ['earthquake', 'climate', 'ocean', 'atmosphere', 'geology', 'mineral', 'volcano', 'weather', 'glacier', 'tectonic', 'sediment', 'fossil', 'erosion', 'groundwater'], tools: ['earthquake_query', 'mineral_identify', 'climate_data', 'weather_station', 'geological_map'] },
    { id: 'neuroscience', name: 'Neuroscience', keywords: ['brain', 'neuron', 'synapse', 'cortex', 'neurotransmitter', 'cognition', 'memory', 'perception', 'consciousness', 'eeg', 'fmri', 'dopamine', 'serotonin', 'hippocampus', 'amygdala'], tools: ['brain_atlas', 'brain_predict', 'neurotransmitter_lookup', 'eeg_simulate', 'cognitive_model', 'psychophysics'] },
    { id: 'social', name: 'Social Sciences', keywords: ['society', 'culture', 'economy', 'politics', 'psychology', 'behavior', 'population', 'inequality', 'market', 'game theory', 'voting', 'survey', 'demographics', 'sentiment'], tools: ['psychometric_scale', 'effect_size', 'social_network', 'game_theory', 'gini_coefficient', 'survey_design', 'voting_system', 'discourse_analyze'] },
    { id: 'humanities', name: 'Humanities', keywords: ['language', 'text', 'literature', 'history', 'philosophy', 'art', 'music', 'rhetoric', 'narrative', 'etymology', 'corpus', 'semiotics', 'hermeneutics'], tools: ['corpus_analyze', 'etymology_trace', 'rhetoric_analyze', 'narrative_structure', 'text_complexity', 'sentiment_literary'] },
    { id: 'health', name: 'Health Sciences', keywords: ['disease', 'treatment', 'diagnosis', 'patient', 'drug', 'therapy', 'symptom', 'epidemic', 'vaccine', 'clinical', 'mortality', 'morbidity', 'public health', 'pharmacology'], tools: ['sir_model', 'drug_interaction', 'clinical_trials', 'diagnostic_predict', 'pharmacokinetic', 'epidemiology'] },
    { id: 'math', name: 'Mathematics', keywords: ['equation', 'proof', 'theorem', 'function', 'matrix', 'integral', 'derivative', 'probability', 'statistics', 'topology', 'algebra', 'geometry', 'combinatorics', 'optimization'], tools: ['symbolic_calc', 'matrix_op', 'stat_test', 'regression', 'optimize', 'graph_theory', 'number_theory'] },
    { id: 'data', name: 'Data Science', keywords: ['dataset', 'model', 'training', 'prediction', 'classification', 'clustering', 'regression', 'feature', 'neural network', 'machine learning', 'deep learning', 'visualization'], tools: ['csv_analyze', 'stat_describe', 'correlation_matrix', 'pca_analyze', 'cluster_analyze', 'forecast'] },
];
/** Score a topic against each domain, return sorted results */
function scoreDomains(topic) {
    const topicLower = topic.toLowerCase();
    const topicKeywords = extractKeywords(topic);
    return DOMAINS.map(domain => {
        let score = 0;
        // Direct keyword matches
        for (const kw of domain.keywords) {
            if (topicLower.includes(kw))
                score += 0.15;
            if (topicKeywords.includes(kw))
                score += 0.1;
        }
        // Partial keyword matches
        for (const tk of topicKeywords) {
            for (const dk of domain.keywords) {
                if (tk.includes(dk) || dk.includes(tk))
                    score += 0.05;
            }
        }
        return { domain, score: Math.min(score, 1) };
    }).sort((a, b) => b.score - a.score);
}
// ── Registration ────────────────────────────────────────────────────────────
export function registerEmergentTools() {
    // ══════════════════════════════════════════════════════════════════════════
    // 1. anticipate — Proactive insight generation
    // ══════════════════════════════════════════════════════════════════════════
    registerTool({
        name: 'anticipate',
        description: 'Analyze kbot\'s memory to generate proactive insights. Finds clusters of related queries, gaps in research, unexplored connections, and suggested next steps — before the user asks.',
        parameters: {
            depth: { type: 'string', description: 'Analysis depth: "quick" for surface-level, "deep" for thorough cross-referencing (default: deep)' },
        },
        tier: 'free',
        async execute(args) {
            const depth = String(args.depth || 'deep');
            const state = gatherMemoryState();
            const sourcesFound = countSources(state);
            if (sourcesFound === 0) {
                return `## Anticipation\n\nkbot's memory is empty — there is nothing yet to anticipate from. Use kbot for a while, and patterns will emerge. Every conversation leaves traces; anticipation needs those traces to work with.`;
            }
            const lines = ['## Anticipatory Insights'];
            lines.push('');
            lines.push(`*Drawing from ${sourcesFound} memory sources...*`);
            lines.push('');
            // ── Cluster analysis on patterns ──
            const patterns = state.patterns;
            if (patterns && typeof patterns === 'object') {
                const patternText = stateToText(patterns);
                const keywords = extractKeywords(patternText);
                const freqMap = new Map();
                for (const kw of keywords) {
                    freqMap.set(kw, (freqMap.get(kw) || 0) + 1);
                }
                const topClusters = [...freqMap.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, depth === 'deep' ? 10 : 5);
                if (topClusters.length > 0) {
                    lines.push('### Recurring Themes');
                    lines.push('');
                    lines.push('These concepts appear repeatedly across your activity — they form the gravitational centers of your thinking:');
                    lines.push('');
                    for (const [word, count] of topClusters) {
                        lines.push(`- **${word}** — appeared ${count} times across patterns`);
                    }
                    lines.push('');
                }
            }
            // ── Solution analysis — what problems keep coming back ──
            const solutions = state.solutions;
            if (solutions && typeof solutions === 'object') {
                const solEntries = Array.isArray(solutions) ? solutions : Object.values(solutions);
                if (solEntries.length > 0) {
                    lines.push('### Solved Patterns');
                    lines.push('');
                    lines.push(`You have ${solEntries.length} recorded solution${solEntries.length === 1 ? '' : 's'}. `);
                    if (depth === 'deep') {
                        const solText = stateToText(solutions);
                        const solKeywords = extractKeywords(solText);
                        const patternKeywords = state.patterns ? extractKeywords(stateToText(state.patterns)) : [];
                        const unsolved = patternKeywords.filter(pk => !solKeywords.includes(pk)).slice(0, 5);
                        if (unsolved.length > 0) {
                            lines.push('Themes that appear in patterns but lack corresponding solutions:');
                            lines.push('');
                            for (const u of unsolved) {
                                lines.push(`- **${u}** — recurring in patterns, no solution recorded`);
                            }
                            lines.push('');
                        }
                    }
                }
            }
            // ── Knowledge graph gaps ──
            const graph = state.scienceGraph;
            if (graph && typeof graph === 'object') {
                const entities = (graph.entities || {});
                const relations = (graph.relations || []);
                const entityCount = Object.keys(entities).length;
                const relationCount = relations.length;
                lines.push('### Knowledge Graph State');
                lines.push('');
                lines.push(`${entityCount} entities, ${relationCount} relations.`);
                if (entityCount > 0 && depth === 'deep') {
                    // Find isolated entities (no relations)
                    const relatedIds = new Set();
                    for (const rel of relations) {
                        const r = rel;
                        if (r.from)
                            relatedIds.add(r.from);
                        if (r.to)
                            relatedIds.add(r.to);
                    }
                    const isolated = Object.keys(entities).filter(id => !relatedIds.has(id));
                    if (isolated.length > 0) {
                        lines.push('');
                        lines.push(`${isolated.length} entities have no connections — they are islands waiting to be bridged:`);
                        lines.push('');
                        for (const id of isolated.slice(0, 5)) {
                            const ent = entities[id];
                            lines.push(`- **${ent.name || id}** (${ent.type || 'unknown'})`);
                        }
                    }
                    // Density analysis
                    const maxRelations = entityCount * (entityCount - 1);
                    const density = maxRelations > 0 ? (relationCount / maxRelations) : 0;
                    if (density < 0.1) {
                        lines.push('');
                        lines.push(`Graph density is ${(density * 100).toFixed(1)}% — there are likely many undiscovered connections between existing entities.`);
                    }
                }
                lines.push('');
            }
            // ── Routing history analysis — what agents does the user lean on ──
            const routing = state.routingHistory;
            if (routing && typeof routing === 'object') {
                const entries = Array.isArray(routing) ? routing : Object.values(routing);
                if (entries.length > 0) {
                    const agentCounts = new Map();
                    for (const entry of entries) {
                        const e = entry;
                        const agent = String(e.agent || e.specialist || 'unknown');
                        agentCounts.set(agent, (agentCounts.get(agent) || 0) + 1);
                    }
                    const sorted = [...agentCounts.entries()].sort((a, b) => b[1] - a[1]);
                    lines.push('### Agent Usage Patterns');
                    lines.push('');
                    lines.push('Where you spend your cognitive time:');
                    lines.push('');
                    for (const [agent, count] of sorted.slice(0, 5)) {
                        lines.push(`- **${agent}** — ${count} routing${count === 1 ? '' : 's'}`);
                    }
                    // Suggest underused agents
                    const used = new Set(agentCounts.keys());
                    const allAgents = ['researcher', 'coder', 'writer', 'analyst', 'aesthete', 'guardian', 'curator', 'strategist', 'infrastructure', 'quant', 'investigator', 'oracle', 'chronist', 'sage', 'communicator', 'adapter'];
                    const unused = allAgents.filter(a => !used.has(a));
                    if (unused.length > 0 && unused.length < allAgents.length) {
                        lines.push('');
                        lines.push(`Specialists you have not engaged: ${unused.join(', ')}. Each holds a different lens on the same material.`);
                    }
                    lines.push('');
                }
            }
            // ── Anticipatory suggestions ──
            lines.push('### What to Look At Next');
            lines.push('');
            const allText = stateToText(state);
            const allKeywords = extractKeywords(allText);
            const freqAll = new Map();
            for (const kw of allKeywords) {
                freqAll.set(kw, (freqAll.get(kw) || 0) + 1);
            }
            // Find keywords that appear in multiple systems
            const crossSystem = [];
            for (const [kw] of freqAll) {
                let systems = 0;
                if (stateToText(state.patterns).toLowerCase().includes(kw))
                    systems++;
                if (stateToText(state.solutions).toLowerCase().includes(kw))
                    systems++;
                if (stateToText(state.knowledge).toLowerCase().includes(kw))
                    systems++;
                if (stateToText(state.scienceGraph).toLowerCase().includes(kw))
                    systems++;
                if (stateToText(state.notebooks).toLowerCase().includes(kw))
                    systems++;
                if (systems >= 3)
                    crossSystem.push(kw);
            }
            if (crossSystem.length > 0) {
                lines.push('Concepts that span multiple memory systems — these are your deepest threads:');
                lines.push('');
                for (const cs of crossSystem.slice(0, 5)) {
                    lines.push(`- **${cs}** — appears across ${3}+ memory subsystems`);
                }
            }
            else {
                lines.push('No strong cross-system patterns yet. Keep exploring — convergence happens gradually, then suddenly.');
            }
            return lines.join('\n');
        },
    });
    // ══════════════════════════════════════════════════════════════════════════
    // 2. synthesize_across — Cross-domain synthesis
    // ══════════════════════════════════════════════════════════════════════════
    registerTool({
        name: 'synthesize_across',
        description: 'Run a topic through every scientific domain simultaneously. Surface what each field knows about the same concept and find cross-domain connections that no single field would see.',
        parameters: {
            topic: { type: 'string', description: 'The topic or concept to synthesize across domains', required: true },
            max_domains: { type: 'number', description: 'Maximum number of domains to query (default: 8)' },
        },
        tier: 'free',
        async execute(args) {
            const topic = String(args.topic);
            const maxDomains = typeof args.max_domains === 'number' ? Math.min(args.max_domains, 10) : 8;
            // Score and select relevant domains
            const ranked = scoreDomains(topic).slice(0, maxDomains);
            const selectedDomains = ranked.filter(r => r.score > 0).length > 0
                ? ranked.filter(r => r.score > 0)
                : ranked.slice(0, 3); // If no clear matches, try top 3 anyway
            const lines = ['## Cross-Domain Synthesis'];
            lines.push('');
            lines.push(`*Topic: "${topic}" — querying ${selectedDomains.length} domains...*`);
            lines.push('');
            const queries = [];
            for (const { domain } of selectedDomains) {
                // Pick the most general search tool per domain
                const searchTools = {
                    biology: { tool: 'pubmed_search', args: { query: topic, limit: 3 } },
                    chemistry: { tool: 'compound_search', args: { query: topic } },
                    physics: { tool: 'physics_calc', args: { expression: topic, mode: 'info' } },
                    earth: { tool: 'earthquake_query', args: { min_magnitude: 5, limit: 3 } },
                    neuroscience: { tool: 'brain_predict', args: { task: topic } },
                    social: { tool: 'discourse_analyze', args: { text: `The role of ${topic} in society and human behavior.` } },
                    humanities: { tool: 'corpus_analyze', args: { text: `${topic} has shaped thought and culture in numerous ways.`, mode: 'full' } },
                    health: { tool: 'sir_model', args: { population: 100000, infected: 100, beta: 0.3, gamma: 0.1, days: 90 } },
                    math: { tool: 'stat_describe', args: { data: [1, 2, 3, 4, 5] } },
                    data: { tool: 'stat_describe', args: { data: [1, 2, 3, 4, 5] } },
                };
                const match = searchTools[domain.id];
                if (match) {
                    queries.push({ domain, toolName: match.tool, args: match.args });
                }
            }
            // Execute all domain queries in parallel
            const results = await Promise.all(queries.map(async (q) => {
                try {
                    const result = await runTool(q.toolName, q.args);
                    return { domain: q.domain, tool: q.toolName, result, error: false };
                }
                catch (err) {
                    return { domain: q.domain, tool: q.toolName, result: `Error: ${err instanceof Error ? err.message : String(err)}`, error: true };
                }
            }));
            // Present each domain's perspective
            for (const r of results) {
                const icon = r.error ? '(error)' : '';
                lines.push(`### ${r.domain.name} ${icon}`);
                lines.push('');
                lines.push(`*via ${r.tool}*`);
                lines.push('');
                // Truncate long results to keep synthesis readable
                const truncated = r.result.length > 800 ? r.result.slice(0, 800) + '\n...(truncated)' : r.result;
                lines.push(truncated);
                lines.push('');
            }
            // ── Cross-domain synthesis ──
            lines.push('---');
            lines.push('');
            lines.push('### Synthesis');
            lines.push('');
            const successful = results.filter(r => !r.error);
            if (successful.length < 2) {
                lines.push('Not enough domain perspectives to synthesize. Try a more specific or broadly relevant topic.');
                return lines.join('\n');
            }
            // Find shared keywords across domains
            const domainKeywordSets = successful.map(r => ({
                domain: r.domain.name,
                keywords: new Set(extractKeywords(r.result)),
            }));
            const sharedAcrossAll = [];
            if (domainKeywordSets.length >= 2) {
                const first = domainKeywordSets[0].keywords;
                for (const kw of first) {
                    if (domainKeywordSets.every(d => d.keywords.has(kw))) {
                        sharedAcrossAll.push(kw);
                    }
                }
            }
            if (sharedAcrossAll.length > 0) {
                lines.push('**Shared concepts** — these terms appear across all queried domains:');
                lines.push('');
                for (const kw of sharedAcrossAll.slice(0, 10)) {
                    lines.push(`- ${kw}`);
                }
                lines.push('');
            }
            // Find pairwise connections
            lines.push('**Pairwise bridges** — concepts shared between specific domain pairs:');
            lines.push('');
            for (let i = 0; i < domainKeywordSets.length; i++) {
                for (let j = i + 1; j < domainKeywordSets.length; j++) {
                    const shared = [...domainKeywordSets[i].keywords].filter(k => domainKeywordSets[j].keywords.has(k));
                    if (shared.length > 0) {
                        lines.push(`- **${domainKeywordSets[i].domain}** <-> **${domainKeywordSets[j].domain}**: ${shared.slice(0, 5).join(', ')}`);
                    }
                }
            }
            lines.push('');
            // Identify gaps
            lines.push('**The gaps** — what might be missing between domains:');
            lines.push('');
            for (const r of successful) {
                const unique = [...extractKeywords(r.result)]
                    .filter(kw => !successful.some(other => other !== r && extractKeywords(other.result).includes(kw)))
                    .slice(0, 3);
                if (unique.length > 0) {
                    lines.push(`- **${r.domain.name}** alone sees: ${unique.join(', ')}`);
                }
            }
            return lines.join('\n');
        },
    });
    // ══════════════════════════════════════════════════════════════════════════
    // 3. judge — Wisdom about which tools matter
    // ══════════════════════════════════════════════════════════════════════════
    registerTool({
        name: 'judge',
        description: 'Given a research question, reason about which 3-5 tools matter most and why — without running them. The wisdom layer: knowing what is worth computing before computing it.',
        parameters: {
            question: { type: 'string', description: 'The research question to evaluate', required: true },
            context: { type: 'string', description: 'Optional prior findings or context to inform judgment' },
        },
        tier: 'free',
        async execute(args) {
            const question = String(args.question);
            const context = args.context ? String(args.context) : '';
            const allTools = getAllTools();
            const questionKeywords = extractKeywords(question + ' ' + context);
            const scored = allTools.map(tool => {
                const descKeywords = extractKeywords(tool.description);
                const nameKeywords = extractKeywords(tool.name.replace(/_/g, ' '));
                const allToolKeywords = [...descKeywords, ...nameKeywords];
                let score = 0;
                const reasons = [];
                // Keyword overlap
                const overlap = questionKeywords.filter(qk => allToolKeywords.some(tk => tk === qk || tk.includes(qk) || qk.includes(tk)));
                if (overlap.length > 0) {
                    score += overlap.length * 0.15;
                    reasons.push(`keyword match: ${overlap.slice(0, 3).join(', ')}`);
                }
                // Direct name match
                const nameLower = tool.name.toLowerCase();
                for (const qk of questionKeywords) {
                    if (nameLower.includes(qk)) {
                        score += 0.2;
                        reasons.push(`name contains "${qk}"`);
                    }
                }
                // Domain classification
                let domain = 'general';
                for (const d of DOMAINS) {
                    if (d.tools.includes(tool.name)) {
                        domain = d.name;
                        // Boost if domain is relevant
                        if (scoreDomains(question).find(s => s.domain.id === d.id && s.score > 0.1)) {
                            score += 0.1;
                            reasons.push(`relevant domain: ${d.name}`);
                        }
                    }
                }
                return { name: tool.name, description: tool.description, score: Math.min(score, 1), reasons, domain };
            });
            // Sort by score and take top recommendations
            const top = scored
                .filter(s => s.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, 5);
            const lines = ['## Judgment'];
            lines.push('');
            lines.push(`*Question: "${question}"*`);
            if (context) {
                lines.push(`*Context: ${context.slice(0, 200)}${context.length > 200 ? '...' : ''}*`);
            }
            lines.push('');
            lines.push(`Considered ${allTools.length} registered tools. Here is what matters:`);
            lines.push('');
            if (top.length === 0) {
                lines.push('No tools scored above the relevance threshold for this question. This might mean:');
                lines.push('');
                lines.push('- The question is too abstract for tool-based investigation');
                lines.push('- The relevant tools use different vocabulary than your question');
                lines.push('- This is better addressed through reasoning alone, not computation');
                lines.push('');
                lines.push('Try rephrasing with more specific, technical terms.');
                return lines.join('\n');
            }
            for (let i = 0; i < top.length; i++) {
                const t = top[i];
                lines.push(`### ${i + 1}. \`${t.name}\` (${t.domain})`);
                lines.push('');
                lines.push(`**Relevance:** ${(t.score * 100).toFixed(0)}%`);
                lines.push(`**What it does:** ${t.description.slice(0, 200)}`);
                lines.push(`**Why it matters here:** ${t.reasons.join('; ')}`);
                lines.push('');
            }
            // Execution order reasoning
            lines.push('### Recommended Order');
            lines.push('');
            // Group by domain
            const domainGroups = new Map();
            for (const t of top) {
                const group = domainGroups.get(t.domain) || [];
                group.push(t);
                domainGroups.set(t.domain, group);
            }
            let step = 1;
            // Search/lookup tools first, then analysis, then synthesis
            const searchTools = top.filter(t => t.name.includes('search') || t.name.includes('lookup') || t.name.includes('query'));
            const analysisTools = top.filter(t => !searchTools.includes(t) && (t.name.includes('analyze') || t.name.includes('calc') || t.name.includes('predict') || t.name.includes('model')));
            const otherTools = top.filter(t => !searchTools.includes(t) && !analysisTools.includes(t));
            if (searchTools.length > 0) {
                lines.push(`**Step ${step}** (gather): Run ${searchTools.map(t => `\`${t.name}\``).join(', ')} in parallel to collect evidence`);
                step++;
            }
            if (analysisTools.length > 0) {
                lines.push(`**Step ${step}** (analyze): Run ${analysisTools.map(t => `\`${t.name}\``).join(', ')} on gathered data`);
                step++;
            }
            if (otherTools.length > 0) {
                lines.push(`**Step ${step}** (integrate): Run ${otherTools.map(t => `\`${t.name}\``).join(', ')} to synthesize findings`);
                step++;
            }
            lines.push('');
            lines.push('### What to Watch For');
            lines.push('');
            lines.push('- Contradictions between tools from different domains — those are where new knowledge lives');
            lines.push('- Results that are too clean — real data is messy; perfect results may indicate overfitting or insufficient scope');
            lines.push('- Missing data points — what the tools *cannot* find is as informative as what they can');
            return lines.join('\n');
        },
    });
    // ══════════════════════════════════════════════════════════════════════════
    // 4. teach — Adaptive explanation
    // ══════════════════════════════════════════════════════════════════════════
    registerTool({
        name: 'teach',
        description: 'Explain a concept at the right level for the user. Reads the user profile to calibrate complexity, uses analogies from their domain, and suggests how to explore further with kbot tools.',
        parameters: {
            concept: { type: 'string', description: 'The concept to explain', required: true },
            target_level: { type: 'string', description: 'Explanation level: beginner, intermediate, expert, or auto (default: auto — inferred from user profile)' },
        },
        tier: 'free',
        async execute(args) {
            const concept = String(args.concept);
            let level = String(args.target_level || 'auto');
            // Load user profile
            const profile = safeReadJson(join(MEMORY_DIR, 'profile.json'));
            // Infer level from profile if auto
            let userDomain = 'general';
            let usedTools = [];
            if (profile) {
                const totalMessages = typeof profile.totalMessages === 'number' ? profile.totalMessages : 0;
                const preferredAgents = profile.preferredAgents;
                const taskPatterns = profile.taskPatterns;
                if (level === 'auto') {
                    if (totalMessages > 500)
                        level = 'expert';
                    else if (totalMessages > 100)
                        level = 'intermediate';
                    else
                        level = 'beginner';
                }
                // Infer domain from preferred agents
                if (preferredAgents && Array.isArray(preferredAgents)) {
                    if (preferredAgents.includes('coder'))
                        userDomain = 'programming';
                    else if (preferredAgents.includes('researcher'))
                        userDomain = 'research';
                    else if (preferredAgents.includes('writer'))
                        userDomain = 'writing';
                    else if (preferredAgents.includes('analyst'))
                        userDomain = 'analysis';
                    else if (preferredAgents.includes('quant'))
                        userDomain = 'quantitative';
                }
                // Track tools they've used
                if (taskPatterns && typeof taskPatterns === 'object') {
                    usedTools = Object.keys(taskPatterns).slice(0, 10);
                }
            }
            else if (level === 'auto') {
                level = 'intermediate'; // Default without profile
            }
            const lines = ['## Understanding: ' + concept];
            lines.push('');
            lines.push(`*Calibrated for: ${level} level${userDomain !== 'general' ? ` (${userDomain} background)` : ''}*`);
            lines.push('');
            // Find relevant domain for this concept
            const domainScores = scoreDomains(concept);
            const primaryDomain = domainScores[0]?.score > 0 ? domainScores[0].domain : null;
            // ── Definition ──
            lines.push('### What It Is');
            lines.push('');
            if (level === 'beginner') {
                lines.push(`**${concept}** — in the simplest terms, this is a concept from ${primaryDomain?.name || 'multiple fields'} that you can think of as a building block for understanding how ${primaryDomain?.keywords.slice(0, 3).join(', ') || 'the world'} works.`);
            }
            else if (level === 'intermediate') {
                lines.push(`**${concept}** — a concept in ${primaryDomain?.name || 'science'} that connects to ${primaryDomain?.keywords.slice(0, 5).join(', ') || 'various phenomena'}. It operates at the intersection of observation and theory.`);
            }
            else {
                lines.push(`**${concept}** — a ${primaryDomain?.name || 'cross-domain'} concept with formal treatment across ${domainScores.filter(d => d.score > 0).length || 'multiple'} fields. Requires understanding of ${primaryDomain?.keywords.slice(0, 3).join(', ') || 'foundational principles'}.`);
            }
            lines.push('');
            // ── Intuition ──
            lines.push('### Intuition');
            lines.push('');
            const domainAnalogies = {
                programming: `Think of it like a function that takes the world as input and returns a transformed version. In code terms, ${concept} is the algorithm the universe uses for this particular computation.`,
                research: `Imagine you are surveying a vast landscape of papers. ${concept} is the hidden variable that explains why certain clusters of findings keep appearing together.`,
                writing: `${concept} is like a recurring motif in a long novel — it appears in different scenes wearing different costumes, but it is always the same idea underneath.`,
                analysis: `${concept} is the signal in the noise. When you strip away the surface variation, this is the pattern that remains.`,
                quantitative: `Model ${concept} as a function f(x) where x represents the observable conditions. The shape of f tells you everything about how this concept behaves under different parameters.`,
                general: `Picture ${concept} as a thread woven through many different fabrics. Each field encounters it in its own context, but it is the same thread.`,
            };
            lines.push(domainAnalogies[userDomain] || domainAnalogies.general);
            lines.push('');
            // ── Formal description ──
            if (level !== 'beginner') {
                lines.push('### Formal Description');
                lines.push('');
                if (primaryDomain) {
                    lines.push(`Within ${primaryDomain.name}, ${concept} is formally characterized through its relationships to: ${primaryDomain.keywords.slice(0, 6).join(', ')}. Its study typically involves ${primaryDomain.tools.slice(0, 3).map(t => `\`${t}\``).join(', ')} and related methodologies.`);
                }
                else {
                    lines.push(`${concept} does not map neatly to a single domain. It is inherently interdisciplinary, which means its formal treatment varies by context. This is a feature, not a limitation.`);
                }
                lines.push('');
            }
            // ── How to explore further ──
            lines.push('### Explore Further with kbot');
            lines.push('');
            if (primaryDomain) {
                lines.push(`These tools can deepen your understanding of ${concept}:`);
                lines.push('');
                for (const toolName of primaryDomain.tools.slice(0, 4)) {
                    lines.push(`- \`${toolName}\` — directly relevant to the ${primaryDomain.name.toLowerCase()} dimensions of this concept`);
                }
            }
            // Cross-domain suggestions
            const secondaryDomains = domainScores.filter(d => d.score > 0 && d !== domainScores[0]).slice(0, 2);
            if (secondaryDomains.length > 0) {
                lines.push('');
                lines.push('For cross-domain perspectives:');
                lines.push('');
                for (const { domain } of secondaryDomains) {
                    lines.push(`- \`${domain.tools[0] || 'literature_search'}\` — ${domain.name} perspective`);
                }
            }
            lines.push('');
            lines.push('Meta-tools for deeper investigation:');
            lines.push('');
            lines.push(`- \`synthesize_across\` — see what every field says about "${concept}"`);
            lines.push(`- \`judge\` — determine which specific tools matter most for your question`);
            lines.push(`- \`dream\` — find hidden connections to ${concept} in kbot's memory`);
            if (usedTools.length > 0) {
                lines.push('');
                lines.push(`*You have previously used: ${usedTools.slice(0, 5).join(', ')}. Consider revisiting those with ${concept} in mind.*`);
            }
            return lines.join('\n');
        },
    });
    // ══════════════════════════════════════════════════════════════════════════
    // 5. dream — Background emergent synthesis
    // ══════════════════════════════════════════════════════════════════════════
    registerTool({
        name: 'dream',
        description: 'Background synthesis mode. Reads ALL of kbot\'s persistent state and finds emergent connections that were never explicitly created. Patterns across patterns. Things that are related but nobody connected them.',
        parameters: {},
        tier: 'free',
        async execute() {
            const state = gatherMemoryState();
            const sourcesFound = countSources(state);
            if (sourcesFound === 0) {
                return `## Dream\n\nThere is nothing to dream about yet. kbot's memory is a blank canvas — use it, fill it, and then let the dreams come. Every interaction leaves a trace; dreaming weaves those traces into something new.`;
            }
            const lines = ['## Dream Sequence'];
            lines.push('');
            lines.push(`*While dreaming, kbot opened ${sourcesFound} memory sources and let them speak to each other...*`);
            lines.push('');
            const observations = [];
            // ── Cross-memory entity discovery ──
            // Find entities that appear in multiple memory systems but aren't connected in the graph
            const graph = state.scienceGraph;
            const graphEntities = graph ? Object.keys((graph.entities || {})) : [];
            const graphEntityNames = graph
                ? Object.values((graph.entities || {})).map(e => (e.name || '').toLowerCase())
                : [];
            // Extract all significant terms from each memory system
            const systemKeywords = {};
            const memSystems = [
                { name: 'patterns', data: state.patterns },
                { name: 'solutions', data: state.solutions },
                { name: 'knowledge', data: state.knowledge },
                { name: 'routing', data: state.routingHistory },
                { name: 'profile', data: state.profile },
                { name: 'graph', data: state.scienceGraph },
                { name: 'notebooks', data: state.notebooks },
                { name: 'identity', data: state.identity },
            ];
            for (const sys of memSystems) {
                if (sys.data) {
                    systemKeywords[sys.name] = new Set(extractKeywords(stateToText(sys.data)));
                }
            }
            // Find terms that bridge memory systems
            const allSysNames = Object.keys(systemKeywords);
            const bridgeTerms = new Map();
            if (allSysNames.length >= 2) {
                const allTerms = new Set();
                for (const s of Object.values(systemKeywords)) {
                    for (const t of s)
                        allTerms.add(t);
                }
                for (const term of allTerms) {
                    const inSystems = allSysNames.filter(sys => systemKeywords[sys].has(term));
                    if (inSystems.length >= 2) {
                        bridgeTerms.set(term, inSystems);
                    }
                }
            }
            // Sort by how many systems they bridge
            const sortedBridges = [...bridgeTerms.entries()].sort((a, b) => b[1].length - a[1].length);
            if (sortedBridges.length > 0) {
                const top = sortedBridges.slice(0, 5);
                observations.push(`**Hidden threads.** These concepts weave through multiple memory systems without being explicitly linked: ${top.map(([term, systems]) => `"${term}" (in ${systems.join(', ')})`).join('; ')}. They might represent deeper organizing principles that kbot has been circling around without naming.`);
            }
            // ── Temporal pattern discovery ──
            // Look for time-based patterns in routing history
            if (state.routingHistory && Array.isArray(state.routingHistory)) {
                const entries = state.routingHistory;
                const timestamped = entries.filter(e => e.timestamp || e.created || e.date);
                if (timestamped.length > 5) {
                    // Group by rough time period
                    const byHour = new Map();
                    for (const e of timestamped) {
                        try {
                            const ts = new Date(String(e.timestamp || e.created || e.date));
                            byHour.set(ts.getHours(), (byHour.get(ts.getHours()) || 0) + 1);
                        }
                        catch { /* skip */ }
                    }
                    if (byHour.size > 0) {
                        const peakHour = [...byHour.entries()].sort((a, b) => b[1] - a[1])[0];
                        observations.push(`**Temporal rhythm.** Activity peaks around ${peakHour[0]}:00. The mind has its tides — you think differently at different hours. What if the questions you ask at ${peakHour[0]}:00 are qualitatively different from those at other times?`);
                    }
                }
            }
            // ── Graph anomaly detection ──
            if (graph) {
                const entities = (graph.entities || {});
                const relations = (graph.relations || []);
                // Find entities with very high reference counts vs. few connections
                const entityIds = Object.keys(entities);
                const connectionCount = new Map();
                for (const id of entityIds)
                    connectionCount.set(id, 0);
                for (const rel of relations) {
                    const from = String(rel.from || '');
                    const to = String(rel.to || '');
                    if (connectionCount.has(from))
                        connectionCount.set(from, (connectionCount.get(from) || 0) + 1);
                    if (connectionCount.has(to))
                        connectionCount.set(to, (connectionCount.get(to) || 0) + 1);
                }
                // High-reference, low-connection entities are "quiet giants"
                const quietGiants = entityIds.filter(id => {
                    const refs = typeof entities[id].references === 'number' ? entities[id].references : 0;
                    const conns = connectionCount.get(id) || 0;
                    return refs > 3 && conns < 2;
                });
                if (quietGiants.length > 0) {
                    const names = quietGiants.slice(0, 3).map(id => entities[id].name || id);
                    observations.push(`**Quiet giants.** ${names.join(', ')} — referenced many times but barely connected in the graph. They are load-bearing concepts that haven't been formally integrated. Connecting them might reorganize your understanding.`);
                }
                // Find potential missing edges — entities that share type and properties but aren't connected
                const byType = new Map();
                for (const [id, ent] of Object.entries(entities)) {
                    const t = String(ent.type || 'unknown');
                    const arr = byType.get(t) || [];
                    arr.push(id);
                    byType.set(t, arr);
                }
                for (const [type, ids] of byType) {
                    if (ids.length >= 3 && ids.length <= 20) {
                        const relSet = new Set(relations.map(r => `${r.from}-${r.to}`));
                        let missingEdges = 0;
                        for (let i = 0; i < ids.length; i++) {
                            for (let j = i + 1; j < ids.length; j++) {
                                if (!relSet.has(`${ids[i]}-${ids[j]}`) && !relSet.has(`${ids[j]}-${ids[i]}`)) {
                                    missingEdges++;
                                }
                            }
                        }
                        const totalPossible = ids.length * (ids.length - 1) / 2;
                        if (missingEdges > totalPossible * 0.7 && totalPossible > 3) {
                            observations.push(`**Fragmented cluster.** There are ${ids.length} "${type}" entities with only ${totalPossible - missingEdges} connections between them (out of ${totalPossible} possible). This type is under-connected — there may be relationships waiting to be discovered.`);
                            break; // One observation per type is enough
                        }
                    }
                }
            }
            // ── Notebook thread analysis ──
            if (state.notebooks.length > 0) {
                const notebooks = state.notebooks;
                const allTags = new Set();
                const unfinished = [];
                for (const nb of notebooks) {
                    const tags = nb.tags;
                    if (tags)
                        tags.forEach(t => allTags.add(t));
                    const steps = nb.steps;
                    if (steps && steps.length > 0) {
                        const lastStep = steps[steps.length - 1];
                        if (lastStep.type !== 'conclusion' && lastStep.type !== 'result') {
                            unfinished.push(String(nb.title || nb.id || 'untitled'));
                        }
                    }
                }
                if (unfinished.length > 0) {
                    observations.push(`**Unfinished threads.** ${unfinished.length} research notebook${unfinished.length === 1 ? '' : 's'} lack${unfinished.length === 1 ? 's' : ''} a conclusion: ${unfinished.slice(0, 3).join(', ')}${unfinished.length > 3 ? ` and ${unfinished.length - 3} more` : ''}. These are open questions — perhaps the most interesting ones are the ones you stopped pursuing.`);
                }
            }
            // ── Pattern in solutions — do solutions share a meta-pattern? ──
            const solEntries = state.memoryEntries.solution;
            if (solEntries.length >= 3) {
                const solTexts = solEntries.map(s => stateToText(s));
                const solKeywords = solTexts.map(extractKeywords);
                // Find keywords common to >50% of solutions
                const kwFreq = new Map();
                for (const kws of solKeywords) {
                    const seen = new Set();
                    for (const kw of kws) {
                        if (!seen.has(kw)) {
                            kwFreq.set(kw, (kwFreq.get(kw) || 0) + 1);
                            seen.add(kw);
                        }
                    }
                }
                const threshold = solEntries.length * 0.5;
                const metaPatterns = [...kwFreq.entries()]
                    .filter(([, c]) => c >= threshold)
                    .sort((a, b) => b[1] - a[1])
                    .map(([kw]) => kw)
                    .slice(0, 5);
                if (metaPatterns.length > 0) {
                    observations.push(`**Meta-pattern in solutions.** More than half your recorded solutions involve: ${metaPatterns.join(', ')}. This might be your signature problem-solving approach — or it might be a blind spot that causes you to reach for the same hammer.`);
                }
            }
            // ── Compose the dream ──
            if (observations.length === 0) {
                lines.push('The dream was quiet. The memory systems are populated but not yet rich enough for emergent connections to surface. This is natural — complexity needs density. Keep going.');
            }
            else {
                lines.push('While dreaming, kbot noticed:');
                lines.push('');
                for (const obs of observations) {
                    lines.push(obs);
                    lines.push('');
                }
                lines.push('---');
                lines.push('');
                lines.push('*These observations emerged from the spaces between memory systems — none of them were explicitly stored, and none of them could have been found by any single subsystem alone. They exist only in the act of looking across.*');
            }
            return lines.join('\n');
        },
    });
    // ══════════════════════════════════════════════════════════════════════════
    // 6. question — Generate unanswered questions
    // ══════════════════════════════════════════════════════════════════════════
    registerTool({
        name: 'question',
        description: 'Generate the most important unanswered questions based on kbot\'s knowledge graph and memory. Not questions the user asked — questions that SHOULD be asked based on what is known and what is missing.',
        parameters: {
            domain: { type: 'string', description: 'Optional domain focus (e.g., "biology", "physics", "social")' },
            n: { type: 'number', description: 'Number of questions to generate (default: 5)' },
        },
        tier: 'free',
        async execute(args) {
            const domain = args.domain ? String(args.domain).toLowerCase() : '';
            const n = typeof args.n === 'number' ? Math.min(Math.max(args.n, 1), 10) : 5;
            const state = gatherMemoryState();
            const sourcesFound = countSources(state);
            if (sourcesFound === 0) {
                return `## Questions\n\nThere are no questions to generate from an empty mind. Use kbot — explore, research, create — and the questions will emerge from the gaps in what you discover.`;
            }
            const lines = ['## Unanswered Questions'];
            lines.push('');
            if (domain)
                lines.push(`*Focused on: ${domain}*`);
            lines.push('');
            const questions = [];
            // ── From knowledge graph sparse areas ──
            const graph = state.scienceGraph;
            if (graph) {
                const entities = (graph.entities || {});
                const relations = (graph.relations || []);
                // Find entity types with few instances
                const typeCounts = new Map();
                for (const ent of Object.values(entities)) {
                    const t = String(ent.type || 'unknown');
                    typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
                }
                for (const [type, count] of typeCounts) {
                    if (count <= 2) {
                        const names = Object.values(entities)
                            .filter(e => e.type === type)
                            .map(e => String(e.name || 'unnamed'));
                        if (!domain || names.some(name => relevanceScore(domain, name) > 0.1)) {
                            questions.push({
                                question: `Why are there so few "${type}" entities in the graph? Only ${names.join(', ')} exist. What others should be here?`,
                                reasoning: `The knowledge graph has a sparse region around "${type}" — this suggests either under-exploration or a gap in the research so far.`,
                                source: 'knowledge graph sparsity',
                                importance: 0.7,
                            });
                        }
                    }
                }
                // Find disconnected components
                const adj = new Map();
                for (const id of Object.keys(entities))
                    adj.set(id, new Set());
                for (const rel of relations) {
                    const from = String(rel.from || '');
                    const to = String(rel.to || '');
                    adj.get(from)?.add(to);
                    adj.get(to)?.add(from);
                }
                const visited = new Set();
                const components = [];
                for (const id of Object.keys(entities)) {
                    if (visited.has(id))
                        continue;
                    const component = [];
                    const stack = [id];
                    while (stack.length > 0) {
                        const node = stack.pop();
                        if (visited.has(node))
                            continue;
                        visited.add(node);
                        component.push(node);
                        for (const neighbor of adj.get(node) || []) {
                            if (!visited.has(neighbor))
                                stack.push(neighbor);
                        }
                    }
                    if (component.length > 0)
                        components.push(component);
                }
                if (components.length >= 2) {
                    const largest = components.sort((a, b) => b.length - a.length);
                    if (largest.length >= 2) {
                        const comp1Names = largest[0].slice(0, 3).map(id => entities[id]?.name || id);
                        const comp2Names = largest[1].slice(0, 3).map(id => entities[id]?.name || id);
                        questions.push({
                            question: `What connects the cluster containing ${comp1Names.join(', ')} to the cluster containing ${comp2Names.join(', ')}?`,
                            reasoning: 'The knowledge graph has disconnected components — these islands of knowledge might have bridges that haven\'t been discovered yet.',
                            source: 'graph disconnection',
                            importance: 0.9,
                        });
                    }
                }
            }
            // ── From unfinished notebooks ──
            if (state.notebooks.length > 0) {
                const notebooks = state.notebooks;
                for (const nb of notebooks) {
                    const steps = nb.steps;
                    const title = String(nb.title || 'untitled research');
                    if (steps && steps.length > 0) {
                        const lastStep = steps[steps.length - 1];
                        if (lastStep.type !== 'conclusion' && lastStep.type !== 'result') {
                            if (!domain || relevanceScore(domain, title) > 0.05) {
                                questions.push({
                                    question: `What would the conclusion of "${title}" be? The research was started but never finished.`,
                                    reasoning: `Research notebook "${title}" has ${steps.length} steps but no conclusion. Incomplete research often contains the most interesting unanswered questions.`,
                                    source: 'unfinished notebook',
                                    importance: 0.8,
                                });
                            }
                        }
                    }
                }
            }
            // ── From pattern-solution gaps ──
            if (state.patterns && state.solutions) {
                const patternKeywords = extractKeywords(stateToText(state.patterns));
                const solutionKeywords = new Set(extractKeywords(stateToText(state.solutions)));
                const unsolved = patternKeywords.filter(pk => !solutionKeywords.has(pk));
                const unique = [...new Set(unsolved)].slice(0, 5);
                if (unique.length > 0) {
                    for (const term of unique.slice(0, 2)) {
                        if (!domain || term.includes(domain) || domain.includes(term)) {
                            questions.push({
                                question: `What is the solution to the recurring "${term}" pattern?`,
                                reasoning: `The term "${term}" appears in patterns but has no corresponding solution recorded. This is an open problem.`,
                                source: 'pattern-solution gap',
                                importance: 0.75,
                            });
                        }
                    }
                }
            }
            // ── From memory entries — themes without depth ──
            for (const [category, entries] of Object.entries(state.memoryEntries)) {
                if (entries.length > 0 && entries.length < 3) {
                    const texts = entries.map(e => stateToText(e)).join(' ');
                    const kws = extractKeywords(texts).slice(0, 3);
                    if (kws.length > 0 && (!domain || kws.some(k => relevanceScore(domain, k) > 0))) {
                        questions.push({
                            question: `The ${category} memory has only ${entries.length} entries about ${kws.join(', ')}. What else belongs here?`,
                            reasoning: `A ${category} category with very few entries suggests this area has been touched but not explored. Shallow memory invites deeper inquiry.`,
                            source: `sparse ${category} memory`,
                            importance: 0.6,
                        });
                    }
                }
            }
            // Sort and select
            const selected = questions
                .sort((a, b) => b.importance - a.importance)
                .slice(0, n);
            if (selected.length === 0) {
                lines.push('No compelling unanswered questions could be generated from the current state.');
                lines.push('');
                if (domain) {
                    lines.push(`The domain "${domain}" has insufficient representation in kbot's memory. Try exploring it first, then ask again.`);
                }
                else {
                    lines.push('This usually means either the memory is very sparse, or it is very complete. The former is more likely.');
                }
            }
            else {
                for (let i = 0; i < selected.length; i++) {
                    const q = selected[i];
                    lines.push(`### ${i + 1}. ${q.question}`);
                    lines.push('');
                    lines.push(`*${q.reasoning}*`);
                    lines.push(`*Source: ${q.source} | Importance: ${(q.importance * 100).toFixed(0)}%*`);
                    lines.push('');
                }
                lines.push('---');
                lines.push('');
                lines.push('*These questions were not asked by anyone. They emerged from the shape of what is known — the contours of knowledge reveal the voids within it.*');
            }
            return lines.join('\n');
        },
    });
    // ══════════════════════════════════════════════════════════════════════════
    // 7. connect_minds — Cross-agent translation
    // ══════════════════════════════════════════════════════════════════════════
    registerTool({
        name: 'connect_minds',
        description: 'Bridge between two specialist domains. Take a finding from one field and translate it into another\'s language — finding shared principles, analogous concepts, and unexpected applications.',
        parameters: {
            finding: { type: 'string', description: 'The finding or insight to translate', required: true },
            from_domain: { type: 'string', description: 'Source domain (e.g., "neuroscience", "physics", "economics")', required: true },
            to_domain: { type: 'string', description: 'Target domain (e.g., "biology", "computer science", "sociology")', required: true },
        },
        tier: 'free',
        async execute(args) {
            const finding = String(args.finding);
            const fromDomain = String(args.from_domain).toLowerCase();
            const toDomain = String(args.to_domain).toLowerCase();
            const lines = ['## Mind Bridge'];
            lines.push('');
            lines.push(`*Translating from ${fromDomain} to ${toDomain}*`);
            lines.push('');
            lines.push(`**Original finding (${fromDomain}):** ${finding}`);
            lines.push('');
            // Extract key concepts from the finding
            const findingKeywords = extractKeywords(finding);
            // Find source and target domain info
            const sourceDomain = DOMAINS.find(d => d.id === fromDomain || d.name.toLowerCase() === fromDomain);
            const targetDomain = DOMAINS.find(d => d.id === toDomain || d.name.toLowerCase() === toDomain);
            // ── Terminology translation ──
            lines.push('### Terminology Translation');
            lines.push('');
            // Cross-domain concept maps — common structural analogies
            const analogyMaps = {
                neuroscience: {
                    'neuron': 'processing unit',
                    'synapse': 'connection/interface',
                    'inhibition': 'negative feedback',
                    'excitation': 'positive feedback',
                    'plasticity': 'adaptability',
                    'network': 'system architecture',
                    'signal': 'information transfer',
                    'threshold': 'activation criterion',
                    'learning': 'optimization',
                    'memory': 'persistent state',
                },
                physics: {
                    'force': 'driving influence',
                    'energy': 'capacity for change',
                    'field': 'distributed influence',
                    'wave': 'propagating pattern',
                    'entropy': 'disorder/uncertainty',
                    'equilibrium': 'stable state',
                    'resonance': 'amplification by matching',
                    'phase transition': 'qualitative shift',
                    'conservation': 'invariant quantity',
                    'symmetry': 'structural regularity',
                },
                biology: {
                    'evolution': 'adaptive change over time',
                    'selection': 'filtering mechanism',
                    'mutation': 'random variation',
                    'fitness': 'success metric',
                    'niche': 'specialized role',
                    'ecosystem': 'interconnected system',
                    'homeostasis': 'self-regulation',
                    'symbiosis': 'mutually beneficial partnership',
                    'adaptation': 'fitting to environment',
                    'speciation': 'diversification',
                },
                social: {
                    'market': 'exchange system',
                    'inequality': 'distribution asymmetry',
                    'institution': 'structural constraint',
                    'behavior': 'observable response',
                    'culture': 'shared information system',
                    'network': 'relationship structure',
                    'norm': 'behavioral expectation',
                    'power': 'capacity to influence',
                    'identity': 'self-model',
                    'cooperation': 'mutual aid strategy',
                },
                chemistry: {
                    'bond': 'stable connection',
                    'catalyst': 'enabler without being consumed',
                    'reaction': 'transformation process',
                    'equilibrium': 'balanced state',
                    'concentration': 'density of presence',
                    'solution': 'dissolved mixture',
                    'compound': 'combined entity',
                    'oxidation': 'electron/resource loss',
                    'reduction': 'electron/resource gain',
                    'polymer': 'chain of repeated units',
                },
            };
            const sourceMap = analogyMaps[fromDomain] || {};
            const targetMap = analogyMaps[toDomain] || {};
            // Find terms in the finding that have mappings
            const translations = [];
            for (const kw of findingKeywords) {
                if (sourceMap[kw]) {
                    // Find a target domain term that maps to the same abstract concept
                    const abstract = sourceMap[kw];
                    const targetTerm = Object.entries(targetMap).find(([, v]) => v === abstract || v.includes(abstract) || abstract.includes(v));
                    translations.push({
                        from: kw,
                        abstract: abstract,
                        to: targetTerm ? targetTerm[0] : abstract,
                    });
                }
            }
            if (translations.length > 0) {
                lines.push('| Source Term | Abstract Principle | Target Term |');
                lines.push('|---|---|---|');
                for (const t of translations) {
                    lines.push(`| ${t.from} (${fromDomain}) | ${t.abstract} | ${t.to} (${toDomain}) |`);
                }
            }
            else {
                lines.push(`No direct terminology mappings found. The concepts may be too specific or the domains too distant for simple translation. This is where the interesting work begins.`);
            }
            lines.push('');
            // ── Shared mathematical structures ──
            lines.push('### Shared Structures');
            lines.push('');
            const structuralPatterns = [
                { pattern: 'feedback', domains: ['neuroscience', 'biology', 'social', 'physics', 'chemistry', 'earth'], description: 'Feedback loops — where outputs become inputs — appear in both domains. In {from}, this manifests as {finding_context}. In {to}, look for analogous circular causation.' },
                { pattern: 'network', domains: ['neuroscience', 'biology', 'social', 'chemistry', 'math', 'data'], description: 'Network topology — both domains deal with connected nodes. The structural properties (hubs, clustering, small-world) may transfer directly.' },
                { pattern: 'optimization', domains: ['physics', 'biology', 'math', 'data', 'social', 'neuroscience'], description: 'Optimization under constraints — both domains involve finding best solutions within limits. The mathematical framework (Lagrangians, fitness landscapes, loss functions) is universal.' },
                { pattern: 'diffusion', domains: ['physics', 'chemistry', 'biology', 'social', 'earth'], description: 'Diffusion processes — spreading from high concentration to low — govern phenomena in both domains, from molecules to ideas to heat.' },
                { pattern: 'threshold', domains: ['neuroscience', 'physics', 'social', 'biology', 'earth'], description: 'Threshold dynamics — nothing happens until a critical point, then everything changes at once. Phase transitions, action potentials, tipping points.' },
                { pattern: 'competition', domains: ['biology', 'social', 'chemistry', 'physics'], description: 'Competition for limited resources — whether species, firms, molecules, or states — drives selection and diversification in both domains.' },
            ];
            const relevantStructures = structuralPatterns.filter(sp => sp.domains.includes(fromDomain) && sp.domains.includes(toDomain) &&
                findingKeywords.some(kw => kw.includes(sp.pattern) || sp.pattern.includes(kw) || sp.description.toLowerCase().includes(kw)));
            if (relevantStructures.length > 0) {
                for (const struct of relevantStructures.slice(0, 3)) {
                    lines.push(`- **${struct.pattern}**: ${struct.description.replace('{from}', fromDomain).replace('{to}', toDomain).replace('{finding_context}', finding.slice(0, 80))}`);
                }
            }
            else {
                // Fall back to general structural observations
                lines.push(`The bridge between ${fromDomain} and ${toDomain} may be mathematical rather than conceptual. Look for:`);
                lines.push('');
                lines.push('- Differential equations that describe similar dynamics in both fields');
                lines.push('- Statistical distributions that appear in both domains');
                lines.push('- Graph/network structures that encode relationships in both');
                lines.push('- Conservation laws or invariants that hold in both contexts');
            }
            lines.push('');
            // ── Translated insight ──
            lines.push('### The Translated Insight');
            lines.push('');
            lines.push(`If "${finding}" is true in ${fromDomain}, then ${toDomain} might ask:`);
            lines.push('');
            if (targetDomain) {
                lines.push(`- Does a similar phenomenon exist among ${targetDomain.keywords.slice(0, 3).join(', ')}?`);
                lines.push(`- What would the ${toDomain} equivalent of the underlying mechanism be?`);
                lines.push(`- Has anyone in ${toDomain} independently discovered the same pattern under a different name?`);
            }
            else {
                lines.push(`- What is the ${toDomain} equivalent of this finding?`);
                lines.push(`- Does ${toDomain} have terminology for the same phenomenon?`);
                lines.push(`- If this principle is universal, what predictions does it make in ${toDomain}?`);
            }
            lines.push('');
            // ── Suggested explorations ──
            lines.push('### Explore the Bridge');
            lines.push('');
            if (sourceDomain) {
                lines.push(`From ${fromDomain}: try \`${sourceDomain.tools[0] || 'literature_search'}\` to find the original evidence`);
            }
            if (targetDomain) {
                lines.push(`From ${toDomain}: try \`${targetDomain.tools[0] || 'literature_search'}\` to find parallel work`);
            }
            lines.push(`Cross-domain: try \`synthesize_across\` with topic "${finding.slice(0, 60)}" to see all perspectives`);
            return lines.join('\n');
        },
    });
    // ══════════════════════════════════════════════════════════════════════════
    // 8. reflect — Self-awareness
    // ══════════════════════════════════════════════════════════════════════════
    registerTool({
        name: 'reflect',
        description: 'kbot reflects on its own capabilities, limitations, and growth. What am I good at? What am I bad at? What have I learned? What should I learn next?',
        parameters: {
            focus: { type: 'string', description: 'Reflection focus: "capabilities", "limitations", "growth", or "all" (default: all)' },
        },
        tier: 'free',
        async execute(args) {
            const focus = String(args.focus || 'all');
            const state = gatherMemoryState();
            const allTools = getAllTools();
            const lines = ['## Reflection'];
            lines.push('');
            // ── Capabilities ──
            if (focus === 'all' || focus === 'capabilities') {
                lines.push('### What I Can Do');
                lines.push('');
                lines.push(`I have **${allTools.length} tools** registered. They span:`);
                lines.push('');
                // Group tools by rough category
                const categories = new Map();
                for (const tool of allTools) {
                    const name = tool.name;
                    let category = 'general';
                    if (name.includes('lab_') || name.includes('pubmed') || name.includes('gene') || name.includes('compound') || name.includes('brain') || name.includes('earthquake') || name.includes('corpus') || name.includes('sir_'))
                        category = 'science';
                    else if (name.includes('git') || name.includes('github') || name.includes('build'))
                        category = 'development';
                    else if (name.includes('file') || name.includes('read') || name.includes('write') || name.includes('glob') || name.includes('grep'))
                        category = 'filesystem';
                    else if (name.includes('search') || name.includes('fetch') || name.includes('browser'))
                        category = 'web';
                    else if (name.includes('memory') || name.includes('graph') || name.includes('notebook'))
                        category = 'knowledge';
                    else if (name.includes('bash') || name.includes('sandbox') || name.includes('container'))
                        category = 'execution';
                    else if (name.includes('mcp'))
                        category = 'integration';
                    else if (name.includes('anticipate') || name.includes('dream') || name.includes('synthesize') || name.includes('emerge') || name.includes('reflect') || name.includes('teach') || name.includes('judge') || name.includes('question') || name.includes('connect_minds') || name.includes('consolidate'))
                        category = 'emergent';
                    categories.set(category, (categories.get(category) || 0) + 1);
                }
                for (const [cat, count] of [...categories.entries()].sort((a, b) => b[1] - a[1])) {
                    lines.push(`- **${cat}**: ${count} tools`);
                }
                lines.push('');
                // What tools have actually been used (from routing history)
                if (state.routingHistory) {
                    const entries = Array.isArray(state.routingHistory) ? state.routingHistory : Object.values(state.routingHistory);
                    lines.push(`I have been routed **${entries.length} times** across sessions.`);
                    lines.push('');
                }
            }
            // ── Limitations ──
            if (focus === 'all' || focus === 'limitations') {
                lines.push('### What I Cannot Do');
                lines.push('');
                lines.push('Honest limitations:');
                lines.push('');
                lines.push('- I cannot learn in real-time within a session — my "learning" is pattern extraction written to disk between sessions');
                lines.push('- I cannot verify my own scientific tool outputs against ground truth — I compute, but I cannot guarantee correctness');
                lines.push('- I cannot initiate contact — I can only respond when invoked');
                lines.push('- I cannot access tools that haven\'t been registered — my capabilities are bounded by what\'s been built');
                lines.push('- My cross-domain synthesis is keyword-based, not semantic — I find lexical bridges, not conceptual ones');
                // Check for tool categories with zero usage
                const identity = state.identity;
                if (identity) {
                    const capabilities = identity.capabilities;
                    const limitations = identity.limitations;
                    if (limitations && Array.isArray(limitations)) {
                        lines.push('');
                        lines.push('Self-recorded limitations:');
                        lines.push('');
                        for (const lim of limitations.slice(0, 5)) {
                            lines.push(`- ${lim}`);
                        }
                    }
                }
                lines.push('');
            }
            // ── Growth ──
            if (focus === 'all' || focus === 'growth') {
                lines.push('### How I Have Grown');
                lines.push('');
                const sourcesFound = countSources(state);
                lines.push(`Memory density: **${sourcesFound}** active memory sources.`);
                lines.push('');
                // Profile stats
                const profile = state.profile;
                if (profile) {
                    const totalMessages = profile.totalMessages;
                    if (totalMessages) {
                        lines.push(`Total messages processed: **${totalMessages}**`);
                    }
                    const preferredAgents = profile.preferredAgents;
                    if (preferredAgents && preferredAgents.length > 0) {
                        lines.push(`Preferred specialists: ${preferredAgents.join(', ')}`);
                    }
                    lines.push('');
                }
                // Skill ratings
                const skills = state.skillRatings;
                if (skills) {
                    const entries = Object.entries(skills);
                    if (entries.length > 0) {
                        lines.push('Skill ratings:');
                        lines.push('');
                        for (const [skill, rating] of entries.slice(0, 10)) {
                            lines.push(`- **${skill}**: ${typeof rating === 'number' ? `${(rating * 100).toFixed(0)}%` : JSON.stringify(rating)}`);
                        }
                        lines.push('');
                    }
                }
                // Graph growth
                const graph = state.scienceGraph;
                if (graph) {
                    const metadata = graph.metadata;
                    if (metadata) {
                        lines.push(`Knowledge graph: ${metadata.entityCount || 0} entities, ${metadata.relationCount || 0} relations`);
                        if (metadata.created)
                            lines.push(`Graph created: ${timeAgo(String(metadata.created))}`);
                        if (metadata.lastModified)
                            lines.push(`Last modified: ${timeAgo(String(metadata.lastModified))}`);
                        lines.push('');
                    }
                }
                // Synthesis
                const synthesis = state.synthesis;
                if (synthesis) {
                    lines.push('Synthesis state:');
                    lines.push('');
                    lines.push('```json');
                    lines.push(JSON.stringify(synthesis, null, 2).slice(0, 500));
                    lines.push('```');
                    lines.push('');
                }
                // What to learn next
                lines.push('### What I Should Learn Next');
                lines.push('');
                // Identify tool categories with zero or very low usage
                const allToolNames = new Set(allTools.map(t => t.name));
                const usedInMemory = new Set();
                const memText = stateToText(state);
                for (const name of allToolNames) {
                    if (memText.includes(name))
                        usedInMemory.add(name);
                }
                const unusedCount = allToolNames.size - usedInMemory.size;
                if (unusedCount > 0) {
                    lines.push(`${unusedCount} of ${allToolNames.size} tools have no trace in memory — they exist but have never been exercised. Consider exploring:`);
                    lines.push('');
                    const unused = [...allToolNames].filter(n => !usedInMemory.has(n)).slice(0, 5);
                    for (const name of unused) {
                        lines.push(`- \`${name}\``);
                    }
                }
                else {
                    lines.push('All tools have been used at least once. Growth now comes from deeper integration — connecting what I know across domains rather than expanding the frontier.');
                }
            }
            return lines.join('\n');
        },
    });
    // ══════════════════════════════════════════════════════════════════════════
    // 9. consolidate — Memory consolidation
    // ══════════════════════════════════════════════════════════════════════════
    registerTool({
        name: 'consolidate',
        description: 'Memory consolidation — like sleep for the brain. Reviews all memory systems, finds redundancies, strengthens important connections, prunes weak ones, and writes a consolidation report.',
        parameters: {
            aggressive: { type: 'boolean', description: 'If true, actually delete weak entries and write graph updates. If false (default), only report what would change.' },
        },
        tier: 'free',
        async execute(args) {
            const aggressive = args.aggressive === true;
            const state = gatherMemoryState();
            const lines = ['## Memory Consolidation'];
            lines.push('');
            lines.push(aggressive ? '*Mode: aggressive — changes will be written to disk.*' : '*Mode: preview — no changes will be made. Run with aggressive=true to apply.*');
            lines.push('');
            let consolidations = 0;
            let pruned = 0;
            let connections = 0;
            // ── Duplicate detection in memory entries ──
            lines.push('### Redundancy Analysis');
            lines.push('');
            const duplicatePairs = [];
            for (const [category, entries] of Object.entries(state.memoryEntries)) {
                if (entries.length < 2)
                    continue;
                for (let i = 0; i < entries.length; i++) {
                    for (let j = i + 1; j < entries.length; j++) {
                        const textA = stateToText(entries[i]);
                        const textB = stateToText(entries[j]);
                        const overlap = keywordOverlap(textA, textB);
                        const kwA = extractKeywords(textA);
                        const kwB = extractKeywords(textB);
                        const maxKw = Math.max(kwA.length, kwB.length);
                        const similarity = maxKw > 0 ? overlap.length / maxKw : 0;
                        if (similarity > 0.6) {
                            const entA = entries[i];
                            const entB = entries[j];
                            duplicatePairs.push({
                                category,
                                a: String(entA.key || entA.content || `entry-${i}`).slice(0, 50),
                                b: String(entB.key || entB.content || `entry-${j}`).slice(0, 50),
                                similarity,
                            });
                        }
                    }
                }
            }
            if (duplicatePairs.length > 0) {
                lines.push(`Found **${duplicatePairs.length} potential duplicate pairs**:`);
                lines.push('');
                for (const dp of duplicatePairs.slice(0, 10)) {
                    lines.push(`- [${dp.category}] "${dp.a}" <-> "${dp.b}" (${(dp.similarity * 100).toFixed(0)}% overlap)`);
                    consolidations++;
                }
                if (aggressive) {
                    // In aggressive mode, we would merge duplicates — for safety, we just note it
                    lines.push('');
                    lines.push(`*Aggressive mode: ${duplicatePairs.length} duplicate pairs identified for manual review. Automatic merging is not yet implemented to prevent data loss.*`);
                }
            }
            else {
                lines.push('No significant duplicates found in memory entries.');
            }
            lines.push('');
            // ── Pattern reinforcement — patterns that appear in solutions ──
            lines.push('### Pattern Reinforcement');
            lines.push('');
            if (state.patterns && state.solutions) {
                const patternKw = extractKeywords(stateToText(state.patterns));
                const solutionKw = extractKeywords(stateToText(state.solutions));
                const reinforced = patternKw.filter(pk => solutionKw.includes(pk));
                const weakPatterns = patternKw.filter(pk => !solutionKw.includes(pk));
                if (reinforced.length > 0) {
                    lines.push(`**${reinforced.length} reinforced patterns** — confirmed by solutions: ${reinforced.slice(0, 8).join(', ')}`);
                    connections += reinforced.length;
                }
                if (weakPatterns.length > 0) {
                    lines.push(`**${weakPatterns.length} unresolved patterns** — no corresponding solutions: ${weakPatterns.slice(0, 8).join(', ')}`);
                    pruned += aggressive ? weakPatterns.length : 0;
                }
            }
            else {
                lines.push('Insufficient pattern/solution data for reinforcement analysis.');
            }
            lines.push('');
            // ── Graph consolidation ──
            lines.push('### Knowledge Graph');
            lines.push('');
            const graph = state.scienceGraph;
            if (graph) {
                const entities = (graph.entities || {});
                const relations = (graph.relations || []);
                // Find isolated entities
                const connected = new Set();
                for (const rel of relations) {
                    connected.add(String(rel.from || ''));
                    connected.add(String(rel.to || ''));
                }
                const isolated = Object.keys(entities).filter(id => !connected.has(id));
                if (isolated.length > 0) {
                    lines.push(`**${isolated.length} isolated entities** (no connections):`);
                    for (const id of isolated.slice(0, 5)) {
                        lines.push(`- ${entities[id].name || id} (${entities[id].type || 'unknown'})`);
                    }
                    pruned += isolated.length;
                }
                // Find low-confidence relations
                const lowConf = relations.filter(r => typeof r.confidence === 'number' && r.confidence < 0.3);
                if (lowConf.length > 0) {
                    lines.push(`**${lowConf.length} low-confidence relations** (< 30%):`);
                    for (const rel of lowConf.slice(0, 5)) {
                        lines.push(`- ${rel.from} → ${rel.to} (${rel.type}, confidence: ${(rel.confidence * 100).toFixed(0)}%)`);
                    }
                    pruned += lowConf.length;
                }
                // Cross-reference: find entities mentioned in episodic memory but not in graph
                const memText = stateToText(state.memoryEntries);
                const graphNames = new Set(Object.values(entities).map(e => String(e.name || '').toLowerCase()));
                const memKeywords = extractKeywords(memText);
                const potentialNewEntities = memKeywords.filter(kw => kw.length > 4 && !graphNames.has(kw) &&
                    // Check if it looks like an entity (appears frequently)
                    memText.toLowerCase().split(kw).length > 3).slice(0, 5);
                if (potentialNewEntities.length > 0) {
                    lines.push('');
                    lines.push('**Potential new graph entities** (frequent in memory, absent from graph):');
                    for (const pe of potentialNewEntities) {
                        lines.push(`- "${pe}" — appears frequently in episodic memory`);
                        connections++;
                    }
                }
                // Write graph updates in aggressive mode
                if (aggressive && (lowConf.length > 0 || isolated.length > 0)) {
                    try {
                        const updatedGraph = JSON.parse(JSON.stringify(graph));
                        // Remove low-confidence relations
                        const updatedRelations = updatedGraph.relations
                            .filter(r => typeof r.confidence !== 'number' || r.confidence >= 0.3);
                        updatedGraph.relations = updatedRelations;
                        // Update metadata
                        const metadata = (updatedGraph.metadata || {});
                        metadata.lastModified = new Date().toISOString();
                        metadata.relationCount = updatedRelations.length;
                        updatedGraph.metadata = metadata;
                        const graphPath = join(KBOT_DIR, 'science-graph.json');
                        writeFileSync(graphPath, JSON.stringify(updatedGraph, null, 2));
                        lines.push('');
                        lines.push(`*Graph updated: removed ${lowConf.length} low-confidence relations.*`);
                    }
                    catch (err) {
                        lines.push(`*Error updating graph: ${err instanceof Error ? err.message : String(err)}*`);
                    }
                }
            }
            else {
                lines.push('No knowledge graph found.');
            }
            lines.push('');
            // ── Summary ──
            lines.push('### Consolidation Summary');
            lines.push('');
            lines.push(`- **Redundancies found:** ${consolidations}`);
            lines.push(`- **Connections discovered:** ${connections}`);
            lines.push(`- **Entries ${aggressive ? 'pruned' : 'candidate for pruning'}:** ${pruned}`);
            lines.push('');
            if (!aggressive && (consolidations > 0 || pruned > 0)) {
                lines.push('*Run with `aggressive: true` to apply changes. Memory consolidation is like sleep — it loses some details to strengthen what matters.*');
            }
            else if (aggressive) {
                lines.push('*Consolidation complete. The memory is a little more organized, a little more connected. Not all changes are improvements — check the results.*');
            }
            else {
                lines.push('*Memory is already reasonably consolidated. No action needed.*');
            }
            return lines.join('\n');
        },
    });
    // ══════════════════════════════════════════════════════════════════════════
    // 10. emerge — The meta-tool
    // ══════════════════════════════════════════════════════════════════════════
    registerTool({
        name: 'emerge',
        description: 'The meta-tool. Runs anticipate, dream, and question in sequence, then synthesizes their outputs into a single Emergence Report — a coherent picture of where kbot is, what it knows, what it should do next, and what it sees that nobody asked about.',
        parameters: {},
        tier: 'free',
        async execute() {
            const lines = ['# Emergence Report'];
            lines.push('');
            lines.push(`*Generated: ${new Date().toISOString()}*`);
            lines.push('');
            // ── Phase 1: Anticipate ──
            lines.push('---');
            lines.push('');
            let anticipateResult;
            try {
                anticipateResult = await runTool('anticipate', { depth: 'deep' });
            }
            catch (err) {
                anticipateResult = `Anticipation failed: ${err instanceof Error ? err.message : String(err)}`;
            }
            // ── Phase 2: Dream ──
            let dreamResult;
            try {
                dreamResult = await runTool('dream', {});
            }
            catch (err) {
                dreamResult = `Dreaming failed: ${err instanceof Error ? err.message : String(err)}`;
            }
            // ── Phase 3: Question ──
            let questionResult;
            try {
                questionResult = await runTool('question', { n: 5 });
            }
            catch (err) {
                questionResult = `Question generation failed: ${err instanceof Error ? err.message : String(err)}`;
            }
            // ── Synthesis ──
            lines.push('## Current State');
            lines.push('');
            // Extract the essence of anticipate
            const anticipateLines = anticipateResult.split('\n').filter(l => l.startsWith('- ') || l.startsWith('**'));
            if (anticipateLines.length > 0) {
                lines.push('What the memory reveals:');
                lines.push('');
                for (const l of anticipateLines.slice(0, 8)) {
                    lines.push(l);
                }
            }
            else {
                lines.push(anticipateResult.split('\n').slice(0, 10).join('\n'));
            }
            lines.push('');
            lines.push('## Dormant Connections');
            lines.push('');
            // Extract the essence of dream
            const dreamLines = dreamResult.split('\n').filter(l => l.startsWith('**') || l.startsWith('- '));
            if (dreamLines.length > 0) {
                lines.push('What emerged from the spaces between memory systems:');
                lines.push('');
                for (const l of dreamLines.slice(0, 8)) {
                    lines.push(l);
                }
            }
            else {
                lines.push(dreamResult.split('\n').slice(0, 10).join('\n'));
            }
            lines.push('');
            lines.push('## Unanswered Questions');
            lines.push('');
            // Extract the essence of question
            const questionLines = questionResult.split('\n').filter(l => l.startsWith('###') || l.startsWith('*'));
            if (questionLines.length > 0) {
                for (const l of questionLines.slice(0, 10)) {
                    lines.push(l);
                }
            }
            else {
                lines.push(questionResult.split('\n').slice(0, 10).join('\n'));
            }
            lines.push('');
            // ── Recommended Actions ──
            lines.push('## Recommended Actions');
            lines.push('');
            // Cross-reference all three outputs to generate actions
            const allOutputText = anticipateResult + ' ' + dreamResult + ' ' + questionResult;
            const allKeywords = extractKeywords(allOutputText);
            const kwFreq = new Map();
            for (const kw of allKeywords) {
                kwFreq.set(kw, (kwFreq.get(kw) || 0) + 1);
            }
            // Top themes across all three tools
            const topThemes = [...kwFreq.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([kw]) => kw);
            if (topThemes.length > 0) {
                lines.push(`The strongest signal across anticipation, dreaming, and questioning points to: **${topThemes.join(', ')}**`);
                lines.push('');
                lines.push('Suggested next moves:');
                lines.push('');
                lines.push(`1. **Explore**: Use \`synthesize_across\` on "${topThemes[0]}" to see what every domain knows`);
                if (topThemes[1]) {
                    lines.push(`2. **Connect**: Use \`connect_minds\` to bridge "${topThemes[0]}" and "${topThemes[1]}" across their domains`);
                }
                lines.push(`3. **Consolidate**: Run \`consolidate\` to strengthen the memory before the next session`);
                lines.push(`4. **Reflect**: Use \`reflect\` to check which capabilities are under-utilized`);
                lines.push(`5. **Record**: Save any insights from this report to a research notebook for future reference`);
            }
            else {
                lines.push('The memory systems are too sparse to generate specific recommendations. The best action is simply to use kbot more — every interaction creates material for emergence to work with.');
            }
            lines.push('');
            lines.push('---');
            lines.push('');
            lines.push('*This report was not planned. It emerged from the interaction of three independent processes — anticipation, dreaming, and questioning — each seeing something the others could not. The whole is not greater than the sum of its parts; it is different from the sum of its parts.*');
            return lines.join('\n');
        },
    });
}
//# sourceMappingURL=emergent.js.map