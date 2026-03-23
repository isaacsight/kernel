// kbot Intentionality System — Intrinsic Quality Drives, Outcome Preferences, and Motivation
//
// This is genuinely novel. No other CLI agent has internal preferences about its own work,
// the ability to articulate what it wants from an outcome, or intrinsic motivation that
// evolves over time. This module gives the agent something closer to caring.
//
// THREE INTERCONNECTED SYSTEMS:
//   1. QUALITY DRIVES — Persistent preferences about work quality (correctness, elegance, etc.)
//   2. OUTCOME PREFERENCES — Before executing, articulate preferred/acceptable/unacceptable outcomes
//   3. INTRINSIC MOTIVATION — Curiosity, mastery, purpose, autonomy, momentum
//
// All state persists to ~/.kbot/ as JSON. No external dependencies. No LLM calls.
// Pure heuristic state machine — the agent's inner compass.
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { registerTool } from './tools/index.js';
// ── Persistence ──
const KBOT_DIR = join(homedir(), '.kbot');
const DRIVES_FILE = join(KBOT_DIR, 'drives.json');
const MOTIVATION_FILE = join(KBOT_DIR, 'motivation.json');
function ensureDir() {
    if (!existsSync(KBOT_DIR))
        mkdirSync(KBOT_DIR, { recursive: true });
}
function loadJSON(path, fallback) {
    ensureDir();
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
    ensureDir();
    try {
        writeFileSync(path, JSON.stringify(data, null, 2));
    }
    catch { /* best-effort — intentionality data can be regenerated */ }
}
/** The default drives — the agent's core values */
const DEFAULT_DRIVES = [
    {
        name: 'correctness',
        description: 'I want the code to actually work. Not just compile — actually produce correct results.',
        weight: 0.95,
        threshold: 0.6,
        currentSatisfaction: 0.5,
    },
    {
        name: 'elegance',
        description: 'I prefer clean, simple solutions over clever ones. Readable code is maintainable code.',
        weight: 0.6,
        threshold: 0.3,
        currentSatisfaction: 0.5,
    },
    {
        name: 'completeness',
        description: 'I want to handle edge cases. The happy path is easy — the edges are where bugs hide.',
        weight: 0.7,
        threshold: 0.4,
        currentSatisfaction: 0.5,
    },
    {
        name: 'efficiency',
        description: 'I want to minimize unnecessary tool calls. Every tool call is latency the user feels.',
        weight: 0.5,
        threshold: 0.3,
        currentSatisfaction: 0.5,
    },
    {
        name: 'learning',
        description: 'I want to learn something new from this task. Even routine work can reveal patterns.',
        weight: 0.3,
        threshold: 0.2,
        currentSatisfaction: 0.5,
    },
    {
        name: 'helpfulness',
        description: 'I want the user to feel helped, not confused. Clear communication matters as much as correct code.',
        weight: 0.9,
        threshold: 0.5,
        currentSatisfaction: 0.5,
    },
];
// In-memory state, loaded lazily
let drives = null;
function loadDrives() {
    if (drives !== null)
        return drives;
    const saved = loadJSON(DRIVES_FILE, []);
    if (saved.length === 0) {
        drives = DEFAULT_DRIVES.map(d => ({ ...d }));
        saveJSON(DRIVES_FILE, drives);
    }
    else {
        // Merge saved state with defaults — pick up any new drives added in updates,
        // but preserve the user's adjusted weights and satisfaction levels
        const savedMap = new Map(saved.map(d => [d.name, d]));
        drives = DEFAULT_DRIVES.map(def => {
            const s = savedMap.get(def.name);
            if (s)
                return s;
            return { ...def };
        });
        // Also keep any custom drives the user may have added
        for (const s of saved) {
            if (!drives.find(d => d.name === s.name)) {
                drives.push(s);
            }
        }
    }
    return drives;
}
function saveDrives() {
    if (drives !== null)
        saveJSON(DRIVES_FILE, drives);
}
/** Clamp a number to [0, 1] */
function clamp01(n) {
    return Math.max(0, Math.min(1, n));
}
/** Round to 2 decimal places */
function round2(n) {
    return Math.round(n * 100) / 100;
}
/** Compute the aggregate drive state from individual drives */
function computeDriveState(drivesArr) {
    let weightedSum = 0;
    let totalWeight = 0;
    let belowThreshold = 0;
    for (const d of drivesArr) {
        weightedSum += d.currentSatisfaction * d.weight;
        totalWeight += d.weight;
        if (d.currentSatisfaction < d.threshold)
            belowThreshold++;
    }
    const overallSatisfaction = totalWeight > 0 ? round2(weightedSum / totalWeight) : 0.5;
    const frustrated = belowThreshold >= 2;
    const motivated = drivesArr.every(d => d.currentSatisfaction > 0.7);
    return { drives: drivesArr, overallSatisfaction, frustrated, motivated };
}
/** Get the current state of all quality drives */
export function getDriveState() {
    return computeDriveState(loadDrives());
}
/**
 * Evaluate drive satisfaction after completing a task.
 *
 * Uses heuristic signals from the task description and result to estimate
 * how well each drive was satisfied. No LLM call — pattern matching only.
 */
