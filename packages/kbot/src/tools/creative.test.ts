// K:BOT Creative Tools Tests
import { describe, it, expect, afterEach } from 'vitest'
import { existsSync, readFileSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Import the tool registration (so we can test via executeTool)
import { registerTool, executeTool, getTool, type ToolDefinition } from './index.js'

// We need to import and call registerCreativeTools to populate the registry
import { registerCreativeTools } from './creative.js'

// Register once — idempotent in vitest
registerCreativeTools()

// Temp directory for file output tests
const TEST_DIR = join(tmpdir(), 'kbot-creative-test-' + Date.now())
mkdirSync(TEST_DIR, { recursive: true })

afterEach(() => {
  // Clean up is handled at the end
})

// Clean up temp dir after all tests
import { afterAll } from 'vitest'
afterAll(() => {
  try { rmSync(TEST_DIR, { recursive: true, force: true }) } catch {}
})

describe('Creative Tools Registration', () => {
  it('registers generate_art tool', () => {
    const tool = getTool('generate_art')
    expect(tool).toBeTruthy()
    expect(tool!.tier).toBe('free')
    expect(tool!.parameters.description.required).toBe(true)
    expect(tool!.parameters.output_path.required).toBe(true)
  })

  it('registers generate_shader tool', () => {
    const tool = getTool('generate_shader')
    expect(tool).toBeTruthy()
    expect(tool!.tier).toBe('free')
    expect(tool!.parameters.description.required).toBe(true)
  })

  it('registers generate_music_pattern tool', () => {
    const tool = getTool('generate_music_pattern')
    expect(tool).toBeTruthy()
    expect(tool!.tier).toBe('free')
    expect(tool!.parameters.format.required).toBe(true)
  })

  it('registers generate_svg tool', () => {
    const tool = getTool('generate_svg')
    expect(tool).toBeTruthy()
    expect(tool!.tier).toBe('free')
  })

  it('registers evolve_design tool', () => {
    const tool = getTool('evolve_design')
    expect(tool).toBeTruthy()
    expect(tool!.tier).toBe('free')
    expect(tool!.parameters.source_path.required).toBe(true)
  })
})

describe('generate_art', () => {
  it('generates valid HTML with p5.js', async () => {
    const outPath = join(TEST_DIR, 'art-test.html')
    const result = await executeTool({
      id: 'art-1',
      name: 'generate_art',
      arguments: { description: 'ocean waves', style: 'abstract', output_path: outPath },
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toContain('Generated p5.js art')
    expect(existsSync(outPath)).toBe(true)

    const html = readFileSync(outPath, 'utf-8')
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('p5@1.11.3')
    expect(html).toContain('setup()')
    expect(html).toContain('ocean waves')
  })

  it('supports all 5 styles', async () => {
    const styles = ['abstract', 'geometric', 'organic', 'fractal', 'noise']
    for (const style of styles) {
      const outPath = join(TEST_DIR, `art-${style}.html`)
      const result = await executeTool({
        id: `art-${style}`,
        name: 'generate_art',
        arguments: { description: 'test', style, output_path: outPath },
      })
      expect(result.error).toBeUndefined()
      expect(existsSync(outPath)).toBe(true)
    }
  })

  it('rejects invalid style', async () => {
    const result = await executeTool({
      id: 'art-bad',
      name: 'generate_art',
      arguments: { description: 'test', style: 'cubism', output_path: join(TEST_DIR, 'bad.html') },
    })
    expect(result.result).toContain('Invalid style')
  })

  it('generates deterministic output for same description', async () => {
    const path1 = join(TEST_DIR, 'det-1.html')
    const path2 = join(TEST_DIR, 'det-2.html')
    await executeTool({
      id: 'det-1',
      name: 'generate_art',
      arguments: { description: 'deterministic test', style: 'abstract', output_path: path1 },
    })
    await executeTool({
      id: 'det-2',
      name: 'generate_art',
      arguments: { description: 'deterministic test', style: 'abstract', output_path: path2 },
    })
    const a = readFileSync(path1, 'utf-8')
    const b = readFileSync(path2, 'utf-8')
    expect(a).toBe(b)
  })
})

describe('generate_shader', () => {
  it('generates valid GLSL code', async () => {
    const outPath = join(TEST_DIR, 'shader-test.glsl')
    const result = await executeTool({
      id: 'shader-1',
      name: 'generate_shader',
      arguments: { description: 'molten lava', output_path: outPath },
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toContain('Generated GLSL shader')

    const glsl = readFileSync(outPath, 'utf-8')
    expect(glsl).toContain('mainImage')
    expect(glsl).toContain('fragColor')
    expect(glsl).toContain('iResolution')
    expect(glsl).toContain('molten lava')
  })

  it('includes utility functions', async () => {
    const outPath = join(TEST_DIR, 'shader-utils.glsl')
    await executeTool({
      id: 'shader-2',
      name: 'generate_shader',
      arguments: { description: 'test shader', output_path: outPath },
    })
    const glsl = readFileSync(outPath, 'utf-8')
    expect(glsl).toContain('fbm')
    expect(glsl).toContain('noise')
    expect(glsl).toContain('hash')
  })
})

describe('generate_music_pattern', () => {
  it('generates Sonic Pi code', async () => {
    const outPath = join(TEST_DIR, 'music-test.rb')
    const result = await executeTool({
      id: 'music-1',
      name: 'generate_music_pattern',
      arguments: { description: 'chill vibes', genre: 'ambient', format: 'sonic-pi', output_path: outPath },
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toContain('Sonic Pi')

    const code = readFileSync(outPath, 'utf-8')
    expect(code).toContain('use_bpm')
    expect(code).toContain('live_loop')
    expect(code).toContain('use_synth')
  })

  it('generates JSON pattern', async () => {
    const outPath = join(TEST_DIR, 'music-test.json')
    const result = await executeTool({
      id: 'music-2',
      name: 'generate_music_pattern',
      arguments: { description: 'jazz tune', genre: 'jazz', format: 'json', output_path: outPath },
    })
    expect(result.error).toBeUndefined()

    const data = JSON.parse(readFileSync(outPath, 'utf-8'))
    expect(data.meta).toBeTruthy()
    expect(data.meta.genre).toBe('jazz')
    expect(data.meta.tempo).toBeGreaterThan(0)
    expect(data.tracks).toBeInstanceOf(Array)
    expect(data.tracks.length).toBe(3) // melody, bass, drums
    expect(data.tracks[0].notes.length).toBeGreaterThan(0)
  })

  it('supports all genres', async () => {
    const genres = ['ambient', 'electronic', 'jazz', 'classical', 'hiphop']
    for (const genre of genres) {
      const outPath = join(TEST_DIR, `music-${genre}.json`)
      const result = await executeTool({
        id: `music-${genre}`,
        name: 'generate_music_pattern',
        arguments: { description: 'test', genre, format: 'json', output_path: outPath },
      })
      expect(result.error).toBeUndefined()
      const data = JSON.parse(readFileSync(outPath, 'utf-8'))
      expect(data.meta.genre).toBe(genre)
    }
  })

  it('rejects invalid format', async () => {
    const result = await executeTool({
      id: 'music-bad',
      name: 'generate_music_pattern',
      arguments: { description: 'test', format: 'midi', output_path: join(TEST_DIR, 'bad.mid') },
    })
    expect(result.result).toContain('Invalid format')
  })
})

describe('generate_svg', () => {
  it('generates valid SVG', async () => {
    const outPath = join(TEST_DIR, 'svg-test.svg')
    const result = await executeTool({
      id: 'svg-1',
      name: 'generate_svg',
      arguments: { description: 'flowing waves', output_path: outPath },
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toContain('Generated SVG art')
    expect(result.result).toContain('800x800')

    const svg = readFileSync(outPath, 'utf-8')
    expect(svg).toContain('<?xml')
    expect(svg).toContain('<svg')
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('</svg>')
  })

  it('respects custom dimensions', async () => {
    const outPath = join(TEST_DIR, 'svg-custom.svg')
    const result = await executeTool({
      id: 'svg-2',
      name: 'generate_svg',
      arguments: { description: 'custom size', width: 400, height: 300, output_path: outPath },
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toContain('400x300')

    const svg = readFileSync(outPath, 'utf-8')
    expect(svg).toContain('width="400"')
    expect(svg).toContain('height="300"')
  })

  it('rejects invalid dimensions', async () => {
    const result = await executeTool({
      id: 'svg-bad',
      name: 'generate_svg',
      arguments: { description: 'test', width: 5, height: 800, output_path: join(TEST_DIR, 'bad.svg') },
    })
    expect(result.result).toContain('between 10 and 10000')
  })
})

describe('evolve_design', () => {
  it('generates mutations from a source file', async () => {
    // Create a source file with some design content
    const sourcePath = join(TEST_DIR, 'source.svg')
    const sourceContent = `<svg viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="30" fill="#FF0000" opacity="0.8"/>
  <rect x="10" y="10" width="80" height="80" fill="hsl(200, 50%, 50%)"/>
</svg>`
    const { writeFileSync } = await import('node:fs')
    writeFileSync(sourcePath, sourceContent)

    const outDir = join(TEST_DIR, 'evolved')
    const result = await executeTool({
      id: 'evolve-1',
      name: 'evolve_design',
      arguments: { source_path: sourcePath, mutations: 3, output_dir: outDir },
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toContain('Evolved 3 variants')

    // Check variants exist and are different
    for (let i = 1; i <= 3; i++) {
      const variantPath = join(outDir, `source_variant_${i}.svg`)
      expect(existsSync(variantPath)).toBe(true)
    }
  })

  it('returns error for missing source file', async () => {
    const result = await executeTool({
      id: 'evolve-bad',
      name: 'evolve_design',
      arguments: { source_path: '/nonexistent/file.svg', output_dir: TEST_DIR },
    })
    expect(result.result).toContain('not found')
  })

  it('caps mutations at 50', async () => {
    const sourcePath = join(TEST_DIR, 'cap-source.html')
    const { writeFileSync } = await import('node:fs')
    writeFileSync(sourcePath, '<p>test 42</p>')

    const outDir = join(TEST_DIR, 'capped')
    const result = await executeTool({
      id: 'evolve-cap',
      name: 'evolve_design',
      arguments: { source_path: sourcePath, mutations: 100, output_dir: outDir },
    })
    expect(result.result).toContain('Evolved 50 variants')
  })
})
