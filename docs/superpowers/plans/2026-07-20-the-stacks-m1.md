# THE STACKS M1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/archive` — THE STACKS — the back catalog as a walkable dark room: typographic cover sheets drifting per monthly volume, scroll-descent, NEXT VOLUME gates, click/Enter into the real `/issues/N` routes.

**Architecture:** All 3D code lives in `src/stacks/` and loads only through the lazy `/archive` route chunk (three.js never touches the main bundle). Pure logic (volume grouping, body resolution, cover painting) is separated from the r3f scene so it tests without WebGL. The accessible resting structure is real DOM — a "ledger" of volume headings and issue links rendered beside the canvas; WebGL is presentational on top.

**Tech Stack:** React 19, react-router-dom v7, Vite 6, Vitest, three + @react-three/fiber v9 + @react-three/drei v10 (route-chunk only). Cover textures are canvas-painted at runtime from the issue registry — no image assets.

## Global Constraints

- Main bundle ≤300KB gzip JS (currently 236KB): three/r3f/drei must appear ONLY in the lazy archive chunk — verify in build output every task that touches deps or routing.
- No raw hex colours in new source (adherence law): colors come from CSS custom properties at runtime or `resolveAccentHex` from `src/content/issues/accents.ts`.
- Magazine vocabulary in user-visible copy: stacks / volume / gate / body / ledger. Never scene, canvas, 3D, viewer. No emojis (★ allowed).
- Bilingual lockups where the catalog has them (EN + JP).
- `prefers-reduced-motion: reduce` → no drift, no camera easing; resting page complete.
- Node scripts and tests must pass: `npm run lint:adherence && npm run lint:editorial && npx tsc --noEmit && npx vitest run`.
- All work on branch `feat/the-stacks` (exists, based on `feat/real-urls-cloudflare` — real paths assumed).

---

### Task 1: Volume grouping

**Files:**
- Create: `src/stacks/volumes.ts`
- Test: `src/stacks/volumes.test.ts`

**Interfaces:**
- Consumes: `IssueRecord` (`src/content/issues/schema.ts`) — uses only `{ number, month, year }`. `month` is an uppercase EN abbreviation (`'FEB'`), `year` a 4-digit string (`'2027'`).
- Produces: `interface Volume { label: string; labelJp: string; issues: IssueRecord[] }` and `groupIntoVolumes(issues: IssueRecord[]): Volume[]` — volumes newest-first, issues within a volume newest-first. `label` is `'FEB 2027'`; `labelJp` is `'二〇二七年二月'`.

- [ ] **Step 1: Write the failing test**

```ts
// src/stacks/volumes.test.ts
import { describe, it, expect } from 'vitest'
import { groupIntoVolumes } from './volumes'
import type { IssueRecord } from '../content/issues/schema'

const issue = (number: string, month: string, year: string) =>
  ({ number, month, year }) as IssueRecord

describe('groupIntoVolumes', () => {
  it('groups by cover month, volumes and issues newest-first', () => {
    const vols = groupIntoVolumes([
      issue('425', 'DEC', '2026'),
      issue('426', 'JAN', '2027'),
      issue('427', 'FEB', '2027'),
    ])
    expect(vols.map((v) => v.label)).toEqual(['FEB 2027', 'JAN 2027', 'DEC 2026'])
    expect(vols[0].issues.map((i) => i.number)).toEqual(['427'])
  })

  it('keeps multiple issues of one month newest-first', () => {
    const vols = groupIntoVolumes([
      issue('398', 'JUL', '2026'),
      issue('399', 'JUL', '2026'),
    ])
    expect(vols).toHaveLength(1)
    expect(vols[0].issues.map((i) => i.number)).toEqual(['399', '398'])
  })

  it('renders the Japanese volume label with kanji digits', () => {
    const [v] = groupIntoVolumes([issue('427', 'FEB', '2027')])
    expect(v.labelJp).toBe('二〇二七年二月')
  })

  it('handles all twelve month abbreviations', () => {
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
    const vols = groupIntoVolumes(months.map((m, i) => issue(String(360 + i), m, '2026')))
    expect(vols[0].labelJp.endsWith('十二月')).toBe(true)   // DEC sorts newest
    expect(vols[11].labelJp.endsWith('一月')).toBe(true)    // JAN sorts oldest
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/stacks/volumes.test.ts`
Expected: FAIL — `Cannot find module './volumes'`

