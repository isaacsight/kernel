#!/usr/bin/env node
/**
 * Compiles ALL kbot M4L devices into .amxd binary format.
 *
 * .amxd binary format:
 *   Bytes 0-3:   "ampf" (magic)
 *   Bytes 4-7:   04 00 00 00 (version)
 *   Bytes 8-11:  device type ("aaaa"=audio effect, "mmmm"=midi effect, "iiii"=instrument)
 *   Bytes 12-15: "meta"
 *   Bytes 16-19: 04 00 00 00 (meta section length)
 *   Bytes 20-23: 00 00 00 00 (meta data)
 *   Bytes 24-27: "ptch" (patcher section marker)
 *   Bytes 28-31: JSON length as uint32 LE
 *   Bytes 32+:   JSON patcher content
 *   Last 2 bytes: 0a 00 (newline + null)
 */

const fs = require('fs');
const path = require('path');

const M4L_DIR = __dirname;
const HOME = process.env.HOME || '/Users/isaachernandez';

// Device type codes for AMXD header
const TYPES = {
  audio:      'aaaa',  // Audio Effect
  midi:       'mmmm',  // MIDI Effect
  instrument: 'iiii',  // Instrument
};

// All kbot M4L devices to compile
const DEVICES = [
  // MIDI Effects
  { name: 'kbot-genre-morph', type: 'midi',       dir: 'kbot-genre-morph',  dest: 'MIDI Effects/Max MIDI Effect' },
  { name: 'kbot-hat-machine', type: 'midi',       dir: 'kbot-hat-machine',  dest: 'MIDI Effects/Max MIDI Effect' },
  { name: 'kbot-auto-pilot',  type: 'midi',       dir: 'kbot-auto-pilot',   dest: 'MIDI Effects/Max MIDI Effect' },
  // Audio Effects
  { name: 'kbot-dj-fx',       type: 'audio',      dir: 'kbot-dj-fx',       dest: 'Audio Effects/Max Audio Effect' },
  { name: 'kbot-sidechain',   type: 'audio',      dir: 'kbot-sidechain',   dest: 'Audio Effects/Max Audio Effect' },
  // Instruments
  { name: 'kbot-drum-synth',  type: 'instrument', dir: 'kbot-drum-synth',  dest: 'Instruments/Max Instrument' },
  { name: 'kbot-bass-synth',  type: 'instrument', dir: 'kbot-bass-synth',  dest: 'Instruments/Max Instrument' },
  { name: 'kbot-pad-synth',   type: 'instrument', dir: 'kbot-pad-synth',   dest: 'Instruments/Max Instrument' },
  { name: 'kbot-riser-engine', type: 'instrument', dir: 'kbot-riser-engine', dest: 'Instruments/Max Instrument' },
];

function buildAmxd(patcherJson, typeCode) {
  const jsonStr = JSON.stringify(patcherJson, null, '\t');
  const jsonBytes = Buffer.from(jsonStr, 'utf-8');

  const header = Buffer.alloc(32);
  header.write('ampf', 0);                           // magic
  header.writeUInt32LE(4, 4);                         // version
  header.write(typeCode, 8);                          // device type
  header.write('meta', 12);                           // meta section
  header.writeUInt32LE(4, 16);                        // meta length
  header.writeUInt32LE(0, 20);                        // meta data
  header.write('ptch', 24);                           // patcher section
  header.writeUInt32LE(jsonBytes.length + 2, 28);     // JSON + footer length

  const footer = Buffer.from([0x0a, 0x00]);           // newline + null

  return Buffer.concat([header, jsonBytes, footer]);
}

let compiled = 0;
let failed = 0;

for (const dev of DEVICES) {
  const maxpatPath = path.join(M4L_DIR, dev.dir, dev.name + '.maxpat');
  const jsPath = path.join(M4L_DIR, dev.dir, dev.name + '.js');

  if (!fs.existsSync(maxpatPath)) {
    console.log(`✗ ${dev.name}: maxpat not found at ${maxpatPath}`);
    failed++;
    continue;
  }

  try {
    // Read the maxpat JSON
    const patcherJson = JSON.parse(fs.readFileSync(maxpatPath, 'utf-8'));

    // Add dependency_cache for the JS file
    if (fs.existsSync(jsPath)) {
      if (!patcherJson.patcher.dependency_cache) {
        patcherJson.patcher.dependency_cache = [];
      }
      patcherJson.patcher.dependency_cache.push({
        name: dev.name + '.js',
        bootpath: '.',
        type: 'TEXT',
        implicit: 1,
      });
    }

    // Add parameter banks if missing
    if (!patcherJson.patcher.parameters) {
      patcherJson.patcher.parameters = { parameterbanks: {} };
    }

    // Build the .amxd binary
    const amxd = buildAmxd(patcherJson, TYPES[dev.type]);

    // Write to source directory
    const srcAmxdPath = path.join(M4L_DIR, dev.dir, dev.name + '.amxd');
    fs.writeFileSync(srcAmxdPath, amxd);

    // Copy to Ableton User Library
    const destDir = path.join(HOME, 'Music/Ableton/User Library/Presets', dev.dest, 'kbot');
    fs.mkdirSync(destDir, { recursive: true });

    // Copy .amxd
    const destAmxdPath = path.join(destDir, dev.name + '.amxd');
    fs.writeFileSync(destAmxdPath, amxd);

    // Copy .js file alongside .amxd (M4L needs it in same folder)
    if (fs.existsSync(jsPath)) {
      fs.copyFileSync(jsPath, path.join(destDir, dev.name + '.js'));
    }

    compiled++;
    const kb = Math.round(amxd.length / 1024);
    console.log(`✓ ${dev.name}.amxd (${dev.type}, ${kb}KB) → ${dev.dest}/kbot/`);

  } catch (e) {
    console.log(`✗ ${dev.name}: ${e.message}`);
    failed++;
  }
}

console.log('');
console.log(`═══════════════════════════════════════`);
console.log(`  Compiled: ${compiled}/${DEVICES.length} devices`);
if (failed > 0) console.log(`  Failed: ${failed}`);
console.log(`  Format: .amxd (Ableton M4L binary)`);
console.log(`═══════════════════════════════════════`);
console.log('');
console.log('Devices are in Ableton browser under:');
console.log('  Max Instrument > kbot');
console.log('  Max MIDI Effect > kbot');
console.log('  Max Audio Effect > kbot');
