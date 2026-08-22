import { UUID } from 'crypto';
import { QuestionVerdictResult } from '../../../curriculum';

/**
 * The lesson descriptor returned by every `start` endpoint. Flows that are not
 * bound to a lesson (daily challenge, saved questions) return `null` here, but
 * the key is always present so clients can share one response handler.
 */
export interface SolvingLessonRef {
  id: UUID;
  title: string;
  description: string | null;
}

/**
 * Uniform payload for `POST .../start` across lessons, the daily challenge and
 * saved questions. `GET solving/daily-challenge` reuses it with a null
 * `snapshotId` (nothing is being solved yet).
 */
export interface SolvingStartResult {
  snapshotId: UUID | null;
  lesson: SolvingLessonRef | null;
  questions: any[];
}

/**
 * `GET solving/daily-challenge`: today's challenge as a preview.
 *
 * A student gets exactly one attempt per challenge, so `verdict` doubles as the
 * solved flag: null means untouched and still solvable, non-null means the
 * attempt is used up and the client should render that frozen result read-only
 * instead of offering to start.
 */
export interface DailyChallengePreview extends SolvingStartResult {
  verdict: QuestionVerdictResult | null;
}

/**
 * Uniform payload for `POST .../solve`. Flows that award nothing still report
 * `xps: 0, gems: 0` rather than omitting the keys.
 */
export interface SolvingSolveResult extends QuestionVerdictResult {
  xps: number;
  gems: number;
}
