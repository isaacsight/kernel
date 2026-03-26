// kbot Chemistry & Materials Science Tools
// Real implementations using PubChem, NIST, Rhea, Materials Project, COD.
// Local computation for stoichiometry, element lookup, and thermodynamics fallback.

import { registerTool } from './index.js'

// ─────────────────────────────────────────────────────────────────────────────
// Periodic Table — all 118 elements
// ─────────────────────────────────────────────────────────────────────────────

interface ElementData {
  number: number
  symbol: string
  name: string
  atomicMass: number
  category: string
  electronConfiguration: string
  electronegativity: number | null
  meltingPoint: number | null   // K
  boilingPoint: number | null   // K
  density: number | null        // g/cm³ (or g/L for gases)
  ionizationEnergy: number | null // kJ/mol
  discoveryYear: number | null
  crystalStructure: string | null
}

const PERIODIC_TABLE: ElementData[] = [
  { number: 1, symbol: 'H', name: 'Hydrogen', atomicMass: 1.008, category: 'nonmetal', electronConfiguration: '1s1', electronegativity: 2.20, meltingPoint: 14.01, boilingPoint: 20.28, density: 0.00008988, ionizationEnergy: 1312.0, discoveryYear: 1766, crystalStructure: 'hexagonal' },
  { number: 2, symbol: 'He', name: 'Helium', atomicMass: 4.0026, category: 'noble gas', electronConfiguration: '1s2', electronegativity: null, meltingPoint: 0.95, boilingPoint: 4.22, density: 0.0001785, ionizationEnergy: 2372.3, discoveryYear: 1868, crystalStructure: 'hexagonal close-packed' },
  { number: 3, symbol: 'Li', name: 'Lithium', atomicMass: 6.941, category: 'alkali metal', electronConfiguration: '[He] 2s1', electronegativity: 0.98, meltingPoint: 453.69, boilingPoint: 1615, density: 0.534, ionizationEnergy: 520.2, discoveryYear: 1817, crystalStructure: 'body-centered cubic' },
  { number: 4, symbol: 'Be', name: 'Beryllium', atomicMass: 9.0122, category: 'alkaline earth metal', electronConfiguration: '[He] 2s2', electronegativity: 1.57, meltingPoint: 1560, boilingPoint: 2742, density: 1.85, ionizationEnergy: 899.5, discoveryYear: 1798, crystalStructure: 'hexagonal close-packed' },
  { number: 5, symbol: 'B', name: 'Boron', atomicMass: 10.81, category: 'metalloid', electronConfiguration: '[He] 2s2 2p1', electronegativity: 2.04, meltingPoint: 2349, boilingPoint: 4200, density: 2.34, ionizationEnergy: 800.6, discoveryYear: 1808, crystalStructure: 'rhombohedral' },
  { number: 6, symbol: 'C', name: 'Carbon', atomicMass: 12.011, category: 'nonmetal', electronConfiguration: '[He] 2s2 2p2', electronegativity: 2.55, meltingPoint: 3823, boilingPoint: 4098, density: 2.267, ionizationEnergy: 1086.5, discoveryYear: null, crystalStructure: 'hexagonal' },
  { number: 7, symbol: 'N', name: 'Nitrogen', atomicMass: 14.007, category: 'nonmetal', electronConfiguration: '[He] 2s2 2p3', electronegativity: 3.04, meltingPoint: 63.15, boilingPoint: 77.36, density: 0.0012506, ionizationEnergy: 1402.3, discoveryYear: 1772, crystalStructure: 'hexagonal' },
  { number: 8, symbol: 'O', name: 'Oxygen', atomicMass: 15.999, category: 'nonmetal', electronConfiguration: '[He] 2s2 2p4', electronegativity: 3.44, meltingPoint: 54.36, boilingPoint: 90.20, density: 0.001429, ionizationEnergy: 1313.9, discoveryYear: 1774, crystalStructure: 'cubic' },
  { number: 9, symbol: 'F', name: 'Fluorine', atomicMass: 18.998, category: 'halogen', electronConfiguration: '[He] 2s2 2p5', electronegativity: 3.98, meltingPoint: 53.53, boilingPoint: 85.03, density: 0.001696, ionizationEnergy: 1681.0, discoveryYear: 1886, crystalStructure: 'monoclinic' },
  { number: 10, symbol: 'Ne', name: 'Neon', atomicMass: 20.180, category: 'noble gas', electronConfiguration: '[He] 2s2 2p6', electronegativity: null, meltingPoint: 24.56, boilingPoint: 27.07, density: 0.0008999, ionizationEnergy: 2080.7, discoveryYear: 1898, crystalStructure: 'face-centered cubic' },
  { number: 11, symbol: 'Na', name: 'Sodium', atomicMass: 22.990, category: 'alkali metal', electronConfiguration: '[Ne] 3s1', electronegativity: 0.93, meltingPoint: 370.87, boilingPoint: 1156, density: 0.971, ionizationEnergy: 495.8, discoveryYear: 1807, crystalStructure: 'body-centered cubic' },
  { number: 12, symbol: 'Mg', name: 'Magnesium', atomicMass: 24.305, category: 'alkaline earth metal', electronConfiguration: '[Ne] 3s2', electronegativity: 1.31, meltingPoint: 923, boilingPoint: 1363, density: 1.738, ionizationEnergy: 737.7, discoveryYear: 1808, crystalStructure: 'hexagonal close-packed' },
  { number: 13, symbol: 'Al', name: 'Aluminium', atomicMass: 26.982, category: 'post-transition metal', electronConfiguration: '[Ne] 3s2 3p1', electronegativity: 1.61, meltingPoint: 933.47, boilingPoint: 2792, density: 2.698, ionizationEnergy: 577.5, discoveryYear: 1825, crystalStructure: 'face-centered cubic' },
  { number: 14, symbol: 'Si', name: 'Silicon', atomicMass: 28.086, category: 'metalloid', electronConfiguration: '[Ne] 3s2 3p2', electronegativity: 1.90, meltingPoint: 1687, boilingPoint: 3538, density: 2.3296, ionizationEnergy: 786.5, discoveryYear: 1824, crystalStructure: 'diamond cubic' },
  { number: 15, symbol: 'P', name: 'Phosphorus', atomicMass: 30.974, category: 'nonmetal', electronConfiguration: '[Ne] 3s2 3p3', electronegativity: 2.19, meltingPoint: 317.30, boilingPoint: 553.65, density: 1.82, ionizationEnergy: 1011.8, discoveryYear: 1669, crystalStructure: 'orthorhombic' },
  { number: 16, symbol: 'S', name: 'Sulfur', atomicMass: 32.06, category: 'nonmetal', electronConfiguration: '[Ne] 3s2 3p4', electronegativity: 2.58, meltingPoint: 388.36, boilingPoint: 717.87, density: 2.067, ionizationEnergy: 999.6, discoveryYear: null, crystalStructure: 'orthorhombic' },
  { number: 17, symbol: 'Cl', name: 'Chlorine', atomicMass: 35.45, category: 'halogen', electronConfiguration: '[Ne] 3s2 3p5', electronegativity: 3.16, meltingPoint: 171.6, boilingPoint: 239.11, density: 0.003214, ionizationEnergy: 1251.2, discoveryYear: 1774, crystalStructure: 'orthorhombic' },
  { number: 18, symbol: 'Ar', name: 'Argon', atomicMass: 39.948, category: 'noble gas', electronConfiguration: '[Ne] 3s2 3p6', electronegativity: null, meltingPoint: 83.80, boilingPoint: 87.30, density: 0.0017837, ionizationEnergy: 1520.6, discoveryYear: 1894, crystalStructure: 'face-centered cubic' },
  { number: 19, symbol: 'K', name: 'Potassium', atomicMass: 39.098, category: 'alkali metal', electronConfiguration: '[Ar] 4s1', electronegativity: 0.82, meltingPoint: 336.53, boilingPoint: 1032, density: 0.862, ionizationEnergy: 418.8, discoveryYear: 1807, crystalStructure: 'body-centered cubic' },
  { number: 20, symbol: 'Ca', name: 'Calcium', atomicMass: 40.078, category: 'alkaline earth metal', electronConfiguration: '[Ar] 4s2', electronegativity: 1.00, meltingPoint: 1115, boilingPoint: 1757, density: 1.54, ionizationEnergy: 589.8, discoveryYear: 1808, crystalStructure: 'face-centered cubic' },
  { number: 21, symbol: 'Sc', name: 'Scandium', atomicMass: 44.956, category: 'transition metal', electronConfiguration: '[Ar] 3d1 4s2', electronegativity: 1.36, meltingPoint: 1814, boilingPoint: 3109, density: 2.989, ionizationEnergy: 633.1, discoveryYear: 1879, crystalStructure: 'hexagonal close-packed' },
  { number: 22, symbol: 'Ti', name: 'Titanium', atomicMass: 47.867, category: 'transition metal', electronConfiguration: '[Ar] 3d2 4s2', electronegativity: 1.54, meltingPoint: 1941, boilingPoint: 3560, density: 4.54, ionizationEnergy: 658.8, discoveryYear: 1791, crystalStructure: 'hexagonal close-packed' },
  { number: 23, symbol: 'V', name: 'Vanadium', atomicMass: 50.942, category: 'transition metal', electronConfiguration: '[Ar] 3d3 4s2', electronegativity: 1.63, meltingPoint: 2183, boilingPoint: 3680, density: 6.11, ionizationEnergy: 650.9, discoveryYear: 1801, crystalStructure: 'body-centered cubic' },
  { number: 24, symbol: 'Cr', name: 'Chromium', atomicMass: 51.996, category: 'transition metal', electronConfiguration: '[Ar] 3d5 4s1', electronegativity: 1.66, meltingPoint: 2180, boilingPoint: 2944, density: 7.15, ionizationEnergy: 652.9, discoveryYear: 1797, crystalStructure: 'body-centered cubic' },
  { number: 25, symbol: 'Mn', name: 'Manganese', atomicMass: 54.938, category: 'transition metal', electronConfiguration: '[Ar] 3d5 4s2', electronegativity: 1.55, meltingPoint: 1519, boilingPoint: 2334, density: 7.44, ionizationEnergy: 717.3, discoveryYear: 1774, crystalStructure: 'body-centered cubic' },
  { number: 26, symbol: 'Fe', name: 'Iron', atomicMass: 55.845, category: 'transition metal', electronConfiguration: '[Ar] 3d6 4s2', electronegativity: 1.83, meltingPoint: 1811, boilingPoint: 3134, density: 7.874, ionizationEnergy: 762.5, discoveryYear: null, crystalStructure: 'body-centered cubic' },
  { number: 27, symbol: 'Co', name: 'Cobalt', atomicMass: 58.933, category: 'transition metal', electronConfiguration: '[Ar] 3d7 4s2', electronegativity: 1.88, meltingPoint: 1768, boilingPoint: 3200, density: 8.86, ionizationEnergy: 760.4, discoveryYear: 1735, crystalStructure: 'hexagonal close-packed' },
  { number: 28, symbol: 'Ni', name: 'Nickel', atomicMass: 58.693, category: 'transition metal', electronConfiguration: '[Ar] 3d8 4s2', electronegativity: 1.91, meltingPoint: 1728, boilingPoint: 3186, density: 8.912, ionizationEnergy: 737.1, discoveryYear: 1751, crystalStructure: 'face-centered cubic' },
  { number: 29, symbol: 'Cu', name: 'Copper', atomicMass: 63.546, category: 'transition metal', electronConfiguration: '[Ar] 3d10 4s1', electronegativity: 1.90, meltingPoint: 1357.77, boilingPoint: 2835, density: 8.96, ionizationEnergy: 745.5, discoveryYear: null, crystalStructure: 'face-centered cubic' },
  { number: 30, symbol: 'Zn', name: 'Zinc', atomicMass: 65.38, category: 'transition metal', electronConfiguration: '[Ar] 3d10 4s2', electronegativity: 1.65, meltingPoint: 692.68, boilingPoint: 1180, density: 7.134, ionizationEnergy: 906.4, discoveryYear: null, crystalStructure: 'hexagonal close-packed' },
  { number: 31, symbol: 'Ga', name: 'Gallium', atomicMass: 69.723, category: 'post-transition metal', electronConfiguration: '[Ar] 3d10 4s2 4p1', electronegativity: 1.81, meltingPoint: 302.91, boilingPoint: 2477, density: 5.907, ionizationEnergy: 578.8, discoveryYear: 1875, crystalStructure: 'orthorhombic' },
  { number: 32, symbol: 'Ge', name: 'Germanium', atomicMass: 72.630, category: 'metalloid', electronConfiguration: '[Ar] 3d10 4s2 4p2', electronegativity: 2.01, meltingPoint: 1211.40, boilingPoint: 3106, density: 5.323, ionizationEnergy: 762.2, discoveryYear: 1886, crystalStructure: 'diamond cubic' },
  { number: 33, symbol: 'As', name: 'Arsenic', atomicMass: 74.922, category: 'metalloid', electronConfiguration: '[Ar] 3d10 4s2 4p3', electronegativity: 2.18, meltingPoint: 1090, boilingPoint: 887, density: 5.776, ionizationEnergy: 947.0, discoveryYear: null, crystalStructure: 'rhombohedral' },
  { number: 34, symbol: 'Se', name: 'Selenium', atomicMass: 78.971, category: 'nonmetal', electronConfiguration: '[Ar] 3d10 4s2 4p4', electronegativity: 2.55, meltingPoint: 493.65, boilingPoint: 958, density: 4.809, ionizationEnergy: 941.0, discoveryYear: 1817, crystalStructure: 'hexagonal' },
  { number: 35, symbol: 'Br', name: 'Bromine', atomicMass: 79.904, category: 'halogen', electronConfiguration: '[Ar] 3d10 4s2 4p5', electronegativity: 2.96, meltingPoint: 265.8, boilingPoint: 332.0, density: 3.122, ionizationEnergy: 1139.9, discoveryYear: 1826, crystalStructure: 'orthorhombic' },
  { number: 36, symbol: 'Kr', name: 'Krypton', atomicMass: 83.798, category: 'noble gas', electronConfiguration: '[Ar] 3d10 4s2 4p6', electronegativity: 3.00, meltingPoint: 115.79, boilingPoint: 119.93, density: 0.003733, ionizationEnergy: 1350.8, discoveryYear: 1898, crystalStructure: 'face-centered cubic' },
  { number: 37, symbol: 'Rb', name: 'Rubidium', atomicMass: 85.468, category: 'alkali metal', electronConfiguration: '[Kr] 5s1', electronegativity: 0.82, meltingPoint: 312.46, boilingPoint: 961, density: 1.532, ionizationEnergy: 403.0, discoveryYear: 1861, crystalStructure: 'body-centered cubic' },
  { number: 38, symbol: 'Sr', name: 'Strontium', atomicMass: 87.62, category: 'alkaline earth metal', electronConfiguration: '[Kr] 5s2', electronegativity: 0.95, meltingPoint: 1050, boilingPoint: 1655, density: 2.64, ionizationEnergy: 549.5, discoveryYear: 1790, crystalStructure: 'face-centered cubic' },
  { number: 39, symbol: 'Y', name: 'Yttrium', atomicMass: 88.906, category: 'transition metal', electronConfiguration: '[Kr] 4d1 5s2', electronegativity: 1.22, meltingPoint: 1799, boilingPoint: 3609, density: 4.469, ionizationEnergy: 600.0, discoveryYear: 1794, crystalStructure: 'hexagonal close-packed' },
  { number: 40, symbol: 'Zr', name: 'Zirconium', atomicMass: 91.224, category: 'transition metal', electronConfiguration: '[Kr] 4d2 5s2', electronegativity: 1.33, meltingPoint: 2128, boilingPoint: 4682, density: 6.506, ionizationEnergy: 640.1, discoveryYear: 1789, crystalStructure: 'hexagonal close-packed' },
  { number: 41, symbol: 'Nb', name: 'Niobium', atomicMass: 92.906, category: 'transition metal', electronConfiguration: '[Kr] 4d4 5s1', electronegativity: 1.6, meltingPoint: 2750, boilingPoint: 5017, density: 8.57, ionizationEnergy: 652.1, discoveryYear: 1801, crystalStructure: 'body-centered cubic' },
  { number: 42, symbol: 'Mo', name: 'Molybdenum', atomicMass: 95.95, category: 'transition metal', electronConfiguration: '[Kr] 4d5 5s1', electronegativity: 2.16, meltingPoint: 2896, boilingPoint: 4912, density: 10.22, ionizationEnergy: 684.3, discoveryYear: 1781, crystalStructure: 'body-centered cubic' },
  { number: 43, symbol: 'Tc', name: 'Technetium', atomicMass: 97, category: 'transition metal', electronConfiguration: '[Kr] 4d5 5s2', electronegativity: 1.9, meltingPoint: 2430, boilingPoint: 4538, density: 11.5, ionizationEnergy: 702.0, discoveryYear: 1937, crystalStructure: 'hexagonal close-packed' },
  { number: 44, symbol: 'Ru', name: 'Ruthenium', atomicMass: 101.07, category: 'transition metal', electronConfiguration: '[Kr] 4d7 5s1', electronegativity: 2.2, meltingPoint: 2607, boilingPoint: 4423, density: 12.37, ionizationEnergy: 710.2, discoveryYear: 1844, crystalStructure: 'hexagonal close-packed' },
  { number: 45, symbol: 'Rh', name: 'Rhodium', atomicMass: 102.91, category: 'transition metal', electronConfiguration: '[Kr] 4d8 5s1', electronegativity: 2.28, meltingPoint: 2237, boilingPoint: 3968, density: 12.41, ionizationEnergy: 719.7, discoveryYear: 1803, crystalStructure: 'face-centered cubic' },
  { number: 46, symbol: 'Pd', name: 'Palladium', atomicMass: 106.42, category: 'transition metal', electronConfiguration: '[Kr] 4d10', electronegativity: 2.20, meltingPoint: 1828.05, boilingPoint: 3236, density: 12.02, ionizationEnergy: 804.4, discoveryYear: 1803, crystalStructure: 'face-centered cubic' },
  { number: 47, symbol: 'Ag', name: 'Silver', atomicMass: 107.87, category: 'transition metal', electronConfiguration: '[Kr] 4d10 5s1', electronegativity: 1.93, meltingPoint: 1234.93, boilingPoint: 2435, density: 10.501, ionizationEnergy: 731.0, discoveryYear: null, crystalStructure: 'face-centered cubic' },
  { number: 48, symbol: 'Cd', name: 'Cadmium', atomicMass: 112.41, category: 'transition metal', electronConfiguration: '[Kr] 4d10 5s2', electronegativity: 1.69, meltingPoint: 594.22, boilingPoint: 1040, density: 8.69, ionizationEnergy: 867.8, discoveryYear: 1817, crystalStructure: 'hexagonal close-packed' },
  { number: 49, symbol: 'In', name: 'Indium', atomicMass: 114.82, category: 'post-transition metal', electronConfiguration: '[Kr] 4d10 5s2 5p1', electronegativity: 1.78, meltingPoint: 429.75, boilingPoint: 2345, density: 7.31, ionizationEnergy: 558.3, discoveryYear: 1863, crystalStructure: 'tetragonal' },
  { number: 50, symbol: 'Sn', name: 'Tin', atomicMass: 118.71, category: 'post-transition metal', electronConfiguration: '[Kr] 4d10 5s2 5p2', electronegativity: 1.96, meltingPoint: 505.08, boilingPoint: 2875, density: 7.287, ionizationEnergy: 708.6, discoveryYear: null, crystalStructure: 'tetragonal' },
  { number: 51, symbol: 'Sb', name: 'Antimony', atomicMass: 121.76, category: 'metalloid', electronConfiguration: '[Kr] 4d10 5s2 5p3', electronegativity: 2.05, meltingPoint: 903.78, boilingPoint: 1860, density: 6.685, ionizationEnergy: 834.0, discoveryYear: null, crystalStructure: 'rhombohedral' },
  { number: 52, symbol: 'Te', name: 'Tellurium', atomicMass: 127.60, category: 'metalloid', electronConfiguration: '[Kr] 4d10 5s2 5p4', electronegativity: 2.1, meltingPoint: 722.66, boilingPoint: 1261, density: 6.232, ionizationEnergy: 869.3, discoveryYear: 1783, crystalStructure: 'hexagonal' },
  { number: 53, symbol: 'I', name: 'Iodine', atomicMass: 126.90, category: 'halogen', electronConfiguration: '[Kr] 4d10 5s2 5p5', electronegativity: 2.66, meltingPoint: 386.85, boilingPoint: 457.4, density: 4.93, ionizationEnergy: 1008.4, discoveryYear: 1811, crystalStructure: 'orthorhombic' },
  { number: 54, symbol: 'Xe', name: 'Xenon', atomicMass: 131.29, category: 'noble gas', electronConfiguration: '[Kr] 4d10 5s2 5p6', electronegativity: 2.60, meltingPoint: 161.4, boilingPoint: 165.03, density: 0.005887, ionizationEnergy: 1170.4, discoveryYear: 1898, crystalStructure: 'face-centered cubic' },
  { number: 55, symbol: 'Cs', name: 'Caesium', atomicMass: 132.91, category: 'alkali metal', electronConfiguration: '[Xe] 6s1', electronegativity: 0.79, meltingPoint: 301.59, boilingPoint: 944, density: 1.873, ionizationEnergy: 375.7, discoveryYear: 1860, crystalStructure: 'body-centered cubic' },
  { number: 56, symbol: 'Ba', name: 'Barium', atomicMass: 137.33, category: 'alkaline earth metal', electronConfiguration: '[Xe] 6s2', electronegativity: 0.89, meltingPoint: 1000, boilingPoint: 2170, density: 3.594, ionizationEnergy: 502.9, discoveryYear: 1808, crystalStructure: 'body-centered cubic' },
  { number: 57, symbol: 'La', name: 'Lanthanum', atomicMass: 138.91, category: 'lanthanide', electronConfiguration: '[Xe] 5d1 6s2', electronegativity: 1.10, meltingPoint: 1193, boilingPoint: 3737, density: 6.145, ionizationEnergy: 538.1, discoveryYear: 1839, crystalStructure: 'hexagonal close-packed' },
  { number: 58, symbol: 'Ce', name: 'Cerium', atomicMass: 140.12, category: 'lanthanide', electronConfiguration: '[Xe] 4f1 5d1 6s2', electronegativity: 1.12, meltingPoint: 1068, boilingPoint: 3716, density: 6.77, ionizationEnergy: 534.4, discoveryYear: 1803, crystalStructure: 'face-centered cubic' },
  { number: 59, symbol: 'Pr', name: 'Praseodymium', atomicMass: 140.91, category: 'lanthanide', electronConfiguration: '[Xe] 4f3 6s2', electronegativity: 1.13, meltingPoint: 1208, boilingPoint: 3793, density: 6.773, ionizationEnergy: 527.0, discoveryYear: 1885, crystalStructure: 'hexagonal close-packed' },
  { number: 60, symbol: 'Nd', name: 'Neodymium', atomicMass: 144.24, category: 'lanthanide', electronConfiguration: '[Xe] 4f4 6s2', electronegativity: 1.14, meltingPoint: 1297, boilingPoint: 3347, density: 7.007, ionizationEnergy: 533.1, discoveryYear: 1885, crystalStructure: 'hexagonal close-packed' },
  { number: 61, symbol: 'Pm', name: 'Promethium', atomicMass: 145, category: 'lanthanide', electronConfiguration: '[Xe] 4f5 6s2', electronegativity: 1.13, meltingPoint: 1315, boilingPoint: 3273, density: 7.26, ionizationEnergy: 540.0, discoveryYear: 1945, crystalStructure: 'hexagonal close-packed' },
  { number: 62, symbol: 'Sm', name: 'Samarium', atomicMass: 150.36, category: 'lanthanide', electronConfiguration: '[Xe] 4f6 6s2', electronegativity: 1.17, meltingPoint: 1345, boilingPoint: 2067, density: 7.52, ionizationEnergy: 544.5, discoveryYear: 1879, crystalStructure: 'rhombohedral' },
  { number: 63, symbol: 'Eu', name: 'Europium', atomicMass: 151.96, category: 'lanthanide', electronConfiguration: '[Xe] 4f7 6s2', electronegativity: 1.2, meltingPoint: 1099, boilingPoint: 1802, density: 5.243, ionizationEnergy: 547.1, discoveryYear: 1901, crystalStructure: 'body-centered cubic' },
  { number: 64, symbol: 'Gd', name: 'Gadolinium', atomicMass: 157.25, category: 'lanthanide', electronConfiguration: '[Xe] 4f7 5d1 6s2', electronegativity: 1.20, meltingPoint: 1585, boilingPoint: 3546, density: 7.895, ionizationEnergy: 593.4, discoveryYear: 1880, crystalStructure: 'hexagonal close-packed' },
  { number: 65, symbol: 'Tb', name: 'Terbium', atomicMass: 158.93, category: 'lanthanide', electronConfiguration: '[Xe] 4f9 6s2', electronegativity: 1.2, meltingPoint: 1629, boilingPoint: 3503, density: 8.229, ionizationEnergy: 565.8, discoveryYear: 1843, crystalStructure: 'hexagonal close-packed' },
  { number: 66, symbol: 'Dy', name: 'Dysprosium', atomicMass: 162.50, category: 'lanthanide', electronConfiguration: '[Xe] 4f10 6s2', electronegativity: 1.22, meltingPoint: 1680, boilingPoint: 2840, density: 8.55, ionizationEnergy: 573.0, discoveryYear: 1886, crystalStructure: 'hexagonal close-packed' },
  { number: 67, symbol: 'Ho', name: 'Holmium', atomicMass: 164.93, category: 'lanthanide', electronConfiguration: '[Xe] 4f11 6s2', electronegativity: 1.23, meltingPoint: 1734, boilingPoint: 2993, density: 8.795, ionizationEnergy: 581.0, discoveryYear: 1878, crystalStructure: 'hexagonal close-packed' },
  { number: 68, symbol: 'Er', name: 'Erbium', atomicMass: 167.26, category: 'lanthanide', electronConfiguration: '[Xe] 4f12 6s2', electronegativity: 1.24, meltingPoint: 1802, boilingPoint: 3141, density: 9.066, ionizationEnergy: 589.3, discoveryYear: 1843, crystalStructure: 'hexagonal close-packed' },
  { number: 69, symbol: 'Tm', name: 'Thulium', atomicMass: 168.93, category: 'lanthanide', electronConfiguration: '[Xe] 4f13 6s2', electronegativity: 1.25, meltingPoint: 1818, boilingPoint: 2223, density: 9.321, ionizationEnergy: 596.7, discoveryYear: 1879, crystalStructure: 'hexagonal close-packed' },
  { number: 70, symbol: 'Yb', name: 'Ytterbium', atomicMass: 173.05, category: 'lanthanide', electronConfiguration: '[Xe] 4f14 6s2', electronegativity: 1.1, meltingPoint: 1097, boilingPoint: 1469, density: 6.965, ionizationEnergy: 603.4, discoveryYear: 1878, crystalStructure: 'face-centered cubic' },
  { number: 71, symbol: 'Lu', name: 'Lutetium', atomicMass: 174.97, category: 'lanthanide', electronConfiguration: '[Xe] 4f14 5d1 6s2', electronegativity: 1.27, meltingPoint: 1925, boilingPoint: 3675, density: 9.84, ionizationEnergy: 523.5, discoveryYear: 1907, crystalStructure: 'hexagonal close-packed' },
  { number: 72, symbol: 'Hf', name: 'Hafnium', atomicMass: 178.49, category: 'transition metal', electronConfiguration: '[Xe] 4f14 5d2 6s2', electronegativity: 1.3, meltingPoint: 2506, boilingPoint: 4876, density: 13.31, ionizationEnergy: 658.5, discoveryYear: 1923, crystalStructure: 'hexagonal close-packed' },
  { number: 73, symbol: 'Ta', name: 'Tantalum', atomicMass: 180.95, category: 'transition metal', electronConfiguration: '[Xe] 4f14 5d3 6s2', electronegativity: 1.5, meltingPoint: 3290, boilingPoint: 5731, density: 16.654, ionizationEnergy: 761.0, discoveryYear: 1802, crystalStructure: 'body-centered cubic' },
  { number: 74, symbol: 'W', name: 'Tungsten', atomicMass: 183.84, category: 'transition metal', electronConfiguration: '[Xe] 4f14 5d4 6s2', electronegativity: 2.36, meltingPoint: 3695, boilingPoint: 5828, density: 19.25, ionizationEnergy: 770.0, discoveryYear: 1783, crystalStructure: 'body-centered cubic' },
  { number: 75, symbol: 'Re', name: 'Rhenium', atomicMass: 186.21, category: 'transition metal', electronConfiguration: '[Xe] 4f14 5d5 6s2', electronegativity: 1.9, meltingPoint: 3459, boilingPoint: 5869, density: 21.02, ionizationEnergy: 760.0, discoveryYear: 1925, crystalStructure: 'hexagonal close-packed' },
  { number: 76, symbol: 'Os', name: 'Osmium', atomicMass: 190.23, category: 'transition metal', electronConfiguration: '[Xe] 4f14 5d6 6s2', electronegativity: 2.2, meltingPoint: 3306, boilingPoint: 5285, density: 22.587, ionizationEnergy: 840.0, discoveryYear: 1803, crystalStructure: 'hexagonal close-packed' },
  { number: 77, symbol: 'Ir', name: 'Iridium', atomicMass: 192.22, category: 'transition metal', electronConfiguration: '[Xe] 4f14 5d7 6s2', electronegativity: 2.20, meltingPoint: 2739, boilingPoint: 4701, density: 22.56, ionizationEnergy: 880.0, discoveryYear: 1803, crystalStructure: 'face-centered cubic' },
  { number: 78, symbol: 'Pt', name: 'Platinum', atomicMass: 195.08, category: 'transition metal', electronConfiguration: '[Xe] 4f14 5d9 6s1', electronegativity: 2.28, meltingPoint: 2041.4, boilingPoint: 4098, density: 21.46, ionizationEnergy: 870.0, discoveryYear: 1735, crystalStructure: 'face-centered cubic' },
  { number: 79, symbol: 'Au', name: 'Gold', atomicMass: 196.97, category: 'transition metal', electronConfiguration: '[Xe] 4f14 5d10 6s1', electronegativity: 2.54, meltingPoint: 1337.33, boilingPoint: 3129, density: 19.282, ionizationEnergy: 890.1, discoveryYear: null, crystalStructure: 'face-centered cubic' },
  { number: 80, symbol: 'Hg', name: 'Mercury', atomicMass: 200.59, category: 'transition metal', electronConfiguration: '[Xe] 4f14 5d10 6s2', electronegativity: 2.00, meltingPoint: 234.32, boilingPoint: 629.88, density: 13.5336, ionizationEnergy: 1007.1, discoveryYear: null, crystalStructure: 'rhombohedral' },
  { number: 81, symbol: 'Tl', name: 'Thallium', atomicMass: 204.38, category: 'post-transition metal', electronConfiguration: '[Xe] 4f14 5d10 6s2 6p1', electronegativity: 1.62, meltingPoint: 577, boilingPoint: 1746, density: 11.85, ionizationEnergy: 589.4, discoveryYear: 1861, crystalStructure: 'hexagonal close-packed' },
  { number: 82, symbol: 'Pb', name: 'Lead', atomicMass: 207.2, category: 'post-transition metal', electronConfiguration: '[Xe] 4f14 5d10 6s2 6p2', electronegativity: 1.87, meltingPoint: 600.61, boilingPoint: 2022, density: 11.342, ionizationEnergy: 715.6, discoveryYear: null, crystalStructure: 'face-centered cubic' },
  { number: 83, symbol: 'Bi', name: 'Bismuth', atomicMass: 208.98, category: 'post-transition metal', electronConfiguration: '[Xe] 4f14 5d10 6s2 6p3', electronegativity: 2.02, meltingPoint: 544.55, boilingPoint: 1837, density: 9.807, ionizationEnergy: 703.0, discoveryYear: 1753, crystalStructure: 'rhombohedral' },
  { number: 84, symbol: 'Po', name: 'Polonium', atomicMass: 209, category: 'metalloid', electronConfiguration: '[Xe] 4f14 5d10 6s2 6p4', electronegativity: 2.0, meltingPoint: 527, boilingPoint: 1235, density: 9.32, ionizationEnergy: 812.1, discoveryYear: 1898, crystalStructure: 'cubic' },
  { number: 85, symbol: 'At', name: 'Astatine', atomicMass: 210, category: 'halogen', electronConfiguration: '[Xe] 4f14 5d10 6s2 6p5', electronegativity: 2.2, meltingPoint: 575, boilingPoint: 610, density: null, ionizationEnergy: 920.0, discoveryYear: 1940, crystalStructure: null },
  { number: 86, symbol: 'Rn', name: 'Radon', atomicMass: 222, category: 'noble gas', electronConfiguration: '[Xe] 4f14 5d10 6s2 6p6', electronegativity: null, meltingPoint: 202, boilingPoint: 211.3, density: 0.00973, ionizationEnergy: 1037.0, discoveryYear: 1900, crystalStructure: 'face-centered cubic' },
  { number: 87, symbol: 'Fr', name: 'Francium', atomicMass: 223, category: 'alkali metal', electronConfiguration: '[Rn] 7s1', electronegativity: 0.7, meltingPoint: 300, boilingPoint: 950, density: null, ionizationEnergy: 380.0, discoveryYear: 1939, crystalStructure: 'body-centered cubic' },
  { number: 88, symbol: 'Ra', name: 'Radium', atomicMass: 226, category: 'alkaline earth metal', electronConfiguration: '[Rn] 7s2', electronegativity: 0.9, meltingPoint: 973, boilingPoint: 2010, density: 5.5, ionizationEnergy: 509.3, discoveryYear: 1898, crystalStructure: 'body-centered cubic' },
  { number: 89, symbol: 'Ac', name: 'Actinium', atomicMass: 227, category: 'actinide', electronConfiguration: '[Rn] 6d1 7s2', electronegativity: 1.1, meltingPoint: 1323, boilingPoint: 3471, density: 10.07, ionizationEnergy: 499.0, discoveryYear: 1899, crystalStructure: 'face-centered cubic' },
  { number: 90, symbol: 'Th', name: 'Thorium', atomicMass: 232.04, category: 'actinide', electronConfiguration: '[Rn] 6d2 7s2', electronegativity: 1.3, meltingPoint: 2023, boilingPoint: 5061, density: 11.72, ionizationEnergy: 587.0, discoveryYear: 1829, crystalStructure: 'face-centered cubic' },
  { number: 91, symbol: 'Pa', name: 'Protactinium', atomicMass: 231.04, category: 'actinide', electronConfiguration: '[Rn] 5f2 6d1 7s2', electronegativity: 1.5, meltingPoint: 1841, boilingPoint: 4300, density: 15.37, ionizationEnergy: 568.0, discoveryYear: 1913, crystalStructure: 'tetragonal' },
  { number: 92, symbol: 'U', name: 'Uranium', atomicMass: 238.03, category: 'actinide', electronConfiguration: '[Rn] 5f3 6d1 7s2', electronegativity: 1.38, meltingPoint: 1405.3, boilingPoint: 4404, density: 18.95, ionizationEnergy: 597.6, discoveryYear: 1789, crystalStructure: 'orthorhombic' },
  { number: 93, symbol: 'Np', name: 'Neptunium', atomicMass: 237, category: 'actinide', electronConfiguration: '[Rn] 5f4 6d1 7s2', electronegativity: 1.36, meltingPoint: 917, boilingPoint: 4175, density: 20.45, ionizationEnergy: 604.5, discoveryYear: 1940, crystalStructure: 'orthorhombic' },
  { number: 94, symbol: 'Pu', name: 'Plutonium', atomicMass: 244, category: 'actinide', electronConfiguration: '[Rn] 5f6 7s2', electronegativity: 1.28, meltingPoint: 912.5, boilingPoint: 3501, density: 19.84, ionizationEnergy: 584.7, discoveryYear: 1940, crystalStructure: 'monoclinic' },
  { number: 95, symbol: 'Am', name: 'Americium', atomicMass: 243, category: 'actinide', electronConfiguration: '[Rn] 5f7 7s2', electronegativity: 1.3, meltingPoint: 1449, boilingPoint: 2880, density: 13.69, ionizationEnergy: 578.0, discoveryYear: 1944, crystalStructure: 'hexagonal close-packed' },
  { number: 96, symbol: 'Cm', name: 'Curium', atomicMass: 247, category: 'actinide', electronConfiguration: '[Rn] 5f7 6d1 7s2', electronegativity: 1.3, meltingPoint: 1613, boilingPoint: 3383, density: 13.51, ionizationEnergy: 581.0, discoveryYear: 1944, crystalStructure: 'hexagonal close-packed' },
  { number: 97, symbol: 'Bk', name: 'Berkelium', atomicMass: 247, category: 'actinide', electronConfiguration: '[Rn] 5f9 7s2', electronegativity: 1.3, meltingPoint: 1259, boilingPoint: 2900, density: 14.79, ionizationEnergy: 601.0, discoveryYear: 1949, crystalStructure: 'hexagonal close-packed' },
  { number: 98, symbol: 'Cf', name: 'Californium', atomicMass: 251, category: 'actinide', electronConfiguration: '[Rn] 5f10 7s2', electronegativity: 1.3, meltingPoint: 1173, boilingPoint: 1743, density: 15.1, ionizationEnergy: 608.0, discoveryYear: 1950, crystalStructure: 'hexagonal close-packed' },
  { number: 99, symbol: 'Es', name: 'Einsteinium', atomicMass: 252, category: 'actinide', electronConfiguration: '[Rn] 5f11 7s2', electronegativity: 1.3, meltingPoint: 1133, boilingPoint: 1269, density: 8.84, ionizationEnergy: 619.0, discoveryYear: 1952, crystalStructure: 'face-centered cubic' },
  { number: 100, symbol: 'Fm', name: 'Fermium', atomicMass: 257, category: 'actinide', electronConfiguration: '[Rn] 5f12 7s2', electronegativity: 1.3, meltingPoint: 1800, boilingPoint: null, density: null, ionizationEnergy: 627.0, discoveryYear: 1952, crystalStructure: null },
  { number: 101, symbol: 'Md', name: 'Mendelevium', atomicMass: 258, category: 'actinide', electronConfiguration: '[Rn] 5f13 7s2', electronegativity: 1.3, meltingPoint: 1100, boilingPoint: null, density: null, ionizationEnergy: 635.0, discoveryYear: 1955, crystalStructure: null },
  { number: 102, symbol: 'No', name: 'Nobelium', atomicMass: 259, category: 'actinide', electronConfiguration: '[Rn] 5f14 7s2', electronegativity: 1.3, meltingPoint: 1100, boilingPoint: null, density: null, ionizationEnergy: 642.0, discoveryYear: 1958, crystalStructure: null },
  { number: 103, symbol: 'Lr', name: 'Lawrencium', atomicMass: 266, category: 'actinide', electronConfiguration: '[Rn] 5f14 7s2 7p1', electronegativity: 1.3, meltingPoint: 1900, boilingPoint: null, density: null, ionizationEnergy: 470.0, discoveryYear: 1961, crystalStructure: null },
  { number: 104, symbol: 'Rf', name: 'Rutherfordium', atomicMass: 267, category: 'transition metal', electronConfiguration: '[Rn] 5f14 6d2 7s2', electronegativity: null, meltingPoint: null, boilingPoint: null, density: null, ionizationEnergy: 580.0, discoveryYear: 1964, crystalStructure: null },
  { number: 105, symbol: 'Db', name: 'Dubnium', atomicMass: 268, category: 'transition metal', electronConfiguration: '[Rn] 5f14 6d3 7s2', electronegativity: null, meltingPoint: null, boilingPoint: null, density: null, ionizationEnergy: null, discoveryYear: 1967, crystalStructure: null },
  { number: 106, symbol: 'Sg', name: 'Seaborgium', atomicMass: 269, category: 'transition metal', electronConfiguration: '[Rn] 5f14 6d4 7s2', electronegativity: null, meltingPoint: null, boilingPoint: null, density: null, ionizationEnergy: null, discoveryYear: 1974, crystalStructure: null },
  { number: 107, symbol: 'Bh', name: 'Bohrium', atomicMass: 270, category: 'transition metal', electronConfiguration: '[Rn] 5f14 6d5 7s2', electronegativity: null, meltingPoint: null, boilingPoint: null, density: null, ionizationEnergy: null, discoveryYear: 1981, crystalStructure: null },
  { number: 108, symbol: 'Hs', name: 'Hassium', atomicMass: 277, category: 'transition metal', electronConfiguration: '[Rn] 5f14 6d6 7s2', electronegativity: null, meltingPoint: null, boilingPoint: null, density: null, ionizationEnergy: null, discoveryYear: 1984, crystalStructure: null },
  { number: 109, symbol: 'Mt', name: 'Meitnerium', atomicMass: 278, category: 'unknown', electronConfiguration: '[Rn] 5f14 6d7 7s2', electronegativity: null, meltingPoint: null, boilingPoint: null, density: null, ionizationEnergy: null, discoveryYear: 1982, crystalStructure: null },
  { number: 110, symbol: 'Ds', name: 'Darmstadtium', atomicMass: 281, category: 'unknown', electronConfiguration: '[Rn] 5f14 6d8 7s2', electronegativity: null, meltingPoint: null, boilingPoint: null, density: null, ionizationEnergy: null, discoveryYear: 1994, crystalStructure: null },
  { number: 111, symbol: 'Rg', name: 'Roentgenium', atomicMass: 282, category: 'unknown', electronConfiguration: '[Rn] 5f14 6d9 7s2', electronegativity: null, meltingPoint: null, boilingPoint: null, density: null, ionizationEnergy: null, discoveryYear: 1994, crystalStructure: null },
  { number: 112, symbol: 'Cn', name: 'Copernicium', atomicMass: 285, category: 'unknown', electronConfiguration: '[Rn] 5f14 6d10 7s2', electronegativity: null, meltingPoint: null, boilingPoint: null, density: null, ionizationEnergy: null, discoveryYear: 1996, crystalStructure: null },
  { number: 113, symbol: 'Nh', name: 'Nihonium', atomicMass: 286, category: 'unknown', electronConfiguration: '[Rn] 5f14 6d10 7s2 7p1', electronegativity: null, meltingPoint: null, boilingPoint: null, density: null, ionizationEnergy: null, discoveryYear: 2003, crystalStructure: null },
  { number: 114, symbol: 'Fl', name: 'Flerovium', atomicMass: 289, category: 'unknown', electronConfiguration: '[Rn] 5f14 6d10 7s2 7p2', electronegativity: null, meltingPoint: null, boilingPoint: null, density: null, ionizationEnergy: null, discoveryYear: 1998, crystalStructure: null },
  { number: 115, symbol: 'Mc', name: 'Moscovium', atomicMass: 290, category: 'unknown', electronConfiguration: '[Rn] 5f14 6d10 7s2 7p3', electronegativity: null, meltingPoint: null, boilingPoint: null, density: null, ionizationEnergy: null, discoveryYear: 2003, crystalStructure: null },
  { number: 116, symbol: 'Lv', name: 'Livermorium', atomicMass: 293, category: 'unknown', electronConfiguration: '[Rn] 5f14 6d10 7s2 7p4', electronegativity: null, meltingPoint: null, boilingPoint: null, density: null, ionizationEnergy: null, discoveryYear: 2000, crystalStructure: null },
  { number: 117, symbol: 'Ts', name: 'Tennessine', atomicMass: 294, category: 'unknown', electronConfiguration: '[Rn] 5f14 6d10 7s2 7p5', electronegativity: null, meltingPoint: null, boilingPoint: null, density: null, ionizationEnergy: null, discoveryYear: 2010, crystalStructure: null },
  { number: 118, symbol: 'Og', name: 'Oganesson', atomicMass: 294, category: 'unknown', electronConfiguration: '[Rn] 5f14 6d10 7s2 7p6', electronegativity: null, meltingPoint: null, boilingPoint: null, density: null, ionizationEnergy: null, discoveryYear: 2002, crystalStructure: null },
]

