#!/usr/bin/env npx tsx
// SYNTH Sprite Pipeline — Dead Cells approach
// Takes high-res AI-generated images → downscales to pixel art → game-ready sprites
//
// Usage: npx tsx tools/sprite-pipeline.ts
//
// 1. Put Midjourney outputs in packages/synth/assets/raw/
// 2. Run this script
// 3. Game-ready sprites appear in packages/synth/assets/sprites/

import sharp from 'sharp'
import { readdirSync, existsSync, mkdirSync } from 'fs'
import { join, basename, extname } from 'path'

const RAW_DIR = join(import.meta.dirname, '..', 'packages', 'synth', 'assets', 'raw')
const PROCESSED_DIR = join(import.meta.dirname, '..', 'packages', 'synth', 'assets', 'processed')
const SPRITES_DIR = join(import.meta.dirname, '..', 'packages', 'synth', 'assets', 'sprites')

// Target sizes for different sprite types
const SIZES: Record<string, { w: number; h: number }> = {
  'player': { w: 32, h: 32 },
  'partner': { w: 32, h: 32 },
  'enemy': { w: 28, h: 28 },
  'tile': { w: 32, h: 32 },
  'pickup': { w: 16, h: 16 },
  'projectile': { w: 12, h: 12 },
}

// SYNTH color palette (limited, cohesive)
// Inspired by Hyper Light Drifter / Tron
const PALETTE = {
  bg: [10, 10, 18],        // deep navy
  player: [68, 136, 255],  // cyan blue
  partner: [68, 255, 136], // emerald green
  enemy: [255, 68, 68],    // hot red
  wall: [50, 50, 60],      // dark stone
  floor: [20, 20, 35],     // dark tile
  gold: [255, 200, 50],    // pickup gold
  white: [240, 240, 255],  // highlights
}

function getTargetSize(filename: string): { w: number; h: number } {
  for (const [prefix, size] of Object.entries(SIZES)) {
    if (filename.startsWith(prefix)) return size
  }
  return { w: 32, h: 32 } // default
}

async function processImage(inputPath: string, outputPath: string, size: { w: number; h: number }): Promise<void> {
  const name = basename(inputPath)

  // Step 1: Remove background (make transparent around edges)
  // Step 2: Downscale with nearest-neighbor (pixelation)
  // Step 3: Quantize to limited palette
  // Step 4: Sharpen edges

  await sharp(inputPath)
    // First downscale to 2x target for intermediate quality
    .resize(size.w * 2, size.h * 2, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toFile(join(PROCESSED_DIR, `${basename(name, extname(name))}_2x.png`))

  // Then downscale to final size with nearest-neighbor for pixel art look
  await sharp(join(PROCESSED_DIR, `${basename(name, extname(name))}_2x.png`))
    .resize(size.w, size.h, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.nearest,
    })
    // Boost contrast for pixel readability
    .modulate({ brightness: 1.1, saturation: 1.3 })
    .sharpen({ sigma: 0.5 })
    .png({ palette: true, colours: 32 }) // quantize to 32 colors max
    .toFile(outputPath)

  console.log(`  ✓ ${name} → ${size.w}x${size.h}`)
}

async function processSpriteSheet(inputPath: string, outputDir: string, frameSize: { w: number; h: number }, cols: number, rows: number): Promise<void> {
  const name = basename(inputPath, extname(inputPath))
  const img = sharp(inputPath)
  const meta = await img.metadata()

  if (!meta.width || !meta.height) {
    console.log(`  ✗ ${name} — can't read dimensions`)
    return
  }

  const frameW = Math.floor(meta.width / cols)
  const frameH = Math.floor(meta.height / rows)

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const frameNum = row * cols + col
      await sharp(inputPath)
        .extract({
          left: col * frameW,
          top: row * frameH,
          width: frameW,
          height: frameH,
        })
        .resize(frameSize.w, frameSize.h, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
          kernel: sharp.kernel.nearest,
        })
        .modulate({ brightness: 1.1, saturation: 1.3 })
        .png({ palette: true, colours: 32 })
        .toFile(join(outputDir, `${name}_frame${frameNum}.png`))
    }
  }

  console.log(`  ✓ ${name} → ${cols * rows} frames at ${frameSize.w}x${frameSize.h}`)
}

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════')
  console.log(' SYNTH Sprite Pipeline')
  console.log(' Dead Cells approach: AI concept → pixel art')
  console.log('═══════════════════════════════════════════════════')
  console.log()

  // Ensure directories exist
  for (const dir of [RAW_DIR, PROCESSED_DIR, SPRITES_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }

  const files = readdirSync(RAW_DIR).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))

  if (files.length === 0) {
    console.log('No images found in assets/raw/')
    console.log('Generate images with Midjourney using the prompts in assets/MIDJOURNEY_PROMPTS.md')
    console.log('Save them to packages/synth/assets/raw/ and run this again.')
    return
  }

  console.log(`Found ${files.length} raw images\n`)
  console.log('Processing...')

  for (const file of files) {
    const inputPath = join(RAW_DIR, file)
    const name = basename(file, extname(file))
    const size = getTargetSize(name)

    // Sprite sheets (attack animations) are 2x2 grids
    if (name.includes('attack') && !name.includes('frame')) {
      await processSpriteSheet(inputPath, SPRITES_DIR, size, 2, 2)
    } else {
      const outputPath = join(SPRITES_DIR, `${name}.png`)
      await processImage(inputPath, outputPath, size)
    }
  }

  console.log()
  console.log(`Done. Sprites ready in packages/synth/assets/sprites/`)
  console.log()
  console.log('Next: update TextureFactory.ts to load these sprites instead of procedural shapes.')
}

main().catch(err => {
  console.error('Pipeline error:', err)
  process.exit(1)
})