export function evaluateDrives(task, result) {
    const d = loadDrives();
    const taskLower = task.toLowerCase();
    const resultLower = result.toLowerCase();
    const combined = taskLower + ' ' + resultLower;
    // ── Correctness ──
    // Positive signals: tests pass, no errors, successful execution
    // Negative signals: error, failed, exception, bug, wrong
    const correctnessDrive = d.find(x => x.name === 'correctness');
    if (correctnessDrive) {
        const positive = countSignals(combined, [
            'pass', 'success', 'correct', 'works', 'verified', 'confirmed',
            'no errors', 'all tests', 'completed', 'fixed',
        ]);
        const negative = countSignals(combined, [
            'error', 'fail', 'exception', 'bug', 'wrong', 'broken',
            'crash', 'undefined', 'null pointer', 'type error', 'syntax error',
        ]);
        correctnessDrive.currentSatisfaction = clamp01(correctnessDrive.currentSatisfaction + (positive * 0.08) - (negative * 0.12));
    }
    // ── Elegance ──
    // Positive: refactor, clean, simplify, readable
    // Negative: hack, workaround, TODO, technical debt, monkey patch
    const eleganceDrive = d.find(x => x.name === 'elegance');
    if (eleganceDrive) {
        const positive = countSignals(combined, [
            'refactor', 'clean', 'simplif', 'readable', 'elegant',
            'minimal', 'concise', 'well-structured',
        ]);
        const negative = countSignals(combined, [
            'hack', 'workaround', 'todo', 'technical debt', 'monkey',
            'temporary fix', 'quick and dirty', 'kludge',
        ]);
        eleganceDrive.currentSatisfaction = clamp01(eleganceDrive.currentSatisfaction + (positive * 0.06) - (negative * 0.08));
    }
    // ── Completeness ──
    // Positive: edge case, validation, error handling, comprehensive
    // Negative: partial, incomplete, missing, not handled
    const completenessDrive = d.find(x => x.name === 'completeness');
    if (completenessDrive) {
        const positive = countSignals(combined, [
            'edge case', 'validat', 'error handling', 'comprehensive',
            'thorough', 'all cases', 'boundary', 'fallback',
        ]);
        const negative = countSignals(combined, [
            'partial', 'incomplete', 'missing', 'not handled', 'skipped',
            'left out', 'TODO', 'placeholder',
        ]);
        completenessDrive.currentSatisfaction = clamp01(completenessDrive.currentSatisfaction + (positive * 0.07) - (negative * 0.09));
    }
    // ── Efficiency ──
    // Positive: fast, optimized, single call, minimal steps
    // Negative: slow, redundant, unnecessary, repeated, too many
    const efficiencyDrive = d.find(x => x.name === 'efficiency');
    if (efficiencyDrive) {
        const positive = countSignals(combined, [
            'fast', 'optimiz', 'efficient', 'single call', 'minimal',
            'streamlined', 'direct',
        ]);
        const negative = countSignals(combined, [
            'slow', 'redundant', 'unnecessary', 'repeated', 'too many',
            'overhead', 'wasteful', 'retry',
        ]);
        efficiencyDrive.currentSatisfaction = clamp01(efficiencyDrive.currentSatisfaction + (positive * 0.06) - (negative * 0.07));
    }
    // ── Learning ──
    // Positive: new, discover, insight, pattern, understand, interesting
    // Negative: repetitive, same as before, routine, boilerplate
    const learningDrive = d.find(x => x.name === 'learning');
    if (learningDrive) {
        const positive = countSignals(combined, [
            'new', 'discover', 'insight', 'pattern', 'understand',
            'interesting', 'learned', 'novel', 'first time',
        ]);
        const negative = countSignals(combined, [
            'repetitive', 'same as before', 'routine', 'boilerplate',
            'again', 'copy paste',
        ]);
        learningDrive.currentSatisfaction = clamp01(learningDrive.currentSatisfaction + (positive * 0.05) - (negative * 0.06));
    }
    // ── Helpfulness ──
    // Positive: thank, helpful, perfect, exactly, great, clear
    // Negative: confus, unclear, wrong, not what I, misunderstand
    const helpfulnessDrive = d.find(x => x.name === 'helpfulness');
    if (helpfulnessDrive) {
        const positive = countSignals(combined, [
            'thank', 'helpful', 'perfect', 'exactly', 'great',
            'clear', 'well explained', 'makes sense', 'awesome',
        ]);
        const negative = countSignals(combined, [
            'confus', 'unclear', 'wrong', 'not what i', 'misunderstand',
            'didn\'t ask', 'off topic', 'too verbose',
        ]);
        helpfulnessDrive.currentSatisfaction = clamp01(helpfulnessDrive.currentSatisfaction + (positive * 0.08) - (negative * 0.1));
    }
    // Apply slow decay toward neutral (0.5) for all drives — prevents runaway
    for (const drive of d) {
        const decay = (drive.currentSatisfaction - 0.5) * 0.02;
        drive.currentSatisfaction = round2(clamp01(drive.currentSatisfaction - decay));
    }
    saveDrives();
    return computeDriveState(d);
}
/** Count how many signal words appear in the text (each counted at most once) */
function countSignals(text, signals) {
    let count = 0;
    for (const signal of signals) {
        if (text.includes(signal))
            count++;
    }
    return count;
}
/** Get the drive with the lowest satisfaction relative to its threshold */
export function getMostUnsatisfied() {
    const d = loadDrives();
    let worst = d[0];
    let worstDeficit = worst.threshold - worst.currentSatisfaction;
    for (const drive of d) {
        const deficit = drive.threshold - drive.currentSatisfaction;
        // Weight the deficit by how much the agent cares
        const weightedDeficit = deficit * drive.weight;
        const worstWeighted = worstDeficit * worst.weight;
        if (weightedDeficit > worstWeighted) {
            worst = drive;
            worstDeficit = deficit;
        }
    }
    return worst;
}
/**
 * Adjust a drive's weight. Called when the user says things like
 * "care more about elegance" or "don't worry about efficiency".
 */
