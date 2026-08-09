import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { UUID } from 'crypto';
import { QuestionComponentService } from './question-component.service';
import { QuestionOption } from './entity/question-options.entity';
import { QuestionOptionDto } from './dto/question-option.dto';
import {
  QuestionChoiceAnswer,
  QuestionChoiceVerdict,
} from './types/question-options.types';
import { Question } from './entity/questions.entity';
import { QuestionType } from './entity/enum/question.type';

@Injectable()
export class QuestionChoicesService extends QuestionComponentService {
  constructor(private readonly ds: DataSource) {
    super();
  }

  validate(options: QuestionOptionDto[]) {
    if (options.length < 2) {
      throw new BadRequestException('Question should have at least 2 options');
    }

    const correctCount = options.filter((e) => e.isCorrect).length;

    if (correctCount === 0) {
      throw new BadRequestException('Question should have one correct option');
    }
  }

  async verdict(id: UUID, answer: QuestionChoiceAnswer) {
    let type = (
      await this.ds.getRepository(Question).findOne({ where: { id: id } })
    )?.type;
    if (!type) {
      throw new NotFoundException('Question not found');
    }

    const data = await this.ds.getRepository(QuestionOption).find({
      where: {
        questionId: id,
      },
    });

    for (const optionId of answer.answered) {
      if (!data.find((e) => e.id === optionId)) {
        throw new NotFoundException(optionId + ' Option not found');
      }
    }

    const correctOptions = data.filter((e) => e.isCorrect);

    const answered = data.filter((e) => answer.answered.includes(e.id));

    const hasWrongAnswer = answered.some((e) => !e.isCorrect);

    let verdict = false;

    if (!hasWrongAnswer) {
      if (type === QuestionType.OPTIONS) {
        // لازم كل الصحيح فقط
        verdict =
          answered.length === correctOptions.length &&
          answered.every((e) => e.isCorrect);
      }

      if (type === QuestionType.multiOptions) {
        // يكفي اختيار واحد صحيح أو أكثر
        verdict = answered.length > 0 && answered.some((e) => e.isCorrect);
      }
    }

    return {
      verdict,
      answered,
      correctOption: correctOptions,
    } as QuestionChoiceVerdict;
  }

  async create(data: QuestionOption[], em?: EntityManager) {
    const repo =
      em?.getRepository(QuestionOption) ||
      this.ds.getRepository(QuestionOption);

    this.validate(data);

    await repo.insert(data);
  }

  async deleteByIds(ids: UUID[], em?: EntityManager) {
    const repo =
      em?.getRepository(QuestionOption) ||
      this.ds.getRepository(QuestionOption);

    await repo.delete(ids);
  }
}
