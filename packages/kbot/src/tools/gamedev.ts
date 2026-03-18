// kbot Game Development Tools
// Scaffolding, config, shaders, materials, and procedural mesh generation
// for Godot, Unity, Unreal, Bevy, Phaser, Three.js, PlayCanvas, and Defold.

import { registerTool } from './index.js'
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join, basename, extname, resolve, relative, isAbsolute } from 'node:path'
import { execFile } from 'node:child_process'

// ── Helpers ──────────────────────────────────────────────────────────

/** Create directory tree if it doesn't exist */
function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

/** Run a shell command and return stdout */
function shell(cmd: string, args: string[], timeout = 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout, maxBuffer: 2 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message))
      else resolve(stdout || stderr)
    })
  })
}

/** Detect game engine from project directory by looking for telltale files */
function detectEngine(dir: string): string | null {
  const markers: Record<string, string[]> = {
    godot: ['project.godot', 'export_presets.cfg'],
    unity: ['ProjectSettings/ProjectSettings.asset', 'Assets'],
    unreal: ['.uproject'],
    bevy: ['Cargo.toml'],
    phaser: ['package.json'],
    three: ['package.json'],
    playcanvas: ['playcanvas.json', 'package.json'],
    defold: ['game.project'],
  }
  for (const [engine, files] of Object.entries(markers)) {
    for (const f of files) {
      if (existsSync(join(dir, f))) {
        // Extra check for bevy: Cargo.toml must mention bevy
        if (engine === 'bevy') {
          try {
            const cargo = readFileSync(join(dir, 'Cargo.toml'), 'utf-8')
            if (!cargo.includes('bevy')) continue
          } catch { continue }
        }
        // Extra check for phaser/three/playcanvas: look in package.json
        if (['phaser', 'three', 'playcanvas'].includes(engine) && f === 'package.json') {
          try {
            const pkg = readFileSync(join(dir, 'package.json'), 'utf-8')
            if (!pkg.includes(engine)) continue
          } catch { continue }
        }
        return engine
      }
    }
  }
  return null
}

/** Seeded PRNG — xorshift32 for deterministic procedural generation */
function seededRng(seed: number): () => number {
  let s = seed | 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

function safePath(userPath: string): string {
  const resolved = resolve(process.cwd(), userPath)
  const rel = relative(process.cwd(), resolved)
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`Path must be within the working directory: ${userPath}`)
  }
  return resolved
}

// ── Registration ─────────────────────────────────────────────────────

export function registerGamedevTools(): void {

  const htmlSafe = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] ?? c))

  /** Escape a string for safe interpolation into generated source code */
  function codeSafe(s: string, lang: 'js' | 'rust' | 'gdscript' | 'csharp' | 'lua' | 'toml' | 'ini' = 'js'): string {
    if (lang === 'rust' || lang === 'toml') return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    if (lang === 'gdscript' || lang === 'csharp') return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
    if (lang === 'lua') return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
    if (lang === 'ini') return s.replace(/[=\n\r]/g, '_')
    // js default
    return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/\n/g, '\\n')
  }

  // ── Tool 1: scaffold_game ──────────────────────────────────────────

  /** Per-engine scaffold file generators. Each returns an array of [relativePath, content] */
  const scaffoldFiles: Record<string, (name: string, template: string) => [string, string][]> = {
    godot(name, tpl) {
      const is3d = tpl === '3d'
      const mainScene = is3d
        ? `[gd_scene load_steps=2 format=3]\n\n[node name="${codeSafe(name, 'ini')}" type="Node3D"]\n\n[node name="Camera3D" type="Camera3D" parent="."]\ntransform = Transform3D(1,0,0,0,1,0,0,0,1,0,2,5)\n\n[node name="DirectionalLight3D" type="DirectionalLight3D" parent="."]\n`
        : `[gd_scene load_steps=2 format=3]\n\n[node name="${codeSafe(name, 'ini')}" type="Node2D"]\n`
      return [
        ['project.godot', `[application]\nconfig/name="${codeSafe(name, 'ini')}"\nrun/main_scene="res://main.tscn"\nconfig/features=PackedStringArray("4.3")\n\n[rendering]\nrenderer/rendering_method="${is3d ? 'forward_plus' : 'gl_compatibility'}"\n`],
        ['main.tscn', mainScene],
        ['.gitignore', '.godot/\n*.import\nexport_presets.cfg\n'],
      ]
    },
    unity(name, tpl) {
      const is3d = tpl === '3d'
      return [
        ['Assets/.gitkeep', ''],
        ['Assets/Scripts/GameManager.cs', `using UnityEngine;\n\nnamespace ${name.replace(/[^a-zA-Z0-9]/g, '')}\n{\n    public class GameManager : MonoBehaviour\n    {\n        void Start() { Debug.Log("${codeSafe(name, 'csharp')} started"); }\n        void Update() { }\n    }\n}\n`],
        ['ProjectSettings/ProjectSettings.asset', `%YAML 1.1\n%TAG !u! tag:unity3d.com,2011:\n--- !u!129 &1\nPlayerSettings:\n  productName: ${name}\n  defaultScreenWidth: 1920\n  defaultScreenHeight: 1080\n`],
        ['.gitignore', '[Ll]ibrary/\n[Tt]emp/\n[Oo]bj/\n[Bb]uild/\n*.csproj\n*.sln\n*.pidb\n*.userprefs\n'],
      ]
    },
    unreal(name, tpl) {
      const safeName = name.replace(/[^a-zA-Z0-9]/g, '')
      return [
        [`${safeName}.uproject`, JSON.stringify({ FileVersion: 3, EngineAssociation: '5.4', Modules: [{ Name: safeName, Type: 'Runtime', LoadingPhase: 'Default' }] }, null, 2)],
        [`Source/${safeName}/${safeName}.h`, `#pragma once\n#include "CoreMinimal.h"\n`],
        [`Source/${safeName}/${safeName}.cpp`, `#include "${safeName}.h"\n#include "Modules/ModuleManager.h"\nIMPLEMENT_PRIMARY_GAME_MODULE(FDefaultGameModuleImpl, ${safeName}, "${safeName}");\n`],
        [`Source/${safeName}/${safeName}.Build.cs`, `using UnrealBuildTool;\npublic class ${safeName} : ModuleRules\n{\n    public ${safeName}(ReadOnlyTargetRules Target) : base(Target)\n    {\n        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;\n        PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "InputCore" });\n    }\n}\n`],
        ['.gitignore', 'Binaries/\nIntermediate/\nSaved/\nDerivedDataCache/\n*.sln\n'],
      ]
    },
    bevy(name, tpl) {
      const is3d = tpl === '3d'
      const mainRs = is3d
        ? `use bevy::prelude::*;\n\nfn main() {\n    App::new()\n        .add_plugins(DefaultPlugins)\n        .add_systems(Startup, setup)\n        .run();\n}\n\nfn setup(mut commands: Commands, mut meshes: ResMut<Assets<Mesh>>, mut materials: ResMut<Assets<StandardMaterial>>) {\n    commands.spawn(Camera3d::default()).insert(Transform::from_xyz(0.0, 2.0, 5.0).looking_at(Vec3::ZERO, Vec3::Y));\n    commands.spawn((\n        Mesh3d(meshes.add(Cuboid::new(1.0, 1.0, 1.0))),\n        MeshMaterial3d(materials.add(Color::srgb(0.3, 0.5, 0.9))),\n    ));\n    commands.spawn((\n        PointLight { intensity: 1500.0, shadows_enabled: true, ..default() },\n        Transform::from_xyz(4.0, 8.0, 4.0),\n    ));\n}\n`
        : `use bevy::prelude::*;\n\nfn main() {\n    App::new()\n        .add_plugins(DefaultPlugins)\n        .add_systems(Startup, setup)\n        .run();\n}\n\nfn setup(mut commands: Commands) {\n    commands.spawn(Camera2d);\n}\n`
      return [
        ['Cargo.toml', `[package]\nname = "${name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\nbevy = "0.15"\n\n[profile.dev]\nopt-level = 1\n[profile.dev.package."*"]\nopt-level = 3\n`],
        ['src/main.rs', mainRs],
        ['.gitignore', '/target\n'],
      ]
    },
    phaser(name, tpl) {
      const is3d = tpl === '3d'
      return [
        ['package.json', JSON.stringify({ name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'), version: '0.1.0', private: true, scripts: { dev: 'vite', build: 'vite build' }, dependencies: { phaser: '^3.80.0' }, devDependencies: { vite: '^5.0.0', typescript: '^5.4.0' } }, null, 2)],
        ['index.html', `<!DOCTYPE html>\n<html><head><title>${htmlSafe(name)}</title></head>\n<body><script type="module" src="/src/main.ts"></script></body></html>\n`],
        ['src/main.ts', `import Phaser from 'phaser'\nimport { MainScene } from './scenes/MainScene'\n\nnew Phaser.Game({\n  type: Phaser.AUTO,\n  width: 800,\n  height: 600,\n  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 300 }, debug: false } },\n  scene: [MainScene],\n})\n`],
        ['src/scenes/MainScene.ts', `import Phaser from 'phaser'\n\nexport class MainScene extends Phaser.Scene {\n  constructor() { super('MainScene') }\n  preload() { }\n  create() {\n    this.add.text(400, 300, '${codeSafe(name, 'js')}', { fontSize: '32px', color: '#fff' }).setOrigin(0.5)\n  }\n}\n`],
        ['tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ES2020', module: 'ESNext', moduleResolution: 'bundler', strict: true, esModuleInterop: true }, include: ['src'] }, null, 2)],
        ['.gitignore', 'node_modules/\ndist/\n'],
      ]
    },
    three(name, tpl) {
      const is3d = true // Three.js is always 3D
      return [
        ['package.json', JSON.stringify({ name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'), version: '0.1.0', private: true, scripts: { dev: 'vite', build: 'vite build' }, dependencies: { three: '^0.170.0' }, devDependencies: { '@types/three': '^0.170.0', vite: '^5.0.0', typescript: '^5.4.0' } }, null, 2)],
        ['index.html', `<!DOCTYPE html>\n<html><head><title>${htmlSafe(name)}</title><style>body{margin:0;overflow:hidden}canvas{display:block}</style></head>\n<body><script type="module" src="/src/main.ts"></script></body></html>\n`],
        ['src/main.ts', `import * as THREE from 'three'\n\nconst scene = new THREE.Scene()\nconst camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)\nconst renderer = new THREE.WebGLRenderer({ antialias: true })\nrenderer.setSize(window.innerWidth, window.innerHeight)\ndocument.body.appendChild(renderer.domElement)\n\nconst geometry = new THREE.BoxGeometry()\nconst material = new THREE.MeshStandardMaterial({ color: 0x4488ff })\nconst cube = new THREE.Mesh(geometry, material)\nscene.add(cube)\n\nscene.add(new THREE.AmbientLight(0x404040))\nconst light = new THREE.DirectionalLight(0xffffff, 1)\nlight.position.set(5, 5, 5)\nscene.add(light)\n\ncamera.position.z = 5\n\nfunction animate() {\n  requestAnimationFrame(animate)\n  cube.rotation.x += 0.01\n  cube.rotation.y += 0.01\n  renderer.render(scene, camera)\n}\nanimate()\n\nwindow.addEventListener('resize', () => {\n  camera.aspect = window.innerWidth / window.innerHeight\n  camera.updateProjectionMatrix()\n  renderer.setSize(window.innerWidth, window.innerHeight)\n})\n`],
        ['tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ES2020', module: 'ESNext', moduleResolution: 'bundler', strict: true, esModuleInterop: true }, include: ['src'] }, null, 2)],
        ['.gitignore', 'node_modules/\ndist/\n'],
      ]
    },
    playcanvas(name, tpl) {
      return [
        ['package.json', JSON.stringify({ name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'), version: '0.1.0', private: true, scripts: { dev: 'vite', build: 'vite build' }, dependencies: { playcanvas: '^2.1.0' }, devDependencies: { vite: '^5.0.0', typescript: '^5.4.0' } }, null, 2)],
        ['index.html', `<!DOCTYPE html>\n<html><head><title>${htmlSafe(name)}</title><style>body{margin:0;overflow:hidden}canvas{display:block}</style></head>\n<body><canvas id="app"></canvas><script type="module" src="/src/main.ts"></script></body></html>\n`],
        ['src/main.ts', `import * as pc from 'playcanvas'\n\nconst canvas = document.getElementById('app') as HTMLCanvasElement\nconst app = new pc.Application(canvas, {})\napp.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW)\napp.setCanvasResolution(pc.RESOLUTION_AUTO)\n\nconst camera = new pc.Entity('camera')\ncamera.addComponent('camera', { clearColor: new pc.Color(0.1, 0.1, 0.15) })\ncamera.setPosition(0, 2, 5)\ncamera.lookAt(pc.Vec3.ZERO)\napp.root.addChild(camera)\n\nconst light = new pc.Entity('light')\nlight.addComponent('light')\nlight.setEulerAngles(45, 30, 0)\napp.root.addChild(light)\n\nconst box = new pc.Entity('box')\nbox.addComponent('render', { type: 'box' })\napp.root.addChild(box)\n\napp.on('update', (dt: number) => { box.rotate(10 * dt, 20 * dt, 0) })\napp.start()\n`],
        ['tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ES2020', module: 'ESNext', moduleResolution: 'bundler', strict: true, esModuleInterop: true }, include: ['src'] }, null, 2)],
        ['.gitignore', 'node_modules/\ndist/\n'],
      ]
    },
    defold(name, tpl) {
      const is3d = tpl === '3d'
      return [
        ['game.project', `[project]\ntitle = ${codeSafe(name, 'ini')}\n\n[display]\nwidth = 960\nheight = 640\n\n[bootstrap]\nmain_collection = /main/main.collectionc\n\n[physics]\ntype = ${is3d ? '3D' : '2D'}\n`],
        ['main/main.collection', `name: "main"\ninstances {\n  id: "go"\n  prototype: "/main/game.go"\n  position { x: 0.0 y: 0.0 z: 0.0 }\n}\n`],
        ['main/game.go', `components {\n  id: "script"\n  component: "/main/game.script"\n}\n`],
        ['main/game.script', `function init(self)\n    msg.post(".", "acquire_input_focus")\n    print("${codeSafe(name, 'lua')} started")\nend\n\nfunction update(self, dt)\nend\n\nfunction on_input(self, action_id, action)\nend\n`],
        ['.gitignore', 'build/\n.internal/\n'],
      ]
    },
  }

  registerTool({
    name: 'scaffold_game',
    description: 'Generate project scaffolding for a game engine. Supports godot, unity, unreal, bevy, phaser, three (Three.js), playcanvas, and defold. Writes real config files, entry points, and gitignore.',
    parameters: {
      engine: { type: 'string', description: 'Game engine: godot, unity, unreal, bevy, phaser, three, playcanvas, defold', required: true },
      name: { type: 'string', description: 'Project name', required: true },
      template: { type: 'string', description: 'Template: 2d, 3d, or blank (default: blank)' },
      output_dir: { type: 'string', description: 'Output directory (default: ./<name>)' },
    },
    tier: 'free',
    async execute(args) {
      const engine = String(args.engine).toLowerCase()
      const name = String(args.name)
      const template = String(args.template || 'blank').toLowerCase()
      const outputDir = safePath(String(args.output_dir || `./${name}`))

      if (!scaffoldFiles[engine]) {
        return `Error: Unknown engine "${engine}". Supported: ${Object.keys(scaffoldFiles).join(', ')}`
      }
      if (!['2d', '3d', 'blank'].includes(template)) {
        return `Error: Invalid template "${template}". Use 2d, 3d, or blank.`
      }

      const files = scaffoldFiles[engine](name, template)
      ensureDir(outputDir)

      const created: string[] = []
      for (const [rel, content] of files) {
        const fullPath = join(outputDir, rel)
        ensureDir(dirname(fullPath))
        writeFileSync(fullPath, content, 'utf-8')
        created.push(rel)
      }

      return `Scaffolded ${engine} project "${name}" (${template}) in ${outputDir}\n\nFiles created:\n${created.map(f => `  ${f}`).join('\n')}`
    },
  })

  // ── Tool 2: game_config ────────────────────────────────────────────

  type ConfigGenerator = (settings: Record<string, unknown>) => string

  const configGenerators: Record<string, Record<string, ConfigGenerator>> = {
    godot: {
      project: (s) => {
        const lines = ['[application]']
        if (s.name) lines.push(`config/name="${codeSafe(String(s.name), 'ini')}"`)
        if (s.main_scene) lines.push(`run/main_scene="${codeSafe(String(s.main_scene), 'ini')}"`)
        lines.push('', '[rendering]')
        lines.push(`renderer/rendering_method="${codeSafe(String(s.renderer || 'forward_plus'), 'ini')}"`)
        if (s.vsync !== undefined) lines.push(`[display]\nwindow/vsync/vsync_mode=${s.vsync ? 1 : 0}`)
        if (s.width) lines.push(`window/size/viewport_width=${s.width}`)
        if (s.height) lines.push(`window/size/viewport_height=${s.height}`)
        return lines.join('\n') + '\n'
      },
      input: (s) => {
        const lines = ['[input]']
        for (const [action, keys] of Object.entries(s)) {
          const keyArr = Array.isArray(keys) ? keys : [keys]
          for (const key of keyArr) {
            lines.push(`${action}={ "deadzone": 0.5, "events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":0,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":${typeof key === 'number' ? key : 0},"physical_keycode":0,"key_label":0,"unicode":0,"location":0,"echo":false,"script":null)] }`)
          }
        }
        return lines.join('\n') + '\n'
      },
      physics: (s) => {
        const lines = ['[physics]']
        if (s.gravity !== undefined) lines.push(`2d/default_gravity=${s.gravity}`)
        if (s.gravity_vector) lines.push(`2d/default_gravity_vector=Vector2(${(s.gravity_vector as number[]).join(', ')})`)
        if (s.fps) lines.push(`common/physics_ticks_per_second=${s.fps}`)
        return lines.join('\n') + '\n'
      },
      rendering: (s) => {
        const lines = ['[rendering]']
        if (s.renderer) lines.push(`renderer/rendering_method="${codeSafe(String(s.renderer), 'ini')}"`)

        if (s.msaa) lines.push(`anti_aliasing/quality/msaa_${s.msaa_type || '3d'}=${s.msaa}`)
        if (s.shadows !== undefined) lines.push(`lights_and_shadows/directional_shadow/size=${s.shadow_size || 4096}`)
        return lines.join('\n') + '\n'
      },
      build: (s) => `[export]\nplatform="${codeSafe(String(s.platform || 'linux'), 'ini')}"\narch="${codeSafe(String(s.arch || 'x86_64'), 'ini')}"\n`,
      audio: (s) => {
        const lines = ['[audio]']
        if (s.bus_count) lines.push(`buses/default_bus_count=${s.bus_count}`)
        if (s.mix_rate) lines.push(`driver/mix_rate=${s.mix_rate}`)
        return lines.join('\n') + '\n'
      },
    },
    unity: {
      project: (s) => `%YAML 1.1\n%TAG !u! tag:unity3d.com,2011:\n--- !u!129 &1\nPlayerSettings:\n  productName: ${s.name || 'Game'}\n  defaultScreenWidth: ${s.width || 1920}\n  defaultScreenHeight: ${s.height || 1080}\n  runInBackground: ${s.run_in_background !== false ? 1 : 0}\n`,
      build: (s) => `%YAML 1.1\n--- !u!1045 &1\nEditorBuildSettings:\n  scenes:\n${(s.scenes as string[] || ['Assets/Scenes/Main.unity']).map((sc: string) => `  - path: ${sc}\n    enabled: 1`).join('\n')}\n`,
      input: (s) => {
        const lines = ['%YAML 1.1', '--- !u!13 &1', 'InputManager:', '  m_Axes:']
        for (const [name, cfg] of Object.entries(s)) {
          const c = cfg as Record<string, unknown>
          lines.push(`  - serializedVersion: 3\n    m_Name: ${name}\n    positiveButton: ${c.positive || ''}\n    negativeButton: ${c.negative || ''}\n    type: ${c.type || 0}`)
        }
        return lines.join('\n') + '\n'
      },
      physics: (s) => `%YAML 1.1\n--- !u!55 &1\nPhysicsManager:\n  m_Gravity: {x: 0, y: ${s.gravity ?? -9.81}, z: 0}\n  m_BounceThreshold: ${s.bounce_threshold ?? 2}\n  m_DefaultContactOffset: ${s.contact_offset ?? 0.01}\n`,
      rendering: (s) => `%YAML 1.1\n--- !u!30 &1\nGraphicsSettings:\n  m_Deferred: ${s.deferred ? 1 : 0}\n  m_TransparencySortMode: 0\n`,
      audio: (s) => `%YAML 1.1\n--- !u!11 &1\nAudioManager:\n  m_Volume: ${s.volume ?? 1}\n  m_SampleRate: ${s.sample_rate ?? 44100}\n`,
    },
    bevy: {
      project: (s) => {
        const name = String(s.name || 'game').toLowerCase().replace(/[^a-z0-9-]/g, '-')
        return `[package]\nname = "${name}"\nversion = "${codeSafe(String(s.version || '0.1.0'), 'toml')}"\nedition = "2021"\n\n[dependencies]\nbevy = { version = "0.15", features = [${(s.features as string[] || []).map((f: string) => `"${codeSafe(f, 'toml')}"`).join(', ')}] }\n\n[profile.dev]\nopt-level = 1\n[profile.dev.package."*"]\nopt-level = 3\n`
      },
      build: (s) => `# .cargo/config.toml\n[target.x86_64-unknown-linux-gnu]\nlinker = "clang"\nrustflags = ["-C", "link-arg=-fuse-ld=lld"]\n\n[target.x86_64-pc-windows-msvc]\nrustflags = ["-C", "link-arg=/DEBUG:NONE"]\n`,
      rendering: (s) => `// Rendering plugin configuration\nuse bevy::prelude::*;\n\npub fn rendering_plugin(app: &mut App) {\n    app.insert_resource(Msaa::Sample${s.msaa || 4})\n       .insert_resource(ClearColor(Color::srgb(${s.clear_r ?? 0.1}, ${s.clear_g ?? 0.1}, ${s.clear_b ?? 0.15})));\n}\n`,
      physics: (s) => `// Physics configuration (bevy_rapier)\nuse bevy::prelude::*;\nuse bevy_rapier${s.dim || '2d'}::prelude::*;\n\npub fn physics_plugin(app: &mut App) {\n    app.add_plugins(RapierPhysicsPlugin::<NoUserData>::default())\n       .insert_resource(RapierConfiguration {\n           gravity: Vec${s.dim === '3d' ? '3' : '2'}::new(${s.gravity_x ?? 0.0}, ${s.gravity_y ?? -9.81}${s.dim === '3d' ? `, ${s.gravity_z ?? 0.0}` : ''}),\n           ..default()\n       });\n}\n`,
      input: (s) => `// Input mapping\nuse bevy::prelude::*;\n\n#[derive(Actionlike, PartialEq, Eq, Clone, Copy, Hash, Debug, Reflect)]\npub enum Action {\n${Object.keys(s).map(k => `    ${k},`).join('\n')}\n}\n`,
      audio: (s) => `// Audio configuration\nuse bevy::prelude::*;\nuse bevy::audio::*;\n\npub fn audio_plugin(app: &mut App) {\n    app.insert_resource(GlobalVolume::new(${s.volume ?? 1.0}));\n}\n`,
    },
    phaser: {
      project: (s) => JSON.stringify({ name: String(s.name || 'game').toLowerCase().replace(/[^a-z0-9-]/g, '-'), version: s.version || '0.1.0', private: true, scripts: { dev: 'vite', build: 'vite build' }, dependencies: { phaser: s.phaser_version || '^3.80.0' }, devDependencies: { vite: '^5.0.0', typescript: '^5.4.0' } }, null, 2),
      physics: (s) => `// Phaser physics config\nexport const physicsConfig: Phaser.Types.Physics.ArcadePhysicsConfig = {\n  gravity: { x: ${s.gravity_x ?? 0}, y: ${s.gravity_y ?? 300} },\n  debug: ${s.debug ?? false},\n}\n`,
      rendering: (s) => `// Phaser rendering config\nexport const renderConfig: Partial<Phaser.Types.Core.GameConfig> = {\n  type: Phaser.${s.renderer === 'canvas' ? 'CANVAS' : s.renderer === 'webgl' ? 'WEBGL' : 'AUTO'},\n  antialias: ${s.antialias ?? true},\n  pixelArt: ${s.pixel_art ?? false},\n  roundPixels: ${s.round_pixels ?? false},\n}\n`,
      build: (s) => `// vite.config.ts\nimport { defineConfig } from 'vite'\nexport default defineConfig({\n  base: '${codeSafe(String(s.base || './'), 'js')}',\n  build: { target: '${codeSafe(String(s.target || 'es2020'), 'js')}', outDir: '${codeSafe(String(s.outDir || 'dist'), 'js')}' },\n})\n`,
      input: (s) => `// Input key mapping\nexport const KEYS = ${JSON.stringify(s, null, 2)} as const\n`,
      audio: (s) => `// Audio config\nexport const audioConfig = {\n  disableWebAudio: ${s.disable_web_audio ?? false},\n  noAudio: ${s.no_audio ?? false},\n}\n`,
    },
    three: {
      project: (s) => JSON.stringify({ name: String(s.name || 'game').toLowerCase().replace(/[^a-z0-9-]/g, '-'), version: s.version || '0.1.0', private: true, scripts: { dev: 'vite', build: 'vite build' }, dependencies: { three: s.three_version || '^0.170.0' }, devDependencies: { '@types/three': s.three_version || '^0.170.0', vite: '^5.0.0', typescript: '^5.4.0' } }, null, 2),
      rendering: (s) => `// Three.js renderer config\nimport * as THREE from 'three'\n\nexport function createRenderer(canvas?: HTMLCanvasElement) {\n  const renderer = new THREE.WebGLRenderer({ canvas, antialias: ${s.antialias ?? true}, alpha: ${s.alpha ?? false} })\n  renderer.shadowMap.enabled = ${s.shadows ?? true}\n  renderer.shadowMap.type = THREE.${s.shadow_type || 'PCFSoftShadowMap'}\n  renderer.toneMapping = THREE.${s.tone_mapping || 'ACESFilmicToneMapping'}\n  renderer.toneMappingExposure = ${s.exposure ?? 1.0}\n  return renderer\n}\n`,
      physics: (s) => `// Physics config (rapier/cannon)\nexport const physicsConfig = {\n  gravity: { x: ${s.gravity_x ?? 0}, y: ${s.gravity_y ?? -9.81}, z: ${s.gravity_z ?? 0} },\n  timestep: ${s.timestep ?? 1 / 60},\n}\n`,
      build: (s) => `// vite.config.ts\nimport { defineConfig } from 'vite'\nexport default defineConfig({\n  base: '${codeSafe(String(s.base || './'), 'js')}',\n  build: { target: '${codeSafe(String(s.target || 'es2020'), 'js')}', outDir: '${codeSafe(String(s.outDir || 'dist'), 'js')}' },\n})\n`,
      input: (s) => `// Input mapping\nexport const INPUT_MAP = ${JSON.stringify(s, null, 2)} as const\n`,
      audio: (s) => `// Three.js audio config\nimport * as THREE from 'three'\n\nexport function createAudioListener(camera: THREE.Camera) {\n  const listener = new THREE.AudioListener()\n  camera.add(listener)\n  return listener\n}\n`,
    },
    unreal: {
      project: (s) => {
        const safeName = String(s.name || 'Game').replace(/[^a-zA-Z0-9]/g, '')
        return JSON.stringify({ FileVersion: 3, EngineAssociation: s.engine_version || '5.4', Modules: [{ Name: safeName, Type: 'Runtime', LoadingPhase: 'Default' }], Plugins: (s.plugins as string[] || []).map((p: string) => ({ Name: p, Enabled: true })) }, null, 2)
      },
      build: (s) => `[/Script/UnrealBuildTool.BuildConfiguration]\nPlatform=${s.platform || 'Win64'}\nConfiguration=${s.configuration || 'Shipping'}\n`,
      input: (s) => {
        const lines = ['[/Script/Engine.InputSettings]']
        for (const [name, key] of Object.entries(s)) {
          lines.push(`+ActionMappings=(ActionName="${codeSafe(String(name), 'ini')}",bShift=False,bCtrl=False,bAlt=False,bCmd=False,Key=${key})`)
        }
        return lines.join('\n') + '\n'
      },
      physics: (s) => `[/Script/Engine.PhysicsSettings]\nDefaultGravityZ=${s.gravity ?? -980}\nMaxPhysicsDeltaTime=${s.max_dt ?? 0.0333}\nPhysicsTicksPerSecond=${s.ticks ?? 60}\n`,
      rendering: (s) => `[/Script/Engine.RendererSettings]\nr.DefaultFeature.AntiAliasing=${s.aa ?? 2}\nr.Shadow.CSM.MaxCascades=${s.shadow_cascades ?? 4}\nr.MobileHDR=${s.mobile_hdr ? 'True' : 'False'}\n`,
      audio: (s) => `[/Script/Engine.AudioSettings]\nDefaultBaseSoundMix=${s.mix || '/Engine/EngineSounds/DefaultSoundMix'}\nQualityLevel=${s.quality ?? 3}\n`,
    },
    playcanvas: {
      project: (s) => JSON.stringify({ name: s.name || 'game', version: s.version || '0.1.0', scripts: { dev: 'vite', build: 'vite build' }, dependencies: { playcanvas: s.pc_version || '^2.1.0' } }, null, 2),
      rendering: (s) => `// PlayCanvas rendering config\nexport const renderSettings = {\n  antialias: ${s.antialias ?? true},\n  shadows: ${s.shadows ?? true},\n  gammaCorrection: pc.GAMMA_SRGB,\n  toneMapping: pc.TONEMAP_ACES,\n}\n`,
      physics: (s) => `// PlayCanvas physics (ammo.js)\nexport const physicsConfig = {\n  gravity: [${s.gravity_x ?? 0}, ${s.gravity_y ?? -9.81}, ${s.gravity_z ?? 0}],\n  fixedTimeStep: ${s.timestep ?? 1 / 60},\n}\n`,
      build: (s) => `// vite.config.ts\nimport { defineConfig } from 'vite'\nexport default defineConfig({\n  base: '${codeSafe(String(s.base || './'), 'js')}',\n  build: { target: 'es2020', outDir: '${codeSafe(String(s.outDir || 'dist'), 'js')}' },\n})\n`,
      input: (s) => `// Input config\nexport const INPUT_MAP = ${JSON.stringify(s, null, 2)} as const\n`,
      audio: (s) => `// Audio config\nexport const audioConfig = { volume: ${s.volume ?? 1}, distanceModel: '${codeSafe(String(s.distance_model || 'inverse'), 'js')}' }\n`,
    },
    defold: {
      project: (s) => `[project]\ntitle = ${codeSafe(String(s.name || 'Game'), 'ini')}\n\n[display]\nwidth = ${s.width || 960}\nheight = ${s.height || 640}\n\n[bootstrap]\nmain_collection = ${codeSafe(String(s.main_collection || '/main/main.collectionc'), 'ini')}\n`,
      physics: (s) => `[physics]\ntype = ${s.physics_type || '2D'}\ngravity_y = ${s.gravity ?? -10}\nscale = ${s.scale ?? 0.02}\n`,
      rendering: (s) => `[graphics]\ndefault_texture_min_filter = ${s.min_filter || 'linear'}\ndefault_texture_mag_filter = ${s.mag_filter || 'linear'}\nmax_draw_calls = ${s.max_draw_calls || 1024}\n`,
      build: (s) => `[native_extension]\napp_manifest = ${s.manifest || ''}\n`,
      input: (s) => {
        const lines: string[] = []
        for (const [action, trigger] of Object.entries(s)) {
          lines.push(`- input: ${trigger}\n  type: KEY_TRIGGER\n  action: ${action}`)
        }
        return lines.join('\n') + '\n'
      },
      audio: (s) => `[sound]\ngain = ${s.gain ?? 1.0}\nmax_sound_instances = ${s.max_instances ?? 128}\n`,
    },
  }

  registerTool({
    name: 'game_config',
    description: 'Generate or modify game engine config files. Auto-detects engine from project directory. Supports project, build, input, physics, rendering, and audio config types.',
    parameters: {
      engine: { type: 'string', description: 'Engine: godot, unity, unreal, bevy, phaser, three, playcanvas, defold (auto-detected if path provided)' },
      config_type: { type: 'string', description: 'Config type: project, build, input, physics, rendering, audio', required: true },
      settings: { type: 'string', description: 'JSON object of settings to apply', required: true },
      path: { type: 'string', description: 'Output file path (auto-named if omitted)' },
    },
    tier: 'free',
    async execute(args) {
      let engine = args.engine ? String(args.engine).toLowerCase() : null
      const configType = String(args.config_type).toLowerCase()
      const path = args.path ? String(args.path) : null

      let settings: Record<string, unknown>
      try {
        settings = JSON.parse(String(args.settings))
      } catch {
        return 'Error: settings must be valid JSON'
      }

      // Auto-detect engine from cwd if not specified
      if (!engine) {
        engine = detectEngine(process.cwd())
        if (!engine) return 'Error: Could not auto-detect engine. Specify engine parameter.'
      }

      if (!configGenerators[engine]) {
        return `Error: Unknown engine "${engine}". Supported: ${Object.keys(configGenerators).join(', ')}`
      }
      const engineConfigs = configGenerators[engine]
      if (!engineConfigs[configType]) {
        return `Error: Unknown config_type "${configType}" for ${engine}. Supported: ${Object.keys(engineConfigs).join(', ')}`
      }

      const content = engineConfigs[configType](settings)

      // Default output paths per engine/config
      const defaultPaths: Record<string, Record<string, string>> = {
        godot: { project: 'project.godot', input: 'project.godot', physics: 'project.godot', rendering: 'project.godot', build: 'export_presets.cfg', audio: 'project.godot' },
        unity: { project: 'ProjectSettings/ProjectSettings.asset', input: 'ProjectSettings/InputManager.asset', physics: 'ProjectSettings/DynamicsManager.asset', rendering: 'ProjectSettings/GraphicsSettings.asset', build: 'ProjectSettings/EditorBuildSettings.asset', audio: 'ProjectSettings/AudioManager.asset' },
        unreal: { project: 'Game.uproject', input: 'Config/DefaultInput.ini', physics: 'Config/DefaultEngine.ini', rendering: 'Config/DefaultEngine.ini', build: 'Config/DefaultGame.ini', audio: 'Config/DefaultEngine.ini' },
        bevy: { project: 'Cargo.toml', build: '.cargo/config.toml', rendering: 'src/rendering.rs', physics: 'src/physics.rs', input: 'src/input.rs', audio: 'src/audio.rs' },
        phaser: { project: 'package.json', physics: 'src/config/physics.ts', rendering: 'src/config/rendering.ts', build: 'vite.config.ts', input: 'src/config/input.ts', audio: 'src/config/audio.ts' },
        three: { project: 'package.json', rendering: 'src/config/renderer.ts', physics: 'src/config/physics.ts', build: 'vite.config.ts', input: 'src/config/input.ts', audio: 'src/config/audio.ts' },
        playcanvas: { project: 'package.json', rendering: 'src/config/render.ts', physics: 'src/config/physics.ts', build: 'vite.config.ts', input: 'src/config/input.ts', audio: 'src/config/audio.ts' },
        defold: { project: 'game.project', physics: 'game.project', rendering: 'game.project', build: 'game.project', input: 'input/game.input_binding', audio: 'game.project' },
      }

      const outPath = path || defaultPaths[engine]?.[configType] || `${configType}.cfg`
      ensureDir(dirname(outPath))
      writeFileSync(outPath, content, 'utf-8')

      return `Generated ${engine} ${configType} config → ${outPath}\n\n${content.slice(0, 500)}${content.length > 500 ? '\n...' : ''}`
    },
  })

  // ── Tool 3: shader_debug ───────────────────────────────────────────

  interface ShaderIssue {
    line: number
    severity: 'warning' | 'error' | 'perf'
    message: string
    suggestion: string
  }

  /** Regex-based shader static analysis checks */
  const shaderChecks: Array<{
    pattern: RegExp
    severity: ShaderIssue['severity']
    message: string
    suggestion: string
    targets?: string[]  // which languages this applies to (empty = all)
    contexts?: string[] // which targets (mobile/desktop/webgl) — empty = all
  }> = [
    // Branching / control flow
    { pattern: /\bif\s*\(/g, severity: 'perf', message: 'Dynamic branching detected', suggestion: 'Use step()/mix()/clamp() for branchless alternatives when possible', targets: ['glsl', 'hlsl', 'wgsl'] },
    { pattern: /\bfor\s*\([^;]*;\s*[^;]*[a-zA-Z_]\w*\s*[<>]/g, severity: 'perf', message: 'Variable loop bound detected', suggestion: 'Use constant loop bounds for GPU unrolling; or add [unroll] / #pragma unroll', targets: ['glsl', 'hlsl'] },
    { pattern: /\bdiscard\b/g, severity: 'perf', message: 'Discard statement — prevents early-Z optimization', suggestion: 'Avoid discard on mobile; use alpha-to-coverage if possible', contexts: ['mobile', 'webgl'] },
    // Precision
    { pattern: /\bhighp\b/g, severity: 'perf', message: 'highp precision — expensive on mobile GPUs', suggestion: 'Use mediump where visual quality allows', contexts: ['mobile', 'webgl'] },
    { pattern: /\bdouble\b/g, severity: 'perf', message: 'double precision — not supported on most GPUs', suggestion: 'Use float instead', targets: ['glsl', 'hlsl'] },
    // Math optimization
    { pattern: /pow\s*\([^,]+,\s*2\.0\s*\)/g, severity: 'perf', message: 'pow(x, 2.0) — use x*x instead', suggestion: 'Replace pow(x, 2.0) with x*x for better performance' },
    { pattern: /pow\s*\([^,]+,\s*0\.5\s*\)/g, severity: 'perf', message: 'pow(x, 0.5) — use sqrt(x) instead', suggestion: 'Replace pow(x, 0.5) with sqrt(x)' },
    { pattern: /1\.0\s*\/\s*sqrt\s*\(/g, severity: 'perf', message: '1.0/sqrt(x) — use inversesqrt(x)', suggestion: 'Replace 1.0/sqrt(x) with inversesqrt(x)' },
    { pattern: /\bsin\b.*\bcos\b|\bcos\b.*\bsin\b/g, severity: 'perf', message: 'Separate sin/cos calls on same value', suggestion: 'Use sincos() where available for combined computation' },
    // Texture
    { pattern: /\btexture\s*\(.*\+.*\)/g, severity: 'perf', message: 'Dependent texture read — computed UV in texture fetch', suggestion: 'Pre-compute UVs in vertex shader and pass as varying' },
    { pattern: /\btextureLod\b/g, severity: 'warning', message: 'Manual LOD selection', suggestion: 'Verify LOD level is correct; prefer texture() in fragment shader for auto-LOD' },
    // Overdraw
    { pattern: /gl_FragColor\s*=.*\balpha\b.*[<]\s*[01]\./g, severity: 'perf', message: 'Potential alpha test — may cause overdraw', suggestion: 'Sort transparent objects back-to-front; use opaque pass first' },
    // WGSL-specific
    { pattern: /\barray\s*<[^>]+,\s*\d{4,}\s*>/g, severity: 'perf', message: 'Large static array allocation in shader', suggestion: 'Use storage buffers for large data', targets: ['wgsl'] },
    // HLSL-specific
    { pattern: /\[numthreads\s*\(\s*1\s*,\s*1\s*,\s*1\s*\)\]/g, severity: 'perf', message: 'Compute shader with 1,1,1 thread group', suggestion: 'Use larger thread groups (e.g., 64,1,1 or 8,8,1) for better occupancy', targets: ['hlsl'] },
    // Common errors
    { pattern: /\/\s*0[^.]/g, severity: 'error', message: 'Potential division by zero', suggestion: 'Add epsilon or max() guard: x / max(y, 0.001)' },
    { pattern: /\bnormalize\s*\(\s*vec[234]\s*\(\s*0/g, severity: 'error', message: 'Normalizing zero vector — undefined behavior', suggestion: 'Check vector length before normalizing' },
  ]

  registerTool({
    name: 'shader_debug',
    description: 'Static analysis of shader code for performance issues, errors, and optimization opportunities. Supports GLSL, HLSL, and WGSL. Reports branching, precision, overdraw, math optimization, and texture access patterns.',
    parameters: {
      source: { type: 'string', description: 'Shader source code or file path', required: true },
      language: { type: 'string', description: 'Shader language: glsl, hlsl, wgsl (auto-detected from extension if path)', required: true },
      target: { type: 'string', description: 'Target platform: mobile, desktop, webgl (default: desktop)' },
    },
    tier: 'free',
    async execute(args) {
      let source = String(args.source)
      let language = String(args.language).toLowerCase()
      const target = String(args.target || 'desktop').toLowerCase()

      // If source looks like a file path, try to read it
      const shaderExts = ['.glsl', '.hlsl', '.wgsl', '.metal', '.frag', '.vert', '.comp', '.geom', '.tesc', '.tese', '.gdshader', '.shader', '.cg', '.fx']
      if (source.length < 300 && !source.includes('\n') && existsSync(source)) {
        const ext = extname(source).toLowerCase()
        if (!shaderExts.includes(ext)) return `Error: shader_debug only reads shader files (${shaderExts.join(', ')}). Got: ${ext || 'no extension'}`
        source = readFileSync(source, 'utf-8')
        if (!args.language) {
          const extMap: Record<string, string> = { '.glsl': 'glsl', '.vert': 'glsl', '.frag': 'glsl', '.hlsl': 'hlsl', '.wgsl': 'wgsl', '.shader': 'hlsl', '.cg': 'hlsl' }
          language = extMap[ext] || language
        }
      }

      if (!['glsl', 'hlsl', 'wgsl'].includes(language)) {
        return `Error: Unknown shader language "${language}". Use glsl, hlsl, or wgsl.`
      }
      if (!['mobile', 'desktop', 'webgl'].includes(target)) {
        return `Error: Unknown target "${target}". Use mobile, desktop, or webgl.`
      }

      const lines = source.split('\n')
      const issues: ShaderIssue[] = []

      for (const check of shaderChecks) {
        // Filter by language
        if (check.targets && !check.targets.includes(language)) continue
        // Filter by target platform
        if (check.contexts && !check.contexts.includes(target)) continue

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          // Skip comments
          const trimmed = line.replace(/\/\/.*$/, '').trim()
          if (!trimmed || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue

          check.pattern.lastIndex = 0
          if (check.pattern.test(trimmed)) {
            issues.push({
              line: i + 1,
              severity: check.severity,
              message: check.message,
              suggestion: check.suggestion,
            })
          }
        }
      }

      // Summary statistics
      const totalLines = lines.filter(l => l.trim() && !l.trim().startsWith('//')).length
      const errors = issues.filter(i => i.severity === 'error').length
      const warnings = issues.filter(i => i.severity === 'warning').length
      const perfIssues = issues.filter(i => i.severity === 'perf').length

      // Uniform/varying/attribute count
      const uniformCount = (source.match(/\buniform\b/g) || []).length
      const varyingCount = (source.match(/\b(?:varying|in|out)\b/g) || []).length
      const textureCount = (source.match(/\b(?:sampler2D|sampler3D|samplerCube|texture2D|texture_2d)\b/g) || []).length

      let report = `Shader Analysis Report (${language.toUpperCase()} → ${target})\n${'═'.repeat(50)}\n`
      report += `Lines: ${totalLines} | Uniforms: ${uniformCount} | Varyings: ${varyingCount} | Textures: ${textureCount}\n`
      report += `Errors: ${errors} | Warnings: ${warnings} | Perf issues: ${perfIssues}\n`

      if (issues.length === 0) {
        report += '\nNo issues found. Shader looks clean.'
      } else {
        report += `\n${'─'.repeat(50)}\n`
        for (const issue of issues) {
          const icon = issue.severity === 'error' ? 'ERR' : issue.severity === 'warning' ? 'WRN' : 'PRF'
          report += `[${icon}] Line ${issue.line}: ${issue.message}\n      → ${issue.suggestion}\n`
        }
      }

      // Target-specific notes
      if (target === 'mobile') {
        report += `\n${'─'.repeat(50)}\nMobile notes: Prefer mediump, avoid discard, minimize texture fetches, keep ALU low.`
      } else if (target === 'webgl') {
        report += `\n${'─'.repeat(50)}\nWebGL notes: No compute shaders, limited extensions, use precision qualifiers.`
      }

      return report
    },
  })

  // ── Tool 4: material_graph ─────────────────────────────────────────

  type MaterialGenerator = (params: Record<string, unknown>) => string

  const materialGenerators: Record<string, Record<string, MaterialGenerator>> = {
    three: {
      pbr: (p) => `import * as THREE from 'three'

export function createPBRMaterial() {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(${p.color || '0x888888'}),
    metalness: ${p.metalness ?? 0.5},
    roughness: ${p.roughness ?? 0.5},
    envMapIntensity: ${p.env_intensity ?? 1.0},
    ${p.normal_map ? `normalMap: textureLoader.load('${p.normal_map}'),\n    normalScale: new THREE.Vector2(${p.normal_scale ?? 1.0}, ${p.normal_scale ?? 1.0}),` : ''}
    ${p.ao_map ? `aoMap: textureLoader.load('${p.ao_map}'),\n    aoMapIntensity: ${p.ao_intensity ?? 1.0},` : ''}
  })
}
`,
      toon: (p) => `import * as THREE from 'three'

const gradientMap = new THREE.DataTexture(
  new Uint8Array([${(p.steps as number[] || [0, 128, 255]).join(', ')}]),
  ${(p.steps as number[] || [0, 128, 255]).length}, 1, THREE.RedFormat
)
gradientMap.magFilter = THREE.NearestFilter
gradientMap.needsUpdate = true

export function createToonMaterial() {
  return new THREE.MeshToonMaterial({
    color: new THREE.Color(${p.color || '0x88aaff'}),
    gradientMap,
  })
}
`,
      water: (p) => `import * as THREE from 'three'

// Water material — animated UV scrolling with depth-based transparency
export function createWaterMaterial() {
  const uniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(${p.color || '0x0077be'}) },
    uSpeed: { value: ${p.speed ?? 0.5} },
    uFrequency: { value: ${p.frequency ?? 4.0} },
    uAmplitude: { value: ${p.amplitude ?? 0.1} },
    uOpacity: { value: ${p.opacity ?? 0.7} },
  }

  return new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    vertexShader: \`
      uniform float uTime, uFrequency, uAmplitude, uSpeed;
      varying vec2 vUv;
      varying float vElevation;
      void main() {
        vUv = uv;
        vec3 pos = position;
        float elevation = sin(pos.x * uFrequency + uTime * uSpeed) * uAmplitude
                        + sin(pos.z * uFrequency * 0.7 + uTime * uSpeed * 1.3) * uAmplitude * 0.5;
        pos.y += elevation;
        vElevation = elevation;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    \`,
    fragmentShader: \`
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      varying float vElevation;
      void main() {
        float alpha = uOpacity + vElevation * 0.5;
        gl_FragColor = vec4(uColor + vElevation * 0.3, alpha);
      }
    \`,
  })
}
`,
      foliage: (p) => `import * as THREE from 'three'

export function createFoliageMaterial() {
  const uniforms = {
    uTime: { value: 0 },
    uWindStrength: { value: ${p.wind_strength ?? 0.3} },
    uWindFrequency: { value: ${p.wind_frequency ?? 2.0} },
    uColor: { value: new THREE.Color(${p.color || '0x44aa44'}) },
    uColorTip: { value: new THREE.Color(${p.tip_color || '0x88cc44'}) },
  }

  return new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    vertexShader: \`
      uniform float uTime, uWindStrength, uWindFrequency;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 pos = position;
        float sway = sin(pos.x * uWindFrequency + uTime) * uWindStrength * uv.y;
        pos.x += sway;
        pos.z += sway * 0.5;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    \`,
    fragmentShader: \`
      uniform vec3 uColor, uColorTip;
      varying vec2 vUv;
      void main() {
        vec3 col = mix(uColor, uColorTip, vUv.y);
        gl_FragColor = vec4(col, 1.0);
      }
    \`,
  })
}
`,
      glass: (p) => `import * as THREE from 'three'

export function createGlassMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(${p.color || '0xffffff'}),
    metalness: ${p.metalness ?? 0.0},
    roughness: ${p.roughness ?? 0.05},
    transmission: ${p.transmission ?? 0.95},
    thickness: ${p.thickness ?? 0.5},
    ior: ${p.ior ?? 1.5},
    envMapIntensity: ${p.env_intensity ?? 1.0},
    transparent: true,
  })
}
`,
      emissive: (p) => `import * as THREE from 'three'

export function createEmissiveMaterial() {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(${p.color || '0x000000'}),
    emissive: new THREE.Color(${p.emissive_color || '0xff4400'}),
    emissiveIntensity: ${p.intensity ?? 2.0},
    metalness: ${p.metalness ?? 0.0},
    roughness: ${p.roughness ?? 0.8},
  })
}
`,
    },
    godot: {
      pbr: (p) => `shader_type spatial;

uniform vec3 albedo : source_color = vec3(${p.r ?? 0.5}, ${p.g ?? 0.5}, ${p.b ?? 0.5});
uniform float metallic : hint_range(0.0, 1.0) = ${p.metalness ?? 0.5};
uniform float roughness : hint_range(0.0, 1.0) = ${p.roughness ?? 0.5};
${p.normal_map ? 'uniform sampler2D normal_map : hint_normal;' : ''}

void fragment() {
    ALBEDO = albedo;
    METALLIC = metallic;
    ROUGHNESS = roughness;
    ${p.normal_map ? 'NORMAL_MAP = texture(normal_map, UV).rgb;' : ''}
}
`,
      toon: (p) => `shader_type spatial;
render_mode unshaded;

uniform vec3 albedo : source_color = vec3(${p.r ?? 0.5}, ${p.g ?? 0.7}, ${p.b ?? 1.0});
uniform int steps : hint_range(2, 8) = ${p.steps ?? 3};
uniform float edge_threshold : hint_range(0.0, 1.0) = ${p.edge_threshold ?? 0.3};

void fragment() {
    float ndotl = dot(NORMAL, normalize(vec3(0.5, 1.0, 0.3)));
    ndotl = max(ndotl, 0.0);
    float stepped = floor(ndotl * float(steps)) / float(steps);
    ALBEDO = albedo * (0.3 + 0.7 * stepped);
}
`,
      water: (p) => `shader_type spatial;
render_mode blend_mix, cull_disabled;

uniform vec3 water_color : source_color = vec3(0.0, 0.47, 0.75);
uniform float speed : hint_range(0.0, 5.0) = ${p.speed ?? 0.5};
uniform float wave_freq : hint_range(0.0, 20.0) = ${p.frequency ?? 4.0};
uniform float wave_amp : hint_range(0.0, 1.0) = ${p.amplitude ?? 0.1};
uniform float alpha : hint_range(0.0, 1.0) = ${p.opacity ?? 0.7};

void vertex() {
    VERTEX.y += sin(VERTEX.x * wave_freq + TIME * speed) * wave_amp
              + sin(VERTEX.z * wave_freq * 0.7 + TIME * speed * 1.3) * wave_amp * 0.5;
}

void fragment() {
    ALBEDO = water_color;
    ALPHA = alpha;
}
`,
      foliage: (p) => `shader_type spatial;
render_mode cull_disabled;

uniform vec3 base_color : source_color = vec3(0.27, 0.67, 0.27);
uniform vec3 tip_color : source_color = vec3(0.53, 0.8, 0.27);
uniform float wind_strength : hint_range(0.0, 2.0) = ${p.wind_strength ?? 0.3};
uniform float wind_speed : hint_range(0.0, 10.0) = ${p.wind_frequency ?? 2.0};

void vertex() {
    float sway = sin(VERTEX.x * wind_speed + TIME) * wind_strength * UV.y;
    VERTEX.x += sway;
    VERTEX.z += sway * 0.5;
}

void fragment() {
    ALBEDO = mix(base_color, tip_color, UV.y);
}
`,
      glass: (p) => `shader_type spatial;
render_mode blend_mix;

uniform vec3 glass_color : source_color = vec3(1.0, 1.0, 1.0);
uniform float alpha : hint_range(0.0, 1.0) = ${p.opacity ?? 0.15};
uniform float roughness : hint_range(0.0, 1.0) = ${p.roughness ?? 0.05};
uniform float metallic : hint_range(0.0, 1.0) = ${p.metalness ?? 0.0};

void fragment() {
    ALBEDO = glass_color;
    ALPHA = alpha;
    ROUGHNESS = roughness;
    METALLIC = metallic;
    SPECULAR = 0.5;
}
`,
      emissive: (p) => `shader_type spatial;

uniform vec3 albedo : source_color = vec3(0.0, 0.0, 0.0);
uniform vec3 emission_color : source_color = vec3(1.0, 0.27, 0.0);
uniform float emission_strength : hint_range(0.0, 16.0) = ${p.intensity ?? 2.0};

void fragment() {
    ALBEDO = albedo;
    EMISSION = emission_color * emission_strength;
}
`,
    },
    unity: {
      pbr: (p) => `Shader "Custom/PBR" {
    Properties {
        _Color ("Color", Color) = (${p.r ?? 0.5}, ${p.g ?? 0.5}, ${p.b ?? 0.5}, 1)
        _Metallic ("Metallic", Range(0,1)) = ${p.metalness ?? 0.5}
        _Smoothness ("Smoothness", Range(0,1)) = ${1.0 - (p.roughness as number ?? 0.5)}
    }
    SubShader {
        Tags { "RenderType"="Opaque" }
        CGPROGRAM
        #pragma surface surf Standard fullforwardshadows
        struct Input { float2 uv_MainTex; };
        fixed4 _Color;
        half _Metallic;
        half _Smoothness;
        void surf(Input IN, inout SurfaceOutputStandard o) {
            o.Albedo = _Color.rgb;
            o.Metallic = _Metallic;
            o.Smoothness = _Smoothness;
        }
        ENDCG
    }
}
`,
      toon: (p) => `Shader "Custom/Toon" {
    Properties {
        _Color ("Color", Color) = (${p.r ?? 0.5}, ${p.g ?? 0.7}, ${p.b ?? 1.0}, 1)
        _Steps ("Steps", Range(2, 8)) = ${p.steps ?? 3}
    }
    SubShader {
        Tags { "RenderType"="Opaque" }
        CGPROGRAM
        #pragma surface surf ToonRamp
        half _Steps;
        fixed4 _Color;
        half4 LightingToonRamp(SurfaceOutput s, half3 lightDir, half atten) {
            half NdotL = dot(s.Normal, lightDir);
            half stepped = floor(max(NdotL, 0.0) * _Steps) / _Steps;
            half4 c;
            c.rgb = s.Albedo * (0.3 + 0.7 * stepped) * atten;
            c.a = s.Alpha;
            return c;
        }
        struct Input { float2 uv_MainTex; };
        void surf(Input IN, inout SurfaceOutput o) { o.Albedo = _Color.rgb; }
        ENDCG
    }
}
`,
      water: (p) => `Shader "Custom/Water" {
    Properties {
        _Color ("Color", Color) = (0, 0.47, 0.75, 0.7)
        _Speed ("Speed", Float) = ${p.speed ?? 0.5}
        _Freq ("Frequency", Float) = ${p.frequency ?? 4.0}
        _Amp ("Amplitude", Float) = ${p.amplitude ?? 0.1}
    }
    SubShader {
        Tags { "Queue"="Transparent" "RenderType"="Transparent" }
        Blend SrcAlpha OneMinusSrcAlpha
        CGPROGRAM
        #pragma surface surf Standard alpha vertex:vert
        float _Speed, _Freq, _Amp;
        fixed4 _Color;
        struct Input { float2 uv_MainTex; float3 worldPos; };
        void vert(inout appdata_full v) {
            v.vertex.y += sin(v.vertex.x * _Freq + _Time.y * _Speed) * _Amp;
        }
        void surf(Input IN, inout SurfaceOutputStandard o) {
            o.Albedo = _Color.rgb;
            o.Alpha = _Color.a;
        }
        ENDCG
    }
}
`,
      foliage: (p) => `Shader "Custom/Foliage" {
    Properties {
        _BaseColor ("Base Color", Color) = (0.27, 0.67, 0.27, 1)
        _TipColor ("Tip Color", Color) = (0.53, 0.8, 0.27, 1)
        _WindStrength ("Wind Strength", Float) = ${p.wind_strength ?? 0.3}
        _WindSpeed ("Wind Speed", Float) = ${p.wind_frequency ?? 2.0}
    }
    SubShader {
        Tags { "RenderType"="Opaque" }
        Cull Off
        CGPROGRAM
        #pragma surface surf Standard vertex:vert
        float _WindStrength, _WindSpeed;
        fixed4 _BaseColor, _TipColor;
        struct Input { float2 uv_MainTex; };
        void vert(inout appdata_full v) {
            float sway = sin(v.vertex.x * _WindSpeed + _Time.y) * _WindStrength * v.texcoord.y;
            v.vertex.x += sway;
        }
        void surf(Input IN, inout SurfaceOutputStandard o) {
            o.Albedo = lerp(_BaseColor.rgb, _TipColor.rgb, IN.uv_MainTex.y);
        }
        ENDCG
    }
}
`,
      glass: (p) => `Shader "Custom/Glass" {
    Properties {
        _Color ("Color", Color) = (1,1,1,0.15)
        _Smoothness ("Smoothness", Range(0,1)) = ${1.0 - (p.roughness as number ?? 0.05)}
    }
    SubShader {
        Tags { "Queue"="Transparent" "RenderType"="Transparent" }
        Blend SrcAlpha OneMinusSrcAlpha
        CGPROGRAM
        #pragma surface surf Standard alpha
        fixed4 _Color;
        half _Smoothness;
        struct Input { float2 uv_MainTex; };
        void surf(Input IN, inout SurfaceOutputStandard o) {
            o.Albedo = _Color.rgb;
            o.Alpha = _Color.a;
            o.Smoothness = _Smoothness;
        }
        ENDCG
    }
}
`,
      emissive: (p) => `Shader "Custom/Emissive" {
    Properties {
        _Color ("Color", Color) = (0,0,0,1)
        _EmissionColor ("Emission", Color) = (1, 0.27, 0, 1)
        _EmissionStrength ("Strength", Float) = ${p.intensity ?? 2.0}
    }
    SubShader {
        Tags { "RenderType"="Opaque" }
        CGPROGRAM
        #pragma surface surf Standard
        fixed4 _Color, _EmissionColor;
        float _EmissionStrength;
        struct Input { float2 uv_MainTex; };
        void surf(Input IN, inout SurfaceOutputStandard o) {
            o.Albedo = _Color.rgb;
            o.Emission = _EmissionColor.rgb * _EmissionStrength;
        }
        ENDCG
    }
}
`,
    },
  }

  registerTool({
    name: 'material_graph',
    description: 'Generate material/shader code for game engines. Supports PBR, toon, water, foliage, glass, and emissive materials for Three.js, Godot, and Unity.',
    parameters: {
      material_type: { type: 'string', description: 'Material type: pbr, toon, water, foliage, glass, emissive', required: true },
      engine: { type: 'string', description: 'Target engine: three, godot, unity', required: true },
      output_path: { type: 'string', description: 'Output file path (optional — prints to result if omitted)' },
      params: { type: 'string', description: 'JSON parameters for material customization (color, roughness, metalness, etc.)' },
    },
    tier: 'free',
    async execute(args) {
      const materialType = String(args.material_type).toLowerCase()
      const engine = String(args.engine).toLowerCase()
      const outputPath = args.output_path ? safePath(String(args.output_path)) : null
      let params: Record<string, unknown> = {}
      if (args.params) {
        try { params = JSON.parse(String(args.params)) } catch { return 'Error: params must be valid JSON' }
      }

      const engineMaterials = materialGenerators[engine]
      if (!engineMaterials) {
        return `Error: Unknown engine "${engine}". Supported: ${Object.keys(materialGenerators).join(', ')}`
      }
      const generator = engineMaterials[materialType]
      if (!generator) {
        return `Error: Unknown material_type "${materialType}" for ${engine}. Supported: ${Object.keys(engineMaterials).join(', ')}`
      }

      const code = generator(params)

      if (outputPath) {
        ensureDir(dirname(outputPath))
        writeFileSync(outputPath, code, 'utf-8')
        return `Generated ${materialType} material for ${engine} → ${outputPath} (${code.split('\n').length} lines)`
      }

      return `${materialType} material for ${engine}:\n\n${code}`
    },
  })

  // ── Tool 5: mesh_generate ──────────────────────────────────────────

  /** Generate OBJ mesh data: returns { vertices, normals, uvs, faces } */
  interface MeshData {
    vertices: number[][]    // [x, y, z]
    normals: number[][]     // [nx, ny, nz]
    uvs: number[][]         // [u, v]
    faces: number[][][]     // [[v, vt, vn], ...] per face (1-indexed)
  }

  type MeshGenerator = (params: Record<string, unknown>) => MeshData

  const meshGenerators: Record<string, MeshGenerator> = {
    plane(p) {
      const w = (p.width as number) ?? 1
      const h = (p.height as number) ?? 1
      const segW = (p.segments_x as number) ?? 1
      const segH = (p.segments_y as number) ?? 1
      const verts: number[][] = []
      const uvs: number[][] = []
      const normals: number[][] = [[0, 1, 0]]
      const faces: number[][][] = []

      for (let iy = 0; iy <= segH; iy++) {
        for (let ix = 0; ix <= segW; ix++) {
          const x = (ix / segW - 0.5) * w
          const z = (iy / segH - 0.5) * h
          verts.push([x, 0, z])
          uvs.push([ix / segW, iy / segH])
        }
      }
      for (let iy = 0; iy < segH; iy++) {
        for (let ix = 0; ix < segW; ix++) {
          const a = iy * (segW + 1) + ix + 1
          const b = a + 1
          const c = a + segW + 1
          const d = c + 1
          faces.push([[a, a, 1], [c, c, 1], [d, d, 1]])
          faces.push([[a, a, 1], [d, d, 1], [b, b, 1]])
        }
      }
      return { vertices: verts, normals, uvs, faces }
    },

    cube(p) {
      const s = ((p.size as number) ?? 1) / 2
      const verts = [
        [-s,-s, s], [ s,-s, s], [ s, s, s], [-s, s, s],  // front
        [ s,-s,-s], [-s,-s,-s], [-s, s,-s], [ s, s,-s],  // back
        [-s, s, s], [ s, s, s], [ s, s,-s], [-s, s,-s],  // top
        [-s,-s,-s], [ s,-s,-s], [ s,-s, s], [-s,-s, s],  // bottom
        [ s,-s, s], [ s,-s,-s], [ s, s,-s], [ s, s, s],  // right
        [-s,-s,-s], [-s,-s, s], [-s, s, s], [-s, s,-s],  // left
      ]
      const normals = [
        [0,0,1], [0,0,-1], [0,1,0], [0,-1,0], [1,0,0], [-1,0,0],
      ]
      const uvs = [[0,0],[1,0],[1,1],[0,1]]
      const faces: number[][][] = []
      for (let f = 0; f < 6; f++) {
        const vi = f * 4
        const ni = f + 1
        faces.push([[vi+1, 1, ni], [vi+2, 2, ni], [vi+3, 3, ni]])
        faces.push([[vi+1, 1, ni], [vi+3, 3, ni], [vi+4, 4, ni]])
      }
      return { vertices: verts, normals, uvs, faces }
    },

    sphere(p) {
      const radius = (p.radius as number) ?? 0.5
      const rings = Math.min((p.rings as number) ?? 16, 256)
      const segments = Math.min((p.segments as number) ?? 32, 512)
      const verts: number[][] = []
      const norms: number[][] = []
      const uvs: number[][] = []
      const faces: number[][][] = []

      for (let iy = 0; iy <= rings; iy++) {
        const v = iy / rings
        const phi = v * Math.PI
        for (let ix = 0; ix <= segments; ix++) {
          const u = ix / segments
          const theta = u * 2 * Math.PI
          const x = Math.cos(theta) * Math.sin(phi)
          const y = Math.cos(phi)
          const z = Math.sin(theta) * Math.sin(phi)
          verts.push([x * radius, y * radius, z * radius])
          norms.push([x, y, z])
          uvs.push([u, v])
        }
      }
      for (let iy = 0; iy < rings; iy++) {
        for (let ix = 0; ix < segments; ix++) {
          const a = iy * (segments + 1) + ix + 1
          const b = a + 1
          const c = a + segments + 1
          const d = c + 1
          if (iy !== 0) faces.push([[a, a, a], [c, c, c], [d, d, d]])
          if (iy !== rings - 1) faces.push([[a, a, a], [d, d, d], [b, b, b]])
        }
      }
      return { vertices: verts, normals: norms, uvs, faces }
    },

    cylinder(p) {
      const radiusTop = (p.radius_top as number) ?? 0.5
      const radiusBot = (p.radius_bottom as number) ?? 0.5
      const height = (p.height as number) ?? 1
      const segments = (p.segments as number) ?? 16
      const verts: number[][] = []
      const norms: number[][] = []
      const uvs: number[][] = []
      const faces: number[][][] = []
      const halfH = height / 2

      // Side
      for (let iy = 0; iy <= 1; iy++) {
        const r = iy === 0 ? radiusTop : radiusBot
        const y = iy === 0 ? halfH : -halfH
        for (let ix = 0; ix <= segments; ix++) {
          const theta = (ix / segments) * 2 * Math.PI
          const cos = Math.cos(theta), sin = Math.sin(theta)
          verts.push([r * cos, y, r * sin])
          const slope = (radiusBot - radiusTop) / height
          const len = Math.sqrt(1 + slope * slope)
          norms.push([cos / len, slope / len, sin / len])
          uvs.push([ix / segments, iy])
        }
      }
      for (let ix = 0; ix < segments; ix++) {
        const a = ix + 1, b = a + 1
        const c = a + segments + 1, d = c + 1
        faces.push([[a, a, a], [c, c, c], [d, d, d]])
        faces.push([[a, a, a], [d, d, d], [b, b, b]])
      }
      // Caps
      const topCenter = verts.length + 1
      verts.push([0, halfH, 0]); norms.push([0, 1, 0]); uvs.push([0.5, 0.5])
      for (let ix = 0; ix <= segments; ix++) {
        const theta = (ix / segments) * 2 * Math.PI
        verts.push([radiusTop * Math.cos(theta), halfH, radiusTop * Math.sin(theta)])
        norms.push([0, 1, 0])
        uvs.push([Math.cos(theta) * 0.5 + 0.5, Math.sin(theta) * 0.5 + 0.5])
      }
      for (let ix = 0; ix < segments; ix++) {
        faces.push([[topCenter, topCenter, topCenter], [topCenter + ix + 1, topCenter + ix + 1, topCenter + ix + 1], [topCenter + ix + 2, topCenter + ix + 2, topCenter + ix + 2]])
      }
      const botCenter = verts.length + 1
      verts.push([0, -halfH, 0]); norms.push([0, -1, 0]); uvs.push([0.5, 0.5])
      for (let ix = 0; ix <= segments; ix++) {
        const theta = (ix / segments) * 2 * Math.PI
        verts.push([radiusBot * Math.cos(theta), -halfH, radiusBot * Math.sin(theta)])
        norms.push([0, -1, 0])
        uvs.push([Math.cos(theta) * 0.5 + 0.5, Math.sin(theta) * 0.5 + 0.5])
      }
      for (let ix = 0; ix < segments; ix++) {
        faces.push([[botCenter, botCenter, botCenter], [botCenter + ix + 2, botCenter + ix + 2, botCenter + ix + 2], [botCenter + ix + 1, botCenter + ix + 1, botCenter + ix + 1]])
      }
      return { vertices: verts, normals: norms, uvs, faces }
    },

    torus(p) {
      const R = (p.radius as number) ?? 0.5
      const r = (p.tube as number) ?? 0.2
      const radSeg = (p.radial_segments as number) ?? 16
      const tubSeg = (p.tubular_segments as number) ?? 32
      const verts: number[][] = []
      const norms: number[][] = []
      const uvs: number[][] = []
      const faces: number[][][] = []

      for (let j = 0; j <= radSeg; j++) {
        for (let i = 0; i <= tubSeg; i++) {
          const u = (i / tubSeg) * 2 * Math.PI
          const v = (j / radSeg) * 2 * Math.PI
          const x = (R + r * Math.cos(v)) * Math.cos(u)
          const y = r * Math.sin(v)
          const z = (R + r * Math.cos(v)) * Math.sin(u)
          verts.push([x, y, z])
          const cx = R * Math.cos(u), cz = R * Math.sin(u)
          const nx = x - cx, ny = y, nz = z - cz
          const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
          norms.push([nx / len, ny / len, nz / len])
          uvs.push([i / tubSeg, j / radSeg])
        }
      }
      for (let j = 0; j < radSeg; j++) {
        for (let i = 0; i < tubSeg; i++) {
          const a = j * (tubSeg + 1) + i + 1
          const b = a + 1
          const c = a + tubSeg + 1
          const d = c + 1
          faces.push([[a, a, a], [c, c, c], [d, d, d]])
          faces.push([[a, a, a], [d, d, d], [b, b, b]])
        }
      }
      return { vertices: verts, normals: norms, uvs, faces }
    },

    heightmap(p) {
      const w = (p.width as number) ?? 10
      const h = (p.depth as number) ?? 10
      const segW = (p.segments_x as number) ?? 32
      const segH = (p.segments_y as number) ?? 32
      const maxHeight = (p.max_height as number) ?? 2
      const seed = (p.seed as number) ?? 42
      const rng = seededRng(seed)

      // Generate a simple noise heightmap
      const hmap: number[][] = []
      for (let iy = 0; iy <= segH; iy++) {
        hmap[iy] = []
        for (let ix = 0; ix <= segW; ix++) {
          // Simple value noise with interpolation
          const nx = ix / segW * 4, ny = iy / segH * 4
          const base = rng() * 0.5 + Math.sin(nx * 1.5) * 0.25 + Math.cos(ny * 1.3) * 0.25
          hmap[iy][ix] = base * maxHeight
        }
      }

      const verts: number[][] = []
      const norms: number[][] = []
      const uvs: number[][] = []
      const faces: number[][][] = []

      for (let iy = 0; iy <= segH; iy++) {
        for (let ix = 0; ix <= segW; ix++) {
          const x = (ix / segW - 0.5) * w
          const z = (iy / segH - 0.5) * h
          const y = hmap[iy][ix]
          verts.push([x, y, z])
          uvs.push([ix / segW, iy / segH])
          // Approximate normal via finite differences
          const hL = ix > 0 ? hmap[iy][ix - 1] : y
          const hR = ix < segW ? hmap[iy][ix + 1] : y
          const hD = iy > 0 ? hmap[iy - 1][ix] : y
          const hU = iy < segH ? hmap[iy + 1][ix] : y
          const nx = hL - hR, nz = hD - hU, ny = 2.0
          const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
          norms.push([nx / len, ny / len, nz / len])
        }
      }
      for (let iy = 0; iy < segH; iy++) {
        for (let ix = 0; ix < segW; ix++) {
          const a = iy * (segW + 1) + ix + 1
          const b = a + 1
          const c = a + segW + 1
          const d = c + 1
          faces.push([[a, a, a], [c, c, c], [d, d, d]])
          faces.push([[a, a, a], [d, d, d], [b, b, b]])
        }
      }
      return { vertices: verts, normals: norms, uvs, faces }
    },

    terrain(p) {
      // Terrain is heightmap with multi-octave noise
      const w = (p.width as number) ?? 50
      const h = (p.depth as number) ?? 50
      const segW = (p.segments_x as number) ?? 64
      const segH = (p.segments_y as number) ?? 64
      const maxHeight = (p.max_height as number) ?? 8
      const octaves = (p.octaves as number) ?? 4
      const seed = (p.seed as number) ?? 123
      const rng = seededRng(seed)

      // Generate noise grid at multiple octaves
      const hmap: number[][] = []
      // Pre-generate random offsets per octave
      const offsets = Array.from({ length: octaves }, () => [rng() * 100, rng() * 100])

      for (let iy = 0; iy <= segH; iy++) {
        hmap[iy] = []
        for (let ix = 0; ix <= segW; ix++) {
          let val = 0, amp = 1, freq = 1, totalAmp = 0
          const nx = ix / segW, ny = iy / segH
          for (let o = 0; o < octaves; o++) {
            const x = nx * freq * 4 + offsets[o][0]
            const y = ny * freq * 4 + offsets[o][1]
            // Simple pseudo-noise using sin combinations
            val += amp * (Math.sin(x * 2.1 + y * 1.7) * 0.5 + 0.5)
            totalAmp += amp
            amp *= 0.5
            freq *= 2
          }
          hmap[iy][ix] = (val / totalAmp) * maxHeight
        }
      }

      const verts: number[][] = []
      const norms: number[][] = []
      const uvs: number[][] = []
      const faces: number[][][] = []

      for (let iy = 0; iy <= segH; iy++) {
        for (let ix = 0; ix <= segW; ix++) {
          verts.push([(ix / segW - 0.5) * w, hmap[iy][ix], (iy / segH - 0.5) * h])
          uvs.push([ix / segW, iy / segH])
          const hL = ix > 0 ? hmap[iy][ix - 1] : hmap[iy][ix]
          const hR = ix < segW ? hmap[iy][ix + 1] : hmap[iy][ix]
          const hD = iy > 0 ? hmap[iy - 1][ix] : hmap[iy][ix]
          const hU = iy < segH ? hmap[iy + 1][ix] : hmap[iy][ix]
          const nx = hL - hR, nz = hD - hU, ny = 2.0
          const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
          norms.push([nx / len, ny / len, nz / len])
        }
      }
      for (let iy = 0; iy < segH; iy++) {
        for (let ix = 0; ix < segW; ix++) {
          const a = iy * (segW + 1) + ix + 1
          const b = a + 1
          const c = a + segW + 1
          const d = c + 1
          faces.push([[a, a, a], [c, c, c], [d, d, d]])
          faces.push([[a, a, a], [d, d, d], [b, b, b]])
        }
      }
      return { vertices: verts, normals: norms, uvs, faces }
    },
  }

  /** Serialize MeshData to OBJ format string */
  function meshToObj(data: MeshData, name = 'mesh'): string {
    const lines = [`# Generated by kbot mesh_generate`, `o ${name}`, '']
    for (const [x, y, z] of data.vertices) {
      lines.push(`v ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}`)
    }
    lines.push('')
    for (const [u, v] of data.uvs) {
      lines.push(`vt ${u.toFixed(6)} ${v.toFixed(6)}`)
    }
    lines.push('')
    for (const [nx, ny, nz] of data.normals) {
      lines.push(`vn ${nx.toFixed(6)} ${ny.toFixed(6)} ${nz.toFixed(6)}`)
    }
    lines.push('')
    for (const face of data.faces) {
      lines.push('f ' + face.map(([vi, vti, vni]) => `${vi}/${vti}/${vni}`).join(' '))
    }
    lines.push('')
    return lines.join('\n')
  }

  registerTool({
    name: 'mesh_generate',
    description: 'Procedural OBJ mesh generation. Supports plane, cube, sphere, cylinder, torus, heightmap, and terrain shapes with configurable parameters. Outputs valid OBJ with vertices, normals, and UVs.',
    parameters: {
      shape: { type: 'string', description: 'Shape: plane, cube, sphere, cylinder, torus, heightmap, terrain', required: true },
      output_path: { type: 'string', description: 'Output .obj file path', required: true },
      params: { type: 'string', description: 'JSON parameters (e.g., {"radius": 1, "segments": 32, "seed": 42})' },
    },
    tier: 'free',
    async execute(args) {
      const shape = String(args.shape).toLowerCase()
      const outputPath = safePath(String(args.output_path))
      let params: Record<string, unknown> = {}
      if (args.params) {
        try { params = JSON.parse(String(args.params)) } catch { return 'Error: params must be valid JSON' }
      }

      const generator = meshGenerators[shape]
      if (!generator) {
        return `Error: Unknown shape "${shape}". Supported: ${Object.keys(meshGenerators).join(', ')}`
      }

      const data = generator(params)
      const obj = meshToObj(data, shape)

      ensureDir(dirname(outputPath))
      writeFileSync(outputPath, obj, 'utf-8')

      return `Generated ${shape} mesh → ${outputPath}\nVertices: ${data.vertices.length} | Normals: ${data.normals.length} | UVs: ${data.uvs.length} | Faces: ${data.faces.length}\nFile size: ${Buffer.byteLength(obj)} bytes`
    },
  })

  // tools 6-16 appended below
  // ── Tool 6: Sprite Atlas Packer ────────────────────────────────────
  registerTool({
    name: 'sprite_pack',
    description: 'Pack multiple sprite images into a single texture atlas with metadata. Uses maxrects bin-packing for optimal layout. Outputs atlas image via ImageMagick and JSON/engine-specific metadata.',
    parameters: {
      input_dir: { type: 'string', description: 'Directory containing sprite images (png/jpg/webp)', required: true },
      output_image: { type: 'string', description: 'Output atlas image path (e.g., atlas.png)', required: true },
      output_data: { type: 'string', description: 'Output metadata file path (e.g., atlas.json)', required: true },
      algorithm: { type: 'string', description: 'Packing algorithm: shelf, maxrects, or grid (default: maxrects)' },
      max_size: { type: 'number', description: 'Maximum atlas dimension in pixels (default: 2048)' },
      padding: { type: 'number', description: 'Padding between sprites in pixels (default: 2)' },
      format: { type: 'string', description: 'Metadata format: json, phaser, godot, unity, pixi (default: json)' },
    },
    tier: 'free',
    timeout: 120_000,
    async execute(args) {
      const inputDir = String(args.input_dir)
      const outputImage = safePath(String(args.output_image))
      const outputData = safePath(String(args.output_data))
      const algorithm = String(args.algorithm || 'maxrects') as 'shelf' | 'maxrects' | 'grid'
      const maxSize = typeof args.max_size === 'number' ? args.max_size : 2048
      const padding = typeof args.padding === 'number' ? args.padding : 2
      const format = String(args.format || 'json') as 'json' | 'phaser' | 'godot' | 'unity' | 'pixi'

      if (!existsSync(inputDir)) return `Error: Input directory not found: ${inputDir}`
      if (!['shelf', 'maxrects', 'grid'].includes(algorithm)) return `Error: Invalid algorithm "${algorithm}". Use shelf, maxrects, or grid.`
      if (!['json', 'phaser', 'godot', 'unity', 'pixi'].includes(format)) return `Error: Invalid format "${format}". Use json, phaser, godot, unity, or pixi.`

      // Discover sprite files
      const validExts = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'])
      const files = readdirSync(inputDir)
        .filter(f => validExts.has(extname(f).toLowerCase()))
        .sort()

      if (files.length === 0) return `Error: No image files found in ${inputDir}`

      // Get dimensions of each sprite via ImageMagick identify
      interface SpriteInfo {
        name: string
        path: string
        width: number
        height: number
        x: number
        y: number
      }

      const sprites: SpriteInfo[] = []
      for (const file of files) {
        const filePath = join(inputDir, file)
        try {
          const identifyOut = await shell('identify', ['-format', '%w %h', filePath])
          const [w, h] = identifyOut.trim().split(/\s+/).map(Number)
          if (!w || !h) continue
          sprites.push({
            name: basename(file, extname(file)),
            path: filePath,
            width: w,
            height: h,
            x: 0,
            y: 0,
          })
        } catch {
          // Skip files that can't be identified
        }
      }

      if (sprites.length === 0) return `Error: Could not read any valid images from ${inputDir}`

      // ── MaxRects Bin Packing ──
      interface Rect { x: number; y: number; width: number; height: number }

      function maxrectsPack(items: SpriteInfo[], maxW: number, maxH: number, pad: number): { width: number; height: number } {
        // Sort by max side descending for better packing
        items.sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height))

        const freeRects: Rect[] = [{ x: 0, y: 0, width: maxW, height: maxH }]

        function findBestRect(w: number, h: number): Rect | null {
          let bestRect: Rect | null = null
          let bestShortSide = Infinity

          for (const fr of freeRects) {
            if (w <= fr.width && h <= fr.height) {
              const shortSide = Math.min(fr.width - w, fr.height - h)
              if (shortSide < bestShortSide) {
                bestShortSide = shortSide
                bestRect = { x: fr.x, y: fr.y, width: w, height: h }
              }
            }
          }
          return bestRect
        }

        function splitFreeRects(placed: Rect): void {
          const newFree: Rect[] = []
          for (let i = freeRects.length - 1; i >= 0; i--) {
            const fr = freeRects[i]
            // Check overlap
            if (placed.x >= fr.x + fr.width || placed.x + placed.width <= fr.x ||
                placed.y >= fr.y + fr.height || placed.y + placed.height <= fr.y) {
              continue // No overlap
            }
            // Remove overlapping free rect and split into up to 4 new ones
            freeRects.splice(i, 1)

            // Left
            if (placed.x > fr.x) {
              newFree.push({ x: fr.x, y: fr.y, width: placed.x - fr.x, height: fr.height })
            }
            // Right
            if (placed.x + placed.width < fr.x + fr.width) {
              newFree.push({ x: placed.x + placed.width, y: fr.y, width: (fr.x + fr.width) - (placed.x + placed.width), height: fr.height })
            }
            // Top
            if (placed.y > fr.y) {
              newFree.push({ x: fr.x, y: fr.y, width: fr.width, height: placed.y - fr.y })
            }
            // Bottom
            if (placed.y + placed.height < fr.y + fr.height) {
              newFree.push({ x: fr.x, y: placed.y + placed.height, width: fr.width, height: (fr.y + fr.height) - (placed.y + placed.height) })
            }
          }
          freeRects.push(...newFree)

          // Remove redundant (contained) free rects
          for (let i = freeRects.length - 1; i >= 0; i--) {
            for (let j = freeRects.length - 1; j >= 0; j--) {
              if (i === j) continue
              const a = freeRects[i], b = freeRects[j]
              if (a && b && a.x >= b.x && a.y >= b.y &&
                  a.x + a.width <= b.x + b.width &&
                  a.y + a.height <= b.y + b.height) {
                freeRects.splice(i, 1)
                break
              }
            }
          }
        }

        let usedW = 0, usedH = 0
        for (const sprite of items) {
          const pw = sprite.width + pad
          const ph = sprite.height + pad
          const rect = findBestRect(pw, ph)
          if (!rect) throw new Error(`Cannot fit sprite "${sprite.name}" (${sprite.width}x${sprite.height}) in ${maxW}x${maxH} atlas`)
          sprite.x = rect.x + Math.floor(pad / 2)
          sprite.y = rect.y + Math.floor(pad / 2)
          splitFreeRects(rect)
          usedW = Math.max(usedW, sprite.x + sprite.width)
          usedH = Math.max(usedH, sprite.y + sprite.height)
        }
        return { width: usedW, height: usedH }
      }

      function shelfPack(items: SpriteInfo[], maxW: number, _maxH: number, pad: number): { width: number; height: number } {
        items.sort((a, b) => b.height - a.height)
        let shelfY = 0, shelfH = 0, curX = 0, usedW = 0
        for (const sprite of items) {
          const pw = sprite.width + pad
          const ph = sprite.height + pad
          if (curX + pw > maxW) {
            shelfY += shelfH
            shelfH = 0
            curX = 0
          }
          sprite.x = curX + Math.floor(pad / 2)
          sprite.y = shelfY + Math.floor(pad / 2)
          curX += pw
          shelfH = Math.max(shelfH, ph)
          usedW = Math.max(usedW, curX)
        }
        return { width: usedW, height: shelfY + shelfH }
      }

      function gridPack(items: SpriteInfo[], _maxW: number, _maxH: number, pad: number): { width: number; height: number } {
        const maxSpriteW = Math.max(...items.map(s => s.width))
        const maxSpriteH = Math.max(...items.map(s => s.height))
        const cellW = maxSpriteW + pad
        const cellH = maxSpriteH + pad
        const cols = Math.ceil(Math.sqrt(items.length))
        for (let i = 0; i < items.length; i++) {
          const col = i % cols
          const row = Math.floor(i / cols)
          items[i].x = col * cellW + Math.floor(pad / 2)
          items[i].y = row * cellH + Math.floor(pad / 2)
        }
        const rows = Math.ceil(items.length / cols)
        return { width: cols * cellW, height: rows * cellH }
      }

      // Run the chosen packing algorithm
      let atlasSize: { width: number; height: number }
      try {
        if (algorithm === 'shelf') {
          atlasSize = shelfPack(sprites, maxSize, maxSize, padding)
        } else if (algorithm === 'grid') {
          atlasSize = gridPack(sprites, maxSize, maxSize, padding)
        } else {
          atlasSize = maxrectsPack(sprites, maxSize, maxSize, padding)
        }
      } catch (err) {
        return `Error packing sprites: ${err instanceof Error ? err.message : String(err)}`
      }

      // Round atlas dimensions up to power of 2 for GPU compatibility
      function nextPow2(v: number): number {
        let p = 1
        while (p < v) p <<= 1
        return p
      }
      const atlasW = nextPow2(atlasSize.width)
      const atlasH = nextPow2(atlasSize.height)

      // Composite atlas using ImageMagick
      ensureDir(dirname(outputImage))
      const compositeArgs: string[] = [
        '-size', `${atlasW}x${atlasH}`, 'xc:transparent',
      ]
      for (const sprite of sprites) {
        compositeArgs.push(
          '(', sprite.path, ')',
          '-geometry', `+${sprite.x}+${sprite.y}`,
          '-composite',
        )
      }
      compositeArgs.push(outputImage)

      try {
        await shell('convert', compositeArgs, 120_000)
      } catch (err) {
        return `Error compositing atlas: ${err instanceof Error ? err.message : String(err)}\nIs ImageMagick installed?`
      }

      // Generate metadata in requested format
      const totalSpriteArea = sprites.reduce((s, sp) => s + sp.width * sp.height, 0)
      const efficiency = ((totalSpriteArea / (atlasW * atlasH)) * 100).toFixed(1)

      let metadata: string

      if (format === 'phaser') {
        const phaserData = {
          textures: [{
            image: basename(outputImage),
            format: 'RGBA8888',
            size: { w: atlasW, h: atlasH },
            scale: 1,
            frames: sprites.map(s => ({
              filename: s.name,
              rotated: false,
              trimmed: false,
              sourceSize: { w: s.width, h: s.height },
              spriteSourceSize: { x: 0, y: 0, w: s.width, h: s.height },
              frame: { x: s.x, y: s.y, w: s.width, h: s.height },
            })),
          }],
        }
        metadata = JSON.stringify(phaserData, null, 2)
      } else if (format === 'godot') {
        let tres = `[gd_resource type="AtlasTexture" load_steps=${sprites.length + 1} format=3]\n\n`
        tres += `[ext_resource type="Texture2D" path="res://${basename(outputImage)}" id="1"]\n\n`
        for (let i = 0; i < sprites.length; i++) {
          const s = sprites[i]
          tres += `[sub_resource type="AtlasTexture" id="${i + 2}"]\n`
          tres += `atlas = ExtResource("1")\n`
          tres += `region = Rect2(${s.x}, ${s.y}, ${s.width}, ${s.height})\n\n`
        }
        metadata = tres
      } else if (format === 'unity') {
        const unityMeta = {
          TextureImporter: {
            spriteMode: 2, // Multiple
            spritesheet: {
              sprites: sprites.map(s => ({
                name: s.name,
                rect: { x: s.x, y: atlasH - s.y - s.height, width: s.width, height: s.height }, // Unity Y is flipped
                alignment: 0,
                pivot: { x: 0.5, y: 0.5 },
                border: { x: 0, y: 0, z: 0, w: 0 },
              })),
            },
          },
        }
        metadata = JSON.stringify(unityMeta, null, 2)
      } else if (format === 'pixi') {
        const pixiData = {
          frames: Object.fromEntries(sprites.map(s => [s.name, {
            frame: { x: s.x, y: s.y, w: s.width, h: s.height },
            rotated: false,
            trimmed: false,
            spriteSourceSize: { x: 0, y: 0, w: s.width, h: s.height },
            sourceSize: { w: s.width, h: s.height },
          }])),
          meta: {
            app: 'kbot sprite_pack',
            image: basename(outputImage),
            format: 'RGBA8888',
            size: { w: atlasW, h: atlasH },
            scale: '1',
          },
        }
        metadata = JSON.stringify(pixiData, null, 2)
      } else {
        // Generic JSON
        const jsonData = {
          atlas: { width: atlasW, height: atlasH, image: basename(outputImage) },
          sprites: sprites.map(s => ({
            name: s.name,
            x: s.x,
            y: s.y,
            width: s.width,
            height: s.height,
          })),
          meta: {
            algorithm,
            padding,
            spriteCount: sprites.length,
            efficiency: `${efficiency}%`,
            generator: 'kbot sprite_pack',
          },
        }
        metadata = JSON.stringify(jsonData, null, 2)
      }

      ensureDir(dirname(outputData))
      writeFileSync(outputData, metadata)

      return `Sprite atlas packed successfully:
  Atlas: ${outputImage} (${atlasW}x${atlasH})
  Metadata: ${outputData} (${format} format)
  Sprites: ${sprites.length}
  Algorithm: ${algorithm}
  Packing efficiency: ${efficiency}%
  Sprites: ${sprites.map(s => `${s.name} (${s.width}x${s.height} @ ${s.x},${s.y})`).join(', ')}`
    },
  })

  // ── Tool 7: Physics Setup Generator ──────────────────────────────────
  registerTool({
    name: 'physics_setup',
    description: 'Generate complete physics configuration code for game engines. Supports rigidbody, softbody, ragdoll (full humanoid skeleton), vehicle (suspension/wheels/steering), cloth, and joint systems across 7 physics engines.',
    parameters: {
      type: { type: 'string', description: 'Physics type: rigidbody, softbody, ragdoll, vehicle, cloth, joints', required: true },
      engine: { type: 'string', description: 'Physics engine: godot, unity, unreal, bevy, cannon, rapier, matter (default: rapier)' },
      params: { type: 'string', description: 'JSON params (mass, friction, restitution, etc.)' },
      output_path: { type: 'string', description: 'Output file path for generated code', required: true },
    },
    tier: 'free',
    async execute(args) {
      const type = String(args.type).toLowerCase() as 'rigidbody' | 'softbody' | 'ragdoll' | 'vehicle' | 'cloth' | 'joints'
      const engine = String(args.engine || 'rapier').toLowerCase()
      let params: any = {}
      try { params = args.params ? JSON.parse(String(args.params)) : {} } catch { return 'Error: params must be valid JSON' }
      const outputPath = safePath(String(args.output_path))

      const validTypes = ['rigidbody', 'softbody', 'ragdoll', 'vehicle', 'cloth', 'joints']
      const validEngines = ['godot', 'unity', 'unreal', 'bevy', 'cannon', 'rapier', 'matter']
      if (!validTypes.includes(type)) return `Error: Invalid type "${type}". Use: ${validTypes.join(', ')}`
      if (!validEngines.includes(engine)) return `Error: Invalid engine "${engine}". Use: ${validEngines.join(', ')}`

      const mass = params.mass ?? 1.0
      const friction = params.friction ?? 0.5
      const restitution = params.restitution ?? 0.3
      const gravity = params.gravity ?? -9.81
      const linearDamping = params.linear_damping ?? 0.05
      const angularDamping = params.angular_damping ?? 0.05

      let code = ''
      let fileExt = 'ts'

      // ── Rigidbody ──
      if (type === 'rigidbody') {
        if (engine === 'rapier') {
          code = `// Rapier3D Rigidbody Setup — generated by kbot
import RAPIER from '@dimforge/rapier3d-compat';

await RAPIER.init();

const gravity = new RAPIER.Vector3(0.0, ${gravity}, 0.0);
const world = new RAPIER.World(gravity);

// Create ground (static)
const groundColliderDesc = RAPIER.ColliderDesc.cuboid(50.0, 0.1, 50.0)
  .setFriction(${friction})
  .setRestitution(${restitution});
world.createCollider(groundColliderDesc);

// Create dynamic rigidbody
const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
  .setTranslation(0.0, 5.0, 0.0)
  .setLinearDamping(${linearDamping})
  .setAngularDamping(${angularDamping});
const rigidBody = world.createRigidBody(rigidBodyDesc);

const colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5)
  .setMass(${mass})
  .setFriction(${friction})
  .setRestitution(${restitution});
world.createCollider(colliderDesc, rigidBody);

// Apply initial force
rigidBody.applyImpulse(new RAPIER.Vector3(0.0, 10.0, 0.0), true);

// Simulation loop
function step() {
  world.step();
  const pos = rigidBody.translation();
  const rot = rigidBody.rotation();
  console.log(\`Position: (\${pos.x.toFixed(3)}, \${pos.y.toFixed(3)}, \${pos.z.toFixed(3)})\`);
  console.log(\`Rotation: (\${rot.x.toFixed(3)}, \${rot.y.toFixed(3)}, \${rot.z.toFixed(3)}, \${rot.w.toFixed(3)})\`);
  requestAnimationFrame(step);
}
step();
`
        } else if (engine === 'cannon') {
          code = `// Cannon.js Rigidbody Setup — generated by kbot
import * as CANNON from 'cannon-es';

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, ${gravity}, 0) });

// Ground plane
const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
groundBody.material = new CANNON.Material({ friction: ${friction}, restitution: ${restitution} });
world.addBody(groundBody);

// Dynamic body
const body = new CANNON.Body({
  mass: ${mass},
  position: new CANNON.Vec3(0, 5, 0),
  shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)),
  linearDamping: ${linearDamping},
  angularDamping: ${angularDamping},
  material: new CANNON.Material({ friction: ${friction}, restitution: ${restitution} }),
});
world.addBody(body);

// Contact material for ground-body interaction
const contactMaterial = new CANNON.ContactMaterial(groundBody.material!, body.material!, {
  friction: ${friction},
  restitution: ${restitution},
});
world.addContactMaterial(contactMaterial);

// Apply impulse
body.applyImpulse(new CANNON.Vec3(0, 10, 0));

// Step simulation
const fixedTimeStep = 1.0 / 60.0;
function animate() {
  world.step(fixedTimeStep);
  console.log(\`Position: \${body.position.x.toFixed(3)}, \${body.position.y.toFixed(3)}, \${body.position.z.toFixed(3)}\`);
  requestAnimationFrame(animate);
}
animate();
`
        } else if (engine === 'matter') {
          code = `// Matter.js 2D Rigidbody Setup — generated by kbot
import Matter from 'matter-js';

const { Engine, Render, Runner, Bodies, Composite, Body } = Matter;

const engine = Engine.create({ gravity: { x: 0, y: ${-gravity / 9.81} } });
const render = Render.create({
  element: document.body,
  engine: engine,
  options: { width: 800, height: 600, wireframes: false },
});

// Ground
const ground = Bodies.rectangle(400, 590, 800, 20, {
  isStatic: true,
  friction: ${friction},
  restitution: ${restitution},
});

// Dynamic box
const box = Bodies.rectangle(400, 200, 50, 50, {
  mass: ${mass},
  friction: ${friction},
  restitution: ${restitution},
  frictionAir: ${linearDamping},
});

Composite.add(engine.world, [ground, box]);

// Apply force
Body.applyForce(box, box.position, { x: 0, y: -0.05 });

Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);
`
        } else if (engine === 'godot') {
          fileExt = 'gd'
          code = `# Godot 4 RigidBody3D Setup — generated by kbot
extends RigidBody3D

@export var initial_impulse := Vector3(0, 10, 0)

func _ready() -> void:
    mass = ${mass}
    gravity_scale = ${-gravity / 9.81}
    linear_damp = ${linearDamping}
    angular_damp = ${angularDamping}
    physics_material_override = PhysicsMaterial.new()
    physics_material_override.friction = ${friction}
    physics_material_override.bounce = ${restitution}

    # Add collision shape
    var shape := BoxShape3D.new()
    shape.size = Vector3(1, 1, 1)
    var col := CollisionShape3D.new()
    col.shape = shape
    add_child(col)

    # Apply initial impulse
    apply_central_impulse(initial_impulse)

func _physics_process(delta: float) -> void:
    # Access position and velocity each frame
    var pos := global_position
    var vel := linear_velocity
    # Add custom behavior here
`
        } else if (engine === 'unity') {
          fileExt = 'cs'
          code = `// Unity Rigidbody Setup — generated by kbot
using UnityEngine;

[RequireComponent(typeof(Rigidbody))]
[RequireComponent(typeof(BoxCollider))]
public class PhysicsSetup : MonoBehaviour
{
    [SerializeField] private float initialImpulseY = 10f;

    private Rigidbody rb;

    void Start()
    {
        rb = GetComponent<Rigidbody>();
        rb.mass = ${mass}f;
        rb.linearDamping = ${linearDamping}f;
        rb.angularDamping = ${angularDamping}f;
        rb.useGravity = true;
        Physics.gravity = new Vector3(0f, ${gravity}f, 0f);

        var collider = GetComponent<BoxCollider>();
        var material = new PhysicsMaterial();
        material.dynamicFriction = ${friction}f;
        material.staticFriction = ${friction}f;
        material.bounciness = ${restitution}f;
        material.frictionCombine = PhysicsMaterialCombine.Average;
        material.bounceCombine = PhysicsMaterialCombine.Average;
        collider.material = material;

        rb.AddForce(Vector3.up * initialImpulseY, ForceMode.Impulse);
    }

    void FixedUpdate()
    {
        Vector3 pos = transform.position;
        Vector3 vel = rb.linearVelocity;
        // Add custom physics behavior here
    }
}
`
        } else if (engine === 'unreal') {
          fileExt = 'cpp'
          code = `// Unreal Engine Rigidbody Setup — generated by kbot
#include "PhysicsRigidBody.h"
#include "Components/StaticMeshComponent.h"
#include "PhysicalMaterials/PhysicalMaterial.h"

APhysicsRigidBody::APhysicsRigidBody()
{
    PrimaryActorTick.bCanEverTick = true;

    MeshComp = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("MeshComp"));
    RootComponent = MeshComp;

    MeshComp->SetSimulatePhysics(true);
    MeshComp->SetMassOverrideInKg(NAME_None, ${mass}f);
    MeshComp->SetLinearDamping(${linearDamping}f);
    MeshComp->SetAngularDamping(${angularDamping}f);
    MeshComp->SetEnableGravity(true);

    // Physical material
    UPhysicalMaterial* PhysMat = NewObject<UPhysicalMaterial>();
    PhysMat->Friction = ${friction}f;
    PhysMat->Restitution = ${restitution}f;
    MeshComp->SetPhysMaterialOverride(PhysMat);
}

void APhysicsRigidBody::BeginPlay()
{
    Super::BeginPlay();
    MeshComp->AddImpulse(FVector(0.f, 0.f, 1000.f));
}

void APhysicsRigidBody::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);
    FVector Pos = GetActorLocation();
    FVector Vel = MeshComp->GetPhysicsLinearVelocity();
    // Add custom behavior
}
`
        } else if (engine === 'bevy') {
          fileExt = 'rs'
          code = `// Bevy + Rapier Rigidbody Setup — generated by kbot
use bevy::prelude::*;
use bevy_rapier3d::prelude::*;

fn main() {
    App::new()
        .add_plugins(DefaultPlugins)
        .add_plugins(RapierPhysicsPlugin::<NoUserData>::default())
        .add_plugins(RapierDebugRenderPlugin::default())
        .insert_resource(RapierConfiguration {
            gravity: Vec3::new(0.0, ${gravity}, 0.0),
            ..default()
        })
        .add_systems(Startup, setup)
        .run();
}

fn setup(mut commands: Commands, mut meshes: ResMut<Assets<Mesh>>, mut materials: ResMut<Assets<StandardMaterial>>) {
    // Camera
    commands.spawn(Camera3dBundle {
        transform: Transform::from_xyz(0.0, 10.0, 20.0).looking_at(Vec3::ZERO, Vec3::Y),
        ..default()
    });

    // Light
    commands.spawn(PointLightBundle {
        point_light: PointLight { intensity: 1500.0, ..default() },
        transform: Transform::from_xyz(4.0, 8.0, 4.0),
        ..default()
    });

    // Ground
    commands.spawn((
        PbrBundle {
            mesh: meshes.add(Plane3d::default().mesh().size(100.0, 100.0)),
            material: materials.add(Color::srgb(0.3, 0.5, 0.3)),
            ..default()
        },
        Collider::cuboid(50.0, 0.1, 50.0),
        Friction::coefficient(${friction}),
        Restitution::coefficient(${restitution}),
    ));

    // Dynamic rigidbody
    commands.spawn((
        PbrBundle {
            mesh: meshes.add(Cuboid::new(1.0, 1.0, 1.0)),
            material: materials.add(Color::srgb(0.8, 0.2, 0.2)),
            transform: Transform::from_xyz(0.0, 5.0, 0.0),
            ..default()
        },
        RigidBody::Dynamic,
        Collider::cuboid(0.5, 0.5, 0.5),
        ColliderMassProperties::Mass(${mass}),
        Friction::coefficient(${friction}),
        Restitution::coefficient(${restitution}),
        Damping { linear_damping: ${linearDamping}, angular_damping: ${angularDamping} },
        ExternalImpulse { impulse: Vec3::new(0.0, 10.0, 0.0), ..default() },
    ));
}
`
        }
      }

      // ── Ragdoll ──
      else if (type === 'ragdoll') {
        const jointStiffness = params.joint_stiffness ?? 0.8
        const jointDamping = params.joint_damping ?? 0.3

        // Humanoid bone definitions: name, parentIndex, size, offset
        interface BoneDef {
          name: string
          parent: number
          size: [number, number, number]
          offset: [number, number, number]
          jointLimits: [number, number, number, number] // minX, maxX, minZ, maxZ in degrees
        }

        const bones: BoneDef[] = [
          { name: 'pelvis',      parent: -1, size: [0.3, 0.15, 0.2],  offset: [0, 1.0, 0],        jointLimits: [0, 0, 0, 0] },
          { name: 'spine',       parent: 0,  size: [0.28, 0.25, 0.18], offset: [0, 0.25, 0],       jointLimits: [-20, 40, -20, 20] },
          { name: 'chest',       parent: 1,  size: [0.32, 0.25, 0.2],  offset: [0, 0.25, 0],       jointLimits: [-20, 30, -15, 15] },
          { name: 'head',        parent: 2,  size: [0.18, 0.22, 0.18], offset: [0, 0.3, 0],        jointLimits: [-40, 40, -30, 30] },
          { name: 'upper_arm_l', parent: 2,  size: [0.28, 0.08, 0.08], offset: [-0.3, 0.1, 0],     jointLimits: [-90, 90, -80, 30] },
          { name: 'lower_arm_l', parent: 4,  size: [0.26, 0.07, 0.07], offset: [-0.28, 0, 0],      jointLimits: [0, 140, -5, 5] },
          { name: 'hand_l',      parent: 5,  size: [0.1, 0.06, 0.1],   offset: [-0.2, 0, 0],       jointLimits: [-40, 40, -20, 20] },
          { name: 'upper_arm_r', parent: 2,  size: [0.28, 0.08, 0.08], offset: [0.3, 0.1, 0],      jointLimits: [-90, 90, -30, 80] },
          { name: 'lower_arm_r', parent: 7,  size: [0.26, 0.07, 0.07], offset: [0.28, 0, 0],       jointLimits: [0, 140, -5, 5] },
          { name: 'hand_r',      parent: 8,  size: [0.1, 0.06, 0.1],   offset: [0.2, 0, 0],        jointLimits: [-40, 40, -20, 20] },
          { name: 'upper_leg_l', parent: 0,  size: [0.1, 0.4, 0.1],    offset: [-0.12, -0.35, 0],  jointLimits: [-20, 100, -20, 20] },
          { name: 'lower_leg_l', parent: 10, size: [0.09, 0.38, 0.09], offset: [0, -0.4, 0],       jointLimits: [-130, 0, -5, 5] },
          { name: 'foot_l',      parent: 11, size: [0.1, 0.06, 0.2],   offset: [0, -0.22, 0.05],   jointLimits: [-30, 50, -10, 10] },
          { name: 'upper_leg_r', parent: 0,  size: [0.1, 0.4, 0.1],    offset: [0.12, -0.35, 0],   jointLimits: [-20, 100, -20, 20] },
          { name: 'lower_leg_r', parent: 13, size: [0.09, 0.38, 0.09], offset: [0, -0.4, 0],       jointLimits: [-130, 0, -5, 5] },
          { name: 'foot_r',      parent: 14, size: [0.1, 0.06, 0.2],   offset: [0, -0.22, 0.05],   jointLimits: [-30, 50, -10, 10] },
        ]

        if (engine === 'rapier') {
          code = `// Rapier3D Ragdoll — Full humanoid skeleton — generated by kbot
import RAPIER from '@dimforge/rapier3d-compat';

await RAPIER.init();

const world = new RAPIER.World(new RAPIER.Vector3(0.0, ${gravity}, 0.0));

// Ground
world.createCollider(RAPIER.ColliderDesc.cuboid(50, 0.1, 50).setFriction(${friction}));

interface RagdollBone {
  body: RAPIER.RigidBody;
  name: string;
}

const bones: RagdollBone[] = [];

// Bone definitions: [name, parentIdx, sizeX, sizeY, sizeZ, offX, offY, offZ, minX, maxX, minZ, maxZ]
const boneDefs = ${JSON.stringify(bones.map(b => [b.name, b.parent, ...b.size, ...b.offset, ...b.jointLimits]))};

for (const [name, parentIdx, sx, sy, sz, ox, oy, oz, minX, maxX, minZ, maxZ] of boneDefs) {
  // Compute world position
  let wx = ox, wy = oy, wz = oz;
  if (parentIdx >= 0) {
    const parentPos = bones[parentIdx].body.translation();
    wx += parentPos.x;
    wy += parentPos.y;
    wz += parentPos.z;
  }

  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(wx, wy, wz)
    .setLinearDamping(${linearDamping})
    .setAngularDamping(${angularDamping});
  const body = world.createRigidBody(bodyDesc);

  const colliderDesc = RAPIER.ColliderDesc.cuboid(sx / 2, sy / 2, sz / 2)
    .setMass(${mass} * sx * sy * sz * 10)
    .setFriction(${friction})
    .setRestitution(${restitution});
  world.createCollider(colliderDesc, body);

  bones.push({ body, name: name as string });

  // Create joint to parent
  if (parentIdx >= 0) {
    const parentBody = bones[parentIdx].body;
    const jointData = RAPIER.JointData.spherical(
      new RAPIER.Vector3(ox, oy, oz),   // anchor in parent
      new RAPIER.Vector3(0, 0, 0),       // anchor in child
    );
    const joint = world.createImpulseJoint(jointData, parentBody, body, true);
    // Note: Rapier spherical joints don't have direct angle limits in the same way;
    // for production use GenericJoint with locked axes for full constraint.
  }
}

console.log(\`Ragdoll created: \${bones.length} bones\`);

// Simulation loop
function step() {
  world.step();
  const head = bones.find(b => b.name === 'head');
  if (head) {
    const p = head.body.translation();
    console.log(\`Head: (\${p.x.toFixed(2)}, \${p.y.toFixed(2)}, \${p.z.toFixed(2)})\`);
  }
  requestAnimationFrame(step);
}
step();
`
        } else if (engine === 'unity') {
          fileExt = 'cs'
          code = `// Unity Ragdoll Setup — Full humanoid skeleton — generated by kbot
using UnityEngine;
using System.Collections.Generic;

public class RagdollSetup : MonoBehaviour
{
    [System.Serializable]
    public struct BoneDef
    {
        public string name;
        public int parentIndex;
        public Vector3 size;
        public Vector3 offset;
        public float minXAngle, maxXAngle, minZAngle, maxZAngle;
    }

    private List<GameObject> bones = new List<GameObject>();

    void Start()
    {
        BoneDef[] defs = new BoneDef[] {
${bones.map((b, i) => `            new BoneDef { name = "${b.name}", parentIndex = ${b.parent}, size = new Vector3(${b.size.join('f, ')}f), offset = new Vector3(${b.offset.join('f, ')}f), minXAngle = ${b.jointLimits[0]}f, maxXAngle = ${b.jointLimits[1]}f, minZAngle = ${b.jointLimits[2]}f, maxZAngle = ${b.jointLimits[3]}f }`).join(',\n')}
        };

        foreach (var def in defs)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = def.name;
            go.transform.localScale = def.size;

            Vector3 worldPos = def.offset;
            if (def.parentIndex >= 0)
                worldPos += bones[def.parentIndex].transform.position;
            go.transform.position = worldPos;

            var rb = go.AddComponent<Rigidbody>();
            rb.mass = ${mass}f * def.size.x * def.size.y * def.size.z * 10f;
            rb.linearDamping = ${linearDamping}f;
            rb.angularDamping = ${angularDamping}f;

            if (def.parentIndex >= 0)
            {
                var joint = go.AddComponent<CharacterJoint>();
                joint.connectedBody = bones[def.parentIndex].GetComponent<Rigidbody>();
                joint.anchor = Vector3.zero;
                joint.connectedAnchor = def.offset;

                var lowTwist = joint.lowTwistLimit;
                lowTwist.limit = def.minXAngle;
                joint.lowTwistLimit = lowTwist;

                var highTwist = joint.highTwistLimit;
                highTwist.limit = def.maxXAngle;
                joint.highTwistLimit = highTwist;

                var swing1 = joint.swing1Limit;
                swing1.limit = Mathf.Abs(def.minZAngle);
                joint.swing1Limit = swing1;

                var swing2 = joint.swing2Limit;
                swing2.limit = Mathf.Abs(def.maxZAngle);
                joint.swing2Limit = swing2;
            }

            bones.Add(go);
        }

        Debug.Log($"Ragdoll created: {bones.Count} bones");
    }
}
`
        } else if (engine === 'godot') {
          fileExt = 'gd'
          code = `# Godot 4 Ragdoll — Full humanoid skeleton — generated by kbot
extends Node3D

var bone_bodies: Array[RigidBody3D] = []

func _ready() -> void:
    var bone_defs := [
${bones.map(b => `        { "name": "${b.name}", "parent": ${b.parent}, "size": Vector3(${b.size.join(', ')}), "offset": Vector3(${b.offset.join(', ')}), "limits": Vector4(${b.jointLimits.join(', ')}) }`).join(',\n')}
    ]

    for def in bone_defs:
        var body := RigidBody3D.new()
        body.name = def.name
        body.mass = ${mass} * def.size.x * def.size.y * def.size.z * 10.0
        body.linear_damp = ${linearDamping}
        body.angular_damp = ${angularDamping}
        body.gravity_scale = ${-gravity / 9.81}

        var shape := BoxShape3D.new()
        shape.size = def.size
        var col := CollisionShape3D.new()
        col.shape = shape
        body.add_child(col)

        # Mesh for visualization
        var mesh := MeshInstance3D.new()
        var box_mesh := BoxMesh.new()
        box_mesh.size = def.size
        mesh.mesh = box_mesh
        body.add_child(mesh)

        var world_pos: Vector3 = def.offset
        if def.parent >= 0:
            world_pos += bone_bodies[def.parent].global_position
        body.global_position = world_pos

        add_child(body)

        if def.parent >= 0:
            var joint := Generic6DOFJoint3D.new()
            joint.node_a = bone_bodies[def.parent].get_path()
            joint.node_b = body.get_path()
            joint.set("angular_limit_x/lower_angle", deg_to_rad(def.limits.x))
            joint.set("angular_limit_x/upper_angle", deg_to_rad(def.limits.y))
            joint.set("angular_limit_z/lower_angle", deg_to_rad(def.limits.z))
            joint.set("angular_limit_z/upper_angle", deg_to_rad(def.limits.w))
            joint.set("angular_limit_x/softness", ${jointStiffness})
            joint.set("angular_limit_z/softness", ${jointStiffness})
            add_child(joint)

        bone_bodies.append(body)

    print("Ragdoll created: ", bone_bodies.size(), " bones")
`
        } else {
          // Generic ragdoll definition (cannon, matter, bevy, unreal)
          code = `// Ragdoll definition — ${engine} — generated by kbot
// Humanoid skeleton with ${bones.length} bones and constrained joints
// Adapt this JSON definition to your engine's ragdoll API.

const RAGDOLL_SKELETON = ${JSON.stringify({
            gravity,
            mass_scale: mass,
            friction,
            restitution,
            linear_damping: linearDamping,
            angular_damping: angularDamping,
            joint_stiffness: jointStiffness,
            joint_damping: jointDamping,
            bones: bones.map(b => ({
              name: b.name,
              parent_index: b.parent,
              collider_half_extents: [b.size[0]/2, b.size[1]/2, b.size[2]/2],
              local_offset: b.offset,
              joint_limits_deg: {
                x_min: b.jointLimits[0], x_max: b.jointLimits[1],
                z_min: b.jointLimits[2], z_max: b.jointLimits[3],
              },
              mass: mass * b.size[0] * b.size[1] * b.size[2] * 10,
            })),
          }, null, 2)};

// To use with ${engine}:
// 1. Create a rigidbody for each bone at the computed world offset
// 2. Create a box collider with the given half-extents
// 3. Connect to parent bone with a constrained joint using the given limits
// 4. Apply forces/impulses to the pelvis to initiate ragdoll
`
        }
      }

      // ── Vehicle ──
      else if (type === 'vehicle') {
        const wheelRadius = params.wheel_radius ?? 0.4
        const suspensionRest = params.suspension_rest ?? 0.3
        const suspensionStiffness = params.suspension_stiffness ?? 30
        const suspensionDamping = params.suspension_damping ?? 4.0
        const maxSteerAngle = params.max_steer_angle ?? 0.5
        const engineForce = params.engine_force ?? 800
        const brakeForce = params.brake_force ?? 100
        const chassisWidth = params.chassis_width ?? 1.8
        const chassisLength = params.chassis_length ?? 4.0
        const chassisHeight = params.chassis_height ?? 0.5

        if (engine === 'rapier') {
          code = `// Rapier3D Vehicle — 4-wheel with suspension — generated by kbot
import RAPIER from '@dimforge/rapier3d-compat';

await RAPIER.init();

const world = new RAPIER.World(new RAPIER.Vector3(0.0, ${gravity}, 0.0));

// Ground
world.createCollider(RAPIER.ColliderDesc.cuboid(200, 0.1, 200).setFriction(0.8));

// Chassis
const chassisDesc = RAPIER.RigidBodyDesc.dynamic()
  .setTranslation(0, 2, 0)
  .setLinearDamping(0.1)
  .setAngularDamping(0.5);
const chassis = world.createRigidBody(chassisDesc);
world.createCollider(
  RAPIER.ColliderDesc.cuboid(${chassisWidth / 2}, ${chassisHeight / 2}, ${chassisLength / 2})
    .setMass(${params.chassis_mass ?? 1200})
    .setFriction(0.3),
  chassis
);

// Wheel positions relative to chassis center
const wheelPositions = [
  { x: -${(chassisWidth / 2 + 0.1).toFixed(2)}, y: -${(chassisHeight / 2).toFixed(2)}, z:  ${(chassisLength / 2 - 0.5).toFixed(2)}, steer: true,  drive: ${params.front_drive !== false} },  // FL
  { x:  ${(chassisWidth / 2 + 0.1).toFixed(2)}, y: -${(chassisHeight / 2).toFixed(2)}, z:  ${(chassisLength / 2 - 0.5).toFixed(2)}, steer: true,  drive: ${params.front_drive !== false} },  // FR
  { x: -${(chassisWidth / 2 + 0.1).toFixed(2)}, y: -${(chassisHeight / 2).toFixed(2)}, z: -${(chassisLength / 2 - 0.5).toFixed(2)}, steer: false, drive: ${params.rear_drive !== false} },  // RL
  { x:  ${(chassisWidth / 2 + 0.1).toFixed(2)}, y: -${(chassisHeight / 2).toFixed(2)}, z: -${(chassisLength / 2 - 0.5).toFixed(2)}, steer: false, drive: ${params.rear_drive !== false} },  // RR
];

interface WheelInfo {
  body: RAPIER.RigidBody;
  steer: boolean;
  drive: boolean;
}

const wheels: WheelInfo[] = [];

for (const wp of wheelPositions) {
  const wheelDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(wp.x, wp.y + 2, wp.z)
    .setAngularDamping(0.5);
  const wheelBody = world.createRigidBody(wheelDesc);
  world.createCollider(
    RAPIER.ColliderDesc.cylinder(0.15, ${wheelRadius})
      .setMass(${params.wheel_mass ?? 20})
      .setFriction(1.0)
      .setRestitution(0.1)
      .setRotation({ x: 0, y: 0, z: Math.PI / 2, w: 1 }),
    wheelBody
  );

  // Suspension joint (prismatic along Y + revolute around X for spin)
  const jointData = RAPIER.JointData.revolute(
    new RAPIER.Vector3(wp.x, wp.y, wp.z),
    new RAPIER.Vector3(0, 0, 0),
    new RAPIER.Vector3(1, 0, 0) // spin axis
  );
  world.createImpulseJoint(jointData, chassis, wheelBody, true);

  wheels.push({ body: wheelBody, steer: wp.steer, drive: wp.drive });
}

// Vehicle controller
const config = {
  engineForce: ${engineForce},
  brakeForce: ${brakeForce},
  maxSteerAngle: ${maxSteerAngle},
  suspensionStiffness: ${suspensionStiffness},
  suspensionDamping: ${suspensionDamping},
  suspensionRest: ${suspensionRest},
};

let steerInput = 0;    // -1 to 1
let throttleInput = 0; // -1 to 1
let brakeInput = 0;    // 0 to 1

function updateVehicle() {
  for (const wheel of wheels) {
    // Drive force
    if (wheel.drive) {
      const forward = new RAPIER.Vector3(0, 0, config.engineForce * throttleInput);
      wheel.body.applyTorqueImpulse(new RAPIER.Vector3(config.engineForce * throttleInput * 0.01, 0, 0), true);
    }
    // Braking
    if (brakeInput > 0) {
      const vel = wheel.body.angvel();
      wheel.body.setAngvel({ x: vel.x * (1 - brakeInput * 0.1), y: vel.y, z: vel.z }, true);
    }
  }
}

// Simulation
function step() {
  updateVehicle();
  world.step();
  const pos = chassis.translation();
  const vel = chassis.linvel();
  const speed = Math.sqrt(vel.x ** 2 + vel.z ** 2) * 3.6; // km/h
  console.log(\`Position: (\${pos.x.toFixed(1)}, \${pos.y.toFixed(1)}, \${pos.z.toFixed(1)}) Speed: \${speed.toFixed(1)} km/h\`);
  requestAnimationFrame(step);
}
step();

// Input handling
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'w') throttleInput = 1;
  if (e.key === 'ArrowDown' || e.key === 's') throttleInput = -1;
  if (e.key === 'ArrowLeft' || e.key === 'a') steerInput = -1;
  if (e.key === 'ArrowRight' || e.key === 'd') steerInput = 1;
  if (e.key === ' ') brakeInput = 1;
});
document.addEventListener('keyup', (e) => {
  if (['ArrowUp', 'w', 'ArrowDown', 's'].includes(e.key)) throttleInput = 0;
  if (['ArrowLeft', 'a', 'ArrowRight', 'd'].includes(e.key)) steerInput = 0;
  if (e.key === ' ') brakeInput = 0;
});
`
        } else if (engine === 'godot') {
          fileExt = 'gd'
          code = `# Godot 4 VehicleBody3D — generated by kbot
extends VehicleBody3D

@export var engine_force_value := ${engineForce}.0
@export var brake_force_value := ${brakeForce}.0
@export var max_steer_angle := ${maxSteerAngle}

func _ready() -> void:
    mass = ${params.chassis_mass ?? 1200}.0

    # Create chassis collision
    var chassis_shape := BoxShape3D.new()
    chassis_shape.size = Vector3(${chassisWidth}, ${chassisHeight}, ${chassisLength})
    var chassis_col := CollisionShape3D.new()
    chassis_col.shape = chassis_shape
    add_child(chassis_col)

    # Wheel positions [x, y, z, is_steering, is_traction]
    var wheel_configs := [
        [${-(chassisWidth / 2 + 0.1).toFixed(2)}, ${-(chassisHeight / 2).toFixed(2)}, ${(chassisLength / 2 - 0.5).toFixed(2)}, true, ${params.front_drive !== false}],   # FL
        [${(chassisWidth / 2 + 0.1).toFixed(2)}, ${-(chassisHeight / 2).toFixed(2)}, ${(chassisLength / 2 - 0.5).toFixed(2)}, true, ${params.front_drive !== false}],    # FR
        [${-(chassisWidth / 2 + 0.1).toFixed(2)}, ${-(chassisHeight / 2).toFixed(2)}, ${-(chassisLength / 2 - 0.5).toFixed(2)}, false, ${params.rear_drive !== false}],  # RL
        [${(chassisWidth / 2 + 0.1).toFixed(2)}, ${-(chassisHeight / 2).toFixed(2)}, ${-(chassisLength / 2 - 0.5).toFixed(2)}, false, ${params.rear_drive !== false}],   # RR
    ]

    for cfg in wheel_configs:
        var wheel := VehicleWheel3D.new()
        wheel.position = Vector3(cfg[0], cfg[1], cfg[2])
        wheel.wheel_radius = ${wheelRadius}
        wheel.wheel_rest_length = ${suspensionRest}
        wheel.suspension_stiffness = ${suspensionStiffness}.0
        wheel.damping_compression = ${suspensionDamping}
        wheel.damping_relaxation = ${suspensionDamping * 1.5}
        wheel.use_as_steering = cfg[3]
        wheel.use_as_traction = cfg[4]
        wheel.wheel_friction_slip = 1.5

        # Wheel mesh
        var mesh := MeshInstance3D.new()
        var cyl := CylinderMesh.new()
        cyl.top_radius = ${wheelRadius}
        cyl.bottom_radius = ${wheelRadius}
        cyl.height = 0.3
        mesh.mesh = cyl
        mesh.rotate_z(PI / 2)
        wheel.add_child(mesh)

        add_child(wheel)

func _physics_process(_delta: float) -> void:
    steering = lerp(steering, Input.get_axis("ui_right", "ui_left") * max_steer_angle, 0.1)
    engine_force = Input.get_axis("ui_down", "ui_up") * engine_force_value
    brake = ${brakeForce}.0 if Input.is_action_pressed("ui_accept") else 0.0
`
        } else if (engine === 'unity') {
          fileExt = 'cs'
          code = `// Unity Vehicle — WheelCollider based — generated by kbot
using UnityEngine;

public class VehicleController : MonoBehaviour
{
    [Header("Vehicle Settings")]
    public float motorForce = ${engineForce}f;
    public float brakeForce = ${brakeForce}f;
    public float maxSteerAngle = ${maxSteerAngle * (180 / Math.PI)}f;

    private WheelCollider[] wheels;
    private Transform[] wheelMeshes;
    private Rigidbody rb;

    struct WheelConfig
    {
        public Vector3 position;
        public bool isSteering;
        public bool isDrive;
    }

    void Start()
    {
        rb = gameObject.AddComponent<Rigidbody>();
        rb.mass = ${params.chassis_mass ?? 1200}f;
        rb.centerOfMass = new Vector3(0, -0.3f, 0);

        // Chassis collider
        var chassisCol = gameObject.AddComponent<BoxCollider>();
        chassisCol.size = new Vector3(${chassisWidth}f, ${chassisHeight}f, ${chassisLength}f);

        WheelConfig[] configs = new WheelConfig[] {
            new WheelConfig { position = new Vector3(-${(chassisWidth / 2 + 0.1).toFixed(2)}f, -${(chassisHeight / 2).toFixed(2)}f,  ${(chassisLength / 2 - 0.5).toFixed(2)}f), isSteering = true,  isDrive = ${params.front_drive !== false ? 'true' : 'false'} },
            new WheelConfig { position = new Vector3( ${(chassisWidth / 2 + 0.1).toFixed(2)}f, -${(chassisHeight / 2).toFixed(2)}f,  ${(chassisLength / 2 - 0.5).toFixed(2)}f), isSteering = true,  isDrive = ${params.front_drive !== false ? 'true' : 'false'} },
            new WheelConfig { position = new Vector3(-${(chassisWidth / 2 + 0.1).toFixed(2)}f, -${(chassisHeight / 2).toFixed(2)}f, -${(chassisLength / 2 - 0.5).toFixed(2)}f), isSteering = false, isDrive = ${params.rear_drive !== false ? 'true' : 'false'} },
            new WheelConfig { position = new Vector3( ${(chassisWidth / 2 + 0.1).toFixed(2)}f, -${(chassisHeight / 2).toFixed(2)}f, -${(chassisLength / 2 - 0.5).toFixed(2)}f), isSteering = false, isDrive = ${params.rear_drive !== false ? 'true' : 'false'} },
        };

        wheels = new WheelCollider[4];
        wheelMeshes = new Transform[4];

        for (int i = 0; i < configs.Length; i++)
        {
            var wheelObj = new GameObject($"Wheel_{i}");
            wheelObj.transform.SetParent(transform);
            wheelObj.transform.localPosition = configs[i].position;

            var wc = wheelObj.AddComponent<WheelCollider>();
            wc.radius = ${wheelRadius}f;
            wc.suspensionDistance = ${suspensionRest}f;
            var spring = wc.suspensionSpring;
            spring.spring = ${suspensionStiffness * 1000}f;
            spring.damper = ${suspensionDamping * 1000}f;
            spring.targetPosition = 0.5f;
            wc.suspensionSpring = spring;
            wc.mass = ${params.wheel_mass ?? 20}f;

            var friction = wc.forwardFriction;
            friction.stiffness = 1.5f;
            wc.forwardFriction = friction;
            var sideFriction = wc.sidewaysFriction;
            sideFriction.stiffness = 1.5f;
            wc.sidewaysFriction = sideFriction;

            wheels[i] = wc;

            // Visual wheel mesh
            var meshObj = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            meshObj.transform.SetParent(wheelObj.transform);
            meshObj.transform.localScale = new Vector3(${wheelRadius * 2}f, 0.15f, ${wheelRadius * 2}f);
            Destroy(meshObj.GetComponent<Collider>());
            wheelMeshes[i] = meshObj.transform;
        }
    }

    void FixedUpdate()
    {
        float steer = Input.GetAxis("Horizontal") * maxSteerAngle;
        float motor = Input.GetAxis("Vertical") * motorForce;
        bool isBraking = Input.GetKey(KeyCode.Space);

        for (int i = 0; i < 4; i++)
        {
            if (i < 2) wheels[i].steerAngle = steer;  // front wheels steer
            if (i >= 2) wheels[i].motorTorque = motor;  // rear wheels drive
            wheels[i].brakeTorque = isBraking ? brakeForce : 0f;

            // Update visual
            wheels[i].GetWorldPose(out Vector3 pos, out Quaternion rot);
            wheelMeshes[i].position = pos;
            wheelMeshes[i].rotation = rot;
        }
    }
}
`
        } else {
          code = `// Vehicle physics config — ${engine} — generated by kbot
const VEHICLE_CONFIG = ${JSON.stringify({
            chassis: { width: chassisWidth, length: chassisLength, height: chassisHeight, mass: params.chassis_mass ?? 1200 },
            wheels: {
              radius: wheelRadius,
              mass: params.wheel_mass ?? 20,
              positions: [
                { name: 'FL', x: -(chassisWidth / 2 + 0.1), y: -(chassisHeight / 2), z: chassisLength / 2 - 0.5, steer: true, drive: params.front_drive !== false },
                { name: 'FR', x: chassisWidth / 2 + 0.1, y: -(chassisHeight / 2), z: chassisLength / 2 - 0.5, steer: true, drive: params.front_drive !== false },
                { name: 'RL', x: -(chassisWidth / 2 + 0.1), y: -(chassisHeight / 2), z: -(chassisLength / 2 - 0.5), steer: false, drive: params.rear_drive !== false },
                { name: 'RR', x: chassisWidth / 2 + 0.1, y: -(chassisHeight / 2), z: -(chassisLength / 2 - 0.5), steer: false, drive: params.rear_drive !== false },
              ],
            },
            suspension: { rest_length: suspensionRest, stiffness: suspensionStiffness, damping: suspensionDamping },
            controls: { engine_force: engineForce, brake_force: brakeForce, max_steer_angle: maxSteerAngle },
            physics: { gravity, friction, restitution },
          }, null, 2)};
`
        }
      }

      // ── Softbody ──
      else if (type === 'softbody') {
        const pressure = params.pressure ?? 1.0
        const stiffness = params.stiffness ?? 0.9
        const damping = params.damping ?? 0.05
        const iterations = params.iterations ?? 10

        if (engine === 'cannon') {
          code = `// Cannon.js Softbody (spring-mass system) — generated by kbot
import * as CANNON from 'cannon-es';

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, ${gravity}, 0) });

// Softbody as spring-mass particle grid
const gridSize = ${params.grid_size ?? 8};
const spacing = ${params.spacing ?? 0.2};
const particles: CANNON.Body[] = [];
const springs: CANNON.Spring[] = [];

// Create particle grid
for (let y = 0; y < gridSize; y++) {
  for (let x = 0; x < gridSize; x++) {
    const body = new CANNON.Body({
      mass: ${mass / 64},
      position: new CANNON.Vec3(x * spacing - (gridSize * spacing) / 2, 3 + y * spacing, 0),
      shape: new CANNON.Sphere(spacing * 0.3),
      linearDamping: ${damping},
    });
    world.addBody(body);
    particles.push(body);
  }
}

// Connect with springs (structural + shear)
for (let y = 0; y < gridSize; y++) {
  for (let x = 0; x < gridSize; x++) {
    const idx = y * gridSize + x;
    // Structural: horizontal
    if (x < gridSize - 1) {
      const spring = new CANNON.Spring(particles[idx], particles[idx + 1], {
        restLength: spacing,
        stiffness: ${stiffness * 100},
        damping: ${damping * 10},
      });
      springs.push(spring);
    }
    // Structural: vertical
    if (y < gridSize - 1) {
      const spring = new CANNON.Spring(particles[idx], particles[idx + gridSize], {
        restLength: spacing,
        stiffness: ${stiffness * 100},
        damping: ${damping * 10},
      });
      springs.push(spring);
    }
    // Shear: diagonal
    if (x < gridSize - 1 && y < gridSize - 1) {
      const diagLen = spacing * Math.SQRT2;
      springs.push(new CANNON.Spring(particles[idx], particles[idx + gridSize + 1], {
        restLength: diagLen, stiffness: ${stiffness * 50}, damping: ${damping * 10},
      }));
      springs.push(new CANNON.Spring(particles[idx + 1], particles[idx + gridSize], {
        restLength: diagLen, stiffness: ${stiffness * 50}, damping: ${damping * 10},
      }));
    }
  }
}

// Ground
const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(ground);

// Simulation
const dt = 1 / 60;
function step() {
  for (const spring of springs) spring.applyForce();
  world.step(dt);
  // Read particle positions for rendering
  const positions = particles.map(p => ({ x: p.position.x, y: p.position.y, z: p.position.z }));
  requestAnimationFrame(step);
}
step();

console.log(\`Softbody created: \${particles.length} particles, \${springs.length} springs\`);
`
        } else if (engine === 'godot') {
          fileExt = 'gd'
          code = `# Godot 4 SoftBody3D — generated by kbot
extends SoftBody3D

func _ready() -> void:
    # SoftBody3D uses a mesh to simulate
    var mesh := ArrayMesh.new()
    var plane := PlaneMesh.new()
    plane.size = Vector2(2, 2)
    plane.subdivide_width = ${params.grid_size ?? 8}
    plane.subdivide_depth = ${params.grid_size ?? 8}
    self.mesh = plane

    simulation_precision = ${iterations}
    total_mass = ${mass}
    linear_stiffness = ${stiffness}
    pressure_coefficient = ${pressure}
    damping_coefficient = ${damping}
    drag_coefficient = 0.01

    # Pin corners (optional)
    # set_point_pinned(0, true)

    global_position = Vector3(0, 3, 0)

    print("SoftBody created with ", get_point_count(), " simulation points")
`
        } else {
          code = `// Softbody config — ${engine} — generated by kbot
const SOFTBODY_CONFIG = ${JSON.stringify({
            type: 'softbody',
            engine,
            mass,
            pressure,
            stiffness,
            damping,
            solver_iterations: iterations,
            grid_size: params.grid_size ?? 8,
            spacing: params.spacing ?? 0.2,
            gravity,
            friction,
            restitution,
          }, null, 2)};
// Implement spring-mass system or use engine's built-in softbody solver
`
        }
      }

      // ── Cloth ──
      else if (type === 'cloth') {
        const clothWidth = params.width ?? 4
        const clothHeight = params.height ?? 4
        const segments = params.segments ?? 20
        const stiffness = params.stiffness ?? 0.9
        const damping = params.damping ?? 0.02

        if (engine === 'cannon') {
          code = `// Cannon.js Cloth Simulation — generated by kbot
import * as CANNON from 'cannon-es';

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, ${gravity}, 0) });

const CLOTH_W = ${clothWidth};
const CLOTH_H = ${clothHeight};
const SEG_W = ${segments};
const SEG_H = ${segments};
const particles: CANNON.Body[][] = [];
const springs: CANNON.Spring[] = [];

const dx = CLOTH_W / SEG_W;
const dy = CLOTH_H / SEG_H;
const particleMass = ${mass} / (SEG_W * SEG_H);

// Create particle grid
for (let j = 0; j <= SEG_H; j++) {
  const row: CANNON.Body[] = [];
  for (let i = 0; i <= SEG_W; i++) {
    const pinned = j === 0 && (i === 0 || i === SEG_W || i === Math.floor(SEG_W / 2));
    const body = new CANNON.Body({
      mass: pinned ? 0 : particleMass,
      position: new CANNON.Vec3(
        i * dx - CLOTH_W / 2,
        5 - j * dy,
        (Math.random() - 0.5) * 0.01 // tiny z perturbation
      ),
      shape: new CANNON.Sphere(0.02),
      linearDamping: ${damping},
    });
    world.addBody(body);
    row.push(body);
  }
  particles.push(row);
}

// Structural + shear + bend springs
function addSpring(a: CANNON.Body, b: CANNON.Body, restLen: number, stiffness: number) {
  springs.push(new CANNON.Spring(a, b, { restLength: restLen, stiffness, damping: ${damping * 10} }));
}

for (let j = 0; j <= SEG_H; j++) {
  for (let i = 0; i <= SEG_W; i++) {
    // Structural
    if (i < SEG_W) addSpring(particles[j][i], particles[j][i + 1], dx, ${stiffness * 200});
    if (j < SEG_H) addSpring(particles[j][i], particles[j + 1][i], dy, ${stiffness * 200});
    // Shear
    if (i < SEG_W && j < SEG_H) {
      const diagLen = Math.sqrt(dx * dx + dy * dy);
      addSpring(particles[j][i], particles[j + 1][i + 1], diagLen, ${stiffness * 100});
      addSpring(particles[j][i + 1], particles[j + 1][i], diagLen, ${stiffness * 100});
    }
    // Bend (skip one)
    if (i < SEG_W - 1) addSpring(particles[j][i], particles[j][i + 2], dx * 2, ${stiffness * 50});
    if (j < SEG_H - 1) addSpring(particles[j][i], particles[j + 2][i], dy * 2, ${stiffness * 50});
  }
}

// Optional: sphere collider for cloth to drape over
const sphere = new CANNON.Body({
  mass: 0,
  shape: new CANNON.Sphere(1.0),
  position: new CANNON.Vec3(0, 2, 0),
});
world.addBody(sphere);

// Wind force
const windStrength = ${params.wind ?? 0};
const windDir = new CANNON.Vec3(${params.wind_x ?? 1}, 0, ${params.wind_z ?? 0.3});

function step() {
  // Apply wind
  if (windStrength > 0) {
    for (const row of particles) {
      for (const p of row) {
        if (p.mass > 0) {
          const wind = windDir.scale(windStrength * (0.5 + Math.random() * 0.5));
          p.applyForce(wind);
        }
      }
    }
  }
  for (const spring of springs) spring.applyForce();
  world.step(1 / 60);
  requestAnimationFrame(step);
}
step();

console.log(\`Cloth created: \${(SEG_W + 1) * (SEG_H + 1)} particles, \${springs.length} springs\`);
`
        } else {
          code = `// Cloth simulation config — ${engine} — generated by kbot
const CLOTH_CONFIG = ${JSON.stringify({
            type: 'cloth',
            engine,
            width: clothWidth,
            height: clothHeight,
            segments,
            stiffness,
            damping,
            mass,
            gravity,
            wind: { strength: params.wind ?? 0, direction: [params.wind_x ?? 1, 0, params.wind_z ?? 0.3] },
            pinned_corners: params.pinned ?? [0, segments, Math.floor(segments / 2)],
          }, null, 2)};
// Use engine's cloth solver or implement Verlet/PBD integration
`
        }
      }

      // ── Joints ──
      else if (type === 'joints') {
        const jointType = params.joint_type ?? 'revolute'
        const anchorA = params.anchor_a ?? [0, 0, 0]
        const anchorB = params.anchor_b ?? [0, 1, 0]
        const axis = params.axis ?? [0, 0, 1]
        const minAngle = params.min_angle ?? -90
        const maxAngle = params.max_angle ?? 90

        if (engine === 'rapier') {
          code = `// Rapier3D Joint System — generated by kbot
import RAPIER from '@dimforge/rapier3d-compat';

await RAPIER.init();
const world = new RAPIER.World(new RAPIER.Vector3(0.0, ${gravity}, 0.0));

// Static anchor body
const anchorDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 5, 0);
const anchorBody = world.createRigidBody(anchorDesc);
world.createCollider(RAPIER.ColliderDesc.cuboid(0.3, 0.3, 0.3), anchorBody);

// Dynamic body
const dynDesc = RAPIER.RigidBodyDesc.dynamic()
  .setTranslation(${anchorB[0]}, ${5 + anchorB[1]}, ${anchorB[2]})
  .setLinearDamping(${linearDamping})
  .setAngularDamping(${angularDamping});
const dynBody = world.createRigidBody(dynDesc);
world.createCollider(
  RAPIER.ColliderDesc.cuboid(0.2, 0.5, 0.2).setMass(${mass}).setFriction(${friction}),
  dynBody
);

// Joint types
const jointType = '${jointType}';  // revolute, prismatic, fixed, ball, spring

let joint;
if (jointType === 'revolute') {
  const data = RAPIER.JointData.revolute(
    new RAPIER.Vector3(${anchorA.join(', ')}),
    new RAPIER.Vector3(0, 0, 0),
    new RAPIER.Vector3(${axis.join(', ')})
  );
  joint = world.createImpulseJoint(data, anchorBody, dynBody, true);
  joint.setLimits(${minAngle * Math.PI / 180}, ${maxAngle * Math.PI / 180});
} else if (jointType === 'prismatic') {
  const data = RAPIER.JointData.prismatic(
    new RAPIER.Vector3(${anchorA.join(', ')}),
    new RAPIER.Vector3(0, 0, 0),
    new RAPIER.Vector3(${axis.join(', ')})
  );
  joint = world.createImpulseJoint(data, anchorBody, dynBody, true);
  joint.setLimits(${params.min_dist ?? -1}, ${params.max_dist ?? 1});
} else if (jointType === 'fixed') {
  const data = RAPIER.JointData.fixed(
    new RAPIER.Vector3(${anchorA.join(', ')}),
    { x: 0, y: 0, z: 0, w: 1 },
    new RAPIER.Vector3(0, 0, 0),
    { x: 0, y: 0, z: 0, w: 1 }
  );
  joint = world.createImpulseJoint(data, anchorBody, dynBody, true);
} else if (jointType === 'ball' || jointType === 'spherical') {
  const data = RAPIER.JointData.spherical(
    new RAPIER.Vector3(${anchorA.join(', ')}),
    new RAPIER.Vector3(0, 0, 0)
  );
  joint = world.createImpulseJoint(data, anchorBody, dynBody, true);
} else if (jointType === 'spring') {
  const data = RAPIER.JointData.spring(
    ${params.spring_rest ?? 1.0},
    ${params.spring_stiffness ?? 50},
    ${params.spring_damping ?? 5},
    new RAPIER.Vector3(${anchorA.join(', ')}),
    new RAPIER.Vector3(0, 0, 0)
  );
  joint = world.createImpulseJoint(data, anchorBody, dynBody, true);
}

// Simulation
function step() {
  world.step();
  const pos = dynBody.translation();
  const rot = dynBody.rotation();
  console.log(\`Pos: (\${pos.x.toFixed(2)}, \${pos.y.toFixed(2)}, \${pos.z.toFixed(2)})\`);
  requestAnimationFrame(step);
}
step();
`
        } else {
          code = `// Joint config — ${engine} — generated by kbot
const JOINT_CONFIG = ${JSON.stringify({
            type: 'joints',
            engine,
            joint_type: jointType,
            anchor_a: anchorA,
            anchor_b: anchorB,
            axis,
            limits: { min_angle: minAngle, max_angle: maxAngle },
            physics: { mass, friction, restitution, gravity },
          }, null, 2)};
`
        }
      }

      if (!code) return `Error: No implementation for type="${type}" with engine="${engine}"`

      // Determine file extension from engine if not set
      if (fileExt === 'ts' && engine === 'godot') fileExt = 'gd'
      else if (fileExt === 'ts' && engine === 'unity') fileExt = 'cs'
      else if (fileExt === 'ts' && engine === 'unreal') fileExt = 'cpp'
      else if (fileExt === 'ts' && engine === 'bevy') fileExt = 'rs'

      ensureDir(dirname(outputPath))
      writeFileSync(outputPath, code)

      return `Physics setup generated:
  Type: ${type}
  Engine: ${engine}
  Output: ${outputPath} (${code.length} bytes)
  Parameters: mass=${mass}, friction=${friction}, restitution=${restitution}, gravity=${gravity}`
    },
  })

  // ── Tool 8: Particle System Generator ────────────────────────────────
  registerTool({
    name: 'particle_system',
    description: 'Generate engine-specific particle system code for common visual effects. Supports fire, smoke, rain, snow, sparks, magic, explosion, dust, bubbles, leaves, and confetti effects across 6 game engines.',
    parameters: {
      effect: { type: 'string', description: 'Effect type: fire, smoke, rain, snow, sparks, magic, explosion, dust, bubbles, leaves, confetti', required: true },
      engine: { type: 'string', description: 'Target engine: godot, unity, unreal, three, phaser, pixi (default: three)' },
      output_path: { type: 'string', description: 'Output file path', required: true },
      params: { type: 'string', description: 'JSON overrides (count, speed, lifetime, color, etc.)' },
    },
    tier: 'free',
    async execute(args) {
      const effect = String(args.effect).toLowerCase()
      const engine = String(args.engine || 'three').toLowerCase()
      const outputPath = safePath(String(args.output_path))
      let overrides: any = {}
      try { overrides = args.params ? JSON.parse(String(args.params)) : {} } catch { return 'Error: params must be valid JSON' }

      const validEffects = ['fire', 'smoke', 'rain', 'snow', 'sparks', 'magic', 'explosion', 'dust', 'bubbles', 'leaves', 'confetti']
      const validEngines = ['godot', 'unity', 'unreal', 'three', 'phaser', 'pixi']
      if (!validEffects.includes(effect)) return `Error: Invalid effect "${effect}". Use: ${validEffects.join(', ')}`
      if (!validEngines.includes(engine)) return `Error: Invalid engine "${engine}". Use: ${validEngines.join(', ')}`

      // Default configs per effect
      interface ParticleConfig {
        count: number
        lifetime: [number, number]
        speed: [number, number]
        size: [number, number]
        gravity: number
        spread: number
        color_start: string
        color_end: string
        emitter_shape: string
        emission_rate: number
        blend: string
      }

      const defaults: Record<string, ParticleConfig> = {
        fire: {
          count: 200, lifetime: [0.5, 1.5], speed: [1, 3], size: [0.3, 1.0],
          gravity: -2, spread: 0.5, color_start: '#ff6600', color_end: '#ff000000',
          emitter_shape: 'point', emission_rate: 50, blend: 'additive',
        },
        smoke: {
          count: 100, lifetime: [2, 5], speed: [0.3, 1], size: [0.5, 3.0],
          gravity: -0.5, spread: 1.0, color_start: '#88888880', color_end: '#44444400',
          emitter_shape: 'circle', emission_rate: 20, blend: 'alpha',
        },
        rain: {
          count: 500, lifetime: [0.5, 1.0], speed: [8, 12], size: [0.02, 0.05],
          gravity: 9.81, spread: 20, color_start: '#aaccff80', color_end: '#aaccff40',
          emitter_shape: 'rectangle', emission_rate: 200, blend: 'alpha',
        },
        snow: {
          count: 300, lifetime: [3, 8], speed: [0.3, 1], size: [0.05, 0.15],
          gravity: 0.5, spread: 15, color_start: '#ffffffcc', color_end: '#ffffff00',
          emitter_shape: 'rectangle', emission_rate: 40, blend: 'alpha',
        },
        sparks: {
          count: 50, lifetime: [0.2, 0.8], speed: [3, 8], size: [0.02, 0.08],
          gravity: 3, spread: 3, color_start: '#ffcc00', color_end: '#ff440000',
          emitter_shape: 'point', emission_rate: 30, blend: 'additive',
        },
        magic: {
          count: 150, lifetime: [1, 3], speed: [0.5, 2], size: [0.1, 0.4],
          gravity: -0.3, spread: 2, color_start: '#8844ff', color_end: '#ff44cc00',
          emitter_shape: 'sphere', emission_rate: 30, blend: 'additive',
        },
        explosion: {
          count: 300, lifetime: [0.3, 1.5], speed: [5, 15], size: [0.2, 1.5],
          gravity: 2, spread: 6.28, color_start: '#ffaa00', color_end: '#44000000',
          emitter_shape: 'sphere', emission_rate: 300, blend: 'additive',
        },
        dust: {
          count: 80, lifetime: [2, 6], speed: [0.1, 0.5], size: [0.05, 0.2],
          gravity: -0.05, spread: 5, color_start: '#c8b89060', color_end: '#c8b89000',
          emitter_shape: 'box', emission_rate: 10, blend: 'alpha',
        },
        bubbles: {
          count: 60, lifetime: [2, 5], speed: [0.5, 1.5], size: [0.1, 0.4],
          gravity: -1, spread: 2, color_start: '#88ccff40', color_end: '#88eeff00',
          emitter_shape: 'circle', emission_rate: 15, blend: 'alpha',
        },
        leaves: {
          count: 40, lifetime: [3, 8], speed: [0.5, 2], size: [0.1, 0.3],
          gravity: 0.3, spread: 10, color_start: '#88aa22', color_end: '#cc880000',
          emitter_shape: 'rectangle', emission_rate: 8, blend: 'alpha',
        },
        confetti: {
          count: 200, lifetime: [2, 5], speed: [2, 6], size: [0.05, 0.15],
          gravity: 1.5, spread: 4, color_start: '#ff4488', color_end: '#4488ff00',
          emitter_shape: 'point', emission_rate: 80, blend: 'alpha',
        },
      }

      const cfg = defaults[effect]
      // Apply overrides
      if (overrides.count) cfg.count = overrides.count
      if (overrides.lifetime) cfg.lifetime = overrides.lifetime
      if (overrides.speed) cfg.speed = overrides.speed
      if (overrides.size) cfg.size = overrides.size
      if (overrides.gravity !== undefined) cfg.gravity = overrides.gravity
      if (overrides.spread) cfg.spread = overrides.spread
      if (overrides.color_start) cfg.color_start = overrides.color_start
      if (overrides.color_end) cfg.color_end = overrides.color_end
      if (overrides.emission_rate) cfg.emission_rate = overrides.emission_rate

      let code = ''

      if (engine === 'three') {
        code = `// Three.js Particle System — ${effect} — generated by kbot
import * as THREE from 'three';

export function create${effect.charAt(0).toUpperCase() + effect.slice(1)}Particles(scene: THREE.Scene, position = new THREE.Vector3(0, 0, 0)) {
  const MAX_PARTICLES = ${cfg.count};
  const geometry = new THREE.BufferGeometry();

  // Particle state arrays
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const velocities = new Float32Array(MAX_PARTICLES * 3);
  const colors = new Float32Array(MAX_PARTICLES * 4);
  const sizes = new Float32Array(MAX_PARTICLES);
  const lifetimes = new Float32Array(MAX_PARTICLES);  // remaining life
  const maxLifetimes = new Float32Array(MAX_PARTICLES);
  let aliveCount = 0;
  let emitAccum = 0;

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    size: ${cfg.size[1]},
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: ${cfg.blend === 'additive' ? 'THREE.AdditiveBlending' : 'THREE.NormalBlending'},
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  // Color parsing helper
  function hexToRgba(hex: string): [number, number, number, number] {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16) / 255;
    const g = parseInt(h.substring(2, 4), 16) / 255;
    const b = parseInt(h.substring(4, 6), 16) / 255;
    const a = h.length > 6 ? parseInt(h.substring(6, 8), 16) / 255 : 1;
    return [r, g, b, a];
  }

  const startColor = hexToRgba('${cfg.color_start}');
  const endColor = hexToRgba('${cfg.color_end}');

  function emitParticle(idx: number) {
    // Position based on emitter shape
    const i3 = idx * 3;
    const i4 = idx * 4;
${cfg.emitter_shape === 'point' ? `    positions[i3] = position.x;
    positions[i3 + 1] = position.y;
    positions[i3 + 2] = position.z;` :
  cfg.emitter_shape === 'circle' ? `    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * ${cfg.spread};
    positions[i3] = position.x + Math.cos(angle) * radius;
    positions[i3 + 1] = position.y;
    positions[i3 + 2] = position.z + Math.sin(angle) * radius;` :
  cfg.emitter_shape === 'sphere' ? `    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = Math.random() * ${cfg.spread * 0.5};
    positions[i3] = position.x + r * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = position.y + r * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = position.z + r * Math.cos(phi);` :
  cfg.emitter_shape === 'rectangle' || cfg.emitter_shape === 'box' ? `    positions[i3] = position.x + (Math.random() - 0.5) * ${cfg.spread};
    positions[i3 + 1] = position.y + (Math.random() - 0.5) * ${cfg.spread * 0.2};
    positions[i3 + 2] = position.z + (Math.random() - 0.5) * ${cfg.spread};` :
  `    positions[i3] = position.x;
    positions[i3 + 1] = position.y;
    positions[i3 + 2] = position.z;`}

    // Velocity
    const speed = ${cfg.speed[0]} + Math.random() * ${cfg.speed[1] - cfg.speed[0]};
${effect === 'rain' ? `    velocities[i3] = (Math.random() - 0.5) * 0.5;
    velocities[i3 + 1] = -speed;
    velocities[i3 + 2] = (Math.random() - 0.5) * 0.5;` :
  effect === 'explosion' ? `    const eTheta = Math.random() * Math.PI * 2;
    const ePhi = Math.acos(2 * Math.random() - 1);
    velocities[i3] = speed * Math.sin(ePhi) * Math.cos(eTheta);
    velocities[i3 + 1] = speed * Math.sin(ePhi) * Math.sin(eTheta);
    velocities[i3 + 2] = speed * Math.cos(ePhi);` :
  effect === 'leaves' || effect === 'confetti' ? `    velocities[i3] = (Math.random() - 0.5) * speed;
    velocities[i3 + 1] = speed * 0.5;
    velocities[i3 + 2] = (Math.random() - 0.5) * speed;` :
  `    velocities[i3] = (Math.random() - 0.5) * ${cfg.spread};
    velocities[i3 + 1] = speed;
    velocities[i3 + 2] = (Math.random() - 0.5) * ${cfg.spread};`}

    // Lifetime
    lifetimes[idx] = ${cfg.lifetime[0]} + Math.random() * ${cfg.lifetime[1] - cfg.lifetime[0]};
    maxLifetimes[idx] = lifetimes[idx];

    // Initial size
    sizes[idx] = ${cfg.size[0]} + Math.random() * ${cfg.size[1] - cfg.size[0]};

    // Initial color
    colors[i4] = startColor[0];
    colors[i4 + 1] = startColor[1];
    colors[i4 + 2] = startColor[2];
    colors[i4 + 3] = startColor[3];
  }

  function update(dt: number) {
    // Emit new particles
    emitAccum += ${cfg.emission_rate} * dt;
    while (emitAccum >= 1 && aliveCount < MAX_PARTICLES) {
      emitParticle(aliveCount);
      aliveCount++;
      emitAccum -= 1;
    }

    // Update existing particles
    for (let idx = aliveCount - 1; idx >= 0; idx--) {
      lifetimes[idx] -= dt;
      if (lifetimes[idx] <= 0) {
        // Swap with last alive
        aliveCount--;
        const i3 = idx * 3, l3 = aliveCount * 3;
        const i4 = idx * 4, l4 = aliveCount * 4;
        positions[i3] = positions[l3]; positions[i3+1] = positions[l3+1]; positions[i3+2] = positions[l3+2];
        velocities[i3] = velocities[l3]; velocities[i3+1] = velocities[l3+1]; velocities[i3+2] = velocities[l3+2];
        colors[i4] = colors[l4]; colors[i4+1] = colors[l4+1]; colors[i4+2] = colors[l4+2]; colors[i4+3] = colors[l4+3];
        sizes[idx] = sizes[aliveCount];
        lifetimes[idx] = lifetimes[aliveCount];
        maxLifetimes[idx] = maxLifetimes[aliveCount];
        continue;
      }

      const i3 = idx * 3;
      const i4 = idx * 4;
      const t = 1 - lifetimes[idx] / maxLifetimes[idx]; // 0..1 over lifetime

      // Apply gravity
      velocities[i3 + 1] -= ${cfg.gravity} * dt;
${effect === 'leaves' || effect === 'snow' ? `      // Lateral drift / flutter
      velocities[i3] += Math.sin(lifetimes[idx] * 3) * 0.1 * dt;
      velocities[i3 + 2] += Math.cos(lifetimes[idx] * 2.7) * 0.08 * dt;` : ''}

      // Move
      positions[i3] += velocities[i3] * dt;
      positions[i3 + 1] += velocities[i3 + 1] * dt;
      positions[i3 + 2] += velocities[i3 + 2] * dt;

      // Lerp color
      colors[i4]     = startColor[0] + (endColor[0] - startColor[0]) * t;
      colors[i4 + 1] = startColor[1] + (endColor[1] - startColor[1]) * t;
      colors[i4 + 2] = startColor[2] + (endColor[2] - startColor[2]) * t;
      colors[i4 + 3] = startColor[3] + (endColor[3] - startColor[3]) * t;

      // Size over lifetime
${effect === 'fire' || effect === 'explosion' ? `      sizes[idx] *= (1 + dt * 0.5); // grow` :
  effect === 'smoke' ? `      sizes[idx] *= (1 + dt * 0.3); // expand slowly` :
  `      // constant size`}
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    geometry.attributes.size.needsUpdate = true;
    geometry.setDrawRange(0, aliveCount);
  }

  return { points, update, getAliveCount: () => aliveCount };
}

// Usage:
// const clock = new THREE.Clock();
// const particles = create${effect.charAt(0).toUpperCase() + effect.slice(1)}Particles(scene);
// function animate() {
//   particles.update(clock.getDelta());
//   renderer.render(scene, camera);
//   requestAnimationFrame(animate);
// }
`
      } else if (engine === 'godot') {
        code = `# Godot 4 GPUParticles3D — ${effect} — generated by kbot
extends GPUParticles3D

func _ready() -> void:
    amount = ${cfg.count}
    lifetime = ${cfg.lifetime[1]}
    one_shot = ${effect === 'explosion' ? 'true' : 'false'}
    explosiveness = ${effect === 'explosion' ? '1.0' : '0.0'}
    randomness = 0.5
    fixed_fps = 60
    local_coords = false

    # Process material
    var mat := ParticleProcessMaterial.new()
    mat.direction = Vector3(0, ${cfg.gravity < 0 ? 1 : -1}, 0)
    mat.initial_velocity_min = ${cfg.speed[0]}
    mat.initial_velocity_max = ${cfg.speed[1]}
    mat.spread = ${Math.min(cfg.spread * 10, 180)}
    mat.gravity = Vector3(0, ${cfg.gravity}, 0)
    mat.damping_min = 0.5
    mat.damping_max = 2.0

    # Scale
    mat.scale_min = ${cfg.size[0]}
    mat.scale_max = ${cfg.size[1]}
    var scale_curve := CurveTexture.new()
    var curve := Curve.new()
    curve.add_point(Vector2(0, 1))
${effect === 'smoke' || effect === 'fire' ? `    curve.add_point(Vector2(0.5, 1.5))
    curve.add_point(Vector2(1, 0.3))` : `    curve.add_point(Vector2(0.5, 1))
    curve.add_point(Vector2(1, 0))`}
    scale_curve.curve = curve
    mat.scale_curve = scale_curve

    # Color
    var gradient := GradientTexture1D.new()
    var grad := Gradient.new()
    grad.set_color(0, Color.html("${cfg.color_start.substring(0, 7)}"))
    grad.add_point(1.0, Color.html("${cfg.color_end.substring(0, 7)}00"))
    gradient.gradient = grad
    mat.color_ramp = gradient

    # Emission shape
${cfg.emitter_shape === 'sphere' ? `    mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
    mat.emission_sphere_radius = ${cfg.spread}` :
  cfg.emitter_shape === 'box' || cfg.emitter_shape === 'rectangle' ? `    mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
    mat.emission_box_extents = Vector3(${cfg.spread}, 0.1, ${cfg.spread})` :
  cfg.emitter_shape === 'circle' ? `    mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
    mat.emission_sphere_radius = ${cfg.spread}` :
  `    mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_POINT`}

${effect === 'leaves' || effect === 'snow' ? `    # Turbulence for organic motion
    mat.turbulence_enabled = true
    mat.turbulence_noise_strength = 2.0
    mat.turbulence_noise_speed_random = 0.5
    mat.turbulence_noise_scale = 4.0` : ''}

    process_material = mat

    # Mesh for each particle
    var mesh := QuadMesh.new()
    mesh.size = Vector2(1, 1)
    draw_pass_1 = mesh

    # Standard material for billboard
    var draw_mat := StandardMaterial3D.new()
    draw_mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
    draw_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
${cfg.blend === 'additive' ? `    draw_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD` : ''}
    draw_mat.vertex_color_use_as_albedo = true
    draw_mat.no_depth_test = true
    mesh.material = draw_mat

    emitting = true
    print("${effect} particle system ready: ", amount, " particles")
`
      } else if (engine === 'unity') {
        code = `// Unity ParticleSystem — ${effect} — generated by kbot
using UnityEngine;

public class ${effect.charAt(0).toUpperCase() + effect.slice(1)}Particles : MonoBehaviour
{
    private ParticleSystem ps;

    void Start()
    {
        ps = gameObject.AddComponent<ParticleSystem>();

        var main = ps.main;
        main.maxParticles = ${cfg.count};
        main.startLifetime = new ParticleSystem.MinMaxCurve(${cfg.lifetime[0]}f, ${cfg.lifetime[1]}f);
        main.startSpeed = new ParticleSystem.MinMaxCurve(${cfg.speed[0]}f, ${cfg.speed[1]}f);
        main.startSize = new ParticleSystem.MinMaxCurve(${cfg.size[0]}f, ${cfg.size[1]}f);
        main.gravityModifier = ${(cfg.gravity / 9.81).toFixed(3)}f;
        main.simulationSpace = ParticleSystemSimulationSpace.World;
        main.startColor = new ParticleSystem.MinMaxGradient(
            HexColor("${cfg.color_start.substring(0, 7)}"),
            HexColor("${cfg.color_end.substring(0, 7)}")
        );
${effect === 'explosion' ? `        main.loop = false;
        main.duration = 0.1f;` : `        main.loop = true;`}

        // Emission
        var emission = ps.emission;
        emission.enabled = true;
        emission.rateOverTime = ${cfg.emission_rate}f;
${effect === 'explosion' ? `        emission.SetBursts(new ParticleSystem.Burst[] {
            new ParticleSystem.Burst(0f, ${cfg.count})
        });
        emission.rateOverTime = 0;` : ''}

        // Shape
        var shape = ps.shape;
        shape.enabled = true;
${cfg.emitter_shape === 'sphere' ? `        shape.shapeType = ParticleSystemShapeType.Sphere;
        shape.radius = ${cfg.spread}f;` :
  cfg.emitter_shape === 'circle' ? `        shape.shapeType = ParticleSystemShapeType.Circle;
        shape.radius = ${cfg.spread}f;` :
  cfg.emitter_shape === 'rectangle' || cfg.emitter_shape === 'box' ? `        shape.shapeType = ParticleSystemShapeType.Box;
        shape.scale = new Vector3(${cfg.spread}f, 0.1f, ${cfg.spread}f);` :
  `        shape.shapeType = ParticleSystemShapeType.Cone;
        shape.angle = ${Math.min(cfg.spread * 5, 60)}f;
        shape.radius = 0.1f;`}

        // Color over lifetime
        var colorOverLifetime = ps.colorOverLifetime;
        colorOverLifetime.enabled = true;
        var gradient = new Gradient();
        gradient.SetKeys(
            new GradientColorKey[] {
                new GradientColorKey(HexColor("${cfg.color_start.substring(0, 7)}"), 0f),
                new GradientColorKey(HexColor("${cfg.color_end.substring(0, 7)}"), 1f)
            },
            new GradientAlphaKey[] {
                new GradientAlphaKey(1f, 0f),
                new GradientAlphaKey(0f, 1f)
            }
        );
        colorOverLifetime.color = new ParticleSystem.MinMaxGradient(gradient);

        // Size over lifetime
        var sizeOverLifetime = ps.sizeOverLifetime;
        sizeOverLifetime.enabled = true;
${effect === 'fire' || effect === 'smoke' ? `        sizeOverLifetime.size = new ParticleSystem.MinMaxCurve(1f, AnimationCurve.Linear(0, 0.5f, 1, 1.5f));` :
  `        sizeOverLifetime.size = new ParticleSystem.MinMaxCurve(1f, AnimationCurve.EaseInOut(0, 1f, 1, 0f));`}

${effect === 'leaves' || effect === 'snow' || effect === 'confetti' ? `        // Noise for organic movement
        var noise = ps.noise;
        noise.enabled = true;
        noise.strength = 1f;
        noise.frequency = 0.5f;
        noise.scrollSpeed = 0.3f;

        // Rotation over lifetime
        var rotOverLifetime = ps.rotationOverLifetime;
        rotOverLifetime.enabled = true;
        rotOverLifetime.z = new ParticleSystem.MinMaxCurve(-90f, 90f);` : ''}

        // Renderer
        var renderer = GetComponent<ParticleSystemRenderer>();
        renderer.renderMode = ParticleSystemRenderMode.Billboard;
        renderer.material = new Material(Shader.Find("Particles/${cfg.blend === 'additive' ? 'Standard Unlit' : 'Standard Surface'}"));
    }

    private Color HexColor(string hex)
    {
        ColorUtility.TryParseHtmlString(hex, out Color color);
        return color;
    }
}
`
      } else if (engine === 'phaser') {
        code = `// Phaser 3 Particle Emitter — ${effect} — generated by kbot
import Phaser from 'phaser';

export class ${effect.charAt(0).toUpperCase() + effect.slice(1)}Scene extends Phaser.Scene {
  constructor() {
    super('${effect}');
  }

  preload() {
    // Generate a simple circular particle texture
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(16, 16, 16);
    graphics.generateTexture('particle', 32, 32);
    graphics.destroy();
  }

  create() {
    const emitter = this.add.particles(${
      effect === 'rain' || effect === 'snow' || effect === 'leaves'
        ? 'this.scale.width / 2, 0'
        : 'this.scale.width / 2, this.scale.height / 2'
    }, 'particle', {
      lifespan: { min: ${cfg.lifetime[0] * 1000}, max: ${cfg.lifetime[1] * 1000} },
      speed: { min: ${cfg.speed[0] * 50}, max: ${cfg.speed[1] * 50} },
      scale: { start: ${cfg.size[1]}, end: ${cfg.size[0]} },
      alpha: { start: 1, end: 0 },
      frequency: ${Math.floor(1000 / cfg.emission_rate)},
      quantity: 1,
      gravityY: ${cfg.gravity * 50},
      blendMode: '${cfg.blend === 'additive' ? 'ADD' : 'NORMAL'}',
      tint: [${(() => {
        const c = cfg.color_start.replace('#', '')
        return '0x' + c.substring(0, 6)
      })()}, ${(() => {
        const c = cfg.color_end.replace('#', '')
        return '0x' + c.substring(0, 6)
      })()}],
${cfg.emitter_shape === 'rectangle' || cfg.emitter_shape === 'box' ? `      emitZone: {
        type: 'random',
        source: new Phaser.Geom.Rectangle(-${cfg.spread * 25}, -10, ${cfg.spread * 50}, 20),
      },` :
  cfg.emitter_shape === 'circle' || cfg.emitter_shape === 'sphere' ? `      emitZone: {
        type: 'random',
        source: new Phaser.Geom.Circle(0, 0, ${cfg.spread * 25}),
      },` : ''}
${effect === 'rain' ? `      angle: { min: 85, max: 95 },` :
  effect === 'explosion' ? `      angle: { min: 0, max: 360 },
      explode: true,
      quantity: ${cfg.count},` :
  effect === 'fire' ? `      angle: { min: -100, max: -80 },` :
  `      angle: { min: 0, max: 360 },`}
    });

${effect === 'explosion' ? `    // One-shot explosion — re-trigger with click
    this.input.on('pointerdown', () => emitter.explode(${cfg.count}));` : ''}
  }
}

// Usage: new Phaser.Game({ scene: ${effect.charAt(0).toUpperCase() + effect.slice(1)}Scene, width: 800, height: 600 });
`
      } else if (engine === 'pixi') {
        code = `// PixiJS Particle System — ${effect} — generated by kbot
import * as PIXI from 'pixi.js';

export function create${effect.charAt(0).toUpperCase() + effect.slice(1)}Emitter(container: PIXI.Container, position: { x: number; y: number }) {
  interface Particle {
    sprite: PIXI.Sprite;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    startSize: number;
  }

  const MAX_PARTICLES = ${cfg.count};
  const particles: Particle[] = [];
  let emitAccum = 0;

  // Generate circular texture
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  const texture = PIXI.Texture.from(canvas);

  function hexToNum(hex: string): number {
    return parseInt(hex.replace('#', '').substring(0, 6), 16);
  }
  const startTint = hexToNum('${cfg.color_start}');
  const endTint = hexToNum('${cfg.color_end}');

  function emit() {
    if (particles.length >= MAX_PARTICLES) return;

    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.blendMode = ${cfg.blend === 'additive' ? "'add'" : "'normal'"};
    sprite.tint = startTint;
    container.addChild(sprite);

    const speed = ${cfg.speed[0]} + Math.random() * ${cfg.speed[1] - cfg.speed[0]};
${effect === 'rain' ? `    const angle = (85 + Math.random() * 10) * Math.PI / 180;` :
  effect === 'explosion' ? `    const angle = Math.random() * Math.PI * 2;` :
  effect === 'fire' ? `    const angle = (-100 + Math.random() * 20) * Math.PI / 180;` :
  `    const angle = Math.random() * Math.PI * 2;`}

    let px = position.x, py = position.y;
${cfg.emitter_shape === 'rectangle' || cfg.emitter_shape === 'box' ? `    px += (Math.random() - 0.5) * ${cfg.spread * 50};` :
  cfg.emitter_shape === 'circle' || cfg.emitter_shape === 'sphere' ? `    const r = Math.random() * ${cfg.spread * 25};
    const a2 = Math.random() * Math.PI * 2;
    px += Math.cos(a2) * r;
    py += Math.sin(a2) * r;` : ''}

    sprite.position.set(px, py);
    const startSize = ${cfg.size[0]} + Math.random() * ${cfg.size[1] - cfg.size[0]};
    sprite.scale.set(startSize);

    const life = ${cfg.lifetime[0]} + Math.random() * ${cfg.lifetime[1] - cfg.lifetime[0]};
    particles.push({
      sprite,
      vx: Math.cos(angle) * speed * 50,
      vy: Math.sin(angle) * speed * 50,
      life,
      maxLife: life,
      startSize,
    });
  }

  function update(dt: number) {
    // Emit
${effect === 'explosion' ? `    if (particles.length === 0) { for (let i = 0; i < ${cfg.count}; i++) emit(); }` :
  `    emitAccum += ${cfg.emission_rate} * dt;
    while (emitAccum >= 1) { emit(); emitAccum -= 1; }`}

    // Update
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        container.removeChild(p.sprite);
        p.sprite.destroy();
        particles.splice(i, 1);
        continue;
      }

      const t = 1 - p.life / p.maxLife;
      p.vy += ${cfg.gravity * 50} * dt;
${effect === 'leaves' || effect === 'snow' ? `      p.vx += Math.sin(p.life * 3) * 20 * dt;` : ''}
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      p.sprite.alpha = 1 - t;
${effect === 'fire' || effect === 'smoke' ? `      p.sprite.scale.set(p.startSize * (1 + t * 0.5));` :
  `      p.sprite.scale.set(p.startSize * (1 - t * 0.5));`}
    }
  }

  return { update, getCount: () => particles.length };
}
`
      } else if (engine === 'unreal') {
        code = `// Unreal Engine Niagara Particle System — ${effect} — generated by kbot
// Create via: UNiagaraFunctionLibrary::SpawnSystemAtLocation
// This generates a Niagara module script (NiagaraScript)
// For production, import into the Niagara editor.

#include "NiagaraFunctionLibrary.h"
#include "NiagaraComponent.h"
#include "NiagaraSystem.h"

void AParticleActor::Setup${effect.charAt(0).toUpperCase() + effect.slice(1)}()
{
    // Load or create system
    UNiagaraSystem* System = LoadObject<UNiagaraSystem>(nullptr,
        TEXT("/Game/FX/${effect.charAt(0).toUpperCase() + effect.slice(1)}System"));

    if (!System) {
        UE_LOG(LogTemp, Warning, TEXT("Create Niagara system with these settings:"));
        UE_LOG(LogTemp, Warning, TEXT("  Max Particles: ${cfg.count}"));
        UE_LOG(LogTemp, Warning, TEXT("  Lifetime: ${cfg.lifetime[0]}-${cfg.lifetime[1]}s"));
        UE_LOG(LogTemp, Warning, TEXT("  Speed: ${cfg.speed[0]}-${cfg.speed[1]}"));
        UE_LOG(LogTemp, Warning, TEXT("  Size: ${cfg.size[0]}-${cfg.size[1]}"));
        UE_LOG(LogTemp, Warning, TEXT("  Gravity: ${cfg.gravity}"));
        UE_LOG(LogTemp, Warning, TEXT("  Color Start: ${cfg.color_start}"));
        UE_LOG(LogTemp, Warning, TEXT("  Color End: ${cfg.color_end}"));
        UE_LOG(LogTemp, Warning, TEXT("  Blend: ${cfg.blend}"));
        return;
    }

    UNiagaraComponent* NiagaraComp = UNiagaraFunctionLibrary::SpawnSystemAtLocation(
        GetWorld(), System, GetActorLocation(), FRotator::ZeroRotator, FVector::OneVector, true
    );

    // Override parameters
    NiagaraComp->SetVariableFloat(FName("SpawnRate"), ${cfg.emission_rate}.f);
    NiagaraComp->SetVariableFloat(FName("Lifetime"), ${cfg.lifetime[1]}.f);
    NiagaraComp->SetVariableFloat(FName("Speed"), ${cfg.speed[1]}.f);
    NiagaraComp->SetVariableLinearColor(FName("StartColor"),
        FLinearColor(${(() => {
          const c = cfg.color_start.replace('#', '')
          const r = parseInt(c.substring(0, 2), 16) / 255
          const g = parseInt(c.substring(2, 4), 16) / 255
          const b = parseInt(c.substring(4, 6), 16) / 255
          return `${r.toFixed(3)}f, ${g.toFixed(3)}f, ${b.toFixed(3)}f, 1.0f`
        })()})
    );
}

/* Niagara Module Script (HLSL) for ${effect}:

void SimulateParticle(inout float3 Position, inout float3 Velocity, inout float4 Color,
                      inout float Size, in float Age, in float Lifetime, in float DeltaTime)
{
    float t = Age / Lifetime;

    // Gravity
    Velocity.y += ${cfg.gravity} * DeltaTime;

${effect === 'leaves' || effect === 'snow' ? `    // Wind flutter
    Velocity.x += sin(Age * 3.0) * 0.5 * DeltaTime;
    Velocity.z += cos(Age * 2.7) * 0.3 * DeltaTime;` : ''}

    // Update position
    Position += Velocity * DeltaTime;

${effect === 'fire' || effect === 'smoke' ? `    // Grow over lifetime
    Size *= (1.0 + DeltaTime * 0.3);` :
  `    // Shrink over lifetime
    Size *= (1.0 - DeltaTime * 0.2);`}

    // Fade alpha
    Color.a = 1.0 - t;
}
*/
`
      }

      if (!code) return `Error: No implementation for effect="${effect}" with engine="${engine}"`

      ensureDir(dirname(outputPath))
      writeFileSync(outputPath, code)

      return `Particle system generated:
  Effect: ${effect}
  Engine: ${engine}
  Output: ${outputPath} (${code.length} bytes)
  Particles: ${cfg.count}, Lifetime: ${cfg.lifetime[0]}-${cfg.lifetime[1]}s
  Speed: ${cfg.speed[0]}-${cfg.speed[1]}, Gravity: ${cfg.gravity}
  Blend: ${cfg.blend}, Emission: ${cfg.emission_rate}/s`
    },
  })

  // ── Tool 9: Procedural Level Generator ───────────────────────────────
  registerTool({
    name: 'level_generate',
    description: 'Generate procedural game levels with BSP dungeon, platformer terrain, maze, overworld, or arena layouts. Supports seeded PRNG for reproducibility and outputs in JSON, Tiled, or ASCII formats.',
    parameters: {
      type: { type: 'string', description: 'Level type: dungeon, platformer, overworld, maze, arena', required: true },
      width: { type: 'number', description: 'Map width in tiles (default: 40)' },
      height: { type: 'number', description: 'Map height in tiles (default: 30)' },
      seed: { type: 'number', description: 'Random seed for reproducibility' },
      output_path: { type: 'string', description: 'Output file path', required: true },
      format: { type: 'string', description: 'Output format: json, tiled, ascii (default: json)' },
      params: { type: 'string', description: 'JSON params: room_count, corridor_width, room_min_size, room_max_size, platform_density, etc.' },
    },
    tier: 'free',
    async execute(args) {
      const type = String(args.type).toLowerCase()
      const width = Math.min(typeof args.width === 'number' ? args.width : 40, 1000)
      const height = Math.min(typeof args.height === 'number' ? args.height : 30, 1000)
      const seedVal = typeof args.seed === 'number' ? args.seed : Date.now()
      const outputPath = safePath(String(args.output_path))
      const format = String(args.format || 'json') as 'json' | 'tiled' | 'ascii'
      let params: any = {}
      try { params = args.params ? JSON.parse(String(args.params)) : {} } catch { return 'Error: params must be valid JSON' }

      const validTypes = ['dungeon', 'platformer', 'overworld', 'maze', 'arena']
      if (!validTypes.includes(type)) return `Error: Invalid type "${type}". Use: ${validTypes.join(', ')}`
      if (!['json', 'tiled', 'ascii'].includes(format)) return `Error: Invalid format "${format}". Use: json, tiled, ascii`

      // ── Seeded PRNG (mulberry32) ──
      function mulberry32(seed: number) {
        let s = seed | 0
        return function(): number {
          s = (s + 0x6D2B79F5) | 0
          let t = Math.imul(s ^ (s >>> 15), 1 | s)
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296
        }
      }
      const rng = mulberry32(seedVal)
      function rngInt(min: number, max: number): number { return min + Math.floor(rng() * (max - min + 1)) }

      // Tile constants
      const WALL = 1
      const FLOOR = 0
      const DOOR = 2
      const WATER = 3
      const SPAWN = 4
      const EXIT = 5
      const PLATFORM = 6
      const LAVA = 7

      // Initialize map filled with walls
      const map: number[][] = Array.from({ length: height }, () => Array(width).fill(WALL))

      interface Room {
        x: number; y: number; w: number; h: number
        centerX: number; centerY: number
      }
      const rooms: Room[] = []

      // ── BSP Dungeon Generation ──
      if (type === 'dungeon') {
        const minRoomSize = params.room_min_size ?? 5
        const maxRoomSize = params.room_max_size ?? 12
        const minLeafSize = Math.max(minRoomSize + 2, 8)
        const corridorWidth = params.corridor_width ?? 1

        interface BSPNode {
          x: number; y: number; w: number; h: number
          left?: BSPNode; right?: BSPNode
          room?: Room
        }

        function splitBSP(node: BSPNode, depth: number): void {
          if (depth <= 0 || node.w < minLeafSize * 2 || node.h < minLeafSize * 2) {
            // Create room inside this leaf
            const roomW = rngInt(minRoomSize, Math.min(maxRoomSize, node.w - 2))
            const roomH = rngInt(minRoomSize, Math.min(maxRoomSize, node.h - 2))
            const roomX = node.x + rngInt(1, node.w - roomW - 1)
            const roomY = node.y + rngInt(1, node.h - roomH - 1)
            node.room = {
              x: roomX, y: roomY, w: roomW, h: roomH,
              centerX: Math.floor(roomX + roomW / 2),
              centerY: Math.floor(roomY + roomH / 2),
            }
            rooms.push(node.room)
            return
          }

          // Decide split direction
          const splitH = node.w > node.h ? rng() > 0.3 : rng() > 0.7

          if (splitH) {
            // Vertical split
            const split = rngInt(minLeafSize, node.w - minLeafSize)
            node.left = { x: node.x, y: node.y, w: split, h: node.h }
            node.right = { x: node.x + split, y: node.y, w: node.w - split, h: node.h }
          } else {
            // Horizontal split
            const split = rngInt(minLeafSize, node.h - minLeafSize)
            node.left = { x: node.x, y: node.y, w: node.w, h: split }
            node.right = { x: node.x, y: node.y + split, w: node.w, h: node.h - split }
          }

          splitBSP(node.left, depth - 1)
          splitBSP(node.right, depth - 1)
        }

        // Build BSP tree
        const maxDepth = params.bsp_depth ?? 5
        const root: BSPNode = { x: 0, y: 0, w: width, h: height }
        splitBSP(root, maxDepth)

        // Carve rooms
        for (const room of rooms) {
          for (let ry = room.y; ry < room.y + room.h && ry < height; ry++) {
            for (let rx = room.x; rx < room.x + room.w && rx < width; rx++) {
              map[ry][rx] = FLOOR
            }
          }
        }

        // Connect rooms with L-shaped corridors
        for (let i = 1; i < rooms.length; i++) {
          const a = rooms[i - 1]
          const b = rooms[i]
          const cx1 = a.centerX, cy1 = a.centerY
          const cx2 = b.centerX, cy2 = b.centerY

          // Randomly choose horizontal-first or vertical-first
          if (rng() > 0.5) {
            // Horizontal then vertical
            for (let x = Math.min(cx1, cx2); x <= Math.max(cx1, cx2); x++) {
              for (let cw = 0; cw < corridorWidth; cw++) {
                const y = cy1 + cw
                if (y >= 0 && y < height && x >= 0 && x < width) map[y][x] = FLOOR
              }
            }
            for (let y = Math.min(cy1, cy2); y <= Math.max(cy1, cy2); y++) {
              for (let cw = 0; cw < corridorWidth; cw++) {
                const x = cx2 + cw
                if (y >= 0 && y < height && x >= 0 && x < width) map[y][x] = FLOOR
              }
            }
          } else {
            // Vertical then horizontal
            for (let y = Math.min(cy1, cy2); y <= Math.max(cy1, cy2); y++) {
              for (let cw = 0; cw < corridorWidth; cw++) {
                const x = cx1 + cw
                if (y >= 0 && y < height && x >= 0 && x < width) map[y][x] = FLOOR
              }
            }
            for (let x = Math.min(cx1, cx2); x <= Math.max(cx1, cx2); x++) {
              for (let cw = 0; cw < corridorWidth; cw++) {
                const y = cy2 + cw
                if (y >= 0 && y < height && x >= 0 && x < width) map[y][x] = FLOOR
              }
            }
          }
        }

        // Place doors at corridor-room junctions
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            if (map[y][x] !== FLOOR) continue
            // Check for door-like pattern: wall above/below, floor left/right (or vice versa)
            const h = map[y][x-1] === WALL && map[y][x+1] === WALL && map[y-1][x] === FLOOR && map[y+1][x] === FLOOR
            const v = map[y-1][x] === WALL && map[y+1][x] === WALL && map[y][x-1] === FLOOR && map[y][x+1] === FLOOR
            if ((h || v) && rng() > 0.6) {
              map[y][x] = DOOR
            }
          }
        }

        // Place spawn in first room, exit in last room
        if (rooms.length > 0) {
          map[rooms[0].centerY][rooms[0].centerX] = SPAWN
          map[rooms[rooms.length - 1].centerY][rooms[rooms.length - 1].centerX] = EXIT
        }
      }

      // ── Platformer Terrain ──
      else if (type === 'platformer') {
        const platformDensity = params.platform_density ?? 0.4
        const groundHeight = params.ground_height ?? 4
        const maxPlatformWidth = params.max_platform_width ?? 8
        const minPlatformWidth = params.min_platform_width ?? 3
        const gapChance = params.gap_chance ?? 0.15

        // Fill with air (floor = empty)
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            map[y][x] = FLOOR
          }
        }

        // Generate ground terrain with height variation
        const groundLine: number[] = []
        let currentHeight = height - groundHeight
        for (let x = 0; x < width; x++) {
          if (rng() < gapChance && x > 2 && x < width - 3) {
            groundLine.push(-1) // Gap
          } else {
            currentHeight += rngInt(-1, 1)
            currentHeight = Math.max(height - groundHeight - 3, Math.min(height - 2, currentHeight))
            groundLine.push(currentHeight)
          }
        }

        // Fill ground
        for (let x = 0; x < width; x++) {
          if (groundLine[x] < 0) continue
          for (let y = groundLine[x]; y < height; y++) {
            map[y][x] = WALL
          }
        }

        // Generate floating platforms
        const platformCount = Math.floor(width * platformDensity / 3)
        for (let i = 0; i < platformCount; i++) {
          const pw = rngInt(minPlatformWidth, maxPlatformWidth)
          const px = rngInt(1, width - pw - 1)
          const py = rngInt(3, height - groundHeight - 3)
          for (let x = px; x < px + pw && x < width; x++) {
            map[py][x] = PLATFORM
          }
        }

        // Spawn and exit
        for (let x = 1; x < width; x++) {
          if (groundLine[x] >= 0) {
            map[groundLine[x] - 1][x] = SPAWN
            break
          }
        }
        for (let x = width - 2; x >= 0; x--) {
          if (groundLine[x] >= 0) {
            map[groundLine[x] - 1][x] = EXIT
            break
          }
        }

        // Add some collectible/hazard positions (water/lava in pits)
        for (let x = 0; x < width; x++) {
          if (groundLine[x] < 0) {
            map[height - 1][x] = params.pit_hazard === 'lava' ? LAVA : WATER
          }
        }
      }

      // ── Maze (recursive backtracking) ──
      else if (type === 'maze') {
        // Ensure odd dimensions for clean maze
        const mw = width % 2 === 0 ? width - 1 : width
        const mh = height % 2 === 0 ? height - 1 : height

        // Directions: [dx, dy]
        const dirs: [number, number][] = [[0, -2], [0, 2], [-2, 0], [2, 0]]

        function shuffle<T>(arr: T[]): T[] {
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]]
          }
          return arr
        }

        // Iterative backtracking to avoid stack overflow
        const startX = 1, startY = 1
        map[startY][startX] = FLOOR
        const stack: [number, number][] = [[startX, startY]]

        while (stack.length > 0) {
          const [cx, cy] = stack[stack.length - 1]
          const shuffled = shuffle([...dirs])
          let carved = false

          for (const [dx, dy] of shuffled) {
            const nx = cx + dx
            const ny = cy + dy
            if (nx > 0 && nx < mw && ny > 0 && ny < mh && map[ny][nx] === WALL) {
              // Carve passage
              map[cy + dy / 2][cx + dx / 2] = FLOOR
              map[ny][nx] = FLOOR
              stack.push([nx, ny])
              carved = true
              break
            }
          }

          if (!carved) stack.pop()
        }

        // Spawn and exit
        map[1][1] = SPAWN
        // Find furthest reachable cell for exit
        let maxDist = 0, exitX = mw - 2, exitY = mh - 2
        for (let y = 1; y < mh; y += 2) {
          for (let x = 1; x < mw; x += 2) {
            if (map[y][x] === FLOOR) {
              const dist = Math.abs(x - 1) + Math.abs(y - 1)
              if (dist > maxDist) {
                maxDist = dist
                exitX = x
                exitY = y
              }
            }
          }
        }
        map[exitY][exitX] = EXIT
      }

      // ── Overworld (multi-biome) ──
      else if (type === 'overworld') {
        // Simple noise-based biome map
        function noise2D(x: number, y: number, scale: number): number {
          // Simple value noise using seeded PRNG
          const ix = Math.floor(x / scale)
          const iy = Math.floor(y / scale)
          const fx = (x / scale) - ix
          const fy = (y / scale) - iy

          // Hash grid points
          function h(gx: number, gy: number): number {
            let s = seedVal + gx * 374761393 + gy * 668265263
            s = ((s ^ (s >> 13)) * 1274126177) | 0
            return ((s ^ (s >> 16)) >>> 0) / 4294967296
          }

          // Bilinear interpolation with smoothstep
          const sx = fx * fx * (3 - 2 * fx)
          const sy = fy * fy * (3 - 2 * fy)
          const n00 = h(ix, iy), n10 = h(ix + 1, iy)
          const n01 = h(ix, iy + 1), n11 = h(ix + 1, iy + 1)
          return n00 * (1 - sx) * (1 - sy) + n10 * sx * (1 - sy) + n01 * (1 - sx) * sy + n11 * sx * sy
        }

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const elevation = noise2D(x, y, params.noise_scale ?? 8) * 0.6 +
                              noise2D(x, y, (params.noise_scale ?? 8) / 2) * 0.3 +
                              noise2D(x, y, (params.noise_scale ?? 8) / 4) * 0.1
            const moisture = noise2D(x + 100, y + 100, (params.noise_scale ?? 8) * 1.5)

            if (elevation < 0.3) {
              map[y][x] = WATER  // Deep water / ocean
            } else if (elevation < 0.38) {
              map[y][x] = 3  // Shallow water / beach
            } else if (elevation > 0.75) {
              map[y][x] = WALL  // Mountain
            } else if (moisture > 0.6) {
              map[y][x] = 8  // Forest (custom tile)
            } else if (moisture < 0.3) {
              map[y][x] = 9  // Desert (custom tile)
            } else {
              map[y][x] = FLOOR  // Grassland
            }
          }
        }

        // Place spawn and exit
        const spawnX = rngInt(1, width - 2)
        const spawnY = rngInt(1, height - 2)
        map[spawnY][spawnX] = SPAWN
        map[height - spawnY - 1][width - spawnX - 1] = EXIT
      }

      // ── Arena ──
      else if (type === 'arena') {
        const arenaShape = params.shape ?? 'circle'  // circle, rectangle, octagon
        const hasPillars = params.pillars !== false
        const hasCovers = params.covers !== false
        const pillarCount = params.pillar_count ?? 4

        // Fill with floor first
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            map[y][x] = FLOOR
          }
        }

        // Outer walls based on shape
        const cx = width / 2, cy = height / 2
        const rx = width / 2 - 1, ry = height / 2 - 1

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            let outside = false
            if (arenaShape === 'circle') {
              const dx = (x - cx) / rx, dy = (y - cy) / ry
              outside = dx * dx + dy * dy > 1
            } else if (arenaShape === 'octagon') {
              const dx = Math.abs(x - cx), dy = Math.abs(y - cy)
              outside = dx + dy > rx * 1.2 || dx > rx || dy > ry
            } else {
              outside = x === 0 || x === width - 1 || y === 0 || y === height - 1
            }
            if (outside) map[y][x] = WALL
          }
        }

        // Symmetrical pillars
        if (hasPillars) {
          for (let i = 0; i < pillarCount; i++) {
            const angle = (i / pillarCount) * Math.PI * 2
            const dist = Math.min(rx, ry) * 0.5
            const px = Math.floor(cx + Math.cos(angle) * dist)
            const py = Math.floor(cy + Math.sin(angle) * dist)
            const ps = params.pillar_size ?? 1
            for (let dy = -ps; dy <= ps; dy++) {
              for (let dx = -ps; dx <= ps; dx++) {
                const ty = py + dy, tx = px + dx
                if (ty >= 0 && ty < height && tx >= 0 && tx < width) {
                  map[ty][tx] = WALL
                }
              }
            }
          }
        }

        // Cover objects
        if (hasCovers) {
          const coverCount = params.cover_count ?? 6
          for (let i = 0; i < coverCount; i++) {
            const angle = (i / coverCount) * Math.PI * 2 + 0.3
            const dist = Math.min(rx, ry) * (0.3 + rng() * 0.3)
            const px = Math.floor(cx + Math.cos(angle) * dist)
            const py = Math.floor(cy + Math.sin(angle) * dist)
            if (py >= 0 && py < height && px >= 0 && px < width && map[py][px] === FLOOR) {
              map[py][px] = WALL
              // Make cover L-shaped or T-shaped occasionally
              if (rng() > 0.5 && px + 1 < width) map[py][px + 1] = WALL
              if (rng() > 0.5 && py + 1 < height) map[py + 1][px] = WALL
            }
          }
        }

        // Spawn points on opposite sides
        map[Math.floor(cy)][2] = SPAWN
        map[Math.floor(cy)][width - 3] = EXIT
      }

      // ── Tile legend ──
      const legend: Record<number, string> = {
        [WALL]: '#', [FLOOR]: '.', [DOOR]: '+', [WATER]: '~',
        [SPAWN]: 'S', [EXIT]: 'E', [PLATFORM]: '=', [LAVA]: '^',
        8: 'T', 9: ',',  // Forest, Desert for overworld
      }

      // ── Output formatting ──
      let output = ''

      if (format === 'ascii') {
        const lines: string[] = []
        for (let y = 0; y < height; y++) {
          let line = ''
          for (let x = 0; x < width; x++) {
            line += legend[map[y][x]] ?? '?'
          }
          lines.push(line)
        }
        output = `Level: ${type} (${width}x${height}) seed=${seedVal}\n` + lines.join('\n') + '\n'
        if (rooms.length > 0) {
          output += `\nRooms (${rooms.length}):\n`
          for (const r of rooms) {
            output += `  ${r.x},${r.y} ${r.w}x${r.h}\n`
          }
        }
      } else if (format === 'tiled') {
        // Tiled-compatible JSON
        const tiledData = {
          compressionlevel: -1,
          height,
          width,
          infinite: false,
          orientation: 'orthogonal',
          renderorder: 'right-down',
          tiledversion: '1.10.2',
          tileheight: params.tile_size ?? 16,
          tilewidth: params.tile_size ?? 16,
          type: 'map',
          version: '1.10',
          nextlayerid: 3,
          nextobjectid: 1 + rooms.length,
          layers: [
            {
              id: 1,
              name: 'terrain',
              type: 'tilelayer',
              visible: true,
              opacity: 1,
              x: 0,
              y: 0,
              width,
              height,
              // Tiled uses 1-indexed tile IDs, 0 = empty
              data: map.flat().map(v => v + 1),
            },
            {
              id: 2,
              name: 'objects',
              type: 'objectgroup',
              visible: true,
              opacity: 1,
              x: 0,
              y: 0,
              objects: rooms.map((r, i) => ({
                id: i + 1,
                name: `room_${i}`,
                type: 'room',
                x: r.x * (params.tile_size ?? 16),
                y: r.y * (params.tile_size ?? 16),
                width: r.w * (params.tile_size ?? 16),
                height: r.h * (params.tile_size ?? 16),
                visible: true,
              })),
            },
          ],
          tilesets: [
            {
              firstgid: 1,
              name: 'tileset',
              tilecount: 10,
              tilewidth: params.tile_size ?? 16,
              tileheight: params.tile_size ?? 16,
              tiles: [
                { id: 0, type: 'floor' },
                { id: 1, type: 'wall' },
                { id: 2, type: 'door' },
                { id: 3, type: 'water' },
                { id: 4, type: 'spawn' },
                { id: 5, type: 'exit' },
                { id: 6, type: 'platform' },
                { id: 7, type: 'lava' },
                { id: 8, type: 'forest' },
                { id: 9, type: 'desert' },
              ],
            },
          ],
          properties: [
            { name: 'generator', type: 'string', value: 'kbot level_generate' },
            { name: 'type', type: 'string', value: type },
            { name: 'seed', type: 'int', value: seedVal },
          ],
        }
        output = JSON.stringify(tiledData, null, 2)
      } else {
        // Generic JSON
        const floorCount = map.flat().filter(t => t === FLOOR).length
        const wallCount = map.flat().filter(t => t === WALL).length
        const jsonData = {
          meta: {
            type,
            width,
            height,
            seed: seedVal,
            generator: 'kbot level_generate',
            rooms: rooms.length,
            floor_tiles: floorCount,
            wall_tiles: wallCount,
            openness: parseFloat((floorCount / (width * height) * 100).toFixed(1)),
          },
          legend: {
            0: 'floor', 1: 'wall', 2: 'door', 3: 'water',
            4: 'spawn', 5: 'exit', 6: 'platform', 7: 'lava',
            8: 'forest', 9: 'desert',
          },
          map,
          rooms: rooms.map((r, i) => ({
            id: i,
            x: r.x, y: r.y, w: r.w, h: r.h,
            center: { x: r.centerX, y: r.centerY },
          })),
        }
        output = JSON.stringify(jsonData, null, 2)
      }

      ensureDir(dirname(outputPath))
      writeFileSync(outputPath, output)

      const floorCount = map.flat().filter(t => t === FLOOR || t === SPAWN || t === EXIT || t === DOOR).length
      return `Level generated:
  Type: ${type}
  Size: ${width}x${height}
  Seed: ${seedVal}
  Format: ${format}
  Output: ${outputPath} (${output.length} bytes)
  Rooms: ${rooms.length}
  Openness: ${(floorCount / (width * height) * 100).toFixed(1)}%${format === 'ascii' ? '\n\nPreview:\n' + output.split('\n').slice(0, Math.min(height + 1, 35)).join('\n') : ''}`
    },
  })

  // ── Tool 10: Tilemap Auto-Tiling Generator ──────────────────────────
  registerTool({
    name: 'tilemap_generate',
    description: 'Generate bitmask-based auto-tiling rules and tilemap data. Supports blob 47-tile, Wang 16-tile, and simple 4-tile tilesets with terrain definitions for grass, stone, water, sand, snow, and lava.',
    parameters: {
      tileset_type: { type: 'string', description: 'Tileset type: blob_47, wang_16, simple_4', required: true },
      terrain: { type: 'string', description: 'Terrain type: grass, stone, water, sand, snow, lava', required: true },
      map_data: { type: 'string', description: 'JSON 2D array of 0/1 (0=empty, 1=terrain). If omitted, auto-generates a sample map.' },
      output_path: { type: 'string', description: 'Output file path', required: true },
      format: { type: 'string', description: 'Output format: godot, tiled, json (default: json)' },
    },
    tier: 'free',
    async execute(args) {
      const tilesetType = String(args.tileset_type).toLowerCase()
      const terrain = String(args.terrain).toLowerCase()
      const outputPath = safePath(String(args.output_path))
      const format = String(args.format || 'json') as 'godot' | 'tiled' | 'json'

      const validTypes = ['blob_47', 'wang_16', 'simple_4']
      const validTerrains = ['grass', 'stone', 'water', 'sand', 'snow', 'lava']
      if (!validTypes.includes(tilesetType)) return `Error: Invalid tileset_type "${tilesetType}". Use: ${validTypes.join(', ')}`
      if (!validTerrains.includes(terrain)) return `Error: Invalid terrain "${terrain}". Use: ${validTerrains.join(', ')}`
      if (!['godot', 'tiled', 'json'].includes(format)) return `Error: Invalid format "${format}". Use: godot, tiled, json`

      // Parse or generate map data
      let mapData: number[][]
      if (args.map_data) {
        try { mapData = JSON.parse(String(args.map_data)) } catch { return 'Error: map_data must be valid JSON' }
      } else {
        // Auto-generate a sample terrain map
        const w = 16, h = 12
        mapData = Array.from({ length: h }, () => Array(w).fill(0))
        // Create some terrain blobs
        const cx1 = 4, cy1 = 3, cx2 = 11, cy2 = 7
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const d1 = Math.sqrt((x - cx1) ** 2 + (y - cy1) ** 2)
            const d2 = Math.sqrt((x - cx2) ** 2 + (y - cy2) ** 2)
            if (d1 < 3.5 || d2 < 4 || (y >= 5 && y <= 7 && x >= 3 && x <= 12)) {
              mapData[y][x] = 1
            }
          }
        }
      }

      const mapH = mapData.length
      const mapW = mapData[0]?.length ?? 0
      if (mapW === 0 || mapH === 0) return 'Error: Invalid map_data — must be a non-empty 2D array'

      // Helper: get tile value with bounds checking (out of bounds = 0)
      function getTile(x: number, y: number): number {
        if (x < 0 || x >= mapW || y < 0 || y >= mapH) return 0
        return mapData[y][x] ? 1 : 0
      }

      // ── Bitmask calculation ──
      // Neighbor bit positions:
      //   NW(1)  N(2)  NE(4)
      //   W(8)   C     E(16)
      //   SW(32) S(64) SE(128)

      function calc8BitMask(x: number, y: number): number {
        if (!getTile(x, y)) return -1 // Not terrain
        let mask = 0
        const n  = getTile(x, y - 1)
        const s  = getTile(x, y + 1)
        const w  = getTile(x - 1, y)
        const e  = getTile(x + 1, y)
        const nw = getTile(x - 1, y - 1)
        const ne = getTile(x + 1, y - 1)
        const sw = getTile(x - 1, y + 1)
        const se = getTile(x + 1, y + 1)

        if (n) mask |= 2
        if (s) mask |= 64
        if (w) mask |= 8
        if (e) mask |= 16
        // Corners only count if both adjacent cardinals are set
        if (nw && n && w) mask |= 1
        if (ne && n && e) mask |= 4
        if (sw && s && w) mask |= 32
        if (se && s && e) mask |= 128
        return mask
      }

      function calc4BitMask(x: number, y: number): number {
        if (!getTile(x, y)) return -1
        let mask = 0
        if (getTile(x, y - 1)) mask |= 1  // N
        if (getTile(x + 1, y)) mask |= 2  // E
        if (getTile(x, y + 1)) mask |= 4  // S
        if (getTile(x - 1, y)) mask |= 8  // W
        return mask
      }

      // ── Blob 47 reduction ──
      // The 8-bit mask produces 256 possible values, but many are equivalent.
      // The standard "blob" tileset reduces to 47 unique tiles.
      // Map each 8-bit mask to a blob47 tile index.
      const blob47Map: Record<number, number> = {}
      // Canonical 47-tile bitmask values
      const blob47Canonical = [
        0, 2, 8, 10, 16, 18, 24, 26, 64, 66, 72, 74, 80, 82, 88, 90,
        // With corners
        11, 22, 27, 30, 31, 66, 75, 82, 86, 90, 91, 94, 95,
        104, 106, 107, 120, 122, 123, 126, 127,
        208, 210, 214, 216, 218, 219, 222, 223,
        248, 250, 251, 254, 255,
      ]
      // Build a simplified lookup: for tiles not in the canonical set,
      // strip unnecessary corner bits and match to nearest
      function reduceToBlob47(mask: number): number {
        // Already a known value?
        const idx = blob47Canonical.indexOf(mask)
        if (idx >= 0) return idx

        // Strip corner bits where adjacent cardinals are missing
        let reduced = mask
        if (!(mask & 2) || !(mask & 8)) reduced &= ~1     // NW needs N and W
        if (!(mask & 2) || !(mask & 16)) reduced &= ~4    // NE needs N and E
        if (!(mask & 64) || !(mask & 8)) reduced &= ~32   // SW needs S and W
        if (!(mask & 64) || !(mask & 16)) reduced &= ~128 // SE needs S and E

        const idx2 = blob47Canonical.indexOf(reduced)
        if (idx2 >= 0) return idx2

        // Fallback: count cardinals only (4-bit reduction to 16 basic tiles)
        const card = (reduced & 2 ? 1 : 0) | (reduced & 16 ? 2 : 0) |
                     (reduced & 64 ? 4 : 0) | (reduced & 8 ? 8 : 0)
        return card
      }

      // ── Wang 16 tile mapping ──
      // Wang tiles use 4-bit cardinal mask → 16 tiles
      const wang16Names = [
        'isolated',     // 0000
        'end_s',        // 0001 N
        'end_w',        // 0010 E
        'corner_sw',    // 0011 N+E
        'end_n',        // 0100 S
        'vertical',     // 0101 N+S
        'corner_nw',    // 0110 S+E
        'tee_w',        // 0111 N+S+E
        'end_e',        // 1000 W
        'corner_se',    // 1001 N+W
        'horizontal',   // 1010 E+W
        'tee_s',        // 1011 N+E+W
        'corner_ne',    // 1100 S+W
        'tee_e',        // 1101 N+S+W
        'tee_n',        // 1110 S+E+W
        'cross',        // 1111 all
      ]

      // ── Compute tiled map ──
      const tiledMap: number[][] = Array.from({ length: mapH }, () => Array(mapW).fill(0))

      for (let y = 0; y < mapH; y++) {
        for (let x = 0; x < mapW; x++) {
          if (!getTile(x, y)) {
            tiledMap[y][x] = -1 // Empty
            continue
          }
          if (tilesetType === 'blob_47') {
            const mask = calc8BitMask(x, y)
            tiledMap[y][x] = mask >= 0 ? reduceToBlob47(mask) : -1
          } else if (tilesetType === 'wang_16') {
            tiledMap[y][x] = calc4BitMask(x, y)
          } else {
            // simple_4: just cardinal neighbors
            tiledMap[y][x] = calc4BitMask(x, y)
          }
        }
      }

      // ── Terrain color palettes ──
      const terrainColors: Record<string, { primary: string; secondary: string; accent: string }> = {
        grass: { primary: '#4a8c3f', secondary: '#6aad5a', accent: '#3a6e30' },
        stone: { primary: '#888888', secondary: '#aaaaaa', accent: '#666666' },
        water: { primary: '#3366cc', secondary: '#5588ee', accent: '#224499' },
        sand: { primary: '#d4b86a', secondary: '#e8d08a', accent: '#b8984a' },
        snow: { primary: '#e8e8f0', secondary: '#ffffff', accent: '#c8c8d8' },
        lava: { primary: '#cc3300', secondary: '#ff6600', accent: '#881100' },
      }
      const colors = terrainColors[terrain]

      // ── Format output ──
      let output = ''
      const tileCount = tilesetType === 'blob_47' ? 47 : tilesetType === 'wang_16' ? 16 : 4

      if (format === 'godot') {
        // Godot TileSet resource format
        output = `; Godot TileSet Resource — ${terrain} (${tilesetType}) — generated by kbot
; Import this as a .tres file

[gd_resource type="TileSet" format=3]

[resource]
tile_shape = 0  ; Square
tile_size = Vector2i(16, 16)

; Terrain set
terrains_sets/0/name = "${terrain}"
terrains_sets/0/mode = 0  ; Match corners and sides

; Terrain definition
terrains_sets/0/terrains/0/name = "${terrain}"
terrains_sets/0/terrains/0/color = Color(${parseInt(colors.primary.slice(1, 3), 16) / 255}, ${parseInt(colors.primary.slice(3, 5), 16) / 255}, ${parseInt(colors.primary.slice(5, 7), 16) / 255}, 1)

; Tile definitions (${tileCount} tiles)
${tilesetType === 'wang_16' ? wang16Names.map((name, i) => {
          const cardN = (i & 1) ? 1 : 0
          const cardE = (i & 2) ? 1 : 0
          const cardS = (i & 4) ? 1 : 0
          const cardW = (i & 8) ? 1 : 0
          return `; Tile ${i}: ${name} (N=${cardN} E=${cardE} S=${cardS} W=${cardW})
tile_${i}/terrain_set = 0
tile_${i}/terrain_peering/top = ${cardN ? 0 : -1}
tile_${i}/terrain_peering/right = ${cardE ? 0 : -1}
tile_${i}/terrain_peering/bottom = ${cardS ? 0 : -1}
tile_${i}/terrain_peering/left = ${cardW ? 0 : -1}`
        }).join('\n\n') :
        `; ${tilesetType} tiles — see tile index mapping in the JSON output for full bitmask table`}

; Map data (${mapW}x${mapH})
; Use TileMapLayer.set_cell() to place tiles:
; for y in range(${mapH}):
;   for x in range(${mapW}):
;     tile_map.set_cell(Vector2i(x, y), 0, Vector2i(tile_data[y][x], 0))

; tile_data = ${JSON.stringify(tiledMap)}
`
      } else if (format === 'tiled') {
        // Tiled JSON format
        const tiledOutput = {
          compressionlevel: -1,
          height: mapH,
          width: mapW,
          infinite: false,
          orientation: 'orthogonal',
          renderorder: 'right-down',
          tiledversion: '1.10.2',
          tileheight: 16,
          tilewidth: 16,
          type: 'map',
          version: '1.10',
          layers: [
            {
              id: 1,
              name: terrain,
              type: 'tilelayer',
              visible: true,
              opacity: 1,
              x: 0, y: 0,
              width: mapW,
              height: mapH,
              // Tiled uses 1-indexed (0 = empty), so add 2 to our indices (which are -1 for empty, 0+ for tiles)
              data: tiledMap.flat().map(v => v < 0 ? 0 : v + 1),
            },
          ],
          tilesets: [
            {
              firstgid: 1,
              name: `${terrain}_${tilesetType}`,
              tilecount: tileCount,
              columns: tilesetType === 'blob_47' ? 8 : tilesetType === 'wang_16' ? 4 : 2,
              tilewidth: 16,
              tileheight: 16,
              ...(tilesetType === 'wang_16' ? {
                wangsets: [{
                  name: terrain,
                  type: 'corner',
                  colors: [{ color: colors.primary, name: terrain, probability: 1 }],
                  wangtiles: wang16Names.map((_, i) => ({
                    tileid: i,
                    wangid: [
                      0, (i & 1) ? 1 : 0, 0, (i & 2) ? 1 : 0,
                      0, (i & 4) ? 1 : 0, 0, (i & 8) ? 1 : 0,
                    ],
                  })),
                }],
              } : {}),
              tiles: Array.from({ length: tileCount }, (_, i) => ({
                id: i,
                type: tilesetType === 'wang_16' ? wang16Names[i] : `tile_${i}`,
              })),
            },
          ],
          properties: [
            { name: 'terrain', type: 'string', value: terrain },
            { name: 'tileset_type', type: 'string', value: tilesetType },
            { name: 'generator', type: 'string', value: 'kbot tilemap_generate' },
          ],
        }
        output = JSON.stringify(tiledOutput, null, 2)
      } else {
        // Generic JSON
        const jsonOutput = {
          meta: {
            terrain,
            tileset_type: tilesetType,
            tile_count: tileCount,
            map_size: { width: mapW, height: mapH },
            colors,
            generator: 'kbot tilemap_generate',
          },
          tileset: {
            type: tilesetType,
            tiles: tilesetType === 'wang_16'
              ? wang16Names.map((name, i) => ({
                  id: i,
                  name,
                  bitmask: i,
                  neighbors: {
                    north: !!(i & 1),
                    east: !!(i & 2),
                    south: !!(i & 4),
                    west: !!(i & 8),
                  },
                }))
              : tilesetType === 'simple_4'
              ? [
                  { id: 0, name: 'isolated', bitmask: 0 },
                  { id: 1, name: 'single_neighbor', bitmask: 'varies' },
                  { id: 2, name: 'two_neighbors', bitmask: 'varies' },
                  { id: 3, name: 'surrounded', bitmask: 15 },
                ]
              : Array.from({ length: 47 }, (_, i) => ({
                  id: i,
                  bitmask: i < blob47Canonical.length ? blob47Canonical[i] : i,
                })),
          },
          source_map: mapData,
          auto_tiled_map: tiledMap,
          bitmask_rules: tilesetType === 'wang_16' ? {
            description: '4-bit cardinal bitmask (N=1, E=2, S=4, W=8)',
            examples: {
              isolated: 0,
              horizontal: 10,
              vertical: 5,
              cross: 15,
              corner_ne: 12,
            },
          } : tilesetType === 'blob_47' ? {
            description: '8-bit bitmask with corner pruning (NW=1, N=2, NE=4, W=8, E=16, SW=32, S=64, SE=128)',
            note: 'Corners only counted when both adjacent cardinal neighbors are present. 256 possible masks reduced to 47 unique tiles.',
          } : {
            description: 'Simple 4-tile system based on neighbor count',
          },
        }
        output = JSON.stringify(jsonOutput, null, 2)
      }

      ensureDir(dirname(outputPath))
      writeFileSync(outputPath, output)

      const terrainTileCount = tiledMap.flat().filter(t => t >= 0).length
      return `Tilemap generated:
  Tileset: ${tilesetType} (${tileCount} tiles)
  Terrain: ${terrain}
  Map: ${mapW}x${mapH} (${terrainTileCount} terrain tiles)
  Format: ${format}
  Output: ${outputPath} (${output.length} bytes)
  Colors: ${colors.primary} / ${colors.secondary} / ${colors.accent}`
    },
  })

  // ── Tool 11: Navigation Mesh Configuration ──────────────────────────
  registerTool({
    name: 'navmesh_config',
    description: 'Generate engine-specific navigation mesh configuration and pathfinding helper code. Supports humanoid, vehicle, flying, and small creature agent types with appropriate defaults across 5 navigation systems.',
    parameters: {
      engine: { type: 'string', description: 'Navigation engine: godot, unity, unreal, recast, three (default: recast)' },
      agent_type: { type: 'string', description: 'Agent type: humanoid, vehicle, flying, small_creature (default: humanoid)' },
      output_path: { type: 'string', description: 'Output file path', required: true },
      params: { type: 'string', description: 'JSON overrides: agent_radius, agent_height, step_height, slope_angle, cell_size, cell_height, etc.' },
    },
    tier: 'free',
    async execute(args) {
      const engine = String(args.engine || 'recast').toLowerCase()
      const agentType = String(args.agent_type || 'humanoid').toLowerCase()
      const outputPath = safePath(String(args.output_path))
      let overrides: any = {}
      try { overrides = args.params ? JSON.parse(String(args.params)) : {} } catch { return 'Error: params must be valid JSON' }

      const validEngines = ['godot', 'unity', 'unreal', 'recast', 'three']
      const validAgents = ['humanoid', 'vehicle', 'flying', 'small_creature']
      if (!validEngines.includes(engine)) return `Error: Invalid engine "${engine}". Use: ${validEngines.join(', ')}`
      if (!validAgents.includes(agentType)) return `Error: Invalid agent_type "${agentType}". Use: ${validAgents.join(', ')}`

      // Agent-type defaults
      interface AgentConfig {
        radius: number
        height: number
        step_height: number
        max_slope: number
        max_speed: number
        acceleration: number
        cell_size: number
        cell_height: number
        region_min_size: number
        region_merge_size: number
        edge_max_len: number
        edge_max_error: number
        detail_sample_dist: number
        detail_sample_max_error: number
        avoidance_radius: number
        path_recalc_interval: number
      }

      const agentDefaults: Record<string, AgentConfig> = {
        humanoid: {
          radius: 0.4, height: 1.8, step_height: 0.4, max_slope: 45,
          max_speed: 3.5, acceleration: 8.0, cell_size: 0.3, cell_height: 0.2,
          region_min_size: 8, region_merge_size: 20, edge_max_len: 12,
          edge_max_error: 1.3, detail_sample_dist: 6, detail_sample_max_error: 1,
          avoidance_radius: 0.8, path_recalc_interval: 0.5,
        },
        vehicle: {
          radius: 1.5, height: 2.0, step_height: 0.2, max_slope: 20,
          max_speed: 15.0, acceleration: 5.0, cell_size: 0.5, cell_height: 0.3,
          region_min_size: 20, region_merge_size: 40, edge_max_len: 20,
          edge_max_error: 2.0, detail_sample_dist: 8, detail_sample_max_error: 2,
          avoidance_radius: 3.0, path_recalc_interval: 1.0,
        },
        flying: {
          radius: 0.5, height: 1.0, step_height: 10.0, max_slope: 90,
          max_speed: 8.0, acceleration: 12.0, cell_size: 0.4, cell_height: 0.4,
          region_min_size: 4, region_merge_size: 10, edge_max_len: 15,
          edge_max_error: 1.5, detail_sample_dist: 6, detail_sample_max_error: 1,
          avoidance_radius: 1.0, path_recalc_interval: 0.3,
        },
        small_creature: {
          radius: 0.15, height: 0.4, step_height: 0.15, max_slope: 60,
          max_speed: 5.0, acceleration: 15.0, cell_size: 0.1, cell_height: 0.1,
          region_min_size: 4, region_merge_size: 8, edge_max_len: 6,
          edge_max_error: 0.8, detail_sample_dist: 3, detail_sample_max_error: 0.5,
          avoidance_radius: 0.3, path_recalc_interval: 0.2,
        },
      }

      const cfg = { ...agentDefaults[agentType] }
      // Apply overrides
      if (overrides.agent_radius !== undefined) cfg.radius = overrides.agent_radius
      if (overrides.agent_height !== undefined) cfg.height = overrides.agent_height
      if (overrides.step_height !== undefined) cfg.step_height = overrides.step_height
      if (overrides.slope_angle !== undefined) cfg.max_slope = overrides.slope_angle
      if (overrides.max_speed !== undefined) cfg.max_speed = overrides.max_speed
      if (overrides.acceleration !== undefined) cfg.acceleration = overrides.acceleration
      if (overrides.cell_size !== undefined) cfg.cell_size = overrides.cell_size
      if (overrides.cell_height !== undefined) cfg.cell_height = overrides.cell_height

      let code = ''

      if (engine === 'recast') {
        code = `// Recast Navigation — ${agentType} agent — generated by kbot
// Recast/Detour navmesh configuration and pathfinding helpers
// Use with recast-navigation-js or the C++ Recast library

import Recast from 'recast-navigation';

export const NAVMESH_CONFIG = {
  // Rasterization
  cellSize: ${cfg.cell_size},        // XZ cell size (smaller = more detail, slower build)
  cellHeight: ${cfg.cell_height},      // Y cell height

  // Agent
  agentRadius: ${cfg.radius},      // Agent cylinder radius
  agentHeight: ${cfg.height},       // Agent cylinder height
  agentMaxClimb: ${cfg.step_height},  // Maximum step height
  agentMaxSlope: ${cfg.max_slope},      // Maximum walkable slope in degrees

  // Region
  regionMinSize: ${cfg.region_min_size},       // Minimum region area (cells)
  regionMergeSize: ${cfg.region_merge_size},     // Region merge threshold

  // Polygonization
  edgeMaxLen: ${cfg.edge_max_len},        // Maximum edge length (cells)
  edgeMaxError: ${cfg.edge_max_error},      // Maximum edge deviation
  vertsPerPoly: 6,          // Max vertices per polygon (6 = good default)

  // Detail mesh
  detailSampleDist: ${cfg.detail_sample_dist},   // Detail mesh sample distance
  detailSampleMaxError: ${cfg.detail_sample_max_error}, // Detail mesh max error
};

// Initialize Recast
const recast = await Recast.init();

export interface NavAgent {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number } | null;
  path: Array<{ x: number; y: number; z: number }>;
  pathIndex: number;
  speed: number;
  radius: number;
}

/**
 * Build navmesh from geometry vertices and indices.
 */
export function buildNavMesh(
  vertices: Float32Array,
  indices: Int32Array
): Recast.NavMesh {
  const navMesh = new recast.NavMesh();
  navMesh.build(vertices, indices, NAVMESH_CONFIG);
  return navMesh;
}

/**
 * Find a path between two points on the navmesh.
 */
export function findPath(
  navMesh: Recast.NavMesh,
  start: { x: number; y: number; z: number },
  end: { x: number; y: number; z: number }
): Array<{ x: number; y: number; z: number }> {
  const query = new recast.NavMeshQuery(navMesh);
  const filter = new recast.QueryFilter();

  // Find nearest polys to start and end
  const extents = { x: ${cfg.radius * 4}, y: ${cfg.height * 2}, z: ${cfg.radius * 4} };
  const startRef = query.findNearestPoly(start, extents, filter);
  const endRef = query.findNearestPoly(end, extents, filter);

  if (!startRef.success || !endRef.success) return [];

  // Find path corridor
  const pathResult = query.findPath(startRef.nearestRef, endRef.nearestRef, start, end, filter);
  if (!pathResult.success || pathResult.path.length === 0) return [];

  // Convert corridor to smooth path using string pulling
  const smoothPath = query.findStraightPath(start, end, pathResult.path, 256);
  if (!smoothPath.success) return [start, end];

  return smoothPath.straightPath.map((p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y, z: p.z }));
}

/**
 * Create a navigation agent that follows paths.
 */
export function createAgent(
  position: { x: number; y: number; z: number },
  speed = ${cfg.max_speed}
): NavAgent {
  return {
    position: { ...position },
    target: null,
    path: [],
    pathIndex: 0,
    speed,
    radius: ${cfg.radius},
  };
}

/**
 * Update agent movement along its current path.
 * Returns true if the agent reached its target.
 */
export function updateAgent(agent: NavAgent, dt: number): boolean {
  if (agent.path.length === 0 || agent.pathIndex >= agent.path.length) return true;

  const target = agent.path[agent.pathIndex];
  const dx = target.x - agent.position.x;
  const dy = target.y - agent.position.y;
  const dz = target.z - agent.position.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (dist < ${cfg.radius}) {
    agent.pathIndex++;
    return agent.pathIndex >= agent.path.length;
  }

  const moveSpeed = Math.min(agent.speed * dt, dist);
  const factor = moveSpeed / dist;
  agent.position.x += dx * factor;
  agent.position.y += dy * factor;
  agent.position.z += dz * factor;

  return false;
}

/**
 * Set a new navigation target for the agent.
 */
export function navigateTo(
  agent: NavAgent,
  navMesh: Recast.NavMesh,
  target: { x: number; y: number; z: number }
): boolean {
  agent.target = { ...target };
  agent.path = findPath(navMesh, agent.position, target);
  agent.pathIndex = 0;
  return agent.path.length > 0;
}

/**
 * Check if a point is on the navmesh (walkable).
 */
export function isPointOnNavMesh(
  navMesh: Recast.NavMesh,
  point: { x: number; y: number; z: number },
  tolerance = ${cfg.radius * 2}
): boolean {
  const query = new recast.NavMeshQuery(navMesh);
  const filter = new recast.QueryFilter();
  const result = query.findNearestPoly(point, { x: tolerance, y: ${cfg.height}, z: tolerance }, filter);
  return result.success;
}

/**
 * Find a random walkable point on the navmesh (for wandering AI).
 */
export function getRandomPoint(
  navMesh: Recast.NavMesh
): { x: number; y: number; z: number } | null {
  const query = new recast.NavMeshQuery(navMesh);
  const filter = new recast.QueryFilter();
  const result = query.findRandomPoint(filter);
  return result.success ? result.randomPoint : null;
}
`
      } else if (engine === 'godot') {
        code = `# Godot 4 NavigationAgent3D — ${agentType} — generated by kbot
extends CharacterBody3D

# Navigation configuration
@export_group("Navigation")
@export var move_speed := ${cfg.max_speed}
@export var acceleration := ${cfg.acceleration}
@export var agent_radius := ${cfg.radius}
@export var agent_height := ${cfg.height}
@export var path_recalc_interval := ${cfg.path_recalc_interval}

var navigation_agent: NavigationAgent3D
var target_position: Vector3
var path_recalc_timer := 0.0

func _ready() -> void:
    # Create and configure NavigationAgent3D
    navigation_agent = NavigationAgent3D.new()
    add_child(navigation_agent)

    navigation_agent.path_desired_distance = ${(cfg.radius * 1.5).toFixed(2)}
    navigation_agent.target_desired_distance = ${(cfg.radius * 2).toFixed(2)}
    navigation_agent.radius = ${cfg.radius}
    navigation_agent.height = ${cfg.height}
    navigation_agent.max_speed = ${cfg.max_speed}
    navigation_agent.path_max_distance = ${(cfg.radius * 4).toFixed(1)}
    navigation_agent.avoidance_enabled = true
    navigation_agent.neighbor_distance = ${(cfg.avoidance_radius * 5).toFixed(1)}
    navigation_agent.max_neighbors = 10

    # Navigation map settings (apply to the NavigationServer3D)
    var map_rid := NavigationServer3D.get_maps()[0]
    NavigationServer3D.map_set_cell_size(map_rid, ${cfg.cell_size})
    NavigationServer3D.map_set_cell_height(map_rid, ${cfg.cell_height})
    NavigationServer3D.map_set_edge_connection_margin(map_rid, ${(cfg.radius * 0.5).toFixed(2)})

    # For NavigationRegion3D baking (attach a NavigationMesh resource):
    # var nav_mesh := NavigationMesh.new()
    # nav_mesh.agent_radius = ${cfg.radius}
    # nav_mesh.agent_height = ${cfg.height}
    # nav_mesh.agent_max_climb = ${cfg.step_height}
    # nav_mesh.agent_max_slope = ${cfg.max_slope}
    # nav_mesh.cell_size = ${cfg.cell_size}
    # nav_mesh.cell_height = ${cfg.cell_height}
    # nav_mesh.region_min_size = ${cfg.region_min_size}
    # nav_mesh.region_merge_size = ${cfg.region_merge_size}
    # nav_mesh.edge_max_length = ${cfg.edge_max_len}
    # nav_mesh.edge_max_error = ${cfg.edge_max_error}
    # nav_mesh.detail_sample_distance = ${cfg.detail_sample_dist}
    # nav_mesh.detail_sample_max_error = ${cfg.detail_sample_max_error}

func _physics_process(delta: float) -> void:
    if navigation_agent.is_navigation_finished():
        return

    # Get next path position
    var next_pos := navigation_agent.get_next_path_position()
    var direction := (next_pos - global_position).normalized()
${agentType === 'flying' ? `
    # Flying agent — move in 3D
    velocity = velocity.lerp(direction * move_speed, acceleration * delta)
    move_and_slide()
    # Face movement direction
    if velocity.length() > 0.1:
        look_at(global_position + velocity.normalized())
` : `
    # Ground agent — move on XZ plane
    direction.y = 0
    direction = direction.normalized()
    velocity.x = lerp(velocity.x, direction.x * move_speed, acceleration * delta)
    velocity.z = lerp(velocity.z, direction.z * move_speed, acceleration * delta)
    # Apply gravity
    if not is_on_floor():
        velocity.y -= 9.81 * delta
    move_and_slide()
    # Face movement direction
    if direction.length() > 0.1:
        var target_rot := atan2(direction.x, direction.z)
        rotation.y = lerp_angle(rotation.y, target_rot, 10.0 * delta)
`}
    # Periodic path recalculation
    path_recalc_timer += delta
    if path_recalc_timer >= path_recalc_interval:
        path_recalc_timer = 0.0
        if target_position != Vector3.ZERO:
            navigate_to(target_position)

## Set a new navigation target
func navigate_to(target: Vector3) -> void:
    target_position = target
    navigation_agent.target_position = target

## Check if a point is reachable
func is_reachable(point: Vector3) -> bool:
    var map_rid := navigation_agent.get_navigation_map()
    var closest := NavigationServer3D.map_get_closest_point(map_rid, point)
    return closest.distance_to(point) < agent_radius * 2

## Get a random walkable point (for patrol/wander)
func get_random_nav_point() -> Vector3:
    var map_rid := navigation_agent.get_navigation_map()
    var regions := NavigationServer3D.map_get_regions(map_rid)
    if regions.is_empty():
        return global_position
    # Get random point on the navmesh
    var random_point := NavigationServer3D.region_get_random_point(
        regions[randi() % regions.size()],
        navigation_agent.get_navigation_map(),
        true
    )
    return random_point

## Patrol between a list of waypoints
var patrol_points: Array[Vector3] = []
var patrol_index := 0

func start_patrol(points: Array[Vector3]) -> void:
    patrol_points = points
    patrol_index = 0
    if patrol_points.size() > 0:
        navigate_to(patrol_points[0])

func _on_navigation_finished() -> void:
    if patrol_points.size() > 0:
        patrol_index = (patrol_index + 1) % patrol_points.size()
        navigate_to(patrol_points[patrol_index])
`
      } else if (engine === 'unity') {
        code = `// Unity NavMesh Agent — ${agentType} — generated by kbot
using UnityEngine;
using UnityEngine.AI;
using System.Collections.Generic;

[RequireComponent(typeof(NavMeshAgent))]
public class NavigationController : MonoBehaviour
{
    [Header("Agent Settings (${agentType})")]
    [SerializeField] private float moveSpeed = ${cfg.max_speed}f;
    [SerializeField] private float acceleration = ${cfg.acceleration}f;
    [SerializeField] private float agentRadius = ${cfg.radius}f;
    [SerializeField] private float agentHeight = ${cfg.height}f;
    [SerializeField] private float stepHeight = ${cfg.step_height}f;
    [SerializeField] private float maxSlope = ${cfg.max_slope}f;
    [SerializeField] private float avoidanceRadius = ${cfg.avoidance_radius}f;
    [SerializeField] private float pathRecalcInterval = ${cfg.path_recalc_interval}f;

    [Header("Patrol")]
    [SerializeField] private Transform[] patrolPoints;
    [SerializeField] private bool loopPatrol = true;

    private NavMeshAgent agent;
    private int currentPatrolIndex = 0;
    private float pathRecalcTimer = 0f;
    private Vector3? pendingTarget = null;

    void Start()
    {
        agent = GetComponent<NavMeshAgent>();

        // Configure agent for ${agentType}
        agent.speed = moveSpeed;
        agent.acceleration = acceleration;
        agent.radius = agentRadius;
        agent.height = agentHeight;
        agent.baseOffset = agentHeight / 2f;
        agent.angularSpeed = ${agentType === 'vehicle' ? '60f' : '120f'};
        agent.stoppingDistance = agentRadius * 2f;
        agent.autoBraking = true;
        agent.obstacleAvoidanceType = ObstacleAvoidanceType.HighQualityObstacleAvoidance;
        agent.avoidancePriority = 50;

        // NavMesh build settings (apply in Navigation window or via script):
        // Agent Type:
        //   Radius: ${cfg.radius}
        //   Height: ${cfg.height}
        //   Step Height: ${cfg.step_height}
        //   Max Slope: ${cfg.max_slope}
        // Bake Settings:
        //   Cell Size: ${cfg.cell_size}  (Voxel Size in Unity)
        //   Region Min Size: ${cfg.region_min_size}
        //   Merge Distance: ${cfg.region_merge_size * cfg.cell_size}

        // Start patrol if points are assigned
        if (patrolPoints != null && patrolPoints.Length > 0)
            NavigateTo(patrolPoints[0].position);
    }

    void Update()
    {
        // Path recalculation
        pathRecalcTimer += Time.deltaTime;
        if (pendingTarget.HasValue && pathRecalcTimer >= pathRecalcInterval)
        {
            pathRecalcTimer = 0f;
            agent.SetDestination(pendingTarget.Value);
        }

        // Check if reached destination
        if (!agent.pathPending && agent.remainingDistance <= agent.stoppingDistance)
        {
            OnReachedDestination();
        }
    }

    /// <summary>Navigate to a world position.</summary>
    public bool NavigateTo(Vector3 target)
    {
        pendingTarget = target;
        NavMeshHit hit;
        if (NavMesh.SamplePosition(target, out hit, agentRadius * 4f, NavMesh.AllAreas))
        {
            agent.SetDestination(hit.position);
            return true;
        }
        return false;
    }

    /// <summary>Check if a position is reachable.</summary>
    public bool IsReachable(Vector3 target)
    {
        NavMeshPath path = new NavMeshPath();
        agent.CalculatePath(target, path);
        return path.status == NavMeshPathStatus.PathComplete;
    }

    /// <summary>Get a random walkable point within a radius.</summary>
    public Vector3? GetRandomNavPoint(float radius)
    {
        Vector3 randomDir = Random.insideUnitSphere * radius + transform.position;
        NavMeshHit hit;
        if (NavMesh.SamplePosition(randomDir, out hit, radius, NavMesh.AllAreas))
            return hit.position;
        return null;
    }

    /// <summary>Get the nearest point on the navmesh.</summary>
    public Vector3? GetNearestNavPoint(Vector3 point, float maxDistance = 10f)
    {
        NavMeshHit hit;
        if (NavMesh.SamplePosition(point, out hit, maxDistance, NavMesh.AllAreas))
            return hit.position;
        return null;
    }

    private void OnReachedDestination()
    {
        pendingTarget = null;

        // Patrol logic
        if (patrolPoints != null && patrolPoints.Length > 0)
        {
            currentPatrolIndex++;
            if (currentPatrolIndex >= patrolPoints.Length)
            {
                if (loopPatrol) currentPatrolIndex = 0;
                else return;
            }
            NavigateTo(patrolPoints[currentPatrolIndex].position);
        }
    }

    void OnDrawGizmosSelected()
    {
        // Visualize agent dimensions
        Gizmos.color = Color.green;
        Gizmos.DrawWireSphere(transform.position, agentRadius);
        Gizmos.DrawWireCube(transform.position + Vector3.up * agentHeight / 2f,
            new Vector3(agentRadius * 2, agentHeight, agentRadius * 2));

        // Visualize patrol path
        if (patrolPoints != null && patrolPoints.Length > 1)
        {
            Gizmos.color = Color.yellow;
            for (int i = 0; i < patrolPoints.Length - 1; i++)
            {
                if (patrolPoints[i] && patrolPoints[i + 1])
                    Gizmos.DrawLine(patrolPoints[i].position, patrolPoints[i + 1].position);
            }
            if (loopPatrol && patrolPoints[0] && patrolPoints[patrolPoints.Length - 1])
                Gizmos.DrawLine(patrolPoints[patrolPoints.Length - 1].position, patrolPoints[0].position);
        }
    }
}
`
      } else if (engine === 'unreal') {
        code = `// Unreal Engine Navigation — ${agentType} — generated by kbot
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "AIController.h"
#include "NavigationSystem.h"
#include "NavMesh/NavMeshPath.h"
#include "NavAreas/NavArea_Obstacle.h"
#include "NavigationController.generated.h"

UCLASS()
class ANavigationController : public AAIController
{
    GENERATED_BODY()

public:
    ANavigationController();

    // Agent configuration (${agentType})
    static constexpr float AgentRadius = ${cfg.radius}f;
    static constexpr float AgentHeight = ${cfg.height}f;
    static constexpr float StepHeight = ${cfg.step_height}f;
    static constexpr float MaxSlope = ${cfg.max_slope}f;
    static constexpr float MoveSpeed = ${cfg.max_speed * 100}f;  // Unreal uses cm/s
    static constexpr float Acceleration = ${cfg.acceleration * 100}f;

    // NavMesh build settings (configure in Project Settings > Navigation System):
    // - Agent Radius: ${cfg.radius * 100} cm
    // - Agent Height: ${cfg.height * 100} cm
    // - Agent Step Height: ${cfg.step_height * 100} cm
    // - Agent Max Slope: ${cfg.max_slope} degrees
    // - Cell Size: ${cfg.cell_size * 100} cm
    // - Cell Height: ${cfg.cell_height * 100} cm

    /** Navigate to a world location */
    UFUNCTION(BlueprintCallable, Category = "Navigation")
    bool NavigateTo(FVector Target);

    /** Check if a point is reachable */
    UFUNCTION(BlueprintCallable, Category = "Navigation")
    bool IsReachable(FVector Target) const;

    /** Get a random reachable point within radius */
    UFUNCTION(BlueprintCallable, Category = "Navigation")
    bool GetRandomNavPoint(float Radius, FVector& OutPoint) const;

    /** Set patrol waypoints */
    UFUNCTION(BlueprintCallable, Category = "Navigation")
    void SetPatrolPoints(const TArray<FVector>& Points);

protected:
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaTime) override;
    virtual void OnMoveCompleted(FAIRequestID RequestID, const FPathFollowingResult& Result) override;

private:
    UPROPERTY()
    TArray<FVector> PatrolPoints;
    int32 CurrentPatrolIndex = 0;
    bool bIsPatrolling = false;
    float PathRecalcTimer = 0.f;
    FVector PendingTarget;
    bool bHasPendingTarget = false;
};

// Implementation
ANavigationController::ANavigationController()
{
    bWantsPlayerState = false;
    bSetControlRotationFromPawnOrientation = true;
}

void ANavigationController::BeginPlay()
{
    Super::BeginPlay();

    // Configure movement component on the pawn
    if (APawn* ControlledPawn = GetPawn())
    {
        if (UCharacterMovementComponent* MovComp = Cast<ACharacter>(ControlledPawn)->GetCharacterMovement())
        {
            MovComp->MaxWalkSpeed = MoveSpeed;
            MovComp->MaxAcceleration = Acceleration;
            MovComp->bOrientRotationToMovement = true;
            MovComp->RotationRate = FRotator(0.f, ${agentType === 'vehicle' ? '60.f' : '360.f'}, 0.f);
${agentType === 'flying' ? `            MovComp->SetMovementMode(MOVE_Flying);
            MovComp->MaxFlySpeed = MoveSpeed;` : ''}
        }
    }
}

bool ANavigationController::NavigateTo(FVector Target)
{
    bHasPendingTarget = true;
    PendingTarget = Target;
    PathRecalcTimer = 0.f;

    UNavigationSystemV1* NavSys = FNavigationSystem::GetCurrent<UNavigationSystemV1>(GetWorld());
    if (!NavSys) return false;

    FNavLocation NavLoc;
    if (!NavSys->ProjectPointToNavigation(Target, NavLoc, FVector(AgentRadius * 4, AgentRadius * 4, AgentHeight * 2)))
        return false;

    MoveToLocation(NavLoc.Location, AgentRadius * 2.f);
    return true;
}

bool ANavigationController::IsReachable(FVector Target) const
{
    UNavigationSystemV1* NavSys = FNavigationSystem::GetCurrent<UNavigationSystemV1>(GetWorld());
    if (!NavSys) return false;

    FPathFindingQuery Query;
    Query.StartLocation = GetPawn()->GetActorLocation();
    Query.EndLocation = Target;

    FPathFindingResult Result = NavSys->FindPathSync(Query);
    return Result.IsSuccessful() && Result.Path->IsComplete();
}

bool ANavigationController::GetRandomNavPoint(float Radius, FVector& OutPoint) const
{
    UNavigationSystemV1* NavSys = FNavigationSystem::GetCurrent<UNavigationSystemV1>(GetWorld());
    if (!NavSys) return false;

    FNavLocation NavLoc;
    if (NavSys->GetRandomReachablePointInRadius(GetPawn()->GetActorLocation(), Radius, NavLoc))
    {
        OutPoint = NavLoc.Location;
        return true;
    }
    return false;
}

void ANavigationController::SetPatrolPoints(const TArray<FVector>& Points)
{
    PatrolPoints = Points;
    CurrentPatrolIndex = 0;
    bIsPatrolling = Points.Num() > 0;
    if (bIsPatrolling)
        NavigateTo(PatrolPoints[0]);
}

void ANavigationController::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);

    if (bHasPendingTarget)
    {
        PathRecalcTimer += DeltaTime;
        if (PathRecalcTimer >= ${cfg.path_recalc_interval}f)
        {
            PathRecalcTimer = 0.f;
            NavigateTo(PendingTarget);
        }
    }
}

void ANavigationController::OnMoveCompleted(FAIRequestID RequestID, const FPathFollowingResult& Result)
{
    Super::OnMoveCompleted(RequestID, Result);
    bHasPendingTarget = false;

    if (bIsPatrolling && PatrolPoints.Num() > 0)
    {
        CurrentPatrolIndex = (CurrentPatrolIndex + 1) % PatrolPoints.Num();
        NavigateTo(PatrolPoints[CurrentPatrolIndex]);
    }
}
`
      } else if (engine === 'three') {
        code = `// Three.js + recast-navigation-js — ${agentType} agent — generated by kbot
import * as THREE from 'three';
import { init as initRecast, NavMesh, NavMeshQuery, Crowd } from 'recast-navigation';

// Agent configuration (${agentType})
export const NAV_CONFIG = {
  cellSize: ${cfg.cell_size},
  cellHeight: ${cfg.cell_height},
  agentRadius: ${cfg.radius},
  agentHeight: ${cfg.height},
  agentMaxClimb: ${cfg.step_height},
  agentMaxSlope: ${cfg.max_slope},
  regionMinSize: ${cfg.region_min_size},
  regionMergeSize: ${cfg.region_merge_size},
  edgeMaxLen: ${cfg.edge_max_len},
  edgeMaxError: ${cfg.edge_max_error},
  detailSampleDist: ${cfg.detail_sample_dist},
  detailSampleMaxError: ${cfg.detail_sample_max_error},
  maxSpeed: ${cfg.max_speed},
  acceleration: ${cfg.acceleration},
  avoidanceRadius: ${cfg.avoidance_radius},
};

export class NavigationSystem {
  private recast: Awaited<ReturnType<typeof initRecast>> | null = null;
  private navMesh: NavMesh | null = null;
  private query: NavMeshQuery | null = null;
  private crowd: Crowd | null = null;
  private debugMesh: THREE.Mesh | null = null;

  async initialize(): Promise<void> {
    this.recast = await initRecast();
  }

  /**
   * Build navmesh from a Three.js mesh (e.g., ground geometry).
   */
  buildFromMesh(mesh: THREE.Mesh): void {
    if (!this.recast) throw new Error('Call initialize() first');

    const geometry = mesh.geometry;
    if (!geometry.index) geometry.computeBoundsTree?.();

    const positions = geometry.getAttribute('position');
    const indices = geometry.index;

    const vertices = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      vertices[i * 3] = positions.getX(i);
      vertices[i * 3 + 1] = positions.getY(i);
      vertices[i * 3 + 2] = positions.getZ(i);
    }

    // Apply world matrix
    mesh.updateWorldMatrix(true, false);
    const matrix = mesh.matrixWorld;
    const vec = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
      vec.set(vertices[i * 3], vertices[i * 3 + 1], vertices[i * 3 + 2]);
      vec.applyMatrix4(matrix);
      vertices[i * 3] = vec.x;
      vertices[i * 3 + 1] = vec.y;
      vertices[i * 3 + 2] = vec.z;
    }

    const indexArray = indices
      ? new Int32Array(indices.array)
      : new Int32Array(Array.from({ length: positions.count }, (_, i) => i));

    this.navMesh = new this.recast.NavMesh();
    this.navMesh.build(vertices, indexArray, {
      cs: NAV_CONFIG.cellSize,
      ch: NAV_CONFIG.cellHeight,
      walkableRadius: Math.ceil(NAV_CONFIG.agentRadius / NAV_CONFIG.cellSize),
      walkableHeight: Math.ceil(NAV_CONFIG.agentHeight / NAV_CONFIG.cellHeight),
      walkableClimb: Math.ceil(NAV_CONFIG.agentMaxClimb / NAV_CONFIG.cellHeight),
      walkableSlopeAngle: NAV_CONFIG.agentMaxSlope,
      minRegionArea: NAV_CONFIG.regionMinSize,
      mergeRegionArea: NAV_CONFIG.regionMergeSize,
      maxEdgeLen: NAV_CONFIG.edgeMaxLen,
      maxSimplificationError: NAV_CONFIG.edgeMaxError,
      detailSampleDist: NAV_CONFIG.detailSampleDist,
      detailSampleMaxError: NAV_CONFIG.detailSampleMaxError,
    });

    this.query = new this.recast.NavMeshQuery(this.navMesh);
  }

  /**
   * Find a path between two world positions.
   */
  findPath(start: THREE.Vector3, end: THREE.Vector3): THREE.Vector3[] {
    if (!this.query) return [];

    const result = this.query.computePath(
      { x: start.x, y: start.y, z: start.z },
      { x: end.x, y: end.y, z: end.z }
    );

    if (!result.success) return [];
    return result.path.map((p: { x: number; y: number; z: number }) => new THREE.Vector3(p.x, p.y, p.z));
  }

  /**
   * Create a crowd for multi-agent navigation with collision avoidance.
   */
  createCrowd(maxAgents = 50): Crowd {
    if (!this.navMesh) throw new Error('Build navmesh first');
    this.crowd = new this.recast!.Crowd(this.navMesh, {
      maxAgents,
      maxAgentRadius: NAV_CONFIG.agentRadius * 2,
    });
    return this.crowd;
  }

  /**
   * Add an agent to the crowd.
   */
  addCrowdAgent(position: THREE.Vector3): number {
    if (!this.crowd) throw new Error('Create crowd first');
    return this.crowd.addAgent(
      { x: position.x, y: position.y, z: position.z },
      {
        radius: NAV_CONFIG.agentRadius,
        height: NAV_CONFIG.agentHeight,
        maxAcceleration: NAV_CONFIG.acceleration,
        maxSpeed: NAV_CONFIG.maxSpeed,
        separationWeight: 2.0,
        pathOptimizationRange: NAV_CONFIG.agentRadius * 30,
      }
    );
  }

  /**
   * Set a target for a crowd agent.
   */
  setCrowdAgentTarget(agentIdx: number, target: THREE.Vector3): void {
    this.crowd?.setAgentTarget(agentIdx, { x: target.x, y: target.y, z: target.z });
  }

  /**
   * Update the crowd simulation (call each frame).
   */
  updateCrowd(dt: number): void {
    this.crowd?.update(dt);
  }

  /**
   * Get the current position of a crowd agent.
   */
  getCrowdAgentPosition(agentIdx: number): THREE.Vector3 | null {
    const pos = this.crowd?.getAgentPosition(agentIdx);
    return pos ? new THREE.Vector3(pos.x, pos.y, pos.z) : null;
  }

  /**
   * Check if a point is on the navmesh.
   */
  isOnNavMesh(point: THREE.Vector3): boolean {
    if (!this.query) return false;
    const result = this.query.findClosestPoint({ x: point.x, y: point.y, z: point.z });
    if (!result.success) return false;
    const closest = new THREE.Vector3(result.point.x, result.point.y, result.point.z);
    return closest.distanceTo(point) < NAV_CONFIG.agentRadius * 2;
  }

  /**
   * Get a random walkable point.
   */
  getRandomPoint(): THREE.Vector3 | null {
    if (!this.query) return null;
    const result = this.query.findRandomPoint();
    return result.success ? new THREE.Vector3(result.point.x, result.point.y, result.point.z) : null;
  }

  /**
   * Create a debug visualization mesh of the navmesh.
   */
  createDebugMesh(scene: THREE.Scene): THREE.Mesh {
    if (!this.navMesh) throw new Error('Build navmesh first');

    const debugData = this.navMesh.getDebugNavMesh();
    const geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(debugData.triCount * 9);
    for (let i = 0; i < debugData.triCount; i++) {
      const tri = debugData.getTri(i);
      for (let j = 0; j < 3; j++) {
        positions[i * 9 + j * 3] = tri[j].x;
        positions[i * 9 + j * 3 + 1] = tri[j].y + 0.05; // Slight offset to prevent z-fighting
        positions[i * 9 + j * 3 + 2] = tri[j].z;
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial({
      color: 0x44ff88,
      transparent: true,
      opacity: 0.3,
      wireframe: false,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.debugMesh = new THREE.Mesh(geometry, material);
    scene.add(this.debugMesh);

    // Add wireframe overlay
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x44ff88, wireframe: true, transparent: true, opacity: 0.6 });
    const wireMesh = new THREE.Mesh(geometry, wireMat);
    this.debugMesh.add(wireMesh);

    return this.debugMesh;
  }

  /**
   * Toggle debug visualization.
   */
  setDebugVisible(visible: boolean): void {
    if (this.debugMesh) this.debugMesh.visible = visible;
  }

  dispose(): void {
    this.crowd?.destroy();
    this.navMesh?.destroy();
    if (this.debugMesh) {
      this.debugMesh.parent?.remove(this.debugMesh);
      this.debugMesh.geometry.dispose();
    }
  }
}

// Usage:
// const nav = new NavigationSystem();
// await nav.initialize();
// nav.buildFromMesh(groundMesh);
// const path = nav.findPath(startPos, endPos);
// const debugMesh = nav.createDebugMesh(scene);
`
      }

      if (!code) return `Error: No implementation for engine="${engine}"`

      ensureDir(dirname(outputPath))
      writeFileSync(outputPath, code)

      return `Navigation mesh config generated:
  Engine: ${engine}
  Agent: ${agentType}
  Output: ${outputPath} (${code.length} bytes)
  Agent config: radius=${cfg.radius}, height=${cfg.height}, step=${cfg.step_height}, slope=${cfg.max_slope}deg
  Speed: ${cfg.max_speed} m/s, Cell: ${cfg.cell_size}x${cfg.cell_height}
  Features: pathfinding, reachability check, random point, patrol, ${engine === 'three' || engine === 'recast' ? 'crowd simulation, ' : ''}debug visualization`
    },
  })
  // ── ECS Helper Functions (used by ecs_generate) ─────────────────────

  interface ComponentField { name: string; type: 'f32' | 'i32' | 'bool' | 'string' | 'vec2' | 'vec3' }

  /** Infer component fields from a component name */
  function getComponentFields(name: string): ComponentField[] {
    const presets: Record<string, ComponentField[]> = {
      Position: [{ name: 'x', type: 'f32' }, { name: 'y', type: 'f32' }, { name: 'z', type: 'f32' }],
      Velocity: [{ name: 'x', type: 'f32' }, { name: 'y', type: 'f32' }, { name: 'z', type: 'f32' }],
      Acceleration: [{ name: 'x', type: 'f32' }, { name: 'y', type: 'f32' }, { name: 'z', type: 'f32' }],
      Rotation: [{ name: 'angle', type: 'f32' }],
      Scale: [{ name: 'x', type: 'f32' }, { name: 'y', type: 'f32' }],
      Health: [{ name: 'current', type: 'f32' }, { name: 'max', type: 'f32' }],
      Damage: [{ name: 'amount', type: 'f32' }, { name: 'damageType', type: 'i32' }],
      Sprite: [{ name: 'index', type: 'i32' }, { name: 'width', type: 'f32' }, { name: 'height', type: 'f32' }],
      Collider: [{ name: 'width', type: 'f32' }, { name: 'height', type: 'f32' }, { name: 'isTrigger', type: 'bool' }],
      RigidBody: [{ name: 'mass', type: 'f32' }, { name: 'friction', type: 'f32' }, { name: 'restitution', type: 'f32' }],
      Input: [{ name: 'moveX', type: 'f32' }, { name: 'moveY', type: 'f32' }, { name: 'fire', type: 'bool' }],
      Score: [{ name: 'value', type: 'i32' }],
      Timer: [{ name: 'elapsed', type: 'f32' }, { name: 'duration', type: 'f32' }, { name: 'active', type: 'bool' }],
      Tag: [{ name: 'id', type: 'i32' }],
      AI: [{ name: 'state', type: 'i32' }, { name: 'targetX', type: 'f32' }, { name: 'targetY', type: 'f32' }],
      Animation: [{ name: 'frame', type: 'i32' }, { name: 'frameCount', type: 'i32' }, { name: 'speed', type: 'f32' }],
      Lifetime: [{ name: 'remaining', type: 'f32' }],
      Spawner: [{ name: 'interval', type: 'f32' }, { name: 'timer', type: 'f32' }, { name: 'entityType', type: 'i32' }],
      Camera: [{ name: 'zoom', type: 'f32' }, { name: 'targetX', type: 'f32' }, { name: 'targetY', type: 'f32' }],
      Audio: [{ name: 'soundId', type: 'i32' }, { name: 'volume', type: 'f32' }, { name: 'playing', type: 'bool' }],
      Particle: [{ name: 'lifetime', type: 'f32' }, { name: 'size', type: 'f32' }, { name: 'alpha', type: 'f32' }],
    }
    return presets[name] || [{ name: 'value', type: 'f32' }]
  }

  /** Generate default systems based on which components exist */
  function generateDefaultSystems(components: string[]): Array<{ name: string; queries: string[]; description?: string }> {
    const systems: Array<{ name: string; queries: string[]; description?: string }> = []
    const has = (c: string) => components.includes(c)

    if (has('Position') && has('Velocity')) {
      systems.push({ name: 'Movement', queries: ['Position', 'Velocity'], description: 'Apply velocity to position' })
    }
    if (has('Velocity') && has('Acceleration')) {
      systems.push({ name: 'Acceleration', queries: ['Velocity', 'Acceleration'], description: 'Apply acceleration to velocity' })
    }
    if (has('Health') && has('Damage')) {
      systems.push({ name: 'DamageApply', queries: ['Health', 'Damage'], description: 'Apply damage to health' })
    }
    if (has('Lifetime')) {
      systems.push({ name: 'LifetimeDecay', queries: ['Lifetime'], description: 'Decrease lifetime and remove expired entities' })
    }
    if (has('Animation')) {
      systems.push({ name: 'AnimationUpdate', queries: ['Animation'], description: 'Advance animation frames' })
    }
    if (has('Timer')) {
      systems.push({ name: 'TimerUpdate', queries: ['Timer'], description: 'Update active timers' })
    }
    if (has('Spawner')) {
      systems.push({ name: 'SpawnerUpdate', queries: ['Spawner'], description: 'Spawn entities on interval' })
    }
    if (has('Particle')) {
      systems.push({ name: 'ParticleUpdate', queries: ['Particle'], description: 'Update particle lifetime and alpha' })
    }
    if (has('Input') && has('Velocity')) {
      systems.push({ name: 'InputToVelocity', queries: ['Input', 'Velocity'], description: 'Convert input to velocity' })
    }
    if (systems.length === 0 && components.length >= 2) {
      systems.push({ name: 'Update', queries: components.slice(0, 2), description: 'Main update system' })
    }
    return systems
  }

  /** Generate stub system body based on system name and queried components */
  function generateSystemBody(sysName: string, comps: string[], framework: string): string {
    const indent = framework === 'bevy' ? '        ' : framework === 'unity_dots' ? '            ' : '    '
    const accessPfx = framework === 'bitecs'
      ? (c: string, f: string) => `${c}.${f}[eid]`
      : framework === 'bevy'
        ? (c: string, f: string) => `${toSnakeCase(c)}.${toSnakeCase(f)}`
        : framework === 'unity_dots'
          ? (c: string, f: string) => `${toCamelCase(c)}.ValueRW.${capitalize(f)}`
          : framework === 'miniplex'
            ? (c: string, f: string) => `entity.${toCamelCase(c)}!.${f}`
            : (c: string, f: string) => `${toCamelCase(c)}.${f}`

    const lower = sysName.toLowerCase()
    if (lower.includes('movement') && comps.includes('Position') && comps.includes('Velocity')) {
      return `${indent}${accessPfx('Position', 'x')} += ${accessPfx('Velocity', 'x')} * dt;\n${indent}${accessPfx('Position', 'y')} += ${accessPfx('Velocity', 'y')} * dt;`
    }
    if (lower.includes('acceleration') && comps.includes('Velocity') && comps.includes('Acceleration')) {
      return `${indent}${accessPfx('Velocity', 'x')} += ${accessPfx('Acceleration', 'x')} * dt;\n${indent}${accessPfx('Velocity', 'y')} += ${accessPfx('Acceleration', 'y')} * dt;`
    }
    if (lower.includes('damage') && comps.includes('Health') && comps.includes('Damage')) {
      return `${indent}${accessPfx('Health', 'current')} -= ${accessPfx('Damage', 'amount')};`
    }
    if (lower.includes('lifetime') && comps.includes('Lifetime')) {
      return `${indent}${accessPfx('Lifetime', 'remaining')} -= dt;`
    }
    if (lower.includes('animation') && comps.includes('Animation')) {
      return `${indent}// Advance animation frame\n${indent}// ${accessPfx('Animation', 'frame')} = (${accessPfx('Animation', 'frame')} + 1) % ${accessPfx('Animation', 'frameCount')};`
    }
    if (lower.includes('timer') && comps.includes('Timer')) {
      return `${indent}// Update timer\n${indent}// if (${accessPfx('Timer', 'active')}) ${accessPfx('Timer', 'elapsed')} += dt;`
    }
    if (lower.includes('particle') && comps.includes('Particle')) {
      return `${indent}${accessPfx('Particle', 'lifetime')} -= dt;\n${indent}${accessPfx('Particle', 'alpha')} = Math.max(0, ${accessPfx('Particle', 'lifetime')} / 1.0);`
    }
    if (lower.includes('input') && comps.includes('Input') && comps.includes('Velocity')) {
      return `${indent}const speed = 200;\n${indent}${accessPfx('Velocity', 'x')} = ${accessPfx('Input', 'moveX')} * speed;\n${indent}${accessPfx('Velocity', 'y')} = ${accessPfx('Input', 'moveY')} * speed;`
    }
    return `${indent}// TODO: implement ${sysName} logic`
  }

  // ── Type Mapping Helpers ───────────────────────────────────────────

  function toSnakeCase(s: string): string {
    return s.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
  }

  function toCamelCase(s: string): string {
    const r = s.replace(/[-_](.)/g, (_, c) => c.toUpperCase())
    return r.charAt(0).toLowerCase() + r.slice(1)
  }

  function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  function rustType(t: string): string {
    const map: Record<string, string> = { f32: 'f32', i32: 'i32', bool: 'bool', string: 'String', vec2: 'Vec2', vec3: 'Vec3' }
    return map[t] || 'f32'
  }

  function rustDefault(t: string): string {
    const map: Record<string, string> = { f32: '0.0', i32: '0', bool: 'false', string: 'String::new()', vec2: 'Vec2::ZERO', vec3: 'Vec3::ZERO' }
    return map[t] || '0.0'
  }

  function bitecsType(t: string): string {
    const map: Record<string, string> = { f32: 'f32', i32: 'i32', bool: 'ui8', string: 'i32', vec2: 'f32', vec3: 'f32' }
    return map[t] || 'f32'
  }

  function csharpType(t: string): string {
    const map: Record<string, string> = { f32: 'float', i32: 'int', bool: 'bool', string: 'FixedString64Bytes', vec2: 'float2', vec3: 'float3' }
    return map[t] || 'float'
  }

  function csharpMonoType(t: string): string {
    const map: Record<string, string> = { f32: 'float', i32: 'int', bool: 'bool', string: 'string', vec2: 'Vector2', vec3: 'Vector3' }
    return map[t] || 'float'
  }

  function tsType(t: string): string {
    const map: Record<string, string> = { f32: 'number', i32: 'number', bool: 'boolean', string: 'string', vec2: 'number', vec3: 'number' }
    return map[t] || 'number'
  }

  function tsDefault(t: string): string {
    const map: Record<string, string> = { f32: '0', i32: '0', bool: 'false', string: "''", vec2: '0', vec3: '0' }
    return map[t] || '0'
  }

  function ecsyType(t: string): string {
    const map: Record<string, string> = { f32: 'Number', i32: 'Number', bool: 'Boolean', string: 'String', vec2: 'Number', vec3: 'Number' }
    return map[t] || 'Number'
  }

  // ── Tool 12: game_audio ──────────────────────────────────────────────
  registerTool({
    name: 'game_audio',
    description: 'Generate game audio systems: spatial 3D audio, adaptive music layers, sound banks, Howler.js setup, or Web Audio API graphs. Produces complete, working audio code for any game engine.',
    parameters: {
      system: { type: 'string', description: 'Audio system type: spatial, music_layers, sound_bank, howler, web_audio', required: true },
      engine: { type: 'string', description: 'Target engine: godot, unity, unreal, web, bevy (default: web)' },
      output_path: { type: 'string', description: 'Output file path', required: true },
      params: { type: 'string', description: 'JSON parameters for the audio system' },
    },
    tier: 'free',
    async execute(args) {
      const system = String(args.system).toLowerCase()
      const engine = String(args.engine || 'web').toLowerCase()
      const outputPath = safePath(String(args.output_path))
      let params: any = {}
      try { params = args.params ? JSON.parse(String(args.params)) : {} } catch { return 'Error: params must be valid JSON' }

      const validEngines = ['godot', 'unity', 'unreal', 'web', 'bevy']
      if (!validEngines.includes(engine)) return `Error: engine must be one of: ${validEngines.join(', ')}`

      const validSystems = ['spatial', 'music_layers', 'sound_bank', 'howler', 'web_audio']
      if (!validSystems.includes(system)) {
        return `Error: Unknown audio system "${system}". Valid: ${validSystems.join(', ')}`
      }

      let code = ''

      if (system === 'spatial') {
        const maxDistance = params.maxDistance || 50
        const rolloff = params.rolloff || 'linear'
        const dopplerFactor = params.dopplerFactor || 1.0
        const coneInner = params.coneInnerAngle || 360
        const coneOuter = params.coneOuterAngle || 360

        if (engine === 'godot') {
          code = `# Spatial Audio Manager — Godot 4.x
# Attach to a Node3D that acts as your audio manager.

extends Node3D
class_name SpatialAudioManager

## Maximum distance for audio falloff
@export var max_distance: float = ${maxDistance}
## Doppler effect multiplier
@export var doppler_factor: float = ${dopplerFactor}

var _emitters: Dictionary = {}  # id -> AudioStreamPlayer3D
var _listener: AudioListener3D

func _ready() -> void:
\t_listener = AudioListener3D.new()
\tadd_child(_listener)
\t_listener.make_current()
\tprint("[SpatialAudio] Listener initialized")

func _process(_delta: float) -> void:
\t# Listener follows camera
\tvar cam := get_viewport().get_camera_3d()
\tif cam:
\t\t_listener.global_transform = cam.global_transform

## Create a spatial audio emitter at a given position
func create_emitter(id: String, stream: AudioStream, position: Vector3, bus: String = "Master") -> AudioStreamPlayer3D:
\tif _emitters.has(id):
\t\tremove_emitter(id)
\tvar player := AudioStreamPlayer3D.new()
\tplayer.stream = stream
\tplayer.max_distance = max_distance
\tplayer.attenuation_model = AudioStreamPlayer3D.ATTENUATION_INVERSE_DISTANCE if "${rolloff}" == "inverse" else AudioStreamPlayer3D.ATTENUATION_LOGARITHMIC if "${rolloff}" == "logarithmic" else AudioStreamPlayer3D.ATTENUATION_DISABLED if "${rolloff}" == "none" else AudioStreamPlayer3D.ATTENUATION_INVERSE_SQUARE_DISTANCE
\tplayer.doppler_tracking = AudioStreamPlayer3D.DOPPLER_TRACKING_PHYSICS_STEP
\tplayer.emission_angle_enabled = ${coneInner} < 360
\tplayer.emission_angle_degrees = ${coneInner / 2.0}
\tplayer.emission_angle_filter_attenuation_db = -24.0
\tplayer.bus = bus
\tplayer.global_position = position
\tadd_child(player)
\t_emitters[id] = player
\treturn player

## Play a spatial emitter
func play_emitter(id: String, from_position: float = 0.0) -> void:
\tif _emitters.has(id):
\t\t(_emitters[id] as AudioStreamPlayer3D).play(from_position)

## Stop a spatial emitter
func stop_emitter(id: String) -> void:
\tif _emitters.has(id):
\t\t(_emitters[id] as AudioStreamPlayer3D).stop()

## Move an emitter to a new position
func move_emitter(id: String, position: Vector3) -> void:
\tif _emitters.has(id):
\t\t(_emitters[id] as AudioStreamPlayer3D).global_position = position

## Remove an emitter
func remove_emitter(id: String) -> void:
\tif _emitters.has(id):
\t\tvar player: AudioStreamPlayer3D = _emitters[id]
\t\tplayer.stop()
\t\tplayer.queue_free()
\t\t_emitters.erase(id)

## Set volume for an emitter (in dB)
func set_volume(id: String, volume_db: float) -> void:
\tif _emitters.has(id):
\t\t(_emitters[id] as AudioStreamPlayer3D).volume_db = volume_db

## Get all active emitter IDs
func get_active_emitters() -> Array[String]:
\tvar active: Array[String] = []
\tfor id in _emitters:
\t\tif (_emitters[id] as AudioStreamPlayer3D).playing:
\t\t\tactive.append(id)
\treturn active
`
        } else if (engine === 'unity') {
          code = `using UnityEngine;
using System.Collections.Generic;

/// <summary>
/// Spatial Audio Manager — Unity
/// Manages 3D audio emitters with configurable attenuation, doppler, and directional cones.
/// Attach to an empty GameObject in the scene.
/// </summary>
public class SpatialAudioManager : MonoBehaviour
{
    [Header("Spatial Settings")]
    public float maxDistance = ${maxDistance}f;
    public AudioRolloffMode rolloffMode = AudioRolloffMode.${rolloff === 'logarithmic' ? 'Logarithmic' : 'Linear'};
    public float dopplerLevel = ${dopplerFactor}f;
    public float coneInnerAngle = ${coneInner}f;
    public float coneOuterAngle = ${coneOuter}f;

    private Dictionary<string, AudioSource> _emitters = new Dictionary<string, AudioSource>();
    private AudioListener _listener;

    void Awake()
    {
        _listener = FindObjectOfType<AudioListener>();
        if (_listener == null)
        {
            _listener = Camera.main.gameObject.AddComponent<AudioListener>();
        }
    }

    /// <summary>Create a 3D audio emitter at a world position.</summary>
    public AudioSource CreateEmitter(string id, AudioClip clip, Vector3 position, bool loop = false)
    {
        if (_emitters.ContainsKey(id))
            RemoveEmitter(id);

        GameObject go = new GameObject($"AudioEmitter_{id}");
        go.transform.position = position;
        go.transform.SetParent(transform);

        AudioSource source = go.AddComponent<AudioSource>();
        source.clip = clip;
        source.spatialBlend = 1f; // Full 3D
        source.maxDistance = maxDistance;
        source.rolloffMode = rolloffMode;
        source.dopplerLevel = dopplerLevel;
        source.spread = coneInnerAngle;
        source.loop = loop;
        source.playOnAwake = false;

        _emitters[id] = source;
        return source;
    }

    /// <summary>Play a named emitter.</summary>
    public void PlayEmitter(string id)
    {
        if (_emitters.TryGetValue(id, out AudioSource src))
            src.Play();
    }

    /// <summary>Stop a named emitter.</summary>
    public void StopEmitter(string id)
    {
        if (_emitters.TryGetValue(id, out AudioSource src))
            src.Stop();
    }

    /// <summary>Move an emitter to a new world position.</summary>
    public void MoveEmitter(string id, Vector3 position)
    {
        if (_emitters.TryGetValue(id, out AudioSource src))
            src.transform.position = position;
    }

    /// <summary>Set volume for an emitter (0 to 1).</summary>
    public void SetVolume(string id, float volume)
    {
        if (_emitters.TryGetValue(id, out AudioSource src))
            src.volume = Mathf.Clamp01(volume);
    }

    /// <summary>Remove and destroy an emitter.</summary>
    public void RemoveEmitter(string id)
    {
        if (_emitters.TryGetValue(id, out AudioSource src))
        {
            src.Stop();
            Destroy(src.gameObject);
            _emitters.Remove(id);
        }
    }

    /// <summary>Remove all emitters.</summary>
    public void ClearAll()
    {
        foreach (var kvp in _emitters)
        {
            if (kvp.Value != null)
            {
                kvp.Value.Stop();
                Destroy(kvp.Value.gameObject);
            }
        }
        _emitters.Clear();
    }

    void OnDestroy() => ClearAll();
}
`
        } else if (engine === 'bevy') {
          code = `//! Spatial Audio Manager — Bevy
//! Add SpatialAudioPlugin to your App. Emitters follow their Transform.

use bevy::prelude::*;
use bevy::audio::{AudioSink, PlaybackSettings, SpatialScale, Volume};
use std::collections::HashMap;

/// Plugin that sets up spatial audio with configurable parameters.
pub struct SpatialAudioPlugin {
    pub max_distance: f32,
    pub doppler_factor: f32,
    pub spatial_scale: f32,
}

impl Default for SpatialAudioPlugin {
    fn default() -> Self {
        Self {
            max_distance: ${maxDistance.toFixed(1)},
            doppler_factor: ${dopplerFactor.toFixed(1)},
            spatial_scale: 1.0,
        }
    }
}

impl Plugin for SpatialAudioPlugin {
    fn build(&self, app: &mut App) {
        app.insert_resource(SpatialAudioConfig {
            max_distance: self.max_distance,
            doppler_factor: self.doppler_factor,
        })
        .insert_resource(SpatialScale(Vec3::splat(self.spatial_scale)))
        .add_systems(Update, (
            update_spatial_attenuation,
            cleanup_finished_emitters,
        ));
    }
}

#[derive(Resource)]
pub struct SpatialAudioConfig {
    pub max_distance: f32,
    pub doppler_factor: f32,
}

/// Tag component for spatial audio emitters
#[derive(Component)]
pub struct SpatialEmitter {
    pub id: String,
    pub rolloff: Rolloff,
}

#[derive(Clone, Copy)]
pub enum Rolloff {
    Linear,
    Inverse,
    Logarithmic,
}

/// System: attenuate audio sources based on distance to listener
fn update_spatial_attenuation(
    config: Res<SpatialAudioConfig>,
    listener_q: Query<&GlobalTransform, With<SpatialListener>>,
    mut emitter_q: Query<(&GlobalTransform, &SpatialEmitter, &AudioSink)>,
) {
    let Ok(listener_tf) = listener_q.get_single() else { return };
    let listener_pos = listener_tf.translation();

    for (emitter_tf, emitter, sink) in emitter_q.iter_mut() {
        let distance = emitter_tf.translation().distance(listener_pos);
        let gain = match emitter.rolloff {
            Rolloff::Linear => 1.0 - (distance / config.max_distance).clamp(0.0, 1.0),
            Rolloff::Inverse => (1.0 / (1.0 + distance)).min(1.0),
            Rolloff::Logarithmic => (1.0 - (distance / config.max_distance).log2().max(0.0)).clamp(0.0, 1.0),
        };
        sink.set_volume(Volume::new(gain));
    }
}

/// Tag component for the spatial listener (attach to camera)
#[derive(Component)]
pub struct SpatialListener;

/// System: remove emitters whose audio has finished
fn cleanup_finished_emitters(
    mut commands: Commands,
    q: Query<(Entity, &AudioSink), With<SpatialEmitter>>,
) {
    for (entity, sink) in q.iter() {
        if sink.empty() {
            commands.entity(entity).despawn_recursive();
        }
    }
}

/// Helper: spawn a spatial emitter at a position
pub fn spawn_emitter(
    commands: &mut Commands,
    asset_server: &AssetServer,
    id: &str,
    path: &str,
    position: Vec3,
    looping: bool,
) -> Entity {
    let source = asset_server.load(path);
    commands.spawn((
        AudioBundle {
            source,
            settings: PlaybackSettings {
                mode: if looping { bevy::audio::PlaybackMode::Loop } else { bevy::audio::PlaybackMode::Once },
                spatial: true,
                ..default()
            },
        },
        SpatialEmitter {
            id: id.to_string(),
            rolloff: Rolloff::Linear,
        },
        TransformBundle::from_transform(Transform::from_translation(position)),
    )).id()
}
`
        } else {
          // web (default) — Web Audio API spatial
          code = `// Spatial Audio Manager — Web Audio API
// Drop-in 3D positional audio for browser games.

export class SpatialAudioManager {
  private ctx: AudioContext;
  private listener: AudioListener;
  private emitters: Map<string, { source: AudioBufferSourceNode | MediaElementAudioSourceNode; panner: PannerNode; gain: GainNode; }> = new Map();
  private bufferCache: Map<string, AudioBuffer> = new Map();

  constructor() {
    this.ctx = new AudioContext();
    this.listener = this.ctx.listener;
    // Default listener at origin
    if (this.listener.positionX) {
      this.listener.positionX.value = 0;
      this.listener.positionY.value = 0;
      this.listener.positionZ.value = 0;
      this.listener.forwardX.value = 0;
      this.listener.forwardY.value = 0;
      this.listener.forwardZ.value = -1;
      this.listener.upX.value = 0;
      this.listener.upY.value = 1;
      this.listener.upZ.value = 0;
    }
  }

  /** Resume audio context (call on user gesture) */
  async resume(): Promise<void> {
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  /** Update listener position and orientation (call each frame) */
  setListenerPosition(x: number, y: number, z: number): void {
    if (this.listener.positionX) {
      this.listener.positionX.value = x;
      this.listener.positionY.value = y;
      this.listener.positionZ.value = z;
    } else {
      this.listener.setPosition(x, y, z);
    }
  }

  setListenerOrientation(fx: number, fy: number, fz: number, ux: number, uy: number, uz: number): void {
    if (this.listener.forwardX) {
      this.listener.forwardX.value = fx;
      this.listener.forwardY.value = fy;
      this.listener.forwardZ.value = fz;
      this.listener.upX.value = ux;
      this.listener.upY.value = uy;
      this.listener.upZ.value = uz;
    } else {
      this.listener.setOrientation(fx, fy, fz, ux, uy, uz);
    }
  }

  /** Load an audio file into the buffer cache */
  async loadSound(id: string, url: string): Promise<void> {
    if (this.bufferCache.has(id)) return;
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    this.bufferCache.set(id, audioBuffer);
  }

  /** Create a spatial emitter and start playing */
  play(id: string, soundId: string, x: number, y: number, z: number, options: {
    loop?: boolean;
    volume?: number;
    refDistance?: number;
    maxDistance?: number;
    rolloffFactor?: number;
    coneInnerAngle?: number;
    coneOuterAngle?: number;
    coneOuterGain?: number;
    distanceModel?: DistanceModelType;
  } = {}): void {
    this.stop(id); // Remove existing emitter with same id

    const buffer = this.bufferCache.get(soundId);
    if (!buffer) {
      console.warn(\`[SpatialAudio] Sound "\${soundId}" not loaded. Call loadSound() first.\`);
      return;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = options.loop ?? false;

    const panner = this.ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = options.distanceModel ?? '${rolloff === 'logarithmic' ? 'exponential' : rolloff === 'inverse' ? 'inverse' : 'linear'}';
    panner.refDistance = options.refDistance ?? 1;
    panner.maxDistance = options.maxDistance ?? ${maxDistance};
    panner.rolloffFactor = options.rolloffFactor ?? 1;
    panner.coneInnerAngle = options.coneInnerAngle ?? ${coneInner};
    panner.coneOuterAngle = options.coneOuterAngle ?? ${coneOuter};
    panner.coneOuterGain = options.coneOuterGain ?? 0;
    panner.positionX.value = x;
    panner.positionY.value = y;
    panner.positionZ.value = z;

    const gain = this.ctx.createGain();
    gain.gain.value = options.volume ?? 1;

    source.connect(panner).connect(gain).connect(this.ctx.destination);
    source.start();

    this.emitters.set(id, { source, panner, gain });
    source.onended = () => { if (!source.loop) this.emitters.delete(id); };
  }

  /** Move an emitter to a new position */
  moveEmitter(id: string, x: number, y: number, z: number): void {
    const e = this.emitters.get(id);
    if (!e) return;
    e.panner.positionX.value = x;
    e.panner.positionY.value = y;
    e.panner.positionZ.value = z;
  }

  /** Set emitter volume (0 to 1) with optional fade time in seconds */
  setVolume(id: string, volume: number, fadeTime = 0): void {
    const e = this.emitters.get(id);
    if (!e) return;
    if (fadeTime > 0) {
      e.gain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + fadeTime);
    } else {
      e.gain.gain.value = volume;
    }
  }

  /** Stop and remove an emitter */
  stop(id: string): void {
    const e = this.emitters.get(id);
    if (!e) return;
    try { e.source.stop(); } catch { /* already stopped */ }
    e.source.disconnect();
    e.panner.disconnect();
    e.gain.disconnect();
    this.emitters.delete(id);
  }

  /** Stop all emitters */
  stopAll(): void {
    for (const id of this.emitters.keys()) this.stop(id);
  }

  /** Destroy the audio context */
  async destroy(): Promise<void> {
    this.stopAll();
    await this.ctx.close();
  }
}
`
        }
      } else if (system === 'music_layers') {
        const layers = params.layers || ['intro', 'loop', 'combat', 'explore', 'boss']
        const crossfadeDuration = params.crossfadeDuration || 2.0
        const bpm = params.bpm || 120

        if (engine === 'godot') {
          code = `# Adaptive Music Layer System — Godot 4.x
# Crossfades between music layers based on game state.
# Attach to a Node and call transition_to() when game state changes.

extends Node
class_name AdaptiveMusicManager

enum MusicState { ${layers.map((l: string, i: number) => `${l.toUpperCase()} = ${i}`).join(', ')} }

## Duration of crossfade between layers in seconds
@export var crossfade_duration: float = ${crossfadeDuration}
## BPM for beat-synced transitions
@export var bpm: float = ${bpm}

var _players: Dictionary = {}  # MusicState -> AudioStreamPlayer
var _current_state: MusicState = MusicState.${layers[0].toUpperCase()}
var _transitioning: bool = false
var _tween: Tween

func _ready() -> void:
\tfor state in MusicState.values():
\t\tvar player := AudioStreamPlayer.new()
\t\tplayer.bus = "Music"
\t\tplayer.volume_db = -80.0  # Start silent
\t\tadd_child(player)
\t\t_players[state] = player
\tprint("[AdaptiveMusic] Initialized with ${layers.length} layers")

## Load audio streams for each layer
func load_tracks(tracks: Dictionary) -> void:
\t# tracks = { MusicState.INTRO: preload("res://audio/intro.ogg"), ... }
\tfor state in tracks:
\t\tif _players.has(state):
\t\t\t(_players[state] as AudioStreamPlayer).stream = tracks[state]

## Transition to a new music state with crossfade
func transition_to(state: MusicState, immediate: bool = false) -> void:
\tif state == _current_state and not immediate:
\t\treturn
\tif _transitioning:
\t\t_tween.kill()

\t_transitioning = true
\tvar old_player: AudioStreamPlayer = _players[_current_state]
\tvar new_player: AudioStreamPlayer = _players[state]

\t# Start new layer from beginning or synced position
\tif not new_player.playing:
\t\tif old_player.playing:
\t\t\t# Beat-sync: calculate position aligned to beat grid
\t\t\tvar beat_len := 60.0 / bpm
\t\t\tvar pos := old_player.get_playback_position()
\t\t\tvar synced_pos := floor(pos / beat_len) * beat_len
\t\t\tnew_player.play(synced_pos)
\t\telse:
\t\t\tnew_player.play()

\tvar duration := 0.0 if immediate else crossfade_duration

\t_tween = create_tween().set_parallel(true)
\t_tween.tween_property(old_player, "volume_db", -80.0, duration)
\t_tween.tween_property(new_player, "volume_db", 0.0, duration)
\t_tween.chain().tween_callback(func():
\t\told_player.stop()
\t\t_current_state = state
\t\t_transitioning = false
\t)

## Get current music state
func get_current_state() -> MusicState:
\treturn _current_state

## Set master music volume
func set_volume(volume_db: float) -> void:
\tAudioServer.set_bus_volume_db(AudioServer.get_bus_index("Music"), volume_db)

## Pause/resume all music
func pause() -> void:
\tfor player in _players.values():
\t\t(player as AudioStreamPlayer).stream_paused = true

func resume() -> void:
\tfor player in _players.values():
\t\t(player as AudioStreamPlayer).stream_paused = false
`
        } else {
          // web
          code = `// Adaptive Music Layer System — Web Audio API
// Supports beat-synced crossfades between music layers.
//
// Usage:
//   const music = new AdaptiveMusicManager();
//   await music.loadTracks({ intro: '/audio/intro.mp3', loop: '/audio/loop.mp3', ... });
//   music.play('intro');
//   music.transitionTo('combat');  // smooth crossfade

export type MusicLayer = ${layers.map((l: string) => `'${l}'`).join(' | ')};

interface LayerNode {
  source: AudioBufferSourceNode | null;
  gain: GainNode;
  buffer: AudioBuffer | null;
  playing: boolean;
}

export class AdaptiveMusicManager {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private layers: Map<MusicLayer, LayerNode> = new Map();
  private currentLayer: MusicLayer | null = null;
  private crossfadeDuration = ${crossfadeDuration};
  private bpm = ${bpm};
  private startTime = 0;

  constructor(crossfadeDuration = ${crossfadeDuration}, bpm = ${bpm}) {
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.crossfadeDuration = crossfadeDuration;
    this.bpm = bpm;

    // Initialize layer nodes
    const layerNames: MusicLayer[] = [${layers.map((l: string) => `'${l}'`).join(', ')}];
    for (const name of layerNames) {
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.masterGain);
      this.layers.set(name, { source: null, gain, buffer: null, playing: false });
    }
  }

  /** Resume the audio context (must be called after user gesture) */
  async resume(): Promise<void> {
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  /** Load audio tracks for each layer */
  async loadTracks(tracks: Partial<Record<MusicLayer, string>>): Promise<void> {
    const loads = Object.entries(tracks).map(async ([layer, url]) => {
      const response = await fetch(url as string);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await this.ctx.decodeAudioData(arrayBuffer);
      const node = this.layers.get(layer as MusicLayer);
      if (node) node.buffer = buffer;
    });
    await Promise.all(loads);
  }

  /** Get the next beat-aligned time */
  private nextBeatTime(): number {
    const beatDuration = 60 / this.bpm;
    const elapsed = this.ctx.currentTime - this.startTime;
    const beatCount = Math.ceil(elapsed / beatDuration);
    return this.startTime + beatCount * beatDuration;
  }

  /** Start playing a layer immediately */
  play(layer: MusicLayer): void {
    const node = this.layers.get(layer);
    if (!node || !node.buffer) return;

    this.stopLayer(layer);

    const source = this.ctx.createBufferSource();
    source.buffer = node.buffer;
    source.loop = true;
    source.connect(node.gain);
    source.start();
    node.source = source;
    node.playing = true;
    node.gain.gain.setValueAtTime(1, this.ctx.currentTime);

    this.currentLayer = layer;
    this.startTime = this.ctx.currentTime;
  }

  /** Crossfade to a different layer, optionally beat-synced */
  transitionTo(layer: MusicLayer, options: { immediate?: boolean; beatSync?: boolean } = {}): void {
    if (layer === this.currentLayer) return;

    const targetNode = this.layers.get(layer);
    if (!targetNode || !targetNode.buffer) return;

    const now = options.beatSync ? this.nextBeatTime() : this.ctx.currentTime;
    const fadeDuration = options.immediate ? 0.05 : this.crossfadeDuration;

    // Fade out current layer
    if (this.currentLayer) {
      const currentNode = this.layers.get(this.currentLayer);
      if (currentNode) {
        currentNode.gain.gain.setValueAtTime(currentNode.gain.gain.value, now);
        currentNode.gain.gain.linearRampToValueAtTime(0, now + fadeDuration);
        // Stop source after fade
        const oldLayer = this.currentLayer;
        setTimeout(() => this.stopLayer(oldLayer), (now - this.ctx.currentTime + fadeDuration) * 1000 + 100);
      }
    }

    // Start and fade in new layer
    if (!targetNode.playing) {
      const source = this.ctx.createBufferSource();
      source.buffer = targetNode.buffer;
      source.loop = true;
      source.connect(targetNode.gain);
      // Sync to the same playback position
      const elapsed = this.ctx.currentTime - this.startTime;
      const offset = targetNode.buffer.duration > 0 ? elapsed % targetNode.buffer.duration : 0;
      source.start(now, offset);
      targetNode.source = source;
      targetNode.playing = true;
    }
    targetNode.gain.gain.setValueAtTime(0, now);
    targetNode.gain.gain.linearRampToValueAtTime(1, now + fadeDuration);

    this.currentLayer = layer;
  }

  /** Stop a specific layer */
  private stopLayer(layer: MusicLayer): void {
    const node = this.layers.get(layer);
    if (!node || !node.source) return;
    try { node.source.stop(); } catch { /* already stopped */ }
    node.source.disconnect();
    node.source = null;
    node.playing = false;
  }

  /** Set master volume (0 to 1) */
  setMasterVolume(volume: number, fadeTime = 0): void {
    if (fadeTime > 0) {
      this.masterGain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + fadeTime);
    } else {
      this.masterGain.gain.value = volume;
    }
  }

  /** Stop all layers */
  stopAll(): void {
    for (const layer of this.layers.keys()) this.stopLayer(layer);
    this.currentLayer = null;
  }

  /** Destroy and clean up */
  async destroy(): Promise<void> {
    this.stopAll();
    await this.ctx.close();
  }
}
`
        }
      } else if (system === 'sound_bank') {
        const categories = params.categories || ['sfx', 'ui', 'ambient', 'footsteps', 'weapons']
        const maxVariations = params.maxVariations || 5

        code = `// Sound Bank System — Web
// Categorized sound effects with variation support and pooling.
//
// Usage:
//   const bank = new SoundBank();
//   await bank.loadCategory('sfx', {
//     explosion: ['/audio/explosion1.mp3', '/audio/explosion2.mp3', '/audio/explosion3.mp3'],
//     hit: ['/audio/hit1.mp3', '/audio/hit2.mp3'],
//   });
//   bank.play('sfx', 'explosion');  // plays a random variation
//   bank.play('sfx', 'explosion', { pitch: 0.9, volume: 0.8 });

export type SoundCategory = ${categories.map((c: string) => `'${c}'`).join(' | ')};

interface SoundEntry {
  buffers: AudioBuffer[];
  lastVariation: number;
}

interface PlayOptions {
  volume?: number;
  pitch?: number;   // playback rate (1 = normal, 0.5 = half speed, 2 = double)
  pan?: number;     // stereo pan (-1 = left, 0 = center, 1 = right)
  loop?: boolean;
  delay?: number;   // delay in seconds before playing
}

export class SoundBank {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private categoryGains: Map<SoundCategory, GainNode> = new Map();
  private sounds: Map<string, SoundEntry> = new Map(); // "category:name" -> entry
  private maxVariations = ${maxVariations};
  private activeLoops: Map<string, { source: AudioBufferSourceNode; gain: GainNode }> = new Map();

  constructor() {
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);

    // Create per-category gain nodes
    const cats: SoundCategory[] = [${categories.map((c: string) => `'${c}'`).join(', ')}];
    for (const cat of cats) {
      const gain = this.ctx.createGain();
      gain.connect(this.masterGain);
      this.categoryGains.set(cat, gain);
    }
  }

  /** Resume audio context after user gesture */
  async resume(): Promise<void> {
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  /** Load all variations for sounds in a category */
  async loadCategory(category: SoundCategory, sounds: Record<string, string[]>): Promise<void> {
    const loads: Promise<void>[] = [];
    for (const [name, urls] of Object.entries(sounds)) {
      const key = \`\${category}:\${name}\`;
      const limited = urls.slice(0, this.maxVariations);
      loads.push(
        Promise.all(
          limited.map(async (url) => {
            const res = await fetch(url);
            const buf = await res.arrayBuffer();
            return this.ctx.decodeAudioData(buf);
          })
        ).then((buffers) => {
          this.sounds.set(key, { buffers, lastVariation: -1 });
        })
      );
    }
    await Promise.all(loads);
  }

  /** Load a single sound with variations */
  async loadSound(category: SoundCategory, name: string, urls: string[]): Promise<void> {
    await this.loadCategory(category, { [name]: urls });
  }

  /** Play a sound from the bank with a random (non-repeating) variation */
  play(category: SoundCategory, name: string, options: PlayOptions = {}): void {
    const key = \`\${category}:\${name}\`;
    const entry = this.sounds.get(key);
    if (!entry || entry.buffers.length === 0) {
      console.warn(\`[SoundBank] Sound "\${key}" not loaded\`);
      return;
    }

    // Pick a variation that isn't the same as the last one
    let variation: number;
    if (entry.buffers.length === 1) {
      variation = 0;
    } else {
      do {
        variation = Math.floor(Math.random() * entry.buffers.length);
      } while (variation === entry.lastVariation);
    }
    entry.lastVariation = variation;

    const source = this.ctx.createBufferSource();
    source.buffer = entry.buffers[variation];
    source.playbackRate.value = options.pitch ?? 1;
    source.loop = options.loop ?? false;

    // Gain node for per-sound volume
    const gain = this.ctx.createGain();
    gain.gain.value = options.volume ?? 1;

    // Stereo panner
    const categoryGain = this.categoryGains.get(category) ?? this.masterGain;
    if (options.pan !== undefined && options.pan !== 0) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = options.pan;
      source.connect(gain).connect(panner).connect(categoryGain);
    } else {
      source.connect(gain).connect(categoryGain);
    }

    const delay = options.delay ?? 0;
    source.start(this.ctx.currentTime + delay);

    // Track loops so they can be stopped later
    if (options.loop) {
      const loopKey = \`\${key}:\${Date.now()}\`;
      this.activeLoops.set(loopKey, { source, gain });
      source.onended = () => this.activeLoops.delete(loopKey);
    }
  }

  /** Play a sound with random pitch variation for organic feel */
  playRandomized(category: SoundCategory, name: string, pitchRange = 0.1, volumeRange = 0.1): void {
    const pitch = 1 + (Math.random() * 2 - 1) * pitchRange;
    const volume = 1 - Math.random() * volumeRange;
    this.play(category, name, { pitch, volume });
  }

  /** Set volume for an entire category (0 to 1) */
  setCategoryVolume(category: SoundCategory, volume: number): void {
    const gain = this.categoryGains.get(category);
    if (gain) gain.gain.value = Math.max(0, Math.min(1, volume));
  }

  /** Set master volume (0 to 1) */
  setMasterVolume(volume: number): void {
    this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
  }

  /** Stop all active loops in a category */
  stopLoops(category?: SoundCategory): void {
    for (const [key, loop] of this.activeLoops) {
      if (!category || key.startsWith(\`\${category}:\`)) {
        try { loop.source.stop(); } catch { /* ok */ }
        loop.source.disconnect();
        this.activeLoops.delete(key);
      }
    }
  }

  /** Stop all sounds and clean up */
  stopAll(): void {
    this.stopLoops();
  }

  /** Destroy the sound bank */
  async destroy(): Promise<void> {
    this.stopAll();
    this.sounds.clear();
    await this.ctx.close();
  }
}
`
      } else if (system === 'howler') {
        const sounds = params.sounds || { bgm: '/audio/bgm.mp3', click: '/audio/click.mp3', explosion: '/audio/explosion.mp3' }
        const spatial = params.spatial !== false

        code = `// Howler.js Audio Setup — Web Game Audio
// Complete audio manager with sprites, spatial audio, and pooling.
//
// Prerequisites: npm install howler
// Usage:
//   import { GameAudio } from './audio';
//   const audio = new GameAudio();
//   audio.playBGM();
//   audio.playSFX('explosion');
//   audio.playSFXAt('explosion', { x: 10, y: 0, z: -5 });

import { Howl, Howler } from 'howler';

interface SFXOptions {
  volume?: number;
  rate?: number;
  loop?: boolean;
}

interface SpatialOptions extends SFXOptions {
  x?: number;
  y?: number;
  z?: number;
}

export class GameAudio {
  private bgm: Howl | null = null;
  private sfxPool: Map<string, Howl> = new Map();
  private currentBGMId: number | null = null;
  private masterVolume = 1;
  private bgmVolume = 0.7;
  private sfxVolume = 1;
  private spatial = ${spatial};

  constructor() {
    // Configure Howler globally
    Howler.autoUnlock = true;
    Howler.html5PoolSize = 10;
    if (this.spatial) {
      Howler.pos(0, 0, 0);      // Listener at origin
      Howler.orientation(0, 0, -1, 0, 1, 0);  // Looking forward
    }
  }

  // ── BGM ────────────────────────────────────────────────────────────

  /** Load and play background music with optional crossfade */
  playBGM(src: string, fadeDuration = 1000): void {
    const newBgm = new Howl({
      src: [src],
      loop: true,
      volume: 0,
      html5: true,  // Stream for large files
    });

    // Fade out old BGM
    if (this.bgm && this.currentBGMId !== null) {
      const oldBgm = this.bgm;
      const oldId = this.currentBGMId;
      oldBgm.fade(oldBgm.volume(), 0, fadeDuration, oldId);
      setTimeout(() => { oldBgm.stop(oldId); oldBgm.unload(); }, fadeDuration + 100);
    }

    // Fade in new BGM
    this.currentBGMId = newBgm.play();
    newBgm.fade(0, this.bgmVolume * this.masterVolume, fadeDuration, this.currentBGMId);
    this.bgm = newBgm;
  }

  /** Stop BGM with optional fade */
  stopBGM(fadeDuration = 500): void {
    if (this.bgm && this.currentBGMId !== null) {
      this.bgm.fade(this.bgm.volume(), 0, fadeDuration, this.currentBGMId);
      const bgm = this.bgm;
      setTimeout(() => { bgm.stop(); bgm.unload(); }, fadeDuration + 100);
      this.bgm = null;
      this.currentBGMId = null;
    }
  }

  /** Pause/resume BGM */
  pauseBGM(): void { if (this.bgm && this.currentBGMId !== null) this.bgm.pause(this.currentBGMId); }
  resumeBGM(): void { if (this.bgm && this.currentBGMId !== null) this.bgm.play(this.currentBGMId); }

  // ── SFX ────────────────────────────────────────────────────────────

  /** Register a sound effect (pre-load for instant playback) */
  loadSFX(name: string, srcs: string | string[], sprite?: Record<string, [number, number]>): void {
    const sources = Array.isArray(srcs) ? srcs : [srcs];
    const howl = new Howl({
      src: sources,
      volume: this.sfxVolume * this.masterVolume,
      sprite,
      preload: true,
    });
    this.sfxPool.set(name, howl);
  }

  /** Play a sound effect */
  playSFX(name: string, options: SFXOptions = {}): number | null {
    const howl = this.sfxPool.get(name);
    if (!howl) {
      console.warn(\`[GameAudio] SFX "\${name}" not loaded\`);
      return null;
    }
    const id = howl.play();
    if (options.volume !== undefined) howl.volume(options.volume * this.sfxVolume * this.masterVolume, id);
    if (options.rate !== undefined) howl.rate(options.rate, id);
    if (options.loop !== undefined) howl.loop(options.loop, id);
    return id;
  }

  /** Play a sound effect at a 3D position */
  playSFXAt(name: string, options: SpatialOptions = {}): number | null {
    const howl = this.sfxPool.get(name);
    if (!howl) return null;
    const id = howl.play();
    if (options.volume !== undefined) howl.volume(options.volume * this.sfxVolume * this.masterVolume, id);
    if (options.rate !== undefined) howl.rate(options.rate, id);
    if (this.spatial) {
      howl.pos(options.x ?? 0, options.y ?? 0, options.z ?? 0, id);
      howl.pannerAttr({
        panningModel: 'HRTF',
        distanceModel: 'inverse',
        refDistance: 1,
        maxDistance: 50,
        rolloffFactor: 1,
        coneInnerAngle: 360,
        coneOuterAngle: 360,
        coneOuterGain: 0,
      }, id);
    }
    return id;
  }

  /** Play a sprite section of a loaded sound */
  playSprite(name: string, spriteName: string, options: SFXOptions = {}): number | null {
    const howl = this.sfxPool.get(name);
    if (!howl) return null;
    const id = howl.play(spriteName);
    if (options.volume !== undefined) howl.volume(options.volume * this.sfxVolume * this.masterVolume, id);
    if (options.rate !== undefined) howl.rate(options.rate, id);
    return id;
  }

  // ── Listener ───────────────────────────────────────────────────────

  /** Update listener position (call each frame for spatial audio) */
  setListenerPosition(x: number, y: number, z: number): void {
    if (this.spatial) Howler.pos(x, y, z);
  }

  /** Update listener orientation */
  setListenerOrientation(fx: number, fy: number, fz: number, ux = 0, uy = 1, uz = 0): void {
    if (this.spatial) Howler.orientation(fx, fy, fz, ux, uy, uz);
  }

  // ── Volume Controls ────────────────────────────────────────────────

  setMasterVolume(v: number): void {
    this.masterVolume = Math.max(0, Math.min(1, v));
    Howler.volume(this.masterVolume);
  }

  setBGMVolume(v: number): void {
    this.bgmVolume = Math.max(0, Math.min(1, v));
    if (this.bgm && this.currentBGMId !== null) {
      this.bgm.volume(this.bgmVolume * this.masterVolume, this.currentBGMId);
    }
  }

  setSFXVolume(v: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, v));
  }

  /** Mute / unmute all audio */
  mute(muted = true): void {
    Howler.mute(muted);
  }

  // ── Cleanup ────────────────────────────────────────────────────────

  /** Stop all sounds and unload */
  destroy(): void {
    this.stopBGM(0);
    for (const howl of this.sfxPool.values()) {
      howl.stop();
      howl.unload();
    }
    this.sfxPool.clear();
    Howler.unload();
  }
}

// ── Presets ─────────────────────────────────────────────────────────

/** Quick-start: create a GameAudio instance with common sounds pre-loaded */
export function createDefaultAudio(basePath = '/audio'): GameAudio {
  const audio = new GameAudio();
  const sounds: Record<string, string> = ${JSON.stringify(sounds, null, 2)};
  for (const [name, path] of Object.entries(sounds)) {
    audio.loadSFX(name, path);
  }
  return audio;
}
`
      } else if (system === 'web_audio') {
        const effects = params.effects || ['reverb', 'delay', 'compressor', 'eq']

        code = `// Web Audio API — Audio Graph with Effects Chain
// Low-level audio processing with composable effect nodes.
//
// Usage:
//   const engine = new AudioEngine();
//   await engine.resume();
//   const osc = engine.createOscillator('synth1', 'sawtooth', 440);
//   engine.addEffect('synth1', 'reverb', { decay: 2, wet: 0.3 });
//   engine.addEffect('synth1', 'delay', { time: 0.25, feedback: 0.4 });
//   engine.start('synth1');

type EffectType = ${effects.map((e: string) => `'${e}'`).join(' | ')};

interface EffectNode {
  type: EffectType;
  input: AudioNode;
  output: AudioNode;
  nodes: AudioNode[];
  params: Record<string, number>;
}

interface AudioTrack {
  source: OscillatorNode | AudioBufferSourceNode | null;
  effects: EffectNode[];
  gainNode: GainNode;
  analyser: AnalyserNode;
  connected: boolean;
}

export class AudioEngine {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private masterCompressor: DynamicsCompressorNode;
  private masterAnalyser: AnalyserNode;
  private tracks: Map<string, AudioTrack> = new Map();
  private buffers: Map<string, AudioBuffer> = new Map();

  constructor() {
    this.ctx = new AudioContext();

    // Master chain: compressor -> gain -> analyser -> destination
    this.masterCompressor = this.ctx.createDynamicsCompressor();
    this.masterGain = this.ctx.createGain();
    this.masterAnalyser = this.ctx.createAnalyser();
    this.masterAnalyser.fftSize = 2048;

    this.masterCompressor
      .connect(this.masterGain)
      .connect(this.masterAnalyser)
      .connect(this.ctx.destination);
  }

  get context(): AudioContext { return this.ctx; }
  get currentTime(): number { return this.ctx.currentTime; }

  async resume(): Promise<void> {
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  /** Load an audio file into buffer cache */
  async loadBuffer(id: string, url: string): Promise<AudioBuffer> {
    if (this.buffers.has(id)) return this.buffers.get(id)!;
    const res = await fetch(url);
    const data = await res.arrayBuffer();
    const buffer = await this.ctx.decodeAudioData(data);
    this.buffers.set(id, buffer);
    return buffer;
  }

  // ── Track Creation ─────────────────────────────────────────────────

  private createTrack(id: string): AudioTrack {
    if (this.tracks.has(id)) this.removeTrack(id);
    const gainNode = this.ctx.createGain();
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 256;
    const track: AudioTrack = { source: null, effects: [], gainNode, analyser, connected: false };
    this.tracks.set(id, track);
    return track;
  }

  /** Create an oscillator source */
  createOscillator(id: string, type: OscillatorType = 'sine', frequency = 440): AudioTrack {
    const track = this.createTrack(id);
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    track.source = osc;
    return track;
  }

  /** Create a buffer source (for loaded samples) */
  createBufferSource(id: string, bufferId: string, loop = false): AudioTrack {
    const buffer = this.buffers.get(bufferId);
    if (!buffer) throw new Error(\`Buffer "\${bufferId}" not loaded. Call loadBuffer() first.\`);
    const track = this.createTrack(id);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    track.source = source;
    return track;
  }

  // ── Effects ────────────────────────────────────────────────────────

  /** Add an effect to a track's chain */
  addEffect(trackId: string, type: EffectType, params: Record<string, number> = {}): void {
    const track = this.tracks.get(trackId);
    if (!track) throw new Error(\`Track "\${trackId}" not found\`);

    let effect: EffectNode;

    switch (type) {
      case 'reverb': {
        const wet = params.wet ?? 0.3;
        const decay = params.decay ?? 2;
        const preDelay = params.preDelay ?? 0.01;
        // Convolution reverb with generated impulse response
        const convolver = this.ctx.createConvolver();
        const ir = this.generateImpulseResponse(decay, preDelay);
        convolver.buffer = ir;
        const dryGain = this.ctx.createGain();
        dryGain.gain.value = 1 - wet;
        const wetGain = this.ctx.createGain();
        wetGain.gain.value = wet;
        const merger = this.ctx.createGain();
        // Dry path: input -> dryGain -> merger
        // Wet path: input -> convolver -> wetGain -> merger
        // We'll use a splitter pattern
        const splitter = this.ctx.createGain(); // acts as input
        splitter.connect(dryGain).connect(merger);
        splitter.connect(convolver).connect(wetGain).connect(merger);
        effect = { type, input: splitter, output: merger, nodes: [splitter, convolver, dryGain, wetGain, merger], params: { wet, decay, preDelay } };
        break;
      }
      case 'delay': {
        const time = params.time ?? 0.25;
        const feedback = params.feedback ?? 0.4;
        const wet = params.wet ?? 0.3;
        const delay = this.ctx.createDelay(5);
        delay.delayTime.value = time;
        const feedbackGain = this.ctx.createGain();
        feedbackGain.gain.value = feedback;
        const wetGain = this.ctx.createGain();
        wetGain.gain.value = wet;
        const dryGain = this.ctx.createGain();
        dryGain.gain.value = 1;
        const merger = this.ctx.createGain();
        const input = this.ctx.createGain();
        // Dry: input -> dryGain -> merger
        input.connect(dryGain).connect(merger);
        // Wet: input -> delay -> wetGain -> merger, delay -> feedbackGain -> delay
        input.connect(delay);
        delay.connect(feedbackGain).connect(delay);
        delay.connect(wetGain).connect(merger);
        effect = { type, input, output: merger, nodes: [input, delay, feedbackGain, wetGain, dryGain, merger], params: { time, feedback, wet } };
        break;
      }
      case 'compressor': {
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = params.threshold ?? -24;
        comp.ratio.value = params.ratio ?? 4;
        comp.attack.value = params.attack ?? 0.003;
        comp.release.value = params.release ?? 0.25;
        comp.knee.value = params.knee ?? 30;
        effect = { type, input: comp, output: comp, nodes: [comp], params };
        break;
      }
      case 'eq': {
        // 3-band parametric EQ
        const low = this.ctx.createBiquadFilter();
        low.type = 'lowshelf';
        low.frequency.value = params.lowFreq ?? 320;
        low.gain.value = params.lowGain ?? 0;
        const mid = this.ctx.createBiquadFilter();
        mid.type = 'peaking';
        mid.frequency.value = params.midFreq ?? 1000;
        mid.Q.value = params.midQ ?? 1;
        mid.gain.value = params.midGain ?? 0;
        const high = this.ctx.createBiquadFilter();
        high.type = 'highshelf';
        high.frequency.value = params.highFreq ?? 3200;
        high.gain.value = params.highGain ?? 0;
        low.connect(mid).connect(high);
        effect = { type, input: low, output: high, nodes: [low, mid, high], params };
        break;
      }
      default:
        throw new Error(\`Unknown effect type: \${type}\`);
    }

    track.effects.push(effect);
  }

  /** Generate a synthetic impulse response for reverb */
  private generateImpulseResponse(decay: number, preDelay: number): AudioBuffer {
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * (decay + preDelay);
    const buffer = this.ctx.createBuffer(2, length, sampleRate);
    const preDelaySamples = Math.floor(preDelay * sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = preDelaySamples; i < length; i++) {
        const t = (i - preDelaySamples) / (length - preDelaySamples);
        data[i] = (Math.random() * 2 - 1) * Math.exp(-3 * t);
      }
    }
    return buffer;
  }

  // ── Playback ───────────────────────────────────────────────────────

  /** Connect the track's audio graph and start playback */
  start(trackId: string, when = 0): void {
    const track = this.tracks.get(trackId);
    if (!track || !track.source) throw new Error(\`Track "\${trackId}" has no source\`);

    // Build chain: source -> [effects...] -> gain -> analyser -> masterCompressor
    let lastNode: AudioNode = track.source;
    for (const effect of track.effects) {
      lastNode.connect(effect.input);
      lastNode = effect.output;
    }
    lastNode.connect(track.gainNode);
    track.gainNode.connect(track.analyser);
    track.analyser.connect(this.masterCompressor);
    track.connected = true;

    track.source.start(this.ctx.currentTime + when);
  }

  /** Stop a track */
  stop(trackId: string): void {
    const track = this.tracks.get(trackId);
    if (!track || !track.source) return;
    try { track.source.stop(); } catch { /* ok */ }
  }

  /** Set track volume (0 to 1) with optional fade */
  setTrackVolume(trackId: string, volume: number, fadeTime = 0): void {
    const track = this.tracks.get(trackId);
    if (!track) return;
    if (fadeTime > 0) {
      track.gainNode.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + fadeTime);
    } else {
      track.gainNode.gain.value = volume;
    }
  }

  /** Set master volume */
  setMasterVolume(volume: number): void {
    this.masterGain.gain.value = volume;
  }

  /** Get frequency data for visualization (0-255 per bin) */
  getFrequencyData(trackId?: string): Uint8Array {
    const analyser = trackId ? this.tracks.get(trackId)?.analyser : this.masterAnalyser;
    if (!analyser) return new Uint8Array(0);
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    return data;
  }

  /** Get waveform data for visualization */
  getWaveformData(trackId?: string): Uint8Array {
    const analyser = trackId ? this.tracks.get(trackId)?.analyser : this.masterAnalyser;
    if (!analyser) return new Uint8Array(0);
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);
    return data;
  }

  // ── Cleanup ────────────────────────────────────────────────────────

  /** Remove a track and disconnect all nodes */
  removeTrack(trackId: string): void {
    const track = this.tracks.get(trackId);
    if (!track) return;
    try { track.source?.stop(); } catch { /* ok */ }
    track.source?.disconnect();
    for (const effect of track.effects) {
      for (const node of effect.nodes) {
        try { node.disconnect(); } catch { /* ok */ }
      }
    }
    track.gainNode.disconnect();
    track.analyser.disconnect();
    this.tracks.delete(trackId);
  }

  /** Destroy the engine */
  async destroy(): Promise<void> {
    for (const id of this.tracks.keys()) this.removeTrack(id);
    this.buffers.clear();
    await this.ctx.close();
  }
}
`
      }

      mkdirSync(dirname(outputPath), { recursive: true })
      writeFileSync(outputPath, code)
      const lines = code.split('\n').length
      return `Generated ${system} audio system (${engine}) at ${outputPath} (${lines} lines)`
    },
  })

  // ── Tool 13: netcode_scaffold ───────────────────────────────────────
  registerTool({
    name: 'netcode_scaffold',
    description: 'Generate multiplayer netcode scaffolding: server, client, and shared types. Supports WebSocket/WebRTC transports with Colyseus, Socket.IO, Geckos.io, Nakama, or raw implementations. Includes lobby, matchmaking, state sync, input prediction, chat, and reconnection features.',
    parameters: {
      architecture: { type: 'string', description: 'Network architecture: client_server, peer_to_peer, relay', required: true },
      transport: { type: 'string', description: 'Transport protocol: websocket, webrtc (default: websocket)' },
      framework: { type: 'string', description: 'Framework: colyseus, socket_io, geckos, nakama, raw (default: raw)' },
      output_dir: { type: 'string', description: 'Output directory for generated files', required: true },
      features: { type: 'string', description: 'JSON array of features: lobby, matchmaking, state_sync, input_prediction, chat, reconnect' },
    },
    tier: 'free',
    async execute(args) {
      const architecture = String(args.architecture).toLowerCase()
      const transport = String(args.transport || 'websocket').toLowerCase()
      const framework = String(args.framework || 'raw').toLowerCase()
      const outputDir = safePath(String(args.output_dir))
      let features: string[] = ['lobby', 'state_sync']
      try { features = args.features ? JSON.parse(String(args.features)) : ['lobby', 'state_sync'] } catch { return 'Error: features must be valid JSON' }

      const validTransports = ['websocket', 'webrtc']
      if (!validTransports.includes(transport)) return `Error: transport must be one of: ${validTransports.join(', ')}`

      const validFrameworks = ['colyseus', 'socket_io', 'geckos', 'nakama', 'raw']
      if (!validFrameworks.includes(framework)) return `Error: framework must be one of: ${validFrameworks.join(', ')}`

      const validArch = ['client_server', 'peer_to_peer', 'relay']
      if (!validArch.includes(architecture)) {
        return `Error: Unknown architecture "${architecture}". Valid: ${validArch.join(', ')}`
      }

      mkdirSync(join(outputDir, 'shared'), { recursive: true })

      const files: string[] = []

      // ── shared/types.ts ──────────────────────────────────────────
      const hasLobby = features.includes('lobby')
      const hasMatchmaking = features.includes('matchmaking')
      const hasStateSync = features.includes('state_sync')
      const hasInputPrediction = features.includes('input_prediction')
      const hasChat = features.includes('chat')
      const hasReconnect = features.includes('reconnect')

      const sharedTypes = `// shared/types.ts — Shared types for ${architecture} netcode
// Generated by kbot game_netcode

// ── Message Types ────────────────────────────────────────────────────

export enum MessageType {
  // Connection
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  PING = 'ping',
  PONG = 'pong',
${hasReconnect ? `  RECONNECT = 'reconnect',
  RECONNECT_ACK = 'reconnect_ack',
` : ''}
  // State
  STATE_FULL = 'state_full',
  STATE_PATCH = 'state_patch',
${hasInputPrediction ? `  INPUT = 'input',
  INPUT_ACK = 'input_ack',
` : ''}
${hasLobby ? `  // Lobby
  LOBBY_LIST = 'lobby_list',
  LOBBY_CREATE = 'lobby_create',
  LOBBY_JOIN = 'lobby_join',
  LOBBY_LEAVE = 'lobby_leave',
  LOBBY_UPDATE = 'lobby_update',
  LOBBY_READY = 'lobby_ready',
  LOBBY_START = 'lobby_start',
` : ''}
${hasMatchmaking ? `  // Matchmaking
  MATCHMAKING_JOIN = 'matchmaking_join',
  MATCHMAKING_LEAVE = 'matchmaking_leave',
  MATCHMAKING_FOUND = 'matchmaking_found',
` : ''}
${hasChat ? `  // Chat
  CHAT_MESSAGE = 'chat_message',
  CHAT_BROADCAST = 'chat_broadcast',
` : ''}
  // Game
  GAME_START = 'game_start',
  GAME_END = 'game_end',
  PLAYER_JOIN = 'player_join',
  PLAYER_LEAVE = 'player_leave',
}

// ── Core Types ───────────────────────────────────────────────────────

export interface NetworkMessage<T = unknown> {
  type: MessageType;
  payload: T;
  timestamp: number;
  sequence?: number;
  senderId?: string;
}

export interface Player {
  id: string;
  name: string;
  connected: boolean;
  latency: number;
${hasLobby ? '  ready: boolean;\n' : ''}${hasReconnect ? '  reconnectToken?: string;\n' : ''}}

export interface GameState {
  tick: number;
  timestamp: number;
  players: Record<string, PlayerState>;
  entities: Record<string, EntityState>;
}

export interface PlayerState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  health: number;
  score: number;
}

export interface EntityState {
  id: string;
  type: string;
  x: number;
  y: number;
  rotation: number;
  data: Record<string, unknown>;
}

${hasInputPrediction ? `// ── Input Prediction ──────────────────────────────────────────────

export interface InputPayload {
  sequence: number;
  tick: number;
  inputs: {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    fire: boolean;
    [key: string]: boolean | number;
  };
  deltaTime: number;
}

export interface InputAck {
  sequence: number;
  tick: number;
  position: { x: number; y: number };
}
` : ''}
${hasLobby ? `// ── Lobby Types ──────────────────────────────────────────────────────

export interface LobbyRoom {
  id: string;
  name: string;
  hostId: string;
  players: Player[];
  maxPlayers: number;
  status: 'waiting' | 'starting' | 'in_game';
  settings: Record<string, unknown>;
  createdAt: number;
}

export interface LobbyCreatePayload {
  name: string;
  maxPlayers: number;
  settings?: Record<string, unknown>;
}
` : ''}
${hasMatchmaking ? `// ── Matchmaking Types ────────────────────────────────────────────────

export interface MatchmakingRequest {
  playerId: string;
  rating: number;
  mode: string;
  region?: string;
}

export interface MatchmakingResult {
  roomId: string;
  players: Player[];
  serverUrl: string;
}
` : ''}
${hasChat ? `// ── Chat Types ───────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  channel: 'global' | 'room' | 'team' | 'whisper';
  targetId?: string;
}
` : ''}
// ── Utility ──────────────────────────────────────────────────────────

export function createMessage<T>(type: MessageType, payload: T, senderId?: string): NetworkMessage<T> {
  return {
    type,
    payload,
    timestamp: Date.now(),
    senderId,
  };
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export const TICK_RATE = 20; // Server ticks per second
export const TICK_INTERVAL = 1000 / TICK_RATE;
`
      writeFileSync(join(outputDir, 'shared', 'types.ts'), sharedTypes)
      files.push('shared/types.ts')

      // ── server.ts ────────────────────────────────────────────────
      let serverCode = ''

      if (framework === 'colyseus') {
        serverCode = `// server.ts — Colyseus Game Server
// Generated by kbot netcode_scaffold
//
// Prerequisites: npm install colyseus @colyseus/ws-transport @colyseus/monitor

import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { monitor } from '@colyseus/monitor';
import { createServer } from 'http';
import express from 'express';
import { GameRoom } from './GameRoom';
${hasLobby ? "import { LobbyRoom } from '@colyseus/core';\n" : ''}
const app = express();
app.use(express.json());

// Colyseus monitor (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.use('/colyseus', monitor());
}

const httpServer = createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

// Define rooms
gameServer.define('game', GameRoom)${hasMatchmaking ? "\n  .enableRealtimeListing()" : ''};
${hasLobby ? "gameServer.define('lobby', LobbyRoom);\n" : ''}
const PORT = parseInt(process.env.PORT || '2567', 10);
gameServer.listen(PORT).then(() => {
  console.log(\`[Server] Colyseus listening on ws://localhost:\${PORT}\`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[Server] Shutting down...');
  gameServer.gracefullyShutdown().then(() => process.exit(0));
});
`

        // Also generate GameRoom.ts for Colyseus
        const gameRoomCode = `// GameRoom.ts — Colyseus Room Implementation
import { Room, Client } from 'colyseus';
import { Schema, MapSchema, type } from '@colyseus/schema';

class PlayerSchema extends Schema {
  @type('string') id: string = '';
  @type('string') name: string = '';
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('number') vx: number = 0;
  @type('number') vy: number = 0;
  @type('number') rotation: number = 0;
  @type('number') health: number = 100;
  @type('number') score: number = 0;
  @type('boolean') connected: boolean = true;
${hasLobby ? "  @type('boolean') ready: boolean = false;\n" : ''}}

class GameStateSchema extends Schema {
  @type('number') tick: number = 0;
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
}

export class GameRoom extends Room<GameStateSchema> {
  maxClients = 16;
  private tickInterval: NodeJS.Timeout | null = null;

  onCreate(options: any) {
    this.setState(new GameStateSchema());
    this.setSimulationInterval((dt) => this.update(dt));
    this.setPatchRate(50); // 20 patches/sec
${hasInputPrediction ? `
    // Handle player inputs
    this.onMessage('input', (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      // Apply input
      const speed = 200;
      if (data.inputs.up) player.vy = -speed;
      else if (data.inputs.down) player.vy = speed;
      else player.vy = 0;
      if (data.inputs.left) player.vx = -speed;
      else if (data.inputs.right) player.vx = speed;
      else player.vx = 0;
      // Acknowledge input for client-side reconciliation
      client.send('input_ack', { sequence: data.sequence, tick: this.state.tick, position: { x: player.x, y: player.y } });
    });
` : ''}
${hasChat ? `
    this.onMessage('chat', (client, data) => {
      this.broadcast('chat', {
        senderId: client.sessionId,
        senderName: this.state.players.get(client.sessionId)?.name || 'Unknown',
        content: String(data.content).slice(0, 500),
        timestamp: Date.now(),
      });
    });
` : ''}
${hasLobby ? `
    this.onMessage('ready', (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) player.ready = !player.ready;
      // Check if all players are ready
      let allReady = true;
      this.state.players.forEach((p) => { if (!p.ready) allReady = false; });
      if (allReady && this.state.players.size >= 2) {
        this.broadcast('game_start', {});
        this.lock();
      }
    });
` : ''}
    console.log(\`[GameRoom] Room \${this.roomId} created\`);
  }

  onJoin(client: Client, options: any) {
    const player = new PlayerSchema();
    player.id = client.sessionId;
    player.name = options.name || \`Player_\${client.sessionId.slice(0, 4)}\`;
    player.x = Math.random() * 800;
    player.y = Math.random() * 600;
    this.state.players.set(client.sessionId, player);
    console.log(\`[GameRoom] \${player.name} joined (\${this.state.players.size} players)\`);
  }

  onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId);
    if (player) {
${hasReconnect ? `      if (!consented) {
        // Allow reconnection for 30 seconds
        player.connected = false;
        this.allowReconnection(client, 30).then((reconnectedClient) => {
          player.connected = true;
          console.log(\`[GameRoom] \${player.name} reconnected\`);
        }).catch(() => {
          this.state.players.delete(client.sessionId);
          console.log(\`[GameRoom] \${player.name} timed out\`);
        });
        return;
      }
` : ''}      this.state.players.delete(client.sessionId);
      console.log(\`[GameRoom] \${player.name} left\`);
    }
  }

  update(dt: number) {
    this.state.tick++;
    const dtSec = dt / 1000;
    this.state.players.forEach((player) => {
      if (!player.connected) return;
      player.x += player.vx * dtSec;
      player.y += player.vy * dtSec;
      // Clamp to world bounds
      player.x = Math.max(0, Math.min(800, player.x));
      player.y = Math.max(0, Math.min(600, player.y));
    });
  }

  onDispose() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    console.log(\`[GameRoom] Room \${this.roomId} disposed\`);
  }
}
`
        writeFileSync(join(outputDir, 'GameRoom.ts'), gameRoomCode)
        files.push('GameRoom.ts')

      } else if (framework === 'socket_io') {
        serverCode = `// server.ts — Socket.IO Game Server
// Generated by kbot netcode_scaffold
//
// Prerequisites: npm install socket.io express

import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import { MessageType, GameState, Player, PlayerState, TICK_RATE, TICK_INTERVAL, generateId } from './shared/types';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
${hasReconnect ? '  connectionStateRecovery: { maxDisconnectionDuration: 30000, skipMiddlewares: true },\n' : ''}\
});

// ── Game State ───────────────────────────────────────────────────────

const state: GameState = { tick: 0, timestamp: Date.now(), players: {}, entities: {} };
const players: Map<string, Player> = new Map();
${hasLobby ? `
interface Room { id: string; name: string; hostId: string; playerIds: Set<string>; maxPlayers: number; status: 'waiting' | 'starting' | 'in_game'; settings: Record<string, unknown>; }
const rooms: Map<string, Room> = new Map();
` : ''}${hasMatchmaking ? `
interface QueueEntry { socketId: string; rating: number; mode: string; joinedAt: number; }
const matchmakingQueue: QueueEntry[] = [];
` : ''}
// ── Connection Handling ──────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(\`[Server] Client connected: \${socket.id}\`);

  const player: Player = {
    id: socket.id,
    name: \`Player_\${socket.id.slice(0, 4)}\`,
    connected: true,
    latency: 0,
${hasLobby ? '    ready: false,\n' : ''}${hasReconnect ? '    reconnectToken: generateId(),\n' : ''}\
  };
  players.set(socket.id, player);
  state.players[socket.id] = { id: socket.id, x: Math.random() * 800, y: Math.random() * 600, vx: 0, vy: 0, rotation: 0, health: 100, score: 0 };

  // Send full state to new player
  socket.emit(MessageType.STATE_FULL, state);
  io.emit(MessageType.PLAYER_JOIN, player);

  // Ping/pong for latency measurement
  const pingInterval = setInterval(() => {
    const start = Date.now();
    socket.emit(MessageType.PING, start);
  }, 2000);

  socket.on(MessageType.PONG, (startTime: number) => {
    const p = players.get(socket.id);
    if (p) p.latency = Date.now() - startTime;
  });

${hasInputPrediction ? `
  // Handle player input
  socket.on(MessageType.INPUT, (data) => {
    const ps = state.players[socket.id];
    if (!ps) return;
    const speed = 200;
    if (data.inputs.up) ps.vy = -speed;
    else if (data.inputs.down) ps.vy = speed;
    else ps.vy = 0;
    if (data.inputs.left) ps.vx = -speed;
    else if (data.inputs.right) ps.vx = speed;
    else ps.vx = 0;
    socket.emit(MessageType.INPUT_ACK, { sequence: data.sequence, tick: state.tick, position: { x: ps.x, y: ps.y } });
  });
` : ''}
${hasChat ? `
  // Chat
  socket.on(MessageType.CHAT_MESSAGE, (data) => {
    const p = players.get(socket.id);
    io.emit(MessageType.CHAT_BROADCAST, {
      id: generateId(),
      senderId: socket.id,
      senderName: p?.name || 'Unknown',
      content: String(data.content).slice(0, 500),
      timestamp: Date.now(),
      channel: data.channel || 'global',
    });
  });
` : ''}
${hasLobby ? `
  // Lobby
  socket.on(MessageType.LOBBY_LIST, () => {
    socket.emit(MessageType.LOBBY_LIST, Array.from(rooms.values()).map(r => ({
      ...r, playerIds: undefined, players: Array.from(r.playerIds).map(id => players.get(id)).filter(Boolean),
    })));
  });

  socket.on(MessageType.LOBBY_CREATE, (data) => {
    const room: Room = {
      id: generateId(), name: data.name || \`Room \${rooms.size + 1}\`,
      hostId: socket.id, playerIds: new Set([socket.id]),
      maxPlayers: data.maxPlayers || 4, status: 'waiting', settings: data.settings || {},
    };
    rooms.set(room.id, room);
    socket.join(room.id);
    io.emit(MessageType.LOBBY_UPDATE, room);
  });

  socket.on(MessageType.LOBBY_JOIN, (data) => {
    const room = rooms.get(data.roomId);
    if (!room || room.playerIds.size >= room.maxPlayers) {
      socket.emit('error', { message: 'Room full or not found' });
      return;
    }
    room.playerIds.add(socket.id);
    socket.join(room.id);
    io.to(room.id).emit(MessageType.LOBBY_UPDATE, room);
  });

  socket.on(MessageType.LOBBY_READY, () => {
    const p = players.get(socket.id);
    if (p) p.ready = !p.ready;
  });

  socket.on(MessageType.LOBBY_START, (data) => {
    const room = rooms.get(data.roomId);
    if (room && room.hostId === socket.id) {
      room.status = 'in_game';
      io.to(room.id).emit(MessageType.GAME_START, { roomId: room.id });
    }
  });
` : ''}
  socket.on('disconnect', () => {
    clearInterval(pingInterval);
    const p = players.get(socket.id);
    if (p) p.connected = false;
${hasReconnect ? `    // Allow 30s for reconnect before cleanup
    setTimeout(() => {
      const p = players.get(socket.id);
      if (p && !p.connected) {
        players.delete(socket.id);
        delete state.players[socket.id];
        io.emit(MessageType.PLAYER_LEAVE, { id: socket.id });
      }
    }, 30_000);
` : `    players.delete(socket.id);
    delete state.players[socket.id];
    io.emit(MessageType.PLAYER_LEAVE, { id: socket.id });
`}    console.log(\`[Server] Client disconnected: \${socket.id}\`);
  });
});

// ── Game Loop ────────────────────────────────────────────────────────

setInterval(() => {
  state.tick++;
  state.timestamp = Date.now();
  const dtSec = TICK_INTERVAL / 1000;

  for (const [id, ps] of Object.entries(state.players)) {
    const p = players.get(id);
    if (!p?.connected) continue;
    ps.x += ps.vx * dtSec;
    ps.y += ps.vy * dtSec;
    ps.x = Math.max(0, Math.min(800, ps.x));
    ps.y = Math.max(0, Math.min(600, ps.y));
  }

  io.emit(MessageType.STATE_PATCH, { tick: state.tick, players: state.players });
}, TICK_INTERVAL);

${hasMatchmaking ? `
// ── Matchmaking ──────────────────────────────────────────────────────

setInterval(() => {
  if (matchmakingQueue.length < 2) return;
  // Sort by rating and match closest pairs
  matchmakingQueue.sort((a, b) => a.rating - b.rating);
  while (matchmakingQueue.length >= 2) {
    const p1 = matchmakingQueue.shift()!;
    const p2 = matchmakingQueue.shift()!;
    const roomId = generateId();
    const s1 = io.sockets.sockets.get(p1.socketId);
    const s2 = io.sockets.sockets.get(p2.socketId);
    if (s1 && s2) {
      s1.join(roomId);
      s2.join(roomId);
      io.to(roomId).emit(MessageType.MATCHMAKING_FOUND, { roomId, players: [p1.socketId, p2.socketId] });
    }
  }
}, 3000);
` : ''}
// ── Start Server ─────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3001', 10);
httpServer.listen(PORT, () => {
  console.log(\`[Server] Socket.IO listening on http://localhost:\${PORT}\`);
});
`
      } else {
        // raw WebSocket
        serverCode = `// server.ts — Raw WebSocket Game Server
// Generated by kbot netcode_scaffold
//
// Prerequisites: npm install ws

import { WebSocketServer, WebSocket } from 'ws';
import { MessageType, NetworkMessage, GameState, Player, PlayerState, TICK_RATE, TICK_INTERVAL, createMessage, generateId } from './shared/types';

// ── Server Setup ─────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3001', 10);
const wss = new WebSocketServer({ port: PORT });

// ── State ────────────────────────────────────────────────────────────

const state: GameState = { tick: 0, timestamp: Date.now(), players: {}, entities: {} };
const clients: Map<string, { ws: WebSocket; player: Player; alive: boolean }> = new Map();
${hasLobby ? `
interface Room {
  id: string; name: string; hostId: string; playerIds: Set<string>;
  maxPlayers: number; status: 'waiting' | 'starting' | 'in_game'; settings: Record<string, unknown>;
}
const rooms: Map<string, Room> = new Map();
` : ''}${hasMatchmaking ? `
interface QueueEntry { playerId: string; rating: number; mode: string; joinedAt: number; }
const matchmakingQueue: QueueEntry[] = [];
` : ''}
// ── Helpers ──────────────────────────────────────────────────────────

function send(ws: WebSocket, msg: NetworkMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcast(msg: NetworkMessage, exclude?: string): void {
  for (const [id, client] of clients) {
    if (id !== exclude && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(msg));
    }
  }
}

${hasLobby ? `function broadcastToRoom(roomId: string, msg: NetworkMessage, exclude?: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  for (const pid of room.playerIds) {
    if (pid !== exclude) {
      const c = clients.get(pid);
      if (c) send(c.ws, msg);
    }
  }
}
` : ''}
// ── Connection Handling ──────────────────────────────────────────────

wss.on('connection', (ws) => {
  const playerId = generateId();
  const player: Player = {
    id: playerId,
    name: \`Player_\${playerId.slice(0, 4)}\`,
    connected: true,
    latency: 0,
${hasLobby ? '    ready: false,\n' : ''}${hasReconnect ? '    reconnectToken: generateId(),\n' : ''}\
  };

  clients.set(playerId, { ws, player, alive: true });
  state.players[playerId] = {
    id: playerId, x: Math.random() * 800, y: Math.random() * 600,
    vx: 0, vy: 0, rotation: 0, health: 100, score: 0,
  };

  // Send player their ID and full state
  send(ws, createMessage(MessageType.CONNECT, { playerId, state${hasReconnect ? ', reconnectToken: player.reconnectToken' : ''} }));
  broadcast(createMessage(MessageType.PLAYER_JOIN, player), playerId);

  console.log(\`[Server] \${player.name} connected (\${clients.size} players)\`);

  // Heartbeat
  const pingInterval = setInterval(() => {
    const client = clients.get(playerId);
    if (client) {
      if (!client.alive) { ws.terminate(); return; }
      client.alive = false;
      send(ws, createMessage(MessageType.PING, Date.now()));
    }
  }, 5000);

  ws.on('message', (raw) => {
    let msg: NetworkMessage;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    switch (msg.type) {
      case MessageType.PONG: {
        const client = clients.get(playerId);
        if (client) {
          client.alive = true;
          client.player.latency = Date.now() - (msg.payload as number);
        }
        break;
      }
${hasInputPrediction ? `
      case MessageType.INPUT: {
        const ps = state.players[playerId];
        if (!ps) break;
        const data = msg.payload as any;
        const speed = 200;
        if (data.inputs.up) ps.vy = -speed;
        else if (data.inputs.down) ps.vy = speed;
        else ps.vy = 0;
        if (data.inputs.left) ps.vx = -speed;
        else if (data.inputs.right) ps.vx = speed;
        else ps.vx = 0;
        send(ws, createMessage(MessageType.INPUT_ACK, {
          sequence: data.sequence, tick: state.tick,
          position: { x: ps.x, y: ps.y },
        }));
        break;
      }
` : ''}
${hasChat ? `
      case MessageType.CHAT_MESSAGE: {
        const data = msg.payload as any;
        broadcast(createMessage(MessageType.CHAT_BROADCAST, {
          id: generateId(),
          senderId: playerId,
          senderName: player.name,
          content: String(data.content).slice(0, 500),
          timestamp: Date.now(),
          channel: data.channel || 'global',
        }));
        break;
      }
` : ''}
${hasLobby ? `
      case MessageType.LOBBY_LIST: {
        const list = Array.from(rooms.values()).map(r => ({
          id: r.id, name: r.name, hostId: r.hostId,
          playerCount: r.playerIds.size, maxPlayers: r.maxPlayers,
          status: r.status,
        }));
        send(ws, createMessage(MessageType.LOBBY_LIST, list));
        break;
      }

      case MessageType.LOBBY_CREATE: {
        const data = msg.payload as any;
        const room: Room = {
          id: generateId(), name: data.name || \`Room \${rooms.size + 1}\`,
          hostId: playerId, playerIds: new Set([playerId]),
          maxPlayers: data.maxPlayers || 4, status: 'waiting',
          settings: data.settings || {},
        };
        rooms.set(room.id, room);
        send(ws, createMessage(MessageType.LOBBY_UPDATE, { roomId: room.id, room }));
        break;
      }

      case MessageType.LOBBY_JOIN: {
        const data = msg.payload as any;
        const room = rooms.get(data.roomId);
        if (!room || room.playerIds.size >= room.maxPlayers) {
          send(ws, createMessage(MessageType.DISCONNECT, { error: 'Room full or not found' }));
          break;
        }
        room.playerIds.add(playerId);
        broadcastToRoom(room.id, createMessage(MessageType.LOBBY_UPDATE, { roomId: room.id, room }));
        break;
      }

      case MessageType.LOBBY_READY: {
        player.ready = !player.ready;
        // Find player's room and broadcast update
        for (const room of rooms.values()) {
          if (room.playerIds.has(playerId)) {
            broadcastToRoom(room.id, createMessage(MessageType.LOBBY_UPDATE, { roomId: room.id, room }));
            break;
          }
        }
        break;
      }

      case MessageType.LOBBY_START: {
        const data = msg.payload as any;
        const room = rooms.get(data.roomId);
        if (room && room.hostId === playerId) {
          room.status = 'in_game';
          broadcastToRoom(room.id, createMessage(MessageType.GAME_START, { roomId: room.id }));
        }
        break;
      }
` : ''}
${hasReconnect ? `
      case MessageType.RECONNECT: {
        const data = msg.payload as any;
        // Find player by reconnect token
        for (const [oldId, client] of clients) {
          if (client.player.reconnectToken === data.token && !client.player.connected) {
            // Migrate session
            client.ws = ws;
            client.player.connected = true;
            client.alive = true;
            clients.delete(playerId);
            // Remove the new player state we just created
            delete state.players[playerId];
            send(ws, createMessage(MessageType.RECONNECT_ACK, { playerId: oldId, state }));
            console.log(\`[Server] \${client.player.name} reconnected\`);
            return;
          }
        }
        send(ws, createMessage(MessageType.DISCONNECT, { error: 'Invalid reconnect token' }));
        break;
      }
` : ''}
    }
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    const client = clients.get(playerId);
    if (client) {
      client.player.connected = false;
${hasReconnect ? `      // Allow 30s reconnect window
      setTimeout(() => {
        const c = clients.get(playerId);
        if (c && !c.player.connected) {
          clients.delete(playerId);
          delete state.players[playerId];
          broadcast(createMessage(MessageType.PLAYER_LEAVE, { id: playerId }));
          console.log(\`[Server] \${c.player.name} timed out\`);
        }
      }, 30_000);
` : `      clients.delete(playerId);
      delete state.players[playerId];
      broadcast(createMessage(MessageType.PLAYER_LEAVE, { id: playerId }));
`}    }
    console.log(\`[Server] Client disconnected (\${clients.size} remaining)\`);
  });

  ws.on('error', (err) => {
    console.error(\`[Server] WebSocket error for \${playerId}: \${err.message}\`);
  });
});

// ── Game Loop ────────────────────────────────────────────────────────

setInterval(() => {
  state.tick++;
  state.timestamp = Date.now();
  const dtSec = TICK_INTERVAL / 1000;

  for (const [id, ps] of Object.entries(state.players)) {
    const client = clients.get(id);
    if (!client?.player.connected) continue;
    ps.x += ps.vx * dtSec;
    ps.y += ps.vy * dtSec;
    ps.x = Math.max(0, Math.min(800, ps.x));
    ps.y = Math.max(0, Math.min(600, ps.y));
  }

  broadcast(createMessage(MessageType.STATE_PATCH, { tick: state.tick, players: state.players }));
}, TICK_INTERVAL);

${hasMatchmaking ? `
// ── Matchmaking ──────────────────────────────────────────────────────

setInterval(() => {
  if (matchmakingQueue.length < 2) return;
  matchmakingQueue.sort((a, b) => a.rating - b.rating);
  while (matchmakingQueue.length >= 2) {
    const p1 = matchmakingQueue.shift()!;
    const p2 = matchmakingQueue.shift()!;
    const roomId = generateId();
    const c1 = clients.get(p1.playerId);
    const c2 = clients.get(p2.playerId);
    if (c1 && c2) {
      const result = { roomId, players: [p1.playerId, p2.playerId] };
      send(c1.ws, createMessage(MessageType.MATCHMAKING_FOUND, result));
      send(c2.ws, createMessage(MessageType.MATCHMAKING_FOUND, result));
    }
  }
}, 3000);
` : ''}
console.log(\`[Server] WebSocket server listening on ws://localhost:\${PORT}\`);
`
      }

      writeFileSync(join(outputDir, 'server.ts'), serverCode)
      files.push('server.ts')

      // ── client.ts ────────────────────────────────────────────────
      let clientCode = ''

      if (framework === 'colyseus') {
        clientCode = `// client.ts — Colyseus Client
// Generated by kbot netcode_scaffold
//
// Prerequisites: npm install colyseus.js

import { Client, Room } from 'colyseus.js';
import { MessageType } from './shared/types';

export class GameClient {
  private client: Client;
  private room: Room | null = null;
  private onStateChange: ((state: any) => void) | null = null;
  private onPlayerJoin: ((player: any) => void) | null = null;
  private onPlayerLeave: ((id: string) => void) | null = null;
${hasInputPrediction ? `  private inputSequence = 0;
  private pendingInputs: Array<{ sequence: number; inputs: any; deltaTime: number }> = [];
` : ''}
  constructor(serverUrl = 'ws://localhost:2567') {
    this.client = new Client(serverUrl);
  }

  async joinRoom(roomName = 'game', options: any = {}): Promise<void> {
    this.room = await this.client.joinOrCreate(roomName, options);

    this.room.onStateChange((state) => {
      this.onStateChange?.(state);
    });

    this.room.state.players.onAdd((player: any, key: string) => {
      this.onPlayerJoin?.(player);
    });

    this.room.state.players.onRemove((_player: any, key: string) => {
      this.onPlayerLeave?.(key);
    });

${hasInputPrediction ? `
    this.room.onMessage('input_ack', (data) => {
      // Remove acknowledged inputs for reconciliation
      this.pendingInputs = this.pendingInputs.filter(i => i.sequence > data.sequence);
    });
` : ''}
${hasChat ? `
    this.room.onMessage('chat', (data) => {
      this.onChatMessage?.(data);
    });
` : ''}
    console.log(\`[Client] Joined room \${this.room.id}\`);
  }

${hasInputPrediction ? `
  /** Send input to server with prediction */
  sendInput(inputs: Record<string, boolean | number>, deltaTime: number): void {
    if (!this.room) return;
    const sequence = ++this.inputSequence;
    const payload = { sequence, inputs, deltaTime };
    this.room.send('input', payload);
    this.pendingInputs.push(payload);
  }
` : ''}
${hasChat ? `
  private onChatMessage: ((msg: any) => void) | null = null;

  /** Send a chat message */
  sendChat(content: string, channel = 'global'): void {
    if (!this.room) return;
    this.room.send('chat', { content, channel });
  }

  /** Register chat message handler */
  onChat(handler: (msg: any) => void): void {
    this.onChatMessage = handler;
  }
` : ''}
${hasLobby ? `
  /** Toggle ready state */
  setReady(): void {
    this.room?.send('ready');
  }

  /** Start the game (host only) */
  startGame(): void {
    this.room?.send('start');
  }
` : ''}
  /** Register state change handler */
  onState(handler: (state: any) => void): void {
    this.onStateChange = handler;
  }

  /** Register player join/leave handlers */
  onJoin(handler: (player: any) => void): void { this.onPlayerJoin = handler; }
  onLeave(handler: (id: string) => void): void { this.onPlayerLeave = handler; }

  /** Get the session ID */
  get sessionId(): string { return this.room?.sessionId || ''; }

  /** Disconnect */
  leave(): void {
    this.room?.leave();
    this.room = null;
  }
}
`
      } else if (framework === 'socket_io') {
        clientCode = `// client.ts — Socket.IO Game Client
// Generated by kbot netcode_scaffold
//
// Prerequisites: npm install socket.io-client

import { io, Socket } from 'socket.io-client';
import { MessageType, GameState, Player, PlayerState, createMessage } from './shared/types';

type EventHandler<T = any> = (data: T) => void;

export class GameClient {
  private socket: Socket;
  private playerId: string = '';
  private state: GameState = { tick: 0, timestamp: 0, players: {}, entities: {} };
  private latency = 0;
  private handlers: Map<string, EventHandler[]> = new Map();
${hasInputPrediction ? `  private inputSequence = 0;
  private pendingInputs: Array<{ sequence: number; inputs: any; deltaTime: number }> = [];
  private localPlayer: PlayerState | null = null;
` : ''}${hasReconnect ? `  private reconnectToken: string = '';
` : ''}
  constructor(serverUrl = 'http://localhost:3001') {
    this.socket = io(serverUrl, {
      autoConnect: false,
      reconnection: ${hasReconnect},
${hasReconnect ? '      reconnectionAttempts: 10,\n      reconnectionDelay: 1000,\n' : ''}\
    });
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.socket.on('connect', () => {
      console.log('[Client] Connected');
    });

    this.socket.on(MessageType.STATE_FULL, (data: GameState) => {
      this.state = data;
      this.emit('state', data);
    });

    this.socket.on(MessageType.STATE_PATCH, (data: { tick: number; players: Record<string, PlayerState> }) => {
      this.state.tick = data.tick;
      this.state.players = data.players;
${hasInputPrediction ? `
      // Client-side reconciliation
      if (this.localPlayer && this.playerId) {
        const serverState = data.players[this.playerId];
        if (serverState) {
          this.localPlayer.x = serverState.x;
          this.localPlayer.y = serverState.y;
          // Re-apply pending inputs
          for (const input of this.pendingInputs) {
            this.applyInput(this.localPlayer, input.inputs, input.deltaTime);
          }
        }
      }
` : ''}
      this.emit('state', this.state);
    });

    this.socket.on(MessageType.PLAYER_JOIN, (player: Player) => {
      this.emit('player_join', player);
    });

    this.socket.on(MessageType.PLAYER_LEAVE, (data: { id: string }) => {
      this.emit('player_leave', data.id);
    });

    this.socket.on(MessageType.PING, (startTime: number) => {
      this.socket.emit(MessageType.PONG, startTime);
    });

${hasInputPrediction ? `
    this.socket.on(MessageType.INPUT_ACK, (data: { sequence: number; tick: number; position: { x: number; y: number } }) => {
      this.pendingInputs = this.pendingInputs.filter(i => i.sequence > data.sequence);
    });
` : ''}
${hasChat ? `
    this.socket.on(MessageType.CHAT_BROADCAST, (msg: any) => {
      this.emit('chat', msg);
    });
` : ''}
${hasLobby ? `
    this.socket.on(MessageType.LOBBY_LIST, (rooms: any[]) => { this.emit('lobby_list', rooms); });
    this.socket.on(MessageType.LOBBY_UPDATE, (data: any) => { this.emit('lobby_update', data); });
    this.socket.on(MessageType.GAME_START, (data: any) => { this.emit('game_start', data); });
` : ''}
${hasMatchmaking ? `
    this.socket.on(MessageType.MATCHMAKING_FOUND, (data: any) => { this.emit('match_found', data); });
` : ''}
    this.socket.on('disconnect', () => {
      console.log('[Client] Disconnected');
      this.emit('disconnected', null);
    });
  }

${hasInputPrediction ? `
  private applyInput(ps: PlayerState, inputs: any, dt: number): void {
    const speed = 200;
    if (inputs.up) ps.y -= speed * dt;
    if (inputs.down) ps.y += speed * dt;
    if (inputs.left) ps.x -= speed * dt;
    if (inputs.right) ps.x += speed * dt;
  }

  /** Send input with client-side prediction */
  sendInput(inputs: Record<string, boolean | number>, deltaTime: number): void {
    const sequence = ++this.inputSequence;
    const payload = { sequence, inputs, deltaTime };
    this.socket.emit(MessageType.INPUT, payload);
    this.pendingInputs.push(payload);
    // Predict locally
    if (this.localPlayer) {
      this.applyInput(this.localPlayer, inputs, deltaTime);
    }
  }
` : ''}
${hasChat ? `
  /** Send a chat message */
  sendChat(content: string, channel = 'global'): void {
    this.socket.emit(MessageType.CHAT_MESSAGE, { content, channel });
  }
` : ''}
${hasLobby ? `
  /** Request lobby room list */
  requestLobbyList(): void { this.socket.emit(MessageType.LOBBY_LIST); }
  /** Create a lobby room */
  createRoom(name: string, maxPlayers = 4): void { this.socket.emit(MessageType.LOBBY_CREATE, { name, maxPlayers }); }
  /** Join a lobby room */
  joinRoom(roomId: string): void { this.socket.emit(MessageType.LOBBY_JOIN, { roomId }); }
  /** Toggle ready state */
  setReady(): void { this.socket.emit(MessageType.LOBBY_READY); }
  /** Start the game (host only) */
  startGame(roomId: string): void { this.socket.emit(MessageType.LOBBY_START, { roomId }); }
` : ''}
${hasMatchmaking ? `
  /** Join matchmaking queue */
  joinMatchmaking(rating: number, mode = 'default'): void {
    this.socket.emit(MessageType.MATCHMAKING_JOIN, { rating, mode });
  }
  /** Leave matchmaking queue */
  leaveMatchmaking(): void { this.socket.emit(MessageType.MATCHMAKING_LEAVE); }
` : ''}
  /** Connect to server */
  connect(): void { this.socket.connect(); }

  /** Disconnect from server */
  disconnect(): void { this.socket.disconnect(); }

  /** Get current game state */
  getState(): GameState { return this.state; }

  /** Get current latency */
  getLatency(): number { return this.latency; }

  /** Register event handler */
  on(event: string, handler: EventHandler): void {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event)!.push(handler);
  }

  private emit(event: string, data: any): void {
    const handlers = this.handlers.get(event) || [];
    for (const h of handlers) h(data);
  }
}
`
      } else {
        // raw WebSocket client
        clientCode = `// client.ts — Raw WebSocket Game Client
// Generated by kbot netcode_scaffold
//
// Works in browser and Node.js (with 'ws' package)

import { MessageType, NetworkMessage, GameState, PlayerState, createMessage } from './shared/types';

type EventHandler<T = any> = (data: T) => void;

export class GameClient {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private playerId: string = '';
  private state: GameState = { tick: 0, timestamp: 0, players: {}, entities: {} };
  private latency = 0;
  private handlers: Map<string, EventHandler[]> = new Map();
  private connected = false;
${hasInputPrediction ? `  private inputSequence = 0;
  private pendingInputs: Array<{ sequence: number; inputs: any; deltaTime: number }> = [];
  private localPlayer: PlayerState | null = null;
` : ''}${hasReconnect ? `  private reconnectToken: string = '';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
` : ''}
  constructor(serverUrl = 'ws://localhost:3001') {
    this.serverUrl = serverUrl;
  }

  /** Connect to the server */
  connect(): void {
    this.ws = new WebSocket(this.serverUrl);

    this.ws.onopen = () => {
      this.connected = true;
${hasReconnect ? `      this.reconnectAttempts = 0;
      // Attempt reconnect if we have a token
      if (this.reconnectToken) {
        this.send(createMessage(MessageType.RECONNECT, { token: this.reconnectToken }));
      }
` : ''}
      this.emit('connected', null);
      console.log('[Client] Connected');
    };

    this.ws.onmessage = (event) => {
      let msg: NetworkMessage;
      try { msg = JSON.parse(event.data); } catch { return; }
      this.handleMessage(msg);
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.emit('disconnected', null);
      console.log('[Client] Disconnected');
${hasReconnect ? `
      // Auto-reconnect
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
        console.log(\`[Client] Reconnecting in \${delay}ms (attempt \${this.reconnectAttempts})\`);
        this.reconnectTimer = setTimeout(() => this.connect(), delay);
      }
` : ''}
    };

    this.ws.onerror = (err) => {
      console.error('[Client] WebSocket error:', err);
    };
  }

  private handleMessage(msg: NetworkMessage): void {
    switch (msg.type) {
      case MessageType.CONNECT: {
        const data = msg.payload as any;
        this.playerId = data.playerId;
        this.state = data.state;
${hasReconnect ? '        this.reconnectToken = data.reconnectToken || this.reconnectToken;\n' : ''}
${hasInputPrediction ? '        this.localPlayer = this.state.players[this.playerId] || null;\n' : ''}
        this.emit('joined', { playerId: this.playerId });
        break;
      }
${hasReconnect ? `
      case MessageType.RECONNECT_ACK: {
        const data = msg.payload as any;
        this.playerId = data.playerId;
        this.state = data.state;
        this.emit('reconnected', { playerId: this.playerId });
        break;
      }
` : ''}
      case MessageType.STATE_FULL:
        this.state = msg.payload as GameState;
        this.emit('state', this.state);
        break;

      case MessageType.STATE_PATCH: {
        const patch = msg.payload as { tick: number; players: Record<string, PlayerState> };
        this.state.tick = patch.tick;
        this.state.players = patch.players;
${hasInputPrediction ? `
        // Client-side reconciliation
        if (this.localPlayer && this.playerId) {
          const serverState = patch.players[this.playerId];
          if (serverState) {
            this.localPlayer.x = serverState.x;
            this.localPlayer.y = serverState.y;
            // Re-apply unacknowledged inputs
            for (const input of this.pendingInputs) {
              this.applyInput(this.localPlayer, input.inputs, input.deltaTime);
            }
          }
        }
` : ''}
        this.emit('state', this.state);
        break;
      }

      case MessageType.PLAYER_JOIN:
        this.emit('player_join', msg.payload);
        break;

      case MessageType.PLAYER_LEAVE:
        this.emit('player_leave', (msg.payload as any).id);
        break;

      case MessageType.PING:
        this.send(createMessage(MessageType.PONG, msg.payload));
        break;

${hasInputPrediction ? `
      case MessageType.INPUT_ACK: {
        const ack = msg.payload as { sequence: number };
        this.pendingInputs = this.pendingInputs.filter(i => i.sequence > ack.sequence);
        break;
      }
` : ''}
${hasChat ? `
      case MessageType.CHAT_BROADCAST:
        this.emit('chat', msg.payload);
        break;
` : ''}
${hasLobby ? `
      case MessageType.LOBBY_LIST:
        this.emit('lobby_list', msg.payload);
        break;
      case MessageType.LOBBY_UPDATE:
        this.emit('lobby_update', msg.payload);
        break;
      case MessageType.GAME_START:
        this.emit('game_start', msg.payload);
        break;
` : ''}
${hasMatchmaking ? `
      case MessageType.MATCHMAKING_FOUND:
        this.emit('match_found', msg.payload);
        break;
` : ''}
    }
  }

${hasInputPrediction ? `
  private applyInput(ps: PlayerState, inputs: any, dt: number): void {
    const speed = 200;
    if (inputs.up) ps.y -= speed * dt;
    if (inputs.down) ps.y += speed * dt;
    if (inputs.left) ps.x -= speed * dt;
    if (inputs.right) ps.x += speed * dt;
  }

  /** Send input with client-side prediction */
  sendInput(inputs: Record<string, boolean | number>, deltaTime: number): void {
    const sequence = ++this.inputSequence;
    const payload = { sequence, tick: this.state.tick, inputs, deltaTime };
    this.send(createMessage(MessageType.INPUT, payload));
    this.pendingInputs.push({ sequence, inputs, deltaTime });
    if (this.localPlayer) {
      this.applyInput(this.localPlayer, inputs, deltaTime);
    }
  }

  /** Get predicted local player state */
  getLocalPlayer(): PlayerState | null { return this.localPlayer; }
` : ''}
${hasChat ? `
  /** Send a chat message */
  sendChat(content: string, channel = 'global'): void {
    this.send(createMessage(MessageType.CHAT_MESSAGE, { content, channel }));
  }
` : ''}
${hasLobby ? `
  /** Request lobby list */
  requestLobbyList(): void { this.send(createMessage(MessageType.LOBBY_LIST, {})); }
  /** Create a lobby room */
  createRoom(name: string, maxPlayers = 4, settings?: Record<string, unknown>): void {
    this.send(createMessage(MessageType.LOBBY_CREATE, { name, maxPlayers, settings }));
  }
  /** Join a lobby room */
  joinRoom(roomId: string): void { this.send(createMessage(MessageType.LOBBY_JOIN, { roomId })); }
  /** Toggle ready state */
  setReady(): void { this.send(createMessage(MessageType.LOBBY_READY, {})); }
  /** Start game (host only) */
  startGame(roomId: string): void { this.send(createMessage(MessageType.LOBBY_START, { roomId })); }
` : ''}
${hasMatchmaking ? `
  /** Join matchmaking */
  joinMatchmaking(rating: number, mode = 'default'): void {
    this.send(createMessage(MessageType.MATCHMAKING_JOIN, { rating, mode }));
  }
  /** Leave matchmaking */
  leaveMatchmaking(): void { this.send(createMessage(MessageType.MATCHMAKING_LEAVE, {})); }
` : ''}
  private send(msg: NetworkMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  /** Disconnect from server */
  disconnect(): void {
${hasReconnect ? '    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);\n    this.reconnectAttempts = this.maxReconnectAttempts; // prevent auto-reconnect\n' : ''}
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }

  /** Get current state */
  getState(): GameState { return this.state; }
  /** Get player ID */
  getPlayerId(): string { return this.playerId; }
  /** Get latency */
  getLatency(): number { return this.latency; }
  /** Check connection */
  isConnected(): boolean { return this.connected; }

  /** Register event handler */
  on(event: string, handler: EventHandler): void {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event)!.push(handler);
  }

  /** Remove event handler */
  off(event: string, handler: EventHandler): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    }
  }

  private emit(event: string, data: any): void {
    const handlers = this.handlers.get(event) || [];
    for (const h of handlers) h(data);
  }
}
`
      }

      writeFileSync(join(outputDir, 'client.ts'), clientCode)
      files.push('client.ts')

      const totalLines = [sharedTypes, serverCode, clientCode].reduce((sum, f) => sum + f.split('\n').length, 0)
      return `Generated ${architecture} netcode scaffold (${framework}/${transport}) with features [${features.join(', ')}]:\n${files.map(f => `  ${outputDir}/${f}`).join('\n')}\nTotal: ${totalLines} lines across ${files.length} files`
    },
  })

  // ── Tool 14: game_build ─────────────────────────────────────────────
  registerTool({
    name: 'game_build',
    description: 'Generate CI/CD pipelines and build configurations for game distribution. Supports Steam, itch.io, web, iOS, and Android targets with GitHub Actions or GitLab CI.',
    parameters: {
      engine: { type: 'string', description: 'Game engine or framework (e.g., godot, unity, unreal, three, phaser, bevy, web)' },
      platforms: { type: 'string', description: 'Comma-separated target platforms: steam, itch, web, ios, android', required: true },
      output_dir: { type: 'string', description: 'Output directory for build configs', required: true },
      ci: { type: 'string', description: 'CI system: github_actions, gitlab_ci (default: github_actions)' },
    },
    tier: 'free',
    async execute(args) {
      const engine = String(args.engine || 'web').toLowerCase()
      const platforms = String(args.platforms).split(',').map(p => p.trim().toLowerCase())
      const outputDir = safePath(String(args.output_dir))
      const ci = String(args.ci || 'github_actions').toLowerCase()

      const validPlatforms = ['steam', 'itch', 'web', 'ios', 'android']
      const invalid = platforms.filter(p => !validPlatforms.includes(p))
      if (invalid.length > 0) {
        return `Error: Unknown platform(s): ${invalid.join(', ')}. Valid: ${validPlatforms.join(', ')}`
      }

      const files: string[] = []

      const hasSteam = platforms.includes('steam')
      const hasItch = platforms.includes('itch')
      const hasWeb = platforms.includes('web')
      const hasIos = platforms.includes('ios')
      const hasAndroid = platforms.includes('android')

      // ── Steam build configs ──────────────────────────────────
      if (hasSteam) {
        mkdirSync(join(outputDir, 'steam'), { recursive: true })

        const steamAppId = `# steam_appid.txt — Replace with your actual Steam App ID
# This file is used by the Steamworks SDK during development
# DO NOT commit this to public repos
480
`
        writeFileSync(join(outputDir, 'steam', 'steam_appid.txt'), steamAppId)
        files.push('steam/steam_appid.txt')

        const appBuild = `"AppBuild"
{
\t"AppID" "YOUR_APP_ID"
\t"Desc" "Automated build via CI"
\t"ContentRoot" "..\\\\output\\\\steam"
\t"BuildOutput" "..\\\\output\\\\steam_build_logs"
\t"Depots"
\t{
\t\t"YOUR_DEPOT_ID_WINDOWS"
\t\t{
\t\t\t"FileMapping"
\t\t\t{
\t\t\t\t"LocalPath" "windows\\\\*"
\t\t\t\t"DepotPath" "."
\t\t\t\t"recursive" "1"
\t\t\t}
\t\t}
\t\t"YOUR_DEPOT_ID_LINUX"
\t\t{
\t\t\t"FileMapping"
\t\t\t{
\t\t\t\t"LocalPath" "linux\\\\*"
\t\t\t\t"DepotPath" "."
\t\t\t\t"recursive" "1"
\t\t\t}
\t\t}
\t\t"YOUR_DEPOT_ID_MAC"
\t\t{
\t\t\t"FileMapping"
\t\t\t{
\t\t\t\t"LocalPath" "mac\\\\*"
\t\t\t\t"DepotPath" "."
\t\t\t\t"recursive" "1"
\t\t\t}
\t\t}
\t}
}
`
        writeFileSync(join(outputDir, 'steam', 'app_build.vdf'), appBuild)
        files.push('steam/app_build.vdf')
      }

      // ── CI/CD Pipeline ───────────────────────────────────────
      if (ci === 'github_actions') {
        mkdirSync(join(outputDir, '.github', 'workflows'), { recursive: true })

        let workflow = `# Game Build & Deploy Pipeline — GitHub Actions
# Generated by kbot game_build
#
# Required secrets:
${hasSteam ? '#   STEAM_USERNAME, STEAM_PASSWORD — SteamPipe credentials\n#   STEAM_APP_ID — Your Steam App ID\n' : ''}${hasItch ? '#   BUTLER_API_KEY — itch.io butler API key\n#   ITCH_USER — itch.io username\n#   ITCH_GAME — itch.io game name\n' : ''}${hasIos ? '#   APPLE_CERTIFICATE, APPLE_PROVISIONING_PROFILE, APPLE_TEAM_ID\n' : ''}${hasAndroid ? '#   ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD\n' : ''}
name: Game Build & Deploy

on:
  push:
    tags: ['v*']
  workflow_dispatch:
    inputs:
      deploy:
        description: 'Deploy after build'
        required: false
        default: 'false'
        type: boolean

env:
  GAME_NAME: my-game
  BUILD_DIR: dist

jobs:
`
        // Build jobs per platform
        if (hasWeb) {
          workflow += `  build-web:
    name: Build (Web)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Build for web
        run: npm run build
        env:
          NODE_ENV: production

      - name: Optimize assets
        run: |
          # Compress with gzip and brotli for CDN
          find \${{ env.BUILD_DIR }} -type f \\( -name "*.js" -o -name "*.css" -o -name "*.html" -o -name "*.svg" \\) \\
            -exec gzip -9 -k {} \\;
          # Report sizes
          echo "## Web Build Sizes" >> \$GITHUB_STEP_SUMMARY
          echo '| File | Size |' >> \$GITHUB_STEP_SUMMARY
          echo '|------|------|' >> \$GITHUB_STEP_SUMMARY
          find \${{ env.BUILD_DIR }} -name "*.js" -o -name "*.css" -o -name "*.wasm" | sort | while read f; do
            size=\$(du -h "\$f" | cut -f1)
            echo "| \$(basename \$f) | \$size |" >> \$GITHUB_STEP_SUMMARY
          done

      - uses: actions/upload-artifact@v4
        with:
          name: build-web
          path: \${{ env.BUILD_DIR }}
          retention-days: 7

`
        }

        if (hasSteam) {
          const buildRunsOn = engine === 'godot' ? 'ubuntu-latest' : engine === 'unity' ? 'ubuntu-latest' : 'ubuntu-latest'
          workflow += `  build-desktop:
    name: Build (Desktop — Steam)
    runs-on: ${buildRunsOn}
    strategy:
      matrix:
        platform: [windows, linux, mac]
        include:
          - platform: windows
            os: windows-latest
            artifact: build-windows
          - platform: linux
            os: ubuntu-latest
            artifact: build-linux
          - platform: mac
            os: macos-latest
            artifact: build-mac
    runs-on: \${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4

${engine === 'godot' ? `      - name: Setup Godot
        uses: chickensoft-games/setup-godot@v2
        with:
          version: 4.3-stable
          use-dotnet: false

      - name: Export for \${{ matrix.platform }}
        run: |
          mkdir -p output/\${{ matrix.platform }}
          godot --headless --export-release "\${{ matrix.platform }}" output/\${{ matrix.platform }}/\${{ env.GAME_NAME }}
` : engine === 'unity' ? `      - name: Build with Unity
        uses: game-ci/unity-builder@v4
        with:
          targetPlatform: \${{ matrix.platform == 'windows' && 'StandaloneWindows64' || matrix.platform == 'linux' && 'StandaloneLinux64' || 'StandaloneOSX' }}
          buildName: \${{ env.GAME_NAME }}
          buildsPath: output
` : `      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Build desktop (\${{ matrix.platform }})
        run: |
          npx electron-builder --\${{ matrix.platform == 'windows' && 'win' || matrix.platform == 'mac' && 'mac' || 'linux' }}
          mkdir -p output/\${{ matrix.platform }}
          cp -r dist/* output/\${{ matrix.platform }}/
`}
      - uses: actions/upload-artifact@v4
        with:
          name: \${{ matrix.artifact }}
          path: output/\${{ matrix.platform }}
          retention-days: 7

  deploy-steam:
    name: Deploy to Steam
    needs: build-desktop
    if: startsWith(github.ref, 'refs/tags/v') || github.event.inputs.deploy == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/download-artifact@v4
        with:
          path: output

      - name: Install SteamCMD
        uses: CyberAndrii/setup-steamcmd@v1

      - name: Upload to Steam
        env:
          STEAM_USERNAME: \${{ secrets.STEAM_USERNAME }}
          STEAM_PASSWORD: \${{ secrets.STEAM_PASSWORD }}
        run: |
          steamcmd +login "\$STEAM_USERNAME" "\$STEAM_PASSWORD" \\
            +run_app_build \${{ github.workspace }}/steam/app_build.vdf \\
            +quit

`
        }

        if (hasItch) {
          workflow += `  deploy-itch:
    name: Deploy to itch.io
    needs: [${hasWeb ? 'build-web' : ''}${hasSteam ? (hasWeb ? ', build-desktop' : 'build-desktop') : ''}]
    if: startsWith(github.ref, 'refs/tags/v') || github.event.inputs.deploy == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          path: output

      - name: Install butler
        run: |
          curl -L -o butler.zip https://broth.itch.zone/butler/linux-amd64/LATEST/archive/default
          unzip butler.zip
          chmod +x butler
          ./butler -V

      - name: Push to itch.io
        env:
          BUTLER_API_KEY: \${{ secrets.BUTLER_API_KEY }}
        run: |
          VERSION=\${GITHUB_REF_NAME#v}
${hasWeb ? `          ./butler push output/build-web \${{ secrets.ITCH_USER }}/\${{ secrets.ITCH_GAME }}:html5 --userversion \$VERSION
` : ''}${hasSteam ? `          if [ -d "output/build-windows" ]; then
            ./butler push output/build-windows \${{ secrets.ITCH_USER }}/\${{ secrets.ITCH_GAME }}:windows --userversion \$VERSION
          fi
          if [ -d "output/build-linux" ]; then
            ./butler push output/build-linux \${{ secrets.ITCH_USER }}/\${{ secrets.ITCH_GAME }}:linux --userversion \$VERSION
          fi
          if [ -d "output/build-mac" ]; then
            ./butler push output/build-mac \${{ secrets.ITCH_USER }}/\${{ secrets.ITCH_GAME }}:mac --userversion \$VERSION
          fi
` : ''}
`
        }

        if (hasIos) {
          workflow += `  build-ios:
    name: Build (iOS)
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4

${engine === 'unity' ? `      - name: Build iOS
        uses: game-ci/unity-builder@v4
        with:
          targetPlatform: iOS
          buildName: \${{ env.GAME_NAME }}
` : engine === 'godot' ? `      - name: Setup Godot
        uses: chickensoft-games/setup-godot@v2
        with:
          version: 4.3-stable

      - name: Export iOS
        run: |
          mkdir -p output/ios
          godot --headless --export-release "iOS" output/ios/\${{ env.GAME_NAME }}.ipa
` : `      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - name: Build iOS (Capacitor)
        run: |
          npx cap sync ios
          cd ios/App
          xcodebuild -workspace App.xcworkspace -scheme App -configuration Release -archivePath output/\${{ env.GAME_NAME }}.xcarchive archive
`}
      - name: Code signing
        uses: apple-actions/import-codesign-certs@v2
        with:
          p12-file-base64: \${{ secrets.APPLE_CERTIFICATE }}
          p12-password: \${{ secrets.APPLE_CERTIFICATE_PASSWORD }}

      - uses: actions/upload-artifact@v4
        with:
          name: build-ios
          path: output/ios

`
        }

        if (hasAndroid) {
          workflow += `  build-android:
    name: Build (Android)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17

${engine === 'unity' ? `      - name: Build Android
        uses: game-ci/unity-builder@v4
        with:
          targetPlatform: Android
          buildName: \${{ env.GAME_NAME }}
          androidKeystoreName: release.keystore
          androidKeystoreBase64: \${{ secrets.ANDROID_KEYSTORE_BASE64 }}
          androidKeystorePass: \${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          androidKeyaliasName: \${{ secrets.ANDROID_KEY_ALIAS }}
          androidKeyaliasPass: \${{ secrets.ANDROID_KEY_PASSWORD }}
` : engine === 'godot' ? `      - name: Setup Godot
        uses: chickensoft-games/setup-godot@v2
        with:
          version: 4.3-stable

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Export Android
        run: |
          mkdir -p output/android
          godot --headless --export-release "Android" output/android/\${{ env.GAME_NAME }}.apk
` : `      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci

      - name: Build Android (Capacitor)
        run: |
          npx cap sync android
          cd android
          ./gradlew assembleRelease

      - name: Sign APK
        run: |
          echo "\${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 -d > release.keystore
          \$ANDROID_SDK_ROOT/build-tools/34.0.0/apksigner sign \\
            --ks release.keystore \\
            --ks-pass pass:\${{ secrets.ANDROID_KEYSTORE_PASSWORD }} \\
            --ks-key-alias \${{ secrets.ANDROID_KEY_ALIAS }} \\
            --key-pass pass:\${{ secrets.ANDROID_KEY_PASSWORD }} \\
            android/app/build/outputs/apk/release/app-release-unsigned.apk
`}
      - uses: actions/upload-artifact@v4
        with:
          name: build-android
          path: |
            output/android/*.apk
            android/app/build/outputs/apk/release/*.apk

`
        }

        writeFileSync(join(outputDir, '.github', 'workflows', 'game-build.yml'), workflow)
        files.push('.github/workflows/game-build.yml')
      } else if (ci === 'gitlab_ci') {
        // GitLab CI
        let gitlabCI = `# Game Build & Deploy Pipeline — GitLab CI
# Generated by kbot game_build
#
# Required CI/CD Variables:
${hasSteam ? '#   STEAM_USERNAME, STEAM_PASSWORD\n' : ''}${hasItch ? '#   BUTLER_API_KEY, ITCH_USER, ITCH_GAME\n' : ''}${hasIos ? '#   APPLE_CERTIFICATE_BASE64, APPLE_PROVISIONING_PROFILE_BASE64\n' : ''}${hasAndroid ? '#   ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD\n' : ''}
stages:
  - build
  - deploy

variables:
  GAME_NAME: my-game
  BUILD_DIR: dist

`
        if (hasWeb) {
          gitlabCI += `build:web:
  stage: build
  image: node:20
  script:
    - npm ci
    - npm run build
    - |
      echo "## Build sizes"
      find $BUILD_DIR -name "*.js" -o -name "*.css" -o -name "*.wasm" | while read f; do
        echo "  $(basename $f): $(du -h "$f" | cut -f1)"
      done
  artifacts:
    paths:
      - $BUILD_DIR/
    expire_in: 7 days

`
        }

        if (hasItch) {
          gitlabCI += `deploy:itch:
  stage: deploy
  image: dosowisko/butler
  only:
    - tags
  script:
${hasWeb ? '    - butler push $BUILD_DIR $ITCH_USER/$ITCH_GAME:html5 --userversion $CI_COMMIT_TAG\n' : ''}  dependencies:
${hasWeb ? '    - build:web\n' : ''}
`
        }

        writeFileSync(join(outputDir, '.gitlab-ci.yml'), gitlabCI)
        files.push('.gitlab-ci.yml')
      }

      // ── Web build config (Vite) ─────────────────────────────
      if (hasWeb) {
        const viteConfig = `// vite.config.ts — Optimized Vite config for game builds
// Generated by kbot game_build

import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsInlineLimit: 4096,    // Inline small assets (< 4KB)
    chunkSizeWarningLimit: 1000, // Games are bigger than typical web apps
    rollupOptions: {
      output: {
        // Separate large game assets from code
        manualChunks: {
          engine: [],  // Add your engine imports here
        },
        assetFileNames: (assetInfo) => {
          // Organize assets by type
          const name = assetInfo.name || '';
          if (/\\.(png|jpe?g|gif|svg|webp|avif)$/i.test(name)) return 'assets/images/[name]-[hash][extname]';
          if (/\\.(mp3|ogg|wav|m4a|flac)$/i.test(name)) return 'assets/audio/[name]-[hash][extname]';
          if (/\\.(woff2?|eot|ttf|otf)$/i.test(name)) return 'assets/fonts/[name]-[hash][extname]';
          if (/\\.(glb|gltf|fbx|obj)$/i.test(name)) return 'assets/models/[name]-[hash][extname]';
          if (/\\.(glsl|vert|frag|wgsl)$/i.test(name)) return 'assets/shaders/[name]-[hash][extname]';
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
    // Enable source maps for crash reporting in production
    sourcemap: true,
    // Minification optimized for games
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,     // Remove console.log in production
        drop_debugger: true,
        passes: 2,
      },
      mangle: {
        properties: false,      // Don't mangle property names (breaks serialization)
      },
    },
  },
  // WASM support for game engines
  optimizeDeps: {
    exclude: ['*.wasm'],
  },
  // Game-specific dev server settings
  server: {
    headers: {
      // Required for SharedArrayBuffer (used by some game engines)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  // Asset handling
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.hdr', '**/*.exr', '**/*.ktx2', '**/*.basis'],
});
`
        writeFileSync(join(outputDir, 'vite.config.game.ts'), viteConfig)
        files.push('vite.config.game.ts')
      }

      const totalLines = files.reduce((sum, f) => {
        try { return sum + readFileSync(join(outputDir, f), 'utf-8').split('\n').length } catch { return sum }
      }, 0)
      return `Generated game build pipeline for [${platforms.join(', ')}] (${engine}, ${ci}):\n${files.map(f => `  ${outputDir}/${f}`).join('\n')}\nTotal: ${totalLines} lines across ${files.length} files\n\nRemember to:\n${hasSteam ? '- Replace YOUR_APP_ID and YOUR_DEPOT_ID_* in steam/app_build.vdf\n- Add STEAM_USERNAME, STEAM_PASSWORD secrets\n' : ''}${hasItch ? '- Add BUTLER_API_KEY, ITCH_USER, ITCH_GAME secrets\n' : ''}${hasIos ? '- Add Apple signing certificates to secrets\n' : ''}${hasAndroid ? '- Add Android keystore to secrets\n' : ''}`
    },
  })

  // ── Tool 15: game_test ──────────────────────────────────────────────
  registerTool({
    name: 'game_test',
    description: 'Generate game testing and profiling utilities: FPS profiler, memory tracker, input recorder/replayer, screenshot regression tests, and performance budgets with runtime validation.',
    parameters: {
      test_type: { type: 'string', description: 'Test type: fps_profiler, memory_tracker, input_recorder, screenshot_test, performance_budget', required: true },
      engine: { type: 'string', description: 'Target engine: godot, unity, three, phaser, web (default: web)' },
      output_path: { type: 'string', description: 'Output file path', required: true },
      params: { type: 'string', description: 'JSON parameters for the test utility' },
    },
    tier: 'free',
    async execute(args) {
      const testType = String(args.test_type).toLowerCase()
      const engine = String(args.engine || 'web').toLowerCase()
      const outputPath = safePath(String(args.output_path))
      let params: any = {}
      try { params = args.params ? JSON.parse(String(args.params)) : {} } catch { return 'Error: params must be valid JSON' }

      const validTypes = ['fps_profiler', 'memory_tracker', 'input_recorder', 'screenshot_test', 'performance_budget']
      if (!validTypes.includes(testType)) {
        return `Error: Unknown test type "${testType}". Valid: ${validTypes.join(', ')}`
      }

      let code = ''

      if (testType === 'fps_profiler') {
        const sampleWindow = params.sampleWindow || 120
        const spikeThreshold = params.spikeThreshold || 33.33
        const reportInterval = params.reportInterval || 5000

        if (engine === 'godot') {
          code = `# FPS Profiler — Godot 4.x
# Tracks frame times, calculates percentiles, detects spikes.
# Add to autoload or attach to a CanvasLayer.

extends Node
class_name FPSProfiler

@export var sample_window: int = ${sampleWindow}
@export var spike_threshold_ms: float = ${spikeThreshold}
@export var report_interval_ms: float = ${reportInterval}
@export var show_overlay: bool = true
@export var csv_output_path: String = "user://fps_report.csv"

var _frame_times: PackedFloat64Array = []
var _spike_count: int = 0
var _total_frames: int = 0
var _session_start: float = 0
var _last_report: float = 0
var _csv_lines: PackedStringArray = ["timestamp_ms,frame_time_ms,fps,spike"]
var _label: Label

func _ready() -> void:
\t_session_start = Time.get_ticks_msec()
\t_last_report = _session_start
\tif show_overlay:
\t\t_label = Label.new()
\t\t_label.position = Vector2(10, 10)
\t\t_label.add_theme_font_size_override("font_size", 14)
\t\t_label.add_theme_color_override("font_color", Color.GREEN)
\t\tadd_child(_label)

func _process(delta: float) -> void:
\tvar frame_ms := delta * 1000.0
\t_frame_times.append(frame_ms)
\t_total_frames += 1
\tvar is_spike := frame_ms > spike_threshold_ms
\tif is_spike:
\t\t_spike_count += 1

\t# CSV logging
\tvar now := Time.get_ticks_msec()
\t_csv_lines.append("%d,%.2f,%.1f,%d" % [now - _session_start, frame_ms, 1000.0 / frame_ms, 1 if is_spike else 0])

\t# Keep rolling window
\tif _frame_times.size() > sample_window:
\t\t_frame_times = _frame_times.slice(_frame_times.size() - sample_window)

\t# Overlay
\tif show_overlay and _label:
\t\tvar stats := _compute_stats()
\t\t_label.text = "FPS: %.0f (P50: %.1fms  P95: %.1fms  P99: %.1fms)\\nSpikes: %d" % [
\t\t\t1000.0 / stats.avg, stats.p50, stats.p95, stats.p99, _spike_count
\t\t]
\t\t_label.add_theme_color_override("font_color", Color.GREEN if stats.avg < 16.67 else Color.YELLOW if stats.avg < 33.33 else Color.RED)

\t# Periodic report
\tif now - _last_report >= report_interval_ms:
\t\t_last_report = now
\t\t_print_report()

func _compute_stats() -> Dictionary:
\tvar sorted := _frame_times.duplicate()
\tsorted.sort()
\tvar n := sorted.size()
\tif n == 0:
\t\treturn {"avg": 0.0, "min": 0.0, "max": 0.0, "p50": 0.0, "p95": 0.0, "p99": 0.0}
\tvar total := 0.0
\tfor t in sorted:
\t\ttotal += t
\treturn {
\t\t"avg": total / n,
\t\t"min": sorted[0],
\t\t"max": sorted[n - 1],
\t\t"p50": sorted[int(n * 0.50)],
\t\t"p95": sorted[int(n * 0.95)],
\t\t"p99": sorted[min(int(n * 0.99), n - 1)],
\t}

func _print_report() -> void:
\tvar stats := _compute_stats()
\tprint("[FPSProfiler] Avg: %.2fms (%.0f FPS) | P50: %.2f | P95: %.2f | P99: %.2f | Spikes: %d/%d" % [
\t\tstats.avg, 1000.0 / stats.avg, stats.p50, stats.p95, stats.p99, _spike_count, _total_frames
\t])

func save_csv() -> void:
\tvar file := FileAccess.open(csv_output_path, FileAccess.WRITE)
\tif file:
\t\tfor line in _csv_lines:
\t\t\tfile.store_line(line)
\t\tprint("[FPSProfiler] CSV saved to %s (%d frames)" % [csv_output_path, _total_frames])

func get_report() -> Dictionary:
\tvar stats := _compute_stats()
\tstats["total_frames"] = _total_frames
\tstats["spike_count"] = _spike_count
\tstats["spike_pct"] = float(_spike_count) / max(_total_frames, 1) * 100.0
\tstats["duration_sec"] = (Time.get_ticks_msec() - _session_start) / 1000.0
\treturn stats

func _notification(what: int) -> void:
\tif what == NOTIFICATION_WM_CLOSE_REQUEST:
\t\tsave_csv()
`
        } else {
          code = `// FPS Profiler — Web / TypeScript
// Tracks frame times, percentiles, spike detection, CSV export.
//
// Usage:
//   const profiler = new FPSProfiler();
//   function gameLoop() {
//     profiler.begin();
//     // ... your game logic ...
//     profiler.end();
//     requestAnimationFrame(gameLoop);
//   }
//   requestAnimationFrame(gameLoop);

export interface FPSStats {
  fps: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p50: number;
  p95: number;
  p99: number;
  spikeCount: number;
  spikePct: number;
  totalFrames: number;
  durationSec: number;
}

export class FPSProfiler {
  private frameTimes: number[] = [];
  private sampleWindow: number;
  private spikeThresholdMs: number;
  private reportIntervalMs: number;
  private spikeCount = 0;
  private totalFrames = 0;
  private sessionStart: number;
  private lastReport: number;
  private frameStart = 0;
  private csvRows: string[] = ['timestamp_ms,frame_time_ms,fps,spike'];
  private overlay: HTMLElement | null = null;
  private onReport: ((stats: FPSStats) => void) | null = null;

  constructor(options: {
    sampleWindow?: number;
    spikeThresholdMs?: number;
    reportIntervalMs?: number;
    showOverlay?: boolean;
    onReport?: (stats: FPSStats) => void;
  } = {}) {
    this.sampleWindow = options.sampleWindow ?? ${sampleWindow};
    this.spikeThresholdMs = options.spikeThresholdMs ?? ${spikeThreshold};
    this.reportIntervalMs = options.reportIntervalMs ?? ${reportInterval};
    this.onReport = options.onReport ?? null;
    this.sessionStart = performance.now();
    this.lastReport = this.sessionStart;

    if (options.showOverlay !== false) {
      this.createOverlay();
    }
  }

  /** Call at the start of each frame */
  begin(): void {
    this.frameStart = performance.now();
  }

  /** Call at the end of each frame */
  end(): void {
    const now = performance.now();
    const frameMs = now - this.frameStart;
    this.totalFrames++;

    this.frameTimes.push(frameMs);
    if (this.frameTimes.length > this.sampleWindow) {
      this.frameTimes.shift();
    }

    const isSpike = frameMs > this.spikeThresholdMs;
    if (isSpike) this.spikeCount++;

    // CSV
    this.csvRows.push(\`\${(now - this.sessionStart).toFixed(0)},\${frameMs.toFixed(2)},\${(1000 / frameMs).toFixed(1)},\${isSpike ? 1 : 0}\`);

    // Update overlay
    if (this.overlay && this.totalFrames % 10 === 0) {
      const stats = this.getStats();
      this.overlay.textContent = \`FPS: \${stats.fps.toFixed(0)} (P50: \${stats.p50.toFixed(1)}ms  P95: \${stats.p95.toFixed(1)}ms  P99: \${stats.p99.toFixed(1)}ms) Spikes: \${stats.spikeCount}\`;
      this.overlay.style.color = stats.avgMs < 16.67 ? '#0f0' : stats.avgMs < 33.33 ? '#ff0' : '#f00';
    }

    // Periodic report
    if (now - this.lastReport >= this.reportIntervalMs) {
      this.lastReport = now;
      const stats = this.getStats();
      console.log(\`[FPSProfiler] Avg: \${stats.avgMs.toFixed(2)}ms (\${stats.fps.toFixed(0)} FPS) | P50: \${stats.p50.toFixed(2)} | P95: \${stats.p95.toFixed(2)} | P99: \${stats.p99.toFixed(2)} | Spikes: \${stats.spikeCount}/\${stats.totalFrames}\`);
      this.onReport?.(stats);
    }
  }

  /** Compute current statistics from the rolling window */
  getStats(): FPSStats {
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const n = sorted.length;
    if (n === 0) return { fps: 0, avgMs: 0, minMs: 0, maxMs: 0, p50: 0, p95: 0, p99: 0, spikeCount: 0, spikePct: 0, totalFrames: 0, durationSec: 0 };

    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = sum / n;

    return {
      fps: 1000 / avg,
      avgMs: avg,
      minMs: sorted[0],
      maxMs: sorted[n - 1],
      p50: sorted[Math.floor(n * 0.5)],
      p95: sorted[Math.floor(n * 0.95)],
      p99: sorted[Math.min(Math.floor(n * 0.99), n - 1)],
      spikeCount: this.spikeCount,
      spikePct: (this.spikeCount / Math.max(this.totalFrames, 1)) * 100,
      totalFrames: this.totalFrames,
      durationSec: (performance.now() - this.sessionStart) / 1000,
    };
  }

  /** Export frame data as CSV string */
  exportCSV(): string {
    return this.csvRows.join('\\n');
  }

  /** Download CSV file in browser */
  downloadCSV(filename = 'fps_report.csv'): void {
    const blob = new Blob([this.exportCSV()], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Reset all counters */
  reset(): void {
    this.frameTimes = [];
    this.spikeCount = 0;
    this.totalFrames = 0;
    this.sessionStart = performance.now();
    this.lastReport = this.sessionStart;
    this.csvRows = ['timestamp_ms,frame_time_ms,fps,spike'];
  }

  private createOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = 'position:fixed;top:8px;left:8px;font:12px monospace;color:#0f0;background:rgba(0,0,0,0.7);padding:4px 8px;border-radius:4px;z-index:99999;pointer-events:none;';
    this.overlay.textContent = 'FPS: --';
    document.body.appendChild(this.overlay);
  }

  /** Remove overlay and clean up */
  destroy(): void {
    this.overlay?.remove();
    this.overlay = null;
  }
}
`
        }
      } else if (testType === 'memory_tracker') {
        const budgetMB = params.budgetMB || 256
        const sampleIntervalMs = params.sampleIntervalMs || 1000
        const alertThreshold = params.alertThreshold || 0.8

        code = `// Memory Tracker — Web / TypeScript
// Monitors heap usage, tracks allocations, enforces budgets.
//
// Usage:
//   const tracker = new MemoryTracker({ budgetMB: ${budgetMB} });
//   tracker.start();
//   // ... later ...
//   tracker.snapshot('after level load');
//   console.log(tracker.getReport());

export interface MemorySnapshot {
  label: string;
  timestamp: number;
  usedHeapMB: number;
  totalHeapMB: number;
  heapLimitMB: number;
  usedPct: number;
  budgetPct: number;
}

export interface MemoryReport {
  snapshots: MemorySnapshot[];
  peakUsedMB: number;
  avgUsedMB: number;
  budgetMB: number;
  budgetExceeded: boolean;
  leakSuspected: boolean;
  leakRateMBPerMin: number;
  durationSec: number;
}

export class MemoryTracker {
  private budgetMB: number;
  private sampleIntervalMs: number;
  private alertThreshold: number;
  private snapshots: MemorySnapshot[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private startTime: number;
  private peakUsedMB = 0;
  private onAlert: ((snapshot: MemorySnapshot, reason: string) => void) | null = null;
  private overlay: HTMLElement | null = null;

  constructor(options: {
    budgetMB?: number;
    sampleIntervalMs?: number;
    alertThreshold?: number;
    onAlert?: (snapshot: MemorySnapshot, reason: string) => void;
    showOverlay?: boolean;
  } = {}) {
    this.budgetMB = options.budgetMB ?? ${budgetMB};
    this.sampleIntervalMs = options.sampleIntervalMs ?? ${sampleIntervalMs};
    this.alertThreshold = options.alertThreshold ?? ${alertThreshold};
    this.onAlert = options.onAlert ?? null;
    this.startTime = performance.now();

    if (options.showOverlay) {
      this.createOverlay();
    }
  }

  /** Start automatic periodic sampling */
  start(): void {
    if (this.intervalId) return;
    this.startTime = performance.now();
    this.intervalId = setInterval(() => this.sample(), this.sampleIntervalMs);
    this.sample(); // Immediate first sample
  }

  /** Stop automatic sampling */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Take a manual snapshot with a label */
  snapshot(label: string): MemorySnapshot {
    return this.sample(label);
  }

  /** Take a memory sample */
  private sample(label = 'auto'): MemorySnapshot {
    const mem = (performance as any).memory;
    const snap: MemorySnapshot = {
      label,
      timestamp: performance.now() - this.startTime,
      usedHeapMB: mem ? mem.usedJSHeapSize / (1024 * 1024) : 0,
      totalHeapMB: mem ? mem.totalJSHeapSize / (1024 * 1024) : 0,
      heapLimitMB: mem ? mem.jsHeapSizeLimit / (1024 * 1024) : 0,
      usedPct: 0,
      budgetPct: 0,
    };

    snap.usedPct = snap.heapLimitMB > 0 ? (snap.usedHeapMB / snap.heapLimitMB) * 100 : 0;
    snap.budgetPct = (snap.usedHeapMB / this.budgetMB) * 100;

    if (snap.usedHeapMB > this.peakUsedMB) {
      this.peakUsedMB = snap.usedHeapMB;
    }

    this.snapshots.push(snap);

    // Budget alerts
    if (snap.budgetPct >= 100) {
      this.alert(snap, \`BUDGET EXCEEDED: \${snap.usedHeapMB.toFixed(1)}MB / \${this.budgetMB}MB (\${snap.budgetPct.toFixed(0)}%)\`);
    } else if (snap.budgetPct >= this.alertThreshold * 100) {
      this.alert(snap, \`Budget warning: \${snap.usedHeapMB.toFixed(1)}MB / \${this.budgetMB}MB (\${snap.budgetPct.toFixed(0)}%)\`);
    }

    // Leak detection: check if memory is monotonically increasing over last 30 samples
    if (this.snapshots.length >= 30) {
      const recent = this.snapshots.slice(-30);
      let increasing = 0;
      for (let i = 1; i < recent.length; i++) {
        if (recent[i].usedHeapMB > recent[i - 1].usedHeapMB) increasing++;
      }
      if (increasing >= 25) { // 83%+ of samples increasing
        const rate = (recent[recent.length - 1].usedHeapMB - recent[0].usedHeapMB) /
          ((recent[recent.length - 1].timestamp - recent[0].timestamp) / 60000);
        this.alert(snap, \`Possible memory leak: +\${rate.toFixed(2)}MB/min over last 30 samples\`);
      }
    }

    // Update overlay
    if (this.overlay) {
      this.overlay.textContent = \`MEM: \${snap.usedHeapMB.toFixed(1)}MB / \${this.budgetMB}MB (\${snap.budgetPct.toFixed(0)}%) Peak: \${this.peakUsedMB.toFixed(1)}MB\`;
      this.overlay.style.color = snap.budgetPct < 70 ? '#0f0' : snap.budgetPct < 90 ? '#ff0' : '#f00';
    }

    return snap;
  }

  private alert(snap: MemorySnapshot, reason: string): void {
    console.warn(\`[MemoryTracker] \${reason}\`);
    this.onAlert?.(snap, reason);
  }

  /** Generate a full memory report */
  getReport(): MemoryReport {
    const n = this.snapshots.length;
    const avgUsedMB = n > 0 ? this.snapshots.reduce((s, snap) => s + snap.usedHeapMB, 0) / n : 0;
    const durationSec = n > 0 ? this.snapshots[n - 1].timestamp / 1000 : 0;

    let leakRateMBPerMin = 0;
    let leakSuspected = false;
    if (n >= 10) {
      const first10avg = this.snapshots.slice(0, 10).reduce((s, snap) => s + snap.usedHeapMB, 0) / 10;
      const last10avg = this.snapshots.slice(-10).reduce((s, snap) => s + snap.usedHeapMB, 0) / 10;
      const timeDiffMin = (this.snapshots[n - 1].timestamp - this.snapshots[0].timestamp) / 60000;
      if (timeDiffMin > 0) {
        leakRateMBPerMin = (last10avg - first10avg) / timeDiffMin;
        leakSuspected = leakRateMBPerMin > 0.5; // >0.5MB/min growth
      }
    }

    return {
      snapshots: this.snapshots,
      peakUsedMB: this.peakUsedMB,
      avgUsedMB,
      budgetMB: this.budgetMB,
      budgetExceeded: this.peakUsedMB > this.budgetMB,
      leakSuspected,
      leakRateMBPerMin,
      durationSec,
    };
  }

  /** Export snapshots as CSV */
  exportCSV(): string {
    const header = 'timestamp_ms,label,used_heap_mb,total_heap_mb,heap_limit_mb,budget_pct';
    const rows = this.snapshots.map(s =>
      \`\${s.timestamp.toFixed(0)},\${s.label},\${s.usedHeapMB.toFixed(2)},\${s.totalHeapMB.toFixed(2)},\${s.heapLimitMB.toFixed(2)},\${s.budgetPct.toFixed(1)}\`
    );
    return [header, ...rows].join('\\n');
  }

  /** Download CSV */
  downloadCSV(filename = 'memory_report.csv'): void {
    const blob = new Blob([this.exportCSV()], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Force garbage collection (if available via --expose-gc flag) */
  forceGC(): void {
    if (typeof globalThis.gc === 'function') {
      globalThis.gc();
    } else {
      console.warn('[MemoryTracker] GC not available. Run Node with --expose-gc or Chrome with --js-flags="--expose-gc"');
    }
  }

  /** Reset tracker */
  reset(): void {
    this.snapshots = [];
    this.peakUsedMB = 0;
    this.startTime = performance.now();
  }

  private createOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = 'position:fixed;top:28px;left:8px;font:12px monospace;color:#0f0;background:rgba(0,0,0,0.7);padding:4px 8px;border-radius:4px;z-index:99999;pointer-events:none;';
    document.body.appendChild(this.overlay);
  }

  /** Clean up */
  destroy(): void {
    this.stop();
    this.overlay?.remove();
    this.overlay = null;
  }
}
`
      } else if (testType === 'input_recorder') {
        code = `// Input Recorder & Replayer — Web / TypeScript
// Records all user inputs with timestamps for replay and regression testing.
//
// Usage:
//   const recorder = new InputRecorder();
//   recorder.startRecording();
//   // ... player plays ...
//   recorder.stopRecording();
//   const data = recorder.exportJSON();
//
//   // Later: replay
//   const replayer = new InputReplayer(data);
//   replayer.play();

export interface InputEvent {
  time: number;        // ms since recording start
  type: 'keydown' | 'keyup' | 'mousedown' | 'mouseup' | 'mousemove' | 'wheel' | 'touchstart' | 'touchmove' | 'touchend' | 'gamepad';
  data: Record<string, unknown>;
}

export interface InputRecording {
  version: 1;
  startedAt: string;   // ISO timestamp
  duration: number;     // total ms
  fps: number;          // average FPS during recording
  events: InputEvent[];
  metadata: Record<string, unknown>;
}

// ── Recorder ─────────────────────────────────────────────────────────

export class InputRecorder {
  private events: InputEvent[] = [];
  private recording = false;
  private startTime = 0;
  private frameCount = 0;
  private listeners: Array<{ target: EventTarget; type: string; handler: EventListener }> = [];
  private gamepadPollId: ReturnType<typeof setInterval> | null = null;

  /** Start recording inputs */
  startRecording(metadata: Record<string, unknown> = {}): void {
    if (this.recording) return;
    this.events = [];
    this.recording = true;
    this.startTime = performance.now();
    this.frameCount = 0;

    // Keyboard
    this.listen(window, 'keydown', (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.repeat) return; // Skip auto-repeat
      this.record('keydown', { key: ke.key, code: ke.code, shift: ke.shiftKey, ctrl: ke.ctrlKey, alt: ke.altKey });
    });
    this.listen(window, 'keyup', (e: Event) => {
      const ke = e as KeyboardEvent;
      this.record('keyup', { key: ke.key, code: ke.code });
    });

    // Mouse
    this.listen(window, 'mousedown', (e: Event) => {
      const me = e as MouseEvent;
      this.record('mousedown', { button: me.button, x: me.clientX, y: me.clientY });
    });
    this.listen(window, 'mouseup', (e: Event) => {
      const me = e as MouseEvent;
      this.record('mouseup', { button: me.button, x: me.clientX, y: me.clientY });
    });
    this.listen(window, 'mousemove', (e: Event) => {
      const me = e as MouseEvent;
      // Throttle: only record every 16ms (~60fps)
      const last = this.events[this.events.length - 1];
      const now = performance.now() - this.startTime;
      if (last?.type === 'mousemove' && now - last.time < 16) return;
      this.record('mousemove', { x: me.clientX, y: me.clientY, movementX: me.movementX, movementY: me.movementY });
    });
    this.listen(window, 'wheel', (e: Event) => {
      const we = e as WheelEvent;
      this.record('wheel', { deltaX: we.deltaX, deltaY: we.deltaY, deltaZ: we.deltaZ });
    });

    // Touch
    this.listen(window, 'touchstart', (e: Event) => {
      const te = e as TouchEvent;
      this.record('touchstart', { touches: this.serializeTouches(te.touches) });
    });
    this.listen(window, 'touchmove', (e: Event) => {
      const te = e as TouchEvent;
      this.record('touchmove', { touches: this.serializeTouches(te.touches) });
    });
    this.listen(window, 'touchend', (e: Event) => {
      const te = e as TouchEvent;
      this.record('touchend', { touches: this.serializeTouches(te.changedTouches) });
    });

    // Gamepad polling (no events for gamepads)
    this.gamepadPollId = setInterval(() => this.pollGamepads(), 16);

    // Frame counter
    const countFrames = () => {
      if (!this.recording) return;
      this.frameCount++;
      requestAnimationFrame(countFrames);
    };
    requestAnimationFrame(countFrames);
  }

  /** Stop recording and return the recording data */
  stopRecording(): InputRecording {
    this.recording = false;
    const duration = performance.now() - this.startTime;

    // Clean up listeners
    for (const { target, type, handler } of this.listeners) {
      target.removeEventListener(type, handler);
    }
    this.listeners = [];
    if (this.gamepadPollId) {
      clearInterval(this.gamepadPollId);
      this.gamepadPollId = null;
    }

    return {
      version: 1,
      startedAt: new Date(Date.now() - duration).toISOString(),
      duration,
      fps: this.frameCount / (duration / 1000),
      events: this.events,
      metadata: {},
    };
  }

  private record(type: InputEvent['type'], data: Record<string, unknown>): void {
    if (!this.recording) return;
    this.events.push({ time: performance.now() - this.startTime, type, data });
  }

  private listen(target: EventTarget, type: string, handler: EventListener): void {
    target.addEventListener(type, handler);
    this.listeners.push({ target, type, handler });
  }

  private serializeTouches(touches: TouchList): Array<{ id: number; x: number; y: number }> {
    const result = [];
    for (let i = 0; i < touches.length; i++) {
      result.push({ id: touches[i].identifier, x: touches[i].clientX, y: touches[i].clientY });
    }
    return result;
  }

  private lastGamepadState: string = '';
  private pollGamepads(): void {
    const gamepads = navigator.getGamepads();
    for (const gp of gamepads) {
      if (!gp) continue;
      const state = JSON.stringify({ buttons: gp.buttons.map(b => b.pressed), axes: gp.axes.map(a => Math.round(a * 100) / 100) });
      if (state !== this.lastGamepadState) {
        this.lastGamepadState = state;
        this.record('gamepad', { index: gp.index, buttons: gp.buttons.map(b => b.pressed), axes: Array.from(gp.axes) });
      }
    }
  }

  /** Export as JSON string */
  exportJSON(): string {
    return JSON.stringify(this.stopRecording(), null, 2);
  }

  /** Download recording as JSON file */
  downloadJSON(filename = 'input_recording.json'): void {
    const blob = new Blob([this.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// ── Replayer ─────────────────────────────────────────────────────────

export class InputReplayer {
  private recording: InputRecording;
  private eventIndex = 0;
  private startTime = 0;
  private playing = false;
  private onEvent: ((event: InputEvent) => void) | null = null;
  private onComplete: (() => void) | null = null;
  private speed = 1;

  constructor(recording: InputRecording | string) {
    this.recording = typeof recording === 'string' ? JSON.parse(recording) : recording;
  }

  /** Start replaying inputs */
  play(options: { speed?: number; onEvent?: (event: InputEvent) => void; onComplete?: () => void } = {}): void {
    this.speed = options.speed ?? 1;
    this.onEvent = options.onEvent ?? null;
    this.onComplete = options.onComplete ?? null;
    this.eventIndex = 0;
    this.playing = true;
    this.startTime = performance.now();
    this.tick();
  }

  /** Stop replay */
  stop(): void {
    this.playing = false;
  }

  /** Pause/resume */
  get isPaused(): boolean { return !this.playing; }
  pause(): void { this.playing = false; }
  resume(): void {
    if (!this.playing) {
      this.playing = true;
      this.tick();
    }
  }

  /** Get replay progress (0 to 1) */
  get progress(): number {
    if (this.recording.events.length === 0) return 1;
    return this.eventIndex / this.recording.events.length;
  }

  private tick(): void {
    if (!this.playing) return;

    const elapsed = (performance.now() - this.startTime) * this.speed;

    // Dispatch all events up to current time
    while (this.eventIndex < this.recording.events.length) {
      const event = this.recording.events[this.eventIndex];
      if (event.time > elapsed) break;

      this.dispatchEvent(event);
      this.onEvent?.(event);
      this.eventIndex++;
    }

    if (this.eventIndex >= this.recording.events.length) {
      this.playing = false;
      this.onComplete?.();
      return;
    }

    requestAnimationFrame(() => this.tick());
  }

  /** Dispatch a synthetic DOM event matching the recorded input */
  private dispatchEvent(event: InputEvent): void {
    const data = event.data;
    switch (event.type) {
      case 'keydown':
      case 'keyup':
        window.dispatchEvent(new KeyboardEvent(event.type, {
          key: data.key as string,
          code: data.code as string,
          shiftKey: data.shift as boolean,
          ctrlKey: data.ctrl as boolean,
          altKey: data.alt as boolean,
          bubbles: true,
        }));
        break;
      case 'mousedown':
      case 'mouseup':
        window.dispatchEvent(new MouseEvent(event.type, {
          button: data.button as number,
          clientX: data.x as number,
          clientY: data.y as number,
          bubbles: true,
        }));
        break;
      case 'mousemove':
        window.dispatchEvent(new MouseEvent('mousemove', {
          clientX: data.x as number,
          clientY: data.y as number,
          movementX: data.movementX as number,
          movementY: data.movementY as number,
          bubbles: true,
        }));
        break;
      case 'wheel':
        window.dispatchEvent(new WheelEvent('wheel', {
          deltaX: data.deltaX as number,
          deltaY: data.deltaY as number,
          deltaZ: data.deltaZ as number,
          bubbles: true,
        }));
        break;
      // Touch and gamepad events are dispatched via onEvent callback
    }
  }
}
`
      } else if (testType === 'screenshot_test') {
        code = `// Screenshot Regression Testing — Web / TypeScript + Node.js
// Captures canvas screenshots and compares against baselines using pixel diff.
//
// Usage (capture baseline):
//   const tester = new ScreenshotTester({ baselineDir: './test/baselines' });
//   await tester.capture('main-menu', canvas);
//   await tester.saveBaseline('main-menu');
//
// Usage (compare):
//   const result = await tester.compare('main-menu', canvas);
//   if (!result.passed) console.error(\`Diff: \${result.diffPercent}%\`);

export interface CompareResult {
  passed: boolean;
  diffPercent: number;
  diffPixels: number;
  totalPixels: number;
  threshold: number;
  diffImageDataURL?: string;
}

export class ScreenshotTester {
  private threshold: number;
  private baselines: Map<string, ImageData> = new Map();
  private captures: Map<string, ImageData> = new Map();

  constructor(options: {
    threshold?: number;  // Max acceptable diff percentage (default: 0.1%)
  } = {}) {
    this.threshold = options.threshold ?? 0.1;
  }

  /** Capture a screenshot from a canvas */
  capture(name: string, canvas: HTMLCanvasElement): ImageData {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2D context from canvas');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    this.captures.set(name, imageData);
    return imageData;
  }

  /** Capture from a WebGL canvas (reads pixels) */
  captureWebGL(name: string, canvas: HTMLCanvasElement): ImageData {
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) throw new Error('Cannot get WebGL context');
    const w = canvas.width;
    const h = canvas.height;
    const pixels = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    // WebGL reads bottom-to-top, flip vertically
    const flipped = new Uint8ClampedArray(w * h * 4);
    for (let row = 0; row < h; row++) {
      const srcOffset = row * w * 4;
      const dstOffset = (h - row - 1) * w * 4;
      flipped.set(pixels.subarray(srcOffset, srcOffset + w * 4), dstOffset);
    }
    const imageData = new ImageData(flipped, w, h);
    this.captures.set(name, imageData);
    return imageData;
  }

  /** Set a baseline from a captured image */
  setBaseline(name: string, imageData?: ImageData): void {
    const data = imageData || this.captures.get(name);
    if (!data) throw new Error(\`No capture found for "\${name}"\`);
    this.baselines.set(name, data);
  }

  /** Load a baseline from a data URL */
  async loadBaseline(name: string, dataURL: string): Promise<void> {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = dataURL;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    this.baselines.set(name, ctx.getImageData(0, 0, img.width, img.height));
  }

  /** Compare a capture against its baseline */
  compare(name: string, canvas?: HTMLCanvasElement): CompareResult {
    if (canvas) this.capture(name, canvas);

    const baseline = this.baselines.get(name);
    const current = this.captures.get(name);
    if (!baseline) throw new Error(\`No baseline for "\${name}". Call setBaseline() first.\`);
    if (!current) throw new Error(\`No capture for "\${name}". Call capture() first.\`);

    if (baseline.width !== current.width || baseline.height !== current.height) {
      return {
        passed: false,
        diffPercent: 100,
        diffPixels: baseline.width * baseline.height,
        totalPixels: baseline.width * baseline.height,
        threshold: this.threshold,
      };
    }

    const w = baseline.width;
    const h = baseline.height;
    const totalPixels = w * h;
    let diffPixels = 0;

    // Create diff image
    const diffData = new Uint8ClampedArray(w * h * 4);

    for (let i = 0; i < baseline.data.length; i += 4) {
      const dr = Math.abs(baseline.data[i] - current.data[i]);
      const dg = Math.abs(baseline.data[i + 1] - current.data[i + 1]);
      const db = Math.abs(baseline.data[i + 2] - current.data[i + 2]);
      const da = Math.abs(baseline.data[i + 3] - current.data[i + 3]);

      const diff = (dr + dg + db + da) / 4;

      if (diff > 2) { // tolerance for compression artifacts
        diffPixels++;
        diffData[i] = 255;     // Red for diff
        diffData[i + 1] = 0;
        diffData[i + 2] = 0;
        diffData[i + 3] = 255;
      } else {
        // Dim original pixel
        diffData[i] = current.data[i] * 0.3;
        diffData[i + 1] = current.data[i + 1] * 0.3;
        diffData[i + 2] = current.data[i + 2] * 0.3;
        diffData[i + 3] = 255;
      }
    }

    const diffPercent = (diffPixels / totalPixels) * 100;

    // Generate diff image data URL
    let diffImageDataURL: string | undefined;
    try {
      const diffCanvas = document.createElement('canvas');
      diffCanvas.width = w;
      diffCanvas.height = h;
      const diffCtx = diffCanvas.getContext('2d')!;
      diffCtx.putImageData(new ImageData(diffData, w, h), 0, 0);
      diffImageDataURL = diffCanvas.toDataURL('image/png');
    } catch { /* ok if no DOM */ }

    return {
      passed: diffPercent <= this.threshold,
      diffPercent,
      diffPixels,
      totalPixels,
      threshold: this.threshold,
      diffImageDataURL,
    };
  }

  /** Export a capture as data URL */
  exportCapture(name: string): string {
    const data = this.captures.get(name);
    if (!data) throw new Error(\`No capture "\${name}"\`);
    const canvas = document.createElement('canvas');
    canvas.width = data.width;
    canvas.height = data.height;
    canvas.getContext('2d')!.putImageData(data, 0, 0);
    return canvas.toDataURL('image/png');
  }

  /** Run all comparisons and return a summary */
  runAll(): { passed: number; failed: number; results: Record<string, CompareResult> } {
    const results: Record<string, CompareResult> = {};
    let passed = 0;
    let failed = 0;

    for (const name of this.baselines.keys()) {
      if (this.captures.has(name)) {
        const result = this.compare(name);
        results[name] = result;
        if (result.passed) passed++;
        else failed++;
      }
    }

    return { passed, failed, results };
  }
}
`
      } else if (testType === 'performance_budget') {
        const maxDrawCalls = params.maxDrawCalls || 200
        const maxTriangles = params.maxTriangles || 100000
        const maxTextureMB = params.maxTextureMB || 128
        const targetFPS = params.targetFPS || 60
        const maxLoadTimeSec = params.maxLoadTimeSec || 3

        code = `// Performance Budget Validator — Web / TypeScript
// Runtime validation of draw calls, triangles, texture memory, and frame budget.
//
// Usage:
//   const budget = new PerformanceBudget({
//     maxDrawCalls: ${maxDrawCalls},
//     maxTriangles: ${maxTriangles},
//     maxTextureMB: ${maxTextureMB},
//   });
//   // In render loop:
//   budget.beginFrame();
//   budget.recordDrawCall(triangleCount);
//   budget.endFrame();
//   // Check:
//   const report = budget.validate();

export interface BudgetLimits {
  maxDrawCalls: number;
  maxTriangles: number;
  maxTextureMB: number;
  targetFPS: number;
  maxFrameMs: number;
  maxLoadTimeSec: number;
}

export interface BudgetMetrics {
  drawCalls: number;
  triangles: number;
  textureMB: number;
  frameMs: number;
  fps: number;
  loadTimeSec: number;
}

export interface BudgetViolation {
  metric: string;
  value: number;
  limit: number;
  severity: 'warning' | 'error';
  message: string;
}

export interface BudgetReport {
  passed: boolean;
  metrics: BudgetMetrics;
  limits: BudgetLimits;
  violations: BudgetViolation[];
  score: number; // 0-100
  timestamp: number;
}

export class PerformanceBudget {
  private limits: BudgetLimits;
  private frameDrawCalls = 0;
  private frameTriangles = 0;
  private frameStart = 0;
  private frameTimes: number[] = [];
  private textureBytes = 0;
  private loadStart = 0;
  private loadEnd = 0;
  private violations: BudgetViolation[] = [];
  private overlay: HTMLElement | null = null;
  private onViolation: ((v: BudgetViolation) => void) | null = null;

  // Rolling averages
  private avgDrawCalls = 0;
  private avgTriangles = 0;
  private frameCount = 0;
  private sampleWindow = 60;

  constructor(options: {
    maxDrawCalls?: number;
    maxTriangles?: number;
    maxTextureMB?: number;
    targetFPS?: number;
    maxLoadTimeSec?: number;
    showOverlay?: boolean;
    onViolation?: (v: BudgetViolation) => void;
  } = {}) {
    this.limits = {
      maxDrawCalls: options.maxDrawCalls ?? ${maxDrawCalls},
      maxTriangles: options.maxTriangles ?? ${maxTriangles},
      maxTextureMB: options.maxTextureMB ?? ${maxTextureMB},
      targetFPS: options.targetFPS ?? ${targetFPS},
      maxFrameMs: 1000 / (options.targetFPS ?? ${targetFPS}),
      maxLoadTimeSec: options.maxLoadTimeSec ?? ${maxLoadTimeSec},
    };
    this.onViolation = options.onViolation ?? null;

    if (options.showOverlay) this.createOverlay();
  }

  /** Mark the beginning of level/scene load */
  beginLoad(): void {
    this.loadStart = performance.now();
  }

  /** Mark the end of level/scene load */
  endLoad(): void {
    this.loadEnd = performance.now();
  }

  /** Call at the start of each render frame */
  beginFrame(): void {
    this.frameStart = performance.now();
    this.frameDrawCalls = 0;
    this.frameTriangles = 0;
  }

  /** Record a draw call with its triangle count */
  recordDrawCall(triangles: number): void {
    this.frameDrawCalls++;
    this.frameTriangles += triangles;
  }

  /** Record texture allocation */
  recordTexture(widthPx: number, heightPx: number, bytesPerPixel = 4, mipmaps = true): void {
    let bytes = widthPx * heightPx * bytesPerPixel;
    if (mipmaps) bytes *= 1.33; // Mipmap chain adds ~33%
    this.textureBytes += bytes;
  }

  /** Record texture deallocation */
  releaseTexture(widthPx: number, heightPx: number, bytesPerPixel = 4, mipmaps = true): void {
    let bytes = widthPx * heightPx * bytesPerPixel;
    if (mipmaps) bytes *= 1.33;
    this.textureBytes = Math.max(0, this.textureBytes - bytes);
  }

  /** Set texture memory directly (e.g. from WebGL extension) */
  setTextureMemoryBytes(bytes: number): void {
    this.textureBytes = bytes;
  }

  /** Call at the end of each render frame */
  endFrame(): void {
    const frameMs = performance.now() - this.frameStart;
    this.frameTimes.push(frameMs);
    if (this.frameTimes.length > this.sampleWindow) this.frameTimes.shift();

    // Rolling averages
    this.frameCount++;
    this.avgDrawCalls = this.avgDrawCalls * 0.95 + this.frameDrawCalls * 0.05;
    this.avgTriangles = this.avgTriangles * 0.95 + this.frameTriangles * 0.05;

    // Check violations every 60 frames
    if (this.frameCount % 60 === 0) {
      this.checkViolations();
    }

    // Update overlay
    if (this.overlay && this.frameCount % 30 === 0) {
      const fps = this.frameTimes.length > 0 ? 1000 / (this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length) : 0;
      const texMB = this.textureBytes / (1024 * 1024);
      this.overlay.innerHTML = [
        \`DC: \${Math.round(this.avgDrawCalls)}/\${this.limits.maxDrawCalls}\`,
        \`Tri: \${this.formatNumber(Math.round(this.avgTriangles))}/\${this.formatNumber(this.limits.maxTriangles)}\`,
        \`Tex: \${texMB.toFixed(0)}MB/\${this.limits.maxTextureMB}MB\`,
        \`FPS: \${fps.toFixed(0)}/\${this.limits.targetFPS}\`,
      ].join(' | ');

      const hasViolation = this.avgDrawCalls > this.limits.maxDrawCalls ||
        this.avgTriangles > this.limits.maxTriangles ||
        texMB > this.limits.maxTextureMB ||
        fps < this.limits.targetFPS * 0.9;
      this.overlay.style.color = hasViolation ? '#f44' : '#4f4';
    }
  }

  private checkViolations(): void {
    const metrics = this.getCurrentMetrics();

    const checks: Array<{ metric: string; value: number; limit: number; warn: number }> = [
      { metric: 'drawCalls', value: metrics.drawCalls, limit: this.limits.maxDrawCalls, warn: this.limits.maxDrawCalls * 0.8 },
      { metric: 'triangles', value: metrics.triangles, limit: this.limits.maxTriangles, warn: this.limits.maxTriangles * 0.8 },
      { metric: 'textureMB', value: metrics.textureMB, limit: this.limits.maxTextureMB, warn: this.limits.maxTextureMB * 0.8 },
      { metric: 'fps', value: -metrics.fps, limit: -this.limits.targetFPS, warn: -this.limits.targetFPS * 0.9 }, // Inverted: lower is worse
    ];

    for (const check of checks) {
      if (check.value > check.limit) {
        const v: BudgetViolation = {
          metric: check.metric,
          value: Math.abs(check.value),
          limit: Math.abs(check.limit),
          severity: 'error',
          message: \`\${check.metric} exceeded: \${this.formatNumber(Math.abs(check.value))} > \${this.formatNumber(Math.abs(check.limit))}\`,
        };
        this.violations.push(v);
        this.onViolation?.(v);
      } else if (check.value > check.warn) {
        const v: BudgetViolation = {
          metric: check.metric,
          value: Math.abs(check.value),
          limit: Math.abs(check.limit),
          severity: 'warning',
          message: \`\${check.metric} near budget: \${this.formatNumber(Math.abs(check.value))} / \${this.formatNumber(Math.abs(check.limit))}\`,
        };
        this.violations.push(v);
        this.onViolation?.(v);
      }
    }
  }

  private getCurrentMetrics(): BudgetMetrics {
    const avgFrameMs = this.frameTimes.length > 0 ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length : 0;
    return {
      drawCalls: Math.round(this.avgDrawCalls),
      triangles: Math.round(this.avgTriangles),
      textureMB: this.textureBytes / (1024 * 1024),
      frameMs: avgFrameMs,
      fps: avgFrameMs > 0 ? 1000 / avgFrameMs : 0,
      loadTimeSec: this.loadEnd > this.loadStart ? (this.loadEnd - this.loadStart) / 1000 : 0,
    };
  }

  /** Generate a full budget validation report */
  validate(): BudgetReport {
    const metrics = this.getCurrentMetrics();
    const violations: BudgetViolation[] = [];

    if (metrics.drawCalls > this.limits.maxDrawCalls)
      violations.push({ metric: 'drawCalls', value: metrics.drawCalls, limit: this.limits.maxDrawCalls, severity: 'error', message: \`Draw calls: \${metrics.drawCalls} > \${this.limits.maxDrawCalls}\` });
    if (metrics.triangles > this.limits.maxTriangles)
      violations.push({ metric: 'triangles', value: metrics.triangles, limit: this.limits.maxTriangles, severity: 'error', message: \`Triangles: \${this.formatNumber(metrics.triangles)} > \${this.formatNumber(this.limits.maxTriangles)}\` });
    if (metrics.textureMB > this.limits.maxTextureMB)
      violations.push({ metric: 'textureMB', value: metrics.textureMB, limit: this.limits.maxTextureMB, severity: 'error', message: \`Texture memory: \${metrics.textureMB.toFixed(1)}MB > \${this.limits.maxTextureMB}MB\` });
    if (metrics.fps < this.limits.targetFPS * 0.9 && this.frameTimes.length > 30)
      violations.push({ metric: 'fps', value: metrics.fps, limit: this.limits.targetFPS, severity: metrics.fps < this.limits.targetFPS * 0.5 ? 'error' : 'warning', message: \`FPS: \${metrics.fps.toFixed(0)} < \${this.limits.targetFPS}\` });
    if (metrics.loadTimeSec > this.limits.maxLoadTimeSec && metrics.loadTimeSec > 0)
      violations.push({ metric: 'loadTime', value: metrics.loadTimeSec, limit: this.limits.maxLoadTimeSec, severity: 'error', message: \`Load time: \${metrics.loadTimeSec.toFixed(2)}s > \${this.limits.maxLoadTimeSec}s\` });

    // Score: 100 = perfect, 0 = everything failed
    let score = 100;
    const weight = 100 / 5;
    if (metrics.drawCalls > this.limits.maxDrawCalls) score -= weight * Math.min(metrics.drawCalls / this.limits.maxDrawCalls, 2);
    else score -= weight * (1 - Math.min(metrics.drawCalls / this.limits.maxDrawCalls, 1)) * 0; // No penalty under budget
    if (metrics.triangles > this.limits.maxTriangles) score -= weight * Math.min(metrics.triangles / this.limits.maxTriangles, 2);
    if (metrics.textureMB > this.limits.maxTextureMB) score -= weight * Math.min(metrics.textureMB / this.limits.maxTextureMB, 2);
    if (metrics.fps < this.limits.targetFPS) score -= weight * (1 - metrics.fps / this.limits.targetFPS);
    if (metrics.loadTimeSec > this.limits.maxLoadTimeSec) score -= weight * Math.min(metrics.loadTimeSec / this.limits.maxLoadTimeSec, 2);
    score = Math.max(0, Math.round(score));

    return {
      passed: violations.filter(v => v.severity === 'error').length === 0,
      metrics,
      limits: { ...this.limits },
      violations,
      score,
      timestamp: Date.now(),
    };
  }

  private formatNumber(n: number): string {
    if (n >= 1_000_000) return \`\${(n / 1_000_000).toFixed(1)}M\`;
    if (n >= 1_000) return \`\${(n / 1_000).toFixed(1)}K\`;
    return String(n);
  }

  private createOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = 'position:fixed;bottom:8px;left:8px;font:11px monospace;color:#4f4;background:rgba(0,0,0,0.8);padding:4px 8px;border-radius:4px;z-index:99999;pointer-events:none;';
    document.body.appendChild(this.overlay);
  }

  /** Reset all metrics */
  reset(): void {
    this.frameDrawCalls = 0;
    this.frameTriangles = 0;
    this.frameTimes = [];
    this.textureBytes = 0;
    this.violations = [];
    this.avgDrawCalls = 0;
    this.avgTriangles = 0;
    this.frameCount = 0;
  }

  /** Clean up */
  destroy(): void {
    this.overlay?.remove();
    this.overlay = null;
  }
}
`
      }

      mkdirSync(dirname(outputPath), { recursive: true })
      writeFileSync(outputPath, code)
      const lines = code.split('\n').length
      return `Generated ${testType} utility (${engine}) at ${outputPath} (${lines} lines)`
    },
  })

  // ── Tool 16: ecs_generate ───────────────────────────────────────────
  registerTool({
    name: 'ecs_generate',
    description: 'Generate Entity Component System (ECS) code: components, systems, and entity archetypes. Produces idiomatic code for Bevy (Rust), bitecs (TypeScript), Unity DOTS (C#), miniplex (TypeScript), or ecsy (TypeScript).',
    parameters: {
      framework: { type: 'string', description: 'ECS framework: bevy, unity_dots, bitecs, miniplex, ecsy', required: true },
      entities: { type: 'string', description: 'JSON array of entity definitions, e.g. [{"name":"Player","components":["Position","Velocity","Health","Sprite"]}]', required: true },
      output_dir: { type: 'string', description: 'Output directory', required: true },
      systems: { type: 'string', description: 'JSON array of system definitions, e.g. [{"name":"Movement","queries":["Position","Velocity"]}]' },
    },
    tier: 'free',
    async execute(args) {
      const framework = String(args.framework).toLowerCase()
      let entities: Array<{ name: string; components: string[] }> = []
      try { entities = JSON.parse(String(args.entities)) } catch { return 'Error: entities must be valid JSON' }
      const outputDir = safePath(String(args.output_dir))
      let systems: Array<{ name: string; queries: string[]; description?: string }> = []
      try { systems = args.systems ? JSON.parse(String(args.systems)) : [] } catch { return 'Error: systems must be valid JSON' }

      const validFrameworks = ['bevy', 'unity_dots', 'bitecs', 'miniplex', 'ecsy']
      if (!validFrameworks.includes(framework)) {
        return `Error: Unknown ECS framework "${framework}". Valid: ${validFrameworks.join(', ')}`
      }

      if (!entities || entities.length === 0) {
        return 'Error: At least one entity definition is required.'
      }

      mkdirSync(outputDir, { recursive: true })

      // Collect all unique components
      const allComponents = new Set<string>()
      for (const entity of entities) {
        for (const comp of entity.components) allComponents.add(comp)
      }

      // Auto-generate common systems if none provided
      const effectiveSystems = systems.length > 0 ? systems : generateDefaultSystems(Array.from(allComponents))

      const files: string[] = []
      let totalLines = 0

      if (framework === 'bevy') {
        // ── Bevy (Rust) ──────────────────────────────────────────
        // components.rs
        let componentsRs = `//! ECS Components — Bevy
//! Generated by kbot ecs_generate

use bevy::prelude::*;

`
        for (const comp of allComponents) {
          const fields = getComponentFields(comp)
          componentsRs += `/// ${comp} component
#[derive(Component, Debug, Clone)]
pub struct ${comp} {
${fields.map(f => `    pub ${toSnakeCase(f.name)}: ${rustType(f.type)},`).join('\n')}
}

impl Default for ${comp} {
    fn default() -> Self {
        Self {
${fields.map(f => `            ${toSnakeCase(f.name)}: ${rustDefault(f.type)},`).join('\n')}
        }
    }
}

`
        }
        writeFileSync(join(outputDir, 'components.rs'), componentsRs)
        files.push('components.rs')
        totalLines += componentsRs.split('\n').length

        // systems.rs
        let systemsRs = `//! ECS Systems — Bevy
//! Generated by kbot ecs_generate

use bevy::prelude::*;
use super::components::*;

`
        for (const sys of effectiveSystems) {
          const queryComps = sys.queries.filter(q => allComponents.has(q))
          if (queryComps.length === 0) continue
          const queryStr = queryComps.map(c => `&mut ${c}`).join(', ')
          systemsRs += `/// ${sys.description || sys.name + ' system'}
pub fn ${toSnakeCase(sys.name)}_system(
    mut query: Query<(${queryStr})>,
    time: Res<Time>,
) {
    let dt = time.delta_seconds();
    for (${queryComps.map(c => `mut ${toSnakeCase(c)}`).join(', ')}) in &mut query {
        // TODO: Implement ${sys.name} logic
${generateSystemBody(sys.name, queryComps, 'bevy')}
    }
}

`
        }
        writeFileSync(join(outputDir, 'systems.rs'), systemsRs)
        files.push('systems.rs')
        totalLines += systemsRs.split('\n').length

        // plugin.rs
        let pluginRs = `//! ECS Plugin — Bevy
//! Registers all components and systems.
//! Generated by kbot ecs_generate

use bevy::prelude::*;

mod components;
mod systems;

pub use components::*;
pub use systems::*;

/// Plugin that registers all ECS components and systems.
pub struct GameECSPlugin;

impl Plugin for GameECSPlugin {
    fn build(&self, app: &mut App) {
        app
${effectiveSystems.filter(s => s.queries.some(q => allComponents.has(q))).map(s => `            .add_systems(Update, systems::${toSnakeCase(s.name)}_system)`).join('\n')}
        ;
    }
}

// ── Entity Spawning ──────────────────────────────────────────────────

`
        for (const entity of entities) {
          pluginRs += `/// Spawn a ${entity.name} entity with default components.
pub fn spawn_${toSnakeCase(entity.name)}(commands: &mut Commands) -> Entity {
    commands.spawn((
${entity.components.map(c => `        ${c}::default(),`).join('\n')}
    )).id()
}

`
        }
        writeFileSync(join(outputDir, 'plugin.rs'), pluginRs)
        files.push('plugin.rs')
        totalLines += pluginRs.split('\n').length

      } else if (framework === 'bitecs') {
        // ── bitecs (TypeScript) ──────────────────────────────────
        let code = `// ECS — bitecs
// Generated by kbot ecs_generate
//
// Prerequisites: npm install bitecs

import {
  createWorld,
  defineComponent,
  defineQuery,
  defineSystem,
  addEntity,
  addComponent,
  Types,
  IWorld,
} from 'bitecs';

// ── Components ───────────────────────────────────────────────────────

`
        for (const comp of allComponents) {
          const fields = getComponentFields(comp)
          code += `export const ${comp} = defineComponent({
${fields.map(f => `  ${f.name}: Types.${bitecsType(f.type)},`).join('\n')}
});

`
        }

        code += `// ── Queries ──────────────────────────────────────────────────────────

`
        for (const sys of effectiveSystems) {
          const queryComps = sys.queries.filter(q => allComponents.has(q))
          if (queryComps.length === 0) continue
          code += `const ${toCamelCase(sys.name)}Query = defineQuery([${queryComps.join(', ')}]);
`
        }

        code += `
// ── Systems ──────────────────────────────────────────────────────────

`
        for (const sys of effectiveSystems) {
          const queryComps = sys.queries.filter(q => allComponents.has(q))
          if (queryComps.length === 0) continue
          code += `/** ${sys.description || sys.name + ' system'} */
export const ${toCamelCase(sys.name)}System = defineSystem((world: IWorld) => {
  const ents = ${toCamelCase(sys.name)}Query(world);
  for (let i = 0; i < ents.length; i++) {
    const eid = ents[i];
${generateSystemBody(sys.name, queryComps, 'bitecs')}
  }
  return world;
});

`
        }

        code += `// ── World Setup ──────────────────────────────────────────────────────

export function createGameWorld(): IWorld {
  const world = createWorld();
  return world;
}

// ── Entity Factories ─────────────────────────────────────────────────

`
        for (const entity of entities) {
          code += `/** Create a ${entity.name} entity */
export function create${entity.name}(world: IWorld, overrides: Partial<Record<string, number>> = {}): number {
  const eid = addEntity(world);
${entity.components.map(c => `  addComponent(world, ${c}, eid);`).join('\n')}
  // Apply overrides
  for (const [key, value] of Object.entries(overrides)) {
${entity.components.map(c => {
  const fields = getComponentFields(c)
  return fields.map(f => `    if (key === '${c}.${f.name}' || key === '${f.name}') ${c}.${f.name}[eid] = value!;`).join('\n')
}).join('\n')}
  }
  return eid;
}

`
        }

        code += `// ── Game Loop ─────────────────────────────────────────────────────────

/** Run all systems once */
export function tick(world: IWorld): void {
${effectiveSystems.filter(s => s.queries.some(q => allComponents.has(q))).map(s => `  ${toCamelCase(s.name)}System(world);`).join('\n')}
}
`
        writeFileSync(join(outputDir, 'ecs.ts'), code)
        files.push('ecs.ts')
        totalLines += code.split('\n').length

      } else if (framework === 'unity_dots') {
        // ── Unity DOTS (C#) ──────────────────────────────────────
        // Components
        for (const comp of allComponents) {
          const fields = getComponentFields(comp)
          const compCode = `// ${comp} Component — Unity DOTS
// Generated by kbot ecs_generate

using Unity.Entities;
using Unity.Mathematics;

/// <summary>${comp} component data.</summary>
public struct ${comp} : IComponentData
{
${fields.map(f => `    public ${csharpType(f.type)} ${capitalize(f.name)};`).join('\n')}
}
`
          writeFileSync(join(outputDir, `${comp}.cs`), compCode)
          files.push(`${comp}.cs`)
          totalLines += compCode.split('\n').length
        }

        // Systems
        for (const sys of effectiveSystems) {
          const queryComps = sys.queries.filter(q => allComponents.has(q))
          if (queryComps.length === 0) continue

          const sysCode = `// ${sys.name} System — Unity DOTS
// Generated by kbot ecs_generate

using Unity.Burst;
using Unity.Entities;
using Unity.Mathematics;
using Unity.Transforms;

/// <summary>${sys.description || sys.name + ' system'}.</summary>
[BurstCompile]
public partial struct ${sys.name}System : ISystem
{
    [BurstCompile]
    public void OnCreate(ref SystemState state)
    {
        state.RequireForUpdate<${queryComps[0]}>();
    }

    [BurstCompile]
    public void OnUpdate(ref SystemState state)
    {
        float dt = SystemAPI.Time.DeltaTime;

        foreach (var (${queryComps.map(c => `${toCamelCase(c)}`).join(', ')}) in
            SystemAPI.Query<${queryComps.map(c => `RefRW<${c}>`).join(', ')}>())
        {
${generateSystemBody(sys.name, queryComps, 'unity_dots')}
        }
    }
}
`
          writeFileSync(join(outputDir, `${sys.name}System.cs`), sysCode)
          files.push(`${sys.name}System.cs`)
          totalLines += sysCode.split('\n').length
        }

        // Entity archetypes / authoring
        for (const entity of entities) {
          const authoringCode = `// ${entity.name} Authoring — Unity DOTS
// Generated by kbot ecs_generate

using Unity.Entities;
using UnityEngine;

/// <summary>Authoring component for ${entity.name} entity.</summary>
public class ${entity.name}Authoring : MonoBehaviour
{
${entity.components.map(c => {
  const fields = getComponentFields(c)
  return fields.map(f => `    [Header("${c}")] public ${csharpMonoType(f.type)} ${c}${capitalize(f.name)};`).join('\n')
}).join('\n\n')}

    class Baker : Baker<${entity.name}Authoring>
    {
        public override void Bake(${entity.name}Authoring authoring)
        {
            var entity = GetEntity(TransformUsageFlags.Dynamic);
${entity.components.map(c => {
  const fields = getComponentFields(c)
  return `            AddComponent(entity, new ${c}
            {
${fields.map(f => `                ${capitalize(f.name)} = authoring.${c}${capitalize(f.name)},`).join('\n')}
            });`
}).join('\n')}
        }
    }
}
`
          writeFileSync(join(outputDir, `${entity.name}Authoring.cs`), authoringCode)
          files.push(`${entity.name}Authoring.cs`)
          totalLines += authoringCode.split('\n').length
        }

      } else if (framework === 'miniplex') {
        // ── miniplex (TypeScript) ────────────────────────────────
        let code = `// ECS — miniplex
// Generated by kbot ecs_generate
//
// Prerequisites: npm install miniplex

import { World } from 'miniplex';

// ── Component Types ──────────────────────────────────────────────────

`
        for (const comp of allComponents) {
          const fields = getComponentFields(comp)
          code += `export interface ${comp} {
${fields.map(f => `  ${f.name}: ${tsType(f.type)};`).join('\n')}
}

`
        }

        code += `// ── Entity Type ──────────────────────────────────────────────────────

export type Entity = {
${Array.from(allComponents).map(c => `  ${toCamelCase(c)}?: ${c};`).join('\n')}
  // Add more component types as needed
};

// ── World ────────────────────────────────────────────────────────────

export const world = new World<Entity>();

// ── Archetypes (queries) ─────────────────────────────────────────────

`
        for (const sys of effectiveSystems) {
          const queryComps = sys.queries.filter(q => allComponents.has(q))
          if (queryComps.length === 0) continue
          code += `export const ${toCamelCase(sys.name)}Archetype = world.with(${queryComps.map(c => `'${toCamelCase(c)}'`).join(', ')});
`
        }

        code += `
// ── Systems ──────────────────────────────────────────────────────────

`
        for (const sys of effectiveSystems) {
          const queryComps = sys.queries.filter(q => allComponents.has(q))
          if (queryComps.length === 0) continue
          code += `/** ${sys.description || sys.name + ' system'} */
export function ${toCamelCase(sys.name)}System(dt: number): void {
  for (const entity of ${toCamelCase(sys.name)}Archetype) {
${generateSystemBody(sys.name, queryComps, 'miniplex')}
  }
}

`
        }

        code += `// ── Entity Factories ─────────────────────────────────────────────────

`
        for (const entity of entities) {
          code += `/** Create a ${entity.name} entity */
export function create${entity.name}(overrides: Partial<Entity> = {}): Entity {
  const entity: Entity = {
${entity.components.map(c => {
  const fields = getComponentFields(c)
  return `    ${toCamelCase(c)}: { ${fields.map(f => `${f.name}: ${tsDefault(f.type)}`).join(', ')} },`
}).join('\n')}
    ...overrides,
  };
  world.add(entity);
  return entity;
}

`
        }

        code += `// ── Game Loop ─────────────────────────────────────────────────────────

/** Run all systems once */
export function tick(dt: number): void {
${effectiveSystems.filter(s => s.queries.some(q => allComponents.has(q))).map(s => `  ${toCamelCase(s.name)}System(dt);`).join('\n')}
}
`
        writeFileSync(join(outputDir, 'ecs.ts'), code)
        files.push('ecs.ts')
        totalLines += code.split('\n').length

      } else if (framework === 'ecsy') {
        // ── ecsy (TypeScript) ────────────────────────────────────
        let code = `// ECS — ecsy
// Generated by kbot ecs_generate
//
// Prerequisites: npm install ecsy

import { World, System, Component, Types, Entity } from 'ecsy';

// ── Components ───────────────────────────────────────────────────────

`
        for (const comp of allComponents) {
          const fields = getComponentFields(comp)
          code += `export class ${comp} extends Component<${comp}> {
${fields.map(f => `  ${f.name}!: ${tsType(f.type)};`).join('\n')}

  static schema = {
${fields.map(f => `    ${f.name}: { type: Types.${ecsyType(f.type)}, default: ${tsDefault(f.type)} },`).join('\n')}
  };
}

`
        }

        code += `// ── Systems ──────────────────────────────────────────────────────────

`
        for (const sys of effectiveSystems) {
          const queryComps = sys.queries.filter(q => allComponents.has(q))
          if (queryComps.length === 0) continue
          code += `/** ${sys.description || sys.name + ' system'} */
export class ${sys.name}System extends System {
  static queries = {
    entities: { components: [${queryComps.join(', ')}] },
  };

  execute(delta: number, _time: number): void {
    for (const entity of this.queries.entities.results) {
${queryComps.map(c => `      const ${toCamelCase(c)} = entity.getMutableComponent(${c})!;`).join('\n')}
${generateSystemBody(sys.name, queryComps, 'ecsy')}
    }
  }
}

`
        }

        code += `// ── World Setup ──────────────────────────────────────────────────────

export function createGameWorld(): World {
  const world = new World();

  // Register components
${Array.from(allComponents).map(c => `  world.registerComponent(${c});`).join('\n')}

  // Register systems
${effectiveSystems.filter(s => s.queries.some(q => allComponents.has(q))).map(s => `  world.registerSystem(${s.name}System);`).join('\n')}

  return world;
}

// ── Entity Factories ─────────────────────────────────────────────────

`
        for (const entity of entities) {
          code += `/** Create a ${entity.name} entity */
export function create${entity.name}(world: World, overrides: Record<string, unknown> = {}): Entity {
  return world.createEntity()
${entity.components.map(c => `    .addComponent(${c}, overrides['${c}'] as any)`).join('\n')}
  ;
}

`
        }

        code += `// ── Game Loop ─────────────────────────────────────────────────────────

/** Start the game loop */
export function startGameLoop(world: World): void {
  let lastTime = performance.now();
  function loop() {
    const now = performance.now();
    const dt = now - lastTime;
    lastTime = now;
    world.execute(dt, now);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
`
        writeFileSync(join(outputDir, 'ecs.ts'), code)
        files.push('ecs.ts')
        totalLines += code.split('\n').length
      }

      return `Generated ECS code (${framework}) for ${entities.length} entities, ${Array.from(allComponents).length} components, ${effectiveSystems.length} systems:\n${files.map(f => `  ${outputDir}/${f}`).join('\n')}\nTotal: ${totalLines} lines across ${files.length} files`
    },
  })
}
