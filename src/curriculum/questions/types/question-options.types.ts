import { UUID } from 'crypto';
import { QuestionOption } from '../entity/question-options.entity';

export interface QuestionOptionAnswer {
  answered: UUID;
  index: number;
}

export interface QuestionOptionVerdict {
  // the option the student picked
  answered?: QuestionOption;
  // whether that option was correct
  verdict: boolean;
  // the correct option (withAnswers only)
  correctOption?: QuestionOption[];
}

export interface QuestionOptionsResult {
  verdict: boolean;
  skipped: boolean;
  verdicts: QuestionOptionVerdict[];
}
