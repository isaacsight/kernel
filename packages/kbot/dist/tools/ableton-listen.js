// ableton_listen — subscribe to real-time LOM events via kbot-control.
//
// AbletonOSC has no listener API. kbot-control implements listeners using
// native Max LiveAPI property callbacks, streamed over the TCP JSON-RPC
// connection as "notify" messages. This tool exposes that capability to
// the agent so it can subscribe to beat, playing_position, parameter
// changes, etc., and pull a buffered history for inspection.
import { registerTool } from './index.js';
import { KbotControlClient } from '../integrations/kbot-control-client.js';
// Per-path ring buffer of recent events so the agent can poll history.
const MAX_PER_PATH = 100;
const history = new Map();
const subscriptions = new Map();
function recordEvent(path, value) {
    let buf = history.get(path);
    if (!buf) {
        buf = [];
        history.set(path, buf);
    }
    buf.push({ path, value, at: Date.now() });
    if (buf.length > MAX_PER_PATH)
        buf.shift();
}
export function registerAbletonListenTool() {
    registerTool({
        name: 'ableton_listen',
        description: 'Subscribe to real-time Ableton events via kbot-control.amxd. ' +
            'Subscriptions stream over the persistent TCP connection and the tool buffers the last 100 events per path. ' +
            'Use action="subscribe" with a LOM-ish path (e.g. "song.is_playing", "song.tempo", "tracks[0].output_meter_left"), ' +
            'then action="history" to pull what came in. action="list" shows active subscriptions. ' +
            'Requires kbot-control.amxd loaded in Ableton.',
        parameters: {
            action: {
                type: 'string',
                description: '"subscribe" | "unsubscribe" | "list" | "history" | "clear"',
                required: true,
            },
            path: {
                type: 'string',
                description: 'LOM path for subscribe/unsubscribe/history. Examples: "song.is_playing", "song.tempo", "song.current_song_time", "tracks[0].mute".',
            },
            limit: {
                type: 'number',
                description: 'For "history": max events to return (default 25).',
            },
        },
        tier: 'free',
        timeout: 15_000,
        async execute(args) {
            const action = String(args.action || '').toLowerCase();
            const path = args.path !== undefined ? String(args.path) : '';
            try {
                switch (action) {
                    case 'subscribe': {
                        if (!path)
                            return 'Error: subscribe needs a path.';
                        if (subscriptions.has(path))
                            return `Already subscribed to ${path}`;
                        const handler = (value) => recordEvent(path, value);
                        await KbotControlClient.get().subscribe(path, handler);
                        subscriptions.set(path, handler);
                        return `Subscribed to \`${path}\`. Events will be recorded; call action="history" to pull them.`;
                    }
                    case 'unsubscribe': {
                        if (!path)
                            return 'Error: unsubscribe needs a path.';
                        const handler = subscriptions.get(path);
                        if (!handler)
                            return `Not subscribed to ${path}`;
                        await KbotControlClient.get().unsubscribe(path, handler);
                        subscriptions.delete(path);
                        return `Unsubscribed from ${path}`;
                    }
                    case 'list': {
                        if (subscriptions.size === 0)
                            return 'No active subscriptions.';
                        const lines = ['## Active subscriptions', ''];
                        for (const p of subscriptions.keys()) {
                            const buf = history.get(p);
                            lines.push(`- \`${p}\` — ${buf ? buf.length : 0} events buffered`);
                        }
                        return lines.join('\n');
                    }
                    case 'history': {
                        if (!path) {
                            // Return summary of all paths
                            if (history.size === 0)
                                return 'No events recorded yet.';
                            const lines = ['## Event history summary', ''];
                            for (const [p, buf] of history.entries()) {
                                const last = buf[buf.length - 1];
                                lines.push(`- \`${p}\`: ${buf.length} events, last value = ${JSON.stringify(last?.value)}`);
                            }
                            return lines.join('\n');
                        }
                        const buf = history.get(path);
                        if (!buf || buf.length === 0)
                            return `No events recorded for \`${path}\`.`;
                        const limit = Number(args.limit) || 25;
                        const recent = buf.slice(-limit);
                        const lines = [`## \`${path}\` — last ${recent.length} events`, ''];
                        for (const ev of recent) {
                            const dt = new Date(ev.at).toISOString().slice(11, 23);
                            lines.push(`- ${dt} → ${JSON.stringify(ev.value)}`);
                        }
                        return lines.join('\n');
                    }
                    case 'clear': {
                        if (path) {
                            history.delete(path);
                            return `Cleared history for ${path}`;
                        }
                        history.clear();
                        return 'Cleared all history';
                    }
                    default:
                        return `Unknown action "${action}". Options: subscribe, unsubscribe, list, history, clear`;
                }
            }
            catch (e) {
                return `ableton_listen error: ${e.message}`;
            }
        },
    });
}
//# sourceMappingURL=ableton-listen.js.map