// Index lookups for fast access
const bySymbol = new Map<string, ElementData>()
const byName = new Map<string, ElementData>()
const byNumber = new Map<number, ElementData>()
for (const el of PERIODIC_TABLE) {
  bySymbol.set(el.symbol.toLowerCase(), el)
  byName.set(el.name.toLowerCase(), el)
  byNumber.set(el.number, el)
}

function lookupElement(query: string): ElementData | undefined {
  const q = query.trim()
  const num = Number(q)
  if (!isNaN(num) && num >= 1 && num <= 118) return byNumber.get(num)
  const lower = q.toLowerCase()
  return bySymbol.get(lower) || byName.get(lower)
}

// ─────────────────────────────────────────────────────────────────────────────
// Thermodynamic data — standard state at 298.15 K, 1 atm
// ─────────────────────────────────────────────────────────────────────────────

interface ThermoEntry {
  formula: string
  name: string
  deltaHf: number | null   // kJ/mol  standard enthalpy of formation
  S: number | null          // J/(mol·K) standard molar entropy
  Cp: number | null         // J/(mol·K) heat capacity at const pressure
  deltaGf: number | null    // kJ/mol  standard Gibbs free energy of formation
}

const THERMO_TABLE: ThermoEntry[] = [
  { formula: 'H2', name: 'hydrogen', deltaHf: 0, S: 130.68, Cp: 28.84, deltaGf: 0 },
  { formula: 'O2', name: 'oxygen', deltaHf: 0, S: 205.14, Cp: 29.38, deltaGf: 0 },
  { formula: 'N2', name: 'nitrogen', deltaHf: 0, S: 191.61, Cp: 29.12, deltaGf: 0 },
  { formula: 'C', name: 'carbon (graphite)', deltaHf: 0, S: 5.74, Cp: 8.53, deltaGf: 0 },
  { formula: 'C(diamond)', name: 'carbon (diamond)', deltaHf: 1.90, S: 2.38, Cp: 6.11, deltaGf: 2.90 },
  { formula: 'S', name: 'sulfur (rhombic)', deltaHf: 0, S: 32.07, Cp: 22.64, deltaGf: 0 },
  { formula: 'Fe', name: 'iron', deltaHf: 0, S: 27.28, Cp: 25.10, deltaGf: 0 },
  { formula: 'Cu', name: 'copper', deltaHf: 0, S: 33.15, Cp: 24.44, deltaGf: 0 },
  { formula: 'Al', name: 'aluminium', deltaHf: 0, S: 28.33, Cp: 24.35, deltaGf: 0 },
  { formula: 'Na', name: 'sodium', deltaHf: 0, S: 51.21, Cp: 28.24, deltaGf: 0 },
  { formula: 'K', name: 'potassium', deltaHf: 0, S: 64.18, Cp: 29.58, deltaGf: 0 },
  { formula: 'Ca', name: 'calcium', deltaHf: 0, S: 41.42, Cp: 25.31, deltaGf: 0 },
  { formula: 'Mg', name: 'magnesium', deltaHf: 0, S: 32.68, Cp: 24.89, deltaGf: 0 },
  { formula: 'Zn', name: 'zinc', deltaHf: 0, S: 41.63, Cp: 25.40, deltaGf: 0 },
  { formula: 'Ag', name: 'silver', deltaHf: 0, S: 42.55, Cp: 25.35, deltaGf: 0 },
  { formula: 'H2O(l)', name: 'water (liquid)', deltaHf: -285.83, S: 69.91, Cp: 75.29, deltaGf: -237.13 },
  { formula: 'H2O(g)', name: 'water (gas)', deltaHf: -241.82, S: 188.83, Cp: 33.58, deltaGf: -228.57 },
  { formula: 'CO2', name: 'carbon dioxide', deltaHf: -393.51, S: 213.74, Cp: 37.11, deltaGf: -394.36 },
  { formula: 'CO', name: 'carbon monoxide', deltaHf: -110.53, S: 197.67, Cp: 29.14, deltaGf: -137.17 },
  { formula: 'CH4', name: 'methane', deltaHf: -74.81, S: 186.26, Cp: 35.31, deltaGf: -50.72 },
  { formula: 'C2H6', name: 'ethane', deltaHf: -84.68, S: 229.60, Cp: 52.63, deltaGf: -32.82 },
  { formula: 'C2H4', name: 'ethylene', deltaHf: 52.26, S: 219.56, Cp: 43.56, deltaGf: 68.15 },
  { formula: 'C2H2', name: 'acetylene', deltaHf: 226.73, S: 200.94, Cp: 43.93, deltaGf: 209.20 },
  { formula: 'C3H8', name: 'propane', deltaHf: -103.85, S: 269.91, Cp: 73.51, deltaGf: -23.49 },
  { formula: 'C6H6(l)', name: 'benzene (liquid)', deltaHf: 49.03, S: 172.80, Cp: 136.1, deltaGf: 124.50 },
  { formula: 'CH3OH(l)', name: 'methanol (liquid)', deltaHf: -238.66, S: 126.80, Cp: 81.6, deltaGf: -166.27 },
  { formula: 'C2H5OH(l)', name: 'ethanol (liquid)', deltaHf: -277.69, S: 160.70, Cp: 111.46, deltaGf: -174.78 },
  { formula: 'CH3COOH(l)', name: 'acetic acid (liquid)', deltaHf: -484.50, S: 159.80, Cp: 123.3, deltaGf: -389.90 },
  { formula: 'NH3', name: 'ammonia', deltaHf: -46.11, S: 192.45, Cp: 35.06, deltaGf: -16.45 },
  { formula: 'NO', name: 'nitric oxide', deltaHf: 90.25, S: 210.76, Cp: 29.84, deltaGf: 86.55 },
  { formula: 'NO2', name: 'nitrogen dioxide', deltaHf: 33.18, S: 240.06, Cp: 37.20, deltaGf: 51.31 },
  { formula: 'N2O', name: 'nitrous oxide', deltaHf: 82.05, S: 219.85, Cp: 38.45, deltaGf: 104.20 },
  { formula: 'N2O4', name: 'dinitrogen tetroxide', deltaHf: 9.16, S: 304.29, Cp: 77.28, deltaGf: 97.89 },
  { formula: 'HNO3(l)', name: 'nitric acid (liquid)', deltaHf: -174.10, S: 155.60, Cp: 109.87, deltaGf: -80.71 },
  { formula: 'SO2', name: 'sulfur dioxide', deltaHf: -296.83, S: 248.22, Cp: 39.87, deltaGf: -300.19 },
  { formula: 'SO3', name: 'sulfur trioxide', deltaHf: -395.72, S: 256.76, Cp: 50.67, deltaGf: -371.06 },
  { formula: 'H2SO4(l)', name: 'sulfuric acid (liquid)', deltaHf: -813.99, S: 156.90, Cp: 138.9, deltaGf: -690.00 },
  { formula: 'H2S', name: 'hydrogen sulfide', deltaHf: -20.63, S: 205.79, Cp: 34.23, deltaGf: -33.56 },
  { formula: 'HCl', name: 'hydrogen chloride', deltaHf: -92.31, S: 186.91, Cp: 29.12, deltaGf: -95.30 },
  { formula: 'HF', name: 'hydrogen fluoride', deltaHf: -271.10, S: 173.78, Cp: 29.13, deltaGf: -273.20 },
  { formula: 'HBr', name: 'hydrogen bromide', deltaHf: -36.40, S: 198.70, Cp: 29.14, deltaGf: -53.45 },
  { formula: 'HI', name: 'hydrogen iodide', deltaHf: 26.48, S: 206.59, Cp: 29.16, deltaGf: 1.70 },
  { formula: 'NaCl', name: 'sodium chloride', deltaHf: -411.15, S: 72.13, Cp: 50.50, deltaGf: -384.14 },
  { formula: 'NaOH', name: 'sodium hydroxide', deltaHf: -425.61, S: 64.46, Cp: 59.54, deltaGf: -379.49 },
  { formula: 'KCl', name: 'potassium chloride', deltaHf: -436.75, S: 82.59, Cp: 51.30, deltaGf: -409.14 },
  { formula: 'CaCO3', name: 'calcium carbonate', deltaHf: -1206.92, S: 92.88, Cp: 81.88, deltaGf: -1128.79 },
  { formula: 'CaO', name: 'calcium oxide', deltaHf: -635.09, S: 39.75, Cp: 42.80, deltaGf: -604.03 },
  { formula: 'Ca(OH)2', name: 'calcium hydroxide', deltaHf: -986.09, S: 83.39, Cp: 87.49, deltaGf: -898.49 },
  { formula: 'MgO', name: 'magnesium oxide', deltaHf: -601.70, S: 26.94, Cp: 37.15, deltaGf: -569.43 },
  { formula: 'Al2O3', name: 'aluminium oxide', deltaHf: -1675.70, S: 50.92, Cp: 79.04, deltaGf: -1582.30 },
  { formula: 'Fe2O3', name: 'iron(III) oxide', deltaHf: -824.20, S: 87.40, Cp: 103.85, deltaGf: -742.20 },
  { formula: 'Fe3O4', name: 'iron(II,III) oxide', deltaHf: -1118.40, S: 146.40, Cp: 143.43, deltaGf: -1015.40 },
  { formula: 'FeO', name: 'iron(II) oxide', deltaHf: -272.00, S: 60.75, Cp: 49.92, deltaGf: -255.10 },
  { formula: 'SiO2', name: 'silicon dioxide (quartz)', deltaHf: -910.94, S: 41.84, Cp: 44.43, deltaGf: -856.64 },
  { formula: 'TiO2', name: 'titanium dioxide (rutile)', deltaHf: -944.70, S: 50.33, Cp: 55.02, deltaGf: -889.50 },
  { formula: 'ZnO', name: 'zinc oxide', deltaHf: -348.28, S: 43.64, Cp: 40.25, deltaGf: -318.30 },
  { formula: 'CuO', name: 'copper(II) oxide', deltaHf: -157.30, S: 42.63, Cp: 42.30, deltaGf: -129.70 },
  { formula: 'Cu2O', name: 'copper(I) oxide', deltaHf: -168.60, S: 93.14, Cp: 63.64, deltaGf: -146.00 },
  { formula: 'PbO', name: 'lead(II) oxide', deltaHf: -219.00, S: 66.50, Cp: 45.77, deltaGf: -188.93 },
  { formula: 'AgCl', name: 'silver chloride', deltaHf: -127.07, S: 96.20, Cp: 50.79, deltaGf: -109.79 },
  { formula: 'BaSO4', name: 'barium sulfate', deltaHf: -1473.20, S: 132.20, Cp: 101.75, deltaGf: -1362.20 },
  { formula: 'KMnO4', name: 'potassium permanganate', deltaHf: -837.20, S: 171.71, Cp: 117.6, deltaGf: -737.60 },
  { formula: 'KClO3', name: 'potassium chlorate', deltaHf: -397.73, S: 143.10, Cp: 100.25, deltaGf: -296.25 },
  { formula: 'NaHCO3', name: 'sodium bicarbonate', deltaHf: -950.81, S: 101.70, Cp: 87.61, deltaGf: -851.00 },
  { formula: 'Na2CO3', name: 'sodium carbonate', deltaHf: -1130.68, S: 135.00, Cp: 112.30, deltaGf: -1044.44 },
  { formula: 'H2O2(l)', name: 'hydrogen peroxide (liquid)', deltaHf: -187.78, S: 109.60, Cp: 89.1, deltaGf: -120.35 },
  { formula: 'O3', name: 'ozone', deltaHf: 142.70, S: 238.93, Cp: 39.24, deltaGf: 163.20 },
  { formula: 'Cl2', name: 'chlorine', deltaHf: 0, S: 223.07, Cp: 33.91, deltaGf: 0 },
  { formula: 'Br2(l)', name: 'bromine (liquid)', deltaHf: 0, S: 152.23, Cp: 75.69, deltaGf: 0 },
  { formula: 'I2', name: 'iodine', deltaHf: 0, S: 116.14, Cp: 54.44, deltaGf: 0 },
  { formula: 'F2', name: 'fluorine', deltaHf: 0, S: 202.78, Cp: 31.30, deltaGf: 0 },
  { formula: 'P4', name: 'phosphorus (white)', deltaHf: 0, S: 164.36, Cp: 95.40, deltaGf: 0 },
  { formula: 'PCl3', name: 'phosphorus trichloride', deltaHf: -287.00, S: 311.78, Cp: 71.84, deltaGf: -267.80 },
  { formula: 'PCl5', name: 'phosphorus pentachloride', deltaHf: -374.90, S: 364.58, Cp: 112.80, deltaGf: -305.00 },
  { formula: 'POCl3', name: 'phosphoryl chloride', deltaHf: -597.10, S: 222.50, Cp: 84.90, deltaGf: -520.80 },
  { formula: 'CCl4(l)', name: 'carbon tetrachloride (liquid)', deltaHf: -135.44, S: 216.40, Cp: 131.75, deltaGf: -65.21 },
  { formula: 'CHCl3(l)', name: 'chloroform (liquid)', deltaHf: -134.47, S: 201.70, Cp: 114.2, deltaGf: -73.66 },
  { formula: 'CS2(l)', name: 'carbon disulfide (liquid)', deltaHf: 89.70, S: 151.34, Cp: 75.7, deltaGf: 65.27 },
  { formula: 'COCl2', name: 'phosgene', deltaHf: -218.80, S: 283.53, Cp: 57.66, deltaGf: -204.60 },
  { formula: 'glucose', name: 'glucose (C6H12O6)', deltaHf: -1274.40, S: 212.10, Cp: 218.0, deltaGf: -910.30 },
  { formula: 'sucrose', name: 'sucrose (C12H22O11)', deltaHf: -2222.10, S: 360.20, Cp: 424.3, deltaGf: -1544.65 },
  { formula: 'urea', name: 'urea (CH4N2O)', deltaHf: -333.50, S: 104.60, Cp: 93.14, deltaGf: -197.33 },
  { formula: 'C(g)', name: 'carbon (gas)', deltaHf: 716.68, S: 158.10, Cp: 20.84, deltaGf: 671.26 },
  { formula: 'H(g)', name: 'hydrogen atom (gas)', deltaHf: 217.97, S: 114.71, Cp: 20.78, deltaGf: 203.25 },
  { formula: 'O(g)', name: 'oxygen atom (gas)', deltaHf: 249.17, S: 161.06, Cp: 21.91, deltaGf: 231.73 },
  { formula: 'N(g)', name: 'nitrogen atom (gas)', deltaHf: 472.70, S: 153.30, Cp: 20.79, deltaGf: 455.56 },
  { formula: 'Cl(g)', name: 'chlorine atom (gas)', deltaHf: 121.68, S: 165.20, Cp: 21.84, deltaGf: 105.68 },
  { formula: 'Na+(aq)', name: 'sodium ion (aqueous)', deltaHf: -240.12, S: 59.00, Cp: 46.4, deltaGf: -261.91 },
  { formula: 'Cl-(aq)', name: 'chloride ion (aqueous)', deltaHf: -167.16, S: 56.50, Cp: -136.4, deltaGf: -131.23 },
  { formula: 'H+(aq)', name: 'hydrogen ion (aqueous)', deltaHf: 0, S: 0, Cp: 0, deltaGf: 0 },
  { formula: 'OH-(aq)', name: 'hydroxide ion (aqueous)', deltaHf: -229.99, S: -10.75, Cp: -148.5, deltaGf: -157.24 },
  { formula: 'Ca2+(aq)', name: 'calcium ion (aqueous)', deltaHf: -542.83, S: -53.10, Cp: null, deltaGf: -553.58 },
  { formula: 'Fe2+(aq)', name: 'iron(II) ion (aqueous)', deltaHf: -89.10, S: -137.70, Cp: null, deltaGf: -78.90 },
  { formula: 'Fe3+(aq)', name: 'iron(III) ion (aqueous)', deltaHf: -48.50, S: -315.90, Cp: null, deltaGf: -4.70 },
  { formula: 'Cu2+(aq)', name: 'copper(II) ion (aqueous)', deltaHf: 64.77, S: -99.60, Cp: null, deltaGf: 65.49 },
  { formula: 'Zn2+(aq)', name: 'zinc ion (aqueous)', deltaHf: -153.89, S: -112.10, Cp: null, deltaGf: -147.06 },
  { formula: 'Ag+(aq)', name: 'silver ion (aqueous)', deltaHf: 105.58, S: 72.68, Cp: null, deltaGf: 77.11 },
  { formula: 'CO3^2-(aq)', name: 'carbonate ion (aqueous)', deltaHf: -677.14, S: -56.90, Cp: null, deltaGf: -527.81 },
  { formula: 'SO4^2-(aq)', name: 'sulfate ion (aqueous)', deltaHf: -909.27, S: 20.10, Cp: null, deltaGf: -744.53 },
  { formula: 'NO3-(aq)', name: 'nitrate ion (aqueous)', deltaHf: -205.00, S: 146.40, Cp: null, deltaGf: -108.74 },
  { formula: 'PO4^3-(aq)', name: 'phosphate ion (aqueous)', deltaHf: -1277.40, S: -220.50, Cp: null, deltaGf: -1018.70 },
]

