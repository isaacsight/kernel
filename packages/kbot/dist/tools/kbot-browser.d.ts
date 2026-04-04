export interface KBotBrowser {
    tabs: BrowserTab[];
    activeTab: number;
    history: string[];
    bookmarks: string[];
    cookies: Map<string, string>;
    userAgent: string;
}
export interface BrowserTab {
    url: string;
    title: string;
    content: string;
    links: PageLink[];
    forms: PageForm[];
    status: 'loading' | 'loaded' | 'error';
    html: string;
    screenshot: string[];
    scrollY: number;
    loadedAt: number;
    error?: string;
}
export interface PageLink {
    text: string;
    url: string;
    index: number;
}
export interface PageForm {
    action: string;
    method: string;
    fields: Array<{
        name: string;
        type: string;
        value: string;
        placeholder: string;
    }>;
    index: number;
}
export declare function getBrowser(): KBotBrowser;
/** Reset browser state (for testing or cleanup) */
export declare function resetBrowser(): void;
/** Extract readable content from HTML (reader mode) */
export declare function extractReadableContent(html: string): string;
export declare function renderPageToAscii(tab: BrowserTab, width?: number, height?: number): string[];
/** Navigate the active tab (or create one) to a URL */
export declare function navigateTo(browser: KBotBrowser, url: string): Promise<BrowserTab>;
/** Click a link by index on the current page */
export declare function clickLink(browser: KBotBrowser, linkIndex: number): Promise<BrowserTab>;
/** Fill and submit a form by index */
export declare function fillForm(browser: KBotBrowser, formIndex: number, values: Record<string, string>): Promise<BrowserTab>;
/** Search the web via DuckDuckGo HTML (no JS needed) */
export declare function search(browser: KBotBrowser, query: string): Promise<BrowserTab>;
/** Scroll the current page */
export declare function scroll(browser: KBotBrowser, direction: 'up' | 'down'): BrowserTab | null;
/** Go back in history */
export declare function goBack(browser: KBotBrowser): Promise<BrowserTab | null>;
/** Open a new tab */
export declare function newTab(browser: KBotBrowser, url?: string): void;
/** Close a tab */
export declare function closeTab(browser: KBotBrowser, tabIndex: number): void;
/** Switch to a tab */
export declare function switchTab(browser: KBotBrowser, tabIndex: number): void;
/** Draw a browser panel on a canvas (for stream overlay) */
export declare function drawBrowserPanel(ctx: CanvasRenderingContext2D, browser: KBotBrowser, x: number, y: number, width: number, height: number, frame: number): void;
/** Parse stream chat commands for browser interaction. Returns action string or null. */
export declare function parseStreamBrowserCommand(message: string): {
    command: string;
    args: string;
} | null;
/** Handle a stream chat browser command. Returns a response string for the chat. */
export declare function handleStreamBrowserCommand(command: string, args: string): Promise<{
    response: string;
    mood?: string;
}>;
export declare function registerKBotBrowserTools(): void;
//# sourceMappingURL=kbot-browser.d.ts.map