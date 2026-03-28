// kbot Frontier Science Lab — Tools born from this week's breakthroughs
// March 2026: lab-grown organs, 130% solar, engineered bee yeast,
// CERN Ξcc⁺, Masripithecus fossil ape, Jupiter mega-lightning.
//
// Tools:
//   tissue_engineer    — scaffold design, cell growth, biocompatibility
//   solar_cell_model   — photovoltaic efficiency, singlet fission, tandem cells
//   synbio_design      — codon optimization, gene circuits, metabolic pathways
//   phylo_tree         — phylogenetics, divergence dating, ancestral reconstruction
//   planetary_atmo     — atmospheric modeling, storm energetics, composition
//   frontier_news      — latest frontier science discoveries + kbot tool mapping
import { registerTool } from './index.js';
const BIOMATERIALS = [
    { name: 'Collagen Type I', type: 'natural', porosity: [70, 95], degradationMonths: [1, 6], tensileStrengthMPa: [1, 10], biocompatibility: 0.95, cellAdhesion: 0.92, applications: ['skin', 'bone', 'cartilage', 'vascular', 'oesophagus'] },
    { name: 'Fibrin', type: 'natural', porosity: [80, 98], degradationMonths: [0.5, 2], tensileStrengthMPa: [0.1, 0.5], biocompatibility: 0.98, cellAdhesion: 0.90, applications: ['wound healing', 'nerve', 'cardiac'] },
    { name: 'Decellularized ECM', type: 'natural', porosity: [60, 90], degradationMonths: [2, 12], tensileStrengthMPa: [2, 15], biocompatibility: 0.93, cellAdhesion: 0.95, applications: ['oesophagus', 'trachea', 'bladder', 'heart valve'] },
    { name: 'Alginate', type: 'natural', porosity: [85, 99], degradationMonths: [1, 6], tensileStrengthMPa: [0.05, 0.3], biocompatibility: 0.90, cellAdhesion: 0.40, applications: ['cartilage', 'liver', 'pancreas', 'wound'] },
    { name: 'Chitosan', type: 'natural', porosity: [70, 95], degradationMonths: [2, 8], tensileStrengthMPa: [1, 8], biocompatibility: 0.88, cellAdhesion: 0.75, applications: ['bone', 'cartilage', 'skin', 'nerve'] },
    { name: 'Silk Fibroin', type: 'natural', porosity: [60, 95], degradationMonths: [3, 24], tensileStrengthMPa: [5, 20], biocompatibility: 0.92, cellAdhesion: 0.82, applications: ['bone', 'ligament', 'skin', 'vascular'] },
    { name: 'PLA (Polylactic Acid)', type: 'synthetic', porosity: [50, 90], degradationMonths: [12, 36], tensileStrengthMPa: [30, 80], biocompatibility: 0.85, cellAdhesion: 0.55, applications: ['bone', 'sutures', 'drug delivery'] },
    { name: 'PCL (Polycaprolactone)', type: 'synthetic', porosity: [40, 85], degradationMonths: [24, 48], tensileStrengthMPa: [10, 40], biocompatibility: 0.87, cellAdhesion: 0.60, applications: ['bone', 'cartilage', 'vascular', 'drug delivery'] },
    { name: 'PLGA', type: 'synthetic', porosity: [50, 90], degradationMonths: [1, 12], tensileStrengthMPa: [20, 60], biocompatibility: 0.86, cellAdhesion: 0.58, applications: ['bone', 'cartilage', 'drug delivery', 'sutures'] },
    { name: 'PEG Hydrogel', type: 'synthetic', porosity: [90, 99], degradationMonths: [0.5, 6], tensileStrengthMPa: [0.01, 1], biocompatibility: 0.92, cellAdhesion: 0.35, applications: ['cartilage', 'neural', 'drug delivery', 'cell encapsulation'] },
    { name: 'Hydroxyapatite/Collagen', type: 'composite', porosity: [50, 80], degradationMonths: [6, 24], tensileStrengthMPa: [10, 50], biocompatibility: 0.94, cellAdhesion: 0.88, applications: ['bone', 'dental', 'craniofacial'] },
    { name: 'Graphene-PCL', type: 'composite', porosity: [40, 80], degradationMonths: [18, 48], tensileStrengthMPa: [20, 100], biocompatibility: 0.80, cellAdhesion: 0.70, applications: ['bone', 'neural', 'cardiac', 'biosensor'] },
    { name: 'Gelatin Methacrylate (GelMA)', type: 'composite', porosity: [70, 95], degradationMonths: [1, 4], tensileStrengthMPa: [0.05, 2], biocompatibility: 0.93, cellAdhesion: 0.88, applications: ['cartilage', 'vascular', 'skin', 'bioprinting'] },
];
const ORGAN_TEMPLATES = {
    skin: { name: 'Skin', cellDensity: 1e7, vascularization: true, immunosuppression: false, growthWeeks: [2, 6], mechanicalMPa: [1, 10], bestScaffolds: ['Collagen Type I', 'Fibrin', 'GelMA'], milestones: ['keratinocyte seeding', 'dermal layer formation', 'epidermal stratification', 'vascularization', 'barrier function test'], difficulty: 3 },
    cartilage: { name: 'Cartilage', cellDensity: 1e7, vascularization: false, immunosuppression: false, growthWeeks: [4, 12], mechanicalMPa: [5, 30], bestScaffolds: ['Alginate', 'PCL', 'PEG Hydrogel', 'GelMA'], milestones: ['chondrocyte isolation', 'scaffold seeding', 'ECM deposition', 'mechanical maturation', 'integration test'], difficulty: 4 },
    bone: { name: 'Bone', cellDensity: 2e7, vascularization: true, immunosuppression: false, growthWeeks: [8, 24], mechanicalMPa: [50, 200], bestScaffolds: ['Hydroxyapatite/Collagen', 'PLA', 'PCL'], milestones: ['osteoblast culture', 'mineralization', 'vascular network', 'load-bearing test', 'remodeling'], difficulty: 6 },
    oesophagus: { name: 'Oesophagus', cellDensity: 5e7, vascularization: true, immunosuppression: false, growthWeeks: [6, 16], mechanicalMPa: [0.5, 5], bestScaffolds: ['Decellularized ECM', 'Collagen Type I'], milestones: ['decellularization', 'epithelial seeding', 'smooth muscle layer', 'peristalsis test', 'in vivo implantation', 'growth adaptation'], difficulty: 7 },
    trachea: { name: 'Trachea', cellDensity: 3e7, vascularization: true, immunosuppression: false, growthWeeks: [6, 16], mechanicalMPa: [1, 10], bestScaffolds: ['Decellularized ECM', 'PCL'], milestones: ['scaffold preparation', 'epithelial lining', 'cartilage ring formation', 'mucociliary function', 'implantation'], difficulty: 7 },
    bladder: { name: 'Bladder', cellDensity: 3e7, vascularization: true, immunosuppression: false, growthWeeks: [4, 12], mechanicalMPa: [0.2, 2], bestScaffolds: ['Decellularized ECM', 'Collagen Type I', 'PLGA'], milestones: ['urothelial seeding', 'smooth muscle layer', 'distension test', 'waterproof barrier', 'innervation'], difficulty: 5 },
    heart_valve: { name: 'Heart Valve', cellDensity: 1e8, vascularization: false, immunosuppression: false, growthWeeks: [4, 8], mechanicalMPa: [1, 15], bestScaffolds: ['Decellularized ECM', 'Fibrin', 'PCL'], milestones: ['valve geometry', 'endothelialization', 'mechanical conditioning', 'hemodynamic test', 'durability cycling'], difficulty: 8 },
    liver: { name: 'Liver (Lobule)', cellDensity: 2e8, vascularization: true, immunosuppression: true, growthWeeks: [8, 24], mechanicalMPa: [0.1, 1], bestScaffolds: ['Decellularized ECM', 'Alginate', 'GelMA'], milestones: ['hepatocyte isolation', 'lobular architecture', 'bile duct formation', 'metabolic function', 'vascularization', 'detox assay'], difficulty: 9 },
    kidney: { name: 'Kidney (Nephron Unit)', cellDensity: 3e8, vascularization: true, immunosuppression: true, growthWeeks: [12, 36], mechanicalMPa: [0.1, 1], bestScaffolds: ['Decellularized ECM', 'GelMA'], milestones: ['nephron progenitor culture', 'tubule formation', 'glomerular filtration', 'vascular integration', 'urine production'], difficulty: 10 },
};
const SOLAR_MATERIALS = [
    { name: 'Crystalline Silicon (c-Si)', bandgapEV: 1.12, theoreticalEfficiency: 29.4, recordEfficiency: 26.8, type: 'silicon', costPerWatt: 0.20, degradationPerYear: 0.5, singletFission: false, notes: '95% of market. Mature technology.' },
    { name: 'Monocrystalline PERC', bandgapEV: 1.12, theoreticalEfficiency: 29.4, recordEfficiency: 24.5, type: 'silicon', costPerWatt: 0.22, degradationPerYear: 0.4, singletFission: false, notes: 'Most common commercial cell.' },
    { name: 'CdTe (Cadmium Telluride)', bandgapEV: 1.45, theoreticalEfficiency: 32.1, recordEfficiency: 22.6, type: 'thin-film', costPerWatt: 0.18, degradationPerYear: 0.5, singletFission: false, notes: 'First Solar dominates. Toxicity concerns.' },
    { name: 'CIGS', bandgapEV: 1.15, theoreticalEfficiency: 29.8, recordEfficiency: 23.6, type: 'thin-film', costPerWatt: 0.25, degradationPerYear: 0.6, singletFission: false, notes: 'Flexible substrates possible.' },
    { name: 'Perovskite (MAPbI₃)', bandgapEV: 1.55, theoreticalEfficiency: 33.2, recordEfficiency: 26.1, type: 'perovskite', costPerWatt: 0.10, degradationPerYear: 3.0, singletFission: false, notes: 'Rapid improvement. Stability still a challenge.' },
    { name: 'Perovskite/Silicon Tandem', bandgapEV: 1.68, theoreticalEfficiency: 43.0, recordEfficiency: 33.9, type: 'multijunction', costPerWatt: 0.30, degradationPerYear: 1.5, singletFission: false, notes: 'Best near-term path to >30%.' },
    { name: 'GaAs (Gallium Arsenide)', bandgapEV: 1.42, theoreticalEfficiency: 33.2, recordEfficiency: 29.1, type: 'multijunction', costPerWatt: 5.00, degradationPerYear: 0.2, singletFission: false, notes: 'Space applications. Expensive.' },
    { name: 'III-V Triple Junction', bandgapEV: 1.87, theoreticalEfficiency: 49.0, recordEfficiency: 47.6, type: 'multijunction', costPerWatt: 10.00, degradationPerYear: 0.1, singletFission: false, notes: 'Concentrator cells. Space/military.' },
    { name: 'Organic (P3HT:PCBM)', bandgapEV: 1.90, theoreticalEfficiency: 23.0, recordEfficiency: 19.2, type: 'organic', costPerWatt: 0.08, degradationPerYear: 5.0, singletFission: false, notes: 'Printable, flexible, cheap. Short lifetime.' },
    { name: 'Singlet Fission (Tetracene/Si)', bandgapEV: 1.12, theoreticalEfficiency: 45.0, recordEfficiency: 4.2, type: 'quantum', costPerWatt: 2.00, degradationPerYear: 2.0, singletFission: true, notes: 'March 2026: 130% quantum efficiency via spin-flip metal complex. Breaks single-photon limit.' },
    { name: 'Quantum Dot', bandgapEV: 1.30, theoreticalEfficiency: 44.0, recordEfficiency: 18.1, type: 'quantum', costPerWatt: 1.00, degradationPerYear: 3.0, singletFission: false, notes: 'Tunable bandgap. Multi-exciton generation.' },
];
// ═══════════════════════════════════════════════════════════════════════════
// DATA: Synthetic Biology
// ═══════════════════════════════════════════════════════════════════════════
const CODON_TABLE = {
    A: ['GCU', 'GCC', 'GCA', 'GCG'],
    R: ['CGU', 'CGC', 'CGA', 'CGG', 'AGA', 'AGG'],
    N: ['AAU', 'AAC'],
    D: ['GAU', 'GAC'],
    C: ['UGU', 'UGC'],
    E: ['GAA', 'GAG'],
    Q: ['CAA', 'CAG'],
    G: ['GGU', 'GGC', 'GGA', 'GGG'],
    H: ['CAU', 'CAC'],
    I: ['AUU', 'AUC', 'AUA'],
    L: ['UUA', 'UUG', 'CUU', 'CUC', 'CUA', 'CUG'],
    K: ['AAA', 'AAG'],
    M: ['AUG'],
    F: ['UUU', 'UUC'],
    P: ['CCU', 'CCC', 'CCA', 'CCG'],
    S: ['UCU', 'UCC', 'UCA', 'UCG', 'AGU', 'AGC'],
    T: ['ACU', 'ACC', 'ACA', 'ACG'],
    W: ['UGG'],
    Y: ['UAU', 'UAC'],
    V: ['GUU', 'GUC', 'GUA', 'GUG'],
    '*': ['UAA', 'UAG', 'UGA'],
};
// E. coli codon usage bias (frequency weights)
const ECOLI_CODON_BIAS = {
    GCU: 0.18, GCC: 0.26, GCA: 0.23, GCG: 0.33, // Ala
    CGU: 0.36, CGC: 0.36, CGA: 0.07, CGG: 0.11, AGA: 0.07, AGG: 0.04, // Arg
    AAU: 0.49, AAC: 0.51, // Asn
    GAU: 0.63, GAC: 0.37, // Asp
    UGU: 0.46, UGC: 0.54, // Cys
    GAA: 0.68, GAG: 0.32, // Glu
    CAA: 0.35, CAG: 0.65, // Gln
    GGU: 0.35, GGC: 0.37, GGA: 0.13, GGG: 0.15, // Gly
    CAU: 0.57, CAC: 0.43, // His
    AUU: 0.49, AUC: 0.39, AUA: 0.11, // Ile
    UUA: 0.14, UUG: 0.13, CUU: 0.12, CUC: 0.10, CUA: 0.04, CUG: 0.47, // Leu
    AAA: 0.74, AAG: 0.26, // Lys
    AUG: 1.00, // Met
    UUU: 0.58, UUC: 0.42, // Phe
    CCU: 0.18, CCC: 0.13, CCA: 0.20, CCG: 0.49, // Pro
    UCU: 0.17, UCC: 0.15, UCA: 0.14, UCG: 0.14, AGU: 0.16, AGC: 0.25, // Ser
    ACU: 0.19, ACC: 0.40, ACA: 0.17, ACG: 0.25, // Thr
    UGG: 1.00, // Trp
    UAU: 0.59, UAC: 0.41, // Tyr
    GUU: 0.28, GUC: 0.20, GUA: 0.17, GUG: 0.35, // Val
};
// Human codon usage bias
const HUMAN_CODON_BIAS = {
    GCU: 0.27, GCC: 0.40, GCA: 0.23, GCG: 0.11,
    CGU: 0.08, CGC: 0.18, CGA: 0.11, CGG: 0.20, AGA: 0.21, AGG: 0.21,
    AAU: 0.47, AAC: 0.53,
    GAU: 0.46, GAC: 0.54,
    UGU: 0.46, UGC: 0.54,
    GAA: 0.42, GAG: 0.58,
    CAA: 0.27, CAG: 0.73,
    GGU: 0.16, GGC: 0.34, GGA: 0.25, GGG: 0.25,
    CAU: 0.42, CAC: 0.58,
    AUU: 0.36, AUC: 0.47, AUA: 0.17,
    UUA: 0.08, UUG: 0.13, CUU: 0.13, CUC: 0.20, CUA: 0.07, CUG: 0.40,
    AAA: 0.43, AAG: 0.57,
    AUG: 1.00,
    UUU: 0.46, UUC: 0.54,
    CCU: 0.29, CCC: 0.32, CCA: 0.28, CCG: 0.11,
    UCU: 0.19, UCC: 0.22, UCA: 0.15, UCG: 0.05, AGU: 0.15, AGC: 0.24,
    ACU: 0.25, ACC: 0.36, ACA: 0.28, ACG: 0.12,
    UGG: 1.00,
    UAU: 0.44, UAC: 0.56,
    GUU: 0.18, GUC: 0.24, GUA: 0.12, GUG: 0.46,
};
// Yeast (S. cerevisiae) codon bias
const YEAST_CODON_BIAS = {
    GCU: 0.38, GCC: 0.22, GCA: 0.29, GCG: 0.11,
    CGU: 0.14, CGC: 0.06, CGA: 0.07, CGG: 0.04, AGA: 0.48, AGG: 0.21,
    AAU: 0.59, AAC: 0.41,
    GAU: 0.65, GAC: 0.35,
    UGU: 0.63, UGC: 0.37,
    GAA: 0.70, GAG: 0.30,
    CAA: 0.69, CAG: 0.31,
    GGU: 0.47, GGC: 0.19, GGA: 0.22, GGG: 0.12,
    CAU: 0.64, CAC: 0.36,
    AUU: 0.46, AUC: 0.26, AUA: 0.27,
    UUA: 0.28, UUG: 0.29, CUU: 0.13, CUC: 0.06, CUA: 0.14, CUG: 0.11,
    AAA: 0.58, AAG: 0.42,
    AUG: 1.00,
    UUU: 0.59, UUC: 0.41,
    CCU: 0.31, CCC: 0.15, CCA: 0.42, CCG: 0.12,
    UCU: 0.26, UCC: 0.16, UCA: 0.21, UCG: 0.10, AGU: 0.16, AGC: 0.11,
    ACU: 0.35, ACC: 0.22, ACA: 0.30, ACG: 0.14,
    UGG: 1.00,
    UAU: 0.56, UAC: 0.44,
    GUU: 0.39, GUC: 0.21, GUA: 0.21, GUG: 0.19,
};
const BIOBRICK_PARTS = [
    { name: 'pLac', type: 'promoter', registry: 'BBa_R0010', strength: 0.7, description: 'IPTG-inducible lac promoter' },
    { name: 'pTet', type: 'promoter', registry: 'BBa_R0040', strength: 0.6, description: 'aTc-inducible tet promoter' },
    { name: 'pBAD', type: 'promoter', registry: 'BBa_I0500', strength: 0.8, description: 'Arabinose-inducible promoter' },
    { name: 'pT7', type: 'promoter', registry: 'BBa_I712074', strength: 1.0, description: 'T7 RNA polymerase promoter (very strong)' },
    { name: 'pConst', type: 'promoter', registry: 'BBa_J23100', strength: 0.95, description: 'Strong constitutive promoter' },
    { name: 'RBS-strong', type: 'rbs', registry: 'BBa_B0034', strength: 0.9, description: 'Strong ribosome binding site' },
    { name: 'RBS-medium', type: 'rbs', registry: 'BBa_B0032', strength: 0.5, description: 'Medium ribosome binding site' },
    { name: 'RBS-weak', type: 'rbs', registry: 'BBa_B0031', strength: 0.1, description: 'Weak ribosome binding site' },
    { name: 'GFP', type: 'reporter', registry: 'BBa_E0040', strength: 0.8, description: 'Green fluorescent protein' },
    { name: 'RFP', type: 'reporter', registry: 'BBa_E1010', strength: 0.7, description: 'Red fluorescent protein (mRFP1)' },
    { name: 'LuxR', type: 'regulator', registry: 'BBa_C0062', strength: 0.6, description: 'AHL-responsive transcription factor' },
    { name: 'LacI', type: 'regulator', registry: 'BBa_C0012', strength: 0.7, description: 'Lac repressor' },
    { name: 'TetR', type: 'regulator', registry: 'BBa_C0040', strength: 0.7, description: 'Tet repressor' },
    { name: 'dTerm', type: 'terminator', registry: 'BBa_B0015', strength: 0.98, description: 'Double terminator (strong)' },
    { name: 'sTerm', type: 'terminator', registry: 'BBa_B0010', strength: 0.85, description: 'T1 terminator' },
];
const PRIMATE_TREE = [
    { name: 'Primates', commonName: 'Primates', divergenceMya: 85, parent: '', features: ['forward-facing eyes', 'grasping hands', 'large brain-to-body ratio'] },
    { name: 'Strepsirrhini', commonName: 'Wet-nosed primates', divergenceMya: 75, parent: 'Primates', features: ['rhinarium', 'tapetum lucidum', 'grooming claw'] },
    { name: 'Haplorhini', commonName: 'Dry-nosed primates', divergenceMya: 75, parent: 'Primates', features: ['postorbital closure', 'fovea', 'no rhinarium'] },
    { name: 'Tarsiiformes', commonName: 'Tarsiers', divergenceMya: 58, parent: 'Haplorhini' },
    { name: 'Simiiformes', commonName: 'Simians', divergenceMya: 58, parent: 'Haplorhini', features: ['larger brain', 'color vision', 'postorbital plate'] },
    { name: 'Platyrrhini', commonName: 'New World monkeys', divergenceMya: 43, parent: 'Simiiformes', features: ['prehensile tails (some)', 'flat nose', '3 premolars'] },
    { name: 'Catarrhini', commonName: 'Old World monkeys & apes', divergenceMya: 43, parent: 'Simiiformes', features: ['downward-facing nostrils', '2 premolars'] },
    { name: 'Cercopithecoidea', commonName: 'Old World monkeys', divergenceMya: 30, parent: 'Catarrhini' },
    { name: 'Hominoidea', commonName: 'Apes', divergenceMya: 30, parent: 'Catarrhini', features: ['no tail', 'broad chest', 'shoulder mobility'] },
    { name: 'Masripithecus', commonName: 'Egyptian fossil ape (2026)', divergenceMya: 17.5, parent: 'Hominoidea', features: ['17-18 Mya', 'northern Egypt', 'near common ancestor of all modern apes', 'reshapes ape origin timeline'] },
    { name: 'Hylobatidae', commonName: 'Gibbons', divergenceMya: 20, parent: 'Hominoidea', features: ['brachiation', 'pair bonding', 'smallest apes'] },
    { name: 'Hominidae', commonName: 'Great apes', divergenceMya: 17, parent: 'Hominoidea', features: ['larger body', 'complex cognition', 'tool use'] },
    { name: 'Ponginae', commonName: 'Orangutans', divergenceMya: 14, parent: 'Hominidae', features: ['solitary', 'arboreal', 'Southeast Asia'] },
    { name: 'Homininae', commonName: 'African apes + humans', divergenceMya: 14, parent: 'Hominidae' },
    { name: 'Gorillini', commonName: 'Gorillas', divergenceMya: 9, parent: 'Homininae', features: ['largest primates', 'knuckle walking', 'herbivorous'] },
    { name: 'Hominini', commonName: 'Humans + chimpanzees', divergenceMya: 9, parent: 'Homininae' },
    { name: 'Panina', commonName: 'Chimpanzees & Bonobos', divergenceMya: 6.5, parent: 'Hominini', features: ['tool use', 'complex social', 'closest to humans'] },
    { name: 'Hominina', commonName: 'Human lineage', divergenceMya: 6.5, parent: 'Hominini', features: ['bipedalism', 'language', 'technology'] },
    { name: 'Australopithecus', commonName: 'Southern ape', divergenceMya: 4.2, parent: 'Hominina', features: ['bipedal', 'small brain', 'Africa'] },
    { name: 'Homo', commonName: 'Humans', divergenceMya: 2.8, parent: 'Hominina', features: ['large brain', 'stone tools', 'fire use'] },
    { name: 'Homo_sapiens', commonName: 'Modern humans', divergenceMya: 0.3, parent: 'Homo', features: ['language', 'art', 'agriculture', 'spaceflight'] },
];
const PLANETARY_ATMOSPHERES = {
    mercury: { name: 'Mercury', surfaceTempK: 440, surfacePressureAtm: 1e-15, composition: { O2: 42, Na: 29, H2: 22, He: 6, K: 0.5 }, scaleHeightKm: 26, maxWindSpeedMs: 0, hasLightning: false, notes: 'Exosphere only. No weather.' },
    venus: { name: 'Venus', surfaceTempK: 737, surfacePressureAtm: 92, composition: { CO2: 96.5, N2: 3.5, SO2: 0.015, Ar: 0.007 }, scaleHeightKm: 15.9, maxWindSpeedMs: 100, hasLightning: true, lightningEnergyJ: 1e9, notes: 'Runaway greenhouse. Sulfuric acid clouds.' },
    earth: { name: 'Earth', surfaceTempK: 288, surfacePressureAtm: 1.0, composition: { N2: 78.08, O2: 20.95, Ar: 0.93, CO2: 0.042, H2O: 1.0 }, scaleHeightKm: 8.5, maxWindSpeedMs: 113, hasLightning: true, lightningEnergyJ: 1e9, notes: 'Only known atmosphere supporting life.' },
    mars: { name: 'Mars', surfaceTempK: 210, surfacePressureAtm: 0.006, composition: { CO2: 95.3, N2: 2.7, Ar: 1.6, O2: 0.13, CO: 0.07 }, scaleHeightKm: 11.1, maxWindSpeedMs: 30, hasLightning: false, notes: 'Thin atmosphere. Global dust storms.' },
    jupiter: { name: 'Jupiter', surfaceTempK: 165, surfacePressureAtm: 1000, composition: { H2: 89.8, He: 10.2, CH4: 0.3, NH3: 0.026, HD: 0.003 }, scaleHeightKm: 27, maxWindSpeedMs: 180, hasLightning: true, lightningEnergyJ: 1e15, notes: 'March 2026 Juno: lightning up to 1 MILLION times more powerful than Earth. Stealth superstorm 2021-22.' },
    saturn: { name: 'Saturn', surfaceTempK: 134, surfacePressureAtm: 1000, composition: { H2: 96.3, He: 3.25, CH4: 0.45, NH3: 0.013 }, scaleHeightKm: 59.5, maxWindSpeedMs: 500, hasLightning: true, lightningEnergyJ: 1e12, notes: 'Fastest winds in solar system. Hexagonal polar vortex.' },
    uranus: { name: 'Uranus', surfaceTempK: 76, surfacePressureAtm: 1000, composition: { H2: 82.5, He: 15.2, CH4: 2.3 }, scaleHeightKm: 27.7, maxWindSpeedMs: 250, hasLightning: false, notes: 'Tilted 98°. Ice giant.' },
    neptune: { name: 'Neptune', surfaceTempK: 72, surfacePressureAtm: 1000, composition: { H2: 80, He: 19, CH4: 1.5 }, scaleHeightKm: 19.7, maxWindSpeedMs: 580, hasLightning: false, notes: 'Strongest sustained winds (~580 m/s). Great Dark Spot.' },
    titan: { name: 'Titan', surfaceTempK: 94, surfacePressureAtm: 1.47, composition: { N2: 95, CH4: 5, H2: 0.1 }, scaleHeightKm: 21, maxWindSpeedMs: 0.3, hasLightning: false, notes: 'Only moon with a thick atmosphere. Methane cycle (rain, lakes, rivers).' },
    exo_trappist1e: { name: 'TRAPPIST-1e', surfaceTempK: 251, surfacePressureAtm: 1.0, composition: { N2: 78, CO2: 10, O2: 5, H2O: 7 }, scaleHeightKm: 8.0, maxWindSpeedMs: 50, hasLightning: true, lightningEnergyJ: 1e9, notes: 'Hypothetical habitable zone. Tidally locked. Model estimate.' },
};
// ═══════════════════════════════════════════════════════════════════════════
// TOOL REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════
export function registerFrontierTools() {
    // ─── 1. Tissue Engineering Simulator ─────────────────────────────────
    registerTool({
        name: 'tissue_engineer',
        description: 'Design tissue-engineered constructs — select organs, biomaterials, and scaffold parameters. Models cell growth kinetics, scaffold degradation, vascularization timelines, and biocompatibility. Includes data from the March 2026 lab-grown oesophagus breakthrough (Great Ormond Street Hospital).',
        parameters: {
            organ: { type: 'string', description: 'Target organ/tissue: skin, cartilage, bone, oesophagus, trachea, bladder, heart_valve, liver, kidney. Or "list" for all.' },
            material: { type: 'string', description: 'Scaffold material name, or "recommend" for best match, or "list" for all materials' },
            cells: { type: 'number', description: 'Initial cell seeding count (default: 1e6)' },
            weeks: { type: 'number', description: 'Growth simulation duration in weeks (default: 12)' },
        },
        tier: 'free',
        timeout: 15_000,
        async execute(args) {
            const lines = [];
            // List materials
            if (String(args.material) === 'list' || String(args.organ) === 'list') {
                if (String(args.material) === 'list') {
                    lines.push('## Biomaterials Library', '');
                    lines.push('| Material | Type | Porosity | Degradation | Strength (MPa) | Biocompat | Applications |');
                    lines.push('|----------|------|----------|-------------|----------------|-----------|-------------|');
                    for (const m of BIOMATERIALS) {
                        lines.push(`| ${m.name} | ${m.type} | ${m.porosity[0]}-${m.porosity[1]}% | ${m.degradationMonths[0]}-${m.degradationMonths[1]} mo | ${m.tensileStrengthMPa[0]}-${m.tensileStrengthMPa[1]} | ${(m.biocompatibility * 100).toFixed(0)}% | ${m.applications.join(', ')} |`);
                    }
                }
                if (String(args.organ) === 'list') {
                    lines.push('', '## Organ Templates', '');
                    lines.push('| Organ | Cell Density | Growth Time | Difficulty | Vascularization | Immunosuppression |');
                    lines.push('|-------|-------------|-------------|------------|-----------------|-------------------|');
                    for (const [, o] of Object.entries(ORGAN_TEMPLATES)) {
                        lines.push(`| ${o.name} | ${o.cellDensity.toExponential(0)} | ${o.growthWeeks[0]}-${o.growthWeeks[1]} wk | ${o.difficulty}/10 | ${o.vascularization ? 'Yes' : 'No'} | ${o.immunosuppression ? 'Yes' : 'No'} |`);
                    }
                }
                return lines.join('\n');
            }
            const organKey = String(args.organ || 'oesophagus').toLowerCase().replace(/\s+/g, '_');
            const organ = ORGAN_TEMPLATES[organKey];
            if (!organ)
                return `Unknown organ "${args.organ}". Use organ="list" to see options.`;
            // Find or recommend material
            let material;
            if (!args.material || String(args.material) === 'recommend') {
                material = BIOMATERIALS.find(m => organ.bestScaffolds.includes(m.name));
            }
            else {
                material = BIOMATERIALS.find(m => m.name.toLowerCase().includes(String(args.material).toLowerCase()));
            }
            if (!material)
                return `Material "${args.material}" not found. Use material="list" to see options.`;
            const initialCells = Number(args.cells) || 1e6;
            const weeks = Number(args.weeks) || 12;
            lines.push(`# Tissue Engineering: ${organ.name}`, '');
            lines.push(`**Scaffold**: ${material.name} (${material.type})`);
            lines.push(`**Initial cells**: ${initialCells.toExponential(1)}`);
            lines.push(`**Simulation**: ${weeks} weeks`);
            lines.push('');
            // Biocompatibility score
            const compat = material.biocompatibility * (organ.bestScaffolds.includes(material.name) ? 1.0 : 0.75);
            lines.push(`## Scaffold Properties`);
            lines.push(`- Porosity: ${material.porosity[0]}-${material.porosity[1]}%`);
            lines.push(`- Degradation: ${material.degradationMonths[0]}-${material.degradationMonths[1]} months`);
            lines.push(`- Tensile strength: ${material.tensileStrengthMPa[0]}-${material.tensileStrengthMPa[1]} MPa (organ needs ${organ.mechanicalMPa[0]}-${organ.mechanicalMPa[1]} MPa)`);
            lines.push(`- Biocompatibility: ${(compat * 100).toFixed(0)}%`);
            lines.push(`- Cell adhesion: ${(material.cellAdhesion * 100).toFixed(0)}%`);
            const strengthOk = material.tensileStrengthMPa[1] >= organ.mechanicalMPa[0];
            lines.push(`- Mechanical match: ${strengthOk ? '✓ Adequate' : '✗ Insufficient — consider composite reinforcement'}`);
            lines.push('');
            // Growth simulation (logistic growth model)
            lines.push(`## Cell Growth Simulation`);
            lines.push('');
            const targetCells = organ.cellDensity * 10; // ~10 cm³ construct
            const doublingHours = 24 + (10 - organ.difficulty) * 4; // harder organs = slower
            const growthRate = Math.log(2) / (doublingHours / 24 / 7); // per week
            const K = targetCells * material.cellAdhesion; // carrying capacity adjusted by adhesion
            lines.push('| Week | Cells | % of Target | Scaffold Remaining | Milestone |');
            lines.push('|------|-------|-------------|-------------------|-----------|');
            let cells = initialCells;
            for (let w = 1; w <= weeks; w++) {
                // Logistic growth: dN/dt = rN(1 - N/K)
                cells = cells + growthRate * cells * (1 - cells / K);
                cells = Math.min(cells, K);
                // Scaffold degradation (linear approximation)
                const avgDegMonths = (material.degradationMonths[0] + material.degradationMonths[1]) / 2;
                const scaffoldRemaining = Math.max(0, 100 - (w / 4.33) / avgDegMonths * 100);
                // Milestone check
                const milestoneIdx = Math.floor((w / weeks) * organ.milestones.length);
                const milestone = w === 1 || milestoneIdx !== Math.floor(((w - 1) / weeks) * organ.milestones.length)
                    ? organ.milestones[Math.min(milestoneIdx, organ.milestones.length - 1)] : '';
                const pctTarget = Math.min(100, (cells / targetCells) * 100);
                lines.push(`| ${w} | ${cells.toExponential(1)} | ${pctTarget.toFixed(1)}% | ${scaffoldRemaining.toFixed(0)}% | ${milestone} |`);
            }
            lines.push('');
            // Viability assessment
            const finalPct = Math.min(100, (cells / targetCells) * 100);
            const viability = compat * material.cellAdhesion * (finalPct / 100) * (strengthOk ? 1 : 0.5);
            lines.push(`## Viability Assessment`);
            lines.push(`- Final cell count: ${cells.toExponential(2)} (${finalPct.toFixed(1)}% of target)`);
            lines.push(`- Construct viability score: **${(viability * 100).toFixed(0)}%**`);
            lines.push(`- Estimated time to implantation: ${organ.growthWeeks[0]}-${organ.growthWeeks[1]} weeks`);
            lines.push(`- Vascularization required: ${organ.vascularization ? 'Yes — VEGF/FGF growth factor cocktail' : 'No'}`);
            lines.push(`- Immunosuppression: ${organ.immunosuppression ? 'Required (autologous cells preferred)' : 'Not required (March 2026 oesophagus achieved this)'}`);
            lines.push(`- Difficulty: ${organ.difficulty}/10`);
            lines.push('');
            lines.push(`## Recommended Scaffolds for ${organ.name}`);
            for (const s of organ.bestScaffolds) {
                const mat = BIOMATERIALS.find(m => m.name === s);
                if (mat)
                    lines.push(`- **${s}**: biocompat ${(mat.biocompatibility * 100).toFixed(0)}%, adhesion ${(mat.cellAdhesion * 100).toFixed(0)}%`);
            }
            return lines.join('\n');
        },
    });
    // ─── 2. Solar Cell Modeler ───────────────────────────────────────────
    registerTool({
        name: 'solar_cell_model',
        description: 'Model photovoltaic cell efficiency — Shockley-Queisser limits, singlet fission, tandem cells, cost analysis. Includes March 2026 singlet fission breakthrough (130% quantum efficiency via spin-flip metal complex).',
        parameters: {
            material: { type: 'string', description: 'Solar material name, or "list" for all, or "compare" for comparison table' },
            area_m2: { type: 'number', description: 'Panel area in square meters (default: 1.0)' },
            irradiance: { type: 'number', description: 'Solar irradiance in W/m² (default: 1000 = standard test)' },
            hours_per_day: { type: 'number', description: 'Peak sun hours per day (default: 5)' },
            tandem: { type: 'string', description: 'Second material for tandem cell modeling (optional)' },
        },
        tier: 'free',
        timeout: 10_000,
        async execute(args) {
            const lines = [];
            if (String(args.material) === 'list' || String(args.material) === 'compare') {
                lines.push('## Solar Cell Materials', '');
                lines.push('| Material | Bandgap | SQ Limit | Record | $/W | Degrad/yr | Type |');
                lines.push('|----------|---------|----------|--------|-----|-----------|------|');
                for (const m of SOLAR_MATERIALS) {
                    lines.push(`| ${m.name} | ${m.bandgapEV} eV | ${m.theoreticalEfficiency}% | ${m.recordEfficiency}% | $${m.costPerWatt.toFixed(2)} | ${m.degradationPerYear}% | ${m.type} |`);
                }
                lines.push('');
                lines.push('**Key**: SQ Limit = Shockley-Queisser theoretical max for single junction');
                lines.push('**Note**: Singlet Fission breaks SQ limit by generating 2 excitons per photon (March 2026 breakthrough)');
                return lines.join('\n');
            }
            const mat = SOLAR_MATERIALS.find(m => m.name.toLowerCase().includes(String(args.material || 'silicon').toLowerCase()));
            if (!mat)
                return `Material not found. Use material="list" to see options.`;
            const area = Number(args.area_m2) || 1.0;
            const irradiance = Number(args.irradiance) || 1000;
            const sunHours = Number(args.hours_per_day) || 5;
            lines.push(`# Solar Cell Model: ${mat.name}`, '');
            lines.push(`**Type**: ${mat.type} | **Bandgap**: ${mat.bandgapEV} eV`);
            lines.push('');
            // Shockley-Queisser calculation
            // Simplified: η = (bandgap × current_density × fill_factor) / irradiance
            const h = 6.626e-34, c = 3e8, k = 1.381e-23, T = 300, q = 1.602e-19;
            const Eg = mat.bandgapEV * q;
            const Voc = mat.bandgapEV - 0.4; // simplified Voc
            const fillFactor = 0.75 + mat.bandgapEV * 0.05;
            lines.push(`## Physics`);
            lines.push(`- Bandgap energy: ${mat.bandgapEV} eV (${(Eg * 1e9 / (h * c) * 1e-9).toFixed(0)} nm cutoff wavelength)`);
            lines.push(`- Open-circuit voltage (Voc): ~${Voc.toFixed(2)} V`);
            lines.push(`- Fill factor: ~${(fillFactor * 100).toFixed(1)}%`);
            lines.push(`- Shockley-Queisser limit: ${mat.theoreticalEfficiency}%`);
            lines.push(`- Current record efficiency: ${mat.recordEfficiency}%`);
            if (mat.singletFission) {
                lines.push('');
                lines.push(`### Singlet Fission Enhancement`);
                lines.push(`- Quantum efficiency: **>100%** (up to 130% demonstrated March 2026)`);
                lines.push(`- Mechanism: One high-energy photon → two excitons via spin-flip metal complex`);
                lines.push(`- Breaks Shockley-Queisser limit for single-junction cells`);
                lines.push(`- Theoretical max with fission: ${mat.theoreticalEfficiency}% (vs 29.4% for standard Si)`);
            }
            lines.push('');
            // Power output calculation
            const efficiency = mat.recordEfficiency / 100;
            const powerPeak = irradiance * area * efficiency; // Watts
            const dailyKwh = powerPeak * sunHours / 1000;
            const annualKwh = dailyKwh * 365;
            const cost = mat.costPerWatt * powerPeak;
            lines.push(`## Energy Output (${area} m² panel)`);
            lines.push(`- Peak power: **${powerPeak.toFixed(1)} W** at ${irradiance} W/m²`);
            lines.push(`- Daily energy: ${dailyKwh.toFixed(2)} kWh (${sunHours}h peak sun)`);
            lines.push(`- Annual energy: ${annualKwh.toFixed(0)} kWh`);
            lines.push(`- Panel cost: ~$${cost.toFixed(2)}`);
            lines.push(`- LCOE estimate: ~$${(cost / (annualKwh * 25 * (1 - mat.degradationPerYear / 100 * 12.5))).toFixed(3)}/kWh (25yr lifetime)`);
            lines.push('');
            // Degradation over time
            lines.push(`## 25-Year Degradation`);
            lines.push('| Year | Efficiency | Annual kWh | Cumulative kWh |');
            lines.push('|------|-----------|------------|----------------|');
            let cumKwh = 0;
            for (const year of [1, 5, 10, 15, 20, 25]) {
                const degraded = efficiency * Math.pow(1 - mat.degradationPerYear / 100, year);
                const yearKwh = irradiance * area * degraded * sunHours * 365 / 1000;
                cumKwh += yearKwh * (year === 1 ? 1 : (year <= 5 ? 4 : 5));
                lines.push(`| ${year} | ${(degraded * 100).toFixed(1)}% | ${yearKwh.toFixed(0)} | ${cumKwh.toFixed(0)} |`);
            }
            // Tandem cell
            if (args.tandem) {
                const mat2 = SOLAR_MATERIALS.find(m => m.name.toLowerCase().includes(String(args.tandem).toLowerCase()));
                if (mat2) {
                    lines.push('');
                    lines.push(`## Tandem Cell: ${mat.name} + ${mat2.name}`);
                    // Detailed balance limit for tandem ≈ 1.1x + 0.9y for non-overlapping absorption
                    const tandemEff = Math.min(mat.theoreticalEfficiency * 0.85 + mat2.theoreticalEfficiency * 0.55, 49 // practical limit for 2-junction
                    );
                    const tandemPower = irradiance * area * tandemEff / 100;
                    lines.push(`- Combined theoretical limit: ~${tandemEff.toFixed(1)}%`);
                    lines.push(`- Top cell: ${mat.name} (${mat.bandgapEV} eV) — absorbs high-energy photons`);
                    lines.push(`- Bottom cell: ${mat2.name} (${mat2.bandgapEV} eV) — absorbs transmitted light`);
                    lines.push(`- Tandem peak power: ${tandemPower.toFixed(1)} W`);
                    lines.push(`- Optimal bandgap pairing: top ~1.7 eV, bottom ~1.1 eV`);
                    const gapDiff = Math.abs(mat.bandgapEV - mat2.bandgapEV);
                    lines.push(`- Your gap difference: ${gapDiff.toFixed(2)} eV ${gapDiff > 0.3 && gapDiff < 0.8 ? '(good range)' : '(suboptimal — aim for 0.4-0.7 eV difference)'}`);
                }
            }
            return lines.join('\n');
        },
    });
    // ─── 3. Synthetic Biology Toolkit ────────────────────────────────────
    registerTool({
        name: 'synbio_design',
        description: 'Synthetic biology design toolkit — codon optimization (E.coli/human/yeast), gene circuit design with BioBrick parts, metabolic pathway analysis. Inspired by March 2026 Oxford engineered bee yeast breakthrough.',
        parameters: {
            mode: { type: 'string', description: '"codon" for codon optimization, "circuit" for gene circuit design, "parts" to list BioBrick parts, "pathway" for metabolic pathway analysis', required: true },
            sequence: { type: 'string', description: 'For codon mode: amino acid sequence (1-letter codes). For pathway mode: target molecule name.' },
            organism: { type: 'string', description: 'Target organism for codon optimization: "ecoli", "human", "yeast" (default: ecoli)' },
            parts: { type: 'string', description: 'For circuit mode: comma-separated part names (e.g. "pLac,RBS-strong,GFP,dTerm")' },
        },
        tier: 'free',
        timeout: 15_000,
        async execute(args) {
            const mode = String(args.mode).toLowerCase();
            const lines = [];
            if (mode === 'parts') {
                lines.push('## BioBrick Standard Parts', '');
                lines.push('| Part | Type | Registry | Strength | Description |');
                lines.push('|------|------|----------|----------|-------------|');
                for (const p of BIOBRICK_PARTS) {
                    lines.push(`| ${p.name} | ${p.type} | ${p.registry} | ${(p.strength * 100).toFixed(0)}% | ${p.description} |`);
                }
                lines.push('');
                lines.push('Use mode="circuit" with parts="pLac,RBS-strong,GFP,dTerm" to design a circuit.');
                return lines.join('\n');
            }
            if (mode === 'codon') {
                const seq = String(args.sequence || '').toUpperCase().replace(/[^ARNDCEQGHILKMFPSTWYV*]/g, '');
                if (!seq || seq.length < 3)
                    return 'Provide an amino acid sequence (1-letter codes, min 3 residues). Example: sequence="MKVLFFAIV"';
                const org = String(args.organism || 'ecoli').toLowerCase();
                const biasTable = org === 'human' ? HUMAN_CODON_BIAS : org === 'yeast' ? YEAST_CODON_BIAS : ECOLI_CODON_BIAS;
                const orgName = org === 'human' ? 'Homo sapiens' : org === 'yeast' ? 'S. cerevisiae' : 'E. coli';
                lines.push(`# Codon Optimization: ${orgName}`, '');
                lines.push(`**Input**: ${seq.length} amino acids`);
                lines.push(`**Organism**: ${orgName}`);
                lines.push('');
                // Optimize codons
                let dnaSeq = '';
                let rnaSeq = '';
                let caiSum = 0;
                const codonDetails = [];
                for (const aa of seq) {
                    const codons = CODON_TABLE[aa];
                    if (!codons)
                        continue;
                    // Select codon with highest bias
                    let bestCodon = codons[0];
                    let bestWeight = 0;
                    for (const codon of codons) {
                        const weight = biasTable[codon] || 0;
                        if (weight > bestWeight) {
                            bestWeight = weight;
                            bestCodon = codon;
                        }
                    }
                    rnaSeq += bestCodon;
                    dnaSeq += bestCodon.replace(/U/g, 'T');
                    caiSum += Math.log(bestWeight || 0.01);
                    codonDetails.push(`${aa} → ${bestCodon} (${(bestWeight * 100).toFixed(0)}%)`);
                }
                // Add stop codon
                const stopCodons = CODON_TABLE['*'];
                let bestStop = stopCodons[0];
                let bestStopW = 0;
                for (const s of stopCodons) {
                    if ((biasTable[s] || 0) > bestStopW) {
                        bestStopW = biasTable[s] || 0;
                        bestStop = s;
                    }
                }
                rnaSeq += bestStop;
                dnaSeq += bestStop.replace(/U/g, 'T');
                const cai = Math.exp(caiSum / seq.length);
                const gcContent = (dnaSeq.match(/[GC]/g) || []).length / dnaSeq.length * 100;
                lines.push(`## Optimized Sequence`);
                lines.push('```');
                // Format DNA in 60-char lines
                for (let i = 0; i < dnaSeq.length; i += 60) {
                    lines.push(dnaSeq.slice(i, i + 60));
                }
                lines.push('```');
                lines.push('');
                lines.push(`## Metrics`);
                lines.push(`- Length: ${dnaSeq.length} bp (${seq.length} aa)`);
                lines.push(`- GC content: ${gcContent.toFixed(1)}% ${gcContent > 40 && gcContent < 60 ? '(optimal)' : '(may need adjustment)'}`);
                lines.push(`- Codon Adaptation Index (CAI): ${cai.toFixed(3)} ${cai > 0.8 ? '(excellent)' : cai > 0.6 ? '(good)' : '(consider manual review)'}`);
                lines.push('');
                lines.push(`## Codon Table`);
                lines.push('| AA | Codon | Usage |');
                lines.push('|----|-------|-------|');
                for (const detail of codonDetails.slice(0, 30)) {
                    const [aa, rest] = detail.split(' → ');
                    lines.push(`| ${aa} | ${rest} |`);
                }
                if (codonDetails.length > 30)
                    lines.push(`| ... | ${codonDetails.length - 30} more |`);
                if (org === 'yeast') {
                    lines.push('');
                    lines.push('> **March 2026 context**: Oxford researchers engineered yeast to produce sterols for bee nutrition using optimized codon tables like this. Colonies fed the supplement produced 15x more young.');
                }
                return lines.join('\n');
            }
            if (mode === 'circuit') {
                const partNames = String(args.parts || 'pLac,RBS-strong,GFP,dTerm').split(',').map(s => s.trim());
                const resolvedParts = [];
                for (const name of partNames) {
                    const part = BIOBRICK_PARTS.find(p => p.name.toLowerCase() === name.toLowerCase() || p.registry.toLowerCase() === name.toLowerCase());
                    if (part)
                        resolvedParts.push(part);
                    else
                        lines.push(`⚠ Unknown part: "${name}"`);
                }
                if (resolvedParts.length === 0)
                    return 'No valid parts found. Use mode="parts" to see available BioBrick parts.';
                lines.push(`# Gene Circuit Design`, '');
                // Circuit diagram
                lines.push('## Circuit Diagram');
                lines.push('```');
                const diagram = resolvedParts.map(p => {
                    const icons = { promoter: '→▶', rbs: '●', cds: '█', terminator: '▌▌', reporter: '★', regulator: '◆' };
                    return `[${icons[p.type] || '?'} ${p.name}]`;
                }).join(' — ');
                lines.push(diagram);
                lines.push('```');
                lines.push('');
                // Part details
                lines.push('## Parts', '');
                lines.push('| # | Part | Type | Registry | Strength | Description |');
                lines.push('|---|------|------|----------|----------|-------------|');
                resolvedParts.forEach((p, i) => {
                    lines.push(`| ${i + 1} | ${p.name} | ${p.type} | ${p.registry} | ${(p.strength * 100).toFixed(0)}% | ${p.description} |`);
                });
                lines.push('');
                // Expression prediction
                const promoter = resolvedParts.find(p => p.type === 'promoter');
                const rbs = resolvedParts.find(p => p.type === 'rbs');
                const terminator = resolvedParts.find(p => p.type === 'terminator');
                const expressionLevel = (promoter?.strength || 0.5) * (rbs?.strength || 0.5) * (terminator?.strength || 0.8);
                lines.push('## Expression Prediction');
                lines.push(`- Promoter strength: ${promoter ? (promoter.strength * 100).toFixed(0) + '%' : 'none (constitutive??)'}`);
                lines.push(`- RBS strength: ${rbs ? (rbs.strength * 100).toFixed(0) + '%' : 'none (will not translate!)'}`);
                lines.push(`- Termination efficiency: ${terminator ? (terminator.strength * 100).toFixed(0) + '%' : 'none (read-through risk!)'}`);
                lines.push(`- **Predicted expression**: ${(expressionLevel * 100).toFixed(0)}% relative units`);
                lines.push('');
                // Validation
                const issues = [];
                if (!promoter)
                    issues.push('Missing promoter — no transcription initiation');
                if (!rbs)
                    issues.push('Missing RBS — mRNA will not be translated');
                if (!terminator)
                    issues.push('Missing terminator — read-through into downstream genes');
                if (!resolvedParts.find(p => p.type === 'reporter' || p.type === 'cds' || p.type === 'regulator')) {
                    issues.push('No coding sequence / reporter — circuit produces nothing');
                }
                if (issues.length > 0) {
                    lines.push('## ⚠ Design Issues');
                    for (const issue of issues)
                        lines.push(`- ${issue}`);
                }
                else {
                    lines.push('## ✓ Circuit Validation Passed');
                    lines.push('All essential components present: promoter → RBS → CDS → terminator');
                }
                return lines.join('\n');
            }
            if (mode === 'pathway') {
                const target = String(args.sequence || 'ergosterol').toLowerCase();
                lines.push(`# Metabolic Pathway Analysis: ${target}`, '');
                // Pre-built pathways for key molecules
                const pathways = {
                    ergosterol: {
                        steps: ['Acetyl-CoA', 'Acetoacetyl-CoA', 'HMG-CoA', 'Mevalonate', 'IPP/DMAPP', 'GPP', 'FPP', 'Squalene', 'Lanosterol', 'Ergosterol'],
                        enzymes: ['AACT', 'HMGS', 'HMGR', 'MVK/PMK/MVD', 'IDI1', 'ERG20', 'ERG9', 'ERG1/ERG7', 'ERG11→ERG5→ERG4'],
                        organism: 'Saccharomyces cerevisiae',
                        notes: 'March 2026: Oxford engineered yeast to produce sterols (including ergosterol precursors) for honeybee nutrition. Bees fed supplemented colonies produced 15x more young. Key enzyme: HMGR (rate-limiting step).',
                    },
                    ethanol: {
                        steps: ['Glucose', 'Glucose-6-P', 'Fructose-6-P', 'Fructose-1,6-BP', 'G3P + DHAP', 'Pyruvate', 'Acetaldehyde', 'Ethanol'],
                        enzymes: ['HXK', 'PGI', 'PFK', 'FBA', 'Glycolysis enzymes', 'PDC1', 'ADH1'],
                        organism: 'S. cerevisiae',
                        notes: 'Classic fermentation pathway. Theoretical yield: 0.51 g ethanol / g glucose.',
                    },
                    lycopene: {
                        steps: ['Acetyl-CoA', 'IPP/DMAPP', 'GPP', 'FPP', 'GGPP', 'Phytoene', 'Lycopene'],
                        enzymes: ['MVA pathway', 'ispA', 'crtE', 'crtB', 'crtI'],
                        organism: 'E. coli (engineered)',
                        notes: 'Common synbio demonstration. Visible red color = easy screening.',
                    },
                    insulin: {
                        steps: ['Preproinsulin gene', 'Transcription', 'Translation', 'Signal peptide cleavage', 'Proinsulin folding', 'C-peptide removal', 'Active insulin (A+B chains)'],
                        enzymes: ['T7 RNA pol', 'Ribosomes', 'Signal peptidase', 'DsbA/DsbC (disulfide)', 'Trypsin + carboxypeptidase B'],
                        organism: 'E. coli (recombinant)',
                        notes: 'First commercial biotech product (1982, Genentech/Eli Lilly). Still produced this way.',
                    },
                    artemisinin: {
                        steps: ['Acetyl-CoA', 'IPP/DMAPP', 'FPP', 'Amorphadiene', 'Artemisinic acid', 'Dihydroartemisinic acid', 'Artemisinin'],
                        enzymes: ['MVA pathway', 'ADS (amorphadiene synthase)', 'CYP71AV1', 'DBR2', 'ALDH1', 'Photochemical conversion'],
                        organism: 'S. cerevisiae (engineered)',
                        notes: 'Sanofi/Amyris semi-synthetic route. Nobel Prize 2015 (Tu Youyou). Anti-malaria drug.',
                    },
                };
                const pathway = pathways[target];
                if (!pathway) {
                    lines.push(`No pre-built pathway for "${target}". Available pathways:`);
                    for (const [name, pw] of Object.entries(pathways)) {
                        lines.push(`- **${name}** (${pw.organism}): ${pw.steps.length} steps`);
                    }
                    return lines.join('\n');
                }
                lines.push(`**Organism**: ${pathway.organism}`);
                lines.push(`**Steps**: ${pathway.steps.length}`);
                lines.push('');
                // Pathway diagram
                lines.push('## Pathway');
                lines.push('```');
                for (let i = 0; i < pathway.steps.length; i++) {
                    lines.push(`  ${pathway.steps[i]}`);
                    if (i < pathway.steps.length - 1) {
                        lines.push(`    ↓  [${pathway.enzymes[i] || '?'}]`);
                    }
                }
                lines.push('```');
                lines.push('');
                // Enzyme table
                lines.push('## Enzymes');
                lines.push('| Step | Substrate → Product | Enzyme |');
                lines.push('|------|-------------------|--------|');
                for (let i = 0; i < pathway.steps.length - 1; i++) {
                    lines.push(`| ${i + 1} | ${pathway.steps[i]} → ${pathway.steps[i + 1]} | ${pathway.enzymes[i] || 'unknown'} |`);
                }
                lines.push('');
                lines.push('## Notes');
                lines.push(pathway.notes);
                return lines.join('\n');
            }
            return `Unknown mode "${mode}". Options: codon, circuit, parts, pathway`;
        },
    });
    // ─── 4. Phylogenetics Tree Builder ───────────────────────────────────
    registerTool({
        name: 'phylo_tree',
        description: 'Phylogenetic tree visualization and divergence dating. Includes primate evolution with the March 2026 Masripithecus discovery (17-18 Mya fossil ape from Egypt, near common ancestor of all modern apes).',
        parameters: {
            clade: { type: 'string', description: 'Clade to display: "primates" (default), or a specific taxon name to root from' },
            format: { type: 'string', description: '"tree" for ASCII tree, "table" for data table, "newick" for Newick format' },
            from_mya: { type: 'number', description: 'Filter: only show taxa diverging after this many million years ago' },
            to_mya: { type: 'number', description: 'Filter: only show taxa diverging before this many million years ago' },
        },
        tier: 'free',
        timeout: 10_000,
        async execute(args) {
            const format = String(args.format || 'tree').toLowerCase();
            const fromMya = args.from_mya ? Number(args.from_mya) : undefined;
            const toMya = args.to_mya ? Number(args.to_mya) : undefined;
            const lines = [];
            let nodes = PRIMATE_TREE;
            if (fromMya !== undefined)
                nodes = nodes.filter(n => n.divergenceMya <= fromMya || n.parent === '');
            if (toMya !== undefined)
                nodes = nodes.filter(n => n.divergenceMya >= toMya || n.parent === '');
            const rootName = String(args.clade || 'Primates');
            const root = nodes.find(n => n.name.toLowerCase() === rootName.toLowerCase());
            if (!root)
                return `Clade "${rootName}" not found. Available: ${nodes.map(n => n.name).join(', ')}`;
            if (format === 'table') {
                lines.push(`# Phylogenetic Data: ${root.name}`, '');
                lines.push('| Taxon | Common Name | Divergence (Mya) | Parent | Key Features |');
                lines.push('|-------|-------------|------------------|--------|-------------|');
                for (const n of nodes) {
                    lines.push(`| ${n.name} | ${n.commonName || ''} | ${n.divergenceMya} | ${n.parent || '—'} | ${(n.features || []).join(', ')} |`);
                }
                return lines.join('\n');
            }
            if (format === 'newick') {
                // Build Newick string recursively
                function toNewick(name) {
                    const children = nodes.filter(n => n.parent === name);
                    const node = nodes.find(n => n.name === name);
                    const dist = node?.divergenceMya || 0;
                    if (children.length === 0)
                        return `${name}:${dist}`;
                    return `(${children.map(c => toNewick(c.name)).join(',')})${name}:${dist}`;
                }
                lines.push(`# Newick Format: ${root.name}`, '');
                lines.push('```');
                lines.push(toNewick(root.name) + ';');
                lines.push('```');
                return lines.join('\n');
            }
            // ASCII tree format
            lines.push(`# Primate Phylogeny`, '');
            lines.push('```');
            function drawTree(name, prefix, isLast) {
                const node = nodes.find(n => n.name === name);
                if (!node)
                    return;
                const connector = prefix === '' ? '' : isLast ? '└── ' : '├── ';
                const mya = node.divergenceMya > 0 ? ` (${node.divergenceMya} Mya)` : '';
                const common = node.commonName ? ` — ${node.commonName}` : '';
                const marker = node.name === 'Masripithecus' ? ' ★ NEW 2026' : '';
                lines.push(`${prefix}${connector}${node.name}${common}${mya}${marker}`);
                const children = nodes.filter(n => n.parent === name);
                const childPrefix = prefix + (prefix === '' ? '' : isLast ? '    ' : '│   ');
                children.forEach((child, i) => {
                    drawTree(child.name, childPrefix, i === children.length - 1);
                });
            }
            drawTree(root.name, '', true);
            lines.push('```');
            lines.push('');
            // Timeline
            lines.push('## Divergence Timeline');
            const sorted = [...nodes].sort((a, b) => b.divergenceMya - a.divergenceMya);
            for (const n of sorted) {
                if (n.divergenceMya > 0 && n.parent) {
                    const bar = '█'.repeat(Math.max(1, Math.round(n.divergenceMya / 5)));
                    lines.push(`${String(n.divergenceMya).padStart(5)} Mya ${bar} ${n.name}${n.commonName ? ' (' + n.commonName + ')' : ''}`);
                }
            }
            lines.push('');
            // Masripithecus highlight
            lines.push('## March 2026 Discovery: Masripithecus');
            lines.push('- **Age**: 17-18 million years ago');
            lines.push('- **Location**: Northern Egypt');
            lines.push('- **Significance**: Sits very close to the common ancestor of ALL modern apes');
            lines.push('- **Impact**: Reshapes the timeline of ape origins — suggests hominoids diversified in Africa earlier than previously thought');
            lines.push('- **Previous view**: Great ape origins ~14 Mya in Africa');
            lines.push('- **New view**: Ape diversification began ~17-18 Mya, with Masripithecus as a near-basal hominoid');
            return lines.join('\n');
        },
    });
    // ─── 5. Planetary Atmosphere Simulator ───────────────────────────────
    registerTool({
        name: 'planetary_atmo',
        description: 'Planetary atmosphere modeling — composition, temperature profiles, pressure, storm energetics, and lightning. Includes March 2026 Juno discovery: Jupiter lightning up to 1 million times more powerful than Earth.',
        parameters: {
            planet: { type: 'string', description: 'Planet/body name, or "compare" for comparison table, or "list" for all' },
            altitude_km: { type: 'number', description: 'Altitude for temperature/pressure profile (default: surface)' },
            compare_to: { type: 'string', description: 'Second planet for side-by-side comparison' },
        },
        tier: 'free',
        timeout: 10_000,
        async execute(args) {
            const lines = [];
            if (String(args.planet) === 'list' || String(args.planet) === 'compare') {
                lines.push('## Planetary Atmospheres', '');
                lines.push('| Body | Temp (K) | Pressure (atm) | Max Wind (m/s) | Lightning | Scale Height |');
                lines.push('|------|----------|----------------|----------------|-----------|-------------|');
                for (const [, p] of Object.entries(PLANETARY_ATMOSPHERES)) {
                    lines.push(`| ${p.name} | ${p.surfaceTempK} | ${p.surfacePressureAtm} | ${p.maxWindSpeedMs} | ${p.hasLightning ? `Yes (${p.lightningEnergyJ?.toExponential(0) || '?'} J)` : 'No'} | ${p.scaleHeightKm} km |`);
                }
                return lines.join('\n');
            }
            const key = String(args.planet || 'jupiter').toLowerCase().replace(/[\s-]/g, '_');
            const planet = PLANETARY_ATMOSPHERES[key];
            if (!planet)
                return `Planet "${args.planet}" not found. Use planet="list" to see options: ${Object.keys(PLANETARY_ATMOSPHERES).join(', ')}`;
            const alt = Number(args.altitude_km) || 0;
            lines.push(`# ${planet.name} Atmosphere`, '');
            lines.push(`## Surface Conditions`);
            lines.push(`- Temperature: ${planet.surfaceTempK} K (${(planet.surfaceTempK - 273.15).toFixed(0)}°C)`);
            lines.push(`- Pressure: ${planet.surfacePressureAtm} atm`);
            lines.push(`- Scale height: ${planet.scaleHeightKm} km`);
            lines.push(`- Max wind speed: ${planet.maxWindSpeedMs} m/s (${(planet.maxWindSpeedMs * 3.6).toFixed(0)} km/h)`);
            lines.push('');
            // Composition
            lines.push('## Atmospheric Composition');
            lines.push('| Gas | % by Volume |');
            lines.push('|-----|------------|');
            const sorted = Object.entries(planet.composition).sort((a, b) => b[1] - a[1]);
            for (const [gas, pct] of sorted) {
                const bar = '█'.repeat(Math.max(1, Math.round(pct / 5)));
                lines.push(`| ${gas} | ${pct}% ${bar} |`);
            }
            lines.push('');
            // Altitude profile (barometric formula)
            if (alt > 0) {
                lines.push(`## Altitude Profile (${alt} km)`);
                const g_earth = 9.81;
                const gMap = { mercury: 3.7, venus: 8.87, earth: 9.81, mars: 3.72, jupiter: 24.79, saturn: 10.44, uranus: 8.69, neptune: 11.15, titan: 1.35, exo_trappist1e: 9.0 };
                const g = gMap[key] || 9.81;
                const T = planet.surfaceTempK * (1 - 0.0065 * Math.min(alt, planet.scaleHeightKm * 3) / planet.scaleHeightKm * 0.15); // simplified lapse rate
                const P = planet.surfacePressureAtm * Math.exp(-alt / planet.scaleHeightKm);
                lines.push(`- Temperature at ${alt} km: ~${T.toFixed(0)} K (${(T - 273.15).toFixed(0)}°C)`);
                lines.push(`- Pressure at ${alt} km: ~${P.toExponential(2)} atm`);
                lines.push(`- Surface gravity: ${g.toFixed(2)} m/s²`);
                lines.push(`- Air density ratio: ~${Math.exp(-alt / planet.scaleHeightKm).toExponential(2)}`);
                lines.push('');
            }
            // Lightning
            if (planet.hasLightning) {
                lines.push('## Lightning');
                lines.push(`- Lightning detected: **Yes**`);
                if (planet.lightningEnergyJ) {
                    const earthJ = 1e9;
                    const ratio = planet.lightningEnergyJ / earthJ;
                    lines.push(`- Energy per flash: ~${planet.lightningEnergyJ.toExponential(0)} J`);
                    lines.push(`- Compared to Earth: **${ratio >= 1000 ? ratio.toExponential(0) : ratio.toFixed(0)}x** ${ratio > 1 ? 'more powerful' : 'less powerful'}`);
                    if (key === 'jupiter') {
                        lines.push('');
                        lines.push('### March 2026 Juno Discovery');
                        lines.push('- Juno spacecraft detected lightning up to **1 million times** more powerful than terrestrial lightning');
                        lines.push('- Triggered by a previously undetected "stealth superstorm" in 2021-2022');
                        lines.push('- Storm was hidden beneath the upper cloud layers, only visible in radio/microwave');
                        lines.push('- Challenges models of jovian convection — storms can form and intensify without visible signatures');
                    }
                }
                lines.push('');
            }
            // Notes
            lines.push(`## Notes`);
            lines.push(planet.notes);
            // Side-by-side comparison
            if (args.compare_to) {
                const key2 = String(args.compare_to).toLowerCase().replace(/[\s-]/g, '_');
                const p2 = PLANETARY_ATMOSPHERES[key2];
                if (p2) {
                    lines.push('');
                    lines.push(`## Comparison: ${planet.name} vs ${p2.name}`);
                    lines.push('| Property | ' + planet.name + ' | ' + p2.name + ' |');
                    lines.push('|----------|' + '-'.repeat(planet.name.length + 2) + '|' + '-'.repeat(p2.name.length + 2) + '|');
                    lines.push(`| Temperature | ${planet.surfaceTempK} K | ${p2.surfaceTempK} K |`);
                    lines.push(`| Pressure | ${planet.surfacePressureAtm} atm | ${p2.surfacePressureAtm} atm |`);
                    lines.push(`| Max wind | ${planet.maxWindSpeedMs} m/s | ${p2.maxWindSpeedMs} m/s |`);
                    lines.push(`| Lightning | ${planet.hasLightning ? 'Yes' : 'No'} | ${p2.hasLightning ? 'Yes' : 'No'} |`);
                    lines.push(`| Scale height | ${planet.scaleHeightKm} km | ${p2.scaleHeightKm} km |`);
                }
            }
            return lines.join('\n');
        },
    });
    // ─── 6. Frontier News Mapper ─────────────────────────────────────────
    registerTool({
        name: 'frontier_news',
        description: 'Maps the latest frontier science discoveries to kbot tools you can use right now. Bridges breaking science news to computational exploration.',
        parameters: {
            topic: { type: 'string', description: '"all" for full map, or a topic: tissue, solar, synbio, phylo, atmo, particles' },
        },
        tier: 'free',
        timeout: 5_000,
        async execute(args) {
            const topic = String(args.topic || 'all').toLowerCase();
            const lines = [];
            lines.push('# Frontier Science → kbot Tools', '');
            lines.push('*How to explore this week\'s breakthroughs from your terminal*', '');
            const sections = {
                tissue: `## Lab-Grown Oesophagus (March 2026)
**Discovery**: Great Ormond Street Hospital + UCL created the first lab-grown oesophagus that works in a growing animal without immunosuppression.
**Explore with kbot**:
- \`tissue_engineer organ=oesophagus\` — simulate the scaffold + cell growth
- \`tissue_engineer organ=oesophagus material=recommend\` — see why decellularized ECM was chosen
- \`tissue_engineer organ=list\` — compare difficulty across all organ types
- \`tissue_engineer organ=kidney\` — see what's hardest to build next`,
                solar: `## 130% Solar Efficiency via Singlet Fission (March 2026)
**Discovery**: Spin-flip metal complex achieved ~130% quantum efficiency by generating 2 excitons from 1 photon.
**Explore with kbot**:
- \`solar_cell_model material="singlet fission"\` — model the breakthrough material
- \`solar_cell_model material="perovskite" tandem="silicon"\` — design a tandem cell
- \`solar_cell_model material=compare\` — compare all 11 PV technologies
- \`solar_cell_model material="silicon" area_m2=100 hours_per_day=6\` — model a rooftop install`,
                synbio: `## Engineered Bee Yeast (March 2026)
**Discovery**: Oxford engineered S. cerevisiae to produce essential sterols for honeybees. Colonies produced 15x more young.
**Explore with kbot**:
- \`synbio_design mode=pathway sequence=ergosterol\` — see the sterol synthesis pathway
- \`synbio_design mode=codon sequence="MKVLFFAIV" organism=yeast\` — optimize a gene for yeast
- \`synbio_design mode=circuit parts="pBAD,RBS-strong,GFP,dTerm"\` — design a gene circuit
- \`synbio_design mode=parts\` — browse BioBrick standard parts`,
                phylo: `## Masripithecus Fossil Ape (March 2026)
**Discovery**: 17-18 Mya fossil ape from Egypt near the common ancestor of all modern apes.
**Explore with kbot**:
- \`phylo_tree clade=Primates\` — see the full primate tree with Masripithecus marked
- \`phylo_tree clade=Hominoidea\` — zoom into ape evolution
- \`phylo_tree format=newick\` — export for phylogenetics software
- \`phylo_tree from_mya=20 to_mya=10\` — focus on the 10-20 Mya window where apes diversified`,
                atmo: `## Jupiter Mega-Lightning (March 2026)
**Discovery**: Juno found lightning up to 1 million times more powerful than Earth's, from a hidden superstorm.
**Explore with kbot**:
- \`planetary_atmo planet=jupiter\` — full atmospheric profile + lightning data
- \`planetary_atmo planet=jupiter compare_to=earth\` — side-by-side comparison
- \`planetary_atmo planet=list\` — compare all 10 planetary atmospheres
- \`planetary_atmo planet=titan\` — explore Titan's methane weather system`,
                particles: `## CERN Ξcc⁺ Baryon (March 2026)
**Discovery**: LHCb confirmed the doubly charmed baryon with high statistical significance.
**Explore with kbot**:
- \`particle_physics_data query="Xi_cc+"\` — look up the new particle
- \`particle_physics_data query="charmed baryon"\` — compare with other charmed hadrons
- \`particle_physics_data\` — browse all 72+ particles in the database`,
            };
            if (topic === 'all') {
                for (const s of Object.values(sections)) {
                    lines.push(s);
                    lines.push('');
                }
            }
            else {
                const section = sections[topic];
                if (section) {
                    lines.push(section);
                }
                else {
                    lines.push(`Topic "${topic}" not found. Available: ${Object.keys(sections).join(', ')}`);
                }
            }
            return lines.join('\n');
        },
    });
}
//# sourceMappingURL=lab-frontier.js.map