const thermoByFormula = new Map<string, ThermoEntry>()
const thermoByName = new Map<string, ThermoEntry>()
for (const t of THERMO_TABLE) {
  thermoByFormula.set(t.formula.toLowerCase(), t)
  thermoByName.set(t.name.toLowerCase(), t)
}

function lookupThermo(query: string): ThermoEntry | undefined {
  const q = query.trim().toLowerCase()
  return thermoByFormula.get(q) || thermoByName.get(q) ||
    THERMO_TABLE.find(t => t.name.toLowerCase().includes(q) || t.formula.toLowerCase().includes(q))
}

// ─────────────────────────────────────────────────────────────────────────────
// Formula parser & stoichiometry engine
// ─────────────────────────────────────────────────────────────────────────────

/** Parse a chemical formula into element counts: "Ca(OH)2" → {Ca:1, O:2, H:2} */
function parseFormula(formula: string): Record<string, number> {
  const counts: Record<string, number> = {}
  const stack: Record<string, number>[] = [counts]

  let i = 0
  while (i < formula.length) {
    const ch = formula[i]

    if (ch === '(') {
      const inner: Record<string, number> = {}
      stack.push(inner)
      i++
    } else if (ch === ')') {
      i++
      // Read subscript after closing paren
      let numStr = ''
      while (i < formula.length && /\d/.test(formula[i])) {
        numStr += formula[i]
        i++
      }
      const mult = numStr ? parseInt(numStr, 10) : 1
      const inner = stack.pop()!
      const outer = stack[stack.length - 1]
      for (const [el, cnt] of Object.entries(inner)) {
        outer[el] = (outer[el] || 0) + cnt * mult
      }
    } else if (ch === '·' || ch === '.') {
      // Hydrate: e.g. CuSO4·5H2O
      i++
      let numStr = ''
      while (i < formula.length && /\d/.test(formula[i])) {
        numStr += formula[i]
        i++
      }
      const mult = numStr ? parseInt(numStr, 10) : 1
      const rest = formula.slice(i)
      const hydrateCounts = parseFormula(rest)
      const target = stack[stack.length - 1]
      for (const [el, cnt] of Object.entries(hydrateCounts)) {
        target[el] = (target[el] || 0) + cnt * mult
      }
      i = formula.length // consumed rest
    } else if (/[A-Z]/.test(ch)) {
      // Element symbol: uppercase optionally followed by lowercase
      let sym = ch
      i++
      while (i < formula.length && /[a-z]/.test(formula[i])) {
        sym += formula[i]
        i++
      }
      // Read subscript
      let numStr = ''
      while (i < formula.length && /\d/.test(formula[i])) {
        numStr += formula[i]
        i++
      }
      const cnt = numStr ? parseInt(numStr, 10) : 1
      const target = stack[stack.length - 1]
      target[sym] = (target[sym] || 0) + cnt
    } else {
      i++ // skip unknown chars
    }
  }
  return counts
}

