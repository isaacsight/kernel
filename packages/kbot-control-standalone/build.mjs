#!/usr/bin/env node
/**
 * Compile kbot-control.maxpat → kbot-control.amxd
 *
 * Reads the maxpat JSON, prepends the .amxd binary header, writes the
 * binary blob. Also copies to ~/Music/Ableton/User Library/... so it
 * appears in the Ableton browser immediately.
 *
 * .amxd binary layout (32-byte header):
 *   0-3   "ampf" magic
 *   4-7   u32 LE version (4)
 *   8-11  device type ("aaaa" = audio effect, "mmmm" = midi, "iiii" = instrument)
 *   12-15 "meta"
 *   16-19 u32 LE meta section length (4)
 *   20-23 u32 LE meta data (0)
 *   24-27 "ptch" patcher marker
 *   28-31 u32 LE patcher JSON length (including 2-byte footer)
 *   32..  patcher JSON + 0x0a 0x00
 */
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOME = process.env.HOME || '/Users/isaachernandez';

const maxpatPath = join(__dirname, 'kbot-control.maxpat');
const serverJsPath = join(__dirname, 'kbot-control-server.js');
const dispatcherJsPath = join(__dirname, 'kbot-control.js');

const patcherJson = JSON.parse(readFileSync(maxpatPath, 'utf-8'));
const jsonStr = JSON.stringify(patcherJson, null, '\t');
const jsonBytes = Buffer.from(jsonStr, 'utf-8');

const header = Buffer.alloc(32);
header.write('ampf', 0);
header.writeUInt32LE(4, 4);
header.write('aaaa', 8);               // audio effect
header.write('meta', 12);
header.writeUInt32LE(4, 16);
header.writeUInt32LE(0, 20);
header.write('ptch', 24);
header.writeUInt32LE(jsonBytes.length + 2, 28);

const footer = Buffer.from([0x0a, 0x00]);
const amxd = Buffer.concat([header, jsonBytes, footer]);

const outputPath = join(__dirname, 'kbot-control.amxd');
writeFileSync(outputPath, amxd);
console.log(`✓ built ${outputPath} (${amxd.length} bytes)`);

const userLibDir = join(HOME, 'Music/Ableton/User Library/Presets/Audio Effects/Max Audio Effect');
mkdirSync(userLibDir, { recursive: true });
const installPath = join(userLibDir, 'kbot-control.amxd');
writeFileSync(installPath, amxd);
console.log(`✓ installed to ${installPath}`);

// Companion JS files must sit next to the .amxd so Max can find them
copyFileSync(serverJsPath, join(userLibDir, 'kbot-control-server.js'));
copyFileSync(dispatcherJsPath, join(userLibDir, 'kbot-control.js'));
console.log(`✓ copied companion JS files to ${userLibDir}`);

console.log('\nNext: open Ableton → Browser → Audio Effects → Max Audio Effect → kbot-control');
console.log('      drag onto any track. kbot CLI will auto-connect to 127.0.0.1:9000 (TCP).');
