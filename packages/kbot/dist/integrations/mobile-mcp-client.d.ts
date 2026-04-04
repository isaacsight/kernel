/**
 * mobile-mcp-client.ts — kbot <-> mobile-mcp integration
 *
 * Singleton client that manages the mobile-mcp server process lifecycle.
 * Communicates via MCP protocol over stdio transport.
 * Auto-installs @mobilenext/mobile-mcp via npm if not present.
 *
 * mobile-mcp provides native accessibility-tree-based automation for
 * iOS and Android devices connected via USB or WiFi.
 *
 * @see https://github.com/mobile-next/mobile-mcp
 */
export interface MobileDevice {
    id: string;
    name: string;
    platform: 'ios' | 'android';
    type: 'real' | 'simulator' | 'emulator';
    version: string;
    state: 'online' | 'offline';
}
export interface MobileElement {
    type: string;
    text?: string;
    label?: string;
    name?: string;
    value?: string;
    identifier?: string;
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface MobileScreenSize {
    width: number;
    height: number;
}
export declare class MobileMCPClient {
    private static instance;
    private process;
    private messageId;
    private pending;
    private buffer;
    private initialized;
    private activeDeviceId;
    static getInstance(): MobileMCPClient;
    /** Whether the MCP server process is running and initialized */
    get isConnected(): boolean;
    /** The device ID currently being controlled */
    get currentDeviceId(): string | null;
    /** Start the mobile-mcp server process and perform MCP handshake */
    start(): Promise<void>;
    /** Stop the mobile-mcp server process */
    stop(): void;
    private parseMessages;
    private sendRequest;
    private sendNotification;
    /** Call a tool on the mobile-mcp server */
    callTool(toolName: string, args: Record<string, unknown>): Promise<unknown>;
    /** Extract text content from an MCP tool result */
    extractText(result: unknown): string;
    /** Extract image content (base64) from an MCP tool result */
    extractImage(result: unknown): {
        data: string;
        mimeType: string;
    } | null;
    /** List all available devices */
    listDevices(): Promise<MobileDevice[]>;
    /** Set the active device for subsequent operations */
    setActiveDevice(deviceId: string): void;
    /** Get the active device ID, throwing if none set */
    private requireDevice;
    /** List apps on the active device */
    listApps(deviceId?: string): Promise<string>;
    /** Launch an app by bundle ID */
    launchApp(packageName: string, deviceId?: string): Promise<string>;
    /** Take a screenshot, returns base64 image data */
    takeScreenshot(deviceId?: string): Promise<{
        data: string;
        mimeType: string;
    } | string>;
    /** Save screenshot to a file */
    saveScreenshot(saveTo: string, deviceId?: string): Promise<string>;
    /** List UI elements on screen via accessibility tree */
    listElements(deviceId?: string): Promise<string>;
    /** Tap at coordinates */
    tap(x: number, y: number, deviceId?: string): Promise<string>;
    /** Swipe on screen */
    swipe(direction: 'up' | 'down' | 'left' | 'right', opts?: {
        x?: number;
        y?: number;
        distance?: number;
        deviceId?: string;
    }): Promise<string>;
    /** Type text */
    typeText(text: string, submit?: boolean, deviceId?: string): Promise<string>;
    /** Press a device button */
    pressButton(button: 'HOME' | 'BACK' | 'VOLUME_UP' | 'VOLUME_DOWN' | 'ENTER', deviceId?: string): Promise<string>;
    /** Get screen size */
    getScreenSize(deviceId?: string): Promise<string>;
    /** Open a URL in the device browser */
    openUrl(url: string, deviceId?: string): Promise<string>;
    /** Get device orientation */
    getOrientation(deviceId?: string): Promise<string>;
    /** Terminate an app */
    terminateApp(packageName: string, deviceId?: string): Promise<string>;
    /** Double tap at coordinates */
    doubleTap(x: number, y: number, deviceId?: string): Promise<string>;
    /** Long press at coordinates */
    longPress(x: number, y: number, duration?: number, deviceId?: string): Promise<string>;
}
//# sourceMappingURL=mobile-mcp-client.d.ts.map