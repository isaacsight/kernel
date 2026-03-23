// kbot Bash Tool — Execute shell commands with safety checks
// All execution is local — zero API calls.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { registerTool } from './index.js';
/** Persistent working directory across bash calls within the session */
let sessionCwd = process.cwd();
/** Dangerous command patterns that are blocked by default */
const BLOCKED_PATTERNS = [
    /rm\s+(-[a-z]*f[a-z]*\s+)?(-[a-z]*r[a-z]*\s+)?\//i, // rm -rf / (any flag order)
    /rm\s+(-[a-z]*f[a-z]*\s+)?(-[a-z]*r[a-z]*\s+)?~/i, // rm -rf ~ (any flag order)
    /rm\s+--recursive\s+--force/i, // rm --recursive --force
    /rm\s+--force\s+--recursive/i, // rm --force --recursive
    /sudo\s+rm/, // sudo rm
    /^mkfs/, // format filesystem
    /dd\s+if=/, // raw disk write
    /:\(\)\{.*:\|:.*\};/, // fork bomb (escaped metacharacters)
    />\s*\/dev\/sd[a-z]/, // write to raw disk
    /^shutdown/, // shutdown
    /^reboot/, // reboot
    /^halt/, // halt
];
/** Check for command substitution that could hide dangerous commands */
const SUBSTITUTION_PATTERNS = [
    /\$\(.*(?:rm|mkfs|dd|shutdown|reboot|halt)\s/i, // $(rm ...)
    /`.*(?:rm|mkfs|dd|shutdown|reboot|halt)\s/i, // `rm ...`
];
function isCommandSafe(command) {
    const trimmed = command.trim();
    for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(trimmed)) {
            return { safe: false, reason: `Blocked: matches dangerous pattern` };
        }
    }
    for (const pattern of SUBSTITUTION_PATTERNS) {
        if (pattern.test(trimmed)) {
            return { safe: false, reason: `Blocked: command substitution contains dangerous command` };
        }
    }
    return { safe: true };
}
export function registerBashTools() {
    registerTool({
        name: 'bash',
        description: 'Execute a shell command and return stdout/stderr. Use for system commands, builds, installs, and other terminal operations.',
        parameters: {
            command: { type: 'string', description: 'The shell command to execute', required: true },
            timeout: { type: 'number', description: 'Timeout in milliseconds (default: 120000, max: 600000)' },
        },
        tier: 'free',
        async execute(args) {
            const command = String(args.command);
            const timeout = Math.min(typeof args.timeout === 'number' ? args.timeout : 120_000, 600_000);
            // Safety check
            const check = isCommandSafe(command);
            if (!check.safe) {
                return `Error: Command blocked for safety. ${check.reason}`;
            }
            // Detect cd commands and update sessionCwd
            const cdMatch = command.match(/^\s*cd\s+(.+?)(?:\s*&&|$)/);
            if (cdMatch) {
                const target = cdMatch[1].replace(/^['"]|['"]$/g, '').replace(/^~/, process.env.HOME || '');
                const resolved = resolve(sessionCwd, target);
                if (existsSync(resolved)) {
                    sessionCwd = resolved;
                }
            }
            try {
                const result = execSync(command, {
                    encoding: 'utf-8',
                    timeout,
                    cwd: sessionCwd,
                    maxBuffer: 10 * 1024 * 1024, // 10MB
                    stdio: ['pipe', 'pipe', 'pipe'],
                });
                // If the command was a standalone cd, update cwd from the shell
                if (/^\s*cd\s/.test(command) && !command.includes('&&') && !command.includes(';')) {
                    try {
                        const newCwd = execSync(`cd ${JSON.stringify(sessionCwd)} && ${command} && pwd`, {
                            encoding: 'utf-8', timeout: 5000,
                        }).trim();
                        if (newCwd && existsSync(newCwd))
                            sessionCwd = newCwd;
                    }
                    catch { /* keep current cwd */ }
                }
                return result.trim() || '(no output)';
            }
            catch (err) {
                const e = err;
                const stderr = e.stderr?.trim() || '';
                const stdout = e.stdout?.trim() || '';
                const output = [stdout, stderr].filter(Boolean).join('\n');
                return `Exit code ${e.status || 1}\n${output || e.message || 'Command failed'}`;
            }
        },
    });
}
//# sourceMappingURL=bash.js.map