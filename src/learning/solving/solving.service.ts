import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UUID } from 'crypto';
import { applyPsqlFilter, BasePaginationModel, SortType } from 'core';
import { LessonAttempt } from './entity/lesson-attempt.entity';
import { AttemptGetDto } from './dto/attempt.dto';
import { StudentService } from '../../student/student.service';

// Read side of the solving module: the school/student attempt lists and the
// per-track leaderboard. Both scope forcefully — the caller passes the
// schoolId/studentId it owns, never the client.
@Injectable()
export class SolvingService {
  constructor(
    @InjectRepository(LessonAttempt)
    private readonly attempts: Repository<LessonAttempt>,
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
  // so it's live and needs no cached counter here.
  async getLeaderBoard(params: { schoolId: UUID; trackId: UUID }) {
    const rows = await this.attempts
      .createQueryBuilder('a')
      .select('a.studentId', 'studentId')
      .addSelect('COALESCE(SUM(a.xpAwarded), 0)', 'xp')
      .where('a.schoolId = :schoolId AND a.trackId = :trackId', params)
      .groupBy('a.studentId')
      .orderBy('xp', 'DESC')
      .getRawMany();

    if (!rows.length) {
      return [];
    }
    // one query for all the ranked students, then stitch each profile (+user)
    // back onto its aggregate row
    const students = await this.students.find(
      { id: In(rows.map((r) => r.studentId)) },
      { user: true },
    );
    const byId = new Map(students.map((s) => [s.id, s]));
    return rows.map((r) => ({
      studentId: r.studentId,
      xp: Number(r.xp),
      student: byId.get(r.studentId) ?? null,
    }));
  }
}
