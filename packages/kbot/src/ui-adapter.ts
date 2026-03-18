// kbot UIAdapter — Decouples agent output from terminal
// CLI creates TerminalUIAdapter, SDK creates SilentAdapter or custom
//
// This abstraction allows kbot to be used as a library without any
// terminal dependencies leaking into consuming applications.

import {
  createSpinner, printToolCall, printToolResult,
  printError, printSuccess, printInfo, printWarn,
} from './ui.js'

// ── UIAdapter interface ──

export interface UIAdapter {
  onToolCallStart(toolName: string, args: Record<string, any>): void
  onToolCallEnd(toolName: string, result: string, error?: string, durationMs?: number): void
  onThinking(text: string): void
  onContent(text: string): void
  onContentEnd(): void
  onAgentRoute(agentId: string, method: string, confidence: number): void
  onError(message: string): void
  onSuccess(message: string): void
  onInfo(message: string): void
  onSpinnerStart(text: string): { stop: (finalText?: string) => void }
  onWarning(message: string): void
}

// ── Terminal adapter — wraps existing ui.ts functions ──

export class TerminalUIAdapter implements UIAdapter {
  onToolCallStart(toolName: string, args: Record<string, any>): void {
    printToolCall(toolName, args)
  }

  onToolCallEnd(_toolName: string, result: string, error?: string): void {
    printToolResult(result, !!error)
  }

  onThinking(text: string): void {
    process.stderr.write(`\x1b[2m\x1b[3m${text}\x1b[0m`)
  }

  onContent(text: string): void {
    process.stdout.write(text)
  }

  onContentEnd(): void {
    process.stdout.write('\n')
  }

  onAgentRoute(agentId: string, method: string, confidence: number): void {
    printInfo(`→ ${agentId} (${method}, ${(confidence * 100).toFixed(0)}%)`)
  }

  onError(message: string): void {
    printError(message)
  }

  onSuccess(message: string): void {
    printSuccess(message)
  }

  onInfo(message: string): void {
    printInfo(message)
  }

  onSpinnerStart(text: string): { stop: (finalText?: string) => void } {
    const spinner = createSpinner(text)
    spinner.start()
    return {
      stop: (finalText?: string) => {
        if (finalText) {
          spinner.succeed(finalText)
        } else {
          spinner.stop()
        }
      },
    }
  }

  onWarning(message: string): void {
    printWarn(message)
  }
}

// ── Silent adapter — captures output programmatically ──

export class SilentUIAdapter implements UIAdapter {
  public toolCalls: Array<{
    name: string
    args: any
    result?: string
    error?: string
    durationMs?: number
  }> = []
  public content: string = ''
  public errors: string[] = []
  public warnings: string[] = []

  onToolCallStart(name: string, args: any): void {
    this.toolCalls.push({ name, args })
  }

  onToolCallEnd(name: string, result: string, error?: string, durationMs?: number): void {
    const call = [...this.toolCalls].reverse().find((c: { name: string }) => c.name === name)
    if (call) {
      call.result = result
      call.error = error
      call.durationMs = durationMs
    }
  }

  onThinking(_text: string): void {
    // discard
  }

  onContent(text: string): void {
    this.content += text
  }

  onContentEnd(): void {
    // no-op
  }

  onAgentRoute(): void {
    // no-op
  }

  onError(msg: string): void {
    this.errors.push(msg)
  }

  onSuccess(_msg: string): void {
    // no-op
  }

  onInfo(_msg: string): void {
    // no-op
  }

  onSpinnerStart(_text: string): { stop: (finalText?: string) => void } {
    return { stop: () => {} }
  }

  onWarning(msg: string): void {
    this.warnings.push(msg)
  }
}

// ── Callback adapter — fires user-provided callbacks for each event ──

export class CallbackUIAdapter implements UIAdapter {
  constructor(private callbacks: Partial<UIAdapter> = {}) {}

  onToolCallStart(name: string, args: any): void {
    this.callbacks.onToolCallStart?.(name, args)
  }

  onToolCallEnd(name: string, result: string, error?: string, durationMs?: number): void {
    this.callbacks.onToolCallEnd?.(name, result, error, durationMs)
  }

  onThinking(text: string): void {
    this.callbacks.onThinking?.(text)
  }

  onContent(text: string): void {
    this.callbacks.onContent?.(text)
  }

  onContentEnd(): void {
    this.callbacks.onContentEnd?.()
  }

  onAgentRoute(id: string, method: string, confidence: number): void {
    this.callbacks.onAgentRoute?.(id, method, confidence)
  }

  onError(msg: string): void {
    this.callbacks.onError?.(msg)
  }

  onSuccess(msg: string): void {
    this.callbacks.onSuccess?.(msg)
  }

  onInfo(msg: string): void {
    this.callbacks.onInfo?.(msg)
  }

  onSpinnerStart(text: string): { stop: (finalText?: string) => void } {
    return this.callbacks.onSpinnerStart?.(text) ?? { stop: () => {} }
  }

  onWarning(msg: string): void {
    this.callbacks.onWarning?.(msg)
  }
}
