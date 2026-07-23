import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UUID } from 'crypto';
import { CurriculumService } from '../../curriculum/services/curriculum.service';
import { LessonStatusType } from '../../curriculum';
import { SnapshotsService } from './snapshots.service';
import { SolveAnswerDto } from './dto/solve-lesson.dto';
import { transaction } from 'core';
import { DataSource, In, Repository } from 'typeorm';
import * as _ from 'lodash';
import { InjectRepository } from '@nestjs/typeorm';
import { LessonAttempt } from './entity/lesson-attempt.entity';
import { AppConfig } from '../../conf';
import { LedgerService } from '../ledger/ledger.service';
import { StudentService } from '../../student/student.service';

// The student attempt flow: /start freezes a lesson and hands back the
// questions without keys; /solve grades the submitted answers. Reads go
// through the curriculum facade (never the repos directly).
@Injectable()
export class SolveLessonsService {
  constructor(
    private readonly curriculum: CurriculumService,
    private readonly snapshots: SnapshotsService,
    private readonly ds: DataSource,
    @InjectRepository(LessonAttempt)
    private readonly lessonAttempts: Repository<LessonAttempt>,
    private readonly ledger: LedgerService,
    private readonly studentService: StudentService,
  ) {}

  // /start — freeze the lesson under a snapshot id and return the questions
  // with their answer keys hidden. The first attempt freezes the lesson's
  // content (markLessonUsed), so its questions can't change under an
  // in-flight attempt.
  async start(params: {
    studentId: UUID;
    schoolId: UUID;
    trackId: UUID;
    lessonId: UUID;
  }) {
    const lesson = await this.curriculum.getLesson(
      {
        id: params.lessonId,
        schoolId: params.schoolId,
        trackId: params.trackId,
        status: LessonStatusType.published,
      },
      { unit: true, questions: true },
    );
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    // // STOPPED FOR NOW MY FRIEND CLAUDE — MAYBE WE WILL USE IT LATER
    // // sequential gate — a lesson unlocks only once the previous lesson in its
    // // unit (by index) has a completed attempt. The first lesson of a unit is
    // // always open. Retrying an already-completed lesson stays allowed; the
    // // gate only looks at the lesson before this one.
    // const unitLessons = await this.curriculum.getLessons({
    //   unitId: lesson.unitId,
    //   schoolId: params.schoolId,
    //   status: LessonStatusType.published,
    // });
    // // getLessons returns them ordered by index asc
    // const pos = unitLessons.findIndex((l) => l.id === lesson.id);
    // if (pos > 0) {
    //   const previous = unitLessons[pos - 1];
    //   const previousSolved = await this.lessonAttempts.exists({
    //     where: {
    //       studentId: params.studentId,
    //       lessonId: previous.id,
    //       completed: true,
    //     },
    //   });
    //   if (!previousSolved) {
    //     throw new BadRequestException(
    //       'Finish the previous lesson before starting this one',
    //     );
    //   }
    // }

    // first attempt freezes the lesson's content
    return await transaction(this.ds, async (em) => {
      await this.curriculum.markLessonUsed(lesson.id, em);

      const id = await this.snapshots.addQuestionSnapshot({
        studentId: params.studentId,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        schoolId: params.schoolId,
        trackId: params.trackId,
        courseId: lesson.unit.courseId,
        unitId: lesson.unitId,
        questions: lesson.questions,
        createdAt: new Date().toISOString(),
      });

      return {
        id,
        lesson: {
          id: lesson.id,
          title: lesson.title,
          description: lesson.description,
        },
        questions: lesson.questions.map((e) =>
          _.omit(e, ['trueOrFalseAnswer', 'options', 'matchingItems']),
        ),
      };
    });
  }

  // /solve — grade the submitted answers. The lesson is frozen (used) so the
  // live rows still match what the student was shown; withAnswers=true so the
  // response carries the correct answers for review. XP/gems are 0 until the
  // reward flow lands.
  async solve(params: {
    studentId: UUID;
    snapshotId: UUID;
    answers: SolveAnswerDto[];
  }) {
    const snapshot = await this.snapshots.getQuestionSnapshot(
      params.snapshotId,
    );
    if (!snapshot || snapshot.studentId != params.studentId) {
      throw new NotFoundException('Snapshot not found or expired');
    }

    // answers may only reference questions from this attempt's snapshot
    const snapshotIds = new Set(snapshot.questions.map((q) => q.id));
    for (const a of params.answers) {
      if (!snapshotIds.has(a.id)) {
        throw new BadRequestException(
          'Answer references a question not in this attempt',
        );
      }
    }

    const verdict = await this.curriculum.checkQuestionAnswers(
      params.answers,
      true,
    );
    let solved = await this.lessonAttempts.exists({
      where: {
        completed: true,
        studentId: params.studentId,
        lessonId: snapshot.lessonId,
      },
    });
    let xps = 0,
      gems = 0;
    let attempts: LessonAttempt[] = [];
    if (!solved) {
      attempts = await this.lessonAttempts.find({
        where: {
          studentId: params.studentId,
          lessonId: snapshot.lessonId,
        },
      });
      let count = attempts.length;
      if (count > 0) {
        count--;
      }
      if (verdict.passed == verdict.total) {
        xps =
          AppConfig.XP_FACTOR[_.min([AppConfig.XP_FACTOR.length - 1, count])] *
          snapshot.questions.length;
      }
      let lessons = (
        await this.curriculum.getLessons({
          unitId: snapshot.unitId,
        })
      ).map((e) => e.id);
      let completedUnitAttempts = await this.lessonAttempts.find({
        where: {
          id: In(lessons),
          completed: true,
        },
      });
      if (completedUnitAttempts.length == lessons.length) {
        gems = AppConfig.UNIT_GEMS;
        xps += AppConfig.UNIT_XP;
      }
    }

    await transaction(this.ds, async (em) => {
      await em.getRepository(LessonAttempt).save({
        attemptNumber: attempts.length + 1,
        completed: verdict.passed == verdict.total,
        lessonTitle: snapshot.lessonTitle,
        courseId: snapshot.courseId,
        lessonId: snapshot.lessonId,
        questionsCorrect: verdict.passed,
        questionsTotal: verdict.total,
        trackId: snapshot.trackId,
        unitId: snapshot.unitId,
        schoolId: snapshot.schoolId,
        studentId: snapshot.studentId,
        xpAwarded: xps,
      });
      await this.ledger.insertLedge(params.studentId, {
        xp: xps,
        em: em,
        schoolId: snapshot.schoolId,
        trackId: snapshot.trackId,
        gem: gems,
      });
      await this.studentService.ledgeBalance(snapshot.studentId, {
        em: em,
        gems: gems,
        xp: xps,
      });
    });

    await this.snapshots.removeQuestionSnapshot(params.snapshotId);

    return { verdict, xps, gems };
  }
}
