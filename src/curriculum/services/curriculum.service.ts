import { Injectable } from '@nestjs/common';
import { UUID } from 'crypto';
import {
  DataSource,
  EntityManager,
  FindOptionsOrder,
  FindOptionsRelations,
  FindOptionsSelect,
  FindOptionsWhere,
} from 'typeorm';
import { CourseService } from '../course/course.service';
import { UnitService } from '../units/unit.service';
import { LessonService } from '../lessons/lessons.service';
import { QuestionService } from '../questions/questions.service';
import {
  AdminQuestionGetDto,
  QuestionGetDto,
} from '../questions/dto/question.dto';
import { Unit } from '../units/entity/unit.entity';
import { Lesson } from '../lessons/entity/lesson.entity';
import { LessonStatusType } from '../lessons/entity/lesson.status.type';
import { TrackService } from '../tracks/tracks.service';
import { Question } from '../questions/entity/questions.entity';
import { DailyChallengeService } from '../daily-challenge/daily-challenge.service';
import { QuestionMap } from '../questions/types/question-verdict.type';

// Read-only content layer. It holds NO request context: every method takes
// explicit filters/scope, and the caller (controller or role facade) is
// responsible for resolving ownership and ids before calling. Keeping it
// context-free lets admin (unscoped), school-owner (school-scoped) and
// student (track-scoped) callers share the same queries — the caller decides
// the scope, and `relations` lets each caller pick the shape it needs.
@Injectable()
export class CurriculumService {
  constructor(
    private readonly courseService: CourseService,
    private readonly unitService: UnitService,
    private readonly lessonService: LessonService,
    private readonly questionService: QuestionService,
    private readonly trackService: TrackService,
    private readonly dailyChallengeService: DailyChallengeService,
    private readonly ds: DataSource,
  ) {}

  getTracks() {
    return this.trackService.find();
  }

  getCourses(filter: { title?: string; trackId?: UUID }) {
    return this.courseService.find({
      title: filter.title,
      trackId: filter.trackId,
    });
  }

  getUnits(
    filter: {
      schoolId?: UUID;
      title?: string;
      courseId?: UUID;
      trackId?: UUID;
      id?: UUID;
    },
    relations?: FindOptionsRelations<Unit>,
  ) {
    return this.unitService.find(
      {
        schoolId: filter.schoolId,
        title: filter.title,
        courseId: filter.courseId,
        id: filter.id,
        ...(filter.trackId ? { course: { trackId: filter.trackId } } : {}),
      },
      relations,
    );
  }

  getLessons(
    filter: {
      unitId?: UUID;
      courseId?: UUID;
      schoolId?: UUID;
      title?: string;
      trackId?: UUID;
      status?: LessonStatusType;
    },
    relations?: FindOptionsRelations<Lesson>,
  ) {
    // lessons carry no courseId/trackId columns — both go through the unit
    const unitWhere = {
      ...(filter.courseId ? { courseId: filter.courseId } : {}),
      ...(filter.trackId ? { course: { trackId: filter.trackId } } : {}),
    };
    return this.lessonService.find(
      {
        unitId: filter.unitId,
        schoolId: filter.schoolId,
        title: filter.title,
        status: filter.status,
        ...(Object.keys(unitWhere).length ? { unit: unitWhere } : {}),
      },
      relations,
    );
  }

  // Single lesson by id, scoped by the caller (school/track/status). Returns
  // null when nothing matches the scope. `relations` lets the caller pull the
  // unit/course chain when it needs the lesson's place in the tree.
  async getLesson(
    filter: {
      id: UUID;
      schoolId?: UUID;
      trackId?: UUID;
      status?: LessonStatusType;
    },
    relations?: FindOptionsRelations<Lesson>,
    select?: FindOptionsSelect<Lesson>,
  ) {
    const lessons = await this.lessonService.find(
      {
        id: filter.id,
        schoolId: filter.schoolId,
        status: filter.status,
        ...(filter.trackId
          ? { unit: { course: { trackId: filter.trackId } } }
          : {}),
      },
      relations,
      select,
    );
    return lessons[0] ?? null;
  }

