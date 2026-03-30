#!/usr/bin/env node
/**
 * Programmatically creates the kbot-bridge.amxd Max for Live device
 *
 * .amxd format:
 *   Bytes 0-3:   "ampf" (magic)
 *   Bytes 4-7:   04 00 00 00 (version)
 *   Bytes 8-11:  device type ("aaaa"=audio, "mmmm"=midi, "iiii"=instrument)
 *   Bytes 12-15: "meta"
 *   Bytes 16-19: 04 00 00 00 (meta section length)
 *   Bytes 20-23: 00 00 00 00 (meta data)
 *   Bytes 24-27: "ptch" (patcher section marker)
 *   Bytes 28-31: JSON length as uint32 LE
 *   Bytes 32+:   JSON patcher content
 *   Last 2 bytes: 0a 00 (newline + null)
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// The Max patcher JSON for the kbot bridge device
const patcher = {
  patcher: {
    fileversion: 1,
    appversion: { major: 8, minor: 6, revision: 5, architecture: "x64", modernui: 1 },
    classnamespace: "box",
    rect: [100, 100, 800, 500],
    bglocked: 0,
    openinpresentation: 1,
    default_fontsize: 12.0,
    default_fontface: 0,
    default_fontname: "Arial",
    gridonopen: 1,
    gridsize: [15.0, 15.0],
    gridsnapopen: 1,
    objectsnaponopen: 1,
    statusbarvisible: 2,
    toolbarvisible: 1,
    lefttoolbarpinned: 0,
    toptoolbarpinned: 0,
    righttoolbarpinned: 0,
    bottomtoolbarpinned: 0,
    toolbars_unpinned_last_save: 0,
    tallnewobj: 0,
    boxanimatetime: 200,
    enablehscroll: 1,
    enablevscroll: 1,
    devicewidth: 400,
    description: "kbot bridge — AI controls Ableton via TCP on port 9999",
    digest: "kbot M4L bridge for full LOM access",
    tags: "kbot, bridge, AI, automation",
    style: "",
    subpatcher_template: "",
    assistshowspatchername: 0,
    boxes: [
      // live.thisdevice — initialization gate
      {
        box: {
          id: "obj-1",
          maxclass: "newobj",
          text: "live.thisdevice",
          numinlets: 1,
          numoutlets: 2,
          outlettype: ["", ""],
          patching_rect: [50, 30, 100, 22]
        }
      },
      // loadbang to trigger initialization
      {
        box: {
          id: "obj-2",
          maxclass: "newobj",
          text: "loadbang",
          numinlets: 1,
          numoutlets: 1,
          outlettype: ["bang"],
          patching_rect: [200, 30, 60, 22]
        }
      },
      // node.script — TCP server
      {
        box: {
          id: "obj-3",
          maxclass: "newobj",
          text: "node.script kbot-bridge-server.js @autostart 1",
          numinlets: 1,
          numoutlets: 2,
          outlettype: ["", ""],
          patching_rect: [50, 80, 280, 22],
          saved_object_attributes: {
            autostart: 1,
            defer: 0,
            node: "",
            npm: "",
            watch: 1
          }
        }
      },
      // route command — splits incoming messages
      {
        box: {
          id: "obj-4",
          maxclass: "newobj",
          text: "route command",
          numinlets: 1,
          numoutlets: 2,
          outlettype: ["", ""],
          patching_rect: [50, 120, 100, 22]
        }
      },
      // js — LiveAPI dispatcher
      {
        box: {
          id: "obj-5",
          maxclass: "newobj",
          text: "js kbot-bridge.js",
          numinlets: 1,
          numoutlets: 1,
          outlettype: [""],
          patching_rect: [50, 160, 120, 22]
        }
      },
      // route response — captures JS output
      {
        box: {
          id: "obj-6",
          maxclass: "newobj",
          text: "route response",
          numinlets: 1,
          numoutlets: 2,
          outlettype: ["", ""],
          patching_rect: [50, 200, 100, 22]
        }
      },
      // prepend response — formats for node.script
      {
        box: {
          id: "obj-7",
          maxclass: "newobj",
          text: "prepend response",
          numinlets: 1,
          numoutlets: 1,
          outlettype: [""],
          patching_rect: [50, 240, 110, 22]
        }
      },
      // Status display
      {
        box: {
          id: "obj-8",
          maxclass: "comment",
          text: "kbot bridge — port 9999",
          presentation: 1,
          presentation_rect: [10, 10, 200, 20],
          patching_rect: [300, 30, 200, 20],
          fontsize: 14,
          textcolor: [0.2, 0.8, 0.4, 1.0]
        }
      },
      // Status indicator
      {
        box: {
          id: "obj-9",
          maxclass: "live.text",
          varname: "status",
          text: "OFFLINE",
          texton: "CONNECTED",
          presentation: 1,
          presentation_rect: [10, 35, 100, 20],
          patching_rect: [300, 60, 100, 20],
          activebgoncolor: [0.2, 0.8, 0.3, 1.0],
          activebgcolor: [0.5, 0.1, 0.1, 1.0],
          bgcolor: [0.5, 0.1, 0.1, 1.0],
          bgoncolor: [0.2, 0.8, 0.3, 1.0],
          fontsize: 11,
          mode: 0
        }
      },
      // Audio passthrough (required for audio effect — plugin~ in, plugout~)
      {
        box: {
          id: "obj-10",
          maxclass: "newobj",
          text: "plugin~",
          numinlets: 1,
          numoutlets: 1,
          outlettype: ["signal"],
          patching_rect: [400, 80, 55, 22]
        }
      },
      {
        box: {
          id: "obj-11",
          maxclass: "newobj",
          text: "plugout~",
          numinlets: 1,
          numoutlets: 0,
          patching_rect: [400, 120, 60, 22]
        }
      },
    ],
    lines: [
      // node.script outlet → route command
      { patchline: { source: ["obj-3", 0], destination: ["obj-4", 0] } },
      // route command → js dispatcher
      { patchline: { source: ["obj-4", 0], destination: ["obj-5", 0] } },
      // js output → route response
      { patchline: { source: ["obj-5", 0], destination: ["obj-6", 0] } },
      // route response → prepend response
      { patchline: { source: ["obj-6", 0], destination: ["obj-7", 0] } },
      // prepend response → back to node.script (inlet)
      { patchline: { source: ["obj-7", 0], destination: ["obj-3", 0] } },
      // Audio passthrough
      { patchline: { source: ["obj-10", 0], destination: ["obj-11", 0] } },
    ],
    parameters: {
      parameterbanks: {}
    },
    dependency_cache: [
      { name: "kbot-bridge-server.js", bootpath: ".", type: "TEXT", implicit: 1 },
      { name: "kbot-bridge.js", bootpath: ".", type: "TEXT", implicit: 1 }
    ],
  }
};

// Build the .amxd binary
const jsonStr = JSON.stringify(patcher, null, '\t');
const jsonBytes = Buffer.from(jsonStr, 'utf-8');

const header = Buffer.alloc(32);
header.write('ampf', 0);                    // magic
header.writeUInt32LE(4, 4);                  // version
header.write('aaaa', 8);                     // audio effect
header.write('meta', 12);                    // meta section
header.writeUInt32LE(4, 16);                 // meta length
header.writeUInt32LE(0, 20);                 // meta data (empty)
header.write('ptch', 24);                    // patcher section
header.writeUInt32LE(jsonBytes.length + 2, 28); // JSON length + footer

const footer = Buffer.from([0x0a, 0x00]);   // newline + null

const amxd = Buffer.concat([header, jsonBytes, footer]);

// Write to the m4l directory
const outputPath = join(__dirname, 'kbot-bridge.amxd');
writeFileSync(outputPath, amxd);
console.log(`✓ Created ${outputPath} (${amxd.length} bytes)`);

// Also copy to Ableton User Library for easy access
const userLibPath = join(
  process.env.HOME || '/Users/isaachernandez',
  'Music/Ableton/User Library/Presets/Audio Effects/Max Audio Effect'
);
try {
  mkdirSync(userLibPath, { recursive: true });
  const destPath = join(userLibPath, 'kbot-bridge.amxd');
  writeFileSync(destPath, amxd);
  console.log(`✓ Installed to ${destPath}`);
  console.log('\n  In Ableton: Browser → Audio Effects → Max Audio Effect → kbot-bridge');
  console.log('  Drag onto any track to activate the bridge');
} catch (e) {
  console.log(`⚠ Could not install to User Library: ${e.message}`);
  console.log('  Manually drag kbot-bridge.amxd onto a track in Ableton');
}

// Also copy the JS files next to the .amxd
console.log('\n  The device needs these JS files in the same folder:');
console.log('  - kbot-bridge-server.js (TCP server)');
console.log('  - kbot-bridge.js (LOM dispatcher)');
