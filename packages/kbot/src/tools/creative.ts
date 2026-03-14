// K:BOT Creative Intelligence Tools
// Generate art, shaders, music patterns, SVGs, and evolve designs.
// All outputs are self-contained files — no external dependencies at generation time.

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, basename, extname, join } from 'node:path'
import { registerTool } from './index.js'

// ─── Helpers ────────────────────────────────────────────────────────

/** Seed a simple deterministic PRNG from a string */
function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/** Pick a seeded-random float in [min, max) */
function seededRandom(seed: number, index: number): number {
  const x = Math.sin(seed + index * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

/** Pick a random item from an array using seed */
function pick<T>(arr: T[], seed: number, index: number): T {
  return arr[Math.floor(seededRandom(seed, index) * arr.length)]
}

/** Generate a CSS hex color from seed */
function seedColor(seed: number, idx: number): string {
  const h = Math.floor(seededRandom(seed, idx) * 360)
  const s = 50 + Math.floor(seededRandom(seed, idx + 1) * 40)
  const l = 30 + Math.floor(seededRandom(seed, idx + 2) * 40)
  return `hsl(${h}, ${s}%, ${l}%)`
}

function ensureDir(path: string): void {
  mkdirSync(dirname(path), { recursive: true })
}

// ─── p5.js Art Generator ────────────────────────────────────────────

function generateP5Sketch(description: string, style: string): string {
  const seed = hashSeed(description)
  const palette = Array.from({ length: 5 }, (_, i) => seedColor(seed, i * 3))
  const bgColor = seedColor(seed, 100)

  const sketchBodies: Record<string, string> = {
    abstract: `
  // Abstract expressionist composition
  const shapes = ${3 + Math.floor(seededRandom(seed, 10) * 12)};
  for (let i = 0; i < shapes; i++) {
    const x = random(width);
    const y = random(height);
    const sz = random(20, 200);
    fill(palette[i % palette.length]);
    noStroke();
    if (random() > 0.5) {
      ellipse(x, y, sz, sz * random(0.5, 1.5));
    } else {
      rect(x - sz/2, y - sz/2, sz, sz * random(0.5, 1.5));
    }
  }
  // Gestural lines
  for (let i = 0; i < ${2 + Math.floor(seededRandom(seed, 11) * 6)}; i++) {
    stroke(palette[i % palette.length]);
    strokeWeight(random(1, 8));
    noFill();
    beginShape();
    for (let j = 0; j < 8; j++) {
      curveVertex(random(width), random(height));
    }
    endShape();
  }`,

    geometric: `
  // Geometric pattern
  const cols = ${3 + Math.floor(seededRandom(seed, 20) * 8)};
  const rows = ${3 + Math.floor(seededRandom(seed, 21) * 8)};
  const cellW = width / cols;
  const cellH = height / rows;
  noStroke();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellW;
      const y = r * cellH;
      fill(palette[(r + c) % palette.length]);
      const shape = (r * cols + c + ${seed}) % 4;
      push();
      translate(x + cellW/2, y + cellH/2);
      rotate(((r + c) * PI) / ${2 + Math.floor(seededRandom(seed, 22) * 4)});
      if (shape === 0) rect(-cellW/2, -cellH/2, cellW, cellH);
      else if (shape === 1) ellipse(0, 0, cellW, cellH);
      else if (shape === 2) triangle(-cellW/2, cellH/2, cellW/2, cellH/2, 0, -cellH/2);
      else { beginShape(); for (let i = 0; i < 6; i++) { const a = (TWO_PI / 6) * i; vertex(cos(a) * cellW/2, sin(a) * cellH/2); } endShape(CLOSE); }
      pop();
    }
  }`,

    organic: `
  // Organic flow field
  const scale = ${10 + Math.floor(seededRandom(seed, 30) * 20)};
  const particles = ${200 + Math.floor(seededRandom(seed, 31) * 800)};
  noStroke();
  for (let i = 0; i < particles; i++) {
    let x = random(width);
    let y = random(height);
    fill(palette[i % palette.length] + '40');
    for (let step = 0; step < 50; step++) {
      const angle = noise(x / scale, y / scale, ${seededRandom(seed, 32).toFixed(2)}) * TWO_PI * 2;
      x += cos(angle) * 2;
      y += sin(angle) * 2;
      ellipse(x, y, 3, 3);
      if (x < 0 || x > width || y < 0 || y > height) break;
    }
  }`,

    fractal: `
  // Recursive fractal tree
  const maxDepth = ${4 + Math.floor(seededRandom(seed, 40) * 5)};
  const branchAngle = ${15 + Math.floor(seededRandom(seed, 41) * 30)};
  const lengthRatio = ${(0.6 + seededRandom(seed, 42) * 0.2).toFixed(2)};

  const branch = (x, y, len, angle, depth) => {
    if (depth >= maxDepth || len < 2) return;
    const x2 = x + cos(radians(angle)) * len;
    const y2 = y - sin(radians(angle)) * len;
    stroke(palette[depth % palette.length]);
    strokeWeight(map(depth, 0, maxDepth, 6, 1));
    line(x, y, x2, y2);
    branch(x2, y2, len * lengthRatio, angle + branchAngle, depth + 1);
    branch(x2, y2, len * lengthRatio, angle - branchAngle, depth + 1);
    if (random() > 0.5) branch(x2, y2, len * lengthRatio * 0.8, angle + branchAngle * 0.5, depth + 1);
  };
  branch(width/2, height, height * 0.3, 90, 0);`,

    noise: `
  // Perlin noise landscape
  const resolution = ${2 + Math.floor(seededRandom(seed, 50) * 4)};
  const zOff = ${seededRandom(seed, 51).toFixed(3)};
  loadPixels();
  for (let x = 0; x < width; x += resolution) {
    for (let y = 0; y < height; y += resolution) {
      const n = noise(x * 0.005, y * 0.005, zOff);
      const ci = floor(n * palette.length);
      const c = color(palette[ci % palette.length]);
      for (let dx = 0; dx < resolution; dx++) {
        for (let dy = 0; dy < resolution; dy++) {
          const idx = 4 * ((y + dy) * width + (x + dx));
          pixels[idx] = red(c);
          pixels[idx+1] = green(c);
          pixels[idx+2] = blue(c);
          pixels[idx+3] = 255;
        }
      }
    }
  }
  updatePixels();
  // Overlay contour lines
  noFill();
  stroke(255, 80);
  strokeWeight(0.5);
  for (let threshold = 0.1; threshold < 1; threshold += 0.1) {
    beginShape();
    for (let x = 0; x < width; x += 4) {
      const y = height * noise(x * 0.005, threshold * 5, zOff + 1);
      vertex(x, y);
    }
    endShape();
  }`,
  }

  const body = sketchBodies[style] || sketchBodies.abstract

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>K:BOT Art — ${description}</title>
  <script src="https://cdn.jsdelivr.net/npm/p5@1.11.3/lib/p5.min.js"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #111; }
    canvas { border-radius: 4px; box-shadow: 0 4px 24px rgba(0,0,0,0.5); }
  </style>
</head>
<body>
<script>
// Generated by K:BOT creative tools
// Description: ${description}
// Style: ${style}
// Seed: ${seed}

const palette = ${JSON.stringify(palette)};

function setup() {
  createCanvas(800, 800);
  background('${bgColor}');
  noiseSeed(${seed});
  randomSeed(${seed});
  draw_art();
  noLoop();
}

function draw_art() {
  ${body}
}

function mousePressed() {
  // Click to regenerate with new random seed
  noiseSeed(millis());
  randomSeed(millis());
  background('${bgColor}');
  draw_art();
}
<\/script>
</body>
</html>`
}

// ─── GLSL Shader Generator ─────────────────────────────────────────

function generateGLSL(description: string): string {
  const seed = hashSeed(description)
  const r1 = seededRandom(seed, 0)
  const r2 = seededRandom(seed, 1)
  const r3 = seededRandom(seed, 2)
  const r4 = seededRandom(seed, 3)
  const r5 = seededRandom(seed, 4)

  const octaves = 3 + Math.floor(r1 * 5)
  const speed = (0.2 + r2 * 1.5).toFixed(2)
  const zoom = (1.0 + r3 * 4.0).toFixed(2)
  const colorShiftA = (r4 * 6.28).toFixed(3)
  const colorShiftB = (r5 * 6.28).toFixed(3)

  const technique = Math.floor(r1 * 4)
  let core = ''

  if (technique === 0) {
    // Fractal noise with domain warping
    core = `
    // Domain-warped fractal noise
    vec2 q = vec2(fbm(uv + vec2(0.0, 0.0)),
                  fbm(uv + vec2(5.2, 1.3)));
    vec2 r2 = vec2(fbm(uv + 4.0 * q + vec2(1.7, 9.2) + ${speed} * iTime),
                   fbm(uv + 4.0 * q + vec2(8.3, 2.8) + ${speed} * 0.7 * iTime));
    float f = fbm(uv + 4.0 * r2);
    vec3 color = mix(vec3(0.1, 0.05, 0.2), vec3(0.9, 0.4, 0.2), clamp(f * f * 2.0, 0.0, 1.0));
    color = mix(color, vec3(0.0, 0.2, 0.6), clamp(length(q), 0.0, 1.0));
    color = mix(color, vec3(0.9, 0.8, 0.5), clamp(length(r2.x), 0.0, 1.0));`
  } else if (technique === 1) {
    // Raymarched SDF
    core = `
    // Raymarched distance field
    vec3 ro = vec3(0.0, 0.0, -3.0);
    vec3 rd = normalize(vec3(uv, 1.5));
    float t = 0.0;
    vec3 color = vec3(0.02);
    for (int i = 0; i < 80; i++) {
      vec3 p = ro + rd * t;
      float d = sceneSDF(p, iTime * ${speed});
      if (d < 0.001) {
        vec3 n = calcNormal(p, iTime * ${speed});
        vec3 light = normalize(vec3(1.0, 1.0, -1.0));
        float diff = max(dot(n, light), 0.0);
        float spec = pow(max(dot(reflect(-light, n), -rd), 0.0), 32.0);
        color = vec3(0.2, 0.4, 0.8) * diff + vec3(1.0) * spec * 0.5;
        color += vec3(0.05, 0.02, 0.1);
        float ao = 1.0 - float(i) / 80.0;
        color *= ao;
        break;
      }
      t += d;
      if (t > 20.0) break;
    }
    color += vec3(0.02, 0.01, 0.04) * (1.0 - length(uv));`
  } else if (technique === 2) {
    // Kaleidoscopic pattern
    core = `
    // Kaleidoscopic symmetry
    vec2 p = uv * ${zoom};
    float a = atan(p.y, p.x);
    float r = length(p);
    float segments = ${3 + Math.floor(r2 * 10)}.0;
    a = mod(a, 6.28318 / segments) - 3.14159 / segments;
    p = vec2(cos(a), sin(a)) * r;
    float pattern = sin(p.x * 10.0 + iTime * ${speed}) * cos(p.y * 10.0 - iTime * ${speed} * 0.7);
    pattern += sin(r * 8.0 - iTime * ${speed} * 1.5) * 0.5;
    pattern = sin(pattern * 3.14159 * 2.0);
    vec3 color = 0.5 + 0.5 * cos(vec3(${colorShiftA}, ${colorShiftB}, 4.0) + pattern * 2.0 + iTime * 0.3);
    color *= smoothstep(0.0, 0.02, abs(pattern));
    color *= 1.0 - 0.3 * r;`
  } else {
    // Voronoi cells
    core = `
    // Animated Voronoi cells
    vec2 p = uv * ${zoom};
    float minDist = 1.0;
    float secondDist = 1.0;
    vec2 minPoint = vec2(0.0);
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 cell = floor(p) + vec2(float(x), float(y));
        vec2 point = cell + hash2(cell);
        point += 0.5 * sin(iTime * ${speed} + 6.28 * hash2(cell));
        float d = length(p - point);
        if (d < minDist) {
          secondDist = minDist;
          minDist = d;
          minPoint = point;
        } else if (d < secondDist) {
          secondDist = d;
        }
      }
    }
    float edge = secondDist - minDist;
    vec3 color = 0.5 + 0.5 * cos(vec3(${colorShiftA}, ${colorShiftB}, 4.0) + minPoint.x * 3.0 + minPoint.y * 2.0);
    color *= smoothstep(0.0, 0.05, edge);
    color += 0.1 * (1.0 - minDist);`
  }

  return `// Generated by K:BOT Creative Tools
// Description: ${description}
// Shadertoy-compatible GLSL fragment shader
// Paste into https://www.shadertoy.com/new

// --- Utility functions ---

vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)),
             dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < ${octaves}; i++) {
        v += a * noise(p);
        p = rot * p * 2.0;
        a *= 0.5;
    }
    return v;
}

