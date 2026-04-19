// Memory prune — compact ~/.kbot/memory/solutions.json by removing entries
// that are likely stale: outdated version references, old timestamps, or low
// confidence + zero reuses. Lightweight, safe, reversible (writes a .bak file).
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
export function pruneSolutions(opts = {}) {
    const maxAgeDays = opts.maxAgeDays ?? 30;
    const minConf = opts.minConfidenceIfUnused ?? 0.3;
    const obsoletePrefix = opts.obsoleteVersionPrefix;
    const path = join(homedir(), '.kbot', 'memory', 'solutions.json');
    if (!existsSync(path)) {
        return { total: 0, kept: 0, pruned: 0, reasons: {} };
    }
    const raw = readFileSync(path, 'utf-8');
    let entries;
    try {
        entries = JSON.parse(raw);
        if (!Array.isArray(entries))
            throw new Error('not array');
    }
    catch {
        return { total: 0, kept: 0, pruned: 0, reasons: { parse_error: 1 } };
    }
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const reasons = {};
    const kept = [];
    for (const e of entries) {
        const createdMs = toMillis(e.created);
        const reuses = e.reuses ?? 0;
        const conf = e.confidence ?? 0.5;
        const solution = String(e.solution ?? '');
        // Age: anything older than cutoff AND never reused gets pruned
        if (createdMs > 0 && createdMs < cutoff && reuses === 0) {
            reasons.stale_and_unused = (reasons.stale_and_unused || 0) + 1;
            continue;
        }
        // Obsolete version references
        if (obsoletePrefix && solution.includes(obsoletePrefix)) {
            reasons.obsolete_version = (reasons.obsolete_version || 0) + 1;
            continue;
        }
        // Low confidence and never reused — likely wrong from the start
        if (conf < minConf && reuses === 0) {
            reasons.low_confidence_unused = (reasons.low_confidence_unused || 0) + 1;
            continue;
        }
        // Empty or tiny solution content
        if (solution.trim().length < 20) {
            reasons.empty_solution = (reasons.empty_solution || 0) + 1;
            continue;
        }
        kept.push(e);
    }
    const result = {
        total: entries.length,
        kept: kept.length,
        pruned: entries.length - kept.length,
        reasons,
    };
    if (!opts.dryRun && result.pruned > 0) {
        const backup = path + '.bak';
        copyFileSync(path, backup);
        writeFileSync(path, JSON.stringify(kept, null, 2));
        result.backup = backup;
    }
    return result;
}
function toMillis(created) {
    if (!created)
        return 0;
    if (typeof created === 'number')
        return created > 1e12 ? created : created * 1000;
    const parsed = Date.parse(created);
    return Number.isNaN(parsed) ? 0 : parsed;
}
//# sourceMappingURL=memory-prune.js.map