import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { UUID } from 'crypto';
import { QuestionComponentService } from '.././components/question-component.service';
import { QuestionTrueOrFalse } from '.././entity/question-true-or-false.entity';
import { TrueOrFalseAnswer } from '.././types/question-true-or-false.types';
import { QuestionComponentVerdict } from '../types/question-verdict.type';
import { Question } from '.././entity/questions.entity';

@Injectable()
export class QuestionTrueOrFalseService extends QuestionComponentService {
  constructor(private readonly ds: DataSource) {
    super();
  }

  validate(data: boolean | undefined | null) {
    if (typeof data !== 'boolean') {
      throw new BadRequestException('boolean is required');
    }
  }

  async verdict(
    question: Question,
    answer?: TrueOrFalseAnswer | null,
  ): Promise<QuestionComponentVerdict> {
    if (!question.trueOrFalse) {
      throw new BadRequestException('Question has no true-or-false answer');
    }
    return {
      correct: answer?.answered === question.trueOrFalse.value,
      skipped: answer?.answered === undefined,
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

    await repo.save(
      repo.create({
        value: data.data,
        question: { id: data.id },
        school: { id: data.schoolId },
      }),
    );
  }

  async deleteByIds(ids: UUID[], em?: EntityManager) {
    const repo =
      em?.getRepository(QuestionTrueOrFalse) ||
      this.ds.getRepository(QuestionTrueOrFalse);

    await repo.delete(ids);
  }
}
