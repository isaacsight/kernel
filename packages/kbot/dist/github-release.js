// kbot GitHub Release — Auto-create GitHub releases from git history
//
// Usage:
//   import { createGitHubRelease, generateChangelog } from './github-release.js'
//   const result = await createGitHubRelease({ owner: 'isaacsight', repo: 'kernel' })
//
// CLI:
//   $ kbot release                 # Create release from current version
//   $ kbot release --draft         # Create as draft
//   $ kbot release --tag v3.52.0   # Override tag
//   $ kbot release --dry-run       # Preview without creating
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// ── Conventional commit categories ──
const COMMIT_CATEGORIES = {
    'feat': { label: 'Features', emoji: '\u2728', order: 0 },
    'fix': { label: 'Bug Fixes', emoji: '\uD83D\uDC1B', order: 1 },
    'perf': { label: 'Performance', emoji: '\u26A1', order: 2 },
    'security': { label: 'Security', emoji: '\uD83D\uDD12', order: 3 },
    'refactor': { label: 'Refactoring', emoji: '\u267B\uFE0F', order: 4 },
    'test': { label: 'Tests', emoji: '\uD83E\uDDEA', order: 5 },
    'docs': { label: 'Documentation', emoji: '\uD83D\uDCDA', order: 6 },
    'build': { label: 'Build & Deploy', emoji: '\uD83D\uDCE6', order: 7 },
    'ci': { label: 'CI/CD', emoji: '\u2699\uFE0F', order: 8 },
    'chore': { label: 'Maintenance', emoji: '\uD83E\uDDF9', order: 9 },
    'style': { label: 'Code Style', emoji: '\uD83C\uDFA8', order: 10 },
    'revert': { label: 'Reverts', emoji: '\u23EA', order: 11 },
};
const DEFAULT_CATEGORY = { label: 'Other Changes', emoji: '\uD83D\uDD27', order: 99 };
// ── Git helpers ──
function git(cmd) {
    try {
        return execSync(`git ${cmd}`, {
            cwd: process.cwd(),
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 15000,
        }).trim();
    }
    catch {
        return '';
    }
}
function getLastTag() {
    const tag = git('describe --tags --abbrev=0');
    return tag || null;
}
function getPreviousTag(currentTag) {
    const tag = git(`describe --tags --abbrev=0 ${currentTag}^`);
    return tag || null;
}
function getAllTags() {
    const output = git('tag --sort=-v:refname');
    return output ? output.split('\n').filter(Boolean) : [];
}
function getCommitsBetween(fromRef, toRef) {
    const separator = '---KBOT-COMMIT-SEP---';
    const fieldSep = '---KBOT-FIELD-SEP---';
    const format = `${fieldSep}%h${fieldSep}%s${fieldSep}%b${fieldSep}%an${fieldSep}%ai${separator}`;
    const range = fromRef && toRef
        ? `${fromRef}..${toRef}`
        : fromRef
            ? `${fromRef}..HEAD`
            : toRef
                ? toRef
                : '-30';
    const output = git(`log ${range} --format="${format}"`);
    if (!output)
        return [];
    return output
        .split(separator)
        .filter(chunk => chunk.trim())
        .map(chunk => {
        const fields = chunk.split(fieldSep).filter(Boolean);
        if (fields.length < 2)
            return null;
        return {
            hash: fields[0]?.trim() || '',
            subject: fields[1]?.trim() || '',
            body: fields[2]?.trim() || '',
            author: fields[3]?.trim() || '',
            date: fields[4]?.trim() || '',
        };
    })
        .filter((c) => c !== null && c.hash.length > 0);
}
function getVersionFromPackageJson() {
    try {
        // Check packages/kbot/package.json first, then root
        for (const rel of ['packages/kbot/package.json', 'package.json']) {
            try {
                const pkgPath = join(process.cwd(), rel);
                const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
                if (pkg.version)
                    return pkg.version;
            }
            catch { /* try next */ }
        }
        return 'unreleased';
    }
    catch {
        return 'unreleased';
    }
}
function getRepoInfo() {
    const remote = git('remote get-url origin');
    if (!remote)
        return null;
    // Parse SSH or HTTPS URLs
    // git@github.com:owner/repo.git
    // https://github.com/owner/repo.git
    const sshMatch = remote.match(/git@github\.com:([^/]+)\/([^/.]+)/);
    const httpsMatch = remote.match(/github\.com\/([^/]+)\/([^/.]+)/);
    const match = sshMatch || httpsMatch;
    if (match)
        return { owner: match[1], repo: match[2] };
    return null;
}
/**
 * Resolve a GitHub token from multiple sources.
 * Priority: explicit token > GITHUB_TOKEN env > GH_TOKEN env > gh CLI auth
 */
