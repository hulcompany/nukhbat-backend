import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UUID } from 'crypto';
import { transaction } from 'core';
import { DataSource } from 'typeorm';
import { AppConfig } from '../../conf';
import {
  LessonStatusType,
  Question,
  QuestionMap,
  QuestionVerdict,
} from '../../curriculum';
import { CurriculumService } from '../../curriculum/services/curriculum.service';
import { StudentProfile } from '../../student/entity/student-profile.entity';
import { StudentService } from '../../student/student.service';
import { AttemptsService } from '../attempts/attempts.service';
import { LedgerService } from '../ledger/ledger.service';
import { SavedQuestionService } from '../saved-questions/saved-question.service';
import { SnapshotsService } from '../snapshots/snapshots.service';
import { SolvingSnapshotDto, SolvingStartLessonDto } from './dto';
import { assertFullQuestionComponents } from './question-components';
import { SolvingSolveResult, SolvingStartResult } from './types';

@Injectable()
export class SolvingLessonsService {
  constructor(
    private readonly curriculum: CurriculumService,
    private readonly snapshots: SnapshotsService,
    private readonly attempts: AttemptsService,
    private readonly savedQuestions: SavedQuestionService,
    private readonly students: StudentService,
    private readonly ledger: LedgerService,
    private readonly dataSource: DataSource,
  ) {}

  async start(
    student: StudentProfile,
    dto: SolvingStartLessonDto,
  ): Promise<SolvingStartResult> {
    const lesson = await this.curriculum.getLesson(
      {
        id: dto.lessonId,
        schoolId: student.schoolId,
        trackId: student.trackId,
        status: LessonStatusType.published,
      },
      { unit: true },
    );
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    const questions = await this.curriculum.findQuestions({
      lesson: { id: lesson.id },
    });
    if (!questions.length) {
      throw new NotFoundException('Lesson has no questions');
    }
    assertFullQuestionComponents(questions);
    // Shuffle before snapshotting so the frozen copy matches what is returned
    const shuffled = this.curriculum.shuffleQuestions(questions);

    await transaction(this.dataSource, async (manager) => {
      await this.curriculum.markLessonUsed(lesson.id, manager);
    });
    const snapshotId = await this.snapshots.addQuestionSnapshot(shuffled, {
      dailyChallengeId: null,
      lessonId: lesson.id,
      unitId: lesson.unitId,
      courseId: lesson.unit.courseId,
      studentId: student.id,
    });

    return {
      snapshotId,
      lesson: {
        id: lesson.id,
        title: lesson.title,
        description: lesson.description || '',
      },
      questions: this.curriculum.hideQuestionAnswers(shuffled),
    };
  }

