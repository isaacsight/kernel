// kbot Env Manager — Manage environment variables and secrets from the terminal
//
// Commands:
//   env_check     — Verify all required env vars are set
//   env_list      — List Supabase secrets (digests only)
//   env_set       — Set a Supabase secret
//   env_sync      — Sync local .env to Supabase secrets
//   env_rotate    — Rotate an API key (generate new, update secret)
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { registerTool } from './index.js';
// ── Helpers ──────────────────────────────────────────────────────────
function shell(cmd, timeout = 30_000) {
    try {
        const output = execSync(cmd, { encoding: 'utf-8', timeout, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
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
        if (existsSync(join(dir, 'supabase')))
            return dir;
        if (existsSync(join(dir, '.env')))
            return dir;
        dir = join(dir, '..');
    }
    return process.cwd();
}
const PROJECT_REF = 'eoxxpyixdieprsxlpwcs';
// ── Tools ────────────────────────────────────────────────────────────
export function registerEnvTools() {
    let count = 0;
    registerTool({
        name: 'env_check',
        description: 'Verify all required environment variables and secrets are configured. Reports missing or invalid vars.',
        parameters: {},
        tier: 'free',
        execute: async () => {
            const root = findProjectRoot();
            const results = [];
            // Check local .env
            const envPath = join(root, '.env');
            const envVars = {};
            if (existsSync(envPath)) {
                const lines = readFileSync(envPath, 'utf-8').split('\n');
                for (const line of lines) {
                    const match = line.match(/^([A-Z_]+)=(.+)/);
                    if (match)
                        envVars[match[1]] = match[2];
                }
            }
            // Required vars
            const required = [
                { name: 'VITE_SUPABASE_URL', source: '.env' },
                { name: 'VITE_SUPABASE_KEY', source: '.env' },
                { name: 'SUPABASE_SERVICE_KEY', source: '.env' },
            ];
            for (const v of required) {
                const value = envVars[v.name] || process.env[v.name];
                results.push({
                    name: v.name,
                    status: value ? '✓ SET' : '✗ MISSING',
                    source: v.source,
                });
            }
            // Check Supabase remote secrets
            const remoteRequired = [
                'ANTHROPIC_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
                'RESEND_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY',
            ];
            const { ok, output } = shell(`npx supabase secrets list --project-ref ${PROJECT_REF}`);
            if (ok) {
                for (const name of remoteRequired) {
                    const found = output.includes(name);
                    results.push({
                        name,
                        status: found ? '✓ SET' : '✗ MISSING',
                        source: 'supabase',
                    });
                }
            }
            else {
                results.push({ name: 'SUPABASE_SECRETS', status: '⚠ Cannot check', source: 'supabase' });
            }
            // Check kbot config
            const kbotConfig = join(process.env.HOME || '~', '.kbot', 'config.json');
            results.push({
                name: 'kbot config',
                status: existsSync(kbotConfig) ? '✓ EXISTS' : '✗ MISSING (run kbot auth)',
                source: '~/.kbot/',
            });
            // Check CLI tools
            for (const tool of ['gh', 'stripe', 'npx']) {
                const { ok: toolOk } = shell(`which ${tool}`);
                results.push({
                    name: `CLI: ${tool}`,
                    status: toolOk ? '✓ INSTALLED' : '✗ NOT FOUND',
                    source: 'system',
                });
            }
            const missing = results.filter(r => r.status.startsWith('✗'));
            const header = missing.length === 0
                ? '── Environment Check: ALL GOOD ──'
                : `── Environment Check: ${missing.length} MISSING ──`;
            return header + '\n\n' +
                results.map(r => `  ${r.status.padEnd(12)} ${r.name.padEnd(30)} (${r.source})`).join('\n');
        },
    });
    count++;
    registerTool({
        name: 'env_list',
        description: 'List all Supabase secrets (shows names and digest hashes, not values).',
        parameters: {},
        tier: 'enterprise',
        execute: async () => {
            const { ok, output } = shell(`npx supabase secrets list --project-ref ${PROJECT_REF}`);
            if (!ok)
                return `Error listing secrets: ${output}`;
            return `── Supabase Secrets ──\n\n${output}`;
        },
    });
    count++;
    registerTool({
        name: 'env_set',
        description: 'Set a Supabase secret. Value is encrypted at rest.',
        parameters: {
            name: { type: 'string', description: 'Secret name (e.g. ANTHROPIC_API_KEY)', required: true },
            value: { type: 'string', description: 'Secret value', required: true },
        },
        tier: 'enterprise',
        execute: async (args) => {
            const name = String(args.name);
            const value = String(args.value);
            // Safety check
            if (name.includes(' ') || name.includes('='))
                return 'Error: invalid secret name';
            const { ok, output } = shell(`npx supabase secrets set ${name}="${value}" --project-ref ${PROJECT_REF}`);
            if (!ok)
                return `Error setting secret: ${output}`;
            return `✓ Secret ${name} set successfully.\n\nTo verify: kbot env list`;
        },
    });
    count++;
    registerTool({
        name: 'env_sync',
        description: 'Sync specific keys from local .env to Supabase secrets.',
        parameters: {
            keys: { type: 'string', description: 'Comma-separated key names to sync (or "all" for all)', required: true },
            dry_run: { type: 'string', description: 'If "true", show what would be synced without executing' },
        },
        tier: 'enterprise',
        execute: async (args) => {
            const root = findProjectRoot();
            const envPath = join(root, '.env');
            if (!existsSync(envPath))
                return 'Error: no .env file found';
            const envVars = {};
            const lines = readFileSync(envPath, 'utf-8').split('\n');
            for (const line of lines) {
                const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)/);
                if (match)
                    envVars[match[1]] = match[2].replace(/^["']|["']$/g, '');
            }
            const requestedKeys = String(args.keys) === 'all'
                ? Object.keys(envVars)
                : String(args.keys).split(',').map(k => k.trim());
            const toSync = requestedKeys.filter(k => envVars[k]);
            const missing = requestedKeys.filter(k => !envVars[k]);
            const dryRun = String(args.dry_run) === 'true';
            if (dryRun) {
                return [
                    `── Dry Run: env sync ──`,
                    `  Would sync ${toSync.length} secrets:`,
                    ...toSync.map(k => `    ${k} = ${envVars[k].slice(0, 4)}...`),
                    missing.length ? `\n  Missing from .env: ${missing.join(', ')}` : '',
                ].join('\n');
            }
            // Sync each key
            const results = [];
            for (const key of toSync) {
                const { ok } = shell(`npx supabase secrets set ${key}="${envVars[key]}" --project-ref ${PROJECT_REF}`);
                results.push(`  ${ok ? '✓' : '✗'} ${key}`);
            }
            return [
                `── Env Sync ──`,
                `  Synced ${toSync.length} secrets to Supabase:`,
                ...results,
                missing.length ? `\n  Missing from .env: ${missing.join(', ')}` : '',
            ].join('\n');
        },
    });
    count++;
    registerTool({
        name: 'env_rotate',
        description: 'Rotate a secret: generates a reminder of what to update after changing a key at its source.',
        parameters: {
            key: { type: 'string', description: 'Secret name to rotate (e.g. ANTHROPIC_API_KEY)', required: true },
            new_value: { type: 'string', description: 'New value (if already generated at source)' },
        },
        tier: 'enterprise',
        execute: async (args) => {
            const key = String(args.key);
            const newValue = args.new_value ? String(args.new_value) : null;
            const rotationGuide = {
                ANTHROPIC_API_KEY: '1. Go to console.anthropic.com → API Keys\n  2. Create new key\n  3. Run: kbot env set ANTHROPIC_API_KEY=<new_key>\n  4. Delete old key in console',
                STRIPE_SECRET_KEY: '1. Go to dashboard.stripe.com → Developers → API Keys\n  2. Roll key\n  3. Run: kbot env set STRIPE_SECRET_KEY=<new_key>',
                RESEND_API_KEY: '1. Go to resend.com → API Keys\n  2. Create new key\n  3. Run: kbot env set RESEND_API_KEY=<new_key>\n  4. Delete old key',
                SUPABASE_SERVICE_ROLE_KEY: '⚠ WARNING: Rotating this breaks all edge functions.\n  1. Go to supabase.com → Project Settings → API\n  2. The service role key cannot be rotated without recreating the project.',
            };
            if (newValue) {
                const { ok, output } = shell(`npx supabase secrets set ${key}="${newValue}" --project-ref ${PROJECT_REF}`);
                if (!ok)
                    return `Error: ${output}`;
                return `✓ Rotated ${key} successfully.\n\nRemember to:\n  - Update local .env if applicable\n  - Redeploy affected edge functions: kbot deploy functions`;
            }
            const guide = rotationGuide[key];
            if (guide) {
                return `── Rotation Guide: ${key} ──\n\n  ${guide}`;
            }
            return [
                `── Rotation Guide: ${key} ──`,
                ``,
                `  1. Generate a new key at the provider`,
                `  2. Run: kbot env set ${key}=<new_value>`,
                `  3. Update local .env if applicable`,
                `  4. Redeploy: kbot deploy functions`,
                `  5. Delete old key at provider`,
            ].join('\n');
        },
    });
    count++;
    return count;
}
//# sourceMappingURL=env-manager.js.map