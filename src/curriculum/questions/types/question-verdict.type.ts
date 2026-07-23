import { UUID } from 'crypto';
import { QuestionType } from '../entity/enum/question.type';
import { QuestionOption } from '../entity/question-options.entity';
import { QuestionMatch } from '../entity/question-match.entity';

// The graded outcome of a single question, produced by
// QuestionService.checkAnswers. One of the three verdict fields is set per the
// question's `type`. The `correct*` fields are only populated when answers are
// requested (withAnswers) — a review context, not a live-check.
//
// Also the shape frozen into QuestionAttempt.result, so a stored attempt keeps
// a complete "your answer vs. correct" record independent of the live rows.

export interface ChoiceVerdict {
  // the option the student picked
  answered: QuestionOption;
  // whether that option was correct
  verdict: boolean;
  // the correct option (withAnswers only)
  correctOption?: QuestionOption;
}

export interface TrueOrFalseVerdict {
  // the boolean the student answered
  answered: boolean;
  // whether it matched
  correct: boolean;
  // the correct value (withAnswers only)
  correctAnswer?: boolean;
}

export interface MatchVerdict {
  answeredBase: QuestionMatch;
  answeredMatch: QuestionMatch;
  // whether this base was paired with its correct match
  verdict: boolean;
  // the match that was the correct pair for this base (withAnswers only)
  baseCorrectMatch?: QuestionMatch;
  // the base this chosen match is actually the correct answer for, if any
  // (withAnswers only)
  matchCorrectBase?: QuestionMatch;
}

export interface QuestionVerdict {
  id: UUID;
  type: QuestionType;
  choiceVerdict?: ChoiceVerdict;
  trueOrFalseVerdict?: TrueOrFalseVerdict;
  // one entry per submitted pair; the question passes only when every
  // entry's `verdict` is true
  matchVerdicts?: MatchVerdict[];
}
