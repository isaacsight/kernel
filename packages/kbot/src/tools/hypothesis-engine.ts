// kbot Hypothesis Generation Engine — Scientific hypothesis tools
// Helps researchers form, test, and evaluate scientific hypotheses.
// All computations are self-contained — no external dependencies.

import { registerTool } from './index.js'

// ---------------------------------------------------------------------------
// Shared math utilities
// ---------------------------------------------------------------------------

/** Simple seeded PRNG (xoshiro128**) for reproducible Monte Carlo */
class PRNG {
  private s: Uint32Array
  constructor(seed: number) {
    this.s = new Uint32Array(4)
    this.s[0] = seed >>> 0
    this.s[1] = (seed * 1812433253 + 1) >>> 0
    this.s[2] = (this.s[1] * 1812433253 + 1) >>> 0
    this.s[3] = (this.s[2] * 1812433253 + 1) >>> 0
  }
  private rotl(x: number, k: number): number {
    return ((x << k) | (x >>> (32 - k))) >>> 0
  }
  nextU32(): number {
    const result = (this.rotl((this.s[1] * 5) >>> 0, 7) * 9) >>> 0
    const t = (this.s[1] << 9) >>> 0
    this.s[2] ^= this.s[0]
    this.s[3] ^= this.s[1]
    this.s[1] ^= this.s[2]
    this.s[0] ^= this.s[3]
    this.s[2] ^= t
    this.s[3] = this.rotl(this.s[3], 11)
    return result
  }
  /** Uniform [0, 1) */
  random(): number {
    return this.nextU32() / 4294967296
  }
  /** Standard normal via Box-Muller */
  normal(mean = 0, sd = 1): number {
    const u1 = this.random() || 1e-10
    const u2 = this.random()
    return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  }
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function variance(arr: number[], m?: number): number {
  const mu = m ?? mean(arr)
  return arr.reduce((s, x) => s + (x - mu) ** 2, 0) / (arr.length - 1)
}

function stddev(arr: number[], m?: number): number {
  return Math.sqrt(variance(arr, m))
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length)
  if (n < 2) return 0
  const mx = mean(x.slice(0, n))
  const my = mean(y.slice(0, n))
  let num = 0, dx2 = 0, dy2 = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx
    const dy = y[i] - my
    num += dx * dy
    dx2 += dx * dx
    dy2 += dy * dy
  }
  const denom = Math.sqrt(dx2 * dy2)
  return denom === 0 ? 0 : num / denom
}

/** Normal CDF approximation (Abramowitz and Stegun) */
function normalCDF(z: number): number {
  if (z < -8) return 0
  if (z > 8) return 1
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const sign = z < 0 ? -1 : 1
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + p * x)
  const erf = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return 0.5 * (1 + sign * erf)
}

/** Inverse normal CDF (rational approximation) */
function normalInvCDF(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  if (p === 0.5) return 0
  const a = [
    -3.969683028665376e+01, 2.209460984245205e+02,
    -2.759285104469687e+02, 1.383577518672690e+02,
    -3.066479806614716e+01, 2.506628277459239e+00,
  ]
  const b = [
    -5.447609879822406e+01, 1.615858368580409e+02,
    -1.556989798598866e+02, 6.680131188771972e+01,
    -1.328068155288572e+01,
  ]
  const c = [
    -7.784894002430293e-03, -3.223964580411365e-01,
    -2.400758277161838e+00, -2.549732539343734e+00,
    4.374664141464968e+00, 2.938163982698783e+00,
  ]
  const d = [
    7.784695709041462e-03, 3.224671290700398e-01,
    2.445134137142996e+00, 3.754408661907416e+00,
  ]
  const pLow = 0.02425, pHigh = 1 - pLow
  let q: number, r: number
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  } else if (p <= pHigh) {
    q = p - 0.5
    r = q * q
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p))
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
}

/** Student's t CDF approximation for df >= 1 */
function tCDF(t: number, df: number): number {
  // Use normal approximation for large df
  if (df > 100) return normalCDF(t)
  const x = df / (df + t * t)
  // Regularized incomplete beta function approximation
  const a = df / 2, b = 0.5
  let result = incompleteBeta(x, a, b)
  if (t < 0) return result / 2
  return 1 - result / 2
}

/** Regularized incomplete beta function (continued fraction, Lentz) */
function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const lbeta = logGamma(a) + logGamma(b) - logGamma(a + b)
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta) / a
  // Lentz continued fraction
  let f = 1, c = 1, d = 1 - (a + b) * x / (a + 1)
  if (Math.abs(d) < 1e-30) d = 1e-30
  d = 1 / d; f = d
  for (let m = 1; m <= 200; m++) {
    let num = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m))
    d = 1 + num * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d
    c = 1 + num / c; if (Math.abs(c) < 1e-30) c = 1e-30
    f *= d * c
    num = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1))
    d = 1 + num * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d
    c = 1 + num / c; if (Math.abs(c) < 1e-30) c = 1e-30
    const delta = d * c
    f *= delta
    if (Math.abs(delta - 1) < 1e-10) break
  }
  return front * f
}

/** Log-gamma via Lanczos approximation */
function logGamma(z: number): number {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z)
  z -= 1
  const g = 7
  const coef = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ]
  let x = coef[0]
  for (let i = 1; i < g + 2; i++) x += coef[i] / (z + i)
  const t = z + g + 0.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}

/** Chi-squared CDF (regularized lower incomplete gamma) */
function chiSquaredCDF(x: number, k: number): number {
  if (x <= 0) return 0
  return regularizedGammaP(k / 2, x / 2)
}

/** Regularized lower incomplete gamma P(a, x) via series expansion */
function regularizedGammaP(a: number, x: number): number {
  if (x < 0) return 0
  if (x === 0) return 0
  const lg = logGamma(a)
  // Use series for x < a + 1
  if (x < a + 1) {
    let sum = 1 / a, term = 1 / a
    for (let n = 1; n < 200; n++) {
      term *= x / (a + n)
      sum += term
      if (Math.abs(term) < 1e-12 * Math.abs(sum)) break
    }
    return sum * Math.exp(-x + a * Math.log(x) - lg)
  }
  // Use continued fraction for x >= a + 1
  return 1 - regularizedGammaQ(a, x)
}

/** Regularized upper incomplete gamma Q(a, x) via continued fraction */
function regularizedGammaQ(a: number, x: number): number {
  const lg = logGamma(a)
  let f = 1, c = 1, d = x + 1 - a
  if (Math.abs(d) < 1e-30) d = 1e-30
  d = 1 / d; f = d
  for (let i = 1; i <= 200; i++) {
    const an = -i * (i - a)
    const bn = x + 2 * i + 1 - a
    d = bn + an * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d
    c = bn + an / c; if (Math.abs(c) < 1e-30) c = 1e-30
    const delta = d * c
    f *= delta
    if (Math.abs(delta - 1) < 1e-10) break
  }
  return f * Math.exp(-x + a * Math.log(x) - lg)
}

