import { Controller, Get, UseGuards } from '@nestjs/common';
import { StrictValidation } from '../../common';
import { Context } from '../../context';
import { JwtGuardStrict, RoleGuard, RoleType } from '../../core';
import { SubscriptionGuard } from '../../subscription/guard/subscription.guard';
import { SavedQuestionService } from './saved-question.service';
import { SavedQuestionCourse } from './types';

@Controller('learning/saved-questions')
@UseGuards(JwtGuardStrict, RoleGuard([RoleType.student]), SubscriptionGuard())
@StrictValidation()
export class SavedQuestionController {
  constructor(
    private readonly service: SavedQuestionService,
    private readonly ctxt: Context,
  ) {}

  // Questions save themselves when answered wrong in a lesson, so the student
  // only ever reads this list — it is grouped by course, not by question.
  @Get()
  async getSavedQuestions(): Promise<SavedQuestionCourse[]> {
    const student = this.ctxt.student;
    return this.service.getSavedQuestions({
      studentProfileId: student.id,
      schoolId: student.schoolId,
      trackId: student.trackId,
    });
  }
}