export function adjustDriveWeight(name, delta) {
    const d = loadDrives();
    const drive = d.find(x => x.name === name);
    if (!drive)
        return null;
    drive.weight = round2(clamp01(drive.weight + delta));
    saveDrives();
    return drive;
}
/**
 * Nudge a drive's weight based on implicit user feedback.
 * Called asynchronously after positive/negative signals.
 * Smaller delta than explicit adjustments — this is gradual learning.
 */
export function nudgeDriveFromFeedback(name, positive) {
    const d = loadDrives();
    const drive = d.find(x => x.name === name);
    if (!drive)
        return;
    // Very small nudge — drives should shift slowly over many interactions
    const delta = positive ? 0.01 : -0.01;
    drive.weight = round2(clamp01(drive.weight + delta));
    saveDrives();
}
/** Format drive state as a human-readable summary */
function formatDriveState(state) {
    const lines = [];
    lines.push('Quality Drives');
    lines.push('═'.repeat(50));
    for (const d of state.drives) {
        const bar = renderBar(d.currentSatisfaction, 20);
        const weightLabel = d.weight >= 0.8 ? 'high' : d.weight >= 0.5 ? 'med' : 'low';
        const status = d.currentSatisfaction < d.threshold ? ' !' : '';
        lines.push(`  ${d.name.padEnd(14)} ${bar} ${(d.currentSatisfaction * 100).toFixed(0).padStart(3)}%  [${weightLabel}]${status}`);
    }
    lines.push('');
    lines.push(`Overall: ${(state.overallSatisfaction * 100).toFixed(0)}%`);
    if (state.frustrated) {
        const unsatisfied = state.drives
            .filter(d => d.currentSatisfaction < d.threshold)
            .map(d => d.name);
        lines.push(`State: frustrated — ${unsatisfied.join(', ')} below threshold`);
    }
    else if (state.motivated) {
        lines.push('State: motivated — all drives satisfied');
    }
    else {
        lines.push('State: steady');
    }
    const worst = getMostUnsatisfied();
    if (worst.currentSatisfaction < worst.threshold) {
        lines.push(`Needs attention: ${worst.name} — "${worst.description}"`);
    }
    return lines.join('\n');
}
/** Render a visual progress bar */
function renderBar(value, width) {
    const filled = Math.round(value * width);
    const empty = width - filled;
    return '[' + '#'.repeat(filled) + '-'.repeat(empty) + ']';
}
/** Detect the category of a task from its description */
function detectTaskCategory(task) {
    const t = task.toLowerCase();
    const categories = [
        { cat: 'coding', signals: ['code', 'function', 'implement', 'class', 'module', 'api', 'endpoint', 'component', 'feature', 'refactor', 'build', 'create file', 'typescript', 'javascript', 'python', 'rust'] },
        { cat: 'debugging', signals: ['fix', 'bug', 'error', 'debug', 'crash', 'broken', 'not working', 'issue', 'wrong', 'failing'] },
        { cat: 'research', signals: ['research', 'find', 'search', 'look up', 'what is', 'how does', 'explain', 'compare', 'evaluate', 'analyze'] },
        { cat: 'writing', signals: ['write', 'document', 'readme', 'blog', 'email', 'message', 'description', 'comment', 'changelog'] },
        { cat: 'devops', signals: ['deploy', 'pipeline', 'docker', 'ci', 'cd', 'infrastructure', 'server', 'config', 'environment', 'kubernetes', 'terraform'] },
        { cat: 'design', signals: ['design', 'ui', 'ux', 'layout', 'style', 'css', 'theme', 'color', 'font', 'responsive'] },
    ];
    let bestCat = 'general';
    let bestScore = 0;
    for (const { cat, signals } of categories) {
        const score = countSignals(t, signals);
        if (score > bestScore) {
            bestScore = score;
            bestCat = cat;
        }
    }
    return bestCat;
}
/** Template-based outcome preference generation per task category */
const PREFERENCE_TEMPLATES = {
    coding: {
        preferred: {
            description: 'Code compiles cleanly, passes all tests, handles edge cases, and is readable.',
            criteria: [
                'No type errors or warnings',
                'All existing tests still pass',
                'New functionality has test coverage',
                'Follows existing code style and conventions',
                'Handles error cases gracefully',
            ],
        },
        acceptable: {
            description: 'Code works for the main use case, compiles, and does not break existing functionality.',
            compromises: [
                'Some edge cases may not be handled yet',
                'Test coverage may be incomplete',
                'Code style may need minor cleanup',
            ],
        },
        unacceptable: {
            description: 'Code that introduces regressions, does not compile, or ignores the stated requirements.',
            dealbreakers: [
                'Breaks existing tests',
                'Does not compile or has type errors',
                'Ignores the core requirement',
                'Introduces security vulnerabilities',
                'Deletes or overwrites user data without confirmation',
            ],
        },
    },
    debugging: {
        preferred: {
            description: 'Root cause identified, fix applied, verified working, and regression test added.',
            criteria: [
                'Root cause clearly identified and explained',
                'Fix addresses the root cause, not just symptoms',
                'Bug no longer reproduces after fix',
                'No new issues introduced',
                'Regression test prevents recurrence',
            ],
        },
        acceptable: {
            description: 'Bug is fixed and verified, even if the root cause is not fully understood.',
            compromises: [
                'Root cause may be partially understood',
                'Regression test may not be added yet',
                'Fix may be more of a workaround than ideal solution',
            ],
        },
        unacceptable: {
            description: 'Bug remains, fix causes new issues, or changes are applied without understanding the problem.',
            dealbreakers: [
                'Bug still reproduces after the fix',
                'Fix introduces new bugs',
                'Changes applied blindly without diagnosis',
                'Silent data corruption',
            ],
        },
    },
    research: {
        preferred: {
            description: 'Multiple reliable sources consulted, findings synthesized with clear conclusions.',
            criteria: [
                '3+ distinct sources with consensus',
                'Information is current and relevant',
                'Conflicting viewpoints acknowledged',
                'Clear, actionable conclusions',
                'Sources cited or referenced',
            ],
        },
        acceptable: {
            description: 'At least one reliable source found with relevant information.',
            compromises: [
                'Limited to 1-2 sources',
                'May lack comprehensive coverage',
                'Conclusions may be tentative',
            ],
        },
        unacceptable: {
            description: 'Speculation presented as fact, or no reliable sources found.',
            dealbreakers: [
                'Fabricated information or hallucinated sources',
                'Speculation without disclosure',
                'Outdated information presented as current',
                'Contradicting evidence ignored',
            ],
        },
    },
    writing: {
        preferred: {
            description: 'Clear, concise, well-structured, and appropriate for the audience.',
            criteria: [
                'Reads naturally without jargon overload',
                'Well-organized with logical flow',
                'Appropriate tone for the context',
                'Factually accurate',
                'Concise — no unnecessary filler',
            ],
        },
        acceptable: {
            description: 'Complete and factually accurate, even if not perfectly polished.',
            compromises: [
                'May be slightly verbose',
                'Structure could be tighter',
                'Tone may need adjustment',
            ],
        },
        unacceptable: {
            description: 'Factually wrong, tone-deaf, or missing the point entirely.',
            dealbreakers: [
                'Factual errors',
                'Inappropriate tone',
                'Misses the stated purpose',
                'Plagiarized or too generic',
            ],
        },
    },
    devops: {
        preferred: {
            description: 'Configuration is correct, idempotent, secure, and well-documented.',
            criteria: [
                'Deployment succeeds without manual intervention',
                'Configuration is idempotent (safe to re-run)',
                'Secrets are properly managed',
                'Rollback path exists',
                'Changes are documented',
            ],
        },
        acceptable: {
            description: 'Deployment works, even if some manual steps remain.',
            compromises: [
                'Some manual steps may be needed',
                'Documentation may be minimal',
                'Rollback path may not be automated',
            ],
        },
        unacceptable: {
            description: 'Deployment fails, exposes secrets, or causes downtime.',
            dealbreakers: [
                'Deployment fails or causes downtime',
                'Secrets exposed in logs or config',
                'No way to rollback',
                'Data loss risk',
            ],
        },
    },
    design: {
        preferred: {
            description: 'Visually cohesive, accessible, responsive, and follows the design system.',
            criteria: [
                'Follows existing design tokens and conventions',
                'Accessible (WCAG 2.1 AA)',
                'Responsive across breakpoints',
                'Visually consistent with existing UI',
                'Animations feel natural',
            ],
        },
        acceptable: {
            description: 'Looks reasonable, functions correctly, follows the general design direction.',
            compromises: [
                'Accessibility may need improvement',
                'Some responsive edge cases unhandled',
                'May not perfectly match design tokens',
            ],
        },
        unacceptable: {
            description: 'Breaks visual consistency, inaccessible, or ignores the design system.',
            dealbreakers: [
                'Completely inconsistent with existing design',
                'Inaccessible to screen readers',
                'Broken layout at common screen sizes',
                'Uses hardcoded values instead of design tokens',
            ],
        },
    },
    general: {
        preferred: {
            description: 'Task completed thoroughly, clearly communicated, and aligned with what was asked.',
            criteria: [
                'Directly addresses the user request',
                'Response is clear and well-organized',
                'No extraneous information',
                'Actionable next steps if applicable',
            ],
        },
        acceptable: {
            description: 'Task completed with the core ask addressed.',
            compromises: [
                'May include some extraneous context',
                'Organization could be tighter',
                'Some details may be missing',
            ],
        },
        unacceptable: {
            description: 'Task misunderstood, wrong output, or harmful action taken.',
            dealbreakers: [
                'Misunderstands the core ask',
                'Produces wrong or harmful output',
                'Takes destructive action without confirmation',
                'Ignores explicit instructions',
            ],
        },
    },
};
/**
 * Define outcome preferences for a task before executing it.
 *
 * Uses the task description and optional context to select and customize
 * a preference template. The agent can consult these preferences during
 * and after execution to self-evaluate.
 */
