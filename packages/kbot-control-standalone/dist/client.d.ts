/**
 * kbot-control-client — TCP client for kbot-control.amxd
 *
 * Singleton client that connects to the kbot-control Max for Live device
 * at 127.0.0.1:9000. Newline-delimited JSON-RPC 2.0 over plain TCP.
 * Zero npm dependencies — uses node:net only.
 */
export interface RpcRequest {
    jsonrpc: '2.0';
    id: number;
    method: string;
    params?: Record<string, unknown>;
}
export interface RpcResponse<T = unknown> {
    jsonrpc: '2.0';
    id: number | null;
    result?: T;
    error?: {
        code: number;
        message: string;
    };
}
export type Listener = (value: unknown) => void;
export declare class KbotControlClient {
    private static instance;
    private socket;
    private connected;
    private buffer;
    private pending;
    private listeners;
    private nextId;
    private connectAttempt;
    static HOST: string;
    static PORT: number;
    static TIMEOUT: number;
    static CONNECT_TIMEOUT: number;
    private constructor();
    static get(): KbotControlClient;
    /** Test-only: tear down singleton so tests can start fresh. */
    static _resetForTests(): void;
    connect(): Promise<void>;
    private handleData;
    private handleMessage;
    call<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
    subscribe(path: string, fn: Listener): Promise<void>;
    unsubscribe(path: string, fn: Listener): Promise<void>;
    private pollers;
    private startPolling;
    private stopPolling;
    disconnect(): void;
    get isConnected(): boolean;
}
/**
 * Convenience: connect + call + return result.
 * Throws if kbot-control.amxd isn't loaded in Ableton.
 */
export declare function kc<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
//# sourceMappingURL=client.d.ts.map