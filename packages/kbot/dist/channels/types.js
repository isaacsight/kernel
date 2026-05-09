// Shared types for the unified messaging-channel adapter family.
//
// Inspired by OpenClaw (steipete/openclaw on npm). Every channel adapter
// (Slack, WhatsApp, Telegram, Signal, Matrix, Teams, ...) implements
// the same `ChannelAdapter` interface so kbot tools and agents can
// send/receive messages without caring which platform they target.
export class ChannelNotImplementedError extends Error {
    constructor(adapter) {
        super(`${adapter} adapter not implemented yet — see TODO in channels/${adapter}.ts`);
        this.name = 'ChannelNotImplementedError';
    }
}
//# sourceMappingURL=types.js.map