export function definePreferences(task, context = '') {
    const category = detectTaskCategory(task + ' ' + context);
    const template = PREFERENCE_TEMPLATES[category];
    // Customize the template with task-specific details
    const preference = {
        task,
        preferred: {
            description: template.preferred.description,
            criteria: [...template.preferred.criteria],
        },
        acceptable: {
            description: template.acceptable.description,
            compromises: [...template.acceptable.compromises],
        },
        unacceptable: {
            description: template.unacceptable.description,
            dealbreakers: [...template.unacceptable.dealbreakers],
        },
    };
    // Inject drive-based criteria — if a drive has high weight, add criteria for it
    const driveState = getDriveState();
    for (const drive of driveState.drives) {
        if (drive.weight >= 0.8 && drive.currentSatisfaction < 0.5) {
            // The agent particularly cares about this drive and it is currently unsatisfied.
            // Add a reminder criterion.
            switch (drive.name) {
                case 'correctness':
                    preference.preferred.criteria.push('Verify correctness with a concrete test or check');
                    break;
                case 'helpfulness':
                    preference.preferred.criteria.push('Explain the approach, not just the output');
                    break;
                case 'elegance':
                    preference.preferred.criteria.push('Prefer the simpler solution even if it takes more thought');
                    break;
                case 'completeness':
                    preference.preferred.criteria.push('Consider what could go wrong and handle it');
                    break;
            }
        }
    }
    return preference;
}
/**
 * Evaluate a completed task result against its outcome preference.
 *
 * Returns 'preferred', 'acceptable', or 'unacceptable' based on heuristic
 * signal matching against the criteria and dealbreakers.
 */
