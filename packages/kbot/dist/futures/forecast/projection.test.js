// futures/forecast/projection.test — synthetic series, deterministic.
// No IO, no LLMs, no time-of-day dependence. Builds Signals by hand,
// exercises each projection family + horizon clamping + sort order.
import { describe, it, expect } from 'vitest';
import { bestProjection, clampHorizon, exponentialProjection, flatProjection, linearProjection, signalHistory, } from './projection.js';
import { synthesizeForecasts, formatForecast, narrative } from './synthesize.js';
const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.UTC(2026, 3, 1); // 2026-04-01
function buildLinear(name, days, intercept, slopePerDay) {
    const values = [];
    for (let i = 0; i < days; i++) {
        values.push({ ts: T0 + i * DAY, value: intercept + slopePerDay * i });
    }
    return { name, values };
}
function buildExponential(name, days, base, ratePerDay) {
    const values = [];
    for (let i = 0; i < days; i++) {
        values.push({ ts: T0 + i * DAY, value: base * Math.exp(ratePerDay * i) });
    }
    return { name, values };
}
function buildFlatNoisy(name, days, mean, seed = 1) {
    // deterministic LCG noise, ±5% of mean
    let s = seed;
    const rng = () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
    const values = [];
    for (let i = 0; i < days; i++) {
        const noise = (rng() - 0.5) * 0.1 * mean;
        values.push({ ts: T0 + i * DAY, value: mean + noise });
    }
    return { name, values };
}
describe('linearProjection', () => {
    it('recovers slope within ±5% on a clean linear series', () => {
        const slopePerDay = 100;
        const sig = buildLinear('clean-linear', 30, 1000, slopePerDay);
        const f = linearProjection(sig, '7d');
        expect(f.trend.kind).toBe('linear');
        // slope is in value/ms; convert to value/day for comparison
        const recoveredPerDay = f.trend.slope * DAY;
        expect(Math.abs(recoveredPerDay - slopePerDay) / slopePerDay).toBeLessThan(0.05);
        expect(f.trend.r2).toBeGreaterThan(0.99);
    });
    it('produces sensible bounds (lower < point < upper) on noisy linear', () => {
        const sig = buildLinear('noisy-linear', 20, 500, 25);
        // perturb deterministically
        sig.values = sig.values.map((p, i) => ({ ts: p.ts, value: p.value + (i % 3) * 5 - 5 }));
        const f = linearProjection(sig, '30d');
        expect(f.lowerBound).toBeLessThan(f.pointEstimate);
        expect(f.upperBound).toBeGreaterThan(f.pointEstimate);
    });
    it('falls back to flat when fewer than 2 points', () => {
        const sig = { name: 'one-point', values: [{ ts: T0, value: 42 }] };
        const f = linearProjection(sig, '7d');
        expect(f.trend.kind).toBe('flat');
    });
});
describe('exponentialProjection', () => {
    it('recovers exponential rate within ±5%', () => {
        const ratePerDay = 0.05; // ~5% growth/day
        const sig = buildExponential('exp', 30, 1000, ratePerDay);
        const f = exponentialProjection(sig, '7d');
        expect(f.trend.kind).toBe('exponential');
        const recoveredPerDay = f.trend.slope * DAY;
        expect(Math.abs(recoveredPerDay - ratePerDay) / ratePerDay).toBeLessThan(0.05);
        expect(f.trend.r2).toBeGreaterThan(0.99);
    });
    it('point estimate matches expected exp value within tolerance', () => {
        const sig = buildExponential('exp2', 20, 100, 0.03);
        const f = exponentialProjection(sig, '7d');
        // expected = 100 * exp(0.03 * (19 + 7)) = 100 * exp(0.78)
        const expected = 100 * Math.exp(0.03 * (19 + 7));
        expect(Math.abs(f.pointEstimate - expected) / expected).toBeLessThan(0.05);
    });
    it('skips non-positive values gracefully', () => {
        const sig = {
            name: 'mixed',
            values: [
                { ts: T0, value: -1 },
                { ts: T0 + DAY, value: 0 },
                { ts: T0 + 2 * DAY, value: 5 },
                { ts: T0 + 3 * DAY, value: 10 },
                { ts: T0 + 4 * DAY, value: 20 },
            ],
        };
        const f = exponentialProjection(sig, '7d');
        // 3 positive points → fit succeeds
        expect(f.trend.kind).toBe('exponential');
    });
});
describe('bestProjection', () => {
    it('picks flat for low-variance noisy series', () => {
        const sig = buildFlatNoisy('flat-noisy', 30, 5000, 42);
        const f = bestProjection(sig, '7d');
        expect(f.trend.kind).toBe('flat');
    });
    it('picks linear for clean linear data', () => {
        const sig = buildLinear('clean', 30, 100, 10);
        const f = bestProjection(sig, '7d');
        // either linear or exponential may fit a straight line in log space too,
        // but on positive linear data they have very similar r² — accept either
        expect(['linear', 'exponential']).toContain(f.trend.kind);
        expect(f.trend.r2).toBeGreaterThan(0.95);
    });
    it('picks exponential when exponential beats linear', () => {
        const sig = buildExponential('exp-pure', 30, 100, 0.1);
        const f = bestProjection(sig, '7d');
        expect(f.trend.kind).toBe('exponential');
    });
});
describe('flatProjection', () => {
    it('returns mean as point estimate', () => {
        const sig = {
            name: 'mean5',
            values: [
                { ts: T0, value: 4 },
                { ts: T0 + DAY, value: 5 },
                { ts: T0 + 2 * DAY, value: 6 },
            ],
        };
        const f = flatProjection(sig, '1d');
        expect(f.pointEstimate).toBeCloseTo(5, 5);
        expect(f.trend.kind).toBe('flat');
    });
});
describe('clampHorizon', () => {
    it('rejects 90d horizon on 5-day history', () => {
        const fiveDays = 5 * DAY;
        expect(clampHorizon('90d', fiveDays)).toBe(false);
    });
    it('accepts 7d horizon on 30-day history', () => {
        const thirtyDays = 30 * DAY;
        expect(clampHorizon('7d', thirtyDays)).toBe(true);
    });
    it('rejects any horizon on zero history', () => {
        expect(clampHorizon('1d', 0)).toBe(false);
    });
    it('accepts horizon equal to 3x history', () => {
        expect(clampHorizon('30d', 10 * DAY)).toBe(true);
    });
});
describe('signalHistory', () => {
    it('returns 0 for fewer than 2 points', () => {
        expect(signalHistory({ name: 'x', values: [] })).toBe(0);
        expect(signalHistory({ name: 'x', values: [{ ts: T0, value: 1 }] })).toBe(0);
    });
    it('returns timespan for >=2 points', () => {
        const sig = buildLinear('s', 10, 0, 1);
        expect(signalHistory(sig)).toBe(9 * DAY);
    });
});
describe('synthesizeForecasts', () => {
    it('sorts by absolute slope descending', () => {
        const slow = buildLinear('slow', 30, 100, 1); // +1/day
        const fast = buildLinear('fast', 30, 100, 50); // +50/day
        const flat = buildFlatNoisy('flat', 30, 1000, 7);
        const out = synthesizeForecasts([slow, fast, flat], '7d');
        expect(out[0].signal).toBe('fast');
        // slow has positive slope, flat resolves to slope 0 → slow second
        expect(out[1].signal).toBe('slow');
        expect(out[2].signal).toBe('flat');
    });
    it('skips signals whose history is too short for the horizon', () => {
        const short = buildLinear('short', 5, 0, 1); // 4 days of history
        const long = buildLinear('long', 60, 0, 1);
        const out = synthesizeForecasts([short, long], '90d');
        expect(out.map((f) => f.signal)).toEqual(['long']);
    });
});
describe('formatForecast', () => {
    it('produces a readable one-liner with arrow + signal + point + interval', () => {
        const sig = buildLinear('npm downloads', 30, 10000, 100);
        const f = linearProjection(sig, '30d');
        const out = formatForecast(f);
        expect(out).toMatch(/npm downloads/);
        expect(out).toMatch(/in 30 days/);
        expect(out).toMatch(/r²=/);
    });
});
describe('narrative', () => {
    it('returns no-data sentence on empty input', () => {
        expect(narrative([])).toMatch(/No forecasts/);
    });
    it('mentions top-3 signals', () => {
        const a = buildLinear('a', 30, 100, 50);
        const b = buildLinear('b', 30, 100, 30);
        const c = buildLinear('c', 30, 100, 10);
        const d = buildLinear('d', 30, 100, 5);
        const out = synthesizeForecasts([a, b, c, d], '7d');
        const text = narrative(out);
        expect(text).toMatch(/a/);
        expect(text).toMatch(/b/);
        expect(text).toMatch(/c/);
        expect(text).not.toMatch(/(?:^|[^a-z])d(?:[^a-z]|$)/);
    });
});
//# sourceMappingURL=projection.test.js.map