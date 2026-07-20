#!/usr/bin/env node
/**
 * Editorial-law gate — the content-side companion to check-adherence.mjs.
 *
 * check-adherence.mjs guards the DESIGN layer (no raw hex in CSS).
 * This guards the CONTENT layer against three of CLAUDE.md's "five
 * rules that always apply" that were previously honour-system only:
 *
 *   1. Artifact-first (PUBLISHING.md §V.5): every issue from 419 on
 *      ships an artifact edition at artifacts/<N>-*.html. This is the
 *      check that would have caught the missing 421 artifact.
 *   2. No POPEYE naming (rule 1): the inspiration is never named in
 *      reader-visible copy. Comments are stripped first, so design-note
 *      headers and the isPopeyeSafe identifier are exempt by
 *      construction — only rendered strings are scanned.
 *   3. No pictographic emoji (rule 4): the ★ asterisk is the only
 *      ratified glyph. Only true U+1F000+ emoji are flagged; ★, ✓, ·,
 *      —, … and Japanese/CJK are punctuation and left to human review,
 *      keeping the gate false-positive-free.
 *
 * Dependency-free, like check-adherence.mjs. Exit 1 on any violation.
 * Usage:  node scripts/check-editorial.mjs
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ISSUES_DIR = 'src/content/issues'
const ARTIFACTS_DIR = 'artifacts'
// The artifact-first mandate binds every issue from this number on
// (PUBLISHING.md §V.5, "MANDATORY from 419").
const ARTIFACT_FIRST_FROM = 419

/** Strip comments so only rendered content is scanned. Newlines are
 *  preserved (block comments become blank space) so reported line
 *  numbers still match the source file. Mid-line `//` (e.g. inside a
 *  URL string) is intentionally left alone. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')) // block, keep newlines
    .replace(/^(\s*)\/\/.*$/gm, '$1') // full-line comments only
}

// True pictographic emoji only. ★ (U+2605), ✓, ⌘, ·, —, …, and CJK all
// sit outside this range and are deliberately not matched.
const EMOJI = /[\u{1F000}-\u{1FAFF}]/u

function issueNumber(file) {
  const m = /^(\d+)\.ts$/.exec(file)
  return m ? Number(m[1]) : null
}

const violations = []
let scannedIssues = 0

const files = readdirSync(ISSUES_DIR)
  .filter((f) => issueNumber(f) !== null)
  .sort((a, b) => issueNumber(a) - issueNumber(b))
const artifacts = existsSync(ARTIFACTS_DIR) ? readdirSync(ARTIFACTS_DIR) : []

for (const file of files) {
  const n = issueNumber(file)
  scannedIssues++
  const rendered = stripComments(readFileSync(join(ISSUES_DIR, file), 'utf8'))

  // 1. Artifact-first presence.
  if (n >= ARTIFACT_FIRST_FROM) {
    const re = new RegExp(`^${n}-.*\\.html$`)
    if (!artifacts.some((a) => re.test(a))) {
      violations.push({
        rule: 'artifact-first',
        file,
        detail: `ISSUE ${n} ships no artifacts/${n}-*.html (mandatory from ${ARTIFACT_FIRST_FROM} — PUBLISHING.md §V.5)`,
      })
    }
  }

  rendered.split('\n').forEach((line, i) => {
    // 2. No POPEYE naming in rendered copy.
    if (/popeye/i.test(line)) {
      violations.push({ rule: 'popeye-naming', file, line: i + 1, detail: line.trim() })
    }
    // 3. No pictographic emoji in rendered copy.
    const emoji = line.match(EMOJI)
    if (emoji) {
      violations.push({
        rule: 'emoji',
        file,
        line: i + 1,
        detail: `${JSON.stringify(emoji[0])} in: ${line.trim().slice(0, 80)}`,
      })
    }
  })
}

if (violations.length === 0) {
  console.log(
    `editorial: clean — ${scannedIssues} issues scanned; artifact-first, POPEYE-naming, and emoji all pass.`,
  )
  process.exit(0)
}

const byRule = {}
for (const v of violations) (byRule[v.rule] ||= []).push(v)

console.error(`editorial: ${violations.length} violation(s) across ${scannedIssues} issues scanned:\n`)
for (const [rule, vs] of Object.entries(byRule)) {
  console.error(`  [${rule}] — ${vs.length}`)
  for (const v of vs) {
    console.error(`    ${v.file}${v.line ? ':' + v.line : ''}  ${v.detail}`)
  }
  console.error('')
}
console.error('Fix these or, for a deliberate exception, document it — the gate is a floor, not a court.')
process.exit(1)
