// Peekaboo adapter — public surface.
//
// Wraps the `peekaboo` macOS CLI behind a typed interface so kbot tools and
// agents can drive the screen-capture + GUI-automation features without
// taking a runtime dependency on the binary or the @steipete/peekaboo
// distribution. All execution flows through `runPeekaboo`.

export type {
  PeekabooElement,
  PeekabooSeeResult,
  PeekabooClickResult,
  PeekabooTypeResult,
  PeekabooSetValueResult,
  PeekabooPerformActionResult,
  PeekabooAgentResult,
  PeekabooError,
  PeekabooOutcome,
} from './types.js'

export { runPeekaboo, peekabooAvailable, type RunOptions, type RunResult } from './runner.js'

export {
  see,
  click,
  type_,
  setValue,
  performAction,
  agent,
  type SeeOptions,
  type ClickOptions,
  type TypeOptions,
  type SetValueOptions,
  type PerformActionOptions,
  type AgentOptions,
} from './commands.js'
