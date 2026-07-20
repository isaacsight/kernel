#!/usr/bin/env node
/**
 * Build artifacts/index.html — a discoverable directory of the issue
 * artifact editions.
 *
 * The artifact editions (artifacts/<N>-<slug>.html) are copied to the
 * public site by deploy.yml but were unlinked and had no index, so the
 * only way to reach one was to already know its URL. This generates a
 * self-contained, CSP-safe, house-grammar index listing every filed
 * edition, newest first, derived from the directory so it never drifts.
 *
 * Regenerate on demand (`npm run artifacts:index`) or let deploy.yml
 * run it before publishing. Idempotent; overwrites artifacts/index.html.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const DIR = 'artifacts'
const ISSUES = 'src/content/issues'

/** Canonical display title for an edition: the issue's own `feature`
 *  field (authoritative + uniform), falling back to the artifact's
 *  <title> then the filename. The source <title> tags are heterogeneous
 *  (some carry "ISSUE N —" prefixes or no tag at all), so the issue
 *  file is the source of truth. */
function titleFor(n, file) {
  const issuePath = join(ISSUES, `${n}.ts`)
  if (existsSync(issuePath)) {
    const m = /\bfeature:\s*'([^']+)'/.exec(readFileSync(issuePath, 'utf8'))
    if (m) return m[1].trim()
  }
  const raw = readFileSync(join(DIR, file), 'utf8')
  const tm = /<title>([^<]*)<\/title>/i.exec(raw)
  return (tm ? tm[1] : file).replace(/\s*·\s*kernel\.chat.*$/i, '').trim()
}

const editions = readdirSync(DIR)
  .filter((f) => /^\d+-.*\.html$/.test(f)) // <N>-<slug>.html, excludes index.html
  .map((file) => {
    const n = Number(/^(\d+)-/.exec(file)[1])
    return { n, file, title: titleFor(n, file) }
  })
  .sort((a, b) => b.n - a.n) // newest first

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const rows = editions
  .map(
    (e) => `      <li class="edition">
        <a href="${esc(e.file)}">
          <span class="edition__n">${e.n}</span>
          <span class="edition__title">${esc(e.title)}</span>
          <span class="edition__go">OPEN →</span>
        </a>
      </li>`,
  )
  .join('\n')

const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ARTIFACT EDITIONS · kernel.chat</title>
<style>
  :root {
    --paper: #FAF9F6; --ink: #1F1E1D; --muted: #6b6862; --accent: #E24E1B; --rule: #d9d4c7;
  }
  @media (prefers-color-scheme: dark) {
    :root { --paper: #1F1E1D; --ink: #F3E9D2; --muted: #9a948a; --accent: #E88A5E; --rule: #3a3833; }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--paper); color: var(--ink);
    font-family: "EB Garamond", Palatino, Georgia, "Times New Roman", serif;
    -webkit-font-smoothing: antialiased; line-height: 1.5;
  }
  .wrap { max-width: 720px; margin: 0 auto; padding: 7vh 24px 12vh; }
  .runhead {
    font-family: "Courier Prime", "Courier New", monospace; font-size: 12px; letter-spacing: 0.22em;
    text-transform: uppercase; color: var(--muted); display: flex; justify-content: space-between;
    border-bottom: 1px solid var(--rule); padding-bottom: 10px; gap: 12px; flex-wrap: wrap;
  }
  h1 { font-size: clamp(34px, 8vw, 58px); font-weight: 500; line-height: 1.02; margin: 40px 0 6px; }
  .jp { font-family: "Courier Prime", monospace; letter-spacing: 0.3em; color: var(--muted); font-size: 13px; }
  .deck { font-size: 19px; color: var(--ink); max-width: 56ch; margin: 22px 0 40px; }
  .deck a { color: var(--accent); }
  ol { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--rule); }
  .edition a {
    display: grid; grid-template-columns: 3.5rem 1fr auto; align-items: baseline; gap: 16px;
    padding: 18px 4px; border-bottom: 1px solid var(--rule); text-decoration: none; color: inherit;
  }
  .edition a:hover .edition__title { color: var(--accent); }
  .edition a:hover .edition__go { opacity: 1; }
  .edition__n { font-family: "Courier Prime", monospace; font-size: 22px; color: var(--accent); font-weight: 700; }
  .edition__title { font-size: 22px; letter-spacing: 0.01em; }
  .edition__go {
    font-family: "Courier Prime", monospace; font-size: 11px; letter-spacing: 0.18em; color: var(--muted);
    opacity: 0.55; transition: opacity 0.15s ease;
  }
  a:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
  footer {
    margin-top: 48px; font-family: "Courier Prime", monospace; font-size: 11px; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--muted); line-height: 1.9;
  }
</style>
<div class="wrap">
  <div class="runhead"><span>KERNEL &#9733; CHAT</span><span>ARTIFACT EDITIONS</span></div>
  <h1>Artifact editions.</h1>
  <div class="jp">特別付録 &mdash; 操作できる号</div>
  <p class="deck">Every issue from 419 on ships an operable, self-contained artifact edition &mdash; the interactive register each spread is the lawful reduction of. Filed here, newest first. The magazine proper is at <a href="/">kernel.chat</a>.</p>
  <ol>
${rows}
  </ol>
  <footer>
    ${editions.length} editions &middot; each self-contained, keyboard-operable, printable<br>
    generated by scripts/build-artifact-index.mjs &middot; do not hand-edit
  </footer>
</div>
`

writeFileSync(join(DIR, 'index.html'), html)
console.log(`artifacts/index.html: ${editions.length} editions (${editions.map((e) => e.n).join(', ')})`)
