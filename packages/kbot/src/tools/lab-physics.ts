// kbot Physics & Engineering Tools — Lab-grade calculations
// Pure TypeScript implementations, zero external dependencies.
// Covers orbital mechanics, circuits, signal processing, particle physics,
// relativity, quantum computing, beam analysis, fluid dynamics, EM, and astronomy.

import { registerTool } from './index.js'

// ─── Constants ───────────────────────────────────────────────────────────────

const G = 6.67430e-11        // Gravitational constant (m^3 kg^-1 s^-2)
const c = 299_792_458        // Speed of light (m/s)
const h = 6.62607015e-34     // Planck constant (J*s)
const hbar = h / (2 * Math.PI)
const k_B = 1.380649e-23     // Boltzmann constant (J/K)
const e_charge = 1.602176634e-19  // Elementary charge (C)
const mu_0 = 1.25663706212e-6    // Vacuum permeability (H/m)
const epsilon_0 = 8.8541878128e-12 // Vacuum permittivity (F/m)
const eV = 1.602176634e-19   // 1 eV in joules
const MeV = eV * 1e6
const GeV = eV * 1e9
const AU = 1.496e11           // Astronomical unit (m)
const SOLAR_MASS = 1.989e30   // kg

const USER_AGENT = 'KBot/3.0 (Lab Tools)'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, digits = 6): string {
  if (n === 0) return '0'
  const abs = Math.abs(n)
  if (abs >= 1e6 || abs < 1e-3) return n.toExponential(digits)
  return n.toPrecision(digits)
}

function fmtUnit(n: number, unit: string, digits = 4): string {
  return `${fmt(n, digits)} ${unit}`
}

// ─── Solar System Data ───────────────────────────────────────────────────────

interface CelestialBody {
  mass: number          // kg
  radius: number        // m
  semiMajorAxis?: number // m (orbit around parent)
  orbitalPeriod?: number // s
  parent?: string
}

const BODIES: Record<string, CelestialBody> = {
  sun:     { mass: 1.989e30, radius: 6.9634e8 },
  mercury: { mass: 3.3011e23, radius: 2.4397e6, semiMajorAxis: 5.791e10, orbitalPeriod: 7.6005e6, parent: 'sun' },
  venus:   { mass: 4.8675e24, radius: 6.0518e6, semiMajorAxis: 1.0821e11, orbitalPeriod: 1.9414e7, parent: 'sun' },
  earth:   { mass: 5.9722e24, radius: 6.371e6, semiMajorAxis: 1.496e11, orbitalPeriod: 3.1557e7, parent: 'sun' },
  moon:    { mass: 7.342e22, radius: 1.7374e6, semiMajorAxis: 3.844e8, orbitalPeriod: 2.3606e6, parent: 'earth' },
  mars:    { mass: 6.4171e23, radius: 3.3895e6, semiMajorAxis: 2.2794e11, orbitalPeriod: 5.9355e7, parent: 'sun' },
  jupiter: { mass: 1.8982e27, radius: 6.9911e7, semiMajorAxis: 7.7857e11, orbitalPeriod: 3.7435e8, parent: 'sun' },
  saturn:  { mass: 5.6834e26, radius: 5.8232e7, semiMajorAxis: 1.4335e12, orbitalPeriod: 9.2956e8, parent: 'sun' },
  uranus:  { mass: 8.6810e25, radius: 2.5362e7, semiMajorAxis: 2.8725e12, orbitalPeriod: 2.6512e9, parent: 'sun' },
  neptune: { mass: 1.0241e26, radius: 2.4622e7, semiMajorAxis: 4.4951e12, orbitalPeriod: 5.2003e9, parent: 'sun' },
  pluto:   { mass: 1.303e22, radius: 1.1883e6, semiMajorAxis: 5.9064e12, orbitalPeriod: 7.8241e9, parent: 'sun' },
}

// ─── Particle Physics Data (PDG 2024) ────────────────────────────────────────

interface Particle {
  name: string
  symbol: string
  category: string
  mass_MeV: number | null   // null = massless
  charge: number             // in units of e
  spin: string
  lifetime_s: number | null  // null = stable, Infinity = stable
  decay_modes?: string[]
  quark_content?: string
  color_charge?: string
  isAntiparticle?: boolean
}

const PARTICLES: Record<string, Particle> = {
  // ── Leptons ──
  electron:          { name: 'Electron', symbol: 'e\u207b', category: 'Lepton', mass_MeV: 0.51100, charge: -1, spin: '1/2', lifetime_s: Infinity },
  positron:          { name: 'Positron', symbol: 'e\u207a', category: 'Lepton', mass_MeV: 0.51100, charge: 1, spin: '1/2', lifetime_s: Infinity, isAntiparticle: true },
  muon:              { name: 'Muon', symbol: '\u03bc\u207b', category: 'Lepton', mass_MeV: 105.658, charge: -1, spin: '1/2', lifetime_s: 2.197e-6, decay_modes: ['e\u207b + \u03bd\u0305_e + \u03bd_\u03bc (100%)'] },
  antimuon:          { name: 'Antimuon', symbol: '\u03bc\u207a', category: 'Lepton', mass_MeV: 105.658, charge: 1, spin: '1/2', lifetime_s: 2.197e-6, isAntiparticle: true },
  tau:               { name: 'Tau', symbol: '\u03c4\u207b', category: 'Lepton', mass_MeV: 1776.86, charge: -1, spin: '1/2', lifetime_s: 2.903e-13, decay_modes: ['Hadrons (~65%)', 'e\u207b + \u03bd\u0305_e + \u03bd_\u03c4 (~18%)', '\u03bc\u207b + \u03bd\u0305_\u03bc + \u03bd_\u03c4 (~17%)'] },
  electron_neutrino: { name: 'Electron Neutrino', symbol: '\u03bd_e', category: 'Lepton', mass_MeV: 0, charge: 0, spin: '1/2', lifetime_s: Infinity },
  muon_neutrino:     { name: 'Muon Neutrino', symbol: '\u03bd_\u03bc', category: 'Lepton', mass_MeV: 0, charge: 0, spin: '1/2', lifetime_s: Infinity },
  tau_neutrino:      { name: 'Tau Neutrino', symbol: '\u03bd_\u03c4', category: 'Lepton', mass_MeV: 0, charge: 0, spin: '1/2', lifetime_s: Infinity },

  // ── Quarks ──
  up:      { name: 'Up Quark', symbol: 'u', category: 'Quark', mass_MeV: 2.16, charge: 2/3, spin: '1/2', lifetime_s: Infinity, color_charge: 'r/g/b' },
  down:    { name: 'Down Quark', symbol: 'd', category: 'Quark', mass_MeV: 4.67, charge: -1/3, spin: '1/2', lifetime_s: Infinity, color_charge: 'r/g/b' },
  charm:   { name: 'Charm Quark', symbol: 'c', category: 'Quark', mass_MeV: 1270, charge: 2/3, spin: '1/2', lifetime_s: Infinity, color_charge: 'r/g/b' },
  strange: { name: 'Strange Quark', symbol: 's', category: 'Quark', mass_MeV: 93.4, charge: -1/3, spin: '1/2', lifetime_s: Infinity, color_charge: 'r/g/b' },
  top:     { name: 'Top Quark', symbol: 't', category: 'Quark', mass_MeV: 172_760, charge: 2/3, spin: '1/2', lifetime_s: 5e-25, color_charge: 'r/g/b', decay_modes: ['W\u207a + b (~100%)'] },
  bottom:  { name: 'Bottom Quark', symbol: 'b', category: 'Quark', mass_MeV: 4180, charge: -1/3, spin: '1/2', lifetime_s: Infinity, color_charge: 'r/g/b' },

  // ── Gauge Bosons ──
  photon: { name: 'Photon', symbol: '\u03b3', category: 'Gauge Boson', mass_MeV: null, charge: 0, spin: '1', lifetime_s: Infinity },
  gluon:  { name: 'Gluon', symbol: 'g', category: 'Gauge Boson', mass_MeV: null, charge: 0, spin: '1', lifetime_s: Infinity, color_charge: 'octet' },
  w_plus:  { name: 'W\u207a Boson', symbol: 'W\u207a', category: 'Gauge Boson', mass_MeV: 80_377, charge: 1, spin: '1', lifetime_s: 3.07e-25, decay_modes: ['q + q\u0305\' (~67%)', 'l + \u03bd_l (~33%)'] },
  w_minus: { name: 'W\u207b Boson', symbol: 'W\u207b', category: 'Gauge Boson', mass_MeV: 80_377, charge: -1, spin: '1', lifetime_s: 3.07e-25, decay_modes: ['q + q\u0305\' (~67%)', 'l + \u03bd_l (~33%)'] },
  z_boson: { name: 'Z Boson', symbol: 'Z\u2070', category: 'Gauge Boson', mass_MeV: 91_188, charge: 0, spin: '1', lifetime_s: 2.64e-25, decay_modes: ['q + q\u0305 (~70%)', 'l\u207a + l\u207b (~10%)', '\u03bd + \u03bd\u0305 (~20%)'] },

  // ── Scalar Boson ──
  higgs: { name: 'Higgs Boson', symbol: 'H\u2070', category: 'Scalar Boson', mass_MeV: 125_250, charge: 0, spin: '0', lifetime_s: 1.56e-22, decay_modes: ['b + b\u0305 (~58%)', 'W\u207a + W\u207b (~21%)', 'gg (~8.2%)', '\u03c4\u207a + \u03c4\u207b (~6.3%)', 'Z + Z (~2.6%)', '\u03b3\u03b3 (~0.23%)'] },

  // ── Mesons ──
  pion_plus:    { name: 'Pion', symbol: '\u03c0\u207a', category: 'Meson', mass_MeV: 139.570, charge: 1, spin: '0', lifetime_s: 2.603e-8, quark_content: 'u + d\u0305', decay_modes: ['\u03bc\u207a + \u03bd_\u03bc (~99.99%)'] },
  pion_minus:   { name: 'Pion', symbol: '\u03c0\u207b', category: 'Meson', mass_MeV: 139.570, charge: -1, spin: '0', lifetime_s: 2.603e-8, quark_content: 'd + u\u0305', decay_modes: ['\u03bc\u207b + \u03bd\u0305_\u03bc (~99.99%)'] },
  pion_zero:    { name: 'Neutral Pion', symbol: '\u03c0\u2070', category: 'Meson', mass_MeV: 134.977, charge: 0, spin: '0', lifetime_s: 8.43e-17, quark_content: '(u\u016b \u2212 d\u0064\u0305)/\u221a2', decay_modes: ['\u03b3 + \u03b3 (~98.8%)'] },
  kaon_plus:    { name: 'Kaon', symbol: 'K\u207a', category: 'Meson', mass_MeV: 493.677, charge: 1, spin: '0', lifetime_s: 1.238e-8, quark_content: 'u + s\u0305', decay_modes: ['\u03bc\u207a + \u03bd_\u03bc (~63.6%)', '\u03c0\u207a + \u03c0\u2070 (~20.7%)'] },
  kaon_minus:   { name: 'Kaon', symbol: 'K\u207b', category: 'Meson', mass_MeV: 493.677, charge: -1, spin: '0', lifetime_s: 1.238e-8, quark_content: 's + u\u0305' },
  kaon_zero:    { name: 'Neutral Kaon', symbol: 'K\u2070', category: 'Meson', mass_MeV: 497.611, charge: 0, spin: '0', lifetime_s: null, quark_content: 'd + s\u0305', decay_modes: ['Mixes to K_S / K_L'] },
  kaon_short:   { name: 'K-short', symbol: 'K_S', category: 'Meson', mass_MeV: 497.611, charge: 0, spin: '0', lifetime_s: 8.954e-11, decay_modes: ['\u03c0\u207a + \u03c0\u207b (~69%)', '\u03c0\u2070 + \u03c0\u2070 (~31%)'] },
  kaon_long:    { name: 'K-long', symbol: 'K_L', category: 'Meson', mass_MeV: 497.611, charge: 0, spin: '0', lifetime_s: 5.116e-8, decay_modes: ['\u03c0\u00b1 + e\u2213 + \u03bd (~41%)', '\u03c0\u00b1 + \u03bc\u2213 + \u03bd (~27%)', '3\u03c0\u2070 (~20%)'] },
  eta:          { name: 'Eta', symbol: '\u03b7', category: 'Meson', mass_MeV: 547.862, charge: 0, spin: '0', lifetime_s: 5.02e-19, quark_content: '(u\u016b + d\u0064\u0305 \u2212 2s\u0073\u0305)/\u221a6', decay_modes: ['\u03b3 + \u03b3 (~39%)', '3\u03c0\u2070 (~33%)', '\u03c0\u207a + \u03c0\u207b + \u03c0\u2070 (~23%)'] },
  eta_prime:    { name: 'Eta Prime', symbol: "\u03b7'(958)", category: 'Meson', mass_MeV: 957.78, charge: 0, spin: '0', lifetime_s: 3.32e-21, decay_modes: ['\u03c0\u207a + \u03c0\u207b + \u03b7 (~43%)', '\u03c1\u2070 + \u03b3 (~29%)'] },
  rho_plus:     { name: 'Rho', symbol: '\u03c1\u207a', category: 'Meson', mass_MeV: 775.11, charge: 1, spin: '1', lifetime_s: 4.41e-24, quark_content: 'u + d\u0305', decay_modes: ['\u03c0\u207a + \u03c0\u2070 (~100%)'] },
  rho_zero:     { name: 'Rho', symbol: '\u03c1\u2070', category: 'Meson', mass_MeV: 775.26, charge: 0, spin: '1', lifetime_s: 4.41e-24, quark_content: '(u\u016b \u2212 d\u0064\u0305)/\u221a2', decay_modes: ['\u03c0\u207a + \u03c0\u207b (~100%)'] },
  omega_meson:  { name: 'Omega Meson', symbol: '\u03c9(782)', category: 'Meson', mass_MeV: 782.66, charge: 0, spin: '1', lifetime_s: 7.75e-23, decay_modes: ['\u03c0\u207a + \u03c0\u207b + \u03c0\u2070 (~89%)'] },
  phi_meson:    { name: 'Phi Meson', symbol: '\u03c6(1020)', category: 'Meson', mass_MeV: 1019.461, charge: 0, spin: '1', lifetime_s: 1.55e-22, quark_content: 's + s\u0305', decay_modes: ['K\u207a + K\u207b (~49%)', 'K_L + K_S (~34%)'] },
  d_plus:       { name: 'D Meson', symbol: 'D\u207a', category: 'Meson', mass_MeV: 1869.66, charge: 1, spin: '0', lifetime_s: 1.040e-12, quark_content: 'c + d\u0305', decay_modes: ['K\u0305\u2070 + \u03c0\u207a (~3.9%)', 'K\u207b + \u03c0\u207a + \u03c0\u207a (~9.4%)'] },
  d_zero:       { name: 'D Meson', symbol: 'D\u2070', category: 'Meson', mass_MeV: 1864.84, charge: 0, spin: '0', lifetime_s: 4.101e-13, quark_content: 'c + u\u0305', decay_modes: ['K\u207b + \u03c0\u207a (~3.9%)'] },
  d_s_plus:     { name: 'D_s Meson', symbol: 'D_s\u207a', category: 'Meson', mass_MeV: 1968.35, charge: 1, spin: '0', lifetime_s: 5.04e-13, quark_content: 'c + s\u0305' },
  b_plus:       { name: 'B Meson', symbol: 'B\u207a', category: 'Meson', mass_MeV: 5279.34, charge: 1, spin: '0', lifetime_s: 1.638e-12, quark_content: 'u + b\u0305' },
  b_zero:       { name: 'B Meson', symbol: 'B\u2070', category: 'Meson', mass_MeV: 5279.66, charge: 0, spin: '0', lifetime_s: 1.519e-12, quark_content: 'd + b\u0305' },
  b_s:          { name: 'B_s Meson', symbol: 'B_s\u2070', category: 'Meson', mass_MeV: 5366.92, charge: 0, spin: '0', lifetime_s: 1.515e-12, quark_content: 's + b\u0305' },
  b_c_plus:     { name: 'B_c Meson', symbol: 'B_c\u207a', category: 'Meson', mass_MeV: 6274.47, charge: 1, spin: '0', lifetime_s: 5.10e-13, quark_content: 'c + b\u0305' },
  j_psi:        { name: 'J/Psi', symbol: 'J/\u03c8', category: 'Meson', mass_MeV: 3096.900, charge: 0, spin: '1', lifetime_s: 7.09e-21, quark_content: 'c + c\u0305', decay_modes: ['Hadrons (~88%)', 'e\u207a + e\u207b (~6%)', '\u03bc\u207a + \u03bc\u207b (~6%)'] },
  psi_2s:       { name: 'Psi(2S)', symbol: '\u03c8(2S)', category: 'Meson', mass_MeV: 3686.10, charge: 0, spin: '1', lifetime_s: 2.12e-21, quark_content: 'c + c\u0305' },
  upsilon_1s:   { name: 'Upsilon(1S)', symbol: '\u03a5(1S)', category: 'Meson', mass_MeV: 9460.30, charge: 0, spin: '1', lifetime_s: 1.22e-20, quark_content: 'b + b\u0305', decay_modes: ['Hadrons (~82%)', 'e\u207a + e\u207b (~2.4%)', '\u03bc\u207a + \u03bc\u207b (~2.5%)', '\u03c4\u207a + \u03c4\u207b (~2.6%)'] },
  upsilon_2s:   { name: 'Upsilon(2S)', symbol: '\u03a5(2S)', category: 'Meson', mass_MeV: 10023.26, charge: 0, spin: '1', lifetime_s: 3.25e-20, quark_content: 'b + b\u0305' },
  upsilon_3s:   { name: 'Upsilon(3S)', symbol: '\u03a5(3S)', category: 'Meson', mass_MeV: 10355.20, charge: 0, spin: '1', lifetime_s: 4.25e-20, quark_content: 'b + b\u0305' },

  // ── Baryons ──
  proton:          { name: 'Proton', symbol: 'p', category: 'Baryon', mass_MeV: 938.272, charge: 1, spin: '1/2', lifetime_s: Infinity, quark_content: 'uud' },
  neutron:         { name: 'Neutron', symbol: 'n', category: 'Baryon', mass_MeV: 939.565, charge: 0, spin: '1/2', lifetime_s: 878.4, quark_content: 'udd', decay_modes: ['p + e\u207b + \u03bd\u0305_e (100%)'] },
  antiproton:      { name: 'Antiproton', symbol: 'p\u0305', category: 'Baryon', mass_MeV: 938.272, charge: -1, spin: '1/2', lifetime_s: Infinity, quark_content: 'u\u0305u\u0305d\u0305', isAntiparticle: true },
  lambda:          { name: 'Lambda', symbol: '\u039b\u2070', category: 'Baryon', mass_MeV: 1115.683, charge: 0, spin: '1/2', lifetime_s: 2.632e-10, quark_content: 'uds', decay_modes: ['p + \u03c0\u207b (~64%)', 'n + \u03c0\u2070 (~36%)'] },
  sigma_plus:      { name: 'Sigma+', symbol: '\u03a3\u207a', category: 'Baryon', mass_MeV: 1189.37, charge: 1, spin: '1/2', lifetime_s: 8.018e-11, quark_content: 'uus', decay_modes: ['p + \u03c0\u2070 (~52%)', 'n + \u03c0\u207a (~48%)'] },
  sigma_zero:      { name: 'Sigma0', symbol: '\u03a3\u2070', category: 'Baryon', mass_MeV: 1192.642, charge: 0, spin: '1/2', lifetime_s: 7.4e-20, quark_content: 'uds', decay_modes: ['\u039b\u2070 + \u03b3 (100%)'] },
  sigma_minus:     { name: 'Sigma-', symbol: '\u03a3\u207b', category: 'Baryon', mass_MeV: 1197.449, charge: -1, spin: '1/2', lifetime_s: 1.479e-10, quark_content: 'dds', decay_modes: ['n + \u03c0\u207b (100%)'] },
  xi_zero:         { name: 'Xi0', symbol: '\u039e\u2070', category: 'Baryon', mass_MeV: 1314.86, charge: 0, spin: '1/2', lifetime_s: 2.90e-10, quark_content: 'uss', decay_modes: ['\u039b\u2070 + \u03c0\u2070 (100%)'] },
  xi_minus:        { name: 'Xi-', symbol: '\u039e\u207b', category: 'Baryon', mass_MeV: 1321.71, charge: -1, spin: '1/2', lifetime_s: 1.639e-10, quark_content: 'dss', decay_modes: ['\u039b\u2070 + \u03c0\u207b (100%)'] },
  omega_minus:     { name: 'Omega-', symbol: '\u03a9\u207b', category: 'Baryon', mass_MeV: 1672.45, charge: -1, spin: '3/2', lifetime_s: 8.21e-11, quark_content: 'sss', decay_modes: ['\u039b\u2070 + K\u207b (~68%)', '\u039e\u2070 + \u03c0\u207b (~24%)'] },
  delta_pp:        { name: 'Delta++', symbol: '\u0394\u207a\u207a', category: 'Baryon', mass_MeV: 1232, charge: 2, spin: '3/2', lifetime_s: 5.58e-24, quark_content: 'uuu', decay_modes: ['p + \u03c0\u207a (100%)'] },
  delta_plus:      { name: 'Delta+', symbol: '\u0394\u207a', category: 'Baryon', mass_MeV: 1232, charge: 1, spin: '3/2', lifetime_s: 5.58e-24, quark_content: 'uud', decay_modes: ['p + \u03c0\u2070 (~66%)', 'n + \u03c0\u207a (~33%)'] },
  delta_zero:      { name: 'Delta0', symbol: '\u0394\u2070', category: 'Baryon', mass_MeV: 1232, charge: 0, spin: '3/2', lifetime_s: 5.58e-24, quark_content: 'udd', decay_modes: ['n + \u03c0\u2070 (~66%)', 'p + \u03c0\u207b (~33%)'] },
  delta_minus:     { name: 'Delta-', symbol: '\u0394\u207b', category: 'Baryon', mass_MeV: 1232, charge: -1, spin: '3/2', lifetime_s: 5.58e-24, quark_content: 'ddd', decay_modes: ['n + \u03c0\u207b (100%)'] },
  lambda_c_plus:   { name: 'Lambda_c+', symbol: '\u039b_c\u207a', category: 'Baryon', mass_MeV: 2286.46, charge: 1, spin: '1/2', lifetime_s: 2.024e-13, quark_content: 'udc' },
  sigma_c_pp:      { name: 'Sigma_c++', symbol: '\u03a3_c\u207a\u207a', category: 'Baryon', mass_MeV: 2453.97, charge: 2, spin: '1/2', lifetime_s: 2.91e-22, quark_content: 'uuc' },
  xi_c_plus:       { name: 'Xi_c+', symbol: '\u039e_c\u207a', category: 'Baryon', mass_MeV: 2467.71, charge: 1, spin: '1/2', lifetime_s: 4.56e-13, quark_content: 'usc' },
  xi_c_zero:       { name: 'Xi_c0', symbol: '\u039e_c\u2070', category: 'Baryon', mass_MeV: 2470.44, charge: 0, spin: '1/2', lifetime_s: 1.53e-13, quark_content: 'dsc' },
  omega_c:         { name: 'Omega_c0', symbol: '\u03a9_c\u2070', category: 'Baryon', mass_MeV: 2695.2, charge: 0, spin: '1/2', lifetime_s: 2.68e-13, quark_content: 'ssc' },
  xi_cc_plus:      { name: 'Xi_cc+', symbol: '\u039e_cc\u207a', category: 'Baryon', mass_MeV: 3621.2, charge: 1, spin: '1/2', lifetime_s: 2.56e-13, quark_content: 'ccd', decay_modes: ['Lambda_c+ K- pi+ (dominant)', 'Xi_c+ pi+ pi-'] },
  lambda_b:        { name: 'Lambda_b0', symbol: '\u039b_b\u2070', category: 'Baryon', mass_MeV: 5619.60, charge: 0, spin: '1/2', lifetime_s: 1.471e-12, quark_content: 'udb' },
  xi_b_zero:       { name: 'Xi_b0', symbol: '\u039e_b\u2070', category: 'Baryon', mass_MeV: 5791.9, charge: 0, spin: '1/2', lifetime_s: 1.480e-12, quark_content: 'usb' },
  xi_b_minus:      { name: 'Xi_b-', symbol: '\u039e_b\u207b', category: 'Baryon', mass_MeV: 5797.0, charge: -1, spin: '1/2', lifetime_s: 1.572e-12, quark_content: 'dsb' },
  omega_b:         { name: 'Omega_b-', symbol: '\u03a9_b\u207b', category: 'Baryon', mass_MeV: 6046.1, charge: -1, spin: '1/2', lifetime_s: 1.64e-12, quark_content: 'ssb' },
  sigma_b_plus:    { name: 'Sigma_b+', symbol: '\u03a3_b\u207a', category: 'Baryon', mass_MeV: 5811.3, charge: 1, spin: '1/2', lifetime_s: 5.7e-23, quark_content: 'uub' },
  sigma_b_minus:   { name: 'Sigma_b-', symbol: '\u03a3_b\u207b', category: 'Baryon', mass_MeV: 5815.5, charge: -1, spin: '1/2', lifetime_s: 6.4e-23, quark_content: 'ddb' },
}

