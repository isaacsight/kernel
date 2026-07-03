import type { IssueRecord } from '../content/issues'
// Shared print-grade typesetting for every format — loaded here, at
// the router all features pass through, so the craft is systemic.
import './EditorialProse.css'
import { EssayFeature } from './EssayFeature'
import { InterviewFeature } from './InterviewFeature'
import { ForecastFeature } from './ForecastFeature'
import { DispatchFeature } from './DispatchFeature'
import { ReviewFeature } from './ReviewFeature'
import { ColloquyFeature } from './ColloquyFeature'
import { InstrumentFeature } from './InstrumentFeature'

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
    case 'forecast':
      return <ForecastFeature spread={spread} issue={issue} />
    case 'dispatch':
      return <DispatchFeature spread={spread} issue={issue} />
    case 'review':
      return <ReviewFeature spread={spread} issue={issue} />
    case 'colloquy':
      return <ColloquyFeature spread={spread} issue={issue} />
    case 'instrument':
      return <InstrumentFeature spread={spread} issue={issue} />
    default: {
      // Exhaustiveness check — adding a new variant without handling
      // it here produces a compile-time error.
      const _exhaustive: never = spread
      return _exhaustive
    }
  }
}
