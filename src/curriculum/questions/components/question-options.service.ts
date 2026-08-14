import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { UUID } from 'crypto';
import { QuestionComponentService } from './question-component.service';
import {
  QuestionOptionAnswer,
  QuestionOptionVerdict,
  QuestionOptionsResult,
} from '../types/question-options.types';
import { Question } from '../entity/questions.entity';
import { QuestionOptionGroupDto } from '../dto/question-option-group.dto';
import { QuestionOptionGroup } from '../entity/question-options-group.entity';

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
  ): Promise<QuestionOptionsResult> {
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

    const result: QuestionOptionVerdict[] = [];
    for (const group of groups) {
      const submitted = answersByIndex.get(group.index);
      if (!submitted) {
        result.push({
          verdict: false,
          correctOption: group.options.filter((option) => option.isCorrect),
        });
        continue;
      }

      const option = group.options.find(
        (candidate) => candidate.id === submitted.answered,
      );
      result.push({
        verdict: option?.isCorrect || false,
        answered: option,
        correctOption: group.options.filter((candidate) => candidate.isCorrect),
      });
    }
    return {
      verdict: result.every((item) => item.verdict),
      skipped: !answer?.length,
      verdicts: result,
    };
  }

  hideAnswers(question: Question) {
    return {
      ...question,
      optionsGroups: question.optionsGroups?.map((group) => ({
        ...group,
        options: group.options?.map(({ isCorrect, ...option }) => option),
      })),
    };
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