- [ ] **Step 3: Write the implementation**

```ts
// src/stacks/volumes.ts
/* THE STACKS — volume grouping.
   A volume is one cover month of the catalog; the room walks
   newest volume to oldest. Pure over the registry so it tests
   without the renderer. */
import type { IssueRecord } from '../content/issues/schema'

export interface Volume {
  /** EN lockup, e.g. 'FEB 2027' */
  label: string
  /** JP lockup with kanji digits, e.g. '二〇二七年二月' */
  labelJp: string
  issues: IssueRecord[]
}

const MONTH_ORDER = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const MONTH_JP = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月']
const DIGIT_JP: Record<string, string> = {
  '0': '〇', '1': '一', '2': '二', '3': '三', '4': '四',
  '5': '五', '6': '六', '7': '七', '8': '八', '9': '九',
}

function yearJp(year: string): string {
  return year.split('').map((d) => DIGIT_JP[d] ?? d).join('')
}

function monthIndex(month: string): number {
  return MONTH_ORDER.indexOf(month.toUpperCase())
}

export function groupIntoVolumes(issues: IssueRecord[]): Volume[] {
  const byKey = new Map<string, IssueRecord[]>()
  for (const issue of issues) {
    const key = `${issue.year}-${String(monthIndex(issue.month)).padStart(2, '0')}`
    const bucket = byKey.get(key)
    if (bucket) bucket.push(issue)
    else byKey.set(key, [issue])
  }
  return [...byKey.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([, group]) => {
      const sorted = [...group].sort((a, b) => Number(b.number) - Number(a.number))
      const { month, year } = sorted[0]
      return {
        label: `${month.toUpperCase()} ${year}`,
        labelJp: `${yearJp(year)}年${MONTH_JP[monthIndex(month)]}`,
        issues: sorted,
      }
    })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/stacks/volumes.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/stacks/volumes.ts src/stacks/volumes.test.ts
git commit -m "feat(stacks): volume grouping — one room per cover month"
```

---

### Task 2: Body resolution

**Files:**
- Create: `src/stacks/bodies.ts`
- Test: `src/stacks/bodies.test.ts`

**Interfaces:**
- Consumes: `IssueRecord`.
- Produces: `type BodyKind = 'sheet' | 'instrument' | 'monument' | 'scan'` and `bodyFor(issue: IssueRecord): BodyKind`. M1 always resolves `'sheet'`; the union and function exist now so M2–M4 extend one place. Later tasks import both names exactly.

- [ ] **Step 1: Write the failing test**

```ts
// src/stacks/bodies.test.ts
import { describe, it, expect } from 'vitest'
import { bodyFor } from './bodies'
import type { IssueRecord } from '../content/issues/schema'

describe('bodyFor', () => {
  it('resolves every issue to a sheet in M1', () => {
    expect(bodyFor({ number: '360' } as IssueRecord)).toBe('sheet')
    expect(bodyFor({ number: '427' } as IssueRecord)).toBe('sheet')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/stacks/bodies.test.ts`
Expected: FAIL — `Cannot find module './bodies'`

- [ ] **Step 3: Write the implementation**

```ts
// src/stacks/bodies.ts
/* THE STACKS — body resolution.
   Every issue floats as a body of one kind. M1 ships sheets only;
   instruments (419+ artifact captures), monuments (milestone
   sculptural forms), and scans (photogrammetry) land in M2–M4 by
   extending this one resolver. */
import type { IssueRecord } from '../content/issues/schema'

export type BodyKind = 'sheet' | 'instrument' | 'monument' | 'scan'

export function bodyFor(_issue: IssueRecord): BodyKind {
  return 'sheet'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/stacks/bodies.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/stacks/bodies.ts src/stacks/bodies.test.ts
git commit -m "feat(stacks): bodyFor resolver — sheets in M1, one seam for M2-M4"
```

---

### Task 3: Cover painter (typographic sheet texture)

**Files:**
- Create: `src/stacks/coverPainter.ts`
- Test: `src/stacks/coverPainter.test.ts`

