/* Resolves the painter's theme from the live stylesheet — the
   room borrows the exact inks the flat catalog prints with. No
   hex literals here (adherence law); the tokens own the values. */
import type { IssueRecord } from '../content/issues/schema'
import { resolveAccentHex } from '../content/issues/accents'
import type { CoverTheme } from './coverPainter'

const STOCK_VAR: Record<string, string> = {
  cream: '--pop-cream', butter: '--pop-butter', kraft: '--pop-kraft',
  ivory: '--pop-ivory', ink: '--pop-ink', ledger: '--pop-ledger',
}

export function readCoverTheme(issue: IssueRecord): CoverTheme {
  const css = getComputedStyle(document.documentElement)
  const read = (name: string, fallbackVar: string) =>
    css.getPropertyValue(name).trim() || css.getPropertyValue(fallbackVar).trim()
  return {
    stock: read(STOCK_VAR[issue.coverStock ?? 'cream'] ?? '--pop-cream', '--pop-cream'),
    ink: css.getPropertyValue('--pop-ink').trim(),
    accent: resolveAccentHex(issue.accent, issue.spread?.type),
    serif: css.getPropertyValue('--font-serif').trim() || 'serif',
    mono: css.getPropertyValue('--font-mono').trim() || 'monospace',
  }
}
