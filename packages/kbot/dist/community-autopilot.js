// kbot Community Autopilot — Autonomous community management daemon
//
// Wires the community manager, FAQ system, and GitHub monitoring into one
// continuous loop. Runs as a background daemon: triages issues, reviews PRs,
// answers questions, generates digests, and welcomes new contributors.
//
// Usage:
//   import { startAutopilot, stopAutopilot, runCommunityAutopilot } from './community-autopilot.js'
//
//   // One-shot cycle
//   const result = await runCommunityAutopilot({ github_repo: 'owner/repo', discord_webhook: '...' })
//
//   // Daemon mode
//   startAutopilot({ github_repo: 'owner/repo', discord_webhook: '...', check_interval_ms: 300000 })
//   // ... later:
//   stopAutopilot()
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';
// ── Paths ──
const AUTOPILOT_DIR = join(homedir(), '.kbot', 'autopilot');
const STATE_PATH = join(AUTOPILOT_DIR, 'state.json');
const FAQ_PATH = join(homedir(), '.kbot', 'community-faq.json');
const LOG_PATH = join(AUTOPILOT_DIR, 'autopilot.log');
const DIGEST_DIR = join(AUTOPILOT_DIR, 'digests');
function defaultState() {
    return {
        triagedIssues: [],
        reviewedPRs: [],
        answeredIssues: [],
        welcomedUsers: [],
        lastDigestDate: '',
        knownContributors: [],
        cycleCount: 0,
    };
}
// ── Helpers ──
function ensureDir(dir) {
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
}
function log(msg) {
    ensureDir(AUTOPILOT_DIR);
    const line = `[${new Date().toISOString().slice(0, 19)}] ${msg}\n`;
    appendFileSync(LOG_PATH, line);
    console.log(`[autopilot] ${msg}`);
}
function loadJsonSafe(path, fallback) {
    if (!existsSync(path))
        return fallback;
    try {
        return JSON.parse(readFileSync(path, 'utf-8'));
    }
    catch {
        return fallback;
    }
}
function saveJson(path, data) {
    const dir = path.replace(/\/[^/]+$/, '');
    ensureDir(dir);
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}
function loadState() {
    return loadJsonSafe(STATE_PATH, defaultState());
}
function saveState(state) {
    saveJson(STATE_PATH, state);
}
// ── GitHub API ──
async function ghFetch(endpoint, repo) {
    const url = `https://api.github.com/repos/${repo}${endpoint}`;
    try {
        const res = await fetch(url, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'kbot-autopilot/1.0',
            },
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok)
            return null;
        return await res.json();
    }
    catch {
        return null;
    }
}
function ghCliAvailable() {
    try {
        execSync('gh auth status', { timeout: 5000, stdio: 'pipe' });
        return true;
    }
    catch {
        return false;
    }
}
function ghCliComment(repo, issueNumber, body) {
    try {
        execSync(`gh issue comment ${issueNumber} --repo ${repo} --body ${JSON.stringify(body)}`, { timeout: 15000, stdio: 'pipe' });
        return true;
    }
    catch {
        return false;
    }
}
function ghCliPRComment(repo, prNumber, body) {
    try {
        execSync(`gh pr comment ${prNumber} --repo ${repo} --body ${JSON.stringify(body)}`, { timeout: 15000, stdio: 'pipe' });
        return true;
    }
    catch {
        return false;
    }
}
// ── Discord ──
async function postToDiscord(webhookUrl, content) {
    try {
        const truncated = content.length > 1900
            ? content.slice(0, 1900) + '\n\n... (truncated)'
            : content;
        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: truncated }),
            signal: AbortSignal.timeout(10000),
        });
        return res.ok;
    }
    catch {
        return false;
    }
}
// ── 1. Issue Triage ──
function classifyIssue(issue) {
    const title = issue.title.toLowerCase();
    const body = (issue.body || '').toLowerCase();
    const text = `${title} ${body}`;
    // Already labeled — skip
    if (issue.labels.length > 0) {
        return { label: '', response: '' };
    }
    // Bug patterns
    if (/\b(bug|error|crash|broken|segfault|exception|traceback|panic|undefined is not)\b/.test(text)) {
        return {
            label: 'bug',
            response: `Thanks for reporting this, @${issue.user.login}! To help us investigate:\n\n- Steps to reproduce\n- Expected vs actual behavior\n- Environment details (OS, runtime version)\n- Error message or stack trace if available\n\nWe'll look into this.`,
        };
    }
    // Feature request patterns
    if (/\b(feature|request|add|support|would be nice|enhancement|proposal|suggestion|wish)\b/.test(text)) {
        return {
            label: 'enhancement',
            response: `Thanks for the suggestion, @${issue.user.login}! We've tagged this as an enhancement for review. If others find this useful, please add a thumbs-up reaction to help us prioritize.`,
        };
    }
    // Question patterns
    if (/\b(how|why|question|help|docs|documentation|what does|where is|can i|is it possible)\b/.test(text) || title.includes('?')) {
        return {
            label: 'question',
            response: `Hi @${issue.user.login}! This looks like a question. Let me check if we have an answer in our docs. If this is still unresolved after a few days, we'll follow up.`,
        };
    }
    // Performance patterns
    if (/\b(slow|performance|memory|leak|cpu|latency|timeout|hang)\b/.test(text)) {
        return {
            label: 'performance',
            response: `Thanks for flagging this, @${issue.user.login}! Performance issues are important to us. Could you share:\n\n- What operation is slow?\n- How long does it take vs expected?\n- System specs (CPU, RAM)\n- Repro steps if possible`,
        };
    }
    // Documentation patterns
    if (/\b(typo|docs|readme|documentation|spelling|grammar|outdated)\b/.test(text)) {
        return {
            label: 'documentation',
            response: `Thanks, @${issue.user.login}! Documentation improvements are always welcome. Feel free to open a PR if you'd like to fix this directly.`,
        };
    }
    // Default
    return {
        label: 'needs-triage',
        response: `Thanks for opening this, @${issue.user.login}! We'll review it shortly.`,
    };
}
async function triageNewIssues(repo, state, useGhCli) {
    const results = [];
    const issues = await ghFetch('/issues?state=open&sort=created&direction=desc&per_page=20', repo);
    if (!issues)
        return results;
    // Filter to pure issues (not PRs), created in the last 24h, not already triaged
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const triagedSet = new Set(state.triagedIssues);
    const freshIssues = issues.filter(i => !i.pull_request &&
        i.created_at >= oneDayAgo &&
        !triagedSet.has(i.number));
    for (const issue of freshIssues) {
        const { label, response } = classifyIssue(issue);
        if (!label || !response)
            continue;
        results.push({
            issue: issue.number,
            title: issue.title,
            label,
            response,
            url: issue.html_url,
        });
        // Post comment if gh CLI is available
        if (useGhCli) {
            const posted = ghCliComment(repo, issue.number, response);
            log(posted
                ? `Triaged #${issue.number} as ${label}`
                : `Triage draft for #${issue.number} (could not post)`);
        }
        else {
            log(`Triage draft for #${issue.number} (gh CLI not available)`);
        }
        state.triagedIssues.push(issue.number);
    }
    // Keep only last 500 triaged issue numbers
    if (state.triagedIssues.length > 500) {
        state.triagedIssues = state.triagedIssues.slice(-500);
    }
    return results;
}
// ── 2. PR Review ──
async function reviewNewPRs(repo, state, useGhCli) {
    const results = [];
    const prs = await ghFetch('/pulls?state=open&sort=created&direction=desc&per_page=15', repo);
    if (!prs)
        return results;
    const reviewedSet = new Set(state.reviewedPRs);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const freshPRs = prs.filter(p => p.created_at >= oneDayAgo &&
        !reviewedSet.has(p.number));
    for (const pr of freshPRs) {
        let status;
        let comment;
        if (pr.draft) {
            status = 'draft';
            comment = `Thanks for starting this PR, @${pr.user.login}! Let us know when it's ready for review by marking it as ready.`;
        }
        else {
            // Check CI status
            const checks = await ghFetch(`/commits/${pr.html_url.split('/').pop()}/check-runs`, repo);
            if (!checks || !checks.check_runs || checks.check_runs.length === 0) {
                status = 'pending-ci';
                comment = `Thanks for this PR, @${pr.user.login}! We'll review it once CI results are in.`;
            }
            else {
                const failed = checks.check_runs.some(c => c.conclusion === 'failure');
                const pending = checks.check_runs.some(c => c.status !== 'completed');
                if (failed) {
                    const failedNames = checks.check_runs
                        .filter(c => c.conclusion === 'failure')
                        .map(c => c.name)
                        .join(', ');
                    status = 'ci-failing';
                    comment = `Thanks for this PR, @${pr.user.login}! It looks like some CI checks are failing: ${failedNames}. Could you take a look and push a fix? We'll review once CI is green.`;
                }
                else if (pending) {
                    status = 'pending-ci';
                    comment = `Thanks for this PR, @${pr.user.login}! CI is still running. We'll review once all checks pass.`;
                }
                else {
                    status = 'ci-passing';
                    comment = `Thanks for this PR, @${pr.user.login}! CI is passing. A maintainer will review this soon.`;
                }
            }
        }
        results.push({
            pr: pr.number,
            title: pr.title,
            author: pr.user.login,
            status,
            comment,
            url: pr.html_url,
        });
        // Post comment
        if (useGhCli) {
            const posted = ghCliPRComment(repo, pr.number, comment);
            log(posted
                ? `Reviewed PR #${pr.number} (${status})`
                : `Review draft for PR #${pr.number} (could not post)`);
        }
        else {
            log(`Review draft for PR #${pr.number} (gh CLI not available)`);
        }
        state.reviewedPRs.push(pr.number);
    }
    // Keep only last 500 reviewed PR numbers
    if (state.reviewedPRs.length > 500) {
        state.reviewedPRs = state.reviewedPRs.slice(-500);
    }
    return results;
}
// ── 3. FAQ Matching ──
function loadFAQ() {
    return loadJsonSafe(FAQ_PATH, []);
}
function matchFAQ(question, faq) {
    if (faq.length === 0)
        return null;
    const questionLower = question.toLowerCase();
    const questionWords = questionLower.split(/\s+/).filter(w => w.length > 2);
    let bestMatch = null;
    let bestScore = 0;
    for (const entry of faq) {
        let score = 0;
        // Keyword matching (highest weight)
        for (const kw of entry.keywords) {
            if (questionLower.includes(kw.toLowerCase())) {
                score += 3;
            }
        }
        // Word overlap
        const entryWords = entry.question.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        for (const word of questionWords) {
            if (entryWords.includes(word))
                score += 2;
            if (entryWords.some(ew => ew.includes(word) || word.includes(ew)))
                score += 1;
        }
        if (score > bestScore) {
            bestScore = score;
            bestMatch = entry;
        }
    }
    if (bestMatch && bestScore >= 4) {
        // Normalize confidence to 0-1 range (rough heuristic)
        const confidence = Math.min(1, bestScore / 15);
        return { entry: bestMatch, confidence };
    }
    return null;
}
async function answerPendingQuestions(repo, state, useGhCli) {
    const results = [];
    const faq = loadFAQ();
    if (faq.length === 0)
        return results;
    // Fetch open issues labeled "question" or with "?" in title
    const issues = await ghFetch('/issues?state=open&labels=question&sort=created&direction=desc&per_page=10', repo);
    const answeredSet = new Set(state.answeredIssues);
    const candidates = (issues || []).filter(i => !i.pull_request &&
        !answeredSet.has(i.number) &&
        i.comments === 0);
    for (const issue of candidates) {
        const searchText = `${issue.title} ${issue.body || ''}`;
        const match = matchFAQ(searchText, faq);
        if (match) {
            const comment = `Hi @${issue.user.login}! This might help:\n\n${match.entry.answer}\n\n---\n*Answered by kbot FAQ system (confidence: ${(match.confidence * 100).toFixed(0)}%). If this doesn't fully address your question, a maintainer will follow up.*`;
            results.push({
                question: issue.title,
                answer: match.entry.answer,
                matchedIssue: issue.number,
                confidence: match.confidence,
            });
            if (useGhCli) {
                const posted = ghCliComment(repo, issue.number, comment);
                log(posted
                    ? `FAQ answered #${issue.number} (confidence: ${(match.confidence * 100).toFixed(0)}%)`
                    : `FAQ answer draft for #${issue.number} (could not post)`);
            }
            else {
                log(`FAQ answer draft for #${issue.number} (gh CLI not available)`);
            }
            state.answeredIssues.push(issue.number);
        }
    }
    // Keep only last 500 answered issue numbers
    if (state.answeredIssues.length > 500) {
        state.answeredIssues = state.answeredIssues.slice(-500);
    }
    return results;
}
// ── 4. Daily Digest ──
function shouldGenerateDigest(state) {
    if (!state.lastDigestDate)
        return true;
    const lastDate = state.lastDigestDate.split('T')[0];
    const todayDate = new Date().toISOString().split('T')[0];
    const now = new Date();
    // Generate at midnight (or first cycle after midnight)
    return lastDate !== todayDate && now.getHours() >= 0;
}
async function generateDailyDigest(repo, state, discordWebhook) {
    if (!shouldGenerateDigest(state))
        return null;
    log('Generating daily digest...');
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    // Fetch data
    const repoInfo = await ghFetch('', repo);
    const issues = await ghFetch('/issues?state=all&sort=created&direction=desc&per_page=30', repo) || [];
    const prs = await ghFetch('/pulls?state=all&sort=created&direction=desc&per_page=30', repo) || [];
    const pureIssues = issues.filter(i => !i.pull_request);
    const newIssues = pureIssues.filter(i => i.created_at >= oneDayAgo);
    const newPRs = prs.filter(p => p.created_at >= oneDayAgo);
    const mergedPRs = prs.filter(p => p.merged_at && p.merged_at >= oneDayAgo);
    // Detect new contributors
    const knownSet = new Set(state.knownContributors);
    const newContributors = [];
    for (const item of [...newIssues, ...newPRs]) {
        const login = item.user.login;
        if (!knownSet.has(login)) {
            knownSet.add(login);
            newContributors.push(login);
        }
    }
    state.knownContributors = Array.from(knownSet);
    // Build markdown
    const stars = repoInfo?.stargazers_count ?? 0;
    const lines = [
        `# Daily Digest — ${repo}`,
        `> ${now.toISOString().split('T')[0]}`,
        '',
        '## Today',
        '',
        `| Metric | Count |`,
        `|--------|-------|`,
        `| New Issues | ${newIssues.length} |`,
        `| New PRs | ${newPRs.length} |`,
        `| Merged PRs | ${mergedPRs.length} |`,
        `| Stars | ${stars} |`,
        '',
    ];
    if (newContributors.length > 0) {
        lines.push('## New Contributors');
        lines.push('');
        for (const c of newContributors) {
            lines.push(`- @${c}`);
        }
        lines.push('');
    }
    if (mergedPRs.length > 0) {
        lines.push('## Merged Today');
        lines.push('');
        for (const pr of mergedPRs.slice(0, 10)) {
            lines.push(`- [#${pr.number}](${pr.html_url}) ${pr.title} (@${pr.user.login})`);
        }
        lines.push('');
    }
    if (newIssues.length > 0) {
        lines.push('## New Issues');
        lines.push('');
        for (const issue of newIssues.slice(0, 10)) {
            const labels = issue.labels.map(l => l.name).join(', ');
            const labelTag = labels ? ` [${labels}]` : '';
            lines.push(`- [#${issue.number}](${issue.html_url}) ${issue.title}${labelTag}`);
        }
        lines.push('');
    }
    lines.push('---');
    lines.push('*Generated by kbot Community Autopilot*');
    const markdown = lines.join('\n');
    // Save digest
    ensureDir(DIGEST_DIR);
    const digestFile = join(DIGEST_DIR, `${now.toISOString().split('T')[0]}.md`);
    writeFileSync(digestFile, markdown, 'utf-8');
    // Post to Discord
    if (discordWebhook) {
        const posted = await postToDiscord(discordWebhook, markdown);
        log(posted ? 'Digest posted to Discord' : 'Failed to post digest to Discord');
    }
    state.lastDigestDate = now.toISOString();
    const entry = {
        generatedAt: now.toISOString(),
        repo,
        newIssues: newIssues.length,
        newPRs: newPRs.length,
        mergedPRs: mergedPRs.length,
        welcomed: newContributors,
        markdown,
    };
    log(`Digest generated: ${newIssues.length} issues, ${newPRs.length} PRs, ${mergedPRs.length} merged`);
    return entry;
}
// ── 5. Welcome New Contributors ──
async function welcomeNewContributors(repo, state, useGhCli) {
    const welcomed = [];
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const welcomedSet = new Set(state.welcomedUsers);
    // Fetch recent issues and PRs
    const issues = await ghFetch('/issues?state=all&sort=created&direction=desc&per_page=15', repo) || [];
    const prs = await ghFetch('/pulls?state=all&sort=created&direction=desc&per_page=10', repo) || [];
    const freshIssues = issues.filter(i => !i.pull_request && i.created_at >= oneDayAgo);
    const freshPRs = prs.filter(p => p.created_at >= oneDayAgo);
    // Collect authors
    const authors = new Map();
    for (const item of [...freshIssues, ...freshPRs]) {
        const login = item.user.login;
        authors.set(login, item.number ?? item.number);
    }
    for (const [author, targetNumber] of authors) {
        if (welcomedSet.has(author))
            continue;
        // Check if truly new: not in known contributors
        const knownSet = new Set(state.knownContributors);
        if (knownSet.has(author))
            continue;
        const welcomeMsg = [
            `Welcome to the project, @${author}! We're glad to have you here.`,
            '',
            'Here are some ways to get started:',
            '- Check out issues labeled `good first issue` for beginner-friendly tasks',
            '- Read the README for project setup and conventions',
            '- Join our community discussions if you have questions',
            '',
            "Don't hesitate to ask for help — we value every contribution, no matter how small.",
        ].join('\n');
        welcomed.push(author);
        welcomedSet.add(author);
        if (useGhCli && targetNumber > 0) {
            const posted = ghCliComment(repo, targetNumber, welcomeMsg);
            log(posted
                ? `Welcomed new contributor: @${author}`
                : `Welcome draft for @${author} (could not post)`);
        }
        else {
            log(`Welcome draft for @${author} (gh CLI not available)`);
        }
        // Also add to known contributors
        if (!state.knownContributors.includes(author)) {
            state.knownContributors.push(author);
        }
    }
    state.welcomedUsers = Array.from(welcomedSet);
    // Keep only last 1000 welcomed users
    if (state.welcomedUsers.length > 1000) {
        state.welcomedUsers = state.welcomedUsers.slice(-1000);
    }
    return welcomed;
}
// ── Main Cycle ──
/**
 * Run a single community autopilot cycle.
 *
 * 1. Triage new GitHub issues (label + respond)
 * 2. Review new PRs (check CI, comment)
 * 3. Answer pending questions via FAQ matching
 * 4. Generate daily digest at midnight
 * 5. Welcome new contributors
 */
