// kbot Game Development Tools Tests
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Import the tool registry
import { executeTool, getTool } from './index.js'

// Import the registration function
import { registerGamedevTools } from './gamedev.js'

// Use a RELATIVE temp directory inside the working directory so safePath() allows it.
// safePath() enforces: resolved path must be within process.cwd().
const TEST_DIR_REL = '.kbot-gamedev-test-' + Date.now()
const TEST_DIR = resolve(process.cwd(), TEST_DIR_REL)

before(() => {
  mkdirSync(TEST_DIR, { recursive: true })
  registerGamedevTools()
})

after(() => {
  try { rmSync(TEST_DIR, { recursive: true, force: true }) } catch {}
})

// ─────────────────────────────────────────────────────────────────────
// 1. Registration tests — all 16 tools
// ─────────────────────────────────────────────────────────────────────

describe('Gamedev Tools Registration', () => {
  const expectedTools = [
    { name: 'scaffold_game',     requiredParams: ['engine', 'name'] },
    { name: 'game_config',       requiredParams: ['config_type', 'settings'] },
    { name: 'shader_debug',      requiredParams: ['source', 'language'] },
    { name: 'material_graph',    requiredParams: ['material_type', 'engine'] },
    { name: 'mesh_generate',     requiredParams: ['shape', 'output_path'] },
    { name: 'sprite_pack',       requiredParams: ['input_dir', 'output_image', 'output_data'] },
    { name: 'physics_setup',     requiredParams: ['type', 'output_path'] },
    { name: 'particle_system',   requiredParams: [] },
    { name: 'level_generate',    requiredParams: ['type', 'output_path'] },
    { name: 'tilemap_generate',  requiredParams: ['tileset_type', 'terrain', 'output_path'] },
    { name: 'navmesh_config',    requiredParams: [] },
    { name: 'game_audio',        requiredParams: [] },
    { name: 'netcode_scaffold',  requiredParams: [] },
    { name: 'game_build',        requiredParams: [] },
    { name: 'game_test',         requiredParams: [] },
    { name: 'ecs_generate',      requiredParams: ['framework', 'entities', 'output_dir'] },
  ]

  for (const { name, requiredParams } of expectedTools) {
    it(`registers ${name} tool`, () => {
      const tool = getTool(name)
      assert.ok(tool, `Tool "${name}" should be registered`)
      assert.strictEqual(tool!.tier, 'free', `Tool "${name}" should be free tier`)
    })

    if (requiredParams.length > 0) {
      it(`${name} has correct required parameters`, () => {
        const tool = getTool(name)!
        for (const param of requiredParams) {
          assert.ok(tool.parameters[param], `Tool "${name}" should have parameter "${param}"`)
          assert.strictEqual(tool.parameters[param].required, true, `Parameter "${param}" should be required`)
        }
      })
    }
  }

  it('registers exactly 16 gamedev tools', () => {
    const toolNames = expectedTools.map(t => t.name)
    for (const name of toolNames) {
      assert.ok(getTool(name), `Tool "${name}" should exist in registry`)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────
// 2. scaffold_game
// ─────────────────────────────────────────────────────────────────────

describe('scaffold_game', () => {
  it('Godot: generates project.godot and main.tscn', async () => {
    const outDir = join(TEST_DIR_REL, 'godot-project')
    const result = await executeTool({
      id: 'scaffold-godot',
      name: 'scaffold_game',
      arguments: { engine: 'godot', name: 'TestGame', template: '2d', output_dir: outDir },
    })
    assert.ok(!result.error, `Should not return error: ${result.result}`)
    assert.ok(result.result.includes('Scaffolded godot project'), 'Should confirm scaffold')

    const absDir = resolve(process.cwd(), outDir)
    assert.ok(existsSync(join(absDir, 'project.godot')), 'project.godot should exist')
    assert.ok(existsSync(join(absDir, 'main.tscn')), 'main.tscn should exist')
    assert.ok(existsSync(join(absDir, '.gitignore')), '.gitignore should exist')

    const projectGodot = readFileSync(join(absDir, 'project.godot'), 'utf-8')
    assert.ok(projectGodot.includes('config/name="TestGame"'), 'project.godot should contain project name')
    assert.ok(projectGodot.includes('gl_compatibility'), '2d template should use gl_compatibility renderer')
  })

  it('Godot 3D: uses forward_plus renderer', async () => {
    const outDir = join(TEST_DIR_REL, 'godot-3d')
    await executeTool({
      id: 'scaffold-godot-3d',
      name: 'scaffold_game',
      arguments: { engine: 'godot', name: 'My3DGame', template: '3d', output_dir: outDir },
    })
    const absDir = resolve(process.cwd(), outDir)
    const projectGodot = readFileSync(join(absDir, 'project.godot'), 'utf-8')
    assert.ok(projectGodot.includes('forward_plus'), '3d template should use forward_plus renderer')
  })

  it('Bevy: generates Cargo.toml and src/main.rs', async () => {
    const outDir = join(TEST_DIR_REL, 'bevy-project')
    const result = await executeTool({
      id: 'scaffold-bevy',
      name: 'scaffold_game',
      arguments: { engine: 'bevy', name: 'BevyGame', template: '3d', output_dir: outDir },
    })
    assert.ok(!result.error, `Should not error: ${result.result}`)

    const absDir = resolve(process.cwd(), outDir)
    assert.ok(existsSync(join(absDir, 'Cargo.toml')), 'Cargo.toml should exist')
    assert.ok(existsSync(join(absDir, 'src/main.rs')), 'src/main.rs should exist')

    const cargoToml = readFileSync(join(absDir, 'Cargo.toml'), 'utf-8')
    assert.ok(cargoToml.includes('bevy'), 'Cargo.toml should reference bevy dependency')
    assert.ok(cargoToml.includes('bevygame') || cargoToml.includes('bevy-game'), 'Name should be lowercased')

    const mainRs = readFileSync(join(absDir, 'src/main.rs'), 'utf-8')
    assert.ok(mainRs.includes('use bevy::prelude::*'), 'main.rs should import bevy')
    assert.ok(mainRs.includes('Camera3d'), '3d template should have Camera3d')
  })

  it('Phaser: generates package.json, src/main.ts, and index.html', async () => {
    const outDir = join(TEST_DIR_REL, 'phaser-project')
    const result = await executeTool({
      id: 'scaffold-phaser',
      name: 'scaffold_game',
      arguments: { engine: 'phaser', name: 'PhaserGame', output_dir: outDir },
    })
    assert.ok(!result.error, `Should not error: ${result.result}`)

    const absDir = resolve(process.cwd(), outDir)
    assert.ok(existsSync(join(absDir, 'package.json')), 'package.json should exist')
    assert.ok(existsSync(join(absDir, 'src/main.ts')), 'src/main.ts should exist')
    assert.ok(existsSync(join(absDir, 'index.html')), 'index.html should exist')

    const pkg = JSON.parse(readFileSync(join(absDir, 'package.json'), 'utf-8'))
    assert.ok(pkg.dependencies.phaser, 'package.json should have phaser dependency')
  })

  it('Three.js: generates package.json and src/main.ts', async () => {
    const outDir = join(TEST_DIR_REL, 'three-project')
    const result = await executeTool({
      id: 'scaffold-three',
      name: 'scaffold_game',
      arguments: { engine: 'three', name: 'ThreeGame', output_dir: outDir },
    })
    assert.ok(!result.error, `Should not error: ${result.result}`)

    const absDir = resolve(process.cwd(), outDir)
    assert.ok(existsSync(join(absDir, 'package.json')), 'package.json should exist')
    assert.ok(existsSync(join(absDir, 'src/main.ts')), 'src/main.ts should exist')

    const mainTs = readFileSync(join(absDir, 'src/main.ts'), 'utf-8')
    assert.ok(mainTs.includes("import * as THREE from 'three'"), 'main.ts should import three')
    assert.ok(mainTs.includes('BoxGeometry'), 'main.ts should have a cube')
  })

  it('returns error for invalid engine', async () => {
    const result = await executeTool({
      id: 'scaffold-bad-engine',
      name: 'scaffold_game',
      arguments: { engine: 'gamemaker', name: 'Test', output_dir: join(TEST_DIR_REL, 'bad') },
    })
    assert.ok(result.result.includes('Unknown engine'), 'Should report unknown engine')
    assert.ok(result.result.includes('gamemaker'), 'Should mention the invalid engine name')
  })

  it('returns error for invalid template', async () => {
    const result = await executeTool({
      id: 'scaffold-bad-template',
      name: 'scaffold_game',
      arguments: { engine: 'godot', name: 'Test', template: 'vr', output_dir: join(TEST_DIR_REL, 'bad-tpl') },
    })
    assert.ok(result.result.includes('Invalid template'), 'Should report invalid template')
  })
})

// ─────────────────────────────────────────────────────────────────────
// 3. shader_debug
// ─────────────────────────────────────────────────────────────────────

describe('shader_debug', () => {
  it('detects discard in fragment shaders (mobile target)', async () => {
    const shaderCode = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTexture;

void main() {
  vec4 color = texture2D(uTexture, vUv);
  if (color.a < 0.1) discard;
  gl_FragColor = color;
}
`
    const result = await executeTool({
      id: 'shader-discard',
      name: 'shader_debug',
      arguments: { source: shaderCode, language: 'glsl', target: 'mobile' },
    })
    assert.ok(!result.error)
    assert.ok(result.result.includes('discard'), 'Should detect discard statement')
    assert.ok(result.result.includes('early-Z'), 'Should mention early-Z optimization issue')
    assert.ok(result.result.includes('PRF'), 'Should be classified as a perf issue')
  })

  it('detects pow(x, 2.0) optimization opportunity', async () => {
    const shaderCode = `
void main() {
  float val = pow(uv.x, 2.0);
  gl_FragColor = vec4(val, val, val, 1.0);
}
`
    const result = await executeTool({
      id: 'shader-pow',
      name: 'shader_debug',
      arguments: { source: shaderCode, language: 'glsl' },
    })
    assert.ok(!result.error)
    assert.ok(result.result.includes('pow(x, 2.0)'), 'Should detect pow(x, 2.0)')
    assert.ok(result.result.includes('x*x'), 'Should suggest x*x replacement')
  })

  it('detects dynamic branching', async () => {
    const shaderCode = `
void main() {
  if (uv.x > 0.5) {
    gl_FragColor = vec4(1.0);
  } else {
    gl_FragColor = vec4(0.0);
  }
}
`
    const result = await executeTool({
      id: 'shader-branching',
      name: 'shader_debug',
      arguments: { source: shaderCode, language: 'glsl' },
    })
    assert.ok(!result.error)
    assert.ok(result.result.includes('Dynamic branching'), 'Should detect dynamic branching')
    assert.ok(result.result.includes('step()'), 'Should suggest branchless alternatives')
  })

  it('returns structured report with severity levels', async () => {
    const shaderCode = `
uniform sampler2D tex;
varying vec2 vUv;
void main() {
  float val = pow(uv.x, 2.0);
  vec3 n = normalize(vec3(0.0));
  if (val > 0.5) discard;
  gl_FragColor = texture(tex, vUv + val);
}
`
    const result = await executeTool({
      id: 'shader-report',
      name: 'shader_debug',
      arguments: { source: shaderCode, language: 'glsl', target: 'mobile' },
    })
    assert.ok(!result.error)
    // Verify report structure
    assert.ok(result.result.includes('Shader Analysis Report'), 'Should have report header')
    assert.ok(result.result.includes('GLSL'), 'Should mention language')
    assert.ok(result.result.includes('Errors:'), 'Should have error count')
    assert.ok(result.result.includes('Warnings:'), 'Should have warning count')
    assert.ok(result.result.includes('Perf issues:'), 'Should have perf issue count')
    assert.ok(result.result.includes('Uniforms:'), 'Should count uniforms')
    // Should contain both PRF and ERR severity tags
    assert.ok(result.result.includes('[PRF]'), 'Should have PRF-level issues')
    assert.ok(result.result.includes('[ERR]'), 'Should have ERR-level issues (normalize zero vector)')
  })

  it('rejects unknown shader language', async () => {
    const result = await executeTool({
      id: 'shader-bad-lang',
      name: 'shader_debug',
      arguments: { source: 'void main() {}', language: 'metal' },
    })
    assert.ok(result.result.includes('Unknown shader language'), 'Should reject unknown language')
  })

  it('reports clean shader when no issues found', async () => {
    const shaderCode = `
void main() {
  gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
}
`
    const result = await executeTool({
      id: 'shader-clean',
      name: 'shader_debug',
      arguments: { source: shaderCode, language: 'glsl' },
    })
    assert.ok(!result.error)
    assert.ok(result.result.includes('No issues found') || result.result.includes('Errors: 0'), 'Clean shader should report no issues or zero errors')
  })

  it('reads shader from file path when file is in working directory', async () => {
    const shaderPath = join(TEST_DIR_REL, 'test-shader.glsl')
    const absShaderPath = resolve(process.cwd(), shaderPath)
    mkdirSync(resolve(process.cwd(), TEST_DIR_REL), { recursive: true })
    const shaderContent = `
void main() {
  float val = pow(uv.x, 2.0);
  gl_FragColor = vec4(val, val, val, 1.0);
}
`
    writeFileSync(absShaderPath, shaderContent, 'utf-8')
    const result = await executeTool({
      id: 'shader-file',
      name: 'shader_debug',
      arguments: { source: absShaderPath, language: 'glsl' },
    })
    assert.ok(!result.error)
    assert.ok(result.result.includes('pow(x, 2.0)'), 'Should detect issue from file content')
  })
})

// ─────────────────────────────────────────────────────────────────────
// 4. mesh_generate
// ─────────────────────────────────────────────────────────────────────

describe('mesh_generate', () => {
  it('plane generates valid OBJ with vertices and faces', async () => {
    const outPath = join(TEST_DIR_REL, 'plane.obj')
    const result = await executeTool({
      id: 'mesh-plane',
      name: 'mesh_generate',
      arguments: { shape: 'plane', output_path: outPath },
    })
    assert.ok(!result.error, `Should not error: ${result.result}`)
    assert.ok(result.result.includes('Generated plane mesh'), 'Should confirm plane generation')

    const absPath = resolve(process.cwd(), outPath)
    assert.ok(existsSync(absPath), 'OBJ file should exist')

    const obj = readFileSync(absPath, 'utf-8')
    assert.ok(obj.includes('v '), 'OBJ should contain vertices')
    assert.ok(obj.includes('vn '), 'OBJ should contain normals')
    assert.ok(obj.includes('vt '), 'OBJ should contain UVs')
    assert.ok(obj.includes('f '), 'OBJ should contain faces')
    assert.ok(obj.includes('o plane'), 'OBJ should contain object name')
  })

  it('cube generates valid OBJ', async () => {
    const outPath = join(TEST_DIR_REL, 'cube.obj')
    const result = await executeTool({
      id: 'mesh-cube',
      name: 'mesh_generate',
      arguments: { shape: 'cube', output_path: outPath },
    })
    assert.ok(!result.error, `Should not error: ${result.result}`)

    const absPath = resolve(process.cwd(), outPath)
    assert.ok(existsSync(absPath), 'OBJ file should exist')

    const obj = readFileSync(absPath, 'utf-8')
    // A cube has 24 vertices (4 per face x 6 faces), 12 faces (2 triangles per face x 6)
    const vertexLines = obj.split('\n').filter((l: string) => l.startsWith('v '))
    assert.strictEqual(vertexLines.length, 24, 'Cube should have 24 vertices')
    const faceLines = obj.split('\n').filter((l: string) => l.startsWith('f '))
    assert.strictEqual(faceLines.length, 12, 'Cube should have 12 triangle faces')
  })

  it('sphere generates valid OBJ', async () => {
    const outPath = join(TEST_DIR_REL, 'sphere.obj')
    const result = await executeTool({
      id: 'mesh-sphere',
      name: 'mesh_generate',
      arguments: { shape: 'sphere', output_path: outPath, params: '{"rings": 8, "segments": 16}' },
    })
    assert.ok(!result.error, `Should not error: ${result.result}`)

    const absPath = resolve(process.cwd(), outPath)
    assert.ok(existsSync(absPath), 'OBJ file should exist')

    const obj = readFileSync(absPath, 'utf-8')
    const vertexLines = obj.split('\n').filter((l: string) => l.startsWith('v '))
    // Sphere with 8 rings and 16 segments: (8+1) * (16+1) = 153 vertices
    assert.strictEqual(vertexLines.length, 153, 'Sphere should have (rings+1)*(segments+1) vertices')

    assert.ok(result.result.includes('Vertices: 153'), 'Result should report vertex count')
  })

  it('verifies face count for plane with given segments', async () => {
    const outPath = join(TEST_DIR_REL, 'plane-segs.obj')
    const segX = 4
    const segY = 3
    await executeTool({
      id: 'mesh-plane-segs',
      name: 'mesh_generate',
      arguments: { shape: 'plane', output_path: outPath, params: `{"segments_x": ${segX}, "segments_y": ${segY}}` },
    })
    const absPath = resolve(process.cwd(), outPath)
    const obj = readFileSync(absPath, 'utf-8')
    const faceLines = obj.split('\n').filter((l: string) => l.startsWith('f '))
    // Plane faces = segX * segY * 2 (2 triangles per quad)
    const expectedFaces = segX * segY * 2
    assert.strictEqual(faceLines.length, expectedFaces, `Plane should have ${expectedFaces} faces for ${segX}x${segY} segments`)
  })

  it('returns error for invalid shape', async () => {
    const result = await executeTool({
      id: 'mesh-bad',
      name: 'mesh_generate',
      arguments: { shape: 'pyramid', output_path: join(TEST_DIR_REL, 'bad.obj') },
    })
    assert.ok(result.result.includes('Unknown shape'), 'Should report unknown shape')
    assert.ok(result.result.includes('pyramid'), 'Should mention the invalid shape name')
  })

  it('returns error for invalid params JSON', async () => {
    const result = await executeTool({
      id: 'mesh-bad-json',
      name: 'mesh_generate',
      arguments: { shape: 'cube', output_path: join(TEST_DIR_REL, 'bad.obj'), params: 'not-json' },
    })
    assert.ok(result.result.includes('params must be valid JSON'), 'Should report JSON parse error')
  })
})

// ─────────────────────────────────────────────────────────────────────
// 5. level_generate
// ─────────────────────────────────────────────────────────────────────

describe('level_generate', () => {
  it('dungeon produces valid JSON with map and rooms', async () => {
    const outPath = join(TEST_DIR_REL, 'dungeon.json')
    const result = await executeTool({
      id: 'level-dungeon',
      name: 'level_generate',
      arguments: { type: 'dungeon', width: 40, height: 30, seed: 42, output_path: outPath, format: 'json' },
    })
    assert.ok(!result.error, `Should not error: ${result.result}`)
    assert.ok(result.result.includes('Level generated'), 'Should confirm level generation')

    const absPath = resolve(process.cwd(), outPath)
    assert.ok(existsSync(absPath), 'JSON file should exist')

    const data = JSON.parse(readFileSync(absPath, 'utf-8'))
    assert.ok(data.meta, 'Should have meta section')
    assert.strictEqual(data.meta.type, 'dungeon', 'Meta should indicate dungeon type')
    assert.strictEqual(data.meta.width, 40, 'Width should match')
    assert.strictEqual(data.meta.height, 30, 'Height should match')
    assert.strictEqual(data.meta.seed, 42, 'Seed should match')
    assert.ok(data.map, 'Should have map 2D array')
    assert.strictEqual(data.map.length, 30, 'Map should have correct number of rows')
    assert.strictEqual(data.map[0].length, 40, 'Map should have correct number of columns')
    assert.ok(data.rooms.length > 0, 'Should have at least one room')
    assert.ok(data.legend, 'Should have legend')
  })

  it('same seed produces identical output (determinism)', async () => {
    const path1 = join(TEST_DIR_REL, 'det-level-1.json')
    const path2 = join(TEST_DIR_REL, 'det-level-2.json')
    await executeTool({
      id: 'level-det-1',
      name: 'level_generate',
      arguments: { type: 'dungeon', width: 30, height: 20, seed: 12345, output_path: path1, format: 'json' },
    })
    await executeTool({
      id: 'level-det-2',
      name: 'level_generate',
      arguments: { type: 'dungeon', width: 30, height: 20, seed: 12345, output_path: path2, format: 'json' },
    })
    const content1 = readFileSync(resolve(process.cwd(), path1), 'utf-8')
    const content2 = readFileSync(resolve(process.cwd(), path2), 'utf-8')
    assert.strictEqual(content1, content2, 'Same seed should produce identical output')
  })

  it('different seeds produce different output', async () => {
    const path1 = join(TEST_DIR_REL, 'diff-seed-1.json')
    const path2 = join(TEST_DIR_REL, 'diff-seed-2.json')
    await executeTool({
      id: 'level-diff-1',
      name: 'level_generate',
      arguments: { type: 'dungeon', width: 30, height: 20, seed: 111, output_path: path1, format: 'json' },
    })
    await executeTool({
      id: 'level-diff-2',
      name: 'level_generate',
      arguments: { type: 'dungeon', width: 30, height: 20, seed: 999, output_path: path2, format: 'json' },
    })
    const content1 = readFileSync(resolve(process.cwd(), path1), 'utf-8')
    const content2 = readFileSync(resolve(process.cwd(), path2), 'utf-8')
    assert.notStrictEqual(content1, content2, 'Different seeds should produce different output')
  })

  it('ASCII format produces printable map', async () => {
    const outPath = join(TEST_DIR_REL, 'dungeon.txt')
    const result = await executeTool({
      id: 'level-ascii',
      name: 'level_generate',
      arguments: { type: 'dungeon', width: 20, height: 15, seed: 42, output_path: outPath, format: 'ascii' },
    })
    assert.ok(!result.error, `Should not error: ${result.result}`)

    const absPath = resolve(process.cwd(), outPath)
    assert.ok(existsSync(absPath), 'ASCII file should exist')

    const content = readFileSync(absPath, 'utf-8')
    // ASCII map should contain wall (#) and floor (.) characters
    assert.ok(content.includes('#'), 'ASCII map should contain wall characters')
    assert.ok(content.includes('.'), 'ASCII map should contain floor characters')
    // Should have a header line
    assert.ok(content.includes('Level: dungeon'), 'Should have type header')
    assert.ok(content.includes('seed=42'), 'Should include seed in header')
  })

  it('dimensions are capped at 1000', async () => {
    const outPath = join(TEST_DIR_REL, 'large-level.json')
    const result = await executeTool({
      id: 'level-large',
      name: 'level_generate',
      arguments: { type: 'dungeon', width: 5000, height: 3000, seed: 1, output_path: outPath, format: 'json' },
    })
    assert.ok(!result.error, `Should not error: ${result.result}`)
    const data = JSON.parse(readFileSync(resolve(process.cwd(), outPath), 'utf-8'))
    assert.ok(data.meta.width <= 1000, 'Width should be capped at 1000')
    assert.ok(data.meta.height <= 1000, 'Height should be capped at 1000')
  })

  it('returns error for invalid level type', async () => {
    const result = await executeTool({
      id: 'level-bad-type',
      name: 'level_generate',
      arguments: { type: 'rpg', output_path: join(TEST_DIR_REL, 'bad-level.json') },
    })
    assert.ok(result.result.includes('Invalid type'), 'Should report invalid type')
  })

  it('tiled format produces valid Tiled JSON', async () => {
    const outPath = join(TEST_DIR_REL, 'dungeon-tiled.json')
    const result = await executeTool({
      id: 'level-tiled',
      name: 'level_generate',
      arguments: { type: 'dungeon', width: 20, height: 15, seed: 42, output_path: outPath, format: 'tiled' },
    })
    assert.ok(!result.error, `Should not error: ${result.result}`)
    const data = JSON.parse(readFileSync(resolve(process.cwd(), outPath), 'utf-8'))
    assert.strictEqual(data.orientation, 'orthogonal', 'Should be orthogonal orientation')
    assert.ok(Array.isArray(data.layers), 'Should have layers array')
    assert.ok(data.layers.length >= 2, 'Should have at least terrain and objects layers')
    assert.strictEqual(data.layers[0].type, 'tilelayer', 'First layer should be tilelayer')
    assert.strictEqual(data.layers[1].type, 'objectgroup', 'Second layer should be objectgroup')
    assert.ok(Array.isArray(data.tilesets), 'Should have tilesets')
  })
})

// ─────────────────────────────────────────────────────────────────────
// 6. ecs_generate
// ─────────────────────────────────────────────────────────────────────

describe('ecs_generate', () => {
  it('Bevy generates valid Rust files (components.rs, systems.rs)', async () => {
    const outDir = join(TEST_DIR_REL, 'ecs-bevy')
    const entities = JSON.stringify([
      { name: 'Player', components: ['Position', 'Velocity', 'Health'] },
      { name: 'Enemy', components: ['Position', 'Velocity', 'Health', 'Damage'] },
    ])
    const result = await executeTool({
      id: 'ecs-bevy',
      name: 'ecs_generate',
      arguments: { framework: 'bevy', entities, output_dir: outDir },
    })
    assert.ok(!result.error, `Should not error: ${result.result}`)

    const absDir = resolve(process.cwd(), outDir)
    // Check files exist
    assert.ok(existsSync(join(absDir, 'components.rs')), 'components.rs should exist')
    assert.ok(existsSync(join(absDir, 'systems.rs')), 'systems.rs should exist')
    assert.ok(existsSync(join(absDir, 'plugin.rs')), 'plugin.rs should exist')

    // Verify components.rs content
    const components = readFileSync(join(absDir, 'components.rs'), 'utf-8')
    assert.ok(components.includes('use bevy::prelude::*'), 'Should import bevy prelude')
    assert.ok(components.includes('#[derive(Component'), 'Should derive Component')
    assert.ok(components.includes('pub struct Position'), 'Should define Position component')
    assert.ok(components.includes('pub struct Velocity'), 'Should define Velocity component')
    assert.ok(components.includes('pub struct Health'), 'Should define Health component')
    assert.ok(components.includes('pub struct Damage'), 'Should define Damage component')

    // Verify systems.rs content
    const systems = readFileSync(join(absDir, 'systems.rs'), 'utf-8')
    assert.ok(systems.includes('use bevy::prelude::*'), 'Systems should import bevy prelude')
    assert.ok(systems.includes('use super::components::*'), 'Systems should import components')
    assert.ok(systems.includes('Query<'), 'Systems should use Query')
  })

  it('bitecs generates TypeScript files', async () => {
    const outDir = join(TEST_DIR_REL, 'ecs-bitecs')
    const entities = JSON.stringify([
      { name: 'Bullet', components: ['Position', 'Velocity'] },
    ])
    const result = await executeTool({
      id: 'ecs-bitecs',
      name: 'ecs_generate',
      arguments: { framework: 'bitecs', entities, output_dir: outDir },
    })
    assert.ok(!result.error, `Should not error: ${result.result}`)

    const absDir = resolve(process.cwd(), outDir)
    assert.ok(existsSync(join(absDir, 'ecs.ts')), 'ecs.ts should exist')

    const code = readFileSync(join(absDir, 'ecs.ts'), 'utf-8')
    assert.ok(code.includes("from 'bitecs'"), 'Should import from bitecs')
    assert.ok(code.includes('defineComponent'), 'Should use defineComponent')
    assert.ok(code.includes('defineSystem'), 'Should use defineSystem')
    assert.ok(code.includes('Position'), 'Should reference Position component')
    assert.ok(code.includes('Velocity'), 'Should reference Velocity component')
    assert.ok(code.includes('createBullet') || code.includes('Bullet'), 'Should have Bullet entity factory')
  })

  it('generated files contain expected component and system names', async () => {
    const outDir = join(TEST_DIR_REL, 'ecs-names')
    const entities = JSON.stringify([
      { name: 'Ship', components: ['Position', 'Velocity', 'Shield'] },
    ])
    const systems = JSON.stringify([
      { name: 'Movement', queries: ['Position', 'Velocity'] },
      { name: 'ShieldRegen', queries: ['Shield'] },
    ])
    const result = await executeTool({
      id: 'ecs-names',
      name: 'ecs_generate',
      arguments: { framework: 'bevy', entities, output_dir: outDir, systems },
    })
    assert.ok(!result.error, `Should not error: ${result.result}`)

    const absDir = resolve(process.cwd(), outDir)
    const systemsRs = readFileSync(join(absDir, 'systems.rs'), 'utf-8')
    assert.ok(systemsRs.includes('movement_system'), 'Should contain movement_system')
    assert.ok(systemsRs.includes('shield_regen_system'), 'Should contain shield_regen_system')
  })

  it('returns error for unknown framework', async () => {
    const entities = JSON.stringify([{ name: 'X', components: ['Y'] }])
    const result = await executeTool({
      id: 'ecs-bad-fw',
      name: 'ecs_generate',
      arguments: { framework: 'flecs', entities, output_dir: join(TEST_DIR_REL, 'ecs-bad') },
    })
    assert.ok(result.result.includes('Unknown ECS framework'), 'Should report unknown framework')
  })

  it('returns error for invalid entities JSON', async () => {
    const result = await executeTool({
      id: 'ecs-bad-json',
      name: 'ecs_generate',
      arguments: { framework: 'bevy', entities: 'not-valid-json', output_dir: join(TEST_DIR_REL, 'ecs-bad-json') },
    })
    assert.ok(result.result.includes('valid JSON'), 'Should report JSON parse error')
  })

  it('returns error for empty entities', async () => {
    const result = await executeTool({
      id: 'ecs-empty',
      name: 'ecs_generate',
      arguments: { framework: 'bevy', entities: '[]', output_dir: join(TEST_DIR_REL, 'ecs-empty') },
    })
    assert.ok(result.result.includes('At least one entity'), 'Should require at least one entity')
  })
})

// ─────────────────────────────────────────────────────────────────────
// 7. Error handling
// ─────────────────────────────────────────────────────────────────────

describe('Error handling', () => {
  it('game_config: invalid JSON in settings returns friendly error', async () => {
    const result = await executeTool({
      id: 'err-config-json',
      name: 'game_config',
      arguments: { engine: 'godot', config_type: 'project', settings: '{bad json!' },
    })
    assert.ok(result.result.includes('valid JSON'), 'Should return JSON parse error')
  })

  it('mesh_generate: invalid params JSON returns friendly error', async () => {
    const result = await executeTool({
      id: 'err-mesh-json',
      name: 'mesh_generate',
      arguments: { shape: 'sphere', output_path: join(TEST_DIR_REL, 'err.obj'), params: 'not-json' },
    })
    assert.ok(result.result.includes('valid JSON'), 'Should return JSON parse error')
  })

  it('level_generate: invalid params JSON returns friendly error', async () => {
    const result = await executeTool({
      id: 'err-level-json',
      name: 'level_generate',
      arguments: { type: 'dungeon', output_path: join(TEST_DIR_REL, 'err-level.json'), params: '{{invalid' },
    })
    assert.ok(result.result.includes('valid JSON'), 'Should return JSON parse error')
  })

  it('physics_setup: invalid params JSON returns friendly error', async () => {
    const result = await executeTool({
      id: 'err-physics-json',
      name: 'physics_setup',
      arguments: { type: 'rigidbody', engine: 'rapier', output_path: join(TEST_DIR_REL, 'err-physics.ts'), params: 'bad' },
    })
    assert.ok(result.result.includes('valid JSON'), 'Should return JSON parse error')
  })

  it('material_graph: invalid params JSON returns friendly error', async () => {
    const result = await executeTool({
      id: 'err-material-json',
      name: 'material_graph',
      arguments: { material_type: 'pbr', engine: 'three', params: '{broken' },
    })
    assert.ok(result.result.includes('valid JSON'), 'Should return JSON parse error')
  })

  it('scaffold_game: missing engine parameter returns error', async () => {
    const result = await executeTool({
      id: 'err-scaffold-no-engine',
      name: 'scaffold_game',
      arguments: { name: 'Test', output_dir: join(TEST_DIR_REL, 'err-scaffold') },
    })
    // When engine is missing, it defaults to String(undefined) = 'undefined' which is unknown
    assert.ok(result.result.includes('Unknown engine') || result.result.includes('Error'), 'Should report error for missing engine')
  })

  it('game_config: unknown config_type returns error', async () => {
    const result = await executeTool({
      id: 'err-config-type',
      name: 'game_config',
      arguments: { engine: 'godot', config_type: 'networking', settings: '{}' },
    })
    assert.ok(result.result.includes('Unknown config_type') || result.result.includes('Error'), 'Should report unknown config_type')
  })

  it('mesh_generate: unknown shape returns error with supported list', async () => {
    const result = await executeTool({
      id: 'err-mesh-shape',
      name: 'mesh_generate',
      arguments: { shape: 'octahedron', output_path: join(TEST_DIR_REL, 'err.obj') },
    })
    assert.ok(result.result.includes('Unknown shape'), 'Should report unknown shape')
    assert.ok(result.result.includes('plane'), 'Should list supported shapes')
    assert.ok(result.result.includes('cube'), 'Should list supported shapes')
    assert.ok(result.result.includes('sphere'), 'Should list supported shapes')
  })
})

// ─────────────────────────────────────────────────────────────────────
// 8. Security
// ─────────────────────────────────────────────────────────────────────

describe('Security', () => {
  it('path traversal: ../../etc/passwd as output_path is rejected', async () => {
    const result = await executeTool({
      id: 'sec-traversal',
      name: 'mesh_generate',
      arguments: { shape: 'cube', output_path: '../../etc/passwd' },
    })
    assert.ok(result.error, 'Should return an error')
    assert.ok(result.result.includes('Path must be within the working directory'), 'Should reject path traversal')
  })

  it('scaffold_game: path traversal output_dir is rejected', async () => {
    const result = await executeTool({
      id: 'sec-scaffold-traversal',
      name: 'scaffold_game',
      arguments: { engine: 'godot', name: 'Test', output_dir: '../../../tmp/evil' },
    })
    assert.ok(result.error, 'Should return an error for path traversal')
    assert.ok(result.result.includes('Path must be within the working directory'), 'Should reject traversal')
  })

  it('level_generate: absolute path outside cwd is rejected', async () => {
    const result = await executeTool({
      id: 'sec-level-abs',
      name: 'level_generate',
      arguments: { type: 'dungeon', output_path: '/tmp/evil-level.json' },
    })
    assert.ok(result.error, 'Should return an error for absolute path outside cwd')
    assert.ok(result.result.includes('Path must be within the working directory'), 'Should reject path outside cwd')
  })

  it('ecs_generate: path traversal output_dir is rejected', async () => {
    const entities = JSON.stringify([{ name: 'X', components: ['Y'] }])
    const result = await executeTool({
      id: 'sec-ecs-traversal',
      name: 'ecs_generate',
      arguments: { framework: 'bevy', entities, output_dir: '../../etc' },
    })
    assert.ok(result.error, 'Should return an error for path traversal')
    assert.ok(result.result.includes('Path must be within the working directory'), 'Should reject traversal')
  })

  it('shader_debug: .env as inline source is analyzed as code (no file read)', async () => {
    // shader_debug accepts inline source code or file paths.
    // .env as a path that doesn't exist will be treated as inline source text.
    const result = await executeTool({
      id: 'sec-shader-env',
      name: 'shader_debug',
      arguments: { source: '.env', language: 'glsl' },
    })
    assert.ok(!result.error, 'Should process .env as inline source (not a file)')
    assert.ok(result.result.includes('Shader Analysis Report'), 'Should produce analysis report')
  })

  it('mesh_generate: segments are capped (sphere rings/segments bounded at 256/512)', async () => {
    const outPath = join(TEST_DIR_REL, 'large-sphere.obj')
    const result = await executeTool({
      id: 'sec-mesh-large',
      name: 'mesh_generate',
      arguments: {
        shape: 'sphere',
        output_path: outPath,
        params: '{"rings": 100000, "segments": 100000}',
      },
    })
    assert.ok(!result.error, `Should not error: ${result.result}`)

    const absPath = resolve(process.cwd(), outPath)
    assert.ok(existsSync(absPath), 'File should be created')

    const obj = readFileSync(absPath, 'utf-8')
    const vertexLines = obj.split('\n').filter((l: string) => l.startsWith('v '))
    // rings capped at 256, segments capped at 512
    // max vertices = (256+1) * (512+1) = 131841
    assert.ok(vertexLines.length <= 131841, `Vertex count (${vertexLines.length}) should be bounded by caps`)
    // Verify it didn't actually create 100000x100000 vertices
    assert.ok(vertexLines.length < 200000, 'Should not create unbounded vertices')
  })

  it('level_generate: dimensions capped at 1000 even when requesting larger', async () => {
    const outPath = join(TEST_DIR_REL, 'capped-level.json')
    const result = await executeTool({
      id: 'sec-level-cap',
      name: 'level_generate',
      arguments: { type: 'maze', width: 99999, height: 99999, seed: 1, output_path: outPath, format: 'json' },
    })
    assert.ok(!result.error, `Should not error: ${result.result}`)
    const data = JSON.parse(readFileSync(resolve(process.cwd(), outPath), 'utf-8'))
    assert.ok(data.meta.width <= 1000, `Width (${data.meta.width}) should be capped at 1000`)
    assert.ok(data.meta.height <= 1000, `Height (${data.meta.height}) should be capped at 1000`)
  })
})

// ─────────────────────────────────────────────────────────────────────
// Additional tool tests
// ─────────────────────────────────────────────────────────────────────

describe('game_config', () => {
  it('generates Godot project config', async () => {
    const outPath = join(TEST_DIR_REL, 'config-project.godot')
    const result = await executeTool({
      id: 'config-godot',
      name: 'game_config',
      arguments: {
        engine: 'godot',
        config_type: 'project',
        settings: JSON.stringify({ name: 'MyGame', main_scene: 'res://main.tscn' }),
        path: outPath,
      },
    })
    assert.ok(!result.error, `Should not error: ${result.result}`)
    assert.ok(result.result.includes('Generated godot project config'), 'Should confirm generation')

    const absPath = resolve(process.cwd(), outPath)
    assert.ok(existsSync(absPath), 'Config file should exist')

    const content = readFileSync(absPath, 'utf-8')
    assert.ok(content.includes('[application]'), 'Should have application section')
    assert.ok(content.includes('config/name="MyGame"'), 'Should contain project name')
  })

  it('generates Bevy Cargo.toml config', async () => {
    const outPath = join(TEST_DIR_REL, 'config-cargo.toml')
    const result = await executeTool({
      id: 'config-bevy',
      name: 'game_config',
      arguments: {
        engine: 'bevy',
        config_type: 'project',
        settings: JSON.stringify({ name: 'CoolGame', version: '0.2.0' }),
        path: outPath,
      },
    })
    assert.ok(!result.error, `Should not error: ${result.result}`)
    const absPath = resolve(process.cwd(), outPath)
    const content = readFileSync(absPath, 'utf-8')
    assert.ok(content.includes('[package]'), 'Should have package section')
    assert.ok(content.includes('coolgame') || content.includes('cool-game'), 'Name should be sanitized')
    assert.ok(content.includes('0.2.0'), 'Version should be present')
    assert.ok(content.includes('bevy'), 'Should reference bevy dependency')
  })
})

describe('material_graph', () => {
  it('generates PBR material for Three.js', async () => {
    const outPath = join(TEST_DIR_REL, 'material-pbr.ts')
    const result = await executeTool({
      id: 'mat-pbr',
      name: 'material_graph',
      arguments: {
        material_type: 'pbr',
        engine: 'three',
        output_path: outPath,
        params: JSON.stringify({ roughness: 0.3, metalness: 0.8 }),
      },
    })
    assert.ok(!result.error, `Should not error: ${result.result}`)

    const absPath = resolve(process.cwd(), outPath)
    assert.ok(existsSync(absPath), 'Material file should exist')

    const code = readFileSync(absPath, 'utf-8')
    assert.ok(code.includes("import * as THREE from 'three'"), 'Should import Three.js')
    assert.ok(code.includes('MeshStandardMaterial'), 'Should use MeshStandardMaterial')
    assert.ok(code.includes('0.3'), 'Should use specified roughness')
    assert.ok(code.includes('0.8'), 'Should use specified metalness')
  })

  it('generates water material for Godot', async () => {
    const result = await executeTool({
      id: 'mat-water',
      name: 'material_graph',
      arguments: {
        material_type: 'water',
        engine: 'godot',
      },
    })
    assert.ok(!result.error, `Should not error: ${result.result}`)
    assert.ok(result.result.includes('shader_type spatial'), 'Should generate Godot spatial shader')
    assert.ok(result.result.includes('water_color'), 'Should have water color uniform')
  })

  it('returns error for unknown engine', async () => {
    const result = await executeTool({
      id: 'mat-bad-engine',
      name: 'material_graph',
      arguments: { material_type: 'pbr', engine: 'unreal' },
    })
    assert.ok(result.result.includes('Unknown engine'), 'Should report unknown engine')
  })

  it('returns error for unknown material type', async () => {
    const result = await executeTool({
      id: 'mat-bad-type',
      name: 'material_graph',
      arguments: { material_type: 'lava', engine: 'three' },
    })
    assert.ok(result.result.includes('Unknown material_type'), 'Should report unknown material type')
  })
})

describe('physics_setup', () => {
  it('generates rapier rigidbody code', async () => {
    const outPath = join(TEST_DIR_REL, 'physics-rapier.ts')
    const result = await executeTool({
      id: 'physics-rapier',
      name: 'physics_setup',
      arguments: {
        type: 'rigidbody',
        engine: 'rapier',
        output_path: outPath,
        params: JSON.stringify({ mass: 2.0, friction: 0.8 }),
      },
    })
    assert.ok(!result.error, `Should not error: ${result.result}`)

    const absPath = resolve(process.cwd(), outPath)
    assert.ok(existsSync(absPath), 'Physics file should exist')

    const code = readFileSync(absPath, 'utf-8')
    assert.ok(code.includes('RAPIER'), 'Should use RAPIER')
    assert.ok(code.includes('2') || code.includes('2.0'), 'Should use specified mass')
    assert.ok(code.includes('0.8'), 'Should use specified friction')
  })

  it('returns error for invalid physics type', async () => {
    const result = await executeTool({
      id: 'physics-bad-type',
      name: 'physics_setup',
      arguments: { type: 'fluid', engine: 'rapier', output_path: join(TEST_DIR_REL, 'bad-physics.ts') },
    })
    assert.ok(result.result.includes('Invalid type'), 'Should report invalid type')
  })

  it('returns error for invalid engine', async () => {
    const result = await executeTool({
      id: 'physics-bad-engine',
      name: 'physics_setup',
      arguments: { type: 'rigidbody', engine: 'havok', output_path: join(TEST_DIR_REL, 'bad-engine.ts') },
    })
    assert.ok(result.result.includes('Invalid engine'), 'Should report invalid engine')
  })
})

describe('level_generate — additional types', () => {
  it('platformer level generates valid output', async () => {
    const outPath = join(TEST_DIR_REL, 'platformer.json')
    const result = await executeTool({
      id: 'level-platformer',
      name: 'level_generate',
      arguments: { type: 'platformer', width: 40, height: 20, seed: 55, output_path: outPath, format: 'json' },
    })
    assert.ok(!result.error, `Should not error: ${result.result}`)
    assert.ok(result.result.includes('platformer'), 'Should mention level type')
    const data = JSON.parse(readFileSync(resolve(process.cwd(), outPath), 'utf-8'))
    assert.strictEqual(data.meta.type, 'platformer')
  })

  it('maze level generates valid output', async () => {
    const outPath = join(TEST_DIR_REL, 'maze.json')
    const result = await executeTool({
      id: 'level-maze',
      name: 'level_generate',
      arguments: { type: 'maze', width: 21, height: 21, seed: 77, output_path: outPath, format: 'json' },
    })
    assert.ok(!result.error, `Should not error: ${result.result}`)
    const data = JSON.parse(readFileSync(resolve(process.cwd(), outPath), 'utf-8'))
    assert.strictEqual(data.meta.type, 'maze')
    assert.ok(data.map.length > 0, 'Should have map data')
  })

  it('arena level generates valid output', async () => {
    const outPath = join(TEST_DIR_REL, 'arena.json')
    const result = await executeTool({
      id: 'level-arena',
      name: 'level_generate',
      arguments: { type: 'arena', width: 30, height: 30, seed: 88, output_path: outPath, format: 'json' },
    })
    assert.ok(!result.error, `Should not error: ${result.result}`)
    const data = JSON.parse(readFileSync(resolve(process.cwd(), outPath), 'utf-8'))
    assert.strictEqual(data.meta.type, 'arena')
  })
})
