// kbot-control tool — direct access to kbot-control.amxd.
//
// One tool exposing every method in packages/kbot/m4l/kbot-control/PROTOCOL.md.
// When kbot-control.amxd is loaded in Ableton, this supersedes most of the
// ableton_* tools (and extends them with operations OSC can't reach —
// view focus with scroll, listeners, arrangement clips, browser navigation).
import { registerTool } from './index.js';
import { KbotControlClient } from '../integrations/kbot-control-client.js';
export function registerKbotControlTools() {
    registerTool({
        name: 'kbot_control',
        description: 'Direct JSON-RPC pass-through to kbot-control.amxd (the Max for Live device at TCP 127.0.0.1:9000). ' +
            'Supersedes AbletonOSC + AbletonBridge + kbot-bridge. ' +
            'Namespaces: song.* track.* clip.* scene.* device.* view.* browser.* arrangement.* listen.* midi.* kbot.*. ' +
            'Call `kbot.heartbeat` first to verify the device is loaded. ' +
            'See packages/kbot/m4l/kbot-control/PROTOCOL.md for the full method list.',
        parameters: {
            method: {
                type: 'string',
                description: 'JSON-RPC method name (e.g. "song.tempo", "track.list", "view.focus_track", "device.load_by_name", "listen.subscribe").',
                required: true,
            },
            params: {
                type: 'string',
                description: 'JSON-encoded params object. Example: \'{"value":128}\' for song.tempo, \'{"index":2}\' for view.focus_track.',
            },
        },
        tier: 'free',
        timeout: 15_000,
        async execute(args) {
            const method = String(args.method || '').trim();
            if (!method)
                return 'Error: method is required.';
            let params;
            if (args.params !== undefined && args.params !== '') {
                try {
                    params = typeof args.params === 'string' ? JSON.parse(args.params) : args.params;
                }
                catch (e) {
                    return `Error: params is not valid JSON (${e.message}).`;
                }
            }
            try {
                const result = await KbotControlClient.get().call(method, params);
                if (result === null || result === undefined)
                    return `${method} → (no result)`;
                if (typeof result === 'string')
                    return `${method} → ${result}`;
                return `${method} →\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
            }
            catch (e) {
                const msg = e.message;
                if (msg.includes('is kbot-control.amxd loaded') || msg.includes('ECONNREFUSED')) {
                    return (`kbot-control.amxd is not loaded in Ableton.\n\n` +
                        `Fix: in Ableton, Browser → Audio Effects → Max Audio Effect → kbot-control → drag onto any track.\n` +
                        `Then the device's Node-for-Max server starts listening on TCP 127.0.0.1:9000.`);
                }
                return `kbot-control error on ${method}: ${msg}`;
            }
        },
    });
}
//# sourceMappingURL=kbot-control.js.map