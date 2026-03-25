// SYNTH — Entity State Machine
// Replaces ad-hoc if/else chains with proper enter/update/exit state transitions.
// Design Bible §IV: "Every entity needs proper animation states, not just tweens."

export type StateCallback = () => void
export type StateUpdateCallback = (dt: number) => void

interface State {
  enter?: StateCallback
  update?: StateUpdateCallback
  exit?: StateCallback
}

export class StateMachine {
  private states = new Map<string, State>()
  private current = ''
  private previous = ''

  /** Register a named state with optional enter/update/exit hooks. */
  addState(name: string, state: State): this {
    this.states.set(name, state)
    return this
  }

  /**
   * Transition to a new state.
   * Calls exit() on the old state (if any), then enter() on the new state.
   * No-op if already in the requested state.
   */
  setState(name: string): void {
    if (name === this.current) return

    const oldState = this.states.get(this.current)
    if (oldState?.exit) {
      oldState.exit()
    }

    this.previous = this.current
    this.current = name

    const newState = this.states.get(this.current)
    if (newState?.enter) {
      newState.enter()
    }
  }

  /** Tick the current state's update callback. Call every frame. */
  update(dt: number): void {
    const state = this.states.get(this.current)
    if (state?.update) {
      state.update(dt)
    }
  }

  /** Name of the active state. */
  getState(): string {
    return this.current
  }

  /** Name of the state that was active before the last transition. */
  getPreviousState(): string {
    return this.previous
  }

  /** Check whether the machine is in a given state. */
  isState(name: string): boolean {
    return this.current === name
  }
}