// SDF primitives (used by technique 1)
float sdSphere(vec3 p, float r) { return length(p) - r; }
float sdBox(vec3 p, vec3 b) { vec3 d = abs(p) - b; return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0)); }

float sceneSDF(vec3 p, float t) {
    float d = sdSphere(p, 1.0 + 0.2 * sin(t * 2.0));
    p.xz *= mat2(cos(t * 0.3), sin(t * 0.3), -sin(t * 0.3), cos(t * 0.3));
    d = min(d, sdBox(p - vec3(0.0, sin(t), 0.0), vec3(0.5 + 0.2 * sin(t * 1.3))));
    // Repetition
    vec3 rp = mod(p + 2.0, 4.0) - 2.0;
    d = min(d, sdSphere(rp, 0.3));
    return d;
}

vec3 calcNormal(vec3 p, float t) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        sceneSDF(p + e.xyy, t) - sceneSDF(p - e.xyy, t),
        sceneSDF(p + e.yxy, t) - sceneSDF(p - e.yxy, t),
        sceneSDF(p + e.yyx, t) - sceneSDF(p - e.yyx, t)
    ));
}

// --- Main ---

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    ${core}

    // Vignette
    float vig = 1.0 - 0.4 * dot(uv, uv);
    color *= vig;

    // Gamma correction
    color = pow(color, vec3(0.4545));

    fragColor = vec4(color, 1.0);
}
`
}

// ─── Music Pattern Generator ────────────────────────────────────────

function generateMusicPattern(description: string, genre: string, format: string): string {
  const seed = hashSeed(description + genre)

  // Scale definitions
  const scales: Record<string, number[]> = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    pentatonic: [0, 2, 4, 7, 9],
    blues: [0, 3, 5, 6, 7, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
  }

  // Genre → scale + tempo mapping
  const genreConfig: Record<string, { scale: string; tempoMin: number; tempoMax: number; noteNames: string[] }> = {
    ambient: { scale: 'pentatonic', tempoMin: 60, tempoMax: 80, noteNames: [':C4', ':E4', ':G4', ':A4', ':C5', ':E5'] },
    electronic: { scale: 'minor', tempoMin: 120, tempoMax: 140, noteNames: [':C3', ':Eb3', ':G3', ':Bb3', ':C4', ':Eb4', ':G4'] },
    jazz: { scale: 'dorian', tempoMin: 90, tempoMax: 130, noteNames: [':C3', ':D3', ':Eb3', ':G3', ':A3', ':C4', ':D4'] },
    classical: { scale: 'major', tempoMin: 80, tempoMax: 120, noteNames: [':C4', ':D4', ':E4', ':F4', ':G4', ':A4', ':B4', ':C5'] },
    hiphop: { scale: 'blues', tempoMin: 80, tempoMax: 100, noteNames: [':C2', ':Eb2', ':F2', ':Gb2', ':G2', ':Bb2', ':C3'] },
    default: { scale: 'major', tempoMin: 100, tempoMax: 130, noteNames: [':C4', ':D4', ':E4', ':F4', ':G4', ':A4', ':B4'] },
  }

  const config = genreConfig[genre.toLowerCase()] || genreConfig.default
  const tempo = config.tempoMin + Math.floor(seededRandom(seed, 0) * (config.tempoMax - config.tempoMin))
  const scaleNotes = scales[config.scale] || scales.major
  const noteCount = 8 + Math.floor(seededRandom(seed, 1) * 16)
  const baseOctave = 60 // MIDI middle C

  if (format === 'sonic-pi') {
    // Generate Sonic Pi code
    const notes = Array.from({ length: noteCount }, (_, i) => {
      return pick(config.noteNames, seed, i + 10)
    })
    const durations = Array.from({ length: noteCount }, (_, i) => {
      return pick([0.25, 0.5, 0.5, 1, 1, 2], seed, i + 100)
    })

    const synthChoices = ['prophet', 'saw', 'tb303', 'blade', 'pluck', 'piano']
    const fxChoices = ['reverb', 'echo', 'flanger']
    const synth = pick(synthChoices, seed, 200)
    const fx = pick(fxChoices, seed, 201)

    let code = `# Generated by K:BOT Creative Tools
