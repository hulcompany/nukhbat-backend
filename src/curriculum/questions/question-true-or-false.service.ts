import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { UUID } from 'crypto';
import { QuestionComponentService } from './question-component.service';
import { QuestionTrueOrFalse } from './entity/question-true-or-false.entity';
import {
  TrueOrFalseAnswer,
  TrueOrFalseVerdict,
} from './types/question-true-or-false.types';
import { Question } from './entity/questions.entity';

@Injectable()
export class QuestionTrueOrFalseService extends QuestionComponentService {
  constructor(private readonly ds: DataSource) {
    super();
  }

  validate(data: boolean | undefined) {
    if (!data) {
      throw new BadRequestException('boolean is required');
    }
  }

  async verdict(
    id: UUID,
    answer: TrueOrFalseAnswer,
  ): Promise<TrueOrFalseVerdict> {
    let q = await this.ds.getRepository(Question).findOne({
      where: {
        id,
      },
    });
    if (!q) {
      throw new NotFoundException('Question Not Found');
    }
    const data = await this.ds.getRepository(QuestionTrueOrFalse).findOne({
      where: {
        questionId: id,
      },
    });
    const correctAnswer = data!.value;

    return {
      answered: answer.answered,
      verdict: answer.answered === correctAnswer,
      correctAnswer,
    };
  }

  async create(
    data: { id: UUID; data: boolean | undefined; schoolId: UUID },
    em?: EntityManager,
  ) {
    const repo =
      em?.getRepository(QuestionTrueOrFalse) ||
      this.ds.getRepository(QuestionTrueOrFalse);

    this.validate(data.data);

    await repo.insert({
      id: data.id,
      value: data.data,
      schoolId: data.schoolId,
      school: { id: data.schoolId },
    });
  }

  async deleteByIds(ids: UUID[], em?: EntityManager) {
    const repo =
      em?.getRepository(QuestionTrueOrFalse) ||
      this.ds.getRepository(QuestionTrueOrFalse);

    await repo.delete(ids);
  }
}