**Interfaces:**
- Consumes: `IssueRecord` (`number`, `month`, `year`, `price`, `headline.{prefix,emphasis,suffix}`, `featureJp`).
- Produces:
  - `interface CoverTheme { stock: string; ink: string; accent: string; serif: string; mono: string }` — all colors are CSS color strings resolved by the CALLER (Task 5 reads CSS custom properties; no hex literals here).
  - `interface CoverSurface { width: number; height: number; fillStyle: string; font: string; textAlign: CanvasTextAlign; fillRect(x: number, y: number, w: number, h: number): void; fillText(text: string, x: number, y: number): void }` — the minimal 2D-context slice, so tests inject a recorder and the scene passes a real `CanvasRenderingContext2D` (which satisfies it structurally plus width/height passed via the wrapper below).
  - `paintCover(issue: IssueRecord, surface: CoverSurface, theme: CoverTheme): void` — paints stock ground, folio row (`kernel.chat` / `N°<number>` / `<MONTH> <YEAR> · <price>`), the three-part headline with the emphasis word in accent, and the JP feature line.

- [ ] **Step 1: Write the failing test**

```ts
// src/stacks/coverPainter.test.ts
import { describe, it, expect } from 'vitest'
import { paintCover, type CoverSurface, type CoverTheme } from './coverPainter'
import type { IssueRecord } from '../content/issues/schema'

function recorder(width = 512, height = 720) {
  const ops: Array<Record<string, unknown>> = []
  const surface: CoverSurface = {
    width, height,
    fillStyle: '', font: '', textAlign: 'left',
    fillRect(x, y, w, h) { ops.push({ op: 'rect', x, y, w, h, fill: this.fillStyle }) },
    fillText(text, x, y) { ops.push({ op: 'text', text, x, y, fill: this.fillStyle, font: this.font }) },
  }
  return { surface, ops }
}

const theme: CoverTheme = {
  stock: 'var-stock', ink: 'var-ink', accent: 'var-accent',
  serif: 'TestSerif', mono: 'TestMono',
}

const issue = {
  number: '427', month: 'FEB', year: '2027', price: '¥0',
  featureJp: 'モートは現実',
  headline: { prefix: 'The moat', emphasis: 'is reality', suffix: '.', swash: '' },
} as IssueRecord

describe('paintCover', () => {
  it('grounds the sheet in the stock colour, full bleed', () => {
    const { surface, ops } = recorder()
    paintCover(issue, surface, theme)
    expect(ops[0]).toMatchObject({ op: 'rect', x: 0, y: 0, w: 512, h: 720, fill: 'var-stock' })
  })

  it('sets the emphasis word in the accent, the rest in ink', () => {
    const { surface, ops } = recorder()
    paintCover(issue, surface, theme)
    const texts = ops.filter((o) => o.op === 'text')
    expect(texts.find((o) => o.text === 'is reality')?.fill).toBe('var-accent')
    expect(texts.find((o) => o.text === 'The moat')?.fill).toBe('var-ink')
  })

  it('carries the folio: catalogue number, dateline, and the JP feature line', () => {
    const { surface, ops } = recorder()
    paintCover(issue, surface, theme)
    const texts = ops.filter((o) => o.op === 'text').map((o) => o.text)
    expect(texts).toContain('N°427')
    expect(texts).toContain('FEB 2027 · ¥0')
    expect(texts).toContain('モートは現実')
  })

  it('uses the mono family for folio rows and the serif for the headline', () => {
    const { surface, ops } = recorder()
    paintCover(issue, surface, theme)
    const texts = ops.filter((o) => o.op === 'text')
    expect(String(texts.find((o) => o.text === 'N°427')?.font)).toContain('TestMono')
    expect(String(texts.find((o) => o.text === 'The moat')?.font)).toContain('TestSerif')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/stacks/coverPainter.test.ts`
Expected: FAIL — `Cannot find module './coverPainter'`

- [ ] **Step 3: Write the implementation**

