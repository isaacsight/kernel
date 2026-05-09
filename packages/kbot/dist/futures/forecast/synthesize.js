// futures/forecast/synthesize — fan a list of Signals into Forecasts and
// produce human-readable summaries. Pure formatting; no IO.
import { bestProjection, clampHorizon, signalHistory } from './projection.js';
/**
 * Project every signal forward at the given horizon. Skips signals whose
 * history is too short for the horizon (clampHorizon = false). Returns
 * forecasts sorted by absolute slope descending so the most-moving signals
 * surface first.
 */
export function synthesizeForecasts(signals, horizon) {
    const out = [];
    for (const sig of signals) {
        if (!clampHorizon(horizon, signalHistory(sig)))
            continue;
        out.push(bestProjection(sig, horizon));
    }
    out.sort((a, b) => Math.abs(b.trend.slope) - Math.abs(a.trend.slope));
    return out;
}
function formatNumber(n) {
    if (!Number.isFinite(n))
        return '—';
    const abs = Math.abs(n);
    if (abs >= 1_000_000)
        return `${(n / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)
        return `${(n / 1_000).toFixed(1)}k`.replace('.0k', 'k');
    if (abs >= 10)
        return n.toFixed(0);
    if (abs >= 1)
        return n.toFixed(1);
    return n.toFixed(2);
}
const HORIZON_LABEL = {
    '1d': 'in 1 day',
    '7d': 'in 7 days',
    '30d': 'in 30 days',
    '90d': 'in 90 days',
};
const ARROW = {
    up: '📈',
    down: '📉',
    flat: '➖',
};
function arrowFor(slope, kind) {
    if (kind === 'flat')
        return ARROW.flat;
    if (slope > 0)
        return ARROW.up;
    if (slope < 0)
        return ARROW.down;
    return ARROW.flat;
}
/**
 * Markdown one-liner for a forecast.
 * Example: `📈 npm downloads → 14.2k (in 30 days, linear, r²=0.78, ±890)`
 */
export function formatForecast(f) {
    const arrow = arrowFor(f.trend.slope, f.trend.kind);
    const point = formatNumber(f.pointEstimate);
    const halfWidth = (f.upperBound - f.lowerBound) / 2;
    const interval = Number.isFinite(halfWidth) ? `±${formatNumber(halfWidth)}` : '±?';
    const r2Str = f.trend.kind === 'flat' ? 'flat' : `${f.trend.kind}, r²=${f.trend.r2.toFixed(2)}`;
    return `${arrow} ${f.signal} → ${point} (${HORIZON_LABEL[f.horizon]}, ${r2Str}, ${interval})`;
}
/**
 * Take a list of forecasts and produce a short paragraph naming the top-3
 * by absolute slope. If empty, returns a polite no-data sentence.
 */
export function narrative(forecasts) {
    if (forecasts.length === 0) {
        return 'No forecasts available — not enough signal history to project.';
    }
    const top = forecasts.slice(0, 3);
    const phrases = [];
    for (const f of top) {
        const direction = f.trend.kind === 'flat'
            ? 'is holding flat'
            : f.trend.slope > 0
                ? 'is trending up'
                : 'is trending down';
        const point = formatNumber(f.pointEstimate);
        const conf = `${(f.confidence * 100).toFixed(0)}% conf`;
        phrases.push(`${f.signal} ${direction} toward ${point} ${HORIZON_LABEL[f.horizon]} (${conf})`);
    }
    const head = phrases.length === 1 ? phrases[0] : phrases.slice(0, -1).join('; ') + '; and ' + phrases[phrases.length - 1];
    return `Top movers: ${head}.`;
}
//# sourceMappingURL=synthesize.js.map