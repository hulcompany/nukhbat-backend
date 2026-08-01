import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UUID } from 'crypto';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  FindOptionsRelations,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { applyPsqlFilter, BasePaginationModel, SortType } from 'core';
import { StudentProfile } from './entity/student-profile.entity';
import { StudentProfileGetDto } from './dto/student.dto';
import { max } from 'lodash';
import { StudentActivity } from './entity/student-activity.entity';

// student-side profile access — owns the repo ops; the school-side
// service composes these with a schoolId scope
@Injectable()
export class StudentService {
  constructor(
    @InjectRepository(StudentProfile)
    private readonly repo: Repository<StudentProfile>,
    private readonly ds: DataSource,
  ) {}

  // every function takes an optional EntityManager so callers can join
  // an outer transaction() (e.g. redeeming a subscription key)
  private getRepo(em?: EntityManager) {
    return em?.getRepository(StudentProfile) ?? this.repo;
  }

  async find(
    filter: FindOptionsWhere<StudentProfile>,
    relations?: FindOptionsRelations<StudentProfile>,
    em?: EntityManager,
  ) {
    return await this.getRepo(em).find({
      where: filter,
      relations: relations,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(
    filter: FindOptionsWhere<StudentProfile>,
    relations?: FindOptionsRelations<StudentProfile>,
    em?: EntityManager,
  ) {
    return await this.getRepo(em).findOne({
      where: filter,
      relations: relations,
    });
  }

  async findOneOrFail(
    filter: FindOptionsWhere<StudentProfile>,
    relations?: FindOptionsRelations<StudentProfile>,
    em?: EntityManager,
  ) {
    let profile = await this.findOne(filter, relations, em);
    if (!profile) {
      throw new NotFoundException('Student profile not found');
    }
    return profile;
  }

  async create(params: DeepPartial<StudentProfile>, em?: EntityManager) {
    let repo = this.getRepo(em);
    return await repo.save(params);
  }
  async enroll(
    params: { userId: UUID; schoolId: UUID; trackId: UUID },
    em?: EntityManager,
  ) {
    const existing = await this.findOne(
      { userId: params.userId },
      undefined,
      em,
    );
    if (existing) {
      if (existing.trackId !== params.trackId) {
        throw new BadRequestException("You Can't change student track");
      }
      if (existing.schoolId !== params.schoolId) {
        throw new BadRequestException("You Can't change student school");
      }
      return existing;
    }
    return await this.create(params, em);
  }

  async update(
    filter: FindOptionsWhere<StudentProfile>,
    data: DeepPartial<StudentProfile>,
    em?: EntityManager,
  ) {
    let old = await this.findOneOrFail(filter, undefined, em);
    if (old.schoolId && (data.school || data.schoolId)) {
      throw new BadRequestException("You Can't change student school");
    }
    if (old.trackId && (data.track || data.trackId)) {
      throw new BadRequestException("You Can't change student track");
    }
    let res = await this.getRepo(em).update(filter, data);
    if (!res.affected) {
      throw new NotFoundException('Student profile not found');
    }
    return await this.findOneOrFail(filter, undefined, em);
  }

  async delete(filter: FindOptionsWhere<StudentProfile>, em?: EntityManager) {
    let res = await this.getRepo(em).delete(filter);
    if (!res.affected) {
      throw new NotFoundException('Student profile not found');
    }
  }

  async ledgeBalance(
    id: UUID,
    params: { gems?: number; xp?: number; em?: EntityManager },
  ) {
    let repo = params.em?.getRepository(StudentProfile) || this.repo;
    let profile = await repo.findOneOrFail({ where: { id } });
    let gems = max([0, profile.gems + (params.gems ?? 0)]);
    let xps = max([0, profile.xp + (params.xp ?? 0)]);
    await repo.save({ id, xp: xps, gems: gems });
    return { gems, xps };
  }

  // owner-scoped callers pass schoolId from the context; trackId/userId
  // come off the DTO as plain equality filters
  async getByCriteria(params: { params: StudentProfileGetDto }) {
    const query = params.params;
    const qb = this.repo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.school', 'school')
      .leftJoinAndSelect('s.track', 'track')
      .leftJoinAndSelect('s.user', 'user')
      // applyPsqlFilter skips `sort` — order manually or pagination drifts
      .orderBy('s.createdAt', query.sort || SortType.Desc);
    applyPsqlFilter({
      queryBuilder: qb,
      query: query,
      options: {
        name: {
          value: (v) => {
            return ['user.name ~* :name', { name: v }];
          },
        },
        schoolId: {
          value: (v) => {
            return ['s.schoolId = :schoolId', { schoolId: v }];
          },
        },
        trackId: {
          value: (v) => {
            return ['s.trackId = :trackId', { trackId: v }];
          },
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

  async updateDailyStreak(studentId: UUID, em?: EntityManager) {
    const repo = this.getRepo(em);

    const activityRepo = em
      ? em.getRepository(StudentActivity)
      : this.repo.manager.getRepository(StudentActivity);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // سجل النشاط اليومي
    // id يتم توليده تلقائياً
    // unique(studentId, date) يمنع التكرار
    await activityRepo
      .createQueryBuilder()
      .insert()
      .into(StudentActivity)
      .values({
        studentId,
        date: today,
      })
      .orIgnore()
      .execute();

    const profile = await repo.findOneOrFail({
      where: { id: studentId },
    });

    let current = profile.currentStreak ?? 0;
    let longest = profile.longestStreak ?? 0;

    if (!profile.lastStreakDate) {
      current = 1;
    } else {
      const last = new Date(profile.lastStreakDate);
      last.setHours(0, 0, 0, 0);

      const diff = (today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);

      if (diff === 0) {
        return {
          currentStreak: current,
          longestStreak: longest,
        };
      }

      if (diff === 1) {
        current++;
      } else {
        current = 1;
      }
    }

    longest = Math.max(longest, current);

    await repo.update(
      { id: studentId },
      {
        currentStreak: current,
        longestStreak: longest,
        lastStreakDate: today,
      },
    );

    return {
      currentStreak: current,
      longestStreak: longest,
    };
  }
  async weeklyOpenedStudents(date: Date, schoolId?: UUID) {
    // calculate week start (Sunday)
    const weekStart = new Date(date);
    weekStart.setHours(0, 0, 0, 0);

    const day = weekStart.getDay(); // Sunday = 0
    weekStart.setDate(weekStart.getDate() - day);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    let query = this.repo
      .createQueryBuilder()
      .from(StudentActivity, 'activity')
      .innerJoin(StudentProfile, 'student', 'student.id = activity.studentId')
      .select('activity.date', 'date')
      .addSelect('COUNT(DISTINCT activity.studentId)', 'openedStudents')
      .where('activity.date >= :weekStart AND activity.date < :weekEnd', {
        weekStart,
        weekEnd,
      });

    if (schoolId) {
      query = query.andWhere('student.schoolId = :schoolId', {
        schoolId,
      });
    }

    const rows = await query
      .groupBy('activity.date')
      .orderBy('activity.date', 'ASC')
      .getRawMany();

    // map database result
    const activityMap = new Map(
      rows.map((row) => [
        new Date(row.date).toISOString().split('T')[0],
        Number(row.openedStudents),
      ]),
    );

    // always return Sunday -> Saturday
    const week: any[] = [];

    for (let i = 0; i < 7; i++) {
      const current = new Date(weekStart);
      current.setDate(current.getDate() + i);

      const key = current.toISOString().split('T')[0];

      week.push({
        date: key,
        openedStudents: activityMap.get(key) ?? 0,
      });
    }

    return {
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: new Date(weekEnd.getTime() - 86400000)
        .toISOString()
        .split('T')[0],
      week,
    };
  }

  async getStatistics(studentId: UUID) {
    const rows = await this.ds.query(
      `
    WITH student AS (
      SELECT
        sp.id,
        sp."schoolId" AS school_id,
        sp."trackId" AS track_id,
        sp."currentStreak" AS current_streak,
        sp."longestStreak" AS longest_streak
      FROM "student_profile" sp
      WHERE sp.id = $1
    ),

    xp_data AS (
      SELECT
        le."studentId" AS student_id,
        COALESCE(SUM(le.xp), 0)::int AS xp,
        COALESCE(SUM(le.gems), 0)::int AS gems
      FROM "ledger_entry" le
      GROUP BY le."studentId"
    ),

    leaderboard AS (
      SELECT
        sp.id AS student_id,
        sp."schoolId" AS school_id,
        sp."trackId" AS track_id,
        COALESCE(SUM(le.xp), 0)::int AS xp
      FROM "student_profile" sp
      LEFT JOIN "ledger_entry" le
        ON le."studentId" = sp.id
      GROUP BY
        sp.id,
        sp."schoolId",
        sp."trackId"
    ),

    ranked AS (
      SELECT
        student_id,

        RANK() OVER (
          PARTITION BY school_id, track_id
          ORDER BY xp DESC
        )::int AS rank

      FROM leaderboard
    ),

    accuracy_data AS (
      SELECT
        COALESCE(
          ROUND(
            100.0 * SUM(qa.score)
            / NULLIF(SUM(qa.total), 0)
          ),
          0
        )::int AS accuracy
      FROM "question_attempt" qa
      WHERE qa."studentId" = $1
      AND qa."isSkipped" = false
    ),

    lesson_data AS (
      SELECT
        COUNT(*) FILTER (
          WHERE la.completed = true
        )::int AS completed_lessons
      FROM "lesson_attempt" la
      WHERE la."studentId" = $1
    ),

    weekly_days AS (
      SELECT
        generate_series(
          CURRENT_DATE - INTERVAL '6 days',
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS day
    ),

    weekly_activity AS (
      SELECT
        wd.day,

        COUNT(la.id) FILTER (
          WHERE la.completed = true
        )::int AS lessons

      FROM weekly_days wd

      LEFT JOIN "lesson_attempt" la
        ON la."studentId" = $1
        AND la."createdAt"::date = wd.day

      GROUP BY wd.day
      ORDER BY wd.day
    )

    SELECT
      COALESCE(xp.xp, 0)::int AS xp,
      COALESCE(xp.gems, 0)::int AS gems,

      r.rank AS "rank",

      a.accuracy,

      l.completed_lessons AS "completedLessons",

      json_build_object(
        'current',
        s.current_streak,
        'longest',
        s.longest_streak
      ) AS streak,

      (
        SELECT json_agg(
          json_build_object(
            'day',
            CASE EXTRACT(DOW FROM wa.day)
              WHEN 0 THEN 'Sunday'
              WHEN 1 THEN 'Monday'
              WHEN 2 THEN 'Tuesday'
              WHEN 3 THEN 'Wednesday'
              WHEN 4 THEN 'Thursday'
              WHEN 5 THEN 'Friday'
              WHEN 6 THEN 'Saturday'
            END,

            'lessons',
            wa.lessons
          )
          ORDER BY wa.day
        )
        FROM weekly_activity wa
      ) AS "weeklyActivity"

    FROM student s

    LEFT JOIN xp_data xp
      ON xp.student_id = s.id

    LEFT JOIN ranked r
      ON r.student_id = s.id

    CROSS JOIN accuracy_data a
    CROSS JOIN lesson_data l
    `,
      [studentId],
    );

    return rows[0];
  }
}
