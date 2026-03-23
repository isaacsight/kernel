import { describe, it, expect } from 'vitest';
import { diagnose, scoreMetrics, computeDelta, formatDiagnosis, formatEvolutionStatus, getEvolutionLog, getEvolutionStats, } from './evolution.js';
describe('evolution engine', () => {
    // ── diagnose ──
    it('returns an array of weaknesses', () => {
        const weaknesses = diagnose();
        expect(Array.isArray(weaknesses)).toBe(true);
        for (const w of weaknesses) {
            expect(w).toHaveProperty('area');
            expect(w).toHaveProperty('description');
            expect(w).toHaveProperty('severity');
            expect(w).toHaveProperty('evidence');
            expect(['low', 'medium', 'high']).toContain(w.severity);
        }
    });
    it('sorts weaknesses by severity (high first)', () => {
        const weaknesses = diagnose();
        if (weaknesses.length >= 2) {
            const severityOrder = { high: 0, medium: 1, low: 2 };
            for (let i = 1; i < weaknesses.length; i++) {
                expect(severityOrder[weaknesses[i].severity])
                    .toBeGreaterThanOrEqual(severityOrder[weaknesses[i - 1].severity]);
            }
        }
    });
    // ── scoreMetrics ──
    it('counts lines of code excluding comments', () => {
        const source = `// comment
const a = 1
const b = 2
// another comment

export function foo() {}
`;
        const m = scoreMetrics(source);
        expect(m.loc).toBe(3); // 3 non-comment, non-blank lines
    });
    it('counts complexity (branches + loops)', () => {
        const source = `
function test(x: number) {
  if (x > 0) {
    for (let i = 0; i < x; i++) {
      while (true) {
        switch (x) {
          case 1: break
          case 2: break
        }
      }
    }
  } else {
    const y = x > 0 ? 1 : 0
  }
}
`;
        const m = scoreMetrics(source);
        // if, for, while, switch, case, case, else, ternary (?:)
        expect(m.complexity).toBeGreaterThanOrEqual(6);
    });
    it('counts TODO/FIXME/HACK markers', () => {
        const source = `
// TODO: fix this
const a = 1 // FIXME later
// HACK: workaround for issue
// XXX: temporary
const clean = 2
`;
        const m = scoreMetrics(source);
        expect(m.todoCount).toBe(4);
    });
    it('counts exported symbols', () => {
        const source = `
export function foo() {}
export const BAR = 1
export class Baz {}
export interface Qux {}
export type Quux = string
export enum Status {}
function internal() {}
const local = 1
`;
        const m = scoreMetrics(source);
        expect(m.exportCount).toBe(6);
    });
    it('returns zero for empty source', () => {
        const m = scoreMetrics('');
        expect(m.loc).toBe(0);
        expect(m.complexity).toBe(0);
        expect(m.todoCount).toBe(0);
        expect(m.exportCount).toBe(0);
    });
    // ── computeDelta ──
    it('positive delta when TODOs are removed', () => {
        const before = { loc: 100, complexity: 10, todoCount: 5, exportCount: 3 };
        const after = { loc: 100, complexity: 10, todoCount: 2, exportCount: 3 };
        const delta = computeDelta(before, after);
        expect(delta).toBeGreaterThan(0);
    });
    it('positive delta when complexity is reduced', () => {
        const before = { loc: 100, complexity: 20, todoCount: 0, exportCount: 3 };
        const after = { loc: 100, complexity: 10, todoCount: 0, exportCount: 3 };
        const delta = computeDelta(before, after);
        expect(delta).toBeGreaterThan(0);
    });
    it('negative delta when exports are removed', () => {
        const before = { loc: 100, complexity: 10, todoCount: 0, exportCount: 5 };
        const after = { loc: 100, complexity: 10, todoCount: 0, exportCount: 3 };
        const delta = computeDelta(before, after);
        expect(delta).toBeLessThan(0);
    });
    it('negative delta when too much code is removed', () => {
        const before = { loc: 100, complexity: 10, todoCount: 0, exportCount: 3 };
        const after = { loc: 30, complexity: 10, todoCount: 0, exportCount: 3 };
        const delta = computeDelta(before, after);
        expect(delta).toBeLessThan(0);
    });
    it('zero delta when nothing changes', () => {
        const metrics = { loc: 100, complexity: 10, todoCount: 0, exportCount: 3 };
        const delta = computeDelta(metrics, metrics);
        expect(delta).toBe(0);
    });
    // ── formatDiagnosis ──
    it('formats empty weaknesses', () => {
        const result = formatDiagnosis([]);
        expect(result).toContain('No weaknesses');
    });
    it('formats weaknesses with correct severity icons', () => {
        const weaknesses = [
            { area: 'test', description: 'High severity', severity: 'high', evidence: 'e1' },
            { area: 'test2', description: 'Low severity', severity: 'low', evidence: 'e2' },
        ];
        const result = formatDiagnosis(weaknesses);
        expect(result).toContain('▲');
        expect(result).toContain('○');
        expect(result).toContain('High severity');
        expect(result).toContain('Low severity');
    });
    // ── formatEvolutionStatus ──
    it('formats status without errors', () => {
        const result = formatEvolutionStatus();
        expect(result).toContain('Evolution Engine');
        expect(result).toContain('Cycles run:');
        expect(result).toContain('Applied:');
    });
    // ── getEvolutionLog / getEvolutionStats ──
    it('returns a valid log array', () => {
        const log = getEvolutionLog();
        expect(Array.isArray(log)).toBe(true);
    });
    it('returns valid stats', () => {
        const stats = getEvolutionStats();
        expect(stats).toHaveProperty('totalCycles');
        expect(stats).toHaveProperty('totalApplied');
        expect(stats).toHaveProperty('totalRolledBack');
        expect(stats).toHaveProperty('totalSkipped');
        expect(stats).toHaveProperty('avgDelta');
        expect(typeof stats.totalCycles).toBe('number');
        expect(typeof stats.avgDelta).toBe('number');
    });
});
//# sourceMappingURL=evolution.test.js.map