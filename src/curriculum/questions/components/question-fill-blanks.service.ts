import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { UUID } from 'crypto';
import { QuestionComponentService } from './question-component.service';
import { QuestionFillBlankDto } from '../dto/question-blank.dto';
import { QuestionFillBlank } from '../entity/question-fill-blank.entity';


@Injectable()
export class QuestionFillBlankService extends QuestionComponentService {
  constructor(private readonly ds: DataSource) {
    super();
  }

  validate(data: QuestionFillBlankDto[]) {
    if (!data?.length) {
      throw new BadRequestException('Fill blank question should have blanks');
    }

    const indexes = data.map((e) => e.index);

    const uniqueIndexes = new Set(indexes);

    if (uniqueIndexes.size !== indexes.length) {
      throw new BadRequestException('Blank indexes should be unique');
    }

    const sortedIndexes = [...indexes].sort((a, b) => a - b);

    sortedIndexes.forEach((index, position) => {
      if (index !== position) {
        throw new BadRequestException(
          'Blank indexes should start from 0 and be sequential',
        );
      }
    });

    for (const item of data) {
      if (!item.answers?.length) {
        throw new BadRequestException('Blank should have answers');
      }
    }
  }

  async create(
    data: {
      id: UUID;
      schoolId: UUID;
      data: QuestionFillBlankDto[];
    },
    em?: EntityManager,
  ) {
    const repo =
      em?.getRepository(QuestionFillBlank) ||
      this.ds.getRepository(QuestionFillBlank);

    this.validate(data.data);

    await repo.insert(
      data.data.map((e) => ({
        questionId: data.id,
        schoolId: data.schoolId,
        index: e.index,
        answers: e.answers,
      })),
    );
  }

  async deleteByIds(ids: UUID[], em?: EntityManager) {
    const repo =
      em?.getRepository(QuestionFillBlank) ||
      this.ds.getRepository(QuestionFillBlank);

    await repo.delete(ids);
  }

  async verdict(
    id: UUID,
    answer: QuestionFillBlanksAnswer[],
  ): Promise<QuestionFillBlanksVerdict[]> {
    const repo = this.ds.getRepository(QuestionFillBlank);
    const blanks = await repo.find({
      where: {
        questionId: id,
      },
      order: {
        index: 'ASC',
      },
    });
    const result: QuestionFillBlanksVerdict[] = [];
    for (const blank of blanks) {
      let a = answer.find((e) => e.index);
      result.push({
        answer: a?.answer,
        correctAnswer: blank.answers,
        index: blank.index,
        verdict: blank.answers.includes(a?.answer || ''),
      });
    }
    return result;
  }
}
