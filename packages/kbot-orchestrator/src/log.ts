// Append send results back into the briefing markdown file.
//
// Updates are non-destructive: we add a logbook table at the bottom of the
// file if absent, and append rows. We do NOT mutate the recipient blocks in
// place — the briefing markdown is the human-readable record and the table
// is the machine-appended audit trail. If you want the briefing to also
// show **Sent:** / **msgid:** inline on each recipient, add those by hand
// after reviewing the run output.

import { readFileSync, writeFileSync } from 'node:fs'
import type { SendResult } from './send.js'
import type { Recipient } from './briefing.js'

const LOGBOOK_HEADER = '## Send log (machine-appended)'

const TABLE_HEADER =
  '| When | Recipient | To | Subject | Status | msgid |\n' +
  '|---|---|---|---|---|---|'

export function appendSendResults(
  briefingPath: string,
  sends: { recipient: Recipient; result: SendResult }[],
): void {
  const original = readFileSync(briefingPath, 'utf-8')
  const now = new Date().toISOString()
  const rows = sends.map(({ recipient, result }) => {
    const status = result.ok ? 'sent' : `FAILED: ${result.error ?? 'unknown'}`
    const msgid = result.messageId ? '`' + result.messageId + '`' : '—'
    const subject = escapePipes(result.subject)
    const name = escapePipes(recipient.name)
    return `| ${now} | ${name} | \`${result.to}\` | ${subject} | ${status} | ${msgid} |`
  })

  const block = `\n\n${LOGBOOK_HEADER}\n\n${TABLE_HEADER}\n${rows.join('\n')}\n`

  let updated: string
  if (original.includes(LOGBOOK_HEADER)) {
    // Insert rows under the existing header by finding the last table row.
    const lines = original.split('\n')
    const headerIdx = lines.findIndex((l) => l.trim() === LOGBOOK_HEADER)
    if (headerIdx === -1) {
      updated = original + block
    } else {
      // Find end of the existing table (last non-blank line after header).
      let endIdx = lines.length
      for (let i = headerIdx + 1; i < lines.length; i++) {
        const line = lines[i] ?? ''
        if (/^#{1,3}\s/.test(line)) { endIdx = i; break }
      }
      // Walk back to last non-blank.
      while (endIdx > headerIdx + 1 && (lines[endIdx - 1] ?? '').trim() === '') endIdx--
      const before = lines.slice(0, endIdx).join('\n')
      const after = lines.slice(endIdx).join('\n')
      updated = before + '\n' + rows.join('\n') + '\n' + (after ? after : '')
    }
  } else {
    updated = original + block
  }

  writeFileSync(briefingPath, updated, 'utf-8')
}

function escapePipes(s: string): string {
  return s.replace(/\|/g, '\\|')
}
