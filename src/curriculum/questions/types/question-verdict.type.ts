import { Question } from '../entity/questions.entity';

export interface QuestionMap {
  question: Question;
  answer: Record<string, any>;
}

/**
 * What every component's `verdict()` returns. Grading is all-or-nothing per
 * question - there is no per-item (per blank / per base / per category)
 * breakdown any more; the client rebuilds "your answer vs. correct" by diffing
 * `answered` against the (no longer stripped) question.
 */
export interface QuestionComponentVerdict {
  correct: boolean;
  skipped: boolean;
}

/**
 * The uniform verdict, identical in shape for all six question types.
 *
 * `question` carries the full entity WITH its answer key - nothing is stripped
 * anywhere any more - so `id`, `title`, `type`, `tips` and `verdictText` are
 * all reachable through it instead of being duplicated here.
 *
 * `answered` is the raw answer payload the student submitted for this question
 * (`{ options: [...] }`, `{ boolAnswer: true }`, ...), `{}` when skipped.
 */
export interface QuestionVerdict extends QuestionComponentVerdict {
  question: Question;
  answered: Record<string, any>;
}

export interface QuestionVerdictResult {
  verdicts: QuestionVerdict[];
  correct: number;
  total: number;
  skipped: number;
  score: number;
  passed: boolean;
}
