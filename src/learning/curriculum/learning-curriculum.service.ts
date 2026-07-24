import { Injectable } from '@nestjs/common';
import { UUID } from 'crypto';
import { DataSource } from 'typeorm';

type CurriculumResponse = {
  id?: UUID;
  title?: string;
  progress?: number;
  units?: {
    id?: UUID;
    title?: string;
    progress?: number;
    lessons?: {
      id?: UUID;
      name?: string;
      questionLength?: number;
      passed?: boolean;
    }[];
  }[];
};

@Injectable()
export class LearningCurriculumService {
  constructor(private readonly ds: DataSource) {}

  // The student's curriculum tree (course → unit → lesson) with progress,
  // built entirely in Postgres in one round-trip:
  //   - lesson.passed  = the student has a COMPLETED lesson_attempt on it
  //   - unit.progress  = round(100 * passed lessons / total lessons in the unit)
  //   - course.progress= round(100 * passed lessons / total lessons in the course)
  // Only published lessons and in-track/in-school units are considered; a unit
  // with no published lessons is omitted, and a course left with no units is
  // dropped too. Units order by their index, lessons by theirs; courses by title.
  async getCurriculum(
    trackId: UUID,
    schoolId: UUID,
    studentId: UUID,
  ): Promise<CurriculumResponse[]> {
    // $1 = schoolId, $2 = trackId, $3 = studentId
    const rows = await this.ds.query(
      `
      WITH lesson_data AS (
        SELECT
          l.id,
          l.title,
          l."unitId" AS unit_id,
          l."index"  AS idx,
          (SELECT COUNT(*)::int FROM "question" q WHERE q."lessonId" = l.id)
            AS question_length,
          EXISTS (
            SELECT 1 FROM "lesson_attempt" la
            WHERE la."lessonId"  = l.id
              AND la."studentId" = $3
              AND la."schoolId"  = $1
              AND la.completed   = true
          ) AS passed
        FROM "lesson" l
        WHERE l."schoolId" = $1
          AND l.status = 'published'
      ),
      unit_data AS (
        SELECT
          u.id,
          u.title,
          u."courseId" AS course_id,
          u."index"    AS idx,
          COALESCE(
            json_agg(
              json_build_object(
                'id',             ld.id,
                'name',           ld.title,
                'questionLength', ld.question_length,
                'passed',         ld.passed
              ) ORDER BY ld.idx
            ) FILTER (WHERE ld.id IS NOT NULL),
            '[]'::json
          ) AS lessons,
          COUNT(ld.id)                          AS total_lessons,
          COUNT(ld.id) FILTER (WHERE ld.passed) AS passed_lessons
        FROM "unit" u
        LEFT JOIN lesson_data ld ON ld.unit_id = u.id
        WHERE u."schoolId" = $1
        GROUP BY u.id, u.title, u."courseId", u."index"
      )
      SELECT
        c.id    AS id,
        c.title AS title,
        COALESCE(
          round(100.0 * SUM(ud.passed_lessons) / NULLIF(SUM(ud.total_lessons), 0)),
          0
        )::int AS progress,
        COALESCE(
          json_agg(
            json_build_object(
              'id',       ud.id,
              'title',    ud.title,
              'progress', COALESCE(
                            round(100.0 * ud.passed_lessons
                                  / NULLIF(ud.total_lessons, 0)), 0)::int,
              'lessons',  ud.lessons
            ) ORDER BY ud.idx
          ) FILTER (WHERE ud.id IS NOT NULL AND ud.total_lessons > 0),
          '[]'::json
        ) AS units
      FROM "course" c
      LEFT JOIN unit_data ud ON ud.course_id = c.id
      WHERE c."trackId" = $2
      GROUP BY c.id, c.title
      -- drop courses with no unit that has any published lesson
      HAVING COUNT(ud.id) FILTER (WHERE ud.total_lessons > 0) > 0
      ORDER BY c.title
      `,
      [schoolId, trackId, studentId],
    );

    return rows as CurriculumResponse[];
  }
}