// Build alias map for flexible lookup
const PARTICLE_ALIASES: Record<string, string> = {}
for (const [key, p] of Object.entries(PARTICLES)) {
  PARTICLE_ALIASES[key] = key
  PARTICLE_ALIASES[p.name.toLowerCase()] = key
  PARTICLE_ALIASES[p.symbol.toLowerCase()] = key
  // Common aliases
  if (key === 'j_psi') { PARTICLE_ALIASES['jpsi'] = key; PARTICLE_ALIASES['j/psi'] = key; PARTICLE_ALIASES['j/\u03c8'] = key }
  if (key === 'w_plus') { PARTICLE_ALIASES['w+'] = key; PARTICLE_ALIASES['w boson'] = key; PARTICLE_ALIASES['w+boson'] = key }
  if (key === 'w_minus') { PARTICLE_ALIASES['w-'] = key; PARTICLE_ALIASES['w-boson'] = key }
  if (key === 'z_boson') { PARTICLE_ALIASES['z'] = key; PARTICLE_ALIASES['z0'] = key; PARTICLE_ALIASES['z boson'] = key }
  if (key === 'higgs') { PARTICLE_ALIASES['h0'] = key; PARTICLE_ALIASES['higgs boson'] = key }
  if (key === 'pion_plus') { PARTICLE_ALIASES['pi+'] = key; PARTICLE_ALIASES['pion+'] = key }
  if (key === 'pion_minus') { PARTICLE_ALIASES['pi-'] = key; PARTICLE_ALIASES['pion-'] = key }
  if (key === 'pion_zero') { PARTICLE_ALIASES['pi0'] = key; PARTICLE_ALIASES['pion0'] = key }
  if (key === 'kaon_plus') { PARTICLE_ALIASES['k+'] = key }
  if (key === 'kaon_minus') { PARTICLE_ALIASES['k-'] = key }
  if (key === 'kaon_zero') { PARTICLE_ALIASES['k0'] = key }
  if (key === 'upsilon_1s') { PARTICLE_ALIASES['upsilon'] = key; PARTICLE_ALIASES['y(1s)'] = key }
}

function lookupParticle(name: string): Particle | undefined {
  const key = PARTICLE_ALIASES[name.toLowerCase().trim()]
  return key ? PARTICLES[key] : undefined
}

// ─── Complex Number Arithmetic ───────────────────────────────────────────────

interface Complex { re: number; im: number }

function cMul(a: Complex, b: Complex): Complex {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }
}

function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im }
}

function cSub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im }
}

function cAbs2(a: Complex): number {
  return a.re * a.re + a.im * a.im
}

function cScale(a: Complex, s: number): Complex {
  return { re: a.re * s, im: a.im * s }
}

function cExp(theta: number): Complex {
  return { re: Math.cos(theta), im: Math.sin(theta) }
}

function cFmt(z: Complex, digits = 4): string {
  const r = z.re, i = z.im
  if (Math.abs(r) < 1e-10 && Math.abs(i) < 1e-10) return '0'
  if (Math.abs(i) < 1e-10) return r.toFixed(digits)
  if (Math.abs(r) < 1e-10) return `${i.toFixed(digits)}i`
  const sign = i >= 0 ? '+' : '-'
  return `${r.toFixed(digits)}${sign}${Math.abs(i).toFixed(digits)}i`
}

// ─── Quantum Gate Matrices ───────────────────────────────────────────────────

type GateMatrix = Complex[][]

const GATE_H: GateMatrix = [
  [{ re: 1 / Math.SQRT2, im: 0 }, { re: 1 / Math.SQRT2, im: 0 }],
  [{ re: 1 / Math.SQRT2, im: 0 }, { re: -1 / Math.SQRT2, im: 0 }],
]

const GATE_X: GateMatrix = [
  [{ re: 0, im: 0 }, { re: 1, im: 0 }],
  [{ re: 1, im: 0 }, { re: 0, im: 0 }],
]

const GATE_Y: GateMatrix = [
  [{ re: 0, im: 0 }, { re: 0, im: -1 }],
  [{ re: 0, im: 1 }, { re: 0, im: 0 }],
]

const GATE_Z: GateMatrix = [
  [{ re: 1, im: 0 }, { re: 0, im: 0 }],
  [{ re: 0, im: 0 }, { re: -1, im: 0 }],
]

const GATE_T: GateMatrix = [
  [{ re: 1, im: 0 }, { re: 0, im: 0 }],
  [{ re: 0, im: 0 }, cExp(Math.PI / 4)],
]

const GATE_S: GateMatrix = [
  [{ re: 1, im: 0 }, { re: 0, im: 0 }],
  [{ re: 0, im: 0 }, { re: 0, im: 1 }],
]

const GATE_I: GateMatrix = [
  [{ re: 1, im: 0 }, { re: 0, im: 0 }],
  [{ re: 0, im: 0 }, { re: 1, im: 0 }],
]

const GATE_CNOT: GateMatrix = [
  [{ re: 1, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }],
  [{ re: 0, im: 0 }, { re: 1, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }],
  [{ re: 0, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }, { re: 1, im: 0 }],
  [{ re: 0, im: 0 }, { re: 0, im: 0 }, { re: 1, im: 0 }, { re: 0, im: 0 }],
]

const GATE_SWAP: GateMatrix = [
  [{ re: 1, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }],
  [{ re: 0, im: 0 }, { re: 0, im: 0 }, { re: 1, im: 0 }, { re: 0, im: 0 }],
  [{ re: 0, im: 0 }, { re: 1, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }],
  [{ re: 0, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }, { re: 1, im: 0 }],
]

// Toffoli = 8x8 identity with bottom-right 2x2 as X
function makeToffoli(): GateMatrix {
  const n = 8
  const m: GateMatrix = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => ({ re: i === j ? 1 : 0, im: 0 }))
  )
  // Swap |110> and |111>
  m[6][6] = { re: 0, im: 0 }; m[6][7] = { re: 1, im: 0 }
  m[7][6] = { re: 1, im: 0 }; m[7][7] = { re: 0, im: 0 }
  return m
}

const GATE_TOFFOLI = makeToffoli()

/** Tensor product of two matrices */
function tensorProduct(a: GateMatrix, b: GateMatrix): GateMatrix {
  const ra = a.length, ca = a[0].length
  const rb = b.length, cb = b[0].length
  const result: GateMatrix = Array.from({ length: ra * rb }, () =>
    Array.from({ length: ca * cb }, () => ({ re: 0, im: 0 }))
  )
  for (let i = 0; i < ra; i++) {
    for (let j = 0; j < ca; j++) {
      for (let k = 0; k < rb; k++) {
        for (let l = 0; l < cb; l++) {
          result[i * rb + k][j * cb + l] = cMul(a[i][j], b[k][l])
        }
      }
    }
  }
  return result
}

/** Apply gate matrix to state vector */
function applyMatrix(mat: GateMatrix, state: Complex[]): Complex[] {
  const n = state.length
  const result: Complex[] = Array.from({ length: n }, () => ({ re: 0, im: 0 }))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      result[i] = cAdd(result[i], cMul(mat[i][j], state[j]))
    }
  }
  return result
}

/** Build full n-qubit gate from a single-qubit gate acting on qubit q */
function buildSingleQubitGate(gate: GateMatrix, qubit: number, nQubits: number): GateMatrix {
  let result: GateMatrix = qubit === 0 ? gate : GATE_I
  for (let i = 1; i < nQubits; i++) {
    result = tensorProduct(result, i === qubit ? gate : GATE_I)
  }
  return result
}

/** Build full n-qubit gate from a two-qubit gate acting on qubits q1, q2 (adjacent) */
function buildTwoQubitGate(gate: GateMatrix, q1: number, q2: number, nQubits: number): GateMatrix {
  // For CNOT/SWAP: q1=control, q2=target. We need them adjacent via SWAP routing.
  // Simple case: handle adjacent qubits directly
  const minQ = Math.min(q1, q2)
  // Build: I^minQ tensor gate tensor I^(nQubits-minQ-2)
  let result: GateMatrix | null = null
  for (let i = 0; i < nQubits; i++) {
    if (i === minQ) {
      // If q1 < q2, gate acts normally. If q2 < q1, we need to reverse.
      let g = gate
      if (q2 < q1 && gate === GATE_CNOT) {
        // Reverse CNOT: swap target/control via conjugation with SWAP
        // |00> -> |00>, |01> -> |11>, |10> -> |10>, |11> -> |01>
        g = [
          [{ re: 1, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }],
          [{ re: 0, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }, { re: 1, im: 0 }],
          [{ re: 0, im: 0 }, { re: 0, im: 0 }, { re: 1, im: 0 }, { re: 0, im: 0 }],
          [{ re: 0, im: 0 }, { re: 1, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }],
        ]
      }
      result = result ? tensorProduct(result, g) : g
      i++ // skip next qubit (already part of 2-qubit gate)
    } else {
      result = result ? tensorProduct(result, GATE_I) : GATE_I
    }
  }
  return result!
}

/** Build a three-qubit Toffoli gate for specified control/target qubits */
function buildThreeQubitGate(gate: GateMatrix, q0: number, q1: number, q2: number, nQubits: number): GateMatrix {
  // Simple case: contiguous qubits
  let result: GateMatrix | null = null
  const minQ = Math.min(q0, q1, q2)
  for (let i = 0; i < nQubits; i++) {
    if (i === minQ) {
      result = result ? tensorProduct(result, gate) : gate
      i += 2 // skip next 2 qubits
    } else {
      result = result ? tensorProduct(result, GATE_I) : GATE_I
    }
  }
  return result!
}

