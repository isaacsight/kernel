// kbot Skill System — Auto-write reusable procedures after complex tasks
//
// Inspired by Hermes Agent's skill documents (agentskills.io standard)
//
// After a complex interaction (5+ tool calls), kbot writes a skill file:
//   ~/.kbot/skills/deploy-supabase-edge-function.md
//
// Next time a similar task comes up, the skill is found via keyword search
// and injected into the context — skipping re-derivation entirely.
//
// Skills are:
//   - Markdown files with structured metadata
//   - Self-patching (updated when execution reveals issues)
//   - Scored (success rate tracked)
//   - Searchable via FTS and keyword matching
//   - Compatible with agentskills.io standard
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, } from 'node:fs';
import { registerTool } from './tools/index.js';
const SKILLS_DIR = join(homedir(), '.kbot', 'skills');
function ensureDir() {
    if (!existsSync(SKILLS_DIR))
        mkdirSync(SKILLS_DIR, { recursive: true });
}
// ── Skill I/O ───────────────────────────────────────────────────────
function skillPath(id) {
    return join(SKILLS_DIR, `${id}.md`);
}
function slugify(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 60);
}
/** Parse a skill markdown file into a Skill object */
function parseSkill(content, id) {
    try {
        // Extract frontmatter (between --- markers)
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!fmMatch)
            return null;
        const fm = {};
        for (const line of fmMatch[1].split('\n')) {
            const [key, ...vals] = line.split(':');
            if (key && vals.length)
                fm[key.trim()] = vals.join(':').trim();
        }
        // Extract sections
        const sections = {};
        let currentSection = '';
        const body = content.slice(fmMatch[0].length).trim();
        for (const line of body.split('\n')) {
            if (line.startsWith('## ')) {
                currentSection = line.slice(3).trim().toLowerCase();
                sections[currentSection] = [];
            }
            else if (currentSection && line.startsWith('- ')) {
                sections[currentSection].push(line.slice(2).trim());
            }
            else if (currentSection && line.match(/^\d+\./)) {
                sections[currentSection].push(line.replace(/^\d+\.\s*/, '').trim());
            }
        }
        return {
            id,
            title: fm.title || id,
            description: fm.description || '',
            keywords: (fm.keywords || '').split(',').map(k => k.trim()).filter(Boolean),
            domain: fm.domain || 'general',
            steps: sections.steps || sections.procedure || [],
            issues: sections.issues || sections['common issues'] || [],
            tools: (fm.tools || '').split(',').map(t => t.trim()).filter(Boolean),
            successRate: parseFloat(fm.success_rate || '0.5'),
            executions: parseInt(fm.executions || '0'),
            version: parseInt(fm.version || '1'),
            created: fm.created || new Date().toISOString(),
            lastUsed: fm.last_used || '',
            lastPatched: fm.last_patched || '',
        };
    }
    catch {
        return null;
    }
}
/** Serialize a Skill to markdown */
function serializeSkill(skill) {
    const lines = [
        '---',
        `title: ${skill.title}`,
        `description: ${skill.description}`,
        `keywords: ${skill.keywords.join(', ')}`,
        `domain: ${skill.domain}`,
        `tools: ${skill.tools.join(', ')}`,
        `success_rate: ${skill.successRate.toFixed(2)}`,
        `executions: ${skill.executions}`,
        `version: ${skill.version}`,
        `created: ${skill.created}`,
        `last_used: ${skill.lastUsed}`,
        `last_patched: ${skill.lastPatched}`,
        '---',
        '',
        `# ${skill.title}`,
        '',
        `${skill.description}`,
        '',
        '## Steps',
        '',
    ];
    skill.steps.forEach((step, i) => {
        lines.push(`${i + 1}. ${step}`);
    });
    if (skill.issues.length > 0) {
        lines.push('', '## Common Issues', '');
        for (const issue of skill.issues) {
            lines.push(`- ${issue}`);
        }
    }
    lines.push('');
    return lines.join('\n');
}
// ── Core API ────────────────────────────────────────────────────────
/** List all skills */
export function listSkills(domain) {
    ensureDir();
    const files = readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md'));
    const skills = [];
    for (const file of files) {
        const id = file.replace('.md', '');
        const content = readFileSync(join(SKILLS_DIR, file), 'utf-8');
        const skill = parseSkill(content, id);
        if (skill && (!domain || skill.domain === domain)) {
            skills.push(skill);
        }
    }
    return skills.sort((a, b) => b.successRate - a.successRate);
}
/** Find skills matching a query */
export function findSkills(query, domain) {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const all = listSkills(domain);
    return all
        .map(skill => {
        // Score based on keyword overlap + title/description match
        const titleWords = skill.title.toLowerCase().split(/\s+/);
        const descWords = skill.description.toLowerCase().split(/\s+/);
        const allSkillWords = [...skill.keywords, ...titleWords, ...descWords];
        const matchCount = words.filter(w => allSkillWords.some(sw => sw.includes(w) || w.includes(sw))).length;
        const score = words.length > 0 ? matchCount / words.length : 0;
        return { skill, score };
    })
        .filter(s => s.score > 0.3)
        .sort((a, b) => b.score - a.score)
        .map(s => s.skill);
}
/** Get a specific skill by ID */
export function getSkill(id) {
    const path = skillPath(id);
    if (!existsSync(path))
        return null;
    const content = readFileSync(path, 'utf-8');
    return parseSkill(content, id);
}
/** Create a new skill from a completed task */
export function createSkill(input) {
    ensureDir();
    const id = slugify(input.title);
    const skill = {
        id,
        title: input.title,
        description: input.description,
        keywords: input.keywords,
        domain: input.domain,
        steps: input.steps,
        issues: input.issues || [],
        tools: input.tools,
        successRate: 0.5,
        executions: 0,
        version: 1,
        created: new Date().toISOString(),
        lastUsed: '',
        lastPatched: '',
    };
    writeFileSync(skillPath(id), serializeSkill(skill));
    return skill;
}
/** Record a skill execution (success or failure) */
export function recordSkillExecution(id, success) {
    const skill = getSkill(id);
    if (!skill)
        return;
    skill.executions++;
    skill.lastUsed = new Date().toISOString();
    // Update success rate (exponential moving average)
    const alpha = 0.2;
    skill.successRate = skill.successRate * (1 - alpha) + (success ? 1 : 0) * alpha;
    writeFileSync(skillPath(id), serializeSkill(skill));
}
/** Patch a skill (update steps, add issues) */
export function patchSkill(id, patches) {
    const skill = getSkill(id);
    if (!skill)
        return;
    if (patches.replaceSteps) {
        skill.steps = patches.replaceSteps;
    }
    if (patches.addSteps) {
        skill.steps.push(...patches.addSteps);
    }
    if (patches.removeSteps) {
        skill.steps = skill.steps.filter(s => !patches.removeSteps.some(r => s.toLowerCase().includes(r.toLowerCase())));
    }
    if (patches.addIssues) {
        skill.issues.push(...patches.addIssues);
    }
    skill.version++;
    skill.lastPatched = new Date().toISOString();
    writeFileSync(skillPath(id), serializeSkill(skill));
}
/** Delete a skill */
export function deleteSkill(id) {
    const path = skillPath(id);
    if (!existsSync(path))
        return false;
    unlinkSync(path);
    return true;
}
// ── Auto-Skill Extraction ───────────────────────────────────────────
/**
 * Analyze a tool call sequence and create a skill if it's complex enough.
 * Call this at the end of a conversation with the tool history.
 */
