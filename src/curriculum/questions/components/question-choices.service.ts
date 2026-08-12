import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { UUID } from 'crypto';
import { QuestionComponentService } from './question-component.service';
import {
  QuestionChoiceAnswer,
  QuestionChoiceVerdict,
} from '../types/question-options.types';
import { Question } from '../entity/questions.entity';
import { QuestionOptionGroupDto } from '../dto/question-option-group.dto';
import { QuestionOptionGroup } from '../entity/question-options-group.entity';

@Injectable()
export class QuestionChoicesService extends QuestionComponentService {
  constructor(private readonly ds: DataSource) {
    super();
  }

  validate(groups: QuestionOptionGroupDto[]) {
    if (!groups.length) {
      throw new BadRequestException('You Need at least one group');
    }
    let indicies = new Set<number>(groups.map((e) => e.index));

    for (let i = 0; i < indicies.size; i++) {
      if (!indicies.has(i)) {
        throw new BadRequestException(`Groups indicies must be sequential.`);
      }
      let group = groups.find((e) => e.index == i);
      let correct = group!.options.find((e) => e.isCorrect);
      if (!correct) {
        throw new BadRequestException(
          `Each Index needs at least one correct answer`,
        );
      }
    }
  }

  async verdict(question: Question, answer: QuestionChoiceAnswer[]) {

    const data = question.optionsGroups

    const maxIndex = data
      .map((e) => e.index)
      .filter((index): index is number => index !== undefined)
      .reduce<number | undefined>(
        (max, index) => (max === undefined ? index : Math.max(max, index)),
        undefined,
      );
    if (!maxIndex) {
      throw new Error('No Groups');
    }
    let res: QuestionChoiceVerdict[] = [];
    for (let i = 0; i < maxIndex; i++) {
      let a = answer.find((e) => e.index == i);
      let group = data.find((e) => e.index == i);
      if (!a) {
        res.push({
          verdict: false,
          correctOption: group?.options.filter((e) => e.isCorrect) || [],
        });
        continue;
      }

      let option = group!.options.find((e) => e.id == a.answered);
      res.push({
        verdict: option?.isCorrect || false,
        answered: option,
        correctOption: group?.options.filter((e) => e.isCorrect) || [],
      });
    }
    return res;
  }

  async create(
    data: { id: UUID; schoolId: UUID; groups: QuestionOptionGroupDto[] },
    em?: EntityManager,
  ) {
    const repo =
      em?.getRepository(QuestionOptionGroup) ||
      this.ds.getRepository(QuestionOptionGroup);

    this.validate(data.groups);

    await repo.insert(
      data.groups.map((e) => ({
        options: e.options,
        index: e.index,
        text: e.title,
        questionId: data.id,
        schoolId: data.schoolId,
      })),
    );
  }

  async deleteByIds(ids: UUID[], em?: EntityManager) {
    const repo =
      em?.getRepository(QuestionOptionGroup) ||
      this.ds.getRepository(QuestionOptionGroup);

    await repo.delete(ids);
  }
}
