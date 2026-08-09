import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { UUID } from 'crypto';
import { QuestionComponentService } from './question-component.service';
import { QuestionClassifyType } from './entity/enum/question-classify.type';
import {
  QuestionClassAnswer,
  QuestionClassVerdict,
} from './types/question-class.types';
import { QuestionClassify } from './entity/question-class.entity';
import { QuestionClassifyDto } from './dto/question-classify.dto';

@Injectable()
export class QuestionClassifyService extends QuestionComponentService {
  constructor(private readonly ds: DataSource) {
    super();
  }

  validate(data: QuestionClassifyDto[]) {
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

    await repo.insert(
      data.data.map((e, i) => ({
        questionId: data.id,
        schoolId: data.schoolId,
        index: i,
        correctCategoryIndex: e.correctCategoryIndex ?? null,
        text: e.text,
        type: e.type,
      })),
    );
  }

  async deleteByIds(ids: UUID[], em?: EntityManager) {
    const repo =
      em?.getRepository(QuestionClassify) ||
      this.ds.getRepository(QuestionClassify);

    await repo.delete(ids);
  }

  async verdict(
    id: UUID,
    answer: QuestionClassAnswer[],
  ): Promise<QuestionClassVerdict> {
    const data = await this.ds.getRepository(QuestionClassify).find({
      where: {
        questionId: id,
      },
      order: {
        index: 'ASC',
      },
    });

    const items = data.filter((e) => e.type === QuestionClassifyType.item);

    const categories = data.filter(
      (e) => e.type === QuestionClassifyType.category,
    );

    const answered: {
      category: QuestionClassify;
      items: QuestionClassify[];
    }[] = [];

    // validate student answer
    for (const categoryAnswer of answer ?? []) {
      const category = categories.find(
        (e) => e.id === categoryAnswer.categoryId,
      );

      if (!category) {
        throw new NotFoundException('Category not found');
      }

      const categoryItems: QuestionClassify[] = [];

      for (const itemId of categoryAnswer.items ?? []) {
        const item = items.find((e) => e.id === itemId);

        if (!item) {
          throw new NotFoundException('Item not found');
        }

        categoryItems.push(item);
      }

      answered.push({
        category,
        items: categoryItems,
      });
    }

    const correctAnswer = categories.map((category) => ({
      category,
      items: items.filter(
        (item) => item.correctCategoryIndex === category.index,
      ),
    }));

    const answeredMap = new Map<UUID, QuestionClassify[]>();

    for (const answerGroup of answered) {
      answeredMap.set(answerGroup.category.id, answerGroup.items);
    }

    const verdict = items.every((item) => {
      const correctCategory = categories.find(
        (category) => category.index === item.correctCategoryIndex,
      );

      if (!correctCategory) {
        return false;
      }

      const studentCategoryItems = answeredMap.get(correctCategory.id) ?? [];

      return studentCategoryItems.some(
        (studentItem) => studentItem.id === item.id,
      );
    });

    return {
      verdict,
      answered,
      correctAnswer,
    };
  }
}
