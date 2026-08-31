import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UUID } from 'crypto';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { SavedQuestion } from './entity/saved-question.entity';
import { SavedQuestionCourse } from './types/saved-question-course.type';

@Injectable()
export class SavedQuestionService {
  constructor(
    @InjectRepository(SavedQuestion)
    private readonly repo: Repository<SavedQuestion>,
    private readonly ds: DataSource,
  ) {}

  private getRepo(em?: EntityManager) {
    return em?.getRepository(SavedQuestion) ?? this.repo;
  }

  // The student's courses with how many of their saved questions belong to
  // each one. Saved questions only ever come from lesson questions, so the
  // count walks question → lesson → unit → course; courses the student has
  // nothing saved in still come back, with a zero count.
  async getSavedQuestions(params: {
    studentProfileId: UUID;
    schoolId: UUID;
    trackId: UUID;
  }): Promise<SavedQuestionCourse[]> {
    // $1 = schoolId, $2 = trackId, $3 = studentProfileId
    return (await this.ds.query(
      `
      SELECT
        c.id    AS id,
        c.title AS title,
        COUNT(sq.id)::int AS "savedQuestionsCount"
      FROM "course" c
      LEFT JOIN "unit" u
        ON u."courseId" = c.id AND u."schoolId" = $1
      LEFT JOIN "lesson" l
        ON l."unitId" = u.id AND l."schoolId" = $1 AND l.status = 'published'
      LEFT JOIN "question" q
        ON q."lessonId" = l.id
      LEFT JOIN "saved_question" sq
        ON sq."questionId" = q.id AND sq."studentProfileId" = $3
      WHERE c."trackId" = $2
      GROUP BY c.id, c.title
      ORDER BY c.title
      `,
      [params.schoolId, params.trackId, params.studentProfileId],
    )) as SavedQuestionCourse[];
  }

  // Saved question ids for one course, newest first. Scoped by school and
  // published status so an unpublished lesson stops feeding the practice set.
  async findQuestionIdsByCourse(params: {
    studentProfileId: UUID;
    schoolId: UUID;
    trackId: UUID;
    courseId: UUID;
  }): Promise<UUID[]> {
    // $1 = schoolId, $2 = trackId, $3 = studentProfileId, $4 = courseId
    const rows = (await this.ds.query(
      `
      SELECT sq."questionId" AS "questionId"
      FROM "saved_question" sq
      INNER JOIN "question" q ON q.id = sq."questionId"
      INNER JOIN "lesson" l
        ON l.id = q."lessonId" AND l."schoolId" = $1 AND l.status = 'published'
      INNER JOIN "unit" u
        ON u.id = l."unitId" AND u."schoolId" = $1 AND u."courseId" = $4
      INNER JOIN "course" c ON c.id = u."courseId" AND c."trackId" = $2
      WHERE sq."studentProfileId" = $3
      ORDER BY sq."createdAt" DESC
      `,
      [params.schoolId, params.trackId, params.studentProfileId, params.courseId],
    )) as { questionId: UUID }[];

    return rows.map((row) => row.questionId);
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
    // orIgnore + the unique index keep a repeated wrong answer at one row
    await this.getRepo(em)
      .createQueryBuilder()
      .insert()
      .into(SavedQuestion)
      .values(uniqueIds.map((questionId) => ({ studentProfileId, questionId })))
      .orIgnore()
      .execute();
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
