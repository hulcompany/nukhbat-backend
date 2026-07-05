import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Faq } from './entity/faq.entity';
import { FaqCreateDto, FaqEditDto } from './dto/faq.dto';
import { NotFoundException } from '@nestjs/common';
import { UUID } from 'crypto';

export class FaqService {
  constructor(
    @InjectRepository(Faq) private readonly faqRepo: Repository<Faq>,
  ) {}

  async createFaq(dto: FaqCreateDto) {
    const faq = this.faqRepo.create(dto);
    return await this.faqRepo.save(faq);
  }

  async getAllFaqs() {
    return await this.faqRepo.find();
  }

  async getOneOrFail(params: FindOptionsWhere<Faq>) {
    const faq = await this.faqRepo.findOne({
      where: params,
    });
    if (!faq) {
      throw new NotFoundException();
    }
    return faq;
  }

  async edit(id: UUID, dto: FaqEditDto) {
    const faq = await this.getOneOrFail({ id });

    Object.assign(faq, dto);

    return this.faqRepo.save(faq);
  }

  async delete(id: UUID) {
    const result = await this.faqRepo.delete(id);

    if (!result.affected) {
      throw new NotFoundException('FAQ not found');
    }
  }
}
