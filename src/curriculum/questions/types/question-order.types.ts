import { UUID } from 'crypto';
import { QuestionOrder } from '../entity/question-order.entity';

export interface QuestionOrderAnswer {
  id: UUID;
  order: number;
}

export interface QuestionOrderVerdict {
  verdict: boolean;
  answer: QuestionOrder[];
}
