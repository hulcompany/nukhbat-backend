import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { UUID } from 'crypto';
import { QuestionComponentService } from './question-component.service';
import { QuestionClassifyDto } from '../dto/question-classify.dto';
import { QuestionClassifyType } from '../entity/enum/question-classify.type';
import { QuestionClassify } from '../entity/question-class.entity';
import {
  QuestionClassAnswer,
  QuestionClassVerdict,
} from '../types/question-class.types';
import { Question } from '../entity/questions.entity';

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

  async verdict(question: Question, answer: QuestionClassAnswer[]) {
    const data = question.classifyItems;

    const items = data.filter((e) => e.type === QuestionClassifyType.item);

    const categories = data.filter(
      (e) => e.type === QuestionClassifyType.category,
    );

    let res: QuestionClassVerdict[] = [];

    for (const cat of data.filter(
      (e) => e.type == QuestionClassifyType.category,
    )) {
      let a = answer
        .filter((e) => e.categoryId == cat.id)
        .flatMap((e) => e.items);
      let correctItems = data.filter(
        (e) => e.correctCategoryIndex == cat.index,
      );
      let answeredItems = data
        .filter((e) => a.includes(e.id))
        .filter((e) => e.type == QuestionClassifyType.item);
      let answeredItemsIds = new Set(answeredItems.map((e) => e.id));

      let verdict =
        answeredItems.length == correctItems.length &&
        correctItems.every((e) => answeredItemsIds.has(e.id));

      res.push({
        verdict: verdict,
        answered: { category: cat, items: answeredItems },
        correctAnswer: { category: cat, items: correctItems },
      });
    }
    return res;
  }
}
