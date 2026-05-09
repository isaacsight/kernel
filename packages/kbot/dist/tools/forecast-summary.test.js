// forecast-summary.test — covers bootstrap path, full forecast path,
// horizon honoring, atomic writes, history cap, and narrative content.
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const TEST_DIR = join(tmpdir(), 'kbot-forecast-test-' + Date.now());
mkdirSync(TEST_DIR, { recursive: true });
process.env.KBOT_GROWTH_HISTORY_DIR = TEST_DIR;
// Mock the growth surface so tests don't depend on ~/.kbot state.
vi.mock('./foundation-engines.js', () => ({
    loadGrowth: () => ({
        metrics: {
            npmDownloads: 5000,
            githubStars: 6,
            totalUsers: 12,
            totalMessages: 1000,
            totalStreams: 0,
            totalStreamMinutes: 0,
            toolsBuilt: 670,
            factsLearned: 0,
            dreamsDreamed: 0,
            techniquesDiscovered: 0,
            worldBlocksPlaced: 0,
            versionsShipped: 0,
        },
        milestones: [],
        dailySnapshots: [],
        startDate: '2026-04-01',
    }),
}));
import { runForecastSummary, appendHistory, readHistory, buildSignals, } from './forecast-summary.js';
const HISTORY_PATH = join(TEST_DIR, 'history.jsonl');
const DAY = 24 * 60 * 60 * 1000;
function clearHistory() {
    if (existsSync(HISTORY_PATH))
        rmSync(HISTORY_PATH);
}
beforeEach(() => clearHistory());
afterAll(() => {
    try {
        rmSync(TEST_DIR, { recursive: true, force: true });
    }
    catch { }
    delete process.env.KBOT_GROWTH_HISTORY_DIR;
});
describe('forecast_summary — bootstrap', () => {
    it('returns a bootstrap warning when history is empty', () => {
        const out = runForecastSummary({ horizon: '30d', now: Date.now() });
        expect(out).toContain('bootstrapping');
        expect(out).toContain('sample 1 of 5');
    });
    it('writes the first sample to history.jsonl on first run', () => {
        runForecastSummary({ horizon: '30d', now: Date.now() });
        expect(existsSync(HISTORY_PATH)).toBe(true);
        const recs = readHistory(HISTORY_PATH);
        expect(recs).toHaveLength(1);
        expect(recs[0].signals.npmDownloads).toBe(5000);
    });
});
describe('forecast_summary — full path', () => {
    it('returns forecasts and a non-empty narrative once 5+ samples exist', () => {
        const t0 = Date.UTC(2026, 3, 1);
        // Pre-seed 12 increasing daily samples — clampHorizon for 30d requires
        // at least 10 days of history (horizon/3). 12 leaves headroom.
        for (let i = 0; i < 12; i++) {
            appendHistory({
                ts: t0 + i * DAY,
                signals: {
                    npmDownloads: 1000 + i * 200,
                    githubStars: 6 + i,
                    toolsBuilt: 670 + i,
                },
            }, HISTORY_PATH);
        }
        // Now run; metricsOverride: null so the sampler doesn't add another
        // current-time point that would distort the linear fit.
        const out = runForecastSummary({
            horizon: '30d',
            now: t0 + 12 * DAY,
            metricsOverride: null,
        });
        expect(out).toContain('# forecast_summary');
        expect(out).toMatch(/npmDownloads|githubStars|toolsBuilt/);
        // Markdown table header should appear since forecasts were produced.
        expect(out).toContain('| signal |');
    });
});
describe('forecast_summary — horizon arg', () => {
    it('honors smaller horizon → smaller projected delta from last value', () => {
        const t0 = Date.UTC(2026, 3, 1);
        // 12 days of history so clampHorizon allows 30d (horizon/3 = 10 days).
        for (let i = 0; i < 12; i++) {
            appendHistory({ ts: t0 + i * DAY, signals: { npmDownloads: 1000 + i * 100 } }, HISTORY_PATH);
        }
        const lastValue = 1000 + 11 * 100;
        const json = (text) => {
            const m = text.match(/```json\n([\s\S]+?)\n```/);
            if (!m)
                throw new Error('no json block');
            return JSON.parse(m[1]);
        };
        const out1d = runForecastSummary({ horizon: '1d', now: t0 + 12 * DAY, metricsOverride: null });
        const out30d = runForecastSummary({ horizon: '30d', now: t0 + 12 * DAY, metricsOverride: null });
        const f1 = json(out1d).forecasts.find((f) => f.signal === 'npmDownloads');
        const f30 = json(out30d).forecasts.find((f) => f.signal === 'npmDownloads');
        expect(f1.horizon).toBe('1d');
        expect(f30.horizon).toBe('30d');
        expect(Math.abs(f30.pointEstimate - lastValue)).toBeGreaterThan(Math.abs(f1.pointEstimate - lastValue));
    });
});
describe('forecast_summary — atomic write + parseability', () => {
    it('round-trips records through tmp+rename writes', () => {
        const t0 = Date.UTC(2026, 3, 1);
        for (let i = 0; i < 3; i++) {
            appendHistory({ ts: t0 + i * DAY, signals: { npmDownloads: i } }, HISTORY_PATH);
        }
        // No leftover *.tmp files in the test dir
        const raw = readFileSync(HISTORY_PATH, 'utf8');
        const lines = raw.trim().split('\n');
        expect(lines).toHaveLength(3);
        for (const line of lines) {
            expect(() => JSON.parse(line)).not.toThrow();
        }
    });
});
describe('forecast_summary — history cap', () => {
    it('caps history at 90 most recent entries', () => {
        const t0 = Date.UTC(2026, 3, 1);
        for (let i = 0; i < 120; i++) {
            appendHistory({ ts: t0 + i * DAY, signals: { npmDownloads: i } }, HISTORY_PATH);
        }
        const recs = readHistory(HISTORY_PATH);
        expect(recs).toHaveLength(90);
        // The first kept record should be index 30 (oldest 30 dropped)
        expect(recs[0].signals.npmDownloads).toBe(30);
        expect(recs[89].signals.npmDownloads).toBe(119);
    });
});
describe('forecast_summary — narrative content', () => {
    it('mentions a signal name in the markdown narrative when forecasts exist', () => {
        const t0 = Date.UTC(2026, 3, 1);
        for (let i = 0; i < 8; i++) {
            appendHistory({ ts: t0 + i * DAY, signals: { npmDownloads: 100 + i * 50 } }, HISTORY_PATH);
        }
        const out = runForecastSummary({ horizon: '7d', now: t0 + 8 * DAY, metricsOverride: null });
        // Top-line narrative from synthesize.narrative() — pulled into our markdown
        expect(out).toMatch(/Top movers:/);
        expect(out).toContain('npmDownloads');
    });
    it('buildSignals correctly groups history entries by metric name', () => {
        const recs = [
            { ts: 1, signals: { npmDownloads: 10, githubStars: 1 } },
            { ts: 2, signals: { npmDownloads: 20, githubStars: 2 } },
        ];
        const sigs = buildSignals(recs);
        expect(sigs.find((s) => s.name === 'npmDownloads').values).toHaveLength(2);
        expect(sigs.find((s) => s.name === 'githubStars').values).toHaveLength(2);
    });
});
//# sourceMappingURL=forecast-summary.test.js.map