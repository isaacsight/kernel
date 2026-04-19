// Skills Loader — Auto-discover and load skill documents
//
// Supports two formats:
//   1. kbot native:       ~/.kbot/skills/<name>.md                (flat)
//   2. agentskills.io:    ~/.kbot/skills/<category>/<name>/SKILL.md (Claude/Hermes/Copilot standard)
//
// Frontmatter fields recognized (either format):
//   name | title         — skill identifier
//   description          — 1-line "when to use this"
//   keywords | tags      — list for relevance matching
//   metadata.hermes.tags — agentskills.io tag list (Hermes/Claude)
//   domain               — kbot category
//
// Discovery locations (in priority order):
//   1. ./.kbot/skills/   — project-specific
//   2. ~/.kbot/skills/   — user global (includes imported Hermes/Claude skills)
//
// Token budget: 2000 tokens max. When a message is provided, skills are
// scored for relevance and only the top matches are injected — so a user
// with 200 imported skills doesn't blow the budget on irrelevant docs.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
/** Package-bundled skills directory — ships with the npm tarball. */
function getBundledSkillsDir() {
    // dist/skills-loader.js → ../skills  (package root)
    const here = dirname(fileURLToPath(import.meta.url));
    return join(here, '..', 'skills');
}
const MAX_SKILL_TOKENS = 2000;
const MAX_SKILLS_WITHOUT_MESSAGE = 6; // unfiltered cap
const MAX_SKILLS_WITH_MESSAGE = 4; // relevance-filtered cap
const estimateTokens = (text) => Math.ceil(text.length / 4);
/**
 * Discover and load skill files. Returns a prompt-ready string.
 * When `message` is provided, skills are scored for relevance and only the
 * most relevant are included (keeps token budget tight with a large library).
 */
export function loadSkills(projectRoot, message, ctx) {
    const all = discoverSkillFiles(projectRoot);
    if (all.length === 0)
        return '';
    const filtered = applyConditionalActivation(all, ctx);
    if (filtered.length === 0)
        return '';
    const selected = message ? rankByRelevance(filtered, message) : filtered;
    return formatSkillsForPrompt(selected, message ? MAX_SKILLS_WITH_MESSAGE : MAX_SKILLS_WITHOUT_MESSAGE);
}
/**
 * Filter skills by platform and toolset conditions.
 * Matches Hermes's activation semantics:
 *   - `platforms: [darwin]` — only loads on macOS
 *   - `requires_toolsets: [browser]` — only loads when browser tools are available
 *   - `fallback_for_toolsets: [browser]` — only loads when browser tools are NOT available
 */
function applyConditionalActivation(skills, ctx) {
    const platform = ctx?.platform ?? process.platform;
    const toolsets = new Set((ctx?.availableToolsets ?? []).map(t => t.toLowerCase()));
    return skills.filter(s => {
        if (s.platforms.length > 0 && !s.platforms.some(p => platform.startsWith(p)))
            return false;
        if (s.requiresToolsets.length > 0 && !s.requiresToolsets.every(t => toolsets.has(t.toLowerCase())))
            return false;
        if (s.fallbackForToolsets.length > 0 && s.fallbackForToolsets.some(t => toolsets.has(t.toLowerCase())))
            return false;
        return true;
    });
}
/**
 * Walk both skill roots and return every skill document found.
 * Handles flat files (name.md) AND subdirectory layouts (cat/name/SKILL.md).
 * Project skills take precedence over global skills with the same name.
 */
