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
