// kbot Lab Social Sciences Tools
// Psychology, Sociology, Economics, and Political Science
// 12 tools: psychometric scales, effect sizes, social networks, game theory,
// econometrics, inequality, survey design, demographics, sentiment analysis,
// voting systems, behavioral experiment design, discourse analysis.
// All self-contained — no external dependencies.
import { registerTool } from './index.js';
// ─── Math Helpers ────────────────────────────────────────────────────────────
function mean(arr) {
    if (arr.length === 0)
        return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
}
function variance(arr, ddof = 1) {
    if (arr.length <= ddof)
        return 0;
    const m = mean(arr);
    return arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - ddof);
}
function stddev(arr, ddof = 1) {
    return Math.sqrt(variance(arr, ddof));
}
function covariance(a, b, ddof = 1) {
    const n = Math.min(a.length, b.length);
    if (n <= ddof)
        return 0;
    const ma = mean(a), mb = mean(b);
    let s = 0;
    for (let i = 0; i < n; i++)
        s += (a[i] - ma) * (b[i] - mb);
    return s / (n - ddof);
}
function correlation(a, b) {
    const sa = stddev(a), sb = stddev(b);
    if (sa === 0 || sb === 0)
        return 0;
    return covariance(a, b) / (sa * sb);
}
function sum(arr) {
    return arr.reduce((s, v) => s + v, 0);
}
function median(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function percentile(arr, p) {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    if (lo === hi)
        return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}
function parseNumbers(s) {
    return s.split(',').map(x => x.trim()).filter(x => x !== '').map(Number).filter(x => !isNaN(x));
}
function fmt(n, digits = 4) {
    return Number(n.toFixed(digits)).toString();
}
/** Normal CDF approximation (Abramowitz & Stegun) */
function normalCdf(z) {
    if (z < -8)
        return 0;
    if (z > 8)
        return 1;
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = z < 0 ? -1 : 1;
    const x = Math.abs(z) / Math.SQRT2;
    const t = 1 / (1 + p * x);
    const erf = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1 + sign * erf);
}
/** Inverse normal CDF (Beasley-Springer-Moro approximation) */
function normalInv(p) {
    if (p <= 0)
        return -Infinity;
    if (p >= 1)
        return Infinity;
    if (p === 0.5)
        return 0;
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
    const pLow = 0.02425, pHigh = 1 - pLow;
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
        return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
}
/** Gamma function via Lanczos approximation */
function gammaLn(z) {
    const g = 7;
    const coeff = [
        0.99999999999980993, 676.5203681218851, -1259.1392167224028,
        771.32342877765313, -176.61502916214059, 12.507343278686905,
        -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
    ];
    if (z < 0.5) {
        return Math.log(Math.PI / Math.sin(Math.PI * z)) - gammaLn(1 - z);
    }
    z -= 1;
    let x = coeff[0];
    for (let i = 1; i < g + 2; i++)
        x += coeff[i] / (z + i);
    const t = z + g + 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
/** Regularized incomplete beta function I_x(a, b) via continued fraction */
function betaIncomplete(x, a, b) {
    if (x <= 0)
        return 0;
    if (x >= 1)
        return 1;
    if (a <= 0 || b <= 0)
        return 0;
    if (x > (a + 1) / (a + b + 2)) {
        return 1 - betaIncomplete(1 - x, b, a);
    }
    const lnBeta = gammaLn(a) + gammaLn(b) - gammaLn(a + b);
    const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;
    const maxIter = 200;
    const eps = 1e-14;
    let f = 1, cf = 1, d = 0;
    for (let m = 0; m <= maxIter; m++) {
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
        d = 1 + numerator * d;
        if (Math.abs(d) < 1e-30)
            d = 1e-30;
        d = 1 / d;
        cf = 1 + numerator / cf;
        if (Math.abs(cf) < 1e-30)
            cf = 1e-30;
        const delta = cf * d;
        f *= delta;
        if (Math.abs(delta - 1) < eps)
            break;
    }
    return front * (f - 1);
}
/** Student's t-distribution CDF */
function tCdf(t, df) {
    const x = df / (df + t * t);
    const p = 0.5 * betaIncomplete(x, df / 2, 0.5);
    return t >= 0 ? 1 - p : p;
}
/** Regularized lower incomplete gamma P(a, x) — series */
function gammaPLower(a, x) {
    if (x <= 0)
        return 0;
    let s = 1 / a, term = 1 / a;
    for (let n = 1; n < 200; n++) {
        term *= x / (a + n);
        s += term;
        if (Math.abs(term) < Math.abs(s) * 1e-14)
            break;
    }
    return s * Math.exp(-x + a * Math.log(x) - gammaLn(a));
}
/** Chi-square CDF */
function chiSquareCdf(x, k) {
    if (x <= 0)
        return 0;
    return gammaPLower(k / 2, x / 2);
}
/** F-distribution CDF via incomplete beta */
function fCdf(x, d1, d2) {
    if (x <= 0)
        return 0;
    const v = d1 * x / (d1 * x + d2);
    return betaIncomplete(v, d1 / 2, d2 / 2);
}
/** Matrix operations (small matrices for econometrics) */
function matMul(A, B) {
    const m = A.length, n = B[0].length, p = B.length;
    const C = Array.from({ length: m }, () => new Array(n).fill(0));
    for (let i = 0; i < m; i++)
        for (let j = 0; j < n; j++)
            for (let k = 0; k < p; k++)
                C[i][j] += A[i][k] * B[k][j];
    return C;
}
function matTranspose(A) {
    const m = A.length, n = A[0].length;
    const T = Array.from({ length: n }, () => new Array(m).fill(0));
    for (let i = 0; i < m; i++)
        for (let j = 0; j < n; j++)
            T[j][i] = A[i][j];
    return T;
}
/** Invert a square matrix via Gauss-Jordan elimination */
function matInverse(M) {
    const n = M.length;
    // Augmented matrix [M | I]
    const aug = M.map((row, i) => {
        const r = [...row];
        for (let j = 0; j < n; j++)
            r.push(i === j ? 1 : 0);
        return r;
    });
    for (let col = 0; col < n; col++) {
        // Partial pivoting
        let maxRow = col;
        for (let row = col + 1; row < n; row++) {
            if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col]))
                maxRow = row;
        }
        [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
        if (Math.abs(aug[col][col]) < 1e-12)
            return null; // Singular
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
/** Multiply matrix by vector */
function matVecMul(A, v) {
    return A.map(row => row.reduce((s, val, j) => s + val * v[j], 0));
}
/** Diagonal of a matrix */
function matDiag(A) {
    return A.map((row, i) => row[i]);
}
// ─── Sentiment Lexicon (VADER-like, ~500 words) ────────────────────────────
const SENTIMENT_LEXICON = {
    // Strong positive (2.0 - 3.5)
    'excellent': 3.2, 'amazing': 3.1, 'wonderful': 3.1, 'fantastic': 3.1, 'outstanding': 3.2,
    'superb': 3.0, 'brilliant': 3.0, 'magnificent': 3.0, 'exceptional': 3.0, 'extraordinary': 3.0,
    'perfect': 3.0, 'love': 2.9, 'adore': 2.8, 'beautiful': 2.7, 'gorgeous': 2.7,
    'awesome': 2.8, 'incredible': 2.8, 'terrific': 2.7, 'fabulous': 2.7, 'spectacular': 2.7,
    'marvelous': 2.7, 'phenomenal': 2.8, 'glorious': 2.6, 'sublime': 2.6, 'delightful': 2.6,
    'thrilling': 2.5, 'ecstatic': 2.8, 'elated': 2.6, 'overjoyed': 2.7, 'blissful': 2.6,
    'heavenly': 2.5, 'triumphant': 2.5, 'victorious': 2.4, 'exquisite': 2.5, 'stunning': 2.5,
    // Moderate positive (1.0 - 1.9)
    'good': 1.9, 'great': 2.0, 'nice': 1.6, 'happy': 2.2, 'glad': 1.8,
    'pleased': 1.8, 'enjoy': 1.8, 'enjoyed': 1.8, 'like': 1.5, 'liked': 1.5,
    'helpful': 1.7, 'useful': 1.5, 'pleasant': 1.7, 'cheerful': 1.8, 'kind': 1.7,
    'warm': 1.3, 'gentle': 1.3, 'friendly': 1.7, 'positive': 1.5, 'fortunate': 1.6,
    'lucky': 1.6, 'proud': 1.8, 'confident': 1.6, 'hopeful': 1.5, 'grateful': 1.8,
    'thankful': 1.8, 'appreciate': 1.7, 'impressive': 1.8, 'remarkable': 1.7, 'effective': 1.4,
    'successful': 1.8, 'win': 1.7, 'winning': 1.7, 'best': 2.0, 'better': 1.3,
    'improve': 1.2, 'improved': 1.3, 'benefit': 1.4, 'comfortable': 1.4, 'safe': 1.2,
    'strong': 1.2, 'healthy': 1.4, 'smart': 1.5, 'clever': 1.5, 'creative': 1.4,
    'innovative': 1.4, 'elegant': 1.5, 'charming': 1.5, 'exciting': 1.8, 'fun': 1.7,
    'laugh': 1.6, 'laughed': 1.6, 'smile': 1.5, 'smiled': 1.5, 'joy': 2.2,
    'joyful': 2.2, 'celebrate': 1.7, 'celebration': 1.7, 'accomplish': 1.5, 'accomplished': 1.6,
    'achieve': 1.5, 'achieved': 1.6, 'reward': 1.5, 'rewarding': 1.6, 'satisfy': 1.5,
    'satisfied': 1.5, 'satisfying': 1.5, 'worthy': 1.3, 'valuable': 1.4, 'recommend': 1.5,
    'recommended': 1.5, 'trust': 1.5, 'trusted': 1.5, 'reliable': 1.4, 'smooth': 1.2,
    'bright': 1.2, 'clean': 1.0, 'clear': 1.0, 'easy': 1.2, 'simple': 1.0,
    'calm': 1.2, 'peaceful': 1.5, 'serene': 1.5, 'relaxed': 1.3, 'refreshing': 1.4,
    'vibrant': 1.3, 'lively': 1.4, 'energetic': 1.3, 'enthusiastic': 1.6, 'passionate': 1.5,
    'generous': 1.6, 'compassionate': 1.6, 'caring': 1.5, 'supportive': 1.5, 'loyal': 1.5,
    'honest': 1.4, 'sincere': 1.4, 'genuine': 1.3, 'authentic': 1.2, 'admire': 1.6,
    'respect': 1.4, 'respected': 1.5, 'welcome': 1.3, 'uplifting': 1.6,
    // Mild positive (0.3 - 0.9)
    'ok': 0.5, 'okay': 0.5, 'fine': 0.5, 'decent': 0.7, 'fair': 0.5,
    'adequate': 0.4, 'reasonable': 0.5, 'acceptable': 0.5, 'agree': 0.6, 'agreed': 0.6,
    'correct': 0.5, 'right': 0.3, 'interest': 0.6, 'interested': 0.7, 'interesting': 0.8,
    'curious': 0.5, 'possible': 0.3, 'available': 0.3, 'ready': 0.4, 'willing': 0.5,
    // Mild negative (-0.3 - -0.9)
    'boring': -0.8, 'bored': -0.7, 'dull': -0.7, 'mediocre': -0.6, 'ordinary': -0.3,
    'average': -0.3, 'plain': -0.3, 'lack': -0.5, 'lacking': -0.6, 'miss': -0.4,
    'missing': -0.5, 'slow': -0.4, 'late': -0.4, 'delay': -0.5, 'delayed': -0.5,
    'confuse': -0.5, 'confused': -0.6, 'confusing': -0.6, 'unclear': -0.5, 'doubt': -0.6,
    'doubtful': -0.6, 'uncertain': -0.5, 'unsure': -0.4, 'awkward': -0.6, 'clumsy': -0.6,
    'odd': -0.3, 'strange': -0.4, 'weird': -0.5, 'difficult': -0.5, 'hard': -0.3,
    'complex': -0.3, 'complicated': -0.5, 'tough': -0.4, 'struggle': -0.6, 'problem': -0.6,
    // Moderate negative (-1.0 - -1.9)
    'bad': -1.9, 'poor': -1.6, 'wrong': -1.3, 'fail': -1.7, 'failed': -1.8,
    'failure': -1.8, 'lose': -1.5, 'lost': -1.3, 'losing': -1.5, 'sad': -1.8,
    'unhappy': -1.7, 'upset': -1.6, 'angry': -1.8, 'annoyed': -1.4, 'annoying': -1.5,
    'frustrate': -1.5, 'frustrated': -1.6, 'frustrating': -1.6, 'disappoint': -1.6,
    'disappointed': -1.7, 'disappointing': -1.7, 'regret': -1.5, 'regretful': -1.5,
    'sorry': -1.0, 'worry': -1.3, 'worried': -1.4, 'anxious': -1.4, 'nervous': -1.2,
    'fear': -1.6, 'afraid': -1.5, 'scared': -1.5, 'frighten': -1.6, 'frightened': -1.6,
    'stress': -1.3, 'stressed': -1.4, 'stressful': -1.5, 'pain': -1.6, 'painful': -1.7,
    'hurt': -1.5, 'suffer': -1.7, 'suffering': -1.8, 'sick': -1.3, 'ill': -1.2,
    'weak': -1.2, 'ugly': -1.7, 'useless': -1.7, 'waste': -1.5, 'wasted': -1.6,
    'damage': -1.5, 'damaged': -1.6, 'break': -1.0, 'broken': -1.4, 'ruin': -1.7,
    'ruined': -1.8, 'destroy': -1.8, 'destroyed': -1.9, 'corrupt': -1.7, 'guilty': -1.5,
    'shame': -1.6, 'ashamed': -1.6, 'embarrass': -1.4, 'embarrassed': -1.5,
    'embarrassing': -1.5, 'reject': -1.5, 'rejected': -1.7, 'lonely': -1.5,
    'alone': -1.0, 'abandon': -1.6, 'abandoned': -1.7, 'neglect': -1.4, 'neglected': -1.5,
    'ignore': -1.2, 'ignored': -1.4, 'betray': -1.8, 'betrayed': -1.9, 'cheat': -1.7,
    'lie': -1.5, 'lied': -1.7, 'dishonest': -1.6, 'unfair': -1.5, 'unjust': -1.5,
    'cruel': -1.9, 'mean': -1.3, 'selfish': -1.5, 'greedy': -1.5, 'arrogant': -1.5,
    'rude': -1.6, 'hostile': -1.7, 'aggressive': -1.4, 'violent': -1.8, 'threat': -1.5,
    'threaten': -1.6, 'dangerous': -1.4, 'risk': -1.0, 'risky': -1.0,
    // Strong negative (-2.0 - -3.5)
    'terrible': -2.7, 'horrible': -2.7, 'awful': -2.6, 'dreadful': -2.5, 'hideous': -2.5,
    'disgusting': -2.8, 'revolting': -2.6, 'repulsive': -2.6, 'vile': -2.7, 'loathe': -2.8,
    'hate': -2.7, 'hatred': -2.8, 'despise': -2.7, 'detest': -2.7, 'abhor': -2.8,
    'horrific': -2.8, 'horrifying': -2.8, 'atrocious': -2.9, 'appalling': -2.7,
    'nightmare': -2.5, 'catastrophe': -2.8, 'catastrophic': -2.9, 'disaster': -2.6,
    'disastrous': -2.7, 'devastate': -2.7, 'devastating': -2.8, 'miserable': -2.5,
    'agony': -2.6, 'anguish': -2.5, 'torment': -2.6, 'torture': -2.8, 'death': -2.2,
    'die': -2.0, 'kill': -2.5, 'murder': -2.9, 'evil': -2.7, 'wicked': -2.3,
    'toxic': -2.3, 'poison': -2.2, 'worst': -2.8, 'worthless': -2.5, 'pathetic': -2.3,
    'hopeless': -2.3, 'helpless': -2.1, 'desperate': -2.0, 'despair': -2.4,
    'tragic': -2.4, 'tragedy': -2.5, 'grief': -2.3, 'mourn': -2.1, 'sob': -1.8,
    'cry': -1.5, 'scream': -1.6, 'panic': -1.8, 'terror': -2.5, 'terrify': -2.5,
    'terrified': -2.5, 'terrifying': -2.6, 'horrified': -2.5, 'furious': -2.4,
    'outrage': -2.3, 'outraged': -2.4, 'outrageous': -2.3, 'rage': -2.3,
    'abuse': -2.5, 'abusive': -2.6, 'exploit': -1.8, 'exploited': -2.0,
};
/** Degree modifiers that amplify or dampen sentiment */
const DEGREE_MODIFIERS = {
    'very': 1.3, 'really': 1.3, 'extremely': 1.5, 'incredibly': 1.5,
    'absolutely': 1.4, 'totally': 1.3, 'completely': 1.3, 'utterly': 1.4,
    'deeply': 1.3, 'highly': 1.3, 'truly': 1.2, 'particularly': 1.2,
    'especially': 1.3, 'remarkably': 1.3, 'exceptionally': 1.4,
    'slightly': 0.6, 'somewhat': 0.7, 'rather': 0.8, 'fairly': 0.8,
    'quite': 1.1, 'a little': 0.6, 'a bit': 0.6, 'sort of': 0.6,
    'kind of': 0.6, 'barely': 0.4, 'hardly': 0.4, 'scarcely': 0.4,
    'almost': 0.8, 'nearly': 0.8,
};
/** Negation words that flip sentiment */
const NEGATION_WORDS = new Set([
    'not', "n't", 'no', 'never', 'neither', 'nor', 'none', 'nobody',
    'nothing', 'nowhere', 'hardly', 'barely', 'scarcely', 'without',
    "doesn't", "don't", "didn't", "isn't", "aren't", "wasn't", "weren't",
    "hasn't", "haven't", "hadn't", "won't", "wouldn't", "couldn't",
    "shouldn't", "mustn't", "cannot", "can't",
]);
// ─── Registration ────────────────────────────────────────────────────────────
export function registerLabSocialTools() {
    // ── 1. Psychometric Scale ──────────────────────────────────────────────
    registerTool({
        name: 'psychometric_scale',
        description: 'Score and analyze psychometric instruments. Computes scale scores, Cronbach\'s alpha reliability, item-total correlations, inter-item correlations, and factor structure hints. Supports Likert scales, Big Five, PHQ-9, GAD-7, and custom instruments. Takes raw participant x item response matrices.',
        parameters: {
            responses: { type: 'string', description: 'JSON array of arrays — participants x items, e.g. [[5,4,3,2],[4,5,3,1]]', required: true },
            scale_name: { type: 'string', description: 'Scale type: likert, big5, phq9, gad7, or custom', required: true },
            reverse_items: { type: 'string', description: 'Comma-separated 0-indexed item indices to reverse score (optional)' },
        },
        tier: 'free',
        async execute(args) {
            const data = JSON.parse(String(args.responses));
            const scaleName = String(args.scale_name).toLowerCase().trim();
            const reverseIndices = args.reverse_items
                ? String(args.reverse_items).split(',').map(x => parseInt(x.trim())).filter(x => !isNaN(x))
                : [];
            if (!Array.isArray(data) || data.length === 0 || !Array.isArray(data[0])) {
                return '**Error**: `responses` must be a JSON array of arrays (participants x items).';
            }
            const nParticipants = data.length;
            const nItems = data[0].length;
            // Find scale range for reverse scoring
            let minVal = Infinity, maxVal = -Infinity;
            for (const row of data) {
                for (const v of row) {
                    if (v < minVal)
                        minVal = v;
                    if (v > maxVal)
                        maxVal = v;
                }
            }
            // Apply reverse scoring
            const scored = data.map(row => row.map((v, j) => reverseIndices.includes(j) ? (minVal + maxVal - v) : v));
            // Total scores per participant
            const totalScores = scored.map(row => sum(row));
            // Item means and SDs
            const itemMeans = [];
            const itemSDs = [];
            for (let j = 0; j < nItems; j++) {
                const col = scored.map(row => row[j]);
                itemMeans.push(mean(col));
                itemSDs.push(stddev(col));
            }
            // Item-total correlations (corrected: exclude item from total)
            const itemTotalCorr = [];
            for (let j = 0; j < nItems; j++) {
                const itemCol = scored.map(row => row[j]);
                const restTotals = scored.map(row => sum(row) - row[j]);
                itemTotalCorr.push(correlation(itemCol, restTotals));
            }
            // Inter-item correlation matrix
            const interItemCorr = Array.from({ length: nItems }, () => new Array(nItems).fill(0));
            for (let i = 0; i < nItems; i++) {
                for (let j = i; j < nItems; j++) {
                    if (i === j) {
                        interItemCorr[i][j] = 1;
                    }
                    else {
                        const r = correlation(scored.map(row => row[i]), scored.map(row => row[j]));
                        interItemCorr[i][j] = r;
                        interItemCorr[j][i] = r;
                    }
                }
            }
            // Average inter-item correlation
            let sumR = 0, countR = 0;
            for (let i = 0; i < nItems; i++) {
                for (let j = i + 1; j < nItems; j++) {
                    sumR += interItemCorr[i][j];
                    countR++;
                }
            }
            const avgInterItem = countR > 0 ? sumR / countR : 0;
            // Cronbach's alpha
            // alpha = (k / (k-1)) * (1 - sum(item_variances) / total_variance)
            const itemVariances = Array.from({ length: nItems }, (_, j) => variance(scored.map(row => row[j])));
            const totalVariance = variance(totalScores);
            const alpha = nItems > 1 && totalVariance > 0
                ? (nItems / (nItems - 1)) * (1 - sum(itemVariances) / totalVariance)
                : 0;
            // Alpha-if-item-deleted
            const alphaIfDeleted = [];
            for (let j = 0; j < nItems; j++) {
                const reducedK = nItems - 1;
                const reducedItemVarSum = sum(itemVariances) - itemVariances[j];
                const reducedTotals = scored.map(row => sum(row) - row[j]);
                const reducedTotalVar = variance(reducedTotals);
                const aIfDel = reducedK > 1 && reducedTotalVar > 0
                    ? (reducedK / (reducedK - 1)) * (1 - reducedItemVarSum / reducedTotalVar)
                    : 0;
                alphaIfDeleted.push(aIfDel);
            }
            // Standardized alpha (based on average inter-item correlation)
            const stdAlpha = nItems > 1
                ? (nItems * avgInterItem) / (1 + (nItems - 1) * avgInterItem)
                : 0;
            // Factor structure hint: eigenvalues of correlation matrix (power iteration for top 3)
            const eigenvalues = computeEigenvalues(interItemCorr, Math.min(3, nItems));
            // Scale-specific interpretation
            let interpretation = '';
            if (scaleName === 'phq9') {
                const avgTotal = mean(totalScores);
                if (avgTotal <= 4)
                    interpretation = 'Minimal depression (0-4)';
                else if (avgTotal <= 9)
                    interpretation = 'Mild depression (5-9)';
                else if (avgTotal <= 14)
                    interpretation = 'Moderate depression (10-14)';
                else if (avgTotal <= 19)
                    interpretation = 'Moderately severe depression (15-19)';
                else
                    interpretation = 'Severe depression (20-27)';
            }
            else if (scaleName === 'gad7') {
                const avgTotal = mean(totalScores);
                if (avgTotal <= 4)
                    interpretation = 'Minimal anxiety (0-4)';
                else if (avgTotal <= 9)
                    interpretation = 'Mild anxiety (5-9)';
                else if (avgTotal <= 14)
                    interpretation = 'Moderate anxiety (10-14)';
                else
                    interpretation = 'Severe anxiety (15-21)';
            }
            else if (scaleName === 'big5') {
                interpretation = 'Big Five domains scored. For a standard 44-item BFI, items map to 5 factors: Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism.';
            }
            else {
                interpretation = `Custom/Likert scale with ${nItems} items, ${nParticipants} respondents.`;
            }
            // Reliability interpretation
            let reliabilityLabel;
            if (alpha >= 0.9)
                reliabilityLabel = 'Excellent';
            else if (alpha >= 0.8)
                reliabilityLabel = 'Good';
            else if (alpha >= 0.7)
                reliabilityLabel = 'Acceptable';
            else if (alpha >= 0.6)
                reliabilityLabel = 'Questionable';
            else if (alpha >= 0.5)
                reliabilityLabel = 'Poor';
            else
                reliabilityLabel = 'Unacceptable';
            const lines = [
                `# Psychometric Analysis: ${scaleName.toUpperCase()}`,
                '',
                `## Summary`,
                `- **Participants**: ${nParticipants}`,
                `- **Items**: ${nItems}`,
                `- **Scale range**: ${minVal} - ${maxVal}`,
                reverseIndices.length > 0 ? `- **Reverse-scored items**: ${reverseIndices.join(', ')}` : '',
                '',
                `## Scale Scores`,
                `| Statistic | Value |`,
                `|-----------|-------|`,
                `| Mean total | ${fmt(mean(totalScores))} |`,
                `| SD total | ${fmt(stddev(totalScores))} |`,
                `| Median total | ${fmt(median(totalScores))} |`,
                `| Min total | ${Math.min(...totalScores)} |`,
                `| Max total | ${Math.max(...totalScores)} |`,
                '',
                `## Reliability`,
                `| Metric | Value | Interpretation |`,
                `|--------|-------|----------------|`,
                `| Cronbach's alpha | ${fmt(alpha)} | ${reliabilityLabel} |`,
                `| Standardized alpha | ${fmt(stdAlpha)} | - |`,
                `| Avg inter-item r | ${fmt(avgInterItem)} | ${avgInterItem >= 0.15 && avgInterItem <= 0.50 ? 'Optimal range' : avgInterItem < 0.15 ? 'Items may be too heterogeneous' : 'Items may be redundant'} |`,
                '',
                `## Item Analysis`,
                `| Item | Mean | SD | Item-Total r | Alpha if Deleted |`,
                `|------|------|----|-------------|-----------------|`,
                ...Array.from({ length: nItems }, (_, j) => `| ${j} | ${fmt(itemMeans[j])} | ${fmt(itemSDs[j])} | ${fmt(itemTotalCorr[j])} | ${fmt(alphaIfDeleted[j])} |`),
                '',
            ];
            // Flag problematic items
            const problematic = [];
            for (let j = 0; j < nItems; j++) {
                if (itemTotalCorr[j] < 0.3)
                    problematic.push(`Item ${j}: low item-total correlation (${fmt(itemTotalCorr[j])})`);
                if (alphaIfDeleted[j] > alpha + 0.01)
                    problematic.push(`Item ${j}: removing would increase alpha to ${fmt(alphaIfDeleted[j])}`);
            }
            if (problematic.length > 0) {
                lines.push(`## Flagged Items`, ...problematic.map(p => `- ${p}`), '');
            }
            // Factor structure
            if (eigenvalues.length > 0) {
                const totalEig = sum(eigenvalues.map(e => Math.max(e, 0)));
                lines.push(`## Factor Structure Hints (Top Eigenvalues)`, `| Factor | Eigenvalue | % Variance |`, `|--------|-----------|------------|`, ...eigenvalues.map((e, i) => `| ${i + 1} | ${fmt(e)} | ${totalEig > 0 ? fmt(100 * Math.max(e, 0) / nItems) : '0'}% |`), '', `- **Kaiser criterion**: ${eigenvalues.filter(e => e > 1).length} factor(s) with eigenvalue > 1`, '');
            }
            if (interpretation) {
                lines.push(`## Interpretation`, interpretation, '');
            }
            return lines.filter(l => l !== undefined).join('\n');
        },
    });
    // ── 2. Effect Size Calculator ──────────────────────────────────────────
    registerTool({
        name: 'effect_size_calc',
        description: 'Calculate and convert between effect size measures: Cohen\'s d, Hedges\' g, Glass\'s delta, odds ratio, risk ratio, NNT, eta-squared, partial eta-squared, Cohen\'s f, phi, Cramer\'s V, point-biserial r. Provides interpretation guidelines (small/medium/large).',
        parameters: {
            from_type: { type: 'string', description: 'Source effect size type: d, g, glass_delta, or, rr, nnt, eta_sq, partial_eta_sq, f, phi, cramers_v, r', required: true },
            from_value: { type: 'number', description: 'Numeric value of the source effect size', required: true },
            to_type: { type: 'string', description: 'Target effect size type (same options as from_type, or "all" for all conversions)', required: true },
            n1: { type: 'number', description: 'Sample size group 1 (needed for some conversions)' },
            n2: { type: 'number', description: 'Sample size group 2 (needed for some conversions)' },
        },
        tier: 'free',
        async execute(args) {
            const fromType = String(args.from_type).toLowerCase().trim();
            const fromValue = Number(args.from_value);
            const toType = String(args.to_type).toLowerCase().trim();
            const n1 = args.n1 ? Number(args.n1) : undefined;
            const n2 = args.n2 ? Number(args.n2) : undefined;
            const nTotal = (n1 && n2) ? n1 + n2 : undefined;
            if (isNaN(fromValue))
                return '**Error**: `from_value` must be a number.';
            // Step 1: Convert everything to Cohen's d as intermediate
            let d;
            switch (fromType) {
                case 'd':
                    d = fromValue;
                    break;
                case 'g': {
                    // Hedges' g to d: d = g / J, where J = 1 - 3/(4*df - 1)
                    const df = nTotal ? nTotal - 2 : 100;
                    const J = 1 - 3 / (4 * df - 1);
                    d = fromValue / J;
                    break;
                }
                case 'glass_delta':
                    d = fromValue; // Glass's delta ~= d when SDs are similar
                    break;
                case 'r': {
                    // Point-biserial r to d
                    d = (2 * fromValue) / Math.sqrt(1 - fromValue * fromValue);
                    break;
                }
                case 'or': {
                    // Odds ratio to d (Hasselblad & Hedges)
                    d = Math.log(fromValue) * Math.sqrt(3) / Math.PI;
                    break;
                }
                case 'eta_sq': {
                    // eta-squared to d
                    d = 2 * Math.sqrt(fromValue / (1 - fromValue));
                    break;
                }
                case 'partial_eta_sq': {
                    // partial eta-squared to d
                    d = 2 * Math.sqrt(fromValue / (1 - fromValue));
                    break;
                }
                case 'f': {
                    // Cohen's f to d (for 2-group case)
                    d = 2 * fromValue;
                    break;
                }
                case 'phi': {
                    // phi to d
                    d = (2 * fromValue) / Math.sqrt(1 - fromValue * fromValue);
                    break;
                }
                case 'cramers_v': {
                    // Cramer's V ~ phi for 2x2 tables
                    d = (2 * fromValue) / Math.sqrt(1 - fromValue * fromValue);
                    break;
                }
                case 'rr': {
                    // Risk ratio: approximate via ln(RR) relationship
                    // RR -> OR approximation for moderate base rates: OR ~ RR (rough)
                    const lnRR = Math.log(fromValue);
                    d = lnRR * Math.sqrt(3) / Math.PI;
                    break;
                }
                case 'nnt': {
                    // NNT to d: NNT = 1/(CER*(RR-1)), approximate via d
                    // d = 1/NNT * sqrt(2*pi) (Furukawa approximation)
                    d = (1 / Math.abs(fromValue)) * Math.sqrt(2 * Math.PI);
                    break;
                }
                default:
                    return `**Error**: Unknown source type \`${fromType}\`. Use: d, g, glass_delta, r, or, rr, nnt, eta_sq, partial_eta_sq, f, phi, cramers_v`;
            }
            // Step 2: Convert d to all target types
            const conversions = {};
            // Cohen's d
            conversions['d'] = {
                value: d,
                label: "Cohen's d",
                interpretation: Math.abs(d) < 0.2 ? 'Negligible' : Math.abs(d) < 0.5 ? 'Small' : Math.abs(d) < 0.8 ? 'Medium' : 'Large',
            };
            // Hedges' g
            const df = nTotal ? nTotal - 2 : 100;
            const J = 1 - 3 / (4 * df - 1);
            conversions['g'] = {
                value: d * J,
                label: "Hedges' g",
                interpretation: Math.abs(d * J) < 0.2 ? 'Negligible' : Math.abs(d * J) < 0.5 ? 'Small' : Math.abs(d * J) < 0.8 ? 'Medium' : 'Large',
            };
            // Glass's delta
            conversions['glass_delta'] = {
                value: d,
                label: "Glass's delta",
                interpretation: Math.abs(d) < 0.2 ? 'Negligible' : Math.abs(d) < 0.5 ? 'Small' : Math.abs(d) < 0.8 ? 'Medium' : 'Large',
            };
            // Point-biserial r
            const r = d / Math.sqrt(d * d + 4);
            conversions['r'] = {
                value: r,
                label: 'Point-biserial r',
                interpretation: Math.abs(r) < 0.1 ? 'Negligible' : Math.abs(r) < 0.3 ? 'Small' : Math.abs(r) < 0.5 ? 'Medium' : 'Large',
            };
            // Odds ratio
            const orVal = Math.exp(d * Math.PI / Math.sqrt(3));
            conversions['or'] = {
                value: orVal,
                label: 'Odds Ratio',
                interpretation: orVal < 1.5 ? 'Small' : orVal < 3.5 ? 'Medium' : 'Large',
            };
            // Eta-squared
            const etaSq = d * d / (d * d + 4);
            conversions['eta_sq'] = {
                value: etaSq,
                label: 'Eta-squared',
                interpretation: etaSq < 0.01 ? 'Negligible' : etaSq < 0.06 ? 'Small' : etaSq < 0.14 ? 'Medium' : 'Large',
            };
            // Partial eta-squared (same formula for 2-group case)
            conversions['partial_eta_sq'] = {
                value: etaSq,
                label: 'Partial eta-squared',
                interpretation: etaSq < 0.01 ? 'Negligible' : etaSq < 0.06 ? 'Small' : etaSq < 0.14 ? 'Medium' : 'Large',
            };
            // Cohen's f
            const fVal = Math.abs(d) / 2;
            conversions['f'] = {
                value: fVal,
                label: "Cohen's f",
                interpretation: fVal < 0.1 ? 'Negligible' : fVal < 0.25 ? 'Small' : fVal < 0.4 ? 'Medium' : 'Large',
            };
            // Phi coefficient
            const phiVal = d / Math.sqrt(d * d + 4);
            conversions['phi'] = {
                value: phiVal,
                label: 'Phi coefficient',
                interpretation: Math.abs(phiVal) < 0.1 ? 'Negligible' : Math.abs(phiVal) < 0.3 ? 'Small' : Math.abs(phiVal) < 0.5 ? 'Medium' : 'Large',
            };
            // Cramer's V (same as phi for 2x2)
            conversions['cramers_v'] = {
                value: Math.abs(phiVal),
                label: "Cramer's V",
                interpretation: Math.abs(phiVal) < 0.1 ? 'Negligible' : Math.abs(phiVal) < 0.3 ? 'Small' : Math.abs(phiVal) < 0.5 ? 'Medium' : 'Large',
            };
            // Risk Ratio (approximate)
            const rrVal = Math.exp(d * Math.PI / Math.sqrt(3) * 0.55); // rough approximation
            conversions['rr'] = {
                value: rrVal,
                label: 'Risk Ratio (approx.)',
                interpretation: rrVal < 1.25 ? 'Small' : rrVal < 2.0 ? 'Medium' : 'Large',
            };
            // NNT (Furukawa approximation)
            const nntVal = Math.abs(d) > 0.001 ? Math.sqrt(2 * Math.PI) / Math.abs(d) : Infinity;
            conversions['nnt'] = {
                value: nntVal,
                label: 'Number Needed to Treat',
                interpretation: isFinite(nntVal) ? (nntVal <= 3 ? 'Very large effect' : nntVal <= 10 ? 'Moderate effect' : 'Small effect') : 'No effect',
            };
            // Build output
            const lines = [
                `# Effect Size Conversion`,
                '',
                `**Input**: ${conversions[fromType]?.label || fromType} = ${fmt(fromValue)}`,
                n1 !== undefined ? `**n1** = ${n1}, **n2** = ${n2 ?? 'N/A'}` : '',
                '',
            ];
            if (toType === 'all') {
                lines.push(`## All Conversions`, '', `| Measure | Value | Interpretation |`, `|---------|-------|----------------|`, ...Object.values(conversions).map(c => `| ${c.label} | ${isFinite(c.value) ? fmt(c.value) : 'N/A'} | ${c.interpretation} |`), '');
            }
            else {
                const target = conversions[toType];
                if (!target) {
                    return `**Error**: Unknown target type \`${toType}\`. Use: d, g, glass_delta, r, or, rr, nnt, eta_sq, partial_eta_sq, f, phi, cramers_v, or "all".`;
                }
                lines.push(`## Result`, `**${target.label}** = **${isFinite(target.value) ? fmt(target.value) : 'N/A'}** (${target.interpretation})`, '');
            }
            lines.push(`## Interpretation Guidelines (Cohen, 1988)`, `| Measure | Small | Medium | Large |`, `|---------|-------|--------|-------|`, `| d / g | 0.2 | 0.5 | 0.8 |`, `| r | 0.1 | 0.3 | 0.5 |`, `| eta-sq | 0.01 | 0.06 | 0.14 |`, `| f | 0.10 | 0.25 | 0.40 |`, `| OR | 1.5 | 3.5 | 9.0 |`, '', `> **Note**: Conversions between some measures involve approximations. Results are most accurate for the d/g/r family. OR/RR conversions use the Hasselblad & Hedges (1995) or Furukawa (2011) methods.`);
            return lines.filter(l => l !== undefined).join('\n');
        },
    });
    // ── 3. Social Network Analysis ─────────────────────────────────────────
    registerTool({
        name: 'social_network_analyze',
        description: 'Analyze social/relational networks. Computes degree centrality, betweenness centrality, closeness centrality, eigenvector centrality, clustering coefficient, density, connected components, bridges, and community detection via label propagation.',
        parameters: {
            nodes: { type: 'string', description: 'JSON array of node IDs, e.g. ["Alice","Bob","Carol"]', required: true },
            edges: { type: 'string', description: 'JSON array of {from, to, weight?} objects', required: true },
            metrics: { type: 'string', description: 'What to compute: all, centrality, community, structure (default: all)' },
        },
        tier: 'free',
        async execute(args) {
            const nodeList = JSON.parse(String(args.nodes));
            const edgeList = JSON.parse(String(args.edges));
            const metricsType = (args.metrics ? String(args.metrics) : 'all').toLowerCase().trim();
            const n = nodeList.length;
            const nodeIndex = new Map();
            nodeList.forEach((node, i) => nodeIndex.set(node, i));
            // Adjacency list (undirected) with weights
            const adj = new Map();
            for (let i = 0; i < n; i++)
                adj.set(i, new Map());
            for (const edge of edgeList) {
                const u = nodeIndex.get(edge.from);
                const v = nodeIndex.get(edge.to);
                if (u === undefined || v === undefined)
                    continue;
                const w = edge.weight ?? 1;
                adj.get(u).set(v, w);
                adj.get(v).set(u, w);
            }
            const totalEdges = edgeList.length;
            const lines = [`# Social Network Analysis`, '', `- **Nodes**: ${n}`, `- **Edges**: ${totalEdges}`, ''];
            // ── Structure metrics ──
            if (metricsType === 'all' || metricsType === 'structure') {
                // Density
                const maxEdges = n * (n - 1) / 2;
                const density = maxEdges > 0 ? totalEdges / maxEdges : 0;
                // Connected components (BFS)
                const visited = new Set();
                const components = [];
                for (let i = 0; i < n; i++) {
                    if (visited.has(i))
                        continue;
                    const comp = [];
                    const queue = [i];
                    visited.add(i);
                    while (queue.length > 0) {
                        const cur = queue.shift();
                        comp.push(cur);
                        for (const [nb] of adj.get(cur)) {
                            if (!visited.has(nb)) {
                                visited.add(nb);
                                queue.push(nb);
                            }
                        }
                    }
                    components.push(comp);
                }
                // Bridges (naive: remove each edge, check if components increase)
                const bridges = [];
                for (const edge of edgeList) {
                    const u = nodeIndex.get(edge.from);
                    const v = nodeIndex.get(edge.to);
                    // Temporarily remove edge
                    adj.get(u).delete(v);
                    adj.get(v).delete(u);
                    // BFS from u
                    const vis2 = new Set();
                    const q2 = [u];
                    vis2.add(u);
                    while (q2.length > 0) {
                        const cur = q2.shift();
                        for (const [nb] of adj.get(cur)) {
                            if (!vis2.has(nb)) {
                                vis2.add(nb);
                                q2.push(nb);
                            }
                        }
                    }
                    if (!vis2.has(v)) {
                        bridges.push(`${edge.from} -- ${edge.to}`);
                    }
                    // Restore edge
                    const w = edge.weight ?? 1;
                    adj.get(u).set(v, w);
                    adj.get(v).set(u, w);
                }
                // Average clustering coefficient
                let totalCC = 0;
                const nodeCC = [];
                for (let i = 0; i < n; i++) {
                    const neighbors = [...adj.get(i).keys()];
                    const ki = neighbors.length;
                    if (ki < 2) {
                        nodeCC.push(0);
                        continue;
                    }
                    let triangles = 0;
                    for (let a = 0; a < neighbors.length; a++) {
                        for (let b = a + 1; b < neighbors.length; b++) {
                            if (adj.get(neighbors[a]).has(neighbors[b]))
                                triangles++;
                        }
                    }
                    const cc = (2 * triangles) / (ki * (ki - 1));
                    nodeCC.push(cc);
                    totalCC += cc;
                }
                const avgCC = n > 0 ? totalCC / n : 0;
                lines.push(`## Network Structure`, `| Metric | Value |`, `|--------|-------|`, `| Density | ${fmt(density)} |`, `| Components | ${components.length} |`, `| Largest component | ${Math.max(...components.map(c => c.length))} nodes |`, `| Avg clustering coeff | ${fmt(avgCC)} |`, `| Bridges | ${bridges.length} |`, '');
                if (bridges.length > 0) {
                    lines.push(`**Bridges**: ${bridges.join(', ')}`, '');
                }
            }
            // ── Centrality metrics ──
            if (metricsType === 'all' || metricsType === 'centrality') {
                // Degree centrality
                const degreeCent = nodeList.map((_, i) => adj.get(i).size / (n - 1 || 1));
                // Closeness centrality (BFS shortest paths)
                const closenessCent = [];
                for (let i = 0; i < n; i++) {
                    const dist = new Map();
                    dist.set(i, 0);
                    const queue = [i];
                    while (queue.length > 0) {
                        const cur = queue.shift();
                        const d = dist.get(cur);
                        for (const [nb] of adj.get(cur)) {
                            if (!dist.has(nb)) {
                                dist.set(nb, d + 1);
                                queue.push(nb);
                            }
                        }
                    }
                    const reachable = dist.size - 1;
                    if (reachable === 0) {
                        closenessCent.push(0);
                    }
                    else {
                        let totalDist = 0;
                        for (const [node, d] of dist) {
                            if (node !== i)
                                totalDist += d;
                        }
                        // Wasserman & Faust normalization
                        closenessCent.push(reachable / ((n - 1) * (totalDist / reachable)));
                    }
                }
                // Betweenness centrality (Brandes algorithm)
                const betweennessCent = new Array(n).fill(0);
                for (let s = 0; s < n; s++) {
                    const stack = [];
                    const pred = Array.from({ length: n }, () => []);
                    const sigma = new Array(n).fill(0);
                    sigma[s] = 1;
                    const dist = new Array(n).fill(-1);
                    dist[s] = 0;
                    const queue = [s];
                    while (queue.length > 0) {
                        const v = queue.shift();
                        stack.push(v);
                        for (const [w] of adj.get(v)) {
                            if (dist[w] < 0) {
                                queue.push(w);
                                dist[w] = dist[v] + 1;
                            }
                            if (dist[w] === dist[v] + 1) {
                                sigma[w] += sigma[v];
                                pred[w].push(v);
                            }
                        }
                    }
                    const delta = new Array(n).fill(0);
                    while (stack.length > 0) {
                        const w = stack.pop();
                        for (const v of pred[w]) {
                            delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
                        }
                        if (w !== s)
                            betweennessCent[w] += delta[w];
                    }
                }
                // Normalize
                const normFactor = n > 2 ? (n - 1) * (n - 2) : 1;
                for (let i = 0; i < n; i++)
                    betweennessCent[i] /= normFactor;
                // Eigenvector centrality (power iteration)
                let eigenVec = new Array(n).fill(1 / Math.sqrt(n));
                for (let iter = 0; iter < 100; iter++) {
                    const newVec = new Array(n).fill(0);
                    for (let i = 0; i < n; i++) {
                        for (const [nb, w] of adj.get(i)) {
                            newVec[i] += w * eigenVec[nb];
                        }
                    }
                    const norm = Math.sqrt(newVec.reduce((s, v) => s + v * v, 0));
                    if (norm === 0)
                        break;
                    const scaled = newVec.map(v => v / norm);
                    const diff = scaled.reduce((s, v, i) => s + Math.abs(v - eigenVec[i]), 0);
                    eigenVec = scaled;
                    if (diff < 1e-10)
                        break;
                }
                lines.push(`## Centrality Measures`, `| Node | Degree | Closeness | Betweenness | Eigenvector |`, `|------|--------|-----------|-------------|-------------|`, ...nodeList.map((name, i) => `| ${name} | ${fmt(degreeCent[i])} | ${fmt(closenessCent[i])} | ${fmt(betweennessCent[i])} | ${fmt(eigenVec[i])} |`), '', `**Most central node (by betweenness)**: ${nodeList[betweennessCent.indexOf(Math.max(...betweennessCent))]}`, `**Most central node (by eigenvector)**: ${nodeList[eigenVec.indexOf(Math.max(...eigenVec))]}`, '');
            }
            // ── Community detection (label propagation) ──
            if (metricsType === 'all' || metricsType === 'community') {
                const labels = nodeList.map((_, i) => i); // Each node starts as own community
                const order = nodeList.map((_, i) => i);
                for (let iter = 0; iter < 50; iter++) {
                    // Shuffle order
                    for (let i = order.length - 1; i > 0; i--) {
                        const j = Math.floor(deterministicRandom(iter * n + i) * (i + 1));
                        [order[i], order[j]] = [order[j], order[i]];
                    }
                    let changed = false;
                    for (const node of order) {
                        const labelCounts = new Map();
                        for (const [nb, w] of adj.get(node)) {
                            const lbl = labels[nb];
                            labelCounts.set(lbl, (labelCounts.get(lbl) ?? 0) + w);
                        }
                        if (labelCounts.size === 0)
                            continue;
                        let maxCount = -Infinity;
                        let bestLabel = labels[node];
                        for (const [lbl, count] of labelCounts) {
                            if (count > maxCount) {
                                maxCount = count;
                                bestLabel = lbl;
                            }
                        }
                        if (bestLabel !== labels[node]) {
                            labels[node] = bestLabel;
                            changed = true;
                        }
                    }
                    if (!changed)
                        break;
                }
                // Group by community
                const communities = new Map();
                labels.forEach((lbl, i) => {
                    if (!communities.has(lbl))
                        communities.set(lbl, []);
                    communities.get(lbl).push(nodeList[i]);
                });
                // Modularity
                const m2 = totalEdges * 2; // sum of degrees (each edge counted twice for undirected)
                let Q = 0;
                if (m2 > 0) {
                    for (let i = 0; i < n; i++) {
                        for (let j = 0; j < n; j++) {
                            if (labels[i] !== labels[j])
                                continue;
                            const aij = adj.get(i).get(j) ?? 0;
                            const ki = adj.get(i).size;
                            const kj = adj.get(j).size;
                            Q += aij - (ki * kj) / m2;
                        }
                    }
                    Q /= m2;
                }
                let commIdx = 0;
                lines.push(`## Community Detection (Label Propagation)`, `- **Communities found**: ${communities.size}`, `- **Modularity (Q)**: ${fmt(Q)}`, '', `| Community | Members |`, `|-----------|---------|`, ...[...communities.values()].map(members => `| ${++commIdx} | ${members.join(', ')} |`), '');
            }
            return lines.join('\n');
        },
    });
    // ── 4. Game Theory Solver ──────────────────────────────────────────────
    registerTool({
        name: 'game_theory_solve',
        description: 'Solve normal-form 2-player games. Finds pure and mixed strategy Nash equilibria, dominant strategies, Pareto optimal outcomes, minimax strategies. Supports custom payoff matrices and named classics (prisoner\'s dilemma, chicken, stag hunt, battle of sexes).',
        parameters: {
            payoff_matrix: { type: 'string', description: 'JSON 2D array of [row_payoff, col_payoff] tuples. E.g. [[[3,3],[0,5]],[[5,0],[1,1]]] for prisoner\'s dilemma', required: true },
            player_names: { type: 'string', description: 'Comma-separated player names (default: "Row,Column")' },
        },
        tier: 'free',
        async execute(args) {
            const matrix = JSON.parse(String(args.payoff_matrix));
            const names = args.player_names
                ? String(args.player_names).split(',').map(s => s.trim())
                : ['Row', 'Column'];
            const nRows = matrix.length;
            const nCols = matrix[0].length;
            if (nRows === 0 || nCols === 0)
                return '**Error**: Payoff matrix cannot be empty.';
            const p1 = names[0] || 'Row';
            const p2 = names[1] || 'Column';
            const lines = [
                `# Game Theory Analysis`,
                '',
                `**Players**: ${p1} (rows) vs ${p2} (columns)`,
                `**Strategies**: ${p1} has ${nRows}, ${p2} has ${nCols}`,
                '',
                `## Payoff Matrix`,
                '',
                `| | ${Array.from({ length: nCols }, (_, j) => `${p2}-${j}`).join(' | ')} |`,
                `|${'-|'.repeat(nCols + 1)}`,
                ...matrix.map((row, i) => `| **${p1}-${i}** | ${row.map(([a, b]) => `(${a}, ${b})`).join(' | ')} |`),
                '',
            ];
            // ── Dominant strategies ──
            // Check if strategy i dominates strategy j for Row player
            function rowDominates(i, j, strict) {
                return matrix[i].every((_, c) => strict ? matrix[i][c][0] > matrix[j][c][0] : matrix[i][c][0] >= matrix[j][c][0]) && (strict ? true : matrix[i].some((_, c) => matrix[i][c][0] > matrix[j][c][0]));
            }
            function colDominates(i, j, strict) {
                return matrix.every((_, r) => strict ? matrix[r][i][1] > matrix[r][j][1] : matrix[r][i][1] >= matrix[r][j][1]) && (strict ? true : matrix.some((_, r) => matrix[r][i][1] > matrix[r][j][1]));
            }
            const rowDominated = new Array(nRows).fill(false);
            const colDominated = new Array(nCols).fill(false);
            const rowDominant = [];
            const colDominant = [];
            for (let i = 0; i < nRows; i++) {
                let dominatesAll = true;
                for (let j = 0; j < nRows; j++) {
                    if (i === j)
                        continue;
                    if (rowDominates(j, i, false))
                        rowDominated[i] = true;
                    if (!rowDominates(i, j, false))
                        dominatesAll = false;
                }
                if (dominatesAll && nRows > 1)
                    rowDominant.push(i);
            }
            for (let i = 0; i < nCols; i++) {
                let dominatesAll = true;
                for (let j = 0; j < nCols; j++) {
                    if (i === j)
                        continue;
                    if (colDominates(j, i, false))
                        colDominated[i] = true;
                    if (!colDominates(i, j, false))
                        dominatesAll = false;
                }
                if (dominatesAll && nCols > 1)
                    colDominant.push(i);
            }
            lines.push(`## Dominant Strategy Analysis`);
            if (rowDominant.length > 0) {
                lines.push(`- **${p1}** has dominant strategy: ${rowDominant.map(i => `Strategy ${i}`).join(', ')}`);
            }
            if (colDominant.length > 0) {
                lines.push(`- **${p2}** has dominant strategy: ${colDominant.map(i => `Strategy ${i}`).join(', ')}`);
            }
            if (rowDominant.length === 0 && colDominant.length === 0) {
                lines.push(`- No strictly dominant strategies found.`);
            }
            lines.push('');
            // ── Pure strategy Nash equilibria ──
            const pureNE = [];
            for (let r = 0; r < nRows; r++) {
                for (let c = 0; c < nCols; c++) {
                    // Check if r is best response to c
                    const rowPayoff = matrix[r][c][0];
                    let rowBest = true;
                    for (let r2 = 0; r2 < nRows; r2++) {
                        if (matrix[r2][c][0] > rowPayoff) {
                            rowBest = false;
                            break;
                        }
                    }
                    // Check if c is best response to r
                    const colPayoff = matrix[r][c][1];
                    let colBest = true;
                    for (let c2 = 0; c2 < nCols; c2++) {
                        if (matrix[r][c2][1] > colPayoff) {
                            colBest = false;
                            break;
                        }
                    }
                    if (rowBest && colBest) {
                        pureNE.push({ row: r, col: c, payoff: [rowPayoff, colPayoff] });
                    }
                }
            }
            lines.push(`## Pure Strategy Nash Equilibria`);
            if (pureNE.length === 0) {
                lines.push(`No pure strategy Nash equilibria found.`);
            }
            else {
                for (const ne of pureNE) {
                    lines.push(`- **(${p1}-${ne.row}, ${p2}-${ne.col})** with payoffs (${ne.payoff[0]}, ${ne.payoff[1]})`);
                }
            }
            lines.push('');
            // ── Mixed strategy Nash equilibrium (2x2 only) ──
            if (nRows === 2 && nCols === 2) {
                // Row player mixes to make Column indifferent:
                // p * M[0][0][1] + (1-p) * M[1][0][1] = p * M[0][1][1] + (1-p) * M[1][1][1]
                const a = matrix[0][0][1], b = matrix[0][1][1];
                const c = matrix[1][0][1], d = matrix[1][1][1];
                const denomP = (a - b - c + d);
                const e = matrix[0][0][0], f = matrix[0][1][0];
                const g = matrix[1][0][0], h = matrix[1][1][0];
                const denomQ = (e - f - g + h);
                lines.push(`## Mixed Strategy Nash Equilibrium`);
                if (Math.abs(denomP) < 1e-10 || Math.abs(denomQ) < 1e-10) {
                    lines.push(`Cannot compute mixed strategy equilibrium (degenerate game).`);
                }
                else {
                    const p = (d - c) / denomP; // Row player probability on Strategy 0
                    const q = (h - f) / denomQ; // Column player probability on Strategy 0
                    if (p >= 0 && p <= 1 && q >= 0 && q <= 1) {
                        const rowExpected = p * (q * matrix[0][0][0] + (1 - q) * matrix[0][1][0]) +
                            (1 - p) * (q * matrix[1][0][0] + (1 - q) * matrix[1][1][0]);
                        const colExpected = p * (q * matrix[0][0][1] + (1 - q) * matrix[0][1][1]) +
                            (1 - p) * (q * matrix[1][0][1] + (1 - q) * matrix[1][1][1]);
                        lines.push(`- **${p1}** plays Strategy 0 with probability **${fmt(p)}**, Strategy 1 with **${fmt(1 - p)}**`, `- **${p2}** plays Strategy 0 with probability **${fmt(q)}**, Strategy 1 with **${fmt(1 - q)}**`, `- **Expected payoffs**: ${p1} = ${fmt(rowExpected)}, ${p2} = ${fmt(colExpected)}`);
                    }
                    else {
                        lines.push(`Mixed equilibrium probabilities out of [0,1] range; only pure equilibria exist.`);
                    }
                }
                lines.push('');
            }
            else if (nRows > 2 || nCols > 2) {
                lines.push(`## Mixed Strategy Nash Equilibrium`);
                lines.push(`> Mixed strategy computation for games larger than 2x2 requires support enumeration. Showing pure strategy analysis only.`);
                lines.push('');
            }
            // ── Pareto optimal outcomes ──
            const paretoOptimal = [];
            for (let r = 0; r < nRows; r++) {
                for (let c = 0; c < nCols; c++) {
                    let dominated = false;
                    for (let r2 = 0; r2 < nRows && !dominated; r2++) {
                        for (let c2 = 0; c2 < nCols && !dominated; c2++) {
                            if (r === r2 && c === c2)
                                continue;
                            if (matrix[r2][c2][0] >= matrix[r][c][0] && matrix[r2][c2][1] >= matrix[r][c][1] &&
                                (matrix[r2][c2][0] > matrix[r][c][0] || matrix[r2][c2][1] > matrix[r][c][1])) {
                                dominated = true;
                            }
                        }
                    }
                    if (!dominated)
                        paretoOptimal.push({ row: r, col: c });
                }
            }
            lines.push(`## Pareto Optimal Outcomes`);
            for (const po of paretoOptimal) {
                lines.push(`- **(${p1}-${po.row}, ${p2}-${po.col})**: (${matrix[po.row][po.col][0]}, ${matrix[po.row][po.col][1]})`);
            }
            lines.push('');
            // ── Minimax ──
            // Row player minimax: max over rows of (min over columns of row payoff)
            const rowMinimax = Math.max(...matrix.map(row => Math.min(...row.map(cell => cell[0]))));
            const colMinimax = Math.max(...Array.from({ length: nCols }, (_, c) => Math.min(...matrix.map(row => row[c][1]))));
            lines.push(`## Minimax Values`, `- **${p1}** minimax value: ${fmt(rowMinimax)}`, `- **${p2}** minimax value: ${fmt(colMinimax)}`, '');
            // ── Classify known games ──
            if (nRows === 2 && nCols === 2) {
                const [[a11, a12], [a21, a22]] = matrix.map(row => row.map(cell => cell[0]));
                const [[b11, b12], [b21, b22]] = matrix.map(row => row.map(cell => cell[1]));
                let gameType = 'Custom game';
                // Prisoner's dilemma: T > R > P > S (where T=defect/coop, R=coop/coop, P=defect/defect, S=coop/defect)
                if (a21 > a11 && a11 > a22 && a22 > a12 && b12 > b11 && b11 > b22 && b22 > b21) {
                    gameType = "Prisoner's Dilemma";
                }
                // Battle of the Sexes pattern
                else if (a11 > a22 && a22 > a12 && a22 > a21 && b22 > b11 && b11 > b12 && b11 > b21) {
                    gameType = 'Battle of the Sexes';
                }
                // Chicken / Hawk-Dove
                else if (a21 > a11 && a11 > a12 && a12 > a22) {
                    gameType = 'Chicken / Hawk-Dove';
                }
                if (gameType !== 'Custom game') {
                    lines.push(`## Game Classification`, `Detected pattern: **${gameType}**`, '');
                }
            }
            return lines.join('\n');
        },
    });
    // ── 5. Econometrics Regression ─────────────────────────────────────────
    registerTool({
        name: 'econometrics_regression',
        description: 'OLS regression with full econometric diagnostics: coefficients, standard errors, t-stats, p-values, R-squared, adjusted R-squared, F-statistic, heteroscedasticity test (Breusch-Pagan), autocorrelation (Durbin-Watson), multicollinearity (VIF), specification test (Ramsey RESET). Supports regular and heteroscedasticity-robust (HC1) standard errors.',
        parameters: {
            y: { type: 'string', description: 'Comma-separated dependent variable values', required: true },
            x_vars: { type: 'string', description: 'JSON array of arrays, each inner array is one independent variable\'s values', required: true },
            variable_names: { type: 'string', description: 'Comma-separated variable names (first is y name, rest are x names)' },
            robust: { type: 'boolean', description: 'Use HC1 heteroscedasticity-robust standard errors (default false)' },
        },
        tier: 'free',
        async execute(args) {
            const yVals = parseNumbers(String(args.y));
            const xArrays = JSON.parse(String(args.x_vars));
            const useRobust = args.robust === true || args.robust === 'true';
            const varNames = args.variable_names
                ? String(args.variable_names).split(',').map(s => s.trim())
                : ['Y', ...xArrays.map((_, i) => `X${i + 1}`)];
            const n = yVals.length;
            const k = xArrays.length; // number of regressors (excluding intercept)
            if (n === 0)
                return '**Error**: No observations provided.';
            if (k === 0)
                return '**Error**: No independent variables provided.';
            if (xArrays.some(x => x.length !== n))
                return '**Error**: All variables must have the same number of observations.';
            if (n <= k + 1)
                return '**Error**: Need more observations than parameters (n > k+1).';
            // Build X matrix with intercept column
            const X = yVals.map((_, i) => [1, ...xArrays.map(x => x[i])]);
            const p = k + 1; // parameters including intercept
            // OLS: beta = (X'X)^-1 X'y
            const Xt = matTranspose(X);
            const XtX = matMul(Xt, X);
            const XtXinv = matInverse(XtX);
            if (!XtXinv)
                return '**Error**: X\'X is singular. Check for perfect multicollinearity.';
            const Xty = matVecMul(Xt, yVals);
            const beta = matVecMul(XtXinv, Xty);
            // Predicted values and residuals
            const yHat = matVecMul(X, beta);
            const residuals = yVals.map((y, i) => y - yHat[i]);
            const SSR = residuals.reduce((s, r) => s + r * r, 0);
            const yMean = mean(yVals);
            const SST = yVals.reduce((s, y) => s + (y - yMean) ** 2, 0);
            const SSE = SST - SSR;
            const rSquared = SST > 0 ? 1 - SSR / SST : 0;
            const adjRSquared = 1 - (1 - rSquared) * (n - 1) / (n - p);
            const sigma2 = SSR / (n - p);
            // Standard errors
            let se;
            let seLbl;
            if (useRobust) {
                // HC1 robust standard errors
                // V_HC1 = (n/(n-p)) * (X'X)^-1 * X' * diag(e^2) * X * (X'X)^-1
                const diagE2 = residuals.map(r => r * r);
                const XtDiagE2 = Array.from({ length: p }, () => new Array(n).fill(0));
                for (let i = 0; i < p; i++) {
                    for (let j = 0; j < n; j++) {
                        XtDiagE2[i][j] = Xt[i][j] * diagE2[j];
                    }
                }
                const meat = matMul(XtDiagE2.map(r => [r]).flat().length ? // ensure 2D
                    XtDiagE2 : XtDiagE2, X);
                const robustV = matMul(matMul(XtXinv, meat), XtXinv);
                const hc1Factor = n / (n - p);
                se = matDiag(robustV).map(v => Math.sqrt(Math.abs(v) * hc1Factor));
                seLbl = 'HC1 Robust';
            }
            else {
                // Standard OLS standard errors
                se = matDiag(XtXinv).map(v => Math.sqrt(Math.abs(v) * sigma2));
                seLbl = 'OLS';
            }
            // t-statistics and p-values
            const tStats = beta.map((b, i) => se[i] > 0 ? b / se[i] : 0);
            const pValues = tStats.map(t => {
                const dfRes = n - p;
                const prob = 2 * (1 - tCdf(Math.abs(t), dfRes));
                return prob;
            });
            // F-statistic
            const fStat = (p > 1 && sigma2 > 0) ? (SSE / (p - 1)) / sigma2 : 0;
            const fPValue = fStat > 0 ? 1 - fCdf(fStat, p - 1, n - p) : 1;
            const lines = [
                `# OLS Regression Results`,
                '',
                `| Statistic | Value |`,
                `|-----------|-------|`,
                `| Observations | ${n} |`,
                `| R-squared | ${fmt(rSquared)} |`,
                `| Adj R-squared | ${fmt(adjRSquared)} |`,
                `| F-statistic | ${fmt(fStat)} (p = ${fmt(fPValue)}) |`,
                `| Residual SE | ${fmt(Math.sqrt(sigma2))} |`,
                `| SE type | ${seLbl} |`,
                '',
                `## Coefficients`,
                `| Variable | Coeff | Std Err | t-stat | p-value | Sig |`,
                `|----------|-------|---------|--------|---------|-----|`,
                `| (Intercept) | ${fmt(beta[0])} | ${fmt(se[0])} | ${fmt(tStats[0])} | ${fmt(pValues[0])} | ${sigStars(pValues[0])} |`,
                ...xArrays.map((_, i) => {
                    const idx = i + 1;
                    const name = varNames[idx] || `X${i + 1}`;
                    return `| ${name} | ${fmt(beta[idx])} | ${fmt(se[idx])} | ${fmt(tStats[idx])} | ${fmt(pValues[idx])} | ${sigStars(pValues[idx])} |`;
                }),
                '',
                `> Significance: \\*\\*\\* p<0.001, \\*\\* p<0.01, \\* p<0.05, . p<0.1`,
                '',
            ];
            // ── Diagnostics ──
            lines.push(`## Diagnostics`, '');
            // Durbin-Watson statistic
            let dwNum = 0;
            for (let i = 1; i < n; i++)
                dwNum += (residuals[i] - residuals[i - 1]) ** 2;
            const dw = SSR > 0 ? dwNum / SSR : 0;
            let dwInterp = '';
            if (dw < 1.5)
                dwInterp = 'Positive autocorrelation likely';
            else if (dw > 2.5)
                dwInterp = 'Negative autocorrelation likely';
            else
                dwInterp = 'No significant autocorrelation';
            lines.push(`### Durbin-Watson (Autocorrelation)`, `- DW = ${fmt(dw)} (${dwInterp})`, `- Range: 0 (perfect positive) to 4 (perfect negative), 2 = no autocorrelation`, '');
            // Breusch-Pagan test for heteroscedasticity
            // Regress e^2 on X, test R^2 * n ~ chi-sq(k)
            const eSq = residuals.map(r => r * r);
            const eSqMean = mean(eSq);
            const eSqHat = matVecMul(X, matVecMul(matInverse(matMul(matTranspose(X), X)), matVecMul(matTranspose(X), eSq)));
            const SSR_bp = eSq.reduce((s, e, i) => s + (e - eSqHat[i]) ** 2, 0);
            const SST_bp = eSq.reduce((s, e) => s + (e - eSqMean) ** 2, 0);
            const R2_bp = SST_bp > 0 ? 1 - SSR_bp / SST_bp : 0;
            const bpStat = n * R2_bp;
            const bpPValue = 1 - chiSquareCdf(bpStat, k);
            lines.push(`### Breusch-Pagan (Heteroscedasticity)`, `- BP = ${fmt(bpStat)}, df = ${k}, p = ${fmt(bpPValue)}`, `- ${bpPValue < 0.05 ? '**Heteroscedasticity detected** (p < 0.05). Consider robust SEs.' : 'No significant heteroscedasticity (p >= 0.05).'}`, '');
            // VIF (Variance Inflation Factor) for each X variable
            if (k >= 2) {
                lines.push(`### VIF (Multicollinearity)`);
                const vifs = [];
                for (let j = 0; j < k; j++) {
                    // Regress x_j on all other x variables
                    const yj = xArrays[j];
                    const otherX = yj.map((_, i) => [1, ...xArrays.filter((_, idx) => idx !== j).map(x => x[i])]);
                    const otherXt = matTranspose(otherX);
                    const otherXtX = matMul(otherXt, otherX);
                    const otherXtXinv = matInverse(otherXtX);
                    if (!otherXtXinv) {
                        vifs.push({ name: varNames[j + 1] || `X${j + 1}`, vif: Infinity });
                        continue;
                    }
                    const betaJ = matVecMul(otherXtXinv, matVecMul(otherXt, yj));
                    const yjHat = matVecMul(otherX, betaJ);
                    const ssrJ = yj.reduce((s, y, i) => s + (y - yjHat[i]) ** 2, 0);
                    const sstJ = yj.reduce((s, y) => s + (y - mean(yj)) ** 2, 0);
                    const r2j = sstJ > 0 ? 1 - ssrJ / sstJ : 0;
                    const vifJ = 1 / (1 - r2j);
                    vifs.push({ name: varNames[j + 1] || `X${j + 1}`, vif: vifJ });
                }
                lines.push(`| Variable | VIF | Concern |`, `|----------|-----|---------|`, ...vifs.map(v => `| ${v.name} | ${isFinite(v.vif) ? fmt(v.vif) : 'Inf'} | ${v.vif > 10 ? 'Severe multicollinearity' : v.vif > 5 ? 'Moderate concern' : 'OK'} |`), '');
            }
            // Ramsey RESET test (add y_hat^2 and y_hat^3, test their joint significance)
            if (n > p + 2) {
                const yHat2 = yHat.map(y => y * y);
                const yHat3 = yHat.map(y => y * y * y);
                const XAug = X.map((row, i) => [...row, yHat2[i], yHat3[i]]);
                const XAugt = matTranspose(XAug);
                const XAugXtXinv = matInverse(matMul(XAugt, XAug));
                if (XAugXtXinv) {
                    const betaAug = matVecMul(XAugXtXinv, matVecMul(XAugt, yVals));
                    const yHatAug = matVecMul(XAug, betaAug);
                    const ssrAug = yVals.reduce((s, y, i) => s + (y - yHatAug[i]) ** 2, 0);
                    const df1 = 2; // added 2 terms
                    const df2 = n - p - 2;
                    const resetF = df2 > 0 ? ((SSR - ssrAug) / df1) / (ssrAug / df2) : 0;
                    const resetP = resetF > 0 ? 1 - fCdf(resetF, df1, df2) : 1;
                    lines.push(`### Ramsey RESET (Specification)`, `- F = ${fmt(resetF)}, df1 = ${df1}, df2 = ${df2}, p = ${fmt(resetP)}`, `- ${resetP < 0.05 ? '**Possible misspecification** (p < 0.05). Consider non-linear terms or omitted variables.' : 'No significant misspecification detected (p >= 0.05).'}`, '');
                }
            }
            return lines.join('\n');
        },
    });
    // ── 6. Inequality Metrics ──────────────────────────────────────────────
    registerTool({
        name: 'inequality_metrics',
        description: 'Calculate inequality and distribution measures: Gini coefficient, Lorenz curve data, Theil index (GE(1)), Atkinson index, Palma ratio (top 10% / bottom 40%), top/bottom decile shares, poverty headcount ratio, and poverty gap.',
        parameters: {
            incomes: { type: 'string', description: 'Comma-separated income/wealth values', required: true },
            poverty_line: { type: 'number', description: 'Poverty line threshold (optional, for poverty measures)' },
        },
        tier: 'free',
        async execute(args) {
            const incomes = parseNumbers(String(args.incomes));
            const povertyLine = args.poverty_line !== undefined ? Number(args.poverty_line) : undefined;
            if (incomes.length === 0)
                return '**Error**: No income values provided.';
            const sorted = [...incomes].sort((a, b) => a - b);
            const n = sorted.length;
            const total = sum(sorted);
            const mu = total / n;
            // ── Gini coefficient ──
            // Gini = (2 * sum(i * x_i) - (n+1) * sum(x_i)) / (n * sum(x_i))
            let giniNum = 0;
            for (let i = 0; i < n; i++) {
                giniNum += (2 * (i + 1) - n - 1) * sorted[i];
            }
            const gini = total > 0 ? giniNum / (n * total) : 0;
            // ── Lorenz curve data ──
            const lorenz = [{ pop_pct: 0, income_pct: 0 }];
            let cumIncome = 0;
            const decileSize = Math.floor(n / 10);
            for (let i = 0; i < n; i++) {
                cumIncome += sorted[i];
                if ((i + 1) % Math.max(1, Math.floor(n / 10)) === 0 || i === n - 1) {
                    lorenz.push({
                        pop_pct: ((i + 1) / n) * 100,
                        income_pct: (cumIncome / total) * 100,
                    });
                }
            }
            // ── Theil index (GE(1)) ──
            // T = (1/n) * sum((x_i / mu) * ln(x_i / mu))
            let theil = 0;
            for (const x of sorted) {
                if (x > 0 && mu > 0) {
                    theil += (x / mu) * Math.log(x / mu);
                }
            }
            theil /= n;
            // ── Atkinson index (epsilon = 0.5 and 1) ──
            // A(e) = 1 - (1/mu) * [(1/n) * sum(x_i^(1-e))]^(1/(1-e))
            // For e=1: A(1) = 1 - (prod(x_i))^(1/n) / mu
            const positiveOnly = sorted.filter(x => x > 0);
            let atkinson05 = 0;
            let atkinson1 = 0;
            if (positiveOnly.length > 0 && mu > 0) {
                const sumPow = positiveOnly.reduce((s, x) => s + Math.sqrt(x), 0) / positiveOnly.length;
                atkinson05 = 1 - (sumPow * sumPow) / mu;
                const logSum = positiveOnly.reduce((s, x) => s + Math.log(x), 0) / positiveOnly.length;
                const geoMean = Math.exp(logSum);
                atkinson1 = 1 - geoMean / mu;
            }
            // ── Decile shares ──
            const decileShares = [];
            for (let d = 0; d < 10; d++) {
                const start = Math.floor(d * n / 10);
                const end = Math.floor((d + 1) * n / 10);
                const decileSum = sum(sorted.slice(start, end));
                decileShares.push(total > 0 ? (decileSum / total) * 100 : 0);
            }
            // Palma ratio: top 10% / bottom 40%
            const bottom40 = sum(sorted.slice(0, Math.floor(n * 0.4)));
            const top10 = sum(sorted.slice(Math.floor(n * 0.9)));
            const palmaRatio = bottom40 > 0 ? top10 / bottom40 : Infinity;
            // 90/10 ratio
            const p90 = percentile(sorted, 90);
            const p10 = percentile(sorted, 10);
            const ratio9010 = p10 > 0 ? p90 / p10 : Infinity;
            const lines = [
                `# Inequality Analysis`,
                '',
                `## Summary Statistics`,
                `| Statistic | Value |`,
                `|-----------|-------|`,
                `| N | ${n} |`,
                `| Mean | ${fmt(mu, 2)} |`,
                `| Median | ${fmt(median(sorted), 2)} |`,
                `| Min | ${fmt(sorted[0], 2)} |`,
                `| Max | ${fmt(sorted[n - 1], 2)} |`,
                `| Std Dev | ${fmt(stddev(sorted), 2)} |`,
                '',
                `## Inequality Measures`,
                `| Measure | Value | Interpretation |`,
                `|---------|-------|----------------|`,
                `| Gini coefficient | ${fmt(gini)} | ${gini < 0.3 ? 'Low inequality' : gini < 0.4 ? 'Moderate inequality' : gini < 0.5 ? 'High inequality' : 'Very high inequality'} |`,
                `| Theil index (GE1) | ${fmt(theil)} | ${theil < 0.2 ? 'Low' : theil < 0.5 ? 'Moderate' : 'High'} inequality |`,
                `| Atkinson (e=0.5) | ${fmt(atkinson05)} | ${fmt(atkinson05 * 100, 1)}% welfare loss from inequality |`,
                `| Atkinson (e=1.0) | ${fmt(atkinson1)} | ${fmt(atkinson1 * 100, 1)}% welfare loss from inequality |`,
                `| Palma ratio | ${isFinite(palmaRatio) ? fmt(palmaRatio) : 'N/A'} | Top 10% / Bottom 40% income share |`,
                `| 90/10 ratio | ${isFinite(ratio9010) ? fmt(ratio9010) : 'N/A'} | 90th / 10th percentile |`,
                '',
                `## Decile Income Shares`,
                `| Decile | Share (%) | Cumulative (%) |`,
                `|--------|----------|----------------|`,
            ];
            let cumShare = 0;
            for (let d = 0; d < 10; d++) {
                cumShare += decileShares[d];
                const label = d === 0 ? 'Bottom 10%' : d === 9 ? 'Top 10%' : `${d * 10 + 1}-${(d + 1) * 10}%`;
                lines.push(`| ${label} | ${fmt(decileShares[d], 1)} | ${fmt(cumShare, 1)} |`);
            }
            lines.push('');
            // Lorenz curve data
            lines.push(`## Lorenz Curve Data`, `| Population % | Income % |`, `|-------------|----------|`, ...lorenz.map(p => `| ${fmt(p.pop_pct, 1)} | ${fmt(p.income_pct, 1)} |`), '');
            // Poverty measures
            if (povertyLine !== undefined) {
                const poor = sorted.filter(x => x < povertyLine);
                const headcountRatio = poor.length / n;
                const povertyGap = poor.length > 0
                    ? poor.reduce((s, x) => s + (povertyLine - x) / povertyLine, 0) / n
                    : 0;
                const povertyGapSq = poor.length > 0
                    ? poor.reduce((s, x) => s + ((povertyLine - x) / povertyLine) ** 2, 0) / n
                    : 0;
                lines.push(`## Poverty Measures (line = ${povertyLine})`, `| Measure | Value |`, `|---------|-------|`, `| Headcount ratio (FGT0) | ${fmt(headcountRatio)} (${poor.length} of ${n}) |`, `| Poverty gap (FGT1) | ${fmt(povertyGap)} |`, `| Squared poverty gap (FGT2) | ${fmt(povertyGapSq)} |`, '');
            }
            return lines.join('\n');
        },
    });
    // ── 7. Survey Design ───────────────────────────────────────────────────
    registerTool({
        name: 'survey_design',
        description: 'Generate survey methodology: sample size calculations for proportions and means, margin of error, design effect for cluster sampling, stratification guidance, and response rate adjustment. Provides formulas and recommendations.',
        parameters: {
            population_size: { type: 'number', description: 'Total population size', required: true },
            confidence_level: { type: 'number', description: 'Confidence level (e.g. 0.95 for 95%). Default 0.95' },
            margin_of_error: { type: 'number', description: 'Desired margin of error (e.g. 0.05 for 5%). Default 0.05' },
            expected_proportion: { type: 'number', description: 'Expected proportion for key variable (default 0.5 for maximum variance)' },
            design_type: { type: 'string', description: 'Sampling design: simple_random, stratified, cluster (default: simple_random)' },
        },
        tier: 'free',
        async execute(args) {
            const N = Number(args.population_size);
            const confLevel = args.confidence_level !== undefined ? Number(args.confidence_level) : 0.95;
            const moe = args.margin_of_error !== undefined ? Number(args.margin_of_error) : 0.05;
            const p = args.expected_proportion !== undefined ? Number(args.expected_proportion) : 0.5;
            const designType = (args.design_type ? String(args.design_type) : 'simple_random').toLowerCase().trim();
            if (N <= 0)
                return '**Error**: Population size must be positive.';
            if (confLevel <= 0 || confLevel >= 1)
                return '**Error**: Confidence level must be between 0 and 1.';
            if (moe <= 0 || moe >= 1)
                return '**Error**: Margin of error must be between 0 and 1.';
            // Z-score for confidence level
            const alpha = 1 - confLevel;
            const z = normalInv(1 - alpha / 2);
            // ── Sample size for proportion (infinite population) ──
            const n0_prop = (z * z * p * (1 - p)) / (moe * moe);
            // Finite population correction
            const n_prop = Math.ceil(n0_prop / (1 + (n0_prop - 1) / N));
            // ── Sample size for mean (assuming sigma = 0.5 * range, generic) ──
            // For means: n0 = (z * sigma / moe)^2
            // We'll estimate sigma from the proportion-based approach
            const sigmaEstimate = 0.5; // normalized assumption
            const n0_mean = (z * sigmaEstimate / moe) ** 2;
            const n_mean = Math.ceil(n0_mean / (1 + (n0_mean - 1) / N));
            // ── Design effect ──
            let deff = 1;
            let adjustedN = n_prop;
            let designNotes = [];
            switch (designType) {
                case 'cluster': {
                    // Typical DEFF for cluster sampling: 1 + (m-1) * rho
                    // Assume average cluster size m=20, ICC rho=0.05
                    const m = 20; // avg cluster size
                    const rho = 0.05; // intraclass correlation
                    deff = 1 + (m - 1) * rho;
                    adjustedN = Math.ceil(n_prop * deff);
                    designNotes = [
                        `Design effect (DEFF) = ${fmt(deff)} (assuming avg cluster size = ${m}, ICC = ${rho})`,
                        `Adjusted sample size = ${adjustedN}`,
                        `Number of clusters needed = ${Math.ceil(adjustedN / m)} (at ${m} per cluster)`,
                        '',
                        '**Key considerations**:',
                        '- Larger clusters or higher ICC increases DEFF',
                        '- DEFF > 2.0 suggests reconsidering cluster size',
                        '- Calculate ICC from pilot data when possible',
                        '- Equal-sized clusters are ideal but rarely achievable',
                    ];
                    break;
                }
                case 'stratified': {
                    // Stratified sampling generally reduces variance → DEFF < 1
                    deff = 0.8; // typical improvement
                    adjustedN = Math.ceil(n_prop * deff);
                    designNotes = [
                        `Design effect (DEFF) ~ ${fmt(deff)} (stratification typically improves precision)`,
                        `Adjusted sample size = ${adjustedN}`,
                        '',
                        '**Stratification guidance**:',
                        '- Choose strata correlated with outcome variable',
                        '- Proportional allocation: n_h = n * (N_h / N)',
                        '- Optimal allocation: n_h = n * (N_h * sigma_h) / sum(N_h * sigma_h)',
                        '- Neyman allocation maximizes precision for fixed total n',
                        '- Minimum ~30 observations per stratum for stable estimates',
                        '- 3-6 strata typically sufficient; diminishing returns beyond',
                    ];
                    break;
                }
                default: {
                    deff = 1;
                    adjustedN = n_prop;
                    designNotes = [
                        'Simple random sampling: every unit has equal probability of selection.',
                        'DEFF = 1.0 (baseline reference for other designs).',
                    ];
                }
            }
            // Response rate adjustment
            const responseRates = [0.9, 0.7, 0.5, 0.3];
            const adjustedSizes = responseRates.map(rr => ({
                rate: rr,
                invites: Math.ceil(adjustedN / rr),
            }));
            const lines = [
                `# Survey Design Calculator`,
                '',
                `## Parameters`,
                `| Parameter | Value |`,
                `|-----------|-------|`,
                `| Population size (N) | ${N.toLocaleString()} |`,
                `| Confidence level | ${(confLevel * 100).toFixed(1)}% (z = ${fmt(z)}) |`,
                `| Margin of error | ${(moe * 100).toFixed(1)}% |`,
                `| Expected proportion | ${p} |`,
                `| Design type | ${designType.replace('_', ' ')} |`,
                '',
                `## Sample Size (Proportions)`,
                `| Step | Value |`,
                `|------|-------|`,
                `| n0 (infinite pop) | ${Math.ceil(n0_prop)} |`,
                `| n (FPC adjusted) | ${n_prop} |`,
                `| Design effect | ${fmt(deff)} |`,
                `| **Final sample size** | **${adjustedN}** |`,
                '',
                `**Formula**: n0 = z^2 * p(1-p) / E^2 = ${fmt(z)}^2 * ${p}*${fmt(1 - p)} / ${moe}^2 = ${Math.ceil(n0_prop)}`,
                `**FPC**: n = n0 / (1 + (n0-1)/N) = ${n_prop}`,
                '',
                `## Sample Size (Means)`,
                `Assuming sigma = ${sigmaEstimate}: n = ${n_mean} (FPC adjusted)`,
                '',
                `## ${designType.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())} Design Notes`,
                ...designNotes,
                '',
                `## Response Rate Adjustment`,
                `| Expected Response Rate | Invitations Needed |`,
                `|----------------------|-------------------|`,
                ...adjustedSizes.map(a => `| ${(a.rate * 100).toFixed(0)}% | ${a.invites.toLocaleString()} |`),
                '',
                `## Margin of Error Sensitivity`,
                `| MoE | Required n (no DEFF) |`,
                `|----|---------------------|`,
                ...[0.01, 0.02, 0.03, 0.05, 0.07, 0.10].map(e => {
                    const n0 = (z * z * p * (1 - p)) / (e * e);
                    const nAdj = Math.ceil(n0 / (1 + (n0 - 1) / N));
                    return `| ${(e * 100).toFixed(0)}% | ${nAdj.toLocaleString()} |`;
                }),
                '',
                `## Practical Recommendations`,
                `- Pilot test with 30-50 respondents before full deployment`,
                `- Pre-register analysis plan to avoid p-hacking`,
                `- Use balanced incomplete block designs for long surveys`,
                `- Include attention checks every 20-30 items`,
                `- Target median completion time < 15 minutes for web surveys`,
                `- Offer incentives proportional to survey length`,
            ];
            return lines.join('\n');
        },
    });
    // ── 8. Demographic Model ───────────────────────────────────────────────
    registerTool({
        name: 'demographic_model',
        description: 'Population projection using the cohort-component method. Takes age-specific fertility rates, mortality rates, and optional migration. Projects population forward N years with summary statistics including dependency ratios and growth rates.',
        parameters: {
            population: { type: 'string', description: 'JSON array of {age_group: string, count: number, fertility_rate: number, mortality_rate: number} objects', required: true },
            years_forward: { type: 'number', description: 'Number of years to project forward (default 10)' },
            migration_rate: { type: 'number', description: 'Net migration rate as fraction of population per year (default 0)' },
        },
        tier: 'free',
        async execute(args) {
            const cohorts = JSON.parse(String(args.population));
            const yearsForward = args.years_forward !== undefined ? Number(args.years_forward) : 10;
            const migrationRate = args.migration_rate !== undefined ? Number(args.migration_rate) : 0;
            if (cohorts.length === 0)
                return '**Error**: No population data provided.';
            // Parse age groups to determine interval width
            // Assume 5-year age groups by default, or detect from labels
            const ageWidth = 5; // standard 5-year groups
            let currentPop = cohorts.map(c => ({
                label: c.age_group,
                count: c.count,
                fertilityRate: c.fertility_rate,
                mortalityRate: c.mortality_rate,
            }));
            const totalInitial = sum(currentPop.map(c => c.count));
            const projections = [
                { year: 0, total: totalInitial, cohorts: currentPop.map(c => ({ ...c })) },
            ];
            // Project forward
            for (let year = 1; year <= yearsForward; year++) {
                const newPop = [];
                // Calculate births (from all fertile cohorts)
                let totalBirths = 0;
                for (const cohort of currentPop) {
                    // Fertility rate applied to women (approximate: half the cohort)
                    // Births over the interval = count/2 * fertility_rate * age_width
                    totalBirths += (cohort.count / 2) * cohort.fertilityRate * ageWidth;
                }
                // New born cohort (0-4)
                const infantMortality = currentPop.length > 0 ? currentPop[0].mortalityRate : 0.01;
                const survivingBirths = totalBirths * (1 - infantMortality * ageWidth);
                newPop.push({
                    label: currentPop[0]?.label || '0-4',
                    count: Math.max(0, survivingBirths),
                    fertilityRate: 0, // newborns not fertile
                    mortalityRate: infantMortality,
                });
                // Age each cohort forward
                for (let i = 0; i < currentPop.length; i++) {
                    const cohort = currentPop[i];
                    // Survivors = count * (1 - mortality_rate)^ageWidth
                    const survivalRate = Math.pow(1 - cohort.mortalityRate, ageWidth);
                    const survivors = cohort.count * survivalRate;
                    // Apply migration
                    const migrants = cohort.count * migrationRate * ageWidth;
                    if (i + 1 < currentPop.length) {
                        // Move to next age group
                        newPop.push({
                            label: currentPop[i + 1].label,
                            count: Math.max(0, survivors + migrants),
                            fertilityRate: currentPop[i + 1].fertilityRate,
                            mortalityRate: currentPop[i + 1].mortalityRate,
                        });
                    }
                    else {
                        // Terminal age group (open-ended, e.g. 80+)
                        newPop.push({
                            label: cohort.label,
                            count: Math.max(0, survivors * 0.5 + migrants), // attenuate terminal group
                            fertilityRate: 0,
                            mortalityRate: cohort.mortalityRate,
                        });
                    }
                }
                const yearTotal = sum(newPop.map(c => c.count));
                projections.push({ year, total: yearTotal, cohorts: newPop.map(c => ({ ...c })) });
                currentPop = newPop;
            }
            // Calculate demographic indicators
            const indicators = projections.map(proj => {
                const total = proj.total;
                // Assume: young = first 3 groups (0-14), working = groups 3-12 (15-64), elderly = 13+ (65+)
                const nGroups = proj.cohorts.length;
                const youngIdx = Math.min(3, nGroups);
                const elderlyIdx = Math.min(13, nGroups);
                const young = sum(proj.cohorts.slice(0, youngIdx).map(c => c.count));
                const working = sum(proj.cohorts.slice(youngIdx, elderlyIdx).map(c => c.count));
                const elderly = sum(proj.cohorts.slice(elderlyIdx).map(c => c.count));
                const dependencyRatio = working > 0 ? ((young + elderly) / working) * 100 : 0;
                const youthDep = working > 0 ? (young / working) * 100 : 0;
                const elderDep = working > 0 ? (elderly / working) * 100 : 0;
                return {
                    year: proj.year,
                    total,
                    young,
                    working,
                    elderly,
                    dependencyRatio,
                    youthDep,
                    elderDep,
                };
            });
            // Growth rates
            const growthRates = indicators.map((ind, i) => {
                if (i === 0)
                    return 0;
                return indicators[i - 1].total > 0
                    ? ((ind.total - indicators[i - 1].total) / indicators[i - 1].total) * 100
                    : 0;
            });
            // TFR (total fertility rate)
            const tfr = sum(cohorts.map(c => c.fertility_rate)) * ageWidth;
            const lines = [
                `# Population Projection (Cohort-Component Method)`,
                '',
                `## Initial Parameters`,
                `| Parameter | Value |`,
                `|-----------|-------|`,
                `| Initial population | ${Math.round(totalInitial).toLocaleString()} |`,
                `| Age groups | ${cohorts.length} |`,
                `| Projection period | ${yearsForward} years |`,
                `| Net migration rate | ${(migrationRate * 100).toFixed(2)}% per year |`,
                `| Total Fertility Rate | ${fmt(tfr)} |`,
                '',
                `## Population Trajectory`,
                `| Year | Total | Growth Rate | Young (0-14) | Working (15-64) | Elderly (65+) | Dep. Ratio |`,
                `|------|-------|-------------|-------------|-----------------|---------------|-----------|`,
                ...indicators.map((ind, i) => `| ${ind.year} | ${Math.round(ind.total).toLocaleString()} | ${i === 0 ? '-' : fmt(growthRates[i], 2) + '%'} | ${Math.round(ind.young).toLocaleString()} | ${Math.round(ind.working).toLocaleString()} | ${Math.round(ind.elderly).toLocaleString()} | ${fmt(ind.dependencyRatio, 1)}% |`),
                '',
            ];
            // Summary comparison
            const first = indicators[0];
            const last = indicators[indicators.length - 1];
            const totalGrowth = first.total > 0 ? ((last.total - first.total) / first.total) * 100 : 0;
            lines.push(`## Projection Summary`, `| Indicator | Year 0 | Year ${yearsForward} | Change |`, `|-----------|--------|--------|--------|`, `| Total population | ${Math.round(first.total).toLocaleString()} | ${Math.round(last.total).toLocaleString()} | ${totalGrowth >= 0 ? '+' : ''}${fmt(totalGrowth, 1)}% |`, `| Dependency ratio | ${fmt(first.dependencyRatio, 1)}% | ${fmt(last.dependencyRatio, 1)}% | ${fmt(last.dependencyRatio - first.dependencyRatio, 1)}pp |`, `| Youth dependency | ${fmt(first.youthDep, 1)}% | ${fmt(last.youthDep, 1)}% | ${fmt(last.youthDep - first.youthDep, 1)}pp |`, `| Elderly dependency | ${fmt(first.elderDep, 1)}% | ${fmt(last.elderDep, 1)}% | ${fmt(last.elderDep - first.elderDep, 1)}pp |`, '');
            // Age structure at final year
            const finalCohorts = projections[projections.length - 1].cohorts;
            lines.push(`## Final Age Structure (Year ${yearsForward})`, `| Age Group | Count | Share |`, `|-----------|-------|-------|`, ...finalCohorts.map(c => `| ${c.label} | ${Math.round(c.count).toLocaleString()} | ${last.total > 0 ? fmt((c.count / last.total) * 100, 1) : '0'}% |`), '');
            return lines.join('\n');
        },
    });
    // ── 9. Sentiment Analysis ──────────────────────────────────────────────
    registerTool({
        name: 'sentiment_analyze',
        description: 'Rule-based sentiment analysis (VADER-like). Scores text on positive/negative/neutral/compound dimensions. Handles negation, degree modifiers, punctuation emphasis, capitalization boost, and contrastive conjunctions. Works on single texts or arrays of texts. Embeds a ~500 word sentiment lexicon.',
        parameters: {
            text: { type: 'string', description: 'Text to analyze, or JSON array of strings for batch analysis', required: true },
            method: { type: 'string', description: 'Analysis method: vader (full features) or simple (word matching only). Default: vader' },
        },
        tier: 'free',
        async execute(args) {
            const rawText = String(args.text);
            const method = (args.method ? String(args.method) : 'vader').toLowerCase().trim();
            // Try parsing as JSON array
            let texts;
            try {
                const parsed = JSON.parse(rawText);
                texts = Array.isArray(parsed) ? parsed.map(String) : [rawText];
            }
            catch {
                texts = [rawText];
            }
            function analyzeOne(text) {
                const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
                if (sentences.length === 0) {
                    return { compound: 0, positive: 0, negative: 0, neutral: 0, wordScores: [] };
                }
                let allScores = [];
                const wordScores = [];
                for (const sentence of sentences) {
                    const words = sentence.toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter(w => w.length > 0);
                    const isAllCaps = sentence === sentence.toUpperCase() && sentence !== sentence.toLowerCase();
                    for (let i = 0; i < words.length; i++) {
                        const word = words[i];
                        let score = SENTIMENT_LEXICON[word];
                        if (score === undefined)
                            continue;
                        if (method === 'vader') {
                            // Check for negation in previous 3 words
                            let negated = false;
                            for (let j = Math.max(0, i - 3); j < i; j++) {
                                if (NEGATION_WORDS.has(words[j])) {
                                    negated = true;
                                    break;
                                }
                            }
                            if (negated)
                                score *= -0.74; // VADER uses ~0.74 damping
                            // Check for degree modifiers in previous 2 words
                            for (let j = Math.max(0, i - 2); j < i; j++) {
                                const mod = DEGREE_MODIFIERS[words[j]];
                                if (mod !== undefined) {
                                    score *= mod;
                                    break;
                                }
                            }
                            // Capitalization boost
                            if (isAllCaps) {
                                score *= 1.15;
                            }
                        }
                        // Exclamation marks amplify
                        const excl = (sentence.match(/!/g) || []).length;
                        if (excl > 0 && method === 'vader') {
                            score += Math.sign(score) * Math.min(excl, 4) * 0.292;
                        }
                        allScores.push(score);
                        wordScores.push({ word, score });
                    }
                }
                if (allScores.length === 0) {
                    return { compound: 0, positive: 0, negative: 0, neutral: 0, wordScores: [] };
                }
                // Compound score: normalized sum
                const rawSum = sum(allScores);
                const compound = rawSum / Math.sqrt(rawSum * rawSum + 15); // VADER normalization constant ~15
                // Proportion scores
                const posSum = sum(allScores.filter(s => s > 0));
                const negSum = Math.abs(sum(allScores.filter(s => s < 0)));
                const neuCount = allScores.filter(s => s === 0).length;
                const totalMag = posSum + negSum + neuCount;
                const positive = totalMag > 0 ? posSum / totalMag : 0;
                const negative = totalMag > 0 ? negSum / totalMag : 0;
                const neutral = totalMag > 0 ? neuCount / totalMag : 0;
                return { compound, positive, negative, neutral, wordScores };
            }
            const results = texts.map(t => ({ text: t, ...analyzeOne(t) }));
            const lines = [`# Sentiment Analysis (${method.toUpperCase()})`, ''];
            if (results.length === 1) {
                const r = results[0];
                let sentiment;
                if (r.compound >= 0.05)
                    sentiment = 'Positive';
                else if (r.compound <= -0.05)
                    sentiment = 'Negative';
                else
                    sentiment = 'Neutral';
                lines.push(`## Result: **${sentiment}**`, '', `| Dimension | Score |`, `|-----------|-------|`, `| Compound | ${fmt(r.compound)} |`, `| Positive | ${fmt(r.positive)} |`, `| Negative | ${fmt(r.negative)} |`, `| Neutral | ${fmt(r.neutral)} |`, '');
                if (r.wordScores.length > 0) {
                    lines.push(`## Word-Level Scores`, `| Word | Score |`, `|------|-------|`, ...r.wordScores.map(ws => `| ${ws.word} | ${fmt(ws.score)} |`), '');
                }
            }
            else {
                // Batch mode
                lines.push(`## Batch Results (${results.length} texts)`, '', `| # | Text (truncated) | Compound | Sentiment |`, `|---|-----------------|----------|-----------|`, ...results.map((r, i) => {
                    const trunc = r.text.length > 50 ? r.text.slice(0, 50) + '...' : r.text;
                    const sent = r.compound >= 0.05 ? 'Positive' : r.compound <= -0.05 ? 'Negative' : 'Neutral';
                    return `| ${i + 1} | ${trunc.replace(/\|/g, '/')} | ${fmt(r.compound)} | ${sent} |`;
                }), '');
                // Aggregate stats
                const compounds = results.map(r => r.compound);
                const posCount = compounds.filter(c => c >= 0.05).length;
                const negCount = compounds.filter(c => c <= -0.05).length;
                const neuCount = compounds.filter(c => c > -0.05 && c < 0.05).length;
                lines.push(`## Aggregate`, `| Metric | Value |`, `|--------|-------|`, `| Mean compound | ${fmt(mean(compounds))} |`, `| Median compound | ${fmt(median(compounds))} |`, `| SD compound | ${fmt(stddev(compounds))} |`, `| Positive texts | ${posCount} (${fmt(100 * posCount / results.length, 1)}%) |`, `| Negative texts | ${negCount} (${fmt(100 * negCount / results.length, 1)}%) |`, `| Neutral texts | ${neuCount} (${fmt(100 * neuCount / results.length, 1)}%) |`, '');
            }
            lines.push(`## Methodology`, `- Lexicon: ~500 words with human-rated valence scores (-3.5 to +3.5)`, `- Negation detection: flips polarity within 3-word window (damping factor: 0.74)`, `- Degree modifiers: amplify/dampen based on intensifier/downtoner words`, `- Compound score: sum / sqrt(sum^2 + alpha), where alpha = 15`, `- Thresholds: compound >= 0.05 = positive, <= -0.05 = negative, else neutral`);
            return lines.join('\n');
        },
    });
    // ── 10. Voting System Analysis ─────────────────────────────────────────
    registerTool({
        name: 'voting_system',
        description: 'Analyze elections under multiple voting systems. Given ranked preference ballots, compute results under: plurality (first-past-the-post), runoff (top-two), instant-runoff (IRV/RCV), Borda count, Condorcet (pairwise majority), and approval voting. Shows how different systems produce different winners.',
        parameters: {
            ballots: { type: 'string', description: 'JSON array of ranked preference arrays, e.g. [["A","B","C"],["B","A","C"]]', required: true },
            candidates: { type: 'string', description: 'Comma-separated candidate names', required: true },
            systems: { type: 'string', description: 'Which systems: all, plurality, irv, borda, condorcet, approval (default: all)' },
        },
        tier: 'free',
        async execute(args) {
            const ballots = JSON.parse(String(args.ballots));
            const candidateList = String(args.candidates).split(',').map(s => s.trim());
            const systems = (args.systems ? String(args.systems) : 'all').toLowerCase().trim();
            const nVoters = ballots.length;
            const nCandidates = candidateList.length;
            if (nVoters === 0)
                return '**Error**: No ballots provided.';
            if (nCandidates < 2)
                return '**Error**: Need at least 2 candidates.';
            const showAll = systems === 'all';
            const lines = [
                `# Election Analysis`,
                '',
                `- **Voters**: ${nVoters}`,
                `- **Candidates**: ${candidateList.join(', ')}`,
                '',
            ];
            const winners = [];
            // ── Plurality ──
            if (showAll || systems === 'plurality') {
                const counts = new Map();
                candidateList.forEach(c => counts.set(c, 0));
                for (const ballot of ballots) {
                    if (ballot.length > 0 && counts.has(ballot[0])) {
                        counts.set(ballot[0], counts.get(ballot[0]) + 1);
                    }
                }
                const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
                const winner = sorted[0][0];
                winners.push({ system: 'Plurality', winner });
                lines.push(`## Plurality (First-Past-the-Post)`, `| Candidate | Votes | Share |`, `|-----------|-------|-------|`, ...sorted.map(([c, v]) => `| ${c} | ${v} | ${fmt(100 * v / nVoters, 1)}% |`), '', `**Winner**: ${winner} (${sorted[0][1]} votes, ${fmt(100 * sorted[0][1] / nVoters, 1)}%)`, sorted[0][1] <= nVoters / 2 ? `> Note: Winner has only a plurality, not a majority.` : '', '');
            }
            // ── Runoff (top-two) ──
            if (showAll || systems === 'runoff') {
                const round1 = new Map();
                candidateList.forEach(c => round1.set(c, 0));
                for (const ballot of ballots) {
                    if (ballot.length > 0 && round1.has(ballot[0])) {
                        round1.set(ballot[0], round1.get(ballot[0]) + 1);
                    }
                }
                const sorted1 = [...round1.entries()].sort((a, b) => b[1] - a[1]);
                // Check if first-round majority
                if (sorted1[0][1] > nVoters / 2) {
                    winners.push({ system: 'Runoff', winner: sorted1[0][0] });
                    lines.push(`## Top-Two Runoff`, `First-round majority: **${sorted1[0][0]}** wins outright.`, '');
                }
                else {
                    const top2 = [sorted1[0][0], sorted1[1][0]];
                    const round2 = new Map();
                    top2.forEach(c => round2.set(c, 0));
                    for (const ballot of ballots) {
                        for (const choice of ballot) {
                            if (top2.includes(choice)) {
                                round2.set(choice, round2.get(choice) + 1);
                                break;
                            }
                        }
                    }
                    const sorted2 = [...round2.entries()].sort((a, b) => b[1] - a[1]);
                    const winner = sorted2[0][0];
                    winners.push({ system: 'Runoff', winner });
                    lines.push(`## Top-Two Runoff`, `**Round 1**: ${sorted1.map(([c, v]) => `${c}=${v}`).join(', ')}`, `**Round 2** (${top2.join(' vs ')}): ${sorted2.map(([c, v]) => `${c}=${v}`).join(', ')}`, `**Winner**: ${winner}`, '');
                }
            }
            // ── Instant-Runoff Voting (IRV) ──
            if (showAll || systems === 'irv') {
                let remaining = new Set(candidateList);
                let currentBallots = ballots.map(b => [...b]);
                const rounds = [];
                let irvWinner = null;
                let round = 1;
                while (remaining.size > 1) {
                    const counts = new Map();
                    remaining.forEach(c => counts.set(c, 0));
                    for (const ballot of currentBallots) {
                        for (const choice of ballot) {
                            if (remaining.has(choice)) {
                                counts.set(choice, counts.get(choice) + 1);
                                break;
                            }
                        }
                    }
                    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
                    // Check majority
                    if (sorted[0][1] > nVoters / 2) {
                        irvWinner = sorted[0][0];
                        rounds.push({ round, counts });
                        break;
                    }
                    // Eliminate candidate with fewest votes
                    const minVotes = sorted[sorted.length - 1][1];
                    const toEliminate = sorted.filter(([_, v]) => v === minVotes).map(([c]) => c);
                    const eliminated = toEliminate[toEliminate.length - 1]; // eliminate last alphabetically if tie
                    rounds.push({ round, counts, eliminated });
                    remaining.delete(eliminated);
                    round++;
                    if (remaining.size === 1) {
                        irvWinner = [...remaining][0];
                    }
                }
                if (!irvWinner && remaining.size === 1)
                    irvWinner = [...remaining][0];
                if (irvWinner)
                    winners.push({ system: 'IRV', winner: irvWinner });
                lines.push(`## Instant-Runoff Voting (IRV)`);
                for (const r of rounds) {
                    const sorted = [...r.counts.entries()].sort((a, b) => b[1] - a[1]);
                    lines.push(`**Round ${r.round}**: ${sorted.map(([c, v]) => `${c}=${v}`).join(', ')}` +
                        (r.eliminated ? ` → Eliminate ${r.eliminated}` : ''));
                }
                lines.push(`**Winner**: ${irvWinner || 'None'}`, '');
            }
            // ── Borda Count ──
            if (showAll || systems === 'borda') {
                const scores = new Map();
                candidateList.forEach(c => scores.set(c, 0));
                for (const ballot of ballots) {
                    for (let i = 0; i < ballot.length; i++) {
                        if (scores.has(ballot[i])) {
                            // Borda: n-1 points for 1st, n-2 for 2nd, etc.
                            scores.set(ballot[i], scores.get(ballot[i]) + (nCandidates - 1 - i));
                        }
                    }
                }
                const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
                const winner = sorted[0][0];
                winners.push({ system: 'Borda Count', winner });
                lines.push(`## Borda Count`, `| Candidate | Points | Avg Rank |`, `|-----------|--------|----------|`, ...sorted.map(([c, pts]) => `| ${c} | ${pts} | ${fmt(nCandidates - pts / nVoters, 2)} |`), '', `**Winner**: ${winner} (${sorted[0][1]} points)`, '');
            }
            // ── Condorcet ──
            if (showAll || systems === 'condorcet') {
                // Pairwise comparison matrix
                const pairwise = new Map();
                candidateList.forEach(c => {
                    pairwise.set(c, new Map());
                    candidateList.forEach(d => pairwise.get(c).set(d, 0));
                });
                for (const ballot of ballots) {
                    for (let i = 0; i < ballot.length; i++) {
                        for (let j = i + 1; j < ballot.length; j++) {
                            if (pairwise.has(ballot[i]) && pairwise.get(ballot[i]).has(ballot[j])) {
                                pairwise.get(ballot[i]).set(ballot[j], pairwise.get(ballot[i]).get(ballot[j]) + 1);
                            }
                        }
                    }
                }
                // Find Condorcet winner: beats all others in pairwise
                let condorcetWinner = null;
                for (const c of candidateList) {
                    let beatsAll = true;
                    for (const d of candidateList) {
                        if (c === d)
                            continue;
                        const cVsD = pairwise.get(c).get(d);
                        const dVsC = pairwise.get(d).get(c);
                        if (cVsD <= dVsC) {
                            beatsAll = false;
                            break;
                        }
                    }
                    if (beatsAll) {
                        condorcetWinner = c;
                        break;
                    }
                }
                if (condorcetWinner)
                    winners.push({ system: 'Condorcet', winner: condorcetWinner });
                lines.push(`## Condorcet (Pairwise Majority)`, `### Pairwise Matrix (row beats column by N votes)`, `| | ${candidateList.join(' | ')} |`, `|${'-|'.repeat(nCandidates + 1)}`, ...candidateList.map(c => `| **${c}** | ${candidateList.map(d => c === d ? '-' : `${pairwise.get(c).get(d)}`).join(' | ')} |`), '', condorcetWinner
                    ? `**Condorcet winner**: ${condorcetWinner} (beats all others head-to-head)`
                    : `**No Condorcet winner** (cycle detected — Condorcet paradox)`, '');
            }
            // ── Approval Voting ──
            if (showAll || systems === 'approval') {
                // Approval: each voter "approves" top ceil(n/2) candidates from their ranking
                const approveCount = Math.ceil(nCandidates / 2);
                const approvals = new Map();
                candidateList.forEach(c => approvals.set(c, 0));
                for (const ballot of ballots) {
                    for (let i = 0; i < Math.min(approveCount, ballot.length); i++) {
                        if (approvals.has(ballot[i])) {
                            approvals.set(ballot[i], approvals.get(ballot[i]) + 1);
                        }
                    }
                }
                const sorted = [...approvals.entries()].sort((a, b) => b[1] - a[1]);
                const winner = sorted[0][0];
                winners.push({ system: 'Approval', winner });
                lines.push(`## Approval Voting`, `> Each voter approves top ${approveCount} of ${nCandidates} candidates.`, '', `| Candidate | Approvals | Rate |`, `|-----------|-----------|------|`, ...sorted.map(([c, v]) => `| ${c} | ${v} | ${fmt(100 * v / nVoters, 1)}% |`), '', `**Winner**: ${winner} (${sorted[0][1]} approvals)`, '');
            }
            // ── Comparison ──
            if (winners.length > 1) {
                const uniqueWinners = [...new Set(winners.map(w => w.winner))];
                lines.push(`## System Comparison`, `| System | Winner |`, `|--------|--------|`, ...winners.map(w => `| ${w.system} | ${w.winner} |`), '');
                if (uniqueWinners.length === 1) {
                    lines.push(`All systems agree: **${uniqueWinners[0]}** wins under every method.`);
                }
                else {
                    lines.push(`**Different systems produce different winners!**`, `This demonstrates Arrow's impossibility theorem in practice:`, `no ranked voting system can satisfy all fairness criteria simultaneously.`);
                }
            }
            return lines.join('\n');
        },
    });
    // ── 11. Behavioral Experiment Design ───────────────────────────────────
    registerTool({
        name: 'experiment_behavioral',
        description: 'Design behavioral and social science experiments. Generates between/within/mixed/quasi-experimental designs with counterbalancing schemes (Latin square), randomization procedures, manipulation checks, demand characteristics mitigation, power analysis, and IRB consideration checklist.',
        parameters: {
            research_question: { type: 'string', description: 'The research question to investigate', required: true },
            design_type: { type: 'string', description: 'Design: between, within, mixed, quasi', required: true },
            conditions: { type: 'number', description: 'Number of experimental conditions', required: true },
            participants_per_condition: { type: 'number', description: 'Planned participants per condition (default: 30)' },
        },
        tier: 'free',
        async execute(args) {
            const rq = String(args.research_question);
            const design = String(args.design_type).toLowerCase().trim();
            const nConditions = Number(args.conditions);
            const nPerCondition = args.participants_per_condition ? Number(args.participants_per_condition) : 30;
            if (nConditions < 2)
                return '**Error**: Need at least 2 conditions.';
            const condLabels = Array.from({ length: nConditions }, (_, i) => `Condition ${String.fromCharCode(65 + i)}`);
            // Total N based on design
            let totalN;
            let designLabel;
            let designDescription;
            switch (design) {
                case 'between':
                    totalN = nConditions * nPerCondition;
                    designLabel = 'Between-Subjects';
                    designDescription = 'Each participant is assigned to exactly one condition. Different participants in each group.';
                    break;
                case 'within':
                    totalN = nPerCondition; // same participants do all conditions
                    designLabel = 'Within-Subjects (Repeated Measures)';
                    designDescription = 'Each participant experiences all conditions. Requires counterbalancing to control order effects.';
                    break;
                case 'mixed':
                    totalN = Math.ceil(nConditions / 2) * nPerCondition;
                    designLabel = 'Mixed Design';
                    designDescription = 'Combines between- and within-subjects factors. Some variables varied between groups, others within.';
                    break;
                case 'quasi':
                    totalN = nConditions * nPerCondition;
                    designLabel = 'Quasi-Experimental';
                    designDescription = 'Groups are pre-existing (not randomly assigned). Requires careful control for confounds.';
                    break;
                default:
                    return `**Error**: Unknown design type. Use: between, within, mixed, quasi`;
            }
            // Power analysis (simplified: for t-test comparing 2 groups at d=0.5)
            // n per group for 80% power, alpha=0.05, d=0.5: ~64
            // For F-test with k groups: n per group ~= (z_alpha + z_beta)^2 * 2 / f^2
            const fSmall = 0.1, fMedium = 0.25, fLarge = 0.4;
            const z_alpha = 1.96, z_beta = 0.84;
            const nSmall = Math.ceil(((z_alpha + z_beta) ** 2 * 2) / (fSmall ** 2 * nConditions));
            const nMedium = Math.ceil(((z_alpha + z_beta) ** 2 * 2) / (fMedium ** 2 * nConditions));
            const nLarge = Math.ceil(((z_alpha + z_beta) ** 2 * 2) / (fLarge ** 2 * nConditions));
            // Latin square counterbalancing
            function latinSquare(k) {
                const square = [];
                for (let i = 0; i < k; i++) {
                    const row = [];
                    for (let j = 0; j < k; j++) {
                        row.push((i + j) % k);
                    }
                    square.push(row);
                }
                return square;
            }
            const ls = latinSquare(nConditions);
            const lines = [
                `# Behavioral Experiment Design`,
                '',
                `## Research Question`,
                `> ${rq}`,
                '',
                `## Design Overview`,
                `| Parameter | Value |`,
                `|-----------|-------|`,
                `| Design type | **${designLabel}** |`,
                `| Conditions | ${nConditions} (${condLabels.join(', ')}) |`,
                `| N per condition | ${nPerCondition} |`,
                `| Total N | ${totalN} |`,
                '',
                designDescription,
                '',
                `## Randomization Procedure`,
            ];
            if (design === 'between') {
                lines.push(`1. Generate participant IDs (P001 to P${String(totalN).padStart(3, '0')})`, `2. Use block randomization (block size = ${nConditions * 2}) to assign participants`, `3. Within each block, equal allocation to all ${nConditions} conditions`, `4. Stratify by key demographics (age, gender) if relevant`, `5. Concealed allocation: use sealed envelopes or computer-generated sequence`, '');
            }
            else if (design === 'within') {
                lines.push(`1. All ${totalN} participants complete all ${nConditions} conditions`, `2. Use Latin Square counterbalancing (see below)`, `3. Assign participants to counterbalancing orders in rotation`, `4. Include sufficient washout period between conditions`, '', `### Latin Square Counterbalancing`, `| Order | ${condLabels.map((_, i) => `Position ${i + 1}`).join(' | ')} |`, `|${'-|'.repeat(nConditions + 1)}`, ...ls.map((row, i) => `| Order ${i + 1} | ${row.map(j => condLabels[j]).join(' | ')} |`), '', `Assign ${Math.ceil(totalN / nConditions)} participants to each order.`, '');
            }
            else if (design === 'mixed') {
                lines.push(`1. Between-subjects factor: randomly assign to ${Math.ceil(nConditions / 2)} groups`, `2. Within-subjects factor: each group completes ${Math.floor(nConditions / 2) + 1} conditions`, `3. Counterbalance within-subjects conditions across groups`, '');
            }
            else {
                lines.push(`1. Identify pre-existing groups for quasi-experimental comparison`, `2. Match groups on key covariates (propensity score matching if possible)`, `3. Document baseline equivalence checks`, `4. Plan for difference-in-differences or regression discontinuity analysis`, '');
            }
            lines.push(`## Power Analysis`, `| Effect Size (f) | Label | N per condition needed | Total N needed |`, `|-----------------|-------|-----------------------|----------------|`, `| ${fSmall} | Small | ${nSmall} | ${nSmall * nConditions} |`, `| ${fMedium} | Medium | ${nMedium} | ${nMedium * nConditions} |`, `| ${fLarge} | Large | ${nLarge} | ${nLarge * nConditions} |`, '', `Your planned N (${nPerCondition}/condition): sufficient for ${nPerCondition >= nSmall ? 'small' : nPerCondition >= nMedium ? 'medium' : nPerCondition >= nLarge ? 'large' : 'very large'} effects.`, '', `## Statistical Analysis Plan`);
            switch (design) {
                case 'between':
                    lines.push(nConditions === 2
                        ? `- **Primary**: Independent samples t-test (or Welch's t-test)`
                        : `- **Primary**: One-way ANOVA (F-test)`, `- **Post-hoc**: Tukey HSD (if ANOVA significant)`, `- **Effect size**: Cohen's d (2 groups) or eta-squared (3+ groups)`, `- **Assumption checks**: Shapiro-Wilk (normality), Levene's test (homogeneity)`, `- **Non-parametric fallback**: ${nConditions === 2 ? 'Mann-Whitney U' : 'Kruskal-Wallis H'}`);
                    break;
                case 'within':
                    lines.push(nConditions === 2
                        ? `- **Primary**: Paired samples t-test`
                        : `- **Primary**: Repeated measures ANOVA`, `- **Sphericity**: Mauchly's test (RM-ANOVA), Greenhouse-Geisser correction if violated`, `- **Post-hoc**: Bonferroni-corrected pairwise comparisons`, `- **Effect size**: Cohen's d_z (paired) or partial eta-squared`, `- **Non-parametric fallback**: ${nConditions === 2 ? 'Wilcoxon signed-rank' : "Friedman's test"}`);
                    break;
                case 'mixed':
                    lines.push(`- **Primary**: Mixed-design ANOVA`, `- **Test**: Main effects for both factors + interaction`, `- **Simple effects**: Decompose interaction if significant`, `- **Effect size**: Partial eta-squared for each effect`);
                    break;
                case 'quasi':
                    lines.push(`- **Primary**: ANCOVA (controlling for baseline differences)`, `- **Sensitivity**: Propensity score matching or weighting`, `- **Robustness**: Difference-in-differences if pre-post data available`, `- **Caution**: Cannot infer causation without randomization`);
                    break;
            }
            lines.push('', `## Manipulation Checks`, `- Include ${nConditions} manipulation check items after experimental manipulation`, `- Ask participants to recall/identify their condition (comprehension check)`, `- Rate perceived [relevant construct] on 7-point scale`, `- Verify manipulation before running main analyses`, `- Exclude participants failing manipulation checks (report both with/without exclusions)`, '', `## Demand Characteristics Mitigation`, `- Use a cover story unrelated to the true hypothesis`, `- Include filler items/tasks to obscure the focal measure`, `- Administer funnel debriefing questionnaire post-study:`, `  1. What do you think this study was about?`, `  2. Did you notice anything unusual?`, `  3. Do you think your behavior was influenced by anything specific?`, `- Consider single-blind (participant) or double-blind (both) design`, `- Use behavioral measures in addition to self-report`, '', `## IRB Considerations Checklist`, `- [ ] Informed consent document prepared`, `- [ ] Deception disclosure and debriefing plan (if deception used)`, `- [ ] Risk assessment: physical, psychological, social, economic`, `- [ ] Vulnerable population protections (if applicable)`, `- [ ] Data anonymization/de-identification plan`, `- [ ] Data storage and retention policy (typically 5-7 years)`, `- [ ] Right to withdraw without penalty`, `- [ ] Compensation plan (fair, not coercive)`, `- [ ] Adverse event reporting procedure`, `- [ ] Privacy and confidentiality safeguards`, `- [ ] Pre-registration plan (OSF, AsPredicted, or ClinicalTrials.gov)`, '', `## Pre-Registration Template`, `1. **Hypothesis**: [State directional hypothesis]`, `2. **Design**: ${designLabel}, ${nConditions} conditions`, `3. **Planned N**: ${totalN} (${nPerCondition} per condition)`, `4. **Stopping rule**: Data collection stops at planned N`, `5. **Primary DV**: [Specify]`, `6. **Primary analysis**: [Specify test]`, `7. **Exclusion criteria**: [Specify a priori]`, `8. **Alpha**: .05 (two-tailed)`, `9. **Multiple comparison correction**: ${nConditions > 2 ? 'Bonferroni / Holm' : 'N/A (2 conditions)'}`);
            return lines.join('\n');
        },
    });
    // ── 12. Discourse Analysis ─────────────────────────────────────────────
    registerTool({
        name: 'discourse_analyze',
        description: 'Comprehensive text/discourse analysis: word frequency with TF-IDF, type-token ratio, readability scores (Flesch-Kincaid Grade, Gunning Fog, Coleman-Liau, SMOG, Automated Readability Index), sentence length distribution, and vocabulary diversity (Yule\'s K, Simpson\'s D, hapax legomena ratio).',
        parameters: {
            text: { type: 'string', description: 'Text to analyze', required: true },
            analysis_type: { type: 'string', description: 'Analysis: frequency, readability, diversity, all (default: all)' },
        },
        tier: 'free',
        async execute(args) {
            const text = String(args.text);
            const analysisType = (args.analysis_type ? String(args.analysis_type) : 'all').toLowerCase().trim();
            if (text.trim().length === 0)
                return '**Error**: No text provided.';
            const showAll = analysisType === 'all';
            // Basic tokenization
            const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
            const words = text.toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter(w => w.length > 0);
            const syllableCounts = words.map(countSyllables);
            const totalSyllables = sum(syllableCounts);
            const totalWords = words.length;
            const totalSentences = Math.max(sentences.length, 1);
            const totalChars = words.join('').length;
            // Word frequency
            const freq = new Map();
            for (const w of words) {
                freq.set(w, (freq.get(w) ?? 0) + 1);
            }
            // Stop words to filter for meaningful frequency analysis
            const stopWords = new Set([
                'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
                'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
                'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
                'could', 'should', 'may', 'might', 'shall', 'can', 'it', 'its',
                'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our',
                'you', 'your', 'he', 'she', 'they', 'them', 'their', 'his', 'her',
                'not', 'no', 'so', 'if', 'as', 'up', 'out', 'about', 'into',
                'than', 'then', 'also', 'just', 'more', 'very', 'what', 'which',
                'who', 'how', 'when', 'where', 'there', 'here', 'all', 'each',
                'both', 'few', 'some', 'any', 'most', 'other', 'such', 'only',
            ]);
            const lines = [
                `# Discourse Analysis`,
                '',
                `## Text Statistics`,
                `| Metric | Value |`,
                `|--------|-------|`,
                `| Words | ${totalWords} |`,
                `| Sentences | ${totalSentences} |`,
                `| Characters (no spaces) | ${totalChars} |`,
                `| Syllables | ${totalSyllables} |`,
                `| Unique words | ${freq.size} |`,
                `| Avg words/sentence | ${fmt(totalWords / totalSentences)} |`,
                `| Avg syllables/word | ${fmt(totalSyllables / totalWords)} |`,
                `| Avg word length (chars) | ${fmt(totalChars / totalWords)} |`,
                '',
            ];
            // ── Frequency analysis ──
            if (showAll || analysisType === 'frequency') {
                // Top 20 words overall
                const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
                const top20All = sorted.slice(0, 20);
                // Top 20 content words (no stop words)
                const contentWords = sorted.filter(([w]) => !stopWords.has(w));
                const top20Content = contentWords.slice(0, 20);
                // TF-IDF (treat each sentence as a document)
                const sentenceWords = sentences.map(s => s.toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter(w => w.length > 0));
                const df = new Map();
                for (const sw of sentenceWords) {
                    const unique = new Set(sw);
                    for (const w of unique) {
                        df.set(w, (df.get(w) ?? 0) + 1);
                    }
                }
                const tfidf = new Map();
                for (const [word, tf] of freq) {
                    if (stopWords.has(word))
                        continue;
                    const idf = Math.log(totalSentences / (df.get(word) ?? 1));
                    tfidf.set(word, tf * idf);
                }
                const topTfidf = [...tfidf.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
                lines.push(`## Word Frequency`, '', `### Top 20 Words (all)`, `| Rank | Word | Count | Frequency |`, `|------|------|-------|-----------|`, ...top20All.map(([w, c], i) => `| ${i + 1} | ${w} | ${c} | ${fmt(c / totalWords * 100, 2)}% |`), '', `### Top 20 Content Words (no stop words)`, `| Rank | Word | Count | Frequency |`, `|------|------|-------|-----------|`, ...top20Content.map(([w, c], i) => `| ${i + 1} | ${w} | ${c} | ${fmt(c / totalWords * 100, 2)}% |`), '', `### Top TF-IDF Keywords`, `| Word | TF-IDF Score |`, `|------|-------------|`, ...topTfidf.map(([w, s]) => `| ${w} | ${fmt(s)} |`), '');
            }
            // ── Readability ──
            if (showAll || analysisType === 'readability') {
                const awl = totalWords / totalSentences; // avg words per sentence
                const asl = totalSyllables / totalWords; // avg syllables per word
                // Flesch Reading Ease
                const fleschRE = 206.835 - 1.015 * awl - 84.6 * asl;
                // Flesch-Kincaid Grade Level
                const fleschKG = 0.39 * awl + 11.8 * asl - 15.59;
                // Gunning Fog Index
                const complexWords = words.filter((_, i) => syllableCounts[i] >= 3).length;
                const fogIndex = 0.4 * (awl + 100 * complexWords / totalWords);
                // Coleman-Liau Index
                const L = (totalChars / totalWords) * 100; // avg letters per 100 words
                const S = (totalSentences / totalWords) * 100; // avg sentences per 100 words
                const colemanLiau = 0.0588 * L - 0.296 * S - 15.8;
                // SMOG Grade
                const polysyllables = words.filter((_, i) => syllableCounts[i] >= 3).length;
                const smog = totalSentences >= 3
                    ? 1.0430 * Math.sqrt(polysyllables * (30 / totalSentences)) + 3.1291
                    : 0;
                // Automated Readability Index
                const ari = 4.71 * (totalChars / totalWords) + 0.5 * (totalWords / totalSentences) - 21.43;
                function readabilityLevel(grade) {
                    if (grade <= 5)
                        return 'Elementary';
                    if (grade <= 8)
                        return 'Middle school';
                    if (grade <= 12)
                        return 'High school';
                    if (grade <= 16)
                        return 'College';
                    return 'Graduate';
                }
                lines.push(`## Readability Scores`, `| Index | Score | Grade Level | Audience |`, `|-------|-------|-------------|----------|`, `| Flesch Reading Ease | ${fmt(fleschRE)} | ${fleschRE > 90 ? '5th grade' : fleschRE > 80 ? '6th grade' : fleschRE > 70 ? '7th grade' : fleschRE > 60 ? '8-9th grade' : fleschRE > 50 ? '10-12th grade' : fleschRE > 30 ? 'College' : 'Graduate'} | ${fleschRE > 60 ? 'General public' : fleschRE > 30 ? 'Educated adults' : 'Specialists'} |`, `| Flesch-Kincaid Grade | ${fmt(fleschKG)} | Grade ${Math.round(fleschKG)} | ${readabilityLevel(fleschKG)} |`, `| Gunning Fog | ${fmt(fogIndex)} | Grade ${Math.round(fogIndex)} | ${readabilityLevel(fogIndex)} |`, `| Coleman-Liau | ${fmt(colemanLiau)} | Grade ${Math.round(colemanLiau)} | ${readabilityLevel(colemanLiau)} |`, `| SMOG | ${fmt(smog)} | Grade ${Math.round(smog)} | ${readabilityLevel(smog)} |`, `| ARI | ${fmt(ari)} | Grade ${Math.round(ari)} | ${readabilityLevel(ari)} |`, '', `**Consensus grade level**: ~${fmt(mean([fleschKG, fogIndex, colemanLiau, smog > 0 ? smog : fleschKG, ari].filter(x => x > 0)))} (${readabilityLevel(mean([fleschKG, fogIndex, colemanLiau].filter(x => x > 0)))})`, '');
                // Sentence length distribution
                const sentLengths = sentences.map(s => s.toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter(w => w.length > 0).length);
                const shortSent = sentLengths.filter(l => l <= 10).length;
                const medSent = sentLengths.filter(l => l > 10 && l <= 20).length;
                const longSent = sentLengths.filter(l => l > 20 && l <= 35).length;
                const veryLongSent = sentLengths.filter(l => l > 35).length;
                lines.push(`### Sentence Length Distribution`, `| Length | Count | Percentage |`, `|--------|-------|------------|`, `| Short (1-10 words) | ${shortSent} | ${fmt(100 * shortSent / totalSentences, 1)}% |`, `| Medium (11-20 words) | ${medSent} | ${fmt(100 * medSent / totalSentences, 1)}% |`, `| Long (21-35 words) | ${longSent} | ${fmt(100 * longSent / totalSentences, 1)}% |`, `| Very long (36+ words) | ${veryLongSent} | ${fmt(100 * veryLongSent / totalSentences, 1)}% |`, '', `- Shortest sentence: ${Math.min(...sentLengths)} words`, `- Longest sentence: ${Math.max(...sentLengths)} words`, `- SD of sentence length: ${fmt(stddev(sentLengths))}`, '');
            }
            // ── Vocabulary diversity ──
            if (showAll || analysisType === 'diversity') {
                // Type-Token Ratio
                const ttr = freq.size / totalWords;
                // Hapax legomena (words appearing exactly once)
                const hapax = [...freq.values()].filter(c => c === 1).length;
                const hapaxRatio = hapax / freq.size;
                // Dis legomena (appearing exactly twice)
                const dis = [...freq.values()].filter(c => c === 2).length;
                // Yule's K (measure of vocabulary richness, lower = more diverse)
                // K = 10^4 * (M2 - N) / N^2 where M2 = sum(i^2 * V_i) and V_i = freq of freq i
                const freqOfFreq = new Map();
                for (const c of freq.values()) {
                    freqOfFreq.set(c, (freqOfFreq.get(c) ?? 0) + 1);
                }
                let M2 = 0;
                for (const [i, Vi] of freqOfFreq) {
                    M2 += i * i * Vi;
                }
                const yulesK = totalWords > 0 ? 10000 * (M2 - totalWords) / (totalWords * totalWords) : 0;
                // Simpson's D (probability two randomly chosen words are the same)
                let simpsonsD = 0;
                for (const c of freq.values()) {
                    simpsonsD += c * (c - 1);
                }
                simpsonsD = totalWords > 1 ? simpsonsD / (totalWords * (totalWords - 1)) : 0;
                // Brunet's W (W = N^(V^-0.172))
                const brunetsW = Math.pow(totalWords, Math.pow(freq.size, -0.172));
                // Honore's R (if hapax > 0): R = 100 * log(N) / (1 - hapax/V)
                const honoresR = hapax < freq.size
                    ? (100 * Math.log(totalWords)) / (1 - hapax / freq.size)
                    : 0;
                lines.push(`## Vocabulary Diversity`, `| Measure | Value | Interpretation |`, `|---------|-------|----------------|`, `| Type-Token Ratio (TTR) | ${fmt(ttr)} | ${ttr > 0.7 ? 'High diversity' : ttr > 0.5 ? 'Moderate diversity' : 'Low diversity (repetitive)'} |`, `| Hapax legomena | ${hapax} (${fmt(100 * hapaxRatio, 1)}% of types) | Words used only once |`, `| Dis legomena | ${dis} | Words used exactly twice |`, `| Yule's K | ${fmt(yulesK)} | ${yulesK < 100 ? 'High diversity' : yulesK < 150 ? 'Moderate' : 'Low diversity'} (lower = more diverse) |`, `| Simpson's D | ${fmt(simpsonsD)} | ${simpsonsD < 0.01 ? 'High diversity' : simpsonsD < 0.05 ? 'Moderate' : 'Low diversity'} (lower = more diverse) |`, `| Brunet's W | ${fmt(brunetsW)} | Lower = richer vocabulary |`, `| Honore's R | ${fmt(honoresR)} | Higher = richer vocabulary |`, '', `### Frequency Spectrum`, `| Frequency | # Words | Cumulative % of Types |`, `|-----------|---------|----------------------|`);
                const sortedFoF = [...freqOfFreq.entries()].sort((a, b) => a[0] - b[0]);
                let cumTypes = 0;
                for (const [fq, count] of sortedFoF.slice(0, 10)) {
                    cumTypes += count;
                    lines.push(`| ${fq} | ${count} | ${fmt(100 * cumTypes / freq.size, 1)}% |`);
                }
                if (sortedFoF.length > 10) {
                    const remaining = sum(sortedFoF.slice(10).map(([_, c]) => c));
                    lines.push(`| 11+ | ${remaining} | 100% |`);
                }
                lines.push('');
            }
            return lines.join('\n');
        },
    });
}
// ─── Utility Functions ───────────────────────────────────────────────────────
/** Count syllables in a word (English heuristic) */
function countSyllables(word) {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 2)
        return 1;
    // Remove silent e at end
    word = word.replace(/e$/, '');
    if (word.length === 0)
        return 1;
    // Count vowel groups
    const vowelGroups = word.match(/[aeiouy]+/g);
    let count = vowelGroups ? vowelGroups.length : 1;
    // Adjust for common patterns
    if (word.match(/le$/))
        count++;
    if (word.match(/[^aeiou]y$/))
        count = Math.max(count, 1);
    return Math.max(count, 1);
}
/** Significance stars for p-values */
function sigStars(p) {
    if (p < 0.001)
        return '***';
    if (p < 0.01)
        return '**';
    if (p < 0.05)
        return '*';
    if (p < 0.1)
        return '.';
    return '';
}
/** Deterministic pseudo-random for label propagation reproducibility */
function deterministicRandom(seed) {
    let x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
}
/** Compute top-k eigenvalues via power iteration + deflation */
function computeEigenvalues(matrix, k) {
    const n = matrix.length;
    const eigenvalues = [];
    // Work on a copy
    const A = matrix.map(row => [...row]);
    for (let e = 0; e < k; e++) {
        // Power iteration
        let vec = new Array(n).fill(0).map((_, i) => (i === e % n) ? 1 : 0.5);
        let eigenvalue = 0;
        for (let iter = 0; iter < 200; iter++) {
            // Multiply A * vec
            const newVec = new Array(n).fill(0);
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    newVec[i] += A[i][j] * vec[j];
                }
            }
            // Find the eigenvalue (Rayleigh quotient)
            let dot1 = 0, dot2 = 0;
            for (let i = 0; i < n; i++) {
                dot1 += newVec[i] * vec[i];
                dot2 += vec[i] * vec[i];
            }
            const newEigenvalue = dot2 > 0 ? dot1 / dot2 : 0;
            // Normalize
            const norm = Math.sqrt(newVec.reduce((s, v) => s + v * v, 0));
            if (norm > 0) {
                for (let i = 0; i < n; i++)
                    newVec[i] /= norm;
            }
            const diff = Math.abs(newEigenvalue - eigenvalue);
            eigenvalue = newEigenvalue;
            vec = newVec;
            if (diff < 1e-10)
                break;
        }
        eigenvalues.push(eigenvalue);
        // Deflation: A = A - eigenvalue * v * v^T
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                A[i][j] -= eigenvalue * vec[i] * vec[j];
            }
        }
    }
    return eigenvalues;
}
//# sourceMappingURL=lab-social.js.map