export function discoverSkillFiles(projectRoot) {
    // Precedence (first wins on name collision):
    //   1. project-local — most specific, author's own
    //   2. bundled       — kbot-curated skills shipping with the package
    //   3. user-global   — includes imported third-party skills (symlinks)
    const locations = [
        join(projectRoot, '.kbot', 'skills'),
        getBundledSkillsDir(),
        join(homedir(), '.kbot', 'skills'),
    ];
    const skills = [];
    const seen = new Set();
    for (const root of locations) {
        if (!existsSync(root))
            continue;
        walkSkillRoot(root, skills, seen);
    }
    return skills;
}
function walkSkillRoot(root, out, seen, depth = 0) {
    if (depth > 3)
        return; // guard against deep nesting
    let entries;
    try {
        entries = readdirSync(root);
    }
    catch {
        return;
    }
    for (const entry of entries) {
        if (entry.startsWith('.') || entry === 'node_modules')
            continue;
        const full = join(root, entry);
        let stat;
        try {
            stat = statSync(full);
        }
        catch {
            continue;
        }
        if (stat.isDirectory()) {
            // Subdirectory layout: look for SKILL.md first (agentskills.io standard)
            const skillMd = join(full, 'SKILL.md');
            if (existsSync(skillMd)) {
                tryAddSkill(skillMd, entry, out, seen);
            }
            else {
                // Category directory — recurse
                walkSkillRoot(full, out, seen, depth + 1);
            }
        }
        else if (entry.endsWith('.md') && entry !== 'README.md') {
            const name = basename(entry, '.md');
            tryAddSkill(full, name, out, seen);
        }
    }
}
function tryAddSkill(path, fallbackName, out, seen) {
    let content;
    try {
        content = readFileSync(path, 'utf-8').trim();
    }
    catch {
        return;
    }
    if (!content)
        return;
    const parsed = parseFrontmatter(content);
    const name = String(parsed.fm.name ?? parsed.fm.title ?? fallbackName).trim() || fallbackName;
    if (seen.has(name))
        return;
    seen.add(name);
    const description = String(parsed.fm.description ?? '').trim();
    const tags = extractTags(parsed.fm);
    const hermesMeta = parsed.fm.metadata?.hermes ?? {};
    const kbotMeta = parsed.fm.metadata?.kbot ?? {};
    const asList = (v) => {
        if (Array.isArray(v))
            return v.map(String).map(s => s.trim()).filter(Boolean);
        if (typeof v === 'string')
            return v.split(',').map(s => s.trim()).filter(Boolean);
        return [];
    };
    const bundledDir = getBundledSkillsDir();
    const native = path.startsWith(bundledDir) || Object.keys(kbotMeta).length > 0;
    out.push({
        name,
        path,
        content,
        description,
        tags,
        tokens: estimateTokens(content),
        requiresToolsets: [...asList(kbotMeta.requires_toolsets), ...asList(hermesMeta.requires_toolsets)],
        fallbackForToolsets: [...asList(kbotMeta.fallback_for_toolsets), ...asList(hermesMeta.fallback_for_toolsets)],
        platforms: asList(parsed.fm.platforms),
        relatedSkills: [...asList(kbotMeta.related_skills), ...asList(hermesMeta.related_skills)],
        native,
    });
}
/**
 * Lightweight YAML-frontmatter parser. Handles the subset skills use:
 *   key: value
 *   key: [a, b, c]
 *   metadata:
 *     hermes:
 *       tags: [x, y]
 * Avoids pulling in a full YAML dep. Good enough for flat skill metadata.
 */
