import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { UUID } from 'crypto';

import { QuestionComponentService } from '.././components/question-component.service';
import { QuestionOrder } from '.././entity/question-order.entity';
import {
  QuestionOrderAnswer,
  QuestionOrderResult,
  QuestionOrderVerdict,
} from '.././types/question-order.types';
import { QuestionOrderDto } from '.././dto/question-order.dto';
import { Question } from '../entity/questions.entity';

@Injectable()
export class QuestionOrderService extends QuestionComponentService {
  constructor(private readonly ds: DataSource) {
    super();
  }

  validate(data: QuestionOrderDto[]) {
    if (!data || data.length < 2) {
      throw new BadRequestException(
        'Order question should have at least two items',
      );
    }
  }

  async create(
    data: {
      id: UUID;
      schoolId: UUID;
      data: QuestionOrderDto[];
    },
    em?: EntityManager,
  ) {
    const repo =
      em?.getRepository(QuestionOrder) || this.ds.getRepository(QuestionOrder);

    this.validate(data.data);

    await repo.save(
      data.data.map((item, index) =>
        repo.create({
          question: { id: data.id },
          school: { id: data.schoolId },
          text: item.text.trim(),
          sort: index,
        }),
      ),
    );
  }

  async deleteByIds(ids: UUID[], em?: EntityManager) {
    const repo =
      em?.getRepository(QuestionOrder) || this.ds.getRepository(QuestionOrder);

    await repo.delete(ids);
  }

  async verdict(
    question: Question,
    answer?: QuestionOrderAnswer[] | null,
  ): Promise<QuestionOrderResult> {
    const items = [...(question.orderItems ?? [])].sort(
      (left, right) => left.sort - right.sort,
    );
    if (!items.length) {
      throw new BadRequestException('Question has no order items');
    }
    const submittedOrders = new Set<number>();
    const submittedIds = new Set<UUID>();
    for (const submitted of answer ?? []) {
      if (!items.some((item) => item.id === submitted.id)) {
        throw new BadRequestException('Order item not found');
      }
      if (submittedIds.has(submitted.id)) {
        throw new BadRequestException(
          'An order item can only be submitted once',
        );
      }
      if (
        !Number.isInteger(submitted.order) ||
        submitted.order < 0 ||
        submitted.order >= items.length ||
        submittedOrders.has(submitted.order)
      ) {
        throw new BadRequestException(
          'Submitted order must be unique and sequential',
        );
      }
      submittedIds.add(submitted.id);
      submittedOrders.add(submitted.order);
    }

    const submittedByOrder = new Map(
      (answer ?? []).map((submitted) => [submitted.order, submitted]),
    );
    const verdicts: QuestionOrderVerdict[] = items.map((correctAnswer) => {
      const submitted = submittedByOrder.get(correctAnswer.sort);
      const answered = submitted
        ? items.find((item) => item.id === submitted.id)
        : undefined;
      return {
        answered,
        correctAnswer,
        verdict: answered?.id === correctAnswer.id,
      };
    });

    return {
      verdict: verdicts.every((item) => item.verdict),
      skipped: !answer?.length,
      verdicts,
    };
  }

  hideAnswers(question: Question) {
    return {
      ...question,
      orderItems: this.shuffle(question.orderItems ?? []).map(
        ({ sort, ...item }) => item,
      ),
    };
  }

  shuffle(items: QuestionOrder[]): QuestionOrder[] {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [
        shuffled[randomIndex],
        shuffled[index],
      ];
    }
    return shuffled;
  }
}
