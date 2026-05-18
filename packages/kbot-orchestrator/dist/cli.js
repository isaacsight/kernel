#!/usr/bin/env node
// kbot-orchestrator CLI
//
// Usage:
//   kbot-orchestrator outreach --briefing <path> [--tier "Tier 1"] [--name "Loukides"]
//                              [--limit 5] [--confirm] [--from <email>]
//                              [--name "Display Name"] [--keychain <service>]
//                              [--delay 500]
//
// Default is dry-run. --confirm sends. Without --confirm, the run prints a
// list of pending recipients that would be sent, so a human can review.
import { runOutreach } from './outreach.js';
import { parseArgs } from 'node:util';
function parseCli() {
    const positionals = process.argv.slice(2);
    const command = positionals[0] ?? 'help';
    const { values } = parseArgs({
        args: positionals.slice(1),
        options: {
            briefing: { type: 'string', short: 'b' },
            tier: { type: 'string', short: 't' },
            name: { type: 'string', short: 'n' },
            limit: { type: 'string', short: 'l' },
            confirm: { type: 'boolean', default: false },
            from: { type: 'string', default: 'isaacsight@gmail.com' },
            'display-name': { type: 'string', default: 'Isaac Hernandez' },
            keychain: { type: 'string', default: 'kbot-gmail-app-password' },
            delay: { type: 'string', default: '500' },
        },
        strict: false,
    });
    const args = {
        briefing: values['briefing'] ?? '',
        confirm: Boolean(values['confirm']),
        from: values['from'] ?? 'isaacsight@gmail.com',
        displayName: values['display-name'] ?? 'Isaac Hernandez',
        keychain: values['keychain'] ?? 'kbot-gmail-app-password',
        delay: Number(values['delay'] ?? '500'),
    };
    const tierVal = values['tier'];
    const nameVal = values['name'];
    const limitVal = values['limit'];
    if (tierVal)
        args.tier = tierVal;
    if (nameVal)
        args.name = nameVal;
    if (limitVal != null)
        args.limit = Number(limitVal);
    return { command, args };
}
async function cmdOutreach(args) {
    if (!args.briefing) {
        console.error('Required: --briefing <path-to-briefing.md>');
        process.exit(1);
    }
    const opts = {
        briefingPath: args.briefing,
        sender: {
            email: args.from,
            name: args.displayName,
            keychainService: args.keychain,
        },
        confirm: args.confirm,
        delayMs: args.delay,
    };
    if (args.tier)
        opts.tier = args.tier;
    if (args.name)
        opts.nameMatches = args.name;
    if (args.limit != null)
        opts.limit = args.limit;
    const result = await runOutreach(opts);
    if (result.dryRun) {
        console.log(`[DRY RUN] Would send ${result.considered.length} message(s) from ${args.briefing}:`);
        for (const r of result.considered) {
            const tier = r.tier ? ` [${r.tier}]` : '';
            console.log(`  → ${r.name}${tier}  ${r.to}`);
            console.log(`    "${r.subject}"`);
        }
        console.log();
        console.log('To actually send, add --confirm.');
        return;
    }
    let sentCount = 0;
    let failCount = 0;
    for (const { recipient, result: sendResult } of result.sent) {
        if (sendResult.ok) {
            sentCount++;
            const id = sendResult.messageId ? ` ${sendResult.messageId}` : '';
            console.log(`✓ ${recipient.name} <${recipient.to}>${id}`);
        }
        else {
            failCount++;
            console.log(`✗ ${recipient.name} <${recipient.to}>: ${sendResult.error ?? 'failed'}`);
        }
    }
    console.log();
    console.log(`Sent ${sentCount}; failed ${failCount}; log appended to ${args.briefing}`);
}
function cmdHelp() {
    console.log(`
kbot-orchestrator — reference implementation of orchestration engineering

Commands:
  outreach    Run an outreach pipeline against a briefing markdown file
  help        Show this help

Outreach usage:
  kbot-orchestrator outreach --briefing <path>                  # dry-run; lists pending
  kbot-orchestrator outreach --briefing <path> --confirm        # actually send all pending
  kbot-orchestrator outreach --briefing <path> --tier "Tier 1"  # filter by tier
  kbot-orchestrator outreach --briefing <path> --name "Chase"   # filter by name substring
  kbot-orchestrator outreach --briefing <path> --limit 3        # cap the batch size

Sender flags (defaults shown):
  --from isaacsight@gmail.com
  --display-name "Isaac Hernandez"
  --keychain kbot-gmail-app-password
  --delay 500

Setup (one-time, macOS):
  security add-generic-password -U \\
    -a isaacsight@gmail.com \\
    -s kbot-gmail-app-password \\
    -w '<16-char-app-password>'

Briefing format:
  See ROLE.md or .claude/OUTREACH_*.md examples in the kernel.chat repo.

`.trim());
}
async function main() {
    const { command, args } = parseCli();
    switch (command) {
        case 'outreach':
            await cmdOutreach(args);
            break;
        case 'help':
        case '--help':
        case '-h':
            cmdHelp();
            break;
        default:
            console.error(`Unknown command: ${command}`);
            cmdHelp();
            process.exit(1);
    }
}
main().catch((err) => {
    console.error('kbot-orchestrator failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map