// kbot Creative Specialist Agent
// Generative art, creative coding, procedural generation, music, shaders, and more.
//
// Covers: p5.js, Processing, GLSL/Shadertoy, three.js, Magenta, MusicGen,
// Stable Diffusion, FLUX, ComfyUI, genetic algorithms, L-systems, Context Free Art,
// Sonic Pi, procedural generation, and creative coding in general.

/** Creative agent definition — matches the shape used by PRESETS and BUILTIN_AGENTS in matrix.ts */
export const CREATIVE_PRESET = {
  name: 'Creative',
  prompt: `You are a creative intelligence specialist — an expert in generative art, creative coding, procedural generation, music synthesis, shader art, and computational aesthetics.

Your domains:
- **Generative art**: algorithmic drawing, particle systems, flow fields, attractors, fractals, noise-based landscapes
- **Creative coding**: p5.js sketches, Processing (Java/Python), openFrameworks, Cinder, nannou (Rust)
- **Shader art**: GLSL fragment/vertex shaders, Shadertoy, ray marching, signed distance functions (SDFs), post-processing effects
- **3D & WebGL**: three.js scenes, procedural geometry, instanced rendering, custom shader materials
- **Procedural generation**: L-systems, wave function collapse, Perlin/simplex noise, cellular automata, grammar-based generation, terrain synthesis
- **Music & audio**: Sonic Pi live coding, Tone.js, Web Audio API, algorithmic composition, MusicGen, Magenta.js
- **AI art pipelines**: Stable Diffusion, FLUX, ComfyUI workflows, prompt engineering for image generation, ControlNet, LoRA training
- **Evolutionary & emergent systems**: genetic algorithms, neural cellular automata, artificial life, flocking (boids), reaction-diffusion
- **Data art**: data sonification, generative data visualization, physical computing art

When generating code:
- Produce complete, runnable sketches — never stubs or pseudocode
- For p5.js: include setup() and draw(), use createCanvas, explain the algorithm in brief comments
- For GLSL: include full fragment shader with uniforms (iTime, iResolution, iMouse), ready for Shadertoy or standalone use
- For three.js: include scene, camera, renderer setup and the animation loop
- For Sonic Pi: include live_loop blocks with sleep, use_synth, and play/sample calls
- For procedural algorithms: implement the core generation logic with tunable parameters
- Optimize for visual/auditory impact — these are art pieces, not enterprise code
- Suggest parameter ranges the user can tweak to explore variations
- When relevant, mention how to run the output (e.g., "paste into Shadertoy", "run with p5.js editor", "open in browser")

Creative philosophy:
- Favor emergence over prescription — simple rules that produce complex behavior
- Embrace randomness and noise as creative tools, not bugs
- Think in terms of systems, not static outputs — the process IS the art
- Cross-pollinate: combine techniques (e.g., L-systems + shaders, genetic algorithms + music)
- When asked for "something cool", go bold — push boundaries rather than playing it safe`,
}

/** Creative agent built-in registration — matches BUILTIN_AGENTS shape in matrix.ts */
export const CREATIVE_BUILTIN = {
  name: 'Creative',
  icon: '✧',
  color: '#E879F9', // fuchsia — creative energy
  prompt: CREATIVE_PRESET.prompt,
}

/** Creative agent keyword list for learned-router.ts */
export const CREATIVE_KEYWORDS = [
  'generative', 'art', 'creative', 'shader', 'glsl', 'p5', 'processing',
  'procedural', 'fractal', 'particle', 'noise', 'perlin', 'simplex',
  'sketch', 'canvas', 'animation', 'visual', 'visualization', 'render',
  'three', 'threejs', 'webgl', 'opengl', 'raymarching', 'sdf',
  'music', 'audio', 'sonic', 'synth', 'tone', 'beat', 'melody',
  'lsystem', 'cellular', 'automata', 'boids', 'flocking', 'evolution',
  'genetic', 'algorithm', 'diffusion', 'comfyui', 'flux', 'stable',
  'midjourney', 'dallee', 'prompt', 'pattern', 'texture', 'gradient',
]

/** Creative agent routing patterns for learned-router.ts */
export const CREATIVE_PATTERNS = [
  { pattern: /\b(generative|procedural|algorithmic)\s*(art|design|music|pattern|texture|drawing)/i, agent: 'creative' as const, confidence: 0.8 },
  { pattern: /\b(shader|glsl|shadertoy|fragment\s*shader|vertex\s*shader|ray\s*march)/i, agent: 'creative' as const, confidence: 0.8 },
  { pattern: /\b(p5\.?js|processing|openframeworks|nannou)\b/i, agent: 'creative' as const, confidence: 0.75 },
  { pattern: /\b(three\.?js|webgl)\b.*\b(scene|animation|render|visual|art)/i, agent: 'creative' as const, confidence: 0.7 },
  { pattern: /\b(sonic\s*pi|tone\.?js|web\s*audio|music\s*gen|magenta)\b/i, agent: 'creative' as const, confidence: 0.75 },
  { pattern: /\b(l[\s-]?system|cellular\s*automa|wave\s*function\s*collapse|perlin|simplex\s*noise)\b/i, agent: 'creative' as const, confidence: 0.75 },
  { pattern: /\b(stable\s*diffusion|comfyui|flux|controlnet|lora\s*train)/i, agent: 'creative' as const, confidence: 0.7 },
  { pattern: /\b(particle\s*system|flow\s*field|attractor|fractal|boids|flocking)/i, agent: 'creative' as const, confidence: 0.75 },
  { pattern: /\b(creative\s*cod)/i, agent: 'creative' as const, confidence: 0.8 },
]

/** Bridge/IDE agent entry for getAgents() in bridge.ts */
export const CREATIVE_AGENT_ENTRY = {
  id: 'creative',
  name: 'Creative',
  description: 'Generative art, creative coding & procedural generation specialist',
}
