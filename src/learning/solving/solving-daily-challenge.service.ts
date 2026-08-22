import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { transaction } from 'core';
import { DataSource, In } from 'typeorm';
import { AppConfig } from '../../conf';
import { DailyChallenge, Question, QuestionMap } from '../../curriculum';
import { CurriculumService } from '../../curriculum/services/curriculum.service';
import { StudentProfile } from '../../student/entity/student-profile.entity';
import { StudentService } from '../../student/student.service';
import { AttemptsService } from '../attempts/attempts.service';
import { LedgerService } from '../ledger/ledger.service';
import { SnapshotsService } from '../snapshots/snapshots.service';
import { SolvingSnapshotDto } from './dto';
import { assertFullQuestionComponents } from './question-components';
import {
  DailyChallengePreview,
  SolvingSolveResult,
  SolvingStartResult,
} from './types';

@Injectable()
export class SolvingDailyChallengeService {
  constructor(
    private readonly curriculum: CurriculumService,
    private readonly snapshots: SnapshotsService,
    private readonly attempts: AttemptsService,
    private readonly students: StudentService,
    private readonly ledger: LedgerService,
    private readonly dataSource: DataSource,
  ) {}

  async start(student: StudentProfile): Promise<SolvingStartResult> {
    const challenge = await this.getTodayChallenge(student);
    const previousAttempt = await this.attempts.getDailyChallengeAttempt(
      challenge.id,
      student.id,
    );
    if (previousAttempt) {
      throw new BadRequestException('Daily challenge already attempted');
    }

    const questions = await this.loadChallengeQuestions(challenge);

    const snapshotId = await this.snapshots.addQuestionSnapshot(questions, {
      dailyChallengeId: challenge.id,
      lessonId: null,
      unitId: null,
      courseId: null,
      studentId: student.id,
    });

    return {
      snapshotId,
      // A daily challenge is not bound to a lesson, but the key stays present
      // so clients can reuse the lesson-solving response handler verbatim.
      lesson: null,
      questions: this.curriculum.hideQuestionAnswers(questions),
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
      const snapshot = await this.snapshots.getQuestionSnapshot(dto.snapshotId);
      if (!snapshot || snapshot.studentId !== student.id) {
        throw new NotFoundException('Snapshot not found or expired');
      }
      if (
        !snapshot.dailyChallengeId ||
        snapshot.lessonId ||
        snapshot.unitId ||
        snapshot.courseId
      ) {
        throw new BadRequestException('Snapshot is not for a daily challenge');
      }
      if (!snapshot.questions.length) {
        throw new BadRequestException('Snapshot has no questions');
      }
      assertFullQuestionComponents(snapshot.questions);

      const challenge = await this.getTodayChallenge(student);
      if (challenge.id !== snapshot.dailyChallengeId) {
        throw new NotFoundException(
          'Daily challenge snapshot is no longer valid',
        );
      }
      if (
        await this.attempts.getDailyChallengeAttempt(challenge.id, student.id)
      ) {
        throw new BadRequestException('Daily challenge already attempted');
      }

      const verdict = await this.curriculum.checkQuestionAnswers(
        this.buildQuestionMaps(snapshot.questions, dto),
      );
      const xps = verdict.passed ? AppConfig.DAILY_CHALLENGE_XPS : 0;

      await transaction(this.dataSource, async (manager) => {
        await this.attempts.saveDailyChallengeAttempt(
          {
            dailyChallengeId: challenge.id,
            studentId: student.id,
            score: verdict.correct,
            total: verdict.total,
            skipped: verdict.skipped,
            verdict,
          },
          manager,
        );
        await this.students.updateDailyStreak(student.id, manager);

        if (verdict.passed) {
          await this.ledger.insertLedge(
            {
              studentId: student.id,
              schoolId: student.schoolId,
              trackId: student.trackId,
            },
            {
              sourceName: `Daily challenge ${challenge.date}`,
              xp: xps,
            },
            manager,
          );
        }
      });

      await this.snapshots.removeQuestionSnapshot(snapshot.id);
      return { ...verdict, xps, gems: 0 };
    } finally {
      await this.snapshots.unlockQuestionSnapshot(dto.snapshotId, lockToken);
    }
  }

  /**
   * Today's challenge in the same envelope as `start`, minus a snapshot: the
   * student is only previewing the questions, so nothing is being graded yet.
   *
   * Carries `verdict` so the client can tell a solvable challenge from a spent
   * one - and render the outcome - without a second request.
   */
  async getToday(student: StudentProfile): Promise<DailyChallengePreview> {
    const challenge = await this.getTodayChallenge(student);
    const questions = await this.loadChallengeQuestions(challenge);
    // One attempt per (student, challenge), so the attempt row - if there is
    // one - holds the frozen verdict, and its absence means "not solved yet".
    const attempt = await this.attempts.getDailyChallengeAttempt(
      challenge.id,
      student.id,
    );

    return {
      snapshotId: null,
      lesson: null,
      questions: this.curriculum.hideQuestionAnswers(questions),
      verdict: attempt?.verdict ?? null,
    };
  }

  async getTodayChallenge(student: StudentProfile) {
    const challenge = (
      await this.curriculum.getDailyChallenge({
        schoolId: student.schoolId,
        trackId: student.trackId,
      })
    ).at(0);
    if (!challenge) {
      throw new NotFoundException('No daily challenge available today');
    }
    return challenge;
  }

  /**
   * Reloads the challenge questions through `findQuestions` so they carry the
   * exact same relations as the lesson-solving flow — the eager relations on
   * `usedQuestions[].question` are shallower and would produce a different shape.
   */
  private async loadChallengeQuestions(
    challenge: DailyChallenge,
  ): Promise<Question[]> {
    const questionIds = challenge.usedQuestions.map((item) => item.question.id);
    if (!questionIds.length) {
      throw new NotFoundException('Daily challenge has no questions');
    }

    const loadedQuestions = await this.curriculum.findQuestions({
      id: In(questionIds),
    });
    const questionsById = new Map(
      loadedQuestions.map((question) => [question.id, question]),
    );
    const questions = questionIds.map((id) => questionsById.get(id)!);
    if (questions.some((question) => !question)) {
      throw new NotFoundException('Daily challenge question not found');
    }
    assertFullQuestionComponents(questions);

    return questions;
  }

  private buildQuestionMaps(
    questions: Question[],
    dto: SolvingSnapshotDto,
  ): QuestionMap[] {
    const questionIds = new Set(questions.map((question) => question.id));
    for (const submitted of dto.answers) {
      if (!questionIds.has(submitted.id)) {
        throw new BadRequestException(
          `Answer ${submitted.id} is not part of this daily challenge`,
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
}