// ─── Signal Processing Helpers ───────────────────────────────────────────────

/** Cooley-Tukey FFT (radix-2, input length must be power of 2) */
function fft(input: Complex[]): Complex[] {
  const n = input.length
  if (n === 1) return [input[0]]

  // Pad to next power of 2 if needed (handled by caller)
  const even = fft(input.filter((_, i) => i % 2 === 0))
  const odd = fft(input.filter((_, i) => i % 2 === 1))

  const result: Complex[] = new Array(n)
  for (let k = 0; k < n / 2; k++) {
    const t = cMul(cExp(-2 * Math.PI * k / n), odd[k])
    result[k] = cAdd(even[k], t)
    result[k + n / 2] = cSub(even[k], t)
  }
  return result
}

function nextPow2(n: number): number {
  let p = 1
  while (p < n) p <<= 1
  return p
}

function padToPow2(signal: number[]): Complex[] {
  const n = nextPow2(signal.length)
  const padded: Complex[] = signal.map(v => ({ re: v, im: 0 }))
  while (padded.length < n) padded.push({ re: 0, im: 0 })
  return padded
}

/** Inverse FFT */
function ifft(input: Complex[]): Complex[] {
  const n = input.length
  // Conjugate, FFT, conjugate, scale
  const conj = input.map(z => ({ re: z.re, im: -z.im }))
  const transformed = fft(conj)
  return transformed.map(z => ({ re: z.re / n, im: -z.im / n }))
}

// Window functions
function hammingWindow(n: number): number[] {
  return Array.from({ length: n }, (_, i) => 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (n - 1)))
}

function hanningWindow(n: number): number[] {
  return Array.from({ length: n }, (_, i) => 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1))))
}

function blackmanWindow(n: number): number[] {
  return Array.from({ length: n }, (_, i) =>
    0.42 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)) + 0.08 * Math.cos(4 * Math.PI * i / (n - 1))
  )
}

// ─── Beam Analysis Helpers ───────────────────────────────────────────────────

interface BeamLoad {
  type: 'point' | 'distributed' | 'moment'
  magnitude: number   // N, N/m, or N*m
  position: number    // m from left end
  end_position?: number // for distributed loads
}

interface BeamMaterial {
  E: number  // Young's modulus (Pa)
  I: number  // Second moment of area (m^4)
}

const DEFAULT_MATERIALS: Record<string, BeamMaterial> = {
  steel:    { E: 200e9, I: 8.333e-6 },  // ~100x100mm square section
  aluminum: { E: 69e9,  I: 8.333e-6 },
  timber:   { E: 12e9,  I: 8.333e-6 },
  concrete: { E: 30e9,  I: 8.333e-6 },
}

// ─── Tool Registration ───────────────────────────────────────────────────────

