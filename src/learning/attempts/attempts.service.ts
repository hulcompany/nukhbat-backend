import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DeepPartial,
  EntityManager,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { UUID } from 'crypto';
import { applyPsqlFilter, BasePaginationModel, SortType } from 'core';
import { LessonAttempt } from './entity/lesson-attempt.entity';
import { QuestionVerdictResult } from '../../curriculum';
import { DailyChallengeAttempt } from './entity/daily-challenge.attempt';
import { AttemptsGetDto } from './dto/attempts.dto';
import { QuestionAttempt } from './entity/question-attempt.entity';

// Read side of the solving module: the school/student attempt lists and the
// per-track leaderboard. Both scope forcefully — the caller passes the
// schoolId/studentId it owns, never the client.
@Injectable()
export class AttemptsService {
  constructor(
    @InjectRepository(LessonAttempt)
    private readonly attempts: Repository<LessonAttempt>,
    @InjectRepository(DailyChallengeAttempt)
    private readonly dailyChallengeAttempts: Repository<DailyChallengeAttempt>,
    @InjectRepository(QuestionAttempt)
    private readonly questionAttempts: Repository<QuestionAttempt>,
  ) {}

  // Paginated attempt list. `schoolId`/`studentId` are forced by the caller
  // (school owner → schoolId; student → both); `completed` and (for the
  // school) `studentId` are optional query filters.
  async getLessonAttemptsByCriteria(params: {
    params: AttemptsGetDto;
    schoolId?: UUID;
    studentId?: UUID;
  }) {
    const query = params.params;
    const qb = this.attempts
      .createQueryBuilder('a')
      // populate the student (with their user) plus the attempt's track/course
      // off the denormalized ids for display
      .leftJoinAndSelect('a.student', 'student')
      .leftJoinAndSelect('student.user', 'user')
      .leftJoinAndSelect('a.track', 'track')
      .leftJoinAndSelect('a.course', 'course')
      // applyPsqlFilter skips `sort` — order manually or pagination drifts
      .orderBy('a.createdAt', query.sort || SortType.Desc);

    if (params.schoolId) {
      qb.andWhere('a.schoolId = :forcedSchoolId', {
        forcedSchoolId: params.schoolId,
      });
    }
    if (params.studentId) {
      qb.andWhere('a.studentId = :forcedStudentId', {
        forcedStudentId: params.studentId,
      });
    }

    applyPsqlFilter({
      queryBuilder: qb,
      query,
      options: {
        studentId: {
          value: (v) => ['a.studentId = :studentId', { studentId: v }],
        },
        completed: {
          value: (v) => ['a.completed = :completed', { completed: v }],
        },
        lessonId: {
          value: (v) => ['a.lessonId = :lessonId', { lessonId: v }],
        },
      },
    });

    const [data, count] = await qb.getManyAndCount();
    return new BasePaginationModel({
      list: data,
      totalRecords: count,
      skip: query.skip,
      limit: query.limit,
    });
  }

  async saveLessonAttempt(
    params: DeepPartial<LessonAttempt>,
    verdicts: QuestionVerdictResult,
    em?: EntityManager,
  ) {
    const repo = em?.getRepository(LessonAttempt) ?? this.attempts;
    const count = await repo.count({
      where: {
        lessonId: params.lessonId!,
        studentId: params.studentId!,
      },
    });
    const attempt = repo.create({
      attemptNumber: count + 1,
      completed: verdicts.passed,
      courseId: params.courseId,
      lessonId: params.lessonId,
      lessonTitle: params.lessonTitle,
      questionsCorrect: verdicts.correct,
      questionsSkipped: verdicts.skipped,
      questionsTotal: verdicts.total,
      xpAwarded: params.xpAwarded,
      trackId: params.trackId,
      unitId: params.unitId,
      schoolId: params.schoolId,
      studentId: params.studentId,
      result: verdicts,
    });
    return repo.save(attempt);
  }

  async getLessonAttemptStats(lessonId: UUID, studentId: UUID) {
    const attempts = await this.attempts.find({
      where: {
        lessonId,
        studentId,
      },
    });
    return {
      attemptCount: attempts.length,
      alreadyCompleted: attempts.some((attempt) => attempt.completed),
    };
  }

  async getCompletedLessonIds(studentId: UUID, unitId: UUID) {
    const attempts = await this.attempts.find({
      where: { studentId, unitId, completed: true },
      select: { lessonId: true },
    });
    return attempts.map((attempt) => attempt.lessonId);
  }

  async saveQuestionAttempts(
    params: DeepPartial<QuestionAttempt>[],
    em?: EntityManager,
  ) {
    if (!params.length) {
      return;
    }
    const repo = em?.getRepository(QuestionAttempt) ?? this.questionAttempts;
    await repo.insert(params);
  }

  async getQuestionAttempts(filter: FindOptionsWhere<QuestionAttempt>) {
    return this.questionAttempts.find({
      where: filter,
      order: { createdAt: 'ASC' },
    });
  }

  async saveDailyChallengeAttempt(
    params: DeepPartial<DailyChallengeAttempt>,
    em?: EntityManager,
  ) {
    const repo =
      em?.getRepository(DailyChallengeAttempt) ?? this.dailyChallengeAttempts;
    return repo.save(repo.create(params));
  }

  async getDailyChallengeAttempt(id: UUID, studentId: UUID) {
    return this.dailyChallengeAttempts.findOne({
      where: {
        dailyChallengeId: id,
        studentId,
      },
    });
  }
}