/** Get the molecular weight of a formula */
function formulaWeight(formula: string): number {
  const counts = parseFormula(formula)
  let mw = 0
  for (const [sym, cnt] of Object.entries(counts)) {
    const el = bySymbol.get(sym.toLowerCase())
    if (el) mw += el.atomicMass * cnt
  }
  return mw
}

/** Format element counts as formula string */
function countsToFormula(counts: Record<string, number>): string {
  return Object.entries(counts)
    .map(([el, n]) => n === 1 ? el : `${el}${n}`)
    .join('')
}

/**
 * Balance a chemical equation using Gaussian elimination.
 * Input: "Fe + O2 -> Fe2O3"
 * Output: [4, 3, 2] meaning 4Fe + 3O2 -> 2Fe2O3
 */
function balanceEquation(equation: string): { reactants: string[]; products: string[]; coefficients: number[] } | string {
  // Parse equation
  const sides = equation.split(/->|→|=/)
  if (sides.length !== 2) return 'Error: equation must have exactly one arrow (->)'

  const reactants = sides[0].split('+').map(s => s.trim()).filter(Boolean)
  const products = sides[1].split('+').map(s => s.trim()).filter(Boolean)
  const compounds = [...reactants, ...products]
  const n = compounds.length

  if (n < 2) return 'Error: need at least 2 compounds'

  // Parse each compound and collect all elements
  const parsed = compounds.map(c => parseFormula(c))
  const elements = new Set<string>()
  for (const p of parsed) {
    for (const el of Object.keys(p)) elements.add(el)
  }
  const elList = Array.from(elements)
  const m = elList.length // rows = elements

  // Build matrix: rows = elements, cols = compounds
  // Reactants have positive coefficients, products negative
  const matrix: number[][] = []
  for (let r = 0; r < m; r++) {
    const row: number[] = []
    for (let c = 0; c < n; c++) {
      const sign = c < reactants.length ? 1 : -1
      row.push(sign * (parsed[c][elList[r]] || 0))
    }
    matrix.push(row)
  }

  // Gaussian elimination on augmented-like system (homogeneous: Ax = 0)
  // We solve for x[0..n-2] in terms of x[n-1] (set x[n-1] = free variable)
  const rows = matrix.length
  const cols = n

  // Forward elimination
  let pivotRow = 0
  const pivotCols: number[] = []
  for (let col = 0; col < cols - 1 && pivotRow < rows; col++) {
    // Find best pivot
    let maxVal = 0
    let maxRow = -1
    for (let r = pivotRow; r < rows; r++) {
      if (Math.abs(matrix[r][col]) > maxVal) {
        maxVal = Math.abs(matrix[r][col])
        maxRow = r
      }
    }
    if (maxVal < 1e-10) continue // skip this column
    // Swap
    ;[matrix[pivotRow], matrix[maxRow]] = [matrix[maxRow], matrix[pivotRow]]
    pivotCols.push(col)
    // Eliminate below
    for (let r = 0; r < rows; r++) {
      if (r === pivotRow) continue
      const factor = matrix[r][col] / matrix[pivotRow][col]
      for (let c = col; c < cols; c++) {
        matrix[r][c] -= factor * matrix[pivotRow][c]
      }
    }
    pivotRow++
  }

  // Back-substitute: set last variable = 1, solve rest
  const solution = new Array(n).fill(0)
  solution[n - 1] = 1

  // Work backwards through pivot columns
  for (let i = pivotCols.length - 1; i >= 0; i--) {
    const col = pivotCols[i]
    const row = i
    let sum = 0
    for (let c = col + 1; c < cols; c++) {
      sum += matrix[row][c] * solution[c]
    }
    if (Math.abs(matrix[row][col]) < 1e-10) continue
    solution[col] = -sum / matrix[row][col]
  }

  // Check for zero solutions
  if (solution.every(v => Math.abs(v) < 1e-10)) {
    return 'Error: could not balance equation (trivial solution)'
  }

  // Make all positive (flip if needed)
  const hasNeg = solution.some(v => v < -1e-10)
  if (hasNeg) {
    for (let i = 0; i < n; i++) solution[i] = -solution[i]
  }

  // If any are still negative, the equation may be impossible
  if (solution.some(v => v < -1e-10)) {
    return 'Error: could not find non-negative integer solution'
  }

  // Convert to smallest integers: find LCM of denominators
  // First, find a common scale by rounding to rational numbers
  const minPositive = Math.min(...solution.filter(v => v > 1e-10))
  const normalized = solution.map(v => v / minPositive)

  // Try multipliers 1..1000 to find integer solution
  for (let mult = 1; mult <= 1000; mult++) {
    const scaled = normalized.map(v => Math.round(v * mult))
    // Verify: check if scaled values reproduce the original ratios
    const valid = scaled.every(v => v > 0) &&
      normalized.every((v, i) => Math.abs(scaled[i] / mult - v) < 0.01)
    if (valid) {
      // Find GCD of all coefficients
      let g = scaled[0]
      for (let i = 1; i < scaled.length; i++) g = gcd(g, scaled[i])
      const final = scaled.map(v => v / g)
      return { reactants, products, coefficients: final }
    }
  }

  // Fallback: round to nearest integer
  const rounded = normalized.map(v => Math.max(1, Math.round(v)))
  return { reactants, products, coefficients: rounded }
}