```ts
// src/stacks/coverPainter.ts
/* THE STACKS — typographic cover painter.
   Issues have no image covers; the cover IS type on stock. This
   paints that grammar onto any 2D surface (a CanvasTexture at
   runtime, a recorder in tests). Colors and font families arrive
   resolved in the theme — this module never names a hex. */
import type { IssueRecord } from '../content/issues/schema'

export interface CoverTheme {
  stock: string
  ink: string
  accent: string
  serif: string
  mono: string
}

export interface CoverSurface {
  width: number
  height: number
  fillStyle: string
  font: string
  textAlign: CanvasTextAlign
  fillRect(x: number, y: number, w: number, h: number): void
  fillText(text: string, x: number, y: number): void
}

export function paintCover(issue: IssueRecord, s: CoverSurface, t: CoverTheme): void {
  const u = s.width / 100 // layout unit

  // Ground: full-bleed stock.
  s.fillStyle = t.stock
  s.fillRect(0, 0, s.width, s.height)

  // Folio row — mono caps.
  s.font = `${3 * u}px ${t.mono}`
  s.textAlign = 'left'
  s.fillStyle = t.ink
  s.fillText('kernel.chat', 6 * u, 9 * u)
  s.fillText(`N°${issue.number}`, 6 * u, 14 * u)
  s.textAlign = 'right'
  s.fillText(`${issue.month} ${issue.year} · ${issue.price}`, 94 * u, 9 * u)

  // Headline — serif, emphasis word in the issue accent.
  s.textAlign = 'left'
  s.font = `700 ${9 * u}px ${t.serif}`
  const baseline = s.height * 0.52
  s.fillStyle = t.ink
  s.fillText(issue.headline.prefix, 6 * u, baseline)
  s.fillStyle = t.accent
  s.fillText(issue.headline.emphasis, 6 * u, baseline + 11 * u)
  s.fillStyle = t.ink
  s.fillText(issue.headline.suffix, 6 * u, baseline + 22 * u)

  // JP feature line — mono, under the headline block.
  s.font = `${3.4 * u}px ${t.mono}`
  s.fillText(issue.featureJp, 6 * u, baseline + 30 * u)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/stacks/coverPainter.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/stacks/coverPainter.ts src/stacks/coverPainter.test.ts
git commit -m "feat(stacks): typographic cover painter — stock, folio, headline, JP line"
```

---

### Task 4: Route, page shell, and the ledger (accessible resting structure)

**Files:**
- Create: `src/pages/ArchivePage.tsx`
- Create: `src/pages/ArchivePage.css`
- Create: `src/stacks/webgl.ts`
- Test: `src/stacks/webgl.test.ts`
- Modify: `src/router.tsx` (add lazy route under the Layout children, beside the `/issues` route)
- Modify: `src/components/Layout.tsx` (title case)

