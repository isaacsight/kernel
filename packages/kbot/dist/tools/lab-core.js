// kbot Lab Core Tools — Universal Research Tools
// Provides statistical testing, literature search, citation mapping,
// unit conversion, physical constants, formula solving, methodology
// generation, preprint tracking, and open access discovery.
import { registerTool } from './index.js';
// ─── Math Helpers ────────────────────────────────────────────────────────────
/** Gamma function via Lanczos approximation */
function gammaLn(z) {
    const g = 7;
    const c = [
        0.99999999999980993, 676.5203681218851, -1259.1392167224028,
        771.32342877765313, -176.61502916214059, 12.507343278686905,
        -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
    ];
    if (z < 0.5) {
        return Math.log(Math.PI / Math.sin(Math.PI * z)) - gammaLn(1 - z);
    }
    z -= 1;
    let x = c[0];
    for (let i = 1; i < g + 2; i++)
        x += c[i] / (z + i);
    const t = z + g + 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
function gamma(z) {
    return Math.exp(gammaLn(z));
}
/** Regularized incomplete beta function I_x(a, b) via continued fraction */
function betaIncomplete(x, a, b) {
    if (x <= 0)
        return 0;
    if (x >= 1)
        return 1;
    if (a <= 0 || b <= 0)
        return 0;
    // Use symmetry if needed for convergence
    if (x > (a + 1) / (a + b + 2)) {
        return 1 - betaIncomplete(1 - x, b, a);
    }
    const lnBeta = gammaLn(a) + gammaLn(b) - gammaLn(a + b);
    const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;
    // Lentz's continued fraction
    const maxIter = 200;
    const eps = 1e-14;
    let f = 1, c = 1, d = 0;
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
        c = 1 + numerator / c;
        if (Math.abs(c) < 1e-30)
            c = 1e-30;
        const delta = c * d;
        f *= delta;
        if (Math.abs(delta - 1) < eps)
            break;
    }
    return front * (f - 1);
}
/** Regularized lower incomplete gamma function P(a, x) */
function gammaPLower(a, x) {
    if (x <= 0)
        return 0;
    if (x < a + 1) {
        // Series representation
        let sum = 1 / a;
        let term = 1 / a;
        for (let n = 1; n < 200; n++) {
            term *= x / (a + n);
            sum += term;
            if (Math.abs(term) < Math.abs(sum) * 1e-14)
                break;
        }
        return sum * Math.exp(-x + a * Math.log(x) - gammaLn(a));
    }
    else {
        // Continued fraction
        return 1 - gammaQUpper(a, x);
    }
}
/** Regularized upper incomplete gamma function Q(a, x) */
function gammaQUpper(a, x) {
    if (x <= 0)
        return 1;
    if (x < a + 1)
        return 1 - gammaPLower(a, x);
    // Continued fraction (Lentz)
    let f = 1, c = 1, d = 0;
    for (let i = 1; i < 200; i++) {
        const an = (i % 2 === 1) ? ((i + 1) / 2 - a) : (i / 2);
        const bn = (i === 1) ? (x + 1 - a) : x + (2 * i - 1) + 1 - a;
        // Actually use the standard CF for upper incomplete gamma
        // Let's use a simpler series approach for moderate x
        break; // fall through to series
    }
    // Use series for Q when x >= a+1
    let sum = 0, term = 1 / x;
    let prev = term;
    for (let k = 1; k < 300; k++) {
        term *= (a - k) / x;
        if (Math.abs(term) > Math.abs(prev))
            break; // diverging
        sum += term;
        if (Math.abs(term) < 1e-14)
            break;
        prev = term;
    }
    return Math.exp(-x + a * Math.log(x) - gammaLn(a)) * (1 / x + sum);
}
/** Student's t-distribution CDF */
function tCdf(t, df) {
    const x = df / (df + t * t);
    const p = 0.5 * betaIncomplete(x, df / 2, 0.5);
    return t >= 0 ? 1 - p : p;
}
/** Two-tailed p-value from t-statistic and df */
function tTestPValue(t, df) {
    return 2 * (1 - tCdf(Math.abs(t), df));
}
/** Chi-square CDF P(X <= x) with k degrees of freedom */
function chiSquareCdf(x, k) {
    if (x <= 0)
        return 0;
    return gammaPLower(k / 2, x / 2);
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
function mean(arr) {
    return arr.reduce((s, v) => s + v, 0) / arr.length;
}
function variance(arr, ddof = 1) {
    const m = mean(arr);
    return arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - ddof);
}
function stddev(arr, ddof = 1) {
    return Math.sqrt(variance(arr, ddof));
}
function parseNumbers(s) {
    return s.split(',').map(x => x.trim()).filter(x => x !== '').map(Number).filter(x => !isNaN(x));
}
const UNITS = {
    // Length (base: meter)
    m: { factor: 1, dimension: 'length' },
    km: { factor: 1000, dimension: 'length' },
    cm: { factor: 0.01, dimension: 'length' },
    mm: { factor: 0.001, dimension: 'length' },
    um: { factor: 1e-6, dimension: 'length' },
    nm: { factor: 1e-9, dimension: 'length' },
    pm: { factor: 1e-12, dimension: 'length' },
    fm: { factor: 1e-15, dimension: 'length' },
    angstrom: { factor: 1e-10, dimension: 'length' },
    in: { factor: 0.0254, dimension: 'length' },
    ft: { factor: 0.3048, dimension: 'length' },
    yd: { factor: 0.9144, dimension: 'length' },
    mi: { factor: 1609.344, dimension: 'length' },
    nmi: { factor: 1852, dimension: 'length' },
    au: { factor: 1.495978707e11, dimension: 'length' },
    ly: { factor: 9.4607e15, dimension: 'length' },
    pc: { factor: 3.0857e16, dimension: 'length' },
    mil: { factor: 2.54e-5, dimension: 'length' },
    fathom: { factor: 1.8288, dimension: 'length' },
    // Mass (base: kilogram)
    kg: { factor: 1, dimension: 'mass' },
    g: { factor: 0.001, dimension: 'mass' },
    mg: { factor: 1e-6, dimension: 'mass' },
    ug: { factor: 1e-9, dimension: 'mass' },
    ng: { factor: 1e-12, dimension: 'mass' },
    tonne: { factor: 1000, dimension: 'mass' },
    lb: { factor: 0.45359237, dimension: 'mass' },
    oz: { factor: 0.028349523125, dimension: 'mass' },
    stone: { factor: 6.35029318, dimension: 'mass' },
    slug: { factor: 14.593903, dimension: 'mass' },
    grain: { factor: 6.479891e-5, dimension: 'mass' },
    carat: { factor: 0.0002, dimension: 'mass' },
    amu: { factor: 1.66053906660e-27, dimension: 'mass' },
    dalton: { factor: 1.66053906660e-27, dimension: 'mass' },
    ton_short: { factor: 907.18474, dimension: 'mass' },
    ton_long: { factor: 1016.0469088, dimension: 'mass' },
    // Time (base: second)
    s: { factor: 1, dimension: 'time' },
    ms: { factor: 0.001, dimension: 'time' },
    us: { factor: 1e-6, dimension: 'time' },
    ns: { factor: 1e-9, dimension: 'time' },
    ps: { factor: 1e-12, dimension: 'time' },
    min: { factor: 60, dimension: 'time' },
    hr: { factor: 3600, dimension: 'time' },
    day: { factor: 86400, dimension: 'time' },
    week: { factor: 604800, dimension: 'time' },
    year: { factor: 31557600, dimension: 'time' },
    // Energy (base: joule)
    J: { factor: 1, dimension: 'energy' },
    kJ: { factor: 1000, dimension: 'energy' },
    MJ: { factor: 1e6, dimension: 'energy' },
    GJ: { factor: 1e9, dimension: 'energy' },
    cal: { factor: 4.184, dimension: 'energy' },
    kcal: { factor: 4184, dimension: 'energy' },
    Wh: { factor: 3600, dimension: 'energy' },
    kWh: { factor: 3.6e6, dimension: 'energy' },
    eV: { factor: 1.602176634e-19, dimension: 'energy' },
    keV: { factor: 1.602176634e-16, dimension: 'energy' },
    MeV: { factor: 1.602176634e-13, dimension: 'energy' },
    GeV: { factor: 1.602176634e-10, dimension: 'energy' },
    BTU: { factor: 1055.06, dimension: 'energy' },
    erg: { factor: 1e-7, dimension: 'energy' },
    Ry: { factor: 2.1798723611035e-18, dimension: 'energy' },
    hartree: { factor: 4.3597447222071e-18, dimension: 'energy' },
    // Pressure (base: pascal)
    Pa: { factor: 1, dimension: 'pressure' },
    kPa: { factor: 1000, dimension: 'pressure' },
    MPa: { factor: 1e6, dimension: 'pressure' },
    GPa: { factor: 1e9, dimension: 'pressure' },
    bar: { factor: 100000, dimension: 'pressure' },
    mbar: { factor: 100, dimension: 'pressure' },
    atm: { factor: 101325, dimension: 'pressure' },
    torr: { factor: 133.322, dimension: 'pressure' },
    mmHg: { factor: 133.322, dimension: 'pressure' },
    psi: { factor: 6894.757, dimension: 'pressure' },
    inHg: { factor: 3386.389, dimension: 'pressure' },
    // Force (base: newton)
    N: { factor: 1, dimension: 'force' },
    kN: { factor: 1000, dimension: 'force' },
    MN: { factor: 1e6, dimension: 'force' },
    dyn: { factor: 1e-5, dimension: 'force' },
    lbf: { factor: 4.44822, dimension: 'force' },
    kgf: { factor: 9.80665, dimension: 'force' },
    // Power (base: watt)
    W: { factor: 1, dimension: 'power' },
    kW: { factor: 1000, dimension: 'power' },
    MW: { factor: 1e6, dimension: 'power' },
    GW: { factor: 1e9, dimension: 'power' },
    hp: { factor: 745.7, dimension: 'power' },
    hp_metric: { factor: 735.499, dimension: 'power' },
    // Frequency (base: hertz)
    Hz: { factor: 1, dimension: 'frequency' },
    kHz: { factor: 1000, dimension: 'frequency' },
    MHz: { factor: 1e6, dimension: 'frequency' },
    GHz: { factor: 1e9, dimension: 'frequency' },
    THz: { factor: 1e12, dimension: 'frequency' },
    rpm: { factor: 1 / 60, dimension: 'frequency' },
    // Electric potential (base: volt)
    V: { factor: 1, dimension: 'voltage' },
    mV: { factor: 0.001, dimension: 'voltage' },
    kV: { factor: 1000, dimension: 'voltage' },
    // Electric current (base: ampere)
    A: { factor: 1, dimension: 'current' },
    mA: { factor: 0.001, dimension: 'current' },
    uA: { factor: 1e-6, dimension: 'current' },
    // Electric resistance (base: ohm)
    ohm: { factor: 1, dimension: 'resistance' },
    kohm: { factor: 1000, dimension: 'resistance' },
    Mohm: { factor: 1e6, dimension: 'resistance' },
    // Electric charge (base: coulomb)
    C: { factor: 1, dimension: 'charge' },
    mC: { factor: 0.001, dimension: 'charge' },
    uC: { factor: 1e-6, dimension: 'charge' },
    Ah: { factor: 3600, dimension: 'charge' },
    mAh: { factor: 3.6, dimension: 'charge' },
    e_charge: { factor: 1.602176634e-19, dimension: 'charge' },
    // Capacitance (base: farad)
    F: { factor: 1, dimension: 'capacitance' },
    mF: { factor: 0.001, dimension: 'capacitance' },
    uF: { factor: 1e-6, dimension: 'capacitance' },
    nF: { factor: 1e-9, dimension: 'capacitance' },
    pF: { factor: 1e-12, dimension: 'capacitance' },
    // Magnetic field (base: tesla)
    T: { factor: 1, dimension: 'magnetic_field' },
    mT: { factor: 0.001, dimension: 'magnetic_field' },
    uT: { factor: 1e-6, dimension: 'magnetic_field' },
    gauss: { factor: 1e-4, dimension: 'magnetic_field' },
    // Radiation dose (base: gray)
    Gy: { factor: 1, dimension: 'radiation_dose' },
    mGy: { factor: 0.001, dimension: 'radiation_dose' },
    rad_dose: { factor: 0.01, dimension: 'radiation_dose' },
    Sv: { factor: 1, dimension: 'dose_equivalent' },
    mSv: { factor: 0.001, dimension: 'dose_equivalent' },
    uSv: { factor: 1e-6, dimension: 'dose_equivalent' },
    rem: { factor: 0.01, dimension: 'dose_equivalent' },
    // Radioactivity (base: becquerel)
    Bq: { factor: 1, dimension: 'radioactivity' },
    kBq: { factor: 1000, dimension: 'radioactivity' },
    MBq: { factor: 1e6, dimension: 'radioactivity' },
    Ci: { factor: 3.7e10, dimension: 'radioactivity' },
    mCi: { factor: 3.7e7, dimension: 'radioactivity' },
    // Volume (base: cubic meter)
    m3: { factor: 1, dimension: 'volume' },
    L: { factor: 0.001, dimension: 'volume' },
    mL: { factor: 1e-6, dimension: 'volume' },
    uL: { factor: 1e-9, dimension: 'volume' },
    cm3: { factor: 1e-6, dimension: 'volume' },
    mm3: { factor: 1e-9, dimension: 'volume' },
    gal: { factor: 0.003785411784, dimension: 'volume' },
    qt: { factor: 0.000946352946, dimension: 'volume' },
    pt: { factor: 0.000473176473, dimension: 'volume' },
    cup: { factor: 0.000236588236, dimension: 'volume' },
    fl_oz: { factor: 2.957352956e-5, dimension: 'volume' },
    bbl: { factor: 0.158987295, dimension: 'volume' },
    // Area (base: square meter)
    m2: { factor: 1, dimension: 'area' },
    cm2: { factor: 1e-4, dimension: 'area' },
    mm2: { factor: 1e-6, dimension: 'area' },
    km2: { factor: 1e6, dimension: 'area' },
    ha: { factor: 10000, dimension: 'area' },
    acre: { factor: 4046.8564224, dimension: 'area' },
    ft2: { factor: 0.09290304, dimension: 'area' },
    in2: { factor: 6.4516e-4, dimension: 'area' },
    barn: { factor: 1e-28, dimension: 'area' },
    // Speed (base: m/s)
    'm/s': { factor: 1, dimension: 'speed' },
    'km/h': { factor: 1 / 3.6, dimension: 'speed' },
    'mi/h': { factor: 0.44704, dimension: 'speed' },
    mph: { factor: 0.44704, dimension: 'speed' },
    kn: { factor: 0.514444, dimension: 'speed' },
    'ft/s': { factor: 0.3048, dimension: 'speed' },
    mach: { factor: 343, dimension: 'speed' },
    c_speed: { factor: 299792458, dimension: 'speed' },
    // Density (base: kg/m3)
    'kg/m3': { factor: 1, dimension: 'density' },
    'g/cm3': { factor: 1000, dimension: 'density' },
    'g/mL': { factor: 1000, dimension: 'density' },
    'kg/L': { factor: 1000, dimension: 'density' },
    'lb/ft3': { factor: 16.01846, dimension: 'density' },
    // Concentration (base: mol/L = M)
    M: { factor: 1, dimension: 'concentration' },
    mM: { factor: 0.001, dimension: 'concentration' },
    uM: { factor: 1e-6, dimension: 'concentration' },
    nM: { factor: 1e-9, dimension: 'concentration' },
    pM: { factor: 1e-12, dimension: 'concentration' },
    // Data (base: byte)
    B: { factor: 1, dimension: 'data' },
    KB: { factor: 1000, dimension: 'data' },
    MB: { factor: 1e6, dimension: 'data' },
    GB: { factor: 1e9, dimension: 'data' },
    TB: { factor: 1e12, dimension: 'data' },
    PB: { factor: 1e15, dimension: 'data' },
    KiB: { factor: 1024, dimension: 'data' },
    MiB: { factor: 1048576, dimension: 'data' },
    GiB: { factor: 1073741824, dimension: 'data' },
    TiB: { factor: 1099511627776, dimension: 'data' },
    bit: { factor: 0.125, dimension: 'data' },
    Kbit: { factor: 125, dimension: 'data' },
    Mbit: { factor: 125000, dimension: 'data' },
    Gbit: { factor: 1.25e8, dimension: 'data' },
    // Angle (base: radian)
    rad: { factor: 1, dimension: 'angle' },
    deg: { factor: Math.PI / 180, dimension: 'angle' },
    arcmin: { factor: Math.PI / 10800, dimension: 'angle' },
    arcsec: { factor: Math.PI / 648000, dimension: 'angle' },
    grad: { factor: Math.PI / 200, dimension: 'angle' },
    rev: { factor: 2 * Math.PI, dimension: 'angle' },
    // Luminous intensity / flux (base: candela / lumen)
    lm: { factor: 1, dimension: 'luminous_flux' },
    lx: { factor: 1, dimension: 'illuminance' },
    fc: { factor: 10.7639, dimension: 'illuminance' },
    // Viscosity (base: Pa*s)
    'Pa*s': { factor: 1, dimension: 'dynamic_viscosity' },
    poise: { factor: 0.1, dimension: 'dynamic_viscosity' },
    cP: { factor: 0.001, dimension: 'dynamic_viscosity' },
};
// Temperature conversions (special handling)
function convertTemperature(value, from, to) {
    const tempUnits = ['C', 'F', 'K', 'R'];
    const fromNorm = from.replace(/^deg_?/i, '').replace(/celsius/i, 'C').replace(/fahrenheit/i, 'F')
        .replace(/kelvin/i, 'K').replace(/rankine/i, 'R');
    const toNorm = to.replace(/^deg_?/i, '').replace(/celsius/i, 'C').replace(/fahrenheit/i, 'F')
        .replace(/kelvin/i, 'K').replace(/rankine/i, 'R');
    if (!tempUnits.includes(fromNorm) || !tempUnits.includes(toNorm))
        return null;
    // Convert to Kelvin first
    let kelvin;
    switch (fromNorm) {
        case 'C':
            kelvin = value + 273.15;
            break;
        case 'F':
            kelvin = (value + 459.67) * 5 / 9;
            break;
        case 'K':
            kelvin = value;
            break;
        case 'R':
            kelvin = value * 5 / 9;
            break;
        default: return null;
    }
    // Convert from Kelvin to target
    switch (toNorm) {
        case 'C': return kelvin - 273.15;
        case 'F': return kelvin * 9 / 5 - 459.67;
        case 'K': return kelvin;
        case 'R': return kelvin * 9 / 5;
        default: return null;
    }
}
const CONSTANTS = [
    { name: 'Speed of light in vacuum', symbol: 'c', value: 299792458, uncertainty: 0, unit: 'm/s', aliases: ['speed of light', 'c', 'light speed', 'velocity of light'] },
    { name: 'Planck constant', symbol: 'h', value: 6.62607015e-34, uncertainty: 0, unit: 'J*s', aliases: ['planck', 'planck constant', 'h'] },
    { name: 'Reduced Planck constant', symbol: '\u0127', value: 1.054571817e-34, uncertainty: 0, unit: 'J*s', aliases: ['hbar', 'reduced planck', 'dirac constant', 'h-bar'] },
    { name: 'Gravitational constant', symbol: 'G', value: 6.67430e-11, uncertainty: 1.5e-15, unit: 'm^3/(kg*s^2)', aliases: ['gravitational constant', 'newton gravitational', 'big g', 'G'] },
    { name: 'Boltzmann constant', symbol: 'k_B', value: 1.380649e-23, uncertainty: 0, unit: 'J/K', aliases: ['boltzmann', 'boltzmann constant', 'kb', 'k_b'] },
    { name: 'Avogadro constant', symbol: 'N_A', value: 6.02214076e23, uncertainty: 0, unit: '1/mol', aliases: ['avogadro', 'avogadro constant', 'avogadro number', 'na', 'n_a'] },
    { name: 'Elementary charge', symbol: 'e', value: 1.602176634e-19, uncertainty: 0, unit: 'C', aliases: ['elementary charge', 'electron charge', 'e charge'] },
    { name: 'Electron mass', symbol: 'm_e', value: 9.1093837015e-31, uncertainty: 2.8e-40, unit: 'kg', aliases: ['electron mass', 'me', 'm_e', 'mass of electron'] },
    { name: 'Proton mass', symbol: 'm_p', value: 1.67262192369e-27, uncertainty: 5.1e-37, unit: 'kg', aliases: ['proton mass', 'mp', 'm_p', 'mass of proton'] },
    { name: 'Neutron mass', symbol: 'm_n', value: 1.67492749804e-27, uncertainty: 9.5e-37, unit: 'kg', aliases: ['neutron mass', 'mn', 'm_n', 'mass of neutron'] },
    { name: 'Fine-structure constant', symbol: '\u03B1', value: 7.2973525693e-3, uncertainty: 1.1e-12, unit: '(dimensionless)', aliases: ['fine structure', 'fine-structure constant', 'alpha', 'fine structure constant'] },
    { name: 'Rydberg constant', symbol: 'R_\u221E', value: 10973731.568160, uncertainty: 2.1e-5, unit: '1/m', aliases: ['rydberg', 'rydberg constant', 'r_inf', 'r_infinity'] },
    { name: 'Bohr radius', symbol: 'a_0', value: 5.29177210903e-11, uncertainty: 8.0e-21, unit: 'm', aliases: ['bohr radius', 'a0', 'a_0', 'bohr'] },
    { name: 'Classical electron radius', symbol: 'r_e', value: 2.8179403262e-15, uncertainty: 1.3e-24, unit: 'm', aliases: ['electron radius', 'classical electron radius', 're'] },
    { name: 'Compton wavelength', symbol: '\u03BB_C', value: 2.42631023867e-12, uncertainty: 7.3e-22, unit: 'm', aliases: ['compton wavelength', 'compton'] },
    { name: 'Magnetic flux quantum', symbol: '\u03A6_0', value: 2.067833848e-15, uncertainty: 0, unit: 'Wb', aliases: ['magnetic flux quantum', 'flux quantum', 'phi_0'] },
    { name: 'Conductance quantum', symbol: 'G_0', value: 7.748091729e-5, uncertainty: 0, unit: 'S', aliases: ['conductance quantum', 'g0'] },
    { name: 'Josephson constant', symbol: 'K_J', value: 483597.8484e9, uncertainty: 0, unit: 'Hz/V', aliases: ['josephson constant', 'josephson', 'kj'] },
    { name: 'von Klitzing constant', symbol: 'R_K', value: 25812.80745, uncertainty: 0, unit: '\u03A9', aliases: ['von klitzing', 'klitzing constant', 'rk'] },
    { name: 'Bohr magneton', symbol: '\u03BC_B', value: 9.2740100783e-24, uncertainty: 2.8e-33, unit: 'J/T', aliases: ['bohr magneton', 'mu_b', 'magneton'] },
    { name: 'Nuclear magneton', symbol: '\u03BC_N', value: 5.0507837461e-27, uncertainty: 1.5e-36, unit: 'J/T', aliases: ['nuclear magneton', 'mu_n'] },
    { name: 'Electron g-factor', symbol: 'g_e', value: -2.00231930436256, uncertainty: 3.5e-13, unit: '(dimensionless)', aliases: ['electron g-factor', 'g_e', 'electron g factor'] },
    { name: 'Muon mass', symbol: 'm_\u03BC', value: 1.883531627e-28, uncertainty: 4.2e-36, unit: 'kg', aliases: ['muon mass', 'mu mass'] },
    { name: 'Tau mass', symbol: 'm_\u03C4', value: 3.16754e-27, uncertainty: 2.1e-31, unit: 'kg', aliases: ['tau mass'] },
    { name: 'Stefan-Boltzmann constant', symbol: '\u03C3', value: 5.670374419e-8, uncertainty: 0, unit: 'W/(m^2*K^4)', aliases: ['stefan-boltzmann', 'stefan boltzmann', 'sigma_sb'] },
    { name: 'Wien displacement law constant', symbol: 'b', value: 2.897771955e-3, uncertainty: 0, unit: 'm*K', aliases: ['wien', 'wien displacement', 'wien constant'] },
    { name: 'First radiation constant', symbol: 'c_1', value: 3.741771852e-16, uncertainty: 0, unit: 'W*m^2', aliases: ['first radiation constant', 'c1'] },
    { name: 'Second radiation constant', symbol: 'c_2', value: 1.438776877e-2, uncertainty: 0, unit: 'm*K', aliases: ['second radiation constant', 'c2'] },
    { name: 'Molar gas constant', symbol: 'R', value: 8.314462618, uncertainty: 0, unit: 'J/(mol*K)', aliases: ['gas constant', 'molar gas constant', 'R', 'ideal gas constant'] },
    { name: 'Faraday constant', symbol: 'F', value: 96485.33212, uncertainty: 0, unit: 'C/mol', aliases: ['faraday', 'faraday constant'] },
    { name: 'Vacuum permittivity', symbol: '\u03B5_0', value: 8.8541878128e-12, uncertainty: 1.3e-21, unit: 'F/m', aliases: ['vacuum permittivity', 'permittivity of free space', 'epsilon_0', 'epsilon0', 'electric constant'] },
    { name: 'Vacuum permeability', symbol: '\u03BC_0', value: 1.25663706212e-6, uncertainty: 1.9e-16, unit: 'N/A^2', aliases: ['vacuum permeability', 'permeability of free space', 'mu_0', 'mu0', 'magnetic constant'] },
    { name: 'Impedance of free space', symbol: 'Z_0', value: 376.730313668, uncertainty: 5.7e-8, unit: '\u03A9', aliases: ['impedance of free space', 'z0', 'characteristic impedance of vacuum'] },
    { name: 'Coulomb constant', symbol: 'k_e', value: 8.9875517923e9, uncertainty: 1.4, unit: 'N*m^2/C^2', aliases: ['coulomb constant', 'ke', 'k_e', 'electric force constant'] },
    { name: 'Standard atmosphere', symbol: 'atm', value: 101325, uncertainty: 0, unit: 'Pa', aliases: ['standard atmosphere', 'atm pressure'] },
    { name: 'Standard gravity', symbol: 'g_n', value: 9.80665, uncertainty: 0, unit: 'm/s^2', aliases: ['standard gravity', 'g', 'gravitational acceleration', 'g_n'] },
    { name: 'Atomic mass constant', symbol: 'u', value: 1.66053906660e-27, uncertainty: 5.0e-37, unit: 'kg', aliases: ['atomic mass unit', 'amu', 'dalton', 'unified atomic mass unit', 'u'] },
    { name: 'Electron volt', symbol: 'eV', value: 1.602176634e-19, uncertainty: 0, unit: 'J', aliases: ['electron volt', 'eV'] },
    { name: 'Hartree energy', symbol: 'E_h', value: 4.3597447222071e-18, uncertainty: 8.5e-30, unit: 'J', aliases: ['hartree energy', 'hartree', 'eh'] },
    { name: 'Thomson cross section', symbol: '\u03C3_T', value: 6.6524587321e-29, uncertainty: 6.0e-38, unit: 'm^2', aliases: ['thomson cross section', 'sigma_t'] },
    { name: 'Proton-electron mass ratio', symbol: 'm_p/m_e', value: 1836.15267343, uncertainty: 1.1e-7, unit: '(dimensionless)', aliases: ['proton electron mass ratio', 'mp/me'] },
    { name: 'Molar Planck constant', symbol: 'N_A*h', value: 3.990312712e-10, uncertainty: 0, unit: 'J*s/mol', aliases: ['molar planck constant'] },
    { name: 'Loschmidt constant (273.15 K, 101.325 kPa)', symbol: 'n_0', value: 2.6867774e25, uncertainty: 0, unit: '1/m^3', aliases: ['loschmidt', 'loschmidt constant', 'n0'] },
    { name: 'Molar volume of ideal gas (273.15 K, 101.325 kPa)', symbol: 'V_m', value: 22.41396954e-3, uncertainty: 0, unit: 'm^3/mol', aliases: ['molar volume', 'stp molar volume', 'vm'] },
    { name: 'Sackur-Tetrode constant (1 K, 101.325 kPa)', symbol: 'S_0/R', value: -1.15170753706, uncertainty: 4.5e-10, unit: '(dimensionless)', aliases: ['sackur-tetrode', 'sackur tetrode'] },
    { name: 'W boson mass', symbol: 'm_W', value: 1.43298e-25, uncertainty: 1.8e-28, unit: 'kg', aliases: ['w boson mass', 'mw'] },
    { name: 'Z boson mass', symbol: 'm_Z', value: 1.62566e-25, uncertainty: 3.1e-29, unit: 'kg', aliases: ['z boson mass', 'mz'] },
    { name: 'Higgs boson mass', symbol: 'm_H', value: 2.2305e-25, uncertainty: 5.3e-28, unit: 'kg', aliases: ['higgs mass', 'higgs boson mass', 'mh'] },
    { name: 'Proton magnetic moment', symbol: '\u03BC_p', value: 1.41060674333e-26, uncertainty: 4.6e-36, unit: 'J/T', aliases: ['proton magnetic moment', 'mu_p'] },
    { name: 'Neutron magnetic moment', symbol: '\u03BC_n', value: -9.6623651e-27, uncertainty: 2.3e-33, unit: 'J/T', aliases: ['neutron magnetic moment', 'mu_n_mag'] },
    { name: 'Proton gyromagnetic ratio', symbol: '\u03B3_p', value: 2.6752218744e8, uncertainty: 1.1e-2, unit: '1/(s*T)', aliases: ['proton gyromagnetic ratio', 'gamma_p'] },
    { name: 'Electron magnetic moment', symbol: '\u03BC_e', value: -9.2847647043e-24, uncertainty: 2.8e-33, unit: 'J/T', aliases: ['electron magnetic moment', 'mu_e'] },
    { name: 'Proton charge radius', symbol: 'r_p', value: 8.414e-16, uncertainty: 1.9e-18, unit: 'm', aliases: ['proton radius', 'proton charge radius', 'rp'] },
    { name: 'Fermi coupling constant', symbol: 'G_F/(hbar*c)^3', value: 1.1663788e-5, uncertainty: 6e-12, unit: '1/GeV^2', aliases: ['fermi coupling', 'fermi constant', 'gf'] },
    { name: 'Weak mixing angle', symbol: 'sin^2(\u03B8_W)', value: 0.23121, uncertainty: 4e-5, unit: '(dimensionless)', aliases: ['weak mixing angle', 'weinberg angle', 'theta_w'] },
    { name: 'Planck mass', symbol: 'm_P', value: 2.176434e-8, uncertainty: 2.4e-13, unit: 'kg', aliases: ['planck mass', 'mp_planck'] },
    { name: 'Planck length', symbol: 'l_P', value: 1.616255e-35, uncertainty: 1.8e-40, unit: 'm', aliases: ['planck length', 'lp'] },
    { name: 'Planck time', symbol: 't_P', value: 5.391247e-44, uncertainty: 6.0e-49, unit: 's', aliases: ['planck time', 'tp'] },
    { name: 'Planck temperature', symbol: 'T_P', value: 1.416784e32, uncertainty: 1.6e27, unit: 'K', aliases: ['planck temperature', 'tp_temp'] },
    { name: 'Characteristic impedance of vacuum', symbol: 'Z_0', value: 376.730313668, uncertainty: 5.7e-8, unit: '\u03A9', aliases: ['z0_vacuum'] },
    { name: 'Solar mass', symbol: 'M_\u2609', value: 1.989e30, uncertainty: 2e26, unit: 'kg', aliases: ['solar mass', 'sun mass', 'msun', 'm_sun'] },
    { name: 'Earth mass', symbol: 'M_\u2295', value: 5.972e24, uncertainty: 6e20, unit: 'kg', aliases: ['earth mass', 'mearth', 'm_earth'] },
    { name: 'Solar radius', symbol: 'R_\u2609', value: 6.957e8, uncertainty: 1.4e5, unit: 'm', aliases: ['solar radius', 'sun radius', 'rsun'] },
    { name: 'Earth radius (equatorial)', symbol: 'R_\u2295', value: 6.3781e6, uncertainty: 1, unit: 'm', aliases: ['earth radius', 'rearth'] },
    { name: 'Solar luminosity', symbol: 'L_\u2609', value: 3.828e26, uncertainty: 4e22, unit: 'W', aliases: ['solar luminosity', 'sun luminosity', 'lsun'] },
    { name: 'Hubble constant', symbol: 'H_0', value: 67.4, uncertainty: 0.5, unit: 'km/s/Mpc', aliases: ['hubble constant', 'hubble parameter', 'h0'] },
    { name: 'Cosmological constant', symbol: '\u039B', value: 1.1056e-52, uncertainty: 1.5e-54, unit: '1/m^2', aliases: ['cosmological constant', 'lambda', 'dark energy'] },
    { name: 'CMB temperature', symbol: 'T_CMB', value: 2.7255, uncertainty: 6e-4, unit: 'K', aliases: ['cmb temperature', 'cosmic microwave background temperature', 'tcmb'] },
    { name: 'Age of the universe', symbol: 't_0', value: 4.35e17, uncertainty: 2e15, unit: 's', aliases: ['age of universe', 'universe age'] },
    { name: 'Density parameter (matter)', symbol: '\u03A9_m', value: 0.315, uncertainty: 0.007, unit: '(dimensionless)', aliases: ['density parameter matter', 'omega_m'] },
    { name: 'Density parameter (dark energy)', symbol: '\u03A9_\u039B', value: 0.685, uncertainty: 0.007, unit: '(dimensionless)', aliases: ['density parameter dark energy', 'omega_lambda'] },
    { name: 'Proton rms charge radius', symbol: 'r_p', value: 8.414e-16, uncertainty: 1.9e-18, unit: 'm', aliases: ['proton rms radius'] },
    { name: 'Deuteron mass', symbol: 'm_d', value: 3.3435837724e-27, uncertainty: 1.0e-36, unit: 'kg', aliases: ['deuteron mass', 'md'] },
    { name: 'Alpha particle mass', symbol: 'm_\u03B1', value: 6.6446573357e-27, uncertainty: 2.0e-36, unit: 'kg', aliases: ['alpha particle mass', 'helium-4 mass', 'm_alpha'] },
];
/** Fuzzy match a query against constant names/aliases */
function findConstant(query) {
    const q = query.toLowerCase().trim();
    // Exact alias match
    const exact = CONSTANTS.filter(c => c.aliases.some(a => a.toLowerCase() === q) ||
        c.symbol.toLowerCase() === q ||
        c.name.toLowerCase() === q);
    if (exact.length > 0)
        return exact;
    // Substring match
    const sub = CONSTANTS.filter(c => c.name.toLowerCase().includes(q) ||
        c.aliases.some(a => a.toLowerCase().includes(q)) ||
        c.symbol.toLowerCase().includes(q));
    if (sub.length > 0)
        return sub;
    // Word-level fuzzy: match if all query words appear somewhere
    const words = q.split(/\s+/);
    return CONSTANTS.filter(c => {
        const haystack = `${c.name} ${c.aliases.join(' ')} ${c.symbol}`.toLowerCase();
        return words.every(w => haystack.includes(w));
    });
}
const FORMULAS = [
    {
        name: 'Ideal Gas Law', expression: 'PV = nRT',
        variables: { P: 'Pressure (Pa)', V: 'Volume (m^3)', n: 'Amount (mol)', R: 'Gas constant (8.314 J/(mol*K))', T: 'Temperature (K)' },
        aliases: ['ideal gas', 'pv=nrt', 'gas law'],
        solve(solveFor, kv) {
            const R = kv.R ?? 8.314462618;
            switch (solveFor) {
                case 'P': return (kv.n * R * kv.T) / kv.V;
                case 'V': return (kv.n * R * kv.T) / kv.P;
                case 'n': return (kv.P * kv.V) / (R * kv.T);
                case 'T': return (kv.P * kv.V) / (kv.n * R);
                default: return null;
            }
        },
    },
    {
        name: 'Mass-Energy Equivalence', expression: 'E = mc^2',
        variables: { E: 'Energy (J)', m: 'Mass (kg)', c: 'Speed of light (299792458 m/s)' },
        aliases: ['mass energy', 'e=mc2', 'einstein', 'mass-energy'],
        solve(solveFor, kv) {
            const c = 299792458;
            switch (solveFor) {
                case 'E': return kv.m * c * c;
                case 'm': return kv.E / (c * c);
                default: return null;
            }
        },
    },
    {
        name: "Newton's Second Law", expression: 'F = ma',
        variables: { F: 'Force (N)', m: 'Mass (kg)', a: 'Acceleration (m/s^2)' },
        aliases: ['newton second', 'f=ma', 'force'],
        solve(solveFor, kv) {
            switch (solveFor) {
                case 'F': return kv.m * kv.a;
                case 'm': return kv.F / kv.a;
                case 'a': return kv.F / kv.m;
                default: return null;
            }
        },
    },
    {
        name: "Ohm's Law", expression: 'V = IR',
        variables: { V: 'Voltage (V)', I: 'Current (A)', R: 'Resistance (\u03A9)' },
        aliases: ['ohm', 'v=ir', 'ohms law'],
        solve(solveFor, kv) {
            switch (solveFor) {
                case 'V': return kv.I * kv.R;
                case 'I': return kv.V / kv.R;
                case 'R': return kv.V / kv.I;
                default: return null;
            }
        },
    },
    {
        name: 'Coulomb\'s Law', expression: 'F = k_e * q1 * q2 / r^2',
        variables: { F: 'Force (N)', q1: 'Charge 1 (C)', q2: 'Charge 2 (C)', r: 'Distance (m)', k_e: 'Coulomb constant (8.9876e9 N*m^2/C^2)' },
        aliases: ['coulomb', 'coulombs law', 'electric force'],
        solve(solveFor, kv) {
            const ke = kv.k_e ?? 8.9875517923e9;
            switch (solveFor) {
                case 'F': return ke * kv.q1 * kv.q2 / (kv.r * kv.r);
                case 'q1': return kv.F * kv.r * kv.r / (ke * kv.q2);
                case 'q2': return kv.F * kv.r * kv.r / (ke * kv.q1);
                case 'r': return Math.sqrt(ke * kv.q1 * kv.q2 / kv.F);
                default: return null;
            }
        },
    },
    {
        name: 'Kinetic Energy', expression: 'KE = 0.5 * m * v^2',
        variables: { KE: 'Kinetic energy (J)', m: 'Mass (kg)', v: 'Velocity (m/s)' },
        aliases: ['kinetic energy', 'ke'],
        solve(solveFor, kv) {
            switch (solveFor) {
                case 'KE': return 0.5 * kv.m * kv.v * kv.v;
                case 'm': return 2 * kv.KE / (kv.v * kv.v);
                case 'v': return Math.sqrt(2 * kv.KE / kv.m);
                default: return null;
            }
        },
    },
    {
        name: 'Gravitational Potential Energy', expression: 'U = mgh',
        variables: { U: 'Potential energy (J)', m: 'Mass (kg)', g: 'Gravitational accel (m/s^2)', h: 'Height (m)' },
        aliases: ['gravitational potential', 'potential energy', 'u=mgh', 'mgh'],
        solve(solveFor, kv) {
            const g = kv.g ?? 9.80665;
            switch (solveFor) {
                case 'U': return kv.m * g * kv.h;
                case 'm': return kv.U / (g * kv.h);
                case 'h': return kv.U / (kv.m * g);
                default: return null;
            }
        },
    },
    {
        name: 'Electric Power', expression: 'P = IV',
        variables: { P: 'Power (W)', I: 'Current (A)', V: 'Voltage (V)' },
        aliases: ['electric power', 'p=iv', 'power electrical'],
        solve(solveFor, kv) {
            switch (solveFor) {
                case 'P': return kv.I * kv.V;
                case 'I': return kv.P / kv.V;
                case 'V': return kv.P / kv.I;
                default: return null;
            }
        },
    },
    {
        name: 'Wave Equation', expression: 'v = f\u03BB',
        variables: { v: 'Wave speed (m/s)', f: 'Frequency (Hz)', lambda: 'Wavelength (m)' },
        aliases: ['wave equation', 'v=flambda', 'wave speed'],
        solve(solveFor, kv) {
            switch (solveFor) {
                case 'v': return kv.f * kv.lambda;
                case 'f': return kv.v / kv.lambda;
                case 'lambda': return kv.v / kv.f;
                default: return null;
            }
        },
    },
    {
        name: 'Photon Energy', expression: 'E = hf',
        variables: { E: 'Energy (J)', h: 'Planck constant (6.626e-34 J*s)', f: 'Frequency (Hz)' },
        aliases: ['photon energy', 'e=hf', 'planck relation'],
        solve(solveFor, kv) {
            const h = kv.h ?? 6.62607015e-34;
            switch (solveFor) {
                case 'E': return h * kv.f;
                case 'f': return kv.E / h;
                default: return null;
            }
        },
    },
    {
        name: 'de Broglie Wavelength', expression: '\u03BB = h / p',
        variables: { lambda: 'Wavelength (m)', h: 'Planck constant (6.626e-34 J*s)', p: 'Momentum (kg*m/s)' },
        aliases: ['de broglie', 'matter wave', 'lambda=h/p'],
        solve(solveFor, kv) {
            const h = kv.h ?? 6.62607015e-34;
            switch (solveFor) {
                case 'lambda': return h / kv.p;
                case 'p': return h / kv.lambda;
                default: return null;
            }
        },
    },
    {
        name: "Snell's Law", expression: 'n1 * sin(\u03B81) = n2 * sin(\u03B82)',
        variables: { n1: 'Refractive index 1', theta1: 'Angle 1 (rad)', n2: 'Refractive index 2', theta2: 'Angle 2 (rad)' },
        aliases: ['snell', 'snells law', 'refraction'],
        solve(solveFor, kv) {
            switch (solveFor) {
                case 'theta2': return Math.asin(kv.n1 * Math.sin(kv.theta1) / kv.n2);
                case 'theta1': return Math.asin(kv.n2 * Math.sin(kv.theta2) / kv.n1);
                case 'n1': return kv.n2 * Math.sin(kv.theta2) / Math.sin(kv.theta1);
                case 'n2': return kv.n1 * Math.sin(kv.theta1) / Math.sin(kv.theta2);
                default: return null;
            }
        },
    },
    {
        name: 'Stefan-Boltzmann Law', expression: 'P = \u03C3 * A * T^4',
        variables: { P: 'Radiated power (W)', sigma: 'Stefan-Boltzmann constant (5.670e-8 W/(m^2*K^4))', A: 'Surface area (m^2)', T: 'Temperature (K)' },
        aliases: ['stefan-boltzmann', 'stefan boltzmann', 'blackbody radiation', 'thermal radiation'],
        solve(solveFor, kv) {
            const sigma = kv.sigma ?? 5.670374419e-8;
            switch (solveFor) {
                case 'P': return sigma * kv.A * Math.pow(kv.T, 4);
                case 'A': return kv.P / (sigma * Math.pow(kv.T, 4));
                case 'T': return Math.pow(kv.P / (sigma * kv.A), 0.25);
                default: return null;
            }
        },
    },
    {
        name: 'Schwarzschild Radius', expression: 'r_s = 2GM/c^2',
        variables: { r_s: 'Schwarzschild radius (m)', G: 'Gravitational constant (6.674e-11)', M: 'Mass (kg)', c: 'Speed of light (299792458 m/s)' },
        aliases: ['schwarzschild', 'event horizon', 'black hole radius'],
        solve(solveFor, kv) {
            const G = kv.G ?? 6.67430e-11;
            const c = 299792458;
            switch (solveFor) {
                case 'r_s': return 2 * G * kv.M / (c * c);
                case 'M': return kv.r_s * c * c / (2 * G);
                default: return null;
            }
        },
    },
    {
        name: 'Gravitational Force', expression: 'F = G * m1 * m2 / r^2',
        variables: { F: 'Force (N)', G: 'Gravitational constant (6.674e-11)', m1: 'Mass 1 (kg)', m2: 'Mass 2 (kg)', r: 'Distance (m)' },
        aliases: ['gravitational force', 'gravity force', 'newton gravity'],
        solve(solveFor, kv) {
            const G = kv.G ?? 6.67430e-11;
            switch (solveFor) {
                case 'F': return G * kv.m1 * kv.m2 / (kv.r * kv.r);
                case 'm1': return kv.F * kv.r * kv.r / (G * kv.m2);
                case 'm2': return kv.F * kv.r * kv.r / (G * kv.m1);
                case 'r': return Math.sqrt(G * kv.m1 * kv.m2 / kv.F);
                default: return null;
            }
        },
    },
    {
        name: 'Centripetal Force', expression: 'F = mv^2/r',
        variables: { F: 'Force (N)', m: 'Mass (kg)', v: 'Velocity (m/s)', r: 'Radius (m)' },
        aliases: ['centripetal', 'centripetal force'],
        solve(solveFor, kv) {
            switch (solveFor) {
                case 'F': return kv.m * kv.v * kv.v / kv.r;
                case 'm': return kv.F * kv.r / (kv.v * kv.v);
                case 'v': return Math.sqrt(kv.F * kv.r / kv.m);
                case 'r': return kv.m * kv.v * kv.v / kv.F;
                default: return null;
            }
        },
    },
    {
        name: 'Simple Harmonic Motion Period', expression: 'T = 2\u03C0\u221A(m/k)',
        variables: { T: 'Period (s)', m: 'Mass (kg)', k: 'Spring constant (N/m)' },
        aliases: ['simple harmonic', 'shm period', 'spring period', 'harmonic oscillator'],
        solve(solveFor, kv) {
            switch (solveFor) {
                case 'T': return 2 * Math.PI * Math.sqrt(kv.m / kv.k);
                case 'm': return kv.k * (kv.T / (2 * Math.PI)) ** 2;
                case 'k': return kv.m * (2 * Math.PI / kv.T) ** 2;
                default: return null;
            }
        },
    },
    {
        name: 'Pendulum Period', expression: 'T = 2\u03C0\u221A(L/g)',
        variables: { T: 'Period (s)', L: 'Length (m)', g: 'Gravitational accel (m/s^2)' },
        aliases: ['pendulum', 'pendulum period'],
        solve(solveFor, kv) {
            const g = kv.g ?? 9.80665;
            switch (solveFor) {
                case 'T': return 2 * Math.PI * Math.sqrt(kv.L / g);
                case 'L': return g * (kv.T / (2 * Math.PI)) ** 2;
                default: return null;
            }
        },
    },
    {
        name: 'Capacitor Energy', expression: 'E = 0.5 * C * V^2',
        variables: { E: 'Energy (J)', C: 'Capacitance (F)', V: 'Voltage (V)' },
        aliases: ['capacitor energy', 'capacitor'],
        solve(solveFor, kv) {
            switch (solveFor) {
                case 'E': return 0.5 * kv.C * kv.V * kv.V;
                case 'C': return 2 * kv.E / (kv.V * kv.V);
                case 'V': return Math.sqrt(2 * kv.E / kv.C);
                default: return null;
            }
        },
    },
    {
        name: 'Inductor Energy', expression: 'E = 0.5 * L * I^2',
        variables: { E: 'Energy (J)', L: 'Inductance (H)', I: 'Current (A)' },
        aliases: ['inductor energy', 'inductor'],
        solve(solveFor, kv) {
            switch (solveFor) {
                case 'E': return 0.5 * kv.L * kv.I * kv.I;
                case 'L': return 2 * kv.E / (kv.I * kv.I);
                case 'I': return Math.sqrt(2 * kv.E / kv.L);
                default: return null;
            }
        },
    },
    {
        name: 'Escape Velocity', expression: 'v_e = \u221A(2GM/r)',
        variables: { v_e: 'Escape velocity (m/s)', G: 'Gravitational constant (6.674e-11)', M: 'Mass (kg)', r: 'Radius (m)' },
        aliases: ['escape velocity', 'escape speed'],
        solve(solveFor, kv) {
            const G = kv.G ?? 6.67430e-11;
            switch (solveFor) {
                case 'v_e': return Math.sqrt(2 * G * kv.M / kv.r);
                case 'M': return kv.v_e * kv.v_e * kv.r / (2 * G);
                case 'r': return 2 * G * kv.M / (kv.v_e * kv.v_e);
                default: return null;
            }
        },
    },
    {
        name: 'Orbital Velocity', expression: 'v = \u221A(GM/r)',
        variables: { v: 'Orbital velocity (m/s)', G: 'Gravitational constant (6.674e-11)', M: 'Central mass (kg)', r: 'Orbital radius (m)' },
        aliases: ['orbital velocity', 'circular orbit'],
        solve(solveFor, kv) {
            const G = kv.G ?? 6.67430e-11;
            switch (solveFor) {
                case 'v': return Math.sqrt(G * kv.M / kv.r);
                case 'M': return kv.v * kv.v * kv.r / G;
                case 'r': return G * kv.M / (kv.v * kv.v);
                default: return null;
            }
        },
    },
    {
        name: "Kepler's Third Law", expression: 'T^2 = (4\u03C0^2 / GM) * a^3',
        variables: { T: 'Orbital period (s)', G: 'Gravitational constant (6.674e-11)', M: 'Central mass (kg)', a: 'Semi-major axis (m)' },
        aliases: ['kepler third', 'keplers third law', 'kepler 3'],
        solve(solveFor, kv) {
            const G = kv.G ?? 6.67430e-11;
            const coeff = 4 * Math.PI * Math.PI / (G * kv.M);
            switch (solveFor) {
                case 'T': return Math.sqrt(coeff * Math.pow(kv.a, 3));
                case 'a': return Math.pow(kv.T * kv.T / coeff, 1 / 3);
                case 'M': return 4 * Math.PI * Math.PI * Math.pow(kv.a, 3) / (G * kv.T * kv.T);
                default: return null;
            }
        },
    },
    {
        name: 'Doppler Effect (light)', expression: 'f_obs = f_src * \u221A((1-\u03B2)/(1+\u03B2))',
        variables: { f_obs: 'Observed frequency (Hz)', f_src: 'Source frequency (Hz)', beta: 'v/c (ratio)' },
        aliases: ['doppler', 'relativistic doppler', 'redshift'],
        solve(solveFor, kv) {
            switch (solveFor) {
                case 'f_obs': return kv.f_src * Math.sqrt((1 - kv.beta) / (1 + kv.beta));
                case 'f_src': return kv.f_obs / Math.sqrt((1 - kv.beta) / (1 + kv.beta));
                case 'beta': {
                    const r = kv.f_obs / kv.f_src;
                    return (1 - r * r) / (1 + r * r);
                }
                default: return null;
            }
        },
    },
    {
        name: 'Lorentz Factor', expression: '\u03B3 = 1 / \u221A(1 - v^2/c^2)',
        variables: { gamma: 'Lorentz factor', v: 'Velocity (m/s)', c: 'Speed of light (299792458 m/s)' },
        aliases: ['lorentz factor', 'gamma factor', 'time dilation', 'lorentz'],
        solve(solveFor, kv) {
            const c = 299792458;
            switch (solveFor) {
                case 'gamma': return 1 / Math.sqrt(1 - (kv.v * kv.v) / (c * c));
                case 'v': return c * Math.sqrt(1 - 1 / (kv.gamma * kv.gamma));
                default: return null;
            }
        },
    },
    {
        name: 'Diffraction Grating', expression: 'd * sin(\u03B8) = m\u03BB',
        variables: { d: 'Slit spacing (m)', theta: 'Angle (rad)', m_order: 'Order (integer)', lambda: 'Wavelength (m)' },
        aliases: ['diffraction', 'grating equation', 'diffraction grating'],
        solve(solveFor, kv) {
            switch (solveFor) {
                case 'lambda': return kv.d * Math.sin(kv.theta) / kv.m_order;
                case 'theta': return Math.asin(kv.m_order * kv.lambda / kv.d);
                case 'd': return kv.m_order * kv.lambda / Math.sin(kv.theta);
                case 'm_order': return kv.d * Math.sin(kv.theta) / kv.lambda;
                default: return null;
            }
        },
    },
    {
        name: 'Beer-Lambert Law', expression: 'A = \u03B5 * l * c',
        variables: { A: 'Absorbance', epsilon: 'Molar absorptivity (L/(mol*cm))', l: 'Path length (cm)', c_conc: 'Concentration (mol/L)' },
        aliases: ['beer lambert', 'beer-lambert', 'absorbance', 'beer law'],
        solve(solveFor, kv) {
            switch (solveFor) {
                case 'A': return kv.epsilon * kv.l * kv.c_conc;
                case 'epsilon': return kv.A / (kv.l * kv.c_conc);
                case 'l': return kv.A / (kv.epsilon * kv.c_conc);
                case 'c_conc': return kv.A / (kv.epsilon * kv.l);
                default: return null;
            }
        },
    },
    {
        name: 'Nernst Equation', expression: 'E = E\u00B0 - (RT/nF) * ln(Q)',
        variables: { E: 'Cell potential (V)', E0: 'Standard potential (V)', R: 'Gas constant (8.314)', T: 'Temperature (K)', n: 'Electrons transferred', F_const: 'Faraday constant (96485)', Q: 'Reaction quotient' },
        aliases: ['nernst', 'nernst equation', 'electrochemistry'],
        solve(solveFor, kv) {
            const R = kv.R ?? 8.314462618;
            const Fc = kv.F_const ?? 96485.33212;
            switch (solveFor) {
                case 'E': return kv.E0 - (R * kv.T / (kv.n * Fc)) * Math.log(kv.Q);
                case 'Q': return Math.exp((kv.E0 - kv.E) * kv.n * Fc / (R * kv.T));
                case 'E0': return kv.E + (R * kv.T / (kv.n * Fc)) * Math.log(kv.Q);
                default: return null;
            }
        },
    },
    {
        name: 'Arrhenius Equation', expression: 'k = A * exp(-Ea/(RT))',
        variables: { k: 'Rate constant', A_pre: 'Pre-exponential factor', Ea: 'Activation energy (J/mol)', R: 'Gas constant (8.314)', T: 'Temperature (K)' },
        aliases: ['arrhenius', 'reaction rate', 'activation energy'],
        solve(solveFor, kv) {
            const R = kv.R ?? 8.314462618;
            switch (solveFor) {
                case 'k': return kv.A_pre * Math.exp(-kv.Ea / (R * kv.T));
                case 'Ea': return -R * kv.T * Math.log(kv.k / kv.A_pre);
                case 'T': return -kv.Ea / (R * Math.log(kv.k / kv.A_pre));
                case 'A_pre': return kv.k / Math.exp(-kv.Ea / (R * kv.T));
                default: return null;
            }
        },
    },
    {
        name: 'Clausius-Clapeyron', expression: 'ln(P2/P1) = -\u0394Hvap/R * (1/T2 - 1/T1)',
        variables: { P1: 'Pressure 1 (Pa)', P2: 'Pressure 2 (Pa)', T1: 'Temperature 1 (K)', T2: 'Temperature 2 (K)', dHvap: 'Enthalpy of vaporization (J/mol)', R: 'Gas constant (8.314)' },
        aliases: ['clausius-clapeyron', 'clausius clapeyron', 'vapor pressure'],
        solve(solveFor, kv) {
            const R = kv.R ?? 8.314462618;
            switch (solveFor) {
                case 'P2': return kv.P1 * Math.exp(-kv.dHvap / R * (1 / kv.T2 - 1 / kv.T1));
                case 'T2': return 1 / (1 / kv.T1 - R * Math.log(kv.P2 / kv.P1) / kv.dHvap);
                case 'dHvap': return -R * Math.log(kv.P2 / kv.P1) / (1 / kv.T2 - 1 / kv.T1);
                default: return null;
            }
        },
    },
    {
        name: 'Hubble Law', expression: 'v = H_0 * d',
        variables: { v: 'Recession velocity (km/s)', H0: 'Hubble constant (~67.4 km/s/Mpc)', d: 'Distance (Mpc)' },
        aliases: ['hubble law', 'hubble', 'recession velocity'],
        solve(solveFor, kv) {
            const H = kv.H0 ?? 67.4;
            switch (solveFor) {
                case 'v': return H * kv.d;
                case 'd': return kv.v / H;
                case 'H0': return kv.v / kv.d;
                default: return null;
            }
        },
    },
    {
        name: 'Lens Equation', expression: '1/f = 1/do + 1/di',
        variables: { f: 'Focal length (m)', do_dist: 'Object distance (m)', di: 'Image distance (m)' },
        aliases: ['lens equation', 'thin lens', 'mirror equation'],
        solve(solveFor, kv) {
            switch (solveFor) {
                case 'f': return 1 / (1 / kv.do_dist + 1 / kv.di);
                case 'do_dist': return 1 / (1 / kv.f - 1 / kv.di);
                case 'di': return 1 / (1 / kv.f - 1 / kv.do_dist);
                default: return null;
            }
        },
    },
    {
        name: 'Resistors in Parallel', expression: '1/R_total = 1/R1 + 1/R2',
        variables: { R_total: 'Total resistance (\u03A9)', R1: 'Resistance 1 (\u03A9)', R2: 'Resistance 2 (\u03A9)' },
        aliases: ['parallel resistance', 'resistors parallel'],
        solve(solveFor, kv) {
            switch (solveFor) {
                case 'R_total': return 1 / (1 / kv.R1 + 1 / kv.R2);
                case 'R1': return 1 / (1 / kv.R_total - 1 / kv.R2);
                case 'R2': return 1 / (1 / kv.R_total - 1 / kv.R1);
                default: return null;
            }
        },
    },
    {
        name: 'RC Time Constant', expression: '\u03C4 = RC',
        variables: { tau: 'Time constant (s)', R: 'Resistance (\u03A9)', C: 'Capacitance (F)' },
        aliases: ['rc circuit', 'time constant', 'rc time constant'],
        solve(solveFor, kv) {
            switch (solveFor) {
                case 'tau': return kv.R * kv.C;
                case 'R': return kv.tau / kv.C;
                case 'C': return kv.tau / kv.R;
                default: return null;
            }
        },
    },
    {
        name: 'Heisenberg Uncertainty (position-momentum)', expression: '\u0394x * \u0394p >= \u0127/2',
        variables: { dx: 'Position uncertainty (m)', dp: 'Momentum uncertainty (kg*m/s)' },
        aliases: ['heisenberg', 'uncertainty principle', 'heisenberg uncertainty'],
        solve(solveFor, kv) {
            const hbar = 1.054571817e-34;
            switch (solveFor) {
                case 'dx': return hbar / (2 * kv.dp);
                case 'dp': return hbar / (2 * kv.dx);
                default: return null;
            }
        },
    },
    {
        name: 'Boltzmann Distribution', expression: 'N2/N1 = exp(-\u0394E/(k_B*T))',
        variables: { ratio: 'N2/N1 population ratio', dE: 'Energy difference (J)', k_B: 'Boltzmann constant (1.381e-23 J/K)', T: 'Temperature (K)' },
        aliases: ['boltzmann distribution', 'population ratio', 'thermal distribution'],
        solve(solveFor, kv) {
            const kB = kv.k_B ?? 1.380649e-23;
            switch (solveFor) {
                case 'ratio': return Math.exp(-kv.dE / (kB * kv.T));
                case 'dE': return -kB * kv.T * Math.log(kv.ratio);
                case 'T': return -kv.dE / (kB * Math.log(kv.ratio));
                default: return null;
            }
        },
    },
    {
        name: 'Bernoulli Equation', expression: 'P + 0.5\u03C1v^2 + \u03C1gh = const',
        variables: { P1: 'Pressure 1 (Pa)', rho: 'Fluid density (kg/m^3)', v1: 'Velocity 1 (m/s)', h1: 'Height 1 (m)', P2: 'Pressure 2 (Pa)', v2: 'Velocity 2 (m/s)', h2: 'Height 2 (m)' },
        aliases: ['bernoulli', 'fluid dynamics', 'bernoulli equation'],
        solve(solveFor, kv) {
            const g = 9.80665;
            switch (solveFor) {
                case 'P2': return kv.P1 + 0.5 * kv.rho * (kv.v1 ** 2 - kv.v2 ** 2) + kv.rho * g * (kv.h1 - kv.h2);
                case 'v2': return Math.sqrt(kv.v1 ** 2 + 2 * (kv.P1 - kv.P2) / kv.rho + 2 * g * (kv.h1 - kv.h2));
                case 'P1': return kv.P2 - 0.5 * kv.rho * (kv.v1 ** 2 - kv.v2 ** 2) - kv.rho * g * (kv.h1 - kv.h2);
                default: return null;
            }
        },
    },
    {
        name: 'Drag Force', expression: 'F_d = 0.5 * C_d * \u03C1 * A * v^2',
        variables: { F_d: 'Drag force (N)', C_d: 'Drag coefficient', rho: 'Fluid density (kg/m^3)', A: 'Reference area (m^2)', v: 'Velocity (m/s)' },
        aliases: ['drag force', 'air resistance', 'drag equation'],
        solve(solveFor, kv) {
            switch (solveFor) {
                case 'F_d': return 0.5 * kv.C_d * kv.rho * kv.A * kv.v * kv.v;
                case 'v': return Math.sqrt(2 * kv.F_d / (kv.C_d * kv.rho * kv.A));
                case 'C_d': return 2 * kv.F_d / (kv.rho * kv.A * kv.v * kv.v);
                default: return null;
            }
        },
    },
    {
        name: 'Torque', expression: '\u03C4 = r * F * sin(\u03B8)',
        variables: { tau: 'Torque (N*m)', r: 'Lever arm (m)', F: 'Force (N)', theta: 'Angle (rad)' },
        aliases: ['torque', 'moment of force'],
        solve(solveFor, kv) {
            switch (solveFor) {
                case 'tau': return kv.r * kv.F * Math.sin(kv.theta);
                case 'F': return kv.tau / (kv.r * Math.sin(kv.theta));
                case 'r': return kv.tau / (kv.F * Math.sin(kv.theta));
                case 'theta': return Math.asin(kv.tau / (kv.r * kv.F));
                default: return null;
            }
        },
    },
    {
        name: 'Entropy Change', expression: '\u0394S = Q/T',
        variables: { dS: 'Entropy change (J/K)', Q: 'Heat transfer (J)', T: 'Temperature (K)' },
        aliases: ['entropy', 'entropy change'],
        solve(solveFor, kv) {
            switch (solveFor) {
                case 'dS': return kv.Q / kv.T;
                case 'Q': return kv.dS * kv.T;
                case 'T': return kv.Q / kv.dS;
                default: return null;
            }
        },
    },
    {
        name: 'Carnot Efficiency', expression: '\u03B7 = 1 - T_cold/T_hot',
        variables: { eta: 'Efficiency (0-1)', T_cold: 'Cold reservoir temp (K)', T_hot: 'Hot reservoir temp (K)' },
        aliases: ['carnot', 'carnot efficiency', 'heat engine efficiency'],
        solve(solveFor, kv) {
            switch (solveFor) {
                case 'eta': return 1 - kv.T_cold / kv.T_hot;
                case 'T_cold': return kv.T_hot * (1 - kv.eta);
                case 'T_hot': return kv.T_cold / (1 - kv.eta);
                default: return null;
            }
        },
    },
    {
        name: 'Magnetic Force on Moving Charge', expression: 'F = qvB*sin(\u03B8)',
        variables: { F: 'Force (N)', q: 'Charge (C)', v: 'Velocity (m/s)', B: 'Magnetic field (T)', theta: 'Angle (rad)' },
        aliases: ['lorentz force', 'magnetic force', 'qvb'],
        solve(solveFor, kv) {
            switch (solveFor) {
                case 'F': return kv.q * kv.v * kv.B * Math.sin(kv.theta);
                case 'v': return kv.F / (kv.q * kv.B * Math.sin(kv.theta));
                case 'B': return kv.F / (kv.q * kv.v * Math.sin(kv.theta));
                default: return null;
            }
        },
    },
    {
        name: 'Planck Radiation Law (peak)', expression: '\u03BB_max = b / T',
        variables: { lambda_max: 'Peak wavelength (m)', b: 'Wien constant (2.898e-3 m*K)', T: 'Temperature (K)' },
        aliases: ['wien law', 'planck peak', 'peak wavelength'],
        solve(solveFor, kv) {
            const b = kv.b ?? 2.897771955e-3;
            switch (solveFor) {
                case 'lambda_max': return b / kv.T;
                case 'T': return b / kv.lambda_max;
                default: return null;
            }
        },
    },
    {
        name: 'Rocket Equation (Tsiolkovsky)', expression: '\u0394v = v_e * ln(m_0/m_f)',
        variables: { dv: 'Delta-v (m/s)', v_e: 'Exhaust velocity (m/s)', m_0: 'Initial mass (kg)', m_f: 'Final mass (kg)' },
        aliases: ['tsiolkovsky', 'rocket equation', 'delta-v'],
        solve(solveFor, kv) {
            switch (solveFor) {
                case 'dv': return kv.v_e * Math.log(kv.m_0 / kv.m_f);
                case 'm_0': return kv.m_f * Math.exp(kv.dv / kv.v_e);
                case 'm_f': return kv.m_0 / Math.exp(kv.dv / kv.v_e);
                case 'v_e': return kv.dv / Math.log(kv.m_0 / kv.m_f);
                default: return null;
            }
        },
    },
];
function findFormula(query) {
    const q = query.toLowerCase().trim();
    for (const f of FORMULAS) {
        if (f.expression.toLowerCase() === q || f.name.toLowerCase() === q)
            return f;
        if (f.aliases.some(a => a.toLowerCase() === q))
            return f;
    }
    // Partial match
    for (const f of FORMULAS) {
        if (f.name.toLowerCase().includes(q) || f.expression.toLowerCase().includes(q))
            return f;
        if (f.aliases.some(a => a.toLowerCase().includes(q)))
            return f;
    }
    return null;
}
// ─── Fetch Helper ───────────────────────────────────────────────────────────
const UA = 'KBot/3.0 (Lab Tools)';
async function labFetch(url) {
    return fetch(url, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(10000),
    });
}
async function labFetchJson(url) {
    const res = await labFetch(url);
    if (!res.ok)
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
}
// ─── Tool Implementations ───────────────────────────────────────────────────
export function registerLabCoreTools() {
    // ── 1. Experiment Design ────────────────────────────────────────────────
    registerTool({
        name: 'experiment_design',
        description: 'Generate a structured experimental design from a research question. Covers RCT, factorial, observational, crossover, and longitudinal designs. Outputs variables, controls, sample size formula, randomization scheme, and statistical test recommendation.',
        parameters: {
            research_question: { type: 'string', description: 'The research question to design an experiment for', required: true },
            design_type: { type: 'string', description: 'Design type: rct, factorial, observational, crossover, longitudinal', required: true },
            variables: { type: 'string', description: 'Comma-separated list of variables to consider (optional)' },
        },
        tier: 'free',
        async execute(args) {
            const question = String(args.research_question);
            const designType = String(args.design_type).toLowerCase().trim();
            const variables = args.variables ? String(args.variables).split(',').map(v => v.trim()) : [];
            const designs = {
                rct: {
                    fullName: 'Randomized Controlled Trial (RCT)',
                    description: 'Gold standard for establishing causal relationships. Participants randomly assigned to treatment or control groups.',
                    structure: '1. Define target population and eligibility criteria\n2. Randomize participants to treatment (T) and control (C) groups\n3. Administer intervention to T, placebo/standard care to C\n4. Measure primary and secondary outcomes\n5. Analyze with intention-to-treat (ITT) principle',
                    randomization: 'Simple randomization (coin flip), block randomization (blocks of 4-6), stratified randomization (by key confounders), or adaptive randomization (minimization)',
                    sampleSizeFormula: 'n = (Z_{alpha/2} + Z_{beta})^2 * 2 * sigma^2 / delta^2\nWhere: Z_{alpha/2} = 1.96 (for alpha=0.05), Z_{beta} = 0.84 (for power=0.80), sigma = population SD, delta = minimum detectable effect',
                    statisticalTests: ['Independent t-test (continuous outcome)', 'Chi-square test (categorical outcome)', 'ANCOVA (adjusted for baseline)', 'Cox regression (time-to-event)', 'Mixed-effects model (repeated measures)'],
                    strengths: ['Strongest evidence for causation', 'Controls for known and unknown confounders', 'Minimizes selection bias'],
                    limitations: ['Expensive and time-consuming', 'May not be ethical for all questions', 'External validity concerns (strict inclusion criteria)'],
                    ethicalConsiderations: ['Equipoise must exist', 'Informed consent required', 'IRB/Ethics committee approval', 'Data Safety Monitoring Board (DSMB) for interim analyses'],
                },
                factorial: {
                    fullName: 'Factorial Design',
                    description: 'Tests multiple factors simultaneously, revealing main effects and interactions. Efficient for studying combinations.',
                    structure: '1. Identify factors (A, B, ...) and levels for each\n2. Create all factor-level combinations (full factorial) or select subset (fractional)\n3. Randomly assign participants to combinations\n4. Measure outcomes for each combination\n5. Analyze main effects and interactions via ANOVA',
                    randomization: 'Complete randomization to factorial cells. For 2x2: participants randomly assigned to one of 4 cells (A+B+, A+B-, A-B+, A-B-)',
                    sampleSizeFormula: 'n_per_cell = (Z_{alpha/2} + Z_{beta})^2 * sigma^2 / delta^2\nTotal N = n_per_cell * number_of_cells\nFor 2^k design: number_of_cells = 2^k\nFractional designs: 2^(k-p) cells (Resolution III+ recommended)',
                    statisticalTests: ['Two-way/multi-way ANOVA', 'Interaction F-tests', 'Simple effects analysis (if interaction significant)', 'Tukey HSD or Bonferroni post-hoc'],
                    strengths: ['Tests interactions between factors', 'More efficient than one-factor-at-a-time', 'Can estimate all main effects and interactions'],
                    limitations: ['Number of cells grows exponentially (2^k)', 'Hard to interpret high-order interactions', 'Requires larger total sample size'],
                    ethicalConsiderations: ['Participants exposed to multiple manipulations', 'Combination effects may be unpredictable', 'Power analysis must account for interaction terms'],
                },
                observational: {
                    fullName: 'Observational Study',
                    description: 'Researcher observes without intervening. Includes cohort, case-control, and cross-sectional designs.',
                    structure: '1. Define exposure and outcome variables\n2. Select study population and comparison group\n3. Collect data through surveys, records, or measurement\n4. Control for confounders via matching, stratification, or regression\n5. Analyze association strength (OR, RR, HR)',
                    randomization: 'No randomization (observational). Instead use: propensity score matching, inverse probability weighting, or instrumental variables to reduce confounding.',
                    sampleSizeFormula: 'Cohort: n = (Z_{alpha/2} + Z_{beta})^2 * [p1*(1-p1) + p2*(1-p2)] / (p1 - p2)^2\nCase-control: n_cases = (Z_{alpha/2}*sqrt(2*p_bar*(1-p_bar)) + Z_{beta}*sqrt(p1*(1-p1)+p2*(1-p2)))^2 / (p1-p2)^2\nWhere p1, p2 are expected proportions in exposed/unexposed',
                    statisticalTests: ['Logistic regression (binary outcome)', 'Cox proportional hazards (time-to-event)', 'Propensity score matching', 'Mantel-Haenszel test (stratified)', 'Poisson regression (count data)'],
                    strengths: ['Ethical when randomization impossible', 'Can study rare exposures or outcomes', 'Often cheaper and faster than RCTs', 'Better external validity'],
                    limitations: ['Cannot establish causation', 'Susceptible to confounding', 'Selection bias and recall bias possible'],
                    ethicalConsiderations: ['Privacy and data protection', 'Informed consent for surveys', 'Responsible reporting (correlation != causation)'],
                },
                crossover: {
                    fullName: 'Crossover Design',
                    description: 'Each participant receives all treatments in sequence, acting as their own control. Powerful for within-subject comparisons.',
                    structure: '1. Randomize participants to treatment sequences (e.g., AB vs BA)\n2. Administer first treatment, measure outcome\n3. Washout period (sufficient to eliminate carryover)\n4. Administer second treatment, measure outcome\n5. Analyze within-subject differences',
                    randomization: 'Randomize treatment ORDER (not assignment). For 2 treatments: equal allocation to AB and BA sequences. For k treatments: Latin square or Williams design.',
                    sampleSizeFormula: 'n = (Z_{alpha/2} + Z_{beta})^2 * sigma_d^2 / delta^2\nWhere sigma_d = within-subject SD of paired differences\nNote: typically requires 50-75% fewer subjects than parallel design because within-subject variability < between-subject',
                    statisticalTests: ['Paired t-test', 'Repeated measures ANOVA', 'Carryover effect test (sequence x period interaction)', 'Mixed-effects model with period and sequence terms'],
                    strengths: ['Each participant is own control', 'Eliminates between-subject variability', 'Requires fewer participants', 'Cost-effective'],
                    limitations: ['Requires adequate washout period', 'Carryover effects can bias results', 'Not suitable for irreversible outcomes', 'Dropouts lose all data'],
                    ethicalConsiderations: ['Extended study duration for participants', 'Washout period risks (no treatment)', 'Must test for carryover before interpreting results'],
                },
                longitudinal: {
                    fullName: 'Longitudinal Study',
                    description: 'Follows the same subjects over time, measuring changes and trajectories. Ideal for studying development, progression, or long-term effects.',
                    structure: '1. Define cohort and measurement schedule (waves)\n2. Baseline assessment of all variables\n3. Follow-up assessments at predetermined intervals\n4. Track attrition and handle missing data\n5. Model change over time (growth curves, trajectories)',
                    randomization: 'No randomization (observational longitudinal). Sampling strategies: random sampling from population, stratified sampling, or purposive sampling for subgroups of interest.',
                    sampleSizeFormula: 'n = (Z_{alpha/2} + Z_{beta})^2 * sigma^2 * [1 + (m-1)*rho] / (m * delta^2)\nWhere m = number of measurements, rho = intraclass correlation\nAdjust for expected attrition: n_adjusted = n / (1 - attrition_rate)^waves',
                    statisticalTests: ['Mixed-effects / multilevel models', 'Growth curve modeling (latent growth)', 'Generalized estimating equations (GEE)', 'Survival analysis (time-to-event)', 'Autoregressive cross-lagged models'],
                    strengths: ['Tracks individual change over time', 'Establishes temporal ordering', 'Can identify developmental trajectories', 'Powerful for mediation analysis'],
                    limitations: ['Attrition can introduce bias', 'Expensive and time-consuming', 'Practice effects on repeated measures', 'Cohort effects may limit generalizability'],
                    ethicalConsiderations: ['Long-term participant burden', 'Data security over extended periods', 'Right to withdraw at any point', 'Incidental findings protocols'],
                },
            };
            const design = designs[designType];
            if (!design) {
                return `**Error**: Unknown design type "${designType}". Supported types: ${Object.keys(designs).join(', ')}`;
            }
            const iv = variables.length > 0 ? variables[0] : '[Independent Variable]';
            const dv = variables.length > 1 ? variables[1] : '[Dependent Variable]';
            const covariates = variables.length > 2 ? variables.slice(2) : ['[Covariate 1]', '[Covariate 2]'];
            return [
                `# Experimental Design: ${design.fullName}`,
                '',
                `## Research Question`,
                `> ${question}`,
                '',
                `## Design Overview`,
                design.description,
                '',
                `## Variables`,
                `- **Independent Variable (IV)**: ${iv}`,
                `- **Dependent Variable (DV)**: ${dv}`,
                `- **Covariates/Controls**: ${covariates.join(', ')}`,
                `- **Confounders to Address**: Age, sex, baseline status, socioeconomic factors`,
                '',
                `## Study Structure`,
                design.structure,
                '',
                `## Randomization Scheme`,
                design.randomization,
                '',
                `## Sample Size Estimation`,
                '```',
                design.sampleSizeFormula,
                '```',
                '',
                `## Recommended Statistical Tests`,
                ...design.statisticalTests.map(t => `- ${t}`),
                '',
                `## Strengths`,
                ...design.strengths.map(s => `- ${s}`),
                '',
                `## Limitations`,
                ...design.limitations.map(l => `- ${l}`),
                '',
                `## Ethical Considerations`,
                ...design.ethicalConsiderations.map(e => `- ${e}`),
                '',
                `## Reporting Guidelines`,
                designType === 'rct' ? '- Follow CONSORT Statement (Consolidated Standards of Reporting Trials)' :
                    designType === 'observational' ? '- Follow STROBE Statement (Strengthening the Reporting of Observational Studies)' :
                        '- Follow EQUATOR Network guidelines appropriate to your design',
                `- Pre-register study protocol (ClinicalTrials.gov, OSF, AsPredicted)`,
                `- Report effect sizes with confidence intervals, not just p-values`,
            ].join('\n');
        },
    });
    // ── 2. Hypothesis Test ──────────────────────────────────────────────────
    registerTool({
        name: 'hypothesis_test',
        description: 'Run statistical hypothesis tests with real calculations. Supports: t-test (one-sample, two-sample, paired), chi-square, mann-whitney, wilcoxon, anova, kruskal-wallis. Returns test statistic, p-value, effect size, and interpretation.',
        parameters: {
            test_type: { type: 'string', description: 'Test type: t-test-one, t-test-two, t-test-paired, chi-square, mann-whitney, wilcoxon, anova, kruskal-wallis', required: true },
            data_a: { type: 'string', description: 'Comma-separated numbers for sample A (or observed counts for chi-square)', required: true },
            data_b: { type: 'string', description: 'Comma-separated numbers for sample B (or expected counts for chi-square)' },
            alpha: { type: 'number', description: 'Significance level (default: 0.05)' },
        },
        tier: 'free',
        async execute(args) {
            const testType = String(args.test_type).toLowerCase().trim();
            const a = parseNumbers(String(args.data_a));
            const b = args.data_b ? parseNumbers(String(args.data_b)) : [];
            const alpha = typeof args.alpha === 'number' ? args.alpha : 0.05;
            if (a.length < 2)
                return '**Error**: Sample A must have at least 2 values.';
            const lines = [];
            switch (testType) {
                case 't-test-one':
                case 'one-sample-t':
                case 't-one': {
                    const mu0 = b.length > 0 ? b[0] : 0;
                    const n = a.length;
                    const m = mean(a);
                    const se = stddev(a) / Math.sqrt(n);
                    const t = (m - mu0) / se;
                    const df = n - 1;
                    const p = tTestPValue(t, df);
                    const d = (m - mu0) / stddev(a); // Cohen's d
                    lines.push(`# One-Sample t-Test`, '', `## Hypotheses`, `- H0: \u03BC = ${mu0}`, `- H1: \u03BC \u2260 ${mu0}`, '', `## Sample Statistics`, `- n = ${n}`, `- Mean = ${m.toFixed(6)}`, `- SD = ${stddev(a).toFixed(6)}`, `- SE = ${se.toFixed(6)}`, '', `## Test Results`, `- t-statistic = ${t.toFixed(6)}`, `- Degrees of freedom = ${df}`, `- p-value (two-tailed) = ${p.toFixed(8)}`, '', `## Effect Size`, `- Cohen's d = ${d.toFixed(4)} (${Math.abs(d) < 0.2 ? 'negligible' : Math.abs(d) < 0.5 ? 'small' : Math.abs(d) < 0.8 ? 'medium' : 'large'})`, '', `## Decision`, `- At \u03B1 = ${alpha}: **${p < alpha ? 'Reject H0' : 'Fail to reject H0'}**`, p < alpha
                        ? `- There is statistically significant evidence that the population mean differs from ${mu0}.`
                        : `- There is insufficient evidence to conclude the population mean differs from ${mu0}.`);
                    break;
                }
                case 't-test-two':
                case 'two-sample-t':
                case 't-two':
                case 'independent-t': {
                    if (b.length < 2)
                        return '**Error**: Sample B must have at least 2 values for two-sample t-test.';
                    const n1 = a.length, n2 = b.length;
                    const m1 = mean(a), m2 = mean(b);
                    const v1 = variance(a), v2 = variance(b);
                    // Welch's t-test (does not assume equal variances)
                    const se = Math.sqrt(v1 / n1 + v2 / n2);
                    const t = (m1 - m2) / se;
                    // Welch-Satterthwaite degrees of freedom
                    const dfNum = (v1 / n1 + v2 / n2) ** 2;
                    const dfDen = (v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1);
                    const df = dfNum / dfDen;
                    const p = tTestPValue(t, df);
                    // Pooled SD for Cohen's d
                    const sp = Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2));
                    const d = (m1 - m2) / sp;
                    lines.push(`# Two-Sample t-Test (Welch's)`, '', `## Hypotheses`, `- H0: \u03BC1 = \u03BC2`, `- H1: \u03BC1 \u2260 \u03BC2`, '', `## Sample Statistics`, `| | Sample A | Sample B |`, `|---|---|---|`, `| n | ${n1} | ${n2} |`, `| Mean | ${m1.toFixed(6)} | ${m2.toFixed(6)} |`, `| SD | ${Math.sqrt(v1).toFixed(6)} | ${Math.sqrt(v2).toFixed(6)} |`, `| Variance | ${v1.toFixed(6)} | ${v2.toFixed(6)} |`, '', `## Test Results`, `- t-statistic = ${t.toFixed(6)}`, `- Degrees of freedom (Welch-Satterthwaite) = ${df.toFixed(2)}`, `- p-value (two-tailed) = ${p.toFixed(8)}`, '', `## Effect Size`, `- Cohen's d = ${d.toFixed(4)} (${Math.abs(d) < 0.2 ? 'negligible' : Math.abs(d) < 0.5 ? 'small' : Math.abs(d) < 0.8 ? 'medium' : 'large'})`, `- Mean difference = ${(m1 - m2).toFixed(6)}`, '', `## Decision`, `- At \u03B1 = ${alpha}: **${p < alpha ? 'Reject H0' : 'Fail to reject H0'}**`);
                    break;
                }
                case 't-test-paired':
                case 'paired-t':
                case 't-paired': {
                    if (b.length !== a.length)
                        return `**Error**: Paired t-test requires equal sample sizes. A has ${a.length}, B has ${b.length}.`;
                    const diffs = a.map((v, i) => v - b[i]);
                    const n = diffs.length;
                    const md = mean(diffs);
                    const sd = stddev(diffs);
                    const se = sd / Math.sqrt(n);
                    const t = md / se;
                    const df = n - 1;
                    const p = tTestPValue(t, df);
                    const d = md / sd; // Cohen's d for paired
                    lines.push(`# Paired t-Test`, '', `## Hypotheses`, `- H0: \u03BC_d = 0 (no difference)`, `- H1: \u03BC_d \u2260 0`, '', `## Difference Statistics`, `- n pairs = ${n}`, `- Mean difference = ${md.toFixed(6)}`, `- SD of differences = ${sd.toFixed(6)}`, `- SE = ${se.toFixed(6)}`, '', `## Test Results`, `- t-statistic = ${t.toFixed(6)}`, `- Degrees of freedom = ${df}`, `- p-value (two-tailed) = ${p.toFixed(8)}`, '', `## Effect Size`, `- Cohen's d (paired) = ${d.toFixed(4)} (${Math.abs(d) < 0.2 ? 'negligible' : Math.abs(d) < 0.5 ? 'small' : Math.abs(d) < 0.8 ? 'medium' : 'large'})`, '', `## Decision`, `- At \u03B1 = ${alpha}: **${p < alpha ? 'Reject H0' : 'Fail to reject H0'}**`);
                    break;
                }
                case 'chi-square':
                case 'chi2':
                case 'chisquare': {
                    // observed = a, expected = b (or uniform if not provided)
                    const observed = a;
                    const expected = b.length === a.length ? b : a.map(() => mean(a));
                    const k = observed.length;
                    let chiSq = 0;
                    for (let i = 0; i < k; i++) {
                        chiSq += (observed[i] - expected[i]) ** 2 / expected[i];
                    }
                    const df = k - 1;
                    const p = 1 - chiSquareCdf(chiSq, df);
                    // Cramer's V (for goodness of fit, use phi)
                    const n = observed.reduce((s, v) => s + v, 0);
                    const phi = Math.sqrt(chiSq / n);
                    lines.push(`# Chi-Square Goodness-of-Fit Test`, '', `## Hypotheses`, `- H0: Observed frequencies match expected frequencies`, `- H1: Observed frequencies differ from expected frequencies`, '', `## Data`, `| Category | Observed | Expected |`, `|---|---|---|`, ...observed.map((o, i) => `| ${i + 1} | ${o} | ${expected[i].toFixed(2)} |`), '', `## Test Results`, `- \u03C7\u00B2 statistic = ${chiSq.toFixed(6)}`, `- Degrees of freedom = ${df}`, `- p-value = ${p.toFixed(8)}`, '', `## Effect Size`, `- Phi (\u03C6) = ${phi.toFixed(4)}`, '', `## Decision`, `- At \u03B1 = ${alpha}: **${p < alpha ? 'Reject H0' : 'Fail to reject H0'}**`);
                    break;
                }
                case 'mann-whitney':
                case 'mann-whitney-u':
                case 'mannwhitney': {
                    if (b.length < 2)
                        return '**Error**: Sample B must have at least 2 values for Mann-Whitney U test.';
                    const n1 = a.length, n2 = b.length;
                    // Combine and rank
                    const combined = [
                        ...a.map(v => ({ v, group: 'a' })),
                        ...b.map(v => ({ v, group: 'b' })),
                    ].sort((x, y) => x.v - y.v);
                    // Assign ranks with tie handling
                    const ranks = new Array(combined.length);
                    let i = 0;
                    while (i < combined.length) {
                        let j = i;
                        while (j < combined.length && combined[j].v === combined[i].v)
                            j++;
                        const avgRank = (i + 1 + j) / 2;
                        for (let k = i; k < j; k++)
                            ranks[k] = avgRank;
                        i = j;
                    }
                    let R1 = 0;
                    for (let k = 0; k < combined.length; k++) {
                        if (combined[k].group === 'a')
                            R1 += ranks[k];
                    }
                    const U1 = R1 - n1 * (n1 + 1) / 2;
                    const U2 = n1 * n2 - U1;
                    const U = Math.min(U1, U2);
                    // Normal approximation for p-value
                    const muU = n1 * n2 / 2;
                    const sigmaU = Math.sqrt(n1 * n2 * (n1 + n2 + 1) / 12);
                    const z = (U - muU) / sigmaU;
                    const p = 2 * normalCdf(z); // two-tailed (z is typically negative for min U)
                    // Rank-biserial correlation
                    const rbc = 1 - (2 * U) / (n1 * n2);
                    lines.push(`# Mann-Whitney U Test`, '', `## Hypotheses`, `- H0: The two populations have the same distribution`, `- H1: The two populations differ in location`, '', `## Sample Statistics`, `- n1 = ${n1}, n2 = ${n2}`, `- Median A = ${[...a].sort((x, y) => x - y)[Math.floor(n1 / 2)].toFixed(4)}`, `- Median B = ${[...b].sort((x, y) => x - y)[Math.floor(n2 / 2)].toFixed(4)}`, `- Rank sum (A) = ${R1.toFixed(1)}`, '', `## Test Results`, `- U1 = ${U1.toFixed(1)}, U2 = ${U2.toFixed(1)}`, `- U (min) = ${U.toFixed(1)}`, `- z-approximation = ${z.toFixed(6)}`, `- p-value (two-tailed) = ${p.toFixed(8)}`, n1 <= 20 || n2 <= 20 ? `- *Note: Normal approximation used. For small samples (n <= 20), consider exact tables.*` : '', '', `## Effect Size`, `- Rank-biserial correlation = ${rbc.toFixed(4)} (${Math.abs(rbc) < 0.1 ? 'negligible' : Math.abs(rbc) < 0.3 ? 'small' : Math.abs(rbc) < 0.5 ? 'medium' : 'large'})`, '', `## Decision`, `- At \u03B1 = ${alpha}: **${p < alpha ? 'Reject H0' : 'Fail to reject H0'}**`);
                    break;
                }
                case 'wilcoxon':
                case 'wilcoxon-signed-rank':
                case 'signed-rank': {
                    if (b.length > 0 && b.length !== a.length)
                        return `**Error**: Wilcoxon signed-rank test requires equal sample sizes or single-sample vs zero. A=${a.length}, B=${b.length}.`;
                    const diffs = b.length === a.length ? a.map((v, i) => v - b[i]) : a;
                    const nonZero = diffs.filter(d => d !== 0);
                    const n = nonZero.length;
                    if (n < 2)
                        return '**Error**: Need at least 2 non-zero differences.';
                    // Rank absolute differences
                    const ranked = nonZero.map(d => ({ d, abs: Math.abs(d) })).sort((x, y) => x.abs - y.abs);
                    const ranksArr = new Array(n);
                    let ri = 0;
                    while (ri < n) {
                        let rj = ri;
                        while (rj < n && ranked[rj].abs === ranked[ri].abs)
                            rj++;
                        const avg = (ri + 1 + rj) / 2;
                        for (let rk = ri; rk < rj; rk++)
                            ranksArr[rk] = avg;
                        ri = rj;
                    }
                    let Wplus = 0, Wminus = 0;
                    for (let k = 0; k < n; k++) {
                        if (ranked[k].d > 0)
                            Wplus += ranksArr[k];
                        else
                            Wminus += ranksArr[k];
                    }
                    const W = Math.min(Wplus, Wminus);
                    // Normal approximation
                    const muW = n * (n + 1) / 4;
                    const sigmaW = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24);
                    const z = (W - muW) / sigmaW;
                    const p = 2 * normalCdf(z);
                    // Effect size: r = z / sqrt(n)
                    const r = z / Math.sqrt(n);
                    lines.push(`# Wilcoxon Signed-Rank Test`, '', `## Hypotheses`, `- H0: Median difference = 0`, `- H1: Median difference \u2260 0`, '', `## Statistics`, `- n (non-zero differences) = ${n}`, `- W+ = ${Wplus.toFixed(1)}, W- = ${Wminus.toFixed(1)}`, `- W (test statistic) = ${W.toFixed(1)}`, '', `## Test Results`, `- z-approximation = ${z.toFixed(6)}`, `- p-value (two-tailed) = ${p.toFixed(8)}`, '', `## Effect Size`, `- r = ${r.toFixed(4)} (${Math.abs(r) < 0.1 ? 'negligible' : Math.abs(r) < 0.3 ? 'small' : Math.abs(r) < 0.5 ? 'medium' : 'large'})`, '', `## Decision`, `- At \u03B1 = ${alpha}: **${p < alpha ? 'Reject H0' : 'Fail to reject H0'}**`);
                    break;
                }
                case 'anova':
                case 'one-way-anova': {
                    // data_a is first group, data_b is remaining groups separated by semicolons
                    // Or: treat data_a as semicolon-separated groups if data_b is empty
                    let groups;
                    if (b.length > 0) {
                        groups = [a, b];
                    }
                    else {
                        // Try semicolons in original string
                        const rawA = String(args.data_a);
                        if (rawA.includes(';')) {
                            groups = rawA.split(';').map(g => parseNumbers(g));
                        }
                        else {
                            return '**Error**: ANOVA requires 2+ groups. Separate groups with semicolons in data_a, or provide data_b for a second group.';
                        }
                    }
                    groups = groups.filter(g => g.length > 0);
                    if (groups.length < 2)
                        return '**Error**: ANOVA requires at least 2 groups.';
                    const k = groups.length;
                    const N = groups.reduce((s, g) => s + g.length, 0);
                    const grandMean = groups.reduce((s, g) => s + g.reduce((a, b) => a + b, 0), 0) / N;
                    // Between-group sum of squares
                    let SSB = 0;
                    for (const g of groups) {
                        const gm = mean(g);
                        SSB += g.length * (gm - grandMean) ** 2;
                    }
                    // Within-group sum of squares
                    let SSW = 0;
                    for (const g of groups) {
                        const gm = mean(g);
                        for (const v of g)
                            SSW += (v - gm) ** 2;
                    }
                    const dfB = k - 1;
                    const dfW = N - k;
                    const MSB = SSB / dfB;
                    const MSW = SSW / dfW;
                    const F = MSB / MSW;
                    const p = 1 - gammaPLower(dfB / 2, (dfB * F / (dfB * F + dfW)) * dfB / 2);
                    // Better: use beta distribution for F-test p-value
                    const x = dfW / (dfW + dfB * F);
                    const pBeta = betaIncomplete(x, dfW / 2, dfB / 2);
                    // Eta-squared
                    const etaSq = SSB / (SSB + SSW);
                    lines.push(`# One-Way ANOVA`, '', `## Hypotheses`, `- H0: All group means are equal (\u03BC1 = \u03BC2 = ... = \u03BCk)`, `- H1: At least one group mean differs`, '', `## Group Statistics`, `| Group | n | Mean | SD |`, `|---|---|---|---|`, ...groups.map((g, i) => `| ${i + 1} | ${g.length} | ${mean(g).toFixed(4)} | ${stddev(g).toFixed(4)} |`), '', `## ANOVA Table`, `| Source | SS | df | MS | F |`, `|---|---|---|---|---|`, `| Between | ${SSB.toFixed(4)} | ${dfB} | ${MSB.toFixed(4)} | ${F.toFixed(4)} |`, `| Within | ${SSW.toFixed(4)} | ${dfW} | ${MSW.toFixed(4)} | |`, `| Total | ${(SSB + SSW).toFixed(4)} | ${N - 1} | | |`, '', `## Test Results`, `- F(${dfB}, ${dfW}) = ${F.toFixed(6)}`, `- p-value = ${pBeta.toFixed(8)}`, '', `## Effect Size`, `- Eta-squared (\u03B7\u00B2) = ${etaSq.toFixed(4)} (${etaSq < 0.01 ? 'negligible' : etaSq < 0.06 ? 'small' : etaSq < 0.14 ? 'medium' : 'large'})`, '', `## Decision`, `- At \u03B1 = ${alpha}: **${pBeta < alpha ? 'Reject H0' : 'Fail to reject H0'}**`, pBeta < alpha ? '- *Consider post-hoc pairwise comparisons (Tukey HSD, Bonferroni)*' : '');
                    break;
                }
                case 'kruskal-wallis':
                case 'kruskal': {
                    let groups;
                    if (b.length > 0) {
                        groups = [a, b];
                    }
                    else {
                        const rawA = String(args.data_a);
                        if (rawA.includes(';')) {
                            groups = rawA.split(';').map(g => parseNumbers(g));
                        }
                        else {
                            return '**Error**: Kruskal-Wallis requires 2+ groups. Separate groups with semicolons in data_a.';
                        }
                    }
                    groups = groups.filter(g => g.length > 0);
                    if (groups.length < 2)
                        return '**Error**: Kruskal-Wallis requires at least 2 groups.';
                    const k = groups.length;
                    const N = groups.reduce((s, g) => s + g.length, 0);
                    // Combine and rank
                    const combined = [];
                    for (let gi = 0; gi < groups.length; gi++) {
                        for (const v of groups[gi])
                            combined.push({ v, group: gi });
                    }
                    combined.sort((x, y) => x.v - y.v);
                    const ranksArr = new Array(combined.length);
                    let ci = 0;
                    while (ci < combined.length) {
                        let cj = ci;
                        while (cj < combined.length && combined[cj].v === combined[ci].v)
                            cj++;
                        const avg = (ci + 1 + cj) / 2;
                        for (let ck = ci; ck < cj; ck++)
                            ranksArr[ck] = avg;
                        ci = cj;
                    }
                    // Sum of ranks per group
                    const R = new Array(k).fill(0);
                    for (let idx = 0; idx < combined.length; idx++) {
                        R[combined[idx].group] += ranksArr[idx];
                    }
                    // H statistic
                    let H = 0;
                    for (let gi = 0; gi < k; gi++) {
                        const ni = groups[gi].length;
                        H += (R[gi] ** 2) / ni;
                    }
                    H = (12 / (N * (N + 1))) * H - 3 * (N + 1);
                    const df = k - 1;
                    const p = 1 - chiSquareCdf(H, df);
                    // Epsilon-squared
                    const epsSq = H / ((N * N - 1) / (N + 1));
                    lines.push(`# Kruskal-Wallis H Test`, '', `## Hypotheses`, `- H0: All groups come from the same distribution`, `- H1: At least one group differs`, '', `## Group Statistics`, `| Group | n | Median | Mean Rank |`, `|---|---|---|---|`, ...groups.map((g, i) => {
                        const sorted = [...g].sort((x, y) => x - y);
                        const median = sorted.length % 2 === 0
                            ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
                            : sorted[Math.floor(sorted.length / 2)];
                        return `| ${i + 1} | ${g.length} | ${median.toFixed(4)} | ${(R[i] / g.length).toFixed(2)} |`;
                    }), '', `## Test Results`, `- H statistic = ${H.toFixed(6)}`, `- Degrees of freedom = ${df}`, `- p-value = ${p.toFixed(8)}`, '', `## Effect Size`, `- Epsilon-squared (\u03B5\u00B2) = ${epsSq.toFixed(4)} (${epsSq < 0.01 ? 'negligible' : epsSq < 0.06 ? 'small' : epsSq < 0.14 ? 'medium' : 'large'})`, '', `## Decision`, `- At \u03B1 = ${alpha}: **${p < alpha ? 'Reject H0' : 'Fail to reject H0'}**`, p < alpha ? '- *Consider post-hoc pairwise comparisons (Dunn test)*' : '');
                    break;
                }
                default:
                    return `**Error**: Unknown test type "${testType}". Supported: t-test-one, t-test-two, t-test-paired, chi-square, mann-whitney, wilcoxon, anova, kruskal-wallis`;
            }
            return lines.filter(l => l !== undefined).join('\n');
        },
    });
    // ── 3. Literature Search ────────────────────────────────────────────────
    registerTool({
        name: 'literature_search',
        description: 'Cross-database academic search via OpenAlex + CrossRef APIs simultaneously. Returns title, authors, year, journal, DOI, and citation count. Results are deduplicated by DOI.',
        parameters: {
            query: { type: 'string', description: 'Search query for academic literature', required: true },
            year_from: { type: 'number', description: 'Filter papers from this year onward (optional)' },
            year_to: { type: 'number', description: 'Filter papers up to this year (optional)' },
            limit: { type: 'number', description: 'Maximum number of results (default: 10)' },
        },
        tier: 'free',
        async execute(args) {
            const query = String(args.query);
            const yearFrom = typeof args.year_from === 'number' ? args.year_from : undefined;
            const yearTo = typeof args.year_to === 'number' ? args.year_to : undefined;
            const limit = typeof args.limit === 'number' ? Math.min(args.limit, 50) : 10;
            const papers = [];
            const seenDois = new Set();
            // Fetch from OpenAlex and CrossRef in parallel
            const [openAlexResult, crossRefResult] = await Promise.allSettled([
                // OpenAlex
                (async () => {
                    const params = new URLSearchParams({ search: query, per_page: String(limit) });
                    if (yearFrom || yearTo) {
                        const filter = [];
                        if (yearFrom)
                            filter.push(`from_publication_date:${yearFrom}-01-01`);
                        if (yearTo)
                            filter.push(`to_publication_date:${yearTo}-12-31`);
                        params.set('filter', filter.join(','));
                    }
                    const url = `https://api.openalex.org/works?${params.toString()}`;
                    const data = await labFetchJson(url);
                    if (data.results) {
                        for (const r of data.results) {
                            const doi = r.doi ? r.doi.replace('https://doi.org/', '') : '';
                            if (doi && seenDois.has(doi.toLowerCase()))
                                continue;
                            if (doi)
                                seenDois.add(doi.toLowerCase());
                            papers.push({
                                title: r.title || 'Untitled',
                                authors: r.authorships?.map(a => a.author?.display_name || 'Unknown').slice(0, 5) || [],
                                year: r.publication_year || null,
                                journal: r.primary_location?.source?.display_name || 'Unknown',
                                doi,
                                citations: r.cited_by_count || 0,
                                source: 'OpenAlex',
                            });
                        }
                    }
                })(),
                // CrossRef
                (async () => {
                    const params = new URLSearchParams({ query, rows: String(limit) });
                    if (yearFrom)
                        params.set('filter', `from-pub-date:${yearFrom}`);
                    const url = `https://api.crossref.org/works?${params.toString()}`;
                    const data = await labFetchJson(url);
                    if (data.message?.items) {
                        for (const r of data.message.items) {
                            const doi = r.DOI || '';
                            if (doi && seenDois.has(doi.toLowerCase()))
                                continue;
                            if (doi)
                                seenDois.add(doi.toLowerCase());
                            const year = r.published?.['date-parts']?.[0]?.[0] || null;
                            if (yearTo && year && year > yearTo)
                                continue;
                            papers.push({
                                title: r.title?.[0] || 'Untitled',
                                authors: r.author?.map(a => `${a.given || ''} ${a.family || ''}`.trim()).slice(0, 5) || [],
                                year,
                                journal: r['container-title']?.[0] || 'Unknown',
                                doi,
                                citations: r['is-referenced-by-count'] || 0,
                                source: 'CrossRef',
                            });
                        }
                    }
                })(),
            ]);
            // Sort by citation count descending
            papers.sort((a, b) => b.citations - a.citations);
            const results = papers.slice(0, limit);
            if (results.length === 0) {
                const errors = [];
                if (openAlexResult.status === 'rejected')
                    errors.push(`OpenAlex: ${openAlexResult.reason}`);
                if (crossRefResult.status === 'rejected')
                    errors.push(`CrossRef: ${crossRefResult.reason}`);
                return errors.length > 0
                    ? `**No results found.** API errors:\n${errors.join('\n')}`
                    : `**No results found** for "${query}". Try broader search terms.`;
            }
            const lines = [
                `# Literature Search Results`,
                `**Query**: "${query}"${yearFrom ? ` | From: ${yearFrom}` : ''}${yearTo ? ` | To: ${yearTo}` : ''}`,
                `**Results**: ${results.length} papers (deduplicated across OpenAlex + CrossRef)`,
                '',
            ];
            for (let i = 0; i < results.length; i++) {
                const p = results[i];
                lines.push(`### ${i + 1}. ${p.title}`, `- **Authors**: ${p.authors.length > 0 ? p.authors.join(', ') : 'Unknown'}${p.authors.length >= 5 ? ' et al.' : ''}`, `- **Year**: ${p.year || 'N/A'} | **Journal**: ${p.journal}`, `- **DOI**: ${p.doi ? `[${p.doi}](https://doi.org/${p.doi})` : 'N/A'}`, `- **Citations**: ${p.citations} | **Source**: ${p.source}`, '');
            }
            return lines.join('\n');
        },
    });
    // ── 4. Citation Graph ───────────────────────────────────────────────────
    registerTool({
        name: 'citation_graph',
        description: 'Map the citation network for a paper. Shows who cites it, what it cites, and identifies bridge papers. Uses Semantic Scholar API.',
        parameters: {
            paper_id: { type: 'string', description: 'DOI (e.g. 10.1234/...) or Semantic Scholar paper ID', required: true },
            depth: { type: 'number', description: 'Citation depth to explore (default: 1, max: 2)' },
        },
        tier: 'free',
        async execute(args) {
            const paperId = String(args.paper_id);
            const depth = Math.min(typeof args.depth === 'number' ? args.depth : 1, 2);
            const id = paperId.startsWith('10.') ? `DOI:${paperId}` : paperId;
            const baseUrl = 'https://api.semanticscholar.org/graph/v1';
            try {
                // Fetch paper details, citations, and references in parallel
                const [paperRes, citationsRes, referencesRes] = await Promise.allSettled([
                    labFetchJson(`${baseUrl}/paper/${encodeURIComponent(id)}?fields=title,year,authors,citationCount,referenceCount,venue,externalIds`),
                    labFetchJson(`${baseUrl}/paper/${encodeURIComponent(id)}/citations?fields=title,year,citationCount,authors,venue&limit=50`),
                    labFetchJson(`${baseUrl}/paper/${encodeURIComponent(id)}/references?fields=title,year,citationCount,authors,venue&limit=50`),
                ]);
                const lines = [];
                // Paper details
                if (paperRes.status === 'fulfilled') {
                    const p = paperRes.value;
                    lines.push(`# Citation Graph`, '', `## Source Paper`, `- **Title**: ${p.title || 'Unknown'}`, `- **Year**: ${p.year || 'N/A'}`, `- **Authors**: ${p.authors?.map(a => a.name).slice(0, 5).join(', ') || 'Unknown'}`, `- **Venue**: ${p.venue || 'N/A'}`, `- **DOI**: ${p.externalIds?.DOI || 'N/A'}`, `- **Total citations**: ${p.citationCount || 0}`, `- **Total references**: ${p.referenceCount || 0}`, '');
                }
                else {
                    return `**Error**: Could not find paper "${paperId}". Check the DOI or Semantic Scholar ID. Error: ${paperRes.reason}`;
                }
                // Citations (papers that cite this one)
                if (citationsRes.status === 'fulfilled') {
                    const data = citationsRes.value;
                    const citing = data.data || [];
                    lines.push(`## Citing Papers (${citing.length} shown)`);
                    if (citing.length === 0) {
                        lines.push('*No citing papers found.*', '');
                    }
                    else {
                        // Sort by citation count
                        const sorted = [...citing].sort((a, b) => (b.citingPaper.citationCount || 0) - (a.citingPaper.citationCount || 0));
                        for (const c of sorted.slice(0, 20)) {
                            const cp = c.citingPaper;
                            lines.push(`- **${cp.title || 'Untitled'}** (${cp.year || 'N/A'}) — ${cp.citationCount || 0} citations — ${cp.authors?.slice(0, 3).map(a => a.name).join(', ') || 'Unknown'}`);
                        }
                        if (sorted.length > 20)
                            lines.push(`- *...and ${sorted.length - 20} more*`);
                        lines.push('');
                        // Identify bridge papers (highly cited papers that cite this one — influential connectors)
                        const bridges = sorted.filter(c => (c.citingPaper.citationCount || 0) > 100).slice(0, 5);
                        if (bridges.length > 0) {
                            lines.push(`## Bridge Papers (highly cited papers that cite this one)`);
                            for (const b of bridges) {
                                lines.push(`- **${b.citingPaper.title}** (${b.citingPaper.year || 'N/A'}) — ${b.citingPaper.citationCount} citations`);
                            }
                            lines.push('');
                        }
                    }
                }
                // References (papers this one cites)
                if (referencesRes.status === 'fulfilled') {
                    const data = referencesRes.value;
                    const refs = data.data || [];
                    lines.push(`## References (${refs.length} shown)`);
                    if (refs.length === 0) {
                        lines.push('*No references found.*', '');
                    }
                    else {
                        const sorted = [...refs].sort((a, b) => (b.citedPaper.citationCount || 0) - (a.citedPaper.citationCount || 0));
                        for (const r of sorted.slice(0, 20)) {
                            const rp = r.citedPaper;
                            if (!rp.title)
                                continue;
                            lines.push(`- **${rp.title}** (${rp.year || 'N/A'}) — ${rp.citationCount || 0} citations — ${rp.authors?.slice(0, 3).map(a => a.name).join(', ') || 'Unknown'}`);
                        }
                        if (sorted.length > 20)
                            lines.push(`- *...and ${sorted.length - 20} more*`);
                        lines.push('');
                        // Key foundational papers (most-cited references)
                        const foundational = sorted.filter(r => r.citedPaper.title && (r.citedPaper.citationCount || 0) > 500).slice(0, 5);
                        if (foundational.length > 0) {
                            lines.push(`## Foundational Papers (most-cited references)`);
                            for (const f of foundational) {
                                lines.push(`- **${f.citedPaper.title}** (${f.citedPaper.year || 'N/A'}) — ${f.citedPaper.citationCount} citations`);
                            }
                            lines.push('');
                        }
                    }
                }
                // Depth 2: fetch citations-of-citations for the top 3 citing papers
                if (depth >= 2 && citationsRes.status === 'fulfilled') {
                    const data = citationsRes.value;
                    const topCiting = (data.data || [])
                        .filter(c => c.citingPaper.paperId)
                        .sort((a, b) => (b.citingPaper.citationCount || 0) - (a.citingPaper.citationCount || 0))
                        .slice(0, 3);
                    if (topCiting.length > 0) {
                        lines.push(`## Depth-2: Citations of Top Citing Papers`);
                        const d2Results = await Promise.allSettled(topCiting.map(c => labFetchJson(`${baseUrl}/paper/${c.citingPaper.paperId}/citations?fields=title,year,citationCount&limit=5`)));
                        for (let i = 0; i < topCiting.length; i++) {
                            lines.push(`\n### Citations of "${topCiting[i].citingPaper.title}"`);
                            const d2Res = d2Results[i];
                            if (d2Res.status === 'fulfilled') {
                                const d2 = d2Res.value;
                                for (const c of (d2.data || []).slice(0, 5)) {
                                    if (c.citingPaper.title) {
                                        lines.push(`- ${c.citingPaper.title} (${c.citingPaper.year || 'N/A'}) — ${c.citingPaper.citationCount || 0} citations`);
                                    }
                                }
                            }
                            else {
                                lines.push('- *Could not fetch depth-2 citations*');
                            }
                        }
                        lines.push('');
                    }
                }
                return lines.join('\n');
            }
            catch (err) {
                return `**Error**: Failed to fetch citation data. ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    // ── 5. Unit Convert ─────────────────────────────────────────────────────
    registerTool({
        name: 'unit_convert',
        description: 'Convert between scientific units across all domains: length, mass, time, energy, pressure, temperature, force, power, frequency, electric, magnetic, radiation, concentration, data, speed, density, volume, area, angle, and more. ~200+ conversion pairs.',
        parameters: {
            value: { type: 'number', description: 'Numeric value to convert', required: true },
            from_unit: { type: 'string', description: 'Source unit (e.g. km, eV, atm, C, m/s, kg/m3)', required: true },
            to_unit: { type: 'string', description: 'Target unit (e.g. mi, J, Pa, F, km/h, g/cm3)', required: true },
        },
        tier: 'free',
        async execute(args) {
            const value = Number(args.value);
            const fromUnit = String(args.from_unit).trim();
            const toUnit = String(args.to_unit).trim();
            if (isNaN(value))
                return '**Error**: Value must be a number.';
            // Check temperature first (special handling)
            const tempResult = convertTemperature(value, fromUnit, toUnit);
            if (tempResult !== null) {
                return [
                    `# Unit Conversion`,
                    '',
                    `**${value} ${fromUnit}** = **${tempResult.toPrecision(10)} ${toUnit}**`,
                    '',
                    `*Temperature conversion (non-linear)*`,
                ].join('\n');
            }
            // Look up units
            const from = UNITS[fromUnit];
            const to = UNITS[toUnit];
            if (!from)
                return `**Error**: Unknown unit "${fromUnit}". Use \`unit_convert\` with common abbreviations (m, kg, J, Pa, eV, atm, etc.).`;
            if (!to)
                return `**Error**: Unknown unit "${toUnit}". Use \`unit_convert\` with common abbreviations.`;
            if (from.dimension !== to.dimension)
                return `**Error**: Incompatible dimensions: "${fromUnit}" is ${from.dimension}, "${toUnit}" is ${to.dimension}.`;
            // Convert: value * from_factor / to_factor
            const result = value * from.factor / to.factor;
            // Format the result nicely
            const formatted = Math.abs(result) < 0.001 || Math.abs(result) > 1e9
                ? result.toExponential(10)
                : result.toPrecision(12);
            return [
                `# Unit Conversion`,
                '',
                `**${value} ${fromUnit}** = **${formatted} ${toUnit}**`,
                '',
                `| | Value | Unit | Dimension |`,
                `|---|---|---|---|`,
                `| From | ${value} | ${fromUnit} | ${from.dimension} |`,
                `| To | ${formatted} | ${toUnit} | ${to.dimension} |`,
                '',
                `*Conversion factor: 1 ${fromUnit} = ${(from.factor / to.factor).toExponential(6)} ${toUnit}*`,
            ].join('\n');
        },
    });
    // ── 6. Physical Constants ───────────────────────────────────────────────
    registerTool({
        name: 'physical_constants',
        description: 'Look up NIST CODATA physical constants with full precision, uncertainty, and units. Covers ~80 constants: speed of light, Planck, Boltzmann, Avogadro, electron mass, proton mass, gravitational, fine-structure, Rydberg, and more. Supports fuzzy name matching.',
        parameters: {
            name: { type: 'string', description: 'Name of the constant (e.g. "speed of light", "planck", "boltzmann", "avogadro", "electron mass")', required: true },
        },
        tier: 'free',
        async execute(args) {
            const query = String(args.name);
            const results = findConstant(query);
            if (results.length === 0) {
                // Show all available constants grouped
                const categories = {};
                for (const c of CONSTANTS) {
                    const cat = c.unit === '(dimensionless)' ? 'Dimensionless' :
                        /kg/.test(c.unit) ? 'Mass' :
                            /m\/s|m\^/.test(c.unit) ? 'Mechanical' :
                                /J|eV|W/.test(c.unit) ? 'Energy' :
                                    /C|A|V|F|S|H/.test(c.unit) ? 'Electromagnetic' :
                                        /K/.test(c.unit) ? 'Thermal' :
                                            /mol/.test(c.unit) ? 'Molar' :
                                                'Other';
                    if (!categories[cat])
                        categories[cat] = [];
                    categories[cat].push(c.name);
                }
                const lines = [`**No constant found matching "${query}".** Available constants:\n`];
                for (const [cat, names] of Object.entries(categories)) {
                    lines.push(`**${cat}**: ${names.join(', ')}`);
                }
                return lines.join('\n');
            }
            const lines = [`# Physical Constants\n`];
            for (const c of results) {
                const valueStr = c.value.toExponential(12);
                const uncStr = c.uncertainty === 0 ? 'exact (by definition)' : `\u00B1 ${c.uncertainty.toExponential(4)}`;
                lines.push(`## ${c.name}`, `- **Symbol**: ${c.symbol}`, `- **Value**: ${valueStr}`, `- **Uncertainty**: ${uncStr}`, `- **Unit**: ${c.unit}`, `- **Relative uncertainty**: ${c.uncertainty === 0 ? 'exact' : (c.uncertainty / Math.abs(c.value)).toExponential(4)}`, '');
            }
            return lines.join('\n');
        },
    });
    // ── 7. Formula Solve ────────────────────────────────────────────────────
    registerTool({
        name: 'formula_solve',
        description: 'Solve or rearrange common scientific formulas. Covers ~50 formulas: PV=nRT, E=mc2, F=ma, V=IR, Coulomb, kinetic energy, Schwarzschild radius, Arrhenius, Nernst, Bernoulli, and many more. Given known values, solves for the unknown variable.',
        parameters: {
            formula: { type: 'string', description: 'Formula name or expression (e.g. "ideal gas", "E=mc2", "ohm", "coulomb", "arrhenius")', required: true },
            solve_for: { type: 'string', description: 'Variable to solve for (e.g. "P", "m", "V", "T")', required: true },
            known_values: { type: 'string', description: 'JSON object of known values, e.g. {"n": 1, "T": 300, "V": 0.0224}', required: true },
        },
        tier: 'free',
        async execute(args) {
            const formulaQuery = String(args.formula);
            const solveFor = String(args.solve_for);
            let knownValues;
            try {
                knownValues = JSON.parse(String(args.known_values));
            }
            catch {
                return '**Error**: known_values must be valid JSON. Example: `{"n": 1, "T": 300, "V": 0.0224}`';
            }
            const formula = findFormula(formulaQuery);
            if (!formula) {
                const available = FORMULAS.map(f => `- **${f.name}**: ${f.expression} (aliases: ${f.aliases.join(', ')})`).join('\n');
                return `**Formula not found**: "${formulaQuery}"\n\n## Available Formulas\n${available}`;
            }
            if (!(solveFor in formula.variables)) {
                return `**Error**: Variable "${solveFor}" not found in ${formula.name}.\nAvailable variables: ${Object.entries(formula.variables).map(([k, v]) => `\`${k}\` (${v})`).join(', ')}`;
            }
            try {
                const result = formula.solve(solveFor, knownValues);
                if (result === null || isNaN(result) || !isFinite(result)) {
                    return `**Error**: Could not solve for "${solveFor}" with the given values. Check that all required variables are provided and values are valid.\n\nRequired variables: ${Object.entries(formula.variables).filter(([k]) => k !== solveFor).map(([k, v]) => `\`${k}\` (${v})`).join(', ')}`;
                }
                const formatted = Math.abs(result) < 0.001 || Math.abs(result) > 1e6
                    ? result.toExponential(8)
                    : result.toPrecision(10);
                return [
                    `# Formula Solution`,
                    '',
                    `## ${formula.name}`,
                    `**Expression**: ${formula.expression}`,
                    '',
                    `## Known Values`,
                    ...Object.entries(knownValues).map(([k, v]) => `- **${k}** = ${v}${formula.variables[k] ? ` (${formula.variables[k]})` : ''}`),
                    '',
                    `## Result`,
                    `**${solveFor}** = **${formatted}**`,
                    formula.variables[solveFor] ? `*(${formula.variables[solveFor]})*` : '',
                    '',
                    `## Verification`,
                    `Substituting back: ${Object.entries(knownValues).map(([k, v]) => `${k}=${v}`).join(', ')}, ${solveFor}=${formatted}`,
                ].join('\n');
            }
            catch (err) {
                return `**Error**: Calculation failed. ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    // ── 8. Research Methodology ─────────────────────────────────────────────
    registerTool({
        name: 'research_methodology',
        description: 'Generate detailed methodology sections for academic papers. Supports study types: experimental, survey, case-study, meta-analysis, cohort, ethnographic. Includes sampling strategy, data collection, analysis pipeline, and ethical considerations.',
        parameters: {
            study_type: { type: 'string', description: 'Study type: experimental, survey, case-study, meta-analysis, cohort, ethnographic', required: true },
            field: { type: 'string', description: 'Research field (e.g. psychology, medicine, computer science, education)', required: true },
            sample_description: { type: 'string', description: 'Description of target population/sample (e.g. "adults aged 18-65 with type 2 diabetes")', required: true },
        },
        tier: 'free',
        async execute(args) {
            const studyType = String(args.study_type).toLowerCase().trim();
            const field = String(args.field);
            const sample = String(args.sample_description);
            const methodologies = {
                experimental: {
                    title: 'Experimental Study Methodology',
                    design: `A randomized experimental design will be employed to establish causal relationships. Participants (${sample}) will be randomly assigned to treatment and control conditions. The study will use a pre-test/post-test control group design with blinding where feasible.`,
                    sampling: `**Probability sampling** will be used to recruit from the target population (${sample}). Inclusion and exclusion criteria will be defined a priori. Sample size will be determined via power analysis (\u03B1=0.05, power=0.80, estimated effect size from pilot data or prior literature). Stratified randomization will balance key confounders across conditions.`,
                    dataCollection: [
                        'Pre-registration of hypotheses, methods, and analysis plan (OSF/ClinicalTrials.gov)',
                        'Baseline assessment of all outcome and covariate measures',
                        'Random assignment to conditions using computer-generated sequence',
                        'Standardized intervention protocol with fidelity monitoring',
                        'Post-intervention outcome measurement (blinded assessors where possible)',
                        'Follow-up assessment at predetermined intervals',
                        'Adverse event monitoring and documentation',
                    ],
                    analysisSteps: [
                        'Descriptive statistics and assumption checking (normality, homogeneity of variance)',
                        'Intention-to-treat (ITT) analysis as primary; per-protocol as sensitivity analysis',
                        'Primary analysis: ANCOVA with baseline as covariate, or mixed-effects model for repeated measures',
                        'Effect sizes with 95% confidence intervals (Cohen\'s d, partial \u03B7\u00B2)',
                        'Multiple comparison correction (Bonferroni/Holm) if >1 primary outcome',
                        'Sensitivity analyses: missing data handling (multiple imputation), subgroup analyses (pre-specified)',
                        'Mediation/moderation analyses if theoretically justified',
                    ],
                    validityThreats: ['Selection bias (mitigated by randomization)', 'Attrition (monitor and analyze dropouts)', 'Hawthorne effect', 'Demand characteristics', 'Experimenter bias (mitigated by blinding)'],
                    ethicalConsiderations: ['IRB/Ethics board approval required', 'Written informed consent', 'Right to withdraw without penalty', 'Data anonymization and secure storage', 'Equipoise requirement', 'DSMB for interim safety monitoring'],
                    reportingGuideline: 'CONSORT (Consolidated Standards of Reporting Trials)',
                },
                survey: {
                    title: 'Survey Study Methodology',
                    design: `A cross-sectional survey design will be used to assess attitudes, behaviors, and characteristics of the target population (${sample}). The survey instrument will be developed through iterative pilot testing and validated using established psychometric methods.`,
                    sampling: `**Stratified random sampling** from accessible population (${sample}). Sampling frame will be defined from institutional records, registries, or databases. Target response rate: 60%+ (with non-response bias analysis). Over-sampling of underrepresented subgroups if needed.`,
                    dataCollection: [
                        'Literature review to identify existing validated instruments',
                        'Item generation and expert review (content validity)',
                        'Cognitive interviewing/think-aloud protocols (face validity)',
                        'Pilot study (n=30-50) for item analysis and reliability estimation',
                        'Final instrument: demographics, validated scales, open-ended items',
                        'Distribution via online platform (Qualtrics/REDCap) with unique links',
                        'Reminders at 1 week and 2 weeks post-distribution',
                        'Data quality checks: attention checks, completion time, straightlining detection',
                    ],
                    analysisSteps: [
                        'Response rate calculation and non-response bias analysis',
                        'Data cleaning: remove incomplete (<50%) and low-quality responses',
                        'Confirmatory factor analysis (CFA) to validate scale structure',
                        'Internal consistency: Cronbach\'s alpha (\u03B1 > 0.70 acceptable)',
                        'Descriptive statistics stratified by key demographics',
                        'Inferential statistics: regression, SEM, or multilevel modeling as appropriate',
                        'Open-ended responses: thematic analysis (Braun & Clarke framework)',
                    ],
                    validityThreats: ['Non-response bias', 'Social desirability bias', 'Common method variance', 'Self-selection bias', 'Recall bias'],
                    ethicalConsiderations: ['IRB/Ethics approval', 'Informed consent on first page', 'Anonymity/confidentiality guarantees', 'No deceptive items', 'Data stored on encrypted servers', 'Compliance with GDPR/local data protection laws'],
                    reportingGuideline: 'CHERRIES (Checklist for Reporting Results of Internet E-Surveys)',
                },
                'case-study': {
                    title: 'Case Study Methodology',
                    design: `An instrumental case study design (Stake, 1995) will be employed to provide in-depth understanding of the phenomenon within its real-world context. The case (${sample}) was selected purposively for its potential to illuminate theoretical constructs.`,
                    sampling: `**Purposive sampling** — case selected for theoretical relevance, not statistical representativeness. Selection criteria: (1) information-rich case, (2) accessible for extended observation, (3) representative of the phenomenon. Multiple cases may be included for cross-case analysis (Yin, 2018).`,
                    dataCollection: [
                        'Document analysis: archival records, reports, meeting minutes, correspondence',
                        'Semi-structured interviews with key stakeholders (audio-recorded, transcribed)',
                        'Direct observation with field notes (structured observation protocol)',
                        'Participant observation where appropriate (reflexive journaling)',
                        'Physical artifacts and digital data sources',
                        'Triangulation across multiple data sources for each finding',
                    ],
                    analysisSteps: [
                        'Within-case analysis: chronological narrative construction',
                        'Open coding of interview transcripts and field notes',
                        'Axial coding: identifying relationships between categories',
                        'Pattern matching: comparing empirical patterns to theoretical predictions',
                        'Explanation building: iterative refinement of causal mechanisms',
                        'Cross-case synthesis (if multiple cases)',
                        'Member checking: participants review interpretations for accuracy',
                    ],
                    validityThreats: ['Researcher bias', 'Limited generalizability', 'Selective reporting', 'Reactivity/observer effect'],
                    ethicalConsiderations: ['IRB/Ethics approval', 'Informed consent for all participants', 'Anonymization of identifying details', 'Secure storage of recordings/transcripts', 'Right to review and retract statements', 'Power dynamics awareness (researcher-participant relationship)'],
                    reportingGuideline: 'CARE (Case Reports) or Yin\'s case study reporting standards',
                },
                'meta-analysis': {
                    title: 'Meta-Analysis Methodology',
                    design: `A systematic review and meta-analysis will be conducted following PRISMA 2020 guidelines to synthesize quantitative evidence on the research question. The protocol will be pre-registered on PROSPERO.`,
                    sampling: `**Systematic literature search** across multiple databases: PubMed/MEDLINE, PsycINFO, Scopus, Web of Science, and Cochrane Library. Grey literature: ProQuest Dissertations, conference proceedings, pre-print servers. Inclusion criteria defined using PICOS framework. No language restrictions. Search strategy developed with medical librarian.`,
                    dataCollection: [
                        'Develop and pilot search strategy with Boolean operators and MeSH terms',
                        'Run searches across all databases; deduplicate using Covidence/Rayyan',
                        'Title/abstract screening by 2 independent reviewers (kappa > 0.80)',
                        'Full-text screening with documented exclusion reasons',
                        'Data extraction using standardized form (piloted on 5 studies)',
                        'Risk of bias assessment: Cochrane RoB 2 (RCTs) or Newcastle-Ottawa Scale (observational)',
                        'GRADE assessment of certainty of evidence',
                        'Contact original authors for missing data where needed',
                    ],
                    analysisSteps: [
                        'Calculate standardized effect sizes (SMD, OR, RR, HR) from each study',
                        'Random-effects meta-analysis (DerSimonian-Laird or REML estimator)',
                        'Heterogeneity assessment: Q-statistic, I\u00B2 (>75% = substantial), \u03C4\u00B2',
                        'Forest plot visualization',
                        'Subgroup analyses (pre-specified): by study design, population, intervention characteristics',
                        'Meta-regression for continuous moderators',
                        'Sensitivity analyses: leave-one-out, trim-and-fill, influence diagnostics',
                        'Publication bias: funnel plot, Egger\'s test, p-curve analysis',
                    ],
                    validityThreats: ['Publication bias', 'Heterogeneity', 'Garbage in/garbage out (low-quality studies)', 'Language bias', 'Time-lag bias', 'Ecological fallacy'],
                    ethicalConsiderations: ['Protocol pre-registration (PROSPERO)', 'Transparent reporting of all search decisions', 'No selective outcome reporting', 'Declare conflicts of interest', 'Open data/code for reproducibility'],
                    reportingGuideline: 'PRISMA 2020 (Preferred Reporting Items for Systematic Reviews and Meta-Analyses)',
                },
                cohort: {
                    title: 'Cohort Study Methodology',
                    design: `A prospective cohort study will follow a defined group (${sample}) over time to assess the relationship between exposure and outcome. Participants will be classified by exposure status at baseline and followed for the development of outcomes.`,
                    sampling: `**Consecutive or population-based sampling** of ${sample}. Cohort defined by shared characteristic or exposure. Comparison group: unexposed individuals from the same source population. Sample size calculated based on expected incidence rates, desired HR precision, and anticipated attrition. Over-recruit by 20-30% for dropout.`,
                    dataCollection: [
                        'Baseline assessment: exposure measurement, covariates, outcome-free confirmation',
                        'Standardized data collection instruments (validated questionnaires, clinical measures)',
                        'Regular follow-up at predetermined intervals (annual, biannual)',
                        'Ascertainment of outcomes through clinical records, registries, or biomarkers',
                        'Loss-to-follow-up tracking with documented reasons',
                        'Biospecimen banking (if applicable) with informed consent',
                    ],
                    analysisSteps: [
                        'Describe cohort characteristics: exposed vs. unexposed comparison',
                        'Attrition analysis: compare completers vs. dropouts',
                        'Incidence rates and cumulative incidence curves',
                        'Cox proportional hazards regression (check PH assumption via Schoenfeld residuals)',
                        'Confounding control: multivariable adjustment, propensity scores, or IPW',
                        'Time-varying exposure analysis if relevant',
                        'Competing risks analysis (Fine-Gray model) if applicable',
                        'Sensitivity analyses for unmeasured confounding (E-value)',
                    ],
                    validityThreats: ['Confounding (known and unknown)', 'Loss to follow-up (selection bias)', 'Information bias (exposure misclassification)', 'Healthy worker/volunteer effect', 'Reverse causation (if exposure timing unclear)'],
                    ethicalConsiderations: ['Long-term participant commitment', 'Ongoing consent for continued participation', 'Incidental findings protocol', 'Data security across extended study period', 'Community engagement and results dissemination'],
                    reportingGuideline: 'STROBE (Strengthening the Reporting of Observational Studies in Epidemiology)',
                },
                ethnographic: {
                    title: 'Ethnographic Study Methodology',
                    design: `An ethnographic approach will be used to understand the cultural practices, social dynamics, and lived experiences of ${sample}. Extended immersion in the field setting will enable thick description (Geertz, 1973) and emic understanding.`,
                    sampling: `**Purposive and snowball sampling** within the cultural setting. Key informants identified through initial contacts and theoretical sampling. Sampling continues until theoretical saturation is reached. Setting selected for its potential to reveal cultural patterns relevant to the research question.`,
                    dataCollection: [
                        'Extended participant observation (minimum 3-6 months in field)',
                        'Detailed field notes: descriptive, reflective, and analytic memos',
                        'In-depth interviews: unstructured and semi-structured (key informants)',
                        'Focus groups with community members',
                        'Document and artifact collection (photographs, social media, texts)',
                        'Reflexive journal: researcher positionality and evolving interpretations',
                        'Life histories or narrative interviews for depth',
                    ],
                    analysisSteps: [
                        'Concurrent data collection and analysis (iterative cycle)',
                        'Open coding of field notes and transcripts',
                        'Domain analysis: identifying cultural categories',
                        'Taxonomic analysis: internal structure of domains',
                        'Componential analysis: attributes that distinguish members of domains',
                        'Theme identification: cross-cutting cultural themes',
                        'Narrative construction: thick description with analytic commentary',
                        'Member checking and peer debriefing for credibility',
                    ],
                    validityThreats: ['Going native (over-identification)', 'Reactivity/observer effect', 'Researcher bias', 'Cultural misinterpretation', 'Power dynamics', 'Selective attention and recall'],
                    ethicalConsiderations: ['Community-level and individual informed consent', 'Anonymization and pseudonyms', 'Power dynamics awareness', 'Cultural sensitivity and reciprocity', 'Protection of vulnerable populations', 'Community review of findings before publication', 'IRB/Ethics board with qualitative expertise'],
                    reportingGuideline: 'COREQ (Consolidated Criteria for Reporting Qualitative Research)',
                },
            };
            const meth = methodologies[studyType];
            if (!meth) {
                return `**Error**: Unknown study type "${studyType}". Supported: ${Object.keys(methodologies).join(', ')}`;
            }
            return [
                `# ${meth.title}`,
                `**Field**: ${field} | **Sample**: ${sample}`,
                '',
                `## Research Design`,
                meth.design,
                '',
                `## Sampling Strategy`,
                meth.sampling,
                '',
                `## Data Collection Procedures`,
                ...meth.dataCollection.map((s, i) => `${i + 1}. ${s}`),
                '',
                `## Data Analysis Pipeline`,
                ...meth.analysisSteps.map((s, i) => `${i + 1}. ${s}`),
                '',
                `## Threats to Validity`,
                ...meth.validityThreats.map(t => `- ${t}`),
                '',
                `## Ethical Considerations`,
                ...meth.ethicalConsiderations.map(e => `- ${e}`),
                '',
                `## Reporting Guideline`,
                `Follow **${meth.reportingGuideline}** for transparent reporting.`,
                '',
                `## Quality Criteria`,
                studyType === 'ethnographic' || studyType === 'case-study'
                    ? '- Credibility (prolonged engagement, triangulation, member checking)\n- Transferability (thick description)\n- Dependability (audit trail)\n- Confirmability (reflexivity)'
                    : '- Internal validity (causal inference strength)\n- External validity (generalizability)\n- Construct validity (measurement quality)\n- Reliability (reproducibility)',
            ].join('\n');
        },
    });
    // ── 9. Preprint Tracker ─────────────────────────────────────────────────
    registerTool({
        name: 'preprint_tracker',
        description: 'Track recent preprints from arXiv, bioRxiv, and medRxiv in a specific field. Returns title, authors, date, abstract snippet, and link.',
        parameters: {
            field: { type: 'string', description: 'Research field or topic (e.g. "machine learning", "CRISPR", "COVID-19 vaccines", "quantum computing")', required: true },
            days_back: { type: 'number', description: 'How many days back to search (default: 7)' },
            limit: { type: 'number', description: 'Maximum number of results (default: 10)' },
        },
        tier: 'free',
        async execute(args) {
            const field = String(args.field);
            const daysBack = typeof args.days_back === 'number' ? args.days_back : 7;
            const limit = typeof args.limit === 'number' ? Math.min(args.limit, 30) : 10;
            const preprints = [];
            // Calculate date range
            const now = new Date();
            const fromDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
            const fromStr = fromDate.toISOString().split('T')[0];
            const toStr = now.toISOString().split('T')[0];
            // Fetch from all three sources in parallel
            const [arxivResult, biorxivResult, medrxivResult] = await Promise.allSettled([
                // arXiv API (returns Atom XML)
                (async () => {
                    const encoded = encodeURIComponent(field);
                    const url = `http://export.arxiv.org/api/query?search_query=all:${encoded}&sortBy=submittedDate&sortOrder=descending&max_results=${limit}`;
                    const res = await labFetch(url);
                    const text = await res.text();
                    // Parse XML manually (no DOM parser in Node without dependencies)
                    const entries = text.split('<entry>').slice(1);
                    for (const entry of entries) {
                        const extract = (tag) => {
                            const match = entry.match(new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 's'));
                            return match ? match[1].trim() : '';
                        };
                        const title = extract('title').replace(/\s+/g, ' ');
                        const summary = extract('summary').replace(/\s+/g, ' ');
                        const published = extract('published');
                        const category = entry.match(/term="([^"]+)"/)?.[1] || '';
                        // Extract authors
                        const authorMatches = entry.matchAll(/<name>([^<]+)<\/name>/g);
                        const authors = Array.from(authorMatches).map(m => m[1]);
                        // Extract link
                        const linkMatch = entry.match(/href="(https:\/\/arxiv\.org\/abs\/[^"]+)"/);
                        const url = linkMatch ? linkMatch[1] : '';
                        if (title && published) {
                            const pubDate = published.split('T')[0];
                            if (pubDate >= fromStr) {
                                preprints.push({
                                    title, authors: authors.slice(0, 5), date: pubDate,
                                    abstract: summary.slice(0, 200) + (summary.length > 200 ? '...' : ''),
                                    url, source: 'arXiv', category,
                                });
                            }
                        }
                    }
                })(),
                // bioRxiv API
                (async () => {
                    const url = `https://api.biorxiv.org/details/biorxiv/${fromStr}/${toStr}/0/25`;
                    const data = await labFetchJson(url);
                    if (data.collection) {
                        for (const p of data.collection) {
                            const title = p.title || '';
                            if (title.toLowerCase().includes(field.toLowerCase()) ||
                                (p.abstract || '').toLowerCase().includes(field.toLowerCase()) ||
                                (p.category || '').toLowerCase().includes(field.toLowerCase())) {
                                preprints.push({
                                    title,
                                    authors: (p.authors || '').split(';').map(a => a.trim()).filter(Boolean).slice(0, 5),
                                    date: p.date || '',
                                    abstract: (p.abstract || '').slice(0, 200) + ((p.abstract || '').length > 200 ? '...' : ''),
                                    url: p.doi ? `https://doi.org/${p.doi}` : '',
                                    source: 'bioRxiv',
                                    category: p.category,
                                });
                            }
                        }
                    }
                })(),
                // medRxiv API
                (async () => {
                    const url = `https://api.biorxiv.org/details/medrxiv/${fromStr}/${toStr}/0/25`;
                    const data = await labFetchJson(url);
                    if (data.collection) {
                        for (const p of data.collection) {
                            const title = p.title || '';
                            if (title.toLowerCase().includes(field.toLowerCase()) ||
                                (p.abstract || '').toLowerCase().includes(field.toLowerCase()) ||
                                (p.category || '').toLowerCase().includes(field.toLowerCase())) {
                                preprints.push({
                                    title,
                                    authors: (p.authors || '').split(';').map(a => a.trim()).filter(Boolean).slice(0, 5),
                                    date: p.date || '',
                                    abstract: (p.abstract || '').slice(0, 200) + ((p.abstract || '').length > 200 ? '...' : ''),
                                    url: p.doi ? `https://doi.org/${p.doi}` : '',
                                    source: 'medRxiv',
                                    category: p.category,
                                });
                            }
                        }
                    }
                })(),
            ]);
            // Sort by date descending
            preprints.sort((a, b) => b.date.localeCompare(a.date));
            const results = preprints.slice(0, limit);
            if (results.length === 0) {
                const errors = [];
                if (arxivResult.status === 'rejected')
                    errors.push(`arXiv: ${arxivResult.reason}`);
                if (biorxivResult.status === 'rejected')
                    errors.push(`bioRxiv: ${biorxivResult.reason}`);
                if (medrxivResult.status === 'rejected')
                    errors.push(`medRxiv: ${medrxivResult.reason}`);
                return errors.length > 0
                    ? `**No preprints found** for "${field}" in the last ${daysBack} days.\n\nAPI errors:\n${errors.join('\n')}`
                    : `**No preprints found** for "${field}" in the last ${daysBack} days. Try broader terms or a longer time window.`;
            }
            // Count by source
            const sourceCounts = {};
            for (const p of results)
                sourceCounts[p.source] = (sourceCounts[p.source] || 0) + 1;
            const lines = [
                `# Recent Preprints: "${field}"`,
                `**Period**: ${fromStr} to ${toStr} (${daysBack} days)`,
                `**Results**: ${results.length} preprints (${Object.entries(sourceCounts).map(([k, v]) => `${k}: ${v}`).join(', ')})`,
                '',
            ];
            for (let i = 0; i < results.length; i++) {
                const p = results[i];
                lines.push(`### ${i + 1}. ${p.title}`, `- **Authors**: ${p.authors.join(', ')}${p.authors.length >= 5 ? ' et al.' : ''}`, `- **Date**: ${p.date} | **Source**: ${p.source}${p.category ? ` | **Category**: ${p.category}` : ''}`, p.url ? `- **Link**: ${p.url}` : '', p.abstract ? `- **Abstract**: ${p.abstract}` : '', '');
            }
            return lines.filter(l => l !== undefined).join('\n');
        },
    });
    // ── 10. Open Access Find ────────────────────────────────────────────────
    registerTool({
        name: 'open_access_find',
        description: 'Find free full-text versions of academic papers via Unpaywall and CORE APIs. Provide a DOI or title to discover open access copies, green/gold OA status, and download links.',
        parameters: {
            identifier: { type: 'string', description: 'DOI (e.g. "10.1038/nature12373") or paper title', required: true },
            type: { type: 'string', description: 'Identifier type: "doi" or "title"', required: true },
        },
        tier: 'free',
        async execute(args) {
            const identifier = String(args.identifier).trim();
            const type = String(args.type).toLowerCase().trim();
            if (type !== 'doi' && type !== 'title') {
                return '**Error**: Type must be "doi" or "title".';
            }
            const results = [];
            if (type === 'doi') {
                // Fetch from Unpaywall and CORE in parallel
                const [unpaywall, core] = await Promise.allSettled([
                    // Unpaywall
                    (async () => {
                        const url = `https://api.unpaywall.org/v2/${encodeURIComponent(identifier)}?email=kbot@kernel.chat`;
                        const data = await labFetchJson(url);
                        const otherLocs = [];
                        if (data.oa_locations) {
                            for (const loc of data.oa_locations.slice(0, 5)) {
                                if (loc.url) {
                                    otherLocs.push({
                                        url: loc.url,
                                        type: `${loc.host_type || 'unknown'} (${loc.version || 'unknown'})`,
                                        source: 'Unpaywall',
                                    });
                                }
                            }
                        }
                        results.push({
                            title: data.title || 'Unknown',
                            doi: data.doi || identifier,
                            isOA: data.is_oa || false,
                            oaStatus: data.oa_status || 'closed',
                            bestUrl: data.best_oa_location?.url || '',
                            pdfUrl: data.best_oa_location?.url_for_pdf || '',
                            license: data.best_oa_location?.license || 'Unknown',
                            source: 'Unpaywall',
                            otherLocations: otherLocs,
                        });
                    })(),
                    // CORE
                    (async () => {
                        const url = `https://api.core.ac.uk/v3/search/works?q=doi:"${encodeURIComponent(identifier)}"&limit=3`;
                        const data = await labFetchJson(url);
                        if (data.results) {
                            for (const r of data.results) {
                                results.push({
                                    title: r.title || 'Unknown',
                                    doi: r.doi || identifier,
                                    isOA: !!(r.downloadUrl || r.sourceFulltextUrls?.length),
                                    oaStatus: r.downloadUrl ? 'available' : 'unknown',
                                    bestUrl: r.downloadUrl || r.sourceFulltextUrls?.[0] || '',
                                    pdfUrl: r.downloadUrl || '',
                                    license: 'Check source',
                                    source: 'CORE',
                                    otherLocations: (r.sourceFulltextUrls || []).slice(0, 3).map(u => ({ url: u, type: 'repository', source: 'CORE' })),
                                });
                            }
                        }
                    })(),
                ]);
                if (results.length === 0) {
                    const errors = [];
                    if (unpaywall.status === 'rejected')
                        errors.push(`Unpaywall: ${unpaywall.reason}`);
                    if (core.status === 'rejected')
                        errors.push(`CORE: ${core.reason}`);
                    return `**No open access version found** for DOI: ${identifier}\n\n${errors.length ? 'API errors:\n' + errors.join('\n') : 'The paper may not have an open access version available.'}`;
                }
            }
            else {
                // Title search via CORE
                try {
                    const url = `https://api.core.ac.uk/v3/search/works?q=${encodeURIComponent(identifier)}&limit=5`;
                    const data = await labFetchJson(url);
                    if (data.results) {
                        for (const r of data.results) {
                            results.push({
                                title: r.title || 'Unknown',
                                doi: r.doi || '',
                                isOA: !!(r.downloadUrl || r.sourceFulltextUrls?.length),
                                oaStatus: r.downloadUrl ? 'available' : 'unknown',
                                bestUrl: r.downloadUrl || r.sourceFulltextUrls?.[0] || '',
                                pdfUrl: r.downloadUrl || '',
                                license: 'Check source',
                                source: 'CORE',
                                otherLocations: (r.sourceFulltextUrls || []).slice(0, 3).map(u => ({ url: u, type: 'repository', source: 'CORE' })),
                            });
                        }
                    }
                }
                catch (err) {
                    return `**Error searching by title**: ${err instanceof Error ? err.message : String(err)}`;
                }
                if (results.length === 0) {
                    return `**No open access versions found** for title: "${identifier}". Try searching by DOI for more precise results.`;
                }
            }
            const lines = [
                `# Open Access Finder`,
                `**Query**: ${type === 'doi' ? `DOI: ${identifier}` : `Title: "${identifier}"`}`,
                '',
            ];
            // Deduplicate by DOI
            const seen = new Set();
            const unique = results.filter(r => {
                const key = r.doi || r.title;
                if (seen.has(key))
                    return false;
                seen.add(key);
                return true;
            });
            for (const r of unique) {
                const statusEmoji = r.isOA ? 'OPEN' : 'CLOSED';
                lines.push(`## ${r.title}`, `- **DOI**: ${r.doi ? `[${r.doi}](https://doi.org/${r.doi})` : 'N/A'}`, `- **OA Status**: **${statusEmoji}** (${r.oaStatus})`, `- **License**: ${r.license}`, `- **Source**: ${r.source}`);
                if (r.bestUrl)
                    lines.push(`- **Best OA Link**: ${r.bestUrl}`);
                if (r.pdfUrl && r.pdfUrl !== r.bestUrl)
                    lines.push(`- **PDF**: ${r.pdfUrl}`);
                if (r.otherLocations.length > 0) {
                    lines.push(`- **Other locations**:`);
                    for (const loc of r.otherLocations) {
                        lines.push(`  - ${loc.url} (${loc.type})`);
                    }
                }
                lines.push('');
            }
            if (!unique.some(r => r.isOA)) {
                lines.push(`---`, `**No open access version found.** Alternatives:`, `- Request from the author directly (ResearchGate, email)`, `- Check your institutional library access`, `- Search Google Scholar for cached/preprint versions`, `- Try interlibrary loan (ILL) through your library`);
            }
            return lines.join('\n');
        },
    });
}
//# sourceMappingURL=lab-core.js.map