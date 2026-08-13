import { UUID } from 'crypto';
import { QuestionType } from '../entity/enum/question.type';
import { Question } from '../entity/questions.entity';

export interface QuestionMap {
  question: Question;
  answer: Record<string, any>;
}

export interface QuestionVerdict {
  id: UUID;
  title: string;
  type: QuestionType;
  verdict: boolean;
  isSkipped: boolean;
  result: any;
}
