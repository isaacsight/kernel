// Parse outreach briefing markdown files.
//
// A briefing is a markdown document with one or more recipient blocks. Each
// block has a header line naming the recipient, an address line, a subject
// line, and a fenced body block. The format is the one we've been using by
// hand in .claude/OUTREACH_*.md files; this parser codifies it so an agent
// can act on the same files a human reads.

export interface Recipient {
  /** 1-based index within the briefing */
  index: number
  /** Free-text name from the header line */
  name: string
  /** Tier label if present (Tier 1 / Tier 2 / Tier 3 / etc.) */
  tier?: string
  /** Email address from the `**To:**` line */
  to: string
  /** Subject line from the `**Subject:**` line */
  subject: string
  /** Body text from the fenced block */
  body: string
  /** Optional channel note (LinkedIn DM, Bluesky DM, etc.) if email isn't the channel */
  channel?: string
  /** Already-sent indicator: present if the briefing has a `**Sent:**` line filled */
  sentAt?: string
  /** Already-sent indicator: msgid recorded */
  msgid?: string
}

export interface Briefing {
  /** Source path the briefing was read from */
  source: string
  /** All recipients in document order */
  recipients: Recipient[]
}

const RECIPIENT_HEADER = /^###\s*(\d+)\s*\/\s*(.+?)\s*$/m
const TIER_HEADER = /^##\s*(TIER\s+\d+.*?)$/im
const TO_LINE = /^\*\*To:\*\*\s*`?([^`\s]+@[^`\s]+)`?/m
const SUBJECT_LINE = /^\*\*Subject:\*\*\s*(.+?)$/m
const CHANNEL_LINE = /^\*\*Channel:\*\*\s*(.+?)$/m
const SENT_LINE = /^\*\*Sent:\*\*\s*([^\s]+)/m
const MSGID_LINE = /^\*\*msgid:\*\*\s*`?<?([^`>\s]+)>?`?/m
const FENCED_BODY = /```(?:\w+)?\s*\n([\s\S]*?)```/m

export function parseBriefing(source: string, text: string): Briefing {
  const blocks = splitOnHeaders(text)
  const recipients: Recipient[] = []
  let currentTier: string | undefined

  for (const block of blocks) {
    const tierMatch = block.match(TIER_HEADER)
    if (tierMatch && tierMatch[1]) {
      currentTier = tierMatch[1].trim()
      continue
    }

    const header = block.match(RECIPIENT_HEADER)
    if (!header) continue

    const index = Number(header[1])
    const name = (header[2] ?? '').trim()
    const toMatch = block.match(TO_LINE)
    const subjectMatch = block.match(SUBJECT_LINE)
    const bodyMatch = block.match(FENCED_BODY)
    const channelMatch = block.match(CHANNEL_LINE)
    const sentMatch = block.match(SENT_LINE)
    const msgidMatch = block.match(MSGID_LINE)

    if (!toMatch || !subjectMatch || !bodyMatch) {
      // Skip malformed blocks rather than throw — a briefing in progress
      // may legitimately have partial entries (e.g. LinkedIn-only).
      continue
    }

    const recipient: Recipient = {
      index,
      name,
      to: (toMatch[1] ?? '').trim(),
      subject: (subjectMatch[1] ?? '').trim(),
      body: (bodyMatch[1] ?? '').trim(),
    }
    if (currentTier) recipient.tier = currentTier
    if (channelMatch && channelMatch[1]) recipient.channel = channelMatch[1].trim()
    if (sentMatch && sentMatch[1]) recipient.sentAt = sentMatch[1].trim()
    if (msgidMatch && msgidMatch[1]) recipient.msgid = msgidMatch[1].trim()
    recipients.push(recipient)
  }

  return { source, recipients }
}

function splitOnHeaders(text: string): string[] {
  // Split into blocks at ## or ### header boundaries while keeping the
  // header line attached to the block that follows it.
  const lines = text.split('\n')
  const blocks: string[] = []
  let current: string[] = []
  for (const line of lines) {
    if (/^#{2,3}\s/.test(line)) {
      if (current.length > 0) blocks.push(current.join('\n'))
      current = [line]
    } else {
      current.push(line)
    }
  }
  if (current.length > 0) blocks.push(current.join('\n'))
  return blocks
}

/** Return only recipients that have not yet been sent. */
export function pending(briefing: Briefing): Recipient[] {
  return briefing.recipients.filter((r) => !r.sentAt && !r.msgid)
}

/** Return only recipients with a usable email address (skip LinkedIn-only). */
export function emailable(recipients: Recipient[]): Recipient[] {
  return recipients.filter((r) => /@/.test(r.to))
}
