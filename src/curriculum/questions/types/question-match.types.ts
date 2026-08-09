import { UUID } from 'crypto';
import { QuestionMatch } from '../entity/question-match.entity';

export interface QuestionMatchAnswer {
  baseId: UUID;
  matchId: UUID;
}

export interface QuestionMatchVerdict {
  answeredBase?: QuestionMatch;
  // undefined when the student left this base unpaired (skipped) — verdict is
  // false and baseCorrectMatch still carries the answer key
  answeredMatch?: QuestionMatch;
  // whether this base was paired with its correct match
  verdict: boolean;
  // the match that was the correct pair for this base (withAnswers only)
  baseCorrectMatch?: QuestionMatch;
  // the base this chosen match is actually the correct answer for, if any
  // (withAnswers only)
  matchCorrectBase?: QuestionMatch;
}
