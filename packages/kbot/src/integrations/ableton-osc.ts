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

import * as dgram from 'node:dgram';
import { Buffer } from 'node:buffer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OscArg =
  | { type: 'i'; value: number }
  | { type: 'f'; value: number }
  | { type: 's'; value: string }
  | { type: 'b'; value: Buffer };

export interface OscMessage {
  address: string;
  args: OscArg[];
}

type PendingQuery = {
  resolve: (args: OscArg[]) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

type MessageHandler = (args: OscArg[]) => void;

// ---------------------------------------------------------------------------
// OSC Binary Protocol — Encoding
// ---------------------------------------------------------------------------

/**
 * Encode a string as an OSC string: null-terminated, padded to 4-byte boundary.
 */
export function encodeOscString(str: string): Buffer {
  const strBytes = Buffer.from(str, 'utf-8');
  // Need at least one null terminator, then pad to 4-byte boundary
  const padded = 4 - ((strBytes.length + 1) % 4);
  const totalNulls = padded === 4 ? 1 : padded + 1;
  const buf = Buffer.alloc(strBytes.length + totalNulls);
  strBytes.copy(buf, 0);
  // Remaining bytes are already 0x00 from Buffer.alloc
  return buf;
}

/**
 * Encode a blob as OSC blob: int32 size prefix + data + padding to 4-byte boundary.
 */
function encodeOscBlob(data: Buffer): Buffer {
  const padding = (4 - (data.length % 4)) % 4;
  const buf = Buffer.alloc(4 + data.length + padding);
  buf.writeInt32BE(data.length, 0);
  data.copy(buf, 4);
  return buf;
}

/**
 * Encode a complete OSC message: address + type tag string + argument data.
 */
export function encodeOscMessage(address: string, args: OscArg[]): Buffer {
  const addressBuf = encodeOscString(address);

  // Build type tag string: comma prefix + one char per arg
  const typeTag = ',' + args.map((a) => a.type).join('');
  const typeTagBuf = encodeOscString(typeTag);

  // Encode each argument
  const argBuffers: Buffer[] = [];
  for (const arg of args) {
    switch (arg.type) {
      case 'i': {
        const buf = Buffer.alloc(4);
        buf.writeInt32BE(arg.value, 0);
        argBuffers.push(buf);
        break;
      }
      case 'f': {
        const buf = Buffer.alloc(4);
        buf.writeFloatBE(arg.value, 0);
        argBuffers.push(buf);
        break;
      }
      case 's': {
        argBuffers.push(encodeOscString(arg.value));
        break;
      }
      case 'b': {
        argBuffers.push(encodeOscBlob(arg.value));
        break;
      }
    }
  }

  return Buffer.concat([addressBuf, typeTagBuf, ...argBuffers]);
}

// ---------------------------------------------------------------------------
// OSC Binary Protocol — Decoding
// ---------------------------------------------------------------------------

/**
 * Read a null-terminated, 4-byte-aligned string from a buffer at the given offset.
 * Returns the decoded string and the new offset after the padded string.
 */
function readOscString(buf: Buffer, offset: number): [string, number] {
  // Find the null terminator
  let end = offset;
  while (end < buf.length && buf[end] !== 0) {
    end++;
  }
  const str = buf.toString('utf-8', offset, end);
  // Advance past null terminator(s) to 4-byte boundary
  const totalLen = end - offset + 1; // includes one null
  const padded = totalLen + ((4 - (totalLen % 4)) % 4);
  return [str, offset + padded];
}

/**
 * Read an OSC blob from a buffer at the given offset.
 * Returns the blob data and the new offset.
 */
function readOscBlob(buf: Buffer, offset: number): [Buffer, number] {
  const size = buf.readInt32BE(offset);
  offset += 4;
  const data = buf.subarray(offset, offset + size);
  offset += size;
  const padding = (4 - (size % 4)) % 4;
  offset += padding;
  return [Buffer.from(data), offset];
}

/**
 * Decode a complete OSC message from a raw UDP buffer.
 */
export function decodeOscMessage(buf: Buffer): OscMessage {
  if (buf.length < 4) {
    throw new Error('OSC message too short');
  }

  let offset = 0;

  // Read address
  const [address, afterAddress] = readOscString(buf, offset);
  offset = afterAddress;

  if (!address.startsWith('/')) {
    throw new Error(`Invalid OSC address: ${address}`);
  }

  // Read type tag string (optional — some messages have no args)
  const args: OscArg[] = [];
  if (offset >= buf.length) {
    return { address, args };
  }

  // Check if there is a type tag string (starts with ',')
  if (buf[offset] !== 0x2c /* ',' */) {
    // No type tag string — return address only
    return { address, args };
  }

  const [typeTag, afterTypeTag] = readOscString(buf, offset);
  offset = afterTypeTag;

  // Parse each argument according to type tags (skip the leading comma)
  for (let i = 1; i < typeTag.length; i++) {
    const tag = typeTag[i];
    switch (tag) {
      case 'i': {
        if (offset + 4 > buf.length) throw new Error('OSC buffer underflow reading int32');
        const value = buf.readInt32BE(offset);
        offset += 4;
        args.push({ type: 'i', value });
        break;
      }
      case 'f': {
        if (offset + 4 > buf.length) throw new Error('OSC buffer underflow reading float32');
        const value = buf.readFloatBE(offset);
        offset += 4;
        args.push({ type: 'f', value });
        break;
      }
      case 's': {
        const [value, next] = readOscString(buf, offset);
        offset = next;
        args.push({ type: 's', value });
        break;
      }
      case 'b': {
        const [value, next] = readOscBlob(buf, offset);
        offset = next;
        args.push({ type: 'b', value });
        break;
      }
      case 'T': // OSC True — skip, no data bytes
      case 'F': // OSC False — skip, no data bytes
      case 'N': // OSC Nil — skip
        break;
      default:
        // Unknown type tag — we can't know the size, so stop parsing
        return { address, args };
    }
  }

  return { address, args };
}

// ---------------------------------------------------------------------------
// Convenience: auto-detect argument types
// ---------------------------------------------------------------------------

/**
 * Auto-detect OSC argument types from plain JS values.
 *
 * - Integers (no fractional part, safe integer range) become 'i'
 * - Other numbers become 'f'
 * - Strings become 's'
 */
export function oscArgs(...values: (number | string)[]): OscArg[] {
  return values.map((v): OscArg => {
    if (typeof v === 'string') {
      return { type: 's', value: v };
    }
    if (Number.isInteger(v) && Math.abs(v) <= 0x7fffffff) {
      return { type: 'i', value: v };
    }
    return { type: 'f', value: v };
  });
}

// ---------------------------------------------------------------------------
// AbletonOSC Client
// ---------------------------------------------------------------------------

export class AbletonOSC {
  private static instance: AbletonOSC | null = null;

  private sendSocket: dgram.Socket | null = null;
  private recvSocket: dgram.Socket | null = null;
  private connected = false;
  private pending = new Map<string, PendingQuery[]>();
  private listeners = new Map<string, Set<MessageHandler>>();
  private recvPort = 11001;
  private cleanupRegistered = false;

  static SEND_PORT = 11000;
  static RECV_PORT = 11001;
  static HOST = '127.0.0.1';
  static TIMEOUT = 3000;
  static MAX_PORT_RETRIES = 3;
  /** Safe UDP payload size — well under the 65507 byte UDP limit */
  static MAX_UDP_PAYLOAD = 8192;

  private constructor() {}

  /**
   * Get the singleton AbletonOSC instance.
   */
  static getInstance(): AbletonOSC {
    if (!AbletonOSC.instance) {
      AbletonOSC.instance = new AbletonOSC();
    }
    return AbletonOSC.instance;
  }

  /**
   * Connect to AbletonOSC. Creates UDP sockets, binds the receive socket,
   * and verifies Ableton is responding via /live/test.
   *
   * Returns true if Ableton responded, false on timeout.
   */
  async connect(): Promise<boolean> {
    if (this.connected && this.sendSocket && this.recvSocket) {
      // Already connected — verify with a quick test
      try {
        await this.query('/live/test');
        return true;
      } catch {
        // Connection stale, reconnect below
        this.closeSocketsSilently();
      }
    }

    this.closeSocketsSilently();

    // Create send socket (unbound — just for sending)
    this.sendSocket = dgram.createSocket('udp4');
    this.sendSocket.on('error', (err) => {
      // Send socket errors are non-fatal; queries will timeout
      if ((err as NodeJS.ErrnoException).code !== 'ERR_SOCKET_DGRAM_NOT_RUNNING') {
        // Silently ignore — will surface as query timeouts
      }
    });

    // Create receive socket with EADDRINUSE retry
    const bound = await this.bindRecvSocket();
    if (!bound) {
      this.closeSocketsSilently();
      return false;
    }

    // Register process cleanup (once)
    if (!this.cleanupRegistered) {
      this.cleanupRegistered = true;
      const cleanup = () => {
        try {
          this.disconnect();
        } catch {
          // Best-effort cleanup
        }
      };
      process.on('exit', cleanup);
      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
    }

    // Verify Ableton is alive
    try {
      await this.query('/live/test');
      this.connected = true;
      return true;
    } catch {
      this.closeSocketsSilently();
      return false;
    }
  }

  /**
   * Bind the receive socket with EADDRINUSE fallback.
   * Tries RECV_PORT, then RECV_PORT+1, RECV_PORT+2, etc.
   */
  private async bindRecvSocket(): Promise<boolean> {
    for (let attempt = 0; attempt < AbletonOSC.MAX_PORT_RETRIES; attempt++) {
      const port = AbletonOSC.RECV_PORT + attempt;
      try {
        await this.tryBindRecv(port);
        this.recvPort = port;
        return true;
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'EADDRINUSE') {
          // Port in use — try next one
          continue;
        }
        // Unexpected error — stop
        return false;
      }
    }
    return false;
  }

  private tryBindRecv(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = dgram.createSocket({ type: 'udp4', reuseAddr: false });

      const onError = (err: Error) => {
        socket.removeListener('listening', onListening);
        try {
          socket.close();
        } catch {
          // ignore
        }
        reject(err);
      };

      const onListening = () => {
        socket.removeListener('error', onError);
        // Set up message handler
        socket.on('message', (msg: Buffer) => {
          this.handleMessage(msg);
        });
        socket.on('error', () => {
          // Runtime errors after successful bind — mark disconnected
          this.connected = false;
        });
        this.recvSocket = socket;
        resolve();
      };

      socket.once('error', onError);
      socket.once('listening', onListening);
      socket.bind(port, AbletonOSC.HOST);
    });
  }

  /**
   * Close sockets without throwing.
   */
  private closeSocketsSilently(): void {
    this.connected = false;
    if (this.sendSocket) {
      try {
        this.sendSocket.close();
      } catch {
        // ignore
      }
      this.sendSocket = null;
    }
    if (this.recvSocket) {
      try {
        this.recvSocket.close();
      } catch {
        // ignore
      }
      this.recvSocket = null;
    }
    // Reject all pending queries
    for (const queue of this.pending.values()) {
      for (const p of queue) {
        clearTimeout(p.timer);
        p.reject(new Error('AbletonOSC: connection closed'));
      }
    }
    this.pending.clear();
  }

  /**
   * Disconnect from AbletonOSC. Closes both sockets and clears all state.
   */
  disconnect(): void {
    this.closeSocketsSilently();
    this.listeners.clear();
  }

  /**
   * Check if currently connected to Ableton.
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Fire-and-forget: send an OSC message to Ableton.
   */
  send(address: string, ...args: (number | string)[]): void {
    if (!this.sendSocket) {
      throw new Error('AbletonOSC: not connected. Call connect() first.');
    }
    const msg = encodeOscMessage(address, oscArgs(...args));
    this.sendRaw(msg);
  }

  /**
   * Send a raw encoded OSC buffer. Handles chunking if needed.
   */
  private sendRaw(msg: Buffer): void {
    if (!this.sendSocket) return;
    // UDP has a hard limit of 65507 bytes. We stay well under.
    // If a message somehow exceeds our safe limit, send it anyway —
    // the OS will fragment or reject it, and we'll get a timeout on the query.
    this.sendSocket.send(msg, 0, msg.length, AbletonOSC.SEND_PORT, AbletonOSC.HOST, (err) => {
      if (err) {
        // Send errors surface as query timeouts; nothing to do here
      }
    });
  }

  /**
   * Send an OSC message and wait for a response on the same address.
   *
   * AbletonOSC convention: queries use addresses like /live/song/get/tempo
   * and the response arrives on the same address.
   *
   * Includes one auto-reconnect attempt on failure.
   */
  async query(address: string, ...args: (number | string)[]): Promise<OscArg[]> {
    try {
      return await this.queryOnce(address, ...args);
    } catch (err) {
      // If not connected or timed out, try one reconnect
      if (this.connected) {
        // Was connected but query failed — try reconnecting
        this.closeSocketsSilently();
        const reconnected = await this.connect();
        if (reconnected) {
          return await this.queryOnce(address, ...args);
        }
      }
      throw err;
    }
  }

  private queryOnce(address: string, ...args: (number | string)[]): Promise<OscArg[]> {
    return new Promise((resolve, reject) => {
      if (!this.sendSocket) {
        reject(new Error('AbletonOSC: not connected. Call connect() first.'));
        return;
      }

      const timer = setTimeout(() => {
        // Remove this specific pending entry
        this.removePending(address, entry);
        reject(new Error(`AbletonOSC: timeout waiting for response on ${address} (${AbletonOSC.TIMEOUT}ms)`));
      }, AbletonOSC.TIMEOUT);

      const entry: PendingQuery = { resolve, reject, timer };

      // Multiple queries to the same address are queued (FIFO)
      if (!this.pending.has(address)) {
        this.pending.set(address, []);
      }
      this.pending.get(address)!.push(entry);

      const msg = encodeOscMessage(address, oscArgs(...args));
      this.sendRaw(msg);
    });
  }

  private removePending(address: string, entry: PendingQuery): void {
    const queue = this.pending.get(address);
    if (!queue) return;
    const idx = queue.indexOf(entry);
    if (idx !== -1) {
      queue.splice(idx, 1);
    }
    if (queue.length === 0) {
      this.pending.delete(address);
    }
  }

  /**
   * Handle an incoming OSC message from Ableton.
   */
  private handleMessage(msg: Buffer): void {
    let decoded: OscMessage;
    try {
      decoded = decodeOscMessage(msg);
    } catch {
      // Malformed message — discard
      return;
    }

    const { address, args } = decoded;

    // Check if this resolves a pending query (FIFO order)
    const queue = this.pending.get(address);
    if (queue && queue.length > 0) {
      const entry = queue.shift()!;
      if (queue.length === 0) {
        this.pending.delete(address);
      }
      clearTimeout(entry.timer);
      entry.resolve(args);
      return;
    }

    // Otherwise dispatch to registered listeners
    const handlers = this.listeners.get(address);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(args);
        } catch {
          // Listener errors are swallowed — don't crash the transport
        }
      }
    }
  }

  /**
   * Register a listener for incoming OSC messages on a specific address.
   */
  on(address: string, handler: MessageHandler): void {
    if (!this.listeners.has(address)) {
      this.listeners.set(address, new Set());
    }
    this.listeners.get(address)!.add(handler);
  }

  /**
   * Remove a specific listener, or all listeners for an address.
   */
  off(address: string, handler?: MessageHandler): void {
    if (!handler) {
      this.listeners.delete(address);
      return;
    }
    const handlers = this.listeners.get(address);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(address);
      }
    }
  }

  /**
   * Send a batch of OSC messages. Useful for large MIDI note arrays.
   * Groups messages into UDP packets up to MAX_UDP_PAYLOAD bytes each.
   */
  sendBatch(messages: Array<{ address: string; args: (number | string)[] }>): void {
    if (!this.sendSocket) {
      throw new Error('AbletonOSC: not connected. Call connect() first.');
    }

    for (const { address, args } of messages) {
      const msg = encodeOscMessage(address, oscArgs(...args));
      this.sendRaw(msg);
    }
  }
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Get the AbletonOSC singleton, connecting if necessary.
 * Throws a clear, user-friendly error if Ableton is not responding.
 */
