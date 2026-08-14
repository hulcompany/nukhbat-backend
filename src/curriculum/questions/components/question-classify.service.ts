import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { UUID } from 'crypto';
import { QuestionComponentService } from './question-component.service';
import { QuestionClassifyDto } from '../dto/question-classify.dto';
import { QuestionClassifyType } from '../entity/enum/question-classify.type';
import { QuestionClassify } from '../entity/question-class.entity';
import {
  QuestionClassAnswer,
  QuestionClassResult,
  QuestionClassVerdict,
} from '../types/question-class.types';
import { Question } from '../entity/questions.entity';

@Injectable()
export class QuestionClassifyService extends QuestionComponentService {
  constructor(private readonly ds: DataSource) {
    super();
  }

  validate(data: QuestionClassifyDto[]) {
    if (!data?.length) {
      throw new BadRequestException('Classify question should have data');
    }
    const categories = data.filter(
      (e) => e.type === QuestionClassifyType.category,
    );

    const items = data.filter((e) => e.type === QuestionClassifyType.item);

    if (!categories.length) {
      throw new BadRequestException('Classify question should have categories');
    }

    if (!items.length) {
      throw new BadRequestException('Classify question should have items');
    }

    if (
      categories.some((category) => category.correctCategoryIndex !== undefined)
    ) {
      throw new BadRequestException(
        'Categories cannot have a correct category index',
      );
    }

    for (const item of items) {
      if (item.correctCategoryIndex == null) {
        throw new BadRequestException('Item should have correct category');
      }

      if (
        item.correctCategoryIndex < 0 ||
        item.correctCategoryIndex >= data.length
      ) {
        throw new BadRequestException('Correct category index is wrong');
      }

      const correct = data[item.correctCategoryIndex];

      if (correct.type !== QuestionClassifyType.category) {
        throw new BadRequestException(
          'Correct answer should point to category',
        );
      }
    }
  }

  async create(
    data: { id: UUID; schoolId: UUID; data: QuestionClassifyDto[] },
    em?: EntityManager,
  ) {
    const repo =
      em?.getRepository(QuestionClassify) ||
      this.ds.getRepository(QuestionClassify);

    this.validate(data.data);

    await repo.save(
      data.data.map((item, index) =>
        repo.create({
          question: { id: data.id },
          school: { id: data.schoolId },
          index,
          correctCategoryIndex: item.correctCategoryIndex ?? null,
          text: item.text.trim(),
          type: item.type,
        }),
      ),
    );
  }

  async deleteByIds(ids: UUID[], em?: EntityManager) {
    const repo =
      em?.getRepository(QuestionClassify) ||
      this.ds.getRepository(QuestionClassify);

    await repo.delete(ids);
  }

  async verdict(
    question: Question,
    answer?: QuestionClassAnswer[] | null,
  ): Promise<QuestionClassResult> {
    const data = question.classifyItems ?? [];
    const categories = data.filter(
      (e) => e.type === QuestionClassifyType.category,
    );
    const items = data.filter((e) => e.type === QuestionClassifyType.item);
    if (!categories.length || !items.length) {
      throw new BadRequestException('Question has invalid classify data');
    }
    const categoriesById = new Map(
      categories.map((category) => [category.id, category]),
    );
    const itemsById = new Map(items.map((item) => [item.id, item]));
    const assignedItemIds = new Set<UUID>();
    const submittedCategoryIds = new Set<UUID>();

    for (const submitted of answer ?? []) {
      if (!categoriesById.has(submitted.categoryId)) {
        throw new BadRequestException('Category not found');
      }
      if (submittedCategoryIds.has(submitted.categoryId)) {
        throw new BadRequestException('A category can only be submitted once');
      }
      submittedCategoryIds.add(submitted.categoryId);
      for (const itemId of submitted.items) {
        if (!itemsById.has(itemId)) {
          throw new BadRequestException('Classify item not found');
        }
        if (assignedItemIds.has(itemId)) {
          throw new BadRequestException(
            'A classify item can only be assigned once',
          );
        }
        assignedItemIds.add(itemId);
      }
    }

    const result: QuestionClassVerdict[] = [];

    for (const category of categories) {
      const answeredItemIds = (answer ?? [])
        .filter((submitted) => submitted.categoryId === category.id)
        .flatMap((submitted) => submitted.items);
      const correctItems = items.filter(
        (item) => item.correctCategoryIndex === category.index,
      );
      const answeredItems = answeredItemIds.map(
        (itemId) => itemsById.get(itemId)!,
      );
      const answeredItemsIds = new Set(answeredItems.map((item) => item.id));

      const verdict =
        answeredItems.length == correctItems.length &&
        correctItems.every((item) => answeredItemsIds.has(item.id));

      result.push({
        verdict,
        answered: { category, items: answeredItems },
        correctAnswer: { category, items: correctItems },
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
      classifyItems: question.classifyItems?.map(
        ({ correctCategoryIndex, ...item }) => item,
      ),
    };
  }
}
