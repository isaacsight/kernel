import type { ChannelAdapter } from './types.js';
export declare function getChannel(name: string): ChannelAdapter;
export declare function listChannels(): Array<{
    name: string;
    configured: boolean;
}>;
export declare function registerChannel(adapter: ChannelAdapter): void;
//# sourceMappingURL=registry.d.ts.map