# Description: ${description}
# Genre: ${genre}
# Tempo: ${tempo} BPM

use_bpm ${tempo}
use_synth :${synth}

`
    // Melody line
    code += `# Melody\nlive_loop :melody do\n  with_fx :${fx}, mix: 0.4 do\n`
    for (let i = 0; i < notes.length; i++) {
      const amp = (0.4 + seededRandom(seed, i + 300) * 0.5).toFixed(2)
      code += `    play ${notes[i]}, amp: ${amp}, release: ${durations[i]}\n`
      code += `    sleep ${durations[i]}\n`
    }
    code += `  end\nend\n\n`

    // Bass line
    const bassNotes = Array.from({ length: 4 }, (_, i) => {
      return pick([':C2', ':F2', ':G2', ':Bb2'], seed, i + 400)
    })
    code += `# Bass\nlive_loop :bass do\n  use_synth :fm\n`
    for (const note of bassNotes) {
      code += `  play ${note}, amp: 0.6, release: 0.8\n  sleep 1\n`
    }
    code += `end\n\n`

    // Drum pattern
    code += `# Drums\nlive_loop :drums do\n  sample :bd_haus, amp: 0.8\n  sleep 0.5\n`
    code += `  sample :sn_dub, amp: 0.5 if one_in(2)\n  sleep 0.25\n`
    code += `  sample :drum_cymbal_closed, amp: 0.3\n  sleep 0.25\n`
    code += `end\n`

    return code
  }

  // JSON format — MIDI-like pattern
  const pattern: {
    meta: { description: string; genre: string; tempo: number; scale: string; seed: number }
    tracks: Array<{
      name: string
      instrument: string
      notes: Array<{ pitch: number; velocity: number; start: number; duration: number; name: string }>
    }>
  } = {
    meta: { description, genre, tempo, scale: config.scale, seed },
    tracks: [],
  }

  // Note names for MIDI
  const noteNameFromMidi = (midi: number): string => {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`
  }

  // Melody track
  const melodyNotes = []
  let currentTime = 0
  for (let i = 0; i < noteCount; i++) {
    const scaleIdx = Math.floor(seededRandom(seed, i + 10) * scaleNotes.length)
    const octaveShift = Math.floor(seededRandom(seed, i + 50) * 2) * 12
    const pitch = baseOctave + scaleNotes[scaleIdx] + octaveShift
    const velocity = 60 + Math.floor(seededRandom(seed, i + 70) * 60)
    const duration = pick([0.25, 0.5, 0.5, 1, 1, 1.5, 2], seed, i + 90)
    melodyNotes.push({ pitch, velocity, start: parseFloat(currentTime.toFixed(3)), duration, name: noteNameFromMidi(pitch) })
    currentTime += duration
  }
  pattern.tracks.push({ name: 'melody', instrument: 'piano', notes: melodyNotes })

  // Bass track
  const bassTrackNotes = []
  currentTime = 0
  for (let i = 0; i < Math.floor(noteCount / 2); i++) {
    const scaleIdx = Math.floor(seededRandom(seed, i + 500) * scaleNotes.length)
    const pitch = 36 + scaleNotes[scaleIdx] // bass octave
    const duration = pick([1, 1, 2, 2, 4], seed, i + 520)
    bassTrackNotes.push({ pitch, velocity: 80, start: parseFloat(currentTime.toFixed(3)), duration, name: noteNameFromMidi(pitch) })
    currentTime += duration
  }
  pattern.tracks.push({ name: 'bass', instrument: 'bass', notes: bassTrackNotes })

  // Drum track
  const drumNotes = []
  const totalBeats = Math.ceil(currentTime)
  for (let beat = 0; beat < totalBeats; beat++) {
    // Kick on 1 and 3
    if (beat % 2 === 0) drumNotes.push({ pitch: 36, velocity: 100, start: beat, duration: 0.25, name: 'kick' })
    // Snare on 2 and 4
    if (beat % 2 === 1) drumNotes.push({ pitch: 38, velocity: 90, start: beat, duration: 0.25, name: 'snare' })
    // Hi-hat on every beat
    drumNotes.push({ pitch: 42, velocity: 60, start: beat, duration: 0.125, name: 'hihat' })
    // Extra hi-hat on off-beats sometimes
    if (seededRandom(seed, beat + 600) > 0.4) {
      drumNotes.push({ pitch: 42, velocity: 40, start: beat + 0.5, duration: 0.125, name: 'hihat' })
    }
  }
  pattern.tracks.push({ name: 'drums', instrument: 'drums', notes: drumNotes })

  return JSON.stringify(pattern, null, 2)
}

// ─── SVG Art Generator ──────────────────────────────────────────────

function generateSVG(description: string, width: number, height: number): string {
  const seed = hashSeed(description)
  const palette = Array.from({ length: 6 }, (_, i) => seedColor(seed, i * 3))
  const bgColor = seedColor(seed, 100)

  const technique = Math.floor(seededRandom(seed, 0) * 5)
  let elements = ''

  if (technique === 0) {
    // Concentric circles with rotation
    const numCircles = 8 + Math.floor(seededRandom(seed, 10) * 12)
    const cx = width / 2
    const cy = height / 2
    for (let i = 0; i < numCircles; i++) {
      const r = ((i + 1) / numCircles) * Math.min(width, height) * 0.45
      const strokeW = 1 + seededRandom(seed, i + 20) * 4
      const dashLen = 5 + Math.floor(seededRandom(seed, i + 30) * 20)
      const dashGap = 3 + Math.floor(seededRandom(seed, i + 40) * 15)
      const color = palette[i % palette.length]
      const rotation = Math.floor(seededRandom(seed, i + 50) * 360)
      elements += `  <circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${strokeW.toFixed(1)}" stroke-dasharray="${dashLen} ${dashGap}" transform="rotate(${rotation} ${cx} ${cy})" opacity="0.8"/>\n`
    }
  } else if (technique === 1) {
    // Voronoi-like polygons
    const numPoints = 10 + Math.floor(seededRandom(seed, 10) * 20)
    const points = Array.from({ length: numPoints }, (_, i) => ({
      x: seededRandom(seed, i * 2 + 100) * width,
      y: seededRandom(seed, i * 2 + 101) * height,
    }))
    // Draw Delaunay-ish triangulation as lines
    for (let i = 0; i < points.length; i++) {
      // Connect to 2-3 nearest other points
      const dists = points
        .map((p, j) => ({ j, d: Math.hypot(p.x - points[i].x, p.y - points[i].y) }))
        .filter((x) => x.j !== i)
        .sort((a, b) => a.d - b.d)
      const conns = 2 + Math.floor(seededRandom(seed, i + 200) * 2)
      for (let k = 0; k < Math.min(conns, dists.length); k++) {
        const target = points[dists[k].j]
        elements += `  <line x1="${points[i].x.toFixed(1)}" y1="${points[i].y.toFixed(1)}" x2="${target.x.toFixed(1)}" y2="${target.y.toFixed(1)}" stroke="${palette[k % palette.length]}" stroke-width="1" opacity="0.5"/>\n`
      }
      // Draw a circle at each point
      const r = 3 + seededRandom(seed, i + 300) * 8
      elements += `  <circle cx="${points[i].x.toFixed(1)}" cy="${points[i].y.toFixed(1)}" r="${r.toFixed(1)}" fill="${palette[i % palette.length]}" opacity="0.7"/>\n`
    }
  } else if (technique === 2) {
    // Recursive subdivided rectangles (Mondrian-style)
    interface Rect { x: number; y: number; w: number; h: number; depth: number }
    const rects: Rect[] = []
    function subdivide(x: number, y: number, w: number, h: number, depth: number) {
      if (depth > 4 || w < 30 || h < 30) {
        rects.push({ x, y, w, h, depth })
        return
      }
      if (seededRandom(seed, depth * 100 + rects.length) > 0.4) {
        // Split horizontally
        const split = 0.3 + seededRandom(seed, depth * 100 + rects.length + 1) * 0.4
        subdivide(x, y, w * split, h, depth + 1)
        subdivide(x + w * split, y, w * (1 - split), h, depth + 1)
      } else {
        // Split vertically
        const split = 0.3 + seededRandom(seed, depth * 100 + rects.length + 2) * 0.4
        subdivide(x, y, w, h * split, depth + 1)
        subdivide(x, y + h * split, w, h * (1 - split), depth + 1)
      }
    }
    subdivide(0, 0, width, height, 0)
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i]
      const fill = seededRandom(seed, i + 400) > 0.6 ? palette[i % palette.length] : bgColor
      elements += `  <rect x="${r.x.toFixed(1)}" y="${r.y.toFixed(1)}" width="${r.w.toFixed(1)}" height="${r.h.toFixed(1)}" fill="${fill}" stroke="#222" stroke-width="3"/>\n`
    }
  } else if (technique === 3) {
    // Spirograph-like curves
    const numCurves = 3 + Math.floor(seededRandom(seed, 10) * 5)
    for (let c = 0; c < numCurves; c++) {
      const R = 100 + seededRandom(seed, c * 10 + 11) * 150
      const r = 20 + seededRandom(seed, c * 10 + 12) * 80
      const d = 30 + seededRandom(seed, c * 10 + 13) * 100
      const steps = 500
      let pathData = ''
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 20
        const x = width / 2 + (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t)
        const y = height / 2 + (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t)
        pathData += i === 0 ? `M${x.toFixed(1)},${y.toFixed(1)}` : ` L${x.toFixed(1)},${y.toFixed(1)}`
      }
      elements += `  <path d="${pathData}" fill="none" stroke="${palette[c % palette.length]}" stroke-width="0.8" opacity="0.7"/>\n`
    }
  } else {
    // Layered wave lines
    const numWaves = 8 + Math.floor(seededRandom(seed, 10) * 12)
    for (let w = 0; w < numWaves; w++) {
      const yBase = (height / (numWaves + 1)) * (w + 1)
      const amp = 10 + seededRandom(seed, w + 20) * 50
      const freq = 0.01 + seededRandom(seed, w + 30) * 0.03
      const phase = seededRandom(seed, w + 40) * Math.PI * 2
      let pathData = ''
      for (let x = 0; x <= width; x += 2) {
        const y = yBase + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.3 + phase * 0.7) * amp * 0.3
        pathData += x === 0 ? `M${x},${y.toFixed(1)}` : ` L${x},${y.toFixed(1)}`
      }
      elements += `  <path d="${pathData}" fill="none" stroke="${palette[w % palette.length]}" stroke-width="${(1 + seededRandom(seed, w + 50) * 3).toFixed(1)}" opacity="0.7" stroke-linecap="round"/>\n`
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by K:BOT Creative Tools -->
<!-- Description: ${description} -->
<!-- Seed: ${seed} -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="${bgColor}"/>
${elements}</svg>
`
}

// ─── Design Evolution ───────────────────────────────────────────────

function evolveDesign(source: string, mutationIndex: number): string {
  const lines = source.split('\n')
  const seed = hashSeed(source + String(mutationIndex))

  // Strategies for mutation
  const mutated = lines.map((line, lineIdx) => {
    let result = line

    // Mutate numeric values with some probability
    result = result.replace(/(\d+\.?\d*)/g, (match, num) => {
      const val = parseFloat(num)
      if (isNaN(val) || seededRandom(seed, lineIdx * 100 + mutationIndex) > 0.3) return match
      const factor = 0.7 + seededRandom(seed, lineIdx * 100 + mutationIndex + 1) * 0.6 // 0.7 to 1.3
      const mutated = val * factor
      // Preserve integer vs float
      return match.includes('.') ? mutated.toFixed(match.split('.')[1]?.length || 2) : String(Math.round(mutated))
    })

    // Mutate hex colors
    result = result.replace(/#([0-9a-fA-F]{6})/g, (match, hex) => {
      if (seededRandom(seed, lineIdx * 200 + mutationIndex) > 0.4) return match
      const r = parseInt(hex.substring(0, 2), 16)
      const g = parseInt(hex.substring(2, 4), 16)
      const b = parseInt(hex.substring(4, 6), 16)
      const shift = Math.floor((seededRandom(seed, lineIdx * 200 + mutationIndex + 1) - 0.5) * 60)
      const clamp = (v: number) => Math.max(0, Math.min(255, v + shift))
      return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`
    })

    // Mutate hsl colors
    result = result.replace(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/g, (match, h, s, l) => {
      if (seededRandom(seed, lineIdx * 300 + mutationIndex) > 0.4) return match
      const hShift = Math.floor((seededRandom(seed, lineIdx * 300 + mutationIndex + 1) - 0.5) * 60)
      const newH = (parseInt(h) + hShift + 360) % 360
      const newS = Math.max(0, Math.min(100, parseInt(s) + Math.floor((seededRandom(seed, lineIdx * 300 + mutationIndex + 2) - 0.5) * 20)))
      const newL = Math.max(0, Math.min(100, parseInt(l) + Math.floor((seededRandom(seed, lineIdx * 300 + mutationIndex + 3) - 0.5) * 20)))
      return `hsl(${newH}, ${newS}%, ${newL}%)`
    })

    return result
  })

  // Occasionally duplicate or remove a line (structural mutation)
  const finalLines = [...mutated]
  if (seededRandom(seed, 999) > 0.7 && finalLines.length > 5) {
    // Duplicate a random line
    const idx = Math.floor(seededRandom(seed, 998) * finalLines.length)
    finalLines.splice(idx, 0, finalLines[idx])
  }
  if (seededRandom(seed, 997) > 0.8 && finalLines.length > 10) {
    // Remove a random non-critical line
    const idx = 2 + Math.floor(seededRandom(seed, 996) * (finalLines.length - 4))
    finalLines.splice(idx, 1)
  }

  return finalLines.join('\n')
}

