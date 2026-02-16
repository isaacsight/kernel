import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as dotenv from 'dotenv';

const projectDir = '/Users/isaachernandez/blog design';
dotenv.config({ path: resolve(projectDir, '.env') });

const svgPath = resolve(projectDir, 'public/logo-mark.svg');
const pngPath = resolve(projectDir, 'public/logo-mark.png');

// Convert SVG → PNG
const svg = readFileSync(svgPath);
await sharp(svg).resize(512, 512).png().toFile(pngPath);
console.log('Created logo-mark.png (512x512)');

// Upload to Discord
const token = process.env.DISCORD_BOT_TOKEN;
const pngBuffer = readFileSync(pngPath);
const base64 = pngBuffer.toString('base64');
const dataUri = `data:image/png;base64,${base64}`;

const res = await fetch('https://discord.com/api/v10/users/@me', {
  method: 'PATCH',
  headers: {
    Authorization: `Bot ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ avatar: dataUri }),
});

if (res.ok) {
  const data = await res.json();
  console.log(`Discord bot avatar updated! Username: ${data.username}`);
} else {
  const err = await res.text();
  console.error('Failed:', res.status, err);
}
