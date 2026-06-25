#!/usr/bin/env node
/**
 * Design-grammar adherence gate.
 *
 * Enforces the house rule the magazine publishes as fact ("0 hand-written
 * colours the lint allows", ISSUE 391): no raw hex colour literals in the
 * editorial/component source. Colours must come from design-system tokens
 * via var(--pop-*) / var(--rubin-*).
 *
 * Why a scanner and not ESLint/oxlint: the repo's oxlint adherence config
 * (design-system/_adherence.oxlintrc.json) isn't runnable (oxlint rejects
 * its `x-omelette` block and doesn't implement `no-restricted-syntax`), and
 * there is no ESLint config at all. This dependency-free scan arms the gate
 * the published number depends on, without standing up a toolchain.
 *
 * Scope: src/components, src/pages — the design surface. NOT src/content
 * (issue prose legitimately quotes hex, e.g. "tomato · #E24E1B").
 *
 * Usage:  node scripts/check-adherence.mjs        # exit 1 if any violation
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOTS = ['src/components', 'src/pages']
const EXTS = new Set(['.ts', '.tsx'])
// 3/4/6/8-digit hex colour literal. Word-boundary end avoids matching longer ids.
const HEX = /#[0-9a-fA-F]{3,8}\b/g

/** Walk a directory tree, yielding source file paths. */
function* walk(dir) {
  let entries
  try { entries = readdirSync(dir) } catch { return }
  for (const name of entries) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) yield* walk(p)
    else if (EXTS.has(extname(p))) yield p
  }
}

const violations = []
let scanned = 0

for (const root of ROOTS) {
  for (const file of walk(root)) {
    scanned++
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, i) => {
      // Skip 8-digit hex that is actually a 6-digit colour followed by text:
      // the regex already bounds with \b, so this is just per-match reporting.
      const matches = line.match(HEX)
      if (matches) {
        for (const m of matches) {
          violations.push({ file, line: i + 1, value: m, text: line.trim() })
        }
      }
    })
  }
}

if (violations.length === 0) {
  console.log(`adherence: clean — ${scanned} files scanned, 0 raw hex colours.`)
  process.exit(0)
}

console.error(`adherence: ${violations.length} raw hex colour(s) in ${scanned} files scanned:\n`)
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  ${v.value}`)
  console.error(`    ${v.text}`)
}
console.error(`\nUse a design-system token via var(--pop-*) / var(--rubin-*) instead of a raw hex.`)
process.exit(1)
