import { UUID } from 'crypto';
import { QuestionClassify } from '../entity/question-class.entity';

export interface QuestionClassAnswer {
  categoryId: UUID;
  items: UUID[];
}

export interface QuestionClassVerdict {
  verdict: boolean;
  answered?: { category: QuestionClassify; items: QuestionClassify[] }[];
  correctAnswer?: { category: QuestionClassify; items: QuestionClassify[] }[];
}
