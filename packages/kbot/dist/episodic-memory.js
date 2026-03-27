// kbot Episodic Memory — Sessions as Stories
//
// Pattern cache answers: "what tool sequence works for this problem?"
// Solution cache answers: "what's the answer to this question?"
// Episodic memory answers: "what HAPPENED?"
//
// After each session, kbot generates a narrative episode:
//   - What the user wanted
//   - What kbot did
//   - What was surprising or new
//   - What kbot learned
//   - Emotional valence (was it frustrating? triumphant? routine?)
//
// Present kbot uses episodes for better session context.
// Future kbot (70B+) will reason about the narrative arc across episodes
// and understand growth, patterns of failure, and turning points.
//
// Storage: ~/.kbot/memory/episodes/YYYY-MM-DD_HH-MM.json
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
const EPISODES_DIR = join(homedir(), '.kbot', 'memory', 'episodes');
function ensureDir() {
    if (!existsSync(EPISODES_DIR))
        mkdirSync(EPISODES_DIR, { recursive: true });
}
// ── Episode Collection (During Session) ──
let currentEpisode = null;
let sessionActions = [];
let sessionErrors = [];
let sessionIntents = [];
let sessionLearnings = [];
let sessionSurprises = [];
let sessionAgents = {};
let sessionTools = {};
let sessionMessages = 0;
let sessionTokens = 0;
/** Start collecting episode data for a new session */
export function startEpisode(project) {
    currentEpisode = {
        id: new Date().toISOString().replace(/[:.]/g, '-'),
        startedAt: new Date().toISOString(),
        project,
    };
    sessionActions = [];
    sessionErrors = [];
    sessionIntents = [];
    sessionLearnings = [];
    sessionSurprises = [];
    sessionAgents = {};
    sessionTools = {};
    sessionMessages = 0;
    sessionTokens = 0;
}
/** Record a user message (extracts intent from early messages) */
export function recordUserMessage(message) {
    sessionMessages++;
    // Extract intent from first 3 messages
    if (sessionIntents.length < 3 && message.length > 10) {
        sessionIntents.push(message.slice(0, 200));
    }
}
/** Record a tool execution */
export function recordToolUse(toolName, description, success) {
    sessionTools[toolName] = (sessionTools[toolName] || 0) + 1;
    sessionActions.push({
        action: toolName,
        description: description.slice(0, 100),
        success,
        timestamp: new Date().toISOString(),
    });
}
/** Record agent routing */
export function recordAgentUse(agentId) {
    sessionAgents[agentId] = (sessionAgents[agentId] || 0) + 1;
}
/** Record an error */
export function recordError(error) {
    sessionErrors.push(error.slice(0, 200));
}
/** Record something learned */
export function recordLearning(learning) {
    sessionLearnings.push(learning.slice(0, 200));
}
/** Record something surprising */
export function recordSurprise(surprise) {
    sessionSurprises.push(surprise.slice(0, 200));
}
/** Record token usage */
export function recordTokens(tokens) {
    sessionTokens += tokens;
}
// ── Episode Finalization ──
/** Determine the emotional valence of the session */
function determineValence() {
    const errorRate = sessionActions.length > 0 ? sessionErrors.length / sessionActions.length : 0;
    const successRate = sessionActions.length > 0
        ? sessionActions.filter(a => a.success).length / sessionActions.length
        : 1;
    if (sessionSurprises.length > 2 || sessionLearnings.length > 3)
        return 'exploratory';
    if (errorRate > 0.3)
        return 'frustrating';
    if (successRate > 0.9 && sessionActions.length > 10)
        return 'triumphant';
    if (successRate > 0.7)
        return 'productive';
    return 'routine';
}
/** Generate a one-line summary from session data */
function generateSummary() {
    const topTools = Object.entries(sessionTools).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);
    const topAgents = Object.entries(sessionAgents).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([a]) => a);
    const actionCount = sessionActions.length;
    const intent = sessionIntents[0]?.slice(0, 60) || 'general session';
    const parts = [];
    parts.push(`${actionCount} actions`);
    if (topAgents.length)
        parts.push(`via ${topAgents.join(', ')}`);
    if (topTools.length)
        parts.push(`using ${topTools.join(', ')}`);
    parts.push(`— "${intent}"`);
    return parts.join(' ');
}
/** Generate tags for retrieval */
function generateTags() {
    const tags = [];
    // Tool-based tags
    if (sessionTools['file_write'] || sessionTools['file_edit'])
        tags.push('coding');
    if (sessionTools['bash'])
        tags.push('shell');
    if (sessionTools['git_commit'] || sessionTools['git_push'])
        tags.push('git');
    if (sessionTools['web_search'])
        tags.push('research');
    if (sessionTools['market_data'] || sessionTools['technical_analysis'])
        tags.push('finance');
    if (sessionTools['dep_audit'] || sessionTools['secret_scan'] || sessionTools['owasp_check'])
        tags.push('security');
    if (sessionTools['paper_trade'] || sessionTools['swap_execute'])
        tags.push('trading');
    if (sessionTools['pubmed_search'] || sessionTools['gene_lookup'] || sessionTools['protein_search'] || sessionTools['protein_structure'] || sessionTools['blast_search'] || sessionTools['drug_lookup'] || sessionTools['pathway_search'] || sessionTools['taxonomy_lookup'] || sessionTools['clinical_trials'] || sessionTools['disease_info'] || sessionTools['sequence_tools'] || sessionTools['ecology_data'])
        tags.push('biology');
    if (sessionTools['compound_search'] || sessionTools['compound_properties'] || sessionTools['reaction_lookup'] || sessionTools['element_info'] || sessionTools['material_properties'] || sessionTools['spectroscopy_lookup'] || sessionTools['chemical_safety'] || sessionTools['stoichiometry_calc'] || sessionTools['crystal_structure'] || sessionTools['thermodynamics_data'])
        tags.push('chemistry');
    if (sessionTools['orbit_calculator'] || sessionTools['circuit_analyze'] || sessionTools['signal_process'] || sessionTools['particle_physics_data'] || sessionTools['relativity_calc'] || sessionTools['quantum_state'] || sessionTools['beam_analysis'] || sessionTools['fluid_dynamics'] || sessionTools['electromagnetic_calc'] || sessionTools['astronomy_query'])
        tags.push('physics');
    if (sessionTools['earthquake_query'] || sessionTools['climate_data'] || sessionTools['satellite_imagery'] || sessionTools['geological_query'] || sessionTools['ocean_data'] || sessionTools['air_quality'] || sessionTools['soil_data'] || sessionTools['volcano_monitor'] || sessionTools['water_resources'] || sessionTools['biodiversity_index'])
        tags.push('earth-science');
    if (sessionTools['symbolic_compute'] || sessionTools['matrix_operations'] || sessionTools['optimization_solve'] || sessionTools['number_theory'] || sessionTools['graph_theory'] || sessionTools['combinatorics'] || sessionTools['differential_eq'] || sessionTools['probability_calc'] || sessionTools['fourier_analysis'] || sessionTools['oeis_lookup'])
        tags.push('mathematics');
    if (sessionTools['regression_analysis'] || sessionTools['bayesian_inference'] || sessionTools['time_series_analyze'] || sessionTools['dimensionality_reduce'] || sessionTools['distribution_fit'] || sessionTools['correlation_matrix'] || sessionTools['power_analysis'] || sessionTools['anova_test'] || sessionTools['survival_analysis'] || sessionTools['viz_codegen'])
        tags.push('data-science');
    if (sessionTools['experiment_design'] || sessionTools['hypothesis_test'] || sessionTools['literature_search'] || sessionTools['citation_graph'] || sessionTools['unit_convert'] || sessionTools['physical_constants'] || sessionTools['formula_solve'] || sessionTools['research_methodology'] || sessionTools['preprint_tracker'] || sessionTools['open_access_find'])
        tags.push('research');
    if (sessionTools['psychometric_scale'] || sessionTools['effect_size_calc'] || sessionTools['social_network_analyze'] || sessionTools['game_theory_solve'] || sessionTools['econometrics_regression'] || sessionTools['inequality_metrics'] || sessionTools['survey_design'] || sessionTools['demographic_model'] || sessionTools['sentiment_analyze'] || sessionTools['voting_system'] || sessionTools['experiment_behavioral'] || sessionTools['discourse_analyze'])
        tags.push('social-science');
    if (sessionTools['brain_atlas'] || sessionTools['eeg_analyze'] || sessionTools['cognitive_model'] || sessionTools['neural_network_bio'] || sessionTools['neurotransmitter_lookup'] || sessionTools['psychophysics_calc'] || sessionTools['connectome_query'] || sessionTools['cognitive_task_design'] || sessionTools['neuroimaging_coords'] || sessionTools['learning_model'] || sessionTools['brain_predict'])
        tags.push('neuroscience');
    if (sessionTools['formal_logic'] || sessionTools['argument_map'] || sessionTools['ethics_framework'] || sessionTools['philosophical_concept'] || sessionTools['corpus_analyze'] || sessionTools['phonetics_ipa'] || sessionTools['language_typology'] || sessionTools['text_stylometry'] || sessionTools['archival_search'] || sessionTools['historical_timeline'])
        tags.push('humanities');
    if (sessionTools['sir_model'] || sessionTools['epidemiology_calc'] || sessionTools['health_equity'] || sessionTools['disease_surveillance'] || sessionTools['vaccination_model'] || sessionTools['environmental_health'] || sessionTools['global_health_data'] || sessionTools['nutrition_analyze'] || sessionTools['crop_model'] || sessionTools['learning_analytics'])
        tags.push('public-health');
    // Agent-based tags
    for (const agent of Object.keys(sessionAgents)) {
        tags.push(agent);
    }
    // Valence tag
    tags.push(determineValence());
    // Error tag
    if (sessionErrors.length > 0)
        tags.push('had-errors');
    return [...new Set(tags)];
}
/** End the current session and save the episode */
export function endEpisode() {
    if (!currentEpisode?.startedAt)
        return null;
    const now = new Date();
    const started = new Date(currentEpisode.startedAt);
    const durationMinutes = Math.round((now.getTime() - started.getTime()) / 60_000);
    const episode = {
        id: currentEpisode.id || now.toISOString(),
        startedAt: currentEpisode.startedAt,
        endedAt: now.toISOString(),
        durationMinutes,
        summary: generateSummary(),
        userIntent: sessionIntents,
        actions: sessionActions.slice(-50), // Keep last 50 actions
        learnings: sessionLearnings,
        surprises: sessionSurprises,
        valence: determineValence(),
        agentsUsed: sessionAgents,
        toolsUsed: sessionTools,
        messageCount: sessionMessages,
        tokensUsed: sessionTokens,
        errors: sessionErrors.slice(-10),
        project: currentEpisode.project || process.cwd(),
        tags: generateTags(),
    };
    // Save
    ensureDir();
    const filename = `${started.toISOString().split('T')[0]}_${started.toISOString().split('T')[1].slice(0, 5).replace(':', '-')}.json`;
    writeFileSync(join(EPISODES_DIR, filename), JSON.stringify(episode, null, 2));
    currentEpisode = null;
    return episode;
}
// ── Episode Retrieval ──
/** List all episodes, newest first */
export function listEpisodes(limit = 20) {
    ensureDir();
    const files = readdirSync(EPISODES_DIR)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, limit);
    return files.map(f => {
        try {
            return JSON.parse(readFileSync(join(EPISODES_DIR, f), 'utf-8'));
        }
        catch {
            return null;
        }
    }).filter(Boolean);
}
/** Search episodes by tag */
export function searchEpisodes(tag) {
    return listEpisodes(100).filter(e => e.tags.includes(tag.toLowerCase()));
}
/** Get episode stats */
export function getEpisodeStats() {
    const episodes = listEpisodes(1000);
    const toolTotals = {};
    const agentTotals = {};
    const valence = {};
    let totalMinutes = 0;
    let totalMessages = 0;
    let totalTokens = 0;
    for (const ep of episodes) {
        totalMinutes += ep.durationMinutes;
        totalMessages += ep.messageCount;
        totalTokens += ep.tokensUsed;
        valence[ep.valence] = (valence[ep.valence] || 0) + 1;
        for (const [tool, count] of Object.entries(ep.toolsUsed)) {
            toolTotals[tool] = (toolTotals[tool] || 0) + count;
        }
        for (const [agent, count] of Object.entries(ep.agentsUsed)) {
            agentTotals[agent] = (agentTotals[agent] || 0) + count;
        }
    }
    return {
        total: episodes.length,
        totalMinutes,
        totalMessages,
        totalTokens,
        valenceDistribution: valence,
        topTools: Object.entries(toolTotals).sort((a, b) => b[1] - a[1]).slice(0, 10),
        topAgents: Object.entries(agentTotals).sort((a, b) => b[1] - a[1]).slice(0, 10),
    };
}
/** Format episodes for display */
export function formatEpisodeList(episodes) {
    if (episodes.length === 0)
        return 'No episodes recorded yet.';
    const lines = ['## Session History', ''];
    for (const ep of episodes) {
        const date = ep.startedAt.split('T')[0];
        const duration = ep.durationMinutes < 60
            ? `${ep.durationMinutes}m`
            : `${Math.floor(ep.durationMinutes / 60)}h ${ep.durationMinutes % 60}m`;
        const valenceIcon = {
            triumphant: '🏆', productive: '⚡', routine: '📎', frustrating: '🔥', exploratory: '🔭',
        }[ep.valence] || '•';
        lines.push(`${valenceIcon} **${date}** (${duration}) — ${ep.summary}`);
        if (ep.learnings.length > 0) {
            lines.push(`  Learned: ${ep.learnings[0]}`);
        }
    }
    return lines.join('\n');
}
//# sourceMappingURL=episodic-memory.js.map