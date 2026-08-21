import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  FindOptionsWhere,
  In,
  Repository,
} from 'typeorm';
import { UUID } from 'crypto';
import { CurriculumService } from '../../curriculum/services/curriculum.service';
import { SavedQuestion } from './entity/saved-question.entity';

@Injectable()
export class SavedQuestionService {
  constructor(
    @InjectRepository(SavedQuestion)
    private readonly repo: Repository<SavedQuestion>,
    private readonly curriculum: CurriculumService,
  ) {}

  private getRepo(em?: EntityManager) {
    return em?.getRepository(SavedQuestion) ?? this.repo;
  }

  // no pagination — a student's saved list is small
  async findAll(studentProfileId: UUID, em?: EntityManager) {
    return this.getRepo(em).find({
      where: { studentProfileId },
      order: { createdAt: 'DESC' },
    });
  }

  async getSaved(studentProfileId: UUID) {
    const savedQuestions = await this.findAll(studentProfileId);
    if (!savedQuestions.length) {
      return [];
    }

    // Reload through findQuestions so the nested question carries the same
    // relations as the solving flows — the entity's eager relation is shallower
    // (no course/lesson/school) and would hand clients a different shape.
    const loadedQuestions = await this.curriculum.findQuestions({
      id: In(savedQuestions.map((saved) => saved.questionId)),
    });
    const hiddenById = new Map<UUID, any>(
      this.curriculum
        .hideQuestionAnswers(loadedQuestions)
        .map((question): [UUID, any] => [question.id, question]),
    );

    return savedQuestions
      .filter((saved) => hiddenById.has(saved.questionId))
      .map((saved) => ({
        ...saved,
        question: hiddenById.get(saved.questionId),
      }));
  }

  async findOneOrFail(filter: FindOptionsWhere<SavedQuestion>) {
    const saved = await this.repo.findOne({ where: filter });
    if (!saved) {
      throw new NotFoundException('Saved question not found');
    }
    return saved;
  }

  async save(studentProfileId: UUID, questionId: UUID, em?: EntityManager) {
    await this.saveMany(studentProfileId, [questionId], em);
    return this.getRepo(em).findOne({
      where: { studentProfileId, questionId },
    });
  }

  async saveMany(
    studentProfileId: UUID,
    questionIds: UUID[],
    em?: EntityManager,
  ) {
    const uniqueIds = [...new Set(questionIds)];
    if (!uniqueIds.length) {
      return;
    }
    await this.getRepo(em)
      .createQueryBuilder()
      .insert()
      .into(SavedQuestion)
      .values(uniqueIds.map((questionId) => ({ studentProfileId, questionId })))
      .orIgnore()
      .execute();
  }

  async remove(filter: FindOptionsWhere<SavedQuestion>, em?: EntityManager) {
    return this.getRepo(em).delete(filter);
  }

  async removeByQuestionIds(
    studentProfileId: UUID,
    questionIds: UUID[],
    em?: EntityManager,
  ) {
    const uniqueIds = [...new Set(questionIds)];
    if (!uniqueIds.length) {
      return;
    }
    await this.getRepo(em).delete({
      studentProfileId,
      questionId: In(uniqueIds),
    });
  }

}