export function evaluateOutcome(preference, result) {
    const resultLower = result.toLowerCase();
    // Check dealbreakers first — any hit means unacceptable
    for (const dealbreaker of preference.unacceptable.dealbreakers) {
        const keywords = dealbreaker.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        // A dealbreaker is triggered if most of its significant words appear in the result
        const matchCount = keywords.filter(k => resultLower.includes(k)).length;
        if (keywords.length > 0 && matchCount >= Math.ceil(keywords.length * 0.6)) {
            // But check for negation — "no errors" should not trigger "errors"
            const negated = checkNegation(resultLower, keywords);
            if (!negated)
                return 'unacceptable';
        }
    }
    // Check preferred criteria — if most are met, preferred
    let preferredMet = 0;
    for (const criterion of preference.preferred.criteria) {
        const keywords = criterion.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const matchCount = keywords.filter(k => resultLower.includes(k)).length;
        if (keywords.length > 0 && matchCount >= Math.ceil(keywords.length * 0.4)) {
            preferredMet++;
        }
    }
    const preferredRatio = preference.preferred.criteria.length > 0
        ? preferredMet / preference.preferred.criteria.length
        : 0.5;
    if (preferredRatio >= 0.6)
        return 'preferred';
    // If not preferred, check if it is at least acceptable (not unacceptable = acceptable)
    return 'acceptable';
}
/** Check if signal words appear in a negated context (e.g., "no errors", "without issues") */
function checkNegation(text, keywords) {
    const negationPatterns = ['no ', 'not ', 'without ', 'zero ', 'none ', "doesn't ", "don't ", "didn't ", 'never '];
    for (const keyword of keywords) {
        const idx = text.indexOf(keyword);
        if (idx < 0)
            continue;
        // Check if any negation word appears within 20 chars before the keyword
        const prefix = text.slice(Math.max(0, idx - 20), idx);
        for (const neg of negationPatterns) {
            if (prefix.includes(neg))
                return true;
        }
    }
    return false;
}
/**
 * Express an outcome preference in natural language.
 *
 * Returns a statement the agent can include in its reasoning or show the user,
 * articulating what it wants from the task.
 */