// ─── Tool Registration ──────────────────────────────────────────────

export function registerCreativeTools(): void {
  registerTool({
    name: 'generate_art',
    description: 'Generate a self-contained p5.js sketch as an HTML file from a text description. Creates generative art that can be opened directly in a browser.',
    parameters: {
      description: { type: 'string', description: 'Text description of the desired artwork (e.g., "flowing ocean waves at sunset")', required: true },
      style: { type: 'string', description: 'Art style: "abstract", "geometric", "organic", "fractal", or "noise". Defaults to "abstract".' },
      output_path: { type: 'string', description: 'File path to write the HTML file', required: true },
    },
    tier: 'free',
    async execute(args) {
      const description = String(args.description)
      const style = String(args.style || 'abstract')
      const validStyles = ['abstract', 'geometric', 'organic', 'fractal', 'noise']
      if (!validStyles.includes(style)) {
        return `Error: Invalid style "${style}". Choose from: ${validStyles.join(', ')}`
      }
      const outputPath = String(args.output_path)

      const html = generateP5Sketch(description, style)
      ensureDir(outputPath)
      writeFileSync(outputPath, html)
      return `Generated p5.js art (${style} style) at ${outputPath} (${html.length} bytes)\nOpen in a browser to view. Click the canvas to regenerate.`
    },
  })

  registerTool({
    name: 'generate_shader',
    description: 'Generate a Shadertoy-compatible GLSL fragment shader from a text description. Creates animated procedural graphics using noise, raymarching, voronoi, or kaleidoscopic techniques.',
    parameters: {
      description: { type: 'string', description: 'Text description of the desired shader effect (e.g., "molten lava flowing through cracks")', required: true },
      output_path: { type: 'string', description: 'File path to write the .glsl file', required: true },
    },
    tier: 'free',
    async execute(args) {
      const description = String(args.description)
      const outputPath = String(args.output_path)

      const glsl = generateGLSL(description)
      ensureDir(outputPath)
      writeFileSync(outputPath, glsl)
      return `Generated GLSL shader at ${outputPath} (${glsl.length} bytes)\nPaste into https://www.shadertoy.com/new to preview.`
    },
  })

  registerTool({
    name: 'generate_music_pattern',
    description: 'Generate a music pattern as Sonic Pi code or a MIDI-like JSON structure. Creates melodies, bass lines, and drum patterns based on genre and description.',
    parameters: {
      description: { type: 'string', description: 'Text description of the desired music (e.g., "upbeat jazz with walking bass")', required: true },
      genre: { type: 'string', description: 'Music genre: "ambient", "electronic", "jazz", "classical", "hiphop". Defaults to "classical".' },
      format: { type: 'string', description: 'Output format: "sonic-pi" or "json". Defaults to "sonic-pi".', required: true },
      output_path: { type: 'string', description: 'File path to write the output file', required: true },
    },
    tier: 'free',
    async execute(args) {
      const description = String(args.description)
      const genre = String(args.genre || 'classical')
      const format = String(args.format || 'sonic-pi')
      if (format !== 'sonic-pi' && format !== 'json') {
        return `Error: Invalid format "${format}". Choose "sonic-pi" or "json".`
      }
      const outputPath = String(args.output_path)

      const content = generateMusicPattern(description, genre, format)
      ensureDir(outputPath)
      writeFileSync(outputPath, content)

      const ext = format === 'json' ? 'JSON' : 'Sonic Pi'
      return `Generated ${ext} music pattern at ${outputPath} (${content.length} bytes)\n${format === 'sonic-pi' ? 'Open in Sonic Pi (https://sonic-pi.net/) to play.' : 'Load the JSON into a DAW or MIDI player.'}`
    },
  })

  registerTool({
    name: 'generate_svg',
    description: 'Generate algorithmic SVG art from a text description. Creates generative patterns including concentric circles, mesh networks, Mondrian grids, spirographs, or wave patterns.',
    parameters: {
      description: { type: 'string', description: 'Text description of the desired SVG artwork', required: true },
      width: { type: 'number', description: 'SVG width in pixels. Defaults to 800.' },
      height: { type: 'number', description: 'SVG height in pixels. Defaults to 800.' },
      output_path: { type: 'string', description: 'File path to write the .svg file', required: true },
    },
    tier: 'free',
    async execute(args) {
      const description = String(args.description)
      const width = typeof args.width === 'number' ? args.width : 800
      const height = typeof args.height === 'number' ? args.height : 800
      if (width < 10 || width > 10000 || height < 10 || height > 10000) {
        return 'Error: Width and height must be between 10 and 10000.'
      }
      const outputPath = String(args.output_path)

      const svg = generateSVG(description, width, height)
      ensureDir(outputPath)
      writeFileSync(outputPath, svg)
      return `Generated SVG art at ${outputPath} (${svg.length} bytes, ${width}x${height})\nOpen in a browser or SVG editor to view.`
    },
  })

  registerTool({
    name: 'evolve_design',
    description: 'Take an existing design file (HTML, SVG, GLSL, CSS, etc.) and generate N mutations by tweaking numeric values, colors, and structure. Outputs each variant as a separate file. Useful for exploring design spaces.',
    parameters: {
      source_path: { type: 'string', description: 'Path to the source design file to mutate', required: true },
      mutations: { type: 'number', description: 'Number of mutations to generate. Defaults to 5.', default: 5 },
      output_dir: { type: 'string', description: 'Directory to write mutated variants', required: true },
    },
    tier: 'free',
    async execute(args) {
      const sourcePath = String(args.source_path)
      if (!existsSync(sourcePath)) return `Error: Source file not found: ${sourcePath}`

      const source = readFileSync(sourcePath, 'utf-8')
      const mutations = typeof args.mutations === 'number' ? Math.max(1, Math.min(args.mutations, 50)) : 5
      const outputDir = String(args.output_dir)
      mkdirSync(outputDir, { recursive: true })

      const ext = extname(sourcePath)
      const base = basename(sourcePath, ext)
      const results: string[] = []

      for (let i = 0; i < mutations; i++) {
        const mutated = evolveDesign(source, i)
        const outPath = join(outputDir, `${base}_variant_${i + 1}${ext}`)
        writeFileSync(outPath, mutated)
        results.push(`  ${outPath} (${mutated.length} bytes)`)
      }

      return `Evolved ${mutations} variants from ${sourcePath}:\n${results.join('\n')}\n\nEach variant has randomized tweaks to numeric values, colors, and occasionally structure.`
    },
  })
}
