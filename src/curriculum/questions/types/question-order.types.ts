import { UUID } from 'crypto';
import { QuestionOrder } from '../entity/question-order.entity';

export interface QuestionOrderAnswer {
  id: UUID;
  order: number;
}

export interface QuestionOrderVerdict {
  answered?: QuestionOrder;
  correctAnswer: QuestionOrder;
  verdict: boolean;
}

export interface QuestionOrderResult {
  verdict: boolean;
  skipped: boolean;
  verdicts: QuestionOrderVerdict[];
}
