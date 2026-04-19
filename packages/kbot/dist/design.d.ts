export interface DesignOptions {
    /** The design brief — what to build */
    brief: string;
    /** Output file path (default: ./design-output/<slug>.html) */
    out?: string;
    /** Kind of artifact: 'deck' | 'page' | 'prototype' | 'one-pager' */
    kind?: 'deck' | 'page' | 'prototype' | 'one-pager';
    /** Also render to PDF via Playwright */
    pdf?: boolean;
    /** Open in browser after generation */
    open?: boolean;
}
/**
 * Discover the repo's design tokens by scanning common CSS / config files.
 * Returns a deduplicated string block the agent can reference.
 */
export declare function extractDesignTokens(projectRoot: string): string;
/** Build the prompt that the aesthete specialist will receive. */
export declare function buildDesignPrompt(opts: DesignOptions, tokens: string): string;
/** Run the design command. Returns the output file path. */
export declare function runDesign(opts: DesignOptions, projectRoot?: string): Promise<string>;
//# sourceMappingURL=design.d.ts.map