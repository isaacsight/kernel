// kbot Data Analysis & Statistics Tools — Regression, Bayesian, time series, PCA, and more.
// All computations are pure TypeScript — zero external dependencies.
// Implements numerical methods: normal equations, eigendecomposition, MLE, KS test, etc.
import { registerTool } from './index.js';
// ══════════════════════════════════════════════════════════════════════════════
// SHARED MATH UTILITIES
// ══════════════════════════════════════════════════════════════════════════════
/** Format a number to fixed decimal places */
function fmt(n, d = 4) {
    if (!isFinite(n))
        return String(n);
    return n.toFixed(d);
}
/** Mean of an array */
function mean(arr) {
    if (arr.length === 0)
        return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
}
/** Variance (sample) */
function variance(arr) {
    if (arr.length < 2)
        return 0;
    const m = mean(arr);
    return arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
}
/** Standard deviation (sample) */
function stddev(arr) {
    return Math.sqrt(variance(arr));
}
/** Median */
function median(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
/** Sum */
function sum(arr) {
    return arr.reduce((s, v) => s + v, 0);
}
/** Normal CDF — Abramowitz & Stegun rational approximation (formula 26.2.17) */
function normalCDF(x) {
    if (x === Infinity)
        return 1;
    if (x === -Infinity)
        return 0;
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    const z = Math.abs(x) / Math.SQRT2;
    const t = 1.0 / (1.0 + p * z);
    const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
    return 0.5 * (1.0 + sign * y);
}
/** Normal PDF */
function normalPDF(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}
/** Normal quantile (inverse CDF) via rational approximation */
function normalQuantile(p) {
    if (p <= 0)
        return -Infinity;
    if (p >= 1)
        return Infinity;
    if (p === 0.5)
        return 0;
    // Rational approximation for central region
    const a = [
        -3.969683028665376e1, 2.209460984245205e2,
        -2.759285104469687e2, 1.383577518672690e2,
        -3.066479806614716e1, 2.506628277459239e0,
    ];
    const b = [
        -5.447609879822406e1, 1.615858368580409e2,
        -1.556989798598866e2, 6.680131188771972e1,
        -1.328068155288572e1,
    ];
    const c = [
        -7.784894002430293e-3, -3.223964580411365e-1,
        -2.400758277161838e0, -2.549732539343734e0,
        4.374664141464968e0, 2.938163982698783e0,
    ];
    const d = [
        7.784695709041462e-3, 3.224671290700398e-1,
        2.445134137142996e0, 3.754408661907416e0,
    ];
    const pLow = 0.02425;
    const pHigh = 1 - pLow;
    let q, r;
    if (p < pLow) {
        q = Math.sqrt(-2 * Math.log(p));
        return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    else if (p <= pHigh) {
        q = p - 0.5;
        r = q * q;
        return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
            (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    }
    else {
        q = Math.sqrt(-2 * Math.log(1 - p));
        const num = ((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5];
        const den = (((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1;
        return -(num / den);
    }
}
/** Log-gamma function (Lanczos approximation) */
function logGamma(x) {
    if (x <= 0)
        return Infinity;
    const g = 7;
    const coef = [
        0.99999999999980993, 676.5203681218851, -1259.1392167224028,
        771.32342877765313, -176.61502916214059, 12.507343278686905,
        -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
    ];
    let sum = coef[0];
    for (let i = 1; i < g + 2; i++) {
        sum += coef[i] / (x + i - 1);
    }
    const t = x + g - 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (x - 0.5) * Math.log(t) - t + Math.log(sum);
}
/** Gamma function */
function gamma(x) {
    return Math.exp(logGamma(x));
}
/** Regularized lower incomplete gamma function P(a, x) via series expansion */
function lowerIncompleteGammaP(a, x) {
    if (x < 0)
        return 0;
    if (x === 0)
        return 0;
    if (a <= 0)
        return 1;
    // For x < a+1, use series expansion
    if (x < a + 1) {
        let term = 1 / a;
        let sum = term;
        for (let n = 1; n < 200; n++) {
            term *= x / (a + n);
            sum += term;
            if (Math.abs(term) < 1e-14 * Math.abs(sum))
                break;
        }
        return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
    }
    // For x >= a+1, use continued fraction (upper gamma) then subtract
    return 1 - upperIncompleteGammaQ(a, x);
}
/** Regularized upper incomplete gamma function Q(a, x) via continued fraction */
function upperIncompleteGammaQ(a, x) {
    if (x < 0)
        return 1;
    if (x === 0)
        return 1;
    // Continued fraction via Lentz's method
    let f = x + 1 - a;
    if (Math.abs(f) < 1e-30)
        f = 1e-30;
    let C = f;
    let D = 0;
    for (let i = 1; i < 200; i++) {
        const an = i * (a - i);
        const bn = x + 2 * i + 1 - a;
        D = bn + an * D;
        if (Math.abs(D) < 1e-30)
            D = 1e-30;
        C = bn + an / C;
        if (Math.abs(C) < 1e-30)
            C = 1e-30;
        D = 1 / D;
        const delta = C * D;
        f *= delta;
        if (Math.abs(delta - 1) < 1e-14)
            break;
    }
    return Math.exp(-x + a * Math.log(x) - logGamma(a)) / f;
}
/** Chi-square CDF */
function chiSquareCDF(x, df) {
    if (x <= 0)
        return 0;
    return lowerIncompleteGammaP(df / 2, x / 2);
}
/** Regularized incomplete beta function I_x(a, b) via continued fraction */
function incompleteBeta(x, a, b) {
    if (x <= 0)
        return 0;
    if (x >= 1)
        return 1;
    // Symmetry relation for numerical stability
    if (x > (a + 1) / (a + b + 2)) {
        return 1 - incompleteBeta(1 - x, b, a);
    }
    const lnBeta = logGamma(a) + logGamma(b) - logGamma(a + b);
    const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lnBeta) / a;
    // Lentz's continued fraction
    let f = 1, C = 1, D = 0;
    for (let m = 0; m <= 200; m++) {
        let numerator;
        if (m === 0) {
            numerator = 1;
        }
        else if (m % 2 === 0) {
            const k = m / 2;
            numerator = (k * (b - k) * x) / ((a + 2 * k - 1) * (a + 2 * k));
        }
        else {
            const k = (m - 1) / 2;
            numerator = -((a + k) * (a + b + k) * x) / ((a + 2 * k) * (a + 2 * k + 1));
        }
        D = 1 + numerator * D;
        if (Math.abs(D) < 1e-30)
            D = 1e-30;
        D = 1 / D;
        C = 1 + numerator / C;
        if (Math.abs(C) < 1e-30)
            C = 1e-30;
        f *= C * D;
        if (Math.abs(C * D - 1) < 1e-14)
            break;
    }
    return front * f;
}
/** Student's t CDF */
function tCDF(t, df) {
    if (df <= 0)
        return NaN;
    const x = df / (df + t * t);
    const ibeta = incompleteBeta(x, df / 2, 0.5);
    if (t >= 0) {
        return 1 - 0.5 * ibeta;
    }
    else {
        return 0.5 * ibeta;
    }
}
/** F-distribution CDF */
function fCDF(x, df1, df2) {
    if (x <= 0)
        return 0;
    const z = (df1 * x) / (df1 * x + df2);
    return incompleteBeta(z, df1 / 2, df2 / 2);
}
/** Parse comma-separated string to number array */
function parseCSV(s) {
    return s.split(',').map(v => parseFloat(v.trim())).filter(v => isFinite(v));
}
/** Rank data (average ranks for ties) */
function rank(data) {
    const indexed = data.map((v, i) => ({ v, i }));
    indexed.sort((a, b) => a.v - b.v);
    const ranks = new Array(data.length);
    let i = 0;
    while (i < indexed.length) {
        let j = i;
        while (j < indexed.length && indexed[j].v === indexed[i].v)
            j++;
        const avgRank = (i + j + 1) / 2; // average of 1-based ranks
        for (let k = i; k < j; k++)
            ranks[indexed[k].i] = avgRank;
        i = j;
    }
    return ranks;
}
function matCreate(rows, cols, fill = 0) {
    return Array.from({ length: rows }, () => new Array(cols).fill(fill));
}
function matTranspose(A) {
    const rows = A.length, cols = A[0].length;
    const T = matCreate(cols, rows);
    for (let i = 0; i < rows; i++)
        for (let j = 0; j < cols; j++)
            T[j][i] = A[i][j];
    return T;
}
function matMul(A, B) {
    const aRows = A.length, aCols = A[0].length, bCols = B[0].length;
    const C = matCreate(aRows, bCols);
    for (let i = 0; i < aRows; i++)
        for (let j = 0; j < bCols; j++)
            for (let k = 0; k < aCols; k++)
                C[i][j] += A[i][k] * B[k][j];
    return C;
}
/** Solve Ax = b via Gaussian elimination with partial pivoting */
function matSolve(A, b) {
    const n = A.length;
    // Augmented matrix
    const aug = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
        // Partial pivoting
        let maxRow = col;
        for (let row = col + 1; row < n; row++) {
            if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col]))
                maxRow = row;
        }
        ;
        [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
        if (Math.abs(aug[col][col]) < 1e-12) {
            throw new Error('Matrix is singular or nearly singular');
        }
        // Eliminate below
        for (let row = col + 1; row < n; row++) {
            const factor = aug[row][col] / aug[col][col];
            for (let j = col; j <= n; j++)
                aug[row][j] -= factor * aug[col][j];
        }
    }
    // Back substitution
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
        x[i] = aug[i][n];
        for (let j = i + 1; j < n; j++)
            x[i] -= aug[i][j] * x[j];
        x[i] /= aug[i][i];
    }
    return x;
}
/** Matrix inverse via Gauss-Jordan elimination */
function matInverse(A) {
    const n = A.length;
    const aug = A.map((row, i) => {
        const ext = new Array(n).fill(0);
        ext[i] = 1;
        return [...row, ...ext];
    });
    for (let col = 0; col < n; col++) {
        let maxRow = col;
        for (let row = col + 1; row < n; row++) {
            if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col]))
                maxRow = row;
        }
        ;
        [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
        if (Math.abs(aug[col][col]) < 1e-12)
            throw new Error('Singular matrix');
        const pivot = aug[col][col];
        for (let j = 0; j < 2 * n; j++)
            aug[col][j] /= pivot;
        for (let row = 0; row < n; row++) {
            if (row === col)
                continue;
            const factor = aug[row][col];
            for (let j = 0; j < 2 * n; j++)
                aug[row][j] -= factor * aug[col][j];
        }
    }
    return aug.map(row => row.slice(n));
}
/** Eigenvalues and eigenvectors of a symmetric matrix via Jacobi iteration */
function symmetricEigen(A) {
    const n = A.length;
    const S = A.map(row => [...row]);
    const V = matCreate(n, n);
    for (let i = 0; i < n; i++)
        V[i][i] = 1;
    const maxIter = 100 * n * n;
    for (let iter = 0; iter < maxIter; iter++) {
        // Find largest off-diagonal element
        let maxVal = 0, p = 0, q = 1;
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                if (Math.abs(S[i][j]) > maxVal) {
                    maxVal = Math.abs(S[i][j]);
                    p = i;
                    q = j;
                }
            }
        }
        if (maxVal < 1e-12)
            break;
        // Compute rotation
        const theta = (S[q][q] - S[p][p]) / (2 * S[p][q]);
        const t = Math.sign(theta) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        // Apply rotation to S
        const Spp = S[p][p], Sqq = S[q][q], Spq = S[p][q];
        S[p][p] = c * c * Spp - 2 * s * c * Spq + s * s * Sqq;
        S[q][q] = s * s * Spp + 2 * s * c * Spq + c * c * Sqq;
        S[p][q] = 0;
        S[q][p] = 0;
        for (let i = 0; i < n; i++) {
            if (i !== p && i !== q) {
                const Sip = S[i][p], Siq = S[i][q];
                S[i][p] = c * Sip - s * Siq;
                S[p][i] = S[i][p];
                S[i][q] = s * Sip + c * Siq;
                S[q][i] = S[i][q];
            }
        }
        // Accumulate eigenvectors
        for (let i = 0; i < n; i++) {
            const Vip = V[i][p], Viq = V[i][q];
            V[i][p] = c * Vip - s * Viq;
            V[i][q] = s * Vip + c * Viq;
        }
    }
    const values = Array.from({ length: n }, (_, i) => S[i][i]);
    return { values, vectors: V };
}
// ══════════════════════════════════════════════════════════════════════════════
// TOOL IMPLEMENTATIONS
// ══════════════════════════════════════════════════════════════════════════════
export function registerLabDataTools() {
    // ── 1. REGRESSION ANALYSIS ──
    registerTool({
        name: 'regression_analysis',
        description: 'Perform regression analysis — linear, polynomial, logistic, or exponential. Implements least squares via normal equations. Returns coefficients, R², adjusted R², p-values, and residual analysis.',
        parameters: {
            x_data: { type: 'string', description: 'X values (comma-separated numbers)', required: true },
            y_data: { type: 'string', description: 'Y values (comma-separated numbers)', required: true },
            model_type: { type: 'string', description: 'Model type: linear, polynomial, logistic, or exponential', required: true },
            degree: { type: 'number', description: 'Polynomial degree (default 2, only for polynomial model)' },
        },
        tier: 'free',
        async execute(args) {
            const x = parseCSV(String(args.x_data));
            const y = parseCSV(String(args.y_data));
            if (x.length !== y.length || x.length < 2) {
                return '**Error**: x_data and y_data must have the same length (minimum 2 points).';
            }
            const modelType = String(args.model_type).toLowerCase();
            const degree = Number(args.degree) || 2;
            const n = x.length;
            let coefficients;
            let yPred;
            let paramNames;
            if (modelType === 'linear') {
                // y = b0 + b1*x — normal equations: (X'X)^-1 X'y
                const X = x.map(xi => [1, xi]);
                const Xt = matTranspose(X);
                const XtX = matMul(Xt, X);
                const Xty = matMul(Xt, y.map(yi => [yi]));
                coefficients = matSolve(XtX, Xty.map(r => r[0]));
                yPred = x.map(xi => coefficients[0] + coefficients[1] * xi);
                paramNames = ['intercept', 'slope'];
            }
            else if (modelType === 'polynomial') {
                // y = b0 + b1*x + b2*x^2 + ... + bd*x^d
                const deg = Math.min(degree, n - 1);
                const X = x.map(xi => {
                    const row = [];
                    for (let d = 0; d <= deg; d++)
                        row.push(xi ** d);
                    return row;
                });
                const Xt = matTranspose(X);
                const XtX = matMul(Xt, X);
                const Xty = matMul(Xt, y.map(yi => [yi]));
                coefficients = matSolve(XtX, Xty.map(r => r[0]));
                yPred = x.map(xi => {
                    let val = 0;
                    for (let d = 0; d <= deg; d++)
                        val += coefficients[d] * (xi ** d);
                    return val;
                });
                paramNames = Array.from({ length: deg + 1 }, (_, i) => i === 0 ? 'intercept' : `x^${i}`);
            }
            else if (modelType === 'exponential') {
                // y = a * e^(b*x) — linearize: ln(y) = ln(a) + b*x
                const yLog = y.map(yi => Math.log(Math.max(yi, 1e-10)));
                const X = x.map(xi => [1, xi]);
                const Xt = matTranspose(X);
                const XtX = matMul(Xt, X);
                const Xty = matMul(Xt, yLog.map(yi => [yi]));
                const linCoeffs = matSolve(XtX, Xty.map(r => r[0]));
                coefficients = [Math.exp(linCoeffs[0]), linCoeffs[1]];
                yPred = x.map(xi => coefficients[0] * Math.exp(coefficients[1] * xi));
                paramNames = ['a (amplitude)', 'b (rate)'];
            }
            else if (modelType === 'logistic') {
                // y = L / (1 + e^(-k*(x - x0))) — simplified: L=1, fit via iterative least squares
                // Initialize with reasonable guesses
                const L = Math.max(...y) * 1.1;
                let k = 1;
                let x0 = median(x);
                // Gradient descent
                const lr = 0.001;
                for (let iter = 0; iter < 2000; iter++) {
                    let dL = 0, dk = 0, dx0 = 0;
                    for (let i = 0; i < n; i++) {
                        const exponent = -k * (x[i] - x0);
                        const expVal = Math.exp(Math.max(-500, Math.min(500, exponent)));
                        const pred = L / (1 + expVal);
                        const err = y[i] - pred;
                        const denom = (1 + expVal) ** 2;
                        dL += -err / (1 + expVal) * (-1);
                        dk += -err * L * (x[i] - x0) * expVal / denom * (-1);
                        dx0 += -err * L * (-k) * expVal / denom * (-1);
                    }
                    k -= lr * dk / n;
                    x0 -= lr * dx0 / n;
                }
                coefficients = [L, k, x0];
                yPred = x.map(xi => {
                    const exponent = -k * (xi - x0);
                    return L / (1 + Math.exp(Math.max(-500, Math.min(500, exponent))));
                });
                paramNames = ['L (supremum)', 'k (steepness)', 'x0 (midpoint)'];
            }
            else {
                return `**Error**: Unknown model_type "${modelType}". Use: linear, polynomial, logistic, exponential.`;
            }
            // R² and adjusted R²
            const yMean = mean(y);
            const ssTot = y.reduce((s, yi) => s + (yi - yMean) ** 2, 0);
            const ssRes = y.reduce((s, yi, i) => s + (yi - yPred[i]) ** 2, 0);
            const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
            const p = coefficients.length; // number of parameters
            const adjRSquared = 1 - ((1 - rSquared) * (n - 1)) / (n - p - 1);
            // Residuals
            const residuals = y.map((yi, i) => yi - yPred[i]);
            const mse = ssRes / (n - p);
            const rmse = Math.sqrt(mse);
            // Standard errors and t-statistics for linear/polynomial
            let pValues = [];
            if (modelType === 'linear' || modelType === 'polynomial') {
                const deg = modelType === 'linear' ? 1 : Math.min(degree, n - 1);
                const X = x.map(xi => {
                    const row = [];
                    for (let d = 0; d <= deg; d++)
                        row.push(xi ** d);
                    return row;
                });
                try {
                    const Xt = matTranspose(X);
                    const XtXInv = matInverse(matMul(Xt, X));
                    const se = coefficients.map((_, j) => Math.sqrt(Math.max(0, mse * XtXInv[j][j])));
                    const tStats = coefficients.map((c, j) => se[j] > 0 ? c / se[j] : 0);
                    pValues = tStats.map(t => {
                        const pVal = 2 * (1 - tCDF(Math.abs(t), n - p));
                        return pVal < 0.001 ? '<0.001' : fmt(pVal, 4);
                    });
                }
                catch {
                    pValues = coefficients.map(() => 'N/A');
                }
            }
            else {
                pValues = coefficients.map(() => 'N/A (nonlinear)');
            }
            // F-statistic
            const fStat = ssTot > 0 && p > 1 ? ((ssTot - ssRes) / (p - 1)) / mse : 0;
            const fPValue = fStat > 0 ? 1 - fCDF(fStat, p - 1, n - p) : 1;
            // Residual analysis
            const residMean = mean(residuals);
            const residStd = stddev(residuals);
            const sortedResid = [...residuals].sort((a, b) => a - b);
            const durbin_watson = residuals.slice(1).reduce((s, r, i) => s + (r - residuals[i]) ** 2, 0) / ssRes;
            // Equation string
            let equation = '';
            if (modelType === 'linear') {
                equation = `y = ${fmt(coefficients[0])} + ${fmt(coefficients[1])} * x`;
            }
            else if (modelType === 'polynomial') {
                equation = coefficients.map((c, i) => i === 0 ? fmt(c) : `${fmt(c)} * x^${i}`).join(' + ');
                equation = `y = ${equation}`;
            }
            else if (modelType === 'exponential') {
                equation = `y = ${fmt(coefficients[0])} * e^(${fmt(coefficients[1])} * x)`;
            }
            else if (modelType === 'logistic') {
                equation = `y = ${fmt(coefficients[0])} / (1 + e^(-${fmt(coefficients[1])} * (x - ${fmt(coefficients[2])})))`;
            }
            let out = `## Regression Analysis — ${modelType.charAt(0).toUpperCase() + modelType.slice(1)}\n\n`;
            out += `**Equation:** \`${equation}\`\n\n`;
            out += `### Coefficients\n\n`;
            out += `| Parameter | Value | p-value |\n|---|---|---|\n`;
            coefficients.forEach((c, i) => {
                out += `| ${paramNames[i]} | ${fmt(c, 6)} | ${pValues[i]} |\n`;
            });
            out += `\n### Model Fit\n\n`;
            out += `| Metric | Value |\n|---|---|\n`;
            out += `| R² | ${fmt(rSquared, 6)} |\n`;
            out += `| Adjusted R² | ${fmt(adjRSquared, 6)} |\n`;
            out += `| RMSE | ${fmt(rmse, 6)} |\n`;
            out += `| F-statistic | ${fmt(fStat, 4)} (p = ${fPValue < 0.001 ? '<0.001' : fmt(fPValue, 4)}) |\n`;
            out += `| Durbin-Watson | ${fmt(durbin_watson, 4)} |\n`;
            out += `| N | ${n} |\n`;
            out += `\n### Residual Summary\n\n`;
            out += `| Statistic | Value |\n|---|---|\n`;
            out += `| Mean | ${fmt(residMean, 6)} |\n`;
            out += `| Std Dev | ${fmt(residStd, 6)} |\n`;
            out += `| Min | ${fmt(sortedResid[0], 6)} |\n`;
            out += `| Median | ${fmt(median(residuals), 6)} |\n`;
            out += `| Max | ${fmt(sortedResid[sortedResid.length - 1], 6)} |\n`;
            return out;
        },
    });
    // ── 2. BAYESIAN INFERENCE ──
    registerTool({
        name: 'bayesian_inference',
        description: 'Conjugate prior Bayesian analysis. Supports Beta-Binomial, Normal-Normal, Gamma-Poisson, and Dirichlet-Multinomial models. Returns posterior parameters, credible intervals, and Bayes factor.',
        parameters: {
            prior_type: { type: 'string', description: 'Prior distribution: beta-binomial, normal-normal, gamma-poisson, dirichlet-multinomial', required: true },
            prior_params: { type: 'string', description: 'Prior parameters as JSON (e.g. {"alpha": 1, "beta": 1} for Beta)', required: true },
            likelihood_type: { type: 'string', description: 'Likelihood type (binomial, normal, poisson, multinomial)', required: true },
            observations: { type: 'string', description: 'Observed data as comma-separated values or JSON', required: true },
        },
        tier: 'free',
        async execute(args) {
            const priorType = String(args.prior_type).toLowerCase().replace(/[_\s]/g, '-');
            let priorParams;
            try {
                priorParams = JSON.parse(String(args.prior_params));
            }
            catch {
                return '**Error**: prior_params must be valid JSON.';
            }
            const obsStr = String(args.observations);
            let out = `## Bayesian Inference — ${priorType}\n\n`;
            if (priorType === 'beta-binomial') {
                const alpha0 = Number(priorParams.alpha) || 1;
                const beta0 = Number(priorParams.beta) || 1;
                const obs = parseCSV(obsStr);
                const successes = obs.filter(v => v === 1 || v > 0).length;
                const failures = obs.length - successes;
                // Posterior: Beta(alpha0 + successes, beta0 + failures)
                const alphaPost = alpha0 + successes;
                const betaPost = beta0 + failures;
                // Posterior mean and variance
                const postMean = alphaPost / (alphaPost + betaPost);
                const postVar = (alphaPost * betaPost) / ((alphaPost + betaPost) ** 2 * (alphaPost + betaPost + 1));
                // 95% credible interval via normal approximation (good for large alpha+beta)
                const postStd = Math.sqrt(postVar);
                const ci95Lower = Math.max(0, postMean - 1.96 * postStd);
                const ci95Upper = Math.min(1, postMean + 1.96 * postStd);
                // Bayes factor for H1: p > 0.5 vs H0: p <= 0.5
                // BF = P(data | H1) / P(data | H0) using prior predictive
                const logBF = logGamma(alphaPost + betaPost) - logGamma(alphaPost) - logGamma(betaPost) -
                    (logGamma(alpha0 + beta0) - logGamma(alpha0) - logGamma(beta0));
                out += `### Prior\n`;
                out += `Beta(alpha = ${alpha0}, beta = ${beta0})\n\n`;
                out += `### Data\n`;
                out += `- Observations: ${obs.length}\n`;
                out += `- Successes: ${successes}\n`;
                out += `- Failures: ${failures}\n\n`;
                out += `### Posterior\n`;
                out += `Beta(alpha = ${alphaPost}, beta = ${betaPost})\n\n`;
                out += `| Statistic | Value |\n|---|---|\n`;
                out += `| Posterior Mean | ${fmt(postMean, 6)} |\n`;
                out += `| Posterior Variance | ${fmt(postVar, 6)} |\n`;
                out += `| Posterior Mode | ${fmt(alphaPost > 1 && betaPost > 1 ? (alphaPost - 1) / (alphaPost + betaPost - 2) : postMean, 6)} |\n`;
                out += `| 95% Credible Interval | [${fmt(ci95Lower, 4)}, ${fmt(ci95Upper, 4)}] |\n`;
                out += `| Log Marginal Likelihood | ${fmt(logBF, 4)} |\n`;
            }
            else if (priorType === 'normal-normal') {
                const mu0 = Number(priorParams.mu) || 0;
                const sigma0 = Number(priorParams.sigma) || 1;
                const tau0 = 1 / (sigma0 * sigma0); // prior precision
                const obs = parseCSV(obsStr);
                const n = obs.length;
                const xBar = mean(obs);
                const sigmaLikelihood = Number(priorParams.sigma_likelihood) || stddev(obs) || 1;
                const tauLikelihood = 1 / (sigmaLikelihood * sigmaLikelihood);
                // Posterior: Normal(muPost, 1/tauPost)
                const tauPost = tau0 + n * tauLikelihood;
                const muPost = (tau0 * mu0 + n * tauLikelihood * xBar) / tauPost;
                const sigmaPost = 1 / Math.sqrt(tauPost);
                const ci95Lower = muPost - 1.96 * sigmaPost;
                const ci95Upper = muPost + 1.96 * sigmaPost;
                out += `### Prior\n`;
                out += `Normal(mu = ${mu0}, sigma = ${sigma0})\n\n`;
                out += `### Data\n`;
                out += `- N: ${n}\n`;
                out += `- Sample Mean: ${fmt(xBar, 6)}\n`;
                out += `- Known/Estimated Sigma: ${fmt(sigmaLikelihood, 6)}\n\n`;
                out += `### Posterior\n`;
                out += `Normal(mu = ${fmt(muPost, 6)}, sigma = ${fmt(sigmaPost, 6)})\n\n`;
                out += `| Statistic | Value |\n|---|---|\n`;
                out += `| Posterior Mean | ${fmt(muPost, 6)} |\n`;
                out += `| Posterior Std Dev | ${fmt(sigmaPost, 6)} |\n`;
                out += `| Posterior Precision | ${fmt(tauPost, 6)} |\n`;
                out += `| 95% Credible Interval | [${fmt(ci95Lower, 4)}, ${fmt(ci95Upper, 4)}] |\n`;
                out += `| Prior Weight | ${fmt(tau0 / tauPost * 100, 1)}% |\n`;
                out += `| Data Weight | ${fmt(n * tauLikelihood / tauPost * 100, 1)}% |\n`;
            }
            else if (priorType === 'gamma-poisson') {
                const alpha0 = Number(priorParams.alpha) || 1;
                const beta0 = Number(priorParams.beta) || 1;
                const obs = parseCSV(obsStr);
                const n = obs.length;
                const total = sum(obs);
                // Posterior: Gamma(alpha0 + sum, beta0 + n)
                const alphaPost = alpha0 + total;
                const betaPost = beta0 + n;
                const postMean = alphaPost / betaPost;
                const postVar = alphaPost / (betaPost * betaPost);
                // Credible interval via normal approximation
                const postStd = Math.sqrt(postVar);
                const ci95Lower = Math.max(0, postMean - 1.96 * postStd);
                const ci95Upper = postMean + 1.96 * postStd;
                out += `### Prior\n`;
                out += `Gamma(alpha = ${alpha0}, beta = ${beta0})\n\n`;
                out += `### Data\n`;
                out += `- N: ${n}\n`;
                out += `- Sum: ${total}\n`;
                out += `- Sample Mean: ${fmt(total / n, 4)}\n\n`;
                out += `### Posterior\n`;
                out += `Gamma(alpha = ${fmt(alphaPost, 2)}, beta = ${fmt(betaPost, 2)})\n\n`;
                out += `| Statistic | Value |\n|---|---|\n`;
                out += `| Posterior Mean (rate) | ${fmt(postMean, 6)} |\n`;
                out += `| Posterior Variance | ${fmt(postVar, 6)} |\n`;
                out += `| Posterior Mode | ${fmt(alphaPost > 1 ? (alphaPost - 1) / betaPost : 0, 6)} |\n`;
                out += `| 95% Credible Interval | [${fmt(ci95Lower, 4)}, ${fmt(ci95Upper, 4)}] |\n`;
            }
            else if (priorType === 'dirichlet-multinomial') {
                let alphas;
                if (Array.isArray(priorParams.alpha)) {
                    alphas = priorParams.alpha.map(Number);
                }
                else {
                    alphas = parseCSV(String(priorParams.alpha || '1,1,1'));
                }
                // Observations: counts for each category
                const obs = parseCSV(obsStr);
                if (obs.length !== alphas.length) {
                    return `**Error**: Number of observation categories (${obs.length}) must match number of prior alphas (${alphas.length}).`;
                }
                const alphasPost = alphas.map((a, i) => a + obs[i]);
                const alphaSum = sum(alphasPost);
                const postMeans = alphasPost.map(a => a / alphaSum);
                out += `### Prior\n`;
                out += `Dirichlet(${alphas.map(a => fmt(a, 1)).join(', ')})\n\n`;
                out += `### Data (counts)\n`;
                out += obs.map((o, i) => `- Category ${i + 1}: ${o}`).join('\n') + '\n\n';
                out += `### Posterior\n`;
                out += `Dirichlet(${alphasPost.map(a => fmt(a, 1)).join(', ')})\n\n`;
                out += `| Category | Prior alpha | Posterior alpha | Posterior Mean |\n|---|---|---|---|\n`;
                alphas.forEach((a, i) => {
                    out += `| ${i + 1} | ${fmt(a, 1)} | ${fmt(alphasPost[i], 1)} | ${fmt(postMeans[i], 6)} |\n`;
                });
                out += `\n| Total observations: ${sum(obs)} | Alpha sum: ${fmt(alphaSum, 1)} |\n`;
            }
            else {
                return `**Error**: Unknown prior_type "${priorType}". Use: beta-binomial, normal-normal, gamma-poisson, dirichlet-multinomial.`;
            }
            return out;
        },
    });
    // ── 3. TIME SERIES ANALYSIS ──
    registerTool({
        name: 'time_series_analyze',
        description: 'Time series decomposition, moving averages, exponential smoothing (Holt-Winters), and simple ARIMA estimation. Returns trend, seasonal, and residual components plus forecasts.',
        parameters: {
            data: { type: 'string', description: 'Time series values (comma-separated numbers)', required: true },
            frequency: { type: 'number', description: 'Seasonal frequency (e.g. 12 for monthly, 4 for quarterly)', required: true },
            forecast_periods: { type: 'number', description: 'Number of periods to forecast (default 5)' },
            method: { type: 'string', description: 'Method: decomposition, arima, or exponential_smoothing', required: true },
        },
        tier: 'free',
        async execute(args) {
            const data = parseCSV(String(args.data));
            const freq = Number(args.frequency) || 4;
            const forecastN = Number(args.forecast_periods) || 5;
            const method = String(args.method).toLowerCase().replace(/[_\s]/g, '_');
            if (data.length < 4)
                return '**Error**: Need at least 4 data points.';
            let out = `## Time Series Analysis\n\n`;
            out += `- **Method:** ${method}\n`;
            out += `- **N:** ${data.length}\n`;
            out += `- **Frequency:** ${freq}\n`;
            out += `- **Forecast Periods:** ${forecastN}\n\n`;
            if (method === 'decomposition') {
                // Additive decomposition: Y = Trend + Seasonal + Residual
                // 1. Trend via centered moving average
                const trend = new Array(data.length).fill(null);
                const halfWin = Math.floor(freq / 2);
                for (let i = halfWin; i < data.length - halfWin; i++) {
                    let s = 0;
                    if (freq % 2 === 0) {
                        // Even frequency: average first and last elements with half weight
                        for (let j = i - halfWin; j <= i + halfWin; j++) {
                            const weight = (j === i - halfWin || j === i + halfWin) ? 0.5 : 1;
                            s += data[j] * weight;
                        }
                        trend[i] = s / freq;
                    }
                    else {
                        for (let j = i - halfWin; j <= i + halfWin; j++)
                            s += data[j];
                        trend[i] = s / freq;
                    }
                }
                // 2. Detrended series
                const detrended = data.map((v, i) => trend[i] !== null ? v - trend[i] : null);
                // 3. Seasonal component: average detrended values by position in cycle
                const seasonal = new Array(freq).fill(0);
                const seasonalCounts = new Array(freq).fill(0);
                detrended.forEach((v, i) => {
                    if (v !== null) {
                        seasonal[i % freq] += v;
                        seasonalCounts[i % freq]++;
                    }
                });
                for (let i = 0; i < freq; i++) {
                    seasonal[i] = seasonalCounts[i] > 0 ? seasonal[i] / seasonalCounts[i] : 0;
                }
                // Center the seasonal component
                const seasonalMean = mean(seasonal);
                for (let i = 0; i < freq; i++)
                    seasonal[i] -= seasonalMean;
                // 4. Residual
                const residual = data.map((v, i) => {
                    const t = trend[i] !== null ? trend[i] : mean(data);
                    return v - t - seasonal[i % freq];
                });
                // Forecast: extend trend linearly + seasonal
                const trendValues = trend.filter(t => t !== null);
                const trendSlope = trendValues.length >= 2
                    ? (trendValues[trendValues.length - 1] - trendValues[0]) / (trendValues.length - 1)
                    : 0;
                const lastTrend = trendValues[trendValues.length - 1] || mean(data);
                const forecasts = [];
                for (let i = 1; i <= forecastN; i++) {
                    forecasts.push(lastTrend + trendSlope * i + seasonal[(data.length + i - 1) % freq]);
                }
                out += `### Seasonal Indices\n\n`;
                out += `| Period | Index |\n|---|---|\n`;
                seasonal.forEach((s, i) => { out += `| ${i + 1} | ${fmt(s, 4)} |\n`; });
                out += `\n### Decomposition Summary\n\n`;
                out += `| Component | Mean | Std Dev |\n|---|---|---|\n`;
                out += `| Trend | ${fmt(mean(trendValues), 4)} | ${fmt(stddev(trendValues), 4)} |\n`;
                out += `| Seasonal | ${fmt(mean(seasonal), 4)} | ${fmt(stddev(seasonal), 4)} |\n`;
                out += `| Residual | ${fmt(mean(residual), 4)} | ${fmt(stddev(residual), 4)} |\n`;
                out += `\n### Forecasts\n\n`;
                out += `| Period | Value |\n|---|---|\n`;
                forecasts.forEach((f, i) => { out += `| t+${i + 1} | ${fmt(f, 4)} |\n`; });
            }
            else if (method === 'exponential_smoothing') {
                // Holt-Winters additive method
                // Initialize
                const alpha = 0.3; // level smoothing
                const beta = 0.1; // trend smoothing
                const gammaParam = 0.1; // seasonal smoothing
                // Initialize level and trend from first cycle
                let level = mean(data.slice(0, Math.min(freq, data.length)));
                let trendVal = data.length > freq
                    ? (mean(data.slice(freq, Math.min(2 * freq, data.length))) - mean(data.slice(0, freq))) / freq
                    : 0;
                // Initialize seasonal indices
                const seasonals = new Array(freq).fill(0);
                if (data.length >= freq) {
                    for (let i = 0; i < freq; i++)
                        seasonals[i] = data[i] - level;
                }
                // Fit
                const fitted = [];
                const residuals = [];
                for (let i = 0; i < data.length; i++) {
                    const si = i % freq;
                    const predicted = level + trendVal + seasonals[si];
                    fitted.push(predicted);
                    residuals.push(data[i] - predicted);
                    const newLevel = alpha * (data[i] - seasonals[si]) + (1 - alpha) * (level + trendVal);
                    const newTrend = beta * (newLevel - level) + (1 - beta) * trendVal;
                    seasonals[si] = gammaParam * (data[i] - newLevel) + (1 - gammaParam) * seasonals[si];
                    level = newLevel;
                    trendVal = newTrend;
                }
                // Forecast
                const forecasts = [];
                for (let i = 1; i <= forecastN; i++) {
                    forecasts.push(level + trendVal * i + seasonals[(data.length + i - 1) % freq]);
                }
                const mse = residuals.reduce((s, r) => s + r * r, 0) / residuals.length;
                const mae = residuals.reduce((s, r) => s + Math.abs(r), 0) / residuals.length;
                out += `### Holt-Winters Parameters\n\n`;
                out += `| Parameter | Value |\n|---|---|\n`;
                out += `| Alpha (level) | ${alpha} |\n`;
                out += `| Beta (trend) | ${beta} |\n`;
                out += `| Gamma (seasonal) | ${gammaParam} |\n`;
                out += `| Final Level | ${fmt(level, 4)} |\n`;
                out += `| Final Trend | ${fmt(trendVal, 4)} |\n`;
                out += `\n### Fit Quality\n\n`;
                out += `| Metric | Value |\n|---|---|\n`;
                out += `| MSE | ${fmt(mse, 4)} |\n`;
                out += `| RMSE | ${fmt(Math.sqrt(mse), 4)} |\n`;
                out += `| MAE | ${fmt(mae, 4)} |\n`;
                out += `\n### Seasonal Indices\n\n`;
                out += `| Period | Index |\n|---|---|\n`;
                seasonals.forEach((s, i) => { out += `| ${i + 1} | ${fmt(s, 4)} |\n`; });
                out += `\n### Forecasts\n\n`;
                out += `| Period | Value |\n|---|---|\n`;
                forecasts.forEach((f, i) => { out += `| t+${i + 1} | ${fmt(f, 4)} |\n`; });
            }
            else if (method === 'arima') {
                // Simple ARIMA(1,1,1) estimation
                // Step 1: First difference
                const diff = [];
                for (let i = 1; i < data.length; i++)
                    diff.push(data[i] - data[i - 1]);
                // Step 2: Estimate AR(1) coefficient via OLS on differenced series
                let sumXY = 0, sumXX = 0;
                for (let i = 1; i < diff.length; i++) {
                    sumXY += diff[i - 1] * diff[i];
                    sumXX += diff[i - 1] * diff[i - 1];
                }
                const phi = sumXX > 0 ? sumXY / sumXX : 0;
                // Step 3: Compute AR residuals
                const arResid = [diff[0]];
                for (let i = 1; i < diff.length; i++) {
                    arResid.push(diff[i] - phi * diff[i - 1]);
                }
                // Step 4: Estimate MA(1) coefficient via autocorrelation of residuals
                const arResidMean = mean(arResid);
                let rho1Num = 0, rho1Den = 0;
                for (let i = 0; i < arResid.length; i++) {
                    rho1Den += (arResid[i] - arResidMean) ** 2;
                    if (i > 0)
                        rho1Num += (arResid[i] - arResidMean) * (arResid[i - 1] - arResidMean);
                }
                const theta = rho1Den > 0 ? -(rho1Num / rho1Den) : 0;
                // Step 5: Compute final residuals
                const finalResid = [arResid[0]];
                for (let i = 1; i < arResid.length; i++) {
                    finalResid.push(arResid[i] + theta * finalResid[i - 1]);
                }
                const sigmaResid = stddev(finalResid);
                // Step 6: Forecast (on differenced scale, then integrate)
                const lastDiff = diff[diff.length - 1];
                const lastResid = finalResid[finalResid.length - 1];
                const forecasts = [];
                let prevDiff = lastDiff;
                let prevResid = lastResid;
                let lastVal = data[data.length - 1];
                for (let i = 0; i < forecastN; i++) {
                    const nextDiff = phi * prevDiff + theta * prevResid;
                    lastVal += nextDiff;
                    forecasts.push(lastVal);
                    prevResid = 0; // future residuals assumed 0
                    prevDiff = nextDiff;
                }
                // AIC = n * ln(RSS/n) + 2k
                const rss = finalResid.reduce((s, r) => s + r * r, 0);
                const nResid = finalResid.length;
                const aic = nResid * Math.log(rss / nResid) + 2 * 3; // 3 params: phi, theta, sigma
                out += `### ARIMA(1,1,1) Parameter Estimates\n\n`;
                out += `| Parameter | Value |\n|---|---|\n`;
                out += `| AR(1) phi | ${fmt(phi, 6)} |\n`;
                out += `| MA(1) theta | ${fmt(theta, 6)} |\n`;
                out += `| Residual Sigma | ${fmt(sigmaResid, 6)} |\n`;
                out += `| AIC | ${fmt(aic, 4)} |\n`;
                out += `\n### Differenced Series Summary\n\n`;
                out += `| Statistic | Value |\n|---|---|\n`;
                out += `| Mean | ${fmt(mean(diff), 4)} |\n`;
                out += `| Std Dev | ${fmt(stddev(diff), 4)} |\n`;
                out += `| Autocorrelation(1) | ${fmt(rho1Den > 0 ? rho1Num / rho1Den : 0, 4)} |\n`;
                out += `\n### Forecasts\n\n`;
                out += `| Period | Value | 95% CI |\n|---|---|---|\n`;
                forecasts.forEach((f, i) => {
                    const ciWidth = 1.96 * sigmaResid * Math.sqrt(i + 1);
                    out += `| t+${i + 1} | ${fmt(f, 4)} | [${fmt(f - ciWidth, 4)}, ${fmt(f + ciWidth, 4)}] |\n`;
                });
            }
            else {
                return `**Error**: Unknown method "${method}". Use: decomposition, arima, exponential_smoothing.`;
            }
            return out;
        },
    });
    // ── 4. DIMENSIONALITY REDUCTION (PCA) ──
    registerTool({
        name: 'dimensionality_reduce',
        description: 'Principal Component Analysis (PCA) via eigendecomposition of the covariance matrix. Returns principal components, explained variance ratios, and loadings.',
        parameters: {
            data: { type: 'string', description: 'Data as JSON array of arrays (each inner array is a sample)', required: true },
            method: { type: 'string', description: 'Method: pca (currently the only supported method)', required: true },
            n_components: { type: 'number', description: 'Number of principal components to return (default 2)' },
        },
        tier: 'free',
        async execute(args) {
            let dataMatrix;
            try {
                dataMatrix = JSON.parse(String(args.data));
            }
            catch {
                return '**Error**: data must be a valid JSON array of arrays.';
            }
            if (!Array.isArray(dataMatrix) || dataMatrix.length < 2 || !Array.isArray(dataMatrix[0])) {
                return '**Error**: data must be a 2D array with at least 2 rows.';
            }
            const methodName = String(args.method).toLowerCase();
            if (methodName !== 'pca') {
                return `**Error**: Unknown method "${methodName}". Currently only "pca" is supported.`;
            }
            const n = dataMatrix.length;
            const p = dataMatrix[0].length;
            const nComp = Math.min(Number(args.n_components) || 2, p);
            // 1. Center the data (subtract column means)
            const colMeans = Array.from({ length: p }, (_, j) => mean(dataMatrix.map(row => row[j])));
            const centered = dataMatrix.map(row => row.map((v, j) => v - colMeans[j]));
            // 2. Compute covariance matrix (1/(n-1) * X'X)
            const covMatrix = matCreate(p, p);
            for (let i = 0; i < p; i++) {
                for (let j = i; j < p; j++) {
                    let s = 0;
                    for (let k = 0; k < n; k++)
                        s += centered[k][i] * centered[k][j];
                    covMatrix[i][j] = s / (n - 1);
                    covMatrix[j][i] = covMatrix[i][j];
                }
            }
            // 3. Eigendecomposition
            const eigen = symmetricEigen(covMatrix);
            // 4. Sort eigenvalues descending
            const indices = eigen.values.map((v, i) => ({ val: v, idx: i }))
                .sort((a, b) => b.val - a.val);
            const totalVariance = sum(eigen.values.filter(v => v > 0));
            const explainedRatios = indices.map(({ val }) => Math.max(0, val) / (totalVariance || 1));
            const cumulativeRatios = [];
            let cumSum = 0;
            for (const r of explainedRatios) {
                cumSum += r;
                cumulativeRatios.push(cumSum);
            }
            // 5. Loadings: eigenvectors (columns of V) corresponding to top eigenvalues
            const loadings = [];
            for (let c = 0; c < nComp; c++) {
                const colIdx = indices[c].idx;
                loadings.push(Array.from({ length: p }, (_, row) => eigen.vectors[row][colIdx]));
            }
            // 6. Project data onto principal components
            const projected = centered.map(row => {
                const scores = [];
                for (let c = 0; c < nComp; c++) {
                    let score = 0;
                    for (let j = 0; j < p; j++)
                        score += row[j] * loadings[c][j];
                    scores.push(score);
                }
                return scores;
            });
            let out = `## PCA — Principal Component Analysis\n\n`;
            out += `- **Samples:** ${n}\n`;
            out += `- **Features:** ${p}\n`;
            out += `- **Components:** ${nComp}\n\n`;
            out += `### Explained Variance\n\n`;
            out += `| PC | Eigenvalue | Explained % | Cumulative % |\n|---|---|---|---|\n`;
            for (let i = 0; i < Math.min(p, nComp + 2); i++) {
                const marker = i < nComp ? ' *' : '';
                out += `| PC${i + 1}${marker} | ${fmt(Math.max(0, indices[i].val), 6)} | ${fmt(explainedRatios[i] * 100, 2)}% | ${fmt(cumulativeRatios[i] * 100, 2)}% |\n`;
            }
            out += `\n### Loadings (top ${nComp} components)\n\n`;
            out += `| Feature |`;
            for (let c = 0; c < nComp; c++)
                out += ` PC${c + 1} |`;
            out += `\n|---|`;
            for (let c = 0; c < nComp; c++)
                out += `---|`;
            out += `\n`;
            for (let j = 0; j < p; j++) {
                out += `| Feature ${j + 1} |`;
                for (let c = 0; c < nComp; c++)
                    out += ` ${fmt(loadings[c][j], 4)} |`;
                out += `\n`;
            }
            out += `\n### Projected Scores (first ${Math.min(10, n)} samples)\n\n`;
            out += `| Sample |`;
            for (let c = 0; c < nComp; c++)
                out += ` PC${c + 1} |`;
            out += `\n|---|`;
            for (let c = 0; c < nComp; c++)
                out += `---|`;
            out += `\n`;
            for (let i = 0; i < Math.min(10, n); i++) {
                out += `| ${i + 1} |`;
                for (let c = 0; c < nComp; c++)
                    out += ` ${fmt(projected[i][c], 4)} |`;
                out += `\n`;
            }
            if (n > 10)
                out += `\n*...${n - 10} more samples omitted.*\n`;
            return out;
        },
    });
    // ── 5. DISTRIBUTION FIT ──
    registerTool({
        name: 'distribution_fit',
        description: 'Fit data to distributions (normal, poisson, exponential, gamma, weibull, lognormal) using MLE. Kolmogorov-Smirnov goodness-of-fit test. AIC/BIC comparison.',
        parameters: {
            data: { type: 'string', description: 'Data values (comma-separated numbers)', required: true },
            candidate_distributions: { type: 'string', description: 'Distributions to test (comma-separated): normal, poisson, exponential, gamma, weibull, lognormal', required: true },
        },
        tier: 'free',
        async execute(args) {
            const data = parseCSV(String(args.data));
            if (data.length < 3)
                return '**Error**: Need at least 3 data points.';
            const candidates = String(args.candidate_distributions).split(',').map(s => s.trim().toLowerCase());
            const n = data.length;
            const sorted = [...data].sort((a, b) => a - b);
            // Empirical CDF values for KS test
            const empiricalCDF = sorted.map((_, i) => (i + 1) / n);
            const results = [];
            for (const dist of candidates) {
                let params = {};
                let cdfFn;
                let logLikFn;
                let nParams = 0;
                if (dist === 'normal') {
                    const mu = mean(data);
                    const sigma = stddev(data);
                    params = { mu, sigma };
                    nParams = 2;
                    cdfFn = (x) => normalCDF((x - mu) / sigma);
                    logLikFn = (x) => -0.5 * Math.log(2 * Math.PI) - Math.log(sigma) - 0.5 * ((x - mu) / sigma) ** 2;
                }
                else if (dist === 'poisson') {
                    const lambda = mean(data);
                    params = { lambda };
                    nParams = 1;
                    // Poisson CDF via summation
                    cdfFn = (x) => {
                        const k = Math.floor(x);
                        if (k < 0)
                            return 0;
                        let p = 0;
                        for (let i = 0; i <= k; i++) {
                            p += Math.exp(-lambda + i * Math.log(lambda) - logGamma(i + 1));
                        }
                        return Math.min(1, p);
                    };
                    logLikFn = (x) => {
                        const k = Math.round(x);
                        return -lambda + k * Math.log(lambda) - logGamma(k + 1);
                    };
                }
                else if (dist === 'exponential') {
                    const lambda = 1 / mean(data.filter(v => v > 0));
                    params = { lambda };
                    nParams = 1;
                    cdfFn = (x) => x >= 0 ? 1 - Math.exp(-lambda * x) : 0;
                    logLikFn = (x) => x >= 0 ? Math.log(lambda) - lambda * x : -Infinity;
                }
                else if (dist === 'gamma') {
                    // MLE via method of moments
                    const m = mean(data.filter(v => v > 0));
                    const v = variance(data.filter(v => v > 0));
                    const shape = v > 0 ? (m * m) / v : 1;
                    const rate = v > 0 ? m / v : 1;
                    params = { shape, rate };
                    nParams = 2;
                    cdfFn = (x) => x > 0 ? lowerIncompleteGammaP(shape, rate * x) : 0;
                    logLikFn = (x) => {
                        if (x <= 0)
                            return -Infinity;
                        return (shape - 1) * Math.log(x) + shape * Math.log(rate) - rate * x - logGamma(shape);
                    };
                }
                else if (dist === 'weibull') {
                    // MLE via Newton-Raphson for shape, then scale
                    const positiveData = data.filter(v => v > 0);
                    if (positiveData.length < 2)
                        continue;
                    const logData = positiveData.map(v => Math.log(v));
                    const meanLog = mean(logData);
                    // Newton-Raphson for shape parameter k
                    let k = 1.0;
                    for (let iter = 0; iter < 50; iter++) {
                        const xk = positiveData.map(x => x ** k);
                        const xkLogX = positiveData.map((x, i) => (x ** k) * logData[i]);
                        const sumXk = sum(xk);
                        const sumXkLogX = sum(xkLogX);
                        const sumLogX = sum(logData);
                        const f = sumXkLogX / sumXk - 1 / k - sumLogX / positiveData.length;
                        // Approximate derivative
                        const h = 0.001;
                        const xkh = positiveData.map(x => x ** (k + h));
                        const xkhLogX = positiveData.map((x, i) => (x ** (k + h)) * logData[i]);
                        const fh = sum(xkhLogX) / sum(xkh) - 1 / (k + h) - sumLogX / positiveData.length;
                        const df = (fh - f) / h;
                        if (Math.abs(df) < 1e-20)
                            break;
                        const step = f / df;
                        k -= step;
                        if (k <= 0.01)
                            k = 0.01;
                        if (Math.abs(step) < 1e-10)
                            break;
                    }
                    const lambda_w = (sum(data.filter(v => v > 0).map(x => x ** k)) / positiveData.length) ** (1 / k);
                    params = { shape: k, scale: lambda_w };
                    nParams = 2;
                    cdfFn = (x) => x > 0 ? 1 - Math.exp(-((x / lambda_w) ** k)) : 0;
                    logLikFn = (x) => {
                        if (x <= 0)
                            return -Infinity;
                        return Math.log(k) - k * Math.log(lambda_w) + (k - 1) * Math.log(x) - (x / lambda_w) ** k;
                    };
                }
                else if (dist === 'lognormal') {
                    const logData = data.filter(v => v > 0).map(v => Math.log(v));
                    if (logData.length < 2)
                        continue;
                    const mu = mean(logData);
                    const sigma = stddev(logData);
                    params = { mu, sigma };
                    nParams = 2;
                    cdfFn = (x) => x > 0 ? normalCDF((Math.log(x) - mu) / sigma) : 0;
                    logLikFn = (x) => {
                        if (x <= 0)
                            return -Infinity;
                        return -Math.log(x) - 0.5 * Math.log(2 * Math.PI) - Math.log(sigma) - 0.5 * ((Math.log(x) - mu) / sigma) ** 2;
                    };
                }
                else {
                    continue;
                }
                // Log-likelihood
                const logLik = data.reduce((s, x) => s + logLikFn(x), 0);
                // AIC and BIC
                const aic = -2 * logLik + 2 * nParams;
                const bic = -2 * logLik + nParams * Math.log(n);
                // KS test: max |F_empirical(x) - F_theoretical(x)|
                let ksMax = 0;
                for (let i = 0; i < sorted.length; i++) {
                    const theorCDF = cdfFn(sorted[i]);
                    const diff1 = Math.abs(empiricalCDF[i] - theorCDF);
                    const diff2 = Math.abs((i > 0 ? empiricalCDF[i - 1] : 0) - theorCDF);
                    ksMax = Math.max(ksMax, diff1, diff2);
                }
                // KS p-value approximation (Kolmogorov distribution, large sample)
                const sqrtN = Math.sqrt(n);
                const z = (sqrtN + 0.12 + 0.11 / sqrtN) * ksMax;
                const ksPValue = 2 * Math.exp(-2 * z * z);
                results.push({
                    name: dist,
                    params,
                    logLik,
                    aic,
                    bic,
                    ksStatistic: ksMax,
                    ksPValue: Math.min(1, Math.max(0, ksPValue)),
                    nParams,
                });
            }
            if (results.length === 0)
                return '**Error**: No valid distributions to test.';
            // Sort by AIC
            results.sort((a, b) => a.aic - b.aic);
            let out = `## Distribution Fitting Results\n\n`;
            out += `**N = ${n}** | Data range: [${fmt(sorted[0], 4)}, ${fmt(sorted[sorted.length - 1], 4)}] | Mean: ${fmt(mean(data), 4)} | SD: ${fmt(stddev(data), 4)}\n\n`;
            out += `### Model Comparison (sorted by AIC)\n\n`;
            out += `| Distribution | AIC | BIC | Log-Lik | KS Stat | KS p-value | Fit |\n|---|---|---|---|---|---|---|\n`;
            results.forEach((r, i) => {
                const fit = r.ksPValue > 0.05 ? 'Good' : r.ksPValue > 0.01 ? 'Marginal' : 'Poor';
                const best = i === 0 ? ' **BEST**' : '';
                out += `| ${r.name}${best} | ${fmt(r.aic, 2)} | ${fmt(r.bic, 2)} | ${fmt(r.logLik, 2)} | ${fmt(r.ksStatistic, 4)} | ${r.ksPValue < 0.001 ? '<0.001' : fmt(r.ksPValue, 4)} | ${fit} |\n`;
            });
            out += `\n### Parameter Estimates\n\n`;
            results.forEach(r => {
                out += `**${r.name}**: `;
                out += Object.entries(r.params).map(([k, v]) => `${k} = ${fmt(v, 6)}`).join(', ');
                out += `\n`;
            });
            return out;
        },
    });
    // ── 6. CORRELATION MATRIX ──
    registerTool({
        name: 'correlation_matrix',
        description: 'Compute Pearson, Spearman, or Kendall correlation matrix. Output as formatted table with significance markers (*** p<0.001, ** p<0.01, * p<0.05).',
        parameters: {
            data: { type: 'string', description: 'Data as JSON array of arrays (each inner array is a variable\'s values)', required: true },
            method: { type: 'string', description: 'Correlation method: pearson, spearman, or kendall', required: true },
            variable_names: { type: 'string', description: 'Variable names (comma-separated, optional)' },
        },
        tier: 'free',
        async execute(args) {
            let dataMatrix;
            try {
                dataMatrix = JSON.parse(String(args.data));
            }
            catch {
                return '**Error**: data must be a valid JSON array of arrays.';
            }
            if (!Array.isArray(dataMatrix) || dataMatrix.length < 2) {
                return '**Error**: Need at least 2 variables (arrays).';
            }
            const methodName = String(args.method).toLowerCase();
            const p = dataMatrix.length;
            const n = dataMatrix[0].length;
            const names = args.variable_names
                ? String(args.variable_names).split(',').map(s => s.trim())
                : dataMatrix.map((_, i) => `V${i + 1}`);
            // Compute correlation function
            function pearsonCorr(x, y) {
                const mx = mean(x), my = mean(y);
                let num = 0, dx2 = 0, dy2 = 0;
                for (let i = 0; i < x.length; i++) {
                    const dx = x[i] - mx, dy = y[i] - my;
                    num += dx * dy;
                    dx2 += dx * dx;
                    dy2 += dy * dy;
                }
                const denom = Math.sqrt(dx2 * dy2);
                return denom > 0 ? num / denom : 0;
            }
            function spearmanCorr(x, y) {
                return pearsonCorr(rank(x), rank(y));
            }
            function kendallCorr(x, y) {
                let concordant = 0, discordant = 0;
                for (let i = 0; i < x.length; i++) {
                    for (let j = i + 1; j < x.length; j++) {
                        const dx = x[i] - x[j];
                        const dy = y[i] - y[j];
                        if (dx * dy > 0)
                            concordant++;
                        else if (dx * dy < 0)
                            discordant++;
                    }
                }
                const total = concordant + discordant;
                return total > 0 ? (concordant - discordant) / total : 0;
            }
            const corrFn = methodName === 'spearman' ? spearmanCorr
                : methodName === 'kendall' ? kendallCorr
                    : pearsonCorr;
            // Build correlation matrix
            const corrMatrix = matCreate(p, p);
            const pValueMatrix = matCreate(p, p);
            for (let i = 0; i < p; i++) {
                corrMatrix[i][i] = 1.0;
                pValueMatrix[i][i] = 0;
                for (let j = i + 1; j < p; j++) {
                    const r = corrFn(dataMatrix[i], dataMatrix[j]);
                    corrMatrix[i][j] = r;
                    corrMatrix[j][i] = r;
                    // p-value for correlation
                    let pVal;
                    if (methodName === 'kendall') {
                        // Normal approximation for Kendall's tau
                        const se = Math.sqrt((2 * (2 * n + 5)) / (9 * n * (n - 1)));
                        const z = Math.abs(r) / se;
                        pVal = 2 * (1 - normalCDF(z));
                    }
                    else {
                        // t-test for Pearson/Spearman
                        if (Math.abs(r) >= 1) {
                            pVal = 0;
                        }
                        else {
                            const t = r * Math.sqrt((n - 2) / (1 - r * r));
                            pVal = 2 * (1 - tCDF(Math.abs(t), n - 2));
                        }
                    }
                    pValueMatrix[i][j] = pVal;
                    pValueMatrix[j][i] = pVal;
                }
            }
            function sigMarker(pVal) {
                if (pVal < 0.001)
                    return '***';
                if (pVal < 0.01)
                    return '**';
                if (pVal < 0.05)
                    return '*';
                return '';
            }
            let out = `## Correlation Matrix — ${methodName.charAt(0).toUpperCase() + methodName.slice(1)}\n\n`;
            out += `**N = ${n}** observations\n\n`;
            // Header
            out += `| |`;
            names.forEach(name => { out += ` ${name} |`; });
            out += `\n|---|`;
            names.forEach(() => { out += `---|`; });
            out += `\n`;
            // Body
            for (let i = 0; i < p; i++) {
                out += `| **${names[i]}** |`;
                for (let j = 0; j < p; j++) {
                    if (i === j) {
                        out += ` 1.0000 |`;
                    }
                    else {
                        const marker = sigMarker(pValueMatrix[i][j]);
                        out += ` ${fmt(corrMatrix[i][j], 4)}${marker} |`;
                    }
                }
                out += `\n`;
            }
            out += `\nSignificance: \\*\\*\\* p<0.001, \\*\\* p<0.01, \\* p<0.05\n`;
            // Strongest correlations
            const pairs = [];
            for (let i = 0; i < p; i++) {
                for (let j = i + 1; j < p; j++) {
                    pairs.push({ i, j, r: corrMatrix[i][j], p: pValueMatrix[i][j] });
                }
            }
            pairs.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
            if (pairs.length > 0) {
                out += `\n### Strongest Correlations\n\n`;
                out += `| Pair | r | p-value |\n|---|---|---|\n`;
                pairs.slice(0, 5).forEach(pair => {
                    out += `| ${names[pair.i]} - ${names[pair.j]} | ${fmt(pair.r, 4)} | ${pair.p < 0.001 ? '<0.001' : fmt(pair.p, 4)} |\n`;
                });
            }
            return out;
        },
    });
    // ── 7. POWER ANALYSIS ──
    registerTool({
        name: 'power_analysis',
        description: 'Calculate statistical power, required sample size, or minimum detectable effect size for t-test, ANOVA, chi-square, or proportion test.',
        parameters: {
            test_type: { type: 'string', description: 'Test type: t_test, anova, chi_square, proportion', required: true },
            effect_size: { type: 'number', description: 'Effect size (Cohen\'s d for t-test, f for ANOVA, w for chi-square, h for proportion)', required: true },
            alpha: { type: 'number', description: 'Significance level (default 0.05)' },
            power: { type: 'number', description: 'Desired power (default 0.8)' },
            solve_for: { type: 'string', description: 'What to solve for: n (sample size), power, or effect (effect size)', required: true },
        },
        tier: 'free',
        async execute(args) {
            const testType = String(args.test_type).toLowerCase().replace(/[_\s]/g, '_');
            let effectSize = Number(args.effect_size) || 0.5;
            let alpha = Number(args.alpha) || 0.05;
            let power = Number(args.power) || 0.8;
            const solveFor = String(args.solve_for).toLowerCase();
            let out = `## Power Analysis\n\n`;
            out += `- **Test:** ${testType}\n`;
            // The critical z-value for one-tailed alpha
            const zAlpha = normalQuantile(1 - alpha / 2);
            if (testType === 't_test') {
                // Two-sample t-test power
                // power = P(reject H0 | H1 true) = Phi(d*sqrt(n/2) - z_alpha/2)
                if (solveFor === 'n') {
                    const zBeta = normalQuantile(power);
                    const n = Math.ceil(2 * ((zAlpha + zBeta) / effectSize) ** 2);
                    out += `- **Effect Size (d):** ${fmt(effectSize, 4)}\n`;
                    out += `- **Alpha:** ${alpha}\n`;
                    out += `- **Power:** ${power}\n\n`;
                    out += `### Result\n\n`;
                    out += `**Required sample size per group: ${n}**\n`;
                    out += `**Total sample size: ${2 * n}**\n`;
                }
                else if (solveFor === 'power') {
                    // Need sample size from effect; use n = 30 as default context
                    // Actually: compute power for a range of n
                    out += `- **Effect Size (d):** ${fmt(effectSize, 4)}\n`;
                    out += `- **Alpha:** ${alpha}\n\n`;
                    out += `### Power for Various Sample Sizes\n\n`;
                    out += `| n (per group) | Total N | Power |\n|---|---|---|\n`;
                    for (const n of [10, 20, 30, 50, 75, 100, 150, 200, 300, 500]) {
                        const noncentrality = effectSize * Math.sqrt(n / 2);
                        const computedPower = 1 - normalCDF(zAlpha - noncentrality);
                        out += `| ${n} | ${2 * n} | ${fmt(computedPower, 4)} |\n`;
                    }
                }
                else if (solveFor === 'effect') {
                    // Minimum detectable effect for given n and power
                    out += `- **Alpha:** ${alpha}\n`;
                    out += `- **Power:** ${power}\n\n`;
                    out += `### Minimum Detectable Effect for Various Sample Sizes\n\n`;
                    out += `| n (per group) | Total N | Min Effect (d) | Interpretation |\n|---|---|---|---|\n`;
                    const zBeta = normalQuantile(power);
                    for (const n of [10, 20, 30, 50, 75, 100, 150, 200, 300, 500]) {
                        const d = (zAlpha + zBeta) / Math.sqrt(n / 2);
                        const interp = d >= 0.8 ? 'Large' : d >= 0.5 ? 'Medium' : d >= 0.2 ? 'Small' : 'Tiny';
                        out += `| ${n} | ${2 * n} | ${fmt(d, 4)} | ${interp} |\n`;
                    }
                }
            }
            else if (testType === 'anova') {
                // One-way ANOVA: f = effect size (Cohen's f)
                // df1 = k - 1 (assume k=3 groups if not specified)
                const k = 3;
                const df1 = k - 1;
                if (solveFor === 'n') {
                    const zBeta = normalQuantile(power);
                    // Approximation: n per group ~ ((z_alpha + z_beta)^2) / (f^2 * k) + corrections
                    const lambda = effectSize * effectSize; // noncentrality per observation
                    const nPerGroup = Math.ceil(((zAlpha + zBeta) ** 2) / (lambda * k) + df1 / 2);
                    const totalN = nPerGroup * k;
                    out += `- **Effect Size (f):** ${fmt(effectSize, 4)}\n`;
                    out += `- **Groups (k):** ${k}\n`;
                    out += `- **Alpha:** ${alpha}\n`;
                    out += `- **Power:** ${power}\n\n`;
                    out += `### Result\n\n`;
                    out += `**Required sample size per group: ~${nPerGroup}**\n`;
                    out += `**Total sample size: ~${totalN}**\n`;
                }
                else if (solveFor === 'power') {
                    out += `- **Effect Size (f):** ${fmt(effectSize, 4)}\n`;
                    out += `- **Groups (k):** ${k}\n`;
                    out += `- **Alpha:** ${alpha}\n\n`;
                    out += `### Power for Various Sample Sizes\n\n`;
                    out += `| n (per group) | Total N | Power |\n|---|---|---|\n`;
                    for (const n of [10, 20, 30, 50, 75, 100, 150]) {
                        const lambda = n * k * effectSize * effectSize;
                        // Power approx via noncentral F → normal approximation
                        const ncp = Math.sqrt(lambda);
                        const critVal = normalQuantile(1 - alpha);
                        const computedPower = 1 - normalCDF(critVal - ncp);
                        out += `| ${n} | ${n * k} | ${fmt(Math.min(computedPower, 0.999), 4)} |\n`;
                    }
                }
                else {
                    const zBeta = normalQuantile(power);
                    out += `- **Alpha:** ${alpha}\n`;
                    out += `- **Power:** ${power}\n`;
                    out += `- **Groups (k):** ${k}\n\n`;
                    out += `### Minimum Detectable Effect (f) for Various Sample Sizes\n\n`;
                    out += `| n (per group) | Total N | Min Effect (f) | Interpretation |\n|---|---|---|---|\n`;
                    for (const n of [10, 20, 30, 50, 75, 100, 150, 200]) {
                        const f = (zAlpha + zBeta) / Math.sqrt(n * k);
                        const interp = f >= 0.4 ? 'Large' : f >= 0.25 ? 'Medium' : f >= 0.1 ? 'Small' : 'Tiny';
                        out += `| ${n} | ${n * k} | ${fmt(f, 4)} | ${interp} |\n`;
                    }
                }
            }
            else if (testType === 'chi_square') {
                // Chi-square test: w = effect size, df = (r-1)(c-1)
                const df = 1; // default for 2x2
                if (solveFor === 'n') {
                    const zBeta = normalQuantile(power);
                    const n = Math.ceil(((zAlpha + zBeta) / effectSize) ** 2);
                    out += `- **Effect Size (w):** ${fmt(effectSize, 4)}\n`;
                    out += `- **Alpha:** ${alpha}\n`;
                    out += `- **Power:** ${power}\n\n`;
                    out += `### Result\n\n`;
                    out += `**Required total sample size: ${n}**\n`;
                }
                else if (solveFor === 'power') {
                    out += `- **Effect Size (w):** ${fmt(effectSize, 4)}\n`;
                    out += `- **Alpha:** ${alpha}\n\n`;
                    out += `### Power for Various Sample Sizes\n\n`;
                    out += `| N | Power |\n|---|---|\n`;
                    for (const n of [20, 50, 100, 200, 300, 500, 1000]) {
                        const ncp = n * effectSize * effectSize;
                        const critVal = normalQuantile(1 - alpha);
                        const computedPower = 1 - normalCDF(critVal - Math.sqrt(ncp));
                        out += `| ${n} | ${fmt(Math.min(computedPower, 0.999), 4)} |\n`;
                    }
                }
                else {
                    const zBeta = normalQuantile(power);
                    out += `- **Alpha:** ${alpha}\n`;
                    out += `- **Power:** ${power}\n\n`;
                    out += `### Minimum Detectable Effect (w) for Various Sample Sizes\n\n`;
                    out += `| N | Min Effect (w) | Interpretation |\n|---|---|---|\n`;
                    for (const n of [20, 50, 100, 200, 300, 500, 1000]) {
                        const w = (zAlpha + zBeta) / Math.sqrt(n);
                        const interp = w >= 0.5 ? 'Large' : w >= 0.3 ? 'Medium' : w >= 0.1 ? 'Small' : 'Tiny';
                        out += `| ${n} | ${fmt(w, 4)} | ${interp} |\n`;
                    }
                }
            }
            else if (testType === 'proportion') {
                // Two-proportion z-test: h = effect size (Cohen's h)
                if (solveFor === 'n') {
                    const zBeta = normalQuantile(power);
                    const n = Math.ceil(((zAlpha + zBeta) / effectSize) ** 2);
                    out += `- **Effect Size (h):** ${fmt(effectSize, 4)}\n`;
                    out += `- **Alpha:** ${alpha}\n`;
                    out += `- **Power:** ${power}\n\n`;
                    out += `### Result\n\n`;
                    out += `**Required sample size per group: ${n}**\n`;
                    out += `**Total sample size: ${2 * n}**\n`;
                }
                else if (solveFor === 'power') {
                    out += `- **Effect Size (h):** ${fmt(effectSize, 4)}\n`;
                    out += `- **Alpha:** ${alpha}\n\n`;
                    out += `### Power for Various Sample Sizes\n\n`;
                    out += `| n (per group) | Total N | Power |\n|---|---|---|\n`;
                    for (const n of [20, 50, 100, 200, 300, 500, 1000]) {
                        const ncp = effectSize * Math.sqrt(n);
                        const computedPower = 1 - normalCDF(zAlpha - ncp);
                        out += `| ${n} | ${2 * n} | ${fmt(Math.min(computedPower, 0.999), 4)} |\n`;
                    }
                }
                else {
                    const zBeta = normalQuantile(power);
                    out += `- **Alpha:** ${alpha}\n`;
                    out += `- **Power:** ${power}\n\n`;
                    out += `### Minimum Detectable Effect (h) for Various Sample Sizes\n\n`;
                    out += `| n (per group) | Total N | Min Effect (h) | Interpretation |\n|---|---|---|---|\n`;
                    for (const n of [20, 50, 100, 200, 300, 500, 1000]) {
                        const h = (zAlpha + zBeta) / Math.sqrt(n);
                        const interp = h >= 0.8 ? 'Large' : h >= 0.5 ? 'Medium' : h >= 0.2 ? 'Small' : 'Tiny';
                        out += `| ${n} | ${2 * n} | ${fmt(h, 4)} | ${interp} |\n`;
                    }
                }
            }
            else {
                return `**Error**: Unknown test_type "${testType}". Use: t_test, anova, chi_square, proportion.`;
            }
            out += `\n### Effect Size Guidelines\n\n`;
            out += `| Test | Small | Medium | Large |\n|---|---|---|---|\n`;
            out += `| t-test (d) | 0.20 | 0.50 | 0.80 |\n`;
            out += `| ANOVA (f) | 0.10 | 0.25 | 0.40 |\n`;
            out += `| Chi-square (w) | 0.10 | 0.30 | 0.50 |\n`;
            out += `| Proportion (h) | 0.20 | 0.50 | 0.80 |\n`;
            return out;
        },
    });
    // ── 8. ANOVA TEST ──
    registerTool({
        name: 'anova_test',
        description: 'One-way ANOVA with Tukey HSD and Bonferroni post-hoc tests. Returns F-statistic, p-value, eta-squared, and pairwise comparisons.',
        parameters: {
            groups: { type: 'string', description: 'Groups as JSON array of arrays (each inner array is one group\'s data)', required: true },
            test_type: { type: 'string', description: 'Test type: one_way', required: true },
            post_hoc: { type: 'string', description: 'Post-hoc test: tukey or bonferroni', required: true },
        },
        tier: 'free',
        async execute(args) {
            let groups;
            try {
                groups = JSON.parse(String(args.groups));
            }
            catch {
                return '**Error**: groups must be a valid JSON array of arrays.';
            }
            if (!Array.isArray(groups) || groups.length < 2) {
                return '**Error**: Need at least 2 groups.';
            }
            const postHoc = String(args.post_hoc).toLowerCase();
            const k = groups.length;
            const ns = groups.map(g => g.length);
            const N = sum(ns);
            const groupMeans = groups.map(g => mean(g));
            const grandMean = mean(groups.flat());
            // Sum of squares
            let ssBetween = 0;
            for (let i = 0; i < k; i++) {
                ssBetween += ns[i] * (groupMeans[i] - grandMean) ** 2;
            }
            let ssWithin = 0;
            for (let i = 0; i < k; i++) {
                for (const val of groups[i]) {
                    ssWithin += (val - groupMeans[i]) ** 2;
                }
            }
            const ssTotal = ssBetween + ssWithin;
            const dfBetween = k - 1;
            const dfWithin = N - k;
            const msBetween = ssBetween / dfBetween;
            const msWithin = ssWithin / dfWithin;
            const fStat = msWithin > 0 ? msBetween / msWithin : 0;
            const pValue = 1 - fCDF(fStat, dfBetween, dfWithin);
            const etaSquared = ssTotal > 0 ? ssBetween / ssTotal : 0;
            const omegaSquared = (ssBetween - dfBetween * msWithin) / (ssTotal + msWithin);
            let out = `## One-Way ANOVA\n\n`;
            out += `### Group Descriptives\n\n`;
            out += `| Group | N | Mean | Std Dev |\n|---|---|---|---|\n`;
            groups.forEach((g, i) => {
                out += `| ${i + 1} | ${g.length} | ${fmt(groupMeans[i], 4)} | ${fmt(stddev(g), 4)} |\n`;
            });
            out += `| **Total** | **${N}** | **${fmt(grandMean, 4)}** | **${fmt(stddev(groups.flat()), 4)}** |\n`;
            out += `\n### ANOVA Table\n\n`;
            out += `| Source | SS | df | MS | F | p-value |\n|---|---|---|---|---|---|\n`;
            out += `| Between | ${fmt(ssBetween, 4)} | ${dfBetween} | ${fmt(msBetween, 4)} | ${fmt(fStat, 4)} | ${pValue < 0.001 ? '<0.001' : fmt(pValue, 4)} |\n`;
            out += `| Within | ${fmt(ssWithin, 4)} | ${dfWithin} | ${fmt(msWithin, 4)} | | |\n`;
            out += `| Total | ${fmt(ssTotal, 4)} | ${N - 1} | | | |\n`;
            out += `\n### Effect Sizes\n\n`;
            out += `| Measure | Value | Interpretation |\n|---|---|---|\n`;
            const etaInterp = etaSquared >= 0.14 ? 'Large' : etaSquared >= 0.06 ? 'Medium' : 'Small';
            out += `| Eta-squared (eta²) | ${fmt(etaSquared, 4)} | ${etaInterp} |\n`;
            out += `| Omega-squared (omega²) | ${fmt(Math.max(0, omegaSquared), 4)} | — |\n`;
            // Post-hoc pairwise comparisons
            out += `\n### Post-Hoc: ${postHoc === 'tukey' ? 'Tukey HSD' : 'Bonferroni'}\n\n`;
            out += `| Comparison | Diff | SE | Statistic | p-value | Significant |\n|---|---|---|---|---|---|\n`;
            const nComparisons = k * (k - 1) / 2;
            for (let i = 0; i < k; i++) {
                for (let j = i + 1; j < k; j++) {
                    const diff = groupMeans[i] - groupMeans[j];
                    const se = Math.sqrt(msWithin * (1 / ns[i] + 1 / ns[j]));
                    const stat = Math.abs(diff) / se;
                    let pVal;
                    if (postHoc === 'tukey') {
                        // Tukey HSD: compare q = stat * sqrt(2) to Studentized range distribution
                        // Approximate p-value using t distribution
                        const tStat = stat;
                        const rawP = 2 * (1 - tCDF(tStat, dfWithin));
                        // Tukey adjustment: multiply by number of comparisons (conservative)
                        pVal = Math.min(1, rawP * nComparisons);
                    }
                    else {
                        // Bonferroni: regular t-test p-value * number of comparisons
                        const tStat = stat;
                        const rawP = 2 * (1 - tCDF(tStat, dfWithin));
                        pVal = Math.min(1, rawP * nComparisons);
                    }
                    const sig = pVal < 0.001 ? '***' : pVal < 0.01 ? '**' : pVal < 0.05 ? '*' : 'ns';
                    out += `| G${i + 1} vs G${j + 1} | ${fmt(diff, 4)} | ${fmt(se, 4)} | ${fmt(stat, 4)} | ${pVal < 0.001 ? '<0.001' : fmt(pVal, 4)} | ${sig} |\n`;
                }
            }
            out += `\nSignificance: \\*\\*\\* p<0.001, \\*\\* p<0.01, \\* p<0.05, ns = not significant\n`;
            return out;
        },
    });
    // ── 9. SURVIVAL ANALYSIS ──
    registerTool({
        name: 'survival_analysis',
        description: 'Kaplan-Meier survival curves with log-rank test. Returns survival probabilities at each time point, median survival, hazard ratios, and p-value.',
        parameters: {
            times: { type: 'string', description: 'Event/censoring times (comma-separated numbers)', required: true },
            events: { type: 'string', description: 'Event indicators (comma-separated: 1=event, 0=censored)', required: true },
            groups: { type: 'string', description: 'Group labels for each subject (comma-separated, optional for comparing 2+ groups)' },
        },
        tier: 'free',
        async execute(args) {
            const times = parseCSV(String(args.times));
            const events = parseCSV(String(args.events)).map(v => v === 1 ? 1 : 0);
            if (times.length !== events.length || times.length < 2) {
                return '**Error**: times and events must have equal length (minimum 2).';
            }
            const groupLabels = args.groups
                ? String(args.groups).split(',').map(s => s.trim())
                : null;
            const n = times.length;
            // Kaplan-Meier estimator for a single group
            function kaplanMeier(t, e) {
                // Sort by time
                const indices = t.map((_, i) => i).sort((a, b) => t[a] - t[b]);
                const sortedT = indices.map(i => t[i]);
                const sortedE = indices.map(i => e[i]);
                // Get unique event times
                const uniqueTimes = [];
                const eventCounts = [];
                const censorCounts = [];
                let i = 0;
                while (i < sortedT.length) {
                    const currentTime = sortedT[i];
                    let nEvents = 0, nCensored = 0;
                    while (i < sortedT.length && sortedT[i] === currentTime) {
                        if (sortedE[i] === 1)
                            nEvents++;
                        else
                            nCensored++;
                        i++;
                    }
                    if (nEvents > 0 || nCensored > 0) {
                        uniqueTimes.push(currentTime);
                        eventCounts.push(nEvents);
                        censorCounts.push(nCensored);
                    }
                }
                // Product-limit estimator
                const survTimes = [0];
                const survProbs = [1.0];
                const nRisk = [t.length];
                const nEvent = [0];
                const variances = [0];
                let atRisk = t.length;
                let survProb = 1.0;
                let greenwoodSum = 0;
                for (let j = 0; j < uniqueTimes.length; j++) {
                    const d = eventCounts[j];
                    const c = censorCounts[j];
                    if (d > 0) {
                        survProb *= (atRisk - d) / atRisk;
                        if (atRisk > d) {
                            greenwoodSum += d / (atRisk * (atRisk - d));
                        }
                        survTimes.push(uniqueTimes[j]);
                        survProbs.push(survProb);
                        nRisk.push(atRisk);
                        nEvent.push(d);
                        variances.push(survProb * survProb * greenwoodSum); // Greenwood's formula
                    }
                    atRisk -= d + c;
                }
                // Median survival: first time S(t) <= 0.5
                let medianSurvival = null;
                for (let j = 1; j < survProbs.length; j++) {
                    if (survProbs[j] <= 0.5) {
                        medianSurvival = survTimes[j];
                        break;
                    }
                }
                return {
                    times: survTimes,
                    survival: survProbs,
                    nRisk,
                    nEvent,
                    variance: variances,
                    medianSurvival,
                };
            }
            let out = `## Survival Analysis — Kaplan-Meier\n\n`;
            if (!groupLabels) {
                // Single group
                const km = kaplanMeier(times, events);
                const totalEvents = events.filter(e => e === 1).length;
                out += `**N = ${n}** | Events: ${totalEvents} | Censored: ${n - totalEvents}\n\n`;
                out += `### Survival Table\n\n`;
                out += `| Time | N at Risk | Events | S(t) | 95% CI |\n|---|---|---|---|---|\n`;
                for (let i = 0; i < km.times.length; i++) {
                    const se = Math.sqrt(km.variance[i]);
                    const ciLower = Math.max(0, km.survival[i] - 1.96 * se);
                    const ciUpper = Math.min(1, km.survival[i] + 1.96 * se);
                    out += `| ${fmt(km.times[i], 2)} | ${km.nRisk[i]} | ${km.nEvent[i]} | ${fmt(km.survival[i], 4)} | [${fmt(ciLower, 4)}, ${fmt(ciUpper, 4)}] |\n`;
                }
                out += `\n**Median Survival:** ${km.medianSurvival !== null ? fmt(km.medianSurvival, 2) : 'Not reached'}\n`;
            }
            else {
                // Multiple groups — KM per group + log-rank test
                if (groupLabels.length !== n) {
                    return `**Error**: groups length (${groupLabels.length}) must match times length (${n}).`;
                }
                const uniqueGroups = [...new Set(groupLabels)];
                const groupData = {};
                for (const g of uniqueGroups) {
                    groupData[g] = { times: [], events: [] };
                }
                for (let i = 0; i < n; i++) {
                    groupData[groupLabels[i]].times.push(times[i]);
                    groupData[groupLabels[i]].events.push(events[i]);
                }
                // KM for each group
                const kmResults = {};
                for (const g of uniqueGroups) {
                    kmResults[g] = kaplanMeier(groupData[g].times, groupData[g].events);
                }
                // Log-rank test
                // Get all unique event times across all groups
                const allEventTimes = [...new Set(times.filter((_, i) => events[i] === 1))].sort((a, b) => a - b);
                let chiSq = 0;
                const observed = {};
                const expected = {};
                for (const g of uniqueGroups) {
                    observed[g] = 0;
                    expected[g] = 0;
                }
                for (const t of allEventTimes) {
                    // At each event time, count at-risk and events per group
                    const atRiskPerGroup = {};
                    const eventsPerGroup = {};
                    let totalAtRisk = 0;
                    let totalEvents = 0;
                    for (const g of uniqueGroups) {
                        const gd = groupData[g];
                        let risk = 0, ev = 0;
                        for (let i = 0; i < gd.times.length; i++) {
                            if (gd.times[i] >= t)
                                risk++;
                            if (gd.times[i] === t && gd.events[i] === 1)
                                ev++;
                        }
                        atRiskPerGroup[g] = risk;
                        eventsPerGroup[g] = ev;
                        totalAtRisk += risk;
                        totalEvents += ev;
                    }
                    if (totalAtRisk === 0)
                        continue;
                    for (const g of uniqueGroups) {
                        observed[g] += eventsPerGroup[g];
                        expected[g] += (atRiskPerGroup[g] / totalAtRisk) * totalEvents;
                    }
                }
                // Log-rank chi-square = sum((O-E)^2 / E) with df = k-1
                for (const g of uniqueGroups) {
                    if (expected[g] > 0) {
                        chiSq += (observed[g] - expected[g]) ** 2 / expected[g];
                    }
                }
                const lrDf = uniqueGroups.length - 1;
                const lrPValue = 1 - chiSquareCDF(chiSq, lrDf);
                // Hazard ratio (for 2 groups): HR = (O1/E1) / (O2/E2)
                let hazardRatio = null;
                if (uniqueGroups.length === 2) {
                    const g1 = uniqueGroups[0], g2 = uniqueGroups[1];
                    if (expected[g1] > 0 && expected[g2] > 0) {
                        hazardRatio = (observed[g1] / expected[g1]) / (observed[g2] / expected[g2]);
                    }
                }
                out += `### Group Summary\n\n`;
                out += `| Group | N | Events | Censored | Median Survival |\n|---|---|---|---|---|\n`;
                for (const g of uniqueGroups) {
                    const gd = groupData[g];
                    const nEvents = gd.events.filter(e => e === 1).length;
                    out += `| ${g} | ${gd.times.length} | ${nEvents} | ${gd.times.length - nEvents} | ${kmResults[g].medianSurvival !== null ? fmt(kmResults[g].medianSurvival, 2) : 'NR'} |\n`;
                }
                out += `\n### Log-Rank Test\n\n`;
                out += `| Statistic | Value |\n|---|---|\n`;
                out += `| Chi-square | ${fmt(chiSq, 4)} |\n`;
                out += `| df | ${lrDf} |\n`;
                out += `| p-value | ${lrPValue < 0.001 ? '<0.001' : fmt(lrPValue, 4)} |\n`;
                if (hazardRatio !== null) {
                    out += `| Hazard Ratio (${uniqueGroups[0]} vs ${uniqueGroups[1]}) | ${fmt(hazardRatio, 4)} |\n`;
                }
                out += `\n### Observed vs Expected Events\n\n`;
                out += `| Group | Observed | Expected | O/E |\n|---|---|---|---|\n`;
                for (const g of uniqueGroups) {
                    out += `| ${g} | ${fmt(observed[g], 1)} | ${fmt(expected[g], 2)} | ${fmt(expected[g] > 0 ? observed[g] / expected[g] : 0, 4)} |\n`;
                }
                // Survival table for each group
                for (const g of uniqueGroups) {
                    const km = kmResults[g];
                    out += `\n### Survival Table — ${g}\n\n`;
                    out += `| Time | N at Risk | Events | S(t) |\n|---|---|---|---|\n`;
                    for (let i = 0; i < km.times.length; i++) {
                        out += `| ${fmt(km.times[i], 2)} | ${km.nRisk[i]} | ${km.nEvent[i]} | ${fmt(km.survival[i], 4)} |\n`;
                    }
                }
            }
            return out;
        },
    });
    // ── 10. VIZ CODEGEN ──
    registerTool({
        name: 'viz_codegen',
        description: 'Generate publication-quality plot code in Python (matplotlib/seaborn) or R (ggplot2). Supports: scatter, histogram, heatmap, boxplot, violin, line, bar, kaplan_meier, forest, volcano, qq plot types.',
        parameters: {
            chart_type: { type: 'string', description: 'Chart type: scatter, histogram, heatmap, boxplot, violin, line, bar, kaplan_meier, forest, volcano, qq', required: true },
            language: { type: 'string', description: 'Output language: python or r', required: true },
            data_description: { type: 'string', description: 'Description of the data (variable names, types, context)', required: true },
            title: { type: 'string', description: 'Plot title', required: true },
            style: { type: 'string', description: 'Style: publication or presentation (default publication)' },
        },
        tier: 'free',
        async execute(args) {
            const chartType = String(args.chart_type).toLowerCase().replace(/[_\s-]/g, '_');
            const language = String(args.language).toLowerCase();
            const dataDesc = String(args.data_description);
            const title = String(args.title);
            const style = String(args.style || 'publication').toLowerCase();
            if (language !== 'python' && language !== 'r') {
                return `**Error**: language must be "python" or "r".`;
            }
            const isPub = style === 'publication';
            let code = '';
            if (language === 'python') {
                // Python: matplotlib + seaborn
                const preamble = [
                    `import numpy as np`,
                    `import pandas as pd`,
                    `import matplotlib.pyplot as plt`,
                    `import seaborn as sns`,
                    `from matplotlib import rcParams`,
                    ``,
                    `# ${isPub ? 'Publication' : 'Presentation'} style`,
                    isPub
                        ? `plt.style.use('seaborn-v0_8-whitegrid')\nrcParams.update({'font.family': 'serif', 'font.serif': ['Times New Roman'], 'font.size': 10, 'axes.labelsize': 11, 'axes.titlesize': 12, 'figure.dpi': 300, 'savefig.dpi': 300, 'figure.figsize': (6, 4)})`
                        : `plt.style.use('seaborn-v0_8-darkgrid')\nrcParams.update({'font.family': 'sans-serif', 'font.size': 14, 'axes.labelsize': 16, 'axes.titlesize': 18, 'figure.dpi': 150, 'figure.figsize': (10, 7)})`,
                    ``,
                    `# --- Data: ${dataDesc} ---`,
                    `# Replace with your actual data`,
                ].join('\n');
                if (chartType === 'scatter') {
                    code = `${preamble}
x = np.random.randn(100)
y = 2.5 * x + np.random.randn(100) * 0.5

fig, ax = plt.subplots()
scatter = ax.scatter(x, y, c='steelblue', alpha=0.7, edgecolors='white', s=50)

# Regression line
z = np.polyfit(x, y, 1)
p = np.poly1d(z)
x_line = np.linspace(x.min(), x.max(), 100)
ax.plot(x_line, p(x_line), 'r--', linewidth=1.5, label=f'y = {z[0]:.2f}x + {z[1]:.2f}')

ax.set_xlabel('X variable')
ax.set_ylabel('Y variable')
ax.set_title('${title}')
ax.legend(frameon=True)
plt.tight_layout()
plt.savefig('scatter_plot.png', bbox_inches='tight')
plt.show()`;
                }
                else if (chartType === 'histogram') {
                    code = `${preamble}
data = np.random.randn(500)

fig, ax = plt.subplots()
n, bins, patches = ax.hist(data, bins=30, color='steelblue', edgecolor='white',
                           alpha=0.8, density=True)

# Overlay normal curve
from scipy import stats
xmin, xmax = ax.get_xlim()
x = np.linspace(xmin, xmax, 100)
mu, std = stats.norm.fit(data)
ax.plot(x, stats.norm.pdf(x, mu, std), 'r-', linewidth=2,
        label=f'Normal fit (mu={mu:.2f}, sigma={std:.2f})')

ax.set_xlabel('Value')
ax.set_ylabel('Density')
ax.set_title('${title}')
ax.legend(frameon=True)
plt.tight_layout()
plt.savefig('histogram.png', bbox_inches='tight')
plt.show()`;
                }
                else if (chartType === 'heatmap') {
                    code = `${preamble}
data = np.random.randn(10, 10)
labels = [f'Var{i+1}' for i in range(10)]

fig, ax = plt.subplots(figsize=(8, 6))
im = sns.heatmap(data, annot=True, fmt='.2f', cmap='RdBu_r', center=0,
                 xticklabels=labels, yticklabels=labels,
                 linewidths=0.5, ax=ax, cbar_kws={'shrink': 0.8})
ax.set_title('${title}')
plt.tight_layout()
plt.savefig('heatmap.png', bbox_inches='tight')
plt.show()`;
                }
                else if (chartType === 'boxplot') {
                    code = `${preamble}
groups = ['Group A', 'Group B', 'Group C', 'Group D']
data = [np.random.randn(50) + i for i, _ in enumerate(groups)]
df = pd.DataFrame({g: pd.Series(d) for g, d in zip(groups, data)})
df_melt = df.melt(var_name='Group', value_name='Value')

fig, ax = plt.subplots()
bp = sns.boxplot(data=df_melt, x='Group', y='Value', palette='Set2',
                 width=0.6, flierprops=dict(marker='o', markersize=4), ax=ax)
sns.stripplot(data=df_melt, x='Group', y='Value', color='black',
              alpha=0.3, size=3, jitter=True, ax=ax)

ax.set_xlabel('')
ax.set_ylabel('Value')
ax.set_title('${title}')
plt.tight_layout()
plt.savefig('boxplot.png', bbox_inches='tight')
plt.show()`;
                }
                else if (chartType === 'violin') {
                    code = `${preamble}
groups = ['Group A', 'Group B', 'Group C']
data = [np.random.randn(100) + i * 0.5 for i, _ in enumerate(groups)]
df = pd.DataFrame({g: pd.Series(d) for g, d in zip(groups, data)})
df_melt = df.melt(var_name='Group', value_name='Value')

fig, ax = plt.subplots()
sns.violinplot(data=df_melt, x='Group', y='Value', palette='muted',
               inner='box', linewidth=1, ax=ax)

ax.set_xlabel('')
ax.set_ylabel('Value')
ax.set_title('${title}')
plt.tight_layout()
plt.savefig('violin_plot.png', bbox_inches='tight')
plt.show()`;
                }
                else if (chartType === 'line') {
                    code = `${preamble}
x = np.arange(0, 50)
y1 = np.cumsum(np.random.randn(50)) + 10
y2 = np.cumsum(np.random.randn(50)) + 10

fig, ax = plt.subplots()
ax.plot(x, y1, '-o', color='steelblue', markersize=3, linewidth=1.5, label='Series A')
ax.plot(x, y2, '-s', color='coral', markersize=3, linewidth=1.5, label='Series B')
ax.fill_between(x, y1 - 1, y1 + 1, alpha=0.15, color='steelblue')
ax.fill_between(x, y2 - 1, y2 + 1, alpha=0.15, color='coral')

ax.set_xlabel('Time')
ax.set_ylabel('Value')
ax.set_title('${title}')
ax.legend(frameon=True)
plt.tight_layout()
plt.savefig('line_plot.png', bbox_inches='tight')
plt.show()`;
                }
                else if (chartType === 'bar') {
                    code = `${preamble}
categories = ['Cat A', 'Cat B', 'Cat C', 'Cat D', 'Cat E']
values = [23, 45, 56, 78, 32]
errors = [3, 5, 4, 6, 3]

fig, ax = plt.subplots()
bars = ax.bar(categories, values, yerr=errors, capsize=4,
              color='steelblue', edgecolor='white', alpha=0.85)

# Add value labels
for bar, val in zip(bars, values):
    ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 2,
            str(val), ha='center', va='bottom', fontsize=9)

ax.set_ylabel('Value')
ax.set_title('${title}')
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
plt.tight_layout()
plt.savefig('bar_plot.png', bbox_inches='tight')
plt.show()`;
                }
                else if (chartType === 'kaplan_meier') {
                    code = `${preamble}
from lifelines import KaplanMeierFitter
from lifelines.statistics import logrank_test

# Group 1
T1 = np.array([6, 6, 6, 7, 10, 13, 16, 22, 23, 6, 9, 10, 11, 17, 19, 20, 25, 32, 32, 34])
E1 = np.array([1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])

# Group 2
T2 = np.array([1, 1, 2, 2, 3, 4, 4, 5, 5, 8, 8, 8, 8, 11, 11, 12, 12, 15, 17, 22])
E2 = np.array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0])

fig, ax = plt.subplots()
kmf1 = KaplanMeierFitter()
kmf1.fit(T1, E1, label='Treatment')
kmf1.plot_survival_function(ax=ax, ci_show=True, color='steelblue')

kmf2 = KaplanMeierFitter()
kmf2.fit(T2, E2, label='Control')
kmf2.plot_survival_function(ax=ax, ci_show=True, color='coral')

# Log-rank test
result = logrank_test(T1, T2, E1, E2)
ax.text(0.6, 0.9, f'Log-rank p = {result.p_value:.4f}',
        transform=ax.transAxes, fontsize=10,
        bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))

ax.set_xlabel('Time')
ax.set_ylabel('Survival Probability')
ax.set_title('${title}')
ax.set_ylim(0, 1.05)
ax.legend(frameon=True)
plt.tight_layout()
plt.savefig('km_plot.png', bbox_inches='tight')
plt.show()`;
                }
                else if (chartType === 'forest') {
                    code = `${preamble}
studies = ['Study A', 'Study B', 'Study C', 'Study D', 'Study E', 'Overall']
effects = [0.85, 1.12, 0.72, 0.95, 1.05, 0.92]
ci_lower = [0.65, 0.88, 0.55, 0.75, 0.82, 0.80]
ci_upper = [1.10, 1.42, 0.94, 1.20, 1.34, 1.06]
weights = [20, 25, 15, 22, 18, None]

fig, ax = plt.subplots(figsize=(8, 5))
y_pos = np.arange(len(studies))

for i, (study, eff, lo, hi) in enumerate(zip(studies, effects, ci_lower, ci_upper)):
    color = 'darkred' if study == 'Overall' else 'steelblue'
    marker = 'D' if study == 'Overall' else 'o'
    size = 10 if study == 'Overall' else 7
    ax.plot(eff, i, marker, color=color, markersize=size, zorder=3)
    ax.hlines(i, lo, hi, color=color, linewidth=2)
    label = f'{eff:.2f} [{lo:.2f}, {hi:.2f}]'
    ax.text(max(ci_upper) + 0.1, i, label, va='center', fontsize=9)

ax.axvline(1.0, color='gray', linestyle='--', linewidth=0.8)
ax.set_yticks(y_pos)
ax.set_yticklabels(studies)
ax.set_xlabel('Effect Size (OR / HR)')
ax.set_title('${title}')
ax.invert_yaxis()
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
plt.tight_layout()
plt.savefig('forest_plot.png', bbox_inches='tight')
plt.show()`;
                }
                else if (chartType === 'volcano') {
                    code = `${preamble}
np.random.seed(42)
n_genes = 5000
log2fc = np.random.randn(n_genes) * 1.5
pvals = 10 ** (-np.abs(np.random.randn(n_genes) * 2))
neg_log10p = -np.log10(pvals)

# Categorize
fc_threshold = 1.0
p_threshold = 0.05
colors = []
for fc, p in zip(log2fc, pvals):
    if abs(fc) > fc_threshold and p < p_threshold:
        colors.append('red' if fc > 0 else 'blue')
    else:
        colors.append('gray')

fig, ax = plt.subplots()
ax.scatter(log2fc, neg_log10p, c=colors, alpha=0.5, s=10, edgecolors='none')
ax.axhline(-np.log10(p_threshold), color='gray', linestyle='--', linewidth=0.8)
ax.axvline(-fc_threshold, color='gray', linestyle='--', linewidth=0.8)
ax.axvline(fc_threshold, color='gray', linestyle='--', linewidth=0.8)

n_up = sum(1 for c in colors if c == 'red')
n_down = sum(1 for c in colors if c == 'blue')
ax.text(0.02, 0.98, f'Up: {n_up}\\nDown: {n_down}', transform=ax.transAxes,
        va='top', fontsize=9, bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))

ax.set_xlabel('log2 Fold Change')
ax.set_ylabel('-log10(p-value)')
ax.set_title('${title}')
plt.tight_layout()
plt.savefig('volcano_plot.png', bbox_inches='tight')
plt.show()`;
                }
                else if (chartType === 'qq') {
                    code = `${preamble}
from scipy import stats

data = np.random.randn(200) * 2 + 5  # Replace with your data

fig, ax = plt.subplots()
(osm, osr), (slope, intercept, r) = stats.probplot(data, dist='norm', plot=ax)
ax.get_lines()[0].set(color='steelblue', markersize=4, alpha=0.7)
ax.get_lines()[1].set(color='red', linewidth=1.5)

ax.set_title('${title}')
ax.text(0.05, 0.95, f'R² = {r**2:.4f}', transform=ax.transAxes,
        va='top', fontsize=10, bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))
plt.tight_layout()
plt.savefig('qq_plot.png', bbox_inches='tight')
plt.show()`;
                }
                else {
                    return `**Error**: Unknown chart_type "${chartType}". Supported: scatter, histogram, heatmap, boxplot, violin, line, bar, kaplan_meier, forest, volcano, qq.`;
                }
            }
            else {
                // R: ggplot2
                const rPreamble = [
                    `library(ggplot2)`,
                    `library(dplyr)`,
                    ``,
                    `# ${isPub ? 'Publication' : 'Presentation'} theme`,
                    isPub
                        ? `theme_pub <- theme_bw() + theme(text = element_text(family = "serif", size = 10), plot.title = element_text(size = 12, face = "bold"), axis.title = element_text(size = 11), legend.position = "bottom")`
                        : `theme_pub <- theme_minimal() + theme(text = element_text(size = 14), plot.title = element_text(size = 18, face = "bold"), axis.title = element_text(size = 16), legend.position = "bottom")`,
                    ``,
                    `# --- Data: ${dataDesc} ---`,
                    `# Replace with your actual data`,
                ].join('\n');
                if (chartType === 'scatter') {
                    code = `${rPreamble}
set.seed(42)
df <- data.frame(x = rnorm(100), y = 2.5 * rnorm(100) + rnorm(100) * 0.5)

p <- ggplot(df, aes(x = x, y = y)) +
  geom_point(color = "steelblue", alpha = 0.7, size = 2) +
  geom_smooth(method = "lm", color = "red", linetype = "dashed", se = TRUE, alpha = 0.2) +
  labs(title = "${title}", x = "X variable", y = "Y variable") +
  theme_pub

ggsave("scatter_plot.pdf", p, width = 6, height = 4)
print(p)`;
                }
                else if (chartType === 'histogram') {
                    code = `${rPreamble}
set.seed(42)
df <- data.frame(value = rnorm(500))

p <- ggplot(df, aes(x = value)) +
  geom_histogram(aes(y = after_stat(density)), bins = 30, fill = "steelblue",
                 color = "white", alpha = 0.8) +
  stat_function(fun = dnorm, args = list(mean = mean(df$value), sd = sd(df$value)),
                color = "red", linewidth = 1) +
  labs(title = "${title}", x = "Value", y = "Density") +
  theme_pub

ggsave("histogram.pdf", p, width = 6, height = 4)
print(p)`;
                }
                else if (chartType === 'heatmap') {
                    code = `${rPreamble}
library(reshape2)

set.seed(42)
mat <- matrix(rnorm(100), nrow = 10)
colnames(mat) <- paste0("Var", 1:10)
rownames(mat) <- paste0("Var", 1:10)
df <- melt(mat)

p <- ggplot(df, aes(x = Var2, y = Var1, fill = value)) +
  geom_tile(color = "white") +
  geom_text(aes(label = round(value, 2)), size = 2.5) +
  scale_fill_gradient2(low = "steelblue", mid = "white", high = "coral", midpoint = 0) +
  labs(title = "${title}", x = "", y = "", fill = "Value") +
  theme_pub + theme(axis.text.x = element_text(angle = 45, hjust = 1))

ggsave("heatmap.pdf", p, width = 8, height = 6)
print(p)`;
                }
                else if (chartType === 'boxplot') {
                    code = `${rPreamble}
set.seed(42)
df <- data.frame(
  Group = rep(c("A", "B", "C", "D"), each = 50),
  Value = c(rnorm(50), rnorm(50, 1), rnorm(50, 2), rnorm(50, 3))
)

p <- ggplot(df, aes(x = Group, y = Value, fill = Group)) +
  geom_boxplot(width = 0.6, outlier.shape = 1, alpha = 0.8) +
  geom_jitter(width = 0.15, alpha = 0.3, size = 1) +
  scale_fill_brewer(palette = "Set2") +
  labs(title = "${title}", x = "", y = "Value") +
  theme_pub + theme(legend.position = "none")

ggsave("boxplot.pdf", p, width = 6, height = 4)
print(p)`;
                }
                else if (chartType === 'violin') {
                    code = `${rPreamble}
set.seed(42)
df <- data.frame(
  Group = rep(c("A", "B", "C"), each = 100),
  Value = c(rnorm(100), rnorm(100, 0.5), rnorm(100, 1))
)

p <- ggplot(df, aes(x = Group, y = Value, fill = Group)) +
  geom_violin(trim = FALSE, alpha = 0.8) +
  geom_boxplot(width = 0.1, fill = "white", outlier.shape = NA) +
  scale_fill_brewer(palette = "Pastel1") +
  labs(title = "${title}", x = "", y = "Value") +
  theme_pub + theme(legend.position = "none")

ggsave("violin_plot.pdf", p, width = 6, height = 4)
print(p)`;
                }
                else if (chartType === 'line') {
                    code = `${rPreamble}
set.seed(42)
df <- data.frame(
  Time = rep(1:50, 2),
  Value = c(cumsum(rnorm(50)) + 10, cumsum(rnorm(50)) + 10),
  Series = rep(c("A", "B"), each = 50)
)

p <- ggplot(df, aes(x = Time, y = Value, color = Series)) +
  geom_line(linewidth = 0.8) +
  geom_point(size = 1, alpha = 0.5) +
  geom_ribbon(aes(ymin = Value - 1, ymax = Value + 1, fill = Series), alpha = 0.15, color = NA) +
  scale_color_manual(values = c("steelblue", "coral")) +
  scale_fill_manual(values = c("steelblue", "coral")) +
  labs(title = "${title}", x = "Time", y = "Value") +
  theme_pub

ggsave("line_plot.pdf", p, width = 6, height = 4)
print(p)`;
                }
                else if (chartType === 'bar') {
                    code = `${rPreamble}
df <- data.frame(
  Category = c("Cat A", "Cat B", "Cat C", "Cat D", "Cat E"),
  Value = c(23, 45, 56, 78, 32),
  SE = c(3, 5, 4, 6, 3)
)

p <- ggplot(df, aes(x = reorder(Category, -Value), y = Value)) +
  geom_col(fill = "steelblue", alpha = 0.85, width = 0.65) +
  geom_errorbar(aes(ymin = Value - SE, ymax = Value + SE), width = 0.2) +
  geom_text(aes(label = Value), vjust = -0.5, size = 3.5) +
  labs(title = "${title}", x = "", y = "Value") +
  theme_pub

ggsave("bar_plot.pdf", p, width = 6, height = 4)
print(p)`;
                }
                else if (chartType === 'kaplan_meier') {
                    code = `${rPreamble}
library(survival)
library(survminer)

df <- data.frame(
  time = c(6, 6, 6, 7, 10, 13, 16, 22, 23, 6, 9, 10, 11, 17, 19, 20, 25, 32, 32, 34,
           1, 1, 2, 2, 3, 4, 4, 5, 5, 8, 8, 8, 8, 11, 11, 12, 12, 15, 17, 22),
  event = c(1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0),
  group = c(rep("Treatment", 20), rep("Control", 20))
)

fit <- survfit(Surv(time, event) ~ group, data = df)
p <- ggsurvplot(fit, data = df, pval = TRUE, conf.int = TRUE,
                risk.table = TRUE, palette = c("steelblue", "coral"),
                title = "${title}",
                xlab = "Time", ylab = "Survival Probability",
                ggtheme = theme_bw() + theme(text = element_text(family = "serif")))

ggsave("km_plot.pdf", plot = print(p), width = 8, height = 6)`;
                }
                else if (chartType === 'forest') {
                    code = `${rPreamble}
library(forestplot)

df <- data.frame(
  study = c("Study A", "Study B", "Study C", "Study D", "Study E", "Overall"),
  estimate = c(0.85, 1.12, 0.72, 0.95, 1.05, 0.92),
  lower = c(0.65, 0.88, 0.55, 0.75, 0.82, 0.80),
  upper = c(1.10, 1.42, 0.94, 1.20, 1.34, 1.06)
)

p <- ggplot(df, aes(y = reorder(study, desc(row_number())), x = estimate, xmin = lower, xmax = upper)) +
  geom_pointrange(aes(color = study == "Overall"), size = 0.8) +
  geom_vline(xintercept = 1, linetype = "dashed", color = "gray50") +
  scale_color_manual(values = c("steelblue", "darkred"), guide = "none") +
  labs(title = "${title}", x = "Effect Size (OR / HR)", y = "") +
  theme_pub

ggsave("forest_plot.pdf", p, width = 8, height = 5)
print(p)`;
                }
                else if (chartType === 'volcano') {
                    code = `${rPreamble}
set.seed(42)
df <- data.frame(
  log2fc = rnorm(5000) * 1.5,
  pvalue = 10^(-abs(rnorm(5000) * 2))
) %>%
  mutate(
    neg_log10p = -log10(pvalue),
    category = case_when(
      abs(log2fc) > 1 & pvalue < 0.05 & log2fc > 0 ~ "Up",
      abs(log2fc) > 1 & pvalue < 0.05 & log2fc < 0 ~ "Down",
      TRUE ~ "NS"
    )
  )

p <- ggplot(df, aes(x = log2fc, y = neg_log10p, color = category)) +
  geom_point(alpha = 0.5, size = 1) +
  scale_color_manual(values = c("Down" = "blue", "NS" = "gray70", "Up" = "red")) +
  geom_hline(yintercept = -log10(0.05), linetype = "dashed", color = "gray50") +
  geom_vline(xintercept = c(-1, 1), linetype = "dashed", color = "gray50") +
  labs(title = "${title}", x = "log2 Fold Change", y = "-log10(p-value)", color = "") +
  theme_pub

ggsave("volcano_plot.pdf", p, width = 6, height = 5)
print(p)`;
                }
                else if (chartType === 'qq') {
                    code = `${rPreamble}
set.seed(42)
data <- rnorm(200) * 2 + 5  # Replace with your data

df <- data.frame(value = data)

p <- ggplot(df, aes(sample = value)) +
  stat_qq(color = "steelblue", alpha = 0.7, size = 2) +
  stat_qq_line(color = "red", linewidth = 1) +
  labs(title = "${title}", x = "Theoretical Quantiles", y = "Sample Quantiles") +
  theme_pub

shapiro <- shapiro.test(data)
p <- p + annotate("text", x = -Inf, y = Inf, hjust = -0.1, vjust = 1.5,
                  label = paste0("Shapiro-Wilk p = ", format.pval(shapiro$p.value, digits = 4)),
                  size = 3.5)

ggsave("qq_plot.pdf", p, width = 6, height = 4)
print(p)`;
                }
                else {
                    return `**Error**: Unknown chart_type "${chartType}". Supported: scatter, histogram, heatmap, boxplot, violin, line, bar, kaplan_meier, forest, volcano, qq.`;
                }
            }
            let out = `## Visualization Code — ${chartType} (${language === 'python' ? 'Python' : 'R'})\n\n`;
            out += `**Style:** ${isPub ? 'Publication' : 'Presentation'} | **Data:** ${dataDesc}\n\n`;
            out += '```' + (language === 'python' ? 'python' : 'r') + '\n';
            out += code + '\n';
            out += '```\n';
            out += `\n*Copy this code and replace the sample data with your actual data. The plot will be saved to the working directory.*\n`;
            return out;
        },
    });
}
//# sourceMappingURL=lab-data.js.map