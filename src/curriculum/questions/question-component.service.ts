import { UUID } from 'crypto';
import { EntityManager } from 'typeorm';

export abstract class QuestionComponentService {
  abstract create(data: any, em?: EntityManager): Promise<any>;
  abstract deleteByIds(ids: UUID[], em?: EntityManager): Promise<any>;
  abstract verdict(data: any, answer: any);
  abstract validate(input: any); 
}