function parseFrontmatter(content) {
    if (!content.startsWith('---'))
        return { fm: {}, body: content };
    const end = content.indexOf('\n---', 3);
    if (end < 0)
        return { fm: {}, body: content };
    const yaml = content.slice(3, end).trim();
    const body = content.slice(end + 4).trim();
    const fm = {};
    const stack = [{ indent: -1, obj: fm }];
    for (const rawLine of yaml.split('\n')) {
        const line = rawLine.replace(/\s+$/, '');
        if (!line.trim() || line.trim().startsWith('#'))
            continue;
        const indent = line.match(/^ */)[0].length;
        while (stack.length > 1 && indent <= stack[stack.length - 1].indent)
            stack.pop();
        const parent = stack[stack.length - 1].obj;
        const m = line.trim().match(/^([A-Za-z0-9_\-]+)\s*:\s*(.*)$/);
        if (!m)
            continue;
        const [, key, valueRaw] = m;
        const value = valueRaw.trim();
        if (!value) {
            // Nested object
            const child = {};
            parent[key] = child;
            stack.push({ indent, obj: child });
            continue;
        }
        parent[key] = parseScalar(value);
    }
    return { fm, body };
}
function parseScalar(value) {
    // Inline list: [a, b, "c"]
    if (value.startsWith('[') && value.endsWith(']')) {
        return value.slice(1, -1)
            .split(',')
            .map(s => s.trim().replace(/^["']|["']$/g, ''))
            .filter(Boolean);
    }
    // Quoted string
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1);
    }
    return value;
}
function extractTags(fm) {
    const tags = [];
    const push = (v) => {
        if (Array.isArray(v))
            tags.push(...v.map(String));
        else if (typeof v === 'string')
            tags.push(...v.split(',').map(s => s.trim()).filter(Boolean));
    };
    push(fm.keywords);
    push(fm.tags);
    const meta = fm.metadata;
    if (meta && typeof meta === 'object') {
        push(meta.hermes?.tags);
        push(meta.claude?.tags);
    }
    return [...new Set(tags.map(t => t.toLowerCase()))];
}
// ── Relevance scoring ────────────────────────────────────────────────
function rankByRelevance(skills, message) {
    const terms = tokenize(message);
    if (terms.size === 0)
        return skills;
    const scored = skills.map(s => ({ skill: s, score: scoreSkill(s, terms) }));
    scored.sort((a, b) => b.score - a.score);
    // Keep skills with at least one hit; fall back to top-N if nothing matches
    const hits = scored.filter(x => x.score > 0);
    return (hits.length > 0 ? hits : scored).map(x => x.skill);
}
function scoreSkill(skill, terms) {
    let score = 0;
    const nameTokens = tokenize(skill.name);
    const descTokens = tokenize(skill.description);
    for (const t of terms) {
        if (nameTokens.has(t))
            score += 3;
        if (skill.tags.some(tag => tag === t || tag.includes(t)))
            score += 2;
        if (descTokens.has(t))
            score += 1;
    }
    // Bundled kbot-native skills get a curated-content boost over imported third-party skills.
    // Only applied when the skill already matched on something (score > 0) — we don't surface
    // unrelated native skills over perfectly-matched imported ones.
    if (score > 0 && skill.native)
        score += 2;
    return score;
}
const STOPWORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'of', 'to', 'for', 'in', 'on', 'at',
    'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'this', 'that', 'it', 'i', 'you',
    'we', 'they', 'how', 'what', 'when', 'why', 'can', 'do', 'does', 'please',
]);
function tokenize(text) {
    const out = new Set();
    // Split on non-alphanumeric AND on kebab/snake separators so "daemon-deployment"
    // and "skill_self_authorship" both yield useful word tokens.
    for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
        if (raw.length < 3)
            continue;
        if (STOPWORDS.has(raw))
            continue;
        out.add(raw);
    }
    return out;
}
// ── Prompt formatting ────────────────────────────────────────────────
function formatSkillsForPrompt(skills, maxSkills) {
    const parts = [];
    let currentTokens = 0;
    let included = 0;
    for (const skill of skills) {
        if (included >= maxSkills)
            break;
        if (currentTokens + skill.tokens > MAX_SKILL_TOKENS) {
            const remaining = MAX_SKILL_TOKENS - currentTokens;
            if (remaining > 100) {
                const truncated = skill.content.slice(0, remaining * 4) + '\n...(truncated)';
                parts.push(`## Skill: ${skill.name}\n${truncated}`);
                included++;
            }
            break;
        }
        parts.push(`## Skill: ${skill.name}\n${skill.content}`);
        currentTokens += skill.tokens;
        included++;
    }
    if (parts.length === 0)
        return '';
    return `\n\n[Custom Skills]\n${parts.join('\n---\n')}`;
}
/**
 * Copy (as symlinks) every SKILL.md under a foreign skills directory
 * into ~/.kbot/skills/imported/<category>/<name>/SKILL.md.
 * Non-destructive: existing symlinks are replaced, real files are skipped.
 */
export async function importExternalSkills(sourceRoot) {
    const { mkdirSync, symlinkSync, unlinkSync, lstatSync } = await import('node:fs');
    const destRoot = join(homedir(), '.kbot', 'skills', 'imported');
    mkdirSync(destRoot, { recursive: true });
    let imported = 0;
    let skipped = 0;
    const walk = (dir, rel) => {
        let entries;
        try {
            entries = readdirSync(dir);
        }
        catch {
            return;
        }
        for (const e of entries) {
            if (e.startsWith('.'))
                continue;
            const full = join(dir, e);
            let st;
            try {
                st = statSync(full);
            }
            catch {
                continue;
            }
            if (st.isDirectory()) {
                const skillMd = join(full, 'SKILL.md');
                if (existsSync(skillMd)) {
                    const destDir = join(destRoot, rel, e);
                    mkdirSync(destDir, { recursive: true });
                    const destFile = join(destDir, 'SKILL.md');
                    try {
                        if (existsSync(destFile)) {
                            const ls = lstatSync(destFile);
                            if (ls.isSymbolicLink())
                                unlinkSync(destFile);
                            else {
                                skipped++;
                                continue;
                            } // don't clobber user-authored file
                        }
                        symlinkSync(skillMd, destFile);
                        imported++;
                    }
                    catch {
                        skipped++;
                    }
                }
                else {
                    walk(full, join(rel, e));
                }
            }
        }
    };
    walk(sourceRoot, '');
    return { imported, skipped, source: sourceRoot, destination: destRoot };
}
//# sourceMappingURL=skills-loader.js.map