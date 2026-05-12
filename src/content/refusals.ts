/**
 * The kernel.chat refusals.
 *
 * What the magazine does NOT do — the negative space that defines the
 * brand. Chris Do framework: brands are defined more by what they
 * refuse than by what they do. This is the canonical list, sourced
 * from docs/persona.md and printed in the colophon on every issue.
 *
 * Edit this list deliberately. Adding a refusal is an editorial
 * commitment that constrains every future issue; removing one is an
 * editorial loosening that should be noted in an ISSUE block comment
 * so the magazine remembers when its grammar shifted.
 */

export interface Refusal {
  /** One-line statement in the magazine's voice, starting with "We don't". */
  readonly text: string
  /** Optional one-line clarification, set smaller below the main line. */
  readonly note?: string
}

export const REFUSALS: ReadonlyArray<Refusal> = [
  {
    text: 'We don\'t run sponsored content.',
    note: 'If a tool deserves coverage, it earns it editorially.',
  },
  {
    text: 'We don\'t quote anyone we haven\'t talked to.',
    note: 'Profiles of real people are essays from public record, not invented interviews.',
  },
  {
    text: 'We don\'t show photographs of computers.',
    note: 'Screens are not the subject. The work is.',
  },
  {
    text: 'We don\'t ship listicles.',
    note: '"Top 5 things about X" is not an ISSUE format.',
  },
  {
    text: 'We don\'t write headlines as questions.',
    note: 'Statements, names, declarations. A title is a stake.',
  },
  {
    text: 'We don\'t add emojis to copy.',
    note: 'The ★ system glyph is the only exception, ratified in ISSUE 370.',
  },
  {
    text: 'We don\'t measure success in pageviews.',
    note: 'We measure it in whether a reader would print the issue and carry it on the train.',
  },
  {
    text: 'We don\'t use the word POPEYE on the site.',
    note: 'The homage is in the grammar.',
  },
] as const
