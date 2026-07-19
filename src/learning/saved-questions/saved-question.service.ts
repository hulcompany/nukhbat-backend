import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { UUID } from 'crypto';
import { SavedQuestion } from './entity/saved-question.entity';

@Injectable()
export class SavedQuestionService {
  constructor(
    @InjectRepository(SavedQuestion)
    private readonly repo: Repository<SavedQuestion>,
  ) {}

  // no pagination — a student's saved list is small
  async findAll(studentProfileId: UUID) {
    return this.repo.find({
      where: { studentProfileId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOneOrFail(filter: FindOptionsWhere<SavedQuestion>) {
    const saved = await this.repo.findOne({ where: filter });
    if (!saved) {
      throw new NotFoundException('Saved question not found');
    }
    return saved;
  }

  // idempotent: saving the same question twice returns the existing row
  // (the unique index would reject a second insert anyway)
  async save(studentProfileId: UUID, questionId: UUID) {
    const existing = await this.repo.findOne({
      where: { studentProfileId, questionId },
    });
    if (existing) {
      return existing;
    }
    return this.repo.save(this.repo.create({ studentProfileId, questionId }));
  }

  async remove(filter: FindOptionsWhere<SavedQuestion>) {
    const res = await this.repo.delete(filter);
    if (!res.affected) {
      throw new NotFoundException('Saved question not found');
    }
  }
}