function resolveToken(explicit) {
    if (explicit)
        return explicit;
    // Environment variables
    if (process.env.GITHUB_TOKEN)
        return process.env.GITHUB_TOKEN;
    if (process.env.GH_TOKEN)
        return process.env.GH_TOKEN;
    // Try gh CLI auth token
    try {
        const token = execSync('gh auth token', {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 5000,
        }).trim();
        if (token)
            return token;
    }
    catch { /* gh not available or not authenticated */ }
    return null;
}
// ── Commit categorization ──
/**
 * Parse a commit subject into its conventional commit prefix.
 * Returns the prefix key (e.g., 'feat', 'fix') or null.
 */
function parsePrefix(subject) {
    const match = subject.match(/^(\w+)(?:\(.+?\))?(!)?:\s/);
    if (!match)
        return null;
    return match[1].toLowerCase();
}
/**
 * Strip the conventional commit prefix from a subject line.
 * "feat(auth): add OAuth" -> "add OAuth"
 */
function stripPrefix(subject) {
    return subject.replace(/^\w+(?:\(.+?\))?(!)?:\s*/, '');
}
/**
 * Check if a commit is a breaking change (! suffix or BREAKING CHANGE in body).
 */
function isBreaking(commit) {
    if (commit.subject.match(/^\w+(?:\(.+?\))?!:/))
        return true;
    if (commit.body.includes('BREAKING CHANGE'))
        return true;
    return false;
}
/**
 * Extract the scope from a conventional commit subject.
 * "feat(auth): add OAuth" -> "auth"
 */
function extractScope(subject) {
    const match = subject.match(/^\w+\(([^)]+)\)/);
    return match ? match[1] : null;
}
/**
 * Categorize an array of commit subjects into labeled sections.
 */
export function categorizeCommits(commits) {
    const groups = {};
    for (const subject of commits) {
        const prefix = parsePrefix(subject);
        const category = prefix && COMMIT_CATEGORIES[prefix]
            ? COMMIT_CATEGORIES[prefix].label
            : DEFAULT_CATEGORY.label;
        if (!groups[category])
            groups[category] = [];
        groups[category].push(stripPrefix(subject));
    }
    return groups;
}
/**
 * Format categorized commits into markdown release notes.
 */
export function formatReleaseNotes(categorized) {
    const lines = [];
    // Sort categories by defined order
    const sortedCategories = Object.entries(categorized).sort(([a], [b]) => {
        const orderA = Object.values(COMMIT_CATEGORIES).find(c => c.label === a)?.order ?? 99;
        const orderB = Object.values(COMMIT_CATEGORIES).find(c => c.label === b)?.order ?? 99;
        return orderA - orderB;
    });
    for (const [category, items] of sortedCategories) {
        if (items.length === 0)
            continue;
        const meta = Object.values(COMMIT_CATEGORIES).find(c => c.label === category);
        const emoji = meta?.emoji || DEFAULT_CATEGORY.emoji;
        lines.push(`### ${emoji} ${category}`);
        lines.push('');
        for (const item of items) {
            lines.push(`- ${item}`);
        }
        lines.push('');
    }
    return lines.join('\n');
}
/**
 * Generate a full changelog between two tags/refs.
 * If no refs provided, auto-detects from the latest and previous tags.
 */
