/* ──────────────────────────────────────────────────────────────
   kernel.chat — Issue archive
   The back catalog. Every published issue lives here as a frozen
   snapshot. The landing page always reads from LATEST_ISSUE; past
   issues remain browseable at /issues/:number.

   To publish a new issue:
     1. Add src/content/issues/<number>.ts following the shape below.
     2. Import + push into ALL_ISSUES below.
     3. Bump the cover headline + JP if needed.
     4. Done — the landing flips to the new cover, the back catalog
        gains a row, and the previous issue freezes at its URL.
   ────────────────────────────────────────────────────────────── */

import { ISSUE_360 } from './360'
import { ISSUE_361 } from './361'
import { ISSUE_362 } from './362'
import { ISSUE_363 } from './363'
import { ISSUE_364 } from './364'
import { ISSUE_365 } from './365'
import { ISSUE_366 } from './366'
import { ISSUE_367 } from './367'
import { ISSUE_368 } from './368'
import { ISSUE_369 } from './369'
import { ISSUE_370 } from './370'
import { ISSUE_371 } from './371'
import { ISSUE_372 } from './372'
import { ISSUE_373 } from './373'
import { ISSUE_374 } from './374'
import { ISSUE_375 } from './375'
import { ISSUE_376 } from './376'
import { ISSUE_377 } from './377'
import { ISSUE_378 } from './378'
import { ISSUE_379 } from './379'
import { ISSUE_380 } from './380'
import { ISSUE_381 } from './381'
import { ISSUE_382 } from './382'
import { ISSUE_383 } from './383'
import { ISSUE_384 } from './384'
import { ISSUE_385 } from './385'
import { ISSUE_386 } from './386'
import { ISSUE_387 } from './387'
import { ISSUE_388 } from './388'
import { ISSUE_389 } from './389'
import { ISSUE_390 } from './390'
import { ISSUE_391 } from './391'
import { ISSUE_392 } from './392'
import { ISSUE_393 } from './393'
import { ISSUE_394 } from './394'
import { ISSUE_395 } from './395'
import { ISSUE_396 } from './396'
import { ISSUE_397 } from './397'
import { ISSUE_398 } from './398'
import { ISSUE_399 } from './399'
import { ISSUE_400 } from './400'
import { ISSUE_401 } from './401'
import { ISSUE_402 } from './402'
import { ISSUE_403 } from './403'
import { ISSUE_404 } from './404'
import { ISSUE_405 } from './405'
import { ISSUE_406 } from './406'
import { ISSUE_407 } from './407'
import { ISSUE_408 } from './408'
import { ISSUE_409 } from './409'
import { ISSUE_410 } from './410'
import { ISSUE_411 } from './411'
import { ISSUE_412 } from './412'
import { ISSUE_413 } from './413'
import { ISSUE_414 } from './414'
import { ISSUE_415 } from './415'
import { ISSUE_416 } from './416'
import { ISSUE_417 } from './417'
import { ISSUE_418 } from './418'
import { ISSUE_419 } from './419'
import { ISSUE_420 } from './420'
import { ISSUE_421 } from './421'
import { ISSUE_422 } from './422'
import { ISSUE_423 } from './423'
import { ISSUE_424 } from './424'
import { ISSUE_425 } from './425'
import { ISSUE_426 } from './426'
import { ISSUE_427 } from './427'

// Re-export accent types so issue files can import from a single place.
export type { IssueAccent, InkSeedName, InkSeed } from './accents'
export { INK_SEEDS, defaultAccentFor, resolveAccentHex, isPopeyeSafe, contrastRatio, STOCK_HEX, auditAccents } from './accents'

// The schema (cover fields, the IssueSpread union, IssueRecord) lives
// in ./schema. Re-exported here so `from './issues'` and `from './index'`
// keep resolving every type unchanged.
export * from './schema'
// `export *` only re-exports outward — import IssueRecord too so the
// archive below (ALL_ISSUES / LATEST_ISSUE / findIssue) can name it.
import type { IssueRecord } from './schema'

/** Every issue ever published, oldest first. */
export const ALL_ISSUES: IssueRecord[] = [
  ISSUE_360,
  ISSUE_361,
  ISSUE_362,
  ISSUE_363,
  ISSUE_364,
  ISSUE_365,
  ISSUE_366,
  ISSUE_367,
  ISSUE_368,
  ISSUE_369,
  ISSUE_370,
  ISSUE_371,
  ISSUE_372,
  ISSUE_373,
  ISSUE_374,
  ISSUE_375,
  ISSUE_376,
  ISSUE_377,
  ISSUE_378,
  ISSUE_379,
  ISSUE_380,
  ISSUE_381,
  ISSUE_382,
  ISSUE_383,
  ISSUE_384,
  ISSUE_385,
  ISSUE_386,
  ISSUE_387,
  ISSUE_388,
  ISSUE_389,
  ISSUE_390,
  ISSUE_391,
  ISSUE_392,
  ISSUE_393,
  ISSUE_394,
  ISSUE_395,
  ISSUE_396,
  ISSUE_397,
  ISSUE_398,
  ISSUE_399,
  ISSUE_400,
  ISSUE_401,
  ISSUE_402,
  ISSUE_403,
  ISSUE_404,
  ISSUE_405,
  ISSUE_406,
  ISSUE_407,
  ISSUE_408,
  ISSUE_409,
  ISSUE_410,
  ISSUE_411,
  ISSUE_412,
  ISSUE_413,
  ISSUE_414,
  ISSUE_415,
  ISSUE_416,
  ISSUE_417,
  ISSUE_418,
  ISSUE_419,
  ISSUE_420,
  ISSUE_421,
  ISSUE_422,
  ISSUE_423,
  ISSUE_424,
  ISSUE_425,
  ISSUE_426,
  ISSUE_427,
]

/** The latest published issue — drives the landing cover. */
export const LATEST_ISSUE: IssueRecord = ALL_ISSUES[ALL_ISSUES.length - 1]

/** Lookup helper for /issues/:number routes. */
export function findIssue(number: string): IssueRecord | undefined {
  return ALL_ISSUES.find((i) => i.number === number)
}
