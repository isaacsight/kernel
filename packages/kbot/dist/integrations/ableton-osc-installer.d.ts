/**
 * ableton-osc-installer.ts — Install and patch AbletonOSC for kbot control
 *
 * Installs AbletonOSC remote script into Ableton's User Library,
 * patches it with kbot extensions (device loading, Python exec),
 * and provides setup instructions.
 *
 * Usage: kbot ableton setup
 */
export declare function installAbletonOSC(): Promise<string>;
export declare function isAbletonOSCInstalled(): boolean;
export declare function isKbotPatched(): boolean;
//# sourceMappingURL=ableton-osc-installer.d.ts.map