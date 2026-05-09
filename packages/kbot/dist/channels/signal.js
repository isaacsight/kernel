// Signal channel adapter — STUB.
//
// TODO: Implement against signal-cli.
//   - Auth: SIGNAL_CLI_PATH env var pointing at the signal-cli binary.
//   - SIGNAL_ACCOUNT env var = the registered E.164 number.
//   - send → spawn `${SIGNAL_CLI_PATH} -a ${SIGNAL_ACCOUNT} send -m <text> <recipient>`
//     (or use signal-cli's JSON-RPC mode for long-running processes).
//   - receive → `signal-cli ... receive --json`, parse JSONL into
//     ChannelMessage records.
//   - listChannels → `signal-cli listGroups -d` for groups; contacts via
//     `listContacts` if needed.
import { ChannelNotImplementedError } from './types.js';
export const signalAdapter = {
    name: 'signal',
    isConfigured() {
        return Boolean(process.env.SIGNAL_CLI_PATH);
    },
    async send() {
        throw new ChannelNotImplementedError('signal');
    },
    async receive() {
        throw new ChannelNotImplementedError('signal');
    },
    async listChannels() {
        throw new ChannelNotImplementedError('signal');
    },
};
export default signalAdapter;
//# sourceMappingURL=signal.js.map