// futures/forecast/projection — project Signal arrays forward in time.
// Pure functions, no IO. Three model families (linear, exponential, flat)
// + a `bestProjection` selector that picks the highest r² with bias toward
// flat when neither model fits well.
import { HORIZON_MS } from './types.js';
/**
 * Least-squares fit of y = a + b*x. Returns intercept, slope, r², and
 * residual stddev (sqrt of mean squared residual). Assumes points.length >= 2.
 */
function leastSquares(xs, ys) {
    const n = xs.length;
    let sumX = 0;
    let sumY = 0;
    for (let i = 0; i < n; i++) {
        sumX += xs[i];
        sumY += ys[i];
    }
    const meanX = sumX / n;
    const meanY = sumY / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
        const dx = xs[i] - meanX;
        num += dx * (ys[i] - meanY);
        den += dx * dx;
    }
    const slope = den === 0 ? 0 : num / den;
    const intercept = meanY - slope * meanX;
    // r²: 1 - SS_res / SS_tot
    let ssRes = 0;
    let ssTot = 0;
    for (let i = 0; i < n; i++) {
        const yhat = intercept + slope * xs[i];
        const resid = ys[i] - yhat;
        ssRes += resid * resid;
        ssTot += (ys[i] - meanY) ** 2;
    }
    const r2 = ssTot === 0 ? (ssRes === 0 ? 1 : 0) : 1 - ssRes / ssTot;
    const residualStd = Math.sqrt(ssRes / Math.max(1, n - 1));
    return { intercept, slope, r2, residualStd };
}
/** Sort signal values ascending by timestamp; drops empty signals safely. */
function sortedValues(signal) {
    return [...signal.values].sort((a, b) => a.ts - b.ts);
}
/** Map r² + sample size to a 0..1 confidence score. */
function confidenceFrom(r2, n) {
    if (n < 2)
        return 0;
    // Linearly bonus more samples up to 12; r² floor at 0 (negatives clamp).
    const sizeFactor = Math.min(1, n / 12);
    const r2Clamped = Math.max(0, Math.min(1, r2));
    return Math.max(0, Math.min(1, r2Clamped * 0.7 + sizeFactor * 0.3));
}
function flatForecast(signal, horizon, method = 'flat-mean') {
    const pts = sortedValues(signal);
    const mean = pts.length === 0 ? 0 : pts.reduce((s, p) => s + p.value, 0) / pts.length;
    let std = 0;
    if (pts.length > 1) {
        const sq = pts.reduce((s, p) => s + (p.value - mean) ** 2, 0);
        std = Math.sqrt(sq / (pts.length - 1));
    }
    const trend = { kind: 'flat', slope: 0, r2: 0 };
    return {
        signal: signal.name,
        horizon,
        trend,
        pointEstimate: mean,
        lowerBound: mean - 2 * std,
        upperBound: mean + 2 * std,
        confidence: pts.length >= 3 ? 0.4 : 0.1,
        method,
    };
}
/**
 * Linear projection: value ~ a + b*t. Bounds = point ± 2 * residual stddev.
 * Falls back to flat for fewer than 2 distinct timestamps.
 */
export function linearProjection(signal, horizon) {
    const pts = sortedValues(signal);
    if (pts.length < 2)
        return flatForecast(signal, horizon, 'flat-too-few');
    const xs = pts.map((p) => p.ts);
    const ys = pts.map((p) => p.value);
    const fit = leastSquares(xs, ys);
    const lastTs = xs[xs.length - 1];
    const targetTs = lastTs + HORIZON_MS[horizon];
    const point = fit.intercept + fit.slope * targetTs;
    const trend = { kind: 'linear', slope: fit.slope, r2: fit.r2 };
    return {
        signal: signal.name,
        horizon,
        trend,
        pointEstimate: point,
        lowerBound: point - 2 * fit.residualStd,
        upperBound: point + 2 * fit.residualStd,
        confidence: confidenceFrom(fit.r2, pts.length),
        method: 'linear-lsq',
    };
}
/**
 * Exponential projection: log-transform, fit linear, exp back.
 * Drops non-positive values (log undefined). Falls back to flat if too few
 * positive points remain.
 */
export function exponentialProjection(signal, horizon) {
    const pts = sortedValues(signal).filter((p) => p.value > 0);
    if (pts.length < 2)
        return flatForecast(signal, horizon, 'flat-nonpositive');
    const xs = pts.map((p) => p.ts);
    const ys = pts.map((p) => Math.log(p.value));
    const fit = leastSquares(xs, ys);
    const lastTs = xs[xs.length - 1];
    const targetTs = lastTs + HORIZON_MS[horizon];
    const logPoint = fit.intercept + fit.slope * targetTs;
    const point = Math.exp(logPoint);
    // Bounds in log space, then exp back (asymmetric in raw space — correct).
    const lower = Math.exp(logPoint - 2 * fit.residualStd);
    const upper = Math.exp(logPoint + 2 * fit.residualStd);
    const trend = { kind: 'exponential', slope: fit.slope, r2: fit.r2 };
    return {
        signal: signal.name,
        horizon,
        trend,
        pointEstimate: point,
        lowerBound: lower,
        upperBound: upper,
        confidence: confidenceFrom(fit.r2, pts.length),
        method: 'exp-loglin',
    };
}
/** Public flat projection (callers may prefer to force this). */
export function flatProjection(signal, horizon) {
    return flatForecast(signal, horizon);
}
/**
 * Pick the model with the best r². If both linear and exponential fit
 * poorly (r² < 0.4 in both), return flat — low-variance signals shouldn't
 * generate over-confident projections.
 */
export function bestProjection(signal, horizon) {
    const pts = sortedValues(signal);
    if (pts.length < 2)
        return flatProjection(signal, horizon);
    const lin = linearProjection(signal, horizon);
    // Exponential only meaningful when all values positive.
    const allPositive = pts.every((p) => p.value > 0);
    const exp = allPositive ? exponentialProjection(signal, horizon) : null;
    const linR2 = lin.trend.r2;
    const expR2 = exp ? exp.trend.r2 : -Infinity;
    if (linR2 < 0.4 && expR2 < 0.4) {
        return flatProjection(signal, horizon);
    }
    if (exp && expR2 > linR2)
        return exp;
    return lin;
}
/**
 * Guard against projecting absurdly far past available history.
 * Returns true if the horizon is acceptable given the timespan covered.
 * Rule: horizon must not exceed history span * 3.
 *
 * `history` is the timespan in ms from earliest to latest observation.
 */
export function clampHorizon(h, history) {
    if (history <= 0)
        return false;
    return HORIZON_MS[h] <= history * 3;
}
/** Helper for tests/synthesize: compute the timespan of a Signal in ms. */
export function signalHistory(signal) {
    if (signal.values.length < 2)
        return 0;
    const sorted = sortedValues(signal);
    return sorted[sorted.length - 1].ts - sorted[0].ts;
}
//# sourceMappingURL=projection.js.map