export async function runCommunityAutopilot(config) {
    const { github_repo, discord_webhook } = config;
    const state = loadState();
    const useGhCli = ghCliAvailable();
    const errors = [];
    state.cycleCount++;
    log(`Autopilot cycle ${state.cycleCount} starting for ${github_repo}`);
    // 1. Triage issues
    let triaged = [];
    try {
        triaged = await triageNewIssues(github_repo, state, useGhCli);
    }
    catch (err) {
        const msg = `Issue triage failed: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(msg);
        log(msg);
    }
    // 2. Review PRs
    let reviewed = [];
    try {
        reviewed = await reviewNewPRs(github_repo, state, useGhCli);
    }
    catch (err) {
        const msg = `PR review failed: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(msg);
        log(msg);
    }
    // 3. Answer FAQ questions
    let faqAnswered = [];
    try {
        faqAnswered = await answerPendingQuestions(github_repo, state, useGhCli);
    }
    catch (err) {
        const msg = `FAQ matching failed: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(msg);
        log(msg);
    }
    // 4. Daily digest
    let digest = null;
    try {
        digest = await generateDailyDigest(github_repo, state, discord_webhook);
    }
    catch (err) {
        const msg = `Digest generation failed: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(msg);
        log(msg);
    }
    // 5. Welcome new contributors
    let welcomed = [];
    try {
        welcomed = await welcomeNewContributors(github_repo, state, useGhCli);
    }
    catch (err) {
        const msg = `Welcome failed: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(msg);
        log(msg);
    }
    // Persist state
    saveState(state);
    const result = {
        timestamp: new Date().toISOString(),
        repo: github_repo,
        triaged,
        reviewed,
        faqAnswered,
        welcomed,
        digest,
        errors,
    };
    log(`Cycle ${state.cycleCount} complete: ` +
        `${triaged.length} triaged, ${reviewed.length} reviewed, ` +
        `${faqAnswered.length} FAQ answered, ${welcomed.length} welcomed` +
        (errors.length > 0 ? `, ${errors.length} error(s)` : ''));
    return result;
}
// ── Daemon Control ──
let autopilotTimer = null;
let autopilotRunning = false;
/**
 * Start the community autopilot as a background daemon.
 * Runs a cycle immediately, then repeats at the configured interval.
 */
export function startAutopilot(config) {
    if (autopilotRunning) {
        log('Autopilot is already running. Call stopAutopilot() first.');
        return;
    }
    const interval = config.check_interval_ms ?? 300000; // 5 min default
    log(`Starting autopilot daemon (interval: ${interval}ms)`);
    autopilotRunning = true;
    // Run immediately
    runCommunityAutopilot(config).catch(err => {
        log(`Autopilot cycle error: ${err instanceof Error ? err.message : String(err)}`);
    });
    // Schedule recurring cycles
    autopilotTimer = setInterval(() => {
        if (!autopilotRunning)
            return;
        runCommunityAutopilot(config).catch(err => {
            log(`Autopilot cycle error: ${err instanceof Error ? err.message : String(err)}`);
        });
    }, interval);
    // Prevent the timer from keeping Node alive if this is the only reference
    if (autopilotTimer && typeof autopilotTimer === 'object' && 'unref' in autopilotTimer) {
        autopilotTimer.unref();
    }
}
/**
 * Stop the community autopilot daemon.
 */
export function stopAutopilot() {
    if (!autopilotRunning) {
        log('Autopilot is not running.');
        return;
    }
    if (autopilotTimer) {
        clearInterval(autopilotTimer);
        autopilotTimer = null;
    }
    autopilotRunning = false;
    log('Autopilot stopped.');
}
/**
 * Check if the autopilot daemon is currently running.
 */
export function isAutopilotRunning() {
    return autopilotRunning;
}
/**
 * Get the current autopilot state (for debugging / monitoring).
 */
export function getAutopilotState() {
    return loadState();
}
//# sourceMappingURL=community-autopilot.js.map