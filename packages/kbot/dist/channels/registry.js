// Registry for messaging channel adapters.
//
// Consumers should call `getChannel(name)` rather than importing adapters
// directly; this lets the registry be replaced or extended (e.g. a plugin
// registering an Instagram adapter at runtime).
import { slackAdapter } from './slack.js';
import { whatsappAdapter } from './whatsapp.js';
import { telegramAdapter } from './telegram.js';
import { signalAdapter } from './signal.js';
import { matrixAdapter } from './matrix.js';
import { teamsAdapter } from './teams.js';
import { officeAdapter } from './office.js';
const adapters = {
    slack: slackAdapter,
    whatsapp: whatsappAdapter,
    telegram: telegramAdapter,
    signal: signalAdapter,
    matrix: matrixAdapter,
    teams: teamsAdapter,
    office: officeAdapter,
};
export function getChannel(name) {
    const adapter = adapters[name.toLowerCase()];
    if (!adapter) {
        throw new Error(`Unknown channel "${name}". Available: ${Object.keys(adapters).join(', ')}`);
    }
    return adapter;
}
export function listChannels() {
    return Object.values(adapters).map((a) => ({
        name: a.name,
        configured: a.isConfigured(),
    }));
}
export function registerChannel(adapter) {
    adapters[adapter.name.toLowerCase()] = adapter;
}
//# sourceMappingURL=registry.js.map