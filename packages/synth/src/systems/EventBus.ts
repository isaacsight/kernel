// SYNTH — Typed Event Bus

type EventCallback = (...args: unknown[]) => void

export class EventBus {
  private listeners = new Map<string, EventCallback[]>()

  on(event: string, callback: EventCallback): void {
    const list = this.listeners.get(event) ?? []
    list.push(callback)
    this.listeners.set(event, list)
  }

  off(event: string, callback: EventCallback): void {
    const list = this.listeners.get(event)
    if (!list) return
    this.listeners.set(event, list.filter(cb => cb !== callback))
  }

  emit(event: string, ...args: unknown[]): void {
    const list = this.listeners.get(event)
    if (!list) return
    for (const cb of list) cb(...args)
  }

  clear(): void {
    this.listeners.clear()
  }
}

export const eventBus = new EventBus()
