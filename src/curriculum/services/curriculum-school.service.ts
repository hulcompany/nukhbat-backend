import { Injectable, Scope } from '@nestjs/common';
import { LessonService } from '../lessons/lessons.service';
import { SchoolAccessService } from '../../school-access/school-access.service';
import { UnitService } from '../units/unit.service';
import { UUID } from 'crypto';
import { UnitCreateDto, UnitUpdateDto } from '../units/dto/unit-dto';
import { LessonCreateDto, LessonEditDto } from '../lessons/dto/lessons.dto';
import { QuestionService } from '../questions/questions.service';
import {
  QuestionBulkCreateDto,
  QuestionCreateDto,
  QuestionEditDto,
} from '../questions/dto/question.dto';
import { QuestionPurpose } from '../questions/entity/enum/question-purpose.type';
import { DailyChallengeService } from '../daily-challenge/daily-challenge.service';
import { Context } from '../../context';
import { FindOptionsWhere, In } from 'typeorm';
import { Unit } from '../units/entity/unit.entity';
import { Lesson } from '../lessons/entity/lesson.entity';
import { Question } from '../questions/entity/questions.entity';
import { DailyChallenge } from '../daily-challenge/entity/daily-challenge.entity';

@Injectable({ scope: Scope.REQUEST })
export class CurriculumSchoolService {
  constructor(
    private readonly SchoolAccessService: SchoolAccessService,
    private readonly unitService: UnitService,
    private readonly lessonService: LessonService,
    private readonly questionService: QuestionService,
    private readonly dailyChallengeService: DailyChallengeService,
    private readonly context: Context,
  ) {}

  // School-scoped filter factories. `extra` is spread FIRST so the school
  // clause always wins and can never be overridden by caller data.
  // Convention: every filter handed to a sub-service goes through one of
  // these — a raw object literal below is a code-review red flag.

  // relation form — for find/findOne filters
  private scoped<T>(
    extra: FindOptionsWhere<T> = {} as any,
  ): FindOptionsWhere<T> {
    return { ...extra, school: { id: this.context.school.id } } as any;
  }

  // flat-column form — for update()/delete() criteria, which can't resolve
  // nested relation objects the way find() does
  private scopedFlat<T>(
    extra: FindOptionsWhere<T> = {} as any,
  ): FindOptionsWhere<T> {
    return { ...extra, schoolId: this.context.school.id } as any;
  }
  
  async createUnit(params: UnitCreateDto) {
    await this.SchoolAccessService.assertCourseAccess(
      this.context.school.id,
      params.courseId,
    );
    return await this.unitService.create({
      school: { id: this.context.school.id, ...params },
    });
  }

  async changeUnitOrder(courseId: UUID, ids: UUID[]) {
    await this.SchoolAccessService.assertCourseAccess(
      this.context.school.id,
      courseId,
    );
    return await this.unitService.changeOrder(
      this.scopedFlat<Unit>({ courseId: courseId }),
      ids,
    );
  }

  async deleteUnit(id: UUID) {
    await this.SchoolAccessService.assertUnitAccess(this.context.school.id, id);
    await this.unitService.delete(this.scoped<Unit>({ id: id }));
  }

  async updateUnit(id: UUID, params: UnitUpdateDto) {
    await this.SchoolAccessService.assertUnitAccess(this.context.school.id, id);
    // flat: feeds repo.update() criteria inside the service
    return this.unitService.update(this.scopedFlat<Unit>({ id: id }), params);
  }

  async createLesson(params: LessonCreateDto) {
    await this.SchoolAccessService.assertUnitAccess(
      this.context.school.id,
      params.unitId,
    );
    return await this.lessonService.create({
      ...params,
      schoolId: this.context.school.id,
    });
  }

  async updateLesson(id: UUID, params: LessonEditDto) {
    await this.SchoolAccessService.assertLessonAccess(
      this.context.school.id,
      id,
    );
    // flat: feeds repo.update() criteria inside the service
    return this.lessonService.update(
      this.scopedFlat<Lesson>({ id: id }),
      params,
    );
  }

