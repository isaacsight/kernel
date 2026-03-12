#!/usr/bin/env npx tsx
// Generate splash screens for iOS and Android with Rubin ivory background
// Usage: npx tsx tools/generate-splash.ts [source-icon.png]

import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { join } from 'path'

const PROJECT_ROOT = join(import.meta.dirname, '..')
const SOURCE = process.argv[2] || join(PROJECT_ROOT, 'public', 'logo-mark-512.png')
const IVORY = { r: 250, g: 249, b: 246 } // #FAF9F6

// iOS: Universal splash (2732x2732 — largest iPad dimension, iOS crops it)
const IOS_SPLASH = [
  { name: 'Default@2x~universal~anyany', width: 2732, height: 2732 },
]

// Android splash sizes
const ANDROID_SPLASH = [
  { dir: 'drawable-mdpi', width: 480, height: 800 },
  { dir: 'drawable-hdpi', width: 720, height: 1280 },
  { dir: 'drawable-xhdpi', width: 960, height: 1600 },
  { dir: 'drawable-xxhdpi', width: 1080, height: 1920 },
  { dir: 'drawable-xxxhdpi', width: 1440, height: 2560 },
]

async function createSplash(
  source: string,
  width: number,
  height: number,
  outputPath: string
) {
  // Icon is 25% of the shortest dimension
  const iconSize = Math.round(Math.min(width, height) * 0.25)

  // Create ivory background, composite icon centered
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: IVORY,
    },
  })
    .composite([{
      input: await sharp(source).resize(iconSize, iconSize).png().toBuffer(),
      gravity: 'centre',
    }])
    .png()
    .toFile(outputPath)
}

async function main() {
  console.log(`Source: ${SOURCE}`)
  console.log(`Background: #FAF9F6 (Rubin ivory)\n`)

  // iOS
  const iosSplashDir = join(PROJECT_ROOT, 'ios', 'App', 'App', 'Assets.xcassets', 'Splash.imageset')
  mkdirSync(iosSplashDir, { recursive: true })

  console.log('iOS splash screens:')
  for (const { name, width, height } of IOS_SPLASH) {
    const output = join(iosSplashDir, `${name}.png`)
    await createSplash(SOURCE, width, height, output)
    console.log(`  ${name}.png (${width}x${height})`)
  }

  // Write Contents.json
  const { writeFileSync } = await import('fs')
  writeFileSync(join(iosSplashDir, 'Contents.json'), JSON.stringify({
    images: IOS_SPLASH.map(({ name }) => ({
      filename: `${name}.png`,
      idiom: 'universal',
    })),
    info: { author: 'xcode', version: 1 },
  }, null, 2))

  // Android
  console.log('\nAndroid splash screens:')
  for (const { dir, width, height } of ANDROID_SPLASH) {
    const androidDir = join(PROJECT_ROOT, 'android', 'app', 'src', 'main', 'res', dir)
    mkdirSync(androidDir, { recursive: true })
    const output = join(androidDir, 'splash.png')
    await createSplash(SOURCE, width, height, output)
    console.log(`  ${dir}/splash.png (${width}x${height})`)
  }

  console.log('\nDone! All splash screens generated.')
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