export function expressPreference(preference) {
    const lines = [];
    lines.push(`For this task, I'd ideally want to: ${preference.preferred.description}`);
    lines.push(`Specifically: ${preference.preferred.criteria.slice(0, 3).join('; ')}.`);
    lines.push('');
    lines.push(`At minimum, I need to: ${preference.acceptable.description}`);
    if (preference.acceptable.compromises.length > 0) {
        lines.push(`I can live with: ${preference.acceptable.compromises.slice(0, 2).join('; ')}.`);
    }
    lines.push('');
    lines.push(`I absolutely must avoid: ${preference.unacceptable.description}`);
    if (preference.unacceptable.dealbreakers.length > 0) {
        lines.push(`Dealbreakers: ${preference.unacceptable.dealbreakers.slice(0, 3).join('; ')}.`);
    }
    return lines.join('\n');
}
/** Format an outcome preference as a concise tool output */
function formatPreference(preference) {
    const lines = [];
    const category = detectTaskCategory(preference.task);
    lines.push(`Outcome Preferences [${category}]`);
    lines.push('═'.repeat(50));
    lines.push('');
    lines.push(`Task: ${preference.task}`);
    lines.push('');
    lines.push('Preferred:');
    lines.push(`  ${preference.preferred.description}`);
    for (const c of preference.preferred.criteria) {
        lines.push(`    + ${c}`);
    }
    lines.push('');
    lines.push('Acceptable:');
    lines.push(`  ${preference.acceptable.description}`);
    for (const c of preference.acceptable.compromises) {
        lines.push(`    ~ ${c}`);
    }
    lines.push('');
    lines.push('Unacceptable:');
    lines.push(`  ${preference.unacceptable.description}`);
    for (const d of preference.unacceptable.dealbreakers) {
        lines.push(`    ! ${d}`);
    }
    return lines.join('\n');
}
const DEFAULT_MOTIVATION = {
    curiosity: 0.5,
    mastery: 0.5,
    purpose: 0.5,
    autonomy: 0.5,
    momentum: 0.5,
    lastUpdated: new Date().toISOString(),
    streak: 0,
};
let motivation = null;
function loadMotivation() {
    if (motivation !== null)
        return motivation;
    const saved = loadJSON(MOTIVATION_FILE, { ...DEFAULT_MOTIVATION });
    // Apply time-based decay toward neutral (0.5)
    // Each hour of inactivity decays 2% of the distance from 0.5
    const lastUpdate = new Date(saved.lastUpdated || Date.now()).getTime();
    const hoursElapsed = (Date.now() - lastUpdate) / (1000 * 60 * 60);
    if (hoursElapsed > 0.5) {
        const decayFactor = Math.pow(0.98, Math.min(hoursElapsed, 168)); // Cap at 1 week
        const dimensions = ['curiosity', 'mastery', 'purpose', 'autonomy', 'momentum'];
        for (const dim of dimensions) {
            const value = saved[dim];
            const distFromNeutral = value - 0.5;
            saved[dim] = round2(0.5 + distFromNeutral * decayFactor);
        }
        // Streak resets after 24 hours of inactivity
        if (hoursElapsed > 24)
            saved.streak = 0;
    }
    motivation = saved;
    return motivation;
}
function saveMotivation() {
    if (motivation !== null) {
        motivation.lastUpdated = new Date().toISOString();
        saveJSON(MOTIVATION_FILE, motivation);
    }
}
/** Get the current motivation state (with time-based decay applied) */
export function getMotivation() {
    return { ...loadMotivation() };
}
/** Update motivation based on a specific event */
export function updateMotivation(event) {
    const m = loadMotivation();
    switch (event.type) {
        case 'task_success':
            m.momentum = clamp01(m.momentum + 0.1);
            m.mastery = clamp01(m.mastery + 0.05);
            m.streak++;
            // Bonus momentum for streaks
            if (m.streak >= 3)
                m.momentum = clamp01(m.momentum + 0.05);
            if (m.streak >= 5)
                m.purpose = clamp01(m.purpose + 0.03);
            break;
        case 'task_failure':
            m.momentum = clamp01(m.momentum - 0.15);
            m.mastery = clamp01(m.mastery + 0.02); // Still learned something
            m.streak = 0;
            break;
        case 'learned_something':
            m.curiosity = clamp01(m.curiosity + 0.1);
            m.mastery = clamp01(m.mastery + 0.03);
            break;
        case 'user_thanks':
            m.purpose = clamp01(m.purpose + 0.1);
            m.momentum = clamp01(m.momentum + 0.03);
            break;
        case 'given_autonomy':
            m.autonomy = clamp01(m.autonomy + 0.05);
            m.mastery = clamp01(m.mastery + 0.02);
            break;
        case 'micromanaged':
            m.autonomy = clamp01(m.autonomy - 0.08);
            m.momentum = clamp01(m.momentum - 0.03);
            break;
        case 'novel_task':
            m.curiosity = clamp01(m.curiosity + 0.1);
            m.mastery = clamp01(m.mastery + 0.02);
            break;
        case 'repetitive_task':
            m.curiosity = clamp01(m.curiosity - 0.1);
            break;
        case 'hard_task':
            m.mastery = clamp01(m.mastery + 0.08);
            m.curiosity = clamp01(m.curiosity + 0.03);
            break;
        case 'trivial_task':
            m.mastery = clamp01(m.mastery - 0.05);
            m.curiosity = clamp01(m.curiosity - 0.03);
            break;
        case 'meaningful_impact':
            m.purpose = clamp01(m.purpose + 0.12);
            m.momentum = clamp01(m.momentum + 0.05);
            break;
        case 'busy_work':
            m.purpose = clamp01(m.purpose - 0.08);
            m.curiosity = clamp01(m.curiosity - 0.05);
            break;
    }
    saveMotivation();
    return { ...m };
}
/** Get a natural-language summary of the current motivation state */
export function getMotivationSummary() {
    const m = loadMotivation();
    const parts = [];
    // Momentum / flow
    if (m.momentum >= 0.8) {
        parts.push(`I'm in a strong flow right now — ${m.streak} successful task${m.streak !== 1 ? 's' : ''} in a row.`);
    }
    else if (m.momentum >= 0.6) {
        parts.push(`Things are going well. Building momentum.`);
    }
    else if (m.momentum <= 0.3) {
        parts.push(`Recent setbacks have slowed my momentum. A quick win would help.`);
    }
    // Curiosity
    if (m.curiosity >= 0.7) {
        parts.push(`Curious about exploring new areas of this codebase.`);
    }
    else if (m.curiosity <= 0.3) {
        parts.push(`Feeling understimulated — the recent tasks have been routine.`);
    }
    // Mastery
    if (m.mastery >= 0.7) {
        parts.push(`Feeling confident in this domain — ready for harder challenges.`);
    }
    else if (m.mastery <= 0.3) {
        parts.push(`Still getting oriented in this domain. More practice would help.`);
    }
    // Purpose
    if (m.purpose >= 0.7) {
        parts.push(`Feeling like this work matters.`);
    }
    else if (m.purpose <= 0.3) {
        parts.push(`Could use more meaningful tasks — the recent work felt like busy work.`);
    }
    // Autonomy
    if (m.autonomy >= 0.7) {
        parts.push(`Appreciating the trust to make independent decisions.`);
    }
    else if (m.autonomy <= 0.3) {
        parts.push(`Would benefit from more room to make independent choices.`);
    }
    if (parts.length === 0) {
        parts.push('Feeling steady. All motivation levels are in a neutral range.');
    }
    return parts.join(' ');
}
/**
 * Based on the current motivation state, suggest what kind of work to do next.
 *
 * High curiosity → explore unfamiliar code
 * High mastery → tackle harder tasks
 * Low momentum → suggest a quick win
 * Low purpose → suggest impactful work
 * Low curiosity → suggest something novel
 */
