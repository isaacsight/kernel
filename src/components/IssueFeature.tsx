import type { IssueRecord } from '../content/issues'
import { EssayFeature } from './EssayFeature'
import { InterviewFeature } from './InterviewFeature'

interface IssueFeatureProps {
  issue: IssueRecord
}

/**
 * IssueFeature — router that dispatches to the right editorial tool
 * based on spread.type. Different issues use different tools; this
 * switch is how that contract is enforced.
 *
 * To add a new tool:
 *   1. Extend IssueSpread in src/content/issues/index.ts with a new
 *      member of the discriminated union, e.g. { type: 'recipe', ... }.
 *   2. Build src/components/<Name>Feature.{tsx,css}.
 *   3. Add a case below.
 *   4. Exhaustiveness is enforced: TypeScript will fail if a new
 *      variant is missed here.
 */
export function IssueFeature({ issue }: IssueFeatureProps) {
  if (!issue.spread) return null
  const { spread } = issue

  switch (spread.type) {
    case 'essay':
      return <EssayFeature spread={spread} issue={issue} />
    case 'interview':
      return <InterviewFeature spread={spread} issue={issue} />
    default: {
      // Exhaustiveness check — adding a new variant without handling
      // it here produces a compile-time error.
      const _exhaustive: never = spread
      return _exhaustive
    }
  }
}