  async solve(
    student: StudentProfile,
    dto: SolvingSnapshotDto,
  ): Promise<SolvingSolveResult> {
    const initialSnapshot = await this.snapshots.getQuestionSnapshot(
      dto.snapshotId,
    );
    if (!initialSnapshot || initialSnapshot.studentId !== student.id) {
      throw new NotFoundException('Snapshot not found or expired');
    }

    const lockToken = await this.snapshots.lockQuestionSnapshot(dto.snapshotId);
    if (!lockToken) {
      throw new BadRequestException('Snapshot is already being solved');
    }

    try {
      // Re-read after locking: another request may have consumed the snapshot
      // between the ownership check and this request acquiring the lock.
      const snapshot = await this.snapshots.getQuestionSnapshot(dto.snapshotId);
      if (!snapshot || snapshot.studentId !== student.id) {
        throw new NotFoundException('Snapshot not found or expired');
      }
      if (
        snapshot.dailyChallengeId ||
        !snapshot.lessonId ||
        !snapshot.unitId ||
        !snapshot.courseId
      ) {
        throw new BadRequestException('Snapshot is not for a lesson');
      }
      if (!snapshot.questions.length) {
        throw new BadRequestException('Snapshot has no questions');
      }
      assertFullQuestionComponents(snapshot.questions);

      const lesson = await this.curriculum.getLesson(
        {
          id: snapshot.lessonId,
          schoolId: student.schoolId,
          trackId: student.trackId,
          status: LessonStatusType.published,
        },
        { unit: true },
      );
      if (
        !lesson ||
        lesson.unitId !== snapshot.unitId ||
        lesson.unit.courseId !== snapshot.courseId
      ) {
        throw new NotFoundException('Lesson snapshot is no longer valid');
      }

      const verdict = await this.curriculum.checkQuestionAnswers(
        this.buildQuestionMaps(snapshot.questions, dto),
      );
      const stats = await this.attempts.getLessonAttemptStats(
        lesson.id,
        student.id,
      );
      const rewards = await this.calculateRewards({
        student,
        lessonId: lesson.id,
        unitId: lesson.unitId,
        questionCount: snapshot.questions.length,
        attemptCount: stats.attemptCount,
        alreadyCompleted: stats.alreadyCompleted,
        fullMark: verdict.passed,
      });

      await transaction(this.dataSource, async (manager) => {
        const attempt = await this.attempts.saveLessonAttempt(
          {
            studentId: student.id,
            schoolId: student.schoolId,
            trackId: student.trackId,
            courseId: snapshot.courseId!,
            unitId: lesson.unitId,
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            xpAwarded: rewards.xps,
          },
          verdict,
          manager,
        );

        await this.attempts.saveQuestionAttempts(
          verdict.verdicts.map((questionVerdict) => ({
            lessonAttemptId: attempt.id,
            studentId: student.id,
            questionId: questionVerdict.id,
            questionType: questionVerdict.type,
            result: questionVerdict,
            isSkipped: questionVerdict.isSkipped,
            ...this.getQuestionScore(questionVerdict),
          })),
          manager,
        );

        await this.savedQuestions.saveMany(
          student.id,
          verdict.verdicts
            .filter((questionVerdict) => !questionVerdict.verdict)
            .map((questionVerdict) => questionVerdict.id),
          manager,
        );
        await this.students.updateDailyStreak(student.id, manager);

        if (rewards.xps || rewards.gems) {
          await this.ledger.insertLedge(
            {
              studentId: student.id,
              schoolId: student.schoolId,
              trackId: student.trackId,
            },
            {
              sourceName: lesson.title,
              xp: rewards.xps,
              gem: rewards.gems,
            },
            manager,
          );
        }
      });

      await this.snapshots.removeQuestionSnapshot(snapshot.id);
      return { ...verdict, ...rewards };
    } finally {
      await this.snapshots.unlockQuestionSnapshot(dto.snapshotId, lockToken);
    }
  }

  private async calculateRewards(params: {
    student: StudentProfile;
    lessonId: UUID;
    unitId: UUID;
    questionCount: number;
    attemptCount: number;
    alreadyCompleted: boolean;
    fullMark: boolean;
  }) {
    if (params.alreadyCompleted || !params.fullMark) {
      return { xps: 0, gems: 0 };
    }

    const factorIndex = Math.min(
      params.attemptCount,
      AppConfig.XP_FACTOR.length - 1,
    );
    let xps = AppConfig.XP_FACTOR[factorIndex] * params.questionCount;

    const [unitLessons, completedLessonIds] = await Promise.all([
      this.curriculum.getLessons({
        unitId: params.unitId,
        schoolId: params.student.schoolId,
        status: LessonStatusType.published,
      }),
      this.attempts.getCompletedLessonIds(params.student.id, params.unitId),
    ]);
    const completed = new Set(completedLessonIds);
    completed.add(params.lessonId);
    const completedUnit =
      unitLessons.length > 0 &&
      unitLessons.every((unitLesson) => completed.has(unitLesson.id));
    if (completedUnit) {
      xps += AppConfig.UNIT_XP;
      return { xps, gems: AppConfig.UNIT_GEMS };
    }

    return { xps, gems: 0 };
  }

  private buildQuestionMaps(
    questions: Question[],
    dto: SolvingSnapshotDto,
  ): QuestionMap[] {
    const questionIds = new Set(questions.map((question) => question.id));
    for (const submitted of dto.answers) {
      if (!questionIds.has(submitted.id)) {
        throw new BadRequestException(
          `Answer ${submitted.id} is not part of this lesson`,
        );
      }
    }
    return questions.map((question) => ({
      question,
      answer:
        dto.answers.find((submitted) => submitted.id === question.id)?.answer ??
        {},
    }));
  }

  private getQuestionScore(verdict: QuestionVerdict) {
    const itemVerdicts = verdict.result?.verdicts ?? [verdict.result];
    return {
      score: itemVerdicts.filter((item) => item?.verdict).length,
      total: itemVerdicts.length,
      isCorrect: verdict.verdict,
    };
  }
}
