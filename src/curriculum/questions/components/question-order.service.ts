import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { UUID } from 'crypto';

import { QuestionComponentService } from '.././components/question-component.service';
import { QuestionOrder } from '.././entity/question-order.entity';
import {
  QuestionOrderAnswer,
  QuestionOrderVerdict,
} from '.././types/question-order.types';
import { QuestionOrderDto } from '.././dto/question-order.dto';

@Injectable()
export class QuestionOrderService extends QuestionComponentService {
  constructor(private readonly ds: DataSource) {
    super();
  }

  validate(data: QuestionOrderDto[]) {
    if (!data?.length) {
      throw new BadRequestException('Order question should have items');
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

    await repo.insert(
      data.data.map((e, index) => ({
        questionId: data.id,
        schoolId: data.schoolId,
        text: e.text,
        sort: index,
      })),
    );
  }

  async deleteByIds(ids: UUID[], em?: EntityManager) {
    const repo =
      em?.getRepository(QuestionOrder) || this.ds.getRepository(QuestionOrder);

    await repo.delete(ids);
  }

  async verdict(
    id: UUID,
    answer: QuestionOrderAnswer[],
  ): Promise<QuestionOrderVerdict> {
    const repo = this.ds.getRepository(QuestionOrder);

    const data = await repo.find({
      where: {
        questionId: id,
      },
      order: {
        sort: 'ASC',
      },
    });

    const answered: QuestionOrder[] = [];

    for (const item of answer ?? []) {
      const entity = data.find((e) => e.id === item.id);

      if (!entity) {
        throw new NotFoundException('Order item not found');
      }

      answered.push(entity);
    }

    const verdict =
      answered.length === data.length &&
      answered.every((item, index) => item.sort === index);

    return {
      verdict,
      answer: answered,
    };
  }
}
