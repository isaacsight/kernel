import type { Forecast, Horizon, Signal } from './types.js';
/**
 * Project every signal forward at the given horizon. Skips signals whose
 * history is too short for the horizon (clampHorizon = false). Returns
 * forecasts sorted by absolute slope descending so the most-moving signals
 * surface first.
 */
export declare function synthesizeForecasts(signals: Signal[], horizon: Horizon): Forecast[];
/**
 * Markdown one-liner for a forecast.
 * Example: `📈 npm downloads → 14.2k (in 30 days, linear, r²=0.78, ±890)`
 */
export declare function formatForecast(f: Forecast): string;
/**
 * Take a list of forecasts and produce a short paragraph naming the top-3
 * by absolute slope. If empty, returns a polite no-data sentence.
 */
export declare function narrative(forecasts: Forecast[]): string;
//# sourceMappingURL=synthesize.d.ts.map