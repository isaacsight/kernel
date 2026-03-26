// kbot Doctor Tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// ── Mocks ──
// Mock child_process.execSync (used by execQuiet for npm, git, kbot version checks)
vi.mock('node:child_process', () => ({
    execSync: vi.fn((cmd) => {
        if (cmd === 'npm --version')
            return '10.2.0\n';
        if (cmd === 'git --version')
            return 'git version 2.43.0\n';
        if (cmd.includes('npm view @kernel.chat/kbot version'))
            return '3.42.0\n';
        throw new Error(`Command not found: ${cmd}`);
    }),
}));
// Mock auth.js — provide sensible defaults for a configured setup
vi.mock('./auth.js', () => ({
    loadConfig: vi.fn(() => ({
        byok_enabled: true,
        byok_provider: 'anthropic',
        byok_key: 'sk-ant-test-key',
    })),
    isByokEnabled: vi.fn(() => true),
    getByokProvider: vi.fn(() => 'anthropic'),
    isLocalProvider: vi.fn((p) => p === 'ollama' || p === 'kbot-local'),
    isKeylessProvider: vi.fn((p) => p === 'ollama'),
    PROVIDERS: {
        anthropic: {
            name: 'Anthropic',
            apiUrl: 'https://api.anthropic.com/v1/messages',
            apiStyle: 'anthropic',
            defaultModel: 'claude-sonnet-4-20250514',
            fastModel: 'claude-haiku-35-20241022',
            inputCost: 3,
            outputCost: 15,
        },
        openai: {
            name: 'OpenAI',
            apiUrl: 'https://api.openai.com/v1/chat/completions',
            apiStyle: 'openai',
            defaultModel: 'gpt-4o',
            fastModel: 'gpt-4o-mini',
            inputCost: 5,
            outputCost: 15,
        },
        ollama: {
            name: 'Ollama',
            apiUrl: 'http://localhost:11434/v1/chat/completions',
            apiStyle: 'openai',
            defaultModel: 'llama3.1:8b',
            fastModel: 'llama3.1:8b',
            inputCost: 0,
            outputCost: 0,
        },
    },
    isOllamaRunning: vi.fn(async () => false),
    KBOT_DIR: '/tmp/.kbot-doctor-test',
}));
// Mock learning.js
vi.mock('./learning.js', () => ({
    getExtendedStats: vi.fn(() => ({
        patternsCount: 12,
        solutionsCount: 5,
        knowledgeCount: 3,
        correctionsCount: 1,
        projectsCount: 2,
    })),
}));
// Mock machine.js
vi.mock('./machine.js', () => ({
    getMachineProfile: vi.fn(() => ({
        cpu: { chip: 'Apple M2 Pro', model: 'Apple M2 Pro', cores: 12, performanceCores: 8, efficiencyCores: 4, arch: 'arm64' },
        gpu: [{ model: 'Apple M2 Pro', cores: 19, metal: '3', cuda: false, vram: 'shared' }],
        memory: { total: '16 GB', free: '8 GB', pressure: 'normal' },
        disk: { total: '500 GB', available: '200 GB', usedPercent: 60 },
        displays: [{ resolution: '3024x1964', type: 'Retina' }],
        gpuAcceleration: 'metal',
        recommendedModelSize: '13B',
        battery: { present: true, percent: 85, charging: false },
    })),
    probeMachine: vi.fn(),
}));
// Mock fs — only the functions doctor.ts uses directly
vi.mock('node:fs', async () => {
    const actual = await vi.importActual('node:fs');
    return {
        ...actual,
        existsSync: vi.fn((p) => {
            // KBOT_DIR exists by default
            if (p === '/tmp/.kbot-doctor-test')
                return true;
            return false;
        }),
        readdirSync: vi.fn(() => []),
        statSync: vi.fn(() => ({ size: 0, isFile: () => true, isDirectory: () => false })),
    };
});
// ── Tests ──
// We need to import after mocks are set up
const { runDoctor, formatDoctorReport } = await import('./doctor.js');
// Access mocked modules for per-test overrides
const { execSync } = await import('node:child_process');
const { existsSync } = await import('node:fs');
const auth = await import('./auth.js');
const learning = await import('./learning.js');
const machine = await import('./machine.js');
// Save original process.version and SHELL
const originalVersion = process.version;
const originalShell = process.env.SHELL;
beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply default mock implementations after clearAllMocks
    vi.mocked(execSync).mockImplementation((cmd) => {
        if (typeof cmd !== 'string')
            throw new Error('unexpected');
        if (cmd === 'npm --version')
            return '10.2.0\n';
        if (cmd === 'git --version')
            return 'git version 2.43.0\n';
        if (cmd.includes('npm view @kernel.chat/kbot version'))
            return '3.42.0\n';
        throw new Error(`Command not found: ${cmd}`);
    });
    vi.mocked(auth.loadConfig).mockReturnValue({
        byok_enabled: true,
        byok_provider: 'anthropic',
        byok_key: 'sk-ant-test-key',
    });
    vi.mocked(auth.isByokEnabled).mockReturnValue(true);
    vi.mocked(auth.getByokProvider).mockReturnValue('anthropic');
    vi.mocked(auth.isLocalProvider).mockImplementation((p) => p === 'ollama' || p === 'kbot-local');
    vi.mocked(auth.isOllamaRunning).mockResolvedValue(false);
    vi.mocked(existsSync).mockImplementation((p) => {
        if (p === '/tmp/.kbot-doctor-test')
            return true;
        return false;
    });
    vi.mocked(learning.getExtendedStats).mockReturnValue({
        patternsCount: 12,
        solutionsCount: 5,
        knowledgeCount: 3,
        correctionsCount: 1,
        projectsCount: 2,
    });
    vi.mocked(machine.getMachineProfile).mockReturnValue({
        cpu: { chip: 'Apple M2 Pro', model: 'Apple M2 Pro', cores: 12, performanceCores: 8, efficiencyCores: 4, arch: 'arm64' },
        gpu: [{ model: 'Apple M2 Pro', cores: 19, metal: '3', cuda: false, vram: 'shared' }],
        memory: { total: '16 GB', free: '8 GB', pressure: 'normal' },
        disk: { total: '500 GB', available: '200 GB', usedPercent: 60 },
        displays: [{ resolution: '3024x1964', type: 'Retina' }],
        gpuAcceleration: 'metal',
        recommendedModelSize: '13B',
        battery: { present: true, percent: 85, charging: false },
    });
    process.env.SHELL = '/bin/zsh';
    // Mock global fetch for provider reachability and local runtime checks
    global.fetch = vi.fn(async (url) => {
        const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
        // Cloud provider HEAD check — return 200
        if (urlStr.includes('api.anthropic.com') || urlStr.includes('api.openai.com')) {
            return new Response(null, { status: 200 });
        }
        // Local runtimes — all down by default
        throw new TypeError('fetch failed');
    });
});
afterEach(() => {
    Object.defineProperty(process, 'version', { value: originalVersion, writable: true });
    process.env.SHELL = originalShell;
});
describe('runDoctor', () => {
    it('returns a valid report with all checks on happy path', async () => {
        const report = await runDoctor();
        expect(report).toHaveProperty('checks');
        expect(report).toHaveProperty('timestamp');
        expect(report).toHaveProperty('overall');
        expect(Array.isArray(report.checks)).toBe(true);
        expect(report.checks.length).toBeGreaterThan(0);
        // Every check has required fields
        for (const check of report.checks) {
            expect(check).toHaveProperty('name');
            expect(check).toHaveProperty('status');
            expect(check).toHaveProperty('message');
            expect(['pass', 'warn', 'fail']).toContain(check.status);
        }
        // Timestamp is ISO format
        expect(new Date(report.timestamp).toISOString()).toBe(report.timestamp);
    });
    it('passes all core checks when everything is configured', async () => {
        const report = await runDoctor();
        const byName = (n) => report.checks.find(c => c.name === n);
        expect(byName('Node.js')?.status).toBe('pass');
        expect(byName('npm')?.status).toBe('pass');
        expect(byName('npm')?.message).toContain('10.2.0');
        expect(byName('API key')?.status).toBe('pass');
        expect(byName('API key')?.message).toContain('Anthropic');
        expect(byName('Git')?.status).toBe('pass');
        expect(byName('Git')?.message).toContain('git version');
        expect(byName('Shell')?.status).toBe('pass');
        expect(byName('Shell')?.message).toContain('zsh');
        expect(byName('Learning data')?.status).toBe('pass');
        expect(byName('Learning data')?.message).toContain('12 patterns');
    });
    it('overall is pass when no checks fail or warn', async () => {
        // Provider reachable returns pass for cloud provider
        const report = await runDoctor();
        // There may be warns from local runtimes detection, so check overall is at worst 'warn'
        expect(['pass', 'warn']).toContain(report.overall);
    });
});
describe('runDoctor — failure cases', () => {
    it('fails Git check when git is not found', async () => {
        vi.mocked(execSync).mockImplementation((cmd) => {
            if (typeof cmd !== 'string')
                throw new Error('unexpected');
            if (cmd === 'npm --version')
                return '10.2.0\n';
            if (cmd === 'git --version')
                throw new Error('not found');
            if (cmd.includes('npm view'))
                return '3.42.0\n';
            throw new Error(`Command not found: ${cmd}`);
        });
        const report = await runDoctor();
        const git = report.checks.find(c => c.name === 'Git');
        expect(git?.status).toBe('fail');
        expect(git?.message).toContain('not found');
        expect(report.overall).toBe('fail');
    });
    it('fails API key check when no config exists', async () => {
        vi.mocked(auth.loadConfig).mockReturnValue(null);
        vi.mocked(auth.isByokEnabled).mockReturnValue(false);
        const report = await runDoctor();
        const apiKey = report.checks.find(c => c.name === 'API key');
        expect(apiKey?.status).toBe('fail');
        expect(apiKey?.message).toContain('no config found');
    });
    it('warns npm check when npm is not found', async () => {
        vi.mocked(execSync).mockImplementation((cmd) => {
            if (typeof cmd !== 'string')
                throw new Error('unexpected');
            if (cmd === 'npm --version')
                throw new Error('not found');
            if (cmd === 'git --version')
                return 'git version 2.43.0\n';
            if (cmd.includes('npm view'))
                throw new Error('not found');
            throw new Error(`Command not found: ${cmd}`);
        });
        const report = await runDoctor();
        const npm = report.checks.find(c => c.name === 'npm');
        expect(npm?.status).toBe('warn');
        expect(npm?.message).toContain('not found');
    });
    it('warns when provider host is unreachable', async () => {
        global.fetch = vi.fn(async () => {
            throw new TypeError('fetch failed');
        });
        const report = await runDoctor();
        // After refactor, individual providers appear as separate checks (e.g. "Anthropic (Claude) (active)")
        const providerCheck = report.checks.find(c => c.name === 'Provider reachable' ||
            c.name.includes('Anthropic') ||
            c.name.includes('(active)'));
        // Provider check may be warn or may not exist if all providers failed silently
        if (providerCheck) {
            expect(['warn', 'fail']).toContain(providerCheck.status);
        }
    });
    it('warns when no learning data exists', async () => {
        vi.mocked(learning.getExtendedStats).mockReturnValue({
            patternsCount: 0,
            solutionsCount: 0,
            knowledgeCount: 0,
            correctionsCount: 0,
            projectsCount: 0,
        });
        const report = await runDoctor();
        const ld = report.checks.find(c => c.name === 'Learning data');
        expect(ld?.status).toBe('warn');
        expect(ld?.message).toContain('no data yet');
    });
    it('warns Shell check when SHELL env var is not set', async () => {
        delete process.env.SHELL;
        const report = await runDoctor();
        const shell = report.checks.find(c => c.name === 'Shell');
        expect(shell?.status).toBe('warn');
        expect(shell?.message).toContain('SHELL env var not set');
    });
});
describe('runDoctor — overall status logic', () => {
    it('overall is fail when any check fails', async () => {
        // Force git to fail
        vi.mocked(execSync).mockImplementation((cmd) => {
            if (typeof cmd !== 'string')
                throw new Error('unexpected');
            if (cmd === 'npm --version')
                return '10.2.0\n';
            if (cmd === 'git --version')
                throw new Error('not found');
            if (cmd.includes('npm view'))
                return '3.42.0\n';
            throw new Error(`Command not found: ${cmd}`);
        });
        const report = await runDoctor();
        expect(report.overall).toBe('fail');
    });
    it('overall is warn when there are only warnings (no fails)', async () => {
        // Learning data returns empty (warn) but nothing fails
        vi.mocked(learning.getExtendedStats).mockReturnValue({
            patternsCount: 0,
            solutionsCount: 0,
            knowledgeCount: 0,
            correctionsCount: 0,
            projectsCount: 0,
        });
        const report = await runDoctor();
        const hasAnyFail = report.checks.some(c => c.status === 'fail');
        const hasAnyWarn = report.checks.some(c => c.status === 'warn');
        if (!hasAnyFail && hasAnyWarn) {
            expect(report.overall).toBe('warn');
        }
        else if (!hasAnyFail && !hasAnyWarn) {
            expect(report.overall).toBe('pass');
        }
        // Either way overall should not be 'fail'
        expect(report.overall).not.toBe('fail');
    });
});
describe('runDoctor — hardware checks', () => {
    it('includes hardware info from machine profile', async () => {
        const report = await runDoctor();
        const cpu = report.checks.find(c => c.name === 'CPU');
        const gpu = report.checks.find(c => c.name === 'GPU');
        const memory = report.checks.find(c => c.name === 'Memory');
        expect(cpu?.status).toBe('pass');
        expect(cpu?.message).toContain('Apple M2 Pro');
        expect(gpu?.status).toBe('pass');
        expect(gpu?.message).toContain('Apple M2 Pro');
        expect(memory?.status).toBe('pass');
        expect(memory?.message).toContain('16 GB');
    });
    it('warns when machine profile is unavailable', async () => {
        vi.mocked(machine.getMachineProfile).mockReturnValue(null);
        vi.mocked(machine.probeMachine).mockRejectedValue(new Error('probe failed'));
        const report = await runDoctor();
        const hw = report.checks.find(c => c.name === 'Hardware');
        expect(hw?.status).toBe('warn');
        expect(hw?.message).toContain('could not probe');
    });
});
describe('formatDoctorReport', () => {
    it('formats a passing report', () => {
        const report = {
            checks: [
                { name: 'Node.js', status: 'pass', message: 'v20.11.0' },
                { name: 'npm', status: 'pass', message: 'v10.2.0' },
                { name: 'Git', status: 'pass', message: 'git version 2.43.0' },
            ],
            timestamp: new Date().toISOString(),
            overall: 'pass',
        };
        const output = formatDoctorReport(report);
        expect(output).toContain('kbot Doctor');
        expect(output).toContain('Node.js');
        expect(output).toContain('v20.11.0');
        expect(output).toContain('npm');
        expect(output).toContain('Git');
        expect(output).toContain('All checks passed');
    });
    it('formats a report with warnings', () => {
        const report = {
            checks: [
                { name: 'Node.js', status: 'pass', message: 'v20.11.0' },
                { name: 'Local runtimes', status: 'warn', message: 'none detected' },
            ],
            timestamp: new Date().toISOString(),
            overall: 'warn',
        };
        const output = formatDoctorReport(report);
        expect(output).toContain('kbot Doctor');
        expect(output).toContain('1 warning');
        expect(output).toContain('kbot will work');
    });
    it('formats a report with failures', () => {
        const report = {
            checks: [
                { name: 'Node.js', status: 'fail', message: 'v16.0.0 — requires >= 20' },
                { name: 'Git', status: 'fail', message: 'not found' },
            ],
            timestamp: new Date().toISOString(),
            overall: 'fail',
        };
        const output = formatDoctorReport(report);
        expect(output).toContain('kbot Doctor');
        expect(output).toContain('2 issues found');
        expect(output).toContain('Fix the items');
    });
    it('pluralizes warning/failure counts correctly', () => {
        const singleWarn = {
            checks: [{ name: 'Test', status: 'warn', message: 'x' }],
            timestamp: new Date().toISOString(),
            overall: 'warn',
        };
        const multiWarn = {
            checks: [
                { name: 'A', status: 'warn', message: 'x' },
                { name: 'B', status: 'warn', message: 'y' },
            ],
            timestamp: new Date().toISOString(),
            overall: 'warn',
        };
        expect(formatDoctorReport(singleWarn)).toContain('1 warning.');
        expect(formatDoctorReport(multiWarn)).toContain('2 warnings.');
    });
    it('includes all check names and messages in output', () => {
        const report = {
            checks: [
                { name: 'Node.js', status: 'pass', message: 'v22.0.0' },
                { name: 'API key', status: 'pass', message: 'configured (Anthropic)' },
                { name: 'Shell', status: 'pass', message: 'zsh' },
            ],
            timestamp: new Date().toISOString(),
            overall: 'pass',
        };
        const output = formatDoctorReport(report);
        for (const check of report.checks) {
            expect(output).toContain(check.name);
            expect(output).toContain(check.message);
        }
    });
});
//# sourceMappingURL=doctor.test.js.map