export function generateChangelog(fromTag, toTag) {
    // Auto-detect refs if not provided
    const to = toTag || 'HEAD';
    const from = fromTag || getLastTag() || undefined;
    const commits = getCommitsBetween(from, to === 'HEAD' ? undefined : to);
    if (commits.length === 0) {
        return '> No commits found for this range.\n';
    }
    // Separate breaking changes
    const breaking = [];
    const regular = [];
    for (const commit of commits) {
        if (isBreaking(commit)) {
            breaking.push(commit);
        }
        regular.push(commit);
    }
    // Group regular commits by category
    const groups = {};
    for (const commit of regular) {
        const prefix = parsePrefix(commit.subject);
        const category = prefix && COMMIT_CATEGORIES[prefix]
            ? COMMIT_CATEGORIES[prefix].label
            : DEFAULT_CATEGORY.label;
        if (!groups[category])
            groups[category] = { items: [], hashes: [] };
        const scope = extractScope(commit.subject);
        const clean = stripPrefix(commit.subject);
        const display = scope ? `**${scope}**: ${clean}` : clean;
        groups[category].items.push(display);
        groups[category].hashes.push(commit.hash);
    }
    // Build markdown
    const lines = [];
    // Breaking changes section
    if (breaking.length > 0) {
        lines.push('### \u26A0\uFE0F Breaking Changes');
        lines.push('');
        for (const commit of breaking) {
            const clean = stripPrefix(commit.subject);
            lines.push(`- **${clean}** (\`${commit.hash}\`)`);
            if (commit.body) {
                const breakingNote = commit.body
                    .split('\n')
                    .find(l => l.startsWith('BREAKING CHANGE:'));
                if (breakingNote) {
                    lines.push(`  ${breakingNote.replace('BREAKING CHANGE:', '').trim()}`);
                }
            }
        }
        lines.push('');
    }
    // Categorized commits
    const sortedCategories = Object.entries(groups).sort(([a], [b]) => {
        const orderA = Object.values(COMMIT_CATEGORIES).find(c => c.label === a)?.order ?? 99;
        const orderB = Object.values(COMMIT_CATEGORIES).find(c => c.label === b)?.order ?? 99;
        return orderA - orderB;
    });
    for (const [category, { items, hashes }] of sortedCategories) {
        if (items.length === 0)
            continue;
        const meta = Object.values(COMMIT_CATEGORIES).find(c => c.label === category);
        const emoji = meta?.emoji || DEFAULT_CATEGORY.emoji;
        lines.push(`### ${emoji} ${category}`);
        lines.push('');
        for (let i = 0; i < items.length; i++) {
            lines.push(`- ${items[i]} (\`${hashes[i]}\`)`);
        }
        lines.push('');
    }
    // Stats footer
    const from_label = from || 'beginning';
    const to_label = to === 'HEAD' ? 'HEAD' : to;
    lines.push('---');
    lines.push(`**${commits.length}** commits from \`${from_label}\` to \`${to_label}\``);
    lines.push('');
    return lines.join('\n');
}
/**
 * Detect the current version tag and release name.
 * Looks at package.json and recent git tags.
 */
function detectReleaseInfo() {
    const version = getVersionFromPackageJson();
    const tag = `v${version}`;
    // Try to extract a feature name from recent commits
    const commits = getCommitsBetween(getLastTag() || undefined);
    const feats = commits.filter(c => parsePrefix(c.subject) === 'feat');
    const featureHint = feats.length > 0
        ? stripPrefix(feats[0].subject).split(' ').slice(0, 4).join(' ')
        : null;
    const name = featureHint
        ? `${tag} \u2014 ${featureHint.charAt(0).toUpperCase() + featureHint.slice(1)}`
        : tag;
    const isPrerelease = version.includes('-alpha') ||
        version.includes('-beta') ||
        version.includes('-rc') ||
        version.includes('-canary');
    return {
        tag,
        name,
        prerelease: isPrerelease,
        draft: false,
    };
}
/**
 * Create a GitHub release via the REST API.
 *
 * Generates a changelog, creates a git tag (if it doesn't exist),
 * and publishes a release on GitHub.
 */
