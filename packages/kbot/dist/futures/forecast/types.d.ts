/**
 * A time series. Timestamps are ms since epoch (matches Date.now()).
 * Values are arbitrary scalars (counts, percentages, etc.).
 * Order is not required; projection.ts sorts internally.
 */
export interface Signal {
    name: string;
    values: Array<{
        ts: number;
        value: number;
    }>;
}
/**
 * Trend describes the shape of the fit chosen for a Signal.
 * - 'linear'      : value ~ a + b*t            (slope = b in value/ms)
 * - 'exponential' : value ~ exp(a + b*t)       (slope = b in log(value)/ms)
 * - 'flat'        : low-variance fallback; slope == 0, r2 == 0
 *
 * r2 is the coefficient of determination on whatever space was fit
 * (raw values for linear, log(values) for exponential).
 */
export interface Trend {
    kind: 'linear' | 'exponential' | 'flat';
    slope: number;
    r2: number;
}
/**
 * Projection horizon. Always relative to the last observed timestamp.
 * 1d/7d/30d/90d cover the practical surface (daily through quarterly).
 */
export type Horizon = '1d' | '7d' | '30d' | '90d';
/**
 * A single forecast for a single signal at a single horizon.
 *
 * - pointEstimate is the model's expected value at horizon end
 * - lowerBound / upperBound is roughly a 95% interval
 *   (point ± 2 * residual stddev, exp-transformed for exponential fits)
 * - confidence is a 0..1 score derived from r2 and history length;
 *   higher means "trust this projection more"
 * - method is a short human-readable tag, e.g. "linear-lsq", "exp-loglin",
 *   "flat-mean"
 */
export interface Forecast {
    signal: string;
    horizon: Horizon;
    trend: Trend;
    pointEstimate: number;
    lowerBound: number;
    upperBound: number;
    confidence: number;
    method: string;
}
/**
 * Number of milliseconds in each horizon. Exported as a const for use by
 * projection.ts and synthesize.ts; not exported as a value-typed enum so
 * callers can keep using string literals.
 */
export declare const HORIZON_MS: Record<Horizon, number>;
//# sourceMappingURL=types.d.ts.map