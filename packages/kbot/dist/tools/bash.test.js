// kbot Bash Tool Tests
import { describe, it, expect, afterAll } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { executeTool, getTool } from './index.js';
import { registerBashTools } from './bash.js';
// Register once
registerBashTools();
// Temp directory for tests
const TEST_DIR = join(tmpdir(), 'kbot-bash-test-' + Date.now());
mkdirSync(TEST_DIR, { recursive: true });
afterAll(() => {
    try {
        rmSync(TEST_DIR, { recursive: true, force: true });
    }
    catch { }
});
// ─────────────────────────────────────────────────────────────────────
// 1. Registration
// ─────────────────────────────────────────────────────────────────────
describe('Bash Tool Registration', () => {
    it('registers the bash tool', () => {
        const tool = getTool('bash');
        expect(tool).toBeTruthy();
        expect(tool.tier).toBe('free');
        expect(tool.parameters.command.required).toBe(true);
    });
});
// ─────────────────────────────────────────────────────────────────────
// 2. Basic execution
// ─────────────────────────────────────────────────────────────────────
describe('Bash Execution', () => {
    it('executes a simple command', async () => {
        const result = await executeTool({
            id: 'b-1',
            name: 'bash',
            arguments: { command: 'echo "hello kbot"' },
        });
        expect(result.error).toBeUndefined();
        expect(result.result).toBe('hello kbot');
    });
    it('returns stdout from piped commands', async () => {
        const result = await executeTool({
            id: 'b-2',
            name: 'bash',
            arguments: { command: 'echo "aaa\nbbb\nccc" | wc -l' },
        });
        expect(result.error).toBeUndefined();
        expect(result.result.trim()).toBe('3');
    });
    it('returns "(no output)" for silent commands', async () => {
        const result = await executeTool({
            id: 'b-3',
            name: 'bash',
            arguments: { command: 'true' },
        });
        expect(result.error).toBeUndefined();
        expect(result.result).toBe('(no output)');
    });
    it('returns exit code and stderr for failed commands', async () => {
        const result = await executeTool({
            id: 'b-4',
            name: 'bash',
            arguments: { command: 'ls /nonexistent-path-xyz-12345' },
        });
        expect(result.result).toContain('Exit code');
    });
    it('handles commands that produce both stdout and stderr on failure', async () => {
        const result = await executeTool({
            id: 'b-5',
            name: 'bash',
            arguments: { command: 'echo "partial" && false' },
        });
        expect(result.result).toContain('Exit code');
    });
    it('respects custom timeout', async () => {
        const result = await executeTool({
            id: 'b-6',
            name: 'bash',
            arguments: { command: 'sleep 30', timeout: 500 },
        });
        // Should fail with timeout or exit code
        expect(result.result).toContain('Exit code');
    });
    it('caps timeout at 600000ms', async () => {
        // Passing a huge timeout should be capped
        const tool = getTool('bash');
        expect(tool).toBeTruthy();
        // The execute function caps at 600_000 internally — we test it won't crash
        const result = await executeTool({
            id: 'b-7',
            name: 'bash',
            arguments: { command: 'echo "fast"', timeout: 999999999 },
        });
        expect(result.error).toBeUndefined();
        expect(result.result).toBe('fast');
    });
});
// ─────────────────────────────────────────────────────────────────────
// 3. Safety checks — blocked patterns
// ─────────────────────────────────────────────────────────────────────
describe('Bash Safety - Blocked Patterns', () => {
    it('blocks rm -rf /', async () => {
        const result = await executeTool({
            id: 's-1',
            name: 'bash',
            arguments: { command: 'rm -rf /' },
        });
        expect(result.result).toContain('blocked');
    });
    it('blocks rm -rf ~ (home dir)', async () => {
        const result = await executeTool({
            id: 's-2',
            name: 'bash',
            arguments: { command: 'rm -rf ~' },
        });
        expect(result.result).toContain('blocked');
    });
    it('blocks rm with reversed flags', async () => {
        const result = await executeTool({
            id: 's-3',
            name: 'bash',
            arguments: { command: 'rm -fr /' },
        });
        expect(result.result).toContain('blocked');
    });
    it('blocks sudo rm', async () => {
        const result = await executeTool({
            id: 's-4',
            name: 'bash',
            arguments: { command: 'sudo rm -rf /tmp' },
        });
        expect(result.result).toContain('blocked');
    });
    it('blocks mkfs', async () => {
        const result = await executeTool({
            id: 's-5',
            name: 'bash',
            arguments: { command: 'mkfs.ext4 /dev/sda1' },
        });
        expect(result.result).toContain('blocked');
    });
    it('blocks dd if=', async () => {
        const result = await executeTool({
            id: 's-6',
            name: 'bash',
            arguments: { command: 'dd if=/dev/zero of=/dev/sda' },
        });
        expect(result.result).toContain('blocked');
    });
    it('blocks shutdown', async () => {
        const result = await executeTool({
            id: 's-7',
            name: 'bash',
            arguments: { command: 'shutdown -h now' },
        });
        expect(result.result).toContain('blocked');
    });
    it('blocks reboot', async () => {
        const result = await executeTool({
            id: 's-8',
            name: 'bash',
            arguments: { command: 'reboot' },
        });
        expect(result.result).toContain('blocked');
    });
    it('blocks fork bombs', async () => {
        const result = await executeTool({
            id: 's-9',
            name: 'bash',
            arguments: { command: ':(){ :|:& };:' },
        });
        expect(result.result).toContain('blocked');
    });
    it('blocks raw disk writes', async () => {
        const result = await executeTool({
            id: 's-10',
            name: 'bash',
            arguments: { command: 'echo bad > /dev/sda' },
        });
        expect(result.result).toContain('blocked');
    });
});
// ─────────────────────────────────────────────────────────────────────
// 4. Safety checks — command substitution
// ─────────────────────────────────────────────────────────────────────
describe('Bash Safety - Substitution Patterns', () => {
    it('blocks $(rm ...) substitution', async () => {
        const result = await executeTool({
            id: 'sub-1',
            name: 'bash',
            arguments: { command: 'echo $(rm -rf /)' },
        });
        expect(result.result).toContain('blocked');
    });
    it('blocks backtick rm substitution', async () => {
        const result = await executeTool({
            id: 'sub-2',
            name: 'bash',
            arguments: { command: 'echo `rm -rf /`' },
        });
        expect(result.result).toContain('blocked');
    });
    it('blocks $(shutdown) substitution', async () => {
        const result = await executeTool({
            id: 'sub-3',
            name: 'bash',
            arguments: { command: 'echo $(shutdown -h now)' },
        });
        expect(result.result).toContain('blocked');
    });
});
// ─────────────────────────────────────────────────────────────────────
// 5. Safe commands should pass
// ─────────────────────────────────────────────────────────────────────
describe('Bash Safety - Allowed Commands', () => {
    it('allows rm on normal files (not root/home)', async () => {
        const filePath = join(TEST_DIR, 'deleteme.txt');
        writeFileSync(filePath, 'temp');
        const result = await executeTool({
            id: 'safe-1',
            name: 'bash',
            arguments: { command: `rm "${filePath}"` },
        });
        // Should not be blocked (rm without -rf on /)
        expect(result.result).not.toContain('blocked');
        expect(existsSync(filePath)).toBe(false);
    });
    it('allows git status', async () => {
        const result = await executeTool({
            id: 'safe-2',
            name: 'bash',
            arguments: { command: 'git --version' },
        });
        expect(result.error).toBeUndefined();
        expect(result.result).toContain('git version');
    });
    it('allows node commands', async () => {
        const result = await executeTool({
            id: 'safe-3',
            name: 'bash',
            arguments: { command: 'node -e "console.log(2+2)"' },
        });
        expect(result.error).toBeUndefined();
        expect(result.result).toBe('4');
    });
    it('allows cat and standard file operations', async () => {
        const filePath = join(TEST_DIR, 'cattest.txt');
        writeFileSync(filePath, 'cat content');
        const result = await executeTool({
            id: 'safe-4',
            name: 'bash',
            arguments: { command: `cat "${filePath}"` },
        });
        expect(result.error).toBeUndefined();
        expect(result.result).toBe('cat content');
    });
});
// ─────────────────────────────────────────────────────────────────────
// 6. Working directory behavior
// ─────────────────────────────────────────────────────────────────────
describe('Bash Working Directory', () => {
    it('executes commands in a working directory', async () => {
        const result = await executeTool({
            id: 'wd-1',
            name: 'bash',
            arguments: { command: 'pwd' },
        });
        expect(result.error).toBeUndefined();
        // Should return some valid path
        expect(result.result).toMatch(/^\//);
    });
    it('handles environment variables', async () => {
        const result = await executeTool({
            id: 'wd-2',
            name: 'bash',
            arguments: { command: 'echo $HOME' },
        });
        expect(result.error).toBeUndefined();
        expect(result.result).toMatch(/^\//);
    });
});
//# sourceMappingURL=bash.test.js.map