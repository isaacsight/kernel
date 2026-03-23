// Emergent role discovery for multi-agent swarms — inspired by Project Sid
// where 1,000+ AI agents autonomously developed specialized roles.
// Instead of hardcoded roles, agents evolve roles dynamically per task.
import { runAgent } from './agent.js';
import { loadConfig } from './auth.js';
const MAX_ADAPTATIONS = 3;
const OVERLAP_THRESHOLD = 0.7;
const MIN_QUALITY = 0.3;
const ANALYZE_PROMPT = `You are a task decomposition engine. Analyze this task and determine what specialized capabilities are needed.

TASK: {task}

Respond in JSON only:
{
  "capabilities": ["list", "of", "required", "capabilities"],
  "complexity": "simple|moderate|complex",
  "estimatedAgents": 2-5
}

Examples of capabilities: "code_analysis", "security_review", "api_design", "data_modeling", "testing", "documentation", "performance_profiling", "ux_evaluation", "architecture", "debugging", "research", "writing", "critique"

Respond ONLY with the JSON object.`;
const ROLE_DISCOVERY_PROMPT = `You are a swarm role designer. Given a task and required capabilities, create specialized agent roles.

TASK: {task}

REQUIRED CAPABILITIES: {capabilities}

NUMBER OF AGENTS: {count}

Design {count} specialized roles. Each role should be focused, non-overlapping, and complementary. Do NOT use generic roles like "manager" or "assistant". Make them task-specific.

Respond in JSON only:
[
  {
    "id": "role-id",
    "name": "Role Name",
    "description": "What this role does for THIS specific task",
    "strengths": ["strength1", "strength2"]
  }
]

Respond ONLY with the JSON array.`;
const SYNTHESIS_PROMPT = `You are a swarm synthesis engine. Combine the outputs from multiple specialized agents into a unified response.

TASK: {task}

CONTRIBUTIONS:
{contributions}

Synthesize these into a single coherent response. Resolve any contradictions by favoring the contribution from the most relevant role. Preserve important details from each contribution.`;
export async function analyzeTaskRequirements(task) {
    const config = loadConfig();
    if (!config) {
        return { capabilities: ['general'], complexity: 'simple', estimatedAgents: 2 };
    }
    try {
        const result = await runAgent(ANALYZE_PROMPT.replace('{task}', task), { agent: 'kernel', stream: false, skipPlanner: true });
        const match = result.content.match(/\{[\s\S]*\}/);
        if (match) {
            const parsed = JSON.parse(match[0]);
            return {
                capabilities: parsed.capabilities || ['general'],
                complexity: parsed.complexity || 'moderate',
                estimatedAgents: Math.min(5, Math.max(2, parsed.estimatedAgents || 3)),
            };
        }
    }
    catch { /* fall through */ }
    return { capabilities: ['general'], complexity: 'moderate', estimatedAgents: 3 };
}
export function discoverRoles(task, requirements) {
    // Deterministic fallback based on capabilities
    return requirements.capabilities.slice(0, requirements.estimatedAgents).map((cap, i) => ({
        id: `role-${i}`,
        name: cap.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        description: `Specialist in ${cap.replace(/_/g, ' ')} for this task`,
        strengths: [cap],
        emergenceScore: 0,
        taskHistory: [],
    }));
}
async function discoverRolesWithAI(task, requirements) {
    try {
        const result = await runAgent(ROLE_DISCOVERY_PROMPT
            .replace('{task}', task)
            .replace('{capabilities}', requirements.capabilities.join(', '))
            .replace(/\{count\}/g, String(requirements.estimatedAgents)), { agent: 'kernel', stream: false, skipPlanner: true });
        const match = result.content.match(/\[[\s\S]*\]/);
        if (match) {
            const parsed = JSON.parse(match[0]);
            return parsed.map(r => ({
                ...r,
                emergenceScore: 0,
                taskHistory: [],
            }));
        }
    }
    catch { /* fall through */ }
    return discoverRoles(task, requirements);
}
function wordSet(text) {
    return new Set(text.toLowerCase().split(/\s+/).filter(w => w.length > 2));
}
function wordOverlap(a, b) {
    const setA = wordSet(a);
    const setB = wordSet(b);
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
export class EmergentSwarm {
    task;
    maxAgents;
    state;
    contributions = [];
    constructor(task, maxAgents = 5) {
        this.task = task;
        this.maxAgents = Math.min(maxAgents, 5);
        this.state = {
            roles: [],
            iteration: 0,
            consensusHistory: [],
            adaptations: 0,
        };
    }
    async initialize() {
        const requirements = await analyzeTaskRequirements(this.task);
        this.state.roles = await discoverRolesWithAI(this.task, requirements);
    }
    async execute() {
        if (this.state.roles.length === 0)
            await this.initialize();
        // Execute each role
        for (const role of this.state.roles) {
            const rolePrompt = [
                `You are a specialist with the role: ${role.name}`,
                `Your focus: ${role.description}`,
                `Your strengths: ${role.strengths.join(', ')}`,
                '',
                `TASK: ${this.task}`,
                '',
                'Provide your specialized contribution. Focus only on your area of expertise.',
            ].join('\n');
            try {
                const result = await runAgent(rolePrompt, {
                    agent: 'kernel',
                    stream: false,
                    skipPlanner: true,
                });
                const quality = result.content.length > 50 ? 0.8 : 0.3;
                this.contributions.push({ role, output: result.content, quality });
                role.taskHistory.push(this.task.slice(0, 100));
            }
            catch {
                this.contributions.push({ role, output: '', quality: 0 });
            }
        }
        this.state.iteration++;
        // Adapt roles based on output analysis
        await this.adaptRoles();
        // Synthesize
        const synthesis = await this.synthesize();
        const roleContributions = new Map();
        for (const c of this.contributions) {
            roleContributions.set(c.role.name, c.output);
        }
        return {
            synthesis,
            roleContributions,
            adaptations: this.state.adaptations,
            iterations: this.state.iteration,
        };
    }
    async adapt(feedback) {
        if (this.state.adaptations >= MAX_ADAPTATIONS)
            return;
        this.state.consensusHistory.push(feedback);
        await this.adaptRoles();
    }
    getState() {
        return { ...this.state };
    }
    async adaptRoles() {
        if (this.state.adaptations >= MAX_ADAPTATIONS)
            return;
        if (this.contributions.length < 2)
            return;
        // Check for overlapping roles (merge if >70% word overlap)
        for (let i = 0; i < this.contributions.length; i++) {
            for (let j = i + 1; j < this.contributions.length; j++) {
                const overlap = wordOverlap(this.contributions[i].output, this.contributions[j].output);
                if (overlap > OVERLAP_THRESHOLD) {
                    // Merge: keep the higher-quality one
                    const keep = this.contributions[i].quality >= this.contributions[j].quality ? i : j;
                    const drop = keep === i ? j : i;
                    this.contributions[keep].output += '\n\n' + this.contributions[drop].output;
                    this.contributions[keep].role.strengths.push(...this.contributions[drop].role.strengths);
                    // Capture role ID before splice invalidates the index
                    const dropRoleId = this.contributions[drop].role.id;
                    this.contributions.splice(drop, 1);
                    this.state.roles = this.state.roles.filter(r => r.id !== dropRoleId);
                    this.state.adaptations++;
                    if (this.state.adaptations >= MAX_ADAPTATIONS)
                        return;
                }
            }
        }
        // Drop low-quality contributors
        const weak = this.contributions.filter(c => c.quality < MIN_QUALITY);
        for (const w of weak) {
            if (this.state.adaptations >= MAX_ADAPTATIONS)
                break;
            const strongest = this.contributions.reduce((best, c) => c.quality > best.quality ? c : best);
            if (strongest !== w) {
                strongest.role.taskHistory.push(`absorbed: ${w.role.name}`);
                this.contributions = this.contributions.filter(c => c !== w);
                this.state.roles = this.state.roles.filter(r => r.id !== w.role.id);
                this.state.adaptations++;
            }
        }
    }
    async synthesize() {
        if (this.contributions.length === 0)
            return 'No contributions generated.';
        if (this.contributions.length === 1)
            return this.contributions[0].output;
        const contribText = this.contributions
            .map(c => `## ${c.role.name}\n${c.output}`)
            .join('\n\n---\n\n');
        try {
            const result = await runAgent(SYNTHESIS_PROMPT
                .replace('{task}', this.task)
                .replace('{contributions}', contribText), { agent: 'kernel', stream: false, skipPlanner: true });
            return result.content;
        }
        catch {
            return contribText;
        }
    }
}
//# sourceMappingURL=emergent-swarm.js.map