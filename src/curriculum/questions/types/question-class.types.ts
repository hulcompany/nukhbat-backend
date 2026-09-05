import { UUID } from 'crypto';

export interface QuestionClassAnswer {
  categoryId: UUID;
  items: UUID[];
}