export async function ensureAbleton(): Promise<AbletonOSC> {
  const client = AbletonOSC.getInstance();

  if (client.isConnected()) {
    return client;
  }

  const ok = await client.connect();
  if (!ok) {
    throw new Error(formatAbletonError());
  }

  return client;
}

/**
 * Return a user-friendly error message when Ableton is not reachable.
 */
export function formatAbletonError(): string {
  return [
    'Could not connect to Ableton Live via AbletonOSC.',
    '',
    'To use Ableton integration, you need:',
    '',
    '  1. Ableton Live running on this machine',
    '  2. AbletonOSC installed as a Remote Script',
    '     https://github.com/ideoforms/AbletonOSC',
    '',
    'Setup:',
    '  - Download AbletonOSC from the GitHub releases page',
    '  - Copy the AbletonOSC folder to:',
    '      macOS: /Users/YOU/Music/Ableton/User Library/Remote Scripts/',
    '      Win:   \\Users\\YOU\\Documents\\Ableton\\User Library\\Remote Scripts\\',
    '  - In Ableton Live, go to Preferences > Link, Tempo & MIDI',
    '  - Under Control Surface, select "AbletonOSC"',
    '  - AbletonOSC listens on UDP 11000 and replies on UDP 11001',
    '',
    'Troubleshooting:',
    '  - Make sure Ableton Live is open and a project is loaded',
    '  - Check that no other process is using ports 11000/11001',
    '  - Try restarting the AbletonOSC control surface in Preferences',
  ].join('\n');
}