/** Parse flexible numeric data: comma-separated or JSON array */
function parseNumericData(input: string): number[] {
  const trimmed = input.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parsed.map(Number).filter(n => !isNaN(n))
    } catch { /* fall through */ }
  }
  return trimmed.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n))
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerHypothesisEngineTools(): void {

  // =========================================================================
  // 1. hypothesis_generate
  // =========================================================================
  registerTool({
    name: 'hypothesis_generate',
    description:
      'Generate testable hypotheses from observations or data. Produces 3-5 ranked hypotheses with null hypotheses, predicted outcomes, suggested experimental approaches, required tools, and confidence levels.',
    parameters: {
      observation: {
        type: 'string',
        description: 'Describe what you observed or the data pattern you noticed',
        required: true,
      },
      field: {
        type: 'string',
        description: 'Scientific field (e.g. biology, physics, psychology, economics, computer_science)',
        required: true,
      },
      context: {
        type: 'string',
        description: 'Any prior knowledge, literature references, or constraints (optional)',
      },
    },
    tier: 'free',
    async execute(args) {
      const observation = String(args.observation)
      const field = String(args.field).toLowerCase()
      const context = args.context ? String(args.context) : ''

      // Field-specific experimental templates
      const fieldTemplates: Record<string, {
        methods: string[]
        tools: string[]
        designs: string[]
        variables: string[]
      }> = {
        biology: {
          methods: ['controlled experiment', 'longitudinal study', 'gene knockout', 'comparative analysis', 'field observation'],
          tools: ['microscopy', 'PCR', 'sequencing', 'cell culture', 'flow cytometry', 'Western blot'],
          designs: ['randomized controlled trial', 'case-control study', 'cohort study'],
          variables: ['gene expression', 'protein levels', 'cell viability', 'growth rate', 'survival rate'],
        },
        physics: {
          methods: ['controlled experiment', 'simulation', 'measurement', 'theoretical derivation', 'interferometry'],
          tools: ['oscilloscope', 'spectrometer', 'particle detector', 'laser', 'calorimeter', 'simulation software'],
          designs: ['repeated measures', 'factorial design', 'parameter sweep'],
          variables: ['energy', 'force', 'wavelength', 'temperature', 'velocity', 'field strength'],
        },
        psychology: {
          methods: ['randomized controlled trial', 'survey', 'longitudinal study', 'cross-sectional study', 'meta-analysis'],
          tools: ['psychometric scales', 'fMRI', 'EEG', 'eye-tracking', 'reaction time software', 'questionnaires'],
          designs: ['between-subjects', 'within-subjects', 'mixed design', 'crossover'],
          variables: ['response time', 'accuracy', 'self-report scores', 'cortisol levels', 'neural activation'],
        },
        economics: {
          methods: ['natural experiment', 'regression analysis', 'difference-in-differences', 'instrumental variables', 'simulation'],
          tools: ['econometric software (R/Stata)', 'panel data', 'survey instruments', 'administrative data'],
          designs: ['quasi-experimental', 'randomized controlled trial', 'event study'],
          variables: ['GDP', 'employment rate', 'price index', 'Gini coefficient', 'trade volume'],
        },
        computer_science: {
          methods: ['A/B testing', 'benchmarking', 'ablation study', 'formal verification', 'simulation'],
          tools: ['profiler', 'benchmark suite', 'GPU cluster', 'statistical analysis', 'version control'],
          designs: ['factorial design', 'repeated measures', 'cross-validation'],
          variables: ['latency', 'throughput', 'accuracy', 'F1 score', 'memory usage', 'convergence rate'],
        },
        chemistry: {
          methods: ['titration', 'spectroscopic analysis', 'kinetics study', 'synthesis', 'computational chemistry'],
          tools: ['NMR', 'mass spectrometry', 'IR spectroscopy', 'HPLC', 'X-ray crystallography'],
          designs: ['factorial design', 'response surface methodology', 'sequential design'],
          variables: ['yield', 'reaction rate', 'concentration', 'purity', 'binding affinity'],
        },
        medicine: {
          methods: ['randomized controlled trial', 'cohort study', 'case-control study', 'meta-analysis', 'clinical observation'],
          tools: ['clinical assessment tools', 'imaging (MRI/CT)', 'blood work', 'biopsy', 'patient records'],
          designs: ['double-blind RCT', 'crossover trial', 'parallel group'],
          variables: ['survival rate', 'symptom severity', 'biomarker levels', 'quality of life score', 'adverse events'],
        },
      }

      const template = fieldTemplates[field] || fieldTemplates['biology']

      // Generate hypotheses based on observation structure
      const keywords = observation.toLowerCase()
      const isCorrelational = /correlat|associat|relat|link|connect/i.test(keywords)
      const isCausal = /caus|effect|lead|result|impact|increas|decreas/i.test(keywords)
      const isComparative = /differ|compar|more|less|higher|lower|better|worse/i.test(keywords)
      const isTemporal = /time|trend|chang|over\s+time|increas|decreas|grow|decline/i.test(keywords)
      const isMechanistic = /mechanism|how|why|process|pathway|mediator/i.test(keywords)

      interface Hypothesis {
        statement: string
        null_hypothesis: string
        predicted_outcome: string
        experimental_approach: string
        required_tools: string[]
        confidence: string
        confidence_pct: number
      }

      const hypotheses: Hypothesis[] = []

      // H1: Direct causal hypothesis
      hypotheses.push({
        statement: isCausal
          ? `The observed ${observation.slice(0, 80)} is caused by a direct mechanistic relationship that can be isolated through ${template.methods[0]}.`
          : `The phenomenon described ("${observation.slice(0, 60)}...") reflects a direct causal mechanism in ${field}.`,
        null_hypothesis: 'There is no causal relationship; observed patterns are due to chance or confounding variables.',
        predicted_outcome: `Controlled manipulation of the proposed cause will produce a measurable change in ${template.variables[0]} (effect size d >= 0.3).`,
        experimental_approach: `${template.designs[0]} with ${template.methods[0]}. Manipulate the independent variable while controlling for confounders. Sample size: power analysis recommended (n >= 30 per group).`,
        required_tools: [template.tools[0], template.tools[1], 'statistical analysis software'],
        confidence: 'Moderate',
        confidence_pct: 55,
      })

      // H2: Correlational / mediator hypothesis
      hypotheses.push({
        statement: isCorrelational
          ? `The correlation described in the observation is mediated by an intermediate variable (${template.variables[2] || 'unmeasured mediator'}).`
          : `A correlational relationship exists between the key variables, mediated by ${template.variables[2] || 'an intermediate factor'}.`,
        null_hypothesis: `No mediating variable explains the observed association; any apparent mediation is artifactual.`,
        predicted_outcome: `Structural equation modeling or mediation analysis will show significant indirect effects (p < 0.05) through the proposed mediator.`,
        experimental_approach: `${template.designs[1] || template.designs[0]} measuring the proposed mediator alongside primary variables. Use Sobel test or bootstrap mediation analysis.`,
        required_tools: [template.tools[2] || template.tools[0], 'SEM software (lavaan/AMOS)', 'mediation analysis package'],
        confidence: 'Moderate-Low',
        confidence_pct: 40,
      })

      // H3: Alternative mechanism hypothesis
      hypotheses.push({
        statement: isMechanistic
          ? `The mechanism underlying the observation involves ${template.variables[1]} as a primary driver rather than the most obvious candidate.`
          : `An alternative mechanism (involving ${template.variables[1]}) better explains the observation than the default assumption.`,
        null_hypothesis: `The conventional/default mechanism is sufficient; ${template.variables[1]} plays no independent role.`,
        predicted_outcome: `Blocking or removing the alternative mechanism while preserving the default pathway will eliminate the observed effect.`,
        experimental_approach: `${template.methods[2] || template.methods[1]} with selective intervention. Compare full model vs. reduced model.`,
        required_tools: template.tools.slice(1, 4),
        confidence: 'Low-Moderate',
        confidence_pct: 35,
      })

      // H4: Temporal / dose-response hypothesis
      if (isTemporal || hypotheses.length < 4) {
        hypotheses.push({
          statement: `The observed effect follows a dose-response or temporal relationship — increasing the independent variable magnitude or exposure duration will proportionally increase the effect on ${template.variables[0]}.`,
          null_hypothesis: `No dose-response relationship exists; the effect is binary (present/absent) or random.`,
          predicted_outcome: `Regression analysis will show a significant linear or log-linear relationship (R² > 0.3) between dose/time and outcome.`,
          experimental_approach: `Graded exposure design with ${template.methods[0]}. Test at least 4 dose levels with sufficient replication (n >= 10 per level).`,
          required_tools: [template.tools[0], 'dose-response modeling software', 'regression analysis'],
          confidence: 'Moderate',
          confidence_pct: 50,
        })
      }

      // H5: Null / artifact hypothesis
      hypotheses.push({
        statement: `The observed pattern is an artifact of ${isComparative ? 'selection bias or non-random sampling' : 'measurement error, confounding, or statistical noise'} rather than a genuine effect.`,
        null_hypothesis: `(This IS the null hypothesis — the observed pattern is real and replicable.)`,
        predicted_outcome: `Replication with improved methodology (larger sample, better controls, blinding) will fail to reproduce the effect (p > 0.05).`,
        experimental_approach: `Pre-registered replication study with ${template.designs[0]}. Address potential confounders identified in original observation. Use power analysis to ensure adequate sample size.`,
        required_tools: ['pre-registration platform (OSF/AsPredicted)', 'power analysis tool (G*Power)', template.tools[0]],
        confidence: 'Should always be considered',
        confidence_pct: 25,
      })

      // Sort by confidence (descending)
      hypotheses.sort((a, b) => b.confidence_pct - a.confidence_pct)

      // Build output
      const lines: string[] = [
        `# Hypothesis Generation Report`,
        '',
        `**Field**: ${field}`,
        `**Observation**: ${observation}`,
        context ? `**Prior Context**: ${context}` : '',
        '',
        `---`,
        '',
        `## Generated Hypotheses (${hypotheses.length})`,
        '',
      ]

      hypotheses.forEach((h, i) => {
        lines.push(`### H${i + 1}: ${h.statement}`)
        lines.push('')
        lines.push(`| Attribute | Details |`)
        lines.push(`|-----------|---------|`)
        lines.push(`| **Null Hypothesis** | ${h.null_hypothesis} |`)
        lines.push(`| **Predicted Outcome** | ${h.predicted_outcome} |`)
        lines.push(`| **Experimental Approach** | ${h.experimental_approach} |`)
        lines.push(`| **Required Tools** | ${h.required_tools.join(', ')} |`)
        lines.push(`| **Confidence** | ${h.confidence} (${h.confidence_pct}%) |`)
        lines.push('')
      })

      lines.push(`---`)
      lines.push('')
      lines.push(`## Recommendations`)
      lines.push('')
      lines.push(`1. **Start with H1** (highest confidence) — design a focused experiment to test the primary hypothesis.`)
      lines.push(`2. **Always consider H${hypotheses.length}** (artifact hypothesis) — rule out confounders before claiming a discovery.`)
      lines.push(`3. **Pre-register** your study design before data collection to increase credibility.`)
      lines.push(`4. Use \`experiment_simulate\` to estimate required sample size and statistical power before running experiments.`)
      lines.push(`5. Use \`reproducibility_check\` after obtaining results to assess replication probability.`)

      return lines.filter(l => l !== undefined).join('\n')
    },
  })

  // =========================================================================
  // 2. anomaly_detect
  // =========================================================================
  registerTool({
    name: 'anomaly_detect',
    description:
      'Detect anomalies and outliers in scientific data using z-score, IQR, Grubbs, or isolation forest methods. Returns which data points are anomalous with severity and potential explanations.',
    parameters: {
      data: {
        type: 'string',
        description: 'Numeric data as comma-separated values or JSON array (e.g. "1.2, 3.4, 5.6" or "[1.2, 3.4, 5.6]")',
        required: true,
      },
      method: {
        type: 'string',
        description: 'Detection method: zscore, iqr, grubbs, or isolation',
        required: true,
      },
      threshold: {
        type: 'number',
        description: 'Sensitivity threshold (default 2.0 for z-score, 1.5 for IQR multiplier)',
      },
    },
    tier: 'free',
    async execute(args) {
      const values = parseNumericData(String(args.data))
      const method = String(args.method).toLowerCase()
      const threshold = typeof args.threshold === 'number' ? args.threshold : 2.0

      if (values.length < 3) {
        return '**Error**: Need at least 3 data points for anomaly detection.'
      }

      const mu = mean(values)
      const sd = stddev(values, mu)
      const sorted = [...values].sort((a, b) => a - b)
      const n = values.length

      interface Anomaly {
        index: number
        value: number
        severity: 'low' | 'moderate' | 'high' | 'extreme'
        score: number
        explanation: string
      }

      const anomalies: Anomaly[] = []

      if (method === 'zscore') {
        if (sd === 0) return '**No anomalies**: All values are identical (standard deviation = 0).'
        for (let i = 0; i < values.length; i++) {
          const z = Math.abs((values[i] - mu) / sd)
          if (z > threshold) {
            const severity = z > 4 ? 'extreme' : z > 3 ? 'high' : z > 2.5 ? 'moderate' : 'low'
            anomalies.push({
              index: i,
              value: values[i],
              severity,
              score: z,
              explanation: `z-score = ${z.toFixed(3)}, ${z.toFixed(1)} SDs from mean (${mu.toFixed(3)})`,
            })
          }
        }
      } else if (method === 'iqr') {
        const q1 = quantile(sorted, 0.25)
        const q3 = quantile(sorted, 0.75)
        const iqr = q3 - q1
        const multiplier = typeof args.threshold === 'number' ? args.threshold : 1.5
        const lower = q1 - multiplier * iqr
        const upper = q3 + multiplier * iqr

        for (let i = 0; i < values.length; i++) {
          if (values[i] < lower || values[i] > upper) {
            const distance = values[i] < lower ? lower - values[i] : values[i] - upper
            const sevScore = iqr > 0 ? distance / iqr : 1
            const severity = sevScore > 3 ? 'extreme' : sevScore > 2 ? 'high' : sevScore > 1 ? 'moderate' : 'low'
            anomalies.push({
              index: i,
              value: values[i],
              severity,
              score: sevScore,
              explanation: `Outside IQR fence [${lower.toFixed(3)}, ${upper.toFixed(3)}] by ${distance.toFixed(3)} (${sevScore.toFixed(2)}x IQR)`,
            })
          }
        }
      } else if (method === 'grubbs') {
        // Grubbs test for single outlier (two-sided)
        if (sd === 0) return '**No anomalies**: All values are identical.'
        // Find the point farthest from mean
        let maxIdx = 0, maxDev = 0
        for (let i = 0; i < values.length; i++) {
          const dev = Math.abs(values[i] - mu)
          if (dev > maxDev) { maxDev = dev; maxIdx = i }
        }
        const G = maxDev / sd
        // Critical value: t-distribution based
        const alpha = 0.05
        const tCrit = -normalInvCDF(alpha / (2 * n))
        const gCrit = ((n - 1) / Math.sqrt(n)) * Math.sqrt(tCrit * tCrit / (n - 2 + tCrit * tCrit))
        const pValue = G > gCrit ? alpha : 1 - (G / gCrit) * alpha

        if (G > gCrit) {
          anomalies.push({
            index: maxIdx,
            value: values[maxIdx],
            severity: G > gCrit * 1.5 ? 'extreme' : G > gCrit * 1.2 ? 'high' : 'moderate',
            score: G,
            explanation: `Grubbs G = ${G.toFixed(4)} > critical ${gCrit.toFixed(4)} (p < ${Math.max(pValue, 0.001).toFixed(4)})`,
          })
        }

        // Build output for Grubbs
        const lines: string[] = [
          `# Anomaly Detection: Grubbs Test`,
          '',
          `**Data**: ${n} values, mean = ${mu.toFixed(4)}, SD = ${sd.toFixed(4)}`,
          `**Test Statistic (G)**: ${G.toFixed(4)}`,
          `**Critical Value**: ${gCrit.toFixed(4)} (alpha = ${alpha})`,
          `**Most extreme point**: index ${maxIdx}, value = ${values[maxIdx]}`,
          '',
          G > gCrit
            ? `**Result**: Value ${values[maxIdx]} IS a significant outlier (G = ${G.toFixed(4)} > ${gCrit.toFixed(4)}, p < ${Math.max(pValue, 0.001).toFixed(4)}).`
            : `**Result**: No significant outlier detected (G = ${G.toFixed(4)} <= ${gCrit.toFixed(4)}).`,
          '',
          `> **Note**: Grubbs test detects only one outlier at a time. For multiple outliers, apply iteratively or use z-score/IQR method.`,
        ]
        return lines.join('\n')
      } else if (method === 'isolation') {
        // Isolation forest approximation: random split scoring
        const rng = new PRNG(42)
        const numTrees = 100
        const subSampleSize = Math.min(256, n)
        const avgPathLength = (size: number): number => {
          if (size <= 1) return 0
          if (size === 2) return 1
          const H = Math.log(size - 1) + 0.5772156649
          return 2 * H - 2 * (size - 1) / size
        }

        // For each point, estimate isolation depth
        const scores: number[] = new Array(n).fill(0)
        for (let t = 0; t < numTrees; t++) {
          // Sub-sample
          const indices: number[] = []
          for (let s = 0; s < subSampleSize; s++) {
            indices.push(Math.floor(rng.random() * n))
          }
          const subData = indices.map(i => values[i])

          // For each data point, simulate path length
          for (let i = 0; i < n; i++) {
            let depth = 0
            let lo = Math.min(...subData), hi = Math.max(...subData)
            let current = [...subData]
            const maxDepth = Math.ceil(Math.log2(subSampleSize))

            while (depth < maxDepth && current.length > 1) {
              if (hi - lo < 1e-10) break
              const splitVal = lo + rng.random() * (hi - lo)
              const left = current.filter(v => v < splitVal)
              const right = current.filter(v => v >= splitVal)
              if (values[i] < splitVal) {
                current = left
                hi = splitVal
              } else {
                current = right
                lo = splitVal
              }
              depth++
            }
            scores[i] += depth + avgPathLength(current.length)
          }
        }

        // Normalize to anomaly score: s(x) = 2^(-E[h(x)] / c(n))
        const c = avgPathLength(subSampleSize)
        const anomalyScores = scores.map(s => Math.pow(2, -(s / numTrees) / c))

        const isoThreshold = typeof args.threshold === 'number' ? args.threshold : 0.6
        for (let i = 0; i < n; i++) {
          if (anomalyScores[i] > isoThreshold) {
            const severity = anomalyScores[i] > 0.8 ? 'extreme' : anomalyScores[i] > 0.7 ? 'high' : 'moderate'
            anomalies.push({
              index: i,
              value: values[i],
              severity,
              score: anomalyScores[i],
              explanation: `Isolation score = ${anomalyScores[i].toFixed(4)} (threshold: ${isoThreshold}). Easier to isolate → more anomalous.`,
            })
          }
        }
      } else {
        return `**Error**: Unknown method "${method}". Use: zscore, iqr, grubbs, or isolation.`
      }

      // Build output
      const lines: string[] = [
        `# Anomaly Detection Report`,
        '',
        `**Method**: ${method}`,
        `**Data**: ${n} values, mean = ${mu.toFixed(4)}, SD = ${sd.toFixed(4)}, median = ${median(values).toFixed(4)}`,
        `**Threshold**: ${threshold}`,
        '',
      ]

      if (anomalies.length === 0) {
        lines.push(`**Result**: No anomalies detected at the given threshold.`)
        lines.push('')
        lines.push(`Consider lowering the threshold or trying a different method for more sensitivity.`)
      } else {
        anomalies.sort((a, b) => b.score - a.score)
        lines.push(`## Detected Anomalies (${anomalies.length})`)
        lines.push('')
        lines.push(`| Index | Value | Severity | Score | Explanation |`)
        lines.push(`|-------|-------|----------|-------|-------------|`)
        for (const a of anomalies) {
          lines.push(`| ${a.index} | ${a.value} | **${a.severity}** | ${a.score.toFixed(4)} | ${a.explanation} |`)
        }
        lines.push('')
        lines.push(`## Potential Explanations`)
        lines.push('')
        lines.push(`- **Measurement error**: Instrument malfunction, data entry mistake, or sensor drift`)
        lines.push(`- **Natural variation**: Rare but genuine extreme values in the population`)
        lines.push(`- **Subpopulation mixing**: Data from a different population mixed in`)
        lines.push(`- **Process change**: A regime shift or intervention affecting some data points`)
        lines.push('')
        lines.push(`> Investigate anomalies before removing them. Outliers may carry the most important information.`)
      }

      return lines.join('\n')
    },
  })

  // =========================================================================
  // 3. pattern_match
  // =========================================================================
  registerTool({
    name: 'pattern_match',
    description:
      'Find patterns across datasets or experimental results. Supports correlation, trend, periodicity (FFT), cluster (k-means), and change_point (CUSUM) detection.',
    parameters: {
      data_sets: {
        type: 'string',
        description: 'JSON array of {name, values} objects, e.g. [{"name":"A","values":[1,2,3]},{"name":"B","values":[4,5,6]}]',
        required: true,
      },
      pattern_type: {
        type: 'string',
        description: 'Pattern to detect: correlation, trend, periodicity, cluster, or change_point',
        required: true,
      },
    },
    tier: 'free',
    async execute(args) {
      const patternType = String(args.pattern_type).toLowerCase()
      let dataSets: Array<{ name: string; values: number[] }>

      try {
        dataSets = JSON.parse(String(args.data_sets))
        if (!Array.isArray(dataSets) || dataSets.length === 0) throw new Error('empty')
        for (const ds of dataSets) {
          if (!Array.isArray(ds.values)) throw new Error(`Dataset "${ds.name}" has no values array`)
          ds.values = ds.values.map(Number)
        }
      } catch (e: unknown) {
        return `**Error**: Invalid data_sets JSON. Expected array of {name, values} objects. ${e instanceof Error ? e.message : ''}`
      }

      const lines: string[] = [
        `# Pattern Analysis Report`,
        '',
        `**Pattern Type**: ${patternType}`,
        `**Datasets**: ${dataSets.map(d => `${d.name} (n=${d.values.length})`).join(', ')}`,
        '',
        `---`,
        '',
      ]

      if (patternType === 'correlation') {
        // Cross-correlation between all pairs of datasets
        lines.push(`## Correlation Matrix`)
        lines.push('')

        if (dataSets.length < 2) {
          lines.push('Need at least 2 datasets for correlation analysis.')
          return lines.join('\n')
        }

        // Header
        const header = ['Dataset', ...dataSets.map(d => d.name)].join(' | ')
        lines.push(`| ${header} |`)
        lines.push(`|${'---|'.repeat(dataSets.length + 1)}`)

        for (const dsA of dataSets) {
          const row = [dsA.name]
          for (const dsB of dataSets) {
            const r = pearsonCorrelation(dsA.values, dsB.values)
            row.push(r.toFixed(4))
          }
          lines.push(`| ${row.join(' | ')} |`)
        }

        lines.push('')
        lines.push(`## Interpretation`)
        lines.push('')

        // Report significant correlations
        for (let i = 0; i < dataSets.length; i++) {
          for (let j = i + 1; j < dataSets.length; j++) {
            const r = pearsonCorrelation(dataSets[i].values, dataSets[j].values)
            const n = Math.min(dataSets[i].values.length, dataSets[j].values.length)
            // t-test for correlation significance
            const t = n > 2 ? r * Math.sqrt((n - 2) / (1 - r * r + 1e-10)) : 0
            const df = n - 2
            const pValue = df > 0 ? 2 * (1 - tCDF(Math.abs(t), df)) : 1
            const strength = Math.abs(r) > 0.7 ? 'strong' : Math.abs(r) > 0.4 ? 'moderate' : Math.abs(r) > 0.2 ? 'weak' : 'negligible'
            const direction = r > 0 ? 'positive' : 'negative'
            const sig = pValue < 0.001 ? '***' : pValue < 0.01 ? '**' : pValue < 0.05 ? '*' : 'n.s.'

            lines.push(`- **${dataSets[i].name} vs ${dataSets[j].name}**: r = ${r.toFixed(4)}, ${strength} ${direction} correlation (t = ${t.toFixed(3)}, p ${pValue < 0.001 ? '< 0.001' : `= ${pValue.toFixed(4)}`} ${sig})`)
          }
        }
      } else if (patternType === 'trend') {
        // Mann-Kendall trend test
        lines.push(`## Trend Analysis (Mann-Kendall Test)`)
        lines.push('')

        for (const ds of dataSets) {
          const n = ds.values.length
          if (n < 4) {
            lines.push(`**${ds.name}**: Too few points for trend detection (need >= 4).`)
            continue
          }

          // Compute S statistic
          let S = 0
          for (let i = 0; i < n - 1; i++) {
            for (let j = i + 1; j < n; j++) {
              const diff = ds.values[j] - ds.values[i]
              if (diff > 0) S++
              else if (diff < 0) S--
            }
          }

          // Compute variance of S (accounting for ties)
          const tieGroups = new Map<number, number>()
          for (const v of ds.values) {
            tieGroups.set(v, (tieGroups.get(v) || 0) + 1)
          }
          let tieAdjust = 0
          for (const count of tieGroups.values()) {
            if (count > 1) tieAdjust += count * (count - 1) * (2 * count + 5)
          }
          const varS = (n * (n - 1) * (2 * n + 5) - tieAdjust) / 18

          // Z statistic
          let Z = 0
          if (S > 0) Z = (S - 1) / Math.sqrt(varS)
          else if (S < 0) Z = (S + 1) / Math.sqrt(varS)

          const pValue = 2 * (1 - normalCDF(Math.abs(Z)))
          const trend = Z > 0 ? 'increasing' : Z < 0 ? 'decreasing' : 'no trend'
          const sig = pValue < 0.001 ? 'highly significant' : pValue < 0.01 ? 'very significant' : pValue < 0.05 ? 'significant' : 'not significant'

          // Sen's slope
          const slopes: number[] = []
          for (let i = 0; i < n - 1; i++) {
            for (let j = i + 1; j < n; j++) {
              if (j !== i) slopes.push((ds.values[j] - ds.values[i]) / (j - i))
            }
          }
          slopes.sort((a, b) => a - b)
          const senSlope = median(slopes)

          lines.push(`### ${ds.name}`)
          lines.push('')
          lines.push(`| Metric | Value |`)
          lines.push(`|--------|-------|`)
          lines.push(`| S statistic | ${S} |`)
          lines.push(`| Variance(S) | ${varS.toFixed(2)} |`)
          lines.push(`| Z score | ${Z.toFixed(4)} |`)
          lines.push(`| p-value | ${pValue < 0.001 ? '< 0.001' : pValue.toFixed(4)} |`)
          lines.push(`| Trend | **${trend}** (${sig}) |`)
          lines.push(`| Sen's slope | ${senSlope.toFixed(6)} per unit |`)
          lines.push('')
        }
      } else if (patternType === 'periodicity') {
        // FFT-based periodicity detection
        lines.push(`## Periodicity Analysis (FFT)`)
        lines.push('')

        for (const ds of dataSets) {
          const n = ds.values.length
          if (n < 8) {
            lines.push(`**${ds.name}**: Too few points for FFT (need >= 8).`)
            continue
          }

          // Zero-mean
          const mu = mean(ds.values)
          const centered = ds.values.map(v => v - mu)

          // DFT (not radix-2 FFT, but works for any n)
          const halfN = Math.floor(n / 2)
          const magnitudes: number[] = []
          const frequencies: number[] = []

          for (let k = 1; k <= halfN; k++) {
            let realPart = 0, imagPart = 0
            for (let t = 0; t < n; t++) {
              const angle = (2 * Math.PI * k * t) / n
              realPart += centered[t] * Math.cos(angle)
              imagPart -= centered[t] * Math.sin(angle)
            }
            const magnitude = Math.sqrt(realPart * realPart + imagPart * imagPart) / n
            magnitudes.push(magnitude)
            frequencies.push(k / n)
          }

          // Find dominant frequencies
          const maxMag = Math.max(...magnitudes)
          const dominantThreshold = maxMag * 0.3

          interface Peak {
            frequency: number
            period: number
            magnitude: number
            relativeStrength: number
          }

          const peaks: Peak[] = []
          for (let i = 0; i < magnitudes.length; i++) {
            if (magnitudes[i] >= dominantThreshold) {
              const isPeak = (i === 0 || magnitudes[i] >= magnitudes[i - 1]) &&
                             (i === magnitudes.length - 1 || magnitudes[i] >= magnitudes[i + 1])
              if (isPeak) {
                peaks.push({
                  frequency: frequencies[i],
                  period: 1 / frequencies[i],
                  magnitude: magnitudes[i],
                  relativeStrength: magnitudes[i] / maxMag,
                })
              }
            }
          }

          peaks.sort((a, b) => b.magnitude - a.magnitude)

          lines.push(`### ${ds.name}`)
          lines.push('')
          if (peaks.length === 0) {
            lines.push(`No significant periodic components detected.`)
          } else {
            lines.push(`| Rank | Period | Frequency | Magnitude | Relative Strength |`)
            lines.push(`|------|--------|-----------|-----------|-------------------|`)
            for (let i = 0; i < Math.min(peaks.length, 5); i++) {
              const p = peaks[i]
              lines.push(`| ${i + 1} | ${p.period.toFixed(2)} | ${p.frequency.toFixed(4)} | ${p.magnitude.toFixed(4)} | ${(p.relativeStrength * 100).toFixed(1)}% |`)
            }
            lines.push('')
            lines.push(`**Dominant period**: ${peaks[0].period.toFixed(2)} time units (frequency = ${peaks[0].frequency.toFixed(4)})`)
          }
          lines.push('')
        }
      } else if (patternType === 'cluster') {
        // K-means clustering (Lloyd's algorithm)
        lines.push(`## Cluster Analysis (K-Means)`)
        lines.push('')

        // Combine all datasets into feature vectors
        const maxLen = Math.max(...dataSets.map(d => d.values.length))
        const features: number[][] = []
        for (let i = 0; i < maxLen; i++) {
          const point: number[] = []
          for (const ds of dataSets) {
            point.push(i < ds.values.length ? ds.values[i] : 0)
          }
          features.push(point)
        }

        // Determine k using elbow heuristic (try 2-6)
        function kMeans(data: number[][], k: number, maxIter = 100): {
          assignments: number[]
          centroids: number[][]
          inertia: number
        } {
          const dim = data[0].length
          const rng = new PRNG(42 + k)

          // Initialize centroids (k-means++)
          const centroids: number[][] = []
          centroids.push([...data[Math.floor(rng.random() * data.length)]])

          for (let c = 1; c < k; c++) {
            const dists = data.map(p => {
              let minD = Infinity
              for (const cent of centroids) {
                let d = 0
                for (let j = 0; j < dim; j++) d += (p[j] - cent[j]) ** 2
                minD = Math.min(minD, d)
              }
              return minD
            })
            const totalDist = dists.reduce((a, b) => a + b, 0)
            let r = rng.random() * totalDist
            for (let i = 0; i < data.length; i++) {
              r -= dists[i]
              if (r <= 0) { centroids.push([...data[i]]); break }
            }
            if (centroids.length <= c) centroids.push([...data[Math.floor(rng.random() * data.length)]])
          }

          let assignments = new Array(data.length).fill(0)
          for (let iter = 0; iter < maxIter; iter++) {
            // Assign
            const newAssignments = data.map(p => {
              let bestK = 0, bestD = Infinity
              for (let c = 0; c < k; c++) {
                let d = 0
                for (let j = 0; j < dim; j++) d += (p[j] - centroids[c][j]) ** 2
                if (d < bestD) { bestD = d; bestK = c }
              }
              return bestK
            })
            // Update centroids
            let changed = false
            for (let c = 0; c < k; c++) {
              const members = data.filter((_, i) => newAssignments[i] === c)
              if (members.length === 0) continue
              for (let j = 0; j < dim; j++) {
                const newVal = mean(members.map(m => m[j]))
                if (Math.abs(centroids[c][j] - newVal) > 1e-10) changed = true
                centroids[c][j] = newVal
              }
            }
            assignments = newAssignments
            if (!changed) break
          }

          // Compute inertia
          let inertia = 0
          for (let i = 0; i < data.length; i++) {
            for (let j = 0; j < dim; j++) {
              inertia += (data[i][j] - centroids[assignments[i]][j]) ** 2
            }
          }

          return { assignments, centroids, inertia }
        }

        const maxK = Math.min(6, features.length - 1)
        const results: Array<{ k: number; inertia: number }> = []
        let bestK = 2

        for (let k = 1; k <= maxK; k++) {
          const res = kMeans(features, k)
          results.push({ k, inertia: res.inertia })
        }

        // Elbow detection: largest drop in inertia
        if (results.length >= 3) {
          let maxDrop = 0
          for (let i = 1; i < results.length - 1; i++) {
            const drop = (results[i - 1].inertia - results[i].inertia) - (results[i].inertia - results[i + 1].inertia)
            if (drop > maxDrop) { maxDrop = drop; bestK = results[i].k }
          }
        }

        const finalResult = kMeans(features, bestK)

        lines.push(`**Optimal k**: ${bestK} (elbow method)`)
        lines.push('')
        lines.push(`### Elbow Curve`)
        lines.push('')
        lines.push(`| k | Inertia |`)
        lines.push(`|---|---------|`)
        for (const r of results) {
          lines.push(`| ${r.k} | ${r.inertia.toFixed(2)} |`)
        }
        lines.push('')

        lines.push(`### Cluster Assignments (k=${bestK})`)
        lines.push('')
        for (let c = 0; c < bestK; c++) {
          const members = finalResult.assignments
            .map((a, i) => a === c ? i : -1)
            .filter(i => i >= 0)
          lines.push(`**Cluster ${c + 1}** (${members.length} points): indices [${members.slice(0, 20).join(', ')}${members.length > 20 ? '...' : ''}]`)
          lines.push(`  Centroid: [${finalResult.centroids[c].map(v => v.toFixed(3)).join(', ')}]`)
          lines.push('')
        }
        lines.push(`**Total inertia**: ${finalResult.inertia.toFixed(4)}`)
      } else if (patternType === 'change_point') {
        // CUSUM algorithm for regime change detection
        lines.push(`## Change Point Detection (CUSUM)`)
        lines.push('')

        for (const ds of dataSets) {
          const n = ds.values.length
          if (n < 5) {
            lines.push(`**${ds.name}**: Too few points (need >= 5).`)
            continue
          }

          const mu = mean(ds.values)
          const sd = stddev(ds.values, mu)

          // CUSUM: cumulative sum of deviations from mean
          const cusum: number[] = []
          let cumSum = 0
          for (const v of ds.values) {
            cumSum += (v - mu)
            cusum.push(cumSum)
          }

          // Detect change points: where CUSUM changes sign or has max absolute value
          const changePoints: Array<{ index: number; value: number; cusum: number; direction: string }> = []

          // Method 1: Maximum absolute CUSUM value
          let maxAbsCusum = 0, maxIdx = 0
          for (let i = 0; i < cusum.length; i++) {
            if (Math.abs(cusum[i]) > maxAbsCusum) {
              maxAbsCusum = Math.abs(cusum[i])
              maxIdx = i
            }
          }

          // Significance: compare to threshold h = 4 * SD or 5 * SD
          const h = 4 * sd
          if (maxAbsCusum > h) {
            changePoints.push({
              index: maxIdx,
              value: ds.values[maxIdx],
              cusum: cusum[maxIdx],
              direction: cusum[maxIdx] > 0 ? 'upward shift' : 'downward shift',
            })
          }

          // Method 2: Sign changes in CUSUM
          for (let i = 1; i < cusum.length; i++) {
            if ((cusum[i - 1] > 0 && cusum[i] < 0) || (cusum[i - 1] < 0 && cusum[i] > 0)) {
              // Verify this is a real change, not noise
              const leftMean = mean(ds.values.slice(Math.max(0, i - 3), i))
              const rightMean = mean(ds.values.slice(i, Math.min(n, i + 3)))
              if (Math.abs(rightMean - leftMean) > sd * 0.5) {
                // Check for duplicates
                const isDup = changePoints.some(cp => Math.abs(cp.index - i) < 3)
                if (!isDup) {
                  changePoints.push({
                    index: i,
                    value: ds.values[i],
                    cusum: cusum[i],
                    direction: rightMean > leftMean ? 'upward shift' : 'downward shift',
                  })
                }
              }
            }
          }

          lines.push(`### ${ds.name}`)
          lines.push('')
          lines.push(`**Mean**: ${mu.toFixed(4)}, **SD**: ${sd.toFixed(4)}, **Detection threshold**: ${h.toFixed(4)}`)
          lines.push('')

          if (changePoints.length === 0) {
            lines.push(`No significant change points detected. The data appears stationary.`)
          } else {
            changePoints.sort((a, b) => a.index - b.index)
            lines.push(`| Index | Value | CUSUM | Direction |`)
            lines.push(`|-------|-------|-------|-----------|`)
            for (const cp of changePoints) {
              lines.push(`| ${cp.index} | ${cp.value.toFixed(4)} | ${cp.cusum.toFixed(4)} | ${cp.direction} |`)
            }
            lines.push('')

            // Report segments
            const breakpoints = [0, ...changePoints.map(cp => cp.index), n]
            lines.push(`### Segments`)
            lines.push('')
            for (let s = 0; s < breakpoints.length - 1; s++) {
              const seg = ds.values.slice(breakpoints[s], breakpoints[s + 1])
              if (seg.length > 0) {
                lines.push(`- **Segment ${s + 1}** [${breakpoints[s]}:${breakpoints[s + 1]}]: mean = ${mean(seg).toFixed(4)}, sd = ${seg.length > 1 ? stddev(seg).toFixed(4) : 'N/A'}, n = ${seg.length}`)
              }
            }
          }
          lines.push('')
        }
      } else {
        return `**Error**: Unknown pattern_type "${patternType}". Use: correlation, trend, periodicity, cluster, or change_point.`
      }

      return lines.join('\n')
    },
  })

  // =========================================================================
  // 4. experiment_simulate
  // =========================================================================
  registerTool({
    name: 'experiment_simulate',
    description:
      'Simulate an experiment before running it. Uses Monte Carlo simulation to estimate statistical power, type I/II error rates, and required sample size. Helps decide if an experiment is worth running.',
    parameters: {
      hypothesis: {
        type: 'string',
        description: 'The hypothesis being tested (for labeling)',
        required: true,
      },
      sample_size: {
        type: 'number',
        description: 'Planned sample size per group',
        required: true,
      },
      effect_size: {
        type: 'number',
        description: "Expected Cohen's d effect size (0.2 = small, 0.5 = medium, 0.8 = large)",
        required: true,
      },
      noise_level: {
        type: 'number',
        description: 'Noise standard deviation relative to effect (default: 0.1 means 10% noise)',
      },
      simulations: {
        type: 'number',
        description: 'Number of Monte Carlo simulations (default: 1000)',
      },
    },
    tier: 'free',
    async execute(args) {
      const hypothesis = String(args.hypothesis)
      const sampleSize = Math.max(2, Math.round(Number(args.sample_size)))
      const effectSize = Number(args.effect_size)
      const noiseLevel = typeof args.noise_level === 'number' ? args.noise_level : 0.1
      const numSims = typeof args.simulations === 'number' ? Math.min(Math.max(100, args.simulations), 10000) : 1000

      const alpha = 0.05
      const rng = new PRNG(12345)

      // Two-sample t-test simulation
      function simulateTTest(d: number, n: number): { pValue: number; tStat: number } {
        // Generate two groups
        const group1: number[] = []
        const group2: number[] = []
        for (let i = 0; i < n; i++) {
          group1.push(rng.normal(0, 1 + noiseLevel))
          group2.push(rng.normal(d, 1 + noiseLevel))
        }
        const m1 = mean(group1), m2 = mean(group2)
        const v1 = variance(group1, m1), v2 = variance(group2, m2)
        const pooledSE = Math.sqrt(v1 / n + v2 / n)
        if (pooledSE === 0) return { pValue: 1, tStat: 0 }
        const t = (m2 - m1) / pooledSE
        const df = n + n - 2
        const pValue = 2 * (1 - tCDF(Math.abs(t), df))
        return { pValue, tStat: t }
      }

      // Simulate under H0 (no effect) — estimate type I error
      let typeIErrors = 0
      for (let i = 0; i < numSims; i++) {
        const result = simulateTTest(0, sampleSize)
        if (result.pValue < alpha) typeIErrors++
      }
      const typeIRate = typeIErrors / numSims

      // Simulate under H1 (real effect) — estimate power
      let rejects = 0
      const pValues: number[] = []
      for (let i = 0; i < numSims; i++) {
        const result = simulateTTest(effectSize, sampleSize)
        pValues.push(result.pValue)
        if (result.pValue < alpha) rejects++
      }
      const power = rejects / numSims
      const typeIIRate = 1 - power

      // Compute power curve for different sample sizes
      const powerCurve: Array<{ n: number; power: number }> = []
      const nValues = [5, 10, 15, 20, 30, 50, 75, 100, 150, 200, 300, 500]
      for (const n of nValues) {
        let rejCount = 0
        const quickSims = Math.min(500, numSims)
        for (let i = 0; i < quickSims; i++) {
          const result = simulateTTest(effectSize, n)
          if (result.pValue < alpha) rejCount++
        }
        powerCurve.push({ n, power: rejCount / quickSims })
      }

      // Find minimum sample size for 80% power
      let minN80 = nValues[nValues.length - 1]
      for (const pc of powerCurve) {
        if (pc.power >= 0.80) { minN80 = pc.n; break }
      }

      // Analytical power estimate (for comparison)
      const analyticalPower = normalCDF(effectSize * Math.sqrt(sampleSize / 2) - normalInvCDF(1 - alpha / 2))

      // Recommendation
      let recommendation: string
      if (power >= 0.8) {
        recommendation = 'The experiment is well-powered. Proceed with the planned design.'
      } else if (power >= 0.5) {
        recommendation = `The experiment has moderate power. Consider increasing sample size to ${minN80} for 80% power.`
      } else {
        recommendation = `The experiment is underpowered (${(power * 100).toFixed(1)}%). You would need approximately ${minN80} samples per group for adequate power. Consider whether the expected effect size is realistic.`
      }

      const lines: string[] = [
        `# Experiment Simulation Report`,
        '',
        `**Hypothesis**: ${hypothesis}`,
        `**Planned sample size**: ${sampleSize} per group`,
        `**Expected effect size (Cohen's d)**: ${effectSize}`,
        `**Noise level**: ${noiseLevel}`,
        `**Simulations**: ${numSims}`,
        `**Significance level (alpha)**: ${alpha}`,
        '',
        `---`,
        '',
        `## Results`,
        '',
        `| Metric | Value |`,
        `|--------|-------|`,
        `| **Statistical Power** | ${(power * 100).toFixed(1)}% |`,
        `| **Type I Error Rate** | ${(typeIRate * 100).toFixed(1)}% (nominal: ${(alpha * 100).toFixed(1)}%) |`,
        `| **Type II Error Rate** | ${(typeIIRate * 100).toFixed(1)}% |`,
        `| **Analytical Power (approx.)** | ${(analyticalPower * 100).toFixed(1)}% |`,
        `| **Min n for 80% power** | ~${minN80} per group |`,
        '',
        `## Power Curve`,
        '',
        `| Sample Size (per group) | Estimated Power |`,
        `|-------------------------|-----------------|`,
      ]

      for (const pc of powerCurve) {
        const bar = '#'.repeat(Math.round(pc.power * 30))
        lines.push(`| ${String(pc.n).padStart(4)} | ${(pc.power * 100).toFixed(1).padStart(5)}% ${bar} |`)
      }

      lines.push('')
      lines.push(`## P-Value Distribution (under H1)`)
      lines.push('')

      // Histogram of p-values
      const bins = [0.001, 0.01, 0.05, 0.10, 0.25, 0.50, 1.0]
      const binCounts = new Array(bins.length).fill(0)
      for (const p of pValues) {
        for (let b = 0; b < bins.length; b++) {
          if (p <= bins[b]) { binCounts[b]++; break }
        }
      }

      lines.push(`| P-value Range | Count | Percentage |`)
      lines.push(`|---------------|-------|------------|`)
      let prevBin = 0
      for (let b = 0; b < bins.length; b++) {
        const pct = (binCounts[b] / numSims * 100).toFixed(1)
        lines.push(`| ${prevBin} - ${bins[b]} | ${binCounts[b]} | ${pct}% |`)
        prevBin = bins[b]
      }

      lines.push('')
      lines.push(`## Recommendation`)
      lines.push('')
      lines.push(recommendation)

      return lines.join('\n')
    },
  })

  // =========================================================================
  // 5. research_gap_finder
  // =========================================================================
  registerTool({
    name: 'research_gap_finder',
    description:
      'Identify gaps in scientific literature for a given topic. Queries OpenAlex for publication trends, most-cited subtopics, and least-explored areas. Suggests research questions for unexplored territory.',
    parameters: {
      topic: {
        type: 'string',
        description: 'Research topic to analyze',
        required: true,
      },
      field: {
        type: 'string',
        description: 'Scientific field for context (e.g. neuroscience, machine_learning, ecology)',
        required: true,
      },
    },
    tier: 'free',
    async execute(args) {
      const topic = String(args.topic)
      const field = String(args.field)
      const encodedTopic = encodeURIComponent(topic)

      const lines: string[] = [
        `# Research Gap Analysis`,
        '',
        `**Topic**: ${topic}`,
        `**Field**: ${field}`,
        '',
        `---`,
        '',
      ]

      // Query OpenAlex for works grouped by year
      let yearData: Array<{ year: string; count: number }> = []
      try {
        const yearRes = await fetch(
          `https://api.openalex.org/works?search=${encodedTopic}&group_by=publication_year&per_page=50`,
          { headers: { 'User-Agent': 'KBot/3.0 (mailto:kernel.chat@gmail.com)' }, signal: AbortSignal.timeout(10000) }
        )
        if (yearRes.ok) {
          const yearJson = await yearRes.json() as { group_by?: Array<{ key: string; count: number }> }
          if (yearJson.group_by) {
            yearData = yearJson.group_by
              .map((g: { key: string; count: number }) => ({ year: String(g.key), count: Number(g.count) }))
              .filter((g: { year: string; count: number }) => {
                const y = parseInt(g.year)
                return y >= 2015 && y <= 2026
              })
              .sort((a: { year: string }, b: { year: string }) => a.year.localeCompare(b.year))
          }
        }
      } catch { /* API unavailable — continue with what we have */ }

      // Query OpenAlex for related concepts
      let conceptData: Array<{ name: string; score: number; works_count: number }> = []
      try {
        const conceptRes = await fetch(
          `https://api.openalex.org/concepts?search=${encodedTopic}&per_page=20`,
          { headers: { 'User-Agent': 'KBot/3.0 (mailto:kernel.chat@gmail.com)' }, signal: AbortSignal.timeout(10000) }
        )
        if (conceptRes.ok) {
          const conceptJson = await conceptRes.json() as {
            results?: Array<{ display_name: string; relevance_score?: number; works_count?: number }>
          }
          if (conceptJson.results) {
            conceptData = conceptJson.results.map((c: { display_name: string; relevance_score?: number; works_count?: number }) => ({
              name: c.display_name,
              score: c.relevance_score || 0,
              works_count: c.works_count || 0,
            }))
          }
        }
      } catch { /* continue */ }

      // Query for recent high-impact works
      let recentWorks: Array<{ title: string; year: number; cited: number }> = []
      try {
        const worksRes = await fetch(
          `https://api.openalex.org/works?search=${encodedTopic}&sort=cited_by_count:desc&per_page=10&filter=from_publication_date:2020-01-01`,
          { headers: { 'User-Agent': 'KBot/3.0 (mailto:kernel.chat@gmail.com)' }, signal: AbortSignal.timeout(10000) }
        )
        if (worksRes.ok) {
          const worksJson = await worksRes.json() as {
            results?: Array<{ title: string; publication_year: number; cited_by_count: number }>
          }
          if (worksJson.results) {
            recentWorks = worksJson.results.map((w: { title: string; publication_year: number; cited_by_count: number }) => ({
              title: w.title,
              year: w.publication_year,
              cited: w.cited_by_count,
            }))
          }
        }
      } catch { /* continue */ }

      // Publication trends
      if (yearData.length > 0) {
        lines.push(`## Publication Trends`)
        lines.push('')
        lines.push(`| Year | Publications |`)
        lines.push(`|------|-------------|`)
        for (const yd of yearData) {
          const bar = '#'.repeat(Math.min(40, Math.round(yd.count / Math.max(1, Math.max(...yearData.map(y => y.count))) * 40)))
          lines.push(`| ${yd.year} | ${yd.count.toLocaleString()} ${bar} |`)
        }
        lines.push('')

        // Trend analysis
        if (yearData.length >= 3) {
          const counts = yearData.map(y => y.count)
          const recentGrowth = counts.length >= 2
            ? ((counts[counts.length - 1] - counts[counts.length - 2]) / Math.max(1, counts[counts.length - 2]) * 100)
            : 0
          const overallTrend = counts[counts.length - 1] > counts[0] ? 'growing' : counts[counts.length - 1] < counts[0] ? 'declining' : 'stable'
          lines.push(`**Trend**: ${overallTrend} (recent YoY change: ${recentGrowth > 0 ? '+' : ''}${recentGrowth.toFixed(1)}%)`)
          lines.push('')
        }
      } else {
        lines.push(`> Could not retrieve publication trends from OpenAlex. The API may be temporarily unavailable.`)
        lines.push('')
      }

      // Related concepts
      if (conceptData.length > 0) {
        lines.push(`## Related Concepts & Subtopics`)
        lines.push('')

        const sortedByWorks = [...conceptData].sort((a, b) => b.works_count - a.works_count)
        const mostExplored = sortedByWorks.slice(0, 5)
        const leastExplored = sortedByWorks.slice(-5).reverse()

        lines.push(`### Most-Explored Subtopics`)
        lines.push('')
        lines.push(`| Concept | Works Count |`)
        lines.push(`|---------|-------------|`)
        for (const c of mostExplored) {
          lines.push(`| ${c.name} | ${c.works_count.toLocaleString()} |`)
        }
        lines.push('')

        lines.push(`### Least-Explored Subtopics (Potential Gaps)`)
        lines.push('')
        lines.push(`| Concept | Works Count |`)
        lines.push(`|---------|-------------|`)
        for (const c of leastExplored) {
          lines.push(`| ${c.name} | ${c.works_count.toLocaleString()} |`)
        }
        lines.push('')
      }

      // High-impact recent works
      if (recentWorks.length > 0) {
        lines.push(`## High-Impact Recent Works`)
        lines.push('')
        lines.push(`| Title | Year | Citations |`)
        lines.push(`|-------|------|-----------|`)
        for (const w of recentWorks.slice(0, 8)) {
          lines.push(`| ${w.title.slice(0, 80)}${w.title.length > 80 ? '...' : ''} | ${w.year} | ${w.cited} |`)
        }
        lines.push('')
      }

      // Identified gaps and suggested research questions
      lines.push(`## Identified Gaps`)
      lines.push('')

      const gaps: string[] = []

      if (conceptData.length > 0) {
        const leastExplored = [...conceptData].sort((a, b) => a.works_count - b.works_count).slice(0, 3)
        for (const c of leastExplored) {
          gaps.push(`**${c.name}** has relatively few publications (${c.works_count.toLocaleString()} works) — may represent an underexplored connection to ${topic}.`)
        }
      }

      if (yearData.length >= 3) {
        const counts = yearData.map(y => y.count)
        const recentAvg = mean(counts.slice(-3))
        const earlyAvg = mean(counts.slice(0, 3))
        if (recentAvg > earlyAvg * 1.5) {
          gaps.push(`The field is experiencing rapid growth — new sub-areas are likely emerging faster than the literature can consolidate. Look for contradictory findings or unresolved debates.`)
        }
        if (recentAvg < earlyAvg * 0.7) {
          gaps.push(`Publication volume is declining — this may indicate the low-hanging fruit has been picked. High-impact work may require novel methodologies or interdisciplinary approaches.`)
        }
      }

      if (gaps.length === 0) {
        gaps.push(`Direct gap identification requires deeper analysis. Use the suggested research questions below as starting points.`)
      }

      for (const g of gaps) {
        lines.push(`- ${g}`)
      }

      lines.push('')
      lines.push(`## Suggested Research Questions`)
      lines.push('')
      lines.push(`1. What mechanisms underlie the relationship between ${topic} and ${conceptData[0]?.name || 'related phenomena'} in ${field}?`)
      lines.push(`2. How do recent findings in ${topic} translate to ${conceptData[conceptData.length - 1]?.name || 'adjacent fields'}?`)
      lines.push(`3. What methodological limitations in current ${topic} research could be addressed by ${field === 'computer_science' ? 'novel computational approaches' : 'new experimental paradigms'}?`)
      lines.push(`4. Are the reported effect sizes in ${topic} research reproducible? (Use \`meta_analysis\` and \`reproducibility_check\` to investigate)`)
      lines.push(`5. What cross-disciplinary connections between ${topic} and underexplored areas remain untested?`)

      return lines.join('\n')
    },
  })

  // =========================================================================
  // 6. meta_analysis
  // =========================================================================
  registerTool({
    name: 'meta_analysis',
    description:
      'Perform a meta-analysis on reported effect sizes from multiple studies. Supports fixed-effects (inverse-variance) and random-effects (DerSimonian-Laird) models. Reports pooled effect, CI, heterogeneity (I², Q), forest plot data, and publication bias (Egger\'s test).',
    parameters: {
      studies: {
        type: 'string',
        description: 'JSON array of studies: [{name, effect_size, se, n, weight?}, ...]',
        required: true,
      },
      method: {
        type: 'string',
        description: 'Meta-analysis method: fixed or random (default: random)',
      },
    },
    tier: 'free',
    async execute(args) {
      const method = (args.method ? String(args.method) : 'random').toLowerCase()

      interface Study {
        name: string
        effect_size: number
        se: number
        n: number
        weight?: number
      }

      let studies: Study[]
      try {
        studies = JSON.parse(String(args.studies))
        if (!Array.isArray(studies) || studies.length < 2) {
          return '**Error**: Need at least 2 studies for meta-analysis.'
        }
      } catch {
        return '**Error**: Invalid JSON. Expected array of {name, effect_size, se, n} objects.'
      }

      const k = studies.length // number of studies

      // Fixed-effects: inverse-variance weighted
      const fixedWeights = studies.map(s => 1 / (s.se * s.se))
      const totalFixedWeight = fixedWeights.reduce((a, b) => a + b, 0)
      const fixedPooled = fixedWeights.reduce((sum, w, i) => sum + w * studies[i].effect_size, 0) / totalFixedWeight
      const fixedSE = Math.sqrt(1 / totalFixedWeight)
      const fixedCI = [fixedPooled - 1.96 * fixedSE, fixedPooled + 1.96 * fixedSE]

      // Q statistic for heterogeneity
      const Q = fixedWeights.reduce((sum, w, i) => sum + w * (studies[i].effect_size - fixedPooled) ** 2, 0)
      const df = k - 1
      const qPValue = 1 - chiSquaredCDF(Q, df)

      // I² statistic
      const I2 = Math.max(0, ((Q - df) / Q) * 100)

      // DerSimonian-Laird estimator for tau² (between-study variance)
      const C = totalFixedWeight - fixedWeights.reduce((s, w) => s + w * w, 0) / totalFixedWeight
      const tau2 = Math.max(0, (Q - df) / C)

      // Random-effects weights
      const randomWeights = studies.map(s => 1 / (s.se * s.se + tau2))
      const totalRandomWeight = randomWeights.reduce((a, b) => a + b, 0)
      const randomPooled = randomWeights.reduce((sum, w, i) => sum + w * studies[i].effect_size, 0) / totalRandomWeight
      const randomSE = Math.sqrt(1 / totalRandomWeight)
      const randomCI = [randomPooled - 1.96 * randomSE, randomPooled + 1.96 * randomSE]

      // Select model
      const isRandom = method === 'random'
      const pooled = isRandom ? randomPooled : fixedPooled
      const pooledSE = isRandom ? randomSE : fixedSE
      const ci = isRandom ? randomCI : fixedCI
      const weights = isRandom ? randomWeights : fixedWeights
      const totalWeight = isRandom ? totalRandomWeight : totalFixedWeight

      // Egger's test for publication bias (weighted regression of effect / SE on 1/SE)
      const precision = studies.map(s => 1 / s.se)
      const snd = studies.map(s => s.effect_size / s.se) // standard normal deviate
      // Weighted linear regression: SND = a + b * precision
      const n = studies.length
      const mPrec = mean(precision)
      const mSND = mean(snd)
      let ssPrec = 0, ssPrecSND = 0
      for (let i = 0; i < n; i++) {
        ssPrec += (precision[i] - mPrec) ** 2
        ssPrecSND += (precision[i] - mPrec) * (snd[i] - mSND)
      }
      const eggerSlope = ssPrec > 0 ? ssPrecSND / ssPrec : 0
      const eggerIntercept = mSND - eggerSlope * mPrec
      // t-test for intercept
      const residuals = snd.map((s, i) => s - (eggerIntercept + eggerSlope * precision[i]))
      const residSE = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / (n - 2))
      const interceptSE = residSE * Math.sqrt(1 / n + mPrec * mPrec / ssPrec)
      const eggerT = interceptSE > 0 ? eggerIntercept / interceptSE : 0
      const eggerP = n > 2 ? 2 * (1 - tCDF(Math.abs(eggerT), n - 2)) : 1

      // Build output
      const lines: string[] = [
        `# Meta-Analysis Report`,
        '',
        `**Model**: ${isRandom ? 'Random Effects (DerSimonian-Laird)' : 'Fixed Effects (Inverse-Variance)'}`,
        `**Studies**: ${k}`,
        `**Total N**: ${studies.reduce((s, st) => s + st.n, 0)}`,
        '',
        `---`,
        '',
        `## Pooled Results`,
        '',
        `| Metric | Value |`,
        `|--------|-------|`,
        `| **Pooled Effect Size** | ${pooled.toFixed(4)} |`,
        `| **Standard Error** | ${pooledSE.toFixed(4)} |`,
        `| **95% CI** | [${ci[0].toFixed(4)}, ${ci[1].toFixed(4)}] |`,
        `| **Z** | ${(pooled / pooledSE).toFixed(4)} |`,
        `| **p-value** | ${(2 * (1 - normalCDF(Math.abs(pooled / pooledSE)))).toFixed(6)} |`,
        '',
        `## Heterogeneity`,
        '',
        `| Metric | Value |`,
        `|--------|-------|`,
        `| **Q statistic** | ${Q.toFixed(4)} (df = ${df}, p = ${qPValue < 0.001 ? '< 0.001' : qPValue.toFixed(4)}) |`,
        `| **I²** | ${I2.toFixed(1)}% |`,
        `| **tau²** | ${tau2.toFixed(6)} |`,
        `| **tau** | ${Math.sqrt(tau2).toFixed(4)} |`,
        '',
        I2 < 25 ? '**Interpretation**: Low heterogeneity — studies are consistent.' :
        I2 < 50 ? '**Interpretation**: Moderate heterogeneity — some variation between studies.' :
        I2 < 75 ? '**Interpretation**: Substantial heterogeneity — consider subgroup analysis or moderator search.' :
        '**Interpretation**: Considerable heterogeneity — pooled estimate should be interpreted cautiously.',
        '',
        `## Forest Plot Data`,
        '',
        `| Study | Effect | SE | 95% CI | Weight |`,
        `|-------|--------|----|--------|--------|`,
      ]

      for (let i = 0; i < k; i++) {
        const s = studies[i]
        const sCI = [s.effect_size - 1.96 * s.se, s.effect_size + 1.96 * s.se]
        const relWeight = (weights[i] / totalWeight * 100)
        lines.push(`| ${s.name} | ${s.effect_size.toFixed(4)} | ${s.se.toFixed(4)} | [${sCI[0].toFixed(3)}, ${sCI[1].toFixed(3)}] | ${relWeight.toFixed(1)}% |`)
      }

      lines.push(`| **Pooled** | **${pooled.toFixed(4)}** | **${pooledSE.toFixed(4)}** | **[${ci[0].toFixed(3)}, ${ci[1].toFixed(3)}]** | **100%** |`)
      lines.push('')

      // Visual forest plot (ASCII)
      lines.push(`### ASCII Forest Plot`)
      lines.push('')

      const allLower = Math.min(...studies.map(s => s.effect_size - 2 * s.se), ci[0])
      const allUpper = Math.max(...studies.map(s => s.effect_size + 2 * s.se), ci[1])
      const range = allUpper - allLower || 1
      const plotWidth = 50

      for (let i = 0; i < k; i++) {
        const s = studies[i]
        const pos = Math.round(((s.effect_size - allLower) / range) * plotWidth)
        const ciLo = Math.round(((s.effect_size - 1.96 * s.se - allLower) / range) * plotWidth)
        const ciHi = Math.round(((s.effect_size + 1.96 * s.se - allLower) / range) * plotWidth)
        const row = new Array(plotWidth + 1).fill(' ')
        for (let j = Math.max(0, ciLo); j <= Math.min(plotWidth, ciHi); j++) row[j] = '-'
        row[Math.max(0, Math.min(plotWidth, pos))] = '*'
        const label = s.name.padEnd(15).slice(0, 15)
        lines.push(`${label} |${row.join('')}|`)
      }
      // Pooled
      const pooledPos = Math.round(((pooled - allLower) / range) * plotWidth)
      const pooledRow = new Array(plotWidth + 1).fill(' ')
      const pLo = Math.round(((ci[0] - allLower) / range) * plotWidth)
      const pHi = Math.round(((ci[1] - allLower) / range) * plotWidth)
      for (let j = Math.max(0, pLo); j <= Math.min(plotWidth, pHi); j++) pooledRow[j] = '='
      pooledRow[Math.max(0, Math.min(plotWidth, pooledPos))] = '#'
      lines.push(`${'Pooled'.padEnd(15)} |${pooledRow.join('')}|`)
      lines.push('')

      // Publication bias
      lines.push(`## Publication Bias (Egger's Test)`)
      lines.push('')
      lines.push(`| Metric | Value |`)
      lines.push(`|--------|-------|`)
      lines.push(`| **Intercept** | ${eggerIntercept.toFixed(4)} |`)
      lines.push(`| **SE** | ${interceptSE.toFixed(4)} |`)
      lines.push(`| **t** | ${eggerT.toFixed(4)} |`)
      lines.push(`| **p-value** | ${eggerP < 0.001 ? '< 0.001' : eggerP.toFixed(4)} |`)
      lines.push('')
      lines.push(
        eggerP < 0.05
          ? '**Warning**: Egger\'s test suggests significant funnel plot asymmetry (p < 0.05), indicating potential publication bias.'
          : '**Result**: No significant evidence of publication bias detected by Egger\'s test.'
      )

      return lines.join('\n')
    },
  })

  // =========================================================================
  // 7. causal_inference
  // =========================================================================
  registerTool({
    name: 'causal_inference',
    description:
      'Assess potential causal relationships from observational data. Supports Bradford Hill criteria scoring, Granger causality test, and correlation-vs-causation analysis.',
    parameters: {
      data: {
        type: 'string',
        description: 'JSON object with x (array), y (array), and optional confounders (array of arrays). e.g. {"x":[1,2,3],"y":[4,5,6],"confounders":[[7,8,9]]}',
        required: true,
      },
      method: {
        type: 'string',
        description: 'Method: correlation_vs_causation, granger, instrumental, or propensity',
        required: true,
      },
    },
    tier: 'free',
    async execute(args) {
      const method = String(args.method).toLowerCase()
      let data: { x: number[]; y: number[]; confounders?: number[][] }

      try {
        data = JSON.parse(String(args.data))
        if (!Array.isArray(data.x) || !Array.isArray(data.y)) throw new Error('x and y must be arrays')
        data.x = data.x.map(Number)
        data.y = data.y.map(Number)
        if (data.confounders) {
          data.confounders = data.confounders.map(c => c.map(Number))
        }
      } catch (e: unknown) {
        return `**Error**: Invalid data JSON. Expected {x: number[], y: number[], confounders?: number[][]}. ${e instanceof Error ? e.message : ''}`
      }

      const n = Math.min(data.x.length, data.y.length)
      if (n < 5) return '**Error**: Need at least 5 data points for causal inference.'

      const x = data.x.slice(0, n)
      const y = data.y.slice(0, n)
      const r = pearsonCorrelation(x, y)

      const lines: string[] = [
        `# Causal Inference Report`,
        '',
        `**Method**: ${method}`,
        `**N**: ${n}`,
        `**Pearson r (X, Y)**: ${r.toFixed(4)}`,
        '',
        `---`,
        '',
      ]

      if (method === 'correlation_vs_causation') {
        // Bradford Hill criteria evaluation
        lines.push(`## Bradford Hill Criteria Assessment`)
        lines.push('')
        lines.push(`These 9 criteria help evaluate whether an observed association is likely causal.`)
        lines.push('')

        interface Criterion {
          name: string
          score: number
          maxScore: number
          rationale: string
        }

        const criteria: Criterion[] = []

        // 1. Strength of association
        const absR = Math.abs(r)
        const strengthScore = absR > 0.7 ? 3 : absR > 0.4 ? 2 : absR > 0.2 ? 1 : 0
        criteria.push({
          name: 'Strength of Association',
          score: strengthScore,
          maxScore: 3,
          rationale: `|r| = ${absR.toFixed(4)} — ${absR > 0.7 ? 'strong' : absR > 0.4 ? 'moderate' : absR > 0.2 ? 'weak' : 'negligible'} correlation.`,
        })

        // 2. Consistency
        // Without multiple studies, we estimate from data stability
        const halfN = Math.floor(n / 2)
        const r1 = pearsonCorrelation(x.slice(0, halfN), y.slice(0, halfN))
        const r2 = pearsonCorrelation(x.slice(halfN), y.slice(halfN))
        const consistency = Math.abs(r1 - r2) < 0.3 ? 2 : Math.abs(r1 - r2) < 0.5 ? 1 : 0
        criteria.push({
          name: 'Consistency',
          score: consistency,
          maxScore: 2,
          rationale: `Split-half correlation: r1 = ${r1.toFixed(3)}, r2 = ${r2.toFixed(3)} (diff = ${Math.abs(r1 - r2).toFixed(3)}). ${consistency === 2 ? 'Consistent' : consistency === 1 ? 'Somewhat consistent' : 'Inconsistent'} across subsets.`,
        })

        // 3. Specificity
        let specificityScore = 2
        let specificityRationale = 'Cannot fully assess without multiple outcome variables. Default moderate score.'
        if (data.confounders && data.confounders.length > 0) {
          const confR = data.confounders.map(c => Math.abs(pearsonCorrelation(x, c.slice(0, n))))
          const maxConfR = Math.max(...confR)
          specificityScore = maxConfR > absR ? 0 : maxConfR > absR * 0.7 ? 1 : 2
          specificityRationale = `Max |r| with confounders = ${maxConfR.toFixed(3)}. ${specificityScore === 2 ? 'X-Y association is specific' : 'Confounders show comparable correlations — low specificity'}.`
        }
        criteria.push({
          name: 'Specificity',
          score: specificityScore,
          maxScore: 2,
          rationale: specificityRationale,
        })

        // 4. Temporality (check if x precedes y in time series sense)
        // Lag-1 cross-correlation
        let lagCorr = 0
        if (n > 3) {
          lagCorr = pearsonCorrelation(x.slice(0, n - 1), y.slice(1))
        }
        const temporalScore = Math.abs(lagCorr) > Math.abs(r) * 0.5 ? 2 : Math.abs(lagCorr) > 0.1 ? 1 : 0
        criteria.push({
          name: 'Temporality',
          score: temporalScore,
          maxScore: 2,
          rationale: `Lag-1 cross-correlation (X[t] → Y[t+1]) = ${lagCorr.toFixed(4)}. ${temporalScore === 2 ? 'Temporal precedence supported' : temporalScore === 1 ? 'Weak temporal precedence' : 'No clear temporal precedence'}.`,
        })

        // 5. Biological gradient (dose-response)
        // Check monotonicity
        const sortedByX = x.map((xi, i) => ({ x: xi, y: y[i] })).sort((a, b) => a.x - b.x)
        let monotonic = 0
        for (let i = 1; i < sortedByX.length; i++) {
          if (sortedByX[i].y >= sortedByX[i - 1].y) monotonic++
          else monotonic--
        }
        const monoPct = Math.abs(monotonic) / (sortedByX.length - 1)
        const gradientScore = monoPct > 0.7 ? 2 : monoPct > 0.5 ? 1 : 0
        criteria.push({
          name: 'Biological Gradient',
          score: gradientScore,
          maxScore: 2,
          rationale: `Monotonicity score = ${(monoPct * 100).toFixed(1)}%. ${gradientScore === 2 ? 'Clear dose-response' : gradientScore === 1 ? 'Partial dose-response' : 'No dose-response pattern'}.`,
        })

        // 6-9: Plausibility, Coherence, Experiment, Analogy
        // These require domain knowledge — assign default moderate scores with explanations
        criteria.push({
          name: 'Plausibility',
          score: 1,
          maxScore: 2,
          rationale: 'Requires domain expertise to assess. Score 1/2 (neutral) — provide domain context for better assessment.',
        })
        criteria.push({
          name: 'Coherence',
          score: 1,
          maxScore: 2,
          rationale: 'Requires knowledge of existing theory. Score 1/2 (neutral) — provide domain context for better assessment.',
        })
        criteria.push({
          name: 'Experiment',
          score: 0,
          maxScore: 2,
          rationale: 'No experimental evidence provided (observational data only). Experimental confirmation would strengthen causal claim.',
        })
        criteria.push({
          name: 'Analogy',
          score: 1,
          maxScore: 2,
          rationale: 'Requires knowledge of analogous systems. Score 1/2 (neutral).',
        })

        const totalScore = criteria.reduce((s, c) => s + c.score, 0)
        const maxScore = criteria.reduce((s, c) => s + c.maxScore, 0)
        const causalPct = (totalScore / maxScore) * 100

        lines.push(`| Criterion | Score | Max | Rationale |`)
        lines.push(`|-----------|-------|-----|-----------|`)
        for (const c of criteria) {
          lines.push(`| ${c.name} | ${c.score} | ${c.maxScore} | ${c.rationale} |`)
        }
        lines.push(`| **Total** | **${totalScore}** | **${maxScore}** | **${causalPct.toFixed(0)}% causal plausibility** |`)
        lines.push('')

        const verdict = causalPct >= 70 ? 'Strong support for causal relationship'
          : causalPct >= 50 ? 'Moderate support — further investigation warranted'
          : causalPct >= 30 ? 'Weak support — likely correlational, not causal'
          : 'Little evidence for causation'

        lines.push(`## Verdict: ${verdict}`)

      } else if (method === 'granger') {
        // Granger causality test
        lines.push(`## Granger Causality Test`)
        lines.push('')
        lines.push(`Tests whether past values of X help predict Y beyond Y's own past values.`)
        lines.push('')

        // Try lags 1-4
        const maxLag = Math.min(4, Math.floor(n / 5))

        for (let lag = 1; lag <= maxLag; lag++) {
          // Restricted model: Y[t] = a0 + a1*Y[t-1] + ... + aL*Y[t-L]
          // Unrestricted model: Y[t] = a0 + a1*Y[t-1] + ... + aL*Y[t-L] + b1*X[t-1] + ... + bL*X[t-L]
          const effectiveN = n - lag

          // Build design matrices
          // Restricted: just lagged Y
          const yTarget: number[] = []
          const xRestricted: number[][] = []
          const xUnrestricted: number[][] = []

          for (let t = lag; t < n; t++) {
            yTarget.push(y[t])
            const rowR: number[] = [1] // intercept
            const rowU: number[] = [1]
            for (let l = 1; l <= lag; l++) {
              rowR.push(y[t - l])
              rowU.push(y[t - l])
            }
            for (let l = 1; l <= lag; l++) {
              rowU.push(x[t - l])
            }
            xRestricted.push(rowR)
            xUnrestricted.push(rowU)
          }

          // OLS: b = (X'X)^-1 X'y — simplified for small matrices
          function olsResidualSS(X: number[][], y: number[]): number {
            const m = X[0].length
            const n = X.length

            // X'X
            const XtX: number[][] = Array.from({ length: m }, () => new Array(m).fill(0))
            const Xty: number[] = new Array(m).fill(0)
            for (let i = 0; i < n; i++) {
              for (let j = 0; j < m; j++) {
                Xty[j] += X[i][j] * y[i]
                for (let k = 0; k < m; k++) {
                  XtX[j][k] += X[i][j] * X[i][k]
                }
              }
            }

            // Solve via Gaussian elimination
            const aug: number[][] = XtX.map((row, i) => [...row, Xty[i]])
            for (let col = 0; col < m; col++) {
              // Pivot
              let maxRow = col
              for (let row = col + 1; row < m; row++) {
                if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row
              }
              [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]]

              if (Math.abs(aug[col][col]) < 1e-12) continue

              for (let row = 0; row < m; row++) {
                if (row === col) continue
                const factor = aug[row][col] / aug[col][col]
                for (let j = col; j <= m; j++) {
                  aug[row][j] -= factor * aug[col][j]
                }
              }
            }

            const beta = aug.map((row, i) => Math.abs(row[i]) > 1e-12 ? row[m] / row[i] : 0)

            // Compute residuals
            let rss = 0
            for (let i = 0; i < n; i++) {
              let pred = 0
              for (let j = 0; j < m; j++) pred += X[i][j] * beta[j]
              rss += (y[i] - pred) ** 2
            }
            return rss
          }

          const rssR = olsResidualSS(xRestricted, yTarget)
          const rssU = olsResidualSS(xUnrestricted, yTarget)

          // F-test: ((RSS_R - RSS_U) / q) / (RSS_U / (n - p))
          const q = lag // number of restrictions
          const p = 1 + 2 * lag // unrestricted model params
          const dfResidual = effectiveN - p

          if (dfResidual <= 0) {
            lines.push(`**Lag ${lag}**: Insufficient data (need > ${p} observations after lagging).`)
            continue
          }

          const fStat = dfResidual > 0 ? ((rssR - rssU) / q) / (rssU / dfResidual) : 0
          // F to p-value approximation
          const fPValue = 1 - regularizedGammaP(q / 2, q * fStat / (q * fStat + dfResidual) * dfResidual / 2)

          const significant = fPValue < 0.05

          lines.push(`### Lag = ${lag}`)
          lines.push('')
          lines.push(`| Metric | Value |`)
          lines.push(`|--------|-------|`)
          lines.push(`| RSS (restricted) | ${rssR.toFixed(4)} |`)
          lines.push(`| RSS (unrestricted) | ${rssU.toFixed(4)} |`)
          lines.push(`| F-statistic | ${fStat.toFixed(4)} |`)
          lines.push(`| df1, df2 | ${q}, ${dfResidual} |`)
          lines.push(`| p-value | ${fPValue < 0.001 ? '< 0.001' : fPValue.toFixed(4)} |`)
          lines.push(`| **X Granger-causes Y?** | **${significant ? 'Yes' : 'No'}** |`)
          lines.push('')
        }

        lines.push(`## Caveats`)
        lines.push('')
        lines.push(`- Granger causality tests temporal precedence, not true causation.`)
        lines.push(`- Assumes linear relationships and stationary time series.`)
        lines.push(`- Confounders can produce spurious Granger causality.`)
        lines.push(`- Consider differencing non-stationary data before testing.`)

      } else if (method === 'instrumental' || method === 'propensity') {
        lines.push(`## ${method === 'instrumental' ? 'Instrumental Variables' : 'Propensity Score'} Analysis`)
        lines.push('')

        if (method === 'instrumental') {
          if (!data.confounders || data.confounders.length === 0) {
            lines.push(`**Error**: Instrumental variables analysis requires at least one instrument in the confounders array.`)
            lines.push('')
            lines.push(`Provide data as: {"x": [...], "y": [...], "confounders": [[instrument_values]]}`)
            lines.push('')
            lines.push(`A valid instrument must:`)
            lines.push(`1. Be correlated with X (relevance)`)
            lines.push(`2. Affect Y only through X (exclusion restriction)`)
          } else {
            const z = data.confounders[0].slice(0, n)
            const rZX = pearsonCorrelation(z, x)
            const rZY = pearsonCorrelation(z, y)

            // 2SLS: first stage X = a + b*Z, second stage Y = c + d*X_hat
            // Simple IV estimator: beta_IV = Cov(Z,Y) / Cov(Z,X)
            const mz = mean(z), mx = mean(x), my = mean(y)
            let covZX = 0, covZY = 0
            for (let i = 0; i < n; i++) {
              covZX += (z[i] - mz) * (x[i] - mx)
              covZY += (z[i] - mz) * (y[i] - my)
            }
            covZX /= (n - 1)
            covZY /= (n - 1)

            const ivEstimate = covZX !== 0 ? covZY / covZX : NaN
            const olsEstimate = pearsonCorrelation(x, y) * stddev(y) / (stddev(x) || 1)

            // First-stage F-statistic (instrument strength)
            const rZX2 = rZX * rZX
            const firstStageF = n > 2 ? rZX2 / (1 - rZX2) * (n - 2) : 0

            lines.push(`| Metric | Value |`)
            lines.push(`|--------|-------|`)
            lines.push(`| **OLS Estimate** | ${olsEstimate.toFixed(4)} |`)
            lines.push(`| **IV Estimate** | ${isNaN(ivEstimate) ? 'N/A (weak instrument)' : ivEstimate.toFixed(4)} |`)
            lines.push(`| **r(Z, X)** | ${rZX.toFixed(4)} (instrument relevance) |`)
            lines.push(`| **r(Z, Y)** | ${rZY.toFixed(4)} (reduced form) |`)
            lines.push(`| **First-stage F** | ${firstStageF.toFixed(2)} ${firstStageF < 10 ? '(WEAK — below threshold of 10)' : '(adequate)'} |`)
            lines.push('')

            if (firstStageF < 10) {
              lines.push(`**Warning**: The instrument is weak (F < 10). IV estimates may be severely biased.`)
            }

            lines.push('')
            lines.push(`**Interpretation**: ${Math.abs(ivEstimate - olsEstimate) > 0.1 * Math.abs(olsEstimate) ? 'The IV and OLS estimates differ substantially, suggesting endogeneity bias in OLS.' : 'IV and OLS estimates are similar, suggesting limited endogeneity.'}`)
          }
        } else {
          // Propensity score analysis
          lines.push(`**Note**: Propensity score analysis requires a binary treatment variable.`)
          lines.push('')
          lines.push(`Converting X to binary treatment using median split.`)
          lines.push('')

          const medX = median(x)
          const treated = y.filter((_, i) => x[i] >= medX)
          const control = y.filter((_, i) => x[i] < medX)

          const treatedMean = mean(treated)
          const controlMean = mean(control)
          const naiveATE = treatedMean - controlMean

          // Simple propensity weighting approximation
          // Propensity = P(treatment | confounders) — without confounders, use inverse probability
          const pTreat = treated.length / n

          // IPW estimate
          let ipwNum = 0, ipwDen = 0
          for (let i = 0; i < n; i++) {
            const t = x[i] >= medX ? 1 : 0
            const p = pTreat // simplified — true propensity score needs logistic regression
            if (t === 1) {
              ipwNum += y[i] / p
              ipwDen += 1 / p
            } else {
              ipwNum -= y[i] / (1 - p)
              ipwDen += 1 / (1 - p)
            }
          }
          // Note: with constant propensity, IPW = naive ATE

          lines.push(`| Metric | Value |`)
          lines.push(`|--------|-------|`)
          lines.push(`| **Treated group mean** | ${treatedMean.toFixed(4)} (n=${treated.length}) |`)
          lines.push(`| **Control group mean** | ${controlMean.toFixed(4)} (n=${control.length}) |`)
          lines.push(`| **Naive ATE** | ${naiveATE.toFixed(4)} |`)
          lines.push(`| **P(treatment)** | ${pTreat.toFixed(4)} |`)
          lines.push('')

          if (data.confounders && data.confounders.length > 0) {
            lines.push(`### Confounder Balance`)
            lines.push('')
            lines.push(`| Confounder | Treated Mean | Control Mean | Std. Diff |`)
            lines.push(`|------------|-------------|-------------|-----------|`)
            data.confounders.forEach((conf, ci) => {
              const cTreated = conf.slice(0, n).filter((_, i) => x[i] >= medX)
              const cControl = conf.slice(0, n).filter((_, i) => x[i] < medX)
              const pooledSD = Math.sqrt((variance(cTreated) + variance(cControl)) / 2)
              const stdDiff = pooledSD > 0 ? (mean(cTreated) - mean(cControl)) / pooledSD : 0
              lines.push(`| Confounder ${ci + 1} | ${mean(cTreated).toFixed(3)} | ${mean(cControl).toFixed(3)} | ${stdDiff.toFixed(3)} ${Math.abs(stdDiff) > 0.1 ? '(IMBALANCED)' : ''} |`)
            })
          }
        }

        lines.push('')
        lines.push(`## Further Steps for Establishing Causality`)
        lines.push('')
        lines.push(`1. Conduct a randomized controlled experiment if feasible`)
        lines.push(`2. Test for robustness with different model specifications`)
        lines.push(`3. Check for sensitivity to unmeasured confounders (Rosenbaum bounds)`)
        lines.push(`4. Replicate findings in independent datasets`)
      } else {
        return `**Error**: Unknown method "${method}". Use: correlation_vs_causation, granger, instrumental, or propensity.`
      }

      return lines.join('\n')
    },
  })

  // =========================================================================
  // 8. reproducibility_check
  // =========================================================================
  registerTool({
    name: 'reproducibility_check',
    description:
      'Analyze a study\'s methodology for reproducibility risks. Computes positive predictive value (PPV), R-index, and replication probability based on sample size, p-value, effect size, pre-registration status, and multiple comparisons.',
    parameters: {
      sample_size: {
        type: 'number',
        description: 'Total sample size of the study',
        required: true,
      },
      p_value: {
        type: 'number',
        description: 'Reported p-value',
        required: true,
      },
      effect_size: {
        type: 'number',
        description: "Reported Cohen's d effect size",
        required: true,
      },
      pre_registered: {
        type: 'string',
        description: 'Was the study pre-registered? (true/false)',
        required: true,
      },
      multiple_comparisons: {
        type: 'number',
        description: 'Number of statistical tests / comparisons performed (default: 1)',
      },
    },
    tier: 'free',
    async execute(args) {
      const sampleSize = Number(args.sample_size)
      const pValue = Number(args.p_value)
      const effectSize = Number(args.effect_size)
      const preRegistered = String(args.pre_registered).toLowerCase() === 'true'
      const numComparisons = typeof args.multiple_comparisons === 'number' ? Math.max(1, args.multiple_comparisons) : 1

      if (sampleSize < 2 || isNaN(pValue) || isNaN(effectSize)) {
        return '**Error**: Provide valid numeric values for sample_size, p_value, and effect_size.'
      }

      // Bonferroni-adjusted alpha
      const alpha = 0.05
      const adjustedAlpha = alpha / numComparisons
      const adjustedPValue = Math.min(pValue * numComparisons, 1) // Bonferroni-corrected p

      // Is p-value still significant after correction?
      const significantAfterCorrection = pValue < adjustedAlpha

      // Statistical power estimation (post-hoc)
      const nPerGroup = sampleSize / 2
      const ncp = effectSize * Math.sqrt(nPerGroup / 2) // non-centrality parameter
      const critZ = normalInvCDF(1 - alpha / 2)
      const power = 1 - normalCDF(critZ - ncp)

      // Positive Predictive Value (PPV) — Ioannidis framework
      // PPV = (1 - beta) * R / ((1 - beta) * R + alpha)
      // where R = pre-study odds that the hypothesis is true
      // Estimate R based on context
      const R = preRegistered ? 0.5 : 0.1 // pre-registered = higher prior
      const beta = 1 - power
      const ppv = ((1 - beta) * R) / ((1 - beta) * R + alpha * numComparisons)

      // With bias factor (u)
      const u = preRegistered ? 0.1 : 0.3 // publication bias factor
      const ppvWithBias = ((1 - beta) * R + u * beta * R) /
                          ((1 - beta) * R + alpha + u * beta * R + u * alpha)

      // R-index: median power minus excess significance
      // Simplified: power - (observed significance rate - expected significance rate)
      const observedSigRate = pValue < alpha ? 1 : 0
      const rIndex = power - Math.abs(observedSigRate - power)

      // Replication probability
      // Based on Killeen (2005) prep statistic and power
      const prep = power > 0 ? Math.pow(1 - Math.exp(-0.5 * ncp * ncp / sampleSize), 1) : 0
      // More practically: replication probability based on power
      const replicationProb = power * ppv

      // p-curve analysis (single study approximation)
      const pCurveZ = -normalInvCDF(pValue)
      const isRightSkewed = pValue < 0.025

      // Risk flags
      interface Risk {
        flag: string
        severity: 'low' | 'moderate' | 'high' | 'critical'
        detail: string
      }

      const risks: Risk[] = []

      // Underpowered?
      if (power < 0.5) {
        risks.push({
          flag: 'Severely underpowered',
          severity: 'critical',
          detail: `Post-hoc power = ${(power * 100).toFixed(1)}%. Studies below 50% power have inflated effect sizes when significant (winner's curse).`,
        })
      } else if (power < 0.8) {
        risks.push({
          flag: 'Underpowered',
          severity: 'high',
          detail: `Post-hoc power = ${(power * 100).toFixed(1)}%. Below the conventional 80% threshold.`,
        })
      }

      // Suspicious p-value?
      if (pValue > 0.01 && pValue < 0.05) {
        risks.push({
          flag: 'P-value in suspicious zone',
          severity: 'moderate',
          detail: `p = ${pValue} is between 0.01 and 0.05. A disproportionate number of published p-values cluster just below 0.05, suggesting possible p-hacking.`,
        })
      }

      // Multiple comparisons?
      if (numComparisons > 1) {
        if (!significantAfterCorrection) {
          risks.push({
            flag: 'Not significant after multiple comparison correction',
            severity: 'critical',
            detail: `Bonferroni-corrected p = ${adjustedPValue.toFixed(4)} > ${alpha}. With ${numComparisons} comparisons, the result does not survive correction.`,
          })
        } else {
          risks.push({
            flag: 'Multiple comparisons',
            severity: 'moderate',
            detail: `${numComparisons} comparisons performed. Bonferroni-corrected p = ${adjustedPValue.toFixed(4)}. Result survives correction.`,
          })
        }
      }

      // Not pre-registered?
      if (!preRegistered) {
        risks.push({
          flag: 'Not pre-registered',
          severity: 'high',
          detail: 'Without pre-registration, researcher degrees of freedom allow flexible analysis (p-hacking, HARKing). PPV is significantly reduced.',
        })
      }

      // Small sample?
      if (sampleSize < 20) {
        risks.push({
          flag: 'Very small sample',
          severity: 'critical',
          detail: `N = ${sampleSize}. Extremely small samples produce unstable estimates, inflated effects, and low power.`,
        })
      } else if (sampleSize < 50) {
        risks.push({
          flag: 'Small sample',
          severity: 'high',
          detail: `N = ${sampleSize}. Small samples reduce precision and may not generalize.`,
        })
      }

      // Large effect with small sample?
      if (effectSize > 0.8 && sampleSize < 50) {
        risks.push({
          flag: 'Large effect with small sample (possible inflation)',
          severity: 'high',
          detail: `Cohen's d = ${effectSize} with N = ${sampleSize}. The "winner's curse" means significant effects in small samples are often inflated.`,
        })
      }

      // Compute reproducibility score (0-100)
      let score = 100

      // Power penalty
      if (power < 0.8) score -= (0.8 - power) * 40
      if (power < 0.5) score -= 15

      // Sample size penalty
      if (sampleSize < 20) score -= 25
      else if (sampleSize < 50) score -= 15
      else if (sampleSize < 100) score -= 5

      // P-value zone penalty
      if (pValue > 0.01 && pValue < 0.05) score -= 10

      // Multiple comparisons penalty
      if (!significantAfterCorrection && numComparisons > 1) score -= 20
      else if (numComparisons > 5) score -= 10
      else if (numComparisons > 1) score -= 5

      // Pre-registration bonus/penalty
      if (preRegistered) score += 10
      else score -= 15

      // Effect inflation check
      if (effectSize > 0.8 && sampleSize < 50) score -= 10

      score = Math.max(0, Math.min(100, Math.round(score)))

      const rating = score >= 80 ? 'High' : score >= 60 ? 'Moderate' : score >= 40 ? 'Low' : 'Very Low'
      const color = score >= 80 ? 'likely replicable' : score >= 60 ? 'may replicate with adequate power' : score >= 40 ? 'replication uncertain' : 'replication unlikely'

      // Build output
      const lines: string[] = [
        `# Reproducibility Check`,
        '',
        `## Study Parameters`,
        '',
        `| Parameter | Value |`,
        `|-----------|-------|`,
        `| Sample Size | ${sampleSize} |`,
        `| P-value | ${pValue} |`,
        `| Effect Size (d) | ${effectSize} |`,
        `| Pre-registered | ${preRegistered ? 'Yes' : 'No'} |`,
        `| Comparisons | ${numComparisons} |`,
        '',
        `---`,
        '',
        `## Reproducibility Score: ${score}/100 (${rating})`,
        '',
        `*${color}*`,
        '',
        `## Detailed Metrics`,
        '',
        `| Metric | Value | Interpretation |`,
        `|--------|-------|----------------|`,
        `| **Post-hoc Power** | ${(power * 100).toFixed(1)}% | ${power >= 0.8 ? 'Adequate' : power >= 0.5 ? 'Below threshold' : 'Severely underpowered'} |`,
        `| **PPV (no bias)** | ${(ppv * 100).toFixed(1)}% | Probability result is a true positive |`,
        `| **PPV (with bias)** | ${(ppvWithBias * 100).toFixed(1)}% | Accounting for publication bias |`,
        `| **R-index** | ${rIndex.toFixed(3)} | ${rIndex > 0.5 ? 'Favorable' : 'Unfavorable'} |`,
        `| **Replication Prob.** | ${(replicationProb * 100).toFixed(1)}% | Estimated chance of replication |`,
        `| **Bonferroni p** | ${adjustedPValue.toFixed(4)} | ${significantAfterCorrection ? 'Significant' : 'NOT significant'} after correction |`,
        `| **P-curve z** | ${pCurveZ.toFixed(3)} | ${isRightSkewed ? 'Right-skewed (evidential value)' : 'Not right-skewed'} |`,
        '',
      ]

      if (risks.length > 0) {
        lines.push(`## Identified Risks`)
        lines.push('')
        lines.push(`| Risk | Severity | Details |`)
        lines.push(`|------|----------|---------|`)
        for (const r of risks) {
          lines.push(`| ${r.flag} | **${r.severity}** | ${r.detail} |`)
        }
        lines.push('')
      }

      lines.push(`## Recommendations`)
      lines.push('')

      if (power < 0.8) {
        const requiredN = Math.ceil(2 * (critZ + normalInvCDF(0.8)) ** 2 / (effectSize ** 2 || 0.01))
        lines.push(`1. **Increase sample size**: Need approximately N = ${requiredN} total for 80% power at d = ${effectSize}.`)
      }
      if (!preRegistered) {
        lines.push(`${power < 0.8 ? '2' : '1'}. **Pre-register** future replications on OSF or AsPredicted.`)
      }
      if (numComparisons > 1) {
        lines.push(`- **Apply correction**: Use Bonferroni, Holm, or FDR correction for ${numComparisons} comparisons.`)
      }
      if (pValue > 0.01 && pValue < 0.05) {
        lines.push(`- **Report exact p-values** and effect sizes with confidence intervals, not just "p < 0.05".`)
      }
      lines.push(`- **Share data and analysis code** for transparency and independent verification.`)
      lines.push(`- Use \`experiment_simulate\` to plan adequately powered replications.`)
      lines.push(`- Use \`meta_analysis\` to synthesize across multiple replication attempts.`)

      return lines.join('\n')
    },
  })
}