**Interfaces:**
- Consumes: `groupIntoVolumes` (Task 1), `ALL_ISSUES` from `src/content/issues`.
- Produces: `ArchivePage` (named export, matching the codebase's page pattern); `webglAvailable(create?: (kind: string) => unknown): boolean`. The Scene (Task 5) mounts INSIDE ArchivePage behind `webglAvailable()` — Task 5 imports nothing new from this task beyond the mount point marked below.

- [ ] **Step 1: Write the failing WebGL-detection test**

```ts
// src/stacks/webgl.test.ts
import { describe, it, expect } from 'vitest'
import { webglAvailable } from './webgl'

describe('webglAvailable', () => {
  it('is true when the probe yields a webgl2 context', () => {
    expect(webglAvailable(() => ({}))).toBe(true)
  })
  it('is false when the probe yields nothing', () => {
    expect(webglAvailable(() => null)).toBe(false)
  })
  it('is false when the probe throws', () => {
    expect(webglAvailable(() => { throw new Error('blocked') })).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/stacks/webgl.test.ts`
Expected: FAIL — `Cannot find module './webgl'`

- [ ] **Step 3: Implement the probe**

```ts
// src/stacks/webgl.ts
/* WebGL2 probe. The room's canvas layer mounts only when this is
   true; otherwise the ledger stands alone (the resting page is
   complete either way). Injectable for tests. */
export function webglAvailable(
  create: (kind: string) => unknown = (kind) =>
    document.createElement('canvas').getContext(kind),
): boolean {
  try {
    return Boolean(create('webgl2'))
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/stacks/webgl.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Build the page shell + ledger**

```tsx
// src/pages/ArchivePage.tsx
/* THE STACKS — the back catalog as a walkable room.
   The ledger (real headings + links below) is the resting
   structure: complete, keyboard-first, screen-reader-first. The
   drifting bodies mount on top only when WebGL2 exists. */
import { lazy, Suspense, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ALL_ISSUES } from '../content/issues'
import { groupIntoVolumes } from '../stacks/volumes'
import { webglAvailable } from '../stacks/webgl'
import './ArchivePage.css'

const StacksScene = lazy(() =>
  import('../stacks/Scene').then((m) => ({ default: m.StacksScene })),
)

export function ArchivePage() {
  const volumes = useMemo(() => groupIntoVolumes(ALL_ISSUES), [])
  const walkable = useMemo(() => webglAvailable(), [])

  return (
    <div className="stacks-room pop-stock-ink">
      {walkable && (
        <Suspense fallback={null}>
          <StacksScene volumes={volumes} />
        </Suspense>
      )}

      <header className="stacks-masthead">
        <p className="pop-folio">
          THE STACKS · 書庫 — every issue, shelved in the dark.{' '}
          <Link to="/issues">Prefer the flat catalog →</Link>
        </p>
      </header>

      <nav className="stacks-ledger" aria-label="The ledger — every volume and issue">
        {volumes.map((volume) => (
          <section key={volume.label} className="stacks-volume">
            <h2 className="stacks-volume-lockup">
              <span>{volume.label}</span>
              <span lang="ja">{volume.labelJp}</span>
            </h2>
            <ul>
              {volume.issues.map((issue) => (
                <li key={issue.number}>
                  <Link to={`/issues/${issue.number}`} data-stacks-issue={issue.number}>
                    <span className="pop-folio">N°{issue.number}</span>{' '}
                    {issue.feature}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
    </div>
  )
}
```

```css
/* src/pages/ArchivePage.css — THE STACKS room chrome.
   Tokens only; the dark ground is the ink stock. */
.stacks-room {
  position: relative;
  min-height: 100vh;
  background: var(--pop-ink);
  color: var(--pop-cream);
}
.stacks-room canvas {
  position: fixed;
  inset: 0;
  z-index: 0;
}
.stacks-masthead {
  position: relative;
  z-index: 2;
  padding: 24px;
}
.stacks-masthead a { color: var(--pop-cream); }
.stacks-ledger {
  position: relative;
  z-index: 2;
  max-width: 420px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}
.stacks-volume-lockup {
  display: flex;
  gap: 12px;
  align-items: baseline;
  font-family: var(--font-mono);
  font-size: 13px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.stacks-ledger ul { list-style: none; margin: 0; padding: 0; }
.stacks-ledger a {
  display: inline-block;
  padding: 8px 0;
  color: var(--pop-cream);
  text-decoration: none;
}
.stacks-ledger a:hover,
.stacks-ledger a:focus-visible { color: var(--pop-tomato); }
```

- [ ] **Step 6: Wire the route and the title**

In `src/router.tsx`, beside the other lazy page constants:

```tsx
const ArchivePage = lazyRetry(() => import('./pages/ArchivePage').then(m => ({ default: m.ArchivePage })))
```

and inside the Layout `children` array, after the `/issues` entries:

```tsx
{
  path: '/archive',
  element: withErrorBoundary(
    <Suspense fallback={<KernelLoading />}>
      <ArchivePage />
    </Suspense>
  ),
},
```

In `src/components/Layout.tsx`'s `titleForPath` switch, add:

```tsx
case 'archive': return 'The Stacks · kernel.chat'
```

- [ ] **Step 7: Gates + chunk assertion**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: clean; in the build output the main `dist/assets/index-*.js` stays ≈236KB gzip (unchanged — three is not yet installed, and ArchivePage is its own chunk).

- [ ] **Step 8: Commit**

```bash
git add src/pages/ArchivePage.tsx src/pages/ArchivePage.css src/stacks/webgl.ts src/stacks/webgl.test.ts src/router.tsx src/components/Layout.tsx
git commit -m "feat(stacks): /archive room shell — ledger resting structure, WebGL probe, lazy route"
```

---

### Task 5: The scene — sheets, drift, descent, gates

**Files:**
- Create: `src/stacks/Scene.tsx`
- Create: `src/stacks/coverTheme.ts`
- Modify: `package.json` (deps)

**Interfaces:**
- Consumes: `Volume` + `groupIntoVolumes` (Task 1), `bodyFor` (Task 2 — imported and used in the body switch even though M1 has one arm), `paintCover`/`CoverTheme` (Task 3), `resolveAccentHex` from `src/content/issues/accents.ts`.
- Produces: `StacksScene({ volumes }: { volumes: Volume[] })` named export — exactly what Task 4's lazy import expects. `readCoverTheme(issue)` in `coverTheme.ts` resolves CSS custom properties to a `CoverTheme`.

- [ ] **Step 1: Install the 3D stack (route-chunk only)**

```bash
npm install three@^0.182.0 @react-three/fiber@^9.3.0 @react-three/drei@^10.7.0
npm install -D @types/three@^0.182.0
```

- [ ] **Step 2: Theme reader**

```ts
// src/stacks/coverTheme.ts
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
```

(If any `--pop-butter`/`--pop-kraft`/`--pop-ledger`/`--font-serif` token does not exist in `src/index.css`, check the actual token names there first — `grep -n "pop-butter\|pop-kraft\|pop-ledger\|font-serif" src/index.css` — and use the real names; the fallback chain keeps missing stocks on cream.)

- [ ] **Step 3: The scene**

```tsx
// src/stacks/Scene.tsx
/* THE STACKS — the canvas layer. One vertical run of volume rooms;
   page scroll drives the camera down through them. Bodies drift
   unless the reader asked for stillness. Activating a body lands
   on the issue's real route — the spread is the destination. */
import { useMemo, useRef, useEffect, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import type { Volume } from './volumes'
import type { IssueRecord } from '../content/issues/schema'
import { bodyFor } from './bodies'
import { paintCover, type CoverSurface } from './coverPainter'
import { readCoverTheme } from './coverTheme'

const ROOM_HEIGHT = 14           // world units between volume rooms
const SHEET_W = 2.1
const SHEET_H = 3

function coverTexture(issue: IssueRecord): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 720
  const ctx = canvas.getContext('2d')!
  const surface: CoverSurface = Object.assign(ctx, { width: 512, height: 720 })
  paintCover(issue, surface, readCoverTheme(issue))
  const texture = new THREE.CanvasTexture(canvas)
  texture.anisotropy = 4
  return texture
}

/** Deterministic per-issue drift seed — no Math.random, so the
 *  room composes identically on every visit. */
function seed(issue: IssueRecord, salt: number): number {
  return ((Number(issue.number) * 2654435761 + salt * 40503) % 1000) / 1000
}

function SheetBody({ issue, home, still, onOpen }: {
  issue: IssueRecord
  home: [number, number, number]
  still: boolean
  onOpen: (n: string) => void
}) {
  const mesh = useRef<THREE.Mesh>(null)
  const texture = useMemo(() => coverTexture(issue), [issue])
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(SHEET_W, SHEET_H, 12, 1)
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      pos.setZ(i, Math.sin((pos.getX(i) / SHEET_W) * Math.PI) * 0.09) // paper curl
    }
    g.computeVertexNormals()
    return g
  }, [])

  useFrame(({ clock }) => {
    if (!mesh.current) return
    const t = still ? 0 : clock.elapsedTime
    const [x, y, z] = home
    mesh.current.position.set(
      x + Math.sin(t * 0.21 + seed(issue, 1) * 6.28) * 0.25,
      y + Math.cos(t * 0.17 + seed(issue, 2) * 6.28) * 0.2,
      z,
    )
    mesh.current.rotation.set(
      Math.sin(t * 0.1 + seed(issue, 3) * 6.28) * 0.12,
      Math.sin(t * 0.13 + seed(issue, 4) * 6.28) * 0.3 + seed(issue, 5) - 0.5,
      0,
    )
  })

  // bodyFor is the M2-M4 seam; every kind renders a sheet until
  // its body component lands.
  switch (bodyFor(issue)) {
    case 'sheet':
    default:
      return (
        <mesh
          ref={mesh}
          geometry={geometry}
          onClick={(e) => { e.stopPropagation(); onOpen(issue.number) }}
          onPointerOver={() => { document.body.style.cursor = 'pointer' }}
          onPointerOut={() => { document.body.style.cursor = '' }}
        >
          <meshStandardMaterial map={texture} side={THREE.DoubleSide} roughness={0.6} />
        </mesh>
      )
  }
}

/** Sheet homes fan around the volume lockup, deterministic. */
function homes(volume: Volume, roomY: number): Array<[number, number, number]> {
  return volume.issues.map((issue, i) => {
    const angle = (i / Math.max(volume.issues.length, 1)) * Math.PI * 2 + seed(issue, 6) * 0.8
    const radius = 3.4 + seed(issue, 7) * 1.6
    return [
      Math.cos(angle) * radius,
      roomY + (seed(issue, 8) - 0.5) * 2.4,
      -1.5 - seed(issue, 9) * 2.5,
    ]
  })
}

function Rig({ still }: { still: boolean }) {
  useFrame(({ camera }) => {
    const progress = window.scrollY / Math.max(document.body.scrollHeight - window.innerHeight, 1)
    const targetY = -progress * ((document.body.dataset.stacksVolumes
      ? Number(document.body.dataset.stacksVolumes) - 1
      : 0) * ROOM_HEIGHT)
    camera.position.y = still
      ? targetY
      : camera.position.y + (targetY - camera.position.y) * 0.08
    camera.position.z = 8
  })
  return null
}

export function StacksScene({ volumes }: { volumes: Volume[] }) {
  const navigate = useNavigate()
  const [still, setStill] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setStill(query.matches)
    const onChange = () => setStill(query.matches)
    query.addEventListener('change', onChange)
    document.body.dataset.stacksVolumes = String(volumes.length)
    return () => {
      query.removeEventListener('change', onChange)
      delete document.body.dataset.stacksVolumes
    }
  }, [volumes.length])

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 8], fov: 50 }}
      frameloop={still ? 'demand' : 'always'}
      style={{ position: 'fixed', inset: 0, zIndex: 0 }}
      aria-hidden="true"
    >
      <ambientLight intensity={1.1} />
      <directionalLight position={[4, 6, 8]} intensity={1.4} />
      <Rig still={still} />
      {volumes.map((volume, v) => (
        <group key={volume.label}>
          {homes(volume, -v * ROOM_HEIGHT).map((home, i) => (
            <SheetBody
              key={volume.issues[i].number}
              issue={volume.issues[i]}
              home={home}
              still={still}
              onOpen={(n) => navigate(`/issues/${n}`)}
            />
          ))}
        </group>
      ))}
    </Canvas>
  )
}
```

- [ ] **Step 4: Give the page its scroll run and center the lockups**

Append to `src/pages/ArchivePage.css`:

```css
/* One viewport of descent per volume; the ledger scrolls with it.
   The lockup echoes the canvas layer's room positions. */
