// Tests for tools/peekaboo.ts.
//
// We mock the adapter at ../adapters/peekaboo/index.js so no real binary
// is ever spawned. The Coordinator lock-file gate is exercised by
// pointing KBOT_COMPUTER_USE_ROOT at a tmpdir and planting / removing
// per-app lock files.
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const TEST_ROOT = mkdtempSync(join(tmpdir(), 'kbot-peekaboo-test-'));
process.env.KBOT_COMPUTER_USE_ROOT = TEST_ROOT;
// ── Adapter mock ───────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
    see: vi.fn(),
    click: vi.fn(),
    type_: vi.fn(),
    setValue: vi.fn(),
    performAction: vi.fn(),
    agent: vi.fn(),
    peekabooAvailable: vi.fn(async () => true),
}));
vi.mock('../adapters/peekaboo/index.js', () => ({
    see: mocks.see,
    click: mocks.click,
    type_: mocks.type_,
    setValue: mocks.setValue,
    performAction: mocks.performAction,
    agent: mocks.agent,
    peekabooAvailable: mocks.peekabooAvailable,
}));
// Imported after the mock so the tool module picks up the stubs.
const { registerPeekabooTools, peekabooTools } = await import('./peekaboo.js');
const { getTool } = await import('./index.js');
registerPeekabooTools();
function plantApprovalLock(app) {
    if (!existsSync(TEST_ROOT))
        mkdirSync(TEST_ROOT, { recursive: true });
    // computer-use-coordinator.ts sanitizes app names by replacing
    // [/\\ -] with '_' and our gate uses lowercase first.
    const sanitized = app.toLowerCase().replace(/[/\\ -]/g, '_');
    writeFileSync(join(TEST_ROOT, `${sanitized}.lock`), JSON.stringify({ agentId: 'test-peekaboo', pid: process.pid, ts: Date.now() }));
}
beforeEach(() => {
    for (const m of Object.values(mocks))
        m.mockReset();
    mocks.peekabooAvailable.mockImplementation(async () => true);
});
afterAll(() => {
    try {
        rmSync(TEST_ROOT, { recursive: true, force: true });
    }
    catch {
        /* ignore */
    }
});
// ── Registration ───────────────────────────────────────────────────────
describe('peekaboo tool registration', () => {
    it('registers all six tools', () => {
        expect(peekabooTools.map((t) => t.name)).toEqual([
            'peekaboo_see',
            'peekaboo_click',
            'peekaboo_type',
            'peekaboo_set_value',
            'peekaboo_perform_action',
            'peekaboo_agent',
        ]);
        for (const name of [
            'peekaboo_see',
            'peekaboo_click',
            'peekaboo_type',
            'peekaboo_set_value',
            'peekaboo_perform_action',
            'peekaboo_agent',
        ]) {
            expect(getTool(name), `tool ${name} should be registered`).toBeDefined();
        }
    });
});
// ── Binary-missing path ────────────────────────────────────────────────
describe('peekaboo binary missing', () => {
    it('returns a CLI-not-found error from every binary-backed tool when peekabooAvailable is false', async () => {
        mocks.peekabooAvailable.mockImplementation(async () => false);
        plantApprovalLock('Safari');
        // Tools that actually invoke the CLI gate on the binary check.
        const binaryBacked = [
            ['peekaboo_see', { app: 'Safari' }],
            ['peekaboo_click', { app: 'Safari', snapshot: 's', on: 'elem_169' }],
            ['peekaboo_type', { app: 'Safari', text: 'hi' }],
            ['peekaboo_agent', { prompt: 'Open Safari' }],
        ];
        for (const [name, args] of binaryBacked) {
            const tool = getTool(name);
            expect(tool).toBeDefined();
            const out = await tool.execute(args);
            expect(out).toMatch(/^Error: peekaboo CLI not found on PATH\./);
        }
        // Adapter functions must NOT have been called when the binary is missing.
        expect(mocks.see).not.toHaveBeenCalled();
        expect(mocks.click).not.toHaveBeenCalled();
        expect(mocks.type_).not.toHaveBeenCalled();
        expect(mocks.agent).not.toHaveBeenCalled();
    });
});
// ── Approval gate ──────────────────────────────────────────────────────
describe('approval gate', () => {
    it('peekaboo_click denies when the app has no approval lock', async () => {
        const out = await getTool('peekaboo_click').execute({
            app: 'NeverApprovedApp',
            snapshot: 's',
            on: 'B1',
        });
        expect(out).toMatch(/Error: NeverApprovedApp is not approved/);
        expect(mocks.click).not.toHaveBeenCalled();
    });
    it('peekaboo_see without an app skips the gate entirely', async () => {
        mocks.see.mockResolvedValue({
            ok: true,
            snapshot: 'snap-x',
            elements: [],
        });
        const out = await getTool('peekaboo_see').execute({});
        expect(mocks.see).toHaveBeenCalledTimes(1);
        expect(out).toContain('"snapshot": "snap-x"');
    });
});
// ── Snapshot pass-through ──────────────────────────────────────────────
describe('peekaboo_click pass-through', () => {
    it('forwards snapshot + on to the adapter', async () => {
        plantApprovalLock('Finder');
        mocks.click.mockResolvedValue({ ok: true, target: 'B1' });
        const out = await getTool('peekaboo_click').execute({
            app: 'Finder',
            snapshot: 'snap-99',
            on: 'B1',
        });
        expect(mocks.click).toHaveBeenCalledWith({ snapshot: 'snap-99', on: 'B1' });
        expect(out).toContain('"target": "B1"');
        expect(out).not.toContain('"ok"');
    });
    it('parses coords "x,y" into a tuple before calling the adapter', async () => {
        plantApprovalLock('Finder');
        mocks.click.mockResolvedValue({ ok: true, coords: [120, 240] });
        await getTool('peekaboo_click').execute({
            app: 'Finder',
            snapshot: 'snap-99',
            coords: '120,240',
            wait: 500,
        });
        expect(mocks.click).toHaveBeenCalledWith({
            snapshot: 'snap-99',
            coords: [120, 240],
            wait: 500,
        });
    });
    it('rejects malformed coords without calling the adapter', async () => {
        plantApprovalLock('Finder');
        const out = await getTool('peekaboo_click').execute({
            app: 'Finder',
            snapshot: 'snap-99',
            coords: 'not,coords',
        });
        expect(out).toMatch(/Error: coords must be "x,y"/);
        expect(mocks.click).not.toHaveBeenCalled();
    });
});
// ── Error path ─────────────────────────────────────────────────────────
describe('adapter error -> Error: string', () => {
    it('surfaces non-zero-exit failures verbatim', async () => {
        plantApprovalLock('Safari');
        mocks.see.mockResolvedValue({
            ok: false,
            error: {
                code: 'non-zero-exit',
                message: 'peekaboo exited 2',
                stderr: 'permission denied',
                exitCode: 2,
            },
        });
        const out = await getTool('peekaboo_see').execute({ app: 'Safari' });
        expect(out).toMatch(/^Error: peekaboo non-zero-exit:/);
        expect(out).toContain('permission denied');
    });
    it('surfaces malformed-json failures', async () => {
        plantApprovalLock('Safari');
        mocks.type_.mockResolvedValue({
            ok: false,
            error: { code: 'malformed-json', message: 'Unexpected token', stdout: 'not json' },
        });
        const out = await getTool('peekaboo_type').execute({
            app: 'Safari',
            text: 'hello',
        });
        expect(out).toMatch(/^Error: peekaboo malformed-json:/);
    });
});
// ── Success-path serialisation ─────────────────────────────────────────
describe('success-path serialisation', () => {
    it('peekaboo_agent returns the agent stdout in JSON form', async () => {
        mocks.agent.mockResolvedValue({ ok: true, output: 'Done.\n' });
        const out = await getTool('peekaboo_agent').execute({ prompt: 'Reload' });
        expect(mocks.agent).toHaveBeenCalledWith({ prompt: 'Reload' });
        expect(out).toContain('"output": "Done.');
    });
    it('peekaboo_set_value returns the upstream-missing stub error without calling the adapter', async () => {
        plantApprovalLock('Safari');
        const out = await getTool('peekaboo_set_value').execute({
            app: 'Safari',
            snapshot: 'snap',
            on: 'elem_85',
            value: 'isaac',
        });
        expect(out).toMatch(/^Error: peekaboo_set_value requires Peekaboo CLI with the 'set-value'/);
        expect(out).toContain('not present in 3.0.0-beta4');
        expect(mocks.setValue).not.toHaveBeenCalled();
    });
    it('peekaboo_perform_action returns the upstream-missing stub error without calling the adapter', async () => {
        plantApprovalLock('Safari');
        const out = await getTool('peekaboo_perform_action').execute({
            app: 'Safari',
            snapshot: 'snap',
            on: 'elem_169',
            action: 'AXPress',
        });
        expect(out).toMatch(/^Error: peekaboo_perform_action requires Peekaboo CLI with the 'perform-action'/);
        expect(out).toContain('not present in 3.0.0-beta4');
        expect(mocks.performAction).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=peekaboo.test.js.map