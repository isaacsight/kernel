/**
 * ableton-osc.ts — Zero-dependency OSC over UDP transport for AbletonOSC
 *
 * Implements OSC 1.0 binary protocol using only Node.js built-ins (dgram, buffer).
 * Communicates with https://github.com/ideoforms/AbletonOSC running inside Ableton Live.
 *
 * Default ports:
 *   Send to Ableton:     UDP 11000
 *   Receive from Ableton: UDP 11001
 */
import { Buffer } from 'node:buffer';
export type OscArg = {
    type: 'i';
    value: number;
} | {
    type: 'f';
    value: number;
} | {
    type: 's';
    value: string;
} | {
    type: 'b';
    value: Buffer;
};
export interface OscMessage {
    address: string;
    args: OscArg[];
}
type MessageHandler = (args: OscArg[]) => void;
/**
 * Encode a string as an OSC string: null-terminated, padded to 4-byte boundary.
 */
export declare function encodeOscString(str: string): Buffer;
/**
 * Encode a complete OSC message: address + type tag string + argument data.
 */
export declare function encodeOscMessage(address: string, args: OscArg[]): Buffer;
/**
 * Decode a complete OSC message from a raw UDP buffer.
 */
export declare function decodeOscMessage(buf: Buffer): OscMessage;
/**
 * Auto-detect OSC argument types from plain JS values.
 *
 * - Integers (no fractional part, safe integer range) become 'i'
 * - Other numbers become 'f'
 * - Strings become 's'
 */
export declare function oscArgs(...values: (number | string)[]): OscArg[];
export declare class AbletonOSC {
    private static instance;
    private sendSocket;
    private recvSocket;
    private connected;
    private pending;
    private listeners;
    private recvPort;
    private cleanupRegistered;
    static SEND_PORT: number;
    static RECV_PORT: number;
    static HOST: string;
    static TIMEOUT: number;
    static MAX_PORT_RETRIES: number;
    /** Safe UDP payload size — well under the 65507 byte UDP limit */
    static MAX_UDP_PAYLOAD: number;
    private constructor();
    /**
     * Get the singleton AbletonOSC instance.
     */
    static getInstance(): AbletonOSC;
    /**
     * Connect to AbletonOSC. Creates UDP sockets, binds the receive socket,
     * and verifies Ableton is responding via /live/test.
     *
     * Returns true if Ableton responded, false on timeout.
     */
    connect(): Promise<boolean>;
    /**
     * Bind the receive socket with EADDRINUSE fallback.
     * Tries RECV_PORT, then RECV_PORT+1, RECV_PORT+2, etc.
     */
    private bindRecvSocket;
    private tryBindRecv;
    /**
     * Close sockets without throwing.
     */
    private closeSocketsSilently;
    /**
     * Disconnect from AbletonOSC. Closes both sockets and clears all state.
     */
    disconnect(): void;
    /**
     * Check if currently connected to Ableton.
     */
    isConnected(): boolean;
    /**
     * Fire-and-forget: send an OSC message to Ableton.
     */
    send(address: string, ...args: (number | string)[]): void;
    /**
     * Send a raw encoded OSC buffer. Handles chunking if needed.
     */
    private sendRaw;
    /**
     * Send an OSC message and wait for a response on the same address.
     *
     * AbletonOSC convention: queries use addresses like /live/song/get/tempo
     * and the response arrives on the same address.
     *
     * Includes one auto-reconnect attempt on failure.
     */
    query(address: string, ...args: (number | string)[]): Promise<OscArg[]>;
    private queryOnce;
    private removePending;
    /**
     * Handle an incoming OSC message from Ableton.
     */
    private handleMessage;
    /**
     * Register a listener for incoming OSC messages on a specific address.
     */
    on(address: string, handler: MessageHandler): void;
    /**
     * Remove a specific listener, or all listeners for an address.
     */
    off(address: string, handler?: MessageHandler): void;
    /**
     * Send a batch of OSC messages. Useful for large MIDI note arrays.
     * Groups messages into UDP packets up to MAX_UDP_PAYLOAD bytes each.
     */
    sendBatch(messages: Array<{
        address: string;
        args: (number | string)[];
    }>): void;
}
/**
 * Get the AbletonOSC singleton, connecting if necessary.
 * Throws a clear, user-friendly error if Ableton is not responding.
 */
export declare function ensureAbleton(): Promise<AbletonOSC>;
/**
 * Return a user-friendly error message when Ableton is not reachable.
 */
export declare function formatAbletonError(): string;
export {};
//# sourceMappingURL=ableton-osc.d.ts.map