  // Full course → unit → lesson tree for ONE school within ONE track (both
  // required). Includes every lesson status and keeps units with no lessons.
  // Courses come from the track (shared across schools); units, lessons and
  // attempt counts are scoped to the school. Courses with no school units are
  // still omitted, preserving the existing top-level response behavior.
  async getCurriculumTree(params: { trackId: UUID; schoolId: UUID }) {
    // $1 = schoolId, $2 = trackId
    const rows = await this.ds.query(
      `
      WITH lesson_attempt_counts AS (
        SELECT
          la."lessonId" AS lesson_id,
          COUNT(*)::int AS attempt_counts
        FROM "lesson_attempt" la
        WHERE la."schoolId" = $1
        GROUP BY la."lessonId"
      ),
      lesson_question_counts AS (
        SELECT
          q."lessonId" AS lesson_id,
          COUNT(*)::int AS question_counts
        FROM "question" q
        WHERE q."schoolId" = $1
          AND q."lessonId" IS NOT NULL
        GROUP BY q."lessonId"
      ),
      lesson_data AS (
        SELECT
          l.id,
          l.title,
          l."unitId" AS unit_id,
          l."index" AS idx,
          COALESCE(lu.used, false) AS used,
          COALESCE(lac.attempt_counts, 0) AS attempt_counts,
          COALESCE(lqc.question_counts, 0) AS question_counts
        FROM "lesson" l
        LEFT JOIN "lesson_used" lu ON lu."lessonId" = l.id
        LEFT JOIN lesson_attempt_counts lac ON lac.lesson_id = l.id
        LEFT JOIN lesson_question_counts lqc ON lqc.lesson_id = l.id
        WHERE l."schoolId" = $1
      ),
      unit_data AS (
        SELECT
          u.id,
          u.title,
          u."courseId" AS course_id,
          u."index" AS idx,
          COALESCE(
            json_agg(
              json_build_object(
                'id',            ld.id,
                'title',         ld.title,
                'index',         ld.idx,
                'used',          ld.used,
                'attemptCounts', ld.attempt_counts,
                'questionsCount', ld.question_counts
              ) ORDER BY ld.idx
            ) FILTER (WHERE ld.id IS NOT NULL),
            '[]'::json
          ) AS lessons
        FROM "unit" u
        LEFT JOIN lesson_data ld ON ld.unit_id = u.id
        WHERE u."schoolId" = $1
        GROUP BY u.id, u.title, u."courseId", u."index"
      ),
      course_data AS (
        SELECT
          c.id,
          c.title,
          c."createdAt" AS created_at,
          COALESCE(
            json_agg(
              json_build_object(
                'id',      ud.id,
                'title',   ud.title,
                'index',   ud.idx,
                'lessons', ud.lessons
              ) ORDER BY ud.idx
            ) FILTER (WHERE ud.id IS NOT NULL),
            '[]'::json
          ) AS units
        FROM "course" c
        LEFT JOIN unit_data ud ON ud.course_id = c.id
        WHERE c."trackId" = $2
        GROUP BY c.id, c.title, c."createdAt"
        HAVING COUNT(ud.id) > 0
      )
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'id',    cd.id,
            'title', cd.title,
            'units', cd.units
          ) ORDER BY cd.created_at
        ),
        '[]'::json
      ) AS tree
      FROM course_data cd
      `,
      [params.schoolId, params.trackId],
    );

    return rows[0]?.tree ?? [];
  }

  // Seam for the student attempt flow: freezes a lesson's content once a
  // student has an attempt on it. Not reachable from the school facade.
  async markLessonUsed(lessonId: UUID, em?: EntityManager) {
    return await this.lessonService.markAsUsed(lessonId, em);
  }

  getQuestionsByCriteria(params: {
    params: QuestionGetDto | AdminQuestionGetDto;
    schoolId?: UUID;
    trackId?: UUID;
  }) {
    return this.questionService.getByCriteria(params);
  }

  getQuestion(filter: { id: UUID; schoolId?: UUID }) {
    return this.questionService.findOne({
      id: filter.id,
      ...(filter.schoolId ? { school: { id: filter.schoolId } } : {}),
    });
  }

  async checkQuestionAnswers(data: QuestionMap[]) {
    return await this.questionService.checkAnswerHelper(data);
  }

  hideQuestionAnswers(questions: Question[]) {
    return this.questionService.hideAnswers(questions);
  }

  async findQuestions(
    params: FindOptionsWhere<Question>,
    select?: FindOptionsSelect<Question>,
  ) {
    return await this.questionService.find(params, select);
  }

  // A track can be shared by several schools, each with its own challenge for
  // the day, so scope by BOTH — filtering by track alone would return another
  // school's challenge.
  async getDailyChallenge(params: { schoolId: UUID; trackId: UUID }) {
    return await this.dailyChallengeService.getToday({
      school: { id: params.schoolId },
      track: { id: params.trackId },
    });
  }
}
