// kbot VFX & Creative Production Tools — Houdini-inspired
// Procedural generation, video processing, image manipulation,
// 3D rendering, shader generation, and creative coding.

import { registerTool } from './index.js'
import { execFile } from 'child_process'

function shell(cmd: string, args: string[], timeout = 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout, maxBuffer: 2 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message))
      else resolve(stdout || stderr)
    })
  })
}

export function registerVfxTools(): void {
  // ── VEX Code Generation ───────────────────────────────────────────
  registerTool({
    name: 'vex_generate',
    description: 'Generate Houdini VEX code for procedural effects. Creates point wrangles, volume wrangles, and attribute manipulation code.',
    parameters: {
      effect: { type: 'string', description: 'Effect type: noise, scatter, curl_noise, wave, fractal, vortex, erosion, growth', required: true },
      target: { type: 'string', description: 'Target context: point, vertex, primitive, detail (default: point)' },
      params: { type: 'string', description: 'JSON params like frequency, amplitude, octaves' },
    },
    tier: 'free',
    async execute(args) {
      const effect = String(args.effect).toLowerCase()
      const target = String(args.target || 'point')
      const params = args.params ? JSON.parse(String(args.params)) : {}

      const templates: Record<string, string> = {
        noise: `// ${target} wrangle — Perlin noise displacement
float freq = chf("frequency"); // ${params.frequency || 1.0}
float amp = chf("amplitude");  // ${params.amplitude || 0.5}
int oct = chi("octaves");      // ${params.octaves || 4}

vector pos = @P;
float n = 0;
float f = freq;
float a = amp;

for (int i = 0; i < oct; i++) {
    n += a * noise(pos * f);
    f *= 2.0;
    a *= 0.5;
}

@P += @N * n;
@Cd = set(n, n * 0.8, n * 0.6);`,

        curl_noise: `// ${target} wrangle — Curl noise for fluid-like motion
float freq = chf("frequency"); // ${params.frequency || 0.5}
float amp = chf("amplitude");  // ${params.amplitude || 1.0}
float time = @Time;

vector pos = @P * freq + time * 0.3;

// Compute curl via cross product of noise gradients
float eps = 0.001;
vector dx = set(eps, 0, 0);
vector dy = set(0, eps, 0);
vector dz = set(0, 0, eps);

float nx = noise(pos + dy).z - noise(pos - dy).z - noise(pos + dz).y + noise(pos - dz).y;
float ny = noise(pos + dz).x - noise(pos - dz).x - noise(pos + dx).z + noise(pos - dx).z;
float nz = noise(pos + dx).y - noise(pos - dx).y - noise(pos + dy).x + noise(pos - dy).x;

vector curl = set(nx, ny, nz) / (2.0 * eps);
@v = curl * amp;
@P += @v * @TimeInc;`,

        scatter: `// ${target} wrangle — Poisson disk scatter
float density = chf("density"); // ${params.density || 100}
float radius = chf("min_radius"); // ${params.radius || 0.1}
float seed = chf("seed");

int npts = int(density * @Area);
for (int i = 0; i < npts; i++) {
    vector2 uv = set(random(i + seed), random(i + seed + 0.5));
    vector pos = primuv(0, "P", @primnum, uv);
    int pt = addpoint(0, pos);
    setpointattrib(0, "N", pt, @N);
    setpointattrib(0, "Cd", pt, rand(set(i, seed, 0)));
}`,

        wave: `// ${target} wrangle — Sine wave deformation
float freq = chf("frequency"); // ${params.frequency || 3.0}
float amp = chf("amplitude");  // ${params.amplitude || 0.3}
float speed = chf("speed");    // ${params.speed || 1.0}

float dist = length(@P.xz);
float wave = sin(dist * freq - @Time * speed) * amp;
wave *= exp(-dist * 0.1); // Falloff

@P.y += wave;
@Cd = fit01(wave / amp * 0.5 + 0.5, set(0.1, 0.2, 0.8), set(0.9, 0.95, 1.0));`,

        fractal: `// ${target} wrangle — Mandelbrot fractal mapping
int max_iter = chi("iterations"); // ${params.iterations || 100}
float scale = chf("scale");      // ${params.scale || 2.0}
vector2 center = chu("center");  // ${params.center || '0, 0'}

vector2 c = (@P.xz - 0.5) * scale + set(center.x, center.y);
vector2 z = c;
int iter = 0;

for (int i = 0; i < max_iter; i++) {
    if (length(z) > 2.0) break;
    z = set(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    iter++;
}

float t = float(iter) / float(max_iter);
@P.y = t * chf("height");
@Cd = chramp("color", t);`,

        vortex: `// ${target} wrangle — Vortex field
float strength = chf("strength"); // ${params.strength || 2.0}
float radius = chf("radius");     // ${params.radius || 1.0}
float falloff = chf("falloff");   // ${params.falloff || 2.0}
vector center = chv("center");

vector delta = @P - center;
float dist = length(delta);
float factor = strength * exp(-pow(dist / radius, falloff));

// Tangential velocity (perpendicular to radial direction)
vector tangent = normalize(cross(delta, set(0, 1, 0)));
@v += tangent * factor;
@P += @v * @TimeInc;`,

        erosion: `// ${target} wrangle — Hydraulic erosion simulation step
float sediment = 0;
float water = chf("water_amount"); // ${params.water || 0.1}
float erosion_rate = chf("erosion_rate"); // ${params.erosion_rate || 0.01}
float deposition = chf("deposition"); // ${params.deposition || 0.005}

// Get height and neighbors
float h = @P.y;
int nbs[] = neighbours(0, @ptnum);

float min_h = h;
int min_nb = -1;
foreach (int nb; nbs) {
    float nh = point(0, "P", nb).y;
    if (nh < min_h) { min_h = nh; min_nb = nb; }
}

if (min_nb >= 0) {
    float diff = h - min_h;
    float erode = min(diff * erosion_rate * water, diff * 0.5);
    @P.y -= erode;
    sediment += erode;
    // Deposit downstream
    vector npos = point(0, "P", min_nb);
    npos.y += sediment * deposition;
    setpointattrib(0, "P", min_nb, npos);
}`,

        growth: `// ${target} wrangle — Differential growth / space colonization
float search_radius = chf("search_radius"); // ${params.search_radius || 0.5}
float step_size = chf("step_size");         // ${params.step_size || 0.05}
float repel = chf("repulsion");             // ${params.repulsion || 0.02}

int nbs[] = pcfind(0, "P", @P, search_radius, 20);
vector avg_dir = set(0, 0, 0);

foreach (int nb; nbs) {
    if (nb == @ptnum) continue;
    vector delta = @P - point(0, "P", nb);
    float dist = length(delta);
    if (dist > 0.001) {
        avg_dir += normalize(delta) * repel / (dist * dist);
    }
}

// Grow along normal + repulsion
@P += normalize(@N + avg_dir) * step_size;
@N = normalize(@N + avg_dir * 0.1);`,
      }

      const code = templates[effect]
      if (!code) {
        return `Unknown effect "${effect}". Available: ${Object.keys(templates).join(', ')}`
      }
      return `\`\`\`vex\n${code}\n\`\`\`\n\nPaste into a ${target} wrangle in Houdini. Adjust channel references (chf/chi/chv) on the node parameters.`
    },
  })

  // ── FFmpeg Video Processing ───────────────────────────────────────
  registerTool({
    name: 'ffmpeg_process',
    description: 'Process video/audio with FFmpeg. Encode, decode, filter, composite, extract frames, create timelapses, add effects.',
    parameters: {
      input: { type: 'string', description: 'Input file path', required: true },
      output: { type: 'string', description: 'Output file path', required: true },
      operation: { type: 'string', description: 'Operation: encode, extract_frames, gif, timelapse, stabilize, grayscale, reverse, speed, trim, concat, audio_extract, thumbnail', required: true },
      options: { type: 'string', description: 'Additional options as JSON (e.g., {"fps": 30, "start": "00:01:00", "duration": "10"})' },
    },
    tier: 'free',
    timeout: 300_000,
    async execute(args) {
      const input = String(args.input)
      const output = String(args.output)
      const op = String(args.operation)
      const opts = args.options ? JSON.parse(String(args.options)) : {}

      const commands: Record<string, string[]> = {
        encode: ['-i', input, '-c:v', 'libx264', '-preset', 'medium', '-crf', String(opts.quality || 23), output],
        extract_frames: ['-i', input, '-vf', `fps=${opts.fps || 1}`, `${output}_%04d.png`],
        gif: ['-i', input, '-vf', `fps=${opts.fps || 10},scale=${opts.width || 480}:-1:flags=lanczos`, '-loop', '0', output],
        timelapse: ['-i', input, '-vf', `setpts=${1 / (opts.speed || 10)}*PTS`, output],
        grayscale: ['-i', input, '-vf', 'format=gray', output],
        reverse: ['-i', input, '-vf', 'reverse', '-af', 'areverse', output],
        speed: ['-i', input, '-vf', `setpts=${1 / (opts.speed || 2)}*PTS`, '-af', `atempo=${opts.speed || 2}`, output],
        trim: ['-i', input, '-ss', opts.start || '0', '-t', opts.duration || '10', '-c', 'copy', output],
        audio_extract: ['-i', input, '-vn', '-acodec', opts.codec || 'libmp3lame', output],
        thumbnail: ['-i', input, '-vf', 'thumbnail', '-frames:v', '1', output],
        stabilize: ['-i', input, '-vf', 'deshake', output],
      }

      const cmdArgs = commands[op]
      if (!cmdArgs) return `Unknown operation "${op}". Available: ${Object.keys(commands).join(', ')}`

      try {
        const result = await shell('ffmpeg', ['-y', ...cmdArgs], 300_000)
        return `FFmpeg ${op} complete: ${output}\n${result}`
      } catch (err) {
        return `FFmpeg error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── ImageMagick ───────────────────────────────────────────────────
  registerTool({
    name: 'imagemagick',
    description: 'Manipulate images with ImageMagick. Resize, crop, composite, effects, format conversion, batch processing.',
    parameters: {
      input: { type: 'string', description: 'Input image path', required: true },
      output: { type: 'string', description: 'Output image path', required: true },
      operation: { type: 'string', description: 'Operation: resize, crop, rotate, blur, sharpen, grayscale, sepia, posterize, edge, emboss, negate, composite, montage, border, text', required: true },
      value: { type: 'string', description: 'Operation value (e.g., "50%" for resize, "10x10" for blur, text for annotation)' },
    },
    tier: 'free',
    async execute(args) {
      const input = String(args.input)
      const output = String(args.output)
      const op = String(args.operation)
      const val = String(args.value || '')

      const commands: Record<string, string[]> = {
        resize: ['convert', input, '-resize', val || '50%', output],
        crop: ['convert', input, '-crop', val || '100x100+0+0', output],
        rotate: ['convert', input, '-rotate', val || '90', output],
        blur: ['convert', input, '-blur', val || '0x8', output],
        sharpen: ['convert', input, '-sharpen', val || '0x3', output],
        grayscale: ['convert', input, '-colorspace', 'Gray', output],
        sepia: ['convert', input, '-sepia-tone', val || '80%', output],
        posterize: ['convert', input, '-posterize', val || '4', output],
        edge: ['convert', input, '-edge', val || '1', output],
        emboss: ['convert', input, '-emboss', val || '2', output],
        negate: ['convert', input, '-negate', output],
        border: ['convert', input, '-border', val || '10x10', '-bordercolor', '#6B5B95', output],
        text: ['convert', input, '-pointsize', '36', '-fill', 'white', '-gravity', 'south', '-annotate', '+0+10', val || 'kbot', output],
      }

      const cmdArgs = commands[op]
      if (!cmdArgs) return `Unknown operation "${op}". Available: ${Object.keys(commands).join(', ')}`

      try {
        const result = await shell('magick', cmdArgs)
        return `ImageMagick ${op} complete: ${output}\n${result}`
      } catch {
        // Fallback: try without 'magick' prefix (older ImageMagick)
        try {
          const result = await shell(cmdArgs[0], cmdArgs.slice(1))
          return `ImageMagick ${op} complete: ${output}\n${result}`
        } catch (err) {
          return `ImageMagick error: ${err instanceof Error ? err.message : String(err)}. Is ImageMagick installed?`
        }
      }
    },
  })

  // ── Blender Script ────────────────────────────────────────────────
  registerTool({
    name: 'blender_run',
    description: 'Execute a Blender Python script in background mode. Generate 3D models, render scenes, create animations.',
    parameters: {
      script: { type: 'string', description: 'Python script content or file path', required: true },
      output: { type: 'string', description: 'Output file path for renders' },
      blend_file: { type: 'string', description: 'Optional .blend file to open first' },
    },
    tier: 'free',
    timeout: 300_000,
    async execute(args) {
      const script = String(args.script)
      const output = args.output ? String(args.output) : ''

      // Write inline script to temp file if it's not a path
      if (!script.endsWith('.py')) {
        const { writeFileSync, mkdtempSync } = await import('fs')
        const { join } = await import('path')
        const tmpDir = mkdtempSync('/tmp/kbot-blender-')
        const scriptPath = join(tmpDir, 'script.py')
        writeFileSync(scriptPath, script)

        const blenderArgs = ['--background', '--python', scriptPath]
        if (args.blend_file) blenderArgs.unshift(String(args.blend_file))
        if (output) blenderArgs.push('--render-output', output, '--render-frame', '1')

        try {
          return await shell('blender', blenderArgs, 300_000)
        } catch (err) {
          return `Blender error: ${err instanceof Error ? err.message : String(err)}. Is Blender installed?`
        }
      }

      const blenderArgs = ['--background', '--python', script]
      if (args.blend_file) blenderArgs.unshift(String(args.blend_file))
      try {
        return await shell('blender', blenderArgs, 300_000)
      } catch (err) {
        return `Blender error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── Procedural Texture Generation ─────────────────────────────────
  registerTool({
    name: 'texture_generate',
    description: 'Generate tileable procedural textures using Python/Pillow. Creates noise, marble, wood, brick, hex patterns.',
    parameters: {
      type: { type: 'string', description: 'Texture type: perlin, marble, wood, brick, hexagon, voronoi, checkerboard, gradient', required: true },
      size: { type: 'number', description: 'Texture size in pixels (default: 512)' },
      output: { type: 'string', description: 'Output file path (default: texture.png)', required: true },
      seed: { type: 'number', description: 'Random seed for reproducibility' },
    },
    tier: 'free',
    async execute(args) {
      const type = String(args.type)
      const size = Number(args.size) || 512
      const output = String(args.output)
      const seed = args.seed !== undefined ? Number(args.seed) : 42

      const script = `
import random, math
random.seed(${seed})

# Simple procedural texture generator
size = ${size}
pixels = []

def noise2d(x, y):
    n = int(x * 57 + y * 131 + ${seed})
    n = (n << 13) ^ n
    return 1.0 - ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 1073741824.0

def smooth_noise(x, y):
    corners = (noise2d(int(x)-1, int(y)-1) + noise2d(int(x)+1, int(y)-1) + noise2d(int(x)-1, int(y)+1) + noise2d(int(x)+1, int(y)+1)) / 16.0
    sides = (noise2d(int(x)-1, int(y)) + noise2d(int(x)+1, int(y)) + noise2d(int(x), int(y)-1) + noise2d(int(x), int(y)+1)) / 8.0
    center = noise2d(int(x), int(y)) / 4.0
    return corners + sides + center

def lerp(a, b, t):
    return a + t * (b - a)

for py in range(size):
    for px in range(size):
        u = px / size
        v = py / size
        t = '${type}'
        if t == 'checkerboard':
            c = int((u * 8) % 2) ^ int((v * 8) % 2)
            val = c * 255
        elif t == 'gradient':
            val = int(u * 255)
        elif t == 'hexagon':
            hx = u * 8
            hy = v * 8
            if int(hy) % 2 == 1: hx += 0.5
            fx = hx - int(hx)
            fy = hy - int(hy)
            d = min(abs(fx - 0.5), abs(fy - 0.5))
            val = 255 if d > 0.1 else 100
        elif t == 'voronoi':
            min_d = 999
            for i in range(16):
                cx = random.Random(i + ${seed}).random()
                cy = random.Random(i + ${seed} + 100).random()
                d = math.sqrt((u - cx)**2 + (v - cy)**2)
                min_d = min(min_d, d)
            val = int(min(min_d * 500, 255))
        else:
            # Perlin-ish noise for perlin, marble, wood
            n = smooth_noise(u * 8, v * 8)
            if t == 'marble':
                n = math.sin(u * 10 + n * 5) * 0.5 + 0.5
            elif t == 'wood':
                d = math.sqrt((u - 0.5)**2 + (v - 0.5)**2) * 20
                n = math.sin(d + n * 2) * 0.5 + 0.5
            else:
                n = n * 0.5 + 0.5
            val = int(max(0, min(255, n * 255)))
        pixels.append(val)

# Write as PGM then convert
with open('${output.replace(/'/g, "\\'")}', 'wb') as f:
    header = f'P5\\n${size} ${size}\\n255\\n'
    f.write(header.encode())
    f.write(bytes(pixels))

print(f'Generated ${type} texture: ${size}x${size} -> ${output}')
`
      try {
        return await shell('python3', ['-c', script], 30_000)
      } catch (err) {
        return `Texture generation error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── GLSL Shader Generation ────────────────────────────────────────
  registerTool({
    name: 'shader_generate',
    description: 'Generate GLSL/HLSL shader code from descriptions. Creates vertex, fragment, compute shaders for effects like water, fire, displacement, post-processing.',
    parameters: {
      effect: { type: 'string', description: 'Shader effect: water, fire, plasma, raymarching, fog, bloom, chromatic_aberration, film_grain, outline, dissolve', required: true },
      language: { type: 'string', description: 'Shader language: glsl, hlsl, wgsl (default: glsl)' },
    },
    tier: 'free',
    async execute(args) {
      const effect = String(args.effect).toLowerCase()
      const lang = String(args.language || 'glsl').toLowerCase()

      const shaders: Record<string, string> = {
        water: `// Water surface shader — ${lang.toUpperCase()}
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;

float wave(vec2 p, float t) {
    return sin(p.x * 3.0 + t) * 0.1 +
           sin(p.y * 4.0 + t * 1.3) * 0.08 +
           sin((p.x + p.y) * 5.0 + t * 0.7) * 0.05;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float w = wave(uv * 10.0, u_time);

    // Fresnel-like edge darkening
    float depth = 0.3 + w;
    vec3 shallow = vec3(0.2, 0.7, 0.9);
    vec3 deep = vec3(0.0, 0.1, 0.3);
    vec3 color = mix(deep, shallow, depth);

    // Specular highlight
    float spec = pow(max(0.0, w * 5.0), 8.0) * 0.5;
    color += vec3(spec);

    gl_FragColor = vec4(color, 0.9);
}`,

        fire: `// Procedural fire shader — ${lang.toUpperCase()}
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash(i), hash(i + vec2(1,0)), f.x),
        mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
        f.y
    );
}

float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    uv.y = 1.0 - uv.y; // Flip Y

    float n = fbm(uv * 5.0 + vec2(0, -u_time * 2.0));
    float shape = 1.0 - uv.y;
    shape *= smoothstep(0.0, 0.3, 0.5 - abs(uv.x - 0.5));

    float fire = shape * n * 2.0;

    vec3 col = vec3(1.5, 0.5, 0.1) * fire;
    col += vec3(1.0, 0.9, 0.3) * pow(fire, 3.0);
    col += vec3(0.3, 0.05, 0.0) * smoothstep(0.0, 0.5, fire);

    gl_FragColor = vec4(col, fire);
}`,

        plasma: `// Plasma effect shader — ${lang.toUpperCase()}
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution * 10.0;
    float t = u_time;

    float v = sin(uv.x + t);
    v += sin((uv.y + t) * 0.5);
    v += sin((uv.x + uv.y + t) * 0.5);
    v += sin(sqrt(uv.x * uv.x + uv.y * uv.y) + t);
    v *= 0.5;

    vec3 color = vec3(
        sin(v * 3.14159) * 0.5 + 0.5,
        sin(v * 3.14159 + 2.094) * 0.5 + 0.5,
        sin(v * 3.14159 + 4.189) * 0.5 + 0.5
    );

    gl_FragColor = vec4(color, 1.0);
}`,

        raymarching: `// Raymarching SDF shader — ${lang.toUpperCase()}
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;

float sdSphere(vec3 p, float r) { return length(p) - r; }
float sdBox(vec3 p, vec3 b) { vec3 d = abs(p) - b; return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0)); }

float scene(vec3 p) {
    float sphere = sdSphere(p - vec3(0, 0, 0), 1.0);
    float box = sdBox(p - vec3(0, 0, 0), vec3(0.75));
    float blend = mix(sphere, box, sin(u_time) * 0.5 + 0.5);

    // Infinite repetition
    vec3 q = mod(p + 2.0, 4.0) - 2.0;
    float repeated = sdSphere(q, 0.3);

    return min(blend, repeated);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
    vec3 ro = vec3(0, 0, -3);
    vec3 rd = normalize(vec3(uv, 1));

    float t = 0.0;
    for (int i = 0; i < 64; i++) {
        vec3 p = ro + rd * t;
        float d = scene(p);
        if (d < 0.001 || t > 20.0) break;
        t += d;
    }

    vec3 col = vec3(0);
    if (t < 20.0) {
        vec3 p = ro + rd * t;
        // Simple normal estimation
        vec2 e = vec2(0.001, 0);
        vec3 n = normalize(vec3(
            scene(p + e.xyy) - scene(p - e.xyy),
            scene(p + e.yxy) - scene(p - e.yxy),
            scene(p + e.yyx) - scene(p - e.yyx)
        ));
        float diff = max(dot(n, normalize(vec3(1, 1, -1))), 0.0);
        col = vec3(0.4, 0.2, 0.6) * diff + vec3(0.1);
    }

    gl_FragColor = vec4(col, 1.0);
}`,

        bloom: `// Post-processing bloom shader — ${lang.toUpperCase()}
precision mediump float;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_threshold;
uniform float u_intensity;

vec3 sampleBlur(vec2 uv, float radius) {
    vec3 sum = vec3(0);
    float total = 0.0;
    for (float x = -4.0; x <= 4.0; x += 1.0) {
        for (float y = -4.0; y <= 4.0; y += 1.0) {
            vec2 offset = vec2(x, y) * radius / u_resolution;
            float weight = 1.0 - length(vec2(x, y)) / 5.66;
            if (weight > 0.0) {
                sum += texture2D(u_texture, uv + offset).rgb * weight;
                total += weight;
            }
        }
    }
    return sum / total;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec3 color = texture2D(u_texture, uv).rgb;

    // Extract bright areas
    float brightness = dot(color, vec3(0.2126, 0.7152, 0.0722));
    vec3 bright = color * step(u_threshold, brightness);

    // Blur bright areas
    vec3 bloom = sampleBlur(uv, 3.0);

    gl_FragColor = vec4(color + bloom * u_intensity, 1.0);
}`,

        film_grain: `// Film grain post-processing — ${lang.toUpperCase()}
precision mediump float;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_intensity;

float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec3 color = texture2D(u_texture, uv).rgb;

    float grain = rand(uv + fract(u_time)) * 2.0 - 1.0;
    grain *= u_intensity;

    // Vignette
    float vignette = 1.0 - length(uv - 0.5) * 1.2;
    vignette = smoothstep(0.0, 1.0, vignette);

    color += grain;
    color *= vignette;

    gl_FragColor = vec4(color, 1.0);
}`,

        dissolve: `// Dissolve transition shader — ${lang.toUpperCase()}
precision mediump float;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_progress;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec3 color = texture2D(u_texture, uv).rgb;

    float noise = hash(uv * 100.0);
    float edge = smoothstep(u_progress - 0.05, u_progress + 0.05, noise);

    // Glowing edge
    float edgeGlow = 1.0 - abs(noise - u_progress) * 20.0;
    edgeGlow = max(0.0, edgeGlow);
    vec3 glowColor = vec3(1.0, 0.5, 0.1) * edgeGlow * 3.0;

    color = mix(vec3(0), color, edge) + glowColor;
    float alpha = step(0.01, edge + edgeGlow);

    gl_FragColor = vec4(color, alpha);
}`,
      }

      const code = shaders[effect]
      if (!code) return `Unknown shader "${effect}". Available: ${Object.keys(shaders).join(', ')}`
      return `\`\`\`glsl\n${code}\n\`\`\``
    },
  })

  // ── Color Palette Generator ───────────────────────────────────────
  registerTool({
    name: 'color_palette',
    description: 'Generate color palettes from descriptions, images, or color theory rules. Returns hex colors with names.',
    parameters: {
      source: { type: 'string', description: 'Description ("warm sunset"), hex color ("#6B5B95"), or image path', required: true },
      count: { type: 'number', description: 'Number of colors (default: 5)' },
      harmony: { type: 'string', description: 'Color harmony: complementary, analogous, triadic, split_complementary, tetradic, monochromatic' },
    },
    tier: 'free',
    async execute(args) {
      const source = String(args.source)
      const count = Number(args.count) || 5

      // If source is a hex color, generate harmonies
      if (source.startsWith('#') && source.length >= 7) {
        const r = parseInt(source.slice(1, 3), 16)
        const g = parseInt(source.slice(3, 5), 16)
        const b = parseInt(source.slice(5, 7), 16)
        // Convert to HSL
        const rf = r / 255, gf = g / 255, bf = b / 255
        const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf)
        let h = 0, s = 0
        const l = (max + min) / 2
        if (max !== min) {
          const d = max - min
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
          if (max === rf) h = ((gf - bf) / d + (gf < bf ? 6 : 0)) / 6
          else if (max === gf) h = ((bf - rf) / d + 2) / 6
          else h = ((rf - gf) / d + 4) / 6
        }

        const harmony = String(args.harmony || 'analogous')
        const offsets: number[] = []
        switch (harmony) {
          case 'complementary': offsets.push(0, 0.5); break
          case 'triadic': offsets.push(0, 1/3, 2/3); break
          case 'split_complementary': offsets.push(0, 5/12, 7/12); break
          case 'tetradic': offsets.push(0, 0.25, 0.5, 0.75); break
          case 'monochromatic': for (let i = 0; i < count; i++) offsets.push(0); break
          default: for (let i = 0; i < count; i++) offsets.push(i * 30 / 360); break // analogous
        }

        // Pad to requested count
        while (offsets.length < count) offsets.push(offsets[offsets.length - 1] + 0.1)

        const hslToHex = (h: number, s: number, l: number) => {
          h = ((h % 1) + 1) % 1
          const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1; if (t > 1) t -= 1
            if (t < 1/6) return p + (q - p) * 6 * t
            if (t < 1/2) return q
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
            return p
          }
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s
          const p = 2 * l - q
          const ri = Math.round(hue2rgb(p, q, h + 1/3) * 255)
          const gi = Math.round(hue2rgb(p, q, h) * 255)
          const bi = Math.round(hue2rgb(p, q, h - 1/3) * 255)
          return `#${ri.toString(16).padStart(2, '0')}${gi.toString(16).padStart(2, '0')}${bi.toString(16).padStart(2, '0')}`
        }

        const colors = offsets.slice(0, count).map((offset, i) => {
          const newH = h + offset
          const newL = harmony === 'monochromatic' ? l - 0.15 + (i * 0.3 / count) : l
          return hslToHex(newH, s, Math.max(0.1, Math.min(0.9, newL)))
        })

        return `## ${harmony.replace('_', ' ')} palette from ${source}\n\n${colors.map((c, i) => `${i + 1}. \`${c}\` ${'█'.repeat(8)}`).join('\n')}`
      }

      // Named palette descriptions
      const palettes: Record<string, string[]> = {
        'warm sunset': ['#FF6B35', '#F7C59F', '#EFEFD0', '#004E7C', '#1A2238'],
        'ocean': ['#05445E', '#189AB4', '#75E6DA', '#D4F1F9', '#E8F8F5'],
        'forest': ['#2D5016', '#4A7C2E', '#8FBC54', '#C5E17A', '#F0F4E4'],
        'cyberpunk': ['#FF00FF', '#00FFFF', '#FF006E', '#8338EC', '#3A0CA3'],
        'minimal': ['#2B2D42', '#8D99AE', '#EDF2F4', '#EF233C', '#D90429'],
        'earth': ['#5C4033', '#8B6914', '#DAA520', '#F0E68C', '#FAF0E6'],
        'pastel': ['#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF'],
        'midnight': ['#0D1B2A', '#1B2838', '#324A5F', '#6B8F71', '#AAC0AA'],
        'rubin': ['#6B5B95', '#8E7CC3', '#B8A9C9', '#F5F0EB', '#2A2A2A'],
      }

      const key = Object.keys(palettes).find(k => source.toLowerCase().includes(k))
      if (key) {
        const colors = palettes[key].slice(0, count)
        return `## "${key}" palette\n\n${colors.map((c, i) => `${i + 1}. \`${c}\` ${'█'.repeat(8)}`).join('\n')}`
      }

      // Default: generate based on hash of description
      const hash = Array.from(source).reduce((acc, c) => acc + c.charCodeAt(0), 0)
      const baseHue = (hash % 360) / 360
      const colors = Array.from({ length: count }, (_, i) => {
        const h = baseHue + i * (1 / count)
        const s = 0.5 + (i % 2) * 0.2
        const l = 0.3 + i * (0.4 / count)
        const hslToHex2 = (h: number, s: number, l: number) => {
          h = ((h % 1) + 1) % 1
          const a = s * Math.min(l, 1 - l)
          const f = (n: number) => {
            const k = (n + h * 12) % 12
            return Math.round((l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)) * 255)
          }
          return `#${f(0).toString(16).padStart(2, '0')}${f(8).toString(16).padStart(2, '0')}${f(4).toString(16).padStart(2, '0')}`
        }
        return hslToHex2(h, s, l)
      })

      return `## Palette for "${source}"\n\n${colors.map((c, i) => `${i + 1}. \`${c}\` ${'█'.repeat(8)}`).join('\n')}`
    },
  })

  // ── Audio Visualization ───────────────────────────────────────────
  registerTool({
    name: 'audio_visualize',
    description: 'Generate audio visualization videos from audio files using FFmpeg. Creates waveform, spectrum, or vectorscope visualizations.',
    parameters: {
      input: { type: 'string', description: 'Input audio file path', required: true },
      output: { type: 'string', description: 'Output video file path', required: true },
      style: { type: 'string', description: 'Visualization style: waveform, spectrum, vectorscope, showcqt (default: showcqt)' },
      size: { type: 'string', description: 'Video size (default: 1920x1080)' },
      duration: { type: 'string', description: 'Duration in seconds (default: full audio)' },
    },
    tier: 'free',
    timeout: 300_000,
    async execute(args) {
      const input = String(args.input)
      const output = String(args.output)
      const style = String(args.style || 'showcqt')
      const size = String(args.size || '1920x1080')

      const filters: Record<string, string> = {
        waveform: `showwaves=s=${size}:mode=cline:colors=0x6B5B95|0x8E7CC3`,
        spectrum: `showspectrum=s=${size}:mode=combined:color=intensity:scale=cbrt`,
        vectorscope: `avectorscope=s=${size}:mode=lissajous_xy:zoom=5`,
        showcqt: `showcqt=s=${size}:sono_h=0:bar_h=${size.split('x')[1]}:sono_g=4:bar_g=4`,
      }

      const filter = filters[style]
      if (!filter) return `Unknown style "${style}". Available: ${Object.keys(filters).join(', ')}`

      const ffmpegArgs = ['-y', '-i', input, '-filter_complex', filter, '-pix_fmt', 'yuv420p', output]
      if (args.duration) ffmpegArgs.splice(3, 0, '-t', String(args.duration))

      try {
        return await shell('ffmpeg', ffmpegArgs, 300_000)
      } catch (err) {
        return `Audio visualization error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })
}