function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b)
  while (b) { [a, b] = [b, a % b] }
  return a
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared fetch helper
// ─────────────────────────────────────────────────────────────────────────────

const UA = 'KBot/3.0 (Lab Tools)'

async function labFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json,text/html,*/*' },
    signal: AbortSignal.timeout(10000),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool registration
// ─────────────────────────────────────────────────────────────────────────────

export function registerLabChemTools(): void {

  // ── 1. compound_search ──────────────────────────────────────────────────
  registerTool({
    name: 'compound_search',
    description: 'Search PubChem for chemical compounds by name, molecular formula, SMILES, or InChI. Returns CID, IUPAC name, molecular formula, molecular weight, SMILES, and InChI.',
    parameters: {
      query: { type: 'string', description: 'Compound name, formula, SMILES, or InChI string', required: true },
      search_type: { type: 'string', description: 'Search namespace: name, formula, smiles, or inchi (default: name)' },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.query).trim()
      const searchType = String(args.search_type || 'name').toLowerCase()

      const nsMap: Record<string, string> = {
        name: 'name',
        formula: 'formula',
        smiles: 'smiles',
        inchi: 'inchi',
      }
      const ns = nsMap[searchType] || 'name'

      try {
        const encoded = encodeURIComponent(query)
        const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/${ns}/${encoded}/JSON`
        const res = await labFetch(url)

        if (!res.ok) {
          if (res.status === 404) return `No compounds found for ${searchType}="${query}" on PubChem.`
          return `PubChem API error: HTTP ${res.status}`
        }

        const data = await res.json() as {
          PC_Compounds?: Array<{
            id?: { id?: { cid?: number } }
            props?: Array<{ urn?: { label?: string; name?: string }; value?: { sval?: string; fval?: number; ival?: number } }>
          }>
        }

        const compounds = data.PC_Compounds
        if (!compounds?.length) return `No compounds found for ${searchType}="${query}".`

        const lines: string[] = [`## PubChem Search: "${query}" (${searchType})`, '']

        for (const comp of compounds.slice(0, 5)) {
          const cid = comp.id?.id?.cid || 'unknown'
          lines.push(`### CID: ${cid}`)

          const props = comp.props || []
          for (const prop of props) {
            const label = prop.urn?.label || ''
            const name = prop.urn?.name || ''
            const val = prop.value?.sval ?? prop.value?.fval ?? prop.value?.ival ?? ''
            if (label === 'IUPAC Name' && name === 'Preferred') {
              lines.push(`- **IUPAC Name**: ${val}`)
            } else if (label === 'Molecular Formula') {
              lines.push(`- **Formula**: ${val}`)
            } else if (label === 'Molecular Weight') {
              lines.push(`- **MW**: ${val} g/mol`)
            } else if (label === 'SMILES' && name === 'Canonical') {
              lines.push(`- **SMILES**: \`${val}\``)
            } else if (label === 'InChI' && name === 'Standard') {
              lines.push(`- **InChI**: \`${val}\``)
            } else if (label === 'InChIKey' && name === 'Standard') {
              lines.push(`- **InChIKey**: \`${val}\``)
            }
          }

          lines.push(`- **Link**: https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`)
          lines.push('')
        }

        return lines.join('\n')
      } catch (e) {
        return `Error searching PubChem: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })

  // ── 2. compound_properties ──────────────────────────────────────────────
  registerTool({
    name: 'compound_properties',
    description: 'Get physicochemical properties of a compound from PubChem: molecular weight, XLogP, TPSA, H-bond donors/acceptors, rotatable bonds, complexity, and Lipinski Rule-of-5 evaluation.',
    parameters: {
      identifier: { type: 'string', description: 'Compound name, CID, or SMILES string', required: true },
      identifier_type: { type: 'string', description: 'Type: name, cid, or smiles (default: name)' },
    },
    tier: 'free',
    async execute(args) {
      const identifier = String(args.identifier).trim()
      const idType = String(args.identifier_type || 'name').toLowerCase()

      const nsMap: Record<string, string> = { name: 'name', cid: 'cid', smiles: 'smiles' }
      const ns = nsMap[idType] || 'name'

      const properties = 'MolecularFormula,MolecularWeight,XLogP,TPSA,HBondDonorCount,HBondAcceptorCount,RotatableBondCount,Complexity,InChIKey'

      try {
        const encoded = encodeURIComponent(identifier)
        const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/${ns}/${encoded}/property/${properties}/JSON`
        const res = await labFetch(url)

        if (!res.ok) {
          if (res.status === 404) return `Compound not found: ${identifier}`
          return `PubChem API error: HTTP ${res.status}`
        }

        const data = await res.json() as {
          PropertyTable?: {
            Properties?: Array<{
              CID?: number
              MolecularFormula?: string
              MolecularWeight?: number
              XLogP?: number
              TPSA?: number
              HBondDonorCount?: number
              HBondAcceptorCount?: number
              RotatableBondCount?: number
              Complexity?: number
              InChIKey?: string
            }>
          }
        }

        const props = data.PropertyTable?.Properties?.[0]
        if (!props) return `No properties found for "${identifier}".`

        const mw = props.MolecularWeight ?? 0
        const xlogp = props.XLogP
        const hbd = props.HBondDonorCount ?? 0
        const hba = props.HBondAcceptorCount ?? 0

        // Lipinski Rule of 5
        const lipinski = {
          mw_ok: mw <= 500,
          logp_ok: xlogp != null ? xlogp <= 5 : true,
          hbd_ok: hbd <= 5,
          hba_ok: hba <= 10,
        }
        const violations = [
          !lipinski.mw_ok ? 'MW > 500' : null,
          !lipinski.logp_ok ? 'LogP > 5' : null,
          !lipinski.hbd_ok ? 'HBD > 5' : null,
          !lipinski.hba_ok ? 'HBA > 10' : null,
        ].filter(Boolean)
        const lipinskiPass = violations.length <= 1

        const lines = [
          `## Compound Properties: ${identifier}`,
          '',
          `| Property | Value |`,
          `|----------|-------|`,
          `| **CID** | ${props.CID ?? 'N/A'} |`,
          `| **Formula** | ${props.MolecularFormula ?? 'N/A'} |`,
          `| **Molecular Weight** | ${mw.toFixed(2)} g/mol |`,
          `| **XLogP** | ${xlogp != null ? xlogp.toFixed(2) : 'N/A'} |`,
          `| **TPSA** | ${props.TPSA != null ? props.TPSA.toFixed(2) + ' A^2' : 'N/A'} |`,
          `| **H-Bond Donors** | ${hbd} |`,
          `| **H-Bond Acceptors** | ${hba} |`,
          `| **Rotatable Bonds** | ${props.RotatableBondCount ?? 'N/A'} |`,
          `| **Complexity** | ${props.Complexity != null ? props.Complexity.toFixed(1) : 'N/A'} |`,
          `| **InChIKey** | \`${props.InChIKey ?? 'N/A'}\` |`,
          '',
          `### Lipinski Rule of 5`,
          `- **Status**: ${lipinskiPass ? 'PASS' : 'FAIL'} (${violations.length} violation${violations.length !== 1 ? 's' : ''})`,
        ]

        if (violations.length > 0) {
          lines.push(`- **Violations**: ${violations.join(', ')}`)
        }

        lines.push(`- MW <= 500: ${lipinski.mw_ok ? 'Yes' : 'No'} (${mw.toFixed(1)})`)
        lines.push(`- LogP <= 5: ${lipinski.logp_ok ? 'Yes' : 'No'} (${xlogp != null ? xlogp.toFixed(2) : 'N/A'})`)
        lines.push(`- HBD <= 5: ${lipinski.hbd_ok ? 'Yes' : 'No'} (${hbd})`)
        lines.push(`- HBA <= 10: ${lipinski.hba_ok ? 'Yes' : 'No'} (${hba})`)

        return lines.join('\n')
      } catch (e) {
        return `Error fetching properties: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })

  // ── 3. reaction_lookup ──────────────────────────────────────────────────
  registerTool({
    name: 'reaction_lookup',
    description: 'Search the Rhea database for enzyme-catalyzed biochemical reactions by reactant, product, name, or EC enzyme number.',
    parameters: {
      query: { type: 'string', description: 'Reactant name, product name, reaction name, or EC enzyme number', required: true },
      search_by: { type: 'string', description: 'Search type: reactant, product, name, or enzyme (default: name)' },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.query).trim()
      const searchBy = String(args.search_by || 'name').toLowerCase()

      try {
        const encoded = encodeURIComponent(query)
        // Rhea REST API: text search supports all types
        const url = `https://www.rhea-db.org/rhea?query=${encoded}&columns=rhea-id,equation,chebi-name,ec&format=tsv&limit=10`
        const res = await labFetch(url)

        if (!res.ok) {
          return `Rhea API error: HTTP ${res.status}. Try a different query.`
        }

        const text = await res.text()
        const rows = text.trim().split('\n')

        if (rows.length <= 1) return `No reactions found for "${query}" (${searchBy}).`

        const headers = rows[0].split('\t')
        const lines = [
          `## Rhea Reaction Search: "${query}" (${searchBy})`,
          '',
        ]

        for (const row of rows.slice(1, 11)) {
          const cols = row.split('\t')
          const rheaId = cols[0] || ''
          const equation = cols[1] || ''
          const chebi = cols[2] || ''
          const ec = cols[3] || ''

          lines.push(`### RHEA:${rheaId}`)
          lines.push(`- **Equation**: ${equation}`)
          if (chebi) lines.push(`- **ChEBI Names**: ${chebi}`)
          if (ec) lines.push(`- **EC Number**: ${ec}`)
          lines.push(`- **Link**: https://www.rhea-db.org/rhea/${rheaId}`)
          lines.push('')
        }

        return lines.join('\n')
      } catch (e) {
        return `Error searching Rhea: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })

  // ── 4. element_info ─────────────────────────────────────────────────────
  registerTool({
    name: 'element_info',
    description: 'Complete periodic table lookup for any of the 118 elements. Returns atomic number, symbol, name, atomic mass, electron configuration, electronegativity, ionization energy, density, melting/boiling points, crystal structure, discovery year, and category.',
    parameters: {
      element: { type: 'string', description: 'Element symbol (Fe), name (Iron), or atomic number (26)', required: true },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.element).trim()
      const el = lookupElement(query)

      if (!el) {
        // Try fuzzy match
        const lower = query.toLowerCase()
        const fuzzy = PERIODIC_TABLE.find(e =>
          e.name.toLowerCase().startsWith(lower) || e.symbol.toLowerCase().startsWith(lower)
        )
        if (!fuzzy) return `Element not found: "${query}". Provide a symbol (Fe), name (Iron), or atomic number (26).`
        return formatElement(fuzzy)
      }
      return formatElement(el)
    },
  })

  function formatElement(el: ElementData): string {
    const lines = [
      `## ${el.name} (${el.symbol})`,
      '',
      `| Property | Value |`,
      `|----------|-------|`,
      `| **Atomic Number** | ${el.number} |`,
      `| **Symbol** | ${el.symbol} |`,
      `| **Name** | ${el.name} |`,
      `| **Atomic Mass** | ${el.atomicMass} u |`,
      `| **Category** | ${el.category} |`,
      `| **Electron Configuration** | ${el.electronConfiguration} |`,
      `| **Electronegativity** | ${el.electronegativity ?? 'N/A'} (Pauling) |`,
      `| **Ionization Energy** | ${el.ionizationEnergy != null ? el.ionizationEnergy + ' kJ/mol' : 'N/A'} |`,
      `| **Density** | ${el.density != null ? el.density + ' g/cm\u00B3' : 'N/A'} |`,
      `| **Melting Point** | ${el.meltingPoint != null ? el.meltingPoint + ' K (' + (el.meltingPoint - 273.15).toFixed(1) + ' \u00B0C)' : 'N/A'} |`,
      `| **Boiling Point** | ${el.boilingPoint != null ? el.boilingPoint + ' K (' + (el.boilingPoint - 273.15).toFixed(1) + ' \u00B0C)' : 'N/A'} |`,
      `| **Crystal Structure** | ${el.crystalStructure ?? 'N/A'} |`,
      `| **Discovery Year** | ${el.discoveryYear ?? 'Ancient'} |`,
    ]
    return lines.join('\n')
  }

  // ── 5. material_properties ──────────────────────────────────────────────
  registerTool({
    name: 'material_properties',
    description: 'Search the Materials Project database for material data: band gap, formation energy, density, space group, and symmetry. Requires MP_API_KEY environment variable.',
    parameters: {
      formula: { type: 'string', description: 'Chemical formula (e.g., "Fe2O3", "GaN", "SiC")', required: true },
      property: { type: 'string', description: 'Focus property: band_gap, elasticity, density, or formation_energy (optional, returns all by default)' },
    },
    tier: 'free',
    async execute(args) {
      const formula = String(args.formula).trim()
      const property = args.property ? String(args.property).trim() : null

      const apiKey = process.env.MP_API_KEY
      if (!apiKey) {
        return [
          `## Materials Project: ${formula}`,
          '',
          '**API key required.** Set the `MP_API_KEY` environment variable to use this tool.',
          '',
          'Get a free API key at: https://materialsproject.org/api',
          '',
          '```bash',
          'export MP_API_KEY="your_key_here"',
          '```',
        ].join('\n')
      }

      try {
        const encoded = encodeURIComponent(formula)
        const fields = 'material_id,formula_pretty,band_gap,formation_energy_per_atom,density,symmetry'
        const url = `https://api.materialsproject.org/materials/summary/?formula=${encoded}&_fields=${fields}&_limit=5`
        const res = await fetch(url, {
          headers: {
            'User-Agent': UA,
            'X-API-KEY': apiKey,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(10000),
        })

        if (!res.ok) {
          return `Materials Project API error: HTTP ${res.status}. Check your API key.`
        }

        const data = await res.json() as {
          data?: Array<{
            material_id?: string
            formula_pretty?: string
            band_gap?: number
            formation_energy_per_atom?: number
            density?: number
            symmetry?: { crystal_system?: string; symbol?: string; number?: number }
          }>
        }

        const results = data.data
        if (!results?.length) return `No materials found for formula "${formula}".`

        const lines = [`## Materials Project: ${formula}`, '']

        for (const mat of results) {
          lines.push(`### ${mat.material_id ?? 'unknown'} — ${mat.formula_pretty ?? formula}`)
          lines.push('')
          lines.push(`| Property | Value |`)
          lines.push(`|----------|-------|`)

          if (!property || property === 'band_gap') {
            lines.push(`| **Band Gap** | ${mat.band_gap != null ? mat.band_gap.toFixed(3) + ' eV' : 'N/A'} |`)
          }
          if (!property || property === 'formation_energy') {
            lines.push(`| **Formation Energy** | ${mat.formation_energy_per_atom != null ? mat.formation_energy_per_atom.toFixed(4) + ' eV/atom' : 'N/A'} |`)
          }
          if (!property || property === 'density') {
            lines.push(`| **Density** | ${mat.density != null ? mat.density.toFixed(3) + ' g/cm\u00B3' : 'N/A'} |`)
          }
          if (mat.symmetry) {
            lines.push(`| **Crystal System** | ${mat.symmetry.crystal_system ?? 'N/A'} |`)
            lines.push(`| **Space Group** | ${mat.symmetry.symbol ?? 'N/A'} (${mat.symmetry.number ?? ''}) |`)
          }
          lines.push(`| **Link** | https://materialsproject.org/materials/${mat.material_id} |`)
          lines.push('')
        }

        return lines.join('\n')
      } catch (e) {
        return `Error querying Materials Project: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })

  // ── 6. spectroscopy_lookup ──────────────────────────────────────────────
  registerTool({
    name: 'spectroscopy_lookup',
    description: 'Look up spectroscopy reference data from the NIST Chemistry WebBook. Supports IR (infrared), MS (mass spectrometry), and UV-Vis spectra. Returns NIST WebBook links and available data.',
    parameters: {
      compound: { type: 'string', description: 'Compound name (e.g., "ethanol", "benzene", "acetone")', required: true },
      spectrum_type: { type: 'string', description: 'Spectrum type: ir, ms, or uv (default: ms)' },
    },
    tier: 'free',
    async execute(args) {
      const compound = String(args.compound).trim()
      const specType = String(args.spectrum_type || 'ms').toLowerCase()

      // NIST WebBook mask values: 1=thermo, 2=phase, 80=IR, 200=MS, 400=UV
      const maskMap: Record<string, number> = { ir: 80, ms: 200, uv: 400 }
      const mask = maskMap[specType] ?? 200
      const typeLabel: Record<string, string> = { ir: 'Infrared (IR)', ms: 'Mass Spectrum (MS)', uv: 'UV-Vis' }

      try {
        const encoded = encodeURIComponent(compound)
        const url = `https://webbook.nist.gov/cgi/cbook.cgi?Name=${encoded}&Units=SI&Mask=${mask}`
        const res = await fetch(url, {
          headers: { 'User-Agent': UA, Accept: 'text/html,*/*' },
          signal: AbortSignal.timeout(10000),
          redirect: 'follow',
        })

        if (!res.ok) {
          return `NIST WebBook error: HTTP ${res.status}`
        }

        const html = await res.text()

        // Extract key information from HTML
        const lines = [
          `## NIST WebBook: ${compound} — ${typeLabel[specType] ?? specType}`,
          '',
        ]

        // Try to extract the compound name/CAS from the page title
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
        if (titleMatch) {
          lines.push(`**Page**: ${titleMatch[1].trim()}`)
        }

        // Extract CAS number if present
        const casMatch = html.match(/CAS Registry Number:\s*<[^>]*>([^<]+)/i) ||
                         html.match(/(\d{2,7}-\d{2}-\d)/i)
        if (casMatch) {
          lines.push(`**CAS**: ${casMatch[1].trim()}`)
        }

        // Extract molecular formula
        const formulaMatch = html.match(/Molecular formula:\s*<[^>]*>([^<]+)/i) ||
                              html.match(/Formula:\s*([A-Z][A-Za-z0-9]+)/i)
        if (formulaMatch) {
          lines.push(`**Formula**: ${formulaMatch[1].trim()}`)
        }

        // Check if spectrum data is available on the page
        if (specType === 'ms' && html.includes('Mass spectrum')) {
          lines.push('', '**Mass spectrum data available.**')
          // Try to extract peak information
          const peakSection = html.match(/mass spectrum[^]*?(?=<h[23]|$)/i)
          if (peakSection) {
            const peakHits = peakSection[0].match(/(\d+)\s*\(\s*(\d+)\s*\)/g)
            if (peakHits?.length) {
              lines.push('', '**Major peaks** (m/z, relative intensity):')
              for (const p of peakHits.slice(0, 15)) {
                lines.push(`- ${p}`)
              }
            }
          }
        } else if (specType === 'ir' && html.includes('IR Spectrum')) {
          lines.push('', '**IR spectrum data available.**')
        } else if (specType === 'uv' && html.includes('UV/Vis')) {
          lines.push('', '**UV-Vis spectrum data available.**')
        } else {
          lines.push('', `No ${typeLabel[specType] ?? specType} data found for this compound.`)
        }

        // Always include the direct link
        lines.push('', `**NIST WebBook link**: ${url}`)
        lines.push(`**Full entry**: https://webbook.nist.gov/cgi/cbook.cgi?Name=${encoded}&Units=SI`)

        return lines.join('\n')
      } catch (e) {
        return `Error querying NIST WebBook: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })

  // ── 7. chemical_safety ──────────────────────────────────────────────────
  registerTool({
    name: 'chemical_safety',
    description: 'Get GHS (Globally Harmonized System) hazard classification data from PubChem: pictograms, signal word, hazard statements, and precautionary statements.',
    parameters: {
      compound: { type: 'string', description: 'Compound name (e.g., "methanol", "hydrochloric acid")', required: true },
    },
    tier: 'free',
    async execute(args) {
      const compound = String(args.compound).trim()

      try {
        // Step 1: resolve compound name to CID
        const cidUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(compound)}/cids/JSON`
        const cidRes = await labFetch(cidUrl)

        if (!cidRes.ok) {
          return `Compound not found on PubChem: "${compound}"`
        }

        const cidData = await cidRes.json() as { IdentifierList?: { CID?: number[] } }
        const cid = cidData.IdentifierList?.CID?.[0]
        if (!cid) return `No CID found for "${compound}".`

        // Step 2: get GHS classification
        const ghsUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cid}/JSON?heading=GHS+Classification`
        const ghsRes = await labFetch(ghsUrl)

        if (!ghsRes.ok) {
          return [
            `## Safety Data: ${compound} (CID: ${cid})`,
            '',
            'No GHS classification data available on PubChem.',
            `Check: https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=Safety-and-Hazards`,
          ].join('\n')
        }

        const ghsData = await ghsRes.json() as {
          Record?: {
            Section?: Array<{
              TOCHeading?: string
              Section?: Array<{
                TOCHeading?: string
                Information?: Array<{
                  Name?: string
                  Value?: {
                    StringWithMarkup?: Array<{ String?: string; Markup?: Array<{ URL?: string; Extra?: string }> }>
                  }
                }>
              }>
            }>
          }
        }

        const lines = [
          `## GHS Safety Data: ${compound} (CID: ${cid})`,
          '',
        ]

        // Parse GHS sections
        const sections = ghsData.Record?.Section || []
        for (const section of sections) {
          const innerSections = section.Section || []
          for (const inner of innerSections) {
            const heading = inner.TOCHeading || ''
            const infos = inner.Information || []

            for (const info of infos) {
              const name = info.Name || ''
              const strings = info.Value?.StringWithMarkup?.map(s => s.String).filter(Boolean) || []
              const markups = info.Value?.StringWithMarkup?.flatMap(s => s.Markup || []) || []

              if (name === 'Pictogram(s)' || heading.includes('Pictogram')) {
                const pictoNames = markups.map(m => m.Extra).filter(Boolean)
                if (pictoNames.length) {
                  lines.push(`### Pictograms`)
                  for (const p of pictoNames) lines.push(`- ${p}`)
                  lines.push('')
                }
              } else if (name === 'Signal' || heading.includes('Signal')) {
                if (strings.length) {
                  lines.push(`### Signal Word`)
                  lines.push(strings.join(', '))
                  lines.push('')
                }
              } else if (name.includes('Hazard Statement') || heading.includes('Hazard Statement')) {
                if (strings.length) {
                  lines.push(`### Hazard Statements`)
                  for (const s of strings) lines.push(`- ${s}`)
                  lines.push('')
                }
              } else if (name.includes('Precautionary Statement') || heading.includes('Precautionary')) {
                if (strings.length) {
                  lines.push(`### Precautionary Statements`)
                  for (const s of strings) lines.push(`- ${s}`)
                  lines.push('')
                }
              } else if (strings.length && name) {
                lines.push(`### ${name}`)
                for (const s of strings) lines.push(`- ${s}`)
                lines.push('')
              }
            }
          }
        }

        lines.push(`**Full safety data**: https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=Safety-and-Hazards`)

        return lines.join('\n')
      } catch (e) {
        return `Error fetching safety data: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })

  // ── 8. stoichiometry_calc ───────────────────────────────────────────────
  registerTool({
    name: 'stoichiometry_calc',
    description: 'Balance chemical equations using Gaussian elimination and calculate stoichiometric quantities. Parses chemical formulas including parenthetical groups (Ca(OH)2) and hydrates (CuSO4·5H2O). Can compute moles, grams, and identify the limiting reagent.',
    parameters: {
      equation: { type: 'string', description: 'Chemical equation (e.g., "Fe + O2 -> Fe2O3")', required: true },
      known_quantity: { type: 'string', description: 'Known quantity for stoichiometry (e.g., "Fe=10g" or "O2=3mol"). Optional.' },
    },
    tier: 'free',
    async execute(args) {
      const equation = String(args.equation).trim()
      const knownQty = args.known_quantity ? String(args.known_quantity).trim() : null

      const result = balanceEquation(equation)
      if (typeof result === 'string') return result

      const { reactants, products, coefficients } = result
      const allCompounds = [...reactants, ...products]

      // Format balanced equation
      const reactantStr = reactants
        .map((r, i) => coefficients[i] === 1 ? r : `${coefficients[i]}${r}`)
        .join(' + ')
      const productStr = products
        .map((p, i) => {
          const ci = coefficients[reactants.length + i]
          return ci === 1 ? p : `${ci}${p}`
        })
        .join(' + ')

      const lines = [
        `## Balanced Equation`,
        '',
        `**${reactantStr} \u2192 ${productStr}**`,
        '',
        `### Coefficients`,
      ]

      for (let i = 0; i < allCompounds.length; i++) {
        const mw = formulaWeight(allCompounds[i])
        const counts = parseFormula(allCompounds[i])
        lines.push(`- **${allCompounds[i]}**: coefficient = ${coefficients[i]}, MW = ${mw.toFixed(2)} g/mol, formula = ${countsToFormula(counts)}`)
      }

      // Stoichiometry calculation if known_quantity provided
      if (knownQty) {
        const match = knownQty.match(/^([A-Za-z0-9()]+)\s*=\s*([\d.]+)\s*(g|mol|kg|mg)$/i)
        if (match) {
          const knownCompound = match[1]
          const knownValue = parseFloat(match[2])
          const knownUnit = match[3].toLowerCase()

          // Find the compound index
          const idx = allCompounds.findIndex(c =>
            c.toLowerCase() === knownCompound.toLowerCase()
          )

          if (idx >= 0) {
            const mwKnown = formulaWeight(allCompounds[idx])
            let moles: number

            if (knownUnit === 'mol') {
              moles = knownValue
            } else if (knownUnit === 'g') {
              moles = knownValue / mwKnown
            } else if (knownUnit === 'kg') {
              moles = (knownValue * 1000) / mwKnown
            } else { // mg
              moles = (knownValue / 1000) / mwKnown
            }

            lines.push('')
            lines.push(`### Stoichiometry (given ${knownCompound} = ${knownValue} ${knownUnit})`)
            lines.push(`- ${knownCompound}: ${moles.toFixed(4)} mol = ${(moles * mwKnown).toFixed(4)} g`)
            lines.push('')
            lines.push(`| Compound | Moles | Grams | Role |`)
            lines.push(`|----------|-------|-------|------|`)

            for (let i = 0; i < allCompounds.length; i++) {
              const mw = formulaWeight(allCompounds[i])
              const stoichMoles = moles * coefficients[i] / coefficients[idx]
              const role = i < reactants.length ? 'Reactant' : 'Product'
              lines.push(`| ${allCompounds[i]} | ${stoichMoles.toFixed(4)} | ${(stoichMoles * mw).toFixed(4)} | ${role} |`)
            }
          } else {
            lines.push('', `*Compound "${knownCompound}" not found in equation.*`)
          }
        } else {
          lines.push('', `*Could not parse quantity "${knownQty}". Use format: "Fe=10g" or "O2=3mol".*`)
        }
      }

      // Show element breakdown verification
      lines.push('')
      lines.push('### Atom Balance Verification')

      const allElements = new Set<string>()
      const parsed = allCompounds.map(c => parseFormula(c))
      for (const p of parsed) {
        for (const el of Object.keys(p)) allElements.add(el)
      }

      let balanced = true
      for (const el of allElements) {
        let lhs = 0
        let rhs = 0
        for (let i = 0; i < reactants.length; i++) {
          lhs += (parsed[i][el] || 0) * coefficients[i]
        }
        for (let i = 0; i < products.length; i++) {
          rhs += (parsed[reactants.length + i][el] || 0) * coefficients[reactants.length + i]
        }
        const ok = lhs === rhs
        if (!ok) balanced = false
        lines.push(`- ${el}: LHS=${lhs}, RHS=${rhs} ${ok ? '\u2713' : '\u2717'}`)
      }

      lines.push('')
      lines.push(balanced ? '**Equation is balanced.**' : '**Warning: equation may not be fully balanced.**')

      return lines.join('\n')
    },
  })

  // ── 9. crystal_structure ────────────────────────────────────────────────
  registerTool({
    name: 'crystal_structure',
    description: 'Search the Crystallography Open Database (COD) for crystal structures by formula, mineral name, or text query. Returns cell parameters, space group, and structure details.',
    parameters: {
      query: { type: 'string', description: 'Chemical formula ("SiO2"), mineral name ("quartz"), or text query', required: true },
      search_type: { type: 'string', description: 'Search type: formula, mineral, or text (default: formula)' },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.query).trim()
      const searchType = String(args.search_type || 'formula').toLowerCase()

      try {
        let url: string
        const encoded = encodeURIComponent(query)

        if (searchType === 'mineral') {
          url = `https://www.crystallography.net/cod/result?mineral=${encoded}&format=json`
        } else if (searchType === 'text') {
          url = `https://www.crystallography.net/cod/result?text=${encoded}&format=json`
        } else {
          url = `https://www.crystallography.net/cod/result?formula=${encoded}&format=json`
        }

        const res = await labFetch(url)

        if (!res.ok) {
          return `COD API error: HTTP ${res.status}`
        }

        const data = await res.json() as Record<string, {
          formula?: string
          a?: number; b?: number; c?: number
          alpha?: number; beta?: number; gamma?: number
          sg?: string; sgHall?: string
          vol?: number
          nel?: number
          mineral?: string
          title?: string
          authors?: string
          journal?: string
          year?: number
          Rall?: number
        }>

        const entries = Object.entries(data)
        if (entries.length === 0) return `No crystal structures found for "${query}" (${searchType}).`

        const lines = [
          `## COD Crystal Structure Search: "${query}" (${searchType})`,
          `Found ${entries.length} result${entries.length !== 1 ? 's' : ''}. Showing first ${Math.min(entries.length, 5)}.`,
          '',
        ]

        for (const [codId, entry] of entries.slice(0, 5)) {
          lines.push(`### COD ${codId}`)
          if (entry.formula) lines.push(`- **Formula**: ${entry.formula}`)
          if (entry.mineral) lines.push(`- **Mineral**: ${entry.mineral}`)
          if (entry.sg) lines.push(`- **Space Group**: ${entry.sg}${entry.sgHall ? ` (Hall: ${entry.sgHall})` : ''}`)

          if (entry.a != null) {
            lines.push(`- **Cell Parameters**: a=${entry.a}, b=${entry.b}, c=${entry.c} A`)
            lines.push(`  - alpha=${entry.alpha}\u00B0, beta=${entry.beta}\u00B0, gamma=${entry.gamma}\u00B0`)
          }
          if (entry.vol != null) lines.push(`- **Volume**: ${entry.vol} A\u00B3`)
          if (entry.title) lines.push(`- **Title**: ${entry.title}`)
          if (entry.authors) lines.push(`- **Authors**: ${entry.authors}`)
          if (entry.journal && entry.year) lines.push(`- **Reference**: ${entry.journal} (${entry.year})`)
          if (entry.Rall != null) lines.push(`- **R-factor**: ${entry.Rall}`)
          lines.push(`- **Link**: https://www.crystallography.net/cod/${codId}.html`)
          lines.push('')
        }

        return lines.join('\n')
      } catch (e) {
        return `Error querying COD: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })

  // ── 10. thermodynamics_data ─────────────────────────────────────────────
  registerTool({
    name: 'thermodynamics_data',
    description: 'Look up standard thermodynamic properties: enthalpy of formation (deltaHf), entropy (S), heat capacity (Cp), and Gibbs free energy (deltaGf). Uses embedded data for ~100 common substances as primary source, with NIST WebBook as supplementary lookup.',
    parameters: {
      substance: { type: 'string', description: 'Chemical formula or name (e.g., "H2O(l)", "methane", "NaCl")', required: true },
      temperature: { type: 'number', description: 'Temperature in Kelvin (default: 298.15). Embedded data is for 298.15 K only.' },
    },
    tier: 'free',
    async execute(args) {
      const substance = String(args.substance).trim()
      const temp = typeof args.temperature === 'number' ? args.temperature : 298.15

      // Try embedded table first
      const local = lookupThermo(substance)

      if (local) {
        const lines = [
          `## Thermodynamic Data: ${local.name}`,
          `**Formula**: ${local.formula} | **T** = 298.15 K (standard state)`,
          '',
          `| Property | Value |`,
          `|----------|-------|`,
          `| **\u0394H\u00B0f** (enthalpy of formation) | ${local.deltaHf != null ? local.deltaHf.toFixed(2) + ' kJ/mol' : 'N/A'} |`,
          `| **S\u00B0** (standard molar entropy) | ${local.S != null ? local.S.toFixed(2) + ' J/(mol\u00B7K)' : 'N/A'} |`,
          `| **Cp\u00B0** (heat capacity) | ${local.Cp != null ? local.Cp.toFixed(2) + ' J/(mol\u00B7K)' : 'N/A'} |`,
          `| **\u0394G\u00B0f** (Gibbs free energy) | ${local.deltaGf != null ? local.deltaGf.toFixed(2) + ' kJ/mol' : 'N/A'} |`,
        ]

        if (temp !== 298.15 && local.Cp != null && local.deltaHf != null && local.S != null) {
          // Approximate at different temperature using Kirchhoff's equation
          const dT = temp - 298.15
          const approxH = local.deltaHf + (local.Cp / 1000) * dT
          const approxS = local.S + local.Cp * Math.log(temp / 298.15)
          const approxG = approxH - (temp * approxS / 1000)
          lines.push('')
          lines.push(`### Approximate Values at ${temp} K`)
          lines.push(`*(Kirchhoff approximation, assuming constant Cp)*`)
          lines.push(`- \u0394H\u00B0 \u2248 ${approxH.toFixed(2)} kJ/mol`)
          lines.push(`- S\u00B0 \u2248 ${approxS.toFixed(2)} J/(mol\u00B7K)`)
          lines.push(`- \u0394G\u00B0 \u2248 ${approxG.toFixed(2)} kJ/mol`)
        }

        return lines.join('\n')
      }

      // Fall back to NIST WebBook
      try {
        const encoded = encodeURIComponent(substance)
        const url = `https://webbook.nist.gov/cgi/cbook.cgi?Name=${encoded}&Units=SI&Mask=1`
        const res = await fetch(url, {
          headers: { 'User-Agent': UA, Accept: 'text/html,*/*' },
          signal: AbortSignal.timeout(10000),
          redirect: 'follow',
        })

        if (!res.ok) {
          return `Substance "${substance}" not found in embedded database. NIST WebBook returned HTTP ${res.status}.`
        }

        const html = await res.text()
        const lines = [
          `## Thermodynamic Data: ${substance}`,
          `*Source: NIST Chemistry WebBook*`,
          '',
        ]

        // Extract title
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
        if (titleMatch) lines.push(`**Compound**: ${titleMatch[1].trim()}`)

        // Try to extract standard thermodynamic values from the HTML
        const deltaHMatch = html.match(/f<\/sub>\s*=?\s*([-\d.]+)\s*(?:kJ\/mol|kJ\s*mol)/i) ||
                            html.match(/([-\d.]+)\s*(?:\u00B1\s*[\d.]+)?\s*kJ\/mol/i)
        if (deltaHMatch) lines.push(`**\u0394H\u00B0f**: ${deltaHMatch[1]} kJ/mol`)

        const entropyMatch = html.match(/entropy[^<]*?(\d+\.?\d*)\s*J\/mol/i)
        if (entropyMatch) lines.push(`**S\u00B0**: ${entropyMatch[1]} J/(mol\u00B7K)`)

        const cpMatch = html.match(/heat capacity[^<]*?(\d+\.?\d*)\s*J\/mol/i) ||
                        html.match(/Cp[^<]*?(\d+\.?\d*)\s*J/i)
        if (cpMatch) lines.push(`**Cp\u00B0**: ${cpMatch[1]} J/(mol\u00B7K)`)

        lines.push('')
        lines.push(`**NIST WebBook**: ${url}`)

        if (!deltaHMatch && !entropyMatch && !cpMatch) {
          lines.push('')
          lines.push('No thermodynamic data could be extracted from the NIST page. Visit the link above for full data.')
        }

        return lines.join('\n')
      } catch (e) {
        return `Substance "${substance}" not found in embedded database (${THERMO_TABLE.length} entries). NIST lookup failed: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })
}
