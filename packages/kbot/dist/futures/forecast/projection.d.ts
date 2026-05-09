import { type Forecast, type Horizon, type Signal } from './types.js';
/**
 * Linear projection: value ~ a + b*t. Bounds = point ± 2 * residual stddev.
 * Falls back to flat for fewer than 2 distinct timestamps.
 */
export declare function linearProjection(signal: Signal, horizon: Horizon): Forecast;
/**
 * Exponential projection: log-transform, fit linear, exp back.
 * Drops non-positive values (log undefined). Falls back to flat if too few
 * positive points remain.
 */
export declare function exponentialProjection(signal: Signal, horizon: Horizon): Forecast;
/** Public flat projection (callers may prefer to force this). */
export declare function flatProjection(signal: Signal, horizon: Horizon): Forecast;
/**
 * Pick the model with the best r². If both linear and exponential fit
 * poorly (r² < 0.4 in both), return flat — low-variance signals shouldn't
 * generate over-confident projections.
 */
export declare function bestProjection(signal: Signal, horizon: Horizon): Forecast;
/**
 * Guard against projecting absurdly far past available history.
 * Returns true if the horizon is acceptable given the timespan covered.
 * Rule: horizon must not exceed history span * 3.
 *
 * `history` is the timespan in ms from earliest to latest observation.
 */
export declare function clampHorizon(h: Horizon, history: number): boolean;
/** Helper for tests/synthesize: compute the timespan of a Signal in ms. */
export declare function signalHistory(signal: Signal): number;
//# sourceMappingURL=projection.d.ts.map