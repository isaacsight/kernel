// kbot Deploy-All — Single command to ship everything
//
// Commands:
//   deploy_all        — Build web + deploy GH Pages + edge functions + npm + GitHub release
//   deploy_web        — Build and deploy web to GitHub Pages
//   deploy_functions   — Deploy all Supabase edge functions
//   deploy_npm        — Build and publish kbot to npm
//   deploy_release    — Create GitHub release from latest tag
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { registerTool } from './index.js';
// ── Helpers ──────────────────────────────────────────────────────────
function shell(cmd, cwd, timeout = 120_000) {
    try {
        const output = execSync(cmd, {
            encoding: 'utf-8', cwd, timeout,
            maxBuffer: 10 * 1024 * 1024,
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        return { ok: true, output };
    }
    catch (e) {
        const err = e;
        return { ok: false, output: err.stderr || err.stdout || err.message || 'unknown error' };
    }
}
function findProjectRoot() {
    let dir = process.cwd();
    for (let i = 0; i < 10; i++) {
        if (existsSync(join(dir, 'packages', 'kbot', 'package.json')))
            return dir;
        if (existsSync(join(dir, 'package.json')) && existsSync(join(dir, 'supabase')))
            return dir;
        dir = join(dir, '..');
    }
    return process.cwd();
}
function getVersion(root) {
    const pkg = join(root, 'packages', 'kbot', 'package.json');
    if (existsSync(pkg)) {
        return JSON.parse(readFileSync(pkg, 'utf-8')).version;
    }
    return 'unknown';
}
async function runStep(name, cmd, cwd, timeout = 120_000) {
    const start = Date.now();
    const result = shell(cmd, cwd, timeout);
    return {
        step: name,
        ok: result.ok,
        output: result.output.slice(0, 500),
        duration: Date.now() - start,
    };
}
function formatResults(results, title) {
    const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
    const passed = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;
    const lines = results.map(r => {
        const icon = r.ok ? '✓' : '✗';
        const time = `${(r.duration / 1000).toFixed(1)}s`;
        const detail = r.ok ? '' : `\n    ${r.output.split('\n')[0]}`;
        return `  ${icon} ${r.step.padEnd(30)} ${time}${detail}`;
    });
    return [
        `── ${title} ──`,
        `  ${passed} passed / ${failed} failed / ${(totalTime / 1000).toFixed(1)}s total`,
        ``,
        ...lines,
    ].join('\n');
}
// ── Tools ────────────────────────────────────────────────────────────
export function registerDeployAllTools() {
    let count = 0;
    registerTool({
        name: 'deploy_all',
        description: 'Ship everything: type-check → build web → deploy GH Pages → deploy edge functions → publish npm → create GitHub release. Stops on first failure.',
        parameters: {
            skip: { type: 'string', description: 'Comma-separated steps to skip: "web", "functions", "npm", "release"' },
            dry_run: { type: 'string', description: 'If "true", show what would happen without executing' },
        },
        tier: 'enterprise',
        execute: async (args) => {
            const root = findProjectRoot();
            const kbotDir = join(root, 'packages', 'kbot');
            const version = getVersion(root);
            const skip = new Set(String(args.skip || '').split(',').map(s => s.trim()));
            const dryRun = String(args.dry_run) === 'true';
            if (dryRun) {
                const steps = [
                    !skip.has('typecheck') && '1. Type-check (tsc --noEmit)',
                    !skip.has('web') && '2. Build web (npm run build)',
                    !skip.has('web') && '3. Deploy web (gh-pages)',
                    !skip.has('functions') && '4. Deploy edge functions (supabase functions deploy)',
                    !skip.has('npm') && '5. Publish npm (@kernel.chat/kbot)',
                    !skip.has('release') && '6. Create GitHub release (v' + version + ')',
                ].filter(Boolean);
                return `── Dry Run: deploy_all v${version} ──\n\n${steps.join('\n')}\n\nUse without dry_run to execute.`;
            }
            const results = [];
            // 1. Type-check
            if (!skip.has('typecheck')) {
                const r = await runStep('Type-check (kbot)', 'npx tsc --noEmit', kbotDir, 180_000);
                results.push(r);
                if (!r.ok)
                    return formatResults(results, `Deploy FAILED at type-check v${version}`);
            }
            // 2. Build web
            if (!skip.has('web')) {
                const r = await runStep('Build web', 'npm run build', root, 180_000);
                results.push(r);
                if (!r.ok)
                    return formatResults(results, `Deploy FAILED at web build v${version}`);
            }
            // 3. Deploy web to GH Pages
            if (!skip.has('web')) {
                const r = await runStep('Deploy GH Pages', 'npm run deploy', root, 180_000);
                results.push(r);
                if (!r.ok)
                    return formatResults(results, `Deploy FAILED at GH Pages v${version}`);
            }
            // 4. Deploy edge functions
            if (!skip.has('functions')) {
                const projectRef = 'eoxxpyixdieprsxlpwcs';
                const functionsDir = join(root, 'supabase', 'functions');
                if (existsSync(functionsDir)) {
                    // Get list of functions
                    const functions = ['claude-proxy', 'web-search', 'create-checkout', 'stripe-webhook',
                        'evaluate-chat', 'extract-insights', 'send-inquiry-email', 'create-portal',
                        'url-fetch', 'notify-webhook', 'delete-account', 'shared-conversation',
                        'task-scheduler', 'send-notification', 'send-announcement', 'import-conversation'];
                    for (const fn of functions) {
                        if (existsSync(join(functionsDir, fn))) {
                            const r = await runStep(`Deploy fn: ${fn}`, `npx supabase functions deploy ${fn} --project-ref ${projectRef}`, root, 60_000);
                            results.push(r);
                            // Don't stop on individual function failures
                        }
                    }
                }
            }
            // 5. Publish npm
            if (!skip.has('npm')) {
                const buildR = await runStep('Build kbot', 'npm run build', kbotDir, 120_000);
                results.push(buildR);
                if (buildR.ok) {
                    const pubR = await runStep('Publish npm', 'npm publish --access public', kbotDir, 60_000);
                    results.push(pubR);
                }
            }
            // 6. GitHub release
            if (!skip.has('release')) {
                const tag = `v${version}`;
                const r = await runStep('GitHub release', `gh release create "${tag}" --title "kbot ${tag}" --notes "Release ${tag}" --target main`, root, 30_000);
                results.push(r);
            }
            return formatResults(results, `Deploy Complete v${version}`);
        },
    });
    count++;
    registerTool({
        name: 'deploy_web',
        description: 'Build and deploy the kernel.chat web companion to GitHub Pages.',
        parameters: {},
        tier: 'pro',
        execute: async () => {
            const root = findProjectRoot();
            const results = [];
            results.push(await runStep('Build', 'npm run build', root, 180_000));
            if (!results[0].ok)
                return formatResults(results, 'Web Deploy FAILED');
            results.push(await runStep('Deploy', 'npm run deploy', root, 180_000));
            return formatResults(results, 'Web Deploy');
        },
    });
    count++;
    registerTool({
        name: 'deploy_functions',
        description: 'Deploy all Supabase edge functions to production.',
        parameters: {
            function_name: { type: 'string', description: 'Deploy specific function only (optional)' },
        },
        tier: 'enterprise',
        execute: async (args) => {
            const root = findProjectRoot();
            const projectRef = 'eoxxpyixdieprsxlpwcs';
            const functionsDir = join(root, 'supabase', 'functions');
            const results = [];
            if (args.function_name) {
                const fn = String(args.function_name);
                results.push(await runStep(`Deploy ${fn}`, `npx supabase functions deploy ${fn} --project-ref ${projectRef}`, root, 60_000));
            }
            else {
                // Deploy all
                const functions = ['claude-proxy', 'web-search', 'create-checkout', 'stripe-webhook',
                    'evaluate-chat', 'extract-insights', 'send-inquiry-email', 'create-portal',
                    'url-fetch', 'notify-webhook', 'delete-account', 'shared-conversation',
                    'task-scheduler', 'send-notification', 'send-announcement', 'import-conversation'];
                for (const fn of functions) {
                    if (existsSync(join(functionsDir, fn))) {
                        results.push(await runStep(fn, `npx supabase functions deploy ${fn} --project-ref ${projectRef}`, root, 60_000));
                    }
                }
            }
            return formatResults(results, 'Edge Functions Deploy');
        },
    });
    count++;
    registerTool({
        name: 'deploy_npm',
        description: 'Build and publish @kernel.chat/kbot to npm.',
        parameters: {
            dry_run: { type: 'string', description: 'If "true", build but do not publish' },
        },
        tier: 'enterprise',
        execute: async (args) => {
            const root = findProjectRoot();
            const kbotDir = join(root, 'packages', 'kbot');
            const version = getVersion(root);
            const results = [];
            results.push(await runStep('Type-check', 'npx tsc --noEmit', kbotDir, 180_000));
            if (!results[0].ok)
                return formatResults(results, `npm Publish FAILED v${version}`);
            results.push(await runStep('Build', 'npm run build', kbotDir, 120_000));
            if (!results[1].ok)
                return formatResults(results, `npm Publish FAILED v${version}`);
            if (String(args.dry_run) === 'true') {
                results.push({ step: 'Publish (dry run)', ok: true, output: 'Skipped — dry run', duration: 0 });
            }
            else {
                results.push(await runStep('Publish', 'npm publish --access public', kbotDir, 60_000));
            }
            return formatResults(results, `npm Publish v${version}`);
        },
    });
    count++;
    registerTool({
        name: 'deploy_release',
        description: 'Create a GitHub release for the current kbot version.',
        parameters: {
            notes: { type: 'string', description: 'Release notes (optional — auto-generated from git log if empty)' },
        },
        tier: 'enterprise',
        execute: async (args) => {
            const root = findProjectRoot();
            const version = getVersion(root);
            const tag = `v${version}`;
            let notes = String(args.notes || '');
            if (!notes) {
                // Auto-generate from recent commits
                const { ok, output } = shell('git log --oneline -10', root);
                notes = ok ? `Release ${tag}\n\nRecent changes:\n${output}` : `Release ${tag}`;
            }
            const result = await runStep('Create release', `gh release create "${tag}" --title "kbot ${tag}" --notes "${notes.replace(/"/g, '\\"')}" --target main`, root, 30_000);
            return formatResults([result], `GitHub Release ${tag}`);
        },
    });
    count++;
    return count;
}
//# sourceMappingURL=deploy-all.js.map