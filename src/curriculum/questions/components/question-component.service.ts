import { UUID } from 'crypto';
import { EntityManager } from 'typeorm';
import { Question } from '../entity/questions.entity';

export abstract class QuestionComponentService {
  abstract create(data: any, em?: EntityManager): Promise<any>;
  abstract deleteByIds(ids: UUID[], em?: EntityManager): Promise<any>;
  abstract verdict(question: Question, answer: any): Promise<any>;
  abstract hideAnswers(question: Question): any;
  abstract validate(input: any): void;

  /**
   * Randomises the presentation order of the component's items. Called once,
   * when the student starts solving, so the shuffled order is what lands in
   * the snapshot *and* in the response - the two stay in sync.
   *
   * Every verdict() resolves items by id/index, never by array position, so
   * reordering is grading-safe. Types with nothing to shuffle keep this no-op.
   */
  shuffle(question: Question): Question {
    return question;
  }
}