  async deleteLesson(id: UUID) {
    await this.SchoolAccessService.assertLessonAccess(
      this.context.school.id,
      id,
    );
    return await this.lessonService.delete(this.scopedFlat<Lesson>({ id: id }));
  }

  async changeLessonOrder(unitId: UUID, ids: UUID[]) {
    await this.SchoolAccessService.assertUnitAccess(
      this.context.school.id,
      unitId,
    );
    return await this.lessonService.changeOrder(
      this.context.school.id,
      unitId,
      ids,
    );
  }

  async createQuestion(params: QuestionCreateDto, image?: Express.Multer.File) {
    // daily-challenge questions live in the school's own pool but target
    // a course — assert access on it instead of the lesson chain
    if (params.purpose !== QuestionPurpose.dailyChallenge) {
      await this.SchoolAccessService.assertLessonAccess(
        this.context.school.id,
        params.lessonId!,
      );
    } else {
      await this.SchoolAccessService.assertCourseAccess(
        this.context.school.id,
        params.courseId!,
      );
    }
    return await this.questionService.create({
      schoolId: this.context.school.id,
      params: params,
      images: { question: image },
    });
  }

  // all-or-nothing: one bad question fails the whole batch
  async createQuestions(params: QuestionBulkCreateDto) {
    // batched asserts — the service dedupes and checks each list with a
    // fixed number of queries
    let lessonIds: UUID[] = [];
    let courseIds: UUID[] = [];
    for (let q of params.questions) {
      if (q.purpose !== QuestionPurpose.dailyChallenge) {
        lessonIds.push(q.lessonId!);
      } else {
        courseIds.push(q.courseId!);
      }
    }
    if (lessonIds.length) {
      await this.SchoolAccessService.assertLessonAccess(
        this.context.school.id,
        lessonIds,
      );
    }
    if (courseIds.length) {
      await this.SchoolAccessService.assertCourseAccess(
        this.context.school.id,
        courseIds,
      );
    }
    return await this.questionService.createMany({
      schoolId: this.context.school.id,
      params: params.questions,
    });
  }

  async updateQuestion(
    id: UUID,
    params: QuestionEditDto,
    image?: Express.Multer.File,
  ) {
    await this.SchoolAccessService.assertQuestionAccess(
      this.context.school.id,
      id,
    );
    return await this.questionService.update({
      filter: this.scoped<Question>({ id: id }),
      params: params,
      images: { question: image },
    });
  }

  async deleteQuestion(id: UUID) {
    await this.SchoolAccessService.assertQuestionAccess(
      this.context.school.id,
      id,
    );
    return await this.questionService.deleteQuestions(
      this.scoped<Question>({ id: id }),
    );
  }

  // all-or-nothing: one undeletable question cancels the whole batch
  async deleteQuestions(ids: UUID[]) {
    await this.SchoolAccessService.assertQuestionAccess(
      this.context.school.id,
      ids,
    );
    return await this.questionService.deleteQuestions(
      this.scoped<Question>({ id: In(ids) }),
    );
  }

  // challenges: today's, one per track that could build one — a track is
  // missing when some of its courses ran out of unused pool questions.
  // unUsedQuestions: per-course remaining counts, so the school can see
  // which course to restock before its track starts skipping days
  async getTodayDailyChallenge() {
    return {
      challenges: await this.dailyChallengeService.getToday(
        this.scoped<DailyChallenge>(),
      ),
      unUsedQuestions:
        await this.dailyChallengeService.getUnusedQuestionsReport(
          this.context.school.id,
        ),
    };
  }

  // manual/test trigger — same idempotent creation the midnight cron uses
  async createTodayDailyChallenge() {
    return await this.dailyChallengeService.createTodayAll(
      this.context.school.id,
    );
  }
}
