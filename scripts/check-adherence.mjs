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

// Scope: CLI args override the default. The default is the routed
// magazine surface (src/pages) — where the published "0 hand-written
// colours" claim lives. Scans CSS — where a #hex IS a colour value —
// not TSX, where #hex is usually an HTML entity (&#9733; = ★) or prose
// documenting the brand colour. Raw hex is allowed in exactly ONE place,
// the token definitions in index.css; everywhere else must use var(--*).
// Default scope: the editorial DESIGN-SYSTEM layer (shared styles +
// components) — the portable "house style" Issue 391 is about. That
// layer is token-pure (0 raw hex). Page-level CSS is a known backlog,
// NOT clean and NOT hidden: LandingPage.css hardcodes ~10 back-cover
// stock colours, and the /play + /leaderboard engine pages carry many
// more. Scan them on demand with `... src/pages`.
const ROOTS = process.argv.slice(2).length ? process.argv.slice(2) : ['src/styles', 'src/components']
const EXTS = new Set(['.css'])
// Token-definition homes: raw hex is allowed here — this is where the
// design-system colours are declared. Excluded from the gate.
const IGNORE = new Set(['src/index.css', 'src/critical.css'])
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
    else if (EXTS.has(extname(p)) && !IGNORE.has(p)) yield p
  }
}

const violations = []
let scanned = 0

for (const root of ROOTS) {
  for (const file of walk(root)) {
    scanned++
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, i) => {
      const matches = line.match(HEX)
      if (!matches) return
      for (const m of matches) {
        const v = m.toLowerCase()
        // Allow structural black/white — masks, shadows, the intentional
        // brand-button #000 (design-language.md). They aren't brand colours.
        if (v === '#000' || v === '#fff' || v === '#000000' || v === '#ffffff') continue
        // Allow var(--token, #fallback): the colour is token-backed; the
        // hex is only a defensive fallback if the token is missing.
        const prefix = line.slice(0, line.indexOf(m))
        if (/var\([^)]*$/.test(prefix)) continue
        violations.push({ file, line: i + 1, value: m, text: line.trim() })
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