export function registerLabPhysicsTools(): void {

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. ORBIT CALCULATOR
  // ═══════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'orbit_calculator',
    description: 'Orbital mechanics: period, velocity, energy, escape velocity, Hohmann transfers, Lagrange points. Embedded solar system data (Sun through Pluto + Moon).',
    parameters: {
      body: { type: 'string', description: 'Central body name (sun, earth, mars, etc.)', required: true },
      altitude_km: { type: 'number', description: 'Orbital altitude above surface in km', required: true },
      calculation: { type: 'string', description: 'Calculation type: orbit, hohmann, escape, lagrange', required: true },
      target_body: { type: 'string', description: 'Target body for Hohmann transfer (e.g. mars)', required: false },
    },
    tier: 'free',
    async execute(args) {
      const bodyName = String(args.body).toLowerCase()
      const altitude_km = Number(args.altitude_km)
      const calc = String(args.calculation).toLowerCase()
      const targetName = args.target_body ? String(args.target_body).toLowerCase() : undefined

      const body = BODIES[bodyName]
      if (!body) return `**Error**: Unknown body "${bodyName}". Available: ${Object.keys(BODIES).join(', ')}`

      const altitude_m = altitude_km * 1000
      const r = body.radius + altitude_m
      const mu = G * body.mass  // Standard gravitational parameter

      const lines: string[] = [`## Orbital Mechanics \u2014 ${bodyName.charAt(0).toUpperCase() + bodyName.slice(1)}`]
      lines.push('')
      lines.push(`| Parameter | Value |`)
      lines.push(`|---|---|`)
      lines.push(`| Central body mass | ${fmtUnit(body.mass, 'kg')} |`)
      lines.push(`| Body radius | ${fmtUnit(body.radius / 1000, 'km')} |`)
      lines.push(`| Altitude | ${fmtUnit(altitude_km, 'km')} |`)
      lines.push(`| Orbital radius (r) | ${fmtUnit(r / 1000, 'km')} |`)
      lines.push(`| \u03bc (GM) | ${fmtUnit(mu, 'm\u00b3/s\u00b2')} |`)

      if (calc === 'orbit' || calc === 'all') {
        // Circular orbit
        const v_circ = Math.sqrt(mu / r)
        const T = 2 * Math.PI * Math.sqrt(r ** 3 / mu)
        const E_specific = -mu / (2 * r) // specific orbital energy
        const v_escape = Math.sqrt(2 * mu / r)

        lines.push('')
        lines.push('### Circular Orbit')
        lines.push('')
        lines.push(`| Quantity | Value |`)
        lines.push(`|---|---|`)
        lines.push(`| Orbital velocity | ${fmtUnit(v_circ, 'm/s')} (${fmtUnit(v_circ / 1000, 'km/s')}) |`)
        lines.push(`| Orbital period | ${fmtUnit(T, 's')} (${fmtUnit(T / 3600, 'hours')}) |`)
        lines.push(`| Specific energy | ${fmtUnit(E_specific, 'J/kg')} |`)
        lines.push(`| Escape velocity | ${fmtUnit(v_escape, 'm/s')} (${fmtUnit(v_escape / 1000, 'km/s')}) |`)

        // Vis-viva for elliptical orbits — show for reference
        lines.push('')
        lines.push('**Vis-viva equation**: v\u00b2 = \u03bc(2/r - 1/a)')
      }

      if (calc === 'escape') {
        const v_escape = Math.sqrt(2 * mu / r)
        const v_circ = Math.sqrt(mu / r)
        const delta_v = v_escape - v_circ

        lines.push('')
        lines.push('### Escape Analysis')
        lines.push('')
        lines.push(`| Quantity | Value |`)
        lines.push(`|---|---|`)
        lines.push(`| Escape velocity | ${fmtUnit(v_escape, 'm/s')} (${fmtUnit(v_escape / 1000, 'km/s')}) |`)
        lines.push(`| Circular velocity | ${fmtUnit(v_circ, 'm/s')} |`)
        lines.push(`| \u0394v (circular \u2192 escape) | ${fmtUnit(delta_v, 'm/s')} |`)
        lines.push(`| Escape energy (1kg) | ${fmtUnit(0.5 * v_escape ** 2, 'J')} |`)
      }

      if (calc === 'hohmann' && targetName) {
        const target = BODIES[targetName]
        if (!target) return `**Error**: Unknown target body "${targetName}".`
        if (!body.semiMajorAxis && !target.semiMajorAxis) return '**Error**: Need orbital data for Hohmann transfer.'

        // Both bodies orbit the same parent (e.g., Sun)
        const parentName = body.parent || target.parent || 'sun'
        const parent = BODIES[parentName]
        if (!parent) return '**Error**: Cannot determine parent body for transfer.'

        const mu_parent = G * parent.mass
        const r1 = BODIES[bodyName]?.semiMajorAxis || r
        const r2 = BODIES[targetName]?.semiMajorAxis
        if (!r2) return `**Error**: No orbital data for ${targetName}.`

        // Hohmann transfer
        const a_transfer = (r1 + r2) / 2
        const T_transfer = Math.PI * Math.sqrt(a_transfer ** 3 / mu_parent)

        // Delta-v at departure (vis-viva)
        const v_circ1 = Math.sqrt(mu_parent / r1)
        const v_transfer1 = Math.sqrt(mu_parent * (2 / r1 - 1 / a_transfer))
        const dv1 = Math.abs(v_transfer1 - v_circ1)

        // Delta-v at arrival
        const v_circ2 = Math.sqrt(mu_parent / r2)
        const v_transfer2 = Math.sqrt(mu_parent * (2 / r2 - 1 / a_transfer))
        const dv2 = Math.abs(v_circ2 - v_transfer2)

        const dv_total = dv1 + dv2

        lines.push('')
        lines.push(`### Hohmann Transfer: ${bodyName} \u2192 ${targetName}`)
        lines.push('')
        lines.push(`| Quantity | Value |`)
        lines.push(`|---|---|`)
        lines.push(`| Departure orbit (r\u2081) | ${fmtUnit(r1 / AU, 'AU')} |`)
        lines.push(`| Arrival orbit (r\u2082) | ${fmtUnit(r2 / AU, 'AU')} |`)
        lines.push(`| Transfer semi-major axis | ${fmtUnit(a_transfer / AU, 'AU')} |`)
        lines.push(`| Transfer time | ${fmtUnit(T_transfer, 's')} (${fmtUnit(T_transfer / 86400, 'days')}) |`)
        lines.push(`| \u0394v\u2081 (departure burn) | ${fmtUnit(dv1, 'm/s')} (${fmtUnit(dv1 / 1000, 'km/s')}) |`)
        lines.push(`| \u0394v\u2082 (arrival burn) | ${fmtUnit(dv2, 'm/s')} (${fmtUnit(dv2 / 1000, 'km/s')}) |`)
        lines.push(`| Total \u0394v | ${fmtUnit(dv_total, 'm/s')} (${fmtUnit(dv_total / 1000, 'km/s')}) |`)
      }

      if (calc === 'lagrange' && targetName) {
        const target = BODIES[targetName]
        if (!target) return `**Error**: Unknown body "${targetName}".`

        // L1-L5 points for two-body system
        // Mass ratio
        const M = body.mass
        const m = target.mass
        const R = target.semiMajorAxis
        if (!R) return `**Error**: No orbital distance data for ${targetName}.`

        const q = m / (M + m)  // mass ratio

        // L1: approximately R * (1 - (q/3)^(1/3))
        const rL1 = R * (1 - Math.pow(q / 3, 1 / 3))
        // L2: approximately R * (1 + (q/3)^(1/3))
        const rL2 = R * (1 + Math.pow(q / 3, 1 / 3))
        // L3: approximately -R * (1 + 5*q/12)
        const rL3 = R * (1 + 5 * q / 12)

        lines.push('')
        lines.push(`### Lagrange Points: ${bodyName}\u2013${targetName} System`)
        lines.push('')
        lines.push(`| Point | Distance from ${bodyName} | Notes |`)
        lines.push(`|---|---|---|`)
        lines.push(`| L1 | ${fmtUnit(rL1 / 1000, 'km')} (${fmtUnit(rL1 / AU, 'AU')}) | Between bodies, unstable |`)
        lines.push(`| L2 | ${fmtUnit(rL2 / 1000, 'km')} (${fmtUnit(rL2 / AU, 'AU')}) | Beyond ${targetName}, unstable |`)
        lines.push(`| L3 | ${fmtUnit(rL3 / 1000, 'km')} (${fmtUnit(rL3 / AU, 'AU')}) | Opposite side, unstable |`)
        lines.push(`| L4 | R at 60\u00b0 ahead | Stable (equilateral) |`)
        lines.push(`| L5 | R at 60\u00b0 behind | Stable (equilateral) |`)
        lines.push('')
        lines.push(`Mass ratio q = m/(M+m) = ${fmt(q)}`)
      }

      return lines.join('\n')
    },
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. CIRCUIT ANALYZER
  // ═══════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'circuit_analyze',
    description: 'DC/AC circuit analysis: Ohm\'s law, series/parallel resistors, voltage dividers, Wheatstone bridge, RC/RL/RLC transient and frequency response, impedance, resonance.',
    parameters: {
      circuit_type: { type: 'string', description: 'Circuit type: series, parallel, rlc, voltage_divider, wheatstone', required: true },
      components: { type: 'string', description: 'JSON object with R (ohms), L (henries), C (farads), V (volts) arrays/values', required: true },
      frequency: { type: 'number', description: 'Frequency in Hz for AC analysis', required: false },
    },
    tier: 'free',
    async execute(args) {
      const circuitType = String(args.circuit_type).toLowerCase()
      let comp: Record<string, unknown>
      try {
        comp = JSON.parse(String(args.components))
      } catch {
        return '**Error**: Invalid JSON in components parameter.'
      }

      const freq = args.frequency ? Number(args.frequency) : undefined
      const omega = freq ? 2 * Math.PI * freq : undefined

      const lines: string[] = ['## Circuit Analysis']
      lines.push('')

      if (circuitType === 'series') {
        const resistors = (comp.R as number[] | undefined) || []
        const V = (comp.V as number | undefined) || 0

        if (resistors.length === 0) return '**Error**: Provide R array of resistor values in ohms.'

        const R_total = resistors.reduce((a, b) => a + b, 0)
        const I = V ? V / R_total : 0

        lines.push('### Series Resistors')
        lines.push('')
        lines.push(`| Component | Value |`)
        lines.push(`|---|---|`)
        resistors.forEach((r, i) => lines.push(`| R${i + 1} | ${fmtUnit(r, '\u03a9')} |`))
        lines.push(`| **R_total** | **${fmtUnit(R_total, '\u03a9')}** |`)
        if (V) {
          lines.push(`| Supply voltage | ${fmtUnit(V, 'V')} |`)
          lines.push(`| Current | ${fmtUnit(I, 'A')} |`)
          lines.push(`| Power | ${fmtUnit(V * I, 'W')} |`)
          lines.push('')
          lines.push('#### Voltage drops')
          lines.push('')
          resistors.forEach((r, i) => lines.push(`- V_R${i + 1} = ${fmtUnit(I * r, 'V')}`))
        }

        // AC analysis if frequency provided
        if (omega && comp.L) {
          const L = comp.L as number
          const X_L = omega * L
          const Z = Math.sqrt(R_total ** 2 + X_L ** 2)
          const phi = Math.atan2(X_L, R_total) * 180 / Math.PI
          lines.push('')
          lines.push(`### AC Analysis @ ${freq} Hz`)
          lines.push(`- Inductive reactance X_L = ${fmtUnit(X_L, '\u03a9')}`)
          lines.push(`- Impedance |Z| = ${fmtUnit(Z, '\u03a9')}`)
          lines.push(`- Phase angle = ${fmtUnit(phi, '\u00b0')}`)
        }
        if (omega && comp.C) {
          const C = comp.C as number
          const X_C = 1 / (omega * C)
          const Z = Math.sqrt(R_total ** 2 + X_C ** 2)
          const phi = Math.atan2(-X_C, R_total) * 180 / Math.PI
          lines.push('')
          lines.push(`### AC Analysis @ ${freq} Hz`)
          lines.push(`- Capacitive reactance X_C = ${fmtUnit(X_C, '\u03a9')}`)
          lines.push(`- Impedance |Z| = ${fmtUnit(Z, '\u03a9')}`)
          lines.push(`- Phase angle = ${fmtUnit(phi, '\u00b0')}`)
        }
      }

      else if (circuitType === 'parallel') {
        const resistors = (comp.R as number[] | undefined) || []
        const V = (comp.V as number | undefined) || 0

        if (resistors.length === 0) return '**Error**: Provide R array of resistor values in ohms.'

        const G_total = resistors.reduce((a, r) => a + 1 / r, 0) // total conductance
        const R_total = 1 / G_total
        const I_total = V ? V / R_total : 0

        lines.push('### Parallel Resistors')
        lines.push('')
        lines.push(`| Component | Value |`)
        lines.push(`|---|---|`)
        resistors.forEach((r, i) => lines.push(`| R${i + 1} | ${fmtUnit(r, '\u03a9')} |`))
        lines.push(`| **R_total** | **${fmtUnit(R_total, '\u03a9')}** |`)
        if (V) {
          lines.push(`| Supply voltage | ${fmtUnit(V, 'V')} |`)
          lines.push(`| Total current | ${fmtUnit(I_total, 'A')} |`)
          lines.push(`| Total power | ${fmtUnit(V * I_total, 'W')} |`)
          lines.push('')
          lines.push('#### Branch currents')
          lines.push('')
          resistors.forEach((r, i) => lines.push(`- I_R${i + 1} = ${fmtUnit(V / r, 'A')}`))
        }
      }

      else if (circuitType === 'voltage_divider') {
        const R1 = comp.R1 as number || (comp.R as number[])?.[0]
        const R2 = comp.R2 as number || (comp.R as number[])?.[1]
        const V_in = (comp.V as number) || (comp.Vin as number) || 0

        if (!R1 || !R2) return '**Error**: Provide R1 and R2 (or R: [R1, R2]) for voltage divider.'

        const V_out = V_in * R2 / (R1 + R2)
        const I = V_in / (R1 + R2)

        lines.push('### Voltage Divider')
        lines.push('')
        lines.push(`| Parameter | Value |`)
        lines.push(`|---|---|`)
        lines.push(`| R1 (top) | ${fmtUnit(R1, '\u03a9')} |`)
        lines.push(`| R2 (bottom) | ${fmtUnit(R2, '\u03a9')} |`)
        lines.push(`| V_in | ${fmtUnit(V_in, 'V')} |`)
        lines.push(`| **V_out** | **${fmtUnit(V_out, 'V')}** |`)
        lines.push(`| Ratio | ${fmt(R2 / (R1 + R2))} |`)
        lines.push(`| Current | ${fmtUnit(I, 'A')} |`)
        lines.push('')
        lines.push(`**Formula**: V_out = V_in \u00d7 R2 / (R1 + R2)`)
      }

      else if (circuitType === 'wheatstone') {
        const R1 = comp.R1 as number
        const R2 = comp.R2 as number
        const R3 = comp.R3 as number
        const R4 = comp.R4 as number
        const V = (comp.V as number) || 0

        if (!R1 || !R2 || !R3 || !R4) return '**Error**: Provide R1, R2, R3, R4 for Wheatstone bridge.'

        // Bridge voltage
        const V_bridge = V * (R3 / (R3 + R1) - R4 / (R4 + R2))
        const balanced = Math.abs(R1 * R4 - R2 * R3) < 1e-10

        lines.push('### Wheatstone Bridge')
        lines.push('')
        lines.push('```')
        lines.push(`     +--R1(${R1}\u03a9)--+--R2(${R2}\u03a9)--+`)
        lines.push(`     |         |         |`)
        lines.push(`   [V=${V}V]   [V_bd]    |`)
        lines.push(`     |         |         |`)
        lines.push(`     +--R3(${R3}\u03a9)--+--R4(${R4}\u03a9)--+`)
        lines.push('```')
        lines.push('')
        lines.push(`| Parameter | Value |`)
        lines.push(`|---|---|`)
        lines.push(`| Bridge voltage | ${fmtUnit(V_bridge, 'V')} |`)
        lines.push(`| Balanced? | ${balanced ? 'Yes (R1\u00b7R4 = R2\u00b7R3)' : 'No'} |`)
        lines.push(`| R1\u00b7R4 | ${fmt(R1 * R4)} |`)
        lines.push(`| R2\u00b7R3 | ${fmt(R2 * R3)} |`)
        if (balanced) {
          lines.push(`| Unknown R_x (if R4 unknown) | ${fmtUnit(R2 * R3 / R1, '\u03a9')} |`)
        }
      }

      else if (circuitType === 'rlc') {
        const R = (comp.R as number) || 0
        const L = (comp.L as number) || 0
        const C = (comp.C as number) || 0
        const V = (comp.V as number) || 0

        if (!R && !L && !C) return '**Error**: Provide at least one of R, L, C for RLC analysis.'

        lines.push('### RLC Circuit Analysis')
        lines.push('')
        lines.push(`| Component | Value |`)
        lines.push(`|---|---|`)
        if (R) lines.push(`| R | ${fmtUnit(R, '\u03a9')} |`)
        if (L) lines.push(`| L | ${fmtUnit(L, 'H')} |`)
        if (C) lines.push(`| C | ${fmtUnit(C, 'F')} |`)
        if (V) lines.push(`| V | ${fmtUnit(V, 'V')} |`)

        // Resonance frequency
        if (L && C) {
          const f_res = 1 / (2 * Math.PI * Math.sqrt(L * C))
          const omega_res = 2 * Math.PI * f_res
          const Q = R > 0 ? (1 / R) * Math.sqrt(L / C) : Infinity
          const bandwidth = R > 0 ? f_res / Q : 0

          lines.push('')
          lines.push('### Resonance')
          lines.push('')
          lines.push(`| Parameter | Value |`)
          lines.push(`|---|---|`)
          lines.push(`| Resonant frequency | ${fmtUnit(f_res, 'Hz')} |`)
          lines.push(`| Angular frequency \u03c9\u2080 | ${fmtUnit(omega_res, 'rad/s')} |`)
          lines.push(`| Quality factor Q | ${fmt(Q)} |`)
          lines.push(`| Bandwidth | ${fmtUnit(bandwidth, 'Hz')} |`)
          lines.push(`| Characteristic impedance | ${fmtUnit(Math.sqrt(L / C), '\u03a9')} |`)
        }

        // Time constants
        if (R && C && !L) {
          const tau = R * C
          lines.push('')
          lines.push(`### RC Time Constant`)
          lines.push(`- \u03c4 = RC = ${fmtUnit(tau, 's')}`)
          lines.push(`- Cutoff frequency f_c = ${fmtUnit(1 / (2 * Math.PI * tau), 'Hz')}`)
        }
        if (R && L && !C) {
          const tau = L / R
          lines.push('')
          lines.push(`### RL Time Constant`)
          lines.push(`- \u03c4 = L/R = ${fmtUnit(tau, 's')}`)
          lines.push(`- Cutoff frequency f_c = ${fmtUnit(R / (2 * Math.PI * L), 'Hz')}`)
        }

        // Damping analysis for RLC
        if (R && L && C) {
          const alpha = R / (2 * L)           // damping coefficient
          const omega0 = 1 / Math.sqrt(L * C) // natural frequency
          const zeta = alpha / omega0          // damping ratio

          lines.push('')
          lines.push('### Damping Analysis')
          lines.push('')
          lines.push(`| Parameter | Value |`)
          lines.push(`|---|---|`)
          lines.push(`| Damping coefficient \u03b1 | ${fmtUnit(alpha, 's\u207b\u00b9')} |`)
          lines.push(`| Natural frequency \u03c9\u2080 | ${fmtUnit(omega0, 'rad/s')} |`)
          lines.push(`| Damping ratio \u03b6 | ${fmt(zeta)} |`)
          lines.push(`| Response type | ${zeta > 1 ? 'Overdamped' : zeta === 1 ? 'Critically damped' : 'Underdamped'} |`)

          if (zeta < 1) {
            const omega_d = omega0 * Math.sqrt(1 - zeta ** 2)
            lines.push(`| Damped frequency \u03c9_d | ${fmtUnit(omega_d, 'rad/s')} |`)
            lines.push(`| Damped freq (Hz) | ${fmtUnit(omega_d / (2 * Math.PI), 'Hz')} |`)
          }
        }

        // AC impedance at given frequency
        if (freq && omega) {
          const X_L = L ? omega * L : 0
          const X_C = C ? 1 / (omega * C) : 0
          const X_net = X_L - X_C
          const Z_mag = Math.sqrt(R ** 2 + X_net ** 2)
          const phi = Math.atan2(X_net, R) * 180 / Math.PI
          const I_mag = V ? V / Z_mag : 0

          lines.push('')
          lines.push(`### AC Response @ ${freq} Hz`)
          lines.push('')
          lines.push(`| Parameter | Value |`)
          lines.push(`|---|---|`)
          lines.push(`| Inductive reactance X_L | ${fmtUnit(X_L, '\u03a9')} |`)
          lines.push(`| Capacitive reactance X_C | ${fmtUnit(X_C, '\u03a9')} |`)
          lines.push(`| Net reactance X | ${fmtUnit(X_net, '\u03a9')} |`)
          lines.push(`| Impedance |Z| | ${fmtUnit(Z_mag, '\u03a9')} |`)
          lines.push(`| Phase angle | ${fmtUnit(phi, '\u00b0')} |`)
          if (V) {
            lines.push(`| Current amplitude | ${fmtUnit(I_mag, 'A')} |`)
            lines.push(`| Real power | ${fmtUnit(I_mag ** 2 * R, 'W')} |`)
            lines.push(`| Reactive power | ${fmtUnit(I_mag ** 2 * Math.abs(X_net), 'VAR')} |`)
            lines.push(`| Apparent power | ${fmtUnit(V * I_mag, 'VA')} |`)
            lines.push(`| Power factor | ${fmt(Math.cos(phi * Math.PI / 180))} |`)
          }
        }
      }

      else {
        return `**Error**: Unknown circuit type "${circuitType}". Options: series, parallel, rlc, voltage_divider, wheatstone`
      }

      return lines.join('\n')
    },
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. SIGNAL PROCESSOR
  // ═══════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'signal_process',
    description: 'Digital signal processing: FFT, lowpass/highpass/bandpass filters (FIR), convolution, autocorrelation, windowing (Hamming, Hanning, Blackman).',
    parameters: {
      signal: { type: 'string', description: 'Comma-separated signal values (e.g. "1,0,-1,0,1,0,-1,0")', required: true },
      operation: { type: 'string', description: 'Operation: fft, lowpass, highpass, bandpass, convolve, autocorrelation, window', required: true },
      params: { type: 'string', description: 'JSON params: {cutoff_freq, window_type, kernel, low_freq, high_freq, etc.}', required: false },
      sample_rate: { type: 'number', description: 'Sample rate in Hz', required: true },
    },
    tier: 'free',
    async execute(args) {
      const signalStr = String(args.signal)
      const operation = String(args.operation).toLowerCase()
      const sampleRate = Number(args.sample_rate)
      let params: Record<string, unknown> = {}
      if (args.params) {
        try { params = JSON.parse(String(args.params)) } catch { return '**Error**: Invalid JSON in params.' }
      }

      const signal = signalStr.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n))
      if (signal.length === 0) return '**Error**: Empty or invalid signal data.'

      const lines: string[] = ['## Signal Processing']
      lines.push('')
      lines.push(`- Samples: ${signal.length}`)
      lines.push(`- Sample rate: ${sampleRate} Hz`)
      lines.push(`- Duration: ${fmtUnit(signal.length / sampleRate, 's')}`)
      lines.push('')

      if (operation === 'fft') {
        const padded = padToPow2(signal)
        const spectrum = fft(padded)
        const N = padded.length
        const freqResolution = sampleRate / N

        lines.push('### FFT Spectrum')
        lines.push('')
        lines.push(`| Bin | Frequency (Hz) | Magnitude | Phase (\u00b0) |`)
        lines.push(`|---|---|---|---|`)

        const halfN = Math.floor(N / 2)
        // Show up to 32 bins
        const showBins = Math.min(halfN, 32)
        for (let k = 0; k < showBins; k++) {
          const freq_k = k * freqResolution
          const mag = Math.sqrt(cAbs2(spectrum[k])) / N
          const phase = Math.atan2(spectrum[k].im, spectrum[k].re) * 180 / Math.PI
          if (mag > 1e-10) {
            lines.push(`| ${k} | ${fmtUnit(freq_k, 'Hz')} | ${fmt(mag)} | ${fmt(phase)} |`)
          }
        }
        if (halfN > 32) lines.push(`| ... | (${halfN - 32} more bins) | | |`)

        // Dominant frequency
        let maxMag = 0, maxBin = 0
        for (let k = 1; k < halfN; k++) {
          const mag = cAbs2(spectrum[k])
          if (mag > maxMag) { maxMag = mag; maxBin = k }
        }
        lines.push('')
        lines.push(`**Dominant frequency**: ${fmtUnit(maxBin * freqResolution, 'Hz')} (bin ${maxBin}, magnitude ${fmt(Math.sqrt(maxMag) / N)})`)
        lines.push(`**Frequency resolution**: ${fmtUnit(freqResolution, 'Hz')}`)
      }

      else if (operation === 'lowpass' || operation === 'highpass' || operation === 'bandpass') {
        const cutoff = (params.cutoff_freq as number) || sampleRate / 4
        const lowFreq = (params.low_freq as number) || cutoff * 0.8
        const highFreq = (params.high_freq as number) || cutoff * 1.2
        const order = (params.order as number) || 21  // FIR filter order (must be odd)

        // Design FIR filter via windowed sinc method
        const M = order % 2 === 0 ? order + 1 : order
        const halfM = Math.floor(M / 2)
        const window = hammingWindow(M)

        let kernel: number[]
        if (operation === 'lowpass') {
          const fc = cutoff / sampleRate // normalized cutoff
          kernel = Array.from({ length: M }, (_, n) => {
            if (n === halfM) return 2 * fc
            const x = n - halfM
            return Math.sin(2 * Math.PI * fc * x) / (Math.PI * x)
          })
        } else if (operation === 'highpass') {
          const fc = cutoff / sampleRate
          kernel = Array.from({ length: M }, (_, n) => {
            if (n === halfM) return 1 - 2 * fc
            const x = n - halfM
            return -Math.sin(2 * Math.PI * fc * x) / (Math.PI * x)
          })
        } else {
          // Bandpass = lowpass(high) - lowpass(low)
          const fcLow = lowFreq / sampleRate
          const fcHigh = highFreq / sampleRate
          kernel = Array.from({ length: M }, (_, n) => {
            if (n === halfM) return 2 * (fcHigh - fcLow)
            const x = n - halfM
            return (Math.sin(2 * Math.PI * fcHigh * x) - Math.sin(2 * Math.PI * fcLow * x)) / (Math.PI * x)
          })
        }

        // Apply window
        kernel = kernel.map((v, i) => v * window[i])
        // Normalize
        const sum = kernel.reduce((a, b) => a + b, 0)
        if (operation !== 'highpass' && Math.abs(sum) > 1e-10) {
          kernel = kernel.map(v => v / sum)
        }

        // Convolve signal with kernel
        const output: number[] = []
        for (let i = 0; i < signal.length; i++) {
          let val = 0
          for (let j = 0; j < kernel.length; j++) {
            const idx = i - halfM + j
            if (idx >= 0 && idx < signal.length) {
              val += signal[idx] * kernel[j]
            }
          }
          output.push(val)
        }

        lines.push(`### ${operation.charAt(0).toUpperCase() + operation.slice(1)} Filter`)
        lines.push('')
        if (operation === 'bandpass') {
          lines.push(`- Pass band: ${fmtUnit(lowFreq, 'Hz')} \u2013 ${fmtUnit(highFreq, 'Hz')}`)
        } else {
          lines.push(`- Cutoff frequency: ${fmtUnit(cutoff, 'Hz')}`)
        }
        lines.push(`- Filter order: ${M}`)
        lines.push(`- Window: Hamming`)
        lines.push('')

        // Show first 50 output samples
        const showN = Math.min(output.length, 50)
        lines.push('### Filtered Output (first ' + showN + ' samples)')
        lines.push('')
        lines.push('```')
        lines.push(output.slice(0, showN).map(v => v.toFixed(6)).join(', '))
        lines.push('```')

        // Statistics
        const maxVal = Math.max(...output.map(Math.abs))
        const rms = Math.sqrt(output.reduce((a, v) => a + v * v, 0) / output.length)
        lines.push('')
        lines.push(`- Peak amplitude: ${fmt(maxVal)}`)
        lines.push(`- RMS: ${fmt(rms)}`)
      }

      else if (operation === 'convolve') {
        const kernelStr = params.kernel as string || ''
        const kernel = kernelStr.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n))
        if (kernel.length === 0) return '**Error**: Provide params.kernel as comma-separated values.'

        // Full convolution
        const outLen = signal.length + kernel.length - 1
        const output: number[] = new Array(outLen).fill(0)
        for (let i = 0; i < signal.length; i++) {
          for (let j = 0; j < kernel.length; j++) {
            output[i + j] += signal[i] * kernel[j]
          }
        }

        lines.push('### Convolution')
        lines.push('')
        lines.push(`- Signal length: ${signal.length}`)
        lines.push(`- Kernel length: ${kernel.length}`)
        lines.push(`- Output length: ${outLen}`)
        lines.push('')
        const showN = Math.min(output.length, 60)
        lines.push('```')
        lines.push(output.slice(0, showN).map(v => v.toFixed(6)).join(', '))
        if (outLen > showN) lines.push(`... (${outLen - showN} more values)`)
        lines.push('```')
      }

      else if (operation === 'autocorrelation') {
        // Normalized autocorrelation via FFT
        const N = nextPow2(signal.length * 2)
        const padded: Complex[] = signal.map(v => ({ re: v, im: 0 }))
        while (padded.length < N) padded.push({ re: 0, im: 0 })

        const spectrum = fft(padded)
        // Power spectrum = |X(f)|^2
        const power = spectrum.map(z => ({ re: cAbs2(z), im: 0 }))
        // IFFT of power spectrum
        const acf = ifft(power)

        // Normalize by acf[0]
        const acf0 = acf[0].re
        const normalizedAcf = acf.slice(0, signal.length).map(z => z.re / acf0)

        lines.push('### Autocorrelation')
        lines.push('')
        const showN = Math.min(normalizedAcf.length, 40)
        lines.push(`| Lag | Time (s) | R(lag) |`)
        lines.push(`|---|---|---|`)
        for (let i = 0; i < showN; i++) {
          lines.push(`| ${i} | ${fmtUnit(i / sampleRate, 's')} | ${fmt(normalizedAcf[i])} |`)
        }

        // Find first zero crossing for periodicity estimate
        let firstZero = -1
        for (let i = 1; i < normalizedAcf.length - 1; i++) {
          if (normalizedAcf[i] * normalizedAcf[i + 1] < 0) { firstZero = i; break }
        }
        if (firstZero > 0) {
          lines.push('')
          lines.push(`**First zero crossing**: lag ${firstZero} (${fmtUnit(firstZero / sampleRate, 's')})`)
          lines.push(`**Estimated period**: ~${fmtUnit(2 * firstZero / sampleRate, 's')} (${fmtUnit(sampleRate / (2 * firstZero), 'Hz')})`)
        }
      }

      else if (operation === 'window') {
        const windowType = (params.window_type as string || 'hamming').toLowerCase()
        const N = signal.length
        let window: number[]

        switch (windowType) {
          case 'hamming':  window = hammingWindow(N); break
          case 'hanning':
          case 'hann':     window = hanningWindow(N); break
          case 'blackman': window = blackmanWindow(N); break
          default: return `**Error**: Unknown window type "${windowType}". Options: hamming, hanning, blackman`
        }

        const windowed = signal.map((v, i) => v * window[i])

        lines.push(`### ${windowType.charAt(0).toUpperCase() + windowType.slice(1)} Window`)
        lines.push('')
        const showN = Math.min(N, 50)
        lines.push('#### Window coefficients (first ' + showN + ')')
        lines.push('```')
        lines.push(window.slice(0, showN).map(v => v.toFixed(6)).join(', '))
        lines.push('```')
        lines.push('')
        lines.push('#### Windowed signal (first ' + showN + ')')
        lines.push('```')
        lines.push(windowed.slice(0, showN).map(v => v.toFixed(6)).join(', '))
        lines.push('```')
      }

      else {
        return `**Error**: Unknown operation "${operation}". Options: fft, lowpass, highpass, bandpass, convolve, autocorrelation, window`
      }

      return lines.join('\n')
    },
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. PARTICLE PHYSICS DATA
  // ═══════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'particle_physics_data',
    description: 'Look up particle properties from embedded PDG data. ~73 particles: leptons, quarks, gauge bosons, Higgs, mesons (pions, kaons, D, B, J/psi, Upsilon), baryons (proton, neutron, Lambda, Sigma, Xi, Omega, charmed/bottom baryons, Xi_cc+ doubly charmed baryon confirmed March 2026).',
    parameters: {
      particle: { type: 'string', description: 'Particle name, symbol, or key (e.g. "electron", "pi+", "J/psi", "higgs", "omega_minus")', required: true },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.particle).trim()

      // Try exact lookup first
      let p = lookupParticle(query)

      // Fuzzy search if not found
      if (!p) {
        const lowerQuery = query.toLowerCase()
        const candidates = Object.entries(PARTICLES).filter(([key, part]) =>
          key.includes(lowerQuery) ||
          part.name.toLowerCase().includes(lowerQuery) ||
          part.symbol.toLowerCase().includes(lowerQuery) ||
          (part.quark_content && part.quark_content.toLowerCase().includes(lowerQuery))
        )
        if (candidates.length === 1) {
          p = candidates[0][1]
        } else if (candidates.length > 1) {
          const lines = [`**Multiple matches for "${query}"**:`, '']
          for (const [key, part] of candidates) {
            lines.push(`- **${part.symbol}** (${part.name}) \u2014 key: \`${key}\``)
          }
          lines.push('')
          lines.push('Please specify one of the above keys.')
          return lines.join('\n')
        }
      }

      if (!p) {
        // List all categories
        const categories = new Map<string, string[]>()
        for (const [key, part] of Object.entries(PARTICLES)) {
          if (!categories.has(part.category)) categories.set(part.category, [])
          categories.get(part.category)!.push(`${part.symbol} (\`${key}\`)`)
        }
        const lines = [`**Particle "${query}" not found.** Available particles:`, '']
        for (const [cat, parts] of categories) {
          lines.push(`### ${cat}s`)
          lines.push(parts.join(', '))
          lines.push('')
        }
        return lines.join('\n')
      }

      const lines: string[] = [`## ${p.symbol} \u2014 ${p.name}`]
      lines.push('')
      lines.push(`| Property | Value |`)
      lines.push(`|---|---|`)
      lines.push(`| Category | ${p.category} |`)
      lines.push(`| Symbol | ${p.symbol} |`)
      if (p.mass_MeV !== null) {
        lines.push(`| Mass | ${fmtUnit(p.mass_MeV, 'MeV/c\u00b2')} |`)
        if (p.mass_MeV > 1000) {
          lines.push(`| Mass | ${fmtUnit(p.mass_MeV / 1000, 'GeV/c\u00b2')} |`)
        }
        lines.push(`| Mass (kg) | ${fmtUnit(p.mass_MeV * MeV / (c * c), 'kg')} |`)
      } else {
        lines.push(`| Mass | 0 (massless) |`)
      }
      lines.push(`| Charge | ${p.charge > 0 ? '+' : ''}${p.charge === Math.floor(p.charge) ? p.charge.toString() : (p.charge > 0 ? '+' : '') + (Math.abs(p.charge) === 1/3 ? (p.charge > 0 ? '1/3' : '-1/3') : (p.charge > 0 ? '2/3' : '-2/3'))} e |`)
      lines.push(`| Spin | ${p.spin} |`)

      if (p.lifetime_s === Infinity) {
        lines.push(`| Lifetime | Stable |`)
      } else if (p.lifetime_s !== null) {
        lines.push(`| Lifetime | ${fmtUnit(p.lifetime_s, 's')} |`)
        if (p.lifetime_s > 0) {
          lines.push(`| c\u03c4 | ${fmtUnit(p.lifetime_s * c, 'm')} |`)
        }
      } else {
        lines.push(`| Lifetime | Mixes (see decay modes) |`)
      }

      if (p.quark_content) lines.push(`| Quark content | ${p.quark_content} |`)
      if (p.color_charge) lines.push(`| Color charge | ${p.color_charge} |`)
      if (p.isAntiparticle) lines.push(`| Antiparticle | Yes |`)

      if (p.decay_modes && p.decay_modes.length > 0) {
        lines.push('')
        lines.push('### Decay Modes')
        lines.push('')
        for (const mode of p.decay_modes) {
          lines.push(`- ${mode}`)
        }
      }

      return lines.join('\n')
    },
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. RELATIVITY CALCULATOR
  // ═══════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'relativity_calc',
    description: 'Special & general relativity: time dilation, length contraction, relativistic energy/momentum, Schwarzschild radius, gravitational time dilation, relativistic Doppler effect.',
    parameters: {
      calculation: { type: 'string', description: 'Calculation: time_dilation, length_contraction, energy, momentum, schwarzschild, grav_time_dilation, doppler', required: true },
      velocity: { type: 'number', description: 'Velocity as fraction of c (0-1) or m/s if > 1', required: true },
      mass: { type: 'number', description: 'Mass in kg (for energy/schwarzschild calculations)', required: false },
      params: { type: 'string', description: 'Additional JSON params: {proper_time, proper_length, distance, mass_body}', required: false },
    },
    tier: 'free',
    async execute(args) {
      const calc = String(args.calculation).toLowerCase()
      let v = Number(args.velocity)
      const mass = args.mass ? Number(args.mass) : undefined
      let params: Record<string, unknown> = {}
      if (args.params) {
        try { params = JSON.parse(String(args.params)) } catch { /* ignore */ }
      }

      // Interpret velocity: if > 1, assume m/s; otherwise fraction of c
      let beta: number
      if (v > 1) {
        beta = v / c
      } else {
        beta = v
        v = beta * c
      }

      if (beta >= 1) return '**Error**: Velocity must be less than c (speed of light). Massive objects cannot reach c.'

      const gamma = 1 / Math.sqrt(1 - beta * beta)

      const lines: string[] = ['## Relativistic Calculations']
      lines.push('')
      lines.push(`| Parameter | Value |`)
      lines.push(`|---|---|`)
      lines.push(`| Velocity | ${fmtUnit(v, 'm/s')} |`)
      lines.push(`| \u03b2 (v/c) | ${fmt(beta)} |`)
      lines.push(`| \u03b3 (Lorentz factor) | ${fmt(gamma)} |`)

      if (calc === 'time_dilation') {
        const properTime = (params.proper_time as number) || 1  // default 1 second
        const dilatedTime = properTime * gamma

        lines.push('')
        lines.push('### Time Dilation')
        lines.push('')
        lines.push(`| Quantity | Value |`)
        lines.push(`|---|---|`)
        lines.push(`| Proper time (\u0394\u03c4) | ${fmtUnit(properTime, 's')} |`)
        lines.push(`| Dilated time (\u0394t) | ${fmtUnit(dilatedTime, 's')} |`)
        lines.push(`| Ratio \u0394t/\u0394\u03c4 | ${fmt(gamma)} |`)
        lines.push('')
        lines.push(`**Formula**: \u0394t = \u03b3 \u00d7 \u0394\u03c4`)
        lines.push('')
        lines.push(`A clock moving at ${fmt(beta)}c runs ${fmt(gamma)} times slower as observed from the rest frame.`)
      }

      else if (calc === 'length_contraction') {
        const properLength = (params.proper_length as number) || 1  // default 1 meter
        const contractedLength = properLength / gamma

        lines.push('')
        lines.push('### Length Contraction')
        lines.push('')
        lines.push(`| Quantity | Value |`)
        lines.push(`|---|---|`)
        lines.push(`| Proper length (L\u2080) | ${fmtUnit(properLength, 'm')} |`)
        lines.push(`| Contracted length (L) | ${fmtUnit(contractedLength, 'm')} |`)
        lines.push(`| Ratio L/L\u2080 | ${fmt(1 / gamma)} |`)
        lines.push('')
        lines.push(`**Formula**: L = L\u2080 / \u03b3`)
      }

      else if (calc === 'energy') {
        if (!mass) return '**Error**: Mass (kg) required for energy calculation.'

        const E_rest = mass * c * c
        const E_total = gamma * E_rest
        const E_kinetic = E_total - E_rest

        lines.push('')
        lines.push('### Relativistic Energy')
        lines.push('')
        lines.push(`| Quantity | Value |`)
        lines.push(`|---|---|`)
        lines.push(`| Mass | ${fmtUnit(mass, 'kg')} |`)
        lines.push(`| Rest energy (E\u2080 = mc\u00b2) | ${fmtUnit(E_rest, 'J')} (${fmtUnit(E_rest / eV, 'eV')}) |`)
        lines.push(`| Total energy (E = \u03b3mc\u00b2) | ${fmtUnit(E_total, 'J')} (${fmtUnit(E_total / eV, 'eV')}) |`)
        lines.push(`| Kinetic energy (E_k) | ${fmtUnit(E_kinetic, 'J')} (${fmtUnit(E_kinetic / eV, 'eV')}) |`)
        lines.push(`| Classical K.E. (\u00bdmv\u00b2) | ${fmtUnit(0.5 * mass * v * v, 'J')} |`)
        lines.push(`| Relativistic correction | ${fmt(E_kinetic / (0.5 * mass * v * v))} \u00d7 classical |`)
      }

      else if (calc === 'momentum') {
        if (!mass) return '**Error**: Mass (kg) required for momentum calculation.'

        const p_rel = gamma * mass * v
        const p_class = mass * v
        const E_total = gamma * mass * c * c

        lines.push('')
        lines.push('### Relativistic Momentum')
        lines.push('')
        lines.push(`| Quantity | Value |`)
        lines.push(`|---|---|`)
        lines.push(`| Relativistic p = \u03b3mv | ${fmtUnit(p_rel, 'kg\u00b7m/s')} |`)
        lines.push(`| Classical p = mv | ${fmtUnit(p_class, 'kg\u00b7m/s')} |`)
        lines.push(`| Ratio | ${fmt(gamma)} |`)
        lines.push(`| E\u00b2 = (pc)\u00b2 + (mc\u00b2)\u00b2 check | ${fmt(E_total)} = ${fmt(Math.sqrt((p_rel * c) ** 2 + (mass * c * c) ** 2))} |`)
      }

      else if (calc === 'schwarzschild') {
        const m = mass || (params.mass_body as number) || SOLAR_MASS
        const r_s = 2 * G * m / (c * c)

        lines.push('')
        lines.push('### Schwarzschild Radius')
        lines.push('')
        lines.push(`| Quantity | Value |`)
        lines.push(`|---|---|`)
        lines.push(`| Mass | ${fmtUnit(m, 'kg')} (${fmtUnit(m / SOLAR_MASS, 'M\u2609')}) |`)
        lines.push(`| Schwarzschild radius | ${fmtUnit(r_s, 'm')} |`)
        lines.push(`| r_s | ${fmtUnit(r_s / 1000, 'km')} |`)
        lines.push(`| Surface gravity | ${fmtUnit(c ** 4 / (4 * G * m), 'm/s\u00b2')} |`)
        lines.push(`| Hawking temperature | ${fmtUnit(hbar * c ** 3 / (8 * Math.PI * G * m * k_B), 'K')} |`)
        lines.push('')
        lines.push(`**Formula**: r_s = 2GM/c\u00b2`)

        // Compare to known objects
        if (m === SOLAR_MASS) {
          lines.push('')
          lines.push('For reference: the Sun\'s Schwarzschild radius is ~3 km (Sun\'s actual radius: 696,340 km)')
        }
      }

      else if (calc === 'grav_time_dilation') {
        const M = mass || (params.mass_body as number) || BODIES.earth.mass
        const r = (params.distance as number) || BODIES.earth.radius

        // Gravitational time dilation: dt_far / dt_near = 1/sqrt(1 - 2GM/(rc^2))
        const factor = Math.sqrt(1 - 2 * G * M / (r * c * c))
        const properTime = (params.proper_time as number) || 1

        lines.push('')
        lines.push('### Gravitational Time Dilation')
        lines.push('')
        lines.push(`| Quantity | Value |`)
        lines.push(`|---|---|`)
        lines.push(`| Mass | ${fmtUnit(M, 'kg')} |`)
        lines.push(`| Distance from center | ${fmtUnit(r, 'm')} |`)
        lines.push(`| r_s / r | ${fmt(2 * G * M / (r * c * c))} |`)
        lines.push(`| Time dilation factor | ${fmt(factor)} |`)
        lines.push(`| ${fmtUnit(properTime, 's')} at r = | ${fmtUnit(properTime / factor, 's')} at \u221e |`)
        lines.push('')
        lines.push('A clock at distance r runs slower by this factor compared to a clock infinitely far away.')
      }

      else if (calc === 'doppler') {
        // Relativistic Doppler effect
        // Approaching: f_obs = f_source * sqrt((1+beta)/(1-beta))
        // Receding: f_obs = f_source * sqrt((1-beta)/(1+beta))
        const approaching = (params.approaching as boolean) !== false  // default true

        const ratio_approach = Math.sqrt((1 + beta) / (1 - beta))
        const ratio_recede = Math.sqrt((1 - beta) / (1 + beta))

        // Transverse Doppler (perpendicular): f_obs = f_source / gamma
        const ratio_transverse = 1 / gamma

        lines.push('')
        lines.push('### Relativistic Doppler Effect')
        lines.push('')
        lines.push(`| Scenario | f_obs / f_source | Wavelength shift |`)
        lines.push(`|---|---|---|`)
        lines.push(`| Approaching | ${fmt(ratio_approach)} | Blueshift (${fmt((ratio_approach - 1) * 100)}%) |`)
        lines.push(`| Receding | ${fmt(ratio_recede)} | Redshift (${fmt((1 - ratio_recede) * 100)}%) |`)
        lines.push(`| Transverse | ${fmt(ratio_transverse)} | Redshift (${fmt((1 - ratio_transverse) * 100)}%) |`)
        lines.push('')
        lines.push(`**Note**: Transverse Doppler is a purely relativistic effect (no classical analogue).`)

        const sourceFreq = params.source_freq as number
        if (sourceFreq) {
          lines.push('')
          lines.push(`For source frequency ${fmtUnit(sourceFreq, 'Hz')}:`)
          lines.push(`- Approaching: ${fmtUnit(sourceFreq * ratio_approach, 'Hz')}`)
          lines.push(`- Receding: ${fmtUnit(sourceFreq * ratio_recede, 'Hz')}`)
        }
      }

      else {
        return `**Error**: Unknown calculation "${calc}". Options: time_dilation, length_contraction, energy, momentum, schwarzschild, grav_time_dilation, doppler`
      }

      return lines.join('\n')
    },
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. QUANTUM STATE SIMULATOR
  // ═══════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'quantum_state',
    description: 'Quantum state vector simulator for up to 8 qubits. Initialize states, apply gates (H, X, Y, Z, CNOT, T, S, SWAP, Toffoli), and measure. Full complex amplitude simulation.',
    parameters: {
      n_qubits: { type: 'number', description: 'Number of qubits (1-8)', required: true },
      initial_state: { type: 'string', description: 'Initial state as binary string (e.g. "00", "101") or "0" for all-zero', required: false },
      gates: { type: 'string', description: 'JSON array of gates: [{gate:"H", qubit:0}, {gate:"CNOT", control:0, target:1}, ...]', required: true },
      measure: { type: 'string', description: 'Whether to simulate measurement (true/false)', required: false },
    },
    tier: 'free',
    async execute(args) {
      const nQubits = Math.min(Math.max(Number(args.n_qubits) || 1, 1), 8)
      const dim = 1 << nQubits  // 2^n
      const initialStr = String(args.initial_state || '0')
      const shouldMeasure = String(args.measure || 'false').toLowerCase() === 'true'

      let gateOps: Array<Record<string, unknown>>
      try {
        gateOps = JSON.parse(String(args.gates))
      } catch {
        return '**Error**: Invalid JSON in gates parameter. Expected: [{gate:"H", qubit:0}, ...]'
      }

      // Initialize state vector
      let state: Complex[] = Array.from({ length: dim }, () => ({ re: 0, im: 0 }))

      // Parse initial state
      let initIdx = 0
      if (initialStr.length === nQubits && /^[01]+$/.test(initialStr)) {
        initIdx = parseInt(initialStr, 2)
      } else if (/^\d+$/.test(initialStr)) {
        initIdx = parseInt(initialStr, 10)
      }
      if (initIdx >= dim) initIdx = 0
      state[initIdx] = { re: 1, im: 0 }

      const lines: string[] = ['## Quantum State Simulation']
      lines.push('')
      lines.push(`- Qubits: ${nQubits}`)
      lines.push(`- Hilbert space dimension: ${dim}`)
      lines.push(`- Initial state: |${initIdx.toString(2).padStart(nQubits, '0')}\u27e9`)
      lines.push('')

      // Apply gates
      lines.push('### Gate Sequence')
      lines.push('')

      for (const op of gateOps) {
        const gateName = String(op.gate || '').toUpperCase()
        const qubit = op.qubit !== undefined ? Number(op.qubit) : undefined
        const control = op.control !== undefined ? Number(op.control) : undefined
        const target = op.target !== undefined ? Number(op.target) : undefined

        let gateDescription = ''

        if (['H', 'X', 'Y', 'Z', 'T', 'S'].includes(gateName) && qubit !== undefined) {
          const gateMap: Record<string, GateMatrix> = { H: GATE_H, X: GATE_X, Y: GATE_Y, Z: GATE_Z, T: GATE_T, S: GATE_S }
          const fullGate = buildSingleQubitGate(gateMap[gateName], qubit, nQubits)
          state = applyMatrix(fullGate, state)
          gateDescription = `${gateName} on qubit ${qubit}`
        }

        else if (gateName === 'CNOT' && control !== undefined && target !== undefined) {
          if (Math.abs(control - target) === 1) {
            const fullGate = buildTwoQubitGate(GATE_CNOT, control, target, nQubits)
            state = applyMatrix(fullGate, state)
          } else {
            // Non-adjacent: decompose via SWAP routing
            // For simplicity with small qubit counts, build the matrix directly
            const fullGate: GateMatrix = Array.from({ length: dim }, (_, i) =>
              Array.from({ length: dim }, (_, j) => ({ re: i === j ? 1 : 0, im: 0 }))
            )
            // CNOT flips target bit when control bit is 1
            for (let i = 0; i < dim; i++) {
              const controlBit = (i >> (nQubits - 1 - control)) & 1
              if (controlBit === 1) {
                const flipped = i ^ (1 << (nQubits - 1 - target))
                fullGate[i][i] = { re: 0, im: 0 }
                fullGate[i][flipped] = { re: 1, im: 0 }
              }
            }
            state = applyMatrix(fullGate, state)
          }
          gateDescription = `CNOT(control=${control}, target=${target})`
        }

        else if (gateName === 'SWAP' && control !== undefined && target !== undefined) {
          if (Math.abs(control - target) === 1) {
            const fullGate = buildTwoQubitGate(GATE_SWAP, control, target, nQubits)
            state = applyMatrix(fullGate, state)
          } else {
            // Direct matrix for non-adjacent SWAP
            const fullGate: GateMatrix = Array.from({ length: dim }, (_, i) =>
              Array.from({ length: dim }, (_, j) => ({ re: i === j ? 1 : 0, im: 0 }))
            )
            for (let i = 0; i < dim; i++) {
              const bit1 = (i >> (nQubits - 1 - control)) & 1
              const bit2 = (i >> (nQubits - 1 - target)) & 1
              if (bit1 !== bit2) {
                const swapped = i ^ (1 << (nQubits - 1 - control)) ^ (1 << (nQubits - 1 - target))
                fullGate[i][i] = { re: 0, im: 0 }
                fullGate[i][swapped] = { re: 1, im: 0 }
              }
            }
            state = applyMatrix(fullGate, state)
          }
          gateDescription = `SWAP(${control}, ${target})`
        }

        else if (gateName === 'TOFFOLI' || gateName === 'CCX') {
          const c0 = control !== undefined ? control : Number(op.control1 ?? 0)
          const c1 = target !== undefined ? target : Number(op.control2 ?? 1)
          const tgt = op.target !== undefined ? Number(op.target) : Number(op.qubit ?? 2)

          // Build directly for arbitrary qubit positions
          const fullGate: GateMatrix = Array.from({ length: dim }, (_, i) =>
            Array.from({ length: dim }, (_, j) => ({ re: i === j ? 1 : 0, im: 0 }))
          )
          for (let i = 0; i < dim; i++) {
            const cb0 = (i >> (nQubits - 1 - c0)) & 1
            const cb1 = (i >> (nQubits - 1 - c1)) & 1
            if (cb0 === 1 && cb1 === 1) {
              const flipped = i ^ (1 << (nQubits - 1 - tgt))
              fullGate[i][i] = { re: 0, im: 0 }
              fullGate[i][flipped] = { re: 1, im: 0 }
            }
          }
          state = applyMatrix(fullGate, state)
          gateDescription = `Toffoli(c0=${c0}, c1=${c1}, target=${tgt})`
        }

        else {
          lines.push(`- **?** Unknown gate "${gateName}" \u2014 skipped`)
          continue
        }

        lines.push(`- ${gateDescription}`)
      }

      // Display final state
      lines.push('')
      lines.push('### Final State Vector')
      lines.push('')
      lines.push(`| Basis State | Amplitude | Probability |`)
      lines.push(`|---|---|---|`)

      const probabilities: { state: string; prob: number }[] = []
      for (let i = 0; i < dim; i++) {
        const prob = cAbs2(state[i])
        if (prob > 1e-10) {
          const basisStr = `|${i.toString(2).padStart(nQubits, '0')}\u27e9`
          lines.push(`| ${basisStr} | ${cFmt(state[i])} | ${(prob * 100).toFixed(4)}% |`)
          probabilities.push({ state: i.toString(2).padStart(nQubits, '0'), prob })
        }
      }

      // Verify normalization
      const totalProb = probabilities.reduce((s, p) => s + p.prob, 0)
      lines.push('')
      lines.push(`**Total probability**: ${fmt(totalProb)} ${Math.abs(totalProb - 1) < 1e-6 ? '(normalized)' : '(WARNING: not normalized!)'}`)

      // Entanglement detection (simple: check if state is separable)
      if (nQubits === 2) {
        // For 2 qubits, check if |psi> = |a>|b> via concurrence
        const a = state[0], b = state[1], cc = state[2], d = state[3]
        const concurrence = 2 * Math.abs(a.re * d.re + a.im * d.im - b.re * cc.re - b.im * cc.im
          + (a.re * d.im - a.im * d.re - b.re * cc.im + b.im * cc.re))
        lines.push(`**Concurrence**: ${fmt(concurrence)} ${concurrence > 0.01 ? '(entangled)' : '(separable)'}`)
      }

      // Simulated measurement
      if (shouldMeasure) {
        lines.push('')
        lines.push('### Measurement')
        lines.push('')
        // Weighted random selection
        const rand = Math.random()
        let cumulative = 0
        let measured = probabilities[0]?.state || '0'.repeat(nQubits)
        for (const p of probabilities) {
          cumulative += p.prob
          if (rand < cumulative) { measured = p.state; break }
        }
        lines.push(`**Measured outcome**: |${measured}\u27e9`)
        lines.push('')
        lines.push('Probability distribution:')
        for (const p of probabilities) {
          const bar = '\u2588'.repeat(Math.round(p.prob * 40))
          lines.push(`  |${p.state}\u27e9 ${bar} ${(p.prob * 100).toFixed(2)}%`)
        }
      }

      return lines.join('\n')
    },
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. BEAM ANALYSIS
  // ═══════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'beam_analysis',
    description: 'Structural beam analysis using Euler-Bernoulli theory. Simply supported, cantilever, and fixed-fixed beams. Point loads, distributed loads, moments. Outputs reactions, shear/moment diagrams, max deflection.',
    parameters: {
      beam_type: { type: 'string', description: 'Beam type: simply_supported, cantilever, fixed_fixed', required: true },
      length: { type: 'number', description: 'Beam length in meters', required: true },
      loads: { type: 'string', description: 'JSON array of loads: [{type:"point", magnitude:1000, position:2.5}, {type:"distributed", magnitude:500, position:0, end_position:5}]', required: true },
      material: { type: 'string', description: 'Material name (steel, aluminum, timber, concrete) or JSON {E, I}', required: false },
    },
    tier: 'free',
    async execute(args) {
      const beamType = String(args.beam_type).toLowerCase().replace(/[\s-]/g, '_')
      const L = Number(args.length)
      let loads: BeamLoad[]
      try {
        loads = JSON.parse(String(args.loads))
      } catch {
        return '**Error**: Invalid JSON in loads parameter.'
      }

      // Parse material
      let mat: BeamMaterial = DEFAULT_MATERIALS.steel
      if (args.material) {
        const matStr = String(args.material).toLowerCase()
        if (DEFAULT_MATERIALS[matStr]) {
          mat = DEFAULT_MATERIALS[matStr]
        } else {
          try {
            mat = JSON.parse(String(args.material))
          } catch { /* use default */ }
        }
      }

      const EI = mat.E * mat.I

      const lines: string[] = ['## Beam Analysis']
      lines.push('')
      lines.push(`| Parameter | Value |`)
      lines.push(`|---|---|`)
      lines.push(`| Beam type | ${beamType.replace(/_/g, ' ')} |`)
      lines.push(`| Length | ${fmtUnit(L, 'm')} |`)
      lines.push(`| E (Young\'s modulus) | ${fmtUnit(mat.E, 'Pa')} (${fmtUnit(mat.E / 1e9, 'GPa')}) |`)
      lines.push(`| I (Second moment) | ${fmtUnit(mat.I, 'm\u2074')} |`)
      lines.push(`| EI | ${fmtUnit(EI, 'N\u00b7m\u00b2')} |`)

      // Applied loads
      lines.push('')
      lines.push('### Applied Loads')
      lines.push('')
      for (let i = 0; i < loads.length; i++) {
        const load = loads[i]
        if (load.type === 'point') {
          lines.push(`- Point load: ${fmtUnit(load.magnitude, 'N')} at x = ${fmtUnit(load.position, 'm')}`)
        } else if (load.type === 'distributed') {
          lines.push(`- Distributed load: ${fmtUnit(load.magnitude, 'N/m')} from x = ${fmtUnit(load.position, 'm')} to x = ${fmtUnit(load.end_position || L, 'm')}`)
        } else if (load.type === 'moment') {
          lines.push(`- Applied moment: ${fmtUnit(load.magnitude, 'N\u00b7m')} at x = ${fmtUnit(load.position, 'm')}`)
        }
      }

      // Calculate reactions and internal forces using superposition
      let R_A = 0, R_B = 0, M_A = 0, M_B = 0

      // Shear force and bending moment at N points
      const N_POINTS = 51
      const dx = L / (N_POINTS - 1)
      const shear: number[] = new Array(N_POINTS).fill(0)
      const moment: number[] = new Array(N_POINTS).fill(0)
      const deflection: number[] = new Array(N_POINTS).fill(0)

      if (beamType === 'simply_supported') {
        // Sum of forces and moments about A
        for (const load of loads) {
          if (load.type === 'point') {
            const P = load.magnitude
            const a = load.position
            // R_B*L = P*a => R_B = P*a/L, R_A = P*(L-a)/L
            R_B += P * a / L
            R_A += P * (L - a) / L

            // Shear and moment
            for (let i = 0; i < N_POINTS; i++) {
              const x = i * dx
              if (x < a) {
                shear[i] += P * (L - a) / L
                moment[i] += P * (L - a) / L * x
              } else {
                shear[i] += -P * a / L
                moment[i] += P * a / L * (L - x)
              }
              // Deflection: standard formula for point load on SS beam
              if (x <= a) {
                deflection[i] += -P * (L - a) * x * (L * L - (L - a) * (L - a) - x * x) / (6 * EI * L)
              } else {
                deflection[i] += -P * a * (L - x) * (L * L - a * a - (L - x) * (L - x)) / (6 * EI * L)
              }
            }
          }

          else if (load.type === 'distributed') {
            const w = load.magnitude
            const a = load.position
            const b = load.end_position || L
            const loadLen = b - a
            const W = w * loadLen // total force
            const centroid = a + loadLen / 2

            R_B += W * centroid / L
            R_A += W * (L - centroid) / L

            for (let i = 0; i < N_POINTS; i++) {
              const x = i * dx
              // Reaction contribution
              const ra = W * (L - centroid) / L

              if (x <= a) {
                shear[i] += ra
                moment[i] += ra * x
              } else if (x <= b) {
                const loaded = x - a
                shear[i] += ra - w * loaded
                moment[i] += ra * x - w * loaded * loaded / 2
              } else {
                shear[i] += ra - W
                moment[i] += ra * x - W * (x - centroid)
              }

              // Deflection for UDL on full span (simplified for full-span case)
              if (a === 0 && b === L) {
                deflection[i] += -w * x * (L * L * L - 2 * L * x * x + x * x * x) / (24 * EI)
              }
            }
          }

          else if (load.type === 'moment') {
            const M = load.magnitude
            const a = load.position
            R_A += -M / L
            R_B += M / L

            for (let i = 0; i < N_POINTS; i++) {
              const x = i * dx
              if (x < a) {
                shear[i] += -M / L
                moment[i] += -M * x / L
              } else {
                shear[i] += -M / L
                moment[i] += M * (1 - x / L)
              }
            }
          }
        }
      }

      else if (beamType === 'cantilever') {
        // Fixed at A (x=0), free at B (x=L)
        for (const load of loads) {
          if (load.type === 'point') {
            const P = load.magnitude
            const a = load.position
            R_A += P
            M_A += -P * a

            for (let i = 0; i < N_POINTS; i++) {
              const x = i * dx
              if (x < a) {
                shear[i] += P
                moment[i] += -P * (a - x)
              }
              // else: shear = 0, moment = 0 beyond load
              // Deflection
              if (x <= a) {
                deflection[i] += -P * x * x * (3 * a - x) / (6 * EI)
              } else {
                deflection[i] += -P * a * a * (3 * x - a) / (6 * EI)
              }
            }
          }

          else if (load.type === 'distributed') {
            const w = load.magnitude
            const a = load.position
            const b = load.end_position || L
            const loadLen = b - a
            const W = w * loadLen

            R_A += W
            M_A += -W * (a + loadLen / 2)

            for (let i = 0; i < N_POINTS; i++) {
              const x = i * dx
              if (x <= a) {
                shear[i] += W
                moment[i] += -W * ((a + loadLen / 2) - x)
              } else if (x <= b) {
                const remaining = b - x
                shear[i] += w * remaining
                moment[i] += -w * remaining * remaining / 2
              }

              // Full-span UDL deflection
              if (a === 0 && b === L) {
                deflection[i] += -w * x * x * (6 * L * L - 4 * L * x + x * x) / (24 * EI)
              }
            }
          }
        }
      }

      else if (beamType === 'fixed_fixed') {
        // Both ends fixed
        for (const load of loads) {
          if (load.type === 'point') {
            const P = load.magnitude
            const a = load.position
            const b = L - a

            // Fixed-fixed beam with point load
            R_A += P * b * b * (3 * a + b) / (L * L * L)
            R_B += P * a * a * (a + 3 * b) / (L * L * L)
            M_A += -P * a * b * b / (L * L)
            M_B += P * a * a * b / (L * L)

            for (let i = 0; i < N_POINTS; i++) {
              const x = i * dx
              const ra = P * b * b * (3 * a + b) / (L * L * L)
              const ma = -P * a * b * b / (L * L)

              if (x <= a) {
                shear[i] += ra
                moment[i] += ma + ra * x
              } else {
                shear[i] += ra - P
                moment[i] += ma + ra * x - P * (x - a)
              }

              // Deflection
              if (x <= a) {
                deflection[i] += -P * b * b * x * x * (3 * a * L - x * (3 * a + b)) / (6 * EI * L * L * L)
              } else {
                deflection[i] += -P * a * a * (L - x) * (L - x) * (3 * b * L - (L - x) * (3 * b + a)) / (6 * EI * L * L * L)
              }
            }
          }

          else if (load.type === 'distributed' && load.position === 0 && (load.end_position || L) === L) {
            // Full-span UDL on fixed-fixed beam
            const w = load.magnitude
            R_A += w * L / 2
            R_B += w * L / 2
            M_A += -w * L * L / 12
            M_B += w * L * L / 12

            for (let i = 0; i < N_POINTS; i++) {
              const x = i * dx
              shear[i] += w * L / 2 - w * x
              moment[i] += -w * L * L / 12 + w * L * x / 2 - w * x * x / 2
              deflection[i] += -w * x * x * (L - x) * (L - x) / (24 * EI)
            }
          }
        }
      }

      else {
        return `**Error**: Unknown beam type "${beamType}". Options: simply_supported, cantilever, fixed_fixed`
      }

      // Reactions
      lines.push('')
      lines.push('### Reactions')
      lines.push('')
      lines.push(`| Reaction | Value |`)
      lines.push(`|---|---|`)
      lines.push(`| R_A (left) | ${fmtUnit(R_A, 'N')} |`)
      if (beamType !== 'cantilever') lines.push(`| R_B (right) | ${fmtUnit(R_B, 'N')} |`)
      if (M_A !== 0) lines.push(`| M_A (left moment) | ${fmtUnit(M_A, 'N\u00b7m')} |`)
      if (M_B !== 0) lines.push(`| M_B (right moment) | ${fmtUnit(M_B, 'N\u00b7m')} |`)

      // Find max values
      let maxShear = 0, maxShearX = 0, maxMoment = 0, maxMomentX = 0, maxDefl = 0, maxDeflX = 0
      for (let i = 0; i < N_POINTS; i++) {
        if (Math.abs(shear[i]) > Math.abs(maxShear)) { maxShear = shear[i]; maxShearX = i * dx }
        if (Math.abs(moment[i]) > Math.abs(maxMoment)) { maxMoment = moment[i]; maxMomentX = i * dx }
        if (Math.abs(deflection[i]) > Math.abs(maxDefl)) { maxDefl = deflection[i]; maxDeflX = i * dx }
      }

      lines.push('')
      lines.push('### Critical Values')
      lines.push('')
      lines.push(`| Quantity | Maximum | Location |`)
      lines.push(`|---|---|---|`)
      lines.push(`| Shear force | ${fmtUnit(maxShear, 'N')} | x = ${fmtUnit(maxShearX, 'm')} |`)
      lines.push(`| Bending moment | ${fmtUnit(maxMoment, 'N\u00b7m')} | x = ${fmtUnit(maxMomentX, 'm')} |`)
      lines.push(`| Deflection | ${fmtUnit(maxDefl, 'm')} (${fmtUnit(maxDefl * 1000, 'mm')}) | x = ${fmtUnit(maxDeflX, 'm')} |`)

      // Shear diagram (ASCII)
      lines.push('')
      lines.push('### Shear Force Diagram')
      lines.push('')
      lines.push('```')
      const shearMax = Math.max(...shear.map(Math.abs)) || 1
      for (let i = 0; i < N_POINTS; i += 2) {
        const x = (i * dx).toFixed(2).padStart(5)
        const val = shear[i]
        const barLen = Math.round(Math.abs(val) / shearMax * 25)
        const bar = val >= 0 ? ' '.repeat(25) + '\u2502' + '\u2588'.repeat(barLen) : ' '.repeat(25 - barLen) + '\u2588'.repeat(barLen) + '\u2502'
        lines.push(`${x}m ${bar} ${val.toFixed(1)}N`)
      }
      lines.push('```')

      // Bending moment diagram
      lines.push('')
      lines.push('### Bending Moment Diagram')
      lines.push('')
      lines.push('```')
      const momMax = Math.max(...moment.map(Math.abs)) || 1
      for (let i = 0; i < N_POINTS; i += 2) {
        const x = (i * dx).toFixed(2).padStart(5)
        const val = moment[i]
        const barLen = Math.round(Math.abs(val) / momMax * 25)
        const bar = val >= 0 ? ' '.repeat(25) + '\u2502' + '\u2588'.repeat(barLen) : ' '.repeat(25 - barLen) + '\u2588'.repeat(barLen) + '\u2502'
        lines.push(`${x}m ${bar} ${val.toFixed(1)}Nm`)
      }
      lines.push('```')

      return lines.join('\n')
    },
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. FLUID DYNAMICS
  // ═══════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'fluid_dynamics',
    description: 'Fluid mechanics calculations: Reynolds number, Bernoulli equation, Darcy-Weisbach pipe flow, drag force, terminal velocity.',
    parameters: {
      calculation: { type: 'string', description: 'Calculation: reynolds, bernoulli, pipe_flow, drag, terminal_velocity', required: true },
      params: { type: 'string', description: 'JSON with: velocity (m/s), density (kg/m^3), viscosity (Pa*s), diameter (m), length (m), roughness (m), area (m^2), Cd, mass (kg), pressure (Pa), height (m)', required: true },
    },
    tier: 'free',
    async execute(args) {
      const calc = String(args.calculation).toLowerCase()
      let params: Record<string, number>
      try {
        params = JSON.parse(String(args.params))
      } catch {
        return '**Error**: Invalid JSON in params.'
      }

      // Common fluid properties
      const FLUIDS: Record<string, { density: number; viscosity: number }> = {
        water:   { density: 998,    viscosity: 1.002e-3 },
        air:     { density: 1.225,  viscosity: 1.81e-5 },
        oil:     { density: 900,    viscosity: 0.1 },
        mercury: { density: 13_546, viscosity: 1.526e-3 },
      }

      const lines: string[] = ['## Fluid Dynamics']
      lines.push('')

      if (calc === 'reynolds') {
        const rho = params.density || FLUIDS.water.density
        const mu = params.viscosity || FLUIDS.water.viscosity
        const v = params.velocity || 1
        const D = params.diameter || params.length || 0.01

        const Re = rho * v * D / mu

        lines.push('### Reynolds Number')
        lines.push('')
        lines.push(`| Parameter | Value |`)
        lines.push(`|---|---|`)
        lines.push(`| Density (\u03c1) | ${fmtUnit(rho, 'kg/m\u00b3')} |`)
        lines.push(`| Velocity (v) | ${fmtUnit(v, 'm/s')} |`)
        lines.push(`| Characteristic length (D) | ${fmtUnit(D, 'm')} |`)
        lines.push(`| Dynamic viscosity (\u03bc) | ${fmtUnit(mu, 'Pa\u00b7s')} |`)
        lines.push(`| **Reynolds number (Re)** | **${fmt(Re)}** |`)
        lines.push('')

        let regime = 'Turbulent'
        if (Re < 2300) regime = 'Laminar'
        else if (Re < 4000) regime = 'Transitional'

        lines.push(`**Flow regime**: ${regime}`)
        lines.push('')
        lines.push('| Range | Regime |')
        lines.push('|---|---|')
        lines.push('| Re < 2,300 | Laminar |')
        lines.push('| 2,300 < Re < 4,000 | Transitional |')
        lines.push('| Re > 4,000 | Turbulent |')
      }

      else if (calc === 'bernoulli') {
        // Bernoulli: P1 + 0.5*rho*v1^2 + rho*g*h1 = P2 + 0.5*rho*v2^2 + rho*g*h2
        const rho = params.density || FLUIDS.water.density
        const g = 9.81
        const P1 = params.pressure1 || params.pressure || 101325
        const v1 = params.velocity1 || params.velocity || 0
        const h1 = params.height1 || params.height || 0
        const P2 = params.pressure2
        const v2 = params.velocity2
        const h2 = params.height2 || 0

        const E1 = P1 + 0.5 * rho * v1 * v1 + rho * g * h1

        lines.push('### Bernoulli Equation')
        lines.push('')
        lines.push('P + \u00bd\u03c1v\u00b2 + \u03c1gh = constant')
        lines.push('')
        lines.push(`| Parameter | Point 1 | Point 2 |`)
        lines.push(`|---|---|---|`)
        lines.push(`| Pressure (Pa) | ${fmtUnit(P1, 'Pa')} | ${P2 !== undefined ? fmtUnit(P2, 'Pa') : '?' } |`)
        lines.push(`| Velocity (m/s) | ${fmtUnit(v1, 'm/s')} | ${v2 !== undefined ? fmtUnit(v2, 'm/s') : '?'} |`)
        lines.push(`| Height (m) | ${fmtUnit(h1, 'm')} | ${fmtUnit(h2, 'm')} |`)
        lines.push(`| Total head | ${fmtUnit(E1, 'Pa')} | \u2014 |`)

        // Solve for unknown
        if (P2 === undefined && v2 !== undefined) {
          const P2_calc = E1 - 0.5 * rho * v2 * v2 - rho * g * h2
          lines.push('')
          lines.push(`**Solved P\u2082** = ${fmtUnit(P2_calc, 'Pa')} (${fmtUnit(P2_calc / 1000, 'kPa')})`)
        } else if (v2 === undefined && P2 !== undefined) {
          const v2_calc = Math.sqrt(2 * (E1 - P2 - rho * g * h2) / rho)
          lines.push('')
          lines.push(`**Solved v\u2082** = ${fmtUnit(v2_calc, 'm/s')}`)
        }
      }

      else if (calc === 'pipe_flow') {
        const rho = params.density || FLUIDS.water.density
        const mu = params.viscosity || FLUIDS.water.viscosity
        const v = params.velocity || 1
        const D = params.diameter || 0.05
        const L_pipe = params.length || 10
        const roughness = params.roughness || 0.046e-3 // commercial steel
        const g = 9.81

        const Re = rho * v * D / mu
        const relRough = roughness / D

        // Friction factor (Colebrook-White, solved iteratively)
        let f: number
        if (Re < 2300) {
          f = 64 / Re // Laminar
        } else {
          // Swamee-Jain approximation
          f = 0.25 / Math.pow(Math.log10(relRough / 3.7 + 5.74 / Math.pow(Re, 0.9)), 2)
        }

        // Darcy-Weisbach head loss
        const h_f = f * (L_pipe / D) * (v * v) / (2 * g)
        const dP = f * (L_pipe / D) * rho * v * v / 2

        // Flow rate
        const A = Math.PI * D * D / 4
        const Q = A * v

        lines.push('### Pipe Flow (Darcy-Weisbach)')
        lines.push('')
        lines.push(`| Parameter | Value |`)
        lines.push(`|---|---|`)
        lines.push(`| Pipe diameter | ${fmtUnit(D, 'm')} (${fmtUnit(D * 1000, 'mm')}) |`)
        lines.push(`| Pipe length | ${fmtUnit(L_pipe, 'm')} |`)
        lines.push(`| Flow velocity | ${fmtUnit(v, 'm/s')} |`)
        lines.push(`| Reynolds number | ${fmt(Re)} |`)
        lines.push(`| Relative roughness | ${fmt(relRough)} |`)
        lines.push(`| Friction factor (f) | ${fmt(f)} |`)
        lines.push(`| **Head loss** | **${fmtUnit(h_f, 'm')}** |`)
        lines.push(`| **Pressure drop** | **${fmtUnit(dP, 'Pa')}** (${fmtUnit(dP / 1000, 'kPa')}) |`)
        lines.push(`| Flow rate | ${fmtUnit(Q, 'm\u00b3/s')} (${fmtUnit(Q * 1000, 'L/s')}) |`)
        lines.push(`| Flow regime | ${Re < 2300 ? 'Laminar' : Re < 4000 ? 'Transitional' : 'Turbulent'} |`)
      }

      else if (calc === 'drag') {
        const rho = params.density || FLUIDS.air.density
        const v = params.velocity || 10
        const A = params.area || 1
        const Cd = params.Cd || params.cd || 0.47 // sphere

        const F_drag = 0.5 * Cd * rho * A * v * v

        lines.push('### Drag Force')
        lines.push('')
        lines.push(`| Parameter | Value |`)
        lines.push(`|---|---|`)
        lines.push(`| Fluid density | ${fmtUnit(rho, 'kg/m\u00b3')} |`)
        lines.push(`| Velocity | ${fmtUnit(v, 'm/s')} |`)
        lines.push(`| Reference area | ${fmtUnit(A, 'm\u00b2')} |`)
        lines.push(`| Drag coefficient (C_d) | ${fmt(Cd)} |`)
        lines.push(`| **Drag force** | **${fmtUnit(F_drag, 'N')}** |`)
        lines.push('')
        lines.push('Common C_d values: sphere (0.47), cylinder (1.2), flat plate (1.28), streamlined (0.04), car (0.25\u20130.35)')
      }

      else if (calc === 'terminal_velocity') {
        const rho_fluid = params.density || params.fluid_density || FLUIDS.air.density
        const rho_obj = params.object_density || 7800 // steel
        const mass = params.mass || 1
        const A = params.area || 0.01
        const Cd = params.Cd || params.cd || 0.47
        const g = 9.81

        const v_t = Math.sqrt(2 * mass * g / (rho_fluid * A * Cd))

        lines.push('### Terminal Velocity')
        lines.push('')
        lines.push(`| Parameter | Value |`)
        lines.push(`|---|---|`)
        lines.push(`| Mass | ${fmtUnit(mass, 'kg')} |`)
        lines.push(`| Fluid density | ${fmtUnit(rho_fluid, 'kg/m\u00b3')} |`)
        lines.push(`| Cross-section area | ${fmtUnit(A, 'm\u00b2')} |`)
        lines.push(`| Drag coefficient | ${fmt(Cd)} |`)
        lines.push(`| **Terminal velocity** | **${fmtUnit(v_t, 'm/s')}** (${fmtUnit(v_t * 3.6, 'km/h')}) |`)
        lines.push('')
        lines.push('**Formula**: v_t = \u221a(2mg / (\u03c1 A C_d))')

        // Check Reynolds number at terminal velocity
        const mu = params.viscosity || FLUIDS.air.viscosity
        const D = params.diameter || Math.sqrt(4 * A / Math.PI)
        const Re = rho_fluid * v_t * D / mu
        lines.push(`- Reynolds number at v_t: ${fmt(Re)}`)
      }

      else {
        return `**Error**: Unknown calculation "${calc}". Options: reynolds, bernoulli, pipe_flow, drag, terminal_velocity`
      }

      return lines.join('\n')
    },
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. ELECTROMAGNETIC CALCULATOR
  // ═══════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'electromagnetic_calc',
    description: 'Electromagnetic calculations: Coulomb force, electric field, magnetic field (wire/loop/solenoid via Biot-Savart), inductance, capacitance, skin depth, antenna.',
    parameters: {
      calculation: { type: 'string', description: 'Calculation: coulomb, electric_field, magnetic_field, inductance, capacitance, skin_depth, antenna', required: true },
      params: { type: 'string', description: 'JSON params: {charge1, charge2, distance, current, radius, turns, length, area, plates, permittivity, frequency, conductivity, wire_radius}', required: true },
    },
    tier: 'free',
    async execute(args) {
      const calc = String(args.calculation).toLowerCase()
      let params: Record<string, number>
      try {
        params = JSON.parse(String(args.params))
      } catch {
        return '**Error**: Invalid JSON in params.'
      }

      const lines: string[] = ['## Electromagnetic Calculations']
      lines.push('')

      if (calc === 'coulomb') {
        const q1 = params.charge1 || params.q1 || e_charge
        const q2 = params.charge2 || params.q2 || e_charge
        const r = params.distance || params.r || 1e-10

        const F = (1 / (4 * Math.PI * epsilon_0)) * q1 * q2 / (r * r)
        const U = (1 / (4 * Math.PI * epsilon_0)) * q1 * q2 / r

        lines.push('### Coulomb Force')
        lines.push('')
        lines.push(`| Parameter | Value |`)
        lines.push(`|---|---|`)
        lines.push(`| Charge 1 | ${fmtUnit(q1, 'C')} (${fmtUnit(q1 / e_charge, 'e')}) |`)
        lines.push(`| Charge 2 | ${fmtUnit(q2, 'C')} (${fmtUnit(q2 / e_charge, 'e')}) |`)
        lines.push(`| Distance | ${fmtUnit(r, 'm')} |`)
        lines.push(`| **Force** | **${fmtUnit(F, 'N')}** |`)
        lines.push(`| Potential energy | ${fmtUnit(U, 'J')} (${fmtUnit(U / eV, 'eV')}) |`)
        lines.push(`| Direction | ${F > 0 ? 'Repulsive' : 'Attractive'} |`)
        lines.push('')
        lines.push('**Formula**: F = kq\u2081q\u2082/r\u00b2, k = 1/(4\u03c0\u03b5\u2080)')
      }

      else if (calc === 'electric_field') {
        const q = params.charge || params.q || e_charge
        const r = params.distance || params.r || 1
        const V = params.voltage || params.V
        const d = params.plate_distance || params.d

        if (V !== undefined && d !== undefined) {
          // Uniform field between parallel plates
          const E = V / d
          lines.push('### Uniform Electric Field (Parallel Plates)')
          lines.push('')
          lines.push(`| Parameter | Value |`)
          lines.push(`|---|---|`)
          lines.push(`| Voltage | ${fmtUnit(V, 'V')} |`)
          lines.push(`| Plate separation | ${fmtUnit(d, 'm')} |`)
          lines.push(`| **Electric field** | **${fmtUnit(E, 'V/m')}** |`)
        } else {
          // Point charge
          const E = (1 / (4 * Math.PI * epsilon_0)) * Math.abs(q) / (r * r)
          const V_pot = (1 / (4 * Math.PI * epsilon_0)) * q / r

          lines.push('### Electric Field (Point Charge)')
          lines.push('')
          lines.push(`| Parameter | Value |`)
          lines.push(`|---|---|`)
          lines.push(`| Charge | ${fmtUnit(q, 'C')} |`)
          lines.push(`| Distance | ${fmtUnit(r, 'm')} |`)
          lines.push(`| **Electric field** | **${fmtUnit(E, 'V/m')}** |`)
          lines.push(`| Electric potential | ${fmtUnit(V_pot, 'V')} |`)
          lines.push(`| Direction | ${q > 0 ? 'Radially outward' : 'Radially inward'} |`)
        }
      }

      else if (calc === 'magnetic_field') {
        const I = params.current || params.I || 1
        const geometry = params.geometry || 0  // 0=wire, 1=loop, 2=solenoid
        const r = params.distance || params.r || 0.01
        const R = params.radius || params.R || 0.05
        const N = params.turns || params.N || 1
        const L_sol = params.length || params.l || 0.1

        lines.push('### Magnetic Field (Biot-Savart)')
        lines.push('')

        if (geometry === 0 || params.wire) {
          // Infinite straight wire: B = mu_0 * I / (2 * pi * r)
          const B = mu_0 * I / (2 * Math.PI * r)
          lines.push('**Geometry**: Infinite straight wire')
          lines.push('')
          lines.push(`| Parameter | Value |`)
          lines.push(`|---|---|`)
          lines.push(`| Current | ${fmtUnit(I, 'A')} |`)
          lines.push(`| Distance from wire | ${fmtUnit(r, 'm')} |`)
          lines.push(`| **Magnetic field B** | **${fmtUnit(B, 'T')}** (${fmtUnit(B * 1e6, '\u03bcT')}) |`)
          lines.push('')
          lines.push('**Formula**: B = \u03bc\u2080I / (2\u03c0r)')
        }

        if (geometry === 1 || params.loop) {
          // Circular loop at center: B = mu_0 * N * I / (2 * R)
          const B_center = mu_0 * N * I / (2 * R)
          // On axis at distance x: B = mu_0 * N * I * R^2 / (2 * (R^2 + x^2)^(3/2))
          const x = params.axial_distance || 0
          const B_axis = mu_0 * N * I * R * R / (2 * Math.pow(R * R + x * x, 1.5))

          lines.push('**Geometry**: Circular loop')
          lines.push('')
          lines.push(`| Parameter | Value |`)
          lines.push(`|---|---|`)
          lines.push(`| Current | ${fmtUnit(I, 'A')} |`)
          lines.push(`| Radius | ${fmtUnit(R, 'm')} |`)
          lines.push(`| Turns | ${N} |`)
          lines.push(`| **B at center** | **${fmtUnit(B_center, 'T')}** |`)
          if (x > 0) lines.push(`| B at x=${fmtUnit(x, 'm')} on axis | ${fmtUnit(B_axis, 'T')} |`)
          lines.push(`| Magnetic moment | ${fmtUnit(N * I * Math.PI * R * R, 'A\u00b7m\u00b2')} |`)
        }

        if (geometry === 2 || params.solenoid) {
          // Solenoid: B = mu_0 * n * I where n = N/L
          const n = N / L_sol
          const B = mu_0 * n * I

          lines.push('**Geometry**: Solenoid')
          lines.push('')
          lines.push(`| Parameter | Value |`)
          lines.push(`|---|---|`)
          lines.push(`| Current | ${fmtUnit(I, 'A')} |`)
          lines.push(`| Turns | ${N} |`)
          lines.push(`| Length | ${fmtUnit(L_sol, 'm')} |`)
          lines.push(`| Turn density (n) | ${fmtUnit(n, 'turns/m')} |`)
          lines.push(`| **B (interior)** | **${fmtUnit(B, 'T')}** (${fmtUnit(B * 1000, 'mT')}) |`)
        }
      }

      else if (calc === 'inductance') {
        const N = params.turns || params.N || 100
        const A = params.area || (params.radius ? Math.PI * params.radius ** 2 : 1e-4)
        const l = params.length || 0.1
        const mu_r = params.permeability || 1

        // Solenoid inductance: L = mu_0 * mu_r * N^2 * A / l
        const L_ind = mu_0 * mu_r * N * N * A / l

        // Energy stored: U = 0.5 * L * I^2
        const I = params.current || 1
        const U = 0.5 * L_ind * I * I

        lines.push('### Inductance (Solenoid)')
        lines.push('')
        lines.push(`| Parameter | Value |`)
        lines.push(`|---|---|`)
        lines.push(`| Turns (N) | ${N} |`)
        lines.push(`| Cross-section area | ${fmtUnit(A, 'm\u00b2')} |`)
        lines.push(`| Length | ${fmtUnit(l, 'm')} |`)
        lines.push(`| Relative permeability | ${mu_r} |`)
        lines.push(`| **Inductance** | **${fmtUnit(L_ind, 'H')}** (${fmtUnit(L_ind * 1e3, 'mH')}) |`)
        lines.push(`| Energy (at ${fmtUnit(I, 'A')}) | ${fmtUnit(U, 'J')} |`)
        lines.push(`| Inductive reactance @ 50Hz | ${fmtUnit(2 * Math.PI * 50 * L_ind, '\u03a9')} |`)
        lines.push(`| Inductive reactance @ 1kHz | ${fmtUnit(2 * Math.PI * 1000 * L_ind, '\u03a9')} |`)
      }

      else if (calc === 'capacitance') {
        const A = params.area || 0.01
        const d = params.distance || params.separation || 0.001
        const epsilon_r = params.permittivity || params.dielectric || 1

        // Parallel plate: C = epsilon_0 * epsilon_r * A / d
        const C_cap = epsilon_0 * epsilon_r * A / d

        const V = params.voltage || 1
        const Q = C_cap * V
        const U = 0.5 * C_cap * V * V

        lines.push('### Capacitance (Parallel Plate)')
        lines.push('')
        lines.push(`| Parameter | Value |`)
        lines.push(`|---|---|`)
        lines.push(`| Plate area | ${fmtUnit(A, 'm\u00b2')} |`)
        lines.push(`| Separation | ${fmtUnit(d, 'm')} (${fmtUnit(d * 1000, 'mm')}) |`)
        lines.push(`| Dielectric constant | ${epsilon_r} |`)
        lines.push(`| **Capacitance** | **${fmtUnit(C_cap, 'F')}** (${fmtUnit(C_cap * 1e12, 'pF')}) |`)
        lines.push(`| Charge (at ${fmtUnit(V, 'V')}) | ${fmtUnit(Q, 'C')} |`)
        lines.push(`| Energy (at ${fmtUnit(V, 'V')}) | ${fmtUnit(U, 'J')} |`)
        lines.push(`| E field | ${fmtUnit(V / d, 'V/m')} |`)
        lines.push(`| Capacitive reactance @ 50Hz | ${fmtUnit(1 / (2 * Math.PI * 50 * C_cap), '\u03a9')} |`)
      }

      else if (calc === 'skin_depth') {
        const f = params.frequency || 60
        const sigma = params.conductivity || 5.8e7  // copper
        const mu_r = params.permeability || 1

        const delta = 1 / Math.sqrt(Math.PI * f * mu_0 * mu_r * sigma)

        lines.push('### Skin Depth')
        lines.push('')
        lines.push(`| Parameter | Value |`)
        lines.push(`|---|---|`)
        lines.push(`| Frequency | ${fmtUnit(f, 'Hz')} |`)
        lines.push(`| Conductivity | ${fmtUnit(sigma, 'S/m')} |`)
        lines.push(`| Relative permeability | ${mu_r} |`)
        lines.push(`| **Skin depth (\u03b4)** | **${fmtUnit(delta, 'm')}** (${fmtUnit(delta * 1000, 'mm')}) |`)
        lines.push('')
        lines.push('Common conductivities: copper (5.8\u00d710\u2077), aluminum (3.77\u00d710\u2077), steel (1\u00d710\u2077), seawater (5)')
        lines.push('')

        // Show skin depth at common frequencies
        lines.push('| Frequency | Skin depth (copper) |')
        lines.push('|---|---|')
        for (const fq of [60, 1000, 1e6, 100e6, 1e9, 10e9]) {
          const d = 1 / Math.sqrt(Math.PI * fq * mu_0 * sigma)
          const fLabel = fq >= 1e9 ? `${fq / 1e9} GHz` : fq >= 1e6 ? `${fq / 1e6} MHz` : fq >= 1e3 ? `${fq / 1e3} kHz` : `${fq} Hz`
          lines.push(`| ${fLabel} | ${fmtUnit(d * 1000, 'mm')} |`)
        }
      }

      else if (calc === 'antenna') {
        const f = params.frequency || 2.4e9
        const lambda = c / f
        const gain_dBi = params.gain || 2.15  // dipole

        lines.push('### Antenna Calculations')
        lines.push('')
        lines.push(`| Parameter | Value |`)
        lines.push(`|---|---|`)
        lines.push(`| Frequency | ${fmtUnit(f, 'Hz')} (${f >= 1e9 ? fmtUnit(f / 1e9, 'GHz') : fmtUnit(f / 1e6, 'MHz')}) |`)
        lines.push(`| Wavelength (\u03bb) | ${fmtUnit(lambda, 'm')} (${fmtUnit(lambda * 100, 'cm')}) |`)
        lines.push(`| Half-wave dipole length | ${fmtUnit(lambda / 2, 'm')} (${fmtUnit(lambda * 50, 'cm')}) |`)
        lines.push(`| Quarter-wave monopole | ${fmtUnit(lambda / 4, 'm')} (${fmtUnit(lambda * 25, 'cm')}) |`)
        lines.push(`| Gain | ${fmt(gain_dBi)} dBi |`)
        lines.push('')

        // Friis transmission equation
        const dist = params.distance || 100
        const P_tx = params.power || 1  // 1W
        const G_tx = Math.pow(10, gain_dBi / 10)
        const G_rx = G_tx
        const P_rx = P_tx * G_tx * G_rx * (lambda / (4 * Math.PI * dist)) ** 2
        const pathLoss_dB = 20 * Math.log10(4 * Math.PI * dist / lambda)

        lines.push('### Link Budget (Friis)')
        lines.push('')
        lines.push(`| Parameter | Value |`)
        lines.push(`|---|---|`)
        lines.push(`| Tx power | ${fmtUnit(P_tx, 'W')} (${fmtUnit(10 * Math.log10(P_tx * 1000), 'dBm')}) |`)
        lines.push(`| Distance | ${fmtUnit(dist, 'm')} |`)
        lines.push(`| Free-space path loss | ${fmtUnit(pathLoss_dB, 'dB')} |`)
        lines.push(`| Rx power | ${fmtUnit(P_rx, 'W')} (${fmtUnit(10 * Math.log10(P_rx * 1000), 'dBm')}) |`)

        // Effective aperture
        const Ae = G_tx * lambda * lambda / (4 * Math.PI)
        lines.push(`| Effective aperture | ${fmtUnit(Ae, 'm\u00b2')} |`)
      }

      else {
        return `**Error**: Unknown calculation "${calc}". Options: coulomb, electric_field, magnetic_field, inductance, capacitance, skin_depth, antenna`
      }

      return lines.join('\n')
    },
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. ASTRONOMY QUERY
  // ═══════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'astronomy_query',
    description: 'Query astronomical databases: SIMBAD for star/galaxy data, NASA Exoplanet Archive for exoplanets, NASA NEO for near-Earth objects.',
    parameters: {
      object: { type: 'string', description: 'Astronomical object name (e.g. "Sirius", "Proxima Centauri b", "Andromeda")', required: true },
      catalog: { type: 'string', description: 'Catalog to query: simbad, exoplanet, neo', required: true },
    },
    tier: 'free',
    timeout: 30_000,
    async execute(args) {
      const object = String(args.object).trim()
      const catalog = String(args.catalog).toLowerCase()

      const lines: string[] = []

      if (catalog === 'simbad') {
        const script = encodeURIComponent(
          `output console=off script=off\nformat object "%IDLIST(1) | %OTYPELIST | %COO(A D) | %FLUXLIST(V) | %SP"\nquery id ${object}`
        )
        const url = `https://simbad.cds.unistra.fr/simbad/sim-script?script=${script}`

        try {
          const res = await fetch(url, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(15_000),
          })
          const text = await res.text()

          lines.push(`## SIMBAD: ${object}`)
          lines.push('')

          if (text.includes('error') || text.includes('not found') || text.includes('No known object')) {
            lines.push(`Object "${object}" not found in SIMBAD.`)
            lines.push('')
            lines.push('Try a different name or identifier (e.g., "HD 48915" for Sirius, "M31" for Andromeda).')
          } else {
            // Parse the SIMBAD response
            const dataLines = text.split('\n').filter(l => l.trim() && !l.startsWith('::') && !l.startsWith('C.D.S.'))
            if (dataLines.length > 0) {
              const parts = dataLines[0].split('|').map(s => s.trim())
              lines.push(`| Field | Value |`)
              lines.push(`|---|---|`)
              if (parts[0]) lines.push(`| Identifier | ${parts[0]} |`)
              if (parts[1]) lines.push(`| Object type | ${parts[1]} |`)
              if (parts[2]) lines.push(`| Coordinates (RA Dec) | ${parts[2]} |`)
              if (parts[3]) lines.push(`| V magnitude | ${parts[3]} |`)
              if (parts[4]) lines.push(`| Spectral type | ${parts[4]} |`)
            }

            // Include raw for debugging
            if (dataLines.length > 1) {
              lines.push('')
              lines.push('### Raw Data')
              lines.push('```')
              lines.push(dataLines.slice(0, 10).join('\n'))
              lines.push('```')
            }
          }
        } catch (err) {
          lines.push(`## SIMBAD Query Failed`)
          lines.push('')
          lines.push(`Could not reach SIMBAD for "${object}". Error: ${err instanceof Error ? err.message : String(err)}`)
          lines.push('')
          lines.push('SIMBAD URL: `https://simbad.cds.unistra.fr/simbad/`')
        }
      }

      else if (catalog === 'exoplanet') {
        const encoded = encodeURIComponent(object)
        const url = `https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+*+from+pscomppars+where+pl_name+like+'%25${encoded}%25'&format=json`

        try {
          const res = await fetch(url, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(15_000),
          })
          const data = await res.json() as Array<Record<string, unknown>>

          lines.push(`## NASA Exoplanet Archive: ${object}`)
          lines.push('')

          if (!Array.isArray(data) || data.length === 0) {
            lines.push(`No exoplanet found matching "${object}".`)
            lines.push('')
            lines.push('Try the full planet name (e.g., "Proxima Centauri b", "TRAPPIST-1 e", "Kepler-452 b").')
          } else {
            for (const planet of data.slice(0, 3)) {
              lines.push(`### ${planet.pl_name || object}`)
              lines.push('')
              lines.push(`| Property | Value |`)
              lines.push(`|---|---|`)
              if (planet.hostname) lines.push(`| Host star | ${planet.hostname} |`)
              if (planet.sy_dist) lines.push(`| Distance | ${planet.sy_dist} pc |`)
              if (planet.pl_orbper) lines.push(`| Orbital period | ${planet.pl_orbper} days |`)
              if (planet.pl_orbsmax) lines.push(`| Semi-major axis | ${planet.pl_orbsmax} AU |`)
              if (planet.pl_orbeccen !== undefined) lines.push(`| Eccentricity | ${planet.pl_orbeccen} |`)
              if (planet.pl_orbincl) lines.push(`| Inclination | ${planet.pl_orbincl}\u00b0 |`)
              if (planet.pl_bmassj) lines.push(`| Mass | ${planet.pl_bmassj} M_Jupiter |`)
              if (planet.pl_radj) lines.push(`| Radius | ${planet.pl_radj} R_Jupiter |`)
              if (planet.pl_eqt) lines.push(`| Eq. temperature | ${planet.pl_eqt} K |`)
              if (planet.pl_dens) lines.push(`| Density | ${planet.pl_dens} g/cm\u00b3 |`)
              if (planet.disc_year) lines.push(`| Discovery year | ${planet.disc_year} |`)
              if (planet.discoverymethod) lines.push(`| Discovery method | ${planet.discoverymethod} |`)
              if (planet.st_spectype) lines.push(`| Star spectral type | ${planet.st_spectype} |`)
              if (planet.st_teff) lines.push(`| Star temperature | ${planet.st_teff} K |`)
              if (planet.st_mass) lines.push(`| Star mass | ${planet.st_mass} M_Sun |`)
              if (planet.st_rad) lines.push(`| Star radius | ${planet.st_rad} R_Sun |`)
              lines.push('')
            }

            if (data.length > 3) {
              lines.push(`*... and ${data.length - 3} more results.*`)
            }
          }
        } catch (err) {
          lines.push(`## Exoplanet Query Failed`)
          lines.push('')
          lines.push(`Could not reach NASA Exoplanet Archive. Error: ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      else if (catalog === 'neo') {
        // NEO browse or search
        const url = `https://api.nasa.gov/neo/rest/v1/neo/browse?api_key=DEMO_KEY`

        try {
          const res = await fetch(url, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(15_000),
          })
          const data = await res.json() as Record<string, unknown>

          lines.push(`## NASA Near-Earth Objects`)
          lines.push('')

          const neos = (data.near_earth_objects as Array<Record<string, unknown>>) || []
          // Filter by name if provided
          const filtered = object.toLowerCase() === 'browse' || object.toLowerCase() === 'all'
            ? neos.slice(0, 20)
            : neos.filter(n => String(n.name || '').toLowerCase().includes(object.toLowerCase()))

          if (filtered.length === 0 && neos.length > 0) {
            // Show first 15 regardless
            lines.push(`No NEO matching "${object}". Showing recent entries:`)
            lines.push('')
            filtered.push(...neos.slice(0, 15))
          }

          lines.push(`| Name | ID | Hazardous | Est. Diameter (m) | Absolute Mag |`)
          lines.push(`|---|---|---|---|---|`)

          for (const neo of filtered.slice(0, 20)) {
            const ed = neo.estimated_diameter as Record<string, Record<string, number>> | undefined
            const diamMin = ed?.meters?.estimated_diameter_min?.toFixed(1) || '?'
            const diamMax = ed?.meters?.estimated_diameter_max?.toFixed(1) || '?'
            lines.push(`| ${neo.name || '?'} | ${neo.id || '?'} | ${neo.is_potentially_hazardous_asteroid ? 'YES' : 'No'} | ${diamMin}\u2013${diamMax} | ${neo.absolute_magnitude_h || '?'} |`)
          }

          lines.push('')
          lines.push(`Total NEOs in database: ${(data.page as Record<string, unknown>)?.total_elements || '?'}`)
        } catch (err) {
          lines.push(`## NEO Query Failed`)
          lines.push('')
          lines.push(`Could not reach NASA NEO API. Error: ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      else {
        return `**Error**: Unknown catalog "${catalog}". Options: simbad, exoplanet, neo`
      }

      return lines.join('\n')
    },
  })
}
