// kbot Deploy Tools — One-command deployment to Vercel, Netlify, Cloudflare, Fly.io, Railway
//
// Auto-detects the target platform from project config files and deploys.
// Also provides status, logs, rollback, and env management.
//
// Flow:
//   deploy          — auto-detect platform and ship
//   deploy_status   — check deployment status
//   deploy_logs     — fetch recent deploy logs
//   deploy_rollback — rollback to previous deployment
//   deploy_env      — manage environment variables
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { registerTool } from './index.js';
// ── Platform CLI mapping ─────────────────────────────────────────────
const PLATFORM_CLI = {
    vercel: {
        bin: 'vercel',
        installCmd: 'npm i -g vercel',
        checkArgs: ['--version'],
    },
    netlify: {
        bin: 'netlify',
        installCmd: 'npm i -g netlify-cli',
        checkArgs: ['--version'],
    },
    cloudflare: {
        bin: 'wrangler',
        installCmd: 'npm i -g wrangler',
        checkArgs: ['--version'],
    },
    fly: {
        bin: 'flyctl',
        installCmd: 'curl -L https://fly.io/install.sh | sh',
        checkArgs: ['version'],
    },
    railway: {
        bin: 'railway',
        installCmd: 'npm i -g @railway/cli',
        checkArgs: ['--version'],
    },
};
// ── Helpers ──────────────────────────────────────────────────────────
function shell(command, cwd, timeout = 120_000) {
    return execSync(command, {
        encoding: 'utf-8',
        cwd,
        timeout,
        maxBuffer: 10 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
}
function shellSafe(command, cwd, timeout = 120_000) {
    try {
        const output = shell(command, cwd, timeout);
        return { ok: true, output };
    }
    catch (err) {
        const e = err;
        const output = [e.stdout, e.stderr].filter(Boolean).join('\n').trim();
        return { ok: false, output: output || e.message || 'Command failed' };
    }
}
function isCLIInstalled(platform) {
    const cfg = PLATFORM_CLI[platform];
    try {
        execSync(`${cfg.bin} ${cfg.checkArgs.join(' ')}`, {
            encoding: 'utf-8',
            timeout: 10_000,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return true;
    }
    catch {
        return false;
    }
}
function resolveCwd(userPath) {
    if (userPath && typeof userPath === 'string' && existsSync(userPath))
        return userPath;
    return process.cwd();
}
/** Detect which deploy platform the project targets */
function detectDeployTarget(cwd) {
    // Vercel
    if (existsSync(join(cwd, 'vercel.json')) || existsSync(join(cwd, '.vercel'))) {
        return { platform: 'vercel', confidence: 'config-file', detail: 'Found vercel.json or .vercel/' };
    }
    // Netlify
    if (existsSync(join(cwd, 'netlify.toml')) || existsSync(join(cwd, '.netlify'))) {
        return { platform: 'netlify', confidence: 'config-file', detail: 'Found netlify.toml or .netlify/' };
    }
    // Cloudflare Workers/Pages
    if (existsSync(join(cwd, 'wrangler.toml')) || existsSync(join(cwd, 'wrangler.jsonc'))) {
        return { platform: 'cloudflare', confidence: 'config-file', detail: 'Found wrangler.toml or wrangler.jsonc' };
    }
    // Fly.io
    if (existsSync(join(cwd, 'fly.toml'))) {
        return { platform: 'fly', confidence: 'config-file', detail: 'Found fly.toml' };
    }
    // Railway
    if (existsSync(join(cwd, 'railway.json')) || existsSync(join(cwd, 'railway.toml'))) {
        return { platform: 'railway', confidence: 'config-file', detail: 'Found railway.json or railway.toml' };
    }
    // Dockerfile → suggest Fly.io (most Docker-friendly PaaS)
    if (existsSync(join(cwd, 'Dockerfile'))) {
        return { platform: 'fly', confidence: 'inferred', detail: 'Found Dockerfile — Fly.io is recommended for container deploys' };
    }
    // package.json with build script → suggest Vercel (best for frontend)
    const pkgPath = join(cwd, 'package.json');
    if (existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
            if (pkg.scripts?.build) {
                return { platform: 'vercel', confidence: 'inferred', detail: 'Found package.json with build script — Vercel is recommended for JS/TS projects' };
            }
        }
        catch { /* ignore parse errors */ }
    }
    return null;
}
/** Detect if a Cloudflare project is Workers or Pages */
function detectCloudflareType(cwd) {
    const wranglerToml = join(cwd, 'wrangler.toml');
    if (existsSync(wranglerToml)) {
        try {
            const content = readFileSync(wranglerToml, 'utf-8');
            if (content.includes('pages_build_output_dir') || content.includes('[site]')) {
                return 'pages';
            }
        }
        catch { /* fall through */ }
    }
    // Check for common static output dirs
    for (const dir of ['dist', 'build', 'out', 'public', '.next']) {
        if (existsSync(join(cwd, dir))) {
            return 'pages';
        }
    }
    return 'workers';
}
/** Extract a URL from deploy command output */
function extractUrl(output) {
    // Common patterns across platforms
    const patterns = [
        /https?:\/\/[^\s"'<>]+\.vercel\.app[^\s"'<>]*/i,
        /https?:\/\/[^\s"'<>]+\.netlify\.app[^\s"'<>]*/i,
        /https?:\/\/[^\s"'<>]+\.pages\.dev[^\s"'<>]*/i,
        /https?:\/\/[^\s"'<>]+\.workers\.dev[^\s"'<>]*/i,
        /https?:\/\/[^\s"'<>]+\.fly\.dev[^\s"'<>]*/i,
        /https?:\/\/[^\s"'<>]+\.up\.railway\.app[^\s"'<>]*/i,
        // Generic URL match as fallback
        /(?:Production|Preview|Deployed to|Live at|URL|Website):\s*(https?:\/\/[^\s"'<>]+)/i,
        /https?:\/\/[^\s"'<>]+/,
    ];
    for (const pattern of patterns) {
        const match = output.match(pattern);
        if (match)
            return match[1] || match[0];
    }
    return '(URL not detected in output)';
}
// ── Platform deploy implementations ──────────────────────────────────
function deployVercel(cwd, prod) {
    const startTime = Date.now();
    const flags = prod ? '--yes --prod' : '--yes';
    const { ok, output } = shellSafe(`vercel ${flags}`, cwd, 300_000);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    if (!ok) {
        return { platform: 'vercel', url: '', status: 'failed', duration: `${elapsed}s` };
    }
    return {
        platform: 'vercel',
        url: extractUrl(output),
        status: 'success',
        duration: `${elapsed}s`,
    };
}
function deployNetlify(cwd, prod) {
    const startTime = Date.now();
    const flags = prod ? 'deploy --prod --dir=.' : 'deploy --dir=.';
    // Netlify needs a build first if there's a build command
    const pkgPath = join(cwd, 'package.json');
    let deployDir = '.';
    if (existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
            if (pkg.scripts?.build) {
                shellSafe('npm run build', cwd, 300_000);
                // Detect output directory
                for (const dir of ['dist', 'build', 'out', '.next', 'public']) {
                    if (existsSync(join(cwd, dir))) {
                        deployDir = dir;
                        break;
                    }
                }
            }
        }
        catch { /* ignore */ }
    }
    // Also check netlify.toml for publish dir
    const netlifyToml = join(cwd, 'netlify.toml');
    if (existsSync(netlifyToml)) {
        try {
            const content = readFileSync(netlifyToml, 'utf-8');
            const publishMatch = content.match(/publish\s*=\s*"?([^"\s]+)"?/);
            if (publishMatch)
                deployDir = publishMatch[1];
        }
        catch { /* ignore */ }
    }
    const deployFlags = prod ? `deploy --prod --dir=${deployDir}` : `deploy --dir=${deployDir}`;
    const { ok, output } = shellSafe(`netlify ${deployFlags}`, cwd, 300_000);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    if (!ok) {
        return { platform: 'netlify', url: '', status: 'failed', duration: `${elapsed}s` };
    }
    return {
        platform: 'netlify',
        url: extractUrl(output),
        status: 'success',
        duration: `${elapsed}s`,
    };
}
function deployCloudflare(cwd, _prod) {
    const startTime = Date.now();
    const cfType = detectCloudflareType(cwd);
    let result;
    if (cfType === 'pages') {
        // Determine output dir from wrangler.toml or fallback
        let outputDir = 'dist';
        const wranglerToml = join(cwd, 'wrangler.toml');
        if (existsSync(wranglerToml)) {
            try {
                const content = readFileSync(wranglerToml, 'utf-8');
                const dirMatch = content.match(/pages_build_output_dir\s*=\s*"?([^"\s]+)"?/);
                if (dirMatch)
                    outputDir = dirMatch[1];
            }
            catch { /* ignore */ }
        }
        // Build first if there's a build script
        const pkgPath = join(cwd, 'package.json');
        if (existsSync(pkgPath)) {
            try {
                const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
                if (pkg.scripts?.build) {
                    shellSafe('npm run build', cwd, 300_000);
                }
            }
            catch { /* ignore */ }
        }
        result = shellSafe(`wrangler pages deploy ${outputDir}`, cwd, 300_000);
    }
    else {
        result = shellSafe('wrangler deploy', cwd, 300_000);
    }
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    if (!result.ok) {
        return { platform: 'cloudflare', url: '', status: 'failed', duration: `${elapsed}s` };
    }
    return {
        platform: 'cloudflare',
        url: extractUrl(result.output),
        status: 'success',
        duration: `${elapsed}s`,
    };
}
function deployFly(cwd, _prod) {
    const startTime = Date.now();
    const { ok, output } = shellSafe('flyctl deploy', cwd, 600_000);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    if (!ok) {
        return { platform: 'fly', url: '', status: 'failed', duration: `${elapsed}s` };
    }
    return {
        platform: 'fly',
        url: extractUrl(output),
        status: 'success',
        duration: `${elapsed}s`,
    };
}
function deployRailway(cwd, _prod) {
    const startTime = Date.now();
    const { ok, output } = shellSafe('railway up', cwd, 600_000);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    if (!ok) {
        return { platform: 'railway', url: '', status: 'failed', duration: `${elapsed}s` };
    }
    return {
        platform: 'railway',
        url: extractUrl(output),
        status: 'success',
        duration: `${elapsed}s`,
    };
}
const DEPLOYERS = {
    vercel: deployVercel,
    netlify: deployNetlify,
    cloudflare: deployCloudflare,
    fly: deployFly,
    railway: deployRailway,
};
// ── Tool registration ────────────────────────────────────────────────
export function registerDeployTools() {
    // ── deploy ─────────────────────────────────────────────────────────
    registerTool({
        name: 'deploy',
        description: 'Deploy the current project. Auto-detects platform from config files (vercel.json, netlify.toml, wrangler.toml, fly.toml, railway.json). Supports Vercel, Netlify, Cloudflare Workers/Pages, Fly.io, and Railway.',
        parameters: {
            path: { type: 'string', description: 'Project directory (default: cwd)' },
            platform: {
                type: 'string',
                description: 'Override auto-detection: vercel, netlify, cloudflare, fly, railway',
            },
            prod: {
                type: 'boolean',
                description: 'Deploy to production (default: true). Set false for preview/draft deploy.',
            },
        },
        tier: 'free',
        timeout: 600_000,
        async execute(args) {
            const cwd = resolveCwd(args.path);
            const prod = args.prod !== false;
            const lines = [];
            // Determine platform
            let platform;
            let detectionNote;
            if (args.platform) {
                const requested = String(args.platform).toLowerCase();
                if (!PLATFORM_CLI[requested]) {
                    return `Error: Unknown platform "${args.platform}". Supported: vercel, netlify, cloudflare, fly, railway`;
                }
                platform = requested;
                detectionNote = `Platform: ${platform} (user-specified)`;
            }
            else {
                const detected = detectDeployTarget(cwd);
                if (!detected) {
                    return [
                        'Could not auto-detect deploy platform. No config files found.',
                        '',
                        'Create one of these in your project root:',
                        '  - vercel.json     → Vercel',
                        '  - netlify.toml    → Netlify',
                        '  - wrangler.toml   → Cloudflare Workers/Pages',
                        '  - fly.toml        → Fly.io',
                        '  - railway.json    → Railway',
                        '',
                        'Or specify --platform explicitly: deploy --platform vercel',
                    ].join('\n');
                }
                platform = detected.platform;
                detectionNote = `Platform: ${platform} (${detected.confidence} — ${detected.detail})`;
            }
            lines.push(detectionNote);
            // Check CLI is installed
            if (!isCLIInstalled(platform)) {
                const cfg = PLATFORM_CLI[platform];
                return [
                    detectionNote,
                    '',
                    `Error: ${cfg.bin} CLI is not installed.`,
                    '',
                    'Install it with:',
                    `  ${cfg.installCmd}`,
                    '',
                    'Then run this deploy command again.',
                ].join('\n');
            }
            lines.push(`Mode: ${prod ? 'production' : 'preview'}`);
            lines.push(`Directory: ${cwd}`);
            lines.push('Deploying...');
            lines.push('');
            // Execute deploy
            const deployer = DEPLOYERS[platform];
            const result = deployer(cwd, prod);
            if (result.status === 'failed') {
                lines.push(`Deploy FAILED after ${result.duration}`);
                lines.push('');
                lines.push('Check the error output above. Common fixes:');
                lines.push('  - Ensure you are logged in: run the CLI login command');
                lines.push('  - Verify the project is linked to your account');
                lines.push('  - Check build configuration in your config file');
                return lines.join('\n');
            }
            lines.push(`Deploy SUCCESS in ${result.duration}`);
            lines.push(`URL: ${result.url}`);
            return lines.join('\n');
        },
    });
    // ── deploy_status ──────────────────────────────────────────────────
    registerTool({
        name: 'deploy_status',
        description: 'Check the current deployment status for a project. Shows the latest deployment state, URL, and any errors.',
        parameters: {
            path: { type: 'string', description: 'Project directory (default: cwd)' },
            platform: {
                type: 'string',
                description: 'Override auto-detection: vercel, netlify, cloudflare, fly, railway',
            },
        },
        tier: 'free',
        async execute(args) {
            const cwd = resolveCwd(args.path);
            let platform;
            if (args.platform) {
                const requested = String(args.platform).toLowerCase();
                if (!PLATFORM_CLI[requested]) {
                    return `Error: Unknown platform "${args.platform}". Supported: vercel, netlify, cloudflare, fly, railway`;
                }
                platform = requested;
            }
            else {
                const detected = detectDeployTarget(cwd);
                if (!detected)
                    return 'Could not auto-detect platform. Specify --platform.';
                platform = detected.platform;
            }
            if (!isCLIInstalled(platform)) {
                const cfg = PLATFORM_CLI[platform];
                return `Error: ${cfg.bin} CLI not installed. Install with: ${cfg.installCmd}`;
            }
            let result;
            switch (platform) {
                case 'vercel':
                    result = shellSafe('vercel ls --limit 5', cwd, 30_000);
                    if (!result.ok) {
                        // Try inspect on the latest
                        result = shellSafe('vercel inspect', cwd, 30_000);
                    }
                    break;
                case 'netlify':
                    result = shellSafe('netlify status', cwd, 30_000);
                    break;
                case 'cloudflare':
                    result = shellSafe('wrangler deployments list', cwd, 30_000);
                    break;
                case 'fly':
                    result = shellSafe('flyctl status', cwd, 30_000);
                    break;
                case 'railway':
                    result = shellSafe('railway status', cwd, 30_000);
                    break;
                default:
                    return `Unsupported platform: ${platform}`;
            }
            if (!result.ok) {
                return `Error fetching status for ${platform}:\n${result.output}`;
            }
            return `**${platform} deployment status**\n\n${result.output}`;
        },
    });
    // ── deploy_logs ────────────────────────────────────────────────────
    registerTool({
        name: 'deploy_logs',
        description: 'Fetch recent deployment logs. Shows build output, runtime logs, or error details from the deploy platform.',
        parameters: {
            path: { type: 'string', description: 'Project directory (default: cwd)' },
            platform: {
                type: 'string',
                description: 'Override auto-detection: vercel, netlify, cloudflare, fly, railway',
            },
            lines: {
                type: 'number',
                description: 'Number of log lines to fetch (default: 100)',
            },
        },
        tier: 'free',
        async execute(args) {
            const cwd = resolveCwd(args.path);
            const lineCount = typeof args.lines === 'number' ? args.lines : 100;
            let platform;
            if (args.platform) {
                const requested = String(args.platform).toLowerCase();
                if (!PLATFORM_CLI[requested]) {
                    return `Error: Unknown platform "${args.platform}". Supported: vercel, netlify, cloudflare, fly, railway`;
                }
                platform = requested;
            }
            else {
                const detected = detectDeployTarget(cwd);
                if (!detected)
                    return 'Could not auto-detect platform. Specify --platform.';
                platform = detected.platform;
            }
            if (!isCLIInstalled(platform)) {
                const cfg = PLATFORM_CLI[platform];
                return `Error: ${cfg.bin} CLI not installed. Install with: ${cfg.installCmd}`;
            }
            let result;
            switch (platform) {
                case 'vercel':
                    // Vercel logs require a deployment URL — try to get the latest
                    result = shellSafe('vercel logs --limit 1', cwd, 30_000);
                    if (!result.ok) {
                        // Fallback: list deployments and grab the first URL
                        const listResult = shellSafe('vercel ls --limit 1', cwd, 15_000);
                        if (listResult.ok) {
                            const url = extractUrl(listResult.output);
                            if (url && url.startsWith('http')) {
                                result = shellSafe(`vercel logs ${url}`, cwd, 30_000);
                            }
                        }
                    }
                    break;
                case 'netlify':
                    result = shellSafe('netlify deploy --open=false --json 2>&1 | head -50', cwd, 30_000);
                    // Netlify doesn't have a direct "logs" CLI — fetch via status
                    if (!result.ok) {
                        result = shellSafe('netlify status --verbose', cwd, 30_000);
                    }
                    break;
                case 'cloudflare':
                    result = shellSafe('wrangler tail --format json --once 2>&1 || wrangler deployments list', cwd, 30_000);
                    break;
                case 'fly':
                    result = shellSafe(`flyctl logs --no-tail -n ${lineCount}`, cwd, 30_000);
                    break;
                case 'railway':
                    result = shellSafe(`railway logs --lines ${lineCount}`, cwd, 30_000);
                    break;
                default:
                    return `Unsupported platform: ${platform}`;
            }
            if (!result.ok) {
                return `Error fetching logs for ${platform}:\n${result.output}`;
            }
            return `**${platform} deploy logs** (last ${lineCount} lines)\n\n${result.output}`;
        },
    });
    // ── deploy_rollback ────────────────────────────────────────────────
    registerTool({
        name: 'deploy_rollback',
        description: 'Rollback to the previous deployment. Promotes the last known-good deployment to production.',
        parameters: {
            path: { type: 'string', description: 'Project directory (default: cwd)' },
            platform: {
                type: 'string',
                description: 'Override auto-detection: vercel, netlify, cloudflare, fly, railway',
            },
            deployment_id: {
                type: 'string',
                description: 'Specific deployment ID/URL to rollback to (optional — defaults to previous)',
            },
        },
        tier: 'free',
        timeout: 300_000,
        async execute(args) {
            const cwd = resolveCwd(args.path);
            const deploymentId = args.deployment_id ? String(args.deployment_id) : '';
            let platform;
            if (args.platform) {
                const requested = String(args.platform).toLowerCase();
                if (!PLATFORM_CLI[requested]) {
                    return `Error: Unknown platform "${args.platform}". Supported: vercel, netlify, cloudflare, fly, railway`;
                }
                platform = requested;
            }
            else {
                const detected = detectDeployTarget(cwd);
                if (!detected)
                    return 'Could not auto-detect platform. Specify --platform.';
                platform = detected.platform;
            }
            if (!isCLIInstalled(platform)) {
                const cfg = PLATFORM_CLI[platform];
                return `Error: ${cfg.bin} CLI not installed. Install with: ${cfg.installCmd}`;
            }
            let result;
            switch (platform) {
                case 'vercel': {
                    if (deploymentId) {
                        result = shellSafe(`vercel promote ${deploymentId}`, cwd, 120_000);
                    }
                    else {
                        // List deployments, grab the second one (previous), promote it
                        const listResult = shellSafe('vercel ls --limit 5', cwd, 15_000);
                        if (!listResult.ok) {
                            return `Error listing Vercel deployments:\n${listResult.output}`;
                        }
                        // Extract URLs from the list — the second production URL is the rollback target
                        const urls = listResult.output.match(/https?:\/\/[^\s]+\.vercel\.app/g);
                        if (!urls || urls.length < 2) {
                            return `Cannot rollback: need at least 2 deployments. Found ${urls?.length || 0}.\n\nDeployments:\n${listResult.output}`;
                        }
                        result = shellSafe(`vercel promote ${urls[1]}`, cwd, 120_000);
                    }
                    break;
                }
                case 'netlify': {
                    if (deploymentId) {
                        result = shellSafe(`netlify deploy --prod --deploy-id ${deploymentId}`, cwd, 120_000);
                    }
                    else {
                        // List deploys and rollback to previous
                        const listResult = shellSafe('netlify api listSiteDeploys --data \'{"site_id":"auto","per_page":5}\'', cwd, 15_000);
                        if (!listResult.ok) {
                            // Fallback: use netlify rollback if available
                            result = shellSafe('netlify rollback', cwd, 120_000);
                        }
                        else {
                            // Parse deploy IDs from the output
                            try {
                                const deploys = JSON.parse(listResult.output);
                                if (Array.isArray(deploys) && deploys.length >= 2) {
                                    const prevId = deploys[1].id;
                                    result = shellSafe(`netlify api restoreSiteDeploy --data '{"site_id":"auto","deploy_id":"${prevId}"}'`, cwd, 120_000);
                                }
                                else {
                                    result = { ok: false, output: 'Need at least 2 deployments to rollback.' };
                                }
                            }
                            catch {
                                result = shellSafe('netlify rollback', cwd, 120_000);
                            }
                        }
                    }
                    break;
                }
                case 'cloudflare': {
                    if (deploymentId) {
                        result = shellSafe(`wrangler rollback ${deploymentId}`, cwd, 120_000);
                    }
                    else {
                        result = shellSafe('wrangler rollback', cwd, 120_000);
                    }
                    break;
                }
                case 'fly': {
                    // Fly uses release numbers
                    if (deploymentId) {
                        result = shellSafe(`flyctl releases rollback ${deploymentId}`, cwd, 120_000);
                    }
                    else {
                        // List releases and rollback to previous
                        const listResult = shellSafe('flyctl releases --json', cwd, 15_000);
                        if (!listResult.ok) {
                            result = { ok: false, output: `Error listing releases:\n${listResult.output}` };
                        }
                        else {
                            try {
                                const releases = JSON.parse(listResult.output);
                                if (Array.isArray(releases) && releases.length >= 2) {
                                    const prevVersion = releases[1].Version || releases[1].version;
                                    result = shellSafe(`flyctl releases rollback ${prevVersion}`, cwd, 120_000);
                                }
                                else {
                                    result = { ok: false, output: 'Need at least 2 releases to rollback.' };
                                }
                            }
                            catch {
                                // Fallback: rollback without specifying version (Fly picks previous)
                                result = shellSafe('flyctl releases rollback', cwd, 120_000);
                            }
                        }
                    }
                    break;
                }
                case 'railway': {
                    if (deploymentId) {
                        result = shellSafe(`railway rollback ${deploymentId}`, cwd, 120_000);
                    }
                    else {
                        result = shellSafe('railway rollback', cwd, 120_000);
                    }
                    break;
                }
                default:
                    return `Unsupported platform: ${platform}`;
            }
            if (!result.ok) {
                return `Rollback FAILED on ${platform}:\n${result.output}`;
            }
            return `**Rollback SUCCESS on ${platform}**\n\n${result.output}`;
        },
    });
    // ── deploy_env ─────────────────────────────────────────────────────
    registerTool({
        name: 'deploy_env',
        description: 'Manage environment variables on the deploy platform. List, set, or remove env vars for production/preview environments.',
        parameters: {
            path: { type: 'string', description: 'Project directory (default: cwd)' },
            platform: {
                type: 'string',
                description: 'Override auto-detection: vercel, netlify, cloudflare, fly, railway',
            },
            action: {
                type: 'string',
                description: 'Action: list, set, remove (default: list)',
                required: true,
            },
            key: { type: 'string', description: 'Environment variable name (required for set/remove)' },
            value: { type: 'string', description: 'Environment variable value (required for set)' },
            environment: {
                type: 'string',
                description: 'Target environment: production, preview, development (default: production)',
            },
        },
        tier: 'free',
        async execute(args) {
            const cwd = resolveCwd(args.path);
            const action = String(args.action || 'list').toLowerCase();
            const key = args.key ? String(args.key) : '';
            const value = args.value ? String(args.value) : '';
            const environment = String(args.environment || 'production').toLowerCase();
            if ((action === 'set' || action === 'remove') && !key) {
                return `Error: --key is required for ${action} action.`;
            }
            if (action === 'set' && !value) {
                return 'Error: --value is required for set action.';
            }
            let platform;
            if (args.platform) {
                const requested = String(args.platform).toLowerCase();
                if (!PLATFORM_CLI[requested]) {
                    return `Error: Unknown platform "${args.platform}". Supported: vercel, netlify, cloudflare, fly, railway`;
                }
                platform = requested;
            }
            else {
                const detected = detectDeployTarget(cwd);
                if (!detected)
                    return 'Could not auto-detect platform. Specify --platform.';
                platform = detected.platform;
            }
            if (!isCLIInstalled(platform)) {
                const cfg = PLATFORM_CLI[platform];
                return `Error: ${cfg.bin} CLI not installed. Install with: ${cfg.installCmd}`;
            }
            let result;
            switch (platform) {
                case 'vercel': {
                    const envFlag = environment === 'preview' ? 'preview' : environment === 'development' ? 'development' : 'production';
                    if (action === 'list') {
                        result = shellSafe(`vercel env ls ${envFlag}`, cwd, 15_000);
                    }
                    else if (action === 'set') {
                        // Vercel env add reads value from stdin
                        result = shellSafe(`echo "${value}" | vercel env add ${key} ${envFlag}`, cwd, 15_000);
                    }
                    else if (action === 'remove') {
                        result = shellSafe(`vercel env rm ${key} ${envFlag} --yes`, cwd, 15_000);
                    }
                    else {
                        return `Unknown action "${action}". Use: list, set, remove`;
                    }
                    break;
                }
                case 'netlify': {
                    if (action === 'list') {
                        result = shellSafe('netlify env:list', cwd, 15_000);
                    }
                    else if (action === 'set') {
                        result = shellSafe(`netlify env:set ${key} "${value}"`, cwd, 15_000);
                    }
                    else if (action === 'remove') {
                        result = shellSafe(`netlify env:unset ${key}`, cwd, 15_000);
                    }
                    else {
                        return `Unknown action "${action}". Use: list, set, remove`;
                    }
                    break;
                }
                case 'cloudflare': {
                    if (action === 'list') {
                        result = shellSafe('wrangler secret list', cwd, 15_000);
                    }
                    else if (action === 'set') {
                        // Wrangler secret put reads from stdin
                        result = shellSafe(`echo "${value}" | wrangler secret put ${key}`, cwd, 15_000);
                    }
                    else if (action === 'remove') {
                        result = shellSafe(`wrangler secret delete ${key} --force`, cwd, 15_000);
                    }
                    else {
                        return `Unknown action "${action}". Use: list, set, remove`;
                    }
                    break;
                }
                case 'fly': {
                    if (action === 'list') {
                        result = shellSafe('flyctl secrets list', cwd, 15_000);
                    }
                    else if (action === 'set') {
                        result = shellSafe(`flyctl secrets set ${key}="${value}"`, cwd, 30_000);
                    }
                    else if (action === 'remove') {
                        result = shellSafe(`flyctl secrets unset ${key}`, cwd, 30_000);
                    }
                    else {
                        return `Unknown action "${action}". Use: list, set, remove`;
                    }
                    break;
                }
                case 'railway': {
                    if (action === 'list') {
                        result = shellSafe('railway variables', cwd, 15_000);
                    }
                    else if (action === 'set') {
                        result = shellSafe(`railway variables set ${key}="${value}"`, cwd, 15_000);
                    }
                    else if (action === 'remove') {
                        result = shellSafe(`railway variables delete ${key}`, cwd, 15_000);
                    }
                    else {
                        return `Unknown action "${action}". Use: list, set, remove`;
                    }
                    break;
                }
                default:
                    return `Unsupported platform: ${platform}`;
            }
            if (!result.ok) {
                return `Error managing env vars on ${platform}:\n${result.output}`;
            }
            const actionPast = action === 'list' ? 'listed' : action === 'set' ? 'set' : 'removed';
            return `**${platform} env ${actionPast}** (${environment})\n\n${result.output}`;
        },
    });
}
//# sourceMappingURL=deploy.js.map