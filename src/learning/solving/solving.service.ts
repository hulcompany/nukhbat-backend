import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { UUID } from 'crypto';
import {
  applyPsqlFilter,
  BasePaginationDto,
  BasePaginationModel,
  SortType,
} from 'core';
import { LessonAttempt } from './entity/lesson-attempt.entity';
import { AttemptGetDto } from './dto/attempt.dto';
import { StudentService } from '../../student/student.service';
import { QuestionAttempt } from './entity/question-attempt.entity';

// Read side of the solving module: the school/student attempt lists and the
// per-track leaderboard. Both scope forcefully — the caller passes the
// schoolId/studentId it owns, never the client.
@Injectable()
export class SolvingService {
  constructor(
    @InjectRepository(LessonAttempt)
    private readonly attempts: Repository<LessonAttempt>,
    @InjectRepository(QuestionAttempt)
    private readonly questionAttempts: Repository<QuestionAttempt>,
    private readonly students: StudentService,
  ) {}

  // Paginated attempt list. `schoolId`/`studentId` are forced by the caller
  // (school owner → schoolId; student → both); `completed` and (for the
  // school) `studentId` are optional query filters.
  async getAttemptsByCriteria(params: {
    params: AttemptGetDto;
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

  // Leaderboard for a school's track: total XP earned per student, biggest
  // first. Aggregated straight off the attempts (xpAwarded is frozen per row),
  // so it's live and needs no cached counter here. Paginated (skip/limit/sort)
  // like the rest of the list endpoints; totalRecords counts the ranked
  // students, not the underlying attempts.
  async getLeaderBoard(params: {
    schoolId: UUID;
    trackId: UUID;
    query: BasePaginationDto;
  }) {
    const { schoolId, trackId, query } = params;
    // shared scope for both the count and the page
    const scoped = () =>
      this.attempts
        .createQueryBuilder('a')
        .where('a.schoolId = :schoolId AND a.trackId = :trackId', {
          schoolId,
          trackId,
        });

    // how many students appear on this board (one row per student)
    const totalRow = await scoped()
      .select('COUNT(DISTINCT a.studentId)', 'count')
      .getRawOne<{ count: string }>();
    const totalRecords = Number(totalRow?.count ?? 0);

    // raw grouped page — offset/limit, not skip/take, since there's no entity
    const rows = await scoped()
      .select('a.studentId', 'studentId')
      .addSelect('COALESCE(SUM(a.xpAwarded), 0)', 'xp')
      .groupBy('a.studentId')
      .orderBy('xp', query.sort || SortType.Desc)
      .offset(query.skip)
      .limit(query.limit)
      .getRawMany();

    // one query for all the ranked students on this page, then stitch each
    // profile (+user) back onto its aggregate row
    const students = rows.length
      ? await this.students.find(
          { id: In(rows.map((r) => r.studentId)) },
          { user: true },
        )
      : [];
    const byId = new Map(students.map((s) => [s.id, s]));
    const list = rows.map((r) => ({
      studentId: r.studentId,
      xp: Number(r.xp),
      student: byId.get(r.studentId) ?? null,
    }));

    return new BasePaginationModel({
      list,
      totalRecords,
      skip: query.skip,
      limit: query.limit,
    });
  }

  // Per-question breakdown of a single lesson attempt, oldest-graded first.
  // The caller forces the scope so a client can never read another's attempt:
  //   - school:  { lessonAttemptId, lessonAttempt: { schoolId } }
  //   - student: { lessonAttemptId, studentId }
  // Each row's `result` already carries the frozen answer-vs-correct snapshot
  // (incl. the question title), so no live joins are needed for review.
  async getQuestionAttempts(filter: FindOptionsWhere<QuestionAttempt>) {
    return await this.questionAttempts.find({
      where: filter,
      order: { createdAt: 'ASC' },
    });
  }
}
