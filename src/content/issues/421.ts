/* ──────────────────────────────────────────────────────────────
   ISSUE 421 — AUG 2026
   THE HARMONIC SERIES
   倍音の秩序

   A study on the mathematical boundaries of timbre and pitch,
   staged as an interactive Fourier summation rig. The reader
   selects the base waveform, adjusts the count of summed partials,
   introduces inharmonicity simulating piano string stiffness, and
   hears/sees the resulting wave.
   
   THE SHAPE (twelfth): `fourier` — the WAVEFORM summation control,
   which summates sine waves, maps constellation phase circles, and
   triggers a local Web Audio synthesis bank.
   ────────────────────────────────────────────────────────────── */

import type { IssueRecord } from './index'

export const ISSUE_421: IssueRecord = {
  number: '421',
  month: 'AUG',
  year: '2026',
  feature: 'THE HARMONIC SERIES',
  featureJp: '倍音の秩序',
  price: '¥0 · BYOK',
  tagline: 'MAGAZINE FOR CITY CODERS · 街のコーダーのために',

  coverStock: 'ivory',
  coverLayout: 'classic',

  coverSeal: {
    label: 'FREQUENCY SUM',
    date: 'VIII·26',
  },

  accent: 'celadon',

  headline: {
    prefix: 'THE HARMONIC',
    emphasis: 'SERIES',
    suffix: '.',
    swash: 'What makes a sound rich? A single pure frequency is a sine wave — clean, silent, and rare in nature. Every other timbre is a sum of harmonics. Adjust the base wave, dial in the number of partials, and drag the phase constellation to hear and see the math of sound synthesis.',
  },

  contents: [
    { n: '001', en: 'Timbre is a mathematical sum', jp: '音色は数学的な総和である', tag: 'THESIS' },
    { n: '002', en: 'The Fourier summation rig', jp: 'フーリエ合成装置', tag: 'THE RIG' },
    { n: '003', en: 'Inharmonicity and string stiffness', jp: '非調和性と弦の剛性', tag: 'PHYSICS' },
    { n: '004', en: 'Phasor orbital orbits, visually mapped', jp: '視覚化されたベクトル軌道', tag: 'CONSTELLATION' },
    { n: '005', en: 'Frequency modulation and spectral design', jp: '周波数変調とスペクトル設計', tag: 'SOURCES' },
  ],

  spread: {
    type: 'fourier',
    kicker: 'HARMONIC OSCILLATOR · 周期振動 — THE FOURIER DECOMPOSITION',
    title: 'THE HARMONIC SERIES.',
    titleLines: ['THE HARMONIC', 'SERIES'],
    titleJp: '倍音の秩序 — フーリエ合成',
    deck: 'What makes a sound rich? A single pure frequency is a sine wave — clean, silent, and rare in nature. Every other timbre is a sum of harmonics. Adjust the base wave, dial in the number of partials, and drag the phase constellation to hear and see the math of sound synthesis.',
    byline: 'BY THE EDITORS · KERNEL.CHAT',
    signoff: '街のコーダーたちへ — the sum is always coherent when you hold the phase; build the wave partial by partial.',
    stock: 'ivory',

    dossier: {
      kicker: 'THE RIG · 装置仕様',
      note: 'This spread is an interactive mathematical model of additive synthesis. All visual waveforms and constellation trails are plotted in real time via canvas coordinate mapping. The synthesizer plays the synthesized wave through Web Audio oscillators, limited to a safe volume of 0.05 gain max. The ledger counts only your physical interactions, session-only and unrecorded.',
      items: [
        { label: 'SUBJECT', value: 'FOURIER ADDITIVE WAVEFORM SUMMATION' },
        { label: 'BASE FREQUENCY', value: 'C3 (130.81 Hz) · WARM HUM' },
        { label: 'PARTIAL CAPACITY', value: '1 TO 24 SINE HARMONICS' },
        { label: 'INHARMONICITY FORMULA', value: 'f_n = n * f_0 * sqrt(1 + B * n^2)' },
        { label: 'SYNTH LIMIT', value: '0.05 GAIN MAX · USER INITIATED' },
      ],
    },

    defaultWaveform: 'sine',
    defaultHarmonicsCount: 8,
    defaultInharmonicity: 0.0,
    fourierNote: 'Synthesizer sum is played locally via Web Audio API. Partials and volumes are calculated in real time. Volume slider controls master level. Reloading reset all phase offsets to rest state.',

    intro: [
      {
        heading: 'I. THE TIMBRE PROBLEM',
        headingJp: '音色の問題',
        paragraphs: [
          'A violin string, a trumpet bell, and a sine oscillator playing the exact same frequency sound entirely distinct. Timbre is the fingerprint of a sound. Jean-Baptiste Fourier proved in 1822 that any periodic waveform can be represented as a sum of simple sinusoids. Timbre is therefore not a monolithic quality; it is a mathematical sum of harmonically related partials.',
          'In subtractive synthesis, we start with a harmonically rich shape — a sawtooth or a square — and filter frequencies out. In additive synthesis, we build the spectrum from the ground up, placing each sinusoid exactly where the physics of the instrument demands. Timbre is constructed, partial by partial.',
        ],
      },
      {
        heading: 'II. THE INHARMONIC DRIFT',
        headingJp: '非調和のずれ',
        paragraphs: [
          'In a theoretically perfect string, every harmonic is an exact integer multiple of the fundamental frequency. But real strings have physical thickness and stiffness. This stiffness acts as an restoring force that pushes higher frequencies slightly sharp.',
          'We model this stiffness using the inharmonicity coefficient B. As B increases, higher partials drift sharp, wringing out the pure harmonic order into a metallic, bell-like, or wood-plank resonance. Timbre is stretched, revealing the friction of physical materials.',
        ],
      },
    ],

    pullQuote: {
      text: 'Timbre is not a quality we hear; it is a mathematical sum we experience.',
      attribution: 'JOHN CHOWNING, 1973',
    },

    references: {
      kicker: 'WORKS CITED · 参考文献',
      items: [
        {
          authors: 'Roads, C.',
          year: '2001',
          title: 'Microsound',
          journal: 'MIT Press',
        },
        {
          authors: 'Chowning, J.',
          year: '1973',
          title: 'The Synthesis of Complex Audio Spectra by Means of Frequency Modulation',
          journal: 'Journal of the Audio Engineering Society',
        },
        {
          authors: 'Zavalishin, V.',
          year: '2012',
          title: 'The Art of VA Filter Design',
          journal: 'Native Instruments',
        },
      ],
    },
  },
}
