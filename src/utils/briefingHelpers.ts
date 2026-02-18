// ─── Briefing Helpers ────────────────────────────────────
//
// Shared parsing utilities for connecting briefings to chats and goals.

export interface BriefingSection {
  heading: string
  body: string
}

/** Split markdown content by ## headings into { heading, body } pairs */
export function splitSections(content: string): BriefingSection[] {
  const lines = content.split('\n')
  const sections: BriefingSection[] = []
  let currentHeading = ''
  let currentBody: string[] = []

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)$/)
    if (match) {
      // Save previous section
      if (currentHeading) {
        sections.push({ heading: currentHeading, body: currentBody.join('\n').trim() })
      }
      currentHeading = match[1].replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').trim()
      currentBody = []
    } else if (currentHeading) {
      currentBody.push(line)
    }
  }

  // Final section
  if (currentHeading) {
    sections.push({ heading: currentHeading, body: currentBody.join('\n').trim() })
  }

  return sections
}

/** Extract the last ## section (usually actionable takeaways) */
export function extractTakeaways(content: string): string {
  const sections = splitSections(content)
  if (sections.length === 0) return content.slice(0, 300)
  const last = sections[sections.length - 1]
  return `**${last.heading}**\n\n${last.body}`
}

/** Format a briefing title + takeaways as a goal description */
export function briefingToGoalDescription(title: string, content: string): string {
  const takeaways = extractTakeaways(content)
  return `From briefing: "${title}"\n\n${takeaways}`.slice(0, 1000)
}
