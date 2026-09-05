import { UUID } from 'crypto';

export interface QuestionOptionAnswer {
  answered: UUID;
  index: number;
}
