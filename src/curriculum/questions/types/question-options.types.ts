import { UUID } from 'crypto';
import { QuestionOption } from '../entity/question-options.entity';

export interface QuestionChoiceAnswer {
  answered: UUID;
  index: number;
}

export interface QuestionChoiceVerdict {
  // the option the student picked
  answered?: QuestionOption;
  // whether that option was correct
  verdict: boolean;
  // the correct option (withAnswers only)
  correctOption?: QuestionOption[];
}
