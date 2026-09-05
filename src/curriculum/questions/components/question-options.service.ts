import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { UUID } from 'crypto';
import { QuestionComponentService } from './question-component.service';
import { QuestionOptionAnswer } from '../types/question-options.types';
import { QuestionComponentVerdict } from '../types/question-verdict.type';
import { Question } from '../entity/questions.entity';
import { QuestionOptionGroupDto } from '../dto/question-option-group.dto';
import { QuestionOptionGroup } from '../entity/question-options-group.entity';
import { shuffle } from '../utils/shuffle';

@Injectable()
export class QuestionOptionsService extends QuestionComponentService {
  constructor(private readonly ds: DataSource) {
    super();
  }

  validate(groups: QuestionOptionGroupDto[]) {
    if (!groups?.length) {
      throw new BadRequestException('At least one option group is required');
    }
    const indexes = new Set(groups.map((group) => group.index));
    if (indexes.size !== groups.length) {
      throw new BadRequestException('Option-group indexes must be unique');
    }

    for (let index = 0; index < indexes.size; index++) {
      if (!indexes.has(index)) {
        throw new BadRequestException(
          'Option-group indexes must be sequential',
        );
      }
      const group = groups.find((candidate) => candidate.index === index)!;
      if (!group.options || group.options.length < 2) {
        throw new BadRequestException(
          'Each option group needs at least two options',
        );
      }
      if (!group.options.some((option) => option.isCorrect)) {
        throw new BadRequestException(
          'Each option group needs at least one correct answer',
        );
      }
    }
  }

  async verdict(
    question: Question,
    answer?: QuestionOptionAnswer[] | null,
  ): Promise<QuestionComponentVerdict> {
    const groups = [...(question.optionsGroups ?? [])].sort(
      (left, right) => left.index - right.index,
    );
    if (!groups.length) {
      throw new BadRequestException('Question has no option groups');
    }

    const answersByIndex = new Map<number, QuestionOptionAnswer>();
    for (const submitted of answer ?? []) {
      if (answersByIndex.has(submitted.index)) {
        throw new BadRequestException(
          'Only one answer is allowed per option group',
        );
      }
      const group = groups.find(
        (candidate) => candidate.index === submitted.index,
      );
      if (!group) {
        throw new BadRequestException('Option group not found');
      }
      if (!group.options.some((option) => option.id === submitted.answered)) {
        throw new BadRequestException('Option not found');
      }
      answersByIndex.set(submitted.index, submitted);
    }

    // every group must be answered with a correct option - one wrong or
    // unanswered group makes the whole question wrong
    const correct = groups.every((group) => {
      const submitted = answersByIndex.get(group.index);
      const option = submitted
        ? group.options.find((candidate) => candidate.id === submitted.answered)
        : undefined;
      return option?.isCorrect === true;
    });
    return { correct, skipped: !answer?.length };
  }

  shuffle(question: Question): Question {
    return {
      ...question,
      // groups keep their authored order (they are numbered for the student);
      // only the options inside each group move
      optionsGroups: question.optionsGroups?.map((group) => ({
        ...group,
        options: shuffle(group.options ?? []),
      })),
    } as Question;
  }

  async create(
    data: { id: UUID; schoolId: UUID; groups: QuestionOptionGroupDto[] },
    em?: EntityManager,
  ) {
    const repo =
      em?.getRepository(QuestionOptionGroup) ||
      this.ds.getRepository(QuestionOptionGroup);

    this.validate(data.groups);

    await repo.save(
      data.groups.map((group) =>
        repo.create({
          index: group.index,
          text: group.title?.trim(),
          question: { id: data.id },
          school: { id: data.schoolId },
          options: group.options.map((option) => ({
            text: option.text.trim(),
            isCorrect: option.isCorrect,
          })),
        }),
      ),
    );
  }

  async deleteByIds(ids: UUID[], em?: EntityManager) {
    const repo =
      em?.getRepository(QuestionOptionGroup) ||
      this.ds.getRepository(QuestionOptionGroup);

    await repo.delete(ids);
  }
}
