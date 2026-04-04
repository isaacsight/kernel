// kbot Mobile Automation — iOS/Android device control via mobile-mcp
//
// Uses mobile-mcp (https://github.com/mobile-next/mobile-mcp) for native
// accessibility-tree-based automation. Connects to real iOS devices via USB
// or iOS/Android simulators.
//
// Key advantage over screenshot-based automation: deterministic element
// targeting via the native accessibility tree. Every UI element has a label,
// type, position, and identifier — no computer vision needed.
//
// Prerequisites:
//   - Node.js >= 22
//   - iOS device connected via USB and trusted, OR iOS simulator running
//   - Xcode command-line tools installed (for iOS physical devices)
//
// The mobile-mcp package (@mobilenext/mobile-mcp) is auto-installed via npx
// on first use. No manual setup required.
import { registerTool } from './index.js';
import { MobileMCPClient } from '../integrations/mobile-mcp-client.js';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
// ── Helpers ────────────────────────────────────────────────────────────
function getClient() {
    return MobileMCPClient.getInstance();
}
function ensureConnected() {
    const client = getClient();
    if (!client.isConnected) {
        return 'Error: Not connected to a mobile device. Use mobile_connect first.';
    }
    if (!client.currentDeviceId) {
        return 'Error: No device selected. Use mobile_connect to connect to a device.';
    }
    return null;
}
// ── Tool Registration ──────────────────────────────────────────────────
export function registerMobileAutomationTools() {
    // ── mobile_connect ─────────────────────────────────────────────────
    registerTool({
        name: 'mobile_connect',
        description: 'Connect to an iOS or Android device for mobile automation. ' +
            'Starts the mobile-mcp server (auto-installs @mobilenext/mobile-mcp if needed), ' +
            'discovers connected devices, and selects one. Returns: device name, platform, ' +
            'version, screen size. For iOS physical devices, connect via USB and trust the computer first.',
        parameters: {
            device_id: {
                type: 'string',
                description: 'Specific device ID to connect to (optional). If omitted, connects to the first available device. ' +
                    'Use mobile_connect with no args to see all devices, then reconnect with a specific ID.',
            },
            platform: {
                type: 'string',
                description: 'Filter by platform: "ios" or "android" (optional)',
            },
        },
        tier: 'free',
        timeout: 120_000, // npx install can take time on first run
        async execute(args) {
            const client = getClient();
            try {
                // Start the MCP server if not running
                if (!client.isConnected) {
                    await client.start();
                }
                // List available devices
                const devices = await client.listDevices();
                if (devices.length === 0) {
                    client.stop();
                    return ('Error: No devices found.\n\n' +
                        'For iOS physical devices:\n' +
                        '  1. Connect your iPhone/iPad via USB\n' +
                        '  2. Unlock the device and tap "Trust This Computer"\n' +
                        '  3. Ensure Xcode command-line tools are installed: xcode-select --install\n\n' +
                        'For iOS simulators:\n' +
                        '  1. Open Xcode > Window > Devices and Simulators\n' +
                        '  2. Boot a simulator, or: xcrun simctl boot "iPhone 16"\n\n' +
                        'For Android:\n' +
                        '  1. Enable USB debugging on the device\n' +
                        '  2. Connect via USB and accept the debugging prompt\n' +
                        '  3. Verify with: adb devices');
                }
                // Filter by platform if specified
                let candidates = devices;
                if (args.platform) {
                    const plat = String(args.platform).toLowerCase();
                    candidates = devices.filter(d => d.platform === plat);
                    if (candidates.length === 0) {
                        return (`No ${plat} devices found. Available devices:\n` +
                            devices.map(d => `  ${d.id} — ${d.name} (${d.platform} ${d.version}, ${d.type}, ${d.state})`).join('\n'));
                    }
                }
                // Select device
                let selected = candidates[0];
                if (args.device_id) {
                    const targetId = String(args.device_id);
                    const match = candidates.find(d => d.id === targetId);
                    if (!match) {
                        return (`Device "${targetId}" not found. Available devices:\n` +
                            candidates.map(d => `  ${d.id} — ${d.name} (${d.platform} ${d.version}, ${d.type}, ${d.state})`).join('\n'));
                    }
                    selected = match;
                }
                else {
                    // Prefer online devices, then real devices over simulators
                    const online = candidates.filter(d => d.state === 'online');
                    if (online.length > 0) {
                        const real = online.filter(d => d.type === 'real');
                        selected = real.length > 0 ? real[0] : online[0];
                    }
                }
                client.setActiveDevice(selected.id);
                // Get screen size
                let screenInfo = '';
                try {
                    screenInfo = await client.getScreenSize(selected.id);
                }
                catch {
                    screenInfo = 'Screen size: unknown';
                }
                const lines = [
                    'Connected to mobile device.',
                    `  Device: ${selected.name}`,
                    `  ID: ${selected.id}`,
                    `  Platform: ${selected.platform}`,
                    `  Type: ${selected.type}`,
                    `  Version: ${selected.version}`,
                    `  State: ${selected.state}`,
                    `  ${screenInfo}`,
                ];
                // Show other available devices if multiple
                if (candidates.length > 1) {
                    lines.push('');
                    lines.push(`Other available devices (${candidates.length - 1}):`);
                    for (const d of candidates) {
                        if (d.id !== selected.id) {
                            lines.push(`  ${d.id} — ${d.name} (${d.platform} ${d.version}, ${d.type})`);
                        }
                    }
                    lines.push('Use mobile_connect with device_id to switch.');
                }
                return lines.join('\n');
            }
            catch (err) {
                return `Error connecting to mobile device: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    // ── mobile_screenshot ──────────────────────────────────────────────
    registerTool({
        name: 'mobile_screenshot',
        description: 'Capture the current screen of the connected mobile device. ' +
            'Saves the screenshot to the specified file path (PNG or JPEG). ' +
            'Returns the file path on success.',
        parameters: {
            save_to: {
                type: 'string',
                description: 'File path to save the screenshot (e.g., "/tmp/screen.png"). Must end in .png, .jpg, or .jpeg.',
                required: true,
            },
        },
        tier: 'free',
        async execute(args) {
            const err = ensureConnected();
            if (err)
                return err;
            const saveTo = String(args.save_to);
            if (!/\.(png|jpe?g)$/i.test(saveTo)) {
                return 'Error: save_to must end in .png, .jpg, or .jpeg';
            }
            // Ensure directory exists
            const dir = dirname(resolve(saveTo));
            if (!existsSync(dir)) {
                try {
                    mkdirSync(dir, { recursive: true });
                }
                catch {
                    return `Error: Cannot create directory ${dir}`;
                }
            }
            try {
                const client = getClient();
                const result = await client.saveScreenshot(saveTo);
                return result;
            }
            catch (err) {
                // Fallback: try taking screenshot and saving manually
                try {
                    const client = getClient();
                    const screenshotResult = await client.takeScreenshot();
                    if (typeof screenshotResult === 'object' && 'data' in screenshotResult) {
                        const buffer = Buffer.from(screenshotResult.data, 'base64');
                        writeFileSync(saveTo, buffer);
                        return `Screenshot saved to: ${saveTo} (${Math.round(buffer.length / 1024)}KB)`;
                    }
                    return `Error: ${typeof screenshotResult === 'string' ? screenshotResult : 'Could not capture screenshot'}`;
                }
                catch (innerErr) {
                    return `Error capturing screenshot: ${innerErr instanceof Error ? innerErr.message : String(innerErr)}`;
                }
            }
        },
    });
    // ── mobile_tap ─────────────────────────────────────────────────────
    registerTool({
        name: 'mobile_tap',
        description: 'Tap on the connected mobile device screen. Can tap at exact coordinates (x, y) ' +
            'or find and tap an element by its accessibility label. When using label, the tool ' +
            'queries the accessibility tree to find the element and taps its center coordinates.',
        parameters: {
            x: {
                type: 'number',
                description: 'X coordinate to tap (pixels). Use with y. Ignored if label is provided.',
            },
            y: {
                type: 'number',
                description: 'Y coordinate to tap (pixels). Use with x. Ignored if label is provided.',
            },
            label: {
                type: 'string',
                description: 'Accessibility label or identifier of the element to tap. ' +
                    'The tool searches the accessibility tree for a matching element and taps its center. ' +
                    'Preferred over coordinates for reliable automation.',
            },
            double_tap: {
                type: 'boolean',
                description: 'If true, performs a double-tap instead of a single tap (default: false)',
            },
            long_press: {
                type: 'boolean',
                description: 'If true, performs a long press instead of a tap (default: false)',
            },
            long_press_duration: {
                type: 'number',
                description: 'Duration of long press in milliseconds (default: 500, max: 10000). Only used with long_press.',
            },
        },
        tier: 'free',
        async execute(args) {
            const err = ensureConnected();
            if (err)
                return err;
            const client = getClient();
            let tapX;
            let tapY;
            if (args.label) {
                // Find element by accessibility label
                const label = String(args.label).toLowerCase();
                try {
                    const elementsText = await client.listElements();
                    let elements;
                    try {
                        elements = JSON.parse(elementsText);
                    }
                    catch {
                        // Elements may be in a non-JSON format; try to find coordinates from text
                        return (`Error: Could not parse element list to find "${args.label}". ` +
                            'Use mobile_elements to inspect the screen, then use x/y coordinates.');
                    }
                    // Search by label, identifier, text, or name (case-insensitive partial match)
                    const match = elements.find(e => {
                        const fields = [e.label, e.identifier, e.text, e.name, e.value].filter(Boolean);
                        return fields.some(f => f.toLowerCase().includes(label));
                    });
                    if (!match) {
                        const available = elements
                            .filter(e => e.label || e.text || e.identifier)
                            .slice(0, 20)
                            .map(e => `  [${e.type}] "${e.label || e.text || e.identifier}" at (${e.x}, ${e.y})`)
                            .join('\n');
                        return (`Element with label "${args.label}" not found on screen.\n\n` +
                            `Visible elements (first 20):\n${available || '  (none with labels)'}\n\n` +
                            'Use mobile_elements for the full list.');
                    }
                    // Tap center of the element
                    tapX = Math.round(match.x + match.width / 2);
                    tapY = Math.round(match.y + match.height / 2);
                }
                catch (innerErr) {
                    return `Error finding element: ${innerErr instanceof Error ? innerErr.message : String(innerErr)}`;
                }
            }
            else if (args.x !== undefined && args.y !== undefined) {
                tapX = Number(args.x);
                tapY = Number(args.y);
                if (isNaN(tapX) || isNaN(tapY)) {
                    return 'Error: x and y must be numbers';
                }
            }
            else {
                return 'Error: Provide either label (accessibility label) or x + y (coordinates)';
            }
            try {
                if (args.long_press) {
                    const duration = args.long_press_duration ? Number(args.long_press_duration) : undefined;
                    return await client.longPress(tapX, tapY, duration);
                }
                if (args.double_tap) {
                    return await client.doubleTap(tapX, tapY);
                }
                return await client.tap(tapX, tapY);
            }
            catch (tapErr) {
                return `Error tapping: ${tapErr instanceof Error ? tapErr.message : String(tapErr)}`;
            }
        },
    });
    // ── mobile_swipe ───────────────────────────────────────────────────
    registerTool({
        name: 'mobile_swipe',
        description: 'Perform a swipe gesture on the connected mobile device. ' +
            'Specify direction and optionally starting coordinates and distance.',
        parameters: {
            direction: {
                type: 'string',
                description: 'Swipe direction: "up", "down", "left", or "right"',
                required: true,
            },
            x: {
                type: 'number',
                description: 'Starting X coordinate (optional — defaults to screen center)',
            },
            y: {
                type: 'number',
                description: 'Starting Y coordinate (optional — defaults to screen center)',
            },
            distance: {
                type: 'number',
                description: 'Swipe distance in pixels (optional — defaults to reasonable default)',
            },
        },
        tier: 'free',
        async execute(args) {
            const err = ensureConnected();
            if (err)
                return err;
            const direction = String(args.direction).toLowerCase();
            if (!['up', 'down', 'left', 'right'].includes(direction)) {
                return 'Error: direction must be "up", "down", "left", or "right"';
            }
            try {
                const client = getClient();
                return await client.swipe(direction, {
                    x: args.x !== undefined ? Number(args.x) : undefined,
                    y: args.y !== undefined ? Number(args.y) : undefined,
                    distance: args.distance !== undefined ? Number(args.distance) : undefined,
                });
            }
            catch (swipeErr) {
                return `Error swiping: ${swipeErr instanceof Error ? swipeErr.message : String(swipeErr)}`;
            }
        },
    });
    // ── mobile_type ────────────────────────────────────────────────────
    registerTool({
        name: 'mobile_type',
        description: 'Type text into the currently focused input field on the connected mobile device. ' +
            'The field must already be focused (tap on it first with mobile_tap). ' +
            'Optionally submit the input (press Enter/Return after typing).',
        parameters: {
            text: {
                type: 'string',
                description: 'The text to type',
                required: true,
            },
            submit: {
                type: 'boolean',
                description: 'If true, press Enter/Return after typing (default: false)',
            },
        },
        tier: 'free',
        async execute(args) {
            const err = ensureConnected();
            if (err)
                return err;
            const text = String(args.text);
            if (!text)
                return 'Error: text is required';
            try {
                const client = getClient();
                return await client.typeText(text, Boolean(args.submit));
            }
            catch (typeErr) {
                return `Error typing: ${typeErr instanceof Error ? typeErr.message : String(typeErr)}`;
            }
        },
    });
    // ── mobile_launch ──────────────────────────────────────────────────
    registerTool({
        name: 'mobile_launch',
        description: 'Launch an app on the connected mobile device by bundle ID or package name. ' +
            'Examples: "com.apple.mobilesafari" (Safari), "com.apple.Preferences" (Settings), ' +
            '"com.apple.MobileSMS" (Messages). Use mobile_app_list to find bundle IDs.',
        parameters: {
            app: {
                type: 'string',
                description: 'App bundle ID (iOS, e.g., "com.apple.mobilesafari") or ' +
                    'package name (Android, e.g., "com.android.chrome")',
                required: true,
            },
        },
        tier: 'free',
        async execute(args) {
            const err = ensureConnected();
            if (err)
                return err;
            const app = String(args.app);
            if (!app)
                return 'Error: app (bundle ID or package name) is required';
            try {
                const client = getClient();
                return await client.launchApp(app);
            }
            catch (launchErr) {
                return `Error launching app: ${launchErr instanceof Error ? launchErr.message : String(launchErr)}`;
            }
        },
    });
    // ── mobile_elements ────────────────────────────────────────────────
    registerTool({
        name: 'mobile_elements',
        description: 'List all visible UI elements on the connected mobile device screen. ' +
            'Returns each element\'s accessibility label, type (Button, TextField, StaticText, etc.), ' +
            'identifier, text content, and screen coordinates. ' +
            'This is the key advantage over screenshot-based automation — deterministic element targeting. ' +
            'Use this to find elements before tapping them with mobile_tap.',
        parameters: {
            filter: {
                type: 'string',
                description: 'Optional text filter — only return elements matching this text in their label, text, identifier, or type (case-insensitive)',
            },
        },
        tier: 'free',
        maxResultSize: 100_000, // Element trees can be large
        async execute(args) {
            const err = ensureConnected();
            if (err)
                return err;
            try {
                const client = getClient();
                const elementsText = await client.listElements();
                if (!args.filter)
                    return elementsText;
                // Apply filter
                const filter = String(args.filter).toLowerCase();
                try {
                    const elements = JSON.parse(elementsText);
                    const filtered = elements.filter(e => {
                        const fields = [e.type, e.label, e.text, e.identifier, e.name, e.value].filter(Boolean);
                        return fields.some(f => f.toLowerCase().includes(filter));
                    });
                    if (filtered.length === 0) {
                        return `No elements matching "${args.filter}" found on screen. Use mobile_elements without filter to see all elements.`;
                    }
                    return JSON.stringify(filtered, null, 2);
                }
                catch {
                    // If not JSON, do text-based filtering
                    return elementsText;
                }
            }
            catch (elemErr) {
                return `Error listing elements: ${elemErr instanceof Error ? elemErr.message : String(elemErr)}`;
            }
        },
    });
    // ── mobile_back ────────────────────────────────────────────────────
    registerTool({
        name: 'mobile_back',
        description: 'Press the back button / navigate back on the connected mobile device. ' +
            'On Android this presses the BACK button. On iOS this performs a back swipe gesture ' +
            '(swipe from left edge to right).',
        parameters: {},
        tier: 'free',
        async execute() {
            const err = ensureConnected();
            if (err)
                return err;
            try {
                const client = getClient();
                // Try BACK button first (works on Android, may work on iOS via mobile-mcp)
                try {
                    return await client.pressButton('BACK');
                }
                catch {
                    // Fallback for iOS: swipe from left edge to go back
                    return await client.swipe('right', { x: 10, y: 400 });
                }
            }
            catch (backErr) {
                return `Error pressing back: ${backErr instanceof Error ? backErr.message : String(backErr)}`;
            }
        },
    });
    // ── mobile_home ────────────────────────────────────────────────────
    registerTool({
        name: 'mobile_home',
        description: 'Press the home button / go to home screen on the connected mobile device. ' +
            'On Android this presses the HOME button. On iOS this presses HOME ' +
            '(simulates the home gesture on Face ID devices).',
        parameters: {},
        tier: 'free',
        async execute() {
            const err = ensureConnected();
            if (err)
                return err;
            try {
                const client = getClient();
                return await client.pressButton('HOME');
            }
            catch (homeErr) {
                return `Error pressing home: ${homeErr instanceof Error ? homeErr.message : String(homeErr)}`;
            }
        },
    });
    // ── mobile_app_list ────────────────────────────────────────────────
    registerTool({
        name: 'mobile_app_list',
        description: 'List all installed apps on the connected mobile device. ' +
            'Returns app names and bundle IDs (iOS) or package names (Android). ' +
            'Use the bundle ID with mobile_launch to open an app.',
        parameters: {},
        tier: 'free',
        maxResultSize: 100_000, // App lists can be long
        async execute() {
            const err = ensureConnected();
            if (err)
                return err;
            try {
                const client = getClient();
                return await client.listApps();
            }
            catch (listErr) {
                return `Error listing apps: ${listErr instanceof Error ? listErr.message : String(listErr)}`;
            }
        },
    });
    // ── mobile_open_url ────────────────────────────────────────────────
    registerTool({
        name: 'mobile_open_url',
        description: 'Open a URL in the default browser on the connected mobile device. ' +
            'The URL must start with http:// or https://.',
        parameters: {
            url: {
                type: 'string',
                description: 'The URL to open (must start with http:// or https://)',
                required: true,
            },
        },
        tier: 'free',
        async execute(args) {
            const err = ensureConnected();
            if (err)
                return err;
            const url = String(args.url);
            if (!/^https?:\/\//i.test(url)) {
                return 'Error: URL must start with http:// or https://';
            }
            try {
                const client = getClient();
                return await client.openUrl(url);
            }
            catch (urlErr) {
                return `Error opening URL: ${urlErr instanceof Error ? urlErr.message : String(urlErr)}`;
            }
        },
    });
    // ── mobile_disconnect ──────────────────────────────────────────────
    registerTool({
        name: 'mobile_disconnect',
        description: 'Disconnect from the mobile device and shut down the mobile-mcp server. ' +
            'Call when done with mobile automation to free resources.',
        parameters: {},
        tier: 'free',
        async execute() {
            const client = getClient();
            if (!client.isConnected) {
                return 'Not connected to any mobile device.';
            }
            client.stop();
            return 'Disconnected from mobile device. mobile-mcp server stopped.';
        },
    });
    // ── mobile_terminate_app ───────────────────────────────────────────
    registerTool({
        name: 'mobile_terminate_app',
        description: 'Force-stop a running app on the connected mobile device.',
        parameters: {
            app: {
                type: 'string',
                description: 'App bundle ID (iOS) or package name (Android) to terminate',
                required: true,
            },
        },
        tier: 'free',
        async execute(args) {
            const err = ensureConnected();
            if (err)
                return err;
            const app = String(args.app);
            if (!app)
                return 'Error: app (bundle ID or package name) is required';
            try {
                const client = getClient();
                return await client.terminateApp(app);
            }
            catch (termErr) {
                return `Error terminating app: ${termErr instanceof Error ? termErr.message : String(termErr)}`;
            }
        },
    });
}
//# sourceMappingURL=mobile-automation.js.map