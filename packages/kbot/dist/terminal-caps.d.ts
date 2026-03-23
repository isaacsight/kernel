export interface TerminalCapabilities {
    truecolor: boolean;
    color256: boolean;
    basicColor: boolean;
    sixel: boolean;
    kittyGraphics: boolean;
    iterm2Images: boolean;
    unicode: boolean;
    braille: boolean;
    syncOutput: boolean;
    program: string;
    columns: number;
    rows: number;
}
export declare function detectTerminalCapabilities(): TerminalCapabilities;
export declare function withSyncOutput(fn: () => void): void;
export declare function rgb(r: number, g: number, b: number): string;
export declare function bgRgb(r: number, g: number, b: number): string;
export declare function gradient(text: string, startColor: [number, number, number], endColor: [number, number, number]): string;
//# sourceMappingURL=terminal-caps.d.ts.map