import { UUID } from 'crypto';
import { EntityManager } from 'typeorm';
import { Question } from '../entity/questions.entity';

export abstract class QuestionComponentService {
  abstract create(data: any, em?: EntityManager): Promise<any>;
  abstract deleteByIds(ids: UUID[], em?: EntityManager): Promise<any>;
  abstract verdict(question: Question, answer: any): Promise<any>;
  abstract hideAnswers(question: Question): any;
  abstract validate(input: any): void;
}
