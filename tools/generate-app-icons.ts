#!/usr/bin/env npx tsx
// Generate all required iOS and Android app icons from a single 1024x1024 source
// Usage: npx tsx tools/generate-app-icons.ts [source-icon.png]

import sharp from 'sharp'
import { mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const PROJECT_ROOT = join(import.meta.dirname, '..')
const SOURCE = process.argv[2] || join(PROJECT_ROOT, 'public', 'logo-mark-512.png')

// iOS icon sizes (points × scale)
const IOS_SIZES = [
  { name: 'Icon-20@2x', size: 40 },
  { name: 'Icon-20@3x', size: 60 },
  { name: 'Icon-29@2x', size: 58 },
  { name: 'Icon-29@3x', size: 87 },
  { name: 'Icon-40@2x', size: 80 },
  { name: 'Icon-40@3x', size: 120 },
  { name: 'Icon-60@2x', size: 120 },
  { name: 'Icon-60@3x', size: 180 },
  { name: 'Icon-76@2x', size: 152 },
  { name: 'Icon-83.5@2x', size: 167 },
  { name: 'Icon-1024', size: 1024 },
]

// Android mipmap sizes
const ANDROID_SIZES = [
  { dir: 'mipmap-mdpi', size: 48 },
  { dir: 'mipmap-hdpi', size: 72 },
  { dir: 'mipmap-xhdpi', size: 96 },
  { dir: 'mipmap-xxhdpi', size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
]

async function main() {
  console.log(`Source: ${SOURCE}`)

  if (!existsSync(SOURCE)) {
    console.error(`Source icon not found: ${SOURCE}`)
    console.log('Usage: npx tsx tools/generate-app-icons.ts path/to/icon-1024.png')
    process.exit(1)
  }

  // iOS
  const iosDir = join(PROJECT_ROOT, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset')
  mkdirSync(iosDir, { recursive: true })

  console.log('\niOS icons:')
  for (const { name, size } of IOS_SIZES) {
    const output = join(iosDir, `${name}.png`)
    await sharp(SOURCE).resize(size, size).png().toFile(output)
    console.log(`  ${name}.png (${size}x${size})`)
  }

  // Write Contents.json for Xcode
  const contentsJson = {
    images: IOS_SIZES.map(({ name, size }) => ({
      filename: `${name}.png`,
      idiom: 'universal',
      platform: 'ios',
      size: `${size}x${size}`,
    })),
    info: { author: 'xcode', version: 1 },
  }
  const { writeFileSync } = await import('fs')
  writeFileSync(join(iosDir, 'Contents.json'), JSON.stringify(contentsJson, null, 2))
  console.log('  Contents.json')

  // Android
  console.log('\nAndroid icons:')
  for (const { dir, size } of ANDROID_SIZES) {
    const androidDir = join(PROJECT_ROOT, 'android', 'app', 'src', 'main', 'res', dir)
    mkdirSync(androidDir, { recursive: true })

    // Standard icon
    const output = join(androidDir, 'ic_launcher.png')
    await sharp(SOURCE).resize(size, size).png().toFile(output)

    // Round icon
    const roundOutput = join(androidDir, 'ic_launcher_round.png')
    const roundMask = Buffer.from(
      `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`
    )
    await sharp(SOURCE)
      .resize(size, size)
      .composite([{ input: roundMask, blend: 'dest-in' }])
      .png()
      .toFile(roundOutput)

    console.log(`  ${dir}/ic_launcher.png + ic_launcher_round.png (${size}x${size})`)
  }

  // Adaptive icon foreground (432x432 for xxxhdpi)
  const fgDir = join(PROJECT_ROOT, 'android', 'app', 'src', 'main', 'res', 'mipmap-xxxhdpi')
  await sharp(SOURCE)
    .resize(288, 288)
    .extend({ top: 72, bottom: 72, left: 72, right: 72, background: { r: 250, g: 249, b: 246, alpha: 0 } })
    .png()
    .toFile(join(fgDir, 'ic_launcher_foreground.png'))
  console.log('  mipmap-xxxhdpi/ic_launcher_foreground.png (432x432)')

  console.log('\nDone! All icons generated.')
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
