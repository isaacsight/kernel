import type { ToolDefinition } from './index.js';
import { type GrowthMetrics } from './foundation-engines.js';
import type { Horizon, Signal } from '../futures/forecast/types.js';
interface HistoryRecord {
    ts: number;
    signals: Partial<Record<keyof GrowthMetrics, number>>;
}
/** Read history file. Skips malformed lines. Returns chronological order. */
export declare function readHistory(path?: string): HistoryRecord[];
/** Append a record, cap to MAX_HISTORY entries. Atomic via tmp + rename. */
export declare function appendHistory(rec: HistoryRecord, path?: string): void;
/**
 * Convert a list of HistoryRecord into Signal[] keyed by metric name.
 * Only emits metrics that appear in at least one record.
 */
export declare function buildSignals(history: HistoryRecord[]): Signal[];
/** Run the full forecast pipeline, given a horizon and an optional clock. */
export declare function runForecastSummary(opts?: {
    horizon?: Horizon;
    now?: number;
    metricsOverride?: GrowthMetrics | null;
}): string;
export declare const forecastSummaryTool: ToolDefinition;
export {};
//# sourceMappingURL=forecast-summary.d.ts.map