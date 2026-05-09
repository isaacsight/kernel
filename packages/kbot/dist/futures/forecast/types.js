// futures/forecast — type definitions for projecting growth/research signals
// forward in time. Pure types: no runtime, no IO. Consumers (synthesize.ts,
// projection.ts) build Forecasts from raw Signal arrays.
/**
 * Number of milliseconds in each horizon. Exported as a const for use by
 * projection.ts and synthesize.ts; not exported as a value-typed enum so
 * callers can keep using string literals.
 */
export const HORIZON_MS = {
    '1d': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
};
//# sourceMappingURL=types.js.map