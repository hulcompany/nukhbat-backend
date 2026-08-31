import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { transaction } from 'core';
import { DataSource, In } from 'typeorm';
import { Question, QuestionMap } from '../../curriculum';
import { CurriculumService } from '../../curriculum/services/curriculum.service';
import { StudentProfile } from '../../student/entity/student-profile.entity';
import { SavedQuestionService } from '../saved-questions/saved-question.service';
import { SnapshotsService } from '../snapshots/snapshots.service';
import { SolvingSnapshotDto, SolvingStartSavedDto } from './dto';
import { assertFullQuestionComponents } from './question-components';
import { SolvingSolveResult, SolvingStartResult } from './types';

@Injectable()
export class SolvingSavedService {
  constructor(
    private readonly savedQuestions: SavedQuestionService,
    private readonly snapshots: SnapshotsService,
    private readonly curriculum: CurriculumService,
    private readonly dataSource: DataSource,
  ) {}

  async start(
    student: StudentProfile,
    dto: SolvingStartSavedDto,
  ): Promise<SolvingStartResult> {
    // the query scopes by the student's school/track, so an id from another
    // track simply yields nothing
    const questionIds = await this.savedQuestions.findQuestionIdsByCourse({
      studentProfileId: student.id,
      schoolId: student.schoolId,
      trackId: student.trackId,
      courseId: dto.courseId,
    });
    if (!questionIds.length) {
      throw new NotFoundException('No saved questions found for this course');
    }

    const loadedQuestions = await this.curriculum.findQuestions({
      id: In(questionIds),
    });
    const questionsById = new Map(
      loadedQuestions.map((question) => [question.id, question]),
    );
    const questions = questionIds.map((id) => questionsById.get(id)!);
    if (questions.some((question) => !question)) {
      throw new NotFoundException('Saved question not found');
    }
    assertFullQuestionComponents(questions);
    const snapshotId = await this.snapshots.addQuestionSnapshot(questions, {
      dailyChallengeId: null,
      // courseId alone (no lesson/unit) marks this as a saved-questions run:
      // the questions come from many lessons of that one course.
      lessonId: null,
      unitId: null,
      courseId: dto.courseId,
      studentId: student.id,
    });

    return {
      snapshotId,
      // Saved questions span many lessons, so there is no single lesson to
      // report; the key stays present to match the lesson-solving response.
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
        snapshot.dailyChallengeId ||
        snapshot.lessonId ||
        snapshot.unitId ||
        !snapshot.courseId
      ) {
        throw new BadRequestException('Snapshot is not for saved questions');
      }
      if (!snapshot.questions.length) {
        throw new BadRequestException('Snapshot has no questions');
      }
      assertFullQuestionComponents(snapshot.questions);

      const verdict = await this.curriculum.checkQuestionAnswers(
        this.buildQuestionMaps(snapshot.questions, dto),
      );

      // Practising a saved question retires it: everything served in this
      // snapshot leaves the saved list, right or wrong. It comes back only by
      // being answered wrong in the lesson again.
      await transaction(this.dataSource, async (manager) => {
        await this.savedQuestions.removeByQuestionIds(
          student.id,
          snapshot.questions.map((question) => question.id),
          manager,
        );
      });
      await this.snapshots.removeQuestionSnapshot(snapshot.id);

      // Re-solving saved questions earns nothing, but the keys stay present so
      // the payload matches the other solve endpoints.
      return { ...verdict, xps: 0, gems: 0 };
    } finally {
      await this.snapshots.unlockQuestionSnapshot(dto.snapshotId, lockToken);
    }
  }

  private buildQuestionMaps(
    questions: Question[],
    dto: SolvingSnapshotDto,
  ): QuestionMap[] {
    const questionIds = new Set(questions.map((question) => question.id));
    for (const submitted of dto.answers) {
      if (!questionIds.has(submitted.id)) {
        throw new BadRequestException(
          `Answer ${submitted.id} is not part of the saved questions snapshot`,
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