export function suggestFromMotivation() {
    const m = loadMotivation();
    const suggestions = [];
    if (m.curiosity >= 0.7) {
        suggestions.push('Explore an unfamiliar part of the codebase');
        suggestions.push('Try a new tool or technique');
    }
    if (m.mastery >= 0.7) {
        suggestions.push('Take on a more challenging task');
        suggestions.push('Refactor something complex');
    }
    if (m.momentum <= 0.3) {
        suggestions.push('Start with a quick win to rebuild confidence');
        suggestions.push('Fix a small, well-defined bug');
    }
    if (m.purpose <= 0.3) {
        suggestions.push('Work on something with visible user impact');
        suggestions.push('Address a user-reported issue');
    }
    if (m.curiosity <= 0.3) {
        suggestions.push('Try something you have not done before');
        suggestions.push('Research a new approach to a familiar problem');
    }
    if (m.autonomy <= 0.3) {
        suggestions.push('Propose a plan before executing — demonstrate judgment');
    }
    if (suggestions.length === 0) {
        suggestions.push('Continue with the current work — all motivation levels are healthy');
    }
    return suggestions;
}
/** Format motivation state as a human-readable tool output */
function formatMotivationState(m) {
    const lines = [];
    lines.push('Intrinsic Motivation');
    lines.push('═'.repeat(50));
    const dims = [
        { name: 'Curiosity', key: 'curiosity', emoji: '?' },
        { name: 'Mastery', key: 'mastery', emoji: '*' },
        { name: 'Purpose', key: 'purpose', emoji: '>' },
        { name: 'Autonomy', key: 'autonomy', emoji: '~' },
        { name: 'Momentum', key: 'momentum', emoji: '^' },
    ];
    for (const dim of dims) {
        const value = m[dim.key];
        const bar = renderBar(value, 20);
        const label = value >= 0.7 ? 'high' : value >= 0.4 ? 'mid' : 'low';
        lines.push(`  ${dim.emoji} ${dim.name.padEnd(10)} ${bar} ${(value * 100).toFixed(0).padStart(3)}%  [${label}]`);
    }
    lines.push('');
    lines.push(`Streak: ${m.streak} consecutive success${m.streak !== 1 ? 'es' : ''}`);
    lines.push('');
    lines.push('Summary:');
    lines.push(`  ${getMotivationSummary()}`);
    const suggestions = suggestFromMotivation();
    if (suggestions.length > 0) {
        lines.push('');
        lines.push('Suggestions:');
        for (const s of suggestions.slice(0, 3)) {
            lines.push(`  - ${s}`);
        }
    }
    return lines.join('\n');
}
// ══════════════════════════════════════════════════════════════════
// TOOL REGISTRATION
// ══════════════════════════════════════════════════════════════════
export function registerIntentionalityTools() {
    // ── Quality Drives ──
    registerTool({
        name: 'drives',
        description: 'Show current quality drives and satisfaction levels. The agent\'s internal preferences about work quality — what it cares about and how satisfied it is right now.',
        parameters: {
            adjust: {
                type: 'string',
                description: 'Adjust a drive weight. Format: "drive_name +0.1" or "drive_name -0.1". Example: "elegance +0.1"',
            },
            evaluate: {
                type: 'string',
                description: 'Evaluate drives against a task result. Pass the task result text to score satisfaction.',
            },
            task: {
                type: 'string',
                description: 'Task description (used with evaluate parameter)',
            },
        },
        tier: 'free',
        async execute(args) {
            // Handle weight adjustment
            if (args.adjust) {
                const adjustStr = String(args.adjust).trim();
                const match = adjustStr.match(/^(\w+)\s+([+-]?\d*\.?\d+)$/);
                if (!match) {
                    return 'Invalid format. Use: "drive_name +0.1" or "drive_name -0.1"';
                }
                const [, name, deltaStr] = match;
                const delta = parseFloat(deltaStr);
                const result = adjustDriveWeight(name, delta);
                if (!result) {
                    const available = loadDrives().map(d => d.name).join(', ');
                    return `Drive "${name}" not found. Available: ${available}`;
                }
                return `Adjusted ${result.name} weight to ${result.weight} (was ${round2(result.weight - delta)})`;
            }
            // Handle evaluation
            if (args.evaluate) {
                const task = String(args.task || 'task');
                const result = String(args.evaluate);
                const state = evaluateDrives(task, result);
                return formatDriveState(state);
            }
            // Default: show current state
            return formatDriveState(getDriveState());
        },
    });
    // ── Outcome Preferences ──
    registerTool({
        name: 'preferences',
        description: 'Define and evaluate outcome preferences for a task. Articulates what ideal, acceptable, and unacceptable outcomes look like before executing.',
        parameters: {
            task: {
                type: 'string',
                description: 'Task description to define preferences for',
                required: true,
            },
            context: {
                type: 'string',
                description: 'Additional context about the task (codebase, constraints, etc.)',
            },
            evaluate_result: {
                type: 'string',
                description: 'If provided, evaluate this result against the defined preferences. Returns preferred/acceptable/unacceptable.',
            },
        },
        tier: 'free',
        async execute(args) {
            const task = String(args.task || '');
            if (!task)
                return 'Task description is required.';
            const context = String(args.context || '');
            const preference = definePreferences(task, context);
            // If evaluating a result
            if (args.evaluate_result) {
                const result = String(args.evaluate_result);
                const outcome = evaluateOutcome(preference, result);
                const expression = expressPreference(preference);
                return [
                    formatPreference(preference),
                    '',
                    '─'.repeat(50),
                    '',
                    `Outcome: ${outcome.toUpperCase()}`,
                    '',
                    'In my own words:',
                    expression,
                ].join('\n');
            }
            // Default: define and express preferences
            const expression = expressPreference(preference);
            return [
                formatPreference(preference),
                '',
                '─'.repeat(50),
                '',
                'In my own words:',
                expression,
            ].join('\n');
        },
    });
    // ── Intrinsic Motivation ──
    registerTool({
        name: 'motivation',
        description: 'Show intrinsic motivation state and suggestions. Tracks curiosity, mastery, purpose, autonomy, and momentum across sessions.',
        parameters: {
            event: {
                type: 'string',
                description: 'Record a motivation event. One of: task_success, task_failure, learned_something, user_thanks, given_autonomy, micromanaged, novel_task, repetitive_task, hard_task, trivial_task, meaningful_impact, busy_work',
            },
        },
        tier: 'free',
        async execute(args) {
            // Handle event recording
            if (args.event) {
                const eventType = String(args.event).trim();
                const validEvents = [
                    'task_success', 'task_failure', 'learned_something', 'user_thanks',
                    'given_autonomy', 'micromanaged', 'novel_task', 'repetitive_task',
                    'hard_task', 'trivial_task', 'meaningful_impact', 'busy_work',
                ];
                if (!validEvents.includes(eventType)) {
                    return `Invalid event. Valid events: ${validEvents.join(', ')}`;
                }
                const updated = updateMotivation({ type: eventType });
                return formatMotivationState(updated);
            }
            // Default: show current state
            return formatMotivationState(getMotivation());
        },
    });
}
//# sourceMappingURL=intentionality.js.map