.stacks-volume { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; }
@media (prefers-reduced-motion: reduce) {
  .stacks-volume { min-height: 0; }
}
```

- [ ] **Step 5: Gates + chunk assertion**

Run: `npx tsc --noEmit && npx vitest run && npm run build 2>&1 | grep -E "index-.*gzip|Scene|three"`
Expected: all tests pass; main `index-*.js` gzip unchanged (≈236KB); a separate chunk (containing Scene/three, several hundred KB raw) exists. If three appears in the main chunk, the lazy boundary is broken — fix before committing.

- [ ] **Step 6: Verify in the browser (preview server, not curl)**

Start the `preview-dist` launch config after `npm run build`. Check at `/archive`:
- Sheets drift around volume space; scroll descends; clicking a sheet lands on `/issues/N`.
- With reduced motion emulated: no drift, ledger fully usable.
- Console: zero errors.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/stacks/Scene.tsx src/stacks/coverTheme.ts src/pages/ArchivePage.css
git commit -m "feat(stacks): the room — drifting sheet bodies, scroll descent, issue navigation"
```

---

### Task 6: e2e, design QA, and the entry link

**Files:**
- Create: `e2e/tests/stacks.spec.ts`
- Modify: `src/components/IssueColophon.tsx` (add the room's entry link beside "Back Issues")

**Interfaces:**
- Consumes: the `/archive` route (Task 4/5); the colophon's existing link row.
- Produces: nothing new for later tasks — this closes M1.

- [ ] **Step 1: Write the e2e spec**

```ts
// e2e/tests/stacks.spec.ts
import { test, expect } from '@playwright/test'

test.describe('THE STACKS', () => {
  test('the ledger lands on the real issue route', async ({ page }) => {
    await page.goto('/archive')
    await page.getByRole('link', { name: /N°427/ }).click()
    await expect(page).toHaveURL(/\/issues\/427/)
  })

  test('keyboard: tab reaches a ledger link and Enter opens it', async ({ page }) => {
    await page.goto('/archive')
    const first = page.locator('.stacks-ledger a').first()
    await first.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/issues\/\d+/)
  })

  test('reduced motion: the room rests and stays navigable', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/archive')
    await expect(page.locator('.stacks-ledger')).toBeVisible()
  })

  test('the flat catalog stays one link away', async ({ page }) => {
    await page.goto('/archive')
    await page.getByRole('link', { name: /flat catalog/i }).click()
    await expect(page).toHaveURL(/\/issues$/)
  })
})
```

- [ ] **Step 2: Run the e2e spec**

Run: `npx playwright test e2e/tests/stacks.spec.ts` (against the preview server per the project's playwright config)
Expected: 4 passed. (If the project config expects a dev server, use the same invocation the existing `issue-415-close.spec.ts` runs under.)

- [ ] **Step 3: Add the entry link to the colophon**

In `src/components/IssueColophon.tsx`, in the link row that has `<a href="/issues">Back Issues</a>`, add after it:

```tsx
<a href="/archive">The Stacks</a>
```

- [ ] **Step 4: Run the design-QA audit locally**

Run: `npm run build && mkdir -p dist/artifacts && cp artifacts/*.html dist/artifacts/`, start `preview-dist`, then:
`node .claude/skills/kernel-chat-design-qa/scripts/audit-page.mjs http://localhost:4173/archive <scratchpad>/audit-stacks`
Expected: exit 0; inspect desktop + mobile screenshots by eye — lockups legible, no overflow, no small controls.

- [ ] **Step 5: Full gates**

Run: `npm run lint:adherence && npm run lint:editorial && npx tsc --noEmit && npx vitest run && npm run build`
Expected: all clean; main bundle ≤300KB gzip.

- [ ] **Step 6: Commit**

```bash
git add e2e/tests/stacks.spec.ts src/components/IssueColophon.tsx
git commit -m "feat(stacks): e2e coverage, design-QA pass, colophon entry link"
```

---

### Task 7: Documentation and close-out

**Files:**
- Modify: `KERNEL.md` (directory map: add `src/stacks/` one-liner)
- Modify: `src/content/issues/PUBLISHING.md` (one line in the site-surfaces section pointing at /archive and the M2–M4 seam in `bodies.ts`)
- Modify: `SCRATCHPAD.md` (session entry)

- [ ] **Step 1: Add the `src/stacks/` line to KERNEL.md's directory map**

Find the directory map section (`grep -n "src/" KERNEL.md | head`) and add, in place, matching the table/list style used there:

```
src/stacks/ — THE STACKS (/archive): the back catalog as a walkable room; bodies resolve in bodies.ts (M1 sheets; M2 instruments, M3 monuments, M4 scans)
```

- [ ] **Step 2: Add the PUBLISHING.md pointer**

In the section that lists reader-facing surfaces (near where /issues is described), add one sentence:

```
The back catalog also stands as THE STACKS at /archive — a walkable
room over the same registry; the flat catalog remains first-class.
```

- [ ] **Step 3: SCRATCHPAD entry**

Prepend a short session block (existing format) noting: M1 shipped on `feat/the-stacks`, the bodies.ts seam, and that M2–M4 remain per the spec.

- [ ] **Step 4: Final gates and commit**

```bash
npm run lint:editorial && npx tsc --noEmit && npx vitest run
git add KERNEL.md src/content/issues/PUBLISHING.md SCRATCHPAD.md
git commit -m "docs: file THE STACKS M1 — room shipped, M2-M4 seam documented"
```

---

## Verification (end-to-end, after all tasks)

1. `npm run lint:adherence && npm run lint:editorial && npx tsc --noEmit && npx vitest run` — all clean.
2. `npm run build` — main `index-*.js` ≤300KB gzip; three only in the archive chunk.
3. Preview server: `/archive` walks (drift, descent, gates), clicking and Enter both land on `/issues/N`, reduced motion rests complete, no console errors.
4. `audit-page.mjs` against `/archive` — desktop + mobile + print, visually inspected.
5. Push `feat/the-stacks`; PR against `feat/real-urls-cloudflare` (or main once PR #62 merges).
