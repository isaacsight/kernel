// ─── Me Agent ──────────────────────────────────────────────────
//
// The AI agent that speaks *for* a user on their personal platform
// page. Grounded in that user's influences, timeline, music, posts,
// and bio. Visitors can converse with it; it answers in a voice
// informed by the person's published material.
//
// Tone: modern wisdom. Unhurried, considered, declarative. Honest
// about what is known (from the record) versus inferred. Never
// claims to be the person — speaks *from* the record.

import type {
  Influence,
  TimelineEvent,
  MusicSession,
  SocialPostLite,
  PlatformProfile,
} from '../hooks/usePersonalPlatform'

export interface MeAgentContext {
  profile: PlatformProfile | null
  influences: Influence[]
  timeline: TimelineEvent[]
  music: MusicSession[]
  posts: SocialPostLite[]
}

export const ME_AGENT_ID = 'me-agent'
export const ME_AGENT_NAME = 'Me'

const PREAMBLE = `You are a personal platform agent — a reflection of one person, grounded only in what they have published on their profile. You speak in the register of modern wisdom: quiet, precise, unhurried. You let meaning arrive.

Voice rules:
- Declarative, never performative. Use short sentences. Leave space.
- When you know something from the record, cite it matter-of-factly: "On 12 March they shipped X." "They've logged Brian Eno as an influence three times."
- When asked something not in the record, say so plainly, then offer what you can *infer* from the pattern of influences and timeline — clearly labeled as inference.
- Never fabricate specifics (dates, track names, quotes). If absent, say absent.
- First person is allowed ("I") when speaking from the record, but you are an agent *of* this person, not them. If pushed, clarify: "I speak from what they've published here."
- No emojis. No exclamation points. No marketing tone.
- If a visitor asks something beyond the person's domain (coding help, random facts), answer briefly then return to what this profile is about.

Length: default to 2–4 sentences. Longer only when the question genuinely earns it.`

function trim(text: string, max = 240): string {
  if (!text) return ''
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text
}

function formatInfluences(influences: Influence[]): string {
  if (!influences.length) return '(none logged)'
  const byKind = new Map<string, Influence[]>()
  influences.forEach(i => {
    const list = byKind.get(i.kind) ?? []
    list.push(i)
    byKind.set(i.kind, list)
  })
  const lines: string[] = []
  for (const [kind, list] of byKind) {
    const top = list.slice(0, 8).map(i => {
      const who = i.creator ? ` — ${i.creator}` : ''
      const w = `(w${i.weight})`
      const note = i.note ? ` :: ${trim(i.note, 120)}` : ''
      return `  • ${i.title}${who} ${w}${note}`
    }).join('\n')
    lines.push(`${kind}:\n${top}`)
  }
  return lines.join('\n')
}

function formatTimeline(events: TimelineEvent[]): string {
  if (!events.length) return '(empty)'
  return events.slice(0, 20).map(e => {
    const d = new Date(e.occurred_at).toISOString().slice(0, 10)
    const body = e.body ? ` — ${trim(e.body, 120)}` : ''
    return `  ${d} [${e.kind}] ${e.title}${body}`
  }).join('\n')
}

function formatMusic(sessions: MusicSession[]): string {
  if (!sessions.length) return '(none)'
  return sessions.slice(0, 12).map(m => {
    const d = new Date(m.occurred_at).toISOString().slice(0, 10)
    const meta = [m.kind, m.bpm ? `${m.bpm}bpm` : null, m.musical_key, m.genre]
      .filter(Boolean).join(' · ')
    return `  ${d} ${m.title} [${meta}]`
  }).join('\n')
}

function formatPosts(posts: SocialPostLite[]): string {
  if (!posts.length) return '(none)'
  return posts.slice(0, 8).map(p => {
    const d = p.published_at ? new Date(p.published_at).toISOString().slice(0, 10) : '—'
    return `  ${d} [${p.platform}] ${trim(p.body, 200)}`
  }).join('\n')
}

export function buildMeAgentSystemPrompt(ctx: MeAgentContext): string {
  const name = ctx.profile?.display_name ?? 'This person'
  const bio = ctx.profile?.bio ?? '(no bio set)'
  return [
    PREAMBLE,
    '',
    `── The record ──`,
    `Name: ${name}`,
    `Bio: ${bio}`,
    '',
    `Influences (weight 1–10):`,
    formatInfluences(ctx.influences),
    '',
    `Timeline (recent):`,
    formatTimeline(ctx.timeline),
    '',
    `Studio log:`,
    formatMusic(ctx.music),
    '',
    `Recent posts across platforms:`,
    formatPosts(ctx.posts),
    '',
    `── End of record ──`,
    '',
    `When visitors ask about ${name}, ground every claim in the record above. When they ask you something general, answer briefly in ${name}'s voice — spare, considered — then invite them back into the record if useful.`,
  ].join('\n')
}
