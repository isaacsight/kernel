/**
 * ableton-osc-installer.ts — Install and patch AbletonOSC for kbot control
 *
 * Installs AbletonOSC remote script into Ableton's User Library,
 * patches it with kbot extensions (device loading, Python exec),
 * and provides setup instructions.
 *
 * Usage: kbot ableton setup
 */
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
const REPO_URL = 'https://github.com/ideoforms/AbletonOSC.git';
function getAbletonUserLibrary() {
    const home = os.homedir();
    return path.join(home, 'Music', 'Ableton', 'User Library', 'Remote Scripts', 'AbletonOSC');
}
function getAbletonPrefsDir() {
    const home = os.homedir();
    const prefsBase = path.join(home, 'Library', 'Preferences', 'Ableton');
    if (!fs.existsSync(prefsBase))
        return [];
    return fs.readdirSync(prefsBase)
        .filter(d => d.startsWith('Live'))
        .map(d => path.join(prefsBase, d))
        .sort()
        .reverse();
}
/**
 * The kbot patch for AbletonOSC's song.py — adds device loading via browser API.
 */
const DEVICE_LOADER_PATCH = `
        #--------------------------------------------------------------------------------
        # kbot: Load device onto track by browser search
        # /live/track/load/device <track_index> <search_term>
        #--------------------------------------------------------------------------------
        def track_load_device(params):
            try:
                track_index = int(params[0])
                search_term = str(params[1]).lower()
                track = self.song.tracks[track_index]
                self.song.view.selected_track = track
                browser = self.manager.application.browser

                found = None
                def search_recursive(item, term, depth=0):
                    nonlocal found
                    if found or depth > 5: return
                    try:
                        for child in item.children:
                            if term in child.name.lower():
                                if child.is_loadable:
                                    src = str(child.source) if hasattr(child, 'source') else ''
                                    if 'UAD' not in src:
                                        found = child
                                        return
                                search_recursive(child, term, depth + 1)
                            else:
                                search_recursive(child, term, depth + 1)
                    except: pass

                for root in [browser.plugins, browser.instruments, browser.audio_effects,
                             browser.midi_effects, browser.max_for_live, browser.drums]:
                    try:
                        search_recursive(root, search_term)
                        if found: break
                    except: continue

                if found:
                    browser.load_item(found)
                    self.logger.info("kbot: Loaded device: %s" % found.name)
                    return (1, found.name)
                else:
                    return (0, "not found")
            except Exception as e:
                return (0, str(e))
        self.osc_server.add_handler("/live/track/load/device", track_load_device)
`;
/**
 * The kbot patch for AbletonOSC's device.py — adds Python exec for deep control.
 */
const EXEC_PATCH = `
        #--------------------------------------------------------------------------------
        # kbot: Execute Python in Ableton's runtime
        # /live/exec <code_string>
        #--------------------------------------------------------------------------------
        def live_exec(params):
            code = str(params[0])
            try:
                result = eval(code, {
                    'song': self.song,
                    'app': self.manager.application,
                    'Live': __import__('Live'),
                    'tracks': self.song.tracks,
                })
                return (str(result),)
            except SyntaxError:
                local_vars = {
                    'song': self.song,
                    'app': self.manager.application,
                    'Live': __import__('Live'),
                    'tracks': self.song.tracks,
                    '_result': None,
                }
                exec(code, local_vars)
                return (str(local_vars.get('_result', 'ok')),)
            except Exception as e:
                return ("ERROR: " + str(e),)
        self.osc_server.add_handler("/live/exec", live_exec)
`;
export async function installAbletonOSC() {
    const destDir = getAbletonUserLibrary();
    const tmpDir = path.join(os.tmpdir(), 'kbot-abletonosc');
    const lines = [];
    const log = (msg) => { lines.push(msg); console.log(msg); };
    log('Installing AbletonOSC for kbot...');
    // Clone or update
    if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true });
    }
    try {
        execSync(`git clone --depth 1 ${REPO_URL} "${tmpDir}"`, { stdio: 'pipe' });
        log('  Cloned AbletonOSC');
    }
    catch {
        log('  ERROR: Could not clone AbletonOSC. Check internet connection.');
        return lines.join('\n');
    }
    // Apply kbot patches
    const songPy = path.join(tmpDir, 'abletonosc', 'song.py');
    const devicePy = path.join(tmpDir, 'abletonosc', 'device.py');
    if (fs.existsSync(songPy)) {
        let content = fs.readFileSync(songPy, 'utf8');
        // Insert device loader before Scene properties section
        content = content.replace('        # Callbacks for Song: Scene properties', DEVICE_LOADER_PATCH + '\n        # Callbacks for Song: Scene properties');
        fs.writeFileSync(songPy, content);
        log('  Patched song.py with device loader');
    }
    if (fs.existsSync(devicePy)) {
        let content = fs.readFileSync(devicePy, 'utf8');
        // Append exec handler at the end of init_api
        const lastHandler = content.lastIndexOf('self.osc_server.add_handler');
        if (lastHandler !== -1) {
            const insertPos = content.indexOf('\n', lastHandler) + 1;
            content = content.slice(0, insertPos) + EXEC_PATCH + content.slice(insertPos);
        }
        fs.writeFileSync(devicePy, content);
        log('  Patched device.py with exec handler');
    }
    // Copy to Ableton User Library
    const parentDir = path.dirname(destDir);
    if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
    }
    if (fs.existsSync(destDir)) {
        fs.rmSync(destDir, { recursive: true });
    }
    fs.cpSync(tmpDir, destDir, { recursive: true });
    log(`  Installed to ${destDir}`);
    // Clean up
    fs.rmSync(tmpDir, { recursive: true });
    log('');
    log('AbletonOSC installed with kbot extensions.');
    log('');
    log('To activate:');
    log('  1. Open Ableton Live');
    log('  2. Preferences (Cmd+,) > Link, Tempo & MIDI');
    log('  3. Set a Control Surface to "AbletonOSC"');
    log('  4. Close Preferences');
    log('');
    log('kbot commands available after activation:');
    log('  kbot ableton status     — Check connection');
    log('  kbot ableton session    — Build a session from a prompt');
    log('  kbot ableton load       — Load any device onto a track');
    log('  kbot ableton preset     — Create Serum 2 presets');
    return lines.join('\n');
}
export function isAbletonOSCInstalled() {
    const destDir = getAbletonUserLibrary();
    return fs.existsSync(path.join(destDir, '__init__.py'));
}
export function isKbotPatched() {
    const songPy = path.join(getAbletonUserLibrary(), 'abletonosc', 'song.py');
    if (!fs.existsSync(songPy))
        return false;
    const content = fs.readFileSync(songPy, 'utf8');
    return content.includes('track_load_device');
}
//# sourceMappingURL=ableton-osc-installer.js.map