export async function createGitHubRelease(config, info) {
    // Resolve token
    const token = resolveToken(config.token);
    if (!token) {
        throw new Error('GitHub token not found. Set GITHUB_TOKEN env var, authenticate with `gh auth login`, or pass token in config.');
    }
    // Build release info from defaults + overrides
    const detected = detectReleaseInfo();
    const tag = info?.tag || detected.tag || `v${getVersionFromPackageJson()}`;
    const previousTag = getPreviousTag(tag) || getLastTag() || undefined;
    const body = info?.body || generateChangelog(previousTag, tag === `v${getVersionFromPackageJson()}` ? undefined : tag);
    const name = info?.name || detected.name || tag;
    const draft = info?.draft ?? detected.draft ?? false;
    const prerelease = info?.prerelease ?? detected.prerelease ?? false;
    // Create the tag locally if it doesn't exist
    const existingTags = getAllTags();
    if (!existingTags.includes(tag)) {
        const tagResult = git(`tag -a ${tag} -m "Release ${tag}"`);
        if (tagResult === '' && !getAllTags().includes(tag)) {
            // tag command returns empty on success too, verify
            const verify = git(`tag -l ${tag}`);
            if (!verify) {
                throw new Error(`Failed to create git tag: ${tag}`);
            }
        }
        // Push the tag
        git(`push origin ${tag}`);
    }
    // Create release via GitHub API
    const apiUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/releases`;
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            tag_name: tag,
            target_commitish: 'main',
            name,
            body,
            draft,
            prerelease,
            generate_release_notes: false,
        }),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`GitHub API error ${response.status}: ${response.statusText}\n${errorBody}`);
    }
    const release = await response.json();
    return {
        url: release.html_url,
        id: release.id,
        tag: release.tag_name,
        draft: release.draft,
    };
}
/**
 * CLI handler for `kbot release`.
 * Called from cli.ts command registration.
 */
export async function runRelease(opts) {
    const { printSuccess, printError, printInfo, printWarn } = await import('./ui.js');
    // Detect repo info from git remote
    const repoInfo = getRepoInfo();
    if (!repoInfo) {
        printError('Could not detect GitHub repo from git remote. Are you in a git repository?');
        process.exit(1);
    }
    const version = getVersionFromPackageJson();
    const tag = opts.tag || `v${version}`;
    printInfo(`Preparing release: ${tag}`);
    printInfo(`Repository: ${repoInfo.owner}/${repoInfo.repo}`);
    // Generate changelog for preview
    const previousTag = getLastTag();
    const changelog = generateChangelog(previousTag || undefined);
    if (opts.dryRun) {
        printInfo('\n--- DRY RUN (no release created) ---\n');
        printInfo(`Tag: ${tag}`);
        printInfo(`Draft: ${opts.draft ? 'yes' : 'no'}`);
        printInfo(`Previous tag: ${previousTag || '(none)'}`);
        printInfo('\nRelease notes:\n');
        process.stdout.write(changelog);
        return;
    }
    // Check for token before attempting
    const token = resolveToken();
    if (!token) {
        printError('No GitHub token found.');
        printWarn('Set GITHUB_TOKEN environment variable or run `gh auth login`');
        process.exit(1);
    }
    try {
        const result = await createGitHubRelease({ owner: repoInfo.owner, repo: repoInfo.repo, token }, {
            tag,
            draft: opts.draft,
            body: changelog,
        });
        if (opts.json) {
            process.stdout.write(JSON.stringify(result, null, 2) + '\n');
            return;
        }
        printSuccess(`Release created: ${result.tag}${result.draft ? ' (draft)' : ''}`);
        printInfo(`URL: ${result.url}`);
        printInfo(`ID: ${result.id}`);
    }
    catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
    }
}
//# sourceMappingURL=github-release.js.map