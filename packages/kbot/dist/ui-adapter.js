// kbot UIAdapter — Decouples agent output from terminal
// CLI creates TerminalUIAdapter, SDK creates SilentAdapter or custom
//
// This abstraction allows kbot to be used as a library without any
// terminal dependencies leaking into consuming applications.
import { createSpinner, printToolCall, printToolResult, printError, printSuccess, printInfo, printWarn, } from './ui.js';
// ── Terminal adapter — wraps existing ui.ts functions ──
export class TerminalUIAdapter {
    onToolCallStart(toolName, args) {
        printToolCall(toolName, args);
    }
    onToolCallEnd(_toolName, result, error) {
        printToolResult(result, !!error);
    }
    onThinking(text) {
        process.stderr.write(`\x1b[2m\x1b[3m${text}\x1b[0m`);
    }
    onContent(text) {
        process.stdout.write(text);
    }
    onContentEnd() {
        process.stdout.write('\n');
    }
    onAgentRoute(agentId, method, confidence) {
        printInfo(`→ ${agentId} (${method}, ${(confidence * 100).toFixed(0)}%)`);
    }
    onError(message) {
        printError(message);
    }
    onSuccess(message) {
        printSuccess(message);
    }
    onInfo(message) {
        printInfo(message);
    }
    onSpinnerStart(text) {
        const spinner = createSpinner(text);
        spinner.start();
        return {
            stop: (finalText) => {
                if (finalText) {
                    spinner.succeed(finalText);
                }
                else {
                    spinner.stop();
                }
            },
        };
    }
    onWarning(message) {
        printWarn(message);
    }
}
// ── Silent adapter — captures output programmatically ──
export class SilentUIAdapter {
    toolCalls = [];
    content = '';
    errors = [];
    warnings = [];
    onToolCallStart(name, args) {
        this.toolCalls.push({ name, args });
    }
    onToolCallEnd(name, result, error, durationMs) {
        const call = [...this.toolCalls].reverse().find((c) => c.name === name);
        if (call) {
            call.result = result;
            call.error = error;
            call.durationMs = durationMs;
        }
    }
    onThinking(_text) {
        // discard
    }
    onContent(text) {
        this.content += text;
    }
    onContentEnd() {
        // no-op
    }
    onAgentRoute() {
        // no-op
    }
    onError(msg) {
        this.errors.push(msg);
    }
    onSuccess(_msg) {
        // no-op
    }
    onInfo(_msg) {
        // no-op
    }
    onSpinnerStart(_text) {
        return { stop: () => { } };
    }
    onWarning(msg) {
        this.warnings.push(msg);
    }
}
// ── Callback adapter — fires user-provided callbacks for each event ──
export class CallbackUIAdapter {
    callbacks;
    constructor(callbacks = {}) {
        this.callbacks = callbacks;
    }
    onToolCallStart(name, args) {
        this.callbacks.onToolCallStart?.(name, args);
    }
    onToolCallEnd(name, result, error, durationMs) {
        this.callbacks.onToolCallEnd?.(name, result, error, durationMs);
    }
    onThinking(text) {
        this.callbacks.onThinking?.(text);
    }
    onContent(text) {
        this.callbacks.onContent?.(text);
    }
    onContentEnd() {
        this.callbacks.onContentEnd?.();
    }
    onAgentRoute(id, method, confidence) {
        this.callbacks.onAgentRoute?.(id, method, confidence);
    }
    onError(msg) {
        this.callbacks.onError?.(msg);
    }
    onSuccess(msg) {
        this.callbacks.onSuccess?.(msg);
    }
    onInfo(msg) {
        this.callbacks.onInfo?.(msg);
    }
    onSpinnerStart(text) {
        return this.callbacks.onSpinnerStart?.(text) ?? { stop: () => { } };
    }
    onWarning(msg) {
        this.callbacks.onWarning?.(msg);
    }
}
//# sourceMappingURL=ui-adapter.js.map