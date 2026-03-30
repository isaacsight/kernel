// Tests for kbot Context — Codebase awareness for smarter responses
import { describe, it, expect, vi, beforeEach } from 'vitest';
// ── Mocks ──
// Mock child_process.execSync
vi.mock('node:child_process', () => ({
    execSync: vi.fn(() => ''),
}));
// Mock fs functions
vi.mock('node:fs', () => ({
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => ''),
    readdirSync: vi.fn(() => []),
}));
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { gatherContext, formatContextForPrompt } from './context.js';
const mockExecSync = vi.mocked(execSync);
const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockReaddirSync = vi.mocked(readdirSync);
beforeEach(() => {
    vi.clearAllMocks();
});
// ── Helper: build a minimal MachineProfile for tests ──
function makeMachineProfile(overrides = {}) {
    return {
        model: 'MacBook Pro',
        cpu: { model: 'Apple M3 Max', chip: 'M3 Max', cores: 16, performanceCores: 12, efficiencyCores: 4, arch: 'arm64' },
        gpu: [{ model: 'Apple M3 Max', cores: 40 }],
        memory: { total: '128 GB', totalBytes: 137438953472, free: '64 GB', freeBytes: 68719476736, used: '64 GB', usedBytes: 68719476736, pressure: 'low' },
        disk: { total: '1 TB', available: '500 GB', used: '500 GB', usedPercent: 50, filesystem: 'apfs' },
        os: 'macOS 26.3',
        osVersion: '26.3',
        kernel: 'Darwin 25.3.0',
        platform: 'darwin',
        uptime: '3 days',
        displays: [{ name: 'Built-in', resolution: '3456x2234', type: 'Liquid Retina XDR', main: true }],
        battery: { present: true, percent: 85, charging: false },
        network: { hostname: 'test-machine' },
        shell: '/bin/zsh',
        user: 'tester',
        home: '/Users/tester',
        devTools: [{ name: 'node', version: '22.0.0' }, { name: 'git', version: '2.44.0' }],
        canRunLocalModels: true,
        gpuAcceleration: 'metal',
        recommendedModelSize: '70B',
        probedAt: new Date().toISOString(),
        ...overrides,
    };
}
// ── gatherContext ──
describe('gatherContext', () => {
    it('returns a non-git context when git fails', () => {
        mockExecSync.mockReturnValue('');
        mockReaddirSync.mockReturnValue([]);
        const ctx = gatherContext();
        expect(ctx.isGitRepo).toBe(false);
        expect(ctx.repoRoot).toBeUndefined();
        expect(ctx.branch).toBeUndefined();
        expect(ctx.recentChanges).toBeUndefined();
    });
    it('detects a git repo and extracts branch', () => {
        mockExecSync.mockImplementation((cmd) => {
            const c = String(cmd);
            if (c.includes('rev-parse --show-toplevel'))
                return '/home/user/project\n';
            if (c.includes('branch --show-current'))
                return 'feat/context\n';
            if (c.includes('git diff --stat'))
                return ' 3 files changed\n';
            return '';
        });
        mockReaddirSync.mockReturnValue([]);
        mockExistsSync.mockReturnValue(false);
        const ctx = gatherContext();
        expect(ctx.isGitRepo).toBe(true);
        expect(ctx.repoRoot).toBe('/home/user/project');
        expect(ctx.branch).toBe('feat/context');
        expect(ctx.recentChanges).toBe('3 files changed');
    });
    it('detects TypeScript + React from package.json', () => {
        mockExecSync.mockImplementation((cmd) => {
            const c = String(cmd);
            if (c.includes('rev-parse --show-toplevel'))
                return '/project\n';
            if (c.includes('branch --show-current'))
                return 'main\n';
            return '';
        });
        mockExistsSync.mockImplementation((p) => {
            const path = String(p);
            if (path === '/project/package.json')
                return true;
            return false;
        });
        mockReadFileSync.mockImplementation((p) => {
            const path = String(p);
            if (path === '/project/package.json') {
                return JSON.stringify({
                    dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
                    devDependencies: { typescript: '^5.0.0' },
                });
            }
            return '';
        });
        mockReaddirSync.mockReturnValue([]);
        const ctx = gatherContext();
        expect(ctx.language).toBe('TypeScript');
        expect(ctx.framework).toBe('React');
    });
    it('detects Next.js framework', () => {
        mockExecSync.mockReturnValue('');
        mockExistsSync.mockImplementation((p) => {
            if (String(p).endsWith('package.json'))
                return true;
            return false;
        });
        mockReadFileSync.mockReturnValue(JSON.stringify({
            dependencies: { next: '^15.0.0' },
            devDependencies: { typescript: '^5.0.0' },
        }));
        mockReaddirSync.mockReturnValue([]);
        const ctx = gatherContext();
        expect(ctx.framework).toBe('Next.js');
        expect(ctx.language).toBe('TypeScript');
    });
    it('detects Vue framework', () => {
        mockExecSync.mockReturnValue('');
        mockExistsSync.mockImplementation((p) => {
            if (String(p).endsWith('package.json'))
                return true;
            return false;
        });
        mockReadFileSync.mockReturnValue(JSON.stringify({
            dependencies: { vue: '^3.0.0' },
        }));
        mockReaddirSync.mockReturnValue([]);
        const ctx = gatherContext();
        expect(ctx.framework).toBe('Vue');
        expect(ctx.language).toBe('JavaScript');
    });
    it('detects Svelte, Express, and Fastify frameworks', () => {
        const frameworks = [
            { dep: 'svelte', expected: 'Svelte' },
            { dep: 'express', expected: 'Express' },
            { dep: 'fastify', expected: 'Fastify' },
        ];
        for (const { dep, expected } of frameworks) {
            vi.clearAllMocks();
            mockExecSync.mockReturnValue('');
            mockExistsSync.mockImplementation((p) => {
                if (String(p).endsWith('package.json'))
                    return true;
                return false;
            });
            mockReadFileSync.mockReturnValue(JSON.stringify({
                dependencies: { [dep]: '^1.0.0' },
            }));
            mockReaddirSync.mockReturnValue([]);
            const ctx = gatherContext();
            expect(ctx.framework).toBe(expected);
        }
    });
    it('detects package manager from lock files', () => {
        const lockFiles = [
            { file: 'bun.lockb', expected: 'bun' },
            { file: 'pnpm-lock.yaml', expected: 'pnpm' },
            { file: 'yarn.lock', expected: 'yarn' },
        ];
        for (const { file, expected } of lockFiles) {
            vi.clearAllMocks();
            mockExecSync.mockImplementation((cmd) => {
                if (String(cmd).includes('rev-parse --show-toplevel'))
                    return '/project\n';
                return '';
            });
            mockExistsSync.mockImplementation((p) => {
                const path = String(p);
                if (path === '/project/package.json')
                    return true;
                if (path === `/project/${file}`)
                    return true;
                return false;
            });
            mockReadFileSync.mockReturnValue(JSON.stringify({ dependencies: {} }));
            mockReaddirSync.mockReturnValue([]);
            const ctx = gatherContext();
            expect(ctx.packageManager).toBe(expected);
        }
    });
    it('defaults to npm when no lock file exists', () => {
        mockExecSync.mockImplementation((cmd) => {
            if (String(cmd).includes('rev-parse --show-toplevel'))
                return '/project\n';
            return '';
        });
        mockExistsSync.mockImplementation((p) => {
            if (String(p) === '/project/package.json')
                return true;
            return false;
        });
        mockReadFileSync.mockReturnValue(JSON.stringify({ dependencies: {} }));
        mockReaddirSync.mockReturnValue([]);
        const ctx = gatherContext();
        expect(ctx.packageManager).toBe('npm');
    });
    it('detects Python from pyproject.toml', () => {
        mockExecSync.mockReturnValue('');
        mockExistsSync.mockImplementation((p) => {
            if (String(p).endsWith('pyproject.toml'))
                return true;
            return false;
        });
        mockReaddirSync.mockReturnValue([]);
        const ctx = gatherContext();
        expect(ctx.language).toBe('Python');
    });
    it('detects Rust from Cargo.toml', () => {
        mockExecSync.mockReturnValue('');
        mockExistsSync.mockImplementation((p) => {
            if (String(p).endsWith('Cargo.toml'))
                return true;
            return false;
        });
        mockReaddirSync.mockReturnValue([]);
        const ctx = gatherContext();
        expect(ctx.language).toBe('Rust');
    });
    it('detects Go from go.mod', () => {
        mockExecSync.mockReturnValue('');
        mockExistsSync.mockImplementation((p) => {
            if (String(p).endsWith('go.mod'))
                return true;
            return false;
        });
        mockReaddirSync.mockReturnValue([]);
        const ctx = gatherContext();
        expect(ctx.language).toBe('Go');
    });
    it('loads project instructions from .kbot.md', () => {
        mockExecSync.mockImplementation((cmd) => {
            if (String(cmd).includes('rev-parse --show-toplevel'))
                return '/project\n';
            return '';
        });
        mockExistsSync.mockImplementation((p) => {
            if (String(p) === '/project/.kbot.md')
                return true;
            return false;
        });
        mockReadFileSync.mockImplementation((p) => {
            if (String(p) === '/project/.kbot.md')
                return '# My Project\nDo things correctly.';
            return '';
        });
        mockReaddirSync.mockReturnValue([]);
        const ctx = gatherContext();
        expect(ctx.projectInstructions).toBe('# My Project\nDo things correctly.');
    });
    it('truncates project instructions to 8192 chars', () => {
        const longContent = 'x'.repeat(10000);
        mockExecSync.mockImplementation((cmd) => {
            if (String(cmd).includes('rev-parse --show-toplevel'))
                return '/project\n';
            return '';
        });
        mockExistsSync.mockImplementation((p) => {
            if (String(p) === '/project/.kbot.md')
                return true;
            return false;
        });
        mockReadFileSync.mockImplementation((p) => {
            if (String(p) === '/project/.kbot.md')
                return longContent;
            return '';
        });
        mockReaddirSync.mockReturnValue([]);
        const ctx = gatherContext();
        expect(ctx.projectInstructions?.length).toBe(8192);
    });
    it('falls back to KBOT.md if .kbot.md not found', () => {
        mockExecSync.mockImplementation((cmd) => {
            if (String(cmd).includes('rev-parse --show-toplevel'))
                return '/project\n';
            return '';
        });
        mockExistsSync.mockImplementation((p) => {
            const path = String(p);
            if (path === '/project/.kbot.md')
                return false;
            if (path === '/project/KBOT.md')
                return true;
            return false;
        });
        mockReadFileSync.mockImplementation((p) => {
            if (String(p) === '/project/KBOT.md')
                return 'Fallback instructions';
            return '';
        });
        mockReaddirSync.mockReturnValue([]);
        const ctx = gatherContext();
        expect(ctx.projectInstructions).toBe('Fallback instructions');
    });
    it('falls back to .kbot/instructions.md as third candidate', () => {
        mockExecSync.mockImplementation((cmd) => {
            if (String(cmd).includes('rev-parse --show-toplevel'))
                return '/project\n';
            return '';
        });
        mockExistsSync.mockImplementation((p) => {
            const path = String(p);
            if (path === '/project/.kbot.md')
                return false;
            if (path === '/project/KBOT.md')
                return false;
            if (path === '/project/.kbot/instructions.md')
                return true;
            return false;
        });
        mockReadFileSync.mockImplementation((p) => {
            if (String(p) === '/project/.kbot/instructions.md')
                return 'Nested instructions';
            return '';
        });
        mockReaddirSync.mockReturnValue([]);
        const ctx = gatherContext();
        expect(ctx.projectInstructions).toBe('Nested instructions');
    });
    it('attaches machine profile when provided', () => {
        mockExecSync.mockReturnValue('');
        mockReaddirSync.mockReturnValue([]);
        const machine = makeMachineProfile();
        const ctx = gatherContext(machine);
        expect(ctx.machine).toBe(machine);
        expect(ctx.machine?.model).toBe('MacBook Pro');
    });
    it('builds a file tree from directory entries', () => {
        mockExecSync.mockImplementation((cmd) => {
            if (String(cmd).includes('rev-parse --show-toplevel'))
                return '/project\n';
            return '';
        });
        mockExistsSync.mockReturnValue(false);
        // Root directory entries
        mockReaddirSync.mockImplementation((dir) => {
            const d = String(dir);
            if (d === '/project') {
                return [
                    { name: 'src', isDirectory: () => true, isFile: () => false },
                    { name: 'README.md', isDirectory: () => false, isFile: () => true },
                    { name: 'package.json', isDirectory: () => false, isFile: () => true },
                    { name: 'node_modules', isDirectory: () => true, isFile: () => false },
                ];
            }
            if (d === '/project/src') {
                return [
                    { name: 'index.ts', isDirectory: () => false, isFile: () => true },
                ];
            }
            return [];
        });
        const ctx = gatherContext();
        expect(ctx.fileTree).toContain('README.md');
        expect(ctx.fileTree).toContain('package.json');
        expect(ctx.fileTree).toContain('src/index.ts');
        // node_modules should be skipped
        expect(ctx.fileTree).not.toContain('node_modules');
    });
    it('skips hidden directories in file tree', () => {
        mockExecSync.mockImplementation((cmd) => {
            if (String(cmd).includes('rev-parse --show-toplevel'))
                return '/project\n';
            return '';
        });
        mockExistsSync.mockReturnValue(false);
        mockReaddirSync.mockImplementation((dir) => {
            if (String(dir) === '/project') {
                return [
                    { name: '.git', isDirectory: () => true, isFile: () => false },
                    { name: '.hidden', isDirectory: () => true, isFile: () => false },
                    { name: 'visible.ts', isDirectory: () => false, isFile: () => true },
                ];
            }
            return [];
        });
        const ctx = gatherContext();
        expect(ctx.fileTree).toContain('visible.ts');
        expect(ctx.fileTree).not.toContain('.git');
        expect(ctx.fileTree).not.toContain('.hidden');
    });
});
// ── formatContextForPrompt ──
describe('formatContextForPrompt', () => {
    it('includes [Project Context] header', () => {
        const ctx = {
            isGitRepo: false,
            fileTree: '',
        };
        const output = formatContextForPrompt(ctx);
        expect(output).toContain('[Project Context]');
    });
    it('includes repo name and branch for git projects', () => {
        const ctx = {
            isGitRepo: true,
            repoRoot: '/home/user/my-app',
            branch: 'main',
            fileTree: '',
        };
        const output = formatContextForPrompt(ctx);
        expect(output).toContain('Repository: my-app');
        expect(output).toContain('Branch: main');
    });
    it('shows unknown branch when branch is missing', () => {
        const ctx = {
            isGitRepo: true,
            repoRoot: '/project',
            fileTree: '',
        };
        const output = formatContextForPrompt(ctx);
        expect(output).toContain('Branch: unknown');
    });
    it('includes language, framework, and package manager', () => {
        const ctx = {
            isGitRepo: false,
            language: 'TypeScript',
            framework: 'React',
            packageManager: 'pnpm',
            fileTree: '',
        };
        const output = formatContextForPrompt(ctx);
        expect(output).toContain('Language: TypeScript');
        expect(output).toContain('Framework: React');
        expect(output).toContain('Package Manager: pnpm');
    });
    it('includes file tree up to 30 files', () => {
        const files = Array.from({ length: 40 }, (_, i) => `file${i}.ts`);
        const ctx = {
            isGitRepo: false,
            fileTree: files.join('\n'),
        };
        const output = formatContextForPrompt(ctx);
        expect(output).toContain('Key files:');
        expect(output).toContain('file0.ts');
        expect(output).toContain('file29.ts');
        // files 30+ should be summarized, not listed
        expect(output).toContain('... and 10 more files');
        expect(output).not.toContain('file30.ts');
    });
    it('does not show "more files" when 30 or fewer', () => {
        const files = Array.from({ length: 5 }, (_, i) => `file${i}.ts`);
        const ctx = {
            isGitRepo: false,
            fileTree: files.join('\n'),
        };
        const output = formatContextForPrompt(ctx);
        expect(output).toContain('file0.ts');
        expect(output).not.toContain('more files');
    });
    it('includes recent changes section', () => {
        const ctx = {
            isGitRepo: true,
            repoRoot: '/project',
            fileTree: '',
            recentChanges: ' 3 files changed, 42 insertions(+)',
        };
        const output = formatContextForPrompt(ctx);
        expect(output).toContain('Recent changes:');
        expect(output).toContain('3 files changed');
    });
    it('includes project instructions', () => {
        const ctx = {
            isGitRepo: false,
            fileTree: '',
            projectInstructions: 'Always use strict mode.',
        };
        const output = formatContextForPrompt(ctx);
        expect(output).toContain('[Project Instructions (.kbot.md)]');
        expect(output).toContain('Always use strict mode.');
    });
    it('omits sections that are not set', () => {
        const ctx = {
            isGitRepo: false,
            fileTree: '',
        };
        const output = formatContextForPrompt(ctx);
        expect(output).not.toContain('Repository:');
        expect(output).not.toContain('Language:');
        expect(output).not.toContain('Framework:');
        expect(output).not.toContain('Package Manager:');
        expect(output).not.toContain('Recent changes:');
        expect(output).not.toContain('Project Instructions');
        expect(output).not.toContain('[Machine Context]');
    });
    it('formats machine context when provided', () => {
        const machine = makeMachineProfile();
        const ctx = {
            isGitRepo: false,
            fileTree: '',
            machine,
        };
        const output = formatContextForPrompt(ctx);
        expect(output).toContain('[Machine Context]');
        expect(output).toContain('MacBook Pro');
        expect(output).toContain('M3 Max');
        expect(output).toContain('16 cores');
        expect(output).toContain('12P + 4E');
        expect(output).toContain('arm64');
        expect(output).toContain('128 GB');
        expect(output).toContain('64 GB free');
        expect(output).toContain('low pressure');
        expect(output).toContain('500 GB available');
        expect(output).toContain('macOS 26.3');
        expect(output).toContain('Darwin 25.3.0');
        expect(output).toContain('3456x2234');
        expect(output).toContain('Liquid Retina XDR');
        expect(output).toContain('85%');
        expect(output).toContain('discharging');
        expect(output).toContain('metal');
        expect(output).toContain('70B');
        expect(output).toContain('node 22.0.0');
        expect(output).toContain('git 2.44.0');
    });
    it('shows charging state when battery is charging', () => {
        const machine = makeMachineProfile({ battery: { present: true, percent: 50, charging: true } });
        const ctx = { isGitRepo: false, fileTree: '', machine };
        const output = formatContextForPrompt(ctx);
        expect(output).toContain('50% charging');
    });
    it('omits battery line when no battery present', () => {
        const machine = makeMachineProfile({ battery: { present: false } });
        const ctx = { isGitRepo: false, fileTree: '', machine };
        const output = formatContextForPrompt(ctx);
        expect(output).not.toContain('Battery:');
    });
    it('omits display line when no displays', () => {
        const machine = makeMachineProfile({ displays: [] });
        const ctx = { isGitRepo: false, fileTree: '', machine };
        const output = formatContextForPrompt(ctx);
        expect(output).not.toContain('Display:');
    });
    it('uses cpu.model when chip is not set', () => {
        const machine = makeMachineProfile({
            model: 'ThinkPad',
            cpu: { model: 'Intel i9-13900K', cores: 24, arch: 'x86_64' },
        });
        const ctx = { isGitRepo: false, fileTree: '', machine };
        const output = formatContextForPrompt(ctx);
        expect(output).toContain('ThinkPad');
        expect(output).toContain('Intel i9-13900K');
    });
    it('omits performance/efficiency core detail when not available', () => {
        const machine = makeMachineProfile({
            cpu: { model: 'AMD Ryzen 9', cores: 16, arch: 'x86_64' },
        });
        const ctx = { isGitRepo: false, fileTree: '', machine };
        const output = formatContextForPrompt(ctx);
        expect(output).toContain('16 cores');
        expect(output).not.toContain('P +');
    });
});
//# sourceMappingURL=context.test.js.map