export function maybeCreateSkill(toolCalls, userMessage, domain = 'general') {
    // Only create skills for complex tasks (5+ tool calls)
    if (toolCalls.length < 5)
        return null;
    // Don't create duplicate skills
    const existing = findSkills(userMessage, domain);
    if (existing.length > 0 && existing[0])
        return null;
    // Extract steps from tool calls
    const steps = toolCalls.map(tc => {
        const argsStr = Object.entries(tc.args)
            .filter(([, v]) => v !== undefined && v !== '')
            .map(([k, v]) => `${k}="${v}"`)
            .join(', ');
        return `${tc.name}(${argsStr})`;
    });
    // Extract tools used
    const tools = [...new Set(toolCalls.map(tc => tc.name))];
    // Extract keywords from the user message
    const keywords = userMessage
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3)
        .slice(0, 10);
    // Generate title from user message
    const title = userMessage.slice(0, 80).replace(/[^a-zA-Z0-9\s-]/g, '').trim();
    return createSkill({
        title,
        description: `Auto-generated skill from: "${userMessage.slice(0, 120)}"`,
        keywords,
        domain,
        steps,
        tools,
    });
}
// ── Tool Registration ───────────────────────────────────────────────
export function registerSkillTools() {
    registerTool({
        name: 'skill_manage',
        description: 'Manage kbot\'s reusable skills — learned procedures that persist across sessions. Skills are auto-created after complex tasks and self-patch when issues are found.',
        parameters: {
            action: { type: 'string', description: '"list", "find", "get", "create", "patch", "delete", "report"', required: true },
            query: { type: 'string', description: 'Search query (for find), skill ID (for get/patch/delete)' },
            domain: { type: 'string', description: 'Filter by domain: general, music, code, research, devops, security' },
            title: { type: 'string', description: 'Skill title (for create)' },
            steps: { type: 'string', description: 'JSON array of step strings (for create/patch)' },
            keywords: { type: 'string', description: 'Comma-separated keywords (for create)' },
            issue: { type: 'string', description: 'Issue to add (for patch)' },
        },
        tier: 'free',
        timeout: 5_000,
        async execute(args) {
            const action = String(args.action).toLowerCase();
            switch (action) {
                case 'list': {
                    const skills = listSkills(args.domain ? String(args.domain) : undefined);
                    if (skills.length === 0)
                        return 'No skills found. Skills are auto-created after complex tasks (5+ tool calls).';
                    return `## Skills (${skills.length})\n\n` +
                        skills.map(s => `**${s.id}** (v${s.version}) — ${s.description}\n  ` +
                            `Success: ${(s.successRate * 100).toFixed(0)}% | Used: ${s.executions}x | Domain: ${s.domain}`).join('\n\n');
                }
                case 'find':
                case 'search': {
                    const query = String(args.query || '');
                    if (!query)
                        return 'Provide a search query.';
                    const results = findSkills(query, args.domain ? String(args.domain) : undefined);
                    if (results.length === 0)
                        return `No skills matching "${query}".`;
                    return results.map(s => `**${s.id}** — ${s.description}\n` +
                        s.steps.map((step, i) => `  ${i + 1}. ${step}`).join('\n')).join('\n\n');
                }
                case 'get': {
                    const id = String(args.query || '');
                    const skill = getSkill(id);
                    if (!skill)
                        return `Skill "${id}" not found.`;
                    return serializeSkill(skill);
                }
                case 'create': {
                    const title = String(args.title || '');
                    if (!title)
                        return 'Provide a title.';
                    let steps = [];
                    try {
                        steps = JSON.parse(String(args.steps || '[]'));
                    }
                    catch {
                        return 'Invalid steps JSON.';
                    }
                    const keywords = (args.keywords ? String(args.keywords) : '').split(',').map(k => k.trim()).filter(Boolean);
                    const skill = createSkill({
                        title,
                        description: title,
                        keywords,
                        domain: String(args.domain || 'general'),
                        steps,
                        tools: [],
                    });
                    return `Created skill: **${skill.id}** (v${skill.version})`;
                }
                case 'patch': {
                    const id = String(args.query || '');
                    if (!id)
                        return 'Provide skill ID.';
                    const patches = {};
                    if (args.steps) {
                        try {
                            patches.replaceSteps = JSON.parse(String(args.steps));
                        }
                        catch { }
                    }
                    if (args.issue) {
                        patches.addIssues = [String(args.issue)];
                    }
                    patchSkill(id, patches);
                    return `Patched skill: **${id}**`;
                }
                case 'delete': {
                    const id = String(args.query || '');
                    return deleteSkill(id) ? `Deleted: ${id}` : `Not found: ${id}`;
                }
                case 'report': {
                    const skills = listSkills();
                    const total = skills.length;
                    const byDomain = {};
                    let totalExec = 0;
                    let avgSuccess = 0;
                    for (const s of skills) {
                        byDomain[s.domain] = (byDomain[s.domain] || 0) + 1;
                        totalExec += s.executions;
                        avgSuccess += s.successRate;
                    }
                    if (total > 0)
                        avgSuccess /= total;
                    return [
                        `## Skill Report`,
                        `Total: ${total} skills | ${totalExec} executions | Avg success: ${(avgSuccess * 100).toFixed(0)}%`,
                        '',
                        'By domain:',
                        ...Object.entries(byDomain).map(([d, c]) => `  ${d}: ${c}`),
                    ].join('\n');
                }
                default:
                    return 'Unknown action. Use: list, find, get, create, patch, delete, report.';
            }
        },
    });
}
//# sourceMappingURL=skill-system.js.map