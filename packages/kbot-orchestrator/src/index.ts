// @kernel.chat/kbot-orchestrator
// Reference implementation of orchestration engineering.
//
// See ROLE.md for the discipline definition. The library exposes the
// outreach pipeline as a callable function; the CLI in cli.ts is the
// command-line entry point.

export {
  parseBriefing,
  pending,
  emailable,
  type Briefing,
  type Recipient,
} from './briefing.js'

export {
  GmailSender,
  type SenderConfig,
  type SendResult,
} from './send.js'

export {
  runOutreach,
  type OutreachRunOptions,
  type OutreachRunResult,
} from './outreach.js'

export { appendSendResults } from './log.js'
